// Exercises the real netlify/functions/state.mjs handler against a local
// Netlify Blobs server (the same server implementation @netlify/blobs
// documents for automated testing), without needing the full `netlify dev`
// CLI (which needs a network download blocked in this sandbox).
import { BlobsServer } from '@netlify/blobs/server';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';

const dir = mkdtempSync(join(tmpdir(), 'blobs-test-'));
const token = 'test-token';
const port = 8991;

const server = new BlobsServer({ directory: dir, port, token, debug: false });
await server.start();

process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({
  edgeURL: `http://localhost:${port}`,
  siteID: 'test-site',
  token
})).toString('base64');

const { default: handler } = await import('../netlify/functions/state.mjs');

async function run() {
  // 1. GET with nothing stored yet -> empty shape
  let res = await handler(new Request('http://x/.netlify/functions/state', { method: 'GET' }));
  assert.strictEqual(res.status, 200);
  let body = await res.json();
  assert.deepStrictEqual(body, { users: [], data: {} });
  console.log('PASS: empty GET returns empty shape');

  // 2. POST a ledger
  const ledger = {
    users: [{ id: 'usr_1', username: 'mariyah', usernameLower: 'mariyah', passwordHash: 'abc', salt: 'def', createdAt: 1 }],
    data: { usr_1: { accounts: [{ id: 'acc_1', name: 'Primary Account', opening: 1000 }], categories: [], transactions: [] } }
  };
  res = await handler(new Request('http://x/.netlify/functions/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ledger)
  }));
  assert.strictEqual(res.status, 200);
  body = await res.json();
  assert.deepStrictEqual(body, { ok: true });
  console.log('PASS: POST accepted');

  // 3. GET again -> round-trips exactly
  res = await handler(new Request('http://x/.netlify/functions/state', { method: 'GET' }));
  assert.strictEqual(res.status, 200);
  body = await res.json();
  assert.deepStrictEqual(body, ledger);
  console.log('PASS: GET round-trips saved ledger exactly');

  // 4. Malformed body rejected
  res = await handler(new Request('http://x/.netlify/functions/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"not":"valid shape"}'
  }));
  assert.strictEqual(res.status, 400);
  console.log('PASS: invalid shape rejected with 400');

  // 5. Bad JSON rejected
  res = await handler(new Request('http://x/.netlify/functions/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json'
  }));
  assert.strictEqual(res.status, 400);
  console.log('PASS: invalid JSON rejected with 400');

  // 6. Unsupported method rejected
  res = await handler(new Request('http://x/.netlify/functions/state', { method: 'DELETE' }));
  assert.strictEqual(res.status, 405);
  console.log('PASS: DELETE rejected with 405');

  // 7. A second, unrelated write really overwrites (last-write-wins, as documented)
  const ledger2 = { users: [], data: {} };
  await handler(new Request('http://x/.netlify/functions/state', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ledger2)
  }));
  res = await handler(new Request('http://x/.netlify/functions/state', { method: 'GET' }));
  body = await res.json();
  assert.deepStrictEqual(body, ledger2);
  console.log('PASS: overwrite replaces previous state');
}

run()
  .then(() => { console.log('\nALL FUNCTION TESTS PASSED'); })
  .catch((e) => { console.error('FUNCTION TEST FAILED:', e); process.exitCode = 1; })
  .finally(async () => { await server.stop?.(); rmSync(dir, { recursive: true, force: true }); process.exit(process.exitCode || 0); });
