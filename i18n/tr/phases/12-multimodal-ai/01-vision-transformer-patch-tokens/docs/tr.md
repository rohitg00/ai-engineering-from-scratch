# Görme Transformerleri ve Patch-Token Primitive

> Bir görüntü, bir transformatörün yiyebileceği bir simge sırası haline gelmeden önce multimodal bir şey olmalıdır. 2020 ViT makalesi 16x16 piksel yamaları, bir çizgi projeksiyonu ve bir pozisyon yerleştirme ile buna cevap verdi. Beş yıl sonra her 2026 sınır modeli (Claude Opus 4.7 2576px doğuştan, Gemini 3.1 Pro, Qwen3.5-Omni) hala bu şekilde başlar  kodlayıcı ViT'den DINOv2'ye SigLIP 2'ye değiştirildi, kayıt simgelerinin eklendiği, konumsal şema 2D-RoPE oldu, ancak ilkel tutuldu. Bu ders, patch-token borusunu sonuna kadar okuyor ve stdlib Python'da inşa ediyor. Böylece 12'nin geri kalanında "görsel tokenler" için bir zihinsel model var.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- HxWx3 resmini doğru konum kodlaması ile bir dizi yama tokeni haline getir.
- Verilen bir ViT için dizinin uzunluğu, parametrelerin sayımı ve FLOP'ları hesaplayın (batç boyutu, çözünürlük, gizli soluk, derinlik).
- ViT'yi 2020 araştırmasından 2026 üretimine götüren üç yükseltmenin adını verin: kendi başına denetim altına alınmış önceden eğitim (DINO / MAE), kayıt simgelerinin ve yerel çözünürlüklü paketlemenin.
- CLS birleştirme, ortalama birleştirme ve aşağı akıntılı bir görev için simgeler kaydetme arasında seçim yapın.

## Sorun

Transformatörler vektörlerin dizisinde çalışır. Metin zaten bir dizisidir (bayt veya jetonlar). Bir görüntü üç renk kanalı olan piksellerin 2 boyutlu bir şebekesi  bir dizis değildir. Her pikselini düzeltirseniz, 224x224 RGB görüntüsü 150.528 jeton olur ve bu uzunlukta kendine dikkat etmektir.

2020'ye kadar yaklaşımlar CNN özellik çıkarıcısını ön tarafta boğulmuştur: ResNet, 2048 boyutlu vektörlerin 7x7 özellik haritasını üretir, bu 49 tokeni bir transformatöre besler. Bu çalışır ancak CNN'in önyargılarını miras alır (çevirim eşdeğerliği, yerel kabul alanları) ve transformatörün ölçek açlığını kaybeder.

Dosovitskiy et al. (2020) net bir soru sordu: CNN'i atlasak ne olur? Resimi sabit boyutlu yamalara (örneğin 16x16 piksel) ayırın, her yamayı bir vektöre doğrusal olarak yansıtın, bir pozisyonal yerleştirme ekleyin ve dizini bir vanilya transformatörüne besleyin. O zamanlar bu, sarsılmaz bir görme biçimidir. Yeterince veriyle (JFT-300M, sonra LAION) ResNet'i ImageNet'te yendi ve gelişmeye devam etti.

2026 yılına kadar ViT primitif sorgulanmayan bir temel haline geldi. Her açık ağırlıklı VLM'nin görme kulesi bir soylu (DINOv2, SigLIP 2, CLIP, EVA, InternViT) oldu.

## Anlaşım

### Token olarak yamalar

Bir görüntü verildiğinde `x`şekli ile`(H, W, 3)`ve bir yama boyutu `P`, resmini bir şebekeye kazıyorsan`(H/P) x (W/P)`Dönüşmeyen yamalar.`P x P x 3`Bir küp piksel. Her küpeyi bir `3 P^2`Vectör. Paylaşılan bir çizgi projeksiyonu uygulayın `W_E`şekli ile`(3 P^2, D)`Her yama modelin gizli boyutuna yerleştirmek için.`D`- Evet .

ViT-B/16 kanonik yapılandırması için:
- Resolüt 224, patch boyutu 16 → grid 14x14 → 196 patch tokenleri.
- Her yama `16 x 16 x 3 = 768`Piksel değerleri, `D = 768`- Evet .
- Öğrenilenebilir bir ekle `[CLS]`token → dizinin uzunluğu 197.

Patch projesi , matematik açısından çekirdek boyutlu 2 boyutlu bir konvulsyonla aynıdır .`P`, adım at `P`ve`D`Bu, üretim kodunun aslında bunu uyguladığı bir yöntem.`nn.Conv2d(3, D, kernel_size=P, stride=P)`"Linear proje" çerçevesinin kavramsal olması; çekirdeğin çerçevesinin verimli olması.

