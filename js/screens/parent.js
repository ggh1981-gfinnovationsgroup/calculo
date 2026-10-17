import { h } from '../dom.js';
import { t } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store, exportPayload, validateImport, newId as makeId } from '../store.js';
import { frame } from '../layout.js';
import { ensureParent, confirmDialog, modal } from '../ui.js';
import { hashPin } from '../crypto.js';
import { dateKey, dayTotals, currentStreak } from '../rewards.js';

const section = (title, ...kids) => h('section', { class: 'panel stack' }, h('h2', {}, title), ...kids);

function chart(p, activeMs) {
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push(dateKey(d));
  }
  return h('div', { class: 'chart', role: 'img', 'aria-label': t('parent.chartLabel') },
    days.map((k) => {
      const e = p.history[k];
      const tot = dayTotals(e);
      const pct = Math.min(100, Math.round((tot.ms / activeMs) * 100));
      return h('div', { class: 'col' },
        h('div', { class: 'barv' }, h('div', { class: `fillv${e?.completed ? ' done' : ''}`, style: `height:${pct}%` })),
        h('span', { class: 'mark' }, e?.completed ? '✓' : tot.ms ? '·' : ''),
        h('span', { class: 'day' }, k.slice(8)));
    }));
}

function select(label, value, options, onchange) {
  return h('label', { class: 'field' }, h('span', {}, label),
    h('select', { class: 'input', onchange: (e) => onchange(e.target.value) },
      options.map(([v, text]) => h('option', { value: v, selected: String(v) === String(value) }, text))));
}

function childCard(p) {
  const cfg = ctx.cfg;
  const dk = dateKey();
  const upd = (fn) => (v) => { fn(v); store.commit(); ctx.rerender(); };
  const tables = Object.entries(p.stats.tables).filter(([, v]) => v.t >= cfg.app.tables.minAnswers).map(([n, v]) => `${n}: ${Math.round((v.c / v.t) * 100)}%`).join(' · ');
  return h('div', { class: 'child stack' },
    h('h3', {}, `${p.avatar} ${p.nick}`),
    h('p', { class: 'hint' }, t('parent.childStats', { sessions: p.stats.sessions, streak: currentStreak(p, dk), best: p.streak.best, coins: p.coins })),
    chart(p, cfg.app.session.activeMs),
    tables ? h('p', { class: 'hint' }, `${t('parent.tables')}: ${tables}`) : null,
    select(t('profile.grade'), p.level, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, t(`grades.${n}`)]), upd((v) => { p.level = Number(v); p.adaptiveOffset = 0; })),
    select(t('parent.mode'), p.mode, ['grade', 'challenge', 'confidence', 'onedigit'].map((m) => [m, t(`parent.modes.${m}`)]), upd((v) => (p.mode = v))),
    h('p', { class: 'hint' }, t(`parent.modeHelp.${p.mode}`)),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.adaptive, onchange: (e) => upd((v) => { p.adaptive = v; p.adaptiveOffset = 0; })(e.target.checked) }), h('span', {}, t('parent.adaptive'))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.bilingual, onchange: (e) => upd((v) => (p.bilingual = v))(e.target.checked) }), h('span', {}, t('parent.bilingual'))),
    select(t('parent.weekGoal'), p.weekGoal, [3, 4, 5, 6, 7].map((n) => [n, t('parent.daysOption', { n })]), upd((v) => (p.weekGoal = Number(v)))),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', type: 'button', onclick: () => go(`#/edit/${p.id}`) }, t('parent.editProfile')),
      h('button', { class: 'btn small secondary', type: 'button', onclick: () => go(`#/print/${p.id}`) }, `🖨 ${t('parent.print')}`),
      h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
        if (!(await confirmDialog(t('parent.deleteProfileConfirm', { nick: p.nick })))) return;
        store.state.profiles = store.state.profiles.filter((x) => x.id !== p.id);
        store.state.deleted.push(p.id);
        store.commit();
        ctx.rerender();
      } }, t('parent.deleteProfile'))));
}

function rewardsSection() {
  const st = store.state;
  const text = h('input', { class: 'input', type: 'text', maxLength: 60, 'aria-label': t('parent.rewardText') });
  const days = h('input', { class: 'input', type: 'number', min: 1, max: 999, value: 30, 'aria-label': t('parent.rewardDays') });
  return section(t('parent.rewards'),
    h('p', { class: 'hint' }, t('parent.rewardsHint')),
    st.parent.rewards.map((r) => {
      const who = st.profiles.filter((p) => p.streak.best >= r.days).map((p) => p.nick);
      return h('div', { class: 'reward' },
        h('span', {}, `${r.days} ${t('parent.daysUnit')} → ${r.text}`),
        h('span', { class: 'hint' }, who.length ? `${t('parent.unlockedBy')}: ${who.join(', ')}` : t('parent.notYet')),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: r.delivered, onchange: (e) => { r.delivered = e.target.checked; store.commit(); ctx.rerender(); } }), h('span', {}, t('parent.delivered'))),
        h('button', { class: 'btn small danger', type: 'button', onclick: () => { st.parent.rewards = st.parent.rewards.filter((x) => x.id !== r.id); store.commit(); ctx.rerender(); } }, t('common.delete')));
    }),
    h('div', { class: 'row' }, days, text,
      h('button', { class: 'btn small', type: 'button', onclick: () => {
        if (!text.value.trim()) return;
        st.parent.rewards.push({ id: makeId(), text: text.value.trim(), days: Number(days.value) || 30, delivered: false });
        store.commit();
        ctx.rerender();
      } }, t('common.add'))));
}

