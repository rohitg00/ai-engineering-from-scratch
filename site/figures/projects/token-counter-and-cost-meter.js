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
      text("text", "Text to estimate", "Explain Orchard guest tokens"),
      number("ratio", "Characters per estimated token", 4, 1, 8),
      number("input", "Recorded input tokens", 100, 0, 500),
      number("cached", "Cached input tokens", 40, 0, 500),
      number("output", "Recorded output tokens", 20, 0, 200),
      number("inputRate", "Input nano-dollars/token", 2, 0, 20),
      number("cachedRate", "Cached nano-dollars/token", 1, 0, 20),
      number("outputRate", "Output nano-dollars/token", 5, 0, 20),
      number("reservation", "Reserved nano-dollars", 600, 0, 2000),
    ],
    calculate(v) {
      if (v.cached > v.input)
        throw Error("Cached tokens cannot exceed input tokens");
      const uncached = (v.input - v.cached) * v.inputRate,
        cache = v.cached * v.cachedRate,
        output = v.output * v.outputRate,
        total = uncached + cache + output;
      return {
        summary:
          stage === 1
            ? "Approximation: " +
              Math.ceil([...v.text].length / v.ratio) +
              " tokens, not a provider count"
            : total > v.reservation
              ? "Recorded usage exceeds reservation"
              : "Settle recorded usage and release unused reservation",
        metrics: [
          metric("Estimated tokens", Math.ceil([...v.text].length / v.ratio)),
          metric("Actual nano-dollars", total),
          metric("Unused reservation", Math.max(0, v.reservation - total)),
          metric("Overrun", Math.max(0, total - v.reservation)),
        ],
        bars: [
          bar("Uncached input charge", uncached),
          bar("Cached input charge", cache),
          bar("Output charge", output),
        ],
        columns: ["Component", "Tokens", "Rate", "Charge"],
        rows: [
          ["Input", v.input - v.cached, v.inputRate, uncached],
          ["Cached", v.cached, v.cachedRate, cache],
          ["Output", v.output, v.outputRate, output],
        ],
      };
    },
  });
  window.AIFSProjectFigures.register(
    "pj-token-counter-and-cost-meter-1",
    Object.assign(
      {
        title: "Estimate text with a documented bound",
        steps: [
          {
            label: "Count scalars",
            detail:
              "Start with a visible approximation. At four characters per token, 21 Unicode scalar values estimate six tokens. This is a baseline for preflight planning; actual provider counts can differ by language, punctuation and tokenizer.",
          },
          {
            label: "Read ratio",
            detail: "characters=21; ratio=4\nceil(21/4)=6 estimated tokens",
          },
          {
            label: "Ceiling division",
            detail:
              "Use quotient plus a remainder check, avoiding overflow from adding ratio-1. Never label this result a provider tokenizer count.",
          },
        ],
        caption:
          "Why might the same number of characters cost different token counts in two languages?",
      },
      { lab: buildLab(1) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-token-counter-and-cost-meter-2",
    Object.assign(
      {
        title: "Validate recorded usage",
        steps: [
          {
            label: "Parse counters",
            detail:
              "The JSON adapter reads recorded input/output usage and cached input details. Rust validates the corresponding input,output,cached triplet. Cached tokens are a subset of input tokens, not an additional input charge.",
          },
          {
            label: "Check unsigned",
            detail:
              "input_tokens=100; output_tokens=20; cached_tokens=40\nwire=100,20,40\nuncached input=60",
          },
          {
            label: "Cached subset",
            detail:
              "Reject booleans, negative values and cached counts above input. Keep provider response normalization outside the arithmetic core.",
          },
        ],
        caption:
          "What should happen when a provider response omits required input usage?",
      },
      { lab: buildLab(2) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-token-counter-and-cost-meter-3",
    Object.assign(
      {
        title: "Price with checked integers",
        steps: [
          {
            label: "Uncached charge",
            detail:
              "Use supplied integer rate cards in nano-dollars per token. With input=2, output=5 and cached=1, the recorded request costs 260 nano-dollars. These fixture rates are not current provider prices.",
          },
          {
            label: "Cache charge",
            detail:
              "60 uncached * 2 = 120\n40 cached * 1 = 40\n20 output * 5 = 100\ntotal=260 nano_dollars",
          },
          {
            label: "Output charge",
            detail:
              "Multiply and add with checked u64 operations. Do not round each component through floating-point dollars.",
          },
        ],
        caption:
          "How would an overflow affect budget admission if arithmetic wrapped silently?",
      },
      { lab: buildLab(3) },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-token-counter-and-cost-meter-4",
    Object.assign(
      {
        title: "Admit work against a ledger",
        steps: [
          {
            label: "Read ledger",
            detail:
              "Replay reservations against recorded usage. The first Orchard request reserves 600 and settles 260, releasing 340. A later request requiring 1,500 is blocked when only 430 remains. Saved JSON retains request ids and all settlement fields.",
          },
          {
            label: "Checked addition",
            detail:
              "limit=1000\nrequest 1 reserved=600 actual=260 unused=340\nrequest 2 actual=310 -> spent=570\nremaining=430; larger reservation -> blocked",
          },
          {
            label: "Compare limit",
            detail:
              "A settlement must record actual usage even when it exceeds the estimate. Mark an overrun explicitly; do not hide it by capping the billed cost.",
          },
        ],
        caption:
          "Which fields can the agent-budget-planner reuse without confusing a quote with actual usage?",
      },
      { lab: buildLab(4) },
    ),
  );
})();
