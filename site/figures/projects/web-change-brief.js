(function () {
  "use strict";
  const steps = [
    {
      label: "Snapshot",
      detail: "Retain the declared source and extraction policy.",
    },
    { label: "Compute", detail: "Apply bounded, inspectable transformations." },
    { label: "Report", detail: "Preserve exact change evidence." },
  ];
  const blocks = (s) =>
    s
      .split("|")
      .map((x) => x.trim().replace(/\s+/g, " "))
      .filter(Boolean);
  const diff = (a, b) => {
    const left = new Map(),
      right = new Map();
    for (const x of a) left.set(x, (left.get(x) || 0) + 1);
    for (const x of b) right.set(x, (right.get(x) || 0) + 1);
    let common = 0;
    const rows = [];
    for (const x of [...new Set([...a, ...b])].sort()) {
      const l = left.get(x) || 0,
        r = right.get(x) || 0;
      common += Math.min(l, r);
      rows.push([
        x,
        String(l),
        String(r),
        r > l ? "added " + (r - l) : l > r ? "removed " + (l - r) : "unchanged",
      ]);
    }
    return { rows, common };
  };
  window.AIFSProjectFigures.register("pj-web-change-brief-1", {
    title: "Filter readable blocks explicitly",
    steps,
    caption:
      "Use | between already extracted blocks. This lab shows phrase filtering after HTML scanning.",
    lab: {
      controls: [
        {
          key: "text",
          label: "Extracted blocks separated by |",
          type: "text",
          value: "Community workshop | Updated today 15:00 | Bring a mug",
        },
        {
          key: "ignore",
          label: "Ignore phrase",
          type: "text",
          value: "updated today",
        },
      ],
      calculate(v) {
        const input = blocks(v.text),
          phrase = v.ignore.trim().toLowerCase();
        const kept = input.filter(
          (x) => !phrase || !x.toLowerCase().includes(phrase),
        );
        return {
          summary: `Keep ${kept.length} of ${input.length} readable blocks.`,
          metrics: [
            { label: "Removed blocks", value: input.length - kept.length },
          ],
          rows: input.map((x) => [x, kept.includes(x) ? "kept" : "filtered"]),
          columns: ["Block", "Decision"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-web-change-brief-2", {
    title: "Count text occurrences, not just membership",
    steps,
    caption:
      "Use | between blocks. Reordering does not count as a text change, but duplicate counts do.",
    lab: {
      controls: [
        {
          key: "before",
          label: "Before blocks",
          type: "text",
          value: "A | A | B",
        },
        {
          key: "after",
          label: "After blocks",
          type: "text",
          value: "A | B | C",
        },
      ],
      calculate(v) {
        const a = blocks(v.before),
          b = blocks(v.after),
          r = diff(a, b);
        return {
          summary: `${r.common} unchanged block occurrences.`,
          metrics: [
            { label: "Before blocks", value: a.length },
            { label: "After blocks", value: b.length },
          ],
          rows: r.rows,
          columns: ["Exact text", "Before count", "After count", "Change"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-web-change-brief-3", {
    title: "Do not accept a failed fetch as a baseline",
    steps,
    caption:
      "HTTP success, supported media, size and cancellation are independent gates.",
    lab: {
      controls: [
        {
          key: "status",
          label: "HTTP status",
          type: "select",
          value: "200",
          options: [
            { value: "200", label: "200 OK" },
            { value: "503", label: "503 Unavailable" },
            { value: "404", label: "404 Not found" },
          ],
        },
        {
          key: "bytes",
          label: "Response bytes",
          type: "number",
          value: 125000,
          min: 0,
          max: 4000000,
          step: 1000,
        },
        {
          key: "html",
          label: "HTML Content-Type",
          type: "checkbox",
          value: true,
        },
        {
          key: "cancelled",
          label: "Request cancelled",
          type: "checkbox",
          value: false,
        },
      ],
      calculate(v) {
        const checks = [
          ["Status 200", v.status === "200"],
          ["HTML type", v.html],
          ["At most 2 MB", v.bytes <= 2000000],
          ["Not cancelled", !v.cancelled],
        ];
        const accepted = checks.every((x) => x[1]);
        return {
          summary: accepted
            ? "Fetch is eligible for extraction. Baseline replacement remains explicit."
            : "Keep the prior baseline and report the fetch failure.",
          metrics: [
            { label: "Passed gates", value: checks.filter((x) => x[1]).length },
            { label: "Baseline replacements", value: 0 },
          ],
          rows: checks.map(([k, ok]) => [k, ok ? "pass" : "fail"]),
          columns: ["Gate", "Result"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-web-change-brief-4", {
    title: "Show the changed statement itself",
    steps,
    caption:
      "The report carries exact text and counts. It does not infer the publisher’s intent.",
    lab: {
      controls: [
        {
          key: "before",
          label: "Prior statement",
          type: "text",
          value: "The workshop starts at 14:00.",
        },
        {
          key: "after",
          label: "Current statement",
          type: "text",
          value: "The workshop starts at 15:00.",
        },
      ],
      calculate(v) {
        const r = diff(blocks(v.before), blocks(v.after));
        return {
          summary:
            v.before.trim() === v.after.trim()
              ? "No text change."
              : "Review the removed and added statements side by side.",
          metrics: [{ label: "Unchanged occurrences", value: r.common }],
          rows: r.rows,
          columns: ["Exact evidence", "Before", "After", "Report action"],
        };
      },
    },
  });
})();
