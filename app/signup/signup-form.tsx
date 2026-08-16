"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/browser";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // A fresh Supabase project has "Confirm email" enabled by default —
      // signUp() then returns a user but no active session until the user
      // clicks the confirmation link, so there's nothing to redirect into
      // yet.
      if (!data.session) {
        setNeedsEmailConfirmation(true);
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

  if (needsEmailConfirmation) {
    return (
      <div style={{ textAlign: "center" }}>
        <h2 style={{ margin: "0 0 12px" }}>Check your email</h2>
        <p style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and sign in.
        </p>
        <Link href="/login" className="btn btn-secondary" style={{ marginTop: 20, display: "inline-block" }}>
          Go to sign in
        </Link>
      </div>
    );
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
          autoComplete="new-password"
          minLength={8}
          className="input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
        />
      </div>

      <div className="field">
        <label>Confirm password</label>
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="input"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={submitting}
        />
      </div>

      {error ? <p style={{ color: "var(--color-danger)", fontSize: 13, margin: 0 }}>{error}</p> : null}

      <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p style={{ fontSize: 13, textAlign: "center", color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
