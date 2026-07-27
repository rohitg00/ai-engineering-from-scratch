# Üretim Çalışma Zamanları: Kuyruk, Etkinlik, Cron

> Üretim agent'ler altı çalışma zamanı şeklinde çalışır: istek-yanıt, akış, dayanıklı yürütme, kuyruk tabanlı arka plan, olay odaklı ve zamanlanmış. framework'yi seçmeden önce şekli seçin. Observability her şekilde yük taşır.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 13 (LangGraph), Aşama 14 · 22 (Ses)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Altı üretim çalışma zamanı şeklini adlandırın ve her birini bir framework / ürün modeliyle eşleştirin.
- Uzun vadeli görevler için dayanıklı yürütmenin (LangGraph) neden önemli olduğunu açıklayın.
- Olay odaklı çalışma zamanını ve Claude Managed Agent'lerin ne zaman uygun olduğunu açıklayın.
- Çok adımlı agent'ler için yük taşıma olarak observability iddiasını açıklayın.

## Sorun

Üretim agent'ler bir Jupyter dizüstü bilgisayarın ortaya çıkamayacağı şekillerde başarısız oluyor: 37. adımda ağ zaman aşımları, kullanıcı sesli aramanın ortasında telefonu kapatıyor, cron işi makine yeniden başlatıldığında ölüyor, arka planda çalışanın belleği tükeniyor. Çalışma zamanı şekli hangi arızaların kalıcı olduğunu belirler.

## Konsept

### İstek-yanıt

- Eşzamanlı HTTP. Kullanıcı tamamlanmayı bekler.
- Yalnızca kısa görevler (<30s) için uygundur.
- Yığınlar: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa).
- Observability: standart HTTP erişim günlükleri + OTel aralıkları.

### Akış

- Aşamalı çıktı için SSE veya WebSocket.
- LiveKit bunu ses/video için WebRTC'ye kadar genişletir (Ders 22).
- Yığınlar: akış desteğine sahip herhangi bir framework + SSE/WS'yi yöneten bir ön uç.
- Observability: parça başına zamanlama, ilk token gecikmesi, kuyruk gecikmesi.

### Dayanıklı uygulama

- Her adımdan sonra devlet kontrol noktası; başarısızlık durumunda otomatik olarak devam eder.
- AutoGen v0.4 aktör modeli, arızaları tek bir agent'ye yalıtır (Ders 14).
- LangGraph'ın temel farklılaştırıcısı (Ders 13).
- Adım sayısının bilinmediği ve kurtarma maliyetinin yüksek olduğu durumlarda gereklidir.

### Kuyruk tabanlı / arka plan

- İş kuyruğa giriyor, çalışanlar alıyor, sonuçlar web kancaları veya pub/sub aracılığıyla geri akıyor.
- Uzun ufuklu agent'ler için gereklidir (Anthropic'in bilgisayar kullanımı duyurusuna göre görev başına onlarca ila yüzlerce adım).
- Yığınlar: Kereviz (Python), BullMQ (Node), SQS + Lambda (AWS), özel.
- Observability: kuyruk derinliği, iş başına gecikme dağılımı, DLQ boyutu.

### Olay odaklı

- Agent'ler tetikleyicilere abone olur: yeni e-posta, açılan PR, cron ateşi.
- Claude Managed Agent'ler bunu kutudan çıktığı haliyle ele alıyor (Ders 17).
- CrewAI Flows (Ders 15) olaya dayalı deterministik iş akışlarını yapılandırır.
- Observability: tetikleme kaynağı, olaydan başlama gecikmesi, agent gecikmesi.

### Planlanmış

- Periyodik olarak çalışan Cron şeklindeki agent'ler.
- Başarısız bir gece koşusunun bir sonraki adıma devam etmesi için dayanıklı uygulamayla birleştirin.
- Yığınlar: Kubernetes CronJob + dayanıklı bir framework; barındırılan (Render cron, Vercel cron).

### 2026 deployment modelleri

- Olay odaklı üretim için **CrewAI Akışları**.
- **Agno** Python mikro hizmetleri için durum bilgisi olmayan FastAPI.
- embedding için **Mastra** sunucu adaptörleri (Express, Hono, Fastify, Koa).
- Yönetilen ses için **Pipecat Cloud / LiveKit Cloud** (Ders 22).
- **Claude, barındırılan uzun süreli eşzamansız çalışma için Agent'leri Yönetti.

### Observability yük taşıyıcıdır

