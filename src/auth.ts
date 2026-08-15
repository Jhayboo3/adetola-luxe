import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth(
  Object.assign({}, authConfig, {
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const email = credentials?.email as string;
          const password = credentials?.password as string;

          if (!email || !password) return null;

          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return null;

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        },
      }),
    ],
  }),
);
