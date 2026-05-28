// Capstone 19/03: realtime voice web client (multi-file TypeScript).
//
// Sources:
//   この lesson の docs/en.md (WebRTC client + VAD + barge-in client UX)
//   RFC 6455 WebSocket protocol  https://datatracker.ietf.org/doc/html/rfc6455
//   ws (Node WebSocket library)  https://github.com/websockets/ws
//   Silero VAD v5 model card     https://github.com/snakers4/silero-vad
//
// pipeline は module に分割しています: vad.ts (turn-completion score + synthetic frame
// generator)、orchestrator.ts (barge-in 付き IDLE -> LISTENING -> WAITING -> THINKING ->
// SPEAKING state machine)、protocol.ts (zod-validated frame envelope)、server.ts
// (hono /healthz + ws upgrade)、この entry は2つの offline session を走らせ、
// live ws server を立てて probe し、exit 0 します。

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
        // すでに closing
      }
      finish({ events, gotSummary });
    }, timeoutMs);
    ws.on("message", (raw) => {
      try {
        const f: Frame = decodeFrame(raw.toString("utf8"));
        if (f.type === "event") events += 1;
        else if (f.type === "summary") gotSummary = true;
      } catch {
        // probe 内の malformed frame は無視する
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
  // pre-flight: state machine で2つの offline session を駆動する。
  const clean = runSession(synthCall("tokyo の明日の天気はどうですか"), {
    useTool: true,
    bargeInAtMs: null,
  });
  renderToConsole("session 1: tool (weather) 付きの正常 call", clean);
  if (clean.turnCompleteMs <= 0 || clean.firstAudioOutMs <= 0) {
    throw new Error("clean session が first audio-out に到達しませんでした");
  }

  const bargeFrames = synthCall("長い話を聞かせてください");
  if (bargeFrames.length === 0) {
    throw new Error("synthCall が frame を返しませんでした");
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
  renderToConsole("session 2: user が応答途中に barge in", bargeIn);
  if (bargeIn.bargeIns === 0) {
    throw new Error("barge-in session が barge-in event を登録しませんでした");
  }

  // live: WS server を立て、1 session を流してから tear down する。
  const { server } = buildServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("address を取得できません");
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
  if (!probe.gotSummary) throw new Error("ws probe が summary frame を受け取りませんでした");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
