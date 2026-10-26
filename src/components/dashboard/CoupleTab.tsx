"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import { getColumnGroups, PEOPLE } from "@/lib/finance-data";
import {
  fmt,
  fmtShort,
  getMonthTotals,
  getSavingsSubs,
  sumSubCategoryDebit,
} from "@/lib/finance-calc";
import Icon, { type IconName } from "@/components/Icon";
import type { MonthSummary, PersonId } from "@/lib/types";
import styles from "./dashboard.module.css";

export default function CoupleTab() {
  const {
    txns,
    goals,
    openCoupleGroups,
    toggleCoupleGroup,
    currentMonth,
    uploadedPersons,
    simulateUpload,
    authenticated,
    requestImportFor,
  } = useFinance();

  // Authenticated: delegate to UploadSection's native file picker so the OS
  // dialog opens just like clicking the main upload area. Unauthenticated
  // landing: use the demo seed (no backend).
  const startUpload = (id: PersonId) => {
    if (authenticated) requestImportFor(id);
    else simulateUpload(id);
  };

  const savingsSubs = useMemo(() => getSavingsSubs(goals), [goals]);
  const [col1, col2] = getColumnGroups(savingsSubs);
  const groups = [...col1, ...col2];

  const aUp = uploadedPersons.A;
  const bUp = uploadedPersons.B;

  if (!aUp && !bUp) {
    return (
      <div className={styles.emptyCard}>
        <div className={styles.emptyEmoji}>👫</div>
        <h3>
          <Icon name="heart" size={18} /> Couple Mode
        </h3>
        <p>
          Upload <strong>both partners&apos;</strong> bank statements to unlock side-by-side
          comparison.
        </p>
        <div className={styles.emptyCta}>
          <button className={styles.btnPrimary} onClick={() => startUpload("A")}>
            <Icon name="upload" size={14} /> Upload You
          </button>
          <button className={styles.btnPartner} onClick={() => startUpload("B")}>
            <Icon name="upload" size={14} /> Upload Partner
          </button>
        </div>
      </div>
    );
  }

  if (!aUp || !bUp) {
    const missing: PersonId = !aUp ? "A" : "B";
    const p = PEOPLE[missing];
    return (
      <div className={styles.emptyCard}>
        <div className={styles.emptyEmoji}>📄</div>
        <h3>
          <Icon name="heart" size={18} /> Almost there!
        </h3>
        <p>
          Need <strong>{p.name}&apos;s</strong> statement to unlock couple comparison.
        </p>
        <div className={styles.emptyCta}>
          <button
            className={missing === "A" ? styles.btnPrimary : styles.btnPartner}
            onClick={() => startUpload(missing)}
          >
            <Icon name="upload" size={14} /> Upload {p.name}
          </button>
        </div>
      </div>
    );
  }

  const tA = getMonthTotals(txns.A?.[currentMonth] || []);
  const tB = getMonthTotals(txns.B?.[currentMonth] || []);

  const tips: Array<{ text: React.ReactNode }> = [];
  if (Math.abs(tA.guilt - tB.guilt) > 500) {
    const big = tA.guilt > tB.guilt ? PEOPLE.A.name : PEOPLE.B.name;
    const small = tA.guilt > tB.guilt ? PEOPLE.B.name : PEOPLE.A.name;
    tips.push({
      text: (
        <>
          <strong>{big}</strong> spends {fmtShort(Math.abs(tA.guilt - tB.guilt))} more on guilt-free
          than {small}. Try a no-spend week together!
        </>
      ),
    });
  }
  if (Math.abs(tA.fixed - tB.fixed) > 2000) {
    const big = tA.fixed > tB.fixed ? PEOPLE.A.name : PEOPLE.B.name;
    tips.push({
      text: (
        <>
          <strong>{big}</strong>&apos;s fixed costs are higher. Review utilities, subscriptions, and
          insurance together.
        </>
      ),
    });
  }
  if (tA.savings > tB.savings && tA.savings > 0) {
    tips.push({
      text: (
        <>
          <strong>{PEOPLE.A.name}</strong> is saving more. Partner can match pace to accelerate
          shared goals.
        </>
      ),
    });
  } else if (tB.savings > tA.savings && tB.savings > 0) {
    tips.push({
      text: (
        <>
          <strong>{PEOPLE.B.name}</strong> is saving more. Great momentum — consider pooling{" "}
          {fmtShort(tB.savings * 0.2)} into a shared goal.
        </>
      ),
    });
  }
  if (tA.net < 0)
    tips.push({
      text: (
        <>
          <strong>{PEOPLE.A.name}</strong> has negative net flow this month. Review discretionary
          spending.
        </>
      ),
    });
  if (tB.net < 0)
    tips.push({
      text: (
        <>
          <strong>{PEOPLE.B.name}</strong> has negative net flow this month. Review discretionary
          spending.
        </>
      ),
    });
  if (tips.length === 0)
    tips.push({ text: <>Both partners are within healthy ranges this month. Keep it up!</> });

  function personSummary(personId: PersonId, totals: MonthSummary) {
    const p = PEOPLE[personId];
    const savingsRate =
      totals.income > 0 ? Math.round(((totals.invest + totals.savings) / totals.income) * 100) : 0;
    return (
      <div
        className={styles.personSummary}
        style={{ ["--person-color" as string]: p.color }}
      >
        <div className={styles.psHeader}>
          <div className={styles.psAvatar} style={{ background: p.bg }}>
            {p.initial}
          </div>
          <div>
            <div className={styles.psName}>{p.name}</div>
            <div className={styles.psRole}>{currentMonth}</div>
          </div>
        </div>
        <div className={styles.psTotal}>{fmt(totals.income)}</div>
        <div className={styles.psSub}>Net income this month</div>
        <div className={styles.psGrid}>
          <div>
            <div className={styles.pmLabel}>Spent</div>
            <div className={`${styles.pmValue} ${styles.pmBad}`}>
              {fmt(totals.fixed + totals.guilt)}
            </div>
          </div>
          <div>
            <div className={styles.pmLabel}>Saved</div>
            <div className={`${styles.pmValue} ${styles.pmGood}`}>
              {fmt(totals.invest + totals.savings)}
            </div>
          </div>
          <div>
            <div className={styles.pmLabel}>Savings rate</div>
            <div
              className={`${styles.pmValue} ${
                savingsRate >= 20
                  ? styles.pmGood
                  : savingsRate >= 10
                    ? ""
                    : styles.pmBad
              }`}
            >
              {savingsRate}%
            </div>
          </div>
          <div>
            <div className={styles.pmLabel}>Net flow</div>
            <div
              className={`${styles.pmValue} ${totals.net >= 0 ? styles.pmGood : styles.pmBad}`}
            >
              {totals.net >= 0 ? "+" : "-"}
              {fmtShort(Math.abs(totals.net))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      <div className={styles.coupleHero}>
        <div className={styles.heroContent}>
          <div>
            <h2>Couple comparison</h2>
            <p>
              See how you and your partner are doing side-by-side for {currentMonth}. Expand any
              category to compare every sub-category and transaction.
            </p>
          </div>
          <div className={styles.coupleVersus}>
            <div>
              <div className={styles.cpAvatar} style={{ background: PEOPLE.A.bg }}>
                {PEOPLE.A.initial}
              </div>
              <div className={styles.cpName}>{PEOPLE.A.name}</div>
            </div>
            <div className={styles.vs}>VS</div>
            <div>
              <div className={styles.cpAvatar} style={{ background: PEOPLE.B.bg }}>
                {PEOPLE.B.initial}
              </div>
              <div className={styles.cpName}>{PEOPLE.B.name}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.coupleSummary}>
        {personSummary("A", tA)}
        {personSummary("B", tB)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {groups.map((group) => {
          const key = `couple-${group.key}`;
          const isOpen = openCoupleGroups.has(key);
          const txsA = txns.A?.[currentMonth] || [];
          const txsB = txns.B?.[currentMonth] || [];
          let totalA = 0;
          let totalB = 0;
          for (const sub of group.subs) {
            totalA += sumSubCategoryDebit(
              txsA.filter((t) => t.category === sub),
              sub,
            );
            totalB += sumSubCategoryDebit(
              txsB.filter((t) => t.category === sub),
              sub,
            );
          }

          return (
            <div key={key} className={styles.sideCard}>
              <div className={styles.sideHeader} onClick={() => toggleCoupleGroup(key)}>
                <div className={styles.sideHeaderLeft}>
                  <div className={`${styles.caret} ${isOpen ? styles.caretOpen : ""}`}>
                    <Icon name="chevron-right" size={10} />
                  </div>
                  <div
                    className={styles.sideIcon}
                    style={{
                      background: `linear-gradient(135deg, ${group.color}, ${group.color}cc)`,
                    }}
                  >
                    <Icon name={group.icon as IconName} size={14} />
                  </div>
                  <div className={styles.sideHeaderTitle}>
                    <span className={styles.sideHeaderMain}>{group.label}</span>
                    <span className={styles.sideHeaderSub}>
                      {group.subs.length} sub-categories
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
                <div className={styles.sideBody}>
                  {(() => {
                    const blocks: React.ReactNode[] = [];
                    for (const sub of group.subs) {
                      const subA = txsA.filter((t) => t.category === sub);
                      const subB = txsB.filter((t) => t.category === sub);
                      if (subA.length === 0 && subB.length === 0) continue;
                      const sumA = sumSubCategoryDebit(subA, sub);
                      const sumB = sumSubCategoryDebit(subB, sub);
                      blocks.push(
                        <div key={sub} className={styles.sideSubBlock}>
                          <div className={styles.sideSubTitle}>
                            <span>{sub}</span>
                            <span className={styles.sideSubTotals}>
                              <span
                                className={`${styles.sideSubTotal} ${styles.sideSubTotalA}`}
                              >
                                {fmtShort(sumA)}
                              </span>
                              <span
                                className={`${styles.sideSubTotal} ${styles.sideSubTotalB}`}
                              >
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
                        </div>,
                      );
                    }
                    if (blocks.length === 0) {
                      return (
                        <div className={styles.sideEmpty} style={{ padding: "0.5rem" }}>
                          No transactions in this category
                        </div>
                      );
                    }
                    return blocks;
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.coupleActions}>
        <h4>
          <Icon name="zap" size={14} /> Action tips for you two
        </h4>
        <ul className={styles.coupleActionsList}>
          {tips.map((tip, i) => (
            <li key={i}>
              <Icon name="arrow-right" size={14} />
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
