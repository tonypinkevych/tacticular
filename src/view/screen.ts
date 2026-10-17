import { canTarget, Illegal } from "../rules/actions";
import { odds } from "../rules/combat";
import { PROFILES, WEAPONS } from "../rules/data";
import { AROUND, area, inside, key, plus, reach, same, tileAt, unitAt } from "../rules/grid";
import { visibleToSquad } from "../rules/stealth";
import { alive, sideOf } from "../rules/units";
import type { AbilityId, Action, Entry, Game, ItemId, Point, Unit, WeaponId } from "../rules/types";
import type { Session } from "../save/session";
import { language, remember, t, use, type Lang } from "../i18n/strings";
import { draw, type Scene } from "./scene";

type Mode =
  | { kind: "move" }
  | { kind: "attack"; weapon: WeaponId; target: string | null }
  | { kind: "ability"; ability: AbilityId; target: string | null }
  | { kind: "item"; item: ItemId };

const UNIT_TARGETS: AbilityId[] = ["charge", "volley", "heal", "ward", "fear", "rouse"];
const TILE_TARGETS: AbilityId[] = ["bulwark", "blink"];

const h = (tag: string, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElement => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
};

/** The play screen: the board canvas, the side panel and the input that drives the session. */
export class Screen {
  private selected: string | null = null;
  private mode: Mode = { kind: "move" };
  private hover: Point | null = null;
  private message = "";
  private zones = false;
  private confirmNew = false;
  private readonly icons: Record<string, HTMLImageElement> = {};
  private size = 28;

