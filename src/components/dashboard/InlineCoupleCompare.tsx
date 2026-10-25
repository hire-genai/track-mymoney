"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import { fmtShort, getSavingsSubs, sumSubCategoryDebit } from "@/lib/finance-calc";
import { getColumnGroups } from "@/lib/finance-data";
import Icon, { type IconName } from "@/components/Icon";
import styles from "./dashboard.module.css";

export default function InlineCoupleCompare({ month }: { month: string }) {
  const { txns, goals, openCoupleGroups, toggleCoupleGroup } = useFinance();
  const savingsSubs = useMemo(() => getSavingsSubs(goals), [goals]);
  const [col1, col2] = getColumnGroups(savingsSubs);
  const groups = [...col1, ...col2];

  const txsA = txns.A?.[month] || [];
  const txsB = txns.B?.[month] || [];

  function totalFor(subs: string[], list: typeof txsA): number {
    let total = 0;
    for (const sub of subs) {
      total += sumSubCategoryDebit(list.filter((t) => t.category === sub), sub);
    }
    return total;
  }

  return (
    <div className={styles.sideCard} style={{ marginTop: "1rem" }}>
      <div className={`${styles.sideHeader} ${styles.sideHeaderStatic}`}>
        <div className={styles.sideHeaderLeft}>
          <div
            className={styles.sideIcon}
            style={{ background: "linear-gradient(135deg, #9333ea, #7c3aed)" }}
          >
            <Icon name="heart" size={14} />
          </div>
          <div className={styles.sideHeaderTitle}>
            <span className={styles.sideHeaderMain}>
              You vs Partner — {month}
            </span>
            <span className={styles.sideHeaderSub}>Sub-category side-by-side</span>
          </div>
        </div>
        <div className={styles.sideHeaderRight}>
          <span className={`${styles.sideTotal} ${styles.sideTotalA}`}>
            <span className={`${styles.sideDot} ${styles.sideDotA}`} />
            You
          </span>
          <span className={`${styles.sideTotal} ${styles.sideTotalB}`}>
            <span className={`${styles.sideDot} ${styles.sideDotB}`} />
            Partner
          </span>
        </div>
      </div>
      <div className={styles.sideBody} style={{ display: "block" }}>
        {groups.map((group) => {
          const key = `inline-${month}-${group.key}`;
          const isOpen = openCoupleGroups.has(key);
          const totalA = totalFor(group.subs, txsA);
          const totalB = totalFor(group.subs, txsB);

          return (
            <div
              key={key}
              className={styles.sideCard}
              style={{ marginTop: "0.5rem", borderColor: "var(--border-soft)" }}
            >
              <div
                className={styles.sideHeader}
                style={{ padding: "0.6rem 0.7rem", background: "#fafbfd" }}
                onClick={() => toggleCoupleGroup(key)}
              >
                <div className={styles.sideHeaderLeft}>
                  <div className={`${styles.caret} ${isOpen ? styles.caretOpen : ""}`}>
                    <Icon name="chevron-right" size={10} />
                  </div>
                  <div
                    className={styles.sideIcon}
                    style={{
                      background: `linear-gradient(135deg, ${group.color}, ${group.color}cc)`,
                      width: 26,
                      height: 26,
                    }}
                  >
                    <Icon name={group.icon as IconName} size={12} />
                  </div>
                  <div className={styles.sideHeaderTitle}>
                    <span
                      className={styles.sideHeaderMain}
                      style={{ fontSize: "0.76rem" }}
                    >
                      {group.label}
                    </span>
                  </div>
                </div>
                <div className={styles.sideHeaderRight}>
                  <span className={`${styles.sideTotal} ${styles.sideTotalA}`}>
                    <span className={`${styles.sideDot} ${styles.sideDotA}`} />
                    {fmtShort(totalA)}
                  </span>
                  <span className={`${styles.sideTotal} ${styles.sideTotalB}`}>
                    <span className={`${styles.sideDot} ${styles.sideDotB}`} />
                    {fmtShort(totalB)}
                  </span>
                </div>
              </div>
              {isOpen && (
                <div className={styles.sideBody} style={{ padding: "0 0.6rem 0.6rem 0.6rem" }}>
                  {group.subs.map((sub) => {
                    const subA = txsA.filter((t) => t.category === sub);
                    const subB = txsB.filter((t) => t.category === sub);
                    if (subA.length === 0 && subB.length === 0) return null;
                    const sumA = sumSubCategoryDebit(subA, sub);
                    const sumB = sumSubCategoryDebit(subB, sub);
                    return (
                      <div key={sub} className={styles.sideSubBlock}>
                        <div className={styles.sideSubTitle}>
                          <span>{sub}</span>
                          <span className={styles.sideSubTotals}>
                            <span className={`${styles.sideSubTotal} ${styles.sideSubTotalA}`}>
                              {fmtShort(sumA)}
                            </span>
                            <span className={`${styles.sideSubTotal} ${styles.sideSubTotalB}`}>
                              {fmtShort(sumB)}
                            </span>
                          </span>
                        </div>
                        <div className={styles.sideSubCols}>
                          <div className={`${styles.sideSubCol} ${styles.sideSubColA}`}>
                            {subA.length === 0 ? (
                              <div className={styles.sideEmpty}>No transactions</div>
                            ) : (
                              subA.map((tx) => (
                                <div key={tx.id} className={styles.sideTx}>
                                  <span className={styles.sideTxName} title={tx.particulars}>
                                    {tx.particulars}
                                  </span>
                                  <span className={styles.sideTxDate}>{tx.date}</span>
                                  <span
                                    className={`${styles.sideTxAmt} ${
                                      tx.type === "credit" ? styles.sideTxAmtCredit : ""
                                    }`}
                                  >
                                    {tx.type === "credit" ? "+" : ""}
                                    {fmtShort(tx.amount)}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                          <div className={`${styles.sideSubCol} ${styles.sideSubColB}`}>
                            {subB.length === 0 ? (
                              <div className={styles.sideEmpty}>No transactions</div>
                            ) : (
                              subB.map((tx) => (
                                <div key={tx.id} className={styles.sideTx}>
                                  <span className={styles.sideTxName} title={tx.particulars}>
                                    {tx.particulars}
                                  </span>
                                  <span className={styles.sideTxDate}>{tx.date}</span>
                                  <span
                                    className={`${styles.sideTxAmt} ${
                                      tx.type === "credit" ? styles.sideTxAmtCredit : ""
                                    }`}
                                  >
                                    {tx.type === "credit" ? "+" : ""}
                                    {fmtShort(tx.amount)}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
