import { getToken, onMessage, deleteToken } from "firebase/messaging";
import { supabase } from "./supabase.ts";
import { getMessagingIfSupported, VAPID_KEY, pushConfigured } from "./firebase.ts";

/**
 * Ask for notification permission, get an FCM token for this device, and store it
 * in `push_tokens` keyed to the signed-in user. Safe to call repeatedly / on every
 * login — it upserts.
 *
 * Returns "granted" | "denied" | "unsupported" | "error".
 * Must be triggered by a user gesture the first time (browser requirement).
 */
export async function enablePush(userId: string, role: "admin" | "customer"): Promise<string> {
  if (!pushConfigured) return "unsupported";
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";

  const messaging = await getMessagingIfSupported();
  if (!messaging) return "unsupported";

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return permission; // "denied"

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return "error";

    await supabase.from("push_tokens").upsert(
      {
        token,
        user_id: userId,
        role,
        user_agent: navigator.userAgent.slice(0, 300),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

    // Show notifications that arrive while the tab is focused (SW only fires when backgrounded).
    onMessage(messaging, (payload) => {
      const n = payload.notification;
      if (!n) return;
      new Notification(n.title || "Majaldita's", { body: n.body, icon: "/icon.svg" });
    });

    return "granted";
  } catch (e) {
    console.error("enablePush failed:", e);
    return "error";
  }
}

/** Remove this device's token (call on sign-out). */
export async function disablePush(): Promise<void> {
  try {
    const messaging = await getMessagingIfSupported();
    if (messaging) {
      const reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg ?? undefined }).catch(() => null);
      if (token) await supabase.from("push_tokens").delete().eq("token", token);
      await deleteToken(messaging).catch(() => {});
    }
  } catch { /* ignore */ }
}

export function pushPermissionState(): "granted" | "denied" | "default" | "unsupported" {
  if (!pushConfigured || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
