# Video Dil Modelleri: Zamanlı İşaretler ve Yerleştirme

> Video bir sürü fotoğraf değil. 5 saniyelik bir klip, bir görüntü modeli temsil edemeyeceği sebepçi sırayla, eylem fiillerine ve olay zamanlamasına sahiptir. Video-LLaMA (Zhang et al., Haziran 2023) ilk açık video-LLM'yi ses-görsel yerleştirme ile gönderdi. VideoChat ve Video-LLaVA bu örneği genişletti. 2025 yılına kadar Qwen2.5 VL'nin zaman uyumlu M-RoPE, sınır özel modelleri ile arasındaki boşluğu kapattı. Her sistem zamanlı tokenleri farklı olarak çözdü. Klip başına Q-former, çerçeve başına concat-pool, zamanlı olarak uzlaştırılmış M-RoPE, token başına. Bu ders, kalıpları okuyor, bir benzerlik karşı dinamik çerçeve örneği oluşturur ve zamanlı yerleştirme görevlerini değerlendirir.

**Type:** Build
**Languages:** Python (stdlib, frame sampler + temporal-grounding evaluator), TypeScript
**Prerequisites:** Phase 12 · 08 (LLaVA-OneVision)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Zamanlı konum kodlaması neden görüntü kodlayıcıdan bağımsız olarak video VLM performansını değiştirdiğini açıklayın.
- Sekundu başına tokenler vs yerleştirme doğruluğunda benzer, dinamik-FPS ve olay yönlendirilmiş çerçeve örneklemesini karşılaştırın.
- Video-LLaMA vs. pooled-per-frame (Video-LLaVA) vs. time-aligned M-RoPE per token (Qwen2.5-VL) tasarımlarını açıklayın.
- VideoMME, TempCompass, EgoSchema, Video-MMMU gibi dört video referans değerini söyleyin.

## Sorun

30 FPS'de 1 dakikalık bir video 1800 çerçeveye eşittir. Bir çerçeveye 196 görsel token (ViT-B 224) ile, bu, 2024 dönemindeki herhangi bir LLM bağlamından daha büyük 352k token.

Üç azaltma stratejisi vardır:

1. Alt örnek çerçeveleri (1-8 FPS içeriğe bağlı olarak).
2. Her çerçevenin patch tokenlerini agresif bir şekilde (3x3 veya 4x4 binar havuz) birleştirin.
3. 16 kadro klipini alıp 64 token çıkaran bir Q-former ile sıkıştır.

Her bir değişim farklıdır. Alt örnekleme zamansal ayrıntıları kaybeder. Birleştirme uzaysal ayrıntıları kaybeder.

Zamanlı konum kodlaması diğer eksendir: model frame 5'in frame 6'dan önce geldiğini nasıl biliyor? Seçenekler arasında basit 1D temporal RoPE (Video-LLaMA), öğrenilmiş temporal embeddings (Video-LLaVA) ve zaman uyumlu M-RoPE (Qwen2.5-VL, tam 3D) bulunur.

## Anlaşım

### Video-LLaMA: Klip başına Q-former + ses dalı

Video-LLaMA (2023) ilk açık video-LLM oldu.

- 16 kadro klipler 2 FPS'de (böylece 8 saniye).
- Bir çerçeveye ViT özellikleri -> 16 çerçeveyi çapraz olarak takip eden Video Q-former -> 32 öğrenilmiş sorgu -> LLM.
- Paralel ses dalgası: dalga biçimi -> ImageBind ses kodlayıcı -> Audio Q-former -> 32 sorgu -> LLM.

Güç: sesli-görsel ortak düşünce. Zayıflık: sabit klip uzunluğu, keyfi zaman yerleştirme yok.

### VideoChat ve Video-LLaVA

VideoChat, Video-LLaMA fikrini korudu ancak sesini düşürdü ve basitleştirdi. Video-LLaVA (Lin ve diğerleri, 2023) hem görüntüler hem de video çerçeveleri üzerinde tek bir görsel kodlayıcıyı ("projeksiyona kadar uyum") eğitmiştir.

İkisi de uzun videoları kullanmıyor.

### Qwen2.5 VL ve zaman uyumlu M-RoPE

Qwen2.5-VL, Qwen2-VL'nin M-RoPE'sini (Multimodal Rotary Position Embedding) tutar ve zaman aksını mutlak zaman ile uyumlu hale getirir. Her patch token, t'nin gerçek zaman damgasını (cadra endeksi değil) takip ettiği bir (t, h, w) pozisyon taşıyor. Qwen2.5-Omni (Desin 12.20) daha sonra aynı fikrin ses ve video sürümünü TMRoPE, Zaman Ayarlı Multimodal RoPE olarak adlandırır.

Basit temporal yerleştirme ile ilgili temel farklar:

- Model "4,2 saniye" olarak görüyor, "15 çerçeve" olarak görmüyor.
- Her bir görüntü simgesi zaman damlasıyla bağımsız olarak döner.
- Eğer burada 2 FPS ve orada 4 FPS'de örnek alırsanız, zaman uyumlu M-RoPE eşitsiz mesafeyi doğal olarak ele alır.

Zaman doğrultusunda M-RoPE, "Kedi kaç saniye atlar?" sorularını etkinleştirir. Modelle "4,2 saniye" çıkarabilir. Video-LLaMA sadece "klipteki erken saatlerde" diyebilir.

### Çerçeve örnekleme stratejileri

Bir yandan, N çerçeveleri eşdeğer olarak süresi boyunca.

