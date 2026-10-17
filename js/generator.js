import { rng, randInt } from './prng.js';

const SYMBOL = { add: '+', sub: '-', mul: 'x', div: '÷' };

export const formatOperand = (n) => (n < 0 ? `(${n})` : String(n));

function build(a, b, sym, answer) {
  return {
    a,
    b,
    op: sym,
    answer,
    key: `${a}${sym}${b}`,
    text: `${formatOperand(a)} ${sym} ${formatOperand(b)}`,
  };
}

function nonZero(r, max) {
  let v = 0;
  while (v === 0) v = randInt(r, -max, max);
  return v;
}

function makeOp(k, r) {
  switch (k.kind) {
    case 'add': {
      const a = randInt(r, k.min, k.max);
      const room = Math.min(k.max, k.resultMax - a);
      const b = room >= k.min ? randInt(r, k.min, room) : k.min;
      return build(a, b, SYMBOL.add, a + b);
    }
    case 'sub': {
      let a = randInt(r, k.min, k.max);
      let b = randInt(r, k.min, k.max);
      if (a < b) [a, b] = [b, a];
      return build(a, b, SYMBOL.sub, a - b);
    }
    case 'mul': {
      const a = randInt(r, k.aMin, k.aMax);
      const b = randInt(r, k.bMin, k.bMax);
      return build(a, b, SYMBOL.mul, a * b);
    }
    case 'div': {
      const d = randInt(r, k.dMin, k.dMax);
      const q = randInt(r, k.qMin, k.qMax);
      return build(d * q, d, SYMBOL.div, q);
    }
    case 'nadd':
    case 'nsub': {
      let a;
      let b;
      do {
        a = nonZero(r, k.max);
        b = nonZero(r, k.max);
      } while (a > 0 && b > 0);
      return k.kind === 'nadd' ? build(a, b, SYMBOL.add, a + b) : build(a, b, SYMBOL.sub, a - b);
    }
    case 'nmul': {
      let a;
      let b;
      do {
        a = nonZero(r, k.max);
        b = nonZero(r, k.max);
      } while (a > 0 && b > 0);
      return build(a, b, SYMBOL.mul, a * b);
    }
    case 'ndiv': {
      let d;
      let q;
      do {
        d = randInt(r, k.dMin, k.dMax) * (r() < 0.5 ? -1 : 1);
        q = randInt(r, k.qMin, k.qMax) * (r() < 0.5 ? -1 : 1);
      } while (d > 0 && q > 0);
      return build(d * q, d, SYMBOL.div, q);
    }
    default:
      throw new Error(`Tipo de operación desconocido: ${k.kind}`);
  }
}

function pickKind(kinds, r) {
  const total = kinds.reduce((s, k) => s + k.weight, 0);
  let x = r() * total;
  for (const k of kinds) {
    x -= k.weight;
    if (x < 0) return k;
  }
  return kinds[kinds.length - 1];
}

/** Genera `count` operaciones deterministas para `seed`, evitando las claves de `seen` mientras haya espacio. */
export function generateOps(levelsCfg, { level, oneDigit = false, seed, count, seen = new Set() }) {
  const kinds = oneDigit ? levelsCfg.oneDigit : levelsCfg.levels[String(level)];
  if (!kinds) throw new Error(`Nivel inválido: ${level}`);
  const r = rng(seed);
  const used = new Set(seen);
  const out = [];
  for (let i = 0; i < count; i++) {
    let cand;
    for (let t = 0; t < 80; t++) {
      cand = makeOp(pickKind(kinds, r), r);
      if (!used.has(cand.key)) break;
    }
    used.add(cand.key);
    out.push(cand);
  }
  return out;
}
