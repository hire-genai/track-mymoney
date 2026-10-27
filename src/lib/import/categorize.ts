import type { TxType } from "@/lib/types";

/**
 * Deterministic rule-based categorization. Used as a fallback when the AI
 * categorizer is unavailable or returns an unexpected value. Rules are ordered
 * most-specific first — the first matching rule wins.
 */

interface Rule {
  category: string;
  keywords: string[];
}

const CREDIT_RULES: Rule[] = [
  { category: "Net monthly income", keywords: ["int.pd", "interest paid", "salary", "sal cr"] },
  { category: "Net monthly income", keywords: ["imps", "neft cr", "rtgs"] },
];

const DEBIT_RULES: Rule[] = [
  // Charges first — short, specific tokens that would otherwise be swallowed.
  { category: "Miscellaneous", keywords: ["sms chrg", "cgst", "sgst", "service charge", "bank chrg", "atm chrg", "min bal"] },

  // Utilities / phone — distinct from "store"
  { category: "Phone", keywords: ["myjio", "jio recharge", "airtel prepaid", "vi prepaid", "mobile recharge"] },
  { category: "Utilities", keywords: ["uppowercorp", "powercorp", "electricity", "bijli bill", "water bill", "gas bill", "broadband", "bsnl", "mahanagargas"] },

  // Transport, logistics, travel
  { category: "Car Payment / Transportation", keywords: ["irctc", "uber", "ola ", "rapido", "fuel", "petrol", "diesel", "hpcl", "iocl", "bpcl", "ekart", "xpressbees", "flipkart logistics", "delhivery"] },

  // Clothing
  { category: "Clothes", keywords: ["myntra", "ajio", "maxfashion", "max fashion", "lifestyle", "pantaloons", "fabindia", "zara"] },

  // Subscriptions (incl. Amazon Pay bill payments which are typically recurring)
  { category: "Subscriptions", keywords: ["netflix", "spotify", "hotstar", "prime video", "youtube premium", "googleplay", "google play", "amazonbillpa", "aqualogica", "subscription"] },

  // Debt / credit / BNPL
  { category: "Debt Payments", keywords: ["slicesmallfi", "slice ", "lazypay", "simpl ", "cred cc", "credit card", "cc payment", "loan emi", "loan repay", " emi "] },

  // Investments
  { category: "Stocks", keywords: ["zerodha", "groww", "upstox", "angelone", "angel broking", "icici direct", "paytm money", "mutual fund", "sip "] },
  { category: "Post-Tax Retirement Savings", keywords: ["ppf ", "nps ", "retirement", "pension"] },

  // Travel / vacations
  { category: "Vacations", keywords: ["makemytrip", "goibibo", "ixigo", "yatra", "booking.com", "oyo", "airbnb", "hotel ", "flight", "indigo air", "spicejet"] },

  // Insurance / rent
  { category: "Insurance", keywords: ["insurance", "policybazaar", "premium pay", " lic "] },
  { category: "Rent / Mortgage", keywords: ["rent pay", "landlord", "lease ", "housing emi"] },

  // Groceries — put after fashion so brand like "maxfashion" doesn't fall here first.
  // Covers vegetables, milk, kirana, Q-commerce.
  {
    category: "Groceries",
    keywords: [
      "zepto", "blinkit", "instamart", "dmart", "bigbasket", "jiomart",
      "vegetable", "sabji", "dudh", "milk ", "dudhbha",
      "kirana", "general store", "generalstore", "haryanastore", "balajigenera",
      "ankitgeneral", "ajitvegetable", "store", "grocer",
    ],
  },

  // Food/snacks/shopping — guilt-free bucket
  {
    category: "Guilt-Free Spending",
    keywords: [
      "zomato", "swiggy", "foodpanda", "restaurant", "cafe ", " bar ", "pizza",
      "sweet", "kanhiyasweets", "kanhaiyasweet", "foodies", "dawaghar",
      "shrishyam", "shriShyamJi", "meesho", "flipkart", "amazon ", "amazonpaygro",
      "chicken", "zoyachickens", "paan", "icecream",
    ],
  },

  // Gifts
  { category: "Gifts", keywords: ["gift ", "giftcard"] },
];

export function categorize(particulars: string, type: TxType): string {
  const text = particulars.toLowerCase();
  const rules = type === "credit" ? CREDIT_RULES : DEBIT_RULES;
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.category;
    }
  }
  return type === "credit" ? "Net monthly income" : "Miscellaneous";
}
