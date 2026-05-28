# Omni Models: Qwen2.5-Omni and the Thinker-Talker Split

> GPT-4o の 2024年5月の product demo が disruptive だったのは、underlying model そのものより product shape のためでした。user が話し、model が camera の見ているものを見て、250ms 未満で話し返す voice interface です。open ecosystem は 2024年後半から 2025年にかけて、この product surface に到達する競争を続けました。Qwen2.5-Omni (2025年3月) は reference open design です。Thinker (large text-generating transformer) と Talker (parallel speech-generating transformer) を streaming speech tokens で接続します。Mini-Omni はそれを簡素化し、Moshi は latency に並び、GLM-4-Voice は中国語に拡張しました。この lesson では Thinker-Talker architecture と、streaming real-time dialogue を成立させる latency budget を読み解きます。

**種別:** 構築
**言語:** Python (stdlib, streaming pipeline latency simulator + VAD loop)
**前提条件:** Phase 12 · 19 (audio-LLMs), Phase 12 · 16 (any-to-any)
**所要時間:** 約180分

## 学習目標

- inference pipeline を Thinker (text reasoning) と Talker (speech synthesis) に分け、parallel streaming が機能する理由を説明する。
- conversational interaction の time-to-first-audio-byte (TTFAB) budget を component ごとに計算する。
- Thinker 内で vision、audio、text にまたがる TMRoPE の time-aligned position encoding を説明する。
- 3つの real-time conversational patterns、half-duplex、turn-taking、full-duplex を挙げる。

## 問題

real-time voice assistant は多くのことを高速に行う必要があります。

1. user を聞く。real-time speech tokenization と、話し終わりを知るための voice activity detection (VAD)。
2. 必要なら見る。2-4 FPS の camera input を audio と一緒に Thinker へ stream する。
3. 考える。conversation history に condition された response を構成する。
4. 話す。audio tokens を synthesize し、waveform に decode し、user の speakers へ stream する。

各 step は latency を追加します。会話らしさには total round-trip < 500ms が必要です。これを下回ると user は lag に気づきにくくなります。GPT-4o は約 250ms、Moshi は約 160ms、Qwen2.5-Omni は約 350-500ms とされています。

すべての component が stream する必要があります。「すべて batch してから decode」はできません。

## コンセプト

### Thinker and Talker

Qwen2.5-Omni の分解:

- Thinker: 7B-80B の text-generating transformer。interleaved text + image + audio tokens を消費します。何を言うかを表す text tokens を出力します。
- Talker: より小さい speech-generating transformer (200M-1B)。Thinker の text output tokens と recent speech-context tokens を消費します。discrete speech tokens (residual-VQ indices) を出力します。
- Speech decoder: speech tokens を real time に audio samples へ変換する streaming waveform decoder (SNAC、MoVQGAN family)。

この分離は重要です。優れた reasoning には Thinker を大きくする必要があります。Talker は local な仕事、つまり text を speech tokens に変換するだけなので小さくできます。大きな Talker は表現力を増やすのではなく、遅くします。

両方を parallel に動かします。

1. Thinker が text token t_i を出す。
2. Talker が t_i を streaming で消費し、speech tokens s_i, s_{i+1}, ..., s_{i+k} を出す。
3. Speech decoder が到着した speech tokens を消費し、audio samples を出す。
4. Thinker が text token t_{i+3} に到達するころには、Talker は t_0..t_{i+2} の audio をすでに stream 済みです。

### TMRoPE — time-aligned multimodal positions

Thinker は image frames (たとえば 4 FPS で到着)、audio frames (50 frames/second で到着)、conversation history の text を統合する必要があります。素朴な sequence order (すべての images、その後すべての audio、その後 text) では temporal alignment が失われます。

TMRoPE はすべての token に absolute timestamps を割り当てます。Vision token は t=2.3s、audio token は t=2.32s、user の「stop」という text token は t=2.35s です。RoPE は timestamp によって attention を rotate し、model はそれらを temporally concurrent なものとして見ます。

これは「hello と言いながら手を振った」を機能させる infrastructure です。model は video frame と audio を同じ conceptual moment として見ます。

### Streaming speech synthesis

Speech tokens は stream しなければなりません。Mini-Omni (Xie & Wu, 2024) は「language models can hear, talk while thinking in streaming」を導入しました。Thinker output tokens と Talker output tokens が同じ sequence 内で interleave します。Talker は Thinker が次の text token を commit した瞬間に動きます。batch boundary はありません。

Moshi (Défossez et al., 2024年10月) は最速の open implementation です。single A100 で 160ms TTFAB。architecture は、text tokens と speech tokens を交互の position に出す単一の 7B transformer で、thinking stream と speaking stream を分離する "inner monologue" を持ちます。これは careful training により Thinker + Talker を1つの model に fused したものと考えられます。

