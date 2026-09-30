(function () {
  "use strict";
  window.AIFSProjectFigures.register("pj-durable-agent-jobs-1", {
    title: "A retry needs one stable identity",
    steps: [
      {
        label: "Validate bytes",
        detail:
          "The identifier must start with a lowercase letter, then contain lowercase letters, digits or hyphens, with at most 64 characters.",
      },
      {
        label: "Create intention",
        detail:
          "A valid new job starts queued, version 0, attempts 0. It has no lease or output yet.",
      },
      {
        label: "Bind input",
        detail:
          "The CLI binds an identifier to immutable text. Identical enqueue is safe; changed text conflicts.",
      },
    ],
    caption:
      "Change the identifier and payload relationship to compute whether creation or redelivery is permitted.",
    lab: {
      controls: [
        { key: "id", label: "Job identifier", type: "text", value: "report-1" },
        {
          key: "exists",
          label: "ID already stored",
          type: "checkbox",
          value: false,
        },
        {
          key: "changed",
          label: "Payload changed",
          type: "checkbox",
          value: false,
        },
      ],
      calculate(v) {
        const valid = /^[a-z][a-z0-9-]{0,63}$/.test(v.id);
        const conflict = valid && v.exists && v.changed;
        let summary = "Create queued version 0; no effect executed";
        if (!valid) summary = "Rejected: invalid identifier";
        else if (conflict)
          summary = "Rejected: identity already binds different text";
        else if (v.exists)
          summary = "Identical redelivery: retain existing job";
        return {
          summary: summary,
          metrics: [
            { label: "Identifier length", value: v.id.length },
            { label: "New jobs added", value: valid && !v.exists ? 1 : 0 },
            { label: "Effects executed", value: 0 },
          ],
          bars: [{ label: "ID length /64", value: v.id.length, max: 64 }],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-durable-agent-jobs-2", {
    title: "Check authority before changing the ledger",
    steps: [
      {
        label: "Compare version",
        detail:
          "The caller's expected version must equal the queued record's current version.",
      },
      {
        label: "Check attempt cap",
        detail:
          "Recovery retains attempts. A queued job can still have exhausted its retry budget.",
      },
      {
        label: "Persist claim",
        detail:
          "A successful transition increments version and attempts, sets expiry, then saves while the ledger lock is held.",
      },
    ],
    caption:
      "The lease interval is half open: expiry is the first millisecond at which completion is rejected.",
    lab: {
      controls: [
        {
          key: "current",
          label: "Current version",
          type: "number",
          value: 2,
          min: 0,
          max: 20,
          step: 1,
        },
        {
          key: "expected",
          label: "Expected version",
          type: "number",
          value: 2,
          min: 0,
          max: 20,
          step: 1,
        },
        {
          key: "attempts",
          label: "Previous attempts",
          type: "range",
          value: 1,
          min: 0,
          max: 5,
          step: 1,
        },
        {
          key: "cap",
          label: "Attempt cap",
          type: "range",
          value: 3,
          min: 1,
          max: 5,
          step: 1,
        },
        {
          key: "now",
          label: "Claim time ms",
          type: "number",
          value: 100,
          min: 0,
          max: 1000,
          step: 1,
        },
        {
          key: "ttl",
          label: "Lease duration ms",
          type: "range",
          value: 10,
          min: 1,
          max: 100,
          step: 1,
        },
      ],
      calculate(v) {
        const accepted = v.current === v.expected && v.attempts < v.cap;
        let summary = "Claim accepted; persist before execution";
        if (v.current !== v.expected)
          summary = "Conflict: stale expected version";
        else if (!accepted)
          summary = "Attempt cap reached; retain queued record";
        return {
          summary: summary,
          metrics: [
            {
              label: "Resulting version",
              value: v.current + (accepted ? 1 : 0),
            },
            {
              label: "Resulting attempts",
              value: v.attempts + (accepted ? 1 : 0),
            },
            { label: "Lease expiry", value: accepted ? v.now + v.ttl : 0 },
          ],
          bars: [
            {
              label: "Attempts consumed",
              value: v.attempts + (accepted ? 1 : 0),
              max: v.cap,
            },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-durable-agent-jobs-3", {
    title: "Time and version independently fence a worker",
    steps: [
      {
        label: "Try completion",
        detail:
          "A running worker needs both its current version and time strictly before expiry.",
      },
      {
        label: "Reclaim",
        detail:
          "At expiry, running v1 becomes queued v2. This invalidates the old worker before another claim.",
      },
      {
        label: "Retry",
        detail:
          "The new worker claims v3. Old v1 cannot finish, even if it reports an earlier clock.",
      },
    ],
    caption:
      "Move the clock to 110 and switch the submitted version to see the two independent checks.",
    lab: {
      controls: [
        {
          key: "now",
          label: "Completion time ms",
          type: "range",
          value: 109,
          min: 95,
          max: 125,
          step: 1,
        },
        {
          key: "version",
          label: "Submitted version",
          type: "number",
          value: 1,
          min: 0,
          max: 5,
          step: 1,
        },
        {
          key: "retry",
          label: "Replacement already claimed v3",
          type: "checkbox",
          value: false,
        },
      ],
      calculate(v) {
        const current = v.retry ? 3 : 1,
          expiry = v.retry ? 120 : 110,
          accepted = v.version === current && v.now < expiry;
        let summary = "Completion accepted";
        if (v.version !== current) summary = "Rejected: stale version";
        else if (!accepted) summary = "Rejected: lease expired";
        return {
          summary: summary,
          metrics: [
            { label: "Current claim version", value: current },
            { label: "Lease expires at", value: expiry },
            { label: "Time remaining ms", value: Math.max(0, expiry - v.now) },
          ],
          bars: [
            { label: "Completion time", value: v.now, max: 125 },
            { label: "Expiry", value: expiry, max: 125 },
          ],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-durable-agent-jobs-4", {
    title: "Recover across the effect-completion gap",
    steps: [
      {
        label: "Persist v1",
        detail:
          "Save the running claim before executing the local text receipt.",
      },
      {
        label: "Publish effect",
        detail:
          "A synced temporary receipt is linked without overwriting an existing output.",
      },
      {
        label: "Crash and retry",
        detail:
          "After expiry, recovery reaches v3, reuses an identical receipt when present and persists completed v4.",
      },
    ],
    caption:
      "This computes a one-job process-crash timeline. It does not simulate a filesystem power failure.",
    lab: {
      controls: [
        {
          key: "point",
          label: "Crash point",
          type: "select",
          value: "effect",
          options: [
            { value: "claim", label: "After claim" },
            { value: "effect", label: "After effect" },
          ],
        },
        {
          key: "recover",
          label: "Recovery clock ms",
          type: "range",
          value: 111,
          min: 100,
          max: 125,
          step: 1,
        },
      ],
      calculate(v) {
        const effect = v.point === "effect",
          expired = v.recover >= 110;
        let summary = "Lease still owned: replacement cannot execute";
        if (expired && effect)
          summary = "Reclaim, reuse the existing effect, complete v4";
        else if (expired)
          summary = "Reclaim, publish the first effect, complete v4";
        return {
          summary: summary,
          metrics: [
            { label: "Effects before restart", value: effect ? 1 : 0 },
            {
              label: "New effects on restart",
              value: expired && !effect ? 1 : 0,
            },
            { label: "Completed jobs", value: expired ? 1 : 0 },
          ],
          columns: ["Moment", "Version", "Effects"],
          rows: [
            ["claim at 100", 1, 0],
            ["crash", 1, effect ? 1 : 0],
            [
              "restart at " + v.recover,
              expired ? 4 : 1,
              expired || effect ? 1 : 0,
            ],
          ],
          bars: [
            {
              label: "Persisted effect count",
              value: expired || effect ? 1 : 0,
              max: 1,
            },
          ],
        };
      },
    },
  });
})();
