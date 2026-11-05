/** Escape a string for use as a literal inside a RegExp pattern. */
export function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * If `pattern` was produced only by `escapeRegexLiteral`, return the original literal.
 * Otherwise return `null` (treat as advanced regex in the UI).
 */
export function tryDecodeLiteralPattern(pattern: string): string | null {
  if (pattern === "") return "";
  const decoded = pattern.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
  if (escapeRegexLiteral(decoded) === pattern) return decoded;
  return null;
}
