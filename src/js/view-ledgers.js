import { escapeHtml, inr, uid, todayStr, monthLabel } from './utils.js';
import { toast } from './ui.js';
import * as State from './state.js';
import { renderTxListHtml, bindTxItemActions } from './view-transactions.js';

export function renderCreditCardLedger(main, ui, render, u) {
  var ud = State.currentUserData();
  var months = State.allMonthKeys(ud.transactions);
  ui.ccMonthFilter = ui.ccMonthFilter || 'all';

  var monthFilterOptions = '<option value="all">All months</option>' + months.map(function (k) {
    return '<option value="' + k + '" ' + (k === ui.ccMonthFilter ? 'selected' : '') + '>' + monthLabel(k) + '</option>';
  }).join('');

  var ccAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Credit Card'; });
  var bankAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Bank'; });
  var catOpts = ud.categories.map(function (c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; }).join('');
  var ccOpts = ccAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');
  var bankOpts = bankAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');

  var allCcTxs = ud.transactions.filter(function (t) { return State.isCreditCardTx(t, ud.accounts); });
  var filteredTxs = allCcTxs.filter(function (t) {
    if (ui.ccMonthFilter !== 'all' && t.date.slice(0, 7) !== ui.ccMonthFilter) return false;
    return true;
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  var totalCcSpent = filteredTxs
    .filter(function (t) { return t.type === 'Expense'; })
    .reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);

  var totalCcPaid = filteredTxs
    .filter(function (t) { return t.type === 'CC Bill Payment' || t.type === 'Transfer'; })
    .reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);

  var totalOutstandingDue = ccAccounts.reduce(function (s, a) {
    return s + State.accountBalance(a, ud.transactions, ud.accounts);
  }, 0);

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Credit Card Ledger</h1><div class="sub">All Credit Card spends & bill payments — spends do not deduct from your Bank account.</div></div></div>' +

    '<div class="stat-row">' +
    '<div class="stat-card expense"><div class="lbl">CC Spent (' + (ui.ccMonthFilter === 'all' ? 'All Time' : monthLabel(ui.ccMonthFilter)) + ')</div><div class="val num">' + inr(totalCcSpent) + '</div></div>' +
    '<div class="stat-card income"><div class="lbl">CC Bills Paid (' + (ui.ccMonthFilter === 'all' ? 'All Time' : monthLabel(ui.ccMonthFilter)) + ')</div><div class="val num">' + inr(totalCcPaid) + '</div></div>' +
    '<div class="stat-card"><div class="lbl">Current Unpaid CC Due</div><div class="val num">' + inr(totalOutstandingDue) + '</div></div>' +
    '</div>' +

    '<div class="card" style="margin-bottom:22px;">' +
    '<h3 style="font-size:0.95rem; margin-bottom:14px;">Quick Log Credit Card Transaction</h3>' +
    '<form class="grid-form" id="ccQuickForm">' +
    '<div class="field"><span class="field-label">Date</span><input type="date" name="date" required value="' + todayStr + '"></div>' +
    '<div class="field"><span class="field-label">Entry Type</span><select name="type" id="ccActionType">' +
    '<option value="Expense">CC Expense (Does not deduct Bank)</option>' +
    '<option value="CC Bill Payment">Pay CC Bill (Deducts from Bank)</option>' +
    '</select></div>' +
    '<div class="field"><span class="field-label">Credit Card</span><select name="ccAccountId">' + ccOpts + '</select></div>' +
    '<div class="field" id="ccCatField"><span class="field-label">Category</span><select name="category">' + catOpts + '</select></div>' +
    '<div class="field" id="ccBankField" hidden><span class="field-label">Pay From Bank</span><select name="fromBankId">' + bankOpts + '</select></div>' +
    '<div class="field"><span class="field-label">Amount (₹)</span><input type="number" name="amount" min="0.01" step="0.01" required placeholder="0.00"></div>' +
    '<div class="field"><span class="field-label">Description</span><input type="text" name="desc" placeholder="e.g. Amazon / Swiggy / Bill settlement"></div>' +
    '<div class="field full"><button type="submit" class="btn">Add to Credit Card Ledger</button></div>' +
    '</form>' +
    '</div>' +

    '<form class="filter-row">' +
    '<div class="field"><span class="field-label">Filter Month</span><select id="ccMonthFilter">' + monthFilterOptions + '</select></div>' +
    '</form>' +

    '<div class="card" id="ccListCard">' + renderTxListHtml(filteredTxs, ud) + '</div>'
  );

  var ccActionType = document.getElementById('ccActionType');
  ccActionType.addEventListener('change', function () {
    var isPay = ccActionType.value === 'CC Bill Payment';
    document.getElementById('ccCatField').hidden = isPay;
    document.getElementById('ccBankField').hidden = !isPay;
  });

  document.getElementById('ccQuickForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var type = fd.get('type');
    var amount = parseFloat(fd.get('amount')) || 0;
    if (amount <= 0) { toast('Enter an amount greater than zero.'); return; }
    var ccId = fd.get('ccAccountId');
    var record;
    if (type === 'Expense') {
      record = {
        id: uid('tx'),
        date: fd.get('date'),
        type: 'Expense',
        accountId: ccId,
        fromAccountId: null,
        toAccountId: null,
        category: fd.get('category'),
        mode: 'Credit Card',
        desc: fd.get('desc'),
        amount: amount
      };
    } else {
      var fromBankId = fd.get('fromBankId');
      if (!fromBankId) { toast('Add a Bank account first to pay the bill from.'); return; }
      record = {
        id: uid('tx'),
        date: fd.get('date'),
        type: 'CC Bill Payment',
        accountId: null,
        fromAccountId: fromBankId,
        toAccountId: ccId,
        category: '',
        mode: 'UPI',
        desc: fd.get('desc') || 'Credit Card Bill Payment',
        amount: amount
      };
    }
    State.commitUserData(u, Object.assign({}, ud, { transactions: ud.transactions.concat([record]) }), {
      successMsg: type === 'Expense' ? 'Credit card expense logged.' : 'Credit card bill payment recorded.'
    });
  });

  document.getElementById('ccMonthFilter').addEventListener('change', function (e) {
    ui.ccMonthFilter = e.target.value;
    render();
  });

  bindTxItemActions(document.getElementById('ccListCard'), u, ud, ui, render);
}

