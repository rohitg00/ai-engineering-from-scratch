# Video Dili Modelleri: Geçici Token'ler ve Topraklama

> Video bir fotoğraf yığını değildir. 5 saniyelik bir klipte, bir görüntü modelinin temsil edemeyeceği nedensel sıralama, eylem fiilleri ve olay zamanlaması bulunur. Video-LLaMA (Zhang ve diğerleri, Haziran 2023), görsel-işitsel topraklamaya sahip ilk açık video-LLM'yi piyasaya sürdü. VideoChat ve Video-LLaVA modeli ölçeklendirdi. 2025 yılına gelindiğinde Qwen2.5-VL'nin TMRoPE'si, sınırdaki tescilli modellerle aradaki boşluğu kapattı. Her sistem geçici token'leri farklı şekilde çözdü; klip başına Q-former, çerçeve başına concat havuzu, token başına TMRoPE. Bu ders kalıpları okur, tek tip ve dinamik çerçeve örnekleyici oluşturur ve zamansal temellendirme görevlerini değerlendirir.

**Tür:** Yapım
**Diller:** Python (stdlib, çerçeve örnekleyici + zamana dayalı değerlendirici)
**Önkoşullar:** Aşama 12 · 08 (LLaVA-OneVision)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- Zamansal konumsal kodlamanın neden video VLM performansını görüntü kodlayıcıdan bağımsız olarak değiştirdiğini açıklayın.
- Saniyede token ile topraklama doğruluğunu karşılaştırarak tekdüze, dinamik FPS ve olay odaklı kare örneklemeyi karşılaştırın.
- Klip başına Q-former (Video-LLaMA), kare başına havuzlanmış (Video-LLaVA) ve token (Qwen2.5-VL) başına M-RoPE tasarımlarını açıklayın.
- Dört videoya benchmark adını verin: VideoMME, TempCompass, EgoSchema, Video-MMMU.

## Sorun

30 FPS'de 1 dakikalık bir video 1800 karedir. Kare başına 196 görsel token (224'te ViT-B), bu da 352 bin token anlamına geliyor; 2024 dönemi LLM bağlamından daha büyük.

Üç azaltma stratejisi mevcuttur:

1. Alt örnek kareler (içeriğe bağlı olarak 1-8 FPS).
2. Her karenin yamasını token'leri agresif bir şekilde havuzlayın (3x3 veya 4x4 çift doğrusal havuz).
3. 16 karelik bir klip alan ve 64 token çıktısı veren bir Q-former aracılığıyla sıkıştırın.

Her takas farklıdır. Alt örnekleme zamansal ayrıntıları kaybeder. Havuzlama, mekansal ayrıntıları kaybeder. Q-former her ikisini de biraz kaybeder ancak token'leri kurtarır.

Zamansal konum kodlaması diğer eksendir: Model, çerçeve 5'in çerçeve 6'dan önce geldiğini nasıl biliyor? Seçenekler arasında basit 1D geçici RoPE (Video-LLaMA), öğrenilmiş geçici embedding'ler (Video-LLaVA) ve TMRoPE (Qwen2.5-VL, tam 3D) bulunur.

## Konsept

### Video-LLaMA: Klip başına Q-former + ses dalı

Video-LLaMA (2023), ilk açık video-LLM'dir. Mimari:

- 2 FPS'de (yani 8 saniye) 16 karelik klipler.
- Kare başına ViT özellikleri -> 16 karenin tamamına çapraz katılım sağlayan Video Q-former -> 32 öğrenilmiş sorgu -> Yüksek Lisans.
- Paralel ses dalı: dalga biçimi -> ImageBind ses kodlayıcı -> Audio Q-former -> 32 sorgu -> Yüksek Lisans.

Güçlülük: görsel-işitsel ortak muhakeme. Zayıflık: sabit klip uzunluğu, keyfi zaman topraklaması yok.

### Görüntülü Sohbet ve Video-LLaVA

