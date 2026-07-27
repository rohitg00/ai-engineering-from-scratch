# Açık Ağırlıklı VLM Tarifleri: Aslında Önemli Olan Nedir?

> 2024-2026 açık ağırlıklı VLM literatürü, ablasyon tablolarından oluşan bir ormandır. Apple'ın MM1'i 13 görüntü kodlayıcı, bağlayıcı ve veri karışımı kombinasyonunu test etti. Allen AI'den Molmo, ayrıntılı insan altyazılarının GPT-4V damıtma işlemini geçtiğini kanıtladı. Kambriyen-1 20'den fazla kodlayıcı karşılaştırması gerçekleştirdi. Idefics2 beş eksenli tasarım alanını resmileştirdi. Prizmatik VLM'ler kontrollü bir benchmark üzerinde 27 eğitim tarifini karşılaştırdı. Tüm bu gürültünün dışında, kağıtlar arasında küçük bir sonuç kümesi geçerli: görüntü kodlayıcı bağlayıcı mimarisinden daha önemli, veri karışımı her ikisinden de daha önemli ve ayrıntılı insan altyazıları damıtılmış sentetik verileri geride bırakıyor. Bu derste bu tabloları okumak zorunda kalmazsınız.

**Tür:** Öğrenim + laboratuvar
**Diller:** Python (stdlib, ablasyon tablosu ayrıştırıcı + tarif seçici)
**Önkoşullar:** Aşama 12 · 05 (LLaVA başlangıç düzeyi)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Beş eksenli VLM tasarım alanını adlandırın: görüntü kodlayıcı, konektör, LLM, veri karışımı, çözünürlük çizelgesi.
- Bir MM1 / Idefics2 / Kambriyen-1 ablasyon tablosunu okuyun ve belirli bir benchmark'yi hangi düğmenin hareket ettirdiğini tahmin edin.
- Bilgi işlem bütçesi ve görev karışımı dikkate alınarak yeni bir VLM için bir tarif (kodlayıcı, bağlayıcı, veri, çözünürlük) seçin.
- Ayrıntılı insan altyazılarının neden aynı token sayısında GPT-4V damıtmadan daha üstün olduğunu açıklayın.

## Sorun

Yüzlerce açık ağırlıklı VLM mevcuttur. "İyi" ile "son teknoloji" arasındaki farkın çoğu mimari değil. Veri, çözünürlük programı ve kodlayıcı seçimidir. Modeliniz düşük performans gösterdiğinde ilk olarak hangi düğmeyi çevireceğinizi bilmek sizi 5 milyon GPU saatlik hatadan kurtarır.

2023 dalgası (LLaVA-1.5, InstructBLIP, MiniGPT-4) altyazı çifti ön eğitimi + LLaVA-Instruct-150k üzerinde çalıştı. İyi bir temel. MMMU'nun %35'i civarında zirveye ulaştı.

