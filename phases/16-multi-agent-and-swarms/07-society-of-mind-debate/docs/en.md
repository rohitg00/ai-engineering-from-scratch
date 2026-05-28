# Society of Mind と Multi-Agent Debate

> Minsky の 1986 年の前提、つまり intelligence は specialist の society である、という考えは 10 年ごとに再発見されます。2023 年、Du et al. はこれを具体的な algorithm にしました。複数の LLM instance が answer を提案し、互いの answer を読み、critique し、update します。N round の中で consensus に収束し、6 つの reasoning と factuality task で zero-shot CoT と reflection を上回ります。重要な finding は 2 つです。**multiple agents** と **multiple rounds** は独立に効きます。society は single-agent monologue に勝ち、multi-round exchange は one-shot voting に勝ちます。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 04 (Primitive Model)
**所要時間:** 約60分

## 問題

Self-consistency、つまり 1 つの model から多数 sample して majority answer を取る手法は、後付けできる最も安い reasoning improvement です。効きますが、すぐに飽和します。sample を 2 倍にしても、意味のある改善がもう出ないことがあります。

Debate はその飽和を破ります。1 つの model から N 個の independent sample を取る代わりに、N agents が互いの reasoning を読んで revise します。sample 間の correlation は下がり (もはや i.i.d. ではない)、i.i.d. voting が自信満々に間違えた場所で、convergence point が正しいことがあります。

## コンセプト

### Du et al. 2023 algorithm

arXiv:2305.14325 (ICML 2024) より:

1. N agents のそれぞれが question への initial answer を作る。
2. round r = 2..R では、各 agent に他 agents の round r-1 answer を見せ、「これらを踏まえて updated answer を出す」よう求める。
3. R rounds 後、final answer を majority-vote する。

paper は MMLU、GSM8K、biographies、MATH、factuality benchmark で test しています。Debate は一貫して CoT と Self-Reflection を上回ります。

### 独立した 2 つの knob

同じ paper の ablation:

- **Agent count alone** (1 round、N 個の majority vote) は多くの task で single-agent を上回るが、plateau する。
- **Round count alone** (1 agent が自分の prior reasoning を見る) はほとんど効かない。reflection の既知の弱点です。
- **Both together** が大きな jump を生む。複数 agents 間の multi-round exchange が gain を押し上げます。

### なぜ効くのか

mechanism は 2 つです。

1. **Exposure to disagreement.** agent が異なる conclusion を持つ別 agent の reasoning chain を見ると、justify するか update する必要が出ます。どちらにせよ、round r+1 の context は round r より豊かになります。
2. **Correlated error reduction.** self-consistency ではすべての sample が同じ model から来るため、error が correlate します。結果として自信のある wrong answer に平均化されます。異なる model や seed は decorrelate します。異なる *debated views* はさらに decorrelate します。

### Heterogeneous debate

A-HMAD と関連 follow-up は、agent ごとに *different base models* を使います。Llama + Claude + GPT の debate は monoculture collapse (Lesson 26) を減らします。1 つの model family の correlated error が他 family には共有されないからです。

downside: 弱い model が debate に参加すると、consensus を wrong answer 側に引っ張ることがあります ("Should we be going MAD?", arXiv:2311.17371 を参照)。

### NLSOM — 129-agent extension

Zhuge et al. ("Mindstorms in Natural Language-Based Societies of Mind," arXiv:2305.17066) はこの idea を 129-member society に scale しました。結果として、scale とともに specialization と self-organization が emergent し、visual question answering などの task で single-agent を上回りました。

### Failure modes

- **Sycophancy cascade.** すべての agent が最も confident に聞こえる agent に従う。debate は loudest voice に collapse します。adversarial role ("one agent must argue the counter-position") を prompt すると役立ちます。
- **Topic drift.** 多くの round を重ねる debate は original question から drift します。mitigation: 毎 round question を再注入します。
- **Compute blowup.** N agents × R rounds = N·R LLM calls で、各 call の context は増えていきます。5-agent、5-round debate は growing context で 25 calls です。question あたりの cost は single CoT call の 10 倍を超えることがあります。

## 実装

`code/main.py` は、各 agent が異なる (場合によっては wrong な) answer から始める math question で、3-agent × 3-round debate を実行します。agents は scripted です。各 agent は scripted confidence で neighbor の answer を重み付け平均することで「update」します。convergence は round-by-round log で見えます。

demo は 2 つの key effect を示します。

- 1 round の exchange だけで agents は correct answer に近づく。
- round 2 を超える追加 round は diminishing returns を示す (Du et al. の plateau と一致)。

実行:

```
python3 code/main.py
```

## Use It

`outputs/skill-debate-configurator.md` は、新しい task 向けに debate を configure します。agent 数、round 数、heterogeneity (same model vs mixed)、role assignment (symmetric vs one-adversarial) を決め、実行前に token cost も見積もります。

## Ship It

debate を出荷するなら:

- **Cap rounds at 3.** Du et al. は 3 rounds で gain の大半が得られることを示しています。それ以上は quality ではなく cost です。
- **Cap agents at 5.** 5 を超えると context bloat と cost が支配します。
- **Heterogeneous by default.** pool に少なくとも 2 つの different base models を入れます。
- **Adversarial slot.** 1 agent は必ず disagree するよう prompt します。sycophancy を壊します。
- **Log every round.** intermediate round を隠す debate system は debug も audit もできません。

## Exercises

1. `code/main.py` を実行し、round count を 5 にして diminishing returns を観察してください。どの round で追加 convergence が止まりますか。
2. adversarial role を持つ 4 番目の agent を追加してください。常に current majority に disagree します。これは convergence を壊しますか、改善しますか。
3. round ごとの agreement score (majority answer に乗った agent の割合) を plot (print) してください。いつ 1.0 になり、それは「correct」と同義ですか。
4. Du et al. Section 4 の ablation を読んでください。この code を使って "agents-only" vs "rounds-only" vs "both" の結果を replicate してください。
5. "Should we be going MAD?" (arXiv:2311.17371) を読み、round-robin 以外の debate variant を 2 つ挙げてください。例: judge-led、chain-of-debate、adversarial。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Society of Mind | 「Minsky の idea」 | interacting specialists としての intelligence。1986 年の framing が LLM debate で operationalized されたもの。 |
| Multi-agent debate | 「agents が議論する」 | N agents が propose し、互いを critique し、R rounds で revise し、majority-vote する。 |
| Consensus | 「合意した」 | epistemic truth ではない。majority answer にいる割合でしかない。自信を持って wrong になることもある。 |
| Rounds | 「exchange step」 | 1 round = 各 agent が他者を読んで 1 回 update すること。 |
| Heterogeneous debate | 「model family を混ぜる」 | 異なる base models を使って error を decorrelate すること。 |
| Sycophancy cascade | 「全員が声の大きい agent に従う」 | agent が correctness ではなく confidence に従ってしまう debate failure。 |
| NLSOM | 「129-agent society」 | natural-language society of mind。Zhuge et al. の scaled version。 |
| Correlated error | 「same model, same bug」 | self-consistency が飽和する理由。異なる view 間の debate は decorrelate する。 |

## 参考文献

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) — reference paper, ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) — 129-agent NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) — debate variant を benchmark
- [Debate project page](https://composable-models.github.io/llm_debate/) — Du et al. の code、demo、ablation details
