# Sesli ajanlar: Pipecat ve LiveKit

> Ses ajanları 2026'da birinci sınıf bir üretim kategorisi. Pipecat size Python çerçevesine dayalı bir boru hattı (VAD → STT → LLM → TTS → nakliye) sunar. LiveKit Agentler, AI modellerini WebRTC üzerinden kullanıcılara köprüler.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Pipecat'ın çerçeve tabanlı boru hattını tanımlayın: DOWNSTREAM (kaynak→sink) ve UPSTREAM (kontrol).
- Kanonik ses boru hattının ve Pipecat'ın desteklerini taşıyan aşamaların adını verin.
- LiveKit Ajanların iki ses ajansı sınıfını (MultimodalAgent, VoicePipelineAgent) ve her birinin ne zaman uygun olduğunu açıklayın.
- 2026 üretim gecikme beklentilerini ve mimari seçimleri nasıl yönlendiriyorlarsa özetleyin.

## Sorun

Ses ajanları, TTS'ye bağlı bir metin döngüsü değildir. Gecikme bütçeleri vahşittir (~ 600 ms), kısmi ses öntanımlıdır, dönüm algısı bir modeldir ve transportlar telefon SIP'den WebRTC'ye kadar uzanır. Ya çerçeve tabanlı bir boru hattı (Pipecat) inşa edersiniz ya da bir platform (LiveKit) üzerine dayanırsınız.

## Anlaşım

### Pipecat (pipecat-ai/pipecat)

- Python çerçevesine dayalı boru hattı çerçevesini.
- `Frame`→ `FrameProcessor`- Zincir.
- İki akış yönü:
  - **DOWNSTREAM** kaynak → sink (ses içeri, TTS dışarı).
  - **UPSTREAM** geri bildirim ve kontrol (iptal, ölçümler, barge-in).
- `PipelineTask`olaylarla yaşam döngüsünü yönetir (`on_pipeline_started`- Evet .`on_pipeline_finished`- Evet .`on_idle_timeout`) ve ölçümler/ izleme/ RTVI gözlemcileri.

Tipik boru hattı:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Nakliye: Günlük, LiveKit, SmallWebRTCTransport, FastAPI WebSocket, WhatsApp.

Pipecat Flow'lar yapılandırılmış konuşmalar (devlet makineleri) ekler. Pipecat Cloud yönetilen çalıştırma süresi.

### LiveKit Ajanları (livekit/ajanlar)

- WebRTC üzerinden AI modellerini kullanıcılara bağlar.
- Ana kavramlar: `Agent`- Evet .`AgentSession`- Evet .`entrypoint`- Evet .`AgentServer`- Evet .
- İki sesli ajan sınıfı:
  - **MultimodalAgent** OpenAI Realtime veya eşdeğer üzerinden doğrudan ses.
  - **VoicePipelineAgent** STT → LLM → TTS kaskasası; metin düzeyinde kontrol sağlar.
- Transformatör modeli ile semantik dönüş algısı.
- Doğal MCP entegrasyonu.
- SIP üzerinden telefon.
- LiveKit Inference üzerinden API anahtarları olmayan 50+ model; eklentiler üzerinden 200+ daha fazla.

### Ticari platformlar

Vapi (~ 450600ms optimize edilmiş bir premium stack üzerinde) ve Retell (~ 600ms 180 test çağrısında bitişik-bitiş) bunların üzerine inşa edilir. WebRTC ekibi olmadan yönetilen ses stack istediğinizde bir platform seçin.

### Bu kalıp yanlış gittiğinde

- **No barge-in handling.**Kullanıcı keser, ajan konuşmaya devam eder. UPSTREAM'ın Pipecat'taki çerçeveleri iptal etmesini ister.
- **STT confidence ignored.**Düşük güven transkriptleri, müjde gibi LLM'ye verilir.
- **TTS mid-sentence cutoff.**Pipeline, ses çıkışının ortasında iptal edildiğinde, TTS sesini bilmesi veya kesmesi gerekir.
- **Latency budget ignored.**Her bileşen 50 200 ms ekliyor.

### 2026'da tipik gecikmeler

- VAD: 20 60 ms
- STT kısmi: 100250ms
- LLM ilk simgesi: 150400ms
- TTS ilk ses: 100200ms
- Nakliye RTT: 30 80 ms

Sonundan sonuna 450  600 ms premium. 800  1200 ms yaygın. 1500 ms'den fazla olan her şey kırılmış hissettiriyor.

```figure
voice-pipeline
```

## Yapın

`code/main.py`çerçeve tabanlı bir oyuncak boru hattı:

- `Frame`türleri (audio, transkript, metin, tts_audio, kontrol).
- `Processor` ile bağlantı kurmak`process(frame)`- Evet .
- Beş aşamalı bir boru hattı (VAD → STT → LLM → TTS → nakliye) senaryo işlemcileri olarak.
- Bir UPSTREAM iptal çerçevesini, barge-in göstermek için.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İz normal akış ve TTS'i durdurmak için bir barge-in iptal gösterir.

## Kullan

- **Pipecat**Tam kontrol için  özel işlemciler, Python-first, eklenebilir sağlayıcılar.
- **LiveKit Agents**WebRTC-birincil dağıtım ve telefon için.
- **Vapi / Retell**WebRTC ekibi olmayan ev sahipliği yapan ses ajanları için.
- **OpenAI Realtime / Gemini Live**Doğrudan ses içi/ses çıkışı için (MultimodalAgent).

## Gönder

`outputs/skill-voice-pipeline.md`VAD + STT + LLM + TTS + nakliye ve barge-in yönetimi ile Pipecat şeklinde bir ses borusu.

## Egzersizler

1. Oyuncak hattınıza bir ölçüm gözlemcisi ekleyin: Eğlence başına per saniye çerçeveleri sayın.
2. Güvenli STT uygulamak: Eğitimin altında, "Bunu tekrar edebilir misiniz?" sorusunu sor.
3. Semantik dönüm algısını ekleyin: basit kural  eğer transkript "?", dönüşün sonu ile biterse.
4. Pipecat'ın taşıma belgelerini okuyun. stdlib taşımacılığını SmallWebRTCTransport yapılandırması (stub) ile değiştirin.
5. Aynı sorguda OpenAI Gerçek Zaman vs STT+LLM+TTS kaskasasını ölçün. Metin düzeyinde kontrol ne kadar gecikme maliyeti taşır?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Frame | "Event" | Typed unit of data in the pipeline (audio, transcript, text, control) |
| Processor | "Pipeline stage" | Handler with process(frame) |
| DOWNSTREAM | "Forward flow" | Source to sink: audio in, speech out |
| UPSTREAM | "Feedback flow" | Control: cancel, metrics, barge-in |
| VAD | "Voice activity detection" | Detects when user is speaking |
| Semantic turn detection | "Smart end-of-turn" | Model-based decision that the user is done |
| MultimodalAgent | "Direct audio agent" | Audio in, audio out; no text in the middle |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS; text-level control |

## Daha Fazla Okumak

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) Çerçeve tabanlı boru hattı, işlemciler, nakliye
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + ses ilkesi
- [Vapi](https://vapi.ai/) Yönetilen ses platformu
- [Retell AI](https://www.retellai.com/) Ses yönetimi, gecikme ile belirlenmiş
