import type { Biome } from "../map/board"

export type RegionId = "na" | "sa" | "we" | "ee" | "af" | "me" | "sas" | "eas"

/** What a free region gives for the rest of the campaign. */
export type Bonus = "supplies" | "recruits" | "intel" | "materials" | "healing" | "drills" | "stealth" | "delay"

/** A region of the world: its biome, its neighbours and its bonus once free. */
export interface Place {
  id: RegionId
  biome: Biome
  next: RegionId[]
  bonus: Bonus
}

export const PLACES: Place[] = [
  { id: "na", biome: "forest", next: ["sa", "we", "eas"], bonus: "supplies" },
  { id: "sa", biome: "forest", next: ["na", "af"], bonus: "recruits" },
  { id: "we", biome: "village", next: ["na", "ee", "af"], bonus: "intel" },
  { id: "ee", biome: "town", next: ["we", "me", "eas"], bonus: "materials" },
  { id: "af", biome: "village", next: ["sa", "we", "me"], bonus: "healing" },
  { id: "me", biome: "town", next: ["ee", "af", "sas"], bonus: "drills" },
  { id: "sas", biome: "forest", next: ["me", "eas"], bonus: "stealth" },
  { id: "eas", biome: "town", next: ["ee", "sas", "na"], bonus: "delay" },
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
