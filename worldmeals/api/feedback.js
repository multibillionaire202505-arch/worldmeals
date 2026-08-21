export const config = { runtime: 'edge' };

const ALLOWED_TYPES = new Set([
  'recipe',
  'chef',
  'scan',
  'planner',
  'tour',
  'bug',
  'idea',
  'love',
  'other'
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanNullableText(value, maxLength) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'Feedback service is not configured.' }, 500);
  }

  try {
    const body = await req.json();

    const type = cleanText(body?.type, 32).toLowerCase();
    const message = cleanText(body?.message, 3000);

    if (!message) {
      return json({ error: 'Feedback message is required.' }, 400);
    }

    if (!ALLOWED_TYPES.has(type)) {
      return json({ error: 'Invalid feedback type.' }, 400);
    }

    const rawRating = body?.rating;
    let rating = null;

    if (rawRating !== null && rawRating !== undefined && rawRating !== '') {
      const parsed = Number(rawRating);

      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        return json({ error: 'Rating must be between 1 and 5.' }, 400);
      }

      rating = parsed;
    }

    const payload = {
      anonymous_id: cleanNullableText(body?.anonymous_id, 120),
      plan: cleanNullableText(body?.plan, 24),
      product_id: cleanNullableText(body?.product_id, 160),
      type,
      rating,
      message,
      source: cleanNullableText(body?.source, 80),
      meal_id:
        body?.meal_id === null || body?.meal_id === undefined
          ? null
          : cleanNullableText(body.meal_id, 80),
      meal_name: cleanNullableText(body?.meal_name, 200),
      page: cleanNullableText(body?.page, 120),
      client_time: cleanNullableText(body?.client_time, 80)
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase feedback insert failed:', response.status, errorText);
      return json({ error: 'Could not save feedback.' }, 502);
    }

    return json({ ok: true }, 201);

  } catch (error) {
    console.error('WorldMeals feedback endpoint error:', error);
    return json({ error: 'Invalid feedback request.' }, 400);
  }
}

