"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFinance } from "@/context/FinanceContext";
import { MONTHS, PEOPLE } from "@/lib/finance-data";
import type { PersonId } from "@/lib/types";
import Icon from "@/components/Icon";
import styles from "./dashboard.module.css";

export default function UploadSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    activePerson,
    setActivePerson,
    simulateUpload,
    txns,
    uploadedPersons,
    authenticated,
    importsCount,
    registerImportPicker,
  } = useFinance();
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runParseAndCommit = useCallback(
    async (picked: File) => {
      setParsing(true);
      setParseError(null);
      setParseStatus("Extracting text…");
      const t0 = performance.now();
      try {
        console.log(`[UploadSection] parsing ${picked.name} (${picked.size} bytes) person=${activePerson}`);
        const fd = new FormData();
        fd.append("file", picked);
        fd.append("person", activePerson);

        setParseStatus("Parsing transactions…");
        const parseRes = await fetch("/api/import/parse", { method: "POST", body: fd });
        const parseData = (await parseRes.json()) as {
          ok?: boolean;
          transactions?: Array<{
            isoDate: string;
            date: string;
            particulars: string;
            amount: number;
            type: "credit" | "debit";
            category: string;
          }>;
          counts?: { total: number; credit: number; debit: number };
          timings?: { extractMs: number; parseMs: number; aiMs: number; totalMs: number };
          debug?: string[];
          error?: string;
          detail?: string;
        };
        if (parseData.debug) for (const d of parseData.debug) console.log(`[parse] ${d}`);
        if (!parseRes.ok || !parseData.ok || !parseData.transactions) {
          throw new Error(parseData.error ?? `Parse failed (${parseRes.status})`);
        }
        if (parseData.transactions.length === 0) {
          throw new Error("No transactions could be extracted from this file.");
        }

        setParseStatus(`Saving ${parseData.transactions.length} transactions…`);
        const commitRes = await fetch("/api/import/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            person: activePerson,
            filename: picked.name,
            mime: picked.type || "application/octet-stream",
            transactions: parseData.transactions,
          }),
        });
        const commitData = (await commitRes.json()) as {
          ok?: boolean;
          inserted?: number;
          skipped?: number;
          error?: string;
        };
        if (!commitRes.ok || !commitData.ok) {
          throw new Error(commitData.error ?? `Save failed (${commitRes.status})`);
        }

        const elapsed = Math.round(performance.now() - t0);
        console.log(
          `[UploadSection] done in ${elapsed}ms — inserted=${commitData.inserted} skipped=${commitData.skipped}`,
        );
        setParseStatus(
          `✓ ${commitData.inserted ?? 0} saved${commitData.skipped ? `, ${commitData.skipped} dupes skipped` : ""} · ${elapsed}ms`,
        );
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
        setTimeout(() => setParseStatus(null), 4000);
      } catch (e) {
        const msg = (e as Error).message;
        console.error(`[UploadSection] error:`, msg);
        setParseError(msg);
        setParseStatus(null);
      } finally {
        setParsing(false);
      }
    },
    [activePerson, router],
  );

  const activePersonName = PEOPLE[activePerson].name;
  const filesCount = authenticated
    ? importsCount
    : (uploadedPersons.A ? 1 : 0) + (uploadedPersons.B ? 1 : 0);
  const txnCount = useMemo(() => {
    let total = 0;
    for (const m of MONTHS) {
      total += (txns.A[m]?.length ?? 0) + (txns.B[m]?.length ?? 0);
    }
    return total;
  }, [txns]);

  const setImportParam = useCallback(
    (value: PersonId | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("import", value);
      else params.delete("import");
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    },
    [router, searchParams],
  );

  function demoTrigger() {
    simulateUpload(activePerson);
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
  }

  function clearFile(e: React.MouseEvent) {
    e.stopPropagation();
    setFile(null);
    setImportParam(null);
    setParseError(null);
    setParseStatus(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const openPicker = useCallback(
    (id: PersonId) => {
      if (authenticated) {
        setActivePerson(id);
        setImportParam(id);
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
        setTimeout(() => inputRef.current?.click(), 0);
      } else {
        simulateUpload(id);
      }
    },
    [authenticated, setActivePerson, setImportParam, simulateUpload],
  );

  useEffect(() => {
    registerImportPicker(openPicker);
    return () => registerImportPicker(null);
  }, [openPicker, registerImportPicker]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) return;
    if (authenticated) {
      setFile(picked);
      setImportParam(activePerson);
      setParseError(null);
      setParseStatus(null);
    } else {
      demoTrigger();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClick(e: React.MouseEvent) {
    if (authenticated && file) {
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles.importCta}`)) return;
      inputRef.current?.click();
      return;
    }
    inputRef.current?.click();
  }

  return (
    <section className={styles.uploadWrap}>
      <div
        className={`${styles.dropzone} ${over ? styles.dropzoneOver : ""} ${
          flash ? styles.dropzoneFlash : ""
        }`}
        onClick={handleClick}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const dropped = e.dataTransfer.files?.[0];
          if (authenticated) {
            if (dropped) {
              setFile(dropped);
              setImportParam(activePerson);
            }
          } else {
            demoTrigger();
          }
        }}
      >
        <div className={styles.dropIcon}>
          <Icon name="upload" size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 className={styles.dropTitle}>
            {authenticated && file ? (
              <>Ready: <strong>{file.name}</strong></>
            ) : (
              <>Upload <strong>{activePersonName === "You" ? "your" : "Partner's"}</strong> statement</>
            )}
          </h3>
          <p className={styles.dropHint}>
            {authenticated
              ? file
                ? `${(file.size / 1024).toFixed(0)} KB · click to replace`
                : "PDF, CSV or TXT · select a file to get started"
              : "PDF or CSV · auto-categorized (demo preview)"}
          </p>
        </div>
        {authenticated && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {file && (
              <button
                type="button"
                onClick={clearFile}
                title="Clear selected file"
                aria-label="Clear selected file"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  border: "1px solid var(--border, #e2e8f0)",
                  background: "#fff",
                  color: "#64748b",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Icon name="x" size={11} />
              </button>
            )}
            <button
              type="button"
              className={styles.importCta}
              onClick={(e) => {
                e.stopPropagation();
                if (parsing) return;
                if (file) {
                  void runParseAndCommit(file);
                } else {
                  inputRef.current?.click();
                }
              }}
              disabled={parsing}
              aria-disabled={parsing}
              style={parsing ? { opacity: 0.7, cursor: "wait" } : undefined}
              title={parsing ? "Parsing…" : file ? "Parse this statement" : "Pick a file to import"}
            >
              {parsing ? (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      display: "inline-block",
                      animation: "tmm-spin 0.7s linear infinite",
                    }}
                  />
                  Parsing…
                </>
              ) : (
                <>
                  {file ? "Parse Statement" : "Pick a file"}
                  <Icon name="chevron-right" size={11} />
                </>
              )}
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={authenticated ? ".pdf,.csv,.txt,application/pdf,text/csv,text/plain" : ".pdf,.csv"}
          onChange={onFile}
        />
        <style>{`@keyframes tmm-spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {(parseStatus || parseError) && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            border: `1px solid ${parseError ? "#fca5a5" : "#86efac"}`,
            background: parseError ? "#fef2f2" : "#f0fdf4",
            color: parseError ? "#b91c1c" : "#047857",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {parseError ? <>⚠ {parseError}</> : <>{parseStatus}</>}
        </div>
      )}

      <div className={styles.uploadStats}>
        <div className={styles.statBadge}>
          <div className={styles.statIcon} data-tone="indigo">
            <Icon name="file" size={14} />
          </div>
          <div>
            <div className={styles.statLabel}>Files</div>
            <div className={styles.statValue}>{filesCount}</div>
          </div>
        </div>
        <div className={styles.statBadge}>
          <div className={styles.statIcon} data-tone="emerald">
            <Icon name="bot" size={14} />
          </div>
          <div>
            <div className={styles.statLabel}>Txns</div>
            <div className={styles.statValue}>{txnCount}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
