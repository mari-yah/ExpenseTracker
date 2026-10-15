import { escapeHtml, inr, uid, todayStr, monthLabel, formatDate, icon } from './utils.js';
import { MODES } from './constants.js';
import { toast, confirmModal } from './ui.js';
import * as State from './state.js';

export function renderTransactions(main, ui, render, u) {
  var ud = State.currentUserData();
  var editingTx = ui.editingTxId ? ud.transactions.find(function (t) { return t.id === ui.editingTxId; }) : null;
  var months = State.allMonthKeys(ud.transactions);

  ui.txCategoryFilter = ui.txCategoryFilter || 'all';
  ui.txTypeFilter = ui.txTypeFilter || 'all';
  ui.txModeFilter = ui.txModeFilter || 'all';
  ui.txDateFrom = ui.txDateFrom || '';
  ui.txDateTo = ui.txDateTo || '';

  var monthFilterOptions = '<option value="all">All months</option>' + months.map(function (k) {
    return '<option value="' + k + '" ' + (k === ui.txMonthFilter ? 'selected' : '') + '>' + monthLabel(k) + '</option>';
  }).join('');
  var acctFilterOptions = '<option value="all">All accounts</option>' + ud.accounts.map(function (a) {
    return '<option value="' + a.id + '" ' + (a.id === ui.txAccountFilter ? 'selected' : '') + '>' + escapeHtml(a.name) + ' (' + State.getAccountType(a) + ')</option>';
  }).join('');
  var catFilterOptions = '<option value="all">All categories</option>' + ud.categories.map(function (c) {
    return '<option value="' + escapeHtml(c.name) + '" ' + (c.name === ui.txCategoryFilter ? 'selected' : '') + '>' + escapeHtml(c.name) + '</option>';
  }).join('');
  var typeFilterOptions = '<option value="all">All types</option>' + ['Expense', 'Income', 'Transfer', 'CC Bill Payment'].map(function (t) {
    return '<option value="' + t + '" ' + (t === ui.txTypeFilter ? 'selected' : '') + '>' + t + '</option>';
  }).join('');
  var modeFilterOptions = '<option value="all">All modes</option>' + MODES.map(function (m) {
    return '<option value="' + m + '" ' + (m === ui.txModeFilter ? 'selected' : '') + '>' + m + '</option>';
  }).join('');

  function acctOpts(selected, filterFn) {
    var list = filterFn ? ud.accounts.filter(filterFn) : ud.accounts;
    if (list.length === 0) list = ud.accounts;
    return list.map(function (a) {
      return '<option value="' + a.id + '" ' + (a.id === selected ? 'selected' : '') + '>' + escapeHtml(a.name) + '</option>';
    }).join('');
  }
  var catOpts = ud.categories.map(function (c) {
    var sel = editingTx && (editingTx.category === c.name) ? 'selected' : '';
    return '<option value="' + escapeHtml(c.name) + '" ' + sel + '>' + escapeHtml(c.name) + '</option>';
  }).join('');
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
      '<div class="field"><span class="field-label">Date</span><input type="date" name="date" max="' + todayStr + '" required value="' + (editingTx ? editingTx.date : todayStr) + '"></div>' +
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

    '<div class="card filter-panel" style="margin-bottom:16px; padding:14px 18px;">' +
    '<div class="filter-row" style="margin-bottom:0;">' +
      '<div class="field"><span class="field-label">Month</span><select id="txMonthFilter">' + monthFilterOptions + '</select></div>' +
      '<div class="field"><span class="field-label">From Date</span><input type="date" id="txDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.txDateFrom) + '"></div>' +
      '<div class="field"><span class="field-label">To Date</span><input type="date" id="txDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.txDateTo) + '"></div>' +
      '<div class="field"><span class="field-label">Account</span><select id="txAcctFilter">' + acctFilterOptions + '</select></div>' +
      '<div class="field"><span class="field-label">Category</span><select id="txCatFilter">' + catFilterOptions + '</select></div>' +
      '<div class="field"><span class="field-label">Type</span><select id="txTypeFilter">' + typeFilterOptions + '</select></div>' +
      '<div class="field"><span class="field-label">Mode</span><select id="txModeFilter">' + modeFilterOptions + '</select></div>' +
      ((ui.txMonthFilter !== 'all' || ui.txAccountFilter !== 'all' || ui.txCategoryFilter !== 'all' || ui.txTypeFilter !== 'all' || ui.txModeFilter !== 'all' || ui.txDateFrom || ui.txDateTo)
        ? '<div class="field" style="align-self:flex-end;"><button type="button" class="btn secondary sm" id="resetTxFilters">Clear filters</button></div>'
        : '') +
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

  document.getElementById('txMonthFilter').addEventListener('change', function (e) { ui.txMonthFilter = e.target.value; render(); });
  document.getElementById('txDateFrom').addEventListener('change', function (e) { ui.txDateFrom = e.target.value; render(); });
  document.getElementById('txDateTo').addEventListener('change', function (e) { ui.txDateTo = e.target.value; render(); });
  document.getElementById('txAcctFilter').addEventListener('change', function (e) { ui.txAccountFilter = e.target.value; render(); });
  document.getElementById('txCatFilter').addEventListener('change', function (e) { ui.txCategoryFilter = e.target.value; render(); });
  document.getElementById('txTypeFilter').addEventListener('change', function (e) { ui.txTypeFilter = e.target.value; render(); });
  document.getElementById('txModeFilter').addEventListener('change', function (e) { ui.txModeFilter = e.target.value; render(); });

  var resetBtn = document.getElementById('resetTxFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      ui.txMonthFilter = 'all';
      ui.txDateFrom = '';
      ui.txDateTo = '';
      ui.txAccountFilter = 'all';
      ui.txCategoryFilter = 'all';
      ui.txTypeFilter = 'all';
      ui.txModeFilter = 'all';
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
    if (ui.txMonthFilter !== 'all' && t.date.slice(0, 7) !== ui.txMonthFilter) return false;
    if (ui.txDateFrom && t.date < ui.txDateFrom) return false;
    if (ui.txDateTo && t.date > ui.txDateTo) return false;
    if (ui.txAccountFilter !== 'all') {
      var effId = State.effectiveTxAccountId(t, ud.accounts);
      var matches = effId === ui.txAccountFilter || t.accountId === ui.txAccountFilter || t.fromAccountId === ui.txAccountFilter || t.toAccountId === ui.txAccountFilter;
      if (!matches) return false;
    }
    if (ui.txCategoryFilter !== 'all' && t.category !== ui.txCategoryFilter) return false;
    if (ui.txTypeFilter !== 'all' && t.type !== ui.txTypeFilter) return false;
    if (ui.txModeFilter !== 'all' && t.mode !== ui.txModeFilter) return false;
    return true;
  }).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });

  card.innerHTML = renderTxListHtml(list, ud);
  bindTxItemActions(card, u, ud, ui, render);
}
