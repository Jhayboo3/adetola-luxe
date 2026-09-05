import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  if (!key.length || key.some((part) => part === "..")) return new Response("Not found", { status: 404 });

  const { env } = await getCloudflareContext({ async: true });
  const object = await env.PRODUCT_IMAGES.get(key.join("/"));
  if (!object?.body) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  // Never let a browser sniff attacker-chosen bytes into a different type
  // (e.g. HTML served as image/png), and pin a short allowlist of safe types.
  headers.set("X-Content-Type-Options", "nosniff");
  const contentType = headers.get("content-type") || "";
  if (!["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].some((t) => contentType.includes(t))) {
    return new Response("Not found", { status: 404 });
  }
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
