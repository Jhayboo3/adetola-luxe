"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell, { AuthHeader } from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      let result: { message?: string; error?: string } = {};
      try { result = (await response.json()) as typeof result; } catch { result = {}; }
      if (response.ok) setMessage(result.message || "Check your email for a reset link.");
      else setError(result.error || "Could not send the reset email. Please try again.");
    } catch {
      setError("Could not send the reset email. Please try again.");
    }
    setLoading(false);
  }

  async function resend() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) setError(result.error || "Could not resend the email. Please try again.");
    } catch {
      setError("Could not resend the email. Please try again.");
    }
    setLoading(false);
  }

  return (
    <AuthShell>
      {message ? (
        <div className="flex flex-col items-start">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="m22 6-10 7L2 6" /></svg>
          </div>
          <h1 className="mt-6 font-heading text-[28px] font-medium text-black">Check your inbox</h1>
          <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
            If an account exists for <span className="font-medium text-black">{email}</span>,
            a reset link is on its way. The link is valid for{" "}
            <span className="font-medium text-black">24 hours</span> — if it doesn&apos;t
            arrive, check your spam folder.
          </p>
          {error && <p className="mt-4 font-body text-[13px] text-red-600">{error}</p>}
          <Button type="button" variant="outline" className="mt-8" disabled={loading} onClick={resend}>
            {loading ? "Sending..." : "Resend email"}
          </Button>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 font-body text-[12px] font-medium uppercase tracking-[1.5px] text-muted no-underline transition-colors hover:text-black">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <AuthHeader
            eyebrow="Account access"
            title="Forgot your password?"
            description="No worries — enter the email you registered with and we'll send you a secure link to set a new one."
          />
          {error && <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg><p>{error}</p></div>}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate={false}>
            <Input id="email" type="email" label="Email address" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            <Button type="submit" fullWidth disabled={loading || !email.trim()}>
              {loading ? "Sending link..." : "Send reset link"}
            </Button>
          </form>
          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <Link href="/login" className="font-body text-[12px] font-medium text-muted no-underline transition-colors hover:text-primary">
              Back to sign in
            </Link>
            <div className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
    </AuthShell>
  );
}
