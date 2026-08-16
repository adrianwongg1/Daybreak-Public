import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/app/lib/supabase/database.types";

// Server-side counterpart to app/lib/supabase/browser.ts — same publishable
// key, same auth-only scope. Used from Server Components/Actions/Route
// Handlers to read or refresh the signed-in session (.auth.getUser(),
// .auth.signOut()). Never used for .from(...) table queries; that's
// app/lib/supabase/server.ts's job.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, which can't write cookies —
            // proxy.ts's session refresh covers this on the next request.
          }
        },
      },
    }
  );
}
