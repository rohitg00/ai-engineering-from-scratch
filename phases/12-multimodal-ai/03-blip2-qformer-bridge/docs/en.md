# CLIP から BLIP-2 へ — Modality Bridge としての Q-Former

> CLIP は image と text を align しますが、caption を生成したり、質問に答えたり、会話を続けたりはできません。BLIP-2 (Salesforce, 2023) は、小さな trainable bridge でこれを解決しました。32 個の learnable query vector が frozen ViT の feature に cross-attention し、そのまま frozen LLM の input stream に入ります。188M parameters の bridge が、11B LLM と ViT-g/14 を接続しました。2026 年までの adapter-based VLM、MiniGPT-4、InstructBLIP、LLaVA の親戚は、すべてこの子孫です。この lesson では Q-Former architecture を読み、two-stage training を説明し、visual token を frozen text decoder へ渡す toy version を作ります。

**種別:** 構築
**言語:** Python (stdlib、cross-attention + learnable-query demo)
**前提条件:** Phase 12 · 02 (CLIP)、Phase 7 (Transformers)
**所要時間:** ~180 分

## 学習目標

- frozen vision encoder と frozen LLM の間に trainable bottleneck を置くと、end-to-end finetuning より cost と stability で有利になる理由を説明する。
- 固定個数の learnable query が external image features に attend する cross-attention block を実装する。
- BLIP-2 の two-stage pretraining、representation (ITC + ITM + ITG) の後に generative (frozen decoder での LM loss) をたどる。
- Q-Former と LLaVA が使うより単純な MLP projector を比較し、どちらが勝つかを議論する。

## 問題

image ごとに dim 1408 の 256 patch token を出す frozen ViT があります。token embedding dim 4096 を期待する frozen 7B LLM があります。明らかな bridge は 1408 から 4096 への linear layer です。これは機能しますが、256 個の patch token をすべて LLM context に入れるため、image あたり 256 extra token を消費します。batch 32 images では、visual modality だけで 8192 token を使います。

BLIP-2 の問いはこうです。256-token の image representation を、caption、question answering、image reasoning に十分な情報を保ったまま、もっと少ない token (たとえば 32) へ圧縮できるか。そして frozen backbone には触れず、bridge parameter だけの training cost でこの bridge を train できるか。

答えは Q-Former です。32 個の learnable "query" vector が ViT の patch token に cross-attend し、LLM が消費する 32-token visual summary を生成します。total 188M parameters。LLM に触れる前に、contrastive、matching、generative objectives で train します。

## 概念

### Learnable queries

Q-Former の core trick は、LLM の text token を image patch に attend させるのではなく、32 個の learnable query vector `Q` を導入し、それらを image patch に attend させることです。query は model の parameter であり、training 中に学習され、同じ 32 query がすべての image に使われます。

cross-attention 後、各 query は画像の圧縮 summary を保持します。「main object を説明する」「background を説明する」「object を数える」などです。query が literal に semantic label へ specialize するわけではありません。downstream loss を下げる encoding を学習します。

### Architecture

Q-Former は 2 つの path を持つ small transformer (12 layers、約 100M params) です。

1. Query path: 32 個の query vector が self-attention (query 同士)、frozen ViT patch token への cross-attention、FFN を通る。
2. Text path: BERT-like text encoder が query path と self-attention / FFN weight を共有する。text path では cross-attention は disabled。

training 時には両 path が動きます。query と text は shared self-attention を通じて相互作用するため、ITM や ITG のように必要な task では query が text に condition できます。VLM handoff の inference 時には query だけが流れ、32 visual token を出します。

### Two-stage training

BLIP-2 は 2 stage で pretrain します。

Stage 1: representation learning (LLM なし)。3 つの loss:
- ITC (image-text contrastive): pooled query token と text CLS token の CLIP-style contrastive。
- ITM (image-text matching): binary classifier。この image-text pair は match しているか。hard-negative-mined。
- ITG (image-grounded text generation): query に condition した text の causal LM head。query に text-generatable content を encode させる。

train するのは Q-Former だけです。ViT は frozen。LLM は関与しません。

Stage 2: generative learning。frozen LLM (OPT-2.7B、Flan-T5-XL など) を接続します。32 query output を小さな linear layer で LLM embedding dim へ project します。それを text prompt の前に prepend します。concatenated prompt + image + caption sequence の LM loss で、linear projection と Q-Former だけを train します。

stage 2 の後、Q-Former + projection が full visual adapter になります。inference では image -> ViT -> Q-Former -> linear proj -> text の前に prepend -> frozen LLM が output を生成、という流れです。

### Parameter economics

BLIP-2 with ViT-g/14 (1.1B, frozen) + OPT-6.7B (6.7B, frozen) + Q-Former (188M, trained) = total 8B、trained 188M。Q-Former 単体は full stack parameter の約 2.4% です。training cost もこれを反映します。少数の A100 で数日、end-to-end なら数週間です。

quality: BLIP-2 は zero-shot VQA で Flamingo-80B に匹敵または上回りながら、50x smaller です。この bridge は機能します。

### InstructBLIP and the instruction-aware Q-Former

InstructBLIP (2023) は Q-Former に追加 input として instruction text 自体を入れます。cross-attention 時に query は image patch と instruction の両方へ access できます。query は固定 summary を 1 つ学習するのではなく、instruction ごとに specialize できます ("count the cars"、"describe the mood")。held-out task の benchmark が改善します。

### MiniGPT-4 and the projector-only approach

