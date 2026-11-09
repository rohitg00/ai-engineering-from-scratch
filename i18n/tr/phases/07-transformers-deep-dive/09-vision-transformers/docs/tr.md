# Görme Transformerleri (ViT)

> Bir resim bir yama şebekesi, bir cümle bir simge şebekesi, aynı transformatör her ikisini de yiyor.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## Sorun

2020'den önce bilgisayar görme dönüşümleri anlamına geliyordu. ImageNet'teki her SOTA, COCO ve tespit referansları CNN'in omurgasını kullanıyordu. Transformerler dil içinydi.

Dosovitskiy et al. (2020)  "Bir Resim 16x16 Kelimaya Değer"  gösterdi ki, dönüşümleri tamamen bırakabilirsiniz. Bir resimi sabit boyutlu yamalara kesin, her yamayı bir gömleğe lineer olarak projekte edin, dizini bir vanilya transformatör kodleyicisine besleyin. Yeterli ölçekte (ImageNet-21k öncesi eğitim veya daha büyük), ViT ResNet tabanlı modellerle eşleşiyor veya yener.

ViT 2026'da daha geniş bir modelin başlangıcıydı: tek bir mimarlık, birçok modaliteler. Sıfırlatmak ses simgelendirir. ViT görüntü simgelendirir. Robotik için eylem simgeleri. Video için piksel simgeleri. Transformatör umurunda değil  ona bir dizi besler ve öğrenir.

2026 yılına kadar, ViT ve soyundan gelenleri (DeiT, Swin, DINOv2, ViT-22B, SAM 3) görselliğin büyük kısmına sahip. CNN'ler hala kenar cihazlar ve gecikme hassas görevlerde kazanır.

## Anlaşım

![Image → patches → tokens → transformer](../assets/vit.svg)

### Adım 1  Yapıştır

A bölün .`H × W × C`bir görüntüye dönüştürülür.`N × (P·P·C)`Düzlemli yamalar sırası.`224 × 224`görüntü, `16 × 16`patches → 196 patches, her biri 768 değer.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

Patch boyutu kaldıraçtır. Küçük patches = daha fazla token, daha iyi çözünürlük, kare dikkat maliyeti. Büyük patches = daha kaba, daha ucuz.

### Adım 2  Düzsel yerleştirme

Tek öğrenilen bir matris , her düz yamacı `d_model`. Yükleme büyüklüğü bir kıvrımla eşdeğer `P`ve adım at `P`PyTorch ' da bu kelimenin tam anlamıyla`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` 2 satırlı bir uygulama.

### Adım 3  hazırlık `[CLS]`Token, pozisyonsal yerleşim ekle

- Öğrenilenecek bir şey hazırla .`[CLS]`Son gizli durum, sınıflandırma için kullanılan görüntü temsilidir.
- Öğrenilebilir pozisyonsal yerleşimler (ViT-orjinal) veya sinusoidal 2D (sonraki çeşitler) eklenir.
- 2024+ RoPE pozisyon için 2D'ye genişletildi, bazen açıkça yerleştirilmeden.

### Adım 4  Standart transformer kodlayıcı

L blokları yığılsın`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`- BERT'ye benzer. Görüş özel katman yok. Bu makaleyin pedagojik çizgisi.

### Adım 5  baş

Sınıflandırma için: alın `[CLS]`Gizli durum → doğrusal → yumuşak maksimum.`[CLS]`, patch yerleştirmelerini doğrudan kullanın.

### Önemli olan çeşitler

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### Neden biraz zaman aldı?

ViT, CNN'e eşleşmek için *çok sayıda* veriye ihtiyaç duyar çünkü CNN'in induktif önyargıları (çevirim değişikliği, yerleşim) yoktur. > 100M etiketli görüntü veya güçlü kendiliğinden denetimli önceden eğitim olmadan, CNN'ler hala eşleşen hesaplamalarda kazanır. DeiT bunu 2021'de destilasyon hileleriyle düzeltti; DINOv2 bunu 2023'te kendiliğinden denetimle kalıcı olarak düzeltti.

```figure
n5-patch-stream
```

## Yapın

Bakın .`code/main.py`- Pure-stdlib patchify + linear yerleştirme + akıl sağlığı kontrolü.

### Adım 1: Sahte görüntü

24 × 24 RGB görüntü , `(R, G, B)`6×6 patches → 16 patches, her biri 108D gömleyici vektör kullanıyoruz.

### Adım 2: Yapıştır

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

Raster sıralaması: ağ üzerinde büyük satır.

### Adım 3: Düzsel yerleştirme

Her düz parçanı rastgele çarpın .`(patch_flat_size, d_model)`Çıktı biçiminin doğru olduğunu kontrol edin.`(N_patches + 1, d_model)`Önceden `[CLS]`- Evet .

### Adım 4: Gerçekçi bir ViT için sayım parametreleri

ViT-Base için parametre sayısını basın: 12 katman, 12 baş, d = 768, yama = 16. ResNet-50 (~ 25M) ile karşılaştırın. ViT-Base ~ 86M'ye ulaşır. ViT-Large ~ 307M. ViT-Huge ~ 632M.

## Kullan

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings are the 2026 default for image features.**Meta'nın DINOv2 kontrol noktaları, metin dışı görme görevleri için CLIP'den daha iyi performans gösteriyor.

**Patch-size picking.**Küçük modeller 16×16 (ViT-B/16) kullanır. Sıklık öngörü (segmentasyon) 8×8 veya 14×14 (SAM, DINOv2) kullanır. Çok büyük modeller 14×14 kullanır.

## Gönder

Bakın .`outputs/skill-vit-configurator.md`. Bilgi kümesi boyutu, çözünürlük ve hesaplama bütçesi göz önüne alındığında, yeni bir görme görevi için ViT varianti ve patch boyutu seçilir.

## Egzersizler

1. **Easy.**Çık .`code/main.py`- Patch sayısını kontrol edin .`(H/P) * (W/P)`ve düz yama boyutu eşit `P*P*C`- Evet .
2. **Medium.**2D sinusoidal pozisyon yerleşimleri uygulayın  iki bağımsız sinusoidal kod için `row`ve `col`Her yama, zincirlenmiş. Onları küçük bir PyTorch ViT'ye besleyin ve CIFAR-10'da doğrulık ile öğrenilebilir konum yerleşimlerini karşılaştırın.
3. **Hard.**3 katmanlı bir ViT (PyTorch) oluşturun, 4×4 yamalarla 1000 MNIST görüntüde çalıştırın. Test doğruluğunu ölçün. Şimdi aynı 1.000 görüntüde DINOv2 önceden çalıştırmayı ekleyin (sederleştirilmiş: sadece kodlayıcıyı maskeli yamalardan yama yerleştirmelerini tahmin etmek için çalıştırın).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## Daha Fazla Okumak

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929)- ViT kağıdı.
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877)- Dönüşüm.
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030)- Swin.
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193)DINOv2.
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588)DINOv2 için kayıt simgesi ayarlaması.
