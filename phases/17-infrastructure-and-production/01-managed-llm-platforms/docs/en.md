# Managed LLM Platforms — Bedrock, Vertex AI, Azure OpenAI

> 3つの hyperscaler、3つの異なる戦略。AWS Bedrock はモデルマーケットプレイスであり、Claude、Llama、Titan、Stability、Cohere を1つの API の背後にまとめます。Azure OpenAI は OpenAI との独占的パートナーシップに、専用キャパシティの Provisioned Throughput Units (PTUs) を組み合わせます。Vertex AI は Gemini first で、long-context と multimodal のストーリーが最も強い選択肢です。2026年の Artificial Analysis では、Llama 3.1 405B 相当で Azure OpenAI の中央値が約50 ms、Bedrock が約75 ms と測定されています。この差は PTU によって説明できます。共有オンデマンドより専用キャパシティのほうが強いからです。判断基準は「どれが最速か」ではなく、「どのモデルカタログと FinOps 面が自分のプロダクトに合うか」です。このレッスンでは、雰囲気ではなく、トレードオフを書き出して選べるようにします。

**種別:** 学習
**言語:** Python (stdlib, toy cost-and-latency comparator)
**前提条件:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**所要時間:** 約60分

## Learning Objectives

- 3つのプラットフォーム戦略（marketplace vs exclusive vs Gemini-first）を名前で説明し、それぞれをプロダクトのユースケースに対応づける。
- Azure OpenAI の Provisioned Throughput Units (PTUs) が何を買っているのか、また 405B 規模でオンデマンド Bedrock が通常約25 ms遅く見える理由を説明する。
- 各プラットフォームの FinOps attribution 面（Bedrock Application Inference Profiles vs Vertex project-per-team vs Azure scopes + PTU reservations）を図示する。
- 「two-provider minimum」ポリシーを書き出し、2026年に単一ベンダーロックインが高くつく失敗である理由を説明する。

## 問題

プロダクトで Claude 3.7 Sonnet を使うと決めました。次はそれをどう提供するかです。Anthropic API を直接呼ぶことも、AWS Bedrock 経由で呼ぶことも、gateway 経由にすることもできます。直接 API は最も単純です。Bedrock は BAA、VPC endpoint、IAM、CloudWatch attribution を追加します。gateway は provider 横断の failover、統合 billing、rate limit を追加します。

より深い問いは catalog です。同じプロダクトで Claude、Llama、Gemini が必要なら、Bedrock + Vertex + Azure OpenAI を同時に使う以外、それらを1箇所ですべて買うことはできません。hyperscaler は交換可能ではありません。それぞれが model layer の所有者について違う賭けをしています。

このレッスンでは、その3つの賭け、latency gap、FinOps gap、lock-in risk を整理します。

## The Concept

### Three strategies

**AWS Bedrock** — marketplace。Claude (Anthropic)、Llama (Meta)、Titan (AWS first-party)、Stability (image)、Cohere (embeddings)、Mistral、さらに画像と embedding のサブカタログがあります。1つの API、1つの IAM surface、1つの CloudWatch export。Bedrock の賭けは、顧客は単一モデルよりも選択肢を求める、というものです。

**Azure OpenAI** — exclusive partnership。Azure datacenter 内で GPT-4 / 4o / 5 / o-series、DALL·E、Whisper、OpenAI models の fine-tuning を利用できます。"Azure OpenAI Service" catalog には OpenAI 以外のモデルはありません。それらは Azure AI Foundry（別 product）に入ります。Azure の賭けは、OpenAI が frontier であり続け、顧客はその特定の関係に enterprise controls を求める、というものです。

**Vertex AI** — Gemini first、その他は二番手。Gemini 1.5 / 2.0 / 2.5 Flash and Pro、さらに Model Garden (third-party)。Vertex の賭けは multimodal long-context です。1M-token Gemini context が差別化要因です。

### Latency gap at scale

Artificial Analysis は継続的な benchmark を実行しています。同等の Llama 3.1 405B deployment（shared on-demand）では、Azure OpenAI の median first-token latency は約50 ms、Bedrock は約75 ms です。この差は AWS の失敗ではありません。capacity model の違いです。Azure は PTUs (Provisioned Throughput Units) を販売し、tenant 専用の GPU capacity を予約します。Bedrock の同等機能（Provisioned Throughput）もありますが、unit あたり約$21/hour から始まり、多くの顧客は shared on-demand のままです。

オンデマンド共有キャパシティは、他のすべての顧客 traffic と競合します。専用キャパシティは競合しません。プロダクト SLA が TTFT < 100 ms at P99 なら、Azure の PTU を買うか、Bedrock Provisioned Throughput を買うか、デフォルトのばらつきを受け入れる必要があります。

### Provisioned Throughput economics

Azure PTUs: 予約済み inference compute のブロックです。予測可能な workload では on-demand 比で最大約70%の節約になります。費用は traffic に関係なく時間単位で固定され、idle でも reservation に支払います。損益分岐点は通常 sustained utilization 約40-60%です。

Bedrock Provisioned Throughput: model と region に応じて $21-$50/hour。計算は似ています。損益分岐点は peak utilization の半分程度です。monthly commitment が必要です。

Vertex provisioned capacity は Gemini SKU ごとに販売されます。価格は model と region で変わり、公開情報は比較的少なめです。

### FinOps surface — the real differentiator

