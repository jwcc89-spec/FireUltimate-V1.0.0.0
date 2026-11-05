/**
 * Normalize raw dispatch plain text before rule evaluation (shared by preview + future ingest).
 */

export function normalizeDispatchTextForParsing(input: string): string {
  if (!input) return "";
  let s = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\uFEFF/g, "");
  return s.trim();
}
