export type Feedback = { id: string; text: string; source: string };
export type Theme = { id: string; title: string; phrases: string[] };
export type Evidence = { id: string; source: string; quote: string; start: number; end: number };
export type ThemeResult = Theme & { evidence: Evidence[]; distinctSources: number; records: number };
export type Board = { schemaVersion: number; inputSha256: string; records: number; themes: ThemeResult[]; unassigned: Feedback[]; duplicates: { id: string; originalId: string }[] };

export function parseFeedback(text: string): Feedback[] { throw new Error("Stage 1: implement parseFeedback"); }
export function validateThemes(value: unknown): Theme[] { throw new Error("Stage 1: implement validateThemes"); }
export function findEvidence(row: Feedback, phrase: string): Evidence | null { throw new Error("Stage 2: implement findEvidence"); }
export function buildBoard(rows: Feedback[], themes: Theme[]): Board { throw new Error("Stage 3: implement buildBoard"); }
export function draftIssue(theme: ThemeResult): string { throw new Error("Stage 4: implement draftIssue"); }
export function renderBoard(board: Board): string { throw new Error("Stage 4: implement renderBoard"); }
