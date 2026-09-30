(function () {
  "use strict";
  const controls = [
    {
      key: "reads",
      label: "Requested repeated read actions",
      type: "range",
      value: 3,
      min: 1,
      max: 10,
      step: 1,
    },
    {
      key: "steps",
      label: "Step budget",
      type: "range",
      value: 5,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      key: "bytes",
      label: "Serialized result characters",
      type: "range",
      value: 60,
      min: 1,
      max: 500,
      step: 1,
    },
    {
      key: "budget",
      label: "Context character budget",
      type: "range",
      value: 180,
      min: 0,
      max: 2000,
      step: 1,
    },
    {
      key: "failures",
      label: "Timeouts before success",
      type: "range",
      value: 1,
      min: 0,
      max: 4,
      step: 1,
    },
    {
      key: "retries",
      label: "Retry allowance",
      type: "range",
      value: 2,
      min: 0,
      max: 3,
      step: 1,
    },
    {
      key: "scope",
      label: "Resource outside scope",
      type: "checkbox",
      value: false,
    },
  ];
  const calculate = function (v, stepIndex) {
    const retained = Math.min(v.reads, v.steps, Math.floor(v.budget / v.bytes)),
      success = v.failures <= v.retries;
    const calls =
      v.scope || v.steps === 0 ? 0 : Math.min(v.failures + 1, v.retries + 1);
    return {
      summary: v.scope
        ? "Reject plan before provider"
        : !success
          ? "Timeout retries exhausted"
          : retained < v.reads
            ? "Partial retained results: budget exhausted"
            : "Completed with request-local cache",
      metrics: [
        { label: "Provider calls", value: calls },
        { label: "Cache hits", value: success ? Math.max(0, retained - 1) : 0 },
      ],
      bars: [
        {
          label: "Retained results",
          value: success && !v.scope ? retained : 0,
          max: v.reads,
        },
        {
          label: "Retained characters",
          value: success && !v.scope ? retained * v.bytes : 0,
          max: v.budget || 1,
        },
      ],
    };
  };
  window.AIFSProjectFigures.register(
    "pj-cloud-agent-with-aws-strands-1",
    Object.assign(
      {
        title: "Validate a scoped cloud inspection plan",
        steps: [
          {
            label: "Input",
            detail:
              "The model proposes intent; a deterministic validator grants authority.",
          },
          {
            label: "Transform",
            detail:
              "The model proposes intent; a deterministic validator grants authority. Accept only explicitly named read operations and resource ids from the caller scope. Reject unknown keys and oversized plans so additional model-generated instructions cannot silently become executable parameters.",
          },
          {
            label: "Verify",
            detail:
              "A delete operation or an out-of-scope resource fails before any provider call.",
          },
        ],
        caption:
          "A delete operation or an out-of-scope resource fails before any provider call.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-cloud-agent-with-aws-strands-2",
    Object.assign(
      {
        title: "Execute reads within step and response budgets",
        steps: [
          {
            label: "Input",
            detail:
              "Charge steps before starting an operation and charge serialized output before retaining it.",
          },
          {
            label: "Transform",
            detail:
              "Charge steps before starting an operation and charge serialized output before retaining it. Output limits cannot undo the cost of a call, but they prevent a large result from flooding later context. Keep partial results and an explicit terminal state so a budget stop remains diagnosable.",
          },
          {
            label: "Verify",
            detail:
              "A zero-step budget performs no provider calls and returns budget_exhausted.",
          },
        ],
        caption:
          "A zero-step budget performs no provider calls and returns budget_exhausted.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-cloud-agent-with-aws-strands-3",
    Object.assign(
      {
        title: "Retry transient reads and reuse completed requests",
        steps: [
          {
            label: "Input",
            detail:
              "Retry only transient timeout failures and cache successful reads by a canonical action identity.",
          },
          {
            label: "Transform",
            detail:
              "Retry only transient timeout failures and cache successful reads by a canonical action identity. A permission failure is not transient and must escape immediately. This cache is request-local: real cloud state changes, so a long-lived cache needs an explicit TTL or version instead of silently reusing old data.",
          },
          {
            label: "Verify",
            detail:
              "A transient timeout retries, while a permission failure is propagated after one call.",
          },
        ],
        caption:
          "A transient timeout retries, while a permission failure is propagated after one call.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-cloud-agent-with-aws-strands-4",
    Object.assign(
      {
        title: "Drive the actual Strands loop with a local model",
        steps: [
          {
            label: "Input",
            detail:
              "The real Strands Agent consumes streaming events from an injected Model subclass.",
          },
          {
            label: "Transform",
            detail:
              "The real Strands Agent consumes streaming events from an injected Model subclass. This exercises the framework loop without credentials or cloud calls. The model still only proposes a plan; parse and scope-check its result with the earlier validator. A separate Bedrock constructor is explicit and is not invoked by offline demos or tests.",
          },
          {
            label: "Verify",
            detail:
              "The framework produces one recorded JSON plan in one model call, then the independent validator checks it.",
          },
        ],
        caption:
          "The framework produces one recorded JSON plan in one model call, then the independent validator checks it.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
