# GANs  ژنراتور در مقابل متمایز کننده

> در سال 2014، خدشه ی گودفلو این بود که تمام تراکم را رد کند. دو شبکه. یکی ساخت ساختارهای جعلی را می کند. یکی آنها را می گیرد. آنها تا زمانی که ساختارهای جعلی از واقعی جدا نمی شوند، مبارزه می کنند. این کار نباید کار کند. اغلب کار نمی کند. وقتی انجام می شود، نمونه ها هنوز هم در ادبیات برای دامنه های باریک تیز ترین هستند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## مشکل

VAEs نمونه های مبهم تولید می کنند زیرا از دست دادن دیکودر MSE آنها برای تصویر * متوسط * مطلوب است و متوسط بسیاری از ارقام قابل قبول یک ارقام مبهم است. شما می خواهید یک از دست دادن که * قابل قبولیت * را پاداش دهد ، نه نزدیکی به یک هدف. هیچ فرم بسته ای برای قابل قبولیت وجود ندارد. شما باید آن را یاد بگیرید.

ایده گودفلو: آموزش یک طبقه بندی کننده$D(x)$براي تفرق بين عکس هاي واقعي و ساختگي$G(z)$احمق شدن$D$. سیگنال تلفات برای$G$هر چی باشه$D$در حال حاضر فکر می کند چیزی را به نظر می رسد واقعی است. این سیگنال به روز می شود به عنوان$G$اگه هر دو شبکه همگام بشه$G$بدون اينکه هيچ وقت به نوشتن بريم اطلاعات رو ياد گرفت`log p(x)`. .

اين آموزش ضد است. رياضي يه بازي حداقل است:

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

در سال 2026 GAN ها دیگر ژنراتور SOTA نیستند (توزاندن و تطابق جریان آن تاج را خورد). اما StyleGAN 2/3 همچنان تیزترین مدل های صورتی است که تاکنون ارسال شده است، متمایز کننده های GAN به عنوان * از دست دادن های درک* در آموزش انتشار استفاده می شوند و آموزش ضدکار به تزریق سریع 1 مرحله (SDXL-Turbo، SD3-Turbo، LCM) که به شما اجازه می دهد در زمان واقعی انتشار ارسال کنید، کمک می کند.

## مفهوم

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**نقشه بردار شور$z \sim \mathcal{N}(0, I)$به نمونه ای$\hat{x}$. یک شبکه شکل دیکودر (بنده یا انتقال پذیر)

**Discriminator $D(x)$.**نقشه نمونه ای به احتمال اسکالر (یا امتیاز)

**Loss.**دو تا تازه کاری متناوب:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$. دوگانه ترپايي در واقع=1، جعلی=0
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$این فرم غیر تشباع کننده ای است که Goodfellow استفاده می کند (اصل)$\log(1 - D(G(z)))$وقتی که $D$مطمئن است.

**Training loop.**يه قدم از$D$، يک قدم از$G$تکرار کنم

**Why it works.**اگه$G$کاملاً با هم مطابقت داره$p_{\text{data}}$، پس$D$نمیتونن بهتر از شانس کار کنن و همه جا 0.5 محصول دارن$G$هيچ گرادينت ديگه اي نداره.

