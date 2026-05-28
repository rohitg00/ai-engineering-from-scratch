# MIO と Any-to-Any Streaming Multimodal Models

> GPT-4o は多くの open models が再現できない product を出荷した。声を聞き、video を見て、real time に話し返す agent だ。2024年末時点の open-ecosystem の答えが MIO (Wang et al., 2024年9月) だった。MIO は text、image、speech、music を tokenize し、interleaved sequences 上で1つの causal transformer を訓練し、どの modality からどの modality へも生成する。AnyGPT (Zhan et al., 2024年2月) は proof of concept、MIO は scale-up、Unified-IO 2 (Allen AI, 2023年12月) は vision + action grounding を持つ cousin だ。このレッスンでは any-to-any pattern、つまり4つの tokenizers、1つの transformer、streaming-friendly decode を読む。

**種類:** 学習
**言語:** Python (stdlib, four-modality token allocator + streaming decode loop)
**前提:** Phase 12 · 11 (Chameleon), Phase 6 (Speech and Audio)
**所要時間:** 約120分

## 学習目標

- Text、image、speech、music tokens を collision なしで収容する shared vocabulary を設計する。
- SEED-Tokenizer (images) と SpeechTokenizer residual-VQ (speech) を compression + reconstruction trade-offs で比較する。
- Any-to-any generation を組み上げる four-stage curriculum を説明する。
- Open な any-to-any recipes 3つ、MIO、AnyGPT、Unified-IO 2 とそれぞれの主な trade-offs を名指しする。

## 問題

Unified multimodal model を名乗るのは簡単だが、scale して作るのは難しい。2024年までの多くの "any-to-any" systems は pipeline だった。Vision model → text representation → speech model → audio。各hopで情報が失われ、latency が加わり、training が複雑になる。GPT-4o の demo video は、subsecond response を持つ single-model alternative を見せた。Open systems は数カ月遅れた。

Engineering 上の課題:

- Tokenizers は全modalityに存在し、reconstruction に十分なほど lossless に compress し、transformer が消費できる rate の tokens を出す必要がある。
- Single vocabulary は text (32k+)、image (16k+)、speech (4k+)、music (8k+) の space を allocate しなければならない。最低でも4万以上の entries。
- Training data は全input-output pair (text→image, image→speech, speech→image など) を cover するか、model が compose できなければならない。
- Inference は conversational latency (<500ms time-to-first-audio-byte) に十分な速さで output tokens を stream しなければならない。

## 概念

### 4つの modalities のための4つの tokenizers

MIO の tokenizer stack:

- Text: 標準 BPE、vocab ~32000。
- Image: SEED-Tokenizer (2023)。Discrete codebook 付き quantized VAE、4096 entries、imageあたり 32x32 tokens。
- Speech: SpeechTokenizer residual-VQ (2023)。16kHz waveform を8つの hierarchical codebooks に encode する。First level は coarse content、later levels は prosody と speaker identity を追加する。
- Music: 類似の residual-VQ (Meta の MusicGen / Encodec family)、4-8 codebooks。

各 modality は integer tokens を生成する。Tokens は shared vocabulary 内で互いに disjoint な ID ranges を持つ:

```
text:   0..31999
image:  32000..36095  (4096 image tokens)
speech: 36096..40191  (4096 speech base tokens, plus residual layers)
music:  40192..48383  (8192 music tokens)
sep:    48384..48390  (<image>, <speech>, <music>, </...>, etc.)
```

Total は約48k vocabulary。Input embedding と output projection はその全体を span する。

### Streaming decode

Speech generation は residual-VQ を使う。Transformer は base (layer 0) speech tokens を予測する。Parallel-decoded residual quantizer が後続layersを予測する。各 layer 0 token は 16kHz audio で約50msに相当する。

Streaming pattern:

1. User が mic に話す。Real-time audio tokenizer が50msごとに speech tokens を emit する。
2. MIO は到着した tokens を消費する (prompt prefill + incremental forward)。
3. Generated output tokens が stream out される。Parallel speech decoder がそれらを audio samples に変換し、latency は約50-150ms。
4. Time-to-first-audio-byte: MIO paper では約300-500ms。GPT-4o の約250msに近づく。

Mini-Omni (arXiv:2408.16725)、GLM-4-Voice (arXiv:2412.02612)、Moshi (arXiv:2410.00037) は complementary な streaming speech-LLM designs だ。特に Moshi は single GPU で160ms round-trip を達成する。

### Four-stage curriculum

MIO の training curriculum:

