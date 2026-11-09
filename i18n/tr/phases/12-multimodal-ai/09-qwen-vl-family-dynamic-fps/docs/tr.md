# Qwen-VL Aile ve Dinamik-FPS Video

> Qwen-VL ailesi  Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025)  2026'da en etkili açık görüş dil model soyundadır. Her nesil, açık ekosistemin geri kalanının on iki ay içinde kopyaladığı tek bir kararlı mimari bahis yaptı: M-RoPE üzerinden yerel dinamik çözünürlük, mutlak zaman ayarıyla dinamik-FPS örnekleme, ViT'deki pencerelerin dikkatini ve yapılandırılmış ajan çıkış biçimlerini. Qwen3-VL tarafından, reçete istikrarlı hale geldi: 2D-RoPE-ViT kodlayıcı, yerel açı oranı girişleri, büyük bir Qwen3 dil tabanına bir MLP projeksiyonu ve birinci sınıf hedefler olarak OCR, yerleştirme ve ajan davranışını vurgulayan eğitim aşamaları. Bu ders aileyi kronolojik olarak okuyor, böylece her düğmenin neden olduğu yeri anlayabiliyorsun.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- M-RoPE'nin üç ekseni dönümlerini (zaman, yüksekliği, genişliği) hesaplayın ve neden bunların hepsine ihtiyaç duyduğunu açıklayın.
- Bir video için dinamik FPS örnekleme stratejisi seçin ve saniyede token vs olay tespit doğruluğu hakkında düşünün.
- Dört Qwen-VL nesil yükseltme sırasıyla ve her birinin neyi etkinleştirdiğini söyleyin.
- Qwen2.5-VL tarzı JSON ajansı çıkış biçimini telleştirin ve VLM yanıtından yapılandırılmış araç çağrılarını analiz edin.

## Sorun

Qwen-VL, Ağustos 2023'te LLaVA-1.5 ve BLIP-2'ye doğrudan bir cevap olarak gönderildi. Qwen ekibi hedef alan boşluk üçtür: çözünürlük, video ve yapılandırılmış çıkış.

Çözüm: LLaVA-1.5 336x336'da çalıştı. Fotoğraflar için iyi, Çin dilindeki bir fatura veya yoğun bir kalıplama ekran görüntüsü için işe yaramaz. Qwen-VL'nin ilk yeniliği 448x448 ve sınırlama kutusunun çıkışı ile yerleştirilmişti.

Video: Video-LLaMA, çerçeve başına kodlayıcıları yığarak LLM'ye gönderdi. Kısa klipler için çalışıyordu, zaman ekseni sinyal olduğu çok dakikalık videolar için değil. Qwen ekibi zamanı anlayan tek bir kodlayıcı istiyordu.

Yapılandırılmış çıkış: LLaVA serbest biçimli metin yayımladı. Bir ajan JSON'a ihtiyaç duyar. Qwen-VL açık JSON çıkış biçimlerinde eğitim almıştır.

Her Qwen-VL nesli bu üç ekseden birini uzattı.

## Anlaşım

### Qwen-VL (Avgust 2023)

İlk nesil: OpenCLIP ViT-bigG/14 kodlayıcı olarak (2.5B param), LLama uyumlu Q-Former (1-adım 256 sorgu ile), Qwen-7B tabanı. Katkılar:

- 448x448 çözünürlüğü (doğrusu açık bir VLM için SOTA).
- Yerleştirme: açık koordinat-tıkın çıkışı ile görüntü-metin çiftlerinde eğitilmiştir. "Kedi <box>112, 204), (280, 344)</box>'de".
- Baştan beri Çin + İngilizce çok dilli eğitim.

O zamanlar standartlar: İngilizce'de GPT-4V ile rekabetçi, Çin'de dominançlı.

### Qwen2-VL (Eylül 2024)  M-RoPE ve yerli çözünürlük

Qwen2-VL sabit çözünürlüklü + Q-Former yığınını doğuştan dinamik çözünürlüklü ViT kodlayıcısı ile değiştirdi. Ana değişiklikler:

