window.AIFSProjectFigures.register("pj-glossary-hovercard-publisher-1", {
  title: "Validate terms, aliases and original definitions",
  steps: [
    {
      label: "Read evidence",
      detail: "Build a reviewed dictionary with unambiguous phrase identities.",
    },
    { label: "Compute", detail: "validateGlossary(value: unknown): Term[]" },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      {
        key: "term",
        label: "Canonical term",
        type: "text",
        value: "map scale",
      },
      {
        key: "alias",
        label: "Proposed alias",
        type: "text",
        value: "MAP SCALE",
      },
    ],
    calculate(v) {
      const same = v.term.toLowerCase() === v.alias.toLowerCase();
      return {
        summary: same
          ? "Reject the duplicate phrase."
          : "Two phrases map to one term identity.",
        metrics: [{ label: "Distinct phrases", value: same ? 1 : 2 }],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-glossary-hovercard-publisher-2", {
  title: "Match phrases inside eligible text nodes",
  steps: [
    {
      label: "Read evidence",
      detail: "Locate the longest eligible phrase at each word boundary.",
    },
    {
      label: "Compute",
      detail: "matchTerms(text: string, terms: Term[]): Match[]",
    },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      {
        key: "text",
        label: "Text to scan",
        type: "text",
        value: "Map scale then map",
      },
    ],
    calculate(v) {
      const hits = [...v.text.matchAll(/\b(map scale|map)\b/gi)].map((x) => [
        x[0],
        x.index,
        x.index + x[0].length,
      ]);
      return {
        summary: "Longest phrase comes first in the matcher.",
        columns: ["Phrase", "Start", "End"],
        rows: hits,
        metrics: [{ label: "Matches", value: hits.length }],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-glossary-hovercard-publisher-3", {
  title: "Render accessible definitions in context",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Insert keyboard-operable definitions without changing code or links.",
    },
    {
      label: "Compute",
      detail:
        "annotateLesson(html: string, terms: Term[]): {html: string; coverage: Coverage[]}",
    },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      {
        key: "paragraph",
        label: "Paragraph occurrences",
        type: "range",
        value: 3,
        min: 0,
        max: 10,
        step: 1,
      },
      {
        key: "code",
        label: "Code occurrences",
        type: "range",
        value: 2,
        min: 0,
        max: 10,
        step: 1,
      },
    ],
    calculate(v) {
      return {
        summary: "Code is an ineligible ancestor.",
        metrics: [
          { label: "Annotated", value: v.paragraph },
          { label: "Preserved", value: v.code },
        ],
        bars: [
          { label: "Eligible text", value: v.paragraph, max: 10 },
          { label: "Code", value: v.code, max: 10 },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-glossary-hovercard-publisher-4", {
  title: "Export the lesson and reusable glossary bundle",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Ship one standalone lesson with the exact glossary that produced it.",
    },
    {
      label: "Compute",
      detail:
        "publishGlossary(lesson: string, terms: Term[]): {html: string; glossary: Term[]; coverage: Coverage[]}",
    },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      { key: "counts", label: "Term counts", type: "text", value: "2,0,1,4,0" },
    ],
    calculate(v) {
      const n = v.counts
        .split(",")
        .map(Number)
        .filter((x) => Number.isInteger(x) && x >= 0);
      return {
        summary: "A zero count is visible coverage evidence.",
        metrics: [
          { label: "Terms", value: n.length },
          { label: "Used", value: n.filter((x) => x > 0).length },
          { label: "Total annotations", value: n.reduce((a, b) => a + b, 0) },
        ],
      };
    },
  },
});
