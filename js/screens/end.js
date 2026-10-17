import { h } from '../dom.js';
import { t, setLang, otherLang } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { frame, mascot } from '../layout.js';
import { dateKey, canOpenChest, openChest, dayTotals, currentStreak } from '../rewards.js';
import { confetti } from '../../gift/gift.js';
import { play } from '../sounds.js';

export function endScreen(id) {
  const p = store.profile(id);
  if (!p) return go('#/');
  setLang(p.bilingual ? otherLang(p.lang) : p.lang);
  const dk = dateKey();
  const res = ctx.lastResult[id];
  const totals = dayTotals(p.history[dk]);
  const box = h('div', { class: 'stack center' });

  const draw = () => {
    const done = !!p.history[dk]?.completed;
    const lines = [];
    lines.push(h('h1', {}, done ? `🎉 ${t('end.title')}` : t('end.titleExtra')));
    lines.push(mascot(p, { size: 'lg' }));
    if (res && res.coins > 0) {
      lines.push(h('div', { class: 'panel' },
        h('strong', {}, t('end.coins', { n: res.coins })),
        h('ul', { class: 'plain' }, res.breakdown.map((b) => h('li', {}, `+${b.coins} 🪙 ${t(`end.reason.${b.key}`)}`)))));
    }
    if (done) lines.push(h('p', {}, `🔥 ${t('end.streak', { n: currentStreak(p, dk) })}`));
    if (res?.graceUsed) lines.push(h('p', { class: 'hint' }, t('end.grace', { n: res.graceUsed })));
    for (const b of res?.newBadges || []) lines.push(h('div', { class: 'badge-new' }, `${ctx.cfg.badges.find((x) => x.id === b)?.emoji} ${t('end.newBadge')}: ${t(`badges.${b}.name`)}`));
    lines.push(h('p', {}, t('end.summary', { n: totals.answered, ok: totals.correct })));
    if (totals.wrong > 0) lines.push(h('p', { class: 'hint' }, t('end.review', { n: totals.wrong })));
    lines.push(h('p', { class: 'positive' }, t('end.positive')));
    if (canOpenChest(p, dk)) {
      lines.push(h('button', { class: 'btn big', type: 'button', onclick: open }, `🎁 ${t('end.chest')}`));
    } else if (p.chestDate === dk && chestResult) {
      lines.push(h('div', { class: 'panel' }, chestResult));
    }
    lines.push(h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => go(`#/world/${id}`) }, `🌍 ${t('home.world')}`),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => go(`#/home/${id}`) }, t('end.back'))));
    box.replaceChildren(...lines);
  };

  let chestResult = null;
  function open() {
    const r = openChest(p, dk, ctx.cfg.app, ctx.cfg.shop.items);
    store.commit();
    chestResult = r.type === 'coins' ? t('end.chestCoins', { n: r.coins }) : t('end.chestItem', { name: t(`shop.${r.id}`) });
    play('block', p.sound);
    confetti();
    draw();
  }

  draw();
  if (res && !res.extra) confetti();
  return frame(box, { profile: p });
}
