(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-log-volume-reduction-lab-1", {
    title: "Digit templates",
    steps: [
      {
        label: "Inputs",
        detail: "Replace ASCII digit runs; retain other text.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Replace ASCII digit runs; retain other text.",
    lab: {
      controls: [
        {
          key: "message",
          label: "Message",
          type: "text",
          value: "retry request 137 after 50ms",
        },
      ],
      calculate(v) {
        const t = v.message.replace(/[0-9]+/g, "#");
        return {
          summary: t,
          metrics: [{ label: "Input characters", value: v.message.length }],
          columns: ["Original", "Template"],
          rows: [[v.message, t]],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-log-volume-reduction-lab-2", {
    title: "Grouping evidence",
    steps: [
      {
        label: "Inputs",
        detail: "One rare line interrupts a repeated template.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "One rare line interrupts a repeated template.",
    lab: {
      controls: [
        {
          key: "n",
          label: "Retry records",
          type: "range",
          value: 199,
          min: 0,
          max: 300,
          step: 1,
        },
        {
          key: "rare",
          label: "Disk-full records",
          type: "range",
          value: 1,
          min: 0,
          max: 5,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary:
            v.n +
            v.rare +
            " records in " +
            ((v.n > 0 ? 1 : 0) + (v.rare > 0 ? 1 : 0)) +
            " templates",
          metrics: [
            { label: "Retry count", value: v.n },
            { label: "Disk-full count", value: v.rare },
          ],
          bars: [
            { label: "Retry", value: v.n, max: 305 },
            { label: "Disk-full", value: v.rare, max: 305 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-log-volume-reduction-lab-3", {
    title: "Uniform positions",
    steps: [
      {
        label: "Inputs",
        detail:
          "An event is lost when its index is outside the selected positions.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption:
      "An event is lost when its index is outside the selected positions.",
    lab: {
      controls: [
        {
          key: "budget",
          label: "Budget",
          type: "range",
          value: 8,
          min: 0,
          max: 20,
          step: 1,
        },
        {
          key: "rare",
          label: "Rare zero-based index",
          type: "range",
          value: 137,
          min: 0,
          max: 199,
          step: 1,
        },
      ],
      calculate(v) {
        const ids = Array.from({ length: v.budget }, (_, i) =>
          Math.floor((i * 200) / Math.max(1, v.budget)),
        );
        const kept = ids.includes(v.rare);
        return {
          summary: kept
            ? "Uniform retains rare event"
            : "Uniform misses rare event",
          metrics: [{ label: "Rarity retains it", value: v.budget > 0 }],
          columns: ["Selected index"],
          rows: ids.map((x) => [x]),
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-log-volume-reduction-lab-4", {
    title: "Rare coverage",
    steps: [
      {
        label: "Inputs",
        detail: "Coverage counts rare templates, not tokens.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Coverage counts rare templates, not tokens.",
    lab: {
      controls: [
        {
          key: "rare",
          label: "Rare templates",
          type: "range",
          value: 4,
          min: 0,
          max: 10,
          step: 1,
        },
        {
          key: "kept",
          label: "Retained rare templates",
          type: "range",
          value: 3,
          min: 0,
          max: 10,
          step: 1,
        },
      ],
      calculate(v) {
        const k = Math.min(v.rare, v.kept),
          cov = v.rare ? k / v.rare : 1;
        return {
          summary: (100 * cov).toFixed(1) + "% rare-template coverage",
          metrics: [{ label: "Lost rare templates", value: v.rare - k }],
          bars: [{ label: "Retained", value: k, max: Math.max(1, v.rare) }],
        };
      },
    },
  });
})();
