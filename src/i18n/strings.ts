export type Lang = "en" | "ru"

const en = {
  "ui.uses": "{left} left",
  "ui.cooldown": "in {left}",
  "ui.ready": "ready",
  "ui.squad": "SQUAD",
  "ui.continue": "Continue",
  "ui.target": "TARGET",
  "ui.cover": "Cover",
  "ui.aliens": "ALIENS",
  "ui.overwatch": "Overwatch",
  "ui.hint": "Click: move or shoot · Tab: next soldier · Esc: cancel",
  "skill.runGun": "Run & Gun",
  "skill.headshot": "Headshot",
  "skill.grenade": "Grenade",
  "skill.medkit": "Medkit",
  "skill.covering": "Covering fire",
  "skill.charge": "Charge",
  "skill.blast": "Marked blast",
  "skill.warcry": "War cry",
  "kind.grunt": "Grunt",
  "kind.brute": "Brute",
  "kind.commander": "Commander",
  "ui.run.draft": "Pick 3 soldiers",
  "ui.run.move": "move {tiles}",
  "ui.run.start": "Start the run",
  "ui.run.chart": "Pick the next mission",
  "ui.run.threat": "Threat {threat}: each 3 threat adds an alien",
  "ui.run.deploy": "Send up to 3 soldiers",
  "ui.run.go": "Go",
  "ui.run.reward": "Pick a reward",
  "ui.run.won": "The fortress has fallen",
  "ui.run.lost": "The run is over",
  "ui.run.new": "New run",
  "ui.task.kill": "Kill all",
  "ui.task.evac": "Evac",
  "ui.task.defend": "Defend",
  "ui.task.elite": "Elite",
  "ui.task.fortress": "Fortress",
  "ui.reward.heal": "Heal every soldier for 3",
  "ui.reward.recruit": "A new {kind} joins",
  "ui.reward.train": "Train the {unit}: +1 HP, +5 aim",
  "ui.reward.upgrade": "Upgrade {skill} of the {unit}",
  "skill.about.runGun": "dash, then shoot",
  "skill.about.headshot": "a sure crit on a flanked target",
  "skill.about.grenade": "2 damage in a plus, breaks cover",
  "skill.about.medkit": "heal an ally next to you for 2",
  "ui.round": "Round {round}",
  "ui.goal.kill": "Kill all aliens",
  "ui.goal.evac": "Evac: all soldiers to the top row",
  "ui.goal.defend": "Hold the beacon: {left} rounds",
  "ui.drop": "Alien drop in {rounds}",
  "ui.dropNow": "Alien drop lands this turn",
  "ui.dropNone": "No more drops",
  "ui.phase.squad": "Your turn",
  "ui.phase.enemy": "Alien turn",
  "ui.phase.won": "Victory",
  "ui.phase.lost": "Squad lost",
  "ui.endTurn": "End turn",
  "ui.hp": "HP",
  "ui.damage": "Damage",
  "ui.log": "Log",
  "ui.pickTarget": "Select a target",
  "ui.soundOn": "Sound on",
  "ui.soundOff": "Sound off",
  "ui.crit": "Crit",

  "kind.vanguard": "Vanguard",
  "kind.ranger": "Ranger",
  "kind.warden": "Warden",
  "kind.cleric": "Cleric",
  "kind.bomber": "Bomber",
  "log.overwatch": "{unit} fires on overwatch at {target}",
  "log.barrel": "A barrel blows up",
  "log.evac": "{unit} leaves the area",
  "log.headshot": "{unit} lines up a headshot on {target}",
  "log.grenade": "{unit} throws a grenade",
  "log.blast": "{unit} blows up its marked blast",
  "log.rush": "{unit} charges",
  "log.drown": "{target} falls into the water",
  "log.miss": "{unit} → {target}: miss · {chance}%",
  "log.hit": "{unit} → {target}: −{dmg} · {chance}%",
  "log.crit": "{unit} → {target}: crit −{dmg} · {chance}%",
  "log.push": "{target} is pushed back",
  "log.fire": "{target} burns in the fire for {dmg}",
  "log.dies": "{unit} dies",
  "log.heal": "{unit} heals {target} for {amount}",
  "log.mark": "{unit} locks on",
  "log.round": "— Round {round} —",
  "log.drop": "Alien drop: {count} more landed",
  "log.beacon": "Aliens took the beacon",
  "illegal.over": "The mission is over.",
  "illegal.dead": "This unit is dead.",
  "illegal.not your turn": "Not this unit's turn.",
  "illegal.no AP": "No action points left.",
  "illegal.unreachable": "Cannot reach that tile.",
  "illegal.target": "Invalid target.",
  "illegal.ability": "This unit has no such ability.",
  "illegal.cooldown": "This ability is on cooldown.",
  "illegal.place": "Invalid tile.",
  "illegal.range": "Out of range.",
  "log.run": "{unit} runs and guns",
  "log.warcry": "{unit} roars a war cry",
  "log.covering": "{unit} gives covering fire on {target}",
  "illegal.uses": "No uses left this mission.",
  "illegal.flank": "Needs an Exposed or flanked target, or concealment.",
}