MiniGPT-4 は Q-Former を残しましたが、それ以外を凍結し、output linear projection だけを train しました。安い一方、quality の cost があります。query は BLIP-2 のものであって、自分のものではありません。rapid iteration には良いですが、best architecture ではありません。

### Why LLaVA went simpler

LLaVA (2023, Lesson 12.05) は Q-Former を plain 2-layer MLP に置き換えました。すべての ViT patch token を LLM space へ project し、24x24 grid なら image あたり 576 token を全部 LLM に渡します。compression は悪いですが、LLM は raw patch に attend できます。当時これは議論を呼びましたが、2023 年後半には visual instruction data (LLaVA-Instruct-150k) により、MLP が十分な signal を保持するよう train できることが示され、支配的になりました。tradeoff は、LLaVA は context を速く埋めるが、multi-image や video へ自然に scale することです。

2026 年時点で field は分かれています。Q-Former は token budget が重要な場面 (long video、多数 image) で生き残り、MLP projector は raw quality per token が優先の場面を支配しています。

### Gated cross-attention: Flamingo, the ancestor

Flamingo (Lesson 12.04) は BLIP-2 に先行し、同じ cross-attention idea を使いましたが、single bridge ではなく frozen LLM のすべての layer で使いました。BLIP-2 は input layer だけに圧縮しても機能することを示しました。Gemini と Idefics は両方を組み合わせます。interleaved input token と、in-context few-shot のための optional gated cross-attention です。

### The 2026 descendants

- Q-Former: BLIP-2、InstructBLIP、MiniGPT-4、token budget の理由から多くの video-language models。
- Perceiver resampler: Flamingo variant (Lesson 12.04)、Idefics family、Eagle、OmniMAE。
- MLP projector: LLaVA、LLaVA-NeXT、LLaVA-OneVision、Cambrian-1。
- Attention pool: VILA、PaliGemma。

4 つすべてが valid です。決める問いは、token budget に制約されているのか、quality-per-token に制約されているのかです。

## 使ってみる

`code/main.py` は stdlib の Q-Former-style cross-attention を作ります。

1. 256 個の image patch token (dim 128) を simulate。
2. 32 個の learnable query (dim 128) を instantiate。
3. scaled-dot-product cross-attention を実行 (Q は query、K/V は patch)。
4. linear layer で LLM-dim (512) へ project。
5. 32 個の LLM-ready visual token を出力。

math はすべて pure Python (vector の nested loop) です。toy ですが shape は正しいです。attention-weight matrix が表示されるので、各 query がどの patch から情報を取ったか確認できます。

## 仕上げ

この lesson は `outputs/skill-modality-bridge-picker.md` を作ります。target VLM configuration (vision encoder token count、LLM context budget、deployment constraints、quality target) が与えられると、Q-Former、MLP、Perceiver resampler のどれを使うべきか、短い justification と各 bridge の parameter-count estimate 付きで推奨します。

## 演習

1. PyTorch で cross-attention block を実装してください。32 queries と 256 keys/values のとき、attention-weight matrix が 32 x 256 で、softmax 後に各 row が 1 に sum することを確認してください。

2. BLIP-2 stage 1 では Q-Former が ITC、ITM、ITG の 3 loss を同時に走らせます。それぞれの forward signature を pseudo-code で書いてください。text encoder path を active にする必要があるのはどれですか。

3. parameter count を比較してください。Q-Former (12 layers, 768 hidden) と 2-layer MLP projector (1408 -> 4096, two layers)。どの LLM scale で 188M Q-Former の cost が training efficiency として回収されますか。

4. BLIP-2 paper (arXiv:2301.12597) の Section 3.2、Q-Former の initialization を読んでください。BERT-base から initialize すること (random ではなく) が convergence を速める理由を説明してください。

5. 10 分 video を 1 FPS で sampling して 60 frames にした場合、(Q-Former -> 32 tokens/frame) と (MLP projector -> 576 tokens/frame) の per-frame token cost を計算してください。128k-token LLM context window に入るのはどちらですか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Q-Former | 「Querying transformer」 | frozen ViT feature に cross-attend する 32 個の learnable query vector を持つ small transformer |
| Learnable queries | 「Soft prompt for vision」 | cross-attention の query 側として機能する fixed parameter set。model ごとに学習され、すべての input で共有 |
| Cross-attention | 「Q from here, K/V from there」 | query、key、value が異なる source から来る attention。query が ViT patch から情報を引く方法 |
| ITC | 「Image-text contrastive」 | Q-Former pooled query と text CLS に適用する CLIP-style loss |
| ITM | 「Image-text matching」 | hard-negative-mined pair に対する binary classifier。query に fine-grained mismatch を識別させる |
| ITG | 「Image-grounded text generation」 | query に condition して text を生成する causal LM loss。query に text-decodable content を encode させる |
| Two-stage pretraining | 「Representation then generative」 | Stage 1 は Q-Former だけを train (ITC/ITM/ITG)。Stage 2 は frozen LLM を接続し、projection + Q-Former だけを train |
| Frozen backbone | 「Do not finetune」 | vision encoder と LLM の weight は固定。bridge だけを train |
| Projection head | 「Linear to LLM dim」 | Q-Former output を LLM embedding dimension へ mapping する final linear layer |
| Perceiver resampler | 「Flamingo's version」 | 類似した learnable-query cross-attention。single bridge ではなく Flamingo では各 layer で使用 |

## 参考文献

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) — core paper。
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) — ITC/ITM/ITG trio を持つ predecessor。
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) — "align before fuse"、stage 1 training の conceptual ancestor。
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) — instruction-aware Q-Former。
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) — projector-only approach。
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — learnable-query cross-attention の general architecture。
