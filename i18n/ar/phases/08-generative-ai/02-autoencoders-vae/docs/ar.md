# المُحَرِّفات الذاتية والمتغيرات المُحَرِّفات الذاتية (VAE)

> يقوم جهاز تشفير السيارات العادي بتقليص ثم بإعادة تشكيل. يتذكر. لا يولد. أضف خدعة واحدة  اضغط على الرمز ليظهر غوسيان  وستحصل على عينة. هذه الخدعة الوحيدة، إعادة تشكيل$z = \mu + \sigma \cdot \epsilon$ولهذا السبب كل نموذج تصوير متساوٍ للتنشر الخفيف والتي تستخدمها في عام 2026 لديه VAE عند المدخل.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## المشكلة

قم بتضغط رقم من 784 بكسل على رمز 16 رقماً ثم قم بإعادة تشكيل. سوف يقوم جهاز تشكيل السيارات العادي بإعادة تشكيل MSE ولكن مساحة الرمز هي فوضى ضخمة. اختر نقطة عشوائية في مساحة الرمز، فكرها، وستحصل على ضجيج. ليس لديها عينة. إنه نموذج ضغط مرتدياً.

ما تريد حقا هو: (أ) مساحة الرمز هو صافي، وتوزيع سلس يمكنك أن تأخذ عينات من  قل غوسيانية متوازية $\mathcal{N}(0, I)$(ب) تشفير أي عينة ينتج رقم معقول، و (ج) تشفير و تشفير لا يزال الضغط جيد. ثلاثة أهداف، بنية واحدة، خسارة واحدة.

حل VAE 2013 Kingma هذا عن طريق تدريب المُرمّد لإخراج * توزيع*$q(z \mid x) = \mathcal{N}(\mu(x), \sigma(x)^2)$، سحب هذا التوزيع نحو البار$\mathcal{N}(0, I)$عبر عقوبة KL، ثم أخذ العينات$z$من$q(z \mid x)$قبل فك الشفرة. في وقت الاستنتاج، إسقط المشفر، العينة $z \sim \mathcal{N}(0, I)$عقوبة ك.إل هي ما يفرض على مساحة الرمز أن تكون مهيكلة.

في عام 2026 نادرًا ما تقوم VAEs بالشحن بمفردها  تم تفوقها من خلال التوزيع لجودة الصورة الخام  ولكنها هي مرموزة الاختيار لكل نموذج للتوزيع الخاطئ (SD 1/2/XL/3, Flux, AudioCraft). تعلم VAE وتتعلم الطبقة الأولى غير المرئية لكل خط أنابيب الصورة التي تستخدمها.

## المفهوم

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$،$\hat{x} = \text{decoder}(z)$، الخسارة = $\lVert x - \hat{x} \rVert^2$-المكان غير المهيكلي

**VAE encoder.**النتائج اثنين من المتجهات: $\mu(x)$و$\log \sigma^2(x)$هذه تحدد$q(z \mid x) = \mathcal{N}(\mu, \mathop{\mathrm{diag}}(\sigma^2))$. . .

**Reparameterization trick.**أخذ العينات من$q(z \mid x)$لا يمكن التمييز. أعيد كتابة العينة على النحو$z = \mu + \sigma \cdot \epsilon$أين$\epsilon \sim \mathcal{N}(0, I)$الآن$z$هو وظيفة تحديدية من$(\mu, \sigma)$بالإضافة إلى ضجيج غير معين  تدفق التدرج `μ`و$\sigma$. . .

**Loss.**دليل (الربط السفلي) ، شروطتان:

```math
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\Vert\, \mathcal{N}(0, I)] \\
&= \lVert x - \hat{x} \rVert^2 + \beta \cdot \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}
\end{aligned}
```

إعادة الإعمار تدفع$\hat{x}$نحو$x$. كيل يدفع$q(z \mid x)$إلى القسّة، يتبادلون$\beta$($<1$) = عينات أكثر وضوحاً، مساحة الرمز أقل غوسيانية.$\beta$($>1$) = مساحة رمز أكثر نظافة، عينات أكثر وضوحا. β-VAE (Higgins 2017) جعل هذه الزر مشهورة وبدأت دراسة التفريق.

**Sampling.**عند الاستنتاج: رسم$z \sim \mathcal{N}(0, I)$لا يوجد عينة متكررة مثل التوزيع

```figure
vae-latent-grid
```

## بناءها

`code/main.py`يطبق VAE صغير دون نومبي أو مشعل. المدخل هو بيانات اصطناعية 8-dimensional استخدمت من مزيج غوسيان 2-كون في 8-D. Encoder و decoder MLPs واحد مخفي الطبقة. نطبق تنح تفعيل، المضي قدما، الخسارة، والمركبة الخلفية مكتوبة يدويا. ليس الإنتاج  التربية.

### الخطوة 1: المُشفّر إلى الأمام

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$بدلاً من$\sigma$لذلك إنتاج الشبكة غير مقيد (رمل زائد من σ هو فخ  تراجيع يموت في $\sigma \approx 0$)

### الخطوة الثانية: إعادة تشكيل وتحديد المعدلات

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### الخطوة الثالثة: الـ ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

