import { Router } from 'express';
import type { Db } from '../db';

// isAppLocked is deliberately not stored here — whether *this device* is
// currently locked is Local state (per the app's own state matrix), not
// something that should sync across devices or survive a server restart.
type SettingsRow = {
  is_face_id_set_up: number;
  step_up_threshold: number;
  should_balances_blur: number;
  has_completed_onboarding: number;
};

function toApiShape(row: SettingsRow) {
  return {
    isFaceIdSetUp: Boolean(row.is_face_id_set_up),
    stepUpThreshold: row.step_up_threshold,
    shouldBalancesBlur: Boolean(row.should_balances_blur),
    hasCompletedOnboarding: Boolean(row.has_completed_onboarding),
  };
}

export function createSecurityRouter(db: Db) {
  const router = Router();

  function getRow() {
    return db.prepare('SELECT * FROM security_settings WHERE id = 1').get() as unknown as SettingsRow;
  }

  router.get('/', (_req, res) => {
    res.json(toApiShape(getRow()));
  });

  router.patch('/', (req, res) => {
    const body: Record<string, unknown> = req.body ?? {};
    const updates: string[] = [];
    const params: number[] = [];

    if ('isFaceIdSetUp' in body) {
      if (typeof body.isFaceIdSetUp !== 'boolean') {
        res.status(400).json({ error: 'isFaceIdSetUp must be a boolean' });
        return;
      }
      updates.push('is_face_id_set_up = ?');
      params.push(body.isFaceIdSetUp ? 1 : 0);
    }
    if ('stepUpThreshold' in body) {
      if (typeof body.stepUpThreshold !== 'number' || body.stepUpThreshold < 0) {
        res.status(400).json({ error: 'stepUpThreshold must be a non-negative number' });
        return;
      }
      updates.push('step_up_threshold = ?');
      params.push(body.stepUpThreshold);
    }
    if ('shouldBalancesBlur' in body) {
      if (typeof body.shouldBalancesBlur !== 'boolean') {
        res.status(400).json({ error: 'shouldBalancesBlur must be a boolean' });
        return;
      }
      updates.push('should_balances_blur = ?');
      params.push(body.shouldBalancesBlur ? 1 : 0);
    }
    if ('hasCompletedOnboarding' in body) {
      if (typeof body.hasCompletedOnboarding !== 'boolean') {
        res.status(400).json({ error: 'hasCompletedOnboarding must be a boolean' });
        return;
      }
      updates.push('has_completed_onboarding = ?');
      params.push(body.hasCompletedOnboarding ? 1 : 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'no valid fields provided' });
      return;
    }

    db.prepare(`UPDATE security_settings SET ${updates.join(', ')} WHERE id = 1`).run(...params);
    res.json(toApiShape(getRow()));
  });

  return router;
}
