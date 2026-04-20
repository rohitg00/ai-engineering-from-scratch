# AI Myths Busted

Common misconceptions about AI, ML, and deep learning. Each one explained with what's actually going on.

---

## "AI understands language"

**Reality:** LLMs predict the next token based on statistical patterns in training data. They have no understanding, no beliefs, no world model (that we can prove). They're very good at pattern matching across billions of examples. The output looks like understanding because the patterns are rich enough to cover most situations.

**Why it matters:** If you treat an LLM as a reasoning engine, you'll be surprised when it confidently says wrong things. If you treat it as a pattern matcher, you'll design better systems around it.

---

## "More parameters = smarter model"

**Reality:** A 7B parameter model trained on high-quality data with good techniques can outperform a 70B model trained on garbage. Chinchilla showed that most models were over-parameterized and under-trained. The quality and quantity of training data matters as much as model size. Phi-2 (2.7B) beat models 10x its size on many benchmarks.

**Why it matters:** Don't default to the biggest model. Match model size to your task and budget.

---

## "Neural networks are black boxes"

**Reality:** We have tools to understand what neural networks learn. Attention visualization shows what tokens the model focuses on. Probing classifiers reveal what information is stored in hidden representations. Mechanistic interpretability is finding actual circuits (induction heads, feature detectors). It's not complete transparency, but it's not a black box either.

**Why it matters:** You can debug neural networks. Gradient analysis, activation visualization, and attention maps are real tools covered in this course.

---

## "AI will replace programmers"

**Reality:** AI changed programming, it didn't replace it. AI writes boilerplate. Humans design systems, make architectural decisions, review correctness, and handle the cases AI gets wrong. The role shifted from "write every line" to "review, direct, and architect." The best engineers use AI as a tool, not fear it as a replacement.

**Why it matters:** You're learning AI engineering, which is programming + AI. Both skills together are more valuable than either alone.

---

## "You need a PhD in math to do AI"

**Reality:** You need high school math plus the specific topics in Phase 1 of this course. Linear algebra, calculus, probability, and optimization. You don't need proofs. You need intuition for what operations do and why they matter. If you can multiply matrices and take derivatives, you can build neural networks.

**Why it matters:** Phase 1 exists to give you exactly the math you need, nothing more.

---

## "GPT stands for General Purpose Technology"

**Reality:** GPT stands for Generative Pre-trained Transformer. Generative = it produces text. Pre-trained = trained once on a large corpus before being adapted. Transformer = the architecture from the 2017 "Attention Is All You Need" paper.

---

## "Temperature makes the AI more creative"

**Reality:** Temperature scales the logits before softmax. Higher temperature = flatter probability distribution = more random token selection. Lower temperature = sharper distribution = more deterministic. It's not creativity, it's randomness. A high-temperature model doesn't think harder, it just considers less likely tokens.

**Why it matters:** When your output is too repetitive, raise temperature. When it's too chaotic, lower it. It's a randomness knob, nothing more.

---

## "Fine-tuning teaches the model new knowledge"

**Reality:** Fine-tuning adjusts how the model uses existing knowledge, not what it knows. If information wasn't in the pre-training data, fine-tuning won't reliably add it. Fine-tuning is better for changing behavior (style, format, tone, task-specific patterns) than for adding facts. For new knowledge, use RAG.

**Why it matters:** If you need the model to know about your company's internal docs, use RAG. If you need it to respond in a specific format, fine-tune.

---

## "Bigger context window = better"

**Reality:** Models degrade on long contexts. The "lost in the middle" problem means models pay more attention to the beginning and end of long prompts and less to the middle. A 200K context window doesn't mean the model uses all 200K tokens equally well. Also, longer contexts cost more and are slower.

**Why it matters:** Don't dump everything into the context. Be selective. RAG with targeted retrieval beats stuffing the full document in.

---

## "AI agents are autonomous"

**Reality:** Current AI agents run in a loop: think, act, observe, repeat. They follow the pattern the harness defines. They don't have goals, plans, or self-awareness. They're reactive systems that use LLMs to decide what tool to call next. The "autonomy" comes from the loop, not from the AI.

**Why it matters:** When building agents, you're building the loop, the tools, and the guardrails. The LLM is just the decision-making component inside your system.

---

## "Transformers understand order because of positional encoding"

