"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  INITIAL_GOALS,
  INITIAL_GOAL_HISTORY,
  INITIAL_GOAL_PARTNER_SPLIT,
  INCOME_SUBS,
  MONTHS,
  personA_SepTransactions,
  personB_SepTransactions,
} from "@/lib/finance-data";
import type { Goal, GoalStatus, PersonId, Transaction } from "@/lib/types";

type TxnStore = Record<PersonId, Record<string, Transaction[]>>;
type UploadMap = Record<PersonId, boolean>;

interface FinanceCtx {
  activePerson: PersonId;
  setActivePerson: (id: PersonId) => void;
  currentMonth: string;
  setCurrentMonth: (m: string) => void;
  txns: TxnStore;
  moveTransaction: (txId: string, newCat: string, month: string, personId: PersonId) => void;
  openCategories: Set<string>;
  toggleCategory: (key: string) => void;
  openCoupleGroups: Set<string>;
  toggleCoupleGroup: (key: string) => void;
  taggedIds: Set<string>;
  toggleTag: (id: string) => void;
  goals: Goal[];
  addGoal: (g: Goal) => void;
  updateGoalStatus: (id: string, status: GoalStatus) => void;
  updateGoalFunded: (id: string) => void;
  goalHistory: Record<string, Record<string, number>>;
  goalPartnerSplit: Record<string, number>;
  setGoalPartnerSplit: (id: string, value: number) => void;
  uploadedPersons: UploadMap;
  simulateUpload: (id: PersonId) => void;
  bothUploaded: boolean;
}

const Context = createContext<FinanceCtx | null>(null);

function buildInitialTxns(): TxnStore {
  const emptyMonths = () =>
    Object.fromEntries(MONTHS.map((m) => [m, [] as Transaction[]])) as Record<string, Transaction[]>;
  return {
    A: { ...emptyMonths(), "Sep 2026": personA_SepTransactions.map((t) => ({ ...t })) },
    B: { ...emptyMonths(), "Sep 2026": personB_SepTransactions.map((t) => ({ ...t })) },
  };
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [activePerson, setActivePerson] = useState<PersonId>("A");
  const [currentMonth, setCurrentMonth] = useState<string>("Sep 2026");
  const [txns, setTxns] = useState<TxnStore>(buildInitialTxns);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openCoupleGroups, setOpenCoupleGroups] = useState<Set<string>>(new Set());
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  const [goals, setGoals] = useState<Goal[]>(() => INITIAL_GOALS.map((g) => ({ ...g })));
  const [goalHistory, setGoalHistory] = useState(() => structuredClone(INITIAL_GOAL_HISTORY));
  const [goalPartnerSplit, setGoalPartnerSplitState] = useState<Record<string, number>>(() => ({
    ...INITIAL_GOAL_PARTNER_SPLIT,
  }));
  const [uploadedPersons, setUploadedPersons] = useState<UploadMap>({ A: true, B: false });

  const toggleCategory = useCallback((key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleCoupleGroup = useCallback((key: string) => {
    setOpenCoupleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleTag = useCallback((id: string) => {
    setTaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const moveTransaction = useCallback(
    (txId: string, newCat: string, month: string, personId: PersonId) => {
      setTxns((prev) => {
        const list = prev[personId]?.[month];
        if (!list) return prev;
        const idx = list.findIndex((t) => t.id === txId);
        if (idx < 0) return prev;
        const tx = { ...list[idx] };
        if (tx.category === newCat) return prev;
        const isIncome = INCOME_SUBS.includes(newCat);
        if (isIncome) tx.type = "credit";
        else if (tx.type === "credit") tx.type = "debit";
        tx.category = newCat;
        const updated = [...list];
        updated[idx] = tx;
        return {
          ...prev,
          [personId]: { ...prev[personId], [month]: updated },
        };
      });
    },
    [],
  );

  const addGoal = useCallback((g: Goal) => {
    setGoals((prev) => [...prev, g]);
    setGoalHistory((prev) => ({
      ...prev,
      [g.id]: { "Jun 2026": 0, "Jul 2026": 0, "Aug 2026": 0, "Sep 2026": 0 },
    }));
    setGoalPartnerSplitState((prev) => ({ ...prev, [g.id]: 0.5 }));
  }, []);

  const updateGoalStatus = useCallback((id: string, status: GoalStatus) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
  }, []);

  const updateGoalFunded = useCallback((id: string) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        if (g.status === "completed" || g.status === "cancelled") return g;
        return { ...g, status: "completed" as GoalStatus };
      }),
    );
  }, []);

  const setGoalPartnerSplit = useCallback((id: string, value: number) => {
    setGoalPartnerSplitState((prev) => ({ ...prev, [id]: value }));
  }, []);

  const simulateUpload = useCallback((id: PersonId) => {
    setUploadedPersons((prev) => ({ ...prev, [id]: true }));
    setTxns((prev) => {
      const list = prev[id]?.["Sep 2026"] ?? [];
      if (list.length > 0) return prev;
      const seed = id === "A" ? personA_SepTransactions : personB_SepTransactions;
      return {
        ...prev,
        [id]: { ...prev[id], "Sep 2026": seed.map((t) => ({ ...t })) },
      };
    });
    setActivePerson(id);
  }, []);

  const bothUploaded = uploadedPersons.A && uploadedPersons.B;

  const value = useMemo<FinanceCtx>(
    () => ({
      activePerson,
      setActivePerson,
      currentMonth,
      setCurrentMonth,
      txns,
      moveTransaction,
      openCategories,
      toggleCategory,
      openCoupleGroups,
      toggleCoupleGroup,
      taggedIds,
      toggleTag,
      goals,
      addGoal,
      updateGoalStatus,
      updateGoalFunded,
      goalHistory,
      goalPartnerSplit,
      setGoalPartnerSplit,
      uploadedPersons,
      simulateUpload,
      bothUploaded,
    }),
    [
      activePerson,
      currentMonth,
      txns,
      moveTransaction,
      openCategories,
      toggleCategory,
      openCoupleGroups,
      toggleCoupleGroup,
      taggedIds,
      toggleTag,
      goals,
      addGoal,
      updateGoalStatus,
      updateGoalFunded,
      goalHistory,
      goalPartnerSplit,
      setGoalPartnerSplit,
      uploadedPersons,
      simulateUpload,
      bothUploaded,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFinance(): FinanceCtx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