1. Stage 1 — alignment。Large-scale modality-pair corpora: text-image、text-speech、text-music。各pairは独自の token vocabulary segment を使う。Shared vocabulary を訓練する。
2. Stage 2 — interleaved。Multi-modality interleaved documents (images + video を含む blogs、transcripts付き podcasts など)。Cross-modality context を訓練する。
3. Stage 3 — speech-enhanced。Text capability を失わずに speech quality を上げるための extra audio data。
4. Stage 4 — SFT。Modalities をまたぐ instruction tuning: VQA、captioning、narration、speech-to-speech dialogue。

Stage が欠けると specific capability が劣化する。Stage 2 を飛ばすと model は cross-modality context を失い、Stage 3 を飛ばすと speech が悪くなる。

### Chain-of-visual-thought

MIO は chain-of-visual-thought を導入する。Model が reasoning step として intermediate image tokens を emit する。"is the cat climbing a tree?" では、model は:

1. Scene を render する `<image>` tokens を emit する (input image から、または sketch として)。
2. Sketch を分析する text を emit する。
3. Final answer を emit する。

Rendered intermediate image は scratchpad として働く。Spatial-reasoning tasks で benchmarks が改善する。この idea は text reasoning の chain-of-thought を映像側に写したものだ。

### Any-to-any の競合

- AnyGPT (arXiv:2402.12226): 4 modalities (text, image, speech, music)、類似design。
- Unified-IO 2 (arXiv:2312.17172): vision action outputs、depth、normals を追加。Task diversity は広いが scale は小さい。
- NExT-GPT (arXiv:2309.05519): LLM + modality-specific diffusion decoders。Single-model approach ではない。
- CoDi (arXiv:2305.11846): composable diffusion。Shared latent 経由の any-to-any。

MIO は pure-token any-to-any に最も近い。AnyGPT はその conceptual ancestor だ。

### Latency budget

Conversational product では全componentの latency が重要だ:

- Mic to audio tokens: 約50ms。
- Prefill (audio tokens + history): 8B model で約100ms。
- First output token: 約50ms。
- Parallel residual-VQ + speech decoder: 約100-150ms。

Total time-to-first-audio-byte は最小約300ms。GPT-4o は約250msを主張する。Moshi は160msを主張する。MIO/AnyGPT は public benchmarks では400-600ms帯だ。

### Any-to-any が難しいままである理由

2026年でも open any-to-any models は closed ones に2軸で遅れている:

- Speech quality。Residual-VQ tokenizer は lossy で、conversational speech は ElevenLabs-class voices と比べて robotic に聞こえる。
- Cross-modality reasoning。"見えているものについて歌って" と頼むと、pure-vision tasks より失敗しやすい。

これらは open research problems だ。Qwen3-Omni (Lesson 12.20) は2025年時点で最も進んだ open attempt である。

## 使ってみる

`code/main.py`:

- Four-modality vocabulary allocation を定義し、表示する。
- Multimodal inputs (text, image, audio-clip, music) の list を tokenizer router に通す。
- Text-to-speech response の streaming decode を latency counting とともに simulate する。
- Encoder、prefill、decoder latencies が与えられたときの expected time-to-first-audio-byte を計算する。

## 仕上げ

このレッスンは `outputs/skill-any-to-any-pipeline-auditor.md` を作る。Conversational product spec (modalities in, modalities out, latency target) が与えられたら、MIO-family design choices を audit し、latency budget を計算する。

## 演習

1. Product が speech input を受け取り speech output を返す。End-to-end latency budget target は何か。時間を消費する components を列挙せよ。

2. SpeechTokenizer residual-VQ は8 codebooks を使う。Residual levels を sequential ではなく parallel decode する必要がある理由と、どの latency savings が得られるかを提案せよ。

3. Vocabulary が 32k text + 4k image + 4k speech を持つ。8k music と約10 separators を追加する。Hidden dim 4096 の embedding-matrix parameter cost はいくらか。

4. Chain-of-visual-thought は intermediate image を emit する。どんな種類の質問に有利か。Extra tokens によってどんな質問は悪化するか。

5. Moshi (arXiv:2410.00037) を読め。その "inner monologue" technique を説明し、MIO の chain-of-visual-thought と比較せよ。

## 重要語句

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | Text、image、speech、music を任意の方向で受け取り出力する単一model |
| Residual-VQ | "Speech tokenizer stack" | 各layerが情報を追加する multi-codebook tokenization。Base layer は content、later layers は prosody |
| SEED-Tokenizer | "Image codes" | MIO が使う4096-entry codebook を持つ discrete image tokenizer |
| Chain-of-visual-thought | "Visual scratchpad" | Model が final answer の前に reasoning step として intermediate image を生成する |
| Time-to-first-audio-byte | "TTFAB" | User voice から first audio output までの latency。会話感には <500ms |
| Four-stage curriculum | "Training recipe" | Alignment -> interleaved -> speech-enhanced -> SFT の順に進む訓練recipe |

## 参考文献

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
