import { h } from '../dom.js';
import { t } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store, newProfile } from '../store.js';
import { frame } from '../layout.js';
import { ensureParent } from '../ui.js';
import { currentStreak, dateKey, mascotStage, MASCOT, familyProgress } from '../rewards.js';

export function selector() {
  const dk = dateKey();
  const kids = store.state.profiles;
  const cards = kids.map((p) =>
    h(
      'button',
      { class: 'card', type: 'button', onclick: () => go(`#/home/${p.id}`) },
      h('span', { class: 'avatar' }, p.avatar),
      h('span', { class: 'nick' }, p.nick),
      h('span', { class: 'sub' }, `${MASCOT[mascotStage(currentStreak(p, dk))]} 🔥 ${currentStreak(p, dk)}`)
    )
  );
  const fp = kids.length > 1 ? familyProgress(store.state, dk) : null;
  return frame(
    h(
      'div',
      { class: 'stack' },
      h('h1', {}, t('selector.title')),
      h('div', { class: 'grid' }, cards,
        h('button', { class: 'card add', type: 'button', onclick: async () => { if (await ensureParent()) go('#/new'); } },
          h('span', { class: 'avatar' }, '➕'), h('span', { class: 'nick' }, t('selector.add')))),
      fp ? h('div', { class: 'panel' }, h('strong', {}, t('selector.familyGoal')),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': fp.target, 'aria-valuenow': fp.done }, h('div', { class: 'fill', style: `width:${Math.min(100, (fp.done / fp.target) * 100)}%` })),
        h('span', {}, t('selector.familyGoalText', { done: fp.done, target: fp.target }))) : null,
      h('button', { class: 'btn secondary', type: 'button', onclick: async () => { if (await ensureParent()) go('#/parent'); } }, `👪 ${t('selector.parents')}`)
    )
  );
}

export function profileForm(editId) {
  const cfg = ctx.cfg;
  const editing = editId ? store.profile(editId) : null;
  const lang = editing?.lang || store.state.lang || 'es';
  const data = { avatar: editing?.avatar || cfg.app.avatars[0], lang, level: editing?.level || 2 };
  const nick = h('input', { class: 'input', id: 'nick', type: 'text', maxLength: 16, autocomplete: 'off', value: editing?.nick || '' });
  const msg = h('p', { class: 'msg', role: 'alert' });

  const avatarGrid = h('div', { class: 'avatars', role: 'radiogroup', 'aria-label': t('profile.avatar') });
  const paintAvatars = () => {
    avatarGrid.replaceChildren(
      ...cfg.app.avatars.map((a) =>
        h('button', { class: `avatar-opt${a === data.avatar ? ' sel' : ''}`, type: 'button', role: 'radio', 'aria-checked': String(a === data.avatar), onclick: () => { data.avatar = a; paintAvatars(); } }, a)
      )
    );
  };
  paintAvatars();

  const langSel = h('select', { class: 'input', id: 'plang', onchange: (e) => (data.lang = e.target.value) },
    ...['es', 'en'].map((c) => h('option', { value: c, selected: c === data.lang }, c === 'es' ? 'Español' : 'English')));

  const gradeSel = h('select', { class: 'input', id: 'grade' });
  const ageSel = h('select', { class: 'input', id: 'age' });
  const fillSel = () => {
    gradeSel.replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => h('option', { value: n, selected: n === data.level }, t(`grades.${n}`))));
    ageSel.replaceChildren(h('option', { value: '' }, '—'), ...Object.keys(cfg.levels.ageToLevel).map((a) => h('option', { value: a }, t('profile.ageOption', { n: a }))));
  };
  fillSel();
  gradeSel.addEventListener('change', () => { data.level = Number(gradeSel.value); ageSel.value = ''; });
  ageSel.addEventListener('change', () => {
    if (!ageSel.value) return;
    data.level = cfg.levels.ageToLevel[ageSel.value];
    gradeSel.value = String(data.level);
  });

  const save = h('button', {
    class: 'btn big',
    type: 'button',
    onclick: () => {
      const n = nick.value.trim();
      if (!n) return void (msg.textContent = t('profile.nickRequired'));
      if (editing) Object.assign(editing, { nick: n, avatar: data.avatar, lang: data.lang, level: data.level });
      else {
        const p = newProfile({ nick: n, avatar: data.avatar, lang: data.lang, level: data.level }, cfg.app.rewards.graceStart);
        store.state.profiles.push(p);
        editId = p.id;
      }
      store.commit();
      go(editing ? '#/parent' : `#/home/${editId}`);
    },
  }, t('common.save'));

  return frame(
    h('div', { class: 'stack' },
      h('h1', {}, editing ? t('profile.edit') : t('profile.new')),
      h('label', { for: 'nick' }, t('profile.nick')), nick,
      h('p', { class: 'hint' }, t('profile.nickHint')),
      h('span', { class: 'label' }, t('profile.avatar')), avatarGrid,
      h('label', { for: 'plang' }, t('profile.language')), langSel,
      h('label', { for: 'grade' }, t('profile.grade')), gradeSel,
      h('label', { for: 'age' }, t('profile.orAge')), ageSel,
      msg, save),
    { back: editing ? '#/parent' : store.state.profiles.length ? '#/' : null }
  );
}
