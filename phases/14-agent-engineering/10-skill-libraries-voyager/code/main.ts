// Lesson: Skill Libraries and Lifelong Learning (Voyager) (phase 14 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/10-skill-libraries-voyager/docs/en.md
// Run: npx tsx phases/14-agent-engineering/10-skill-libraries-voyager/code/main.ts

export {};

class RuntimeError extends Error {
  name = "RuntimeError";
}

interface Context {
  log?: string[];
  failed?: boolean;
  resources?: Record<string, number>;
  has_table?: boolean;
  inventory?: string[];
}

type SkillFn = (context: Context) => string;

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  return quote + s.split("\\").join("\\\\").split(quote).join("\\" + quote) + quote;
}

function tupleRepr(items: string[]): string {
  if (items.length === 1) return `(${pyStr(items[0])},)`;
  return "(" + items.map(pyStr).join(", ") + ")";
}

function pyOpt(v: unknown): string {
  if (v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (Array.isArray(v)) return "[" + v.map((x) => pyStr(String(x))).join(", ") + "]";
  return String(v);
}

function pySplit(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length > 0);
}

interface Skill {
  name: string;
  description: string;
  code: string;
  fn: SkillFn;
  version: number;
  tags: string[];
  dependsOn: string[];
  history: string[];
}

function makeSkill(s: { name: string; description: string; code: string; fn: SkillFn; tags?: string[]; dependsOn?: string[] }): Skill {
  return { version: 1, tags: [], dependsOn: [], history: [], ...s };
}

class SkillLibrary {
  private skills = new Map<string, Skill>();

  register(skill: Skill, dedup = true): string {
    const existing = this.skills.get(skill.name);
    if (dedup && existing !== undefined) {
      existing.history.push(existing.code);
      existing.code = skill.code;
      existing.fn = skill.fn;
      existing.description = skill.description;
      existing.tags = skill.tags;
      existing.dependsOn = skill.dependsOn;
      existing.version += 1;
      return `refined ${skill.name} -> v${existing.version}`;
    }
    this.skills.set(skill.name, skill);
    return `registered ${skill.name} v${skill.version}`;
  }

