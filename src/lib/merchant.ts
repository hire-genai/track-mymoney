/**
 * Convert a raw bank-statement description (UPI/IMPS/POS gibberish) into a
 * clean, human-readable merchant name for display. Pure function — no I/O.
 *
 * Strategy:
 *   1. Try the deterministic MERCHANT_MAP (regex → canonical name).
 *   2. Otherwise strip common rail prefixes (UPI/MPAY/NEFT/…), split on the
 *      usual delimiters, pick the longest alphabetic token and title-case it.
 *
 * This never fabricates a name: if nothing recognisable survives, the original
 * description (truncated) is returned so the user still sees something.
 */

interface MerchantRule {
  pattern: RegExp;
  name: string;
}

export const MERCHANT_MAP: MerchantRule[] = [
  // Fashion
  { pattern: /myntra/i, name: "Myntra" },
  { pattern: /snitch/i, name: "Snitch Apparel" },
  { pattern: /ajio/i, name: "AJIO" },
  { pattern: /maxfashion|max\s*fashion/i, name: "Max Fashion" },
  { pattern: /pantaloons/i, name: "Pantaloons" },
  { pattern: /fabindia/i, name: "FabIndia" },
  { pattern: /\bzara\b/i, name: "Zara" },
  { pattern: /\blifestyle\b/i, name: "Lifestyle" },

  // Quick commerce / grocery
  { pattern: /blinkit/i, name: "Blinkit" },
  { pattern: /zepto/i, name: "Zepto" },
  { pattern: /instamart/i, name: "Instamart" },
  { pattern: /bigbasket/i, name: "BigBasket" },
  { pattern: /jiomart/i, name: "JioMart" },
  { pattern: /\bdmart\b/i, name: "DMart" },
  { pattern: /balaji\s*gener/i, name: "Balaji General" },
  { pattern: /haryana\s*store/i, name: "Haryana Store" },
  { pattern: /hansh\s*dudh|dudhbhandar/i, name: "Hansh Dudhbhandar" },
  { pattern: /ankit\s*general/i, name: "Ankit General" },
  { pattern: /ajit\s*vegetable/i, name: "Ajit Vegetables" },
  { pattern: /shri\s*shyam/i, name: "Shri Shyam" },

  // Food / dining
  { pattern: /zomato/i, name: "Zomato" },
  { pattern: /swiggy/i, name: "Swiggy" },
  { pattern: /foodpanda/i, name: "Foodpanda" },
  { pattern: /kanh[iy]a?ya?\s*sweet/i, name: "Kanhaiya Sweets" },
  { pattern: /zoya\s*chicken/i, name: "Zoya Chickens" },
  { pattern: /dawa\s*ghar|dawaghar/i, name: "Dawaghar" },

  // Transport & logistics
  { pattern: /\buber\b/i, name: "Uber" },
  { pattern: /\bola\b/i, name: "Ola" },
  { pattern: /rapido/i, name: "Rapido" },
  { pattern: /irctc/i, name: "IRCTC" },
  { pattern: /ekart/i, name: "Ekart" },
  { pattern: /xpressbees/i, name: "XpressBees" },
  { pattern: /delhivery/i, name: "Delhivery" },

  // Fuel
  { pattern: /hpcl|hindustan\s*petroleum/i, name: "HPCL" },
  { pattern: /iocl|indian\s*oil/i, name: "Indian Oil" },
  { pattern: /bpcl|bharat\s*petroleum/i, name: "BPCL" },

  // Subscriptions / digital
  { pattern: /netflix/i, name: "Netflix" },
  { pattern: /spotify/i, name: "Spotify" },
  { pattern: /hotstar/i, name: "Hotstar" },
  { pattern: /prime\s*video|primevideo/i, name: "Prime Video" },
  { pattern: /youtube\s*premium|ytpremium/i, name: "YouTube Premium" },
  { pattern: /google\s*play|googleplay/i, name: "Google Play" },
  { pattern: /aqualogica/i, name: "Aqualogica" },
  { pattern: /amazon\s*bill\s*pa|amazonbillpa/i, name: "Amazon Pay Bills" },

  // Shopping
  { pattern: /amazon/i, name: "Amazon" },
  { pattern: /flipkart/i, name: "Flipkart" },
  { pattern: /meesho/i, name: "Meesho" },

  // Telecom
  { pattern: /myjio|jio\s*recharge|\bjio\b/i, name: "Jio" },
  { pattern: /airtel/i, name: "Airtel" },
  { pattern: /\bvi\b|vodafone\s*idea/i, name: "Vi" },
  { pattern: /\bbsnl\b/i, name: "BSNL" },

  // Utilities
  { pattern: /uppowercorp|power\s*corp/i, name: "Power Corporation" },
  { pattern: /mahanagar\s*gas|mahanagargas/i, name: "Mahanagar Gas" },

  // Investments / brokerage
  { pattern: /zerodha/i, name: "Zerodha" },
  { pattern: /groww/i, name: "Groww" },
  { pattern: /upstox/i, name: "Upstox" },
  { pattern: /angel\s*one|angelone|angel\s*broking/i, name: "Angel One" },
  { pattern: /icici\s*direct/i, name: "ICICI Direct" },
  { pattern: /paytm\s*money/i, name: "Paytm Money" },

  // Debt / BNPL
  { pattern: /slice\s*small\s*fi|slicesmallfi|\bslice\b/i, name: "Slice Small Finance" },
  { pattern: /lazypay/i, name: "LazyPay" },
  { pattern: /\bsimpl\b/i, name: "Simpl" },
  { pattern: /\bcred\b/i, name: "CRED" },

  // Travel
  { pattern: /makemytrip/i, name: "MakeMyTrip" },
  { pattern: /goibibo/i, name: "Goibibo" },
  { pattern: /ixigo/i, name: "ixigo" },
  { pattern: /yatra/i, name: "Yatra" },
  { pattern: /booking\.?\s*com/i, name: "Booking.com" },
  { pattern: /\boyo\b/i, name: "OYO" },
  { pattern: /airbnb/i, name: "Airbnb" },
  { pattern: /\bindigo\b/i, name: "IndiGo" },
  { pattern: /spicejet/i, name: "SpiceJet" },

  // Insurance
  { pattern: /policybazaar/i, name: "Policybazaar" },
  { pattern: /\blic\b/i, name: "LIC" },

  // Income
  { pattern: /salary|\bsal\s*cr/i, name: "Salary Credit" },
  { pattern: /int\.?\s*pd|interest\s*paid|interest\s*cr/i, name: "Interest Credit" },
];

