"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; count?: number; icon?: ReactNode; match?: "exact" | "prefix" };

/** Primary site navigation. Marks the current route with aria-current for assistive tech and styling. */
export default function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "/";
  const view = useSearchParams()?.get("view");
  return (
    <nav className="header-nav" aria-label="Main">
      {items.map((it) => {
        const [path] = it.href.split("?");
        const current =
          it.match === "prefix" ? pathname.startsWith(path) : pathname === path && !(path === "/" && view && it.href === "/");
        return (
          <Link key={it.href} href={it.href} className="nav-link" aria-current={current ? "page" : undefined}>
            {it.icon}
            <span>{it.label}</span>
            {it.count ? (
              <span className="nav-count" aria-label={`${it.count} unread`}>
                {it.count > 99 ? "99+" : it.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
