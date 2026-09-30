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
        "rule",
        "Case-sensitive correction",
        "Read API_KEY; never rename it to api_key.",
      ),
      text(
        "sessions",
        "Source sessions comma-separated",
        "review-a,review-a,review-b",
      ),
      text("scope", "Rule scope", "orchard"),
      text("activeScope", "Current scope", "orchard"),
      select("state", "Rule state", "candidate", [
        "candidate",
        "approved",
        "retired",
      ]),
      number("minimum", "Required independent sessions", 2, 1, 5),
    ],
    calculate(v) {
      const normalized = v.rule.trim().replace(/\s+/g, " "),
        sessions = unique(
          v.sessions
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        ),
        enough = sessions.length >= v.minimum;
      const scope = v.scope.trim().toLowerCase(),
        match =
          scope === "global" || scope === v.activeScope.trim().toLowerCase(),
        inject = v.state === "approved" && match;
      return {
        summary:
          stage === 1
            ? "Stored rule preserves case: " + normalized
            : inject
              ? "Inject approved scoped rule with its evidence"
              : v.state === "retired"
                ? "Retired rule is excluded"
                : !match
                  ? "Scope mismatch"
                  : enough
                    ? "Enough sessions; explicit approval still required"
                    : "Insufficient independent sessions",
        metrics: [
          metric("Independent sessions", sessions.length),
          metric(
            "Repeated deliveries",
            v.sessions.split(",").filter((x) => x.trim()).length -
              sessions.length,
          ),
          metric("Scope matches", match),
          metric("Inject rule", inject),
        ],
        bars: [
          bar("Independent support", sessions.length, v.minimum),
          bar("Required support", v.minimum),
        ],
        columns: ["Session", "Evidence locator"],
        rows: sessions.map((s, i) => [
          s,
          "session:" + s + "#correction-" + (i + 1),
        ]),
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-workflow-hooks-1",
    Object.assign(
      {
        title: "Capture corrections with provenance",
        steps: [
          {
            label: "Input contract",
            detail:
              "A correction is evidence from a specific session and source locator. Preserve the exact case of API_KEY in the rule; case folding would turn a useful instruction into a contradictory one.",
          },
          {
            label: "Capture corrections with provenance",
            detail:
              "rule: Read API_KEY; never rename it to api_key.\nscope: Orchard -> orchard\nsource locator: local:orchard/config.py:12",
          },
          {
            label: "Observe the result",
            detail:
              "Normalize scope for matching, but only collapse rule whitespace. Reject obvious credential-shaped data before it enters the durable store.",
          },
        ],
        caption:
          "Which parts of a source excerpt must the caller sanitize before ingestion?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-workflow-hooks-2",
    Object.assign(
      {
        title: "Count independent sessions",
        steps: [
          {
            label: "Input contract",
            detail:
              "Repeated delivery is not independent evidence. Two distinct corrections in one session still contribute one supporting session. Keep excerpts and locators with the candidate so its source ids remain resolvable later.",
          },
          {
            label: "Count independent sessions",
            detail:
              "events a1,a2 from session A -> sessions=[A]\nevent b1 from session B -> sessions=[A,B]\nrule remains candidate until approval",
          },
          {
            label: "Observe the result",
            detail:
              "Deduplicate event ids using their full validated content. Conflicting reuse of an id must fail rather than silently replace provenance.",
          },
        ],
        caption:
          "Why should API_KEY and api_key rules remain separate candidates?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-workflow-hooks-3",
    Object.assign(
      {
        title: "Approve and select scoped rules",
        steps: [
          {
            label: "Input contract",
            detail:
              "Approval applies to an exact candidate digest. A second source can change that digest and force another review. Retiring a rule removes it from emitted context while keeping its evidence available for inspection.",
          },
          {
            label: "Approve and select scoped rules",
            detail:
              "candidate -> inspect approval_digest\napprove exact digest -> approved\nemit orchard -> original rule + evidence\nretire -> next emit omits rule",
          },
          {
            label: "Observe the result",
            detail:
              "Apply state and scope filtering together. Never let a global or frequently repeated candidate bypass explicit approval.",
          },
        ],
        caption:
          "What should the CLI do when the user supplies yesterday's digest after new evidence arrived?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-workflow-hooks-4",
    Object.assign(
      {
        title: "Persist rules across sessions",
        steps: [
          {
            label: "Input contract",
            detail:
              "The CLI captures JSONL corrections, saves a versioned store, reloads it in another process and emits a neutral JSON hook payload. It retains evidence, supports retirement and preserves API_KEY exactly across restart.",
          },
          {
            label: "Persist rules across sessions",
            detail:
              "capture -> store.json\napprove -> stored state approved\nemit -> additional_context plus evidence locators\nmalformed store -> error, not empty success",
          },
          {
            label: "Observe the result",
            detail:
              "Write a unique sibling temporary file and rename. This store has a single-writer contract; add locking before using simultaneous writers.",
          },
        ],
        caption:
          "How would your agent integration map additional_context into its documented hook wire format?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
