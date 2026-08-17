// Local study reminders. Nothing fires without an explicit browser permission.

export type PermissionState = "unsupported" | "default" | "granted" | "denied";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const result = await Notification.requestPermission();
  return result as PermissionState;
}

function todayKey() {
  return new Date().toDateString();
}

const STORAGE_KEY = "study_reminder_last";

/**
 * Fires the daily reminder at most once per day, only when the user enabled it,
 * granted permission, today is a study day and the chosen time has passed.
 */
export function maybeFireReminder(params: {
  enabled: boolean;
  weekdays: number[];
  reminderTime: string;
  goalMet: boolean;
}): boolean {
  const { enabled, weekdays, reminderTime, goalMet } = params;
  if (!enabled || goalMet) return false;
  if (notificationPermission() !== "granted") return false;

  const now = new Date();
  if (!weekdays.includes(now.getDay())) return false;

  const [h, m] = reminderTime.split(":").map((v) => Number(v));
  const target = new Date(now);
  target.setHours(h ?? 19, m ?? 0, 0, 0);
  if (now < target) return false;

  if (window.localStorage.getItem(STORAGE_KEY) === todayKey()) return false;
  window.localStorage.setItem(STORAGE_KEY, todayKey());

  new Notification("Hora de estudar 📚", {
    body: "Sua meta de hoje ainda não foi concluída. Bora praticar alguns minutos?",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
  return true;
}
