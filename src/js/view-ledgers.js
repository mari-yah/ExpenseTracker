import { escapeHtml, inr, uid, todayStr, monthLabel, formatDate, icon } from './utils.js';
import { MODES } from './constants.js';
import { toast, confirmModal, renderMultiFilterGroup, bindMultiFilterGroups } from './ui.js';
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

export function buildCategoryLedgerRows(ud, selectedCategories, dateFrom, dateTo, selectedAccounts, selectedTypes, selectedModes) {
  var selCats = State.normalizeMultiFilter(selectedCategories);
  var selAccts = State.normalizeMultiFilter(selectedAccounts);
  var selTypes = State.normalizeMultiFilter(selectedTypes);
  var selModes = State.normalizeMultiFilter(selectedModes);

  var txs = ud.transactions.filter(function (t) {
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    if (!State.matchesMultiValue(t.category, selCats)) return false;
    if (!State.matchesMultiAccount(t, selAccts, ud.accounts)) return false;
    if (!State.matchesMultiValue(t.mode, selModes)) return false;
    if (selTypes.length > 0) {
      return State.matchesMultiValue(t.type, selTypes);
    }
    return t.type === 'Expense' || t.type === 'Income';
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  var creditRows = [];
  var debitRows = [];

  txs.forEach(function (t) {
    var effId = State.effectiveTxAccountId(t, ud.accounts);
    var acctName = (t.type === 'Transfer' || t.type === 'CC Bill Payment')
      ? (State.accountName(ud.accounts, t.fromAccountId) + ' → ' + State.accountName(ud.accounts, t.toAccountId))
      : State.accountName(ud.accounts, effId);
    var subParts = [acctName];
    if (t.mode) subParts.push(t.mode);
    if ((selCats.length === 0 || selCats.length > 1) && t.category) subParts.push(t.category);

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

export function buildAccountLedgerRows(ud, selectedAccountIds, dateFrom, dateTo, selectedCategories, selectedTypes, selectedModes) {
  var selAccts = State.normalizeMultiFilter(selectedAccountIds);
  var selCats = State.normalizeMultiFilter(selectedCategories);
  var selTypes = State.normalizeMultiFilter(selectedTypes);
  var selModes = State.normalizeMultiFilter(selectedModes);

  var targetAccounts = selAccts.length === 0
    ? ud.accounts
    : ud.accounts.filter(function (a) { return selAccts.indexOf(a.id) >= 0; });

  if (targetAccounts.length === 0) return { creditRows: [], debitRows: [], acc: null, accounts: [] };

  var targetIdMap = {};
  targetAccounts.forEach(function (a) { targetIdMap[a.id] = a; });
  var showAcctBadge = targetAccounts.length > 1;

  var txs = ud.transactions.filter(function (t) {
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    if (!State.matchesMultiValue(t.category, selCats)) return false;
    if (!State.matchesMultiValue(t.type, selTypes)) return false;
    if (!State.matchesMultiValue(t.mode, selModes)) return false;
    var effId = State.effectiveTxAccountId(t, ud.accounts);
    return Boolean(targetIdMap[effId] || targetIdMap[t.fromAccountId] || targetIdMap[t.toAccountId]);
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  var creditRows = [];
  var debitRows = [];

  txs.forEach(function (t) {
    var effId = State.effectiveTxAccountId(t, ud.accounts);
    var amt = Number(t.amount || 0);

    targetAccounts.forEach(function (acc) {
      var accountId = acc.id;
      var accType = State.getAccountType(acc);
      var prefix = showAcctBadge ? (acc.name + ' • ') : '';

      if (accType === 'Credit Card') {
        if ((t.type === 'CC Bill Payment' || t.type === 'Transfer') && t.toAccountId === accountId) {
          creditRows.push({
            id: t.id,
            date: t.date,
            desc: t.desc || 'CC Bill Payment',
            fallbackDesc: 'CC Bill Payment',
            sub: prefix + 'Paid from ' + State.accountName(ud.accounts, t.fromAccountId) + (t.mode ? ' • ' + t.mode : ''),
            amount: amt
          });
        } else if (t.type === 'Expense' && effId === accountId) {
          debitRows.push({
            id: t.id,
            date: t.date,
            desc: t.desc || (t.category || 'CC Expense'),
            fallbackDesc: 'CC Expense',
            sub: prefix + (t.category ? t.category + ' • ' : '') + (t.mode || 'Credit Card'),
            amount: amt
          });
        }
      } else {
        if (t.type === 'Income' && effId === accountId) {
          creditRows.push({
            id: t.id,
            date: t.date,
            desc: t.desc || 'Income',
            fallbackDesc: 'Income',
            sub: prefix + (t.category ? t.category + ' • ' : '') + (t.mode || ''),
            amount: amt
          });
        } else if ((t.type === 'Transfer' || t.type === 'CC Bill Payment') && t.toAccountId === accountId) {
          creditRows.push({
            id: t.id,
            date: t.date,
            desc: t.desc || 'Transfer In',
            fallbackDesc: 'Transfer In',
            sub: prefix + 'From ' + State.accountName(ud.accounts, t.fromAccountId) + (t.mode ? ' • ' + t.mode : ''),
            amount: amt
          });
        } else if (t.type === 'Expense' && effId === accountId) {
          debitRows.push({
            id: t.id,
            date: t.date,
            desc: t.desc || (t.category || 'Expense'),
            fallbackDesc: 'Expense',
            sub: prefix + (t.category ? t.category + ' • ' : '') + (t.mode || ''),
            amount: amt
          });
        } else if ((t.type === 'Transfer' || t.type === 'CC Bill Payment') && t.fromAccountId === accountId) {
          debitRows.push({
            id: t.id,
            date: t.date,
            desc: t.desc || t.type,
            fallbackDesc: t.type,
            sub: prefix + 'To ' + State.accountName(ud.accounts, t.toAccountId) + (t.mode ? ' • ' + t.mode : ''),
            amount: amt
          });
        }
      }
    });
  });

  return {
    creditRows: creditRows,
    debitRows: debitRows,
    acc: targetAccounts.length === 1 ? targetAccounts[0] : null,
    accounts: targetAccounts
  };
}

/**
 * Dedicated "Ledgers" View (Category Ledger & Account Ledger with Dynamic Multi-Select Filters + Credit Left / Debit Right)
 */
export function renderGeneralLedger(main, ui, render, u) {
  var ud = State.currentUserData();

  ui.ledgerViewType = ui.ledgerViewType || 'category'; // 'category' | 'account'
  ui.ledgerCategories = State.normalizeMultiFilter(ui.ledgerCategories);
  ui.ledgerAccounts = State.normalizeMultiFilter(ui.ledgerAccounts);
  ui.ledgerTypes = State.normalizeMultiFilter(ui.ledgerTypes);
  ui.ledgerModes = State.normalizeMultiFilter(ui.ledgerModes);
  ui.ledgerDateFrom = ui.ledgerDateFrom || '';
  ui.ledgerDateTo = ui.ledgerDateTo || '';

  var dynOpts = State.getDynamicFilterOptions(ud, MODES);
  var hasActiveFilters = Boolean(
    ui.ledgerDateFrom ||
    ui.ledgerDateTo ||
    ui.ledgerCategories.length > 0 ||
    ui.ledgerAccounts.length > 0 ||
    ui.ledgerTypes.length > 0 ||
    ui.ledgerModes.length > 0
  );

  var ledgerContentHtml = '';
  if (ui.ledgerViewType === 'category') {
    var catRes = buildCategoryLedgerRows(
      ud,
      ui.ledgerCategories,
      ui.ledgerDateFrom,
      ui.ledgerDateTo,
      ui.ledgerAccounts,
      ui.ledgerTypes,
      ui.ledgerModes
    );
    var catTitle = (ui.ledgerCategories.length === 0 ? 'All Categories' : ui.ledgerCategories.join(', ')) + ' — Category Ledger';
    ledgerContentHtml = renderTAccountHtml(
      catTitle,
      'CREDIT (CR) — INCOMES / REFUNDS',
      'DEBIT (DR) — PAYMENTS / EXPENSES',
      catRes.creditRows,
      catRes.debitRows
    );
  } else {
    var accRes = buildAccountLedgerRows(
      ud,
      ui.ledgerAccounts,
      ui.ledgerDateFrom,
      ui.ledgerDateTo,
      ui.ledgerCategories,
      ui.ledgerTypes,
      ui.ledgerModes
    );
    var targetAccs = accRes.accounts || [];
    var singleAcc = accRes.acc;
    var accType = singleAcc ? State.getAccountType(singleAcc) : 'Bank';
    var totalOpening = targetAccs.reduce(function (s, a) { return s + Number(a.opening || 0); }, 0);
    var totalBal = targetAccs.reduce(function (s, a) { return s + State.accountBalance(a, ud.transactions, ud.accounts); }, 0);
    var acctTitleLabel = targetAccs.length === ud.accounts.length
      ? 'All Accounts'
      : targetAccs.map(function (a) { return a.name; }).join(', ');

    var summaryCards = targetAccs.length > 0 ? (
      '<div class="stat-row" style="margin-bottom:18px;">' +
        '<div class="stat-card"><div class="lbl">' + (singleAcc && accType === 'Credit Card' ? 'Opening CC Due' : 'Opening Balance') + '</div><div class="val num">' + inr(totalOpening) + '</div></div>' +
        '<div class="stat-card income"><div class="lbl">' + (singleAcc && accType === 'Credit Card' ? 'Period Bills Paid (Cr)' : 'Period Credits / In (Cr)') + '</div><div class="val num">' + inr(accRes.creditRows.reduce(function (s, r) { return s + r.amount; }, 0)) + '</div></div>' +
        '<div class="stat-card expense"><div class="lbl">' + (singleAcc && accType === 'Credit Card' ? 'Period CC Spends (Dr)' : 'Period Debits / Out (Dr)') + '</div><div class="val num">' + inr(accRes.debitRows.reduce(function (s, r) { return s + r.amount; }, 0)) + '</div></div>' +
        '<div class="stat-card"><div class="lbl">' + (singleAcc && accType === 'Credit Card' ? 'Current Unpaid CC Due' : 'Current Balance') + '</div><div class="val num">' + inr(totalBal) + '</div></div>' +
      '</div>'
    ) : '';
    ledgerContentHtml = renderTAccountHtml(
      (acctTitleLabel || 'Account') + ' — Account Ledger',
      singleAcc && accType === 'Credit Card' ? 'CREDIT (CR) — CC BILL PAYMENTS' : 'CREDIT (CR) — DEPOSITS / INFLOWS',
      singleAcc && accType === 'Credit Card' ? 'DEBIT (DR) — CC SPENDS / CHARGES' : 'DEBIT (DR) — PAYMENTS / WITHDRAWALS',
      accRes.creditRows,
      accRes.debitRows,
      summaryCards
    );
  }

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head">' +
      '<div><h1>Ledgers</h1><div class="sub">Classic T-Account ledger view — select multiple Categories, Accounts, Types, and Modes dynamically.</div></div>' +
      '<div class="ledger-mode-switch">' +
        '<button type="button" class="btn ' + (ui.ledgerViewType === 'category' ? '' : 'secondary') + '" id="switchCatLedger">Category Ledger</button>' +
        '<button type="button" class="btn ' + (ui.ledgerViewType === 'account' ? '' : 'secondary') + '" id="switchAcctLedger">Account Ledger</button>' +
      '</div>' +
    '</div>' +

    '<div class="card filter-panel" style="margin-bottom:20px; padding:16px 20px;">' +
      '<div class="filter-row" style="margin-bottom:14px;">' +
        '<div class="field"><span class="field-label">From Date</span><input type="date" id="ledgerDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.ledgerDateFrom) + '"></div>' +
        '<div class="field"><span class="field-label">To Date</span><input type="date" id="ledgerDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.ledgerDateTo) + '"></div>' +
        (hasActiveFilters
          ? '<div class="field" style="align-self:flex-end;"><button type="button" class="btn secondary sm" id="clearLedgerFilters">Clear all filters</button></div>'
          : '') +
      '</div>' +
      '<div class="multi-filter-stack" id="ledgerMultiFilters">' +
        (ui.ledgerViewType === 'category'
          ? renderMultiFilterGroup('category', 'Categories (select multiple)', dynOpts.categories, ui.ledgerCategories) +
            renderMultiFilterGroup('account', 'Accounts (select multiple)', dynOpts.accounts, ui.ledgerAccounts)
          : renderMultiFilterGroup('account', 'Accounts (select multiple)', dynOpts.accounts, ui.ledgerAccounts) +
            renderMultiFilterGroup('category', 'Categories (select multiple)', dynOpts.categories, ui.ledgerCategories)) +
        renderMultiFilterGroup('type', 'Types (select multiple)', dynOpts.types, ui.ledgerTypes) +
        renderMultiFilterGroup('mode', 'Modes (select multiple)', dynOpts.modes, ui.ledgerModes) +
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

  bindMultiFilterGroups(document.getElementById('ledgerMultiFilters'), function (group, val) {
    if (group === 'category') ui.ledgerCategories = State.toggleMultiFilter(ui.ledgerCategories, val);
    else if (group === 'account') ui.ledgerAccounts = State.toggleMultiFilter(ui.ledgerAccounts, val);
    else if (group === 'type') ui.ledgerTypes = State.toggleMultiFilter(ui.ledgerTypes, val);
    else if (group === 'mode') ui.ledgerModes = State.toggleMultiFilter(ui.ledgerModes, val);
    render();
  });

  document.getElementById('ledgerDateFrom').addEventListener('change', function (e) { ui.ledgerDateFrom = e.target.value; render(); });
  document.getElementById('ledgerDateTo').addEventListener('change', function (e) { ui.ledgerDateTo = e.target.value; render(); });

  var clearBtn = document.getElementById('clearLedgerFilters');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      ui.ledgerDateFrom = '';
      ui.ledgerDateTo = '';
      ui.ledgerCategories = [];
      ui.ledgerAccounts = [];
      ui.ledgerTypes = [];
      ui.ledgerModes = [];
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
