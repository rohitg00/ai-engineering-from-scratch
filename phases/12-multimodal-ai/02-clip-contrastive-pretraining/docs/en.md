# CLIP と Contrastive Vision-Language Pretraining

> OpenAI の CLIP (2021) は、次の 5 年を支えるほど大きな 1 つの idea を示しました。noisy な web image-caption pair だけを使い、contrastive loss で image encoder と text encoder を同じ vector space に align する、という idea です。supervised label はゼロ。400M pairs。その結果得られた embedding space は zero-shot classification、image-text retrieval を行い、2026 年のあらゆる VLM に vision tower として接続されます。SigLIP 2 (2025) は softmax を sigmoid に置き換え、より低い cost で CLIP を超えて scale しました。この lesson では InfoNCE から sigmoid pairwise loss までの math をたどり、stdlib Python で training step を実装します。

**種別:** 構築
**言語:** Python (stdlib、InfoNCE + sigmoid loss implementations)
**前提条件:** Phase 12 · 01 (ViT patches)、Phase 7 (Transformers)
**所要時間:** ~180 分

## 学習目標

- mutual information から InfoNCE loss を導出し、numerically-stable な vectorized version を実装する。
- sigmoid pairwise loss (SigLIP) が、softmax の all-gather overhead なしで batch 32768+ へ scale できる理由を説明する。
- text template (`a photo of a {class}`) を構成し、cosine similarity の argmax を取って zero-shot ImageNet classification を実行する。
- CLIP / SigLIP pretraining が与える 4 つの lever を挙げる: batch size、temperature、prompt template、data quality。

## 問題

CLIP 以前の vision は supervised でした。labeled dataset (ImageNet: 1.2M images、1000 classes) を集め、CNN を train し、ship する。label は高価で、labeler が合意できるものへ bias し、新しい task へは finetuning なしで転移しにくい。

image-caption web には、ゆるく label 付けされた 10 億超の pair が無料で存在します。golden retriever の写真に alt text "my dog Max in the park" が付いていれば、text が image を説明しているという supervisory signal があります。問いは、これを有用な training に変換できるかです。

CLIP の答えは、image-caption pair を matching task として扱うことでした。N 枚の image と N 個の caption の batch が与えられたら、各 image を自分の caption と、N-1 個の distractor に対して match できるように学習する。supervision は「この 2 つは対応する。この N-1 個は対応しない」です。class label なし。human annotation なし。contrastive loss だけです。

得られる embedding space は、CLIP が直接 train された用途を超えます。"a photo of a cat" が、明示的に cat と label されていない猫画像の近くへ embed されるため、ImageNet zero-shot が機能します。これが 2026 年のあらゆる VLM を生んだ賭けです。

## 概念

### The dual encoder

CLIP には 2 つの tower があります。

- Image encoder `f`: ViT または ResNet。image ごとに D-dim vector を出力する。
- Text encoder `g`: small transformer。caption ごとに D-dim vector を出力する。

両 tower は output を unit length に normalize します。どちらも unit-norm なので similarity は `cos(f(x), g(y)) = f(x)^T g(y)` です。

N 個の (image, caption) pair の batch について、shape `(N, N)` の similarity matrix `S` を作ります。

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

ここで `tau` は learned temperature です (CLIP は 0.07 で初期化し、log-space で学習)。

### InfoNCE loss

CLIP は row と column の symmetric cross-entropy を使います。

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

これが InfoNCE です。CE 内の softmax は、各 image が batch 内の他の caption より自分の caption に強く match するよう強制します。「negative」は他の batch item すべてです。bigger batch = more negatives = stronger signal。CLIP は batch 32k で training されました。scale が重要です。

### Temperature

`tau` は softmax の sharpness を制御します。low tau -> sharp distribution、hard negative mining 的な効果。high tau -> soft で、すべての sample が寄与。CLIP は `log(1/tau)` を学習し、collapse を防ぐため clip します。SigLIP 2 は initial tau を固定し、代わりに learned bias を使います。

### Why sigmoid scales better (SigLIP)

Softmax は similarity matrix 全体を同期する必要があります。distributed training では、すべての embedding をすべての replica へ all-gather してから softmax します。communication は world size に対して quadratic です。

