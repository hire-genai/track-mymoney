"use client";

import { useRef, useState } from "react";
import { fmt } from "@/lib/finance-calc";
import { useFinance } from "@/context/FinanceContext";
import Icon from "@/components/Icon";
import type { PersonId, Transaction } from "@/lib/types";
import styles from "./dashboard.module.css";
import CategoryPicker from "./CategoryPicker";

interface Props {
  tx: Transaction;
  month: string;
  personId: PersonId;
}

export default function TransactionRow({ tx, month, personId }: Props) {
  const { taggedIds, toggleTag } = useFinance();
  const [pickerOpen, setPickerOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isTagged = taggedIds.has(tx.id);
  const credit = tx.type === "credit";
  const displayAmt = credit ? `+${fmt(tx.amount)}` : fmt(tx.amount);
  const shortCat = tx.category.length > 14 ? `${tx.category.slice(0, 12)}…` : tx.category;

  return (
    <div className={styles.txRow}>
      <div className={styles.txLeft}>
        <span className={styles.txName} title={tx.particulars}>
          {tx.particulars}
        </span>
        <span className={styles.txDate}>{tx.date}</span>
      </div>
      <div className={styles.txRight}>
        <span className={`${styles.txAmt} ${credit ? styles.txAmtCredit : ""}`}>
          {displayAmt}
        </span>
        <button
          ref={anchorRef}
          type="button"
          className={styles.catPickerToggle}
          title="Move category"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
        >
          <Icon name="folder" size={10} />
          <span>{shortCat}</span>
        </button>
        <button
          type="button"
          className={`${styles.txTagBtn} ${isTagged ? styles.txTagBtnActive : ""}`}
          title="Flag"
          onClick={(e) => {
            e.stopPropagation();
            toggleTag(tx.id);
          }}
        >
          <Icon name="flag" size={10} />
        </button>
      </div>
      {pickerOpen && anchorRef.current && (
        <CategoryPicker
          anchor={anchorRef.current}
          txId={tx.id}
          month={month}
          personId={personId}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
