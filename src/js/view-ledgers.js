import { escapeHtml, inr, uid, todayStr, monthLabel, formatDate, icon } from './utils.js';
import { toast, confirmModal } from './ui.js';
import * as State from './state.js';

/**
 * Renders the two-sided T-Account Ledger (Credit / Inflows on Left, Debit / Outflows on Right)
 * Used across the Ledgers tab, Categories tab (Category Ledger), Accounts tab (Account Ledger),
 * Credit Card Ledger, and Cash Ledger.
 */
export function renderTAccountHtml(title, creditTitle, debitTitle, creditRows, debitRows, extraSummaryHtml) {
  var totalCredit = creditRows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
  var totalDebit = debitRows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);

  function sideRowsHtml(rows, sideClass) {
    if (rows.length === 0) {
      return '<div class="empty-note" style="padding:18px 8px;">No ' + (sideClass === 'credit' ? 'credit' : 'debit') + ' entries in this period.</div>';
    }
    return '<div class="t-ledger-rows">' + rows.map(function (r) {
      return '<div class="t-ledger-row" data-id="' + r.id + '">' +
        '<div class="t-ledger-row-main">' +
          '<span class="t-ledger-date">' + formatDate(r.date) + '</span>' +
          '<div class="t-ledger-info">' +
            '<div class="t-ledger-desc">' + escapeHtml(r.desc || r.fallbackDesc) + '</div>' +
            '<div class="t-ledger-sub">' + escapeHtml(r.sub) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="t-ledger-row-right">' +
          '<span class="t-ledger-amt num ' + sideClass + '">' + inr(r.amount) + '</span>' +
          (r.id ? '<div class="tx-icon-actions"><button type="button" class="icon-btn editTx" title="Edit">' + icon('edit') + '</button><button type="button" class="icon-btn del delTx" title="Delete">' + icon('trash') + '</button></div>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  return (
    (extraSummaryHtml || '') +
    '<div class="t-ledger-card card">' +
      '<div class="t-ledger-header">' +
        '<h3>' + escapeHtml(title) + '</h3>' +
        '<div class="t-ledger-totals">' +
          '<span class="t-tot-pill credit">Total Credit: <strong>' + inr(totalCredit) + '</strong></span>' +
          '<span class="t-tot-pill debit">Total Debit: <strong>' + inr(totalDebit) + '</strong></span>' +
          '<span class="t-tot-pill net">Net: <strong>' + inr(totalCredit - totalDebit) + '</strong></span>' +
        '</div>' +
      '</div>' +
      '<div class="t-ledger-grid">' +
        /* LEFT COLUMN: CREDIT (INFLOWS / RECEIPTS) */
        '<div class="t-ledger-col credit-col">' +
          '<div class="t-col-head credit">' +
            '<span>' + escapeHtml(creditTitle || 'CREDIT (CR) — INFLOWS / INCOME') + '</span>' +
            '<span class="num">' + inr(totalCredit) + '</span>' +
          '</div>' +
          sideRowsHtml(creditRows, 'credit') +
        '</div>' +
        /* RIGHT COLUMN: DEBIT (OUTFLOWS / PAYMENTS) */
        '<div class="t-ledger-col debit-col">' +
          '<div class="t-col-head debit">' +
            '<span>' + escapeHtml(debitTitle || 'DEBIT (DR) — PAYMENTS / EXPENSES') + '</span>' +
            '<span class="num">' + inr(totalDebit) + '</span>' +
          '</div>' +
          sideRowsHtml(debitRows, 'debit') +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

export function bindLedgerActions(container, u, ud, ui, render) {
  if (!container) return;
  container.querySelectorAll('.editTx').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ui.editingTxId = btn.closest('[data-id]').dataset.id;
      ui.tab = 'transactions';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
  container.querySelectorAll('.delTx').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('[data-id]').dataset.id;
      confirmModal({
        title: 'Delete this transaction?',
        body: 'This entry will be permanently removed and balances will be recalculated.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: function () {
          var newTxs = ud.transactions.filter(function (t) { return t.id !== id; });
          State.commitUserData(u, Object.assign({}, ud, { transactions: newTxs }), { successMsg: 'Transaction deleted.' });
        }
      });
    });
  });
}