**Why it breaks.**سقوط حالت ($G$يه حالت پيدا مي کنه$D$نميتونم اينو طبقه بندي کنم و براي هميشه به اين موضوع فکر کنم$D$خیلی سریع یاد میگیرن و$\log D$در این زمینه، این موضوع در مورد "مجموعه های مختلف" و "مجموعه های مختلف" در مورد "مجموعه های مختلف" و "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" و "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه های مختلف" در مورد "مجموعه" در مورد "مجموعه" در مورد "مجموعه" در مورد "مجموعه" در مورد "مجموعه" در مورد "مجموعه" در مورد "مجموعه" در مورد "مجموعه" در مورد "مجموعه " است.

## انواع کاری که باعث می شد GAN ها کار کنند

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

## آن را بسازید

`code/main.py`یک ژنراتور و یک تبعیضگر MLPs لایه ای پنهان هستند. ما به صورت دستی حرکت می کنیم به جلو، عقب و حلقه minimax. هدف این است که دو حالت شکست کلیدی (طرح سقوط + گرادیانت ناپدید شدن) را در حالی که اتفاق می افتد مشاهده کنیم.

### مرحله ی اول: از دست دادن غیر تشباع

وانيلا Goodfellow از دست دادن$\log(1 - D(G(z)))$در این مرحله گرادینت برای G اساسا صفر است  G نمی تواند بهبود یابد. شکل غیر تشباع $-\log D(G(z))$این یک اسیمپتوتی برعکس دارد: وقتی D مطمئن است، منفجر می شود، و به G یک سیگنال قوی می دهد.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### مرحله دوم: یک مرحله تبعیضگر در هر مرحله ژنراتور

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

جوري هاي جديد براي "گ" ، در غير اين صورت گرادينت ها قدیمی ميشن

### مرحله 3: مراقب سقوط حالت

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

علائم قانونی: یکی از دو حالت واقعی تولید شدن را متوقف می کند. تبعیضگر اصلاحش را متوقف می کند زیرا هرگز به عنوان جعلی دیده نمی شود.

## دام ها

- **Discriminator too strong.**سرعت یادگیری D را 2-5x کاهش دهید یا صداهای نمونه/طبق را اضافه کنید. اگر D به دقت >95٪ برسد، G مرده است.
- **Generator memorizes a mode.**صدا را به ورودی D اضافه کنید، از یک لایه ی کوچک جدا کننده دسته استفاده کنید یا به WGAN-GP تغییر دهید.
- **Batch norm leaking statistics.**دسته واقعی + دسته جعلی که از طریق همان لایه BN جریان دارد آمار خود را مخلوط می کند.
- **Inception-score gaming.**FID و IS در تعداد نمونه های پایین سر و صدا هستند.
- **One-shot sampling is a lie for conditional tasks.**هنوز هم به ترازو CFG، ترفند های ترازو و نمونه گیری مجدد برای دریافت محصول قابل استفاده نیاز دارید.

## ازش استفاده کن

دسته گان 2026:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

GAN ها تیز اما تنگ هستند. هنگامی که دامنه شما  عکس ها را باز می کند، پیام های متناظر، ویدئو  به انتشار می پیوندد. ترفند مخالف به عنوان یک عنصر (خسرهای درک، تخلیه) ادامه می یابد، نه یک ژنراتور مستقل.

## -باده

نگه دار`outputs/skill-gan-debugger.md`. مهارت یک اجرا GAN شکست خورده (سیرهای از دست دادن، شبکه نمونه، اندازه مجموعه داده ها) را می گیرد و یک لیست مرتب از علل احتمالی، اصلاحات یک خط و پروتکل تکرار را تولید می کند.

## تمرینات

1. **Easy.**فرار کن`code/main.py`با تنظیمات سهام.`D_LR = 5 * G_LR`و دوباره تکرارش کن. ضايع G چقدر سریع به ثابت سقوط می کند؟
2. **Medium.**خسارت Goodfellow BCE را با خسارت WGAN جایگزین کنید: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$،$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$، و وزن D رو به `[-0.01, 0.01]`آموزش مستقر تر هست؟
3. **Hard.**مثال 1-D را به داده های 2-D (مختلله 8 گاسیان در حلقه) گسترش دهید. ردیابی کنید که چند حالت از 8 حالت ژنراتور در مراحل 1k، 5k، 10k را ضبط می کند. تبعیض دسته کوچک را پیاده سازی کنید و دوباره اندازه گیری کنید.

## اصطلاحات کلیدی

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

## توجه به تولید: نتیجه گیری یکبارانه، مزیت پایدار GAN است

GAN ها دیگر از کیفیت نمونه برای تولید دامنه باز برنده نمی شوند، اما هنوز هم از هزینه نتیجه گیری برنده می شوند. در لغات ادبیات تولید-تثبیت، یک GAN دارای:

- **No prefill, no decode stages.**یک نفر$G(z)$.تفتي ≈ تمام دير
- **No KV-cache pressure.**تنها حالت وزنهاست. اندازه دسته توسط حافظه فعاليت محدود شده، نه حافظه کش
- **Trivial continuous batching.**از آنجا که هر درخواست دارای همان FLOPs ثابت است، یک دسته ثابت در محل کار هدف سرور معمولاً مطلوب است. هیچ برنامه ریزی کننده در پرواز مورد نیاز نیست.

به همین دلیل است که نشت GAN (SDXL-Turbo، SD3-Turbo، ADD، LCM) تکنیک اصلی برای سریع متن به تصویر در سال 2026 است: این یک لوله انتشار 20-50 مرحله را به 1-4 GAN سبک پیش می گذارد در حالی که توزیع یک پایه انتشار را حفظ می کند. از دست دادن مخالف به عنوان یک دکمه زمان آموزش برای تبدیل ژنراتور های آهسته به سریع زنده می ماند.

## خواندن بیشتر

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) کاغذ اصلی GAN
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) اولین معماری پایدار
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) SDXL-توربو
