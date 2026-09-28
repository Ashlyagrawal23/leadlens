/**
 * Hardcoded homes the matcher is allowed to recommend.
 *
 * The list is in code, not from the model, so a property id the model
 * invents can be dropped. Cities overlap on purpose: a 3 BHK buyer in
 * Noida should see more than one candidate, and a ₹50 lakh Pune budget
 * should match nothing.
 */

export type PropertyType = "1BHK" | "2BHK" | "3BHK" | "villa" | "plot";

export interface Property {
  id: string;
  title: string;
  /** Canonical city key. See CITY_ALIASES. */
  city: string;
  locality: string;
  type: PropertyType;
  priceInr: number;
  sqft: number;
  possessionStatus: string;
  amenities: string[];
  highlight: string;
}

const CITY_ALIASES: Record<string, string> = {
  gurgaon: "gurugram",
  gurugram: "gurugram",
  bangalore: "bengaluru",
  bengaluru: "bengaluru",
  bombay: "mumbai",
  mumbai: "mumbai",
  noida: "noida",
  pune: "pune",
  hyderabad: "hyderabad",
  delhi: "delhi",
};

export const NO_MATCH_MESSAGE =
  "No inventory in this range, consider raising the budget or widening the location";

export const INVENTORY: Property[] = [
  {
    id: "gg-dlf-3bhk",
    title: "DLF Phase 3 high floor",
    city: "gurugram",
    locality: "DLF Phase 3",
    type: "3BHK",
    priceInr: 2_35_00_000,
    sqft: 1850,
    possessionStatus: "Ready to move",
    amenities: ["Covered parking", "Power backup", "Club"],
    highlight: "Ready 3 BHK on a high floor, one covered parking included.",
  },
  {
    id: "gg-65-3bhk",
    title: "Sector 65 garden 3 BHK",
    city: "gurugram",
    locality: "Sector 65",
    type: "3BHK",
    priceInr: 1_90_00_000,
    sqft: 1650,
    possessionStatus: "Under construction · possession Dec 2027",
    amenities: ["Two parkings", "Metro nearby"],
    highlight: "Cheaper 3 BHK, but possession is still two years out.",
  },
  {
    id: "noida-150-3bhk",
    title: "Sector 150 park-facing",
    city: "noida",
    locality: "Sector 150",
    type: "3BHK",
    priceInr: 1_68_00_000,
    sqft: 1750,
    possessionStatus: "Ready to move",
    amenities: ["Two covered parkings", "Park facing", "Metro nearby"],
    highlight: "Ready, park-facing, two parkings, inside a 1.6–1.8 Cr budget.",
  },
  {
    id: "noida-137-3bhk",
    title: "Sector 137 metro 3 BHK",
    city: "noida",
    locality: "Sector 137",
    type: "3BHK",
    priceInr: 1_42_00_000,
    sqft: 1450,
    possessionStatus: "Under construction · possession Jun 2027",
    amenities: ["One parking", "Metro nearby"],
    highlight: "Lower price, smaller rooms, not ready.",
  },
  {
    id: "noida-plot",
    title: "Sector 150 plot",
    city: "noida",
    locality: "Sector 150",
    type: "plot",
    priceInr: 1_55_00_000,
    sqft: 1800,
    possessionStatus: "Ready to move",
    amenities: ["Corner plot"],
    highlight: "Same budget band as a flat, but it is land, not a home.",
  },
  {
    id: "wf-2bhk-ready",
    title: "Hope Farm 2 BHK",
    city: "bengaluru",
    locality: "Whitefield, Hope Farm",
    type: "2BHK",
    priceInr: 92_00_000,
    sqft: 1120,
    possessionStatus: "Ready to move",
    amenities: ["Deck", "Covered parking"],
    highlight: "Ready 2 BHK near Hope Farm, just under ₹95 lakhs.",
  },
  {
    id: "wf-2bhk-uc",
    title: "Whitefield brigade-style 2 BHK",
    city: "bengaluru",
    locality: "Whitefield",
    type: "2BHK",
    priceInr: 1_05_00_000,
    sqft: 1240,
    possessionStatus: "Under construction · possession Mar 2027",
    amenities: ["Larger bedroom", "Club"],
    highlight: "Bigger bedroom than the ready option, slightly over ₹95 lakhs.",
  },
  {
    id: "andheri-1bhk",
    title: "Andheri East metro 1 BHK",
    city: "mumbai",
    locality: "Andheri East",
    type: "1BHK",
    priceInr: 1_22_00_000,
    sqft: 540,
    possessionStatus: "Ready to move",
    amenities: ["Near metro"],
    highlight: "Ready 1 BHK for rental, inside a 1.1–1.3 Cr band.",
  },
  {
    id: "andheri-1bhk-small",
    title: "Andheri East compact 1 BHK",
    city: "mumbai",
    locality: "Andheri East",
    type: "1BHK",
    priceInr: 98_00_000,
    sqft: 430,
    possessionStatus: "Ready to move",
    amenities: ["Near metro"],
    highlight: "Lower ticket, smaller carpet, easier yield math.",
  },
  {
    id: "hinjewadi-3bhk",
    title: "Hinjewadi 3 BHK",
    city: "pune",
    locality: "Hinjewadi",
    type: "3BHK",
    priceInr: 1_15_00_000,
    sqft: 1400,
    possessionStatus: "Ready to move",
    amenities: ["Covered parking"],
    highlight: "The realistic 3 BHK price in this pocket, well above ₹50 lakhs.",
  },
  {
    id: "gachibowli-2bhk",
    title: "Gachibowli 2 BHK",
    city: "hyderabad",
    locality: "Gachibowli",
    type: "2BHK",
    priceInr: 85_00_000,
    sqft: 1180,
    possessionStatus: "Ready to move",
    amenities: ["Gym"],
    highlight: "Lowest ready flat in this list for Gachibowli.",
  },
  {
    id: "gachibowli-villa",
    title: "Gachibowli villa",
    city: "hyderabad",
    locality: "Gachibowli",
    type: "villa",
    priceInr: 3_40_00_000,
    sqft: 2800,
    possessionStatus: "Ready to move",
    amenities: ["Private parking", "Garden"],
    highlight: "A villa, only relevant if the budget is far above a flat.",
  },
];

