"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const result = await response.json() as { message?: string; error?: string };
    if (response.ok) setMessage(result.message || "Password reset successfully.");
    else setError(result.error || "Could not reset your password.");
    setLoading(false);
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-white">
      <div className="w-full max-w-sm px-8">
        <div className="mb-8 text-center"><div className="mx-auto mb-4 h-[2px] w-12 bg-gold" /><h1 className="font-heading text-[24px] font-medium text-black">Choose a New Password</h1></div>
        {message ? <div className="text-center"><p className="mb-6 font-body text-[13px] text-green-700">{message}</p><Link href="/login" className="font-body text-[13px] text-black underline">Continue to sign in</Link></div> : (
          <>
            {error && <p className="mb-6 text-center font-body text-[13px] text-red-600">{error}</p>}
            {!token ? <p className="text-center font-body text-[13px] text-red-600">This reset link is invalid.</p> : <form onSubmit={handleSubmit} className="space-y-6">
              <Input id="password" type="password" label="New Password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              <Input id="confirmPassword" type="password" label="Confirm Password" placeholder="Enter it again" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
              <Button type="submit" fullWidth disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</Button>
            </form>}
          </>
        )}
      </div>
    </div>
  );
}
