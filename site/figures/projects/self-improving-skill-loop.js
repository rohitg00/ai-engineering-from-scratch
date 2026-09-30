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
      text("development", "Development message", "Invoice wrong"),
      text("holdout", "Holdout message", "INVOICE wrong"),
      text("groups", "Development/holdout group ids", "june,august"),
      text("baseline", "Baseline correctness per case", "0,1,0"),
      text("candidate", "Candidate correctness per case", "1,1,1"),
      number("minimum", "Minimum accuracy gain", 0.05, 0, 1, 0.05),
      check("approved", "Exact candidate approved", false),
    ],
    calculate(v) {
      const normalize = (s) =>
        s.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
      const [a, b] = v.groups.split(",").map((x) => x.trim());
      const contentLeak = normalize(v.development) === normalize(v.holdout),
        groupLeak = !!a && a === b;
      const old = finiteList(v.baseline),
        now = finiteList(v.candidate);
      if (
        old.length !== now.length ||
        old.concat(now).some((x) => x !== 0 && x !== 1)
      )
        throw Error("Use equal-length 0/1 correctness lists");
      const before = old.reduce((x, y) => x + y, 0) / old.length,
        after = now.reduce((x, y) => x + y, 0) / now.length,
        regressions = old.filter((n, i) => n === 1 && now[i] === 0).length;
      const eligible =
        !contentLeak &&
        !groupLeak &&
        after - before >= v.minimum &&
        !regressions;
      return {
        summary:
          contentLeak || groupLeak
            ? "Leakage blocks evaluation"
            : eligible
              ? v.approved
                ? "Candidate eligible and explicitly approved"
                : "Candidate eligible; awaiting exact approval"
              : "Gate blocks promotion",
        metrics: [
          metric("Content leak", contentLeak),
          metric("Group leak", groupLeak),
          metric("Gain", (after - before).toFixed(3)),
          metric("Regressions", regressions),
        ],
        bars: [
          bar("Baseline accuracy", before, 1),
          bar("Candidate accuracy", after, 1),
        ],
        columns: ["Case", "Baseline correct", "Candidate correct"],
        rows: old.map((x, i) => [i + 1, x, now[i]]),
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-self-improving-skill-loop-1",
    Object.assign(
      {
        title: "Split labeled cases without identity leakage",
        steps: [
          {
            label: "Input",
            detail:
              "Holdout separation must follow content and groups, not just ids. Two tickets with different ids can repeat the same customer message. Normalize content and union related records before assigning the component to a partition.",
          },
          {
            label: "Transform",
            detail:
              'id d1: "Invoice wrong"\nid h1: "INVOICE   wrong"\nfingerprint equal -> one partition, or reject explicit split',
          },
          {
            label: "Verify",
            detail:
              "Union both duplicate-content edges and group edges before hashing a component. Reject conflicting labels for identical normalized content.",
          },
        ],
        caption:
          "Can two distinct messages from one customer thread safely be treated as independent examples?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-self-improving-skill-loop-2",
    Object.assign(
      {
        title: "Execute and score a transparent routing skill",
        steps: [
          {
            label: "Input",
            detail:
              "The routing skill is a transparent ordered list. A rule requires every term, and the first matching rule wins. Record each expected/predicted pair before calculating accuracy so errors can drive a proposal.",
          },
          {
            label: "Transform",
            detail:
              'rule terms=[password,reset], label=access\n"password reset expired" -> access\n"password rejected" -> unknown',
          },
          {
            label: "Verify",
            detail:
              "Normalize input words once. Empty term sets must never become match-everything rules.",
          },
        ],
        caption:
          "What happens when a broad early rule shadows a more precise later rule?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-self-improving-skill-loop-3",
    Object.assign(
      {
        title: "Propose rules from development errors only",
        steps: [
          {
            label: "Input",
            detail:
              "Propose from development errors only. Invoice appears in two billing examples and can become a rule; a term used by both billing and access examples is ambiguous. Keep the holdout text out of this function.",
          },
          {
            label: "Transform",
            detail:
              "development: invoice wrong; invoice late -> billing\nmin_support=2 -> candidate terms=[invoice]\nholdout: invoice missing -> used only after proposal",
          },
          {
            label: "Verify",
            detail:
              "Count each term once per case and collect all associated labels. Require a unique label and enough independent support before proposing it.",
          },
        ],
        caption:
          "What failure would repeated copies of one development message cause without deduplication?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-self-improving-skill-loop-4",
    Object.assign(
      {
        title: "Require a separate gate before promotion",
        steps: [
          {
            label: "Input",
            detail:
              "A passing holdout gate produces a candidate digest for human review. Promotion requires that exact digest, writes a versioned rules file, and preserves the previous file for rollback. Published sample tickets are examples, not an unseen benchmark.",
          },
          {
            label: "Transform",
            detail:
              "baseline accuracy=0; candidate accuracy=1; no regression -> eligible\nwrong digest -> no write\nexact digest -> promote and retain .previous",
          },
          {
            label: "Verify",
            detail:
              "Bind approval to serialized rule content and recompute the digest before writing. Never infer approval from a good score.",
          },
        ],
        caption:
          "How would you freeze the next holdout before editing the skill again?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
