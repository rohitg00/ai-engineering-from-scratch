# Akış Düzleşimi ve Düzeltme Akışları

> Diffusion modelleri 20-50 örnekleme adımlarını alırlar çünkü gürültüden veriye eğri bir yol izlerler. Akış eşleşimi (Lipman ve diğerleri, 2023) ve düzeltilmiş akış (Liu ve diğerleri, 2022) düz yollar eğitilmiştir. Daha düz yollar daha az adım anlamına gelir daha hızlı sonuçlama anlamına gelir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## Sorun

DDPM'nin ters süreci, 1000 adımlık bir stohastik yürüyüşten $\mathcal{N}(0, I)$Bu nedenle, bu işlemin bir sonraki aşamasında, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir sonraki aşamaları belirlemek için, bir aşamaları belirleme yapmak için, bir aşamaları belirlemeyi belirlemeyi gerektir.

Eğer modelin sesden veriye giden yolu * düz çizgi* olsaydı,$t=1$- ...$t=0$Akış eşleşimi bunu doğrudan oluşturur:$x_1 \sim \mathcal{N}(0, I)$- ...$x_0 \sim \text{data}$, vektör alanı trenle$v_\theta(x, t)$Zaman türevine eşleşmek için, sonuçta entegre.

Düzeltilmiş akış (Liu 2022) daha da ileriye gidiyor: adım adım bir reflow prosedürü ile yolları düzeltir ve bu da gittikçe daha yakın bir lineer ODE üretir.

## Anlaşım

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### Düz çizgi akışı

Define:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

nerede$x_0 \sim \text{data}$ve $x_1 \sim \mathcal{N}(0, I)$Bu düz çizgi boyunca zaman türevini sabit:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

Nöral vektör alanını tanımlayın $v_\theta(x_t, t)$ve bu türevle eşleşmesi için eğitilmiştir:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

Bu da **conditional flow matching**Bu eğitim simülasyonsızdır: ODE'yi asla açmıyorsunuz.$(x_0, x_1, t)$ve geri çekilme.

### Örnekleme

Sonuçta, öğrenilen vektör alanını * geriye* zaman içinde entegre edin:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

Başlayın .$x_1 \sim \mathcal{N}(0, I)$, Euler-adımı aşağıya$t=0$- Evet .

### Düzeltilmiş akış (Liu 2022)

Düz çizgi akışı çalışır ama öğrenilen yollar * aslında düz değil *  onlar eğri çünkü birçok $x_0$Aynı yere haritası yapabilir .$x_1$Düzeltilmiş akışın yeniden akış aşaması:

1. Tren akış modeli $v_1$- Kesinlikle.
2. Örnek N çift $(x_1, x_0)$Entegre ederek $v_1$-$x_1$İnişine kadar$x_0$- Evet .
3. Tren$v_2$Bu çiftler artık "ODE eşleşmiş" olduklarından, aralarındaki düz çizgi interpolant gerçekten daha düz.
4. Tekrar ediyorum.

Pratikte 2 reflow iterasyonları, 2-4 adım sonucu çıkarmayı mümkün kılar. SDXL-Turbo, SD3-Turbo, LCM hepsi akışla eşleşen destil modellerdir.

### Neden bu 2024'te görüntüler için kazandı

Üç neden:

1. **Simulation-free training** eğitim sırasında hiçbir ODE çıkmaz, uygulamak önemsiz.
2. **Better loss geometry** Düz yollar tutarlı bir sinyal-gürültü ile karşılaştırılırken DDPM ε-kayıp programın kenarlarında kötü SNR'ye sahiptir.
3. **Faster inference** SDXL-Turbo kalitesiyle 4-8 adım; tutarlılıklı destillasyonla 1 adım.

## Akış eşleşimi vs DDPM  tam bağlantı

Gaussian koşullu bir yolla akış eşleşmesi, belirli bir gürültü programı ile * difüsiyondır.$x_t = \alpha(t) x_0 + \sigma(t) x_1$Zamanlama ve akış eşleşimi , Stratonovich ' in reformülasyonu ile $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$Bu ikisi Gaussian yolları için cebirsel olarak eşittir.

Akış eşleşimi ne ekledi: hedefin * netliği * (sıradan bir hız), temiz bir kayıp ve Gaussian olmayan interpolantlarla deney yapma izni.

```figure
normalizing-flow
```

## Yapın

`code/main.py`1D akış eşleşmesini iki modlu Gaussian karışımı üzerinde uyguluyor.$v_\theta(x, t)$Bu, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelik yaparak, bir incelemede, bir incelemede, bir incelemede, bir incelik yaparak, bir incelemede, bir incelemede, bir incelemede, bir incelemede, bir incelemede, bir incelemede, bir incelemede, bir incelemede, bir incelemede, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir

