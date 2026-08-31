// Bulk-import transactions from a CSV file. Deliberately uses the same
// column shape the app's own "Export transactions as CSV" produces (see
// view-profile.js: Date, Type, Account, To Account, Category, Mode,
// Description, Amount), so exporting and re-importing round-trip — and so
// a spreadsheet converted into this shape elsewhere just works.
//
// Accounts and categories that don't already exist are created rather than
// rejected, since a first import is usually someone's whole transaction
// history predating the accounts/categories they've set up in the app so
// far. Rows that already look present (same date/type/account/category/
// description/amount) are skipped as duplicates, so re-running an import
// on the same file twice doesn't double every transaction.
import { uid, pad } from './utils.js';
import { parseCsv } from './csv.js';

var HEADER_ALIASES = {
  date: 'date', type: 'type', account: 'account', 'to account': 'toAccount',
  category: 'category', mode: 'mode', description: 'description', amount: 'amount'
};

function normalizeType(s) {
  var v = (s || '').trim().toLowerCase();
  if (v === 'income') return 'Income';
  if (v === 'expense') return 'Expense';
  if (v === 'transfer') return 'Transfer';
  return null;
}

function normalizeDate(s) {
  s = (s || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (m) {
    var d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return y + '-' + pad(mo) + '-' + pad(d);
  }
  return null;
}

function signature(t) {
  return [t.date, t.type, t.accountId || '', t.fromAccountId || '', t.toAccountId || '', t.category || '', t.desc || '', t.amount].join('|');
}

/**
 * Parses CSV text against an existing user's data (ud: {accounts,
 * categories, transactions}) and returns a preview — nothing is applied
 * yet. Call applyImport() with the result to actually merge it in.
 */
export function parseImportCsv(text, ud) {
  var table = parseCsv(text);
  if (table.length < 2) return { error: 'That file has no data rows.' };

  var header = table[0].map(function (h) { return (h || '').trim().toLowerCase(); });
  var idx = {};
  header.forEach(function (h, i) { if (HEADER_ALIASES[h]) idx[HEADER_ALIASES[h]] = i; });
  if (idx.date === undefined || idx.type === undefined || idx.amount === undefined) {
    return { error: 'Expected columns Date, Type and Amount (also Account, To Account, Category, Mode, Description) — could not find them in the first row.' };
  }

  var accountsByName = {};
  ud.accounts.forEach(function (a) { accountsByName[a.name.trim().toLowerCase()] = a; });
  var categoriesByName = {};
  ud.categories.forEach(function (c) { categoriesByName[c.name.trim().toLowerCase()] = c; });
  var seenSignatures = {};
  ud.transactions.forEach(function (t) { seenSignatures[signature(t)] = true; });

  var newAccounts = [];
  var newCategories = [];
  var transactions = [];
  var rowErrors = [];
  var duplicates = 0;

  function resolveAccount(name) {
    var key = (name || '').trim().toLowerCase();
    if (!key) return null;
    if (accountsByName[key]) return accountsByName[key];
    var acc = { id: uid('acc'), name: name.trim(), opening: 0, createdAt: Date.now() };
    newAccounts.push(acc);
    accountsByName[key] = acc;
    return acc;
  }

  function resolveCategory(name) {
    var key = (name || '').trim().toLowerCase();
    if (!key) return '';
    if (!categoriesByName[key]) {
      var cat = { id: uid('cat'), name: name.trim(), budget: 0 };
      newCategories.push(cat);
      categoriesByName[key] = cat;
    }
    return categoriesByName[key].name;
  }

  for (var r = 1; r < table.length; r++) {
    var cols = table[r];
    if (cols.every(function (c) { return c.trim() === ''; })) continue;

    var get = function (key) { return idx[key] !== undefined ? (cols[idx[key]] || '').trim() : ''; };
    var date = normalizeDate(get('date'));
    var type = normalizeType(get('type'));
    var amount = parseFloat(get('amount'));

    if (!date) { rowErrors.push('Row ' + (r + 1) + ': could not read the date "' + get('date') + '".'); continue; }
    if (!type) { rowErrors.push('Row ' + (r + 1) + ': type must be Income, Expense or Transfer (got "' + get('type') + '").'); continue; }
    if (!(amount > 0)) { rowErrors.push('Row ' + (r + 1) + ': amount must be a positive number (got "' + get('amount') + '").'); continue; }

    var record = {
      id: uid('tx'), date: date, type: type,
      accountId: null, fromAccountId: null, toAccountId: null,
      category: '', mode: get('mode') || 'Other', desc: get('description'), amount: amount
    };

    if (type === 'Transfer') {
      var from = resolveAccount(get('account'));
      var to = resolveAccount(get('toAccount'));
      if (!from || !to) { rowErrors.push('Row ' + (r + 1) + ': a Transfer needs both Account and To Account.'); continue; }
      if (from.id === to.id) { rowErrors.push('Row ' + (r + 1) + ': Transfer needs two different accounts.'); continue; }
      record.fromAccountId = from.id;
      record.toAccountId = to.id;
    } else {
      var acc = resolveAccount(get('account'));
      if (!acc) { rowErrors.push('Row ' + (r + 1) + ': missing Account.'); continue; }
      record.accountId = acc.id;
      if (type === 'Expense') record.category = resolveCategory(get('category'));
    }

    // Only checked against transactions that existed before this import —
    // deliberately NOT against other rows in this same batch, since two
    // genuinely separate transactions (two bus fares on the same day, same
    // amount) are common and would otherwise look identical and get
    // dropped as if one were a duplicate of the other.
    var sig = signature(record);
    if (seenSignatures[sig]) { duplicates++; continue; }
    transactions.push(record);
  }

  return {
    transactions: transactions,
    newAccounts: newAccounts,
    newCategories: newCategories,
    duplicates: duplicates,
    rowErrors: rowErrors,
    totalRows: table.length - 1
  };
}

/** Merges a parseImportCsv() result into a user's data object. */
export function applyImport(ud, preview) {
  return {
    accounts: ud.accounts.concat(preview.newAccounts),
    categories: ud.categories.concat(preview.newCategories),
    transactions: ud.transactions.concat(preview.transactions)
  };
}
