# Capstone 03 — Gerçek Zamanlı Sesli Asistan (ASR'den LLM'ye TTS'ye)

> Doğru hissettiren bir ses agent, 800 ms'nin altında uçtan uca gecikme süresine sahiptir, konuşmayı ne zaman bıraktığınızı bilir, içeri girmeyi yönetir ve oyalanmadan bir aracı çağırabilir. Retell, Vapi, LiveKit Agent'ler ve Pipecat'in tümü 2026'da bu çıtayı aştı. Bunu aynı biçimde yapıyorlar: bir akış ASR'si, bir dönüş dedektörü, bir akış LLM'si ve bir akış TTS'si; hepsi de her atlamada agresif gecikme bütçeleriyle WebRTC üzerinden kablolanmıştır. Bir tane oluşturun, WER ve MOS'u ve yanlış kesme oranını ölçün ve paket kaybı altında çalıştırın.

**Tür:** Kapak taşı
**Diller:** Python (agent + boru hattı), TypeScript (web istemcisi)
**Önkoşullar:** Aşama 6 (konuşma ve ses), Aşama 7 (transformer'ler), Aşama 11 (LLM mühendisliği), Aşama 13 (araçlar), Aşama 14 (agent'lar), Aşama 17 (altyapı)
**Uygulanan aşamalar:** P6 · P7 · P11 · P13 · P14 · P17
**Süre:** 30 saat

## Sorun

Ses, 2025-2026'nın en hızlı hareket eden AI UX kategorisi oldu. Teknik tavan her çeyrekte düştü. OpenAI Realtime API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0 ve Pipecat 0.0.70'in tümü, 800 ms'nin altındaki ilk ses çıkışını ulaşılabilir hale getiriyor. Çubuk yalnızca gecikme değildir. Bu, etkileşim hissi: Kullanıcının sözünü kesmemek, sözü kesilmemek, cümle ortasında yaşanan kesintiden kurtulmak, sesi kesmeden konuşmanın ortasında bir aracı çağırmak, gergin mobil ağlardan kurtulmak.

Üç REST çağrısını birleştirerek oraya ulaşamazsınız. Mimari, uçtan uca akış halinde boru hattına sahiptir. Oluşturun ve arıza modları görünür hale gelir: arka plandaki TV'de telefon sesinin tetiklenmesi için ayarlanmış bir VAD, hiçbir zaman gelmeyen noktalama işaretlerini bekleyen bir dönüş dedektörü, yayılmadan önce 400 ms ara belleğe alan bir TTS. Önemli olan bunları yük altında birer birer düzeltmek ve bir gecikme ve kalite raporu yayınlamaktır.

## Konsept

