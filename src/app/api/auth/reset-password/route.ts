import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/password-reset";

export async function POST(request: Request) {
  const body = await request.json() as { token?: string; password?: string };
  const token = body.token?.trim();
  const password = body.password || "";
  if (!token) return Response.json({ error: "This reset link is invalid." }, { status: 400 });
  if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: await hashResetToken(token) },
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
    return Response.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: reset.userId }, data: { password: await bcrypt.hash(password, 12) } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } });
  return Response.json({ message: "Your password has been reset. You can now sign in." });
}
