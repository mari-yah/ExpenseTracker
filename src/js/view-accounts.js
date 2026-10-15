import { escapeHtml, inr, uid, icon } from './utils.js';
import { toast, confirmModal } from './ui.js';
import * as State from './state.js';

var ACCOUNT_TYPES = ['Bank', 'Cash', 'Credit Card'];

function typeSelectHtml(selected) {
  var sel = selected || 'Bank';
  return '<select name="accountType">' +
    ACCOUNT_TYPES.map(function (t) {
      return '<option value="' + t + '" ' + (t === sel ? 'selected' : '') + '>' + t + '</option>';
    }).join('') +
    '</select>';
}

export function renderAccounts(main, ui, render, u) {
  var ud = State.currentUserData();
  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Accounts</h1><div class="sub">Track Bank accounts, Cash account, and Credit Card ledgers.</div></div></div>' +
    '<p class="help-text">Bank accounts track bank balances. Your <strong>Cash Account</strong> increases when you transfer from Bank and deducts whenever payment mode is Cash. Your <strong>Credit Card</strong> tracks unpaid CC due without deducting from your Bank account until you log a CC Bill Payment.</p>' +
    '<form class="manage-form" id="acctForm">' +
    '<div class="field"><span class="field-label">Account name</span><input type="text" name="name" placeholder="e.g. HDFC Bank / ICICI CC" required></div>' +
    '<div class="field"><span class="field-label">Type</span>' + typeSelectHtml('Bank') + '</div>' +
    '<div class="field"><span class="field-label">Opening balance / due (₹)</span><input type="number" name="opening" step="0.01" placeholder="0" required></div>' +
    '<button type="submit" class="btn">Add account</button>' +
    '</form>' +
    '<div>' + (ud.accounts.length === 0 ? '<div class="card"><div class="empty-note">No accounts yet.</div></div>' :
      '<div class="acct-card-list">' +
      ud.accounts.map(function (a) {
        var accType = State.getAccountType(a);
        var bal = State.accountBalance(a, ud.transactions, ud.accounts);
        var isCC = accType === 'Credit Card';
        var balLabel = isCC ? 'Current CC Due' : 'Current balance';
        var opLabel = isCC ? 'Opening due' : 'Opening balance';
        var isEditing = ui.editingAccountId === a.id;
        if (isEditing) {
          return '<div class="acct-m-item editing" data-id="' + a.id + '">' +
            '<form class="acctEditForm acct-edit-row">' +
              '<div class="acct-m-name-wrap"><span class="acct-m-lbl">Account Name</span><input type="text" name="name" class="acctEditName" value="' + escapeHtml(a.name) + '" required></div>' +
              '<div class="acct-m-op-wrap"><span class="acct-m-lbl">Account Type</span>' + typeSelectHtml(accType) + '</div>' +
              '<div class="acct-m-op-wrap"><span class="acct-m-lbl">' + opLabel + ' (₹)</span><input type="number" name="opening" step="0.01" class="acctEditOpening" value="' + a.opening + '" required></div>' +
              '<div class="card-icon-actions">' +
                '<button type="submit" class="icon-btn save-tick" title="Save account">' + icon('check') + '</button>' +
                '<button type="button" class="icon-btn cancelAcctEdit" title="Cancel">' + icon('x') + '</button>' +
              '</div>' +
            '</form>' +
          '</div>';
        }
        return '<div class="acct-m-item" data-id="' + a.id + '">' +
          '<div class="acct-m-main">' +
            '<div class="acct-m-name-wrap"><span class="acct-m-lbl">' + escapeHtml(accType) + '</span><div class="acct-m-title">' + escapeHtml(a.name) + '</div></div>' +
            '<div class="acct-m-bal-wrap"><span class="acct-m-lbl">' + balLabel + '</span><div class="acct-m-bal num">' + inr(bal) + '</div></div>' +
            '<div class="acct-m-op-wrap"><span class="acct-m-lbl">' + opLabel + '</span><div class="acct-m-val num">' + inr(a.opening) + '</div></div>' +
          '</div>' +
          '<div class="card-icon-actions">' +
            '<button type="button" class="icon-btn editAcct" title="Edit account">' + icon('edit') + '</button>' +
            '<button type="button" class="icon-btn del delAcct" title="Delete account">' + icon('trash') + '</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>') + '</div>'
  );

  document.getElementById('acctForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var name = (fd.get('name') || '').trim();
    if (!name) return;
    var accType = fd.get('accountType') || 'Bank';
    var newAcct = { id: uid('acc'), name: name, accountType: accType, opening: parseFloat(fd.get('opening')) || 0, createdAt: Date.now() };
    State.commitUserData(u, Object.assign({}, ud, { accounts: ud.accounts.concat([newAcct]) }), { successMsg: 'Account added.' });
  });

  main.querySelectorAll('.editAcct').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ui.editingAccountId = btn.closest('[data-id]').dataset.id;
      render();
    });
  });

  main.querySelectorAll('.cancelAcctEdit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ui.editingAccountId = null;
      render();
    });
  });

  main.querySelectorAll('.acctEditForm').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = form.closest('[data-id]').dataset.id;
      var fd = new FormData(form);
      var newName = (fd.get('name') || '').trim();
      var newType = fd.get('accountType') || 'Bank';
      var newOpening = parseFloat(fd.get('opening')) || 0;
      if (!newName) return;
      var newAccts = ud.accounts.map(function (a) {
        return a.id === id ? Object.assign({}, a, { name: newName, accountType: newType, opening: newOpening }) : a;
      });
      State.commitUserData(u, Object.assign({}, ud, { accounts: newAccts }), {
        successMsg: 'Account updated.',
        onSuccess: function () { ui.editingAccountId = null; }
      });
    });
  });

  main.querySelectorAll('.delAcct').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('[data-id]').dataset.id;
      var inUse = ud.transactions.some(function (t) { return t.accountId === id || t.fromAccountId === id || t.toAccountId === id; });
      if (inUse) { toast('This account has transactions linked to it — delete or reassign those first.'); return; }
      confirmModal({
        title: 'Delete this account?',
        body: 'This account has no transactions, so it can be safely removed.',
        confirmLabel: 'Delete', danger: true,
        onConfirm: function () {
          var newAccts = ud.accounts.filter(function (a) { return a.id !== id; });
          State.commitUserData(u, Object.assign({}, ud, { accounts: newAccts }), { successMsg: 'Account deleted.' });
        }
      });
    });
  });
}
