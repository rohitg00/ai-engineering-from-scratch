# Otomatik kodlayıcılar ve Variasyonel Otomatik kodlayıcılar (VAE)

> Bir otomatik kodlayıcı sıkıştırır, sonra yeniden oluşturur. Hatırlıyor. Yaratmaz. Bir numara ekleyin  kodu Gaussian görünmesi için zorlayın  ve bir örneklemeci elde edersiniz.$z = \mu + \sigma \cdot \epsilon$, bu yüzden 2026'da kullandığınız her gizli yayılma ve akış eşleşme görüntü modeli girişinde bir VAE'ye sahip.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## Sorun

784 piksel MNIST rakamını 16 sayılık bir kodla sıkıştırın, sonra yeniden yapılandırın. Sıradan bir otomatik kodlayıcı MSE yeniden yapılandırmasını sağlar ancak kod alanı bir karışıklık.

Aslında istediğiniz şey: (a) kod alanı temiz ve düzgün bir dağılımdır.$\mathcal{N}(0, I)$, (b) herhangi bir örnekin çözümü bir olası rakam üretir ve (c) kodlayıcı ve dekoder hala iyi sıkıştırılır.

Kingma'nın 2013 VAE'si kodlayıcının bir * dağıtım* çıkartması için eğitilmesiyle bunu çözer.$q(z \mid x) = \mathcal{N}(\mu(x), \sigma(x)^2)$, bu dağılımı öncüye doğru çekerek$\mathcal{N}(0, I)$KL cezası ile, sonra örnekleme yapılır.$z$-$q(z \mid x)$Anlamlama sırasında, kodlayıcıyı bırakın, örnekleyin.$z \sim \mathcal{N}(0, I)$KL cezası, kod alanının yapılandırılmasını zorlar.

2026 yılında VAE'ler nadiren bağımsız olarak gönderir  çiğ görüntü kalitesi için difüzyonla üst sınıflandırılmıştır  ama her latent difüzyon modeli için tercih edilen kodlayıcılardır (SD 1/2/XL/3, Flux, AudioCraft).

## Anlaşım

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$- Evet .$\hat{x} = \text{decoder}(z)$, kayıp = $\lVert x - \hat{x} \rVert^2$- Kod alanı yapılandırılmamış.

**VAE encoder.**İki vektör çıkışı: $\mu(x)$ve $\log \sigma^2(x)$Bu tanımlar .$q(z \mid x) = \mathcal{N}(\mu, \mathop{\mathrm{diag}}(\sigma^2))$- Evet .

**Reparameterization trick.**$q(z \mid x)$Örnekte farklılık gösterilmez.$z = \mu + \sigma \cdot \epsilon$nerede$\epsilon \sim \mathcal{N}(0, I)$- Şimdi .$z$$(\mu, \sigma)$Parametre dışı bir gürültü ekle  gradientler akıyor `μ`ve $\sigma$- Evet .

**Loss.**Kanıt Alt Bağlantısı (ELBO), iki terim:

```math
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\Vert\, \mathcal{N}(0, I)] \\
&= \lVert x - \hat{x} \rVert^2 + \beta \cdot \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}
\end{aligned}
```

Yeniden inşaat sürükler .$\hat{x}$- Yolu $x$KL ' in itmesi .$q(z \mid x)$- Önceden, küçük bir şey.$\beta$($<1$) = daha keskin örnekler, kod alanı daha az Gaussian. Büyük $\beta$($>1$) = temiz kod alanı, bulanık örnekler. β-VAE (Higgins 2017) bu düğmeyi ünlü kıldı ve çözünürlük araştırmasına başladı.

**Sampling.**Sonuç: çekim$z \sim \mathcal{N}(0, I)$Bir ileri geçiş  difüzyon gibi tekrarlayıcı örnekleme yok.

```figure
vae-latent-grid
```

## Yapın

`code/main.py`Bu uygulama, bir numpy veya meşale olmadan küçük bir VAE uygulamaktadır. Giriş, 8-D'deki 2 bileşenli Gaussian karışımından alınan 8 boyutlu sentetik veridir. Kodlayıcı ve dekodör tek gizli katmanlı MLP'lerdir. Tanh etkinleştirimi, ileri geçişi, kaybı ve el yazılı geri geçişi uyguluyoruz.

### Adım 1: Kodlayıcı ileriye

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$yerine$\sigma$Böylece ağ çıkışı kısıtlı değildir (s'nin yumuşak artı bir tuzağıdır  gradientler 'de ölür.$\sigma \approx 0$)

### Adım 2: yeniden ölçümleme ve çözme

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### Adım 3: ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

Bu da bir diğer deyişle, bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir de bir bir de bir de bir de bir de bir bir de bir bir bir de bir de bir de bir de bir bir de bir de bir de bir bir bir de bir de bir de bir de bir de bir bir bir de bir bir bir de bir de bir de bir de bir bir bir de bir de bir bir de bir de bir bir de bir bir de bir de bir de bir de bir bir de bir bir de bir bir de bir bir de bir de bir bir de bir de bir de bir bir de bir bir de bir bir de bir de bir de bir bir de bir de bir de bir de bir bir de bir bir bir de bir de bir de bir bir de bir de bir de bir bir de bir de bir bir bir de bir de bir bir de bir de bir bir bir bir de bir de bir de bir de bir de bir de bir bir bir bir de bir de bir bir bir bir bir de bir de bir de bir bir bir de bir de bir bir bir bir de bir de bir bir bir bir de bir de bir de bir bir de bir de bir de bir bir bir de bir de bir de bir de

### Dördüncü adım: oluştur

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

Bu, üreticik model. Beş satır.

## Tuzaklar

