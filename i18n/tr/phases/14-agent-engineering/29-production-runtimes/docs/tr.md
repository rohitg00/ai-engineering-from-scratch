# Üretim Çalışma Zamanları: Sır, Olay, Cron

> Üretim ajanları altı çalıştırma zaman şekli üzerinde çalışır: istek- yanıt, akış, dayanıklı yürütme, sıraya dayalı arka plan, etkinlik odaklı ve programlanmış. Çerçeveyi seçmeden önce şekli seçin. Gözlemsellik her şekilde yük taşıyıcıdır.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Altı üretim çalışma şeklini belirleyin ve her biri bir çerçeve / ürün kalıbına eşleşsin.
- Uzun vadede yapılacak görevlerde neden dayanıklı bir şekilde çalıştırılması (LangGraph) önemli olduğunu açıklayın.
- Olaylara dayalı çalışma zamanını ve Claude Managed Agents'in ne zaman uygulanacağını açıklayın.
- Çok aşamalı ajanlar için yük olarak gözlemlenebilirlik iddiasını açıklayın.

## Sorun

Yapılama ajanları, Jupyter notbukunun yüzeyde görünmemesi gibi başarısız olur: 37'nci adımdaki ağ zamanlamaları, kullanıcı ses çağrısını ortalama asır, makine yeniden başlatılmasında cron işi ölür, arka plan işçisi hafızadan tükeniyor. Çalışma zaman şekli hangi başarısızlıkların hayatta kalabileceğini belirler.

## Anlaşım

### İstek- yanıt

- Kullanıcı tamamlanmayı bekliyor.
- Sadece kısa görevler için uygulanabilir (< 30s).
- Satırlar: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa).
- Gözlem: standart HTTP erişim günlüğü + OTel uzantıları.

### Akış

- SSE veya WebSocket'a göre ilerici çıkış.
- LiveKit bunu ses/video için WebRTC'ye uzattı (Denevi 22).
- Stacks: Akış desteği olan herhangi bir çerçeve + SSE/WS ile başa çıkılan bir ön uç.
- Gözlem: parça başına zamanlama, ilk işaret gecikmesi, kuyruğu gecikmesi.

### Sürekli çalıştırma

- Her adımdan sonra kontrol noktası, başarısızlık durumunda otomatik olarak devam et.
- AutoGen v0.4 aktör modeli, hataları bir ajanla (Deneyim 14) izole eder.
- LangGraph'in çekirdek farklılatıcısı (Desin 13).
- Adım sayısı bilinmeyen ve kurtarma maliyeti yüksek olduğunda önemlidir.

### Sırada / arka planda

