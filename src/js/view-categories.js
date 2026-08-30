import { escapeHtml, uid } from './utils.js';
import { confirmModal } from './ui.js';
import * as State from './state.js';

export function renderCategories(main, ui, render, u) {
  var ud = State.currentUserData();
  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Categories</h1><div class="sub">Set monthly budgets to track spending against.</div></div></div>' +
    '<p class="help-text">Categories you add here appear in the transaction form and on your dashboard budget tracker.</p>' +
    '<form class="manage-form" id="catForm">' +
    '<div class="field"><span class="field-label">Category name</span><input type="text" name="name" placeholder="e.g. Travel" required></div>' +
    '<div class="field"><span class="field-label">Monthly budget (₹)</span><input type="number" name="budget" min="0" step="1" placeholder="0" required></div>' +
    '<button type="submit" class="btn">Add category</button>' +
    '</form>' +
    '<div class="card">' + (ud.categories.length === 0 ? '<div class="empty-note">No categories yet.</div>' :
      '<div class="table-wrap"><table class="manage-table data-table"><thead><tr><th>Category</th><th>Monthly budget</th><th></th></tr></thead><tbody>' +
      ud.categories.map(function (c) {
        return '<tr data-id="' + c.id + '">' +
          '<td><input type="text" class="catNameInput" value="' + escapeHtml(c.name) + '"></td>' +
          '<td class="num">₹ <input type="number" class="catBudgetInput" min="0" step="1" value="' + c.budget + '" style="width:110px;"></td>' +
          '<td class="row-actions"><button type="button" class="del delCat">Delete</button></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>') + '</div>'
  );

  document.getElementById('catForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var name = (fd.get('name') || '').trim();
    if (!name) return;
    var newCat = { id: uid('cat'), name: name, budget: parseFloat(fd.get('budget')) || 0 };
    State.commitUserData(u, Object.assign({}, ud, { categories: ud.categories.concat([newCat]) }), { successMsg: 'Category added.' });
  });

  main.querySelectorAll('.catNameInput').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var id = inp.closest('tr').dataset.id;
      var cat = ud.categories.find(function (c) { return c.id === id; });
      var oldName = cat.name;
      var newName = inp.value.trim() || oldName;
      var newCats = ud.categories.map(function (c) { return c.id === id ? Object.assign({}, c, { name: newName }) : c; });
      var newTxs = ud.transactions.map(function (t) { return t.category === oldName ? Object.assign({}, t, { category: newName }) : t; });
      State.commitUserData(u, Object.assign({}, ud, { categories: newCats, transactions: newTxs }), { successMsg: 'Category renamed.' });
    });
  });
  main.querySelectorAll('.catBudgetInput').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var id = inp.closest('tr').dataset.id;
      var newCats = ud.categories.map(function (c) { return c.id === id ? Object.assign({}, c, { budget: parseFloat(inp.value) || 0 }) : c; });
      State.commitUserData(u, Object.assign({}, ud, { categories: newCats }), { successMsg: 'Budget updated.' });
    });
  });
  main.querySelectorAll('.delCat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('tr').dataset.id;
      confirmModal({
        title: 'Delete this category?',
        body: 'Past transactions in this category will keep their record but show as uncategorized in future edits.',
        confirmLabel: 'Delete', danger: true,
        onConfirm: function () {
          var newCats = ud.categories.filter(function (c) { return c.id !== id; });
          State.commitUserData(u, Object.assign({}, ud, { categories: newCats }), { successMsg: 'Category deleted.' });
        }
      });
    });
  });
}
