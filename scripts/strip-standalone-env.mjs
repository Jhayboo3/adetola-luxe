#!/usr/bin/env node
/**
 * Stop the developer's local `.env` from shipping inside the worker bundle.
 *
 * `next build` copies the repo-root `.env` (which on dev machines holds
 * NEXTAUTH_URL=http://localhost:3000 and a placeholder NEXTAUTH_SECRET) into
 * `.next/standalone/.env`. OpenNext then bundles that file into the deployed
 * worker, so Auth.js resolves sign-in/sign-out URLs and the session secret from
 * the LOCAL dev values — signing users out to "localhost:3000" in production.
 *
 * The production worker must source these from Cloudflare env vars/secrets
 * (AUTH_URL / AUTH_SECRET), not from the build machine's `.env`.
 *
 * Run AFTER `next build` and before the OpenNext server bundle is created.
 */
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const targets = [".next/standalone/.env", ".next/standalone/.env.local"];
for (const rel of targets) {
  const abs = join(root, rel);
  try {
    rmSync(abs, { force: true });
    console.log(`[strip-standalone-env] removed ${rel}`);
  } catch (error) {
    console.warn(`[strip-standalone-env] could not remove ${rel}:`, error);
  }
}
