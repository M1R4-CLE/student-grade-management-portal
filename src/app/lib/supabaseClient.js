import { createBrowserClient } from '@supabase/ssr';

let browserClient = null;

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

      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);
