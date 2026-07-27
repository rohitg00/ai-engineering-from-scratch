# Prompt Önbelleğe Alma ve Anlamsal Önbelleğe Alma Ekonomisi

> **2026-04 tarihli fiyatlandırma anlık görüntüsü.** Aşağıdaki sayısal talepler, bu dersin yayınında alınan satıcı ücret listelerini yansıtmaktadır; Aşağı yönde alıntı yapmadan önce bağlantılı dokümanları doğrulayın.

> Önbelleğe alma iki katmanda gerçekleşir. L2 (sağlayıcı düzeyi) prompt/önek önbelleğe alma, tekrarlanan önekler için dikkat KV'sini yeniden kullanır — Anthropic'in prompt önbellekleme belgeleri, uzun prompt'lerde %90'a varan maliyet düşüşü ve %85 gecikme azalmasının reklamını yapar; Claude 3.5 için Sonnet önbellek okumaları, 5 dakikalık TTL ve 1 saatlik TTL seçeneği için 2 kat yazma premiumu ile $0.30/M vs $3.00/M tazedir (docs.anthropic.com, 2026-04). OpenAI prompt önbelleğe alma, prompt'ler ≥1024 token'ler için otomatik olarak uygulanır ve önbelleğe alınmış girişleri yenilere kıyasla yaklaşık %90 indirimle fiyatlandırır (platform.openai.com, 2026-04); Model başına önbelleğe alınan kesin ücret, canlı ücret listesine bağlıdır. L1 (uygulama düzeyinde) anlamsal önbelleğe alma, embedding benzerlik isabetlerinde LLM'yi tamamen atlar. Satıcı "%95 doğruluk" isabet oranını değil eşleşme doğruluğunu ifade eder; rapor edilen üretim isabet oranları %10'dan (açık uçlu sohbet) %70'e (yapılandırılmış SSS) kadar değişir; hiçbir sağlayıcı resmi bir temel yayınlamadığından bunları garanti yerine topluluk telemetrisi olarak değerlendirin. Üretim tuzakları: paralelleştirme, önbelleğe almayı ortadan kaldırır (ilk önbelleğe yazma işleminden önce gönderilen N paralel istek, harcamayı birkaç kat artırabilir) ve önek içindeki dinamik içerik, önbellek isabetlerini tamamen önler. ProjectDiscovery, dinamik metni önbelleğe alınabilir önekin dışına taşıyarak isabet oranının %7'den %74'e (2025-11) çıktığını bildirdi.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak iki katmanlı önbellek simülatörü)
**Önkoşullar:** Aşama 17 · 04 (Motorun Dahili Parçalarına Hizmet Verme), Aşama 17 · 06 (SGLang RadixAttention)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- L2 prompt/önek önbelleğe almayı (sağlayıcıda KV'nin yeniden kullanımı) L1 anlamsal önbelleğe almadan (benzer prompt'lerde LLM atlaması) ayırın.
- Anthropic'in `cache_control` açık işaretlemesini ve iki TTL seçeneğini (5 dakika ve 1 saat) fiyat çarpanlarıyla birlikte açıklayın.
- İsabet oranı, prompt/yanıt karışımı ve token fiyatları göz önüne alındığında beklenen aylık tasarrufları hesaplayın.
- Faturaları 5-10 kat artıran paralelleştirme anti-örüntüsünü ve isabet oranını düşüren dinamik içerik anti-örüntüsünü adlandırın.

## Sorun

RAG hizmetinize prompt önbelleğe almayı eklersiniz. Tasarı sabit kalıyor. İsabet oranını ölçersiniz; %7'dir. prompt'leriniz statik görünüyor ancak öyle değil - prompt sistemi, dakikaya göre biçimlendirilmiş geçerli tarihi, bir istek kimliğini ve çeşitlilik için rastgele bir örnek yeniden sıralamayı içerir. Her istek yeni bir önbellek girişi yazar, sıfır okur.

Ayrı olarak, agent cihazınız kullanıcı sorusu başına on paralel araç çağrısı çalıştırır. On tanesinin tümü, ilk önbelleğe yazma işlemi tamamlanmadan önce sağlayıcıya ulaşır. On yazıyor, sıfır okuyor. Faturanız, "önbelleklemeyle" maliyetinin 5-10 katıdır.

Önbelleğe alma bir bayrak değil, bir protokoldür. İki katman, iki farklı arıza modu.

## Konsept

### L2 — sağlayıcı prompt/önek önbelleğe alma

Sağlayıcı, önbelleğe alınabilir bir önek için dikkat KV'sini saklar ve önekle eşleşen bir sonraki istekte yeniden kullanır. Bir kez yazma ücreti ödersiniz, okuma neredeyse bedavadır.

