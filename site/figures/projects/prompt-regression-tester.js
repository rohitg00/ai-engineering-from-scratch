(function () {
  "use strict";
  const number = (key, label, value, min = 0, max = 100, step = 1) => ({
    key,
    label,
    type: "range",
    value,
    min,
    max,
    step,
  });
  const text = (key, label, value) => ({ key, label, type: "text", value });
  const check = (key, label, value) => ({
    key,
    label,
    type: "checkbox",
    value,
  });
  const select = (key, label, value, options) => ({
    key,
    label,
    type: "select",
    value,
    options: options.map((x) => ({ value: x, label: x })),
  });
  const metric = (label, value) => ({ label, value });
  const bar = (label, value, max) => ({ label, value, max });
  const words = (s) =>
    s
      .normalize("NFC")
      .toLowerCase()
      .match(/[\p{L}\p{N}_]+/gu) || [];
  const unique = (xs) => [...new Set(xs)];
  const finiteList = (s) =>
    s.split(",").map((x) => {
      const n = Number(x.trim());
      if (!Number.isFinite(n))
        throw Error("Use comma-separated finite numbers");
      return n;
    });

  const buildLab = (stage) => ({
    controls: [
      text("baseline", "Baseline response", '{"source":"source: notes.md"}'),
      text("candidate", "Candidate response", "Ready. source: notes.md"),
      text("required", "Required substring", "source:"),
      number("minimum", "Minimum pass fraction", 1, 0, 1, 0.1),
      number("budget", "Allowed regressions", 0, 0, 2),
    ],
    calculate(v) {
      const score = (s) => {
        let valid = true;
        try {
          JSON.parse(s);
        } catch {
          valid = false;
        }
        return [valid, s.includes(v.required)];
      };
      const a = score(v.baseline),
        b = score(v.candidate);
      const regressions = a.filter((x, i) => x && !b[i]).length;
      const passes = b.filter(Boolean).length;
      const ship = passes / 2 >= v.minimum && regressions <= v.budget;
      return {
        summary:
          stage === 4
            ? (ship ? "Ship" : "Block") +
              ": paired checks control the decision."
            : "Compare JSON syntax and source attribution independently.",
        metrics: [
          metric("Candidate checks", passes + "/2"),
          metric("Regressions", regressions),
          metric("Decision", ship ? "ship" : "block"),
        ],
        bars: [
          bar("Baseline checks", a.filter(Boolean).length, 2),
          bar("Candidate checks", passes, 2),
        ],
        columns: ["Promise", "Baseline", "Candidate", "Change"],
        rows: ["JSON syntax", "Source locator"].map((s, i) => [
          s,
          a[i],
          b[i],
          a[i] === b[i] ? "stable" : b[i] ? "improved" : "regressed",
        ]),
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-prompt-regression-tester-1",
    Object.assign(
      {
        title: "Validate cases before scoring",
        steps: [
          {
            label: "Cases",
            detail:
              "Orchard must return JSON and preserve a source locator. Keep `format-json` and `source-link` as different case ids: they are separate promises to the caller. The cassette hashes the entire case list, including prompts and checks, before comparing runs.",
          },
          {
            label: "Validate",
            detail:
              'case ids: [format-json, source-link]\nchecks: json; contains("source:")\nrepeat format-json -> reject before replay',
          },
          {
            label: "Freeze",
            detail:
              "Build a set of ids while validating. Validate each check kind before looking up a recorded response.",
          },
        ],
        caption:
          "Change only the prompt wording. Why must the previous case hash stop matching?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-prompt-regression-tester-2",
    Object.assign(
      {
        title: "Score recorded outputs without a model",
        steps: [
          {
            label: "Replay",
            detail:
              "A valid JSON response can still omit its source. Score every assertion and retain the individual results so a maintainer can see which promise failed.",
          },
          {
            label: "Assertions",
            detail:
              'response: {"answer":"ready"}\njson -> true\ncontains("source:") -> false\ncase passed -> false',
          },
          {
            label: "Evidence",
            detail:
              "Evaluate the list of checks first, then apply all(). A missing response must not become an empty passing checklist.",
          },
        ],
        caption:
          "Would lowercasing the response before an excludes check change the contract for API_KEY?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-prompt-regression-tester-3",
    Object.assign(
      {
        title: "Compare the same cases across revisions",
        steps: [
          {
            label: "Baseline",
            detail:
              "The candidate fixes source attribution but replaces machine-readable JSON with friendly prose. Pair case ids before calculating the average: one improvement does not repair another broken interface.",
          },
          {
            label: "Candidate",
            detail:
              "format-json: pass -> fail = regressed\nsource-link: fail -> pass = improved\naggregate pass rate: unchanged",
          },
          {
            label: "Pair",
            detail:
              "Keep model, settings and case hash alongside the responses. The CLI rejects changed model/settings unless you explicitly allow that experiment.",
          },
        ],
        caption:
          "How would you explain a flat pass rate to the owner of the JSON consumer?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-prompt-regression-tester-4",
    Object.assign(
      {
        title: "Gate releases on explicit tolerances",
        steps: [
          {
            label: "Thresholds",
            detail:
              "Your release gate is an executable policy. With three cases and one regression, a candidate is blocked even if its other responses improve. Save the JSON and Markdown diff as CI artifacts.",
          },
          {
            label: "Evidence",
            detail:
              "cases=3; candidate passes=2; regressions=1\nminimum pass fraction=1; regression budget=0\ndecision=block; CLI exit=1",
          },
          {
            label: "Decision",
            detail:
              "Check that thresholds are finite and the suite is nonempty before comparing numbers. Exit status must agree with the reported decision.",
          },
        ],
        caption:
          "Which assertion would you add after a real support incident, and how would you keep its recording provenance?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
