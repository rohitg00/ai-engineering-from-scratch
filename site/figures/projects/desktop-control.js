(function () {
  "use strict";
  const controls = [
    {
      key: "x",
      label: "Screenshot x coordinate",
      type: "range",
      value: 200,
      min: 0,
      max: 640,
      step: 1,
    },
    {
      key: "y",
      label: "Screenshot y coordinate",
      type: "range",
      value: 100,
      min: 0,
      max: 400,
      step: 1,
    },
    {
      key: "scale",
      label: "Display scale",
      type: "range",
      value: 2,
      min: 1,
      max: 4,
      step: 0.5,
    },
    {
      key: "captured",
      label: "Captured generation",
      type: "range",
      value: 2,
      min: 0,
      max: 5,
      step: 1,
    },
    {
      key: "current",
      label: "Required generation",
      type: "range",
      value: 2,
      min: 0,
      max: 5,
      step: 1,
    },
    {
      key: "calls",
      label: "Calls already consumed",
      type: "range",
      value: 4,
      min: 0,
      max: 8,
      step: 1,
    },
  ];
  const calculate = function (v, stepIndex) {
    const valid = v.x < 640 && v.y < 400,
      stale = v.captured !== v.current;
    return {
      summary: !valid
        ? "Reject point outside frame"
        : stale
          ? "Reject stale observation"
          : v.calls >= 8
            ? "Reject exhausted action budget"
            : "Allow click using converted logical coordinates",
      metrics: [
        { label: "Logical x", value: Math.floor(v.x / v.scale) },
        { label: "Logical y", value: Math.floor(v.y / v.scale) },
        { label: "Generation matches", value: !stale },
      ],
      bars: [
        { label: "Consumed calls", value: v.calls, max: 8 },
        { label: "Remaining calls", value: 8 - v.calls, max: 8 },
      ],
    };
  };
  window.AIFSProjectFigures.register(
    "pj-desktop-control-1",
    Object.assign(
      {
        title: "Validate frames and coordinate spaces",
        steps: [
          {
            label: "Validate input",
            detail: "Frame.validate, Frame.logical_point",
          },
          {
            label: "Apply the boundary",
            detail:
              "A screenshot has physical pixel dimensions while native desktop clicks may use logical coordinates. Validate positive bounded dimensions and a finite display scale, then reject points outside the frame before converting by floor division. The frame generation identifies which observation justified an action.",
          },
          {
            label: "Inspect output",
            detail:
              "A pixel at 200,100 on a scale-two display maps to logical point 100,50; a point exactly on the right boundary is rejected.",
          },
        ],
        caption: "Reject invalid input before the side effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-desktop-control-2",
    Object.assign(
      {
        title: "Render and manipulate a fixture scene",
        steps: [
          { label: "Validate input", detail: "Backend, FixtureBackend" },
          {
            label: "Apply the boundary",
            detail:
              "Define capture, click and type_text behind one Backend trait. The fixture draws a real PPM image from its state: a text field, a submit region and a green completed scene. Clicking the field changes focus, typing requires focus, and clicking submit completes only after text exists. The fixture makes transition bugs reproducible without controlling the user desktop.",
          },
          {
            label: "Inspect output",
            detail:
              "The final PPM is a real rendered artifact. Fixture completion establishes backend logic only, not native OS control.",
          },
        ],
        caption: "Reject invalid input before the side effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-desktop-control-3",
    Object.assign(
      {
        title: "Reject stale observations and exhausted budgets",
        steps: [
          {
            label: "Validate input",
            detail:
              "Controller.capture, Controller.click, Controller.type_text",
          },
          {
            label: "Apply the boundary",
            detail:
              "Place a Controller around the backend. Reserve action budget before each backend call, require a captured frame before clicks, and invalidate that frame after a mutation. A stale generation must fail before clicking. Keep a trace of successful actions and count attempted backend calls even when the backend returns an error.",
          },
          {
            label: "Inspect output",
            detail:
              "A second click cannot reuse the pre-click screenshot. The caller must capture the changed scene first.",
          },
        ],
        caption: "Reject invalid input before the side effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-desktop-control-4",
    Object.assign(
      {
        title: "Build an opt-in native boundary",
        steps: [
          {
            label: "Validate input",
            detail: "click_argv, text_argv, png_dimensions, MacBackend",
          },
          {
            label: "Apply the boundary",
            detail:
              "Construct macOS screencapture and AppleScript argument arrays without a shell. Pass typed text as an argument, never as executable script content. Read PNG dimensions from native screenshot headers and preserve the actual image payload. The default demo remains the fixture. Native capture requires an explicit --native-capture flag, OS permissions and a caller-supplied DESKTOP_SCALE when the display is scaled. Native click and typing are library methods, not automatic demo actions.",
          },
          {
            label: "Inspect output",
            detail:
              "The tests verify native argument construction and image metadata parsing. Native macOS execution is explicitly unverified by the fixture suite; use it only against a disposable test application.",
          },
        ],
        caption: "Reject invalid input before the side effect.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
