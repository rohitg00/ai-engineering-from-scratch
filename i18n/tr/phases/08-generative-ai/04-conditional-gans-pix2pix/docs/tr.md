# Şartlı GAN & Pix2Pix

> 2014-2017 yıllarındaki ilk büyük kilitleme, bir GAN'ın ne yaptığını kontrol etmekti. Bir etiket, ya da bir görüntü veya bir cümle ekleyin. Pix2Pix görüntü sürümünü yaptı ve hala dar bir görüntüden görüntüye görevlerde her genel metin-resim modeliyi yendi.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## Sorun

Şartsız bir GAN, keyfi yüzlere örnekler verir. Demo için yararlı, üretim için işe yaramaz. İsterseniz: * bir çizim resmi, * bir hava fotoğrafı haritası, * gündüz sahnesini gece haritası, * gri ölçekli bir resmini renklendirin.$x$ve çıkış yaptırmalı.$y$Bazı anlamlı bir karşılıklılık ile.$y$- Evet .$x$Ortalama kare hatası onları bir karışıklığa dönüştürür.

Şartlı GAN (Mirza & Osindero, 2014) bir şart ekler $c$Her ikisine de bir giriş olarak $G$ve $D$Pix2Pix (Isola et al., 2017) bunu uzmanlaştırdı: koşul tam bir giriş görüntüsüdür, jeneratör bir U-Net, ayrımcı bir * patch tabanlı* sınıflandırıcıdır (PatchGAN), ve kayıp + L1'dir. Bu tarif 2026'da bile dar görüntü-resim alanlarında sıfırdan metin-resim modelleri üzerinde daha iyi performans gösteriyor çünkü * çift veriler* üzerinde eğitilmiştir.

## Anlaşım

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$Pix2Pix'te.$z$G içindeki çıkış (gelen gelse gelen gürültü yok  Açık gürültü izole edilmedi).

**Conditional D.** $D(x, y) \to [0, 1]$Giriş * çift* (şart, çıkış) bu ana fark: D'nin $y$ ile uyumludur$x$Sadece ...$y$Gerçek görünüyor.

**U-Net generator.**Boş boynuz üzerinden atlama bağlantıları olan kodlayıcı-dekoder. Giriş ve çıkış düşük düzeyde bir yapı paylaşan görevler için kritik. Atlamalar olmadan, yüksek frekanslı detaylar kaybolur.

**PatchGAN discriminator.**Tek gerçek/sahte puan vermek yerine, D bir $N \times N$Bu, Markov'un rastgele alan varsayımıdır: gerçekçilik yerel. Eğitmek çok daha hızlı, daha az parametreler, daha keskin çıkış.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

L1 terimi eğitimleri istikrarlı hale getirir ve G'yi bilinen hedefe doğru itirir. L1 L2'den daha keskin kenarlar verir (ortalar, ortalama değil). $\lambda = 100$Pix2Pix'in öntanımlı olduğu.

## CycleGAN  çift olmadığınızda

Pix2Pix çiftleştirilmelidir $(x, y)$CycleGAN (Zhu et al., 2017) bu gereksinimleri bir ekstra kaybın bedeliyle düşürüyor: * döngü tutarlılığı kaybı.$G: X \to Y$ve $F: Y \to X$- Onları eğit .$F(G(x)) \approx x$ve $G(F(y)) \approx y$Bu atları zebralara çevirmenizi sağlar, yazdan kışa, çiftli örnekler olmadan.

2026'da eşleşmemiş görüntü-resim çoğunlukla CycleGAN yerine difüzyon (ControlNet, IP-Adapter) yoluyla yapılır, ancak döngü tutarlılığı fikri neredeyse her eşleşmemiş alan uyarlama kağıdında hayatta kalır.

```figure
gx-patchgan
```

## Yapın

`code/main.py`1 boyutlu verilere küçük bir şartlı GAN uyguluyor.$c$sınıf etiketidir (0 veya 1). Görev: verilen sınıf için koşullu dağılımdan bir örnek üretmek.

### Adım 1: G ve D girişlerine koşul ekle

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

En büyük modeller öğrenilmiş yerleşimleri, FiLM modülasyonunu veya çapraz dikkatini kullanır.