export function renderCashLedger(main, ui, render, u) {
  var ud = State.currentUserData();
  var months = State.allMonthKeys(ud.transactions);
  ui.cashMonthFilter = ui.cashMonthFilter || 'all';

  var monthFilterOptions = '<option value="all">All months</option>' + months.map(function (k) {
    return '<option value="' + k + '" ' + (k === ui.cashMonthFilter ? 'selected' : '') + '>' + monthLabel(k) + '</option>';
  }).join('');

  var cashAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Cash'; });
  var bankAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Bank'; });
  var catOpts = ud.categories.map(function (c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; }).join('');
  var cashOpts = cashAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');
  var bankOpts = bankAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');

  var allCashTxs = ud.transactions.filter(function (t) { return State.isCashTx(t, ud.accounts); });
  var filteredTxs = allCashTxs.filter(function (t) {
    if (ui.cashMonthFilter !== 'all' && t.date.slice(0, 7) !== ui.cashMonthFilter) return false;
    return true;
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  var cashIds = {};
  cashAccounts.forEach(function (a) { cashIds[a.id] = true; });

  var cashAdded = filteredTxs.reduce(function (s, t) {
    var amt = Number(t.amount || 0);
    if (t.type === 'Transfer' && cashIds[t.toAccountId]) return s + amt;
    if (t.type === 'Income') return s + amt;
    return s;
  }, 0);

  var cashSpent = filteredTxs.reduce(function (s, t) {
    var amt = Number(t.amount || 0);
    if (t.type === 'Expense') return s + amt;
    if (t.type === 'Transfer' && cashIds[t.fromAccountId]) return s + amt;
    return s;
  }, 0);

  var currentCashBalance = cashAccounts.reduce(function (s, a) {
    return s + State.accountBalance(a, ud.transactions, ud.accounts);
  }, 0);

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Cash Ledger</h1><div class="sub">Transfer cash from your Bank account and track all Cash expenses automatically.</div></div></div>' +

    '<div class="stat-row">' +
    '<div class="stat-card income"><div class="lbl">Cash Withdrawn / In (' + (ui.cashMonthFilter === 'all' ? 'All Time' : monthLabel(ui.cashMonthFilter)) + ')</div><div class="val num">' + inr(cashAdded) + '</div></div>' +
    '<div class="stat-card expense"><div class="lbl">Cash Spent (' + (ui.cashMonthFilter === 'all' ? 'All Time' : monthLabel(ui.cashMonthFilter)) + ')</div><div class="val num">' + inr(cashSpent) + '</div></div>' +
    '<div class="stat-card"><div class="lbl">Current Cash Account Balance</div><div class="val num">' + inr(currentCashBalance) + '</div></div>' +
    '</div>' +

    '<div class="card" style="margin-bottom:22px;">' +
    '<h3 style="font-size:0.95rem; margin-bottom:14px;">Quick Log Cash Transaction</h3>' +
    '<form class="grid-form" id="cashQuickForm">' +
    '<div class="field"><span class="field-label">Date</span><input type="date" name="date" required value="' + todayStr + '"></div>' +
    '<div class="field"><span class="field-label">Entry Type</span><select name="type" id="cashActionType">' +
    '<option value="Expense">Cash Expense (Deducts from Cash Account)</option>' +
    '<option value="Transfer">Withdraw Cash from Bank (Bank → Cash)</option>' +
    '<option value="Income">Cash Income (Adds to Cash Account)</option>' +
    '</select></div>' +
    '<div class="field"><span class="field-label">Cash Account</span><select name="cashAccountId">' + cashOpts + '</select></div>' +
    '<div class="field" id="cashCatField"><span class="field-label">Category</span><select name="category">' + catOpts + '</select></div>' +
    '<div class="field" id="cashBankField" hidden><span class="field-label">Withdraw From Bank</span><select name="fromBankId">' + bankOpts + '</select></div>' +
    '<div class="field"><span class="field-label">Amount (₹)</span><input type="number" name="amount" min="0.01" step="0.01" required placeholder="0.00"></div>' +
    '<div class="field"><span class="field-label">Description</span><input type="text" name="desc" placeholder="e.g. Vegetables / ATM Cash Withdrawal"></div>' +
    '<div class="field full"><button type="submit" class="btn">Add to Cash Ledger</button></div>' +
    '</form>' +
    '</div>' +

    '<form class="filter-row">' +
    '<div class="field"><span class="field-label">Filter Month</span><select id="cashMonthFilter">' + monthFilterOptions + '</select></div>' +
    '</form>' +

    '<div class="card" id="cashListCard">' + renderTxListHtml(filteredTxs, ud) + '</div>'
  );

  var cashActionType = document.getElementById('cashActionType');
  cashActionType.addEventListener('change', function () {
    var t = cashActionType.value;
    document.getElementById('cashCatField').hidden = t !== 'Expense';
    document.getElementById('cashBankField').hidden = t !== 'Transfer';
  });

  document.getElementById('cashQuickForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var type = fd.get('type');
    var amount = parseFloat(fd.get('amount')) || 0;
    if (amount <= 0) { toast('Enter an amount greater than zero.'); return; }
    var cashId = fd.get('cashAccountId');
    var record;
    if (type === 'Transfer') {
      var fromBankId = fd.get('fromBankId');
      if (!fromBankId) { toast('Add a Bank account first to withdraw cash from.'); return; }
      record = {
        id: uid('tx'),
        date: fd.get('date'),
        type: 'Transfer',
        accountId: null,
        fromAccountId: fromBankId,
        toAccountId: cashId,
        category: '',
        mode: 'Cash',
        desc: fd.get('desc') || 'Cash withdrawal from Bank',
        amount: amount
      };
    } else {
      record = {
        id: uid('tx'),
        date: fd.get('date'),
        type: type,
        accountId: cashId,
        fromAccountId: null,
        toAccountId: null,
        category: type === 'Expense' ? fd.get('category') : '',
        mode: 'Cash',
        desc: fd.get('desc'),
        amount: amount
      };
    }
    State.commitUserData(u, Object.assign({}, ud, { transactions: ud.transactions.concat([record]) }), {
      successMsg: type === 'Transfer' ? 'Cash withdrawal transferred from Bank to Cash Account.' : 'Cash transaction logged.'
    });
  });

  document.getElementById('cashMonthFilter').addEventListener('change', function (e) {
    ui.cashMonthFilter = e.target.value;
    render();
  });

  bindTxItemActions(document.getElementById('cashListCard'), u, ud, ui, render);
}
