# Transfüzyon: Autoregressive Text + Diffusion Image in One Transformer

> Chameleon ve Emu3 her şeyi ayrı tokenlere bahse girdiler. Çalışırlar, ancak kuantitasyon boğazı görünür  Sürekli uzay yayılma modelleri altında görüntü kalitesi platoları. Transfüzyon (Meta, Zhou ve diğerleri, Ağustos 2024) tam ters bahis yapar: görüntüleri sürekli tutun, VQ-VAE'yi tamamen düşürün ve iki kayıpla bir transformatörü eğitiniz. Metin tokenleri bir sonraki token tahminini alır. Görüntü patchleri akış eşleşimi / difüzyon kaybı elde eder. Her iki hedef de aynı ağırlıkları optimize eder. Stable Diffusion 3 (MMDiT) altında yatan mimarlık yakın bir kuzenidir. Bu ders Transfusion tezini okuyor, oyuncak iki kaybı eğitimi yapan bir oyuncak inşa ediyor ve bir transformatörün her iki işi de yapmasına izin veren dikkat maskesini izliyor.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Tek omurgasına iki kayıp (metin jetonlarında NTP, görüntü yamalarında difüsiyon MSE) yapan bir transformatörü telleştirin.
- Resim yamaları arasındaki iki yönlü dikkatin ve metin işaretleri üzerinde nedenlik dikkatin neden doğru maske seçeneği olduğunu açıklayın.
- Transfusion tarzı (daima görüntüler, difüzyon kaybı) ile Chameleon tarzı (diskret görüntüler, NTP) hesaplama, kalite ve kod karmaşıklığı ile karşılaştırın.
- MMDiT'nin katkılarını belirtin: her blokta modalite spesifik ağırlıklar, kalan akımdaki ortak dikkat.

## Sorun

Diskret vs. Sürekli görüntü belirtileri tartışması LLM'lerden daha eski. Sürekli temsiller (çık pikseller, VAE latenları) ayrıntıları korur. Diskret belirtiler (VQ indeksleri) transformatörün yerel sözlüklerine uyar ancak kuantitasyon aşamasında ayrıntıları kaybeder.

Chameleon / Emu3 ayrılığa girdi: bir kayıp, bir mimarlık, ancak görüntü sadakati tokenizer kalitesi ile sınırlandı.

Diffusion modelleri sürekli devam etti: olağanüstü görüntü kalitesi, ancak LLM'den ayrı bir model, karmaşık gürültü programı mühendisliği ve metin üretimi ile temiz bir entegrasyon yoktu.

Transfüzyon soruyor: İkisini de alabilir miyiz? Resimleri sürekli tut, bir model eğit, iki kayıpı bir gradient adımına dikişleyerek kullan.

## Anlaşım

### İki kayıp mimarisi

Tek bir dekoderli transformatör, içeren bir dizini işliyor:

- Metin işaretleri (BPE sözcükten ayrıntılı).
- Resim yamaları (doğru, 16x16 piksel blokları bir ViT kodlayıcı girişinin aynı  lineer yerleştirme yoluyla gizli sönük bir şekilde projelendi).
- `<image>`ve `</image>`Sürekli yamaların yaşadığı yerleri işaretleyen etiketler.

Ön geçiş bir kez geçer. Kayıp her token için iki baştan birini seçer:

- Metin işaretleri için: sözcük logit başındaki standart çapraz entropi.
- Resim yamaları için: Sürekli yamalardaki difüzyon kaybı  her yamalara eklenen gürültüyü tahmin eder.

Bu kayıplar, ortak ağırlıkları aynı anda iyileştirir.

### Dikkat maskası: sebepli metin + iki yönlü görüntü

Metin işaretleri nedensel olmalıdır. Bir metin işaretinin gelecekteki metine katılımını veya öğretmenlerin molaları zorlamasını yapmasına izin veremezsiniz.

Maske:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i)   # text attends to images that closed before it
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

Eğitim ve sonuçlama için blok üçgenli bir maske olarak uygulanır.

### Transformatörün içinde difüzyon kaybı

Düzünlük kaybı standarttır: bir görüntü yamağına gürültü ekleyin, modelden gürültüyü (veya temiz yama, eşdeğer olarak) tahmin etmesini isteyin. Transfüzyon'un versiyonu akış eşleşmesini kullanır  gürültüden temizliğe hız alanını tahmin edin.

Eğitim sırasında:
1. Her görüntü yama için $x_0$, rastgele bir zaman adımını örnekleyin .$t$- Evet .
2. Örnek gürültü$\epsilon$, hesaplama$x_t = (1-t) \cdot x_0 + t \cdot \epsilon$(çıkış eşleşimi için doğrusal interpolasyon).
3. Transformatör tahmin ediyor .$v_\theta(x_t, t)$- ...$\text{loss} = \mathop{\mathrm{MSE}}(v_\theta(x_t, t), \epsilon - x_0)$- Evet .
4. Tekst ile birlikte arka tarafa NTP kayıpları aynı diziden.

Sonuç olarak, nesil:
- Metin işaretleri: standart autoregressive örnekleme.
- Resim yamaları: önceki metin işaretlerine bağlı difüzyon örnekleme döngüsü (10-30 adım tipik).

### MMDiT: Stable Diffusion 3'ün varianti

Stable Diffusion 3 (Esser et al., Mart 2024) MMDiT (Multimodal Diffusion Transformer) ile Transfusion'un yaklaşık aynı zamanda gönderildi.

