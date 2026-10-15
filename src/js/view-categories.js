import { escapeHtml, uid, icon, todayStr, monthLabel, inr, pad, today } from './utils.js';
import { confirmModal } from './ui.js';
import * as State from './state.js';

export function renderCategories(main, ui, render, u) {
  var ud = State.currentUserData();
  var defaultStart = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-01';
  if (ui.catDateFrom === undefined) ui.catDateFrom = defaultStart;
  if (ui.catDateTo === undefined) ui.catDateTo = todayStr;

  var activeMonth = (ui.catDateFrom || ui.catDateTo || todayStr).slice(0, 7);
  var activeMonthText = monthLabel(activeMonth);

  var recurringCats = ud.categories.filter(function (c) { return !c.monthOnly; });
  var currentMonthCats = ud.categories.filter(function (c) { return c.monthOnly === activeMonth; });

  function renderCatCard(c) {
    var currentBudget = State.categoryBudget(c, activeMonth);
    var isEditing = ui.editingCategoryId === c.id;
    var isMonthOnly = Boolean(c.monthOnly);
    if (isEditing) {
      return '<div class="cat-m-item editing" data-id="' + c.id + '">' +
        '<form class="catEditForm cat-edit-row">' +
          '<div class="cat-m-name-wrap"><span class="cat-m-lbl">Category Name</span><input type="text" name="name" class="catEditName" value="' + escapeHtml(c.name) + '" required></div>' +
          '<div class="cat-m-budget-wrap"><span class="cat-m-lbl">Budget for ' + escapeHtml(activeMonthText) + ' (₹)</span><input type="number" name="budget" min="0" step="1" class="catEditBudget" placeholder="No budget" value="' + (currentBudget > 0 ? currentBudget : '') + '"></div>' +
          '<div class="cat-m-budget-wrap"><span class="cat-m-lbl">Column</span>' +
            '<select name="scope" class="catEditScope">' +
              '<option value="recurring" ' + (!isMonthOnly ? 'selected' : '') + '>Repeats Every Month</option>' +
              '<option value="monthOnly" ' + (isMonthOnly ? 'selected' : '') + '>Only for ' + escapeHtml(activeMonthText) + '</option>' +
            '</select>' +
          '</div>' +
          '<div class="card-icon-actions">' +
            '<button type="submit" class="icon-btn save-tick" title="Save budget for ' + escapeHtml(activeMonthText) + '">' + icon('check') + '</button>' +
            '<button type="button" class="icon-btn cancelCatEdit" title="Cancel">' + icon('x') + '</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    }
    var budgetDisplay = currentBudget > 0 ? ('₹ ' + Number(currentBudget).toLocaleString('en-IN')) : '<span style="color:var(--ink-faint); font-weight:500;">No budget</span>';
    return '<div class="cat-m-item" data-id="' + c.id + '" data-name="' + escapeHtml(c.name) + '">' +
      '<div class="cat-m-main">' +
        '<div class="cat-m-name-wrap"><span class="cat-m-lbl">Category</span><div class="cat-m-title">' + escapeHtml(c.name) + '</div></div>' +
        '<div class="cat-m-budget-wrap"><span class="cat-m-lbl">Budget (' + escapeHtml(activeMonthText) + ')</span><div class="cat-m-val num">' + budgetDisplay + '</div></div>' +
      '</div>' +
      '<div class="card-icon-actions">' +
        '<button type="button" class="icon-btn editCat" title="Edit category">' + icon('edit') + '</button>' +
        '<button type="button" class="icon-btn del delCat" title="Delete category">' + icon('trash') + '</button>' +
      '</div>' +
    '</div>';
  }

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Categories</h1><div class="sub">Manage repeating monthly categories and one-time monthly categories. Budgets are independent for each month.</div></div></div>' +
    '<div class="card filter-panel" style="margin-bottom:18px; padding:14px 18px;">' +
      '<div class="filter-row" style="margin-bottom:0;">' +
        '<div class="field"><span class="field-label">From Date</span><input type="date" id="catDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.catDateFrom) + '"></div>' +
        '<div class="field"><span class="field-label">To Date</span><input type="date" id="catDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.catDateTo) + '"></div>' +
        '<div class="field" style="align-self:center; padding-top:16px;"><span class="mode-tag" style="font-weight:600; padding:6px 12px;">Editing Budgets for: ' + escapeHtml(activeMonthText) + '</span></div>' +
        ((ui.catDateFrom !== defaultStart || ui.catDateTo !== todayStr)
          ? '<div class="field" style="align-self:flex-end;"><button type="button" class="btn secondary sm" id="resetCatDates">This Month</button></div>'
          : '') +
      '</div>' +
    '</div>' +
    '<p class="help-text">You can add categories with or without a budget. Changing a category\'s budget updates <strong>' + escapeHtml(activeMonthText) + '</strong> only without affecting any other month.</p>' +
    '<form class="manage-form card" id="catForm" style="margin-bottom:24px;">' +
      '<div class="field"><span class="field-label">Category name</span><input type="text" name="name" placeholder="e.g. Travel / Diwali" required></div>' +
      '<div class="field"><span class="field-label">Budget for ' + escapeHtml(activeMonthText) + ' (₹, optional)</span><input type="number" name="budget" min="0" step="1" placeholder="Optional (no budget)"></div>' +
      '<div class="field"><span class="field-label">Category Type</span>' +
        '<select name="scope">' +
          '<option value="recurring">Repeats Every Month</option>' +
          '<option value="monthOnly">Only for ' + escapeHtml(activeMonthText) + '</option>' +
        '</select>' +
      '</div>' +
      '<button type="submit" class="btn">Add category</button>' +
    '</form>' +
    '<div class="cat-two-col-grid">' +
      '<div class="cat-col">' +
        '<div class="cat-col-head"><h3>Repeats Every Month</h3><span class="sub">' + recurringCats.length + ' categor' + (recurringCats.length === 1 ? 'y' : 'ies') + '</span></div>' +
        (recurringCats.length === 0
          ? '<div class="card"><div class="empty-note">No repeating categories yet.</div></div>'
          : '<div class="cat-card-list">' + recurringCats.map(renderCatCard).join('') + '</div>') +
      '</div>' +
      '<div class="cat-col">' +
        '<div class="cat-col-head"><h3>Only for ' + escapeHtml(activeMonthText) + '</h3><span class="sub">' + currentMonthCats.length + ' categor' + (currentMonthCats.length === 1 ? 'y' : 'ies') + '</span></div>' +
        (currentMonthCats.length === 0
          ? '<div class="card"><div class="empty-note">No one-time categories for ' + escapeHtml(activeMonthText) + '.</div></div>'
          : '<div class="cat-card-list">' + currentMonthCats.map(renderCatCard).join('') + '</div>') +
      '</div>' +
    '</div>'
  );

  document.getElementById('catDateFrom').addEventListener('change', function (e) {
    ui.catDateFrom = e.target.value;
    render();
  });
  document.getElementById('catDateTo').addEventListener('change', function (e) {
    ui.catDateTo = e.target.value;
    render();
  });
  var resetCatDates = document.getElementById('resetCatDates');
  if (resetCatDates) {
    resetCatDates.addEventListener('click', function () {
      ui.catDateFrom = defaultStart;
      ui.catDateTo = todayStr;
      render();
    });
  }

  document.getElementById('catForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(e.target);
    var name = (fd.get('name') || '').trim();
    if (!name) return;
    var rawBudget = (fd.get('budget') || '').trim();
    var parsedBudget = rawBudget === '' ? 0 : (parseFloat(rawBudget) || 0);
    var scope = fd.get('scope') || 'recurring';
    var newCat = {
      id: uid('cat'),
      name: name,
      budget: parsedBudget,
      monthlyBudgets: {},
      monthOnly: scope === 'monthOnly' ? activeMonth : null
    };
    newCat.monthlyBudgets[activeMonth] = parsedBudget;
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
      var rawBudget = (fd.get('budget') || '').trim();
      var newMonthBudget = rawBudget === '' ? 0 : (parseFloat(rawBudget) || 0);
      var scope = fd.get('scope') || (cat.monthOnly ? 'monthOnly' : 'recurring');

      var monthlyBudgets = Object.assign({}, cat.monthlyBudgets || {});
      monthlyBudgets[activeMonth] = newMonthBudget;

      var newCats = ud.categories.map(function (c) {
        if (c.id !== id) return c;
        return Object.assign({}, c, {
          name: newName,
          monthlyBudgets: monthlyBudgets,
          monthOnly: scope === 'monthOnly' ? activeMonth : null
        });
      });
      var newTxs = ud.transactions.map(function (t) { return t.category === oldName ? Object.assign({}, t, { category: newName }) : t; });

      State.commitUserData(u, Object.assign({}, ud, { categories: newCats, transactions: newTxs }), {
        successMsg: 'Category updated for ' + activeMonthText + ' (' + (newMonthBudget > 0 ? inr(newMonthBudget) : 'No budget') + ').',
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
