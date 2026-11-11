(function () {
  "use strict";

  const sampleCalls = [
    { id: "call_001", query: "laptop stand", category: "electronics", limit: 15 },
    { id: "call_002", query: "cotton crewneck", category: "apparel", limit: 5, client_tag: "summer_sale" },
    { id: "call_003", query: "dining table", category: "home", limit: 2 },
    { id: "call_004", query: "distributed systems in rust", limit: 85 },
    { id: "call_005", query: "", limit: 10 }
  ];

  const controls = [
    {
      key: "addRequiredApiKey",
      label: "Add required parameter 'api_key'",
      type: "checkbox",
      value: true
    },
    {
      key: "removeHomeCategory",
      label: "Remove 'home' from category enum",
      type: "checkbox",
      value: true
    },
    {
      key: "narrowLimitMax",
      label: "Maximum allowed 'limit'",
      type: "range",
      value: 50,
      min: 10,
      max: 100,
      step: 10
    },
    {
      key: "closeSchema",
      label: "Reject undeclared properties (additionalProperties: false)",
      type: "checkbox",
      value: true
    },
    {
      key: "strictGate",
      label: "Enforce strict CI compatibility gate",
      type: "checkbox",
      value: true
    }
  ];

  const calculate = function (v) {
    const breakingRules = [];
    if (v.addRequiredApiKey) breakingRules.push("required parameter 'api_key' added");
    if (v.removeHomeCategory) breakingRules.push("category 'home' removed from enum");
    if (v.narrowLimitMax < 100) breakingRules.push("maximum limit lowered to " + v.narrowLimitMax);
    if (v.closeSchema) breakingRules.push("additional properties rejected");

    const counts = { preserved: 0, broken: 0, alreadyInvalid: 0 };
    const rows = sampleCalls.map(function (call) {
      if (!call.query) {
        counts.alreadyInvalid += 1;
        return [call.id, "already invalid", "query shorter than minLength 1"];
      }
      const reasons = [];
      if (v.addRequiredApiKey && !call.api_key) reasons.push("missing required 'api_key'");
      if (v.removeHomeCategory && call.category === "home") reasons.push("category 'home' not in enum");
      if (call.limit > v.narrowLimitMax) reasons.push("limit " + call.limit + " > " + v.narrowLimitMax);
      if (v.closeSchema && call.client_tag) reasons.push("unexpected property 'client_tag'");
      if (reasons.length) {
        counts.broken += 1;
        return [call.id, "broken", reasons.join("; ")];
      }
      counts.preserved += 1;
      return [call.id, "preserved", "valid under both contracts"];
    });

    const validOld = counts.preserved + counts.broken;
    const compatible = breakingRules.length === 0 && counts.broken === 0;
    let gateStatus = "DISABLED";
    let gateDetail = "Without --strict the CLI exits 0 whatever the report says.";
    if (v.strictGate) {
      gateStatus = compatible ? "PASS" : "FAIL";
      gateDetail = compatible ? "Strict gate passes with exit code 0." : "Strict gate fails with exit code 1.";
    }

    const summaryText = compatible
      ? "All " + validOld + " calls that were valid under the old contract still pass."
      : counts.broken + " of " + validOld + " calls that were valid under the old contract now fail, from " + breakingRules.length + " breaking changes. " + counts.alreadyInvalid + " saved call was already invalid and is not replayed as broken.";

    return {
      summary: summaryText + " " + gateDetail,
      metrics: [
        { label: "Saved calls", value: sampleCalls.length },
        { label: "Preserved", value: counts.preserved },
        { label: "Broken", value: counts.broken },
        { label: "Already invalid", value: counts.alreadyInvalid },
        { label: "CI gate", value: gateStatus }
      ],
      bars: [
        { label: "Preserved", value: counts.preserved, max: sampleCalls.length },
        { label: "Broken", value: counts.broken, max: sampleCalls.length },
        { label: "Already invalid", value: counts.alreadyInvalid, max: sampleCalls.length }
      ],
      columns: ["Call", "Outcome", "Reason"],
      rows: rows
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
