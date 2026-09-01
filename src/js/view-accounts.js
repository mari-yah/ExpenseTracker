import { escapeHtml, inr, uid, icon } from './utils.js';
import { toast, confirmModal } from './ui.js';
import * as State from './state.js';

export function renderAccounts(main, ui, render, u) {
  var ud = State.currentUserData();
  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Accounts</h1><div class="sub">Track balances across every place your money sits.</div></div></div>' +
    '<p class="help-text">Set each account’s opening balance once; every income, expense and transfer you log after that keeps the current balance accurate automatically.</p>' +
    '<form class="manage-form" id="acctForm">' +
    '<div class="field"><span class="field-label">Account name</span><input type="text" name="name" placeholder="e.g. Primary Account" required></div>' +
    '<div class="field"><span class="field-label">Opening balance (₹)</span><input type="number" name="opening" step="0.01" placeholder="0" required></div>' +
    '<button type="submit" class="btn">Add account</button>' +
    '</form>' +
    '<div>' + (ud.accounts.length === 0 ? '<div class="card"><div class="empty-note">No accounts yet.</div></div>' :
      '<div class="acct-card-list">' +
      ud.accounts.map(function (a) {
        var bal = State.accountBalance(a, ud.transactions);
        var isEditing = ui.editingAccountId === a.id;
        if (isEditing) {
          return '<div class="acct-m-item editing" data-id="' + a.id + '">' +
            '<form class="acctEditForm acct-edit-row">' +
              '<div class="acct-m-name-wrap"><span class="acct-m-lbl">Account Name</span><input type="text" name="name" class="acctEditName" value="' + escapeHtml(a.name) + '" required></div>' +
              '<div class="acct-m-op-wrap"><span class="acct-m-lbl">Opening Balance (₹)</span><input type="number" name="opening" step="0.01" class="acctEditOpening" value="' + a.opening + '" required></div>' +
              '<div class="card-icon-actions">' +
                '<button type="submit" class="icon-btn save-tick" title="Save account">' + icon('check') + '</button>' +
                '<button type="button" class="icon-btn cancelAcctEdit" title="Cancel">' + icon('x') + '</button>' +
              '</div>' +
            '</form>' +
          '</div>';
        }
        return '<div class="acct-m-item" data-id="' + a.id + '">' +
          '<div class="acct-m-main">' +
            '<div class="acct-m-name-wrap"><span class="acct-m-lbl">Account</span><div class="acct-m-title">' + escapeHtml(a.name) + '</div></div>' +
            '<div class="acct-m-bal-wrap"><span class="acct-m-lbl">Current balance</span><div class="acct-m-bal num">' + inr(bal) + '</div></div>' +
            '<div class="acct-m-op-wrap"><span class="acct-m-lbl">Opening balance</span><div class="acct-m-val num">' + inr(a.opening) + '</div></div>' +
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
    var newAcct = { id: uid('acc'), name: name, opening: parseFloat(fd.get('opening')) || 0, createdAt: Date.now() };
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
      var newOpening = parseFloat(fd.get('opening')) || 0;
      if (!newName) return;
      var newAccts = ud.accounts.map(function (a) { return a.id === id ? Object.assign({}, a, { name: newName, opening: newOpening }) : a; });
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
