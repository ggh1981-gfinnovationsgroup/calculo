export function newId() {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const defaultState = () => ({
  app: 'calculo',
  v: 1,
  lang: null,
  parent: { pin: null, consent: null, rewards: [] },
  profiles: [],
  family: { bonusWeek: null },
  deleted: [],
  sync: null,
  pendingAge14: false,
  updatedAt: 0,
});

export function newProfile({ nick, avatar, lang, level }, graceStart = 2) {
  return fillProfile({ id: newId(), nick, avatar, lang, level, streak: { current: 0, best: 0, last: null, grace: graceStart }, createdAt: Date.now() });
}

export function fillProfile(p) {
  return {
    mode: 'grade',
    adaptive: false,
    adaptiveOffset: 0,
    bilingual: false,
    sound: true,
    reduceMotion: false,
    coins: 0,
    badges: [],
    owned: [],
    equipped: { color: null, accessory: null, background: null },
    history: {},
    session: null,
    chestDate: null,
    weekGoal: 5,
    weekBonusKey: null,
    readDate: null,
    ...p,
    streak: { current: 0, best: 0, last: null, grace: 2, ...p.streak },
    stats: { sessions: 0, perfect: 0, readings: 0, tables: {}, ...p.stats },
  };
}

export function normalize(s) {
  if (!s || s.app !== 'calculo') return defaultState();
  const d = defaultState();
  return {
    ...d,
    ...s,
    parent: { ...d.parent, ...s.parent },
    family: { ...d.family, ...s.family },
    profiles: (s.profiles || []).map(fillProfile),
  };
}

export function validateImport(obj) {
  const st = obj?.state;
  if (!obj || obj.app !== 'calculo' || !st || !Array.isArray(st.profiles)) return { ok: false, error: 'format' };
  for (const p of st.profiles) {
    if (typeof p.id !== 'string' || typeof p.nick !== 'string' || p.nick.length > 40) return { ok: false, error: 'profile' };
    if (!Number.isInteger(p.level) || p.level < 1 || p.level > 9) return { ok: false, error: 'level' };
  }
  return { ok: true };
}

export function exportPayload(state) {
  const { sync, ...rest } = state;
  return { app: 'calculo', v: 1, exportedAt: new Date().toISOString(), state: rest };
}

export const store = {
  state: null,
  provider: null,
  _t: null,
  async init(provider) {
    this.provider = provider;
    this.state = normalize(await provider.load());
  },
  commit() {
    this.state.updatedAt = Date.now();
    clearTimeout(this._t);
    this._t = setTimeout(() => this.flush(), 300);
  },
  async flush() {
    clearTimeout(this._t);
    await this.provider.save(this.state);
  },
  replace(s) {
    this.state = normalize(s);
  },
  profile(id) {
    return this.state.profiles.find((p) => p.id === id) || null;
  },
  async reset() {
    clearTimeout(this._t);
    await this.provider.clear();
    this.state = defaultState();
  },
};
