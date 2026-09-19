import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDb } from '../../db';
import { createApp } from '../../app';

function freshApp() {
  const db = createDb(':memory:');
  return createApp(db);
}

test('GET /api/finance returns the seeded snapshot', async () => {
  const app = freshApp();
  const res = await request(app).get('/api/finance');

  assert.equal(res.status, 200);
  assert.equal(res.body.totalValue, 6000);
  assert.equal(res.body.vaults.length, 5);
  assert.equal(res.body.expenseAudit.length, 3);
});

test('POST /api/finance/transfer subtracts the amount and logs an activity entry', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/finance/transfer').send({ amount: 100, recipient: 'Emergency Fund' });

  assert.equal(res.status, 201);
  assert.equal(res.body.totalValue, 5900);
  assert.equal(res.body.recentActivity[0].label, 'Transfer to Emergency Fund');
});

test('POST /api/finance/transfer rejects a non-positive amount', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/finance/transfer').send({ amount: -10, recipient: 'Emergency Fund' });

  assert.equal(res.status, 400);
});

test('POST /api/finance/allocation-rules adds a new vault at the front', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/finance/allocation-rules').send({ name: 'Payday Top-Up', percent: 10 });

  assert.equal(res.status, 201);
  assert.equal(res.body.vaults.length, 6);
  assert.equal(res.body.vaults[0].name, 'Payday Top-Up');
  assert.equal(res.body.vaults[0].splitLabel, '10% Auto-Split');
});

test('POST /api/finance/deploy-capital never takes unallocatedFunds below zero', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/finance/deploy-capital').send({ amount: 10000, product: 'Kingdom Fund' });

  assert.equal(res.status, 200);
  assert.equal(res.body.unallocatedFunds, 0);
});

test('DELETE /api/finance/expense-audit/:id removes the item, 404s on an unknown id', async () => {
  const app = freshApp();

  const ok = await request(app).delete('/api/finance/expense-audit/streaming');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.expenseAudit.length, 2);

  const missing = await request(app).delete('/api/finance/expense-audit/does-not-exist');
  assert.equal(missing.status, 404);
});

test('POST /api/finance/kingdom-impact adds a log entry', async () => {
  const app = freshApp();
  const res = await request(app).post('/api/finance/kingdom-impact').send({ title: 'Food bank drive', amountLabel: '£25' });

  assert.equal(res.status, 201);
  assert.equal(res.body.kingdomImpactLog.length, 6);
  assert.equal(res.body.kingdomImpactLog[0].title, 'Food bank drive');
});

test('PATCH /api/finance/harvest-mode rejects an unknown mode', async () => {
  const app = freshApp();
  const res = await request(app).patch('/api/finance/harvest-mode').send({ mode: 'Chaos' });

  assert.equal(res.status, 400);
});

test('PATCH /api/finance/harvest-mode accepts a valid mode', async () => {
  const app = freshApp();
  const res = await request(app).patch('/api/finance/harvest-mode').send({ mode: 'Bull' });

  assert.equal(res.status, 200);
  assert.equal(res.body.harvestMode, 'Bull');
});
