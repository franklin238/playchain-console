import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildConsoleCsp, GAME_POLICY } from "../../src/security/csp";

describe("vercel.json headers", () => {
  const v = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  const find = (src: string) => v.headers.find((h: { source: string }) => h.source === src).headers.find((x: { key: string }) => x.key === "Content-Security-Policy").value;
  it("console policy matches the code and forbids framing the console", () => {
    expect(find("/((?!games/).*)")).toBe(buildConsoleCsp({ dev: false }));
    expect(buildConsoleCsp({ dev: false })).toContain("frame-ancestors 'none'");
  });
  it("games may only be framed by this site", () => {
    expect(find("/games/(.*)")).toBe(GAME_POLICY);
    expect(GAME_POLICY).toContain("frame-ancestors 'self'");
    expect(GAME_POLICY).toContain("connect-src 'self'");
  });
});

describe("sandbox", () => {
  it("never combines allow-scripts with allow-same-origin", async () => {
    const { GAME_SANDBOX } = await import("../../src/games/gameBridge");
    expect(GAME_SANDBOX).toContain("allow-scripts");
    expect(GAME_SANDBOX).not.toContain("allow-same-origin");
  });
});
