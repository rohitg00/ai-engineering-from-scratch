window.AIFSProjectFigures.register("pj-vocabulary-autocomplete-pad-1", {
  title: "Tokenize a corpus and count word histories",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Count words and one- or two-word histories without crossing sentence boundaries.",
    },
    {
      label: "Compute",
      detail: "tokenize(text: string): string[]; train(corpus: unknown): Model",
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
        label: "Corpus sentence",
        type: "text",
        value: "garden club shares seeds garden club shares tools",
      },
    ],
    calculate(v) {
      const t = v.text.toLowerCase().match(/[a-z]+/g) || [],
        c = {};
      t.forEach((x) => (c[x] = (c[x] || 0) + 1));
      return {
        summary: "Repeated tokens increment unigram evidence.",
        columns: ["Token", "Count"],
        rows: Object.entries(c),
        metrics: [
          { label: "Tokens", value: t.length },
          { label: "Vocabulary", value: Object.keys(c).length },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-vocabulary-autocomplete-pad-2", {
  title: "Rank prefix and next-word candidates",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Rank candidates by the longest observed history and show the underlying count.",
    },
    {
      label: "Compute",
      detail:
        "suggest(model: Model, prefix: string, history?: string[], limit?: number): Suggestion[]",
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
        key: "history",
        label: "Matching history length",
        type: "range",
        value: 2,
        min: 0,
        max: 2,
        step: 1,
      },
      {
        key: "count",
        label: "Observed count",
        type: "range",
        value: 3,
        min: 1,
        max: 20,
        step: 1,
      },
    ],
    calculate(v) {
      return {
        summary: "Rank first by history length, then count.",
        metrics: [
          { label: "Display score", value: v.history * 1000000 + v.count },
          { label: "Context order", value: v.history },
        ],
        columns: ["Evidence", "Value"],
        rows: [
          ["Conditional count", v.count],
          ["History tokens", v.history],
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-vocabulary-autocomplete-pad-3", {
  title: "Accept suggestions in a writing pad",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Distinguish an unfinished token from a completed word before inserting a suggestion.",
    },
    {
      label: "Compute",
      detail:
        "completeText(model: Model, text: string, limit?: number): {prefix:string;history:string[];suggestions:Suggestion[]}; acceptSuggestion(text:string,prefix:string,word:string):string",
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
        label: "Current text",
        type: "text",
        value: "Garden club sh",
      },
    ],
    calculate(v) {
      const tail = v.text.split(/[.!?\n]/).at(-1),
        t = tail.toLowerCase().match(/[a-z]+/g) || [],
        prefix = /[a-z]$/i.test(tail) ? t.pop() || "" : "";
      return {
        summary: "Trailing whitespace marks a completed token.",
        columns: ["Field", "Value"],
        rows: [
          ["Prefix", prefix],
          ["History", JSON.stringify(t.slice(-2))],
          [
            "Accept shares",
            v.text.slice(0, v.text.length - prefix.length) + "shares ",
          ],
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-vocabulary-autocomplete-pad-4", {
  title: "Export the learned model and editor function",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Validate a portable model and ship a pad that calls the same suggestion functions.",
    },
    {
      label: "Compute",
      detail:
        "importModel(value: unknown): Model; renderPad(model: Model, initial?: string): string",
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
        key: "total",
        label: "Unigram count",
        type: "range",
        value: 5,
        min: 1,
        max: 20,
        step: 1,
      },
      {
        key: "conditional",
        label: "Conditional count",
        type: "range",
        value: 3,
        min: 1,
        max: 20,
        step: 1,
      },
    ],
    calculate(v) {
      return {
        summary:
          v.conditional <= v.total
            ? "Counts can be imported."
            : "Reject: conditional count exceeds its total.",
        metrics: [
          {
            label: "Remaining contexts",
            value: Math.max(0, v.total - v.conditional),
          },
        ],
      };
    },
  },
});
