import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Link from "next/link";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const instant = false;

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className={styles.page}>
      {/* Left — brand story */}
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <Link href="/" className={styles.backLink}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2.5L5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to home
          </Link>

          <div className={styles.leftContent}>
            <div className={styles.leftLogo}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 15L6 8L10 11L14 5L18 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.leftBrand}>Track<em>MyMoney</em></div>

            <h2 className={styles.leftHeadline}>
              Know exactly where<br />every rupee goes.
            </h2>
            <p className={styles.leftSub}>
              Upload your bank statement, let AI categorize everything, and see your
              finances clearly — for yourself or as a couple.
            </p>

            <ul className={styles.leftFeatures}>
              {[
                "Parses PDF & CSV statements instantly",
                "AI categorizes every transaction",
                "Month-over-month trends & KPIs",
                "Couples mode with side-by-side view",
              ].map((f) => (
                <li key={f}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* mini card preview */}
          <div className={styles.leftCard} aria-hidden="true">
            <div className={styles.lcRow}>
              <div className={styles.lcDot} style={{ background: "#059669" }} />
              <span>Groceries</span>
              <strong>$984</strong>
            </div>
            <div className={styles.lcRow}>
              <div className={styles.lcDot} style={{ background: "#4f46e5" }} />
              <span>Rent</span>
              <strong>$1,800</strong>
            </div>
            <div className={styles.lcRow}>
              <div className={styles.lcDot} style={{ background: "#f59e0b" }} />
              <span>Dining</span>
              <strong>$342</strong>
            </div>
            <div className={styles.lcMeta}>
              <div className={styles.lcDone}>
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1.5 5.5l3 3 5-5" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                AI categorized
              </div>
              <span>47 transactions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className={styles.right}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h1 className={styles.title}>Sign in to your account</h1>
            <p className={styles.subtitle}>
              Enter your email and we&apos;ll send a 6-digit verification code — no password required.
            </p>
          </div>
          <LoginForm />
          <p className={styles.foot}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5L2 3v4c0 2.5 1.8 4.8 4 5.4C8.2 11.8 10 9.5 10 7V3L6 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            Secured by one-time verification code
          </p>
        </div>
      </div>
    </div>
  );
}
