"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import {
  IconArrowRight,
  IconBanknote,
  IconCalendar,
  IconClock,
  IconFilter,
  IconLock,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconSend,
  IconUsers,
  IconWrench,
  IconZap,
  IconX,
  IconCheck,
  IconRefreshCw,
  IconFileText,
  IconInfo,
} from "../icons";
import { submitBidAction } from "@/app/actions";
import type { AppUser, AreaOption, PublicJobItem } from "./types";
import {
  DemoBadge,
  Dialog,
  EmptyState,
  Field,
  StatusBadge,
  budgetLabel,
  fmtDate,
  fmtDateTime,
  plural,
  whenLabel,
} from "./shared";

/* ---------------------------------------------------------------- */
/* Decorative ridged architectural lines (inspired by the reference)   */
/* ---------------------------------------------------------------- */
export function RidgeLines() {
  const lines = Array.from({ length: 16 });
  return (
    <svg className="hero-ridges" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ridge-fade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.0" />
          <stop offset="0.55" stopColor="#c4b5fd" stopOpacity="0.16" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      {lines.map((_, i) => (
        <path
          key={i}
          d={`M -20 ${250 + i * 11} H ${360 + i * 9} Q ${420 + i * 9} ${250 + i * 11} ${420 + i * 9} ${190 + i * 6} V ${-20}`}
          fill="none"
          stroke="url(#ridge-fade)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------- */
/* Hero + how it works                                                */
/* ---------------------------------------------------------------- */
export function Hero({
  user,
  realOpenCount,
  sampleCount,
  onPost,
  onJoin,
  compact,
}: {
  user: AppUser | null;
  realOpenCount: number;
  sampleCount: number;
  onPost: () => void;
  onJoin: () => void;
  compact: boolean;
}) {
  return (
    <section className={`hero ${compact ? "hero-compact" : ""}`} aria-labelledby="hero-title">
      <RidgeLines />
      <div className="hero-copy">
        <span className="hero-eyebrow">Lahore Pilot · Plumbing &amp; Electrical</span>
        <h1 id="hero-title" className="hero-title" style={{ fontSize: compact ? "clamp(1.6rem,1.2rem + 1.6vw,2.2rem)" : undefined }}>
          Describe the job. Local technicians bid. <em>You choose.</em>
        </h1>
        {!compact && (
          <p className="hero-lead">
            Post a small plumbing or electrical job in Lahore, compare bids from independent technicians, and hire the one you trust.
            You settle payment directly with them.
          </p>
        )}
        <div className="hero-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onPost}>
            <IconPlus size={18} aria-hidden="true" />
            Post a job
          </button>
          <button type="button" className="btn btn-lg" onClick={onJoin}>
            <IconWrench size={18} aria-hidden="true" />
            {user?.is_worker ? "Open technician portal" : "Join as a technician"}
          </button>
        </div>
        <p className="meta" style={{ margin: 0 }}>
          {realOpenCount === 0 ? (
            <>
              <strong>0 active customer jobs</strong> in Lahore right now ·{" "}
              <button
                type="button"
                onClick={onPost}
                style={{
                  all: "unset",
                  color: "var(--violet-300)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontWeight: 700,
                }}
              >
                Be the first to post a repair
              </button>
              {sampleCount > 0 && <span> ({sampleCount} sample demos available below)</span>}
            </>
          ) : (
            <strong>{plural(realOpenCount, "real open job")} in Lahore right now.</strong>
          )}
        </p>
      </div>
      {!compact && (
        <div className="hero-features-plate plate-bolted" aria-label="Maddad Marketplace Architecture">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--violet-400)",
                boxShadow: "0 0 10px var(--violet-glow)",
              }}
            />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--violet-300)" }}>
              Lahore Pilot Principles
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div
              style={{
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-700)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--violet-200)", fontFamily: "var(--font-display)" }}>
                0%
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2 }}>
                Zero Escrow
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: 2, lineHeight: 1.3 }}>
                Direct cash or mobile wallet payment
              </div>
            </div>

            <div
              style={{
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-700)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#60a5fa", fontFamily: "var(--font-display)" }}>
                Lahore
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2 }}>
                City-Wide Coverage
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: 2, lineHeight: 1.3 }}>
                Gulberg, DHA, Cantt, Johar Town &amp; more
              </div>
            </div>

            <div
              style={{
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-700)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--emerald-400)", fontFamily: "var(--font-display)" }}>
                Private
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2 }}>
                Address Protected
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: 2, lineHeight: 1.3 }}>
                Shared only with the technician you hire
              </div>
            </div>

            <div
              style={{
                background: "var(--ink-0)",
                border: "1px solid var(--graphite-700)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--amber-300)", fontFamily: "var(--font-display)" }}>
                2 Trades
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)", marginTop: 2 }}>
                Plumbing &amp; Electric
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: 2, lineHeight: 1.3 }}>
                Specialized independent technicians
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { icon: <IconFileText size={18} />, t: "1 · Describe the job", d: "Say what needs fixing, pick your Lahore area and when you need help." },
    { icon: <IconUsers size={18} />, t: "2 · Independent technicians bid", d: "Nearby plumbers and electricians send their price and arrival time." },
    { icon: <IconCheck size={18} />, t: "3 · You choose and pay directly", d: "Compare bids, hire one technician, then settle payment with them." },
  ];
  return (
    <section aria-labelledby="how-title" className="stack-sm">
      <h2 id="how-title" className="sr-only">
        How Maddad works
      </h2>
      <div className="steps-grid">
        {steps.map((s) => (
          <div key={s.t} className="step-card">
            <span className="module module-sm" aria-hidden="true">
              {s.icon}
            </span>
            <div>
              <div className="step-heading">{s.t}</div>
              <p className="step-text">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrustPanel() {
  const items = [
    {
      icon: <IconBanknote size={18} />,
      t: "You pay the technician directly",
      d: "Cash or mobile wallet, agreed between you. Maddad does not hold, process or refund money — there is no escrow.",
    },
    {
      icon: <IconLock size={18} />,
      t: "Private by default",
      d: "Technicians see only your area. Your exact address and phone number are shared only with the technician you hire.",
    },
    {
      icon: <IconInfo size={18} />,
      t: "We don’t employ or guarantee anyone",
      d: "Maddad doesn’t dispatch workers or guarantee workmanship. “ID reviewed” means our team looked at submitted documents — not that skills or safety are verified.",
    },
  ];
  return (
    <section className="plate plate-bolted" style={{ padding: 20 }} aria-labelledby="trust-title">
      <h2 id="trust-title" style={{ marginTop: 0 }}>
        What to know before you hire
      </h2>
      <div className="grid grid-3">
        {items.map((i) => (
          <div key={i.t} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
            <span className="module module-sm" aria-hidden="true">
              {i.icon}
            </span>
            <div>
              <strong>{i.t}</strong>
              <p className="hint" style={{ fontSize: "0.85rem" }}>
                {i.d}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/* Marketplace view                                                   */
/* ---------------------------------------------------------------- */
type Sort = "newest" | "bids_high" | "bids_low" | "budget";

export function TradeIcon({ category, size = 18 }: { category: string; size?: number }) {
  return category.toLowerCase() === "plumbing" ? <IconWrench size={size} aria-hidden="true" /> : <IconZap size={size} aria-hidden="true" />;
}

export function JobCard({ job, onOpen, ownJob }: { job: PublicJobItem; onOpen: (j: PublicJobItem) => void; ownJob?: boolean }) {
  return (
    <article className="job-card" data-urgent={job.asap} onClick={() => onOpen(job)}>
      <div className="job-card-top">
        <span className="module module-sm" aria-hidden="true">
          <TradeIcon category={job.category} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="job-title">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(job);
              }}
              style={{ all: "unset", cursor: "pointer", display: "block" }}
              aria-label={`Open job: ${job.title}`}
            >
              {job.title}
            </button>
          </h3>
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <span className="pill">{job.category}</span>
            <StatusBadge status={job.status} />
            {job.asap && (
              <span className="pill pill-warn">
                <IconClock size={12} aria-hidden="true" />
                Urgent
              </span>
            )}
            {job.is_demo && <DemoBadge />}
            {ownJob && <span className="pill pill-info">Your job</span>}
            {job.my_bid_status && <StatusBadge status={job.my_bid_status} kind="bid" />}
          </div>
        </div>
      </div>
      <p className="job-desc">{job.description}</p>
      <div className="job-facts">
        <span className="fact">
          <IconMapPin size={14} aria-hidden="true" />
          {job.area}, Lahore
        </span>
        <span className="fact">
          <IconCalendar size={14} aria-hidden="true" />
          {whenLabel(job)}
        </span>
      </div>
      <div className="job-card-foot">
        <div className="row" style={{ gap: 14 }}>
          <span className="budget">
            <small>Budget</small>
            {budgetLabel(job.budget_min, job.budget_max)}
          </span>
          <span className="pill pill-violet">{job.bid_count === 0 ? "No bids yet" : plural(job.bid_count, "bid")}</span>
        </div>
        <span className="btn btn-sm" aria-hidden="true" style={{ pointerEvents: "none" }}>
          View details <IconArrowRight size={14} />
        </span>
      </div>
    </article>
  );
}

export function MarketplaceView({
  jobs,
  areas,
  user,
  ownJobIds,
  onOpenJob,
  onPost,
}: {
  jobs: PublicJobItem[];
  areas: AreaOption[];
  user: AppUser | null;
  ownJobIds: Set<string>;
  onOpenJob: (j: PublicJobItem) => void;
  onPost?: () => void;
}) {
  const [trade, setTrade] = useState("all");
  const [area, setArea] = useState("all");
  const [q, setQ] = useState("");
  const [asap, setAsap] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showSamples, setShowSamples] = useState(false);

  // Strictly separate real customer jobs from synthetic pilot demos
  const realJobs = useMemo(() => jobs.filter((j) => !j.is_demo), [jobs]);
  const sampleJobs = useMemo(() => jobs.filter((j) => j.is_demo), [jobs]);

  const activeFilters = (trade !== "all" ? 1 : 0) + (area !== "all" ? 1 : 0) + (asap ? 1 : 0) + (q.trim() ? 1 : 0);
  const reset = () => {
    setTrade("all");
    setArea("all");
    setQ("");
    setAsap(false);
  };

  const counts = useMemo(() => {
    const byTrade: Record<string, number> = {};
    const byArea: Record<string, number> = {};
    realJobs.forEach((j) => {
      byTrade[j.category.toLowerCase()] = (byTrade[j.category.toLowerCase()] ?? 0) + 1;
      byArea[j.area] = (byArea[j.area] ?? 0) + 1;
    });
    return { byTrade, byArea };
  }, [realJobs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = realJobs.filter((j) => {
      if (trade !== "all" && j.category.toLowerCase() !== trade) return false;
      if (area !== "all" && j.area !== area) return false;
      if (asap && !j.asap) return false;
      if (needle && !`${j.title} ${j.description} ${j.area}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const t = (d: string | Date) => new Date(d).getTime();
    return [...list].sort((a, b) => {
      if (sort === "bids_high") return b.bid_count - a.bid_count;
      if (sort === "bids_low") return a.bid_count - b.bid_count;
      if (sort === "budget") return (b.budget_max ?? b.budget_min ?? 0) - (a.budget_max ?? a.budget_min ?? 0);
      return t(b.created_at) - t(a.created_at);
    });
  }, [realJobs, trade, area, asap, q, sort]);

  const areaNames = useMemo(() => {
    const names = new Set(areas.map((a) => a.name));
    realJobs.forEach((j) => names.add(j.area));
    return Array.from(names).sort();
  }, [areas, realJobs]);

  return (
    <div className="market-layout">
      <aside className={`filters plate`} data-open={filtersOpen} aria-label="Filters">
        <div className="row-between filters-toggle">
          <span className="filter-title" style={{ fontSize: "0.85rem" }}>
            <IconFilter size={14} aria-hidden="true" /> Filters{activeFilters ? ` (${activeFilters})` : ""}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            aria-expanded={filtersOpen}
            aria-controls="filters-body"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            {filtersOpen ? "Hide" : "Show"}
          </button>
        </div>
        <div className="filters-body" id="filters-body">
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend className="filter-title" style={{ padding: 0, marginBottom: 8 }}>
              Trade
            </legend>
            <div className="chips">
              <button type="button" className="chip" aria-pressed={trade === "all"} onClick={() => setTrade("all")}>
                All ({realJobs.length})
              </button>
              <button type="button" className="chip" aria-pressed={trade === "plumbing"} onClick={() => setTrade("plumbing")}>
                <IconWrench size={14} aria-hidden="true" /> Plumbing ({counts.byTrade.plumbing ?? 0})
              </button>
              <button type="button" className="chip" aria-pressed={trade === "electrical"} onClick={() => setTrade("electrical")}>
                <IconZap size={14} aria-hidden="true" /> Electrical ({counts.byTrade.electrical ?? 0})
              </button>
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="filter-area" className="filter-title">
              Area in Lahore
            </label>
            <select id="filter-area" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="all">All areas</option>
              {areaNames.map((a) => (
                <option key={a} value={a}>
                  {a} ({counts.byArea[a] ?? 0})
                </option>
              ))}
            </select>
          </div>

          <label className="check">
            <input type="checkbox" checked={asap} onChange={(e) => setAsap(e.target.checked)} />
            <span>Urgent only (as soon as possible)</span>
          </label>

          <div className="field">
            <label htmlFor="filter-sort" className="filter-title">
              Sort by
            </label>
            <select id="filter-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="newest">Newest first</option>
              <option value="bids_low">Fewest bids first</option>
              <option value="bids_high">Most bids first</option>
              <option value="budget">Highest budget</option>
            </select>
          </div>

          <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={!activeFilters}>
            <IconRefreshCw size={14} aria-hidden="true" /> Reset filters
          </button>

          <p className="notice notice-privacy" style={{ fontSize: "0.8rem" }}>
            <IconLock size={14} aria-hidden="true" />
            <span>Listings show only an approximate area. Exact addresses and phone numbers stay private.</span>
          </p>
        </div>
      </aside>

      <div className="content-col stack">
        <div className="search-bar" role="search">
          <IconSearch size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search jobs"
            placeholder="Search real jobs, e.g. geyser, water motor, wiring…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" className="btn btn-ghost btn-sm btn-icon search-clear" onClick={() => setQ("")} aria-label="Clear search">
              <IconX size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="result-bar">
          <p className="result-count" role="status" aria-live="polite">
            {activeFilters ? `Showing ${filtered.length} of ${plural(realJobs.length, "active job")}` : plural(realJobs.length, "active job") + " in Lahore"}
          </p>
          {activeFilters > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              Clear filters
            </button>
          )}
        </div>

        {realJobs.length === 0 ? (
          <div className="plate plate-bolted" style={{ padding: "40px 24px", textAlign: "center" }}>
            <span className="module" style={{ margin: "0 auto 16px", background: "var(--violet-soft)", color: "var(--violet-300)" }}>
              <IconFileText size={26} aria-hidden="true" />
            </span>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.2rem", fontWeight: 800 }}>No real customer jobs posted yet</h3>
            <p style={{ maxWidth: 460, margin: "0 auto 18px", color: "var(--text-2)", lineHeight: 1.6, fontSize: "0.92rem" }}>
              The pilot is live in Lahore. Describe a repair job (plumbing or electrical) to receive competitive bids from independent local technicians.
            </p>
            {onPost && (
              <button type="button" className="btn btn-primary btn-lg" onClick={onPost} style={{ margin: "0 auto" }}>
                <IconPlus size={18} aria-hidden="true" />
                Post the first job
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconSearch size={22} />}
            title="No jobs match these filters"
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
                Reset filters
              </button>
            }
          >
            Try another area or trade, or clear your search.
          </EmptyState>
        ) : (
          <div className="job-list">
            {filtered.map((j) => (
              <JobCard key={j.id} job={j} onOpen={onOpenJob} ownJob={ownJobIds.has(j.id)} />
            ))}
          </div>
        )}

        {/* Clearly Separated Sample Pilot Demonstration Jobs */}
        {sampleJobs.length > 0 && (
          <section className="plate plate-bolted" style={{ marginTop: 24, padding: "20px 22px" }} aria-label="Sample demonstration jobs">
            <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
              <div>
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span className="pill pill-warn" style={{ fontSize: "0.72rem", textTransform: "uppercase" }}>Sample Demonstrations</span>
                  <span className="meta">{sampleJobs.length} demonstration posts</span>
                </div>
                <h3 style={{ margin: "2px 0 0", fontSize: "1.05rem" }}>Explore Sample Job Posts</h3>
                <p className="meta" style={{ margin: "2px 0 0" }}>
                  These are synthetic demonstration posts showing how local Lahore repairs and quotes work on Maddad.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowSamples((v) => !v)}
              >
                {showSamples ? "Hide sample jobs" : `View ${sampleJobs.length} sample jobs`}
              </button>
            </div>

            {showSamples && (
              <div className="job-list" style={{ marginTop: 18 }}>
                {sampleJobs.map((j) => (
                  <JobCard key={j.id} job={j} onOpen={onOpenJob} ownJob={false} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Job details dialog (public info only) + bid form for technicians    */
/* ---------------------------------------------------------------- */
type BidErrors = Partial<Record<"amount" | "timing" | "message" | "inclusions" | "exclusions", string>>;

export function JobDialog({
  job,
  user,
  isOwn,
  onClose,
  onSignIn,
  onJoin,
  onBidSent,
}: {
  job: PublicJobItem | null;
  user: AppUser | null;
  isOwn: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onJoin: () => void;
  onBidSent: (msg: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [timing, setTiming] = useState("");
  const [message, setMessage] = useState("");
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [errors, setErrors] = useState<BidErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  React.useEffect(() => {
    setAmount("");
    setTiming("");
    setMessage("");
    setInclusions("");
    setExclusions("");
    setErrors({});
    setServerError(null);
    setSent(false);
  }, [job?.id]);

  const close = () => onClose();

  const validate = (): BidErrors => {
    const e: BidErrors = {};
    const n = Number(amount);
    if (!amount.trim()) e.amount = "Enter your labour price in whole rupees.";
    else if (!Number.isInteger(n)) e.amount = "Enter whole rupees, without decimals.";
    else if (n < 100) e.amount = "The minimum bid is Rs 100.";
    else if (n > 10_000_000) e.amount = "That amount is too high.";
    if (timing.trim().length < 3) e.timing = "Tell the customer when you can come (at least 3 characters).";
    if (message.trim().length < 5) e.message = "Add a short message (at least 5 characters).";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!job) return;
    const e = validate();
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      document.getElementById(`bid-${first}`)?.focus();
      return;
    }
    setSending(true);
    const fd = new FormData();
    fd.set("amount", String(Number(amount)));
    fd.set("timingText", timing.trim());
    fd.set("message", message.trim());
    fd.set("inclusions", inclusions.trim());
    fd.set("exclusions", exclusions.trim());
    try {
      const res = await submitBidAction(job.id, null, fd);
      if (res?.error) setServerError(res.error);
      else {
        setSent(true);
        onBidSent(res?.ok ?? "Your bid was sent.");
      }
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const hasBid = job?.my_bid_status === "active" || sent;

  return (
    <Dialog
      open={Boolean(job)}
      onClose={close}
      title={job?.title ?? ""}
      eyebrow={
        job && (
          <div className="row" style={{ gap: 6 }}>
            <span className="pill">
              <TradeIcon category={job.category} size={12} /> {job.category}
            </span>
            <StatusBadge status={job.status} />
            {job.asap && <span className="pill pill-warn">Urgent</span>}
            {job.is_demo && <DemoBadge />}
          </div>
        )
      }
    >
      {job && (
        <>
          <dl className="kv">
            <div>
              <dt>Area</dt>
              <dd>{job.area}, Lahore</dd>
              <span className="hint">Approximate area only</span>
            </div>
            <div>
              <dt>When</dt>
              <dd>{whenLabel(job)}</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>{budgetLabel(job.budget_min, job.budget_max)}</dd>
            </div>
            <div>
              <dt>Bids so far</dt>
              <dd>{job.bid_count === 0 ? "No bids yet" : plural(job.bid_count, "bid")}</dd>
            </div>
          </dl>

          <div>
            <h3 style={{ marginBottom: 6 }}>What needs doing</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>
            <p className="hint" style={{ marginTop: 8 }}>
              Posted {fmtDateTime(job.created_at)} · Open until {fmtDate(job.expires_at)}
            </p>
          </div>

          {job.is_demo && (
            <p className="notice notice-warn">
              <IconInfo size={16} aria-hidden="true" />
              <span>This is a demo listing with fictional details, for testing the pilot.</span>
            </p>
          )}

          <p className="notice notice-privacy">
            <IconLock size={16} aria-hidden="true" />
            <span>
              The exact address and phone number are private. Only the technician the customer hires will see them. Payment is
              arranged directly between the two of you.
            </span>
          </p>

          {/* ---- Role-aware action area ---- */}
          {isOwn ? (
            <div className="plate" style={{ padding: 16 }}>
              <strong>This is your job.</strong>
              <p className="hint" style={{ margin: "4px 0 12px" }}>
                Bids are visible only to you. Compare them and choose a technician on your job page.
              </p>
              <Link className="btn btn-primary" href={`/jobs/${job.id}`}>
                Compare bids ({job.bid_count}) <IconArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : !user ? (
            <div className="plate" style={{ padding: 16 }}>
              <strong>Want to bid on this job?</strong>
              <p className="hint" style={{ margin: "4px 0 12px" }}>
                Sign in with your mobile number and set up a technician profile. Bids can only be sent by signed-in technicians.
              </p>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={onSignIn}>
                  Sign in to bid
                </button>
                <button type="button" className="btn" onClick={onJoin}>
                  Join as a technician
                </button>
              </div>
            </div>
          ) : !user.is_worker ? (
            <div className="plate" style={{ padding: 16 }}>
              <strong>Set up a technician profile to bid.</strong>
              <p className="hint" style={{ margin: "4px 0 12px" }}>
                Choose your trades and Lahore service areas. Then you can bid on matching jobs.
              </p>
              <Link className="btn btn-primary" href="/worker/profile">
                Create technician profile <IconArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : sent ? (
            <div className="plate success-panel" style={{ display: "flex", flexDirection: "column" }} role="status">
              <span className="module module-lg" aria-hidden="true">
                <IconCheck size={24} />
              </span>
              <h3>Bid sent to the customer</h3>
              <p>You can update or withdraw it until the customer chooses. We’ll notify you of their decision.</p>
              <button type="button" className="btn btn-primary" onClick={close}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="stack" aria-labelledby="bid-form-title">
              <h3 id="bid-form-title">{hasBid ? "Update your bid" : "Send your bid"}</h3>
              {hasBid && (
                <p className="notice notice-info">
                  <IconInfo size={16} aria-hidden="true" />
                  <span>You already have a bid on this job. Sending again will update it.</span>
                </p>
              )}
              <div className="grid grid-2">
                <Field id="bid-amount" label="Your labour price (Rs)" error={errors.amount} hint="Whole rupees. Materials are agreed separately.">
                  {(p) => (
                    <input
                      {...p}
                      type="number"
                      inputMode="numeric"
                      min={100}
                      step={50}
                      placeholder="e.g. 1500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  )}
                </Field>
                <Field id="bid-timing" label="When can you come?" error={errors.timing} hint="Example: today 3–5 pm">
                  {(p) => (
                    <input
                      {...p}
                      type="text"
                      maxLength={120}
                      placeholder="Today between 3 and 5 pm"
                      value={timing}
                      onChange={(e) => setTiming(e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Field id="bid-message" label="Message to the customer" error={errors.message} counter={`${message.length}/800`}>
                {(p) => (
                  <textarea
                    {...p}
                    maxLength={800}
                    rows={3}
                    placeholder="How you’d approach the job and what tools you’ll bring."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                )}
              </Field>
              <div className="grid grid-2">
                <Field id="bid-inclusions" label="Price includes" optional>
                  {(p) => (
                    <input {...p} type="text" maxLength={500} placeholder="Labour, diagnosis" value={inclusions} onChange={(e) => setInclusions(e.target.value)} />
                  )}
                </Field>
                <Field id="bid-exclusions" label="Price excludes" optional>
                  {(p) => (
                    <input {...p} type="text" maxLength={500} placeholder="Replacement parts" value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
                  )}
                </Field>
              </div>
              {serverError && (
                <p className="msg msg-error" role="alert">
                  {serverError}
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-lg" disabled={sending}>
                {sending ? <IconRefreshCw size={16} className="spin" aria-hidden="true" /> : <IconSend size={16} aria-hidden="true" />}
                {sending ? "Sending…" : hasBid ? "Update bid" : "Send bid"}
              </button>
            </form>
          )}
        </>
      )}
    </Dialog>
  );
}

