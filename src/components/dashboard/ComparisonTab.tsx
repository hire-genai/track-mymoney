"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import { MONTHS, PEOPLE, pastMonths } from "@/lib/finance-data";
import {
  buildStatusMap,
  fmt,
  fmtShort,
  getMonthTotals,
} from "@/lib/finance-calc";
import type { IconName } from "@/components/Icon";
import Icon from "@/components/Icon";
import styles from "./dashboard.module.css";

interface GraphDef {
  key: keyof ReturnType<typeof getMonthTotals>;
  label: string;
  color: string;
  icon: IconName;
  better: "higher" | "lower";
  groupKey: string;
}

const GRAPH_DEFS: GraphDef[] = [
  { key: "income", label: "Income", color: "#059669", icon: "arrow-down", better: "higher", groupKey: "Income" },
  { key: "fixed", label: "Fixed Costs", color: "#f59e0b", icon: "house", better: "lower", groupKey: "Fixed" },
  { key: "invest", label: "Investments", color: "#4f46e5", icon: "trending", better: "higher", groupKey: "Investments" },
  { key: "savings", label: "Savings", color: "#0891b2", icon: "piggy", better: "higher", groupKey: "Savings" },
  { key: "guilt", label: "Guilt-Free", color: "#db2777", icon: "smile", better: "lower", groupKey: "Guilt-Free" },
];

export default function ComparisonTab() {
  const { activePerson, currentMonth, txns, goals } = useFinance();
  const person = PEOPLE[activePerson];
  const curTxs = txns[activePerson]?.[currentMonth] || [];
  const cur = useMemo(() => getMonthTotals(curTxs), [curTxs]);
  const curStatus = useMemo(() => buildStatusMap(cur), [cur]);

  const prevMonth = currentMonth === "Sep 2026" ? "Aug 2026" : "Jul 2026";
  const prev = pastMonths[activePerson]?.[prevMonth] || {
    income: 0,
    fixed: 0,
    invest: 0,
    savings: 0,
    guilt: 0,
    net: 0,
  };
  const prevNet = prev.income - (prev.fixed + prev.invest + prev.savings + prev.guilt);
  const netDiff = cur.net - prevNet;

  const monthData = useMemo(
    () =>
      MONTHS.map((m) => {
        if (m === "Sep 2026") return { month: m, ...getMonthTotals(txns[activePerson]?.[m] || []) };
        return {
          month: m,
          ...(pastMonths[activePerson]?.[m] || { income: 0, fixed: 0, invest: 0, savings: 0, guilt: 0, net: 0 }),
        };
      }),
    [txns, activePerson],
  );
  const orderedMonths = [...monthData].reverse();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <div className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <div>
            <h2>{person.name}&apos;s multi-month progress</h2>
            <p>
              Compare every category across <strong>{MONTHS.length} months</strong>. Badges show
              current % vs target ratio.
            </p>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <div className={styles.heroStatValue}>{fmtShort(cur.income)}</div>
              <div className={styles.heroStatLabel}>Income</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatValue}>{fmtShort(cur.net)}</div>
              <div className={styles.heroStatLabel}>Net saved</div>
            </div>
            <div className={styles.heroStat}>
              <div className={styles.heroStatValue}>{goals.length}</div>
              <div className={styles.heroStatLabel}>Goals</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.graphCard}>
        <h3>
          <Icon name="bar-chart" size={16} /> Category comparison — all months
        </h3>
        <div className={styles.graphGrid}>
          {GRAPH_DEFS.map((def) => {
            const values = orderedMonths.map((md) => md[def.key] || 0);
            const maxVal = Math.max(...values, 1);
            const latest = values[values.length - 1];
            const previous = values[values.length - 2] || latest;
            const diff = latest - previous;
            const pctDiff = previous !== 0 ? (diff / previous) * 100 : 0;
            const isPositive =
              def.better === "lower" ? diff <= 0 : diff >= 0;
            const deltaClass = isPositive ? "up" : "down";
            const deltaText = `${isPositive ? "▲" : "▼"} ${Math.abs(Math.round(pctDiff))}%`;
            const st = curStatus[def.groupKey];
            const badgeCls =
              st.status === "good"
                ? styles.kpiBadgeGood
                : st.status === "warn"
                  ? styles.kpiBadgeWarn
                  : st.status === "bad"
                    ? styles.kpiBadgeBad
                    : styles.kpiBadgeNeutral;

            return (
              <div key={def.key as string} className={styles.miniGraph}>
                <div className={styles.mgHeader}>
                  <div className={styles.mgTitle}>
                    <span className={styles.mgDot} style={{ background: def.color }} />
                    <Icon name={def.icon} size={12} style={{ color: def.color }} />
                    {def.label}
                  </div>
                  {st.pct !== null && (
                    <span
                      className={`${styles.kpiBadge} ${badgeCls}`}
                      style={{ position: "static" }}
                      title={`Target: ${st.targetLabel} · ${deltaText}`}
                    >
                      {st.status === "good" ? "✓ " : st.status === "bad" ? "✕ " : ""}
                      {st.label} · {st.targetLabel}
                    </span>
                  )}
                  {st.pct === null && (
                    <span
                      className={`${styles.kpiBadge} ${
                        deltaClass === "up" ? styles.kpiBadgeGood : styles.kpiBadgeBad
                      }`}
                      style={{ position: "static" }}
                    >
                      {deltaText}
                    </span>
                  )}
                </div>
                <div className={styles.mgBars}>
                  {orderedMonths.map((md) => {
                    const val = md[def.key] || 0;
                    const pct = (val / maxVal) * 100;
                    const isCurrent = md.month === currentMonth;
                    const barHeight = Math.max(4, pct * 0.85);
                    return (
                      <div key={md.month} className={styles.mgBarCol}>
                        <div className={styles.mgVal}>{fmtShort(val)}</div>
                        <div
                          className={`${styles.mgBar} ${isCurrent ? styles.mgBarCurrent : ""}`}
                          style={{
                            height: `${barHeight}%`,
                            background: isCurrent ? def.color : `${def.color}80`,
                          }}
                        />
                        <div className={styles.mgMonth}>{md.month.split(" ")[0]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.insightBanner}>
        <div className={styles.insightIcon}>
          <Icon name="lightbulb" size={16} />
        </div>
        <div className={styles.insightText}>
          {netDiff >= 0 ? (
            <>
              <strong>Great progress!</strong> {person.name}&apos;s net cash flow improved by{" "}
              <strong>{fmt(netDiff)}</strong> vs {prevMonth}.
            </>
          ) : (
            <>
              <strong>Heads up!</strong> {person.name}&apos;s net cash flow dropped by{" "}
              <strong>{fmt(Math.abs(netDiff))}</strong> vs {prevMonth}. Review{" "}
              <strong>Guilt-Free</strong> spending ({fmt(cur.guilt)}).
            </>
          )}
        </div>
      </div>
    </div>
  );
}
