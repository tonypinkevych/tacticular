import { coverAgainst, coverAt } from "../rules/cover";
import { DETECTION, WEAPONS } from "../rules/data";
import { AROUND, distance, inside, key, ORTHOGONAL, plus, same, tileAt } from "../rules/grid";
import { sees, visibleTiles } from "../rules/sight";
import { visibleToSquad } from "../rules/stealth";
import { alive, has, sideOf } from "../rules/units";
import type { Game, Point, Tile, Unit } from "../rules/types";

/** What the board shows besides the game: selection, reach, hover and overlays. */
export interface Scene {
  game: Game;
  size: number;
  icons: Partial<Record<string, HTMLImageElement>>;
  selected: Unit | null;
  near: Set<number>;
  far: Set<number>;
  path: Point[];
  hover: Point | null;
  targets: Set<string>;
  area: Point[];
  zones: boolean;
}

const COLORS: Record<Tile, string> = {
  floor: "#2c3b2f", low: "#2c3b2f", high: "#2c3b2f", wall: "#4a423b", door: "#8b5a2b", open: "#5a4128",
  water: "#1f4e70", bridge: "#6e5634",
};

const SQUAD = "#3b82c4";
const ENEMY = "#c0443a";
const DOMINATED = "#8b4ec0";

/** Tiles the squad sees now. */
export function sight(game: Game): Set<number> {
  const out = new Set<number>();
  for (const u of game.units) {
    if (alive(u) && sideOf(u) === "squad") for (const k of visibleTiles(game, u)) out.add(k);
  }
  return out;
}

