# Capstone 03  Gerçek Zamanlı Ses Asistanı (ASR'den LLM'ye TTS'e)

> Doğru hisseden bir ses ajansı, 800 ms'in altındaki son-son gecikme süresine sahiptir, konuşmayı ne zaman bıraktığınızı bilir, barge-in'i ele alır ve bir araçta durmadan arama yapabilir. Retell, Vapi, LiveKit Ajanları ve Pipecat hepsi 2026'da bu barı yakaladı. Aynı şekle yapıyorlar: akış ASR, dönüş algılayıcı, akış LLM ve akış TTS, hepsi WebRTC üzerinden kablolu ve her atışta agresif gecikme bütçeleri ile. Bir tane oluşturun, WER ve MOS ölçün ve yanlış kesim oranını, ve paket kaybı altında çalıştırın.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client, scheduler scaffold)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:**P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## Sorun

Ses 2025-2026 yılları arasında en hızlı hareket eden AI UX kategorisi olmuştur. Teknik tavan her çeyrekte düştü. OpenAI Gerçek Zaman API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0 ve Pipecat 0.0.70, hepsi 800 ms altındaki ilk ses çıkışını erişime ulaştırdı. Bar sadece gecikme değil. Bu etkileşim hissi: kullanıcıyı kesmemek, kesilmemek, cümle ortasındaki bir kesintiden kurtulmak, sesleri durdurmadan bir aracı konuşma ortasında çağrmak, sinir bozucu mobil ağların hayatta kalması.

Bu nedenle, bu sistemin en önemli yönü, bu sistemin en önemli yönünü belirlemek ve bu sistemin başarısızlık modlarını belirlemek. Bu sistemin en önemli yönü, bu sistemin en önemli yönü, yük altında bunları bir seferde düzeltmek ve bir gecikme ve kalite raporu yayınlamak.

## Anlam

Bu boru hattı beş aşama içermektedir:**audio in**(WebRTC tarayıcıdan veya PSTN'den), **ASR**(Deepgram Nova-3 veya daha hızlı fısıldayan kısmi transkriptleri akışlatmak),**turn detection**(VAD ve tamamlama işaretleri için kısmi transkriptleri okuyan küçük bir dönüş algılayıcı modeli), **LLM**(turnuf tamamlandığında token akışı), **TTS**(İlk LLM tokeninden ~ 200 ms içinde ses akışı).

Üç çapraz endişesi.**Barge-in**: kullanıcı ajan konuşurken konuşmaya başladığında TTS iptal edilir ve ASR hemen konuşmaya başlar. **Tool use**: konuşma fonksiyonunun ortasındaki çağrılar (hava durumu, takvim) sesin durdurulmadan yan kanalda çalışmalıdır; ajan, gecikme 300 ms'den fazla ise bir onay jetonu ("bir saniye...") önceden dolduruyor. **Backpressure**: paket kaybı altında kısmi transkriptler tutulur, VAD konuşma kapısı eşiğini yükseltir ve ajan kabul edilmeyen bir mesaj üzerinde konuşmaktan kaçınır.

Ölçüm çubuğu miktarlıdır. Hamming VAD referans göstergesinde %8'ten aşağı olan 15 dB SNR. İlk ses çıkışı p50 ölçülen 100 çağrıda 800 ms'nin altında. Yanlış kesim oranı %3'ten aşağıdır. TTS'de MOS 4,2'den yüksek.

## Mimarlık

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

## Yüküm

- Transport: LiveKit Agents 1.0 (WebRTC) + Twilio PSTN geçidi; Pipecat 0.0.70 alternatif çerçeve olarak
- ASR: Deepgram Nova-3 (streaming, sub-300ms ilk kısmi) veya daha hızlı fısıldayan Whisper-v3-turbo kendi kendine barındırılmış
- VAD: Silero VAD v5 artı LiveKit dönüş algılayıcısı ( kısmi transkriptleri okuyan küçük bir transformatör)
- LLM: Yakın entegrasyon için OpenAI GPT-4o-real-time, Gemini 2.5 Flash Live veya kaskad Claude Haiku 4.5 (akışlı tamamlamalar, ayrı ses yolu)
- TTS: Cartesia Sonic-2 (en düşük ilk bayt), ElevenLabs Flash v3, veya kendi kendine barındırmak için açık kaynaklı Orpheus
- Araçlar: Hava/kalenderi/ rezervasyon için FastMCP yan kanal; Araçlar > 300 ms sürerse ajan önceden gönderir.
- Gözlem: OpenTelemetry ses uzantıları, Langfuse ses izleri ses tekrarlaması ile
- Uygulama: kendi kendine barındırılan Whisper + Orpheus için tek g5.xlarge (24GB VRAM); en düşük gecikme için barındırılan API'ler

```figure
ce-voice-latency
```

## Yapın

1. **WebRTC session.**Bir LiveKit odası ve mikrofon sesini akıtacak bir web istemcisi oluşturun.

2. **ASR streaming.**20 ms PCM çerçevelerini Deepgram Nova-3'e (veya GPU'da daha hızlı fısıldayarak) ekleyin.

