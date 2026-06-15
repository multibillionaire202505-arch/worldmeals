export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await req.json();

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return new Response(error, { status: response.status });
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