### Konum yerleşimleri

Çizgilemeler iç içerikli bir sırayla değildir. Transformatör onları bir torba olarak görür. İlk ViTs, öğrenilebilir bir 1D pozisyonsal yerleşim ekledi (her pozisyonda bir 768-dim vektör, 197'si). Çalışır, ancak modeli eğitim çözünürlüğüne bağlar: sonuç olarak, şebekeni değiştirirseniz pozisyon tablosunu interpolasyonlamanız gerekir.

Modern görme omurgası 2D-RoPE (Qwen2-VL'nin M-RoPE, SigLIP 2'nin varsayılan) veya faktörlü 2D konumları kullanır. 2D-RoPE, sorgu ve anahtar vektörlerini yama (sır, sütun) endeksine göre döndürür, bu nedenle model dönüm açısından nispeten 2D konumunu çıkarır.

### CLS tokenleri, toplu çıkış ve kayıt tokenleri

Resim seviyesinde temsil nedir? Üç seçenek bir arada var:

1. `[CLS]`Token. Patch dizisine bir öğrenilebilir vektör hazırlayın. Tüm transformatör bloklarından sonra, CLS token'in gizli durumu görüntü temsilidir. BERT'den miras alınmıştır.
2. Ortalama bir havuz, patch tokenlerinin çıkışının ortalama gizli durumları SigLIP, DINOv2 ve çoğu modern VLM'de kullanılır.
3. Darcet ve diğerleri (2023) açık bir sink token olmadan eğitilmiş ViTs'lerin kendi dikkatini kaçırmak için yüksek normlu "artifak" yamalar geliştirdiklerini gözlemledi. 416 öğrenilebilir kayıt tokenlerini eklemek bu yükü absorbe eder ve yoğun tahmin kalitesini (seğimlendirme, derinlik) iyileştirir. DINOv2 ve SigLIP 2 her ikisi de kayıtlarla birlikte gemi.

Seçim aşağıdaki görevler için önemlidir. CLS sınıflandırma için iyidir. LLM'ye patch tokenlerini besleyen VLM'ler için, tümüyle birleştirmeyi atlatırsınız.

### Ön eğitim: denetlenmiş, kontrastlı, maskeli, kendi kendine distillenmiş

2020 ViT, JFT-300M üzerinde denetimli sınıflandırma ile önceden eğitildi.

- CLIP (2021): 400M çiftler üzerinde kontrastlı görüntü-metin.
- MAE (2021, He et al.): %75 parşömen maske, piksel yeniden yapılandırma.
- DINO (2021) / DINOv2 (2023): öğrenci-öğretmen ile kendi kendine destilasyon, etiketler, başlıklar yok. 2023 DINOv2 ViT-g/14 en güçlü tamamen görsel omurgan ve "sıkı özellikler" kullanım durumları için varsayılan.
- SigLIP / SigLIP 2 (2023, 2025): Sigmoid kaybı ile CLIP ve doğuştan görünüm oranı için NaFlex. 2026'da baskın görme kulesi açık VLM'ler (Qwen, Idefics2, LLaVA-OneVision).

Ön eğitim seçeneğiniz omurganın ne için iyi olduğunu belirler: semantik metin ile eşleşme için CLIP/SigLIP, yoğun görsel özellikler için DINOv2, aşağıdaki ince ayarlama için başlangıç noktası olarak MAE.

### Ölçekleme yasaları

ViT ölçeklendirme (Zhai et al. 2022) bir ViT'nin kalitesi model boyutunda, veri boyutunda ve hesaplama konusunda öngörülebilir yasalara uyduğunu ortaya koydu.
- Daha büyük model + daha fazla veri → daha iyi kalite.
- Patch boyutu, dizinin uzunluğuna karşı sadakatle ilgili bir kaldıraçtır. Patch 14 (DINOv2/SigLIP SO400m için tipik) bir görüntü başına 16 patch'tan daha fazla token verir; OCR ve yoğun görevler için daha iyi, hız için daha kötüdür.
- Resolüt diğer büyük kaldıraç. 224'ten 384'e 512'e gitmek neredeyse her zaman yardımcı olur, FLOP'lerde kare maliyetinde.

ViT-g/14 (1B param, patch 14, çözünürlük 224 → 256 token) ve SigLIP SO400m/14 (400M param, patch 14) 2026 açık VLM'ler için iki iş atı kodlayıcılarıdır.

### Bir ViT için parametre sayısı

Tam hesaplamalar `code/main.py`- ViT-B/16 için 224'te:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Kontrol noktasını yüklemeden önce her ViT'yi bu şekilde park et.

### 2026 üretim düzenlemesi

2026 yılında en açık VLM'lerin gemisi olan kodlayıcı, siglip 2 SO400m/14 olarak yerleşik çözünürlükte (naflex) kullanılmıştır.
- 400M parametreleri.
- Patch boyutu 14, varsayılan çözünürlük 384 → 729 patch token/resim.
- Resim düzeyinde görevler için ortalama havuz; VQA için LLM'ye tüm 729 yama akıyor.
- 4 kayıt simgesi, LLM tesliminden önce atıldı.
- 2D-RoPE, doğal boyut oranı için görüntü seviyesinde ölçeklendirme ile.

Bu konfigürasyonda her karar okuyabileceğiniz bir kağıttan kaynaklanıyor.

```figure
image-patch-tokens
```

## Kullan

`code/main.py`Bu bir patch tokenizer ve geometri hesaplayıcı.

- Çelişki şekli ve sekans uzunluğu, çitlenmeden sonra.
- Sintez 8x8 piksel oyuncak görüntüsü için simge dizisi (sırın + proje yolu boyunca yürüyün).
- Parametre sayısı, yama gömülmesi, pozisyon gömülmesi, transformatör blokları ve başla ayrılmış.
- Hedef çözünürlüğünde ileri geçiş başına FLOPs.
- ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384 arasındaki karşılaştırma tablosu.

Parametre sayısını yayınlanan sayılarla eşleştirin.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-patch-geometry-reader.md`. ViT yapılandırmasını (patch boyutu, çözünürlük, gizli soluk, derinlik) vererek, bir token sayısını, parametre sayısını ve VRAM tahminini haklı çıkarır.

## Egzersizler

1. Patch-token dizisi uzunluğunu, 14 patch boyutu ile yerel 1280x720 girişinde Qwen2.5 VL için hesaplayın. Bu sadece CLS temsiline nasıl karşılaştırılır?

2. Patch 14'te 1080p (1920x1080) bir çerçeve kaç tane token üretiyor? 5 dakikalık bir video üzerinde 30 FPS'de toplam kaç görsel token üretiyor? Hangi maliyet en çok tasarruf ediyor: birleştirme, çerçeve örneklemesi veya token birleşimi?

3. DINOv2 çıkışının 196'dan fazla tokenin ortalama toplamının modelin değerine uygun olduğunu kontrol edin.`forward`Birleştirilmiş yerleştirme istediğinizde geri gelir.

4. "Vision Transformers Need Registers" (arXiv:2309.16588) kitabının 3. bölümünü okuyun.

5. Değiştir `code/main.py`Parçalanma paketini desteklemek için: farklı çözünürlüklü görüntülerin bir listesini verdiğinizde, tek bir paketlenmiş dizini ve blok diyagonal dikkat maskesini oluşturun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Patch | "16x16 pixel square" | A fixed-size non-overlapping region of the input image; becomes one token |
| Patch embedding | "Linear projection" | A shared learned matrix (or Conv2d with stride=P) mapping flattened patch pixels to D-dim vectors |
| CLS token | "Class token" | Prepended learnable vector whose final hidden state represents the whole image; optional in 2026 |
| Register token | "Sink token" | Extra learnable tokens that absorb the high-norm attention artifacts ViTs develop during pretraining |
| Position embedding | "Positional info" | Per-position vector or rotation making the sequence-order-aware; 2D-RoPE is the modern default |
| Grid | "Patch grid" | The (H/P) x (W/P) 2D array of patches for a given resolution and patch size |
| NaFlex | "Native flexible resolution" | SigLIP 2 feature: single model serves multiple aspect ratios and resolutions without retraining |
| Backbone | "Vision tower" | The pretrained image encoder whose patch-token outputs feed the LLM in a VLM |
| Pooling | "Image-level summary" | Strategy to turn patch tokens into one vector: CLS, mean, attention pool, or register-based |
| Patch 14 vs 16 | "Finer vs coarser grid" | Patch 14 produces more tokens per image, better fidelity for OCR, slower; patch 16 is the classic default |

## Daha Fazla Okumak

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) orijinal ViT.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) MAE, kendi kendine denetimli bir eğitim öncesi eğitim.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) Ölçüsel kendiliğinden distillasyon, etiket yok.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) kayıt simgeler ve eser analizleri.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) 2026'da standart görme kulesi.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) Empirik ölçekleme yasaları.