  constructor(
    private readonly session: Session,
    private readonly canvas: HTMLCanvasElement,
    private readonly panel: HTMLElement,
    private readonly store: Storage,
  ) {
    for (const kind of Object.keys(PROFILES)) {
      const img = new Image();
      img.src = `${import.meta.env.BASE_URL}icons/${kind}.svg`;
      img.onload = () => this.render();
      this.icons[kind] = img;
    }
    canvas.addEventListener("mousemove", (e) => this.onHover(e));
    canvas.addEventListener("mouseleave", () => { this.hover = null; this.render(); });
    canvas.addEventListener("click", (e) => this.onClick(e));
    canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); this.cancel(); });
    window.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("resize", () => this.render());
    this.selectNext();
    this.render();
  }

  private get game(): Game {
    return this.session.game;
  }

  private unit(): Unit | null {
    const u = this.selected ? this.game.units.find((x) => x.id === this.selected) : undefined;
    return u && alive(u) ? u : null;
  }

  private name(id: string | number | boolean | undefined): string {
    const u = this.game.units.find((x) => x.id === id);
    if (!u) return String(id ?? "");
    return u.side === "squad" ? `${u.name} (${t(`kind.${u.kind}`)})` : t(`kind.${u.kind}`);
  }

  private act(action: Action): void {
    try {
      this.session.act(action);
      this.message = "";
      this.mode = { kind: "move" };
      const u = this.unit();
      if (!u || u.ap === 0 || sideOf(u) !== "squad") this.selectNext();
    } catch (e) {
      if (!(e instanceof Illegal)) throw e;
      this.message = t(`illegal.${e.message}`);
    }
    this.render();
  }

  private selectNext(): void {
    const squad = this.game.units.filter((u) => alive(u) && sideOf(u) === "squad" && u.ap > 0);
    const at = squad.findIndex((u) => u.id === this.selected);
    this.selected = squad[(at + 1) % Math.max(1, squad.length)]?.id ?? null;
    this.mode = { kind: "move" };
  }

  private cancel(): void {
    this.mode = { kind: "move" };
    this.message = "";
    this.render();
  }

  private point(e: MouseEvent): Point | null {
    const r = this.canvas.getBoundingClientRect();
    const p = { x: Math.floor((e.clientX - r.left) / this.size), y: Math.floor((e.clientY - r.top) / this.size) };
    return inside(this.game.board, p) ? p : null;
  }

  private onHover(e: MouseEvent): void {
    const p = this.point(e);
    if (p && this.hover && same(p, this.hover)) return;
    this.hover = p;
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") this.cancel();
    if (e.key === "Tab") {
      e.preventDefault();
      this.selectNext();
      this.render();
    }
    if (e.key === "z" || e.key === "я") {
      this.zones = !this.zones;
      this.render();
    }
  }

  private seenFoe(p: Point): Unit | undefined {
    const u = unitAt(this.game, p);
    return u && u.side === "enemy" && visibleToSquad(this.game, u) ? u : u && sideOf(u) === "enemy" && u.side === "squad" ? u : undefined;
  }

  private onClick(e: MouseEvent): void {
    const p = this.point(e);
    if (!p || this.game.phase !== "squad") return;
    const here = unitAt(this.game, p);
    const u = this.unit();
    const m = this.mode;
    if (m.kind === "ability" && UNIT_TARGETS.includes(m.ability) && here) {
      this.act({ type: "ability", unit: u!.id, ability: m.ability, target: here.id });
      return;
    }
    if (m.kind === "ability" && TILE_TARGETS.includes(m.ability)) {
      this.act({ type: "ability", unit: u!.id, ability: m.ability, at: p });
      return;
    }
    if (m.kind === "item") {
      this.act({ type: "item", unit: u!.id, item: m.item, at: p });
      return;
    }
    if (here && here.side === "squad" && sideOf(here) === "squad") {
      this.selected = here.id;
      this.mode = { kind: "move" };
      this.message = "";
      this.render();
      return;
    }
    if (!u) return;
    const foe = this.seenFoe(p);
    if (foe) {
      const weapon = m.kind === "attack" ? m.weapon : u.weapon;
      if (m.kind === "attack" && m.target === foe.id) {
        this.act({ type: "attack", unit: u.id, target: foe.id, weapon });
        return;
      }
      this.mode = { kind: "attack", weapon, target: foe.id };
      this.render();
      return;
    }
    if (tileAt(this.game, p) === "door" && AROUND.some((d) => same(plus(u.pos, d), p))) {
      this.act({ type: "door", unit: u.id, at: p });
      return;
    }
    this.act({ type: "move", unit: u.id, to: p });
  }

  private scene(): Scene {
    const u = this.unit();
    const near = new Set<number>();
    const far = new Set<number>();
    let path: Point[] = [];
    const targets = new Set<string>();
    let spot: Point[] = [];
    if (u && this.game.phase === "squad" && u.ap > 0 && sideOf(u) === "squad") {
      if (this.mode.kind === "move") {
        const r = reach(this.game, u, u.mobility * u.ap);
        for (const [k, c] of r.cost) if (c > 0) (c <= u.mobility ? near : far).add(k);
        if (this.hover && r.cost.has(key(this.hover))) path = r.path(this.hover);
      }
      for (const e of this.game.units) if (e.side === "enemy" && visibleToSquad(this.game, e) && canTarget(this.game, u, e)) targets.add(e.id);
      const m = this.mode;
      if (this.hover && (m.kind === "item" && m.item !== "stone")) spot = area(this.hover, 1);
      if (this.hover && m.kind === "item" && m.item === "stone") spot = [this.hover];
    }
    const s = this.fit();
    return {
      game: this.game, size: s, icons: this.icons, selected: u, near, far, path, hover: this.hover, targets,
      area: spot.filter((p) => inside(this.game.board, p)), zones: this.zones,
    };
  }

  private fit(): number {
    const { width, height } = this.game.board;
    const room = Math.min((window.innerWidth - 380) / width, (window.innerHeight - 24) / height);
    this.size = Math.max(16, Math.min(40, Math.floor(room)));
    return this.size;
  }

  render(): void {
    const sc = this.scene();
    const { width, height } = this.game.board;
    this.canvas.width = width * sc.size;
    this.canvas.height = height * sc.size;
    draw(this.canvas.getContext("2d")!, sc);
    this.renderPanel();
  }

  private button(label: string, onClick: () => void, opts: { disabled?: boolean; active?: boolean; title?: string } = {}): HTMLElement {
    const b = h("button", { type: "button", title: opts.title ?? "" }, label) as HTMLButtonElement;
    b.disabled = !!opts.disabled;
    if (opts.active) b.classList.add("active");
    b.addEventListener("click", onClick);
    return b;
  }

  private renderPanel(): void {
    const g = this.game;
    const u = this.unit();
    const lang = language();
    const langs = h("div", { class: "row" }, ...(["en", "ru"] as Lang[]).map((l) =>
      this.button(l.toUpperCase(), () => { use(l); remember(this.store, l); this.render(); }, { active: l === lang })));
    const phase = h("div", { class: `phase ${g.phase}` }, `${t("ui.round", { round: g.round })} · ${t(`ui.phase.${g.phase}`)}`);
    const parts: HTMLElement[] = [
      h("header", {}, h("h1", {}, t("ui.title")), langs),
      phase,
      h("div", { class: "muted" }, t("ui.seed", { seed: g.seed })),
    ];
    parts.push(u ? this.card(u) : h("p", { class: "muted" }, t("ui.pick")));
    if (u && g.phase === "squad" && sideOf(u) === "squad") parts.push(this.actions(u));
    const preview = this.preview(u);
    if (preview) parts.push(preview);
    const info = this.info();
    if (info) parts.push(info);
    if (this.message) parts.push(h("p", { class: "message" }, this.message));
    parts.push(h("div", { class: "row" },
      this.button(t("ui.endTurn"), () => this.act({ type: "endTurn" }), { disabled: g.phase !== "squad" }),
      this.button(t("ui.undo"), () => { this.session.undo(); this.render(); }, { disabled: !this.session.canUndo() }),
      this.button(t("ui.zones"), () => { this.zones = !this.zones; this.render(); }, { active: this.zones }),
      this.button(this.confirmNew ? t("ui.confirm") : t("ui.newMission"), () => this.newMission()),
    ));
    parts.push(h("p", { class: "muted small" }, t("ui.help")));
    parts.push(h("h2", {}, t("ui.log")), this.log());
    const pub = this.session.author.slice(0, 12);
    parts.push(h("p", { class: "muted small" }, t("ui.save", { count: this.session.events.length, key: `${pub}…` })));
    parts.push(h("p", { class: "muted small" }, t("ui.credits")));
    this.panel.replaceChildren(...parts);
  }

  private newMission(): void {
    if (!this.confirmNew) {
      this.confirmNew = true;
      this.render();
      return;
    }
    this.confirmNew = false;
    this.session.start(Math.floor(Math.random() * 2 ** 31));
    this.selected = null;
    this.selectNext();
    this.render();
  }

  private card(u: Unit): HTMLElement {
    const w = WEAPONS[u.weapon];
    const stats = [
      `${t("ui.hp")} ${u.hp}/${u.maxHp}`, `${t("ui.ap")} ${u.ap}`, `${t("ui.aim")} +${u.aim}`, `${t("ui.defense")} ${u.defense}`,
      `${t("ui.armor")} ${u.armor}`, `${t("ui.mobility")} ${u.mobility}`, `${t("ui.will")} +${u.will}`, `${t("ui.vision")} ${u.vision}`,
    ];
    if (w.ammo !== null) stats.push(`${t("ui.ammo")} ${u.ammo}/${w.ammo}`);
    const status = [
      u.concealed ? t("ui.concealed") : t("ui.revealed"),
      ...u.statuses.map((s) => t(`status.${s.id}`)),
      u.stance !== "none" ? t(`action.${u.stance}`) : "",
    ].filter(Boolean).join(" · ");
    return h("section", { class: "card" },
      h("div", { class: "name" }, this.name(u.id)),
      h("div", { class: "stats" }, ...stats.map((s) => h("span", {}, s))),
      h("div", { class: "muted" }, status));
  }

  private actions(u: Unit): HTMLElement {
    const p = PROFILES[u.kind];
    const row: HTMLElement[] = [];
    for (const w of [u.weapon, p.sidearm].filter((x): x is WeaponId => !!x)) {
      const left = w === "axes" ? ` (${u.axes})` : "";
      row.push(this.button(`${t(`weapon.${w}`)}${left}`, () => { this.mode = { kind: "attack", weapon: w, target: null }; this.message = t("ui.pickTarget"); this.render(); },
        { active: this.mode.kind === "attack" && this.mode.weapon === w, disabled: w === "axes" && u.axes <= 0 }));
    }
    const dominated = this.game.units.some((x) => alive(x) && x.side === "squad" && sideOf(x) === "enemy");
    for (const a of p.abilities) {
      if (a === "rouse" && !dominated) continue;
      const cd = u.cooldowns[a];
      const label = cd ? `${t(`ability.${a}`)} (${cd})` : t(`ability.${a}`);
      row.push(this.button(label, () => this.pickAbility(u, a), {
        disabled: !!cd, active: this.mode.kind === "ability" && this.mode.ability === a, title: t(`info.${a}`),
      }));
    }
    for (const it of ["flask", "smoke", "stone"] as ItemId[]) {
      const n = u.items[it];
      if (n <= 0) continue;
      const count = Number.isFinite(n) ? ` ×${n}` : "";
      row.push(this.button(`${t(`item.${it}`)}${count}`, () => { this.mode = { kind: "item", item: it }; this.message = t("ui.pickTile"); this.render(); },
        { active: this.mode.kind === "item" && this.mode.item === it, title: t(`info.${it}`) }));
    }
    row.push(this.button(t("action.overwatch"), () => this.act({ type: "overwatch", unit: u.id }), { title: t("info.overwatch") }));
    row.push(this.button(t("action.hunker"), () => this.act({ type: "hunker", unit: u.id }), { title: t("info.hunker") }));
    if (WEAPONS[u.weapon].ammo !== null) row.push(this.button(t("action.reload"), () => this.act({ type: "reload", unit: u.id }), { title: t("info.reload") }));
    return h("section", {}, h("h2", {}, t("ui.actions")), h("div", { class: "row wrap" }, ...row));
  }

  private pickAbility(u: Unit, a: AbilityId): void {
    if (!UNIT_TARGETS.includes(a) && !TILE_TARGETS.includes(a)) {
      this.act({ type: "ability", unit: u.id, ability: a });
      return;
    }
    this.mode = { kind: "ability", ability: a, target: null };
    this.message = `${t(`info.${a}`)} ${UNIT_TARGETS.includes(a) ? t("ui.pickTarget") : t("ui.pickTile")}`;
    this.render();
  }

  private preview(u: Unit | null): HTMLElement | null {
    const m = this.mode;
    if (!u || m.kind !== "attack" || !m.target) return null;
    const target = this.game.units.find((x) => x.id === m.target);
    if (!target) return null;
    const o = odds(this.game, u, target, m.weapon);
    const lines = [
      h("div", { class: "name" }, `${t(`weapon.${m.weapon}`)} → ${this.name(target.id)}`),
      h("div", { class: "big" }, `${t("ui.chance")}: ${Math.round(o.chance * 100)}%`),
      h("div", {}, `${t("ui.damage")}: ${o.min}–${o.max}`),
      h("div", { class: "muted" }, `d20 +${o.aim} vs ${o.defense}`),
    ];
    if (o.advantages.length) lines.push(h("div", { class: "good" }, `${t("ui.advantage")}: ${o.advantages.map((r) => t(`reason.${r}`)).join(", ")}`));
    if (o.disadvantages.length) lines.push(h("div", { class: "bad" }, `${t("ui.disadvantage")}: ${o.disadvantages.map((r) => t(`reason.${r}`)).join(", ")}`));
    lines.push(h("div", { class: "row" },
      this.button(t("ui.confirm"), () => this.act({ type: "attack", unit: u.id, target: target.id, weapon: m.weapon })),
      this.button(t("ui.cancel"), () => this.cancel())));
    return h("section", { class: "card preview" }, ...lines);
  }

  private info(): HTMLElement | null {
    if (!this.hover) return null;
    const e = this.seenFoe(this.hover);
    if (!e) return null;
    const bits = [`${t("ui.hp")} ${e.hp}/${e.maxHp}`, t(`alert.${e.alert}`), ...e.statuses.map((s) => t(`status.${s.id}`))];
    if (e.stance !== "none") bits.push(t(`action.${e.stance}`));
    return h("section", { class: "card enemy" }, h("div", { class: "name" }, this.name(e.id)), h("div", { class: "muted" }, bits.join(" · ")));
  }

  private line(e: Entry): string {
    const p: Record<string, string | number | boolean> = { ...e.params };
    for (const k of ["unit", "target", "by"]) if (k in p) p[k] = this.name(p[k]);
    if (typeof p.weapon === "string") p.weapon = t(`weapon.${p.weapon}`);
    if ("saved" in p) p.result = t(p.saved ? "ui.saved" : "ui.failed");
    return t(e.key, p);
  }

  private log(): HTMLElement {
    const entries = this.game.log.slice(-60).reverse();
    return h("ol", { class: "log" }, ...entries.map((e) => h("li", { class: e.key.replace(".", "-") }, this.line(e))));
  }
}
