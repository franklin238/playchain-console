import { describe, expect, it } from "vitest";
import { countdown, liveRace, pickSpotlight, splitLocal, spotlightEpochs } from "../../src/arcade/logic";

describe("spotlightEpochs", () => {
  it("walks back from the previous epoch, never below 0", () => {
    expect(spotlightEpochs(0n, 30)).toEqual([]);
    expect(spotlightEpochs(3n, 30)).toEqual([2n, 1n, 0n]);
    expect(spotlightEpochs(100n, 3)).toEqual([99n, 98n, 97n]);
  });
});

describe("pickSpotlight", () => {
  const games = [
    { id: 1, active: true },
    { id: 2, active: true },
    { id: 3, active: false },
  ];
  it("uses the previous epoch's leader", () => {
    expect(pickSpotlight([4n, 3n], [2n, 1n], games)).toEqual({ id: 2, epoch: 4n });
  });
  it("skips epochs without votes", () => {
    expect(pickSpotlight([4n, 3n], [0n, 1n], games)).toEqual({ id: 1, epoch: 3n });
  });
  it("skips hidden games", () => {
    expect(pickSpotlight([4n, 3n], [3n, 2n], games)).toEqual({ id: 2, epoch: 3n });
  });
  it("falls back to the newest active game", () => {
    expect(pickSpotlight([4n], [0n], games)).toEqual({ id: 2, epoch: null });
    expect(pickSpotlight([], [], [])).toBeNull();
  });
});

describe("liveRace", () => {
  it("ranks by votes, drops zero, keeps the contract leader first on ties", () => {
    const rows = liveRace([1, 2, 3, 4], [100n, 300n, 300n, 0n], 3);
    expect(rows.map((r) => r.id)).toEqual([3, 2, 1]);
  });
  it("limits to 5", () => {
    expect(liveRace([1, 2, 3, 4, 5, 6], [1n, 2n, 3n, 4n, 5n, 6n], 6)).toHaveLength(5);
  });
});

describe("splitLocal", () => {
  it("matches the contract's 50/40/10 with remainder to burn", () => {
    expect(splitLocal(300n, 4000, 1000, false)).toEqual({ burned: 150n, toDev: 120n, toTreasury: 30n });
    expect(splitLocal(101n, 4000, 1000, false)).toEqual({ burned: 51n, toDev: 40n, toTreasury: 10n });
    expect(splitLocal(200n, 4000, 1000, true)).toEqual({ burned: 180n, toDev: 0n, toTreasury: 20n });
  });
});

describe("countdown", () => {
  it("formats hours or minutes", () => {
    expect(countdown(3 * 3600 + 12 * 60)).toBe("3h 12m");
    expect(countdown(65)).toBe("1m 05s");
    expect(countdown(-5)).toBe("0m 00s");
  });
});