export type Key = keyof typeof en

const ru: Record<Key, string> = {
  "ui.uses": "осталось {left}",
  "ui.cooldown": "через {left}",
  "ui.ready": "готово",
  "ui.squad": "ОТРЯД",
  "ui.continue": "Дальше",
  "ui.target": "ЦЕЛЬ",
  "ui.cover": "Укрытие",
  "ui.aliens": "ПРИШЕЛЬЦЫ",
  "ui.overwatch": "Наблюдение",
  "ui.hint": "Клик: идти или стрелять · Tab: следующий боец · Esc: отмена",
  "skill.runGun": "Бег и огонь",
  "skill.headshot": "Выстрел в голову",
  "skill.grenade": "Граната",
  "skill.medkit": "Аптечка",
  "skill.covering": "Огонь прикрытия",
  "skill.charge": "Таран",
  "skill.blast": "Отмеченный взрыв",
  "skill.warcry": "Боевой клич",
  "kind.grunt": "Пехотинец",
  "kind.brute": "Громила",
  "kind.commander": "Командир",
  "ui.run.draft": "Выберите 3 бойцов",
  "ui.run.move": "ход {tiles}",
  "ui.run.start": "Начать поход",
  "ui.run.chart": "Выберите следующую миссию",
  "ui.run.threat": "Угроза {threat}: каждые 3 добавляют пришельца",
  "ui.run.deploy": "Отправьте до 3 бойцов",
  "ui.run.go": "Вперёд",
  "ui.run.reward": "Выберите награду",
  "ui.run.won": "Крепость пала",
  "ui.run.lost": "Поход окончен",
  "ui.run.new": "Новый поход",
  "ui.task.kill": "Уничтожить всех",
  "ui.task.evac": "Эвакуация",
  "ui.task.defend": "Оборона",
  "ui.task.elite": "Элита",
  "ui.task.fortress": "Крепость",
  "ui.reward.heal": "Вылечить всех бойцов на 3",
  "ui.reward.recruit": "В отряд вступает {kind}",
  "ui.reward.train": "Тренировка: {unit} +1 ОЗ, +5 к меткости",
  "ui.reward.upgrade": "Улучшить «{skill}»: {unit}",
  "skill.about.runGun": "рывок, затем выстрел",
  "skill.about.headshot": "верный крит по цели с фланга",
  "skill.about.grenade": "2 урона крестом, ломает укрытие",
  "skill.about.medkit": "лечит соседа на 2",
  "ui.round": "Раунд {round}",
  "ui.goal.kill": "Уничтожить всех пришельцев",
  "ui.goal.evac": "Эвакуация: все бойцы в верхний ряд",
  "ui.goal.defend": "Удержать маяк: {left} р.",
  "ui.drop": "Высадка через {rounds}",
  "ui.dropNow": "Высадка пришельцев в этот ход",
  "ui.dropNone": "Высадок больше не будет",
  "ui.phase.squad": "Ваш ход",
  "ui.phase.enemy": "Ход пришельцев",
  "ui.phase.won": "Победа",
  "ui.phase.lost": "Отряд погиб",
  "ui.endTurn": "Завершить ход",
  "ui.hp": "ОЗ",
  "ui.damage": "Урон",
  "ui.log": "Журнал",
  "ui.pickTarget": "Выберите цель",
  "ui.soundOn": "Звук включён",
  "ui.soundOff": "Звук выключен",
  "ui.crit": "Крит",

  "kind.vanguard": "Авангард",
  "kind.ranger": "Рейнджер",
  "kind.warden": "Страж",
  "kind.cleric": "Клирик",
  "kind.bomber": "Бомбер",
  "log.overwatch": "{unit} стреляет по {target} из наблюдения",
  "log.barrel": "Взрывается бочка",
  "log.evac": "{unit} покидает зону",
  "log.headshot": "{unit} целится в голову {target}",
  "log.grenade": "{unit} бросает гранату",
  "log.blast": "{unit} взрывает отмеченную зону",
  "log.rush": "{unit} идёт в атаку",
  "log.drown": "{target} падает в воду",
  "log.miss": "{unit} → {target}: промах · {chance}%",
  "log.hit": "{unit} → {target}: −{dmg} · {chance}%",
  "log.crit": "{unit} → {target}: крит −{dmg} · {chance}%",
  "log.push": "{target} отброшен",
  "log.fire": "{target} горит в огне: урон {dmg}",
  "log.dies": "{unit} погибает",
  "log.heal": "{unit} лечит {target} на {amount}",
  "log.mark": "{unit} захватывает цель",
  "log.round": "— Раунд {round} —",
  "log.drop": "Высадка: ещё {count} пришельца",
  "log.beacon": "Пришельцы захватили маяк",
  "illegal.over": "Миссия окончена.",
  "illegal.dead": "Этот боец мёртв.",
  "illegal.not your turn": "Сейчас не ход этого бойца.",
  "illegal.no AP": "Нет очков действия.",
  "illegal.unreachable": "До этой клетки не дойти.",
  "illegal.target": "Неверная цель.",
  "illegal.ability": "У бойца нет такой способности.",
  "illegal.cooldown": "Способность перезаряжается.",
  "illegal.place": "Неверная клетка.",
  "illegal.range": "Слишком далеко.",
  "log.run": "{unit} бежит и стреляет",
  "log.warcry": "{unit} издаёт боевой клич",
  "log.covering": "{unit} ведёт огонь прикрытия по {target}",
  "illegal.uses": "В этой миссии использований не осталось.",
  "illegal.flank": "Нужна открытая или фланкированная цель, или скрытность.",
}

