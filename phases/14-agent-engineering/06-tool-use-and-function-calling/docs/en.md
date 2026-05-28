# Tool UseとFunction Calling

> Toolformer（Schickら、2023）はself-supervised tool annotationを始めた。Berkeley Function Calling Leaderboard V4（Patilら、2025）は2026年の基準を設定する。40% agentic、30% multi-turn、10% live、10% non-live、10% hallucination。single-turnは解決済みである。memory、dynamic decision-making、long-horizon tool chainsはまだ解決していない。

**タイプ:** 構築
**言語:** Python（stdlib）
**前提条件:** フェーズ 14 · 01（Agent Loop）、フェーズ 13 · 01（Function Calling Deep Dive）
**時間:** 約60分

## 学習目標

- Toolformerのself-supervised training signalを説明する。executionによりnext-token lossが下がるtool annotationだけを残す。
- BFCL V4の5つのevaluation categoriesと、それぞれが何を測るかを挙げる。
- schema validation、argument coercion、execution sandboxingを備えたstdlib tool registryを実装する。
- 2026年の3つのopen problems、long-horizon tool chaining、dynamic decision-making、memoryを診断する。

## 課題

初期のtool useは「modelが正しいfunction callを予測できるか」を問うていた。現代のtool useはこう問う。modelは40 stepsにわたってtoolsをchainできるか。memoryを持ち、partial observabilityの中で動き、tool failureから回復し、存在しないtoolsをhallucinateせずに実行できるか。

Toolformerはbaselineを確立した。modelsはself-supervisionでいつtoolsを呼ぶかを学べる。BFCL V4は2026年のevaluation targetを定義する。その間のgapこそ、production agentsが生きる空間である。

## 考え方

### Toolformer（Schickら、NeurIPS 2023）

ideaは、modelに自分のpretraining corpusへcandidate API callsをannotateさせることだ。各candidateを実行する。tool resultを含めることでnext tokenのlossが下がった場合だけannotationを残す。filtered corpusでfine-tuneする。

対象toolsはcalculator、QA system、search engines、translator、calendar。self-supervision signalは、そのtoolがtext predictionに役立つかどうかだけであり、人間labelはない。

scale result: tool useはscaleでemergeする。小さいmodelsはtool annotationsで悪化するが、大きいmodelsはgainする。だから2026年のfrontier modelsは強いtool useを内蔵しており、多くの7B modelsは信頼できるようにするには明示的なtool-use fine-tuningが必要である。

### Berkeley Function Calling Leaderboard V4（Patilら、ICML 2025）

BFCLは2026年のde facto evaluationである。V4の構成は次のとおり。

- **Agentic (40%)** - full agent trajectories。memory、multi-turn、dynamic decisions。
- **Multi-Turn (30%)** - tool chainsを含むinteractive conversations。
- **Live (10%)** - user-submitted real prompts（より難しい分布）。
- **Non-Live (10%)** - synthetic test cases。
- **Hallucination (10%)** - toolを呼ぶべきでないときを検出する。

V3はstate-based evaluationを導入した。tool sequenceの後、tool callsのASTをmatchするのではなく、APIの実際のstate（例: 「fileは作成されたか？」）をcheckする。V4はweb search、memory、format sensitivity categoriesを追加した。

2026年の重要な発見: single-turn function callingはほぼ解決済みである。failureはmemory（turnsをまたいでcontextを運ぶ）、dynamic decision-making（prior resultsに基づいてtoolsを選ぶ）、long-horizon chains（20+ steps後のdrift）、hallucination detection（合うtoolがないときにcallを拒否する）に集中する。

### Tool schema

各providerにはschemaがある。detailは異なるが、shapeは共通している。

```
name: string
description: string (what it does, when to use it)
input_schema: JSON Schema (properties, required, types, enums)
```

Anthropicは`input_schema`を直接使う。OpenAIは`function.parameters`を使う。どちらもJSON Schemaを受け付ける。descriptionは不可欠である。modelはそれを読んで正しいtoolを選ぶ。悪いtool descriptionはwrong-tool-picked failureの最大のroot causeである。

### Argument validation

tool callを信用しない。validateする。

1. **Type coercion。** modelはschemaがintと言う場所にstring `"5"`を返すかもしれない。曖昧でなければcoerceし、曖昧ならrejectする。
2. **Enum validation。** schemaが`status in {"open", "closed"}`と言うのにmodelが`"in_progress"`を出したら、descriptive errorでrejectする。
3. **Required fields。** required fieldが欠けている場合は、crashではなく即座にerror observationをmodelへ返す。
4. **Format validation。** dates、emails、URLs。regexではなく具体的なparserでvalidateする。

