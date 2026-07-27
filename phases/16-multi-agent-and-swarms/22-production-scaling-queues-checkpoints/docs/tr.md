# Üretim Ölçeklendirmesi — Kuyruklar, Kontrol Noktaları, Dayanıklılık

> Çoklu-agent sistemlerini binlerce eş zamanlı çalıştırmaya ölçeklendirmek **dayanıklı yürütme** gerektirir — iş kuyrukları artı kontrol noktaları, böylece herhangi bir çalışan herhangi bir kilitlenmeden sonra herhangi bir çalıştırmayı devam ettirebilir; kiralama işlemlerinin, bağımsız yan etkilerin ve deterministik tekrarın mevcut olması sağlanır. LangGraph'ın çalışma zamanı referans örneğidir: `thread_id` (varsayılan olarak Postgres) ile anahtarlanan her süper adımdan sonra bir kontrol noktası yazar; işçi işten çıkar ve başka bir işçi işe devam eder. Agent'ler insan girdisini bekleyerek süresiz olarak uyuyabilirler. **MegaAgent** (arXiv:2408.09955), üç duruma (Boşta / İşleme / Yanıt) ve iki katmanlı koordinasyona (grup içi sohbet + gruplar arası yönetici sohbeti) sahip, her-agent üretici-tüketici kuyruğunu çalıştırdı. **Fiber/async** LLM akışı için iş başına iş parçacığının önüne geçer: iş parçacıkları token'ları beklerken zamanın %99'unda boşta kalır, fiberler G/Ç'de işbirliği içinde çalışır. Karşı nokta: Ashpreet Bedi'nin "Agentic Yazılımının Ölçeklendirilmesi", yük aksini kanıtlayana kadar **FastAPI + Postgres + başka hiçbir şeyi** savunuyor; basit mimariler beklenenden daha ileri gidiyor. Bu ders, dayanıklı bir kontrol noktası günlüğü, durum geçişleri içeren bir agent başına iş kuyruğu, bir eşzamansız-iş parçacığı demosu oluşturur ve pragmatik "basit başla" kuralını uygular.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib, `asyncio`, `sqlite3`)
**Önkoşullar:** Aşama 16 · 09 (Paralel Sürü Ağları), Aşama 16 · 13 (Paylaşılan Bellek)
**Süre:** ~75 dakika

## Sorun

Bir prototip çoklu-agent sistemi, bir dizüstü bilgisayarda, bellek içi olay döngüsünde üç agent ile çalışır. Üretime geçersiniz:

- Agent'ler bazen saatlerce çalıştırılır (uzun araştırma, döngüdeki insan beklemeleri).
- Çalışan süreçleri çöküyor. Yeniden başlatma durumu kaybeder.
- Tepe yükü ortalamanın 10 katıdır; yatay ölçeklendirmeye ihtiyacınız var.
- Kullanıcılar agent-çalışma başına ödeme yapar; şarj etmek için tam olarak bir kez anlambilime ihtiyacınız var.

Bellek içi olay döngüsü bunların hiçbirini yapmaz. Altında dayanıklı bir yürütme katmanına ihtiyacınız var. 2026 kanonik seçenekleri şunlardır:

