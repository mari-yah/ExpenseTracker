// Password hashing helpers (Web Crypto). See profile.html's security note —
// this is a login gate for a shared page, not a substitute for a real backend.

export function randomHex(bytes) {
  var arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export function hashPassword(password, salt) {
  var enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode('ledger::' + salt + '::' + password)).then(function (buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  });
}
