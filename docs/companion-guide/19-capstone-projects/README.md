# Phase 19 — Capstone Projects

## What is this phase about?
This is where you **build real, portfolio-grade systems** that prove everything from the earlier phases. It's not new concepts — it's 85 hands-on projects. Some are big standalone flagships (a coding agent, a voice assistant, a production RAG chatbot); the rest are step-by-step "from scratch" tracks that assemble a complete system (a GPT, an agent harness, a RAG pipeline, distributed training, a safety gate) one component at a time.

## Why is this phase important?
Knowing concepts isn't the same as having built something. These projects are what you show employers, what cements your understanding, and what turns "I studied AI engineering" into "I built and shipped these." A finished capstone is worth more than a hundred read lessons.

## What will I be able to build after this phase?
- Flagship apps: coding agents, voice assistants, document QA, research agents, RAG chatbots
- A GPT and its full training pipeline, from tokenizer to distributed training
- An agent harness, a RAG system, an eval runner, and a safety gate — from scratch
- A portfolio that demonstrates end-to-end AI engineering skill

## How important is this phase?
⭐⭐⭐⭐⭐ Essential. Building is how the whole course pays off.

## Difficulty
Hard — but it's *applied* hard. You're integrating things you've already learned, which is the most valuable kind of practice.

## Estimated Study Time
**60–120+ hours** across 85 project lessons. You don't need all of them — pick the standalone capstones that match your goals, plus one or two from-scratch tracks. Each track ends in a working end-to-end demo.

## How to use this phase
These are *projects*, so this guide is lighter per lesson: for each, **what you'll build**, **why it matters**, **what it teaches**, and a **mastery** rating. The lessons are grouped into one set of standalone capstones plus eight build-from-scratch tracks. Read a track's intro, then skim its lessons before you start.

> Mastery legend: 🟢 do it if relevant to your goals · 🟡 strongly recommended · 🔴 a flagship worth finishing for your portfolio

---

## Standalone Capstones (01–17)

Each of these is a complete, real-world system you can build and show off. Pick the ones that match the career direction you want.

### 01 — Terminal-Native Coding Agent
**Build:** A CLI coding agent (like Claude Code) that takes a task and produces a pull request, measured on SWE-bench.
**Why it matters:** Coding agents are the hottest product category in AI; building one end to end is a standout portfolio piece.
**Teaches:** The hard part is the tool loop, sandbox, and cost ceiling — not the model call.
**Mastery:** 🔴

### 02 — RAG Over a Codebase
**Build:** Semantic code search across many repos with tree-sitter parsing, hybrid search, reranking, and cited answers.
**Why it matters:** Every serious engineering org runs internal code search that understands meaning; it's a common production system.
**Teaches:** Function-level chunking, incremental re-indexing, and surviving 2M+ lines of code.
**Mastery:** 🔴

### 03 — Real-Time Voice Assistant
**Build:** A sub-800ms voice agent with streaming ASR, turn detection, streaming LLM, and streaming TTS over WebRTC.
**Why it matters:** Voice agents are a major product surface (support, assistants) with brutal latency demands.
**Teaches:** Latency budgets, barge-in, turn detection, and measuring WER/MOS under packet loss.
**Mastery:** 🟡

### 04 — Multimodal Document QA
**Build:** A vision-first PDF QA system (ColPali-style) that treats pages as images and answers with citations.
**Why it matters:** Vision-first late interaction now beats OCR-then-text on real documents (10-Ks, papers, handwriting).
**Teaches:** Multi-vector late interaction and side-by-side evaluation vs OCR pipelines.
**Mastery:** 🟡

### 05 — Autonomous Research Agent
**Build:** A plan-execute-verify agent that runs experiments, writes a paper, and self-reviews — within a cost budget.
**Why it matters:** Autonomous research is a frontier capability; building a budgeted, sandboxed version is impressive.
**Teaches:** Tree search over experiments, sandboxing, and surviving a sandbox-escape red team.
**Mastery:** 🟡

### 06 — DevOps Troubleshooting Agent
**Build:** An SRE agent that reads telemetry on an alert, ranks root-cause hypotheses, and posts a gated Slack brief.
**Why it matters:** AI SRE agents are going GA across the industry; read-only-by-default with human approval is the production shape.
**Teaches:** Walking a graph of infra objects, hypothesis ranking, and human-gated remediation.
**Mastery:** 🟡

