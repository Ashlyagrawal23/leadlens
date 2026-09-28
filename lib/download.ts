/** Save text as a file from the browser. No server round trip, nothing leaves the device. */
export function downloadText(filename: string, content: string, type: string): void {
  // The BOM makes Excel read ₹ and other non-ASCII text in a CSV as UTF-8.
  const parts = type.startsWith("text/csv") ? ["﻿", content] : [content];
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** YYYY-MM-DD in the local time zone. toISOString() is UTC and names the file yesterday after midnight IST. */
export function localDateStamp(now = new Date()): string {
  return now.toLocaleDateString("en-CA");
}