**Antropik (Claude 3.5 / 3.7 / 4 serisi)**: istekte açık `cache_control` işaretçisi. Hangi blokların önbelleğe alınabileceğini etiketlersiniz. TTL: 5 dakika (yazma maliyeti taban 1,25x) veya 1 saat (yazma maliyeti taban taban 2 kat). Önbellekte şunlar yazıyor: $0.30/M on Claude 3.5 Sonnet vs $3.00/M taze — 10 kat daha ucuz (docs.anthropic.com, 2026-04 itibarıyla). Fiyatlar modele göre farklılık gösterir (Opus/Haiku ayrı olarak yayınlanır); her zaman canlı fiyatlandırma sayfasını çapraz kontrol edin.

**OpenAI**: prompt'ler ≥1024 token'ler (platform.openai.com, 2026-04) için otomatik önbelleğe alma. Açık bir bayrak yok. Önbelleğe alınmış giriş, mevcut gpt-4o/gpt-5 ücret listelerinde taze girişten yaklaşık 10 kat daha ucuzdur. Ne belgeler ne de sürüm notları resmi bir isabet oranı temeli yayınlamaz; topluluk raporları dikkatli prompt tasarımıyla %30-60 civarında kümeleniyor. Kendinizinkini ölçmek için `usage.cached_tokens`'yi izleyin.

**Google (Gemini)**: açık API aracılığıyla bağlamı önbelleğe alma; 1M-token bağlamı, önbelleğe almanın daha da fazla kazandırdığı anlamına gelir.

**Kendi kendine barındırılan (vLLM, SGLang)**: Aşama 17 · 06, RadixAttention'ı kapsar — kendi bilgisayarınızdaki aynı model.

### L1 — uygulama düzeyinde anlamsal önbelleğe alma

LLM'yi çağırmadan önce prompt'yi hashleyin, gömün ve önbelleğe alınmış benzer bir istek arayın (eşiğin üzerindeki kosinüs benzerliği, genellikle 0,95+). İsabet halinde önbelleğe alınan yanıtı döndürün. Kaçırıldığında LLM'yi arayın ve sonucu önbelleğe alın.

Açık kaynak: Redis Vector Benzerliği, GPTCache, Qdrant. Ticari: Anahtar Önbelleği, Helicone Önbelleği.

Satıcının doğruluk iddiaları, ne sıklıkta yanıt verdiğinizi değil, geri gönderilen önbelleğe alınmış yanıtın anlamsal olarak ne sıklıkta uygun olduğunu belirtir. Üretim isabet oranları:

- Açık uçlu sohbet: %10-15.
- Yapılandırılmış SSS / destek: %40-70.
- Kod soruları: %20-30 (küçük değişkenler isabetleri öldürür).
- prompt'leri tekrarlayan ses agent'ler: %50-80 (ses normalleştirme sabit ayarı).

### Paralelleştirme anti-örüntüsü

agent cihazınız paralel olarak 10 takım çağrısı yapar. 10'unun tümü aynı 4K-token sistemine prompt sahiptir. Antropik önbellek yazma işlemleri istek başına yapılır; İlk önbelleğe yazma işlemi, sağlayıcı prompt'yi gördükten yaklaşık 300 ms sonra tamamlanır. 2-10 arasındaki istekler aynı milisaniyelik pencerede gelir ve her biri önbellek eksikliğini görür. 10 yazma primi, 0 okuma indirimi ödersiniz.

Düzeltme: önce sıralı toplu iş — tek başına istek 1'i yapın, ardından 1'in önbelleği dolduğunda 2-10'u ateşleyin. İlk araç çağrısına 300 ms ekler; faturanın 5-10 katı tasarruf sağlar.

### Dinamik içerik anti-örüntüsü

Sisteminiz prompt şöyle görünür:

```
You are a helpful assistant. The current time is 14:32:17.
User ID: abc123. Today is Tuesday...
```

Her istek benzersizdir. Her istek yazıyor. Sıfır isabet.

Düzeltme: Gerçekten statik olan her şeyi önbelleğe alınabilir öneke taşıyın; dinamik içeriği önbellek sınırından sonra ekleyin:

```
[cacheable]
You are a helpful assistant. [rules, examples, instructions]
[/cacheable]
[dynamic, not cached]
Current time: 14:32:17. User: abc123.
```

ProjectDiscovery bu şekilde önbellek isabet oranını %7'den %74'e çıkardı ve anatomiyi yayınladı.

### Gecelik iş yükleri için toplu iş + önbellek

Toplu API'ler (Aşama 17 · 15), 24 saatlik geri dönüşte %50 indirim sağlar. Üstte önbelleğe alınmış giriş, bunun üzerine ~ 10 kat daha fazla kazandırır. Gecelik sınıflandırma, etiketleme ve rapor oluşturma iş yükleri, yığınlama yoluyla eşzamanlı-önbelleğe alınmamış maliyetin ~%10'una düşebilir.

