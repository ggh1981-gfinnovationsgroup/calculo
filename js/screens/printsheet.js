import { h } from '../dom.js';
import { t } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { generateOps } from '../generator.js';
import { levelFor } from '../session.js';
import { dateKey } from '../rewards.js';
import { ensureParent } from '../ui.js';

export function printSheet(id) {
  const p = store.profile(id);
  if (!p) return go('#/');
  if (Date.now() >= ctx.parentUntil) {
    ensureParent().then((ok) => (ok ? ctx.rerender() : go('#/')));
    return h('div', { class: 'screen' });
  }
  const cfg = ctx.cfg;
  const dk = dateKey();
  const { level, oneDigit } = levelFor({ ...p, adaptive: false }, cfg);
  const ops = generateOps(cfg.levels, { level, oneDigit, seed: `${p.id}|${dk}|print`, count: cfg.app.print.count });
  const cols = cfg.app.print.columns;
  const rows = Math.ceil(ops.length / cols);
  // Orden por columnas: 1-20 en la primera, 21-40 en la segunda, etc.
  const cell = (n, withAnswer) => {
    const o = ops[n];
    return h('div', { class: 'cell' }, `${n + 1}) ${o.text} = `, withAnswer ? h('strong', {}, String(o.answer)) : h('span', { class: 'blank' }, '______'));
  };
  const grid = (withAnswer) => {
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const n = c * rows + r;
      if (n < ops.length) cells.push(cell(n, withAnswer));
    }
    return h('div', { class: 'sheet-grid', style: `grid-template-columns:repeat(${cols},1fr)` }, cells);
  };

  return h('div', { class: 'print-root' },
    h('div', { class: 'no-print row' },
      h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, `🖨 ${t('print.print')}`),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => go('#/parent') }, t('common.back')),
      h('p', { class: 'hint' }, t('print.hint'))),
    h('section', { class: 'sheet' }, h('h1', {}, `${t('print.title')} — ${dk}`), h('p', {}, p.nick), grid(false)),
    h('section', { class: 'sheet' }, h('h1', {}, `${t('print.answers')} — ${dk}`), h('p', {}, p.nick), grid(true)));
}
