import { h } from '../dom.js';
import { t } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { frame, mascot } from '../layout.js';
import { dateKey, currentStreak, mascotStage } from '../rewards.js';

let tab = 'badges';

function preview(item) {
  if (item.type === 'color') return h('span', { class: 'swatch', style: `background:${item.value}` });
  if (item.type === 'background') return h('span', { class: 'swatch', style: `background:${item.value}` });
  return h('span', { class: 'swatch emoji' }, item.value);
}

export function world(id) {
  const p = store.profile(id);
  if (!p) return go('#/');
  const cfg = ctx.cfg;
  const stage = mascotStage(currentStreak(p, dateKey()));

  const tabs = h('div', { class: 'tabs', role: 'tablist' },
    ...['badges', 'shop', 'avatar'].map((k) =>
      h('button', { class: `btn small${tab === k ? '' : ' secondary'}`, type: 'button', role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; ctx.rerender(); } }, t(`world.tab.${k}`))));

  let body;
  if (tab === 'badges') {
    body = h('div', { class: 'grid' }, cfg.badges.filter((b) => !b.hidden || p.badges.includes(b.id)).map((b) => {
      const got = p.badges.includes(b.id);
      return h('div', { class: `badge${got ? '' : ' locked'}` },
        h('span', { class: 'emoji' }, got ? b.emoji : '🔒'),
        h('strong', {}, t(`badges.${b.id}.name`)),
        h('span', { class: 'sub' }, t(`badges.${b.id}.desc`)),
        h('span', { class: 'sub' }, got ? `✓ ${t('world.earned')}` : t('world.locked')));
    }));
  } else if (tab === 'shop') {
    body = h('div', { class: 'stack' }, ['color', 'accessory', 'background'].map((type) =>
      h('section', {}, h('h2', {}, t(`world.type.${type}`)),
        h('div', { class: 'grid' }, cfg.shop.items.filter((i) => i.type === type).map((i) => {
          const owned = p.owned.includes(i.id);
          const on = p.equipped[type] === i.id;
          const afford = p.coins >= i.price;
          const btn = owned
            ? h('button', { class: 'btn small', type: 'button', onclick: () => { p.equipped[type] = on ? null : i.id; store.commit(); ctx.rerender(); } }, on ? t('world.unequip') : t('world.equip'))
            : h('button', { class: 'btn small', type: 'button', disabled: !afford, onclick: () => { p.coins -= i.price; p.owned.push(i.id); p.equipped[type] = i.id; store.commit(); ctx.rerender(); } }, `${t('world.buy')} ${i.price} 🪙`);
          return h('div', { class: 'item' }, preview(i), h('strong', {}, t(`shop.${i.id}`)), btn,
            !owned && !afford ? h('span', { class: 'sub' }, t('world.needCoins', { n: i.price - p.coins })) : null);
        })))));
  } else {
    body = h('div', { class: 'avatars', role: 'radiogroup', 'aria-label': t('profile.avatar') },
      cfg.app.avatars.map((a) => h('button', { class: `avatar-opt${a === p.avatar ? ' sel' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(a === p.avatar), onclick: () => { p.avatar = a; store.commit(); ctx.rerender(); } }, a)));
  }

  return frame(
    h('div', { class: 'stack center' },
      h('h1', {}, `${p.avatar} ${t('world.title')}`),
      mascot(p, { size: 'lg' }),
      h('p', {}, `${t(`mascot.stage.${stage}`)} · 🪙 ${p.coins}`),
      h('p', { class: 'hint' }, t('mascot.hint')),
      tabs, body),
    { profile: p, back: `#/home/${id}` }
  );
}
