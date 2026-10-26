"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import { getColumnGroups, MONTHS } from "@/lib/finance-data";
import { getSavingsSubs } from "@/lib/finance-calc";
import Icon from "@/components/Icon";
import KpiDashboard from "./KpiDashboard";
import CategoryCard from "./CategoryCard";
import InlineCoupleCompare from "./InlineCoupleCompare";
import styles from "./dashboard.module.css";

export default function MonthsTab() {
  const {
    activePerson,
    currentMonth,
    setCurrentMonth,
    goals,
    bothUploaded,
    txns,
  } = useFinance();
  const savingsSubs = useMemo(() => getSavingsSubs(goals), [goals]);
  const [col1, col2] = getColumnGroups(savingsSubs);

  // Show the rolling-recent-months window plus any extra months that actually
  // have persisted transactions (so uploads outside the default window appear).
  const visibleMonths = useMemo(() => {
    const extras = new Set<string>();
    for (const person of ["A", "B"] as const) {
      for (const [m, list] of Object.entries(txns[person] ?? {})) {
        if (list.length > 0) extras.add(m);
      }
    }
    for (const m of MONTHS) extras.add(m);
    return Array.from(extras).sort(
      (a, b) => new Date(`1 ${b}`).getTime() - new Date(`1 ${a}`).getTime(),
    );
  }, [txns]);

  return (
    <div>
      <div className={styles.subtabBar}>
        {visibleMonths.map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.subtabBtn} ${currentMonth === m ? styles.subtabBtnActive : ""}`}
            onClick={() => setCurrentMonth(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <KpiDashboard month={currentMonth} personId={activePerson} />

      <div className={styles.twoCol}>
        <div className={styles.colStack}>
          {col1.map((group) => (
            <CategoryCard
              key={group.key}
              group={group}
              month={currentMonth}
              personId={activePerson}
            />
          ))}
        </div>
        <div className={styles.colStack}>
          {col2.map((group) => (
            <CategoryCard
              key={group.key}
              group={group}
              month={currentMonth}
              personId={activePerson}
            />
          ))}
        </div>
      </div>

      {bothUploaded && <InlineCoupleCompare month={currentMonth} />}

      <div className={styles.flagNote}>
        <Icon name="info" size={14} />
        <span>
          Tap any category tag on a transaction to move it. When both partners have uploaded,
          you&apos;ll also see a side-by-side comparison below each month.
        </span>
      </div>
    </div>
  );
}
