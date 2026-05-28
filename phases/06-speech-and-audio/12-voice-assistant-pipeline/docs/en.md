# Build a Voice Assistant Pipeline — Phase 6 の Capstone

> lessons 01-11 のすべてをつなぎ合わせます。聞いて、推論し、話し返す voice assistant を作ります。2026年には、これは研究問題ではなく解決済みのエンジニアリング問題です。ただし、出荷できるかどうかは統合の細部で決まります。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**所要時間:** 約120分

## 問題

end-to-end assistant を作ります。

1. mic input（16 kHz mono）を取得する。
2. user speech の開始 / 終了を検出する。
3. streaming で文字起こしする。
4. transcript を、tools（timer、weather、calendar）を呼べる LLM に渡す。
5. LLM text を TTS に stream する。
6. ユーザーへ audio を再生する。
7. ユーザーが応答途中で割り込んだら停止する。

レイテンシ目標: laptop CPU 上で、ユーザーが発話を終えてから 800 ms 以内に最初の TTS audio byte を出すこと。品質目標: 聞き漏らしなし、沈黙時の字幕ハルシネーションなし、voice cloning leakage なし、prompt injection 成功なし。

## コンセプト

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### 7つのコンポーネント

1. **Audio capture。** Mic → 16 kHz mono → 20 ms chunks。通常 Python では `sounddevice`、本番では native AudioUnit/ALSA/WASAPI。
2. **VAD（Lesson 11）。** Silero VAD @ threshold 0.5、min speech 250 ms、silence hang-over 500 ms。"start" と "end" を通知します。
3. **Streaming STT（Lesson 4-5）。** Whisper-streaming、Parakeet-TDT、または Deepgram Nova-3（API）。partial + final transcripts。
4. **tool calling 付き LLM。** GPT-4o / Claude 3.5 / Gemini 2.5 Flash。tools 用 JSON schema。tokens を stream します。
5. **Streaming TTS（Lesson 7）。** Kokoro-82M（最速の open）または Cartesia Sonic（commercial）。LLM tokens 20個後に TTS を開始します。
6. **Playback。** Speaker out。低帯域ネットワークでは opus-encode します。
7. **Interruption handler。** TTS playback 中に VAD が発火したら、playback を止め、LLM を cancel し、STT を再開します。

### 必ず遭遇する3つの失敗モード

1. **First-word clip。** VAD の開始が少し遅れます。ユーザーの "hey" が欠けます。start threshold は 0.5 ではなく 0.3 にします。
2. **Mid-response interrupt confusion。** ユーザーが割り込んだ後も LLM が生成し続け、assistant がユーザーにかぶせて話します。VAD → cancel-LLM を配線します。
3. **Silence hallucination。** Whisper が silent warm-up frames で "Thanks for watching" を出力します。必ず VAD-gate します。

### 2026年の本番 reference stacks

| Stack | Latency | License | Notes |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | commercial API | Industry default 2026 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | mostly open | DIY-friendly |
| Moshi (full-duplex) | 200-300 ms | CC-BY 4.0 | Single-model; different architecture, lesson 15 |
| Vapi / Retell (managed) | 300-500 ms | commercial | Fastest to launch; limited customization |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | offline | open | Privacy / edge |

## 作ってみる

### Step 1: chunking 付き mic capture（pseudocode）

```python
import sounddevice as sd

def mic_stream(chunk_ms=20, sr=16000):
    q = queue.Queue()
    def cb(indata, frames, time, status):
        q.put(indata.copy().flatten())
    with sd.InputStream(channels=1, samplerate=sr, blocksize=int(sr * chunk_ms/1000), callback=cb):
        while True:
            yield q.get()
```

### Step 2: VAD-gated turn capture

