"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { PEOPLE } from "@/lib/finance-data";
import type { PersonId } from "@/lib/types";
import { useFinance } from "@/context/FinanceContext";
import styles from "./import.module.css";

type Step = "upload" | "review" | "done";

interface ParsedRow {
  date: string;
  isoDate: string;
  particulars: string;
  amount: number;
  type: "credit" | "debit";
  category: string;
  confidence: number;
  reason: string;
  balance: number | null;
  needsReview: boolean;
}

interface ReconciliationReport {
  totals: { debits: number; credits: number; net: number; count: number };
  reviewFlags: { lowConfidence: number; needsReview: number };
  balance: {
    first: number | null;
    last: number | null;
    walkOk: boolean | null;
    firstMismatchIndex: number | null;
  };
  categoryBreakdown: Array<{ category: string; count: number; total: number }>;
}

interface ParseResponse {
  ok: true;
  filename: string;
  mime: string;
  pages: number | null;
  person: PersonId;
  total: number;
  transactions: ParsedRow[];
  monthsSeen: string[];
  duplicates: Array<{ month: string; count: number }>;
  categories: string[];
  modelUsed: string;
  attemptedModels: string[];
  reconciliation: ReconciliationReport;
}

interface ParseError {
  error?: string;
  code?: string;
  attemptedModels?: string[];
}

export interface ImportFlowProps {
  /** Preselect a person (bypasses the picker UI if provided). */
  initialPerson?: PersonId;
  /** Render as an embedded panel (no "Back to dashboard" link, uses onClose for Close). */
  embedded?: boolean;
  /** Called when the user asks to close/finish the embedded importer. */
  onClose?: () => void;
}

