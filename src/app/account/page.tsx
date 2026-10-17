import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { q, isPostgresAvailable } from "@/lib/db";
import { maskPhone } from "@/lib/phone";
import { dt } from "@/lib/format";
import { supportEmail } from "@/lib/config";
import { ActionForm, Submit } from "@/components/ActionForm";
import { saveNameAction, prefsAction, appealAction, deleteAccountAction } from "../actions";

export const metadata: Metadata = { title: "Account" };

export default async function Account({ searchParams }: { searchParams: { setup?: string } }) {
  const user = await requireUser();
  const prefs = !(await isPostgresAvailable())
    ? { in_app: true }
    : (await q<{ notification_prefs: { in_app: boolean } }>("SELECT notification_prefs FROM users WHERE id=$1", [user.id]))[0]?.notification_prefs;
  const restricted = user.account_status !== "active";

  return (
    <div style={{ maxWidth: 640 }}>
      <h1>{searchParams.setup ? "Welcome! One quick step" : "Your account"}</h1>
      <p className="meta">Signed in as {maskPhone(user.phone)}</p>

      {restricted && (
        <section className="card" aria-labelledby="restricted">
          <h2 id="restricted" style={{ marginTop: 0 }}>Your account is {user.account_status}</h2>
          <p>{user.status_reason ? `Reason given: ${user.status_reason}` : "A moderator restricted this account."}</p>
          {user.suspended_until && <p>Suspension ends: {dt(user.suspended_until)}</p>}
          <p>You can&apos;t post jobs, bid or contact others while restricted. If you think this is a mistake, appeal below{supportEmail ? <> or email {supportEmail}</> : null}.</p>
          <ActionForm action={appealAction}>
            <div className="field"><label htmlFor="message">Your appeal</label><textarea id="message" name="message" required minLength={10} maxLength={1500} /></div>
            <Submit>Send appeal</Submit>
          </ActionForm>
        </section>
      )}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Your name</h2>
        <ActionForm action={saveNameAction}>
          {searchParams.setup && <input type="hidden" name="setup" value="1" />}
          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input id="displayName" name="displayName" type="text" defaultValue={user.display_name ?? ""} required minLength={2} maxLength={60} autoComplete="name" />
            <p className="hint">Shown on your jobs, bids and reviews. Don&apos;t include your phone number.</p>
          </div>
          <Submit>Save</Submit>
        </ActionForm>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Notifications</h2>
        <ActionForm action={prefsAction}>
          <label className="check"><input type="checkbox" name="in_app" defaultChecked={prefs?.in_app ?? true} /> In-app notifications</label>
          <p className="hint">Push and SMS notifications are not available yet.</p>
          <Submit>Save</Submit>
        </ActionForm>
      </section>

      <section className="card" aria-labelledby="delete">
        <h2 id="delete" style={{ marginTop: 0 }}>Delete my account</h2>
        <p>This removes your phone number, name, photos, identity documents and exact addresses. Reviews and booking records may remain without personal identifiers. It can&apos;t be undone, and is blocked while you have an active booking.</p>
        <ActionForm action={deleteAccountAction} confirm="Delete your account permanently?">
          <div className="field"><label htmlFor="confirm">Type DELETE to confirm</label><input id="confirm" name="confirm" type="text" autoComplete="off" /></div>
          <Submit className="btn btn-danger">Delete my account</Submit>
        </ActionForm>
      </section>
    </div>
  );
}
