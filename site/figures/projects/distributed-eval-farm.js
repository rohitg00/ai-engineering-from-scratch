(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-distributed-eval-farm-1", {
    title: "Hash case identity into one bucket",
    steps: [
      {
        label: "Read IDs",
        detail:
          "Identifiers are unique, nonempty UTF-8 strings. Prompt changes alter dataset identity but do not change the ID's bucket.",
      },
      {
        label: "Hash bytes",
        detail:
          "FNV-1a XORs each byte then multiplies modulo 2^32. The hash is independent of input arrival order.",
      },
      {
        label: "Take modulo",
        detail:
          "The shard index is hash modulo shard count. Changing shard count requires a new run.",
      },
    ],
    caption:
      "These buckets use the same FNV-1a 32 byte operations as the Go core, including UTF-8 inputs.",
    lab: {
      controls: [
        {
          key: "ids",
          label: "Comma-separated case IDs",
          type: "text",
          value: "case-a,case-b,case-c,case-d",
        },
        {
          key: "shards",
          label: "Shard count",
          type: "range",
          value: 4,
          min: 1,
          max: 8,
          step: 1,
        },
      ],
      calculate(v) {
        const ids = v.ids.split(",").map((x) => x.trim());
        if (ids.some((x) => !x) || new Set(ids).size !== ids.length)
          return {
            summary: "Reject empty or repeated identifiers",
            metrics: [{ label: "Records", value: ids.length }],
            bars: [],
          };
        const buckets = Array.from({ length: v.shards }, () => []);
        const rows = ids.map((id) => {
          let hash = 2166136261;
          for (const byte of new TextEncoder().encode(id)) {
            hash = Math.imul(hash ^ byte, 16777619) >>> 0;
          }
          const shard = hash % v.shards;
          buckets[shard].push(id);
          return [id, hash, shard];
        });
        return {
          summary: "Every case belongs to exactly one bucket",
          metrics: [
            { label: "Cases", value: ids.length },
            {
              label: "Active shards",
              value: buckets.filter((b) => b.length).length,
            },
          ],
          columns: ["Case", "32-bit hash", "Shard"],
          rows,
          bars: buckets.map((b, i) => ({
            label: "Shard " + i,
            value: b.length,
            max: ids.length,
          })),
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-distributed-eval-farm-2", {
    title: "Persist the lease before the worker starts",
    steps: [
      {
        label: "Read current owner",
        detail:
          "The coordinator reloads the shared snapshot while holding the stable ledger lock.",
      },
      {
        label: "Check expiry",
        detail:
          "An unfinished shard becomes claimable at the exact expiry boundary.",
      },
      {
        label: "Advance version",
        detail:
          "The replacement owner receives the next version, then the snapshot is saved before work begins.",
      },
    ],
    caption:
      "Old owns v1 until 110. Compute whether new can claim and which version becomes authoritative.",
    lab: {
      controls: [
        {
          key: "now",
          label: "Replacement claim time",
          type: "range",
          value: 110,
          min: 100,
          max: 125,
          step: 1,
        },
        {
          key: "ttl",
          label: "Replacement lease length",
          type: "range",
          value: 10,
          min: 1,
          max: 30,
          step: 1,
        },
        {
          key: "done",
          label: "Old already completed",
          type: "checkbox",
          value: false,
        },
      ],
      calculate(v) {
        const acquire = !v.done && v.now >= 110;
        let summary = "Old owner retains v1";
        if (v.done) summary = "Completed shard remains closed";
        else if (acquire) summary = "New owner acquires v2";
        return {
          summary: summary,
          metrics: [
            { label: "Current version", value: acquire ? 2 : 1 },
            { label: "Expiry", value: acquire ? v.now + v.ttl : 110 },
            { label: "Remaining old lease", value: Math.max(0, 110 - v.now) },
          ],
          bars: [
            { label: "Claim time", value: v.now, max: 160 },
            {
              label: "Resulting expiry",
              value: acquire ? v.now + v.ttl : 110,
              max: 160,
            },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-distributed-eval-farm-3", {
    title: "Redelivery acknowledges the same evidence",
    steps: [
      {
        label: "Check owner and version",
        detail: "An old lease cannot write even if its answer is correct.",
      },
      {
        label: "Handle receipt redelivery",
        detail:
          "An identical completed receipt is acknowledged without reopening the shard.",
      },
      {
        label: "Apply expiry to first completion",
        detail:
          "A first result must arrive before expiry; a later duplicate only acknowledges the existing result.",
      },
    ],
    caption:
      "Current owner is new at v2, expiry 120. Identity, result equality and first-completion time have separate roles.",
    lab: {
      controls: [
        {
          key: "version",
          label: "Submitted version",
          type: "number",
          value: 2,
          min: 1,
          max: 4,
          step: 1,
        },
        {
          key: "old",
          label: "Submit as old owner",
          type: "checkbox",
          value: false,
        },
        {
          key: "done",
          label: "Receipt already committed",
          type: "checkbox",
          value: true,
        },
        {
          key: "same",
          label: "Identical result bytes",
          type: "checkbox",
          value: true,
        },
        {
          key: "now",
          label: "Arrival time",
          type: "range",
          value: 125,
          min: 110,
          max: 140,
          step: 1,
        },
      ],
      calculate(v) {
        const identity = v.version === 2 && !v.old;
        const accepted = identity && (v.done ? v.same : v.now < 120);
        let summary = "Reject expired first completion";
        if (!identity) summary = "Fenced: wrong owner or version";
        else if (accepted && v.done)
          summary = "Idempotent acknowledgement; no new result";
        else if (accepted) summary = "Accept first completion";
        else if (v.done) summary = "Reject conflicting receipt";
        return {
          summary: summary,
          metrics: [
            { label: "Accepted", value: accepted ? 1 : 0 },
            { label: "New receipts", value: accepted && !v.done ? 1 : 0 },
            {
              label: "Result writes after decision",
              value: v.done || accepted ? 1 : 0,
            },
          ],
          bars: [
            { label: "Arrival", value: v.now, max: 140 },
            { label: "Expiry", value: 120, max: 140 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-distributed-eval-farm-4", {
    title: "Compute bounded worker waves",
    steps: [
      {
        label: "Bound callbacks",
        detail:
          "At most the configured number of pool callbacks launch a child process at once.",
      },
      {
        label: "Claim and score",
        detail:
          "Each child claims one persisted shard, compares recorded answers and submits a fenced receipt.",
      },
      {
        label: "Collect each wave",
        detail:
          "The coordinator waits for the current wave before dispatching another; completed runs retain all receipts.",
      },
    ],
    caption:
      "A scheduling calculation with supplied shard durations. It estimates wave time, not measured model throughput.",
    lab: {
      controls: [
        {
          key: "durations",
          label: "Shard durations ms",
          type: "text",
          value: "80,20,40,60",
        },
        {
          key: "workers",
          label: "Concurrent process slots",
          type: "range",
          value: 2,
          min: 1,
          max: 8,
          step: 1,
        },
      ],
      calculate(v) {
        const durations = v.durations.split(",").map((x) => Number(x.trim()));
        if (
          durations.length > 32 ||
          durations.some((x) => !Number.isFinite(x) || x <= 0)
        )
          return {
            summary: "Enter 1 to 32 positive durations",
            metrics: [],
            bars: [],
          };
        let time = 0;
        const rows = [];
        for (let i = 0; i < durations.length; i += v.workers) {
          const batch = durations.slice(i, i + v.workers);
          batch.forEach((d, j) =>
            rows.push(["shard-" + (i + j), "slot-" + (j + 1), time, time + d]),
          );
          time += Math.max(...batch);
        }
        const serial = durations.reduce((a, b) => a + b, 0);
        return {
          summary: "Wave barriers wait for the slowest shard in each batch",
          metrics: [
            { label: "Estimated wall time ms", value: time },
            { label: "Total child processes", value: durations.length },
            {
              label: "Maximum concurrent children",
              value: Math.min(v.workers, durations.length),
            },
            { label: "Waves", value: Math.ceil(durations.length / v.workers) },
          ],
          columns: ["Shard", "Slot", "Start ms", "Finish ms"],
          rows,
          bars: [
            { label: "Serial time", value: serial, max: serial },
            { label: "Bounded-wave time", value: time, max: serial },
          ],
        };
      },
    },
  });
})();
