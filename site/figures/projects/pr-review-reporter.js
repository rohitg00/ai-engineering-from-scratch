(function () {
  "use strict";
  const controls = [
    {
      key: "start",
      label: "New hunk start line",
      type: "range",
      value: 10,
      min: 1,
      max: 100,
      step: 1,
    },
    {
      key: "context",
      label: "Context rows before addition",
      type: "range",
      value: 2,
      min: 0,
      max: 8,
      step: 1,
    },
    {
      key: "removed",
      label: "Deleted rows before addition",
      type: "range",
      value: 3,
      min: 0,
      max: 8,
      step: 1,
    },
    {
      key: "line",
      label: "Added source line",
      type: "text",
      value: "eval(input);",
    },
    {
      key: "quote",
      label: "Reviewer quote",
      type: "text",
      value: "eval(input)",
    },
    {
      key: "comment",
      label: "Line is a comment",
      type: "checkbox",
      value: false,
    },
  ];
  const calculate = function (v, stepIndex) {
    const source = (v.comment ? "// " : "") + v.line,
      anchored = !!v.quote.trim() && source.includes(v.quote),
      detected =
        !/^\s*(?:\/\/|\*|#)/.test(source) && /\beval\s*\(/.test(source);
    return {
      summary: !anchored
        ? "Reject fabricated quote"
        : detected
          ? "Anchored lexical candidate for human review"
          : "No dynamic-eval candidate from this line",
      metrics: [
        { label: "New-file addition line", value: v.start + v.context },
        { label: "Deletions affecting new line", value: 0 },
        { label: "Quote supported", value: anchored },
      ],
      bars: [
        { label: "Old rows consumed", value: v.context + v.removed, max: 16 },
        {
          label: "New rows consumed before addition",
          value: v.context,
          max: 16,
        },
      ],
      columns: ["field", "value"],
      rows: [
        ["location", "src/run.ts:" + (v.start + v.context)],
        ["source", source],
        ["quote", v.quote],
      ],
    };
  };
  window.AIFSProjectFigures.register(
    "pj-pr-review-reporter-1",
    Object.assign(
      {
        title: "Recover new-file line numbers",
        steps: [
          { label: "Input contract", detail: "parseDiff" },
          {
            label: "Recover new-file line numbers",
            detail:
              "Parse hunk headers into old and new counters. Context consumes both counters, deletions consume only the old counter, and additions consume the new counter while producing a reviewable location. Reject truncated hunks and parent-traversing paths. The parser is deliberately for text unified diffs; binary patches and combined merge diffs are outside the contract. Wire Python into TypeScript using execFileSync and stdin, never an interpolated shell command.",
          },
          {
            label: "Observe the result",
            detail:
              "A replacement stays on the new file line even when the old side removes several lines.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-pr-review-reporter-2",
    Object.assign(
      {
        title: "Generate narrow review candidates",
        steps: [
          { label: "Input contract", detail: "inspect" },
          {
            label: "Generate narrow review candidates",
            detail:
              "Build explicit static detectors for dynamic eval, shell exec, disabled TLS validation and empty catch handlers. Inspect only added lines. These patterns produce review candidates rather than proof of exploitable behavior. Keeping rule ids stable makes deduplication possible when a later model reviewer reports the same concern.",
          },
          {
            label: "Observe the result",
            detail:
              "The fixture emits a high-severity eval candidate with an exact quote and new-file line 2.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-pr-review-reporter-3",
    Object.assign(
      {
        title: "Verify and merge findings",
        steps: [
          { label: "Input contract", detail: "verify, merge" },
          {
            label: "Verify and merge findings",
            detail:
              "Require an existing added-line location and a nonempty exact source substring for every candidate. Reject fabricated files, deleted-line locations, empty quotes and invalid severity values. Merge findings by file, line and rule; keep the stronger severity when reviewers disagree. The quote gate establishes location support, not the truth of a security claim, which still needs review.",
          },
          {
            label: "Observe the result",
            detail:
              "Unsupported candidates stay in a rejected collection; duplicate supported candidates collapse into one finding.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-pr-review-reporter-4",
    Object.assign(
      {
        title: "Publish a local escaped report",
        steps: [
          { label: "Input contract", detail: "escapeHTML, render" },
          {
            label: "Publish a local escaped report",
            detail:
              "Render a self-contained report with source locations, quoted evidence, severity and message. Escape source text as carefully as prose: a diff can contain executable HTML. Keep external publication outside the tool. The CLI writes review.html locally and prints a machine-readable summary for automation.",
          },
          {
            label: "Observe the result",
            detail:
              "Open review.html to inspect the anchored finding. The source quote renders as text even when it contains HTML.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
