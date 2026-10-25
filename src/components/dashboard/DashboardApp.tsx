"use client";

import { useState } from "react";
import type { AuthUser } from "@/lib/types";
import TopBar from "./TopBar";
import UploadSection from "./UploadSection";
import MonthsTab from "./MonthsTab";
import ComparisonTab from "./ComparisonTab";
import CoupleTab from "./CoupleTab";
import GoalsTab from "./GoalsTab";
import Icon, { type IconName } from "@/components/Icon";
import styles from "./dashboard.module.css";

type TabKey = "months" | "comparison" | "couple" | "goals";

const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: "months", label: "Months", icon: "calendar" },
  { key: "comparison", label: "Comparison", icon: "line-chart" },
  { key: "couple", label: "Couple", icon: "heart" },
  { key: "goals", label: "Goals", icon: "target" },
];

export default function DashboardApp({ user }: { user: AuthUser | null }) {
  const [tab, setTab] = useState<TabKey>("months");

  return (
    <div className={styles.app}>
      <TopBar user={user} />
      <UploadSection />

      <nav className={styles.tabBar} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === "months" && <MonthsTab />}
      {tab === "comparison" && <ComparisonTab />}
      {tab === "couple" && <CoupleTab />}
      {tab === "goals" && <GoalsTab />}
    </div>
  );
}
