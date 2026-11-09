// Lesson: Skill Invocation and Routing (phase 13 / lesson 25)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/25-skill-invocation-and-routing/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/25-skill-invocation-and-routing/code/main.ts

export {};

class PyFloat {
  constructor(readonly value: number) {}
}

type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };

function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mantissa, expPart] = x.toExponential().split("e");
  const exp = Number(expPart);
  const negative = mantissa.startsWith("-");
  const digits = mantissa.replace("-", "").replace(".", "");
  let body: string;
  if (exp >= -4 && exp < 16) {
    if (exp < 0) body = "0." + "0".repeat(-exp - 1) + digits;
    else if (digits.length <= exp + 1) body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
    else body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  } else {
    const mant = digits.length > 1 ? digits[0] + "." + digits.slice(1) : digits;
    body = mant + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  }
  return (negative ? "-" : "") + body;
}

function pyRound(x: number, ndigits: number): number {
  const exact = Math.abs(x).toFixed(100);
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + ndigits);
  const isTie = tail[0] === "5" && /^0*$/.test(tail.slice(1));
  if (!isTie) return Number(x.toFixed(ndigits));
  const scaled = Math.trunc(Math.abs(x) * 10 ** ndigits);
  const even = scaled % 2 === 0 ? scaled : scaled + 1;
  return (x < 0 ? -even : even) / 10 ** ndigits;
}

function dumpString(s: string, ensureAscii: boolean): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20 || (ensureAscii && code > 0x7e)) {
      for (let i = 0; i < ch.length; i++) out += "\\u" + ch.charCodeAt(i).toString(16).padStart(4, "0");
    } else out += ch;
  }
  return out + '"';
}

interface DumpOptions {
  indent?: number;
  sortKeys?: boolean;
  separators?: [string, string];
  ensureAscii?: boolean;
}

function jsonDumps(value: Json, opts: DumpOptions = {}): string {
  const indent = opts.indent;
  const ensureAscii = opts.ensureAscii ?? true;
  const [itemSep, keySep] = opts.separators ?? (indent === undefined ? [", ", ": "] : [",", ": "]);
  const walk = (v: Json, level: number): string => {
    if (v === null) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return dumpString(v, ensureAscii);
    if (v instanceof PyFloat) return pyFloatRepr(v.value);
    const isArray = Array.isArray(v);
    let items: string[];
    if (isArray) {
      items = v.map((x) => walk(x, level + 1));
    } else {
      let keys = Object.keys(v);
      if (opts.sortKeys) keys = keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      items = keys.map((k) => dumpString(k, ensureAscii) + keySep + walk(v[k], level + 1));
    }
    const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
    if (items.length === 0) return open + close;
    if (indent === undefined) return open + items.join(itemSep) + close;
    const pad = "\n" + " ".repeat(indent * (level + 1));
    return open + pad + items.join(itemSep + pad) + "\n" + " ".repeat(indent * level) + close;
  };
  return walk(value, 0);
}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out + quote;
}

class Actor {
  static readonly HUMAN = new Actor("human");
  static readonly MODEL = new Actor("model");
  static readonly AGENT = new Actor("agent");
  static readonly APPLICATION = new Actor("application");
  static readonly SKILL = new Actor("skill");
  static readonly HARNESS = new Actor("harness");

  private constructor(readonly value: string) {}
}

function pyTypeName(value: unknown): string {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (Array.isArray(value)) return "list";
  if (typeof value === "object" && value !== null) {
    const name = (value as object).constructor?.name;
    return !name || name === "Object" ? "dict" : name;
  }
  return typeof value;
}

function actorLabel(actor: unknown): string {
  const value = actor instanceof Actor ? actor.value : actor;
  if (typeof value === "string" && value) return value;
  if (value === null || value === undefined) return "unknown";
  return pyTypeName(value);
}

interface SkillMetadata {
  name: string;
  description: string;
  runtime_extensions: { [key: string]: unknown };
}

