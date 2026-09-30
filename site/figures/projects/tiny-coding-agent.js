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
      text(
        "file",
        "Workspace file text",
        "def total(price, quantity): return price + quantity",
      ),
      text("old", "Exact old expression", "price + quantity"),
      text("replacement", "Proposed replacement", "price * quantity"),
      text("failure", "Observed test output", "AssertionError: 10 != 21"),
      text("marker", "Proposal failure marker", "AssertionError"),
      number("used", "Actions used", 1, 0, 6),
      number("budget", "Action budget", 4, 1, 6),
      number("price", "Test price", 7, 0, 20),
      number("quantity", "Test quantity", 3, 0, 10),
    ],
    calculate(v) {
      const count = v.old ? v.file.split(v.old).length - 1 : 0,
        observed = v.failure.includes(v.marker) && !!v.marker,
        allowed = count === 1 && observed && v.used < v.budget;
      const before = v.price + v.quantity,
        expected = v.price * v.quantity;
      const multiply = v.replacement === "price * quantity";
      return {
        summary:
          v.used >= v.budget
            ? "budget_exhausted"
            : !observed
              ? "Planner abstains: marker absent"
              : count !== 1
                ? "Patch precondition fails: " + count + " matches"
                : allowed
                  ? "Apply exact proposal, then rerun real tests"
                  : "rejected",
        metrics: [
          metric("Exact matches", count),
          metric("Observed failure matches", observed),
          metric("Expected test value", expected),
          metric(
            "Predicted proposed value",
            multiply ? expected : "not interpreted",
          ),
        ],
        bars: [
          bar("Broken addition output", before),
          bar("Expected product", expected),
        ],
        columns: ["Observation", "State"],
        rows: [
          [
            "Test before",
            before === expected ? "fixture passes accidentally" : "failure",
          ],
          ["Patch", allowed ? "eligible" : "blocked"],
          ["Test after", "must execute; prediction is not proof"],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-tiny-coding-agent-1",
    Object.assign(
      {
        title: "Confine file tools to a workspace",
        steps: [
          {
            label: "Relative path",
            detail:
              "The Orchard basket repair runs in a disposable copy of a trusted Python workspace. Resolve every requested file under that root before opening it. A path may look local while a symlink redirects it outside the workspace.",
          },
          {
            label: "Resolve",
            detail:
              "basket.py -> contained existing file\n../basket.py -> reject\nsymlink to external file -> reject",
          },
          {
            label: "Containment",
            detail:
              "Compare resolved path components, not string prefixes. The caller chooses the workspace; a model response must not choose a new root.",
          },
        ],
        caption:
          "Why does copying a trusted repository not turn its tests into sandboxed code?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-tiny-coding-agent-2",
    Object.assign(
      {
        title: "Apply exact patches with preconditions",
        steps: [
          {
            label: "Precondition",
            detail:
              "A patch states exactly what it expects to replace. The broken basket multiplies neither price nor quantity: it returns price + quantity. Replace that expression only when it appears once.",
          },
          {
            label: "Replacement",
            detail:
              "old: price + quantity\nnew: price * quantity\noccurrences=1 -> write; occurrences=0 or 2 -> reject",
          },
          {
            label: "Atomic write",
            detail:
              "Count exact matches before opening a temporary output file. Preserve file permissions when replacing the original.",
          },
        ],
        caption:
          "What should happen when another editor fixes the file after the planner proposes a patch?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-tiny-coding-agent-3",
    Object.assign(
      {
        title: "Run real tests through one allowed command",
        steps: [
          {
            label: "Argv",
            detail:
              "Run the actual unittest suite before claiming a repair. In the original basket example, total(7,3) returns 10 instead of 21; total(7,0) returns 7 instead of 0. Both failures should disappear after the patch.",
          },
          {
            label: "Timeout",
            detail:
              "before: 2 failed assertions\nafter: 2 executed tests, OK\nzero tests or skipped tests -> not success",
          },
          {
            label: "Evidence",
            detail:
              "Read the final unittest summary from stderr and require a positive executed test count. On POSIX, stop the process group when the test deadline expires.",
          },
        ],
        caption:
          'Why must a printed "Ran 999 tests" line not count as test evidence?',
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-tiny-coding-agent-4",
    Object.assign(
      {
        title: "Stop the coding loop on evidence or budget",
        steps: [
          {
            label: "Action",
            detail:
              "The planner now receives each observation. It tests first, selects a supplied exact repair only when its failure marker appears, then tests again. This transparent rule planner does not claim to invent code from a model.",
          },
          {
            label: "Observation",
            detail:
              "test -> AssertionError\nproposal marker matches -> patch\ntest -> OK -> completed",
          },
          {
            label: "Stop",
            detail:
              "Call the planner again after every tool result. Retain the requested action with each observation and stop on abstention or exhausted steps.",
          },
        ],
        caption:
          "How would you plug in a model while keeping the same patch preconditions and completion rule?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
