import type { MetadataRoute } from "next";
import { appName } from "@/lib/config";

/** PWA manifest. No service worker is registered: private pages are never cached offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName,
    description: "Open-bid local services marketplace for Lahore",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f7f4",
    theme_color: "#0b6b4a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
