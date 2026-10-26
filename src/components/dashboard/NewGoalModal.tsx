"use client";

import { useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { useFinance } from "@/context/FinanceContext";
import type { Goal } from "@/lib/types";
import styles from "./dashboard.module.css";

const ICON_OPTIONS: Array<{ value: IconName; label: string }> = [
  { value: "plane", label: "✈ Vacation" },
  { value: "laptop", label: "💻 Laptop / Tech" },
  { value: "car", label: "🚗 Car" },
  { value: "house", label: "🏠 Home" },
  { value: "shield", label: "🛡 Emergency Fund" },
  { value: "gift", label: "🎁 Gift" },
  { value: "graduation", label: "🎓 Education" },
  { value: "ring", label: "💍 Wedding" },
  { value: "dumbbell", label: "🏋 Fitness" },
  { value: "coins", label: "💰 Other" },
];

const DEADLINES = ["Dec 2026", "Mar 2027", "Jun 2027", "Dec 2027", "Mar 2028"];

const PALETTES = [
  "linear-gradient(135deg,#059669,#047857)",
  "linear-gradient(135deg,#0891b2,#0e7490)",
  "linear-gradient(135deg,#d97706,#b45309)",
  "linear-gradient(135deg,#db2777,#9d174d)",
  "linear-gradient(135deg,#4f46e5,#4338ca)",
];

interface Props {
  onClose: () => void;
}

export default function NewGoalModal({ onClose }: Props) {
  const { addGoal, goals } = useFinance();
  const [name, setName] = useState("");
  const [target, setTarget] = useState<string>("");
  const [icon, setIcon] = useState<IconName>("plane");
  const [deadline, setDeadline] = useState(DEADLINES[0]);

  function submit() {
    const t = Number.parseFloat(target);
    if (!name.trim() || Number.isNaN(t) || t <= 0) return;
    const goal: Goal = {
      id: `goal-${Date.now()}`,
      name: name.trim(),
      subCat: `Goal: ${name.trim()}`,
      icon,
      color: PALETTES[goals.length % PALETTES.length],
      target: t,
      deadline,
      status: "inprogress",
    };
    addGoal(goal);
    onClose();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>
          <Icon name="target" size={16} /> Create new goal
        </h3>

        <div className={styles.formGroup}>
          <label>Goal name</label>
          <input
            type="text"
            placeholder="e.g. New Laptop"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className={styles.formGroup}>
          <label>Target amount (₹)</label>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="e.g. 5000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Target month</label>
          <select value={deadline} onChange={(e) => setDeadline(e.target.value)}>
            {DEADLINES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label>Icon</label>
          <select value={icon} onChange={(e) => setIcon(e.target.value as IconName)}>
            {ICON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={`${styles.btnModal} ${styles.btnModalCancel}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btnModal} ${styles.btnModalPrimary}`}
            onClick={submit}
          >
            Create goal
          </button>
        </div>
      </div>
    </div>
  );
}
