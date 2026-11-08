(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-kubernetes-event-storyboard-1", {
    title: "Capture lag",
    steps: [
      {
        label: "Inputs",
        detail: "Occurrence and observation are different timestamps.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Occurrence and observation are different timestamps.",
    lab: {
      controls: [
        {
          key: "occur",
          label: "Last occurrence minute",
          type: "range",
          value: 3,
          min: 0,
          max: 10,
          step: 1,
        },
        {
          key: "observe",
          label: "Observed minute",
          type: "range",
          value: 5,
          min: 0,
          max: 10,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary:
            v.observe >= v.occur
              ? "Capture lag " + (v.observe - v.occur) + " minutes"
              : "Clock ordering needs investigation",
          columns: ["Clock", "Minute"],
          rows: [
            ["occurrence", v.occur],
            ["observation", v.observe],
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-kubernetes-event-storyboard-2", {
    title: "Series deduplication",
    steps: [
      { label: "Inputs", detail: "Snapshots of one UID use maximum count." },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Snapshots of one UID use maximum count.",
    lab: {
      controls: [
        {
          key: "a",
          label: "Earlier snapshot count",
          type: "range",
          value: 2,
          min: 0,
          max: 10,
          step: 1,
        },
        {
          key: "b",
          label: "Later snapshot count",
          type: "range",
          value: 4,
          min: 0,
          max: 10,
          step: 1,
        },
        {
          key: "other",
          label: "Distinct event count",
          type: "range",
          value: 1,
          min: 0,
          max: 10,
          step: 1,
        },
      ],
      calculate(v) {
        return {
          summary: "Grouped count " + (Math.max(v.a, v.b) + v.other),
          metrics: [
            { label: "Same UID retained count", value: Math.max(v.a, v.b) },
            { label: "Naive overcount", value: v.a + v.b + v.other },
          ],
          bars: [
            {
              label: "Correct total",
              value: Math.max(v.a, v.b) + v.other,
              max: 20,
            },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-kubernetes-event-storyboard-3", {
    title: "UID matching",
    steps: [
      { label: "Inputs", detail: "Names are not stable object identity." },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Names are not stable object identity.",
    lab: {
      controls: [
        {
          key: "event",
          label: "Event object UID",
          type: "text",
          value: "pod-old",
        },
        {
          key: "workload",
          label: "Snapshot UID",
          type: "text",
          value: "pod-new",
        },
        {
          key: "revision",
          label: "Snapshot revision",
          type: "text",
          value: "8",
        },
      ],
      calculate(v) {
        return {
          summary:
            v.event === v.workload
              ? "Revision " + v.revision
              : "Revision unknown: UID mismatch",
          metrics: [{ label: "Identity match", value: v.event === v.workload }],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-kubernetes-event-storyboard-4", {
    title: "Context redaction",
    steps: [
      {
        label: "Inputs",
        detail: "Only an explicit subset reaches the assistant.",
      },
      {
        label: "Compute",
        detail: "Change an input to inspect the calculated result.",
      },
    ],
    caption: "Only an explicit subset reaches the assistant.",
    lab: {
      controls: [
        {
          key: "events",
          label: "Raw events",
          type: "range",
          value: 5,
          min: 0,
          max: 20,
          step: 1,
        },
        {
          key: "repeated",
          label: "Repeated snapshots",
          type: "range",
          value: 2,
          min: 0,
          max: 20,
          step: 1,
        },
      ],
      calculate(v) {
        const n = Math.max(0, v.events - v.repeated);
        return {
          summary: n + " distinct event identities before grouping",
          metrics: [
            { label: "Messages exported", value: 0 },
            { label: "Spec fields exported", value: 0 },
          ],
          bars: [{ label: "Retained identities", value: n, max: 20 }],
        };
      },
    },
  });
})();
