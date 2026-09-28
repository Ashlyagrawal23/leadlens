/**
 * Turn a typed phone number into the digits wa.me expects.
 *
 * Only spaces, dashes, and "+" are removed. Anything else (letters,
 * brackets) makes the number invalid rather than guessing.
 *
 * Examples:
 * - normalizePhone("98100 12345") === "919810012345"
 * - normalizePhone("+91-98765-43210") === "919876543210"
 * - normalizePhone("919876543210") === "919876543210"
 * - normalizePhone("12345") === null
 * - normalizePhone("") === null
 * - normalizePhone("98abc12345") === null
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s+-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

export function whatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
