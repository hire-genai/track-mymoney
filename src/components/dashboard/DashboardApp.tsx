"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const TAB_KEYS: readonly TabKey[] = ["months", "comparison", "couple", "goals"];

function parseTab(v: string | null): TabKey {
  return (TAB_KEYS as readonly string[]).includes(v ?? "") ? (v as TabKey) : "months";
}

export default function DashboardApp({ user }: { user: AuthUser | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = parseTab(searchParams.get("tab"));
  const [tab, setTab] = useState<TabKey>(urlTab);

  // Keep local tab state in sync with the URL so back/forward and deep links work.
  useEffect(() => {
    if (urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  const switchTab = useCallback(
    (next: TabKey) => {
      if (next === tab) return;
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "months") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    },
    [tab, router, searchParams],
  );

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
            onClick={() => switchTab(t.key)}
          >
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Mount all panes once and toggle visibility — avoids unmount/remount
          churn when switching tabs, which was making the UI feel sluggish. */}
      <div style={{ display: tab === "months" ? "block" : "none" }}>
        <MonthsTab />
      </div>
      <div style={{ display: tab === "comparison" ? "block" : "none" }}>
        <ComparisonTab />
      </div>
      <div style={{ display: tab === "couple" ? "block" : "none" }}>
        <CoupleTab />
      </div>
      <div style={{ display: tab === "goals" ? "block" : "none" }}>
        <GoalsTab />
      </div>
    </div>
  );
}
