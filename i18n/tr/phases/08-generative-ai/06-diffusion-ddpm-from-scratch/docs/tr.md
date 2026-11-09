# Diffusion Models  DDPM sıfırdan

> Ho, Jain, Abbeel (2020) alanı durduramadığı bir tarif verdi. Bir bin küçük adım üzerinde gürültü ile verileri yok edin. Gürültüyü tahmin etmek için bir sinir ağı eğit. Süresini çıkarma esnasında tersine çevirin. Bugün her ana akım görüntü, video, 3D ve müzik modeli bu döngü üzerinde çalışır, muhtemelen akış eşleşmesi veya tutarlılık hilelerle üstü.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## Sorun

Örnek almak ister misin ?$p_{\text{data}}(x)$GAN'lar genellikle farklı bir minimum oyun oynar. VAE'ler Gaussian dekodöründen bulanık örnekler üretir. Gerçekten istediğiniz şey (a) tek sabit bir kayıp (saddle point, no minimax) olan bir eğitim hedefi.$\log p(x)$(böylelikle olasılığınız var) ve (c) SOTA kalitesine uyan örnekler.

Sohl-Dickstein et al. (2015) teorik bir cevabı vardı: Markov zinciri tanımlamak $q(x_t \mid x_{t-1})$Bu da yavaş yavaş Gaussian gürültüsünü ekler ve ters bir zincir oluşturur.$p_\theta(x_{t-1} \mid x_t)$Bu, bir kayıpın bir satır olarak basitleştirilebileceğini gösterdi. 2020 yılında bu bir meraklılıktu. 2021 yılında en son örnekler üretti. 2022 yılında Stable Diffusion oldu. 2026 yılında altyapı.

## Anlaşım

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**Gaussian gürültüsünü ekleyin .$T$Kapalı form  matematikin ele alınması 'nin nedeni kumületif adımın da Gaussian olmasıdır:

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

nerede$\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$$\beta_t$- Seç .$\beta_t$1e-4'den 0.02'e lineer olarak geçiyor.$T=1000$adımlar ve $x_T$Yaklaşık olarak $\mathcal{N}(0, I)$- Evet .

**Reverse process $p_\theta$.**Bir sinir ağını öğrenin .$\epsilon_\theta(x_t, t)$Bu da eklenen gürültüyü tahmin eder.$x_t$, aşağıdakilerle tanımlanır:

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

nerede$\sigma_t$Ya da$\sqrt{\beta_t}$Bu ifade çirkin ama sadece cebir  çözmek için $x_{t-1}$Arka tarafı verildiği için$q(x_{t-1} \mid x_t, x_0)$ve yerine getirmek$x_0$gürültü tahminleri ile.

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

Örnek$x_0$Verilerden, rastgele bir seçin.$t$, örnek$\epsilon \sim \mathcal{N}(0, I)$, gürültülü hesaplayın .$x_t$Bir atışta kapalı formda, gürültüye geri döner.

**Sampling.**Başlayın .$x_T \sim \mathcal{N}(0, I)$- Geri adımını tekrarla .$t = T$1'e kadar.

## Neden işe yarıyor?

Üç içgüdü:

1. **Denoising is easy; generating is hard.**- Evet .$t=T$, veriler saf gürültü  ağ küçük bir sorunu çözmek zorunda.$t=0$... ağ sadece birkaç piksel temizlemek zorunda.$t$Bu sorun zor ama ağın her gürültü seviyesinden aynı ağırlıklardan akıp giden birçok gradiyenti var.

2. **Score matching in disguise.**Vincent (2011) gürültü tahmininin tahminle eşdeğer olduğunu kanıtladı $\nabla_x \log q(x_t \mid x_0)$Bu puanı kullanan geri SDE, yoğunluk gradiyenti 'nin yukarısına doğru yüksek olasılık bölgelerine doğru yönlendirilmiş rastgele bir yürüyüş yapar.

3. **The ELBO reduces to simple MSE.**DDPM'nin parametreleştirmesiyle bu KL terimleri, belirli koeficientlerle gürültü öngörüsü üzerinde MSE'ye basitleştirilmiştir; Ho koeficientleri düşürmüştür (sadece kayıp olarak adlandırılır) ve kalitesi * iyileştirilmiştir*.

```figure
diffusion-denoise
```

## Yapın

`code/main.py`1 boyutlu DDPM uygulamasını uyguluyor. Veriler iki modlu bir karışım. "net" ise küçük bir MLP'dir.$(x_t, t)$Bu, bir çizgi kaybı, örneği alınarak geri zincir tekrarlanır.

### Adım 1: Önceki program (kapalı form)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### İkinci adım: örnek`x_t`Tek bir atışta

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### Adım 3: Tek eğitim adımı

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### 4. adım: ters örnekleme

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

40 zaman aşamasıyla ve 24 birim MLP ile 1 boyutlu bir sorun için, bu, iki mod karışımını ~ 200 dönemde öğrenir.

## Zaman şartlandırması

Ağ hangi zaman aşamasını tanımladığını bilmesi gerekiyor.

- **Sinusoidal embedding.**Transformer pozisyon kodlaması gibi.$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$Bir MLP'yi geçiyor ve ağda yayınlanıyor.
- **Film / group-norm conditioning.**Proje, her blokta kanal ölçeğine/kıskançlığa (FiLM) yerleştirilmektedir.

