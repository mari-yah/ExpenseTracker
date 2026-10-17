// Toast + modal primitives shared by every view.
import { escapeHtml } from './utils.js';

var toastTimer = null;

export function toast(msg) {
  var root = document.getElementById('toast-root');
  root.innerHTML = '<div class="toast show" id="toastEl">' + escapeHtml(msg) + '</div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    var el = document.getElementById('toastEl');
    if (el) el.classList.remove('show');
  }, 2600);
}

export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

export function openModal(html) {
  document.getElementById('modal-root').innerHTML = '<div class="modal-overlay" id="modalOverlay">' + html + '</div>';
  document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}

/**
 * opts: { title, body (html-safe string), confirmLabel, danger, typeToConfirm, onConfirm }
 */
export function confirmModal(opts) {
  var needsTypedConfirm = !!opts.typeToConfirm;
  openModal(
    '<div class="modal ' + (opts.danger ? 'danger' : '') + '">' +
    '<h3>' + escapeHtml(opts.title) + '</h3>' +
    '<p>' + opts.body + '</p>' +
    (needsTypedConfirm ? '<div class="field"><span class="field-label">Type “' + escapeHtml(opts.typeToConfirm) + '” to confirm</span><input type="text" id="confirmTypedInput" autocomplete="off"></div>' : '') +
    '<div class="actions">' +
    '<button type="button" class="btn secondary" id="modalCancel">Cancel</button>' +
    '<button type="button" class="btn ' + (opts.danger ? 'danger' : '') + '" id="modalConfirm"' + (needsTypedConfirm ? ' disabled' : '') + '>' + escapeHtml(opts.confirmLabel || 'Confirm') + '</button>' +
    '</div>' +
    '</div>'
  );
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  var confirmBtn = document.getElementById('modalConfirm');
  if (needsTypedConfirm) {
    var typedInput = document.getElementById('confirmTypedInput');
    typedInput.addEventListener('input', function () {
      confirmBtn.disabled = typedInput.value !== opts.typeToConfirm;
    });
  }
  confirmBtn.addEventListener('click', function () {
    closeModal();
    opts.onConfirm();
  });
}

/**
 * Renders a dynamic multi-select filter pill group.
 * options: [{ value, label }]
 * selectedArr: array of selected option values ([] means "All")
 */
export function renderMultiFilterGroup(groupKey, title, options, selectedArr) {
  var sel = Array.isArray(selectedArr) ? selectedArr : [];
  var isAll = sel.length === 0;
  var countHtml = isAll
    ? '<span class="multi-filter-badge">All</span>'
    : '<span class="multi-filter-badge active">' + sel.length + ' selected</span>' +
      '<button type="button" class="multi-filter-clear" data-filter-group="' + escapeHtml(groupKey) + '" data-filter-val="__all__">Clear</button>';

  var chipsHtml = '<button type="button" class="filter-chip ' + (isAll ? 'active' : '') + '" data-filter-group="' + escapeHtml(groupKey) + '" data-filter-val="__all__">All</button>' +
    options.map(function (opt) {
      var active = sel.indexOf(opt.value) >= 0;
      return '<button type="button" class="filter-chip ' + (active ? 'active' : '') + '" data-filter-group="' + escapeHtml(groupKey) + '" data-filter-val="' + escapeHtml(opt.value) + '">' +
        (active ? '<span class="chip-check">✓</span>' : '') +
        escapeHtml(opt.label) +
      '</button>';
    }).join('');

  return '<div class="multi-filter-group" data-group="' + escapeHtml(groupKey) + '">' +
    '<div class="multi-filter-head">' +
      '<span class="field-label">' + escapeHtml(title) + '</span>' +
      '<div class="multi-filter-meta">' + countHtml + '</div>' +
    '</div>' +
    '<div class="multi-filter-chips">' + chipsHtml + '</div>' +
  '</div>';
}

export function bindMultiFilterGroups(container, onToggle) {
  if (!container) return;
  container.querySelectorAll('[data-filter-group]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.getAttribute('data-filter-group');
      var val = btn.getAttribute('data-filter-val');
      onToggle(group, val);
    });
  });
}

