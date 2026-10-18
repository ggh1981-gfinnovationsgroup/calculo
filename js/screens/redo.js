import { h } from '../dom.js';
import { t, setLang, otherLang } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { frame } from '../layout.js';

export function redo(id) {
  const p = store.profile(id);
  if (!p) return go('#/');
  setLang(p.bilingual ? otherLang(p.lang) : p.lang);
  const ops = (ctx.lastResult[id]?.log || []).filter((x) => !x.ok);
  if (!ops.length) return go(`#/end/${id}`);
  let i = 0;
  const box = h('div', { class: 'stack center' });

  const draw = () => {
    if (i >= ops.length) {
      box.replaceChildren(h('h1', {}, `🎉 ${t('end.redoDone')}`),
        h('button', { class: 'btn', type: 'button', onclick: () => go(`#/end/${id}`) }, t('end.back')));
      return;
    }
    const op = ops[i];
    const input = h('input', { class: 'answer', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': t('practice.yourAnswer') });
    const fb = h('div', { class: 'feedback', role: 'status' });
    const btn = h('button', { class: 'btn big primary', type: 'button' }, t('practice.check'));
    let checked = false;
    const act = () => {
      if (checked) { i += 1; return draw(); }
      if (input.value.trim() === '') return;
      checked = true;
      const ok = Number(input.value) === op.answer;
      fb.className = `feedback ${ok ? 'good' : 'gentle'}`;
      fb.textContent = ok ? '✓' : t('practice.wrong', { answer: op.answer });
      btn.textContent = t('practice.next');
    };
    btn.onclick = act;
    input.onkeydown = (e) => e.key === 'Enter' && act();
    box.replaceChildren(h('h1', {}, t('end.redoTitle')), h('div', { class: 'op' }, `${op.text} = ?`), input, fb, btn);
    input.focus();
  };

  draw();
  return frame(box, { profile: p });
}
