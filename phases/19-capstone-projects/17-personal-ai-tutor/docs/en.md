# キャップストーン 17 — Personal AI Tutor (Adaptive, Multimodal, with Memory)

> Khanmigo (Khan Academy)、Duolingo Max、Google LearnLM / Gemini for Education、Quizlet Q-Chat、Synthesis Tutor は、2026 年に adaptive multimodal tutoring を大規模に提供した。共通する形は、Socratic policy (答えをただ出さない)、interaction ごとに更新される learner model (Bayesian knowledge tracing 風)、voice + text + photo-math input、curriculum graph retrieval、spaced-repetition scheduling、age-appropriate content 用の hard safety filter である。この capstone では、subject-specific tutor (K-12 algebra または intro Python) を ship し、10 人の learner で 2 週間の efficacy study を行い、content-safety audit を pass する。

**種類:** Capstone
**言語:** Python (backend, learner model)、TypeScript (web app)、SQL (curriculum graph via Postgres + Neo4j)
**前提:** Phase 5 (NLP)、Phase 6 (speech)、Phase 11 (LLM engineering)、Phase 12 (multimodal)、Phase 14 (agents)、Phase 17 (infrastructure)、Phase 18 (safety)
**演習対象フェーズ:** P5 · P6 · P11 · P12 · P14 · P17 · P18
**時間:** 30 時間

## 問題

Adaptive tutoring は以前 ed-tech research の niche だった。2026 年には consumer product になっている。Khanmigo は米国の大半の school district に導入されている。Duolingo Max は tens of millions of MAUs に到達した。Google LearnLM / Gemini for Education は Google Classroom の tutoring を支えている。Quizlet Q-Chat は flashcard と並んで使われる。Synthesis Tutor は tutor-for-curious-kids として viral になった。共通要素は、multimodal input (type、speak、photograph equations)、Socratic pedagogy (先に問い、後で説明する)、interaction ごとに更新される learner model、厳格な age-appropriate safety である。

あなたは特定 cohort 向けにこれを構築する。測定基準は実際の efficacy study である。10 人の learner に対し、2 週間の pre-test と post-test score を測る。Voice loop は自然に感じられる必要がある (capstone 03 sub-stack)。Memory は privacy-respecting でなければならない。Safety filter は K-12 向けの COPPA-aware red-team を pass する必要がある。

## コンセプト

4 つの component がある。**Tutor policy** は Socratic loop である。Learner が答えを求めたら leading question を返す。正解したら次の concept に進む。詰まっていたら scaffolded hint を出す。**Learner model** は Bayesian knowledge tracing (または簡単な variant) で、interaction ごとに curriculum node ごとの mastery probability を更新する。**Curriculum graph** は prerequisite edge を持つ concept の Neo4j であり、policy は graph を walk して次の concept を選ぶ。**Memory** は agentmemory-style の episodic + semantic store で、過去の interaction、mistake、preference を保持する。

UX は multimodal である。Typed answer 用 text input。LiveKit + Whisper を使う voice input (capstone 03 を再利用)。Math problem 用 photo input は dots.ocr または PaliGemma 2。Voice output は Cartesia Sonic-2。Safety は Llama Guard 4 と age-appropriate filter (adult content、violence、self-harm を block) と COPPA-aware memory retention policy を使う。

Efficacy study が提出物である。10 人の learner、pre-test と post-test、2 週間。Learning gain delta と confidence interval を報告する。Non-adaptive baseline (同じ content を tutor policy なしで linear に提供) と比較する。

## アーキテクチャ

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

## スタック

- Subject choice: K-12 algebra または intro Python (depth のため 1 つ選ぶ)
- Tutor policy: Claude Sonnet 4.7 上の LangGraph (prompt caching 使用)
- Learner model: Bayesian knowledge tracing (classic) または spacing 用 FSRS
- Curriculum graph: concept + prerequisite edge + OER content の Neo4j
- Memory: agentmemory-style persistent vector + episodic + semantic store
- Voice: LiveKit Agents 1.0 + Cartesia Sonic-2 (capstone 03 sub-stack を再利用)
- Photo math: equation recognition 用 dots.ocr または PaliGemma 2
- Safety: Llama Guard 4 + custom age-appropriate filter
- Eval: Bloom-level question generation、pre/post test harness、efficacy study tooling

