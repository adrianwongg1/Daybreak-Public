import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// This Next.js fork renamed middleware.ts -> proxy.ts (export default
// function proxy(request), not middleware) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// Every Supabase SSR tutorial says middleware.ts; that convention silently
// doesn't run under this fork, with no build error.
//
// Its only job is refreshing the Supabase session cookie on each request —
// actual authorization stays in per-page/per-action checks
// (getCurrentUserId() / requireCompletedSession()), matching this app's
// existing pattern of no centralized route gate.
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Triggers a token refresh (and cookie rewrite via setAll above) when the
  // access token is expired. Server Components can't write cookies
  // themselves, so this is the one place that keeps sessions alive across
  // requests.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