### 07 — End-to-End Fine-Tuning Pipeline
**Build:** Fine-tune an 8B model on your data, DPO-align it, quantize, speculative-decode, and serve at measurable $/token.
**Why it matters:** Owning the full train→align→quantize→serve pipeline is core AI-engineering skill.
**Teaches:** A reproducible YAML-in, endpoint-out workflow plus a published model card.
**Mastery:** 🔴

### 08 — Production RAG Chatbot
**Build:** A regulated-domain RAG chatbot with hybrid search, reranking, prompt caching, guardrails, observability, and RAGAS grading.
**Why it matters:** This is *the* most common production AI system; doing it to a passing golden-set bar is highly employable.
**Teaches:** The full production RAG shape, including red-team and drift dashboards.
**Mastery:** 🔴

### 09 — Code Migration Agent
**Build:** An agent that migrates real repos (e.g. Java 8→17), combining deterministic AST rewrites with an agent for ambiguous cases.
**Why it matters:** Large-scale code migration is a high-value enterprise use case.
**Teaches:** Deterministic-substrate + agent-layer design, sandboxed builds, and a failure taxonomy.
**Mastery:** 🟡

### 10 — Multi-Agent Software Team
**Build:** An architect + parallel coders + reviewer + tester team working in parallel worktrees, evaluated on SWE-bench.
**Why it matters:** Multi-agent software factories are a leading-edge pattern; understanding their failure surface is valuable.
**Teaches:** Parallel worktrees for throughput, and which handoffs break and how often.
**Mastery:** 🟡

### 11 — LLM Observability Dashboard
**Build:** A self-hosted tracing/eval dashboard ingesting from multiple SDKs, catching an injected regression in under five minutes.
**Why it matters:** Observability is mandatory in production; building one teaches you what to monitor.
**Teaches:** Traces (ClickHouse), metadata (Postgres), and eval jobs over sampled traces.
**Mastery:** 🟡

### 12 — Video Understanding Pipeline
**Build:** A pipeline that ingests 100 hours of video and answers queries with timestamps and frame previews.
**Why it matters:** Video understanding is an emerging, high-value capability.
**Teaches:** Scene segmentation, per-scene embedding, transcript alignment, and measuring hallucination.
**Mastery:** 🟢

### 13 — MCP Server With Registry
**Build:** A production MCP server with StreamableHTTP, OAuth 2.1 scopes, policy gating, and a discovery registry.
**Why it matters:** MCP is the default tool-use spec; enterprise-grade servers are in demand.
**Teaches:** Transport, auth, policy, and registry patterns for platform teams.
**Mastery:** 🟡

### 14 — Speculative Decoding Server
**Build:** A serving stack (vLLM/SGLang + EAGLE drafts) hitting 2.5x+ baseline throughput with a tail-latency report.
**Why it matters:** Inference cost/speed is where production money is; speculative decoding is a top lever.
**Teaches:** Draft models, quantization, and autoscaling on queue-wait.
**Mastery:** 🟢

### 15 — Constitutional Safety Harness
**Build:** A layered safety harness with classifiers, an autonomous red-team agent (6+ attack families), and a self-critique loop.
**Why it matters:** Safety harnesses are required for responsible deployment.
**Teaches:** Wiring classifiers, adversarial evaluation tools, and measuring a harmlessness delta.
**Mastery:** 🟡

### 16 — GitHub Issue-to-PR Agent
**Build:** A self-hosted "label an issue, get a PR" agent in a cloud sandbox, compared on cost and pass rate to hosted tools.
**Why it matters:** This is a shipping product shape across the industry.
**Teaches:** Reproducing build environments, preventing credential leaks, per-repo budgets, and force-push protection.
**Mastery:** 🟡

### 17 — Personal AI Tutor
**Build:** An adaptive, multimodal Socratic tutor with a learner model, spaced repetition, and content-safety filters.
**Why it matters:** Adaptive tutoring shipped at scale in 2026; education AI is a large market.
**Teaches:** Socratic policy, knowledge tracing, and passing a content-safety audit.
**Mastery:** 🟢

---

## Track A — Build an Agent Harness From Scratch (20–29)

