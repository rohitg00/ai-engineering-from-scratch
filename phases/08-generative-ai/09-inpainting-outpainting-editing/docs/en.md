# インペインティング、アウトペインティング、画像編集

> Text-to-image は新しいものを作ります。インペインティングは既存のものを直します。本番環境では、請求対象になる画像作業の 70% は編集です。背景を差し替える、ロゴを消す、キャンバスを拡張する、手を再生成する。インペインティングは、拡散モデルが実務で価値を発揮する場所です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**所要時間:** 約75分

## 課題

クライアントが、背景に目立つ看板が写り込んだ完璧な商品写真を送ってきたとします。看板だけを消し、それ以外はピクセル単位で同一のまま残したい。Text-to-image を最初から実行することはできません。結果は色も照明も商品の角度も変わってしまいます。再生成したいのは *マスクされた領域だけ* であり、その再生成には周囲の文脈を反映してほしい。

これがインペインティングです。派生形は次のとおりです。

- **Inpainting.** マスク内を再生成し、外側のピクセルを維持する。
- **Outpainting.** マスク外、またはキャンバスの外側を再生成し、内側を維持する。
- **Image editing.** 画像全体を再生成するが、元画像の意味的または構造的な忠実度を保つ (SDEdit, InstructPix2Pix)。

2026 年の拡散パイプラインは、どれもインペインティングモードを備えています。Flux.1-Fill、Stable Diffusion Inpaint、SDXL-Inpaint、DALL-E 3 Edit。原理は同じです。

## コンセプト

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### 素朴な方法と、それが誤っている理由

標準の text-to-image をマスク付きで実行します。各サンプリングステップで、ノイズを含む latent の非マスク領域を、クリーン画像を forward diffusion したものに置き換えます。動きはしますが、品質は低いです。モデルはマスク領域の中に何があるかを知らないため、境界のアーティファクトがにじみます。

### 適切なインペインティングモデル

4 ではなく 9 入力チャネルを受け取るように変更した U-Net を訓練します。

