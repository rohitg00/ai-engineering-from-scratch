export type Chunk = {
  repo: string;
  path: string;
  startLine: number;
  endLine: number;
  symbol: string;
  body: string;
  summary: string;
};

export type RankedChunk = { chunk: Chunk; score: number };

export type QueryResponse = {
  query: string;
  denseTop: string[];
  sparseTop: string[];
  fusedTop: string[];
  citations: { anchor: string; score: number }[];
};

export function anchor(c: Chunk): string {
  return `${c.repo}/${c.path}:${c.startLine}-${c.endLine}`;
}
