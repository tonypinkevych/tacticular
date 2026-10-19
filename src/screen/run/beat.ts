import type { Campaign, Note, OpKind } from "../../campaign/campaign"
import type { RegionId } from "../../campaign/world"

/** One change of a week as the playback shows it: an icon, a line of text, and the region it happened in. */
export interface Beat {
  icon: string
  note: Note
  region: RegionId | null
}

/** What of a campaign the playback compares before and after a week. */
export interface Glance {
  supplies: number
  intel: number
  materials: number
  force: number
  project: number
  roster: { id: string; name: string }[]
  ops: { id: number; kind: OpKind; region: RegionId }[]
}

const RESOURCES = ["supplies", "intel", "materials"] as const

const ICONS: Record<string, string> = {
  "week.research": "world:research",
  "week.reinforced": "world:strength",
  "week.event": "world:event",
  "week.haven": "world:resistance",
}

export function glance(c: Campaign): Glance {
  return {
    supplies: c.supplies,
    intel: c.intel,
    materials: c.materials,
    force: c.force,
    project: c.project,
    roster: c.roster.map((s) => ({ id: s.id, name: s.name })),
    ops: c.ops.map((o) => ({ id: o.id, kind: o.kind, region: o.region })),
  }
}

/**
 * The beats of a week in the order they play: income, new soldiers, the report's lines, the Force Level, the Project,
 * expired operations and new ones.
 */
export function beats(before: Glance, after: Glance, report: Note[]): Beat[] {
  const gains: Beat[] = RESOURCES.filter((r) => after[r] > before[r]).map((r) => ({
    icon: `world:${r}`,
    note: { key: `recap.${r}`, params: { amount: after[r] - before[r] } },
    region: null,
  }))
  const recruits: Beat[] = after.roster
    .filter((s) => !before.roster.some((b) => b.id === s.id))
    .map((s) => ({ icon: "world:recruit", note: { key: "recap.recruit", params: { name: s.name } }, region: null }))
  const lines: Beat[] = report.map((n) => ({
    icon: ICONS[n.key] ?? "world:log",
    note: n,
    region: (n.params.region as RegionId | undefined) ?? null,
  }))
  const aliens: Beat[] = [
    ...(after.force > before.force
      ? [{ icon: "world:force", note: { key: "recap.force", params: { force: after.force } }, region: null }]
      : []),
    ...(after.project > before.project
      ? [
          {
            icon: "world:project",
            note: { key: "recap.project", params: { amount: after.project - before.project } },
            region: null,
          },
        ]
      : []),
  ]
  const op = (key: string) => (o: Glance["ops"][number]) => ({
    icon: `op:${o.kind}`,
    note: { key, params: { op: o.kind, region: o.region } },
    region: o.region,
  })
  const expired = before.ops.filter((o) => !after.ops.some((a) => a.id === o.id)).map(op("recap.expired"))
  const opened = after.ops.filter((o) => !before.ops.some((b) => b.id === o.id)).map(op("recap.new"))
  return [...gains, ...recruits, ...lines, ...aliens, ...expired, ...opened]
}
