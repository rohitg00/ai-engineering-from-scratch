# Batch APIs — 業界標準としての50%割引

> 主要プロバイダーはどこも非同期の Batch API を提供し、50%割引とおおむね24時間以内の完了を約束している。OpenAI、Anthropic、Google、そして多くの推論プラットフォーム（Fireworks の batch tier、Together batch）は同じパターンを実装している。batch と prompt caching を重ねると、夜間パイプラインのコストは同期・非キャッシュ実行の約10%まで下がる。ルールは単純だ。インタラクティブでなければ batch に載せる。コンテンツ生成、文書分類、データ抽出、レポート生成、大量ラベリング、カタログタグ付けなど、24時間のレイテンシを許容できるものは、batch に移すまでコストを取りこぼしている。2026年の本番パターンは、新しい LLM ワークロードをすべて3つのレーンに仕分けることだ。interactive（キャッシュ付き同期）、semi-interactive（fallback 付き async queue）、batch（夜間実行、キャッシュ済み入力を併用）。本当は数分待てるのに interactive を装うワークロードが最も無駄を出す。

**種別:** 学習
**言語:** Python (stdlib, toy batch-vs-sync cost simulator)
**前提条件:** Phase 17 · 14 (Prompt & Semantic Caching)
**所要時間:** 約45分

## 学習目標

- OpenAI、Anthropic、Google の3つの provider batch API と、共通する50%割引 + 24h turnaround の保証を説明する。
- 夜間の分類ワークロードで batch + cached-input を重ねた場合のコストを計算し、同期・非キャッシュの baseline と比較する。
- ワークロードを interactive / semi-interactive / batch に仕分け、そのレーンを正当化する。
- 2つの落とし穴を説明する。partial interactivity（ユーザーが24hより早い応答を期待している）と output-schema drift（batch ファイル形式が provider ごとに違う）。

## 課題

あなたのチームは夜間レポート生成パイプラインを運用している。50,000件の文書をそれぞれ要約し、要約をクラスタリングし、経営向けブリーフを下書きする。同期実行では4時間かかり、$2,000/night かかる。そこで Batch API の話を聞いた。

batch にすると50%割引になる。さらに全50k call で共有される system prompt に prompt caching を有効化する。重ねると請求額は $180/night、baseline の約9%まで下がる。同じパイプラインでも、3つの設定変更だけでこうなる。

batch は LLM コスト削減の道具箱の中で、誰も引こうとしない最も安いレバーだ。理由はほぼ組織的なものだ。SLA が実際には「朝まで」なのに、チームは「real-time」だと思い込む。この lesson は、請求額の90%を取りこぼさないためのものだ。

## コンセプト

### 3つの Batch API

**OpenAI Batch API**: request の一覧を含む JSONL ファイルを upload する。24-hour turnaround を約束する（実務では多くの場合 ~2-8 hours）。input token と output token が50%割引。`/v1/batches` endpoint。cache 対象の input は cached-input pricing も上乗せで適用される。

**Anthropic Message Batches**: JSONL upload。24-hour turnaround。50%割引。`cache_control` をサポートする。cache write は明示的で、read は batch 内で自動的に起きる。

**Google Vertex AI Batch Prediction**: BigQuery または GCS input。Gemini で同様の50%割引。Vertex pipelines と統合される。

### 意味: 非同期であり、遅いわけではない

batch は「24時間以内に返すと約束する」であって、「24時間かかる」という意味ではない。典型的な P50 は2-6時間だ。provider は GPU inventory が余っている off-peak window に batch をスケジューリングする。

### caching と重ねる

同じ 4K-token system prompt を使う50k-document summarization:

- Synchronous uncached: full rate で 50000 × ($input × 4000 + $output × 200)。
- Synchronous cached: 初回 write 後に system prompt が cache され、残り49999件は input が10倍安くなる。
- Batch cached: 上記に加えて read / write の両方が50%割引。

stack は batch + cache = sync uncached bill の約10%。夜間に走り、共有 system prompt を持つワークロードはこれを使うべきだ。

