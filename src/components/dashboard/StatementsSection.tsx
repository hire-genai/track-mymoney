"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFinance } from "@/context/FinanceContext";
import Icon from "@/components/Icon";
import styles from "./statements.module.css";

interface Statement {
  id: number;
  person: "A" | "B";
  filename: string;
  mime: string;
  rowCount: number;
  createdAt: string;
  totalCredit: number;
  totalDebit: number;
  firstDate: string | null;
  lastDate: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function StatementsSection() {
  const router = useRouter();
  const { authenticated, importsCount } = useFinance();
  const [statements, setStatements] = useState<Statement[] | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authenticated) {
      setStatements([]);
      return;
    }
    try {
      const res = await fetch("/api/imports");
      const data = (await res.json()) as { ok?: boolean; statements?: Statement[]; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Failed to load (${res.status})`);
      }
      setStatements(data.statements ?? []);
    } catch (e) {
      setError((e as Error).message);
      setStatements([]);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
    // Re-fetch whenever a new import lands (importsCount changes).
  }, [load, importsCount]);

  async function handleDelete(id: number, filename: string) {
    const ok = window.confirm(
      `Delete "${filename}"? All transactions from this statement will be removed.`,
    );
    if (!ok) return;
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Delete failed (${res.status})`);
      }
      setStatements((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  if (!authenticated) {
    return (
      <section className={styles.wrap}>
        <div className={styles.empty}>Sign in to see your uploaded statements.</div>
      </section>
    );
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.header}>
        {statements && statements.length > 0 && (
          <span className={styles.count}>{statements.length} statement{statements.length !== 1 ? "s" : ""} uploaded</span>
        )}
      </div>

      {statements === null ? (
        <div className={styles.empty}>Loading…</div>
      ) : statements.length === 0 ? (
        <div className={styles.empty}>No statements uploaded yet.</div>
      ) : (
        <div className={styles.list}>
          {statements.map((s) => (
            <div key={s.id} className={styles.strip}>
              <div className={styles.fileIcon}>
                <Icon name="file" size={16} />
              </div>
              <div className={styles.body}>
                <div className={styles.filename} title={s.filename}>
                  {s.filename}
                </div>
                <div className={styles.meta}>
                  <span>
                    <span
                      className={`${styles.personPill} ${
                        s.person === "B" ? styles.personPillPartner : ""
                      }`}
                    >
                      {s.person === "A" ? "You" : "Partner"}
                    </span>
                  </span>
                  <span className={styles.metaDot}>Uploaded {formatDate(s.createdAt)}</span>
                  <span className={styles.metaDot}>{formatTime(s.createdAt)}</span>
                  <span className={styles.metaDot}>{s.rowCount} txns</span>
                  <span className={styles.metaDot}>
                    +{formatMoney(s.totalCredit)} / -{formatMoney(s.totalDebit)}
                  </span>
                  {s.firstDate && s.lastDate && (
                    <span className={styles.metaDot}>
                      {formatDate(s.firstDate)} → {formatDate(s.lastDate)}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => handleDelete(s.id, s.filename)}
                disabled={deleting === s.id}
                title="Delete statement and all its transactions"
                aria-label="Delete statement"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className={styles.error}>⚠ {error}</div>}
    </section>
  );
}
