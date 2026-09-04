import type { DocumentFixture } from "./types.js";

export const FIXTURES: Record<string, DocumentFixture> = {
  "10k-acme-2025": {
    id: "10k-acme-2025",
    title: "Acme 10-K FY2025, Table 4",
    pageWidth: 1224,
    pageHeight: 1584,
    pageImageUrl: "/static/10k-acme-2025-p88.png",
    query: "What was Acme's free cash flow in FY2025?",
    answer:
      "Free cash flow in FY2025 was $3.12B, up from $2.41B in FY2024 (Table 4, p.88).",
    evidence: [
      {
        page: 88,
        bbox: { x: 142, y: 612, w: 410, h: 36 },
        text: "Free cash flow                    3,118    2,406",
        score: 0.91,
      },
      {
        page: 88,
        bbox: { x: 142, y: 250, w: 980, h: 24 },
        text: "Table 4. Cash Flow Summary (USD millions)",
        score: 0.74,
      },
    ],
  },
  "nature-paper-2026": {
    id: "nature-paper-2026",
    title: "Nature, late-interaction retrieval, 2026",
    pageWidth: 1200,
    pageHeight: 1553,
    pageImageUrl: "/static/nature-2026-p4.png",
    query: "What is the MaxSim reduction over BM25?",
    answer:
      "MaxSim reduces ColBERT-style query latency by 4.1x vs BM25 reranking (Fig. 3, p.4).",
    evidence: [
      {
        page: 4,
        bbox: { x: 80, y: 940, w: 520, h: 200 },
        text: "Fig. 3. End-to-end retrieval latency.",
        score: 0.88,
      },
    ],
  },
};

export function listFixtures(): DocumentFixture[] {
  return Object.values(FIXTURES);
}

export function getFixture(id: string): DocumentFixture | undefined {
  return FIXTURES[id];
}
