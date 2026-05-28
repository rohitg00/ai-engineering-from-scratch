# LLM Routing Layer — LiteLLM、OpenRouter、Portkey

> Provider lock-inは高くつきます。tool-calling workloadごとに向いたmodelは異なります。Routing gatewaysは、1つのAPI surface、retries、failover、cost tracking、guardrailsを提供します。2026年に支配的な3 archetypesは、LiteLLM（open-source self-hosted）、OpenRouter（managed SaaS）、Portkey（production-grade、2026年3月にopen-sourced）です。このレッスンではdecision criteriaを整理し、stdlib routing gatewayを歩きます。

**種別:** 学習
**言語:** Python (stdlib, routing + failover + cost tracker)
**前提条件:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**所要時間:** ~45分

## 学習目標

- self-hosted、managed、production-grade routing optionsを区別する。
- provider failure時に定義済みpriority orderでretryするfallback chainを実装する。
- providersをまたいでrequestごとのcostとtoken usageをtrackする。
- production constraintに応じてLiteLLM、OpenRouter、Portkeyを選ぶ。

## 問題

provider routingが重要になるscenario:

1. **Cost。** Claude SonnetはHaikuの3倍costがかかります。triage taskにはHaikuで十分、synthesis taskにはSonnetの価値があります。requestごとにrouteします。

2. **Failover。** OpenAIが1時間不調になる。すべてのrequestが失敗する。redeployせずAnthropicへautomatic fallbackしたい。

3. **Latency。** live chat UIにはfast time-to-first-tokenが必要です。batch summarizerには不要です。latency SLAでrouteします。

4. **Compliance。** EU usersはEU regions内に留める必要があります。regionでrouteします。

5. **Experimentation。** 同じworkloadで2 modelsをA/Bします。test bucketでrouteします。

これらをintegrationごとにhand-codeするのは反復的です。routing gatewayは1つのOpenAI-compatible APIを提供し、残りを処理します。

## コンセプト

### OpenAI-compatible proxy shape

誰もがOpenAI-shapeを話します。routing gatewayは`/v1/chat/completions`を公開し、OpenAI schemaを受け取り、内部でAnthropic / Gemini / Cohere / Ollama / その他へproxyします。clientは気にしません。

### Model aliases

code内で`claude-3-5-sonnet-20251022`と書く代わりに、`our_smart_model`と書きます。gatewayはaliasをreal modelへmapします。AnthropicがClaude 4を出したら、server-sideでaliasを変えるだけです。codeには触りません。

### Fallback chains

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

gatewaysはこれをconfigで定義します。retriesにはbudgetを設け、fallback cascadeでcostが爆発しないようにします。

### Semantic caching

同一またはほぼ同一のpromptsはproviderへ送らずcache hitにします。繰り返しagent loopsでは30-60%のsavingになり得ます。keysはembedding-basedで、near-identical promptsは同じcache slotを共有します。

### Guardrails

Gateway-level:

- **PII redaction。** prompts送信前にregexまたはML-based passを行う。
- **Policy violations。** prohibited contentを含むpromptsをrejectする。
- **Output filters。** completionsからleaksをscrubする。

PortkeyとKongはopinionated guardrailsを提供します。LiteLLMではoptionalです。

### Per-key rate limits

1 API key = 1 teamです。keyごとのbudgetsにより、1 teamがshared quotaを使い切るのを防ぎます。ほとんどのgatewaysがsupportします。

### Self-hosted vs managed trade-offs

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | proxyをdeploy | sign up | どちらも可 |
| Providers | 100+ | 300+ | 100+ |
| Billing | 自分のkeys | OpenRouter credits | 自分のkeys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | full controlが必要なteam | rapid prototyping | compliance付きproduction |

data sovereigntyとSRE teamがあるならLiteLLMが勝ちます。subscription 1つでinfraなしにしたいならOpenRouterです。guardrailsとcomplianceをout of the boxで必要とするならPortkeyです。

### Cost tracking

