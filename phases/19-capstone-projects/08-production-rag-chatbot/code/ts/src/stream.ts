import type { Citation, KbEntry, SseEvent } from "./types.js";

export const KB: KbEntry[] = [
  {
    docId: "GDPR-Art-15",
    page: 1,
    text: "data subject は personal data が処理されているかについて confirmation を得る権利を持ちます。",
    tag: "GDPR",
  },
  {
    docId: "GDPR-Art-17",
    page: 1,
    text: "data subject は undue delay なしに personal data の erasure を得る権利を持ちます。",
    tag: "GDPR",
  },
  {
    docId: "HIPAA-164.502",
    page: 14,
    text: "covered entity は許可されている場合を除き protected health information を使用または開示できません。",
    tag: "HIPAA",
  },
  {
    docId: "SOC2-CC6.1",
    page: 7,
    text: "logical access control は information asset への access を authorized user に制限します。",
    tag: "SOC2",
  },
];

export function retrieve(query: string, jurisdiction: string, k: number): Citation[] {
  const tokens = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  let scored = KB.map((doc) => {
    const docTokens = doc.text.toLowerCase().split(/\W+/);
    let overlap = 0;
    for (const t of docTokens) if (tokens.has(t)) overlap += 1;
    const boost = doc.tag === jurisdiction ? 2 : 0;
    const score = overlap + boost;
    return {
      citation: {
        docId: doc.docId,
        page: doc.page,
        snippet: doc.text,
        score,
      },
      overlap,
      score,
    };
  });
  scored = scored.filter((s) => s.overlap > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.citation);
}

export function tokenizeAnswer(query: string, citations: Citation[]): string[] {
  const first = citations[0];
  const lead =
    first === undefined
      ? `"${query}" に一致する policy は見つかりませんでした。`
      : `${first.docId} によると、${first.snippet}`;
  const rest = citations.slice(1);
  const tail =
    rest.length > 0
      ? ` 関連: ${rest.map((c) => c.docId).join(", ")}。`
      : "";
  return (lead + tail).split(/(\s+)/).filter((t) => t.length > 0);
}

export function encodeSseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseSseStream(text: string): SseEvent[] {
  const out: SseEvent[] = [];
  for (const block of text.split("\n\n")) {
    if (!block.trim()) continue;
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) eventName = line.slice("event: ".length);
      else if (line.startsWith("data: ")) dataLines.push(line.slice("data: ".length));
    }
    if (dataLines.length === 0) continue;
    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      data = dataLines.join("\n");
    }
    out.push({ event: eventName, data });
  }
  return out;
}
