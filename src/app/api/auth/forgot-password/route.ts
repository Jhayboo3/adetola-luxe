import { getCloudflareContext } from "@opennextjs/cloudflare";
import { prisma } from "@/lib/prisma";
import { createResetToken, hashResetToken } from "@/lib/password-reset";

const successMessage = "If an account exists for that email, a reset link has been sent.";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.RESEND_API_KEY) {
    return Response.json({ error: "Password reset email is not configured yet." }, { status: 503 });
  }

  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return Response.json({ error: "Enter your email address." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return Response.json({ message: successMessage });

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const token = createResetToken();
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: await hashResetToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const resetUrl = new URL("/reset-password", request.url);
  resetUrl.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || "Larkvine <onboarding@resend.dev>",
      to: [user.email],
      subject: "Reset your Larkvine password",
      html: `<div style="font-family:Arial,sans-serif;color:#111;line-height:1.6"><h2>Reset your password</h2><p>Hello ${escapeHtml(user.name)},</p><p>Use the button below to choose a new password. This link expires in one hour.</p><p><a href="${resetUrl.toString()}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;text-decoration:none">Reset password</a></p><p>If you did not request this, you can ignore this email.</p></div>`,
    }),
  });

  if (!response.ok) {
    console.error("Resend password reset email failed", response.status, await response.text());
    return Response.json({ error: "We could not send the reset email. Please try again later." }, { status: 502 });
  }

  return Response.json({ message: successMessage });
}
