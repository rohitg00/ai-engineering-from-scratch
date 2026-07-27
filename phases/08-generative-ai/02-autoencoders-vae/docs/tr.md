# Otomatik Kodlayıcılar ve Değişken Otomatik Kodlayıcılar (VAE)

> Düz bir otomatik kodlayıcı sıkıştırır ve ardından yeniden oluşturur. Ezberler. Oluşturmuyor. Bir numara ekleyin - kodu Gaussian gibi görünmeye zorlayın - ve bir örnekleyici elde edin. `z = μ + σ·ε`'nin yeniden parametrelendirilmesi olan bu tek hile, 2026'da kullandığınız her gizli yayılma ve akış eşleştirme görüntü modelinin girişte bir VAE'ye sahip olmasının nedenidir.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 3 · 02 (Backprop), Aşama 3 · 07 (CNN'ler), Aşama 8 · 01 (Sınıflandırma)
**Süre:** ~75 dakika

## Sorun

784 piksellik bir MNIST rakamını 16 rakamlı bir koda sıkıştırın ve ardından yeniden oluşturun. Düz bir otomatik kodlayıcı MSE'nin yeniden yapılandırılmasında başarılı olacaktır, ancak kod alanı topaklı bir karmaşadır. Kod alanında rastgele bir nokta seçin, kodunu çözün ve gürültü elde edin. Örnekleyicisi yoktur. Giyinmiş bir sıkıştırma modelidir.

Gerçekte istediğiniz şey şudur: (a) kod alanı örnek alabileceğiniz temiz, düzgün bir dağılımdır - örneğin izotropik bir Gauss `N(0, I)`, (b) herhangi bir örneğin kodunun çözülmesi makul bir rakam üretir ve (c) kodlayıcı ve kod çözücü hala iyi sıkıştırılır. Üç gol, tek mimari, tek mağlubiyet.

Kingma'nın 2013 VAE'si, kodlayıcıyı bir *dağıtım* `q(z|x) = N(μ(x), σ(x)²)` çıktısı verecek şekilde eğiterek, bu dağıtımı bir KL cezası yoluyla önceki `N(0, I)`'ye doğru çekerek ve ardından kod çözmeden önce `q(z|x)`'den `z`'yi örnekleyerek bu sorunu çözer. inference zamanında kodlayıcıyı bırakın, `z ~ N(0, I)`'yi örnekleyin, kodu çözün. KL cezası, kod alanını yapılandırılmaya zorlayan şeydir.

2026'da VAE'ler nadiren bağımsız olarak gönderilir - ham görüntü kalitesi açısından difüzyon açısından geride kalmıştır - ancak her gizli difüzyon modeli (SD 1/2/XL/3, Flux, AudioCraft) için tercih edilen kodlayıcıdırlar. VAE'yi öğrenin ve kullandığınız her görüntü hattının görünmez ilk katmanını öğrenin.

## Konsept

![Otomatik kodlayıcı ve VAE: yeniden parametrelendirme numarası](../assets/vae.svg)

**Otomatik kodlayıcı.** `z = encoder(x)`, `x̂ = decoder(z)`, kayıp = `||x - x̂||²`. Kod alanı yapılandırılmamış.

**VAE kodlayıcı.** İki vektörün çıktısını verir: `μ(x)` ve `log σ²(x)`. Bunlar `q(z|x) = N(μ, diag(σ²))`'yi tanımlar.

**Yeniden parametrelendirme hilesi.** `q(z|x)`'den örnekleme farklılaştırılamaz. Örneği `z = μ + σ·ε` olarak yeniden yazın; burada `ε ~ N(0, I)`. Artık `z`, `(μ, σ)`'nin deterministik bir fonksiyonu artı parametre olmayan bir gürültüdür — gradient'ler, `μ` ve `σ` üzerinden akar.

**Kayıp.** Kanıt Alt Sınırı (ELBO), iki terim:

```
loss = reconstruction + β · KL[q(z|x) || N(0, I)]
     = ||x - x̂||²  + β · Σ_i ( σ_i² + μ_i² - log σ_i² - 1 ) / 2
```

Yeniden yapılanma `x̂`'yi `x`'ye doğru itiyor. KL, `q(z|x)`'yi öncekine doğru iter. Takas yapıyorlar. Küçük β (<1) = daha keskin örnekler, kod alanı daha az Gaussian. Büyük β (>1) = daha temiz kod alanı, daha bulanık örnekler. β-VAE (Higgins 2017) bu düğmeyi meşhur etti ve çözülme araştırmasını başlattı.

**Örnekleme.** inference'de: `z ~ N(0, I)`'yi kod çözücüye doğru ileri doğru çizin. Tek ileri geçiş — yayılma gibi yinelemeli örnekleme yok.

