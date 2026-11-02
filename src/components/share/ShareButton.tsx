"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./share.module.css";

interface Props {
  variant?: "subtle" | "ghost";
  className?: string;
}

const SHARE_URL = "https://track-mymoney.com";
const SHARE_TITLE = "Track-MyMoney";
const SHARE_TEXT =
  "I use Track-MyMoney to see exactly where my money goes every month — it parses bank statements and categorises every transaction automatically. Try it:";

export default function ShareButton({ variant = "subtle", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const openPopover = async () => {
    // Prefer the OS-native share sheet when available (mobile Safari, Android Chrome, newer desktops).
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
        return;
      } catch {
        // User cancelled or share failed — fall back to our popover.
      }
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${SHARE_URL}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const encoded = encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`);
  const urlOnly = encodeURIComponent(SHARE_URL);
  const titleEnc = encodeURIComponent(SHARE_TITLE);
  const textEnc = encodeURIComponent(SHARE_TEXT);

  const targets = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encoded}`,
      color: "#25d366",
      icon: (
        <path d="M20.52 3.48A11.86 11.86 0 0012 0C5.37 0 .02 5.35.02 11.95c0 2.1.55 4.16 1.6 5.98L0 24l6.3-1.65a11.9 11.9 0 005.7 1.45h.01C18.63 23.8 24 18.45 24 11.85a11.79 11.79 0 00-3.48-8.37zM12 21.78h-.01a9.77 9.77 0 01-4.98-1.36l-.36-.21-3.74.98 1-3.64-.23-.37A9.73 9.73 0 012.24 11.9c0-5.4 4.4-9.78 9.76-9.78 2.6 0 5.05 1.02 6.9 2.87a9.7 9.7 0 012.86 6.9c0 5.4-4.4 9.78-9.76 9.78zm5.37-7.33c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.78.96-.96 1.16-.18.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.48-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.9-2.2-.24-.58-.49-.5-.67-.5l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.55.72.3 1.28.5 1.72.65.72.23 1.38.2 1.9.12.58-.08 1.75-.72 2-1.4.25-.68.25-1.26.17-1.4-.07-.14-.27-.22-.57-.37z" fill="currentColor" />
      ),
    },
    {
      key: "x",
      label: "X / Twitter",
      href: `https://twitter.com/intent/tweet?text=${textEnc}&url=${urlOnly}`,
      color: "#0f172a",
      icon: (
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.215-6.817-5.967 6.817H1.675l7.73-8.835L1.254 2.25h6.83l4.71 6.231 5.45-6.231zm-1.16 17.52h1.833L7.084 4.126H5.117L17.085 19.77z" fill="currentColor" />
      ),
    },
    {
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${urlOnly}&quote=${textEnc}`,
      color: "#1877f2",
      icon: (
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" fill="currentColor" />
      ),
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${urlOnly}`,
      color: "#0a66c2",
      icon: (
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.62 0 4.29 2.38 4.29 5.48v6.26zM5.34 7.43a2.07 2.07 0 110-4.14 2.07 2.07 0 010 4.14zm1.78 13.02H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0z" fill="currentColor" />
      ),
    },
    {
      key: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${urlOnly}&text=${textEnc}`,
      color: "#229ed9",
      icon: (
        <path d="M22.26 2.42L.84 10.68c-.98.38-.97.92-.17 1.17l5.5 1.72 2.12 6.52c.26.72.4 1 .83 1 .46 0 .66-.21 1.07-.6l2.47-2.4 5.12 3.78c.94.52 1.62.25 1.85-.87L22.9 3.98c.34-1.42-.56-2.07-1.5-1.58zm-3.6 4.63l-9.54 8.63-.37 3.95-2.03-6.14 11.94-6.44z" fill="currentColor" />
      ),
    },
  ];

  const btnClass = `${variant === "ghost" ? styles.ghost : styles.subtle} ${className}`.trim();

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={btnClass}
        onClick={openPopover}
        aria-label="Share Track-MyMoney"
        title="Share Track-MyMoney"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Share</span>
      </button>

      {open && (
        <div role="dialog" aria-label="Share options" className={styles.popover}>
          <div className={styles.arrow} />
          <div className={styles.popTitle}>Share Track-MyMoney</div>
          <div className={styles.grid}>
            {targets.map((t) => (
              <a
                key={t.key}
                className={styles.target}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: t.color }}
                onClick={() => setOpen(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  {t.icon}
                </svg>
                <span>{t.label}</span>
              </a>
            ))}
          </div>
          <button type="button" className={styles.copyRow} onClick={copy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 9h10a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V11a2 2 0 012-2zM5 15H4a2 2 0 01-2-2V3a2 2 0 012-2h10a2 2 0 012 2v1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.copyText}>{copied ? "Copied!" : "Copy share link"}</span>
            <span className={styles.copyUrl}>{SHARE_URL}</span>
          </button>
        </div>
      )}
    </div>
  );
}
