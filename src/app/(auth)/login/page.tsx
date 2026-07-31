"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-white">
      <div className="w-full max-w-sm px-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-[2px] w-12 bg-gold" />
          <h1 className="font-heading text-[24px] font-medium text-black">
            Sign In
          </h1>
          <p className="mt-2 font-body text-[13px] text-muted">
            Welcome back to Adetola Luxe
          </p>
        </div>

        {error && (
          <p className="mb-6 text-center font-body text-[13px] text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-8 text-center font-body text-[13px] text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-black underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
