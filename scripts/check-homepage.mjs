#!/usr/bin/env node
/**
 * Corruption detector for opennextjs/opennextjs-cloudflare#1130.
 *
 * Flags a streaming suspense-resolution flush that was emitted INSIDE an open
 * `self.__next_f.push([1,"..."]);` script (i.e. the >4 KiB workerd stream-bridge
 * reorder). Two reveal encodings are covered:
 *   - React 16-18: `<div hidden id="S:n">` reveals
 *   - React 19:    `<script>$RS("S:n","P:n")</script>` / `$RC(...)` reveals,
 *                  which leave a nested `<script>` inside the push body and dump
 *                  the cut flight-string tail as raw text after the reveal.
 * A healthy page never has either; when present, the push string was cut mid-value
 * and the page will throw `SyntaxError` ("This page couldn't load").
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
  // React 16-18 era: a suspense reveal was emitted as `<div hidden id="S:n">`
  // and could be spliced INSIDE an open `self.__next_f.push(...)` string.
  const legacySplice = /<script(?![^>]*\bsrc=)[^>]*>\s*self\.__next_f\.push\([^]*?hidden id=\\?"S:\d+>/g;

  // React 19: reveals are `<script>$RS("S:n","P:n")</script>` /
  // `<script>$RC("B:n","S:n")</script>`. When the workerd stream bridge
  // reorders a >4 KiB flight chunk, a reveal script lands INSIDE the open
  // `self.__next_f.push([1,"..."]);` string and the chunk tail is pushed out
  // after it as unescaped text. Two tell-tale signs:
  //   1. nestedPush  - a push script whose body contains a nested `<script`
  //                    (raw reveal injected mid string literal)
  //   2. revealLeak  - a reveal script whose very next output is not a tag,
  //                    i.e. the leaked remainder of the cut flight string
  const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  let nestedPush = 0;
  let revealLeak = 0;
  const reveals = [];
  while ((m = scriptRe.exec(html))) {
    const body = m[1];
    if (body.startsWith("self.__next_f.push")) {
      if (/<script/i.test(body)) nestedPush++;
    } else if (/^\$R[SC]\(/.test(body.trim())) {
      reveals.push(m.index + m[0].length);
    }
  }
  for (const end of reveals) {
    const rest = html.slice(end).replace(/^\s+/, "");
    if (rest && !rest.startsWith("<")) revealLeak++;
  }

  const legacySpliced = legacySplice.test(html) ? 1 : 0;

  return {
    bytes: html.length,
    nestedPush,
    revealLeak,
    spliced: legacySpliced,
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
  const ok = r.nestedPush === 0 && r.revealLeak === 0 && r.spliced === 0 && !r.errorBoundary;
  if (!ok) failures++;
  console.log(
    `sample[${i}] bytes=${r.bytes} nestedPush=${r.nestedPush} revealLeak=${r.revealLeak} ` +
      `sMarkers=${r.sMarkers} errorBoundary=${r.errorBoundary} rawRscInBody=${r.rawRscInBody} ${ok ? "OK" : "CORRUPT"}`,
  );
}
console.log(`\n${count - failures}/${count} OK`);
process.exit(failures === 0 ? 0 : 1);