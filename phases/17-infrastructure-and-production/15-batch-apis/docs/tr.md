# Toplu API'ler — Endüstri Standardı Olarak %50 İndirim

> Her büyük sağlayıcı, %50 indirim ve ~24 saat içinde geri dönüş sağlayan bir eşzamansız toplu API gönderir. OpenAI, Anthropic, Google ve inference platformlarının çoğu (Fireworks toplu katmanı, Together toplu işi) aynı modeli uygular. prompt önbelleğe alma ve gece işlem hatlarına sahip yığın toplu işlemi, eşzamanlı önbelleğe alınmamış maliyetin ~%10'una düşer. Kural son derece basittir: Etkileşimli değilse topluluğa aittir. İçerik oluşturma ardışık düzenleri, belge sınıflandırması, veri çıkarma, rapor oluşturma, toplu etiketleme, katalog etiketleme - 24 saatlik gecikmeye toleranslı olan her şey, toplu işlere taşınana kadar masada kalan paradır. 2026 üretim modeli, her yeni LLM iş yükünü üç şeritte önceliklendirmektir: etkileşimli (önbelleğe alma ile eşzamanlı), yarı etkileşimli (geri dönüşlü eşzamansız kuyruk), toplu (gece boyunca, önbelleğe alınmış giriş yığını). Etkileşimli gibi görünen ancak dakikalarca süren gecikmeyi tolere eden iş yükleri en çok israfa neden olur.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak toplu-senkronizasyon maliyet simülatörü)
**Önkoşullar:** Aşama 17 · 14 (Prompt ve Anlamsal Önbelleğe Alma)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Üç sağlayıcı toplu API'sini (OpenAI, Anthropic, Google) ve ortak %50 indirim + 24 saat geri dönüş garantilerini adlandırın.
- Bir gecelik sınıflandırma iş yükünde yığın + önbelleğe alınmış girişin maliyetini hesaplayın ve eşzamanlı önbelleğe alınmamış temel ile karşılaştırın.
- Bir iş yükünü etkileşimli/yarı etkileşimli/toplu olarak önceliklendirin ve şeridi doğrulayın.
- İki tuzağı adlandırın: kısmi etkileşim (kullanıcı 24 saatten daha hızlı bekler) ve çıktı şeması sapması (toplu dosya formatı sağlayıcıya göre değişir).

## Sorun

Ekibiniz her gece bir rapor oluşturma hattı gönderiyor. 50.000 belge, her biri özetleniyor, özetler kümeleniyor, bir yönetici özeti taslağı. Eşzamanlı olarak çalıştırmak 2.000$/gece ile 4 saat sürer. Toplu API'leri duymuşsunuzdur.

Parti size %50 indirim sağlar. Ayrıca prompt sisteminde prompt önbelleğe almayı da etkinleştirirsiniz (50.000 çağrının tamamında paylaşılır). Üst üste, fatura gecelik 180$'a düşüyor; yani taban değerin ~%9'u. Aynı işlem hattı, üç yapılandırma değişikliği.

Toplu iş, LLM maliyet araç setinde kimsenin kullanamadığı en ucuz kaldıraçtır. Bunun nedeni çoğunlukla organizasyoneldir: SLA aslında "sabah" iken ekipler "gerçek zamanlı" düşünür. Bu ders faturanın %90'ını masada bırakmamakla ilgilidir.

## Konsept

### Üç toplu API

**OpenAI Batch API**: İsteklerin listesini içeren JSONL dosyası yükleme. 24 saatlik geri dönüş sözü verildi (pratikte genellikle ~2-8 saat). Giriş ve çıkış token'larda %50 indirim. `/v1/batches` uç noktası. Önbelleğe uygun girişler ayrıca önbelleğe alınmış giriş fiyatlandırmasına da sahiptir.

**Antropik Mesaj Grupları**: JSONL yüklemesi. 24 saatlik dönüş. %50 indirim. `cache_control` 'yi destekler — önbellek yazma işlemleri açıktır, okumalar toplu iş içinde otomatik olarak gerçekleşir.

**Google Vertex AI Toplu Tahmini**: BigQuery veya GCS girişi. Gemini için de benzer %50 indirim. Vertex boru hatlarıyla entegre olur.

### Anlamsal: eşzamansız, yavaş değil

Toplu mesaj "24 saat içinde döneceğime söz veriyorum" - "bu 24 saat sürecek" değil. Tipik P50 2-6 saattir. Sağlayıcı, toplu işleminizi GPU envanterinin gereğinden az kullanıldığı yoğun olmayan zaman aralıklarında planlar.

### Önbelleğe alma ile yığın

Aynı 4K-token sistemi prompt ile 50k belge özeti:

- Eşzamanlı önbelleğe alınmamış: 50000 × ($input × 4000 + $çıkış × 200) tam hızda.
- Eşzamanlı önbelleğe alındı: sistem prompt ilk yazmadan sonra önbelleğe alındı; kalan 49999 ise 10 kat daha ucuz girdi alıyor.
- Toplu önbelleğe alma: Yukarıdakilerin hepsine ek olarak hem okuma hem de yazmada %50 indirim.

Yığın: toplu iş + önbellek = önbelleğe alınmamış senkronizasyon faturasının ~%10'u. Gece boyunca çalışan ve paylaşılan bir sisteme (prompt) sahip tüm iş yükleri bunu kullanmalıdır.

### İş yükü önceliklendirmesi

**Etkileşimli** — kullanıcı yanıtı bekler. TTFT önemli. prompt önbelleğe alma ile senkronize çağrı. Toplu işlem yapılamıyor.

