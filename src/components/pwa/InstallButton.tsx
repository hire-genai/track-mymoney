"use client";

import { useEffect, useRef, useState } from "react";
import { usePwa } from "./PwaBoot";
import styles from "./pwa.module.css";

interface Props {
  variant?: "primary" | "subtle";
  className?: string;
  label?: string;
}

export default function InstallButton({ variant = "subtle", className = "", label = "Install app" }: Props) {
  const { canInstall, isStandalone, isIOS, promptInstall } = usePwa();
  const [hintOpen, setHintOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("tmm:install:ios-dismissed") === "1") {
        setDismissed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!hintOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setHintOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [hintOpen]);

  if (isStandalone) return null;
  if (!canInstall && !isIOS) return null;
  if (isIOS && dismissed) return null;

  const btnClass = `${variant === "primary" ? styles.primary : styles.subtle} ${className}`.trim();

  const onClick = async () => {
    if (canInstall) {
      await promptInstall();
      return;
    }
    if (isIOS) setHintOpen((v) => !v);
  };

  const dismissIosHint = () => {
    setDismissed(true);
    setHintOpen(false);
    try {
      window.localStorage.setItem("tmm:install:ios-dismissed", "1");
    } catch {}
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button type="button" className={btnClass} onClick={onClick} aria-label={label}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{label}</span>
      </button>
      {hintOpen && isIOS && (
        <div role="dialog" className={styles.hint}>
          <div className={styles.hintArrow} />
          <div className={styles.hintTitle}>Install on iPhone / iPad</div>
          <ol className={styles.hintList}>
            <li>
              Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
            </li>
            <li>
              Scroll and choose <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> — Track-MyMoney will appear on your home screen.
            </li>
          </ol>
          <button type="button" className={styles.hintClose} onClick={dismissIosHint}>
            Don&apos;t show again
          </button>
        </div>
      )}
    </div>
  );
}