function dataSection() {
  const msg = h('p', { class: 'msg', role: 'status' });
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const v = validateImport(obj);
      if (!v.ok) throw new Error(v.error);
      if (!(await confirmDialog(t('parent.importConfirm')))) return;
      const keepSync = store.state.sync;
      store.replace({ ...obj.state, sync: keepSync });
      store.commit();
      await store.flush();
      msg.textContent = t('parent.importOk');
      ctx.rerender();
    } catch {
      msg.textContent = t('parent.importError');
    }
  } });
  return section(t('parent.data'),
    h('p', { class: 'hint' }, t('parent.dataHint')),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: () => {
        const blob = new Blob([JSON.stringify(exportPayload(store.state), null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `calculo-${dateKey()}.json` });
        document.body.append(a);
        a.click();
        a.remove();
      } }, `⬇ ${t('parent.export')}`),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => file.click() }, `⬆ ${t('parent.import')}`)),
    file, msg,
    h('button', { class: 'btn danger', type: 'button', onclick: async () => {
      if (!(await confirmDialog(t('parent.deleteAllConfirm'), { typeWord: t('parent.deleteWord') }))) return;
      try {
        if (store.state.sync) await ctx.provider.disconnect({ deleteRemote: true });
      } catch {
        msg.textContent = t('parent.deleteRemoteFailed');
        return;
      }
      await store.reset();
      ctx.parentUntil = 0;
      location.hash = '';
      location.reload();
    } }, `🗑 ${t('parent.deleteAll')}`));
}

function syncSection() {
  const p = ctx.provider;
  if (!p.configured()) return section(t('parent.sync'), h('p', { class: 'hint' }, t('parent.syncNotConfigured')));
  const s = store.state.sync;
  const msg = h('p', { class: 'msg', role: 'status' });
  const run = async (fn) => {
    msg.textContent = '…';
    try {
      await fn();
      ctx.rerender();
    } catch (e) {
      msg.textContent = t(e.message === 'invalid' ? 'welcome.codeInvalid' : e.message === 'notfound' ? 'welcome.notFound' : 'welcome.syncError');
    }
  };
  if (!s) {
    const input = h('input', { class: 'input', type: 'text', placeholder: 'XXXX-XXXX-XXXX-XXXX', autocomplete: 'off', 'aria-label': t('welcome.codeLabel') });
    return section(t('parent.sync'), h('p', { class: 'hint' }, t('parent.syncHint')),
      h('button', { class: 'btn', type: 'button', onclick: () => run(async () => { const code = await p.enable(); showCode(code); }) }, t('parent.syncEnable')),
      input, h('button', { class: 'btn secondary', type: 'button', onclick: () => run(() => p.join(input.value)) }, t('welcome.join')), msg);
  }
  return section(t('parent.sync'),
    h('p', {}, `${t('parent.syncCode')}: `, h('code', {}, s.code)),
    h('p', { class: 'hint' }, t('parent.syncWarn')),
    h('p', { class: 'hint' }, s.last ? `${t('parent.syncLast')}: ${new Date(s.last).toLocaleString()}` : ''),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', type: 'button', onclick: () => run(() => p.syncNow()) }, t('parent.syncNow')),
      h('button', { class: 'btn small secondary', type: 'button', onclick: () => run(() => p.disconnect()) }, t('parent.syncOff')),
      h('button', { class: 'btn small danger', type: 'button', onclick: async () => { if (await confirmDialog(t('parent.syncDeleteConfirm'))) run(() => p.disconnect({ deleteRemote: true })); } }, t('parent.syncDelete'))),
    msg);
}

function showCode(code) {
  const m = modal(h('h2', {}, t('parent.syncCode')), h('p', { class: 'bigcode' }, code), h('p', {}, t('parent.syncWarn')),
    h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, t('common.ok')));
}

function pinSection() {
  const a = h('input', { class: 'input pin', type: 'password', inputMode: 'numeric', maxLength: 4, 'aria-label': t('parent.newPin') });
  const msg = h('p', { class: 'msg', role: 'status' });
  return section(t('parent.changePin'), a, msg,
    h('button', { class: 'btn small', type: 'button', onclick: async () => {
      if (!/^\d{4}$/.test(a.value)) return void (msg.textContent = t('parent.setup.pinError'));
      store.state.parent.pin = await hashPin(a.value);
      store.commit();
      a.value = '';
      msg.textContent = t('parent.pinChanged');
    } }, t('common.save')));
}

export function parentPanel() {
  if (Date.now() >= ctx.parentUntil) {
    ensureParent().then((ok) => (ok ? ctx.rerender() : go('#/')));
    return frame(h('p', {}, '…'), { back: '#/' });
  }
  const st = store.state;
  return frame(
    h('div', { class: 'stack' },
      h('h1', {}, `👪 ${t('parent.title')}`),
      section(t('parent.children'), st.profiles.length ? st.profiles.map(childCard) : h('p', {}, t('parent.noChildren')),
        h('button', { class: 'btn', type: 'button', onclick: () => go('#/new') }, `➕ ${t('selector.add')}`)),
      rewardsSection(), syncSection(), dataSection(), pinSection(),
      section(t('parent.more'), h('div', { class: 'row' },
        h('a', { class: 'btn small secondary', href: '#/privacy' }, t('privacy.link')),
        h('a', { class: 'btn small secondary', href: '#/install' }, t('install.link')))),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => { ctx.parentUntil = 0; go('#/'); } }, t('parent.lock'))),
    { back: '#/' }
  );
}
