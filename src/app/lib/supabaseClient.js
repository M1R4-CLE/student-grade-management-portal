import { createBrowserClient } from '@supabase/ssr';

let browserClient = null;
let wrappedAuth = null;
let invalidTokenHandled = false;

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

async function handleInvalidRefreshToken(auth) {
  if (invalidTokenHandled) return;
  invalidTokenHandled = true;

  await auth.signOut({ scope: "local" }).catch(() => {});
  clearStoredAuthTokens();
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

  browserClient = createBrowserClient(url, anonKey);
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
