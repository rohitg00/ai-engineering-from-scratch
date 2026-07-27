# Ses Agent'ler: Pipecat ve LiveKit

> Ses agent'ler 2026'da birinci sınıf bir üretim kategorisidir. Pipecat size Python çerçeve tabanlı bir işlem hattı (VAD → STT → LLM → TTS → taşıma) sunar. LiveKit Agents, yapay zeka modellerini WebRTC üzerinden kullanıcılarla buluşturuyor. Üretim gecikmesi, premium yığınlar için uçtan uca 450-600 ms'ye ulaşmayı hedefliyor.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 12 (İş Akışı Modelleri)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Pipecat'in çerçeve tabanlı boru hattını açıklayın: DOWNSTREAM (kaynak→sink) ve UPSTREAM (kontrol).
- Kurallı ses boru hattı aşamalarını ve Pipecat desteklerini taşıyanları adlandırın.
- LiveKit Agent'lerin iki sesli agent sınıfını (MultimodalAgent, VoicePipelineAgent) ve her birinin ne zaman uygun olduğunu açıklayın.
- 2026 üretim gecikme beklentilerini ve bunların mimari seçimlerini nasıl yönlendirdiğini özetleyin.

## Sorun

Ses agent'ler, TTS'nin cıvatalandığı bir metin döngüsü değildir. Gecikme bütçeleri çok yüksektir (~600 ms), kısmi ses varsayılandır, dönüş algılama bir modeldir ve aktarımlar telefon SIP'sinden WebRTC'ye kadar değişir. Ya çerçeve tabanlı bir işlem hattı oluşturursunuz (Pipecat) ya da bir platforma güvenirsiniz (LiveKit).

## Konsept

### Pipecat (pipecat-ai/pipecat)

- Python çerçeve tabanlı ardışık düzen framework.
- `Frame` → `FrameProcessor` zinciri.
- İki akış yönü:
  - **AŞAĞI AKIŞ** — kaynak → havuz (ses girişi, TTS çıkışı).
  - **UPSTREAM** — geri bildirim ve kontrol (iptal, ölçümler, katılım).
- `PipelineTask`, olaylar (`on_pipeline_started`, `on_pipeline_finished`, `on_idle_timeout`) ve ölçümler/izleme/RTVI gözlemcileri ile yaşam döngüsünü yönetir.

Tipik boru hattı:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Taşımalar: Günlük, LiveKit, SmallWebRTCTransport, FastAPI WebSocket, WhatsApp.

Pipecat Flows, yapılandırılmış konuşmalar (durum makineleri) ekler. Pipecat Cloud, yönetilen çalışma zamanıdır.

### LiveKit Agent'ler (livekit/agent'ler)

- AI modellerini WebRTC üzerinden kullanıcılara köprüler.
- Anahtar kavramlar: `Agent`, `AgentSession`, `entrypoint`, `AgentServer`.
- İki sesli agent sınıfı:
  - **MultimodalAgent** — OpenAI Gerçek Zamanlı veya eşdeğeri yoluyla doğrudan ses.
  - **VoicePipelineAgent** — STT → Yüksek Lisans → TTS kademesi; metin düzeyinde kontrol sağlar.
- transformer modeli aracılığıyla anlamsal dönüş tespiti.
- Yerel MCP entegrasyonu.
- SIP aracılığıyla telefon.
- LiveKit Inference aracılığıyla API anahtarı olmayan 50'den fazla model; Eklentiler aracılığıyla 200'den fazla daha fazla.

### Ticari platformlar

Vapi (optimize edilmiş premium yığında ~450–600 ms) ve Retell (180 test çağrısında uçtan uca ~600 ms) bunların üzerine inşa edilmiştir. WebRTC ekibi olmadan yönetilen bir ses yığını istiyorsanız bir platform seçin.

### Bu modelin yanlış gittiği yer

- **İçeriye girme işlemi yok.** Kullanıcı araya girer; agent konuşmaya devam ediyor. LiveKit'te eşdeğer olan Pipecat'te UPSTREAM iptal çerçeveleri gerektirir.
- **STT güveni göz ardı edildi.** Düşük güvenirliğe sahip transkriptler Yüksek Lisans'a sanki bir müjdeymiş gibi beslendi. Güvenle geçin veya onay isteyin.
- **TTS cümle ortasında kesme.** Ardışık düzen, ifadenin ortasını iptal ettiğinde, TTS'nin sesi bilmesi veya kesmesi gerekir.
- **Gecikme bütçesi dikkate alınmadı.** Her bileşen 50–200 ms ekler. Gönderimden önce zincirinizi toplayın.

