"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { PEOPLE } from "@/lib/finance-data";
import type { PersonId, Transaction } from "@/lib/types";
import styles from "./dashboard.module.css";

type Range = "current" | "last2" | "last3" | "last6" | "all";
type Format = "csv" | "json";
type Scope = "me" | "both";

interface RangeOpt {
  key: Range;
  label: string;
}

const RANGE_OPTIONS: RangeOpt[] = [
  { key: "current", label: "This month" },
  { key: "last2", label: "Last 2 months" },
  { key: "last3", label: "Last 3 months" },
  { key: "last6", label: "Last 6 months" },
  { key: "all", label: "All data" },
];

function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Order months newest-first using the native Date parser (works for "Oct 2026").
function monthsNewestFirst(months: string[]): string[] {
  return [...months].sort((a, b) => new Date(`1 ${b}`).getTime() - new Date(`1 ${a}`).getTime());
}

function selectMonths(allMonths: string[], current: string, range: Range): string[] {
  const sorted = monthsNewestFirst(allMonths);
  if (range === "all") return sorted;
  if (range === "current") return [current];
  const take = range === "last2" ? 2 : range === "last3" ? 3 : 6;
  const idx = sorted.indexOf(current);
  const start = idx === -1 ? 0 : idx;
  return sorted.slice(start, start + take);
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

function toCsv(rows: Row[]): string {
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
  const lines = [header.join(",")];
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

function toJson(rows: Row[], months: string[]): string {
  return JSON.stringify(
    {
      app: "Track-MyMoney",
      exportedAt: new Date().toISOString(),
      months,
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
  const [range, setRange] = useState<Range>("current");
  const [format, setFormat] = useState<Format>("csv");
  const [scope, setScope] = useState<Scope>("me");
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

  const months = useMemo(
    () => selectMonths(allMonths, currentMonth, range),
    [allMonths, currentMonth, range],
  );

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

  const run = () => {
    const rows = collectRows(txns, people, months);
    if (rows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const scopeTag =
      people.length === 2
        ? "both"
        : slugify(PEOPLE[people[0]]?.name ?? people[0]);
    const rangeTag =
      range === "current"
        ? slugify(currentMonth)
        : range === "all"
          ? "all"
          : range;
    const base = `track-mymoney_${scopeTag}_${rangeTag}_${stamp}`;
    if (format === "csv") {
      download(`${base}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    } else {
      download(`${base}.json`, toJson(rows, months), "application/json;charset=utf-8");
    }
    setOpen(false);
  };

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
              {RANGE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`${styles.dlPill} ${range === o.key ? styles.dlPillActive : ""}`}
                  onClick={() => setRange(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
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
              disabled={previewCount === 0}
            >
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
