import { initializeApp, getApps } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

// Firebase web config is NOT secret — safe to commit / ship to the browser.
// Fill these from Firebase console → Project settings → General → Your apps → SDK setup.
// The SAME values must also be pasted into public/firebase-messaging-sw.js
export const firebaseConfig = {
  apiKey: "AIzaSyA9j2BCbi2dMhbYMxOszDLbBBnGj6-4fPs",
  authDomain: "majaldita.firebaseapp.com",
  projectId: "majaldita",
  storageBucket: "majaldita.firebasestorage.app",
  messagingSenderId: "870073885479",
  appId: "1:870073885479:web:8524d94651c2d787d8bf02",
};

// Firebase console → Project settings → Cloud Messaging → Web Push certificates → Key pair
export const VAPID_KEY = "BO6fXzVEMqDTk4dmR1jsbmzLN6ps345iNsGb2lAH97cb89uLJrlJnXbXEZe8CFWeORde9hb5lPgbUAnFbJc027U";

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
