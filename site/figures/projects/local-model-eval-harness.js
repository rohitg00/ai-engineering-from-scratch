(function () {
  "use strict";
  const controls = [
    {
      key: "total",
      label: "Labeled cases",
      type: "range",
      value: 10,
      min: 1,
      max: 30,
      step: 1,
    },
    {
      key: "answered",
      label: "Recorded predictions",
      type: "range",
      value: 8,
      min: 0,
      max: 30,
      step: 1,
    },
    {
      key: "hits",
      label: "Correct predictions",
      type: "range",
      value: 6,
      min: 0,
      max: 30,
      step: 1,
    },
    {
      key: "confidence",
      label: "Shared reported confidence",
      type: "range",
      value: 0.9,
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      key: "latencies",
      label: "Latency milliseconds",
      type: "text",
      value: "80,100,120,300,900",
    },
  ];
  const calculate = function (v, stepIndex) {
    if (v.answered > v.total || v.hits > v.answered)
      return {
        summary: "Reject impossible prediction counts",
        metrics: [],
        bars: [],
      };
    const latency = v.latencies
      .split(",")
      .map(Number)
      .sort((a, b) => a - b);
    if (latency.some((n) => !Number.isFinite(n) || n < 0))
      return { summary: "Reject invalid latency", metrics: [], bars: [] };
    const accuracy = v.hits / v.total,
      coverage = v.answered / v.total,
      ece = v.answered ? Math.abs(v.confidence - v.hits / v.answered) : 0;
    return {
      summary:
        "Missing predictions stay in the accuracy denominator. Confidence is self-report.",
      metrics: [
        { label: "Accuracy", value: accuracy.toFixed(3) },
        { label: "Coverage", value: coverage.toFixed(3) },
        { label: "One-bin ECE", value: ece.toFixed(3) },
        {
          label: "Nearest-rank p95 ms",
          value: latency[Math.ceil(latency.length * 0.95) - 1],
        },
      ],
      bars: [
        { label: "Correct", value: v.hits, max: v.total },
        { label: "Incorrect", value: v.answered - v.hits, max: v.total },
        { label: "Unanswered", value: v.total - v.answered, max: v.total },
      ],
    };
  };
  window.AIFSProjectFigures.register(
    "pj-local-model-eval-harness-1",
    Object.assign(
      {
        title: "Validate prediction records",
        steps: [
          {
            label: "Record",
            detail: "Keep answer, confidence, and latency together.",
          },
          { label: "Validate", detail: "Reject nonfinite or invalid fields." },
          { label: "Align", detail: "Use stable ids to join labels." },
        ],
        caption:
          "Validate unique ids, string answers, confidence in [0,1], and nonnegative latency_ms..",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-local-model-eval-harness-2",
    Object.assign(
      {
        title: "Measure normalized exact-answer accuracy",
        steps: [
          { label: "Join", detail: "Match predictions to label ids." },
          { label: "Compare", detail: "Normalize case and whitespace only." },
          {
            label: "Denominator",
            detail: "Include unanswered labels as misses.",
          },
        ],
        caption:
          "Return correct, total, accuracy, and coverage against a complete label mapping..",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-local-model-eval-harness-3",
    Object.assign(
      {
        title: "Measure confidence calibration",
        steps: [
          {
            label: "Bin",
            detail: "Group confidence values in fixed-width bins.",
          },
          {
            label: "Compare",
            detail: "Mean confidence versus observed correctness.",
          },
          { label: "Weight", detail: "Average gaps by sample count." },
        ],
        caption:
          "Compute fixed-width bin ECE weighted by bin count, retaining per-bin evidence..",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-local-model-eval-harness-4",
    Object.assign(
      {
        title: "Publish accuracy and latency together",
        steps: [
          {
            label: "Quality",
            detail: "Compute accuracy and confidence calibration.",
          },
          {
            label: "Latency",
            detail: "Sort finite measurements for nearest ranks.",
          },
          { label: "Report", detail: "Keep provenance beside the scorecard." },
        ],
        caption:
          "Combine metrics with nearest-rank latency percentiles and a measurement-source label..",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
