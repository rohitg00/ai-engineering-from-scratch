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
      text("name", "Metadata name", "orchard-release"),
      text("directory", "Directory name", "orchard-release"),
      text("description", "Description", "Check deployment evidence"),
      text("body", "Instructions", "Read the restore log before approving."),
      text("resource", "Resource path", "references/restore.md"),
      check("activate", "Activate instructions", true),
      number("budget", "Character budget", 120, 0, 300),
    ],
    calculate(v) {
      const grammar =
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.name) && v.name.length <= 64,
        identity = v.name === v.directory;
      const safe =
        !!v.resource &&
        !v.resource.startsWith("/") &&
        !v.resource.includes("\\") &&
        v.resource.split("/").every((p) => p && p !== "." && p !== "..");
      const discovery = v.name + ": " + v.description,
        context = discovery + (v.activate && v.body ? "\n\n" + v.body : "");
      const count = [...context].length;
      return {
        summary: !grammar
          ? "Invalid name"
          : !identity
            ? "Directory identity conflict"
            : !safe
              ? "Resource path rejected"
              : count > v.budget
                ? "Limit: complete context does not fit"
                : "Complete context accepted by the modeled checks",
        metrics: [
          metric("Name valid", grammar),
          metric("Directory matches", identity),
          metric("Characters", count),
          metric("Tokens", "not measured"),
        ],
        bars: [
          bar("Context characters", count, v.budget),
          bar("Allowed characters", v.budget),
        ],
        columns: ["Boundary", "Value"],
        rows: [
          ["Quoted metadata", "name: " + JSON.stringify(v.name)],
          ["Discovery", discovery],
          ["Context", context],
          [
            "Resource",
            safe
              ? "lexically relative; filesystem must be checked"
              : "rejected",
          ],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-skill-validator-1",
    Object.assign(
      {
        title: "Parse an explicit frontmatter subset",
        steps: [
          {
            label: "Header boundary",
            detail:
              "The installer emits quoted metadata. Accept plain single-line scalars and JSON-compatible double-quoted scalars, including escaped quotes and Unicode. Reject tags, aliases and multiline YAML rather than silently reinterpreting them.",
          },
          {
            label: "Key split",
            detail:
              'description: "Check \\"replicas\\" first"\nparsed description: Check "replicas" first\ndescription: | -> unsupported syntax',
          },
          {
            label: "Duplicate gate",
            detail:
              "Split a header line at its first colon. Decode quoted values before metadata validation; duplicate keys are conflicts.",
          },
        ],
        caption:
          "Why does a standards-compatible subset need an explicit unsupported-syntax error?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-validator-2",
    Object.assign(
      {
        title: "Validate names and descriptions",
        steps: [
          {
            label: "Read fields",
            detail:
              "Metadata identifies a package. Orchard-release with an uppercase letter fails the portable lowercase grammar; orchard-release in a differently named directory fails identity validation.",
          },
          {
            label: "Name grammar",
            detail:
              "directory=orchard-release\nname=orchard-release -> valid\nname=orchard--release -> invalid name",
          },
          {
            label: "Folder identity",
            detail:
              "Count name bytes and description Unicode scalar values according to the contract. Preserve the human description after parsing.",
          },
        ],
        caption:
          "Why should changing a directory name require changing metadata too?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-validator-3",
    Object.assign(
      {
        title: "Contain resource paths",
        steps: [
          {
            label: "Relative input",
            detail:
              "Resource lookup is relative to the skill folder. Resolve references/restore.md and verify its canonical path stays within that folder; reject parent traversal before reading anything.",
          },
          {
            label: "Component gate",
            detail:
              "resource references/restore.md -> contained file\nresource ../private.md -> invalid component\nsymlink outside root -> escapes root",
          },
          {
            label: "Canonicalize",
            detail:
              "Validate path components before joining, then canonicalize. This educational loader does not close adversarial path-replacement races.",
          },
        ],
        caption:
          "Why is starts_with on raw path text insufficient for containment?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-skill-validator-4",
    Object.assign(
      {
        title: "Load context within a character budget",
        steps: [
          {
            label: "Discover metadata",
            detail:
              "Discovery loads metadata only; activation appends instructions. The CLI can then append one explicit reference if the complete context fits. Count characters, not bytes or model tokens, and never truncate half an instruction.",
          },
          {
            label: "Choose activation",
            detail:
              "metadata length=80; body=120; separators=2\nactivation needs 202 characters\nbudget 200 -> Limit",
          },
          {
            label: "Count characters",
            detail:
              "Assemble the complete context before comparing its character count with the budget. Include separators and requested resource text.",
          },
        ],
        caption:
          "How would you expose a tokenizer-based budget without confusing it with this character limit?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
