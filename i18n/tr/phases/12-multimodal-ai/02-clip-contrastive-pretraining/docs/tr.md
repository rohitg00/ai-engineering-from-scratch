# CLIP ve Kontrast Görüş Dilü Eğitimleri

> OpenAI'nin CLIP (2021) projesi, önümüzdeki beş yıl boyunca güç sağlayacak kadar büyük bir fikir olduğunu kanıtladı: Sadece gürültülü web görüntü başlık çiftlerini kullanarak bir görüntü kodleyicisi ve bir metin kodleyicisini aynı vektör alanına doğru birleştirmek ve kontrast kaybı. - Null denetim etiketi. 400 milyon çift. Sonuçta yerleştirme alanı sıfır çekim sınıflandırma, görüntü metni kurtarma ve görme kule olarak her 2026 VLM'ye bağlanır. SigLIP 2 (2025) softmax' ı sigmoid ile değiştirdi ve daha düşük maliyetle CLIP' i geçti. Bu ders, InfoNCE'den sigmoid çiftlik kaybına kadar matematik yürür ve stdlib Python'da eğitim adımını inşa eder.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Karşılıklı bilgi ile InfoNCE kaybını çıkarın ve sayısal olarak sabit vektörlü bir sürüm uygulayın.
- Sigmoid çiftlik kaybının (SigLIP) toplam üst maliyetli softmax talepleri olmadan 32768+ partiye neden ölçeğini açıklayın.
- Metin şablonları oluşturarak sıfır çekim ImageNet sınıflandırmasını çalıştır (`a photo of a {class}`) ve argmax' ı cosine benzerliği yerine alıyor.
- CLIP / SigLIP öncesi eğitiminin size verdiği dört kaldırağı isimlendirin: parti boyutu, sıcaklık, istek şablonu, veri kalitesi.

## Sorun

Pre-CLIP vizyonu denetlendi. Etiketlenmiş veri kümelerini toplayın (ImageNet: 1.2M görüntüler, 1000 sınıf), bir CNN'yi eğitiniz, gönderin. Etiketler pahalı, etiketler etiketlercilerin anlaşabildiği şeylere kaygı duyulur ve etiketler ince ayarlama olmadan yeni görevlere aktarılmaz.

Resim başlıklı web, bir milyardan fazla serbest etiketli çiftleri ücretsiz olarak içerir. Alt metinde "köpeğim Max parkta" yazılı bir altın retriever resmi bir denetim sinyali taşır.

CLIP'in cevabı: Resim-başlık çiftlerini eşleştirme görevi olarak ele alın. N resim ve N başlıklı bir parti verildiğinde, N-1 dikkat dağıtıcılarına karşı her resmini kendi başlıklarına eşleştirmeyi öğrenin. Gözetim "bu iki şey bir araya gelmektedir; bu N-1 yapmaz".

Sonuçta yerleştirme alanı CLIP'in eğitilmesinden daha fazlasını yapar. ImageNet sıfır çekim çalışmaktadır çünkü "bir kedinin fotoğrafı" açıkça kedilerle etiketlenmemiş kedilerin resimlerinin yanına yerleştirilmiştir.

## Anlaşım

### Çift kodlayıcı

CLIP'in iki kulesi var:

- Resim kodlayıcı`f`: ViT veya ResNet, görüntü başına bir D-dim vektörü çıkarır.
- Metin kodlayıcı`g`: küçük transformatör, başlık başına bir D-dim vektörü çıkarır.

İki kule de çıkışlarını birim uzunluğuna normalleştirir.`cos(f(x), g(y)) = f(x)^T g(y)`Her ikisi de birim normudur.

Bir parti için .$N$(resim, başlık) çiftler, benzerlik matrisi oluşturun `S`şekli ile`(N, N)`- ...

```math
S[i, j] = \cos(f(x_i), g(y_j)) / \tau
```

nerede`tau`öğrenilen bir sıcaklık (CLIP 0.07 olarak initializes; log- uzayda öğrenilen).

### InfoNCE Kayıpları

CLIP, satır ve sütunlar üzerinde simetrik çapraz entropi kullanır:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

Bu InfoNCE. CE'deki yumuşak maksimum, her resmin batch'taki diğer tüm başlıklardan daha fazla başlıklarına uymasını zorlar. "Negatifler" diğer tüm batch öğeleri. Büyük batchlar = daha fazla negatif = daha güçlü sinyal. CLIP 32k batch'ta eğitilmiştir; ölçek önemlidir.