function tile(ctx: CanvasRenderingContext2D, s: number, p: Point, t: Tile): void {
  const x = p.x * s;
  const y = p.y * s;
  ctx.fillStyle = COLORS[t];
  ctx.fillRect(x, y, s, s);
  if (t === "low") {
    ctx.fillStyle = "#9c8350";
    ctx.fillRect(x + s * 0.18, y + s * 0.3, s * 0.64, s * 0.4);
  } else if (t === "high") {
    ctx.fillStyle = "#7d828a";
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (t === "water") {
    ctx.strokeStyle = "#2f6c96";
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.5);
    ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.3, x + s * 0.8, y + s * 0.5);
    ctx.stroke();
  } else if (t === "bridge") {
    ctx.strokeStyle = "#4f3c22";
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + (s * i) / 4);
      ctx.lineTo(x + s, y + (s * i) / 4);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function disk(ctx: CanvasRenderingContext2D, s: number, sc: Scene, u: Unit, alpha = 1): void {
  const cx = u.pos.x * s + s / 2;
  const cy = u.pos.y * s + s / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = has(u, "dominated") ? DOMINATED : u.side === "squad" ? SQUAD : ENEMY;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
  ctx.fill();
  if (u.concealed) {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#e8f1ff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }
  const icon = sc.icons[u.kind];
  if (icon?.complete && icon.naturalWidth > 0) {
    ctx.drawImage(icon, cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6);
  } else {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.floor(s * 0.45)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(u.kind[0].toUpperCase(), cx, cy);
  }
  ctx.globalAlpha = 1;
}

function badges(ctx: CanvasRenderingContext2D, s: number, u: Unit): void {
  const x = u.pos.x * s;
  const y = u.pos.y * s;
  const w = s - 4;
  ctx.fillStyle = "#200";
  ctx.fillRect(x + 2, y + s - 5, w, 3);
  ctx.fillStyle = u.hp / u.maxHp > 0.5 ? "#5fd35f" : u.hp / u.maxHp > 0.25 ? "#e3c13b" : "#e3503b";
  ctx.fillRect(x + 2, y + s - 5, (w * u.hp) / u.maxHp, 3);
  if (u.side === "squad" && sideOf(u) === "squad") {
    for (let i = 0; i < u.ap; i++) {
      ctx.fillStyle = "#ffd84a";
      ctx.beginPath();
      ctx.arc(x + 5 + i * 6, y + 5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const marks = [
    u.stance === "overwatch" ? "◉" : "", u.stance === "hunker" ? "▼" : "",
    ...u.statuses.map((st) => ({ suppressed: "S", frightened: "F", shaken: "K", burning: "B", dominated: "D", ward: "W" })[st.id]),
  ].filter(Boolean).join("");
  if (marks) {
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.max(9, Math.floor(s * 0.3))}px system-ui`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(marks, x + s - 2, y + 1);
  }
}

function tint(ctx: CanvasRenderingContext2D, s: number, keys: Iterable<number>, color: string): void {
  ctx.fillStyle = color;
  for (const k of keys) ctx.fillRect((k % 1000) * s, Math.floor(k / 1000) * s, s, s);
}

function ring(ctx: CanvasRenderingContext2D, s: number, p: Point, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x * s + s / 2, p.y * s + s / 2, s * 0.48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
}

function arrow(ctx: CanvasRenderingContext2D, s: number, from: Point, to: Point, color: string, dashed = false): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(from.x * s + s / 2, from.y * s + s / 2);
  ctx.lineTo(to.x * s + s / 2, to.y * s + s / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

function zones(ctx: CanvasRenderingContext2D, s: number, game: Game, enemies: Unit[]): void {
  for (const e of enemies) {
    const radius = e.stance === "overwatch" ? e.vision : e.alert === "unaware" ? DETECTION.unaware : DETECTION.investigating;
    const color = e.stance === "overwatch" ? "rgba(255,150,40,0.22)" : "rgba(255,40,40,0.18)";
    const keys: number[] = [];
    for (let y = e.pos.y - radius; y <= e.pos.y + radius; y++) {
      for (let x = e.pos.x - radius; x <= e.pos.x + radius; x++) {
        const p = { x, y };
        if (inside(game.board, p) && distance(e.pos, p) <= radius && sees(game, e, p, radius)) keys.push(key(p));
      }
    }
    tint(ctx, s, keys, color);
    if (WEAPONS[e.weapon].melee) {
      tint(ctx, s, AROUND.map((d) => key(plus(e.pos, d))), "rgba(170,60,220,0.25)");
    }
  }
}

function cover(ctx: CanvasRenderingContext2D, s: number, game: Game, p: Point): void {
  for (const d of ORTHOGONAL) {
    const c = coverAt(game, plus(p, d));
    if (c === 0) continue;
    ctx.fillStyle = c >= 5 ? "#7fd0ff" : "#b8e0ff";
    const t = c >= 5 ? 5 : 3;
    const x = p.x * s;
    const y = p.y * s;
    if (d.x === 1) ctx.fillRect(x + s - t, y + 2, t, s - 4);
    if (d.x === -1) ctx.fillRect(x, y + 2, t, s - 4);
    if (d.y === 1) ctx.fillRect(x + 2, y + s - t, s - 4, t);
    if (d.y === -1) ctx.fillRect(x + 2, y, s - 4, t);
  }
}

/** Draws the whole board for the player: only what the squad sees, knows or remembers. */
export function draw(ctx: CanvasRenderingContext2D, sc: Scene): void {
  const { game, size: s } = sc;
  const { width, height } = game.board;
  const seen = sight(game);
  ctx.clearRect(0, 0, width * s, height * s);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = { x, y };
      if (!game.explored[y * width + x]) {
        ctx.fillStyle = "#0b0d10";
        ctx.fillRect(x * s, y * s, s, s);
        continue;
      }
      tile(ctx, s, p, tileAt(game, p));
      if (!seen.has(key(p))) {
        ctx.fillStyle = "rgba(5,8,12,0.5)";
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
  }
  for (const z of game.zones) {
    if (z.kind === "smoke") tint(ctx, s, z.tiles.filter((p) => game.explored[p.y * width + p.x]).map(key), "rgba(200,200,210,0.35)");
  }
  const enemies = game.units.filter((u) => alive(u) && u.side === "enemy" && visibleToSquad(game, u));
  if (sc.zones) zones(ctx, s, game, enemies);
  tint(ctx, s, sc.far, "rgba(255,210,60,0.16)");
  tint(ctx, s, sc.near, "rgba(70,150,255,0.22)");
  tint(ctx, s, sc.area.map(key), "rgba(255,120,40,0.35)");
  if (sc.path.length > 0 && sc.selected) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sc.selected.pos.x * s + s / 2, sc.selected.pos.y * s + s / 2);
    for (const p of sc.path) ctx.lineTo(p.x * s + s / 2, p.y * s + s / 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  for (const g of game.ghosts) {
    const u = game.units.find((x) => x.id === g.unit);
    if (!u || enemies.includes(u)) continue;
    disk(ctx, s, sc, { ...u, pos: g.at, concealed: false }, 0.35);
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.floor(s * 0.3)}px system-ui`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`R${g.round}`, g.at.x * s + 2, g.at.y * s + 1);
  }
  for (const n of game.noises) {
    if (n.round < game.round - 1 || seen.has(key(n.at))) continue;
    ctx.fillStyle = "rgba(255,220,80,0.9)";
    ctx.font = `bold ${Math.floor(s * 0.7)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", n.at.x * s + s / 2, n.at.y * s + s / 2);
  }
  for (const e of enemies) {
    const intent = e.intent;
    if (intent?.type === "bomb") tint(ctx, s, AROUND.concat({ x: 0, y: 0 }).map((d) => key(plus(intent.at, d))), "rgba(255,60,0,0.35)");
    if (intent?.type === "charge") {
      const t = game.units.find((x) => x.id === intent.target);
      if (t && alive(t)) arrow(ctx, s, e.pos, t.pos, "#ff5a3c", true);
    }
    if (e.alert === "unaware" && e.patrol.length > 0) {
      const goal = e.patrol[e.patrolIndex % e.patrol.length];
      const dx = Math.sign(goal.x - e.pos.x);
      const dy = Math.sign(goal.y - e.pos.y);
      if (dx || dy) arrow(ctx, s, e.pos, { x: e.pos.x + dx * 0.9, y: e.pos.y + dy * 0.9 }, "#ffd84a");
    }
  }
  for (const u of game.units) {
    if (!alive(u) || (u.side === "enemy" && !enemies.includes(u))) continue;
    disk(ctx, s, sc, u);
    badges(ctx, s, u);
  }
  if (sc.selected) ring(ctx, s, sc.selected.pos, "#ffffff");
  for (const e of enemies) if (sc.targets.has(e.id)) ring(ctx, s, e.pos, "rgba(255,255,255,0.55)");
  const hover = sc.hover;
  const sel = sc.selected;
  if (hover && sel && (sc.near.has(key(hover)) || sc.far.has(key(hover)))) {
    cover(ctx, s, game, hover);
    for (const e of enemies) {
      if (sees(game, e, hover) && coverAgainst(game, hover, e.pos) === 0) ring(ctx, s, e.pos, "#ff3b3b");
      else if (sees(game, { ...sel, pos: hover }, e.pos) && coverAgainst(game, e.pos, hover) === 0) ring(ctx, s, e.pos, "#3bff6a");
    }
    const radius = (e: Unit) => (e.alert === "unaware" ? DETECTION.unaware : DETECTION.investigating);
    if (sel.concealed && enemies.some((e) => sees(game, e, hover, radius(e)))) {
      ctx.fillStyle = "#ff3b3b";
      ctx.font = `bold ${Math.floor(s * 0.6)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("👁", hover.x * s + s / 2, hover.y * s + s / 2);
    }
  }
  if (hover && !same(hover, sc.selected?.pos ?? { x: -1, y: -1 })) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.strokeRect(hover.x * s + 1, hover.y * s + 1, s - 2, s - 2);
  }
}