```python
def capture_turn(stream, vad, pre_roll_ms=300, silence_ms=500):
    buf, pre, triggered = [], collections.deque(maxlen=pre_roll_ms // 20), False
    silent = 0
    for chunk in stream:
        pre.append(chunk)
        if vad(chunk):
            if not triggered:
                buf = list(pre)
                triggered = True
            buf.append(chunk)
            silent = 0
        elif triggered:
            silent += 20
            buf.append(chunk)
            if silent >= silence_ms:
                return b"".join(buf)
```

### Step 3: streaming STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Step 4: LLM loop 内の tool calling

```python
tools = [
    {"name": "get_weather", "parameters": {"location": "string"}},
    {"name": "set_timer", "parameters": {"seconds": "int"}},
]

async for chunk in llm.stream(user_text, tools=tools):
    if chunk.type == "tool_call":
        result = dispatch(chunk.name, chunk.args)
        continue_streaming(result)
    if chunk.type == "text":
        await tts.stream(chunk.text)
```

### Step 5: interruption handling

```python
tts_task = asyncio.create_task(tts_loop())
while True:
    chunk = await mic.get()
    if vad(chunk):
        tts_task.cancel()
        await speaker.stop()
        await new_turn()
        break
```

## 使いどころ

`code/main.py` には、7つのコンポーネントを stub models でつなぐ実行可能な simulation があります。ハードウェアがなくても pipeline の形を確認できます。実装では、stub を次に差し替えます。

- `silero-vad` (`pip install silero-vad`)
- `deepgram-sdk` or `openai-whisper`
- `openai` (`gpt-4o`) or `anthropic`
- `kokoro` or `cartesia`
- `sounddevice` for I/O

## 落とし穴

- **PII を永続的にログする。** Full-turn audio は多くの法域で PII です。30-day retention、encrypted at rest にします。
- **barge-in がない。** ユーザーは割り込みます。assistant は話すのを止めなければなりません。
- **blocking TTS。** Synchronous TTS は event loop をブロックします。async または別 thread を使います。
- **tool-call error handling がない。** Tools は失敗します。LLM は error を受け取り、一度 retry し、その後 graceful degrade する必要があります。
- **過剰な hallucination filters。** 過剰に filter すると assistant は "I can't help with that." を繰り返します。不十分だと何でも言います。held-out set で calibration します。
- **wake-word option がない。** 常時リスニングは privacy liability です。wake-word gate（Porcupine または openWakeWord）を追加します。

## 出荷する

`outputs/skill-voice-assistant-architect.md` として保存します。予算 + scale + language + compliance constraints が与えられたら、full stack spec を作ります。

## 演習

1. **Easy。** `code/main.py` を実行します。stub modules で1つの full turn を end-to-end にシミュレートし、stage ごとの latency を出力します。
2. **Medium。** STT stub を、録音済み `.wav` 上の実 Whisper model に置き換えます。WER と end-to-end latency を測定します。
3. **Hard。** tool calling を追加します。`get_weather`（任意の API）と `set_timer` を実装します。LLM を tools 経由にし、ユーザーが "set a 5 minute timer" と言ったときに正しい関数が発火し、spoken reply がそれを確認することを検証します。

## 重要用語

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | VAD で区切られた1つの user speech + 1つの LLM-TTS response。 |
| Barge-in | Interruption | assistant が話している間に user が話し、assistant が停止する。 |
| Wake word | "Hey assistant" | 短い keyword detector。Porcupine、Snowboy、openWakeWord。 |
| End-pointing | Turn ending | user が話し終えたことを判断する VAD + min-silence decision。 |
| Pre-roll | Pre-speech buffer | VAD 発火前の 200-400 ms の音声を保持し、first-word clip を避ける。 |
| Tool call | Function invocation | LLM が JSON を出し、runtime が dispatch し、result が loop 内に戻る。 |

## 参考資料

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) — production-grade reference。
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) — DIY-friendly framework。
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — managed voice-native path。
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) — full-duplex reference（Lesson 15）。
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) — wake-word gating。
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — LLM function calling。
