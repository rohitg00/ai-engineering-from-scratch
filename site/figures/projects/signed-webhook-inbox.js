(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-signed-webhook-inbox-1", {
    title: "Raw bytes",
    steps: [
      {
        label: "Inputs",
        detail:
          "A space changes signed input even when JSON meaning is unchanged.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption:
      "A space changes signed input even when JSON meaning is unchanged.",
    lab: {
      controls: [
        {
          key: "body",
          label: "Raw JSON body",
          type: "text",
          value: '{"eventId":"business-42"}',
        },
      ],
      calculate(v) {
        const bytes = new TextEncoder().encode(v.body);
        return {
          summary: bytes.length + " exact bytes enter the signature",
          metrics: [
            { label: "Bytes after one added space", value: bytes.length + 1 },
          ],
          columns: ["Input", "Byte count"],
          rows: [
            [v.body, bytes.length],
            [v.body + " ", bytes.length + 1],
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-signed-webhook-inbox-2", {
    title: "Timestamp window",
    steps: [
      {
        label: "Inputs",
        detail: "Bound old and future signatures with an inclusive interval.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Bound old and future signatures with an inclusive interval.",
    lab: {
      controls: [
        {
          key: "age",
          label: "Seconds since signature",
          type: "range",
          value: 300,
          min: 0,
          max: 600,
          step: 1,
        },
        {
          key: "window",
          label: "Allowed skew seconds",
          type: "range",
          value: 300,
          min: 0,
          max: 600,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary:
            v.age <= v.window ? "Timestamp accepted" : "Timestamp rejected",
          metrics: [
            {
              label: "Outside window seconds",
              value: Math.max(0, v.age - v.window),
            },
          ],
          bars: [
            { label: "Age", value: v.age, max: 600 },
            { label: "Window", value: v.window, max: 600 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-signed-webhook-inbox-3", {
    title: "Delivery identity",
    steps: [
      {
        label: "Inputs",
        detail: "Transport retries share an ID and the exact same body.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Transport retries share an ID and the exact same body.",
    lab: {
      controls: [
        {
          key: "first",
          label: "Accepted ID",
          type: "text",
          value: "delivery-1",
        },
        {
          key: "next",
          label: "Incoming ID",
          type: "text",
          value: "delivery-1",
        },
        { key: "body", label: "Incoming body", type: "text", value: "same" },
      ],
      calculate(v) {
        return {
          summary:
            v.next !== v.first
              ? "New transport delivery"
              : v.body === "same"
                ? "Duplicate retry: reuse entry"
                : "Identity conflict: reject",
          metrics: [
            { label: "New stored delivery", value: v.next !== v.first ? 1 : 0 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-signed-webhook-inbox-4", {
    title: "Explicit replay",
    steps: [
      {
        label: "Inputs",
        detail: "A new run is distinct from a new transport delivery.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "A new run is distinct from a new transport delivery.",
    lab: {
      controls: [
        {
          key: "runs",
          label: "Replay run IDs",
          type: "text",
          value: "review-1,review-1,review-2",
        },
      ],
      calculate(v) {
        const runs = v.runs
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          unique = [...new Set(runs)];
        return {
          summary: unique.length + " processing receipts",
          metrics: [
            {
              label: "Repeated runs reused",
              value: runs.length - unique.length,
            },
          ],
          columns: ["Stored run ID"],
          rows: unique.map((x) => [x]),
        };
      },
    },
  });
})();
