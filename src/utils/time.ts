import type { Client } from "../types";

export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nowHHMM(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Scheduled hand-over moment of a job as a Date (device-local time). */
export function jobDateTime(c: Pick<Client, "date" | "time">): Date {
  return new Date(`${c.date}T${c.time || "00:00"}:00`);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return nowHHMM(d);
}

export function formatDayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatRelative(iso?: string): string {
  if (!iso) return "";
  const mins = minutesBetween(new Date(), new Date(iso));
  const abs = Math.abs(mins);
  if (abs < 1) return "just now";
  const spelled =
    abs < 60
      ? `${abs} min`
      : `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, "0")} min`;
  return mins >= 0 ? `in ${spelled}` : `${spelled} ago`;
}

/** Monday-first week containing `iso`. */
export function weekDays(iso: string): string[] {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = addDays(iso, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
