window.AIFSProjectFigures.register("pj-plain-language-rewrite-desk-1", {
  title: "Segment prose and record protected terms and facts",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Separate paragraphs while recording the facts later revisions must preserve.",
    },
    {
      label: "Compute",
      detail: "segmentProse(text:string,protectedTerms?:string[]):Paragraph[]",
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
        label: "Protected numeric facts",
        type: "text",
        value: "A map uses 15% and 2 cm.",
      },
    ],
    calculate(v) {
      const n =
        v.text.match(
          /[-+]?\d+(?:[.,]\d+)*(?:%|\s*(?:km|cm|mm|ms|kg|m|s)\b)?/g,
        ) || [];
      return {
        summary: "Keep repeated numeric expressions as separate evidence.",
        columns: ["Numeric expression"],
        rows: n.map((x) => [x]),
        metrics: [{ label: "Recorded facts", value: n.length }],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-plain-language-rewrite-desk-2", {
  title: "Produce simpler candidate paragraphs",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Make the proposal source visible instead of presenting deterministic editing as model reasoning.",
    },
    {
      label: "Compute",
      detail:
        "proposeParagraphs(paragraphs:Paragraph[],recorded?:Record<string,string>):{id,candidate,method}[]",
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
        label: "Original sentence",
        type: "text",
        value: "In order to utilize a map prior to walking.",
      },
    ],
    calculate(v) {
      const out = v.text
        .replace(/\bin order to\b/gi, "to")
        .replace(/\butilize\b/gi, "use")
        .replace(/\bprior to\b/gi, "before");
      return {
        summary: "Visible phrase substitution, not a model claim.",
        columns: ["Original", "Candidate"],
        rows: [[v.text, out]],
        metrics: [
          { label: "Characters removed", value: v.text.length - out.length },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-plain-language-rewrite-desk-3", {
  title: "Compare omissions, numbers and readability measures",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Compare observable editing changes and surface recorded fact violations.",
    },
    {
      label: "Compute",
      detail:
        "measures(text:string):{words,sentences,averageWords,longWords}; compareParagraphs(paragraphs,proposals,definitions?):Comparison[]",
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
      { key: "original", label: "Original percent", type: "number", value: 15 },
      {
        key: "candidate",
        label: "Candidate percent",
        type: "number",
        value: 10,
      },
    ],
    calculate(v) {
      return {
        summary:
          v.original === v.candidate
            ? "Numeric literal preserved."
            : "Block acceptance: numeric fact changed.",
        metrics: [
          { label: "Original", value: v.original + "%" },
          { label: "Candidate", value: v.candidate + "%" },
          { label: "Difference", value: v.candidate - v.original },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-plain-language-rewrite-desk-4", {
  title: "Export accepted revisions and a change record",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Apply only explicitly accepted, fact-checked proposals and retain all other original text.",
    },
    {
      label: "Compute",
      detail:
        "exportRevisions(comparisons,value?):{markdown,changeRecord,decisions,unresolved}; renderDesk(comparisons,state):string",
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
        key: "decision",
        label: "Author decision",
        type: "select",
        value: "pending",
        options: [
          { value: "pending", label: "Pending" },
          { value: "accept", label: "Accept" },
          { value: "reject", label: "Reject" },
        ],
      },
      {
        key: "issue",
        label: "Unresolved fact issue",
        type: "checkbox",
        value: false,
      },
    ],
    calculate(v) {
      return {
        summary:
          v.decision === "accept" && v.issue
            ? "Reject the review file."
            : "Export " +
              (v.decision === "accept" ? "candidate" : "original") +
              " paragraph.",
        metrics: [
          {
            label: "Unresolved review",
            value: v.decision === "pending" ? 1 : 0,
          },
        ],
      };
    },
  },
});
