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
      text("query", "Request", "release replicas"),
      text(
        "keywords",
        "Skill keywords comma-separated",
        "release,replicas,release",
      ),
      text(
        "files",
        "Changed paths comma-separated",
        "deploy/orchard.yaml,deploy/orchard.yaml",
      ),
      number("competitor", "Second skill score", 6, 0, 20),
      number("margin", "Required score margin", 2, 0, 6),
      check("permission", "Dependency read permission available", true),
    ],
    calculate(v) {
      const q = new Set(words(v.query)),
        keywords = unique(
          v.keywords
            .split(",")
            .map((x) => x.trim().normalize("NFC").toLowerCase()),
        ).filter((w) => words(w).some((t) => q.has(t)));
      const paths = unique(
        v.files.split(",").map((x) => x.trim().replaceAll("\\", "/")),
      ).filter((p) => p.startsWith("deploy/") && !p.split("/").includes(".."));
      const score = keywords.length * 2 + paths.length * 3;
      const status =
        score === 0
          ? "no-match"
          : Math.abs(score - v.competitor) < v.margin
            ? "ambiguous"
            : v.competitor > score
              ? "other skill leads"
              : !v.permission
                ? "blocked"
                : "ready";
      return {
        summary:
          status +
          (status === "ready" ? ": check-tests -> release-review" : ""),
        metrics: [
          metric("Keyword points", keywords.length * 2),
          metric("Path points", paths.length * 3),
          metric("Duplicates contribute", "0"),
          metric("Margin", Math.abs(score - v.competitor)),
        ],
        bars: [bar("Release review", score), bar("Other skill", v.competitor)],
        columns: ["Evidence", "Contribution"],
        rows: keywords
          .map((w) => ["keyword:" + w, 2])
          .concat(paths.map((p) => ["path:" + p, 3])),
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-skill-router-1",
    Object.assign(
      {
        title: "Parse a typed skill catalog",
        steps: [
          {
            label: "Input contract",
            detail:
              "Discover a skill from its SKILL.md name and description, then read routing.json as a local routing extension. The directory name must match the skill name. Routing metadata is not part of the portable skill format.",
          },
          {
            label: "Parse a typed skill catalog",
            detail:
              "skills/release-review/SKILL.md -> name release-review\nrouting.json -> keywords,paths,priority,requires,permissions",
          },
          {
            label: "Observe the result",
            detail:
              "Validate the merged record with parseSkill. Refuse symlinked or oversized discovery files before parsing them.",
          },
        ],
        caption:
          "What should happen when directory release-review declares name publish?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-router-2",
    Object.assign(
      {
        title: "Score words and repository paths",
        steps: [
          {
            label: "Input contract",
            detail:
              "Repeated evidence must not inflate a match. The Orchard request repeats the same changed path, but it should earn its path contribution only once. Keywords contribute two points and distinct matched paths contribute three.",
          },
          {
            label: "Score words and repository paths",
            detail:
              "keywords release,replicas -> 4 points\nfiles deploy/orchard.yaml repeated twice -> 3 points\nscore=7, not 10",
          },
          {
            label: "Observe the result",
            detail:
              "Canonicalize separators and deduplicate before scoring. Keep reasons aligned with the exact evidence counted.",
          },
        ],
        caption:
          "Should two different path rules matching one file count as two independent observations?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-router-3",
    Object.assign(
      {
        title: "Resolve dependencies before execution",
        steps: [
          {
            label: "Input contract",
            detail:
              "Selecting release-review first requires check-tests. A depth-first traversal emits dependencies before the selected skill and validates permissions throughout the graph. A denied dependency blocks the whole plan.",
          },
          {
            label: "Resolve dependencies before execution",
            detail:
              "release-review requires check-tests\nallowed=[read]\nplan=[check-tests,release-review]",
          },
          {
            label: "Observe the result",
            detail:
              "Track active and visited sets separately: active finds cycles, visited prevents repeated execution. Do not append a parent before its dependencies.",
          },
        ],
        caption:
          "What would happen if check-tests secretly required a network permission?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-router-4",
    Object.assign(
      {
        title: "Abstain on ambiguous or blocked requests",
        steps: [
          {
            label: "Input contract",
            detail:
              "Abstain when two skills score too closely or the chosen plan needs unavailable permissions. An explanation of why routing stopped is more useful than an arbitrary winning skill.",
          },
          {
            label: "Abstain on ambiguous or blocked requests",
            detail:
              "publish request -> release-publish score 2\nallowed=[read]; publish requires network\nstatus=blocked, no execution plan",
          },
          {
            label: "Observe the result",
            detail:
              "Apply the score margin before dependency planning. Treat ranking as evidence for selection, not authority to execute a tool.",
          },
        ],
        caption:
          "How would you tune one ambiguous keyword without overfitting to the example request?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
