(function () {
  "use strict";

  const controls = [
    {
      key: "breakingType",
      label: "Schema change type",
      type: "select",
      options: [
        { value: "add_required", label: "Add required parameter" },
        { value: "narrow_enum", label: "Narrow allowed enum values" },
        { value: "narrow_range", label: "Narrow numeric maximum limit" },
        { value: "add_optional", label: "Add optional parameter (Compatible)" }
      ],
      value: "add_required"
    },
    {
      key: "savedCalls",
      label: "Saved agent calls",
      type: "range",
      value: 10,
      min: 1,
      max: 50,
      step: 1
    },
    {
      key: "requireStrict",
      label: "Enforce strict CI compatibility gate",
      type: "checkbox",
      value: true
    }
  ];

  const calculate = function (v, stepIndex) {
    let broken = 0;
    let breaking = true;
    let summary = "";
    if (v.breakingType === "add_required") {
      broken = Math.max(1, Math.round(v.savedCalls * 0.7));
      summary = "Breaking: Newly required parameter breaks " + broken + " of " + v.savedCalls + " historical calls.";
    } else if (v.breakingType === "narrow_enum") {
      broken = Math.max(1, Math.round(v.savedCalls * 0.3));
      summary = "Breaking: Narrowed enum values invalidate " + broken + " saved calls.";
    } else if (v.breakingType === "narrow_range") {
      broken = Math.max(1, Math.round(v.savedCalls * 0.4));
      summary = "Breaking: Stricter numeric maximum rejects " + broken + " calls.";
    } else {
      broken = 0;
      breaking = false;
      summary = "Compatible: Adding optional parameters preserves 100% of historical calls.";
    }

    const gatePass = !breaking || !v.requireStrict;
    return {
      summary: summary + (gatePass ? " CI Gate PASSED." : " CI Gate FAILED (exit code 1)."),
      metrics: [
        { label: "Saved Calls", value: v.savedCalls },
        { label: "Broken Calls", value: broken },
        { label: "Gate Status", value: gatePass ? "PASS" : "FAIL" }
      ],
      bars: [
        { label: "Preserved Calls", value: v.savedCalls - broken, max: v.savedCalls },
        { label: "Broken Calls", value: broken, max: v.savedCalls }
      ]
    };
  };

  const steps1 = [
    { label: "Input contracts", detail: "load_contract, validate_call" },
    { label: "Validate contracts & calls", detail: "Parse schema dictionaries and ensure saved calls conform to the base specification." },
    { label: "Observe outcome", detail: "Malformed schemas and invalid historical payloads are rejected before diffing." }
  ];

  const steps2 = [
    { label: "Contract comparison", detail: "classify_changes" },
    { label: "Classify changes", detail: "Differentiate between breaking changes (added required, narrowed types/enums) and compatible extensions." },
    { label: "Observe outcome", detail: "Structured change classification tagged with severity and affected property paths." }
  ];

  const steps3 = [
    { label: "Generative testing", detail: "generate_counterexamples, replay_calls" },
    { label: "Synthesize counterexamples", detail: "Produce minimal payloads that satisfy old contract but fail new contract, and replay saved calls." },
    { label: "Observe outcome", detail: "Concrete breaking fixtures and exact historical failure rate." }
  ];

  const steps4 = [
    { label: "CI gate & export", detail: "build_report, export_fixtures, cli" },
    { label: "Generate CI report", detail: "Emit machine-readable JSON migration reports and exit with status 0 or 1 based on compatibility." },
    { label: "Observe outcome", detail: "Prevents breaking schema migrations from deploying without explicit migration adapters." }
  ];

  window.AIFSProjectFigures.register("pj-tool-contract-migration-checker-1", {
    title: "Load versioned tool contracts and saved calls",
    steps: steps1,
    caption: "Validate contracts and historical calls before diffing.",
    lab: { controls, calculate }
  });

  window.AIFSProjectFigures.register("pj-tool-contract-migration-checker-2", {
    title: "Classify supported schema changes",
    steps: steps2,
    caption: "Classify breaking vs compatible schema modifications.",
    lab: { controls, calculate }
  });

  window.AIFSProjectFigures.register("pj-tool-contract-migration-checker-3", {
    title: "Generate and replay breaking-call counterexamples",
    steps: steps3,
    caption: "Synthesize counterexamples and replay historical traces.",
    lab: { controls, calculate }
  });

  window.AIFSProjectFigures.register("pj-tool-contract-migration-checker-4", {
    title: "Export migration fixtures and a compatibility gate",
    steps: steps4,
    caption: "Automate migration checks inside CI pipelines.",
    lab: { controls, calculate }
  });
})();
