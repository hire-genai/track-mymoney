"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getAllCategories } from "@/lib/finance-data";
import { useFinance } from "@/context/FinanceContext";
import Icon from "@/components/Icon";
import type { PersonId } from "@/lib/types";
import styles from "./dashboard.module.css";
import { getSavingsSubs } from "@/lib/finance-calc";

interface Props {
  anchor: HTMLElement;
  txId: string;
  month: string;
  personId: PersonId;
  onClose: () => void;
}

export default function CategoryPicker({ anchor, txId, month, personId, onClose }: Props) {
  const { txns, goals, moveTransaction } = useFinance();
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 240 });

  const tx = txns[personId]?.[month]?.find((t) => t.id === txId);
  const categories = getAllCategories(getSavingsSubs(goals));

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 240;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
    if (left < 10) left = 10;
    const menuHeight = Math.min(320, menu.scrollHeight || 320);
    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 6;
      if (top < 10) top = 10;
    }
    setPos({ left, top, width: menuWidth });
  }, [anchor]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      const target = e.target as Node;
      if (menuRef.current.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    }
    function onScroll(e: Event) {
      // Ignore scrolls that originate inside the popup (list scrollbar / wheel).
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      onClose();
    }
    // Use pointerdown so scrollbar interactions on the popup don't trigger an outside-click close.
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose]);

  if (!tx) return null;

  return (
    <div
      ref={menuRef}
      className={styles.popover}
      style={{ left: pos.left, top: pos.top, width: pos.width }}
      role="menu"
    >
      {categories.map((group) => (
        <div key={group.group}>
          <div className={styles.popoverHeader}>{group.group}</div>
          {group.subs.map((sub) => {
            const isSelected = sub === tx.category;
            return (
              <div
                key={sub}
                role="menuitem"
                className={`${styles.popoverItem} ${isSelected ? styles.popoverItemSelected : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  moveTransaction(txId, sub, month, personId);
                  onClose();
                }}
              >
                {isSelected ? (
                  <Icon name="check" size={12} />
                ) : sub.startsWith("Goal: ") ? (
                  <Icon name="target" size={12} />
                ) : (
                  <Icon name="folder" size={12} />
                )}
                <span>{sub}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
