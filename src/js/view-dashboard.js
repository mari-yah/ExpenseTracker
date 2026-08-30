import { escapeHtml, inr, monthLabel } from './utils.js';
import * as State from './state.js';

export function renderDashboard(main, ui, render, u) {
  var ud = State.currentUserData();
  var months = State.allMonthKeys(ud.transactions);
  var monthOptions = months.map(function (k) {
    return '<option value="' + k + '" ' + (k === ui.dashMonth ? 'selected' : '') + '>' + monthLabel(k) + '</option>';
  }).join('');
  var acctOptions = '<option value="all">All accounts</option>' + ud.accounts.map(function (a) {
    return '<option value="' + a.id + '" ' + (a.id === ui.dashAccount ? 'selected' : '') + '>' + escapeHtml(a.name) + '</option>';
  }).join('');

  var monthTx = ud.transactions.filter(function (t) { return t.date.slice(0, 7) === ui.dashMonth; });
  var scopedTx = ui.dashAccount === 'all' ? monthTx : monthTx.filter(function (t) {
    return t.accountId === ui.dashAccount || t.fromAccountId === ui.dashAccount || t.toAccountId === ui.dashAccount;
  });

  var income = scopedTx.filter(function (t) { return t.type === 'Income'; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
  var expense = scopedTx.filter(function (t) { return t.type === 'Expense'; }).reduce(function (s, t) { return s + Number(t.amount || 0); }, 0);
  var net = income - expense;

  var spendByCat = {};
  scopedTx.filter(function (t) { return t.type === 'Expense'; }).forEach(function (t) {
    var key = t.category || 'Uncategorized';
    spendByCat[key] = (spendByCat[key] || 0) + Number(t.amount || 0);
  });
  var topCat = '—', topAmt = 0;
  Object.keys(spendByCat).forEach(function (k) { if (spendByCat[k] > topAmt) { topCat = k; topAmt = spendByCat[k]; } });

  var overCount = 0, warnCount = 0;
  var budgetRows = ud.categories.map(function (c) {
    var spent = spendByCat[c.name] || 0;
    var budget = Number(c.budget) || 0;
    var pct = budget > 0 ? spent / budget : 0;
    var status = 'ok';
    if (budget > 0 && pct >= 1) { status = 'over'; overCount++; }
    else if (budget > 0 && pct >= 0.8) { status = 'warn'; warnCount++; }
    return { name: c.name, budget: budget, spent: spent, pct: pct, status: status };
  });

  var bannerClass = 'ok', bannerText = 'All categories are within budget this month.';
  if (overCount > 0) { bannerClass = 'over'; bannerText = overCount + ' categor' + (overCount === 1 ? 'y is' : 'ies are') + ' over budget this month.'; }
  else if (warnCount > 0) { bannerClass = 'warn'; bannerText = warnCount + ' categor' + (warnCount === 1 ? 'y is' : 'ies are') + ' close to its limit (80%+ spent).'; }

  var chartCats = Object.keys(spendByCat).map(function (k) { return [k, spendByCat[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  var maxSpend = chartCats.length ? chartCats[0][1] : 0;

  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Dashboard</h1><div class="sub">Where your money stands, this month.</div></div></div>' +

    '<div class="accounts-row">' + ud.accounts.map(function (a) {
      var bal = State.accountBalance(a, ud.transactions);
      return '<div class="account-card"><div class="name">' + escapeHtml(a.name) + '</div>' +
        '<div class="bal num ' + (bal < 0 ? 'neg' : '') + '">' + inr(bal) + '</div>' +
        '<div class="meta">Opening balance ' + inr(a.opening) + '</div></div>';
    }).join('') + '</div>' +

    '<div class="toolbar">' +
    '<div class="field"><span class="field-label">Statement for</span><select id="monthSelect">' + monthOptions + '</select></div>' +
    '<div class="field"><span class="field-label">Account</span><select id="acctSelect">' + acctOptions + '</select></div>' +
    '</div>' +

    '<div class="alert-banner ' + bannerClass + '">' + bannerText + '</div>' +

    '<div class="stat-row">' +
    '<div class="stat-card income"><div class="lbl">Income</div><div class="val num">' + inr(income) + '</div></div>' +
    '<div class="stat-card expense"><div class="lbl">Expense</div><div class="val num">' + inr(expense) + '</div></div>' +
    '<div class="stat-card"><div class="lbl">Net</div><div class="val num">' + inr(net) + '</div></div>' +
    '<div class="stat-card top"><div class="lbl">Top category</div><div class="val">' + escapeHtml(topCat) + '</div></div>' +
    '</div>' +

    '<h2 class="section-title">Budget tracker</h2>' +
    '<div class="card">' + (budgetRows.length === 0 ? '<div class="empty-note">No categories yet — add one in the Categories tab.</div>' :
      budgetRows.map(function (r) {
        return '<div class="budget-row"><div><div class="cat-name">' + escapeHtml(r.name) + '</div>' +
          '<div class="amounts num">' + inr(r.spent) + ' of ' + inr(r.budget) + '</div></div>' +
          '<div class="bar-track"><div class="bar-fill ' + r.status + '" style="width:' + Math.min(r.pct * 100, 100) + '%"></div></div>' +
          '<div class="status-pill ' + r.status + '">' + (r.status === 'over' ? 'Over budget' : r.status === 'warn' ? 'Warning' : 'On track') + '</div></div>';
      }).join('')) + '</div>' +

    '<h2 class="section-title">Spend by category</h2>' +
    '<div class="card">' + (chartCats.length === 0 ? '<div class="empty-note">No expenses logged for this view yet.</div>' :
      '<div class="chart-bars">' + chartCats.map(function (c) {
        return '<div class="chart-row"><div class="name">' + escapeHtml(c[0]) + '</div>' +
          '<div class="track"><div class="fill" style="width:' + (maxSpend ? (c[1] / maxSpend * 100) : 0) + '%"></div></div>' +
          '<div class="amt num">' + inr(c[1]) + '</div></div>';
      }).join('') + '</div>') + '</div>'
  );

  document.getElementById('monthSelect').addEventListener('change', function (e) { ui.dashMonth = e.target.value; render(); });
  document.getElementById('acctSelect').addEventListener('change', function (e) { ui.dashAccount = e.target.value; render(); });
}
