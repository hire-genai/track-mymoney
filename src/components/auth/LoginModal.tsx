"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import styles from "./login-modal.module.css";

type Step = "name" | "email" | "code";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("name");
    setError(null);
    setInfo(null);
    setCode("");
    setLoading(false);
    setResendIn(0);
    setTimeout(() => nameRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function goEmail(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setStep("email");
    setTimeout(() => emailRef.current?.focus(), 50);
  }

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
      setTimeout(() => codeRef.current?.focus(), 60);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6) return;
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
      onClose();
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const stepIndex = step === "name" ? 0 : step === "email" ? 1 : 2;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.brand}>
            <div className={styles.mark}>T</div>
            <span>Track-MyMoney</span>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className={styles.steps}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`${styles.dot} ${i <= stepIndex ? styles.dotActive : ""}`}
            />
          ))}
        </div>

        {step === "name" && (
          <form className={styles.form} onSubmit={goEmail}>
            <h3 className={styles.title}>What&apos;s your name?</h3>
            <input
              ref={nameRef}
              className={styles.input}
              type="text"
              placeholder="e.g. Dheeraj Yadav"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            <button
              type="submit"
              className={styles.primary}
              disabled={!name.trim()}
            >
              Continue
            </button>
          </form>
        )}

        {step === "email" && (
          <form className={styles.form} onSubmit={sendOtp}>
            <h3 className={styles.title}>Your email</h3>
            <p className={styles.hint}>We&apos;ll send a 6-digit code.</p>
            <input
              ref={emailRef}
              className={styles.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.row}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => setStep("name")}
              >
                Back
              </button>
              <button
                type="submit"
                className={styles.primary}
                disabled={loading || !email}
              >
                {loading ? "Sending…" : "Send code"}
              </button>
            </div>
          </form>
        )}

        {step === "code" && (
          <form className={styles.form} onSubmit={verifyOtp}>
            <h3 className={styles.title}>Enter the code</h3>
            <p className={styles.hint}>
              Sent to <strong>{email}</strong>{" "}
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setStep("email")}
              >
                Change
              </button>
            </p>
            <div className={styles.codeRow}>
              <input
                ref={codeRef}
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="------"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
              />
              <button
                type="submit"
                className={styles.verifyBtn}
                disabled={loading || code.length !== 6}
              >
                {loading ? "…" : "Verify"}
              </button>
            </div>
            {info && !error && <div className={styles.info}>{info}</div>}
            {error && <div className={styles.error}>{error}</div>}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => sendOtp()}
              disabled={resendIn > 0 || loading}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
