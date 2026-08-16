import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/lib/supabase/database.types";

// Server-only: constructed with the secret key, which bypasses RLS. Every
// table is RLS-enabled with zero policies (deny-all), which is fine here —
// the app doesn't use Supabase Auth, so there's no `auth.uid()` to write
// policies against. This client is the *only* thing that ever talks to
// Supabase; the browser never gets a Supabase key of its own for these
// tables. Never import this from a "use client" file.
let cached: SupabaseClient<Database> | null = null;

export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)");
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}
