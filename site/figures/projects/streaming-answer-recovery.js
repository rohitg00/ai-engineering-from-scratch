(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-streaming-answer-recovery-1", {
    title: "UTF-8 framing",
    steps: [
      {
        label: "Inputs",
        detail: "A complete event needs the blank separator.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "A complete event needs the blank separator.",
    lab: {
      controls: [
        {
          key: "data",
          label: "SSE text",
          type: "text",
          value: "id: 1\ndata: Caf\u00e9\n\n",
        },
      ],
      calculate(v) {
        const n = v.data.split(/\r?\n\r?\n/).length - 1;
        return {
          summary: n + " complete event separators",
          metrics: [
            {
              label: "UTF-8 bytes",
              value: new TextEncoder().encode(v.data).length,
            },
            { label: "Characters", value: v.data.length },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-streaming-answer-recovery-2", {
    title: "Stable identity",
    steps: [
      {
        label: "Inputs",
        detail: "Repeated identical events do not append twice.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Repeated identical events do not append twice.",
    lab: {
      controls: [
        { key: "ids", label: "Delivered IDs", type: "text", value: "1,2,2,3" },
      ],
      calculate(v) {
        const ids = v.ids
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          unique = [...new Set(ids)];
        return {
          summary: unique.length + " unique events accepted",
          metrics: [{ label: "Duplicates", value: ids.length - unique.length }],
          columns: ["Accepted ID"],
          rows: unique.map((x) => [x]),
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-streaming-answer-recovery-3", {
    title: "Resume cursor",
    steps: [
      {
        label: "Inputs",
        detail: "Reconnect starts after the last accepted event.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Reconnect starts after the last accepted event.",
    lab: {
      controls: [
        {
          key: "last",
          label: "Last accepted ID",
          type: "range",
          value: 1,
          min: 0,
          max: 4,
          step: 1,
        },
      ],
      calculate(v) {
        const ids = [1, 2, 3, 4].filter((x) => x > v.last);
        return {
          summary: ids.length
            ? "Resume with IDs " + ids.join(", ")
            : "No events remain",
          metrics: [{ label: "Last-Event-ID", value: v.last }],
          columns: ["Next event"],
          rows: ids.map((x) => [x]),
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-streaming-answer-recovery-4", {
    title: "Answer status",
    steps: [
      {
        label: "Inputs",
        detail: "Text and a citation do not prove completion.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Text and a citation do not prove completion.",
    lab: {
      controls: [
        {
          key: "accepted",
          label: "Accepted events",
          type: "range",
          value: 2,
          min: 0,
          max: 4,
          step: 1,
        },
      ],
      calculate(v) {
        const status = v.accepted === 4 ? "completed" : "interrupted";
        return {
          summary: status,
          metrics: [
            { label: "Citation available", value: v.accepted >= 3 },
            { label: "Complete event available", value: v.accepted === 4 },
          ],
          columns: ["Field", "Value"],
          rows: [
            [
              "text",
              v.accepted >= 2
                ? "Café supports interrupted answers."
                : v.accepted === 1
                  ? "Caf"
                  : "",
            ],
            ["lastID", v.accepted],
          ],
        };
      },
    },
  });
})();
