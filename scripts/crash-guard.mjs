#!/usr/bin/env node
// Deploy guard against runtime-crashing "undefined name" bugs.
//
// Why: `vite build` does NOT type-check, so bugs like `t is not defined`
// (an i18n function used outside its component scope) shipped to production
// and white-screened pages. This guard runs a real type-check and fails the
// build ONLY on the crash class — TS2304 "Cannot find name" and TS2552
// "Cannot find name X, did you mean Y" — i.e. genuinely undefined identifiers.
//
// It intentionally IGNORES cosmetic type-only errors (e.g. lucide-react icon
// type-resolution quirks, duplicate i18n keys) that do not crash at runtime,
// so it can be enforced today without blocking working code. Tighten later by
// switching to a full `tsc -b` once those are cleaned up.
import { spawnSync } from "node:child_process";

const res = spawnSync("npx", ["tsc", "-b", "--force"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
const output = `${res.stdout || ""}${res.stderr || ""}`;

const crashErrors = output
  .split("\n")
  .filter((line) => /error TS2304:/.test(line) || /error TS2552:/.test(line));

if (crashErrors.length > 0) {
  console.error(
    `\n❌ crash-guard: found ${crashErrors.length} "undefined name" error(s) ` +
      `that would crash at runtime:\n`
  );
  for (const line of crashErrors) console.error("  " + line);
  console.error(
    `\nThese are the same class of bug as "t is not defined". Fix them ` +
      `(usually a value used outside its React component / hook scope) before deploying.\n`
  );
  process.exit(1);
}

console.log("✅ crash-guard: no undefined-name (TS2304/TS2552) errors.");
process.exit(0);