```figure
vae-latent-grid
```

## İnşa Et

`code/main.py`, numpy veya meşale olmadan küçük bir VAE uygular. Girdi, 8 boyutlu 2 bileşenli Gauss karışımından alınan 8 boyutlu sentetik verilerdir. Kodlayıcı ve kod çözücü tek gizli katmanlı MLP'lerdir. Tanh aktivasyonu, ileri pas, mağlubiyet ve elle yazılmış bir geri pas uyguluyoruz. Üretim değil, pedagoji.

### Adım 1: Kodlayıcı ileri

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

`σ` yerine `log σ²`, böylece ağ çıkışı kısıtlanmaz (σ'nun yazılım artısı bir tuzaktır — gradient'ler σ ≈ 0'da ölür).

### Adım 2: yeniden parametrelendirin ve kodunu çözün

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

Tam kapalı formda KL çünkü her iki dağılım da Gaussian'dır. Sayısal olarak entegre etmeyin. İnsanlar 2026'da hala monte-carlo KL tahminleriyle kod gönderiyor; sebepsiz yere 3 kat daha yavaş.

### Adım 4: Oluştur

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

Üretken model budur. Beş satır.

## Tuzaklar

- **Arka çökme.** KL terimi, `q(z|x) → N(0, I)`'yi o kadar agresif bir şekilde çalıştırır ki `z`, `x` hakkında hiçbir bilgi taşımaz. Düzeltme: β-tavlama (başlangıç ​​β=0, 1'e rampa), serbest bitler veya etkin olmayan boyutlarda KL'yi atlama.
- **Bulanık örnekler.** Gauss kod çözücü olasılığı, L2 (ortalama) için Bayes açısından optimal olan MSE yeniden yapılandırmasını ima eder; bir dizi makul rakamın ortalaması bulanık bir rakamdır. Düzeltme: ayrık kod çözücü (VQ-VAE, NVAE) veya VAE'yi yalnızca kodlayıcı olarak kullanın ve gizli öğeler üzerinde yığın difüzyonu yapın (Kararlı Difüzyonun yaptığı budur).
- **β çok büyük, çok erken.** Bakınız arka çökme. β≈0.01'den başlayın ve rampa yapın.
- **Gizli karartma çok küçük.** 16-D MNIST için, 256-D ImageNet 256² için, 2048-D ImageNet 1024² için çalışır. Stabil Difüzyonun VAE'si 512×512×3 → 64×64×4 sıkıştırır (uzaysal alanda 32x alt örnekleme faktörü, kanallarda 32x).

## Kullan onu

2026 VAE yığını:

| Durum | Seç |
|-----------|------|
| Difüzyon için görüntü gizli kodlayıcı | Kararlı Difüzyon VAE (`sd-vae-ft-ema`) veya Flux VAE |
| Gizli ses kodlayıcı | Kodlama (Meta), SoundStream veya DAC (Açıklama) |
| Gizli video | Sora'nın uzay-zamansal yamaları, Latte VAE, WAN VAE |
| Çözülmüş temsil öğrenimi | β-VAE, FaktörVAE, TCVAE |
| Ayrık latentler (transformer modelleme için) | VQ-VAE, RVQ (ArtıkVQ) |
| Üretim için sürekli gizli | Düz VAE, ardından bu gizli alanda bir akış/difüzyon modelini koşullandırın |

Gizli difüzyon modeli, kodlayıcı ve kod çözücü arasında yaşayan bir difüzyon modeline sahip bir VAE'dir. VAE kaba sıkıştırmayı yapar, difüzyon modeli ise ağır kaldırma işini yapar. Video (VAE + video difüzyon DiT) ve ses (Encodec + MusicGen transformer) için aynı model.

## Gönderin

`outputs/skill-vae-trainer.md`'yi kaydedin.

Beceri gerektiren konular: dataset profili + gizli karartma hedefi + aşağı yönde kullanım (yeniden yapılandırma, örnekleme veya gizli yayılma girişi) ve çıktılar: mimari seçimi (düz/β/VQ/RVQ), β programı, gizli karartma, kod çözücü olasılığı (Gaussian vs kategorik) ve değerlendirme planı (keşif MSE, dim başına KL, `q(z|x)` ve arasındaki Fréchet mesafesi) `N(0, I)`).

## Egzersizler

