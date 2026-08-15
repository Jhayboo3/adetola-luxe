"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json() as { message?: string; error?: string };
    if (response.ok) setMessage(result.message || "Check your email for a reset link.");
    else setError(result.error || "Could not send the reset email.");
    setLoading(false);
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-white">
      <div className="w-full max-w-sm px-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-[2px] w-12 bg-gold" />
          <h1 className="font-heading text-[24px] font-medium text-black">Forgot Password</h1>
          <p className="mt-2 font-body text-[13px] text-muted">Enter your account email and we&apos;ll send a secure reset link.</p>
        </div>
        {message && <p className="mb-6 text-center font-body text-[13px] text-green-700">{message}</p>}
        {error && <p className="mb-6 text-center font-body text-[13px] text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input id="email" type="email" label="Email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Button type="submit" fullWidth disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</Button>
        </form>
        <p className="mt-8 text-center font-body text-[13px] text-muted"><Link href="/login" className="text-black underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
