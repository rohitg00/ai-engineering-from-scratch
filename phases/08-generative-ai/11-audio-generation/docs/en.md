# 音声生成

> 音声は 16-48 kHz の 1-D 信号です。5 秒のクリップは 80-240k samples です。どの transformer も、この系列に直接 attention しません。2026 年のすべての本番音声モデルの解は同じです。neural codec (Encodec, SoundStream, DAC) が音声を 50-75 Hz の discrete tokens に圧縮し、transformer または diffusion model が token を生成します。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**所要時間:** 約45分

## 課題

音声生成タスクは 3 つあります。

1. **Text-to-speech.** テキストから音声を生成します。クリーンな音声は狭帯域で、強い音素構造を持ちます。transformer-over-tokens で十分に解かれています。VALL-E (Microsoft)、NaturalSpeech 3、ElevenLabs、OpenAI TTS。
2. **Music generation.** プロンプト、つまり text、melody、chord progression、genre から音楽を生成します。分布ははるかに広いです。MusicGen (Meta)、Stable Audio 2.5、Suno v4、Udio、Riffusion。
3. **Audio effects / sound design.** プロンプトから ambient sound や Foley を生成します。AudioGen、AudioLDM 2、Stable Audio Open。

3 つすべてが同じ基盤上で動きます。neural audio codec + token-AR または diffusion generator です。

## コンセプト

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### Neural audio codecs

Encodec (Meta, 2022)、SoundStream (Google, 2021)、Descript Audio Codec (DAC, 2023)。畳み込み encoder が waveform を timestep ごとの vector に圧縮し、residual vector quantization (RVQ) が各 vector を K 個の codebook indices のカスケードに変換します。Decoder がそれを戻します。75 Hz の 8 RVQ codebooks を使う 2 kbps の 24 kHz audio は、600 tokens/sec です。

