"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CURRENT_MONTH } from "@/lib/finance-data";
import styles from "./dashboard.module.css";

interface Props {
  /** Months sorted newest-first, "Mmm YYYY" format. */
  months: string[];
  current: string;
  onChange: (m: string) => void;
}

function monthDate(m: string): Date {
  return new Date(`1 ${m}`);
}

function groupByYear(months: string[]): Array<{ year: number; months: string[] }> {
  const map = new Map<number, string[]>();
  for (const m of months) {
    const y = monthDate(m).getFullYear();
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(m);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({ year, months }));
}

export default function MonthSelector({ months, current, onChange }: Props) {
  // Responsive: narrow screens show fewer quick pills to avoid overflow.
  const [quickCount, setQuickCount] = useState(6);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setQuickCount(mq.matches ? 3 : 6);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const quick = useMemo(() => months.slice(0, quickCount), [months, quickCount]);
  const rest = useMemo(() => months.slice(quickCount), [months, quickCount]);
  // When the selected month lives in history, surface it as a pinned pill
  // (prevents duplicates with the quick list).
  const promoted = !quick.includes(current) && rest.includes(current) ? current : null;
  const grouped = useMemo(() => groupByYear(rest), [rest]);

  const pick = (m: string) => {
    onChange(m);
    setOpen(false);
  };

  return (
    <div className={styles.monthSelWrap}>
      {quick.map((m) => (
        <button
          key={m}
          type="button"
          className={`${styles.subtabBtn} ${current === m ? styles.subtabBtnActive : ""}`}
          onClick={() => onChange(m)}
          aria-pressed={current === m}
        >
          <span>{m}</span>
          {m === CURRENT_MONTH && (
            <span className={styles.monthTodayBadge} aria-label="Current month">
              Now
            </span>
          )}
        </button>
      ))}
      {promoted && (
        <button
          type="button"
          className={`${styles.subtabBtn} ${styles.subtabBtnActive}`}
          onClick={() => onChange(promoted)}
          aria-pressed
        >
          <span>{promoted}</span>
        </button>
      )}
      {rest.length > 0 && (
        <div className={styles.monthMoreWrap} ref={wrapRef}>
          <button
            type="button"
            className={`${styles.subtabBtn} ${styles.monthMoreBtn} ${open ? styles.monthMoreBtnOpen : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span>More</span>
            <span aria-hidden="true" className={styles.monthMoreCaret}>
              ▾
            </span>
          </button>
          {open && (
            <div role="menu" className={styles.monthMorePop}>
              {grouped.map(({ year, months: ms }) => (
                <div key={year} className={styles.monthMoreGroup}>
                  <div className={styles.monthMoreYear}>{year}</div>
                  <div className={styles.monthMoreGrid}>
                    {ms.map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="menuitemradio"
                        aria-checked={current === m}
                        className={`${styles.monthMoreCell} ${current === m ? styles.monthMoreCellActive : ""}`}
                        onClick={() => pick(m)}
                      >
                        {m.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
