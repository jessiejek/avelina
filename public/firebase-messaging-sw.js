/* Firebase Cloud Messaging service worker.
 * Served at https://<domain>/firebase-messaging-sw.js (must stay at site root).
 * Handles pushes that arrive while the site is closed or backgrounded.
 *
 * The config below must match src/lib/firebase.ts exactly.
 * These values are NOT secret.
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA9j2BCbi2dMhbYMxOszDLbBBnGj6-4fPs",
  authDomain: "majaldita.firebaseapp.com",
  projectId: "majaldita",
  storageBucket: "majaldita.firebasestorage.app",
  messagingSenderId: "870073885479",
  appId: "1:870073885479:web:8524d94651c2d787d8bf02",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Majaldita's";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: payload.data || {},
    tag: (payload.data && payload.data.tag) || undefined,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
