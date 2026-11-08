window.AIFSProjectFigures.register("pj-ui-string-localization-workbench-1", {
  title: "Read message keys, placeholders and context",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Record stable keys and exact interpolation contracts before translation.",
    },
    {
      label: "Compute",
      detail:
        "placeholders(text:string):string[]; readCatalog(value:unknown):Message[]",
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
        label: "Message template",
        type: "text",
        value: "{count} of {count} tools",
      },
    ],
    calculate(v) {
      const p = v.text.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
      return {
        summary: "Multiplicity is part of the contract.",
        columns: ["Placeholder"],
        rows: p.sort().map((x) => [x]),
        metrics: [{ label: "Occurrences", value: p.length }],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-ui-string-localization-workbench-2", {
  title: "Generate bounded translation proposals",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Bound recorded translation proposals and report contract problems before review.",
    },
    {
      label: "Compute",
      detail:
        "proposeTranslations(messages:Message[],recorded:unknown,locale:string):Proposal[]",
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
        key: "source",
        label: "Source template",
        type: "text",
        value: "{count} tools",
      },
      {
        key: "proposal",
        label: "Proposed translation",
        type: "text",
        value: "Herramientas",
      },
    ],
    calculate(v) {
      const p = (s) => (s.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || []).sort(),
        a = p(v.source),
        b = p(v.proposal);
      return {
        summary:
          JSON.stringify(a) === JSON.stringify(b)
            ? "Placeholder contract preserved."
            : "Block approval: placeholder multiset changed.",
        columns: ["Source", "Proposal"],
        rows: [[JSON.stringify(a), JSON.stringify(b)]],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-ui-string-localization-workbench-3", {
  title: "Preview strings with supplied interpolation values",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Render interpolation as text so reviewers can see real layout content.",
    },
    {
      label: "Compute",
      detail:
        "previewMessage(template:string,values:Record<string,string|number>):string",
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
      { key: "name", label: "Member name", type: "text", value: "Lina" },
      {
        key: "count",
        label: "Selected tools",
        type: "range",
        value: 3,
        min: 0,
        max: 20,
        step: 1,
      },
    ],
    calculate(v) {
      return {
        summary: "Variables render as text in the preview.",
        columns: ["Message", "Preview"],
        rows: [
          ["Greeting", "Hola, " + v.name],
          ["Count", v.count + " herramientas"],
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-ui-string-localization-workbench-4", {
  title: "Export approved locale and unresolved questions",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Export only explicitly approved translations with their context checks.",
    },
    {
      label: "Compute",
      detail:
        "reviewTranslations(messages,proposals,value?):{catalog,unresolved,review}; renderWorkbench(messages,proposals,state,locale,values?):string",
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
        key: "approve",
        label: "Approve translation",
        type: "checkbox",
        value: true,
      },
      {
        key: "ack",
        label: "Acknowledge ambiguous context",
        type: "checkbox",
        value: false,
      },
    ],
    calculate(v) {
      const accepted = v.approve && v.ack;
      return {
        summary: accepted ? "Export this key." : "Keep this key unresolved.",
        metrics: [
          { label: "Approved keys", value: accepted ? 1 : 0 },
          { label: "Unresolved keys", value: accepted ? 0 : 1 },
        ],
      };
    },
  },
});
