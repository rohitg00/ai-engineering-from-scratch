# Neural Audio Codecs — EnCodec、SNAC、Mimi、DAC とセマンティック・音響分離

> 2026 年の音声生成は、ほぼすべてがトークンで動いています。EnCodec、SNAC、Mimi、DAC は連続的な波形を、Transformer が予測できる離散シーケンスへ変換します。セマンティックトークンと音響トークンの分離、つまり最初のコードブックをセマンティック、残りを音響として扱う設計は、音声において Transformer 以来もっとも重要なアーキテクチャ上の転換です。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**所要時間:** 約 60 分

## 問題

言語モデルは離散トークンを扱います。一方、音声は連続値です。MusicGen、Moshi、Sesame CSM、VibeVoice、Orpheus のような、音声や音楽向けの LLM 風モデルを作りたいなら、まず **neural audio codec** が必要です。これは音声を小さな語彙のトークンへ離散化する学習済みエンコーダと、波形を復元する対応デコーダです。

大きく 2 つの系統があります。

1. **復元優先のコーデック** — EnCodec、DAC。知覚的な音質を最適化します。トークンは「音響的」で、話者性、音色、背景ノイズを含むすべてを捉えます。
2. **セマンティック優先のコーデック** — Mimi (Kyutai)、SpeechTokenizer。最初のコードブックに言語的・音素的内容を符号化させます。多くの場合 WavLM から蒸留します。後続のコードブックは音響的な細部です。

2024-2026 年の重要な発見は、**純粋な復元コーデックだけでは、テキストから生成した音声がぼやける**ということです。コーデックトークン上の LLM は、同じコードブック内で言語構造と音響構造の両方を学ぶ必要があり、これはスケールしにくいです。セマンティックコードブック 0 と音響コードブック 1-N に分けることが、Moshi や Sesame CSM を成立させています。

## コンセプト

