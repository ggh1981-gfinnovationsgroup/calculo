import { rng, randInt } from './prng.js';

export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const toUtcDay = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

export const daysBetween = (a, b) => toUtcDay(b) - toUtcDay(a);

/** Lunes de la semana de `dk`, como clave de fecha. */
export function weekKey(dk) {
  const day = toUtcDay(dk);
  const dow = (((day + 4) % 7) + 7) % 7; // 0 = domingo
  const monday = day - ((dow + 6) % 7);
  const d = new Date(monday * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function dayTotals(entry) {
  const t = { ms: 0, answered: 0, correct: 0, wrong: 0 };
  for (const p of Object.values(entry?.parts || {})) {
    t.ms += p.ms || 0;
    t.answered += p.answered || 0;
    t.correct += p.correct || 0;
    t.wrong += p.wrong || 0;
  }
  return t;
}

export function recordProgress(profile, session) {
  const e = (profile.history[session.date] ||= { completed: false, parts: {} });
  e.parts[session.extra ? 'x' : 'd'] = {
    ms: Math.round(session.elapsedMs),
    answered: session.answered,
    correct: session.correct,
    wrong: session.wrong,
  };
}

export const isDoneToday = (profile, dk) => !!profile.history[dk]?.completed;

/** Racha visible: sigue viva mientras los días perdidos quepan en los días de gracia. */
export function currentStreak(profile, dk) {
  const s = profile.streak;
  if (!s.last) return 0;
  const gap = daysBetween(s.last, dk);
  if (gap <= 1) return s.current;
  return gap - 1 <= s.grace ? s.current : 0;
}

export function updateStreak(profile, dk, cfg) {
  const s = profile.streak;
  if (s.last === dk) return { graceUsed: 0 };
  let graceUsed = 0;
  if (!s.last) s.current = 1;
  else {
    const missed = daysBetween(s.last, dk) - 1;
    if (missed <= 0) s.current += 1;
    else if (missed <= s.grace) {
      s.grace -= missed;
      graceUsed = missed;
      s.current += 1;
    } else s.current = 1;
  }
  s.last = dk;
  s.best = Math.max(s.best, s.current);
  if (s.current % 7 === 0 && s.grace < cfg.rewards.graceMax) s.grace += 1;
  return { graceUsed };
}

export function streakBonus(streak, cfg) {
  for (const [days, coins] of cfg.rewards.streakBonuses) if (streak >= days) return coins;
  return 0;
}

export function mascotStage(streak) {
  if (streak >= 30) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

export const MASCOT = ['🥚', '🐣', '🐥', '🐔', '🦅'];

export function weekCount(profile, dk) {
  const wk = weekKey(dk);
  return Object.entries(profile.history).filter(([k, e]) => e.completed && weekKey(k) === wk).length;
}

export function familyProgress(state, dk) {
  let done = 0;
  let target = 0;
  for (const p of state.profiles) {
    target += p.weekGoal || 5;
    done += Math.min(weekCount(p, dk), p.weekGoal || 5);
  }
  return { done, target };
}

export function recordTable(profile, op, correct, first, cfg) {
  if (op.op !== 'x' || !first) return;
  for (const n of new Set([op.a, op.b])) {
    if (n < 1 || n > 12) continue;
    const t = (profile.stats.tables[n] ||= { c: 0, t: 0 });
    t.t += 1;
    if (correct) t.c += 1;
  }
}

export function masteredTables(profile, cfg) {
  return Object.values(profile.stats.tables).filter(
    (t) => t.t >= cfg.tables.minAnswers && t.c / t.t >= cfg.tables.minAccuracy
  ).length;
}

export function checkBadges(profile, badges, cfg, ctxInfo = {}) {
  const earned = [];
  const has = new Set(profile.badges);
  const m = {
    sessions: profile.stats.sessions,
    streak: profile.streak.current,
    perfect: profile.stats.perfect,
    tables: masteredTables(profile, cfg),
    week: ctxInfo.weekDone ? 1 : 0,
    reading: profile.stats.readings || 0,
  };
  for (const b of badges) {
    if (b.type === 'special' || has.has(b.id)) continue;
    if (m[b.type] >= b.value) {
      profile.badges.push(b.id);
      earned.push(b.id);
    }
  }
  return earned;
}

export function finalizeSession(state, profile, session, dk, cfg, badges) {
  const res = { extra: session.extra, coins: 0, breakdown: [], newBadges: [], graceUsed: 0, stats: {
    answered: session.answered, correct: session.correct, wrong: session.wrong,
  } };
  session.done = true;
  session.elapsedMs = cfg.session.activeMs;
  recordProgress(profile, session);
  profile.session = null;
  if (session.extra) return res;

  const e = profile.history[dk];
  e.completed = true;
  profile.stats.sessions += 1;
  if (session.wrong === 0 && session.fresh >= cfg.session.blockSize) profile.stats.perfect += 1;
  res.graceUsed = updateStreak(profile, dk, cfg).graceUsed;

  const add = (key, coins) => {
    if (coins <= 0) return;
    res.breakdown.push({ key, coins });
    res.coins += coins;
  };
  add('base', Math.max(0, cfg.rewards.fullCoins - session.partialAwarded));
  add('streak', streakBonus(profile.streak.current, cfg));

  const wk = weekKey(dk);
  const weekDone = weekCount(profile, dk) >= (profile.weekGoal || 5);
  if (weekDone && profile.weekBonusKey !== wk) {
    profile.weekBonusKey = wk;
    add('week', cfg.rewards.weekGoalBonus);
  }
  if (state.profiles.length > 1 && state.family.bonusWeek !== wk) {
    const fp = familyProgress(state, dk);
    if (fp.done >= fp.target) {
      state.family.bonusWeek = wk;
      for (const p of state.profiles) if (p.id !== profile.id) p.coins += cfg.rewards.familyGoalBonus;
      add('family', cfg.rewards.familyGoalBonus);
    }
  }
  profile.coins += res.coins;
  res.newBadges = checkBadges(profile, badges, cfg, { weekDone });
  return res;
}

export const canOpenChest = (profile, dk) => isDoneToday(profile, dk) && profile.chestDate !== dk;

export function openChest(profile, dk, cfg, shopItems) {
  profile.chestDate = dk;
  const r = rng(`${profile.id}|${dk}|chest`);
  const free = shopItems.filter((i) => !profile.owned.includes(i.id));
  if (free.length && r() < cfg.rewards.chestItemChance) {
    const item = free[Math.floor(r() * free.length)];
    profile.owned.push(item.id);
    return { type: 'item', id: item.id };
  }
  const coins = randInt(r, cfg.rewards.chestMin, cfg.rewards.chestMax);
  profile.coins += coins;
  return { type: 'coins', coins };
}
