# Capstone 17 — Personal AI Tutor (Adaptive, Multimodal, with Memory)

> Khanmigo (Khan Academy), Duolingo Max, Google LearnLM / Gemini for Education, Quizlet Q-Chat, and Synthesis Tutor all shipped adaptive multimodal tutoring at scale in 2026. The common shape is a Socratic policy (never just dump the answer), a learner model that updates after every interaction (Bayesian knowledge tracing style), voice + text + photo-math input, curriculum graph retrieval, spaced-repetition scheduling, and hard safety filters for age-appropriate content. The capstone is to ship a subject-specific tutor (K-12 algebra or intro Python), run a two-week efficacy study with 10 learners, and pass a content-safety audit.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## Problem

Adaptive tutoring used to be an ed-tech research niche. By 2026 it is a consumer product. Khanmigo is deployed across most US school districts. Duolingo Max hit tens of millions of MAUs. Google's LearnLM / Gemini for Education powers tutoring in Google Classroom. Quizlet Q-Chat sits alongside flashcards. Synthesis Tutor hit virality with tutor-for-curious-kids. The common elements: multimodal input (type, speak, photograph equations), Socratic pedagogy (ask first, explain later), a learner model that updates after each interaction, and strict age-appropriate safety.

You will build one of these for a specific cohort. The measurement bar is an actual efficacy study: pre-test and post-test scores over two weeks with 10 learners. The voice loop must feel natural (capstone 03 sub-stack). The memory must be privacy-respecting. The safety filter must pass COPPA-aware red-team for K-12.

## Concept

Four components. **Tutor policy** is a Socratic loop: when the learner asks for the answer, the policy asks a leading question; when they get it right, it moves to the next concept; when they are stuck, it offers a scaffolded hint. **Learner model** is Bayesian knowledge tracing (or a simple variant) that updates mastery probability per curriculum node after each interaction. **Curriculum graph** is a Neo4j of concepts with prerequisite edges; the policy walks the graph to pick the next concept. **Memory** is an episodic + semantic store (agentmemory-style) holding past interactions, mistakes, and preferences.

The UX is multimodal. Text input for typed answers. Voice input via LiveKit + Whisper (reuse capstone 03). Photo input for math problems via dots.ocr or PaliGemma 2. Voice output via Cartesia Sonic-2. Safety uses Llama Guard 4 plus an age-appropriate filter (blocks adult content, violence, self-harm) and a COPPA-aware memory retention policy.

The efficacy study is the deliverable. 10 learners, pre-test and post-test, two weeks. Report learning gain delta and confidence interval. Compare against a non-adaptive baseline (the same content delivered linearly without the tutor policy).

## Architecture

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## Stack

- Subject choice: K-12 algebra or intro Python (pick one for depth)
- Tutor policy: LangGraph over Claude Sonnet 4.7 (with prompt caching)
- Learner model: Bayesian knowledge tracing (classic) or FSRS for spacing
- Curriculum graph: Neo4j of concepts + prerequisite edges + OER content
- Memory: agentmemory-style persistent vector + episodic + semantic store
- Voice: LiveKit Agents 1.0 + Cartesia Sonic-2 (reuse capstone 03 sub-stack)
- Photo math: dots.ocr or PaliGemma 2 for equation recognition
- Safety: Llama Guard 4 + custom age-appropriate filter
- Eval: Bloom-level question generation, pre/post test harness, efficacy study tooling

## Build It

1. **Curriculum graph.** Build a Neo4j of 50-150 concept nodes (e.g., K-12 algebra from "number line" to "quadratic formula") with prerequisite edges. Attach OER content per node (Open Textbook, OpenStax).

2. **Learner model.** Initialize Bayesian knowledge tracing with priors: guess, slip, learn-rate. Update per-concept mastery after each interaction. Persist per learner.

3. **Tutor policy.** LangGraph with nodes: `read_signal` (was the learner's answer correct / partial / stuck?), `select_concept` (walk curriculum graph picking the highest-priority concept), `scaffold` (Socratic prompt), `update_mastery`.

4. **Memory.** Every interaction writes to an episodic store. Mistakes and preferences promote to semantic memory. COPPA-aware retention policy: auto-delete after 1 year, parent-accessible.

5. **Voice path.** LiveKit Agents worker attached to the tutor policy. ASR via Whisper-v3-turbo. TTS via Cartesia Sonic-2. Barge-in supported (reuse capstone 03 mechanics).

6. **Photo-math path.** Upload or capture image; run dots.ocr or PaliGemma 2 to recognize the equation; feed to tutor as structured input.

7. **Safety.** Every model output passes Llama Guard 4 + an age-appropriate filter (blocks self-harm, adult content, violence). Memory access scoped by learner ID; parental access surface for deletion.

8. **Efficacy study.** 10 learners, pre-test (standardized 30-question baseline), two weeks of tutor interaction (3 sessions/week), post-test. Compare against a non-adaptive baseline cohort of 10 learners on the same content.

9. **Weekly progress reports.** Per learner, auto-generate a PDF summary of topics explored, mastery trajectories, and recommended next steps.

## Use It

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## Ship It

`outputs/skill-ai-tutor.md` is the deliverable. A subject-specific adaptive tutor with multimodal input, a learner model, memory, safety, and measured efficacy.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## Exercises

1. Run the efficacy study with and without the adaptive learner model (random concept order). Report the delta. Expect adaptive to win, but the size is the interesting number.

2. Add a multimodal probe: the same concept question delivered as text, voice, and photo. Measure whether learners converge faster with the modality they prefer.

3. Build a parent dashboard: topics practiced, mastery trajectories, upcoming concepts, safety events (any guardrail hits). COPPA-aligned.

4. Add a language-switch mode: the tutor accepts Spanish input and teaches in Spanish. Measure X-Guard coverage.

5. Stress the memory privacy: verify that learner A cannot see learner B's data even through a voice-clip re-ingest attack. Log the attempted access and alert.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## Further Reading

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) — reference consumer K-12 tutor
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) — reference language-learning tutor
- [Google LearnLM / Gemini for Education](https://blog.google/technology/google-deepmind/learnlm) — hosted reference model
- [Quizlet Q-Chat](https://quizlet.com) — alternate reference
- [Synthesis Tutor](https://www.synthesis.com) — startup reference
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) — spaced-repetition scheduler
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) — learner-model classic
- [LiveKit Agents](https://github.com/livekit/agents) — voice stack
