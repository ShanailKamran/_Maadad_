"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  IconWrench,
  IconZap,
  IconMapPin,
  IconClock,
  IconSearch,
  IconFilter,
  IconPlus,
  IconShield,
  IconArrowRight,
  IconLock,
  IconBookmark,
} from "./icons";
import { PublicJob } from "@/lib/jobs";

interface Props {
  initialJobs: PublicJob[];
  isLoggedIn: boolean;
  userRole?: {
    isWorker: boolean;
    isAdmin: boolean;
  };
}

export default function PublicMarketplaceView({ initialJobs, isLoggedIn, userRole }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterAsapOnly, setFilterAsapOnly] = useState<boolean>(false);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

  // Distinct areas from listings
  const areas = useMemo(() => {
    const set = new Set<string>();
    initialJobs.forEach((j) => set.add(j.area));
    return Array.from(set).sort();
  }, [initialJobs]);

  const filteredJobs = useMemo(() => {
    return initialJobs.filter((job) => {
      if (selectedCategory !== "all" && job.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (selectedArea !== "all" && job.area.toLowerCase() !== selectedArea.toLowerCase()) {
        return false;
      }
      if (filterAsapOnly && !job.asap) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = job.title.toLowerCase().includes(q);
        const matchDesc = job.description.toLowerCase().includes(q);
        const matchArea = job.area.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchArea) return false;
      }
      return true;
    });
  }, [initialJobs, selectedCategory, selectedArea, filterAsapOnly, searchQuery]);

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="main-layout">
      {/* Left Sidebar Filter Panel */}
      <aside className="sidebar">
        <div className="sidebar-section">
          <span className="sidebar-title">Categories</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`btn btn-sm ${selectedCategory === "all" ? "btn-primary" : "btn-ghost"}`}
              style={{ justifyContent: "flex-start" }}
            >
              <span>All Trades (تمام شعبے)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("plumbing")}
              className={`btn btn-sm ${selectedCategory === "plumbing" ? "btn-primary" : "btn-ghost"}`}
              style={{ justifyContent: "flex-start" }}
            >
              <IconWrench size={16} />
              <span>Plumbing (پلمبنگ)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory("electrical")}
              className={`btn btn-sm ${selectedCategory === "electrical" ? "btn-primary" : "btn-ghost"}`}
              style={{ justifyContent: "flex-start" }}
            >
              <IconZap size={16} />
              <span>Electrical (الیکٹریکل)</span>
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-title">Lahore Areas</span>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="filter-select"
            aria-label="Filter by neighbourhood"
          >
            <option value="all">All Lahore Areas (پورے لاہور میں)</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-title">Urgency &amp; Timing</span>
          <label className="check">
            <input
              type="checkbox"
              checked={filterAsapOnly}
              onChange={(e) => setFilterAsapOnly(e.target.checked)}
            />
            <span>Urgent / Today only</span>
          </label>
        </div>

        <div className="sidebar-section" style={{ marginTop: "auto", borderTop: "1px solid var(--line-subtle)", paddingTop: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/jobs/new" className="btn btn-primary" style={{ width: "100%" }}>
              <IconPlus size={16} />
              <span>Post a Job Free</span>
            </Link>
            <Link href="/worker/jobs" className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
              <span>Technician Bid Board</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Jobs Listing & Hero Feed */}
      <section className="content-area">
        {/* Marketplace Value Proposition Hero Banner */}
        <div className="hero-banner">
          <div>
            <span className="brand-tag" style={{ marginBottom: 8, display: "inline-block" }}>
              Independent Worker Open-Bid Pilot
            </span>
            <h1 className="hero-title">
              Local Plumbing &amp; Electrical Jobs in Lahore
            </h1>
            <p className="hero-lead">
              Maddad connects customers who need small household jobs with independent technicians.
              Describe your job, compare open bids from verified local technicians, and settle payment directly.
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <div className="step-heading">Post Your Job</div>
              <div className="step-text">
                Describe the repair or installation. Your exact address and phone remain private until you hire.
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">2</div>
              <div className="step-heading">Compare Open Bids</div>
              <div className="step-text">
                Independent technicians in your area submit prices and arrival times. You choose who you want.
              </div>
            </div>
            <div className="step-card">
              <div className="step-num">3</div>
              <div className="step-heading">Direct Settlement</div>
              <div className="step-text">
                Pay the technician directly in PKR cash or bank transfer. Maddad holds no funds and charges no commission.
              </div>
            </div>
          </div>

          <div className="trust-banner">
            <IconLock size={20} />
            <div>
              <strong>Server-Enforced Privacy &amp; Direct Marketplace:</strong> Guests and bidders see only approximate
              areas (e.g. Gulberg III). Exact addresses and phone numbers are only unlocked between you and your single chosen worker.
              Maddad is not an employer, dispatch, or escrow provider.
            </div>
          </div>
        </div>

        {/* Toolbar: Search + Quick Stats */}
        <div className="toolbar">
          <div className="search-bar">
            <IconSearch size={18} />
            <input
              type="text"
              className="search-input"
              placeholder="Search plumbing, breaker tripping, motor repair, pipe leak..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search jobs"
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Showing {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}
            </span>

            {(selectedCategory !== "all" || selectedArea !== "all" || searchQuery || filterAsapOnly) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedArea("all");
                  setSearchQuery("");
                  setFilterAsapOnly(false);
                }}
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem", marginBottom: 16 }}>
              No open jobs match your current search or filters.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedArea("all");
                  setSearchQuery("");
                  setFilterAsapOnly(false);
                }}
              >
                Clear all filters
              </button>
              <Link href="/jobs/new" className="btn btn-primary btn-sm">
                Post this job
              </Link>
            </div>
          </div>
        ) : (
          <div className="cards-grid">
            {filteredJobs.map((job) => {
              const isPlumbing = job.category.toLowerCase().includes("plumb");
              const isSaved = savedJobIds.has(job.id);

              return (
                <div key={job.id} className="job-card">
                  <div className="card-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className={`category-icon-badge ${isPlumbing ? "badge-plumbing" : "badge-electrical"}`}>
                        {isPlumbing ? <IconWrench size={18} /> : <IconZap size={18} />}
                      </div>
                      <div>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: isPlumbing ? "var(--accent-green)" : "var(--brand-purple-text)" }}>
                          {job.category}
                        </span>
                        <div className="job-area">
                          <IconMapPin size={13} />
                          <span>{job.area}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {job.is_demo && (
                        <span className="pill pill-demo" title="Fictional seed listing for pilot testing">
                          [DEMO]
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => toggleBookmark(job.id, e)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 4, color: isSaved ? "var(--brand-purple-text)" : "var(--text-muted)" }}
                        title={isSaved ? "Saved" : "Save job"}
                      >
                        <IconBookmark size={16} fill={isSaved ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="job-title">{job.title}</h3>
                    <p className="job-desc">{job.description}</p>
                  </div>

                  <div className="card-meta-row">
                    <div className="meta-tags">
                      {job.asap && (
                        <span className="pill" style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)" }}>
                          <IconClock size={12} />
                          <span>Urgent</span>
                        </span>
                      )}
                      <span className="pill">
                        {job.bid_count} {job.bid_count === 1 ? "bid" : "bids"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {job.budget_min && job.budget_max ? (
                        <span className="price-tag">
                          Rs {job.budget_min.toLocaleString()} – {job.budget_max.toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                          Open budget
                        </span>
                      )}

                      <Link
                        href={isLoggedIn ? `/jobs/${job.id}` : `/login?next=/jobs/${job.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      >
                        <span>View</span>
                        <IconArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Demo Account Quick Switcher (Development Only) */}
        {process.env.NODE_ENV !== "production" && (
          <div
            className="notice notice-dev"
            style={{
              marginTop: 32,
              padding: 20,
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>[DEMO PILOT ACCOUNTS] - Local Development &amp; Verification Switcher</strong>
                <p style={{ fontSize: "0.82rem", marginTop: 2, color: "var(--text-secondary)" }}>
                  Disabled in production. Click below to test all user roles with guaranteed server-side access controls:
                </p>
              </div>
              <span className="pill pill-demo">Dev Only</span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/login?autoPhone=03001112233"
                className="btn btn-secondary btn-sm"
                style={{ background: "rgba(11, 16, 28, 0.7)" }}
              >
                <span>[DEMO] Tariq Customer (0300 1112233)</span>
              </Link>
              <Link
                href="/login?autoPhone=03004445566"
                className="btn btn-secondary btn-sm"
                style={{ background: "rgba(11, 16, 28, 0.7)" }}
              >
                <span>[DEMO] Rashid Electrician (0300 4445566)</span>
              </Link>
              <Link
                href="/login?autoPhone=03007778899"
                className="btn btn-secondary btn-sm"
                style={{ background: "rgba(11, 16, 28, 0.7)" }}
              >
                <span>[DEMO] Akram Plumber (0300 7778899)</span>
              </Link>
              <Link
                href="/login?autoPhone=03001234567"
                className="btn btn-secondary btn-sm"
                style={{ background: "rgba(11, 16, 28, 0.7)" }}
              >
                <span>[DEMO] Fatima Moderator (0300 1234567)</span>
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
