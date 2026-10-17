import type { Metadata } from "next";
import Link from "next/link";
import { appName, reviewRevealDays } from "@/lib/config";
import {
  IconBanknote,
  IconShieldCheck,
  IconLock,
  IconStar,
  IconAlertCircle,
  IconCheck,
  IconArrowRight,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Payments & Trust · Maddad Lahore",
  description: "Learn how direct payment, completion codes, privacy, and technician independence work in Maddad Lahore.",
};

export default function Payments() {
  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 12px" }}>
      <div className="plate-bolted stack-md">
        {/* Header */}
        <div style={{ borderBottom: "1px solid var(--graphite-800)", paddingBottom: 16 }}>
          <span className="hero-eyebrow">Operating Definition</span>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "6px 0 8px", color: "var(--text-1)" }}>
            Payments, Trust &amp; Operating Rules
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.95rem", margin: 0, lineHeight: 1.5 }}>
            Maddad is an open bulletin board connecting customers and independent plumbing &amp; electrical technicians in Lahore.
          </p>
        </div>

        {/* Payment Policy Alert */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(124, 58, 237, 0.1) 0%, rgba(13, 17, 23, 0.95) 100%)",
            border: "1px solid var(--violet-700)",
            borderLeft: "4px solid var(--violet-400)",
            borderRadius: "var(--radius-sm)",
            padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--violet-200)", fontWeight: 700, fontSize: "1rem" }}>
            <IconBanknote size={20} />
            <span>Direct Settlement — No Escrow, No Holding Funds</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.6 }}>
            {appName} <strong>does not hold, process, guarantee or refund money</strong>. There is no escrow, digital wallet balance, or platform commission. Customer and technician agree on how and when to pay (Cash on site, JazzCash, EasyPaisa, or bank transfer) directly.
          </p>
        </div>

        {/* Grid of Key Operating Principles */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          {/* Card 1: 4-digit code */}
          <div className="plate" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-1)", fontWeight: 700, marginBottom: 6 }}>
              <IconCheck size={18} color="var(--violet-400)" />
              <span>4-Digit Completion Code</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
              The customer sees a 4-digit code on their booking. Sharing this code with the technician records that the customer acknowledged the work was completed. <strong>It is a status acknowledgment record, not payment escrow.</strong>
            </p>
          </div>

          {/* Card 2: Workers Independent */}
          <div className="plate" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-1)", fontWeight: 700, marginBottom: 6 }}>
              <IconShieldCheck size={18} color="var(--violet-400)" />
              <span>Technicians are Independent</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
              Maddad does not employ, dispatch, or supervise technicians. Customers freely evaluate submitted bids and choose who to hire based on price, arrival time, and reputation.
            </p>
          </div>

          {/* Card 3: Privacy by Default */}
          <div className="plate" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-1)", fontWeight: 700, marginBottom: 6 }}>
              <IconLock size={18} color="var(--violet-400)" />
              <span>Strict Privacy by Default</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
              During the open bidding phase, technicians only see your general Lahore neighbourhood (e.g. Gulberg, DHA). Your exact street address and phone number are revealed only to the single technician you choose to hire.
            </p>
          </div>

          {/* Card 4: ID Review Notice */}
          <div className="plate" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-1)", fontWeight: 700, marginBottom: 6 }}>
              <IconAlertCircle size={18} color="var(--amber-400)" />
              <span>NADRA Disclaimer</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
              Technicians may upload identity documents for internal manual review. An &ldquo;ID reviewed&rdquo; badge is <strong>not</strong> a NADRA or police record check and does not guarantee skill or workmanship.
            </p>
          </div>
        </div>

        {/* Double-Blind Reviews */}
        <div className="plate" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-1)", fontWeight: 700, marginBottom: 6 }}>
            <IconStar size={18} color="var(--amber-400)" />
            <span>Double-Blind Review System</span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
            To prevent retaliatory ratings, reviews for completed bookings become visible only after both sides have submitted their review, or after {reviewRevealDays} days have passed. Ratings always display the exact count of reviews and completed jobs.
          </p>
        </div>

        {/* CTA Strip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, flexWrap: "wrap", gap: 10 }}>
          <Link href="/" className="btn btn-secondary">
            <span>← Back to Marketplace</span>
          </Link>
          <Link href="/?view=post" className="btn btn-primary">
            <span>Post a Job in Lahore</span>
            <IconArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
