import { escapeHtml, uid, icon } from './utils.js';
import { randomHex, hashPassword } from './crypto.js';
import * as State from './state.js';
import * as Theme from './theme.js';

export function renderAuth(root, ui, render) {
  var hasUsers = State.state.users.length > 0;
  if (!ui.authMode) ui.authMode = hasUsers ? 'login' : 'signup';
  var mode = ui.authMode;

  root.innerHTML =
    '<div class="auth-wrap">' +
    '<button type="button" class="theme-toggle auth-theme-toggle themeToggleBtn" aria-label="Toggle dark mode" title="Toggle dark mode">' + icon(Theme.isDarkActive() ? 'sun' : 'moon') + '</button>' +
    '<div class="auth-card">' +
    '<div class="auth-brand"><div class="brand-mark">HL</div></div>' +
    '<h1>Household Ledger</h1>' +
    '<div class="tagline">Your personal income &amp; expense tracker</div>' +
    '<div class="auth-tabs">' +
    '<button type="button" data-mode="login" class="' + (mode === 'login' ? 'active' : '') + '">Log in</button>' +
    '<button type="button" data-mode="signup" class="' + (mode === 'signup' ? 'active' : '') + '">Sign up</button>' +
    '</div>' +
    (ui.authError ? '<div class="auth-error">' + escapeHtml(ui.authError) + '</div>' : '') +
    (mode === 'login' ? loginFormHtml() : signupFormHtml()) +
    '<div class="auth-note">' + (hasUsers
      ? 'Each person who uses this ledger keeps their own login and their own private set of transactions.'
      : 'No one has set up an account here yet — create the first one to get started.') + '</div>' +
    '</div></div>';

  root.querySelectorAll('.auth-tabs button').forEach(function (b) {
    b.addEventListener('click', function () { ui.authMode = b.dataset.mode; ui.authError = ''; render(); });
  });
  root.querySelectorAll('.themeToggleBtn').forEach(function (b) {
    b.addEventListener('click', function () { Theme.toggleTheme(); render(); });
  });
  if (mode === 'login') wireLoginForm(ui, render); else wireSignupForm(ui, render);
}

function loginFormHtml() {
  return '<form id="loginForm">' +
    '<div class="field"><span class="field-label">Username</span><input type="text" name="username" autocomplete="username" required></div>' +
    '<div class="field"><span class="field-label">Password</span><input type="password" name="password" autocomplete="current-password" required></div>' +
    '<button type="submit" class="btn" style="justify-content:center;">Log in</button>' +
    '</form>';
}

function wireLoginForm(ui, render) {
  var f = document.getElementById('loginForm');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(f);
    var username = (fd.get('username') || '').trim();
    var password = fd.get('password') || '';
    var u = State.state.users.find(function (u) { return u.usernameLower === username.toLowerCase(); });
    if (!u) { ui.authError = 'No account with that username.'; render(); return; }
    hashPassword(password, u.salt).then(function (hash) {
      if (hash !== u.passwordHash) { ui.authError = 'Incorrect password.'; render(); return; }
      State.setSession(u.id);
      ui.authError = ''; ui.tab = 'dashboard';
      render();
    });
  });
}

function signupFormHtml() {
  return '<form id="signupForm">' +
    '<div class="field"><span class="field-label">Choose a username</span><input type="text" name="username" autocomplete="username" required minlength="3" maxlength="24"></div>' +
    '<div class="field"><span class="field-label">Choose a password</span><input type="password" name="password" autocomplete="new-password" required minlength="6"></div>' +
    '<div class="field"><span class="field-label">Confirm password</span><input type="password" name="confirm" autocomplete="new-password" required minlength="6"></div>' +
    '<button type="submit" class="btn" style="justify-content:center;">Create account</button>' +
    '</form>';
}

function wireSignupForm(ui, render) {
  var f = document.getElementById('signupForm');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(f);
    var username = (fd.get('username') || '').trim();
    var password = fd.get('password') || '';
    var confirm = fd.get('confirm') || '';
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      ui.authError = 'Usernames can only use letters, numbers and underscores (3–24 characters).'; render(); return;
    }
    if (State.state.users.some(function (u) { return u.usernameLower === username.toLowerCase(); })) {
      ui.authError = 'That username is already taken.'; render(); return;
    }
    if (password.length < 6) { ui.authError = 'Password must be at least 6 characters.'; render(); return; }
    if (password !== confirm) { ui.authError = 'Passwords do not match.'; render(); return; }

    var salt = randomHex(16);
    hashPassword(password, salt).then(function (hash) {
      var newUser = {
        id: uid('usr'),
        username: username, usernameLower: username.toLowerCase(),
        passwordHash: hash, salt: salt, createdAt: Date.now()
      };
      var newState = { users: State.state.users.concat([newUser]), data: Object.assign({}, State.state.data) };
      newState.data[newUser.id] = State.freshUserData();
      State.setSession(newUser.id);
      State.saveState(newState, { successMsg: 'Account created. Welcome!' });
    });
  });
}
