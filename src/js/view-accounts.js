import { escapeHtml, inr, uid } from './utils.js';
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
    '<div class="card">' + (ud.accounts.length === 0 ? '<div class="empty-note">No accounts yet.</div>' :
      '<div class="table-wrap"><table class="manage-table data-table"><thead><tr><th>Account</th><th>Opening balance</th><th>Current balance</th><th></th></tr></thead><tbody>' +
      ud.accounts.map(function (a) {
        var bal = State.accountBalance(a, ud.transactions);
        return '<tr data-id="' + a.id + '">' +
          '<td><input type="text" class="acctNameInput" value="' + escapeHtml(a.name) + '"></td>' +
          '<td class="num">₹ <input type="number" class="acctOpeningInput" step="0.01" value="' + a.opening + '" style="width:110px;"></td>' +
          '<td class="amt num">' + inr(bal) + '</td>' +
          '<td class="row-actions"><button type="button" class="del delAcct">Delete</button></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>') + '</div>'
  );

  document.getElementById('acctForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var name = (fd.get('name') || '').trim();
    if (!name) return;
    var newAcct = { id: uid('acc'), name: name, opening: parseFloat(fd.get('opening')) || 0, createdAt: Date.now() };
    State.commitUserData(u, Object.assign({}, ud, { accounts: ud.accounts.concat([newAcct]) }), { successMsg: 'Account added.' });
  });

  main.querySelectorAll('.acctNameInput').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var id = inp.closest('tr').dataset.id;
      var newAccts = ud.accounts.map(function (a) { return a.id === id ? Object.assign({}, a, { name: inp.value.trim() || a.name }) : a; });
      State.commitUserData(u, Object.assign({}, ud, { accounts: newAccts }), { successMsg: 'Account renamed.' });
    });
  });
  main.querySelectorAll('.acctOpeningInput').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var id = inp.closest('tr').dataset.id;
      var newAccts = ud.accounts.map(function (a) { return a.id === id ? Object.assign({}, a, { opening: parseFloat(inp.value) || 0 }) : a; });
      State.commitUserData(u, Object.assign({}, ud, { accounts: newAccts }), { successMsg: 'Opening balance updated.' });
    });
  });
  main.querySelectorAll('.delAcct').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('tr').dataset.id;
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
