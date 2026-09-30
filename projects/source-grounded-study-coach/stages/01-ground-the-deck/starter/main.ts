export type Source = { id: string; title: string; text: string };
export type Card = {
  id: string;
  sourceId: string;
  question: string;
  answer: string;
  accepted: string[];
  start: number;
  end: number;
};
export type Deck = { sources: Source[]; cards: Card[] };
export type Attempt = {
  id: string;
  cardId: string;
  date: string;
  answer: string;
};
export type Progress = {
  cardId: string;
  box: number;
  due: string;
  attempts: number;
  lastDate: string | null;
};

export function validateDeck(value: unknown): Deck {
  throw new Error("Implement stage 1");
}
export function normalizeAnswer(answer: string): string {
  throw new Error("Implement stage 2");
}
export function gradeAnswer(deck: Deck, cardId: string, response: string): any {
  throw new Error("Implement stage 2");
}
export function parseDay(value: string): number {
  throw new Error("Implement stage 3");
}
export function buildProgress(
  deck: Deck,
  attempts: Attempt[],
  initialDate: string,
): Progress[] {
  throw new Error("Implement stage 3");
}
export function dueCards(progress: Progress[], date: string): Progress[] {
  throw new Error("Implement stage 3");
}
export function renderPractice(
  deck: Deck,
  progress: Progress[],
  date: string,
): string {
  throw new Error("Implement stage 4");
}
export function exportPractice(
  deck: Deck,
  attempts: Attempt[],
  initialDate: string,
  date: string,
  out: string,
): any {
  throw new Error("Implement stage 4");
}
export async function proposeCard(
  source: Source,
  endpoint: string,
  model: string,
  apiKey = "",
): Promise<any> {
  throw new Error("Implement stage 4");
}
