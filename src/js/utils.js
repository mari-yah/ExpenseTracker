// Formatting and small helpers with no dependencies on app state.

export function pad(n) { return String(n).padStart(2, '0'); }

export const today = new Date();
export const todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

export function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

export function inr(n) {
  var v = Number(n) || 0;
  return v.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

export function monthKey(dateStr) { return (dateStr || '').slice(0, 7); }

export function monthLabel(key) {
  if (!key) return '';
  var parts = key.split('-'), y = Number(parts[0]), m = Number(parts[1]);
  var d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function formatDate(d) {
  if (!d) return '—';
  var dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function initials(name) {
  name = (name || '').trim();
  if (!name) return '?';
  return name.slice(0, 2).toUpperCase();
}

var ICON_PATHS = {
  dashboard: '<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-width="2" stroke-linecap="round"/>',
  bank: '<path d="M3 21h18M4 10h16M12 3 3 8h18L12 3ZM5 10v8M9 10v8M15 10v8M19 10v8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  tag: '<path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="7" r="1.4"/>',
  user: '<circle cx="12" cy="8" r="4" stroke-width="1.8"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" stroke-width="1.8" stroke-linecap="round"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  sun: '<circle cx="12" cy="12" r="4" stroke-width="1.8"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" stroke-width="1.8" stroke-linecap="round"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" stroke-width="1.8" stroke-linejoin="round"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M20 6L9 17l-5-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
};
var FILL_ICONS = { dashboard: 1, tag: 1 };

export function icon(name) {
  var fill = FILL_ICONS[name] ? 'currentColor' : 'none';
  return '<svg viewBox="0 0 24 24" fill="' + fill + '" stroke="currentColor">' + (ICON_PATHS[name] || '') + '</svg>';
}
