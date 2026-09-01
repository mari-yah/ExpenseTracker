import { escapeHtml } from './utils.js';
import { randomHex, hashPassword } from './crypto.js';
import { toast, confirmModal } from './ui.js';
import * as State from './state.js';
import { parseImportCsv, applyImport } from './import.js';

export function renderProfile(main, ui, render, u) {
  var ud = State.currentUserData();
  var since = new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  main.insertAdjacentHTML('beforeend',
    '<div class="page-head"><div><h1>Profile</h1><div class="sub">Your account and data controls.</div></div></div>' +
    '<div class="profile-head"><div class="profile-avatar">' + initialsOf(u.username) + '</div>' +
    '<div><div class="uname">' + escapeHtml(u.username) + '</div><div class="since">Member since ' + since + '</div></div></div>' +

    '<div class="panel-block card">' +
    '<h3>Account & Data Export</h3>' +
    '<div class="btn-row" style="margin-top:12px;">' +
    '<button type="button" class="btn" id="openPwModalBtn">Change Password</button>' +
    '<button type="button" class="btn secondary" id="exportJson">Export JSON</button>' +
    '<button type="button" class="btn secondary" id="exportCsv">Export CSV</button>' +
    '</div>' +
    '</div>' +

    '<div class="panel-block card">' +
    '<h3>Import transactions</h3><div class="desc desktop-only">Bring in transactions from a CSV file. Accounts and categories are created automatically; duplicates are skipped safely.</div>' +
    (ui.importError ? '<div class="auth-error" style="margin-bottom:14px;">' + escapeHtml(ui.importError) + '</div>' : '') +
    (ui.importPreview ? importPreviewHtml(ui.importPreview) :
      '<input type="file" id="importFile" accept=".csv,text/csv" style="margin-top:8px;">') +
    '</div>' +

    '<div class="panel-block security-note desktop-only">' +
    'This login is a personal privacy layer for a shared page — there is no server behind it. Don’t reuse a sensitive password here.' +
    '</div>' +

    '<div class="panel-block danger-zone">' +
    '<h3>Danger zone</h3>' +
    '<div class="btn-row" style="margin-top:12px;">' +
    '<button type="button" class="btn danger" id="clearDataBtn">Clear all my data</button>' +
    '<button type="button" class="btn danger" id="deleteAcctBtn">Delete my account</button>' +
    '</div>' +
    '</div>'
  );

  document.getElementById('openPwModalBtn').addEventListener('click', function () {
    openPasswordModal(u);
  });

  document.getElementById('exportJson').addEventListener('click', function () { exportData('json', u, ud); });
  document.getElementById('exportCsv').addEventListener('click', function () { exportData('csv', u, ud); });

  var importFile = document.getElementById('importFile');
  if (importFile) {
    importFile.addEventListener('change', function () {
      var file = importFile.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        ui.importError = '';
        var result = parseImportCsv(String(reader.result), ud);
        if (result.error) { ui.importError = result.error; render(); return; }
        ui.importPreview = result;
        render();
      };
      reader.onerror = function () { ui.importError = 'Could not read that file.'; render(); };
      reader.readAsText(file);
    });
  }

  var importCancel = document.getElementById('importCancel');
  if (importCancel) importCancel.addEventListener('click', function () { ui.importPreview = null; render(); });

  var importConfirm = document.getElementById('importConfirm');
  if (importConfirm) {
    importConfirm.addEventListener('click', function () {
      var preview = ui.importPreview;
      var merged = applyImport(ud, preview);
      State.commitUserData(u, merged, {
        successMsg: 'Imported ' + preview.transactions.length + ' transaction' + (preview.transactions.length === 1 ? '' : 's') + '.',
        onSuccess: function () { ui.importPreview = null; }
      });
    });
  }

  document.getElementById('clearDataBtn').addEventListener('click', function () {
    confirmModal({
      title: 'Clear all your data?',
      body: 'This permanently deletes every account, category and transaction on your login (' + escapeHtml(u.username) + '). You will stay logged in, starting from a clean slate. This cannot be undone.',
      confirmLabel: 'Clear my data', danger: true,
      onConfirm: function () {
        var newState = Object.assign({}, State.state, { data: Object.assign({}, State.state.data) });
        newState.data[u.id] = State.freshUserData();
        State.saveState(newState, { successMsg: 'Your data has been cleared.' });
      }
    });
  });

  document.getElementById('deleteAcctBtn').addEventListener('click', function () {
    confirmModal({
      title: 'Delete your account?',
      body: 'This permanently deletes the login “' + escapeHtml(u.username) + '” and everything in it — accounts, categories and transactions. This cannot be undone.',
      confirmLabel: 'Delete my account', danger: true,
      typeToConfirm: u.username,
      onConfirm: function () {
        var newUsers = State.state.users.filter(function (usr) { return usr.id !== u.id; });
        var newData = Object.assign({}, State.state.data);
        delete newData[u.id];
        var newState = { users: newUsers, data: newData };
        State.setSession(null);
        ui.authMode = null;
        State.saveState(newState, { successMsg: 'Your account has been deleted.' });
      }
    });
  });
}

