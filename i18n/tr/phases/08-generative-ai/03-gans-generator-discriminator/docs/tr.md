# GAN  Generatör vs. Ayrımcı

> Goodfellow'un 2014'te yaptığı numara yoğunluğu tamamen atlamak. İki ağ. Biri sahte yapıyor. Biri yakalıyor. Sahte gerçekten ayırt edilemez olana kadar dövüşüyorlar. Bu işe yaramaz.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## Sorun

VAE'ler bulanık örnekler üretir çünkü MSE dekodör kaybı * ortalama * görüntü için Bayes-optimal ve birçok makul rakamın ortalaması bulanık bir rakamdır. * makulluğu * ödüllendiren bir kaybı istiyorsunuz, herhangi bir hedefe piksel açısından yakınlık değil. Makulluğu için kapalı bir biçim yoktur. Bunu öğrenmelisiniz.

Goodfellow'un fikri: sınıflandırıcı eğitmek.$D(x)$Gerçek görüntüleri sahte görüntülerden ayırt etmek için bir jeneratör eğit.$G(z)$- Akılsızlık .$D$Kayıp sinyalini .$G$Neyse .$D$Bu sinyal güncelleştiriler gibi$G$Eğer iki ağ da bir araya gelirse,$G$Bilgi dağıtımını hiç yazmadan öğrenmiş.`log p(x)`- Evet .

Bu bir karşılaşma eğitimi.

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

2026'da GAN'lar artık SOTA jeneratörü değil (haşlama ve akış eşleşimi bu taçı yedi). Ancak StyleGAN 2/3 şimdiye kadar gönderilen en keskin yüz modelleri olarak kalır, GAN ayrımcıları, difüzyon eğitiminde * algı kaybı* olarak kullanılır ve karşıtlık eğitimi gerçek zamanlı difüzyon göndermenizi sağlayan hızlı 1 adımlı destillasiyonları (SDXL-Turbo, SD3-Turbo, LCM) güçlendirir.

## Anlaşım

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**Bir gürültü vektörünü haritası $z \sim \mathcal{N}(0, I)$bir örnek için $\hat{x}$. Dekodör şeklinde bir ağ (sıkı veya transpose konfor).

**Discriminator $D(x)$.**Bir örnekin bir skalar olasılık (veya puan) haritasına yerleştirildi.

**Loss.**İki alternatif güncelleme:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$- Gerçek = 1'de ikili çapraz entropi, sahte = 0'da.
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$Bu Goodfellow'un kullandığı * doymayan * formdur (orjinal)$\log(1 - D(G(z)))$                         $D$Kendine güvenen biri.

**Training loop.**Bir adım atmak .$D$Bir adım daha .$G$Tekrar ediyorum.

**Why it works.**- Eğer$G$Tam olarak eşleşir .$p_{\text{data}}$O zaman ...$D$Orası şansın değil . Her yerde 0.5 çıkış .$G$Daha fazla gradient kalmaz.

