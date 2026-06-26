export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const query = url.searchParams.get('query');
  
  if (!query) {
    return new Response(JSON.stringify({ error: 'No query' }), { status: 400 });
  }

  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    {
      headers: {
        'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
      }
    }
  );

  const data = await response.json();
  const photo = data.results?.[0];

  return new Response(JSON.stringify({
    url: photo?.urls?.regular || null
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
