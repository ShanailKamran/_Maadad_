import type { Metadata } from "next";
import { appName, supportEmail, storage } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy notice" };

export default function Privacy() {
  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: "0 12px" }}>
      <article className="plate-bolted">
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 12px", color: "var(--text-1)" }}>Privacy Notice</h1>
        <p className="notice" style={{ marginBottom: 20 }}>
          This privacy notice outlines how {appName} handles user information during our Lahore pilot. We operate under strict data minimization and zero financial fund holding.
        </p>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "16px 0 8px", color: "var(--text-1)" }}>What we collect, and why</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead><tr><th>Data</th><th>Why</th><th>Who can see it</th></tr></thead>
            <tbody>
              <tr><td>Mobile number</td><td>Sign-in (OTP) and direct communication between the two parties of an awarded booking</td><td>You; your counterpart only after a bid is accepted; never other bidders or the public</td></tr>
              <tr><td>Display name</td><td>Shown on bids, jobs and reviews</td><td>Signed-in users involved with you</td></tr>
              <tr><td>Job description & photos</td><td>So technicians can evaluate the repair and submit bids</td><td>Eligible technicians (showing approximate area only) and you</td></tr>
              <tr><td>Exact address & house number</td><td>So the chosen technician can reach your home</td><td>Unlocked strictly for you and the single accepted technician upon bid acceptance. Never shown to quoting bidders or unverified visitors</td></tr>
              <tr><td>Technician profile, areas, work photos</td><td>So customers can compare experience and reviews</td><td>Customers evaluating incoming bids</td></tr>
              <tr><td>Identity documents (optional, technicians)</td><td>Optional manual visual review to award an &quot;ID reviewed&quot; badge</td><td>Human moderators only for visual review; access is strictly audited. We do NOT verify against NADRA and we do NOT store full CNIC numbers</td></tr>
              <tr><td>Reviews, reports, moderation records</td><td>Trust, safety, and community dispute handling</td><td>Double-blind reviews: both sides once revealed (or 7 days). Reports and internal notes: moderators only</td></tr>
              <tr><td>Security audit logs</td><td>Prevent abuse and brute-force attempts; contains no plain passwords or OTPs</td><td>Platform operators</td></tr>
            </tbody>
          </table>
        </div>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "20px 0 8px", color: "var(--text-1)" }}>Location Privacy</h2>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>We never track your ongoing location. Device location is optional, read once when you tap the button, and used solely to suggest a Lahore neighbourhood. You can always select your area manually from the list.</p>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "20px 0 8px", color: "var(--text-1)" }}>Retention and Deletion</h2>
        <ul style={{ color: "var(--text-2)", lineHeight: 1.6, paddingLeft: 20 }}>
          <li>Submitted identity photos are automatically purged {storage.identityRetentionDays} days after a moderator decision, and immediately if you delete your account.</li>
          <li>You can delete your account from the Account page. This permanently anonymises your phone number, name, uploaded photos, and private records. Deletion is restricted only while an awarded booking is in progress.</li>
          <li>OTP codes expire in 5 minutes and are stored exclusively as cryptographically salted HMAC hashes.</li>
        </ul>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "20px 0 8px", color: "var(--text-1)" }}>Support &amp; Inquiries</h2>
        <p style={{ color: "var(--text-2)", lineHeight: 1.6 }}>
          {supportEmail ? (
            <>For privacy questions, data deletion requests, or appeals against account restrictions, contact: <a href={`mailto:${supportEmail}`} style={{ color: "var(--violet-400)", fontWeight: 700 }}>{supportEmail}</a>. </>
          ) : (
            <>During the pilot, privacy inquiries, data deletion requests, and appeals are handled directly in-app through the appeal form on the Account page or via the moderation reporting system. </>
          )}
          Restricted users can also file an appeal directly from their Account dashboard.
        </p>
        <p className="meta" style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid var(--graphite-800)" }}>{appName} Pilot · Lahore, Pakistan</p>
      </article>
    </div>
  );
}
