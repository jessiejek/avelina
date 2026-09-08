import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

// Firebase web config is NOT secret — safe to commit / ship to the browser.
// Fill these from Firebase console → Project settings → General → Your apps → SDK setup.
// The SAME values must also be pasted into public/firebase-messaging-sw.js
export const firebaseConfig = {
  apiKey: "REPLACE_API_KEY",
  authDomain: "REPLACE_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_PROJECT_ID",
  storageBucket: "REPLACE_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_SENDER_ID",
  appId: "REPLACE_APP_ID",
};

// Firebase console → Project settings → Cloud Messaging → Web Push certificates → Key pair
export const VAPID_KEY = "REPLACE_VAPID_PUBLIC_KEY";

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let _messaging: Messaging | null = null;

export async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (_messaging) return _messaging;
  try {
    if (!(await isSupported())) return null;
    _messaging = getMessaging(firebaseApp);
    return _messaging;
  } catch {
    return null;
  }
}

export const pushConfigured = !firebaseConfig.apiKey.startsWith("REPLACE") && !VAPID_KEY.startsWith("REPLACE");