export default function ImportFlow({ initialPerson, embedded, onClose }: ImportFlowProps = {}) {
  const router = useRouter();
  const { pendingImportFile, setPendingImportFile } = useFinance();
  const [step, setStep] = useState<Step>("upload");
  const [person, setPerson] = useState<PersonId>(initialPerson ?? "A");
  const [file, setFile] = useState<File | null>(pendingImportFile);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoParsedRef = useRef(false);

  async function uploadAndParse() {
    if (!file) return;
    setError(null);
    setErrorCode(null);
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("person", person);
      const res = await fetch("/api/import/parse", { method: "POST", body: form });
      const raw = (await res.json().catch(() => ({}))) as ParseResponse | ParseError;
      if (!res.ok || !("ok" in raw)) {
        const err = raw as ParseError;
        setError(err.error || "Could not parse file");
        setErrorCode(err.code || null);
        return;
      }
      setParsed(raw);
      setRows(raw.transactions);
      setStep("review");
    } catch {
      setError("Network error during upload");
    } finally {
      setParsing(false);
    }
  }

  async function commit() {
    if (!parsed || rows.length === 0) return;
    setError(null);
    setErrorCode(null);
    setCommitting(true);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: parsed.person,
          filename: parsed.filename,
          mime: parsed.mime,
          transactions: rows,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as
        | { ok: true; inserted: number; skipped: number }
        | { error?: string };
      if (!res.ok || !("ok" in data)) {
        setError((data as { error?: string }).error || "Could not save transactions");
        return;
      }
      setResult({ inserted: data.inserted, skipped: data.skipped });
      setStep("done");
      router.refresh();
    } catch {
      setError("Network error while saving");
    } finally {
      setCommitting(false);
    }
  }

  function pickFile(f: File | null) {
    setFile(f);
    setError(null);
    setErrorCode(null);
  }

  useEffect(() => {
    if (autoParsedRef.current) return;
    if (!pendingImportFile) return;
    autoParsedRef.current = true;
    setPendingImportFile(null);
    void uploadAndParse();
    // uploadAndParse closes over the file state we initialized from pendingImportFile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRow(idx: number, patch: Partial<ParsedRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function deleteRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
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
        <p className={styles.subtitle}>
          Upload a bank statement — a free AI model reads it, you review every row before anything is saved.
        </p>
      </header>

      <nav className={styles.stepper} aria-label="Import steps">
        {(["upload", "review", "done"] as Step[]).map((s, i) => {
          const idx = (["upload", "review", "done"] as Step[]).indexOf(step);
          const isActive = s === step;
          const isDone = i < idx;
          return (
            <div key={s} className={styles.stepItem}>
              <span
                className={`${styles.stepDot} ${isActive ? styles.stepDotActive : ""} ${
                  isDone ? styles.stepDotDone : ""
                }`}
              >
                {isDone ? <Icon name="check" size={10} /> : i + 1}
              </span>
              <span className={styles.stepLabel}>
                {s === "upload" ? "Upload" : s === "review" ? "Review" : "Done"}
              </span>
            </div>
          );
        })}
      </nav>

      {step === "upload" && (
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
                    <span
                      className={styles.personChipDot}
                      style={{ background: p.color }}
                    >
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
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
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
                  <div className={styles.dropHint}>
                    Max 10 MB · parsed locally, categorized by free AI
                  </div>
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

          {error && (
            <div className={styles.error}>
              {error}
              {errorCode === "ALL_MODELS_FAILED" && (
                <>
                  {" "}
                  <button
                    type="button"
                    className={styles.inlineRetry}
                    onClick={uploadAndParse}
                    disabled={parsing}
                  >
                    Retry with a different free model
                  </button>
                </>
              )}
            </div>
          )}

          <div className={styles.actionsRow}>
            <Link href="/dashboard" className={styles.ghostBtn}>
              Cancel
            </Link>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={uploadAndParse}
              disabled={!file || parsing}
            >
              {parsing ? "Reading your statement…" : "Extract transactions"}
            </button>
          </div>
        </section>
      )}

      {step === "review" && parsed && (
        <section className={styles.card}>
          <ReconciliationPanel report={parsed.reconciliation} modelUsed={parsed.modelUsed} />

          <div className={styles.reviewHead}>
            <div>
              <div className={styles.reviewTitle}>
                {rows.length} transaction{rows.length === 1 ? "" : "s"} extracted
              </div>
              <div className={styles.reviewSub}>
                From <strong>{parsed.filename}</strong>
                {parsed.monthsSeen.length > 0 && (
                  <>
                    {" · "}Months: {parsed.monthsSeen.join(", ")}
                  </>
                )}
              </div>
            </div>
          </div>

          {parsed.duplicates.length > 0 && (
            <div className={styles.warnBanner}>
              <Icon name="triangle-alert" size={14} />
              <span>
                Heads up: {parsed.duplicates.map((d) => `${d.month} (${d.count})`).join(", ")}{" "}
                already has saved transactions for this person. Row-level duplicates will be
                skipped automatically on save.
              </span>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Conf.</th>
                  <th aria-label="actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={r.needsReview || r.confidence < 0.5 ? styles.rowFlagged : undefined}
                  >
                    <td>
                      <input
                        className={styles.cellInput}
                        value={r.isoDate}
                        onChange={(e) => updateRow(i, { isoDate: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={r.particulars}
                        onChange={(e) => updateRow(i, { particulars: e.target.value })}
                        title={r.reason || undefined}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`${styles.cellInput} ${styles.cellInputNumber}`}
                        value={r.amount}
                        onChange={(e) =>
                          updateRow(i, { amount: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className={styles.cellSelect}
                        value={r.type}
                        onChange={(e) =>
                          updateRow(i, { type: e.target.value as "credit" | "debit" })
                        }
                      >
                        <option value="debit">Debit</option>
                        <option value="credit">Credit</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className={styles.cellSelect}
                        value={r.category}
                        onChange={(e) => updateRow(i, { category: e.target.value })}
                      >
                        {parsed.categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <ConfidencePill confidence={r.confidence} reason={r.reason} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.rowDelete}
                        onClick={() => deleteRow(i)}
                        title="Remove this row"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actionsRow}>
            <button type="button" className={styles.ghostBtn} onClick={() => setStep("upload")}>
              Back
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={commit}
              disabled={committing || rows.length === 0}
            >
              {committing
                ? "Saving…"
                : `Save ${rows.length} transaction${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </section>
      )}

      {step === "done" && result && (
        <section className={styles.card}>
          <div className={styles.doneBox}>
            <div className={styles.doneIcon}>
              <Icon name="check" size={24} />
            </div>
            <h2>Import complete</h2>
            <p>
              <strong>{result.inserted}</strong> saved
              {result.skipped > 0 && (
                <>
                  {" · "}
                  <strong>{result.skipped}</strong> skipped (duplicates)
                </>
              )}
            </p>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setParsed(null);
                  setRows([]);
                  setResult(null);
                }}
              >
                Import another
              </button>
              {embedded ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => onClose?.()}
                >
                  View dashboard
                </button>
              ) : (
                <Link href="/dashboard" className={styles.primaryBtn}>
                  View dashboard
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ReconciliationPanel({
  report,
  modelUsed,
}: {
  report: ReconciliationReport;
  modelUsed: string;
}) {
  const { totals, reviewFlags, balance } = report;
  const warnWalk = balance.walkOk === false;

  return (
    <div className={styles.reconPanel}>
      <div className={styles.reconStats}>
        <ReconStat label="Credits" value={fmtMoney(totals.credits)} tone="good" />
        <ReconStat label="Debits" value={fmtMoney(totals.debits)} tone="bad" />
        <ReconStat label="Net flow" value={fmtMoney(totals.net)} tone={totals.net >= 0 ? "good" : "bad"} />
        <ReconStat label="Rows" value={String(totals.count)} />
        <ReconStat
          label="Needs review"
          value={String(reviewFlags.needsReview)}
          tone={reviewFlags.needsReview > 0 ? "warn" : undefined}
        />
      </div>
      <div className={styles.reconMeta}>
        <span>
          Extracted by <strong>{modelUsed || "free AI model"}</strong>
        </span>
        {balance.first !== null && balance.last !== null && (
          <span>
            Balance walk: {fmtMoney(balance.first)} → {fmtMoney(balance.last)}
            {warnWalk && (
              <span className={styles.reconWarn}>
                {" "}
                · running balance mismatch detected — please double-check amounts
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function ReconStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "warn";
}) {
  const toneCls =
    tone === "good"
      ? styles.reconValueGood
      : tone === "bad"
        ? styles.reconValueBad
        : tone === "warn"
          ? styles.reconValueWarn
          : "";
  return (
    <div className={styles.reconStat}>
      <span className={styles.reconLabel}>{label}</span>
      <span className={`${styles.reconValue} ${toneCls}`}>{value}</span>
    </div>
  );
}

function ConfidencePill({ confidence, reason }: { confidence: number; reason: string }) {
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.85 ? "good" : confidence >= 0.5 ? "warn" : "bad";
  const cls =
    tone === "good"
      ? styles.confPillGood
      : tone === "warn"
        ? styles.confPillWarn
        : styles.confPillBad;
  return (
    <span className={`${styles.confPill} ${cls}`} title={reason || `Confidence ${pct}%`}>
      {pct}%
    </span>
  );
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}
