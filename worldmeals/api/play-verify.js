// WorldMeals — verify and acknowledge Google Play subscription purchases (Vercel).
//
// The Android app sends { productId, purchaseToken }. This endpoint asks Google Play whether the
// subscription is real and active, ACKNOWLEDGES it (Google refunds purchases that are not
// acknowledged within 3 days), and returns which plan it unlocks.
//
// Needs one Vercel environment variable:
//   GOOGLE_PLAY_SERVICE_ACCOUNT = the full JSON key of a Google Cloud service account that has been
//   invited in Play Console (Users and permissions) with access to WorldMeals' orders/subscriptions.
// Apple / StoreKit purchases are not involved here at all.

export const config = { runtime: 'edge' };

const PACKAGE_NAME = 'app.worldmeals.android';
const PLANS = {
  'app.worldmeals.chef.monthly': 'chef',
  'app.worldmeals.chef.annual': 'chef',
  'app.worldmeals.passport.monthly': 'passport',
  'app.worldmeals.passport.annual': 'passport'
};
// Google still gives access in these states (canceled = renewal turned off but paid time remains).
const ACTIVE_STATES = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const b64url = (input) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedToken = null; // { value, expiresAt }

// Sign in to Google as the service account (OAuth 2.0 JWT bearer flow, RS256 via Web Crypto).
async function googleAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Google Play is not configured on the server yet.');
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(signature)}`
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error('Could not sign in to Google Play.');
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const productId = String(body?.productId || '');
  const purchaseToken = String(body?.purchaseToken || '');
  if (!PLANS[productId] || !purchaseToken || purchaseToken.length > 1000) return json({ error: 'Invalid purchase' }, 400);

  try {
    const token = await googleAccessToken();
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases`;

    // 1. Ask Google Play about this purchase.
    const r = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (r.status === 404 || r.status === 410) return json({ active: false, plan: 'explorer', productId, error: 'Purchase not found' });
    if (!r.ok) return json({ error: 'Google Play could not check this purchase right now.' }, 502);
    const sub = await r.json();

    // The token must really belong to the product the app claims.
    const line = (sub.lineItems || []).find(li => li.productId === productId);
    if (!line) return json({ error: 'Purchase does not match this plan.' }, 400);

    const expiry = line.expiryTime ? Date.parse(line.expiryTime) : 0;
    const active = ACTIVE_STATES.has(sub.subscriptionState) && expiry > Date.now();

    // 2. Acknowledge it (required within 3 days, or Google refunds the customer).
    if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' &&
        ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(sub.subscriptionState)) {
      const ack = await fetch(`${base}/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!ack.ok) return json({ error: 'Could not confirm the purchase with Google Play. Please try again.' }, 502);
    }

    return json({
      active,
      plan: active ? PLANS[productId] : 'explorer',
      productId,
      expiryTime: line.expiryTime || null,
      isTrial: Boolean(line.offerPhase && line.offerPhase.freeTrial),
      state: sub.subscriptionState
    });
  } catch (err) {
    return json({ error: err.message || 'Google Play check failed.' }, 500);
  }
}