- İş sıraya girdi, işçiler alıyor, sonuçlar web bağlantıları veya pub/sub üzerinden geri akıyor.
- Uzun ufuk ajanları için gereklidir (Anthropic'in bilgisayar kullanımı ilanı başına görev başına onlardan yüzlerce adım).
- Satırlar: Seleri (Python), BullMQ (Node), SQS + Lambda (AWS), özel.
- Gözlem: Sır derinliği, iş başına gecikme dağılımı, DLQ boyutu.

### Olaylara dayalı

- Ajanlar tetikleyiciye abone olurlar: yeni e-posta, PR açıldı, cron ateş.
- Claude Managed Agents bunu kutudan dışarıda kapsar (Deneyim 17).
- CrewAI Akışları (Denevi 15) olaylara dayalı belirleyici çalışma akışlarını yapılandırır.
- Gözlem: tetikleme kaynağı, olayın başlangıcındaki gecikme, ajan gecikme.

### Programlı

- Cron şeklinde ajanlar, zaman zaman çalışırlar.
- Sürekli bir şekilde çalıştırmakla birlikte, bir sonraki gece çalışması başarısız bir şekilde devam eder.
- Stacks: Kubernetes CronJob + dayanıklı bir çerçeve; barındırılmış (Render cron, Vercel cron).

### 2026 dağıtım kalıpları

- **CrewAI Flows**etkinlik odaklı üretim için.
- **Agno**Python mikroservisleri için devletsiz FastAPI.
- **Mastra**Ekleme için sunucu adaptörleri (Express, Hono, Fastify, Koa).
- **Pipecat Cloud / LiveKit Cloud**Yönetilen ses için (Deneyim 22).
- **Claude Managed Agents**Ev sahipliği yapılmış uzun süreli asynk için.

### Gözlemsellik yük taşıyıcıdır.

OpenTelemetry GenAI (Denevi 23) ve Langfuse/Phoenix/Opik arka planı (Denevi 24) olmadan, adım 40'da başarısız olan bir çok adımlı ajanı debug edemezsiniz. Bu üretim için seçmeli değil. "Hızlı debug yapıyoruz" ve "daha fazla kaydı ile sıfırdan tekrar oynayıyoruz" arasındaki fark.

### Üretim süresi eksik olduğu durumlarda

- **Wrong shape choice.**5 dakikalık bir görev için talep- yanıt seçimi. Kullanıcılar kapatır, işçiler toplanır, tekrar denemeler yapılır.
- **No DLQ.**İşçiler ölü harf olmadan sıraya girer.
- **Opaque background work.**Arka plan ajanı, ihracatın izleri olmadan çalışır.
- **Skipping durable state.**Yeniden başlatamayacağınız her koşunun süren süresi 30 saniye.

```figure
wb-runtime-shapes
```

## Yapın

`code/main.py`stdlib çok şekilli bir demo:

- Arama- yanıt son noktası (sırf fonksiyon).
- Akış yöneticisi (generator).
- DLQ'la sırada çalışan bir işçi.
- Olay tetikleme kayıtları.
- Cron şeklinde programlayıcı.

Çek şunu:

```bash
python3 code/main.py
npx tsx code/main.ts
```

Çıktı: her şeklin aynı görevdeki davranışını gösteren beş iz. Aynı ajan mantığı, farklı dış kabuğu. Sürdürülebilir yürütme (altıncı şekil) LangGraph kontrol noktası ile 13. derste kasıtlı olarak kaplıdır.

## Kullan

- **Request-response**Çat tarzında UX için.
- **Streaming**Gelişmiş tepkiler için.
- **Durable**Uzun vadede yapılacak görevler için.
- **Queue**seri / async / uzun süreli kullanım için.
- **Event**ajan reaktifliği için.
- **Cron**Ev bakımı için (hüzdede birleştirme, değerlendirmeler, maliyet raporları).

## Gönder

`outputs/skill-runtime-shape.md`bir görev için bir çalıştırma süresi şeklini seçer ve gözlemlebilirlik gereksinimlerini bağlar.

## Egzersizler

1. Ders 01'i tekrar çalıştırmak için her altı şekline aktar. Hangi şekil hangi ürün yüzeyine uymaktadır?
2. Sırada yapılan demo'ya bir DLQ ekleyin. %10 iş başarısızlığı simülasyonu; yüzey DLQ boyutu.
3. Günlük en iyi 20 izini karşılayan cron tetiklenen bir değerlendirme ajanı yaz.
4. Geri baskı ile akış uygulaması: eğer müşteri yavaşsa, ajanı durdurun. Bu bir tur bütçesi ile nasıl etkileşim kurar?
5. Kendini yöneten bir uzun uzayda çalışan ajanı ne zaman yönetmeye geçireceksin?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Request-response | "Synchronous" | User waits; short tasks only |
| Streaming | "SSE / WS" | Progressive output; better UX; latency observable per chunk |
| Durable execution | "Resume from failure" | Checkpointed state; restart at last step |
| Queue-based | "Background jobs" | Producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | Agent reacts to external events |
| DLQ | "Dead-letter queue" | Parking lot for failed jobs |
| Claude Managed Agents | "Hosted harness" | Anthropic-hosted long-running async with caching + compaction |

## Daha Fazla Okumak

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Sürekli uygulanma detayları
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Ev sahipliği yapılmış uzun süreli async
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) "Her görev için onlardan yüzlerce adımı"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Aktör model hata izolyasyonu