MMDiT'nin temel farklılıkları:

- Modallık-specifik ağırlıklar blok başına. Her transformatör bloku metin jetonları karşı görüntü yamaları için ayrı Q, K, V ve MLP ağırlıkları vardır. Dikkat ortak (çapraz modalik); diğer her şey modalik-specifiktir.
- DDPM'den daha basit bir matematik ve örnekleme ile ilgili özel bir akış uyarlama varianti.
- Skala. MMDiT SD3'in omurgasıdır (2B ve 8B param varianları).

Her ikisi de aynı temel fikir üzerinde birleşir: bir transformatör metinde NTP ve sürekli görüntü temsillerinde yayım yürütür.

### Neden bu, kameleon tarzını yendi?

Görüntü üretimi sırasında sürekli yayılma ve ayrı-ayrı NTP arasındaki kalite farkı ölçülebilir.

- 7B paramlarında, aynı boyutlu bir Cameleon tarzı modeli FID'de 3-5 puan geçiyor.
- Tokenizer eğitimi gerekmez  görüntü kodlayıcı daha basit (Sınırlı projeksiyon gizli, bir ViT'nin giriş katmanı ile aynı).
- Inferans, autoregressive görüntü belirtilerinin aksine, görüntü yama tanımlamasını paralelleştirebilir.

Eksik taraf: Transfüzyon ikili kayblı bir modeldir, bu da eğitim dinamiklerini daha zorlaştırır. Kayıp ağırlıkların ayarlanması gerekir. NTP ve difüzyon arasındaki zamanlama eşleşmezliği bir başın baskısına neden olabilir.

### Akıntıda oturanlar

Janus-Pro (Desin 12.15) Transfusion'un fikrini, Transfusion'un transforman vücudu paylaşırken bir tanesi için SigLIP, diğer tanesi için VQ'yi ayırarak ve anlayış ve jenerasyon için vizyon kodlayıcısını ayırarak geliştirir. Show-o (Desin 12.14) difüzyonu diskret difüzyon (maskeli tahmin) için değiştirir.

Yerel olarak görüntüler yayımlayan kapalı üretim modelleri bu ailenin bazı soylarını kullanabilir, ancak mimarlıkları yayınlanmamıştır, bu nedenle bu tür herhangi bir iddiayı bir tahmin olarak değerlendirin.

```figure
cfg-guidance-scale
```

## Kullan

`code/main.py`Küçük bir MNIST gibi bir soruya karşı oyuncak Transfusion inşa ediyor:

- Metin başlıkları, bir rakamı (0-9) tanımlayan kısa tam sayı dizisidir.
- Resimler 4x4 bayt ağları.
- Ortak ağırlıklı bir çift doğrusal projeksiyon, transformatörün yerine geçer; metinde NTP kaybı, gürültülü yamalarda MSE kaybı.
- Eğitim döngüsü iki kayıpı değiştirir, dikkat maskası açıkça.
- Bir maske demo, bir metin, görüntü, metin dizisi için blok üçgenli dikkat kalıbını yazdırır. Üretim çalıştırılmıyor: gerçek bir örneklemeci metin jetonunu jeton olarak çözür, ardından aşağıdaki egzersizlerin sayıldığı gibi, görüntü yamalarını birçok adım boyunca tanımlar.

İki kayıplı tesisat, dikkat maskası yapımı ve sonuç döngüsü gerçek eserlerdir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-two-loss-trainer-designer.md`Yeni bir multimodal eğitim görevi (metin + görüntü, metin + ses, metin + video) göz önüne alındığında, iki kayıp programını (kayıp ağırlıklar, maske şekli, paylaşılan vs. modalite özel bloklar) tasarlıyor ve uygulama risklerini işaretliyor.

## Egzersizler

1. Transfusion tarzındaki bir model, %70 metin jetonu ve %30 görüntü yamalarını eğitir.

2. Bir dizi için blok üçgenli maskeyi uygulayın: `[T, T, <image>, P, P, P, P, </image>, T]`Her giriş 0 veya 1 olarak işaretlenir.

3. MMDiT'de modalite-specifik QKV ağırlıkları var. Bu hangi parametreler sayımı üstü ekliyor vs Transfusion'un tam paylaşılan transformatörü? 7B parametrelerinde, buna değer mi?

4. Üretim: bir metin istek verildiğinde, model 50 token için NTP çalıştırır, sonra vurur `<image>`...denoise adımları üzerinde 256 yama üzerinde yayılma çalışır.

5. SD3 kağıdı bölüm 3. DDPM'den daha az sonuç aşamasında neden birleştiğini ve düzeltilmiş akışı açıkla.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Two-loss training | "NTP + diffusion" | A single transformer optimizes both cross-entropy on text tokens and MSE on continuous image patches in the same gradient step |
| Flow matching | "Rectified flow" | Diffusion variant that predicts a velocity field from noise to clean data; simpler math than DDPM |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3's architecture: joint attention, modality-specific MLPs and norms |
| Block-triangular mask | "Causal text + bidirectional image" | Attention mask that is causal across text but bidirectional within image regions |
| Continuous image representation | "No VQ" | Image patches as real-valued vectors, not integer codebook indices |
| Velocity prediction | "v-parameterization" | Network output is the velocity field between noise and data, not the noise itself |

## Daha Fazla Okumak

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
