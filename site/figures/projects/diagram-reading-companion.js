window.AIFSProjectFigures.register("pj-diagram-reading-companion-1", {
  title: "Load an SVG and validate declared nodes and edges",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Verify that every authored explanation points to a real SVG element.",
    },
    {
      label: "Compute",
      detail:
        "loadDiagram(svg: string, value: unknown): {svg:string;graph:Graph}",
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
        key: "declared",
        label: "Declared IDs",
        type: "text",
        value: "collect,check,share",
      },
      { key: "svg", label: "SVG IDs", type: "text", value: "collect,check" },
    ],
    calculate(v) {
      const a = v.declared.split(",").map((x) => x.trim()),
        b = v.svg.split(",").map((x) => x.trim()),
        missing = a.filter((x) => !b.includes(x));
      return {
        summary: missing.length
          ? "Reject missing SVG elements."
          : "Every declared node resolves.",
        columns: ["Missing ID"],
        rows: missing.map((x) => [x]),
        metrics: [{ label: "Resolved", value: a.length - missing.length }],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-diagram-reading-companion-2", {
  title: "Compute branches, cycles and candidate reading order",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Keep branches and cycles visible instead of flattening a graph into a misleading list.",
    },
    { label: "Compute", detail: "analyzeGraph(graph: Graph): Analysis" },
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
        key: "branch",
        label: "Include clarification branch",
        type: "checkbox",
        value: true,
      },
      {
        key: "cycle",
        label: "Clarification returns to check",
        type: "checkbox",
        value: false,
      },
    ],
    calculate(v) {
      return {
        summary:
          v.cycle && v.branch
            ? "A back-edge exposes the clarification cycle."
            : "Candidate traversal finishes without a back-edge.",
        metrics: [
          {
            label: "Edges",
            value: 2 + (v.branch ? 1 : 0) + (v.branch && v.cycle ? 1 : 0),
          },
          { label: "Branches", value: v.branch ? 1 : 0 },
          { label: "Back-edge cycles", value: v.branch && v.cycle ? 1 : 0 },
        ],
        columns: ["Order"],
        rows: (v.branch
          ? ["collect", "check", "share", "clarify"]
          : ["collect", "check", "share"]
        ).map((x) => [x]),
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-diagram-reading-companion-3", {
  title: "Review explanations and reading order",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Apply an author review without losing the original graph relationships.",
    },
    {
      label: "Compute",
      detail:
        "reviewGraph(graph: Graph, value?: unknown): {schemaVersion:1;graph:Graph;order:string[];reviewed:boolean}",
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
        key: "order",
        label: "Reviewed order",
        type: "text",
        value: "collect,check,clarify,share",
      },
    ],
    calculate(v) {
      const ids = v.order.split(",").map((x) => x.trim()),
        known = ["collect", "check", "share", "clarify"],
        ok =
          ids.length === 4 &&
          new Set(ids).size === 4 &&
          ids.every((x) => known.includes(x));
      return {
        summary: ok
          ? "Valid permutation: accept review."
          : "Reject missing, duplicated or unknown node.",
        columns: ["Step", "Node"],
        rows: ids.map((x, i) => [i + 1, x]),
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-diagram-reading-companion-4", {
  title: "Export the navigable walkthrough and graph data",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Connect focusable node buttons to the authored picture and export a reusable review.",
    },
    {
      label: "Compute",
      detail:
        "renderWalkthrough(svg:string, review:ReturnType<typeof reviewGraph>):string",
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
        key: "index",
        label: "Focused step",
        type: "range",
        value: 2,
        min: 1,
        max: 4,
        step: 1,
      },
    ],
    calculate(v) {
      const order = ["collect", "check", "share", "clarify"];
      return {
        summary: "Keyboard navigation chooses one declared SVG id.",
        metrics: [
          { label: "Selected node", value: order[v.index - 1] },
          { label: "Previous available", value: v.index > 1 ? "yes" : "no" },
          { label: "Next available", value: v.index < 4 ? "yes" : "no" },
        ],
      };
    },
  },
});
