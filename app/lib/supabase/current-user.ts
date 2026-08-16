import "server-only";
import { createClient } from "@/app/lib/supabase/auth-server";

/**
 * Resolves the signed-in user's id — Supabase Auth's auth.users.id, which IS
 * public.users.id (see supabase/migrations/0001_init.sql's
 * handle_new_auth_user() trigger, fired the instant Supabase Auth creates
 * the auth.users row). Throws "Unauthorized" if there's no session —
 * callers use that exact message to decide whether to bounce back to
 * sign-in.
 */
export async function getCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }
  return data.user.id;
}
