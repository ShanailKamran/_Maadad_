"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconAlertCircle, IconCheck, IconInbox, IconX } from "../icons";

/* ---------------------------------------------------------------- */
/* Formatting — PKR amounts and Lahore (Asia/Karachi) local times     */
/* ---------------------------------------------------------------- */
const TZ = "Asia/Karachi";

export const pkr = (n: number | null | undefined) =>
  n == null ? "—" : "Rs " + new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(n);

export function budgetLabel(min: number | null, max: number | null): string {
  if (min && max && min !== max) return `${pkr(min)} – ${pkr(max)}`;
  if (min && max) return pkr(min);
  if (min) return `from ${pkr(min)}`;
  if (max) return `up to ${pkr(max)}`;
  return "Not stated";
}

const dtf = new Intl.DateTimeFormat("en-PK", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dfOnly = new Intl.DateTimeFormat("en-PK", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

export const fmtDateTime = (d: string | Date | null | undefined) => (d ? dtf.format(new Date(d)) : "—");
export const fmtDate = (d: string | Date | null | undefined) => (d ? dfOnly.format(new Date(d)) : "—");

export function whenLabel(job: { asap: boolean; preferred_at: string | Date | null }): string {
  if (job.asap) return "As soon as possible";
  return job.preferred_at ? `Preferred ${fmtDateTime(job.preferred_at)}` : "Flexible timing";
}

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/* ---------------------------------------------------------------- */
/* Status labels                                                      */
/* ---------------------------------------------------------------- */
type Tone = "violet" | "ok" | "warn" | "bad" | "info" | "";
const JOB_STATUS: Record<string, [string, Tone]> = {
  draft: ["Draft – not published", "warn"],
  open: ["Open for bids", "violet"],
  awarded: ["Technician chosen", "info"],
  in_progress: ["In progress", "info"],
  completion_requested: ["Awaiting your confirmation", "warn"],
  completed: ["Completed", "ok"],
  disputed: ["Problem reported", "bad"],
  cancelled: ["Cancelled", ""],
  expired: ["Expired", ""],
};
const BID_STATUS: Record<string, [string, Tone]> = {
  active: ["Bid sent", "violet"],
  accepted: ["Accepted", "ok"],
  rejected: ["Not chosen", ""],
  withdrawn: ["Withdrawn", ""],
};

export function StatusBadge({ status, kind = "job" }: { status: string; kind?: "job" | "bid" }) {
  const map = kind === "bid" ? BID_STATUS : JOB_STATUS;
  const [label, tone] = map[status] ?? [status.replace(/_/g, " "), ""];
  return <span className={`pill ${tone ? `pill-${tone}` : ""}`}>{label}</span>;
}

export function DemoBadge({ label = "Demo – fictional" }: { label?: string }) {
  return <span className="pill pill-demo">{label}</span>;
}

/* ---------------------------------------------------------------- */
/* Empty / loading                                                    */
/* ---------------------------------------------------------------- */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="module module-lg" aria-hidden="true">
        {icon ?? <IconInbox size={22} />}
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function JobListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="job-list" aria-busy="true" aria-label="Loading jobs">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="plate" style={{ padding: 16, display: "grid", gap: 10 }}>
          <div className="skeleton" style={{ height: 18, width: "60%" }} />
          <div className="skeleton" style={{ height: 14 }} />
          <div className="skeleton" style={{ height: 14, width: "40%" }} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Toasts (polite live region)                                        */
/* ---------------------------------------------------------------- */
type ToastItem = { id: number; text: string; kind: "ok" | "error" };

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);
  return { toasts, push };
}

export function ToastRegion({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind}>
          {t.kind === "error" ? (
            <IconAlertCircle size={18} color="var(--bad)" aria-hidden="true" />
          ) : (
            <IconCheck size={18} color="var(--ok)" aria-hidden="true" />
          )}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Dialog — native <dialog> gives focus trap, Esc and inert backdrop   */
/* ---------------------------------------------------------------- */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!open && d.open) d.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on backdrop
      }}
    >
      {open && (
        <>
          <div className="dialog-head">
            <div className="stack-sm" style={{ minWidth: 0 }}>
              {eyebrow}
              <h2 id={titleId} style={{ margin: 0, fontSize: "1.25rem" }}>
                {title}
              </h2>
            </div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
              <IconX size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="dialog-body">{children}</div>
        </>
      )}
    </dialog>
  );
}

/* ---------------------------------------------------------------- */
/* Form field with label, hint and inline error                       */
/* ---------------------------------------------------------------- */
export function Field({
  id: fixedId,
  label,
  hint,
  error,
  optional,
  children,
  counter,
}: {
  id?: string;
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  counter?: string;
  children: (p: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const autoId = useId();
  const id = fixedId ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {optional && <span className="optional">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": [errId, hintId].filter(Boolean).join(" ") || undefined })}
      {counter && <span className="field-counter">{counter}</span>}
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={errId} role="alert">
          <IconAlertCircle size={14} aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/* Digit run of 7+ looks like a phone number — mirrors server validation. */
export const looksLikePhone = (s: string) => /(\+?\d[\s\-().]?){7,}/.test(s);

/* ---------------------------------------------------------------- */
/* Segmented control (view switch inside a page)                      */
/* ---------------------------------------------------------------- */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; count?: number }[];
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className="tab-btn"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          data-active={value === o.id}
        >
          {o.label}
          {o.count != null && <span className="tab-badge">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
