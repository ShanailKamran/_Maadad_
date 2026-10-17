import type { Metadata } from "next";
import { browsePublicJobs, browseJobsForWorker, listCustomerJobs, categoriesAndAreas } from "@/lib/jobs";
import { getUser } from "@/lib/auth";
import { myBookings } from "@/lib/bookings";
import { myBids } from "@/lib/bids";
import { isPostgresAvailable, q } from "@/lib/db";
import { store } from "@/lib/store";
import { DEMO_ACCOUNTS, demoAccountsEnabled } from "@/lib/config";
import UnifiedMaddadApp from "@/components/UnifiedMaddadApp";

export const metadata: Metadata = {
  title: "Maddad Lahore – Post a plumbing or electrical job, compare bids",
  description:
    "Describe a small plumbing or electrical job in Lahore, get bids from independent technicians, and choose who to hire. You pay the technician directly.",
};

export default async function Home({ searchParams }: { searchParams?: { view?: string } }) {
  const [user, publicJobs, { categories, areas }] = await Promise.all([
    getUser(),
    browsePublicJobs(),
    categoriesAndAreas(),
  ]);

  let customerJobs: any[] = [];
  let bookings: any[] = [];
  let workerBids: any[] = [];
  let workerJobs: any[] = [];
  let notifications: any[] = [];
  let reports: any[] = [];
  let auditLogs: any[] = [];
  let workerProfile: any = null;

  if (user) {
    const isPg = await isPostgresAvailable();
    const [cJobs, bks, wBids, wJobs] = await Promise.all([
      listCustomerJobs(user),
      myBookings(user),
      user.is_worker ? myBids(user) : Promise.resolve([]),
      user.is_worker ? browseJobsForWorker(user) : Promise.resolve([]),
    ]);
    customerJobs = cJobs;
    bookings = bks;
    workerBids = wBids;
    workerJobs = wJobs;

    if (!isPg) {
      notifications = store.listNotifications(user.id);
      if (user.is_worker) {
        const wp = store.getWorkerProfile(user.id);
        if (wp) {
          workerProfile = {
            bio: wp.bio,
            experience_years: wp.experience_years ?? 0,
            accepting_bids: wp.accepting_bids,
            identity_status: wp.identity_status,
            categories: wp.categories,
            areas: wp.areas,
          };
        }
      }
      if (user.is_admin) {
        reports = Array.from(store.reports.values()).filter((r) => r.status === "open");
        auditLogs = store.auditLogs;
      }
    } else {
      notifications = await q(
        `SELECT id, type, title, body, ref_type, ref_id, read_at, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
        [user.id],
      );
      if (user.is_worker) {
        const [wp] = await q<{ bio: string; experience_years: number; accepting_bids: boolean; identity_status: string }>(
          `SELECT bio, experience_years, accepting_bids, identity_status::text FROM worker_profiles WHERE user_id=$1`,
          [user.id],
        );
        if (wp) {
          const cats = await q<{ category_id: number }>(`SELECT category_id FROM worker_categories WHERE user_id=$1`, [user.id]);
          const ars = await q<{ area_id: number }>(`SELECT area_id FROM worker_areas WHERE user_id=$1`, [user.id]);
          workerProfile = {
            ...wp,
            categories: cats.map((c) => c.category_id),
            areas: ars.map((a) => a.area_id),
          };
        }
      }
      if (user.is_admin) {
        reports = await q(
          `SELECT id, target_type, target_id, reason, details, status, created_at FROM reports WHERE status='open' ORDER BY created_at DESC LIMIT 50`,
        );
        auditLogs = await q(
          `SELECT id, actor_id, action, target_type, target_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 50`,
        );
      }
    }
  }

  return (
    <UnifiedMaddadApp
      currentUser={user}
      initialView={searchParams?.view ?? null}
      initialPublicJobs={publicJobs}
      initialCustomerJobs={customerJobs}
      initialCustomerBookings={bookings}
      initialWorkerBids={workerBids}
      initialWorkerJobs={workerJobs}
      initialNotifications={notifications}
      initialReports={reports}
      initialAuditLogs={auditLogs}
      initialWorkerProfile={workerProfile}
      demoAccounts={demoAccountsEnabled() ? DEMO_ACCOUNTS.map((d) => ({ ...d })) : null}
      areas={areas.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories}
    />
  );
}
