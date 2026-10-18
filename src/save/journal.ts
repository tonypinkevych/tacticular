import { type Event, finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure"
import { bytesToHex, hexToBytes } from "nostr-tools/utils"
import type { Conditions } from "../mission/mission"
import type { Action } from "../mission/orders"

/** Nostr event kind of the game log: one start event, then one event per player action. */
export const KIND = 7350

/** Nostr event kind of the run log: one start event, then one event per choice on the run. */
export const RUN = 7351

const TAG = ["t", "tacticular"]

const KEY = "tacticular.key"

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">

const now = (): number => Math.floor(Date.now() / 1000)

/** The player's signed logs: one start event, then one event per player action or run choice. */
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

  /** The start event of a log, with what the mission is built from. */
  begin(seed: number, conditions: Conditions = {}, kind = KIND): Event {
    return finalizeEvent(
      { kind, created_at: now(), tags: [TAG, ["seed", String(seed)]], content: JSON.stringify({ seed, conditions }) },
      this.key,
    )
  }

  record(start: Event, index: number, entry: object): Event {
    return finalizeEvent(
      {
        kind: start.kind,
        created_at: now(),
        tags: [TAG, ["e", start.id, "", "root"], ["n", String(index)]],
        content: JSON.stringify(entry),
      },
      this.key,
    )
  }
}

/** Reads a log back: checks every signature, the author, the root link and the order. */
export function history<T = Action>(
  events: Event[],
  kind = KIND,
): { seed: number; conditions: Conditions; actions: T[] } {
  const [start, ...rest] = events
  if (!start || !verifyEvent(start) || start.kind !== kind) throw new Error("bad start event")
  const seed = Number(start.tags.find((t) => t[0] === "seed")?.[1])
  if (!Number.isFinite(seed)) throw new Error("bad seed")
  const actions = rest.map((e, i) => {
    const root = e.tags.find((t) => t[0] === "e")?.[1]
    const n = Number(e.tags.find((t) => t[0] === "n")?.[1])
    const linked = e.kind === start.kind && e.pubkey === start.pubkey && root === start.id && n === i
    if (!verifyEvent(e) || !linked) throw new Error(`bad event ${i}`)
    return JSON.parse(e.content) as T
  })
  const conditions = (JSON.parse(start.content) as { conditions?: Conditions }).conditions ?? {}
  return { seed, conditions, actions }
}
