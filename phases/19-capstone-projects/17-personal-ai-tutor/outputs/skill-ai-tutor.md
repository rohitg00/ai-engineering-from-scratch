---
name: ai-tutor
description: Bayesian knowledge tracing、curriculum graph、safety filters、measured two-week efficacy study を備えた subject-specific adaptive multimodal personal tutor を ship する。
version: 1.0.0
phase: 19
lesson: 17
tags: [capstone, tutor, adaptive, bkt, fsrs, livekit, multimodal, coppa]
---

Subject (K-12 algebra または intro Python) を選び、text + voice + photo-math input、Bayesian knowledge tracing learner model、curriculum-graph-driven concept selection、COPPA-aware memory、safety filter を持つ personal tutor を構築する。10 人の learner で 2 週間の efficacy study を実行する。

Build plan:

1. Neo4j の curriculum graph: prerequisite edge と attached OER content (OpenStax、Open Textbook) を持つ 50-150 concept node。
2. Learner model: concept ごとの guess/slip/learn-rate prior を持つ Bayesian knowledge tracing。Learner ごとに state を persist。
3. Tutor policy (prompt caching 付き Claude Sonnet 4.7 上の LangGraph): read_signal -> select_concept (graph walk) -> scaffold (Socratic) -> update_mastery。
4. Memory: agentmemory-style persistent episodic + semantic store。COPPA-aware auto-delete after 1 year。Parent-accessible deletion。
5. Voice: Whisper-v3-turbo ASR と Cartesia Sonic-2 TTS を持つ LiveKit Agents worker。Capstone 03 pipeline を再利用。
6. Photo math: equation recognition 用 dots.ocr または PaliGemma 2。Structured input を tutor に渡す。
7. Safety: Llama Guard 4 input/output、self-harm/adult/violence を block する age-appropriate filter、learner-scoped memory isolation。
8. Learner ごとの weekly PDF progress report。
9. Efficacy study: 10 learners、pre-test (standardized 30-question baseline)、2 weeks of sessions (3/week)、post-test。Non-adaptive linear cohort と比較。

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Learning gain delta | 10-learner 2-week study における pre/post-test delta |
| 20 | Socratic fidelity | Transcript sample に対する rubric score |
| 20 | Multimodal UX | Voice + photo + text の end to end coherence |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention + cross-learner isolation |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |

Hard rejects:

- 次の question を返さず answer-dump する tutor policy。Socratic は hard requirement。
- Interaction ごとに更新されない learner model。BKT は最低ライン。
- COPPA-aware retention のない memory。K-12 audience では許容不可。
- Non-adaptive baseline cohort なしの efficacy claim。

Refusal rules:

- Input と output の両方に Llama Guard 4 がなければ deploy しない。
- Parent-accessible deletion surface なしで learner data を persist しない。
- Non-adaptive baseline を並走させずに "adaptive" と主張しない。

Output: curriculum graph、BKT learner model、LangGraph tutor policy、multimodal input handlers、LiveKit voice pipeline、safety pipeline、parental dashboard、efficacy-study runner、pre/post test harness、linear baseline に対する learning gain delta と confidence interval を記した write-up を含む repo。
