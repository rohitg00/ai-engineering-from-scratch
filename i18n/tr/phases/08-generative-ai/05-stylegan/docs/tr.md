# StyleGAN

> Çoğu jeneratör hareket eder .$z$StyleGAN onu bölüyor: ilk harita$z$Ortalama bir kişiye.$w$, sonra * enjekte * $w$AdaIN'den gelen bu tek değişim gizli alanı çözüp fotorealist yüzleri yedi yıl boyunca çözülmüş bir sorun haline getirdi.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## Sorun

DCGAN haritası .$z$Transpose konvulsiyonları bir yığın yoluyla bir görüntüye.$z$ poz, aydınlatma, kimlik, arka plan  birbirine karışmış.$z$Modelle "eşit kişi, farklı duruş" soramazsınız çünkü temsil bu şekilde faktör değildir.

Karras et al. (2019, NVIDIA) önerisi: beslenmeyi bırakın $z$- Bir sabit besleyin.`4×4×512`8 katmanlı bir MLP öğrenin ki haritalar yapsın.$z \in Z \to w \in W$- Enjeksiyon$w$* Adaptive instance normalization* (AdaIN) aracılığıyla her çözünürlükte: her bir konv özellik haritasını normalleştirin, sonra $w$Stochastic detaylar için katmanlık gürültü ekleyin (deriden porlar, saç iplikleri).

Sonuç:$W$"Yüksek seviye stili" (koşul, kimlik) vs. "yenis stili" (yalnızca ışıklandırma, renk) için yaklaşık ortogonal ekseller vardır.$w$Düşük çözünürlük seviyeleri ve B görüntüleri için $w$Bu kilitlenmemiş düzenleme, alanlar arası stilleştirme ve tüm "StyleGAN-inversion" araştırma hattı.

## Anlaşım

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$, 8 katlı bir MLP.$Z = \mathcal{N}(0, I)^{512}$- Evet .$W$Gaussian olmak zorunda değil  veriye göre şekil öğrenir.

