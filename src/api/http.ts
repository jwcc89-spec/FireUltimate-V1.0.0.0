/** Opens the sign-in box when the server refuses a request because nobody is signed in. */

export const SESSION_EXPIRED_EVENT = "fire-ultimate:session-expired";

type FetchArgs = Parameters<typeof fetch>;

function requestUrl(input: FetchArgs[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function installApiSessionGuard(): void {
  if (typeof window === "undefined") return;
  const guarded = window.fetch as typeof window.fetch & { __sessionGuard?: boolean };
  if (guarded.__sessionGuard) return;
  const original = window.fetch.bind(window);
  const wrapped = (async (input: FetchArgs[0], init?: FetchArgs[1]) => {
    const response = await original(input, init);
    const url = requestUrl(input);
    if (response.status !== 401 || !url.includes("/api/")) return response;
    if (url.includes("/api/auth/login") || url.includes("/api/auth/session")) return response;
    const data = (await response.clone().json().catch(() => null)) as { code?: string } | null;
    if (data?.code === "AUTH_REQUIRED") {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return response;
  }) as typeof window.fetch & { __sessionGuard?: boolean };
  wrapped.__sessionGuard = true;
  window.fetch = wrapped;
}

export function onSessionExpired(handler: () => void): () => void {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}
