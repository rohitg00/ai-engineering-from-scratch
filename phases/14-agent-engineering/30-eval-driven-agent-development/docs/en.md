# Eval 駆動エージェント開発

> Anthropic の指針: 「simple prompts から始め、comprehensive evaluation で最適化し、multi-step agentic systems は必要になったときだけ追加する」。evaluation は最後の step ではない。Phase 14 のあらゆる選択を駆動する outer loop である。

**種類:** 学習 + 構築
**言語:** Python (stdlib)
**前提:** Phase 14 全体。
**時間:** 約60分

## 学習目標

- 3 つの evaluation layers — static benchmarks、custom offline、online production — と、それぞれの目的を挙げる。
- evaluator-optimizer tight loop を説明する。
- 2026 年の best practice を説明する: evals は code の隣に置き、CI で実行し、PR を gate する。
- Phase 14 のすべての lesson を、それが生成する eval case に接続する。

## 問題

Agents は demos を通過する。しかし demos では予測できない形で production で失敗する。Benchmarks が答えるのは「この model は広く有能か」であり、「この agent は自分の product に正しい patches を出荷しているか」ではない。答えは、3 layers の evaluation を継続的に走らせ、すべての guardrail と learned rule を eval case に対応づけることである。

## コンセプト

### 3 つの evaluation layers

1. **Static benchmarks** — code には SWE-bench Verified (Lesson 19)、browsing / desktop には WebArena/OSWorld (Lesson 20)、generalist には GAIA (Lesson 19)、tool use には BFCL V4 (Lesson 06)。cross-model comparison と regression gating に使う。contamination は現実にある。SWE-bench+ は 32.67% の solution leakage を見つけた。常に Verified / +-audited scores を報告する。

2. **Custom offline evals** — 自分の product の shape:
   - LLM-as-judge (Langfuse, Phoenix, Opik — Lesson 24)。
   - Execution-based (patch を実行し、tests を確認する)。
   - Trajectory-based (action sequences を gold と比較する。OSWorld-Human は top agents が gold に対して 1.4-2.7x であることを示す)。

3. **Online evals** — production:
   - Session replays (Langfuse)。
   - Guardrail-triggered alerts (Lesson 16, 21)。
   - step ごとの cost / latency tracking (Lesson 23 OTel spans)。

### Evaluator-optimizer (Anthropic)

tight loop:

1. Proposer が output を生成する。
2. Evaluator が判定する。
3. evaluator が pass するまで refine する。

これは Self-Refine (Lesson 05) を一般化したもの。重要な agent flow は、reliability のため evaluator-optimizer で包める。

### 2026 年の best practice

- Evals は code の隣に置く。
- すべての PR で CI から実行する。
- eval scores で merge を gate する (例: "no regression > 5% vs main")。
- すべての guardrail は eval case に map する。
- すべての learned rule (Reflexion, pro-workflow learn-rule) は failure case に map する。

### Phase 14 をつなげる

Phase 14 の各 lesson は eval cases を生成する。

| Lesson | 生成される eval case |
|--------|----------------------|
| 01 Agent Loop | Budget-exhausted、infinite-loop guard |
| 02 ReWOO | tool failure 時に planner が正しく replan する |
| 03 Reflexion | retry 時に learned reflections が適用される |
| 05 Self-Refine/CRITIC | refined output を judge が pass する |
| 06 Tool Use | argument coercion が動く。unknown tools が rejected される |
| 07-10 Memory | retrieval citations が sources と一致する。stale facts が invalidate される |
| 12 Workflow Patterns | 各 pattern が correct output を生成する |
| 13 LangGraph | resume が state を正確に再現する |
| 14 AutoGen Actors | DLQ が crashed handlers を捕まえる |
| 16 OpenAI Agents SDK | guardrail が正しい inputs で発火する |
| 17 Claude Agent SDK | subagent results が orchestrator に戻る |
| 19-20 Benchmarks | SWE-bench Verified score、WebArena success rate、OSWorld efficiency |
| 21 Computer Use | per-step safety が injected DOM を捕まえる |
| 23 OTel | spans が required attributes を emit する |
| 26 Failure Modes | detectors が known failures を tag する |
| 27 Prompt Injection | PVE が poisoned retrievals を拒否する |
| 28 Orchestration | supervisor が正しい specialist に route する |
| 29 Runtime Shapes | DLQ が N% failure を処理する |

eval suite がそれぞれの case を持っていれば、Phase 14 をカバーしている。

### eval-driven development が失敗するところ

- **baseline がない。** last-known-good のない evals は読めない。baselines を保存する。
- **grounding なしの LLM-judge。** judges も hallucinate する。CRITIC pattern (Lesson 05) — judge は external tools に grounding する。
- **evals への over-fitting。** eval を最適化すると production usefulness から乖離する。cases を rotate する。
- **flaky evals。** non-deterministic cases は false alarms を生む。seeds を固定し、state を snapshot する。

## 構築

`code/main.py` は stdlib の eval harness である。

- categories (benchmark, custom, online) を持つ case registry。
- test 対象の scripted agent。
- Evaluator-optimizer loop: propose、judge、pass または max rounds まで refine。
- CI gate: aggregate pass rate + baseline に対する regression。

実行:

```
python3 code/main.py
```

出力: case ごとの pass/fail、regression flag、CI gate verdict。

## 利用

- eval cases を agent code と同じ repo に書く。
- すべての PR で CI から実行する。
- regression で build を失敗させる。
- pass rate を経時的に追跡する。
- production failure はすべて新しい case に結びつける。

## 出荷

`outputs/skill-eval-suite.md` は、CI gates と regression tracking を備えた agent product 向け three-layer eval suite を構築する。

## 演習

1. 自分の production failures の 1 つを選ぶ。それを再現する eval case を書く。自分の agent は今それに pass するか。
2. domain 向けに 3 dimensions (factual, tone, scope) の LLM-judge rubric を作る。50 sessions を採点する。
3. eval suite を CI に接続する。>=5% regression で build を失敗させる。
4. trajectory-efficiency metric を追加する。agent は gold trajectory に比べて何 steps 使ったか。
5. Phase 14 のすべての lesson を自分の suite の eval case に map する。抜けているものはあるか。それは埋めるべき gap。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | 自分の product shape 上の LLM-as-judge / exec / trajectory |
| Online eval | "Production eval" | session replay、guardrail alerts、cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | judge が pass するまで iterate する |
| CI gate | "Merge blocker" | eval regression で build を fail させる |
| Baseline | "Last-known-good" | regression を検出するための reference score |
| Trajectory efficiency | "Steps over gold" | human expert minimum で割った agent step count |

## 参考文献

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — "start simple, optimize with evals"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — curated benchmark
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) — tool-use benchmark
- [Langfuse docs](https://langfuse.com/) — evals + session replay in practice
