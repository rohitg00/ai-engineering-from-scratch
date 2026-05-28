# Long-Video Understanding at Million-Token Context

> 24 FPS の1時間 4K video を patch 化して embedding すると、およそ 6000万 tokens になります。2時間の podcast episode の transcription は 30,000 tokens です。Blu-ray の feature film 全体は、aggressive pooling で圧縮しても数十万 tokens になります。Google の Gemini 1.5 (2024年3月) は 10-million-token context でこの時代を開き、1時間級 video に対して信頼できる needle-in-a-haystack recall を実現しました。LWM (Liu et al., 2024年2月) は ring attention の scaling path を示しました。LongVILA と Video-XL は ingestion をさらに拡張しました。VideoAgent は raw context を agentic retrieval に置き換えました。それぞれの approach は compute、recall、engineering complexity の異なる trade-off です。この lesson ではそれらを横並びで読みます。

**種別:** 構築
**言語:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router)
**前提条件:** Phase 12 · 17 (video temporal tokens)
**所要時間:** 約180分

## 学習目標

- FPS と pooling を変えた long-form video の total visual-token counts を計算する。
- 3つの scaling path、brute context (Gemini 1.5)、ring attention (LWM)、token compression (LongVILA / Video-XL) を説明する。
- raw-context video VLM と agentic-retrieval video VLM (VideoAgent) を accuracy と latency で比較する。
- 30分 video の needle-in-a-haystack test を設計し、特定の minute で recall を測定する。

## 問題

384 native resolution の Qwen2.5-VL サイズの patches では、1 frame は約 729 tokens です。3x3 pooling なら 1 frame あたり 81 tokens です。1 FPS の30分 clip は 1800 frames、つまり 145,800 tokens になります。2025年の open VLM で扱えますが余裕はありません。2 FPS では 291,600 tokens になり、最大級の context でしか収まりません。

1 FPS の2時間 movie は 583k tokens です。多くの2026年 open models の範囲を超えます。Gemini 2.5 Pro を使うか、より aggressive に pooling する必要があります。

3つの scaling path が現れました。

## コンセプト

### Path 1: Brute context (Gemini 1.5, Claude Opus)

問題を hardware で押し切ります。context を millions of tokens まで拡張し、すべてを1回の forward pass で処理します。

Gemini 1.5 Pro は 1M tokens で登場し、Gemini 1.5 Ultra は 10M まで到達しました。2026年の Gemini 2.5 Pro は数時間の video を信頼して扱えます。論文 (arXiv:2403.05530) では、約 9.5M tokens までの needle-in-a-haystack recall が 99.7% と報告されています。

Engineering: memory hierarchy (local + global + sparse) を持つ custom attention implementation と、long-context efficiency のための MoE expert routing。完全な詳細は公開されておらず、open-source でもありません。

### Path 2: Ring attention (LWM, LongVILA)

Ring attention は long sequence を devices に分散し、各 device が chunk を持つ "ring" を作ります。full sequence 全体の attention は、各 device が自分の chunk を ring pattern で次の device に送り、partial attention を計算し、集約することで実現します。

LWM (Liu et al., 2024) はこの方法で 1M-token context model を訓練しました。training compute は context に対して二次ではなく線形に scale します。attention の二次コストは ring の devices 全体に amortize されます。

LongVILA (arXiv:2408.10188) はこの pattern を VLM に適用しました。1 frame あたり 192 tokens の 1400-frame videos、つまり 268k context を、8-way parallelism の ring attention で訓練しました。

### Path 3: Token compression (Video-XL, LongVA)

brute context より安い方法です。LLM が sequence を見る前に aggressive に圧縮します。

Video-XL (arXiv:2409.14485) は visual summary token を使います。N frames の各 clip は、その N に attention する単一の "summary" token を生成します。inference では LLM は clip ごとに1つの summary token だけを見るため、context が大幅に縮みます。

LongVA は "long context transfer" technique で LLM context を 200k から 2M へ拡張します。long-context text で訓練し、shared representation 経由で long-context video に transfer します。

Token compression は scalability と引き換えに、specific timestamps での recall を落とします。model は何が起きたかを大まかに知りますが、exact frames を見落とすことがあります。

### Path 4: Agentic retrieval (VideoAgent)

