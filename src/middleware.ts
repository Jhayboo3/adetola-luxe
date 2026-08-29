import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const role = (req.auth?.user as { role?: string })?.role;
    if (!req.auth || (role !== "admin" && role !== "vendor")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return Response.redirect(url);
    }
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};
