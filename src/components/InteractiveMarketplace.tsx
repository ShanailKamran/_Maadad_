"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";

export type Role = "customer" | "worker" | "admin";

export type UserProfile = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  area: string;
  isIdReviewed?: boolean;
};

export type JobListing = {
  id: string;
  title: string;
  category: "plumbing" | "electrical";
  area: string;
  exactAddress?: string;
  customerPhone?: string;
  budgetMin: number;
  budgetMax: number;
  urgency: "urgent" | "today" | "flexible";
  description: string;
  date: string;
  bidsCount: number;
  hasPhotos: boolean;
  status: "open" | "awarded" | "in_progress" | "completed";
  awardedWorkerId?: string;
  awardedPrice?: number;
  completionCode?: string;
  isBookmarked?: boolean;
};

export type Bid = {
  id: string;
  jobId: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  workerRating: number;
  workerReviewsCount: number;
  isIdReviewed: boolean;
  amount: number;
  eta: string;
  message: string;
  createdAt: string;
};

// Initial Lahore pilot dataset
const INITIAL_JOBS: JobListing[] = [
  {
    id: "job-101",
    title: "Underground Water Pipe Leakage Repair",
    category: "plumbing",
    area: "Gulberg III, Lahore",
    exactAddress: "House 24-A, Block H, Main Boulevard, Gulberg III",
    customerPhone: "+923001122334",
    budgetMin: 3500,
    budgetMax: 5000,
    urgency: "urgent",
    description: "Concealed PPRC pipe leaking in the ground floor guest bathroom. Dampness showing through wall tiles. Needs urgent diagnostic and joint repair.",
    date: "Today",
    bidsCount: 3,
    hasPhotos: true,
    status: "open",
    completionCode: "4921",
  },
  {
    id: "job-102",
    title: "Main Circuit Breaker & DB Tripping",
    category: "electrical",
    area: "DHA Phase 5, Lahore",
    exactAddress: "Sector C, Street 14, House 102, DHA Phase 5",
    customerPhone: "+923214455667",
    budgetMin: 2500,
    budgetMax: 4500,
    urgency: "today",
    description: "63A main distribution breaker repeatedly trips whenever both inverter ACs and geyser are switched on. Need an expert electrician to balance loads.",
    date: "Today",
    bidsCount: 4,
    hasPhotos: true,
    status: "open",
    completionCode: "8134",
  },
  {
    id: "job-103",
    title: "Water Motor Starter & Capacitor Replacement",
    category: "electrical",
    area: "Model Town, Lahore",
    exactAddress: "Block J, House 48, Model Town",
    customerPhone: "+923337788990",
    budgetMin: 2000,
    budgetMax: 3500,
    urgency: "today",
    description: "1.5 HP underground suction pump humming but not starting. Starter box burnt out or capacitor failed. Need tested replacement today.",
    date: "Today",
    bidsCount: 1,
    hasPhotos: false,
    status: "open",
    completionCode: "2950",
  },
  {
    id: "job-104",
    title: "Master Bathroom Sanitary & Mixer Fitting",
    category: "plumbing",
    area: "Johar Town, Lahore",
    exactAddress: "Block G-3, House 210, Johar Town",
    customerPhone: "+923019876543",
    budgetMin: 5500,
    budgetMax: 8500,
    urgency: "flexible",
    description: "Renovating master bathroom. Need installation of vanity basin mixer, wall-hung commode flush cistern, and hot/cold rain shower concealed valve.",
    date: "Yesterday",
    bidsCount: 2,
    hasPhotos: true,
    status: "open",
    completionCode: "6712",
  },
  {
    id: "job-105",
    title: "UPS & Solar Inverter Dual-Line Wiring",
    category: "electrical",
    area: "Cantt, Lahore",
    exactAddress: "Saddar Bazaar Lane 4, House 15, Lahore Cantt",
    customerPhone: "+923155554433",
    budgetMin: 8000,
    budgetMax: 12000,
    urgency: "flexible",
    description: "Need dedicated changeover switch and neutral-separated wiring for a new 3kW hybrid solar inverter to prevent back-feed to WAPDA meter.",
    date: "Yesterday",
    bidsCount: 5,
    hasPhotos: true,
    status: "open",
    completionCode: "9341",
  },
  {
    id: "job-106",
    title: "Gas Geyser Thermostat & Burner Servicing",
    category: "plumbing",
    area: "Faisal Town, Lahore",
    exactAddress: "Block B, House 33, Faisal Town",
    customerPhone: "+923451122998",
    budgetMin: 3000,
    budgetMax: 4500,
    urgency: "today",
    description: "35-gallon water heater pilot light stays on but main burner doesn't ignite. Needs thermo-couple cleaning and pressure safety valve inspection.",
    date: "14 Oct",
    bidsCount: 2,
    hasPhotos: false,
    status: "open",
    completionCode: "3087",
  },
  {
    id: "job-107",
    title: "Kitchen Tap & Hot/Cold Mixer Replacement",
    category: "plumbing",
    area: "Iqbal Town, Lahore",
    exactAddress: "Khyber Block, House 76, Allama Iqbal Town",
    customerPhone: "+923023344556",
    budgetMin: 1500,
    budgetMax: 2500,
    urgency: "today",
    description: "Kitchen swan-neck mixer tap base has loosened and water is seeping into the wooden under-sink cabinet. New faucet already bought, installation only.",
    date: "Today",
    bidsCount: 3,
    hasPhotos: true,
    status: "open",
    completionCode: "7529",
  },
  {
    id: "job-108",
    title: "Ceiling Fan & Heavy Dimmer Installation (x4)",
    category: "electrical",
    area: "Wapda Town, Lahore",
    exactAddress: "Phase 1, Block D2, House 19, Wapda Town",
    customerPhone: "+923238877665",
    budgetMin: 3000,
    budgetMax: 4500,
    urgency: "flexible",
    description: "Mounting and connection of 4 Royal Deluxe ceiling fans with heavy-duty step dimmers. Ceilings are 11ft high; worker must bring standard 8ft ladder.",
    date: "13 Oct",
    bidsCount: 4,
    hasPhotos: false,
    status: "open",
    completionCode: "1894",
  },
  {
    id: "job-109",
    title: "Main Distribution Box (DB) Overhaul",
    category: "electrical",
    area: "Garden Town, Lahore",
    exactAddress: "Civic Centre, Usman Block, House 8, Garden Town",
    customerPhone: "+923004455667",
    budgetMin: 9000,
    budgetMax: 15000,
    urgency: "urgent",
    description: "Old fuse box burned out. Need 16-way modern MCB distribution board installation with Earth Leakage Breaker (ELCB) and labeled circuit routing.",
    date: "Today",
    bidsCount: 2,
    hasPhotos: true,
    status: "open",
    completionCode: "5620",
  },
];

