# Streaming Speech-to-Speech — Moshi、Hibiki、Full-Duplex Dialogue

> 2024-2026 年に voice AI は再定義されました。Moshi は 200 ms レイテンシで、同時に聞きながら話す単一モデルを出荷しています。Hibiki は speech-to-speech translation をチャンク単位で行います。どちらも ASR → LLM → TTS パイプラインを捨て、Mimi codec tokens 上の統合 full-duplex architecture を採用しています。これが新しい参照設計です。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**所要時間:** 約 75 分

## 問題

Lessons 11 + 12 で作った音声エージェントには、300-500 ms ほどの根本的なレイテンシ下限があります。VAD が発火し、STT が処理し、LLM が推論し、TTS が生成します。各段にはそれぞれ最小レイテンシがあります。調整や並列化はできますが、パイプライン形状そのものが上限を決めます。

Moshi (Kyutai, 2024-2026) は別の問いを立てます。パイプラインがなかったらどうなるか。1 つのモデルが音声を受け取り、音声を直接、連続的に出力し、テキストは必須段ではなく中間の「内的独白」として扱うとどうなるか。

答えは **full-duplex speech-to-speech** です。理論上のレイテンシは 160 ms (80 ms Mimi frame + 80 ms acoustic delay)。実用上は単一 L4 GPU で 200 ms です。これは最良クラスのパイプライン型音声エージェントの半分です。

## コンセプト

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### Moshi architecture

**Inputs。** 2 本の Mimi codec stream があり、どちらも 12.5 Hz × 8 codebooks です。

- Stream 1: user audio (Mimi-encoded、常に到着)
- Stream 2: Moshi's own audio (Moshi が生成)

**Transformer。** 7B パラメータの Temporal Transformer が、2 本のストリームと text "inner monologue" stream を処理します。各 80 ms ステップで次を行います。

1. 最新の user Mimi tokens (8 codebooks) を消費します。
2. 直近の Moshi Mimi tokens (生成済みの 8 codebooks) を消費します。
3. 次の Moshi text token (inner monologue) を生成します。
4. 小さな Depth Transformer を通じて、次の Moshi Mimi tokens (8 codebooks) を生成します。

user audio、Moshi audio、Moshi text の 3 ストリームはすべて並列に動きます。Moshi は話しながらユーザーを聞けます。ユーザーが割り込めば自分の発話を中断でき、主発話を壊さずに "mhm" のような back-channel もできます。

**Depth transformer。** 1 フレーム内の 8 つのコードブックは並列には予測されません。コードブック間の依存があるためです。小さな 2-layer "depth transformer" が、80 ms 内でそれらを順次予測します。これは AR codec LM の標準的な因子分解です (VALL-E、VibeVoice でも使用)。

### inner-monologue text が役立つ理由

明示的なテキストがないと、モデルは音響ストリーム内に言語を暗黙的にモデル化する必要があります。Moshi の洞察は、音声と並行して text tokens を出力させることです。text stream は本質的に、Moshi が話している内容の transcript です。これにより意味的一貫性が改善し、language model head の差し替えが容易になり、transcript も無料で得られます。

### Hibiki: streaming speech-to-speech translation

同じアーキテクチャを翻訳ペアで訓練したものです。ソース音声を入力し、ターゲット言語の音声を連続的に出力します。Hibiki-Zero (Feb 2026) は word-level aligned training data を不要にしました。sentence-level data + GRPO reinforcement learning でレイテンシを最適化します。

初期対応は 4 言語ペアです。新しい言語には約 1000 時間で適応できます。

### Kyutai stack 全体 (2026)

- **Moshi** — full-duplex dialogue (フランス語が先、英語も十分対応)
- **Hibiki / Hibiki-Zero** — simultaneous speech translation
- **Kyutai STT** — streaming ASR (500 ms または 2.5 s look-ahead)
- **Kyutai Pocket TTS** — 100M-param TTS が CPU で動く (Jan 2026)
- **Unmute** — これらを public servers 上で組み合わせた full pipeline

