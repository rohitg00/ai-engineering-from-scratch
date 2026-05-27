import type { Citation, KbEntry, SseEvent } from "./types.js";

export const KB: KbEntry[] = [
  {
    docId: "GDPR-Art-15",
    page: 1,
    text: "The data subject has the right to obtain confirmation as to whether personal data are being processed.",
    tag: "GDPR",
  },
  {
    docId: "GDPR-Art-17",
    page: 1,
    text: "The data subject shall have the right to obtain erasure of personal data without undue delay.",
    tag: "GDPR",
  },
  {
    docId: "HIPAA-164.502",
    page: 14,
    text: "Covered entity may not use or disclose protected health information except as permitted.",
    tag: "HIPAA",
  },
  {
    docId: "SOC2-CC6.1",
    page: 7,
    text: "Logical access controls restrict access to information assets to authorized users.",
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
      ? `No matching policy found for "${query}".`
      : `Per ${first.docId}, ${first.snippet}`;
  const rest = citations.slice(1);
  const tail =
    rest.length > 0
      ? ` See also ${rest.map((c) => c.docId).join(", ")}.`
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