const INITIAL_BIDS: Bid[] = [
  {
    id: "bid-1",
    jobId: "job-101",
    workerId: "w-1",
    workerName: "Muhammad Rashid",
    workerPhone: "+923004567890",
    workerRating: 4.9,
    workerReviewsCount: 38,
    isIdReviewed: true,
    amount: 4000,
    eta: "Within 2 hours",
    message: "12 years experience in concealed PPRC pipe repair in Gulberg and Model Town. I have pressure testing gauges and hot-melt welding equipment ready.",
    createdAt: "1 hour ago",
  },
  {
    id: "bid-2",
    jobId: "job-101",
    workerId: "w-2",
    workerName: "Akram Javed",
    workerPhone: "+923219876543",
    workerRating: 4.7,
    workerReviewsCount: 19,
    isIdReviewed: true,
    amount: 3500,
    eta: "Today 4:00 PM",
    message: "Specialist in tile-safe minimal wall breaking. Will diagnose leak location and weld new pipe section with warranty on joints.",
    createdAt: "45 mins ago",
  },
  {
    id: "bid-3",
    jobId: "job-102",
    workerId: "w-3",
    workerName: "Tariq Mahmood",
    workerPhone: "+923331122334",
    workerRating: 5.0,
    workerReviewsCount: 46,
    isIdReviewed: true,
    amount: 3200,
    eta: "Within 90 mins",
    message: "Certified electrical contractor. I work regularly across DHA Phase 1 to 6. Will measure phase balance with digital clamp meter and isolate faulty breaker.",
    createdAt: "30 mins ago",
  },
  {
    id: "bid-4",
    jobId: "job-102",
    workerId: "w-4",
    workerName: "Zahid Qureshi",
    workerPhone: "+923026677889",
    workerRating: 4.8,
    workerReviewsCount: 24,
    isIdReviewed: false,
    amount: 2800,
    eta: "Today by 5:30 PM",
    message: "Experienced industrial and domestic electrician. Will test earth-leakage tripping and rewire the heavy appliance breaker lines.",
    createdAt: "20 mins ago",
  },
];

const LAHORE_AREAS = [
  "All Lahore Areas",
  "Gulberg III",
  "DHA Phase 5",
  "Model Town",
  "Johar Town",
  "Cantt",
  "Faisal Town",
  "Iqbal Town",
  "Wapda Town",
  "Garden Town",
  "Bahria Town",
  "Shadman",
  "Cavalry Ground",
];

