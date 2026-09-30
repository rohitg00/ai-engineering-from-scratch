(function () {
  "use strict";
  const controls = [
    {
      key: "name",
      label: "Name already filled (0/1)",
      type: "range",
      value: 0,
      min: 0,
      max: 1,
      step: 1,
    },
    {
      key: "email",
      label: "Email already filled (0/1)",
      type: "range",
      value: 0,
      min: 0,
      max: 1,
      step: 1,
    },
    {
      key: "budget",
      label: "Observation budget",
      type: "range",
      value: 4,
      min: 1,
      max: 8,
      step: 1,
    },
    {
      key: "green",
      label: "Green pixels per ten thousand",
      type: "range",
      value: 100,
      min: 0,
      max: 10000,
      step: 1,
    },
    { key: "origin", label: "Origin changed", type: "checkbox", value: false },
    {
      key: "dangerous",
      label: "Submit marked dangerous",
      type: "checkbox",
      value: false,
    },
  ];
  const calculate = function (v, stepIndex) {
    const fills = 2 - v.name - v.email,
      observations = fills + 2;
    const safe = !v.origin && !v.dangerous;
    const state = !safe
      ? "blocked"
      : v.budget < observations
        ? "budget-exhausted"
        : v.green > 5
          ? "complete"
          : "visual-mismatch";
    return {
      summary:
        state +
        "; completion requires values, allowed origin, DOM success and fixture pixel signal.",
      metrics: [
        { label: "Required observations", value: observations },
        { label: "Green fraction", value: v.green / 10000 },
      ],
      bars: [
        { label: "Fill actions", value: fills, max: 4 },
        { label: "Submit and verify", value: 2, max: 4 },
        { label: "Available observations", value: v.budget, max: 8 },
      ],
    };
  };
  window.AIFSProjectFigures.register(
    "pj-browser-agent-1",
    Object.assign(
      {
        title: "Turn DOM state into constrained actions",
        steps: [
          { label: "Input contract", detail: "parseObservation, choose" },
          {
            label: "Turn DOM state into constrained actions",
            detail:
              "Read labels, values, disabled states and stable ids from a small form. Validate unique ids and field types. Choose one action at a time: fill the name, fill email, then click the uniquely identified Save request button. Page prose is never interpreted as instructions. Missing fields, ambiguous labels, dangerous buttons and unexpected origins cause an explicit blocked result.",
          },
          {
            label: "Observe the result",
            detail:
              "The action union contains fill and click only; injected page prose has no execution path.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-browser-agent-2",
    Object.assign(
      {
        title: "Stop on completion, stalling or budget",
        steps: [
          { label: "Input contract", detail: "runAgent, FixtureDriver" },
          {
            label: "Stop on completion, stalling or budget",
            detail:
              "Observe after every action. Stop if the state repeats, if policy blocks an action, or if the step budget is consumed. Completion requires the DOM success flag and a separate screenshot check. Trace every selected action before execution. The fixture backend is explicitly a simulator; it supplies deterministic observations to test the loop and does not claim browser coverage.",
          },
          {
            label: "Observe the result",
            detail:
              "A successful run records name, email, submit and done. An unresponsive driver stops as stalled instead of clicking forever.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-browser-agent-3",
    Object.assign(
      {
        title: "Verify screenshot pixels in Python",
        steps: [
          { label: "Input contract", detail: "inspectPNG" },
          {
            label: "Verify screenshot pixels in Python",
            detail:
              "Read the PNG signature, chunk lengths and CRCs, then decompress a bounded image payload. Reverse PNG row filters and count green success pixels. Combine this visual signal with the DOM flag; neither alone is sufficient. This is a narrow pixel-state detector for the authored fixture, not OCR or general vision. Corrupt, oversized, interlaced and unsupported color formats fail explicitly.",
          },
          {
            label: "Observe the result",
            detail:
              "A green 4x4 fixture scores 1.0 and a red fixture scores zero; the real browser screenshot usually has a small positive success fraction.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-browser-agent-4",
    Object.assign(
      {
        title: "Drive the real fixture and score the run",
        steps: [
          { label: "Input contract", detail: "GstackDriver, scoreRuns" },
          {
            label: "Drive the real fixture and score the run",
            detail:
              "Serve fixture.html over loopback and navigate to it with gstack browse. GstackDriver reads DOM observations, fills labels, clicks the observed button and captures a real screenshot. Commands use argument arrays instead of a shell. Run the same bounded policy with --live and compare its trace with the fixture backend. Keep completion scores separate for simulated and real-browser runs.",
          },
          {
            label: "Observe the result",
            detail:
              "Start `python3 -m http.server 8877 --bind 127.0.0.1 --directory projects/browser-agent/solution`, navigate with `$BROWSE_BIN goto http://127.0.0.1:8877/fixture.html`, then run `node projects/browser-agent/solution/main.ts --live`. The run saves browser-result.png and reports actual Chromium mode.",
          },
        ],
        caption: "Advance to inspect the boundary before the next effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
