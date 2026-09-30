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
      text("name", "Skill name", "orchard-release"),
      text("description", "Description", "Review deployment evidence"),
      text("file", "Resource path", "references/checklist.md"),
      select("agent", "Target agent", "codex", ["codex", "claude", "cursor"]),
      text("installed", "Installed file text", "Check replicas"),
      text("current", "Current local file text", "Check replicas"),
      text("incoming", "Incoming upgrade text", "Check replicas and restore"),
      check("digestMatches", "Trusted source digest matches", true),
    ],
    calculate(v) {
      const valid =
        /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(v.name) &&
        !v.name.includes("--") &&
        !!v.description.trim() &&
        [...v.description].length <= 1024;
      const safe =
        !!v.file &&
        !v.file.startsWith("/") &&
        !v.file.includes("\\") &&
        !v.file.split("/").some((x) => !x || x === "." || x === "..") &&
        !/^[A-Za-z]:/.test(v.file);
      const conflict = v.installed !== v.current;
      const destination =
        {
          codex: ".agents/skills",
          claude: ".claude/skills",
          cursor: ".cursor/skills",
        }[v.agent] +
        "/" +
        v.name;
      return {
        summary:
          !valid || !safe
            ? "Bundle rejected"
            : !v.digestMatches
              ? "Integrity mismatch"
              : conflict
                ? "Upgrade blocked: preserve local edit"
                : stage === 2
                  ? "Quoted metadata is compatible with the validator"
                  : "Bundle can be staged at " + destination,
        metrics: [
          metric("Metadata valid", valid),
          metric("Path contained lexically", safe),
          metric("Local edit conflict", conflict),
        ],
        bars: [
          bar("Current characters", [...v.current].length),
          bar("Upgrade characters", [...v.incoming].length),
        ],
        columns: ["Field", "Value"],
        rows: [
          ["Destination", destination],
          ["YAML name", "name: " + JSON.stringify(v.name)],
          ["YAML description", "description: " + JSON.stringify(v.description)],
          [
            "Upgrade diff",
            v.current === v.incoming
              ? "unchanged"
              : v.current + " -> " + v.incoming,
          ],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-skill-installer-1",
    Object.assign(
      {
        title: "Validate a portable bundle",
        steps: [
          {
            label: "Input contract",
            detail:
              "A portable bundle carries metadata and relative UTF-8 files. Treat SKILL.md as an entry document and reject any resource name that could escape the selected install root. The original Orchard bundle includes a restore checklist.",
          },
          {
            label: "Validate a portable bundle",
            detail:
              "name=orchard-release\nfiles: SKILL.md, references/checklist.md\n../settings.json -> rejected",
          },
          {
            label: "Observe the result",
            detail:
              "Validate every file path before creating directories. Reserve .installed.json for the installer receipt.",
          },
        ],
        caption:
          "Why must a Windows backslash be rejected even when the current machine uses slash paths?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-installer-2",
    Object.assign(
      {
        title: "Translate metadata and hash content",
        steps: [
          {
            label: "Input contract",
            detail:
              "Serialize name and description as JSON-compatible double-quoted YAML scalars. The Rust validator accepts that same subset, including escapes. Source and translated digests differ because translation rewrites metadata.",
          },
          {
            label: "Translate metadata and hash content",
            detail:
              'source bundle digest -> expected source identity\ntranslated SKILL.md: name: "orchard-release"\ntranslated digest -> installed content identity',
          },
          {
            label: "Observe the result",
            detail:
              "Sort file entries before hashing. A digest verifies content against a trusted expectation; computing it from untrusted bytes does not establish publisher identity.",
          },
        ],
        caption:
          "How should a description containing a quote survive installer-to-validator round trip?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-installer-3",
    Object.assign(
      {
        title: "Install atomically within a root",
        steps: [
          {
            label: "Input contract",
            detail:
              "Install into a caller-owned disposable root. The installer writes every file to a private sibling directory and renames it into the agent discovery path only after the bundle is complete.",
          },
          {
            label: "Install atomically within a root",
            detail:
              "root/.agents/skills/orchard-release/\nSKILL.md + references/checklist.md + .installed.json",
          },
          {
            label: "Observe the result",
            detail:
              "Check parent directories for symlinks before staging. Keep the agent directory mapping separate from portable skill content.",
          },
        ],
        caption:
          "What should a reader observe if a write fails before the rename?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-installer-4",
    Object.assign(
      {
        title: "Protect edits during upgrades",
        steps: [
          {
            label: "Input contract",
            detail:
              "An upgrade must preserve local edits. Compare the current files with the previous installed digest and reject modified or unmanaged files. The demo edits the checklist, retries installation, and retains the edit.",
          },
          {
            label: "Protect edits during upgrades",
            detail:
              "installed checklist hash=A\nlocal edit -> current hash=B\nupgrade -> modified installation; local text remains",
          },
          {
            label: "Observe the result",
            detail:
              "Read the existing receipt and verify its file list before moving the destination. Restore a moved backup if the final rename fails.",
          },
        ],
        caption:
          "What would a reviewable merge need to show before replacing a locally edited checklist?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
