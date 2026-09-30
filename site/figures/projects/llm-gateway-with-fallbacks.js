(function () {
  "use strict";
  const text = (key, label, value) => ({ key, label, type: "text", value });
  const number = (key, label, value, min, max) => ({
    key,
    label,
    type: "range",
    value,
    min,
    max,
    step: 1,
  });
  const classify = (status) => {
    if (!Number.isInteger(status) || status < 100 || status > 599)
      return "invalid";
    if (status >= 200 && status < 300) return "success";
    if (status === 429 || status >= 500) return "retry";
    return "terminal";
  };
  function config(title, detail, lab) {
    return {
      title,
      steps: [
        { label: "Inspect the boundary", detail },
        {
          label: "Change the input",
          detail: "The result below is computed from the current controls.",
        },
      ],
      caption: detail,
      lab,
    };
  }
  window.AIFSProjectFigures.register(
    "pj-llm-gateway-with-fallbacks-1",
    config(
      "Validate provider order",
      "Only configured endpoints are eligible; duplicate URLs do not create extra attempts.",
      {
        controls: [
          text(
            "urls",
            "Comma-separated provider URLs",
            "https://primary.example/v1/chat/completions, http://127.0.0.1:11434/v1/chat/completions",
          ),
        ],
        calculate(v) {
          const seen = new Set();
          const rows = v.urls.split(",").map((raw) => {
            raw = raw.trim();
            let status = "accepted";
            try {
              const u = new URL(raw);
              const local = ["localhost", "127.0.0.1", "[::1]"].includes(
                u.hostname,
              );
              if (
                u.username ||
                u.password ||
                u.hash ||
                u.search ||
                (u.protocol !== "https:" && !(u.protocol === "http:" && local))
              )
                status = "invalid";
              else if (seen.has(raw)) status = "duplicate";
            } catch {
              status = "invalid";
            }
            seen.add(raw);
            return [raw, status];
          });
          const accepted = rows.filter((r) => r[1] === "accepted").length;
          const invalid = rows.some((r) => r[1] === "invalid");
          return {
            summary: invalid
              ? "Reject the provider list before any request"
              : `${accepted} distinct providers in input order`,
            metrics: [{ label: "Eligible", value: invalid ? 0 : accepted }],
            bars: [
              { label: "Accepted entries", value: accepted, max: rows.length },
            ],
            columns: ["Endpoint", "Decision"],
            rows,
          };
        },
      },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-llm-gateway-with-fallbacks-2",
    config(
      "Classify an observed status",
      "429 and server errors allow fallback; other errors stop this route.",
      {
        controls: [number("status", "HTTP status", 503, 0, 650)],
        calculate(v) {
          const kind = classify(v.status);
          return {
            summary: `${v.status} → ${kind}`,
            metrics: [{ label: "Can fall back", value: kind === "retry" }],
            bars: ["success", "retry", "terminal", "invalid"].map((label) => ({
              label,
              value: kind === label ? 1 : 0,
              max: 1,
            })),
          };
        },
      },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-llm-gateway-with-fallbacks-3",
    config(
      "Bound response reading",
      "Byte limits and deadlines are independent. The timing here is a model, not a network measurement.",
      {
        controls: [
          text("body", "Response body", '{"answer":"ready"}'),
          number("limit", "Response byte limit", 24, 1, 128),
          number("delay", "Modeled response time (ms)", 70, 0, 200),
          number("deadline", "Remaining deadline (ms)", 100, 1, 200),
        ],
        calculate(v) {
          const bytes = new TextEncoder().encode(v.body).length;
          const read = Math.min(bytes, v.limit + 1);
          let summary = "Response accepted";
          if (v.delay > v.deadline)
            summary = "Cancelled before the response completes";
          else if (bytes > v.limit)
            summary = "Response rejected: byte limit exceeded";
          return {
            summary,
            metrics: [
              { label: "UTF-8 bytes", value: bytes },
              { label: "Bounded bytes read if complete", value: read },
            ],
            bars: [
              {
                label: "Response bytes",
                value: bytes,
                max: Math.max(bytes, v.limit),
              },
              {
                label: "Time consumed",
                value: Math.min(v.delay, v.deadline),
                max: v.deadline,
              },
            ],
            columns: ["Limit", "Value"],
            rows: [
              ["Body read ceiling", v.limit + 1],
              ["Remaining time", Math.max(0, v.deadline - v.delay)],
            ],
          };
        },
      },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-llm-gateway-with-fallbacks-4",
    config(
      "Share one deadline across fallbacks",
      "Simulate ordered observed responses; each attempt spends the same overall time budget.",
      {
        controls: [
          text(
            "providers",
            "Provider observations JSON",
            '[{"status":503,"ms":35,"bytes":40},{"status":200,"ms":50,"bytes":90}]',
          ),
          number("attempts", "Maximum attempts", 2, 1, 5),
          number("deadline", "Total deadline (ms)", 65, 1, 250),
          number("limit", "Maximum response bytes", 128, 1, 256),
        ],
        calculate(v) {
          const providers = JSON.parse(v.providers);
          if (!Array.isArray(providers) || !providers.length)
            throw new Error("Expected provider observations");
          let elapsed = 0,
            attempts = 0,
            state = "exhausted";
          const rows = [];
          for (const p of providers) {
            if (
              !Number.isFinite(p.ms) ||
              p.ms < 0 ||
              !Number.isFinite(p.bytes) ||
              p.bytes < 0 ||
              classify(p.status) === "invalid"
            )
              throw new Error("Use valid status, nonnegative ms and bytes");
            if (attempts >= v.attempts) break;
            attempts++;
            if (elapsed + p.ms >= v.deadline) {
              elapsed = v.deadline;
              state = "cancelled";
              rows.push([attempts, "deadline", elapsed, 0]);
              break;
            }
            elapsed += p.ms;
            const kind = classify(p.status);
            rows.push([attempts, p.status, elapsed, v.deadline - elapsed]);
            if (p.bytes > v.limit) {
              state = "response-limit";
              break;
            }
            if (kind === "success") {
              state = "completed";
              break;
            }
            if (kind === "terminal") {
              state = "terminal-error";
              break;
            }
          }
          return {
            summary: `${state} after ${attempts} attempts and ${elapsed} ms`,
            metrics: [{ label: "Time remaining", value: v.deadline - elapsed }],
            bars: [
              { label: "Spent milliseconds", value: elapsed, max: v.deadline },
              { label: "Attempts", value: attempts, max: v.attempts },
            ],
            columns: ["Attempt", "Outcome", "Elapsed ms", "Remaining ms"],
            rows,
          };
        },
      },
    ),
  );
})();
