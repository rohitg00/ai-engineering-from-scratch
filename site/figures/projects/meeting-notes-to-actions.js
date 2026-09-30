(function () {
  "use strict";
  const controls = [
    { key: "owner", label: "Owner", type: "text", value: "Mira" },
    { key: "due", label: "Due date", type: "text", value: "2026-10-01" },
    { key: "today", label: "Review date", type: "text", value: "2026-09-29" },
    {
      key: "task",
      label: "Task",
      type: "text",
      value: "Update the migration guide",
    },
    {
      key: "approved",
      label: "Reviewer explicitly approved",
      type: "checkbox",
      value: false,
    },
    {
      key: "copies",
      label: "Repeated source mentions",
      type: "range",
      value: 2,
      min: 1,
      max: 5,
      step: 1,
    },
  ];
  const calculate = function (v, stepIndex) {
    const dateOk = (s) =>
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      !isNaN(Date.parse(s + "T00:00:00Z")) &&
      new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
    const missing = v.owner === "?" || v.due === "?",
      invalid = v.due !== "?" && !dateOk(v.due),
      ready = !missing && !invalid && v.task.trim().length > 0,
      exported = ready && v.approved;
    return {
      summary: invalid
        ? "Reject impossible calendar date"
        : missing
          ? "Keep commitment pending with missing-field flags"
          : exported
            ? "One approved commitment can enter CSV"
            : "Ready for review; approval is still required",
      metrics: [
        { label: "Source citations preserved", value: v.copies },
        {
          label: "Overdue",
          value: dateOk(v.due) && dateOk(v.today) && v.due < v.today,
        },
      ],
      bars: [
        { label: "Mentions", value: v.copies, max: 5 },
        { label: "Deduplicated commitments", value: 1, max: 5 },
        { label: "Exported approved rows", value: exported ? 1 : 0, max: 5 },
      ],
    };
  };
  window.AIFSProjectFigures.register(
    "pj-meeting-notes-to-actions-1",
    Object.assign(
      {
        title: "Parse explicit action records with line provenance",
        steps: [
          { label: "Lines", detail: "Enumerate original note lines." },
          { label: "Marker", detail: "Accept only explicit ACTION records." },
          {
            label: "Provenance",
            detail: "Retain the raw line and its number.",
          },
        ],
        caption:
          "Parse ACTION lines, keep source line numbers, and reject malformed marked lines..",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-meeting-notes-to-actions-2",
    Object.assign(
      {
        title: "Validate owners and calendar dates",
        steps: [
          {
            label: "Fields",
            detail: "Check task text and explicit unknown markers.",
          },
          { label: "Calendar", detail: "Parse the real ISO date." },
          { label: "Flags", detail: "Keep missing commitments visible." },
        ],
        caption: "Validate owner, task, and ISO date.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-meeting-notes-to-actions-3",
    Object.assign(
      {
        title: "Deduplicate exact commitments without losing citations",
        steps: [
          { label: "Key", detail: "Normalize the three commitment fields." },
          { label: "Group", detail: "Merge only exact keys." },
          { label: "Citations", detail: "Retain every original line." },
        ],
        caption:
          "Merge exact normalized duplicates and sort provenance line numbers.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-meeting-notes-to-actions-4",
    Object.assign(
      {
        title: "Publish an escaped HTML checklist and summary",
        steps: [
          { label: "Classify", detail: "Compute review and overdue flags." },
          { label: "Escape", detail: "Treat imported text as data." },
          { label: "Publish", detail: "Write a portable HTML checklist." },
        ],
        caption:
          "Return HTML and counts for ready, review, and overdue actions.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
