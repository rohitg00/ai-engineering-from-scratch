# Capstone 03 — Real-Time Voice Assistant (ASR から LLM、TTS へ)

> 自然に感じる voice agent は end-to-end latency が 800ms 未満で、user が話し終えたタイミングを理解し、barge-in を処理し、tool call でも止まりません。Retell、Vapi、LiveKit Agents、Pipecat は2026年にこの基準へ到達しています。仕組みは同じです: streaming ASR、turn-detector、streaming LLM、streaming TTS を WebRTC で結び、各 hop に厳しい latency budget を置きます。これを作り、WER、MOS、false-cutoff rate を測り、packet loss 下で動かします。

**種別:** Capstone
**言語:** Python (agent + pipeline), TypeScript (web client)
**前提条件:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:** P6 · P7 · P11 · P13 · P14 · P17
**所要時間:** 30時間

## 問題

voice は2025-2026年で最も速く進んだ AI UX category です。technical ceiling は四半期ごとに下がりました。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0、Pipecat 0.0.70 は、sub-800ms first-audio-out を現実的にしました。基準は latency だけではありません。user を遮らない、agent が遮られたら回復する、文の途中の interruption に対応する、会話中の tool call で audio が止まらない、jitter のある mobile network に耐える、という interaction feel です。

3つの REST call をつなげても到達できません。architecture は end to end の pipelined streaming です。作って初めて failure mode が見えます。phone audio 用に調整した VAD が background TV に反応する、turn-detector が来ない punctuation を待つ、TTS が発話前に 400ms buffer する。capstone ではこれらを load 下で1つずつ直し、latency-and-quality report を公開します。

## コンセプト

pipeline には5つの streaming stage があります。**audio in** (browser または PSTN から WebRTC)、**ASR** (Deepgram Nova-3 または faster-whisper の streaming partial transcript)、**turn detection** (VAD と partial transcript から完了 cue を読む小さな turn-detector model)、**LLM** (turn complete と判断した瞬間から token を stream)、**TTS** (first LLM token から約200ms以内に audio out)。

横断的な concern は3つです。**Barge-in**: agent が話している最中に user が話し始めたら TTS を cancel し、ASR が即座に拾います。**Tool use**: weather や calendar の function call は side channel で走らせ、audio を止めません。300ms を超える場合、agent は「少々お待ちください」のような acknowledgment token を先に出します。**Backpressure**: packet loss 下では partial transcript を保持し、VAD の speech-gate threshold を上げ、未 ack の message の上から話さないようにします。

測定基準は定量です。15 dB SNR の Hamming VAD benchmark で WER 8% 未満、100 measured calls の first-audio-out p50 が 800ms 未満、false-cutoff rate 3% 未満、TTS MOS 4.2 以上、single g5.xlarge で 50 concurrent calls。これらの数値が deliverable です。

## Architecture

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## Stack

- Transport: LiveKit Agents 1.0 (WebRTC) + Twilio PSTN gateway。代替 framework は Pipecat 0.0.70
- ASR: Deepgram Nova-3 (streaming、sub-300ms first partial) または self-hosted faster-whisper Whisper-v3-turbo
- VAD: Silero VAD v5 + LiveKit turn-detector (partial transcript を読む小さな transformer)
- LLM: tight integration 用 OpenAI GPT-4o-realtime、Gemini 2.5 Flash Live、または cascaded Claude Haiku 4.5
- TTS: lowest first-byte の Cartesia Sonic-2、ElevenLabs Flash v3、self-host 用 open-source Orpheus
- Tools: weather/calendar/booking 用 FastMCP side-channel。tool が 300ms 超なら agent が filler を先に出す
- Observability: OpenTelemetry voice spans、audio replay 付き Langfuse voice traces
- Deployment: self-hosted Whisper + Orpheus には single g5.xlarge (24GB VRAM)、lowest latency には hosted APIs

## 実装

1. **WebRTC session.** LiveKit room と microphone audio を stream する web client を立てます。server では room に参加する agent worker を attach します。

2. **ASR streaming.** 20ms PCM frame を Deepgram Nova-3 (または GPU 上の faster-whisper) に渡します。partial と final transcript を購読し、partial ごとの latency を log します。

3. **VAD and turn detector.** frame stream 上で Silero VAD v5 を実行します。speech-end event で最新 partial transcript を LiveKit turn-detector にかけます。VAD が500ms silence と言い、turn-detector が completion > 0.6 と score したときだけ "turn complete" とします。

