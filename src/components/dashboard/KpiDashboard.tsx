"use client";

import { useMemo } from "react";
import { buildStatusMap, fmt, getMonthTotals } from "@/lib/finance-calc";
import type { PersonId } from "@/lib/types";
import { useFinance } from "@/context/FinanceContext";
import Icon, { type IconName } from "@/components/Icon";
import styles from "./dashboard.module.css";

interface KpiProps {
  month: string;
  personId: PersonId;
}

interface KpiCardDef {
  key: string;
  label: string;
  icon: IconName;
  color: string;
  amount: number;
  sub: string;
  extraClass?: string;
}

export default function KpiDashboard({ month, personId }: KpiProps) {
  const { txns } = useFinance();
  const txs = txns[personId]?.[month] || [];
  const totals = useMemo(() => getMonthTotals(txs), [txs]);
  const map = useMemo(() => buildStatusMap(totals), [totals]);

  const cards: KpiCardDef[] = [
    { key: "Income", label: "Income", icon: "arrow-down", color: "#059669", amount: totals.income, sub: "Net monthly", extraClass: styles.kpiValuePositive },
    { key: "Fixed", label: "Fixed", icon: "house", color: "#f59e0b", amount: totals.fixed, sub: "Target 50–60%" },
    { key: "Investments", label: "Invest", icon: "trending", color: "#4f46e5", amount: totals.invest, sub: "Target ≥10%" },
    { key: "Savings", label: "Savings", icon: "piggy", color: "#0891b2", amount: totals.savings, sub: "Target ≥5%" },
    { key: "Guilt-Free", label: "Guilt-Free", icon: "smile", color: "#db2777", amount: totals.guilt, sub: "Target ≤35%" },
  ];

  return (
    <div className={styles.kpiDashboard}>
      {cards.map((c) => {
        const st = map[c.key];
        const glow =
          st.status === "good"
            ? styles.kpiItemGood
            : st.status === "warn"
              ? styles.kpiItemWarn
              : st.status === "bad"
                ? styles.kpiItemBad
                : "";
        const badgeCls =
          st.status === "good"
            ? styles.kpiBadgeGood
            : st.status === "warn"
              ? styles.kpiBadgeWarn
              : st.status === "bad"
                ? styles.kpiBadgeBad
                : styles.kpiBadgeNeutral;
        return (
          <div key={c.key} className={`${styles.kpiItem} ${glow}`}>
            {st.pct !== null && c.key !== "Income" && (
              <span
                className={`${styles.kpiBadge} ${badgeCls}`}
                title={`Target: ${st.targetLabel}`}
              >
                {st.status === "good" ? "✓ " : st.status === "bad" ? "✕ " : ""}
                {st.label} · {st.targetLabel}
              </span>
            )}
            <div className={styles.kpiLabel}>
              <Icon name={c.icon} size={10} style={{ color: c.color }} />
              {c.label}
            </div>
            <div className={`${styles.kpiValue} ${c.extraClass || ""}`}>{fmt(c.amount)}</div>
            <div className={styles.kpiSub}>{c.sub}</div>
          </div>
        );
      })}
      <div className={styles.kpiItem}>
        <div className={styles.kpiLabel}>
          <Icon name="wallet" size={10} />
          Net Flow
        </div>
        <div
          className={`${styles.kpiValue} ${
            totals.net >= 0 ? styles.kpiValuePositive : styles.kpiValueNegative
          }`}
        >
          {totals.net >= 0 ? "+" : "-"}
          {fmt(Math.abs(totals.net))}
        </div>
        <div className={styles.kpiSub}>Income − spend</div>
      </div>
    </div>
  );
}
