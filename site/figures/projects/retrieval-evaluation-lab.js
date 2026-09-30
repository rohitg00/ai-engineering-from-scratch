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
      text("grades", "Judgments id:grade", "a:3,b:1,c:0"),
      text("order", "Candidate ranking", "b,a,c"),
      text("baseline", "Baseline ranking", "c,b,a"),
      number("k", "Cutoff k", 3, 1, 6),
    ],
    calculate(v) {
      const grade = {};
      v.grades.split(",").forEach((part) => {
        const [id, raw] = part.trim().split(":");
        const n = Number(raw);
        if (!id || !Number.isInteger(n) || n < 0 || n > 3 || id in grade)
          throw Error("Unique ids with grades 0..3 required");
        grade[id] = n;
      });
      const rank = (s) => {
        const ids = s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        if (unique(ids).length !== ids.length)
          throw Error("Ranking contains duplicate ids");
        return ids;
      };
      const ideal = Object.values(grade)
        .sort((a, b) => b - a)
        .slice(0, v.k)
        .reduce((sum, n, i) => sum + (2 ** n - 1) / Math.log2(i + 2), 0);
      const calculate = (ids) => {
        const top = ids.slice(0, v.k),
          hits = top.filter((id) => grade[id] > 0).length,
          relevant = Object.values(grade).filter((n) => n > 0).length;
        const dcg = top.reduce(
          (sum, id, i) => sum + (2 ** (grade[id] || 0) - 1) / Math.log2(i + 2),
          0,
        );
        return {
          precision: hits / v.k,
          recall: relevant ? hits / relevant : 0,
          dcg,
          ndcg: ideal ? dcg / ideal : 0,
          unjudged: top.filter((id) => !(id in grade)).length,
        };
      };
      const ids = rank(v.order),
        a = calculate(rank(v.baseline)),
        b = calculate(ids);
      return {
        summary:
          stage === 4
            ? "NDCG change " +
              (b.ndcg - a.ndcg).toFixed(4) +
              (b.ndcg < a.ndcg ? " = regression" : "")
            : stage === 1
              ? "Validated unique ranked evidence."
              : "Discounted gain is computed from the editable ordering.",
        metrics: Object.entries(b).map(([key, val]) =>
          metric(key, typeof val === "number" ? Number(val.toFixed(4)) : val),
        ),
        bars: [
          bar("Baseline NDCG", a.ndcg, 1),
          bar("Candidate NDCG", b.ndcg, 1),
        ],
        columns: ["Rank", "Document", "Relevance", "Discounted gain"],
        rows: ids
          .slice(0, v.k)
          .map((id, i) => [
            i + 1,
            id,
            grade[id] ?? "unjudged",
            ((2 ** (grade[id] || 0) - 1) / Math.log2(i + 2)).toFixed(4),
          ]),
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-retrieval-evaluation-lab-1",
    Object.assign(
      {
        title: "Validate rankings and graded judgments",
        steps: [
          {
            label: "Ranking",
            detail:
              "A ranking is an ordered list of unique document ids. The Orchard restore query has graded evidence: a recovery procedure is more useful than a passing mention in release notes.",
          },
          {
            label: "Judgments",
            detail:
              "judgments: restore=3, release=1, cafe=0\nranking: [release, restore, restore] -> duplicate error",
          },
          {
            label: "Contract",
            detail:
              "Validate rankings and judgments before scoring. Keep unjudged documents visible instead of assuming they were reviewed and found irrelevant.",
          },
        ],
        caption:
          "What does a missing judgment mean when your corpus has just gained a new note?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-retrieval-evaluation-lab-2",
    Object.assign(
      {
        title: "Compute precision and recall at k",
        steps: [
          {
            label: "Cutoff",
            detail:
              "At k=2, retrieving one relevant note and one irrelevant note gives precision 1/2. If the labels contain two relevant notes, recall is also 1/2. The denominator comes from a different place in each metric.",
          },
          {
            label: "Hits",
            detail:
              "ranking[:2]=[restore,cafe]\nrelevant labels={restore,release}\nprecision=1/2; recall=1/2",
          },
          {
            label: "Denominators",
            detail:
              "Count positive relevance labels as relevant, not merely keys in the judgment map. Keep the supplied cutoff even when fewer results are returned.",
          },
        ],
        caption:
          "Why can increasing k improve recall while lowering precision?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-retrieval-evaluation-lab-3",
    Object.assign(
      {
        title: "Reward useful evidence near the top",
        steps: [
          {
            label: "Rank",
            detail:
              "Place stronger evidence earlier. With gains 3 and 1, ranking the weaker source first reduces discounted gain even though the retrieved document set is unchanged.",
          },
          {
            label: "Discount",
            detail:
              "ranking [release,restore]: DCG=1 + 7/log2(3)=5.4165\nideal [restore,release]: DCG=7 + 1/log2(3)=7.6309\nNDCG=0.7098",
          },
          {
            label: "Normalize",
            detail:
              "Use gain 2^relevance-1 and discount log2(rank+1). Normalize against the best labeled ordering at the same cutoff.",
          },
        ],
        caption: "What should NDCG return if every labeled gain is zero?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-retrieval-evaluation-lab-4",
    Object.assign(
      {
        title: "Compare systems query by query",
        steps: [
          {
            label: "Align",
            detail:
              "The supplied three-query fixture improves release and café retrieval while making restore retrieval worse. Sort query-level deltas so the lost recovery evidence appears before the aggregate.",
          },
          {
            label: "Measure",
            detail:
              "release: improved\ncafe: improved\nrestore: regressed\n--fail-on-regression -> exit 1",
          },
          {
            label: "Aggregate",
            detail:
              "Align systems on the judgment query ids. Save before/after ranked ids with each delta; a number alone does not identify the moved source.",
          },
        ],
        caption: "Which query deserves review first if average NDCG rises?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
