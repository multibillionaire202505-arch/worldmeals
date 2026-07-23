/**
 * WorldMeals Signature Fridge Scan — Vercel Serverless Function
 * Path: /api/scan-fridge.js
 *
 * Required Vercel environment variable:
 *   ANTHROPIC_API_KEY
 *
 * The browser sends a compressed data URL. This endpoint strips the prefix,
 * sends the image to Claude Vision, validates the JSON shape, and returns only
 * visible-food detections. It does not store the image.
 */

const MAX_BODY_CHARS = 8_000_000;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

function parseDataUrl(value) {
  if (typeof value !== "string") throw new Error("Image is required");
  const match = value.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("Unsupported image format");
  const mediaType = match[1];
  const data = match[2].replace(/\s/g, "");
  if (!ALLOWED_MEDIA.has(mediaType)) throw new Error("Unsupported image format");
  if (!data || data.length > MAX_BODY_CHARS) throw new Error("Image is too large");
  return { mediaType, data };
}

function cleanText(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeIngredient(item, index) {
  const confidence = Math.max(0, Math.min(100, Number(item?.confidence || 0)));
  return {
    id: `vision_${index + 1}`,
    name: cleanText(item?.name, 80).toLowerCase(),
    displayName: cleanText(item?.displayName || item?.name, 80),
    quantity: cleanText(item?.quantity, 40),
    state: cleanText(item?.state, 60),
    confidence,
    visible: item?.visible !== false,
    confirmed: true
  };
}

function extractJson(text) {
  const cleaned = String(text || "").replace(/```json|```/gi, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Vision model returned invalid JSON");
  return JSON.parse(cleaned.slice(first, last + 1));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(res, 500, { error: "ANTHROPIC_API_KEY is not configured in Vercel" });
  }

  try {
    const { mediaType, data } = parseDataUrl(req.body?.image);

    const prompt = `You are WorldMeals Vision, a conservative food-identification system.

Analyze this fridge, freezer, pantry, countertop, or grocery photo.

Core rules:
1. Identify only food or cooking ingredients that are reasonably visible.
2. Never infer hidden contents of opaque or closed containers.
3. A readable package label may support identification; an unreadable package must be described conservatively or placed in uncertainObjects.
4. Do not list shelves, bowls, jars, appliances, containers, cleaning products, medicine, or non-food objects as ingredients.
5. Merge duplicates, for example several visible tomatoes become one tomato entry with an estimated quantity.
6. Use common cooking names, singular where practical: "tomato", "chicken breast", "milk".
7. Confidence must reflect visual evidence:
   90–100 clearly visible or clearly labeled,
   70–89 likely,
   50–69 uncertain but plausible.
   Do not return items below 50 confidence; put them in uncertainObjects instead.
8. State may describe visible form only, such as "whole", "opened package", "cooked", "frozen", "sliced", or "container label visible".
9. Do not diagnose spoilage. A useSoonNote may say "visually inspect leafy greens" but must not claim food is unsafe or expired.
10. Return JSON only, with no markdown.

Schema:
{
  "summary": "one concise sentence",
  "imageQuality": "Excellent | Good | Fair | Poor — short reason",
  "useSoonNote": "conservative freshness/use-first guidance",
  "ingredients": [
    {
      "name": "canonical ingredient name",
      "displayName": "friendly display name",
      "quantity": "estimated visible quantity or empty string",
      "state": "visible state or empty string",
      "confidence": 0,
      "visible": true
    }
  ],
  "uncertainObjects": ["short descriptions"]
}`;

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-6",
        max_tokens: 1400,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data
              }
            },
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    const payload = await apiResponse.json();
    if (!apiResponse.ok) {
      const message = payload?.error?.message || "Vision provider request failed";
      return json(res, apiResponse.status >= 400 && apiResponse.status < 600 ? apiResponse.status : 502, { error: message });
    }

    const text = payload?.content?.find(block => block.type === "text")?.text;
    const parsed = extractJson(text);
    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map(normalizeIngredient).filter(x => x.visible && x.name && x.confidence >= 50)
      : [];

    const deduped = ingredients.filter((item, index, array) =>
      array.findIndex(other => other.name === item.name) === index
    );

    return json(res, 200, {
      summary: cleanText(parsed.summary, 240) || `${deduped.length} visible ingredients detected.`,
      imageQuality: cleanText(parsed.imageQuality, 120) || "Analysis complete",
      useSoonNote: cleanText(parsed.useSoonNote, 180) || "Confirm freshness manually before cooking.",
      ingredients: deduped.slice(0, 40),
      uncertainObjects: Array.isArray(parsed.uncertainObjects)
        ? parsed.uncertainObjects.map(x => cleanText(x, 100)).filter(Boolean).slice(0, 10)
        : []
    });
  } catch (error) {
    console.error("scan-fridge error", error);
    return json(res, 400, { error: error?.message || "Unable to analyze this image" });
  }
};
