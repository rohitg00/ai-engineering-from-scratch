// Lesson: Evidence, Confidence, and Unknowns in Binary Analysis (phase 13 / lesson 35)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/main.ts
import { createHash } from "node:crypto";
import { accessSync, constants, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { constants as osConstants, machine, tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type J = any;
type Obj = Record<string, J>;

export const HERE = realpathSync(__dirname);
export const FIXTURES = join(HERE, "fixtures");
export const OBJECT_PATH = join(FIXTURES, "ledger-x86_64-O1.o");
export const SOURCE_PATH = join(FIXTURES, "ledger.c");
export const HARNESS_PATH = join(FIXTURES, "harness.c");
export const REA_EVIDENCE_FILES = ["rea-evidence-percent-change.json", "rea-evidence-grade.json"];
export const REA_SNAPSHOT_PATH = join(FIXTURES, "rea-snapshot.json");
export const RUN_EVIDENCE_PATH = join(FIXTURES, "run-evidence.json");

export const CONFIDENCES = ["observed", "derived", "inferred"];
export const AUTHORITIES = [
  "shipped-artifact",
  "controlled-replay",
  "historical-reference",
  "external-service",
  "analyst-inference",
];
export const ISOLATIONS = ["none", "process", "container", "virtual-machine"];
export const LOCATION_KINDS = ["address", "address-range", "artifact-path", "file-offset", "file-offset-range"];
export const UNKNOWN_STATUSES = ["open", "investigating", "blocked", "contradicted", "resolved"];
export const SEVERITIES = ["low", "medium", "high", "critical"];
export const DISPOSITIONS = ["verified", "withdrawn", "out-of-scope"];
export const CLAIM_STATUSES = ["pass", "fail", "unsupported", "unknown"];
const EVIDENCE_ID_RE = /^ev_[0-9a-f]{64}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const RECORD_KEYS = new Set([
  "evidence_id",
  "subject",
  "provider",
  "analysis_profile",
  "predicate_type",
  "operation",
  "parameters",
  "raw_result",
  "normalized_result",
  "confidence",
  "authority",
  "environment",
  "limitations",
  "locations",
  "evidence_links",
]);
export const NO_SUBJECT_LIMITATION = "The subject artifact is unknown for this observation.";
export const REPLAY_LIMITATION = "Loaded from a local snapshot; this call did not re-run the provider.";
export const MUTATION_LIMITATION = "A registry mutation records what the analyst decided. It is not proof of the answer.";
export const HOST_BUILD_LIMITATION =
  "The run executed a host build of ledger.c, not the x86-64 object. " +
  "The claim about the object rests on the shared source and on the compiler.";
export const ONE_INPUT_LIMITATION = "One run observes one input. It proves nothing about other inputs.";
export const CACHE_FORMAT_VERSION = "course-answer-cache-1";
export const CACHE_ENTRY_CEILING = 1000;
export const REGISTRY_PROVIDER = { id: "course-unknown-registry", name: "course unknown registry", version: "1" };
export const ELF_READER_PROVIDER = { id: "course-elf-reader", name: "lesson 35 ELF reader", version: "1" };
export const SOURCE_READER_PROVIDER = { id: "course-source-reader", name: "lesson 35 source reader", version: "1" };
export const MODEL_PROVIDER = { id: "course-byte-model", name: "lesson 35 byte pattern model", version: "1" };
export const PREDICTION_PROVIDER = { id: "course-analyst", name: "lesson 35 analyst prediction", version: "1" };
export const PREDICTION_LIMITATION = "A prediction is the analyst's reading of derived facts. It records an expectation, not a behaviour.";
const SHT_RELA = 4;
const STT_FUNC = 2;
const R_X86_64_PC32 = 2;

export class EvidenceError extends Error {}

export class EvidenceIntegrityError extends EvidenceError {}

export class ClaimError extends EvidenceError {}

export class CacheError extends EvidenceError {}

function isObj(value: J): value is Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pyStr(value: string): string {
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of value) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

export function pyRepr(value: J): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return pyStr(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(value).map(([k, v]) => `${pyStr(k)}: ${pyRepr(v)}`).join(", ") + "}";
}

function tupleRepr(items: string[]): string {
  return "(" + items.map(pyStr).join(", ") + ")";
}

export function deepEqual(a: J, b: J): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (Array.isArray(b)) return false;
  if (typeof a === "object") {
    if (typeof b !== "object") return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return a === b;
}

function sortedUnique(items: string[]): string[] {
  return [...new Set(items)].sort();
}

function sortKeys(value: J): J {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isObj(value)) {
    const out: Obj = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

function asciiEscape(text: string): string {
  return text.replace(/[\u007f-\uffff]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

export function pyDumpsIndent(value: J, sort = false): string {
  return asciiEscape(JSON.stringify(sort ? sortKeys(value) : value, null, 2));
}

export function checkJsonValue(value: J, path = "$"): void {
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new EvidenceError(`${path}: floats are not allowed in ledger records`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (isObj(value)) {
    for (const [key, item] of Object.entries(value)) checkJsonValue(item, `${path}.${key}`);
    return;
  }
  throw new EvidenceError(`${path}: ${typeof value} is not a JSON value`);
}

export function canonicalJson(value: J): string {
  checkJsonValue(value);
  return JSON.stringify(sortKeys(value));
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(typeof data === "string" ? Buffer.from(data, "utf-8") : data).digest("hex");
}

export function digestCanonical(value: J): string {
  return sha256Hex(canonicalJson(value));
}

export function profileDigest(provider: Obj, parameters: Obj): string {
  return digestCanonical({ provider, parameters });
}

export function makeProfile(provider: Obj, parameters: Obj): Obj {
  return { provider, parameters, digest: profileDigest(provider, parameters) };
}

export function semanticProjection(record: Obj): Obj {
  const subject = record.subject;
  const projection: Obj = {
    subject:
      subject === null
        ? null
        : {
            digest: subject.digest,
            format: subject.format,
            architecture: subject.architecture,
          },
    provider: record.provider,
    analysis_profile: record.analysis_profile,
    predicate_type: record.predicate_type,
    operation: record.operation,
    parameters: record.parameters,
    raw_result: record.raw_result,
    normalized_result: record.normalized_result,
    confidence: record.confidence,
    authority: record.authority,
    environment: record.environment,
    limitations: record.limitations,
  };
  if (record.relationship_coverage !== undefined && record.relationship_coverage !== null) {
    projection.relationship_coverage = record.relationship_coverage;
  }
  projection.locations = record.locations;
  projection.evidence_links = record.evidence_links;
  return projection;
}

export function computeEvidenceId(record: Obj): string {
  return "ev_" + digestCanonical(semanticProjection(record));
}

export function subjectForFile(path: string, fmt: string, architecture: string | null): Obj {
  return {
    name: basename(path),
    digest: { sha256: sha256Hex(readFileSync(path)) },
    format: fmt,
    architecture,
    local_path: path,
  };
}

export interface EvidenceOptions {
  operation: string;
  parameters: Obj;
  normalized_result: J;
  confidence?: string;
  authority?: string;
  limitations?: string[];
  locations?: Obj[];
  evidence_links?: string[];
  analysis_profile?: Obj | null;
  raw_result?: J;
  environment?: Obj | null;
  predicate_type?: string;
}

export function createEvidence(subject: Obj | null, provider: Obj, options: EvidenceOptions): Obj {
  const limits = [...(options.limitations ?? [])];
  if (subject === null && !limits.includes(NO_SUBJECT_LIMITATION)) limits.push(NO_SUBJECT_LIMITATION);
  const record: Obj = {
    subject,
    provider,
    analysis_profile: options.analysis_profile ?? null,
    predicate_type: options.predicate_type ?? "rea.analysis",
    operation: options.operation,
    parameters: options.parameters,
    raw_result: options.raw_result ?? null,
    normalized_result: options.normalized_result,
    confidence: options.confidence ?? "observed",
    authority: options.authority ?? "shipped-artifact",
    environment: options.environment ?? null,
    limitations: limits,
    locations: [...(options.locations ?? [])],
    evidence_links: sortedUnique(options.evidence_links ?? []),
  };
  record.evidence_id = computeEvidenceId(record);
  return validateEvidence(record);
}

function require_(condition: boolean, message: string): void {
  if (!condition) throw new EvidenceError(message);
}

function keySetIs(value: Obj, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

export function validateSubject(subject: J): void {
  if (subject === null) return;
  require_(isObj(subject), "subject must be an object or null");
  require_(keySetIs(subject, ["name", "digest", "format", "architecture", "local_path"]), "subject has wrong keys");
  require_(typeof subject.name === "string" && subject.name !== "", "subject.name must be non-empty");
  const digest = subject.digest;
  require_(isObj(digest) && keySetIs(digest, ["sha256"]), "subject.digest must hold sha256");
  require_(typeof digest.sha256 === "string" && SHA256_RE.test(digest.sha256), "subject sha256 malformed");
  require_(typeof subject.format === "string" && subject.format !== "", "subject.format must be non-empty");
  require_(subject.architecture === null || typeof subject.architecture === "string", "subject.architecture malformed");
  require_(typeof subject.local_path === "string", "subject.local_path must be a string");
}

export function validateProvider(provider: J, where: string): void {
  require_(isObj(provider) && keySetIs(provider, ["id", "name", "version"]), `${where} must hold id, name, version`);
  require_(typeof provider.id === "string" && provider.id !== "", `${where}.id must be non-empty`);
  require_(typeof provider.name === "string" && provider.name !== "", `${where}.name must be non-empty`);
  require_(provider.version === null || typeof provider.version === "string", `${where}.version malformed`);
}

export function validateEvidence(record: J): Obj {
  require_(isObj(record), "evidence must be an object");
  const keys = new Set(Object.keys(record));
  const plain = keys.size === RECORD_KEYS.size && [...RECORD_KEYS].every((key) => keys.has(key));
  const withCoverage =
    keys.size === RECORD_KEYS.size + 1 && keys.has("relationship_coverage") && [...RECORD_KEYS].every((key) => keys.has(key));
  const diff = [...keys].filter((key) => !RECORD_KEYS.has(key)).concat([...RECORD_KEYS].filter((key) => !keys.has(key))).sort();
  require_(plain || withCoverage, `evidence keys mismatch: ${pyRepr(diff)}`);
  checkJsonValue(record);
  validateSubject(record.subject);
  validateProvider(record.provider, "provider");
  const profile = record.analysis_profile;
  if (profile !== null) {
    require_(isObj(profile) && keySetIs(profile, ["provider", "parameters", "digest"]), "analysis_profile has wrong keys");
    validateProvider(profile.provider, "analysis_profile.provider");
    require_(
      typeof profile.provider.version === "string" && profile.provider.version !== "",
      "analysis_profile.provider.version must be non-empty",
    );
    if (!deepEqual(profile.provider, record.provider)) {
      throw new EvidenceIntegrityError("Analysis profile provider does not match Evidence provider");
    }
    if (profile.digest !== profileDigest(profile.provider, profile.parameters)) {
      throw new EvidenceIntegrityError("Analysis profile digest does not match its parameters");
    }
  }
  require_(typeof record.predicate_type === "string" && record.predicate_type !== "", "predicate_type must be non-empty");
  require_(typeof record.operation === "string" && record.operation !== "", "operation must be non-empty");
  require_(isObj(record.parameters), "parameters must be an object");
  require_(CONFIDENCES.includes(record.confidence), `confidence must be one of ${tupleRepr(CONFIDENCES)}`);
  require_(AUTHORITIES.includes(record.authority), `authority must be one of ${tupleRepr(AUTHORITIES)}`);
  const environment = record.environment;
  if (environment !== null) {
    require_(isObj(environment) && keySetIs(environment, ["id", "platform", "architecture", "isolation"]), "environment has wrong keys");
    require_(ISOLATIONS.includes(environment.isolation), `environment.isolation must be one of ${tupleRepr(ISOLATIONS)}`);
  }
  require_(
    Array.isArray(record.limitations) && record.limitations.every((item: J) => typeof item === "string" && item !== ""),
    "limitations must be non-empty strings",
  );
  require_(Array.isArray(record.locations), "locations must be a list");
  for (const location of record.locations) {
    require_(isObj(location) && LOCATION_KINDS.includes(location.kind), `location kind must be one of ${tupleRepr(LOCATION_KINDS)}`);
  }
  const links = record.evidence_links;
  require_(
    Array.isArray(links) && links.every((item: J) => typeof item === "string" && EVIDENCE_ID_RE.test(item)),
    "evidence_links must be ev_ ids",
  );
  if (record.evidence_id !== computeEvidenceId(record)) {
    throw new EvidenceIntegrityError("Evidence semantic identifier does not match its record");
  }
  return record;
}

export function rebindSubjectPath(record: Obj, path: string, sha256: string, fmt: string, architecture: string | null): Obj {
  const subject = record.subject;
  if (subject === null) return record;
  if (subject.digest.sha256 !== sha256 || subject.format !== fmt || subject.architecture !== architecture) {
    throw new EvidenceIntegrityError("Cannot rebind evidence to a target with a different identity");
  }
  const rebound: Obj = { ...record };
  rebound.subject = { ...subject, name: basename(path) || "artifact", local_path: path };
  return validateEvidence(rebound);
}

export function loadEvidenceFile(path: string): Obj {
  return validateEvidence(JSON.parse(readFileSync(path, "utf-8")));
}

export function unknownIdFor(question: string, domain: string, scopeDigest: string | null): string {
  return (
    "unk_" +
    digestCanonical({
      domain: domain.trim(),
      question: question.split(/\s+/).filter((part) => part !== "").join(" "),
      scope_digest: scopeDigest,
    })
  );
}

export function revisionDigest(revision: Obj): string {
  const semantic: Obj = {};
  for (const [key, value] of Object.entries(revision)) if (key !== "revision_digest") semantic[key] = value;
  return digestCanonical(semantic);
}

export function validateUnknown(revision: J): Obj {
  require_(isObj(revision), "unknown must be an object");
  checkJsonValue(revision);
  for (const key of [
    "unknown_id",
    "revision",
    "previous_revision_digest",
    "revision_digest",
    "scope_digest",
    "question",
    "status",
    "severity",
    "domain",
    "supporting_evidence_ids",
    "contradicting_evidence_ids",
    "required_authority",
    "required_confidence",
    "required_environment",
    "recommended_probes",
    "resolution",
    "mutation_evidence_ids",
  ]) {
    require_(key in revision, `unknown is missing ${key}`);
  }
  require_(typeof revision.question === "string" && revision.question.trim() !== "", "question must be non-empty");
  require_(UNKNOWN_STATUSES.includes(revision.status), `status must be one of ${tupleRepr(UNKNOWN_STATUSES)}`);
  require_(SEVERITIES.includes(revision.severity), `severity must be one of ${tupleRepr(SEVERITIES)}`);
  require_(CONFIDENCES.includes(revision.required_confidence), "required_confidence malformed");
  require_(revision.required_authority === null || AUTHORITIES.includes(revision.required_authority), "required_authority malformed");
  require_(Number.isInteger(revision.revision) && revision.revision >= 1, "revision must be a positive integer");
  const expectedId = unknownIdFor(revision.question, revision.domain, revision.scope_digest);
  if (revision.unknown_id !== expectedId) {
    throw new EvidenceIntegrityError("Residual unknown ID does not match its immutable identity");
  }
  if ((revision.revision === 1) !== (revision.previous_revision_digest === null)) {
    throw new EvidenceIntegrityError("Only the first revision has no predecessor");
  }
  if ((revision.status === "resolved") !== (revision.resolution !== null)) {
    throw new EvidenceIntegrityError("Only resolved unknowns carry a resolution");
  }
  if (revision.status === "contradicted" && revision.contradicting_evidence_ids.length === 0) {
    throw new EvidenceIntegrityError("Contradicted status requires contradicting evidence");
  }
  const contra = new Set<string>(revision.contradicting_evidence_ids);
  if (revision.supporting_evidence_ids.some((item: string) => contra.has(item))) {
    throw new EvidenceIntegrityError("Evidence cannot simultaneously support and contradict");
  }
  const resolution = revision.resolution;
  if (resolution !== null) {
    require_(DISPOSITIONS.includes(resolution.disposition), "resolution.disposition malformed");
    if (resolution.disposition === "verified") {
      require_((resolution.evidence_ids ?? []).length >= 1, "a verified resolution needs evidence ids");
    }
  }
  require_(revision.mutation_evidence_ids.length >= 1, "every revision names the mutation evidence that made it");
  if (revision.revision_digest !== revisionDigest(revision)) {
    throw new EvidenceIntegrityError("Residual unknown revision digest does not match its record");
  }
  return revision;
}

export interface OpenUnknownOptions {
  domain: string;
  scope_digest: string | null;
  severity: string;
  required_confidence?: string;
  required_authority?: string | null;
  required_environment?: Obj | null;
  recommended_probes?: Obj[];
  supporting_evidence_ids?: string[];
}

const UPDATE_ALLOWED = new Set([
  "status",
  "severity",
  "supporting_evidence_ids",
  "contradicting_evidence_ids",
  "recommended_probes",
  "resolution",
  "required_authority",
  "required_confidence",
  "required_environment",
]);

export class EvidenceLedger {
  records: Map<string, Obj> = new Map();
  unknowns: Map<string, Obj[]> = new Map();

  record(record: Obj): string {
    validateEvidence(record);
    const existing = this.records.get(record.evidence_id);
    if (existing !== undefined) {
      if (deepEqual(semanticProjection(existing), semanticProjection(record))) return "duplicate";
      throw new EvidenceIntegrityError("Conflicting evidence record");
    }
    this.records.set(record.evidence_id, record);
    return "recorded";
  }

  get(evidenceId: string): Obj {
    const found = this.records.get(evidenceId);
    if (found === undefined) throw new EvidenceError(`missing evidence ${evidenceId}`);
    return found;
  }

  find(criteria: Obj): Obj[] {
    const matches: Obj[] = [];
    for (const record of this.records.values()) {
      if (Object.entries(criteria).every(([key, value]) => deepEqual(record[key], value))) matches.push(record);
    }
    return matches.sort((a, b) => (a.evidence_id < b.evidence_id ? -1 : a.evidence_id > b.evidence_id ? 1 : 0));
  }

  danglingLinks(): string[] {
    const missing = new Set<string>();
    for (const record of this.records.values()) {
      for (const link of record.evidence_links) if (!this.records.has(link)) missing.add(link);
    }
    return [...missing].sort();
  }

  currentUnknown(unknownId: string): Obj {
    const revisions = this.unknowns.get(unknownId);
    if (revisions === undefined) throw new EvidenceError("not-found");
    return revisions[revisions.length - 1];
  }

  verifyUnknownChain(unknownId: string): number {
    const revisions = this.unknowns.get(unknownId);
    if (!revisions || revisions.length === 0) throw new EvidenceError("not-found");
    let previous: string | null = null;
    revisions.forEach((revision, i) => {
      validateUnknown(revision);
      if (revision.revision !== i + 1) throw new EvidenceIntegrityError("Revision numbers must increase by one");
      if (revision.previous_revision_digest !== previous) throw new EvidenceIntegrityError("Revision chain is broken");
      for (const mutationId of revision.mutation_evidence_ids) {
        if (!this.records.has(mutationId)) throw new EvidenceIntegrityError("Mutation evidence is missing from the ledger");
      }
      previous = revision.revision_digest;
    });
    return revisions.length;
  }

  private mutationEvidence(operation: string, parameters: Obj, result: Obj): string {
    const record = createEvidence(null, REGISTRY_PROVIDER, {
      operation,
      parameters,
      normalized_result: result,
      confidence: "derived",
      authority: "analyst-inference",
      limitations: [MUTATION_LIMITATION],
      predicate_type: "course.residual-unknown-mutation",
    });
    this.record(record);
    return record.evidence_id;
  }

  openUnknown(question: string, options: OpenUnknownOptions): Obj {
    const { domain, scope_digest: scopeDigest, severity } = options;
    const unknownId = unknownIdFor(question, domain, scopeDigest);
    if (this.unknowns.has(unknownId)) throw new EvidenceError("already-exists");
    const supporting = options.supporting_evidence_ids ?? [];
    for (const evidenceId of supporting) this.get(evidenceId);
    const parameters = { question, domain, scope_digest: scopeDigest, severity };
    const mutationId = this.mutationEvidence("record_unknown", parameters, { unknown_id: unknownId, revision: 1, status: "open" });
    const revision: Obj = {
      unknown_id: unknownId,
      revision: 1,
      previous_revision_digest: null,
      scope_digest: scopeDigest,
      question,
      status: "open",
      severity,
      domain,
      supporting_evidence_ids: sortedUnique(supporting),
      contradicting_evidence_ids: [],
      required_authority: options.required_authority ?? null,
      required_confidence: options.required_confidence ?? "observed",
      required_environment: options.required_environment ?? null,
      recommended_probes: [...(options.recommended_probes ?? [])],
      resolution: null,
      mutation_evidence_ids: [mutationId],
    };
    revision.revision_digest = revisionDigest(revision);
    validateUnknown(revision);
    this.unknowns.set(unknownId, [revision]);
    return revision;
  }

  updateUnknown(unknownId: string, expectedRevision: number, changes: Obj): Obj {
    const current = this.currentUnknown(unknownId);
    if (current.revision !== expectedRevision) throw new EvidenceError("revision-conflict");
    const unexpected = Object.keys(changes).filter((key) => !UPDATE_ALLOWED.has(key)).sort();
    if (unexpected.length > 0) throw new EvidenceError(`cannot change ${pyRepr(unexpected)}`);
    for (const key of ["supporting_evidence_ids", "contradicting_evidence_ids"]) {
      for (const evidenceId of changes[key] ?? []) this.get(evidenceId);
    }
    const resolution = changes.resolution;
    if (resolution !== undefined && resolution !== null && resolution.disposition === "verified") {
      this.checkVerifyingEvidence(current, resolution.evidence_ids ?? []);
    }
    const mutationId = this.mutationEvidence(
      "update_unknown",
      { unknown_id: unknownId, expected_revision: expectedRevision, changes },
      { unknown_id: unknownId, revision: expectedRevision + 1, status: changes.status ?? current.status },
    );
    const revision: Obj = { ...current, ...changes };
    for (const key of ["supporting_evidence_ids", "contradicting_evidence_ids"]) {
      if (key in changes) revision[key] = sortedUnique(changes[key]);
    }
    revision.revision = expectedRevision + 1;
    revision.previous_revision_digest = current.revision_digest;
    revision.mutation_evidence_ids = [mutationId];
    revision.revision_digest = revisionDigest(revision);
    validateUnknown(revision);
    this.unknowns.get(unknownId)!.push(revision);
    return revision;
  }

  private checkVerifyingEvidence(unknown: Obj, evidenceIds: string[]): void {
    if (evidenceIds.length === 0) throw new EvidenceError("a verified resolution needs at least one observed evidence id");
    for (const evidenceId of evidenceIds) {
      const record = this.get(evidenceId);
      if (record.confidence !== unknown.required_confidence) {
        throw new EvidenceError(`${evidenceId} is ${record.confidence}; the unknown requires ${unknown.required_confidence} evidence`);
      }
      if (unknown.required_authority !== null && record.authority !== unknown.required_authority) {
        throw new EvidenceError(`${evidenceId} has authority ${record.authority}; the unknown requires ${unknown.required_authority}`);
      }
    }
  }

  resolveUnknown(unknownId: string, expectedRevision: number, evidenceIds: string[], rationale: string): Obj {
    return this.updateUnknown(unknownId, expectedRevision, {
      status: "resolved",
      supporting_evidence_ids: sortedUnique([...this.currentUnknown(unknownId).supporting_evidence_ids, ...evidenceIds]),
      resolution: { disposition: "verified", rationale, evidence_ids: sortedUnique(evidenceIds) },
    });
  }

  exportBundle(): Obj {
    const artifacts = new Map<string, Obj>();
    const providers = new Map<string, Obj>();
    const environments = new Map<string, Obj>();
    for (const record of this.records.values()) {
      const subject = record.subject;
      if (subject !== null) {
        artifacts.set(subject.digest.sha256, {
          digest: subject.digest,
          format: subject.format,
          architecture: subject.architecture,
        });
      }
      providers.set(canonicalJson(record.provider), record.provider);
      if (record.environment !== null) environments.set(canonicalJson(record.environment), record.environment);
    }
    const unknowns: Obj[] = [];
    for (const revisions of this.unknowns.values()) unknowns.push(...revisions);
    const byKey = (map: Map<string, Obj>) => [...map.keys()].sort().map((key) => map.get(key)!);
    return {
      artifacts: byKey(artifacts),
      providers: byKey(providers),
      environments: byKey(environments),
      scenarios: [],
      captures: [],
      unknowns: unknowns.sort((a, b) =>
        a.unknown_id < b.unknown_id ? -1 : a.unknown_id > b.unknown_id ? 1 : a.revision - b.revision,
      ),
      records: [...this.records.keys()].sort().map((key) => this.records.get(key)!),
    };
  }

  importBundle(bundle: J): Obj {
    require_(isObj(bundle) && Array.isArray(bundle.records), "bundle must hold a records list");
    const stagedRecords = new Map<string, Obj>();
    for (const record of bundle.records) {
      validateEvidence(record);
      const existing = this.records.get(record.evidence_id) ?? stagedRecords.get(record.evidence_id);
      if (existing !== undefined && !deepEqual(semanticProjection(existing), semanticProjection(record))) {
        throw new EvidenceIntegrityError("Conflicting evidence record");
      }
      stagedRecords.set(record.evidence_id, record);
    }
    const stagedUnknowns = new Map<string, Obj[]>();
    for (const revision of bundle.unknowns ?? []) {
      validateUnknown(revision);
      if (!stagedUnknowns.has(revision.unknown_id)) stagedUnknowns.set(revision.unknown_id, []);
      stagedUnknowns.get(revision.unknown_id)!.push(revision);
    }
    for (const [unknownId, revisions] of stagedUnknowns) {
      revisions.sort((a, b) => a.revision - b.revision);
      const mine = this.unknowns.get(unknownId);
      if (mine !== undefined && !deepEqual(mine, revisions.slice(0, mine.length))) {
        throw new EvidenceIntegrityError("Conflicting unknown revision");
      }
      let previous: string | null = null;
      revisions.forEach((revision, i) => {
        if (revision.revision !== i + 1 || revision.previous_revision_digest !== previous) {
          throw new EvidenceIntegrityError("Revision chain is broken");
        }
        previous = revision.revision_digest;
      });
    }
    let added = 0;
    for (const [evidenceId, record] of stagedRecords) {
      if (!this.records.has(evidenceId)) {
        this.records.set(evidenceId, record);
        added += 1;
      }
    }
    for (const [unknownId, revisions] of stagedUnknowns) this.unknowns.set(unknownId, revisions);
    return { records: added, duplicates: stagedRecords.size - added, unknowns: stagedUnknowns.size };
  }
}

export type Case = [J[], J];

export class Claim {
  constructor(
    public claim_id: string,
    public text: string,
    public fn: string,
    public cases: Case[],
    public basis: string[] = [],
    public prediction_id: string | null = null,
  ) {}
}

export function recordPrediction(ledger: EvidenceLedger, claim: Claim, subject: Obj): Obj {
  const record = createEvidence(subject, PREDICTION_PROVIDER, {
    operation: "predict_result",
    parameters: { function: claim.fn, cases: claim.cases.map(([args, expected]) => ({ args, expected })) },
    normalized_result: { claim_id: claim.claim_id, text: claim.text },
    confidence: "inferred",
    authority: "analyst-inference",
    evidence_links: claim.basis,
    limitations: [PREDICTION_LIMITATION],
  });
  ledger.record(record);
  claim.prediction_id = record.evidence_id;
  return record;
}

export function runRecordsFor(ledger: EvidenceLedger, fn: string, args: J[]): Obj[] {
  const matches: Obj[] = [];
  for (const record of ledger.find({ operation: "execute_function" })) {
    const parameters = record.parameters;
    if (parameters.function === fn && deepEqual(parameters.args, args)) matches.push(record);
  }
  return matches;
}

export function promoteClaim(ledger: EvidenceLedger, claim: Claim, evidenceIds: string[]): Obj {
  if (evidenceIds.length === 0) throw new ClaimError(`${claim.claim_id}: an inferred claim needs observed evidence; none was given`);
  const covered = new Set<number>();
  for (const evidenceId of evidenceIds) {
    const record = ledger.get(evidenceId);
    if (record.confidence !== "observed") {
      throw new ClaimError(`${claim.claim_id}: ${evidenceId} is ${record.confidence}; only observed evidence can promote an inferred claim`);
    }
    if (record.operation !== "execute_function") throw new ClaimError(`${claim.claim_id}: ${evidenceId} does not record a run`);
    const parameters = record.parameters;
    let hit = false;
    claim.cases.forEach(([args, expected], index) => {
      if (parameters.function === claim.fn && deepEqual(parameters.args, args)) {
        hit = true;
        if (!deepEqual(record.normalized_result.result, expected)) {
          throw new ClaimError(
            `${claim.claim_id}: ${evidenceId} observed ${pyRepr(record.normalized_result.result)}, the claim says ${pyRepr(expected)}`,
          );
        }
        covered.add(index);
      }
    });
    if (!hit) throw new ClaimError(`${claim.claim_id}: ${evidenceId} does not state this claim`);
  }
  if (covered.size !== claim.cases.length) {
    throw new ClaimError(`${claim.claim_id}: ${covered.size} of ${claim.cases.length} inputs have observed runs`);
  }
  const limitations = sortedUnique(evidenceIds.flatMap((evidenceId) => ledger.get(evidenceId).limitations));
  return { claim_id: claim.claim_id, status: "pass", evidence_ids: sortedUnique(evidenceIds), limitations };
}

export function checkClaim(ledger: EvidenceLedger, claim: Claim): Obj {
  const supporting: string[] = [];
  const contradicting: string[] = [];
  let covered = 0;
  for (const [args, expected] of claim.cases) {
    const records = runRecordsFor(ledger, claim.fn, args);
    const agree = records.filter((record) => deepEqual(record.normalized_result.result, expected)).map((record) => record.evidence_id);
    const disagree = records.filter((record) => !deepEqual(record.normalized_result.result, expected)).map((record) => record.evidence_id);
    supporting.push(...agree);
    contradicting.push(...disagree);
    if (agree.length > 0 && disagree.length === 0) covered += 1;
  }
  let status: string;
  if (contradicting.length > 0) status = "fail";
  else if (covered === claim.cases.length) status = "pass";
  else if (covered === 0) status = "unsupported";
  else status = "unknown";
  const limitations = sortedUnique([...supporting, ...contradicting].flatMap((evidenceId) => ledger.get(evidenceId).limitations));
  if (status === "pass") promoteClaim(ledger, claim, supporting);
  return {
    claim_id: claim.claim_id,
    text: claim.text,
    status,
    covered,
    total: claim.cases.length,
    evidence_ids: sortedUnique(supporting),
    contradicting_evidence_ids: sortedUnique(contradicting),
    basis: [...claim.basis],
    limitations,
  };
}

export function completionLedger(results: Obj[]): Obj {
  const records = results.map((item) => ({
    claim_id: item.claim_id,
    status: item.status,
    evidence_ids:
      item.evidence_ids.length > 0 ? item.evidence_ids : item.contradicting_evidence_ids.length > 0 ? item.contradicting_evidence_ids : item.basis,
  }));
  const summary: Obj = {};
  for (const status of CLAIM_STATUSES) summary[status] = records.filter((item) => item.status === status).length;
  summary.total = records.length;
  summary.complete = summary.pass === summary.total;
  return { ledger_id: "ecl_" + digestCanonical({ records }), records, summary };
}

export class AnswerCache {
  target: Obj;
  binding: Obj;
  entries: Map<string, Obj> = new Map();
  invalidated: string | null = null;

  constructor(target: Obj, binding: Obj) {
    require_(["sha256", "kind", "format", "architecture"].every((key) => key in target), "target needs sha256, kind, format, architecture");
    require_(keySetIs(binding, ["provider", "analysis_profile"]), "binding needs provider and analysis_profile");
    const profile = binding.analysis_profile;
    if (!deepEqual(binding.provider, profile.provider)) throw new CacheError("Snapshot binding provider does not match analysis profile");
    if (profile.digest !== profileDigest(profile.provider, profile.parameters)) {
      throw new CacheError("Analysis profile digest does not match its parameters");
    }
    this.target = target;
    this.binding = binding;
  }

  queryId(operation: string, parameters: Obj): string {
    return "query_" + digestCanonical({ target: this.target, binding: this.binding, operation, parameters });
  }

  store(operation: string, parameters: Obj, execution: Obj): string {
    if (this.entries.size >= CACHE_ENTRY_CEILING) throw new CacheError(`cache holds ${CACHE_ENTRY_CEILING} entries; refuse to grow`);
    const queryId = this.queryId(operation, parameters);
    this.entries.set(queryId, { query_id: queryId, operation, parameters, execution });
    return queryId;
  }

  lookup(operation: string, parameters: Obj): Obj | null {
    const entry = this.entries.get(this.queryId(operation, parameters));
    if (entry === undefined) return null;
    const execution = JSON.parse(JSON.stringify(entry.execution));
    execution.limitations = [...(execution.limitations ?? []), REPLAY_LIMITATION];
    return execution;
  }

  invalidate(reason: string): void {
    this.entries.clear();
    this.invalidated = reason;
  }

  exportSnapshot(): Obj {
    if (this.invalidated !== null) {
      throw new CacheError(`Analysis snapshots are unavailable because analysis metadata may have changed: ${this.invalidated}`);
    }
    return {
      format_version: CACHE_FORMAT_VERSION,
      target: this.target,
      binding: this.binding,
      entries: [...this.entries.keys()].sort().map((key) => this.entries.get(key)!),
    };
  }

  importSnapshot(snapshot: Obj): number {
    const version = snapshot.format_version;
    if (version !== undefined && version !== null && version !== CACHE_FORMAT_VERSION) {
      throw new CacheError(`format_mismatch: snapshot format ${pyRepr(version)} is not ${pyRepr(CACHE_FORMAT_VERSION)}`);
    }
    if (!deepEqual(snapshot.target, this.target)) throw new CacheError("profile_mismatch: target does not match the active binary");
    if (!deepEqual(snapshot.binding, this.binding)) {
      throw new CacheError("profile_mismatch: provider or analysis profile does not match the active binding");
    }
    const staged = new Map<string, Obj>();
    for (const entry of snapshot.entries ?? []) {
      const expected = this.queryId(entry.operation, entry.parameters);
      if (entry.query_id !== expected) throw new CacheError(`query_id does not match its entry: ${entry.query_id}`);
      staged.set(expected, { query_id: expected, operation: entry.operation, parameters: entry.parameters, execution: entry.execution });
    }
    if (this.entries.size + staged.size > CACHE_ENTRY_CEILING) throw new CacheError("import would exceed the cache ceiling");
    for (const [key, value] of staged) this.entries.set(key, value);
    return staged.size;
  }
}

export function reaSnapshotBinding(snapshot: Obj): [Obj, Obj] {
  return [snapshot.target, snapshot.binding];
}

export interface SectionHeader {
  index: number;
  name_offset: number;
  type: number;
  offset: number;
  size: number;
  link: number;
  info: number;
  entsize: number;
  name: string;
}

function u64(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64LE(offset));
}

export function readElfSections(data: Buffer): Map<string, SectionHeader> {
  require_(
    data.length >= 6 && data.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) && data[4] === 2 && data[5] === 1,
    "expected a little-endian ELF64 file",
  );
  const shoff = u64(data, 0x28);
  const shentsize = data.readUInt16LE(0x3a);
  const shnum = data.readUInt16LE(0x3c);
  const shstrndx = data.readUInt16LE(0x3e);
  const headers: SectionHeader[] = [];
  for (let index = 0; index < shnum; index++) {
    const base = shoff + index * shentsize;
    headers.push({
      index,
      name_offset: data.readUInt32LE(base),
      type: data.readUInt32LE(base + 4),
      offset: u64(data, base + 24),
      size: u64(data, base + 32),
      link: data.readUInt32LE(base + 40),
      info: data.readUInt32LE(base + 44),
      entsize: u64(data, base + 56),
      name: "",
    });
  }
  const names = headers[shstrndx];
  const sections = new Map<string, SectionHeader>();
  for (const header of headers) {
    const start = names.offset + header.name_offset;
    const end = data.indexOf(0, start);
    header.name = data.subarray(start, end).toString("latin1");
    sections.set(header.name, header);
  }
  return sections;
}

export interface ElfSymbol {
  index: number;
  name: string;
  type: number;
  section_index: number;
  value: number;
  size: number;
}

export function readElfSymbols(data: Buffer, sections: Map<string, SectionHeader>): ElfSymbol[] {
  const symtab = sections.get(".symtab")!;
  const strtab = sections.get(".strtab")!;
  const symbols: ElfSymbol[] = [];
  for (let index = 0; index < Math.floor(symtab.size / 24); index++) {
    const base = symtab.offset + index * 24;
    const nameOffset = data.readUInt32LE(base);
    const info = data[base + 4];
    const shndx = data.readUInt16LE(base + 6);
    const start = strtab.offset + nameOffset;
    const end = data.indexOf(0, start);
    symbols.push({
      index,
      name: data.subarray(start, end).toString("latin1"),
      type: info & 0xf,
      section_index: shndx,
      value: u64(data, base + 8),
      size: u64(data, base + 16),
    });
  }
  return symbols;
}

export interface Relocation {
  offset: number;
  type: number;
  symbol: number;
  addend: number;
}

export function readRelocations(data: Buffer, sections: Map<string, SectionHeader>, name: string): Relocation[] {
  const section = sections.get(name);
  if (section === undefined || section.type !== SHT_RELA) return [];
  const relocations: Relocation[] = [];
  for (let index = 0; index < Math.floor(section.size / 24); index++) {
    const base = section.offset + index * 24;
    const info = data.readBigUInt64LE(base + 8);
    relocations.push({
      offset: u64(data, base),
      type: Number(info & 0xffffffffn),
      symbol: Number(info >> 32n),
      addend: Number(data.readBigInt64LE(base + 16)),
    });
  }
  return relocations;
}

export function observeSource(path: string = SOURCE_PATH): Obj {
  const text = readFileSync(path, "utf-8");
  const functions = [...text.matchAll(/^(?:const char \*|int) (\w+)\(/gm)].map((match) => match[1]);
  const labels = [...text.matchAll(/"([A-Z])"/g)].map((match) => match[1]);
  return createEvidence(subjectForFile(path, "c-source", null), SOURCE_READER_PROVIDER, {
    operation: "read_source",
    parameters: {},
    normalized_result: { bytes: Buffer.byteLength(text, "utf-8"), functions, labels },
    limitations: ["The source is the file we wrote. It is not proof of what any compiled object does."],
  });
}

export function sectionsName(sections: Map<string, SectionHeader>, index: number): string {
  for (const [name, header] of sections) if (header.index === index) return name;
  return `section ${index}`;
}

export function observeObject(path: string = OBJECT_PATH): [Obj, Record<string, Obj>] {
  const data = readFileSync(path);
  const sections = readElfSections(data);
  const symbols = readElfSymbols(data, sections);
  const relocations = readRelocations(data, sections, ".rela.text");
  const functionSymbols = symbols.filter((symbol) => symbol.type === STT_FUNC && symbol.name);
  const subject = subjectForFile(path, "elf", "x86_64");
  const text = sections.get(".text")!;
  const sectionSummary: Obj = {};
  for (const [name, header] of sections) {
    if ([".text", ".rodata", ".rodata.str1.1", ".rela.text", ".rela.rodata"].includes(name)) {
      sectionSummary[name] = {
        offset: header.offset,
        size: header.size,
        sha256: sha256Hex(data.subarray(header.offset, header.offset + header.size)),
      };
    }
  }
  const inspection = createEvidence(subject, ELF_READER_PROVIDER, {
    operation: "inspect_object",
    parameters: {},
    normalized_result: {
      sections: sectionSummary,
      functions: functionSymbols.map((symbol) => ({ name: symbol.name, offset: symbol.value, size: symbol.size })),
      text_relocations: relocations.map((relocation) => ({
        offset: relocation.offset,
        type: relocation.type,
        symbol: symbols[relocation.symbol].name || sectionsName(sections, symbols[relocation.symbol].section_index),
        addend: relocation.addend,
      })),
    },
    locations: [{ kind: "file-offset-range", start: text.offset, end: text.offset + text.size }],
    limitations: ["Section bytes are read from the file on disk. The reader applies no relocation and runs no code."],
  });
  const functionRecords: Record<string, Obj> = {};
  for (const symbol of functionSymbols) {
    const start = text.offset + symbol.value;
    const chunk = data.subarray(start, start + symbol.size);
    functionRecords[symbol.name] = createEvidence(subject, ELF_READER_PROVIDER, {
      operation: "read_function_bytes",
      parameters: { function: symbol.name },
      normalized_result: { text_offset: symbol.value, size: symbol.size, bytes_hex: chunk.toString("hex"), sha256: sha256Hex(chunk) },
      locations: [{ kind: "file-offset-range", start, end: start + symbol.size }],
      evidence_links: [inspection.evidence_id],
      limitations: ["These are the bytes of one symbol. Instruction boundaries are not part of this observation."],
    });
  }
  return [inspection, functionRecords];
}

export function findBytePatterns(code: Buffer, patterns: Record<string, Buffer>, fn: string): Record<string, number> {
  const found: Record<string, number> = {};
  for (const [name, pattern] of Object.entries(patterns)) found[name] = code.indexOf(pattern);
  const missing = Object.entries(found)
    .filter(([, index]) => index < 0)
    .map(([name]) => name);
  if (missing.length > 0) throw new EvidenceError(`${fn} bytes lack the expected patterns: ${pyRepr(missing)}`);
  return found;
}

export function deriveGradeModel(ledger: EvidenceLedger, gradeRecord: Obj, inspection: Obj, path: string = OBJECT_PATH): Obj {
  const data = readFileSync(path);
  const code = Buffer.from(gradeRecord.normalized_result.bytes_hex, "hex");
  const patterns = {
    imul_0x66666667: Buffer.from([0x48, 0x69, 0xc0, 0x67, 0x66, 0x66, 0x66]),
    sar_34: Buffer.from([0x48, 0xc1, 0xf9, 0x22]),
    add_minus_6: Buffer.from([0x83, 0xc1, 0xfa]),
    cmp_4_ja: Buffer.from([0x83, 0xf9, 0x04, 0x77]),
  };
  const found = findBytePatterns(code, patterns, "grade");
  const sections = readElfSections(data);
  const textOffset: number = gradeRecord.normalized_result.text_offset;
  const size: number = gradeRecord.normalized_result.size;
  let tableRelocation: Obj | null = null;
  for (const relocation of inspection.normalized_result.text_relocations) {
    if (
      textOffset <= relocation.offset &&
      relocation.offset < textOffset + size &&
      relocation.type === R_X86_64_PC32 &&
      relocation.symbol === ".rodata"
    ) {
      tableRelocation = relocation;
    }
  }
  if (tableRelocation === null) throw new EvidenceError("grade has no PC32 relocation against .rodata");
  const tableOffset = tableRelocation.addend + 4;
  const rodata = sections.get(".rodata")!;
  const entries: number[] = [];
  for (let i = 0; i < 5; i++) entries.push(data.readUInt32LE(rodata.offset + tableOffset + i * 4));
  const model = {
    multiplier: "0x66666667",
    shift: 34,
    divisor: 10,
    first_case: 6,
    case_count: 5,
    table_offset_in_rodata: tableOffset,
    table: entries,
    default: 0,
    pattern_offsets: found,
  };
  const record = createEvidence(gradeRecord.subject, MODEL_PROVIDER, {
    operation: "derive_switch_model",
    parameters: { function: "grade" },
    normalized_result: model,
    confidence: "derived",
    authority: "shipped-artifact",
    evidence_links: [gradeRecord.evidence_id, inspection.evidence_id],
    limitations: [
      "The divisor 10 is a derivation from the multiplier 0x66666667 and the shift 34. The file holds no 10.",
      "The table offset adds 4 to the relocation addend because the 4-byte displacement ends the instruction.",
    ],
  });
  ledger.record(record);
  return record;
}

export function derivePercentChangeModel(ledger: EvidenceLedger, record: Obj): Obj {
  const code = Buffer.from(record.normalized_result.bytes_hex, "hex");
  const patterns = {
    test_edi_je: Buffer.from([0x85, 0xff, 0x74]),
    imul_100: Buffer.from([0x6b, 0xc6, 0x64]),
    cdq_idiv_edi: Buffer.from([0x99, 0xf7, 0xff]),
  };
  const found = findBytePatterns(code, patterns, "percent_change");
  const model = { zero_guard: true, scale: 100, division: "signed 32-bit, truncates toward zero", pattern_offsets: found };
  const derived = createEvidence(record.subject, MODEL_PROVIDER, {
    operation: "derive_arithmetic_model",
    parameters: { function: "percent_change" },
    normalized_result: model,
    confidence: "derived",
    authority: "shipped-artifact",
    evidence_links: [record.evidence_id],
    limitations: ["Byte patterns identify the instructions. The 32-bit overflow behaviour is a property of IDIV, not a value in the file."],
  });
  ledger.record(derived);
  return derived;
}

export function wrap32(value: number): number {
  return Number(BigInt.asIntN(32, BigInt(value)));
}

export function cDiv(a: number, b: number): number {
  const quotient = Math.floor(Math.abs(a) / Math.abs(b));
  return a < 0 === b < 0 ? quotient : -quotient;
}

export function predict(fn: string, args: J[], gradeModel: Obj, labels: string[]): J {
  if (fn === "percent_change") {
    const [before, after] = args;
    if (before === 0) return 0;
    return wrap32(cDiv(wrap32((after - before) * 100), before));
  }
  if (fn === "grade") {
    const index = cDiv(args[0], gradeModel.divisor) - gradeModel.first_case;
    if (index >= 0 && index < gradeModel.case_count) return gradeModel.table[index];
    return gradeModel.default;
  }
  if (fn === "total") {
    let value = 0;
    for (const item of args) value = wrap32(value + item);
    return value;
  }
  if (fn === "grade_label") return labels[predict("grade", args, gradeModel, labels)];
  throw new EvidenceError(`no model for ${fn}`);
}

export function claimSuite(gradeModelRecord: Obj, percentRecord: Obj, sourceRecord: Obj): Claim[] {
  const gradeModel = gradeModelRecord.normalized_result;
  const labels: string[] = sourceRecord.normalized_result.labels;
  const claims: Claim[] = [];

  const single = (fn: string, args: J[], basis: string[]): void => {
    const expected = predict(fn, args, gradeModel, labels);
    const rendered = args.map((item) => String(item)).join(", ");
    claims.push(new Claim(`${fn}(${rendered})`, `${fn}(${rendered}) == ${pyRepr(expected)}`, fn, [[args, expected]], basis));
  };

  for (const args of [
    [12400, 15500],
    [0, 5],
    [100, 50],
    [-7, 3],
  ]) {
    single("percent_change", args, [percentRecord.evidence_id]);
  }
  for (const score of [55, 60, 69, 70, 85, 95, 100, 105, 110, -5]) single("grade", [score], [gradeModelRecord.evidence_id]);
  single("total", [1, 2, 3], [sourceRecord.evidence_id]);
  single("total", [], [sourceRecord.evidence_id]);
  single("grade_label", [85], [sourceRecord.evidence_id, gradeModelRecord.evidence_id]);
  const range: Case[] = [];
  for (let score = 90; score < 101; score++) range.push([[score], 4]);
  claims.push(
    new Claim("grade(90..100)", "grade(score) == 4 for every score from 90 to 100", "grade", range, [gradeModelRecord.evidence_id]),
  );
  return claims;
}

export function runGrid(claims: Claim[]): [string, J[]][] {
  const grid: [string, J[]][] = [];
  for (const claim of claims) {
    if (claim.cases.length !== 1) continue;
    const args = claim.cases[0][0];
    if (!grid.some(([fn, other]) => fn === claim.fn && deepEqual(other, args))) grid.push([claim.fn, args]);
  }
  return grid;
}

function which(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(dir, name);
    try {
      accessSync(candidate, constants.X_OK);
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export function findCompiler(): string | null {
  for (const name of ["clang", "cc", "gcc"]) {
    const found = which(name);
    if (found) return found;
  }
  return null;
}

export function compilerVersion(compiler: string): string {
  const completed = spawnSync(compiler, ["--version"], { encoding: "utf-8" });
  const first = (completed.stdout || completed.stderr || "").trim().split(/\r?\n/);
  return first.length > 0 && first[0] !== "" ? first[0] : "unknown";
}

export function detectFormat(data: Buffer): string {
  const head4 = data.subarray(0, 4).toString("hex");
  if (head4 === "7f454c46") return "elf";
  if (["cffaedfe", "cefaedfe", "feedfacf", "feedface"].includes(head4)) return "mach-o";
  if (data.subarray(0, 2).toString("latin1") === "MZ") return "pe";
  return "raw-binary";
}

export function buildHarness(compiler: string, workdir: string): string {
  const binary = join(workdir, "harness");
  const completed = spawnSync(compiler, ["-O1", "-I", FIXTURES, "-o", binary, HARNESS_PATH], { encoding: "utf-8" });
  if (completed.status !== 0) throw new Error(`Command '${compiler}' returned non-zero exit status ${completed.status}.`);
  return binary;
}

export function parseOutput(text: string): J {
  const stripped = text.trim();
  if (/^[+-]?\d+$/.test(stripped)) return Number.parseInt(stripped, 10);
  return stripped;
}

export function observeRuns(compiler: string, grid: [string, J[]][], sourceRecord: Obj): Obj[] {
  const records: Obj[] = [];
  const temp = mkdtempSync(join(tmpdir(), "tmp"));
  try {
    const binary = buildHarness(compiler, temp);
    const subject = subjectForFile(binary, detectFormat(readFileSync(binary)), machine());
    const environment = { id: "host-process", platform: process.platform, architecture: machine(), isolation: "process" };
    const provider = { id: "course-harness", name: "host compiler build of harness.c", version: compilerVersion(compiler) };
    for (const [fn, args] of grid) {
      const completed = spawnSync(binary, [fn, ...args.map((item) => String(item))], { encoding: "utf-8" });
      records.push(
        createEvidence(subject, provider, {
          operation: "execute_function",
          parameters: { function: fn, args },
          normalized_result: { result: parseOutput(completed.stdout), stdout: completed.stdout, exit_code: completed.status ?? (completed.signal ? -osConstants.signals[completed.signal] : -1) },
          confidence: "observed",
          authority: "controlled-replay",
          environment,
          evidence_links: [sourceRecord.evidence_id],
          limitations: [HOST_BUILD_LIMITATION, ONE_INPUT_LIMITATION],
        }),
      );
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  return records;
}

export function importReaEvidence(ledger: EvidenceLedger): Obj[] {
  const imported: Obj[] = [];
  for (const name of REA_EVIDENCE_FILES) {
    const record = loadEvidenceFile(join(FIXTURES, name));
    ledger.record(record);
    imported.push(record);
  }
  return imported;
}

export function verifyReaSnapshot(path: string = REA_SNAPSHOT_PATH): Obj {
  const snapshot = JSON.parse(readFileSync(path, "utf-8"));
  const [target, binding] = reaSnapshotBinding(snapshot);
  const cache = new AnswerCache(target, binding);
  const count = cache.importSnapshot(snapshot);
  const replay = cache.lookup("analyze_function", { procedure: "grade" });
  const staleParameters = { ...binding.analysis_profile.parameters, jump_table_evidence: "typed-case-default-blocks-v2" };
  const staleBinding = { provider: binding.provider, analysis_profile: makeProfile(binding.provider, staleParameters) };
  const staleCache = new AnswerCache(target, staleBinding);
  let refused: boolean;
  try {
    staleCache.importSnapshot(snapshot);
    refused = false;
  } catch (error) {
    if (!(error instanceof CacheError)) throw error;
    refused = true;
  }
  return {
    entries: count,
    query_ids: snapshot.entries.map((entry: Obj) => entry.query_id),
    replay_hit: replay !== null,
    replay_limitation: ((replay ?? {}).limitations ?? []).includes(REPLAY_LIMITATION),
    miss_on_other_parameters: cache.lookup("analyze_function", { procedure: "total" }) === null,
    stale_profile_refused: refused,
    bundle_records: snapshot.evidence_bundle.records.length,
  };
}

export function questionFor(claim: Claim): string {
  return `Does ${claim.text} hold when the compiled function runs?`;
}

function fileExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

export function buildLedger(liveRuns = true, recordPath: string | null = null): [EvidenceLedger, Obj] {
  const ledger = new EvidenceLedger();
  const sourceRecord = observeSource();
  ledger.record(sourceRecord);
  const [inspection, functionRecords] = observeObject();
  ledger.record(inspection);
  for (const record of Object.values(functionRecords)) ledger.record(record);
  const reaRecords = importReaEvidence(ledger);
  const snapshotReport = verifyReaSnapshot();
  const gradeModel = deriveGradeModel(ledger, functionRecords.grade, inspection);
  const percentModel = derivePercentChangeModel(ledger, functionRecords.percent_change);
  const claims = claimSuite(gradeModel, percentModel, sourceRecord);
  const scope: string = inspection.subject.digest.sha256;
  const opened: Record<string, Obj> = {};
  for (const claim of claims) {
    recordPrediction(ledger, claim, inspection.subject);
    opened[claim.claim_id] = ledger.openUnknown(questionFor(claim), {
      domain: "function-behaviour",
      scope_digest: scope,
      severity: claim.cases.length > 1 ? "low" : "medium",
      required_confidence: "observed",
      required_authority: "controlled-replay",
      recommended_probes: [{ operation: "execute_function", rationale: "Run the host build of harness.c with these arguments." }],
      supporting_evidence_ids: [...claim.basis, claim.prediction_id!],
    });
  }
  const compiler = liveRuns ? findCompiler() : null;
  let runSource = "none";
  if (compiler !== null) {
    const runs = observeRuns(compiler, runGrid(claims), sourceRecord);
    for (const record of runs) ledger.record(record);
    runSource = `live: ${compilerVersion(compiler)}`;
    if (recordPath !== null) {
      const bundleLedger = new EvidenceLedger();
      bundleLedger.record(sourceRecord);
      for (const record of runs) bundleLedger.record(record);
      writeFileSync(recordPath, pyDumpsIndent(bundleLedger.exportBundle(), true) + "\n", "utf-8");
    }
  } else if (fileExists(RUN_EVIDENCE_PATH)) {
    const counts = ledger.importBundle(JSON.parse(readFileSync(RUN_EVIDENCE_PATH, "utf-8")));
    runSource = `imported ${counts.records} recorded run records from ${basename(RUN_EVIDENCE_PATH)}`;
  }
  const results: Obj[] = [];
  for (const claim of claims) {
    const result = checkClaim(ledger, claim);
    const unknown = opened[claim.claim_id];
    if (result.status === "pass") {
      ledger.resolveUnknown(unknown.unknown_id, unknown.revision, result.evidence_ids, "Observed runs agree with the prediction on every input.");
    } else if (result.status === "fail") {
      ledger.updateUnknown(unknown.unknown_id, unknown.revision, {
        status: "contradicted",
        contradicting_evidence_ids: result.contradicting_evidence_ids,
      });
    } else if (result.status === "unknown") {
      ledger.updateUnknown(unknown.unknown_id, unknown.revision, {
        status: "investigating",
        supporting_evidence_ids: [...unknown.supporting_evidence_ids, ...result.evidence_ids],
      });
    }
    results.push(result);
  }
  const completion = completionLedger(results);
  const unknownStatus: Record<string, number> = {};
  const openQuestions: Obj[] = [];
  for (const revisions of ledger.unknowns.values()) {
    const current = revisions[revisions.length - 1];
    unknownStatus[current.status] = (unknownStatus[current.status] ?? 0) + 1;
    if (current.status !== "resolved") {
      openQuestions.push({ unknown_id: current.unknown_id, status: current.status, revision: current.revision, question: current.question });
    }
  }
  const byConfidence: Record<string, number> = {};
  for (const name of CONFIDENCES) byConfidence[name] = ledger.find({ confidence: name }).length;
  const report = {
    object_sha256: scope,
    records: ledger.records.size,
    by_confidence: byConfidence,
    rea_records_imported: reaRecords.map((record) => record.evidence_id),
    rea_snapshot: snapshotReport,
    grade_table: gradeModel.normalized_result.table,
    runs: runSource,
    claims: results.map((item) => ({ claim_id: item.claim_id, status: item.status, covered: `${item.covered}/${item.total}` })),
    completion_ledger_id: completion.ledger_id,
    complete: completion.summary.complete,
    unknowns: unknownStatus,
    open_questions: openQuestions,
    dangling_links: ledger.danglingLinks(),
  };
  return [ledger, report];
}

const USAGE = "usage: main.py [-h] [--record RECORD] [--no-run]";

function parseArgs(argv: string[]): { record: string | null; noRun: boolean } {
  let record: string | null = null;
  let noRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      console.log("");
      console.log("Companion code for docs/en.md: an evidence ledger for binary analysis. Record");
      console.log("model: rea 6.5.0 `src/domain/evidence.ts`, `src/domain/residualUnknown.ts`,");
      console.log("`src/domain/analysisSnapshot.ts` (tag rea-agents-6.5.0, commit");
      console.log("3b79af28e80785afce9f5998d8f03289402a1847). Run `python3 main.py` for the");
      console.log("finite demo or `python3 -m unittest discover -s tests`.");
      console.log("");
      console.log("options:");
      console.log("  -h, --help       show this help message and exit");
      console.log("  --record RECORD  write the host run records as an evidence bundle");
      console.log("  --no-run         skip the host compiler and import recorded runs");
      process.exit(0);
    } else if (arg === "--no-run") {
      noRun = true;
    } else if (arg === "--record" && i + 1 < argv.length) {
      record = resolve(argv[++i]);
    } else if (arg.startsWith("--record=")) {
      record = resolve(arg.slice("--record=".length));
    } else {
      console.error(USAGE);
      console.error(`main.py: error: unrecognized arguments: ${arg}`);
      process.exit(2);
    }
  }
  return { record, noRun };
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const [, report] = buildLedger(!args.noRun, args.record);
  console.log(pyDumpsIndent(report));
  return report.complete || report.runs !== "none" ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}
