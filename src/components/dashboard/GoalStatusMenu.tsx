"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import type { GoalStatus } from "@/lib/types";
import styles from "./dashboard.module.css";

const OPTIONS: Array<{ value: GoalStatus; label: string; icon: IconName }> = [
  { value: "inprogress", label: "In Progress", icon: "play" },
  { value: "onhold", label: "On Hold", icon: "pause" },
  { value: "completed", label: "Completed", icon: "check" },
  { value: "cancelled", label: "Cancelled", icon: "stop" },
];

interface Props {
  anchor: HTMLElement;
  current: GoalStatus;
  onPick: (status: GoalStatus) => void;
  onClose: () => void;
}

export default function GoalStatusMenu({ anchor, current, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 200 });

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 200;
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
    let top = rect.bottom + 6;
    const menuHeight = menu.scrollHeight || 220;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 6;
      if (top < 10) top = 10;
    }
    setPos({ left, top, width: menuWidth });
  }, [anchor]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      const target = e.target as Node;
      if (ref.current.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    }
    function onScroll(e: Event) {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    }
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={ref}
      className={styles.popover}
      style={{ left: pos.left, top: pos.top, width: pos.width }}
    >
      <div className={styles.popoverHeader}>Change status</div>
      {OPTIONS.map((opt) => {
        const isCurrent = opt.value === current;
        return (
          <div
            key={opt.value}
            className={`${styles.popoverItem} ${isCurrent ? styles.popoverItemSelected : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(opt.value);
              onClose();
            }}
          >
            <Icon name={opt.icon} size={14} />
            <span>{opt.label}</span>
            {isCurrent && (
              <Icon name="check" size={12} style={{ marginLeft: "auto", color: "var(--brand)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
