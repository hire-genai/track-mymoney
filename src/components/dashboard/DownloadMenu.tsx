"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { PEOPLE } from "@/lib/finance-data";
import type { PersonId, Transaction } from "@/lib/types";
import styles from "./dashboard.module.css";

type Mode = "current" | "custom";
type Format = "csv" | "json";
type Scope = "me" | "both";

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Order months newest-first using the native Date parser (works for "Oct 2026").
function monthsNewestFirst(months: string[]): string[] {
  return [...months].sort((a, b) => new Date(`1 ${b}`).getTime() - new Date(`1 ${a}`).getTime());
}

/** "Oct 2026" → "2026-10" (for <input type="month">). */
function monthLabelToInput(m: string): string {
  const d = new Date(`1 ${m}`);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}`;
}

/** "2026-10" → numeric key 202610 for range comparison. */
function inputKey(ym: string): number | null {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return null;
  return y * 100 + m;
}

/** "Oct 2026" → 202610. */
function monthKey(label: string): number | null {
  const d = new Date(`1 ${label}`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function slugify(s: string): string {
  return s.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();
}

interface Row {
  person: string;
  month: string;
  date: string;
  particulars: string;
  type: "credit" | "debit";
  amount: number;
  category: string;
  primaryCategory: string;
}

function collectRows(
  txns: Record<PersonId, Record<string, Transaction[]>>,
  people: PersonId[],
  months: string[],
): Row[] {
  const rows: Row[] = [];
  for (const p of people) {
    const perMonth = txns[p] ?? {};
    for (const m of months) {
      const list = perMonth[m] ?? [];
      for (const tx of list) {
        rows.push({
          person: PEOPLE[p]?.name ?? p,
          month: m,
          date: tx.date,
          particulars: tx.particulars,
          type: tx.type,
          amount: tx.amount,
          category: tx.category,
          primaryCategory: tx.primaryCategory ?? "",
        });
      }
    }
  }
  return rows;
}

interface Totals {
  income: number;
  fixed: number;
  investments: number;
  savings: number;
  guiltFree: number;
  netFlow: number;
  byCategory: Record<string, number>;
}

function computeTotals(rows: Row[]): Totals {
  const t: Totals = {
    income: 0,
    fixed: 0,
    investments: 0,
    savings: 0,
    guiltFree: 0,
    netFlow: 0,
    byCategory: {},
  };
  for (const r of rows) {
    const signed = r.type === "credit" ? r.amount : -r.amount;
    t.netFlow += signed;
    t.byCategory[r.category] = (t.byCategory[r.category] ?? 0) + r.amount;
    switch (r.primaryCategory) {
      case "Income":
        t.income += r.amount;
        break;
      case "Fixed":
        t.fixed += r.amount;
        break;
      case "Investments":
        t.investments += r.amount;
        break;
      case "Savings":
        t.savings += r.amount;
        break;
      case "Guilt-Free":
        t.guiltFree += r.amount;
        break;
    }
  }
  return t;
}

function toCsv(rows: Row[], meta: { rangeLabel: string; totals: Totals }): string {
  const lines: string[] = [];
  lines.push(`# Track-MyMoney export — ${meta.rangeLabel}`);
  lines.push(
    `# totals: income=${meta.totals.income} fixed=${meta.totals.fixed} investments=${meta.totals.investments} savings=${meta.totals.savings} guilt_free=${meta.totals.guiltFree} net_flow=${meta.totals.netFlow}`,
  );
  const header = [
    "person",
    "month",
    "date",
    "particulars",
    "type",
    "amount",
    "category",
    "primary_category",
  ];
  lines.push(header.join(","));
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.person),
        csvEscape(r.month),
        csvEscape(r.date),
        csvEscape(r.particulars),
        csvEscape(r.type),
        csvEscape(r.amount),
        csvEscape(r.category),
        csvEscape(r.primaryCategory),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

