import {
  BASE_SAVINGS_SUBS,
  FIXED_SUBS,
  INVEST_SUBS,
  MONTHS,
  TARGETS,
} from "./finance-data";
import type { Goal, MonthSummary, PersonId, StatusResult, Transaction } from "./types";

export function fmt(n: number): string {
  return (
    "₹" +
    Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtShort(n: number): string {
  return (
    "₹" +
    Math.abs(n).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })
  );
}

export function getSavingsSubs(goals: Goal[]): string[] {
  return [...BASE_SAVINGS_SUBS, ...goals.map((g) => g.subCat)];
}

export function getMonthTotals(txs: Transaction[]): MonthSummary {
  let income = 0;
  let fixedRaw = 0;
  let miscActual = 0;
  let invest = 0;
  let savings = 0;
  let guilt = 0;

  for (const tx of txs) {
    const amt = tx.amount;
    if (tx.type === "credit") {
      income += amt;
      continue;
    }
    const cat = tx.category;
    if (FIXED_SUBS.filter((s) => s !== "Miscellaneous").includes(cat)) {
      fixedRaw += amt;
    } else if (cat === "Miscellaneous") {
      miscActual += amt;
    } else if (INVEST_SUBS.includes(cat)) {
      invest += amt;
    } else if (BASE_SAVINGS_SUBS.includes(cat) || cat.startsWith("Goal: ")) {
      savings += amt;
    } else if (cat === "Guilt-Free Spending") {
      guilt += amt;
    } else {
      fixedRaw += amt;
    }
  }

  const autoMisc = fixedRaw * 0.15;
  const effectiveMisc = Math.max(miscActual, autoMisc);
  const fixed = fixedRaw + effectiveMisc;
  const net = income - (fixed + invest + savings + guilt);
  return { income, fixed, invest, savings, guilt, net };
}

export function evalPctStatus(
  groupKey: string,
  amount: number,
  income: number,
): StatusResult {
  const t = TARGETS[groupKey];
  if (!t || !income || income <= 0) {
    return { pct: null, status: "neutral", label: "—", targetLabel: t ? t.label : "—" };
  }
  const pct = (amount / income) * 100;
  const targetLabel = t.label;

  if (groupKey === "Income") {
    return { pct, status: "neutral", label: `${pct.toFixed(0)}%`, targetLabel: "—" };
  }

  if (t.better === "lower") {
    if (t.min !== null && pct < t.min) return { pct, status: "good", label: `${pct.toFixed(0)}%`, targetLabel };
    if (t.max !== null && pct <= t.max) return { pct, status: "good", label: `${pct.toFixed(0)}%`, targetLabel };
    if (t.max !== null && pct <= t.max + 5) return { pct, status: "warn", label: `${pct.toFixed(0)}%`, targetLabel };
    return { pct, status: "bad", label: `${pct.toFixed(0)}%`, targetLabel };
  }

  if (t.min !== null && pct >= t.min) return { pct, status: "good", label: `${pct.toFixed(0)}%`, targetLabel };
  if (t.min !== null && pct >= t.min - 2) return { pct, status: "warn", label: `${pct.toFixed(0)}%`, targetLabel };
  return { pct, status: "bad", label: `${pct.toFixed(0)}%`, targetLabel };
}

export function buildStatusMap(totals: MonthSummary): Record<string, StatusResult> {
  const map: Record<string, StatusResult> = {};
  const keys = ["Income", "Fixed", "Investments", "Savings", "Guilt-Free"] as const;
  const amountFor = (k: string): number => {
    switch (k) {
      case "Income": return totals.income;
      case "Fixed": return totals.fixed;
      case "Investments": return totals.invest;
      case "Savings": return totals.savings;
      case "Guilt-Free": return totals.guilt;
      default: return 0;
    }
  };
  for (const k of keys) {
    map[k] = evalPctStatus(k, amountFor(k), totals.income);
  }
  return map;
}

export interface GoalFundedResult {
  funded: number;
  statusAfter: Goal["status"];
}

export function computeGoalFunded(
  goal: Goal,
  txnsByPersonMonth: Record<PersonId, Record<string, Transaction[]>>,
  goalHistory: Record<string, Record<string, number>>,
): GoalFundedResult {
  let realTotal = 0;
  (["A", "B"] as PersonId[]).forEach((pid) => {
    MONTHS.forEach((m) => {
      const list = txnsByPersonMonth[pid]?.[m] || [];
      for (const tx of list) {
        if (tx.type === "debit" && tx.category === goal.subCat) realTotal += tx.amount;
      }
    });
  });
  const hist = goalHistory[goal.id] || {};
  let histTotal = 0;
  for (const m of Object.keys(hist)) {
    if (m !== "Sep 2026") histTotal += hist[m];
  }
  const funded = realTotal + histTotal;
  let statusAfter = goal.status;
  if (funded >= goal.target && statusAfter !== "cancelled" && statusAfter !== "completed") {
    statusAfter = "completed";
  }
  return { funded, statusAfter };
}

export function computeGoalMonthlySplit(
  goal: Goal,
  txnsByPersonMonth: Record<PersonId, Record<string, Transaction[]>>,
  goalHistory: Record<string, Record<string, number>>,
  goalPartnerSplit: Record<string, number>,
): { A: Record<string, number>; B: Record<string, number> } {
  const partnerFrac = goalPartnerSplit[goal.id] ?? 0.5;
  const A: Record<string, number> = {};
  const B: Record<string, number> = {};
  MONTHS.forEach((month) => {
    let sumA = 0;
    let sumB = 0;
    for (const tx of txnsByPersonMonth.A?.[month] ?? []) {
      if (tx.type === "debit" && tx.category === goal.subCat) sumA += tx.amount;
    }
    for (const tx of txnsByPersonMonth.B?.[month] ?? []) {
      if (tx.type === "debit" && tx.category === goal.subCat) sumB += tx.amount;
    }
    const hist = goalHistory[goal.id] || {};
    const histVal = hist[month] || 0;
    if (sumA === 0 && sumB === 0 && histVal) {
      sumB = histVal * partnerFrac;
      sumA = histVal - sumB;
    } else if (sumA === 0 && histVal) {
      sumA = histVal * (1 - partnerFrac);
    } else if (sumB === 0 && histVal) {
      sumB = histVal * partnerFrac;
    }
    A[month] = sumA;
    B[month] = sumB;
  });
  return { A, B };
}

export function sumSubCategory(txs: Transaction[], sub: string): number {
  let total = 0;
  for (const tx of txs) {
    if (tx.category !== sub) continue;
    total += tx.type === "credit" ? tx.amount : -tx.amount;
  }
  return total;
}

/** Sum a subcategory using debit-positive semantics (what the side-by-side couple view shows). */
export function sumSubCategoryDebit(txs: Transaction[], sub: string): number {
  let total = 0;
  for (const tx of txs) {
    if (tx.category !== sub) continue;
    total += tx.type === "credit" ? -tx.amount : tx.amount;
  }
  return total;
}

export function calcGroupTotal(subs: string[], txs: Transaction[]): number {
  let total = 0;
  for (const sub of subs) {
    for (const tx of txs) {
      if (tx.category === sub) {
        total += tx.type === "credit" ? tx.amount : -tx.amount;
      }
    }
  }
  return total;
}
