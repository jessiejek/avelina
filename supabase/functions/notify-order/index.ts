// Supabase Edge Function: send Firebase Cloud Messaging pushes on order events.
//
// Triggered by a Database Webhook on public.orders:
//   INSERT                          -> notify every admin device ("New order")
//   UPDATE status -> 'confirmed'    -> notify that customer's devices ("Order confirmed")
//
// Required secrets (supabase secrets set ...):
//   FCM_PROJECT_ID     - Firebase project id
//   FCM_CLIENT_EMAIL   - service account client_email
//   FCM_PRIVATE_KEY    - service account private_key (with real newlines or \n)
// Auto-provided by the platform: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID")!;
const FCM_CLIENT_EMAIL = Deno.env.get("FCM_CLIENT_EMAIL")!;
const FCM_PRIVATE_KEY = (Deno.env.get("FCM_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ---------- Google OAuth2 access token from the service account ----------

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: FCM_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(FCM_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("oauth token error: " + JSON.stringify(json));
  cachedToken = { value: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

// ---------- FCM send ----------

async function sendToTokens(tokens: string[], title: string, body: string, url: string, tag: string) {
  if (tokens.length === 0) return;
  const accessToken = await getAccessToken();
  const endpoint = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;

  await Promise.all(tokens.map(async (token) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { url, tag },
          webpush: { fcm_options: { link: url } },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      // Prune dead tokens so the table stays clean.
      if (res.status === 404 || res.status === 403 || err.includes("UNREGISTERED") || err.includes("INVALID_ARGUMENT")) {
        await supabase.from("push_tokens").delete().eq("token", token);
      }
      console.error(`FCM ${res.status} for token ${token.slice(0, 12)}…: ${err}`);
    }
  }));
}

// ---------- Webhook handler ----------

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, table, record, old_record } = payload;
    if (table !== "orders") return new Response("ignored", { status: 200 });

    if (type === "INSERT") {
      const { data: toks } = await supabase.from("push_tokens").select("token").eq("role", "admin");
      const tokens = (toks ?? []).map((t: { token: string }) => t.token);
      const total = Number(record.total ?? 0);
      await sendToTokens(
        tokens,
        "New order 🧾",
        `${record.customer_name || "A customer"} placed order ${record.id}${total ? ` — ₱${total.toLocaleString()}` : ""}`,
        "/admin/orders",
        "new-order",
      );
      return new Response("ok", { status: 200 });
    }

    if (type === "UPDATE" && old_record?.status !== "confirmed" && record.status === "confirmed" && record.user_id) {
      const { data: toks } = await supabase.from("push_tokens").select("token").eq("user_id", record.user_id);
      const tokens = (toks ?? []).map((t: { token: string }) => t.token);
      await sendToTokens(
        tokens,
        "Order confirmed 🎉",
        `Your order ${record.id} is confirmed. We'll text you when it's ready.`,
        "/orders",
        "order-" + record.id,
      );
      return new Response("ok", { status: 200 });
    }

    return new Response("no-op", { status: 200 });
  } catch (e) {
    console.error("notify-order error:", e);
    return new Response("error: " + (e as Error).message, { status: 500 });
  }
});
