#!/usr/bin/env node
/**
 * Build-time workaround for opennextjs/opennextjs-cloudflare#1130
 *
 * workerd's Web->Node bridge splits a ReadableByteStream (type:"bytes") read
 * into <=4096-byte fragments and can deliver the tail out of order, after
 * subsequent chunks. Next's `createInlinedDataReadableStream` wraps each RSC
 * flight flush in `<script>self.__next_f.push([1,"..."]);</script>` and
 * exposes it as a byte stream; when a push exceeds ~4 KiB the split+reorder
 * stuffs a concurrently-flushed Suspense reveal (`<div hidden id="S:n">`,
 * `$RS("S:n","P:n")`) inside the still-open push string. The unescaped `"`
 * terminates the JS literal early, next token throws
 * `SyntaxError: Unexpected identifier 'S'`, and the page dies on the error
 * boundary.
 *
 * This patch removes `type:"bytes"` ONLY from `createInlinedDataReadableStream`
 * so `read()` returns whole chunks as enqueued, preserving ordering. All other
 * byte streams (React Fizz HTML rendering, RSC renderer) are left untouched.
 *
 * Apply AFTER `next build` (the files under `.next/standalone` are then copied
 * and bundled by `opennextjs-cloudflare build --skipNextBuild`), then rebuild
 * the worker so the patch is baked into `.open-next/worker.js`.
 *
 * Detect a 4 KiB+ push of interest:
 *   new ReadableStream({type:"bytes",start(...){[^}]{0,300}__next_f
 * (turbopack runtime, minified) and the explicit `type: 'bytes'` inside
 * `createInlinedDataReadableStream` (non-turbopack source).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  {
    pattern: /new ReadableStream\(\{type:"bytes",(start\([^)]*\)\{[^}]{0,300}__next_f)/g,
    replacement: "new ReadableStream({$1",
  },
];

const files = [
  "node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",
  "node_modules/next/dist/compiled/next-server/app-page-turbo-experimental.runtime.prod.js",
  "node_modules/next/dist/server/app-render/use-flight-response.js",
];

let patchedCount = 0;
for (const rel of files) {
  const abs = join(root, ".next/standalone", rel);
  let code;
  try {
    code = readFileSync(abs, "utf8");
  } catch {
    console.warn(`[patch-no-type-bytes] missing (skipping): ${rel}`);
    continue;
  }

  if (rel.endsWith("use-flight-response.js")) {
    // Non-turbopack source: exactly one `type: 'bytes'`, inside
    // createInlinedDataReadableStream. Bump it to a full default stream.
    const before = code;
    code = code.replace(
      "const readable = new ReadableStream({\n        type: 'bytes',\n",
      "const readable = new ReadableStream({\n",
    );
    if (code === before) {
      throw new Error(`[patch-no-type-bytes] pattern not found in ${rel} -- check next version`);
    }
    writeFileSync(abs, code);
    patchedCount++;
    console.log(`[patch-no-type-bytes] patched ${rel}`);
    continue;
  }

  let changed = false;
  for (const { pattern, replacement } of targets) {
    const matches = code.match(pattern);
    if (!matches) {
      throw new Error(`[patch-no-type-bytes] pattern not found in ${rel} -- check next version`);
    }
    if (matches.length !== 1) {
      throw new Error(
        `[patch-no-type-bytes] expected exactly 1 match in ${rel}, got ${matches.length} -- refusing to patch`,
      );
    }
    const before = code;
    code = code.replace(pattern, replacement);
    if (code !== before) changed = true;
  }
  if (!changed) continue;
  writeFileSync(abs, code);
  patchedCount++;
  console.log(`[patch-no-type-bytes] patched ${rel}`);
}

if (patchedCount === 0) {
  throw new Error("[patch-no-type-bytes] nothing patched -- aborting deploy");
}
console.log(`[patch-no-type-bytes] done, patched ${patchedCount} file(s)`);