import type { RegionId } from "../../campaign/world"

/** The Earth as rows of cells: a letter is the land of a region, "x" land of no region, "." the sea. */
export const EARTH: string[] = [
  "..............xxxxx.........................................",
  "...nnnnnnnnn...xxxx........eeeeeeeecccccccccccccc...........",
  ".nnnnnnnnnnnnn..xx......w.eeeeeeeeeecccccccccccccccc........",
  "nnnnnnnnnnnnnnn........ww.eeeeeeeeeeccccccccccccccccc.......",
  "..nnnnnnnnnnnnn.......wwweeeeeeeeeeecccccccccccccccc.c......",
  "...nnnnnnnnnnnn......wwwwweeeeeeeeeecccccccccccccc..........",
  "....nnnnnnnnnnn.....wwwwwweeeeeeemmmmiiicccccccccc..........",
  ".....nnnnnnnnn.......ww.aaaa..mmmmmmmiiiiicccccccc.c........",
  "......nnnnnnnn......aaaaaaaaa..mmmmmmiiiiiicccccc..c........",
  ".......nnnnnn......aaaaaaaaaaa.mmmmmmiiiiiiicccc...c........",
  "........nnnn.......aaaaaaaaaaaa.mmmm.iiiiiiiccc.............",
  ".........nnn........aaaaaaaaaaaa.m....iiiii..ccc............",
  "..........sss........aaaaaaaaaaa.......iii....cc.c..........",
  "..........sssss.......aaaaaaaa.........ii......c.cc.........",
  ".........sssssss.......aaaaaaa..........i.........cc........",
  ".........ssssssss.......aaaaaa...................x..........",
  "..........sssssss.......aaaaa.a.................xxxx........",
  "...........ssssss.......aaaa...................xxxxxxx......",
  "............ssss.........aa....................xxxxxxx......",
  "............sss................................xxxxx..x.....",
  "............ss.....................................x........",
  "............s...............................................",
]

const LETTERS: Record<string, RegionId> = { n: "na", s: "sa", w: "we", e: "ee", a: "af", m: "me", i: "sas", c: "eas" }

/** The cell where the name of each region is centred. */
export const LABELS: Record<RegionId, { x: number; y: number }> = {
  na: { x: 8, y: 4 },
  sa: { x: 13, y: 16 },
  we: { x: 20, y: 0 },
  ee: { x: 32, y: 0 },
  af: { x: 25, y: 11 },
  me: { x: 33, y: 9 },
  sas: { x: 40, y: 13 },
  eas: { x: 43, y: 4 },
}

/** The region whose land is at a cell, or null for the sea, land of no region and cells off the map. */
export function land(x: number, y: number): RegionId | null {
  return LETTERS[EARTH[y]?.[x] ?? "."] ?? null
}
