# Ajanlar için Oyuncu Modülü  Async Mesajlar ve Tiplenen Çalışma Zamanları

> Ajanlar aktörler olarak: async mesaj değişimi, olay yönlendirici yöneticiler, hata izolesi, doğal eşzamanlılık. AutoGen v0.4 (Microsoft Araştırmaları, Ocak 2025) bu model etrafında ajan orkestrasyonu yeniden tasarladı; çerçeve şimdi bakım modunda, Microsoft Agent Framework (halk ön izleme Ekim 2025) ile üretim varisi olarak.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Aktör modelini açıkla: ajanlar aktör olarak, mesajlar tek IPC olarak, aktör başına başarısızlık izolyasyonu.
- AutoGen v0.4'in üç API katmanının adını verin  Core, AgentChat, Ekstensiyonlar  ve her biri ne için.
- Mesaj teslimatını manipülasyondan ayırmanın neden hata izolesi ve doğal eşzamanlılık sağladığını açıklayın.
- Python'da bir stdlib aktör çalıştırma zamanını uygulayın ve iki ajan kod değerlendirmesi akışını ona aktarın.

## Sorun

Çoğu ajan çerçeve sinkron: bir ajan üretir, bir ajan tüketir, bir çağrı yığınında. Başarısızlıklar yığın çöküyor. Eşzamanlılık bağlanır. dağıtım yeniden yazılmayı gerektirir.

AutoGen v0.4'in cevabı: oyuncu modeli. Her ajan özel bir posta kutusuna sahip bir oyuncu. Mesajlar tek etkileşimdir. Çalışma zamanı teslimatı manipülasyondan ayırır. Başarısızlıklar tek bir oyuncuya izole edilir. Eşleşme doğaldır. dağıtım sadece farklı bir nakledir.

## Anlaşım

### Oyuncular

Bir aktörün:

- Özel bir devlet (birden hiç dokunmamıştır).
- Bir posta kutusu (eğitim kuyrusu).
- Bir yöneticisi:`receive(message) -> effects`Efektleri " yanıt " , " başka bir aktörüne gönder " , " yeni aktör yarat " , " güncelleme durumu " , " kendisini durdur " .

İki oyuncu hafızayı paylaşamaz, sadece mesaj gönderebilirler.

### Üç API katmanı

AutoGen v0.4 yüzeyini üç bölüme ayırır:

1. **Core.**Düşük düzeyde aktörler çerçevesini. `AgentRuntime`- Evet .`Agent`- Evet .`Message`- Evet .`Topic`- Asynk mesaj değişimi, olay yönlendirici.
2. **AgentChat.**Görev yönlendirici yüksek düzeyde API (v0.2'nin ConversableAgent'inin yerine geçiyor). `AssistantAgent`- Evet .`UserProxyAgent`- Evet .`RoundRobinGroupChat`- Evet .`SelectorGroupChat`- Evet .
3. **Extensions.**Entegre: OpenAI, Anthropic, Azure, araçlar, bellek.

### Neden kopartma önemli?

V0.2 modelinde, arama yapılıyor.`agent_a.chat(agent_b)`Agent_b'nin geri dönmesine kadar ajan_a'yı sinkron olarak bloke eder.`send(agent_b, msg)`Agent_b'nin posta kutusuna mesajı koyar ve geri gönderir.

- **Fault isolation.**A. A.  çalıştırma zamanı B'nin yöneticisinde başarısızlığı yakalar ve ne yapılması gerektiğine karar verir (log, yeniden denemek, ölü harf).
- **Natural concurrency.**Bir seferde birçok mesaj uçuyor; aktörler posta kutusunu aynı anda işliyor.
- **Distribution-ready.**Posta Kutusu + nakliye, oyuncunun işlem içinde ya da başka bir ev sahibi üzerinde olmasına rağmen aynı soyutlama.

### Topolojiler

- **RoundRobinGroupChat.**Ajanlar bir sırada sırayla döner.
- **SelectorGroupChat.**Seçim ajanı, konuşma bağlamına göre kimden sonra gideceğini seçer.
- **Magentic-One.**Web tarama, kod işleme, dosya işleme için referans çoklu ajan ekibi AgentChat'te inşa edilmiş.

