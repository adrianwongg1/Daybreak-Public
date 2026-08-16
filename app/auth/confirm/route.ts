import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/auth-server";

// Lands here after a user clicks the emailed confirmation link. Supabase's
// own /auth/v1/verify endpoint validates the token server-side first, then
// redirects the browser here with a one-time PKCE `code` — this route's only
// job is exchanging that code for a real session cookie
// (supabase.auth.exchangeCodeForSession), which nothing in the app did
// before this route existed (the code was landing on `/` and being ignored).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
}