1. Kontrol noktalarına sahip bir iş akışı motoru (Temporal, LangGraph çalışma zamanı).
2. Durum deposuna sahip bir mesaj kuyruğu (Postgres + SQS/RabbitMQ).
3. Aktör-model framework'ler (MegaAgent'nin agent başına üretici-tüketicisi).
4. Elle haddelenmiş FastAPI + Postgres (Bedi'nin argümanı).

Bu ders her birinin minyatürünü oluşturur.

## Konsept

### Dayanıklı uygulama, desen

Dayanıklı bir yürütme motoru, her "adımdan" (LangGraph'ın dilinde süper adım) sonra tam program durumunu sürdürür. Kaza anında:

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

Bunun çalışması için gereksinimler:

- **Serileştirilebilir durum.** Tüm agent durumunun kalıcı olması gerekir. Canlı veritabanı bağlantılarıyla işlev kapanışları kalıcı değildir.
- **Deterministik özgeçmiş.** Aynı durum ve aynı girdiler göz önüne alındığında, agent aynı eylemleri üretir (veya LLM çağrıları için harici bir deterministik kehanete erteler).
- **Eşit olmayan yan etkiler.** Harici çağrılar (araç çağrıları, ödemeler) eş etkili olmalı veya tekilleştirme anahtarı kullanılmalıdır.

LangGraph her süper adımdan sonra bir kontrol noktası yazar; Her aktiviteden sonra geçici yazılar; Restate, olay kaynaklı günlükleri kullanır. Üçü de aynı modeli uyguluyor.

### Adım başına denetim noktası çalışma zamanı

LangGraph'ın çalışma zamanı çalışılan örnektir: her agent'ın bir `thread_id`'si vardır; durum yazılı bir sözdür; her süper adım, kontrol noktaları tablosuna bir satır yazar. Devam ettirildiğinde çalışma zamanı sıfırdan değil son kontrol noktasından yeniden oynatılır. Agents `interrupt()` insan girdisini bekleyebilir; çalışma zamanı devam eder ve çalışanı serbest bırakır. Giriş geldiğinde herhangi bir çalışan devam edebilir.

Bu, Nisan 2026'daki referans üretim tasarımıdır.

### MegaAgent, agent kuyruğu başına

arXiv:2408.09955 ölçekli bir deneyi açıklar: bir kümede binlerce eşzamanlı agent. Mimari:

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

İki katmanlı koordinasyon, grup içi sohbetin yoğun bir şekilde gerçekleşmesine, gruplar arası ise seyrek kalmasına olanak tanır; bu, maliyeti binlerce agent saniye içinde doğrusal tutmak için kullanılan modeldir.

### Zaman uyumsuz ve iş başına iş parçacığı karşılaştırması

LLM çağrıları G/Ç bağlantılıdır. Sonraki token'ı bekleyen bir iş parçacığı zamanın %99'unda boştadır. Konuların her biri ~1 MB RAM'e mal olur; 10.000 eşzamanlı çağrıda, bu yalnızca yığınlar için 10 GB'tır.

Fiberler (Python `asyncio`, Go goroutines, Rust `tokio`) işbirliği içinde G/Ç'de verim sağlar. Aynı 10.000 çağrı rahatlıkla sürece sığar. LLM-agent ölçeğinde eşzamansız bir optimizasyon değil, mimaridir.

İstisna: CPU'ya bağlı işlem sonrası işlemler (embedding, tokenizer hileler) hâlâ iş parçacıkları veya işlemler ister. G/Ç katmanınızı CPU katmanınızdan ayırın.

### Bedi'nin kontrpuanı

"Agentic Yazılımını Ölçeklendirmek" (Ashpreet Bedi, 2026), çoğu ekibin yükü ölçmeden önce aşırı mühendislik yaptığını öne sürüyor. Pragmatik varsayılan:

- FastAPI + Postgres.
- Her agent çalıştırma bir satırdır; durum iyimser eşzamanlılıkla yerinde güncellendi.
- `pg_notify` veya basit bir Kereviz çalışanı aracılığıyla arka plan işleri.
- Uygulama kodundaki politikayı yeniden deneyin.

Yönetilebilir görevlerde ~100 eş zamanlı agent çalıştırmanın altındaki yükler için genellikle ihtiyacınız olan tek şey budur. Başarısız olduğunu ölçtüğünüzde yükseltin.

Kural: Basit mimarilerin çözemeyeceği somut bir sorunla karşılaştığınızda dayanıklı yürütme framework'leri benimseyin. Erken evlat edinme, karşılığını vermeyen törenlerde zaman harcar.

### Tam olarak bir kez anlambilimi

Ücretli agent çalıştırma için "tam olarak bir kez etkili" (en az bir kez teslimat + tam yetkili tüketici) gerekir. Mühendislik hareketleri:

- **Çalışma başına yinelenenleri kaldırma anahtarı.** Bunu her yan etki çağrısına ekleyin.
- **Giden kutusu modeli.** Yan etkiler önce bir tabloya yazılır, ardından ayrı bir işlem bunları yürütür. Her iki adım da önemsizdir.
- **Telafi işlemleri.** Bir yan etki başarılı olmasına rağmen izleme yazımı başarısız olduğunda bir telafi planlayın.

Bunlar yüksek lisansa özgü değil, veritabanı mühendisliği kalıplarıdır. LLM vergisi yalnızca LLM çağrılarının yavaş olmasıdır; geri kalan her şey standart dağıtılmış sistemlerdir.

### Gökkuşağı deployment

Anthropic'in çoklu-agent araştırma sistemi "rainbow deployment'ları" kullanır: agent çalışma zamanının birden fazla sürümü aynı anda çalışır, böylece uzun süre çalışan agent'larin her kod dağıtımında öldürülmesi gerekmez. Canary'nin yeni versiyonları trafiğin bir kesitinde; agent'lari bittiğinde eski sürümleri kullanımdan kaldır.

Bu, uzun süre çalışan durum bilgisi olan sistemler için standarttır; 2026 uyarlaması, agent'ların saatlerce yaşayabileceği, dolayısıyla deployment döngünün uyum sağlaması gerektiğidir.

### Standart üretim kontrol listesi

- Dayanıklı durum (kontrol noktaları, anlık görüntüler veya giden kutusu + tekrar oynatılabilir günlük).
- Idempotent yan etkiler.
- Yüksek Lisans çağrıları için eşzamansız G/Ç katmanı.
- Tekilleştirme ile en az bir kez teslimat.
- Durum bilgisi olan iş yükleri için gökkuşağı/kanarya deployment.
- Observability: per-agent izleme, süper adım denetimi, yeniden deneme sayacı.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `CheckpointStore` — iş parçacığı kimliği anahtarlarına sahip SQLite destekli kontrol noktası günlüğü. Her süper adım bir satır ekler.
- `run_with_checkpoint(agent, thread_id)` — çalışma ortasında bir çarpışmayı simüle eder; ikinci bir işçi son kontrol noktasından devam eder.
- `AgentQueue` — küçük bir iş kuyruğuna sahip -agent başına Boşta / İşleme / Yanıt durumu makinesi.
- `demo_async_vs_threads()` — asyncio ve iş parçacıkları aracılığıyla 500 eşzamanlı simüle edilmiş "LLM çağrısını" çalıştırır; duvar saatini ve en yüksek belleği (yaklaşık olarak) bildirir.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: Simüle edilmiş çökme sonrasında kontrol noktasının sürdürülmesi başarılı oldu; eşzamansız sürüm, 1 saniyeden kısa sürede 500 eşzamanlı çağrıyı yönetir; iş parçacığı sürümü birkaç saniye sürer ve eşzamanlı birim başına daha fazla bellek kullanır.

## Use It — Hazır Araçla Uygula

`outputs/skill-scaling-advisor.md` , dayanıklı yürütme seçeneği konusunda tavsiyelerde bulunur: FastAPI + Postgres, LangGraph çalışma zamanı, Geçici veya özel. Yüke, durum saklama ihtiyaçlarına ve dağıtım sıklığına göre kalibre edilir.

## Ship It — Kullanıma Sun

Kanonik üretim sertleştirmesi:

- **Basit başlayın (Bedi kuralı).** Başarısız olduğunu ölçene kadar FastAPI + Postgres.
- **Optimize etmeden önce her şeyi enstrümantallayın.** Çalıştırma başına gecikme histogramı, adım başına süre, yeniden deneme sayısı, hata kategorizasyonu.
- **Yan etkiler için giden kutusu modeli.** Özellikle ödemeler ve harici API çağrıları.
- **Gökkuşağı dağıtımları.** Dağıtımlar sırasında uçuş sırasındaki agent koşularını asla sonlandırmayın.
- **Belirli sorunlarla karşılaştığınızda **dayanıklı yürütme motorlarını (Temporal / LangGraph / Restate) kullanın**: saatlerce süren döngüdeki insan beklemeleri, bölgeler arası koordinasyon, karmaşık yeniden deneme/telafi politikaları.
- **G/Ç katmanı için eşzamansız.** Yalnızca CPU'ya bağlı son işlemlere yönelik iş parçacıkları.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Kontrol noktası özgeçmişinin çalıştığını onaylayın; eşzamansız ve iş parçacığı eşzamanlılık farkını ölçün.
2. Bir **giden kutusu** tablosu uygulayın: her araç çağrısı önce giden kutusuna yazar, ardından ayrı bir goroutine/görev yürütülür. Araç çağrısını iki kez çalıştırarak önemsizliği doğrulayın.
3. **gökkuşağı dağıtımını** simüle edin: iki eşzamanlı çalışma zamanı sürümü; yeni thread_id'lerin yarısını her birine yönlendirin; eski sürümdeki uçuş içi iş parçacıklarının kesintiye uğramadığını doğrulayın.
4. LangGraph'ın çalışma zamanı belgesini okuyun (bağlantısı aşağıdadır). Elle yuvarlanan FastAPI + Postgres sürümünde çalışma zamanının hangi özelliklerinin çoğaltılmasının en uzun süreceğini belirleyin. Bu evlat edinmek için bir neden mi, yoksa erteleyebilir misin?
5. MegaAgent (arXiv:2408.09955) Bölüm 3'ü okuyun. İki katmanlı koordinasyon (grup içi + gruplar arası yönetici sohbeti) açıktır. Bunu iki kuyruk ailesi içeren bir mesaj kuyruğuna nasıl eşleyeceğinizi çizin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Dayanıklı uygulama | "Program durumunu sürdür" | Motor her süper adımdan sonra durumu yazar; Kilitlenme kurtarma deterministiktir. |
| Süper adım | "İşlem sınırı" | Kontrol noktaları arasındaki iş birimi. LangGraph terimi. |
| thread_id | "Agent çalıştırma tanımlayıcısı" | Kontrol noktalarını bağlayan ve mantığı devam ettiren anahtar. |
| İktidarsızlık | "Yeniden denemek güvenli" | Bir yan etkinin tekrarlanması, bir denemeyle aynı sonucu verir. |
| Giden kutusu modeli | "Yan etkileri ayırma" | Bir tabloya amaç yazın; ayrı bir uygulayıcı gerçekleştirir ve yapılanı işaretler. |
| En az bir kez teslimat | "Olası kopyalar" | Mesaj kuyruğu semantiği; tekilleştirme anahtarı tüketiciyi bir kez etkili kılar. |
| Gökkuşağı dağıtımı | "Çakışan sürümler" | Uzun süren iş yükleri sırasında eşzamanlı birden çok çalışma zamanı sürümü. |
| Asenkron fiber | "Kooperatif getirisi" | Kullanıcı modu eşzamanlılığı; G/Ç'ye bağlı yüklere yönelik iş parçacıklarıyla karşılaştırıldığında ucuz. |
| Kontrol noktası | "Durum anlık görüntüsü" | Süper adım sınırında serileştirilmiş durum; özgeçmiş için anahtar. |

## Daha Fazla Okuma

- [LangChain — Üretim derinliğinin arkasındaki çalışma zamanı agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — LangGraph çalışma zamanı tasarımı
- [MegaAgent](https://arxiv.org/abs/2408.09955) — agent üretici-tüketici kuyruğu başına; binlerce eşzamanlı agent saniyede iki katmanlı koordinasyon
- [Matrix](https://arxiv.org/abs/2511.21686) — koordinasyon alt katmanı olarak mesaj kuyruklarıyla merkezi olmayan framework
- [Geçici belgeler](https://docs.temporal.io/) — dayanıklı yürütme için referans iş akışı motoru
- [Antropik — Çoklu-agent araştırma sistemi](https://www.anthropic.com/engineering/multi-agent-research-system) — gökkuşağı deployment dahil üretim dersleri
