"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
      <div className="field">
        <label>Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="field">
        <label>Password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
        />
      </div>

      {error ? <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p> : null}

      <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <p style={{ fontSize: 13, textAlign: "center", color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
        Don&apos;t have an account? <Link href="/signup">Create one</Link>
      </p>
    </form>
  );
}