export default function InteractiveMarketplace() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"marketplace" | "post" | "worker" | "account" | "admin" | "trust">("marketplace");

  // User Authentication State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Sign up form state
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("0300 1234567");
  const [signupRole, setSignupRole] = useState<Role>("customer");
  const [signupArea, setSignupArea] = useState("Gulberg III");
  const [signupOtp, setSignupOtp] = useState("");
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [signupStep, setSignupStep] = useState<"phone" | "otp">("phone");

  // Marketplace Listings & Bids State
  const [jobs, setJobs] = useState<JobListing[]>(INITIAL_JOBS);
  const [bids, setBids] = useState<Bid[]>(INITIAL_BIDS);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filters State (matching the reference UI)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState("All Lahore Areas");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "plumbing" | "electrical">("all");
  const [selectedSort, setSelectedSort] = useState<"newest" | "budget_low" | "bids_low">("newest");
  
  // Sidebar Checkbox filters
  const [filterTitlesOnly, setFilterTitlesOnly] = useState(false);
  const [filterHasPhotos, setFilterHasPhotos] = useState(false);
  const [filterPostedToday, setFilterPostedToday] = useState(false);
  const [filterLowBids, setFilterLowBids] = useState(false);
  const [filterIncludeNearby, setFilterIncludeNearby] = useState(true);
  const [filterMinBudget, setFilterMinBudget] = useState(1000);
  const [filterMaxBudget, setFilterMaxBudget] = useState(25000);

  // New Job Posting State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<"plumbing" | "electrical">("plumbing");
  const [newArea, setNewArea] = useState("Gulberg III");
  const [newAddress, setNewAddress] = useState("");
  const [newMinBudget, setNewMinBudget] = useState(3000);
  const [newMaxBudget, setNewMaxBudget] = useState(5000);
  const [newUrgency, setNewUrgency] = useState<"urgent" | "today" | "flexible">("today");
  const [newDesc, setNewDesc] = useState("");

  // New Bid State
  const [bidAmount, setBidAmount] = useState<number>(3500);
  const [bidEta, setBidEta] = useState("Within 2 hours");
  const [bidMessage, setBidMessage] = useState("");

  // Auto-show sign-up modal on first load if user is not logged in
  useEffect(() => {
    const savedUser = localStorage.getItem("kl_demo_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setShowSignupModal(true);
      }
    } else {
      setShowSignupModal(true);
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Quick 1-click Demo Logins
  const handleQuickLogin = (role: Role, name: string, phone: string, area: string, isIdReviewed = true) => {
    const profile: UserProfile = {
      id: "u-" + Math.floor(Math.random() * 9000 + 1000),
      name,
      phone,
      role,
      area,
      isIdReviewed,
    };
    setUser(profile);
    localStorage.setItem("kl_demo_user", JSON.stringify(profile));
    setShowSignupModal(false);
    setActiveTab("marketplace");
    triggerToast(`Welcome, ${name}! Signed in as ${role === "customer" ? "Customer" : role === "worker" ? "Independent Worker" : "Admin"}.`);
  };

  // Sign up OTP request
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupPhone.trim()) return;
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setDevOtpCode(generated);
    setSignupOtp(generated); // auto-fill for convenience
    setSignupStep("otp");
  };

  // Sign up verification -> opens Home / Marketplace
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupOtp || signupOtp.length < 4) return;
    const profile: UserProfile = {
      id: "u-" + Math.floor(Math.random() * 9000 + 1000),
      name: signupName.trim() || (signupRole === "customer" ? "Customer Ali" : "Tariq Electrician"),
      phone: signupPhone.trim(),
      role: signupRole,
      area: signupArea,
      isIdReviewed: signupRole === "worker",
    };
    setUser(profile);
    localStorage.setItem("kl_demo_user", JSON.stringify(profile));
    setShowSignupModal(false);
    setSignupStep("phone");
    setActiveTab("marketplace"); // Open home page!
    triggerToast(`Welcome, ${profile.name}! Your account is active. Now browsing Lahore jobs.`);
  };

  // Toggle Bookmark
  const toggleBookmark = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, isBookmarked: !j.isBookmarked } : j));
    triggerToast("Job saved to your bookmarks.");
  };

  // Dismiss / delete job preview
  const dismissJob = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setJobs(prev => prev.filter(j => j.id !== jobId));
    triggerToast("Listing removed from your current view.");
  };

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Category filter
      if (selectedCategory !== "all" && job.category !== selectedCategory) return false;
      
      // Area filter
      if (selectedArea !== "All Lahore Areas" && !job.area.toLowerCase().includes(selectedArea.toLowerCase())) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (filterTitlesOnly) {
          if (!job.title.toLowerCase().includes(q)) return false;
        } else {
          if (!job.title.toLowerCase().includes(q) && !job.description.toLowerCase().includes(q) && !job.area.toLowerCase().includes(q)) {
            return false;
          }
        }
      }

      // Checkbox filters
      if (filterHasPhotos && !job.hasPhotos) return false;
      if (filterPostedToday && job.date !== "Today") return false;
      if (filterLowBids && job.bidsCount >= 3) return false;

      // Budget filter
      if (job.budgetMax < filterMinBudget || job.budgetMin > filterMaxBudget) return false;

      return true;
    }).sort((a, b) => {
      if (selectedSort === "budget_low") return a.budgetMin - b.budgetMin;
      if (selectedSort === "bids_low") return a.bidsCount - b.bidsCount;
      return 0; // default newest
    });
  }, [jobs, selectedCategory, selectedArea, searchQuery, filterTitlesOnly, filterHasPhotos, filterPostedToday, filterLowBids, filterMinBudget, filterMaxBudget, selectedSort]);

  // Handle Post Job
  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    const newJob: JobListing = {
      id: "job-" + (Date.now() % 10000),
      title: newTitle.trim(),
      category: newCategory,
      area: `${newArea}, Lahore`,
      exactAddress: newAddress.trim() || `Street 7, Sector B, ${newArea}`,
      customerPhone: user?.phone || "+923001234567",
      budgetMin: Number(newMinBudget) || 2000,
      budgetMax: Number(newMaxBudget) || 4000,
      urgency: newUrgency,
      description: newDesc.trim(),
      date: "Today",
      bidsCount: 0,
      hasPhotos: true,
      status: "open",
      completionCode: String(Math.floor(1000 + Math.random() * 9000)),
    };

    setJobs([newJob, ...jobs]);
    setActiveTab("marketplace");
    triggerToast("Job posted successfully! Nearby independent technicians in Lahore can now send bids.");
    // Reset
    setNewTitle("");
    setNewDesc("");
    setNewAddress("");
  };

  // Handle Bid Submission
  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    const newBid: Bid = {
      id: "bid-" + Date.now(),
      jobId: selectedJob.id,
      workerId: user?.id || "w-demo",
      workerName: user?.name || "Independent Technician",
      workerPhone: user?.phone || "+923004567890",
      workerRating: 4.9,
      workerReviewsCount: 15,
      isIdReviewed: user?.isIdReviewed ?? true,
      amount: Number(bidAmount),
      eta: bidEta,
      message: bidMessage.trim() || "Ready to carry out work with professional tools and quality guarantee.",
      createdAt: "Just now",
    };

    setBids([newBid, ...bids]);
    setJobs(jobs.map(j => j.id === selectedJob.id ? { ...j, bidsCount: j.bidsCount + 1 } : j));
    setBidMessage("");
    triggerToast("Your bid of PKR " + bidAmount.toLocaleString() + " was sent to the customer!");
  };

  // Handle Customer Awarding a Bid
  const handleAwardBid = (bid: Bid) => {
    if (!selectedJob) return;
    setJobs(jobs.map(j => j.id === selectedJob.id ? {
      ...j,
      status: "awarded",
      awardedWorkerId: bid.workerId,
      awardedPrice: bid.amount,
    } : j));
    setSelectedJob({
      ...selectedJob,
      status: "awarded",
      awardedWorkerId: bid.workerId,
      awardedPrice: bid.amount,
    });
    triggerToast(`Worker ${bid.workerName} hired! Exact customer address and phone number are now revealed.`);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedArea("All Lahore Areas");
    setSelectedCategory("all");
    setFilterTitlesOnly(false);
    setFilterHasPhotos(false);
    setFilterPostedToday(false);
    setFilterLowBids(false);
    setFilterMinBudget(1000);
    setFilterMaxBudget(25000);
  };

  return (
    <div className="cr-outer-wrap">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="cr-toast animate-slide-in">
          <span>✨ {toastMessage}</span>
          <button onClick={() => setToastMessage(null)}>✕</button>
        </div>
      )}

      {/* Main Elevated Rounded Card Container (Matching Reference Image) */}
      <div className="cr-app-canvas">
        {/* Top Header Bar */}
        <header className="cr-header">
          <div className="cr-header-left">
            {/* Monogram Circular Badge in Urdu */}
            <div className="cr-logo-badge cr-logo-urdu" onClick={() => setActiveTab("marketplace")} title="مدد (Maddad) - لاہور">
              مدد
            </div>
            <div className="cr-brand-info">
              <span className="cr-brand-title">مدد <small style={{ fontWeight: 600, fontSize: "0.85em", color: "#6941c6" }}>(Maddad)</small></span>
              <span className="cr-brand-tag">اوپن بڈ لوکل سروسز · لاہور</span>
            </div>
          </div>

          {/* Top Page Tabs - Single Localhost Navigation */}
          <nav className="cr-top-tabs" aria-label="Main Navigation">
            <button
              className={`cr-tab-btn ${activeTab === "marketplace" ? "active" : ""}`}
              onClick={() => setActiveTab("marketplace")}
            >
              <span className="cr-tab-icon">📋</span>
              <span>Marketplace</span>
              <span className="cr-tab-badge">{jobs.length}</span>
            </button>
            <button
              className={`cr-tab-btn ${activeTab === "post" ? "active" : ""}`}
              onClick={() => setActiveTab("post")}
            >
              <span className="cr-tab-icon">➕</span>
              <span>Post a Job</span>
            </button>
            <button
              className={`cr-tab-btn ${activeTab === "worker" ? "active" : ""}`}
              onClick={() => setActiveTab("worker")}
            >
              <span className="cr-tab-icon">🔨</span>
              <span>Worker Portal</span>
            </button>
            <button
              className={`cr-tab-btn ${activeTab === "account" ? "active" : ""}`}
              onClick={() => setActiveTab("account")}
            >
              <span className="cr-tab-icon">👤</span>
              <span>{user ? user.name.split(" ")[0] : "Sign In / Join"}</span>
            </button>
            <button
              className={`cr-tab-btn ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              <span className="cr-tab-icon">🛡️</span>
              <span>Moderation</span>
            </button>
            <button
              className={`cr-tab-btn ${activeTab === "trust" ? "active" : ""}`}
              onClick={() => setActiveTab("trust")}
            >
              <span className="cr-tab-icon">🤝</span>
              <span>Trust & Rules</span>
            </button>
          </nav>

          {/* Top Right Actions */}
          <div className="cr-header-right">
            <button
              className="cr-post-pill-btn"
              onClick={() => setActiveTab("post")}
            >
              Post
            </button>

            {/* Profile Avatar Button */}
            <button
              className="cr-avatar-btn"
              onClick={() => setShowSignupModal(true)}
              title={user ? `Signed in as ${user.name} (${user.role}) - Click to switch` : "Click to sign up / log in"}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              {user && <span className="cr-avatar-dot" />}
            </button>
          </div>
        </header>

        {/* ============================================================== */}
        {/* TAB 1: MARKETPLACE (Matching screenshot grid & sidebar layout) */}
        {/* ============================================================== */}
        {activeTab === "marketplace" && (
          <div className="cr-main-layout">
            {/* Left Filter Sidebar */}
            <aside className="cr-sidebar">
              {/* Filter Section Accordion */}
              <div className="cr-filter-group">
                <div className="cr-filter-header">
                  <span>Filter</span>
                  <span className="cr-chevron">⌄</span>
                </div>
                <div className="cr-filter-body">
                  <label className="cr-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterTitlesOnly}
                      onChange={e => setFilterTitlesOnly(e.target.checked)}
                    />
                    <span>Search titles only</span>
                  </label>
                  <label className="cr-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterHasPhotos}
                      onChange={e => setFilterHasPhotos(e.target.checked)}
                    />
                    <span>Has Images</span>
                  </label>
                  <label className="cr-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterPostedToday}
                      onChange={e => setFilterPostedToday(e.target.checked)}
                    />
                    <span>Posted Today</span>
                  </label>
                  <label className="cr-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterLowBids}
                      onChange={e => setFilterLowBids(e.target.checked)}
                    />
                    <span>Bundle duplicates / Low bids</span>
                  </label>
                  <label className="cr-checkbox-label">
                    <input
                      type="checkbox"
                      checked={filterIncludeNearby}
                      onChange={e => setFilterIncludeNearby(e.target.checked)}
                    />
                    <span>Include nearby areas</span>
                  </label>
                </div>
              </div>

              {/* Location Input Section */}
              <div className="cr-filter-group">
                <label className="cr-group-title">Location</label>
                <div className="cr-location-row">
                  <input
                    type="text"
                    className="cr-input-sm"
                    placeholder="Radius km"
                    defaultValue="5 km"
                  />
                  <input
                    type="text"
                    className="cr-input-sm"
                    placeholder="Lahore Area"
                    value={selectedArea === "All Lahore Areas" ? "Lahore" : selectedArea}
                    onChange={e => setSelectedArea(e.target.value)}
                  />
                  <button className="cr-search-icon-btn" onClick={() => triggerToast("Location filtered!")}>
                    🔍
                  </button>
                </div>
              </div>

              {/* Service Type / Category Section */}
              <div className="cr-filter-group">
                <div className="cr-filter-header">
                  <span>Category</span>
                  <span className="cr-chevron">⌄</span>
                </div>
                <div className="cr-filter-body">
                  <label className="cr-checkbox-label">
                    <input
                      type="radio"
                      name="catRadio"
                      checked={selectedCategory === "all"}
                      onChange={() => setSelectedCategory("all")}
                    />
                    <span>All Services ({jobs.length})</span>
                  </label>
                  <label className="cr-checkbox-label">
                    <input
                      type="radio"
                      name="catRadio"
                      checked={selectedCategory === "plumbing"}
                      onChange={() => setSelectedCategory("plumbing")}
                    />
                    <span>🔧 Plumbing ({jobs.filter(j => j.category === "plumbing").length})</span>
                  </label>
                  <label className="cr-checkbox-label">
                    <input
                      type="radio"
                      name="catRadio"
                      checked={selectedCategory === "electrical"}
                      onChange={() => setSelectedCategory("electrical")}
                    />
                    <span>⚡ Electrical ({jobs.filter(j => j.category === "electrical").length})</span>
                  </label>
                </div>
              </div>

              {/* Budget Range Section */}
              <div className="cr-filter-group">
                <div className="cr-filter-header">
                  <span>Budget Range (PKR)</span>
                  <span className="cr-chevron">⌄</span>
                </div>
                <div className="cr-filter-body">
                  <div className="cr-budget-inputs">
                    <input
                      type="number"
                      className="cr-input-sm"
                      value={filterMinBudget}
                      onChange={e => setFilterMinBudget(Number(e.target.value))}
                      placeholder="Min PKR"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      className="cr-input-sm"
                      value={filterMaxBudget}
                      onChange={e => setFilterMaxBudget(Number(e.target.value))}
                      placeholder="Max PKR"
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar Action Buttons */}
              <div className="cr-sidebar-actions">
                <button
                  className="cr-update-btn"
                  onClick={() => triggerToast("Filters updated! Showing " + filteredJobs.length + " jobs.")}
                >
                  Update Search
                </button>
                <button
                  className="cr-reset-btn"
                  onClick={handleResetFilters}
                >
                  Reset
                </button>
              </div>

              {/* Related Searches */}
              <div className="cr-related-searches">
                <div className="cr-filter-header">
                  <span>Related Searches</span>
                  <span className="cr-chevron">&gt;</span>
                </div>
                <div className="cr-tags-list">
                  <button onClick={() => setSearchQuery("leak")}>Water leak</button>
                  <button onClick={() => setSearchQuery("breaker")}>Breaker</button>
                  <button onClick={() => setSearchQuery("geyser")}>Gas geyser</button>
                  <button onClick={() => setSearchQuery("inverter")}>UPS solar</button>
                  <button onClick={() => setSearchQuery("motor")}>Water pump</button>
                </div>
              </div>
            </aside>

            {/* Right Main Content Area */}
            <main className="cr-content-area">
              {/* Top Search & Filter Bar */}
              <div className="cr-top-controls">
                <div className="cr-dropdowns-row">
                  {/* Area Dropdown */}
                  <div className="cr-select-wrapper">
                    <select
                      value={selectedArea}
                      onChange={e => setSelectedArea(e.target.value)}
                      className="cr-pill-select"
                    >
                      {LAHORE_AREAS.map(area => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                    <span className="cr-select-caret">⌄</span>
                  </div>

                  {/* Category Dropdown */}
                  <div className="cr-select-wrapper">
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value as any)}
                      className="cr-pill-select"
                    >
                      <option value="all">All Categories</option>
                      <option value="plumbing">Plumbing</option>
                      <option value="electrical">Electrical</option>
                    </select>
                    <span className="cr-select-caret">⌄</span>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="cr-select-wrapper">
                    <select
                      value={selectedSort}
                      onChange={e => setSelectedSort(e.target.value as any)}
                      className="cr-pill-select"
                    >
                      <option value="newest">Newest First</option>
                      <option value="budget_low">Lowest Budget</option>
                      <option value="bids_low">Fewest Bids</option>
                    </select>
                    <span className="cr-select-caret">⌄</span>
                  </div>
                </div>

                {/* Search Input Box */}
                <div className="cr-search-input-box">
                  <span className="cr-search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search plumbing, wiring, leaks in Lahore..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="cr-clear-btn" onClick={() => setSearchQuery("")}>✕</button>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="cr-results-header">
                <span>Showing <strong>{filteredJobs.length}</strong> active open-bid requests in Lahore</span>
                {selectedCategory !== "all" && <span className="cr-active-tag">{selectedCategory}</span>}
                {selectedArea !== "All Lahore Areas" && <span className="cr-active-tag">{selectedArea}</span>}
              </div>

              {/* 3-Column Grid of Job Cards (Matching Screenshot) */}
              {filteredJobs.length === 0 ? (
                <div className="cr-empty-state">
                  <p>No jobs found matching your criteria.</p>
                  <button className="cr-update-btn" onClick={handleResetFilters}>
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="cr-cards-grid">
                  {filteredJobs.map(job => (
                    <div
                      key={job.id}
                      className={`cr-card ${job.status === "awarded" ? "cr-card-awarded" : ""}`}
                      onClick={() => setSelectedJob(job)}
                    >
                      {/* Card Header with Icon Badge and Actions */}
                      <div className="cr-card-top">
                        {/* Service Icon Badge */}
                        <div className={`cr-icon-badge cr-icon-${job.category}`}>
                          {job.category === "plumbing" ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
                              <path d="M10 18H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2h-3"></path>
                              <circle cx="12" cy="13" r="3"></circle>
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                            </svg>
                          )}
                        </div>

                        {/* Trash / Star Action Icons */}
                        <div className="cr-card-actions">
                          <button
                            className="cr-icon-action"
                            title="Dismiss from current view"
                            onClick={(e) => dismissJob(job.id, e)}
                          >
                            🗑
                          </button>
                          <button
                            className={`cr-icon-action ${job.isBookmarked ? "cr-starred" : ""}`}
                            title="Save job"
                            onClick={(e) => toggleBookmark(job.id, e)}
                          >
                            {job.isBookmarked ? "★" : "☆"}
                          </button>
                        </div>
                      </div>

                      {/* Card Title & Location */}
                      <div className="cr-card-content">
                        <h3 className="cr-card-title">{job.title}</h3>
                        <p className="cr-card-location">{job.area}</p>
                      </div>

                      {/* Tags & Badges */}
                      <div className="cr-card-tags">
                        <span className="cr-pill-tag">
                          {job.category === "plumbing" ? "Plumbing" : "Electrical"}
                        </span>
                        <span className="cr-pill-tag cr-pill-bids">
                          {job.bidsCount} {job.bidsCount === 1 ? "bid" : "bids"}
                        </span>
                        <span className="cr-pill-tag cr-pill-budget">
                          PKR {job.budgetMin.toLocaleString()} - {job.budgetMax.toLocaleString()}
                        </span>
                      </div>

                      {/* Card Footer with Date & Status */}
                      <div className="cr-card-footer">
                        <span className="cr-card-date">{job.date}</span>
                        {job.status === "awarded" ? (
                          <span className="cr-status-badge cr-status-awarded">Hired</span>
                        ) : (
                          <span className="cr-open-badge">Open for bids</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination Bar (Matching Screenshot) */}
              <div className="cr-pagination-bar">
                <button className="cr-page-nav-btn">← Previous</button>
                <div className="cr-page-numbers">
                  <button className="cr-page-num cr-page-active">1</button>
                  <button className="cr-page-num">2</button>
                  <button className="cr-page-num">3</button>
                  <span className="cr-page-dots">...</span>
                  <button className="cr-page-num">8</button>
                  <button className="cr-page-num">9</button>
                  <button className="cr-page-num">10</button>
                </div>
                <button className="cr-page-nav-btn">Next →</button>
              </div>

              {/* Bottom Trust & Direct Settlement Disclaimer */}
              <div className="cr-trust-banner">
                <p>
                  <strong>Notice:</strong> مدد (Maddad) is an open classifieds and bidding board for independent workers in Lahore. Direct cash / bank settlement between customer and technician with zero platform commission. Exact addresses and phone numbers stay strictly private until a bid is awarded.
                </p>
              </div>
            </main>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: POST A JOB                                              */}
        {/* ============================================================== */}
        {activeTab === "post" && (
          <div className="cr-subpage-wrap">
            <div className="cr-subpage-card">
              <h2 className="cr-subpage-heading">Post a Job in Lahore</h2>
              <p className="cr-subpage-desc">
                Describe your plumbing or electrical repair. Nearby independent technicians will review and submit competitive price quotes.
              </p>

              <form onSubmit={handleCreateJob} className="cr-post-form">
                <div className="cr-form-row">
                  <label>Service Category</label>
                  <div className="cr-category-radio-group">
                    <button
                      type="button"
                      className={`cr-cat-option ${newCategory === "plumbing" ? "selected" : ""}`}
                      onClick={() => setNewCategory("plumbing")}
                    >
                      🔧 Plumbing (Pipes, Taps, Sanitary, Geysers)
                    </button>
                    <button
                      type="button"
                      className={`cr-cat-option ${newCategory === "electrical" ? "selected" : ""}`}
                      onClick={() => setNewCategory("electrical")}
                    >
                      ⚡ Electrical (Wiring, Breakers, UPS, Fans)
                    </button>
                  </div>
                </div>

                <div className="cr-form-row">
                  <label>Job Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Underground Water Leakage or Circuit Breaker Tripping"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="cr-text-input"
                  />
                </div>

                <div className="cr-form-grid-2">
                  <div className="cr-form-row">
                    <label>Lahore Neighbourhood (Publicly Visible)</label>
                    <select
                      value={newArea}
                      onChange={e => setNewArea(e.target.value)}
                      className="cr-text-input"
                    >
                      {LAHORE_AREAS.filter(a => a !== "All Lahore Areas").map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                    <small className="cr-help-text">Only coarse area is shown to bidders.</small>
                  </div>

                  <div className="cr-form-row">
                    <label>Urgency & Timing</label>
                    <select
                      value={newUrgency}
                      onChange={e => setNewUrgency(e.target.value as any)}
                      className="cr-text-input"
                    >
                      <option value="urgent">Urgent (Within 2-3 hours)</option>
                      <option value="today">Today (Anytime today)</option>
                      <option value="flexible">Flexible (Next 2-3 days)</option>
                    </select>
                  </div>
                </div>

                {/* Two-Tier Privacy Address Field */}
                <div className="cr-form-row cr-privacy-box">
                  <div className="cr-privacy-header">
                    <span>🔒 Exact Street & House Address (Private)</span>
                    <span className="cr-privacy-tag">Kept Secret</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. House 42-B, Street 14, Sector C"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    className="cr-text-input"
                  />
                  <small className="cr-privacy-explanation">
                    Your street number, house number, and phone number are completely hidden. They will only be revealed to the single worker you choose to hire.
                  </small>
                </div>

                <div className="cr-form-grid-2">
                  <div className="cr-form-row">
                    <label>Estimated Budget Minimum (PKR)</label>
                    <input
                      type="number"
                      step="100"
                      value={newMinBudget}
                      onChange={e => setNewMinBudget(Number(e.target.value))}
                      className="cr-text-input"
                    />
                  </div>
                  <div className="cr-form-row">
                    <label>Estimated Budget Maximum (PKR)</label>
                    <input
                      type="number"
                      step="100"
                      value={newMaxBudget}
                      onChange={e => setNewMaxBudget(Number(e.target.value))}
                      className="cr-text-input"
                    />
                  </div>
                </div>

                <div className="cr-form-row">
                  <label>Detailed Description</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe the issue, when it started, and any specific materials or tools needed..."
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="cr-textarea"
                  />
                </div>

                <div className="cr-form-actions">
                  <button type="submit" className="cr-update-btn cr-submit-lg">
                    Publish Job to Bidders
                  </button>
                  <button
                    type="button"
                    className="cr-reset-btn"
                    onClick={() => setActiveTab("marketplace")}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: WORKER PORTAL                                           */}
        {/* ============================================================== */}
        {activeTab === "worker" && (
          <div className="cr-subpage-wrap">
            <div className="cr-subpage-card">
              <div className="cr-worker-header">
                <div>
                  <h2 className="cr-subpage-heading">Worker Portal · Lahore Independent Technicians</h2>
                  <p className="cr-subpage-desc">
                    Find active plumbing and electrical jobs near your service area, submit bids, and manage your bookings.
                  </p>
                </div>
                <div className="cr-worker-badge-box">
                  <span className="cr-verified-badge">✓ Manual ID Reviewed</span>
                  <span className="cr-role-pill">Independent Contractor</span>
                </div>
              </div>

              {/* Sub-tabs inside worker portal */}
              <div className="cr-worker-stats-grid">
                <div className="cr-stat-box">
                  <span className="cr-stat-num">{jobs.filter(j => j.status === "open").length}</span>
                  <span className="cr-stat-label">Jobs Open for Bidding</span>
                </div>
                <div className="cr-stat-box">
                  <span className="cr-stat-num">{bids.length}</span>
                  <span className="cr-stat-label">Active Bids Placed</span>
                </div>
                <div className="cr-stat-box">
                  <span className="cr-stat-num">PKR 0</span>
                  <span className="cr-stat-label">Platform Fees (100% Free)</span>
                </div>
              </div>

              {/* Awarded Jobs Section */}
              <h3 className="cr-section-subtitle">Active Awarded Jobs &amp; Completion Codes</h3>
              {jobs.filter(j => j.status === "awarded").length === 0 ? (
                <div className="cr-empty-box">
                  <p>You have no active awarded jobs right now. Browse open jobs in the Marketplace tab and place bids!</p>
                </div>
              ) : (
                <div className="cr-awarded-list">
                  {jobs.filter(j => j.status === "awarded").map(j => (
                    <div key={j.id} className="cr-awarded-card">
                      <div className="cr-awarded-info">
                        <h4>{j.title}</h4>
                        <p className="cr-meta-text">📍 {j.exactAddress} · 📞 Customer: {j.customerPhone}</p>
                        <p className="cr-meta-text">Agreed Price: <strong>PKR {j.awardedPrice?.toLocaleString()}</strong></p>
                      </div>
                      <div className="cr-awarded-actions">
                        <div className="cr-code-box">
                          <span>4-Digit Completion Code:</span>
                          <strong className="cr-code-display">{j.completionCode}</strong>
                        </div>
                        <button
                          className="cr-update-btn cr-btn-sm"
                          onClick={() => {
                            setJobs(jobs.map(item => item.id === j.id ? { ...item, status: "completed" } : item));
                            triggerToast("Job marked completed! Settle payment directly in cash/bank.");
                          }}
                        >
                          Confirm Finished
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Open Jobs to Bid on */}
              <h3 className="cr-section-subtitle">Nearby Jobs Ready for Your Bid</h3>
              <div className="cr-worker-jobs-list">
                {jobs.filter(j => j.status === "open").slice(0, 4).map(job => (
                  <div key={job.id} className="cr-worker-job-row" onClick={() => setSelectedJob(job)}>
                    <div className="cr-row-main">
                      <span className={`cr-icon-badge cr-icon-sm cr-icon-${job.category}`}>
                        {job.category === "plumbing" ? "🔧" : "⚡"}
                      </span>
                      <div>
                        <strong>{job.title}</strong>
                        <p>{job.area} · Budget: PKR {job.budgetMin.toLocaleString()} - {job.budgetMax.toLocaleString()}</p>
                      </div>
                    </div>
                    <button className="cr-post-pill-btn">
                      Bid Now ({job.bidsCount} bids)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: MY ACCOUNT / SIGN IN & SIGN UP                          */}
        {/* ============================================================== */}
        {activeTab === "account" && (
          <div className="cr-subpage-wrap">
            <div className="cr-subpage-card">
              <h2 className="cr-subpage-heading">My Account &amp; Profile</h2>
              {user ? (
                <div className="cr-profile-view">
                  <div className="cr-profile-badge-row">
                    <div className="cr-profile-avatar-lg">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <h3>{user.name}</h3>
                      <p className="cr-meta-text">{user.phone} · {user.area}</p>
                      <span className="cr-role-pill">
                        {user.role === "customer" ? "Customer Account" : user.role === "worker" ? "Independent Worker" : "Platform Moderator"}
                      </span>
                    </div>
                  </div>

                  <div className="cr-account-actions">
                    <button
                      className="cr-update-btn"
                      onClick={() => setShowSignupModal(true)}
                    >
                      Switch Profile or Role
                    </button>
                    <button
                      className="cr-reset-btn"
                      onClick={() => {
                        setUser(null);
                        localStorage.removeItem("kl_demo_user");
                        setShowSignupModal(true);
                        triggerToast("Logged out successfully.");
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cr-empty-box">
                  <p>You are not currently signed in.</p>
                  <button
                    className="cr-update-btn"
                    onClick={() => setShowSignupModal(true)}
                  >
                    Sign In with Phone OTP
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: ADMIN & MODERATION                                      */}
        {/* ============================================================== */}
        {activeTab === "admin" && (
          <div className="cr-subpage-wrap">
            <div className="cr-subpage-card">
              <h2 className="cr-subpage-heading">Platform Moderation &amp; Safety Dashboard</h2>
              <p className="cr-subpage-desc">
                Review flagged reports, inspect manual identity submissions, and enforce two-tier privacy standards.
              </p>

              <div className="cr-admin-stats-row">
                <div className="cr-stat-box">
                  <span className="cr-stat-num">0</span>
                  <span className="cr-stat-label">Pending User Reports</span>
                </div>
                <div className="cr-stat-box">
                  <span className="cr-stat-num">3</span>
                  <span className="cr-stat-label">Worker ID Verifications</span>
                </div>
                <div className="cr-stat-box">
                  <span className="cr-stat-num">100%</span>
                  <span className="cr-stat-label">Lahore Privacy Compliant</span>
                </div>
              </div>

              <h3 className="cr-section-subtitle">Worker Identity Document Review Queue</h3>
              <div className="cr-id-queue">
                <div className="cr-id-item">
                  <div>
                    <strong>Muhammad Rashid (Plumbing Specialist)</strong>
                    <p className="cr-meta-text">CNIC document uploaded · Model Town, Lahore</p>
                  </div>
                  <div className="cr-id-actions">
                    <button className="cr-update-btn cr-btn-sm" onClick={() => triggerToast("Worker marked as ID Reviewed!")}>
                      Approve ID
                    </button>
                    <button className="cr-reset-btn" onClick={() => triggerToast("ID verification rejected.")}>
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: TRUST & RULES                                           */}
        {/* ============================================================== */}
        {activeTab === "trust" && (
          <div className="cr-subpage-wrap">
            <div className="cr-subpage-card">
              <h2 className="cr-subpage-heading">Direct Settlement &amp; Trust Guidelines</h2>
              <div className="cr-rules-grid">
                <div className="cr-rule-box">
                  <h3>💰 Direct Settlement Only</h3>
                  <p>
                    مدد (Maddad) does not hold funds, operate escrow, or charge commission. All payments are negotiated and settled directly between the customer and the technician (via Cash or JazzCash / Nayapay / Bank transfer) upon satisfactory completion of work.
                  </p>
                </div>
                <div className="cr-rule-box">
                  <h3>🔒 Two-Tier Location Privacy</h3>
                  <p>
                    Exact home addresses, street numbers, and telephone numbers are concealed during public browsing. Only the single worker selected by the customer receives access to private contact coordinates.
                  </p>
                </div>
                <div className="cr-rule-box">
                  <h3>🔑 4-Digit Completion Verification</h3>
                  <p>
                    When a job is awarded, the platform generates a unique 4-digit completion code. When work is finished to customer satisfaction, the customer shares the code with the technician to mark the job complete.
                  </p>
                </div>
                <div className="cr-rule-box">
                  <h3>🛡️ Anti-Retaliation 7-Day Review System</h3>
                  <p>
                    Ratings and reviews are held private until both sides submit their feedback or until 7 days elapse, preventing unfair retaliatory negative feedback.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer (Matching Screenshot) */}
        <footer className="cr-footer">
          <div className="cr-footer-copy">© 2026 مدد (Maddad) · لاہور</div>
          <div className="cr-footer-links">
            <button onClick={() => setActiveTab("trust")}>Help</button>
            <button onClick={() => setActiveTab("trust")}>Safety</button>
            <button onClick={() => setActiveTab("trust")}>Privacy</button>
            <button onClick={() => triggerToast("Feedback form opened!")}>Feedback</button>
            <button onClick={() => setActiveTab("trust")}>Terms</button>
            <button onClick={() => setActiveTab("trust")}>About</button>
            <button onClick={() => setActiveTab("worker")}>Technician Hub</button>
            <button onClick={() => setActiveTab("admin")}>Moderation</button>
          </div>
        </footer>
      </div>

      {/* ============================================================== */}
      {/* INITIAL SIGN-UP & LOGIN MODAL (First screen on visit)          */}
      {/* ============================================================== */}
      {showSignupModal && (
        <div className="cr-modal-overlay animate-fade-in" onClick={() => user && setShowSignupModal(false)}>
          <div className="cr-modal-box cr-signup-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-modal-header">
              <div className="cr-logo-badge cr-logo-center cr-logo-urdu">مدد</div>
              <h2>خوش آمدید! مدد (Maddad)</h2>
              <p>Lahore&apos;s open-bid marketplace for plumbing and electrical repairs</p>
              {user && (
                <button className="cr-modal-close" onClick={() => setShowSignupModal(false)}>✕</button>
              )}
            </div>

            {/* Quick 1-Click Demo Profiles */}
            <div className="cr-quick-demo-section">
              <span className="cr-quick-title">⚡ Instant 1-Click Demo Sign-In:</span>
              <div className="cr-demo-buttons-grid">
                <button
                  type="button"
                  className="cr-demo-pill-btn"
                  onClick={() => handleQuickLogin("customer", "Ali Khan", "+923001122334", "Gulberg III")}
                >
                  👤 <strong>Ali Khan</strong> (Customer · Gulberg)
                </button>
                <button
                  type="button"
                  className="cr-demo-pill-btn"
                  onClick={() => handleQuickLogin("worker", "Tariq Mahmood", "+923331122334", "DHA Phase 5")}
                >
                  ⚡ <strong>Tariq Mahmood</strong> (Electrician · DHA)
                </button>
                <button
                  type="button"
                  className="cr-demo-pill-btn"
                  onClick={() => handleQuickLogin("worker", "Rashid Javed", "+923004567890", "Model Town")}
                >
                  🔧 <strong>Rashid Javed</strong> (Plumber · Model Town)
                </button>
                <button
                  type="button"
                  className="cr-demo-pill-btn"
                  onClick={() => handleQuickLogin("admin", "Fatima Moderator", "+923214455667", "All Lahore")}
                >
                  🛡️ <strong>Fatima</strong> (Admin Moderator)
                </button>
              </div>
            </div>

            <div className="cr-or-divider">
              <span>OR ENTER YOUR DETAILS</span>
            </div>

            {signupStep === "phone" ? (
              <form onSubmit={handleSendOtp} className="cr-signup-form">
                <div className="cr-form-row">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Usman Butt"
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    className="cr-text-input"
                  />
                </div>

                <div className="cr-form-row">
                  <label>Role</label>
                  <div className="cr-role-toggle">
                    <button
                      type="button"
                      className={`cr-role-btn ${signupRole === "customer" ? "active" : ""}`}
                      onClick={() => setSignupRole("customer")}
                    >
                      🏠 Customer (I want to post jobs)
                    </button>
                    <button
                      type="button"
                      className={`cr-role-btn ${signupRole === "worker" ? "active" : ""}`}
                      onClick={() => setSignupRole("worker")}
                    >
                      🔨 Worker (I want to bid on jobs)
                    </button>
                  </div>
                </div>

                <div className="cr-form-row">
                  <label>Pakistani Mobile Number (+92)</label>
                  <input
                    type="tel"
                    required
                    placeholder="0300 1234567"
                    value={signupPhone}
                    onChange={e => setSignupPhone(e.target.value)}
                    className="cr-text-input"
                  />
                  <small className="cr-help-text">We verify via a 6-digit SMS code.</small>
                </div>

                <button type="submit" className="cr-update-btn cr-submit-full">
                  Send 6-Digit OTP Code →
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="cr-signup-form">
                {devOtpCode && (
                  <div className="cr-otp-banner">
                    <span>DEVELOPMENT OTP CODE: <strong>{devOtpCode}</strong></span>
                    <button
                      type="button"
                      onClick={() => setSignupOtp(devOtpCode)}
                      className="cr-autofill-btn"
                    >
                      Autofill
                    </button>
                  </div>
                )}

                <div className="cr-form-row">
                  <label>Enter 6-Digit Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={signupOtp}
                    onChange={e => setSignupOtp(e.target.value)}
                    className="cr-text-input cr-otp-input"
                  />
                </div>

                <button type="submit" className="cr-update-btn cr-submit-full">
                  Verify &amp; Open Home Page →
                </button>

                <button
                  type="button"
                  className="cr-reset-btn"
                  onClick={() => setSignupStep("phone")}
                >
                  ← Back to phone input
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* JOB INSPECTION & BIDDING MODAL                                 */}
      {/* ============================================================== */}
      {selectedJob && (
        <div className="cr-modal-overlay animate-fade-in" onClick={() => setSelectedJob(null)}>
          <div className="cr-modal-box cr-job-modal" onClick={e => e.stopPropagation()}>
            <div className="cr-job-modal-header">
              <div>
                <span className={`cr-pill-tag cr-pill-${selectedJob.category}`}>
                  {selectedJob.category === "plumbing" ? "🔧 Plumbing" : "⚡ Electrical"}
                </span>
                <h2>{selectedJob.title}</h2>
                <p className="cr-meta-text">📍 {selectedJob.area} · Budget: PKR {selectedJob.budgetMin.toLocaleString()} - {selectedJob.budgetMax.toLocaleString()}</p>
              </div>
              <button className="cr-modal-close" onClick={() => setSelectedJob(null)}>✕</button>
            </div>

            {/* Two-Tier Privacy Address Banner */}
            <div className="cr-privacy-callout">
              {selectedJob.status === "awarded" ? (
                <div className="cr-privacy-unlocked">
                  <strong>🔓 Contact Unlocked (Awarded):</strong>
                  <p>📍 Exact Address: <strong>{selectedJob.exactAddress}</strong></p>
                  <p>📞 Customer Phone: <strong>{selectedJob.customerPhone}</strong></p>
                  <p>🔑 Customer Completion Code: <strong className="cr-code-highlight">{selectedJob.completionCode}</strong></p>
                </div>
              ) : (
                <div className="cr-privacy-locked">
                  <strong>🔒 Location Privacy Active:</strong>
                  <p>Exact house/street address and customer phone number are private. They will only be unlocked to the worker awarded this job.</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="cr-modal-section">
              <h3>Description</h3>
              <p className="cr-modal-desc">{selectedJob.description}</p>
            </div>

            {/* Existing Bids */}
            <div className="cr-modal-section">
              <h3>Open Bids from Independent Technicians ({bids.filter(b => b.jobId === selectedJob.id).length})</h3>
              {bids.filter(b => b.jobId === selectedJob.id).length === 0 ? (
                <p className="cr-meta-text">No bids yet on this job. Be the first technician to bid!</p>
              ) : (
                <div className="cr-bids-list">
                  {bids.filter(b => b.jobId === selectedJob.id).map(bid => (
                    <div key={bid.id} className="cr-bid-card">
                      <div className="cr-bid-header">
                        <div>
                          <strong>{bid.workerName}</strong>
                          {bid.isIdReviewed && <span className="cr-verified-badge-sm">✓ ID Reviewed</span>}
                          <span className="cr-rating-text">★ {bid.workerRating} ({bid.workerReviewsCount} reviews)</span>
                        </div>
                        <div className="cr-bid-price">
                          PKR {bid.amount.toLocaleString()}
                        </div>
                      </div>
                      <p className="cr-bid-msg">&quot;{bid.message}&quot;</p>
                      <div className="cr-bid-footer">
                        <span>ETA: {bid.eta}</span>
                        {selectedJob.status === "open" && (
                          <button
                            className="cr-post-pill-btn cr-btn-xs"
                            onClick={() => handleAwardBid(bid)}
                          >
                            Hire Technician &amp; Unlock Address
                          </button>
                        )}
                        {selectedJob.status === "awarded" && selectedJob.awardedWorkerId === bid.workerId && (
                          <span className="cr-awarded-badge">✓ Hired for this job</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Bid Form (For workers) */}
            {selectedJob.status === "open" && (
              <div className="cr-modal-section cr-bid-form-section">
                <h3>Submit an Independent Bid</h3>
                <form onSubmit={handleSubmitBid} className="cr-bid-form">
                  <div className="cr-form-grid-2">
                    <div>
                      <label>Your Price in PKR (No decimals)</label>
                      <input
                        type="number"
                        step="100"
                        required
                        value={bidAmount}
                        onChange={e => setBidAmount(Number(e.target.value))}
                        className="cr-text-input"
                      />
                    </div>
                    <div>
                      <label>When Can You Arrive?</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Within 2 hours or Today at 5 PM"
                        value={bidEta}
                        onChange={e => setBidEta(e.target.value)}
                        className="cr-text-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label>Message / Experience (Do not include phone numbers here)</label>
                    <textarea
                      rows={2}
                      placeholder="Explain your diagnostic approach, tools, or relevant experience..."
                      value={bidMessage}
                      onChange={e => setBidMessage(e.target.value)}
                      className="cr-textarea"
                    />
                  </div>
                  <button type="submit" className="cr-update-btn">
                    Submit My Bid (PKR {bidAmount.toLocaleString()})
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
