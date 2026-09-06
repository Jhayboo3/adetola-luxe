"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell, { AuthHeader } from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function PasswordField({
  id, label, placeholder, value, onChange, autoComplete, showPassword, onToggleShow,
}: {
  id: string; label: string; placeholder: string; value: string;
  onChange: (value: string) => void; autoComplete: string;
  showPassword: boolean; onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        minLength={8}
        required
        style={{ paddingRight: "2.75rem" }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
        onClick={onToggleShow}
        className="absolute right-1 top-[38px] flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:text-black"
      >
        {showPassword ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  );
}

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      let result: { message?: string; error?: string } = {};
      try { result = (await response.json()) as typeof result; } catch { result = {}; }
      if (response.ok) setMessage(result.message || "Your password has been reset.");
      else setError(result.error || "Could not reset your password. Please try again.");
    } catch {
      setError("Could not reset your password. Please try again.");
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <AuthShell>
        <AuthHeader
          eyebrow="Reset link invalid"
          title="This link isn't valid"
          description="The reset link you opened is missing or malformed. Request a fresh one and try again — it stays valid for 24 hours."
        />
        <Link href="/forgot-password" className="cta-primary w-full">Request a new link</Link>
        <Link href="/login" className="mt-6 block text-center font-body text-[12px] font-medium uppercase tracking-[1.5px] text-muted no-underline transition-colors hover:text-black">Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {message ? (
        <div className="flex flex-col items-start">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 className="mt-6 font-heading text-[28px] font-medium text-black">Password updated</h1>
          <p className="mt-3 font-body text-[13.5px] leading-relaxed text-muted">
            Your password has been changed successfully. You can now sign in with your new password.
          </p>
          <Link href="/login" className="cta-primary mt-8">Continue to sign in</Link>
        </div>
      ) : (
        <>
          <AuthHeader
            eyebrow="Secure your account"
            title="Choose a new password"
            description="Pick something strong and unique. Your old password will stop working as soon as you save."
          />
          {error && <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 font-body text-[13px] text-red-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg><p>{error}</p></div>}
          <form onSubmit={handleSubmit} className="space-y-6">
            <PasswordField id="password" label="New password" placeholder="At least 8 characters" value={password} onChange={setPassword} autoComplete="new-password" showPassword={showPassword} onToggleShow={() => setShowPassword((visible) => !visible)} />
            <PasswordField id="confirmPassword" label="Confirm new password" placeholder="Enter it again" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" showPassword={showPassword} onToggleShow={() => setShowPassword((visible) => !visible)} />
            <div className="-mt-2 flex items-center gap-1.5 font-body text-[11px] text-muted">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              At least 8 characters
            </div>
            <Button type="submit" fullWidth disabled={loading || password.length < 8 || !confirmPassword}>
              {loading ? "Saving password..." : "Reset password"}
            </Button>
          </form>
          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <Link href="/login" className="font-body text-[12px] font-medium text-muted no-underline transition-colors hover:text-primary">Back to sign in</Link>
            <div className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
    </AuthShell>
  );
}
