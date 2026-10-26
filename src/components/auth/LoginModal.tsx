"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import styles from "./login-modal.module.css";

// "email" → lookup → existing? "code" : "name" → send-otp → "code"
type Step = "email" | "name" | "code";

interface Props {
  open: boolean;
  onClose: () => void;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export default function LoginModal({ open, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [isExisting, setIsExisting] = useState<boolean | null>(null); // set after lookup
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setStep("email");
    setIsExisting(null);
    setError(null);
    setInfo(null);
    setCode("");
    setName("");
    setLoading(false);
    setResendIn(0);
    setTimeout(() => emailRef.current?.focus(), 60);
  }, [open]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // Note: no outside-click and no Escape-to-close. The modal closes only via the X button.
  if (!open) return null;

  // Step index for progress bar
  const allSteps: Step[] = isExisting === false
    ? ["email", "name", "code"]
    : ["email", "code"];
  const stepIndex = allSteps.indexOf(step);
  const totalSteps = allSteps.length;

  // ─── Handlers ───────────────────────────────────────────

  async function handleEmailContinue(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // 1. Check if user exists
      const lookupRes = await fetch("/api/auth/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const lookupData = (await lookupRes.json().catch(() => ({}))) as {
        exists?: boolean;
        error?: string;
      };
      if (!lookupRes.ok) {
        setError(lookupData.error || "Could not verify email. Try again.");
        return;
      }

      const exists = !!lookupData.exists;
      setIsExisting(exists);

      if (exists) {
        // Existing user: send OTP immediately, go to code step
        await doSendOtp();
      } else {
        // New user: ask for name first
        setStep("name");
        setTimeout(() => nameRef.current?.focus(), 50);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Send (or request) an OTP.
   * On 429 (rate-limited): a code was sent recently — move the user to the "code" step
   * so they can enter the existing code, and show a non-destructive info message. This
   * avoids showing a confusing "wait Ns" error on the email step.
   */
  async function doSendOtp() {
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        retryAfter?: number;
      };
      if (!res.ok) {
        if (res.status === 429 && data.retryAfter) {
          // Active code already exists — jump straight to code entry.
          setStep("code");
          setResendIn(data.retryAfter);
          setInfo(`A code was sent recently to ${email}. Enter it below.`);
          setTimeout(() => codeRef.current?.focus(), 60);
          return true;
        }
        setError(data.error || "Could not send code. Try again.");
        return false;
      }
      setStep("code");
      setInfo(`Code sent to ${email}`);
      setResendIn(60);
      setTimeout(() => codeRef.current?.focus(), 60);
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    }
  }

  async function handleNameContinue(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await doSendOtp();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || loading) return;
    setLoading(true);
    try {
      await doSendOtp();
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // name only sent for new users; server ignores it for existing users
        body: JSON.stringify({ email, code, name: name.trim() || undefined }),
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

  // ─── Render ──────────────────────────────────────────────

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Track-MyMoney"
    >
      <div className={styles.card}>
        {/* Header */}
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

        {/* Progress bar */}
        <div className={styles.steps}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i <= stepIndex ? styles.dotActive : ""}`}
            />
          ))}
        </div>

        {/* Step: email */}
        {step === "email" && (
          <form className={styles.form} onSubmit={handleEmailContinue}>
            <h3 className={styles.title}>Welcome back</h3>
            <p className={styles.hint}>Enter your email to continue.</p>
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
            <button
              type="submit"
              className={styles.primary}
              disabled={loading || !email.trim()}
            >
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        )}

        {/* Step: name (new users only) */}
        {step === "name" && (
          <form className={styles.form} onSubmit={handleNameContinue}>
            <h3 className={styles.title}>Create your account</h3>
            <p className={styles.hint}>
              No account for <strong>{email}</strong>.{" "}
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => { setStep("email"); setIsExisting(null); }}
              >
                Change
              </button>
            </p>
            <input
              ref={nameRef}
              className={styles.input}
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            {error && <div className={styles.error}>{error}</div>}
            <button
              type="submit"
              className={styles.primary}
              disabled={loading || !name.trim()}
            >
              {loading ? "Sending code…" : "Continue"}
            </button>
          </form>
        )}

        {/* Step: OTP code */}
        {step === "code" && (
          <form className={styles.form} onSubmit={handleVerify}>
            <h3 className={styles.title}>Enter the code</h3>
            <p className={styles.hint}>
              Sent to <strong>{maskEmail(email)}</strong>{" "}
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setStep("email");
                  setIsExisting(null);
                  setCode("");
                  setError(null);
                  setInfo(null);
                  setTimeout(() => emailRef.current?.focus(), 50);
                }}
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
                placeholder="- - - - - -"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                  if (pasted) { e.preventDefault(); setCode(pasted); }
                }}
                autoComplete="one-time-code"
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
              onClick={handleResend}
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
