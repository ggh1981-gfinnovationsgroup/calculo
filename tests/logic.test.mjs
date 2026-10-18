import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateOps } from '../js/generator.js';
import { ActiveTimer } from '../js/timer.js';
import { levelFor, sessionLabel, newSession, currentOp, submitAnswer, partialDelta } from '../js/session.js';
import { updateStreak, currentStreak, weekKey, finalizeSession, openChest, mascotStage } from '../js/rewards.js';
import { mergeStates } from '../js/merge.js';
import { fillProfile, defaultState, newProfile, validateImport, exportPayload } from '../js/store.js';
import { CloudProvider, newFamilyCode, isValidCode } from '../js/providers/cloud.js';
import { hashPin, verifyPin } from '../js/crypto.js';

const json = async (p) => JSON.parse(await readFile(new URL(`../${p}`, import.meta.url), 'utf8'));
const levels = await json('config/levels.json');
const app = await json('config/app.json');
const badges = await json('config/badges.json');
const shop = await json('data/shop.json');
const cfg = { app, levels };

const mk = (over = {}) => fillProfile({ id: 'p1', nick: 'Ana', avatar: '🦊', lang: 'es', level: 4, ...over });

test('todos los niveles generan operaciones válidas, exactas y con negativos entre paréntesis', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 'one']) {
    const ops = generateOps(levels, { level, oneDigit: level === 'one', seed: `s-${level}`, count: 600 });
    for (const o of ops) {
      if (o.op === '÷') {
        assert.ok(o.b !== 0 && o.a % o.b === 0, `división inexacta ${o.text}`);
        assert.equal(o.a / o.b, o.answer);
      }
      if (o.op === '+') assert.equal(o.a + o.b, o.answer);
      if (o.op === '-') assert.equal(o.a - o.b, o.answer);
      if (o.op === 'x') assert.equal(o.a * o.b, o.answer);
      assert.ok(Number.isInteger(o.answer));
      // Tras quitar los negativos entre paréntesis no puede quedar ningún "-dígito".
      assert.ok(!/-\d/.test(o.text.replace(/\(-\d+\)/g, '')), `negativo sin paréntesis: ${o.text}`);
    }
  }
});

test('niveles 1-5 y "una cifra" nunca usan negativos', () => {
  for (const level of [1, 2, 3, 4, 5, 'one']) {
    const ops = generateOps(levels, { level, oneDigit: level === 'one', seed: 'neg', count: 400 });
    assert.ok(ops.every((o) => o.a >= 0 && o.b >= 0 && o.answer >= 0), `negativo en nivel ${level}`);
  }
});

test('del nivel 6 en adelante aparecen negativos', () => {
  const ops = generateOps(levels, { level: 6, seed: 'neg6', count: 300 });
  assert.ok(ops.some((o) => o.text.includes('(-')));
});

test('especificación: 2º grado dentro de 0-20', () => {
  const ops = generateOps(levels, { level: 2, seed: 'l2', count: 300 });
  assert.ok(ops.every((o) => ['+', '-'].includes(o.op) && o.a <= 20 && o.b <= 20 && o.answer >= 0 && o.answer <= 20));
});

test('misma semilla, misma sesión; no se repiten operaciones', () => {
  const a = generateOps(levels, { level: 4, seed: 'x', count: 40 });
  const b = generateOps(levels, { level: 4, seed: 'x', count: 40 });
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((o) => o.key)).size, a.length);
});

test('modo Reto: no cambia la etiqueta que ve el niño', () => {
  const g = mk({ mode: 'grade' });
  const c = mk({ mode: 'challenge' });
  assert.deepEqual(sessionLabel(g, cfg), sessionLabel(c, cfg));
  assert.equal(levelFor(c, cfg).level, 8);
  assert.equal(levelFor(mk({ mode: 'confidence' }), cfg).level, 3);
  assert.equal(sessionLabel(mk({ mode: 'confidence' }), cfg).grade, 5);
  assert.equal(levelFor(mk({ mode: 'onedigit' }), cfg).oneDigit, true);
});

test('reloj: se pausa por inactividad y no cuenta el tiempo inactivo', () => {
  const t = new ActiveTimer({ activeMs: 900000, idleMs: 10000, maxTickMs: 10000 });
  t.start(0);
  for (let now = 250; now <= 5000; now += 250) t.tick(now);
  t.interact(5000);
  for (let now = 5250; now <= 30000; now += 250) t.tick(now);
  assert.equal(t.running, false);
  assert.equal(t.reason, 'idle');
  assert.equal(t.elapsedMs, 15000); // 5 s + 10 s hasta el límite de inactividad
  t.interact(60000);
  assert.equal(t.running, true);
  assert.equal(t.elapsedMs, 15000);
});

