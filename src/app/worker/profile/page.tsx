import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { categoriesAndAreas } from "@/lib/jobs";
import { q, one, isPostgresAvailable } from "@/lib/db";
import { store } from "@/lib/store";
import { identityUploadEnabled, photoUploadEnabled, MAX_WORKER_PHOTOS } from "@/lib/config";
import { ActionForm, Submit } from "@/components/ActionForm";
import { GeoHelper } from "@/components/GeoHelper";
import { IdentityBadge } from "@/components/ui";
import {
  saveWorkerAction,
  workerPhotoAction,
  removeWorkerPhotoAction,
  identityAction,
} from "../../actions";

export const metadata: Metadata = { title: "Worker profile" };

export default async function WorkerProfilePage() {
  const user = await requireUser();

  const { categories, areas } = await categoriesAndAreas();

  let profile: { bio: string; experience_years: number; accepting_bids: boolean; identity_status: string } | null = null;
  let selectedCategoryIds = new Set<number>();
  let selectedAreaIds = new Set<number>();
  let photos: { id: string }[] = [];

  if (!(await isPostgresAvailable())) {
    const wp = store.getWorkerProfile(user.id);
    if (wp) {
      profile = {
        bio: wp.bio,
        experience_years: wp.experience_years ?? 0,
        accepting_bids: wp.accepting_bids,
        identity_status: wp.identity_status,
      };
      selectedCategoryIds = new Set(wp.categories);
      selectedAreaIds = new Set(wp.areas);
    }
  } else {
    profile = await one<{
      bio: string;
      experience_years: number;
      accepting_bids: boolean;
      identity_status: string;
    }>(
      `SELECT bio, experience_years, accepting_bids, identity_status::text
       FROM worker_profiles WHERE user_id = $1`,
      [user.id],
    );

    selectedCategoryIds = new Set(
      (
        await q<{ category_id: number }>(
          `SELECT category_id FROM worker_categories WHERE user_id = $1`,
          [user.id],
        )
      ).map((r) => r.category_id),
    );

    selectedAreaIds = new Set(
      (
        await q<{ area_id: number }>(
          `SELECT area_id FROM worker_areas WHERE user_id = $1`,
          [user.id],
        )
      ).map((r) => r.area_id),
    );

    photos = await q<{ id: string }>(
      `SELECT id FROM worker_photos WHERE user_id = $1 ORDER BY created_at`,
      [user.id],
    );
  }

  const idStatus = profile?.identity_status || "not_submitted";

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Worker Profile</h1>
      <p className="lead">
        Set your services, coverage in Lahore, and availability to discover and bid on jobs.
      </p>

      {/* Main Profile Form */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Profile Details</h2>
        <ActionForm action={saveWorkerAction}>
          <div className="field">
            <label htmlFor="displayName">Your display name</label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              minLength={2}
              maxLength={60}
              defaultValue={user.display_name ?? ""}
              placeholder="e.g. Tariq Mehmood"
            />
            <p className="hint">This is shown to customers when you bid. Do not include phone numbers.</p>
          </div>

          <div className="field">
            <label htmlFor="bio">About your experience &amp; workmanship</label>
            <textarea
              id="bio"
              name="bio"
              required
              minLength={20}
              maxLength={800}
              defaultValue={profile?.bio ?? ""}
              placeholder="Describe your skills, previous work, types of appliances or systems you handle..."
            />
          </div>

          <div className="field">
            <label htmlFor="experienceYears">Years of experience</label>
            <input
              id="experienceYears"
              name="experienceYears"
              type="number"
              min={0}
              max={60}
              required
              defaultValue={profile?.experience_years ?? 0}
              style={{ maxWidth: 160 }}
            />
          </div>

          {/* Categories */}
          <fieldset>
            <legend>Services offered (Plumbing / Electrical)</legend>
            <div className="checks">
              {categories.map((c) => (
                <label key={c.id} className="check">
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={c.id}
                    defaultChecked={selectedCategoryIds.has(c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <p className="hint">Select at least one trade.</p>
          </fieldset>

          {/* Lahore Service Areas */}
          <fieldset>
            <legend>Lahore service areas</legend>
            <p className="hint" style={{ marginTop: 0 }}>
              Select neighbourhoods you are willing to travel to. Device location is optional.
            </p>
            <GeoHelper areas={areas} mode="areas" />
            <div className="checks" style={{ marginTop: 12 }}>
              {areas.map((a) => (
                <label key={a.id} className="check">
                  <input
                    id={`area-${a.id}`}
                    type="checkbox"
                    name="areaIds"
                    value={a.id}
                    defaultChecked={selectedAreaIds.has(a.id)}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Availability</legend>
            <label className="check">
              <input
                type="checkbox"
                name="acceptingBids"
                defaultChecked={profile?.accepting_bids ?? true}
              />
              Accepting bids (uncheck if you are busy or on leave)
            </label>
          </fieldset>

          <Submit>Save worker profile</Submit>
        </ActionForm>
      </section>

      {/* Work Photos */}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Work Photos (Up to {MAX_WORKER_PHOTOS})</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Photos of your past work or tools to reassure customers.
        </p>

        {photos.length > 0 && (
          <div className="photos" style={{ marginBlock: 12 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/files/worker-photo/${p.id}`} alt="Work sample" />
                <ActionForm action={removeWorkerPhotoAction} confirm="Remove this photo?">
                  <input type="hidden" name="id" value={p.id} />
                  <Submit className="btn btn-danger btn-sm" style={{ marginTop: 4, width: "100%" }}>
                    Remove
                  </Submit>
                </ActionForm>
              </div>
            ))}
          </div>
        )}

        {photoUploadEnabled() ? (
          photos.length < MAX_WORKER_PHOTOS ? (
            <ActionForm action={workerPhotoAction} encType="multipart/form-data">
              <div className="field">
                <label htmlFor="photo">Add photo</label>
                <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
              </div>
              <Submit className="btn btn-sm">Upload photo</Submit>
            </ActionForm>
          ) : (
            <p className="hint">Maximum of {MAX_WORKER_PHOTOS} photos reached.</p>
          )
        ) : (
          <p className="hint">Photo upload is not enabled on this deployment.</p>
        )}
      </section>

      {/* Identity Verification (Manual Review) */}
      <section className="card" aria-labelledby="id-verification-heading">
        <div className="row">
          <h2 id="id-verification-heading" style={{ margin: 0, marginInlineEnd: "auto" }}>
            Identity Verification
          </h2>
          <IdentityBadge status={idStatus} />
        </div>

        <div className="notice" style={{ marginBlock: 12 }}>
          <strong>Important notice:</strong> Identity review is a manual document check by our team.
          We do <strong>NOT</strong> connect to NADRA or perform automated identity checks.
          An &quot;ID reviewed&quot; label confirms only that manual inspection took place; it does
          <strong>not</strong> prove skill, safety, criminal background, or service quality.
          We never store full CNIC numbers or display ID images publicly.
        </div>

        {idStatus === "verified" ? (
          <p className="msg msg-ok">
            Your identity documents have been manually reviewed by our moderation team.
          </p>
        ) : idStatus === "pending_review" ? (
          <p className="notice notice-dev">
            Your documents have been submitted and are pending manual review by an admin.
          </p>
        ) : (
          <div>
            {identityUploadEnabled() ? (
              <ActionForm action={identityAction} encType="multipart/form-data">
                <p className="hint">
                  Upload clear photos of the front and back of your CNIC. Documents are stored in access-controlled private storage and accessible only by moderators for review.
                </p>
                <div className="field">
                  <label htmlFor="cnic_front">CNIC Front image</label>
                  <input id="cnic_front" name="cnic_front" type="file" accept="image/jpeg,image/png,image/webp" required />
                </div>
                <div className="field">
                  <label htmlFor="cnic_back">CNIC Back image</label>
                  <input id="cnic_back" name="cnic_back" type="file" accept="image/jpeg,image/png,image/webp" required />
                </div>
                <Submit>Submit for manual review</Submit>
              </ActionForm>
            ) : (
              <div className="notice" style={{ background: "#fef3f2", color: "#912018", border: "1px solid #fecdca" }}>
                <strong>ID document upload is currently disabled:</strong> Secure private object storage with access control is not configured on this environment.
                Outside local development (with private local storage), identity document uploads remain disabled to prevent storing sensitive identity data in unsecured locations.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
