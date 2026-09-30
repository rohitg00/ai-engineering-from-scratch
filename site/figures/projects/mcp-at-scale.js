(function () {
  "use strict";
  const controls = [
    { key: "query", label: "Tool query", type: "text", value: "pods count" },
    {
      key: "budget",
      label: "Serialized tools array budget",
      type: "range",
      value: 700,
      min: 0,
      max: 3000,
      step: 1,
    },
    {
      key: "families",
      label: "Resource families",
      type: "range",
      value: 3,
      min: 1,
      max: 50,
      step: 1,
    },
    {
      key: "initialized",
      label: "Client initialized",
      type: "checkbox",
      value: true,
    },
  ];
  const calculate = function (v, stepIndex) {
    const resources = ["pods", "logs", "metrics", "jobs", "nodes", "services"];
    const terms = new Set(v.query.toLowerCase().match(/[a-z0-9]+/g) || []);
    const tools = [];
    for (const r of resources.slice(0, Math.min(v.families, 6)))
      for (const op of ["list", "get", "count", "search", "describe"]) {
        const tool = {
          name: r + "_" + op,
          description: op + " " + r,
          inputSchema: {
            type: "object",
            properties:
              op === "get"
                ? { name: { type: "string" } }
                : op === "search"
                  ? { query: { type: "string" } }
                  : {},
          },
        };
        const score = [r, op].filter((x) => terms.has(x)).length;
        if (score) tools.push({ tool, score });
      }
    tools.sort(
      (a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name),
    );
    const selected = [];
    for (const { tool } of tools) {
      if (
        JSON.stringify([...selected, tool]).length <= v.budget &&
        selected.length < 5
      )
        selected.push(tool);
    }
    const used = selected.length ? JSON.stringify(selected).length : 0;
    return {
      summary: v.initialized
        ? "Metadata selected before tool invocation"
        : "Protocol error -32002: initialize before tools",
      metrics: [
        { label: "Generated registry tools", value: v.families * 5 },
        { label: "32-tool pages", value: Math.ceil((v.families * 5) / 32) },
        { label: "Selected schema characters", value: used },
      ],
      bars: [
        { label: "Used character budget", value: used, max: v.budget || 1 },
      ],
      columns: ["selected tool", "schema characters"],
      rows: selected.map((x) => [x.name, JSON.stringify(x).length]),
    };
  };
  window.AIFSProjectFigures.register(
    "pj-mcp-at-scale-1",
    Object.assign(
      {
        title: "Build a catalog of 250 read-only tools",
        steps: [
          {
            label: "Input",
            detail:
              "Create five narrowly scoped read operations for each of 50 resource kinds.",
          },
          {
            label: "Transform",
            detail:
              "Create five narrowly scoped read operations for each of 50 resource kinds. The names and schemas are stable; execution reads an injected inventory rather than contacting a cluster. A tool schema defines the exact accepted keys and values, so an unknown argument never reaches a handler by accident.",
          },
          {
            label: "Verify",
            detail: "The generated catalog contains exactly 250 unique tools.",
          },
        ],
        caption: "The generated catalog contains exactly 250 unique tools.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-mcp-at-scale-2",
    Object.assign(
      {
        title: "Select tools under an explicit context budget",
        steps: [
          {
            label: "Input",
            detail: "Rank metadata before sending tools into a context window.",
          },
          {
            label: "Transform",
            detail:
              "Rank metadata before sending tools into a context window. Count the actual compact JSON characters of each selected schema and stop at the explicit budget. This is a character budget, not a model-token estimate; keep the units honest. Stable name ties make discovery reproducible.",
          },
          {
            label: "Verify",
            detail:
              "The query pods count selects pods_count first and never exceeds the serialized budget.",
          },
        ],
        caption:
          "The query pods count selects pods_count first and never exceeds the serialized budget.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-mcp-at-scale-3",
    Object.assign(
      {
        title: "Implement initialized JSON-RPC over stdio",
        steps: [
          {
            label: "Input",
            detail:
              "The protocol has a lifecycle: negotiate a version, receive the initialized notification, then list or call tools.",
          },
          {
            label: "Transform",
            detail:
              "The protocol has a lifecycle: negotiate a version, receive the initialized notification, then list or call tools. Notifications have no response. Separate transport errors from tool execution errors, preserve the request id, and paginate the catalog instead of returning all 250 schemas at once.",
          },
          {
            label: "Verify",
            detail:
              "A call before initialization returns -32002; an initialized tools/list returns 32 tools and a cursor.",
          },
        ],
        caption:
          "A call before initialization returns -32002; an initialized tools/list returns 32 tools and a cursor.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-mcp-at-scale-4",
    Object.assign(
      {
        title: "Audit catalog coverage through protocol pages",
        steps: [
          {
            label: "Input",
            detail: "Treat pagination as a client-visible contract.",
          },
          {
            label: "Transform",
            detail:
              "Treat pagination as a client-visible contract. Traverse every page through the handler and track duplicate names across page boundaries. A finite page guard catches accidental cursor loops. This audit validates the protocol inventory, while the final typed client will exercise the separate operating-system process boundary.",
          },
          {
            label: "Verify",
            detail:
              "An exhaustive traversal returns 250 unique names across 8 pages.",
          },
        ],
        caption:
          "An exhaustive traversal returns 250 unique names across 8 pages.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-mcp-at-scale-5",
    Object.assign(
      {
        title: "Typed stdio boundary",
        steps: [
          {
            label: "Encode",
            detail: "Write newline-delimited requests with unique ids.",
          },
          {
            label: "Process",
            detail:
              "Python handles initialization and tool calls in a separate process.",
          },
          {
            label: "Correlate",
            detail:
              "Parse and validate ids, notifications, timeout and output budgets.",
          },
        ],
        caption: "The Node tests exercise the actual built process boundary.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
