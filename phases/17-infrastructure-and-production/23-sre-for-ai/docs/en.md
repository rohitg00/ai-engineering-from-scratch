# AI のための SRE — マルチエージェントのインシデント対応、Runbook、予測検知

> AI SRE は、ログ、runbook、サービス topology などのインフラデータに RAG で接地した LLM を使い、調査、文書化、調整の各フェーズを自動化します。2026 年のアーキテクチャパターンは multi-agent orchestration です。logs、metrics、runbooks に特化したエージェントを supervisor が調整し、AI が仮説とクエリを提案し、人間が判断を承認します。Datadog Bits AI と Azure SRE Agent はこれを managed products として提供しています。Runbook も進化しています。NeuBird Hawkeye は adversarial evaluation を使います。同じインシデントを 2 つのモデルが分析し、一致すれば confidence、不一致なら uncertainty とします。operational memory はチーム変更をまたいで残ります。Auto-remediation は慎重に扱います。AI が提案し、人間が承認します。完全自律アクションは狭い範囲 (pod restart、特定 deploy の rollback) に限られ、厳しい guardrails が必要です。「set it and forget it」と売り込む人は過大評価しています。新しい frontier は pre-incident prediction です。MIT の研究では、historical logs + GPU temps + API error patterns で学習した LLM が、outages の 89% を 10-15 分前に予測したと報告されています。予測: enterprise LLM の 95% は 2026 年末までに automated failover を備えます。

**種類:** Learn
**言語:** Python (標準ライブラリ、multi-agent incident triage simulator のトイ実装)
**前提:** Phase 17 · 13 (Observability), Phase 17 · 24 (Chaos Engineering)
**時間:** 約 60 分

## 学習目標

- multi-agent AI SRE architecture を図示する: supervisor + specialized agents (logs、metrics、runbooks) + human approval gate。
- auto-remediation が広い変更 (service の re-architecture) ではなく狭い変更 (restart pod、revert deploy) に限られる理由を説明する。
- adversarial evaluation pattern (NeuBird Hawkeye) を説明する: 2 つのモデルが一致 = confidence、不一致 = escalate。
- MIT の 89% early-detection result と、運用上の制約を引用する: actuation のない predictions はただの dashboards である。

## 問題

午前 3 時、on-call engineer に「checkout の error rate が高い」という pager が飛びます。エンジニアは Datadog、Loki、3 つの runbook、deploy log を確認します。30 分後、root cause が KV cache spike による vLLM OOM だと気づきます。pod を restart するとエラーは消えます。

2026 年には、その調査の最初の 20 分は自動化できます。service ごとの logs の grouping、recent deploys との correlation、runbooks との照合は、すべて RAG + tool-use です。supervised agent は人間が Datadog を開く前に first-pass triage を行い、仮説を提示できます。

完全自律の remediation は別問題です。pod restart は安全です。GPU pool の scale は policy が許せば安全です。service の re-architecture は絶対に違います。この分野で大事なのは、その狭い境界線を引くことです。

## コンセプト

### Multi-agent architecture

```
          Incident
             │
             ▼
        Supervisor
        /    |    \
       ▼     ▼     ▼
  Log agent  Metric agent  Runbook agent
       │     │     │
       └─────┴─────┘
             │
             ▼
        Hypothesis + evidence
             │
             ▼
        Human approval
             │
             ▼
        Action (narrow set)
```

Supervisor は incident を sub-queries に分解します。specialized agents は tool access (log search、PromQL、doc retrieval) を持ちます。Supervisor は統合し、hypothesis + evidence を人間に提示します。人間は承認または方向修正します。

### Auto-remediation の範囲

**安全 (狭い範囲)**: restart pod、特定 deploy の revert、事前承認済み範囲内の pool scale、事前承認済み feature flag の enable。

**安全ではない (広い範囲)**: service topology の変更、resource limits の変更、新しい code の deploy、IAM の変更、databases の変更。

「set it and forget it」と売り込む人は過大評価しています。AI SRE が成熟すれば safe set は広がりますが、境界は現実に存在します。

### Adversarial evaluation (NeuBird Hawkeye)

