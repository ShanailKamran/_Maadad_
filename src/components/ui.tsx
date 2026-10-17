import { appName } from "@/lib/config";

export const PAYMENT_NOTICE =
  "Payment is arranged directly between the customer and the worker, outside this site. " +
  `${appName} does not hold, process, guarantee or refund any money.`;

/** Shown wherever users choose to hire or arrange work. */
export function PaymentNotice() {
  return (
    <p className="notice" role="note">
      <strong>Payment is between you and the worker.</strong> {PAYMENT_NOTICE} We record job status and reviews
      only. We don&apos;t guarantee workmanship, safety, background or payment. See{" "}
      <a href="/payments">how this works</a>.
    </p>
  );
}

export function DemoPill() {
  return <span className="pill pill-demo">DEMO – fictional</span>;
}

export function Stars({ avg, count }: { avg: number | null | undefined; count: number }) {
  if (!count || avg == null) return <span className="meta">No reviews yet</span>;
  return (
    <span>
      <span className="stars" aria-label={`${avg} out of 5 stars`}>★ {avg.toFixed(1)}</span>{" "}
      <span className="meta">({count} review{count === 1 ? "" : "s"})</span>
    </span>
  );
}

export function IdentityBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    verified: ["ID reviewed by our team", "pill"],
    pending_review: ["ID review pending (not verified)", "pill pill-warn"],
    rejected: ["ID not accepted", "pill pill-bad"],
    needs_resubmission: ["ID resubmission needed", "pill pill-warn"],
    not_submitted: ["ID not submitted", "pill pill-warn"],
  };
  const [label, cls] = map[status] ?? map.not_submitted;
  return <span className={cls} title="An ID review is not a guarantee of skill, safety, background or service quality.">{label}</span>;
}
