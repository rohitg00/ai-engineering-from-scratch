# コスト削減プリミティブとしての Model Routing

> dynamic broker は各 request（task type、token length、embedding similarity、confidence）を評価し、単純な query は安い model に送り、複雑なものは frontier model へ escalates する。model cascading とも呼ばれる。本番事例では、US/UK/EU deployment で iso-quality のまま20-60%のコスト削減が示されている。高トラフィック SaaS で routing efficiency が30%改善すると、年間で6桁ドルの節約になる。2026年の文脈では、LLM inference price は年あたり約10x 低下した。GPT-4-class token は2022年末から2026年にかけて $20/M から約 $0.40/M になった。低下の大半は hardware ではなく、より良い serving stack（Phase 17 · 04-09）によるものだ。routing は、その価格低下を product regression なしに margin へ変換する方法である。失敗モードは cheap-model drift だ。route が40%を弱い model に押し出し、reasoning task の quality が3-5%下がり、誰も四半期の間気づかない。offline eval set だけでなく online quality metric で route を gate する。

**種別:** 学習
**言語:** Python (stdlib, toy cascading router simulator)
**前提条件:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 19 (AI Gateways)
**所要時間:** 約60分

## 学習目標

- model cascading を説明する。cheap-first で confidence check を行い、low confidence なら escalate する。
- 4つの routing signal（task classification、prompt length、known-hard set への embedding similarity、first-pass の self-confidence）を列挙する。
- target routing split と quality loss tolerance から expected blended cost を計算する。
- cheap-model creep を検出する drift-monitoring metric（online quality gate）を説明する。

## 課題

あなたの service は GPT-5 に月 $80k かかっている。analytics を見ると query の70%は単純だ。「パリは今何時？」「この文を言い換えて」のようなものだ。Haiku-class model はそれらを cost の3%で完璧に処理できる。残り30%は GPT-5 の reasoning が必要だ。coding、math、multi-step planning など。

70%を cheap、30%を expensive に route できれば、product quality を保ったまま請求額は約65%下がる。これが routing だ。難しいのは、quality を退行させずに broker を作ることだ。

## コンセプト

### 4つの routing signal

1. **Task classification**: simple/complex/codegen/math/chat。rules-based classifier、小さな LLM（Haiku-class at $0.25/M）、または labeled bucket への embedding similarity でよい。出力: route = cheap / balanced / frontier。

2. **Prompt length**: 4K tokens を超える prompt は coherent に処理するため frontier が必要なことが多い。500 tokens 未満の prompt では通常不要。

3. **Embedding similarity to known-hard set**: query が known-hard bucket に近い（cosine > 0.88）なら、直接 frontier へ escalate する。

4. **Self-confidence from first-pass**: まず cheap に送る。model の log-probs が low confidence を示す、refuse する、または hedging language を出すなら frontier で retry する。traffic の約10%で P95 latency が増えるが、残り90%で50%超を節約する。

### 3つの pattern

**Pre-route**（最初に classifier）: 追加 latency は約5-10ms。全体として最速。

**Cascade**（cheap-first、low confidence で escalate）: median latency は約1.2x（cheap run + verify）、escalated では約2x。quality floor が最も強い。

**Ensemble route**（sample で cheap と frontier を並列実行し、reward-model が選ぶ）: quality は最高、cost も最高。critical A/B のみに使う。

### 実装

AI gateways（Phase 17 · 19）は routing を提供する。LiteLLM は fallback と cost-routing を備えた `router` config を持つ。Portkey は guards + routing を持つ。Kong AI Gateway は plugin-based routing を持つ。OpenRouter の model marketplace は recommendation API を提供する。

Open-source: RouteLLM（LMSYS）、Not Diamond（commercial）、Prompt Mule。

### 2026年の price curve

| Model class | Late 2022 | 2026 | Change |
|-------------|-----------|------|--------|
| GPT-4-level quality | ~$20/M | ~$0.40/M | 50x cheaper |
| Frontier (GPT-5, Claude 4) | — | ~$3-10/M | new tier |

改善の大半は serving efficiency だ。Phase 17 · 04-09 の中核 lesson が provider-side cost drop になった。routing により、cheap tier へ全ユーザーが移行するのを待たずに、app layer でその gain を取り込める。

### 本当のリスクは drift

route は40%を cheap model に送っている。6か月で task distribution が変化する（ユーザーが高度化し、長い質問をするようになる）。router は Q1 data で訓練された classifier のままなので気づかない。quality は静かに落ちる。大きな苦情は出ない。競合 benchmark で負けて初めて気づく。

online quality metric で route を gate する:

- route ごとの user thumbs-up / thumbs-down。
- route ごとの held-out sample（5%）に対する automated LLM-judge。
- Escalation rate: cascade が >30% up-route しているなら、cheap model へ過剰 routing している。
- route ごとの refusal rate。

### 覚えておくべき数字

- 2026年の routing savings at iso-quality: 事例で20-60%。
- 2022-2026年の LLM price drop: aggregate で年あたり約10x。
- GPT-4-level 2022 vs 2026: ~$20/M → ~$0.40/M。
- Cascade latency impact: median 約1.2x、escalated 約2x（traffic の約10%）。

## 使ってみる

`code/main.py` は mixed workload 上で pre-route、cascade、ensemble を simulate する。blended cost、quality loss、escalation rate を report する。

## 成果物

この lesson は `outputs/skill-router-plan.md` を生成する。workload と quality budget を受け取り、routing pattern と signal を選ぶ。

## 演習

1. `code/main.py` を実行する。どの accuracy floor で cascade は pre-route を上回るか。
2. user base が30% enterprise（complex queries）、70% free tier（simple）である。routing split を設計する。どの online metric で gate するか。
3. route により quality が2%下がるが40%節約できる。ship するか。product 次第だ。両方の主張を書く。
4. OpenAI / Anthropic APIs の logprobs を使って confidence check を実装する。最初に置く threshold は何か。
5. 6か月で escalation rate が8%から22%に上がった。3つの原因と、それぞれの fix を診断する。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Model routing | "cost broker" | request ごとに model を動的選択する |
| Model cascade | "cheap-first escalate" | cheap を実行し、low confidence なら frontier へ fall through |
| Pre-route | "classify first" | 先に classifier を置き、再実行しない |
| Ensemble route | "parallel pick" | 複数を実行し、reward-model が best を選ぶ |
| Escalation rate | "uprouted %" | cascade request のうち escalated した割合 |
| RouteLLM | "LMSYS router" | OSS router library |
| Not Diamond | "commercial router" | SaaS model-routing product |
| Drift | "cheap creep" | router が気づかない distribution shift |
| Online quality gate | "live check" | live traffic を sampling する automated LLM-judge |

## 参考資料

- [AbhyashSuchi — Model Routing LLM 2026 Best Practices](https://abhyashsuchi.in/model-routing-llm-2026-best-practices/)
- [Lukas Brunner — Rise of Inference Optimization 2026](https://dev.to/lukas_brunner/the-rise-of-inference-optimization-the-real-llm-infra-trend-shaping-2026-4e4o)
- [RouteLLM paper / code](https://github.com/lm-sys/RouteLLM)
- [Not Diamond — model routing](https://www.notdiamond.ai/)
- [OpenRouter](https://openrouter.ai/) — multi-model gateway with routing primitives.
