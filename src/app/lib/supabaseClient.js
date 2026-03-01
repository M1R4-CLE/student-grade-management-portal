import { createBrowserClient } from '@supabase/ssr';

let browserClient = null;
let wrappedAuth = null;

function isInvalidRefreshTokenError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Invalid Refresh Token") ||
    message.includes("Refresh Token Not Found")
  );
}

function createSafeAuth(client) {
  if (wrappedAuth) return wrappedAuth;

  wrappedAuth = new Proxy(client.auth, {
    get(target, prop) {
      if (prop === "getSession") {
        return async (...args) => {
          try {
            return await target.getSession(...args);
          } catch (error) {
            if (isInvalidRefreshTokenError(error)) {
              await target.signOut({ scope: "local" }).catch(() => {});
              return { data: { session: null }, error: null };
            }
            throw error;
          }
        };
      }

      if (prop === "getUser") {
        return async (...args) => {
          try {
            return await target.getUser(...args);
          } catch (error) {
            if (isInvalidRefreshTokenError(error)) {
              await target.signOut({ scope: "local" }).catch(() => {});
              return { data: { user: null }, error: null };
            }
            throw error;
          }
        };
      }

      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return wrappedAuth;
}

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (browserClient) return browserClient;

  // During server-side prerender/build, avoid throwing on import.
  if (!url || !anonKey) return null;

  browserClient = createBrowserClient(url, anonKey);
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
