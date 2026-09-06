import NextAuth, { type NextAuthRequest } from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const CANONICAL_HOST = "www.larkvine.org";
const APEX_HOST = "larkvine.org";

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

// Keep www.larkvine.org canonical: any request to the bare apex domain is
// permanently redirected to the matching www URL (path + query preserved).
function canonicalizeHost(req: NextAuthRequest): Response | null {
  const host = (req.headers.get("host") ?? req.nextUrl.host).toLowerCase().split(":")[0];
  if (host !== APEX_HOST) return null;
  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL_HOST}`);
  return Response.redirect(url.toString(), 308);
}

export default auth((req) => {
  const canonical = canonicalizeHost(req);
  if (canonical) return canonical;

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && pathname !== "/admin/signup") {
    const role = (req.auth?.user as { role?: string })?.role;
    if (!req.auth || (role !== "admin" && role !== "vendor")) {
      return redirectTo(req, "/admin/login");
    }
    const isPlatformRoute = pathname === "/admin" || pathname.startsWith("/admin/applications") || pathname.startsWith("/admin/stores");
    if (isPlatformRoute && role !== "admin") {
      return redirectTo(req, "/admin/login");
    }
    if (pathname === "/admin") {
      return redirectTo(req, role === "admin" ? "/admin/applications" : "/admin/dashboard");
    }
  }
});

export const config = {
  // Run on every non-asset request so the apex→www canonical redirect applies
  // to all pages. The NextAuth/admin checks below only act on /admin routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
