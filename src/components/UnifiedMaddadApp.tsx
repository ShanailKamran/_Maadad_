"use client";

import React, { useState, useMemo, useEffect, useTransition } from "react";
import {
  IconSearch,
  IconPlus,
  IconBriefcase,
  IconZap,
  IconUser,
  IconBell,
  IconShield,
  IconSettings,
  IconArrowLeft,
  IconWrench,
} from "./icons";
import {
  AppUser,
  PublicJobItem,
  CustomerJobItem,
  BookingItem,
  WorkerBidItem,
  NotificationItem,
  ReportItem,
  AuditLogItem,
  WorkerProfileData,
  AreaOption,
  CategoryOption,
  DemoAccount,
} from "./maddad/types";
import { ToastRegion, useToasts } from "./maddad/shared";
import {
  Hero,
  HowItWorks,
  TrustPanel,
  MarketplaceView,
  JobDialog,
} from "./maddad/Marketplace";
import { PostJobView } from "./maddad/PostJob";
import {
  CustomerDashboardView,
  WorkerDashboardView,
} from "./maddad/Dashboards";
import { WorkerProfileView } from "./maddad/WorkerProfile";
import { AuthView } from "./maddad/AuthView";
import { NotificationsView } from "./maddad/NotificationsView";
import { ModerationView } from "./maddad/ModerationView";
import { SettingsView } from "./maddad/SettingsView";

export interface UnifiedAppProps {
  currentUser: AppUser | null;
  initialView?: string | null;
  initialPublicJobs: PublicJobItem[];
  initialCustomerJobs: CustomerJobItem[];
  initialCustomerBookings: BookingItem[];
  initialWorkerBids: WorkerBidItem[];
  initialWorkerJobs: PublicJobItem[];
  initialNotifications: NotificationItem[];
  initialReports: ReportItem[];
  initialAuditLogs: AuditLogItem[];
  initialWorkerProfile: WorkerProfileData | null;
  demoAccounts: DemoAccount[] | null;
  areas: AreaOption[];
  categories: CategoryOption[];
}

type TabType =
  | "marketplace"
  | "post"
  | "customer_dashboard"
  | "worker_dashboard"
  | "worker_profile"
  | "notifications"
  | "moderation"
  | "settings"
  | "auth";

function resolveInitialTab(view?: string | null, user?: AppUser | null): TabType {
  if (!view) return "marketplace";
  const v = view.toLowerCase().trim();
  if (v === "post" || v === "post_job" || v === "new") return "post";
  if (v === "join" || v === "worker" || v === "worker_dashboard" || v === "bids") return "worker_dashboard";
  if (v === "profile" || v === "worker_profile") return "worker_profile";
  if (v === "jobs" || v === "dashboard" || v === "customer" || v === "customer_dashboard") return "customer_dashboard";
  if (v === "signin" || v === "login" || v === "auth" || v === "signup" || v === "register") return "auth";
  if (v === "notifications" || v === "alerts") return "notifications";
  if (v === "moderation" || v === "admin") return "moderation";
  if (v === "settings" || v === "account") return "settings";
  return "marketplace";
}

