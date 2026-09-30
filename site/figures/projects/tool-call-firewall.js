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
      select("role", "Trusted role", "editor", ["reader", "editor", "unknown"]),
      select("tool", "Requested tool", "write", ["read", "write", "shell"]),
      text("path", "Relative path", "notes.md"),
      text("approvedText", "Approved content", "Release after restore"),
      text("content", "Proposed content", "Release after restore"),
      check("approved", "Approval receipt exists", true),
      check("used", "Receipt already used", false),
      number("entries", "Audit entries", 1, 0, 10),
      number("cap", "Audit capacity", 4, 1, 10),
    ],
    calculate(v) {
      const safe =
        !!v.path &&
        !v.path.startsWith(".") &&
        !v.path.startsWith("/") &&
        !v.path.includes("\\") &&
        v.path.split("/").every((p) => p && p !== "." && p !== "..");
      const policy =
        !["reader", "editor"].includes(v.role) || !safe
          ? "Deny"
          : v.tool === "read"
            ? "Allow"
            : v.role === "editor" && v.tool === "write"
              ? "ApprovalRequired"
              : "Deny";
      const authorized =
        policy === "Allow" ||
        (policy === "ApprovalRequired" &&
          v.approved &&
          !v.used &&
          v.approvedText === v.content);
      const result =
        v.entries >= v.cap
          ? "audit limit"
          : policy === "Deny"
            ? "policy denied"
            : !authorized
              ? "approval missing, changed or consumed"
              : "eligible for canonical containment and dispatch";
      return {
        summary: result,
        metrics: [
          metric("Policy", policy),
          metric("Payload matches", v.approvedText === v.content),
          metric("Can authorize", authorized),
          metric(
            "After write",
            authorized && v.tool === "write" ? "used=true" : "no consumption",
          ),
        ],
        bars: [
          bar("Audit entries", v.entries, v.cap),
          bar("Audit capacity", v.cap),
        ],
        columns: ["Boundary", "Result"],
        rows: [
          ["Identity", v.role],
          ["Lexical path", safe],
          ["Approval replay", v.used ? "denied" : "not consumed"],
          ["Actual filesystem", "checked by native dispatch"],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-tool-call-firewall-1",
    Object.assign(
      {
        title: "Validate an unambiguous call envelope",
        steps: [
          {
            label: "Byte budget",
            detail:
              "The caller application supplies identity; the model supplies only a proposed operation. The compact Rust envelope carries a stable request id, role, tool and relative argument without ambiguous delimiters or controls.",
          },
          {
            label: "Envelope fields",
            detail:
              "r1|reader|read|notes.md -> typed request\nr1|reader|read|notes.md|extra -> reject",
          },
          {
            label: "Control gate",
            detail:
              "Validate the entire bounded envelope before policy evaluation. In the CLI, trusted-role is an operator argument, not a field accepted from model text.",
          },
        ],
        caption:
          "What would break if a model could replace reader with editor?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-tool-call-firewall-2",
    Object.assign(
      {
        title: "Evaluate role and path policy",
        steps: [
          {
            label: "Known role",
            detail:
              "Policy denies unknown roles, unsupported tools and unsafe path components. A reader may read a contained note; an editor write needs approval. A lexical allow is still followed by actual filesystem containment in dispatch.",
          },
          {
            label: "Path components",
            detail:
              "reader + read notes.md -> Allow\nreader + write notes.md -> Deny\neditor + write notes.md -> ApprovalRequired",
          },
          {
            label: "Tool permission",
            detail:
              "Make Deny the default branch. Check canonical paths before real file access; do not mistake a policy verdict for OS isolation.",
          },
        ],
        caption:
          "Why can a symlink escape even when its relative name contains no parent component?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-tool-call-firewall-3",
    Object.assign(
      {
        title: "Consume a request-bound approval once",
        steps: [
          {
            label: "Decision gate",
            detail:
              "The real file dispatcher binds approval to the typed request and write content. It consumes the receipt before executing the write. A changed payload or replay fails and cannot write again.",
          },
          {
            label: "Match identity",
            detail:
              'approved content="approved after restore"\nchanged content -> Conflict, file unchanged\nexact content -> write, used=true\nreplay -> Conflict',
          },
          {
            label: "Check unused",
            detail:
              "Validate payload size and actual containment before consuming approval. Keep the single-use receipt in the same trusted application boundary as dispatch.",
          },
        ],
        caption:
          "What persistent receipt store would you need before allowing approval reuse across process restarts?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-tool-call-firewall-4",
    Object.assign(
      {
        title: "Record bounded audit evidence",
        steps: [
          {
            label: "Unique call",
            detail:
              "The compact audit records outcomes without copying file contents. The executable returns request id, relative argument, decision, output and whether approval was consumed and replay denied. Record request identity with the application result when integrating it.",
          },
          {
            label: "Capacity check",
            detail:
              "request r1 -> one policy row\nfile write succeeds -> approval_consumed=true\nsecond dispatch -> replay_denied=true",
          },
          {
            label: "Omit arguments",
            detail:
              "Reject duplicate audit ids and full logs before appending. This bounded in-memory audit is not a durable tamper-evident log.",
          },
        ],
        caption:
          "Which nonsecret fields would you hash to connect a durable approval receipt with an execution result?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