- **Posterior collapse.**KL term sürücüleri $q(z \mid x) \to \mathcal{N}(0, I)$O kadar agresif ki$z$hakkında hiçbir bilgi taşımaz.$x$. Düzeltme: β- annulleri (başlamak $\beta=0$, rampa 1)), boş bitler veya KL'yi aktif olmayan boyutlarda atlayın.
- **Blurry samples.**Gaussian dekodör olasılığı, L2 için Bayes-optimal olan MSE yeniden yapılandırmasını içerir (ortalama)  bir dizi makul rakamın ortalaması bulanık bir rakamdır. Düzelt: ayrı dekodör (VQ-VAE, NVAE), veya VAE'yi yalnızca bir kodlayıcı ve yataklarda yığın yayılması olarak kullanın (Stable Diffusion yapar).
- **β too large, too early.**Arka çöküşü gör.$\beta \approx 0.01$ve ramp.
- **Latent dim too small.**16-D, MNIST için, 256-D, ImageNet 2562, 2048-D için ImageNet 10242 için çalışır. Stable Diffusion'ın VAE'si 512×512×3 → 64×64×4'i (bir tarafta aşağı örnek, boşluk alanında 64x; kanallar 3'ten 4'e gidiyor, bu nedenle toplamda yaklaşık 48x daha az değer).

## Kullan

2026 VAE'nin birimleri:

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

Bir latent-difüzyon modeli, kodlayıcı ve dekodör arasında yaşayan bir difüzyon modeli olan bir VAE'dir. VAE kaba sıkıştırmayı yapar, difüzyon modeli ağır yüklemeyi yapar. Video (VAE + video-difüzyon DiT) ve ses (Encodec + MusicGen transformatörü) için aynı desen.

## Gönder

- Kaydet .`outputs/skill-vae-trainer.md`- Evet .

Yetenek alınması: veri kümesi profili + laten-dim hedefi + aşağıdaki kullanım (yakınlama, örnekleme veya laten-difüzyona giriş) ve çıkışlar: mimarlık seçimi (sırf/β/VQ/RVQ), β programı, laten-dim, dekodör olasılığı (Gaussian vs kategorik) ve değerlendirme planı (recon MSE, KL per dim, Fréchet mesafesi $q(z \mid x)$ve $\mathcal{N}(0, I))$- Evet .

## Egzersizler

1. **Easy.**Değişiklik$\beta$İçeride`code/main.py`- ...`0.01`- Evet .`0.1`- Evet .`1.0`- Evet .`5.0`MSE ve KL ' in son yeniden inşaatını kaydet .$\beta$Pareto, sentetik verileriniz için en iyi mi?
2. **Medium.**Gaussian dekoder olasılığını Bernoulli olasılığı (çaplak entropi kaybı) ile değiştirin. Aynı sentetik verilerin ikili sürümünde örnek kalitesini karşılaştırın.
3. **Hard.**Uzaklaştırma`code/main.py`Mini VQ-VAE'ye dönüştürülür: sürekli $z$K=32 giriş kod defterinde en yakın komşu arayışı ile. Yeniden inşa MSE'yi karşılaştırın ve kaç kod defter girişinin kullanıldığını bildirin (kod defter çöküşü gerçek).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Autoencoder | Encode-decode network | $x \to z \to \hat{x}$, learn MSE. Not generative. |
| VAE | AE with a sampler | Encoder outputs a distribution, KL penalty shapes code space. |
| ELBO | Evidence lower bound | $\log p(x) \ge \text{recon} - \mathrm{KL}[q(z \mid x) \Vert p(z)]$; tight when $q = p(z \mid x)$. |
| Reparameterization | $z = \mu + \sigma \cdot \epsilon$ | Rewrites stochastic node as deterministic + pure noise. Enables backprop through sampling. |
| Prior | $p(z)$ | Target distribution for the latent, typically $\mathcal{N}(0, I)$. |
| Posterior collapse | "KL term wins" | Encoder ignores $x$, outputs the prior; decoder must hallucinate. |
| β-VAE | Tunable KL weight | $\text{loss} = \text{recon} + \beta \cdot \mathrm{KL}$. Higher $\beta$ = more disentangled but blurrier. |
| VQ-VAE | Discrete latent | Replace continuous $z$ with nearest codebook vector; enables transformer modelling. |

## Üretim notu: VAE bir difüzyon sunucusundaki en sıcak yoludur

Stable Diffusion / Flux / SD3 borusunda VAE'ye istek başına iki kez çağrılır  bir kez kodlamak için (img2img / inpainting yapıyorsanız) ve bir kez de kodlamaktır. 10242'de dekodör geçişi genellikle tüm borusunda en büyük tek etkinleştirme hafızası zirvesidür çünkü yukarıdaki örnekler `128×128×16`- Yeterince .`1024×1024×3`İki pratik sonuç:

- **Slice or tile the decode.** `diffusers`Açıklamalar`pipe.vae.enable_slicing()`ve `pipe.vae.enable_tiling()`Tiling küçük bir dikiş eseriyle ticaret yapıyor .$O(\text{tile}^2)$- Anımsamak yerine .$O(H \cdot W)$- 10242+ için gerekli.
- **bf16 decoder, fp32 numerics for the final resize.**SD 1.x VAE fp32'de serbest bırakıldı ve 10242+ SDXL gemilerinde fp16'a döküldüğünde *sessizçe NaNs* üretir.`madebyollin/sdxl-vae-fp16-fix` her zaman fp16- sabit variansı tercih edin veya bf16 kullanın.

## Daha Fazla Okumak

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) VAE kağıdı.
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) çözülmüş β-VAE.
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) VQ-VAE.
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) En son görüntü VAE.
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Dönüştürme; VAE kodlayıcı olarak.
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) Encodec, sesli VAE standardı.
