(function () {
  "use strict";
  const field = (key, label, value) => ({ key, label, type: "text", value });
  const range = (key, label, value, max) => ({
    key,
    label,
    type: "range",
    value,
    min: 0,
    max,
    step: 1,
  });
  function config(title, detail, lab) {
    return {
      title,
      steps: [
        { label: "Read the inputs", detail },
        {
          label: "Compute the result",
          detail:
            "Change a control and inspect the recomputed intermediate state.",
        },
      ],
      caption: detail,
      lab,
    };
  }
  window.AIFSProjectFigures.register(
    "pj-harness-bench-1",
    config(
      "Validate the benchmark cases",
      "Parse editable case JSON before running any policy.",
      {
        controls: [
          field(
            "cases",
            "Case JSON",
            '[{"ID":"expiry","Prompt":"Link lifetime?","Expected":"15 minutes"},{"ID":"restore","Prompt":"Final state?","Expected":"ready"}]',
          ),
          range("limit", "Maximum cases", 3, 6),
        ],
        calculate(v) {
          const cases = JSON.parse(v.cases);
          if (!Array.isArray(cases)) throw new Error("Expected a case array");
          const seen = new Set();
          const rows = cases.map((c) => {
            let status = "accepted";
            if (
              !c ||
              typeof c !== "object" ||
              Object.keys(c).some(
                (k) => !["ID", "Prompt", "Expected", "Evidence"].includes(k),
              )
            )
              status = "unknown field or invalid record";
            else if (
              ["ID", "Prompt", "Expected"].some(
                (k) => typeof c[k] !== "string" || !c[k].trim(),
              )
            )
              status = "missing field";
            else if (
              c.Evidence !== undefined &&
              (!Array.isArray(c.Evidence) ||
                c.Evidence.some((s) => typeof s !== "string"))
            )
              status = "invalid evidence";
            else if (seen.has(c.ID)) status = "duplicate ID";
            seen.add(c?.ID);
            return [c?.ID || "(missing)", status];
          });
          const invalid = rows.filter((r) => r[1] !== "accepted").length;
          const over = cases.length > v.limit;
          return {
            summary: over
              ? "Rejected: case budget exceeded"
              : invalid
                ? "Rejected: repair invalid records"
                : "Typed case set accepted",
            metrics: [
              { label: "Cases", value: cases.length },
              { label: "Invalid records", value: invalid },
            ],
            bars: [
              {
                label: "Cases / limit",
                value: cases.length,
                max: Math.max(1, v.limit, cases.length),
              },
            ],
            columns: ["Case", "Validation"],
            rows,
          };
        },
      },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-harness-bench-2",
    config(
      "Inspect exact-match normalization",
      "Case and whitespace can change; numbers and punctuation stay meaningful.",
      {
        controls: [
          field("actual", "Model answer", " 15   MINUTES "),
          field("expected", "Expected answer", "15 minutes"),
        ],
        calculate(v) {
          const normalize = (s) =>
            s.trim().split(/\s+/u).join(" ").toLowerCase();
          const actual = normalize(v.actual),
            expected = normalize(v.expected);
          const correct = expected !== "" && actual === expected;
          return {
            summary: correct
              ? "Exact answer contract satisfied"
              : "Answer contract failed",
            metrics: [{ label: "Score", value: correct ? 1 : 0 }],
            bars: [{ label: "Correct", value: correct ? 1 : 0, max: 1 }],
            columns: ["Field", "Normalized value"],
            rows: [
              ["actual", actual],
              ["expected", expected],
            ],
          };
        },
      },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-harness-bench-3",
    config(
      "Run a bounded policy",
      "An authored three-case model illustrates actual call accounting. This figure makes no network calls.",
      {
        controls: [
          {
            key: "policy",
            label: "Policy",
            type: "select",
            value: "retry-errors",
            options: ["baseline", "retry-errors", "evidence"].map((value) => ({
              value,
              label: value,
            })),
          },
          range("budget", "Call budget", 4, 6),
          field("stale", "Answer without expiry evidence", "60 minutes"),
        ],
        calculate(v) {
          let calls = 0,
            attempted = 0,
            correct = 0,
            errors = 0,
            state = "completed";
          const cases = [
            { id: "expiry", expected: "15 minutes" },
            { id: "restore", expected: "ready" },
            { id: "price", expected: "unknown" },
          ];
          const rows = [];
          for (const c of cases) {
            if (calls >= v.budget) {
              state = "budget-exhausted";
              break;
            }
            attempted++;
            let failed = false,
              answer = "";
            const attempts = v.policy === "retry-errors" ? 2 : 1;
            for (let attempt = 1; attempt <= attempts; attempt++) {
              if (calls >= v.budget) {
                state = "budget-exhausted";
                break;
              }
              calls++;
              failed =
                c.id === "restore" && attempt === 1 && v.policy !== "evidence";
              answer = c.expected;
              if (c.id === "expiry" && v.policy !== "evidence")
                answer = v.stale;
              rows.push([c.id, attempt, failed ? "provider error" : answer]);
              if (!failed) break;
            }
            if (failed) errors++;
            else if (answer.trim().toLowerCase() === c.expected) correct++;
          }
          return {
            summary: `${state}: ${correct}/3 correct using ${calls} calls`,
            metrics: [
              { label: "Attempted cases", value: attempted },
              { label: "Final errors", value: errors },
            ],
            bars: [
              { label: "Correct / all cases", value: correct, max: 3 },
              {
                label: "Calls / budget",
                value: calls,
                max: Math.max(1, v.budget),
              },
            ],
            columns: ["Case", "Attempt", "Observed response"],
            rows,
          };
        },
      },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-harness-bench-4",
    config(
      "Check comparison receipts",
      "Equal totals are insufficient: compare the complete dataset and model configuration before ranking.",
      {
        controls: [
          field("datasetA", "Dataset receipt A", "orchard-v1-ordered"),
          field("datasetB", "Dataset receipt B", "orchard-v1-ordered"),
          field(
            "modelA",
            "Model config A",
            '{"model":"local","max_tokens":128}',
          ),
          field(
            "modelB",
            "Model config B",
            '{"max_tokens":128,"model":"local"}',
          ),
          range("correctA", "Correct A out of 3", 1, 3),
          range("correctB", "Correct B out of 3", 2, 3),
        ],
        calculate(v) {
          const canonical = (s) => {
            const value = JSON.parse(s);
            if (!value || Array.isArray(value) || typeof value !== "object")
              throw new Error("Model configuration must be an object");
            return JSON.stringify(
              Object.keys(value)
                .sort()
                .map((key) => [key, value[key]]),
            );
          };
          const datasetSame = v.datasetA !== "" && v.datasetA === v.datasetB;
          const modelSame = canonical(v.modelA) === canonical(v.modelB);
          const comparable = datasetSame && modelSame;
          const rows = [
            ["A", v.correctA, 3],
            ["B", v.correctB, 3],
          ];
          if (comparable)
            rows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
          return {
            summary: comparable
              ? `Comparable under the same fixed four-call budget. Leader: ${rows[0][0]}`
              : "Reject comparison: receipt mismatch",
            metrics: [
              { label: "Dataset match", value: datasetSame },
              { label: "Model match", value: modelSame },
            ],
            bars: [
              { label: "A correct", value: v.correctA, max: 3 },
              { label: "B correct", value: v.correctB, max: 3 },
            ],
            columns: ["Run", "Correct", "Total"],
            rows,
          };
        },
      },
    ),
  );
})();
