import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCAL_SLUGS, validateMeta } from "../../src/games/meta";

// Every game shipped with the site must pass the same validation the console applies,
// or it silently drops off the shelf.
describe.each(LOCAL_SLUGS)("game %s", (slug) => {
  const dir = new URL(`../../public/games/${slug}/`, import.meta.url);
  const hasMeta = existsSync(new URL("meta.json", dir));

  it.skipIf(!hasMeta)("meta.json passes validation", () => {
    const r = validateMeta(JSON.parse(readFileSync(new URL("meta.json", dir), "utf8")));
    expect(r.errors).toEqual([]);
    expect(r.meta?.slug).toBe(slug);
    expect(r.meta?.playUrl).toMatch(new RegExp(`/games/${slug}/index\\.html$`));
    expect(r.meta?.cover).toMatch(new RegExp(`/games/${slug}/cover\\.png$`));
  });

  it.skipIf(!hasMeta)("ships index.html and a 1280x720 cover.png", () => {
    expect(existsSync(new URL("index.html", dir))).toBe(true);
    const png = readFileSync(new URL("cover.png", dir));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1280, 720]);
  });
});
