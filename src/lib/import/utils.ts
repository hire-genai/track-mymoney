import {
  BASE_SAVINGS_SUBS,
  FIXED_SUBS,
  GUILT_SUBS,
  INCOME_SUBS,
  INVEST_SUBS,
} from "@/lib/finance-data";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function allowedCategories(extraSavings: string[] = []): string[] {
  return [
    ...INCOME_SUBS,
    ...FIXED_SUBS,
    ...INVEST_SUBS,
    ...BASE_SAVINGS_SUBS,
    ...extraSavings,
    ...GUILT_SUBS,
  ];
}

export function formatMonth(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function monthLabelFromIso(iso: string): string {
  return formatMonth(new Date(iso));
}

