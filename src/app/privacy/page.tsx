import type { Metadata } from "next";
import { appName, supportEmail, storage } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy notice" };

export default function Privacy() {
  const contact = supportEmail || "[OPERATOR: set SUPPORT_EMAIL]";
  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 12px" }}>
      <article className="plate-bolted">
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 12px", color: "var(--text-1)" }}>Privacy Notice</h1>
        <p className="notice" style={{ marginBottom: 20 }}>Template for the pilot operator to review with a lawyer before launch. It describes how this software behaves.</p>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "16px 0 8px", color: "var(--text-1)" }}>What we collect, and why</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Data</th><th>Why</th><th>Who can see it</th></tr></thead>
            <tbody>
              <tr><td>Mobile number</td><td>Sign-in (OTP) and contact between the two parties of a booking</td><td>You; the other party only after a bid is accepted; never other bidders or the public</td></tr>
              <tr><td>Display name</td><td>Shown on bids, jobs and reviews</td><td>Signed-in users involved with you</td></tr>
              <tr><td>Job details and photos</td><td>So workers can bid</td><td>Eligible workers (approximate area only) and you</td></tr>
              <tr><td>Exact address and map pin</td><td>So the chosen worker can reach you</td><td>You and the single selected worker, while the booking is active. Not admins by default, never other bidders</td></tr>
              <tr><td>Worker profile, areas, work photos</td><td>So customers can compare workers</td><td>Customers whose jobs you bid on</td></tr>
              <tr><td>Identity photos (optional, workers)</td><td>Manual review to show an &quot;ID reviewed&quot; label</td><td>Moderators, only for review; every access is logged. Never public. We do not check them with NADRA and we do not store your CNIC number</td></tr>
              <tr><td>Reviews, reports, moderation records</td><td>Trust and safety</td><td>Reviews: other users once revealed. Reports and moderation notes: moderators</td></tr>
              <tr><td>Security logs</td><td>Prevent abuse and investigate problems; contain no OTPs, exact locations or identity data</td><td>Operators</td></tr>
            </tbody>
          </table>
        </div>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "20px 0 8px", color: "var(--text-1)" }}>Location</h2>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>We never track your location. Device location is optional, read once when you tap the button, and used only to suggest an area. You can always choose your area manually.</p>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "20px 0 8px", color: "var(--text-1)" }}>Retention and deletion</h2>
        <ul style={{ color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 20 }}>
          <li>Identity photos are deleted automatically {storage.identityRetentionDays} days after a moderator decision (configurable), and immediately if you delete your account.</li>
          <li>You can delete your account from the Account page. This removes your phone number, name, photos, identity documents and exact addresses. Bookings and reviews may be kept without personal identifiers, and operators may keep records they are legally required to keep. Deletion is blocked while a booking is active.</li>
          <li>OTP codes expire in 5 minutes and are stored only as hashes.</li>
        </ul>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "20px 0 8px", color: "var(--text-1)" }}>Contact</h2>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>Questions, access or deletion requests, or appeals against account restrictions: <strong>{contact}</strong>. Restricted users can also use the appeal form on the Account page.</p>
        <p className="meta" style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid var(--graphite-800)" }}>{appName} pilot · Lahore, Pakistan</p>
      </article>
    </div>
  );
}
