import { TIMEZONE } from "./config";

/** Amounts are integer whole PKR. */
export function pkr(n: number | null | undefined): string {
  if (n == null) return "—";
  return "Rs " + new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(n);
}

export function budgetText(min: number | null, max: number | null): string {
  if (min && max) return `${pkr(min)} – ${pkr(max)}`;
  if (min) return `from ${pkr(min)}`;
  if (max) return `up to ${pkr(max)}`;
  return "No budget stated";
}

export function dt(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

export function dateOnly(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PK", { timeZone: TIMEZONE, dateStyle: "medium" }).format(new Date(d));
}

/** Parses a <input type="datetime-local"> value as Asia/Karachi (UTC+5, no DST) → Date. */
export function parseKarachiLocal(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(`${v}:00+05:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
