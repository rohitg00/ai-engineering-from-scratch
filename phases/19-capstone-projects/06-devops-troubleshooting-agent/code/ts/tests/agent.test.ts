import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mockAgent } from "../src/agent.js";

describe("mockAgent", () => {
  it("ranks OOM hypotheses for memory alerts", () => {
    const report = mockAgent("OOMKilled payments-api");
    assert.equal(report.topHypotheses.length, 2);
    const ranks = report.topHypotheses.map((h) => h.rank);
    assert.deepEqual(ranks, [1, 2]);
    const first = report.topHypotheses[0];
    assert.ok(first);
    assert.match(first.summary, /OOMKilled/);
  });

  it("ranks crashloop hypotheses for restart alerts", () => {
    const report = mockAgent("auth-svc CrashLoopBackOff");
    assert.equal(report.topHypotheses.length, 1);
    const first = report.topHypotheses[0];
    assert.ok(first);
    assert.match(first.summary, /CrashLoopBackOff/);
  });

  it("falls back to a low-signal hypothesis for unknown alerts", () => {
    const report = mockAgent("some-unknown-alert");
    assert.equal(report.topHypotheses.length, 1);
    const first = report.topHypotheses[0];
    assert.ok(first);
    assert.match(first.summary, /telemetry/);
  });

  it("produces a unique incident id per call", () => {
    const a = mockAgent("OOMKilled");
    const b = mockAgent("OOMKilled");
    assert.ok(a.incidentId.startsWith("inc-"));
    assert.ok(b.incidentId.startsWith("inc-"));
    assert.notEqual(a.incidentId, b.incidentId);
  });
});
