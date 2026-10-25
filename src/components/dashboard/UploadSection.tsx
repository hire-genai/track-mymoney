"use client";

import { useRef, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { PEOPLE } from "@/lib/finance-data";
import Icon from "@/components/Icon";
import styles from "./dashboard.module.css";

export default function UploadSection() {
  const { activePerson, simulateUpload, txns, uploadedPersons } = useFinance();
  const [over, setOver] = useState(false);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activePersonName = PEOPLE[activePerson].name;
  const filesCount = (uploadedPersons.A ? 1 : 0) + (uploadedPersons.B ? 1 : 0);
  const txnCount =
    (txns.A["Sep 2026"]?.length || 0) + (txns.B["Sep 2026"]?.length || 0);

  function trigger() {
    simulateUpload(activePerson);
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) trigger();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className={styles.uploadWrap}>
      <div
        className={`${styles.dropzone} ${over ? styles.dropzoneOver : ""} ${
          flash ? styles.dropzoneFlash : ""
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          trigger();
        }}
      >
        <div className={styles.dropIcon}>
          <Icon name="upload" size={20} />
        </div>
        <div>
          <h3 className={styles.dropTitle}>
            Upload <strong>{activePersonName === "You" ? "your" : "Partner's"}</strong> statement
          </h3>
          <p className={styles.dropHint}>PDF or CSV · auto-categorized</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".pdf,.csv"
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
