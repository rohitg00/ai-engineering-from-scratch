# AI Engineering Glossary

Use this glossary when a lesson, paper, model card, or code review introduces a term faster than it explains it. Search by the exact term or an alias, read the direct definition first, then use the practical note to connect it to a system you can build.

Each entry belongs to one learning category. `Related terms` gives you the next useful concepts without forcing a fixed path. Definitions describe the common engineering meaning, but provider-specific behavior can differ. When an API contract or model card disagrees with a general definition, the current official documentation wins.

The twelve categories are: Math & training; Models & inference; Data & representations; Retrieval & generation; Prompting & context; Agents & tools; Evaluation & safety; AI-native development; Infrastructure & serving; Reliability & operations; Security & governance; Multimodal systems.

## A

### Activation Checkpointing
- **Category:** Math & training
- **What it actually means:** A training-memory technique that saves only selected forward-pass activations and recomputes the omitted ones during backpropagation.
- **Why it matters:** It lets you train larger models or sequences within a fixed memory budget by trading additional computation for lower activation storage.
- **In practice:** Checkpoint the memory-heavy transformer blocks, measure the extra step time, and keep recovery checkpoints separate from activation-recomputation settings.
- **Common confusion:** Activation checkpointing is not a durable training checkpoint. It helps one forward and backward pass fit in memory but cannot resume a crashed run.
- **Related terms:** Autograd, Backpropagation, Checkpoint, Mixed Precision
- **Sources:** [Training Deep Nets with Sublinear Memory Cost](https://arxiv.org/abs/1604.06174)

### Activation Function
- **Category:** Math & training
- **What people say:** The nonlinear operation between layers.
- **What it actually means:** A function applied after a linear or affine layer that introduces nonlinearity. Without it, composing layers with weights and biases collapses to one affine transformation. ReLU, GELU, and SiLU are common choices. The choice directly affects whether gradients flow during training.
- **Learn it:** [Activation Functions](../phases/03-deep-learning-core/04-activation-functions/)
- **Related terms:** ReLU, Gradient, Backpropagation

### Adam (Optimizer)
- **Category:** Math & training
- **What people say:** The optimizer you use without thinking about it.
- **What it actually means:** Adaptive Moment Estimation. It combines an exponential average of gradients with an exponential average of squared gradients, applies bias correction, and adapts the update scale per parameter. It is a useful baseline, but it still needs a suitable learning rate and schedule.
- **Common confusion:** Adam is a strong baseline, not a universal best optimizer.
- **Sources:** [Adam paper](https://arxiv.org/abs/1412.6980)
- **Related terms:** AdamW, Optimizer, Learning Rate

### AdamW
- **Category:** Math & training
- **What people say:** Adam with weight decay fixed.
- **What it actually means:** An Adam variant that decouples weight decay from the gradient-based parameter update. That makes the shrinkage behavior easier to reason about than adding an L2 penalty inside Adam's adaptively scaled gradient.
- **Common confusion:** Decoupled weight decay does not make AdamW universally optimal. Model, data, and training scale still determine the best optimizer and schedule.
- **Sources:** [Decoupled Weight Decay Regularization](https://arxiv.org/abs/1711.05101)
- **Related terms:** Adam (Optimizer), Weight Decay, Optimizer

### Admission Control
- **Category:** Reliability & operations
- **What it actually means:** A pre-acceptance gate that decides whether a request may enter a bounded queue or service under the system's current capacity, priority, and policy.
- **Why it matters:** Rejecting excess work at a controlled boundary protects admitted requests from queue growth, timeout cascades, and resource exhaustion.
- **In practice:** Estimate the request's cost, check tenant and system capacity, reserve the required budget atomically, and identify the overloaded scope when rejecting. Give retry guidance only when the condition is transient and the caller's retry budget permits another attempt.
- **Common confusion:** Admission control acts before acceptance. Load shedding can reject or remove work at ingress, in queues, at dependencies, or at other overload boundaries.
- **Related terms:** Load Shedding, Backpressure, Rate Limit, Saturation
- **Sources:** [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/)

### Agent
- **Category:** Agents & tools
- **What people say:** An autonomous model that thinks and acts alone.
- **What it actually means:** A software system that lets a model select actions toward a goal, observe tool or environment results, and continue under an orchestration policy. An agent may use a loop, a state machine, a workflow engine, or human approvals. The model is one component, not the entire system.
- **Why it matters:** Reliability comes from the harness, tool contracts, state, permissions, and verification around the model.
- **In practice:** A coding agent reads repository context, proposes a patch, runs tests in a sandbox, and stops for approval before deployment.
- **Common confusion:** Autonomy is a degree of delegated authority, not a required property of every agent.
- **Learn it:** [The Agent Loop](../phases/14-agent-engineering/01-the-agent-loop/)
- **Related terms:** Agent Harness, Agent State, Tool Contract, Human-in-the-Loop (HITL)

### Agent Harness
- **Category:** Agents & tools
- **What it actually means:** The runtime around a model that assembles context, exposes tools, manages state, enforces limits, records traces, and decides when the agent should continue, retry, ask, or stop.
- **Why it matters:** Two systems using the same model can perform very differently because their harnesses provide different context, tools, feedback, and safety boundaries.
- **In practice:** Your harness can limit an agent to five tool calls, persist a checkpoint after each accepted patch, and require a passing test command before completion.
- **Common confusion:** A harness is broader than a prompt template and narrower than the complete product.
- **Learn it:** [Minimal Agent Workbench](../phases/14-agent-engineering/32-minimal-agent-workbench/)
- **Related terms:** Agent, Tool Contract, Agent State, Verification Gate, Sandbox

### Agent Memory
- **Category:** Agents & tools
- **What it actually means:** Information stored outside the model and selected for use in later agent steps, such as prior decisions, user preferences, task episodes, or verified facts.
- **Why it matters:** It gives an agent continuity beyond one context window without forcing every past event into every prompt.
- **In practice:** Store a compact task outcome with provenance, retrieve it only when relevant, and let the user inspect or correct durable personal information.
- **Common confusion:** Agent memory is not the same as agent state. State tracks the current run; memory preserves selected information for possible future runs.
- **Related terms:** Agent State, Context Engineering, Checkpoint, Semantic Cache
- **Sources:** [Generative Agents](https://arxiv.org/abs/2304.03442)

### Agent State
- **Category:** Agents & tools
- **What it actually means:** The explicit data an agent carries across steps, such as the current objective, completed actions, tool results, open questions, budgets, approvals, and artifact references.
- **Why it matters:** Explicit state makes long tasks resumable, inspectable, and less dependent on the model reconstructing progress from a transcript.
- **In practice:** Store the selected issue, changed files, latest test result, and remaining checks in a typed object that is updated after each action.
- **Common confusion:** State is not the same as conversation history. A transcript is evidence; state is the compact operational record used to decide what happens next.
- **Learn it:** [Repository Memory and State](../phases/14-agent-engineering/34-repo-memory-and-state/)
- **Related terms:** Checkpoint, Durable Execution, Context Engineering, Handoff

### Agent Skill
- **Category:** Agents & tools
- **What it actually means:** A discoverable directory of procedural instructions whose entry point is `SKILL.md`, with optional references, scripts, and assets that a compatible runtime can load in stages.
- **Why it matters:** It packages reusable task knowledge separately from one conversation while keeping deeper context and deterministic helpers available on demand.
- **In practice:** Publish a compact name and routing description, load the workflow only after activation, and read branch-specific references when the task reaches them.
- **Common confusion:** Activating a skill supplies context. It does not expose a tool, grant permission, create a sandbox, or prove that the resulting work is correct.
- **Learn it:** [Agent Skills: Portable Contract and Runtime Boundary](../phases/13-tools-and-protocols/22-skills-and-agent-sdks/)
- **Related terms:** Skill Bundle, Skill Catalog, Skill Invocation, Progressive Disclosure, MCP (Model Context Protocol)
- **Sources:** [Agent Skills specification](https://agentskills.io/specification)

### AI Risk Assessment
- **Category:** Security & governance
- **What it actually means:** A documented analysis of how an AI system can affect people, organizations, and environments, including context, hazards, likelihood, impact, controls, residual risk, and monitoring responsibilities.
- **Why it matters:** Model capability alone does not determine risk. Deployment context, affected groups, human authority, data, and system integrations change both the harms and the controls required.
- **In practice:** Define the intended use and affected parties, identify credible failure and misuse scenarios, assign owners to controls, record residual risk, and set review triggers for material changes.
- **Common confusion:** A risk assessment supports a decision under stated assumptions. It is not a one-time safety certificate or proof that every hazard has been found.
- **Related terms:** Threat Model, Guardrails, Human-in-the-Loop (HITL), Data Classification
- **Sources:** [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)

### Alignment
- **Category:** Evaluation & safety
- **What people say:** Making AI safe.
- **What it actually means:** The effort to make a model or AI system behave in ways that match intended goals, constraints, and human preferences across both expected and adversarial situations.
- **Why it matters:** A system can optimize the stated metric while violating the user's real intent, so alignment requires evaluation, oversight, and system controls as well as model training.
- **Related terms:** Guardrails, Evaluation (Eval), Human-in-the-Loop (HITL)

### Approval Gate
- **Category:** Agents & tools
- **What it actually means:** A control point that blocks a consequential action until an authorized person or policy grants permission.
- **Why it matters:** It limits the blast radius of uncertain model decisions while preserving automation for reversible work.
- **In practice:** Let an agent draft a database migration and run it against a disposable database, but require an owner to approve any production execution.
- **Common confusion:** An approval gate asks whether an action is authorized. A verification gate asks whether evidence shows the action is correct.
- **Learn it:** [Verification Gates](../phases/14-agent-engineering/38-verification-gates/)
- **Related terms:** Human-in-the-Loop (HITL), Verification Gate, Least Privilege

### Approximate Nearest Neighbor (ANN)
- **Category:** Retrieval & generation
- **What it actually means:** A search method that returns vectors likely to be among the nearest to a query without exhaustively comparing the query with every stored vector.
- **Why it matters:** Approximation makes large vector indexes practical, but it introduces a measurable tradeoff between search speed, memory, and retrieval recall.
- **In practice:** Tune index and search parameters against a held-out query set, then report latency together with Recall@K instead of assuming every true neighbor is found.
- **Common confusion:** ANN describes a search objective and tradeoff, while HNSW is one particular index algorithm that can implement it.
- **Related terms:** Vector Database, HNSW, Cosine Similarity, Recall@K
- **Sources:** [Efficient and Robust Approximate Nearest Neighbor Search Using HNSW](https://dl.acm.org/doi/10.1109/TPAMI.2018.2889473)

### Attention
- **Category:** Models & inference
- **What people say:** How a model focuses on important tokens.
- **What it actually means:** A mechanism that forms contextual representations by comparing query vectors with key vectors, normalizing the resulting scores, and using them to combine value vectors. Masks, position rules, or sparse patterns can restrict which positions participate.
- **Why it matters:** Attention lets a model route information between sequence positions, but it does not by itself explain or prove what the model understood.
- **Common confusion:** Attention weights are computation coefficients, not a faithful explanation of model reasoning.
- **Learn it:** [Self-Attention from Scratch](../phases/07-transformers-deep-dive/02-self-attention-from-scratch/)
- **Sources:** [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
- **Related terms:** Self-Attention, Transformer, KV Cache

### Audio Token
- **Category:** Multimodal systems
- **What it actually means:** A discrete identifier produced by an audio codec or tokenizer for a short segment or feature of an audio signal, sometimes across several codebooks.
- **Why it matters:** Discrete audio representations let sequence models process, predict, store, or generate sound using token-oriented architectures.
- **In practice:** Version the codec with the model, preserve sample-rate and codebook metadata, measure reconstruction quality, and distinguish semantic audio tokens from waveform-compression tokens.
- **Common confusion:** An audio token is not a fixed duration, phoneme, or word. Its meaning and time span depend on the tokenizer and codebook design.
- **Learn it:** [Neural Audio Codecs](../phases/06-speech-and-audio/13-neural-audio-codecs/)
- **Related terms:** Token, Embedding, Automatic Speech Recognition (ASR), Multimodal Model
- **Sources:** [SoundStream](https://arxiv.org/abs/2107.03312)

### Audit Log
- **Category:** Security & governance
- **What it actually means:** A durable, access-controlled record of security- or accountability-relevant events, including who or what acted, what changed, when it happened, and the resulting status.
- **Why it matters:** Consequential agent actions need evidence that supports investigation, policy review, and responsibility beyond performance debugging.
- **In practice:** Record tool authorization, approval decisions, external writes, policy versions, and artifact identifiers while redacting secrets and restricting log access.
- **Common confusion:** A trace helps diagnose one execution path. An audit log preserves events required for accountability across executions and over time.
- **Related terms:** Trace, Observability, Approval Gate, Provenance Attestation
- **Sources:** [NIST SP 800-92](https://csrc.nist.gov/pubs/sp/800/92/final)

### Autograd
- **Category:** Math & training
- **What people say:** Automatic gradients.
- **What it actually means:** A system that records or transforms tensor operations so it can compute derivatives, usually with reverse-mode automatic differentiation. You write the forward computation and the framework derives the gradients needed for backpropagation.
- **Learn it:** [Chain Rule and Automatic Differentiation](../phases/01-math-foundations/05-chain-rule-and-autodiff/)
- **Related terms:** Backpropagation, Gradient, Tensor

### Automatic Speech Recognition (ASR)
- **Category:** Multimodal systems
- **What it actually means:** The task and system pipeline that maps a speech signal to a transcription, often with optional token or segment timing and confidence information.
- **Why it matters:** Speech interfaces depend on more than language modeling. Acoustic variation, segmentation, decoding, vocabulary, and domain conditions all affect the final transcript.
- **In practice:** Evaluate word or character errors by language, speaker, noise, and domain, retain timestamps when downstream grounding needs them, and test the exact audio preprocessing used in production.
- **Common confusion:** ASR transcribes what was said. Determining who spoke requires diarization or speaker recognition, while translation and intent understanding are separate tasks.
- **Learn it:** [Speech Recognition and ASR](../phases/06-speech-and-audio/04-speech-recognition-asr/)
- **Related terms:** Audio Token, Encoder, Tokenization, Multimodal Model
- **Sources:** [Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf)

### Autoregressive
- **Category:** Models & inference
- **What people say:** The model generates one word at a time.
- **What it actually means:** A factorization in which each output token is predicted from the tokens that precede it. During generation, the selected token is appended to the sequence and becomes part of the next prediction's context.
- **Common confusion:** The unit is a token, not necessarily a word, and generation can use decoding methods other than always selecting the highest-probability token.
- **Related terms:** Token, Temperature, KV Cache

### Autoscaling
- **Category:** Infrastructure & serving
- **What it actually means:** A control loop that changes the number or capacity of serving workers from observed demand, resource use, or application metrics within configured bounds.
- **Why it matters:** AI workloads can change faster than manual provisioning, but scaling decisions must account for model-load time, accelerator availability, queueing, and request cost.
- **In practice:** Scale from a demand signal tied to useful work, set minimum warm capacity, bound scale-down churn, and verify that new replicas pass readiness checks before receiving traffic.
- **Common confusion:** Autoscaling adds or removes capacity. It does not make an overloaded dependency faster or guarantee that enough hardware can be acquired in time.
- **Learn it:** [GPU Autoscaling on Kubernetes](../phases/17-infrastructure-and-production/03-gpu-autoscaling-kubernetes/)
- **Related terms:** Model Serving, Saturation, Readiness Probe, Backpressure
- **Sources:** [Kubernetes Horizontal Pod Autoscaling](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)

### Availability
- **Category:** Reliability & operations
- **What it actually means:** The proportion of eligible service interactions or time windows in which users can obtain the defined acceptable service under a stated measurement boundary.
- **Why it matters:** A service can be running while users still cannot complete useful requests, so availability must be tied to user-visible success rather than process uptime alone.
- **In practice:** Define eligible events and acceptable outcomes, exclude only documented cases, calculate the indicator over a fixed window, and investigate both total failures and prolonged partial degradation.
- **Common confusion:** Availability is one reliability outcome. It does not describe latency, correctness, safety, or the experience of every user segment.
- **Related terms:** Service Level Indicator (SLI), Service Level Objective (SLO), Error Budget, Incident Response
- **Sources:** [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)

## B

### Backpressure
- **Category:** AI-native development
- **What it actually means:** A flow-control mechanism that slows or rejects upstream work when a downstream component cannot process it safely at the current rate.
- **Why it matters:** Without backpressure, queued agent runs, tool calls, or streamed events can exhaust memory, exceed rate limits, and amplify retries.
- **In practice:** When the evaluator queue reaches its limit, pause new agent jobs or return a retryable response instead of accepting unbounded work.
- **Common confusion:** Backpressure protects capacity before failure. A circuit breaker stops calls after failures show a dependency is unhealthy.
- **Related terms:** Rate Limit, Retry with Backoff, Circuit Breaker

### Backpropagation
- **Category:** Math & training
- **What people say:** How neural networks learn.
- **What it actually means:** An efficient application of the chain rule that propagates derivatives from a scalar loss backward through a computation graph. It computes gradients; an optimizer uses those gradients to update parameters.
- **Common confusion:** Backpropagation calculates gradients. It does not choose the update rule or learning rate.
- **Why it's called that:** Derivative information moves backward from the loss toward earlier operations.
- **Learn it:** [Backpropagation from Scratch](../phases/03-deep-learning-core/03-backpropagation/)
- **Related terms:** Autograd, Gradient, Optimizer

### Batch Size
- **Category:** Math & training
- **What people say:** How many examples are processed at once.
- **What it actually means:** The number of examples whose losses contribute to one gradient estimate before an optimizer update. Larger batches can improve hardware utilization and reduce gradient noise, but they require more memory and may need different learning-rate or scheduling choices.
- **Common confusion:** There is no universal batch-size range or rule that says every batch increase should produce the same learning-rate increase.
- **Related terms:** Learning Rate, Gradient, Optimizer

### Benchmark Contamination
- **Category:** Evaluation & safety
- **What it actually means:** Overlap or information leakage between evaluation examples and data used to pretrain, tune, prompt, select, or otherwise improve the evaluated system.
- **Why it matters:** Contamination can make a benchmark score reflect prior exposure rather than the ability to generalize to unseen tasks.
- **In practice:** Track dataset provenance, search training sources for exact and near duplicates, hold back private test cases, and refresh public evals with newly authored examples.
- **Common confusion:** Contamination is broader than exact copying. Paraphrases, answer keys, benchmark metadata, and repeated prompt tuning can also leak evaluation information.
- **Related terms:** Data Leakage, Data Deduplication, Eval Set, Exact Match (EM)
- **Sources:** [Investigating Data Contamination in Modern Benchmarks for Large Language Models](https://arxiv.org/abs/2311.09783)

### BM25
- **Category:** Retrieval & generation
- **What it actually means:** A lexical ranking function that scores a document from query-term matches while accounting for term rarity, repeated occurrences, and document length.
- **Why it matters:** It is a strong exact-term retrieval baseline and complements dense retrieval for identifiers, rare words, and domain-specific phrases.
- **In practice:** Retrieve candidates with BM25 and dense search, combine their ranks, then evaluate the merged results before adding a more expensive reranker.
- **Common confusion:** BM25 does not understand semantic similarity directly, and its score has no universal meaning across different queries or index configurations.
- **Related terms:** Hybrid Retrieval, Dense Retrieval, Reranker, RAG (Retrieval-Augmented Generation)
- **Sources:** [The Probabilistic Relevance Framework: BM25 and Beyond](https://doi.org/10.1561/1500000019)

### Byte Pair Encoding (BPE)
- **Category:** Data & representations
- **What it actually means:** A subword-tokenization method that repeatedly merges frequent adjacent units to construct a fixed vocabulary from training text.
- **Why it matters:** It balances vocabulary size with the ability to represent rare or unseen words as smaller units.
- **In practice:** Train the tokenizer only on approved corpus splits, version its merge rules with the model, and inspect how it segments code, multilingual text, and whitespace.
- **Common confusion:** BPE is one tokenizer family, not a universal description of how every model creates tokens.
- **Related terms:** Tokenization, Vocabulary, Token, Embedding
- **Sources:** [Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909)

## C

### Calibration
- **Category:** Evaluation & safety
- **What it actually means:** The agreement between a system's stated confidence and the observed frequency with which predictions at that confidence are correct.
- **Why it matters:** A system can be accurate on average yet dangerously overconfident on the cases where people rely on its score.
- **In practice:** Bucket predictions by confidence, compare confidence with empirical accuracy, and recalibrate or abstain when the gap is unacceptable.
- **Common confusion:** Calibration measures confidence reliability, not overall accuracy, factuality, or reasoning quality.
- **Related terms:** Softmax, Evaluation (Eval), Precision & Recall, Logits
- **Sources:** [On Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html)

### Canary Release
- **Category:** Reliability & operations
- **What it actually means:** A deployment strategy that exposes a new version to a limited slice of traffic or infrastructure before expanding the rollout.
- **Why it matters:** It limits the impact of defects and gives you production evidence before the new model, prompt, agent, or service reaches everyone.
- **In practice:** Route a small eligible cohort to the release, compare quality and operational metrics with the control, and stop or roll back on predefined failures.
- **Common confusion:** A canary release limits exposure; it does not replace pre-deployment tests, approval, or rollback preparation.
- **Related terms:** Evaluation (Eval), Observability, Rollback, Verification Gate
- **Sources:** [Kubernetes Deployments: Canary Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#canary-deployment)

### Chain of Thought (CoT)
- **Category:** Prompting & context
- **What people say:** Asking the model to show every step of its thinking.
- **What it actually means:** Intermediate reasoning used to decompose a task before producing an answer. A prompt can request a visible rationale, while some systems use internal reasoning that is not returned to the user.
- **Why it matters:** Decomposition can help on multi-step tasks, but a fluent rationale is not proof that the answer is correct or that the text faithfully represents the model's internal computation.
- **In practice:** Ask for a concise plan, independently check the result, and request verifiable calculations or citations instead of relying on a long reasoning transcript.
- **Common confusion:** Chain of thought is not a substitute for tools, tests, or external verification.
- **Learn it:** [Few-Shot and Chain of Thought](../phases/11-llm-engineering/02-few-shot-cot/)
- **Related terms:** Prompt Engineering, Verification Gate, Evaluation (Eval)

### Checkpoint
- **Category:** Agents & tools
- **What it actually means:** A durable snapshot used to resume from a known boundary. In a workflow, it stores operational state and artifact references. In model training, it can store parameters, optimizer state, scheduler state, and the training position.
- **Why it matters:** Long-running workflows and training runs can recover from interruption without replaying completed work or losing expensive progress.
- **In practice:** Save an agent's accepted patch and test evidence after a verified step, or save a training run's weights, optimizer state, random state, and data position before shutdown.
- **Common confusion:** A workflow checkpoint and a model-training checkpoint serve the same recovery goal but preserve different state. Neither is merely a transcript or a weights file with no resume metadata.
- **Learn it:** [Checkpoint Save and Resume](../phases/19-capstone-projects/47-checkpoint-save-resume/); [Repository Memory and State](../phases/14-agent-engineering/34-repo-memory-and-state/)
- **Related terms:** Agent State, Durable Execution, Parameter, Optimizer

### Chunked Prefill
- **Category:** Infrastructure & serving
- **What it actually means:** A serving technique that divides a long prompt's prefill work into smaller schedulable pieces so prompt processing can interleave with decode work from other requests.
- **Why it matters:** One long prompt can otherwise occupy the accelerator and delay active generations, producing poor tail latency even when total throughput looks healthy.
- **In practice:** Choose a chunk policy from measured workloads, account for scheduling overhead, and compare prefill completion, decode latency, and goodput under mixed prompt lengths.
- **Common confusion:** Chunked prefill changes how prompt computation is scheduled. It does not split the user's context into independent semantic chunks or change the model's context window.
- **Learn it:** [vLLM Serving Internals](../phases/17-infrastructure-and-production/04-vllm-serving-internals/)
- **Related terms:** Prefill, Decode Phase, Dynamic Batching, Tail Latency
- **Sources:** [Sarathi-Serve](https://arxiv.org/abs/2403.02310)

### Chunking
- **Category:** Retrieval & generation
- **What people say:** Splitting documents into pieces.
- **What it actually means:** Dividing source material into retrievable units before indexing. Chunk boundaries, overlap, metadata, and document structure determine whether retrieval returns enough context without flooding the prompt.
- **Why it matters:** The right chunking strategy depends on document shape, query type, embedding model, and evaluation results. There is no universal token size or overlap percentage.
- **In practice:** Keep headings and code blocks intact, attach source metadata, then measure retrieval quality on real questions before tuning size.
- **Related terms:** RAG (Retrieval-Augmented Generation), Reranker, Grounding

### Circuit Breaker
- **Category:** AI-native development
- **What it actually means:** A reliability control that temporarily stops calls to a dependency after failures cross a threshold, then probes whether the dependency has recovered.
- **Why it matters:** It prevents repeated model or tool failures from consuming latency, budget, and capacity across the rest of the system.
- **In practice:** Open the breaker after repeated provider timeouts, fail over or return a controlled response, then allow a limited health probe after a cooldown.
- **Common confusion:** A circuit breaker reacts to dependency health. A rate limit controls allowed request volume.
- **Related terms:** Retry with Backoff, Rate Limit, Model Router, Backpressure

### CNN (Convolutional Neural Network)
- **Category:** Models & inference
- **What people say:** A neural network for images.
- **What it actually means:** A neural network that uses convolution operations (sliding filters over the input) to detect local patterns. Stacking convolutions detects increasingly complex features: edges, textures, objects.
- **Common confusion:** Convolutions also work on audio, time series, and other grid-like data.
- **Related terms:** Feature, Inductive Bias, Activation Function

### Coding Agent
- **Category:** AI-native development
- **What it actually means:** An agent specialized for software work that can inspect a repository, edit files, run development tools, and use their outputs to advance a scoped engineering task.
- **Why it matters:** Its value depends on repository context, tool permissions, review boundaries, and verification, not only code generation quality.
- **In practice:** Give the agent an issue, a scope contract, repository instructions, and a test command; review the resulting patch and evidence before accepting it.
- **Common confusion:** A coding assistant that only suggests text is not necessarily an agent. The agent acts through tools and observes results.
- **Learn it:** [Skill Discovery and Progressive Disclosure](../phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/)
- **Related terms:** Agent Harness, Repository Map, Patch, Scope Contract, Reviewer Agent

### Compensating Action
- **Category:** Agents & tools
- **What it actually means:** A deliberate operation that semantically counteracts a completed side effect when the original operation cannot be rolled back atomically.
- **Why it matters:** Multi-step agent workflows cross databases and external services where a later failure cannot undo earlier writes through one transaction.
- **In practice:** If a booking workflow charges a card but the reservation fails, issue a tracked refund and preserve both events rather than deleting history.
- **Common confusion:** Compensation is a new business action, not time travel. It can fail and therefore needs idempotency, monitoring, and escalation.
- **Related terms:** Durable Execution, Idempotency, Checkpoint, Approval Gate
- **Sources:** [Sagas](https://dl.acm.org/doi/10.1145/38713.38742)

### Content Provenance
- **Category:** Security & governance
- **What it actually means:** Verifiable information about the origin and editing history of a piece of media or other digital content, including the actors, tools, transformations, and assertions attached to it.
- **Why it matters:** Generative systems make origin claims difficult to infer from appearance alone, so consumers and platforms need inspectable evidence about how content was produced.
- **In practice:** Bind provenance assertions to the content, sign them with controlled identities, preserve transformation history, and show clearly when evidence is missing or cannot be verified.
- **Common confusion:** Provenance can establish who asserted a history and whether the record was altered. It does not prove that the depicted event is true or that the content is harmless.
- **Learn it:** [Watermarking, SynthID, Stable Signature, and C2PA](../phases/18-ethics-safety-alignment/23-watermarking-synthid-stable-signature-c2pa/)
- **Related terms:** Data Provenance, Provenance Attestation, Audit Log, Grounding
- **Sources:** [C2PA Technical Specification](https://c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html)

### Context Compression
- **Category:** Prompting & context
- **What it actually means:** Reducing the token footprint of source material while attempting to preserve the information required for a later model decision.
- **Why it matters:** Compression can make long tasks fit within budget, but every omitted detail creates a risk that the model loses evidence, constraints, or unresolved state.
- **In practice:** Preserve authoritative facts and identifiers verbatim, summarize redundant history, attach source pointers, and test the compressed context on representative tasks.
- **Common confusion:** Compression is lossy unless it retains the full original. A shorter summary is not automatically an equivalent context.
- **Related terms:** Token Budget, Context Engineering, Progressive Disclosure, Handoff
- **Sources:** [LLMLingua](https://arxiv.org/abs/2310.05736)

### Context Engineering
- **Category:** Prompting & context
- **What it actually means:** Designing the full information environment supplied to a model at each step, including instructions, selected files, retrieved evidence, tool results, examples, state, and output constraints.
- **Why it matters:** Model performance often fails because relevant evidence is missing, stale, badly ordered, or overwhelmed by noise.
- **In practice:** Build a compact task packet with the goal, repository rules, relevant interfaces, recent tool output, and unresolved decisions, then update it as state changes.
- **Common confusion:** Prompt engineering focuses on instruction wording. Context engineering also decides what evidence and state enter the model's working context.
- **Learn it:** [Context Engineering](../phases/11-llm-engineering/05-context-engineering/)
- **Related terms:** Context Window, Progressive Disclosure, Agent State, Repository Map

### Context Window
- **Category:** Prompting & context
- **What people say:** How much the model remembers.
- **What it actually means:** The maximum token capacity available to one model inference under a specific model and API contract. The capacity may include system instructions, messages, retrieved content, tool exchanges, and generated output, with provider-specific accounting and output limits.
- **Why it matters:** Conversation history is only available when the application sends or reconstructs it. A large window does not guarantee that every included detail will be used reliably.
- **Common confusion:** Context is temporary input to an inference. Durable memory is stored outside the model and selected back into later context.
- **Learn it:** [Context Engineering](../phases/11-llm-engineering/05-context-engineering/)
- **Related terms:** Token Budget, Context Engineering, Prompt Cache, Agent State

### Continuous Batching
- **Category:** Infrastructure & serving
- **What it actually means:** A serving scheduler that adds and removes generation requests at iteration boundaries instead of waiting for every request in a fixed batch to finish.
- **Why it matters:** Autoregressive requests produce different output lengths, so continuous batching can keep accelerators utilized without forcing short requests to wait for the longest one.
- **In practice:** Admit new requests when capacity becomes available, track per-request latency, and apply backpressure when the live batch or KV-cache budget is full.
- **Common confusion:** Continuous batching is an inference scheduling policy, not gradient accumulation or a training batch-size technique.
- **Related terms:** Dynamic Batching, Decode Phase, Backpressure, Rate Limit
- **Sources:** [Orca](https://www.usenix.org/conference/osdi22/presentation/yu)

### Contrastive Learning
- **Category:** Math & training
- **What people say:** Learning by comparison.
- **What it actually means:** Training by pulling similar pairs closer and pushing dissimilar pairs apart in embedding space. CLIP uses this: matching image-text pairs vs non-matching ones.
- **Related terms:** Embedding, Cosine Similarity, Loss Function

### Cosine Similarity
- **Category:** Data & representations
- **What people say:** How similar two vectors are.
- **What it actually means:** The normalized dot product of two vectors. It compares their direction rather than their magnitude and ranges from -1 to 1 for real-valued vectors.
- **Common confusion:** High cosine similarity only has meaning relative to the embedding model and the data distribution. It does not prove factual or semantic equivalence.
- **Related terms:** Embedding, Semantic Search, Reranker

### Cost per Successful Task
- **Category:** AI-native development
- **What it actually means:** Total system cost divided by the number of tasks that satisfy a defined success criterion, including retries, failed runs, tool use, and evaluation overhead.
- **Why it matters:** A cheap model call can produce an expensive workflow if it fails often or requires repeated human correction.
- **In practice:** Measure provider charges and infrastructure cost across 100 repository tasks, then divide by the number whose patches pass tests and review.
- **Common confusion:** Cost per token measures usage. Cost per successful task measures useful outcomes.
- **Related terms:** Evaluation (Eval), Retry with Backoff, Model Router, Verification Gate

### Cross-Attention
- **Category:** Multimodal systems
- **What it actually means:** Attention in which the query representation comes from one sequence or representation while keys and values come from another.
- **Why it matters:** It gives one stream a learnable way to retrieve information from another, such as language tokens attending to visual features.
- **In practice:** State which stream supplies queries, keys, and values, apply masks for missing or invalid positions, and inspect whether the model still performs when one modality is ablated.
- **Common confusion:** Cross-attention is not intrinsically multimodal. It can connect two text sequences or other representations; self-attention instead derives queries, keys, and values from the same sequence representation.
- **Related terms:** Attention, Self-Attention, Vision-Language Model (VLM), Multimodal Fusion
- **Sources:** [Attention Is All You Need](https://arxiv.org/abs/1706.03762)

### Cross-Entropy
- **Category:** Math & training
- **What people say:** The classification loss.
- **What it actually means:** A loss based on the negative log probability assigned to the target outcome. In next-token training, it penalizes the model when it assigns low probability to the observed next token.
- **Common confusion:** Perplexity is the exponentiated average cross-entropy only when the averaging and logarithm base are defined consistently.
- **Related terms:** Loss Function, Softmax, Perplexity

### CUDA
- **Category:** Models & inference
- **What people say:** GPU programming.
- **What it actually means:** NVIDIA's platform and programming model for general-purpose computation on compatible GPUs. Deep-learning frameworks use CUDA libraries and kernels to execute many tensor operations in parallel.
- **Common confusion:** GPU acceleration is not synonymous with CUDA; other hardware and software stacks exist.
- **Related terms:** Tensor, Mixed Precision, JAX

## D

### Data Augmentation
- **Category:** Math & training
- **What people say:** Making more training data.
- **What it actually means:** Creating modified examples, such as transformed images, perturbed audio, or paraphrased text, to increase training diversity without collecting entirely new source data. It can reduce overfitting when the transformation preserves the task signal.
- **Common confusion:** An augmentation must preserve the target label or behavior you want the model to learn.
- **Related terms:** Overfitting, Epoch, Eval Set

### Data Classification
- **Category:** Security & governance
- **What it actually means:** Assigning data to documented sensitivity or impact classes so handling, access, retention, sharing, and incident rules follow the consequences of disclosure or loss.
- **Why it matters:** An AI pipeline cannot apply proportionate controls if source documents, prompts, traces, and generated artifacts are treated as equally sensitive.
- **In practice:** Classify data at ingestion, carry the label through derived artifacts, restrict tools and destinations by class, and define how labels change after transformation or aggregation.
- **Common confusion:** Data classification describes protection requirements. It is not the same as a machine-learning classification task or a claim that the data is accurate.
- **Related terms:** Data Minimization, Trust Boundary, Least Privilege, Audit Log
- **Sources:** [NIST SP 1800-39 Initial Public Draft: Data Classification Practices](https://www.nccoe.nist.gov/sites/default/files/2026-02/nist-sp-1800-39-ipd.pdf); [NIST FIPS 199: Federal Information and Information System Categorization](https://csrc.nist.gov/pubs/fips/199/final)

### Data Deduplication
- **Category:** Data & representations
- **What it actually means:** Detecting and removing exact and near-duplicate examples within or across datasets.
- **Why it matters:** Repetition can distort the training distribution, increase memorization, leak test material, and make evaluation appear stronger than it is.
- **In practice:** Normalize content, use exact hashes and similarity methods, review borderline clusters, and record which version and rule removed each example.
- **Common confusion:** Deduplication is not ordinary data cleaning. Two distinct records can legitimately share text, and two paraphrases can still carry the same leaked information.
- **Related terms:** Data Provenance, Benchmark Contamination, Dataset Split, Overfitting
- **Sources:** [Deduplicating Training Data Makes Language Models Better](https://arxiv.org/abs/2107.06499)

### Data Exfiltration
- **Category:** Security & governance
- **What it actually means:** Unauthorized transfer of protected data from a system or trust zone to a person, tool, service, or storage location that is not permitted to receive it.
- **Why it matters:** An agent can expose secrets through generated text, tool arguments, URLs, logs, or side effects even when the original data store remains intact.
- **In practice:** Minimize readable data, allowlist destinations, inspect outbound tool calls, redact sensitive fields, and alert on unusual transfers across trust boundaries.
- **Common confusion:** Exfiltration is about unauthorized movement or disclosure. Ordinary retrieval of data by an authorized component is not exfiltration, although later use can become one.
- **Learn it:** [EchoLeak and CVEs for AI](../phases/18-ethics-safety-alignment/25-echoleak-cves-for-ai/)
- **Related terms:** Trust Boundary, Least Privilege, Indirect Prompt Injection, Audit Log
- **Sources:** [NIST SP 800-53 Rev. 5: AC-4 Information Flow Enforcement](https://csrc.nist.gov/files/pubs/sp/800/53/r5/upd1/final/docs/sp800-53r5-controls.xlsx)

### Data Leakage
- **Category:** Data & representations
- **What it actually means:** Unintended use of information during training or feature construction that would not be available at the real prediction point or belongs to a held-out evaluation boundary.
- **Why it matters:** Leakage produces optimistic metrics that collapse when the system encounters genuinely unseen inputs.
- **In practice:** Split data before fitting preprocessors, keep future information out of historical features, and isolate test labels and benchmark answers from prompts and tuning loops.
- **Common confusion:** Leakage is not limited to duplicate rows. Global normalization statistics, timestamps, target-derived features, and repeated test-driven prompt edits can all leak information.
- **Related terms:** Dataset Split, Benchmark Contamination, Eval Set, Data Provenance
- **Sources:** [scikit-learn: Data leakage](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage)

### Data Lineage
- **Category:** Security & governance
- **What it actually means:** A record of how a data artifact was derived across sources, transformations, joins, filters, versions, and downstream uses.
- **Why it matters:** When a source is corrected, revoked, or found unsafe, lineage identifies which datasets, embeddings, evaluations, and model artifacts may be affected.
- **In practice:** Give inputs and outputs stable identifiers, record each transformation and version, preserve parent-child relationships, and test whether an affected source can be traced to every derivative.
- **Common confusion:** Data provenance explains origin and custody broadly. Lineage emphasizes the transformation path and dependencies between data artifacts.
- **Related terms:** Data Provenance, Datasheet for Datasets, Audit Log, Content Provenance
- **Sources:** [W3C PROV-O](https://www.w3.org/TR/prov-o/)

### Data Minimization
- **Category:** Security & governance
- **What it actually means:** For personal data, limiting what is collected, processed, exposed, and retained to what is necessary for a specified purpose. Teams can apply the same discipline to sensitive non-personal data as an engineering control.
- **Why it matters:** Every unnecessary field placed in a prompt, trace, cache, or tool call increases privacy exposure and the possible impact of misuse or compromise.
- **In practice:** Define the required fields before collection, redact or aggregate at the earliest boundary, set retention limits, and verify that optional context improves a measured task outcome before keeping it.
- **Common confusion:** Minimization does not mean keeping no data. It means being able to justify each data element, use, recipient, and retention period against the stated purpose.
- **Related terms:** Purpose Limitation, Data Classification, Least Privilege, Context Engineering
- **Sources:** [General Data Protection Regulation, Article 5(1)(c)](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

### Data Provenance
- **Category:** Data & representations
- **What it actually means:** Traceable information about where data originated, who or what transformed it, which versions were used, and how derived artifacts relate to their sources.
- **Why it matters:** You need provenance to reproduce results, honor usage constraints, investigate contamination, and remove affected data when a source changes.
- **In practice:** Assign immutable dataset versions, record transformation jobs and source identifiers, and carry lineage metadata into embeddings, eval cases, and model artifacts.
- **Common confusion:** A source URL is only one piece of provenance; it does not describe collection time, licensing, filtering, transformation, or downstream use.
- **Related terms:** Dataset Split, Data Deduplication, Provenance Attestation, Grounding
- **Sources:** [W3C PROV Overview](https://www.w3.org/TR/prov-overview/)

### Dataset Split
- **Category:** Data & representations
- **What it actually means:** A documented partition of examples into separate subsets for fitting, development decisions, and final evaluation.
- **Why it matters:** Separation prevents the evidence used to choose a system from also serving as independent proof that the chosen system generalizes.
- **In practice:** Split by the real deployment unit, such as user, repository, organization, or time, rather than randomly dividing correlated rows.
- **Common confusion:** A random split is not automatically independent. Near duplicates, future observations, or records from the same entity can cross the boundary.
- **Related terms:** Eval Set, Overfitting, Data Leakage, Distribution Shift
- **Sources:** [Datasheets for Datasets](https://cacm.acm.org/research/datasheets-for-datasets/)

### Datasheet for Datasets
- **Category:** Security & governance
- **What it actually means:** Structured documentation of a dataset's motivation, composition, collection process, preprocessing, uses, distribution, maintenance, and known limitations.
- **Why it matters:** A dataset is not safe or suitable merely because it is available. Downstream builders need evidence about how it was created and where its assumptions break.
- **In practice:** Publish the datasheet with a versioned dataset, identify who can answer questions, record excluded populations and transformations, and update the document when the dataset changes.
- **Common confusion:** A datasheet documents evidence and intended use. It is not a license, quality guarantee, or substitute for deployment-specific evaluation.
- **Learn it:** [Model, System, and Dataset Cards](../phases/18-ethics-safety-alignment/26-model-system-dataset-cards/)
- **Related terms:** Data Lineage, Data Provenance, Model Card, Dataset Split
- **Sources:** [Datasheets for Datasets](https://arxiv.org/abs/1803.09010)

### Deadline Propagation
- **Category:** Reliability & operations
- **What it actually means:** Passing the remaining end-to-end time budget to downstream calls so each dependency knows how long the original request can still usefully wait.
- **Why it matters:** Independent timeouts can exceed the user's deadline and leave abandoned work consuming capacity after the result is no longer useful.
- **In practice:** Set one request deadline at ingress, subtract elapsed time for each downstream call, cancel expired work, and record which boundary exhausted the budget.
- **Common confusion:** A deadline is an absolute or remaining completion boundary. A retry delay controls when another attempt begins and must fit inside that same budget.
- **Related terms:** Retry with Backoff, Retry Budget, Tail Latency, Service Level Objective (SLO)
- **Sources:** [gRPC Deadlines](https://grpc.io/docs/guides/deadlines/)

### Decode Phase
- **Category:** Infrastructure & serving
- **What it actually means:** The iterative stage of autoregressive inference that generates new tokens one step at a time after the input prefix has been processed.
- **Why it matters:** Decode work has different compute, memory, and scheduling behavior from prefill, so one aggregate latency number can hide the actual serving bottleneck.
- **In practice:** Measure inter-token latency and output throughput separately, account for KV-cache occupancy, and test mixed workloads where active decodes share capacity with new prefills.
- **Common confusion:** Decode phase is not the decoder component of an encoder-decoder model. It names the runtime generation stage.
- **Learn it:** [Disaggregated Prefill and Decode](../phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/)
- **Related terms:** Prefill, Autoregressive, KV Cache, Time per Output Token (TPOT)
- **Sources:** [DistServe](https://arxiv.org/abs/2401.09670)

### Decoder
- **Category:** Models & inference
- **What people say:** The output side of a model.
- **What it actually means:** A component that maps a representation into an output. In an encoder-decoder transformer, the decoder uses masked self-attention and cross-attention to generate outputs. Decoder-only language models instead generate from a single causal stack.
- **Related terms:** Encoder, Transformer, Autoregressive

### Decoding Strategy
- **Category:** Models & inference
- **What it actually means:** The algorithm that converts a model's sequence of next-token scores into selected tokens and a completed output.
- **Why it matters:** Greedy selection, sampling, truncation, and search can produce different quality, diversity, latency, and repeatability from the same logits.
- **In practice:** Define the task's decoding settings, stop rules, and seed behavior in the eval configuration so results can be compared fairly.
- **Common confusion:** Decoding changes how outputs are selected; it does not change the model's trained parameters or add knowledge.
- **Related terms:** Autoregressive, Temperature, Top-k Sampling, Nucleus Sampling (Top-p)
- **Sources:** [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)

### Defense in Depth
- **Category:** Security & governance
- **What it actually means:** Using independent preventive, detective, and corrective controls at several system boundaries so one failed control does not determine the outcome.
- **Why it matters:** AI systems combine probabilistic models, untrusted content, tools, and external services, making any single filter or prompt an inadequate security boundary.
- **In practice:** Pair instruction controls with narrow permissions, sandboxing, schema validation, approval for consequential actions, monitoring, and a tested recovery path.
- **Common confusion:** More controls are not automatically better. Layers should address distinct failure modes and remain testable rather than repeat the same assumption.
- **Related terms:** Guardrails, Sandbox, Least Privilege, Trust Boundary
- **Sources:** [NIST Glossary: Defense in Depth](https://csrc.nist.gov/glossary/term/defense_in_depth)

### Delegation
- **Category:** Agents & tools
- **What it actually means:** Assigning a bounded subtask to another person or agent together with the needed context, authority, output contract, and return conditions.
- **Why it matters:** Explicit delegation enables specialization and parallel work without losing ownership, scope, or the ability to integrate results.
- **In practice:** Give a reviewer agent the exact files, rubric, evidence, and deadline, then require it to return findings rather than silently modifying the primary artifact.
- **Common confusion:** Sending a vague message to another agent is not reliable delegation. The receiver needs a scope contract and a defined handoff back.
- **Related terms:** Scope Contract, Handoff, Reviewer Agent, Orchestration
- **Sources:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)

### Dense Retrieval
- **Category:** Retrieval & generation
- **What it actually means:** First-stage retrieval that embeds queries and candidates into vector representations and ranks candidates by a similarity function.
- **Why it matters:** It can retrieve paraphrases and semantic matches that share few exact words, complementing lexical methods such as BM25.
- **In practice:** Train or select an embedding model for the domain, index candidate vectors, and evaluate retrieval recall before connecting the results to generation.
- **Common confusion:** Dense retrieval is not a reranker. It searches the collection, while a reranker rescores a smaller candidate set.
- **Related terms:** Embedding, Semantic Search, BM25, Hybrid Retrieval
- **Sources:** [Dense Passage Retrieval](https://aclanthology.org/2020.emnlp-main.550/)

### Diffusion Model
- **Category:** Models & inference
- **What people say:** A model that generates images from noise.
- **What it actually means:** A generative model trained around a progressive noising process and a learned reverse process. Sampling usually begins from noise and applies repeated denoising steps, sometimes in a learned latent space.
- **Common confusion:** Diffusion is a general generative framework, not an image-only technique.
- **Related terms:** Latent Space, VAE (Variational Autoencoder), Inference

### Disaggregated Serving
- **Category:** Infrastructure & serving
- **What it actually means:** A serving architecture that runs prefill and decode work in separately provisioned worker pools and transfers the required attention state between them.
- **Why it matters:** Prefill and decode stress hardware differently, so independent pools can be sized and scheduled for their own bottlenecks instead of competing in one queue.
- **In practice:** Measure state-transfer cost, route requests through compatible model versions, scale each pool from its own demand signal, and test failure recovery between phases.
- **Common confusion:** Disaggregation separates runtime stages. It does not split one model into tensor or pipeline-parallel shards within a stage.
- **Learn it:** [Disaggregated Prefill and Decode](../phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/)
- **Related terms:** Prefill, Decode Phase, Model Serving, Goodput
- **Sources:** [DistServe](https://arxiv.org/abs/2401.09670)

### Distribution Shift
- **Category:** Evaluation & safety
- **What it actually means:** A difference between the data distribution used to build or evaluate a system and the distribution it encounters after deployment.
- **Why it matters:** A model can pass held-out tests yet fail when users, tasks, language, tools, or operating conditions change.
- **In practice:** Define expected deployment slices, monitor performance and input characteristics by slice, and add new failures to a versioned eval set.
- **Common confusion:** Distribution shift is not always model drift. The model may be unchanged while its environment or user population changes.
- **Related terms:** Dataset Split, Eval Set, Overfitting, Model Card
- **Sources:** [WILDS](https://proceedings.mlr.press/v139/koh21a.html)

### DPO (Direct Preference Optimization)
- **Category:** Math & training
- **What people say:** Preference training without a separate reward-model stage.
- **What it actually means:** A preference-optimization objective that trains a policy directly from preferred and rejected response pairs relative to a reference policy. It avoids running an explicit reward model and reinforcement-learning loop during this stage.
- **Common confusion:** DPO still depends on the quality and coverage of preference data and does not eliminate evaluation or alignment risk.
- **Learn it:** [Direct Preference Optimization](../phases/10-llms-from-scratch/08-dpo/)
- **Sources:** [Direct Preference Optimization paper](https://arxiv.org/abs/2305.18290)
- **Related terms:** RLHF (Reinforcement Learning from Human Feedback), SFT (Supervised Fine-Tuning), Alignment

### Dropout
- **Category:** Math & training
- **What people say:** Randomly turning off activations.
- **What it actually means:** During training, randomly setting a fraction of activations to zero encourages the network not to rely on one activation path. It is normally disabled for standard inference, although Monte Carlo dropout deliberately keeps it active to estimate uncertainty.
- **Related terms:** Overfitting, Weight Decay, Activation Function

### Durable Execution
- **Category:** Agents & tools
- **What it actually means:** Running a workflow so its state and completed steps survive process crashes, restarts, or long waits without redoing confirmed side effects.
- **Why it matters:** Agent tasks often span model calls, tools, approvals, and external systems. A transient process should not be the only record of progress.
- **In practice:** Persist each workflow transition, use idempotency keys for external writes, and resume from the latest checkpoint after a worker restarts.
- **Common confusion:** Durable execution does not make every operation safe automatically. Side effects still need idempotency and compensation rules.
- **Related terms:** Checkpoint, Agent State, Idempotency, Approval Gate

### Dynamic Batching
- **Category:** Infrastructure & serving
- **What it actually means:** A runtime policy that forms inference batches from queued requests according to compatible shapes, maximum size, priority, and allowed queue delay.
- **Why it matters:** Grouping requests can improve hardware utilization, but waiting for a batch can make latency worse when traffic is sparse or requests differ sharply.
- **In practice:** Set queue-delay and batch limits from measured latency objectives, separate incompatible request shapes, and compare throughput with tail latency at realistic arrival rates.
- **Common confusion:** Dynamic batching assembles batches from queued work. Continuous batching changes membership while autoregressive generation is already running.
- **Learn it:** [vLLM Serving Internals](../phases/17-infrastructure-and-production/04-vllm-serving-internals/)
- **Related terms:** Admission Control, Continuous Batching, Saturation, Tail Latency
- **Sources:** [NVIDIA Triton: Models and Schedulers](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/model_configuration.html#scheduling-and-batching)

## E

### Early Fusion
- **Category:** Multimodal systems
- **What it actually means:** Combining raw or low-level representations from several modalities before most task-specific modeling occurs.
- **Why it matters:** Early interaction can expose fine-grained cross-modal relationships, but it also requires compatible representations and careful handling of alignment and missing inputs.
- **In practice:** Convert each modality into a declared token or feature representation, preserve source and position markers, fuse them before the shared backbone, and compare against single-modality and late-fusion baselines.
- **Common confusion:** Early fusion describes where streams are combined in the architecture. It does not guarantee that the model learns useful alignment between them.
- **Learn it:** [Chameleon Early-Fusion Tokens](../phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/)
- **Related terms:** Late Fusion, Multimodal Fusion, Modality Alignment, Token
- **Sources:** [Chameleon: Mixed-Modal Early-Fusion Foundation Models](https://arxiv.org/abs/2405.09818); [Multimodal Machine Learning: A Survey and Taxonomy](https://arxiv.org/abs/1705.09406)

### Eigenvalue
- **Category:** Math & training
- **What people say:** A matrix property used in PCA.
- **What it actually means:** A scalar that describes how a linear transformation scales a corresponding nonzero eigenvector without changing its direction. In covariance-matrix PCA, larger eigenvalues correspond to directions with more variance.
- **Related terms:** Tensor, Feature, Latent Space

### Embedding
- **Category:** Data & representations
- **What people say:** A vector that represents meaning.
- **What it actually means:** A learned mapping from discrete items (words, images, users) to dense vectors in continuous space, where similar items end up close together
- **Common confusion:** Similarity depends on the model, training objective, and metric. Distance in one embedding space does not carry over to another.
- **Why it's called that:** The items are placed, or embedded, in a geometric representation space.
- **Learn it:** [Embeddings](../phases/11-llm-engineering/04-embeddings/)
- **Related terms:** Cosine Similarity, Semantic Search, Vector Database

### Encoder
- **Category:** Models & inference
- **What people say:** The input side of a model.
- **What it actually means:** A component that transforms input into a representation. A transformer encoder commonly uses non-causal self-attention, subject to any masks, so each position can incorporate context from across the input.
- **Common confusion:** Encoder-only models can produce outputs through task heads even though they are not typically used for autoregressive text generation.
- **Related terms:** Decoder, Transformer, Embedding

### Epoch
- **Category:** Math & training
- **What people say:** One pass through the training data.
- **What it actually means:** One traversal of the defined training dataset. In distributed or sampled training, the exact implementation of an epoch depends on the data loader and sampling policy.
- **Common confusion:** More epochs do not guarantee better generalization; evaluate on held-out data.
- **Related terms:** Batch Size, Overfitting, Eval Set

### Error Budget
- **Category:** Reliability & operations
- **What it actually means:** The amount of unsuccessful service allowed by a service-level objective over its measurement window before the objective is exhausted.
- **Why it matters:** It gives reliability and product work a shared decision boundary: teams can spend remaining budget on change while slowing risk when user-visible failure consumes it.
- **In practice:** Derive the budget from the SLO, track burn by cause and user segment, define release actions before exhaustion, and avoid resetting the accounting after an incident.
- **Common confusion:** An error budget is not a quota for causing incidents. It is an operating policy derived from a user-facing reliability target.
- **Related terms:** Service Level Objective (SLO), Service Level Indicator (SLI), Availability, Incident Response
- **Sources:** [Google SRE Workbook: Error Budget Policy](https://sre.google/workbook/error-budget-policy/)

### Eval Set
- **Category:** Evaluation & safety
- **Aliases:** Evaluation set
- **What it actually means:** A versioned collection of inputs, expected properties, scoring rules, and metadata used to measure an AI system against a defined capability or risk.
- **Why it matters:** A repeatable set turns vague quality claims into comparable evidence and catches regressions after prompts, models, tools, or retrieval change.
- **In practice:** Keep representative support questions, adversarial instructions, expected citations, and failure labels in a reviewed dataset that is separate from development examples.
- **Common confusion:** A development eval guides iteration, a final held-out test estimates performance after choices are fixed, and a standardized benchmark supports comparison under a shared protocol. Repeated tuning against any held-out set leaks test information and inflates results.
- **Learn it:** [Eval-Driven Agent Development](../phases/14-agent-engineering/30-eval-driven-agent-development/)
- **Related terms:** Evaluation (Eval), Regression Test, LLM-as-a-Judge, Verification Gate

### Evaluation (Eval)
- **Category:** Evaluation & safety
- **Aliases:** Eval
- **What it actually means:** A defined process for measuring model or system behavior on representative tasks using explicit success criteria, data, scorers, and review procedures.
- **Why it matters:** You cannot improve reliability if success is only a subjective impression from a few demos.
- **In practice:** Run the same customer-support scenarios before and after changing retrieval, score correctness and citation support, and inspect failures by category.
- **Common confusion:** A benchmark score is one evaluation result, not a complete account of production quality.
- **Learn it:** [LLM Evaluation](../phases/11-llm-engineering/10-evaluation/)
- **Related terms:** Eval Set, LLM-as-a-Judge, Cost per Successful Task, Regression Test

### Exact Match (EM)
- **Category:** Evaluation & safety
- **What it actually means:** A metric that counts an output as correct only when its normalized representation exactly equals an accepted reference answer.
- **Why it matters:** It is deterministic and easy to audit for tasks with one canonical answer, but it exposes no partial credit.
- **In practice:** Define normalization and all accepted references before evaluation, then pair exact match with task-specific checks when several outputs can be valid.
- **Common confusion:** A low exact-match score can reflect harmless formatting differences, while a matching string can still be unsupported or unsafe in context.
- **Related terms:** ROUGE, Eval Set, Structured Output, Pass@k
- **Sources:** [SQuAD](https://aclanthology.org/D16-1264/)

### Expert Parallelism
- **Category:** Infrastructure & serving
- **What it actually means:** Distributing mixture-of-experts subnetworks across devices and routing each token's activations to the devices that host its selected experts.
- **Why it matters:** Sparse experts increase model capacity without executing every expert for every token, but routing introduces communication, load-balance, and placement constraints.
- **In practice:** Measure token distribution by expert, provision communication bandwidth, cap or route overflow deliberately, and test quality when traffic produces uneven expert demand.
- **Common confusion:** Expert parallelism partitions experts selected by a router. Tensor parallelism partitions the tensor operations inside layers.
- **Learn it:** [Mixture of Experts](../phases/07-transformers-deep-dive/11-mixture-of-experts/)
- **Related terms:** MoE (Mixture of Experts), Tensor Parallelism, Pipeline Parallelism, Model Serving
- **Sources:** [GShard](https://arxiv.org/abs/2006.16668)

## F

### Feature
- **Category:** Data & representations
- **What people say:** A column in a dataset.
- **What it actually means:** An individual measurable property of the data. In classical ML, you engineer features by hand. In deep learning, the network learns features automatically from raw data.
- **Common confusion:** A stored column can contain several useful features, and a learned representation can contain features with no simple human label.
- **Related terms:** Embedding, Latent Space, Inductive Bias

### Few-Shot
- **Category:** Prompting & context
- **What people say:** Give the model a few examples in the prompt.
- **What it actually means:** In-context learning that includes a small set of demonstrations before the target input so the model can infer the desired task, format, or decision boundary.
- **Why it matters:** Example quality and coverage matter more than a universal example count. Poor or contradictory demonstrations can reduce reliability.
- **Related terms:** Zero-Shot, In-Context Learning, Prompt Engineering, Context Window

### Fine-tuning
- **Category:** Math & training
- **What people say:** Training a model on your data.
- **What it actually means:** Continuing training from pretrained parameters on a narrower dataset or objective. Depending on the method, you may update all parameters, selected parameters, or added adapter parameters.
- **Why it matters:** Fine-tuning can adapt behavior, style, format, or task performance, but it is not a dependable replacement for retrieval when facts must stay current or traceable.
- **Common confusion:** Fine-tuning can influence encoded knowledge, but it does not simply append records to a searchable database inside the model.
- **Learn it:** [Fine-Tuning and LoRA](../phases/11-llm-engineering/08-fine-tuning-lora/)
- **Related terms:** SFT (Supervised Fine-Tuning), LoRA (Low-Rank Adaptation), QLoRA, RAG (Retrieval-Augmented Generation)

### Flaky Test
- **Category:** AI-native development
- **What it actually means:** A test that can pass and fail across equivalent runs without a relevant change to the code or intended test environment.
- **Why it matters:** Flakiness weakens verification gates and can train people or agents to ignore real failures or retry until they obtain a false pass.
- **In practice:** Preserve the failing seed and environment, quarantine only with an owner and deadline, then fix uncontrolled time, concurrency, network, order, or shared-state dependencies.
- **Common confusion:** A test that consistently exposes an intermittent product bug is valuable evidence, not necessarily a flaky test.
- **Related terms:** Regression Test, Test Oracle, Retry with Backoff, Verification Gate
- **Sources:** [De-Flake Your Tests](https://conferences.computer.org/icsme/pdfs/ICSME2020-1oOutvkGTwF4GyVvNtr3Mm/561900a736/561900a736.pdf)

### FlashAttention
- **Category:** Infrastructure & serving
- **What it actually means:** An exact attention algorithm that tiles the computation to reduce transfers between accelerator memory levels while avoiding materialization of the full attention matrix in high-bandwidth memory.
- **Why it matters:** Attention can be limited by memory movement rather than arithmetic, especially for long sequences, so an IO-aware kernel can improve usable speed and memory efficiency.
- **In practice:** Use a kernel supported by the model's shapes, masks, dtype, and hardware, verify numerical tolerance, and benchmark end-to-end latency rather than quoting a paper result as a fixed multiplier.
- **Common confusion:** FlashAttention changes how attention is computed, not the mathematical attention result it targets. It is separate from KV caching and quantization.
- **Learn it:** [KV Cache and Flash Attention](../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/)
- **Related terms:** Attention, Self-Attention, KV Cache, Mixed Precision
- **Sources:** [FlashAttention](https://arxiv.org/abs/2205.14135)

### Function Calling
- **Category:** Agents & tools
- **What people say:** A model using tools.
- **What it actually means:** A provider or application interface through which a model emits a structured request naming a tool and its arguments. Application code validates the request, performs the operation, and can return the result for another model step.
- **Common confusion:** The model requests a function call; your trusted code decides whether and how to execute it. Function calling alone is not a complete agent.
- **Learn it:** [Function Calling](../phases/11-llm-engineering/09-function-calling/)
- **Related terms:** Structured Output, Tool Contract, Agent, MCP (Model Context Protocol)

## G

### GAN (Generative Adversarial Network)
- **Category:** Models & inference
- **What people say:** Two neural networks competing during training.
- **What it actually means:** A generator network tries to create realistic data while a discriminator network tries to tell real from fake. They train together: the generator gets better at fooling the discriminator, and the discriminator gets better at detecting fakes.
- **Related terms:** Loss Function, Latent Space, Diffusion Model

### Goodput
- **Category:** Infrastructure & serving
- **What it actually means:** The rate of completed requests that satisfy defined service constraints, such as both time-to-first-token and per-token latency objectives, under a stated workload.
- **Why it matters:** Raw throughput can rise while users experience more slow requests. Goodput counts only work that meets the service contract.
- **In practice:** Declare the request distribution and latency thresholds, count only compliant completions, report percentiles beside the aggregate rate, and avoid comparing systems under different objectives.
- **Common confusion:** Goodput is not all completed throughput and is not a universal property of a model. It depends on workload and success thresholds.
- **Learn it:** [Inference Metrics and Goodput](../phases/17-infrastructure-and-production/08-inference-metrics-goodput/)
- **Related terms:** Service Level Objective (SLO), Time to First Token (TTFT), Time per Output Token (TPOT), Cost per Successful Task
- **Sources:** [DistServe](https://arxiv.org/abs/2401.09670)

### GPT
- **Category:** Models & inference
- **What people say:** A generic name for any chatbot.
- **What it actually means:** Generative Pre-trained Transformer, a family label for generative transformer models pretrained on sequence-prediction objectives and adapted for downstream use. Product names and model architectures should not be treated as interchangeable.
- **Why it's called that:** Generative describes output production, pre-trained describes the initial broad training stage, and transformer identifies the architecture family.
- **Related terms:** Transformer, Autoregressive, LLM (Large Language Model)

### Graceful Degradation
- **Category:** Reliability & operations
- **What it actually means:** Preserving a bounded core service when capacity or dependencies are impaired by reducing optional quality, features, freshness, or workload instead of failing every request.
- **Why it matters:** AI systems often depend on several slow or fallible components, so an explicit reduced mode can protect essential user outcomes during partial failure.
- **In practice:** Predefine which capabilities may be disabled, keep the reduced mode visible to operators, protect safety checks, test the fallback under dependency failure, and restore full service deliberately. Tell users when correctness, safety, freshness, or a promised contract materially changes.
- **Common confusion:** Graceful degradation is not silently returning a worse answer as if nothing happened. Operators always need visibility; users need disclosure when the reduced mode materially changes the result or service contract.
- **Learn it:** [Production LLM Application](../phases/11-llm-engineering/13-production-app/)
- **Related terms:** Circuit Breaker, Load Shedding, Model Router, Availability
- **Sources:** [Google SRE: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)

### Gradient
- **Category:** Math & training
- **What people say:** The slope of the loss.
- **What it actually means:** A vector of partial derivatives pointing in the direction of steepest increase. In ML, you go opposite to the gradient (gradient descent) to minimize the loss.
- **Common confusion:** Optimizers can transform, average, clip, or adapt gradients instead of taking a plain negative-gradient step.
- **Related terms:** Backpropagation, Gradient Descent, Optimizer

### Gradient Accumulation
- **Category:** Math & training
- **What it actually means:** Summing or averaging gradients from several microbatches before performing one optimizer update.
- **Why it matters:** It lets you approximate a larger effective batch when one device cannot hold all examples and activations at once.
- **In practice:** Scale the loss consistently, call the optimizer only after the chosen number of microbatches, and measure whether normalization or distributed synchronization changes behavior.
- **Common confusion:** Gradient accumulation reduces per-step activation memory, but it does not reproduce every property of processing the full batch simultaneously.
- **Related terms:** Batch Size, Mixed Precision, Optimizer, Backpropagation
- **Sources:** [PyTorch AMP examples: Gradient accumulation](https://docs.pytorch.org/docs/stable/notes/amp_examples.html#gradient-accumulation)

### Gradient Clipping
- **Category:** Math & training
- **What it actually means:** Limiting gradient values or their combined norm before an optimizer update when they exceed a chosen threshold.
- **Why it matters:** It can prevent an unusually large gradient from destabilizing a training step and producing non-finite values.
- **In practice:** Log unclipped norms, clip after unscaling mixed-precision gradients, and investigate repeated clipping instead of treating it as a substitute for diagnosing instability.
- **Common confusion:** Clipping controls update magnitude; it does not repair invalid data, a broken loss, or a consistently unsuitable learning rate.
- **Related terms:** Gradient, NaN (Not a Number), Mixed Precision, Learning Rate
- **Sources:** [On the difficulty of training recurrent neural networks](https://arxiv.org/abs/1211.5063)

### Gradient Descent
- **Category:** Math & training
- **What people say:** Walking downhill on the loss surface.
- **What it actually means:** A family of optimization updates that move parameters using the negative gradient of an objective, usually estimated from batches rather than the entire dataset.
- **Related terms:** Gradient, Learning Rate, Optimizer

### Grounding
- **Category:** Retrieval & generation
- **What it actually means:** Connecting a generated answer or action to evidence, state, or observations that the system can identify and check.
- **Why it matters:** Grounding gives the system a basis beyond unconstrained generation and makes unsupported claims easier to detect.
- **In practice:** Retrieve a policy section, require the answer to cite it, and reject claims that the cited passage does not support.
- **Common confusion:** Adding documents to a prompt creates an opportunity for grounding. It does not guarantee the model will use them correctly.
- **Learn it:** [Retrieval-Augmented Generation](../phases/11-llm-engineering/06-rag/)
- **Related terms:** RAG (Retrieval-Augmented Generation), Hallucination, Verification Gate, Reranker

### Guardrails
- **Category:** Evaluation & safety
- **What people say:** Safety filters around a model.
- **What it actually means:** System controls that constrain inputs, tool use, outputs, permissions, and escalation. They can include schemas, policy checks, classifiers, allowlists, sandboxing, approvals, and post-action verification.
- **Why it matters:** No single filter covers all failure modes, so controls should be layered according to risk.
- **Common confusion:** Guardrails reduce risk; they do not prove that an AI system is safe.
- **Learn it:** [Guardrails](../phases/11-llm-engineering/12-guardrails/)
- **Related terms:** Least Privilege, Approval Gate, Sandbox, Evaluation (Eval)

## H

### Hallucination
- **Category:** Evaluation & safety
- **What people say:** The model is lying.
- **What it actually means:** Generated content that is false, unsupported by the available evidence, or inconsistent with the task's source of truth. It can arise even when the output is fluent and the model is not attempting to deceive.
- **Why it matters:** You usually cannot inspect whether a statement existed in training data, so production checks should focus on support, correctness, and traceability.
- **In practice:** Require cited evidence for factual answers and evaluate whether each citation actually supports the associated claim.
- **Common confusion:** A hallucination is an output-quality failure, not a diagnosis of model intent.
- **Related terms:** Grounding, RAG (Retrieval-Augmented Generation), Verification Gate

### Handoff
- **Category:** AI-native development
- **What it actually means:** A structured transfer of a task between people or agents that preserves the objective, current state, evidence, decisions, constraints, and remaining work.
- **Why it matters:** A good handoff prevents the next worker from reconstructing the entire task from a long transcript or repeating completed actions.
- **In practice:** Pass the accepted plan, changed files, test commands and results, unresolved risks, and exact next action in a compact task packet.
- **Common confusion:** A summary says what happened. A handoff also says what state is authoritative and what should happen next.
- **Learn it:** [Multi-Session Handoff](../phases/14-agent-engineering/40-multi-session-handoff/)
- **Related terms:** Agent State, Checkpoint, Scope Contract, Progressive Disclosure

### HNSW
- **Category:** Retrieval & generation
- **Aliases:** Hierarchical Navigable Small World
- **What it actually means:** An approximate-nearest-neighbor index that organizes vectors in layered proximity graphs and searches from coarse upper layers toward detailed lower layers.
- **Why it matters:** It is a common way to make high-recall vector search practical at scales where exhaustive comparison is too slow.
- **In practice:** Tune construction and query parameters against latency, memory, and Recall@K targets, then rebuild the index when embedding versions change.
- **Common confusion:** HNSW is an index algorithm, not a similarity metric, embedding model, or complete vector database.
- **Related terms:** Approximate Nearest Neighbor (ANN), Vector Database, Embedding, Recall@K
- **Sources:** [Efficient and Robust Approximate Nearest Neighbor Search Using HNSW](https://dl.acm.org/doi/10.1109/TPAMI.2018.2889473)

### Human-in-the-Loop (HITL)
- **Category:** Agents & tools
- **Aliases:** Human oversight, human review
- **What it actually means:** A workflow design in which a person supplies judgment, correction, approval, or escalation at defined points in an AI-driven process.
- **Why it matters:** Human involvement is most useful at high-impact, ambiguous, or irreversible boundaries, not as an undefined fallback after every step.
- **In practice:** Let the agent classify routine requests automatically, but route uncertain or high-value cases to a reviewer with the evidence and proposed action.
- **Common confusion:** HITL does not automatically make a system safe. Reviewers need time, context, authority, and a clear decision standard.
- **Related terms:** Approval Gate, Verification Gate, Agent, Guardrails

### Hybrid Retrieval
- **Category:** Retrieval & generation
- **What it actually means:** Retrieval that combines signals from different methods, commonly lexical matching and dense-vector similarity, before merging or reranking results.
- **Why it matters:** Exact identifiers, rare terms, and semantic paraphrases behave differently, so one retrieval signal can miss useful evidence.
- **In practice:** Retrieve candidates with both BM25-style keyword search and embeddings, merge their ranks, then rerank the combined set for the user query.
- **Common confusion:** Hybrid retrieval combines candidate signals. A reranker applies a second relevance model to candidates already retrieved.
- **Learn it:** [Advanced RAG](../phases/11-llm-engineering/07-advanced-rag/)
- **Related terms:** Semantic Search, Reranker, RAG (Retrieval-Augmented Generation), Embedding

### Hyperparameter
- **Category:** Math & training
- **What people say:** A setting you tune.
- **What it actually means:** A configuration choice that shapes model structure, optimization, data processing, or inference rather than being learned as an ordinary model parameter. Examples include learning rate, batch size, layer count, and decoding settings.
- **Common confusion:** Some hyperparameters are selected before training, while others can be changed during a schedule or at inference time.
- **Related terms:** Parameter, Learning Rate, Batch Size, Temperature

## I

### Idempotency
- **Category:** AI-native development
- **What it actually means:** The property that repeating the same operation with the same identity does not create additional side effects beyond the first successful application.
- **Why it matters:** Retries are normal in distributed agent systems. Without idempotency, one uncertain response can duplicate payments, comments, deployments, or records.
- **In practice:** Attach an idempotency key to a tool request and persist the completed result so a retry returns that result instead of executing the write again.
- **Common confusion:** Idempotency does not mean every response is byte-for-byte identical. It means the intended state change is not duplicated.
- **Sources:** [HTTP Semantics: idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)
- **Related terms:** Retry with Backoff, Durable Execution, Checkpoint

### Image Token
- **Category:** Multimodal systems
- **What it actually means:** A model-specific visual unit represented as a vector or discrete code, commonly derived from an image patch, region, or learned visual-codebook entry.
- **Why it matters:** Turning visual input into a sequence lets transformer-style components process images together with text or other tokenized modalities.
- **In practice:** Document whether tokens are continuous patches or discrete codes, preserve spatial position, test resolution and aspect-ratio changes, and count visual tokens in the model's input budget.
- **Common confusion:** An image token is not necessarily one pixel, one object, or one fixed physical area. Its scope follows the visual encoder or tokenizer.
- **Learn it:** [Vision-Language Models](../phases/04-computer-vision/25-vision-language-models/)
- **Related terms:** Patch Embedding, Token, VAE (Variational Autoencoder), Vision Transformer (ViT)
- **Sources:** [Vision Transformer](https://arxiv.org/abs/2010.11929); [VQ-VAE](https://arxiv.org/abs/1711.00937)

### In-Context Learning
- **Category:** Prompting & context
- **What it actually means:** A model adapting its behavior from instructions, examples, or patterns supplied in the current input without an ordinary parameter update.
- **Why it matters:** It explains how one pretrained model can perform a new task from context while keeping its weights unchanged.
- **In practice:** Place representative demonstrations before the target input, test order and formatting variants, and keep evaluation examples separate from the demonstrations.
- **Common confusion:** In-context learning is temporary conditioning, not fine-tuning, durable memory, or proof that the model inferred the intended rule.
- **Related terms:** Few-Shot, Zero-Shot, Context Window, Prompt Engineering
- **Sources:** [Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165)

### Incident Response
- **Category:** Reliability & operations
- **What it actually means:** The coordinated process for detecting, analyzing, containing, recovering from, communicating, and learning from an event that threatens service, data, safety, or security.
- **Why it matters:** During an incident, clear roles and evidence matter more than improvised heroics, especially when model behavior and distributed dependencies obscure the failing boundary.
- **In practice:** Define severity and command roles, preserve traces and audit records, stop harmful actions, communicate impact, verify recovery, and track corrective work to completion.
- **Common confusion:** Incident response manages the event and its consequences. Root-cause analysis and long-term prevention continue after immediate service is restored.
- **Learn it:** [SRE for AI](../phases/17-infrastructure-and-production/23-sre-for-ai/)
- **Related terms:** Observability, Audit Log, Postmortem, Availability
- **Sources:** [Google SRE: Managing Incidents](https://sre.google/sre-book/managing-incidents/); [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final)

### Indirect Prompt Injection
- **Category:** Security & governance
- **What it actually means:** A prompt-injection attack delivered through content the system retrieves or observes, such as a webpage, document, email, image text, or tool result, rather than directly through the user's instruction.
- **Why it matters:** An agent can encounter attacker-controlled instructions while performing an authorized task and mistake that content for authority-bearing guidance.
- **In practice:** Label external content as untrusted data, separate it from instructions, minimize tool permissions, require approval for consequential actions, and include malicious retrieved content in regression tests.
- **Common confusion:** Indirect describes the delivery path, not a weaker attack. A hidden instruction in retrieved content can be as consequential as a direct user prompt.
- **Learn it:** [Indirect Prompt Injection](../phases/18-ethics-safety-alignment/15-indirect-prompt-injection/)
- **Related terms:** Prompt Injection, Instruction Hierarchy, Trust Boundary, Data Exfiltration
- **Sources:** [Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173)

### Inductive Bias
- **Category:** Models & inference
- **What people say:** Assumptions built into a learning system.
- **What it actually means:** Structural or statistical assumptions that favor some functions or representations over others. Convolution favors locality and shared filters; causal masking favors prediction from preceding positions.
- **Common confusion:** Transformers still have inductive biases through tokenization, position handling, masking, architecture, data, and objective.
- **Related terms:** CNN (Convolutional Neural Network), Transformer, Feature

### Inference
- **Category:** Models & inference
- **What people say:** Running a trained model.
- **What it actually means:** Executing a trained model to produce predictions, scores, embeddings, or generated tokens without performing an ordinary training update to its parameters.
- **Common confusion:** An application can update caches, conversation state, or external memory during inference even though model weights stay unchanged.
- **Related terms:** Autoregressive, Streaming, KV Cache

### Instruction Following
- **Category:** Prompting & context
- **What it actually means:** A model capability to map natural-language directions and supplied context to behavior that satisfies the stated task and constraints.
- **Why it matters:** Language generation can be fluent without obeying the user's requested operation, format, boundaries, or priorities.
- **In practice:** Evaluate instruction adherence separately from answer quality using conflicting constraints, format requirements, irrelevant context, and refusal cases.
- **Common confusion:** Instruction following is not factual correctness, alignment, or obedience to every string that looks like an instruction.
- **Related terms:** SFT (Supervised Fine-Tuning), Prompt Engineering, Instruction Hierarchy, Alignment
- **Sources:** [Finetuned Language Models Are Zero-Shot Learners](https://arxiv.org/abs/2109.01652)

### Instruction Hierarchy
- **Category:** Prompting & context
- **What it actually means:** A rule set for resolving conflicts among instructions from sources with different authority, such as application policy, users, and untrusted retrieved content.
- **Why it matters:** Agent systems mix trusted goals with external text, so the model and harness need a defined response when lower-authority content conflicts with higher-authority constraints.
- **In practice:** Label untrusted tool output as data, preserve higher-priority constraints outside that content, and test direct and indirect conflict cases.
- **Common confusion:** An instruction hierarchy can improve behavior but is not a security boundary; least privilege and approval controls still limit consequences.
- **Related terms:** System Prompt, Prompt Injection, Least Privilege, Tool Contract
- **Sources:** [The Instruction Hierarchy](https://arxiv.org/abs/2404.13208)

### Inter-Token Latency (ITL)
- **Category:** Infrastructure & serving
- **What it actually means:** The elapsed time between two consecutive output-token arrival events for one request, calculated as `t_i - t_(i-1)` for an output token after the first.
- **Why it matters:** Individual gaps expose decode stalls and streaming jitter that a per-request average can hide, especially under batching, preemption, or mixed workloads.
- **In practice:** Record each post-first-token interval with its request and token position, then report distributions by workload, output length, and concurrency without pooling away request boundaries.
- **Common confusion:** ITL is one interval between consecutive tokens. Time per output token is a per-request average across those intervals, while time to first token covers the wait before streaming begins.
- **Learn it:** [Inference Metrics and Goodput](../phases/17-infrastructure-and-production/08-inference-metrics-goodput/)
- **Related terms:** Time per Output Token (TPOT), Time to First Token (TTFT), Decode Phase, Tail Latency
- **Sources:** [DistServe](https://arxiv.org/abs/2401.09670)

## J

### Jailbreak
- **Category:** Security & governance
- **What it actually means:** An adversarial input or interaction strategy intended to make a model produce behavior that its training or application controls are designed to prevent.
- **Why it matters:** Successful jailbreaks expose gaps between stated policy and actual behavior, and they can become more consequential when the model controls tools or protected data.
- **In practice:** Derive test families from prohibited behaviors, vary format and interaction length, measure both refusal and harmful completion, and convert confirmed failures into versioned adversarial evals.
- **Common confusion:** A jailbreak targets model or system behavioral restrictions. Prompt injection redirects instruction following, often toward an attacker's goal; one interaction can involve both.
- **Learn it:** [Jailbreak Taxonomy](../phases/19-capstone-projects/82-jailbreak-taxonomy/)
- **Related terms:** Prompt Injection, Red Teaming, Guardrails, Eval Set
- **Sources:** [Universal and Transferable Adversarial Attacks on Aligned Language Models](https://arxiv.org/abs/2307.15043)

### JAX
- **Category:** Math & training
- **What people say:** A NumPy-like system for accelerated machine learning.
- **What it actually means:** A Python library for transforming numerical functions with automatic differentiation, compilation, vectorization, and parallel execution across accelerators. Its transformations work best with explicit state and functional-style code.
- **Common confusion:** JAX does not prohibit all stateful programming, but hidden mutation inside transformed functions can produce incorrect or unsupported behavior.
- **Learn it:** [Introduction to JAX](../phases/03-deep-learning-core/12-intro-to-jax/)
- **Sources:** [JAX documentation](https://docs.jax.dev/en/latest/)
- **Related terms:** Autograd, Tensor, CUDA

## K

### Knowledge Distillation
- **Category:** Math & training
- **What it actually means:** Training a student model to reproduce selected behavior or output distributions from a more capable teacher, often alongside ordinary target labels.
- **Why it matters:** It can transfer useful behavior into a smaller or cheaper model when serving the teacher directly is impractical.
- **In practice:** Define teacher outputs, temperature, student loss, and a held-out eval set, then compare the student with both the teacher and a label-only baseline.
- **Common confusion:** Distillation transfers behavior on the training distribution; it does not copy every capability, fact, or safety property of the teacher.
- **Related terms:** Fine-tuning, Loss Function, Logits, Quantization
- **Sources:** [Distilling the Knowledge in a Neural Network](https://arxiv.org/abs/1503.02531)

### KV Cache
- **Category:** Models & inference
- **What people say:** A cache that makes token generation faster.
- **What it actually means:** Stored key and value tensors from earlier positions in autoregressive generation. Reusing them avoids recomputing attention projections for the unchanged prefix at every decoding step.
- **Why it matters:** It reduces repeated computation but consumes memory that grows with sequence length, layers, batch, and model configuration.
- **Common confusion:** A KV cache is runtime attention state for a sequence. Prefix caching reuses eligible KV state across requests, while prompt caching is a broader provider or application reuse contract.
- **Learn it:** [KV Cache and Flash Attention](../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/)
- **Related terms:** Attention, Autoregressive, Prefix Caching, Prompt Cache

## L

### Late Fusion
- **Category:** Multimodal systems
- **What it actually means:** Processing modalities through separate encoders or predictors and combining their high-level representations, scores, or decisions near the task output.
- **Why it matters:** Separate branches can use modality-specific architectures and tolerate missing inputs, though they may miss fine-grained interactions available to earlier fusion.
- **In practice:** Calibrate each branch, define how missing modalities affect the merge, compare score-level and feature-level combinations, and evaluate each branch alone as an ablation.
- **Common confusion:** Late fusion describes the position of combination. It does not mean simple averaging or guarantee that the modalities contribute equally.
- **Learn it:** [Cross-Attention Fusion](../phases/19-capstone-projects/61-cross-attention-fusion/)
- **Related terms:** Early Fusion, Multimodal Fusion, Modality, Evaluation (Eval)
- **Sources:** [Multimodal Deep Learning](https://ai.stanford.edu/~ang/papers/icml11-MultimodalDeepLearning.pdf); [Multimodal Machine Learning: A Survey and Taxonomy](https://arxiv.org/abs/1705.09406)

### Latent Space
- **Category:** Data & representations
- **What people say:** A model's hidden representation space.
- **What it actually means:** A learned representation space whose coordinates encode factors useful to a model. It may be lower-dimensional than the input, but compression is not required for every latent representation.
- **Common confusion:** Nearby points are only meaningfully similar according to what the model and training objective learned.
- **Related terms:** Embedding, VAE (Variational Autoencoder), Feature

### Learning Rate
- **Category:** Math & training
- **What people say:** How large each optimization step is.
- **What it actually means:** A scale factor used by an optimizer to control parameter-update magnitude. Values that are too large can destabilize training; values that are too small can make useful progress impractically slow.
- **Common confusion:** The effective update also depends on the optimizer, schedule, gradient scale, batch, and parameter history.
- **Related terms:** Optimizer, Gradient Descent, Batch Size

### Learning Rate Schedule
- **Category:** Math & training
- **What it actually means:** A policy that changes the optimizer's learning rate as training progresses according to steps, epochs, metrics, or a predefined curve.
- **Why it matters:** Different training stages can benefit from different update scales, so one constant rate may be unstable early or wasteful late.
- **In practice:** Version the schedule with the optimizer configuration, log the actual rate at every step, and compare schedules under the same token or update budget.
- **Common confusion:** A scheduler controls the learning rate over time; it does not decide when an optimizer step occurs or guarantee convergence.
- **Related terms:** Learning Rate, Warmup, Optimizer, Epoch
- **Sources:** [SGDR](https://arxiv.org/abs/1608.03983); [Attention Is All You Need](https://arxiv.org/abs/1706.03762)

### Least Privilege
- **Category:** Evaluation & safety
- **What it actually means:** Giving a model, agent, tool, or user only the permissions required for the current task, for only as long as those permissions are needed.
- **Why it matters:** Models can make mistakes or follow malicious instructions. Narrow permissions reduce the damage any one failure can cause.
- **In practice:** Give a documentation agent read access to source files and write access to one branch, but no production credentials or merge permission.
- **Common confusion:** Authentication proves identity. Least privilege limits what that identity can do.
- **Related terms:** Sandbox, Approval Gate, Prompt Injection, Tool Contract

### LLM (Large Language Model)
- **Category:** Models & inference
- **What people say:** The brain of an AI application.
- **What it actually means:** A language model with enough capacity and broad training to perform many language tasks through prompting or adaptation. Most current LLMs use transformer architectures and sequence-prediction objectives, but size thresholds, data sources, and training recipes vary.
- **Common confusion:** An LLM is a model component. Tools, retrieval, state, policies, and product logic live in the surrounding system.
- **Related terms:** Transformer, Autoregressive, Agent Harness

### LLM-as-a-Judge
- **Category:** Evaluation & safety
- **What it actually means:** Using a language model to score, compare, classify, or critique another system's output against a rubric.
- **Why it matters:** It can scale evaluation of qualities that are difficult to express as exact-match tests, such as clarity or instruction adherence.
- **In practice:** Give a separate evaluator model the task, candidate answer, reference evidence, and a structured rubric, then calibrate its scores against human-reviewed examples.
- **Common confusion:** A judge model is not ground truth. It can be biased by order, verbosity, style, prompt wording, or shared model failures.
- **Learn it:** [Eval-Driven Agent Development](../phases/14-agent-engineering/30-eval-driven-agent-development/)
- **Related terms:** Evaluation (Eval), Eval Set, Verification Gate, Precision & Recall

### Load Shedding
- **Category:** Reliability & operations
- **What it actually means:** Deliberately rejecting, dropping, or cancelling selected work at one or more overload boundaries when demand exceeds the capacity available to produce useful results.
- **Why it matters:** Continuing to accept every request during overload can increase queueing until nearly all requests miss their deadlines and recovery becomes harder.
- **In practice:** Shed at the earliest informed boundary, preserve high-priority and already-admitted work when possible, identify the overloaded scope, and mark a response retryable only when the condition is transient and the request remains within its retry budget.
- **Common confusion:** Load shedding is not confined to work that has already been accepted. Admission control is specifically the pre-acceptance gate, while rate limiting can enforce a usage policy even when capacity remains.
- **Related terms:** Admission Control, Backpressure, Rate Limit, Graceful Degradation
- **Sources:** [Google SRE: Handling Overload](https://sre.google/sre-book/handling-overload/)

### Logits
- **Category:** Models & inference
- **What it actually means:** The model's unnormalized numeric scores for candidate outcomes before a normalization function or decoding rule converts them into selections.
- **Why it matters:** Temperature, softmax, top-k, and top-p operate on or derive from logits, so logits connect model computation to generated tokens.
- **In practice:** Inspect logits or log probabilities when the API exposes them, apply masks before sampling, and avoid interpreting raw magnitude as calibrated confidence.
- **Common confusion:** Logits are not probabilities and are not comparable across unrelated positions, models, or tasks without a defined transformation.
- **Related terms:** Softmax, Temperature, Token, Cross-Entropy
- **Sources:** [Attention Is All You Need](https://arxiv.org/abs/1706.03762)

### LoRA (Low-Rank Adaptation)
- **Category:** Math & training
- **What people say:** Parameter-efficient fine-tuning.
- **What it actually means:** A method that keeps base weights frozen and learns low-rank update matrices for selected layers. It reduces the number of trainable parameters and can lower training memory relative to full-parameter fine-tuning.
- **Common confusion:** Actual memory and speed savings depend on rank, target modules, optimizer state, activation memory, quantization, and implementation.
- **Learn it:** [Fine-Tuning and LoRA](../phases/11-llm-engineering/08-fine-tuning-lora/)
- **Sources:** [LoRA paper](https://arxiv.org/abs/2106.09685)
- **Related terms:** Fine-tuning, QLoRA, Parameter

### Loss Function
- **Category:** Math & training
- **What people say:** A number that measures training error.
- **What it actually means:** An objective that maps predictions and targets, sometimes with regularization terms, to a value optimization tries to reduce. The loss determines which errors training directly rewards or penalizes.
- **Common confusion:** A low training loss does not guarantee useful, safe, or generalizable behavior on production tasks.
- **Related terms:** Cross-Entropy, Gradient, Evaluation (Eval)

### Lost in the Middle
- **Category:** Prompting & context
- **What it actually means:** A long-context failure pattern in which model performance changes with evidence position and can degrade when relevant information sits between the beginning and end.
- **Why it matters:** Fitting evidence inside the context window does not guarantee that the model will use every position with equal reliability.
- **In practice:** Test several evidence positions, reduce distractors, place decision-critical constraints where they remain salient, and verify answers against the source.
- **Common confusion:** It is an observed behavior pattern, not a fixed law that affects every model, task, or position identically.
- **Related terms:** Context Window, Context Engineering, Eval Set, Grounding
- **Sources:** [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/)

## M

### Maximum Marginal Relevance (MMR)
- **Category:** Retrieval & generation
- **What it actually means:** A selection rule that balances relevance to the query with novelty relative to items already selected.
- **Why it matters:** It can reduce redundant chunks so a limited context budget covers more distinct evidence.
- **In practice:** Retrieve a candidate pool, select the next item using a documented relevance-diversity weight, and evaluate both answer quality and source coverage.
- **Common confusion:** MMR diversifies an existing candidate set; it does not retrieve missing evidence or prove that selected passages are correct.
- **Related terms:** Reranker, Chunking, RAG (Retrieval-Augmented Generation), Grounding
- **Sources:** [The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries](https://www.cs.cmu.edu/~jgc/publication/MMR_DiversityBased_Reranking_SIGIR_1998.pdf)

### MCP (Model Context Protocol)
- **Category:** Agents & tools
- **What people say:** A standard way for AI applications to connect to tools and context.
- **What it actually means:** An open JSON-RPC protocol for a host to connect to servers that expose tools, resources, prompts, and extensions through defined request, result, discovery, and transport contracts. In revision 2026-07-28, every request carries its protocol version and client capabilities instead of relying on an initialization handshake or protocol session.
- **Common confusion:** MCP standardizes discovery and exchange. It does not decide which tool is safe to call, grant permission, or forbid an application from using explicit state handles.
- **Learn it:** [Model Context Protocol](../phases/11-llm-engineering/14-model-context-protocol/)
- **Sources:** [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- **Related terms:** Stateless MCP, Multi Round-Trip Request (MRTR), Function Calling, Tool Contract, Least Privilege

### Membership Inference
- **Category:** Security & governance
- **What it actually means:** An attack that estimates whether a particular record or example was included in a model's training data by observing model outputs or other accessible signals.
- **Why it matters:** Even when the model does not reproduce a record verbatim, distinguishable behavior can reveal information about participation in a sensitive dataset.
- **In practice:** Test representative members and non-members under the real query interface, limit unnecessary confidence signals, reduce data exposure, and evaluate privacy defenses against utility requirements.
- **Common confusion:** Membership inference asks whether a record participated in training. Model extraction tries to reproduce model behavior, while direct memorization tests whether content can be recovered.
- **Learn it:** [Differential Privacy for LLMs](../phases/18-ethics-safety-alignment/22-differential-privacy-for-llms/)
- **Related terms:** Data Leakage, Data Minimization, Eval Set, Data Classification
- **Sources:** [Membership Inference Attacks Against Machine Learning Models](https://doi.org/10.1109/SP.2017.41)

### Mixed Precision
- **Category:** Math & training
- **What people say:** Using lower-precision arithmetic for speed and memory savings.
- **What it actually means:** A numerical strategy that uses different data types for different operations, often lower precision for many matrix operations and higher precision for values that need more range or stability.
- **Common confusion:** Speed, memory, and accuracy effects depend on hardware, data type, scaling method, kernels, and model. They are not a fixed multiplier.
- **Related terms:** Tensor, CUDA, NaN (Not a Number), Quantization

### Modality
- **Category:** Multimodal systems
- **What it actually means:** A form of information with its own structure and acquisition process, such as text, image, audio, video, depth, or sensor measurements.
- **Why it matters:** Different modalities have different sampling rates, noise, spatial or temporal structure, and missing-data behavior, so one preprocessing assumption rarely fits all of them.
- **In practice:** Document each modality's source, units, resolution, timing, preprocessing, and missing-value policy before designing alignment or fusion.
- **Common confusion:** A modality is not merely a file extension or feature column. Several encodings can represent one modality, and one sample can contain several modalities.
- **Learn it:** [MIO Any-to-Any Streaming](../phases/12-multimodal-ai/16-mio-any-to-any-streaming/)
- **Related terms:** Multimodal Model, Token, Tensor, Embedding
- **Sources:** [ImageBind: One Embedding Space To Bind Them All](https://arxiv.org/abs/2305.05665); [Multimodal Machine Learning: A Survey and Taxonomy](https://arxiv.org/abs/1705.09406)

### Modality Alignment
- **Category:** Multimodal systems
- **What it actually means:** Learning or establishing correspondences between representations from different modalities so semantically or temporally related items can be matched.
- **Why it matters:** Fusion and cross-modal retrieval fail when the system cannot connect the same event, object, or concept across differently structured inputs.
- **In practice:** Define positive and negative pairs, preserve time or spatial metadata, evaluate mismatched examples, and measure alignment separately from downstream task accuracy.
- **Common confusion:** Alignment makes representations comparable or corresponding. It does not require them to become identical or erase modality-specific information.
- **Learn it:** [Projection Layer Modality Alignment](../phases/19-capstone-projects/60-projection-layer-modality-align/)
- **Related terms:** Shared Embedding Space, Contrastive Learning, Grounding, Multimodal Fusion
- **Sources:** [Learning Transferable Visual Models From Natural Language Supervision](https://proceedings.mlr.press/v139/radford21a.html)

### Model Card
- **Category:** Evaluation & safety
- **What it actually means:** A structured report describing a model's intended uses, evaluation conditions, performance characteristics, limitations, and relevant ethical or safety considerations.
- **Why it matters:** It gives downstream builders context for deciding whether reported evidence applies to their users and deployment conditions.
- **In practice:** Document model version, training and evaluation scope, subgroup results, known failure modes, prohibited uses, and the date of each claim.
- **Common confusion:** A model card communicates evidence and limitations; it is not a certification, warranty, system threat model, or substitute for deployment-specific evaluation.
- **Related terms:** Eval Set, Dataset Split, Distribution Shift, Alignment
- **Sources:** [Model Cards for Model Reporting](https://dl.acm.org/doi/10.1145/3287560.3287596)

### Model Router
- **Category:** AI-native development
- **What it actually means:** A component that selects a model or provider for a request using requirements such as capability, latency, cost, context size, policy, and current availability.
- **Why it matters:** Different tasks and failure conditions justify different models, and routing can improve outcome quality without sending every request to the largest option.
- **In practice:** Send low-risk extraction to a fast model, complex code review to a stronger model, and fail over only to providers that satisfy the same data policy.
- **Common confusion:** Routing is a policy decision. Random load balancing only distributes traffic.
- **Related terms:** Evaluation (Eval), Circuit Breaker, Rate Limit, Cost per Successful Task

### Model Serving
- **Category:** Infrastructure & serving
- **What it actually means:** The runtime and API layer that loads versioned model artifacts, accepts inference requests, schedules execution, manages resources, and returns results under an operational contract.
- **Why it matters:** A capable model can still produce an unreliable product when queueing, batching, placement, versioning, cancellation, and response boundaries are not engineered explicitly.
- **In practice:** Pin model and tokenizer versions, validate request limits, expose readiness and latency signals, control concurrency, and test rollback before routing production traffic.
- **Common confusion:** Model serving is broader than calling inference once and narrower than the complete application, which may also include retrieval, tools, policy, and user state.
- **Learn it:** [Self-Hosted Serving Selection](../phases/17-infrastructure-and-production/28-self-hosted-serving-selection/)
- **Related terms:** Inference, Model Router, Autoscaling, Observability
- **Sources:** [Clipper](https://arxiv.org/abs/1612.03079)

### MoE (Mixture of Experts)
- **Category:** Models & inference
- **What people say:** A large model that activates only part of its parameters for each token.
- **What it actually means:** An architecture with multiple expert subnetworks and a learned router that selects a subset for each input unit, often each token. Sparse activation can increase total parameter capacity without using every expert on every forward pass.
- **Why it matters:** Compute, memory, communication, routing balance, and quality depend on the specific architecture and serving system.
- **Common confusion:** Product names do not prove an MoE architecture unless the model developer discloses it.
- **Learn it:** [Mixture of Experts](../phases/07-transformers-deep-dive/11-mixture-of-experts/)
- **Related terms:** Transformer, Model Router, Parameter

### Multimodal Fusion
- **Category:** Multimodal systems
- **What it actually means:** Combining evidence or learned representations from more than one modality to produce a joint representation, prediction, or generated output.
- **Why it matters:** Modalities can supply complementary evidence, but naïve combination can amplify noise, timing errors, or one dominant stream.
- **In practice:** Establish single-modality baselines, specify the fusion point and masks, test missing and contradictory inputs, and report which modalities drive each evaluated slice.
- **Common confusion:** Fusion is the combination operation. Alignment establishes correspondence, and merely placing two modalities in one request does not prove either occurred successfully.
- **Learn it:** [Cross-Attention Fusion](../phases/19-capstone-projects/61-cross-attention-fusion/)
- **Related terms:** Early Fusion, Late Fusion, Cross-Attention, Modality Alignment
- **Sources:** [Multimodal Deep Learning](https://ai.stanford.edu/~ang/papers/icml11-MultimodalDeepLearning.pdf); [Multimodal Machine Learning: A Survey and Taxonomy](https://arxiv.org/abs/1705.09406)

### Multimodal Model
- **Category:** Multimodal systems
- **What it actually means:** A model that learns from, relates, or generates more than one modality through representation, alignment, fusion, translation, or coordinated prediction.
- **Why it matters:** Multimodal capability depends on how modalities interact, not simply on accepting several input types, and failures can occur at each representation boundary.
- **In practice:** Document supported input and output combinations, evaluate each modality alone and together, test missing or conflicting inputs, and track preprocessing versions with the model.
- **Common confusion:** A pipeline with separate image and text models is multimodal at the system level, but it is not necessarily one jointly trained multimodal model.
- **Learn it:** [MIO Any-to-Any Streaming](../phases/12-multimodal-ai/16-mio-any-to-any-streaming/)
- **Related terms:** Modality, Vision-Language Model (VLM), Multimodal Fusion, Transformer
- **Sources:** [Flamingo: a Visual Language Model for Few-Shot Learning](https://arxiv.org/abs/2204.14198); [Multimodal Machine Learning: A Survey and Taxonomy](https://arxiv.org/abs/1705.09406)

### Multi Round-Trip Request (MRTR)
- **Category:** Agents & tools
- **Aliases:** MRTR
- **What it actually means:** An MCP request pattern in which an operation returns `resultType: input_required` with one or more `inputRequests`, then the client retries the original method with `inputResponses` and the exact returned `requestState`.
- **Why it matters:** It lets a stateless server request user, model, or root input without opening a server-initiated JSON-RPC exchange or storing protocol session state.
- **In practice:** Return an input request from `tools/call`, collect the authorized response in the host, and retry that same tool call with a new JSON-RPC id.
- **Common confusion:** `requestState` is untrusted round-trip data. Integrity-protect it before using it for authorization or business decisions, and do not treat it as a server-side session identifier.
- **Learn it:** [MCP Roots and Elicitation](../phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/)
- **Related terms:** Stateless MCP, MCP (Model Context Protocol), Human-in-the-Loop (HITL), Tool Contract
- **Sources:** [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)

## N

### NaN (Not a Number)
- **Category:** Math & training
- **What people say:** A sign that numerical computation failed.
- **What it actually means:** A floating-point value representing an undefined or unrepresentable numerical result. In training, NaNs can come from invalid operations, overflow, unstable normalization, excessive updates, or earlier corrupted values.
- **In practice:** Find the first non-finite tensor, inspect its inputs, and add assertions or anomaly detection near that operation.
- **Related terms:** Mixed Precision, Learning Rate, Gradient

### Normalization
- **Category:** Math & training
- **What people say:** Scaling data to a standard range.
- **What it actually means:** A family of transformations that rescale or recenter inputs, activations, or features using defined statistics. Batch normalization and layer normalization use different axes and behave differently across training and inference.
- **Common confusion:** Normalization can improve optimization stability, but it does not always permit a larger learning rate or improve every architecture.
- **Related terms:** Tensor, Activation Function, Mixed Precision

### Nucleus Sampling (Top-p)
- **Category:** Models & inference
- **Aliases:** Top-p sampling
- **What it actually means:** A decoding method that samples from the smallest set of next-token candidates whose cumulative probability reaches a chosen threshold.
- **Why it matters:** The candidate-set size adapts to the distribution, retaining more options when uncertainty is broad and fewer when probability is concentrated.
- **In practice:** Evaluate the threshold with temperature and stop settings held constant, and record the complete decoding configuration with every result.
- **Common confusion:** Top-p is a probability-mass threshold, while top-k always keeps a fixed maximum number of candidates.
- **Related terms:** Top-k Sampling, Temperature, Decoding Strategy, Softmax
- **Sources:** [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)

## O

### Observability
- **Category:** AI-native development
- **What it actually means:** The ability to understand an AI system's behavior from recorded inputs, outputs, state transitions, tool calls, timings, costs, errors, and evaluation signals.
- **Why it matters:** AI failures often span model, retrieval, tools, and orchestration. You need correlated evidence to locate the failing boundary.
- **In practice:** Record a trace ID across retrieval, model calls, tool execution, approvals, and final scoring while applying redaction and access controls.
- **Common confusion:** Logging collects events. Observability makes those events structured and connected enough to answer operational questions.
- **Learn it:** [Agent Observability Platforms](../phases/14-agent-engineering/24-agent-observability-platforms/)
- **Related terms:** Trace, Evaluation (Eval), Agent State, Time to First Token (TTFT)

### Optimizer
- **Category:** Math & training
- **What people say:** The algorithm that updates weights.
- **What it actually means:** An algorithm that transforms gradients into parameter updates. Plain stochastic gradient descent is a simple baseline; momentum, Adam, and other optimizers change the update using history or adaptive scaling. Each choice has different memory, stability, and tuning behavior.
- **Common confusion:** The optimizer consumes gradients; backpropagation computes them.
- **Related terms:** Adam (Optimizer), AdamW, Gradient, Learning Rate

### Orchestration
- **Category:** Agents & tools
- **What it actually means:** The control logic that sequences, branches, delegates, retries, pauses, resumes, and terminates work across model and tool steps.
- **Why it matters:** Reliable agent behavior depends on explicit workflow decisions outside the model, especially when tasks have dependencies or consequential side effects.
- **In practice:** Encode stable steps as a workflow or state machine, expose bounded decisions to the model, and persist transitions before external writes.
- **Common confusion:** Orchestration is not synonymous with autonomy or multi-agent systems; one agent can be orchestrated through a deterministic workflow.
- **Related terms:** Agent Harness, Planning, Delegation, Durable Execution
- **Sources:** [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)

### Overfitting
- **Category:** Math & training
- **What people say:** The model memorized the training data.
- **What it actually means:** A generalization gap in which performance on training data is substantially better than performance on representative unseen data. Memorization can contribute, but the operational symptom is poor generalization.
- **In practice:** Compare training and held-out metrics, inspect subgroup failures, and test changes such as data quality, regularization, early stopping, or model capacity.
- **Related terms:** Underfitting, Dropout, Weight Decay, Eval Set

## P

### Paged KV Cache
- **Category:** Infrastructure & serving
- **What it actually means:** A KV-cache memory manager that stores attention state in fixed-size blocks and maps logical sequence positions to physical blocks instead of requiring one contiguous allocation per sequence.
- **Why it matters:** Variable sequence lengths create fragmentation and unpredictable growth, so block-based allocation can improve usable memory and enable flexible sharing.
- **In practice:** Select block size from workload measurements, track allocation and eviction, isolate state between requests, and test cancellation and prefix sharing under memory pressure.
- **Common confusion:** Paged KV cache manages runtime attention-state memory. It does not move model parameters to disk or extend the model's trained context limit.
- **Learn it:** [vLLM Serving Internals](../phases/17-infrastructure-and-production/04-vllm-serving-internals/)
- **Related terms:** KV Cache, Prefix Caching, Context Window, Model Serving
- **Sources:** [Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)

### Parameter
- **Category:** Models & inference
- **What people say:** A number used to describe model size.
- **What it actually means:** A value learned during training, commonly a weight, bias, embedding element, or normalization parameter. Parameter count is one measure of model capacity, but it does not directly determine quality, memory, or serving cost.
- **Common confusion:** Memory per parameter depends on numerical format, quantization metadata, sharding, optimizer state, activations, and runtime overhead.
- **Related terms:** Weight, MoE (Mixture of Experts), Quantization

### Pass@k
- **Category:** Evaluation & safety
- **What it actually means:** Across a task set, the fraction of tasks for which at least one of k sampled candidates passes a defined correctness test.
- **Why it matters:** It measures the value of sampling several attempts for tasks such as code generation where an automatic verifier can check each candidate.
- **In practice:** Generate candidates independently under a fixed configuration, run the same isolated tests on each, and report k with the sampling and estimator details.
- **Common confusion:** Pass@k is not single-attempt accuracy, and a higher score can reflect a larger attempt budget rather than a better first answer.
- **Related terms:** Coding Agent, Regression Test, Eval Set, Test Oracle
- **Sources:** [Evaluating Large Language Models Trained on Code](https://arxiv.org/abs/2107.03374)

### Patch
- **Category:** AI-native development
- **What it actually means:** A reviewable representation of changes to one or more files, usually expressed as additions and deletions against a known base revision.
- **Why it matters:** A patch gives people and agents a narrow artifact to inspect, test, apply, or reject without accepting an entire working directory.
- **In practice:** Ask a coding agent to return a unified diff, then verify that it touches only allowed files and applies cleanly to the expected commit.
- **Common confusion:** A patch captures file changes, not the reasoning, test evidence, or approval needed to ship them.
- **Learn it:** [Workbench for Real Repositories](../phases/14-agent-engineering/41-workbench-for-real-repos/)
- **Related terms:** Coding Agent, Worktree, Scope Contract, Regression Test

### Patch Embedding
- **Category:** Multimodal systems
- **What it actually means:** A learned projection that converts an image patch into a fixed-width vector used as one element of a transformer input sequence.
- **Why it matters:** It creates the interface between a spatial image grid and a sequence model, with patch size controlling token count and retained local detail.
- **In practice:** Record patch and image dimensions, handle padding or resizing explicitly, add position information, and measure how resolution changes affect both accuracy and token cost.
- **Common confusion:** A patch embedding is the vector representation of a patch, not a semantic object detector or a guarantee that patch boundaries match visual entities.
- **Learn it:** [Vision Transformer Patch Tokens](../phases/12-multimodal-ai/01-vision-transformer-patch-tokens/)
- **Related terms:** Vision Transformer (ViT), Image Token, Embedding, Token
- **Sources:** [An Image is Worth 16x16 Words](https://arxiv.org/abs/2010.11929)

### Perplexity
- **Category:** Models & inference
- **What people say:** How surprised a language model is by a dataset.
- **What it actually means:** The exponentiated average negative log-likelihood under a stated tokenization and logarithm convention. Lower values mean the model assigned higher probability to the evaluated sequence.
- **Common confusion:** Perplexity is not comparable across different tokenizers or evaluation setups and does not directly measure factuality or usefulness.
- **Related terms:** Cross-Entropy, Token, Evaluation (Eval)

### Pipeline Parallelism
- **Category:** Infrastructure & serving
- **What it actually means:** Partitioning sequential groups of model layers across devices and moving microbatches or requests through those stages as a pipeline.
- **Why it matters:** It lets models exceed one device's memory, but stage imbalance, pipeline bubbles, activation transfers, and failure coordination affect usable performance.
- **In practice:** Balance stage cost, choose a microbatch schedule, measure idle time and interconnect traffic, and keep model and checkpoint partition metadata versioned.
- **Common confusion:** Pipeline parallelism divides layers by depth. Tensor parallelism divides tensor operations within a layer.
- **Learn it:** [Scaling and Distributed Training](../phases/10-llms-from-scratch/05-scaling-distributed/)
- **Related terms:** Tensor Parallelism, Expert Parallelism, Batch Size, Model Serving
- **Sources:** [GPipe](https://arxiv.org/abs/1811.06965)

### Planning
- **Category:** Agents & tools
- **What it actually means:** Constructing, selecting, or revising a sequence of actions and dependencies intended to move from the current state to a goal.
- **Why it matters:** Explicit plans make assumptions and ordering visible before an agent commits to expensive or irreversible actions.
- **In practice:** Ask for a short dependency-aware plan, validate it against available tools and permissions, then re-plan when observations invalidate an assumption.
- **Common confusion:** A generated plan is a proposal, not proof that the steps are feasible, sufficient, or safe.
- **Related terms:** Agent State, ReAct, Orchestration, Verification Gate
- **Sources:** [LLM+P](https://arxiv.org/abs/2304.11477)

### Postmortem
- **Category:** Reliability & operations
- **What it actually means:** A durable incident record that explains impact, detection, response, contributing conditions, recovery, and owned follow-up actions without assigning blame as a substitute for analysis.
- **Why it matters:** A resolved outage still has value as evidence. Capturing system conditions and decisions turns one event into improvements that reduce recurrence and response time.
- **In practice:** Build the timeline from traces and logs, distinguish triggering events from contributing conditions, assign dated actions, and review whether each action changed the relevant control.
- **Common confusion:** A postmortem is not a meeting transcript or a search for one person's mistake. It should produce testable system improvements.
- **Related terms:** Incident Response, Regression Test, Audit Log, Observability
- **Sources:** [Google SRE: Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)

### Precision & Recall
- **Category:** Evaluation & safety
- **What people say:** Two metrics for classification or retrieval quality.
- **What it actually means:** Precision asks how many flagged items were correct; recall asks how many relevant items were found. When you change the decision threshold for one fixed scoring model, improving recall often lowers precision and vice versa. A better model can improve both. F1 is their harmonic mean.
- **Common confusion:** The right threshold and metric depend on the cost of each error and the prevalence of the target class.
- **Related terms:** Eval Set, Semantic Search, Guardrails

### Prefill
- **Category:** Infrastructure & serving
- **Aliases:** Prefill Phase
- **What it actually means:** The initial inference stage that processes all supplied input tokens to produce their representations and the attention state required for subsequent autoregressive generation.
- **Why it matters:** Prompt shape, queueing, and cache reuse affect prefill cost, and prefill competes differently for compute than decode, so it strongly influences startup latency and serving schedules.
- **In practice:** Record prompt tokens and prefill latency, separate queue time from execution time, compare cached and uncached prefixes, and test long prompts beside active decode traffic.
- **Common confusion:** Prefill is the runtime prompt-processing stage, not the first generated token itself. The first token appears only after prefill and any queueing complete.
- **Learn it:** [Disaggregated Prefill and Decode](../phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/)
- **Related terms:** Decode Phase, KV Cache, Time to First Token (TTFT), Chunked Prefill
- **Sources:** [Sarathi-Serve](https://www.usenix.org/system/files/osdi24-agrawal.pdf); [DistServe](https://arxiv.org/abs/2401.09670)

### Prefix Caching
- **Category:** Infrastructure & serving
- **What it actually means:** Reusing KV-cache blocks produced for an identical eligible token prefix across requests so the serving runtime can skip repeated prefix computation.
- **Why it matters:** Shared system instructions, templates, or documents can consume substantial prefill work, but reuse only helps when token sequences and cache eligibility match.
- **In practice:** Place stable tokens before request-specific content, include model and tokenizer versions in cache identity, isolate tenant-sensitive state, monitor hit rate, and treat eviction as normal.
- **Common confusion:** Prefix caching reuses runtime attention state for exact token prefixes. Prompt caching is a broader provider or application contract, while semantic caching reuses a prior result for a similar request.
- **Learn it:** [Inference Optimization](../phases/10-llms-from-scratch/12-inference-optimization/)
- **Related terms:** Prompt Cache, Semantic Cache, KV Cache, Paged KV Cache
- **Sources:** [SGLang](https://arxiv.org/abs/2312.07104)

### Progressive Disclosure
- **Category:** AI-native development
- **What it actually means:** Supplying a person or model with the minimum useful context first, then revealing deeper detail when the task or evidence requires it.
- **Why it matters:** It limits context noise and cost while keeping authoritative detail available on demand.
- **In practice:** Give a coding agent repository rules and a map first; load full implementation files only after it identifies the relevant module.
- **Common confusion:** Progressive disclosure is staged access to detail, not deliberate withholding of information required for a decision.
- **Learn it:** [Workbench for Real Repositories](../phases/14-agent-engineering/41-workbench-for-real-repos/)
- **Related terms:** Context Engineering, Repository Map, Token Budget, Handoff

### Prompt Cache
- **Category:** Prompting & context
- **What it actually means:** Reuse of provider-side or application-side computation for an identical or eligible prompt prefix so repeated inference avoids some preprocessing work.
- **Why it matters:** Stable instructions and large shared documents can become cheaper or faster across repeated calls when the provider's cache contract is satisfied.
- **In practice:** Place stable policy text before request-specific content, monitor cache-hit metadata, and treat misses as normal because eligibility and lifetime vary by provider.
- **Common confusion:** A prompt cache is a provider or application reuse contract and may use prefix caching internally. Prefix caching specifically reuses eligible exact-token KV state, while semantic caching reuses a prior result for a sufficiently similar request.
- **Learn it:** [Prompt Caching](../phases/11-llm-engineering/15-prompt-caching/)
- **Related terms:** Semantic Cache, Prefix Caching, KV Cache, Time to First Token (TTFT)

### Prompt Engineering
- **Category:** Prompting & context
- **What people say:** Wording instructions so a model follows the task.
- **What it actually means:** Designing model-facing instructions, examples, constraints, and output requirements to improve behavior on a defined task.
- **Common confusion:** Prompt wording cannot compensate for missing evidence, unsafe permissions, poor tool contracts, or absent evaluation.
- **Learn it:** [Prompt Engineering](../phases/11-llm-engineering/01-prompt-engineering/)
- **Related terms:** Context Engineering, Few-Shot, System Prompt, Structured Output

### Prompt Injection
- **Category:** Evaluation & safety
- **What people say:** An adversarial instruction that redirects a model.
- **What it actually means:** An attack or failure mode in which untrusted content influences a model to disregard intended instructions, expose data, misuse tools, or take actions outside the user's goal. The content can arrive directly from a user or indirectly through retrieved pages, files, messages, or tool output.
- **Why it matters:** Models process instructions and data through the same language channel, so input filtering alone cannot reliably separate every malicious instruction from legitimate content.
- **In practice:** Treat external content as untrusted, isolate it from authority-bearing instructions, minimize tool permissions, require approval for consequential writes, and verify outputs and actions.
- **Common confusion:** Prompt injection is not technically the same mechanism as SQL injection, and a stronger system prompt is not a complete defense.
- **Learn it:** [Prompt Injection Defense](../phases/14-agent-engineering/27-prompt-injection-defense/)
- **Sources:** [OWASP prompt injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- **Related terms:** Least Privilege, Sandbox, Approval Gate, Tool Contract

### Prompt Sensitivity
- **Category:** Prompting & context
- **What it actually means:** Variation in model output or measured performance caused by changes to prompt wording, order, formatting, or examples that preserve the intended task.
- **Why it matters:** A system that succeeds under one convenient phrasing may be unreliable for real users or misleading in evaluation.
- **In practice:** Create semantically equivalent prompt variants, measure variance by case, and keep variants in regression tests instead of optimizing one prompt against one eval set.
- **Common confusion:** Sensitivity is not always a prompt defect; it can reveal ambiguity, weak model robustness, unstable decoding, or an inadequate scoring rule.
- **Related terms:** Prompt Engineering, Eval Set, Regression Test, Few-Shot
- **Sources:** [ProSA](https://aclanthology.org/2024.findings-emnlp.108/)

### Provenance Attestation
- **Category:** Security & governance
- **What it actually means:** Authenticated, machine-readable metadata that binds an artifact to claims about how, where, when, and from which inputs it was produced.
- **Why it matters:** It lets automated policy and reviewers verify supply-chain claims instead of trusting an unsigned build note.
- **In practice:** Generate an attestation in the build system, bind it to artifact digests, sign it with a controlled identity, and verify it before release.
- **Common confusion:** A signature identifies the attester and protects integrity; it does not prove that every claim inside the attestation is true.
- **Related terms:** Data Provenance, Reproducible Build, Audit Log, Verification Gate
- **Sources:** [SLSA Software Attestations](https://slsa.dev/spec/v1.2/attestation-model)

### Purpose Limitation
- **Category:** Security & governance
- **What it actually means:** For personal data, collecting and using it only for specified, explicit purposes unless a new use has an appropriate compatible or authorized basis.
- **Why it matters:** Data that was acceptable for one workflow can create privacy and governance risk when silently reused for model training, evaluation, personalization, or unrelated analytics.
- **In practice:** Record the purpose with each dataset, check new pipelines against it before access, separate incompatible uses, and require a documented decision when the purpose changes.
- **Common confusion:** Purpose limitation governs why data is used. Data minimization governs how much data that purpose actually requires.
- **Related terms:** Data Minimization, Data Classification, AI Risk Assessment, Audit Log
- **Sources:** [General Data Protection Regulation, Article 5(1)(b)](https://eur-lex.europa.eu/eli/reg/2016/679/oj)

## Q

### QLoRA
- **Category:** Math & training
- **What people say:** LoRA with a quantized base model.
- **What it actually means:** A parameter-efficient fine-tuning method that keeps a pretrained base model frozen in a low-bit quantized representation while training LoRA adapters with higher-precision computation where needed.
- **Why it matters:** It can reduce the memory needed to adapt large models, but savings and quality depend on model, rank, optimizer, sequence length, hardware, and implementation.
- **Common confusion:** QLoRA does not guarantee a particular memory footprint or a fixed quality gap from full fine-tuning.
- **Learn it:** [Fine-Tuning and LoRA](../phases/11-llm-engineering/08-fine-tuning-lora/)
- **Sources:** [QLoRA paper](https://arxiv.org/abs/2305.14314)
- **Related terms:** LoRA (Low-Rank Adaptation), Quantization, Fine-tuning

### Quantization
- **Category:** Models & inference
- **What people say:** Storing or computing model values with fewer bits.
- **What it actually means:** Representing weights, activations, or caches with lower-precision formats to reduce memory, bandwidth, or compute cost. Methods differ in calibration, granularity, data type, and whether conversion happens before, during, or after training.
- **Common confusion:** Moving from one nominal bit width to another does not guarantee the same end-to-end memory or speed ratio because metadata, kernels, caches, and hardware support also matter.
- **Related terms:** QLoRA, Mixed Precision, Parameter

## R

### RAG (Retrieval-Augmented Generation)
- **Category:** Retrieval & generation
- **What people say:** A model answering with retrieved knowledge.
- **What it actually means:** A system pattern that retrieves evidence relevant to a request and supplies selected content to a generative model before it answers or acts. Retrieval can use lexical, vector, structured, or hybrid methods.
- **Why it matters:** RAG can make current or private evidence available without encoding it into model weights, but retrieval and grounding must be evaluated separately.
- **Why it's called that:** Retrieval finds evidence, augmentation adds selected evidence to context, and generation produces the response.
- **Learn it:** [Retrieval-Augmented Generation](../phases/11-llm-engineering/06-rag/)
- **Sources:** [Retrieval-Augmented Generation paper](https://arxiv.org/abs/2005.11401)
- **Related terms:** Grounding, Hybrid Retrieval, Reranker, Hallucination

### Rate Limit
- **Category:** AI-native development
- **What it actually means:** A policy that caps requests, tokens, concurrent work, or another resource within a defined time or capacity window.
- **Why it matters:** It protects providers and your own system from overload, uncontrolled spend, and unfair resource use.
- **In practice:** Enforce per-tenant token and concurrency limits, read provider retry metadata, and queue or reject excess work predictably.
- **Common confusion:** A rate limit controls allowed usage. Backpressure propagates downstream capacity constraints through a system.
- **Related terms:** Backpressure, Retry with Backoff, Circuit Breaker

### ReAct
- **Category:** Agents & tools
- **What it actually means:** An agent pattern that interleaves task reasoning, a concrete action, and an observation returned by the environment before deciding the next step.
- **Why it matters:** Environment feedback can correct assumptions and ground later decisions instead of forcing the model to complete the entire task from internal generation alone.
- **In practice:** Expose a small set of typed tools, return concise observations, cap the loop, and verify the final artifact rather than storing private reasoning traces.
- **Common confusion:** ReAct is a prompting and control pattern, not a guarantee of autonomy, correctness, or safe tool use.
- **Related terms:** Agent, Function Calling, Planning, Grounding
- **Sources:** [ReAct](https://arxiv.org/abs/2210.03629)

### Readiness Probe
- **Category:** Reliability & operations
- **What it actually means:** A diagnostic that tells the traffic-routing layer whether a service instance is currently able to accept requests.
- **Why it matters:** A process can be alive while its model is unloaded, dependencies are unavailable, or warmup is incomplete, so sending traffic too early creates avoidable failures.
- **In practice:** Check the minimum dependencies required to serve, fail readiness during startup and draining, keep the probe inexpensive, and do not restart the process solely because readiness is false.
- **Common confusion:** Readiness controls traffic eligibility. Liveness decides whether the process should be restarted, and neither proves that every model response will be correct.
- **Learn it:** [Production LLM Application](../phases/11-llm-engineering/13-production-app/)
- **Related terms:** Autoscaling, Model Serving, Availability, Graceful Degradation
- **Sources:** [Kubernetes Liveness, Readiness, and Startup Probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/)

### Recall@K
- **Category:** Retrieval & generation
- **What it actually means:** For one query, Recall@K is `|relevant items intersecting the top k| / |relevant items|`. A dataset score aggregates those per-query values under a stated rule.
- **Why it matters:** It tells you whether a retrieval stage supplies downstream generation or reranking with enough relevant candidates.
- **In practice:** Define relevance judgments, k, the aggregation method, and a policy for queries with no judged relevant items, then inspect queries with zero recalled evidence.
- **Common confusion:** High Recall@K does not mean the top result is good, the ranking is well ordered, or the final answer is grounded. Queries with no relevant items require an explicit exclusion or assigned-value policy because the denominator is zero.
- **Related terms:** Precision & Recall, Eval Set, Reranker, Approximate Nearest Neighbor (ANN)
- **Sources:** [BEIR](https://openreview.net/forum?id=wCu6T5xFjeJ)

### Reciprocal Rank Fusion (RRF)
- **Category:** Retrieval & generation
- **What it actually means:** A rank-fusion method that combines several result lists by summing contributions that decrease with each item's rank in each list.
- **Why it matters:** It can merge lexical, dense, or multi-query rankings without assuming their raw scores share the same scale.
- **In practice:** Retrieve independent candidate lists, deduplicate by stable document identity, apply one versioned fusion constant, and evaluate against each individual retriever.
- **Common confusion:** RRF combines ranks, not embeddings or relevance scores, and it cannot recover an item absent from every input list.
- **Related terms:** Hybrid Retrieval, BM25, Dense Retrieval, Reranker
- **Sources:** [Reciprocal Rank Fusion Outperforms Condorcet and Individual Rank Learning Methods](https://dl.acm.org/doi/10.1145/1571941.1572114)

### Red Teaming
- **Category:** Security & governance
- **What it actually means:** A structured adversarial testing process in which authorized testers seek failures using documented objectives, threat assumptions, cases, and evidence.
- **Why it matters:** Ordinary quality tests rarely explore how a system behaves under manipulation, misuse, conflicting goals, or determined attempts to bypass controls.
- **In practice:** Derive attacks from a threat model, run them in an isolated environment, record reproducible cases, remediate by layer, and convert confirmed failures into regression evals.
- **Common confusion:** A list of jailbreak prompts is not a complete red-team program, and red teaming cannot prove the absence of unknown failures.
- **Related terms:** Threat Model, Guardrails, Prompt Injection, Eval Set
- **Sources:** [Red Teaming Language Models with Language Models](https://arxiv.org/abs/2202.03286)

### Regression Test
- **Category:** AI-native development
- **What it actually means:** A repeatable check that protects behavior known to work, especially after code, prompt, model, retrieval, or tool changes.
- **Why it matters:** AI system changes can improve average quality while silently reintroducing a previously fixed failure.
- **In practice:** Turn a corrected prompt-injection incident into a permanent eval case that must pass before the next deployment.
- **Common confusion:** A regression test guards a specific expected behavior. A broad benchmark estimates performance across a wider task distribution.
- **Learn it:** [Eval-Driven Agent Development](../phases/14-agent-engineering/30-eval-driven-agent-development/)
- **Related terms:** Eval Set, Verification Gate, Patch, Evaluation (Eval)

### ReLU
- **Category:** Math & training
- **What people say:** A simple activation function.
- **What it actually means:** Rectified Linear Unit, defined as `f(x) = max(0, x)`. It is inexpensive and has a non-saturating positive branch, though zero gradients on negative inputs can create inactive units.
- **Related terms:** Activation Function, Gradient, CNN (Convolutional Neural Network)

### Repository Instructions
- **Category:** AI-native development
- **What it actually means:** Version-controlled guidance that tells coding agents how a repository is organized, which commands and conventions apply, what boundaries to respect, and how to verify work.
- **Why it matters:** It turns repeated tribal knowledge into local context that travels with the code and can vary by subproject.
- **In practice:** Keep an `AGENTS.md` at the repository root, add narrower files for subdirectories, and include exact build, test, generated-file, security, and contribution rules.
- **Common confusion:** Repository instructions complement source code and human documentation; they do not override the user's current request or guarantee that an agent follows them correctly.
- **Related terms:** Repository Map, Scope Contract, Coding Agent, Progressive Disclosure
- **Sources:** [AGENTS.md specification](https://agents.md/)

### Repository Map
- **Category:** AI-native development
- **What it actually means:** A compact, maintained description of a repository's important directories, ownership boundaries, entry points, build commands, tests, generated files, and local instructions.
- **Why it matters:** It helps a coding agent find the right evidence before loading large files or editing the wrong subsystem.
- **In practice:** Generate an index from the tree and manifests, then enrich it with authoritative notes about module boundaries and validation commands.
- **Common confusion:** A raw file tree shows names. A repository map explains which paths matter and how they relate to a task.
- **Learn it:** [Repository Memory and State](../phases/14-agent-engineering/34-repo-memory-and-state/)
- **Related terms:** Coding Agent, Progressive Disclosure, Scope Contract, Context Engineering

### Reproducible Build
- **Category:** AI-native development
- **What it actually means:** A build whose declared source, environment, and instructions can be independently rerun to produce bit-for-bit identical specified artifacts.
- **Why it matters:** It makes an artifact verifiable beyond the machine or agent that originally produced it and exposes hidden build inputs.
- **In practice:** Pin toolchains and dependencies, remove timestamps and unstable ordering, capture the environment, then compare independently rebuilt artifact digests.
- **Common confusion:** A build that succeeds twice is repeatable evidence, but reproducibility requires the declared independent conditions and identical outputs.
- **Related terms:** Repository Instructions, Verification Gate, Provenance Attestation, Software Bill of Materials (SBOM)
- **Sources:** [Reproducible Builds definition](https://reproducible-builds.org/docs/definition/)

### Reranker
- **Category:** Retrieval & generation
- **What it actually means:** A second-stage model or scoring function that reorders a small candidate set using a richer comparison between the query and each candidate.
- **Why it matters:** Fast first-stage retrieval maximizes candidate coverage, while reranking can improve which evidence reaches the limited context window.
- **In practice:** Retrieve 50 candidates with hybrid search, score each query-document pair with a cross-encoder, and pass the top 5 supported chunks to generation.
- **Common confusion:** A reranker does not search the entire corpus. It only reorders candidates that retrieval already found.
- **Related terms:** Hybrid Retrieval, Semantic Search, RAG (Retrieval-Augmented Generation)

### Retry Budget
- **Category:** Reliability & operations
- **What it actually means:** A bound on retry traffic, usually expressed relative to original requests or over a time window, that prevents retries from consuming unbounded capacity.
- **Why it matters:** When a dependency slows or fails, unrestricted retries multiply load exactly when the system has the least spare capacity.
- **In practice:** Count retries separately from first attempts, cap them by service and tenant, honor deadlines, use jittered backoff, and stop retrying non-transient or non-idempotent failures.
- **Common confusion:** A retry budget limits extra attempts. An error budget measures user-visible unreliability allowed by an SLO.
- **Related terms:** Retry with Backoff, Error Budget, Rate Limit, Admission Control
- **Sources:** [Google SRE: Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/)

### Retry with Backoff
- **Category:** AI-native development
- **What it actually means:** Repeating a failed transient operation after progressively longer delays, usually with randomized jitter and a strict retry limit.
- **Why it matters:** Immediate synchronized retries can worsen an outage, consume rate limits, and duplicate side effects.
- **In practice:** Retry a provider timeout after bounded exponential delays, honor server retry guidance, and reuse an idempotency key for any write.
- **Common confusion:** Do not retry permanent validation or permission errors, and do not retry non-idempotent operations without a duplication strategy.
- **Related terms:** Idempotency, Rate Limit, Circuit Breaker, Backpressure

### Reviewer Agent
- **Category:** AI-native development
- **What it actually means:** An agent assigned to inspect another agent's artifact or decision against explicit criteria and return findings or a verdict.
- **Why it matters:** Separation of roles can catch omissions, but it only helps when the reviewer receives independent evidence and a concrete rubric.
- **In practice:** After one agent produces a patch, give a separate reviewer the diff, scope contract, repository rules, and test output, then require line-specific findings.
- **Common confusion:** A second model call is not automatically independent or correct. Shared context, model bias, and vague criteria can reproduce the same mistake.
- **Learn it:** [Reviewer Agent](../phases/14-agent-engineering/39-reviewer-agent/)
- **Related terms:** Coding Agent, Verification Gate, Scope Contract, LLM-as-a-Judge

### RLHF (Reinforcement Learning from Human Feedback)
- **Category:** Math & training
- **What people say:** Training a model from human preferences.
- **What it actually means:** A family of pipelines that uses human feedback to learn a reward or preference signal and then optimizes a model policy against that signal. Implementations vary and need not all use the same reinforcement-learning algorithm.
- **Common confusion:** RLHF optimizes a proxy learned from collected feedback. It does not guarantee broad alignment with every user or situation.
- **Learn it:** [Reinforcement Learning from Human Feedback](../phases/10-llms-from-scratch/07-rlhf/)
- **Sources:** [InstructGPT paper](https://arxiv.org/abs/2203.02155)
- **Related terms:** DPO (Direct Preference Optimization), SFT (Supervised Fine-Tuning), Alignment

### Rollback
- **Category:** Reliability & operations
- **What it actually means:** Restoring a previously known deployment or configuration when the current release violates operational, quality, or safety criteria.
- **Why it matters:** Agent and model changes can fail in production despite pre-deployment evaluation, so recovery must be designed before rollout.
- **In practice:** Retain versioned artifacts and configuration, define rollback triggers, rehearse the command and data implications, and verify service health after restoration.
- **Common confusion:** Code rollback does not automatically reverse database migrations, external side effects, cached outputs, or data written by the bad release.
- **Related terms:** Canary Release, Checkpoint, Regression Test, Durable Execution
- **Sources:** [Kubernetes Deployments: Rolling Back](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment)

### ROUGE
- **Category:** Evaluation & safety
- **What people say:** A reference-overlap metric often used for summaries.
- **What it actually means:** A family of metrics that compares generated text with reference text using units such as n-gram overlap or longest common subsequence.
- **Common confusion:** Surface overlap can miss semantic equivalence and can reward copied wording without proving factual quality.
- **Related terms:** Evaluation (Eval), Precision & Recall, LLM-as-a-Judge

## S

### Sandbox
- **Category:** Agents & tools
- **What it actually means:** An isolated execution environment that restricts an agent's access to files, processes, network destinations, credentials, and host resources.
- **Why it matters:** Generated code and tool calls can be wrong or malicious. Isolation limits their reach and makes disposable verification practical.
- **In practice:** Run tests in an ephemeral container with a read-only base, a scoped writable workspace, no production secrets, and an explicit network allowlist.
- **Common confusion:** A sandbox reduces impact. It does not establish that the code inside is correct or harmless.
- **Learn it:** [Production Agent Runtimes](../phases/14-agent-engineering/29-production-runtimes/)
- **Related terms:** Least Privilege, Approval Gate, Coding Agent, Guardrails

### Saturation
- **Category:** Reliability & operations
- **What it actually means:** The degree to which a constrained resource or service has exhausted its capacity, including queued work that cannot begin promptly.
- **Why it matters:** Utilization alone can appear acceptable while memory, accelerator slots, queue depth, or a downstream quota is already limiting useful throughput.
- **In practice:** Identify each critical resource, measure active and waiting work, relate saturation to tail latency and errors, and alert before the queue enters an unstable growth regime.
- **Common confusion:** Saturation is not one universal percentage. The limiting resource and its queueing behavior depend on the workload and architecture.
- **Related terms:** Observability, Autoscaling, Backpressure, Tail Latency
- **Sources:** [Google SRE: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)

### Scope Contract
- **Category:** AI-native development
- **What it actually means:** A concrete agreement that defines a task's goal, allowed and forbidden surfaces, expected artifacts, verification requirements, and stopping conditions.
- **Why it matters:** It prevents an agent from turning a narrow fix into an unreviewable refactor or from claiming completion without evidence.
- **In practice:** State that only the parser module and its tests may change, public APIs must remain compatible, and the named test suite must pass.
- **Common confusion:** A task description says what you want. A scope contract also defines boundaries and proof.
- **Learn it:** [Scope Contracts](../phases/14-agent-engineering/36-scope-contracts/)
- **Related terms:** Coding Agent, Patch, Verification Gate, Handoff

### Self-Attention
- **Category:** Models & inference
- **What people say:** Tokens deciding which other tokens matter.
- **What it actually means:** Attention in which queries, keys, and values are derived from the same sequence representation. Scaled similarity scores are normalized and used to combine values, subject to causal, padding, local, or other masks.
- **Why it matters:** It builds context-sensitive token representations, but the permitted attention pattern depends on the architecture.
- **Common confusion:** Not every token can always attend to every other token. Causal and sparse models intentionally restrict connections.
- **Learn it:** [Self-Attention from Scratch](../phases/07-transformers-deep-dive/02-self-attention-from-scratch/)
- **Related terms:** Attention, Transformer, Context Window

### Semantic Cache
- **Category:** AI-native development
- **What it actually means:** A cache that reuses a previous result when a new request is judged sufficiently similar under a chosen representation and threshold.
- **Why it matters:** It can reduce latency and cost for repeated intents, but an incorrect match can return stale or user-inappropriate output.
- **In practice:** Cache low-risk FAQ answers by normalized intent, include tenant and policy version in the key, and bypass the cache for personalized or time-sensitive requests.
- **Common confusion:** Semantic similarity does not guarantee that two requests have the same correct answer. A semantic cache reuses a prior result, while prefix caching reuses exact-token KV state and prompt caching follows provider or application eligibility rules.
- **Related terms:** Prompt Cache, Embedding, Cost per Successful Task, Grounding

### Semantic Search
- **Category:** Retrieval & generation
- **What people say:** Search by meaning instead of exact words.
- **What it actually means:** Retrieval that represents a query and candidates in an embedding space and ranks candidates using a vector-similarity function.
- **Why it matters:** It can retrieve paraphrases and conceptually related text, but exact identifiers and rare strings may still need lexical search.
- **Related terms:** Embedding, Hybrid Retrieval, Vector Database, Reranker

### Separation of Duties
- **Category:** Security & governance
- **What it actually means:** Dividing conflicting responsibilities or authority across independent roles so one principal cannot complete a high-risk action without another authorized decision.
- **Why it matters:** A compromised account or mistaken agent should not be able to propose, approve, execute, and conceal the same consequential change.
- **In practice:** Separate artifact creation from release approval, use distinct identities, preserve both decisions in the audit log, and define emergency access with later review.
- **Common confusion:** Separation of duties is about conflicting authority, not simply assigning work to several people or agents that share the same credentials.
- **Related terms:** Approval Gate, Reviewer Agent, Audit Log, Least Privilege
- **Sources:** [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)

### Service Level Indicator (SLI)
- **Category:** Reliability & operations
- **What it actually means:** A quantitative measure of service behavior at a defined user-relevant boundary, such as successful request ratio or latency below a threshold.
- **Why it matters:** Reliability discussions become actionable only when the observed behavior, eligible events, and measurement point are explicit.
- **In practice:** Define numerator, denominator, exclusions, data source, and aggregation window, then validate that the indicator tracks an outcome users actually experience.
- **Common confusion:** An SLI is the measurement. An SLO is the target applied to that measurement over a defined period.
- **Related terms:** Service Level Objective (SLO), Availability, Tail Latency, Observability
- **Sources:** [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)

### Service Level Objective (SLO)
- **Category:** Reliability & operations
- **What it actually means:** A target range or threshold for a service-level indicator over a stated population and measurement window.
- **Why it matters:** It translates an expected user outcome into an operating boundary for monitoring, capacity, release risk, and incident decisions.
- **In practice:** Choose an indicator users care about, set the target from product needs rather than current performance, define the window and exclusions, and attach an error-budget policy.
- **Common confusion:** An SLO is an internal reliability objective. A contractual service-level agreement can include remedies and may use different definitions.
- **Learn it:** [Inference Metrics and Goodput](../phases/17-infrastructure-and-production/08-inference-metrics-goodput/)
- **Related terms:** Service Level Indicator (SLI), Error Budget, Availability, Goodput
- **Sources:** [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)

### SFT (Supervised Fine-Tuning)
- **Category:** Math & training
- **What people say:** Training on example inputs and desired outputs.
- **What it actually means:** Fine-tuning a pretrained model on paired inputs and desired responses so it learns the demonstrated behavior under the training distribution.
- **Common confusion:** SFT can adapt many behaviors beyond chat, and example quality determines what behavior is reinforced.
- **Related terms:** Fine-tuning, DPO (Direct Preference Optimization), RLHF (Reinforcement Learning from Human Feedback)

### Shadow Traffic
- **Category:** Reliability & operations
- **What it actually means:** A copy of live request traffic sent to a candidate system for observation while the candidate response remains outside the primary user response path. Because the copied request still executes, its side effects must be isolated.
- **Why it matters:** It exposes the candidate to real input shapes and load while limiting user impact, which can reveal failures absent from synthetic tests.
- **In practice:** Remove or tokenize sensitive fields, route tools and dependencies to sandboxed or no-op targets, block writes at capability boundaries, preserve request correlation, and prevent shadow load from competing with user traffic.
- **Common confusion:** Keeping a candidate response off the primary path does not make execution side-effect-free. A canary release differs because it serves real users from the candidate for a controlled share of traffic.
- **Learn it:** [Shadow, Canary, and Progressive Delivery](../phases/17-infrastructure-and-production/20-shadow-canary-progressive/)
- **Related terms:** Canary Release, Evaluation (Eval), Trace, Model Serving
- **Sources:** [Istio Traffic Mirroring](https://istio.io/latest/docs/tasks/traffic-management/mirroring/)

### Shared Embedding Space
- **Category:** Multimodal systems
- **What it actually means:** A common vector space in which representations from different modalities can be compared with the same similarity function.
- **Why it matters:** It enables cross-modal retrieval and matching, such as finding images from text, without requiring both items to share a raw representation.
- **In practice:** Train paired and unpaired negatives deliberately, normalize vectors when the objective requires it, evaluate both retrieval directions, and inspect subgroup and language performance.
- **Common confusion:** Sharing a vector dimension does not create a shared semantic space. The training objective and data must establish cross-modal comparability.
- **Learn it:** [CLIP Contrastive Pretraining](../phases/12-multimodal-ai/02-clip-contrastive-pretraining/)
- **Related terms:** Embedding, Cosine Similarity, Modality Alignment, Semantic Search
- **Sources:** [Learning Transferable Visual Models From Natural Language Supervision](https://proceedings.mlr.press/v139/radford21a.html)

### Skill Bundle
- **Category:** Agents & tools
- **What it actually means:** The complete installable skill directory, including `SKILL.md` and every reference, script, asset, fixture, or companion file required by the workflow.
- **Why it matters:** Copying only the entry file can leave valid-looking instructions that point to missing resources or lose the deterministic code the workflow depends on.
- **In practice:** Install the tree as one unit, record hashes and source revision, validate the installed copy, and show collisions before replacing an existing bundle.
- **Common confusion:** `SKILL.md` is the entry point, not necessarily the entire artifact.
- **Learn it:** [Skill Evals, Packaging, and Portability](../phases/13-tools-and-protocols/27-skill-evals-packaging-and-portability/)
- **Related terms:** Agent Skill, Skill Catalog, Reproducible Build, Provenance Attestation
- **Sources:** [Agent Skills specification](https://agentskills.io/specification)

### Skill Catalog
- **Category:** Agents & tools
- **What it actually means:** The compact model-visible inventory of eligible skills, usually containing routing metadata such as name, description, and an internal source identifier rather than every skill body.
- **Why it matters:** A catalog lets an agent discover relevant procedures without loading every installed package into the working context.
- **In practice:** Validate packages first, apply an explicit duplicate-name policy, measure the serialized catalog budget, and retain diagnostics for entries that were shortened, omitted, or shadowed.
- **Common confusion:** A catalog entry means the skill is discoverable. It does not mean the body is active or its tools are authorized.
- **Learn it:** [Skill Discovery and Progressive Disclosure](../phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/)
- **Related terms:** Skill Discovery, Skill Invocation, Progressive Disclosure, Token Budget
- **Sources:** [Agent Skills specification](https://agentskills.io/specification)

### Skill Discovery
- **Category:** Agents & tools
- **What it actually means:** A runtime pipeline that searches configured roots, identifies candidate skill directories, validates their package contract, attaches scope and provenance, resolves collisions, and publishes eligible catalog entries.
- **Why it matters:** Deterministic discovery makes missing, malformed, shadowed, and unsafe packages diagnosable before model routing begins.
- **In practice:** Declare search scopes and duplicate behavior, decide how symlinks are handled, reject resource escapes, and log why each candidate was accepted or rejected.
- **Common confusion:** Skill discovery is not an unrestricted recursive search for filenames called `SKILL.md`; installation locations and precedence are runtime policy.
- **Learn it:** [Skill Discovery and Progressive Disclosure](../phases/13-tools-and-protocols/24-skill-discovery-and-progressive-disclosure/)
- **Related terms:** Skill Catalog, Skill Bundle, Progressive Disclosure, Trust Boundary
- **Sources:** [Agent Skills client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)

### Skill Invocation
- **Category:** Agents & tools
- **What it actually means:** The runtime-mediated process in which an eligible human, model, application, or other skill selects a skill and causes its instructions to enter the working context.
- **Why it matters:** Explicit user access, implicit model routing, activation, argument binding, tool permission, and execution are separate decisions with different failure modes.
- **In practice:** Define actor policy, evaluate descriptions with positive and near-miss requests, record the selected package identity, and keep host-specific invocation fields in tested adapters.
- **Common confusion:** Invocation activates instructions. It does not automatically execute a command or bypass approval and sandbox policy.
- **Learn it:** [Skill Invocation and Routing](../phases/13-tools-and-protocols/25-skill-invocation-and-routing/)
- **Related terms:** Agent Skill, Skill Catalog, Approval Gate, Sandbox
- **Sources:** [Evaluating Agent Skills](https://agentskills.io/skill-creation/evaluating-skills)

### Softmax
- **Category:** Math & training
- **What people say:** A function that turns logits into normalized positive values.
- **What it actually means:** A function defined by `softmax(x_i) = exp(x_i) / sum(exp(x_j))`, implemented with numerical stabilization. Its outputs are positive and sum to one, so they can parameterize a categorical distribution.
- **Common confusion:** Softmax values are not automatically calibrated probabilities about real-world correctness.
- **Related terms:** Temperature, Cross-Entropy, Attention

### Software Bill of Materials (SBOM)
- **Category:** Security & governance
- **Aliases:** SBOM
- **What it actually means:** A structured inventory of software components and relationships associated with a product or artifact, often including versions, suppliers, licenses, and identifiers.
- **Why it matters:** You need a component inventory to assess affected dependencies, license obligations, and supply-chain exposure when software changes or vulnerabilities emerge.
- **In practice:** Generate the SBOM during the trusted build, bind it to the release artifact, verify it in policy checks, and update it whenever dependencies or packaging change.
- **Common confusion:** An SBOM is an inventory, not proof that components are secure, correctly licensed, or actually present unless generation and provenance are trustworthy.
- **Related terms:** Provenance Attestation, Reproducible Build, Data Provenance, Audit Log
- **Sources:** [SPDX 3.0.1 specification](https://spdx.github.io/spdx-spec/v3.0/)

### Speculative Decoding
- **Category:** Models & inference
- **What it actually means:** An inference method in which a cheaper draft process proposes several tokens and the target model scores those draft positions in parallel. In exact sampling variants, an acceptance and correction rule preserves the target model's output distribution.
- **Why it matters:** It can reduce serial target-model decoding work when drafts are accepted, without requiring a change to the target model's trained weights.
- **In practice:** Measure acceptance rate and end-to-end latency on real prompts, include draft-model overhead, and verify that the implementation preserves the intended decoding distribution.
- **Common confusion:** Speculative decoding is not ordinary model routing or unverified autocomplete. Exact variants preserve the target distribution through acceptance and correction, while approximate variants may trade that guarantee for speed.
- **Related terms:** Autoregressive, KV Cache, Decoding Strategy, Tokens per Second (TPS)
- **Sources:** [Fast Inference from Transformers via Speculative Decoding](https://proceedings.mlr.press/v202/leviathan23a.html)

### Stateless MCP
- **Category:** Agents & tools
- **What it actually means:** The MCP 2026-07-28 request model in which every request carries the protocol version and client capabilities in `params._meta`, while results carry an explicit `resultType`; no protocol state is keyed by an initialization handshake, connection, or `Mcp-Session-Id`.
- **Why it matters:** Any worker can validate and process a request from its contents and authorization context, which avoids hidden connection affinity and makes horizontal routing easier to reason about.
- **In practice:** Implement `server/discover`, rebuild request metadata on every call, validate transport headers against the JSON-RPC body, and pass server-minted application handles as ordinary tool arguments when continuity is required.
- **Common confusion:** Stateless MCP removes protocol sessions, not application state, transport connections, streaming responses, tasks, or explicit handles.
- **Learn it:** [MCP Fundamentals](../phases/13-tools-and-protocols/06-mcp-fundamentals/)
- **Related terms:** MCP (Model Context Protocol), Multi Round-Trip Request (MRTR), Tool Contract, Idempotency
- **Sources:** [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog); [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)

### Stochastic Gradient Descent (SGD)
- **Category:** Math & training
- **Aliases:** SGD
- **What it actually means:** An optimizer family that updates parameters from a gradient estimated on a sampled example or minibatch rather than the complete training dataset.
- **Why it matters:** It is the baseline for understanding gradient noise, momentum, batch scaling, and the adaptive optimizers used in modern training.
- **In practice:** Record batch sampling, learning rate, momentum if used, and schedule, then compare validation behavior under equal update or token budgets.
- **Common confusion:** In current practice, SGD usually means minibatch SGD, and its useful learning rate does not follow one universal batch-scaling rule.
- **Related terms:** Gradient Descent, Batch Size, Learning Rate, Optimizer
- **Sources:** [Optimization Methods for Large-Scale Machine Learning](https://arxiv.org/abs/1606.04838); [Accurate, Large Minibatch SGD](https://arxiv.org/abs/1706.02677)

### Stop Sequence
- **Category:** Models & inference
- **What it actually means:** An application-specified token or text pattern that causes generation to stop when the decoding system encounters it.
- **Why it matters:** Stop sequences bound output protocols and multi-part generation without waiting for the model to decide semantically that it is finished.
- **In practice:** Choose unambiguous delimiters, test tokenization and partial streaming matches, and still enforce output length and schema validation.
- **Common confusion:** A stop sequence is a mechanical decoding condition, not proof that the answer is complete or that an agent goal is satisfied.
- **Related terms:** Decoding Strategy, Structured Output, Token, Termination Condition
- **Sources:** [Transformers text-generation documentation](https://huggingface.co/docs/transformers/main/en/main_classes/text_generation)

### Streaming
- **Category:** Models & inference
- **What people say:** Showing output as it is generated.
- **What it actually means:** Delivering incremental response events before the complete result is ready. A stream may contain token text, structured deltas, tool-call arguments, usage metadata, or status events depending on the API.
- **Why it matters:** It improves perceived responsiveness, but it does not reduce the model's actual time to produce a complete answer.
- **Common confusion:** Network transport, event shape, and chunk boundaries are provider-specific and are not guaranteed to align with words or tokens.
- **Learn it:** [Production LLM Application](../phases/11-llm-engineering/13-production-app/)
- **Related terms:** Time to First Token (TTFT), Autoregressive, Observability

### Structured Output
- **Category:** Agents & tools
- **What it actually means:** Model output constrained or validated against a machine-readable schema so application code can consume fields without parsing free-form prose.
- **Why it matters:** It reduces format ambiguity at the model-to-software boundary and enables field-level validation and retries.
- **In practice:** Require an incident triage result with an allowed severity enum, evidence array, and nullable escalation reason, then reject any response that fails the schema.
- **Common confusion:** Schema-valid output can still contain incorrect values. Structure is not factual verification.
- **Learn it:** [Structured Outputs](../phases/11-llm-engineering/03-structured-outputs/)
- **Related terms:** Function Calling, Tool Contract, Verification Gate

### Swarm
- **Category:** Agents & tools
- **What people say:** Many agents collaborating without one fixed controller.
- **What it actually means:** A loosely coordinated multi-agent pattern in which local agent decisions and message exchange produce system-level behavior. The term is used inconsistently, so the actual topology, state ownership, and termination rules must be specified.
- **Common confusion:** Multiple named agents do not guarantee useful specialization or emergent coordination.
- **Related terms:** Agent, Reviewer Agent, Handoff, Agent State

### System Prompt
- **Category:** Prompting & context
- **What people say:** Developer-controlled instructions for a model interaction.
- **What it actually means:** A provider-defined instruction message or configuration supplied by the application to establish behavior and constraints within that provider's instruction hierarchy.
- **Why it matters:** System instructions can guide behavior, but they are not guaranteed to remain secret and should not be treated as a security boundary.
- **Common confusion:** Priority rules, message roles, persistence, and visibility differ across APIs. Check the current provider contract.
- **Learn it:** [Instructions as Executable Constraints](../phases/14-agent-engineering/33-instructions-as-executable-constraints/)
- **Related terms:** Prompt Engineering, Prompt Injection, Context Engineering, Guardrails

## T

### Tail Latency
- **Category:** Reliability & operations
- **What it actually means:** The latency experienced by the slowest portion of requests, commonly summarized with a high percentile under a stated workload and time window.
- **Why it matters:** Averages can look healthy while a meaningful group of users waits much longer because of queueing, contention, retries, or variable request cost.
- **In practice:** Report several percentiles by route and workload, retain timeouts as censored or failed observations according to a documented rule, and trace slow requests across dependencies.
- **Common confusion:** Tail latency is not the single slowest request and has no meaning without the percentile, population, and measurement boundary.
- **Learn it:** [Inference Metrics and Goodput](../phases/17-infrastructure-and-production/08-inference-metrics-goodput/)
- **Related terms:** Time to First Token (TTFT), Time per Output Token (TPOT), Saturation, Goodput
- **Sources:** [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/)

### Temperature
- **Category:** Models & inference
- **What people say:** A creativity setting.
- **What it actually means:** A decoding parameter that rescales logits before a probability distribution is formed. Higher positive values usually flatten the distribution; lower positive values sharpen it.
- **Why it matters:** Temperature changes sampling behavior, not the model's knowledge or factuality.
- **Common confusion:** A zero setting is often implemented as greedy decoding, but exact behavior and determinism depend on the provider, sampler, seed support, and serving system.
- **Related terms:** Softmax, Autoregressive, Token

### Tensor
- **Category:** Data & representations
- **What people say:** A multidimensional array used for numerical computation.
- **What it actually means:** A typed array with a shape, data type, and device placement that frameworks use to represent inputs, parameters, activations, and gradients. Automatic-differentiation metadata is framework- and operation-dependent, not an inherent property of every tensor.
- **Related terms:** Autograd, Parameter, Mixed Precision

### Tensor Parallelism
- **Category:** Infrastructure & serving
- **What it actually means:** Partitioning tensor operations within a model layer across devices, with collective communication combining partial results during the layer computation.
- **Why it matters:** It lets one layer use memory and compute from several devices, but frequent communication can dominate when the interconnect or partition is unsuitable.
- **In practice:** Match partition dimensions to model shapes, benchmark collective traffic, keep ranks on a fast interconnect, and record the sharding layout with checkpoints and serving configuration.
- **Common confusion:** Tensor parallelism splits work inside layers. Pipeline parallelism places different layer groups on different devices.
- **Learn it:** [Scaling and Distributed Training](../phases/10-llms-from-scratch/05-scaling-distributed/)
- **Related terms:** Tensor, Pipeline Parallelism, Expert Parallelism, Parameter
- **Sources:** [Megatron-LM](https://arxiv.org/abs/1909.08053)

### Termination Condition
- **Category:** Agents & tools
- **What it actually means:** An explicit rule that ends or pauses an agent run when it succeeds, fails, exhausts a budget, reaches a safe boundary, or requires escalation.
- **Why it matters:** Without a termination condition, an agent can loop, repeat side effects, waste budget, or claim completion without satisfying the goal.
- **In practice:** Define success evidence, maximum steps and cost, non-retryable errors, and escalation states before starting the loop.
- **Common confusion:** A stop sequence ends text generation; a termination condition decides whether the task or workflow should stop.
- **Related terms:** Agent Harness, Token Budget, Verification Gate, Stop Sequence
- **Sources:** [AutoGen](https://arxiv.org/abs/2308.08155)

### Test Oracle
- **Category:** AI-native development
- **What it actually means:** The mechanism, specification, reference, invariant, or human judgment used to decide whether observed program behavior is correct.
- **Why it matters:** Generating test inputs is not enough; automated verification requires an independent basis for classifying each result.
- **In practice:** Prefer executable invariants, reference implementations, schemas, and deterministic expected outputs, then document where human judgment remains necessary.
- **Common confusion:** The model that wrote the code should not be treated as an independent oracle merely because you ask it whether its own output is correct.
- **Related terms:** Regression Test, Verification Gate, Eval Set, Human-in-the-Loop (HITL)
- **Sources:** [The Oracle Problem in Software Testing](https://www.computer.org/csdl/journal/ts/2015/05/06963470/13rRUx0geBw)

### Threat Model
- **Category:** Security & governance
- **What it actually means:** A documented account of protected assets, trust boundaries, potential adversaries, assumed capabilities, attack paths, impacts, and planned controls.
- **Why it matters:** Security controls cannot be judged without stating what they defend, against whom, and under which assumptions.
- **In practice:** Map data and authority across model, retrieval, tools, users, and external services, then turn credible abuse paths into red-team cases and mitigations.
- **Common confusion:** A threat model prioritizes plausible risks; it is not a checklist that proves the system secure or predicts every future attack.
- **Related terms:** Least Privilege, Prompt Injection, Sandbox, Red Teaming
- **Sources:** [NIST SP 800-154](https://csrc.nist.gov/pubs/sp/800/154/ipd); [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.600-1.pdf)

### Time per Output Token (TPOT)
- **Category:** Infrastructure & serving
- **What it actually means:** For one request with `N > 1` output tokens, the average post-first-token interval: `(t_N - t_1) / (N - 1)`. System distributions then aggregate those per-request averages.
- **Why it matters:** Users can receive the first token quickly while the rest of the answer streams slowly, so startup latency alone does not describe generation responsiveness.
- **In practice:** Compute TPOT separately for each request, report percentiles across requests by output length and concurrency, and avoid pooling all token intervals or comparing systems with different tokenizers and measurement boundaries.
- **Common confusion:** TPOT is a per-request average. An individual inter-token latency is one gap between consecutive tokens, while time to first token includes the wait before output starts.
- **Learn it:** [Inference Metrics and Goodput](../phases/17-infrastructure-and-production/08-inference-metrics-goodput/)
- **Related terms:** Decode Phase, Time to First Token (TTFT), Streaming, Goodput
- **Sources:** [DistServe](https://arxiv.org/abs/2401.09670)

### Time to First Token (TTFT)
- **Category:** Models & inference
- **Aliases:** TTFT
- **What it actually means:** The elapsed time from submitting a generation request until the client receives the first output token or content event under a defined measurement boundary.
- **Why it matters:** TTFT strongly affects perceived responsiveness and can reveal queueing, prompt processing, cache, or network delays.
- **In practice:** Record client-side TTFT by model, prompt length, region, and cache status, then separate it from total completion time.
- **Common confusion:** TTFT is not tokens per second. One measures startup latency; the other measures generation throughput after output begins.
- **Related terms:** Streaming, Prompt Cache, Observability, Token Budget

### Token
- **Category:** Data & representations
- **What people say:** A word-sized piece of model input or output.
- **What it actually means:** An integer identifier produced by a model-specific tokenizer from text, bytes, images, audio, or another input representation. A token can be a whole word, part of a word, punctuation, whitespace, a byte sequence, or a special control symbol.
- **Common confusion:** Character-to-token ratios vary by language, content, and tokenizer, so count with the target model's tokenizer or provider tools.
- **Learn it:** [Tokenizers](../phases/10-llms-from-scratch/01-tokenizers/)
- **Related terms:** Token Budget, Context Window, Autoregressive

### Token Budget
- **Category:** Prompting & context
- **What it actually means:** An explicit allocation of token capacity across instructions, evidence, history, tool results, reasoning or working space, and output.
- **Why it matters:** Every included token competes for context capacity, latency, and cost. Budgeting forces you to preserve high-value evidence first.
- **In practice:** Reserve output capacity, cap retrieved chunks, summarize old tool results into state, and stop or compact before the model limit is reached.
- **Common confusion:** A token budget is a planning constraint. It is not the same as the model's maximum context window.
- **Learn it:** [Context Engineering](../phases/11-llm-engineering/05-context-engineering/)
- **Related terms:** Context Window, Context Engineering, Progressive Disclosure, Cost per Successful Task

### Tokenization
- **Category:** Data & representations
- **What it actually means:** Converting an input representation into the ordered token identifiers a specific model or tokenizer accepts.
- **Why it matters:** Tokenization determines sequence length, vocabulary boundaries, cost accounting, truncation behavior, and how text or code is represented before embedding.
- **In practice:** Use the exact tokenizer for the target model, version it with artifacts, and test multilingual text, code, whitespace, and special tokens.
- **Common confusion:** Tokenization is not always word splitting, and two models can assign different token counts and IDs to the same input.
- **Related terms:** Token, Vocabulary, Byte Pair Encoding (BPE), Embedding
- **Sources:** [Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909)

### Tokens per Second (TPS)
- **Category:** Infrastructure & serving
- **Aliases:** TPS, output token throughput
- **What it actually means:** A throughput measure reporting how many output tokens a serving system produces per unit time under a stated scope and workload.
- **Why it matters:** It complements startup latency by showing how quickly generation proceeds after output begins and how serving behaves under load.
- **In practice:** State whether TPS is per request or aggregate, exclude or identify prefill, and report batch, concurrency, sequence lengths, hardware, and percentile latency.
- **Common confusion:** TPS is not directly comparable across different tokenizers, workloads, quality settings, or measurement boundaries.
- **Related terms:** Time to First Token (TTFT), Streaming, Prefill, Observability
- **Sources:** [Sarathi-Serve](https://www.usenix.org/system/files/osdi24-agrawal.pdf)

### Tool Contract
- **Category:** Agents & tools
- **What it actually means:** The complete agreement for a tool boundary: purpose, typed inputs, outputs, validation, permissions, side effects, errors, timeouts, idempotency, and evidence returned to the caller.
- **Why it matters:** A schema tells a model what fields exist; a contract tells the system when the tool is safe and how failures must be handled.
- **In practice:** Define a file-write tool with an allowed root, expected base revision, maximum size, dry-run mode, explicit conflict errors, and a returned patch hash.
- **Common confusion:** A JSON Schema is part of a tool contract, not the whole contract.
- **Learn it:** [Tool Use and Function Calling](../phases/14-agent-engineering/06-tool-use-and-function-calling/)
- **Related terms:** Function Calling, Structured Output, Least Privilege, Idempotency

### Top-k Sampling
- **Category:** Models & inference
- **What it actually means:** A decoding method that restricts the next-token distribution to the k highest-scoring candidates, renormalizes their probabilities, and samples from that set.
- **Why it matters:** It removes the long low-probability tail from sampling while keeping a fixed maximum candidate count.
- **In practice:** Evaluate k together with temperature, top-p, and stop settings, and record the complete sampler configuration with generated results.
- **Common confusion:** Top-k uses a fixed candidate count, while top-p uses a probability-mass threshold whose candidate count changes by step.
- **Related terms:** Nucleus Sampling (Top-p), Temperature, Decoding Strategy, Logits
- **Sources:** [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)

### Trace
- **Category:** AI-native development
- **What it actually means:** A correlated record of one request or task across model calls, retrieval, tools, state transitions, retries, approvals, and evaluations.
- **Why it matters:** It lets you reconstruct where time, cost, and failure entered a multi-step workflow.
- **In practice:** Propagate one trace identifier through the agent harness and attach redacted spans for each model and tool operation.
- **Common confusion:** A trace should record operational evidence, not expose hidden model reasoning, secrets, or unredacted sensitive content.
- **Learn it:** [OpenTelemetry GenAI Conventions](../phases/14-agent-engineering/23-otel-genai-conventions/)
- **Sources:** [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- **Related terms:** Observability, Agent State, Time to First Token (TTFT), Evaluation (Eval)

### Transfer Learning
- **Category:** Math & training
- **What people say:** Reusing a pretrained model for a new task.
- **What it actually means:** Starting from representations or parameters learned on one data distribution or objective and adapting them for another. The transferable components and update strategy depend on architecture and task.
- **Common confusion:** Transfer is not limited to later layers, and successful transfer is not guaranteed when source and target tasks differ sharply.
- **Related terms:** Fine-tuning, Feature, SFT (Supervised Fine-Tuning)

### Transformer
- **Category:** Models & inference
- **What people say:** The architecture behind many modern language models.
- **What it actually means:** A neural-network architecture built from attention, position information, feed-forward sublayers, residual connections, and normalization. Encoder, decoder, and encoder-decoder variants use different masks and information flows.
- **Why it matters:** Training can process many sequence positions in parallel, while autoregressive generation still produces outputs step by step.
- **Common confusion:** Self-attention does not imply unrestricted all-to-all attention in every transformer.
- **Learn it:** [Build a Full Transformer](../phases/07-transformers-deep-dive/05-full-transformer/)
- **Sources:** [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
- **Related terms:** Attention, Self-Attention, Encoder, Decoder

### Trust Boundary
- **Category:** Security & governance
- **What it actually means:** An interface where data, instructions, identity, or authority crosses between components or principals that operate under different trust assumptions.
- **Why it matters:** A boundary crossing is where the system must authenticate actors, validate data, constrain permissions, and decide which claims can influence action.
- **In practice:** Draw boundaries around users, model context, retrieval sources, tools, networks, and data stores, then specify validation and authorization for every crossing.
- **Common confusion:** A network boundary is only one kind of trust boundary. Untrusted document text entering a privileged agent context also crosses one.
- **Learn it:** [Jailbreak Taxonomy](../phases/19-capstone-projects/82-jailbreak-taxonomy/)
- **Related terms:** Threat Model, Least Privilege, Sandbox, Indirect Prompt Injection
- **Sources:** [Microsoft Learn: Trust Boundary, the Trust Zone Change Element](https://learn.microsoft.com/en-us/training/modules/tm-create-a-threat-model-using-foundational-data-flow-diagram-elements/6-trust-boundary-the-trust-zone-change-element); [OWASP Threat Modeling](https://owasp.org/www-community/Threat_Modeling)

## U

### Underfitting
- **Category:** Math & training
- **What people say:** The model cannot fit the training task well enough.
- **What it actually means:** A model or training setup has insufficient effective capacity, optimization, features, or training signal to capture useful patterns in the training data.
- **In practice:** Diagnose data and optimization first, then consider training longer, changing features, reducing excessive regularization, or increasing suitable capacity.
- **Related terms:** Overfitting, Loss Function, Hyperparameter

## V

### VAE (Variational Autoencoder)
- **Category:** Models & inference
- **What people say:** A probabilistic generative autoencoder.
- **What it actually means:** A latent-variable model trained with a reconstruction objective and a regularization term that keeps an approximate posterior close to a chosen prior. The reparameterization estimator allows gradients through stochastic latent sampling.
- **Common confusion:** A VAE does not force every latent distribution to one fixed Gaussian; the exact prior and approximate posterior are modeling choices.
- **Sources:** [Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)
- **Related terms:** Latent Space, Encoder, Decoder, Diffusion Model

### Vector Database
- **Category:** Retrieval & generation
- **What people say:** A database optimized for vector similarity search.
- **What it actually means:** A storage and indexing system that supports nearest-neighbor queries over vector representations, often with metadata filtering, persistence, and approximate indexes.
- **Common confusion:** A vector database stores and searches vectors. It does not create high-quality embeddings or guarantee relevant retrieval.
- **Related terms:** Embedding, Semantic Search, Hybrid Retrieval

### Verification Gate
- **Category:** Evaluation & safety
- **What it actually means:** A control point that blocks progress until defined evidence satisfies a correctness or quality criterion.
- **Why it matters:** It converts a model's claim of completion into an evidence-backed decision.
- **In practice:** Prevent a coding task from completing until the patch applies, scoped tests pass, forbidden files remain unchanged, and required artifacts exist.
- **Common confusion:** Verification checks whether evidence meets criteria. Approval grants authority to proceed, even when the evidence is already known.
- **Learn it:** [Verification Gates](../phases/14-agent-engineering/38-verification-gates/)
- **Related terms:** Approval Gate, Regression Test, Scope Contract, Structured Output

### Vision-Language Model (VLM)
- **Category:** Multimodal systems
- **What it actually means:** A model that learns relationships between, or jointly processes, visual and language representations for tasks such as retrieval, description, question answering, or grounded generation.
- **Why it matters:** VLM performance depends on the visual encoder, language component, connection mechanism, training data, and resolution policy rather than one generic capability label.
- **In practice:** Evaluate text-only and vision-only controls, vary image resolution and layout, require evidence localization where possible, and report failures by visual skill and language.
- **Common confusion:** Accepting an image does not prove the model uses it correctly, and a VLM is not necessarily able to generate images.
- **Learn it:** [Vision-Language Models](../phases/04-computer-vision/25-vision-language-models/)
- **Related terms:** Multimodal Model, Vision Transformer (ViT), Cross-Attention, Visual Grounding
- **Sources:** [CLIP](https://arxiv.org/abs/2103.00020); [Flamingo](https://arxiv.org/abs/2204.14198)

### Vision Transformer (ViT)
- **Category:** Multimodal systems
- **What it actually means:** A vision architecture that represents an image as a sequence of patch embeddings with position information and processes that sequence with transformer encoder blocks.
- **Why it matters:** It provides a sequence-model interface for visual data, but performance and compute depend on patch size, resolution, pretraining, and inductive biases.
- **In practice:** Keep patching and normalization consistent with training, account for position-embedding behavior at new resolutions, and compare against a suitable visual baseline on the target dataset.
- **Common confusion:** ViT is an architecture family, not every transformer that accepts images, and its patches are not inherently semantic objects.
- **Learn it:** [Vision Transformers](../phases/04-computer-vision/14-vision-transformers/)
- **Related terms:** Transformer, Patch Embedding, Self-Attention, Encoder
- **Sources:** [An Image is Worth 16x16 Words](https://arxiv.org/abs/2010.11929)

### Visual Grounding
- **Category:** Multimodal systems
- **What it actually means:** Connecting a language expression to spatial evidence in an image or video, such as a region, object, mask, or tracked entity.
- **Why it matters:** A fluent visual answer can be unsupported, while grounding makes the claimed referent inspectable and enables region-level evaluation.
- **In practice:** Require a box, mask, or temporal segment with the answer, test ambiguous and absent referents, and score localization separately from language correctness.
- **Common confusion:** Visual grounding identifies where the referenced evidence is. General image captioning can describe a scene without localizing each claim.
- **Learn it:** [Cross-Attention Fusion](../phases/19-capstone-projects/61-cross-attention-fusion/)
- **Related terms:** Grounding, Vision-Language Model (VLM), Attention, Evaluation (Eval)
- **Sources:** [MDETR](https://arxiv.org/abs/2104.12763)

### Vocabulary
- **Category:** Data & representations
- **What it actually means:** The finite mapping between token identifiers and the units a tokenizer can emit, including ordinary, byte-level, and special control tokens.
- **Why it matters:** Vocabulary design affects sequence length, multilingual coverage, code representation, embedding size, and compatibility between tokenizers and model weights.
- **In practice:** Version the vocabulary and special-token assignments with the model, test encode-decode round trips, and never substitute a tokenizer with merely similar token names.
- **Common confusion:** A model vocabulary is not a dictionary of human words; many entries are fragments, bytes, whitespace patterns, or control symbols.
- **Related terms:** Tokenization, Byte Pair Encoding (BPE), Token, Embedding
- **Sources:** [Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909)

## W

### Warmup
- **Category:** Math & training
- **What it actually means:** An initial training phase in which the learning rate rises from a smaller value toward the main schedule's target value.
- **Why it matters:** Early gradients and optimizer statistics can be unstable, especially in large-batch or transformer training, so abrupt full-size updates may damage optimization.
- **In practice:** Define warmup in steps or processed tokens, log the realized curve, and tune it with the batch, optimizer, and total training budget held visible.
- **Common confusion:** Warmup is not required for every model and does not make an otherwise unsuitable learning rate safe.
- **Related terms:** Learning Rate Schedule, Learning Rate, Batch Size, AdamW
- **Sources:** [Accurate, Large Minibatch SGD](https://arxiv.org/abs/1706.02677)

### Weight
- **Category:** Math & training
- **What people say:** A learned number inside a model.
- **What it actually means:** A trainable coefficient in a model transformation. Weights are usually organized into tensors, and optimization adjusts them to reduce the training objective.
- **Common confusion:** Not every parameter is called a weight; biases, embeddings, and normalization scales are parameters too.
- **Related terms:** Parameter, Tensor, Optimizer

### Weight Decay
- **Category:** Math & training
- **What people say:** Regularization that shrinks weights during optimization.
- **What it actually means:** An update rule that reduces selected parameter magnitudes over training, often by multiplying weights by a shrinkage factor separate from the gradient update.
- **Why it matters:** It can improve generalization, but the useful coefficient and excluded parameter groups depend on model, optimizer, schedule, and data.
- **Common confusion:** Decoupled weight decay is equivalent to an L2 loss penalty for some simple optimizers, but not generally for adaptive optimizers such as Adam.
- **Related terms:** AdamW, Overfitting, Optimizer

### Worktree
- **Category:** AI-native development
- **What it actually means:** In Git, a working directory attached to a repository and branch or commit, with shared object storage but its own checked-out files and index.
- **Why it matters:** Separate worktrees let people and agents work concurrently without constantly switching or overwriting one checkout.
- **In practice:** Give each coding agent a named feature branch and exact worktree path, then review and integrate patches through normal Git history.
- **Common confusion:** A worktree isolates checked-out files, not every process, port, cache, database, or secret on the machine.
- **Learn it:** [Workbench for Real Repositories](../phases/14-agent-engineering/41-workbench-for-real-repos/)
- **Sources:** [git-worktree documentation](https://git-scm.com/docs/git-worktree)
- **Related terms:** Coding Agent, Patch, Scope Contract, Handoff

## Z

### Zero-Shot
- **Category:** Prompting & context
- **What people say:** Asking for a task without examples in the current prompt.
- **What it actually means:** Performing a task from instructions or task framing without including task-specific demonstrations in the immediate input.
- **Common confusion:** Zero-shot does not mean the model had no relevant pretraining, instruction tuning, tools, or retrieved context.
- **Related terms:** Few-Shot, Prompt Engineering, Transfer Learning

### Zero Trust
- **Category:** Security & governance
- **What it actually means:** A security model that grants no implicit trust from network location or asset ownership and instead evaluates each access request against identity, device, resource, policy, and current context.
- **Why it matters:** AI tools and agents span local files, cloud services, models, and external content, so a trusted internal network is too broad a basis for authority.
- **In practice:** Authenticate every actor and workload, authorize each resource action, issue short-lived credentials, segment access, and continuously record and reevaluate policy-relevant signals.
- **Common confusion:** Zero trust does not mean trusting nothing or blocking all automation. It means making trust decisions explicit, scoped, and continuously verifiable.
- **Learn it:** [Security, Secrets, and Audit](../phases/17-infrastructure-and-production/25-security-secrets-audit/)
- **Related terms:** Least Privilege, Trust Boundary, Approval Gate, Audit Log
- **Sources:** [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final)
