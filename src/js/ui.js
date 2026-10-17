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

var activeOpenDropdownKey = null;
var activeDropdownScrollTop = 0;

if (typeof document !== 'undefined') {
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.multi-dd')) {
      activeOpenDropdownKey = null;
      activeDropdownScrollTop = 0;
      document.querySelectorAll('.multi-dd.open').forEach(function (el) {
        el.classList.remove('open');
      });
    }
  });
}

/**
 * Renders a compact multi-select dropdown field (.field) that fits inline in .filter-row.
 * options: [{ value, label }]
 * selectedArr: array of selected option values ([] means "All")
 */
export function renderMultiFilterGroup(groupKey, title, options, selectedArr) {
  var sel = Array.isArray(selectedArr) ? selectedArr : [];
  var isAll = sel.length === 0;
  var isOpen = activeOpenDropdownKey === groupKey;

  var summaryText = 'All ' + title;
  if (sel.length === 1) {
    var found = options.find(function (o) { return o.value === sel[0]; });
    summaryText = found ? found.label : sel[0];
  } else if (sel.length > 1) {
    summaryText = sel.length + ' selected';
  }

  var itemsHtml =
    '<button type="button" class="multi-dd-item all-opt ' + (isAll ? 'checked' : '') + '" data-filter-group="' + escapeHtml(groupKey) + '" data-filter-val="__all__">' +
      '<span class="multi-dd-check">' + (isAll ? '✓' : '') + '</span>' +
      '<span class="multi-dd-text">All ' + escapeHtml(title) + '</span>' +
    '</button>' +
    options.map(function (opt) {
      var active = sel.indexOf(opt.value) >= 0;
      return '<button type="button" class="multi-dd-item ' + (active ? 'checked' : '') + '" data-filter-group="' + escapeHtml(groupKey) + '" data-filter-val="' + escapeHtml(opt.value) + '">' +
        '<span class="multi-dd-check">' + (active ? '✓' : '') + '</span>' +
        '<span class="multi-dd-text">' + escapeHtml(opt.label) + '</span>' +
      '</button>';
    }).join('');

  return '<div class="field multi-dd-field">' +
    '<span class="field-label">' + escapeHtml(title) + '</span>' +
    '<div class="multi-dd ' + (isOpen ? 'open' : '') + '" data-dd-group="' + escapeHtml(groupKey) + '">' +
      '<button type="button" class="multi-dd-trigger ' + (!isAll ? 'has-selection' : '') + '" data-dd-toggle="' + escapeHtml(groupKey) + '">' +
        '<span class="multi-dd-summary">' + escapeHtml(summaryText) + '</span>' +
        '<span class="multi-dd-caret">▾</span>' +
      '</button>' +
      '<div class="multi-dd-menu">' +
        itemsHtml +
      '</div>' +
    '</div>' +
  '</div>';
}

export function bindMultiFilterGroups(container, onToggle) {
  if (!container) return;

  if (activeOpenDropdownKey) {
    var openEl = container.querySelector('.multi-dd[data-dd-group="' + activeOpenDropdownKey + '"] .multi-dd-menu');
    if (openEl && activeDropdownScrollTop) {
      openEl.scrollTop = activeDropdownScrollTop;
    }
  }

  container.querySelectorAll('[data-dd-toggle]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var group = trigger.getAttribute('data-dd-toggle');
      var wrapper = trigger.closest('.multi-dd');
      var wasOpen = wrapper.classList.contains('open');
      document.querySelectorAll('.multi-dd.open').forEach(function (el) {
        el.classList.remove('open');
      });
      if (wasOpen) {
        activeOpenDropdownKey = null;
        activeDropdownScrollTop = 0;
      } else {
        wrapper.classList.add('open');
        activeOpenDropdownKey = group;
        activeDropdownScrollTop = 0;
      }
    });
  });

  container.querySelectorAll('[data-filter-group]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var group = btn.getAttribute('data-filter-group');
      var val = btn.getAttribute('data-filter-val');
      var menu = btn.closest('.multi-dd-menu');
      activeOpenDropdownKey = group;
      activeDropdownScrollTop = menu ? menu.scrollTop : 0;
      onToggle(group, val);
    });
  });
}

