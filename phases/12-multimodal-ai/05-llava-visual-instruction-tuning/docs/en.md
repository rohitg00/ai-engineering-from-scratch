# LLaVA と Visual Instruction Tuning

> LLaVA (2023年4月) は、地球上で最も多く模倣された multimodal architecture である。BLIP-2 の Q-Former を 2-layer MLP に置き換え、Flamingo の gated cross-attention を素朴な token 連結に置き換え、text-only caption から GPT-4 が生成した 158k 件の visual-instruction turn で学習した。2023年から2026年に VLM を作った実務者は、ほぼ全員が LLaVA の何らかの変種を作った。LLaVA-1.5 は AnyRes を追加した。LLaVA-NeXT は解像度を上げた。LLaVA-OneVision は image、multi-image、video を1つの recipe に統合した。この lesson では recipe を読み、projector を実装し、なぜ「単純なほうが勝った」のかを説明する。

**種別:** 構築
**言語:** Python (stdlib、projector + instruction-template builder)
**前提条件:** Phase 12 · 02 (CLIP)、Phase 11 (LLM Engineering — instruction tuning)
**所要時間:** 約180分

## 学習目標

- ViT patch embedding (dim 1024) を LLM embedding dim (dim 4096) に写像する 2-layer MLP projector を構築する。
- LLaVA の2段階 recipe を追う: (1) 558k caption pair での projector alignment、(2) GPT-4 生成の 158k turn での visual instruction tuning。
- image token placeholder、system prompt、user/assistant turn を含む LLaVA 形式の prompt を組み立てる。
- Q-Former が token budget で有利だったにもかかわらず、community が Q-Former から MLP に移った理由を説明する。

## 問題

BLIP-2 の Q-Former (Lesson 12.03) は画像を 32 tokens に圧縮する。きれいで、効率的で、benchmark でも強い。しかし2つの問題がある。

第一に、Q-Former は trainable だが、その loss は最終 task ではない。Stage 1 は ITC+ITM+ITG を学習し、Stage 2 は LM loss を学習する。queries は中間表現のようなものを学び、それを LLM がさらに decode しなければならない。bottleneck で情報が失われる。

第二に、Q-Former は 188M params を持ち、LLaVA が登場した2023年の scale では target LLM と一緒に設計する必要があった。LLM を変えれば Q-Former を再学習する。vision encoder を変えても再学習する。組み合わせごとに別の R&D project になってしまう。

LLaVA の答えは、拍子抜けするほど単純だった。ViT の 576 patch tokens を取り、それぞれを 2-layer MLP (`1024 → 4096 → 4096`) に通し、576 個すべてを LLM の input sequence に流し込む。bottleneck はない。奇妙な objective での stage 1 pretraining もない。MLP を direct LM loss で学習するだけである。

data はどこから来るのか。LLaVA の2つ目の insight は、GPT-4 (text-only) を使って instruction data を生成することだった。画像の COCO caption と bounding-box data を GPT-4 に渡し、会話、説明、複雑な reasoning question を生成させる。158k 件の instruction-response turn が無料で得られる。人手 annotation は不要である。

結果として、8枚の A100 で1日走り、MMMU で Flamingo を上回り、community が拡張できる open checkpoint を出荷する VLM が生まれた。2023年末までに 50 以上の fork が派生していた。

## コンセプト

### アーキテクチャ

LLaVA-1.5 の 13B 構成:

- Vision encoder: CLIP ViT-L/14 @ 336 (stage 1 では frozen、stage 2 では任意で unfreeze)。
- Projector: GELU activation 付き 2-layer MLP、`1024 → 4096 → 4096`。
- LLM: Vicuna-13B (後に Llama-3.1-8B)。

image + text prompt の forward pass:

```
img -> ViT -> dim 1024 の 576 patches
patches -> MLP -> dim 4096 の 576 tokens
prompt: system + "<image>" placeholder + user question
<image> token を 576 個の projected tokens に置き換える
full sequence を LLM に入力する
response を decode する
```

