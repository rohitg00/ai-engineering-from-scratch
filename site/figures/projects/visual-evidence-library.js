(function () {
  "use strict";
  const steps = [
    { label: "Image", detail: "Use source-image pixels, not screen pixels." },
    { label: "Region", detail: "Preserve text and its rectangle." },
    {
      label: "Inspect",
      detail: "Structural checks do not verify the text itself.",
    },
  ];
  window.AIFSProjectFigures.register("pj-visual-evidence-library-1", {
    title: "Does the rectangle fit?",
    steps,
    caption:
      "The image is 600 by 320 pixels. A box must stay within all four edges.",
    lab: {
      controls: [
        {
          key: "x",
          label: "Left x",
          type: "range",
          value: 45,
          min: 0,
          max: 600,
        },
        {
          key: "y",
          label: "Top y",
          type: "range",
          value: 130,
          min: 0,
          max: 320,
        },
        {
          key: "width",
          label: "Region width",
          type: "range",
          value: 510,
          min: 0,
          max: 600,
        },
        {
          key: "height",
          label: "Region height",
          type: "range",
          value: 45,
          min: 0,
          max: 320,
        },
      ],
      calculate(v) {
        const right = v.x + v.width,
          bottom = v.y + v.height;
        const valid =
          v.width > 0 && v.height > 0 && right <= 600 && bottom <= 320;
        return {
          summary: valid
            ? "Valid geometry; the supplied text still requires trust or review."
            : "Reject the rectangle rather than clipping evidence.",
          metrics: [
            { label: "Right edge", value: right },
            { label: "Bottom edge", value: bottom },
          ],
          bars: [
            { label: "Horizontal extent", value: right, max: 600 },
            { label: "Vertical extent", value: bottom, max: 320 },
          ],
        };
      },
    },
  });
  const terms = (s) =>
    new Set(s.toLocaleLowerCase().match(/[\p{L}\p{N}_]+/gu) || []);
  window.AIFSProjectFigures.register("pj-visual-evidence-library-2", {
    title: "Compute lexical query coverage",
    steps,
    caption:
      "This is a token-overlap score over provided text. It is not OCR or an answer-confidence estimate.",
    lab: {
      controls: [
        {
          key: "query",
          label: "Query",
          type: "text",
          value: "return dry seeds",
        },
        {
          key: "text",
          label: "Region text",
          type: "text",
          value: "Return dry seeds in paper envelopes.",
        },
      ],
      calculate(v) {
        const wanted = terms(v.query),
          have = terms(v.text),
          matches = [...wanted].filter((t) => have.has(t));
        const score = wanted.size ? matches.length / wanted.size : 0;
        return {
          summary: wanted.size
            ? `${matches.length} of ${wanted.size} unique query tokens occur in this region.`
            : "An empty query returns no matches.",
          metrics: [
            { label: "Query coverage", value: (score * 100).toFixed(0) + "%" },
            { label: "Matched tokens", value: matches.join(", ") || "none" },
          ],
          bars: [{ label: "Coverage", value: score, max: 1 }],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-visual-evidence-library-3", {
    title: "Separate proposal from accepted evidence",
    steps,
    caption:
      "Classification labels remain outside the text index. Human review is an explicit state transition.",
    lab: {
      controls: [
        {
          key: "text",
          label: "Proposed text",
          type: "text",
          value: "Return tools to the blue shelf.",
        },
        {
          key: "label",
          label: "Classification label",
          type: "text",
          value: "notice",
        },
        {
          key: "geometry",
          label: "Coordinates pass bounds checks",
          type: "checkbox",
          value: true,
        },
        {
          key: "reviewed",
          label: "Person checked image and text",
          type: "checkbox",
          value: false,
        },
      ],
      calculate(v) {
        const valid = Boolean(v.text.trim()) && v.geometry;
        const indexed = valid && v.reviewed;
        let summary = "Save the proposal separately for review.";
        if (!valid) summary = "Reject malformed extraction.";
        else if (indexed)
          summary = "The explicitly reviewed region may enter the text index.";
        return {
          summary,
          metrics: [
            { label: "Indexable regions", value: indexed ? 1 : 0 },
            { label: "Indexable classification labels", value: 0 },
          ],
          rows: [
            ["Text", v.text],
            ["Label only", v.label],
            ["Origin", "model-proposed"],
          ],
          columns: ["Output kind", "Value"],
        };
      },
    },
  });
  window.AIFSProjectFigures.register("pj-visual-evidence-library-4", {
    title: "Keep the overlay aligned as the page resizes",
    steps,
    caption:
      "A 600-pixel source image contains box [45,130,510,45]. Source coordinates remain unchanged in JSON.",
    lab: {
      controls: [
        {
          key: "display",
          label: "Displayed image width",
          type: "range",
          value: 420,
          min: 180,
          max: 900,
        },
      ],
      calculate(v) {
        const scale = v.display / 600;
        return {
          summary:
            "Pixel positions scale for display while percentages remain stable.",
          metrics: [
            { label: "Scale", value: scale.toFixed(2) },
            { label: "Left", value: (45 * scale).toFixed(1) + " px" },
            { label: "Box width", value: (510 * scale).toFixed(1) + " px" },
          ],
          rows: [
            ["left", "45 / 600", "7.5%"],
            ["top", "130 / 320", "40.625%"],
            ["width", "510 / 600", "85%"],
            ["height", "45 / 320", "14.0625%"],
          ],
          columns: ["Style", "Source ratio", "CSS percentage"],
        };
      },
    },
  });
})();
