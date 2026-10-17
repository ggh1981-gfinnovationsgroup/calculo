// Cloudflare Worker: guarda un bloque cifrado por familia. No puede leer los datos.
const MAX_BLOB = 300000;
const ID_RE = /^[0-9a-f]{64}$/;

const cors = (env, req) => {
  const origin = req.headers.get('Origin');
  const ok = origin && origin === env.ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'X-Family-Id,Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const json = (data, status, headers) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/v1/health') return json({ ok: true }, 200, h);
    if (url.pathname !== '/v1/family') return json({ error: 'not_found' }, 404, h);
    if (req.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ error: 'forbidden' }, 403, h);

    const id = req.headers.get('X-Family-Id') || '';
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!ID_RE.test(id) || !ID_RE.test(token)) return json({ error: 'bad_request' }, 400, h);
    const tokenHash = await sha256Hex(token);

    const row = await env.DB.prepare('SELECT token_hash, rev, blob FROM families WHERE id = ?').bind(id).first();
    if (row && !safeEqual(row.token_hash, tokenHash)) return json({ error: 'unauthorized' }, 401, h);

    if (req.method === 'GET') {
      if (!row) return json({ error: 'not_found' }, 404, h);
      return json({ rev: row.rev, blob: row.blob }, 200, h);
    }

    if (req.method === 'DELETE') {
      if (row) await env.DB.prepare('DELETE FROM families WHERE id = ?').bind(id).run();
      return json({ ok: true }, 200, h);
    }

    if (req.method === 'PUT') {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: 'bad_json' }, 400, h);
      }
      const { baseRev, blob } = body || {};
      if (typeof blob !== 'string' || blob.length > MAX_BLOB || !Number.isInteger(baseRev) || baseRev < 0) {
        return json({ error: 'bad_request' }, 400, h);
      }
      const now = Date.now();
      if (!row) {
        await env.DB.prepare('INSERT INTO families (id, token_hash, rev, blob, updated_at) VALUES (?, ?, 1, ?, ?)')
          .bind(id, tokenHash, blob, now).run();
        return json({ rev: 1 }, 200, h);
      }
      if (row.rev !== baseRev) return json({ rev: row.rev, blob: row.blob }, 409, h);
      const res = await env.DB.prepare('UPDATE families SET blob = ?, rev = rev + 1, updated_at = ? WHERE id = ? AND rev = ?')
        .bind(blob, now, id, baseRev).run();
      if (!res.meta.changes) {
        const cur = await env.DB.prepare('SELECT rev, blob FROM families WHERE id = ?').bind(id).first();
        return json({ rev: cur.rev, blob: cur.blob }, 409, h);
      }
      return json({ rev: baseRev + 1 }, 200, h);
    }

    return json({ error: 'method_not_allowed' }, 405, h);
  },
};
