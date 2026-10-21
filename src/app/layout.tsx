import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { appName } from "@/lib/config";
import { getLocale, LOCALE_DIR } from "@/lib/i18n";
import { getUser } from "@/lib/auth";
import { isPostgresAvailable, q } from "@/lib/db";
import { store } from "@/lib/store";
import SiteNav, { type NavItem } from "@/components/SiteNav";
import { IconPlus, IconWrench, IconShieldCheck, IconUser, IconLogOut } from "@/components/icons";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: `${appName} – Plumbing & electrical jobs in Lahore`, template: `%s · ${appName}` },
  description:
    "Post a plumbing or electrical job in Lahore, compare bids from independent technicians and choose who to hire. Payment is arranged directly with the technician.",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0b10",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  const user = await getUser();

  let unreadCount = 0;
  if (user) {
    if (!(await isPostgresAvailable())) {
      unreadCount = store.unreadNotificationCount(user.id);
    } else {
      const res = await q<{ n: number }>("SELECT count(*)::int n FROM notifications WHERE user_id=$1 AND read_at IS NULL", [user.id]);
      unreadCount = res[0]?.n ?? 0;
    }
  }

  const nav: NavItem[] = [
    { href: "/", label: "Marketplace" },
    ...(user
      ? ([
          { href: "/dashboard", label: "My dashboard", match: "prefix" },
          ...(user.is_worker ? [{ href: "/worker/jobs", label: "Matching jobs", match: "prefix" as const }] : []),
          { href: "/notifications", label: "Notifications", count: unreadCount, match: "prefix" },
          { href: "/account", label: "Account", match: "prefix" },
          ...(user.is_admin ? [{ href: "/admin", label: "Moderation", match: "prefix" as const }] : []),
        ] as NavItem[])
      : []),
    { href: "/payments", label: "How it works", match: "prefix" },
  ];

  return (
    <html lang={locale} dir={LOCALE_DIR[locale]}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="app-wrap">
          <div className="app-canvas">
            <header className="app-header">
              <div className="header-inner">
                <Link href="/" className="brand-badge" aria-label="Maddad Lahore home">
                  <div className="brand-avatar" aria-hidden="true">
                    مدد
                  </div>
                  <div>
                    <div className="brand-title">
                      <span>Maddad</span>
                      <span className="brand-urdu" lang="ur">
                        مدد لاہور
                      </span>
                    </div>
                    <span className="brand-tag">Lahore · Plumbing &amp; Electrical</span>
                  </div>
                </Link>

                <Suspense fallback={<nav className="header-nav" aria-label="Main" />}>
                  <SiteNav items={nav} />
                </Suspense>

                <div className="header-actions">
                  <Link href="/?view=post" className="btn btn-primary btn-sm">
                    <IconPlus size={16} aria-hidden="true" />
                    <span>
                      Post a job
                    </span>
                  </Link>
                  {user?.is_worker ? (
                    <Link href="/worker/profile" className="btn btn-sm" aria-label="My technician profile">
                      <IconWrench size={16} aria-hidden="true" />
                      <span className="btn-label-long" aria-hidden="true">My technician profile</span>
                    </Link>
                  ) : (
                    <Link href="/?view=join" className="btn btn-sm" aria-label="Join as a technician">
                      <IconWrench size={16} aria-hidden="true" />
                      <span className="btn-label-long" aria-hidden="true">Join as a technician</span>
                    </Link>
                  )}
                  {user ? (
                    <form action={logoutAction}>
                      <button type="submit" className="btn btn-ghost btn-sm" aria-label="Sign out">
                        <IconLogOut size={16} aria-hidden="true" />
                        <span className="hide-sm">Sign out</span>
                      </button>
                    </form>
                  ) : (
                    <Link href="/?view=signin" className="btn btn-ghost btn-sm">
                      <IconUser size={16} aria-hidden="true" />
                      <span>Sign in</span>
                    </Link>
                  )}
                </div>
              </div>
            </header>

            <div className="trust-strip" role="note">
              <div className="trust-strip-inner">
                <IconShieldCheck size={14} aria-hidden="true" />
                <span>
                  <strong>English-first pilot (مکمل اردو ترجمہ جلد دستیاب ہوگا):</strong> Maddad is an open bulletin board. You pay the technician directly — zero platform escrow or fund holding.{" "}
                  <Link href="/payments">How it works</Link>
                </span>
              </div>
            </div>

            <main id="main" tabIndex={-1}>
              {children}
            </main>

            <footer className="site-footer">
              <div className="site-footer-inner">
                <span>© Maddad Lahore · Pilot for plumbing &amp; electrical jobs in Lahore only. English-first pilot (مکمل اردو ترجمہ جلد دستیاب ہوگا).</span>
                <span className="row" style={{ gap: 16 }}>
                  <Link href="/payments">Payments</Link>
                  <Link href="/privacy">Privacy</Link>
                  <Link href="/terms">Terms</Link>
                </span>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