Oyuncak kodumuz sinusoidal → concat kullanıyor.

## Tuzaklar

- **Schedule matters a lot.**Düzsel $\beta$DDPM'nin varsayılan, ancak cosine şeması (Nichol & Dhariwal, 2021) aynı hesaplama için daha iyi FID verir.
- **Timestep embedding is fragile.**Çürük geçiyor .$t$bir yüzerken oyuncak 1-D için çalışır ama görüntüler için başarısız olur; her zaman uygun bir yerleştirme kullanın.
- **V-prediction vs ε-prediction.**Sık rejimler için (çok küçük veya çok büyük t), $\epsilon$Sinyal-gürültü zayıflığı.$v = \alpha \cdot \epsilon - \sigma \cdot x$) daha istikrarlıdır; SDXL, SD3 ve Flux kullanırlar.
- **Classifier-free guidance.**Sonuçta, hem koşullu hem de koşulsuz hesaplayın.$\epsilon$O zaman ...$\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$- Evet .$w \approx 3\text{-}7$8. derste ele alındı.
- **1000 steps is a lot.**Üretim DDIM (20-50 adım), DPM-Solver (10-20 adım) veya destillasyon (1-4 adım) kullanır.

## Kullan

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

Diffusion, evrensel üreticiden oluşan omurgasıdır. Akış eşleşimi (Desin 13) genellikle aynı kalite için çıkarım hızı üzerinde kazanan 2024-2026 rakipidir.

## Gönder

- Kaydet .`outputs/skill-diffusion-trainer.md`. Yetenek bir veri kümesi + hesaplama bütçesi ve çıkışları alır: program (lineer/kosin/sigmoid), tahmin hedefi (ε/v/x), adım sayısı, rehberlik ölçeği, örnekleme ailesi ve değerlendirme protokolü.

## Egzersizler

1. **Easy.**T' yi 40 ' dan 10 ' a değiştirin `code/main.py`- Örnek kalitesi (işlemlerin görsel histogramı) nasıl bozulur?
2. **Medium.**E-büyüklüğünden V-büyüklüğüne geçin. Geri adımları tekrar alın. Son örnek kalitesini karşılaştırın.
3. **Hard.**Sınıf etiketi üzerinde koşul $c \in \lbrace 0, 1 \rbrace$, eğitim sırasında ve örnekleme zamanında kullanımı %10 düşürmek $\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$Şartlı modda vurma oranını ölçmek$w = 0, 1, 3, 7$- Evet .

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | Fixed Markov chain $q(x_t \mid x_{t-1})$ that destroys the data. |
| Reverse process | "Denoising" | Learned chain $p_\theta(x_{t-1} \mid x_t)$ that reconstructs the data. |
| β schedule | "The noise ladder" | Per-step variance; linear, cosine, or sigmoid. |
| α̅ | "Alpha bar" | Cumulative product $\prod (1 - \beta)$; gives closed-form $x_t$ from $x_0$. |
| Simple loss | "MSE on noise" | $\lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$; all variational derivations collapse to this. |
| ε-prediction | "Predict noise" | Output is the noise added; standard DDPM. |
| V-prediction | "Predict velocity" | Output is $\alpha \cdot \epsilon - \sigma \cdot x$; better conditioning across t. |
| DDPM | "The paper" | Ho et al. 2020; linear β, 1000 steps, U-Net. |
| DDIM | "Deterministic sampler" | Non-Markov sampler, 20-50 steps, same training objective. |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional noise predictions to amplify conditioning. |

## Üretim Notu: Diffüzyona ilişkin sonuçlar bir adım sayım sorunu

DDPM kağıdı T=1000 ters adımları çalışır. Kimse üretimde bu gemi. Her gerçek sonuç yığın üç stratejiden birini seçer  ve her haritada temiz bir şekilde üretim çerçevesinde "kenden gecikme geliyor"

1. **Faster sampler, same model.**DDIM (20-50 adım), DPM-Solver++ (10-20), UniPC (8-16).$\epsilon_\theta$Ağırlıklar dokunulmamış.
2. **Distillation.**Öğrenciyi daha az adımla öğretmenine eşleştirmek için eğit: Gelişmiş Destillation (2 → 1), Düzgünlik Modeller (Özbürekli → 1-4), LCM, SDXL-Turbo, SD3-Turbo. Gecikme 5-10 x daha azaltır, yeniden eğitime ihtiyaç duyar.
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`TensorRT-LLM'in yayılma arka planları.`xformers`/SDPA dikkat, bf16 ağırlıkları. Adımlık gecikme ~ 2 ×. (1) ve (2) ile yığılır.

Bir üretim dağıtım sunucu için bütçe konuşması, LLM için üretim literatüründe tarif edilen gibi: gecikme `num_steps × step_cost + VAE_decode`, geçiş `batch_size × (num_steps × step_cost)^-1`TTFT küçüktür (bir adım); TPOT eşdeğeri tam yanıt süresi, çünkü görüntü oluşturma kullanıcı açısından "her zaman"dır.

## Daha Fazla Okumak

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) yayılma kağıdı, zamanından önce.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) DDPM.
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) DDIM, daha az adım.
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672)- Kosinus programı, öğrenilmiş değişim.
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) sınıflandırıcı rehberliği.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598)CFG.
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) Tek bir notasyon, en temiz tarif.
