export type Turn = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export type Session = {
  id: string;
  role: string;
  jurisdiction: string;
  turns: Turn[];
  createdAt: number;
};

export type Citation = {
  docId: string;
  page: number;
  snippet: string;
  score: number;
};

export type KbEntry = {
  docId: string;
  page: number;
  text: string;
  tag: string;
};

export type SseEvent = {
  event: string;
  data: unknown;
};