画像は LLM context の 576 tokens を占める。2048 context では text に 1472 tokens 残る。32k context では丸め誤差に近い。

### Stage 1: projector alignment

ViT を freeze する。LLM を freeze する。2-layer MLP だけを学習する。Dataset は 558k 件の image-caption pairs (LAION-CC-SBU)。Loss は projected image tokens を条件にした caption の language modeling。

batch 128 の single epoch なら数時間で終わる。projector は ViT-space を LLM-space に写像する方法を学ぶ。task-specific supervision はない。

### Stage 2: visual instruction tuning

projector は unfreeze のまま trainable にする。LLM も unfreeze する (通常は full、場合によって LoRA)。158k 件の visual-instruction turn で学習する。

instruction data が肝である。Liu らは次の手順で生成した。

1. COCO image を取る。
2. text description (5件の人手 caption + bounding-box list) を抽出する。
3. 3つの prompt template で GPT-4 に送る。
   - Conversation: 「この画像について user と assistant の往復 dialogue を生成せよ。」
   - Detailed description: 「画像を豊かで詳細に説明せよ。」
   - Complex reasoning: 「画像について reasoning が必要な質問を作り、それに答えよ。」
4. GPT-4 の出力を (instruction, response) pair に parse する。

この処理は画像そのものには一切触れない。text description だけを使う。GPT-4 はありそうな画像内容を hallucinate する。noise はあるが機能した。158k turn で dialogue 能力を開くには十分だった。

### Community がこれをコピーした理由

- tuning が必要な stage-1 固有 loss がない。最初から最後まで LM loss。
- Projector は日単位ではなく時間単位で学習できる。
- Projector だけを再学習すれば LLM を差し替えられる (LLaVA-Llama2、LLaVA-Mistral、LLaVA-Llama3)。
- Visual-instruction data pipeline は GPT-4 を使い、新しい domain 向けに安価に再生成できる。

### LLaVA-1.5 と LLaVA-NeXT

LLaVA-1.5 (2023年10月) が追加したもの:

- Academic-task data (VQA、OKVQA、RefCOCO) を instruction tuning に混ぜた。
- より良い system prompt。
- 2048 → 32k context。

LLaVA-NeXT (2024年1月) が追加したもの:

- AnyRes: 高解像度画像を 336x336 crop の 2x2 または 1x3 grid に分割し、さらに global low-res thumbnail を1つ加える。各 crop は 576 tokens になる。合計で画像あたり約 2880 visual tokens。OCR と chart task が大きく伸びた。
- ShareGPT4V (高品質 GPT-4V captions) を使った、より良い instruction data mixture。
- より強い base LLM (Mistral-7B、Yi-34B)。

### LLaVA-OneVision

Lesson 12.08 で OneVision を詳しく扱う。短く言えば、同じ projector を使うが、single-image、multi-image、video を共有 visual-token budget で1つの model に学習させる curriculum を使う。

### Q-Former との比較

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| 画像あたりの visual tokens | 32 | 576 (base) または 2880 (AnyRes) |
| Trainable params | 188M + LM | 40M + LM |
| Stage 1 loss | ITC+ITM+ITG | LM のみ |
| LLM drop-in | 再学習が必要 | 最小限の再学習で差し替え |
| Multi-image | 扱いにくい | 自然 (concat) |
| Video | 扱いにくい | 自然 (frame ごとに concat) |
| Token budget | 小さい | 大きい |

MLP は単純さと token の柔軟性で勝つ。Q-Former は token budget で勝つ。2023年末には token budget が制約ではなくなり (LLM context は 32k-128k+ に伸びた)、単純さが支配的になった。

