/**
 * WorldMeals Fridge Scan for the ANDROID app — Vercel Serverless Function
 * Path: /api/android-scan.js
 * (Separate copy of /api/scan-fridge.js so the iPhone setup is never affected.)
 *
 * Required Vercel environment variable:
 *   ANTHROPIC_API_KEY
 *
 * The browser sends a compressed data URL. This endpoint strips the prefix,
 * sends the image to Claude Vision, validates the JSON shape, and returns only
 * visible-food detections. It does not store the image.
 *
 * Protection (added): only VERIFIED Passport members may scan (the server-signed Google Play
 * pass the app already sends to /api/chat, checked with ENTITLEMENT_SECRET), plus daily limits
 * per app install and per network using the same Upstash Redis database as /api/chat.
 */

const MAX_BODY_CHARS = 8_000_000;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// ---- Protection settings you can change ----
const SCANS_PER_ID_PER_DAY = 15;   // per app install per day
const SCANS_PER_IP_PER_DAY = 30;   // per network per day
const ID_PATTERN = /^(anon_[a-z0-9]{1,16}_\d{10,14}|dev_[A-Za-z0-9-]{16,64})$/;
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const crypto = require("crypto");

// Same signed pass as /api/chat: base64url(payload).base64url(HMAC-SHA256(payload, ENTITLEMENT_SECRET)).
function verifiedPlan(token) {
  const secret = process.env.ENTITLEMENT_SECRET;
  if (!secret || typeof token !== "string" || token.length > 2000) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest();
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!["chef", "passport"].includes(data.p) || !(data.exp * 1000 > Date.now())) return null;
    return data.p;
  } catch { return null; }
}

async function redis(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  if (!r.ok) throw new Error("Limit database unavailable");
  return (await r.json()).map(x => { if (x.error) throw new Error("Limit database error"); return x.result; });
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return String(fwd ? fwd.split(",")[0] : req.headers["x-real-ip"] || "unknown").trim();
}

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

  // ---- Passport only (verified by this server) ----
  if (verifiedPlan(req.headers["x-wm-entitlement"]) !== "passport") {
    return json(res, 403, { error: "Fridge Scan is part of Passport. Open the menu and tap Restore purchases, or upgrade to Passport.", code: "passport_required" });
  }
  const id = String(req.headers["x-wm-id"] || "");
  if (!ID_PATTERN.test(id)) return json(res, 400, { error: "Please update WorldMeals to use Fridge Scan." });

  // ---- Daily limits (refunded if the scan fails) ----
  let reserved = [];
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const idKey = `wm:scan:id:${id}:${day}`, ipKey = `wm:scan:ip:${clientIp(req)}:${day}`;
      const [idCount, , ipCount] = await redis([["INCR", idKey], ["EXPIRE", idKey, 172800], ["INCR", ipKey], ["EXPIRE", ipKey, 172800]]);
      reserved = [idKey, ipKey];
      if (idCount > SCANS_PER_ID_PER_DAY || ipCount > SCANS_PER_IP_PER_DAY) {
        await redis(reserved.map(k => ["DECR", k]));
        return json(res, 429, { error: "You've reached today's Fridge Scan limit. Please try again tomorrow.", code: "scan_daily_limit" });
      }
    } catch { reserved = []; }
  }
  const refund = async () => { if (reserved.length) { try { await redis(reserved.map(k => ["DECR", k])); } catch {} } };

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
      await refund();
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
    await refund();
    console.error("scan-fridge error", error);
    return json(res, 400, { error: error?.message || "Unable to analyze this image" });
  }
};