### Tipik 2026 gecikmeleri

- VAD: 20–60 ms
- STT kısmi: 100–250 ms
- Yüksek Lisans ilk token: 150–400 ms
- TTS ilk ses: 100–200 ms
- Aktarım RTT'si: 30–80 ms

Uçtan uca 450-600 ms birinci sınıftır. 800–1200 ms yaygındır. 1500 ms'den büyük herhangi bir şey kırılmış gibi geliyor.

## İnşa Et

`code/main.py`, aşağıdaki özelliklere sahip çerçeve tabanlı bir oyuncak hattıdır:

- `Frame` türleri (ses, transkript, metin, tts_audio, kontrol).
- `process(frame)` ile `Processor` arayüzü.
- Betikli işlemciler olarak beş aşamalı bir işlem hattı (VAD → STT → LLM → TTS → taşıma).
- İçeri girmeyi göstermek için bir UPSTREAM iptal çerçevesi.

Çalıştır:

```
python3 code/main.py
```

İz, normal akışı ve TTS'yi konuşmanın ortasında durduran bir müdahale iptalini gösterir.

## Kullan onu

- Tam kontrol için **Pipecat** — özel işlemciler, öncelikli Python, takılabilir sağlayıcılar.
- WebRTC'nin ilk deployment'leri ve telefon için **LiveKit Agent'ler**.
- WebRTC ekibi olmayan, barındırılan ses agent'ler için **Vapi / Yeniden Anlat**.
- Doğrudan ses girişi/ses çıkışı için **OpenAI Realtime / Gemini Live** (MultimodalAgent).

## Gönderin

`outputs/skill-voice-pipeline.md`, VAD + STT + LLM + TTS + taşıma artı mavna elleçleme özelliklerine sahip Pipecat şekilli bir ses boru hattının iskelesini kurar.

## Egzersizler

1. Oyuncak hattınıza bir ölçüm gözlemcisi ekleyin: Saniyede aşama başına kareleri sayın. Gecikme nerede birikir?
2. Güven kapılı STT'yi uygulayın: eşiğin altında, "bunu tekrarlayabilir misiniz?"
3. Anlamsal dönüş algılamayı ekleyin: basit kural — transkripsiyon "?" ile bitiyorsa sıranın sonu.
4. Pipecat'in taşıma belgelerini okuyun. SmallWebRTCTransport yapılandırması (saplama) için stdlib aktarımını değiştirin.
5. Aynı sorguda OpenAI Gerçek Zamanlı ve STT+LLM+TTS kademesini ölçün. Metin düzeyindeki kontrolün gecikme maliyeti nedir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Çerçeve | "Etkinlik" | İşlem hattında yazılan veri birimi (ses, transkript, metin, kontrol) |
| İşlemci | "Boru hattı aşaması" | İşlemli işleyici (çerçeve) |
| AŞAĞI | "İleri akış" | Kullanılacak kaynak: ses girişi, konuşma çıkışı |
| Memba | "Geri bildirim akışı" | Kontrol: iptal etme, ölçümler, katılma |
| VAD | "Ses etkinliği algılama" | Kullanıcının konuştuğunu algılar |
| Anlamsal dönüş algılama | "Akıllı dönüş sonu" | Kullanıcının yaptığı model bazlı karar |
| Çok modluAgent | "Doğrudan ses agent" | Ses girişi, ses çıkışı; ortada metin yok |
| VoicePipelineAgent | "Kademeli agent" | STT + Yüksek Lisans + TTS; metin düzeyinde kontrol |

## Daha Fazla Okuma

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) — çerçeve tabanlı ardışık düzen, işlemciler, aktarımlar
- [LiveKit Agent belgeleri](https://docs.livekit.io/agents/) — WebRTC + temel ses öğeleri
- [Vapi](https://vapi.ai/) — yönetilen ses platformu
- [Retell AI](https://www.retellai.com/) — yönetilen ses, gecikme-benchmarked