すべてのrequestは`provider`、`model`、`input_tokens`、`output_tokens`を持ちます。gatewayが維持するpricing sheetからper-model per-token pricesを取り、掛け合わせます。per-user / per-team / per-projectでaggregateします。

### MCP plus routing

gatewayはLLM callsだけでなく、MCP sampling requestsもrouteできます。sampling requestのmodelPreferencesが特定modelをpreferする場合、gatewayが適切なbackendへtranslateします。Phase 13 · 17（MCP gateway）とこのlessonのrouting gatewayは、1つのserviceにmergeされることがあります。

### Routing strategies

- **Static priority。** listの先頭から試し、errorでfallback。
- **Load balancing。** round-robinまたはweighted。
- **Cost-aware。** latency / qualityを満たす最安modelを選ぶ。
- **Latency-aware。** 直近N分で最速のmodelを選ぶ。
- **Task-aware。** prompt classifierがcodingをあるmodelへ、summarizationを別modelへrouteする。

## 使ってみる

`code/main.py`は約150 linesでrouting gatewayを実装します。OpenAI-shaped requestsを受け取り、per-provider stubsへtranslateし、priority fallback chainを走らせ、requestごとのcostをtrackし、inputsにPII redaction passを適用します。normal request、primary-provider outageでfallbackするcase、redactionがPII leakageを捕まえるcaseの3 scenarioで実行してください。

見るべき箇所:

- `ROUTES` dict: alias -> priority-ordered list of concrete providers。
- Fallback loopは5xxでretryする。
- Cost trackerはtoken usageにper-model ratesを掛ける。
- PII redactorはforward前にSSN風patternsをscrubする。

## 成果物

このレッスンは`outputs/skill-routing-config-designer.md`を作ります。workload profile（latency、cost、compliance）を受け取り、LiteLLM / OpenRouter / Portkeyを選び、routing configを生成します。

## 演習

1. `code/main.py`を実行してください。outage scenarioをtriggerし、fallbackがsecond providerに着地し、costが正しくattributedされることを確認してください。

2. semantic cachingを追加してください。promptのSHA256をlookup keyにし、cache hitは即返します。repeated callでcost savingsを測ってください。

3. "code ..." promptsをintelligence重視aliasへ、"summarize ..." promptsをspeed重視aliasへrouteするprompt classifierを追加してください。

4. per-team budgetsを設計してください。各teamはmonthly spend capを持ち、capに達したらgatewayがrequestsを拒否します。enforcement granularity（per-requestまたはwindowed）を選んでください。

5. LiteLLM、OpenRouter、Portkey docsを並べて読んでください。それぞれが提供し、他2つが提供しないfeatureを1つずつ挙げてください。

## 重要用語

| 用語 | よく言われる表現 | 実際の意味 |
|------|----------------|------------|
| Routing gateway | "LLM proxy" | 多数のprovidersの前に置くone-API-surface layer |
| OpenAI-compatible | "Speaks the OpenAI schema" | `/v1/chat/completions` shapeを受け、任意backendへtranslateする |
| Model alias | "our_smart_model" | code内の名前をgatewayがconcrete modelへmapする |
| Fallback chain | "Retry list" | failure時に順に試すprovidersのordered list |
| Semantic caching | "Prompt-embedding cache" | prompt embeddingをkeyにし、near-duplicatesがcache hitを共有する |
| Guardrails | "Input/output filters" | PII redaction、policy violation rejection |
| Per-key rate limit | "Team budget" | API keyに紐づくquota |
| Cost tracking | "Per-request spend" | token usage x modelごとのpriceをaggregateする |
| LiteLLM | "The open proxy" | self-host可能なOSS routing gateway |
| OpenRouter | "The managed SaaS" | credit-based billing付きhosted gateway |
| Portkey | "The production option" | built-in guardrailsを持つopen-source + managed |

## 参考文献

- [LiteLLM — docs](https://docs.litellm.ai/) — self-hosted routing gateway
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) — managed routing SaaS
- [Portkey — docs](https://portkey.ai/docs) — production routing with guardrails
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) — decision guide
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) — vendor survey