export default function UnifiedMaddadApp({
  currentUser,
  initialView,
  initialPublicJobs,
  initialCustomerJobs,
  initialCustomerBookings,
  initialWorkerBids,
  initialWorkerJobs,
  initialNotifications,
  initialReports,
  initialAuditLogs,
  initialWorkerProfile,
  demoAccounts,
  areas,
  categories,
}: UnifiedAppProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    resolveInitialTab(initialView, currentUser),
  );
  const [notifications, setNotifications] = useState(initialNotifications);
  const [activeJobModal, setActiveJobModal] = useState<PublicJobItem | null>(null);

  const { toasts, push: showToast } = useToasts();

  // Listen to searchParams changes if URL changes externally (e.g. clicking header buttons)
  useEffect(() => {
    if (initialView) {
      setActiveTab(resolveInitialTab(initialView, currentUser));
    }
  }, [initialView, currentUser]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const ownJobIds = useMemo(() => {
    const s = new Set<string>();
    initialCustomerJobs.forEach((j) => s.add(j.id));
    return s;
  }, [initialCustomerJobs]);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    // Smoothly update browser URL without hard page refresh
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "marketplace") {
        url.searchParams.delete("view");
      } else {
        url.searchParams.set("view", tab);
      }
      window.history.replaceState({}, "", url.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const realCount = useMemo(
    () => initialPublicJobs.filter((j) => !j.is_demo).length,
    [initialPublicJobs],
  );
  const sampleCount = useMemo(
    () => initialPublicJobs.filter((j) => j.is_demo).length,
    [initialPublicJobs],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", minHeight: "80vh" }}>
      {/* Toast notifications */}
      <ToastRegion toasts={toasts} />

      {/* Clean contextual view header when navigated away from the main marketplace */}
      {activeTab !== "marketplace" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            marginBottom: 20,
            borderRadius: "var(--r-md)",
            background: "var(--ink-1)",
            border: "1px solid var(--line-soft)",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() => switchTab("marketplace")}
            className="btn btn-ghost btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <IconArrowLeft size={16} aria-hidden="true" />
            <span>Back to Marketplace</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pill pill-violet" style={{ textTransform: "capitalize", fontWeight: 700 }}>
              {activeTab === "customer_dashboard"
                ? "Customer Dashboard"
                : activeTab === "worker_dashboard"
                ? "Technician Portal"
                : activeTab === "worker_profile"
                ? "Technician Profile"
                : activeTab === "post"
                ? "Post a Job"
                : activeTab.replace("_", " ")}
            </span>
            {currentUser && (
              <span className="meta hide-sm" style={{ margin: 0 }}>
                {currentUser.display_name || currentUser.phone}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content by Tab */}
      <div className="tab-content">
        {/* VIEW 1: MARKETPLACE */}
        {activeTab === "marketplace" && (
          <div className="stack-md">
            <Hero
              user={currentUser}
              realOpenCount={realCount}
              sampleCount={sampleCount}
              onPost={() => switchTab("post")}
              onJoin={() => (currentUser?.is_worker ? switchTab("worker_dashboard") : switchTab("auth"))}
              compact={false}
            />

            <HowItWorks />

            <MarketplaceView
              jobs={initialPublicJobs}
              areas={areas}
              user={currentUser}
              ownJobIds={ownJobIds}
              onOpenJob={(job) => setActiveJobModal(job)}
              onPost={() => switchTab("post")}
            />

            <TrustPanel />
          </div>
        )}

        {/* VIEW 2: POST A JOB */}
        {activeTab === "post" && (
          <div style={{ maxWidth: 840, margin: "0 auto", width: "100%" }}>
            <PostJobView
              user={currentUser}
              categories={categories}
              areas={areas}
              onNeedAuth={() => switchTab("auth")}
              onSuccess={(jobId) => {
                showToast("Job posted successfully! Lahore technicians can now review and bid.");
                switchTab("customer_dashboard");
              }}
              onViewMarketplace={() => switchTab("marketplace")}
            />
          </div>
        )}

        {/* VIEW 3: CUSTOMER DASHBOARD */}
        {activeTab === "customer_dashboard" && (
          <CustomerDashboardView
            user={
              currentUser || {
                id: "guest",
                phone: "0300 0000000",
                display_name: "Guest",
                is_customer: true,
                is_worker: false,
                is_admin: false,
                account_status: "active",
              }
            }
            jobs={initialCustomerJobs}
            bookings={initialCustomerBookings}
            onOpenJob={(job) => setActiveJobModal(job)}
            onPostJob={() => switchTab("post")}
            onToast={(msg) => showToast(msg)}
          />
        )}

        {/* VIEW 4: WORKER DASHBOARD */}
        {activeTab === "worker_dashboard" && (
          <WorkerDashboardView
            user={
              currentUser || {
                id: "guest",
                phone: "0300 0000000",
                display_name: "Guest",
                is_customer: false,
                is_worker: true,
                is_admin: false,
                account_status: "active",
              }
            }
            bids={initialWorkerBids}
            matchingJobs={initialWorkerJobs.length > 0 ? initialWorkerJobs : initialPublicJobs}
            onOpenJob={(job) => setActiveJobModal(job)}
            onOpenProfile={() => switchTab("worker_profile")}
            onToast={(msg) => showToast(msg)}
          />
        )}

        {/* VIEW 5: WORKER PROFILE */}
        {activeTab === "worker_profile" && (
          <WorkerProfileView
            currentUser={currentUser}
            initialProfile={initialWorkerProfile}
            areas={areas}
            categories={categories}
            showToast={(msg) => showToast(msg)}
            onNavigateAuth={() => switchTab("auth")}
          />
        )}

        {/* VIEW 6: NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <NotificationsView
            notifications={notifications}
            onMarkAllRead={() => {
              setNotifications((prev) =>
                prev.map((n) => ({ ...n, read_at: new Date() })),
              );
            }}
            showToast={(msg) => showToast(msg)}
          />
        )}

        {/* VIEW 7: MODERATION */}
        {activeTab === "moderation" && (
          <ModerationView
            currentUser={currentUser}
            reports={initialReports}
            auditLogs={initialAuditLogs}
            showToast={(msg) => showToast(msg)}
            onNavigateAuth={() => switchTab("auth")}
          />
        )}

        {/* VIEW 8: SETTINGS */}
        {activeTab === "settings" && (
          <SettingsView
            currentUser={currentUser}
            showToast={(msg) => showToast(msg)}
            onNavigateAuth={() => switchTab("auth")}
          />
        )}

        {/* VIEW 9: AUTH / SIGN UP & SIGN IN */}
        {activeTab === "auth" && (
          <AuthView
            currentUser={currentUser}
            initialMode={initialView === "signin" || initialView === "login" ? "signin" : "signup"}
            onNavigateMarketplace={() => switchTab("marketplace")}
            showToast={(msg) => showToast(msg)}
          />
        )}
      </div>

      {/* Accessible In-Page Job Details & Bidding Modal */}
      {activeJobModal && (
        <JobDialog
          job={activeJobModal}
          user={currentUser}
          isOwn={ownJobIds.has(activeJobModal.id)}
          onClose={() => setActiveJobModal(null)}
          onSignIn={() => {
            setActiveJobModal(null);
            switchTab("auth");
          }}
          onJoin={() => {
            setActiveJobModal(null);
            switchTab("worker_profile");
          }}
          onBidSent={(msg) => {
            showToast(msg);
            setActiveJobModal(null);
          }}
        />
      )}

      {/* Mobile Bottom Dock for fast thumb-friendly navigation on small screens */}
      <nav className="mobile-dock" aria-label="Mobile navigation">
        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "marketplace" ? "is-active" : ""}`}
          onClick={() => switchTab("marketplace")}
          aria-label="Marketplace"
        >
          <IconSearch size={20} aria-hidden="true" />
          <span>Market</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "post" ? "is-active" : ""}`}
          onClick={() => switchTab("post")}
          aria-label="Post a Job"
        >
          <div className="mobile-dock-plus">
            <IconPlus size={18} aria-hidden="true" />
          </div>
          <span>Post</span>
        </button>

        {currentUser?.is_worker ? (
          <button
            type="button"
            className={`mobile-dock-btn ${activeTab === "worker_dashboard" ? "is-active" : ""}`}
            onClick={() => switchTab("worker_dashboard")}
            aria-label="Technician Portal"
          >
            <IconWrench size={20} aria-hidden="true" />
            <span>Worker</span>
          </button>
        ) : (
          <button
            type="button"
            className={`mobile-dock-btn ${activeTab === "customer_dashboard" ? "is-active" : ""}`}
            onClick={() => (currentUser ? switchTab("customer_dashboard") : switchTab("auth"))}
            aria-label="My Dashboard"
          >
            <IconBriefcase size={20} aria-hidden="true" />
            <span>My Jobs</span>
          </button>
        )}

        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "notifications" ? "is-active" : ""}`}
          onClick={() => switchTab("notifications")}
          aria-label="Notifications"
          style={{ position: "relative" }}
        >
          <IconBell size={20} aria-hidden="true" />
          {unreadCount > 0 && <span className="mobile-dock-badge" aria-label={`${unreadCount} unread`} />}
          <span>Alerts</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-btn ${activeTab === "settings" || activeTab === "auth" ? "is-active" : ""}`}
          onClick={() => (currentUser ? switchTab("settings") : switchTab("auth"))}
          aria-label={currentUser ? "Account" : "Sign in"}
        >
          <IconUser size={20} aria-hidden="true" />
          <span>{currentUser ? "Account" : "Sign In"}</span>
        </button>
      </nav>
    </div>
  );
}