### Adım 2: Şartlı tren

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

Generatör, verilen koşul için *gerçek dağılım * ile eşleşmelidir, kenarlık değil.

### Adım 3: Sınıf başına çıkışı doğrulayın

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## Tuzaklar

- **Condition ignored.**G sınır dışı bırakmayı öğrenir, D asla cezalandırmaz çünkü durum sinyali zayıfdır. D durumu daha agresif bir şekilde (başka katman, sadece geç değil) düzeltir, projeksiyon ayrımcılığını kullan (Miyato & Koyama 2018).
- **L1 weight too low.**G, sadık olmayan, gerçek görünümlü geleneksel sonuçlara doğru hareket ediyor.$\lambda \approx 100$Pix2Pix tarzındaki görevler için.
- **L1 weight too high.**G, L1 hala bir $L_p$Annel, antrenman sabitleştiğinde.
- **Ground-truth leakage in D.**Konkatenat $(x, y)$Sadece değil, D giriş olarak.$y$Bu D olmadan tutarlılığı kontrol edemezsiniz.
- **Mode collapse per class.**Her sınıf bağımsız olarak çökebilir.

## Kullan

2026 görüntü-resim görevlerinin durumu:

| Task | Best approach |
|------|---------------|
| Sketch → photo, same domain, paired data | Pix2Pix / Pix2PixHD (still fast, still sharp) |
| Sketch → photo, unpaired | ControlNet with a Scribble conditioning model |
| Semantic seg → photo | SPADE / GauGAN2 or SD + ControlNet-Seg |
| Style transfer | Diffusion with IP-Adapter or LoRA; GAN methods are legacy |
| Depth → photo | ControlNet-Depth over Stable Diffusion |
| Super-resolution | Real-ESRGAN (GAN), ESRGAN-Plus, or SD-Upscale (diffusion) |
| Colorization | ColTran, diffusion-based colorizers, or Pix2Pix-color |
| Daytime → nighttime, seasons, weather | CycleGAN or ControlNet-based |

Pix2Pix, (a) binlerce çift örneğe sahip olduğunuzda, (b) görev dar ve tekrarlanabilir ve (c) hızlı bir sonuç almanız gerektiğinde doğru araç olarak kalır.

## Gönder

- Kaydet .`outputs/skill-img2img-chooser.md`. Yetenek bir görev açıklaması, veri kullanılabilirliği (birleştirilmiş vs eşleştirilmemiş, N örnekler) ve gecikme/kalite bütçesi alır, sonra çıkışlar: yaklaşım (Pix2Pix, CycleGAN, ControlNet varianti, SDXL + IP-Adapter), eğitim veri gereksinimleri, sonucu maliyeti ve değerlendirme protokolü (LPIPS, FID, görev-özel).

## Egzersizler

1. **Easy.**Değiştir `code/main.py`G'nin her sınıfın gürültüsünü doğru modaya yerleştirdiğini onaylayın.
2. **Medium.**L1'i 1-D ayarında algısal bir kayıpla değiştirin (örneğin özellik çıkarıcı olarak hareket eden küçük dondurulmuş D). Şartlı dağılımın keskinliğini değiştirir mi?
3. **Hard.**Bir CycleGAN'ı 1D ayarında çizin: iki dağıtım, iki jeneratör, döngü kaybı.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## Üretim notu: Pix2Pix latensi sınırlı bir temel hat olarak

Veriler ve dar bir görev (sketch → render, semantik harita → foto, gün → gece) eşleştirildiğinde, Pix2Pix'in tek çekim sonucu, gecikme üzerinde büyüklük bir sırayla yayılmayı yener.

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix, statik partilerde üretimi kazanır (her talep aynı FLOPs'dir). Diffusion kalitede ve genelleştirmede kazanır. Modern oyun genellikle dar görev için Pix2Pix tarzı bir destil modelini ve kuyruğu girişleri için bir diffusion fallback'i göndermektir.

## Daha Fazla Okumak

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784)- CGAN kağıdı.
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004)Pix2Pix.
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) CycleGAN.
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) Pix2PixHD.
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) SPADE / Gaugan.
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) D. Projeksiyon
