export type BoundingBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EvidenceRegion = {
  page: number;
  bbox: BoundingBox;
  text: string;
  score: number;
};

export type DocumentFixture = {
  id: string;
  title: string;
  pageWidth: number;
  pageHeight: number;
  pageImageUrl: string;
  query: string;
  answer: string;
  evidence: EvidenceRegion[];
};
