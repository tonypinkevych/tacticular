import { detect, DICTIONARIES, remember, t, use } from "../src/i18n/strings";

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("strings", () => {
  test("English and Russian have the same keys", () => {
    expect(Object.keys(DICTIONARIES.ru).sort()).toEqual(Object.keys(DICTIONARIES.en).sort());
  });
  test("params are filled in the active language", () => {
    use("ru");
    expect(t("ui.round", { round: 3 })).toBe("Раунд 3");
    use("en");
    expect(t("ui.round", { round: 3 })).toBe("Round 3");
  });
  test("the language comes from storage, then the browser", () => {
    const s = store();
    expect(detect(s, ["ru-RU", "en"])).toBe("ru");
    expect(detect(s, ["de"])).toBe("en");
    remember(s, "en");
    expect(detect(s, ["ru-RU"])).toBe("en");
  });
  test("every log and illegal key the rules emit has a string", async () => {
    const files = import.meta.glob("../src/rules/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const used = new Set<string>();
    for (const text of Object.values(files)) {
      for (const m of text.matchAll(/key: "(log\.\w+)"/g)) used.add(m[1]);
      for (const m of text.matchAll(/check\([^;]*?, "([^"]+)"\);/g)) used.add(`illegal.${m[1]}`);
      for (const m of text.matchAll(/new Illegal\("([^"]+)"\)/g)) used.add(`illegal.${m[1]}`);
    }
    for (const id of ["fear", "dread", "dominate"]) used.add(`log.${id}`);
    for (const k of used) expect(DICTIONARIES.en, k).toHaveProperty([k]);
    expect(used.size).toBeGreaterThan(40);
  });
});
