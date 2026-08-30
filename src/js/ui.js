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
