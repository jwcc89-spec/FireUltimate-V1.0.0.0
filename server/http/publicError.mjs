/** Errors whose message is written for the person using the app. */
export class PublicError extends Error {}

/** Message safe to send to the browser. Anything not marked public gets the fixed fallback. */
export function publicErrorMessage(error, fallback) {
  if (error instanceof PublicError) return error.message;
  console.error("[route error]", { name: error?.name || "Error", code: error?.code || "" });
  return fallback;
}
