"use client";

import { useMemo } from "react";
import {
  calcGroupTotal,
  evalPctStatus,
  fmt,
  getMonthTotals,
  sumSubCategory,
} from "@/lib/finance-calc";
import type { GroupDef } from "@/lib/finance-data";
import { useFinance } from "@/context/FinanceContext";
import type { PersonId } from "@/lib/types";
import Icon, { type IconName } from "@/components/Icon";
import TransactionRow from "./TransactionRow";
import styles from "./dashboard.module.css";

interface Props {
  group: GroupDef;
  month: string;
  personId: PersonId;
}

export default function CategoryCard({ group, month, personId }: Props) {
  const { txns, openCategories, toggleCategory, goals } = useFinance();
  const txs = txns[personId]?.[month] || [];
  const isOpen = openCategories.has(group.key);
  const groupTotal = useMemo(() => calcGroupTotal(group.subs, txs), [group.subs, txs]);
  const totals = useMemo(() => getMonthTotals(txs), [txs]);
  const st = evalPctStatus(group.key, Math.abs(groupTotal), totals.income);

  const glowCls =
    st.status === "good"
      ? styles.catCardGood
      : st.status === "warn"
        ? styles.catCardWarn
        : st.status === "bad"
          ? styles.catCardBad
          : "";

  const pillCls =
    st.status === "good"
      ? styles.catPctPillGood
      : st.status === "warn"
        ? styles.catPctPillWarn
        : st.status === "bad"
          ? styles.catPctPillBad
          : styles.catPctPillNeutral;

  const pillIcon: IconName =
    st.status === "good"
      ? "check"
      : st.status === "bad"
        ? "x"
        : st.status === "warn"
          ? "triangle-alert"
          : "minus";

  return (
    <div className={`${styles.catCard} ${glowCls}`}>
      <div
        className={styles.catHeader}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button")) return;
          toggleCategory(group.key);
        }}
      >
        <div className={styles.catHeaderLeft}>
          <div className={`${styles.caret} ${isOpen ? styles.caretOpen : ""}`}>
            <Icon name="chevron-right" size={10} />
          </div>
          <div
            className={styles.catIcon}
            style={{ background: `linear-gradient(135deg, ${group.color}, ${group.color}cc)` }}
          >
            <Icon name={group.icon as IconName} size={14} />
          </div>
          <div className={styles.catTitle}>
            <span className={styles.catTitleMain}>{group.label}</span>
            <span className={styles.catTitleSub}>{group.subs.length} subs</span>
          </div>
        </div>
        <div className={styles.catHeaderRight}>
          {st.targetLabel && st.targetLabel !== "—" && (
            <span className={styles.catPctTarget}>Target {st.targetLabel}</span>
          )}
          {st.pct !== null && (
            <span className={`${styles.catPctPill} ${pillCls}`} title={`Target: ${st.targetLabel}`}>
              <Icon name={pillIcon} size={9} />
              {st.label}
            </span>
          )}
          <span
            className={`${styles.catTotal} ${group.key === "Income" ? styles.catTotalCredit : ""}`}
          >
            {fmt(groupTotal)}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className={styles.catBody}>
          {group.subs.map((sub) => {
            const subTxs = txs.filter((t) => t.category === sub);
            const subTotal = sumSubCategory(subTxs, sub);
            const show = subTxs.length > 0;
            const isGoal = sub.startsWith("Goal: ");
            const goalObj = isGoal ? goals.find((g) => g.subCat === sub) : null;
            return (
              <div
                key={sub}
                className={`${styles.subBlock} ${isGoal ? styles.subBlockGoal : ""}`}
              >
                <div className={styles.subTitle}>
                  <span className={styles.subTitleLeft}>
                    {goalObj && (
                      <span className={styles.goalDot} style={{ background: goalObj.color }} />
                    )}
                    {goalObj && <Icon name={goalObj.icon as IconName} size={10} />}
                    <span>{sub}</span>
                  </span>
                  <span
                    className={`${styles.subTotal} ${subTotal >= 0 ? styles.subTotalCredit : ""}`}
                  >
                    {show ? fmt(subTotal) : "—"}
                  </span>
                </div>
                {subTxs.length === 0 ? (
                  <div className={styles.emptyNote}>
                    {isGoal ? "Tag a transaction here to fund this goal" : "No transactions"}
                  </div>
                ) : (
                  subTxs.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} month={month} personId={personId} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
