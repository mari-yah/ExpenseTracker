import { escapeHtml, inr, uid, todayStr, formatDate, icon, pad, today } from './utils.js';
import { MODES } from './constants.js';
import { toast, confirmModal, renderMultiFilterGroup, bindMultiFilterGroups } from './ui.js';
import * as State from './state.js';

export function renderTransactions(main, ui, render, u) {
  var ud = State.currentUserData();
  var editingTx = ui.editingTxId ? ud.transactions.find(function (t) { return t.id === ui.editingTxId; }) : null;

  var defaultStart = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-01';
  if (ui.txDateFrom === undefined) ui.txDateFrom = defaultStart;
  if (ui.txDateTo === undefined) ui.txDateTo = todayStr;

  ui.txAccounts = State.normalizeMultiFilter(ui.txAccounts);
  ui.txCategories = State.normalizeMultiFilter(ui.txCategories);
  ui.txTypes = State.normalizeMultiFilter(ui.txTypes);
  ui.txModes = State.normalizeMultiFilter(ui.txModes);

  var dynOpts = State.getDynamicFilterOptions(ud, MODES);
  var hasActiveMulti = Boolean(
    ui.txAccounts.length > 0 ||
    ui.txCategories.length > 0 ||
    ui.txTypes.length > 0 ||
    ui.txModes.length > 0
  );

  function acctOpts(selected, filterFn) {
    var list = filterFn ? ud.accounts.filter(filterFn) : ud.accounts;
    if (list.length === 0) list = ud.accounts;
    return list.map(function (a) {
      return '<option value="' + a.id + '" ' + (a.id === selected ? 'selected' : '') + '>' + escapeHtml(a.name) + '</option>';
    }).join('');
  }

  function buildCatOptsForDate(dateVal, selectedCat) {
    var mKey = (dateVal || todayStr).slice(0, 7);
    var activeCats = State.categoriesForMonth(ud.categories, mKey);
    var html = activeCats.map(function (c) {
      var sel = selectedCat && (selectedCat === c.name) ? 'selected' : '';
      return '<option value="' + escapeHtml(c.name) + '" ' + sel + '>' + escapeHtml(c.name) + '</option>';
    }).join('');
    if (selectedCat && !activeCats.some(function (c) { return c.name === selectedCat; })) {
      html = '<option value="' + escapeHtml(selectedCat) + '" selected>' + escapeHtml(selectedCat) + '</option>' + html;
    }
    return html;
  }

  var initialDate = editingTx ? editingTx.date : todayStr;
  var catOpts = buildCatOptsForDate(initialDate, editingTx ? editingTx.category : null);

  var modeOpts = MODES.map(function (m) {
    var sel = editingTx && editingTx.mode === m ? 'selected' : '';
    return '<option value="' + m + '" ' + sel + '>' + m + '</option>';
  }).join('');

  var noAccounts = ud.accounts.length === 0;
  var cashAcc = State.findCashAccount(ud.accounts);
  var ccAcc = State.findCreditCardAccount(ud.accounts);

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Transactions</h1><div class="sub">Log income, expenses, cash withdrawals, and credit card transactions.</div></div></div>' +
    '<div class="card" style="margin-bottom:22px;">' +
    (noAccounts ? '<div class="empty-note">Add an account in the Accounts tab before logging transactions.</div>' :
      '<form class="grid-form" id="txForm">' +
      '<div class="field"><span class="field-label">Date</span><input type="date" name="date" id="txDateInput" max="' + todayStr + '" required value="' + initialDate + '"></div>' +
      '<div class="field"><span class="field-label">Type</span><select name="type" id="typeSelect">' +
      '<option value="Expense" ' + (editingTx && editingTx.type === 'Expense' ? 'selected' : '') + '>Expense</option>' +
      '<option value="Income" ' + (editingTx && editingTx.type === 'Income' ? 'selected' : '') + '>Income</option>' +
      '<option value="Transfer" ' + (editingTx && editingTx.type === 'Transfer' ? 'selected' : '') + '>Transfer / Cash Withdrawal</option>' +
      '<option value="CC Bill Payment" ' + (editingTx && editingTx.type === 'CC Bill Payment' ? 'selected' : '') + '>CC Bill Payment</option>' +
      '</select></div>' +
      '<div class="field" id="singleAcctField"><span class="field-label" id="singleAcctLabel">Account</span><select name="accountId" id="singleAcctSelect">' + acctOpts(editingTx ? editingTx.accountId : null) + '</select></div>' +
      '<div class="field" id="fromAcctField" hidden><span class="field-label" id="fromAcctLabel">From account</span><select name="fromAccountId" id="fromAcctSelect">' + acctOpts(editingTx ? editingTx.fromAccountId : null) + '</select></div>' +
      '<div class="field" id="toAcctField" hidden><span class="field-label" id="toAcctLabel">To account</span><select name="toAccountId" id="toAcctSelect">' + acctOpts(editingTx ? editingTx.toAccountId : (cashAcc ? cashAcc.id : null)) + '</select></div>' +
      '<div class="field" id="catField"><span class="field-label" id="catFieldLabel">Category</span><select name="category" id="catSelect">' + catOpts + '</select></div>' +
      '<div class="field"><span class="field-label">Mode</span><select name="mode" id="modeSelect">' + modeOpts + '</select></div>' +
      '<div class="field"><span class="field-label">Amount (₹)</span><input type="number" name="amount" min="0.01" step="0.01" required placeholder="0.00" value="' + (editingTx ? editingTx.amount : '') + '"></div>' +
      '<div class="field full"><span class="field-label">Description</span><input type="text" name="desc" placeholder="e.g. Groceries / ATM Cash Withdrawal" value="' + (editingTx ? escapeHtml(editingTx.desc) : '') + '"></div>' +
      '<div class="field full" style="display:flex; gap:10px;">' +
      '<button type="submit" class="btn">' + (editingTx ? 'Save changes' : 'Add transaction') + '</button>' +
      (editingTx ? '<button type="button" class="btn secondary" id="cancelEdit">Cancel</button>' : '') +
      '</div>' +
      '</form>') +
    '</div>' +

    '<div class="card filter-panel" id="txFilterPanel" style="margin-bottom:16px; padding:14px 18px;">' +
      '<div class="filter-row" id="txMultiFilters" style="margin-bottom:0;">' +
        '<div class="field"><span class="field-label">From Date</span><input type="date" id="txDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.txDateFrom) + '"></div>' +
        '<div class="field"><span class="field-label">To Date</span><input type="date" id="txDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.txDateTo) + '"></div>' +
        renderMultiFilterGroup('tx_account', 'Accounts', dynOpts.accounts, ui.txAccounts) +
        renderMultiFilterGroup('tx_category', 'Categories', dynOpts.categories, ui.txCategories) +
        renderMultiFilterGroup('tx_type', 'Types', dynOpts.types, ui.txTypes) +
        renderMultiFilterGroup('tx_mode', 'Modes', dynOpts.modes, ui.txModes) +
        '<div class="field" style="align-self:flex-end; display:flex; gap:8px; flex-direction:row; flex-wrap:wrap;">' +
          ((ui.txDateFrom !== defaultStart || ui.txDateTo !== todayStr || hasActiveMulti)
            ? '<button type="button" class="btn secondary sm" id="resetTxFilters">This Month</button>'
            : '') +
          ((ui.txDateFrom || ui.txDateTo)
            ? '<button type="button" class="btn secondary sm" id="allTimeTxFilters">All Dates</button>'
            : '') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card" id="txTableCard"></div>'
  );

  if (!noAccounts) {
    var typeSelect = document.getElementById('typeSelect');
    var modeSelect = document.getElementById('modeSelect');
    var singleAcctSelect = document.getElementById('singleAcctSelect');
    var toAcctSelect = document.getElementById('toAcctSelect');
    var catSelect = document.getElementById('catSelect');
    var txDateInput = document.getElementById('txDateInput');

    txDateInput.addEventListener('change', function () {
      var curCat = catSelect.value;
      catSelect.innerHTML = buildCatOptsForDate(txDateInput.value, curCat);
    });

    function toggleFields() {
      var type = typeSelect.value;
      var isDual = type === 'Transfer' || type === 'CC Bill Payment';
      document.getElementById('singleAcctField').hidden = isDual;
      document.getElementById('fromAcctField').hidden = !isDual;
      document.getElementById('toAcctField').hidden = !isDual;
      document.getElementById('catField').hidden = isDual;
      document.getElementById('singleAcctLabel').textContent = type === 'Income' ? 'Deposit into' : 'Pay from';
      document.getElementById('fromAcctLabel').textContent = type === 'CC Bill Payment' ? 'Pay from Bank' : 'From account';
      document.getElementById('toAcctLabel').textContent = type === 'CC Bill Payment' ? 'Credit Card' : 'To account';
      document.getElementById('catFieldLabel').textContent = 'Category';

      if (!editingTx) {
        if (type === 'CC Bill Payment' && ccAcc) {
          toAcctSelect.value = ccAcc.id;
        } else if (type === 'Transfer' && cashAcc) {
          toAcctSelect.value = cashAcc.id;
        }
      }
    }

    modeSelect.addEventListener('change', function () {
      var m = modeSelect.value;
      if (m === 'Cash' && cashAcc) {
        singleAcctSelect.value = cashAcc.id;
      } else if (m === 'Credit Card' && ccAcc) {
        singleAcctSelect.value = ccAcc.id;
      } else if (m !== 'Cash' && m !== 'Credit Card') {
        var curAcc = ud.accounts.find(function (a) { return a.id === singleAcctSelect.value; });
        if (curAcc && State.getAccountType(curAcc) !== 'Bank') {
          var firstBank = ud.accounts.find(function (a) { return State.getAccountType(a) === 'Bank'; });
          if (firstBank) singleAcctSelect.value = firstBank.id;
        }
      }
    });

    singleAcctSelect.addEventListener('change', function () {
      var curAcc = ud.accounts.find(function (a) { return a.id === singleAcctSelect.value; });
      if (!curAcc) return;
      var aType = State.getAccountType(curAcc);
      if (aType === 'Cash') modeSelect.value = 'Cash';
      else if (aType === 'Credit Card') modeSelect.value = 'Credit Card';
      else if (modeSelect.value === 'Cash' || modeSelect.value === 'Credit Card') modeSelect.value = 'UPI';
    });

    typeSelect.addEventListener('change', toggleFields);
    toggleFields();
    if (!editingTx && modeSelect.value === 'Cash' && cashAcc) {
      singleAcctSelect.value = cashAcc.id;
    }

    document.getElementById('txForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var date = fd.get('date');
      if (date > todayStr) {
        toast('Future dates are disabled. Please select today or an earlier date.');
        return;
      }
      var type = fd.get('type');
      var mode = fd.get('mode');
      var amount = parseFloat(fd.get('amount')) || 0;
      if (amount <= 0) { toast('Enter an amount greater than zero.'); return; }

      var isDual = type === 'Transfer' || type === 'CC Bill Payment';
      var chosenAccountId = !isDual ? fd.get('accountId') : null;

      if (!isDual) {
        if (mode === 'Cash' && cashAcc) chosenAccountId = cashAcc.id;
        else if (type === 'Expense' && mode === 'Credit Card' && ccAcc) chosenAccountId = ccAcc.id;
      }

      var record = {
        id: ui.editingTxId || uid('tx'),
        date: date,
        type: type,
        accountId: chosenAccountId,
        fromAccountId: isDual ? fd.get('fromAccountId') : null,
        toAccountId: isDual ? fd.get('toAccountId') : null,
        category: !isDual ? (fd.get('category') || '') : '',
        mode: mode,
        desc: fd.get('desc'),
        amount: amount
      };
      if (isDual && record.fromAccountId === record.toAccountId) {
        toast('Pick two different accounts for a transfer / bill payment.'); return;
      }
      var newTxs;
      if (ui.editingTxId) {
        newTxs = ud.transactions.map(function (t) { return t.id === ui.editingTxId ? record : t; });
      } else {
        newTxs = ud.transactions.concat([record]);
      }
      var editingId = ui.editingTxId;
      State.commitUserData(u, Object.assign({}, ud, { transactions: newTxs }), {
        successMsg: editingId ? 'Transaction updated.' : 'Transaction added.',
        onSuccess: function () { ui.editingTxId = null; }
      });
    });

    var cancelBtn = document.getElementById('cancelEdit');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { ui.editingTxId = null; render(); });
  }

  document.getElementById('txDateFrom').addEventListener('change', function (e) { ui.txDateFrom = e.target.value; render(); });
  document.getElementById('txDateTo').addEventListener('change', function (e) { ui.txDateTo = e.target.value; render(); });

  bindMultiFilterGroups(document.getElementById('txMultiFilters'), function (group, val) {
    if (group === 'tx_account') ui.txAccounts = State.toggleMultiFilter(ui.txAccounts, val);
    else if (group === 'tx_type') ui.txTypes = State.toggleMultiFilter(ui.txTypes, val);
    else if (group === 'tx_mode') ui.txModes = State.toggleMultiFilter(ui.txModes, val);
    else if (group === 'tx_category') ui.txCategories = State.toggleMultiFilter(ui.txCategories, val);
    render();
  });

  var resetBtn = document.getElementById('resetTxFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      ui.txDateFrom = defaultStart;
      ui.txDateTo = todayStr;
      ui.txAccounts = [];
      ui.txCategories = [];
      ui.txTypes = [];
      ui.txModes = [];
      render();
    });
  }

  var allTimeBtn = document.getElementById('allTimeTxFilters');
  if (allTimeBtn) {
    allTimeBtn.addEventListener('click', function () {
      ui.txDateFrom = '';
      ui.txDateTo = '';
      render();
    });
  }

  renderTxTable(u, ud, ui, render);
}

