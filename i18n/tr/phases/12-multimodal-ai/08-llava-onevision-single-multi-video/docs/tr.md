# LLaVA-OneVision: Tek Resim, Çok Resim, Tek Modeldeki Video

> LLaVA-OneVision'dan önce (Li et al., Ağustos 2024) açık VLM dünyası ayrı soylara sahipti: Tek görüntüler için LLaVA-1.5, Mantis ve VILA gibi çok görüntü modeli, Video-LLaVA ve Video-LLaMA gibi video modeller. Her biri kendi referansını kazandı ve diğerlerinde başarısız oldu. LLaVA-OneVision, tek bir ders programının üç senaryoda da egemenlik gösterebilecek bir model yetiştirebileceğini ve ortaya çıkan görev transfer etkilerinin (tek görüntü becerileri videoya ihraç edilir, çok görüntü mantıklamaları tek görüntüye ihraç edilir) uzmanların toplamını yendiğini savundu. Reçet yanıltıcı bir şekilde basit: senaryolar arasında dengelenen görsel bir belirti bütçesi, ek olarak tek görüntüden OneVision (çok görüntü) videoya giden açık bir ders programı. Bu ders bütçeyi, ders programını ve ortaya çıkan davranışları okur.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token budget solver + curriculum planner)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 06 (any-resolution)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Tek görüntü, çok görüntü ve video girişleri arasında dengelenen görsel bir jeton bütçesini tasarlayın.
- Tek görüntüden videoya yetenekleri felaketli bir unutma olmadan aktaran bir eğitim programı sipariş edin.
- Ders programı doğru yapıldığında tek bir model neden aynı parametreler sayımında uzmanlardan üstün olduğunu açıklayın.
- LLaVA-OneVision tarafından bildirilen üç yeni yetenek adı: çoklu kamera akıl yürütme, işaretleme uyarısı, iPhone ekran görüntüsü ajanı.

## Sorun

Resim, çoklu görüntü ve video her biri farklı bir model üzerinde durur.

Tek görüntü, OCR ve ince ayrıntıları yakalamak için yüksek çözünürlüklü jetonlar (AnyRes, ~ 2880 görsel jetonlar) ister.

Multi-image, orta çözünürlükte birkaç görüntü istiyor (her biri yaklaşık 576 token) bu nedenle görüntüler arasındaki mantık bağlamına uymaktadır.

Video, zamansal dinamikleri yakalamak için düşük çözünürlükte (bir çerçeveye bir araya getirildikten sonra yaklaşık 196 token) birçok çerçeve ister.

Ayrı modeller eğitirseniz, tek bir bütçe seçersiniz.

Pre-OneVision, varsayılan cevap "bir senaryoyu eğit, diğerlerini görmezden gelin". Video-LLaVA, videoyu ek eğitim aşamalarıyla birlikte bir görüntü modeline yeniden ayarladı. LLaVA-NeXT, kapaklama ile çoklu görüntü desteği ekledi.

## Anlaşım

### OneVision token bütçesi

LLaVA-OneVision, tam bir token sayısını belirlemez. Örnek başına maksimum görsel-token sayısını dengeleyir, böylece üç senaryo aynı aralığında, yaklaşık 6.000 ila 9.000 token'e, senaryo başına farklı olarak tahsis edilir:

- Tek görüntü: AnyRes-Max-9 (bundan 9 bez + bir baz görünüm), her 384x384 görünüm SigLIP SO400M'den 729 token verir. Maksimum: 729 * (1 + 9) = 7290 token.
- Çoklu görüntü: her görüntü 384'te, kapak olmadan, 729 token birleştirilmeden. 12 görüntüye kadar → 8748 token.
- Video: 32 kadra kadar 384'e 2x2 bilineer birleştirme → 196 token per frame.

Bu nedenle, hiçbir senaryo bağlamı veya gradiyenti üzerinde egemenlik göstermez.`code/main.py`Aşağıdaki planlayıcı aynı denge mantığını göstermek için daha küçük bir oyuncak bütçesi 4096 kullanıyor.

