import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!req.auth || (req.auth.user as { role?: string })?.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return Response.redirect(url);
    }
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
