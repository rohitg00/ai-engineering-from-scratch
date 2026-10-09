(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-configuration-drift-explainer-1", {
    title: "Scalar validation",
    steps: [
      {
        label: "Inputs",
        detail: "Nested values need an explicit merge contract.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Nested values need an explicit merge contract.",
    lab: {
      controls: [
        { key: "value", label: "JSON scalar", type: "text", value: "30" },
      ],
      calculate(v) {
        const x = JSON.parse(v.value);
        const ok =
          x === null || ["string", "number", "boolean"].includes(typeof x);
        return {
          summary: ok ? "Accepted scalar" : "Rejected nested value",
          metrics: [{ label: "Accepted", value: ok }],
          columns: ["Value", "Type"],
          rows: [[JSON.stringify(x), x === null ? "null" : typeof x]],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-configuration-drift-explainer-2", {
    title: "Layer precedence",
    steps: [
      {
        label: "Inputs",
        detail: "Last layer wins while history remains visible.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Last layer wins while history remains visible.",
    lab: {
      controls: [
        {
          key: "base",
          label: "Default timeout",
          type: "range",
          value: 30,
          min: 0,
          max: 60,
          step: 1,
        },
        {
          key: "override",
          label: "Override timeout",
          type: "range",
          value: 5,
          min: 0,
          max: 60,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary: "Effective timeout " + v.override,
          metrics: [{ label: "Shadowed timeout", value: v.base }],
          columns: ["Source", "Value"],
          rows: [
            ["defaults.json", v.base],
            ["env:TIMEOUT", v.override],
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-configuration-drift-explainer-3", {
    title: "Observed drift",
    steps: [
      {
        label: "Inputs",
        detail: "Missing and explicit values have separate meanings.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Missing and explicit values have separate meanings.",
    lab: {
      controls: [
        {
          key: "expected",
          label: "Expected timeout",
          type: "range",
          value: 5,
          min: 0,
          max: 60,
          step: 1,
        },
        {
          key: "actual",
          label: "Observed timeout",
          type: "range",
          value: 30,
          min: 0,
          max: 60,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary: v.expected === v.actual ? "equal" : "changed",
          metrics: [{ label: "Difference", value: v.actual - v.expected }],
          bars: [
            { label: "Expected", value: v.expected, max: 60 },
            { label: "Observed", value: v.actual, max: 60 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-configuration-drift-explainer-4", {
    title: "Redacted export",
    steps: [
      {
        label: "Inputs",
        detail: "Classification happens before display redaction.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Classification happens before display redaction.",
    lab: {
      controls: [
        { key: "key", label: "Key", type: "text", value: "api_token" },
        { key: "old", label: "Expected", type: "text", value: "before" },
        { key: "now", label: "Observed", type: "text", value: "after" },
      ],
      calculate(v) {
        const hide = /(password|secret|token|api[_-]?key|credential)/i.test(
          v.key,
        );
        return {
          summary: v.old === v.now ? "equal" : "changed",
          metrics: [{ label: "Redacted", value: hide }],
          columns: ["Key", "Expected", "Observed"],
          rows: [
            [v.key, hide ? "[REDACTED]" : v.old, hide ? "[REDACTED]" : v.now],
          ],
        };
      },
    },
  });
})();