1. **Kolay.** `code/main.py`'deki `β`'yi `0.01`, `0.1`, `1.0`, `5.0` olarak değiştirin. Son rekonstrüksiyon MSE ve KL'yi kaydedin. Sentetik verileriniz için hangi β Pareto en iyisidir?
2. **Orta.** Gauss kod çözücü olasılığını Bernoulli olasılığıyla değiştirin (çapraz entropi kaybı). Örnek kalitesini aynı sentetik verilerin ikilileştirilmiş versiyonuyla karşılaştırın.
3. **Zor.** `code/main.py`'yi mini bir VQ-VAE'ye genişletin: sürekli `z`'yi, K=32 girişlerinden oluşan bir kod kitabındaki en yakın komşu aramasıyla değiştirin. Yeniden yapılanma MSE'sini karşılaştırın ve kaç tane kod kitabı girişinin kullanıldığını rapor edin (kod kitabı çöküşü gerçektir).

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Otomatik kodlayıcı | Ağı kodlama-kod çözme | `x → z → x̂`, MSE'yi öğrenin. Üretken değil. |
| VAE | Örnekleyicili AE | Kodlayıcı bir dağıtım çıktısı verir, KL cezası ise kod alanını şekillendirir. |
| ELBO | Kanıt alt sınırı | `log p(x) ≥ recon - KL[q(z\|x) \|\| p(z)]`; `q = p(z\|x)` olduğunda sıkı. |
| Yeniden parametrelendirme | `z = μ + σ·ε` | Stokastik düğümü deterministik + saf gürültü olarak yeniden yazar. Örnekleme yoluyla backprop'u etkinleştirir. |
| Önceki | `p(z)` | Gizli için hedef dağıtım, genellikle `N(0, I)`. |
| Arka çöküş | "KL terimi kazandı" | Kodlayıcı `x`'yi yok sayar, öncekinin çıktısını verir; Kod çözücü halüsinasyon görüyor olmalı. |
| β-VAE | Ayarlanabilir KL ağırlığı | `loss = recon + β·KL`. Daha yüksek β = daha karmaşık fakat daha bulanık. |
| VQ-VAE | Ayrık gizli | Sürekli `z`'yi en yakın kod çizelgesi vektörüyle değiştirin; transformer modellemeyi etkinleştirir. |

## Üretim notu: VAE, bir dağıtım sunucusundaki en sıcak yoldur

Kararlı Difüzyon / Flux / SD3 boru hattında VAE, istek başına iki kez çağrılır - biri kodlamak için (img2img / inpainting yapılıyorsa) ve biri de kodu çözmek için. 1024²'de kod çözücü geçişi, `128×128×16` latentlerini `1024×1024×3`'ye geri örneklediği için genellikle tüm işlem hattındaki en büyük tek aktivasyon-bellek zirvesidir. İki pratik sonuç:

- **Kod çözme işlemini dilimleyin veya döşeyin.** `diffusers`, `pipe.vae.enable_slicing()` ve `pipe.vae.enable_tiling()`'yi ortaya çıkarır. Döşeme, `O(H·W)` yerine `O(tile²)` belleği için küçük bir dikiş artifact'yi değiştirir. Tüketici GPU'larında 1024²+ için gereklidir.
- **bf16 kod çözücü, son yeniden boyutlandırma için fp32 sayısal değerleri.** SD 1.x VAE, fp32'de piyasaya sürüldü ve 1024²+'da fp16'ya aktarıldığında *sessizce NaN'ler* üretir. SDXL, `madebyollin/sdxl-vae-fp16-fix` ile birlikte gönderilir; her zaman fp16-fix varyantını tercih edin veya bf16'yı kullanın.

## Daha Fazla Okuma

- [Kingma ve Welling (2013). Otomatik Kodlama Değişken Bölümleri](https://arxiv.org/abs/1312.6114) — VAE kağıdı.
- [Higgins ve ark. (2017). β-VAE: Kısıtlanmış Değişken Framework](https://openreview.net/forum?id=Sy2fzU9gl) ile Temel Görsel Kavramları Öğrenme — çözülmüş β-VAE.
- [van den Oord ve ark. (2017). Nöral Ayrık Temsil Öğrenme](https://arxiv.org/abs/1711.00937) — VQ-VAE.
- [Vahdat ve Kautz (2021). NVAE: Derin Hiyerarşik Değişken Otomatik Kodlayıcı](https://arxiv.org/abs/2007.03898) — son teknoloji ürünü görüntü VAE.
- [Rombach ve ark. (2022). Gizli Yayılma Modelleriyle Yüksek Çözünürlüklü Görüntü Sentezi](https://arxiv.org/abs/2112.10752) — Kararlı Yayılma; Kodlayıcı olarak VAE.
- [Défossez ve ark. (2022). Yüksek Hassasiyetli Nöral Ses Sıkıştırma](https://arxiv.org/abs/2210.13438) — Encodec, ses VAE standardı.
