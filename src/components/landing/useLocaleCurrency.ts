"use client";

import { useEffect, useState } from "react";

/** Country → ISO 4217 currency code. Covers the common ones. */
const COUNTRY_CURRENCY: Record<string, string> = {
  IN: "INR", US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR",
  AT: "EUR", BE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR", MT: "EUR",
  JP: "JPY", CN: "CNY", KR: "KRW", SG: "SGD", HK: "HKD", TW: "TWD",
  MY: "MYR", TH: "THB", ID: "IDR", PH: "PHP", VN: "VND", BD: "BDT", PK: "PKR", LK: "LKR", NP: "NPR",
  BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  ZA: "ZAR", NG: "NGN", EG: "EGP", KE: "KES", GH: "GHS", MA: "MAD",
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR", JO: "JOD",
  TR: "TRY", IL: "ILS", IR: "IRR",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", IS: "ISK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", HR: "EUR", RS: "RSD", UA: "UAH", RU: "RUB",
};

/**
 * IANA timezone → ISO country code. Timezone is the most reliable client-side
 * country signal (unlike navigator.language, it reflects where the user actually
 * IS, not just which language they prefer). Someone in Mumbai with
 * English-US language set still has Asia/Kolkata as timezone.
 */
const TIMEZONE_COUNTRY: Record<string, string> = {
  // India
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  // United States
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "America/Detroit": "US", "America/Indianapolis": "US", "America/Indiana/Indianapolis": "US",
  "America/Boise": "US", "America/Honolulu": "US", "Pacific/Honolulu": "US",
  // United Kingdom
  "Europe/London": "GB", "Europe/Belfast": "GB",
  // Canada
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Montreal": "CA",
  "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
  // Australia & NZ
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
  "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ",
  // Europe (EUR)
  "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Madrid": "ES",
  "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Dublin": "IE",
  "Europe/Lisbon": "PT", "Europe/Vienna": "AT", "Europe/Brussels": "BE",
  "Europe/Helsinki": "FI", "Europe/Athens": "GR", "Europe/Luxembourg": "LU",
  "Europe/Bratislava": "SK", "Europe/Ljubljana": "SI", "Europe/Tallinn": "EE",
  "Europe/Riga": "LV", "Europe/Vilnius": "LT", "Europe/Malta": "MT", "Asia/Nicosia": "CY",
  // Nordics / other EU
  "Europe/Zurich": "CH", "Europe/Stockholm": "SE", "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK", "Atlantic/Reykjavik": "IS",
  "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO", "Europe/Sofia": "BG", "Europe/Zagreb": "HR",
  "Europe/Belgrade": "RS", "Europe/Kiev": "UA", "Europe/Kyiv": "UA", "Europe/Moscow": "RU",
  "Europe/Istanbul": "TR",
  // East & SE Asia
  "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Seoul": "KR", "Asia/Singapore": "SG", "Asia/Taipei": "TW",
  "Asia/Kuala_Lumpur": "MY", "Asia/Bangkok": "TH", "Asia/Jakarta": "ID",
  "Asia/Manila": "PH", "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN",
  // South Asia
  "Asia/Dhaka": "BD", "Asia/Karachi": "PK", "Asia/Colombo": "LK", "Asia/Kathmandu": "NP",
  // Latin America
  "America/Sao_Paulo": "BR", "America/Mexico_City": "MX",
  "America/Buenos_Aires": "AR", "America/Argentina/Buenos_Aires": "AR",
  "America/Santiago": "CL", "America/Bogota": "CO", "America/Lima": "PE",
  // Africa
  "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG", "Africa/Cairo": "EG",
  "Africa/Nairobi": "KE", "Africa/Accra": "GH", "Africa/Casablanca": "MA",
  // Middle East
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW", "Asia/Bahrain": "BH", "Asia/Muscat": "OM",
  "Asia/Amman": "JO", "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL", "Asia/Tehran": "IR",
};

interface Locale {
  locale: string;
  country: string;
  currency: string;
  symbol: string;
  /** Format an integer as currency with no decimals (clean for demo numbers). */
  format: (n: number) => string;
}

function countryFromTimezone(tz: string | undefined): string | null {
  if (!tz) return null;
  if (TIMEZONE_COUNTRY[tz]) return TIMEZONE_COUNTRY[tz];
  // Loose fallback: "America/*" → US, "Europe/*" → DE, "Asia/*" → IN, "Africa/*" → ZA, "Australia/*" → AU
  const prefix = tz.split("/")[0];
  if (prefix === "Australia") return "AU";
  return null;
}

function countryFromLanguage(language: string | undefined): string | null {
  if (!language) return null;
  try {
    const L = new Intl.Locale(language);
    return (L.region ?? language.split("-")[1] ?? "").toUpperCase() || null;
  } catch {
    const parts = language.split("-");
    return parts.length > 1 ? parts[1].toUpperCase() : null;
  }
}

function buildLocale({ language, country }: { language: string; country: string }): Locale {
  const currency = COUNTRY_CURRENCY[country] ?? "USD";

  // Prefer the user's language for number-formatting conventions (digit grouping, etc.),
  // but anchor the currency to their actual country.
  const fmt = new Intl.NumberFormat(language || "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });

  let symbol = "$";
  try {
    const parts = fmt.formatToParts(0);
    const sym = parts.find((p) => p.type === "currency");
    if (sym) symbol = sym.value;
  } catch {
    /* ignore */
  }

  return {
    locale: language,
    country,
    currency,
    symbol,
    format: (n: number) => fmt.format(n),
  };
}

/**
 * SSR-safe. Starts with a neutral default (en-US / USD) so first paint doesn't
 * cause a hydration mismatch, then swaps to the user's real country on mount.
 *
 * Detection order:
 *   1. IANA timezone (most reliable — reflects physical location)
 *   2. navigator.language region tag (fallback)
 *   3. "US" (final fallback)
 */
export function useLocaleCurrency(): Locale {
  const [loc, setLoc] = useState<Locale>(() =>
    buildLocale({ language: "en-US", country: "US" }),
  );

  useEffect(() => {
    try {
      const language = navigator.language || "en-US";
      let country: string | null = null;
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        country = countryFromTimezone(tz);
      } catch {
        /* fall through */
      }
      if (!country) country = countryFromLanguage(language);
      if (!country) country = "US";

      setLoc(buildLocale({ language, country }));
    } catch {
      /* keep default */
    }
  }, []);

  return loc;
}
