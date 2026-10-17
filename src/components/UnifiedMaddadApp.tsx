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
  if (v === "signin" || v === "login" || v === "auth") return "auth";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", minHeight: "80vh" }}>
      {/* Toast notifications */}
      <ToastRegion toasts={toasts} />

      {/* Top tabs navigation with dark metallic surface & violet rim lighting */}
      <nav className="top-tabs-nav" aria-label="Maddad Navigation Bar">
        {/* Brand Chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginInlineEnd: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, var(--violet-600) 0%, var(--violet-800) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "0.95rem",
              color: "#fff",
              boxShadow: "var(--glow-violet)",
              border: "1px solid var(--violet-400)",
            }}
          >
            مدد
          </div>
          <span style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.3px", color: "var(--text-1)" }}>
            Maddad <span className="font-urdu" style={{ color: "var(--violet-300)", fontSize: "0.95rem" }}>لاہور</span>
          </span>
        </div>

        {/* Tab 1: Marketplace */}
        <button
          type="button"
          onClick={() => switchTab("marketplace")}
          className={`tab-btn ${activeTab === "marketplace" ? "active" : ""}`}
        >
          <IconSearch size={15} />
          <span>Marketplace (تمام کام)</span>
          <span className="tab-badge tab-badge-purple">{initialPublicJobs.length}</span>
        </button>

        {/* Tab 2: Post a Job */}
        <button
          type="button"
          onClick={() => switchTab("post")}
          className={`tab-btn ${activeTab === "post" ? "active" : ""}`}
        >
          <IconPlus size={15} />
          <span>Post a Job (کام درج کریں)</span>
        </button>

        {/* Tab 3: Customer Dashboard */}
        <button
          type="button"
          onClick={() => switchTab("customer_dashboard")}
          className={`tab-btn ${activeTab === "customer_dashboard" ? "active" : ""}`}
        >
          <IconBriefcase size={15} />
          <span>My Jobs (کسٹمر)</span>
          {initialCustomerJobs.length > 0 && (
            <span className="tab-badge tab-badge-purple">{initialCustomerJobs.length}</span>
          )}
        </button>

        {/* Tab 4: Worker Dashboard */}
        <button
          type="button"
          onClick={() => switchTab("worker_dashboard")}
          className={`tab-btn ${activeTab === "worker_dashboard" ? "active" : ""}`}
        >
          <IconZap size={15} />
          <span>Technician Bids (کاریگر)</span>
          {initialWorkerBids.length > 0 && (
            <span className="tab-badge tab-badge-purple">{initialWorkerBids.length}</span>
          )}
        </button>

        {/* Tab 5: Worker Profile */}
        <button
          type="button"
          onClick={() => switchTab("worker_profile")}
          className={`tab-btn ${activeTab === "worker_profile" ? "active" : ""}`}
        >
          <IconUser size={15} />
          <span>Profile &amp; Trades (پروفائل)</span>
        </button>

        {/* Tab 6: Notifications */}
        <button
          type="button"
          onClick={() => switchTab("notifications")}
          className={`tab-btn ${activeTab === "notifications" ? "active" : ""}`}
        >
          <IconBell size={15} />
          <span>Alerts (اطلاعات)</span>
          {unreadCount > 0 && <span className="tab-badge tab-badge-red">{unreadCount}</span>}
        </button>

        {/* Tab 7: Moderation (Admin or Dev) */}
        {(currentUser?.is_admin || process.env.NODE_ENV !== "production") && (
          <button
            type="button"
            onClick={() => switchTab("moderation")}
            className={`tab-btn ${activeTab === "moderation" ? "active" : ""}`}
            style={{ borderColor: "rgba(245, 158, 11, 0.4)", color: "var(--amber-300)" }}
          >
            <IconShield size={15} />
            <span>Moderation (ایڈمن)</span>
            {initialReports.length > 0 && (
              <span className="tab-badge" style={{ background: "var(--amber-400)", color: "#000" }}>
                {initialReports.length}
              </span>
            )}
          </button>
        )}

        {/* Tab 8: Settings */}
        <button
          type="button"
          onClick={() => switchTab("settings")}
          className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
        >
          <IconSettings size={15} />
          <span>Settings (سیٹنگز)</span>
        </button>

        {/* Tab 9: Account / Switcher */}
        <button
          type="button"
          onClick={() => switchTab("auth")}
          className={`tab-btn ${activeTab === "auth" ? "active" : ""}`}
          style={{ marginInlineStart: "auto" }}
        >
          <IconUser size={15} />
          <span>
            {currentUser
              ? currentUser.display_name || currentUser.phone
              : "Sign In / Demo (لاگ ان)"}
          </span>
        </button>
      </nav>

      {/* Main Content by Tab */}
      <div className="tab-content">
        {/* VIEW 1: MARKETPLACE */}
        {activeTab === "marketplace" && (
          <div className="stack-md">
            <Hero
              user={currentUser}
              totalOpen={initialPublicJobs.length}
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

        {/* VIEW 9: AUTH & DEMO PERSONA SWITCHER */}
        {activeTab === "auth" && (
          <AuthView
            currentUser={currentUser}
            demoAccounts={demoAccounts}
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
    </div>
  );
}