export function buildCategoryLedgerRows(ud, categoryName, dateFrom, dateTo) {
  var txs = ud.transactions.filter(function (t) {
    if (categoryName !== 'all' && t.category !== categoryName) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return t.type === 'Expense' || t.type === 'Income';
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  var creditRows = [];
  var debitRows = [];

  txs.forEach(function (t) {
    var effId = State.effectiveTxAccountId(t, ud.accounts);
    var acctName = State.accountName(ud.accounts, effId);
    var subParts = [acctName];
    if (t.mode) subParts.push(t.mode);
    if (categoryName === 'all' && t.category) subParts.push(t.category);

    var item = {
      id: t.id,
      date: t.date,
      desc: t.desc || (t.category || t.type),
      fallbackDesc: t.type,
      sub: subParts.join(' • '),
      amount: Number(t.amount || 0)
    };
    if (t.type === 'Income') creditRows.push(item);
    else debitRows.push(item);
  });

  return { creditRows: creditRows, debitRows: debitRows };
}

export function buildAccountLedgerRows(ud, accountId, dateFrom, dateTo) {
  var acc = ud.accounts.find(function (a) { return a.id === accountId; });
  if (!acc) return { creditRows: [], debitRows: [], acc: null };
  var accType = State.getAccountType(acc);

  var txs = ud.transactions.filter(function (t) {
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    var effId = State.effectiveTxAccountId(t, ud.accounts);
    return effId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId;
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  var creditRows = [];
  var debitRows = [];

  txs.forEach(function (t) {
    var effId = State.effectiveTxAccountId(t, ud.accounts);
    var amt = Number(t.amount || 0);

    if (accType === 'Credit Card') {
      // For Credit Card: Left (Credit) = Bill Payments reducing due; Right (Debit) = CC Spends / Charges
      if ((t.type === 'CC Bill Payment' || t.type === 'Transfer') && t.toAccountId === accountId) {
        creditRows.push({
          id: t.id,
          date: t.date,
          desc: t.desc || 'CC Bill Payment',
          fallbackDesc: 'CC Bill Payment',
          sub: 'Paid from ' + State.accountName(ud.accounts, t.fromAccountId) + (t.mode ? ' • ' + t.mode : ''),
          amount: amt
        });
      } else if (t.type === 'Expense' && effId === accountId) {
        debitRows.push({
          id: t.id,
          date: t.date,
          desc: t.desc || (t.category || 'CC Expense'),
          fallbackDesc: 'CC Expense',
          sub: (t.category ? t.category + ' • ' : '') + (t.mode || 'Credit Card'),
          amount: amt
        });
      }
    } else {
      // For Bank or Cash Account: Left (Credit) = Money In (Income / Transfer In); Right (Debit) = Money Out (Expense / Transfer Out / CC Bill Payment)
      if (t.type === 'Income' && effId === accountId) {
        creditRows.push({
          id: t.id,
          date: t.date,
          desc: t.desc || 'Income',
          fallbackDesc: 'Income',
          sub: (t.category ? t.category + ' • ' : '') + (t.mode || ''),
          amount: amt
        });
      } else if ((t.type === 'Transfer' || t.type === 'CC Bill Payment') && t.toAccountId === accountId) {
        creditRows.push({
          id: t.id,
          date: t.date,
          desc: t.desc || 'Transfer In',
          fallbackDesc: 'Transfer In',
          sub: 'From ' + State.accountName(ud.accounts, t.fromAccountId) + (t.mode ? ' • ' + t.mode : ''),
          amount: amt
        });
      } else if (t.type === 'Expense' && effId === accountId) {
        debitRows.push({
          id: t.id,
          date: t.date,
          desc: t.desc || (t.category || 'Expense'),
          fallbackDesc: 'Expense',
          sub: (t.category ? t.category + ' • ' : '') + (t.mode || ''),
          amount: amt
        });
      } else if ((t.type === 'Transfer' || t.type === 'CC Bill Payment') && t.fromAccountId === accountId) {
        debitRows.push({
          id: t.id,
          date: t.date,
          desc: t.desc || t.type,
          fallbackDesc: t.type,
          sub: 'To ' + State.accountName(ud.accounts, t.toAccountId) + (t.mode ? ' • ' + t.mode : ''),
          amount: amt
        });
      }
    }
  });

  return { creditRows: creditRows, debitRows: debitRows, acc: acc };
}

/**
 * Dedicated "Ledgers" View (Category Ledger & Account Ledger with Period Selector + Credit Left / Debit Right)
 */
export function renderGeneralLedger(main, ui, render, u) {
  var ud = State.currentUserData();

  ui.ledgerViewType = ui.ledgerViewType || 'category'; // 'category' | 'account'
  ui.ledgerCategory = ui.ledgerCategory || (ud.categories[0] ? ud.categories[0].name : 'all');
  ui.ledgerAccountId = ui.ledgerAccountId || (ud.accounts[0] ? ud.accounts[0].id : '');
  ui.ledgerDateFrom = ui.ledgerDateFrom || '';
  ui.ledgerDateTo = ui.ledgerDateTo || '';

  var catOpts = '<option value="all" ' + (ui.ledgerCategory === 'all' ? 'selected' : '') + '>All Categories</option>' +
    ud.categories.map(function (c) {
      return '<option value="' + escapeHtml(c.name) + '" ' + (c.name === ui.ledgerCategory ? 'selected' : '') + '>' + escapeHtml(c.name) + '</option>';
    }).join('');

  var acctOpts = ud.accounts.map(function (a) {
    return '<option value="' + a.id + '" ' + (a.id === ui.ledgerAccountId ? 'selected' : '') + '>' + escapeHtml(a.name) + ' (' + State.getAccountType(a) + ')</option>';
  }).join('');

  var ledgerContentHtml = '';
  if (ui.ledgerViewType === 'category') {
    var catRes = buildCategoryLedgerRows(ud, ui.ledgerCategory, ui.ledgerDateFrom, ui.ledgerDateTo);
    var catTitle = (ui.ledgerCategory === 'all' ? 'All Categories' : ui.ledgerCategory) + ' — Category Ledger';
    ledgerContentHtml = renderTAccountHtml(
      catTitle,
      'CREDIT (CR) — INCOMES / REFUNDS',
      'DEBIT (DR) — PAYMENTS / EXPENSES',
      catRes.creditRows,
      catRes.debitRows
    );
  } else {
    var accRes = buildAccountLedgerRows(ud, ui.ledgerAccountId, ui.ledgerDateFrom, ui.ledgerDateTo);
    var acc = accRes.acc;
    var accType = acc ? State.getAccountType(acc) : 'Bank';
    var bal = acc ? State.accountBalance(acc, ud.transactions, ud.accounts) : 0;
    var summaryCards = acc ? (
      '<div class="stat-row" style="margin-bottom:18px;">' +
        '<div class="stat-card"><div class="lbl">' + (accType === 'Credit Card' ? 'Opening CC Due' : 'Opening Balance') + '</div><div class="val num">' + inr(acc.opening) + '</div></div>' +
        '<div class="stat-card income"><div class="lbl">' + (accType === 'Credit Card' ? 'Period Bills Paid (Cr)' : 'Period Credits / In (Cr)') + '</div><div class="val num">' + inr(accRes.creditRows.reduce(function (s, r) { return s + r.amount; }, 0)) + '</div></div>' +
        '<div class="stat-card expense"><div class="lbl">' + (accType === 'Credit Card' ? 'Period CC Spends (Dr)' : 'Period Debits / Out (Dr)') + '</div><div class="val num">' + inr(accRes.debitRows.reduce(function (s, r) { return s + r.amount; }, 0)) + '</div></div>' +
        '<div class="stat-card"><div class="lbl">' + (accType === 'Credit Card' ? 'Current Unpaid CC Due' : 'Current Account Balance') + '</div><div class="val num">' + inr(bal) + '</div></div>' +
      '</div>'
    ) : '';
    ledgerContentHtml = renderTAccountHtml(
      (acc ? acc.name : 'Account') + ' — Account Ledger',
      accType === 'Credit Card' ? 'CREDIT (CR) — CC BILL PAYMENTS' : 'CREDIT (CR) — DEPOSITS / INFLOWS',
      accType === 'Credit Card' ? 'DEBIT (DR) — CC SPENDS / CHARGES' : 'DEBIT (DR) — PAYMENTS / WITHDRAWALS',
      accRes.creditRows,
      accRes.debitRows,
      summaryCards
    );
  }

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head">' +
      '<div><h1>Ledgers</h1><div class="sub">Classic T-Account ledger view — Credit on the left, Debit on the right, with custom date filters.</div></div>' +
      '<div class="ledger-mode-switch">' +
        '<button type="button" class="btn ' + (ui.ledgerViewType === 'category' ? '' : 'secondary') + '" id="switchCatLedger">Category Ledger</button>' +
        '<button type="button" class="btn ' + (ui.ledgerViewType === 'account' ? '' : 'secondary') + '" id="switchAcctLedger">Account Ledger</button>' +
      '</div>' +
    '</div>' +

    '<div class="card filter-panel" style="margin-bottom:20px; padding:16px 20px;">' +
      '<div class="filter-row" style="margin-bottom:0;">' +
        (ui.ledgerViewType === 'category'
          ? '<div class="field"><span class="field-label">Select Category</span><select id="ledgerCatSelect">' + catOpts + '</select></div>'
          : '<div class="field"><span class="field-label">Select Account</span><select id="ledgerAcctSelect">' + acctOpts + '</select></div>') +
        '<div class="field"><span class="field-label">From Date</span><input type="date" id="ledgerDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.ledgerDateFrom) + '"></div>' +
        '<div class="field"><span class="field-label">To Date</span><input type="date" id="ledgerDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.ledgerDateTo) + '"></div>' +
        ((ui.ledgerDateFrom || ui.ledgerDateTo)
          ? '<div class="field" style="align-self:flex-end;"><button type="button" class="btn secondary sm" id="clearLedgerDates">Reset Dates</button></div>'
          : '') +
      '</div>' +
    '</div>' +

    '<div id="tLedgerContainer">' + ledgerContentHtml + '</div>'
  );

  document.getElementById('switchCatLedger').addEventListener('click', function () {
    ui.ledgerViewType = 'category';
    render();
  });
  document.getElementById('switchAcctLedger').addEventListener('click', function () {
    ui.ledgerViewType = 'account';
    render();
  });

  var catSel = document.getElementById('ledgerCatSelect');
  if (catSel) catSel.addEventListener('change', function (e) { ui.ledgerCategory = e.target.value; render(); });

  var acctSel = document.getElementById('ledgerAcctSelect');
  if (acctSel) acctSel.addEventListener('change', function (e) { ui.ledgerAccountId = e.target.value; render(); });

  document.getElementById('ledgerDateFrom').addEventListener('change', function (e) { ui.ledgerDateFrom = e.target.value; render(); });
  document.getElementById('ledgerDateTo').addEventListener('change', function (e) { ui.ledgerDateTo = e.target.value; render(); });

  var clearBtn = document.getElementById('clearLedgerDates');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      ui.ledgerDateFrom = '';
      ui.ledgerDateTo = '';
      render();
    });
  }

  bindLedgerActions(document.getElementById('tLedgerContainer'), u, ud, ui, render);
}

