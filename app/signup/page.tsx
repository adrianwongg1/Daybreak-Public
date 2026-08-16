import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/auth-server";
import { SignupForm } from "@/app/signup/signup-form";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center", padding: "48px 24px 0" }}>
        <span style={{ width: 20, height: 20, background: "var(--color-accent)", display: "inline-block" }} />
        <span className="nav-brand" style={{ fontSize: 32, marginRight: 0 }}>Daybreak</span>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{ margin: "0 0 32px", textAlign: "center" }}>Create your account</h2>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