function importPreviewHtml(preview) {
  var errorNote = preview.rowErrors.length
    ? '<div class="alert-banner warn multiline" style="margin-top:12px;">' + preview.rowErrors.length + ' row' + (preview.rowErrors.length === 1 ? '' : 's') + " couldn't be read and " + (preview.rowErrors.length === 1 ? 'was' : 'were') + ' skipped:<br>' +
      preview.rowErrors.slice(0, 8).map(function (e) { return escapeHtml(e); }).join('<br>') +
      (preview.rowErrors.length > 8 ? '<br>…and ' + (preview.rowErrors.length - 8) + ' more.' : '') +
      '</div>'
    : '';
  return '<div class="import-preview">' +
    '<p>Read <strong>' + preview.totalRows + '</strong> row' + (preview.totalRows === 1 ? '' : 's') + ' — ' +
    '<strong>' + preview.transactions.length + '</strong> ready to import' +
    (preview.duplicates ? ', ' + preview.duplicates + ' skipped as already in your ledger' : '') + '.</p>' +
    (preview.newAccounts.length ? '<p>New accounts to create: ' + preview.newAccounts.map(function (a) { return escapeHtml(a.name); }).join(', ') + '</p>' : '') +
    (preview.newCategories.length ? '<p>New categories to create: ' + preview.newCategories.map(function (c) { return escapeHtml(c.name); }).join(', ') + '</p>' : '') +
    errorNote +
    '<div class="btn-row" style="margin-top:14px;">' +
    '<button type="button" class="btn secondary" id="importCancel">Cancel</button>' +
    '<button type="button" class="btn" id="importConfirm"' + (preview.transactions.length === 0 ? ' disabled' : '') + '>Import ' + preview.transactions.length + ' transaction' + (preview.transactions.length === 1 ? '' : 's') + '</button>' +
    '</div>' +
    '</div>';
}

function initialsOf(name) {
  name = (name || '').trim();
  return name ? name.slice(0, 2).toUpperCase() : '?';
}

function exportData(kind, u, ud) {
  State.getDownloads().then(function (downloads) {
    if (!downloads) { toast('Downloads are not available in this view.'); return; }
    if (kind === 'json') {
      var payload = {
        username: u.username, exportedAt: new Date().toISOString(),
        accounts: ud.accounts, categories: ud.categories, transactions: ud.transactions
      };
      downloads.save({ filename: 'ledger-' + u.usernameLower + '.json', data: JSON.stringify(payload, null, 2) })
        .then(function () { toast('Export saved.'); }).catch(handleDownloadError);
    } else {
      var rows = [['Date', 'Type', 'Account', 'To Account', 'Category', 'Mode', 'Description', 'Amount']];
      ud.transactions.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (t) {
        rows.push([
          t.date, t.type,
          t.type === 'Transfer' ? State.accountName(ud.accounts, t.fromAccountId) : State.accountName(ud.accounts, t.accountId),
          t.type === 'Transfer' ? State.accountName(ud.accounts, t.toAccountId) : '',
          t.category || '', t.mode || '', t.desc || '', t.amount
        ]);
      });
      var csv = rows.map(function (r) {
        return r.map(function (v) {
          var s = String(v == null ? '' : v);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
      }).join('\n');
      downloads.save({ filename: 'ledger-' + u.usernameLower + '-transactions.csv', data: csv })
        .then(function () { toast('Export saved.'); }).catch(handleDownloadError);
    }
  });
}

function handleDownloadError(err) {
  if (err && err.code === 'declined') return;
  toast('Could not prepare that download.');
}

function openPasswordModal(u) {
  var root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML =
    '<div class="modal-overlay">' +
    '<div class="modal">' +
    '<h3>Change Password</h3>' +
    '<div id="modalErr" class="auth-error" style="margin-bottom:12px;" hidden></div>' +
    '<form id="pwModalForm" style="display:flex; flex-direction:column; gap:12px;">' +
    '<div class="field"><span class="field-label">Current password</span><input type="password" name="current" required></div>' +
    '<div class="field"><span class="field-label">New password</span><input type="password" name="next" required minlength="6"></div>' +
    '<div class="field"><span class="field-label">Confirm new password</span><input type="password" name="confirm" required minlength="6"></div>' +
    '<div class="actions">' +
    '<button type="button" class="btn secondary" id="closePwModal">Cancel</button>' +
    '<button type="submit" class="btn">Update Password</button>' +
    '</div>' +
    '</form>' +
    '</div>' +
    '</div>';

  function close() { root.innerHTML = ''; }
  document.getElementById('closePwModal').addEventListener('click', close);

  document.getElementById('pwModalForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var errEl = document.getElementById('modalErr');
    errEl.hidden = true;
    var fd = new FormData(e.target);
    var current = fd.get('current'), next = fd.get('next'), confirm = fd.get('confirm');

    hashPassword(current, u.salt).then(function (hash) {
      if (hash !== u.passwordHash) { errEl.textContent = 'Current password is incorrect.'; errEl.hidden = false; return; }
      if (next.length < 6) { errEl.textContent = 'New password must be at least 6 characters.'; errEl.hidden = false; return; }
      if (next !== confirm) { errEl.textContent = 'New passwords do not match.'; errEl.hidden = false; return; }

      var newSalt = randomHex(16);
      hashPassword(next, newSalt).then(function (newHash) {
        var newUsers = State.state.users.map(function (usr) { return usr.id === u.id ? Object.assign({}, usr, { passwordHash: newHash, salt: newSalt }) : usr; });
        var newState = Object.assign({}, State.state, { users: newUsers });
        State.saveState(newState, {
          successMsg: 'Password updated.',
          onSuccess: function () { close(); }
        });
      });
    });
  });
}