**The arc:** "The harness is the agent; the model is a coprocessor." You build every layer that wraps a model into a reliable coding agent — loop, tools, transport, dispatch, planning, gates, sandbox, evals, tracing — then assemble a working end-to-end agent. The model plugs into one seam at the end.

### 20 — Agent Harness Loop Contract
**Build:** The frozen loop contract any model can plug into.
**Why it matters:** The loop, not the model, is the real product.
**Teaches:** The observe-think-act contract as a stable interface.
**Mastery:** 🔴

### 21 — Tool Registry & Schema Validation
**Build:** A tool registry with a schema checker.
**Why it matters:** A tool the agent can't validate is one it can't safely call.
**Teaches:** Validating tool schemas before building tools.
**Mastery:** 🟡

### 22 — JSON-RPC stdio Transport
**Build:** The JSON-RPC-over-stdio transport by hand.
**Why it matters:** Hand-rolling it shows what every framing layer pays for.
**Teaches:** Message framing between model client and tool server.
**Mastery:** 🟡

### 23 — Function-Call Dispatcher
**Build:** The dispatcher that runs tool calls with timeouts, retries, dedupe, and error mapping.
**Why it matters:** This seam is where the harness honors every promise the schema made.
**Teaches:** Reliable tool dispatch under failure.
**Mastery:** 🟡

### 24 — Plan-Execute Control Flow
**Build:** A replanner that survives failures.
**Why it matters:** A plan that can't survive failure is just a script; replanning makes it an agent.
**Teaches:** Plan-execute-replan control flow.
**Mastery:** 🔴

### 25 — Verification Gates & Observation Budget
**Build:** A deterministic gate chain plus an observation ledger tracking every token shown to the model.
**Why it matters:** A harness without verification is "a wish in a trenchcoat."
**Teaches:** Gating tool calls and bounding what the model sees.
**Mastery:** 🔴

### 26 — Sandbox Runner & Denylist
**Build:** A subprocess runner that refuses dangerous executables/paths, truncates output, and kills runaways.
**Why it matters:** It's the layer between the model and the operating system.
**Teaches:** Sandboxing tool execution safely.
**Mastery:** 🔴

### 27 — Eval Harness & Fixture Tasks
**Build:** A harness that runs fixture tasks through an agent and reports pass@1, pass@k, latency, and cost.
**Why it matters:** It's the source of truth distinguishing a regression from a refactor.
**Teaches:** Deterministic agent evaluation.
**Mastery:** 🔴

### 28 — Observability & OTel Traces
**Build:** A span builder emitting OpenTelemetry GenAI-compliant traces and Prometheus metrics.
**Why it matters:** A harness without observability is a black box that costs money.
**Teaches:** Standards-compliant tracing, offline and in stdlib.
**Mastery:** 🟡

### 29 — End-to-End Coding Task Demo
**Build:** All layers stitched into an agent that fixes a real multi-file bug (deterministic policy for reproducibility).
**Why it matters:** It proves the harness was the interesting part all along.
**Teaches:** Composition — and that a real model plugs into one seam.
**Mastery:** 🔴

---

## Track B — Build a GPT and Its Training Pipeline From Scratch (30–49)

**The arc:** From raw bytes to a trained, fine-tuned, aligned language model — then the production training machinery (schedules, mixed precision, checkpointing, distributed). This is the deepest "understand it by building it" track in the course.

### 30 — BPE Tokenizer From Scratch
**Build:** A byte-pair-encoding tokenizer with a perfect round-trip.
**Why it matters:** Every modern text model starts from a tokenizer.
**Teaches:** Bytes → ids → bytes.
**Mastery:** 🔴

### 31 — Tokenized Dataset & Sliding Window
**Build:** The data conveyor that feeds token ids into training.
**Why it matters:** Pretraining is a function from token ids to gradients; this feeds it.
**Teaches:** Sliding-window batching.
**Mastery:** 🟡

### 32 — Token & Positional Embeddings
**Build:** The two lookup tables turning ids into vectors.
**Why it matters:** The positional choice shapes what the model can learn.
**Teaches:** Token and position embeddings.
**Mastery:** 🟡

