export type Event = { id: string; event: string; data: string };
export class SSEDecoder {
  decoder = new TextDecoder("utf-8", { fatal: true });
  buffer = "";
  lastID = "";
  kind = "";
  data: string[] = [];
  closed = false;
  push(bytes: Uint8Array, final = false): Event[] {
    if (this.closed) throw Error("decoder already closed");
    this.buffer += this.decoder.decode(bytes, { stream: !final });
    const events: Event[] = [];
    while (true) {
      const i = this.buffer.search(/[\r\n]/);
      if (i < 0) break;
      if (this.buffer[i] === "\r" && i === this.buffer.length - 1 && !final)
        break;
      const line = this.buffer.slice(0, i),
        skip = this.buffer[i] === "\r" && this.buffer[i + 1] === "\n" ? 2 : 1;
      this.buffer = this.buffer.slice(i + skip);
      if (line === "") {
        if (this.data.length)
          events.push({
            id: this.lastID,
            event: this.kind || "message",
            data: this.data.join("\n"),
          });
        this.data = [];
        this.kind = "";
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") this.data.push(value);
      else if (field === "event") this.kind = value;
      else if (field === "id" && !value.includes("\0")) this.lastID = value;
    }
    if (final) {
      this.closed = true;
      this.buffer = "";
      this.data = [];
    }
    return events;
  }
}
export type Answer = {
  text: string;
  citations: Array<{ label: string; url: string }>;
  status: "draft" | "interrupted" | "completed" | "cancelled";
  lastID: string;
  events: Event[];
};
export function initial(): Answer {
  return { text: "", citations: [], status: "draft", lastID: "", events: [] };
}
export function apply(state: Answer, event: Event): Answer {
  if (state.status === "cancelled") return state;
  if (
    !event ||
    typeof event.id !== "string" ||
    typeof event.event !== "string" ||
    typeof event.data !== "string"
  )
    throw Error("invalid event shape");
  const previous = state.events.find((e) => e.id === event.id);
  if (previous) {
    if (previous.data !== event.data || previous.event !== event.event)
      throw Error("conflicting event identity");
    return state;
  }
  if (state.status === "completed") throw Error("event after completion");
  if (
    !/^[1-9][0-9]*$/.test(event.id) ||
    !Number.isSafeInteger(Number(event.id)) ||
    Number(event.id) !== Number(state.lastID || 0) + 1
  )
    throw Error("noncontiguous answer event ID");
  const value = JSON.parse(event.data);
  let text = state.text,
    citations = [...state.citations],
    status: Answer["status"] = "draft";
  if (value.type === "text") {
    if (typeof value.text !== "string") throw Error("text payload required");
    text += value.text;
  } else if (value.type === "citation") {
    if (
      typeof value.label !== "string" ||
      !value.label.trim() ||
      typeof value.url !== "string"
    )
      throw Error("citation required");
    const u = new URL(value.url);
    if (!["http:", "https:"].includes(u.protocol))
      throw Error("unsafe citation URL");
    citations.push({ label: value.label, url: value.url });
  } else if (value.type === "complete") {
    status = "completed";
  } else throw Error("unknown answer event type");
  return {
    text,
    citations,
    status,
    lastID: event.id,
    events: [...state.events, { ...event }],
  };
}
export function interrupt(state: Answer): Answer {
  return state.status === "completed" || state.status === "cancelled"
    ? state
    : { ...state, status: "interrupted" };
}
export function cancel(state: Answer): Answer {
  return state.status === "completed"
    ? state
    : { ...state, status: "cancelled" };
}
export async function connect(
  url: string,
  state: Answer,
  onState: (s: Answer) => void,
  signal?: AbortSignal,
): Promise<Answer> {
  if (state.status === "completed" || state.status === "cancelled")
    return state;
  const decoder = new SSEDecoder();
  let current = state;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let response: Response | null = null;
  try {
    response = await fetch(url, {
      headers: state.lastID ? { "Last-Event-ID": state.lastID } : {},
      signal,
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("text/event-stream") ||
      !response.body
    )
      throw Error("invalid SSE response");
    reader = response.body.getReader();
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      bytes += chunk.value?.byteLength ?? 0;
      if (bytes > 1_048_576) {
        await reader.cancel();
        throw Error("stream exceeds one MiB");
      }
      for (const event of decoder.push(
        chunk.value ?? new Uint8Array(),
        chunk.done,
      )) {
        current = apply(current, event);
        onState(current);
        if (current.status === "completed") break;
      }
      if (chunk.done || current.status === "completed") break;
    }
    if (current.status !== "completed") current = interrupt(current);
  } catch (error) {
    current = signal?.aborted ? cancel(current) : interrupt(current);
  } finally {
    if (reader) {
      try {
        await reader.cancel();
      } catch {}
      reader.releaseLock();
    } else if (response?.body) {
      try {
        await response.body.cancel();
      } catch {}
    }
  }
  onState(current);
  return current;
}
export function trace(state: Answer): string {
  return JSON.stringify(
    { schemaVersion: 1, status: state.status, events: state.events },
    null,
    2,
  );
}
export function replay(text: string): Answer {
  if (new TextEncoder().encode(text).length > 1_048_576)
    throw Error("trace too large");
  const value = JSON.parse(text);
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.events) ||
    !["draft", "interrupted", "completed", "cancelled"].includes(value.status)
  )
    throw Error("invalid trace");
  let state = initial();
  for (const e of value.events) state = apply(state, e);
  if (value.status === "completed" && state.status !== "completed")
    throw Error("missing completion event");
  if (state.status === "completed" && value.status !== "completed")
    throw Error("completion status mismatch");
  if (value.status === "cancelled") state = cancel(state);
  if (value.status === "interrupted") state = interrupt(state);
  return state;
}
export function mount(host: HTMLElement, url: string) {
  let state = initial(),
    controller: AbortController | null = null;
  const title = document.createElement("h2"),
    status = document.createElement("p"),
    text = document.createElement("pre"),
    citations = document.createElement("ul"),
    resume = document.createElement("button"),
    stop = document.createElement("button"),
    download = document.createElement("button");
  title.textContent = "Recoverable answer";
  resume.textContent = "Connect / resume";
  stop.textContent = "Cancel answer";
  download.textContent = "Download event trace";
  text.style.whiteSpace = "pre-wrap";
  host.replaceChildren(title, status, text, citations, resume, stop, download);
  const draw = (s: Answer) => {
    state = s;
    status.textContent =
      "Status: " + s.status + " | last event: " + (s.lastID || "none");
    text.textContent = s.text;
    citations.replaceChildren();
    for (const c of s.citations) {
      const li = document.createElement("li"),
        a = document.createElement("a");
      a.textContent = c.label;
      a.href = c.url;
      a.rel = "noopener noreferrer";
      li.append(a);
      citations.append(li);
    }
    resume.disabled =
      !!controller || s.status === "completed" || s.status === "cancelled";
    stop.disabled = s.status === "completed" || s.status === "cancelled";
  };
  resume.onclick = async () => {
    controller = new AbortController();
    draw(state);
    state = await connect(url, state, draw, controller.signal);
    controller = null;
    draw(state);
  };
  stop.onclick = () => {
    controller?.abort();
    state = cancel(state);
    draw(state);
  };
  download.onclick = () => {
    const a = document.createElement("a"),
      u = URL.createObjectURL(
        new Blob([trace(state)], { type: "application/json" }),
      );
    a.href = u;
    a.download = "answer-trace.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  draw(state);
  return () => {
    controller?.abort();
    host.replaceChildren();
  };
}
