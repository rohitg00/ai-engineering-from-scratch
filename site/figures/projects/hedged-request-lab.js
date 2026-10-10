(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-hedged-request-lab-1", {
    title: "Nearest-rank percentiles",
    steps: [
      {
        label: "Inputs",
        detail: "Small samples make tail percentiles coarse.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Small samples make tail percentiles coarse.",
    lab: {
      controls: [
        {
          key: "samples",
          label: "Latency samples ms",
          type: "text",
          value: "2,4,10,20,80",
        },
      ],
      calculate(v) {
        const a = v.samples
          .split(",")
          .map(Number)
          .sort((a, b) => a - b);
        if (a.some((x) => !Number.isFinite(x) || x < 0))
          throw Error("Invalid sample");
        return {
          summary: a.length + " samples",
          metrics: [
            { label: "P50 ms", value: a[Math.ceil(a.length * 0.5) - 1] },
            { label: "P95 ms", value: a[Math.ceil(a.length * 0.95) - 1] },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-hedged-request-lab-2", {
    title: "Hedge timer",
    steps: [
      {
        label: "Inputs",
        detail: "A second attempt begins only if the first has not won.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "A second attempt begins only if the first has not won.",
    lab: {
      controls: [
        {
          key: "primary",
          label: "Primary latency ms",
          type: "range",
          value: 80,
          min: 0,
          max: 200,
          step: 1,
        },
        {
          key: "secondary",
          label: "Secondary latency ms",
          type: "range",
          value: 5,
          min: 0,
          max: 200,
          step: 1,
        },
        {
          key: "delay",
          label: "Hedge delay ms",
          type: "range",
          value: 10,
          min: 0,
          max: 200,
          step: 1,
        },
      ],
      calculate(v) {
        const launched = v.primary > v.delay,
          win = launched
            ? Math.min(v.primary, v.delay + v.secondary)
            : v.primary;
        return {
          summary: "Winner at " + win + "ms",
          metrics: [{ label: "Calls launched", value: launched ? 2 : 1 }],
          bars: [
            { label: "Baseline", value: v.primary, max: 400 },
            { label: "Hedged", value: win, max: 400 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-hedged-request-lab-3", {
    title: "Cancellation evidence",
    steps: [
      {
        label: "Inputs",
        detail: "Client cancellation and completed server work are separate.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Client cancellation and completed server work are separate.",
    lab: {
      controls: [
        {
          key: "started",
          label: "Service requests started",
          type: "range",
          value: 2,
          min: 0,
          max: 5,
          step: 1,
        },
        {
          key: "cancelled",
          label: "Client cancellations",
          type: "range",
          value: 1,
          min: 0,
          max: 5,
          step: 1,
        },
      ],
      calculate(v) {
        const c = Math.min(v.started, v.cancelled);
        return {
          summary: "Server may still complete all " + v.started + " requests",
          metrics: [
            { label: "Client cancellation observations", value: c },
            { label: "Proven work saved", value: 0 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-hedged-request-lab-4", {
    title: "Work ratio",
    steps: [
      {
        label: "Inputs",
        detail: "Count all launched attempts before comparing latency.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Count all launched attempts before comparing latency.",
    lab: {
      controls: [
        {
          key: "baseline",
          label: "Baseline calls",
          type: "range",
          value: 3,
          min: 0,
          max: 20,
          step: 1,
        },
        {
          key: "hedged",
          label: "Hedged calls",
          type: "range",
          value: 6,
          min: 0,
          max: 40,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary: v.baseline
            ? (v.hedged / v.baseline).toFixed(2) + "x request work"
            : "No baseline denominator",
          metrics: [
            { label: "Additional requests", value: v.hedged - v.baseline },
          ],
          bars: [
            { label: "Baseline", value: v.baseline, max: 40 },
            { label: "Hedged", value: v.hedged, max: 40 },
          ],
        };
      },
    },
  });
})();
