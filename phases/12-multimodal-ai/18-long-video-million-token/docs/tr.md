# Milyon-Token Bağlamında Uzun Video Anlaması

> Yamalı ve gömülü, 24 FPS'de 1 saatlik 4K video yaklaşık 60 milyon token üretir. Kopyalanan 2 saatlik bir podcast bölümü 30.000 token'dir. Tam bir Blu-ray uzun metrajlı film, agresif havuzlamayla sıkıştırılmış olsa bile yüzbinlerce token'den oluşur. Google'ın Gemini 1.5'i (Mart 2024), bu dönemi 10 milyonluk token bağlamıyla açtı ve saatler süren videolarla samanlıkta iğne gibi güvenilir bir geri çağırma işlemi gerçekleştirdi. LWM (Liu ve diğerleri, Şubat 2024), halka dikkatin ölçeklendirme yolunu gösterdi. LongVILA ve Video-XL, beslemeyi daha da ölçeklendirdi. VideoAgent, agentic alımı için ham bağlamı değiştirdi. Her yaklaşım, bilgi işlem, geri çağırma ve mühendislik karmaşıklığı konusunda farklı bir ödünleşimdir. Bu ders onları yan yana okuyor.

**Tür:** Yapım
**Diller:** Python (stdlib, samanlıkta iğne simülatörü + agentic alma yönlendiricisi)
**Önkoşullar:** Aşama 12 · 17 (zamansal video token'ler)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Değişken FPS ve havuzlamada uzun biçimli video için toplam görsel-token sayımlarını hesaplayın.
- Üç ölçeklendirme yolunu açıklayın: kaba bağlam (Gemini 1.5), dikkat çekme (LWM), token sıkıştırma (LongVILA / Video-XL).
- Ham bağlam video VLM'leri ile agentic erişim video VLM'lerini (VideoAgent) doğruluk ve gecikme açısından karşılaştırın.
- 30 dakikalık bir video için samanlıkta iğne testi tasarlayın ve belirli bir dakikada hatırlamayı ölçün.

## Sorun

384 yerel çözünürlükte Qwen2.5-VL boyutlu yamalardan oluşan tek bir kare ~729 token'dir. 3x3 havuzlamada bu, kare başına 81 token demektir. 1 FPS'de 30 dakikalık bir klip = 1800 kare = 145.800 token. 2025'e kadar açık VLM'lerle yapılabilir, sıkı. 2 FPS'de 291.600 token — yalnızca en büyük bağlamlar uygundur.

1 FPS'de 2 saatlik bir film 583 bin token'dir. Çoğu 2026 açık modelin ötesinde; Gemini 2.5 Pro veya daha agresif havuzlama gerektirir.

Üç ölçeklendirme yolu ortaya çıktı.

## Konsept

### Yol 1: Kaba bağlam (Gemini 1.5, Claude Opus)

Donanımı soruna atın. Bağlamı milyonlarca token'ye ölçeklendirin, her şeyi tek bir ileri geçişte işleyin.

Gemini 1.5 Pro, 1 milyon token ile piyasaya sürüldü; Gemini 1.5 Ultra'dan 10M'ye; 2026'daki Gemini 2.5 Pro, güvenilir bir şekilde saatlerce video çekiyor. Makale (arXiv:2403.05530), samanlıkta iğne bulma oranının %99,7 ile ~9,5 milyon token arasında olduğunu belgeliyor.

Mühendislik: Bellek hiyerarşisine (yerel + genel + seyrek) ve uzun bağlam verimliliği için MoE uzman yönlendirmesine sahip özel bir dikkat uygulaması. Tüm ayrıntılarıyla yayınlanmadı. Açık kaynak değil.

### Yol 2: Dikkatinizi çekin (LWM, LongVILA)

Halka dikkati, uzun dizileri, her aygıtın bir parçayı tuttuğu bir "halka" içinde aygıtlar arasında dağıtır. Tüm dizi boyunca dikkat, her cihazın kendi parçasını bir sonrakine bir halka düzeninde göndermesi, kısmi dikkati hesaplaması ve toplamasıyla gerçekleşir.

LWM (Liu ve diğerleri, 2024) 1M-token bağlam modelini bu şekilde eğitmiştir. Eğitim hesaplaması ikinci dereceden değil bağlamla doğrusal olarak ölçeklenir; dikkat üzerindeki ikinci dereceden vuruş halkanın cihazları genelinde amortismana tabi tutulur.

LongVILA (arXiv:2408.10188) modeli VLM'lere uyarladı. Kare başına 192 token'de 1400 kare videolar = 268k bağlam, 8 yönlü paralellik boyunca halka dikkatiyle eğitilmiş.

### Yol 3: Token sıkıştırma (Video-XL, LongVA)

Kaba bağlamdan daha ucuz: LLM diziyi görmeden önce agresif bir şekilde sıkıştırın.

Video-XL (arXiv:2409.14485), token görsel özetini kullanır: N çerçeveden oluşan her klip, N üzerinden katılan tek bir "özet" token üretir. inference'de LLM, klip başına bir token özetini görür ve bağlamı büyük ölçüde daraltır.

LongVA, "uzun içerik aktarımı" tekniğiyle LLM içeriğini 200k'den 2M'ye genişletiyor. Uzun bağlamlı metin üzerinde eğitim alın, paylaşılan gösterim aracılığıyla uzun bağlamlı videoya aktarın.

Token sıkıştırma, ölçeklenebilirlik için belirli zaman damgalarında geri çağırmayı ortadan kaldırır. Model genel olarak ne olduğunu biliyor ancak bazen tam kareleri kaçırıyor.

### Yol 4: Agentic alımı (VideoAgent)

Videonun tamamını Yüksek Lisans'a beslemeyin. Bunun yerine videoyu bir veritabanı olarak değerlendirin ve onu sorgulamak için bir Yüksek Lisans kullanın.

VideoAgent (arXiv:2403.10517):

1. LLM soruyu okur.
2. Yüksek Lisans, ilgili klipler için bir erişim aracı ister ("bana kedili bölümleri göster").
3. Araç, eşleşen klip zaman damgalarını döndürür.
4. LLM bu klipleri bir VLM aracılığıyla okur.
5. LLM yanıtı oluşturur veya takip sorguları sorar.

Bu, uzun videoya uygulanan agent olarak LLM modelidir. Daha ucuz inference (yalnızca ilgili klipler kodlanır), daha zorlu mühendislik (geri alma kalitesi darboğaz haline gelir).

### Samanlıktaki iğne benchmarks

Standart uzun bağlam testi: videonun rastgele bir noktasına benzersiz bir görsel veya metinsel işaretleyici ekleyin ve ardından onu geri çağırmayı gerektiren bir sorgu sorun.

Metrik: Video uzunluğu ve işaretçi konumu boyunca @k'yi geri çağır.

Gemini 2.5 Pro, 90 dakikaya kadar videolarda %99'dan fazla hatırlama puanı elde ediyor. Açık 72B modelleri (Qwen2.5-VL-72B, InternVL3-78B) 30 dakikada ~%85-90 puan alır ve 60'ı geçer.

VideoAgent, ham bağlam modellerini 2 saatten fazla sürede eşleştirebilir veya yenebilir çünkü araç iyiyse geri alma iğneyi vurur.

### Hangi yolu seçmeli

Sınır doğruluğunda 15 dakikalık bir klip için: açık 72B + yerel bağlam genellikle işe yarar. Qwen2.5-VL-72B'yi seçin.

30 dakikadan 1 saate kadar içerik için: Açık içerik için LongVILA veya Video-XL; Gemini 2.5 Pro kapalı. Kalite çıtası önemlidir; sınırlar kapanır.

2 saatten fazla içerik için: VideoAgent veya benzer alma modelleri. Alternatif olarak, daha küçük parçalara özetleyin ve hiyerarşik özetleri besleyin.

### 2026 üretim modeli

Uygulamada uzun video üretim hatları hibrittir:

1. Videonun tamamında dinamik-FPS örnekleme + agresif havuzlamayı çalıştırın (100k-token küresel temsil elde edin).
2. Genel bir özet için 72B VLM'ye geçin.
3. Kullanıcı ayrıntılı sorular sorarsa özeti dizin olarak kullanarak agentic alımını çalıştırın.

Bu, küresel anlayış için kaba bağlamı ve yerel ayrıntıya erişim için birleştirir.

## Kullan onu

`code/main.py`:

- Değişen FPS + havuzlama koşullarında 1 dakikadan 3 saate kadar olan videolar için token bütçelerini hesaplar.
- Samanlıktaki iğne koşusunu simüle eder: rastgele bir zaman damgasına bir işaretleyici enjekte edin, bir soru sorun, puan toplayın.
- Aşağı akışlı bir VLM'ye beslenmek üzere belirli klipleri seçen bir agentic alma yönlendirici simülatörü içerir.

Bütçe tablosunu çalıştırın ve ölçek boşluğunu hissedin.

## Gönderin

Bu ders `outputs/skill-long-video-strategy-planner.md`'yi üretir. Video süresi ve sorgu karmaşıklığı göz önüne alındığında, kaba bağlam, sıkıştırma ve agentic alımı arasında seçim yapar ve gecikme + kalite beklentilerini hesaplar.

## Egzersizler

1. 1 FPS'de, kare başına 81 token'de 45 dakikalık bir ders. Toplam token? Hangi modellerin bağlamlarına uyuyor?

2. Samanlıkta iğne testi tasarlayın: işaretçiyi hangi dakikada enjekte ediyorsunuz ve sorgu formatı tam olarak nedir?

3. 1 saatlik bir videoda kaba bağlam Qwen2.5-VL-72B'yi (80k bağlam) VideoAgent (Claude 3.5 + alma) ile karşılaştırın. Geri çağırmada hangisi kazanır? Gecikmede hangisi kazanır?

4. Ring Attention'ın hafıza maliyeti, sıra uzunluğuna göre doğrusal olarak ve cihaz sayısına göre doğrusal olarak ölçeklenir. Halka döndürme aşamasını bırakırsanız nedenini ve neyin başarısız olduğunu açıklayın.

5. Samanlıktaki iğne ile ilgili Gemini 1.5 Bölüm 5'i okuyun. Makale 1M ve 10M token sınırında geri çağırma konusunda ne buldu?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Kaba bağlam | "Sadece daha fazla token" | LLM içeriğini milyonlarca token'ye ölçeklendirin; her şeyi tek geçişte işleyin |
| Dikkat | "LWM tarzı paralel" | Her cihazın bir parçayı tuttuğu ve döndüğü dağıtılmış dikkat modeli |
| Token sıkıştırma | "token'lerin Özeti" | LLM'den önce öğrenilmiş bir kompresör aracılığıyla klip başına token'leri azaltın |
| Samanlıkta iğne | "NIH testi" | Rastgele bir noktaya benzersiz bir işaretleyici ekleyin ve modelden bunu test zamanında geri çağırmasını isteyin |
| Agentic alma | "Sorgu planlayıcı olarak Yüksek Lisans" | LLM, ilgili klipler için bir erişim aracı ister, bunları bir VLM aracılığıyla okur, yanıt oluşturur |
| VideoAgent | "Video için alma modeli" | Canonical agentic-geri alma tasarımı: soru -> araç -> klip -> cevap |

## Daha Fazla Okuma

- [Gemini Takımı — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu ve ark. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue ve ark. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu ve ark. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang ve ark. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
