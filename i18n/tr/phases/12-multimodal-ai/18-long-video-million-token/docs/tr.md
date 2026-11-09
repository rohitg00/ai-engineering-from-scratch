# Uzun Videolar Milyonlarca Konuşulan Kontextta Anlaşılıyor

> 24 FPS'de 1 saatlik 4K video, çişilmiş ve gömülü 60 milyon token üretir. 2 saatlik podcast bölümünün transkripsi 30.000 token. Blu-ray'de tam bir film, agresif bir gruplama ile sıkıştırılmış bile olsa, yüz binlerce token. Google'ın Gemini 1.5 (Mart 2024) bu çağı 10 milyon token bağlamıyla açtı. Bir saatlik videolar boyunca güvenilir bir iğne-haystack hatırlatması yaptı. LWM (Liu et al., Şubat 2024) halka dikkatinin ölçeklenme yolunu gösterdi. LongVILA ve Video- XL alımını daha da arttırdı. VideoAgent, çürük bağlamı ajantik çekim için değiştirdi. Her yaklaşım, hesaplama, hatırlama ve mühendislik karmaşıklığı konusunda farklı bir ödeme. Bu ders onları yan yana okuyor.

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router), TypeScript
**Prerequisites:** Phase 12 · 17 (video temporal tokens)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Uzun format videoları için toplam görsel işaret sayısını değişen FPS ve birleştirme ile hesaplayın.
- Dört ölçekleme yolunu açıklayın: kaba bağlam (Gemini 1.5), yüzük dikkat (LWM), simge sıkıştırma (LongVILA / Video-XL), ajantik geri alım (VideoAgent).
- Doğruluk ve gecikme konusunda çiğ bağlam video VLM'leri vs. ajantik-içtikleme video VLM'leri (VideoAgent) karşılaştırın.
- 30 dakikalık bir video için bir iğne-hay asmak testi tasarlayın ve belirli bir dakikada hatırlama ölçün.

## Sorun

Qwen2.5 VL boyutlu bir çubuk, 384 yerel çözünürlükte ~729 token. 3x3 birleştirme ile bu, çerçeve başına 81 token. 1 FPS = 1800 çerçeve = 145.800 token. 2025 yılına kadar yapılabilir açık VLM'ler, sıkı. 2 FPS'de 291.600 token  sadece en büyük bağlamlar uygundur.

1 FPS'de 2 saatlik bir film 583k jeton tutar. 2026 açık modellerinin çoğundan öte; Gemini 2.5 Pro veya daha agresif birleştirme gerektirir.

Dört merdiven yolu ortaya çıktı.

## Anlaşım

### Yolu 1: Kırmızı bağlam (Gemini 1.5, Claude Opus)

Soruna donanım atın, bağlamı milyonlarca tokene kadar ölçeyin, her şeyi bir ileri geçişle işleyin.

Gemini 1.5 Pro 1M token ile piyasaya sürüldü; Gemini 1.5 Ultra 10M; Gemini 2.5 Pro 2026'da saatlerce video güvenilir bir şekilde yapar.

Mühendislik: hafıza hiyerarşisi (yerel + küresel + nadir) ve uzun bağlamlı verimlilik için MoE uzman yönlendirme ile özel bir dikkat uygulaması. Tam ayrıntılı olarak yayınlanmamış. Açık kaynaklı değil.

### Yolu 2: Yüzük dikkat (LWM, LongVILA)

Yüzük dikkat, her bir cihazın bir parça tutduğu bir "zeng"deki cihazlar arasında uzun diziler dağıtır.

LWM (Liu et al., 2024) 1M-token bağlam modeliyi bu şekilde eğitmiştir. Her cihazın tutan parça ile cihaz başına hafıza ölçekleri, böylece cihazlar eklemek bağlamı yaklaşık olarak doğrusal olarak genişletiyor. Toplam dikkat hesaplama bağlamda hala karelidir; halka cihazlar arasında çalışan bölünür ve anahtar / değer hesaplama ile geçiyor.

LongVILA (arXiv:2408.10188) örneği VLM'lere uyarladı. 1400-frame videoları çerçeve başına 192 token = 268k bağlamda, 8 yön paralellik boyunca halka dikkatle eğitilmiştir.

### Yolu 3: Token sıkıştırma (Video-XL, LongVA)

Kötü bağlamdan daha ucuz: LLM'nin sırayı görmeden önce agresif bir şekilde sıkıştır.

Video-XL (arXiv:2409.14485) görsel bir özetleme simgesi kullanır: N çerçevelerinin her bir klipi, N üzerinde bulunan tek bir "özetleme" simgesi üretir. Sonuç olarak, LLM, her bir klibe bir özetleme simgesi görür ve bağlamı önemli ölçüde küçültür.

LongVA, "uzun bağlam transfer" tekniği ile LLM bağlamını 200k'ten 2M'ye uzattı.

Token sıkıştırması, ölçeklendirme için belirli zaman damlalarında hatırlama işlemlerini değiştirir.

### Yolu 4: Ajantik geri alım (VideoAgent)

