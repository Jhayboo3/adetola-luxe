import { NextResponse } from "next/server";
import NextAuth, { type NextAuthRequest } from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

// Hosts that should be served the standalone love-letter experience instead
// of the marketplace. Matches the bare hostname (port is stripped).
const LOVE_HOSTS = ["love.larkvine.org"];

// Build a redirect using the real incoming origin. NextAuth normalizes
// req.nextUrl / req.url to AUTH_URL (http://localhost:3000 in every
// environment), which would break production redirects. Cloudflare forwards
// the true Host header, so we rebuild the origin from it.
function redirectTo(req: NextAuthRequest, pathname: string) {
  const host = req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const url = new URL(pathname, `${proto}://${host}`);
  return Response.redirect(url.toString());
}

function hostIsLove(host: string) {
  return LOVE_HOSTS.includes(host.split(":")[0].toLowerCase());
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? req.nextUrl.host;

  // The love-letter subdomain serves only the /love experience. Every path on
  // it is rewritten to /love so the marketplace never leaks onto that host.
  if (hostIsLove(host)) {
    if (pathname === "/love" || pathname.startsWith("/love/")) {
      return;
    }
    return NextResponse.rewrite(new URL("/love", req.nextUrl));
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && pathname !== "/admin/signup") {
    const role = (req.auth?.user as { role?: string })?.role;
    if (!req.auth || (role !== "admin" && role !== "vendor")) {
      return redirectTo(req, "/admin/login");
    }
    const isPlatformRoute = pathname === "/admin" || pathname.startsWith("/admin/applications") || pathname.startsWith("/admin/stores");
    if (isPlatformRoute && role !== "admin") {
      return redirectTo(req, "/admin/login");
    }
    // A platform admin has no owned store: vendor-only pages (dashboard,
    // orders, products, …) would throw. Keep them on the platform tools.
    if (role === "admin" && !isPlatformRoute) {
      return redirectTo(req, "/admin/applications");
    }
    if (pathname === "/admin") {
      return redirectTo(req, role === "admin" ? "/admin/applications" : "/admin/dashboard");
    }
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    // Any path on the love subdomain (excluding assets and API routes so
    // scripts, styles, images and handlers keep working).
    {
      source: "/((?!api|_next|favicon|robots|sitemap|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|css|js|woff2?|mp3|mp4)$).*)",
      has: [{ type: "header", key: "host", value: "love.larkvine.org" }],
    },
  ],
};