**Why it breaks.**Mod çöküşü ($G$Bir mod bulur $D$- ...bunu sonsuza kadar sınıflandırıp, bir araya getiremiyorum.$D$Çok hızlı öğrenir ve $\log D$Bu nedenle, eğitimde de bir değişiklik yapılması gerekmektedir.

## GAN'ları çalıştıran variantlar

| Year | Innovation | Fix |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — the first stable architecture. |
| 2017 | WGAN, WGAN-GP | Replace BCE with Wasserstein distance + gradient penalty. Fixes vanishing gradient. |
| 2017 | Spectral normalization | Lipschitz-bound the discriminator. Still used in 2026 discriminators. |
| 2018 | Progressive GAN | Train low-res first, add layers. First megapixel results. |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm. State of the art for fixed-domain photorealism. |
| 2021 | StyleGAN3 | Alias-free, translation-equivariant — still the face gold standard in 2026. |
| 2022 | StyleGAN-XL | Conditional, class-aware, larger scale. |
| 2024 | R3GAN | Rebrands with stronger regularization; works on 1024² without tricks. |

```figure
gan-minimax
```

## Yapın

`code/main.py`1 boyutlu verilere göre küçük bir GAN'ı eğitir: iki Gaussians karışımı. Generatör ve ayrımcı tek katmanlı MLP'lerdir. Ön, geriye ve minimax döngüsünü elle uyguluyoruz. Amaç iki anahtar başarısızlık modunu (mod çöküş + kaybolan gradient) görmektir.

### Adım 1: Doymayan kayıp

Vanilya Goodfellow kaybı .$\log(1 - D(G(z)))$D'nin G'nin sahte olduğunu yüksek güvenle sahte olarak sınıflandırırken 0'ya gider.$-\log D(G(z))$D'nin güven içindeyken patlar ve G'ye güçlü bir sinyal verir.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Adım 2: Bir jeneratör adımı başına bir ayrımcı adım

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

G için yeni sahte, aksi takdirde gradientler eskidir.

### Adım 3: Mod çöküşünü kontrol edin

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

Kanonik semptom: iki gerçek moddan biri üretilmeyi bırakır. Ayrımcı onu düzeltmeyi bırakır çünkü asla sahte olarak görülmez.

## Tuzaklar

- **Discriminator too strong.**D'nin öğrenme hızını 2-5 kat azaltın veya örnek/katman gürültüsü ekleyin.
- **Generator memorizes a mode.**D girişlerine gürültü ekleyin, minibatch-dizginci katmanı kullanın veya WGAN-GP'ye geçin.
- **Batch norm leaking statistics.**Aynı BN katmanından akışan gerçek parti + sahte parti istatistiklerini karıştırır.
- **Inception-score gaming.**FID ve IS düşük örnek sayımlarında gürültülüdür.
- **One-shot sampling is a lie for conditional tasks.**Hala CFG ölçekleri, kesim hileleri ve kullanılabilir çıkışlar elde etmek için yeniden örneklenmeye ihtiyacınız var.

## Kullan

2026 GAN yığın:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

GAN'lar keskin ama dar. Bir kez alanınız  fotoğrafları açtığında, keyfi metin istekleri, video  yayıma geçiyor.

## Gönder

- Kaydet .`outputs/skill-gan-debugger.md`. Skill, başarısız bir GAN çalışmasını (kayıp eğri, örnek şebekesi, veri kümesi boyutu) alır ve olası nedenlerin sıralamalı bir listesini, tek satırlı düzeltmeleri ve tekrar çalıştırma protokolünü çıkarır.

## Egzersizler

1. **Easy.**Çık .`code/main.py`- O zaman ayarlayın.`D_LR = 5 * G_LR`G'nin kaybı ne kadar hızlı bir sabit haline gelir?
2. **Medium.**Goodfellow BCE kaybını WGAN kaybıyla değiştirin: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$- Evet .$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$, ve D'nin ağırlıklarını `[-0.01, 0.01]`- Eğitim daha istikrarlı mı?
3. **Hard.**1-D örneğini 2-D verilere (bir yüzük üzerinde 8 Gaussians karışımı) uzatın. Generatörün 1k, 5k, 10k adımlarında kaç tane 8 mod yakaladığını takip edin. Minibatch ayrımcılığını uygulayın ve yeniden ölçün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network, `G: z → x̂`. |
| Discriminator | "D" | Classifier `D: x → [0, 1]`, real vs fake. |
| Minimax | "The game" | $\min_G \max_D$ of a joint objective. |
| Non-saturating loss | "The fix" | Use $-\log D(G(z))$ for G instead of $\log(1 - D(G(z)))$. |
| Mode collapse | "G memorized one thing" | Generator produces few distinct outputs despite diverse data. |
| WGAN | "Wasserstein" | Replace BCE with Earth-Mover distance + gradient penalty; smoother gradient. |
| Spectral norm | "Lipschitz trick" | Constrain D's weight norms to bound its slope; stabilizes training. |
| StyleGAN | "The one that works" | Mapping network + AdaIN; best-in-class for faces, still in 2026. |

## Üretim notu: Tek çekim sonucu GAN'ın kalıcı avantajıdır

GAN'lar artık açık alan üretimi için örnek kalitesi üzerinde kazanmazlar, ancak hala sonuçlandırma maliyetinde kazanırlar.

- **No prefill, no decode stages.**Tek bir tane .$G(z)$TTFT ≈ toplam gecikme.
- **No KV-cache pressure.**Tek durum ağırlıklar.Battery boyutu, cache değil, aktivasyon belleği ile sınırlıdır.
- **Trivial continuous batching.**Her istek aynı sabit FLOPs'i aldığı için, sunucu'nun hedef yerleşimindeki statik bir parti genellikle en iyisidir.

Bu nedenle GAN destilasyonu (SDXL-Turbo, SD3-Turbo, ADD, LCM) 2026'da hızlı metin-resim için baskın tekniktir: yavaş jeneratörleri hızlılara dönüştürmek için bir antrenman zaman düğmesi olarak kalır.

## Daha Fazla Okumak

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) orijinal GAN kağıdı.
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) İlk sabit mimarlık.
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN.
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042)SDXL-Turbo.