İşlem hattının beş akış aşaması vardır: **ses girişi** (tarayıcıdan veya PSTN'den WebRTC), **ASR** (Deepgram Nova-3'ten veya daha hızlı fısıltıdan kısmi transkript akışı), **dönüş algılama** (VAD artı tamamlama ipuçları için kısmi transkriptleri okuyan küçük bir dönüş dedektörü modeli), **LLM** (dönüş tamamlandığına karar verilir verilmez token'larin akışı), **TTS** (ilkinden ~200 ms sonra ses çıkışı) Yüksek Lisans token).

Birbiriyle kesişen üç endişe. **Katılma**: agent konuşurken kullanıcı konuşmaya başladığında, TTS iptal edilir ve ASR hemen başlar. **Araç kullanımı**: konuşma ortasında işlev çağrıları (hava durumu, takvim), sesi kesmeden bir yan kanalda çalışmalıdır; Gecikme 300 ms'yi aşarsa, agent bir bildirimi token ("bir saniye...") önceden doldurur. **Geri basınç**: paket kaybı altında kısmi transkriptler tutulur, VAD konuşma kapısı eşiğini yükseltir ve agent onaylanmamış bir mesaj üzerinden konuşmaktan kaçınır.

Ölçüm çubuğu nicelikseldir. WER, Hamming VAD benchmark'da 15 dB SNR'de %8'in altında. 100 ölçülen çağrıda 800 ms'nin altında ilk ses çıkışı p50. Yanlış kesme oranı %3'ün altında. TTS'de MOS 4.2'nin üzerinde. Tek bir g5.xlarge üzerinde 50 eşzamanlı çağrı. Bu rakamlar teslim edilebilir rakamlardır.

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

## Yığın

- Aktarım: LiveKit Agents 1.0 (WebRTC) artı Twilio PSTN ağ geçidi; Alternatif framework olarak Pipecat 0.0.70
- ASR: Deepgram Nova-3 (akış, 300 ms'nin altında ilk kısmi) veya daha hızlı fısıltı Whisper-v3-turbo, kendi kendine barındırılan
- VAD: Silero VAD v5 artı LiveKit dönüş dedektörü (kısmi transkriptleri okuyan küçük transformer)
- LLM: Sıkı entegrasyon için OpenAI GPT-4o-realtime, Gemini 2.5 Flash Live veya basamaklı Claude Haiku 4.5 (akış tamamlamaları, ayrı ses yolu)
- TTS: Cartesia Sonic-2 (en düşük ilk bayt), ElevenLabs Flash v3 veya kendi kendine barındırma için açık kaynaklı Orpheus
- Araçlar: Hava durumu/takvim/rezervasyon için FastMCP yan kanalı; Araç >300 ms sürerse agent dolguyu önceden yayar
- Observability: OpenTelemetry ses aralıkları, ses tekrarı ile Langfuse ses izleri
- Deployment: kendi kendine barındırılan Whisper + Orpheus için tekli g5.xlarge (24GB VRAM); En düşük gecikme süresi için barındırılan API'ler

## Build It — Kendin Geliştir

1. **WebRTC oturumu.** Bir LiveKit odası ve mikrofon sesini aktaran bir web istemcisi oluşturun. Sunucuya odaya katılan bir agent çalışanını ekleyin.

2. **ASR akışı.** 20 ms PCM karelerini Deepgram Nova-3'e (veya GPU'da daha hızlı fısıltı) besleyin. Kısmi ve nihai transkriptlere abone olun. Kısmi gecikme başına günlüğe kaydedin.

3. **VAD ve dönüş dedektörü.** Çerçeve akışında Silero VAD v5'i çalıştırın. Konuşma sonu olayında, LiveKit dönüş dedektörünü en son kısmi transkripte karşı ateşleyin. Yalnızca VAD 500 ms boyunca sessizlik söylediğinde ve dönüş dedektörü tamamlanma puanı > 0,6 olduğunda "dönüşün tamamlanmasını" taahhüt edin.

4. **LLM akışı.** Sıra tamamlandığında, devam eden görüşme ve son transkript ile LLM çağrısını başlatın. token'ları yayınlayın. İlk token'da TTS'ye devredin.

5. **TTS akışı.** Cartesia Sonic-2 ses parçalarını geri aktarır. İlk parça, ilk LLM'den token sonra 200 ms içinde sunucuyu terk etmelidir. Parçaları LiveKit odasına gönderin; istemci WebRTC titreşim arabelleği üzerinden oynatılır.

6. **Katılın.** VAD, TTS oynatılırken yeni kullanıcı konuşması tespit ederse, TTS akışını derhal iptal edin, kalan LLM çıkışını bırakın ve ASR'yi yeniden etkinleştirin. Bir `tts_canceled` aralığı yayınlayın.

7. **Araç tarafı kanalı.** Hava durumunu ve takvimi işlev çağırma araçları olarak kaydedin. Çağrıldığında çağrıyı aynı anda başlatın; 300 ms içinde çözülmezse LLM'nin dolgu maddesi olarak "bir saniye, kontrol edeyim" demesini sağlayın; araç geri döndüğünde devam edin.

8. **Değerlendirme donanımı.** 100 çağrıyı kaydedin. WER'yi (uzatılmış bir transkripte karşı), yanlış kesme oranını (kullanıcı cümlenin ortasındayken TTS iptal edildi), ilk ses çıkışı p50'yi, TTS MOS'u (insan veya NISQA) ve titreşim kaybı testini (paketlerin %3'ü düşüş) hesaplayın.

9. **Yük testi.** Yapay bir arayanla tek bir g5.xlarge üzerinde 50 eşzamanlı çağrı yapın. Sürekli ilk ses çıkışı p95'i ölçün.

## Use It — Hazır Araçla Uygula

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

