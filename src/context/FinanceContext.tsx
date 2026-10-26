"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  CURRENT_MONTH,
  INITIAL_GOALS,
  INITIAL_GOAL_HISTORY,
  INITIAL_GOAL_PARTNER_SPLIT,
  INCOME_SUBS,
  MONTHS,
  personA_SepTransactions,
  personB_SepTransactions,
} from "@/lib/finance-data";
import type { Goal, GoalStatus, PersonId, Transaction } from "@/lib/types";

export type TxnStore = Record<PersonId, Record<string, Transaction[]>>;
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
  authenticated: boolean;
  importsCount: number;
  importsByPerson: Record<PersonId, number>;
  pendingImportFile: File | null;
  setPendingImportFile: (f: File | null) => void;
  /** UploadSection registers an opener here; CoupleTab calls it to open the native file picker. */
  registerImportPicker: (fn: ((id: PersonId) => void) | null) => void;
  requestImportFor: (id: PersonId) => void;
}

const Context = createContext<FinanceCtx | null>(null);

function buildDemoTxns(): TxnStore {
  const emptyMonths = () =>
    Object.fromEntries(MONTHS.map((m) => [m, [] as Transaction[]])) as Record<string, Transaction[]>;
  return {
    A: { ...emptyMonths(), "Sep 2026": personA_SepTransactions.map((t) => ({ ...t })) },
    B: { ...emptyMonths(), "Sep 2026": personB_SepTransactions.map((t) => ({ ...t })) },
  };
}

interface ProviderProps {
  children: React.ReactNode;
  /** When provided, uses this store instead of the demo seed. Pass `{}` for an empty authenticated user. */
  initialTxns?: TxnStore;
  /** True when the user is authenticated (controls default upload-state flags). */
  authenticated?: boolean;
  /** Real import file counts from DB (authenticated users). */
  importsByPerson?: Record<PersonId, number>;
}

export function FinanceProvider({
  children,
  initialTxns,
  authenticated = false,
  importsByPerson: importsByPersonProp,
}: ProviderProps) {
  const seedTxns: TxnStore = initialTxns ?? buildDemoTxns();
  const importsByPerson: Record<PersonId, number> = importsByPersonProp ?? { A: 0, B: 0 };
  const importsCount = importsByPerson.A + importsByPerson.B;

  /**
   * Default month:
   *  - Unauthenticated demo: Sep 2026 (where the seeded demo data lives).
   *  - Authenticated: the real current month. If the user has uploaded data for
   *    a different month, that still appears in the month tabs — but we open on
   *    "today" by default so a fresh account sees the right empty state.
   */
  const defaultMonth = authenticated ? CURRENT_MONTH : "Sep 2026";
  const [activePerson, setActivePerson] = useState<PersonId>("A");
  const [currentMonth, setCurrentMonth] = useState<string>(defaultMonth);
  const [txns, setTxns] = useState<TxnStore>(seedTxns);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openCoupleGroups, setOpenCoupleGroups] = useState<Set<string>>(new Set());
  const [taggedIds, setTaggedIds] = useState<Set<string>>(new Set());
  // Authenticated users start with a clean goals list — demo goals/history/split
  // only seed the unauthenticated landing preview.
  const [goals, setGoals] = useState<Goal[]>(() =>
    authenticated ? [] : INITIAL_GOALS.map((g) => ({ ...g })),
  );
  const [goalHistory, setGoalHistory] = useState<Record<string, Record<string, number>>>(() =>
    authenticated ? {} : structuredClone(INITIAL_GOAL_HISTORY),
  );
  const [goalPartnerSplit, setGoalPartnerSplitState] = useState<Record<string, number>>(() =>
    authenticated ? {} : { ...INITIAL_GOAL_PARTNER_SPLIT },
  );
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const importPickerRef = useRef<((id: PersonId) => void) | null>(null);
  const registerImportPicker = useCallback((fn: ((id: PersonId) => void) | null) => {
    importPickerRef.current = fn;
  }, []);
  const requestImportFor = useCallback((id: PersonId) => {
    if (importPickerRef.current) importPickerRef.current(id);
  }, []);

  // After router.refresh() (e.g. commit of an import), the server layout re-runs
  // and passes a fresh `initialTxns` snapshot. Sync it into state so the dashboard
  // KPIs reflect the newly saved transactions without a full page reload.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!authenticated || !initialTxns) return;
    setTxns(initialTxns);
  }, [authenticated, initialTxns]);
  const [uploadedPersons, setUploadedPersons] = useState<UploadMap>(() => {
    if (!authenticated) return { A: true, B: false };
    // Authenticated: a person is "uploaded" iff they have real persisted import files AND txn rows.
    // Transaction presence is the authoritative signal; import file is just the receipt.
    const aHas =
      importsByPerson.A > 0 ||
      Object.values(seedTxns.A).some((list) => list.length > 0);
    const bHas =
      importsByPerson.B > 0 ||
      Object.values(seedTxns.B).some((list) => list.length > 0);
    return { A: aHas, B: bHas };
  });

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
      let nextType: "credit" | "debit" | null = null;
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
        nextType = tx.type;
        const updated = [...list];
        updated[idx] = tx;
        return {
          ...prev,
          [personId]: { ...prev[personId], [month]: updated },
        };
      });

      // Persist to DB for authenticated users whose rows came from loadUserData
      // (ids are `db-<row.id>`). Demo rows don't carry a db id — skip the fetch.
      if (!authenticated || !txId.startsWith("db-")) return;
      const dbId = Number(txId.slice(3));
      if (!Number.isInteger(dbId) || dbId <= 0) return;
      void fetch(`/api/transactions/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCat, type: nextType ?? undefined }),
      }).catch(() => {
        // Network blips don't roll back the UI — a page refresh will reconcile
        // against the DB and surface the authoritative state.
      });
    },
    [authenticated],
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

  const simulateUpload = useCallback(
    (id: PersonId) => {
      // Demo-only helper for the unauthenticated landing page.
      // For authenticated users this is a strict no-op: real uploads must go through
      // /dashboard/import → POST /api/import/commit, and state refreshes from the DB.
      if (authenticated) return;
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
    },
    [authenticated],
  );

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
      authenticated,
      importsCount,
      importsByPerson,
      pendingImportFile,
      setPendingImportFile,
      registerImportPicker,
      requestImportFor,
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
      authenticated,
      importsCount,
      importsByPerson,
      pendingImportFile,
      registerImportPicker,
      requestImportFor,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFinance(): FinanceCtx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
