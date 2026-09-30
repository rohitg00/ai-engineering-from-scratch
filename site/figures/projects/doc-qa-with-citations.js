(function () {
  "use strict";
  const controls = [
    { key: "question", label: "Question", type: "text", value: "cache expire" },
    {
      key: "text",
      label: "Source text",
      type: "text",
      value: "Cache entries expire after sixty seconds. Bananas are yellow.",
    },
    {
      key: "quote",
      label: "Proposed quote",
      type: "text",
      value: "Bananas are yellow.",
    },
    {
      key: "size",
      label: "Chunk characters",
      type: "range",
      value: 35,
      min: 10,
      max: 150,
      step: 1,
    },
    {
      key: "overlap",
      label: "Chunk overlap",
      type: "range",
      value: 5,
      min: 0,
      max: 30,
      step: 1,
    },
  ];
  const calculate = function (v, stepIndex) {
    const words = (s) => new Set(s.toLowerCase().match(/\w+/g) || []);
    const terms = words(v.question),
      qwords = words(v.quote),
      matches = [...terms].filter((x) => qwords.has(x)).length;
    const offset = v.text.indexOf(v.quote),
      valid = offset >= 0 && v.quote.trim().length > 0;
    if (v.overlap >= v.size)
      return {
        summary: "Reject overlap at or above chunk size",
        metrics: [],
        bars: [],
      };
    const chunks = [];
    for (let start = 0; start < v.text.length; start += v.size - v.overlap) {
      const end = Math.min(v.text.length, start + v.size);
      chunks.push([start, end, v.text.slice(start, end)]);
      if (end === v.text.length) break;
    }
    return {
      summary: !valid
        ? "Reject unsupported quote"
        : matches === 0
          ? "Exact quote exists, but query relevance needs review"
          : "Exact quote with lexical query overlap",
      metrics: [
        { label: "Quote start", value: offset },
        { label: "Query terms supported", value: matches },
      ],
      bars: [
        { label: "Matched query terms", value: matches, max: terms.size || 1 },
      ],
      columns: ["start", "end", "chunk"],
      rows: chunks,
    };
  };
  window.AIFSProjectFigures.register(
    "pj-doc-qa-with-citations-1",
    Object.assign(
      {
        title: "Load local documents with stable provenance",
        steps: [
          {
            label: "Input",
            detail:
              "Keep source identity, content hash and exact offsets before retrieving anything.",
          },
          {
            label: "Transform",
            detail:
              "Keep source identity, content hash and exact offsets before retrieving anything. Character windows are an intentionally simple baseline: overlap preserves context near boundaries but does not create new evidence. The loader refuses symlinks that escape its root, so a document scan cannot silently read another directory.",
          },
          {
            label: "Verify",
            detail:
              "The second overlapping chunk of abcdef starts at offset 3 when size=4 and overlap=1.",
          },
        ],
        caption:
          "The second overlapping chunk of abcdef starts at offset 3 when size=4 and overlap=1.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-doc-qa-with-citations-2",
    Object.assign(
      {
        title: "Rank chunks with an inspectable keyword score",
        steps: [
          {
            label: "Input",
            detail:
              "Term frequency saturates through a logarithm, and document frequency reduces the weight of common words.",
          },
          {
            label: "Transform",
            detail:
              "Term frequency saturates through a logarithm, and document frequency reduces the weight of common words. Return the whole chunk contract with its score, not just the text, because the next stage needs source offsets. This lexical baseline will miss synonyms; measure it before adding an embedding service.",
          },
          {
            label: "Verify",
            detail:
              "A socket query selects the socket chunk, while an unknown term abstains.",
          },
        ],
        caption:
          "A socket query selects the socket chunk, while an unknown term abstains.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-doc-qa-with-citations-3",
    Object.assign(
      {
        title: "Accept only answers grounded in retrieved spans",
        steps: [
          {
            label: "Input",
            detail:
              "Ask the model to select an exact quote and a source id, then validate both.",
          },
          {
            label: "Transform",
            detail:
              "Ask the model to select an exact quote and a source id, then validate both. A quoted substring gives a checkable span; it does not guarantee the source is true. Empty retrieval returns an explicit abstention without calling the model. A later paraphrasing writer would need a different support gate.",
          },
          {
            label: "Verify",
            detail:
              "A model response containing words absent from its cited chunk is rejected.",
          },
        ],
        caption:
          "A model response containing words absent from its cited chunk is rejected.",
      },
      { lab: { controls, calculate } },
    ),
  );
  window.AIFSProjectFigures.register(
    "pj-doc-qa-with-citations-4",
    Object.assign(
      {
        title: "Use a framework splitter without losing offsets",
        steps: [
          {
            label: "Input",
            detail:
              "The adapter keeps the from-scratch retrieval and answer validator.",
          },
          {
            label: "Transform",
            detail:
              "The adapter keeps the from-scratch retrieval and answer validator. The optional LangChain path contributes recursive splitting and a fake model interface, then converts every chunk back to exact source offsets. If a splitter rewrites text, reject it instead of inventing provenance. Repeated overlapping substrings must advance the search cursor by one position, not by the full chunk length.",
          },
          {
            label: "Verify",
            detail:
              "Framework chunks are converted to the same source-span contract used by the baseline.",
          },
        ],
        caption:
          "Framework chunks are converted to the same source-span contract used by the baseline.",
      },
      { lab: { controls, calculate } },
    ),
  );
})();