L40S GPU 上の throughput は、64 concurrent sessions at 3× real-time です。

### Sesame CSM — 近い親戚

Sesame CSM (2025) は似た発想を使います。Llama-3 backbone に Mimi codec head を載せています。ただし CSM は full-duplex ではなく、context + text を受けて speech を生成する単方向モデルです。市場で最高水準の "voice presence" TTS ですが、Moshi の full-duplex capability とは同じではありません。

### 2026 年の性能値

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

## 作ってみる

### Step 1: interface

Moshi は WebSocket server を公開し、80 ms チャンクの Mimi-encoded audio を受け取り、80 ms チャンクの Mimi-encoded audio を返します。双方向で、常時動きます。

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### Step 2: full-duplex loop

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

両方向が同時に動きます。Python asyncio または Rust futures が標準的な transport です。

### Step 3: training objective (概念)

各 80 ms frame `t` について:

- Input: `user_mimi[0..t]`, `moshi_mimi[0..t-1]`, `moshi_text[0..t-1]`
- Predict: `moshi_text[t]`, then `moshi_mimi[t, codebook_0..7]`

テキストは音声より先に予測されます (inner monologue)。音声は depth transformer の中でコードブック順に予測されます。

### Step 4: Moshi が勝つ場所、勝たない場所

Moshi が勝つところ:

- 安価なハードウェアで sub-250 ms end-to-end。
- 自然な back-channels と割り込み。
- pipeline glue code が不要。

Moshi が勝たないところ:

- Tool calling (その用途で訓練されていないため、別の LLM path が必要)。
- 長い推論 (Moshi は 8B 級の dialogue model であり、Claude/GPT-4 ではない)。
- ニッチな話題の factual accuracy。
- ほとんどの本番 enterprise use cases (2026 年でも pipeline を使う)。

## 使いどころ

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## 落とし穴

- **Limited tool calling。** Moshi は dialogue model であって agent framework ではありません。ツールには pipeline と組み合わせます。
- **Specific-voice conditioning。** Moshi は単一の trained persona を使います。cloning は別の訓練になります。
- **Language coverage。** フランス語 + 英語は優秀ですが、他は限定的です。Hibiki-Zero は助けになりますが、それでも訓練データが必要です。
- **Resource cost。** Moshi の full session は GPU slot を保持します。安価な shared-tenant deploy pattern ではありません。

## 出荷する

`outputs/skill-duplex-pipeline.md` として保存します。音声エージェントのワークロードに対して、pipeline と full-duplex architecture のどちらを選ぶかを理由つきで決めます。

## 演習

1. **Easy.** `code/main.py` を実行します。two-stream + inner-monologue architecture を記号的にシミュレーションします。
2. **Medium.** HuggingFace から Moshi を取得し、server を実行し、会話を 1 つ試します。end-of-user-speech から start-of-Moshi-response までの wall-clock latency を測ります。
3. **Hard.** Lesson 12 の pipeline agent を取り、20 個の対応する test utterances で P50 latency を Moshi と比較します。それでも pipeline がアーキテクチャ上勝つ場合を書き出します。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | 同じモデル上で 2 本の audio stream が同時に有効。 |
| Inner monologue | Model's text stream | Moshi が audio output と並行して text tokens を出す。 |
| Depth transformer | Inter-codebook predictor | 1 つの 80 ms frame 内で 8 codebooks を予測する小さな Transformer。 |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks、semantic+acoustic、Moshi を支える。 |
| Streaming S2S | Audio → audio live | チャンク単位の翻訳・対話。pipeline stages はない。 |
| Back-channeling | "Mhm" reactions | Moshi は自分の turn を壊さずに小さな相づちを出せる。 |

## さらに読む

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2) — 論文。
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) — aligned data なしの streaming translation。
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) — CSM spec。
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) — install + server。
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) — closed commercial peer。
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) — STT/TTS framework の内部。