test('reloj: pausa por pestaña oculta y salto grande no suma', () => {
  const t = new ActiveTimer({ idleMs: 10000, maxTickMs: 2000 });
  t.start(0);
  t.tick(1000);
  t.pause('hidden', 1500);
  assert.equal(t.elapsedMs, 1500);
  t.tick(100000);
  assert.equal(t.elapsedMs, 1500);
  t.interact(100000);
  t.tick(500000); // el equipo estuvo suspendido
  assert.ok(t.elapsedMs <= 1500 + 2000);
});

test('reloj: completa a los 15 minutos activos', () => {
  const t = new ActiveTimer({ activeMs: 900000, idleMs: 10000, maxTickMs: 2000 });
  t.start(0);
  for (let now = 250; !t.done; now += 250) {
    if (now % 5000 === 0) t.interact(now);
    t.tick(now);
  }
  assert.equal(t.elapsedMs, 900000);
});

test('sesión: bloques de 10, errores no se reintentan y no restan nada', () => {
  const p = mk({ adaptive: true });
  const s = newSession('2026-10-17');
  const first = currentOp(s, p, cfg);
  const r = submitAnswer(s, p, cfg, first.answer + 1);
  assert.equal(r.correct, false);
  assert.ok(!s.queue.some((o) => o.retry));
  assert.equal(p.coins, 0);
  let blocks = 0;
  for (let i = 0; i < 40; i++) {
    const op = currentOp(s, p, cfg);
    if (submitAnswer(s, p, cfg, op.answer).blockDone) blocks++;
  }
  assert.ok(blocks >= 3);
  assert.ok(p.adaptiveOffset > 0);
});

test('monedas parciales menores que las completas', () => {
  const s = newSession('2026-10-17');
  s.elapsedMs = 450000;
  assert.equal(partialDelta(s, cfg), 2);
  assert.ok(partialDelta(s, cfg) < app.rewards.fullCoins);
});

test('racha: días de gracia', () => {
  const p = mk();
  updateStreak(p, '2026-10-10', app);
  updateStreak(p, '2026-10-11', app);
  assert.equal(p.streak.current, 2);
  updateStreak(p, '2026-10-13', app); // falta un día, usa gracia
  assert.equal(p.streak.current, 3);
  assert.equal(p.streak.grace, 1);
  assert.equal(currentStreak(p, '2026-10-14'), 3);
  updateStreak(p, '2026-10-20', app); // falta demasiado
  assert.equal(p.streak.current, 1);
  assert.equal(p.streak.best, 3);
});

test('la semana empieza el lunes', () => {
  assert.equal(weekKey('2026-10-17'), '2026-10-12');
  assert.equal(weekKey('2026-10-12'), '2026-10-12');
  assert.equal(weekKey('2026-10-18'), '2026-10-12');
});

test('finalizar sesión otorga monedas, insignias y no se repite en el mismo día', () => {
  const state = defaultState();
  const p = mk();
  state.profiles.push(p);
  const s = newSession('2026-10-17');
  s.answered = s.fresh = s.firstTry = 20;
  const res = finalizeSession(state, p, s, '2026-10-17', app, badges);
  assert.equal(p.coins, 10);
  assert.ok(res.newBadges.includes('first') && res.newBadges.includes('perfect'));
  const c1 = openChest(p, '2026-10-17', app, shop.items);
  assert.ok(c1.type === 'coins' || c1.type === 'item');
  assert.equal(mascotStage(p.streak.current), 1);
});

test('la sesión extra no da monedas', () => {
  const state = defaultState();
  const p = mk();
  state.profiles.push(p);
  finalizeSession(state, p, newSession('2026-10-17', true), '2026-10-17', app, badges);
  assert.equal(p.coins, 0);
  assert.equal(p.stats.sessions, 0);
});