3. **VAD and turn detector.**Silero VAD v5'i çerçeve akışında çalıştırın. Konuşma son etkinliği sırasında, LiveKit dönüş detektörü son kısmi transkripti karşı çalıştırın. VAD 500 ms sessizlik söylediğinde ve dönüş detektörü tamamlama puanı > 0.6 olduğunda yalnızca "tam tamamlan" için söz verin.

4. **LLM stream.**Tamamlandığında, LLM çağrısına devam eden konuşma ile son transkripti ile başlayın. Tokenleri akışla dışarıya aktarın.

5. **TTS stream.**Cartesia Sonic-2 ses parçalarını geri akıyor. İlk parça ilk LLM tokeninden 200 ms içinde sunucudan ayrılmalıdır. parçaları LiveKit odasına gönderin; müşteri WebRTC jitter tamponu üzerinden çalıyor.

6. **Barge-in.**VAD, TTS oynarken yeni kullanıcı konuşmasını algıladığında, TTS akışını derhal iptal edin, kalan LLM çıkışını bırakın ve ASR'yi yeniden silahlandırın.`tts_canceled`- Uzaklık.

7. **Tool side channel.**Hava durumu ve takvimini fonksiyon çağrı araçları olarak kaydet. Çağırıldığında çağrıyı eşzamanlı olarak ateşleyin; 300 ms içinde çözülmezse, LLM'nin "bir saniye, kontrol edeyim" mesajını doldurma olarak göndermesini isteyin; araç döndükten sonra devam edin.

8. **Eval harness.**100 arama kaydet. WER hesaplayın (bir beklenmedik transkript karşı), yanlış kesim oranı (kullanıcı cümlenin ortasındayken TTS iptal edildi), ilk ses çıkışı p50, TTS MOS (insan veya NISQA) ve bir jitter-loss testi (paketlerin % 3'ünü düşür).

9. **Load test.**Sintez telefonla tek bir g5.xlarge ile 50 eşzamanlı arama yapın.

## Kullan

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] tool call emitted @880ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @940ms
[llm  ] first token @990ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## Gönder

`outputs/skill-voice-agent.md`Bir alan (müşteri desteği, programlama veya kiosk) verildiğinde, ölçüm çubuğuna ayarlanmış olan ASR/VAD/LLM/TTS borusu ile bir LiveKit ajanı oluşturur.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## Egzersizler

1. G5.xlarge'de daha hızlı fısıldayan v3 turbo için Deepgram Nova-3'yi değiştirin. Gecikme ve WER boşluğunu ölçün. CPU vs GPU kararlarının nerede önemli olduğunu belirleyin.

2. Bir kesinti-hakkimlik politikasını ekleyin: kullanıcı bir araç çağrısı sırasında girerken ajan ne yapar? Üç politikayı karşılaştırın (çabuk iptal, bitirme-ağız-sonra-topp, sırada sırada).

3. Bir çarpışmacı dönüş detektörü testi yapın: kullanıcının cümle ortasında uzun molalar verin. 900 ms'i geçmeden en düşük yanlış kesinti için VAD sessizlik eşiğini ve dönüş detektörü puan eşiğini ayarlayın.

4. Aynı ajanı PSTN'de Twilio üzerinden dağıtın. PSTN'in ilk ses çıkışını WebRTC'ye karşılaştırın. Jitter-buffer ve kodek farklarını açıklayın.

5. İngilizce olmayan diller (Japonca, İspanyolca) için ses etkinliği tespitini ekleyin. Silero VAD v5 sahte tetikleme oranını dil-specifik ince tonlarla ölçün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## Daha Fazla Okumak

- [LiveKit Agents 1.0](https://github.com/livekit/agents) Referans WebRTC ajan çerçevesini
- [Pipecat](https://github.com/pipecat-ai/pipecat) alternatif Python-first akış ajanı çerçevesini
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) Entegre konuşma modelleri için referans
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) Akış ASR referansı
- [Silero VAD v5](https://github.com/snakers4/silero-vad) VAD referans modeli
- [Cartesia Sonic-2](https://docs.cartesia.ai) Düşük gecikme TTS referansı
- [Retell AI architecture](https://docs.retellai.com) Sesli temsilci mimarisi
- [Vapi.ai production stack](https://docs.vapi.ai) alternatif üretim referansı
