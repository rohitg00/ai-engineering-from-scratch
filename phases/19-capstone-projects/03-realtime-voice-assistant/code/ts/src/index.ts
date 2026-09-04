// Capstone 19/03: realtime voice web client (multi-file TypeScript).
//
// Sources:
//   This lesson's docs/en.md (WebRTC client + VAD + barge-in client UX)
//   RFC 6455 WebSocket protocol  https://datatracker.ietf.org/doc/html/rfc6455
//   ws (Node WebSocket library)  https://github.com/websockets/ws
//   Silero VAD v5 model card     https://github.com/snakers4/silero-vad
//
// Pipeline split into modules: vad.ts (turn-completion score + synthetic frame
// generator), orchestrator.ts (IDLE -> LISTENING -> WAITING -> THINKING ->
// SPEAKING state machine with barge-in), protocol.ts (zod-validated frame
// envelope), server.ts (hono /healthz + ws upgrade), and this entry which runs
// two offline sessions, stands up the live ws server, probes it, and exits 0.

import WebSocket from "ws";
import { runSession, renderToConsole, summarize } from "./orchestrator.ts";
import { synthCall } from "./vad.ts";
import { decodeFrame } from "./protocol.ts";
import { buildServer } from "./server.ts";
import type { Frame } from "./protocol.ts";

async function probeWs(
  port: number,
  timeoutMs = 3000,
): Promise<{ events: number; gotSummary: boolean }> {
  return await new Promise<{ events: number; gotSummary: boolean }>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    let events = 0;
    let gotSummary = false;
    let settled = false;
    const finish = (val: { events: number; gotSummary: boolean }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      ws.removeAllListeners();
      try {
        ws.close();
      } catch {
        // already closing
      }
      finish({ events, gotSummary });
    }, timeoutMs);
    ws.on("message", (raw) => {
      try {
        const f: Frame = decodeFrame(raw.toString("utf8"));
        if (f.type === "event") events += 1;
        else if (f.type === "summary") gotSummary = true;
      } catch {
        // ignore malformed frames in the probe
      }
    });
    ws.on("close", () => finish({ events, gotSummary }));
    ws.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main(): Promise<void> {
  // Pre-flight: drive two offline sessions through the state machine.
  const clean = runSession(synthCall("what is the weather in tokyo tomorrow"), {
    useTool: true,
    bargeInAtMs: null,
  });
  renderToConsole("session 1: clean call with tool (weather)", clean);
  if (clean.turnCompleteMs <= 0 || clean.firstAudioOutMs <= 0) {
    throw new Error("clean session did not reach first audio-out");
  }

  const bargeFrames = synthCall("tell me a long story about");
  if (bargeFrames.length === 0) {
    throw new Error("synthCall returned no frames");
  }
  const anchorIdx = Math.max(0, bargeFrames.length - 20);
  const anchorFrame = bargeFrames[anchorIdx] ?? bargeFrames[bargeFrames.length - 1];
  for (let i = 0; i < 8; i++) {
    const idx = anchorIdx + i;
    if (idx >= 0 && idx < bargeFrames.length) {
      bargeFrames[idx] = {
        tMs: bargeFrames[idx].tMs,
        isSpeech: true,
        partial: bargeFrames[idx].partial,
      };
    }
  }
  const bargeIn = runSession(bargeFrames, {
    useTool: false,
    bargeInAtMs: anchorFrame.tMs - 60,
  });
  renderToConsole("session 2: user barges in mid-response", bargeIn);
  if (bargeIn.bargeIns === 0) {
    throw new Error("barge-in session did not register any barge-in event");
  }

  // Live: stand up the WS server, drive one session over it, and tear down.
  const { server } = buildServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("address unavailable");
  console.log(`voice-client skeleton ws://127.0.0.1:${addr.port}`);
  if (process.argv.includes("--serve")) {
    process.on("SIGINT", () => server.close(() => process.exit(0)));
    return;
  }
  const probe = await probeWs(addr.port);
  console.log(`[ws probe] frames received: ${probe.events + (probe.gotSummary ? 1 : 0)}`);
  console.log(`[ws probe] summary: ${probe.gotSummary ? "yes" : "missing"}`);
  console.log(`[ws probe] sample summary: ${JSON.stringify(summarize(clean))}`);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!probe.gotSummary) throw new Error("ws probe did not receive summary frame");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
