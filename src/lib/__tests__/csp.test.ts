import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INLINE_STYLE_HASHES } from "@/lib/csp";

const hash = (css: string) =>
  `'sha256-${createHash("sha256").update(css, "utf8").digest("base64")}'`;

/** Every stylesheet sonner injects at runtime, read from the installed bundle. */
function sonnerInjectedCss() {
  const bundle = readFileSync("node_modules/sonner/dist/index.mjs", "utf8");
  const calls = [...bundle.matchAll(/__insertCSS\(("(?:[^"\\]|\\.)*")\)/g)];
  return calls.map((match) => JSON.parse(match[1]) as string);
}

describe("INLINE_STYLE_HASHES", () => {
  it("allows the empty <style> element sonner appends first", () => {
    expect(INLINE_STYLE_HASHES).toContain(hash(""));
  });

  it("allows every stylesheet the installed sonner injects", () => {
    const stylesheets = sonnerInjectedCss();
    expect(stylesheets.length).toBeGreaterThan(0);
    for (const css of stylesheets) {
      expect(
        INLINE_STYLE_HASHES,
        `sonner's CSS changed; add ${hash(css)} to INLINE_STYLE_HASHES in src/lib/csp.ts`,
      ).toContain(hash(css));
    }
  });
});
