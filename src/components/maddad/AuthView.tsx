"use client";

import React, { useState, useTransition } from "react";
import {
  IconPhone,
  IconShield,
  IconCheck,
  IconArrowRight,
  IconAlertCircle,
  IconLogOut,
  IconUser,
  IconWrench,
  IconZap,
  IconMapPin,
} from "../icons";
import { AppUser } from "./types";
import {
  requestOtpAction,
  signUpAction,
  verifyOtpAction,
  logoutAction,
} from "@/app/actions";

interface AuthViewProps {
  currentUser: AppUser | null;
  initialMode?: "signup" | "signin";
  onNavigateMarketplace: () => void;
  showToast: (msg: string) => void;
}

const LAHORE_AREAS = [
  "Gulberg",
  "DHA Defence",
  "Cantt",
  "Johar Town",
  "Model Town",
  "Bahria Town",
  "Wapda Town",
  "Faisal Town",
  "Garden Town",
  "Allama Iqbal Town",
  "Shadman",
  "Cavalry Ground",
  "Askari",
  "Samanabad",
  "Township",
];

export function AuthView({
  currentUser,
  initialMode = "signup",
  onNavigateMarketplace,
  showToast,
}: AuthViewProps) {
  const [isPending, startTransition] = useTransition();

  // Mode: "signup" or "signin"
  const [mode, setMode] = useState<"signup" | "signin">(initialMode);

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"customer" | "worker">("customer");
  const [trade, setTrade] = useState<"plumbing" | "electrical" | "both">("plumbing");
  const [area, setArea] = useState<string>("Gulberg");
  const [agreedTerms, setAgreedTerms] = useState(true);

  // OTP Verification state
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Switch to Sign In section
  const handleGoToSignIn = () => {
    setMode("signin");
    setOtpSent(false);
    setCode("");
    setFormError(null);
  };

  // Switch to Sign Up section
  const handleGoToSignUp = () => {
    setMode("signup");
    setOtpSent(false);
    setCode("");
    setFormError(null);
  };

  // Handle Sign Up Submit
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!phone.trim()) {
      setFormError("Please enter your Pakistani mobile number.");
      return;
    }
    if (!agreedTerms) {
      setFormError("Please acknowledge the operating terms to continue.");
      return;
    }

    setBusy(true);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("phone", phone.trim());
    fd.set("role", role);
    fd.set("trade", trade);
    fd.set("area", area);

    const res = await signUpAction(null, fd);
    setBusy(false);

    if (res?.error) {
      setFormError(res.error);
    } else {
      setOtpSent(true);
      if (res?.devCode) {
        setDevCode(res.devCode);
      }
      showToast(res?.ok || "Verification code dispatched via SMS.");
    }
  };

  // Handle Sign In Submit
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!phone.trim()) {
      setFormError("Please enter your Pakistani mobile number.");
      return;
    }

    setBusy(true);
    const fd = new FormData();
    fd.set("phone", phone.trim());

    const res = await requestOtpAction(null, fd);
    setBusy(false);

    if (res?.error) {
      setFormError(res.error);
    } else {
      setOtpSent(true);
      if (res?.devCode) {
        setDevCode(res.devCode);
      }
      showToast(res?.ok || "Verification code dispatched via SMS.");
    }
  };

  // Handle OTP Verification Submit
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim() || code.length < 6) {
      setFormError("Please enter the 6-digit verification code.");
      return;
    }

    setBusy(true);
    const fd = new FormData();
    fd.set("phone", phone.trim());
    fd.set("code", code.trim());
    if (mode === "signup") {
      fd.set("name", name.trim());
      fd.set("role", role);
      fd.set("trade", trade);
      fd.set("area", area);
    }

    const res = await verifyOtpAction(null, fd);
    setBusy(false);

    if (res?.error) {
      setFormError(res.error);
    } else {
      showToast(mode === "signup" ? "Account created successfully!" : "Signed in successfully!");
      window.location.reload();
    }
  };

  // Handle Sign Out
  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
      window.location.reload();
    });
  };

  return (
    <div style={{ maxWidth: 580, margin: "24px auto", width: "100%", padding: "0 14px" }}>
      {/* Active Session Card if user is already signed in */}
      {currentUser && (
        <div
          className="plate"
          style={{
            marginBottom: 20,
            borderColor: "rgba(16, 185, 129, 0.4)",
            background:
              "linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 17, 23, 0.95) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--emerald-400)",
                    boxShadow: "0 0 8px var(--emerald-400)",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--emerald-300)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Active Session
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-1)", marginTop: 2 }}>
                {currentUser.display_name || "Maddad User"}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-3)", fontFamily: "monospace" }}>
                {currentUser.phone} · Role: {currentUser.is_worker ? "Technician (کاریگر)" : "Customer (گاہک)"}
                {currentUser.is_admin ? " · Moderator" : ""}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onNavigateMarketplace} className="btn btn-secondary btn-sm">
                Go to Marketplace
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--rose-400)" }}
              >
                <IconLogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Authentication Card */}
      <div className="plate-bolted">
        {/* Brand Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--violet-600) 0%, var(--violet-800) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "1.25rem",
              color: "#fff",
              boxShadow: "var(--glow-violet)",
              border: "1px solid var(--violet-400)",
            }}
          >
            مدد
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "var(--text-1)" }}>
              {mode === "signup" ? "Create an Account" : "Sign In to Maddad"}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--violet-300)" }}>
              {mode === "signup" ? "نیا اکاؤنٹ بنائیں" : "اپنے اکاؤنٹ میں لاگ ان کریں"}
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {!otpSent && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              background: "var(--ink-0)",
              padding: 4,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--graphite-700)",
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              onClick={handleGoToSignUp}
              style={{
                padding: "9px 12px",
                borderRadius: "calc(var(--radius-sm) - 2px)",
                border: "none",
                background: mode === "signup" ? "var(--violet-600)" : "transparent",
                color: mode === "signup" ? "#ffffff" : "var(--text-3)",
                fontWeight: mode === "signup" ? 700 : 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
            >
              Sign Up (رجسٹریشن)
            </button>
            <button
              type="button"
              onClick={handleGoToSignIn}
              style={{
                padding: "9px 12px",
                borderRadius: "calc(var(--radius-sm) - 2px)",
                border: "none",
                background: mode === "signin" ? "var(--violet-600)" : "transparent",
                color: mode === "signin" ? "#ffffff" : "var(--text-3)",
                fontWeight: mode === "signin" ? 700 : 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                transition: "var(--transition-fast)",
              }}
            >
              Sign In (لاگ ان)
            </button>
          </div>
        )}

        {/* Section 1: OTP Verification Form (Active when code is dispatched) */}
        {otpSent ? (
          <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                color: "var(--emerald-300)",
                lineHeight: 1.5,
              }}
            >
              A 6-digit verification code was sent to <strong>{phone}</strong>.
            </div>

            {devCode && (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px dashed var(--amber-400)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8rem",
                  color: "var(--amber-300)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Development verification code: <strong>{devCode}</strong></span>
                <button
                  type="button"
                  onClick={() => setCode(devCode)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--amber-300)", padding: "2px 8px", fontSize: "0.75rem" }}
                >
                  Autofill
                </button>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-code-input"
                style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
              >
                Enter 6-Digit SMS Code:
              </label>
              <input
                id="auth-code-input"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                style={{
                  width: "100%",
                  background: "var(--ink-0)",
                  border: "1px solid var(--graphite-600)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  color: "var(--text-1)",
                  fontSize: "1.3rem",
                  letterSpacing: "6px",
                  textAlign: "center",
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>

            {formError && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid var(--rose-500)",
                  color: "var(--rose-300)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconAlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setCode("");
                  setDevCode(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                Change Number
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: "center" }}
              >
                <IconCheck size={16} />
                <span>{busy ? "Verifying..." : mode === "signup" ? "Verify & Register" : "Verify & Sign In"}</span>
              </button>
            </div>
          </form>
        ) : mode === "signup" ? (
          /* Section 2: Real Sign Up Form */
          <form onSubmit={handleSignUpSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Full Name */}
            <div>
              <label
                htmlFor="signup-name-input"
                style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
              >
                Full Name (پورا نام):
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-name-input"
                  type="text"
                  placeholder="e.g. Muhammad Usman"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    background: "var(--ink-0)",
                    border: "1px solid var(--graphite-600)",
                    borderRadius: "var(--radius-sm)",
                    padding: "11px 14px 11px 40px",
                    color: "var(--text-1)",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-3)",
                    display: "flex",
                  }}
                >
                  <IconUser size={16} />
                </span>
              </div>
            </div>

            {/* Mobile Number */}
            <div>
              <label
                htmlFor="signup-phone-input"
                style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
              >
                Pakistani Mobile Number (موبائل نمبر):
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signup-phone-input"
                  type="tel"
                  placeholder="0300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    background: "var(--ink-0)",
                    border: "1px solid var(--graphite-600)",
                    borderRadius: "var(--radius-sm)",
                    padding: "11px 14px 11px 40px",
                    color: "var(--text-1)",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-3)",
                    display: "flex",
                  }}
                >
                  <IconPhone size={16} />
                </span>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-3)", marginTop: 4 }}>
                Used for SMS verification and direct contact upon hiring.
              </div>
            </div>

            {/* Account Type Selection */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>
                I Want to Join As (اکاؤنٹ کی قسم):
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* Customer card */}
                <button
                  type="button"
                  onClick={() => setRole("customer")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "left",
                    padding: "12px 14px",
                    background: role === "customer" ? "rgba(124, 58, 237, 0.15)" : "var(--ink-0)",
                    border: role === "customer" ? "1px solid var(--violet-400)" : "1px solid var(--graphite-700)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    transition: "var(--transition-fast)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: role === "customer" ? "var(--violet-200)" : "var(--text-1)" }}>
                      Customer (گاہک)
                    </span>
                    <input
                      type="radio"
                      checked={role === "customer"}
                      readOnly
                      style={{ accentColor: "var(--violet-600)" }}
                    />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 4, lineHeight: 1.3 }}>
                    Post home repair jobs and compare technician bids.
                  </div>
                </button>

                {/* Technician card */}
                <button
                  type="button"
                  onClick={() => setRole("worker")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "left",
                    padding: "12px 14px",
                    background: role === "worker" ? "rgba(124, 58, 237, 0.15)" : "var(--ink-0)",
                    border: role === "worker" ? "1px solid var(--violet-400)" : "1px solid var(--graphite-700)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    transition: "var(--transition-fast)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: role === "worker" ? "var(--violet-200)" : "var(--text-1)" }}>
                      Technician (کاریگر)
                    </span>
                    <input
                      type="radio"
                      checked={role === "worker"}
                      readOnly
                      style={{ accentColor: "var(--violet-600)" }}
                    />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 4, lineHeight: 1.3 }}>
                    Receive local Lahore job alerts and submit price bids.
                  </div>
                </button>
              </div>
            </div>

            {/* Additional Fields for Technician */}
            {role === "worker" && (
              <div
                style={{
                  background: "var(--ink-0)",
                  padding: 14,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--graphite-700)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}>
                    Primary Skill / Trade (مہارت):
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setTrade("plumbing")}
                      className={`btn btn-sm ${trade === "plumbing" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: "0.78rem" }}
                    >
                      <IconWrench size={13} />
                      <span>Plumber</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrade("electrical")}
                      className={`btn btn-sm ${trade === "electrical" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: "0.78rem" }}
                    >
                      <IconZap size={13} />
                      <span>Electrician</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrade("both")}
                      className={`btn btn-sm ${trade === "both" ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: "0.78rem" }}
                    >
                      <span>Both</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="worker-signup-area"
                    style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
                  >
                    Base Service Area (مرکزی علاقہ):
                  </label>
                  <select
                    id="worker-signup-area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--ink-1)",
                      border: "1px solid var(--graphite-600)",
                      borderRadius: "var(--radius-sm)",
                      padding: "8px 12px",
                      color: "var(--text-1)",
                      fontSize: "0.85rem",
                    }}
                  >
                    {LAHORE_AREAS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Terms checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                style={{ accentColor: "var(--violet-600)", marginTop: 3, width: 16, height: 16 }}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--text-3)", lineHeight: 1.4 }}>
                I understand that Maddad is an open bulletin board. Payments are settled directly with no escrow or platform guarantee.
              </span>
            </label>

            {formError && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid var(--rose-500)",
                  color: "var(--rose-300)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconAlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }}
            >
              <span>{busy ? "Processing..." : "Create Account & Send Code (رجسٹر کریں)"}</span>
              <IconArrowRight size={16} />
            </button>

            {/* Sign In Button Link to Switch to Sign In Section */}
            <div
              style={{
                marginTop: 8,
                paddingTop: 16,
                borderTop: "1px solid var(--graphite-800)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "var(--text-3)" }}>
                Already have an account?
              </span>
              <button
                type="button"
                onClick={handleGoToSignIn}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.82rem" }}
              >
                <span>Sign In to Your Account (لاگ ان کریں)</span>
                <IconArrowRight size={14} />
              </button>
            </div>
          </form>
        ) : (
          /* Section 3: Real Sign In Form */
          <form onSubmit={handleSignInSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                htmlFor="signin-phone-input"
                style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 6 }}
              >
                Pakistani Mobile Number (موبائل نمبر):
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="signin-phone-input"
                  type="tel"
                  placeholder="0300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: "100%",
                    background: "var(--ink-0)",
                    border: "1px solid var(--graphite-600)",
                    borderRadius: "var(--radius-sm)",
                    padding: "11px 14px 11px 40px",
                    color: "var(--text-1)",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-3)",
                    display: "flex",
                  }}
                >
                  <IconPhone size={16} />
                </span>
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-3)", marginTop: 4 }}>
                Enter your 11-digit mobile number to receive a 6-digit SMS verification code.
              </div>
            </div>

            {formError && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.12)",
                  border: "1px solid var(--rose-500)",
                  color: "var(--rose-300)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.82rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <IconAlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px" }}
            >
              <span>{busy ? "Sending Code..." : "Send Verification Code (کوڈ حاصل کریں)"}</span>
              <IconArrowRight size={16} />
            </button>

            {/* Sign Up Button Link to Switch to Sign Up Section */}
            <div
              style={{
                marginTop: 8,
                paddingTop: 16,
                borderTop: "1px solid var(--graphite-800)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "0.85rem", color: "var(--text-3)" }}>
                Don&apos;t have an account yet?
              </span>
              <button
                type="button"
                onClick={handleGoToSignUp}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.82rem" }}
              >
                <span>Create an Account (نیا اکاؤنٹ)</span>
                <IconArrowRight size={14} />
              </button>
            </div>
          </form>
        )}

        {/* Guest Browse Link */}
        <div style={{ marginTop: 18, textAlign: "center", borderTop: "1px solid var(--graphite-800)", paddingTop: 14 }}>
          <button
            type="button"
            onClick={onNavigateMarketplace}
            className="btn btn-ghost"
            style={{ fontSize: "0.85rem", color: "var(--text-2)" }}
          >
            <span>Or browse jobs as a guest</span>
            <IconArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
