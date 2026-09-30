(function () {
  "use strict";
  const steps = [
    { label: "Validate", detail: "Apply the shared deterministic boundary." },
    { label: "Choose", detail: "Keep route and capability separate." },
    {
      label: "Retain",
      detail: "Store inspectable evidence and response state.",
    },
  ];
  window.AIFSProjectFigures.register("pj-support-agent-with-google-adk-1", {
    title: "Redact before any model request",
    steps,
    caption:
      "The two documented patterns are a limited example, not a complete privacy filter.",
    lab: {
      controls: [
        {
          key: "text",
          label: "Ticket text",
          type: "text",
          value: "invoice for learner@example.invalid api_key=EXAMPLE_VALUE",
        },
      ],
      calculate(v) {
        const clean = v.text
          .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
          .replace(/(api[_ -]?key\s*[:=]\s*)\S+/gi, "$1[redacted]");
        const valid = v.text.trim() && v.text.length <= 10000;
        return {
          summary: valid
            ? "Only the cleaned text may enter the session."
            : "Reject the ticket.",
          metrics: [
            { label: "Input characters", value: v.text.length },
            {
              label: "Changed by filter",
              value: clean === v.text ? "no" : "yes",
            },
          ],
          rows: [["Cleaned ticket", clean]],
          columns: ["Boundary", "Text"],
        };
      },
    },
  });
  const routes = {
    billing: ["invoice", "refund", "payment"],
    access: ["password", "login", "account"],
    platform: ["outage", "latency", "error"],
  };
  const tools = {
    billing: "read_invoice",
    access: "read_account",
    platform: "read_status",
  };
  function route(text) {
    const words = new Set(text.toLowerCase().match(/\w+/g) || []),
      scores = Object.entries(routes)
        .map(([key, terms]) => [key, terms.filter((t) => words.has(t)).length])
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      scores,
      selected:
        !scores[0][1] || scores[0][1] === scores[1][1] ? "human" : scores[0][0],
    };
  }
  window.AIFSProjectFigures.register("pj-support-agent-with-google-adk-2", {
    title: "Separate a routing score from permission",
    steps,
    caption:
      "Ties escalate. A valid specialist cannot use another specialist’s tool.",
    lab: {
      controls: [
        {
          key: "text",
          label: "Ticket text",
          type: "text",
          value: "invoice login",
        },
        {
          key: "tool",
          label: "Requested capability",
          type: "select",
          value: "read_invoice",
          options: Object.values(tools).map((value) => ({
            value,
            label: value,
          })),
        },
      ],
      calculate(v) {
        const r = route(v.text),
          allowed = tools[r.selected] === v.tool;
        let summary = "Reject the requested capability.";
        if (r.selected === "human")
          summary = "Escalate before a model or read capability runs.";
        else if (allowed) summary = "Authorize " + v.tool;
        return {
          summary,
          metrics: [
            { label: "Route", value: r.selected },
            { label: "Allowed", value: allowed ? "yes" : "no" },
          ],
          bars: r.scores.map(([label, value]) => ({ label, value, max: 3 })),
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-support-agent-with-google-adk-3", {
    title: "A response must survive the transition",
    steps,
    caption:
      "Terminal states cannot accept another event. Human routing permits escalation, not an automatic answer.",
    lab: {
      controls: [
        {
          key: "state",
          label: "Current state",
          type: "select",
          value: "routed",
          options: ["received", "routed", "answered", "escalated"].map(
            (value) => ({ value, label: value }),
          ),
        },
        {
          key: "event",
          label: "Event",
          type: "select",
          value: "respond",
          options: ["classify", "respond", "escalate"].map((value) => ({
            value,
            label: value,
          })),
        },
        { key: "human", label: "Human route", type: "checkbox", value: false },
        {
          key: "text",
          label: "Reply text",
          type: "text",
          value: "Use the receipt invoice reference.",
        },
      ],
      calculate(v) {
        const next = {
          received: { classify: "routed" },
          routed: { respond: "answered", escalate: "escalated" },
        }[v.state]?.[v.event];
        const valid =
          next && !(v.event === "respond" && (v.human || !v.text.trim()));
        return {
          summary: valid
            ? "Transition to " + next
            : "Reject the transition and preserve prior state.",
          metrics: [{ label: "Next state", value: valid ? next : v.state }],
          rows: [
            [
              "Retained response",
              valid && v.event === "respond" ? v.text.trim() : "none",
            ],
          ],
          columns: ["Session field", "Value"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-support-agent-with-google-adk-4", {
    title: "Apply the same gate before ADK",
    steps,
    caption:
      "Real SDK tests establish graph behavior. A deterministic fixture model is labeled; it does not establish language-model quality.",
    lab: {
      controls: [
        {
          key: "text",
          label: "Ticket topic",
          type: "text",
          value: "account login",
        },
        {
          key: "proposed",
          label: "Model-proposed route",
          type: "select",
          value: "access",
          options: ["billing", "access", "platform"].map((value) => ({
            value,
            label: value,
          })),
        },
      ],
      calculate(v) {
        const r = route(v.text);
        const valid = r.selected !== "human" && r.selected === v.proposed;
        let summary = "Reject the route override before running ADK.";
        if (r.selected === "human")
          summary = "Human escalation: no ADK model calls.";
        else if (valid)
          summary =
            "Run triage and specialist on cleaned text and authorized guidance.";
        return {
          summary,
          metrics: [
            { label: "Allowed route", value: r.selected },
            { label: "Model calls", value: valid ? 2 : 0 },
          ],
          rows: [
            ["Read capability", valid ? tools[r.selected] : "none"],
            [
              "Reply state",
              valid ? "answered with retained draft" : "no automatic answer",
            ],
          ],
          columns: ["Gate result", "Value"],
        };
      },
    },
  });
})();
