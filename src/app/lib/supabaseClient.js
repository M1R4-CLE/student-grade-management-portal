import { createBrowserClient } from '@supabase/ssr';

let browserClient = null;
let wrappedAuth = null;
let invalidTokenCleanupPromise = null;
let invalidTokenRejectionHandlerAttached = false;

function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Invalid Refresh Token") ||
    message.includes("Refresh Token Not Found")
  );
}

function clearStoredAuthTokens() {
  if (typeof window === "undefined") return;

  const clear = (store) => {
    try {
      const keys = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          keys.push(key);
        }
      }
      keys.forEach((key) => store.removeItem(key));
    } catch {
      // best-effort cleanup only
    }
  };

  clear(window.localStorage);
  clear(window.sessionStorage);
}

function hasMissingRefreshToken(rawValue) {
  if (!rawValue) return false;

  try {
    const parsed = JSON.parse(rawValue);
    const candidates = [
      parsed,
      parsed?.session,
      parsed?.currentSession,
      parsed?.data?.session,
    ].filter(Boolean);

    let hasAccessToken = false;
    let hasRefreshTokenField = false;
    let hasRefreshTokenValue = false;

    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object") {
        if (typeof candidate.access_token === "string" && candidate.access_token.length > 0) {
          hasAccessToken = true;
        }
        if (Object.prototype.hasOwnProperty.call(candidate, "refresh_token")) {
          hasRefreshTokenField = true;
          if (
            typeof candidate.refresh_token === "string" &&
            candidate.refresh_token.trim().length > 0
          ) {
            hasRefreshTokenValue = true;
          }
        }
      }
    }

    if (hasRefreshTokenField && !hasRefreshTokenValue) return true;
    if (hasAccessToken && !hasRefreshTokenField) return true;

    return false;
  } catch {
    return true;
  }
}

function purgeMalformedStoredAuthTokens() {
  if (typeof window === "undefined") return;

  const purge = (store) => {
    try {
      const keys = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const value = store.getItem(key);
        if (hasMissingRefreshToken(value)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => store.removeItem(key));
    } catch {
      // best-effort cleanup only
    }
  };

  purge(window.localStorage);
  purge(window.sessionStorage);
}

async function handleInvalidRefreshToken(auth) {
  if (invalidTokenCleanupPromise) {
    await invalidTokenCleanupPromise;
    return;
  }

  invalidTokenCleanupPromise = (async () => {
    await auth.signOut({ scope: "local" }).catch(() => {});
    clearStoredAuthTokens();
  })();

  try {
    await invalidTokenCleanupPromise;
  } finally {
    invalidTokenCleanupPromise = null;
  }
}

function attachInvalidRefreshTokenRejectionHandler(client) {
  if (typeof window === "undefined" || invalidTokenRejectionHandlerAttached) return;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const authError =
      reason?.error ||
      reason?.__isAuthError ||
      reason?.cause ||
      reason;

    if (!isInvalidRefreshTokenError(authError)) return;

    event.preventDefault();
    handleInvalidRefreshToken(client.auth).catch(() => {});
  });

  invalidTokenRejectionHandlerAttached = true;
}

async function safeAuthCall(auth, method, args, fallbackResult) {
  try {
    const result = await auth[method](...args);
    if (isInvalidRefreshTokenError(result?.error)) {
      await handleInvalidRefreshToken(auth);
      return fallbackResult;
    }
    return result;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await handleInvalidRefreshToken(auth);
      return fallbackResult;
    }
    throw error;
  }
}

function createSafeAuth(client) {
  if (wrappedAuth) return wrappedAuth;

  wrappedAuth = new Proxy(client.auth, {
    get(target, prop) {
      if (prop === "getSession") {
        return (...args) =>
          safeAuthCall(target, "getSession", args, { data: { session: null }, error: null });
      }

      if (prop === "getUser") {
        return (...args) =>
          safeAuthCall(target, "getUser", args, { data: { user: null }, error: null });
      }

      if (prop === "refreshSession") {
        return (...args) =>
          safeAuthCall(target, "refreshSession", args, {
            data: { session: null, user: null },
            error: null,
          });
      }

      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return wrappedAuth;
}

function sanitizeInitialSession(client) {
  client.auth.getSession().then(async ({ error }) => {
    if (isInvalidRefreshTokenError(error)) {
      await handleInvalidRefreshToken(client.auth);
    }
  }).catch(async (error) => {
    if (isInvalidRefreshTokenError(error)) {
      await handleInvalidRefreshToken(client.auth);
    }
  });
}

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (browserClient) return browserClient;

  // During server-side prerender/build, avoid throwing on import.
  if (!url || !anonKey) return null;

  purgeMalformedStoredAuthTokens();
  browserClient = createBrowserClient(url, anonKey);
  attachInvalidRefreshTokenRejectionHandler(browserClient);
  sanitizeInitialSession(browserClient);
  return browserClient;
}

// Backward-compatible function name used by older imports.
export function getSupabaseClient() {
  return getSupabaseBrowserClient();
}

// Backward-compatible lazy proxy for existing imports:
// import { supabase } from "@/app/lib/supabaseClient";
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseBrowserClient();
      if (!client) {
        throw new Error(
          "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      if (prop === "auth") return createSafeAuth(client);

      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