## Ship It — Kullanıma Sun

`outputs/skill-voice-agent.md` teslim edilebilirdir. Bir alan adı (müşteri desteği, planlama veya kiosk) verildiğinde, ölçüm çubuğuna ayarlanmış ASR/VAD/LLM/TTS ardışık düzeniyle bir LiveKit agent ayağa kalkar. Bölüm:

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Uçtan uca gecikme | 100 kayıtlı çağrıda 800 ms'nin altında p50 ilk ses çıkışı |
| 20 | Sıra alma kalitesi | Hamming VAD'da yanlış kesme oranı %3'ün altında benchmark |
| 20 | Araç kullanımında doğruluk | Sesi kesmeden doğru verileri döndüren konuşma ortası araç çağrıları |
| 20 | Paket kaybı altında güvenilirlik | WER ve %3 paket düşüşü enjekte edilerek sıra alma kararlılığı |
| 15 | Emniyet kemerinin eksiksizliğini değerlendirin | Genel yapılandırmayla tekrarlanabilir ölçümler |
| **100** | | |

## Egzersizler

1. Deepgram Nova-3'ü g5.xlarge üzerinde daha hızlı fısıltı v3 turbo ile değiştirin. Gecikmeyi ve WER boşluğunu ölçün. CPU-GPU kararlarının nerede önemli olduğunu belirleyin.

2. Bir kesinti-tahkim politikası ekleyin: kullanıcı bir araç çağrısı sırasında içeri girdiğinde agent ne yapar? Üç politikayı karşılaştırın (kesin iptal, aracı bitir-sonra durdur, sonraki turda sıraya gir).

3. Rakipsel bir dönüş dedektörü testi yapın: kullanıcıya cümlenin ortasında uzun duraklamalar verin. VAD sessizlik eşiğini ve dönüş dedektörü puan eşiğini, 900 ms'yi geçmeden en düşük hatalı kesme için ayarlayın.

4. Aynı agent'yı Twilio aracılığıyla PSTN'ye dağıtın. PSTN ilk ses çıkışını WebRTC ile karşılaştırın. Jitter-buffer ve codec farklılıklarını açıklayın.

5. İngilizce dışındaki diller (Japonca, İspanyolca) için ses etkinliği algılama ekleyin. Dile özgü ince ayarlara karşı Silero VAD v5 yanlış tetikleme oranını ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Dönüş algılama | "İfadenin sonu" | VAD sessizliği ve kısmi transkript verildiğinde kullanıcının konuşmasının bittiğine karar veren sınıflandırıcı |
| Katılma | "Kesinti yönetimi" | VAD yeni kullanıcı konuşmasını algıladığında oynatmanın ortasında TTS'yi iptal etme |
| İlk ses çıkışı | "Gecikme" | Kullanıcının sunucudan çıkan ilk ses paketiyle konuşmayı durdurmasından itibaren geçen süre |
| VAD | "Konuşma kapısı" | Ses çerçevelerini konuşma ve sessizlik olarak sınıflandıran model; Silero VAD v5, 2026'nın varsayılanıdır |
| Titreşim arabelleği | "Ses yumuşatma" | Ağ değişikliklerini absorbe etmek için paketleri kısa süreliğine tutan istemci tarafı arabelleği |
| Dolgu | "Teşekkür token" | Bir takım yavaş olduğunda sessizliği önlemek için agent'ın çıkardığı kısa ifade |
| MOS | "Ortalama görüş puanı" | Algısal konuşma kalitesi derecelendirmesi; NISQA otomatik proxy'dir |

## Daha Fazla Okuma

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — WebRTC agent framework referansı
- [Pipecat](https://github.com/pipecat-ai/pipecat) — alternatif Python öncelikli akış agent framework
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — entegre konuşma modelleri için referans
- [Deepgram Nova-3 belgeleri](https://developers.deepgram.com/docs) — ASR referansı akışı
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD referans modeli
- [Cartesia Sonic-2](https://docs.cartesia.ai) — düşük gecikmeli TTS referansı
- [Yapay zeka mimarisini yeniden anlat](https://docs.retellai.com) — prodüksiyon sesi agent mimarisi
- [Vapi.ai üretim yığını](https://docs.vapi.ai) — alternatif üretim referansı