**Yarı etkileşimli** — Kullanıcı bir görevi gönderir ve birkaç dakika içinde tekrar kontrol eder. Toplu iş mevcut değilse senkronizasyon için geri dönüş içeren eşzamansız kuyruk. Orta hacimli RAG indekslemeyi düşünün.

**Toplu** — Kullanıcı, sonuçların "sabah" veya "sonraki saate kadar" olmasını bekler. İçerik ardışık düzenleri, ölçeğe göre sınıflandırma, çevrimdışı analiz. Her zaman toplu, her zaman yığın önbelleğe alma.

Yaygın hata: Boru hattı üretim olduğundan her şeyi etkileşimli olarak sınıflandırmak. Üretim bir gecikme özelliği değildir; SLA öyledir.

### Kısmi etkileşim tuzağı

Bazı özellikler etkileşimli görünüyor ancak 5-10 dakikayı tolere ediyor. Örnek: "yenile" butonunun yer aldığı gecelik müşteri sağlık raporu. Kullanıcı yenilemeyi tıklar; 10 dakika bekle tamamdır. Ekip bunu senkronize olarak gönderiyor. 50 eşzamanlı yenilemenin maliyeti, toplu ve e-posta yoluyla teslim edilen maliyetin 10 katıdır.

Sorulması gereken soru: "Bu kullanıcı için 24 saat ne anlama geliyor?" Cevap "fark etmezler" ise toplu olarak gruplayın.

### Çıktı şeması tuzağı

Toplu dosya formatları sağlayıcıya göre farklılık gösterir:

- OpenAI: JSONL, satır başına bir istek.
- Antropik: JSONL, satır başına bir mesaj; yanıt formatı gömülü.
- Vertex: BigQuery tablosu veya TFRecord'lu GCS öneki.

Sağlayıcılar arasında "bir toplu istemci" yazmak, sağlayıcı başına bağdaştırıcı kodu anlamına gelir. Çok sağlayıcılı toplu işlerin reklamını yapan ağ geçitleri (Portkey, LiteLLM bazı katmanlar) hala ham formatı ince bir şekilde sarmaktadır.

### Hatırlamanız gereken sayılar

- Sağlayıcılar arasında toplu indirim: Giriş + çıkışta %50 sabit.
- Geri Dönüş SLA'sı: 24 saat garantili, 2-6 saat tipik P50.
- Yığılmış toplu iş + önbelleğe alınmış giriş: Önbelleğe alınmamış senkronizasyon maliyetinin ~%10'u.
- İş yükü önceliklendirme kuralı: 24 saatlik gecikme kabul edilebilirse, her zaman toplu işlem yapın.

## Use It — Hazır Araçla Uygula

`code/main.py` , 50 bin belgelik iş yükü için senkronizasyon, senkronizasyon+önbellek, toplu iş ve toplu+önbellek genelinde maliyetleri hesaplar. Tasarrufları $ ve yüzde olarak bildirir.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-batch-triager.md` üretir. İş yükü özellikleri göz önüne alındığında, etkileşimli/yarı/toplu olarak önceliklendirme yapılır ve tasarruflar tahmin edilir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. 3K-token sistem prompt ve 500-token çıkışına sahip 100 bin belgelik bir ardışık düzen için, senkronizasyon temel çizgisine kıyasla tam yığın (toplu + önbellek) tasarruflarını hesaplayın.
2. Bildiğiniz gerçek bir üründeki üç özelliği seçin. Her birini etkileşimli/yarı/toplu olarak önceliklendirin.
3. Bir kullanıcı raporunun 3 saat sürdüğünden şikayetçi. Bu toplu bir yanlış önceliklendirme miydi yoksa meşru bir etkileşim miydi? Karar kriterini yazın.
4. Toplu API iade SLA'nız 24 saattir ancak P99 20 saattir. Bunu kullanıcıya nasıl iletirsiniz - uç durumda alt sistem davranışı nedir?
5. Başabaş hesaplaması: Hangi paylaşılan önek uzunluğunda toplu + önbellek, kendi ayrılmış GPU'nuzda gece boyunca çalıştırmaktan daha ucuz hale gelir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Toplu API | "eşzamansız indirim" | 24 saat geri dönüş ile %50 indirim |
| JSONL | "toplu format" | Satır başına bir JSON isteği; OpenAI/Antropik standart |
| Mesaj Grupları | "Antropik grup" | Anthropic'in toplu API ürün adı |
| Toplu tahmin | "Köşe grubu" | Vertex AI'nin toplu API ürünü |
| Geri Dönüş SLA'sı | "24 saat söz" | Garanti, tipik değil; tipik 2-6 saattir |
| İş yükü triyajı | "etkileşim kararı" | Etkileşimli / yarı / toplu yönlendirme kararı |
| Çıkış şeması | "yanıt biçimi" | Sağlayıcı başına JSONL düzeni; taşınabilir değil |
| Yığılmış indirim | "toplu + önbellek" | Her ikisi de geçerli olduğunda önbelleğe alınmamış senkronizasyon faturasının ~%10'u |

## Daha Fazla Okuma

- [OpenAI Batch API](https://platform.openai.com/docs/guides/batch) — JSONL formatı ve `/v1/batches` semantiği.
- [Antropik Mesaj Grupları](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) — toplu format ve `cache_control` etkileşimi.
- [Vertex AI Toplu Tahmini](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/batch-prediction-gemini) — Gemini toplu semantiği.
- [Finout — OpenAI ile Antropik API Fiyatlandırması 2026](https://www.finout.io/blog/openai-vs-anthropic-api-pricing-comparison)
- [Zen Van Riel — Yüksek Lisans API Maliyet Karşılaştırması 2026](https://zenvanriel.com/ai-engineer-blog/llm-api-cost-comparison-2026/)