### Üç aşamalı ders programı

LLaVA-OneVision trenleri üç aşamada:

1. Tek görüntü SFT (Stage SI). Tüm veriler tek görüntü artı metindir. Yüksek çözünürlüklü AnyRes giriş üzerinde eğitim. Bu algıyı, OCR'yi ve ince ince ince anlayışı öğretir. LLaVA-NeXT verilerini artı OneVision spesifik tek görüntü verilerini kullanır.
2. OneVision SFT (staj OV). Tek görüntü + çok görüntü + video (birbir şekilde örneklenmiş çerçeveler) karıştır. Tek bir token bütçesine göre çalıştırın. Bu, modelin heterogen parti şekilleri ile başa çıkmasını öğretir.
3. Görev transfer ( TT aşaması). Genellikle ürünlere bağlı olarak çoklu görüntü veya video üzerinde daha ağır olan hedef görev karışımı ile devam edin.

Kritik: kurikulum düzeninin önemi. Video-birincisi veya çoklu görüntü-birincisi eğitim aynı verilerle bile tek görüntü-birincisi daha kötü görüntü performans üretir. Kağıt bunu açıkça ortadan kaldırır.

### Neden kurikulum işe yarıyor

Tek görüntü eğitimi algılama tabanını oluşturur. Patch tokenleri ince ince ince görsel özelliklere sahiptir; LLM onları metinle entegre etmeyi öğrenir. Çoklu görüntü ve video güçlü algılama tabanı olmadan öğrenmek zor olan yapısal zorluklar (ne görüntü, hangisi ilk oldu) sunar.

Eğer tüm senaryoları sıfırdan birlikte eğitirseniz, model algılama (her parti için sınırlı tek görüntü verileri) ve aşırı yapı (çok fazla görüntü / video verileri) ile uyumludur. Sonuç: çapraz görüntü mantık kalıplarını izleyen ancak görsel olarak yüzeysel bir model.

Eğitim düzenlemesi, SI aşamasından algı gücünü, OV aşamasından dahi/zamansal akıl yürütmeyi verir, hiçbirini kaybetmeden.

### Yeni gelişen senaryolar arası beceriler

LLaVA-OneVision makalesinde üç yeni yetenek rapor edildi:

1. Çoklu kamera akıl yürütme. Çoklu görüntü + video üzerinde ayrı olarak eğitilmiştir; sonuç olarak, çoklu kamera sürüş sahnesi hakkında akıl yürütmek istenmiştir.
2. Kullanıcı numaralı işaretlerle bir görüntüdeki nesneleri not eder; model nedenleri "Mark 3'ün 7. işaretle ilgili olarak ne yaptığını" anlatır.
3. iPhone ekran görüntüsü ajanı. Kullanıcı bir iPhone ekranının ekran görüntüsünü sağlar ve bir sonraki tıklamayı planlamayı ister. UI ekran görüntüleri, kullanıcı iş akışlarının videoları ve çiftlerden önce / sonra çoklu görüntü üzerinde eğitim almıştır.

Bunlar eğitimli görevler değil; onlar kurikulumun yapısı yapısından kaynaklanmaktadır.

### Görsel belirtiler birleştirme

Token bütçesi birleştirmeyi gerektirir. OneVision 2D yama şebekesinde çift çizgili interpolasyon kullanır: 24x24 = 576 yama 12x12 = 144 (2x faktörü) veya 8x8 = 64 (3x faktörü) olur. Birleştirme yerleşimi korumak için token boşluğu değil, yama şebekesi alanında yapılır.

Szenaryo başına birleştirme faktörünün seçimi kendiliğinden bir hiperparametre. Daha az birleştirme = daha fazla token = daha zengin bir temsil. Daha fazla birleştirme = daha az token = daha fazla çerçeve / görüntü uyumlu.

### LLaVA-OneVision-1.5

