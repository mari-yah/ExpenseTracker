// The entire backend: one JSON blob holding { users: [...], data: {...} },
// read on GET and fully replaced on POST. Netlify Blobs is Netlify's own
// built-in key/value store — no external database account needed, and it's
// automatically available to any function running on a deployed Netlify
// site.
//
// Written as a "v2" function (the `export default` form) rather than the
// older Lambda-style `exports.handler` form, because v2 functions get their
// Netlify Blobs credentials wired up automatically. The Lambda-style form
// needs an extra `connectLambda(event)` call to do the same — easy to miss
// and easy to end up with a function that silently can't reach its store.
//
// This mirrors the app's existing model exactly: the whole ledger (every
// user, every account) already lives in one JSON object client-side, so the
// backend just needs to store and return that one object. Same trust model
// as before too — this is a personal privacy layer, not bank-grade
// security: there's no per-request auth, so anyone who can reach this URL
// can read or overwrite the blob. Don't hand this URL out.
import { getStore } from '@netlify/blobs';

const KEY = 'ledger-state';
const EMPTY = { users: [], data: {} };
const MAX_BYTES = 5 * 1024 * 1024;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default async (req) => {
  const store = getStore('household-ledger');

  if (req.method === 'GET') {
    let stored;
    try {
      stored = await store.get(KEY, { type: 'json' });
    } catch (e) {
      return json({ error: 'Could not read ledger.' }, 500);
    }
    return json(stored || EMPTY);
  }

  if (req.method === 'POST') {
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) {
      return json({ error: 'Ledger too large.' }, 413);
    }
    let body;
    try {
      body = JSON.parse(raw || '{}');
    } catch (e) {
      return json({ error: 'Invalid JSON.' }, 400);
    }
    if (!body || !Array.isArray(body.users) || typeof body.data !== 'object' || body.data === null) {
      return json({ error: 'Invalid ledger shape.' }, 400);
    }
    try {
      await store.setJSON(KEY, body);
    } catch (e) {
      return json({ error: 'Could not save ledger.' }, 500);
    }
    return json({ ok: true });
  }

  return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
};

export const config = {
  path: '/.netlify/functions/state'
};
