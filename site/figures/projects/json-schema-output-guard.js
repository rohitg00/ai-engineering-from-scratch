(function () {
  "use strict";
  const controls = [
    {
      key: "raw",
      label: "Raw model response",
      type: "text",
      value: '{"answer":"retry","confidence":1.5}',
    },
    {
      key: "maximum",
      label: "Maximum confidence",
      type: "range",
      value: 1,
      min: 0,
      max: 2,
      step: 0.1,
    },
    {
      key: "attempts",
      label: "Attempt budget",
      type: "range",
      value: 2,
      min: 1,
      max: 5,
      step: 1,
    },
    {
      key: "keyword",
      label: "Unused optional schema contains unsupported $ref",
      type: "checkbox",
      value: false,
    },
  ];
  const calculate = function (v, stepIndex) {
    let obj;
    try {
      obj = JSON.parse(v.raw);
    } catch (e) {
      return {
        summary: "Parse failure: " + e.message,
        metrics: [
          {
            label: "UTF-8 bytes",
            value: new TextEncoder().encode(v.raw).length,
          },
        ],
        bars: [],
      };
    }
    if (v.keyword)
      return {
        summary:
          "Configuration error: reject $ref even when optional value is absent",
        metrics: [],
        bars: [],
      };
    const issues = [];
    if (!obj || Array.isArray(obj) || typeof obj !== "object")
      issues.push("$/ expected object");
    else {
      if (typeof obj.answer !== "string" || !obj.answer.length)
        issues.push("$/answer nonempty string required");
      if (
        typeof obj.confidence !== "number" ||
        obj.confidence < 0 ||
        obj.confidence > v.maximum
      )
        issues.push("$/confidence outside allowed range");
      for (const key of Object.keys(obj))
        if (!["answer", "confidence"].includes(key))
          issues.push("$/" + key + " unknown property");
    }
    return {
      summary: issues.length
        ? "Rejected; feed these issues to the next bounded attempt"
        : "Accepted structured output",
      metrics: [
        { label: "Issue count", value: issues.length },
        {
          label: "Retry calls remaining after this response",
          value: issues.length ? v.attempts - 1 : 0,
        },
      ],
      bars: [
        {
          label: "Confidence",
          value:
            typeof obj?.confidence === "number"
              ? Math.max(0, obj.confidence)
              : 0,
          max: 2,
        },
      ],
      columns: ["issue path and reason"],
      rows: issues.map((x) => [x]),
    };
  };
  window.AIFSProjectFigures.register(
    "pj-json-schema-output-guard-1",
    Object.assign(
      {
        title: "Parse the untrusted boundary",
        steps: [
          { label: "Input contract", detail: "parseJSON" },
          {
            label: "Parse the untrusted boundary",
            detail:
              "A model response is a byte string. Parse the entire string as JSON, reject markdown wrappers and trailing text, and cap its UTF-8 byte size before parsing. Accept JSON primitives as well as objects: the schema, not the parser, determines whether a primitive is useful. Do not remove text until it happens to parse because that hides the actual output contract.",
          },
          {
            label: "Observe the result",
            detail:
              "The parser returns a value for valid JSON and throws for trailing instructions or an oversized response.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-json-schema-output-guard-2",
    Object.assign(
      {
        title: "Walk a schema recursively",
        steps: [
          { label: "Input contract", detail: "validate" },
          {
            label: "Walk a schema recursively",
            detail:
              "Implement object, array and primitive validation. Required properties are checked with own-property semantics. An inherited property does not satisfy the contract. Treat integer as a refinement of number, reject non-finite numbers, and preserve a path for every failure. Bound recursive descent at depth 32 so a schema and value cannot consume the stack indefinitely.",
          },
          {
            label: "Observe the result",
            detail:
              "A nested wrong type produces a path such as `$/a/0`; the caller can ask for a targeted correction.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-json-schema-output-guard-3",
    Object.assign(
      {
        title: "Reject ambiguous and unsupported contracts",
        steps: [
          { label: "Input contract", detail: "validate, guard" },
          {
            label: "Reject ambiguous and unsupported contracts",
            detail:
              "Add numeric bounds, enum membership, minimum Unicode string length, array bounds, and closed objects. Escape slash and tilde inside property paths. A keyword outside this educational subset is a configuration error, not silent success. This implementation intentionally does not claim complete JSON Schema conformance: references, formats and combinators require additional work.",
          },
          {
            label: "Observe the result",
            detail:
              "The guard returns structured issues for invalid output while unsupported schema features throw a configuration error.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-json-schema-output-guard-4",
    Object.assign(
      {
        title: "Repair with a finite budget",
        steps: [
          { label: "Input contract", detail: "repair" },
          {
            label: "Repair with a finite budget",
            detail:
              "Feed only structured validation feedback into a generation callback. Count each call before interpreting its output. Stop immediately after acceptance and return an explicit exhausted state after the final rejected attempt. Provider failures propagate instead of being disguised as schema failures. The trace records each attempt so a successful third response does not conceal two earlier contract violations.",
          },
          {
            label: "Observe the result",
            detail:
              "The demo rejects confidence 1.5, passes an above-maximum issue to the next attempt, then accepts confidence 0.9.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