### Adım 1: Eğitim kaybı

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### Adım 2: Çok Adımlı Tahmin

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### Adım 3: Adım sayısını karşılaştır

4 adımlı örnekleme cihazının 20 adımlı kaliteye eşleşmesini bekleyin.

## Tuzaklar

- **Time parameterization.**Akış eşleşimi kullanımı $t \in [0, 1]$- Evet .$t=0$Verilerde,$t=1$DDPM kullanıyor $t \in [0, T]$- Evet .$t=0$Verilerde,$t=T$Aynı yönde, farklı ölçekte.
- **Schedule choice.**Düzeltilmiş akışın düz çizgisi "akış eşleşme" programıdır, ancak daha iyi ölçek kapsamı için cosine veya logit-normal t örneğini kullanabilirsiniz (SD3 bunu yapar).
- **Reflow cost.**Yeniden akış için çiftleştirilmiş veri kümesini oluşturmak, örnek başına tam bir sonuç geçişidir. Sadece 1-2 adım sonuç almanız gerektiğinde tekrar akış yapın.
- **Classifier-free guidance still applies.**Sadece değiş .$\epsilon$için$v$Düzsel kombinasyonda: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$- Evet .

## Kullan

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

Bir makalede 2025-2026 yıllarında "difüzondan hızlı" dediğinde neredeyse her zaman akış eşleşmesi + destillasyon oluyor.

## Gönder

- Kaydet .`outputs/skill-fm-tuner.md`. Skill, bir difüzyon tarzında model özellikini alır ve onu akışla eşleşen bir eğitim yapılandırmasına dönüştürür: program seçimi, zaman örneklemesi dağılımı (eşit / logit-normal), optimizer, reflow planı, hedef adım sayımı, eval protokolü.

## Egzersizler

1. **Easy.**Çık .`code/main.py`ve gerçek veri dağıtımına karşı 1 adım vs 20 adım MSE karşılaştırın.
2. **Medium.**Üniforma ' dan geç .$t$Örneklemeyi normal logit'e (t ortasında örneklemeyi yoğunlaştırır) yapılır.
3. **Hard.**Tek tekrar tekrar uygulamak: çift oluşturmak $(x_0, x_1)$İlk modeli entegre ederek, çiftler üzerinde ikinci bir modeli eğitmek ve 1 adım örnek kalitesini karşılaştırmak.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Flow matching | "Straight-line diffusion" | Train $v_\theta(x, t)$ to match $x_1 - x_0$ along an interpolant. |
| Rectified flow | "Reflow" | Iterative procedure that straightens learned flows. |
| Velocity field | "v_θ" | Output of the model — the direction to move $x_t$. |
| Straight-line interpolant | "The path" | $x_t = (1-t) \cdot x_0 + t \cdot x_1$; trivial target derivative. |
| Euler sampler | "1st order ODE solver" | Simplest integrator; works well when paths are straight. |
| Logit-normal t | "SD3 sampling" | Concentrate $t$ sampling toward mid-values where gradients are strongest. |
| Consistency distillation | "1-step sampler" | Train a student to map any $x_t$ directly to $x_0$. |
| CFG with velocity | "v-CFG" | $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$; same trick, new variable. |

## Üretim notu: Flux.1-schnell en hızlı akış eşleşme

Flow matching'in üretim kazancı Flux.1-schnell  bir akış eşleşen DiT Flux-dev dereceli kalitesi korurken 1-4 sonuçlandırma adımlarına doğru destillenir. Niels'in "Run Flux on an 8GB machine" not defteri referans dağıtım tarifi: T5 + CLIP kodlaması, kuantistik MMDiT tanımlaması (sharp vs. 50 için 4 adım), VAE kodlaması.

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

Üretim kuralı: **flow-matched base + distillation = the 2026 default for fast text-to-image.**Her büyük satıcı bu kombinasyonu gönderir: SD3-Turbo (SD3 + akış + destillasyon), Flux-schnell (Flux-dev + düzeltilmiş akış düzeltmesi), CogView-4-Flash.

## Daha Fazla Okumak

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) Düzeltilmiş akış.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) akış eşleşimi.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, ölçekte düzeltilmiş akış.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) FM + yayılımı kapsadığı genel çerçeve.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) 1 aşamalı difüzyon/ akış destilasyonu.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042)Turbo varianti.
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) üretimdeki akış eşleşimi.
