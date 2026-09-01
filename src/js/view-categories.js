import { escapeHtml, uid, icon, todayStr, monthLabel, inr } from './utils.js';
import { confirmModal } from './ui.js';
import * as State from './state.js';

export function renderCategories(main, ui, render, u) {
  var ud = State.currentUserData();
  var months = State.allMonthKeys(ud.transactions);
  ui.catMonth = ui.catMonth || todayStr.slice(0, 7);
  if (months.indexOf(ui.catMonth) === -1) {
    months = [ui.catMonth].concat(months);
  }

  var monthOptions = months.map(function (k) {
    return '<option value="' + k + '" ' + (k === ui.catMonth ? 'selected' : '') + '>' + monthLabel(k) + '</option>';
  }).join('');

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Categories</h1><div class="sub">Set monthly budgets per month to track spending against.</div></div></div>' +
    '<div class="toolbar" style="margin-bottom:18px;">' +
    '<div class="field"><span class="field-label">Budget Month</span><select id="catMonthSelect">' + monthOptions + '</select></div>' +
    '</div>' +
    '<p class="help-text">Categories you add here appear in the transaction form and on your dashboard budget tracker. Changing a budget for a month applies specifically to that month without affecting others.</p>' +
    '<form class="manage-form" id="catForm">' +
    '<div class="field"><span class="field-label">Category name</span><input type="text" name="name" placeholder="e.g. Travel" required></div>' +
    '<div class="field"><span class="field-label">Default budget (₹)</span><input type="number" name="budget" min="0" step="1" placeholder="0" required></div>' +
    '<button type="submit" class="btn">Add category</button>' +
    '</form>' +
    '<div>' + (ud.categories.length === 0 ? '<div class="card"><div class="empty-note">No categories yet.</div></div>' :
      '<div class="cat-card-list">' +
      ud.categories.map(function (c) {
        var currentBudget = State.categoryBudget(c, ui.catMonth);
        var isEditing = ui.editingCategoryId === c.id;
        if (isEditing) {
          return '<div class="cat-m-item editing" data-id="' + c.id + '">' +
            '<form class="catEditForm cat-edit-row">' +
              '<div class="cat-m-name-wrap"><span class="cat-m-lbl">Category Name</span><input type="text" name="name" class="catEditName" value="' + escapeHtml(c.name) + '" required></div>' +
              '<div class="cat-m-budget-wrap"><span class="cat-m-lbl">Budget for ' + monthLabel(ui.catMonth) + ' (₹)</span><input type="number" name="budget" min="0" step="1" class="catEditBudget" value="' + currentBudget + '" required></div>' +
              '<div class="card-icon-actions">' +
                '<button type="submit" class="icon-btn save-tick" title="Save budget for ' + monthLabel(ui.catMonth) + '">' + icon('check') + '</button>' +
                '<button type="button" class="icon-btn cancelCatEdit" title="Cancel">' + icon('x') + '</button>' +
              '</div>' +
            '</form>' +
          '</div>';
        }
        return '<div class="cat-m-item" data-id="' + c.id + '">' +
          '<div class="cat-m-main">' +
            '<div class="cat-m-name-wrap"><span class="cat-m-lbl">Category</span><div class="cat-m-title">' + escapeHtml(c.name) + '</div></div>' +
            '<div class="cat-m-budget-wrap"><span class="cat-m-lbl">Budget (' + monthLabel(ui.catMonth) + ')</span><div class="cat-m-val num">₹ ' + Number(currentBudget).toLocaleString('en-IN') + '</div></div>' +
          '</div>' +
          '<div class="card-icon-actions">' +
            '<button type="button" class="icon-btn editCat" title="Edit category">' + icon('edit') + '</button>' +
            '<button type="button" class="icon-btn del delCat" title="Delete category">' + icon('trash') + '</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>') + '</div>'
  );

  document.getElementById('catMonthSelect').addEventListener('change', function (e) {
    ui.catMonth = e.target.value;
    render();
  });

  document.getElementById('catForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var name = (fd.get('name') || '').trim();
    if (!name) return;
    var defaultBudget = parseFloat(fd.get('budget')) || 0;
    var newCat = { id: uid('cat'), name: name, budget: defaultBudget, monthlyBudgets: {} };
    newCat.monthlyBudgets[ui.catMonth] = defaultBudget;
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
      var newMonthBudget = parseFloat(fd.get('budget')) || 0;

      var monthlyBudgets = Object.assign({}, cat.monthlyBudgets || {});
      monthlyBudgets[ui.catMonth] = newMonthBudget;

      var newCats = ud.categories.map(function (c) {
        return c.id === id ? Object.assign({}, c, { name: newName, monthlyBudgets: monthlyBudgets }) : c;
      });
      var newTxs = ud.transactions.map(function (t) { return t.category === oldName ? Object.assign({}, t, { category: newName }) : t; });

      State.commitUserData(u, Object.assign({}, ud, { categories: newCats, transactions: newTxs }), {
        successMsg: 'Budget for ' + monthLabel(ui.catMonth) + ' updated to ' + inr(newMonthBudget) + '.',
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
