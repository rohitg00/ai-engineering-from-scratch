# Vision Transformer'ler ve Patch-Token Primitive

> Çok modlu herhangi bir şeyden önce, bir görüntünün bir transformer'nin yiyebileceği token dizisi haline gelmesi gerekir. 2020 ViT makalesi buna 16x16 piksel yamalar, doğrusal bir projeksiyon ve embedding konumuyla yanıt verdi. Beş yıl sonra, her 2026 sınır modeli (2576px native'de Claude Opus 4.7, Gemini 3.1 Pro, Qwen3.5-Omni) hala bu şekilde başlıyor - kodlayıcı ViT'den DINOv2'ye ve SigLIP 2'ye değiştirildi, token kaydı eklendi, konum şeması 2D-RoPE oldu, ancak ilkel tutuldu. Bu ders, patch-token ardışık düzenini uçtan uca okur ve bunu stdlib Python'da oluşturur, böylece Aşama 12'nin geri kalanı "görsel token'ler" için somut bir zihinsel modele sahip olur.

**Tür:** Öğren
**Diller:** Python (stdlib, yama tokenizer + geometri hesaplayıcı)
**Önkoşullar:** Aşama 7 (Transformers), Aşama 4 (Bilgisayarlı Görme)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Bir HxWx3 görüntüsünü, doğru konumsal kodlamaya sahip bir token yama dizisine dönüştürün.
- Belirli bir ViT için sıra uzunluğunu, parametre sayısını ve FLOP'ları hesaplayın (yama boyutu, çözünürlük, gizli karartma, derinlik).
- ViT'yi 2020 araştırmasından 2026 üretimine taşıyan üç yükseltmeyi adlandırın: kendi kendini denetleyen ön eğitim (DINO / MAE), token kaydı ve yerel çözünürlüklü paketleme.
- CLS havuzlaması, ortalama havuzlama arasında seçim yapın ve aşağı akışlı bir görev için token'leri kaydedin.

## Sorun

Transformer'ler vektör dizileri üzerinde çalışır. Metin zaten bir dizidir (baytlar veya token'ler). Görüntü, bir dizi değil, üç renk kanalına sahip 2 boyutlu bir piksel ızgarasıdır. Her pikseli düzleştirirseniz, 224x224 RGB görüntü 150.528 token olur ve bu uzunluktaki öz dikkat, başlangıç ​​dışıdır (sıra uzunluğu açısından ikinci dereceden).

2020 öncesi yaklaşımlar bir CNN özellik çıkarıcıyı ön tarafa cıvataladı: ResNet, 2048-dim vektörlerden oluşan 7x7'lik bir özellik haritası üretiyor ve bu 49 token'yi bir transformer'ye besliyor. Bu işe yarar ancak CNN'in önyargılarını (çeviri denkliği, yerel alıcı alanlar) miras alır ve transformer'nin ölçeklendirme iştahını kaybeder.

Dosovitskiy ve ark. (2020) açık soruyu sordu: Ya CNN'i atlarsak? Görüntüyü sabit boyutlu parçalara (örneğin 16x16 piksel) bölün, her bir parçayı doğrusal olarak bir vektöre yansıtın, konumsal bir embedding ekleyin ve diziyi bir vanilya transformer'ye besleyin. O zamanlar bu sapkınlıktı; kıvrımsız bir vizyon. Yeterli veriyle (JFT-300M, ardından LAION) ImageNet'te ResNet'i geride bıraktı ve gelişmeye devam etti.

2026 yılına gelindiğinde ViT ilkelliği tartışmasız temel haline gelecektir. Her açık ağırlık VLM'nin görüş kulesi bir tür soyundan gelir (DINOv2, SigLIP 2, CLIP, EVA, InternViT). Artık soru "yama kullanmalı mıyız?" değil. değil, "hangi yama boyutu, hangi çözünürlük programı, hangi ön eğitim hedefi, hangi konumsal kodlama."

## Konsept

### token olarak yamalar