- Doğal dinamik çözünürlük. ViT 28 ile bölünebilir herhangi bir HxW kabul eder (14 patch 2x uzaylı birleşim ile). 1120x672 (40x24 birleşmiş patches) bir görüntü 960 görsel jeton üretir. boyut, bez, küçük resim yok.
- M-RoPE (Multimodal RoPE). Her token 1D yerine 3D pozisyonunu taşıyor (t, h, w). Resimler için t = 0, video için t = frame_index. RoPE, sorgu / anahtar vektörlerini bir eksesi başına bir frekansla döndürür.
- MLP projeksiyoncu. Q-Former'ı bırakın.
- Değişken olarak 1-2 FPS'de örneklenen video, ancak model keyfi çerçeve sayımlarını kabul eder.

Sonuç: Qwen2-VL-7B, birkaç multimodal referans değerinde GPT-4o ile eşleşti ve DocVQA (94.5 vs 88.4) üzerinde yendi.

### Qwen2,5-VL (Feb. 2025)  dinamik FPS + mutlak zaman

Qwen2.5 VL'nin büyük değişikliği videoydu. Dinamik FPS sadece "gerekirse daha fazla çerçeve örneklemek" değil.

- M-RoPE'nin zaman aksı çerçeve indekslerinin yerine gerçek zaman damgalarını takip eder, bu nedenle iki çerçeve ID'lerinin arasındaki boşluklar aralarındaki saniyeleri izler. "0:04'te kedi atlar".
- Dinamik FPS. 1 FPS'de yavaş görüntüler için örnek, 4+ FPS'de eylem için. Kullanıcı veya eğitmen seçer; M-RoPE uyarlanır.
- ViT'de pencereler dikkat. Yerel dikkat, geçiş için pencereler (blükler içinde yerel) ve birkaç katman sonra küresel dikkat.
- Açık JSON çıkış biçimi. Araç çağrı verileri üzerinde eğitilmiş: "{\"ağız\": \"tıklayın\", \"harekler\": [380, 220]}".
- MRoPE-v2 ölçeklendirme. 10 dakikalık bir video frekans aralığından çıkmasın diye en fazla giriş boyutu ile konum ölçeklendirilir.

Benchmarks: Qwen2.5-VL-72B çoğu video benchmark'da GPT-4o'yu yener, belgelerde Gemini 2.0'ya eşleşir ve GUI yerleştirimi için açık model SOTA'yı ayarlar (ScreenSpot: 84% doğruluk vs. GPT-4o için 38%).

### Qwen3-VL (Kasım 2025)

Qwen3-VL, yeniden icat etmek yerine birleştirilen bir artış yükseltmesidir: daha büyük LLM omurgası (Qwen3-72B), genişletilmiş eğitim verileri, geliştirilmiş OCR, Qwen3 "düşünme modu" aracılığıyla daha güçlü bir mantıklama.

Soy alınması: 2025 yılına kadar Qwen-VL mimarisi istikrarlı hale geldi.

### Matematik olarak M-RoPE

Klasik RoPE bir sorguyu döndürür `q`boyutlu `d`Konumlara göre`m`Çift koordinatları kullanılarak:

```math
\begin{aligned}
q_{\text{rot}}[2i] &= q[2i] \cos(m \theta_i) - q[2i+1] \sin(m \theta_i) \\
q_{\text{rot}}[2i+1] &= q[2i] \sin(m \theta_i) + q[2i+1] \cos(m \theta_i) \\
\theta_i &= 10000^{-2i/d}
\end{aligned}
```

M-RoPE gizli karanlığı üç gruba ayırır.`d = 96`. 32 dims'i temporal, 32'i yükseklik ve 32'i genişlik olarak belirleyin. Her bant kendi eksesi pozisyonu ile döner.`R_t(5)`- Evet .`R_h(10)`- Evet .`R_w(20)`Üç bandına uygulanır.

Metin işaretleri kullanımı `t = text_index, h = 0, w = 0`(veya normal bir seçim) uyumluluğu korumak için.`t = frame_time, h = row, w = col`Tek görüntü kullanımı`t = 0`- Evet .

Avantaj: Bir pozisyon kodlaması, farklı pozisyon tabloları veya şubeler kodları olmadan metin, resim ve videoyu işliyor.

### Dinamik-FPS örnekleme mantığı

Videoyu gösterdiğimizde .`T`saniye ve hedef token bütçesi `B`- ...

