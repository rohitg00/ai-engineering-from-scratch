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
      text("before", "Previous policy", "tokens expire after 60 minutes"),
      text("after", "Incoming policy", "tokens expire after 15 minutes"),
      check("present", "Document present in incoming corpus", true),
      number("oldTime", "Previous timestamp", 100, 0, 500),
      number("updated", "Incoming timestamp", 200, 0, 500),
      number("now", "Query time", 210, 0, 600),
      number("maxAge", "Maximum age", 60, 0, 300),
      number("expected", "Expected version", 1, 0, 5),
      number("current", "Current version", 1, 0, 5),
    ],
    calculate(v) {
      const normal = (s) => s.normalize("NFC").replace(/\r\n/g, "\n").trim();
      const operation = !v.present
        ? "delete"
        : normal(v.before) !== normal(v.after)
          ? "update"
          : v.updated !== v.oldTime
            ? "refresh"
            : "unchanged";
      const age = v.now - v.updated,
        eligible = v.present && age >= 0 && age <= v.maxAge,
        commit = v.current === v.expected;
      return {
        summary:
          stage === 3
            ? commit
              ? "Version matches: next snapshot " + (v.current + 1)
              : "Stale writer: preserve version " + v.current
            : stage === 4
              ? eligible
                ? "Current source eligible"
                : "Source excluded at query time"
              : "Planned operation: " + operation,
        metrics: [
          metric("Operation", operation),
          metric("Age", age),
          metric("Citation eligible", eligible),
          metric("CAS accepted", commit),
        ],
        bars: [
          bar("Source age", Math.max(0, age), v.maxAge),
          bar("Allowed age", v.maxAge),
        ],
        columns: ["Field", "Before", "After"],
        rows: [
          [
            "Normalized text",
            normal(v.before),
            v.present ? normal(v.after) : "(deleted)",
          ],
          ["Timestamp", v.oldTime, v.updated],
          ["Snapshot version", v.current, commit ? v.current + 1 : v.current],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-rag-freshness-pipeline-1",
    Object.assign(
      {
        title: "Normalize documents and fingerprint content",
        steps: [
          {
            label: "Input",
            detail:
              "The Orchard policy keeps the same document id when its timeout changes. Normalize Unicode and line endings before hashing the body, and retain updated time separately. A later observation of unchanged content is a refresh, not a rewrite.",
          },
          {
            label: "Transform",
            detail:
              "id=orchard-auth\ntext: tokens expire after 60 minutes\nupdated: 100 -> 200\ncontent hash: unchanged",
          },
          {
            label: "Verify",
            detail:
              "Hash normalized UTF-8 bytes. Do not hash the timestamp into content identity.",
          },
        ],
        caption:
          "Why should two differently encoded versions of café produce the same fingerprint?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-rag-freshness-pipeline-2",
    Object.assign(
      {
        title: "Plan inserts updates deletions and refreshes",
        steps: [
          {
            label: "Input",
            detail:
              "Ingestion receives a complete corpus snapshot. The after fixture replaces a retired backup note and edits the token lifetime. Missing ids must be deleted so obsolete evidence cannot remain searchable.",
          },
          {
            label: "Transform",
            detail:
              "before ids: orchard-auth, retired-backup\nafter ids: orchard-auth, restore-runbook\nupdate: orchard-auth; delete: retired-backup; insert: restore-runbook",
          },
          {
            label: "Verify",
            detail:
              "Build the incoming id map before deciding any operation. A duplicate incoming id is an error, not last-write-wins.",
          },
        ],
        caption:
          "How would the contract change if the importer received only a partial change feed?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-rag-freshness-pipeline-3",
    Object.assign(
      {
        title: "Persist an index with atomic replacement",
        steps: [
          {
            label: "Input",
            detail:
              "Two ingestion processes can read version 1 simultaneously. A persistent sibling lock serializes their version checks and replacement writes. Exactly one may commit with expected_version=1; the next writer must reread.",
          },
          {
            label: "Transform",
            detail:
              "writer A expects 1 -> commits version 2\nwriter B expects 1 -> stale index version\nindex.json.lock remains as the stable lock inode",
          },
          {
            label: "Verify",
            detail:
              "On POSIX, hold flock across read, compare, fsync and rename. Never unlink the lock after release: waiting processes could then lock different files.",
          },
        ],
        caption:
          "What happens if a process exits after writing the temporary file but before rename?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-rag-freshness-pipeline-4",
    Object.assign(
      {
        title: "Exclude expired evidence at query time",
        steps: [
          {
            label: "Input",
            detail:
              "After the edit, a query must return the 15-minute policy and never the retired 60-minute text. Freshness is enforced when answering, even if no ingestion job has run since the last snapshot.",
          },
          {
            label: "Transform",
            detail:
              "updated=200; now=210; max_age=60 -> age 10, eligible\nupdated=200; now=500; max_age=60 -> age 300, excluded",
          },
          {
            label: "Verify",
            detail:
              "Read one committed snapshot for the query. Return its version and the source hash with each hit so callers can detect stale citations.",
          },
        ],
        caption:
          "Should a future-dated document receive a negative age and become the best result?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
