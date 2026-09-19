import { DatabaseSync } from 'node:sqlite';

/**
 * Uses Node's built-in SQLite module (stable enough for this scope, still
 * flagged experimental upstream) instead of a native package like
 * better-sqlite3 — same synchronous API shape, zero native build step,
 * which matters in a sandboxed environment with no guaranteed prebuilt
 * binaries for every platform.
 */
export function createDb(path: string) {
  const db = new DatabaseSync(path);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_value REAL NOT NULL,
      health_score INTEGER NOT NULL,
      unallocated_funds REAL NOT NULL,
      harvest_mode TEXT NOT NULL,
      investment_mode TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_face_id_set_up INTEGER NOT NULL,
      step_up_threshold REAL NOT NULL,
      should_balances_blur INTEGER NOT NULL,
      has_completed_onboarding INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vaults (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      split_label TEXT NOT NULL,
      balance REAL NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      grp TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_audit (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      amount_label TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kingdom_impact (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      amount_label TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
  `);

  seedIfEmpty(db);

  return db;
}

function seedIfEmpty(db: DatabaseSync) {
  const stateRow = db.prepare('SELECT id FROM app_state WHERE id = 1').get();
  if (stateRow) return; // already seeded, e.g. reopening an existing file

  db.prepare(
    `INSERT INTO app_state (id, total_value, health_score, unallocated_funds, harvest_mode, investment_mode)
     VALUES (1, 6000, 85, 600, 'Standard', 'Standard')`
  ).run();

  db.prepare(
    `INSERT INTO security_settings (id, is_face_id_set_up, step_up_threshold, should_balances_blur, has_completed_onboarding)
     VALUES (1, 0, 500, 0, 0)`
  ).run();

  const insertVault = db.prepare(
    'INSERT INTO vaults (id, name, split_label, balance, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const vaults = [
    ['emergency-fund', 'Emergency Fund', '10% Auto-Split', 1800],
    ['wellspring-fund', 'Wellspring Fund', '5% Auto-Split', 900],
    ['gold-vault', 'Gold Vault', 'Manual', 2400],
    ['kingdom-fund', 'Kingdom Fund', 'Manual', 1200],
    ['manse-fund', 'Manse Fund', 'Manual', 1000],
  ];
  vaults.forEach((vault, index) => insertVault.run(...vault, index));

  const insertActivity = db.prepare(
    'INSERT INTO activity (id, label, amount, grp, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const activity = [
    ['a1', 'Groceries', -45.0, 'purchases'],
    ['a2', 'Fuel', -32.5, 'purchases'],
    ['a3', 'Subscription Refund', 12.0, 'cancelledPurchases'],
    ['a4', 'Duplicate Charge', 9.99, 'cancelledPurchases'],
    ['a5', 'Gold Vault', 200.0, 'streamAllocations'],
    ['a6', 'Wellspring Fund', 150.0, 'streamAllocations'],
    ['a7', 'Tithe', 100.0, 'kingdomImpacts'],
    ['a8', 'Offering', 25.0, 'kingdomImpacts'],
  ];
  activity.forEach((item, index) => insertActivity.run(...item, index));

  const insertAudit = db.prepare(
    'INSERT INTO expense_audit (id, label, amount_label, sort_order) VALUES (?, ?, ?, ?)'
  );
  const audit = [
    ['streaming', 'Streaming Subscription', '£9.99/mo'],
    ['gym', 'Unused Gym Membership', '£24.99/mo'],
    ['insurance', 'Duplicate Insurance', '£15.00/mo'],
  ];
  audit.forEach((item, index) => insertAudit.run(...item, index));

  const insertImpact = db.prepare(
    'INSERT INTO kingdom_impact (id, title, subtitle, amount_label, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  const impact = [
    ['k1', 'Tithe Consistency', 'Gave 10%+ for 6 consecutive months', '£1,200'],
    ['k2', 'Local Outreach Funded', 'Supported the City Mission food bank drive', '£250'],
    ['k3', 'Mission Trip Supported', 'Contributed to the summer mission trip fund', '£180'],
    ['k4', 'Widow & Orphan Care', 'Monthly support commitment fulfilled', '£75/mo'],
    ['k5', 'Disaster Relief Response', 'One-time gift to the relief fund', '£120'],
  ];
  impact.forEach((item, index) => insertImpact.run(...item, index));
}

export type Db = ReturnType<typeof createDb>;