export function renderTxListHtml(list, ud) {
  if (list.length === 0) return '<div class="empty-note">No transactions for this view yet.</div>';

  return (
    /* Desktop view: compact 1-line cards with edit/trash icons */
    '<div class="tx-card-list desktop-only">' +
    list.map(function (t) {
      var isDual = t.type === 'Transfer' || t.type === 'CC Bill Payment';
      var effAcctId = State.effectiveTxAccountId(t, ud.accounts);
      var acctLabel = isDual
        ? escapeHtml(State.accountName(ud.accounts, t.fromAccountId)) + ' → ' + escapeHtml(State.accountName(ud.accounts, t.toAccountId))
        : escapeHtml(State.accountName(ud.accounts, effAcctId));
      var amtClass = t.type === 'Income' ? 'income' : (t.type === 'Expense' ? 'expense' : '');
      var sign = t.type === 'Income' ? '+' : (t.type === 'Expense' ? '−' : '');
      var badgeClass = t.type === 'Income' ? 'income' : (t.type === 'Expense' ? 'expense' : 'transfer');
      return '<div class="tx-d-item" data-id="' + t.id + '">' +
        '<div class="tx-d-main">' +
          '<span class="tx-d-date">' + formatDate(t.date) + '</span>' +
          '<span class="tx-d-desc">' + escapeHtml(t.desc || (t.type + ' transaction')) + '</span>' +
          '<div class="tx-d-badges">' +
            '<span class="badge ' + badgeClass + '">' + escapeHtml(t.type) + '</span>' +
            (t.category ? '<span class="mode-tag">' + escapeHtml(t.category) + '</span>' : '') +
            (t.mode ? '<span class="mode-tag">' + escapeHtml(t.mode) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="tx-d-side">' +
          '<span class="tx-d-acct">' + acctLabel + '</span>' +
          '<span class="tx-d-amt num ' + amtClass + '">' + sign + ' ' + inr(t.amount) + '</span>' +
          '<div class="tx-icon-actions">' +
            '<button type="button" class="icon-btn editTx" title="Edit">' + icon('edit') + '</button>' +
            '<button type="button" class="icon-btn del delTx" title="Delete">' + icon('trash') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>' +

    /* Mobile view: Untouched mobile banking transaction cards */
    '<div class="mobile-tx-list mobile-only">' +
    list.map(function (t) {
      var isDual = t.type === 'Transfer' || t.type === 'CC Bill Payment';
      var effAcctId = State.effectiveTxAccountId(t, ud.accounts);
      var acctLabel = isDual
        ? escapeHtml(State.accountName(ud.accounts, t.fromAccountId)) + ' → ' + escapeHtml(State.accountName(ud.accounts, t.toAccountId))
        : escapeHtml(State.accountName(ud.accounts, effAcctId));
      var amtClass = t.type === 'Income' ? 'income' : (t.type === 'Expense' ? 'expense' : '');
      var sign = t.type === 'Income' ? '+' : (t.type === 'Expense' ? '−' : '');
      var badgeClass = t.type === 'Income' ? 'income' : (t.type === 'Expense' ? 'expense' : 'transfer');
      return '<div class="tx-m-item" data-id="' + t.id + '">' +
        '<div class="tx-m-head">' +
          '<div class="tx-m-date">' + formatDate(t.date) + '</div>' +
          '<div class="tx-m-amt num ' + amtClass + '">' + sign + ' ' + inr(t.amount) + '</div>' +
        '</div>' +
        '<div class="tx-m-desc">' + escapeHtml(t.desc || (t.type + ' transaction')) + '</div>' +
        '<div class="tx-m-meta">' +
          '<span class="badge ' + badgeClass + '">' + escapeHtml(t.type) + '</span>' +
          (t.category ? '<span class="mode-tag">' + escapeHtml(t.category) + '</span>' : '') +
          (t.mode ? '<span class="mode-tag">' + escapeHtml(t.mode) + '</span>' : '') +
          '<span class="tx-m-acct">' + acctLabel + '</span>' +
        '</div>' +
        '<div class="tx-m-actions">' +
          '<button type="button" class="editTx">Edit</button>' +
          '<button type="button" class="del delTx">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>'
  );
}

export function bindTxItemActions(container, u, ud, ui, render) {
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
        body: 'This entry will be permanently removed and account balances will be recalculated.',
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

function renderTxTable(u, ud, ui, render) {
  var card = document.getElementById('txTableCard');
  var list = ud.transactions.filter(function (t) {
    if (ui.txDateFrom && t.date < ui.txDateFrom) return false;
    if (ui.txDateTo && t.date > ui.txDateTo) return false;
    if (!State.matchesMultiAccount(t, ui.txAccounts, ud.accounts)) return false;
    if (!State.matchesMultiValue(t.category, ui.txCategories)) return false;
    if (!State.matchesMultiValue(t.type, ui.txTypes)) return false;
    if (!State.matchesMultiValue(t.mode, ui.txModes)) return false;
    return true;
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  var totalIncome = 0;
  var totalExpense = 0;
  list.forEach(function (t) {
    var amt = Number(t.amount || 0);
    if (t.type === 'Income') totalIncome += amt;
    else if (t.type === 'Expense') totalExpense += amt;
  });

  var summaryHtml = '<div class="tx-summary-bar">' +
    '<span class="tx-sum-count">Showing <strong>' + list.length + '</strong> transaction' + (list.length === 1 ? '' : 's') + '</span>' +
    '<div class="tx-sum-pills">' +
      '<span class="t-tot-pill credit">Income: <strong>' + inr(totalIncome) + '</strong></span>' +
      '<span class="t-tot-pill debit">Expense: <strong>' + inr(totalExpense) + '</strong></span>' +
      '<span class="t-tot-pill net">Net: <strong>' + inr(totalIncome - totalExpense) + '</strong></span>' +
    '</div>' +
  '</div>';

  card.innerHTML = summaryHtml + renderTxListHtml(list, ud);
  bindTxItemActions(card, u, ud, ui, render);
}

