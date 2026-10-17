import { generateOps } from './generator.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Nivel de contenido efectivo para un perfil; el niño nunca ve este dato. */
export function levelFor(profile, cfg) {
  const m = cfg.levels.modes;
  if (profile.mode === 'onedigit') return { level: profile.level, oneDigit: true };
  let lv = profile.level;
  if (profile.mode === 'challenge') lv = profile.level * m.challengeMultiplier;
  else if (profile.mode === 'confidence') lv = profile.level + m.confidenceOffset;
  if (profile.adaptive) lv += profile.adaptiveOffset || 0;
  return { level: clamp(Math.round(lv), 1, 9), oneDigit: false };
}

/** Etiqueta visible: solo "confianza" muestra un grado (superior); los demás modos son neutros. */
export function sessionLabel(profile, cfg) {
  if (profile.mode === 'confidence') {
    return { kind: 'grade', grade: clamp(profile.level + cfg.levels.modes.labelOffset, 1, 9) };
  }
  return { kind: 'neutral' };
}

export function newSession(date, extra = false) {
  return {
    date,
    extra,
    elapsedMs: 0,
    answered: 0,
    correct: 0,
    wrong: 0,
    fresh: 0,
    firstTry: 0,
    freshInBlock: 0,
    blockCorrect: 0,
    blocks: 0,
    genIndex: 0,
    queue: [],
    seen: [],
    partialAwarded: 0,
    done: false,
  };
}

function fillQueue(session, profile, cfg) {
  const { level, oneDigit } = levelFor(profile, cfg);
  const seed = `${profile.id}|${session.date}|${session.extra ? 'x' : 'd'}|${session.genIndex}|${level}|${oneDigit}`;
  const ops = generateOps(cfg.levels, {
    level,
    oneDigit,
    seed,
    count: cfg.app.session.blockSize,
    seen: new Set(session.seen),
  });
  session.seen.push(...ops.map((o) => o.key));
  session.queue.push(...ops);
  session.genIndex += 1;
}

export function currentOp(session, profile, cfg) {
  if (session.queue.length === 0) fillQueue(session, profile, cfg);
  return session.queue[0];
}

function adapt(profile, accuracy, a) {
  if (!profile.adaptive) return;
  let off = profile.adaptiveOffset || 0;
  if (accuracy >= a.up) off += a.step;
  else if (accuracy < a.down) off -= a.step;
  profile.adaptiveOffset = clamp(off, a.min, a.max);
}

export function submitAnswer(session, profile, cfg, value) {
  const op = session.queue.shift();
  const correct = value === op.answer;
  const first = !op.retry;
  session.answered += 1;
  if (correct) session.correct += 1;
  else session.wrong += 1;
  if (first) {
    session.fresh += 1;
    session.freshInBlock += 1;
    if (correct) {
      session.firstTry += 1;
      session.blockCorrect += 1;
    }
  }
  // Errores sin castigo: la operación vuelve a aparecer unas posiciones después.
  if (!correct) session.queue.splice(Math.min(4, session.queue.length), 0, { ...op, retry: true });
  let blockDone = false;
  if (session.freshInBlock >= cfg.app.session.blockSize) {
    blockDone = true;
    adapt(profile, session.blockCorrect / session.freshInBlock, cfg.app.adaptive);
    session.blocks += 1;
    session.freshInBlock = 0;
    session.blockCorrect = 0;
  }
  return { correct, op, first, blockDone };
}

export function partialDelta(session, cfg) {
  const frac = Math.min(1, session.elapsedMs / cfg.app.session.activeMs);
  return Math.max(0, Math.floor(cfg.app.rewards.partialCoinsMax * frac) - session.partialAwarded);
}
