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
      text("source", "Evidence", "Alice defeated Bob after 2 retries"),
      text("claim", "Claim", "Bob defeated Alice after 2 retries"),
      check("cited", "Citation resolves", true),
      number("threshold", "Lexical threshold", 0.8, 0, 1, 0.05),
      text("deltas", "Paired score deltas", "5,5,-30"),
    ],
    calculate(v) {
      const stop = new Set(["a", "an", "the", "is", "of", "and"]);
      const c = words(v.claim).filter((x) => !stop.has(x)),
        s = words(v.source).filter((x) => !stop.has(x));
      const neg = (x) =>
        unique(x.filter((t) => ["no", "not", "never", "cannot"].includes(t)))
          .sort()
          .join();
      let pos = 0;
      const ordered = c.every((w) => {
        let at = s.indexOf(w, pos);
        if (at < 0) return false;
        pos = at + 1;
        return true;
      });
      const numeric = unique(v.claim.match(/\d+(?:\.\d+)?/g) || []).every((n) =>
        (v.source.match(/\d+(?:\.\d+)?/g) || []).includes(n),
      );
      const overlap = c.length
        ? unique(c).filter((t) => s.includes(t)).length / unique(c).length
        : 0;
      const reverse = unique(c).every((t) => s.includes(t)) && !ordered;
      const reason = !c.length
        ? "empty"
        : !v.cited
          ? "uncited"
          : neg(c) !== neg(s)
            ? "negation"
            : !numeric
              ? "number"
              : reverse
                ? "order_requires_review"
                : "lexical_overlap";
      const score = reason === "lexical_overlap" ? overlap : 0,
        kept = score >= v.threshold && c.length > 0 && v.cited;
      const d = finiteList(v.deltas);
      return {
        summary:
          stage === 4
            ? "Mean paired change " +
              (d.reduce((a, b) => a + b, 0) / d.length).toFixed(2) +
              "; regressions remain visible."
            : reason + ": lexical checks cannot establish truth.",
        metrics: [
          metric("Raw word overlap", overlap.toFixed(3)),
          metric("Guarded score", score.toFixed(3)),
          metric(
            "State",
            !c.length ? "no_evidence" : kept ? "lexical_match" : "needs_review",
          ),
          metric("Missing reference labels", "recall / coverage unavailable"),
        ],
        bars:
          stage === 4
            ? d.map((x, i) => bar("Question " + (i + 1), x))
            : [
                bar("Word overlap", overlap, 1),
                bar("Guarded support", score, 1),
              ],
        columns: ["Check", "Result"],
        rows: [
          ["Citation", v.cited],
          ["Number agreement", numeric],
          ["Ordered match", ordered],
          ["Human review needed", !kept],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-report-judge-1",
    Object.assign(
      {
        title: "Parse claims and citation references",
        steps: [
          {
            label: "Input",
            detail:
              "Audit each factual sentence separately. Orchard has a sourced retry limit and an unrelated deployment claim; one valid marker must not make the whole paragraph pass.",
          },
          {
            label: "Transform",
            detail:
              "Worker A invokes worker B [S1]. Retry limit is 99 [S2].\nclaim 1 -> cites [S1]\nclaim 2 -> cites [S2]",
          },
          {
            label: "Verify",
            detail:
              "Extract markers before removing them from the claim text. Deduplicate repeated markers without discarding sentence identity.",
          },
        ],
        caption:
          "What should happen when [S2] is absent from the evidence map?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-report-judge-2",
    Object.assign(
      {
        title: "Check evidence before averaging scores",
        steps: [
          {
            label: "Input",
            detail:
              'Word overlap misses relationships. The claim "Bob defeated Alice" shares every word with "Alice defeated Bob" but reverses who did what. Reject the ordering mismatch for human review; do not label this check semantic understanding.',
          },
          {
            label: "Transform",
            detail:
              "source: Alice defeated Bob\nclaim: Bob defeated Alice\nword overlap=1; order check=false\nresult: order_requires_review",
          },
          {
            label: "Verify",
            detail:
              "Compare ordered content tokens only after the negation and numeric guards. This conservative rule can reject valid paraphrases, so keep the reason visible.",
          },
        ],
        caption:
          "Write one true paraphrase that your lexical rule rejects. What evidence would a human need to resolve it?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-report-judge-3",
    Object.assign(
      {
        title: "Report precision coverage and source recall",
        steps: [
          {
            label: "Input",
            detail:
              "An empty report has no evidence and scores zero. Recall and fact coverage require labels; without labels they are unavailable, rather than automatically perfect. Only supported claims earn source recall or coverage.",
          },
          {
            label: "Transform",
            detail:
              "empty claims -> score 0, state no_evidence\n3 lexical matches, no reference labels -> recall null, coverage null\nscore is computed only from available metrics",
          },
          {
            label: "Verify",
            detail:
              "Track supported claims once and derive all supported-evidence metrics from that collection. Do not let a dangling citation inflate source recall.",
          },
        ],
        caption:
          "Why can a 100 lexical-match score coexist with unavailable recall?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-report-judge-4",
    Object.assign(
      {
        title: "Compare paired revisions with bootstrap intervals",
        steps: [
          {
            label: "Input",
            detail:
              "Compare the same questions before and after a report change. A gain on easy questions can hide one damaging regression; preserve per-question deltas beside the bootstrap interval.",
          },
          {
            label: "Transform",
            detail:
              "baseline: q1=80,q2=70,q3=90\ncandidate: q1=85,q2=75,q3=60\ndeltas: +5,+5,-30; q3 remains a regression",
          },
          {
            label: "Verify",
            detail:
              "Resample paired deltas with a deterministic seed. The interval describes this labeled sample, not factual accuracy on every future report.",
          },
        ],
        caption:
          "Would adding a second copy of q1 create independent evidence?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
