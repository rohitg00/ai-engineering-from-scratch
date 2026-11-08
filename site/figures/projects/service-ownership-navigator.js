window.AIFSProjectFigures.register("pj-service-ownership-navigator-1", {
  title: "Load service metadata and ownership rules",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Keep source positions while combining service metadata and repository rules.",
    },
    {
      label: "Compute",
      detail:
        "parseOwnershipRules(text:string,source?:string):Rule[]; loadCatalog(value:unknown):Catalog",
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
        key: "line",
        label: "Ownership rule",
        type: "text",
        value: "/services/images/ @team/media @team/oncall",
      },
    ],
    calculate(v) {
      const p = v.line.trim().split(/\s+/);
      return {
        summary: "Retain the rule separately from catalog ownership.",
        columns: ["Pattern", "Owners"],
        rows: [[p[0], p.slice(1).join(", ")]],
        metrics: [{ label: "Owner count", value: Math.max(0, p.length - 1) }],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-service-ownership-navigator-2", {
  title: "Resolve paths and conflicting ownership evidence",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Resolve a concrete file using deterministic rule precedence and expose disagreement.",
    },
    {
      label: "Compute",
      detail:
        "matchesRule(pattern:string,path:string):boolean; resolveOwnership(catalog:Catalog,path:string):Ownership",
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
        key: "specific",
        label: "Specific cache rule present",
        type: "checkbox",
        value: true,
      },
    ],
    calculate(v) {
      return {
        summary:
          "Last matching rule wins; earlier disagreement remains evidence.",
        columns: ["Rule", "Owners", "Effective"],
        rows: [
          ["/services/", "@platform", "no"],
          ["/services/images/", "@media", v.specific ? "no" : "yes"],
          ...(v.specific
            ? [["/services/images/cache/**", "@cache", "yes"]]
            : []),
        ],
        metrics: [{ label: "Matching rules", value: v.specific ? 3 : 2 }],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-service-ownership-navigator-3", {
  title: "Check local runbook references",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Check that a handoff points to a supplied runbook and resolvable local references.",
    },
    {
      label: "Compute",
      detail:
        "checkRunbook(catalog:Catalog,service:Service):{path,exists,headings,links,issues}",
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
        key: "linked",
        label: "Local links declared",
        type: "range",
        value: 4,
        min: 0,
        max: 10,
        step: 1,
      },
      {
        key: "available",
        label: "Linked files available",
        type: "range",
        value: 3,
        min: 0,
        max: 10,
        step: 1,
      },
    ],
    calculate(v) {
      return {
        summary: "Only supplied local files count as checked evidence.",
        metrics: [
          { label: "Resolved", value: Math.min(v.linked, v.available) },
          { label: "Missing", value: Math.max(0, v.linked - v.available) },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-service-ownership-navigator-4", {
  title: "Export a searchable directory and cited handoff packet",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Export a local handoff with every ownership answer linked to evidence.",
    },
    {
      label: "Compute",
      detail:
        "handoffPacket(catalog:Catalog,path:string):{schemaVersion:1,ownership,runbook,dependencies}; renderDirectory(catalog,packet):string",
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
        key: "path",
        label: "Requested file",
        type: "text",
        value: "services/images/cache/store.ts",
      },
    ],
    calculate(v) {
      const found =
        v.path === "services/images" || v.path.startsWith("services/images/");
      return {
        summary: found
          ? "Include image-service catalog evidence."
          : "No image-service root match.",
        columns: ["Lookup field", "Value"],
        rows: [
          ["Path", v.path],
          ["Service", found ? "images" : "unresolved"],
          ["Evidence source", found ? "catalog.json" : "none"],
        ],
      };
    },
  },
});
