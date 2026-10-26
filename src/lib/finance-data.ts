import type { Goal, MonthSummary, Person, PersonId, TargetRule, Transaction } from "./types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format a Date as "Mmm YYYY" (e.g. "Oct 2026"). */
export function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Returns N most-recent months (current first), e.g. ["Oct 2026","Sep 2026",...]. */
export function recentMonths(count = 4, ref: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push(monthLabel(d));
  }
  return out;
}

/**
 * Rolling 4-month window ending at the real current month. Replaces the old
 * hardcoded Sep/Aug/Jul/Jun 2026 list so the dashboard reflects real time.
 * Demo seed data for Sep 2026 still slots in when that month is in range.
 */
export const MONTHS: string[] = recentMonths(4);
export type MonthName = string;

/** Convenience: this month's label. */
export const CURRENT_MONTH: string = MONTHS[0];

export const PEOPLE: Record<PersonId, Person> = {
  A: {
    id: "A",
    name: "You",
    initial: "DY",
    color: "#059669",
    bg: "linear-gradient(135deg, #059669, #047857)",
  },
  B: {
    id: "B",
    name: "Partner",
    initial: "PS",
    color: "#9333ea",
    bg: "linear-gradient(135deg, #a855f7, #7c3aed)",
  },
};

export const personA_SepTransactions: Transaction[] = [
  { id: "A-inc1", date: "03-09", particulars: "MPAY/SONUKUMARYAD/HDFC", amount: 2056.95, type: "credit", category: "Net monthly income" },
  { id: "A-inc2", date: "04-09", particulars: "MPAY/SONUKUMARYAD/HDFC", amount: 1500.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc3", date: "05-09", particulars: "MPAY/SANDEEPSINGH/UBIN", amount: 1800.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc4", date: "11-09", particulars: "MPAY/SONUKUMARYAD/HDFC", amount: 1300.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc5", date: "12-09", particulars: "MPAY/ShivamPandey/NESF", amount: 2100.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc6", date: "14-09", particulars: "MPAY/IMPS/SANDEEPKUMAR", amount: 30000.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc7", date: "20-09", particulars: "MPAY/SAMSATAVREJS/SBIN", amount: 4500.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc8", date: "21-09", particulars: "MPAY/ANUBHAVJAISWA/NESF", amount: 5500.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc9", date: "21-09", particulars: "MPAY/SAMSATAVREJS/SBIN", amount: 9500.0, type: "credit", category: "Net monthly income" },
  { id: "A-inc10", date: "26-09", particulars: "MPAY/SANDEEPSINGH/UBIN", amount: 1800.0, type: "credit", category: "Net monthly income" },
  { id: "A-rent1", date: "01-09", particulars: "RENT PAYMENT", amount: 15000.0, type: "debit", category: "Rent / Mortgage" },
  { id: "A-util1", date: "18-09", particulars: "UPPowerCorp", amount: 1808.0, type: "debit", category: "Utilities" },
  { id: "A-util2", date: "17-09", particulars: "MYJIO/HDFC", amount: 706.82, type: "debit", category: "Utilities" },
  { id: "A-ins1", date: "10-09", particulars: "INSURANCE PREMIUM", amount: 1200.0, type: "debit", category: "Insurance" },
  { id: "A-car1", date: "07-09", particulars: "DeviFillingS", amount: 500.0, type: "debit", category: "Car Payment / Transportation" },
  { id: "A-car2", date: "16-09", particulars: "Devifilling", amount: 150.0, type: "debit", category: "Car Payment / Transportation" },
  { id: "A-car3", date: "20-09", particulars: "ANKITKUMARCH", amount: 3600.0, type: "debit", category: "Car Payment / Transportation" },
  { id: "A-debt1", date: "14-09", particulars: "8115440893pty", amount: 10000.0, type: "debit", category: "Debt Payments" },
  { id: "A-groc1", date: "23-09", particulars: "MAXFASHIONIN", amount: 499.0, type: "debit", category: "Groceries" },
  { id: "A-groc2", date: "24-09", particulars: "ZEPTO/HDFC", amount: 68.0, type: "debit", category: "Groceries" },
  { id: "A-groc3", date: "25-09", particulars: "AjitVegetable", amount: 28.0, type: "debit", category: "Groceries" },
  { id: "A-clo1", date: "19-09", particulars: "MAXFASHIONIN", amount: 568.0, type: "debit", category: "Clothes" },
  { id: "A-clo2", date: "23-09", particulars: "MAXFASHIONIN", amount: 499.0, type: "debit", category: "Clothes" },
  { id: "A-phone1", date: "21-09", particulars: "Aqualogica", amount: 2695.5, type: "debit", category: "Phone" },
  { id: "A-sub1", date: "23-09", particulars: "GooglePlay", amount: 299.0, type: "debit", category: "Subscriptions" },
  { id: "A-misc1", date: "24-09", particulars: "Delhikemashh", amount: 105.0, type: "debit", category: "Miscellaneous" },
  { id: "A-inv1", date: "15-09", particulars: "POST-TAX RETIREMENT", amount: 5000.0, type: "debit", category: "Post-Tax Retirement Savings" },
  { id: "A-inv2", date: "18-09", particulars: "STOCKS PURCHASE", amount: 2000.0, type: "debit", category: "Stocks" },
  { id: "A-g1", date: "24-09", particulars: "Delhikemashh", amount: 105.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "A-g2", date: "17-09", particulars: "Kanhaiyasweet", amount: 400.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "A-g3", date: "14-09", particulars: "Deepakveritab", amount: 25.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "A-g4", date: "23-09", particulars: "ANMOLSTORE", amount: 10.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "A-g5", date: "16-09", particulars: "ASHIFMOBILEC", amount: 150.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "A-g6", date: "23-09", particulars: "REETAGUPTA", amount: 28.0, type: "debit", category: "Guilt-Free Spending" },
];

export const personB_SepTransactions: Transaction[] = [
  { id: "B-inc1", date: "01-09", particulars: "SALARY/ACME CORP", amount: 8500.0, type: "credit", category: "Net monthly income" },
  { id: "B-inc2", date: "15-09", particulars: "FREELANCE/UPWORK", amount: 3200.0, type: "credit", category: "Net monthly income" },
  { id: "B-inc3", date: "22-09", particulars: "DIVIDEND/ICICI", amount: 1200.0, type: "credit", category: "Net monthly income" },
  { id: "B-inc4", date: "28-09", particulars: "CASHBACK/CREDIT", amount: 450.0, type: "credit", category: "Net monthly income" },
  { id: "B-rent1", date: "01-09", particulars: "RENT PAYMENT", amount: 15000.0, type: "debit", category: "Rent / Mortgage" },
  { id: "B-util1", date: "20-09", particulars: "ACT FIBERNET", amount: 1200.0, type: "debit", category: "Utilities" },
  { id: "B-util2", date: "05-09", particulars: "TATA POWER", amount: 890.0, type: "debit", category: "Utilities" },
  { id: "B-ins1", date: "08-09", particulars: "LIC PREMIUM", amount: 2500.0, type: "debit", category: "Insurance" },
  { id: "B-car1", date: "12-09", particulars: "SHELL PETROL", amount: 2100.0, type: "debit", category: "Car Payment / Transportation" },
  { id: "B-car2", date: "25-09", particulars: "OLA CABS", amount: 450.0, type: "debit", category: "Car Payment / Transportation" },
  { id: "B-debt1", date: "10-09", particulars: "HDFC CREDIT CARD", amount: 8500.0, type: "debit", category: "Debt Payments" },
  { id: "B-groc1", date: "14-09", particulars: "BIGBASKET", amount: 3200.0, type: "debit", category: "Groceries" },
  { id: "B-groc2", date: "22-09", particulars: "DMART", amount: 1800.0, type: "debit", category: "Groceries" },
  { id: "B-groc3", date: "28-09", particulars: "RELIANCE FRESH", amount: 650.0, type: "debit", category: "Groceries" },
  { id: "B-clo1", date: "16-09", particulars: "ZARA", amount: 2800.0, type: "debit", category: "Clothes" },
  { id: "B-clo2", date: "24-09", particulars: "H&M", amount: 1500.0, type: "debit", category: "Clothes" },
  { id: "B-phone1", date: "18-09", particulars: "AIRTEL POSTPAID", amount: 999.0, type: "debit", category: "Phone" },
  { id: "B-sub1", date: "05-09", particulars: "NETFLIX", amount: 649.0, type: "debit", category: "Subscriptions" },
  { id: "B-sub2", date: "07-09", particulars: "SPOTIFY", amount: 119.0, type: "debit", category: "Subscriptions" },
  { id: "B-misc1", date: "27-09", particulars: "AMAZON PRIME", amount: 299.0, type: "debit", category: "Miscellaneous" },
  { id: "B-inv1", date: "10-09", particulars: "MUTUAL FUND SIP", amount: 5000.0, type: "debit", category: "Post-Tax Retirement Savings" },
  { id: "B-inv2", date: "15-09", particulars: "ZERODHA STOCKS", amount: 3000.0, type: "debit", category: "Stocks" },
  { id: "B-sav1", date: "05-09", particulars: "VACATION FUND", amount: 2500.0, type: "debit", category: "Goal: Family Vacation" },
  { id: "B-sav2", date: "12-09", particulars: "EMERGENCY FUND", amount: 1500.0, type: "debit", category: "Goal: Emergency Fund" },
  { id: "B-g1", date: "14-09", particulars: "ZOMATO", amount: 850.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "B-g2", date: "17-09", particulars: "PVR CINEMAS", amount: 1200.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "B-g3", date: "21-09", particulars: "BARBEQUE NATION", amount: 2200.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "B-g4", date: "26-09", particulars: "STARBUCKS", amount: 450.0, type: "debit", category: "Guilt-Free Spending" },
  { id: "B-g5", date: "29-09", particulars: "BOOKMYSHOW", amount: 600.0, type: "debit", category: "Guilt-Free Spending" },
];

/**
 * Deterministic pseudo-random dummy data for the Comparison tab so every month
 * in the rolling window has sensible bars even when the user hasn't uploaded a
 * statement yet. Seeded by month+person so numbers stay stable across renders.
 */
function seededNoise(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000; // 0..1
}

function buildMonthSummary(personId: PersonId, month: string): MonthSummary {
  const base = personId === "A"
    ? { income: 50000, fixed: 19000, invest: 6000, savings: 3000, guilt: 1700 }
    : { income: 12500, fixed: 29000, invest: 6700, savings: 3700, guilt: 4800 };
  const jitter = (key: string, spread: number) =>
    Math.round(base[key as keyof typeof base] * (0.85 + seededNoise(`${personId}|${month}|${key}`) * spread));
  const income = jitter("income", 0.3);
  const fixed = jitter("fixed", 0.2);
  const invest = jitter("invest", 0.35);
  const savings = jitter("savings", 0.4);
  const guilt = jitter("guilt", 0.5);
  const net = income - (fixed + invest + savings + guilt);
  return { income, fixed, invest, savings, guilt, net };
}

function buildPastMonths(): Record<PersonId, Record<string, MonthSummary>> {
  // Cover a wide window so Comparison always has dummy bars for the rolling
  // MONTHS set, no matter what the current real month is.
  const window = recentMonths(12);
  const makeMap = (pid: PersonId) =>
    Object.fromEntries(window.map((m) => [m, buildMonthSummary(pid, m)]));
  return { A: makeMap("A"), B: makeMap("B") };
}

export const pastMonths: Record<PersonId, Record<string, MonthSummary>> = buildPastMonths();

export const INITIAL_GOALS: Goal[] = [
  { id: "goal-vacation", name: "Family Vacation", subCat: "Goal: Family Vacation", icon: "plane", color: "linear-gradient(135deg,#0891b2,#0e7490)", target: 3000, deadline: "Dec 2026", status: "inprogress" },
  { id: "goal-emergency", name: "Emergency Fund", subCat: "Goal: Emergency Fund", icon: "shield", color: "linear-gradient(135deg,#059669,#047857)", target: 6000, deadline: "Jun 2027", status: "inprogress" },
  { id: "goal-car", name: "New Car", subCat: "Goal: New Car", icon: "car", color: "linear-gradient(135deg,#d97706,#b45309)", target: 5000, deadline: "Mar 2028", status: "onhold" },
  { id: "goal-wedding", name: "Wedding Anniversary", subCat: "Goal: Wedding Anniversary", icon: "ring", color: "linear-gradient(135deg,#db2777,#9d174d)", target: 2000, deadline: "Nov 2026", status: "completed" },
  { id: "goal-laptop", name: "New Laptop", subCat: "Goal: New Laptop", icon: "laptop", color: "linear-gradient(135deg,#16a34a,#15803d)", target: 1500, deadline: "Aug 2026", status: "cancelled" },
];

export const INITIAL_GOAL_HISTORY: Record<string, Record<string, number>> = {
  "goal-vacation": { "Jun 2026": 400, "Jul 2026": 400, "Aug 2026": 400, "Sep 2026": 0 },
  "goal-emergency": { "Jun 2026": 1500, "Jul 2026": 1500, "Aug 2026": 1800, "Sep 2026": 0 },
  "goal-car": { "Jun 2026": 300, "Jul 2026": 300, "Aug 2026": 250, "Sep 2026": 0 },
  "goal-wedding": { "Jun 2026": 500, "Jul 2026": 500, "Aug 2026": 500, "Sep 2026": 500 },
  "goal-laptop": { "Jun 2026": 200, "Jul 2026": 200, "Aug 2026": 100, "Sep 2026": 0 },
};

export const INITIAL_GOAL_PARTNER_SPLIT: Record<string, number> = {
  "goal-vacation": 0.4,
  "goal-emergency": 0.5,
  "goal-car": 0.5,
  "goal-wedding": 0.5,
  "goal-laptop": 0.3,
};

export const TARGETS: Record<string, TargetRule> = {
  Income: { min: null, max: null, label: "—", better: "higher" },
  Fixed: { min: 50, max: 60, label: "50–60%", better: "lower" },
  Investments: { min: 10, max: null, label: "≥10%", better: "higher" },
  Savings: { min: 5, max: null, label: "≥5%", better: "higher" },
  "Guilt-Free": { min: null, max: 35, label: "≤35%", better: "lower" },
};

export const FIXED_SUBS = [
  "Rent / Mortgage",
  "Utilities",
  "Insurance",
  "Car Payment / Transportation",
  "Debt Payments",
  "Groceries",
  "Clothes",
  "Phone",
  "Subscriptions",
  "Miscellaneous",
];

export const INVEST_SUBS = ["Post-Tax Retirement Savings", "Stocks", "Add your own here (invest)"];

export const BASE_SAVINGS_SUBS = ["Vacations", "Gifts", "Long Term Emergency Fund", "Add your own here (savings)"];

export const INCOME_SUBS = ["Gross monthly income", "Net monthly income"];

export const GUILT_SUBS = ["Guilt-Free Spending"];

export interface GroupDef {
  key: string;
  label: string;
  icon: string;
  color: string;
  subs: string[];
}

export function getColumnGroups(savingsSubs: string[]): [GroupDef[], GroupDef[]] {
  return [
    [
      { key: "Income", label: "INCOME", icon: "arrow-down", color: "#059669", subs: INCOME_SUBS },
      { key: "Investments", label: "INVESTMENTS", icon: "trending", color: "#4f46e5", subs: INVEST_SUBS },
    ],
    [
      { key: "Fixed", label: "FIXED COSTS", icon: "house", color: "#f59e0b", subs: FIXED_SUBS },
      { key: "Savings", label: "SAVINGS GOALS", icon: "piggy", color: "#0891b2", subs: savingsSubs },
      { key: "Guilt-Free", label: "GUILT-FREE", icon: "smile", color: "#db2777", subs: GUILT_SUBS },
    ],
  ];
}

export function getAllCategories(savingsSubs: string[]) {
  return [
    { group: "Income", subs: INCOME_SUBS },
    { group: "Fixed Costs", subs: FIXED_SUBS },
    { group: "Investments", subs: INVEST_SUBS },
    { group: "Savings", subs: savingsSubs },
    { group: "Guilt-Free", subs: GUILT_SUBS },
  ];
}
