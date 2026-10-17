"use client";

import React, { useState } from "react";
import {
  IconShield,
  IconCheck,
  IconWrench,
  IconZap,
  IconMapPin,
  IconInfo,
} from "../icons";
import {
  AppUser,
  WorkerProfileData,
  AreaOption,
  CategoryOption,
} from "./types";
import { saveWorkerAction } from "@/app/actions";

interface WorkerProfileViewProps {
  currentUser: AppUser | null;
  initialProfile: WorkerProfileData | null;
  areas: AreaOption[];
  categories: CategoryOption[];
  showToast: (msg: string) => void;
  onNavigateAuth: () => void;
}

export function WorkerProfileView({
  currentUser,
  initialProfile,
  areas,
  categories,
  showToast,
  onNavigateAuth,
}: WorkerProfileViewProps) {
  const [bio, setBio] = useState(initialProfile?.bio || "");
  const [experienceYears, setExperienceYears] = useState(initialProfile?.experience_years ?? 5);
  const [acceptingBids, setAcceptingBids] = useState(initialProfile?.accepting_bids ?? true);
  const [selectedCats, setSelectedCats] = useState<number[]>(initialProfile?.categories || [1]);
  const [selectedAreas, setSelectedAreas] = useState<number[]>(
    initialProfile?.areas || (areas.length > 0 ? [areas[0].id, areas[1]?.id || areas[0].id] : [1, 2, 3]),
  );
  const [saving, setSaving] = useState(false);

  if (!currentUser) {
    return (
      <div style={{ maxWidth: 540, margin: "32px auto", width: "100%", padding: "0 16px" }}>
        <div className="plate" style={{ textAlign: "center", padding: "36px 24px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(124, 58, 237, 0.15)",
              color: "var(--violet-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <IconWrench size={24} />
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 8px", color: "var(--text-1)" }}>
            Technician Profile Access
          </h2>
          <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.5, margin: "0 0 20px" }}>
            Sign in with a technician profile or demo account to manage your trades, service areas in Lahore, and availability.
          </p>
          <button type="button" onClick={onNavigateAuth} className="btn btn-primary" style={{ margin: "0 auto" }}>
            Sign In / Switch Persona
          </button>
        </div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    fd.set("bio", bio.trim());
    fd.set("experience_years", String(experienceYears));
    if (acceptingBids) {
      fd.set("accepting_bids", "on");
    }
    selectedCats.forEach((c) => fd.append("categories", String(c)));
    selectedAreas.forEach((a) => fd.append("areas", String(a)));

    const res = await saveWorkerAction(null, fd);
    setSaving(false);

    if (res?.error) {
      showToast(`Error: ${res.error}`);
    } else {
      showToast("Worker profile and trade preferences saved!");
    }
  };

  const toggleCategory = (id: number) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const toggleArea = (id: number) => {
    setSelectedAreas((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const selectAllAreas = () => {
    setSelectedAreas(areas.map((a) => a.id));
  };

  const clearAreas = () => {
    setSelectedAreas([]);
  };

  return (
    <div style={{ maxWidth: 720, margin: "20px auto", width: "100%", padding: "0 12px" }}>
      <form onSubmit={handleSave} className="plate-bolted" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Title */}
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0, color: "var(--text-1)" }}>
            Technician Profile &amp; Service Zones (کاریگر پروفائل)
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.85rem", margin: "4px 0 0" }}>
            Set your trade specialties, experience level, and Lahore neighbourhoods where you accept work.
          </p>
        </div>

        {/* NADRA & Verification Disclaimer */}
        <div
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            borderLeft: "4px solid var(--amber-400)",
            borderRadius: "var(--radius-sm)",
            padding: "14px 16px",
            fontSize: "0.82rem",
            color: "var(--text-2)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--amber-300)", fontWeight: 700, marginBottom: 4 }}>
            <IconShield size={16} />
            <span>Important Verification Notice (تصدیق سے متعلق اہم وضاحت):</span>
          </div>
          Maddad does not connect to NADRA or any government database. ID review is an internal document check only. It does not certify skill level, criminal background, or workmanship guarantee. Customers and technicians transact directly.
        </div>

        {/* Availability Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--ink-0)",
            padding: "14px 18px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--graphite-700)",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-1)" }}>
              Accepting New Bids (کام کے لیے دستیاب ہیں)
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 2 }}>
              Turn off if you are currently busy and do not want to receive new job match alerts.
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 10 }}>
            <input
              type="checkbox"
              checked={acceptingBids}
              onChange={(e) => setAcceptingBids(e.target.checked)}
              style={{
                width: 22,
                height: 22,
                accentColor: "var(--violet-600)",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: acceptingBids ? "var(--emerald-400)" : "var(--text-3)" }}>
              {acceptingBids ? "Available" : "Unavailable"}
            </span>
          </label>
        </div>

        {/* Bio & Experience */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              htmlFor="worker-bio"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
            >
              Professional Bio &amp; Specialty (تجربہ اور تعارف):
            </label>
            <textarea
              id="worker-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Master electrician specializing in distribution boards, inverter wiring, and breaker troubleshooting across Gulberg and DHA."
              style={{
                width: "100%",
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-600)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
                color: "var(--text-1)",
                fontFamily: "inherit",
                fontSize: "0.9rem",
                outline: "none",
                lineHeight: 1.5,
              }}
            />
          </div>

          <div>
            <label
              htmlFor="worker-exp"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
            >
              Years of Hands-on Experience (تجربہ سالوں میں):
            </label>
            <input
              id="worker-exp"
              type="number"
              min={0}
              max={50}
              value={experienceYears}
              onChange={(e) => setExperienceYears(parseInt(e.target.value, 10) || 0)}
              style={{
                width: 140,
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-600)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                color: "var(--text-1)",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Trade Selection */}
        <div>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
            Offered Trades (کام کی اقسام):
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {categories.map((cat) => {
              const isSelected = selectedCats.includes(cat.id);
              const isPlumbing = cat.slug.toLowerCase().includes("plumb");
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: isSelected ? "rgba(124, 58, 237, 0.15)" : "var(--ink-0)",
                    border: isSelected ? "1px solid var(--violet-400)" : "1px solid var(--graphite-700)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: isPlumbing ? "rgba(59, 130, 246, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: isPlumbing ? "#60a5fa" : "var(--amber-300)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isPlumbing ? <IconWrench size={18} /> : <IconZap size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: isSelected ? "var(--violet-200)" : "var(--text-1)" }}>
                      {cat.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                      {isPlumbing ? "پلمبنگ" : "الیکٹریکل"}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{ accentColor: "var(--violet-600)", width: 18, height: 18 }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Lahore Neighbourhoods Multi-Select */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)" }}>
              Lahore Service Neighbourhoods (علاقے جہاں آپ کام کرتے ہیں):
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={selectAllAreas}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem", padding: "2px 6px" }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAreas}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem", padding: "2px 6px" }}
              >
                Clear
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 8,
              maxHeight: 220,
              overflowY: "auto",
              padding: 10,
              background: "var(--ink-0)",
              border: "1px solid var(--graphite-700)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            {areas.map((area) => {
              const isChecked = selectedAreas.includes(area.id);
              return (
                <label
                  key={area.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: isChecked ? "rgba(124, 58, 237, 0.12)" : "transparent",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: isChecked ? "var(--violet-200)" : "var(--text-2)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleArea(area.id)}
                    style={{ accentColor: "var(--violet-600)" }}
                  />
                  <span>{area.name}</span>
                </label>
              );
            })}
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--text-3)", marginTop: 6 }}>
            {selectedAreas.length} neighbourhoods selected for job match notifications.
          </div>
        </div>

        {/* Save CTA */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--graphite-800)" }}>
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: "12px 24px" }}
          >
            <IconCheck size={16} />
            <span>{saving ? "Saving..." : "Save Profile Changes (محفوظ کریں)"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