### ワークロードの仕分け

**Interactive** — ユーザーが応答を待っている。TTFT が重要。prompt caching 付きの synchronous call。batch 不可。

**Semi-interactive** — ユーザーが task を投入し、数分後に確認する。batch が使えない場合に sync へ fallback できる async queue。中規模の RAG indexing をイメージするとよい。

**Batch** — ユーザーが結果を「朝まで」または「次の1時間まで」に期待している。content pipeline、大規模分類、offline analysis。常に batch、常に caching を重ねる。

よくある間違いは、pipeline が production だからすべて interactive に分類することだ。production は latency spec ではない。SLA が latency spec だ。

### partial-interactivity の罠

interactive に見えても5-10分待てる機能がある。例: 「refresh」ボタン付きの夜間 customer health report。ユーザーが refresh をクリックする。10分待てる。チームはこれを synchronous で出荷する。50 concurrent refresh は、batch して email delivery する場合の10倍のコストになる。

問うべき質問は「このユーザーにとって24時間とは何を意味するか？」だ。答えが「気づかない」なら batch にする。

### output-schema の罠

batch ファイル形式は provider ごとに異なる。

- OpenAI: JSONL、1 request per line。
- Anthropic: JSONL、1 message per line。response format は埋め込み。
- Vertex: BigQuery table または GCS prefix with TFRecord。

provider 横断の「one batch client」を書くには、provider ごとの adapter code が必要だ。multi-provider batch を宣伝する gateway（Portkey、LiteLLM の一部 tier）も、raw format を薄く wrap しているだけである。

### 覚えておくべき数字

- provider 横断の batch discount: input + output に一律50%。
- Turnaround SLA: 24時間 guaranteed、典型 P50 は2-6 hours。
- Stacked batch + cached input: sync uncached cost の約10%。
- Workload triage rule: 24h latency が許容できるなら常に batch。

## 使ってみる

`code/main.py` は50k-document workload について、sync、sync+cache、batch、batch+cache のコストを計算する。節約額を $ と percent で report する。

## 成果物

この lesson は `outputs/skill-batch-triager.md` を生成する。workload characteristics を受け取り、interactive/semi/batch に仕分け、saving を見積もる。

## 演習

1. `code/main.py` を実行する。100k-doc pipeline、3K-token system prompt、500-token output の条件で、full stack（batch + cache）が sync baseline に対してどれだけ節約するか計算する。
2. あなたが知っている実プロダクトの機能を3つ選び、それぞれ interactive/semi/batch に仕分ける。
3. ユーザーが「レポートに3時間かかった」と苦情を言った。それは batch の mis-triage か、正当な interactive か。判断基準を書く。
4. Batch API の return SLA は24h だが P99 が20 hours である。これをユーザーにどう伝えるか。edge case で downstream system はどう振る舞うべきか。
5. break-even を計算する。どれだけの shared-prefix length から、batch + cache が自前の reserved GPU で夜間実行するより安くなるか。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Batch API | "async discount" | 24h turnaround 付きの50%割引 |
| JSONL | "batch format" | 1行に1 JSON request。OpenAI/Anthropic の標準 |
| Message Batches | "Anthropic batch" | Anthropic の Batch API product name |
| Batch prediction | "Vertex batch" | Vertex AI の Batch API product |
| Turnaround SLA | "24h promise" | 保証であり典型値ではない。典型は2-6h |
| Workload triage | "interactivity decision" | Interactive / semi / batch の routing decision |
| Output schema | "response format" | provider ごとの JSONL layout。portable ではない |
| Stacked discount | "batch + cache" | 両方が効くと uncached sync bill の約10% |

## 参考資料

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) — JSONL format and `/v1/batches` semantics.
- [Anthropic Message Batches](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — batch format and `cache_control` interaction.
- [Vertex AI Batch Prediction](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction) — Gemini batch semantics.
- [Finout — OpenAI vs Anthropic API Pricing 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison)
- [Zen Van Riel — LLM API Cost Comparison 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)
