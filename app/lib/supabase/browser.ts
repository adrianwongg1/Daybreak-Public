import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/app/lib/supabase/database.types";

// The only file in the app allowed to hand a Supabase client to the browser.
// It carries the publishable key (safe to expose) and is used exclusively
// for .auth.* calls (sign-up/sign-in forms) — never for .from(...) table
// queries. Every table's RLS is deny-all with zero policies (see
// supabase/migrations/0001_init.sql), so this key can't read or write a
// single row via PostgREST even if misused. All real data access still goes
// through app/lib/supabase/server.ts's service-role client, server-side only.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