SigLIP は softmax を element-wise sigmoid に置き換えます。各 pair `(i, j)` について、「これは matching pair か」を binary classification する loss です。positive class label は diagonal、他はすべて negative です。loss は次の通りです。

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` if `i == j`, else 0。各 pair の loss は独立しています。all-gather は不要です。各 GPU は local block を計算して sum します。SigLIP 2 は batch 32k-512k へ安価に scale し、CLIP が必要とする比例的な communication を避けます。

### Zero-shot classification

N 個の class name があるとき、各 class について text template を作ります。

```
"a photo of a {class}"
```

各 template を text encoder で embed します。画像を image encoder で embed します。cosine similarity の argmax が predicted class です。target class で training はしません。

Prompt template は重要です。CLIP の original paper は class ごとに 80 個の template (plain、artistic、photo、painting など) を使い、embedding を平均しました。ImageNet で +3 point。modern usage では 1-2 個の template を選ぶことが多いです。

### Linear probes and finetuning

Zero-shot は baseline です。linear probe (target class のために frozen CLIP feature 上へ linear layer だけを train) は in-domain task で zero-shot を上回ります。full finetuning は in-domain で linear probe を上回りますが、zero-shot transfer を損なうことがあります。3 つの regime には 3 つの trade-off があります。

### SigLIP 2: NaFlex and dense features

SigLIP 2 (2025) は次を追加します。

- NaFlex: single model が variable aspect ratio と resolution を扱う。
- segmentation や depth estimation 向けの better dense features。VLM の frozen backbone としての利用を狙う。
- Multilingual: CLIP が English-only だったのに対し、100+ languages で training。
- 1B param scale。CLIP は 400M で頭打ちでした。

2026 年の open VLM では、SigLIP 2 SO400m/14 が default vision tower です。CLIP は、特定の LAION-2B training distribution が query pattern と合う pure image-text retrieval では依然として default です。

### ALIGN, BASIC, OpenCLIP, EVA-CLIP

ALIGN (Google, 2021): CLIP と同じ idea、1.8B pair scale、90% noisy。noisy data が scale することを示しました。OpenCLIP (LAION): LAION-400M / 2B 上の CLIP open reproduction。複数 scale があり、go-to open checkpoint。EVA-CLIP: masked image modeling から initialization。VLM の強い backbone。BASIC: Google の CLIP+ALIGN hybrid。どれも同じ family で、data と tuning が違います。

### The zero-shot ceiling

CLIP-class model は ImageNet zero-shot で約 76% (CLIP-G、OpenCLIP-G) 付近に上限があります。それ以上には、はるかに大きな data (SigLIP 2 は 80%+) または architecture change (supervised head、more parameters) が必要です。benchmark は飽和しつつあります。真の価値は downstream VLM が消費する embedding space です。

## 使ってみる

`code/main.py` は次を実装しています。

1. toy dual encoder (hash-based image features、text char features)。numpy なしで InfoNCE の shape を確認できる。
2. pure Python の InfoNCE loss (log-sum-exp による numerical stability)。
3. 比較用の sigmoid pairwise loss。
4. zero-shot classification routine: text prompt set との cosine similarity を計算し、argmax で prediction。

実行して loss curve を見てください。absolute number は toy ですが、shape は real CLIP trainer が出すものと一致します。

## 仕上げ

この lesson は `outputs/skill-clip-zero-shot.md` を作ります。image set (path 経由) と target class list が与えられると、CLIP template で text prompt を作り、指定 checkpoint (例: `openai/clip-vit-large-patch14`) で両側を embed し、similarity score 付きの top-1 / top-5 prediction を返します。この skill は prompt list に含まれない class について主張しません。

## 演習

1. 4 pair の batch について InfoNCE を手計算で実装してください。4x4 similarity matrix を作り、softmax を実行し、diagonal を取り出して cross-entropy を計算します。Python implementation をこの手計算と照合してください。

2. SigLIP は temperature に加えて bias parameter `b` を使います: `S'[i,j] = S[i,j]/tau + b`。batch に大きな class imbalance (row あたり positive より negative が圧倒的に多い) があるとき、`b` はどんな役割を果たしますか。SigLIP Section 3 (arXiv:2303.15343) を読んでください。

3. cats vs dogs の zero-shot classifier を作ってください。`a photo of a {class}` と `a picture of a {class}` の 2 つの prompt template を試します。100 枚の test image で accuracy を測定してください。template ensemble は single より良いですか。

4. batch 32k、512-GPU run で softmax InfoNCE と sigmoid pairwise の communication cost を計算してください。どちらが O(N) で、どちらが O(N^2) に scale しますか。SigLIP Section 4 を引用してください。

5. OpenCLIP scaling-laws paper (arXiv:2212.07143, Cherti et al.) を読んでください。図から data scaling の結論を再現します。fixed model size では、ImageNet zero-shot accuracy と training data size の log-linear relationship は何ですか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| InfoNCE | 「Contrastive loss」 | batch の similarity matrix に対する cross-entropy。各 item の positive は paired item、negative はそれ以外すべて |
| Sigmoid loss | 「SigLIP loss」 | pair ごとの binary cross-entropy。softmax なし、all-gather なしで distributed training に安く scale |
| Temperature | 「tau」 | softmax/sigmoid 前の logit を scale する scalar。distribution の sharpness を制御 |
| Zero-shot | 「no-finetune classification」 | text prompt で class embedding を作り、cosine similarity で classify。target class で training しない |
| Prompt template | 「a photo of a ...」 | class name の周囲に置く text scaffold。zero-shot accuracy に 1-5 point 影響する |
| Dual encoder | 「Two-tower」 | image encoder と text encoder が 1 つずつあり、shared D-dim space に出力する |
| Hard negative | 「Tough distractor」 | positive と十分似ていて、model が分離するために努力を要する negative |
| Linear probe | 「Frozen + one layer」 | frozen features の上で linear classifier だけを train。feature quality を測る |
| NaFlex | 「Native flexible resolution」 | resize なしで任意の aspect ratio と resolution の image を取り込める SigLIP 2 capability |
| Temperature scaling | 「log-parametrized tau」 | gradient を扱いやすくするため CLIP は `log(1/tau)` を parameterize し、near-zero tau への collapse を防ぐため clip する |

## 参考文献

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) — CLIP paper。
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) — SigLIP。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — multilingual + NaFlex。
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) — noisy web data での scale。
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) — OpenCLIP scaling laws。
