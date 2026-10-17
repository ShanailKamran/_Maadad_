import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { categoriesAndAreas } from "@/lib/jobs";
import { photoUploadEnabled } from "@/lib/config";
import { ActionForm, Submit } from "@/components/ActionForm";
import { ImagePicker } from "@/components/ImagePicker";
import { GeoHelper } from "@/components/GeoHelper";
import { createJobAction } from "../../actions";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJob() {
  const user = await requireUser();
  if (!user.display_name) return <p className="notice">Please <Link href="/account?setup=1">add your name</Link> first.</p>;
  if (user.account_status !== "active") return <p className="msg msg-error">Your account is restricted and can&apos;t post jobs. See <Link href="/account">Account</Link>.</p>;
  const { categories, areas } = await categoriesAndAreas();

  return (
    <div style={{ maxWidth: 680 }}>
      <h1>Post a job in Lahore</h1>
      <p className="lead">You&apos;ll preview it before it goes live. Workers see only your area, never your address or phone.</p>
      <ActionForm action={createJobAction} encType="multipart/form-data" className="card">
        <div className="field">
          <label htmlFor="categoryId">Type of work</label>
          <select id="categoryId" name="categoryId" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="title">Short title</label>
          <input id="title" name="title" type="text" required minLength={5} maxLength={120} placeholder="e.g. Kitchen tap leaking" />
        </div>
        <div className="field">
          <label htmlFor="description">What needs doing?</label>
          <textarea id="description" name="description" required minLength={20} maxLength={2000} />
          <p className="hint">Everyone who can bid sees this. Please don&apos;t put phone numbers or your house number here.</p>
        </div>

        <fieldset>
          <legend>When?</legend>
          <label className="check"><input type="checkbox" name="asap" /> As soon as possible</label>
          <div className="field"><label htmlFor="preferredAt">Or preferred date &amp; time (Pakistan time)</label><input id="preferredAt" name="preferredAt" type="datetime-local" /></div>
        </fieldset>

        <fieldset>
          <legend>Where?</legend>
          <div className="field">
            <label htmlFor="areaId">Area / neighbourhood</label>
            <select id="areaId" name="areaId" required defaultValue="">
              <option value="" disabled>Choose your area…</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <p className="hint">City: Lahore. This is the only location workers will see.</p>
          </div>
          <div className="field">
            <label htmlFor="addressText">Exact address / landmark (private)</label>
            <input id="addressText" name="addressText" type="text" required minLength={5} maxLength={300} autoComplete="street-address" />
            <p className="hint">Only the worker you choose will see this.</p>
          </div>
          <div className="field">
            <label htmlFor="contactNote">Access note (private, optional)</label>
            <input id="contactNote" name="contactNote" type="text" maxLength={300} placeholder="e.g. ring bell twice, 2nd floor" />
          </div>
          <input type="hidden" id="lat" name="lat" /><input type="hidden" id="lng" name="lng" />
          <GeoHelper areas={areas} mode="pin" />
        </fieldset>

        <fieldset>
          <legend>Budget (optional)</legend>
          <div className="grid grid-2">
            <div className="field"><label htmlFor="budgetMin">From (Rs)</label><input id="budgetMin" name="budgetMin" type="number" inputMode="numeric" min={100} step={50} /></div>
            <div className="field"><label htmlFor="budgetMax">To (Rs)</label><input id="budgetMax" name="budgetMax" type="number" inputMode="numeric" min={100} step={50} /></div>
          </div>
          <p className="hint">Leave blank if unsure. Workers bid their own labour price.</p>
        </fieldset>

        {photoUploadEnabled() ? <ImagePicker name="photos" max={3} label="Photos (optional)" /> : <p className="hint">Photo upload is not enabled on this deployment.</p>}

        <p className="notice">
          <strong>You choose and you pay directly.</strong> Payment is arranged directly with the worker you select.
          We don&apos;t hold or guarantee payment or work quality. You are responsible for accurate job details and for choosing a bid.
        </p>
        <label className="check"><input type="checkbox" name="ack" required /> I understand that payment is arranged directly with the selected worker, and that I&apos;m responsible for my job details and my choice.</label>
        <Submit>Preview job</Submit>
      </ActionForm>
    </div>
  );
}
