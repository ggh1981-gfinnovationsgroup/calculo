import { h } from '../dom.js';
import { t } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { frame, mascot } from '../layout.js';
import { sessionLabel } from '../session.js';
import { currentStreak, dateKey, isDoneToday, weekCount, canOpenChest } from '../rewards.js';

export function home(id) {
  const p = store.profile(id);
  if (!p) return go('#/');
  const dk = dateKey();
  if (store.state.pendingAge14) {
    if (!p.badges.includes('age14')) p.badges.push('age14');
    store.state.pendingAge14 = false;
    store.commit();
  }
  const label = sessionLabel(p, ctx.cfg);
  const practiceText = label.kind === 'grade' ? t('home.practiceGrade', { grade: t(`grades.${label.grade}`) }) : t('home.practice');
  const done = isDoneToday(p, dk);
  const inProgress = p.session && p.session.date === dk && !p.session.done;

  const settings = h('div', { class: 'panel' },
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.sound, onchange: (e) => { p.sound = e.target.checked; store.commit(); } }), h('span', {}, t('home.sound'))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.reduceMotion, onchange: (e) => { p.reduceMotion = e.target.checked; store.commit(); ctx.rerender(); } }), h('span', {}, t('home.reduceMotion'))));

  return frame(
    h('div', { class: 'stack center' },
      h('h1', {}, t('home.hello', { nick: p.nick })),
      mascot(p, { size: 'lg' }),
      h('div', { class: 'stats' },
        h('span', { class: 'chip' }, `🪙 ${p.coins}`),
        h('span', { class: 'chip' }, `🔥 ${t('home.streak', { n: currentStreak(p, dk) })}`),
        h('span', { class: 'chip' }, `📅 ${t('home.week', { done: weekCount(p, dk), goal: p.weekGoal })}`)),
      !done || inProgress
        ? h('button', { class: 'btn big primary', type: 'button', onclick: () => go(`#/play/${id}`) }, inProgress ? t('home.continue') : practiceText)
        : h('p', { class: 'done' }, `✅ ${t('home.doneToday')}`),
      done && canOpenChest(p, dk) ? h('button', { class: 'btn big', type: 'button', onclick: () => go(`#/end/${id}`) }, `🎁 ${t('home.openChest')}`) : null,
      done && !inProgress ? h('button', { class: 'btn secondary', type: 'button', onclick: () => go(`#/play/${id}`) }, t('home.moreOptional')) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => go(`#/read/${id}`) }, `📖 ${t('home.reading')}`),
        h('button', { class: 'btn', type: 'button', onclick: () => go(`#/world/${id}`) }, `🌍 ${t('home.world')}`)),
      settings),
    { profile: p, back: '#/' }
  );
}