function toJson(
  rows: Row[],
  months: string[],
  meta: { rangeLabel: string; from?: string; to?: string; totals: Totals },
): string {
  return JSON.stringify(
    {
      app: "Track-MyMoney",
      exportedAt: new Date().toISOString(),
      range: meta.rangeLabel,
      from: meta.from,
      to: meta.to,
      months,
      totals: meta.totals,
      rowCount: rows.length,
      transactions: rows,
    },
    null,
    2,
  );
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DownloadMenu() {
  const { txns, activePerson, currentMonth, bothUploaded } = useFinance();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("current");
  const [format, setFormat] = useState<Format>("csv");
  const [scope, setScope] = useState<Scope>("me");
  const [fromYM, setFromYM] = useState<string>(() => monthLabelToInput(currentMonth));
  const [toYM, setToYM] = useState<string>(() => monthLabelToInput(currentMonth));
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const allMonths = useMemo(() => {
    const s = new Set<string>();
    for (const p of ["A", "B"] as const) {
      for (const m of Object.keys(txns[p] ?? {})) s.add(m);
    }
    return Array.from(s);
  }, [txns]);

  const fromKey = inputKey(fromYM);
  const toKey = inputKey(toYM);
  const rangeInvalid = mode === "custom" && (!fromKey || !toKey || fromKey > toKey);

  const months = useMemo(() => {
    if (mode === "current") return [currentMonth];
    if (rangeInvalid || fromKey == null || toKey == null) return [];
    return monthsNewestFirst(
      allMonths.filter((m) => {
        const k = monthKey(m);
        return k != null && k >= fromKey && k <= toKey;
      }),
    );
  }, [mode, currentMonth, allMonths, fromKey, toKey, rangeInvalid]);

  const people = useMemo<PersonId[]>(
    () => (bothUploaded && scope === "both" ? ["A", "B"] : [activePerson]),
    [bothUploaded, scope, activePerson],
  );

  const previewCount = useMemo(() => {
    let n = 0;
    for (const p of people) {
      const perMonth = txns[p] ?? {};
      for (const m of months) n += (perMonth[m] ?? []).length;
    }
    return n;
  }, [txns, people, months]);

  const rangeLabel =
    mode === "current"
      ? currentMonth
      : fromYM && toYM
        ? fromYM === toYM
          ? fromYM
          : `${fromYM} to ${toYM}`
        : "custom";

  const run = () => {
    if (rangeInvalid) return;
    const rows = collectRows(txns, people, months);
    if (rows.length === 0) return;
    const totals = computeTotals(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const scopeTag =
      people.length === 2 ? "both" : slugify(PEOPLE[people[0]]?.name ?? people[0]);
    const rangeTag =
      mode === "current" ? slugify(currentMonth) : `${fromYM}_to_${toYM}`;
    const base = `track-mymoney_${scopeTag}_${rangeTag}_${stamp}`;
    const meta = { rangeLabel, from: mode === "custom" ? fromYM : undefined, to: mode === "custom" ? toYM : undefined, totals };
    if (format === "csv") {
      download(`${base}.csv`, toCsv(rows, meta), "text/csv;charset=utf-8");
    } else {
      download(`${base}.json`, toJson(rows, months, meta), "application/json;charset=utf-8");
    }
    setOpen(false);
  };

  const disabled = previewCount === 0 || rangeInvalid;

  return (
    <div className={styles.dlWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.dlBtn}
        onClick={() => setOpen((v) => !v)}
        aria-label="Download transactions"
        title="Download transactions"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Download</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Download transactions" className={styles.dlPop}>
          <div className={styles.dlArrow} />
          <div className={styles.dlTitle}>Export transactions</div>

          <div className={styles.dlGroup}>
            <div className={styles.dlLabel}>Range</div>
            <div className={styles.dlPills}>
              <button
                type="button"
                className={`${styles.dlPill} ${mode === "current" ? styles.dlPillActive : ""}`}
                onClick={() => setMode("current")}
              >
                Selected month ({currentMonth})
              </button>
              <button
                type="button"
                className={`${styles.dlPill} ${mode === "custom" ? styles.dlPillActive : ""}`}
                onClick={() => setMode("custom")}
              >
                Custom range
              </button>
            </div>
            {mode === "custom" && (
              <div className={styles.dlRange}>
                <label className={styles.dlRangeField}>
                  <span>From</span>
                  <input
                    type="month"
                    value={fromYM}
                    max={toYM || undefined}
                    onChange={(e) => setFromYM(e.target.value)}
                    className={styles.dlRangeInput}
                  />
                </label>
                <label className={styles.dlRangeField}>
                  <span>To</span>
                  <input
                    type="month"
                    value={toYM}
                    min={fromYM || undefined}
                    onChange={(e) => setToYM(e.target.value)}
                    className={styles.dlRangeInput}
                  />
                </label>
                {rangeInvalid && (
                  <div className={styles.dlError}>From date must be on or before To date.</div>
                )}
              </div>
            )}
          </div>

          {bothUploaded && (
            <div className={styles.dlGroup}>
              <div className={styles.dlLabel}>Who</div>
              <div className={styles.dlPills}>
                <button
                  type="button"
                  className={`${styles.dlPill} ${scope === "me" ? styles.dlPillActive : ""}`}
                  onClick={() => setScope("me")}
                >
                  {PEOPLE[activePerson]?.name ?? "Me"}
                </button>
                <button
                  type="button"
                  className={`${styles.dlPill} ${scope === "both" ? styles.dlPillActive : ""}`}
                  onClick={() => setScope("both")}
                >
                  Both of us
                </button>
              </div>
            </div>
          )}

          <div className={styles.dlGroup}>
            <div className={styles.dlLabel}>Format</div>
            <div className={styles.dlPills}>
              <button
                type="button"
                className={`${styles.dlPill} ${format === "csv" ? styles.dlPillActive : ""}`}
                onClick={() => setFormat("csv")}
              >
                CSV
              </button>
              <button
                type="button"
                className={`${styles.dlPill} ${format === "json" ? styles.dlPillActive : ""}`}
                onClick={() => setFormat("json")}
              >
                JSON
              </button>
            </div>
          </div>

          <div className={styles.dlFooter}>
            <span className={styles.dlPreview}>
              {previewCount.toLocaleString()} txn{previewCount === 1 ? "" : "s"} · {months.length} month{months.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className={styles.dlDownload}
              onClick={run}
              disabled={disabled}
            >
              Download Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
