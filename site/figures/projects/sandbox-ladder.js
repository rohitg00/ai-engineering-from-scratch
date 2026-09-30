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
      check("untrusted", "Untrusted code", true),
      check("secrets", "Secret-bearing host", true),
      check("network", "Require denied network", true),
      check("kernel", "Require separate kernel", false),
      number("budget", "Modeled cost budget", 3, 1, 5),
      check("observedReadOnly", "Probe: root write denied", true),
      check("observedNoRoute", "Probe: default route absent", false),
    ],
    calculate(v) {
      const p = [
        ["process", false, false, false, 1],
        ["filesystem", true, false, false, 2],
        ["container", true, true, false, 3],
        ["microvm", true, true, true, 5],
      ];
      const rows = p.map((x) => [
        ...x,
        (!(v.untrusted || v.secrets) || x[1]) &&
          (!v.network || x[2]) &&
          (!v.kernel || x[3]),
      ]);
      const chosen = rows.find((x) => x[5] && x[4] <= v.budget);
      return {
        summary:
          stage === 4
            ? "Observed probes: " +
              (v.observedReadOnly && v.observedNoRoute
                ? "two checks pass; escape resistance unproven"
                : "requested controls are not both observed")
            : chosen
              ? "Least-cost sufficient model: " + chosen[0]
              : "No sufficient model within budget",
        metrics: [
          metric("Selected", chosen?.[0] || "none"),
          metric(
            "OS enforcement",
            stage === 4 ? "probe inputs only" : "not established",
          ),
          metric("Kernel requirement", v.kernel),
        ],
        bars: rows.map((x) => bar(x[0] + " cost", x[4], 5)),
        columns: [
          "Profile",
          "Filesystem",
          "Network denial",
          "Separate kernel",
          "Cost",
          "Sufficient",
        ],
        rows,
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-sandbox-ladder-1",
    Object.assign(
      {
        title: "Parse the capability request",
        steps: [
          {
            label: "Parse keys",
            detail:
              "Write the threat requirement as booleans before selecting a runtime. Here network=true means network denial is required, and host_kernel=true means a separate kernel is required. Neither name grants access.",
          },
          {
            label: "Reject duplicates",
            detail:
              "untrusted=true,secrets=true,network=true,host_kernel=false\nrequired: filesystem boundary + denied network",
          },
          {
            label: "Exact booleans",
            detail:
              "Reject duplicate keys and values other than exact true/false. Do not guess what network=yes means.",
          },
        ],
        caption:
          "Which additional requirement would make a shared-kernel container insufficient?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-sandbox-ladder-2",
    Object.assign(
      {
        title: "Define modeled control profiles",
        steps: [
          {
            label: "Filesystem control",
            detail:
              "Profiles are modeled capabilities with illustrative costs. A process boundary has no filesystem or network isolation in this model; the container profile models both but shares its host kernel.",
          },
          {
            label: "Network control",
            detail:
              "process: filesystem=false, network=false, kernel=false\ncontainer: filesystem=true, network=true, kernel=false",
          },
          {
            label: "Kernel control",
            detail:
              "Test requirements independently. A low cost is irrelevant when one required capability is absent.",
          },
        ],
        caption:
          "Why is the model not evidence that a running container has these settings?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-sandbox-ladder-3",
    Object.assign(
      {
        title: "Select the least costly sufficient profile",
        steps: [
          {
            label: "Filter controls",
            detail:
              "The cheapest sufficient profile may exceed the allowed budget. When kernel separation is required, budget 4 cannot silently downgrade to a container costing 3.",
          },
          {
            label: "Apply budget",
            detail:
              "kernel separation required; candidates costs 1,2,3,5\nbudget 4 -> no sufficient profile\nbudget 5 -> microvm-fixture",
          },
          {
            label: "Stable minimum",
            detail:
              "Filter by capabilities first, then cost, then stable name ordering. Return a limit error if the remaining set is empty.",
          },
        ],
        caption:
          "What should change when two sufficient profiles have the same modeled cost?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-sandbox-ladder-4",
    Object.assign(
      {
        title: "Report residual assumptions",
        steps: [
          {
            label: "Recheck requirements",
            detail:
              "The optional Docker adapter produces an inspectable argument list and only runs a caller-selected image already present locally. Its harmless probes test a denied root write and absence of a default route. No microVM implementation is included.",
          },
          {
            label: "Name model",
            detail:
              "--docker-image alpine:local -> command preview\n--execute -> docker_probe with observed stdout\nshared host kernel remains a residual",
          },
          {
            label: "List residuals",
            detail:
              "Keep policy_simulation and docker_probe results distinct. A successful probe is evidence for those checks only, not proof against container escape.",
          },
        ],
        caption:
          "If root_write becomes allowed, which runtime setting would you inspect first?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
