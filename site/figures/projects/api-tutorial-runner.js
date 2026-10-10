window.AIFSProjectFigures.register("pj-api-tutorial-runner-1", {
  title: "Extract explicit requests from an authored tutorial",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Identify executable tutorial examples without guessing intent from arbitrary code blocks.",
    },
    {
      label: "Compute",
      detail: "extractRequests(markdown:string):RequestStep[]",
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
        key: "before",
        label: "Lines before request fence",
        type: "range",
        value: 4,
        min: 0,
        max: 20,
        step: 1,
      },
      {
        key: "steps",
        label: "Explicit request blocks",
        type: "range",
        value: 3,
        min: 1,
        max: 20,
        step: 1,
      },
    ],
    calculate(v) {
      return {
        summary: "Source locations identify the exact example to repair.",
        metrics: [
          { label: "Opening fence line", value: v.before + 1 },
          { label: "Request count", value: v.steps },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-api-tutorial-runner-2", {
  title: "Resolve typed variables across steps",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Make dependencies explicit and preserve captured primitive types.",
    },
    {
      label: "Compute",
      detail:
        "resolveValue(value:unknown,variables:Record<string,string|number|boolean>):unknown; captureVariables(body,declarations,previous?):Record<string,string|number|boolean>",
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
        key: "id",
        label: "Captured numeric loan ID",
        type: "number",
        value: 41,
      },
    ],
    calculate(v) {
      return {
        summary:
          "Exact substitution keeps a number; URL substitution encodes text.",
        columns: ["Boundary", "Value"],
        rows: [
          ["JSON body", JSON.stringify({ loan: v.id })],
          ["Request path", "/loans/" + encodeURIComponent(String(v.id))],
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-api-tutorial-runner-3", {
  title: "Run bounded requests against a test service",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Exercise the actual HTTP wire with bounded local or explicitly opted-in requests.",
    },
    {
      label: "Compute",
      detail:
        "runTutorial(steps:RequestStep[],baseURL:string,options?):Promise<Receipt[]>",
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
        key: "bytes",
        label: "Response bytes",
        type: "range",
        value: 80000,
        min: 0,
        max: 131072,
        step: 1024,
      },
      {
        key: "limit",
        label: "Byte limit",
        type: "range",
        value: 65536,
        min: 1024,
        max: 131072,
        step: 1024,
      },
    ],
    calculate(v) {
      return {
        summary:
          v.bytes > v.limit
            ? "Abort response and skip remaining requests."
            : "Response fits the configured bound.",
        metrics: [
          { label: "Over budget", value: Math.max(0, v.bytes - v.limit) },
        ],
        bars: [
          { label: "Response", value: v.bytes, max: 131072 },
          { label: "Limit", value: v.limit, max: 131072 },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-api-tutorial-runner-4", {
  title: "Export source-linked failures and correction proposals",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Produce portable test evidence and require a reviewed correction rather than silently editing a tutorial.",
    },
    {
      label: "Compute",
      detail:
        "exportResults(steps,receipts):{junit,html,corrections}; acceptedCorrections(receipts,value):{id,line,proposal}[]",
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
        key: "failure",
        label: "First failing step",
        type: "range",
        value: 2,
        min: 1,
        max: 3,
        step: 1,
      },
    ],
    calculate(v) {
      return {
        summary: "Stop after the first failure, preserving source evidence.",
        metrics: [
          { label: "Passed", value: v.failure - 1 },
          { label: "Failed", value: 1 },
          { label: "Skipped", value: 3 - v.failure },
        ],
        columns: ["Step", "Status"],
        rows: [1, 2, 3].map((n) => [
          n,
          n < v.failure ? "pass" : n === v.failure ? "fail" : "skip",
        ]),
      };
    },
  },
});