LLM'ye tam videoyu eklemeyin. Bunun yerine, videoyu bir veritabanı olarak ele alın ve sorgulamak için LLM kullanın.

VideoAgent (arXiv:2403.10517):

1. LLM soruyu okuyor.
2. LLM ilgili klipler için bir geri alma aracı istiyor ("meşhengle segmentleri gösterin").
3. Araç, klip zaman damgalarına eşleşen bir görüntü verir.
4. LLM, bu klipleri VLM üzerinden okuyor.
5. LLM cevapları oluşturur veya takip sorular sorar.

Bu, uzun videolara uygulanan LLM-as-agent örneğidir. Daha ucuz sonuç (sadece ilgili klipler kodlanmış), daha zor mühendislik (içindeki kalitesini geri almak boğaz haline gelir).

### İğne-hay döşek referans değerleri

Standart uzun bağlam testi: Video'daki rastgele bir noktada benzersiz bir görsel veya metin işaretçisi ekle, sonra onu hatırlamanızı gerektiren bir soru sor.

Metrik: Video uzunluğu ve işaretçi pozisyonu boyunca Recall@k.

Gemini 2.5 Pro, 90 dakikalık videolarda %99'luk hatırlama puanı elde eder. Açık 72B modelleri (Qwen2.5-VL-72B, InternVL3-78B) 30 dakikada ~85-90% puan alır ve 60'dan aşağı düşürülür.

VideoAgent 2+ saatte çiğ bağlamlı modellerle eşleşebilir veya yenemez çünkü araç iyiyse geri alım iğneye çarpar.

### Hangi yolu seçmeliyiz?

Sınır doğruluğunda 15 dakikalık bir klip için: açık 72B + yerel bağlam genellikle çalışır.

30 dakikalık 1 saatlik içerik için: LongVILA veya Video-XL açıktır; Gemini 2.5 Pro kapalıdır.

2+ saatlik içerik için: VideoAgent veya benzer arama kalıpları. Alternatif olarak, daha küçük parçalara özetle ve hiyerarşik özetleri besleyin.

### 2026 üretim modeli

Pratik olarak, üretim uzun video boru hattları hibriddir:

1. Tüm videoda dinamik FPS örnekleme + agresif birleştirme çalıştırın (100k token küresel bir temsil elde edin).
2. Küresel bir özet için 72B VLM'ye geçin.
3. Kullanıcı ayrıntılı sorular sorarsa, bir indeks olarak özet kullanarak ajantik geri alımı çalıştırın.

Bu, küresel anlayış için kaba bağlamı ve yerel ayrıntıları bulmak için birleştirir.

```figure
mm-video-token-budget
```

## Kullan

`code/main.py`- ...

- Videolar için 1 dakikadan 3 saate kadar değişen FPS + birleştirme ile token bütçelerini hesaplar.
- İğneyi bir çiy yığını içinde çalıştırmayı simüle eder: rastgele bir zaman damgasına bir işaretçi enjekte eder, bir soru sorar, puan geri alır.
- Aşağı akıntılı bir VLM'ye beslemek için belirli klipleri seçen bir ajantik-içimi yönlendirme simülatörü içerir.

Bütçe masasını çalıştır ve ölçek boşluğunu hissedin.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-long-video-strategy-planner.md`. Video süresi ve sorgu karmaşıklığı göz önüne alındığında, kaba bağlam, sıkıştırma ve ajantik geri alım arasında seçim yapar ve gecikme + kalite beklentilerini hesaplar.

## Egzersizler

1. 45 dakikalık bir ders, 1 FPS, her çerçeveye 81 token.

2. İğne-hay yığını testi tasarlayın: Marker'i hangi dakikada enjekte edersiniz ve sorgu şekli tam olarak nedir?

3. 1 saatlik bir videoda Kwen2.5-VL-72B (80k bağlam) ile VideoAgent (Claude 3.5 + kurtarma) karşılaştırın. Hangi geri çağırma üzerinde kazanır? Hangi gecikme üzerinde kazanır?

4. Ring dikkatinin cihaz başına hafıza ölçekleri, dizi uzunluğu cihaz sayısına bölünürken, toplam dikkat hesaplaması kare kalır.

5. Gemini 1.5 Bölüm 5'i okuyun. 1M vs 10M token sınırında hatırlama hakkında ne buldu?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Brute context | "Just more tokens" | Scale LLM context to millions of tokens; process everything in one pass |
| Ring attention | "LWM-style parallel" | Distributed attention pattern where each device holds a chunk and rotates |
| Token compression | "Summary tokens" | Reduce per-clip tokens via a learned compressor before the LLM |
| Needle-in-haystack | "NIH test" | Insert a unique marker at a random point, ask model to recall it at test time |
| Agentic retrieval | "LLM as query planner" | LLM asks a retrieval tool for relevant clips, reads them via a VLM, composes answer |
| VideoAgent | "Retrieval pattern for video" | Canonical agentic-retrieval design: question -> tool -> clip -> answer |

## Daha Fazla Okumak

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
