import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_SITE_URL =
  Deno.env.get("OPENROUTER_SITE_URL") || "https://repmax.vercel.app";
const OPENROUTER_SITE_NAME =
  Deno.env.get("OPENROUTER_SITE_NAME") || "REPMAX";
const DEFAULT_TEXT_MODEL =
  Deno.env.get("OPENROUTER_DEFAULT_MODEL") ||
  "meta-llama/llama-3.3-70b-instruct:exacto";

function getUpstreamErrorMessage(payload: unknown, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;

  if (typeof payload === "object") {
    const value = payload as Record<string, unknown>;

    if (typeof value.error === "string") return value.error;
    if (typeof value.message === "string") return value.message;
    if (typeof value.raw === "string") return value.raw;

    if (value.error && typeof value.error === "object") {
      const nested = value.error as Record<string, unknown>;
      if (typeof nested.message === "string") return nested.message;
      if (typeof nested.code === "string") return nested.code;

      if (nested.metadata && typeof nested.metadata === "object") {
        const metadata = nested.metadata as Record<string, unknown>;
        if (typeof metadata.raw === "string") return metadata.raw;
      }
      try { return JSON.stringify(value.error); } catch { return fallback; }
    }
  }

  return fallback;
}

// Simple in-memory rate limiting (per isolate)
// Stores array of timestamps for each user
// Limit: max 15 requests per minute
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 15;
const rateLimits = new Map<string, number[]>();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate Limiting Logic
    const now = Date.now();
    const userHistory = rateLimits.get(user.id) || [];
    // Clear old timestamps
    const recentHistory = userHistory.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    
    if (recentHistory.length >= MAX_REQUESTS_PER_WINDOW) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    recentHistory.push(now);
    rateLimits.set(user.id, recentHistory);

    // Payload validation to prevent massive context windows
    const bodyStr = await req.text();
    if (bodyStr.length > 3000000) {
      return new Response(JSON.stringify({ error: "Payload too large. Maximum size exceeded." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = JSON.parse(bodyStr);
    const payload = {
      ...body,
      model: body?.model || DEFAULT_TEXT_MODEL,
    };

    const upstreamRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_SITE_URL,
        "X-Title": OPENROUTER_SITE_NAME,
      },
      body: JSON.stringify(payload),
    });

    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({
        error: getUpstreamErrorMessage(
          data,
          `OpenRouter request failed with status ${upstreamRes.status}.`,
        ),
        details: data,
      }), {
        status: upstreamRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: upstreamRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
