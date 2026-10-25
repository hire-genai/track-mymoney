"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFinance } from "@/context/FinanceContext";
import { PEOPLE } from "@/lib/finance-data";
import type { AuthUser } from "@/lib/types";
import Icon from "@/components/Icon";
import LoginModal from "@/components/auth/LoginModal";
import styles from "./dashboard.module.css";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "U";
}

export default function TopBar({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const { activePerson, setActivePerson, currentMonth } = useFinance();
  const [loginOpen, setLoginOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>T</div>
        <div className={styles.brandText}>
          Track-<strong>MyMoney</strong>
        </div>
      </div>

      <div className={styles.topbarRight}>
        <div className={styles.personSwitch} role="tablist" aria-label="Switch person">
          {(["A", "B"] as const).map((pid) => {
            const p = PEOPLE[pid];
            const active = activePerson === pid;
            return (
              <button
                key={pid}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.personBtn} ${active ? styles.personBtnActive : ""} ${
                  pid === "B" ? styles.personBtnPartner : ""
                }`}
                onClick={() => setActivePerson(pid)}
              >
                <span className={styles.personDot} style={{ background: p.color }}>
                  {p.initial.charAt(0)}
                </span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {user ? (
          <>
            <div className={styles.userChip} title={user.email}>
              <div className={styles.userAvatar}>{initials(user.name)}</div>
              <div className={styles.userMeta}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userSub}>{currentMonth}</span>
              </div>
            </div>

            <button
              type="button"
              className={styles.iconBtn}
              onClick={logout}
              title="Sign out"
            >
              <Icon name="logout" size={16} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.loginBtn}
            onClick={() => setLoginOpen(true)}
          >
            <Icon name="logout" size={14} style={{ transform: "scaleX(-1)" }} />
            <span>Login</span>
          </button>
        )}
      </div>
      {!user && <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />}
    </header>
  );
}
