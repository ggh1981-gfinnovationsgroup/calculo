const union = (a = [], b = []) => [...new Set([...a, ...b])];

function mergeHistory(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k];
    const y = b[k];
    if (!x || !y) {
      out[k] = structuredClone(x || y);
      continue;
    }
    const parts = {};
    for (const key of new Set([...Object.keys(x.parts || {}), ...Object.keys(y.parts || {})])) {
      const p = x.parts?.[key];
      const q = y.parts?.[key];
      parts[key] = !p ? q : !q ? p : (q.ms || 0) > (p.ms || 0) ? q : p;
    }
    out[k] = { completed: !!(x.completed || y.completed), parts };
  }
  return out;
}

function mergeProfile(p, q) {
  p.badges = union(p.badges, q.badges);
  p.owned = union(p.owned, q.owned);
  p.history = mergeHistory(p.history, q.history);
  p.streak.best = Math.max(p.streak.best, q.streak.best);
  if ((q.streak.last || '') > (p.streak.last || '')) {
    p.streak.last = q.streak.last;
    p.streak.current = q.streak.current;
    p.streak.grace = q.streak.grace;
  }
  p.stats.sessions = Math.max(p.stats.sessions, q.stats.sessions);
  p.stats.perfect = Math.max(p.stats.perfect, q.stats.perfect);
  for (const [n, t] of Object.entries(q.stats.tables || {})) {
    const own = p.stats.tables[n];
    if (!own || t.t > own.t) p.stats.tables[n] = t;
  }
}

/** Fusiona dos estados: gana el más reciente como base y se unen insignias, objetos e historial. */
export function mergeStates(a, b) {
  const [base, other] = (a.updatedAt || 0) >= (b.updatedAt || 0) ? [a, b] : [b, a];
  const out = structuredClone(base);
  const tomb = new Set([...(a.deleted || []), ...(b.deleted || [])]);
  out.deleted = [...tomb];
  const byId = new Map(out.profiles.map((p) => [p.id, p]));
  for (const p of other.profiles) {
    if (tomb.has(p.id)) continue;
    const mine = byId.get(p.id);
    if (!mine) out.profiles.push(structuredClone(p));
    else mergeProfile(mine, p);
  }
  out.profiles = out.profiles.filter((p) => !tomb.has(p.id));
  const rewards = new Map((out.parent.rewards || []).map((r) => [r.id, r]));
  for (const r of other.parent.rewards || []) {
    const mine = rewards.get(r.id);
    if (!mine) out.parent.rewards.push(structuredClone(r));
    else mine.delivered = !!(mine.delivered || r.delivered);
  }
  return out;
}
