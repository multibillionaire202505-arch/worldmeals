export const config = { runtime: 'edge' };

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  
  const url = new URL(req.url);
  const query = url.search;
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/saves${query}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: req.method !== 'GET' && req.method !== 'DELETE' ? await req.text() : undefined
  });

  const text = await response.text();
  return new Response(text || '[]', {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
}
