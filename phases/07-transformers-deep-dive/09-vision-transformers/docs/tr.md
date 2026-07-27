# Vizyon Transformer'lar (ViT)

> Görüntü yamalardan oluşan bir ızgaradır. Bir cümle, token'lardan oluşan bir ızgaradır. Aynı transformer ikisini de yer.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 05 (Tam Transformer), Aşama 4 · 03 (CNN'ler), Aşama 4 · 14 (Vizyon Transformer'nin tanıtımı)
**Süre:** ~45 dakika

## Sorun

2020'den önce bilgisayarlı görme, evrişimler anlamına geliyordu. ImageNet, COCO ve tespit benchmark'deki her SOTA bir CNN omurgası kullanıyordu. Transformer'lar dil içindi.

Dosovitskiy ve ark. (2020) - "Bir Görüntü 16x16 Kelimeye Değerdir" - kıvrımları tamamen bırakabileceğinizi gösterdi. Bir görüntüyü sabit boyutlu yamalara dilimleyin, her yamayı doğrusal olarak bir embedding'ye yansıtın, diziyi bir vanilya transformer kodlayıcıya besleyin. Yeterli ölçekte (ImageNet-21k ön eğitim veya daha büyük), ViT, ResNet tabanlı modellerle eşleşir veya onları yener.

ViT, 2026'da daha geniş bir modelin başlangıcıydı: tek mimari, birçok yöntem. Fısıltı tokensesi güzelleştirir. ViT tokengörüntüleri boyutlandırır. Robotik için eylem token'ler. Video için piksel token'ler. transformer umursamıyor; onu bir sıra ile besleyin ve öğrensin.

2026 yılına gelindiğinde ViT ve onun soyundan gelenler (DeiT, Swin, DINOv2, ViT-22B, SAM 3) vizyonun büyük bir kısmına sahip olacak. CNN'ler uç cihazlarda ve gecikmeye duyarlı görevlerde hâlâ kazanıyor. Diğer her şeyin yığının bir yerinde bir ViT'si var.

## Konsept

![Resim → yamalar → tokens → transformer](../assets/vit.svg)

### Adım 1 — yamalama

Bir `H × W × C` görüntüsünü `N × (P·P·C)` düz yama dizisine bölün. Tipik kurulum: `224 × 224` görüntü, `16 × 16` yama → her biri 768 değerden oluşan 196 yama.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

Yama boyutu koldur. Daha küçük yamalar = daha fazla token, daha iyi çözünürlük, ikinci dereceden dikkat maliyeti. Daha büyük yamalar = daha kaba, daha ucuz.

### Adım 2 — doğrusal embedding

Tek bir öğrenilmiş matris, her düz yamayı `d_model`'ya yansıtır. Çekirdek boyutunun `P` ve adımın `P` evrişimine eşdeğerdir. PyTorch'ta bu tam anlamıyla `nn.Conv2d(C, d_model, kernel_size=P, stride=P)`'tır; 2 satırlı bir uygulamadır.

### Adım 3 — `[CLS]` token'nin başına ekleyin, konumsal embedding'ları ekleyin

- Öğrenilebilir bir `[CLS]` token'nin başına ekleyin. Nihai gizli durumu, sınıflandırma için kullanılan görüntü temsilidir.
- Öğrenilebilir konumsal embedding'ler (ViT-orijinal) veya sinüzoidal 2D (sonraki varyantlar) ekleyin.
- 2024+'te RoPE konum için 2B'ye genişletildi, bazen açık embedding'lar olmadan.

### Adım 4 — standart transformer kodlayıcı

`LayerNorm → Self-Attention → + → LayerNorm → MLP → +` L bloklarını yığın. BERT'e benzer. Görüşe özgü katmanlar yok. Bu makalenin pedagojik can alıcı noktasıdır.

### Adım 5 — kafa

Sınıflandırma için: `[CLS]` gizli durumu → doğrusal → softmax'ı alın. DINOv2 veya SAM için, `[CLS]`'yi atın, doğrudan embedding yamasını kullanın.

### Önemli olan değişkenler

| Model | Yıl | Değiştir |
|-------|------|--------|
| ViT | 2020 | Orijinal. Sabit yama boyutu, tam küresel ilgi. |
| DeiT | 2021 | Damıtma; yalnızca ImageNet-1k'de eğitilebilir. |
| Domuz | 2021 | Kaydırılmış pencerelerle hiyerarşik. Sabit ikinci dereceden maliyet. |
| DINOv2 | 2023 | Kendi kendini denetleyen (etiket yok). En iyi genel görüş özellikleri. |
| ViT-22B | 2023 | 22B parametreleri; ölçeklendirme yasaları geçerlidir. |
| SigLIP | 2023 | ViT + dil çifti, sigmoid karşılaştırmalı kayıp. |
| SAM3 | 2025 | Her şeyi bölümlere ayırın; ViT-Large + promptuygulanabilir maske kod çözücü. |

### Neden biraz zaman aldı?

ViT, CNN'lerle eşleşmek için *çok* veriye ihtiyaç duyar çünkü CNN'in tümevarımsal eğilimlerinin (çeviri değişmezliği, yerellik) hiçbirine sahip değildir. 100 milyondan fazla etiketli görüntü veya güçlü, kendi kendini denetleyen ön eğitim olmadan, CNN'ler eşleştirilmiş hesaplamada kazanmaya devam ediyor. DeiT bunu 2021'de damıtma hileleriyle düzeltti; DINOv2, 2023'te kendi kendini denetleyerek sorunu kalıcı olarak düzeltti.

## Build It — Kendin Oluştur

Bkz. `code/main.py`. Pure-stdlib patchify + doğrusal embedding + akıl sağlığı kontrolleri. Eğitim yok — Herhangi bir gerçekçi ölçekte ViT, PyTorch'a ve saatlerce GPU süresine ihtiyaç duyar.

### Adım 1: sahte resim

`(R, G, B)` dizisinden oluşan satırların listesi olarak 24 × 24 RGB görüntüsü. Her biri 108-d embedding vektör olan 6x6 yama → 16 yama kullanıyoruz.

### Adım 2: yama yapın

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

Raster sırası: ızgara boyunca ana satır. Her ViT bu sıralamayı kullanır.

### Adım 3: doğrusal yerleştirme

Her düz yamayı rastgele bir `(patch_flat_size, d_model)` matrisiyle çarpın. `[CLS]`'yi başına ekledikten sonra çıktı şeklinin `(N_patches + 1, d_model)` olduğunu doğrulayın.

### Adım 4: gerçekçi bir ViT için parametreleri sayın

ViT-Base için parametre sayısını yazdırın: 12 katman, 12 kafa, d=768, yama=16. ResNet-50 (~25M) ile karşılaştırın. ViT-Base ~86M'ye iniyor. ViT-Büyük ~307M. ViT-Kocaman ~632M.

## Use It — Uygula

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

**DINOv2 embedding'ler görüntü özellikleri için 2026 varsayılanıdır.** Omurgayı dondurun, minik bir kafayı eğitin. Sınıflandırma, erişim, tespit ve altyazı ekleme için çalışır. Meta'nın DINOv2 kontrol noktaları, metin dışı tüm görüş görevlerinde CLIP'ten daha iyi performans gösterir.

**Yama boyutunda toplama.** Küçük modellerde 16×16 (ViT-B/16) kullanılır. Yoğun tahmin (bölümleme) 8×8 veya 14×14 (SAM, DINOv2) kullanır. Çok büyük modellerde 14×14 kullanılır.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-vit-configurator.md`. Beceri, dataset boyutu, çözünürlüğü ve işlem bütçesi göz önüne alındığında yeni bir görme görevi için bir ViT çeşidi ve yama boyutu seçer.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın. Yama sayısının `(H/P) * (W/P)`'ye eşit olduğunu ve düz yama boyutunun `P*P*C`'ye eşit olduğunu doğrulayın.
2. **Orta.** 2B sinüzoidal konumsal embedding'leri uygulayın — her yamanın `row` ve `col` için birleştirilmiş iki bağımsız sinüzoidal kodu. Bunları küçük bir PyTorch ViT'ye besleyin ve CIFAR-10'da doğruluk ile öğrenilebilir konumsal embedding'leri karşılaştırın.
3. **Zor.** 3 katmanlı bir ViT (PyTorch) oluşturun, 4x4 yamalarla 1.000 MNIST görüntüsü üzerinde eğitim alın. Test doğruluğunu ölçün. Şimdi aynı 1.000 görüntüye DINOv2 ön eğitimini ekleyin (basitleştirilmiş: kodlayıcıyı yalnızca maskelenmiş yamalardan embedding yamalarını tahmin edecek şekilde eğitin). Doğruluk artıyor mu?

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Yama | "Vizyon-transformer token" | Görüntünün bir `P × P × C` bölgesi için piksel değerlerinin düz vektörü. |
| Düzeltme | "Doğra + düzleştir" | Görüntüyü örtüşmeyen parçalara bölün ve her birini bir vektöre göre düzleştirin. |
| `[CLS]` token | "Resim özeti" | Başına eklenen öğrenilebilir token; onun son embedding'si görüntü temsilidir. |
| Endüktif önyargı | "Modelin varsaydığı şey" | ViT'nin CNN'lerden daha az önceliği var; açığı kapatmak için daha fazla veriye ihtiyaç var. |
| DINOv2 | "Kendi kendini denetleyen ViT" | Görüntü büyütme + momentum öğretmeni kullanılarak etiketler olmadan eğitildi. 2026'nın en iyi genel görüntü özellikleri. |
| SigLIP | "CLIP'in halefi" | Sigmoid kontrast kaybıyla eğitilmiş ViT + metin kodlayıcı; eşleşen hesaplamada CLIP'ten daha iyi. |
| Domuz | "Pencereli ViT" | Yerel ilgi + kaydırılmış pencereler ile hiyerarşik ViT; ikinci dereceden. |
| token'ları kaydedin | "2023 numarası" | Dikkati çeken birkaç ekstra öğrenilebilir token; DINOv2 özelliklerini geliştirir. |

## Daha Fazla Okuma

- [Dosovitskiy ve ark. (2020). Bir Görüntü 16x16 Kelime Değerindedir: Ölçekli Görüntü Tanıma için Transformers](https://arxiv.org/abs/2010.11929) — ViT makalesi.
- [Touvron ve ark. (2021). Veri açısından verimli görüntü transformer'ler ve dikkat yoluyla damıtma eğitimi](https://arxiv.org/abs/2012.12877) — DeiT.
- [Liu ve ark. (2021). Swin Transformer: Değiştirilmiş Pencereler kullanan Hiyerarşik Vizyon Transformer](https://arxiv.org/abs/2103.14030) — Swin.
- [Oquab ve ark. (2023). DINOv2: Sağlam Görsel Özellikleri Denetim Olmadan Öğrenmek](https://arxiv.org/abs/2304.07193) — DINOv2.
- [Darcet ve ark. (2023). Vizyon Transformer'nin Kayıtlara İhtiyacı Var](https://arxiv.org/abs/2309.16588) — DINOv2 için kayıt-token düzeltmesi.
