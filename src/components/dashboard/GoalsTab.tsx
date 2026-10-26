"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import {
  computeGoalFunded,
  computeGoalMonthlySplit,
  fmtShort,
} from "@/lib/finance-calc";
import { MONTHS, PEOPLE } from "@/lib/finance-data";
import Icon, { type IconName } from "@/components/Icon";
import type { Goal, GoalStatus } from "@/lib/types";
import styles from "./dashboard.module.css";
import GoalStatusMenu from "./GoalStatusMenu";
import NewGoalModal from "./NewGoalModal";

const STATUS_LABELS: Record<GoalStatus, string> = {
  inprogress: "In Progress",
  onhold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_ICON: Record<GoalStatus, IconName> = {
  inprogress: "play",
  onhold: "pause",
  completed: "check",
  cancelled: "stop",
};

export default function GoalsTab() {
  const {
    goals,
    txns,
    goalHistory,
    goalPartnerSplit,
    updateGoalStatus,
    currentMonth,
  } = useFinance();

  const [modalOpen, setModalOpen] = useState(false);
  const [menuGoalId, setMenuGoalId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const computed = useMemo(() => {
    return goals.map((g) => {
      const { funded, statusAfter } = computeGoalFunded(g, txns, goalHistory);
      return { ...g, funded, effectiveStatus: statusAfter };
    });
  }, [goals, txns, goalHistory]);

  useEffect(() => {
    computed.forEach((item) => {
      if (item.effectiveStatus !== item.status) {
        updateGoalStatus(item.id, item.effectiveStatus);
      }
    });
  }, [computed, updateGoalStatus]);

  function openMenu(goalId: string) {
    const btn = menuBtnRefs.current[goalId];
    if (!btn) return;
    setMenuGoalId(goalId);
    setMenuAnchor(btn);
  }

  function closeMenu() {
    setMenuGoalId(null);
    setMenuAnchor(null);
  }

  return (
    <div>
      <div className={styles.goalsHeader}>
        <h2>
          <Icon name="target" size={18} /> Your savings goals
        </h2>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() => setModalOpen(true)}
        >
          <Icon name="plus" size={14} /> New goal
        </button>
      </div>

      <div className={styles.infoNote}>
        <Icon name="info" size={14} />
        <span>
          Goals auto-complete when the target is reached. You can <strong>Cancel</strong>,{" "}
          <strong>Pause</strong>, or <strong>Mark Complete</strong> from the three-dot menu.
        </span>
      </div>

      {computed.length === 0 ? (
        <div className={styles.infoNote} style={{ justifyContent: "center", padding: "1.5rem" }}>
          <Icon name="target" size={16} />
          <span>No goals yet. Click <strong>New goal</strong> to create your first one.</span>
        </div>
      ) : (
        <div className={styles.goalsGrid}>
          {computed.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              funded={g.funded}
              currentMonth={currentMonth}
              onMenu={() => openMenu(g.id)}
              registerRef={(el) => {
                menuBtnRefs.current[g.id] = el;
              }}
              historyFor={(goal) =>
                computeGoalMonthlySplit(goal, txns, goalHistory, goalPartnerSplit)
              }
            />
          ))}
        </div>
      )}

      {menuAnchor && menuGoalId && (
        <GoalStatusMenu
          anchor={menuAnchor}
          current={goals.find((g) => g.id === menuGoalId)?.status ?? "inprogress"}
          onPick={(s) => updateGoalStatus(menuGoalId, s)}
          onClose={closeMenu}
        />
      )}

      {modalOpen && <NewGoalModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  funded: number;
  currentMonth: string;
  onMenu: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
  historyFor: (goal: Goal) => { A: Record<string, number>; B: Record<string, number> };
}

function GoalCard({ goal, funded, currentMonth, onMenu, registerRef, historyFor }: GoalCardProps) {
  const pct = Math.min(100, Math.round((funded / goal.target) * 100));
  const remaining = Math.max(0, goal.target - funded);
  const split = historyFor(goal);
  const maxMonthly = Math.max(
    ...MONTHS.map((m) => Math.max(split.A[m] || 0, split.B[m] || 0)),
    1,
  );
  const statusLabel = STATUS_LABELS[goal.status];
  const statusIcon = STATUS_ICON[goal.status];
  const statusCls =
    goal.status === "inprogress"
      ? styles.goalStatusInprogress
      : goal.status === "onhold"
        ? styles.goalStatusOnhold
        : goal.status === "completed"
          ? styles.goalStatusCompleted
          : styles.goalStatusCancelled;

  // Use the rolling MONTHS window (newest → oldest) in ascending order so the
  // "funded per month" bars line up with the rest of the dashboard.
  const monthsAsc = [...MONTHS].reverse();

  return (
    <div
      className={styles.goalCard}
      style={{ ["--goal-color" as string]: goal.color }}
      data-status={goal.status}
    >
      <div className={styles.goalTop}>
        <div className={styles.goalIconWrap}>
          <Icon name={goal.icon as IconName} size={18} />
        </div>
        <div className={styles.goalTopRight}>
          <span className={`${styles.goalStatusBadge} ${statusCls}`}>
            <Icon name={statusIcon} size={10} /> {statusLabel}
          </span>
          <button
            ref={registerRef}
            type="button"
            className={styles.goalMenuBtn}
            title="Change status"
            onClick={(e) => {
              e.stopPropagation();
              onMenu();
            }}
          >
            <Icon name="more" size={14} />
          </button>
        </div>
      </div>
      <h3>{goal.name}</h3>
      <div className={styles.goalDeadline}>
        <Icon name="calendar" size={11} /> Target: {goal.deadline}
      </div>
      <div className={styles.goalAmounts}>
        <span className={styles.gaCurrent}>{fmtShort(funded)}</span>
        <span className={styles.gaTarget}>of {fmtShort(goal.target)}</span>
      </div>
      <div className={styles.goalBar}>
        <div className={styles.goalBarFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.goalMeta}>
        <span className={styles.gpPct}>{pct}% funded</span>
        <span className={styles.gpRemain}>
          {goal.status === "completed"
            ? "Completed"
            : goal.status === "cancelled"
              ? "Cancelled"
              : goal.status === "onhold"
                ? "On hold"
                : remaining > 0
                  ? `${fmtShort(remaining)} to go`
                  : "Reached!"}
        </span>
      </div>

      <div className={styles.goalHistory}>
        <div className={styles.ghTitle}>
          <Icon name="bar-chart" size={11} /> Funded per month
          <span className={styles.ghLegend}>
            <span>
              <span className={styles.ghLegendDot} style={{ background: PEOPLE.A.color }} />
              You
            </span>
            <span>
              <span className={styles.ghLegendDot} style={{ background: PEOPLE.B.color }} />
              Partner
            </span>
          </span>
        </div>
        <div className={styles.ghBars}>
          {monthsAsc.map((m) => {
            const aAmt = split.A[m] || 0;
            const bAmt = split.B[m] || 0;
            const hA = aAmt > 0 ? Math.max(4, (aAmt / maxMonthly) * 50) : 0;
            const hB = bAmt > 0 ? Math.max(4, (bAmt / maxMonthly) * 50) : 0;
            const isCurrent = m === currentMonth;
            return (
              <div key={m} className={styles.ghCol}>
                <div className={styles.ghAmt}>
                  {aAmt > 0 ? fmtShort(aAmt) : ""}
                  {bAmt > 0 ? `${aAmt > 0 ? " / " : ""}${fmtShort(bAmt)}` : ""}
                  {aAmt === 0 && bAmt === 0 ? "—" : ""}
                </div>
                <div className={styles.ghStack}>
                  <div
                    className={`${styles.ghBar} ${isCurrent ? styles.ghBarCurrent : ""}`}
                    style={{ height: hA, background: PEOPLE.A.color }}
                  />
                  <div
                    className={`${styles.ghBar} ${
                      isCurrent ? styles.ghBarCurrentPartner : ""
                    }`}
                    style={{ height: hB, background: PEOPLE.B.color }}
                  />
                </div>
                <div className={styles.ghM}>{m.split(" ")[0]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