## 実装

1. **Curriculum graph.** 50-150 concept node の Neo4j を作る (例: K-12 algebra の "number line" から "quadratic formula" まで)。Prerequisite edge を張る。Node ごとに OER content (Open Textbook、OpenStax) を付ける。

2. **Learner model.** Guess、slip、learn-rate の prior を持つ Bayesian knowledge tracing を初期化する。Interaction ごとに concept mastery を更新する。Learner ごとに persist する。

3. **Tutor policy.** LangGraph node: `read_signal` (learner answer が correct / partial / stuck か)、`select_concept` (curriculum graph を walk して highest-priority concept を選ぶ)、`scaffold` (Socratic prompt)、`update_mastery`。

4. **Memory.** すべての interaction を episodic store に書く。Mistake と preference は semantic memory に promote する。COPPA-aware retention policy: 1 年後に auto-delete、parent-accessible。

5. **Voice path.** Tutor policy に接続した LiveKit Agents worker。ASR は Whisper-v3-turbo。TTS は Cartesia Sonic-2。Barge-in を support する (capstone 03 mechanics を再利用)。

6. **Photo-math path.** Image を upload または capture し、dots.ocr または PaliGemma 2 で equation を認識し、structured input として tutor に渡す。

7. **Safety.** すべての model output は Llama Guard 4 + age-appropriate filter (self-harm、adult content、violence を block) を通す。Memory access は learner ID で scope する。Parental access surface で deletion を提供する。

8. **Efficacy study.** 10 人の learner、pre-test (standardized 30-question baseline)、2 週間の tutor interaction (3 sessions/week)、post-test。同じ content を使う non-adaptive baseline cohort 10 人と比較する。

9. **Weekly progress reports.** Learner ごとに、explored topics、mastery trajectories、recommended next steps の PDF summary を自動生成する。

## 使ってみる

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

`outputs/skill-ai-tutor.md` が提出物である。Subject-specific adaptive tutor。Multimodal input、learner model、memory、safety、measured efficacy を備える。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | 10-learner 2-week study における pre/post-test delta |
| 20 | Socratic fidelity | Transcript sample に対する rubric score |
| 20 | Multimodal UX | Voice + photo + text の end to end coherence |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## 演習

1. Adaptive learner model あり/なし (random concept order) で efficacy study を実行する。Delta を報告する。Adaptive が勝つはずだが、重要なのはその大きさである。

2. Multimodal probe を追加する。同じ concept question を text、voice、photo で提示する。Learner が好む modality だと収束が速いかを測る。

3. Parent dashboard を作る: practiced topics、mastery trajectories、upcoming concepts、safety events (guardrail hit があれば)。COPPA-aligned。

4. Language-switch mode を追加する: tutor が Spanish input を受け取り、Spanish で教える。X-Guard coverage を測る。

5. Memory privacy に負荷をかける: voice-clip re-ingest attack を通しても learner A が learner B の data を見られないことを確認する。Attempted access を log し alert する。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| Socratic policy | "Ask, do not dump" | 答えを出すのではなく leading question を返す tutor |
| Bayesian knowledge tracing | "BKT" | Concept ごとの mastery probability を扱う classic learner-model equations |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 年の spaced-repetition scheduler。SM-2 より強い |
| Curriculum graph | "Concept DAG" | prerequisite edge を持つ concept の Neo4j |
| Episodic memory | "Per-interaction log" | 後で retrieve できるよう全 interaction を保存するもの |
| Semantic memory | "Learned pattern store" | Episodic から promote された compacted mistakes と preferences |
| COPPA | "Kids privacy law" | 13 歳未満の子どもからの data collection を制限する米国法 |

## 参考資料

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) — consumer K-12 tutor の参照例
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) — language-learning tutor の参照例
- [Google LearnLM / Gemini for Education](https://blog.google/technology/google-deepmind/learnlm) — hosted reference model
- [Quizlet Q-Chat](https://quizlet.com) — alternate reference
- [Synthesis Tutor](https://www.synthesis.com) — startup reference
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) — spaced-repetition scheduler
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) — learner-model classic
- [LiveKit Agents](https://github.com/livekit/agents) — voice stack