Dinamik FPS: Hareket yoğunluğuna göre örnekleme uyarlayıcı olarak. Optik akış veya çerçeve farklılığı yoğun örnekleme için yüksek hareketi segmentleri seçer. Qwen2.5-VL bu üzerinde trenler.

Olaylara dayalı: hafif bir detektör çalıştırın, eylemlerin olduğu yerlerde daha fazla örnek alın.

Anahtar çerçeve + bağlam: çekim sınırları + birkaç bitişik çerçeve örnek.

### Çerçeve başına birleştirme

1 FPS ve 576 token per frame'de, 5 dakikalık bir klip 172.800 token'e eşittir. Bu Qwen2.5-VL-72B'nin 128k bağlamını aşar, bu yüzden önce frame rate veya pool token'ları düşürmelisin.

3x3 binlineer havuzu, çerçeve başına 64 tokene kadar azalır -> 5 dakika boyunca 19.200 tokene.

Yerel ayrıntıların daha az önem verdiği ajan iş akışları için daha agresif bir şekilde (6x6 -> 16 token per frame) bir araya getirin.

### Dört video referans göstergesi

- VideoMME: kapsamlı video anlayışı, kısa + orta + uzun.
- TempCompass: ince tanelerli zamansal düşünce, "önce" / "sonra" sorular.
- EgoSchema: Uzun boyutlu ilk kişilik video.
- Video-MMMU: Multimodal multi-disiplin video soruları.

Tam bir video-VLM değerlendirme dörtü de vurgulamaktadır. Farklı ekseller üzerinde vurgular  TempCompass sipariş etmekle ilgilidir, EgoSchema yaklaşık 3+ dakika akıl yürütme, VideoMME süreleri kapsamaktadır.

### Yerleştirme çıkış biçimleri

Zamanlı yerleştirme için çıkış biçimleri:

- "Kedi 4 saniyelik çizginin etrafında atlar". Anlamak kolaydır ama net değil.
- Yapılandırılmış JSON: `{"event": "jump", "start": 4.1, "end": 4.3}`- Qwen2.5 VL bu şekilde çalıştırıyor.
- Token tabanlı: özel `<time>4.1</time>`Bazı video modeller bunu kullanır; Qwen2.5-VL bunun yerine M-RoPE pozisyon kimliklerinde ve cevaplarında zamanı metinde veya JSON'da kodlar.

Token tabanlı, aşağı akıntılı kullanım için en doğru. Qwen2.5-VL'nin JSON çıkış biçimi doğrudan analiz edilir.

### 2026 En iyi uygulamalar

2026'da video VLM'ler için:

- Kodlayıcı: SigLIP 2 veya doğuştan çözünürlüklü ViT, LLM'de zaman uyumlu M-RoPE (Qwen2.5-VL).
- Çerçeve örneği: dinamik FPS (1-4 hareketine bağlı olarak) maksimum çerçeve kapalı.
- Çerçeve başına birleştirme: 3x3 milyar.
- Çıktı: zaman + olay alanları ile yapılandırılmış JSON.
- Benchmarks: VideoMME + TempCompass for general; EgoSchema for long horizon.

```figure
video-temporal-patches
```

## Kullan

`code/main.py`içerir:

- Teker teker ve dinamik FPS çerçeve örnekleri.
- Oyuncak zamansal yerleştirme değerlendiricisi: T zamanında "yerçek gerçek" olayı ve bir model çıkışı verildiğinde, doğruluğu tolerans ile puanlayın.
- Video-LLaMA (16 çerçeve, eski Q), Video-LLaVA (8 çerçeve, MLP), Qwen2.5-VL (dinamik FPS + zaman uyumlu M-RoPE) arasındaki bir karşılaştırma.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-video-vlm-frame-planner.md`. Bir video görevi (yakutma, eylem tanıma, zamanlı yerleştirme, özetleme) verildiğinde, çerçeve örneğini, birleştirme faktörünü, çıkış biçimini ve beklenen doğruluk seviyesini seçer.

## Egzersizler

1. 3 dakikalık bir yemek demosu için, üniforma vs dinamik FPS seçin.

2. Zamanla uyumlu M-RoPE, basit bir zamanlı yerleştirme tablosunun yapamayacağı özel olarak neyi ekler?

3. VLM'nin yaymayı öğrenebileceği zamanlı yerleştirme için JSON şeması yazın. Hata durumlarını da dahil edin.

4. Video-LLaVA'nın "Projeksiyondan Önce Uyumlandırma" başlıklı 3. bölümünü okuyun.

5. VideoMME liderlik tabloyu göz önüne alındığında, 2026 yılına kadar en üst açık model ile en üst özel model arasındaki fark nedir? Bu farkın ne kadarı zaman kodlama ile temel LLM ölçeği arasında ilişkilendirilir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Temporal grounding | "Time-localized answers" | VLM outputs a specific timestamp range for when an event happens |
| Time-aligned M-RoPE | "TMRoPE" | 3D rotary position whose temporal axis follows absolute timestamps; Qwen2.5-VL uses it for video, and Qwen2.5-Omni names its audio and video form TMRoPE |
| Dynamic FPS | "Motion-aware sampling" | Sample more frames in high-motion segments, fewer in static ones |
| Frame pooling | "Spatial compress per frame" | Reduce patches per frame with bilinear interpolation before the LLM |
| Video Q-former | "Clip compressor" | Cross-attention bottleneck mapping N frames to K learned queries |
| VideoMME | "Video bench" | Comprehensive short/medium/long video benchmark, 2500+ samples |

## Daha Fazla Okumak

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
