import { getToken, onMessage, deleteToken } from "firebase/messaging";
import { supabase } from "./supabase.ts";
import { getMessagingIfSupported, VAPID_KEY, pushConfigured } from "./firebase.ts";

// The Workbox PWA service worker (sw.js) owns scope "/". A scope can only have
// one service worker, so registering firebase-messaging-sw.js at "/" would
// replace it (and vice versa on the next load). Give FCM its own scope.
const FCM_SW_URL = "/firebase-messaging-sw.js";
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

/**
 * Ask for notification permission, get an FCM token for this device, and store it
 * in `push_tokens` keyed to the signed-in user. Safe to call repeatedly / on every
 * login — it upserts.
 *
 * Returns "granted" | "denied" | "unsupported" | "error".
 * Must be triggered by a user gesture the first time (browser requirement).
 */
export async function enablePush(_userId: string, _role: "admin" | "customer"): Promise<string> {
  // userId/role are kept for call-site compatibility only: the server binds the
  // token to auth.uid() and derives the role from users.role.
  if (!pushConfigured) return "unsupported";
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported";

  const messaging = await getMessagingIfSupported();
  if (!messaging) return "unsupported";

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") return permission; // "denied"

  try {
    const registration = await navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE });
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return "error";

    const { error } = await supabase.rpc("register_push_token", {
      p_token: token,
      p_user_agent: navigator.userAgent.slice(0, 300),
    });
    if (error) {
      console.error("register_push_token failed:", error);
      return "error";
    }

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

/** Remove this device's token (call on sign-out, while the session is still valid). */
export async function disablePush(): Promise<void> {
  try {
    // Never trigger a permission prompt or create a registration here.
    if (!pushConfigured || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
    if (!reg) return;
    const messaging = await getMessagingIfSupported();
    if (!messaging) return;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }).catch(() => null);
    if (token) await supabase.from("push_tokens").delete().eq("token", token);
    await deleteToken(messaging).catch(() => {});
  } catch { /* ignore */ }
}

export function pushPermissionState(): "granted" | "denied" | "default" | "unsupported" {
  if (!pushConfigured || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
