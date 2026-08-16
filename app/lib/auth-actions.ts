"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/auth-server";

// Thin Server Action wrapper so client components (the profile menu) can
// trigger sign-out via a <form action> without importing the Supabase auth
// client directly.
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
