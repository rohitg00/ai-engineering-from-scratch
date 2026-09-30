(function () {
  "use strict";
  const steps = [
    { label: "Input", detail: "Inspect original message data." },
    { label: "Rule", detail: "Apply an explicit contract." },
    { label: "Evidence", detail: "Keep the result inspectable." },
  ];
  window.AIFSProjectFigures.register("pj-inbox-triage-desk-1", {
    title: "What survives email parsing?",
    steps,
    caption:
      "Edit the plain-text message fields. MIME decoding is implemented in Python; this lab inspects the resulting record.",
    lab: {
      controls: [
        {
          key: "sender",
          label: "Sender address",
          type: "text",
          value: "mira@example.invalid",
        },
        {
          key: "body",
          label: "Plain-text body",
          type: "text",
          value: "Could you print six table labels?",
        },
        {
          key: "hasId",
          label: "Message has an ID",
          type: "checkbox",
          value: true,
        },
      ],
      calculate(v) {
        const valid = /^[^\s@]+@[^\s@]+$/.test(v.sender);
        return {
          summary: valid
            ? "Preserve the body beside its message identity."
            : "Reject the record before classifying it.",
          metrics: [
            {
              label: "Body bytes",
              value: new TextEncoder().encode(v.body).length,
            },
            {
              label: "Identity",
              value: v.hasId
                ? "Provided Message-ID"
                : "Digest fallback required",
            },
          ],
          rows: [
            ["sender", v.sender],
            ["text", v.body],
            ["body_status", v.body.trim() ? "plain" : "no-plain-body"],
          ],
          columns: ["Field", "Parsed value"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-inbox-triage-desk-2", {
    title: "A rule match is evidence, not certainty",
    steps,
    caption:
      "Conflicting categories become uncertain. Change the message and inspect the exact phrases.",
    lab: {
      controls: [
        {
          key: "text",
          label: "Message body",
          type: "text",
          value: "Please confirm. For your information, the room changed.",
        },
      ],
      calculate(v) {
        const rules = {
          action: ["please", "can you", "could you", "confirm"],
          information: ["for your information", "newsletter", "receipt"],
        };
        const hits = [];
        for (const [category, phrases] of Object.entries(rules))
          for (const phrase of phrases) {
            const match = new RegExp("(?<!\\w)" + phrase + "(?!\\w)", "i").exec(
              v.text,
            );
            if (match) hits.push([category, match[0], String(match.index)]);
          }
        const categories = new Set(hits.map((h) => h[0]));
        const category =
          categories.size === 1 ? [...categories][0] : "uncertain";
        return {
          summary:
            category + " queue; every classification still needs review.",
          metrics: [
            { label: "Matched categories", value: categories.size },
            {
              label: "Priority",
              value: { action: 0, uncertain: 1, information: 2 }[category],
            },
          ],
          rows: hits.length ? hits : [["uncertain", "No phrase matched", ""]],
          columns: ["Category", "Source quote", "Start offset"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-inbox-triage-desk-3", {
    title: "Validate the quote before drafting",
    steps,
    caption:
      "A draft leaves the commitment for a person to write. An invented quote stops the proposal.",
    lab: {
      controls: [
        {
          key: "source",
          label: "Source body",
          type: "text",
          value: "Please bring two folding chairs.",
        },
        {
          key: "quote",
          label: "Proposed evidence quote",
          type: "text",
          value: "two folding chairs",
        },
        {
          key: "sameMessage",
          label: "Decision has matching message ID",
          type: "checkbox",
          value: true,
        },
      ],
      calculate(v) {
        const found = v.quote.length > 0 && v.source.includes(v.quote);
        const valid = found && v.sameMessage;
        return {
          summary: valid
            ? "Build an unsent draft with an editable response placeholder."
            : "Reject the decision; identity and exact evidence must both match.",
          metrics: [
            { label: "Quote found", value: found ? "yes" : "no" },
            { label: "Messages sent", value: 0 },
          ],
          rows: [
            ["Source", v.source],
            ["Draft response", "[Write and check your response here.]"],
          ],
          columns: ["Record", "Text"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-inbox-triage-desk-4", {
    title: "Build the review queue",
    steps,
    caption:
      "Counts change the queue and draft total. Categories remain separate from thread identity.",
    lab: {
      controls: [
        {
          key: "action",
          label: "Action messages",
          type: "range",
          value: 3,
          min: 0,
          max: 20,
        },
        {
          key: "uncertain",
          label: "Uncertain messages",
          type: "range",
          value: 2,
          min: 0,
          max: 20,
        },
        {
          key: "information",
          label: "Information messages",
          type: "range",
          value: 5,
          min: 0,
          max: 20,
        },
      ],
      calculate(v) {
        const rows = ["action", "uncertain", "information"].map((key, i) => [
          String(i),
          key,
          String(v[key]),
        ]);
        const count = v.action + v.uncertain + v.information;
        return {
          summary: `Export ${count} review entries and ${count} unsent drafts.`,
          metrics: [
            { label: "Draft files", value: count },
            { label: "Messages sent", value: 0 },
          ],
          bars: rows.map((r) => ({
            label: r[1],
            value: Number(r[2]),
            max: 20,
          })),
          rows,
          columns: ["Priority", "Category", "Messages"],
        };
      },
    },
  });
})();
