import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FS_CONSUMER_KEY = Deno.env.get("FATSECRET_CONSUMER_KEY")!;
const FS_CONSUMER_SECRET = Deno.env.get("FATSECRET_CONSUMER_SECRET")!;
const FS_API_URL = "https://platform.fatsecret.com/rest/server.api";

// RFC 3986 percent-encoding
function pEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

// HMAC-SHA1 via Deno's built-in Web Crypto
async function hmacSha1Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    enc.encode(message),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function buildFatSecretUrl(
  apiMethod: string,
  extraParams: Record<string, string> = {},
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: FS_CONSUMER_KEY,
    oauth_nonce: Math.random().toString(36).slice(2) + Date.now(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
  };

  const allParams: Record<string, string> = {
    ...oauthParams,
    format: "json",
    method: apiMethod,
    ...extraParams,
  };

  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${pEncode(k)}=${pEncode(allParams[k])}`)
    .join("&");

  const baseString = [
    "GET",
    pEncode(FS_API_URL),
    pEncode(paramString),
  ].join("&");

  const signingKey = `${pEncode(FS_CONSUMER_SECRET)}&`;
  const signature = await hmacSha1Base64(signingKey, baseString);

  const finalParams = { ...allParams, oauth_signature: signature };
  const qs = Object.keys(finalParams)
    .sort()
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(finalParams[k])}`,
    )
    .join("&");

  return `${FS_API_URL}?${qs}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query } = await req.json();
    if (!query?.trim()) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = await buildFatSecretUrl("foods.search", {
      search_expression: query,
      max_results: "6",
      page_number: "0",
    });

    const fsRes = await fetch(url);
    const data = await fsRes.json();

    const foodList = data?.foods?.food;
    if (!foodList) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const foods = Array.isArray(foodList) ? foodList : [foodList];
    const results = foods.map((f: Record<string, string>) => {
      const desc = f.food_description || "";
      return {
        food_name: f.food_name,
        brand: f.brand_name || "",
        serving_size: desc.split(" - ")[0]?.trim() || "100g",
        calories: parseFloat(
          desc.match(/Calories:\s*([\d.]+)/)?.[1] || "0",
        ),
        protein: parseFloat(
          desc.match(/Protein:\s*([\d.]+)/)?.[1] || "0",
        ),
        carbs: parseFloat(desc.match(/Carbs:\s*([\d.]+)/)?.[1] || "0"),
        fat: parseFloat(desc.match(/Fat:\s*([\d.]+)/)?.[1] || "0"),
        fiber: 0,
        sugar: 0,
      };
    });

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message, results: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