function skillMetadata(name: string, description: string, runtimeExtensions: { [key: string]: unknown } = {}): SkillMetadata {
  return { name, description, runtime_extensions: runtimeExtensions };
}

interface InvocationPolicy {
  allow_human: boolean;
  allow_model: boolean;
  allow_agent: boolean;
  allow_programmatic: boolean;
  allow_application: boolean;
  allow_skill: boolean;
  model_threshold: number;
  harness_allowlist: string[];
  application_allowlist: string[];
  skill_caller_allowlist: string[];
  max_skill_depth: number;
}

function invocationPolicy(overrides: Partial<InvocationPolicy> = {}): InvocationPolicy {
  const policy: InvocationPolicy = {
    allow_human: true,
    allow_model: true,
    allow_agent: true,
    allow_programmatic: true,
    allow_application: true,
    allow_skill: false,
    model_threshold: 0.2,
    harness_allowlist: [],
    application_allowlist: [],
    skill_caller_allowlist: [],
    max_skill_depth: 1,
    ...overrides,
  };
  const boolFields = [
    "allow_human",
    "allow_model",
    "allow_agent",
    "allow_programmatic",
    "allow_application",
    "allow_skill",
  ] as const;
  for (const fieldName of boolFields) {
    if (typeof policy[fieldName] !== "boolean") throw new TypeError(`${fieldName} must be a boolean`);
  }
  if (
    typeof policy.model_threshold !== "number" ||
    !Number.isFinite(policy.model_threshold) ||
    !(policy.model_threshold >= 0.0 && policy.model_threshold <= 1.0)
  ) {
    throw new RangeError("model_threshold must be a finite number from 0 to 1");
  }
  const listFields = ["harness_allowlist", "application_allowlist", "skill_caller_allowlist"] as const;
  for (const fieldName of listFields) {
    const value: unknown = policy[fieldName];
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item)) {
      throw new TypeError(`${fieldName} must be a tuple of non-empty names`);
    }
  }
  if (!Number.isInteger(policy.max_skill_depth) || policy.max_skill_depth < 1) {
    throw new RangeError("max_skill_depth must be a positive integer");
  }
  return Object.freeze(policy);
}

interface InvocationRequest {
  actor: unknown;
  query: string;
  explicit_name: string | null;
  caller_name: string | null;
  depth: number;
}

function invocationRequest(
  actor: unknown,
  query: string,
  options: { explicit_name?: string | null; caller_name?: string | null; depth?: number } = {},
): InvocationRequest {
  return {
    actor,
    query,
    explicit_name: options.explicit_name ?? null,
    caller_name: options.caller_name ?? null,
    depth: options.depth ?? 0,
  };
}

class InvocationDecision {
  constructor(
    readonly activated: boolean,
    readonly actor: Actor | string,
    readonly skill_name: string | null,
    readonly mode: string,
    readonly score: number,
    readonly reason: string,
  ) {}

  toDict(): Json {
    return {
      activated: this.activated,
      actor: this.actor instanceof Actor ? this.actor.value : this.actor,
      skill_name: this.skill_name,
      mode: this.mode,
      score: new PyFloat(this.score),
      reason: this.reason,
    };
  }
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function relevanceScore(query: string, skill: SkillMetadata): number {
  const queryTokens = tokens(query);
  const skillTokens = tokens(`${skill.name} ${skill.description}`);
  if (queryTokens.size === 0 || skillTokens.size === 0) return 0.0;
  const intersection = [...queryTokens].filter((t) => skillTokens.has(t)).length;
  const union = new Set([...queryTokens, ...skillTokens]).size;
  return intersection / union;
}

class CorePolicyAdapter {
  constructor(readonly policy: InvocationPolicy) {}

