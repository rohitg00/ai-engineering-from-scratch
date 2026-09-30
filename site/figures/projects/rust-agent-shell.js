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
      text("command", "Proposed action", "search Restore\trelease.md"),
      text(
        "content",
        "release.md text",
        "Orchard release. Restore evidence verified.",
      ),
      number("used", "Actions already used", 1, 0, 10),
      number("limit", "Action limit", 3, 1, 10),
      number("byteLimit", "File byte budget", 64, 1, 200),
    ],
    calculate(v) {
      const match = v.command.match(
        /^(help|pwd|quit|list|read|search)(?: (.*))?$/,
      );
      let reason = "accepted",
        result = "";
      const bytes = new TextEncoder().encode(v.content).length;
      const args = match?.[2] || "";
      let file = args,
        pattern = "";
      if (match?.[1] === "search") {
        const p = args.split("\t");
        pattern = p[0];
        file = p[1] || "";
        if (p.length !== 2 || !pattern || !file)
          reason = "search needs pattern<TAB>path";
      }
      if (!match) reason = "unsupported grammar";
      else if (v.used >= v.limit) reason = "budget exhausted";
      else if (file.startsWith("/") || file.split("/").includes(".."))
        reason = "path rejected";
      else if (["read", "search"].includes(match[1]) && bytes > v.byteLimit)
        reason = "file budget exceeded";
      if (reason === "accepted")
        result =
          match[1] === "search"
            ? v.content.includes(pattern)
              ? "1:" + v.content
              : "no match"
            : match[1] === "read"
              ? v.content
              : match[1] === "quit"
                ? "session closed"
                : match[1];
      return {
        summary: reason + (result ? ": " + result : ""),
        metrics: [
          metric("Input bytes", new TextEncoder().encode(v.command).length),
          metric("File bytes", bytes),
          metric("Next sequence", Math.min(v.used + 1, v.limit)),
          metric("Path model", "lexical only; runtime also canonicalizes"),
        ],
        bars: [
          bar("Actions used", v.used, v.limit),
          bar("Action limit", v.limit),
          bar("File bytes", bytes, v.byteLimit),
        ],
        columns: ["Boundary", "Value"],
        rows: [
          ["Grammar", match?.[1] || "rejected"],
          ["Path", file],
          ["Result", result || reason],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-rust-agent-shell-1",
    Object.assign(
      {
        title: "Parse a deliberately small action language",
        steps: [
          {
            label: "Validate input",
            detail:
              "The Rust process accepts a deliberately small tool language. Its Python adapter accepts JSONL with caller ids and tool arguments, then translates only known commands. No argument becomes an operating-system shell command.",
          },
          {
            label: "Apply the boundary",
            detail:
              '{"id":"evidence","tool":"search","arguments":{"pattern":"Restore","path":"release.md"}}\nwire: search Restore<TAB>release.md',
          },
          {
            label: "Inspect output",
            detail:
              "Reject control characters in adapter arguments so a path cannot inject a second command. Distinguish parse rejection from execution failure.",
          },
        ],
        caption:
          "Why must a literal newline in a caller path be rejected before stdin serialization?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-rust-agent-shell-2",
    Object.assign(
      {
        title: "Confine file tools to a bounded root",
        steps: [
          {
            label: "Validate input",
            detail:
              "Resolve release.md under the workspace root before reading it. A lexical path can look harmless while a symlink targets a file outside the workspace. The result is application-level containment, not a process sandbox.",
          },
          {
            label: "Apply the boundary",
            detail:
              "workspace=/work/orchard\nrelease.md -> /work/orchard/release.md -> allowed\nlink.md -> /outside/credentials -> rejected",
          },
          {
            label: "Inspect output",
            detail:
              "Canonicalize the root and target, then compare path components. Bound the bytes read as well as the initial metadata length.",
          },
        ],
        caption:
          "Which race remains if another process replaces a path after canonicalization?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-rust-agent-shell-3",
    Object.assign(
      {
        title: "Track budgets and terminal state",
        steps: [
          {
            label: "Validate input",
            detail:
              "The session owns a request budget and terminal state. Invalid requests consume an attempt too. Expose the budget through the executable argument and adapter --limit so callers can reason about bounded work.",
          },
          {
            label: "Apply the boundary",
            detail:
              "limit=2\nrequest 1: list -> step 1\nrequest 2: rejected grammar -> step 2\nrequest 3 -> terminal budget_exhausted",
          },
          {
            label: "Inspect output",
            detail:
              "Increment once per received request, before dispatch. Once closed, the session must not read more files.",
          },
        ],
        caption:
          "How should a client handle output ending before its request id receives an event?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-rust-agent-shell-4",
    Object.assign(
      {
        title: "Stream bounded JSON events through real stdin",
        steps: [
          {
            label: "Validate input",
            detail:
              "A client reads one JSON event at a time and matches it to the request id added by the adapter. Flushing every line allows a UI to display observations without waiting for the process to exit.",
          },
          {
            label: "Apply the boundary",
            detail:
              "request evidence -> {request_id:evidence, seq:2, kind:ok}\noutput: 2:Restore evidence: rehearsal completed at 09:20 UTC.",
          },
          {
            label: "Inspect output",
            detail:
              "Use BufRead chunks to bound allocation before constructing a command string. JSON-escape tool output rather than concatenating raw file text.",
          },
        ],
        caption: "What happens if a file contains quotes, tabs or a newline?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
