import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const instant = false;

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>T</div>
          <div className={styles.brandText}>Track-MyMoney</div>
        </div>
        <h1 className={styles.title}>Sign in to your account</h1>
        <p className={styles.subtitle}>
          We&apos;ll email you a 6-digit code — no password required.
        </p>
        <LoginForm />
      </div>
      <p className={styles.foot}>Secure sign-in by one-time code</p>
    </div>
  );
}