  allows(skill: SkillMetadata, actor: unknown, request: InvocationRequest | null = null): [boolean, string] {
    if (actor === Actor.HUMAN) return [this.policy.allow_human, "human activation policy"];
    if (actor === Actor.MODEL) return [this.policy.allow_model, "model activation policy"];
    if (actor === Actor.AGENT) return [this.policy.allow_agent, "agent activation policy"];
    if (actor === Actor.APPLICATION) {
      const allowed = this.policy.allow_application && this.policy.application_allowlist.includes(skill.name);
      return [allowed, "application activation policy and target allowlist"];
    }
    if (actor === Actor.SKILL) {
      if (!this.policy.allow_skill) return [false, "skill composition policy"];
      if (request === null || !request.caller_name) return [false, "skill composition requires a caller identity"];
      if (request.caller_name === skill.name) return [false, "direct skill self-cycle"];
      if (!this.policy.skill_caller_allowlist.includes(request.caller_name)) return [false, "skill caller allowlist"];
      if (request.depth < 1 || request.depth > this.policy.max_skill_depth) return [false, "skill composition depth limit"];
      return [true, "skill caller allowlist and depth policy"];
    }
    if (actor === Actor.HARNESS) {
      const allowed = this.policy.allow_programmatic && this.policy.harness_allowlist.includes(skill.name);
      return [allowed, "programmatic activation policy and allowlist"];
    }
    return [false, `unknown actor ${pyStr(actorLabel(actor))} has no activation policy`];
  }
}

function extensionFalse(value: unknown): boolean {
  return value === false || (typeof value === "string" && value.toLowerCase() === "false");
}

function extensionTrue(value: unknown): boolean {
  return value === true || (typeof value === "string" && value.toLowerCase() === "true");
}

class ExtensionPolicyAdapter extends CorePolicyAdapter {
  allows(skill: SkillMetadata, actor: unknown, request: InvocationRequest | null = null): [boolean, string] {
    const [allowed, reason] = super.allows(skill, actor, request);
    if (!allowed) return [allowed, reason];
    const fields = skill.runtime_extensions;
    if (actor === Actor.HUMAN && extensionFalse(fields["user-invocable"])) {
      return [false, "host extension user-invocable=false"];
    }
    if ((actor === Actor.MODEL || actor === Actor.AGENT) && extensionTrue(fields["disable-model-invocation"])) {
      return [false, "host extension disable-model-invocation=true"];
    }
    return [true, reason];
  }
}

function buildInvocationMatrix(policy: InvocationPolicy | null = null): Json[] {
  const active = policy === null ? null : [policy.allow_human, policy.allow_model];
  const rows: Json[] = [];
  const combos: [boolean, boolean, string][] = [
    [false, false, "programmatic-only or unavailable"],
    [true, false, "explicit human activation only"],
    [false, true, "implicit model activation only"],
    [true, true, "human and model activation"],
  ];
  for (const [human, model, meaning] of combos) {
    rows.push({
      human,
      model,
      meaning,
      active_policy: active !== null && active[0] === human && active[1] === model,
    });
  }
  return rows;
}

function routeRequest(skills: Iterable<SkillMetadata>, request: InvocationRequest, adapter: CorePolicyAdapter): InvocationDecision {
  if (!(request.actor instanceof Actor)) {
    const actor = actorLabel(request.actor);
    return new InvocationDecision(false, actor, null, "unsupported-actor", 0.0, `unknown actor ${pyStr(actor)} has no activation policy`);
  }
  const requestActor = request.actor;
  const candidates = [...skills].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const explicitModes: Map<Actor, string> = new Map([
    [Actor.HUMAN, "explicit-human"],
    [Actor.APPLICATION, "programmatic-application"],
    [Actor.SKILL, "composed-skill"],
    [Actor.HARNESS, "programmatic-harness"],
  ]);
  const explicitMode = explicitModes.get(requestActor);
  if (explicitMode !== undefined) {
    const mode = explicitMode;
    if (!request.explicit_name) {
      return new InvocationDecision(false, requestActor, null, mode, 0.0, "an exact skill name is required");
    }
    const selected = candidates.find((skill) => skill.name === request.explicit_name);
    if (selected === undefined) {
      return new InvocationDecision(false, requestActor, null, mode, 0.0, "named skill was not discovered");
    }
    const [allowed, reason] = adapter.allows(selected, requestActor, request);
    return new InvocationDecision(allowed, requestActor, selected.name, mode, 1.0, allowed ? reason : `blocked by ${reason}`);
  }

  const mode = requestActor === Actor.MODEL ? "implicit-model" : "implicit-agent";
  if (request.explicit_name) {
    return new InvocationDecision(
      false,
      requestActor,
      null,
      mode,
      0.0,
      "implicit model or agent routing uses task relevance rather than an exact-name channel",
    );
  }
  if (candidates.length === 0) return new InvocationDecision(false, requestActor, null, mode, 0.0, "catalog is empty");

  const eligible: [SkillMetadata, string][] = [];
  const blockedReasons: string[] = [];
  for (const skill of candidates) {
    const [allowed, reason] = adapter.allows(skill, requestActor, request);
    if (allowed) eligible.push([skill, reason]);
    else blockedReasons.push(reason);
  }
  if (eligible.length === 0) {
    let reason = "no discovered skill is eligible for implicit routing";
    if (blockedReasons.length > 0) {
      const unique = [...new Set(blockedReasons)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      reason = `${reason}: ${unique.join("; ")}`;
    }
    return new InvocationDecision(false, requestActor, null, mode, 0.0, reason);
  }

  const scored: [number, SkillMetadata, string][] = eligible.map(([skill, reason]) => [
    relevanceScore(request.query, skill),
    skill,
    reason,
  ]);
  let best = scored[0];
  for (const item of scored.slice(1)) {
    if (item[0] > best[0] || (item[0] === best[0] && item[1].name > best[1].name)) best = item;
  }
  const [score, selected, eligibilityReason] = best;
  if (score < adapter.policy.model_threshold) {
    return new InvocationDecision(
      false,
      requestActor,
      selected.name,
      mode,
      pyRound(score, 4),
      "best match did not meet the host threshold",
    );
  }
  return new InvocationDecision(true, requestActor, selected.name, mode, pyRound(score, 4), eligibilityReason);
}

function demo(): void {
  const skills = [
    skillMetadata("incident-triage", "Triage an incident timeline and separate evidence from hypotheses."),
    skillMetadata("release-notes", "Draft release notes from merged pull request summaries.", {
      "user-invocable": true,
      "disable-model-invocation": true,
    }),
    skillMetadata("release-readiness", "Review merged pull request summaries and report release readiness."),
  ];
  const policy = invocationPolicy({
    model_threshold: 0.15,
    harness_allowlist: ["incident-triage"],
    application_allowlist: ["release-notes"],
    allow_skill: true,
    skill_caller_allowlist: ["release-readiness"],
    max_skill_depth: 2,
  });
  const core = new CorePolicyAdapter(policy);
  const extensions = new ExtensionPolicyAdapter(policy);
  const requests = [
    invocationRequest(Actor.HUMAN, "", { explicit_name: "release-notes" }),
    invocationRequest(Actor.MODEL, "triage this incident timeline evidence"),
    invocationRequest(Actor.HARNESS, "nightly evaluation", { explicit_name: "incident-triage" }),
    invocationRequest(Actor.MODEL, "draft release notes from merged pull requests"),
    invocationRequest(Actor.AGENT, "triage this incident timeline evidence"),
    invocationRequest(Actor.APPLICATION, "", { explicit_name: "release-notes" }),
    invocationRequest(Actor.SKILL, "review incident dependency", {
      explicit_name: "incident-triage",
      caller_name: "release-readiness",
      depth: 1,
    }),
  ];
  const result: Json = {
    human_model_matrix: buildInvocationMatrix(policy),
    core_decisions: requests.map((request) => routeRequest(skills, request, core).toDict()),
    extension_adapter_decisions: requests.map((request) => routeRequest(skills, request, extensions).toDict()),
  };
  console.log(jsonDumps(result, { indent: 2, sortKeys: true }));
}

demo();
