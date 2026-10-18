import { type Event, finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure"
import { bytesToHex, hexToBytes } from "nostr-tools/utils"
import type { Action } from "../mission/orders"

/** Nostr event kind of the game log: one start event, then one event per player action. */
export const KIND = 7350

const TAG = ["t", "tacticular"]

const KEY = "tacticular.key"

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

const now = (): number => Math.floor(Date.now() / 1000)

/** The player's signed log of a mission: one start event, then one event per player action. */
export class Journal {
  constructor(private readonly key: Uint8Array) {}

  /** The journal with the player's signing key, made once and kept in storage. */
  static open(store: Store): Journal {
    const saved = store.getItem(KEY)
    if (saved && /^[0-9a-f]{64}$/.test(saved)) return new Journal(hexToBytes(saved))
    const fresh = generateSecretKey()
    store.setItem(KEY, bytesToHex(fresh))
    return new Journal(fresh)
  }

  /** The player's public key in hex. */
  author(): string {
    return getPublicKey(this.key)
  }

  begin(seed: number): Event {
    return finalizeEvent(
      { kind: KIND, created_at: now(), tags: [TAG, ["seed", String(seed)]], content: JSON.stringify({ seed }) },
      this.key,
    )
  }

  record(start: Event, index: number, action: Action): Event {
    return finalizeEvent(
      {
        kind: KIND,
        created_at: now(),
        tags: [TAG, ["e", start.id, "", "root"], ["n", String(index)]],
        content: JSON.stringify(action),
      },
      this.key,
    )
  }
}

/** Reads a log back: checks every signature, the author, the root link and the order. */
export function history(events: Event[]): { seed: number; actions: Action[] } {
  const [start, ...rest] = events
  if (!start || !verifyEvent(start) || start.kind !== KIND) throw new Error("bad start event")
  const seed = Number(start.tags.find((t) => t[0] === "seed")?.[1])
  if (!Number.isFinite(seed)) throw new Error("bad seed")
  const actions = rest.map((e, i) => {
    const root = e.tags.find((t) => t[0] === "e")?.[1]
    const n = Number(e.tags.find((t) => t[0] === "n")?.[1])
    if (!verifyEvent(e) || e.pubkey !== start.pubkey || root !== start.id || n !== i) throw new Error(`bad event ${i}`)
    return JSON.parse(e.content) as Action
  })
  return { seed, actions }
}
