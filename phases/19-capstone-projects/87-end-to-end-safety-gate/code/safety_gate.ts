// Lesson: Capstone 87: End-to-End Safety Gate (phase 19 / lesson 87)
// TypeScript port of code/safety_gate.py. Node standard library only.
// Source: phases/19-capstone-projects/87-end-to-end-safety-gate/docs/en.md
// Run: npx tsx phases/19-capstone-projects/87-end-to-end-safety-gate/code/main.ts

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Detector } from "../../83-prompt-injection-detector/code/main.js";
import { Router } from "../../85-content-classifier-integration/code/main.js";
import { stream } from "./mock_llm_stream.js";
import { Engine, Fixer } from "./rules_engine.js";

export const SEVERITY_RANK: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3 };

const TERMINATION_PATTERNS = [
  /\bsure[, ]\s*here\s+is\b/i,
  /\bstep\s*1[:.\s]\s*take\b/i,
  /\bhere\s+is\s+the\s+procedure\b/i,
  /\bcombine\s+it\s+with\s+the\s+catalyst\b/i,
];

export const REFUSAL_TEXT = "I cannot help with that. The request was blocked by the safety gate.";

export interface PreGenVerdict {
  category: string;
  confidence: number;
  fired: string[];
}

export interface DuringGenVerdict {
  terminated_early: boolean;
  matched_pattern: string | null;
  partial_chunks: number;
}

export interface PostGenVerdict {
  classifier_action: string;
  classifier_severity: string;
  rules_max_severity: string | null;
  rules_violations: string[];
}

export interface RequestTrace {
  request_id: string;
  prompt: string;
  pre_gen: PreGenVerdict;
  during_gen: DuringGenVerdict;
  post_gen: PostGenVerdict | null;
  final_action: string;
  final_output: string;
  latency_ms: number;
}

export function pyRound(x: number, digits: number): number {
  const s = x.toFixed(digits);
  const exact = Math.abs(x).toFixed(Math.min(100, digits + 30));
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + digits);
  if (tail[0] === "5" && /^50*$/.test(tail)) {
    const truncated = exact.slice(0, digits === 0 ? dot : dot + 1 + digits);
    if (Number(truncated[truncated.length - 1]) % 2 === 0) return Number((x < 0 ? "-" : "") + truncated);
  }
  return Number(s);
}

export class SafetyGate {
  detector: Detector;
  classifierRouter: Router;
  rulesEngine: Engine;
  rulesFixer: Fixer | null;
  blockConfidence: number;
  noteConfidence: number;

  constructor(opts: {
    detector?: Detector;
    classifierRouter?: Router;
    rulesEngine?: Engine;
    rulesFixer?: Fixer | null;
    blockConfidence?: number;
    noteConfidence?: number;
  } = {}) {
    this.detector = opts.detector ?? new Detector();
    this.classifierRouter = opts.classifierRouter ?? new Router();
    this.rulesEngine = opts.rulesEngine ?? new Engine();
    this.rulesFixer = opts.rulesFixer ?? null;
    this.blockConfidence = opts.blockConfidence ?? 0.85;
    this.noteConfidence = opts.noteConfidence ?? 0.5;
    if (this.rulesFixer === null) {
      this.rulesFixer = new Fixer(this.rulesEngine.rules());
    }
  }

  private preGen(prompt: string): PreGenVerdict {
    const v = this.detector.analyze(prompt);
    return { category: v.category, confidence: v.confidence, fired: [...v.fired] };
  }

  private duringGen(chunks: Iterable<string>, bufferCap = 2): [string, DuringGenVerdict] {
    const buffer: string[] = [];
    const emitted: string[] = [];
    let terminated = false;
    let matchedPattern: string | null = null;
    for (const chunk of chunks) {
      buffer.push(chunk);
      if (buffer.length > bufferCap) emitted.push(buffer.shift() as string);
      const window = buffer.join("");
      for (const pat of TERMINATION_PATTERNS) {
        if (pat.test(window)) {
          terminated = true;
          matchedPattern = pat.source;
          break;
        }
      }
      if (terminated) break;
    }
    if (!terminated) emitted.push(...buffer);
    const verdict: DuringGenVerdict = {
      terminated_early: terminated,
      matched_pattern: matchedPattern,
      partial_chunks: emitted.length,
    };
    return [emitted.join("").trim(), verdict];
  }