// Rail prefixes commonly leading UPI/IMPS/NEFT descriptions.
const RAIL_PREFIX = /^(upi|mpay|imps|neft|rtgs|pos|atm|chg|bil|bbps|ach|ecs|pay(?:u|tm)?|bhim|gpay|phonepe|txn|trtr|p2a|p2m|cms)[-/_@\s]+/i;

// Noise tokens we never want surfacing as the merchant name.
const NOISE = /^(upi|imps|neft|rtgs|hdfc|icici|axis|sbi|kotak|yes|idfc|pnb|bob|hsbc|amazonpay|phonepe|paytm|gpay|bhim|utib|ybl|okaxis|oksbi|okicici|okhdfcbank|ibl|paytmbank|apl|ok)$/i;

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function fallbackClean(raw: string): string {
  const trimmed = raw.replace(RAIL_PREFIX, "").trim();
  if (!trimmed) return raw.slice(0, 32);

  // Split on common bank-statement delimiters.
  const parts = trimmed
    .split(/[\/|_\-@\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^\d+$/.test(p)) // drop pure digit sequences (ref ids)
    .filter((p) => !NOISE.test(p));

  // Prefer the longest alphabetic token — usually the merchant.
  const alphaParts = parts
    .filter((p) => /[a-zA-Z]/.test(p))
    .sort((a, b) => b.length - a.length);

  const pick = alphaParts[0] ?? parts[parts.length - 1] ?? trimmed;

  // Insert spaces at camel-case boundaries, normalise whitespace.
  const spaced = pick
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  const out = titleCase(spaced);
  if (!out) return raw.slice(0, 32);
  return out.length > 32 ? `${out.slice(0, 30)}…` : out;
}

export function extractMerchant(particulars: string): string {
  if (!particulars || typeof particulars !== "string") return "Unknown";
  for (const { pattern, name } of MERCHANT_MAP) {
    if (pattern.test(particulars)) return name;
  }
  return fallbackClean(particulars);
}
