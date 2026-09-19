import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDb } from '../../db';
import { createApp } from '../../app';

function freshApp() {
  const db = createDb(':memory:');
  return createApp(db);
}

test('GET /api/security returns the seeded defaults', async () => {
  const app = freshApp();
  const res = await request(app).get('/api/security');

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    isFaceIdSetUp: false,
    stepUpThreshold: 500,
    shouldBalancesBlur: false,
    hasCompletedOnboarding: false,
  });
});

test('PATCH /api/security updates only the fields provided', async () => {
  const app = freshApp();

  const first = await request(app).patch('/api/security').send({ hasCompletedOnboarding: true });
  assert.equal(first.status, 200);
  assert.equal(first.body.hasCompletedOnboarding, true);
  assert.equal(first.body.stepUpThreshold, 500);

  const second = await request(app).patch('/api/security').send({ stepUpThreshold: 1000 });
  assert.equal(second.status, 200);
  assert.equal(second.body.stepUpThreshold, 1000);
  assert.equal(second.body.hasCompletedOnboarding, true);
});

test('PATCH /api/security rejects the wrong type for a field', async () => {
  const app = freshApp();
  const res = await request(app).patch('/api/security').send({ stepUpThreshold: 'a lot' });

  assert.equal(res.status, 400);
});

test('PATCH /api/security rejects an empty body', async () => {
  const app = freshApp();
  const res = await request(app).patch('/api/security').send({});

  assert.equal(res.status, 400);
});
