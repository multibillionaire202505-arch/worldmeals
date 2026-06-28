export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const rawQuery = url.searchParams.get("query") || "food";

    // DEBUG 1 — check if Vercel can read the key
    if (rawQuery === "debug") {
      return new Response(
        JSON.stringify({
          hasUnsplashKey: !!process.env.UNSPLASH_ACCESS_KEY,
          unsplashKeyLength: process.env.UNSPLASH_ACCESS_KEY
            ? process.env.UNSPLASH_ACCESS_KEY.length
            : 0
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // DEBUG 2 — check Unsplash response directly
    if (rawQuery === "debug-unsplash") {
      const testUrl =
        "https://api.unsplash.com/search/photos?query=Butter%20Chicken&per_page=1&orientation=landscape";

      const testRes = await fetch(testUrl, {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
        }
      });

      const text = await testRes.text();

      return new Response(
        JSON.stringify({
          status: testRes.status,
          ok: testRes.ok,
          body: text.slice(0, 600)
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const clean = rawQuery
      .replace(/\bfood\b/gi, "")
      .replace(/\bdish\b/gi, "")
      .replace(/\brecipe\b/gi, "")
      .replace(/\btraditional\b/gi, "")
      .trim();

    const searches = [
      clean,
      clean.replace(/\bindia\b|\bjapan\b|\bthailand\b|\bitaly\b|\bmexico\b|\bchina\b|\bfrance\b|\bnigeria\b|\bghana\b|\bivory coast\b|\busa\b|\bunited states\b/gi, "").trim(),
      rawQuery,
      `${clean} recipe`,
      `${clean} food`
    ].filter(Boolean);

    // 1. Try TheMealDB
    for (const q of searches) {
      const mealDbRes = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`
      );

      if (mealDbRes.ok) {
        const mealDbData = await mealDbRes.json();
        const meal = mealDbData?.meals?.[0];

        if (meal?.strMealThumb) {
          return new Response(
            JSON.stringify({
              url: meal.strMealThumb,
              source: "themealdb",
              query: q
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 2. Try Unsplash
    for (const q of searches) {
      const unsplashRes = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`,
        {
          headers: {
            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
          }
        }
      );

      if (!unsplashRes.ok) {
        continue;
      }

      const data = await unsplashRes.json();
      const photo = data?.results?.[0];

      if (photo?.urls?.regular) {
        return new Response(
          JSON.stringify({
            url: photo.urls.regular,
            source: "unsplash",
            query: q
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        url: "",
        source: "none"
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        url: "",
        source: "error",
        message: e.message
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
