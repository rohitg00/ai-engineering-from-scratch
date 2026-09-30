(function () {
  "use strict";
  const steps = [
    { label: "Audio", detail: "Keep sample coordinates and source bytes." },
    {
      label: "Process",
      detail: "Apply an explicit signal or transport contract.",
    },
    { label: "Review", detail: "Compare transcript evidence with playback." },
  ];
  window.AIFSProjectFigures.register("pj-voice-note-transcriber-pipeline-1", {
    title: "The sample rate defines the clock",
    steps,
    caption:
      "The same sample index produces a different time at a different rate.",
    lab: {
      controls: [
        {
          key: "index",
          label: "Sample index",
          type: "number",
          value: 800,
          min: 0,
          max: 160000,
        },
        {
          key: "rate",
          label: "Sample rate Hz",
          type: "select",
          value: "16000",
          options: [
            { value: "8000", label: "8000" },
            { value: "16000", label: "16000" },
            { value: "48000", label: "48000" },
          ],
        },
        {
          key: "sample",
          label: "Signed16-bit sample",
          type: "range",
          value: 16384,
          min: -32768,
          max: 32767,
        },
      ],
      calculate(v) {
        return {
          summary: "Timestamp = sample index / sample rate.",
          metrics: [
            { label: "Seconds", value: (v.index / Number(v.rate)).toFixed(4) },
            {
              label: "Normalized amplitude",
              value: (v.sample / 32768).toFixed(4),
            },
          ],
          rows: [
            [
              String(v.index),
              String(v.rate),
              (v.index / Number(v.rate)).toFixed(4),
            ],
          ],
          columns: ["Index", "Hz", "Seconds"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-voice-note-transcriber-pipeline-2", {
    title: "Choose which acoustic frames survive",
    steps,
    caption:
      "Frame energies are an authored example. Loud noise can pass; quiet words can fail.",
    lab: {
      controls: [
        {
          key: "threshold",
          label: "RMS threshold",
          type: "range",
          value: 0.02,
          min: 0,
          max: 0.3,
          step: 0.01,
        },
        {
          key: "gap",
          label: "Maximum silent gap ms",
          type: "range",
          value: 40,
          min: 0,
          max: 100,
          step: 20,
        },
      ],
      calculate(v) {
        const energies = [0, 0.1, 0.1, 0, 0.08, 0.08, 0];
        const active = energies
          .map((e, i) => (e >= v.threshold ? [i * 20, (i + 1) * 20] : null))
          .filter(Boolean);
        const merged = [];
        for (const span of active) {
          const last = merged[merged.length - 1];
          if (last && span[0] - last[1] <= v.gap) last[1] = span[1];
          else merged.push([...span]);
        }
        const kept = merged.filter(([a, b]) => b - a >= 40);
        return {
          summary: `Keep ${kept.length} activity segments after the 40 ms minimum.`,
          metrics: [
            { label: "Active frames", value: active.length },
            {
              label: "Kept milliseconds",
              value: kept.reduce((sum, [a, b]) => sum + b - a, 0),
            },
          ],
          bars: energies.map((value, i) => ({
            label: "Frame " + i,
            value,
            max: 0.3,
          })),
          rows: kept.map(([a, b]) => [String(a), String(b)]),
          columns: ["Start ms", "End ms"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-voice-note-transcriber-pipeline-3", {
    title: "A recognizer request carries actual audio",
    steps,
    caption:
      "Only transient timeouts retry. Supplied reference mode makes no recognition request.",
    lab: {
      controls: [
        {
          key: "reference",
          label: "Use supplied reference text",
          type: "checkbox",
          value: false,
        },
        {
          key: "timeouts",
          label: "Timeouts before success",
          type: "range",
          value: 1,
          min: 0,
          max: 5,
        },
        {
          key: "retries",
          label: "Allowed retries",
          type: "range",
          value: 1,
          min: 0,
          max: 5,
        },
      ],
      calculate(v) {
        const attempts = v.reference
          ? 0
          : Math.min(v.timeouts + 1, v.retries + 1);
        const success = v.reference || v.timeouts <= v.retries;
        let summary = "Timeout budget exhausted; retain a failure.";
        if (v.reference)
          summary = "No recognizer call; label the supplied transcript.";
        else if (success)
          summary = "Record returned text and the exact segment audio hash.";
        return {
          summary,
          metrics: [
            { label: "HTTP attempts", value: attempts },
            {
              label: "Recognition performed",
              value: v.reference ? "no" : "endpoint mode",
            },
          ],
          rows: [
            ["Payload", "multipart model + WAV file"],
            ["Evidence", "segment SHA256 and attempt count"],
          ],
          columns: ["Contract", "Value"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-voice-note-transcriber-pipeline-4", {
    title: "Convert a validated cue to WebVTT",
    steps,
    caption:
      "The review page links segment times to actual playback; it does not infer word alignment.",
    lab: {
      controls: [
        {
          key: "start",
          label: "Cue start seconds",
          type: "number",
          value: 1.234,
          min: 0,
          max: 20,
          step: 0.001,
        },
        {
          key: "end",
          label: "Cue end seconds",
          type: "number",
          value: 3.5,
          min: 0,
          max: 20,
          step: 0.001,
        },
        {
          key: "duration",
          label: "Audio duration seconds",
          type: "number",
          value: 5.685,
          min: 0,
          max: 20,
          step: 0.001,
        },
      ],
      calculate(v) {
        const stamp = (s) => {
          let ms = Math.round(s * 1000);
          const h = Math.floor(ms / 3600000);
          ms %= 3600000;
          const m = Math.floor(ms / 60000);
          ms %= 60000;
          return (
            [h, m, Math.floor(ms / 1000)]
              .map((n) => String(n).padStart(2, "0"))
              .join(":") +
            "." +
            String(ms % 1000).padStart(3, "0")
          );
        };
        const valid = v.start >= 0 && v.end > v.start && v.end <= v.duration;
        return {
          summary: valid
            ? stamp(v.start) + " --> " + stamp(v.end)
            : "Reject cue order or an endpoint beyond the audio.",
          metrics: [
            {
              label: "Cue length seconds",
              value: (v.end - v.start).toFixed(3),
            },
          ],
          rows: [
            ["Audio evidence", "original clip hash"],
            ["Correction flow", "edit JSON, verify hash, rerender"],
          ],
          columns: ["Artifact", "Preserved link"],
        };
      },
    },
  });
})();
