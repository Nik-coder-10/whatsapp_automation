import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client (service-role key — bypasses RLS).
 *
 * - Import ONLY from server code (Route Handlers, Server Actions,
 *   background jobs). The `server-only` import above makes accidental
 *   client bundling a build error.
 * - Every use must be audited: prefer the RLS-respecting server client
 *   in `lib/supabase/server.ts` unless elevation is required
 *   (e.g. order confirmation, webhook ingestion).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. " +
        "See .env.example. Never expose the service-role key to the client.",
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
