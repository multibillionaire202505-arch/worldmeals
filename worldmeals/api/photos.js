export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query") || "food";

    // 1) Try TheMealDB first
    const cleanQuery = query
      .replace(/\bfood\b/gi, "")
      .replace(/\bdish\b/gi, "")
      .replace(/\brecipe\b/gi, "")
      .trim();

    const mealDbRes = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(cleanQuery)}`
    );

    if (mealDbRes.ok) {
      const mealDbData = await mealDbRes.json();
      const meal = mealDbData?.meals?.[0];

      if (meal?.strMealThumb) {
        return new Response(JSON.stringify({ url: meal.strMealThumb }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2) Unsplash fallback
    const unsplashRes = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      }
    );

    if (!unsplashRes.ok) {
      return new Response(JSON.stringify({ url: "" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const unsplashData = await unsplashRes.json();
    const photo = unsplashData?.results?.[0];

    return new Response(
      JSON.stringify({
        url: photo?.urls?.regular || ""
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ url: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
