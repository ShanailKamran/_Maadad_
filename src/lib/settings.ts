import { q, one, isPostgresAvailable } from "./db";
import { defaults, IdentityPolicy } from "./config";
import { store } from "./store";

export type Settings = {
  identityPolicy: IdentityPolicy;
  matchRadiusKm: number;
  jobExpiryDays: number;
  minBidsTarget: number;
  expandAfterHours: number;
};

/** Runtime settings: admin-editable values in app_settings override env defaults. */
export async function getSettings(): Promise<Settings> {
  if (!(await isPostgresAvailable())) {
    const policy = store.appSettings.get("identity_policy") as IdentityPolicy | undefined;
    return {
      identityPolicy:
        policy && ["open", "pending_ok", "verified_only"].includes(policy) ? policy : defaults.identityPolicy,
      matchRadiusKm: Number(store.appSettings.get("match_radius_km") ?? defaults.matchRadiusKm),
      jobExpiryDays: Number(store.appSettings.get("job_expiry_days") ?? defaults.jobExpiryDays),
      minBidsTarget: Number(store.appSettings.get("min_bids_target") ?? defaults.minBidsTarget),
      expandAfterHours: Number(store.appSettings.get("expand_after_hours") ?? defaults.expandAfterHours),
    };
  }
  const rows = await q<{ key: string; value: string }>("SELECT key, value FROM app_settings");
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const policy = m.get("identity_policy") as IdentityPolicy | undefined;
  return {
    identityPolicy:
      policy && ["open", "pending_ok", "verified_only"].includes(policy) ? policy : defaults.identityPolicy,
    matchRadiusKm: Number(m.get("match_radius_km") ?? defaults.matchRadiusKm),
    jobExpiryDays: Number(m.get("job_expiry_days") ?? defaults.jobExpiryDays),
    minBidsTarget: Number(m.get("min_bids_target") ?? defaults.minBidsTarget),
    expandAfterHours: Number(m.get("expand_after_hours") ?? defaults.expandAfterHours),
  };
}

export async function setSetting(key: string, value: string, adminId: string) {
  if (!(await isPostgresAvailable())) {
    store.appSettings.set(key, value);
    store.audit(adminId, "setting.updated", "setting", key, { value });
    return;
  }
  await one(
    `INSERT INTO app_settings (key, value, updated_by) VALUES ($1,$2,$3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, value, adminId],
  );
}

/** SQL fragment: worker identity statuses allowed to see/bid under the policy. */
export function identityStatuses(policy: IdentityPolicy): string[] {
  switch (policy) {
    case "verified_only":
      return ["verified"];
    case "pending_ok":
      return ["verified", "pending_review"];
    default:
      return ["verified", "pending_review", "not_submitted", "rejected", "needs_resubmission"];
  }
}
