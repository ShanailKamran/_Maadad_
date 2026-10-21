"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconAlertCircle,
  IconArrowRight,
  IconBriefcase,
  IconCheck,
  IconClock,
  IconLock,
  IconMapPin,
  IconPhone,
  IconPlus,
  IconRefreshCw,
  IconShield,
  IconShieldCheck,
  IconStar,
  IconUser,
  IconWrench,
  IconZap,
} from "../icons";
import {
  acceptBidAction,
  progressAction,
  reportProblemAction,
  withdrawBidAction,
  reviewAction,
} from "@/app/actions";
import type { AppUser, BookingItem, CustomerJobItem, PublicJobItem, WorkerBidItem } from "./types";
import { EmptyState, StatusBadge, budgetLabel, fmtDate, fmtDateTime, pkr, plural } from "./shared";

/* ---------------------------------------------------------------- */
/* CUSTOMER DASHBOARD                                               */
/* ---------------------------------------------------------------- */
interface CustomerDashboardProps {
  user: AppUser;
  jobs: CustomerJobItem[];
  bookings: BookingItem[];
  onOpenJob: (job: PublicJobItem) => void;
  onPostJob: () => void;
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

export function CustomerDashboardView({
  user,
  jobs,
  bookings,
  onOpenJob,
  onPostJob,
  onToast,
}: CustomerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"jobs" | "bookings">("jobs");
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  const openJobs = jobs.filter((j) => j.status === "open" || j.status === "draft");
  const completedJobs = jobs.filter((j) => j.status === "completed" || j.status === "cancelled");
  const activeBookings = bookings.filter((b) => b.status !== "completed" && b.status !== "cancelled");
  const pastBookings = bookings.filter((b) => b.status === "completed" || b.status === "cancelled");

  const handleAcceptBid = async (jobId: string, bidId: string) => {
    const exactAddress = window.prompt(
      "Confirm hiring this technician?\n\nEnter your exact house number, street address, and sector (this will be unlocked ONLY for this hired technician):",
    );
    if (exactAddress === null) return; // User cancelled
    const cleanAddress = exactAddress.trim();
    if (!cleanAddress || cleanAddress.length < 5) {
      onToast("Please enter your exact house number and street (at least 5 characters) so the technician can arrive.", "error");
      return;
    }
    setSubmittingAction(`accept-${bidId}`);
    try {
      const fd = new FormData();
      fd.set("jobId", jobId);
      fd.set("bidId", bidId);
      fd.set("exactAddress", cleanAddress);
      await acceptBidAction(null, fd);
      onToast("Bid accepted! The technician has been hired and your exact address is unlocked for them.");
      window.location.reload();
    } catch {
      onToast("Failed to accept bid. Please try again.", "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleConfirmCompletion = async (booking: BookingItem) => {
    if (!window.confirm("Confirm that the technician has finished the work to your satisfaction?")) return;
    setSubmittingAction(`complete-${booking.id}`);
    try {
      const fd = new FormData();
      fd.set("bookingId", booking.id);
      fd.set("action", "confirm");
      fd.set("jobId", booking.job_id);
      await progressAction(null, fd);
      onToast("Job marked as completed. You can now leave a review for the technician.");
      window.location.reload();
    } catch {
      onToast("Failed to confirm completion.", "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleReportProblem = async (booking: BookingItem) => {
    const details = window.prompt("Please describe the issue or dispute regarding this booking:");
    if (!details || !details.trim()) return;
    setSubmittingAction(`dispute-${booking.id}`);
    try {
      const fd = new FormData();
      fd.set("bookingId", booking.id);
      fd.set("jobId", booking.job_id);
      fd.set("details", details.trim());
      await reportProblemAction(null, fd);
      onToast("Problem reported. The booking is marked disputed and sent to our moderation queue.");
      window.location.reload();
    } catch {
      onToast("Failed to submit dispute.", "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
      {/* Overview Stat Cards */}
      <div className="plate plate-bolted" style={{ padding: "20px 24px" }}>
        <div className="row-between">
          <div>
            <span className="hero-eyebrow">Customer Hub</span>
            <h1 style={{ margin: "4px 0 0", fontSize: "1.5rem" }}>My Jobs &amp; Bookings</h1>
            <p className="meta" style={{ margin: 0 }}>
              Track quotes, compare technicians, and coordinate job completion.
            </p>
          </div>
          <button type="button" onClick={onPostJob} className="btn btn-primary">
            <IconPlus size={16} /> Post a New Job
          </button>
        </div>

        <div className="stat-grid" style={{ marginTop: 20 }}>
          <div className="stat">
            <div className="l">Open Jobs</div>
            <div className="n">{openJobs.length}</div>
          </div>
          <div className="stat">
            <div className="l">Active Bookings</div>
            <div className="n">{activeBookings.length}</div>
          </div>
          <div className="stat">
            <div className="l">Total Posted</div>
            <div className="n">{jobs.length}</div>
          </div>
          <div className="stat">
            <div className="l">Completed History</div>
            <div className="n">{pastBookings.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="Customer sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "jobs"}
          onClick={() => setActiveTab("jobs")}
          className="tab-btn"
        >
          <IconBriefcase size={16} />
          <span>My Posted Jobs</span>
          <span className="tab-badge">{jobs.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bookings"}
          onClick={() => setActiveTab("bookings")}
          className="tab-btn"
        >
          <IconShieldCheck size={16} />
          <span>Bookings &amp; Hired Workers</span>
          {activeBookings.length > 0 && <span className="tab-badge tab-badge-alert">{activeBookings.length}</span>}
        </button>
      </div>

      {/* VIEW: MY POSTED JOBS */}
      {activeTab === "jobs" && (
        <div className="stack">
          {jobs.length === 0 ? (
            <EmptyState
              icon={<IconBriefcase size={24} />}
              title="You haven't posted any jobs yet"
              action={
                <button type="button" onClick={onPostJob} className="btn btn-primary">
                  <IconPlus size={16} /> Post your first job
                </button>
              }
            >
              Post a plumbing or electrical job in Lahore and get integer PKR bids from local independent technicians.
            </EmptyState>
          ) : (
            <div className="stack">
              {jobs.map((job) => {
                const isDraft = job.status === "draft";
                return (
                  <div key={job.id} className="plate" style={{ padding: "20px 22px" }}>
                    <div className="row-between" style={{ alignItems: "flex-start" }}>
                      <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="pill pill-violet">{job.category}</span>
                          <span className="pill">{job.area}, Lahore</span>
                          <StatusBadge status={job.status} />
                          {job.asap && <span className="pill pill-warn">⚡ Urgent</span>}
                        </div>
                        <h3 style={{ fontSize: "1.15rem", margin: "4px 0 0" }}>
                          <Link href={isDraft ? `/jobs/${job.id}/preview` : `/jobs/${job.id}`} style={{ color: "#fff", textDecoration: "none" }}>
                            {job.title}
                          </Link>
                        </h3>
                        <p className="meta" style={{ margin: 0 }}>
                          Budget: {budgetLabel(job.budget_min, job.budget_max)} · Posted {fmtDate(job.created_at)}
                        </p>
                      </div>

                      <div className="row" style={{ gap: 10 }}>
                        <span className="pill pill-violet" style={{ fontSize: "0.85rem", padding: "4px 12px" }}>
                          {plural(job.bid_count, "bid")} received
                        </span>
                        <Link href={`/jobs/${job.id}`} className="btn btn-secondary btn-sm">
                          <span>View &amp; Compare Bids</span>
                          <IconArrowRight size={14} />
                        </Link>
                      </div>
                    </div>

                    <p className="job-desc" style={{ marginTop: 12, marginBottom: 12 }}>
                      {job.description}
                    </p>

                    {/* Received bids preview box */}
                    {job.bid_count > 0 && job.status === "open" && (
                      <div
                        style={{
                          background: "var(--ink-1)",
                          borderRadius: "var(--r-sm)",
                          border: "1px solid var(--line)",
                          padding: "12px 16px",
                          marginTop: 10,
                        }}
                        className="row-between"
                      >
                        <div className="row" style={{ gap: 8 }}>
                          <span className="module module-sm">
                            <IconStar size={16} />
                          </span>
                          <div>
                            <strong style={{ fontSize: "0.9rem", color: "#fff" }}>
                              {job.bid_count} technician{job.bid_count === 1 ? "" : "s"} submitted quotes
                            </strong>
                            <p className="hint" style={{ margin: 0 }}>
                              Compare prices, arrival times, and reputation ratings privately.
                            </p>
                          </div>
                        </div>

                        <Link href={`/jobs/${job.id}`} className="btn btn-primary btn-sm">
                          Compare &amp; Hire
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: BOOKINGS & HIRED WORKERS */}
      {activeTab === "bookings" && (
        <div className="stack">
          {bookings.length === 0 ? (
            <EmptyState
              icon={<IconShieldCheck size={24} />}
              title="No bookings yet"
            >
              When you accept a technician&apos;s bid, the booking details, direct phone number, and completion code appear here.
            </EmptyState>
          ) : (
            <div className="stack">
              {bookings.map((booking) => {
                const isCompleted = booking.status === "completed";
                const isDisputed = booking.status === "disputed";
                const isActing = submittingAction?.includes(booking.id);

                return (
                  <div
                    key={booking.id}
                    className="plate plate-bolted stack"
                    style={{
                      padding: "20px 24px",
                      borderColor: isCompleted ? "rgba(95, 211, 154, 0.3)" : isDisputed ? "rgba(255, 138, 138, 0.4)" : "var(--violet-line)",
                    }}
                  >
                    <div className="row-between">
                      <div>
                        <div className="row" style={{ gap: 8 }}>
                          <StatusBadge status={booking.status} />
                          <span className="pill">Agreed: {pkr(booking.amount)}</span>
                        </div>
                        <h3 style={{ fontSize: "1.2rem", margin: "6px 0 2px", color: "#fff" }}>
                          {booking.title}
                        </h3>
                        <p className="meta" style={{ margin: 0 }}>
                          Hired Technician: <strong>{booking.worker_name || "Assigned Worker"}</strong> · Selected {fmtDateTime(booking.selected_at)}
                        </p>
                      </div>
                    </div>

                    {/* Unlocked Private Details Box */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                        gap: 14,
                        padding: "16px 18px",
                        borderRadius: "var(--r-md)",
                        background: "var(--ink-1)",
                        border: "1px solid var(--line-strong)",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--ok)", fontWeight: 700 }}>
                          📞 Direct Technician Contact:
                        </div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", marginTop: 4 }}>
                          {booking.worker_name || "Technician"}
                        </div>
                        <p className="hint" style={{ margin: "2px 0 0" }}>
                          Arrange exact arrival or directions via direct phone call.
                        </p>
                      </div>

                      <div>
                        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--violet-300)", fontWeight: 700 }}>
                          🔑 Your Completion Code:
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <span className="completion-code-box" style={{ fontSize: "1.4rem", padding: "6px 16px" }}>
                            {/* In client view if code exists */}
                            4819
                          </span>
                        </div>
                        <p className="hint" style={{ margin: "4px 0 0" }}>
                          Give this 4-digit code to the technician only after checking that the work is completely done.
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="row-between" style={{ marginTop: 6 }}>
                      <Link href={`/jobs/${booking.job_id}`} className="btn btn-ghost btn-sm">
                        View Full Job File →
                      </Link>

                      <div className="row" style={{ gap: 10 }}>
                        {!isCompleted && !isDisputed && (
                          <button
                            type="button"
                            onClick={() => handleReportProblem(booking)}
                            disabled={isActing}
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--bad)" }}
                          >
                            <IconAlertCircle size={15} />
                            <span>Report a Problem</span>
                          </button>
                        )}

                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleConfirmCompletion(booking)}
                            disabled={isActing}
                            className="btn btn-primary btn-sm"
                          >
                            <IconCheck size={16} />
                            <span>Confirm Work Completed</span>
                          </button>
                        )}

                        {isCompleted && (
                          <Link href={`/jobs/${booking.job_id}#reviews`} className="btn btn-secondary btn-sm">
                            <IconStar size={15} /> Leave / View Review
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* WORKER / TECHNICIAN DASHBOARD                                    */
/* ---------------------------------------------------------------- */
interface WorkerDashboardProps {
  user: AppUser;
  bids: WorkerBidItem[];
  matchingJobs: PublicJobItem[];
  onOpenJob: (job: PublicJobItem) => void;
  onOpenProfile: () => void;
  onToast: (msg: string, kind?: "ok" | "error") => void;
}

export function WorkerDashboardView({
  user,
  bids,
  matchingJobs,
  onOpenJob,
  onOpenProfile,
  onToast,
}: WorkerDashboardProps) {
  const [activeTab, setActiveTab] = useState<"matching" | "my_bids">("matching");
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const activeBids = bids.filter((b) => b.status === "active");
  const acceptedBids = bids.filter((b) => b.status === "accepted");

  const handleWithdrawBid = async (bid: WorkerBidItem) => {
    if (!window.confirm(`Withdraw your bid of Rs ${bid.amount.toLocaleString("en-PK")} for "${bid.title}"?`)) return;
    setWithdrawingId(bid.id);
    try {
      const fd = new FormData();
      fd.set("bidId", bid.id);
      fd.set("jobId", bid.job_id);
      await withdrawBidAction(null, fd);
      onToast("Bid withdrawn successfully.");
      window.location.reload();
    } catch {
      onToast("Failed to withdraw bid.", "error");
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
      {/* Overview Stat Cards */}
      <div className="plate plate-bolted" style={{ padding: "20px 24px" }}>
        <div className="row-between">
          <div>
            <span className="hero-eyebrow">Technician Operations</span>
            <h1 style={{ margin: "4px 0 0", fontSize: "1.5rem" }}>Worker Portal (لاہور کاریگر)</h1>
            <p className="meta" style={{ margin: 0 }}>
              Jobs matched to your plumbing &amp; electrical trades and Lahore service areas.
            </p>
          </div>
          <button type="button" onClick={onOpenProfile} className="btn btn-secondary">
            <IconUser size={16} /> My Trade Profile &amp; Areas
          </button>
        </div>

        <div className="stat-grid" style={{ marginTop: 20 }}>
          <div className="stat">
            <div className="l">Matching Open Jobs</div>
            <div className="n">{matchingJobs.length}</div>
          </div>
          <div className="stat">
            <div className="l">Active Bids</div>
            <div className="n">{activeBids.length}</div>
          </div>
          <div className="stat">
            <div className="l">Hired / Accepted</div>
            <div className="n">{acceptedBids.length}</div>
          </div>
          <div className="stat">
            <div className="l">Total Quotes Sent</div>
            <div className="n">{bids.length}</div>
          </div>
        </div>
      </div>

      {/* Direct Payment Reminder for Technicians */}
      <div
        className="plate"
        style={{
          padding: "14px 18px",
          background: "rgba(124, 58, 237, 0.08)",
          borderColor: "var(--violet-line)",
        }}
      >
        <div className="row" style={{ gap: 10 }}>
          <IconShieldCheck size={18} color="var(--violet-300)" />
          <div style={{ fontSize: "0.88rem", color: "var(--text-2)" }}>
            <strong style={{ color: "#fff" }}>Direct Payment Policy:</strong> Settle labour charges directly with the customer upon arrival or job completion via PKR cash, JazzCash, or EasyPaisa. Maddad does not deduct commissions or hold funds.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" role="tablist" aria-label="Technician sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "matching"}
          onClick={() => setActiveTab("matching")}
          className="tab-btn"
        >
          <IconZap size={16} />
          <span>Available Matching Jobs</span>
          <span className="tab-badge">{matchingJobs.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "my_bids"}
          onClick={() => setActiveTab("my_bids")}
          className="tab-btn"
        >
          <IconBriefcase size={16} />
          <span>My Submitted Quotes</span>
          <span className="tab-badge">{bids.length}</span>
        </button>
      </div>

      {/* VIEW: MATCHING JOBS */}
      {activeTab === "matching" && (
        <div className="stack">
          {matchingJobs.length === 0 ? (
            <EmptyState
              icon={<IconZap size={24} />}
              title="No open jobs matching your profile right now"
              action={
                <button type="button" onClick={onOpenProfile} className="btn btn-secondary">
                  Expand service areas or trades
                </button>
              }
            >
              When customers post plumbing or electrical jobs in your selected Lahore neighbourhoods, they appear here instantly.
            </EmptyState>
          ) : (
            <div className="stack">
              {matchingJobs.map((job) => (
                <div key={job.id} className="plate" style={{ padding: "18px 20px" }}>
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="pill pill-violet">{job.category}</span>
                        <span className="pill">{job.area}, Lahore</span>
                        <StatusBadge status={job.status} />
                        {job.asap && <span className="pill pill-warn">⚡ Urgent</span>}
                        {job.is_demo && <span className="pill pill-demo">Demo</span>}
                      </div>

                      <h3 style={{ fontSize: "1.1rem", margin: "4px 0 2px" }}>
                        <button
                          type="button"
                          onClick={() => onOpenJob(job)}
                          style={{ all: "unset", cursor: "pointer", color: "#fff", fontWeight: 700 }}
                        >
                          {job.title}
                        </button>
                      </h3>

                      <p className="meta" style={{ margin: 0 }}>
                        Customer Budget: <strong>{budgetLabel(job.budget_min, job.budget_max)}</strong> · {plural(job.bid_count, "bid")} currently
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenJob(job)}
                      className="btn btn-primary btn-sm"
                    >
                      <span>Submit Bid</span>
                      <IconArrowRight size={14} />
                    </button>
                  </div>

                  <p className="job-desc" style={{ marginTop: 10 }}>
                    {job.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: MY SUBMITTED BIDS */}
      {activeTab === "my_bids" && (
        <div className="stack">
          {bids.length === 0 ? (
            <EmptyState
              icon={<IconBriefcase size={24} />}
              title="You haven't submitted any bids yet"
            >
              Review the available matching jobs and submit your whole PKR quotes with arrival estimates.
            </EmptyState>
          ) : (
            <div className="stack">
              {bids.map((bid) => {
                const isWithdrawing = withdrawingId === bid.id;
                return (
                  <div key={bid.id} className="plate" style={{ padding: "16px 20px" }}>
                    <div className="row-between">
                      <div className="stack-sm">
                        <div className="row" style={{ gap: 8 }}>
                          <StatusBadge status={bid.status} kind="bid" />
                          <span className="pill">Job Status: {bid.job_status}</span>
                        </div>
                        <h3 style={{ fontSize: "1.1rem", margin: "4px 0 2px", color: "#fff" }}>
                          <Link href={`/jobs/${bid.job_id}`} style={{ color: "#fff", textDecoration: "none" }}>
                            {bid.title}
                          </Link>
                        </h3>
                        <p className="meta" style={{ margin: 0 }}>
                          Your Price: <strong style={{ color: "#fff" }}>{pkr(bid.amount)}</strong> · Last updated {fmtDateTime(bid.updated_at)}
                        </p>
                      </div>

                      <div className="row" style={{ gap: 10 }}>
                        <Link href={`/jobs/${bid.job_id}`} className="btn btn-secondary btn-sm">
                          View Job Details
                        </Link>

                        {bid.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleWithdrawBid(bid)}
                            disabled={isWithdrawing}
                            className="btn btn-ghost btn-sm"
                            style={{ color: "var(--bad)" }}
                          >
                            {isWithdrawing ? "Withdrawing…" : "Withdraw Bid"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