test('fusión de estados une insignias y respeta borrados', () => {
  const a = defaultState();
  const b = defaultState();
  const pa = mk({ badges: ['first'] });
  const pb = mk({ badges: ['streak3'], history: { '2026-10-16': { completed: true, parts: {} } } });
  a.profiles.push(pa, mk({ id: 'gone' }));
  b.profiles.push(pb);
  a.updatedAt = 2;
  b.updatedAt = 1;
  b.deleted = ['gone'];
  const m = mergeStates(a, b);
  assert.deepEqual(m.profiles.map((x) => x.id), ['p1']);
  assert.deepEqual(m.profiles[0].badges.sort(), ['first', 'streak3']);
  assert.ok(m.profiles[0].history['2026-10-16'].completed);
});

test('exportar excluye el código de sincronización; importar valida', () => {
  const s = defaultState();
  s.sync = { code: 'SECRETO' };
  s.profiles.push(newProfile({ nick: 'Leo', avatar: '🐼', lang: 'en', level: 2 }));
  const out = exportPayload(s);
  assert.ok(!JSON.stringify(out).includes('SECRETO'));
  assert.equal(validateImport(out).ok, true);
  assert.equal(validateImport({ app: 'otro' }).ok, false);
  assert.equal(validateImport({ app: 'calculo', state: { profiles: [{ id: 'a', nick: 'x', level: 99 }] } }).ok, false);
});

test('PIN: verifica correcto e incorrecto', async () => {
  const rec = await hashPin('1234');
  assert.equal(await verifyPin('1234', rec), true);
  assert.equal(await verifyPin('4321', rec), false);
});

test('sincronización cifrada: el servidor solo ve texto cifrado y se fusionan conflictos', async () => {
  const server = { rows: new Map() };
  const fetchFn = async (url, init) => {
    const id = init.headers['X-Family-Id'];
    const row = server.rows.get(id);
    const body = init.body ? JSON.parse(init.body) : null;
    const res = (status, data) => ({ status, ok: status < 300, json: async () => data });
    if (init.method === 'GET') return row ? res(200, { rev: row.rev, blob: row.blob }) : res(404, {});
    if (init.method === 'PUT') {
      if (row && row.rev !== body.baseRev) return res(409, { rev: row.rev, blob: row.blob });
      server.rows.set(id, { rev: (row?.rev || 0) + 1, blob: body.blob });
      return res(200, { rev: (row?.rev || 0) + 1 });
    }
    server.rows.delete(id);
    return res(200, {});
  };
  const mkStore = (state) => ({ state, replace(s) { this.state = s; } });
  const local = { load: async () => null, save: async () => {}, clear: async () => {} };

  const s1 = mkStore(defaultState());
  s1.state.profiles.push(mk({ nick: 'SoloEnServidorCifrado' }));
  const c1 = new CloudProvider(local, { url: 'https://x.test', fetchFn });
  c1.store = s1;
  const code = await c1.enable();
  assert.ok(isValidCode(code) && newFamilyCode().length === 19);
  const stored = [...server.rows.values()][0].blob;
  assert.ok(!stored.includes('SoloEnServidorCifrado'));

  const s2 = mkStore(defaultState());
  const c2 = new CloudProvider(local, { url: 'https://x.test', fetchFn });
  c2.store = s2;
  await c2.join(code);
  assert.equal(s2.state.profiles[0].nick, 'SoloEnServidorCifrado');
  await assert.rejects(c2.join('AAAA-AAAA-AAAA-AAAA'), /notfound/);
});

test('i18n: es y en tienen exactamente las mismas claves', async () => {
  const flat = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  const es = flat(await json('i18n/es.json')).sort();
  const en = flat(await json('i18n/en.json')).sort();
  assert.deepEqual(es, en);
});

test('lectura: cada idioma cubre los niveles 1-9', async () => {
  for (const l of ['es', 'en']) {
    const { passages } = await json(`data/reading/${l}.json`);
    for (let lv = 1; lv <= 9; lv++) {
      assert.ok(passages.some((p) => p.levels[0] <= lv && lv <= p.levels[1]), `${l}: sin lectura para nivel ${lv}`);
    }
    for (const p of passages) for (const q of p.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length);
  }
});

test('un error no vuelve a aparecer', () => {
  const p = mk();
  const s = newSession('2026-10-17');
  const first = currentOp(s, p, cfg);
  submitAnswer(s, p, cfg, first.answer + 1);
  for (let i = 0; i < 30; i++) {
    const op = currentOp(s, p, cfg);
    submitAnswer(s, p, cfg, op.key === first.key ? op.answer + 1 : op.answer);
  }
  assert.equal(s.wrong, 1);
});