2024 dalgası (MM1, Idefics2, Molmo, Kambriyen-1, Prizmatik VLM'ler) kapsamlı ablasyonlar gerçekleştirdi. Sonuçlar şaşırtıcı ve pratikti.

## Konsept

### Beş eksenli tasarım alanı

Idefics2 (Laurençon ve diğerleri, 2024) eksenleri şöyle adlandırdı:

1. Görüntü kodlayıcı. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Kodlayıcılar yama boyutu, çözünürlük ve ön eğitim hedefi açısından farklılık gösterir.
2. Konektör. MLP (2-4 katman), Q-Former (32 sorgu + çapraz attn), Perceiver Resampler (64 sorgu), C-Abstractor (evrişimli + çift doğrusal havuzlama).
3. Dil modeli. Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5. LLM boyutu baskın param maliyetidir.
4. Eğitim verileri. Altyazı çiftleri (CC3M, LAION), aralıklı (OBELICS, MMC4), talimat (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Çözüm planı. Sabit 224/336/448, AnyRes, yerel dinamik. Antrenman sırasında veya sürekli olarak rampalanır.

Her üretim VLM'si her eksende bir seçim yapar. MMMU puanlarındaki varyansın çoğu, hangi konektörü seçtiğinize göre değil, 1, 4 ve 5 numaralı eksenlerle açıklanır.

### Eksen 1: kodlayıcı > konnektör

MM1 Bölüm 3.2 şunu gösterdi: CLIP ViT-L/14'ten SigLIP SO400m/14'e geçiş MMMU'ya 3+ puan ekledi. Konektörün MLP'den Perceiver Resampler'a değiştirilmesi 1 puandan az eklendi. Idefics2 kopyalandı: SigLIP > CLIP, Q-Former ≈ MLP ≈ Aynı token sayımında Algılayıcı.

Kambriyen-1'in "Kambriyen Görüş Kodlayıcıları Eşleştirmesi" (Tong ve diğerleri, 2024), görüş merkezli bir benchmark (CV-Bench) üzerinde 20'den fazla kodlayıcıyı çalıştırdı. Skor tablosunun üst kısmı DINOv2 ve SigLIP'in bir karışımıdır; CLIP grubun ortasında yer alıyor; ImageBind ve ViT-MAE daha düşüktür. CLIP ViT-L ile DINOv2 ViT-g/14 arasındaki fark CV-Bench'te ~5-7 puandır.

Açık VLM'ler için 2026 varsayılan kodlayıcı, anlamsal + yoğun özellikler için SigLIP 2 SO400m/14'tür ve bazen DINOv2 ViT-g/14 özellikleriyle birleştirilir (Kambriyen'in "Uzaysal Görüş Toplayıcısı" bunu yapar).

### Eksen 2: konektör tasarımı yıkamadır

MM1, Idefics2, Prismatic ve MM-Interleaved'in hepsi aynı sonuca ulaştı: sabit bir görsel-token sayısında konektör mimarisinin pek önemi yok. Ortalama havuzlu yamalardaki 2 katmanlı bir MLP, aynı token bütçesinde 32 sorgulu Q-Former'ın 1 noktası dahilinde performans gösterir.

Önemli olan token sayısıdır. Daha fazla görsel token = daha fazla LLM hesaplama = bir noktaya kadar daha iyi performans, ardından getiriler azalıyor. Görüntü başına 64 token OCR için çok az. 576-1024 token'ler çoğu açık VLM için en uygun noktadır. 2048+ yalnızca belgeler ve grafikler için yardımcı olur.

Q-Former ve MLP bir kalite sorusu değil, bir maliyet sorusudur: Q-Former, görüntü çözünürlüğüne bakılmaksızın token'leri 32-64'te sınırlar; MLP, tüm yama token'leri yayar. Yüksek çözünürlüklü girişler için Q-Former, LLM içeriğini kaydeder; düşük çözünürlükler için fark gürültüdür.

### Eksen 3: LLM boyutu tavanı belirliyor

LLM'yi 7B'den 13B'ye iki katına çıkarmak, her VLM belgesinde MMMU'ya güvenilir bir şekilde 2-4 puan ekler. 70B'de benchmark'lerin çoğunu doyurursunuz. VLM'nin çok modlu akıl yürütme tavanı, LLM'nin metin akıl yürütme tavanıdır; görsel kodlayıcı, bunun nedenini değil, yalnızca onu besleyebilir.

Qwen2.5-VL-72B ve Claude Opus 4.7'nin MMMU-Pro ve ScreenSpot-Pro'yu ezmesinin nedeni budur: dil beyni çok büyüktür. Akıllı konnektör tasarımı sayesinde 7B VLM, 70B VLM'nin yerini alamaz.

### Eksen 4: veriler — ayrıntılı insan altyazıları damıtma işlemini geride bırakıyor

Molmo + PixMo (Deitke ve diğerleri, 2024), herkesin okuması gereken 2024 sonucudur. Allen AI, insan açıklamacıların görüntüleri 1-3 dakikalık yoğun konuşmadan metne geçişlerle tanımlamasını sağladı ve bu da 712K yoğun altyazılı görüntüler sağladı. Eğitim verilerinin hiçbir yerinde GPT-4V damıtması yok.

Molmo-72B, 11 benchmark'nin 11'inde Llama-3.2-90B-Vision'ı yendi. Delta mimari değil, altyazı kalitesidir. Ayrıntılı insan altyazıları, kısa web altyazılarına göre görüntü başına 5-10 kat daha fazla bilgi içerir ve GPT-4V damıtma halüsinasyonlarının olduğu gerçeklere dayalıdır.

ShareGPT4V (Chen ve diğerleri, 2023) ve Cauldron (Idefics2), karışık insan + GPT-4V altyazılarıyla aynı oyun kitabını izledi. Trend açık: 2026 sınırı için, altyazı yoğunluğu > altyazı miktarı > damıtma kolaylığı.

### Eksen 5: çözünürlük ve programı

Idefics2'nin ablasyonları: 384 -> 448, 1-2 puan ekler. Görüntü bölmeli (AnyRes) 448 -> 980, OCR benchmark'lere 3-5 tane daha ekler. Orta doğrulukta düz çözünürlüklü eğitim platoları; çözünürlük artışı (başlangıç ​​224, bitiş 448 veya yerel) daha hızlı eğitir ve daha yüksekte biter.

Kambriyen-1, token ile karşılaştırıldığında bir çözünürlük çalıştırdı: sabit hesaplamada, daha düşük çözünürlükte daha fazla token'ye veya daha yüksek çözünürlükte daha az token'ye sahip olabilirsiniz. OCR için daha yüksek çözünürlük kazanır; daha düşük çözünürlüklü-daha fazla-token'ler genel sahne anlayışı açısından kazanır.

2026 üretim tarifi: Aşama 1'i sabit 384'te, Aşama 2'yi OCR ağırlıklı görevler için 1280'e kadar dinamik çözünürlükle eğitin.

### Prizmatik kontrollü karşılaştırma

Prizmatik VLM'ler (Karamcheti ve diğerleri, 2024) tüm eksenleri kontrol eden kağıttır. Aynı 13B LLM, aynı talimat verileri, aynı değerlendirme; aynı anda yalnızca bir eksen değişir. Sonuçlar:

- Görüntü başına görsel-token sayısı varyansın ~%60'ını açıklar.
- Kodlayıcı seçimi ~%20'yi açıklar.
- Bağlayıcı mimarisi ~%5'i açıklar.
- Diğer her şey (veri karışımı, zamanlayıcı, LR) kalan ~%15.

Bu kaba bir ayrıştırmadır ancak literatürdeki "önce neyi ablasyona sokmalıyım" sorusunun en net yanıtıdır.

### 2026 için bir seçici

Kanıtlar göz önüne alındığında, 2026'daki yeni bir proje için varsayılan açık VLM tarifi:

- Kodlayıcı: Segmentasyon/topraklamaya ihtiyacınız varsa yoğun özellikler için DINOv2 ViT-g/14 ile birleştirilmiş, NaFlex ile doğal çözünürlükte SigLIP 2 SO400m/14.
- Konektör: token yamasındaki 2 katmanlı MLP. token ile sınırlı olmadığınız sürece Q-Former'ı atlayın.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, maliyet için 7B, kalite için 70B, hedef gecikmeye göre seçilir.
- Veri: PixMo + ShareGPT4V + Cauldron, göreve özel talimat verileriyle tamamlandı.
- Çözünürlük: dinamik (uzun kenar başına minimum 256, maksimum 1280 piksel).
- Program: Aşama 1 hizalama (yalnızca projektör), Aşama 2 tam ince ayar, Aşama 3 göreve özel ince ayar.

Bu kusurların her biri, bu dersin sonunda alıntılanan makalelerdeki ölçülü bir ablasyona dayanmaktadır.

## Kullan onu

`code/main.py` bir ablasyon tablosu ayrıştırıcısı ve tarif seçicidir. MM1 ve Idefics2 ablasyon tablolarını (yoğunlaştırılmış) kodlar ve aşağıdakileri sorgulamanıza olanak tanır:

- "X bütçesi ve Y görevi verildiğinde, hangi tarif kazanır?"
- "7B Lama'da SigLIP'i CLIP ile değiştirirsem beklenen MMMU deltası nedir?"
- "%80 güvene sahip bir cevap için önce hangi ekseni ablasyona sokmalıyım?"

Çıktı, beklenen benchmark deltalarını ve "önce ablate" önerisini içeren sıralanmış bir tarif listesidir.

## Gönderin

Bu ders `outputs/skill-vlm-recipe-picker.md`'yi üretir. Bir hedef görev karışımı, bir işlem bütçesi ve bir gecikme hedefi göz önüne alındığında, her seçimi gerekçelendiren ablasyona ilişkin alıntılarla birlikte tam bir tarif (kodlayıcı, bağlayıcı, LLM, veri karışımı, çözümleme planı) yayınlar. Her yeni VLM projesi başladığında mühendislerin Idefics2 ablasyon tablosunu yeniden keşfetmesini engeller.

## Egzersizler

1. MM1 Bölüm 3.2'yi okuyun. Bütçesi 50 milyon görüntü olan sabit bir 2B LLM için hangi kodlayıcı kazanır? Cevap 13B LLM'de değişir mi? Neden?

2. Kambriyen-1, DINOv2 + SigLIP'in birleştirilmesinin, görüş merkezli benchmark'lerde tek başına daha iyi performans gösterdiğini ancak MMMU'ya sinyal eklemediğini buldu. Hangi benchmark'lerin kazanacağını ve hangilerinin sabit kalacağını tahmin edin.

3. Hedefiniz 2B LLM'de mobil bir agent kullanıcı arayüzüdür. Kodlayıcıyı, konektörü, çözünürlüğü ve veri karışımını seçin. Her seçimi belirli bir ablasyon tablosuyla gerekçelendirin.

4. Molmo 4B ve 72B modellerini gönderiyor. 4B, kapalı 7B VLM'lerle rekabet edebilir; 72B, 11/11 benchmark'lerde Llama-3.2-90B-Vision'ı yener. Bu size LLM boyutunda plato hipotezi hakkında ne söylüyor?

5. 7B VLM'de veri karışımı kalitesini kodlayıcı kalitesinden ayırmak için bir ablasyon tablosu tasarlayın. Minimum kaç eğitim çalıştırılır? Dört eksen ayarlarını önerin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Ablasyon | "Bir düğmeyi çevirmek" | Geriye kalan her şeyi sabit tutarak tam olarak tek bir tasarım alanı ekseninde farklılık gösteren birden fazla çalıştırmayı eğitme |
| Bağlayıcı | "Köprü" / "projektör" | Görüntü kodlayıcı çıktısını LLM'nin token alanına (MLP, Q-Former, Perceiver) eşleyen eğitilebilir modül |
| Ayrıntılı insan yazısı | "Yoğun başlık" | Web alternatif metninden daha zengin, insanlar tarafından yazılmış, çok cümleli bir açıklama (genellikle 80-300 token) |
| Damıtma | "GPT-4V altyazıları" | Daha güçlü, tescilli bir VLM tarafından oluşturulan eğitim verileri; rahat ama kalıtsal halüsinasyona eğilimli |
| AnyRes / dinamik çözünürlük | "Yüksek çözünürlüklü yol" | Kodlayıcının doğal çözünürlüğünden daha büyük görüntüleri döşeme veya M-RoPE yoluyla besleme stratejisi |
| Çözünürlük rampası | "Müfredat" | Düşük çözünürlükte başlayan ve artan, hizalama öğrenimini hızlandıran eğitim programı |
| Görüş merkezli tezgah | "CV-Bench / BLINK" | Dil ağırlıklı akıl yürütme yerine ince taneli görsel algıyı vurgulayan değerlendirme |
| PixMo | "Molmo'nun verileri" | Allen AI'nin 712K yoğun altyazılı görüntüsü dataset; yoğun altyazılara aktarılmış insan konuşması |

## Daha Fazla Okuma

- [McKinzie ve ark. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon ve ark. — Idefics2 / VLM oluşturmanın önemi nedir (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke ve ark. — Molmo ve PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong ve ark. — Kambriyen-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti ve ark. — Prizmatik VLM'ler (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
