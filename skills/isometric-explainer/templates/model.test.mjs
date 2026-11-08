import assert from "node:assert/strict";
import test from "node:test";
import * as M from "./model.mjs";

const types = (run) => run.events.map((event) => event.type).join(" ");

test("with the cache on, the repeat request is a hit", () => {
  const run = M.simulate();
  assert.equal(types(run), "intake lookup fetch store exit intake lookup fetch store exit intake lookup exit");
  assert.deepEqual(run.totals, { steps: 13, hits: 1, fetches: 2, clock: run.events.at(-1).clock });
  assert.equal(run.events.at(-1).source, "cache");
});

test("with the cache off, every request goes to the origin", () => {
  const run = M.simulate({ cache: false });
  assert.equal(run.totals.hits, 0);
  assert.equal(run.totals.fetches, M.REQUESTS.length);
  assert.ok(run.totals.clock > M.simulate().totals.clock);
});

test("every run is deterministic and its clock never goes back", () => {
  for (const cache of [true, false]) {
    const run = M.simulate({ cache });
    assert.deepEqual(M.simulate({ cache }), run);
    assert.ok(run.events.every((event, i) => event.index === i && typeof event.trace === "string"));
    assert.ok(run.events.every((event, i) => i === 0 || event.clock >= run.events[i - 1].clock));
  }
});

test("the share URL round-trips every setting", () => {
  assert.equal(M.encode(M.DEFAULTS), "");
  assert.deepEqual(M.decode("?" + M.encode({ cache: false })), { cache: false });
  assert.deepEqual(M.decode("?cache=nonsense"), M.DEFAULTS);
});
