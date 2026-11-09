# خودکار کدرها و خودکار کدرها (VAE)

> یک کد خودکار ساده فشرده می شود و سپس بازسازی می کند. آن را به یاد می آورد. تولید نمی کند. یک ترفند اضافه کنید  کد را مجبور کنید تا به نظر گاوسیان  برسد و شما یک نمونه گیر می گیرید. این ترفند، بازسازی ترفند$z = \mu + \sigma \cdot \epsilon$، به همین دلیل است که هر مدل تصویر انتشار خفیه و جریان مطابقت شما در 2026 استفاده می کند یک VAE در ورودی دارد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## مشکل

یک عدد MNIST 784 پیکسل را به یک کد 16 عدد فشرده کنید، سپس بازسازی کنید. یک خودکار کدگذاری ساده بازسازی MSE را انجام می دهد اما فضای کد یک آشفتگی است. یک نقطه تصادفی را در فضای کد انتخاب کنید، آن را رمزگذاری کنید و شما صدای می گیرید. این هیچ نمونه ای ندارد. این یک مدل فشرده سازی لباس پوشیده است.

آنچه شما واقعا می خواهید این است: (ا) فضای کد یک توزیع تمیز و صاف است که می توانید از نمونه گیری از  به عنوان مثال یک گاسیان اسیتروپک $\mathcal{N}(0, I)$، (ب) رمزگذاری هر نمونه یک رقم قابل باور را تولید می کند و (ج) رمزگذاری و رمزگذاری هنوز هم فشرده می شوند. سه هدف، یک معماری، یک از دست دادن.

VAE 2013 Kingma با آموزش کدرها برای تولید یک * توزیع *$q(z \mid x) = \mathcal{N}(\mu(x), \sigma(x)^2)$، اين توزیع رو به سمت قبل کشيده$\mathcal{N}(0, I)$از طریق مجازات KL و بعد نمونه گیری$z$از$q(z \mid x)$قبل از رمزگشایی. در زمان نتیجه گیری، رمزگشایی را رها کنید، نمونه$z \sim \mathcal{N}(0, I)$مجازات KL چیزیه که باعث می شه فضای کد ساختار پیدا کنه

در سال 2026 VAEs به ندرت به تنهایی ارسال می شوند  آنها از طریق انتشار برای کیفیت تصویر خام برتر شده اند  اما آنها کدگر انتخاب برای هر مدل انتشار پنهان (SD 1/2/XL/3, Flux, AudioCraft) هستند. VAE را یاد بگیرید و لایه اول نامرئی هر خط لوله تصویر را که استفاده می کنید یاد خواهید گرفت.

## مفهوم

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$،$\hat{x} = \text{decoder}(z)$، از دست دادن = $\lVert x - \hat{x} \rVert^2$. فضای کد غیر ساختار یافته

**VAE encoder.**دو متری خارج می شود:$\mu(x)$و$\log \sigma^2(x)$اينها تعريف ميکنن$q(z \mid x) = \mathcal{N}(\mu, \mathop{\mathrm{diag}}(\sigma^2))$. .

**Reparameterization trick.**نمونه گیری از$q(z \mid x)$قابل تشخیص نیست. نمونه را به عنوان$z = \mu + \sigma \cdot \epsilon$کجا$\epsilon \sim \mathcal{N}(0, I)$حالا$z$یک تابع تعیین کننده از$(\mu, \sigma)$+ صدا غیر پارامتر  گرادینت ها از طریقش جریان می گیرند `μ`و$\sigma$. .

**Loss.**شواهد پایین تر (ELBO) ، دو اصطلاح:

```math
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\Vert\, \mathcal{N}(0, I)] \\
&= \lVert x - \hat{x} \rVert^2 + \beta \cdot \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}
\end{aligned}
```

بازسازی به دنبالش میره$\hat{x}$به سمت$x$. کلو فشار ميده$q(z \mid x)$به سمت قبلي مي گيرند$\beta$($<1$) = نمونه های تیز تر، فضای کد کمتر گاسین.$\beta$($>1$) = فضای کد تمیز تر، نمونه های مبهمتر. β-VAE (Higgins 2017) این دکمه را مشهور کرد و تحقیقات جدایی را آغاز کرد.

**Sampling.**در نتیجه: تراش$z \sim \mathcal{N}(0, I)$، به جلو از طریق دیکودر. یک عبور به جلو  هیچ نمونه گیری تکراری مانند انتشار.

```figure
vae-latent-grid
```

## آن را بسازید

`code/main.py`این برنامه یک VAE کوچک بدون numpy یا مشعل را اجرا می کند. ورودی داده های مصنوعی 8- بعدی است که از یک ترکیب 2-مكونه گوسسی در 8-D گرفته شده است. کدگر و دیکودر MLPs لایه مخفی واحد هستند. ما فعال سازی tanh، عبور جلو، از دست دادن و یک عبور دست نوشته عقب را اجرا می کنیم. نه تولید  آموزش.

