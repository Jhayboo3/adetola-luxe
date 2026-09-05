#!/usr/bin/env node
/**
 * Corruption detector for opennextjs/opennextjs-cloudflare#1130.
 *
 * Flags a streaming suspense-resolution flush that was emitted INSIDE an open
 * `self.__next_f.push([1,"..."]);` script (i.e. the >4 KiB workerd stream-bridge
 * reorder). In a healthy page the `<div hidden id="S:n">` reveal is real HTML
 * OUTSIDE any script; when present inside a push script body the push string
 * was cut mid-value and the page will throw `SyntaxError`.
 *
 * Usage:
 *   node scripts/check-homepage.mjs <url> [count]
 *   node scripts/check-homepage.mjs <file.html>
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [arg, countArg] = process.argv.slice(2);
if (!arg) {
  console.error("usage: node scripts/check-homepage.mjs <url> [count] | <file.html>");
  process.exit(2);
}
const isUrl = /^https?:\/\//.test(arg);
const count = isUrl ? Math.max(1, parseInt(countArg ?? "1", 10) || 1) : 1;

function detect(html) {
  const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let spliced = 0;
  while ((m = scriptRe.exec(html))) {
    if (m[1].startsWith("self.__next_f.push") && /hidden id=\\?"S:\d+>/.test(m[1])) spliced++;
  }
  return {
    bytes: html.length,
    spliced,
    errorBoundary: html.includes("__next_error__"),
    sMarkers: (html.match(/<div hidden id="S:\d+>/g) || []).length,
    rawRscInBody: /<body>[\s\S]{0,1200}?\\"destinations\\":/.test(html),
  };
}

let failures = 0;
for (let i = 0; i < count; i++) {
  let html;
  if (isUrl) {
    html = execFileSync("curl", ["--compressed", "-s", arg], { maxBuffer: 4 * 1024 * 1024 }).toString("utf8");
  } else {
    html = readFileSync(arg, "utf8");
  }
  const r = detect(html);
  const ok = r.spliced === 0 && !r.errorBoundary;
  if (!ok) failures++;
  console.log(
    `sample[${i}] bytes=${r.bytes} spliced=${r.spliced} sMarkers=${r.sMarkers} ` +
      `errorBoundary=${r.errorBoundary} rawRscInBody=${r.rawRscInBody} ${ok ? "OK" : "CORRUPT"}`,
  );
}
console.log(`\n${count - failures}/${count} OK`);
process.exit(failures === 0 ? 0 : 1);