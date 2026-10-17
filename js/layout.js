import { h } from './dom.js';
import { t, languages, getLang, otherLang } from './i18n.js';
import { ctx, go } from './ctx.js';
import { store } from './store.js';
import { initGift } from '../gift/gift.js';
import { GIFT } from '../gift/gift-data.js';
import { mascotStage, MASCOT, currentStreak, dateKey } from './rewards.js';

export function unlockAge14(profile) {
  if (profile) {
    if (!profile.badges.includes('age14')) profile.badges.push('age14');
  } else store.state.pendingAge14 = true;
  store.commit();
}

export function frame(content, { profile = null, back = null, hideLang = false } = {}) {
  const logo = h('button', { class: 'logo', type: 'button', 'aria-label': t('app.name') }, '🧮');
  initGift(logo, GIFT, { onUnlock: () => unlockAge14(profile) });

  const toggle = () => {
    const next = otherLang(getLang());
    if (profile) profile.lang = next;
    else store.state.lang = next;
    store.commit();
    ctx.rerender();
  };
  const other = languages().find((l) => l.code !== getLang());
  const header = h(
    'header',
    { class: 'topbar' },
    back ? h('button', { class: 'btn small secondary', type: 'button', onclick: () => go(back), 'aria-label': t('common.back') }, '←') : null,
    logo,
    h('span', { class: 'brand' }, t('app.name')),
    h('span', { class: 'spacer' }),
    hideLang ? null : h('button', { class: 'btn small secondary lang', type: 'button', onclick: toggle, 'aria-label': t('common.changeLanguage') }, `🌐 ${other?.name ?? ''}`)
  );
  return h('div', { class: 'screen' }, header, h('main', { class: 'content' }, content));
}

export function mascot(profile, { size = 'md' } = {}) {
  const items = ctx.cfg.shop.items;
  const get = (id) => items.find((i) => i.id === id);
  const eq = profile.equipped;
  const color = eq.color ? get(eq.color)?.value : '#5b5bd6';
  const bg = eq.background ? get(eq.background)?.value : 'linear-gradient(#eef0ff,#dfe3ff)';
  const acc = eq.accessory ? get(eq.accessory)?.value : null;
  const stage = mascotStage(currentStreak(profile, dateKey()));
  return h(
    'div',
    { class: `mascot ${size}`, style: `background:${bg};border-color:${color}`, role: 'img', 'aria-label': t(`mascot.stage.${stage}`) },
    acc ? h('span', { class: 'acc' }, acc) : null,
    h('span', { class: 'pet' }, MASCOT[stage])
  );
}
