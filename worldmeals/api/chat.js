// WorldMeals AI endpoint (Vercel Edge).
// - Only WorldMeals-style requests are forwarded to Claude (fixed model, capped length).
// - Explorer (free) users get 5 AI recipes in total, counted HERE on the server, so deleting and
//   reinstalling the app or clearing its data no longer resets the count.
// - A credit is only used when Claude actually returns a recipe; failures are refunded.
// - Daily limits per network connection (IP) stop anyone from hammering the endpoint.
//
// Needs an Upstash Redis database connected to the Vercel project (Storage → Upstash Redis).
// Vercel adds the connection settings automatically (KV_REST_API_URL / KV_REST_API_TOKEN,
// or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). ANTHROPIC_API_KEY stays as it is today.

export const config = { runtime: 'edge' };

// ---- Settings you can change -------------------------------------------------------------
const MODEL = 'claude-sonnet-4-6';      // the only model the app may use
const MAX_TOKENS = 1500;                 // longest answer allowed (app uses 1000 and 1300)
const MAX_PROMPT_CHARS = 8000;           // longest question allowed
const FREE_AI_RECIPES = 5;               // Explorer lifetime credits
const EXPLORER_IP_PER_DAY = 10;          // free AI recipes per network per day (stops reinstall loops)
const PAID_ID_PER_DAY = 60;              // VERIFIED Chef/Passport: cap per app install per day
const PAID_IP_PER_DAY = 120;             // VERIFIED Chef/Passport: cap per network per day
const CLAIMED_ID_PER_DAY = 20;           // claimed-but-unverified paid plan (iPhone until Apple is verified)
const CLAIMED_IP_PER_DAY = 40;
// Set ENTITLEMENT_STRICT=true in Vercel once Apple purchases are verified too: then a paid plan
// without a server-signed pass is treated as Explorer.
const STRICT = process.env.ENTITLEMENT_STRICT === 'true';
// ------------------------------------------------------------------------------------------

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }
  });

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// Run several Redis commands in one request (Upstash REST pipeline).
async function redis(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands)
  });
  if (!r.ok) throw new Error('Credit database unavailable');
  const out = await r.json();
  return out.map(x => {
    if (x.error) throw new Error('Credit database error');
    return x.result;
  });
}

// The app's anonymous install ID looks like "anon_k3j9x0a2b_1727800000000".
// "dev_..." is reserved for a future ID that survives reinstalls (iPhone Keychain or a free account).
const ID_PATTERN = /^(anon_[a-z0-9]{1,16}_\d{10,14}|dev_[A-Za-z0-9-]{16,64})$/;

function clientIp(req) {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim();
}

// Check the signed "verified plan" pass issued by /api/play-verify (HMAC-SHA256, ENTITLEMENT_SECRET).
async function verifiedPlan(token) {
  const secret = process.env.ENTITLEMENT_SECRET;
  if (!secret || !token || token.length > 2000) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, fromB64(sig), new TextEncoder().encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64(payload)));
    if (!['chef', 'passport'].includes(data.p) || !(data.exp * 1000 > Date.now())) return null;
    return data.p;
  } catch { return null; }
}

const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const TWO_DAYS = 60 * 60 * 48;