كيل بالضبط في شكل مغلق لأن كلا التوزيعين غوسيان. لا تتكامل عددا. الناس لا يزالون يرسلون الرمز مع مونت كارلو تقديرات كيل في 2026  هو بطيء 3x دون سبب.

### الخطوة الرابعة: توليد

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

هذا هو النموذج التوليد خمسة خطوط

## الفخاخ

- **Posterior collapse.**محركات قيادة المدة$q(z \mid x) \to \mathcal{N}(0, I)$بفعالية كبيرة$z$لا يحمل أي معلومات عن$x$. إصلاح: التخفيض β (بدء $\beta=0$، الرمب إلى 1), بثات حرّة، أو تخطي KL على الأبعاد غير النشطة.
- **Blurry samples.**احتمالات القيادة الجاوسي تشير إلى إعادة بناء MSE ، وهو مطلوب بايز ل L2 (المتوسط)  متوسط مجموعة من الأرقام المثيرة للصدق هو رقم غامض. تحديد: القيادة المفصلة (VQ-VAE ، NVAE) ، أو استخدام VAE فقط كمُخترع وتوزيع كومة على الاختفاء (هذا ما يفعله Diffusion Stable).
- **β too large, too early.**انظر الانهيار اللاحق.$\beta \approx 0.01$و الرامب
- **Latent dim too small.**يعمل 16-D لـ MNIST ، 256-D لـ ImageNet 2562 ، 2048-D لـ ImageNet 10242. VAE من Stable Diffusion يضغط على 512 × 512 × 3 → 64 × 64 × 4 (8x downsample لكل جانب ، 64x في المساحة الفضائية ؛ القنوات تذهب من 3 إلى 4 ، لذلك حوالي 48x أقل قيمًا بشكل عام).

## استخدمها

مجموعة "2026" في إيران:

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

نموذج الانتشار الخفيف هو VAE مع نموذج الانتشار يعيش بين المُشفّر والمنشط. يقوم VAE بالضغط الخام، يقوم نموذج الانتشار بالرفع الثقيل. نفس النموذج للفيديو (VAE + DiT) والصوت (Encodec + MusicGen Transformer).

## أرسله

إنقاذ`outputs/skill-vae-trainer.md`. . .

المهارات: ملف مجموعة البيانات + هدف التخفيض المتخفيض + استخدامها في المستقبل (إعادة الإعمار أو أخذ العينات أو مدخل التوزيع المتخفيض) والخروج: اختيار الهندسة المعمارية (بطنة / β / VQ / RVQ) ، جدول β ، التخفيض المتخفيض ، احتمالات المقاطع (غوسيان مقابل فئة) ، وخطة التقييم (تعريف MSE ، KL لكل ضوء ، مسافة Fréchet بين $q(z \mid x)$و$\mathcal{N}(0, I))$. . .

## التمارين

1. **Easy.**التغيير$\beta$في`code/main.py`إلى`0.01`،`0.1`،`1.0`،`5.0`. سجل الإعادة الإعمار النهائية MSE و KL .$\beta$هل (باريتو) أفضل للبيانات الاصطناعية الخاصة بك؟
2. **Medium.**استبدل احتمالات القيادة الجاوسي بعقيدة بيرنولي (خسارة الانتروبيا المتقاطعة). مقارنة نوعية العينة على نسخة ثنائية من نفس البيانات الاصطناعية.
3. **Hard.**التمديد`code/main.py`إلى VQ-VAE صغير: استبدال المستمر $z$مع البحث عن أقرب جيران في كتاب كود من إدخالات K=32. مقارنة إعادة الإعمار MSE وتقرير عدد إدخالات كودك استخدام (انهيار كودكوب حقيقي).

## الشروط الرئيسية

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

## ملاحظة الإنتاج: الممر المكثف هو أكثر مسار حرارة في خادم التوزيع

في خط أنابيب Diffusion / Flux / SD3 المستقر يتم استدعاء VAE مرتين لكل طلب  مرة واحدة لترميز (إذا كنت تفعل img2img / inpainting) ومرة واحدة لترميز. في 10242 مرسلة المقرر غالبا ما تكون أكبر ذروة تنشيط ذاكرة واحدة في خط الأنابيب كله لأنه يظهر`128×128×16`الاختفاءات العودة إلى`1024×1024×3`اثنين من العواقب العملية:

- **Slice or tile the decode.** `diffusers`يُعرض`pipe.vae.enable_slicing()`و`pipe.vae.enable_tiling()`تيلينغ تجارية صغيرة القطع الأثرية للخياطة$O(\text{tile}^2)$الذاكرة بدلاً من$O(H \cdot W)$. ضروري لـ 10242+ على أجهزة البيانات المعالجة البيانية المستهلكة
- **bf16 decoder, fp32 numerics for the final resize.**تم إطلاق SD 1.x VAE في fp32 و * ينتج بصمت NaNs * عند إلقاء إلى fp16 في 10242 + سفن SDXL `madebyollin/sdxl-vae-fp16-fix` تفضل دائماً الإصدار المثبت fp16-fix أو استخدم bf16.

## المزيد من القراءة

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) ورقة VAE
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) التفريق بين β- VAE
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) VQ-VAE
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) صورة حديثة في الفن
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) انتشار مستقيم؛ VAE كمُخترف.
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438)إنكودك، معيار الصوت في إيه إيه