**Synthesis network.**Öğrenilmiş bir sabitden başlar.`4×4×512`. Her çözünürlük blokları: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`Kararlar iki kat: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

nerede$y_{\text{scale}}$ve $y_{\text{bias}}$$w$"Style" burada özellik haritasının birinci ve ikinci sıradaki istatistikleridir.

**Per-layer noise.**Tek kanallı Gaussian gürültüsü, her özellik haritasına eklenir ve öğrenilen bir kanal açısından ölçeklenir.

**Truncation trick.**Sonuçta, örnek$z$, hesaplama$w = \text{mapping}(z)$O zaman ...$w' = \hat{w} + \psi \cdot (w - \hat{w})$nerede$\hat{w}$ortalama $w$Çok sayıda örnek üzerinde.$\psi < 1$Neredeyse her StyleGAN demo kullanıyor $\psi \approx 0.7$- Evet .

## StyleGAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

2026 yılında StyleGAN3 (a) yüksek FPS'de dar alan fotorealismi, (b) birkaç atışlı alan uyarlaması (100 görüntü ile yeni bir veri kümesine tren, dondurma haritalama), (c) tersleme tabanlı düzenleme (gör) için standart olarak kalır.$w$Gerçek bir fotoğrafı yeniden oluşturur, sonra onu düzenler.$w$). Açık alanlı metin-resim için,  yayılma aracı değildir.

```figure
gx-stylegan-mapping
```

## Yapın

`code/main.py`1-D'de bir oyuncak "style-GAN lite" uygulamaktadır: bir haritalama MLP, öğrenilen sabit vektörü alan ve onu modüle eden bir sentez fonksiyonu $w$-Derived scale/bias, ve per layer gürültü.$w$Afine modülasyon eşleşmeleri veya çarpmalarla bağlanarak $z$- Generatör girişine.

### Adım 1: haritalama ağı

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### Adım 2: Adaptif durum normalleşmesi

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

Özellikler haritası ölçeği ve önyargısı $w$Düzsel projeksiyon yoluyla.

### Adım 3: Katmanlık gürültü

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

Sigma kanal başına öğrenilmelidir.

## Tuzaklar

- **Droplet artifacts.**StyleGAN 1 özellik haritalarında bir damla damlasını üretti çünkü AdaIN ortalamayı sıfırladı. StyleGAN 2'nin ağırlık demodülasyonu, bunun yerine kıvrım ağırlıklarını ölçeklendirip düzeltir.
- **Texture sticking.**StyleGAN 1 ve 2 dokuları, nesne koordinatları değil, piksel koordinatları takip eder (interpolasyon sırasında görünür). StyleGAN 3'ün takma isimsiz kıvrımları bunu pencerelmiş sink filtreleri ile düzeltir.
- **Mode coverage.**Çarpışma`ψ < 0.7`temiz görünüyor ama dar bir kutuptan örnekler; kullan `ψ = 1.0`Eğer çeşitliliğe ihtiyacınız varsa.
- **Inversion is lossy.**Gerçek bir fotoğrafı $W$Genellikle optimizasyon veya bir kodlayıcı (e4e, ReStyle, HyperStyle) yoluyla yapılır.

## Kullan

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

Cevabı "bir kişinin yüzünün fotoğrafı" olduğu ürün sınıfı gösterimleri için StyleGAN, sonuçlama maliyetinde yayılım (tek ileri geçiş, <10ms bir 4090) ve aynı kalite çubuğu için keskinliği yener.

## Gönder

- Kaydet .`outputs/skill-stylegan-inversion.md`. Skill gerçek bir fotoğraf çekir ve sonuçlar: tersleme yöntemi (e4e / ReStyle / HyperStyle), beklenen gizli kayb, düzenleme bütçesi (ne kadar uzun $W$eserlerden önce hareket edebilirsiniz) ve bilinen iyi düzenleme yönlerinin (yaş, ifade, poz) bir listesini.

## Egzersizler

1. **Easy.**Çık .`code/main.py`- Evet .`adain_on=True`ve `adain_on=False`- Sıkı bir latente ile rahatsız edilmiş bir latente için çıkışların yayılmasını karşılaştırın.
2. **Medium.**Karıştırma düzenlenmesini uygula: bir eğitim parti için hesaplama$w_a$- Evet .$w_b$, ve uygulanır $w_a$Sintezin ilk yarısında ve $w_b$Dekodör çözülmüş stiller öğrenir mi?
3. **Hard.**Önceden eğitilmiş bir StyleGAN3 FFHQ modeli (ffhq-1024.pkl) alın.$w$Etiketlenmiş örnekler üzerinde bir SVM'yi eğitirek "gümüş" kontrol eden yön; kimlik sürüklemeden önce ne kadar ileri gidebileceğinizi bildirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mapping network | "The MLP" | $f: Z \to W$, 8 layers, decouples latent geometry from data statistics. |
| W space | "The style space" | Output of the mapping network; roughly disentangled. |
| AdaIN | "Adaptive instance norm" | Normalize feature map, then scale + shift by $w$-projection. |
| Truncation trick | "Psi" | $w = \text{mean} + \psi \cdot (w - \text{mean})$, $\psi<1$ trades diversity for quality. |
| Path-length regularization | "PL reg" | Penalizes large changes in image per unit change in $w$; makes $W$ smoother. |
| Weight demodulation | "The StyleGAN2 fix" | Normalize conv weights instead of activations; kills droplet artifacts. |
| Alias-free | "StyleGAN3's trick" | Windowed sinc filters; eliminates texture sticking to the pixel grid. |
| Inversion | "Find w for a real image" | Optimize or encode $x \to w$ so $G(w) \approx x$. |

## Üretim notu: StyleGAN'ın neden 2026'da hala gemiye gönderiliyor

StyleGAN3 4090'da 10242 FFHQ yüzü 10 ms'ten kısa bir süre içinde üretir `num_steps = 1`Bu, herhangi bir görüntü jeneratörü için zemin gecikmesi. 50 adımlı bir SDXL + VAE-decode borusu aynı çözünürlükte ~ 3 saniye.**300× gap**, ve dar alan ürünleri için (avatar hizmetleri, kimlik belgeleri boru hattı, stok yüzü üretimi) TCO'da kazanır.

İki operasyonsal sonuç:

- **No scheduler, no batcher.**Hedefli işlevdeki statik parti en iyisidir. Sürekli partileşme (LLM ve yayım için gereklidir) her talep aynı FLOP'leri aldığı için sıfır fayda sağlar.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`Karteleme ağının aralığındaki dar bir kutuptan örnekler. Bu, servis katmanının örnek değişkenliği üzerinde sahip olduğu tek kaldıraç.`ψ`En yüksek yükte, premium kullanıcılar için yükseltin.

## Daha Fazla Okumak

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) StyleGAN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) e4e tersine.
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) StyleGAN-XL.
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) Modern minimal GAN tarifi.
