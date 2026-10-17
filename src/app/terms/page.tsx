import type { Metadata } from "next";
import { appName } from "@/lib/config";

export const metadata: Metadata = { title: "Terms (placeholder)" };

export default function Terms() {
  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 12px" }}>
      <article className="plate-bolted">
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 12px", color: "var(--text-1)" }}>Terms of Use (Pilot)</h1>
        <p className="notice" style={{ marginBottom: 20 }}><strong>Placeholder.</strong> These terms must be reviewed and completed by a qualified lawyer before the pilot opens to the public.</p>
        <ol style={{ color: "var(--text-2)", lineHeight: 1.7, paddingLeft: 20 }}>
          <li><strong>What {appName} is.</strong> A classifieds and bidding board where customers post jobs and independent workers choose whether to bid. {appName} is not a party to any agreement between users.</li>
          <li><strong>Independent workers.</strong> Workers are not employees, agents or contractors of {appName}. We do not assign, dispatch, supervise or direct work, and do not set or negotiate prices.</li>
          <li><strong>Customers choose.</strong> Customers decide whether and whom to hire, and are responsible for the accuracy of their job posts and for their choice.</li>
          <li><strong>Payment.</strong> Users arrange payment directly. {appName} does not hold funds, offer escrow, process payments, take commission, or provide refunds.</li>
          <li><strong>No guarantees.</strong> We do not guarantee workmanship, safety, worker identity, background or availability, nor that anyone will pay or be paid.</li>
          <li><strong>Conduct.</strong> No fraud, harassment, spam, misleading prices or unsafe behaviour. Moderators may warn, suspend or ban accounts and remove content after review. You can appeal from your Account page.</li>
          <li><strong>Reviews.</strong> Must be honest and relate to a completed booking.</li>
          <li><strong>Operator Terms.</strong> Liability, governing law (Lahore, Punjab), dispute process, and age requirements.</li>
        </ol>
        <p className="meta" style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--graphite-800)" }}>
          {appName} · Lahore, Pakistan
        </p>
      </article>
    </div>
  );
}