### Temperatür

`tau`yumuşaklık maksimum keskinliğini kontrol eder.$\tau$→ keskin dağılım, sert negatif madencilik etkisi.$\tau$→ yumuşak, tüm örnekler katkıda bulunur. CLIP öğrenir $\log(1/\tau)$SigLIP 2 başlangıçta olanları düzeltir.$\tau$Ve bunun yerine öğrenilmiş bir önyargıyı kullanıyor.

### Sigmoid neden daha iyi ölçekler (SigLIP)

Softmax bütün benzerlik matrisini senkronize ederek kullanır. dağıtılmış eğitimde her gömleği her kopyasına toplayıp sonra softmax yapmalısınız.

SigLIP softmax ' i elementli sigmoid ile değiştirir: her çift için `(i, j)`, kaybı "bu eşleşen çift mi?" ikili sınıf sınıflandırmasıdır.

```math
L = -\frac{1}{N} \sum_{(i, j)} \Big[ y_{ij} \log \mathop{\mathrm{sigmoid}}(S[i,j]) + (1-y_{ij}) \log \mathop{\mathrm{sigmoid}}(-S[i,j]) \Big]
```

`y_ij = 1`Eğer`i == j`Her GPU'nun yerel blok ve toplamlarını hesaplaması gerekir. SigLIP 2 32k-512k'lık bir seri olarak ucuz bir şekilde ölçebilir. CLIP'in nispeten daha fazla iletişim gerekecektir.

### sıfır atış sınıflandırması

N sınıf adları verildiğinde, her sınıf için bir metin şablonu oluşturun:

```
"a photo of a {class}"
```

Her şablonun metin kodlayıcıyla yerleştirilmesi. Resminizi resim kodlayıcıyla yerleştirin. Argmax cosine benzerliği = tahmin sınıfı. Hedef sınıfları üzerinde eğitim yok.

Hızlı şablonlar önemlidir. CLIP'in orijinal kağıdı sınıf başına 80 şablon kullanıyordu (sırın, sanatsal, fotoğraf, resim vb.) ve yerleşimleri ortalama olarak ölçüyordu. +3 ImageNet puanları. Modern kullanım tipik olarak bir veya iki şablon seçer.

### Düzsel araştırma ve ince ayarlama

ZERO-shot bir temel çizgidir. Bir çizgi zond (ziyaret sınıflarınız için dondurulmuş CLIP özelliklerinin üzerine bir çizgi katmanı hazırlayın) alan içindeki görevlerde sıfır çekimi yener. Tam ince ayarlama alan içindeki çizgi zondayı yener ancak sıfır çekim transferini etkileyebilir. Üç değişikliğe sahip üç rejim.

### SigLIP 2: NaFlex ve yoğun özellikler

SigLIP 2 (2025) şunları ekliyor:
- NaFlex: tek model değişken boyut oranlarını ve çözünürlüklerini ele alır.
- Segmanlama ve derinlik tahminleri için daha iyi yoğun özellikler, VLM'lerde donmuş omurgan olarak kullanımı hedeflemiştir.
- Çok dilli: CLIP'nin sadece İngilizce olduğu 100'den fazla dilde eğitim görmüştür.
- 1B param ölçeğinde CLIP 400M'de en üst düzeye çıktı.

2026 açık VLM'lerde, SigLIP 2 SO400m/14 varsayılan görme kulesi olarak kalır. CLIP, belirli LAION-2B eğitim dağılımının sorgu örneğinize eşleştiği saf görüntü metin kurtarma için varsayılan olarak kalır.

### ALIGN, BASIC, OpenCLIP, EVA-CLIP

ALIGN (Google, 2021): CLIP ile aynı fikir, 1.8B çift ölçek, 90% gürültülü. Sıkı gürültülü veri ölçekleri kanıtlanmıştır. OpenCLIP (LAION): CLIP'in açık yeniden üretimi LAION-400M / 2B, birden fazla ölçek, açılış kontrol noktası. EVA-CLIP: maskeli görüntü modelleme ile başlatır; VLM'ler için güçlü omurgan. BASIC: Google'ın CLIP+ALIGN hibrid. Hepsi aynı aile, farklı veriler ve ayarlama.

### - Çatı sıfır çekim

