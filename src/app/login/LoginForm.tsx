"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

type Step = "email" | "code";

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not send code. Try again.");
        return;
      }
      setStep("code");
      setInfo(`Code sent to ${email}`);
      setResendIn(30);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, name }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Verification failed.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "email") {
    return (
      <form className={styles.form} onSubmit={sendOtp}>
        <label className={styles.label}>Full name</label>
        <input
          className={styles.input}
          type="text"
          placeholder="e.g. Dheeraj Yadav"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <label className={styles.label}>Email address</label>
        <input
          className={styles.input}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
        {error && <div className={styles.error}>{error}</div>}
        <button
          type="submit"
          className={styles.primary}
          disabled={loading || !email}
        >
          {loading ? "Sending…" : "Send verification code"}
        </button>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={verifyOtp}>
      <div className={styles.returnChip}>
        <span>{email}</span>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => {
            setStep("email");
            setCode("");
            setError(null);
            setInfo(null);
          }}
        >
          Change
        </button>
      </div>
      <label className={styles.label}>6-digit code</label>
      <input
        className={`${styles.input} ${styles.otpInput}`}
        type="text"
        inputMode="numeric"
        maxLength={6}
        pattern="[0-9]{6}"
        placeholder="••••••"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        required
        autoFocus
      />
      {info && !error && <div className={styles.info}>{info}</div>}
      {error && <div className={styles.error}>{error}</div>}
      <button
        type="submit"
        className={styles.primary}
        disabled={loading || code.length !== 6}
      >
        {loading ? "Verifying…" : "Verify & continue"}
      </button>
      <button
        type="button"
        className={styles.linkBtn}
        onClick={() => sendOtp()}
        disabled={resendIn > 0 || loading}
      >
        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
      </button>
    </form>
  );
}
