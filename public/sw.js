"use strict";

const DEFAULT_NOTIFICATION = {
  title: "CPBoard",
  body: "You have a new CPBoard update.",
  icon: "/icon-192x192.png",
  badge: "/icon-192x192.png",
  url: "/",
  tag: "cpboard-update",
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;

  try {
    const parsedPayload = event.data.json();
    payload =
      parsedPayload && typeof parsedPayload === "object"
        ? parsedPayload
        : { body: String(parsedPayload) };
  } catch {
    payload = { body: event.data.text() };
  }

  const data =
    payload.data && typeof payload.data === "object" ? payload.data : {};
  if (
    payload.expiresAt &&
    Number.isFinite(Date.parse(payload.expiresAt)) &&
    Date.parse(payload.expiresAt) <= Date.now()
  ) {
    return;
  }
  const title = payload.title || DEFAULT_NOTIFICATION.title;
  const options = {
    body: payload.body || DEFAULT_NOTIFICATION.body,
    icon: payload.icon || DEFAULT_NOTIFICATION.icon,
    badge: payload.badge || DEFAULT_NOTIFICATION.badge,
    tag: payload.tag || DEFAULT_NOTIFICATION.tag,
    renotify: Boolean(payload.renotify),
    data: {
      ...data,
      url: payload.url || data.url || DEFAULT_NOTIFICATION.url,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || DEFAULT_NOTIFICATION.url;
  let destination;

  try {
    destination = new URL(requestedUrl, self.location.origin);
  } catch {
    destination = new URL(DEFAULT_NOTIFICATION.url, self.location.origin);
  }

  // Notification payloads are server-controlled, but keeping navigation on the
  // app origin avoids turning a malformed payload into an external redirect.
  const targetUrl =
    destination.origin === self.location.origin
      ? destination.href
      : new URL(DEFAULT_NOTIFICATION.url, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        const targetPath = new URL(targetUrl).pathname;
        const matchingClient = windowClients.find(
          (client) => new URL(client.url).pathname === targetPath,
        );

        if (matchingClient) {
          return matchingClient.focus();
        }

        const appClient = windowClients.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );

        if (appClient) {
          await appClient.navigate(targetUrl);
          return appClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