### VAD and turn-taking

Voice activity detection は input 側で走ります。pattern は2つです。

- Half-duplex: user が話し、model が聞く。model が話し、user が聞く。VAD silence detection (約 200ms) で明確に handoff します。
- Full-duplex: 両者が同時に話せます。model は backchannel (「うん」) や interrupt ができます。はるかに難しいです。Moshi はこれをサポートします。

Qwen2.5-Omni は default で half-duplex をサポートし、silence threshold による turn-taking を行います。Full-duplex には application-layer handling が必要です。

### Qwen3-Omni (November 2025)

後継です。Qwen3-80B Thinker、より大きな Talker、改善された TMRoPE-v2。latency は GPT-4o の 250ms に近くなりました。open weights です。OmniBench の benchmark では Gemini 2.0 Live と competitive です。

### Production latency budget

典型的な streaming interaction では:

- Mic -> audio tokens: 40-80ms。
- Prefill (prompt + history): 7B で 100-200ms、70B ではもっと大きい。
- First Thinker text token: 40ms。
- Talker processes first text token: 20ms。
- First speech tokens commit: 40ms。
- Residual-VQ decode: 30ms。
- Speech waveform decode: 50-80ms。

total TTFAB は 7B で 320-510ms、70B で 600-900ms です。frontier quality は通常 70B+ を意味するため、frontier latency gap が生まれます。

### Token-rate math

16kHz speech で 50 Hz base speech tokens を使う場合、output 1秒あたり 50 speech tokens が必要です。Talker は追いつくために 50 tok/s 以上を出す必要があります。H100 上の典型的な LLM throughput が 30-80 tok/s なので、小さな (200-300M) Talker は十分速い一方、7B Talker は遅れます。

これが、「main model をそのまま使えばよい」ではなく、小さな dedicated Talker model が存在する理由です。

## 使ってみる

`code/main.py`:

- mock token-emission rates で Thinker-Talker pipeline を simulate します。
- configurable model sizes と mic sample rates で TTFAB を計算します。
- VAD silence threshold による half-duplex turn-taking を demonstration します。

## 仕上げ

この lesson は `outputs/skill-omni-streaming-budget.md` を生成します。real-time voice product の target TTFAB と feature set (vision-in、bilingual、full-duplex) を受け取り、Qwen2.5-Omni、Qwen3-Omni、Moshi、Mini-Omni のいずれかを選び、Thinker/Talker の size を決めます。

## 演習

1. target TTFAB が 300ms です。7B Thinker と 300M Talker の各 component latency を書き出してください。

2. Qwen2.5-Omni は TMRoPE を使います。user が t=1s に話し始め、camera が t=1.2s に gesture を捉える prompt で、model が何を見るか説明してください。

3. Full-duplex support には、聞きながら audio を出す model が必要です。これを教える training data format を提案してください。

4. Moshi の paper Section 4 を読んでください。"inner monologue" separation と、それが Thinker-Talker split を避ける理由を説明してください。

5. throughput budget を計算してください。16kHz speech、50 base-layer tokens/sec に追いつくには、Talker はどれだけ速く tokens を出す必要がありますか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Thinker | 「Reasoning brain」 | 何を言うかを生成する large text-generating transformer |
| Talker | 「Speech-generating mouth」 | Thinker の text から discrete speech tokens を生成する small transformer |
| TTFAB | 「Latency budget」 | Time-to-first-audio-byte。user speech の終了から最初の audio sample が出るまでの時間 |
| TMRoPE | 「Time-aligned RoPE」 | vision、audio、text にまたがる absolute timestamps を使う position encoding |
| Half-duplex | 「Turn-taking」 | user と model が交互に話す。VAD silence が user-done を検出する |
| Full-duplex | 「Simultaneous」 | model が同時に話し聞きできる。backchannel も可能 |
| Inner monologue | 「Moshi separation」 | thinking-stream と speaking-stream が interleave する single-model design |

## 参考文献

- [Xu et al. — Qwen2.5-Omni (arXiv:2503.20215)](https://arxiv.org/abs/2503.20215)
- [Qwen Team — Qwen3-Omni (arXiv:2509.17765)](https://arxiv.org/html/2509.17765v1)
- [Xie & Wu — Mini-Omni (arXiv:2408.16725)](https://arxiv.org/abs/2408.16725)
- [Défossez et al. — Moshi (arXiv:2410.00037)](https://arxiv.org/abs/2410.00037)
- [Zeng et al. — GLM-4-Voice (arXiv:2412.02612)](https://arxiv.org/abs/2412.02612)
