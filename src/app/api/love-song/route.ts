import { getCloudflareContext } from "@opennextjs/cloudflare";

// Streams the love-letter song from R2 with proper byte-range support so
// mobile Safari can play and seek it. The object stays private to this route.
const SONG_KEY = "love/girls-like-you.mp3";
const RANGE_RE = /^bytes=(\d*)-(\d*)$/;

type SongObject = Awaited<ReturnType<CloudflareEnv["PRODUCT_IMAGES"]["get"]>>;

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.PRODUCT_IMAGES;
  const range = request.headers.get("range");

  let object: SongObject | null = null;

  if (range && range !== "bytes=0-") {
    const match = RANGE_RE.exec(range.trim());
    if (match) {
      const startStr = match[1];
      const endStr = match[2];
      if (startStr && endStr) {
        const offset = Number(startStr);
        const end = Number(endStr);
        if (end >= offset) object = await bucket.get(SONG_KEY, { range: { offset, length: end - offset + 1 } });
      } else if (startStr) {
        object = await bucket.get(SONG_KEY, { range: { offset: Number(startStr) } });
      } else if (endStr) {
        object = await bucket.get(SONG_KEY, { range: { suffix: Number(endStr) } });
      }
    }
  }

  if (!object) object = await bucket.get(SONG_KEY);
  if (!object?.body) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("content-type", "audio/mpeg");
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");

  const total = object.size;
  const objRange = object.range as { offset?: number; length?: number } | undefined;
  if (range && objRange && typeof objRange.offset === "number") {
    const offset = objRange.offset;
    const length = typeof objRange.length === "number" ? objRange.length : total - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${total}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(total));
  return new Response(object.body, { status: 200, headers });
}
