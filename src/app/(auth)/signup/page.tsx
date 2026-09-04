"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "customer" }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.push("/login");
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-white">
      <div className="w-full max-w-sm px-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-[2px] w-12 bg-gold" />
          <h1 className="font-heading text-[24px] font-medium text-black">
            Create Account
          </h1>
          <p className="mt-2 font-body text-[13px] text-muted">
            Join the Larkvine archive
          </p>
        </div>

        {error && (
          <p className="mb-6 text-center font-body text-[13px] text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="name"
            type="text"
            label="Full Name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            type="password"
            label="Password"
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Creating Account..." : "Sign Up"}
          </Button>
        </form>

        <p className="mt-8 text-center font-body text-[13px] text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-black underline">
            Sign in
          </Link>
        </p>
        <div className="mt-6 text-center">
          <p className="font-body text-[12px] text-muted">Want to sell on Larkvine?</p>
          <Link href="/sell" className="cta-secondary mt-3 inline-flex">Open a Store</Link>
        </div>
      </div>
    </div>
  );
}
