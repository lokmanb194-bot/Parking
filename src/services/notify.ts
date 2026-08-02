import { rememberNotified, wasNotified } from "../store/actions";
import { store } from "../store/store";

/**
 * Local notifications, shown through the service worker so they appear even
 * when the (installed) app is minimised. True server-sent Web Push needs a
 * backend and is wired but unused — see the "push" handler in public/sw.js
 * and README "Push notifications".
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notificationsAvailable(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/**
 * Show a notification once: `key` deduplicates across ticks, reloads and tabs
 * (persisted in the store for three days).
 */
export async function notifyOnce(
  key: string,
  title: string,
  body: string,
): Promise<void> {
  if (wasNotified(key)) return;
  rememberNotified(key);
  if (!store.getSnapshot().settings.notificationsEnabled) return;
  if (!notificationsAvailable()) return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: key,
      });
      return;
    }
  } catch {
    // fall through to the window-level Notification API
  }
  try {
    new Notification(title, { body, tag: key });
  } catch (err) {
    console.error("Notification failed", err);
  }
}

export async function showTestNotification(): Promise<void> {
  await notifyOnce(
    `test-${Date.now()}`,
    "ALC Valet",
    "Notifications are working. You will be alerted about flights and hand-overs.",
  );
}
