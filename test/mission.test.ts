import { walkable } from "../src/rules/grid";
import { mission } from "../src/rules/mission";
import { PROFILES } from "../src/rules/data";

describe("mission", () => {
  const seeds = Array.from({ length: 100 }, (_, i) => i + 1);
  test("every walkable tile and door is reachable from the squad", () => {
    for (const seed of seeds) {
      const g = mission(seed);
      const { width, height, tiles } = g.board;
      const open = (i: number) => walkable(tiles[i]) || tiles[i] === "door";
      const start = g.units[0].pos.y * width + g.units[0].pos.x;
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length) {
        const i = queue.pop()!;
        const x = i % width;
        for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
          if (n < 0 || n >= width * height || seen.has(n) || !open(n)) continue;
          seen.add(n);
          queue.push(n);
        }
      }
      tiles.forEach((_, i) => {
        if (open(i) && !seen.has(i)) throw new Error(`seed ${seed}: tile ${i % width},${Math.floor(i / width)} unreachable`);
      });
    }
  });
  test("the squad has 4 distinct classes within the random spread", () => {
    for (const seed of seeds) {
      const squad = mission(seed).units.filter((u) => u.side === "squad");
      expect(new Set(squad.map((u) => u.kind)).size).toBe(4);
      for (const u of squad) {
        expect(Math.abs(u.maxHp - PROFILES[u.kind].hp)).toBeLessThanOrEqual(2);
        expect(Math.abs(u.aim - PROFILES[u.kind].aim)).toBeLessThanOrEqual(1);
        expect(Math.abs(u.will - PROFILES[u.kind].will)).toBeLessThanOrEqual(1);
      }
    }
  });
  test("3-4 groups of 2-4; a Warchief in groups of 3+; at most one special", () => {
    for (const seed of seeds) {
      const g = mission(seed);
      expect(g.groups.length).toBeGreaterThanOrEqual(3);
      expect(g.groups.length).toBeLessThanOrEqual(4);
      for (const group of g.groups) {
        const kinds = g.units.filter((u) => u.group === group.id).map((u) => u.kind);
        expect(kinds.length).toBeGreaterThanOrEqual(2);
        expect(kinds.length).toBeLessThanOrEqual(4);
        if (kinds.length >= 3) expect(kinds).toContain("warchief");
        expect(kinds.filter((k) => ["ogre", "assassin", "whisperer"].includes(k)).length).toBeLessThanOrEqual(1);
      }
    }
  });
  test("the same seed builds the same mission", () => {
    expect(mission(7)).toEqual(mission(7));
  });
});
