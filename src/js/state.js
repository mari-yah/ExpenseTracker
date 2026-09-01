// The data store: loading, per-user derivation, and saving. Talks to the
// Netlify Function in netlify/functions/state.mjs, which persists
// everything in one JSON blob via Netlify Blobs (see that file for the
// backend side). Every view module reads/writes through this file only —
// none of them touch fetch() or localStorage directly.
import { uid, todayStr } from './utils.js';
import { DEFAULT_CATEGORIES, SESSION_KEY } from './constants.js';
import { toast } from './ui.js';

export var state = { users: [], data: {} };

var renderCallback = null;
var API = '/.netlify/functions/state';

export function setRenderCallback(fn) { renderCallback = fn; }

export function loadInitialState() {
  return fetch(API)
    .then(function (r) {
      if (!r.ok) throw new Error('Failed to load ledger (status ' + r.status + ')');
      return r.json();
    })
    .then(function (parsed) {
      state.users = Array.isArray(parsed.users) ? parsed.users : [];
      state.data = (parsed.data && typeof parsed.data === 'object') ? parsed.data : {};
    })
    .catch(function (e) {
      console.error(e);
      toast("Couldn't reach the server — check your connection and refresh the page.");
    });
}

export function freshUserData() {
  return {
    accounts: [
      { id: uid('acc'), name: 'Primary Account', opening: 0, createdAt: Date.now() }
    ],
    categories: DEFAULT_CATEGORIES.map(function (c) { return { id: uid('cat'), name: c.name, budget: c.budget }; }),
    transactions: []
  };
}

export function currentUser() {
  var id = null;
  try { id = localStorage.getItem(SESSION_KEY); } catch (e) {}
  if (!id) return null;
  return state.users.find(function (u) { return u.id === id; }) || null;
}

export function currentUserData() {
  var u = currentUser();
  if (!u) return freshUserData();
  if (!state.data[u.id]) state.data[u.id] = freshUserData();
  var ud = state.data[u.id];
  if (!Array.isArray(ud.accounts)) ud.accounts = [];
  if (!Array.isArray(ud.categories)) ud.categories = [];
  if (!Array.isArray(ud.transactions)) ud.transactions = [];
  return ud;
}

export function setSession(userId) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

export function accountBalance(acc, txs) {
  var bal = Number(acc.opening) || 0;
  txs.forEach(function (t) {
    var amt = Number(t.amount) || 0;
    if (t.type === 'Income' && t.accountId === acc.id) bal += amt;
    else if (t.type === 'Expense' && t.accountId === acc.id) bal -= amt;
    else if (t.type === 'Transfer') {
      if (t.fromAccountId === acc.id) bal -= amt;
      if (t.toAccountId === acc.id) bal += amt;
    }
  });
  return bal;
}

export function accountName(accounts, id) {
  var a = accounts.find(function (a) { return a.id === id; });
  return a ? a.name : 'Deleted account';
}

export function allMonthKeys(txs) {
  var set = {};
  txs.forEach(function (t) { set[t.date.slice(0, 7)] = true; });
  set[todayStr.slice(0, 7)] = true;
  return Object.keys(set).sort().reverse();
}

/**
 * Persist a new top-level state object to the backend. Resolves true on
 * success (state applied + re-rendered), false if it could not be saved.
 *
 * Note: this is last-write-wins — the last save to reach the server
 * sticks. Fine for one person's own devices used one at a time, but if you
 * ever open the app in two tabs at once and edit both, the second save
 * overwrites the first.
 */
export function saveState(newState, opts) {
  opts = opts || {};
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newState)
  })
    .then(function (r) {
      if (!r.ok) throw new Error('Save failed (status ' + r.status + ')');
      state = newState;
      if (opts.onSuccess) opts.onSuccess();
      if (renderCallback) renderCallback();
      toast(opts.successMsg || 'Saved.');
      return true;
    })
    .catch(function (err) {
      console.error(err);
      toast(opts.offlineMsg || "Could not save changes — check your connection and try again.");
      return false;
    });
}

export function commitUserData(u, newUserData, opts) {
  var newState = Object.assign({}, state, { data: Object.assign({}, state.data) });
  newState.data[u.id] = newUserData;
  return saveState(newState, opts);
}

// Exports (JSON/CSV) are ordinary browser downloads — build a Blob, click
// a throwaway <a download> link.
export function getDownloads() {
  return Promise.resolve({
    save: function (opts) {
      var blob = new Blob([opts.data], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = opts.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return Promise.resolve();
    }
  });
}
