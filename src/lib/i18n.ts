/**
 * Urdu-ready architecture: UI strings that matter for navigation live in a dictionary keyed by
 * locale. The MVP ships English only. To add Urdu: add a `ur` dictionary, return its locale
 * from getLocale() (cookie/header), and extract remaining literals into the dictionaries.
 * Layout uses CSS logical properties and <html dir>, and an Urdu (Nastaliq) font stack.
 */
export type Locale = "en" | "ur";
export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = { en: "ltr", ur: "rtl" };

const en = {
  "nav.browse": "Find jobs",
  "nav.post": "Post a job",
  "nav.dashboard": "Dashboard",
  "nav.notifications": "Notifications",
  "nav.signin": "Sign in",
  "nav.signout": "Sign out",
  "nav.admin": "Admin",
  "nav.worker": "Worker profile",
} as const;

export type MessageKey = keyof typeof en;
const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = { en, ur: {} };

export function getLocale(): Locale {
  return "en"; // MVP: English only.
}

export function t(key: MessageKey, locale: Locale = getLocale()): string {
  return dictionaries[locale][key] ?? en[key];
}
