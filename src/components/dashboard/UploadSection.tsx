"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFinance } from "@/context/FinanceContext";
import { MONTHS, PEOPLE } from "@/lib/finance-data";
import type { PersonId } from "@/lib/types";
import Icon from "@/components/Icon";
import styles from "./dashboard.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "saving"; total: number }
  | { kind: "done"; inserted: number; skipped: number }
  | { kind: "error"; message: string };

interface ParsedRow {
  isoDate: string;
  date: string;
  particulars: string;
  amount: number;
  type: "credit" | "debit";
  category: string;
}

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
    setCurrentMonth,
    registerImportPicker,
  } = useFinance();
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = status.kind === "parsing" || status.kind === "saving";
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

  // Reflect the active import target in the URL so the current section is
  // self-describing (e.g. /dashboard?import=B when uploading for Partner).
  // Cleared once the file is removed or the save completes.
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
    setStatus({ kind: "idle" });
    setImportParam(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Expose a programmatic opener so other components (e.g. CoupleTab's
  // "Upload Partner" button) can switch person + open the native file picker
  // without re-implementing the hidden input.
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
      setStatus({ kind: "idle" });
      setImportParam(activePerson);
    } else {
      demoTrigger();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClick(e: React.MouseEvent) {
    if (busy) return;
    if (authenticated && file) {
      const target = e.target as HTMLElement;
      if (target.closest(`.${styles.importCta}`)) return;
      inputRef.current?.click();
      return;
    }
    inputRef.current?.click();
  }

  async function runParseAndSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (!file || busy) return;
    setStatus({ kind: "parsing" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("person", activePerson);
      const parseRes = await fetch("/api/import/parse", { method: "POST", body: form });
      const parseJson = (await parseRes.json().catch(() => ({}))) as {
        ok?: true;
        transactions?: ParsedRow[];
        monthsSeen?: string[];
        filename?: string;
        mime?: string;
        error?: string;
      };
      if (!parseRes.ok || !parseJson.ok || !parseJson.transactions?.length) {
        setStatus({
          kind: "error",
          message: parseJson.error || "No transactions could be extracted.",
        });
        return;
      }
      const transactions = parseJson.transactions;
      setStatus({ kind: "saving", total: transactions.length });

      const commitRes = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: activePerson,
          filename: parseJson.filename || file.name,
          mime: parseJson.mime || file.type || "application/octet-stream",
          transactions,
        }),
      });
      const commitJson = (await commitRes.json().catch(() => ({}))) as {
        ok?: true;
        inserted?: number;
        skipped?: number;
        error?: string;
      };
      if (!commitRes.ok || !commitJson.ok) {
        setStatus({ kind: "error", message: commitJson.error || "Could not save transactions." });
        return;
      }
      setStatus({
        kind: "done",
        inserted: commitJson.inserted ?? 0,
        skipped: commitJson.skipped ?? 0,
      });
      setFile(null);
      setImportParam(null);
      // Jump the user to the most recent month we just imported so the KPIs
      // and category cards reflect the new data immediately.
      const months = parseJson.monthsSeen ?? [];
      if (months.length > 0) {
        const latest = [...months].sort(
          (a, b) => new Date(`1 ${b}`).getTime() - new Date(`1 ${a}`).getTime(),
        )[0];
        setCurrentMonth(latest);
      }
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Network error during import." });
    }
  }

  const ctaLabel =
    status.kind === "parsing"
      ? "Parsing…"
      : status.kind === "saving"
        ? `Saving ${status.total}…`
        : file
          ? "Parse Statement"
          : "Pick a file";

  return (
    <section className={styles.uploadWrap}>
      <div
        className={`${styles.dropzone} ${over ? styles.dropzoneOver : ""} ${
          flash ? styles.dropzoneFlash : ""
        }`}
        onClick={handleClick}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (busy) return;
          const dropped = e.dataTransfer.files?.[0];
          if (authenticated) {
            if (dropped) {
              setFile(dropped);
              setStatus({ kind: "idle" });
              setImportParam(activePerson);
            }
          } else {
            demoTrigger();
          }
        }}
        aria-busy={busy || undefined}
        style={busy ? { cursor: "default", opacity: 0.9 } : undefined}
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
            {status.kind === "parsing" && "Reading your statement with a free AI model…"}
            {status.kind === "saving" && `Saving ${status.total} transactions…`}
            {status.kind === "done" && (
              <>
                Imported <strong>{status.inserted}</strong>
                {status.skipped > 0 && <> · skipped {status.skipped} duplicates</>} ·
                dashboard updated.
              </>
            )}
            {status.kind === "error" && <span style={{ color: "#b91c1c" }}>{status.message}</span>}
            {status.kind === "idle" &&
              (authenticated
                ? file
                  ? `${(file.size / 1024).toFixed(0)} KB · click to replace, or Parse Statement to extract`
                  : "PDF, CSV or TXT · AI reads it and saves automatically"
                : "PDF or CSV · auto-categorized (demo preview)")}
          </p>
        </div>
        {authenticated && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {file && !busy && (
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
                if (busy) return;
                if (file) runParseAndSave(e);
                else inputRef.current?.click();
              }}
              disabled={busy}
              aria-disabled={busy}
              style={busy ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              {ctaLabel}
              <Icon name="chevron-right" size={11} />
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
      </div>

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
