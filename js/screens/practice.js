import { h } from '../dom.js';
import { t, setLang, otherLang, raw } from '../i18n.js';
import { ctx, go } from '../ctx.js';
import { store } from '../store.js';
import { ActiveTimer } from '../timer.js';
import { newSession, currentOp, submitAnswer, partialDelta } from '../session.js';
import { dateKey, isDoneToday, recordProgress, finalizeSession, recordTable } from '../rewards.js';
import { play } from '../sounds.js';
import { modal } from '../ui.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function practice(id) {
  const profile = store.profile(id);
  if (!profile) return go('#/');
  const cfg = ctx.cfg;
  const S = cfg.app.session;
  const dk = dateKey();
  setLang(profile.bilingual ? otherLang(profile.lang) : profile.lang);

  let session = profile.session && profile.session.date === dk && !profile.session.done ? profile.session : null;
  if (!session) {
    session = newSession(dk, isDoneToday(profile, dk));
    profile.session = session;
    store.commit();
  }
  const timer = new ActiveTimer({ activeMs: S.activeMs, idleMs: S.idleMs, maxTickMs: S.maxTickMs, elapsedMs: session.elapsedMs });

  session.skipped ||= [];
  let review = false;
  let prompting = false;
  let buf = '';
  let locked = false;
  let finished = false;
  let wakeLock = null;

  const bar = h('div', { class: 'fill' });
  const barWrap = h('div', { class: 'bar', role: 'progressbar', 'aria-label': t('practice.timeBar'), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, bar);
  const timeText = h('span', { class: 'time' });
  const coins = h('span', { class: 'chip' }, `🪙 ${profile.coins}`);
  const opEl = h('div', { class: 'op', 'aria-live': 'polite' });
  const ansEl = h('div', { class: 'answer', 'aria-label': t('practice.yourAnswer') });
  const fb = h('div', { class: 'feedback', role: 'status' });
  const next = h('button', { class: 'btn big', type: 'button', hidden: true, onclick: () => advance() }, t('practice.next'));
  const pauseOv = h('div', { class: 'pause', hidden: true },
    h('div', { class: 'modal-box' }, h('h2', {}, `⏸ ${t('practice.paused')}`), h('p', {}, t('practice.pausedHint')),
      h('button', { class: 'btn big', type: 'button', onclick: () => resume() }, t('practice.resume'))));

  const saveSession = () => {
    session.elapsedMs = timer.elapsedMs;
    recordProgress(profile, session);
    store.commit();
  };

  const touch = () => {
    timer.interact(performance.now());
    pauseOv.hidden = true;
  };
  const resume = () => touch();

  const showOp = () => {
    if (review && session.queue.length === 0) return finalize();
    if (!review && session.answered >= S.maxOps) return finish();
    const op = currentOp(session, profile, cfg);
    opEl.textContent = `${op.text} = ?`;
    buf = '';
    ansEl.textContent = '\u00a0';
    fb.textContent = '';
    fb.className = 'feedback';
    next.hidden = true;
    locked = false;
  };

  const press = (d) => {
    if (locked || pauseOv.hidden === false) return;
    touch();
    const digits = buf.replace('-', '');
    if (digits.length < 9) buf += d;
    ansEl.textContent = buf;
  };
  const sign = () => {
    if (locked) return;
    touch();
    buf = buf.startsWith('-') ? buf.slice(1) : `-${buf}`;
    ansEl.textContent = buf || '\u00a0';
  };
  const del = () => {
    if (locked) return;
    touch();
    buf = buf.slice(0, -1);
    ansEl.textContent = buf || '\u00a0';
  };

  function advance() {
    touch();
    showOp();
  }

  const submit = () => {
    if (locked) return advance();
    if (buf === '' || buf === '-') return;
    touch();
    locked = true;
    const r = submitAnswer(session, profile, cfg, Number(buf));
    recordTable(profile, r.op, r.correct, r.first, cfg.app);
    if (r.correct) {
      play(r.blockDone ? 'block' : 'ok', profile.sound);
      fb.className = 'feedback good';
      fb.textContent = r.blockDone ? `🎉 ${t('practice.block')}` : `✓ ${pick(raw('practice.praise'))}`;
      setTimeout(() => !finished && showOp(), r.blockDone && !review ? 1100 : 550);
    } else {
      play('soft', profile.sound);
      fb.className = 'feedback gentle';
      fb.textContent = t('practice.wrong', { answer: r.op.answer });
      next.hidden = false;
      next.focus();
    }
    saveSession();
  };

  const key = (e) => {
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === '-') sign();
    else if (e.key === 'Backspace') del();
    else if (e.key === 'Enter') submit();
  };

  const skip = () => {
    if (locked || review || timer.done) return;
    touch();
    session.skipped.push(session.queue.shift());
    saveSession();
    showOp();
  };

  const finish = () => {
    if (finished || prompting || review) return;
    if (session.skipped.length === 0) return finalize();
    prompting = true;
    const n = session.skipped.length;
    const m = modal(
      h('h2', {}, t('practice.skippedTitle')),
      h('p', {}, t('practice.skippedText', { n })),
      h('button', { class: 'btn big', type: 'button', onclick: () => {
        m.close();
        review = true;
        prompting = false;
        session.queue = session.skipped;
        session.skipped = [];
        showOp();
      } }, t('practice.solveSkipped')),
      h('button', { class: 'btn big secondary', type: 'button', onclick: () => { m.close(); finalize(); } }, t('practice.finishNow')));
  };

  const finalize = () => {
    if (finished) return;
    finished = true;
    const res = finalizeSession(store.state, profile, session, dk, cfg.app, cfg.badges);
    ctx.lastResult[id] = { ...res, log: session.log || [] };
    store.commit();
    go(`#/end/${id}`);
  };

  const exit = () => {
    if (!session.extra) {
      const d = partialDelta({ ...session, elapsedMs: timer.elapsedMs }, cfg);
      profile.coins += d;
      session.partialAwarded += d;
    }
    saveSession();
    finished = true;
    go(`#/home/${id}`);
  };

  const loop = setInterval(() => {
    timer.tick(performance.now());
    const pct = Math.round(timer.fraction * 100);
    bar.style.width = `${pct}%`;
    barWrap.setAttribute('aria-valuenow', String(pct));
    const left = Math.ceil(timer.remainingMs / 1000);
    timeText.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (timer.done) finish();
    else if (!timer.running && !review) {
      pauseOv.hidden = false;
      saveSession();
    }
  }, 250);

  const hide = () => {
    timer.pause('hidden', performance.now());
    saveSession();
  };
  const vis = () => document.hidden && hide();
  document.addEventListener('visibilitychange', vis);
  window.addEventListener('pagehide', hide);
  window.addEventListener('blur', hide);
  document.addEventListener('keydown', key);
  navigator.wakeLock?.request('screen').then((w) => (wakeLock = w)).catch(() => {});

  const k = (label, fn, cls = '', aria) =>
    h('button', { class: `key ${cls}`, type: 'button', onclick: fn, 'aria-label': aria || label }, label);
  const pad = h('div', { class: 'keypad' },
    ...['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => k(d, () => press(d))),
    k('−', sign, 'alt', t('practice.minus')), k('0', () => press('0')), k('⌫', del, 'alt', t('practice.delete')));

  timer.start(performance.now());
  showOp();

  const el = h('div', { class: 'screen practice' },
    h('header', { class: 'topbar' },
      h('button', { class: 'btn small secondary', type: 'button', onclick: exit }, t('practice.saveExit')),
      h('span', { class: 'spacer' }), coins),
    h('div', { class: 'timebar' }, barWrap, timeText),
    h('main', { class: 'content stack center' }, opEl, ansEl, fb, next, pad,
      h('button', { class: 'btn big primary', type: 'button', onclick: submit }, t('practice.check')),
      h('button', { class: 'btn secondary', type: 'button', onclick: skip }, `⏭ ${t('practice.skip')}`)),
    pauseOv);

  el._destroy = () => {
    clearInterval(loop);
    document.removeEventListener('visibilitychange', vis);
    window.removeEventListener('pagehide', hide);
    window.removeEventListener('blur', hide);
    document.removeEventListener('keydown', key);
    wakeLock?.release?.().catch(() => {});
    if (!finished) {
      timer.pause('left', performance.now());
      if (profile.session) saveSession();
    }
  };
  return el;
}
