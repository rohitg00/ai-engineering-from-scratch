(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-retry-storm-lab-1", {
    title: "Burst capacity",
    steps: [
      {
        label: "Inputs",
        detail: "One exact clock bucket limits accepted initial calls.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "One exact clock bucket limits accepted initial calls.",
    lab: {
      controls: [
        {
          key: "clients",
          label: "Clients",
          type: "range",
          value: 20,
          min: 0,
          max: 50,
          step: 1,
        },
        {
          key: "capacity",
          label: "Capacity per millisecond",
          type: "range",
          value: 5,
          min: 0,
          max: 50,
          step: 1,
        },
      ],
      calculate(v) {
        const ok = Math.min(v.clients, v.capacity);
        return {
          summary: ok + " succeed; " + (v.clients - ok) + " fail",
          bars: [
            { label: "Accepted", value: ok, max: 50 },
            { label: "Rejected", value: v.clients - ok, max: 50 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-retry-storm-lab-2", {
    title: "Bounded backoff",
    steps: [
      {
        label: "Inputs",
        detail: "Capped exponential waits before each retry.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Capped exponential waits before each retry.",
    lab: {
      controls: [
        {
          key: "base",
          label: "Base milliseconds",
          type: "range",
          value: 10,
          min: 0,
          max: 50,
          step: 1,
        },
        {
          key: "cap",
          label: "Cap milliseconds",
          type: "range",
          value: 80,
          min: 0,
          max: 200,
          step: 1,
        },
      ],
      calculate(v) {
        const cap = Math.max(v.base, v.cap);
        return {
          summary: "Cap " + cap + "ms",
          columns: ["Retry", "Wait ms"],
          rows: [1, 2, 3, 4].map((i) => [
            i,
            Math.min(cap, v.base * 2 ** (i - 1)),
          ]),
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-retry-storm-lab-3", {
    title: "Shared amplification",
    steps: [
      { label: "Inputs", detail: "Initial calls plus admitted retries." },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Initial calls plus admitted retries.",
    lab: {
      controls: [
        {
          key: "clients",
          label: "Clients",
          type: "range",
          value: 20,
          min: 0,
          max: 50,
          step: 1,
        },
        {
          key: "budget",
          label: "Shared retry cap",
          type: "range",
          value: 12,
          min: 0,
          max: 100,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary: "At most " + (v.clients + v.budget) + " attempts",
          metrics: [
            {
              label: "Maximum amplification",
              value: v.clients
                ? ((v.clients + v.budget) / v.clients).toFixed(2)
                : 0,
            },
          ],
          bars: [
            { label: "Initial", value: v.clients, max: 150 },
            { label: "Retries", value: v.budget, max: 150 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-retry-storm-lab-4", {
    title: "Observed receipt",
    steps: [
      {
        label: "Inputs",
        detail: "Count actual calls independently from declared counters.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Count actual calls independently from declared counters.",
    lab: {
      controls: [
        {
          key: "initial",
          label: "Initial calls",
          type: "range",
          value: 20,
          min: 0,
          max: 50,
          step: 1,
        },
        {
          key: "retried",
          label: "Observed retries",
          type: "range",
          value: 12,
          min: 0,
          max: 50,
          step: 1,
        },
        {
          key: "success",
          label: "Successful clients",
          type: "range",
          value: 12,
          min: 0,
          max: 50,
          step: 1,
        },
      ],
      calculate(v) {
        const s = Math.min(v.initial, v.success),
          calls = v.initial + v.retried;
        return {
          summary: calls + " actual HTTP attempts",
          metrics: [
            { label: "Successes", value: s },
            {
              label: "Amplification",
              value: v.initial ? (calls / v.initial).toFixed(2) : 0,
            },
          ],
          bars: [
            {
              label: "Recovered clients",
              value: s,
              max: Math.max(1, v.initial),
            },
          ],
        };
      },
    },
  });
})();
