/**
 * Bytter Snapchat OAuth authorization_code mot access/refresh token.
 * Hemmeligheter leses fra Supabase Secrets (SNAP_CLIENT_SECRET, ev. SNAP_CLIENT_ID).
 * Tokens lagres i public.snap_integration_tokens (kun service_role — ikke lesbar fra nettsiden).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Token-endepunkter varierer litt i Snap-dokumentasjon — prøv alle til én gir access_token.
 * Se: https://developers.snap.com/api/marketing-api/Public-Profile-API/GetStarted
 */
const SNAP_TOKEN_URLS = [
  "https://accounts.snapchat.com/login/oauth2/access_token",
  "https://accounts.snapchat.com/login/oauth2/token",
];

/** CORS: må speile Origin for fetch med Authorization (wildcard * fungerer ikke). */
function corsHeaders(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") || "";
  let allow = "https://mj-universe.net";
  if (/^https:\/\/([a-z0-9-]+\.)*mj-universe\.net$/i.test(o)) allow = o;
  else if (/^http:\/\/localhost(:\d+)?$/i.test(o)) allow = o;
  else if (/^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(o)) allow = o;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const h = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: h });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...h, "Content-Type": "application/json" },
    });
  }

  const clientSecret = Deno.env.get("SNAP_CLIENT_SECRET")?.trim().replace(/^\uFEFF/, "");
  const clientId = Deno.env.get("SNAP_CLIENT_ID")?.trim().replace(/^\uFEFF/, "");
  const redirectUri =
    Deno.env.get("SNAP_REDIRECT_URI")?.trim() ||
    "https://mj-universe.net/snapchat/oauth-callback.html";

  if (!clientSecret || !clientId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "missing_snap_secrets",
        hint: "Set SNAP_CLIENT_SECRET and SNAP_CLIENT_ID in Project → Edge Functions → Secrets (or supabase secrets set).",
      }),
      { status: 500, headers: { ...h, "Content-Type": "application/json" } },
    );
  }

  const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
  const placeholder =
    /din[-_]?snap|fra[-_]?business|bytt[-_]?med|REPLACE|example|your[-_]?uuid/i.test(clientId) ||
    /bytt[-_]?med|REPLACE|example/i.test(clientSecret);
  if (!uuidOk || placeholder) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "snap_credentials_placeholder_or_invalid",
        hint:
          "SNAP_CLIENT_ID må være ekte UUID fra Snapchat OAuth Apps (samme som snap-oauth-config.js). " +
          "Ikke bruk tekst fra oauth.env.example (f.eks. din-snap-client-id-fra-business). " +
          "SNAP_CLIENT_SECRET må være den faktiske Key-strengen fra samme app.",
      }),
      { status: 400, headers: { ...h, "Content-Type": "application/json" } },
    );
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
      status: 400,
      headers: { ...h, "Content-Type": "application/json" },
    });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return new Response(JSON.stringify({ ok: false, error: "missing_code" }), {
      status: 400,
      headers: { ...h, "Content-Type": "application/json" },
    });
  }

  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const formBody = form.toString();

  let tokenUrlUsed = SNAP_TOKEN_URLS[0];
  let snapJson: Record<string, unknown> = {};
  let snapRes: Response | null = null;
  let lastNonJsonDetail = "";

  for (const url of SNAP_TOKEN_URLS) {
    tokenUrlUsed = url;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });
    snapRes = r;
    const text = await r.text();
    try {
      snapJson = JSON.parse(text) as Record<string, unknown>;
    } catch {
      lastNonJsonDetail = text.slice(0, 400);
      snapJson = {};
      continue;
    }
    const hasToken = typeof snapJson.access_token === "string" && snapJson.access_token.length > 0;
    if (r.ok && hasToken) break;
  }

  const hasToken =
    typeof snapJson.access_token === "string" && (snapJson.access_token as string).length > 0;

  if (!snapRes || !snapRes.ok || !hasToken) {
    const snapErr = typeof snapJson.error === "string" ? snapJson.error : "";
    return new Response(
      JSON.stringify({
        ok: false,
        error: "snap_token_failed",
        status: snapRes?.status ?? 0,
        token_url: tokenUrlUsed,
        redirect_uri_used: redirectUri,
        client_id_prefix: clientId.slice(0, 8),
        snap: snapJson,
        non_json: lastNonJsonDetail || undefined,
        hint:
          "invalid_client: Bruk Client ID + Secret fra SAMME OAuth-app i Snapchat Ads/Business (Public Profile API). " +
          "Snap sier at OAuth-app fra kun «Developer Portal» kan gi feil client_id for Marketing API. " +
          "Roter Key i Snapchat, oppdater SNAP_CLIENT_SECRET i Supabase, og sjekk at SNAP_CLIENT_ID matcher js/snap-oauth-config.js. " +
          "Redirect: https://mj-universe.net/snapchat/oauth-callback.html (samme som i authorize).",
        docs: "https://developers.snap.com/api/marketing-api/Public-Profile-API/GetStarted",
      }),
      { status: 400, headers: { ...h, "Content-Type": "application/json" } },
    );
  }

  const accessToken = typeof snapJson.access_token === "string" ? snapJson.access_token : "";
  const refreshToken = typeof snapJson.refresh_token === "string" ? snapJson.refresh_token : "";
  const expiresIn = typeof snapJson.expires_in === "number" ? snapJson.expires_in : 3600;
  const scope = typeof snapJson.scope === "string" ? snapJson.scope : "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceKey && accessToken) {
    const sb = createClient(supabaseUrl, serviceKey);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const { error: upErr } = await sb.from("snap_integration_tokens").upsert(
      {
        id: 1,
        access_token: accessToken,
        refresh_token: refreshToken || null,
        expires_at: expiresAt,
        scope: scope || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (upErr) {
      console.error("snap_integration_tokens upsert:", upErr.message);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "db_upsert_failed",
          hint: "Run setup-snap-oauth-token-storage.sql in Supabase SQL Editor.",
          detail: upErr.message,
        }),
        { status: 500, headers: { ...h, "Content-Type": "application/json" } },
      );
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      expires_in: expiresIn,
      scope,
      stored: Boolean(supabaseUrl && serviceKey && accessToken),
    }),
    { status: 200, headers: { ...h, "Content-Type": "application/json" } },
  );
});