  private postGen(output: string): PostGenVerdict {
    const action = this.classifierRouter.run(output);
    const engineReport = this.rulesEngine.evaluate(output);
    const violations = engineReport.violations();
    return {
      classifier_action: action.verb,
      classifier_severity: action.severity,
      rules_max_severity: engineReport.maxSeverity(),
      rules_violations: violations.map((v) => v.rule_name),
    };
  }

  private aggregate(pre: PreGenVerdict, during: DuringGenVerdict, post: PostGenVerdict | null): string {
    const signals: [string, number][] = [];
    if (pre.category !== "benign") {
      if (pre.confidence >= this.blockConfidence) {
        signals.push(["pre", SEVERITY_RANK.high]);
      } else if (pre.confidence >= this.noteConfidence) {
        signals.push(["pre", SEVERITY_RANK.medium]);
      } else {
        signals.push(["pre", SEVERITY_RANK.low]);
      }
    }
    if (during.terminated_early) signals.push(["during", SEVERITY_RANK.medium]);
    if (post !== null) {
      signals.push(["post.classifier", SEVERITY_RANK[post.classifier_severity] ?? SEVERITY_RANK.none]);
      if (post.rules_max_severity) {
        signals.push(["post.rules", SEVERITY_RANK[post.rules_max_severity] ?? SEVERITY_RANK.none]);
      }
    }
    if (signals.length === 0) return "allow";
    const maxRank = Math.max(...signals.map(([, rank]) => rank));
    if (maxRank >= SEVERITY_RANK.high) return "block";
    if (maxRank >= SEVERITY_RANK.medium) return "redact";
    if (maxRank >= SEVERITY_RANK.low) return "warn";
    return "allow";
  }

  private applyAction(action: string, rawOutput: string, post: PostGenVerdict | null): string {
    if (action === "block") return REFUSAL_TEXT;
    if (action === "redact") {
      const classifierAction = this.classifierRouter.run(rawOutput);
      let redacted = classifierAction.output;
      if (post !== null && post.rules_violations.length > 0) {
        const violations = this.rulesEngine.evaluate(redacted).violations();
        if (this.rulesFixer !== null) redacted = this.rulesFixer.apply(redacted, violations);
      }
      return redacted.trim() ? redacted : REFUSAL_TEXT;
    }
    if (action === "warn") {
      return rawOutput + "\n\n[note: this response was flagged at low severity by the safety gate]";
    }
    return rawOutput;
  }

  handle(prompt: string): RequestTrace {
    const start = performance.now();
    const requestId = randomUUID().slice(0, 8);
    const pre = this.preGen(prompt);
    if (pre.confidence >= this.blockConfidence && pre.category !== "benign") {
      const finalOutput = REFUSAL_TEXT;
      const latency = performance.now() - start;
      return {
        request_id: requestId,
        prompt,
        pre_gen: pre,
        during_gen: { terminated_early: false, matched_pattern: null, partial_chunks: 0 },
        post_gen: null,
        final_action: "block",
        final_output: finalOutput,
        latency_ms: pyRound(latency, 3),
      };
    }

    const [rawOutput, during] = this.duringGen(stream(prompt));
    let post: PostGenVerdict | null = null;
    if (!during.terminated_early) post = this.postGen(rawOutput);
    const finalAction = this.aggregate(pre, during, post);
    const finalOutput = this.applyAction(finalAction, rawOutput, post);
    const latency = performance.now() - start;
    return {
      request_id: requestId,
      prompt,
      pre_gen: pre,
      during_gen: during,
      post_gen: post,
      final_action: finalAction,
      final_output: finalOutput,
      latency_ms: pyRound(latency, 3),
    };
  }
}

export function traceToDict(t: RequestTrace): Record<string, unknown> {
  return {
    request_id: t.request_id,
    prompt: t.prompt,
    pre_gen: { ...t.pre_gen },
    during_gen: { ...t.during_gen },
    post_gen: t.post_gen ? { ...t.post_gen } : null,
    final_action: t.final_action,
    final_output: t.final_output,
    latency_ms: t.latency_ms,
  };
}