export const DICTIONARIES: Record<Lang, Record<Key, string>> = { en, ru }

const STORAGE = "tacticular.lang"

/** The language the player reads, with its strings. */
export class Locale {
  lang: Lang = "en"

  /** The remembered language, else the browser's, else English. */
  static detect(store: Pick<Storage, "getItem"> | undefined, languages: readonly string[]): Lang {
    let saved: string | null = null
    try {
      saved = store?.getItem(STORAGE) ?? null
    } catch {
      saved = null
    }
    if (saved === "en" || saved === "ru") return saved
    return languages.some((l) => l.toLowerCase().startsWith("ru")) ? "ru" : "en"
  }

  use(lang: Lang): void {
    this.lang = lang
  }

  /** Keeps the language in storage for the next visit. */
  remember(store: Pick<Storage, "setItem"> | undefined): void {
    try {
      store?.setItem(STORAGE, this.lang)
    } catch {
      return
    }
  }

  /** A translated string with {name} params filled in. */
  t(key: string, params: Record<string, string | number | boolean> = {}): string {
    const text = (DICTIONARIES[this.lang] as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
  }
}

/** The locale of the page. */
export const locale = new Locale()

/** A string of the page's locale. */
export const t = (key: string, params: Record<string, string | number | boolean> = {}): string => locale.t(key, params)