  search(query: string, topK = 3, tagFilter: string | null = null): Array<[number, Skill]> {
    const qTokens = new Set(pySplit(query.toLowerCase()));
    const scored: Array<[number, Skill]> = [];
    for (const skill of this.skills.values()) {
      if (tagFilter && !skill.tags.includes(tagFilter)) continue;
      const dTokens = new Set(pySplit(skill.description.toLowerCase()));
      if (dTokens.size === 0) continue;
      let overlap = 0;
      for (const t of qTokens) if (dTokens.has(t)) overlap += 1;
      if (overlap === 0) continue;
      const score = overlap / new Set([...qTokens, ...dTokens]).size;
      scored.push([score, skill]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, topK);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  topoOrder(name: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const stack: Array<[string, boolean]> = [[name, false]];
    while (stack.length > 0) {
      const [node, processed] = stack.pop() as [string, boolean];
      if (processed) {
        order.push(node);
        continue;
      }
      if (visited.has(node)) continue;
      visited.add(node);
      stack.push([node, true]);
      const skill = this.skills.get(node);
      if (skill === undefined) continue;
      for (const dep of skill.dependsOn) if (!visited.has(dep)) stack.push([dep, false]);
    }
    return order;
  }

  execute(name: string, context: Context = {}): Context {
    if (context.log === undefined) context.log = [];
    const log = context.log;
    for (const skillName of this.topoOrder(name)) {
      const skill = this.skills.get(skillName);
      if (skill === undefined) {
        log.push(`missing skill: ${skillName}`);
        context.failed = true;
        return context;
      }
      try {
        const result = skill.fn(context);
        log.push(`ran ${skill.name} v${skill.version}: ${result}`);
      } catch (e) {
        const err = e as Error;
        log.push(`error in ${skill.name} v${skill.version}: ${err.name}: ${err.message}`);
        context.failed = true;
        return context;
      }
    }
    context.failed = false;
    return context;
  }

  listNames(): string[] {
    return [...this.skills.keys()].sort();
  }
}

function mine(context: Context): string {
  const res = (context.resources = context.resources ?? {});
  res.ore = (res.ore ?? 0) + 3;
  return "+3 ore";
}

function placeTable(context: Context): string {
  context.has_table = true;
  return "placed crafting table";
}

function craftIronPickV1(context: Context): string {
  if (!context.has_table) throw new RuntimeError("no crafting table in context, cannot craft");
  const ore = context.resources?.ore ?? 0;
  const stick = context.resources?.stick ?? 0;
  if (ore < 3) throw new RuntimeError(`need 3 ore, have ${ore}`);
  if (stick < 2) throw new RuntimeError(`need 2 stick, have ${stick}`);
  const res = context.resources as Record<string, number>;
  res.ore -= 3;
  res.stick -= 2;
  context.inventory = context.inventory ?? [];
  context.inventory.push("iron_pickaxe");
  return "crafted iron_pickaxe";
}

function craftIronPickV2(context: Context): string {
  if (!context.has_table) return "skipped craft: no table yet";
  const ore = context.resources?.ore ?? 0;
  const stick = context.resources?.stick ?? 0;
  if (ore < 3 || stick < 2) return `skipped craft: ore=${ore}, stick=${stick}`;
  const res = context.resources as Record<string, number>;
  res.ore -= 3;
  res.stick -= 2;
  context.inventory = context.inventory ?? [];
  context.inventory.push("iron_pickaxe");
  return "crafted iron_pickaxe";
}

function gatherSticks(context: Context): string {
  const res = (context.resources = context.resources ?? {});
  res.stick = (res.stick ?? 0) + 2;
  return "+2 stick";
}

function main(): void {
  console.log("=".repeat(70));
  console.log("VOYAGER SKILL LIBRARY: Phase 14, Lesson 10");
  console.log("=".repeat(70));

  const lib = new SkillLibrary();

  console.log("\nphase 1: register primitive skills");
  console.log(
    "  " +
      lib.register(
        makeSkill({
          name: "mine_ore",
          description: "mine iron ore from nearby rock formations",
          code: "mine(3)",
          fn: mine,
          tags: ["gather", "ore"],
        }),
      ),
  );
  console.log(
    "  " +
      lib.register(
        makeSkill({
          name: "place_crafting_table",
          description: "place a crafting table at current position",
          code: "place_table()",
          fn: placeTable,
          tags: ["setup", "crafting"],
        }),
      ),
  );
  console.log(
    "  " +
      lib.register(
        makeSkill({
          name: "gather_sticks",
          description: "gather sticks from tree or broken planks",
          code: "gather(2, stick)",
          fn: gatherSticks,
          tags: ["gather", "stick"],
        }),
      ),
  );

  console.log("\nphase 2: compose a higher-order skill (v1)");
  console.log(
    "  " +
      lib.register(
        makeSkill({
          name: "craft_iron_pickaxe",
          description: "craft an iron pickaxe using ore and a crafting table",
          code: "mine_ore(); place_table(); craft('iron_pickaxe')",
          fn: craftIronPickV1,
          dependsOn: ["mine_ore", "place_crafting_table"],
          tags: ["craft", "tool"],
        }),
      ),
  );

  console.log("\nphase 3: retrieval on 'I need a pickaxe'");
  for (const [score, skill] of lib.search("I need a pickaxe")) {
    console.log(`  ${score.toFixed(3)}  ${skill.name} v${skill.version}: ${skill.description}`);
  }

  console.log("\nphase 4: execute craft_iron_pickaxe (expect failure: missing sticks)");
  let context = lib.execute("craft_iron_pickaxe");
  for (const line of context.log ?? []) console.log(`  ${line}`);
  console.log(`  failed: ${pyOpt(context.failed)}`);

  console.log("\nphase 5: iterative refinement: rewrite as v2 with stick deps");
  console.log(
    "  " +
      lib.register(
        makeSkill({
          name: "craft_iron_pickaxe",
          description: "craft an iron pickaxe using ore, sticks, and a crafting table",
          code: "mine_ore(); gather_sticks(); place_table(); craft('iron_pickaxe')",
          fn: craftIronPickV2,
          dependsOn: ["mine_ore", "gather_sticks", "place_crafting_table"],
          tags: ["craft", "tool"],
        }),
      ),
  );

  console.log("\nphase 6: re-execute (expect success)");
  context = lib.execute("craft_iron_pickaxe");
  for (const line of context.log ?? []) console.log(`  ${line}`);
  console.log(`  inventory: ${pyOpt(context.inventory)}`);
  console.log(`  failed: ${pyOpt(context.failed)}`);

  console.log("\nlibrary state");
  for (const name of lib.listNames()) {
    const skill = lib.get(name);
    if (skill === undefined) throw new Error("AssertionError");
    console.log(`  ${name} v${skill.version}  deps=${tupleRepr(skill.dependsOn)}  tags=${tupleRepr(skill.tags)}`);
  }

  console.log();
  console.log("pattern: retrieve composable skills, execute, fold feedback into v2.");
  console.log("same loop powers Claude Agent SDK skills and the skillkit registry.");
}

main();