![4 つのコーデックの位置づけ: EnCodec、DAC、SNAC (multi-scale)、Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### 中核の仕組み: Residual Vector Quantization (RVQ)

良い品質のために何百万ものコードを持つ巨大なコードブックを 1 つ使う代わりに、現代的な音声コーデックはすべて **RVQ** を使います。これは小さなコードブックを段階的に並べたものです。最初のコードブックがエンコーダ出力を量子化し、2 番目が残差を量子化し、以降も同様です。各コードブックは 1024 個のコードを持ちます。8 個のコードブックなら有効語彙は 1024^8 = 10^24 です。

推論時には、デコーダが各フレームで選ばれたすべてのコードを合計して復元します。

### 2026 年に重要な 4 つのコーデック

**EnCodec (Meta, 2022)。** ベースラインです。波形上の encoder-decoder と RVQ ボトルネックを使います。24 kHz、最大 32 コードブック、既定は 4 コードブック @ 1.5 kbps。`1D conv + transformer + 1D conv` アーキテクチャを使います。MusicGen で使われています。

**DAC (Descript, 2023)。** L2 正規化コードブック、周期的活性化関数、改善された損失を持つ RVQ です。オープンなコーデックの中では最高水準の復元忠実度で、12 コードブックでは元の音声と区別しにくいこともあります。44.1 kHz フルバンドです。

**SNAC (Hubert Siuzdak, 2024)。** Multi-scale RVQ です。粗いコードブックは細かいコードブックより低いフレームレートで動きます。実質的に、約 12 Hz の粗い「スケッチ」と 50 Hz の細部として音声を階層的にモデル化します。この階層構造が LM ベース生成と相性がよいため、Orpheus-3B で使われています。

**Mimi (Kyutai, 2024)。** 2026 年のゲームチェンジャーです。12.5 Hz という非常に低いフレームレート、8 コードブック @ 4.4 kbps。コードブック 0 は **WavLM から蒸留**され、WavLM の音声内容特徴を予測するよう訓練されています。コードブック 1-7 は音響残差です。この分離が Moshi (Lesson 15) と Sesame CSM を支えています。

### フレームレートは言語モデルに効く

低いフレームレート = 短いシーケンス = 速い LM です。

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

12.5 Hz なら、10 秒の発話は 125 コーデックフレームだけです。Transformer はこれを容易に予測できます。

### セマンティックトークンと音響トークン

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **セマンティックトークン (Mimi の codebook 0)。** 何が話されたか、つまり音素、単語、内容を符号化します。補助予測損失によって WavLM から蒸留されます。
- **音響トークン (codebooks 1-7)。** 音色、話者性、韻律、背景ノイズ、細部を符号化します。

AR LM はまずテキストに条件づけてセマンティックトークンを予測し、次にセマンティックトークンと話者参照に条件づけて音響トークンを予測します。この因子分解により、現代的な TTS はゼロショットで声をクローンできます。セマンティックモデルが内容を扱い、音響モデルが音色を扱うからです。

### 2026 年の復元品質 (bits per sec、低ビットレートほどよい)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Opus のような従来型コーデックは、ビットあたりの知覚品質ではまだ勝っています。ニューラルコーデックが勝つのは **離散トークン**を出せること (Opus は出せません) と、**生成モデル品質**、つまり LM がそのトークンで何をできるかです。

## 作ってみる

### Step 1: EnCodec でエンコードする

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

6 kbps では `n_codebooks=8` です。各コードは 0-1023 (10-bit) です。

### Step 2: デコードして復元を測る

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### Step 3: セマンティック・音響分離 (Mimi 風)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

セマンティックコードブック 0 は WavLM に整合しています。text-to-semantic Transformer を訓練できます。これは直接 audio に行くより語彙がかなり小さくなります。その後、別の acoustic-to-waveform デコーダが話者参照に条件づけて復元します。

### Step 4: コーデックトークン上の AR LM が機能する理由

Mimi の 12.5 Hz × 8 コードブックで、10 秒の音声クリップを考えます。

```
N_tokens = 10 * 12.5 * 8 = 1000 tokens
```

1000 トークンは Transformer にとって軽いコンテキストです。256M パラメータの Transformer でも、現代的な GPU なら 10 秒の音声をミリ秒単位で生成できます。

## 使いどころ

問題からコーデックへ対応づけます。

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

目安: **生成モデルを作るなら Mimi か SNAC から始めます。圧縮パイプラインを作るなら Opus を使います。**

## 落とし穴

- **コードブックが多すぎる。** コードブックを増やすと忠実度は線形に上がりますが、LM のシーケンス長も線形に伸びます。8-12 で止めます。
- **フレームレートの不一致。** 12.5 Hz の Mimi で LM を訓練し、その後 50 Hz の EnCodec で微調整すると、静かに失敗します。
- **すべてのコードブックを同等だと思う。** Mimi では codebook 0 が内容を持ちます。これを失うと明瞭度が壊れます。codebook 7 を失ってもほとんど気づきません。
- **復元品質だけを指標にする。** 復元が優秀なコーデックでも、セマンティック構造が悪ければ LM ベース生成には役に立たないことがあります。

## 出荷する

`outputs/skill-codec-picker.md` として保存します。与えられた生成または圧縮タスクに対してコーデックを選びます。

## 演習

1. **Easy.** `code/main.py` を実行します。トイ版の scalar + residual quantizer を実装し、コードブックを増やしたときの復元誤差を測ります。
2. **Medium.** `encodec` をインストールし、保留した音声クリップで 1、4、8、32 コードブックを比較します。PESQ または MSE とビットレートの関係をプロットします。
3. **Hard.** Mimi を読み込みます。クリップをエンコードします。codebook 0 をランダム整数で置き換えてデコードします。次に codebook 7 でも同じことをします。2 つの破損を比較します。codebook 0 の破損は明瞭度を壊し、codebook 7 の破損はほとんど何も変えないはずです。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | 残差量子化 | 小さなコードブックのカスケード。各段が前段の残差を量子化する。 |
| Frame rate | コーデック速度 | 1 秒あたりのトークンフレーム数。低いほど LM は速い。 |
| Semantic codebook | Codebook 0 (Mimi) | SSL 特徴から蒸留されたコードブック。内容を符号化する。 |
| Acoustic codebooks | それ以外すべて | 音色、韻律、ノイズ、細部。 |
| PESQ / ViSQOL | 知覚品質 | MOS と相関する客観指標。 |
| EnCodec | Meta codec | RVQ のベースライン。MusicGen で使われる。 |
| Mimi | Kyutai codec | 12.5 Hz フレームレート、セマンティック・音響分離、Moshi を支える。 |

## さらに読む

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) — RVQ のベースライン。
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) — オープンな中で最高水準の忠実度。
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) — multi-scale RVQ。
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) — セマンティック・音響分離と WavLM 蒸留。
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) — 2 段階のセマンティック・音響パラダイム。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — 元祖 streamable RVQ codec。