### Prompt format

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>` は placeholder token である。tokenization の前に、576 個の visual tokens (AnyRes なら 2880) に置き換えられる。Tokenizer から見ると学習時より少し長い sequence だが、stage 1 で学んでいるため LLM は novel input を扱える。

### Parameter economy

LLaVA-1.5-7B の内訳:

- CLIP ViT-L/14 @ 336: 303M (stage 1 は frozen、stage 2 ではしばしば unfreeze)。
- Projector (2x linear): 約22M trainable。
- Llama-7B: 7B。
- 合計: 7.3B params。stage 2 で trainable なのは full 7B + 22M projector。

Stage 2 の training cost は 8xA100 で約20時間。この数字が重要である。1日、1 node、再現可能。だから LLaVA は広がった。

## 使ってみる

`code/main.py` は次を実装する。

1. 純粋な Python による 2-layer MLP projector (toy scale では dim 16 → 32 → 32)。
2. prompt-building pipeline: system prompt + `<image>` を N 個の projected tokens に置換 + user turn + assistant generation placeholder。
3. 576-token visual block が LLM context の中でどう見えるかの visualizer (2k / 32k / 128k context の何%を消費するか)。

## 仕上げ

この lesson は `outputs/skill-llava-vibes-eval.md` を生成する。LLaVA-family checkpoint を受け取り、10 prompt の vibes-eval suite (captioning 3件、VQA 3件、reasoning 2件、refusal 2件) を走らせ、人間が読める scorecard を出す。benchmark ではない。projector と LLM が正しく接続されているかを確認する smoke test である。

## 演習

1. `1024 → 4096 → 4096` の 2-layer MLP projector の trainable parameter count を計算せよ。GELU と bias を含めると、LLaVA-13B の何割を占めるか。

2. 「refusal」case 用の LLaVA prompt を作れ。画像には private individual が含まれている。期待される assistant response を書け。LLaVA はなぜ zero-shot で拒否すべきか。その拒否を強めるにはどのような training data が必要か。

3. LLaVA-NeXT blog の AnyRes section を読め。AnyRes で 1344x672 image の visual token count を計算せよ。336x336 の base 576 tokens と比較せよ。

4. LLaVA stage-1 projector は captions の LM loss で学習する。stage 1 を飛ばして、いきなり stage 2 (visual instruction tuning) に進むと何が起きるか。答えには Prismatic VLMs ablation (arXiv:2402.07865) を引用せよ。

5. LLaVA-Instruct-150k は COCO captions と GPT-4 を使って instructions を生成する。新しい domain (medical X-rays、satellite imagery) 向けに、domain instructions を生成する4 step data pipeline を説明せよ。各 step で何が失敗しうるか。

## 重要語句

| Term | よく言われる表現 | 実際の意味 |
|------|----------------|------------|
| Projector | "MLP bridge" | ViT dim を LLM dim に写像する GELU 付き 2-layer MLP |
| Image token | "<image> placeholder" | inference 前に N 個の projected visual tokens に置き換えられる prompt marker |
| Visual instruction tuning | "LLaVA stage 2" | GPT-4 生成の (image, instruction, response) triplets での training |
| Stage 1 alignment | "Projector pretraining" | ViT と LLM を freeze し、captions の LM loss で projector を学習する |
| AnyRes | "Multi-crop tiling" | 高解像度画像を tile grid に分割し、各 tile の visual tokens を連結する |
| LLaVA-Instruct | "GPT-4-generated" | COCO captions + GPT-4 から合成された 158k instruction-response pairs |
| Vision encoder freeze | "Backbone locked" | stage 1 では CLIP weights を更新せず、stage 2 でも更新しないことがある |
| ShareGPT4V | "Better captions" | GPT-4V で生成した 1M dense captions。より高品質な alignment に使う |
| VQA | "Visual question answering" | 画像についての free-form question に答える task |
| Prismatic VLMs | "Design-space paper" | projector と data choice を体系的に検証した Karamcheti 2024 の ablation |

## 参考文献

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) — LLaVA 論文。
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) — LLaVA-1.5。
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) — dense captions dataset。
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) — design-space ablations。
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) — unified single-image、multi-image、video。
