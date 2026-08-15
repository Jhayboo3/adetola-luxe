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
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
