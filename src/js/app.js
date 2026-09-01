// App entry point: owns the shared `ui` state, the shell (sidebar/topbar/
// bottom nav), and dispatches to the tab-specific view modules. Each view
// is its own small file — see js/view-*.js — kept independent of one
// another and wired together only here.
import { escapeHtml, initials, icon, pad, today } from './utils.js';
import * as State from './state.js';
import * as Theme from './theme.js';
import { renderAuth } from './view-auth.js';
import { renderDashboard } from './view-dashboard.js';
import { renderTransactions } from './view-transactions.js';
import { renderAccounts } from './view-accounts.js';
import { renderCategories } from './view-categories.js';
import { renderProfile } from './view-profile.js';

var ui = {
  authMode: null,
  authError: '',
  tab: 'dashboard',
  dashMonth: today.getFullYear() + '-' + pad(today.getMonth() + 1),
  dashAccount: 'all',
  editingTxId: null,
  txMonthFilter: 'all',
  txAccountFilter: 'all',
  profileError: '',
  profileNotice: '',
  importPreview: null,
  importError: ''
};

var root = document.getElementById('app');

function render() {
  var u = State.currentUser();
  if (!u) { renderAuth(root, ui, render); return; }
  renderShell(u);
}

function themeToggleHtml() {
  var isDark = Theme.isDarkActive();
  return '<button type="button" class="theme-toggle-icon themeToggleBtn" aria-label="Toggle theme" title="Toggle dark/light mode">' +
    icon(isDark ? 'sun' : 'moon') +
    '</button>';
}

function wireThemeToggles() {
  root.querySelectorAll('.themeToggleBtn').forEach(function (b) {
    b.addEventListener('click', function () { Theme.toggleTheme(); render(); });
  });
}

var NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'transactions', label: 'Transactions', icon: 'list' },
  { id: 'accounts', label: 'Accounts', icon: 'bank' },
  { id: 'categories', label: 'Categories', icon: 'tag' },
  { id: 'profile', label: 'Profile', icon: 'user' }
];

function renderShell(u) {
  root.innerHTML =
    '<div class="shell">' +
    '<div class="sidebar">' +
    '<div class="brand"><div class="brand-mark">HL</div><div class="brand-name">Ledger</div></div>' +
    NAV_ITEMS.map(function (n) {
      return '<button type="button" class="nav-item ' + (ui.tab === n.id ? 'active' : '') + '" data-tab="' + n.id + '">' +
        icon(n.icon) + '<span class="lbl">' + n.label + '</span></button>';
    }).join('') +
    '<div class="sidebar-foot">' +
    '<div class="sidebar-foot-row-single">' +
    '<button type="button" class="user-chip gotoProfile"><span class="avatar">' + initials(u.username) + '</span><span class="uname">' + escapeHtml(u.username) + '</span></button>' +
    '<div class="sidebar-foot-actions">' +
    themeToggleHtml() +
    '<button type="button" class="logout-btn logoutBtn" title="Log out">' + icon('logout') + '</button>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="mobile-topbar">' +
    '<div class="brand"><div class="brand-mark">HL</div><div class="brand-name">Ledger</div></div>' +
    '<div class="right">' +
    themeToggleHtml() +
    '<button type="button" class="user-chip gotoProfile"><span class="avatar">' + initials(u.username) + '</span><span class="uname">' + escapeHtml(u.username) + '</span></button>' +
    '<button type="button" class="logout-btn logoutBtn" title="Log out">' + icon('logout') + '</button>' +
    '</div>' +
    '</div>' +
    '<div class="main" id="mainArea"></div>' +
    '<div class="bottom-nav">' +
    NAV_ITEMS.map(function (n) {
      return '<button type="button" class="bn-item ' + (ui.tab === n.id ? 'active' : '') + '" data-tab="' + n.id + '">' +
        icon(n.icon) + '<span>' + n.label + '</span></button>';
    }).join('') +
    '</div>' +
    '</div>';

  root.querySelectorAll('.nav-item, .bn-item').forEach(function (b) {
    b.addEventListener('click', function () { ui.tab = b.dataset.tab; ui.editingTxId = null; render(); });
  });
  root.querySelectorAll('.gotoProfile').forEach(function (b) {
    b.addEventListener('click', function () { ui.tab = 'profile'; render(); });
  });
  root.querySelectorAll('.logoutBtn').forEach(function (b) {
    b.addEventListener('click', function () { State.setSession(null); ui.tab = 'dashboard'; ui.authMode = null; render(); });
  });
  wireThemeToggles();

  var main = document.getElementById('mainArea');
  if (ui.tab === 'dashboard') renderDashboard(main, ui, render, u);
  else if (ui.tab === 'transactions') renderTransactions(main, ui, render, u);
  else if (ui.tab === 'accounts') renderAccounts(main, ui, render, u);
  else if (ui.tab === 'categories') renderCategories(main, ui, render, u);
  else renderProfile(main, ui, render, u);
}

Theme.initTheme();
State.setRenderCallback(render);
State.loadInitialState().then(render);