export function renderCreditCardLedger(main, ui, render, u) {
  var ud = State.currentUserData();
  ui.ccDateFrom = ui.ccDateFrom || '';
  ui.ccDateTo = ui.ccDateTo || '';

  var ccAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Credit Card'; });
  var bankAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Bank'; });
  var catOpts = ud.categories.map(function (c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; }).join('');
  var ccOpts = ccAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');
  var bankOpts = bankAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');

  var ccAccId = ccAccounts[0] ? ccAccounts[0].id : '';
  var accRes = buildAccountLedgerRows(ud, ccAccId, ui.ccDateFrom, ui.ccDateTo);

  var totalCcSpent = accRes.debitRows.reduce(function (s, r) { return s + r.amount; }, 0);
  var totalCcPaid = accRes.creditRows.reduce(function (s, r) { return s + r.amount; }, 0);
  var totalOutstandingDue = ccAccounts.reduce(function (s, a) {
    return s + State.accountBalance(a, ud.transactions, ud.accounts);
  }, 0);

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Credit Card Ledger</h1><div class="sub">All Credit Card spends & bill payments — spends do not deduct from your Bank account.</div></div></div>' +

    '<div class="stat-row">' +
    '<div class="stat-card income"><div class="lbl">CC Bills Paid (Credit)</div><div class="val num">' + inr(totalCcPaid) + '</div></div>' +
    '<div class="stat-card expense"><div class="lbl">CC Spent (Debit)</div><div class="val num">' + inr(totalCcSpent) + '</div></div>' +
    '<div class="stat-card"><div class="lbl">Current Unpaid CC Due</div><div class="val num">' + inr(totalOutstandingDue) + '</div></div>' +
    '</div>' +

    '<div class="card" style="margin-bottom:22px;">' +
    '<h3 style="font-size:0.95rem; margin-bottom:14px;">Quick Log Credit Card Transaction</h3>' +
    '<form class="grid-form" id="ccQuickForm">' +
    '<div class="field"><span class="field-label">Date</span><input type="date" name="date" max="' + todayStr + '" required value="' + todayStr + '"></div>' +
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

    '<div class="card filter-panel" style="margin-bottom:16px; padding:14px 18px;">' +
    '<div class="filter-row" style="margin-bottom:0;">' +
    '<div class="field"><span class="field-label">From Date</span><input type="date" id="ccDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.ccDateFrom) + '"></div>' +
    '<div class="field"><span class="field-label">To Date</span><input type="date" id="ccDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.ccDateTo) + '"></div>' +
    ((ui.ccDateFrom || ui.ccDateTo)
      ? '<div class="field" style="align-self:flex-end;"><button type="button" class="btn secondary sm" id="clearCcDates">Reset Dates</button></div>'
      : '') +
    '</div>' +
    '</div>' +

    '<div id="ccListCard">' +
      renderTAccountHtml(
        'Credit Card Ledger',
        'CREDIT (CR) — BILL PAYMENTS',
        'DEBIT (DR) — CC SPENDS & CHARGES',
        accRes.creditRows,
        accRes.debitRows
      ) +
    '</div>'
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
    var date = fd.get('date');
    if (date > todayStr) { toast('Future dates are disabled.'); return; }
    var type = fd.get('type');
    var amount = parseFloat(fd.get('amount')) || 0;
    if (amount <= 0) { toast('Enter an amount greater than zero.'); return; }
    var ccId = fd.get('ccAccountId');
    var record;
    if (type === 'Expense') {
      record = {
        id: uid('tx'),
        date: date,
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
        date: date,
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

  document.getElementById('ccDateFrom').addEventListener('change', function (e) { ui.ccDateFrom = e.target.value; render(); });
  document.getElementById('ccDateTo').addEventListener('change', function (e) { ui.ccDateTo = e.target.value; render(); });
  var clearCc = document.getElementById('clearCcDates');
  if (clearCc) clearCc.addEventListener('click', function () { ui.ccDateFrom = ''; ui.ccDateTo = ''; render(); });

  bindLedgerActions(document.getElementById('ccListCard'), u, ud, ui, render);
}

export function renderCashLedger(main, ui, render, u) {
  var ud = State.currentUserData();
  ui.cashDateFrom = ui.cashDateFrom || '';
  ui.cashDateTo = ui.cashDateTo || '';

  var cashAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Cash'; });
  var bankAccounts = ud.accounts.filter(function (a) { return State.getAccountType(a) === 'Bank'; });
  var catOpts = ud.categories.map(function (c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; }).join('');
  var cashOpts = cashAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');
  var bankOpts = bankAccounts.map(function (a) { return '<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'; }).join('');

  var cashAccId = cashAccounts[0] ? cashAccounts[0].id : '';
  var accRes = buildAccountLedgerRows(ud, cashAccId, ui.cashDateFrom, ui.cashDateTo);

  var cashAdded = accRes.creditRows.reduce(function (s, r) { return s + r.amount; }, 0);
  var cashSpent = accRes.debitRows.reduce(function (s, r) { return s + r.amount; }, 0);
  var currentCashBalance = cashAccounts.reduce(function (s, a) {
    return s + State.accountBalance(a, ud.transactions, ud.accounts);
  }, 0);

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Cash Ledger</h1><div class="sub">Transfer cash from your Bank account and track all Cash expenses automatically.</div></div></div>' +

    '<div class="stat-row">' +
    '<div class="stat-card income"><div class="lbl">Cash Withdrawn / In (Credit)</div><div class="val num">' + inr(cashAdded) + '</div></div>' +
    '<div class="stat-card expense"><div class="lbl">Cash Spent (Debit)</div><div class="val num">' + inr(cashSpent) + '</div></div>' +
    '<div class="stat-card"><div class="lbl">Current Cash Account Balance</div><div class="val num">' + inr(currentCashBalance) + '</div></div>' +
    '</div>' +

    '<div class="card" style="margin-bottom:22px;">' +
    '<h3 style="font-size:0.95rem; margin-bottom:14px;">Quick Log Cash Transaction</h3>' +
    '<form class="grid-form" id="cashQuickForm">' +
    '<div class="field"><span class="field-label">Date</span><input type="date" name="date" max="' + todayStr + '" required value="' + todayStr + '"></div>' +
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

    '<div class="card filter-panel" style="margin-bottom:16px; padding:14px 18px;">' +
    '<div class="filter-row" style="margin-bottom:0;">' +
    '<div class="field"><span class="field-label">From Date</span><input type="date" id="cashDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.cashDateFrom) + '"></div>' +
    '<div class="field"><span class="field-label">To Date</span><input type="date" id="cashDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.cashDateTo) + '"></div>' +
    ((ui.cashDateFrom || ui.cashDateTo)
      ? '<div class="field" style="align-self:flex-end;"><button type="button" class="btn secondary sm" id="clearCashDates">Reset Dates</button></div>'
      : '') +
    '</div>' +
    '</div>' +

    '<div id="cashListCard">' +
      renderTAccountHtml(
        'Cash Account Ledger',
        'CREDIT (CR) — CASH IN / WITHDRAWALS',
        'DEBIT (DR) — CASH PAYMENTS',
        accRes.creditRows,
        accRes.debitRows
      ) +
    '</div>'
  );

  var cashActionType = document.getElementById('cashActionType');
  cashActionType.addEventListener('change', function () {
    var t = cashActionType.value;
    document.getElementById('cashCatField').hidden = t === 'Transfer';
    document.getElementById('cashBankField').hidden = t !== 'Transfer';
  });

  document.getElementById('cashQuickForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var date = fd.get('date');
    if (date > todayStr) { toast('Future dates are disabled.'); return; }
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
        date: date,
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
        date: date,
        type: type,
        accountId: cashId,
        fromAccountId: null,
        toAccountId: null,
        category: fd.get('category') || '',
        mode: 'Cash',
        desc: fd.get('desc'),
        amount: amount
      };
    }
    State.commitUserData(u, Object.assign({}, ud, { transactions: ud.transactions.concat([record]) }), {
      successMsg: type === 'Transfer' ? 'Cash withdrawal transferred from Bank to Cash Account.' : 'Cash transaction logged.'
    });
  });

  document.getElementById('cashDateFrom').addEventListener('change', function (e) { ui.cashDateFrom = e.target.value; render(); });
  document.getElementById('cashDateTo').addEventListener('change', function (e) { ui.cashDateTo = e.target.value; render(); });
  var clearCash = document.getElementById('clearCashDates');
  if (clearCash) clearCash.addEventListener('click', function () { ui.cashDateFrom = ''; ui.cashDateTo = ''; render(); });

  bindLedgerActions(document.getElementById('cashListCard'), u, ud, ui, render);
}
