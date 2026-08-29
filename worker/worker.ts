/* ============================================================
 * STATUS: FROZEN — not in use by frontend. See docs/ETHICS.md section 8.
 * Do not wire this up without parent consent flow + authentication + COPPA audit.
 * This file exists for future reference only.
 * PENDING DECISION (tracked, no issue-tracker access from sandbox):
 *   "Decide: delete or revive worker backend"
 *   - If revived: needs auth (signed parent tokens), CORS lockdown,
 *     rate limiting, and an explicit ETHICS.md amendment first.
 *   - If deleted: remove worker/ + db/schema.sql + wrangler.toml together.
 *
 * Lenny Garden edge API (Cloudflare Worker).
 * Holds DB credentials as Worker SECRETS (never in the repo).
 * Exposes a tiny JSON API the static site calls:
 *   GET  /garden/:id          -> GardenData
 *   PUT  /garden/:id          -> save GardenData
 *   GET  /garden/:id/friends  -> friends list (future)
 *
 * Secrets (set via `wrangler secret put`, NOT committed):
 *   TURSO_URL, TURSO_TOKEN   (or SUPABASE_URL/SUPABASE_ANON_KEY)
 * ============================================================ */

export interface Env {
  TURSO_URL?: string;
  TURSO_TOKEN?: string;
}

interface GardenData { firstSeen: number; lights: number; zones: Record<string, any>; }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function tursoQuery(env: Env, sql: string, args: any[] = []): Promise<any> {
  const res = await fetch(`${env.TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TURSO_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, args } }] },
  });
  return res.json();
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/garden\/([a-zA-Z0-9-]+)$/);
    if (!m) return new Response('not found', { status: 404, headers: cors });
    const id = m[1];

    if (!env.TURSO_URL || !env.TURSO_TOKEN) {
      return new Response(JSON.stringify({ error: 'db not configured' }), { status: 503, headers: cors });
    }

    if (req.method === 'GET') {
      const out = await tursoQuery(env, 'SELECT data FROM gardens WHERE profile_id = ?', [{ type: 'text', value: id }]);
      const row = out?.results?.[0]?.rows?.[0];
      const data = row ? JSON.parse(row[0] as string) : null;
      return new Response(JSON.stringify(data), { headers: cors });
    }

    if (req.method === 'PUT') {
      const body = (await req.json()) as GardenData;
      await tursoQuery(env,
        'INSERT INTO gardens(profile_id, data, updated_at) VALUES(?,?,?) ON CONFLICT(profile_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',
        [{ type: 'text', value: id }, { type: 'text', value: JSON.stringify(body) }, { type: 'integer', value: Date.now() }]);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    return new Response('method not allowed', { status: 405, headers: cors });
  },
};
