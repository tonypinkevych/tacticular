import type { Biome } from "../map/board"

export type RegionId = "na" | "sa" | "we" | "ee" | "af" | "me" | "sas" | "eas"

/** What a free region gives for the rest of the campaign. */
export type Bonus = "supplies" | "recruits" | "intel" | "materials" | "healing" | "drills" | "stealth" | "delay"

/** A region of the world map: its biome, its neighbours, its bonus once free and where the map draws it. */
export interface Place {
  id: RegionId
  biome: Biome
  next: RegionId[]
  bonus: Bonus
  x: number
  y: number
}

export const PLACES: Place[] = [
  { id: "na", biome: "forest", next: ["sa", "we", "eas"], bonus: "supplies", x: 12, y: 30 },
  { id: "sa", biome: "forest", next: ["na", "af"], bonus: "recruits", x: 24, y: 76 },
  { id: "we", biome: "village", next: ["na", "ee", "af"], bonus: "intel", x: 38, y: 22 },
  { id: "ee", biome: "town", next: ["we", "me", "eas"], bonus: "materials", x: 60, y: 14 },
  { id: "af", biome: "village", next: ["sa", "we", "me"], bonus: "healing", x: 44, y: 66 },
  { id: "me", biome: "town", next: ["ee", "af", "sas"], bonus: "drills", x: 63, y: 46 },
  { id: "sas", biome: "forest", next: ["me", "eas"], bonus: "stealth", x: 78, y: 76 },
  { id: "eas", biome: "town", next: ["ee", "sas", "na"], bonus: "delay", x: 87, y: 32 },
]

/** The state of a region in a campaign. */
export interface Region {
  id: RegionId
  /** 0–10: the size of the alien force in its missions. */
  strength: number
  /** 0–10: how much the aliens watch it; it rises with each mission there. */
  vigilance: number
  /** 0–4: 1 is contact, which opens its operations; 4 opens a Liberation. */
  resistance: number
  free: boolean
}

export const place = (id: RegionId): Place => PLACES.find((p) => p.id === id)!
