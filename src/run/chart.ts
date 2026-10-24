import { Dice } from "../combat/dice"

/** What a mission on the chart is: a goal, an elite fight, or the fortress at the end. */
export type Task = "kill" | "evac" | "defend" | "elite" | "fortress"

/** One mission on the chart and the missions it leads to. */
export interface Node {
  id: number
  layer: number
  kind: Task
  next: number[]
}

const KINDS: Task[] = ["kill", "evac", "defend", "elite"]

const LAYERS = 4

/** The map of one act: 4 layers of 2-3 missions, each leading to 1-2 of the next, then the fortress. */
export class Chart {
  constructor(
    readonly seed: number,
    readonly nodes: Node[],
  ) {}

  /** The chart a seed gives. */
  static of(seed: number): Chart {
    const r = new Dice({ rng: seed })
    const nodes: Node[] = []
    const layers: Node[][] = []
    for (let layer = 0; layer < LAYERS; layer++) {
      const kinds = r.shuffle(KINDS).slice(0, r.between(2, 3))
      const row = kinds.map((kind, i): Node => ({ id: nodes.length + i, layer, kind, next: [] }))
      nodes.push(...row)
      layers.push(row)
    }
    const fortress: Node = { id: nodes.length, layer: LAYERS, kind: "fortress", next: [] }
    nodes.push(fortress)
    layers.push([fortress])
    for (let layer = 0; layer < LAYERS; layer++) {
      const here = layers[layer],
        there = layers[layer + 1]
      for (const [j, n] of here.entries()) {
        const k = here.length === 1 ? 0 : Math.round((j * (there.length - 1)) / (here.length - 1))
        n.next.push(there[k].id)
        const side = there[k + r.pick([-1, 1])]
        if (side && r.random() < 0.5) n.next.push(side.id)
      }
      for (const [k, m] of there.entries()) {
        if (here.some((n) => n.next.includes(m.id))) continue
        here[Math.round((k * (here.length - 1)) / Math.max(1, there.length - 1))].next.push(m.id)
      }
    }
    return new Chart(seed, nodes)
  }

  layer(i: number): Node[] {
    return this.nodes.filter((n) => n.layer === i)
  }

  node(id: number): Node {
    const n = this.nodes.find((x) => x.id === id)
    if (!n) throw new Error(`unknown node ${id}`)
    return n
  }
}
