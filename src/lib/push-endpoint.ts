import "server-only";

const PUSH_SERVICE_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

export function isTrustedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (!url.port || url.port === "443") &&
      !url.username &&
      !url.password &&
      (PUSH_SERVICE_HOSTS.has(url.hostname) ||
        url.hostname.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