2025 takip (LLaVA-OneVision-1.5, arXiv 2509.23661) eğitim verileri, model ağırlıkları ve kodlarında "tamamen açık"dır. Bazı referans değerlerinde sahiplik boşluğu karşılaştırır ve tarifi demokratikleştirir. Aynı ders planı, daha fazla veri, daha iyi bir LLM tabanı. mimarlık değişimi yoktur.

### Qwen2.5-VL ile karşılaştırma

Qwen2.5-VL (Desin 12.09) farklı seçimler yapar. sabit birleştirme yerine M-RoPE ve dinamik FPS kullanır. Giriş ile bütçe ölçekleri  1 dakikalık bir video 5 saniyelik bir video ile karşılaştırıldığında daha fazla jeton kullanır. LLaVA-OneVision bütçeyi düzeltir ve birleştirmeyi ölçeklendirir. Her ikisi de çalışır; tahmin edilebilirlik için yapılandırmayı değiştirirler.

```figure
l5-onevision-budget
```

## Kullan

`code/main.py`Bir OneVision tarzı VLM için bir ders planı ve bütçe planlayıcısıdır. Örnek başına bir token bütçesi ve hedef senaryo karışımı (örneğin 40% tek görüntü, 30% çok görüntü, 30% video) verildiğinde:

- Szenaryo başına çözünürlük, birleştirme faktörü ve çerçeveleri ayırır.
- Her senaryoyu paylaşılan bütçeye uygunluğunu kontrol eder.
- Beklenen token sayısını, LLM FLOP'larını ve hangi senaryoların düşük tokenli olduğunu raporlar.
- Adım adım eğitim programını basıyor.

OneVision'ın ince ayarlarını planlamak veya bir VLM dağıtımının talep başına maliyetini sağduyu kontrol etmek için kullanın.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-onevision-budget-planner.md`. Hedef görev dağılımı ve örnek başına bütçe göz önüne alındığında, AnyRes faktörü, çerçeve birleştirme, video çerçeve sayısı ve kurikulum aşama ağırlıklarını yayar.

## Egzersizler

1. Ürününüz %80 tek görüntü, %10 çok görüntü (2-4 görüntü), %10 video (8-16 çerçeve) destekler.

2. LLaVA-OneVision Bölümü 4.3 (Yarınma yetenekleri) okuyun.

3. Eğitim programını değiştirin  önce çok resim, sonra tek resim, sonra video tren. Hangi referansların düşeceğini ve nedenini tahmin edin.

4. Gazete, örnek başına sadece 8 çerçeve üzerinde eğitilen video referanslarını rapor ediyor. Bu, sonuçta 30 saniyelik videolara genel mi?

5. 24x24 patchlerin 12x12'e binayol birleştirilmesi, boyut başına 2x azaltma anlamına gelir, bu nedenle 4x daha az jeton. stdlib Python'da birleştirmeyi uygulayın ve her 2x2 blok üzerindeki ortalamanın binayol çıkışına eşleştiğini kontrol edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OneVision scenario | "Single-image, multi-image, or video" | One of three input shapes the unified VLM handles; the budget stays balanced across |
| Token budget | "How many tokens per sample" | Total visual tokens the LLM sees per training / inference sample, about 6k to 9k at most in LLaVA-OneVision |
| Curriculum | "Training order" | Stage ordering (single-image → multi-image → video) chosen for emergent transfer |
| Bilinear pooling | "Token shrink" | Applying bilinear interpolation to the patch grid (2D) to reduce token count while preserving locality |
| Emergent skill | "Not trained, still works" | Capability that appears at inference without matching training data, due to curriculum composition |
| AnyRes-k | "k-tile setup" | k sub-tiles of fixed resolution plus one thumbnail, typical $k \in \lbrace 4, 9 \rbrace$ |
| Task transfer | "Cross-scenario generalization" | Skills learned on single-image that apply to video (and vice versa) via shared backbone |

## Daha Fazla Okumak

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
