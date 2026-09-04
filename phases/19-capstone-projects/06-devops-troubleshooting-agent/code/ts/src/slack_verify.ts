import { createHmac, timingSafeEqual } from "node:crypto";
import type { SignatureVerdict } from "./types.js";

export const SIGNATURE_VERSION = "v0";
export const REPLAY_WINDOW_SECONDS = 60 * 5;

export type VerifyArgs = {
  signingSecret: string;
  timestamp: string;
  signature: string;
  rawBody: string;
  nowSeconds: number;
};

export function verifySlackSignature(args: VerifyArgs): SignatureVerdict {
  const ts = Number(args.timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad-timestamp" };
  if (Math.abs(args.nowSeconds - ts) > REPLAY_WINDOW_SECONDS) {
    return { ok: false, reason: "stale" };
  }
  const base = `${SIGNATURE_VERSION}:${args.timestamp}:${args.rawBody}`;
  const computed =
    `${SIGNATURE_VERSION}=` +
    createHmac("sha256", args.signingSecret).update(base).digest("hex");
  const got = Buffer.from(args.signature);
  const want = Buffer.from(computed);
  if (got.length !== want.length) return { ok: false, reason: "length-mismatch" };
  if (!timingSafeEqual(got, want)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

export function signForTesting(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
): string {
  const base = `${SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
  return (
    `${SIGNATURE_VERSION}=` +
    createHmac("sha256", signingSecret).update(base).digest("hex")
  );
}