`(H, W, 3)` şeklindeki bir `x` görüntüsü ve `P` yama boyutu verildiğinde, görüntüyü `(H/P) x (W/P)` örtüşmeyen yamalardan oluşan bir ızgaraya bölersiniz. Her yama bir `P x P x 3` piksel küpüdür. Her küpü bir `3 P^2` vektörüne düzleştirin. Her yamayı modelin gizli boyutu `D` ile eşlemek için `(3 P^2, D)` şeklinin paylaşılan doğrusal projeksiyonu `W_E` uygulayın.

ViT-B/16 standart yapılandırması için:
- Çözünürlük 224, yama boyutu 16 → ızgara 14x14 → 196 yama tokens.
- Her yama, `D = 768`'ye yansıtılan `16 x 16 x 3 = 768` piksel değerleridir.
- Öğrenilebilir bir `[CLS]` token → dizi uzunluğu 197 ekleyin.

Yama projeksiyonu, çekirdek boyutu `P`, adım `P` ve `D` çıkış kanallarına sahip bir 2 boyutlu evrişimle matematiksel olarak aynıdır. Üretim kodu bunu gerçekte bu şekilde uyguluyor - `nn.Conv2d(3, D, kernel_size=P, stride=P)`. "Doğrusal projeksiyon" çerçevelemesi kavramsaldır; çekirdek çerçeveleme etkilidir.

### Konumsal embedding'ler

Yamaların doğal bir sırası yoktur; transformer onları bir çanta olarak görür. İlk ViT'ler öğrenilebilir bir 1 boyutlu konumsal embedding ekledi (konum başına bir 768-dim vektör, 197 tanesi). Çalışır, ancak modeli eğitim çözünürlüğüne bağlar: inference'de ızgarayı değiştirirseniz konum tablosunun enterpolasyonunu yapmanız gerekir.

