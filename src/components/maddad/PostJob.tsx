"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  IconCheck,
  IconClock,
  IconLock,
  IconMapPin,
  IconPlus,
  IconRefreshCw,
  IconShieldCheck,
  IconWrench,
  IconZap,
  IconArrowLeft,
  IconArrowRight,
  IconAlertCircle,
  IconEye,
  IconFileText,
  IconCalendar,
} from "../icons";
import { createAndPublishJobAction } from "@/app/actions";
import type { AppUser, AreaOption, CategoryOption } from "./types";
import { Field, looksLikePhone, pkr } from "./shared";

interface PostJobProps {
  user: AppUser | null;
  categories: CategoryOption[];
  areas: AreaOption[];
  onNeedAuth: () => void;
  onSuccess: (jobId: string) => void;
  onViewMarketplace: () => void;
}

export function PostJobView({
  user,
  categories,
  areas,
  onNeedAuth,
  onSuccess,
  onViewMarketplace,
}: PostJobProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ? String(categories[0].id) : "1");
  const [areaId, setAreaId] = useState<string>(areas[0]?.id ? String(areas[0].id) : "1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("1500");
  const [budgetMax, setBudgetMax] = useState("2500");
  const [timingType, setTimingType] = useState<"asap" | "scheduled">("asap");
  const [preferredDate, setPreferredDate] = useState("");
  const [addressText, setAddressText] = useState("");
  const [contactNote, setContactNote] = useState("");
  const [ackDirectPay, setAckDirectPay] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validateStep1 = () => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = "Short title is required (e.g. Bathroom pipe leak repair).";
    } else if (title.trim().length < 5) {
      errs.title = "Title must be at least 5 characters.";
    } else if (title.trim().length > 120) {
      errs.title = "Title cannot exceed 120 characters.";
    } else if (looksLikePhone(title)) {
      errs.title = "Please do not include phone numbers in the public title.";
    }

    if (!description.trim()) {
      errs.description = "Task description is required.";
    } else if (description.trim().length < 20) {
      errs.description = "Please describe the problem in at least 20 characters so technicians can quote accurately.";
    } else if (description.trim().length > 2000) {
      errs.description = "Description cannot exceed 2000 characters.";
    } else if (looksLikePhone(description)) {
      errs.description = "Please do not include phone numbers in public text. Exact phone is shared only with hired technician.";
    }

    if (!areaId) {
      errs.areaId = "Please select a Lahore neighbourhood.";
    }

    if (!addressText.trim()) {
      errs.addressText = "Street address / building number is required.";
    } else if (addressText.trim().length < 5) {
      errs.addressText = "Address must be at least 5 characters.";
    }

    if (timingType === "scheduled" && !preferredDate) {
      errs.preferredDate = "Please pick a preferred date and time.";
    }

    if (budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
      errs.budgetMax = "Maximum budget must be greater than or equal to minimum budget.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onNeedAuth();
      return;
    }
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePublishJob = async () => {
    if (!ackDirectPay) {
      setErrors((prev) => ({
        ...prev,
        ack: "You must acknowledge direct payment and responsibility before publishing.",
      }));
      return;
    }

    setSubmitting(true);
    setServerError(null);

    const fd = new FormData();
    fd.set("categoryId", categoryId);
    fd.set("areaId", areaId);
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    if (budgetMin) fd.set("budgetMin", budgetMin);
    if (budgetMax) fd.set("budgetMax", budgetMax);
    if (timingType === "asap") {
      fd.set("asap", "on");
    } else {
      fd.set("preferredAt", preferredDate);
    }
    fd.set("addressText", addressText.trim());
    if (contactNote.trim()) fd.set("contactNote", contactNote.trim());
    fd.set("ack", "on");

    try {
      const res = await createAndPublishJobAction(null, fd);
      if (res?.error) {
        setServerError(res.error);
        setSubmitting(false);
      } else {
        const jobId = res?.jobId || "new-job";
        setCreatedJobId(jobId);
        setStep(3);
        setSubmitting(false);
        onSuccess(jobId);
      }
    } catch {
      setServerError("An unexpected error occurred while posting the job. Please try again.");
      setSubmitting(false);
    }
  };

  const selectedCategoryName = categories.find((c) => String(c.id) === categoryId)?.name || "Service";
  const selectedAreaName = areas.find((a) => String(a.id) === areaId)?.name || "Lahore Area";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", width: "100%" }} className="stack">
      {/* Header Bar */}
      <div className="plate plate-bolted" style={{ padding: "20px 24px" }}>
        <div className="row-between">
          <div className="stack-sm">
            <span className="hero-eyebrow">Lahore Customer Portal</span>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Post a Plumbing or Electrical Job</h1>
            <p className="meta" style={{ margin: 0 }}>
              Independent local workers will inspect your requirements and submit bids with labour price and arrival time.
            </p>
          </div>
          <div className="module module-lg" aria-hidden="true">
            {categoryId === "2" ? <IconZap size={26} /> : <IconWrench size={26} />}
          </div>
        </div>

        {/* Stepper indicator */}
        <div style={{ marginTop: 20 }}>
          <ol className="stepper" aria-label="Job Posting Steps">
            <li aria-current={step === 1 ? "step" : undefined} data-done={step > 1}>
              <span className={`pill ${step === 1 ? "pill-violet" : step > 1 ? "pill-ok" : ""}`}>
                1. Job Details
              </span>
            </li>
            <li aria-current={step === 2 ? "step" : undefined} data-done={step > 2}>
              <span className={`pill ${step === 2 ? "pill-violet" : step > 2 ? "pill-ok" : ""}`}>
                2. Review &amp; Trust Terms
              </span>
            </li>
            <li aria-current={step === 3 ? "step" : undefined}>
              <span className={`pill ${step === 3 ? "pill-ok" : ""}`}>
                3. Published to Technicians
              </span>
            </li>
          </ol>
        </div>
      </div>

      {/* STEP 1: Main Form */}
      {step === 1 && (
        <form onSubmit={handleProceedToReview} noValidate className="plate stack" style={{ padding: "24px 28px" }}>
          {/* Trade Category Selector */}
          <div>
            <span className="filter-title" style={{ display: "block", marginBottom: 8 }}>
              Select Service Trade:
            </span>
            <div className="grid grid-2" style={{ gap: 12 }}>
              {categories.map((c) => {
                const isSelected = categoryId === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(String(c.id))}
                    className={`btn ${isSelected ? "btn-primary" : "btn-secondary"}`}
                    style={{
                      height: 54,
                      justifyContent: "flex-start",
                      padding: "0 18px",
                      borderWidth: isSelected ? 2 : 1,
                    }}
                  >
                    <span className="module module-sm" style={{ marginRight: 8 }}>
                      {c.slug === "electrical" ? <IconZap size={18} /> : <IconWrench size={18} />}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: "1rem" }}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Job Title */}
          <Field
            id="job-title"
            label="Short Job Title"
            hint="Summarize the issue clearly (e.g. Geyser switch sparking or concealed kitchen drain clog)."
            error={errors.title}
          >
            {(p) => (
              <input
                {...p}
                type="text"
                placeholder="e.g. Water tank suction motor capacitor replacement"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
              />
            )}
          </Field>

          {/* Job Description */}
          <Field
            id="job-description"
            label="What needs repair or installation?"
            hint="Describe height, access requirements, materials you already have, or warning signs. Do NOT put your phone number or CNIC here."
            counter={`${description.length}/2000`}
            error={errors.description}
          >
            {(p) => (
              <textarea
                {...p}
                rows={4}
                placeholder="e.g. The 1.5 HP suction motor in the basement hums but won't start rotating. Need someone with testing meter and spare capacitor to diagnose."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
            )}
          </Field>

          {/* Neighbourhood selection - MANUAL, no geolocation forced */}
          <div className="grid grid-2">
            <Field
              id="job-area"
              label="Lahore Neighbourhood / Area"
              hint="Only this general area is visible to bidding technicians."
              error={errors.areaId}
            >
              {(p) => (
                <select {...p} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {/* Timing selection */}
            <div className="field">
              <label htmlFor="timing-type">When is service required?</label>
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setTimingType("asap")}
                  className={`btn btn-sm ${timingType === "asap" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                >
                  <IconClock size={15} />
                  <span>⚡ Urgent / ASAP</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTimingType("scheduled")}
                  className={`btn btn-sm ${timingType === "scheduled" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1 }}
                >
                  <IconCalendar size={15} />
                  <span>📅 Specific Time</span>
                </button>
              </div>
            </div>
          </div>

          {timingType === "scheduled" && (
            <Field
              id="job-preferred-date"
              label="Preferred Date & Time (Pakistan Time)"
              hint="Select when you will be home to welcome the technician."
              error={errors.preferredDate}
            >
              {(p) => (
                <input
                  {...p}
                  type="datetime-local"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                />
              )}
            </Field>
          )}

          {/* Estimated Budget Range */}
          <div>
            <label className="filter-title" style={{ display: "block", marginBottom: 6 }}>
              Estimated Labour Budget (PKR - Optional):
            </label>
            <div className="grid grid-2">
              <Field id="job-budget-min" label="Min PKR" hint="Starting estimate">
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    min={100}
                    step={100}
                    placeholder="e.g. 1000"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                  />
                )}
              </Field>
              <Field id="job-budget-max" label="Max PKR" hint="Upper limit" error={errors.budgetMax}>
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    min={100}
                    step={100}
                    placeholder="e.g. 2500"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <p className="hint" style={{ marginTop: 4 }}>
              Workers bid their own labour price. Leaving it flexible allows technicians to offer competitive quotes.
            </p>
          </div>

          {/* Private details box */}
          <div
            style={{
              padding: "16px 18px",
              borderRadius: "var(--r-md)",
              background: "var(--ink-1)",
              border: "1px solid var(--violet-line)",
            }}
            className="stack-sm"
          >
            <div className="row" style={{ color: "var(--violet-300)" }}>
              <IconLock size={18} aria-hidden="true" />
              <strong>Private Job Location (Strictly Protected)</strong>
            </div>
            <p className="hint" style={{ margin: 0, color: "var(--text-2)" }}>
              This exact address is never displayed publicly. It is decrypted and unlocked <strong>only</strong> for the single technician you explicitly accept.
            </p>

            <Field
              id="job-address"
              label="Street address & house number"
              hint="e.g. House 42-B, Street 7, Sector Y, Phase 3, DHA"
              error={errors.addressText}
            >
              {(p) => (
                <input
                  {...p}
                  type="text"
                  placeholder="Street and house number"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  maxLength={300}
                />
              )}
            </Field>

            <Field
              id="job-contact-note"
              label="Access instruction (Optional)"
              hint="e.g. 2nd floor, ring bell twice, guard requires verification at gate"
              optional
            >
              {(p) => (
                <input
                  {...p}
                  type="text"
                  placeholder="Gate instructions or bell details"
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  maxLength={300}
                />
              )}
            </Field>
          </div>

          <div className="row-between" style={{ marginTop: 12 }}>
            <button type="button" onClick={onViewMarketplace} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-lg">
              <span>Review Job &amp; Confirm</span>
              <IconArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}

      {/* STEP 2: Review Preview & Mandatory Direct Settlement Acknowledgement */}
      {step === 2 && (
        <div className="plate plate-bolted stack" style={{ padding: "24px 28px" }}>
          <div className="row-between">
            <div>
              <span className="hero-eyebrow">Review before broadcast</span>
              <h2 style={{ margin: "4px 0 0" }}>Preview Your Marketplace Listing</h2>
            </div>
            <button type="button" onClick={() => setStep(1)} className="btn btn-secondary btn-sm">
              <IconArrowLeft size={16} /> Edit Details
            </button>
          </div>

          <p className="meta">
            Review how independent technicians in Lahore will see your request. Private address details are hidden from public view.
          </p>

          {/* Mockup of the public job card */}
          <div className="plate plate-raised" style={{ padding: 20 }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <span className="pill pill-violet">
                {categoryId === "2" ? <IconZap size={14} /> : <IconWrench size={14} />}
                <span>{selectedCategoryName}</span>
              </span>
              <span className="pill">
                <IconMapPin size={13} /> {selectedAreaName}, Lahore
              </span>
              {timingType === "asap" ? (
                <span className="pill pill-warn">⚡ Urgent / ASAP</span>
              ) : (
                <span className="pill">📅 {preferredDate ? new Date(preferredDate).toLocaleString("en-PK") : "Scheduled"}</span>
              )}
            </div>

            <h3 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: 8 }}>{title}</h3>
            <p style={{ whiteSpace: "pre-wrap", color: "var(--text-2)", fontSize: "0.95rem" }}>{description}</p>

            <div className="divider" />

            <div className="row-between">
              <div>
                <span className="hint">Customer Labour Budget:</span>
                <div className="price" style={{ fontSize: "1.1rem" }}>
                  {budgetMin && budgetMax ? `${pkr(Number(budgetMin))} – ${pkr(Number(budgetMax))}` : budgetMin ? `from ${pkr(Number(budgetMin))}` : "Open for bids"}
                </div>
              </div>
              <span className="pill pill-status">Status: Open for bids</span>
            </div>
          </div>

          {/* Private details summary */}
          <div
            style={{
              padding: 16,
              borderRadius: "var(--r-md)",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            <div className="row" style={{ color: "var(--ok)", marginBottom: 4 }}>
              <IconLock size={16} />
              <strong>What remains strictly private until you hire:</strong>
            </div>
            <ul style={{ paddingLeft: 22, margin: 0, fontSize: "0.88rem", color: "var(--text-2)" }}>
              <li><strong>Exact Street Address:</strong> {addressText}</li>
              {contactNote && <li><strong>Access Note:</strong> {contactNote}</li>}
              <li><strong>Your Phone Number:</strong> {user?.phone || "Your registered mobile number"}</li>
            </ul>
          </div>

          {/* Mandatory Direct Settlement Terms */}
          <div
            style={{
              padding: 18,
              borderRadius: "var(--r-md)",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
            }}
            className="stack-sm"
          >
            <div className="row" style={{ color: "var(--warn)" }}>
              <IconShieldCheck size={20} />
              <strong style={{ fontSize: "1rem" }}>Direct Settlement Agreement (لازمی شرط)</strong>
            </div>
            <p style={{ fontSize: "0.88rem", color: "#fef3c7", margin: 0, lineHeight: 1.5 }}>
              Maddad is an open classifieds and bidding board for independent local workers in Lahore. Maddad does not employ technicians, dispatch workers, guarantee workmanship, or hold escrow funds.
            </p>
            <label className="check" style={{ marginTop: 8, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={ackDirectPay}
                onChange={(e) => {
                  setAckDirectPay(e.target.checked);
                  if (e.target.checked) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.ack;
                      return next;
                    });
                  }
                }}
                style={{ marginTop: 3 }}
              />
              <span style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 650 }}>
                I understand and agree that payment is arranged directly between me and the hired worker in Pakistani Rupees (Cash, JazzCash, or EasyPaisa). I am responsible for verifying work before settling payment.
              </span>
            </label>
            {errors.ack && (
              <p className="field-error" style={{ margin: "4px 0 0" }}>
                <IconAlertCircle size={14} /> {errors.ack}
              </p>
            )}
          </div>

          {serverError && (
            <p className="msg msg-error" role="alert">
              <IconAlertCircle size={16} /> {serverError}
            </p>
          )}

          <div className="row-between" style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
              ← Back to Edit
            </button>
            <button
              type="button"
              onClick={handlePublishJob}
              disabled={submitting}
              className="btn btn-primary btn-lg"
            >
              {submitting ? (
                <>
                  <IconRefreshCw size={18} className="spin" />
                  <span>Broadcasting Job…</span>
                </>
              ) : (
                <>
                  <IconCheck size={18} />
                  <span>Publish Job to Lahore Technicians</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Clear Success State */}
      {step === 3 && (
        <div className="plate plate-bolted success-panel stack" role="status">
          <div
            className="module module-lg"
            style={{
              width: 72,
              height: 72,
              color: "var(--ok)",
              background: "linear-gradient(150deg, #1e3a2f 0%, #10241d 100%)",
            }}
          >
            <IconCheck size={36} />
          </div>

          <h2 style={{ fontSize: "1.6rem", margin: "8px 0 4px", color: "#fff" }}>
            Your Job is Live in Lahore!
          </h2>

          <p style={{ maxWidth: 520, margin: "0 auto", fontSize: "0.95rem", color: "var(--text-2)" }}>
            Eligible independent technicians in <strong>{selectedAreaName}</strong> offering <strong>{selectedCategoryName}</strong> services are receiving notification of your job.
          </p>

          <div
            className="plate plate-raised"
            style={{
              padding: "16px 20px",
              maxWidth: 500,
              width: "100%",
              margin: "12px auto",
              textAlign: "left",
            }}
          >
            <div className="row-between">
              <span className="pill pill-violet">{selectedCategoryName}</span>
              <span className="pill">{selectedAreaName}</span>
            </div>
            <h4 style={{ margin: "8px 0 4px", color: "#fff" }}>{title}</h4>
            <p className="hint" style={{ margin: 0 }}>
              Job ID: <code style={{ color: "var(--violet-300)" }}>{createdJobId}</code>
            </p>
          </div>

          <div className="checklist" style={{ maxWidth: 520, width: "100%", margin: "8px auto", textAlign: "left" }}>
            <li data-done="true">
              <span className="check-dot">✓</span>
              <span>Technicians review requirements and submit whole PKR quotes.</span>
            </li>
            <li data-done="true">
              <span className="check-dot">✓</span>
              <span>You will receive an in-app notification when a new bid arrives.</span>
            </li>
            <li data-done="true">
              <span className="check-dot">✓</span>
              <span>Compare bids, ratings, and arrival times on your customer dashboard.</span>
            </li>
          </div>

          <div className="row" style={{ justifyContent: "center", gap: 14, marginTop: 16 }}>
            {createdJobId && (
              <Link href={`/jobs/${createdJobId}`} className="btn btn-primary btn-lg">
                <IconEye size={18} />
                <span>View Job Details &amp; Bids</span>
              </Link>
            )}
            <button type="button" onClick={onViewMarketplace} className="btn btn-secondary btn-lg">
              Explore Marketplace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
