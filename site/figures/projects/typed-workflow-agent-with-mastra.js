(function () {
  "use strict";
  const steps = [
    { label: "Contract", detail: "Validate the input and selected actions." },
    { label: "State", detail: "Keep waiting distinct from failure." },
    { label: "Effect", detail: "Invoke tools only after the required gate." },
  ];
  window.AIFSProjectFigures.register("pj-typed-workflow-agent-with-mastra-1", {
    title: "Types need runtime validation",
    steps,
    caption:
      "This keyword classifier is an inspectable baseline; it is not an authorization system.",
    lab: {
      controls: [
        { key: "id", label: "Ticket ID", type: "text", value: "workshop-42" },
        {
          key: "text",
          label: "Message",
          type: "text",
          value: "Update the workshop equipment label",
        },
      ],
      calculate(v) {
        const valid = v.id.trim() && v.text.trim() && v.text.length <= 10000;
        const intent = /\b(update|delete|change|cancel)\b/i.test(v.text)
          ? "write"
          : "read";
        return {
          summary: valid
            ? "Validated ticket with " + intent + " intent."
            : "Reject malformed ticket before planning.",
          metrics: [
            { label: "Characters", value: v.text.length },
            { label: "Intent", value: valid ? intent : "none" },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-typed-workflow-agent-with-mastra-2", {
    title: "Approval follows the selected tool",
    steps,
    caption:
      "A saved checkpoint cannot disable approval by changing only its flag.",
    lab: {
      controls: [
        {
          key: "tool",
          label: "Selected action",
          type: "select",
          value: "update",
          options: [
            { value: "lookup", label: "lookup" },
            { value: "update", label: "update" },
          ],
        },
        {
          key: "required",
          label: "requiresApproval flag",
          type: "checkbox",
          value: true,
        },
      ],
      calculate(v) {
        const expected = v.tool === "update",
          valid = expected === v.required;
        return {
          summary: valid
            ? "Plan contract is internally consistent."
            : "Reject the edited checkpoint.",
          metrics: [
            { label: "Expected flag", value: String(expected) },
            { label: "Stored flag", value: String(v.required) },
          ],
          rows: [[v.tool, expected ? "review before effects" : "read-only"]],
          columns: ["Action", "Policy"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-typed-workflow-agent-with-mastra-3", {
    title: "Budget failed calls as well as successes",
    steps,
    caption:
      "The scratch runtime suspends before mutation. Retrying a real write still needs idempotency.",
    lab: {
      controls: [
        {
          key: "write",
          label: "Plan contains update",
          type: "checkbox",
          value: true,
        },
        {
          key: "approved",
          label: "Approval supplied",
          type: "checkbox",
          value: false,
        },
        {
          key: "failures",
          label: "Failures before success",
          type: "range",
          value: 1,
          min: 0,
          max: 5,
        },
        {
          key: "budget",
          label: "Shared call budget",
          type: "range",
          value: 3,
          min: 1,
          max: 5,
        },
      ],
      calculate(v) {
        const paused = v.write && !v.approved;
        const calls = paused ? 0 : Math.min(v.failures + 1, 2, v.budget);
        const ok = !paused && v.failures < 2 && v.failures + 1 <= v.budget;
        let summary = "Failed after the attempt or call limit.";
        if (paused) summary = "Suspended before the first tool call.";
        else if (ok) summary = "Complete with a usable result.";
        return {
          summary,
          metrics: [
            { label: "Observed calls", value: calls },
            { label: "Per-action attempts", value: 2 },
          ],
          bars: [{ label: "Consumed calls", value: calls, max: v.budget }],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-typed-workflow-agent-with-mastra-4", {
    title: "Resume the stored plan, not a new request",
    steps,
    caption:
      "The real SDK stores suspension in SQLite. These controls model the approval gate around the restored plan.",
    lab: {
      controls: [
        {
          key: "approved",
          label: "Reviewer approved",
          type: "checkbox",
          value: false,
        },
        {
          key: "ticket",
          label: "Ticket ID matches",
          type: "checkbox",
          value: true,
        },
        {
          key: "digest",
          label: "Plan digest matches",
          type: "checkbox",
          value: true,
        },
        {
          key: "stored",
          label: "Run exists in local store",
          type: "checkbox",
          value: true,
        },
      ],
      calculate(v) {
        let status = "success";
        if (!v.stored) status = "missing run";
        else if (!v.approved) status = "suspended";
        else if (!v.ticket || !v.digest) status = "failed";
        let summary = "Reject recovery or mismatched approval.";
        if (status === "success")
          summary = "Resume execute with the original action and query.";
        else if (status === "suspended")
          summary = "Keep the pending approval and perform no effect.";
        return {
          summary,
          metrics: [
            { label: "SDK result", value: status },
            { label: "Tool calls", value: status === "success" ? 1 : 0 },
          ],
          rows: [
            ["Persistent context", "runId, ticketId, planHash, plan"],
            [
              "Reviewer identity",
              "Must be authenticated by the integrating application",
            ],
          ],
          columns: ["Boundary", "Stored or required data"],
        };
      },
    },
  });
})();
