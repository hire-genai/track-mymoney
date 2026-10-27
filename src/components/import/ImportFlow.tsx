"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { PEOPLE } from "@/lib/finance-data";
import type { PersonId, TxType } from "@/lib/types";
import { useFinance } from "@/context/FinanceContext";
import styles from "./import.module.css";

export interface ImportFlowProps {
  initialPerson?: PersonId;
  embedded?: boolean;
  onClose?: () => void;
}

interface ParsedTx {
  isoDate: string;
  date: string;
  particulars: string;
  amount: number;
  type: TxType;
  category: string;
}

interface ParseResponse {
  ok?: boolean;
  reqId?: string;
  totalPages?: number;
  transactions?: ParsedTx[];
  warnings?: string[];
  debug?: string[];
  counts?: { total: number; credit: number; debit: number };
  timings?: { extractMs: number; parseMs: number; totalMs: number };
  error?: string;
  code?: string;
  detail?: string;
}

export default function ImportFlow({ initialPerson, embedded, onClose }: ImportFlowProps = {}) {
  const { pendingImportFile, setPendingImportFile } = useFinance();
  const [person, setPerson] = useState<PersonId>(initialPerson ?? "A");
  const [file, setFile] = useState<File | null>(pendingImportFile);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear any pending file from context on mount
  useEffect(() => {
    if (pendingImportFile) setPendingImportFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickFile(f: File | null) {
    setFile(f);
    setResult(null);
    setErrorMsg(null);
  }

  async function handleParse() {
    if (!file) return;
    setParsing(true);
    setResult(null);
    setErrorMsg(null);
    const t0 = performance.now();
    console.log(`[ImportFlow] parsing ${file.name} (${file.size} bytes) for person=${person}`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("person", person);
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = (await res.json()) as ParseResponse;
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[ImportFlow] response in ${elapsed}ms`, data);
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ""}` : `Failed (${res.status})`);
      } else {
        setResult(data);
        if (data.debug) {
          for (const line of data.debug) console.log(`[server] ${line}`);
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`[ImportFlow] parse error`, msg);
      setErrorMsg(`Network error: ${msg}`);
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.topHeader}>
        {embedded ? (
          <button
            type="button"
            className={styles.backLink}
            onClick={() => onClose?.()}
            style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
          >
            <Icon name="chevron-right" size={12} style={{ transform: "rotate(180deg)" }} />
            Close
          </button>
        ) : (
          <Link href="/dashboard" className={styles.backLink}>
            <Icon name="chevron-right" size={12} style={{ transform: "rotate(180deg)" }} />
            Back to dashboard
          </Link>
        )}
        <h1 className={styles.title}>Import statement</h1>
        <p className={styles.subtitle}>Upload a bank statement (PDF, CSV, or TXT).</p>
      </header>

      <section className={styles.card}>
        <div className={styles.field}>
          <div className={styles.fieldLabel}>Whose statement is this?</div>
          <div className={styles.personRow}>
            {(["A", "B"] as PersonId[]).map((pid) => {
              const p = PEOPLE[pid];
              const active = person === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  className={`${styles.personChip} ${active ? styles.personChipActive : ""}`}
                  onClick={() => setPerson(pid)}
                  style={active ? { background: p.color } : undefined}
                >
                  <span className={styles.personChipDot} style={{ background: p.color }}>
                    {p.initial.charAt(0)}
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.fieldLabel}>Pick a file</div>
          <div
            className={`${styles.dropzone} ${dragOver ? styles.dropzoneOver : ""} ${
              file ? styles.dropzoneSelected : ""
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
          >
            <div className={styles.dropIcon}>
              <Icon name="upload" size={22} />
            </div>
            {file ? (
              <div>
                <div className={styles.dropFileName}>{file.name}</div>
                <div className={styles.dropHint}>
                  {(file.size / 1024).toFixed(0)} KB · click to change
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.dropTitle}>Drop a PDF, CSV, or TXT here</div>
                <div className={styles.dropHint}>Max 10 MB</div>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div className={styles.actionsRow}>
          <Link href="/dashboard" className={styles.ghostBtn}>
            Cancel
          </Link>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!file || parsing}
            onClick={handleParse}
            title={!file ? "Pick a file first" : parsing ? "Parsing…" : "Extract transactions from file"}
          >
            {parsing ? "Parsing…" : "Extract transactions"}
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              border: "1px solid #fca5a5",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        {result && result.transactions && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                padding: "12px 14px",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              <div><strong>{result.counts?.total ?? 0}</strong> transactions</div>
              <div style={{ color: "#059669" }}>credits: {result.counts?.credit ?? 0}</div>
              <div style={{ color: "#dc2626" }}>debits: {result.counts?.debit ?? 0}</div>
              {typeof result.totalPages === "number" && <div>{result.totalPages} page(s)</div>}
              {result.timings && (
                <div style={{ color: "#64748b" }}>
                  extract {result.timings.extractMs}ms · parse {result.timings.parseMs}ms · total {result.timings.totalMs}ms
                </div>
              )}
            </div>

            {result.warnings && result.warnings.length > 0 && (
              <div
                style={{
                  padding: 10,
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: 8,
                  fontSize: 12,
                  marginBottom: 12,
                  color: "#92400e",
                }}
              >
                {result.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}

            <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Particulars</th>
                    <th style={th}>Type</th>
                    <th style={th}>Category</th>
                    <th style={{ ...th, textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transactions.slice(0, 500).map((t, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={td}>{t.isoDate}</td>
                      <td style={{ ...td, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.particulars}
                      </td>
                      <td style={{ ...td, color: t.type === "credit" ? "#059669" : "#dc2626" }}>{t.type}</td>
                      <td style={td}>{t.category}</td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.debug && (
              <details style={{ marginTop: 12, fontSize: 11 }}>
                <summary style={{ cursor: "pointer", color: "#64748b" }}>
                  Debug log ({result.debug.length} lines)
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 10,
                    background: "#0f172a",
                    color: "#e2e8f0",
                    borderRadius: 6,
                    overflow: "auto",
                    maxHeight: 240,
                    fontSize: 11,
                  }}
                >
                  {result.debug.join("\n")}
                </pre>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontWeight: 600,
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const td: React.CSSProperties = {
  padding: "6px 10px",
  color: "#1e293b",
};
