import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDb } from '../../db';
import { createApp } from '../../app';

function freshApp() {
  const db = createDb(':memory:');
  return createApp(db);
}

test('POST /api/plaid/link-token returns a stub token', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/plaid/link-token');

  assert.equal(res.status, 200);
  assert.match(res.body.linkToken, /^stub-link-token-/);
});

test('POST /api/plaid/exchange-token requires a publicToken', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/plaid/exchange-token').send({});

  assert.equal(res.status, 400);
});

test('POST /api/plaid/exchange-token returns a stub linked account', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/plaid/exchange-token').send({ publicToken: 'public-abc123' });

  assert.equal(res.status, 200);
  assert.equal(res.body.institutionName, 'Mock Bank');
});
