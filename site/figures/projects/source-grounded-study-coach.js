(function () {
  "use strict";
  const steps = [
    {
      label: "Source",
      detail: "Keep the passage and authored policy visible.",
    },
    { label: "Decision", detail: "Apply the stated deterministic contract." },
    { label: "Review", detail: "Explain the result with evidence." },
  ];
  const norm = (s) =>
    s
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .trim()
      .replace(/[.!?]+$/u, "")
      .replace(/\s+/gu, " ");
  window.AIFSProjectFigures.register("pj-source-grounded-study-coach-1", {
    title: "An answer needs a supporting quote",
    steps,
    caption:
      "The deck validates exact answer evidence before asking a question.",
    lab: {
      controls: [
        {
          key: "source",
          label: "Source passage",
          type: "text",
          value: "Each packet records the harvest year.",
        },
        {
          key: "answer",
          label: "Canonical answer",
          type: "text",
          value: "harvest year",
        },
        {
          key: "start",
          label: "Evidence start",
          type: "number",
          value: 0,
          min: 0,
          max: 1000,
        },
        {
          key: "end",
          label: "Evidence end",
          type: "number",
          value: 37,
          min: 0,
          max: 1000,
        },
      ],
      calculate(v) {
        const bounds =
          Number.isInteger(v.start) &&
          Number.isInteger(v.end) &&
          v.start >= 0 &&
          v.end > v.start &&
          v.end <= v.source.length;
        const quote = bounds ? v.source.slice(v.start, v.end) : "";
        const valid = bounds && v.answer.trim() && quote.includes(v.answer);
        return {
          summary: valid
            ? "The canonical answer has a valid source location."
            : "Reject this card: repair its offsets or answer evidence.",
          metrics: [
            { label: "Source UTF-16 length", value: v.source.length },
            { label: "Valid offsets", value: bounds ? "yes" : "no" },
          ],
          rows: [
            ["Quote", quote || "(invalid range)"],
            ["Expected answer", v.answer],
          ],
          columns: ["Field", "Text"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-source-grounded-study-coach-2", {
    title: "Grade the exact answer contract",
    steps,
    caption:
      "A correct paraphrase can need manual review. This baseline does not grade arbitrary meaning.",
    lab: {
      controls: [
        {
          key: "answer",
          label: "Canonical answer",
          type: "text",
          value: "paper envelopes",
        },
        {
          key: "response",
          label: "Learner response",
          type: "text",
          value: " PAPER   ENVELOPES! ",
        },
        {
          key: "variant",
          label: "Author-approved variant",
          type: "text",
          value: "a paper envelope",
        },
      ],
      calculate(v) {
        const response = norm(v.response);
        const correct =
          Boolean(response) &&
          (response === norm(v.answer) ||
            (Boolean(v.variant.trim()) && response === norm(v.variant)));
        return {
          summary: correct
            ? "Accepted by the explicit string-matching policy."
            : "Review the source and compare the expected answer.",
          metrics: [{ label: "Accepted", value: correct ? "yes" : "no" }],
          rows: [
            ["Expected", norm(v.answer)],
            ["Response", response],
            ["Approved variant", norm(v.variant)],
          ],
          columns: ["Comparison", "Normalized text"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-source-grounded-study-coach-3", {
    title: "Calculate the next review date",
    steps,
    caption:
      "This is a visible teaching policy. Correctness changes the interval; it does not establish learning quality.",
    lab: {
      controls: [
        {
          key: "box",
          label: "Current box",
          type: "range",
          value: 1,
          min: 0,
          max: 5,
        },
        {
          key: "correct",
          label: "Answer accepted",
          type: "checkbox",
          value: true,
        },
        {
          key: "date",
          label: "Attempt date",
          type: "text",
          value: "2026-09-02",
        },
      ],
      calculate(v) {
        const time = Date.parse(v.date + "T00:00:00Z");
        const valid =
          /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
          Number.isFinite(time) &&
          new Date(time).toISOString().slice(0, 10) === v.date;
        if (!valid)
          return { summary: "Reject an invalid calendar date.", metrics: [] };
        const box = v.correct ? Math.min(5, v.box + 1) : 0;
        const interval = v.correct ? 2 ** (box - 1) : 1;
        return {
          summary:
            "Next due: " +
            new Date(time + interval * 86400000).toISOString().slice(0, 10),
          metrics: [
            { label: "Next box", value: box },
            { label: "Interval days", value: interval },
          ],
          bars: [{ label: "Review interval", value: interval, max: 16 }],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-source-grounded-study-coach-4", {
    title: "Choose the due queue for a report",
    steps,
    caption:
      "The source passage remains available on every practice card. The page records actual typed answers locally and downloads the attempt log for the next CLI run.",
    lab: {
      controls: [
        {
          key: "day",
          label: "Report day in September",
          type: "range",
          value: 3,
          min: 1,
          max: 10,
        },
      ],
      calculate(v) {
        const rows = [
          ["sorting", 1],
          ["harvest-year", 3],
          ["storage", 4],
        ].map(([id, day]) => [
          id,
          "2026-09-" + String(day).padStart(2, "0"),
          v.day >= day ? "due" : "later",
        ]);
        const count = rows.filter((r) => r[2] === "due").length;
        return {
          summary: `Show ${count} due cards for September ${v.day}.`,
          metrics: [
            { label: "Due cards", value: count },
            { label: "Future cards", value: 3 - count },
          ],
          rows,
          columns: ["Card", "Due date", "Queue"],
        };
      },
    },
  });
})();
