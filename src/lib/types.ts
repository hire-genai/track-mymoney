export type PersonId = "A" | "B";

export type TxType = "credit" | "debit";

export interface Transaction {
  id: string;
  date: string;
  particulars: string;
  amount: number;
  type: TxType;
  category: string;
}

export type GoalStatus = "inprogress" | "onhold" | "completed" | "cancelled";

export interface Goal {
  id: string;
  name: string;
  subCat: string;
  icon: string;
  color: string;
  target: number;
  deadline: string;
  status: GoalStatus;
}

export interface MonthSummary {
  income: number;
  fixed: number;
  invest: number;
  savings: number;
  guilt: number;
  net: number;
}

export interface TargetRule {
  min: number | null;
  max: number | null;
  label: string;
  better: "higher" | "lower";
}

export type StatusLevel = "good" | "warn" | "bad" | "neutral";

export interface StatusResult {
  pct: number | null;
  status: StatusLevel;
  label: string;
  targetLabel: string;
}

export interface Person {
  id: PersonId;
  name: string;
  initial: string;
  color: string;
  bg: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}