VideoChat, Video-LLaMA fikrini korudu ancak sesi düşürdü ve basitleştirdi. Video-LLaVA (Lin ve diğerleri, 2023), hem görüntüler hem de video kareleri ("projeksiyondan önce hizalama") üzerinde tek bir görsel kodlayıcıyı eğiterek birleşik bir temsil sağladı. Her ikisi de dondurulmuş CLIP kodlayıcı + MLP + LLM'dir.

Her ikisi de uzun videoyu işlemez. Her ikisi de 8-16 çerçeveli sistemlerdir.

### Qwen2.5-VL ve TMRoPE

Qwen2.5-VL, TMRoPE — Geçici Modalite Döner Konumu Embedding'yi tanıttı. Her token yaması bir (t, h, w) konumu taşır; burada t gerçek zaman damgasıdır (çerçeve dizini değil).

Basit zamansal embedding'den temel farklar:

- Mutlak zaman, indeks değil. Model "15. karede" değil "4.2 saniyede" görüyor.
- Klip başına değil, token dönüşü başına. Her görsel token, zaman damgasına göre bağımsız olarak döner.
- Dinamik FPS ile uyumludur. Burada 2 FPS ve orada 4 FPS'de örnekleme yaparsanız, TMRoPE eşit olmayan aralıkları yerel olarak yönetir.

TMRoPE "kedi hangi saniyede atlar?" seçeneğini etkinleştirir. sorgular. Model "4,2 saniyede" çıktı verebilir. Video-LLaMA yalnızca "klibin başlarında" diyebildi.

### Çerçeve örnekleme stratejileri

Tek tip: N kareyi süre boyunca eşit şekilde örnekleyin. Basittir, hareket zirvelerini kaybeder.

Dinamik FPS: Hareket yoğunluğuna göre uyarlamalı örnekleme. Optik akış veya çerçeve farklılaştırma, daha yoğun örnekleme için yüksek hareketli segmentleri seçer. Qwen2.5-VL bu konuda eğitim veriyor.

Olay odaklı: hafif bir dedektör çalıştırın, eylemin gerçekleştiği yerde daha fazlasını örnekleyin. VideoAgent tarafından kullanılır.

Ana kare + bağlam: çekim sınırlarında örnek + birkaç bitişik kare. Sinematik içerik için kullanılır.

### Çerçeve başına havuzlama

1 FPS ve kare başına 576 token ile 5 dakikalık bir klip 172.800 token'dir. Qwen2.5-VL-72B'nin 128k bağlamı ile yapılabilir ancak pahalıdır.

3x3 çift doğrusal havuz kare başına 64 token'ye düşer -> 5 dakika boyunca 19.200 token. Çoğu görev için en uygun nokta.

Uzamsal ayrıntıların daha az önemli olduğu agent iş akışları için daha agresif bir şekilde havuzlayın (kare başına 6x6 -> 16 token).

### Dört video benchmark

- VideoMME: kapsamlı video anlayışı, kısa + orta + uzun.
- TempCompass: ince taneli zamansal akıl yürütme, "önce" / "sonra" soruları.
- EgoSchema: uzun ufuklu birinci şahıs video.
- Video-MMMU: çok modlu çok disiplinli video soruları.

Tam bir video-VLM değerlendirmesi dördünü de kapsar. Farklı eksenleri vurguluyorlar — TempCompass tamamen sıralamayla ilgilidir, EgoSchema yaklaşık 3+ dakika akıl yürütmeyle ilgilidir, VideoMME ise süreleri kapsar.

### Topraklama çıkış formatları

Zamansal topraklama için çıkış formatları:

- Serbest metin: "Kedi 4 saniye işaretinin etrafından atlar." Ayrıştırılması kolay ancak kesin değil.
- Yapılandırılmış JSON: `{"event": "jump", "start": 4.1, "end": 4.3}`. Qwen2.5-VL bunu eğitir.
- Token tabanlı: yanıtla serpiştirilmiş özel `<time>4.1</time>` token'ler. Qwen2.5-VL'nin dahili formatı.

