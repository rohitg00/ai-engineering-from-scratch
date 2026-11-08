(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-decision-tradeoff-explorer-1", {
    title: "Unknown evidence",
    steps: [
      { label: "Inputs", detail: "A null value stays unknown." },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "A null value stays unknown.",
    lab: {
      controls: [
        { key: "value", label: "Value JSON", type: "text", value: "null" },
      ],
      calculate(v) {
        const x = JSON.parse(v.value);
        return {
          summary:
            x === null
              ? "Unknown: option is ineligible"
              : Number.isFinite(x)
                ? "Measured numeric value"
                : "Invalid evidence",
          metrics: [{ label: "Known", value: Number.isFinite(x) }],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-decision-tradeoff-explorer-2", {
    title: "Weighted scores",
    steps: [
      {
        label: "Inputs",
        detail: "Compare fixed normalized access and cost values.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Compare fixed normalized access and cost values.",
    lab: {
      controls: [
        {
          key: "access",
          label: "Access weight",
          type: "range",
          value: 5,
          min: 0,
          max: 10,
          step: 1,
        },
      ],
      calculate(v) {
        const w = v.access / 10;
        const a = 0.9 * w + 0.2 * (1 - w),
          b = 0.6 * w + 0.8 * (1 - w);
        return {
          summary: a > b ? "Open gallery leads" : "Pods lead",
          metrics: [
            { label: "Open score", value: a.toFixed(3) },
            { label: "Pods score", value: b.toFixed(3) },
          ],
          bars: [
            { label: "Open", value: a, max: 1 },
            { label: "Pods", value: b, max: 1 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-decision-tradeoff-explorer-3", {
    title: "Preference crossover",
    steps: [
      {
        label: "Inputs",
        detail: "Solve the two-criterion score across eleven weights.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Solve the two-criterion score across eleven weights.",
    lab: {
      controls: [
        {
          key: "cost",
          label: "Open setup hours",
          type: "range",
          value: 8,
          min: 0,
          max: 10,
          step: 1,
        },
      ],
      calculate(v) {
        const rows = Array.from({ length: 11 }, (_, i) => {
          const w = i / 10,
            a = 0.9 * w + (1 - v.cost / 10) * (1 - w),
            b = 0.6 * w + 0.8 * (1 - w);
          return [
            w.toFixed(1),
            a.toFixed(2),
            b.toFixed(2),
            a > b ? "Open" : "Pods",
          ];
        });
        return {
          summary: "Fixed-range sensitivity sweep",
          columns: ["Access weight", "Open", "Pods", "Leader"],
          rows,
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-decision-tradeoff-explorer-4", {
    title: "Chosen record",
    steps: [
      {
        label: "Inputs",
        detail: "A deliberate choice can differ from the maximum score.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "A deliberate choice can differ from the maximum score.",
    lab: {
      controls: [
        {
          key: "chosen",
          label: "Chosen eligible ID",
          type: "text",
          value: "open",
        },
        {
          key: "access",
          label: "Access weight",
          type: "range",
          value: 8,
          min: 0,
          max: 10,
          step: 1,
        },
      ],
      calculate(v) {
        const w = v.access / 10,
          a = 0.9 * w + 0.2 * (1 - w),
          b = 0.6 * w + 0.8 * (1 - w),
          winner = a > b ? "open" : "pods";
        return {
          summary: ["open", "pods"].includes(v.chosen)
            ? "Version-1 scenario can be exported"
            : "Invalid chosen ID",
          columns: ["Field", "Value"],
          rows: [
            ["chosen", v.chosen],
            ["winner", winner],
            ["access weight", w],
          ],
        };
      },
    },
  });
})();