Modern görüş omurgaları 2D-RoPE (Qwen2-VL'nin M-RoPE'si, SigLIP 2'nin varsayılanı) veya faktörize edilmiş 2D konumlarını kullanır. 2D-RoPE, sorguyu ve anahtar vektörleri yamanın (satır, sütun) indeksine göre döndürür, böylece model, dönme açısından göreli 2B konumu çıkarır. Pozisyon tablosu yok. Model, inference'de isteğe bağlı ızgara boyutlarını yönetir.

### CLS token, havuzlanmış çıktı ve token'leri kaydedin

Görüntü düzeyinde gösterim nedir? Üç seçenek bir arada var:

1. `[CLS]` token. Yama dizisinin başına öğrenilebilir bir vektör ekleyin. Tüm transformer bloklarından sonra CLS token'nin gizli durumu görüntü temsilidir. BERT'ten miras alınmıştır. Orijinal ViT, CLIP tarafından kullanılır.
2. Ortalama havuz. Yama token'lerin çıktı gizli durumlarının ortalamasını alın. SigLIP, DINOv2 ve çoğu modern VLM tarafından kullanılır.
3. token'leri kaydedin. Darcet ve ark. (2023), açık bir token havuzu olmadan eğitilen ViT'lerin, kişisel dikkati kaçıran yüksek normlu "artifact" yamaları geliştirdiğini gözlemledi. 4-16 öğrenilebilir kayıt token'lerin eklenmesi bu yükü emer ve yoğun tahmin kalitesini (bölümleme, derinlik) artırır. DINOv2 ve SigLIP 2'nin her ikisi de kayıtlarla birlikte gönderilir.

Seçim, aşağı yönlü görevler için önemlidir. CLS sınıflandırma için iyidir. token yamalarını bir LLM'ye besleyen VLM'ler için, havuzlamayı tamamen atlarsınız; her yama bir LLM girişi token olur. Kayıtlar devredilmeden önce atılır (bunlar içerik değil, yapı iskelesidir).

### Ön eğitim: denetimli, kontrastlı, maskeli, kendi kendine damıtılmış

2020 ViT, JFT-300M üzerinde denetimli sınıflandırmayla önceden eğitildi. Hızla yerini aldı:

- CLIP (2021): 400 milyon çiftte karşılaştırmalı görüntü metni. Ders 12.02.
- MAE (2021, He ve diğerleri): yamaların %75'ini maskeler, pikselleri yeniden oluşturur. Kendi kendini denetler, saf görüntüler üzerinde çalışır.
- DINO (2021) / DINOv2 (2023): öğrenci-öğretmenle kendi kendine damıtma, etiket yok, altyazı yok. 2023 DINOv2 ViT-g/14, en güçlü salt görsel omurgadır ve "yoğun özellikler" kullanım durumları için varsayılandır.
- SigLIP / SigLIP 2 (2023, 2025): Sigmoid kaybı ve yerel en boy oranı için NaFlex içeren CLIP. 2026 açık VLM'lerdeki baskın görüş kulesi (Qwen, Idefics2, LLaVA-OneVision).

Ön eğitim seçiminiz omurganın ne işe yaradığını belirler: Metinle anlamsal eşleştirme için CLIP/SigLIP, yoğun görsel özellikler için DINOv2, aşağı yönlü ince ayar için başlangıç noktası olarak MAE.

### Ölçekleme yasaları

ViT ölçeklendirmesi (Zhai ve diğerleri 2022), ViT'nin kalitesinin model boyutu, veri boyutu ve hesaplama açısından öngörülebilir yasalara uyduğunu tespit etti. Sabit hesaplamada:
- Daha büyük model + daha fazla veri → daha iyi kalite.
- Yama boyutu, dizi uzunluğuna karşı aslına uygunluk açısından bir kaldıraçtır. Yama 14 (DINOv2/SigLIP SO400m için tipik), görüntü başına yama 16'ya göre daha fazla token verir; OCR ve yoğun görevler için daha iyi, hız açısından daha kötü.
- Çözünürlük diğer büyük kaldıraçtır. FLOP'larda ikinci dereceden maliyetle 224'ten 384'e ve 512'ye gitmek neredeyse her zaman yardımcı olur.

ViT-g/14 (1B parametreleri, yama 14, çözünürlük 224 → 256 token) ve SigLIP SO400m/14 (400M parametreleri, yama 14), 2026 açık VLM'ler için iki güçlü kodlayıcıdır.

### ViT için parametre sayısı

Hesaplamanın tamamı `code/main.py`'de bulunmaktadır. 224'te ViT-B/16 için:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Kontrol noktasını yüklemeden önce her ViT'yi bu tarafa park edin. Omurga boyutu, herhangi bir aşağı akışlı VLM'de VRAM tabanınızı belirler.

### 2026 üretim yapılandırması

2026'da birlikte gönderilen en açık VLM kodlayıcı, yerel çözünürlükte (NaFlex) SigLIP 2 SO400m/14'tür. Şunlara sahiptir:
- 400M parametreler.
- Yama boyutu 14, varsayılan çözünürlük 384 → 729 görüntü başına yama token.
- Görüntü düzeyindeki görevler için ortalama havuz; 729 yamanın tamamı VQA için LLM'ye akıyor.
- 4 kayıt token, LLM devredilmeden önce atıldı.
- Yerel en boy oranı için görüntü düzeyinde ölçeklendirmeye sahip 2D-RoPE.

Bu yapılandırmadaki her karar, okuyabileceğiniz bir makaleye dayanmaktadır.

```figure
image-patch-tokens
```

## Kullan onu

`code/main.py` bir tokenizer yama ve geometri hesaplayıcısıdır. (Görüntü H, W, yama P, gizli D, derinlik L) alır ve şunu bildirir:

- Yamalama sonrasında ızgara şekli ve dizi uzunluğu.
- Sentetik 8x8 piksellik bir oyuncak görüntüsü için Token dizisi (düzleştirme + yansıtma yolunda yürüyün).
- Yama yerleştirme, yerleştirme konumu, transformer blokları ve kafaya göre ayrılmış parametre sayısı.
- Hedef çözünürlükte ileri geçiş başına FLOP sayısı.
- ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384 arasında bir karşılaştırma tablosu.

Çalıştır. Parametre sayılarını yayınlanan sayılarla eşleştirin. token-sayım maliyetini hissetmek için yama boyutu ve çözünürlükle oynayın.

## Gönderin

Bu ders `outputs/skill-patch-geometry-reader.md`'yi üretir. Bir ViT yapılandırması (yama boyutu, çözünürlük, gizli karartma, derinlik) verildiğinde, gerekçeleriyle birlikte bir token sayımı, parametre sayımı ve VRAM tahmini üretir. Bir VLM için bir vizyon omurgası seçtiğinizde bu beceriyi kullanın; bu, "token'lerin patlaması ve LLM bağlamımın dolması" sürprizlerini önler.

## Egzersizler

1. Yerel 1280x720 girişinde yama boyutu 14 olan Qwen2.5-VL için yama-token dizi uzunluğunu hesaplayın. Bu, yalnızca CLS gösterimiyle nasıl karşılaştırılır?

2. Yama 14'teki 1080p kare (1920x1080) kaç tane token üretiyor? 5 dakikalık bir videoda 30 FPS'de toplam kaç görsel token var? Hangi maliyet sizi en çok kurtarır: havuzlama mı, çerçeve örnekleme mi yoksa token birleştirme mi?

3. Saf Python'da token yamaları üzerinde ortalama havuzlamayı uygulayın. Bir DINOv2 çıkışının 196 token üzerindeki ortalama havuzunun, havuzlanmış bir embedding istediğinizde modelin `forward` döndürdüğü değerle eşleştiğini doğrulayın.

4. "Vision Transformer'lerin Kayıtlara İhtiyacı Var" (arXiv:2309.16588) bölümünün 3. Bölümünü okuyun. İki cümleyle artifact kayıtlarının neyi emdiğini ve bunun aşağı yöndeki yoğun tahmin için neden önemli olduğunu açıklayın.

5. `code/main.py`'yi yama paketini destekleyecek şekilde değiştirin: farklı çözünürlüklerdeki görüntülerin bir listesi verildiğinde, tek bir paketlenmiş dizi ve blok çapraz dikkat maskesi oluşturun. Ulaştığınızda Ders 12.06'ya göre doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Yama | "16x16 piksel kare" | Giriş görüntüsünün sabit boyutlu, örtüşmeyen bir bölgesi; bir olur token |
| Yama embedding | "Doğrusal projeksiyon" | Düzleştirilmiş yama piksellerini D-dim vektörleriyle eşleyen, paylaşılan öğrenilmiş bir matris (veya stride=P ile Conv2d) |
| CLS token | "Sınıf token" | Son gizli durumu görüntünün tamamını temsil eden başa eklenen öğrenilebilir vektör; 2026'da isteğe bağlı |
| Kayıt Ol token | "Lavabo token" | Yüksek normdaki dikkati emen ekstra öğrenilebilir token'ler artifact ViT'ler ön eğitim sırasında gelişir |
| Pozisyon embedding | "Konum bilgisi" | Sıra sırasına duyarlı hale getiren konum başına vektör veya rotasyon; 2D-RoPE modern varsayılandır |
| Izgara | "Yama kılavuzu" | Belirli bir çözünürlük ve yama boyutu için (H/P) x (W/P) 2B yama dizisi |
| NaFlex | "Yerel esnek çözünürlük" | SigLIP 2 özelliği: tek model, yeniden eğitim gerektirmeden birden fazla en boy oranı ve çözünürlük sunar |
| Omurga | "Vizyon kulesi" | Patch-token çıkışları LLM'yi bir VLM |
| Havuzlama | "Resim düzeyinde özet" | Yama token'leri tek bir vektöre dönüştürme stratejisi: CLS, ortalama, dikkat havuzu veya kayıt tabanlı |
| Yama 14'e Karşı 16 | "Daha ince ve daha kaba ızgara" | Yama 14, görüntü başına daha fazla token, OCR için daha iyi doğruluk ve daha yavaş üretir; yama 16 klasik varsayılandır |

## Daha Fazla Okuma

- [Dosovitskiy ve ark. — Bir Görüntü 16x16 Kelime Değerindedir (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) — orijinal ViT.
- [O ve ark. — Maskeli Otomatik Kodlayıcılar Ölçeklenebilir Görme Öğrenicileridir (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) — MAE, kendi kendini denetleyen ön eğitim.
- [Oquab ve ark. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) — uygun ölçekte kendi kendine damıtma, etiket yok.
- [Darcet ve ark. — Vision Transformer'lerin Kayıtlara İhtiyacı Var (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) — token'leri ve artifact analizini kaydedin.
- [Tschannen ve ark. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — 2026 varsayılan görüş kulesi.
- [Zhai ve ark. — Ölçeklendirme Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) — deneysel ölçeklendirme yasaları.