export default async function handler(req) {
  const id = req.headers.get('x-wm-id') || '';
  const claimsPaid = ['chef', 'passport'].includes(req.headers.get('x-wm-plan'));
  const verified = await verifiedPlan(req.headers.get('x-wm-entitlement'));
  // 'paid' = verified by this server · 'claimed' = app says paid but not verified · 'explorer'
  const plan = verified ? 'paid' : (claimsPaid && !STRICT ? 'claimed' : 'explorer');
  const haveDb = Boolean(REDIS_URL && REDIS_TOKEN);

  // ---- GET /api/chat : how many free AI recipes does this install have left? ----
  if (req.method === 'GET') {
    if (!ID_PATTERN.test(id)) return json({ error: 'Missing app ID' }, 400);
    if (!haveDb) return json({ remaining: null });
    try {
      const [used] = await redis([['GET', `wm:ai:used:${id}`]]);
      const remaining = Math.max(0, FREE_AI_RECIPES - Number(used || 0));
      return json({ remaining }, 200, { 'X-WM-AI-Remaining': String(remaining) });
    } catch {
      return json({ remaining: null });
    }
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ID_PATTERN.test(id)) return json({ error: 'Please update WorldMeals to use AI recipes.' }, 400);

  // ---- Only accept WorldMeals-style requests: one question, fixed model, capped length ----
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const msgs = Array.isArray(body?.messages) ? body.messages : [];
  const prompt = msgs.length === 1 && msgs[0]?.role === 'user' && typeof msgs[0]?.content === 'string'
    ? msgs[0].content : null;
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) return json({ error: 'Invalid AI request' }, 400);
  const safeBody = {
    model: MODEL,
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 1000, 1), MAX_TOKENS),
    messages: [{ role: 'user', content: prompt }]
  };

  // ---- Reserve a credit before calling Claude (refunded below if Claude fails) ----
  const ip = clientIp(req), day = today();
  let reserved = [];          // keys we incremented, so we can refund them
  let remainingAfter = null;  // free recipes left after this one (Explorer only)

  if (haveDb) {
    try {
      if (plan === 'explorer') {
        const usedKey = `wm:ai:used:${id}`, ipKey = `wm:ai:ipfree:${ip}:${day}`;
        const [used, ipCount] = await redis([['INCR', usedKey], ['INCR', ipKey], ['EXPIRE', ipKey, TWO_DAYS]]);
        reserved = [usedKey, ipKey];
        if (used > FREE_AI_RECIPES) {
          await redis(reserved.map(k => ['DECR', k]));
          return json({ error: 'You’ve used all 5 free AI recipes. Upgrade to Chef for unlimited AI recipes.', code: 'ai_credits_exhausted', remaining: 0 },
            402, { 'X-WM-AI-Remaining': '0' });
        }
        if (ipCount > EXPLORER_IP_PER_DAY) {
          await redis(reserved.map(k => ['DECR', k]));
          return json({ error: 'Too many free AI recipes from this network today. Please try again tomorrow.', code: 'ai_daily_limit' }, 429);
        }
        remainingAfter = FREE_AI_RECIPES - used;
      } else {
        const tier = plan === 'paid' ? 'paid' : 'claimed';
        const idKey = `wm:ai:${tier}:${id}:${day}`, ipKey = `wm:ai:ip${tier}:${ip}:${day}`;
        const [idCount, , ipCount] = await redis([['INCR', idKey], ['EXPIRE', idKey, TWO_DAYS], ['INCR', ipKey], ['EXPIRE', ipKey, TWO_DAYS]]);
        reserved = [idKey, ipKey];
        const [idCap, ipCap] = tier === 'paid' ? [PAID_ID_PER_DAY, PAID_IP_PER_DAY] : [CLAIMED_ID_PER_DAY, CLAIMED_IP_PER_DAY];
        if (idCount > idCap || ipCount > ipCap) {
          await redis(reserved.map(k => ['DECR', k]));
          return json({ error: 'Daily AI limit reached. Please try again tomorrow.', code: 'ai_daily_limit' }, 429);
        }
      }
    } catch {
      // If the credit database is briefly down, keep the app working rather than blocking users.
      reserved = [];
    }
  }

  const refund = async () => { if (reserved.length) { try { await redis(reserved.map(k => ['DECR', k])); } catch {} } };

  // ---- Call Claude ----
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(safeBody)
    });
    const text = await response.text();
    if (!response.ok) await refund();
    const extra = response.ok && remainingAfter !== null ? { 'X-WM-AI-Remaining': String(remainingAfter) } : {};
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }
    });
  } catch (err) {
    await refund();
    return json({ error: 'AI is unavailable right now. No credit was used.' }, 502);
  }
}
