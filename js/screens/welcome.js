import { h } from '../dom.js';
import { t, languages, detectLang, setLang } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { frame } from '../layout.js';
import { hashPin } from '../crypto.js';

let step = 'lang';

const show = (s) => {
  step = s;
  ctx.rerender();
};

function langStep() {
  const suggested = detectLang();
  return h(
    'div',
    { class: 'stack center' },
    h('div', { class: 'hero' }, '🧮'),
    h('h1', {}, t('welcome.title')),
    h('p', {}, t('welcome.subtitle')),
    h('h2', {}, t('welcome.chooseLang')),
    languages().map((l) =>
      h(
        'button',
        {
          class: 'btn big',
          type: 'button',
          onclick: () => {
            store.state.lang = l.code;
            setLang(l.code);
            store.commit();
            show(ctx.provider.configured() ? 'choice' : 'parent');
          },
        },
        l.name,
        l.code === suggested ? ` ★ ${t('welcome.suggested')}` : ''
      )
    ),
    h('a', { href: '#/install' }, t('install.link'))
  );
}

function choiceStep() {
  return h(
    'div',
    { class: 'stack center' },
    h('button', { class: 'btn big', type: 'button', onclick: () => show('parent') }, t('welcome.newFamily')),
    h('button', { class: 'btn big secondary', type: 'button', onclick: () => show('code') }, t('welcome.haveCode'))
  );
}

function codeStep() {
  const input = h('input', { class: 'input', type: 'text', autocomplete: 'off', placeholder: 'XXXX-XXXX-XXXX-XXXX', 'aria-label': t('welcome.codeLabel') });
  const msg = h('p', { class: 'msg', role: 'status' });
  const btn = h('button', {
    class: 'btn big',
    type: 'button',
    onclick: async () => {
      btn.disabled = true;
      msg.textContent = '…';
      try {
        await ctx.provider.join(input.value);
        go('#/');
        ctx.rerender();
      } catch (e) {
        msg.textContent = t(e.message === 'invalid' ? 'welcome.codeInvalid' : e.message === 'notfound' ? 'welcome.notFound' : 'welcome.syncError');
        btn.disabled = false;
      }
    },
  }, t('welcome.join'));
  return h('div', { class: 'stack' }, h('label', { for: 'code' }, t('welcome.codeLabel')), input, msg, btn,
    h('button', { class: 'btn secondary', type: 'button', onclick: () => show('choice') }, t('common.back')));
}

function parentStep() {
  const pin = h('input', { class: 'input pin', type: 'password', inputMode: 'numeric', maxLength: 4, autocomplete: 'new-password', id: 'pin1' });
  const pin2 = h('input', { class: 'input pin', type: 'password', inputMode: 'numeric', maxLength: 4, autocomplete: 'new-password', id: 'pin2' });
  const consent = h('input', { type: 'checkbox', id: 'consent' });
  const msg = h('p', { class: 'msg', role: 'alert' });
  const go2 = h('button', {
    class: 'btn big',
    type: 'button',
    onclick: async () => {
      if (!/^\d{4}$/.test(pin.value) || pin.value !== pin2.value) return void (msg.textContent = t('parent.setup.pinError'));
      if (!consent.checked) return void (msg.textContent = t('parent.setup.consentError'));
      store.state.parent.pin = await hashPin(pin.value);
      store.state.parent.consent = { at: new Date().toISOString(), version: 1 };
      ctx.parentUntil = Date.now() + 5 * 60000;
      await store.flush();
      go('#/new');
      ctx.rerender();
    },
  }, t('parent.setup.continue'));
  return h(
    'div',
    { class: 'stack' },
    h('h1', {}, t('parent.setup.title')),
    h('p', {}, t('parent.setup.intro')),
    h('label', { for: 'pin1' }, t('parent.setup.pin')), pin,
    h('label', { for: 'pin2' }, t('parent.setup.pin2')), pin2,
    h('p', { class: 'hint' }, t('parent.setup.pinHint')),
    h('label', { class: 'check' }, consent, h('span', {}, t('parent.setup.consent'), ' ', h('a', { href: '#/privacy' }, t('parent.setup.privacyLink')))),
    msg,
    go2
  );
}

export function welcome() {
  const body = step === 'lang' ? langStep() : step === 'choice' ? choiceStep() : step === 'code' ? codeStep() : parentStep();
  return frame(body, { hideLang: true });
}

export const resetWelcome = () => {
  step = 'lang';
};