### 33 — Multi-Head Self-Attention
**Build:** Attention as the model actually uses it — projections, heads, mask.
**Why it matters:** Attention is the heart of the transformer.
**Teaches:** Multi-head masked self-attention.
**Mastery:** 🔴

### 34 — Transformer Block
**Build:** Both pre-LN and post-LN blocks, side by side.
**Why it matters:** One block is the unit of every modern decoder LLM.
**Teaches:** Why pre-LN trains stably without warmup.
**Mastery:** 🔴

### 35 — GPT Model Assembly
**Build:** A working 124M-parameter GPT from stacked blocks, with sampling.
**Why it matters:** This is the full model, assembled.
**Teaches:** Embeddings, blocks, final norm, tied head, and generation.
**Mastery:** 🔴

### 36 — Training Loop & Eval
**Build:** The training loop: AdamW, warmup+cosine schedule, eval pass, qualitative probes, loss logging.
**Why it matters:** The same skeleton trains every decoder LLM you'll build.
**Teaches:** A loop that measures instead of lying.
**Mastery:** 🔴

### 37 — Loading Pretrained Weights
**Build:** Load GPT-2-style safetensors weights into your architecture.
**Why it matters:** Loading a checkpoint is a Tuesday; training from scratch is a budget decision.
**Teaches:** Parameter name mapping, no magic loaders.
**Mastery:** 🟡

### 38 — Classifier Fine-Tuning
**Build:** Swap the LM head for a classifier and train it two ways (final-layer vs full).
**Why it matters:** Reusing a pretrained body for classification is a core technique.
**Teaches:** What each fine-tuning strategy buys and costs.
**Mastery:** 🟡

### 39 — Instruction Tuning (SFT)
**Build:** An Alpaca-style SFT loop that masks instruction tokens and trains on the response.
**Why it matters:** SFT is the smallest change that makes a base model follow instructions.
**Teaches:** Loss masking with ignore_index.
**Mastery:** 🔴

### 40 — DPO From Scratch
**Build:** The DPO loss derived and implemented, trained on preference pairs.
**Why it matters:** DPO collapses the RLHF stack into one supervised loss.
**Teaches:** Preference alignment math and gradient direction.
**Mastery:** 🔴

### 41 — Eval Pipeline
**Build:** A unified pipeline running four evals (perplexity, exact-match, token-F1, judge) with a mock judge.
**Why it matters:** Training you can monitor; evaluation you must design.
**Teaches:** The dimensions every shipping model needs.
**Mastery:** 🟡

### 42 — Large Corpus Downloader
**Build:** A streaming downloader with decompression, MinHash dedup, and a resumable shard manifest.
**Why it matters:** Training begins long before the first forward pass.
**Teaches:** Robust data ingestion with a resume story.
**Mastery:** 🟢

### 43 — HDF5 Tokenized Corpus
**Build:** Streaming tokenization into resizable, sharded, memory-mapped HDF5.
**Why it matters:** JSONL doesn't survive 16 dataloader workers; HDF5 does.
**Teaches:** A training-speed data layout.
**Mastery:** 🟢

### 44 — Cosine LR Warmup
**Build:** The warmup + cosine-decay schedule, plotted and verified.
**Why it matters:** The schedule is the second most important decision after the loss.
**Teaches:** Why warmup protects the brittle first updates.
**Mastery:** 🟡

### 45 — Gradient Clipping & AMP
**Build:** Gradient clipping plus mixed-precision with NaN/Inf detection and clean step-skipping.
**Why it matters:** Production training can't ship without these safety belts.
**Teaches:** Taming gradient spikes and FP16 overflow.
**Mastery:** 🟡

### 46 — Gradient Accumulation
**Build:** Effective large-batch training one micro-batch at a time.
**Why it matters:** It lets you train at a batch size you can't otherwise afford.
**Teaches:** Loss scaling and deferred optimizer steps.
**Mastery:** 🟡

### 47 — Checkpoint Save/Resume
**Build:** Atomic checkpoints of model, optimizer, scheduler, step, and RNG state.
**Why it matters:** Interrupts kill runs; checkpoints let them continue.
**Teaches:** Resumability with no half-written files.
**Mastery:** 🟡

### 48 — Distributed FSDP/DDP
**Build:** Multi-rank training: broadcast params, average gradients, keep ranks in lockstep.
**Why it matters:** Multi-rank training is two collectives and one rule.
**Teaches:** Data-parallel fundamentals.
**Mastery:** 🟡

