export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const query = url.searchParams.get('query') || '';
  
  if (!query) {
    return new Response(JSON.stringify({ error: 'No query' }), { status: 400 });
  }

  // Extract just the dish name (first 1-2 words work best for TheMealDB)
  const mealName = query.split(' ').slice(0, 2).join(' ');

  try {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(mealName)}`
    );
    const data = await response.json();
    const meal = data.meals?.[0];

    if (meal?.strMealThumb) {
      return new Response(JSON.stringify({ url: meal.strMealThumb }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fallback to Unsplash if TheMealDB has no result
    const unsplash = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    const uData = await unsplash.json();
    const photo = uData.results?.[0];

    return new Response(JSON.stringify({ url: photo?.urls?.regular || null }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch(e) {
    return new Response(JSON.stringify({ url: null }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
