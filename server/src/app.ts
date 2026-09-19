import express from 'express';
import cors from 'cors';
import type { Db } from './db';
import { createFinanceRouter } from './routes/finance';
import { createSecurityRouter } from './routes/security';
import { createPlaidRouter } from './routes/plaid';

// Takes the db as a parameter instead of importing one global instance —
// that's what lets tests spin up a fresh app wired to a throwaway
// in-memory database, with no shared state leaking between test files.
export function createApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/finance', createFinanceRouter(db));
  app.use('/api/security', createSecurityRouter(db));
  app.use('/api/plaid', createPlaidRouter());

  return app;
}
