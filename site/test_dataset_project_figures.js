"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { spawnSync } = require("node:child_process");

const source = fs.readFileSync(path.join(__dirname, "figures/projects/dataset-split-auditor.js"), "utf8");
const solution = path.join(__dirname, "../projects/dataset-split-auditor/solution/main.py");

function registry(crypto = webcrypto) {
  const figures = new Map();
  vm.runInNewContext(source, {
    window: { crypto, AIFSProjectFigures: { register: (id, config) => figures.set(id, config) } },
    TextEncoder,
  });
  return figures;
}
const figures = registry();
function lab(stage) { return figures.get("pj-dataset-split-auditor-" + stage).lab; }
function inputs(stage, override = {}) {
  return { ...Object.fromEntries(lab(stage).controls.map(control => [control.key, control.value])), ...override };
}
async function calculate(stage, override = {}) {
  return JSON.parse(JSON.stringify(await lab(stage).calculate(inputs(stage, override))));
}
const receipt = result => result.frames.at(-1).receipt;

function python(payload) {
  const program = [
    "import importlib.util, json, sys, unicodedata",
    "spec = importlib.util.spec_from_file_location('solution', sys.argv[1])",
    "solution = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(solution)",
    "request = json.load(sys.stdin)",
    "op = request['op']",
    "if op == 'folding_characters':",
    " result = ''.join(chr(i) for i in range(0x110000) if chr(i).casefold() != chr(i))",
    "elif op == 'fingerprints':",
    " result = []",
    " for raw in request['texts']:",
    "  nfkc = unicodedata.normalize('NFKC', raw)",
    "  folded = nfkc.casefold()",
    "  normalized = ' '.join(folded.split())",
    "  result.append(dict(raw=raw, nfkc=nfkc, folded=folded, normalized=normalized, fingerprint=solution.fingerprint(raw), utf8=normalized.encode().hex(' ')))",
    "else:",
    " result = getattr(solution, op)(**request['args'])",
    "print(json.dumps(result))",
  ].join("\n");
  const result = spawnSync(process.env.PYTHON || "python3", ["-c", program, solution], {
    input: JSON.stringify(payload), encoding: "utf8", maxBuffer: 2 ** 22,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function auditRows(values) {
  return {
    train: [{ id: values.trainId, group: values.trainGroup, text: values.trainText }],
    test: [{ id: values.testId, group: values.testGroup, text: values.testText }],
  };
}
function reportRows(values) {
  const rows = (partition, size, group, text) => Array.from({ length: size }, (_, index) => ({ id: partition + "-" + (index + 1), group, text }));
  return {
    train: rows("train", values.trainRows, values.trainGroup, values.trainText),
    test: rows("test", values.testRows, values.testGroup, values.testText),
  };
}
function validateFrames(result) {
  assert.ok(result.frames.length >= 4);
  for (const frame of result.frames) {
    assert.ok(frame.label && frame.explanation);
    const laneIds = frame.lanes.map(lane => lane.id);
    assert.equal(new Set(laneIds).size, laneIds.length);
    const itemIds = frame.lanes.flatMap(lane => lane.items.map(item => item.id));
    assert.equal(new Set(itemIds).size, itemIds.length);
    for (const link of frame.links || []) {
      assert.ok(itemIds.includes(link.from), link.from);
      assert.ok(itemIds.includes(link.to), link.to);
    }
  }
  assert.ok(result.frames.slice(0, -1).every(frame => !frame.receipt));
}

test("all four registered figures expose different questions, controls and causal traces", async () => {
  assert.equal(figures.size, 4);
  const results = await Promise.all([1, 2, 3, 4].map(stage => calculate(stage)));
  assert.equal(new Set([1, 2, 3, 4].map(stage => lab(stage).question)).size, 4);
  assert.equal(new Set(results.map(result => result.frames.map(frame => frame.label).join("|"))).size, 4);
  results.forEach(validateFrames);
});

test("normalization, casefold, whitespace, UTF-8 and real fingerprints match Python", async () => {
  const texts = [
    "  Straße\t", "STRASSE", "ΟΣ", "ος", "σςΣ", "Ａ  ﬃ", "a ffi",
    "\u001cA\u0085B\u001f", "\ufeff A \ufeff", "\u00a0A\u202fB\u3000",
    "İ i\u0307 ẞ", "Ꭰꭰ", "𐐀𐐨", "ᾈ ῼ ͅ", "A\r\n B", "",
  ];
  const expected = python({ op: "fingerprints", texts });
  for (let i = 0; i < texts.length; i += 2) {
    const actual = receipt(await calculate(1, { textA: texts[i], textB: texts[i + 1] })).records;
    for (let j = 0; j < 2; j += 1) {
      const { id, text, ...stages } = actual[j];
      assert.deepEqual(stages, expected[i + j], texts[i + j]);
      assert.equal(text, texts[i + j]);
      assert.equal(id, j === 0 ? "record-a" : "record-b");
    }
  }
});

test("the generated casefold table covers every folding character in the Python reference", async () => {
  const text = python({ op: "folding_characters" });
  const expected = python({ op: "fingerprints", texts: [text] })[0];
  const { id, text: raw, ...actual } = receipt(await calculate(1, { textA: text, textB: "" })).records[0];
  assert.equal(id, "record-a");
  assert.equal(raw, text);
  assert.deepEqual(actual, expected);
});

test("early normalization frames expose only the current transformation and retain record identities", async () => {
  const result = await calculate(1);
  assert.equal(result.frames.length, 6);
  const recordA = result.frames.map(frame => frame.lanes[0].items[0]);
  assert.ok(recordA.every(item => item.id === "record:record-a"));
  assert.equal(recordA[0].value, JSON.stringify("  Straße\t"));
  assert.equal(recordA[2].value, JSON.stringify("  strasse\t"));
  assert.equal(recordA[3].value, JSON.stringify("strasse"));
  assert.equal(recordA[4].value, "73 74 72 61 73 73 65");
  assert.match(recordA[5].value, /^[a-f0-9]{64}$/);
  assert.ok(result.frames.slice(0, 5).every(frame => !frame.metrics && !frame.receipt));
});

test("missing Web Crypto and invalid UTF-8 fail explicitly instead of fabricating a fingerprint", async () => {
  const unavailable = registry(null).get("pj-dataset-split-auditor-1").lab;
  await assert.rejects(unavailable.calculate(inputs(1)), /SHA-256 requires Web Crypto/);
  await assert.rejects(lab(1).calculate(inputs(1, { textA: "\ud800" })), /unpaired surrogate/);
});

test("content-only, group-only, both and clean audits match Python with inspectable record links", async () => {
  for (const scenario of lab(2).scenarios.filter(scenario => scenario.label !== "Duplicate ID")) {
    const values = inputs(2, scenario.values);
    const result = await calculate(2, scenario.values);
    assert.deepEqual(receipt(result).audit, python({ op: "audit", args: auditRows(values) }), scenario.label);
    validateFrames(result);
    for (const link of result.frames.at(-1).links) {
      assert.equal(link.from, "record:train-a");
      assert.equal(link.to, "record:test-b");
    }
    for (const entry of receipt(result).content_evidence.concat(receipt(result).group_evidence)) {
      assert.deepEqual(entry.train_ids, ["train-a"]);
      assert.deepEqual(entry.test_ids, ["test-b"]);
    }
  }
});

test("group equality preserves original case and whitespace", async () => {
  for (const testGroup of ["INCIDENT-A", " incident-A ", "incident-A"]) {
    const values = inputs(2, { testGroup, testText: "Unrelated content" });
    assert.deepEqual(receipt(await calculate(2, values)).audit, python({ op: "audit", args: auditRows(values) }));
  }
});

test("duplicate or incomplete record identities block the audit before hashing", async () => {
  let hashCalls = 0;
  const local = registry({ subtle: { digest() { hashCalls += 1; throw new Error("unexpected hash"); } } });
  const calculator = local.get("pj-dataset-split-auditor-2").lab.calculate;
  await assert.rejects(calculator(inputs(2, { testId: "train-a" })), /Duplicate record id "train-a"/);
  for (const field of ["trainId", "testId", "trainText", "testText", "trainGroup", "testGroup"]) {
    await assert.rejects(calculator(inputs(2, { [field]: "" })), /nonempty id, group and text/);
  }
  assert.equal(hashCalls, 0);
});

test("the default group trace uses exact seed-NUL-group hashes and produces nine test rows", async () => {
  const result = await calculate(3), actual = receipt(result);
  assert.deepEqual(actual.groups.map(group => group.bucket), [0.48402656740828626, 0.9990270651949033]);
  assert.deepEqual(actual.groups.map(group => group.hash_input), ["course\u0000incident-A", "course\u0000incident-B"]);
  assert.equal(actual.train.length, 1);
  assert.equal(actual.test.length, 9);
  assert.equal(actual.observed_test_fraction, 0.9);
  assert.deepEqual(actual.groups.map(group => group.partition), ["test", "train"]);
  const rows = result.frames[0].lanes[0].items.map(item => ({
    id: item.label, group: item.label.startsWith("A-") ? "incident-A" : "incident-B", text: JSON.parse(item.value),
  }));
  const expected = python({ op: "split_groups", args: { records: rows, test_fraction: actual.test_fraction, seed: actual.seed } });
  assert.deepEqual({ train: actual.train, test: actual.test }, expected);
  assert.deepEqual(result.frames.at(-1).bars.map(bar => bar.value), [50, 90]);
  for (const group of actual.groups) {
    const { createHash } = require("node:crypto");
    assert.equal(group.sha256, createHash("sha256").update(group.hash_input).digest("hex"));
  }
  validateFrames(result);
  const moveA = result.frames.find(frame => frame.label === "Move incident-A");
  assert.equal(moveA.lanes.find(lane => lane.id === "test").items[0].id, "group:incident-A");
  assert.match(moveA.lanes.find(lane => lane.id === "test").items[0].detail, /A-01, A-02.*A-09/);
  assert.equal(moveA.lanes.find(lane => lane.id === "pending").items[0].id, "group:incident-B");
});

test("seed changes, reordered rows, and threshold boundaries agree with the Python split", async () => {
  const firstBucket = 0.48402656740828626;
  for (const override of [
    { seed: "experiment-1" }, { reverseRows: true }, { seed: "" }, { seed: "Straße\u0000course" },
    { testFraction: firstBucket }, { testFraction: firstBucket + Number.EPSILON },
    { testFraction: firstBucket - Number.EPSILON }, { testFraction: 0.01 }, { testFraction: 0.99 },
  ]) {
    const result = await calculate(3, override), actual = receipt(result);
    const rows = result.frames[0].lanes[0].items.map(item => ({
      id: item.label, group: item.label.startsWith("A-") ? "incident-A" : "incident-B", text: JSON.parse(item.value),
    }));
    assert.deepEqual({ train: actual.train, test: actual.test }, python({
      op: "split_groups", args: { records: rows, seed: actual.seed, test_fraction: actual.test_fraction },
    }), JSON.stringify(override));
  }
  const ordinary = receipt(await calculate(3)), reversed = receipt(await calculate(3, { reverseRows: true }));
  assert.deepEqual(reversed.test.map(row => row.id), ordinary.test.map(row => row.id).reverse());
  const empty = receipt(await calculate(3, { seed: "experiment-1" }));
  assert.equal(empty.test.length, 0);
  assert.equal(empty.train.length, 10);
});

test("changing group size preserves buckets, and zero records never invent a group", async () => {
  const defaultResult = receipt(await calculate(3));
  const balanced = receipt(await calculate(3, { groupASize: 5, groupBSize: 5 }));
  assert.deepEqual(balanced.groups.map(group => group.bucket), defaultResult.groups.map(group => group.bucket));
  assert.equal(balanced.observed_test_fraction, 0.5);
  for (const [a, b] of [[0, 0], [0, 1], [9, 0]]) {
    const result = await calculate(3, { groupASize: a, groupBSize: b }), actual = receipt(result);
    assert.equal(actual.train.length + actual.test.length, a + b);
    assert.equal(actual.groups.length, Number(a > 0) + Number(b > 0));
    validateFrames(result);
    if (a + b === 0) {
      assert.equal(actual.observed_test_fraction, null);
      assert.ok(result.frames.every(frame => frame.lanes.every(lane => lane.items.length === 0)));
      assert.equal(result.frames.at(-1).bars.length, 1);
    }
  }
  for (const testFraction of [0, 1, -1, NaN, Infinity]) {
    await assert.rejects(lab(3).calculate(inputs(3, { testFraction })), /strictly between zero and one/);
  }
  for (const groupASize of [-1, 0.5, 13, NaN]) {
    await assert.rejects(lab(3).calculate(inputs(3, { groupASize })), /whole numbers/);
  }
});

test("all report presets exactly match Python summarize and derive evidence from visible rows", async () => {
  for (const scenario of lab(4).scenarios) {
    const values = inputs(4, scenario.values), result = await calculate(4, scenario.values);
    const actual = receipt(result);
    assert.deepEqual(actual, python({ op: "summarize", args: reportRows(values) }), scenario.label);
    const visible = result.frames[0].lanes;
    assert.equal(visible[0].items.length, actual.train_rows);
    assert.equal(visible[1].items.length, actual.test_rows);
    const checks = result.frames.at(-1).lanes[0].items;
    assert.equal(checks.every(check => check.value), actual.usable);
    validateFrames(result);
  }
});

test("empty partitions cannot contribute phantom rows, groups, fingerprints or leakage", async () => {
  for (const override of [
    { testRows: 0, testGroup: "incident-A", testText: "Rollout completed" },
    { trainRows: 0, testRows: 0, trainGroup: "", testGroup: "", trainText: "", testText: "" },
    { trainRows: 0, testRows: 3 },
  ]) {
    const values = inputs(4, override), result = await calculate(4, override), actual = receipt(result);
    assert.deepEqual(actual, python({ op: "summarize", args: reportRows(values) }));
    assert.equal(actual.usable, false);
    assert.equal(actual.audit.clean, true);
    assert.deepEqual(result.frames[2].links, []);
    assert.deepEqual(result.frames[2].rows, []);
    assert.equal(actual.train_groups, values.trainRows ? 1 : 0);
    assert.equal(actual.test_groups, values.testRows ? 1 : 0);
  }
});
