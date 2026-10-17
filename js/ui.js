import { h } from './dom.js';
import { t } from './i18n.js';
import { ctx } from './ctx.js';
import { store } from './store.js';
import { verifyPin } from './crypto.js';

export function modal(...content) {
  const ov = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'modal-box' }, content));
  document.body.append(ov);
  return { el: ov, close: () => ov.remove() };
}

export function askPin() {
  return new Promise((resolve) => {
    const input = h('input', {
      class: 'input pin',
      type: 'password',
      inputMode: 'numeric',
      maxLength: 4,
      autocomplete: 'off',
      'aria-label': t('pin.label'),
    });
    const msg = h('p', { class: 'msg', role: 'status' });
    const ok = h(
      'button',
      {
        class: 'btn',
        type: 'button',
        onclick: async () => {
          if (await verifyPin(input.value, store.state.parent.pin)) {
            m.close();
            ctx.parentUntil = Date.now() + 5 * 60000;
            resolve(true);
          } else {
            msg.textContent = t('pin.wrong');
            input.value = '';
            input.focus();
          }
        },
      },
      t('common.ok')
    );
    const cancel = h('button', { class: 'btn secondary', type: 'button', onclick: () => { m.close(); resolve(false); } }, t('common.cancel'));
    const m = modal(h('h2', {}, t('pin.title')), input, msg, h('div', { class: 'row' }, ok, cancel));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ok.click();
      if (e.key === 'Escape') cancel.click();
    });
    input.focus();
  });
}

export async function ensureParent() {
  if (Date.now() < ctx.parentUntil) return true;
  return askPin();
}

export function confirmDialog(text, { typeWord = null } = {}) {
  return new Promise((resolve) => {
    const input = typeWord ? h('input', { class: 'input', type: 'text', autocomplete: 'off', 'aria-label': typeWord }) : null;
    const yes = h('button', { class: 'btn danger', type: 'button', onclick: () => {
      if (typeWord && input.value.trim().toUpperCase() !== typeWord.toUpperCase()) return input.focus();
      m.close();
      resolve(true);
    } }, t('common.yes'));
    const no = h('button', { class: 'btn secondary', type: 'button', onclick: () => { m.close(); resolve(false); } }, t('common.cancel'));
    const m = modal(h('p', {}, text), typeWord ? h('p', {}, t('common.typeToConfirm', { word: typeWord })) : null, input, h('div', { class: 'row' }, yes, no));
  });
}