**Bedrock Application Inference Profiles** は marketplace 内で最もきれいな attribution です。profile に `team`、`product`、`feature` を tag し、すべての model invocation をそこに通すと、CloudWatch が profile ごとの cost を後処理なしで分解します。2025年に追加され、今でも hyperscaler native では最も granular です。

**Vertex** の attribution は project-per-team と labels-everywhere です。各 team を GCP project として modeling し、すべての resource に label を付け、BigQuery Billing Export + DataStudio で rollup します。手間は増えますが、BigQuery によって cost data に任意の SQL を実行できます。

**Azure** は subscription/resource-group scope と tag に依存し、PTU reservation が first-class cost object になります。tag は request ではなく resource group から継承されるため、per-request attribution には Application Insights custom metrics、または header を stamp する gateway が必要です。

パターン: Bedrock は native では最もきれい、Vertex は BigQuery 経由で最も柔軟、Azure は instrument しないと最も不透明です。

### Lock-in is the 2026 risk

1つの model が支配的だった時代には、単一 hyperscaler への commitment で十分でした。2026年には frontier は毎月動きます。ある四半期は Claude 3.7、次は Gemini 2.5、その次は GPT-5。1つの platform に lock すると、frontier の3分の2から締め出されます。

実運用チームが採用しているパターンは、product-critical な LLM call には two-provider minimum を置くことです。一般的な組み合わせは Bedrock + Azure OpenAI です。一方から Claude、もう一方から GPT を使い、同じ gateway の背後で failover します。gateway が最適に route するため cost uplift は小さく、障害時（Azure OpenAI January 2025 incident や AWS us-east-1 outage など）の availability uplift は決定的です。

### Data residency, BAAs, and regulated industries

Bedrock: 多くの region で BAA、VPC endpoints、guardrails。fintech の一般的な default。
Azure OpenAI: HIPAA、SOC 2、ISO 27001、EU data residency。enterprise-regulated の default。
Vertex: HIPAA、GDPR、region ごとの data residency、Google Cloud の compliance stack。

3つとも基本的な checkbox は満たします。違いは data retention policy、log の扱い、abuse-monitoring が traffic を読むかどうか（多くは default opt-in、enterprise では opt-out 可能）にあります。

### Numbers you should remember

- Azure OpenAI median TTFT on Llama 3.1 405B equivalents: ~50 ms (with PTUs).
- Bedrock median TTFT on-demand: ~75 ms.
- Bedrock Provisioned Throughput: $21-$50/hr per unit.
- Azure PTU break-even: ~40-60% sustained utilization.
- PTU savings vs on-demand at high utilization: up to 70%.

## Use It

`code/main.py` は synthetic workload 上で3つの platform を比較します。on-demand vs PTU economics、TTFT variance、cost attribution fidelity を model 化します。実行して、どこで PTU が見合うのか、どこで marketplace の model breadth が TTFT gap を上回るのかを確認してください。

## Ship It

このレッスンは `outputs/skill-managed-platform-picker.md` を生成します。workload profile（必要な model、TTFT SLA、daily volume、compliance requirements）を入力すると、primary platform、fallback、FinOps instrumentation plan を推奨します。

## Exercises

1. `code/main.py` を実行してください。70B class model で Azure PTU が on-demand に勝つ sustained utilization はどこですか。break-even を計算し、公表されている 40-60% band と比較してください。
2. あなたの product は Claude 3.7 Sonnet と GPT-4o を必要としています。two-provider deployment を設計してください。どちらをどの hyperscaler に置き、前段にどの gateway を置き、failover policy はどうしますか。
3. 規制対象の healthcare customer が BAA、US-East data residency、sub-100ms P99 TTFT を要求しています。platform を1つ選び、3つの具体的な機能で正当化してください。
4. traffic が変わっていないのに、今月の Bedrock bill が4倍になりました。Application Inference Profiles がない場合、原因をどう探しますか。profiles がある場合、どれくらいでわかりますか。
5. Azure OpenAI と Bedrock の pricing page を読んでください。100M-token/month の Claude workload では、direct Anthropic API、Bedrock on-demand、Bedrock Provisioned Throughput のどれが安いですか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Bedrock | "AWS LLM service" | Claude、Llama、Titan、Mistral、Cohere を横断する model marketplace |
| Azure OpenAI | "Azure's ChatGPT" | enterprise controls 付きで Azure datacenter 内に提供される OpenAI 専用モデル |
| Vertex AI | "Google's LLM" | third-party models 向け Model Garden を備えた Gemini-first platform |
| PTU | "dedicated capacity" | Provisioned Throughput Unit — 予約済み inference GPU、時間単位課金 |
| Application Inference Profile | "Bedrock tagging" | tag 付きの product 別 cost/usage profile、CloudWatch-native |
| Model Garden | "Vertex catalog" | Gemini とは別の Vertex AI third-party model section |
| Two-provider minimum | "LLM redundancy" | すべての critical LLM path を2つ以上の hyperscaler で動かす policy |
| BAA | "HIPAA paperwork" | Business Associate Agreement。PHI に必要で、3社すべてが提供 |
| Abuse monitoring | "the log watcher" | prompt/output に対する provider 側 safety scan。enterprise では opt-out 可能 |

## 参考文献

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — authoritative rate card and Provisioned Throughput pricing.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) — PTU economics and rate cards.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) — Gemini tiers and Model Garden surcharges.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) — providers across latency and throughput benchmarks.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — enterprise decision framework.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — attribution mechanics side-by-side.
