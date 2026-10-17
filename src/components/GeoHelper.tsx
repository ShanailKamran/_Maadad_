"use client";

import { useState } from "react";

type Area = { id: number; name: string; lat: number; lng: number };

const dist = (a: Area, lat: number, lng: number) => (a.lat - lat) ** 2 + ((a.lng - lng) * 0.86) ** 2;

/**
 * OPTIONAL device-location helper. Never required: the manual area list always works.
 * - mode "pin": fills hidden lat/lng (kept private server-side) and preselects the nearest area.
 * - mode "areas": ticks the 3 nearest service-area checkboxes for workers.
 * Location is read once on click, never tracked, and only coordinates (not exposed publicly) are sent.
 */
export function GeoHelper({ areas, mode }: { areas: Area[]; mode: "pin" | "areas" }) {
  const [msg, setMsg] = useState("");

  function run() {
    if (!("geolocation" in navigator)) return setMsg("Location isn't available on this device. Please choose manually.");
    setMsg("Looking up…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const sorted = [...areas].sort((a, b) => dist(a, lat, lng) - dist(b, lat, lng));
        if (dist(sorted[0], lat, lng) > 0.05 ** 2 * 4) return setMsg("You seem to be outside Lahore. Please choose manually.");
        if (mode === "pin") {
          (document.getElementById("lat") as HTMLInputElement).value = lat.toFixed(5);
          (document.getElementById("lng") as HTMLInputElement).value = lng.toFixed(5);
          (document.getElementById("areaId") as HTMLSelectElement).value = String(sorted[0].id);
          setMsg(`Pin saved privately. Nearest area selected: ${sorted[0].name}. Workers will only see the area.`);
        } else {
          sorted.slice(0, 3).forEach((a) => {
            const el = document.getElementById(`area-${a.id}`) as HTMLInputElement | null;
            if (el) el.checked = true;
          });
          setMsg(`Ticked nearest areas: ${sorted.slice(0, 3).map((a) => a.name).join(", ")}. Adjust as you like.`);
        }
      },
      () => setMsg("Location permission wasn't granted. That's fine. Choose your area manually."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={run}>
        Use my current location (optional)
      </button>
      <p className="hint" role="status">{msg || "Optional. You can always pick manually."}</p>
    </div>
  );
}