export function propertyById(id: string): Property | undefined {
  return INVENTORY.find((property) => property.id === id);
}

/** "Gurgaon, DLF Phase 3" and "Gurugram" both become "gurugram". */
export function canonicalCity(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) return city;
  }
  return null;
}

/**
 * Read an INR ceiling out of a free-text budget.
 * Uses the top of a range ("1.1–1.3 Cr" → 1.3 crore).
 * Returns null when no number is present ("Not mentioned").
 */
export function parseBudgetInr(raw: string): number | null {
  const text = raw.toLowerCase().replace(/,/g, "").replace(/₹/g, "");
  if (!/\d/.test(text)) return null;
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|l\b)?/g)];
  if (matches.length === 0) return null;
  const mentionsCrore = /crore|\bcr\b/.test(text);
  const mentionsLakh = /lakh|lac|\bl\b/.test(text);
  const values = matches.map((match) => {
    const amount = Number(match[1]);
    const unit = match[2] ?? "";
    if (unit.startsWith("cr") || unit === "crore") return amount * 1_00_00_000;
    if (unit.startsWith("l")) return amount * 1_00_000;
    if (amount >= 1_00_000) return amount;
    if (mentionsCrore && amount < 100) return amount * 1_00_00_000;
    if (mentionsLakh && amount < 10_000) return amount * 1_00_000;
    return amount;
  });
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finite.length === 0) return null;
  return Math.max(...finite);
}

/**
 * City must match, and the price must be within 15% over the stated budget.
 * Both checks are code, so the model never invents a home outside this list.
 */
export function shortlistForLead(lead: { location: string; budget: string }): Property[] {
  const city = canonicalCity(lead.location);
  const budget = parseBudgetInr(lead.budget);
  if (!city || budget == null) return [];
  const ceiling = budget * 1.15;
  return INVENTORY.filter((property) => property.city === city && property.priceInr <= ceiling);
}

export function formatInr(amount: number): string {
  if (amount >= 1_00_00_000) {
    const crore = amount / 1_00_00_000;
    const text = crore.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return `₹${text} Cr`;
  }
  const lakh = amount / 1_00_000;
  const text = lakh.toFixed(1).replace(/\.0$/, "");
  return `₹${text} L`;
}
