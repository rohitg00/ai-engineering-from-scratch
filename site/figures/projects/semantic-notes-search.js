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
      text("query", "Query", "release replicas"),
      text(
        "notes",
        "Notes separated by |",
        "deploy replicas | restore backups | café guest wifi",
      ),
      text("alias", "One alias from=to", "release=deploy"),
      number("k", "Results k", 2, 1, 3),
      number("expected", "Expected note number", 1, 1, 3),
    ],
    calculate(v) {
      const [from, to] = v.alias.split("=");
      const tokens = (s) => words(s).map((w) => (w === from ? to : w));
      const docs = v.notes.split("|").map(tokens);
      const df = Object.create(null);
      docs.forEach((d) => unique(d).forEach((t) => (df[t] = (df[t] || 0) + 1)));
      const idf = Object.create(null);
      for (const [term, count] of Object.entries(df)) {
        idf[term] = Math.log((1 + docs.length) / (1 + count)) + 1;
      }
      const vector = (terms) => {
        const counts = Object.create(null);
        terms.forEach((t) => {
          if (idf[t]) counts[t] = (counts[t] || 0) + idf[t];
        });
        const norm = Math.sqrt(
          Object.values(counts).reduce((s, n) => s + n * n, 0),
        );
        const weights = Object.create(null);
        for (const [term, count] of Object.entries(counts)) {
          weights[term] = count / norm;
        }
        return weights;
      };
      const q = vector(tokens(v.query));
      const ranked = docs
        .map((doc, i) => {
          const d = vector(doc),
            score = Object.entries(q).reduce(
              (sum, [t, w]) => sum + w * (d[t] || 0),
              0,
            );
          return { id: i + 1, score, matched: unique(doc).filter((t) => q[t]) };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.id - b.id)
        .slice(0, v.k);
      return {
        summary:
          stage === 1
            ? "Canonical query tokens: " + tokens(v.query).join(", ")
            : stage === 4
              ? "Expected note " +
                v.expected +
                (ranked.some((x) => x.id === v.expected)
                  ? " is retrieved"
                  : " is missed")
              : "Sparse cosine scores computed from your notes.",
        metrics: [
          metric("Notes", docs.length),
          metric("Query terms", Object.keys(q).length),
          metric(
            "Hit at k",
            ranked.some((x) => x.id === v.expected),
          ),
        ],
        bars: ranked.map((x) => bar("Note " + x.id, x.score, 1)),
        columns:
          stage === 2
            ? ["Term", "Document frequency", "IDF"]
            : ["Note", "Score", "Matched terms"],
        rows:
          stage === 2
            ? Object.entries(df).map(([t, n]) => [t, n, idf[t].toFixed(4)])
            : ranked.map((x) => [
                x.id,
                x.score.toFixed(4),
                x.matched.join(", "),
              ]),
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-semantic-notes-search-1",
    Object.assign(
      {
        title: "Normalize notes without losing identity",
        steps: [
          {
            label: "Text",
            detail:
              "Orchard operators type café with different Unicode encodings. Apply case folding and NFC normalization to both text and alias keys so equivalent spellings share tokens. An alias is one explicit lexical substitution.",
          },
          {
            label: "Case fold",
            detail:
              '"CAFE\\u0301" -> ["café"]\nalias release -> deploy\n"release café" -> ["deploy","café"]',
          },
          {
            label: "Alias",
            detail:
              "Normalize before the Unicode word regex; otherwise a combining mark can disappear. Do not recursively expand aliases into cycles.",
          },
        ],
        caption:
          "When would mapping release to deploy harm retrieval rather than help it?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-semantic-notes-search-2",
    Object.assign(
      {
        title: "Weight terms by document rarity",
        steps: [
          {
            label: "Count",
            detail:
              "Rare operational terms separate notes better than common project names. Count document frequency once per note, multiply frequency by smoothed rarity, then normalize each sparse vector.",
          },
          {
            label: "Weight",
            detail:
              "N=3; df(orchard)=3 -> idf=1\ndf(restore)=1 -> idf=log(4/2)+1=1.6931",
          },
          {
            label: "Normalize",
            detail:
              "Build a set of words per document for document frequency. Repeating orchard ten times in one note does not make it occur in ten documents.",
          },
        ],
        caption:
          "Why normalize vector length before comparing a short note with a long runbook?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-semantic-notes-search-3",
    Object.assign(
      {
        title: "Rank queries with a stable tie rule",
        steps: [
          {
            label: "Query",
            detail:
              "The CLI returns paths, previews and matching tokens for your own markdown folder. Query and note vectors use the same alias map and IDF table; unknown terms contribute no weight.",
          },
          {
            label: "Dot product",
            detail:
              "query=release replicas\nalias release=deploy\nmatching note: release.md; matched terms: deploy (replica is singular in the file fixture)",
          },
          {
            label: "Top k",
            detail:
              "Compute the query vector using index IDF, then dot products against note vectors. Break equal scores by document id.",
          },
        ],
        caption:
          "What does an empty result mean if the note uses a synonym absent from the alias map?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-semantic-notes-search-4",
    Object.assign(
      {
        title: "Measure retrieval before adding embeddings",
        steps: [
          {
            label: "Labels",
            detail:
              "Measure whether the intended note appears near the top before adding a different retrieval backend. The supplied notes span deployment, restore and guest Wi-Fi so an alias can help one topic while harming another.",
          },
          {
            label: "Retrieve",
            detail:
              "labels: restore -> backup.md; café -> café.md\nhits=2,total=2,k=1 -> recall=1\nadd a misleading alias -> inspect changed hit ids",
          },
          {
            label: "Score",
            detail:
              "Keep labeled queries outside the tuning examples. Call the actual search function inside evaluation instead of reconstructing a separate scorer.",
          },
        ],
        caption:
          "How many new labels would you collect before claiming improved retrieval for beginners?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
