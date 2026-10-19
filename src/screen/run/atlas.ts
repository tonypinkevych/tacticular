import type { RegionId } from "../../campaign/world"

/** The Earth as rows of cells: a letter is the land of a region, "x" land of no region, "." the sea. */
export const EARTH: string[] = [
  ".....................xxxxxxxxx......xxxxxxxxxxxxxx............................c..........cccc...........................",
  "..................xxxxxxx............xxxxxxxxxxxxx.........................e........ccccccccccccc.......................",
  "...nnnnnn.............nnnnnn..........xxxxxxxxxxx...............ee............ccccccccccccccccccccccccccccccc...........",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnnnn..........xxxxxxxx..............wweeeeeeeeeeeeeeccccccccccccccccccccccccccccccccccccccccc..",
  ".nnnnnnnnnnnnnnnnnnnnnnnnnn.............xxxx.....www........www..eeeeeeeeeeeecccccccccccccccccccccccccccccccccccccccccc.",
  "..nnnnnnnnnnnnnnnnnnnnnnnn.....n.........x................wwwww.eeeeeeeeeeeeeccccccccccccccccccccccccccccccccccccccc....",
  "....n......nnnnnnnnnnnnnnn.....nnnnn...................w..wwww..eeeeeeeeeeeeecccccccccccccccccccccccccc....cccc.........",
  ".............nnnnnnnnnnnnnnn..nnnnnnn..................w...ww..eeeeeeeeeeeeeeccccccccccccccccccccccccc.......cc.........",
  "..............nnnnnnnnnnnnnnnnnnnnnnnn...............wwww.wwwwweeeeeeeeeeeeeeccccccccccccccccccccccccccc................",
  "...............nnnnnnnnnnnnnnnnnnnnnn...................wwwwwwweeeeeeeeeeeeeecccccccccccccccccccccccccc.................",
  "...............nnnnnnnnnnnnnnnnnnnnn....................wwwwwwweeeeeeeeee.mmmmmmmmccccccccccccccccccccc.................",
  "...............nnnnnnnnnnnnnnnnnnn....................wwww..w..eee....eee.mmmmmmmmcccccccccccccccccccc.cc...............",
  "...............nnnnnnnnnnnnnnnnn......................www.....wm.mmmmmmmm.mmmmmmmmcccccccccccccccccc...c................",
  "................nnnnnnnnnnnnnnnn......................ww...a......mmmmmmmmmmmcccccccccccccccccccc.....cc................",
  ".................nnnnnnnnnnnnnn.......................aaaaaa........mmmmmmmmmcccccccccccccccccccc...c...................",
  "..................nnnnnnnnnnnn........................aaaaaaaaaaaaa.mmmmmmmmmcccccccccccccccccccc.......................",
  "....................nnnnn....n.....................aaaaaaaaaaaaaaaaammmmm.mmmiiiiiiiiiiiicccccccc.......................",
  "....................nnnn...........................aaaaaaaaaaaaaaaaaammmmm....iiiiiiiiiiiccccccc........................",
  ".....................nnn......n....................aaaaaaaaaaaaaaaaaammmmmmm....iiiiii..iiiiii..........................",
  ".......................nn.nn....nn.................aaaaaaaaaaaaaaaaaa.mmmmmm.....iiii...iiii............................",
  ".........................nnn.......................aaaaaaaaaaaaaaaaaaa.mmm.......iii.....iii.....i......................",
  "...........................nn......................aaaaaaaaaaaaaaaaaaaa...........i......iiii....i......................",
  ".............................n..ssss................aaaaaaaaaaaaaaaaaaaaaa........i......i.i............................",
  "...............................sssssss...............aaaaaaaaaaaaaaaaaaaa..........i...........i..i.....................",
  "...............................sssssssss....................aaaaaaaaaaaa.................ii...ii........................",
  "..............................ssssssssss....................aaaaaaaaaaa..................ii..iii.i......................",
  "..............................sssssssssssss.................aaaaaaaaaaa...................ii.ii.i....xxx................",
  "..............................sssssssssssssss................aaaaaaaaa................................xxxx..............",
  "..............................sssssssssssssss................aaaaaaaaa..................................xx..............",
  "...............................sssssssssssss.................aaaaaaaaa...............................x..................",
  "................................ssssssssssss.................aaaaaaaaa..a.........................xxxx..x...............",
  ".................................sssssssssss.................aaaaaaaaa.aa........................xxxxxxxx...............",
  ".................................ssssssssss..................aaaaaaaa..aa.......................xxxxxxxxxx..............",
  ".................................sssssssss...................aaaaaaa...a.......................xxxxxxxxxxxx.............",
  ".................................sssssss......................aaaaa............................xxxxxxxxxxxxx............",
  ".................................sssssss......................aaaaa............................xxxxxxxxxxxxx............",
  "................................sssssss........................aa..............................xxx...xxxxxx.............",
  "................................ssssss.................................................................xxxx.......x.....",
  "................................ssss...............................................................................x....",
  "................................sss...............................................................................x.....",
  "................................sss..............................................................................x......",
  "................................ss......................................................................................",
  "................................ss......................................................................................",
  ".................................s......................................................................................",
]

const LETTERS: Record<string, RegionId> = { n: "na", s: "sa", w: "we", e: "ee", a: "af", m: "me", i: "sas", c: "eas" }

/** The cell where the name of each region is centred. */
export const LABELS: Record<RegionId, { x: number; y: number }> = {
  na: { x: 21, y: 8 },
  sa: { x: 37, y: 30 },
  we: { x: 55, y: 5 },
  ee: { x: 70, y: 3 },
  af: { x: 62, y: 24 },
  me: { x: 72, y: 15 },
  sas: { x: 86, y: 21 },
  eas: { x: 95, y: 6 },
}

/** The region whose land is at a cell, or null for the sea, land of no region and cells off the map. */
export function land(x: number, y: number): RegionId | null {
  return LETTERS[EARTH[y]?.[x] ?? "."] ?? null
}
