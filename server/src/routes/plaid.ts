import { Router } from 'express';
import { createLinkToken, exchangePublicToken } from '../plaid';

export function createPlaidRouter() {
  const router = Router();

  router.post('/link-token', async (_req, res) => {
    const result = await createLinkToken();
    res.json(result);
  });

  router.post('/exchange-token', async (req, res) => {
    const { publicToken } = req.body ?? {};
    if (typeof publicToken !== 'string' || publicToken.length === 0) {
      res.status(400).json({ error: 'publicToken is required' });
      return;
    }
    const result = await exchangePublicToken(publicToken);
    res.json(result);
  });

  return router;
}