Token tabanlı, aşağı yönde kullanım için en doğrudur. Qwen2.5-VL'nin JSON çıkış formatı doğrudan ayrıştırılır.

### 2026'nın en iyi uygulaması

2026'daki video VLM'ler için:

- Kodlayıcı: M-RoPE veya TMRoPE'li SigLIP 2 (Qwen2.5-VL).
- Kare örnekleme: Maksimum kare sınırıyla dinamik FPS (harekete bağlı olarak 1-4).
- Çerçeve başına havuzlama: 3x3 çift doğrusal.
- Çıktı: zaman + olay alanlarıyla yapılandırılmış JSON.
- Benchmarks: Genel olarak VideoMME + TempCompass; Uzun ufuk için EgoSchema.

## Kullan onu

`code/main.py` şunları içerir:

- Düzgün ve dinamik FPS çerçeve örnekleyicileri.
- Oyuncak bir zamansal temellendirme değerlendiricisi: T zamanındaki bir "temel gerçek" olayı ve bir model çıktısı verildiğinde, doğruluğu toleransla puanlayın.
- Video-LLaMA (16 kare, Q-former), Video-LLaVA (8 kare, MLP), Qwen2.5-VL (dinamik FPS + TMRoPE) arasında bir karşılaştırma.

## Gönderin

Bu ders `outputs/skill-video-vlm-frame-planner.md`'yi üretir. Bir video görevi verildiğinde (izleme, eylem tanıma, zamansal topraklama, özetleme), çerçeve örnekleyiciyi, havuzlama faktörünü, çıktı formatını ve beklenen doğruluk katmanını seçer.

## Egzersizler

1. 3 dakikalık bir yemek pişirme demosu için tek tip ve dinamik FPS'yi seçin. token sayımıyla gerekçelendirin.

2. TMRoPE, basit bir geçici embedding tablosunun yapamayacağı spesifik olarak neyi ekler?

3. Bir VLM'nin yaymayı öğrenebileceği zamansal topraklama için bir JSON şeması yazın. Hata durumlarını dahil edin.

4. Video-LLaVA'nın "Projeksiyon Öncesi Hizalama" başlıklı 3. Bölümünü okuyun. Bu neden ayrı görüntü ve video kodlayıcıları eğitmekten daha iyidir?

5. VideoMME skor tablosu göz önüne alındığında, 2026 itibarıyla en üstteki açık model ile en üstteki özel model arasındaki fark nedir? Bu boşluğun ne kadarı temel LLM ölçeğine karşı geçici kodlamaya atfedilebilir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Geçici topraklama | "Zamana göre yerelleştirilmiş yanıtlar" | VLM, bir olayın gerçekleştiği zamana ilişkin belirli bir zaman damgası aralığının çıktısını verir |
| TMRoPE | "Zaman-Multimodal RoPE" | Qwen2.5-VL tarafından kullanılan, mutlak zaman damgalarına sahip 3 boyutlu döner konum |
| Dinamik FPS | "Harekete duyarlı örnekleme" | Yüksek hareketli segmentlerde daha fazla kare, statik segmentlerde ise daha az kare örnekleyin |
| Çerçeve havuzu | "Çerçeve başına uzamsal sıkıştırma" | Yüksek Lisans öncesinde çift doğrusal enterpolasyonla kare başına ekleri azaltın |
| Video Q-eski | "Klip kompresörü" | Çapraz dikkat darboğazı N kareyi K öğrenilmiş sorguya eşliyor |
| VideoMME | "Video tezgahı" | Kapsamlı kısa/orta/uzun video benchmark, 2500'den fazla örnek |

## Daha Fazla Okuma

- [Zhang ve ark. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li ve ark. — Görüntülü Sohbet (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin ve ark. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Ekibi — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin ve ark. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
