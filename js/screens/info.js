import { h } from '../dom.js';
import { t, raw } from '../i18n.js';
import { ctx } from '../ctx.js';
import { frame } from '../layout.js';

export function privacy() {
  return frame(
    h('div', { class: 'stack' },
      h('h1', {}, t('privacy.title')),
      h('p', { class: 'warn' }, t('privacy.draftNotice')),
      raw('privacy.sections').map((s) => h('section', {}, h('h2', {}, s.h), h('p', {}, s.p))),
      h('h1', {}, t('terms.title')),
      raw('terms.sections').map((s) => h('section', {}, h('h2', {}, s.h), h('p', {}, s.p)))),
    { back: '#/' }
  );
}

export function install() {
  const prompt = ctx.deferredInstall
    ? h('button', { class: 'btn big', type: 'button', onclick: async () => { ctx.deferredInstall.prompt(); await ctx.deferredInstall.userChoice; ctx.deferredInstall = null; ctx.rerender(); } }, t('install.button'))
    : null;
  return frame(
    h('div', { class: 'stack' },
      h('h1', {}, t('install.title')),
      prompt,
      h('section', { class: 'panel' }, h('h2', {}, '🍎 iPhone / iPad'), h('ol', {}, raw('install.ios').map((x) => h('li', {}, x)))),
      h('section', { class: 'panel' }, h('h2', {}, '🤖 Android'), h('ol', {}, raw('install.android').map((x) => h('li', {}, x)))),
      h('p', { class: 'hint' }, t('install.offline'))),
    { back: '#/' }
  );
}