### 49 — LM Eval Harness
**Build:** A swappable harness: task definition, metric, runner, leaderboard.
**Why it matters:** A model that wins a task you can't define wins by accident.
**Teaches:** Making evaluation a first-class, swappable shape.
**Mastery:** 🟡

---

## Track C — Build an Autonomous Research Agent From Scratch (50–57)

**The arc:** A research loop where each piece is a contract: generate hypotheses, check the literature, run experiments in a sandbox, judge the results, write the paper, critique, schedule iterations, and compose it all into one demo.

### 50 — Hypothesis Generator
**Build:** A generator that forces each draft hypothesis somewhere new.
**Why it matters:** Asking the same question twice wastes tokens.
**Teaches:** Diversity-forcing generation.
**Mastery:** 🟡

### 51 — Literature Retrieval
**Build:** The layer that checks whether a hypothesis was already proven.
**Why it matters:** Hypotheses are cheap; knowing they're novel is expensive.
**Teaches:** Retrieval before spinning up a sandbox.
**Mastery:** 🟡

### 52 — Experiment Runner
**Build:** A runner that executes a spec in a sandbox and emits trustworthy JSON metrics.
**Why it matters:** The loop is only as honest as its measurements.
**Teaches:** Sandboxed, measurable experiments.
**Mastery:** 🟡

### 53 — Result Evaluator
**Build:** The verdict path turning metrics into improvement / regression / noise.
**Why it matters:** Numbers need a decision attached.
**Teaches:** Turning metrics into a one-line conclusion.
**Mastery:** 🟡

### 54 — Paper Writer
**Build:** A LaTeX skeleton that compiles, then gets filled.
**Why it matters:** A broken skeleton fails loudly — build the contract first.
**Teaches:** Structured document generation.
**Mastery:** 🟢

### 55 — Critic Loop
**Build:** A critic engineered to *converge* (not always "looks good" or "needs work").
**Why it matters:** Convergence is the whole game for self-critique.
**Teaches:** Engineering a useful critic.
**Mastery:** 🟡

### 56 — Iteration Scheduler
**Build:** The scheduler deciding what to stop exploring.
**Why it matters:** That stop decision is the heart of a research loop.
**Teaches:** Budgeted exploration scheduling.
**Mastery:** 🟡

### 57 — End-to-End Research Demo
**Build:** All contracts composed into one working research loop.
**Why it matters:** The demo catches any leaky contract.
**Teaches:** Composition of the full pipeline.
**Mastery:** 🟡

---

## Track D — Build a Vision-Language Model From Scratch (58–63)

**The arc:** From pixels to a captioning, retrieving, question-answering multimodal model: patch embedding, a ViT, modality alignment, cross-attention fusion, joint pretraining, and multimodal evaluation.

### 58 — Vision Encoder Patches
**Build:** Patch embedding — the "tokenizer for pixels."
**Why it matters:** A model that reads pixels needs to tokenize them.
**Teaches:** Image → patch grid → projected tokens + 2D position.
**Mastery:** 🟡

### 59 — ViT Transformer
**Build:** A 12-layer pre-LN vision transformer with a pooling CLS token.
**Why it matters:** It's the engine room of every modern vision-language model.
**Teaches:** Turning patch tokens into contextual image features.
**Mastery:** 🟡

### 60 — Projection Layer (Modality Align)
**Build:** An MLP projecting image tokens into the text embedding space with a cosine alignment loss.
**Why it matters:** It's the smallest VLM piece and the one that matters most for transfer.
**Teaches:** Aligning two vector spaces.
**Mastery:** 🟡

### 61 — Cross-Attention Fusion
**Build:** Cross-attention so every text token can attend to every patch.
**Why it matters:** It's how words get grounded in image regions.
**Teaches:** Cross-attention and legal mask shapes.
**Mastery:** 🟡

### 62 — Vision-Language Pretraining
**Build:** Joint training with contrastive (InfoNCE) + captioning losses.
**Why it matters:** It teaches matching and generation together.
**Teaches:** Combining two objectives.
**Mastery:** 🟡