**Reality:** Transformers have no inherent sense of order. Self-attention treats input as a set, not a sequence. Positional encoding is a hack to inject order information by adding position-dependent vectors to the input. Different methods (sinusoidal, learned, RoPE, ALiBi) handle this differently. None of them truly give the model sequential understanding the way RNNs had it.

**Why it matters:** This is why positional encoding research is still active. It's a solved-enough problem for most uses, but it's fundamentally a workaround.

---

## "Pre-training is just reading the internet"

**Reality:** Pre-training is next-token prediction on a massive corpus. The model learns to predict what comes next given what came before. Through this simple objective, it learns grammar, facts, reasoning patterns, code structure, and more. But it also learns internet nonsense, biases, and incorrect information. The data curation, filtering, and deduplication matter enormously.

**Why it matters:** Garbage in, garbage out. The quality of pre-training data is one of the biggest differentiators between models.

---

## "RLHF aligns AI with human values"

**Reality:** RLHF aligns AI with the preferences of the specific humans who provided feedback. Those humans disagree with each other, have biases, and can't cover every situation. RLHF makes the model helpful and harmless in the ways the raters defined, not aligned with some universal human value system.

**Why it matters:** RLHF is a training technique, not a solution to alignment. It's one tool in a larger toolkit.

---

## "Embeddings capture meaning"

**Reality:** Embeddings capture statistical co-occurrence patterns. Words that appear in similar contexts get similar vectors. This correlates with meaning well enough to be useful, but it's not semantic understanding. "King - Man + Woman = Queen" works because of distributional patterns, not because the model understands monarchy or gender.

**Why it matters:** Embeddings are powerful for similarity search, clustering, and retrieval. But don't over-interpret what "similar" means.

---

## "Zero-shot means no training"

**Reality:** Zero-shot means no task-specific examples at inference time. The model was still trained on billions of tokens. It just hasn't seen examples of this specific task format. It generalizes from pre-training patterns. Few-shot means giving a few examples in the prompt. Neither means the model learned without training.

---

## "AI models learn like humans"

**Reality:** Humans learn from few examples, generalize across domains, and update beliefs continuously. Neural networks need millions of examples, generalize within their training distribution, and have fixed weights after training. The learning analogy is loose at best. Backpropagation is nothing like how biological neurons learn.

**Why it matters:** Don't anthropomorphize models. It leads to wrong expectations about what they can and can't do.

---

## "Scaling laws mean bigger is always better"

**Reality:** Scaling laws describe predictable relationships between compute, data, and model size. They show diminishing returns: doubling parameters doesn't double performance. They also assume you scale data proportionally. Many practical improvements come from better architectures, training techniques, and data quality, not just scale.

**Why it matters:** A 7B model with good engineering can solve your problem. Don't reach for 70B by default.

---

## "Open source AI is the same as open weights"

**Reality:** Most "open source" models are open weights. You get the model files but not the training data, training code, or data pipeline. True open source (like OLMo) releases everything: data, code, intermediate checkpoints, evaluation. Open weights is useful but not the same commitment as open source.

**Why it matters:** Know what you're getting. Open weights let you run and fine-tune. True open source lets you reproduce and understand.

---

## "Prompt engineering is not real engineering"

**Reality:** Prompt engineering is system design. You're designing the interface between human intent and model behavior. Good prompt engineering requires understanding tokenization, attention patterns, context window limits, and output parsing. It's closer to API design than to "talking nicely to the AI."

**Why it matters:** This course teaches prompt engineering as a real engineering discipline in Phase 11.

---

## "CNNs are outdated, everything is transformers now"

**Reality:** Vision Transformers (ViT) beat CNNs on many benchmarks, but CNNs are still used extensively. They're faster for inference, work well on mobile/edge, need less data, and have useful inductive biases (translation invariance, local patterns). Many production vision systems still use CNNs. The best architectures often combine both.

**Why it matters:** Learn both (Phases 4 and 7). Use what works for your constraints.

---

## "You need massive compute to train useful models"

**Reality:** You need massive compute to pre-train foundation models. But fine-tuning, LoRA, and transfer learning let you adapt models on a single GPU. Many useful AI applications don't require training at all, just good prompting and RAG. The "compute barrier" is for building foundation models, not for using them.

**Why it matters:** You can build real AI applications with a laptop. This course proves it.
