/**
 * Pakistan phone normalisation → E.164 (+92XXXXXXXXXX).
 * Accepts: 03001234567, 0300-1234567, 3001234567, 923001234567, +92 300 1234567, 0092300...
 * Mobile numbers only (10 digits after 92, starting with 3).
 */
export function normalizePkPhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("92")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  if (!/^3\d{9}$/.test(d)) return null;
  return "+92" + d;
}

/** Masks a phone for display/logging: +92300****567 */
export function maskPhone(p: string): string {
  return p.length > 7 ? p.slice(0, 6) + "****" + p.slice(-3) : "****";
}