### مرحله اول: کدگر جلو

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$به جای$\sigma$بنابراین خروجی شبکه بدون محدودیت است (رزش نرم از σ یک دام است  گرادینت ها در $\sigma \approx 0$)

### مرحله دوم: دوباره اندازه گیری و رمزگذاری

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### مرحله سوم: ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

دقیقاً به شکل بسته KL چون هر دو توزیع گاوسی هستند. به صورت عددی همگام نمی شوند. مردم هنوز کد را با تخمین مونت کارلو KL در سال 2026 ارسال می کنند  بدون هیچ دلیل 3x کندتر است.

### مرحله 4: تولید

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

این مدل تولید کننده است. پنج خط.

## دام ها

- **Posterior collapse.**دوری های مهدی KL$q(z \mid x) \to \mathcal{N}(0, I)$خیلی تهاجمی که$z$هيچ اطلاعاتي در موردش نداره$x$. تصميم: ب- انل (شروع $\beta=0$، رامپ به 1), بایت های آزاد، یا از KL در ابعاد غیر فعال عبور کنید.
- **Blurry samples.**احتمال گاوسیان از کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد کد
- **β too large, too early.**سقوط عقب رو ببينيد.$\beta \approx 0.01$و رامپ
- **Latent dim too small.**16-D برای MNIST، 256-D برای ImageNet 2562, 2048-D برای ImageNet 10242 کار می کند. VAE انتشار پایدار 512 × 512 × 3 → 64 × 64 × 4 (8x downsample per side, 64x in spatial area; channels go from 3 to 4, so about 48x fewer values overall) را فشرده می کند.

## ازش استفاده کن

دسته VAE 2026:

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

یک مدل انتشار غیب یک مدل VAE است که دارای یک مدل انتشار است که بین کدگر و دیکودر زندگی می کند. VAE فشرده سازی را انجام می دهد، مدل انتشار را انجام می دهد. الگوی مشابه برای ویدیو (VAE + video-diffusion DiT) و صوتی (Encodec + MusicGen transformator).

## -باده

نگه دار`outputs/skill-vae-trainer.md`. .

مهارت های لازم: مشخصات مجموعه داده ها + هدف غش غش + استفاده در جریان پایین (تعمیر مجدد، نمونه گیری یا ورودی انتشار غش) و نتایج: انتخاب معماری (بست/β/VQ/RVQ) ، برنامه β، غش غش، احتمال دیکوتر (گاوسین در مقابل قطعی) و برنامه ارزیابی (MSE تایید، KL در هر غش، فاصله Fréchet بین $q(z \mid x)$و$\mathcal{N}(0, I))$. .

## تمرینات

1. **Easy.**تغییر$\beta$در`code/main.py`به`0.01`،`0.1`،`1.0`،`5.0`. ضبط بازسازی نهایی MSE و KL$\beta$پارتو براي داده هاي مصنوعي شما بهترين است؟
2. **Medium.**احتمال گاوسی را با احتمال برنولی (خسارت انتروپی کراس) جایگزین کنید. کیفیت نمونه را در نسخه دوگانه ای از همان داده های مصنوعی مقایسه کنید.
3. **Hard.**طولاني`code/main.py`به یک VQ-VAE کوچک تبدیل کنید: جایگزین کنترول های مداوم کنید$z$با جستجوی نزدیکترین همسایه در یک کد بوک از K=32 ورودی مقایسه کنید MSE بازسازی و گزارش کنید که چه تعداد ورودی کد بوک مورد استفاده قرار می گیرد (تراکم کد بوک واقعی است).

## اصطلاحات کلیدی

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

## توجه به تولید: VAE گرمترین مسیر در یک سرور انتشار است

در یک لوله لوله Stable Diffusion / Flux / SD3 VAE به هر درخواست دو بار تماس می گیرد  یک بار برای کدگذاری (اگر انجام img2img / inpainting) و یک بار برای رمزگذاری. در 10242، عبور decoder اغلب بزرگترین اوج فعال سازی حافظه در کل لوله است زیرا آن را بالا می برد `128×128×16`به سمت " لانت " برگرديم`1024×1024×3`دو تا عواقب عملی:

- **Slice or tile the decode.** `diffusers`افشا می کند`pipe.vae.enable_slicing()`و`pipe.vae.enable_tiling()`. تيلینگ يه مصنوعي کوچک از خياط براي$O(\text{tile}^2)$حافظه به جای$O(H \cdot W)$. لازم برای 10242+ در GPU مصرف کننده
- **bf16 decoder, fp32 numerics for the final resize.**SD 1.x VAE در fp32 منتشر شد و * خاموش تولید NaNs* هنگامی که به fp16 در 10242 + کشتی SDXL `madebyollin/sdxl-vae-fp16-fix` همیشه گزینه fp16-fix را ترجیح دهید یا از bf16 استفاده کنید.

## خواندن بیشتر

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) کاغذ VAE
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) β-VAE از هم جدا شده است.
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) VQ-VAE
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) تصویر پیشرفته VAE
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) انتشار پایدار؛ VAE به عنوان کدگر.
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) Encodec، استاندارد صدا VAE.
