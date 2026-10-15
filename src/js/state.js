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

export function getAccountType(acc) {
  if (!acc) return 'Bank';
  if (acc.accountType) return acc.accountType;
  var n = (acc.name || '').trim().toLowerCase();
  if (n.indexOf('credit card') !== -1 || n === 'cc' || n.indexOf('card due') !== -1) return 'Credit Card';
  if (n.indexOf('cash') !== -1) return 'Cash';
  return 'Bank';
}

export function ensureSpecialAccounts(ud) {
  if (!ud || !Array.isArray(ud.accounts)) return;
  ud.accounts.forEach(function (a) {
    if (!a.accountType) a.accountType = getAccountType(a);
  });
  var hasCash = ud.accounts.some(function (a) { return getAccountType(a) === 'Cash'; });
  if (!hasCash) {
    ud.accounts.push({ id: uid('acc'), name: 'Cash Account', accountType: 'Cash', opening: 0, createdAt: Date.now() });
  }
  var hasCC = ud.accounts.some(function (a) { return getAccountType(a) === 'Credit Card'; });
  if (!hasCC) {
    ud.accounts.push({ id: uid('acc'), name: 'Credit Card', accountType: 'Credit Card', opening: 0, createdAt: Date.now() });
  }
}

export function freshUserData() {
  return {
    accounts: [
      { id: uid('acc'), name: 'Primary Account', accountType: 'Bank', opening: 0, createdAt: Date.now() },
      { id: uid('acc'), name: 'Cash Account', accountType: 'Cash', opening: 0, createdAt: Date.now() },
      { id: uid('acc'), name: 'Credit Card', accountType: 'Credit Card', opening: 0, createdAt: Date.now() }
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
  ensureSpecialAccounts(ud);
  return ud;
}

export function isCategoryActiveInMonth(cat, monthKey) {
  if (!cat) return false;
  if (!cat.monthOnly) return true;
  if (!monthKey) return true;
  return cat.monthOnly === monthKey;
}

export function categoriesForMonth(categories, monthKey) {
  return (categories || []).filter(function (c) {
    return isCategoryActiveInMonth(c, monthKey);
  });
}

export function categoryBudget(cat, monthKey) {
  if (!cat) return 0;
  if (cat.monthOnly && monthKey && cat.monthOnly !== monthKey) return 0;
  if (cat.monthlyBudgets && monthKey && cat.monthlyBudgets[monthKey] !== undefined) {
    return Number(cat.monthlyBudgets[monthKey]) || 0;
  }
  return Number(cat.budget) || 0;
}

export function setSession(userId) {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}

export function findCashAccount(accounts) {
  return (accounts || []).find(function (a) { return getAccountType(a) === 'Cash'; }) || null;
}

export function findCreditCardAccount(accounts) {
  return (accounts || []).find(function (a) { return getAccountType(a) === 'Credit Card'; }) || null;
}

/**
 * Resolves which account an Income or Expense transaction actually affects:
 * - If Payment Mode is 'Credit Card' (or account is a Credit Card), it routes to the Credit Card ledger (does NOT deduct from Bank).
 * - If Payment Mode is 'Cash' (or account is a Cash account), it routes to the Cash Account (deducts from Cash Account, NOT Bank).
 */
export function effectiveTxAccountId(t, accounts) {
  if (!t || (t.type !== 'Expense' && t.type !== 'Income')) return t ? t.accountId : null;
  var acc = (accounts || []).find(function (a) { return a.id === t.accountId; });
  var accType = acc ? getAccountType(acc) : 'Bank';

  if (t.type === 'Expense' && (t.mode === 'Credit Card' || accType === 'Credit Card')) {
    if (accType === 'Credit Card') return acc.id;
    var cc = findCreditCardAccount(accounts);
    if (cc) return cc.id;
  }

  if (t.mode === 'Cash' || accType === 'Cash') {
    if (accType === 'Cash') return acc.id;
    var cashAcc = findCashAccount(accounts);
    if (cashAcc) return cashAcc.id;
  }

  return t.accountId;
}

export function isCreditCardTx(t, accounts) {
  var ccIds = {};
  (accounts || []).forEach(function (a) {
    if (getAccountType(a) === 'Credit Card') ccIds[a.id] = true;
  });
  if (t.type === 'Expense' && (t.mode === 'Credit Card' || ccIds[t.accountId])) return true;
  if ((t.type === 'CC Bill Payment' || t.type === 'Transfer') && (ccIds[t.toAccountId] || ccIds[t.fromAccountId])) return true;
  return false;
}

export function isCashTx(t, accounts) {
  var cashIds = {};
  (accounts || []).forEach(function (a) {
    if (getAccountType(a) === 'Cash') cashIds[a.id] = true;
  });
  if ((t.type === 'Expense' || t.type === 'Income') && (t.mode === 'Cash' || cashIds[t.accountId])) return true;
  if (t.type === 'Transfer' && (cashIds[t.toAccountId] || cashIds[t.fromAccountId])) return true;
  return false;
}

export function accountBalance(acc, txs, allAccounts) {
  var accounts = allAccounts || currentUserData().accounts || [acc];
  var accType = getAccountType(acc);
  var bal = Number(acc.opening) || 0;

  if (accType === 'Credit Card') {
    // Credit Card tracks unpaid CC Due (increases on CC Expense, decreases when bill is paid)
    txs.forEach(function (t) {
      var amt = Number(t.amount) || 0;
      var effId = effectiveTxAccountId(t, accounts);
      if (t.type === 'Expense' && effId === acc.id) {
        bal += amt;
      } else if ((t.type === 'CC Bill Payment' || t.type === 'Transfer') && t.toAccountId === acc.id) {
        bal -= amt;
      } else if (t.type === 'Income' && effId === acc.id) {
        bal -= amt;
      }
    });
    return bal;
  }

  // Bank or Cash Account
  txs.forEach(function (t) {
    var amt = Number(t.amount) || 0;
    var effId = effectiveTxAccountId(t, accounts);
    if (t.type === 'Income' && effId === acc.id) {
      bal += amt;
    } else if (t.type === 'Expense' && effId === acc.id) {
      bal -= amt;
    } else if (t.type === 'Transfer' || t.type === 'CC Bill Payment') {
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