すべてのvalidation failureはstructured observationを返すべきである。modelが正しいshapeでretryできるようにするためだ。

### Parallel tool calls

現代のproviderは1つのassistant turn内でparallel tool callsをsupportする。loopはこうなる。

1. modelがdistinctな`tool_use_id`を持つ3つのtool callsを出す。
2. runtimeがそれらを実行する（independentならparallelに）。
3. 各resultを`tool_use_id`でcorrelateされた`tool_result` blockとして返す。

engineering rule: correlation IDsは不可欠なものとして扱う。入れ替えると、wrong-tool-to-wrong-result routingになる。

### Sandboxing

tool executionはsandbox boundaryである。詳細はレッスン09を参照。短く言うと、各toolはread/write surface、network access、timeout、memory capを指定すべきである。genericな`run_shell(cmd)`はred flagであり、specificな`git_status()`の方が安全である。

## 構築

`code/main.py`はproduction-shapeのtool registryを実装する。

- JSON Schema subset validator（stdlibのみ）。
- description、input schema、timeout、executorを持つtool registration。
- Argument coercionとenum validation。
- correlation IDs付きparallel tool dispatch。
- structured stringsとしてのerror observations。

実行する。

```
python3 code/main.py
```

traceは、mini agentが1 turnで3つのtoolsを呼ぶ様子を示す。うち1つは意図的にmalformed callであり、modelが対応できるdescriptive errorでrejectされる。

## 使い方

Anthropic、OpenAI、Gemini、Bedrock。各providerには独自のtool schemaがある。multi-providerが必要ならtranslation layer（OpenAI Agents SDK、Vercel AI SDK、LangChain tool adapter）を使う。BFCLはreference benchmarkである。tool useがproductの中心なら、出荷前にagentに対して実行する。

## 出荷

`outputs/skill-tool-registry.md`は、指定されたtask domain向けにtool catalog、schema、registryを生成する。description-quality checks（各toolのdescriptionは、modelにいつ使うべきかを伝えているか）を含む。

## 演習

1. modelが他のtoolを一切使わないことを明示的に選べる「no-op」toolを追加する。BFCL-like hallucination testで測定する。
2. int-as-stringとfloat-as-stringのargument coercionを実装する。coercionはどこからreal bugsを隠し始めるか。
3. per-tool timeoutとcircuit breaker（3 consecutive failures後に60秒そのtoolを拒否）を追加する。これによりmodelの回復の仕方はどう変わるか。
4. BFCL V4 descriptionを読む。1 category（例: "multi-turn"）を選び、10 example promptsをagentに通す。pass rateを報告する。
5. stdlib validatorをPydanticまたはZodへ移植する。toyが見逃したものをPydantic/Zodは何を捕まえたか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------|
| Function calling | 「Tool use」 | validated schemaを持つstructured-output tool invocation |
| Toolformer | 「Self-supervised tool annotation」 | Schick 2023。next-token lossを下げるtool callsだけを残す |
| BFCL | 「Berkeley Function Calling Leaderboard」 | 2026 benchmark: 40% agentic、30% multi-turn、10% live、10% non-live、10% hallucination |
| Tool schema | 「model向けfunction signature」 | name、description、argumentsのJSON Schema |
| tool_use_id | 「Correlation ID」 | tool callとresultを結びつける。parallel dispatchには不可欠 |
| Hallucination detection | 「呼ばないときを知る」 | V4 category。合うtoolがないときにcallを拒否する |
| Argument coercion | 「String-to-int repair」 | 予測可能なschema mismatchへの狭い修正。曖昧ならrejectする |
| Sandboxing | 「Tool execution boundary」 | toolごとのread/write surface、network、timeout、memory cap |

## 参考資料

- [Schick et al., Toolformer (arXiv:2302.04761)](https://arxiv.org/abs/2302.04761) - self-supervised tool annotation
- [Berkeley Function Calling Leaderboard (V4)](https://gorilla.cs.berkeley.edu/leaderboard.html) - 2026 eval benchmark
- [Anthropic, Tool use documentation](https://platform.claude.com/docs/en/agent-sdk/overview) - Claude Agent SDKのproduction tool schema
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) - function tool typeとGuardrails