2 つのモデルが同じ incident を独立に分析します。root cause で一致すれば confidence は高いです。不一致なら、両方の hypotheses を見える形で人間へ escalate します。単純な pattern ですが、hallucinated root causes に対する有効な filter です。

### Operational memory

team turnover は traditional SRE の静かな弱点です。tribal knowledge が失われます。AI SRE は runbooks + post-mortems を vector DB に保存し、agents は新しい incident のたびに retrieval します。新しい engineer が参加しても、AI は full history を持っています。

### Pre-incident prediction

MIT 2025 research: historical logs、GPU temperatures、API error patterns で学習した LLM は、test set 上で outages の 89% を発生 10-15 分前に予測しました。

現実確認: actuation のない predictions は dashboards です。運用上の問いは「予測したとき、何をするのか」です。pre-emptive drain か、pager か、auto-scale か。答えは policy ごとに異なります。

### 2026 年の製品

- **Datadog Bits AI** — Datadog 内の managed SRE copilot。
- **Azure SRE Agent** — Azure-native。
- **NeuBird Hawkeye** — adversarial eval + operational memory。
- **PagerDuty AIOps** — triage + deduplication。
- **Incident.io Autopilot** — incident commander + coordination。

### Runbooks as code

Runbooks は Confluence pages から、structured sections (symptom、hypothesis、verify、act) を持つ versioned markdown へ進化します。structured runbooks はより良い RAG retrieval を可能にします。AI-SRE rollout は、unstructured runbooks を structured に変えるところから始めます。

### 覚えておくべき数字

- MIT early-detection: outages の 89%、10-15 分の lead time。
- Multi-agent triage: supervisor + (logs、metrics、runbooks) + human。
- Safe auto-remediation set: restart pod、revert deploy、範囲内の scale。
- Adversarial eval: 2 モデルが独立に分析し、agreement = confidence。

## 使ってみる

`code/main.py` は multi-agent triage をシミュレートします。log agent が error を見つけ、metric agent が CPU spike を見つけ、runbook agent が known issue と照合します。Supervisor は hypotheses を rank します。

## 成果物

この lesson では `outputs/skill-ai-sre-plan.md` を作ります。現在の on-call、incident volume、team maturity を受け取り、AI SRE rollout を設計します。

## 演習

1. `code/main.py` を実行してください。log agent と metric agent が不一致だったらどうなりますか。supervisor はどう解決しますか。
2. 自分の service に対して「安全な」auto-remediation actions を 3 つ定義し、それぞれを正当化してください。
3. structured runbook template を書いてください: sections、required fields、verification commands。
4. Predictive detection が 12 分の lead time で発火しました。あなたの policy は pager、pre-drain、それとも両方ですか。
5. 3 人チームが 2026 年に AI SRE を採用すべきか、待つべきかを論じてください。maturity、volume、risk を考慮します。

## 重要語句

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------------------|
| AI SRE | 「on-call 用 agent」 | LLM-backed incident investigation + coordination |
| Supervisor agent | 「orchestrator」 | incidents を sub-queries に分解する top-level agent |
| Specialized agent | 「domain agent」 | tool access (logs、metrics、runbooks) を持つ sub-agent |
| Auto-remediation | 「AI が直す」 | 事前承認済みの狭い action。広い re-architecture ではない |
| Operational memory | 「vector runbooks」 | RAG 用に vector DB に入れた post-mortems + runbooks |
| Adversarial eval | 「two-model check」 | 独立分析。agreement = confidence |
| NeuBird Hawkeye | 「adversarial なもの」 | adversarial-eval + memory pattern を持つ product |
| Bits AI | 「Datadog の SRE agent」 | Datadog-managed AI SRE |
| Pre-incident prediction | 「early detection」 | outage prediction の 10-15 分 lead time |

## 参考資料

- [incident.io — AI SRE Complete Guide 2026](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- [InfoQ — Human-Centred AI for SRE](https://www.infoq.com/news/2026/01/opsworker-ai-sre/)
- [DZone — AI in SRE 2026](https://dzone.com/articles/ai-in-sre-whats-actually-coming-in-2026)
- [Datadog Bits AI](https://www.datadoghq.com/product/bits-ai/)
- [NeuBird Hawkeye](https://www.neubird.ai/)
- [awesome-ai-sre](https://github.com/agamm/awesome-ai-sre)
