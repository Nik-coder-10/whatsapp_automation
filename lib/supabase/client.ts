import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (uses the public anon key only).
 * Safe for Client Components. Never use the service-role key here.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "See .env.example.",
    );
  }
  return createBrowserClient(url, anonKey);
}