### Hatırlamanız gereken sayılar

Fiyatlandırma noktaları, bağlantılı satıcı belgelerinden 2026-04'te alınmıştır ve birkaç ayda bir sapma gösterir; bunlara güvenmeden önce yeniden kontrol edin.

- Antropik önbelleğe alınmış okuma: Claude 3.5 Sonnet'te 0,30 ABD doları/milyon, yeni girdiden (docs.anthropic.com) kabaca 10 kat daha ucuz.
- Antropik önbellek yazma premiumu: 1,25x (5 dakikalık TTL) veya 2x (1 saatlik TTL).
- OpenAI otomatik önbellek: prompt'ler ≥1024 token'ler için geçerlidir; önbelleğe alınmış giriş, mevcut ücret listelerindeki (platform.openai.com) yeni girişin yaklaşık %10'u kadar fiyatlandırılır.
- Anlamsal önbellek isabet oranı (topluluk tarafından bildirilen): ~%10 açık sohbet; ~%70'e kadar yapılandırılmış SSS. Satıcı tarafından belgelenen bir temel değil.
- ProjectDiscovery: Dinamik önekin dışına taşınarak %7 → %74 isabet oranı (proje blogu, 2025-11).
- Paralelleştirme anti-örüntü: N paralel istek ilk önbellek yazımını kaçırdığında 5-10 kat fatura artışına ilişkin tipik raporlar.

## Kullan onu

`code/main.py`, karışık iş yüklerinde L1 + L2 önbelleğe almayı simüle eder. Raporlar isabet oranlarını, faturaları ve paralelleştirme cezasını gösterir.

## Gönderin

Bu ders `outputs/skill-cache-auditor.md`'yi üretir. prompt şablonu ve trafiği göz önüne alındığında, önbelleğe alınabilirliği denetler ve yeniden yapılandırma önerir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Paralelleştirme bayrağını açın/kapatın. Tasarı ne kadar değişiyor?
2. prompt sisteminizin bir tarihi var. Dışarı taşıyın. İsabet oranı matematiğini öncesi/sonrası göster.
3. İsteğinizin varış oranına göre 1 saatlik TTL (2x yazma) ve 5 dakikalık TTL (1,25x yazma) için başabaş noktasını hesaplayın.
4. Anlamsal önbellek 0,95 eşiğinde %20'ye ulaşır. 0,85'te %50'ye ulaşır ancak önbelleğe alınmış hatalı yanıtları görürsünüz. Doğru eşiği seçin ve gerekçelendirin.
5. Kullanıcı sorusu başına 10 paralel alt sorguyu topluyorsunuz. Uçtan uca gecikme eklemeden önbellek dostu olması için yeniden yazın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| L2 prompt önbellek | "önek önbelleği" | Sağlayıcı tekrarlanan önek için KV'yi saklar |
| `cache_control` | "Antropik önbellek işaretçisi" | Önbelleğe alınabilir blokları açık öznitelik olarak işaretleme |
| Önbelleğe yazma primi | "vergi yaz" | İlk önbelleğe alma hatasının ekstra maliyeti (1,25x veya 2x) |
| L1 anlamsal önbellek | "embedding önbellek" | LLM'yi çağırmadan önce uygulama düzeyinde karma ve yerleştirme |
| GPTC Önbelleği | "LLM önbelleğe alma kütüphanesi" | Popüler OSS L1 önbellek kitaplığı |
| Önbellek isabet oranı | "isabetler / toplam" | Önbellekten sunulan isteklerin oranı |
| Paralelleştirme anti-desen | "N-yazma tuzağı" | N paralel istek önbelleği N kez kaçırıyor |
| Dinamik içerik tuzağı | "zaman-içinde-prompt tuzağı" | Önek öldürme isabet oranındaki dinamik baytlar |
| RadixDikkat | "kopya içi önbellek" | SGLang'ın önek önbellek uygulaması |

## Daha Fazla Okuma

- [Antropik Prompt Önbelleğe Alma](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — resmi `cache_control` semantiği ve TTL'ler.
- [OpenAI Prompt Önbelleğe Alma](https://platform.openai.com/docs/guides/prompt-caching) — otomatik önbelleğe alma davranışı ve uygunluğu.
- [TianPan — Yüksek Lisans Üretimi için Anlamsal Önbelleğe Alma](https://tianpan.co/blog/2026-04-10-semantic-caching-llm-production)
- [ProjectDiscovery — Prompt Önbelleğe Alma ile LLM Maliyetlerini %59 Azaltın](https://projectdiscovery.io/blog/how-we-cut-llm-cost-with-prompt-caching)
- [DigitalOcean / Antropik — Prompt Önbelleğe Alma](https://www.digitalocean.com/blog/prompt-caching-with-digital-ocean)
