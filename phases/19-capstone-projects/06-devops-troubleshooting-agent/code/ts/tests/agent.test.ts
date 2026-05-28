import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockAgent } from "../src/agent.js";

describe("mockAgent", () => {
  it("memory alert に対して OOM hypothesis を rank する", () => {
    const report = mockAgent("OOMKilled payments-api");
    assert.equal(report.topHypotheses.length, 2);
    const ranks = report.topHypotheses.map((h) => h.rank);
    assert.deepEqual(ranks, [1, 2]);
    const first = report.topHypotheses[0];
    assert.ok(first);
    assert.match(first.summary, /OOMKilled/);
  });

  it("restart alert に対して crashloop hypothesis を rank する", () => {
    const report = mockAgent("auth-svc CrashLoopBackOff");
    assert.equal(report.topHypotheses.length, 1);
    const first = report.topHypotheses[0];
    assert.ok(first);
    assert.match(first.summary, /CrashLoopBackOff/);
  });

  it("unknown alert では low-signal hypothesis に fallback する", () => {
    const report = mockAgent("some-unknown-alert");
    assert.equal(report.topHypotheses.length, 1);
    const first = report.topHypotheses[0];
    assert.ok(first);
    assert.match(first.summary, /telemetry/);
  });

  it("call ごとに unique incident id を生成する", () => {
    const a = mockAgent("OOMKilled");
    const b = mockAgent("OOMKilled");
    assert.ok(a.incidentId.startsWith("inc-"));
    assert.ok(b.incidentId.startsWith("inc-"));
    assert.notEqual(a.incidentId, b.incidentId);
  });
});
