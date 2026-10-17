"use client";

import { useFormState } from "react-dom";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { requestOtpAction, verifyOtpAction } from "../actions";
import { Submit } from "@/components/ActionForm";

export default function LoginPage() {
  const [req, requestAction] = useFormState(requestOtpAction, null);
  const [ver, verifyAction] = useFormState(verifyOtpAction, null);
  const searchParams = useSearchParams();
  const [phoneVal, setPhoneVal] = useState("");

  useEffect(() => {
    const autoPhone = searchParams.get("autoPhone");
    if (autoPhone) setPhoneVal(autoPhone);
  }, [searchParams]);

  const sent = Boolean(req?.phone);

  const fillDemo = (p: string) => {
    setPhoneVal(p);
  };

  return (
    <div style={{ maxWidth: 480, margin: "24px auto", padding: "0 12px" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: 4 }}>Sign in to Maddad</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        Enter your Pakistani mobile number. We will send a 6-digit verification code.
      </p>

      {!sent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <form action={requestAction} className="card">
            <div className="field">
              <label htmlFor="phone">Pakistani Mobile Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0300 1234567"
                value={phoneVal}
                onChange={(e) => setPhoneVal(e.target.value)}
                required
              />
              <p className="hint">Accepted formats: 0300 1234567 or +92 300 1234567.</p>
            </div>
            {req?.error && <p className="msg msg-error" role="alert">{req.error}</p>}
            <Submit className="btn btn-primary" style={{ marginTop: 4 }}>Send 6-digit Code</Submit>
          </form>

          {/* Clearly labeled Demo Pilot Accounts switcher - impossible in production */}
          {process.env.NODE_ENV !== "production" && (
            <div className="notice notice-dev" style={{ borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <strong style={{ fontSize: "0.85rem" }}>[DEMO PILOT ACCOUNTS] (Development Only)</strong>
                <span className="pill pill-demo" style={{ fontSize: "0.7rem" }}>Dev Mode</span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 10 }}>
                Click any role to autofill its demo number and sign in directly:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => fillDemo("0300 1112233")}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: "flex-start", fontSize: "0.82rem" }}
                >
                  <span>Customer: [DEMO] Tariq Customer (0300 1112233)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo("0300 4445566")}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: "flex-start", fontSize: "0.82rem" }}
                >
                  <span>Electrician: [DEMO] Rashid Electrician (0300 4445566)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo("0300 7778899")}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: "flex-start", fontSize: "0.82rem" }}
                >
                  <span>Plumber: [DEMO] Akram Plumber (0300 7778899)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo("0300 1234567")}
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: "flex-start", fontSize: "0.82rem" }}
                >
                  <span>Moderator: [DEMO] Fatima Moderator (0300 1234567)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form action={verifyAction} className="card">
          <input type="hidden" name="phone" value={req!.phone} />
          {req!.devCode && (
            <p className="notice notice-dev" role="status">
              <strong>DEVELOPMENT ONLY:</strong> No SMS was sent. Your code is <strong>{req!.devCode}</strong>.
            </p>
          )}
          <div className="field">
            <label htmlFor="code">Enter 6-digit Code for {req!.phone}</label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              defaultValue={req!.devCode || ""}
              required
            />
          </div>
          {ver?.error && <p className="msg msg-error" role="alert">{ver.error}</p>}
          <Submit className="btn btn-primary" style={{ marginTop: 4 }}>Verify &amp; Continue</Submit>
        </form>
      )}

      <p className="hint" style={{ marginTop: 18, textAlign: "center" }}>
        By signing in you agree to Maddad&apos;s <a href="/terms" style={{ color: "var(--brand-purple-text)" }}>Terms of Service</a> and <a href="/privacy" style={{ color: "var(--brand-purple-text)" }}>Privacy Notice</a>.
      </p>
    </div>
  );
}
