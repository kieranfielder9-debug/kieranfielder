import { Router } from 'express';
import type { Db } from '../db';

type StateRow = { total_value: number; health_score: number; unallocated_funds: number; harvest_mode: string; investment_mode: string };
type VaultRow = { id: string; name: string; split_label: string; balance: number };
type ActivityRow = { id: string; label: string; amount: number; grp: string };
type AuditRow = { id: string; label: string; amount_label: string };
type ImpactRow = { id: string; title: string; subtitle: string; amount_label: string };

const ASSESSMENTS = [
  { id: 'expense-audit', title: 'Expense Audit', subtitle: 'Reviewed your last 30 days of spending', status: 'completed' },
  { id: 'kingdom-obligations', title: 'Kingdom Obligations', subtitle: 'Confirmed tithe & giving commitments', status: 'completed' },
  { id: 'identity-profile', title: 'Identity Profile', subtitle: '3 of 5 questions answered — tap to continue', status: 'continue' },
];

const HARVEST_MODES = ['Standard', 'Bull', 'Bear', 'Jubilee'];
const INVESTMENT_MODES = ['Standard', 'Personalise', 'Auto'];

export function createFinanceRouter(db: Db) {
  const router = Router();

  function getSnapshot() {
    const state = db.prepare('SELECT * FROM app_state WHERE id = 1').get() as unknown as StateRow;
    const vaults = db.prepare('SELECT id, name, split_label, balance FROM vaults ORDER BY sort_order').all() as unknown as VaultRow[];
    const activity = db.prepare('SELECT id, label, amount, grp FROM activity ORDER BY sort_order').all() as unknown as ActivityRow[];
    const audit = db.prepare('SELECT id, label, amount_label FROM expense_audit ORDER BY sort_order').all() as unknown as AuditRow[];
    const impact = db.prepare('SELECT id, title, subtitle, amount_label FROM kingdom_impact ORDER BY sort_order').all() as unknown as ImpactRow[];

    return {
      isLoading: false,
      totalValue: state.total_value,
      healthScore: state.health_score,
      unallocatedFunds: state.unallocated_funds,
      harvestMode: state.harvest_mode,
      investmentMode: state.investment_mode,
      vaults: vaults.map((v) => ({ id: v.id, name: v.name, splitLabel: v.split_label, balance: v.balance })),
      recentActivity: activity.map((a) => ({ id: a.id, label: a.label, amount: a.amount, group: a.grp })),
      expenseAudit: audit.map((a) => ({ id: a.id, label: a.label, amountLabel: a.amount_label })),
      kingdomImpactLog: impact.map((i) => ({ id: i.id, title: i.title, subtitle: i.subtitle, amountLabel: i.amount_label })),
      assessments: ASSESSMENTS,
    };
  }

  router.get('/', (_req, res) => {
    res.json(getSnapshot());
  });

  router.post('/transfer', (req, res) => {
    const { amount, recipient } = req.body ?? {};
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }
    if (typeof recipient !== 'string' || recipient.trim().length === 0) {
      res.status(400).json({ error: 'recipient is required' });
      return;
    }

    db.prepare('UPDATE app_state SET total_value = total_value - ? WHERE id = 1').run(amount);
    const minOrder = (db.prepare('SELECT MIN(sort_order) as m FROM activity').get() as { m: number | null }).m ?? 0;
    db.prepare('INSERT INTO activity (id, label, amount, grp, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      `transfer-${Date.now()}`,
      `Transfer to ${recipient}`,
      -amount,
      'purchases',
      minOrder - 1
    );

    res.status(201).json(getSnapshot());
  });

  router.post('/allocation-rules', (req, res) => {
    const { name, percent } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (typeof percent !== 'number' || percent <= 0) {
      res.status(400).json({ error: 'percent must be a positive number' });
      return;
    }

    const minOrder = (db.prepare('SELECT MIN(sort_order) as m FROM vaults').get() as { m: number | null }).m ?? 0;
    db.prepare('INSERT INTO vaults (id, name, split_label, balance, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      `vault-${Date.now()}`,
      name,
      `${percent}% Auto-Split`,
      0,
      minOrder - 1
    );

    res.status(201).json(getSnapshot());
  });

  router.post('/deploy-capital', (req, res) => {
    const { amount, product } = req.body ?? {};
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }
    if (typeof product !== 'string' || product.trim().length === 0) {
      res.status(400).json({ error: 'product is required' });
      return;
    }

    db.prepare('UPDATE app_state SET unallocated_funds = MAX(0, unallocated_funds - ?) WHERE id = 1').run(amount);
    res.status(200).json(getSnapshot());
  });

  router.delete('/expense-audit/:id', (req, res) => {
    const result = db.prepare('DELETE FROM expense_audit WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'no such expense audit item' });
      return;
    }
    res.status(200).json(getSnapshot());
  });

  router.post('/kingdom-impact', (req, res) => {
    const { title, amountLabel } = req.body ?? {};
    if (typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (typeof amountLabel !== 'string' || amountLabel.trim().length === 0) {
      res.status(400).json({ error: 'amountLabel is required' });
      return;
    }

    const minOrder = (db.prepare('SELECT MIN(sort_order) as m FROM kingdom_impact').get() as { m: number | null }).m ?? 0;
    db.prepare('INSERT INTO kingdom_impact (id, title, subtitle, amount_label, sort_order) VALUES (?, ?, ?, ?, ?)').run(
      `impact-${Date.now()}`,
      title,
      'Logged by you',
      amountLabel,
      minOrder - 1
    );

    res.status(201).json(getSnapshot());
  });

  router.patch('/harvest-mode', (req, res) => {
    const { mode } = req.body ?? {};
    if (!HARVEST_MODES.includes(mode)) {
      res.status(400).json({ error: `mode must be one of ${HARVEST_MODES.join(', ')}` });
      return;
    }
    db.prepare('UPDATE app_state SET harvest_mode = ? WHERE id = 1').run(mode);
    res.status(200).json(getSnapshot());
  });

  router.patch('/investment-mode', (req, res) => {
    const { mode } = req.body ?? {};
    if (!INVESTMENT_MODES.includes(mode)) {
      res.status(400).json({ error: `mode must be one of ${INVESTMENT_MODES.join(', ')}` });
      return;
    }
    db.prepare('UPDATE app_state SET investment_mode = ? WHERE id = 1').run(mode);
    res.status(200).json(getSnapshot());
  });

  return router;
}