CLIP sınıfı modeller, ImageNet sıfır çekiminin (CLIP-G, OpenCLIP-G) yaklaşık %76'sini kaplıyor. Bunun ötesinde çok daha büyük veri (SigLIP 2 %80'e ulaşır) veya mimari değişiklikleri (genergeleştirilmiş başlar, daha fazla parametreler) gerekmektedir.

```figure
multimodal-fusion
```

## Kullan

`code/main.py`Uygulamaları:

1. Oyuncak çift kodlayıcı (hash tabanlı görüntü özellikleri, metin grafik özellikleri) böylece InfoNCE şeklini numpy olmadan görebilirsiniz.
2. Saf Python'da InfoNCE kaybı (log-sum-exp yoluyla sayısal istikrar).
3. Karşılaştırma için Sigmoid çiftlik kaybı.
4. sıfır çekim sınıflandırma rutin: bir dizi metin isteklerine karşı kosinus benzerliğini hesaplayın, tahmin için argmax.

Bu sayılar oyuncak, şekli gerçek bir CLIP eğitmeninin yaydığı ile eşleşir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-clip-zero-shot.md`. Bir görüntü kümesi (yol yoluyla) ve hedef sınıflar listesini göz önüne alarak, CLIP şablonu ile metin isteklerini oluşturur, her iki tarafı belirtilen bir kontrol noktasıyla yerleştirir (örneğin, `openai/clip-vit-large-patch14`), ve benzerlik puanları ile ilk-1 / ilk-5 tahminlerini gönderir.

## Egzersizler

1. 4 çiftli bir parti için InfoNCE'yi el ile uygulayın. 4x4 benzerlik matrisini oluşturun, softmax çalıştırın, diyagonalı seçin, çapraz entropi hesaplayın. Python uygulamasını bu el hesaplama ile doğrulayın.

2. SigLIP bir önyargı parametre kullanır `b`sıcaklıktan başka: `S'[i,j] = S[i,j]/tau + b`- Ne rolü var ?`b`Bir seri için olumlulardan çok olumsuz olan büyük bir sınıf dengesizliği olduğunda oynayın. SigLIP Bölümü 3'ü okuyun (arXiv:2303.15343).

3. Kediler ve köpekler için sıfır atış sınıflandırıcısı oluşturun.`a photo of a {class}`ve `a picture of a {class}`Test görüntülerinin 100'ü üzerinde doğruluğu ölçün. Şablonların ansamblının tek bir çarpması var mı?

4. 512-GPU çalıştırma için softmax InfoNCE vs sigmoid iletişim maliyetini 32k partide çift olarak hesaplayın.$O(N)$, ki bu $O(N^2)$Siglip Bölüm 4'ü alın.

5. OpenCLIP ölçekleme yasaları kağıdını okuyun (arXiv:2212.07143, Cherti et al.). Verilerin ölçeklenmesi için sonuçlarını rakamlardan üretin: sabit model boyutunda, ImageNet sıfır çekim doğruluğu ile eğitim verileri boyutu arasındaki log-lineer ilişki nedir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | Cross-entropy over a batch's similarity matrix; each item's positive is its paired item, negatives are everything else |
| Sigmoid loss | "SigLIP loss" | Per-pair binary cross-entropy; no softmax, no all-gather, scales cheaply in distributed training |
| Temperature | "tau" | Scalar that scales logits before softmax/sigmoid; controls sharpness of the distribution |
| Zero-shot | "no-finetune classification" | Use text prompts to construct class embeddings and classify by cosine similarity; no training on target classes |
| Prompt template | "a photo of a ..." | Text scaffold around a class name; affects zero-shot accuracy by 1-5 points |
| Dual encoder | "Two-tower" | One image encoder + one text encoder, outputs in shared D-dim space |
| Hard negative | "Tough distractor" | A negative similar enough to the positive that the model has to work to separate them |
| Linear probe | "Frozen + one layer" | Train only a linear classifier on top of frozen features; measures feature quality |
| NaFlex | "Native flexible resolution" | SigLIP 2 capability to ingest images at any aspect ratio and resolution without resizing |
| Temperature scaling | "log-parametrized tau" | CLIP parametrizes `log(1/tau)` so gradients behave; clips to prevent collapse to near-zero tau |

## Daha Fazla Okumak

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020)- CLIP kağıdı.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343)Siglip.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) çok dilli + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) gürültülü web verileri ile ölçeklendirme.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) OpenCLIP ölçekleme yasaları.