```text
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### 上位の 2 つの生成パラダイム

**Token-autoregressive.** RVQ tokens を系列に平坦化し、decoder-only transformer を実行します。MusicGen は "delayed parallel" を使い、K 個の codebook streams を stream ごとの offset 付きで並列に出力します。VALL-E は、text prompt + 3 秒の voice sample から speech tokens を生成します。

**Latent diffusion.** codec tokens を continuous latents として詰めるか、categorical diffusion でモデル化します。Stable Audio 2.5 は continuous audio latents 上の flow matching を使います。AudioLDM 2 は text-to-mel-to-audio diffusion を使います。

2024-2026 年の傾向は、音楽では flow matching が勝ちつつあることです。推論が速く、サンプルがきれいだからです。一方、speech では token-AR が依然として優勢です。自然に causal で、streaming に向いているためです。

## 本番環境

| システム | タスク | Backbone | レイテンシ |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

## 実装

`code/main.py` は中心となる考え方をシミュレートします。2 つの異なる "styles" から生成される合成 "audio token" 系列上で、小さな next-token transformer を訓練します。style A は低 token と高 token の交互、style B は単調 ramp です。style を条件にしてサンプルします。

### Step 1: synthetic audio tokens

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### Step 2: 小さな token predictor を訓練する

style で条件付けされた bigram-style predictor です。重要なのは、codec tokens → cross-entropy training → autoregressive sampling というパターンです。

### Step 3: 条件付きでサンプルする

style token と開始 token が与えられたら、予測分布から次 token をサンプルします。20-40 tokens 続けます。

## 落とし穴

- **Codec quality caps output quality.** codec が音を忠実に表現できない場合、generator の品質をどれだけ上げても助けになりません。DAC は現在の open best です。
- **RVQ error accumulation.** 各 RVQ layer は前の residual をモデル化します。layer 1 のエラーは伝播します。高い layer では temperature 0 でサンプリングすると役立ちます。
- **Musical structure.** 75 Hz では 30 秒の tokens が 20k+ tokens になります。transformer には難しいです。MusicGen は sliding window + prompt continuation を使い、Stable Audio は短いクリップ + crossfading を使います。
- **Artifacts at boundaries.** 生成クリップ間の crossfading には、慎重な overlap-add が必要です。
- **Clean-data appetite.** 音楽生成器には、ライセンスされた音楽が数万時間必要です。Suno / Udio RIAA lawsuit (2024) はこの問題を表面化させました。
- **Voice cloning ethics.** 3 秒のサンプルとテキストプロンプトがあれば、VALL-E / XTTS / ElevenLabs は声を clone できます。すべての本番モデルに abuse detection + opt-out lists が必要です。

## 使いどころ

| タスク | 2026 年の stack |
|------|------------|
| Commercial TTS | ElevenLabs、OpenAI TTS、または Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) または ElevenLabs Pro |
| 背景音楽を高速に生成 | Stable Audio 2.5 API、Suno、または Udio |
| 歌詞付き音楽 | Suno v4 または Udio v1.5 |
| Sound effects / Foley | AudioCraft 2、ElevenLabs SFX、または Stable Audio Open |
| Real-time voice agent | GPT-4o realtime または Gemini Live |
| Open-weights music research | MusicGen 3.3B、Stable Audio Open 1.0、AudioLDM 2 |
| Dubbing / translation | HeyGen、ElevenLabs Dubbing |

## 出荷

`outputs/skill-audio-brief.md` を保存します。このスキルは、audio brief (task, duration, style, voice, license) を受け取り、model + hosting、prompt format (genre tags, style descriptors, structural markers)、codec + generator + vocoder chain、seed protocol、eval plan (MOS / CLAP score / CER for TTS / user A/B) を出力します。

## 演習

1. **Easy.** `code/main.py` を実行し、style を明示的に設定してください。生成された系列が style の pattern に一致することを確認してください。
2. **Medium.** delayed parallel decoding を追加してください。1 step ずれている必要がある 2 streams の tokens をシミュレートします。joint predictor を訓練してください。
3. **Hard.** HuggingFace transformers を使って MusicGen-small をローカルで実行してください。3 つの異なるプロンプトで 10 秒クリップを生成し、style adherence を A/B してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | 音声の encoder / decoder。典型的な出力は 50-75 Hz tokens。 |
| RVQ | "Residual VQ" | K 個の quantizers のカスケード。それぞれが前段の residual をモデル化する。 |
| Token | "One codec symbol" | codebook への離散 index。1024 または 2048 が典型的。 |
| Delayed parallel | "Offset codebooks" | K 個の token streams を staggered offsets で出力し、系列長を短くする。 |
| Flow matching | "The 2024 win for audio" | diffusion に代わる、より直線的な経路の手法。サンプリングが速い。 |
| Voice prompt | "3-second sample" | cloned voice を誘導する speaker embedding または token prefix。 |
| Mel spectrogram | "The visual" | log-magnitude perceptual spectrogram。多くの TTS systems で使われる。 |
| Vocoder | "Mel to wave" | mel spectrograms を音声に戻す neural component。 |

## 本番メモ: 音声は streaming の問題

音声は、ユーザーが *生成されるそばから* 届くことを期待する唯一の出力 modality です。本番の用語では、これは TPOT (Time Per Output Token) が重要であることを意味します。目標 throughput はユーザーの読書速度ではなく、聴取速度だからです。~75 tokens/second (Encodec) で tokenized された 16kHz audio では、滑らかな再生を維持するために、サーバーはユーザーごとに 75 tokens/sec 以上を生成しなければなりません。

アーキテクチャ上の帰結は 2 つあります。

- **Flow-matching audio models cannot stream trivially.** Stable Audio 2.5 と AudioCraft 2 は、固定長クリップを 1 pass で render します。streaming するには、クリップを chunk し境界を overlap します。これは sliding-window diffusion に似ており、codec AR model と比べて 100-300ms のレイテンシオーバーヘッドを追加します。

プロダクトが "live voice chat" または "real-time music continuation" なら、codec AR path を選びます。"submit 時に 30 秒クリップを render する" なら、flow-matching が品質と total latency で勝ちます。

## 参考文献

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — codec standard。
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) — 最初に広く使われた neural audio codec。
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) — DAC。
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) — VALL-E。
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) — MusicGen。
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) — AudioLDM 2。
- [Stability AI (2024). Stable Audio 2.5](https://stability.ai/news/introducing-stable-audio-2-5) — flow matching を用いた 2025 年の text-to-music。