```python
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

追加チャネルは、VAE でエンコードした元画像のコピーと、単一チャネルのマスクです。訓練時には画像内の領域をランダムにマスクし、非マスク領域をクリーンな条件信号として与えながら、マスク領域だけを denoise するようにモデルを訓練します。推論時には、モデルはマスク領域の周囲を「見る」ことができ、一貫した補完を生成します。

SD-Inpaint、SDXL-Inpaint、Flux-Fill はすべて、この 9 チャネル、またはそれに相当する入力を使います。Diffusers では `StableDiffusionInpaintPipeline`、`FluxFillPipeline` です。

### SDEdit (Meng et al., 2022) - 再訓練なしの編集

元画像に中間の `t` までノイズを加え、その後、新しいプロンプトで `t` から 0 まで逆過程を実行します。再訓練は不要です。開始する `t` の選択により、忠実度と創造的自由度のトレードオフが決まります。

- `t/T = 0.3` → 元画像とほぼ同一で、小さなスタイル変更
- `t/T = 0.6` → 中程度の編集で、大まかな構造を維持
- `t/T = 0.9` → ほぼノイズから生成し、元画像の保持は最小限

### InstructPix2Pix (Brooks et al., 2023)

`(input_image, instruction, output_image)` の三つ組で拡散モデルを fine-tune します。推論時には、入力画像とテキスト指示 ("make it sunset", "add a dragon") の両方を条件にします。CFG スケールは 2 つあり、image scale と text scale です。

### RePaint (Lugmayr et al., 2022)

標準の無条件拡散モデルを使います。各逆ステップで resample します。つまり、時々よりノイズの多い状態へ戻り、再生成します。境界アーティファクトを避けられます。訓練済みのインペインティングモデルがない場合に使います。

## 実装

`code/main.py` は、5 次元データ上の簡易的な 1-D インペインティング方式を実装しています。サンプルが 2 つのクラスタのどちらかから来る 5 個の float である、5-D mixture data 上で DDPM を訓練します。推論時には 5 次元のうち 2 つを「マスク」し、各ステップで非マスク 3 次元に forward noise 版を注入し、マスク次元だけを再生成します。

### Step 1: 5-D DDPM data

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### Step 2: 5 次元すべてに対する denoiser を訓練する

標準的な DDPM です。ネットワークは、5-D noisy input に対する 5-D noise prediction を出力します。

### Step 3: 推論時の mask-aware reverse

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

これは素朴な方法であり、toy 1-D データでは機能します。実画像のインペインティングでは、テクスチャの一貫性がより重要なため、9 チャネル入力を使います。

### Step 4: outpainting

アウトペインティングは、マスクを反転したインペインティングです。新しい、以前は存在しなかったキャンバスをマスクし、残りを元画像で埋めます。訓練目的は同一です。

## 落とし穴

- **Seams.** 素朴な方法では、勾配情報がマスクをまたいで流れないため、目に見える境界が残ります。対策: マスクを 8-16 ピクセル膨張させるか、適切なインペインティングモデルを使う。
- **Mask leakage.** 条件画像の非マスク領域が低品質またはノイジーだと、マスク内の生成を汚染します。少し denoise するか blur します。
- **CFG interacts with mask size.** 小さいマスクに高い CFG を使うと、彩度の高いパッチになります。小さな編集では CFG を下げます。
- **SDEdit fidelity cliff.** `t/T = 0.5` から `t/T = 0.6` に上げるだけで、被写体の同一性を失うことがあります。スイープしてチェックポイントを残します。
- **Prompt mismatch.** プロンプトは新しい内容だけでなく、*画像全体* を説明するべきです。"a cat" ではなく "A cat sitting on a chair" です。

## 使いどころ

| タスク | パイプライン |
|------|----------|
| オブジェクト除去、小さいマスク | SD-Inpaint または Flux-Fill、標準プロンプト |
| 空の差し替え | SD-Inpaint + "blue sky at sunset" |
| キャンバス拡張 | SDXL outpaint mode (8px feather) または outpaint mask 付き Flux-Fill |
| 手や顔の再生成 | 被写体を再記述するプロンプト付き SD-Inpaint + ControlNet-Openpose |
| 一部領域のスタイル変更 | マスク領域に `t/T=0.5` の SDEdit |
| "Make it sunset" | InstructPix2Pix または Flux-Kontext |
| 背景差し替え | SAM mask → SD-Inpaint |
| 超高忠実度 | 最難関ケースには Flux-Fill または GPT-Image (hosted) |

SAM (Meta's Segment Anything, 2023) + diffusion inpaint は、2026 年の背景除去パイプラインです。SAM 2 (2024) は動画に対応します。

## 出荷

`outputs/skill-editing-pipeline.md` を保存します。このスキルは、元画像 + 編集説明 + 任意のマスク、または SAM prompt を受け取り、mask-generation approach、base model、CFG scales (image + text)、SDEdit-t または inpainting mode、QA checklist を出力します。

## 演習

1. **Easy.** `code/main.py` で、マスクする次元の割合を 0.2 から 0.8 まで変えてください。どの割合で、インペイント品質、つまりマスク次元の残差が無条件生成と同等になりますか。
2. **Medium.** RePaint を実装してください。10 回目ごとの逆ステップで 5 ステップ戻り、ノイズを加えて再度 denoise します。マスク境界での残差が減るか測定してください。
3. **Hard.** Hugging Face diffusers を使って、20 個の顔再生成タスクで SD 1.5 Inpaint + ControlNet-Openpose と Flux.1-Fill を比較してください。pose adherence と identity preservation を別々に採点してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Inpainting | "Fill the hole" | マスク内を再生成し、外側のピクセルを維持する。 |
| Outpainting | "Extend the canvas" | キャンバス外を再生成し、内側を維持する。 |
| 9-channel U-Net | "Proper inpainting model" | `noisy \| encoded-source \| mask` を入力とする U-Net。 |
| SDEdit | "Img2img with noise level" | 時刻 `t` までノイズを加え、新しいプロンプトで denoise する。 |
| InstructPix2Pix | "Text-only edits" | (image, instruction, output) の三つ組で fine-tune された拡散モデル。 |
| RePaint | "No retraining" | 逆過程中に周期的に再ノイズ化し、境界を減らす。 |
| SAM | "Segment Anything" | クリックやボックスで使うマスク生成器。inpaint と組み合わせる。 |
| Flux-Kontext | "Edit with context" | 参照画像 + 編集指示を受け取る Flux の派生モデル。 |

## 本番メモ: 編集パイプラインはレイテンシに敏感

画像を編集するユーザーは、5 秒未満の往復を期待します。1024² の 30-step SDXL-Inpaint は L4 で 3-4 秒かかり、さらに SAM mask generation (~200 ms) と VAE encode/decode (合計 ~500 ms) が加わります。本番の見方では、これは throughput-bound ではなく TTFT-bound です。batch 1、低 concurrency、すべての段階を最小化します。

- **SAM-H is the slow one.** 1024² の SAM-H は ~200 ms です。SAM-ViT-B は品質低下が小さく ~40 ms です。SAM 2 (video) は時間方向のオーバーヘッドが加わるため、単一画像編集には使いません。
- **Skip the encode when possible.** `pipe.image_processor.preprocess(img)` は latents にエンコードします。前回生成の latents を持っている場合、反復編集 UI では典型的ですが、`latents=...` で直接渡して VAE encode を 1 回省きます。
- **Mask dilation matters for throughput too.** 小さいマスクでは、U-Net forward pass の大半が無駄になります。非マスクピクセルはいずれ clamped されるためです。`diffusers` の `StableDiffusionInpaintPipeline` は常に U-Net 全体を実行します。masked compute を活用するのは、9 チャネルの proper-inpaint variants だけです。
- **Flux-Kontext is the 2025 answer.** `(source_image, instruction)` に対する単一 forward pass です。別マスクも SDEdit noise sweep も不要です。H100 では ~1.5 秒で編集を出荷できます。アーキテクチャ上の教訓は、段階を統合することです。

## 参考文献

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) — 訓練不要のインペインティング。
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) — SDEdit。
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) — テキスト指示による編集。
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643) — SAM、マスクの供給元。
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) — 動画対応 SAM。
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) — attention レベルの編集。
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) — 2024 年のツール群。
