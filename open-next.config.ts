// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default {
	...defineCloudflareConfig({
		incrementalCache: r2IncrementalCache,
		queue: doQueue,
	}),
	// Workaround for opennextjs/opennextjs-cloudflare#1130: the workerd->Node
	// bridge fragments >4 KiB ReadableByteStream reads and reorders the tail,
	// corrupting large `self.__next_f.push` flight chunks. Remove `type:"bytes"`
	// from createInlinedDataReadableStream so chunks flow whole. Runs after the
	// inner `next build` (which produces .next/standalone) and before the server
	// bundle is created, so the patch is baked into the worker.
	buildCommand: "npm run build && node scripts/patch-no-type-bytes.mjs",
};