full video を LLM に入れません。代わりに video を database として扱い、LLM に query させます。

VideoAgent (arXiv:2403.10517):

1. LLM が question を読む。
2. LLM が retrieval tool に relevant clips を依頼する (「猫が出る segment を見せて」)。
3. tool が matching clip timestamps を返す。
4. LLM がその clips を VLM 経由で読む。
5. LLM が answer を構成するか、follow-up queries を投げる。

これは LLM-as-agent pattern を long video に適用したものです。inference は安くなります (relevant clips だけ encode) が、engineering は難しくなります (retrieval quality が bottleneck になる)。

### Needle-in-a-haystack benchmarks

標準的な long-context test です。video の random point に unique な visual または textual marker を挿入し、それを思い出す必要がある query を投げます。

metric は、video length と marker position にわたる Recall@k です。

Gemini 2.5 Pro は最長90分の video で >99% recall を記録します。Open 72B models (Qwen2.5-VL-72B、InternVL3-78B) は30分で約 85-90% となり、60分を超えると劣化します。

VideoAgent は2時間超で raw-context models に並ぶか上回ることがあります。tool が優秀なら retrieval が needle に到達できるからです。

### どの path を選ぶか

frontier accuracy が必要な15分 clip では、open 72B + native context が通常機能します。Qwen2.5-VL-72B を選びます。

30分から1時間の content では、open なら LongVILA または Video-XL、closed なら Gemini 2.5 Pro です。quality bar が重要です。frontier は closed になります。

2時間超の content では、VideoAgent または類似の retrieval patterns を使います。別案として、小さな chunks に summarize し、hierarchical summaries を入力します。

### 2026年の production pattern

実運用の long-video pipeline は hybrid です。

1. video 全体に dynamic-FPS sampling + aggressive pooling を実行する (100k-token global representation を得る)。
2. 72B VLM に渡して global summary を作る。
3. user が詳細な質問をしたら、summary を index として agentic retrieval を実行する。

これにより、global understanding には brute-context、local detail には retrieval を組み合わせられます。

## 使ってみる

`code/main.py`:

- 1分から3時間までの video について、さまざまな FPS + pooling で token budgets を計算します。
- needle-in-a-haystack run を simulate します。random timestamp に marker を注入し、question を投げ、recall を採点します。
- downstream VLM に渡す specific clips を選ぶ agentic-retrieval router simulator を含みます。

budget table を実行し、scale gap を体感してください。

## 仕上げ

この lesson は `outputs/skill-long-video-strategy-planner.md` を生成します。video duration と query complexity を受け取り、brute-context、compression、agentic retrieval のどれを使うか選び、latency + quality expectations を計算します。

## 演習

1. 45分 lecture、1 FPS、1 frame あたり 81 tokens。total tokens はいくつですか。どの model の context に収まりますか。

2. needle-in-a-haystack test を設計してください。marker を何分時点に挿入し、exact query format はどうしますか。

3. 1時間 video で brute-context Qwen2.5-VL-72B (80k context) と VideoAgent (Claude 3.5 + retrieval) を比較してください。recall ではどちらが勝ちますか。latency ではどちらが勝ちますか。

4. Ring attention の memory cost は sequence length と device count に対して線形に scale します。なぜそうなるか、ring-rotation phase を落とすと何が壊れるか説明してください。

5. Gemini 1.5 の Section 5、needle-in-a-haystack を読んでください。1M と 10M token boundary での recall について、論文は何を示しましたか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Brute context | 「Just more tokens」 | LLM context を millions of tokens に拡張し、すべてを1 pass で処理すること |
| Ring attention | 「LWM-style parallel」 | 各 device が chunk を持ち rotation する distributed attention pattern |
| Token compression | 「Summary tokens」 | LLM の前に learned compressor で per-clip tokens を減らすこと |
| Needle-in-haystack | 「NIH test」 | random point に unique marker を挿入し、test time に model に思い出させること |
| Agentic retrieval | 「LLM as query planner」 | LLM が retrieval tool に relevant clips を依頼し、VLM で読み、answer を構成すること |
| VideoAgent | 「Retrieval pattern for video」 | question -> tool -> clip -> answer という canonical agentic-retrieval design |

## 参考文献

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
