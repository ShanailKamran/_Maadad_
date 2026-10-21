import type { Metadata } from "next";
import { appName } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of Use · Pilot" };

export default function Terms() {
  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 12px" }}>
      <article className="plate-bolted">
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 12px", color: "var(--text-1)" }}>Terms of Use (Lahore Pilot)</h1>
        <p className="notice" style={{ marginBottom: 20 }}>
          Welcome to {appName}. By using this platform to post repair requests or submit bids in Lahore, you agree to the following terms governing our open-bid bulletin board.
        </p>
        <ol style={{ color: "var(--text-2)", lineHeight: 1.7, paddingLeft: 20 }}>
          <li><strong>Bulletin Board Model:</strong> {appName} is a technology classifieds and open-bid bidding board connecting independent technicians with local customers in Lahore. {appName} is not a party to any contract or transaction agreed between users.</li>
          <li><strong>Technician Independence:</strong> Technicians are independent tradespeople, not employees, contractors, or agents of {appName}. {appName} does not assign, dispatch, supervise, or direct repair work, and does not determine prices.</li>
          <li><strong>Customer Discretion:</strong> Customers evaluate incoming bids independently and decide whom to hire. Customers are responsible for verifying the scope, safety, and price with the technician before work commences.</li>
          <li><strong>Direct Payment & Zero Funds:</strong> Payment is settled directly between customer and technician (cash, Raast, mobile wallet, or bank transfer). {appName} holds zero user funds, operates no escrow or wallets, charges no commission in this pilot, and issues no refunds.</li>
          <li><strong>Workmanship & Safety Disclaimer:</strong> {appName} does not guarantee workmanship quality, safety, or timeliness. An &quot;ID Reviewed&quot; badge indicates only that our moderators conducted a visual inspection of submitted identity documents; it does NOT constitute a police, criminal background, or skill certification.</li>
          <li><strong>Community Conduct & Prohibited Acts:</strong> Harassment, price gouging after job acceptance, no-shows without notice, fraudulent reviews, and unsafe conduct are strictly prohibited. Moderators reserve the right to warn, temporarily suspend (1–90 days), or permanently terminate accounts following documented reports.</li>
          <li><strong>Two-Way Dispute Reporting:</strong> Both customers and technicians can file reports regarding booking problems, no-shows, or scope disputes. Resolving a report updates community records; {appName} does not adjudicate monetary settlements.</li>
          <li><strong>Governing Jurisdiction:</strong> These terms are governed by the applicable laws of Lahore, Punjab, Pakistan.</li>
        </ol>
        <p className="meta" style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid var(--graphite-800)" }}>
          {appName} · Lahore, Pakistan
        </p>
      </article>
    </div>
  );
}