### Gözlemsellik

OpenTelemetry desteği yerleştirilmiştir. Her mesaj bir uzantı yayar; araç çağrıları taşıyor `gen_ai.*`2026 OTel GenAI semantik sözleşmelerine göre özellikler (Desin 23).

### Durum: Bakım modusu

2026'un başlarında: AutoGen v0.7.x araştırma ve prototip oluşturmak için istikrarlıdır. Microsoft, aktif gelişimini Microsoft Agent Framework'e, üretim halefi (halk ön izlemesi 1 Ekim 2025; 1.0 GA'nın 2026'ın ilk çeyreğinin sonuna yöneliktir) değiştirdi.

```figure
actor-mailbox
```

## Yapın

`code/main.py`STDlib aktör çalıştırma zamanını uyguluyor:

- `Message`  ile yazılmış yararlı yük`sender`- Evet .`recipient`- Evet .`topic`- Evet .`body`- Evet .
- `Actor` soyut olarak `receive(message, runtime)`- Evet .
- `Runtime` ortak bir kuyruk, teslimat, başarısızlık izolyasyonu ile olay döngüsü.
- İki oyuncuyla bir demo:`ReviewerAgent`inceleme kodu, `ChecklistAgent`bir kontrol listesini yürütürler. Bir anlaşma olana kadar mesajları değiştirirler.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İz mesaj teslimatını, diğerini çarpmayan bir aktörde simülasyon bir başarısızlığı ve ortak bir hüküm üzerine birleştiğini gösterir.

## Kullan

- **AutoGen v0.4/v0.7**Araştırma, prototip oluşturma, çoklu ajanlı modeller için sabit.
- **Microsoft Agent Framework** üretim varisi (toplu ön izleme Ekim 2025); aynı oyuncu model fikirleri yenilenmiş bir API'de.
- **LangGraph swarm topology**(Daahi 13)  Ortak araçlar ile paylaşılmış el uzatma yoluyla benzer bir model.
- **Custom actor runtime** belirli bir nakliye ihtiyacınız olduğunda (NATS, RabbitMQ, gRPC).

## Gönder

`outputs/skill-actor-runtime.md`verilen bir çok ajanlı görev için minimum bir oyuncu çalıştırma süresi ve bir takım şablonu (RoundRobin veya Selector) oluşturur.

## Egzersizler

1. Bir ölü harf sırası ekleyin: bir işçi kaldırdığında, başarısız mesajı insan denetimi için park edin. DLQ oyuncakınıza ne sıklıkla vurulur?
2. Uygulama`SelectorGroupChat`: bir seçiciler oyuncusu, konuşma durumuna göre bir sonraki mesajı işleyenleri seçer.
3. dağıtılmış taşımacılığı ekle: işlem içindeki kuyrukları JSON-over-HTTP sunucusu için değiştirin, böylece aktörler ayrı süreçlerde çalışabilir.
4. Mesaj başına bir OTel uzantısı (veya bir no-op stand-in) gönderin.`gen_ai.agent.name`- Evet .`gen_ai.operation.name`23. Ders için.
5. AutoGen v0.4'in mimarlık yazısını okuyun. Oyuncaklarınızı gerçeklere taşıyin.`autogen_core`Üretim sırasında neyi atlattın ki?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | "Agent" | Private state + inbox + handler; no shared memory |
| Message | "Event" | Typed payload; the only way actors interact |
| Inbox | "Mailbox" | Per-actor queue of pending messages |
| Runtime | "Agent host" | Event loop that routes messages and isolates failures |
| Topic | "Channel" | Named publish-subscribe route between actors |
| Fault isolation | "Let it crash" | One actor failing does not crash others |
| RoundRobinGroupChat | "Fixed-rotation team" | Agents take turns in order |
| SelectorGroupChat | "Context-routed team" | Selector picks who goes next |
| Magentic-One | "Reference team" | Multi-agent squad for web + code + files |

## Daha Fazla Okumak

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Yeniden tasarlanmış bir görev
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Grafik şeklinde alternatif
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) AutoGen'in varsayılan olarak yaydığı alanlar
