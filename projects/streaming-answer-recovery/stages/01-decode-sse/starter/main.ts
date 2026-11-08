export type Event = { id: string; event: string; data: string };
export type Answer = {
  text: string;
  citations: Array<{ label: string; url: string }>;
  status: "draft" | "interrupted" | "completed" | "cancelled";
  lastID: string;
  events: Event[];
};
export class SSEDecoder {
  push(bytes: Uint8Array, final = false): Event[] {
    throw Error("TODO stage 1: decode SSE");
  }
}
export function initial(): Answer {
  return { text: "", citations: [], status: "draft", lastID: "", events: [] };
}
export function apply(state: Answer, event: Event): Answer {
  throw Error("TODO stage 2: apply event");
}
export function interrupt(state: Answer): Answer {
  throw Error("TODO stage 2: interrupted state");
}
export function cancel(state: Answer): Answer {
  throw Error("TODO stage 2: cancellation");
}
export async function connect(
  url: string,
  state: Answer,
  onState: (s: Answer) => void,
  signal?: AbortSignal,
): Promise<Answer> {
  throw Error("TODO stage 3: reconnect");
}
export function trace(state: Answer): string {
  throw Error("TODO stage 4: trace");
}
export function replay(text: string): Answer {
  throw Error("TODO stage 4: replay");
}
export function mount(host: HTMLElement, url: string): () => void {
  throw Error("TODO stage 4: browser component");
}