1. Yapabileceğiniz maksimum FPS'i hesaplayın: `fps_max = B / (T * tokens_per_frame)`- Evet .
2. Hedef FPS ' den birini seç .`{1, 2, 4, 8}`Bu tatmin eder.`fps <= fps_max`- Evet .
3. Hareket yüksekse (optik akış heuristik veya açık kullanıcı isteği), daha yüksek FPS seçin.
4. Seçilen FPS'de benzer bir şekilde örnek alın; her çerçevenin zamansal kimliğini M-RoPE'den saniyeler içinde ayarlayın.

Qwen2.5-VL bu mantığı içeren bir şekilde eğitir; sonuçta kullanıcı `fps`Parametre. 4 FPS'de 60 saniyelik bir eylem dizisi, çerçeve başına 81 token = 19440 token ile, 32k bağlamda yönetilebilir.

### Yapılandırılmış ajan çıkışı

Qwen2.5 - VL'nin ajan eğitiminde açıkça yapılandırılmış araç çağrıları hedefliyor:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

Parsing deterministiktir: JSON.parse modelin çıkışını karşılaştırın. Regex ve belirsizlik işlemeyi gerektiren serbest biçim " (1024, 512) " ile karşılaştırın.

```figure
mm-mrope-axes
```

## Kullan

`code/main.py`Uygulamaları:

- M-RoPE konum hesaplama, paketlenmiş bir dizi metin, görüntü yamaları ve video çerçeveleri karıştırmak için.
- Dinamik-FPS örneklemeci: verilen (durum, bütçe, hareket_ seviyesi), FPS seçin ve çerçeve zaman damgalarını gönderin.
- Araç çağrılarının koordinat alanlarıyla yanıtlarını işleyen oyuncak Qwen2.5-VL JSON çıkış analizi.

5 dakikalık bir videoda sabit-FPS'i dinamik-FPS'e değiştirdiğinizde farkı hissedin.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-qwen-vl-pipeline-designer.md`. Bir video görevi (önetici, ajan, eylem tanıma, erişilebilirlik) verildiğinde, Qwen2.5 VL yapılandırmasını (cadre bütçesi, FPS stratejisi, pencere dikkatliliği bayrağı, ajan çıkış modunu) ve gecikme tahminini yayar.

## Egzersizler

1. Bir yama için M-RoPE dönüşümlerini (t=3, h=5, w=7) gizli 48 (16 per bant, temel theta 10000) ile hesaplayın.

2. 10 dakikalık güvenlik kamerası 1 FPS'de kaydetmek kaç çorap üretir? 3x havuzlu 384 çözünürlükte toplam kaç token? Qwen2.5 -VL'nin varsayılan 32k bağlamı bunu işliyor mu?

3. 30 saniyelik tenis rallisi için FPS'i 30 saniyelik tarif demo ile 30 saniyelik UI ajanı kayıtları karşılaştırın.

4. Qwen2.5VL, Q-Former'ı tamamen düşürüyor. Neden basit bir MLP 2025'te çalışacak ama 2023'te çalışmayacak?

5. Üç Qwen2.5-VL JSON araç çağrı çıkışlarını Python diktlerine ayırın. Yanlış biçimlendirilmiş JSON'da ne eksikliği var ve Qwen yemek kitabı hangi kurtarma stratejisini önerir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 3D rotary position embedding with temporal, height, and width bands in the hidden dim |
| Dynamic FPS | "Smart sampling" | Frame sampling rate chosen per video based on motion, duration, and token budget |
| Absolute time encoding | "Time-aligned M-RoPE" | Temporal position IDs set from each frame's timestamp, so the model sees actual seconds, not frame index, with no extra tokens |
| Window attention | "Local attention" | Spatial self-attention restricted to small windows for speed; global attention added periodically |
| Structured agent output | "JSON mode" | Training data supervision teaching the VLM to emit parseable JSON with coords and tool names |
| min_pixels / max_pixels | "Resolution bounds" | Per-request Qwen2.5-VL controls bounding total pixel count and therefore token count |
| Grounding | "Point-at-it" | Outputting bounding-box coordinates as text tokens; used since Qwen-VL v1 |

## Daha Fazla Okumak

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