### 63 — Multimodal Eval
**Build:** Retrieval (R@k), VQA (accuracy), and captioning (BLEU-4) metrics.
**Why it matters:** Training is half the loop; measurement is the other half.
**Teaches:** Multimodal evaluation surfaces.
**Mastery:** 🟢

---

## Track E — Build a Production RAG System From Scratch (64–69)

**The arc:** The components that make RAG actually work — chunking, hybrid retrieval, reranking, query rewriting, dual-axis evaluation — assembled into one shippable pipeline.

### 64 — Advanced Chunking Strategies
**Build:** Chunking that sets good retrieval boundaries.
**Why it matters:** Bad boundaries can't be repaired downstream.
**Teaches:** Boundary choices that decide what's retrievable.
**Mastery:** 🔴

### 65 — Hybrid Retrieval (BM25 + Dense)
**Build:** Lexical + semantic retrieval fused with reciprocal rank fusion.
**Why it matters:** The two fail on opposite queries; fusion wins on all classes.
**Teaches:** Voting beats interpolation.
**Mastery:** 🔴

### 66 — Reranker (Cross-Encoder)
**Build:** A cross-encoder reranking the bi-encoder's top-k.
**Why it matters:** It's the smartest reader, and pays for itself as a second stage.
**Teaches:** Bi-encoder vs cross-encoder trade-offs.
**Mastery:** 🟡

### 67 — Query Rewriting & HyDE
**Build:** Rewriting the user's query into what the retriever wants.
**Why it matters:** The typed query isn't the query your index wants.
**Teaches:** Bridging query-document mismatch.
**Mastery:** 🟡

### 68 — RAG Eval (Precision/Recall)
**Build:** Grading retrieval and answer at the same time on different axes.
**Why it matters:** You can't ship what you can't grade.
**Teaches:** Two metrics, two failure modes.
**Mastery:** 🔴

### 69 — End-to-End RAG System
**Build:** Six components into one pipeline, one eval loop, one demo.
**Why it matters:** This is the system you ship.
**Teaches:** Full RAG composition.
**Mastery:** 🔴

---

## Track F — Build an Eval Runner From Scratch (70–75)

**The arc:** A complete evaluation system — task spec, classical metrics, code-execution scoring, calibration/perplexity, leaderboard aggregation with significance — glued into one runner.

### 70 — Task Spec Format
**Build:** A frozen JSONL task contract and metric vocabulary.
**Why it matters:** A harness is only as good as its task contract.
**Teaches:** Defining the contract before scoring.
**Mastery:** 🟡

### 71 — Classical Metrics
**Build:** BLEU, ROUGE-L, F1, exact-match, accuracy from first principles.
**Why it matters:** These still account for most published LLM eval numbers.
**Teaches:** What each number actually means.
**Mastery:** 🔴

### 72 — Code-Execution Metric
**Build:** Extract generated code, run it safely, tally pass rates.
**Why it matters:** Code is right when it passes the tests.
**Teaches:** Honest execution-based scoring.
**Mastery:** 🟡

### 73 — Perplexity & Calibration
**Build:** Perplexity plus a calibration check on confidence vs correctness.
**Why it matters:** Calibration is half of trustworthy eval.
**Teaches:** Whether the model's confidence is honest.
**Mastery:** 🟡

### 74 — Leaderboard Aggregation
**Build:** Per-model rankings with statistical significance.
**Why it matters:** Significance on a leaderboard is the part everyone skips.
**Teaches:** Aggregating heterogeneous tasks rigorously.
**Mastery:** 🟡

### 75 — End-to-End Eval Runner
**Build:** Spec → adapter → scoring → calibration → leaderboard, self-terminating.
**Why it matters:** It glues the whole track into one tool.
**Teaches:** Eval-runner composition.
**Mastery:** 🟡

---

## Track G — Build Distributed Training From Scratch (76–81)

**The arc:** The machinery that scales training across many devices — collective ops, data parallelism, optimizer-state sharding, pipeline parallelism, sharded checkpoints — assembled into a multi-rank training run.

### 76 — Collective Ops From Scratch
**Build:** allreduce, broadcast, allgather, reduce_scatter over a process mesh.
**Why it matters:** Every training-framework primitive wraps these four.
**Teaches:** The collectives that hold distributed training together.
**Mastery:** 🟡