4. **LLM stream.** turn complete になったら、running conversation と final transcript を渡して LLM call を開始します。token を stream し、first token で TTS に渡します。

5. **TTS stream.** Cartesia Sonic-2 が audio chunk を stream back します。first chunk は first LLM token から 200ms 以内に server を出る必要があります。chunk を LiveKit room に emit し、client は WebRTC jitter buffer 経由で再生します。

6. **Barge-in.** TTS 再生中に VAD が新しい user speech を検出したら、TTS stream を即座に cancel し、残りの LLM output を捨て、ASR を再 arm します。`tts_canceled` span を publish します。

7. **Tool side channel.** weather と calendar を function-calling tools として登録します。invoke されたら call を concurrent に発火し、300ms 以内に返らなければ LLM に filler を出させ、tool が返ったら resume します。

8. **Eval harness.** 100 calls を record します。WER (held-out transcript 対比)、false-cutoff rate (user の文中で TTS cancel した率)、first-audio-out p50、TTS MOS (human または NISQA)、jitter-loss test (3% packet drop) を計算します。

9. **Load test.** synthetic caller で single g5.xlarge 上の 50 concurrent calls を駆動します。sustained first-audio-out p95 を測ります。

## Use It

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] first token @960ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @1140ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## Ship It

`outputs/skill-voice-agent.md` が deliverable です。domain (customer support、scheduling、kiosk など) を受け取り、measurement bar に合わせて調整した ASR/VAD/LLM/TTS pipeline を持つ LiveKit agent を立てます。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | 100 recorded calls で p50 first-audio-out が 800ms 未満 |
| 20 | Turn-taking quality | Hamming VAD benchmark で false-cutoff rate が 3% 未満 |
| 20 | Tool-use correctness | 会話中 tool call が audio を止めず正しい data を返すこと |
| 20 | Reliability under packet loss | 3% packet drop 注入時の WER と turn-taking stability |
| 15 | Eval harness completeness | public config で再現可能な measurements |
| **100** | | |

## Exercises

1. Deepgram Nova-3 を g5.xlarge 上の faster-whisper v3 turbo に差し替えます。latency と WER gap を測り、CPU-vs-GPU decision が効く箇所を特定します。

2. interruption-arbitration policy を追加します。tool call 中に user が barge in したら agent はどうするべきか。hard cancel、finish-tool-then-stop、queue next turn の3 policy を比較します。

3. adversarial turn-detector test を走らせます。user に文中の長い pause を与えます。false-cutoff を最小にしつつ 900ms を超えないよう、VAD silence threshold と turn-detector score threshold を調整します。

4. 同じ agent を Twilio 経由で PSTN に deploy します。PSTN first-audio-out と WebRTC を比較し、jitter-buffer と codec の違いを説明します。

5. 日本語・スペイン語など non-English language の voice activity detection を追加します。Silero VAD v5 の false-trigger rate と language-specific fine-tunes を比較します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | 「End of utterance」 | VAD silence と partial transcript を受け取り、user が話し終えたか判定する classifier |
| Barge-in | 「Interruption handling」 | VAD が新しい user speech を検出したとき TTS を mid-playback で cancel すること |
| First-audio-out | 「Latency」 | user が話し終えてから、最初の audio packet が server を出るまでの時間 |
| VAD | 「Speech gate」 | audio frame を speech / silence に分類する model。Silero VAD v5 が2026年の default |
| Jitter buffer | 「Audio smoothing」 | network variance を吸収するため、packet を短時間保持する client-side buffer |
| Filler | 「Acknowledgment token」 | tool が遅いときに沈黙を避けるため agent が出す短い phrase |
| MOS | 「Mean opinion score」 | perceptual speech quality rating。NISQA は automated proxy |

## 参考文献

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — reference WebRTC agent framework
- [Pipecat](https://github.com/pipecat-ai/pipecat) — alternate Python-first streaming agent framework
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — integrated speech models の reference
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) — streaming ASR reference
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD reference model
- [Cartesia Sonic-2](https://docs.cartesia.ai) — low-latency TTS reference
- [Retell AI architecture](https://docs.retellai.com) — production voice agent architecture
- [Vapi.ai production stack](https://docs.vapi.ai) — alternate production reference
