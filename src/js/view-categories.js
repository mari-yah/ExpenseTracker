import { escapeHtml, uid, icon } from './utils.js';
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
    '<div>' + (ud.categories.length === 0 ? '<div class="card"><div class="empty-note">No categories yet.</div></div>' :
      '<div class="cat-card-list">' +
      ud.categories.map(function (c) {
        var isEditing = ui.editingCategoryId === c.id;
        if (isEditing) {
          return '<div class="cat-m-item editing" data-id="' + c.id + '">' +
            '<form class="catEditForm cat-edit-row">' +
              '<div class="cat-m-name-wrap"><span class="cat-m-lbl">Category Name</span><input type="text" name="name" class="catEditName" value="' + escapeHtml(c.name) + '" required></div>' +
              '<div class="cat-m-budget-wrap"><span class="cat-m-lbl">Monthly Budget (₹)</span><input type="number" name="budget" min="0" step="1" class="catEditBudget" value="' + c.budget + '" required></div>' +
              '<div class="card-icon-actions">' +
                '<button type="submit" class="icon-btn save-tick" title="Save category">' + icon('check') + '</button>' +
                '<button type="button" class="icon-btn cancelCatEdit" title="Cancel">' + icon('x') + '</button>' +
              '</div>' +
            '</form>' +
          '</div>';
        }
        return '<div class="cat-m-item" data-id="' + c.id + '">' +
          '<div class="cat-m-main">' +
            '<div class="cat-m-name-wrap"><span class="cat-m-lbl">Category</span><div class="cat-m-title">' + escapeHtml(c.name) + '</div></div>' +
            '<div class="cat-m-budget-wrap"><span class="cat-m-lbl">Monthly budget</span><div class="cat-m-val num">₹ ' + Number(c.budget).toLocaleString('en-IN') + '</div></div>' +
          '</div>' +
          '<div class="card-icon-actions">' +
            '<button type="button" class="icon-btn editCat" title="Edit category">' + icon('edit') + '</button>' +
            '<button type="button" class="icon-btn del delCat" title="Delete category">' + icon('trash') + '</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>') + '</div>'
  );

  document.getElementById('catForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var name = (fd.get('name') || '').trim();
    if (!name) return;
    var newCat = { id: uid('cat'), name: name, budget: parseFloat(fd.get('budget')) || 0 };
    State.commitUserData(u, Object.assign({}, ud, { categories: ud.categories.concat([newCat]) }), { successMsg: 'Category added.' });
  });

  main.querySelectorAll('.editCat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ui.editingCategoryId = btn.closest('[data-id]').dataset.id;
      render();
    });
  });

  main.querySelectorAll('.cancelCatEdit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ui.editingCategoryId = null;
      render();
    });
  });

  main.querySelectorAll('.catEditForm').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = form.closest('[data-id]').dataset.id;
      var fd = new FormData(form);
      var cat = ud.categories.find(function (c) { return c.id === id; });
      var oldName = cat.name;
      var newName = (fd.get('name') || '').trim() || oldName;
      var newBudget = parseFloat(fd.get('budget')) || 0;
      var newCats = ud.categories.map(function (c) { return c.id === id ? Object.assign({}, c, { name: newName, budget: newBudget }) : c; });
      var newTxs = ud.transactions.map(function (t) { return t.category === oldName ? Object.assign({}, t, { category: newName }) : t; });
      State.commitUserData(u, Object.assign({}, ud, { categories: newCats, transactions: newTxs }), {
        successMsg: 'Category updated.',
        onSuccess: function () { ui.editingCategoryId = null; }
      });
    });
  });

  main.querySelectorAll('.delCat').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.closest('[data-id]').dataset.id;
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