OpenTelemetry GenAI yayılma alanları (Ders 23) artı Langfuse/Phoenix/Opik arka ucu (Ders 24) olmadan, 40. adımda başarısız olan çok adımlı bir agent'de hata ayıklayamazsınız. Bu, üretim için isteğe bağlı değildir. Bu, "hataları hızlı bir şekilde ayıklıyoruz" ile "daha fazla kayıt tutarak sıfırdan tekrar oynatıyoruz" arasındaki farktır.

### Üretim çalışma zamanlarının başarısız olduğu yerler

- **Yanlış şekil seçimi.** 5 dakikalık bir görev için istek-yanıt seçimi. Kullanıcılar telefonu kapatır; işçiler yığılıyor; bileşiği yeniden dener.
- **DLQ yok.** Teslim mektubu olmayan kuyruk çalışanları. Başarısız işler ortadan kaybolur.
- **Opak arka plan çalışması.** Arka plan agent iz dışa aktarımı olmadan çalışır. Kullanıcı bunları rapor edene kadar hatalar görünmez.
- **Dayanıklı durum atlanıyor.** Yeniden başlatmayı göze alamayacağınız 30 saniyeden uzun herhangi bir koşunun uzun süreli yürütülmesi gerekir.

## İnşa Et

`code/main.py` bir stdlib çok şekilli demodur:

- İstek-yanıt uç noktası (düz işlev).
- Akış işleyicisi (jeneratör).
- DLQ ile kuyruk tabanlı çalışan.
- Olay tetikleyici kaydı.
- Cron şeklinde zamanlayıcı.

Çalıştır:

```bash
python3 code/main.py
```

Çıktı: Her şeklin aynı görevdeki davranışını gösteren beş iz. Aynı agent mantığı, farklı dış kabuklar. Dayanıklı uygulama (altıncı şekil), Ders 13'te LangGraph kontrol noktalarıyla kasıtlı olarak ele alınmaktadır.

## Kullan onu

- Sohbet tarzı kullanıcı deneyimi için **istek-yanıt**.
- Aşamalı yanıtlar için **Akış**.
- Uzun vadeli görevler için **dayanıklı**.
- Toplu iş / eşzamansız / uzun çalışma için **kuyruk**.
- agent reaktivitesi için **Olay**.
- Temizlik için **Cron** (bellek birleştirme, değerlendirmeler, maliyet raporları).

## Gönderin

`outputs/skill-runtime-shape.md`, bir görev için bir çalışma zamanı şekli seçer ve observability gereksinimlerini bağlar.

## Egzersizler

1. Ders 01 ReAct döngünüzü yığınınızdaki altı şeklin tümüne taşıyın. Hangi şekil hangi ürün yüzeyine uyar?
2. Sıra tabanlı demoya bir DLQ ekleyin. %10 iş başarısızlığını simüle edin; yüzey DLQ boyutu.
3. Günün en iyi 20 izine karşı her gece çalışan, cron ile tetiklenen bir değerlendirme agent yazın.
4. Karşı basınçla akışı uygulayın: istemci yavaşsa agent'yi duraklatın. Bu, dönüş bütçesiyle nasıl etkileşime giriyor?
5. Claude Managed Agent belgelerini okuyun. Şirket içinde barındırılan uzun ufuklu bir agent'yi ne zaman yönetilene taşırsınız?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| İstek-cevap | "Senkron" | Kullanıcı bekler; yalnızca kısa görevler |
| Akış | "SSE / WS" | Aşamalı çıktı; daha iyi kullanıcı deneyimi; parça başına gözlemlenebilir gecikme |
| Dayanıklı uygulama | "Başarısızlıktan devam et" | Kontrol noktası durumu; son adımda yeniden başlat |
| Kuyruk tabanlı | "Arka plan işleri" | Üretici / işçi havuzu / DLQ |
| Olay odaklı | "Tetikleyici tabanlı" | Agent harici olaylara tepki verir |
| DLQ | "Geçersiz mektup kuyruğu" | Başarısız işler için park yeri |
| Claude Agent'leri Yönetti | "Barındırılan koşum takımı" | Antropik olarak barındırılan, önbelleğe alma + sıkıştırma ile uzun süre çalışan eşzamansız |

## Daha Fazla Okuma

- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — dayanıklı uygulama ayrıntıları
- [Claude Managed Agent'lere genel bakış](https://platform.claude.com/docs/en/managed-agents/overview) — barındırılan uzun süreli eşzamansız çalışma
- [Antropik, Bilgisayar kullanımına giriş](https://www.anthropic.com/news/3-5-models-and-computer-use) — "görev başına onlarca ila yüzlerce adım"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — aktör-model hata izolasyonu
