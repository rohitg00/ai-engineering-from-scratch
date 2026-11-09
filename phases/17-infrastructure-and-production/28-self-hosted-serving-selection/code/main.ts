// Lesson: Self-Hosted Serving Selection: Matching Engine to Hardware and Scale (phase 17 / lesson 28)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/28-self-hosted-serving-selection/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/28-self-hosted-serving-selection/code/main.ts

interface Decision {
  hardware: string;
  scale: string;
  workload: string;
  engine: string | null;
  reasons: string[];
}

function pickEngine(hardware: string, scale: string, workload: string): Decision {
  const reasons: string[] = [];
  let engine: string | null = null;
  const wl = workload.toLowerCase();

  if (hardware === "CPU") {
    engine = "llama.cpp";
    reasons.push("hardware is CPU: only llama.cpp is competitive");
    if (scale === "single_user") {
      reasons.push("single-user dev → Ollama wraps llama.cpp with one-command UX");
      engine = "Ollama (llama.cpp under the hood)";
    }
  } else if (hardware === "Apple Silicon") {
    engine = scale === "single_user" ? "Ollama" : "llama.cpp";
    reasons.push("Apple Silicon → Metal via llama.cpp (Ollama wraps)");
  } else if (hardware === "AMD") {
    engine = "vLLM";
    reasons.push("AMD → vLLM ROCm support; TRT-LLM is NVIDIA-only");
    if (wl.includes("agentic") || wl.includes("prefix")) {
      engine = "SGLang";
      reasons.push("agentic / prefix-heavy → SGLang RadixAttention");
    }
  } else if (hardware === "NVIDIA Hopper") {
    if (wl.includes("agentic") || wl.includes("prefix")) {
      engine = "SGLang";
      reasons.push("Hopper + agentic/prefix → SGLang is the specialist");
    } else if (scale === "single_user") {
      engine = "Ollama";
      reasons.push("single-user on Hopper is a dev scenario → Ollama is enough");
    } else {
      engine = "vLLM";
      reasons.push("Hopper production → vLLM is the broad default");
    }
  } else if (hardware === "NVIDIA Blackwell") {
    engine = "TRT-LLM";
    reasons.push("Blackwell + throughput priority → TRT-LLM leads on B200/GB200");
    if ((scale === "small_team" || scale === "production") && !wl.includes("agentic")) {
      reasons.push("vLLM Blackwell SM120 is a close second (v0.15.1 Feb 2026)");
    }
  }

  if (scale === "enterprise") {
    reasons.push(
      "10k+ users → stack with production-stack (Phase 17 · 18)" +
        " + disaggregated (Phase 17 · 17) + cache-aware router (Phase 17 · 11)",
    );
  }

  reasons.push("TGI is in maintenance mode since Dec 11, 2025: default AWAY from TGI for new projects");

  return { hardware, scale, workload, engine, reasons };
}

const SCENARIOS: [string, string, string][] = [
  ["CPU", "single_user", "chat"],
  ["Apple Silicon", "single_user", "coding assistant"],
  ["NVIDIA Hopper", "production", "general chat"],
  ["NVIDIA Hopper", "production", "agentic multi-turn"],
  ["NVIDIA Blackwell", "enterprise", "MoE frontier serving"],
  ["AMD", "production", "RAG with heavy prefix reuse"],
  ["NVIDIA Hopper", "small_team", "long-context 128K"],
];

function main(): void {
  console.log("=".repeat(80));
  console.log("SELF-HOSTED ENGINE DECISION TREE: hardware / scale / workload");
  console.log("=".repeat(80));
  for (const [hw, sc, wl] of SCENARIOS) {
    const d = pickEngine(hw, sc, wl);
    console.log(`\n[${hw}] [${sc}] [${wl}]`);
    console.log(`  → engine: ${d.engine ?? "None"}`);
    for (const r of d.reasons) console.log(`    · ${r}`);
  }
}

main();
