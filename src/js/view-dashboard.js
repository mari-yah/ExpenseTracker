import { escapeHtml, inr, todayStr, pad, today } from './utils.js';
import { MODES } from './constants.js';
import { renderMultiFilterGroup, bindMultiFilterGroups } from './ui.js';
import * as State from './state.js';

export function renderDashboard(main, ui, render, u) {
  var ud = State.currentUserData();
  var defaultStart = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-01';
  if (ui.dashDateFrom === undefined) ui.dashDateFrom = defaultStart;
  if (ui.dashDateTo === undefined) ui.dashDateTo = todayStr;

  ui.dashAccounts = State.normalizeMultiFilter(ui.dashAccounts);
  ui.dashCategories = State.normalizeMultiFilter(ui.dashCategories);
  ui.dashTypes = State.normalizeMultiFilter(ui.dashTypes);
  ui.dashModes = State.normalizeMultiFilter(ui.dashModes);

  var dynOpts = State.getDynamicFilterOptions(ud, MODES);
  var hasActiveMulti = Boolean(
    ui.dashAccounts.length > 0 ||
    ui.dashCategories.length > 0 ||
    ui.dashTypes.length > 0 ||
    ui.dashModes.length > 0
  );

  var scopedTx = ud.transactions.filter(function (t) {
    if (ui.dashDateFrom && t.date < ui.dashDateFrom) return false;
    if (ui.dashDateTo && t.date > ui.dashDateTo) return false;
    if (!State.matchesMultiAccount(t, ui.dashAccounts, ud.accounts)) return false;
    if (!State.matchesMultiValue(t.category, ui.dashCategories)) return false;
    if (!State.matchesMultiValue(t.type, ui.dashTypes)) return false;
    if (!State.matchesMultiValue(t.mode, ui.dashModes)) return false;
    return true;
  });

  var income = scopedTx.filter(function (t) { return t.type === 'Income'; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
  var expense = scopedTx.filter(function (t) { return t.type === 'Expense'; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
  var net = income - expense;

  var spendByCat = {};
  scopedTx.filter(function (t) { return t.type === 'Expense'; }).forEach(function (t) {
    var key = t.category || 'Uncategorized';
    spendByCat[key] = (spendByCat[key] || 0) + Number(t.amount || 0);
  });

  var activeMonthKey = (ui.dashDateFrom || ui.dashDateTo || todayStr).slice(0, 7);
  var activeCategories = State.categoriesForMonth(ud.categories, activeMonthKey).filter(function (c) {
    return State.matchesMultiValue(c.name, ui.dashCategories);
  });

  var overCount = 0, warnCount = 0;
  var budgetRows = activeCategories.map(function (c) {
    var spent = spendByCat[c.name] || 0;
    var budget = State.categoryBudget(c, activeMonthKey);
    var pct = budget > 0 ? spent / budget : 0;
    var status = 'ok';
    if (budget === 0) { status = 'unbudgeted'; }
    else if (spent > budget) { status = 'over'; overCount++; }
    else if (pct >= 0.85) { status = 'warn'; warnCount++; }
    return { name: c.name, budget: budget, spent: spent, pct: pct, status: status };
  });

  var bannerClass = 'ok', bannerText = 'All categories are within budget for this period.';
  if (overCount > 0) { bannerClass = 'over'; bannerText = overCount + ' categor' + (overCount === 1 ? 'y is' : 'ies are') + ' over budget in this period.'; }
  else if (warnCount > 0) { bannerClass = 'warn'; bannerText = warnCount + ' categor' + (warnCount === 1 ? 'y is' : 'ies are') + ' close to its limit (85%+ spent).'; }

  var chartCats = Object.keys(spendByCat).map(function (k) { return [k, spendByCat[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  var maxSpend = chartCats.length ? chartCats[0][1] : 0;

  var totalBudget = activeCategories.reduce(function (sum, c) {
    return sum + State.categoryBudget(c, activeMonthKey);
  }, 0);

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Dashboard</h1><div class="sub">Where your money stands across your accounts and custom date range.</div></div></div>' +

    '<div class="accounts-row">' + ud.accounts.map(function (a) {
      var accType = State.getAccountType(a);
      var bal = State.accountBalance(a, ud.transactions, ud.accounts);
      var typeBadge = accType === 'Credit Card' ? ' (CC Due)' : (accType === 'Cash' ? ' (Cash)' : '');
      return '<div class="account-card"><div class="name">' + escapeHtml(a.name + typeBadge) + '</div>' +
        '<div class="bal num ' + (bal < 0 ? 'neg' : '') + '">' + inr(bal) + '</div></div>';
    }).join('') + '</div>' +

    '<div class="card filter-panel" style="margin-bottom:20px; padding:14px 18px;">' +
      '<div class="filter-row" id="dashMultiFilters" style="margin-bottom:0;">' +
        '<div class="field"><span class="field-label">From Date</span><input type="date" id="dashDateFrom" max="' + todayStr + '" value="' + escapeHtml(ui.dashDateFrom) + '"></div>' +
        '<div class="field"><span class="field-label">To Date</span><input type="date" id="dashDateTo" max="' + todayStr + '" value="' + escapeHtml(ui.dashDateTo) + '"></div>' +
        renderMultiFilterGroup('dash_account', 'Accounts', dynOpts.accounts, ui.dashAccounts) +
        renderMultiFilterGroup('dash_category', 'Categories', dynOpts.categories, ui.dashCategories) +
        renderMultiFilterGroup('dash_type', 'Types', dynOpts.types, ui.dashTypes) +
        renderMultiFilterGroup('dash_mode', 'Modes', dynOpts.modes, ui.dashModes) +
        '<div class="field" style="align-self:flex-end; display:flex; gap:8px; flex-direction:row; flex-wrap:wrap;">' +
          ((ui.dashDateFrom !== defaultStart || ui.dashDateTo !== todayStr || hasActiveMulti)
            ? '<button type="button" class="btn secondary sm" id="resetDashPeriod">This Month</button>'
            : '') +
          ((ui.dashDateFrom || ui.dashDateTo)
            ? '<button type="button" class="btn secondary sm" id="allTimeDashPeriod">All Dates</button>'
            : '') +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="alert-banner ' + bannerClass + '">' + bannerText + '</div>' +

    '<div class="stat-row">' +
    '<div class="stat-card income"><div class="lbl">Income</div><div class="val num">' + inr(income) + '</div></div>' +
    '<div class="stat-card"><div class="lbl">Budget</div><div class="val num">' + inr(totalBudget) + '</div></div>' +
    '<div class="stat-card expense"><div class="lbl">Expense</div><div class="val num">' + inr(expense) + '</div></div>' +
    '<div class="stat-card"><div class="lbl">Savings</div><div class="val num">' + inr(net) + '</div></div>' +
    '</div>' +

    '<h2 class="section-title">Budget tracker</h2>' +
    (function() {
      var activeBudgetRows = budgetRows.filter(function (r) { return r.spent > 0 || ui.dashCategories.indexOf(r.name) >= 0; });
      return '<div class="card">' + (activeBudgetRows.length === 0 ? '<div class="empty-note">No expenses logged for any category in this period.</div>' :
        activeBudgetRows.map(function (r) {
          var amtSub = r.budget > 0 ? (inr(r.spent) + ' of ' + inr(r.budget)) : (inr(r.spent) + ' (No budget)');
          return '<div class="budget-row"><div><div class="cat-name">' + escapeHtml(r.name) + '</div>' +
            '<div class="amounts num">' + amtSub + '</div></div>' +
            '<div class="bar-track"><div class="bar-fill ' + r.status + '" style="width:' + Math.min(r.pct * 100, 100) + '%"></div></div>' +
            '<div class="status-pill ' + r.status + '">' + (r.status === 'unbudgeted' ? 'No budget' : (r.status === 'over' ? 'Over budget' : r.status === 'warn' ? 'Warning' : 'On track')) + '</div></div>';
        }).join('')) + '</div>';
    })() +

    '<h2 class="section-title">Spend by category</h2>' +
    '<div class="card">' + (chartCats.length === 0 ? '<div class="empty-note">No expenses logged for this view yet.</div>' :
      '<div class="chart-bars">' + chartCats.map(function (c) {
        return '<div class="chart-row"><div class="name">' + escapeHtml(c[0]) + '</div>' +
          '<div class="track"><div class="fill" style="width:' + (maxSpend ? (c[1] / maxSpend * 100) : 0) + '%"></div></div>' +
          '<div class="amt num">' + inr(c[1]) + '</div></div>';
      }).join('') + '</div>') + '</div>'
  );

  document.getElementById('dashDateFrom').addEventListener('change', function (e) { ui.dashDateFrom = e.target.value; render(); });
  document.getElementById('dashDateTo').addEventListener('change', function (e) { ui.dashDateTo = e.target.value; render(); });

  bindMultiFilterGroups(document.getElementById('dashMultiFilters'), function (group, val) {
    if (group === 'dash_account') ui.dashAccounts = State.toggleMultiFilter(ui.dashAccounts, val);
    else if (group === 'dash_type') ui.dashTypes = State.toggleMultiFilter(ui.dashTypes, val);
    else if (group === 'dash_mode') ui.dashModes = State.toggleMultiFilter(ui.dashModes, val);
    else if (group === 'dash_category') ui.dashCategories = State.toggleMultiFilter(ui.dashCategories, val);
    render();
  });

  var resetBtn = document.getElementById('resetDashPeriod');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      ui.dashDateFrom = defaultStart;
      ui.dashDateTo = todayStr;
      ui.dashAccounts = [];
      ui.dashCategories = [];
      ui.dashTypes = [];
      ui.dashModes = [];
      render();
    });
  }
  var allTimeBtn = document.getElementById('allTimeDashPeriod');
  if (allTimeBtn) {
    allTimeBtn.addEventListener('click', function () {
      ui.dashDateFrom = '';
      ui.dashDateTo = '';
      render();
    });
  }
}