### 77 — Data-Parallel DDP
**Build:** DDP as a backward hook on allreduce (~200 lines).
**Why it matters:** It's the simplest, most common scaling pattern.
**Teaches:** Broadcast init + gradient allreduce.
**Mastery:** 🟡

### 78 — ZeRO Parameter Sharding
**Build:** ZeRO stage 1 sharding optimizer state across ranks.
**Why it matters:** Adam state can dwarf the model (56GB for 7B); sharding it drops memory linearly.
**Teaches:** Optimizer-state sharding.
**Mastery:** 🟡

### 79 — Pipeline Parallel
**Build:** Model split across ranks with microbatches; minimize the bubble.
**Why it matters:** It's how very large models fit across devices.
**Teaches:** Pipeline stages and bubble reduction.
**Mastery:** 🟢

### 80 — Sharded Checkpoint Resume
**Build:** Parallel sharded checkpoints with a manifest and atomic writes.
**Why it matters:** The format decides whether a failure costs 30 minutes or 30 hours.
**Teaches:** Resumable distributed checkpointing.
**Mastery:** 🟢

### 81 — End-to-End Distributed Train
**Build:** A tiny GPT across 4 simulated ranks with DDP + ZeRO-1 + sharded checkpoint.
**Why it matters:** It assembles the whole track into one run.
**Teaches:** Distributed training composition.
**Mastery:** 🟡

---

## Track H — Build a Safety Gate From Scratch (82–87)

**The arc:** A layered safety system — attack taxonomy, injection detector, refusal evaluation, output classifiers, a rules engine, and a three-checkpoint gate with an audit trail.

### 82 — Jailbreak Taxonomy
**Build:** A named taxonomy of attack families.
**Why it matters:** A harness without a taxonomy is a coin flip — name the attack before defending it.
**Teaches:** Categorizing attacks.
**Mastery:** 🟡

### 83 — Prompt-Injection Detector
**Build:** A detector mapping a prompt to confidence and category.
**Why it matters:** Anything less is a vibe.
**Teaches:** Detection as a real function.
**Mastery:** 🔴

### 84 — Refusal Evaluation
**Build:** Separate measurement of helpfulness (benign) and refusal (harmful).
**Why it matters:** They're two metrics, not one.
**Teaches:** Measuring both axes.
**Mastery:** 🟡

### 85 — Content Classifier Integration
**Build:** Output-side classifiers behind a policy router.
**Why it matters:** Output classifiers answer a different question than input rules.
**Teaches:** Routing between input and output checks.
**Mastery:** 🟡

### 86 — Constitutional Rules Engine
**Build:** Rules as (name, predicate, explanation).
**Why it matters:** Missing any of the three makes it a vibe, not a rule.
**Teaches:** Structured, auditable rules.
**Mastery:** 🟡

### 87 — End-to-End Safety Gate
**Build:** Pre-gen, during-gen, post-gen checkpoints into one verdict with a per-request audit trail.
**Why it matters:** Three checkpoints, one verdict — the shippable safety shape.
**Teaches:** Composing a full safety gate.
**Mastery:** 🔴

---

## Phase Summary

**What I learned.** How to *build* real systems end to end — not just understand concepts. Seventeen flagship capstones plus eight from-scratch tracks that assemble complete systems (an agent harness, a GPT and its training pipeline, a research agent, a VLM, a RAG system, an eval runner, distributed training, and a safety gate).

**What I should remember.** Building beats reading. In agents, the harness is the product, not the model. In training, the data and the loop matter as much as the architecture. In RAG, chunking and retrieval decide everything. In safety, named taxonomies and structured rules beat vibes.

**Most important lessons.** 🔴 The standalone capstones matching your career goal (coding agent, fine-tuning pipeline, production RAG chatbot), plus the agent-harness, GPT-from-scratch, and RAG-from-scratch tracks.

**Revisit later.** The deeper infrastructure tracks (distributed training, eval runner) and specialized capstones (video, speculative decoding) — return to these as specific needs arise.

**Real-world applications.** These *are* the real-world applications — each capstone mirrors a shipping product category in 2026.

**Interview relevance.** Maximum. A finished, explainable capstone is the single strongest signal you can bring to an AI-engineering interview. Being able to walk through what you built, why, and what broke beats any amount of theory.
