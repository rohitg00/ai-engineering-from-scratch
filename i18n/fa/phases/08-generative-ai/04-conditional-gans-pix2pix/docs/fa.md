# GAN های مشروط & Pix2Pix

> اولین باز کردن بزرگ سال 2014-2017 کنترل آنچه که یک GAN می کند بود. برچسب، یا یک تصویر، یا یک جمله را متصل کنید. Pix2Pix نسخه تصویر را انجام داد و هنوز هم هر مدل عمومی متن به تصویر را در وظایف باریک تصویر به تصویر شکست می دهد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## مشکل

یک GAN بی قید و شرط نمونه های صورت های تعسفی. مفید برای یک نمایش، بی فایده در تولید. شما می خواهید: * نقشه یک طرح به یک عکس * نقشه یک نقشه به یک عکس هوایی * نقشه یک صحنه روز به شب * رنگ یک تصویر خاکستری در همه اینها، شما یک تصویر ورودی داده می شود$x$و بايد ازش استفاده کنم$y$با یه جورایی مطابقت معنوی وجود داره$y$هر دو$x$. اشتباه متوسط مربع آنها را به مشه می کند . یک شکست مخالف نمی کند ، چون "به نظر واقعی" تیز است

GAN مشروط (Mirza & Osindero، 2014) یک شرط اضافه می کند $c$به عنوان یک ورودی برای هر دو $G$و$D$Pix2Pix (Isola et al., 2017) این را تخصص کرد: حالت یک تصویر ورودی کامل است، ژنراتور یک U-Net است، تبعیضگر یک طبقه بندی مبتنی بر پیچ (PatchGAN) است و از دست دادن + L1 است. این دستور از ابتدا از متن به تصویر در دامنه های باریک تصویر به تصویر حتی در سال 2026 بهتر است زیرا بر اساس * داده های جفت شده آموزش دیده است.

## مفهوم

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$. در Pix2Pix ,$z$در داخل G (هیچ صدا در ورودی  Isola یافت صدا صریح نادیده گرفته شده است)

**Conditional D.** $D(x, y) \to [0, 1]$. ورودی *دوتا* (شرط، خروجی) است. این تفاوت اصلی است: D باید قضاوت کند که آیا$y$با $x$نه فقط اینکه$y$به نظر واقعي مياد

**U-Net generator.**کدگر-دکودر با اتصال های skip در سراسر گلو بطری. برای وظایف که ورودی و خروجی ساختار سطح پایین (حواها، شیشۀ) را به اشتراک می گذارند، حیاتی است. بدون skip، جزئیات فرکانس بالا ناپدید می شوند.

**PatchGAN discriminator.**به جای تولید یک نمره واقعی/زبانی، D یک نمره تولید می کند$N \times N$شبکه ای که هر سلول یک میدان پذیرایی از ~70 × 70 پیکسل را قضاوت می کند. متوسط. این فرضیه میدان تصادفی مارکوف است: واقع گرایی محلی است. آموزش بسیار سریع تر، پارامترهای کمتری، خروجی تیز تر است.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

اصطلاح L1 آموزش را ثابت می کند و G را به سمت هدف شناخته شده ای فشار می دهد. L1 حاشیه های تیز تر از L2 (وسط، نه میانگین) را می دهد. $\lambda = 100$پیش فرض Pix2Pix بود.

## CycleGAN  وقتی که جفتی ندارید

نیاز به جفت کردن Pix2Pix$(x, y)$CycleGAN (Zhu et al., 2017) این الزامات را با هزینه یک ضرر اضافی کاهش می دهد: * ضایع ثبات چرخه. دو ژنراتور $G: X \to Y$و$F: Y \to X$. آموزششون بده$F(G(x)) \approx x$و$G(F(y)) \approx y$این اجازه می دهد تا شما اسب را به زبرات ترجمه کنید، تابستان به زمستان، بدون مثال های جفت.

در سال 2026، تصویر به تصویر بدون جفت بیشتر از طریق انتشار (ControlNet، IP-Adapter) به جای CycleGAN انجام می شود، اما ایده سازگار بودن چرخه در تقریباً هر مقاله تطبیق دامنه بدون جفت زنده می ماند.

```figure
gx-patchgan
```

## آن را بسازید

`code/main.py`به نظر می رسد که این سیستم یک GAN مشروط کوچک را روی داده های یک بعدی اجرا می کند.$c$یک برچسب کلاس (0 یا 1) است. وظیفه: تولید نمونه از توزیع مشروط برای کلاس داده شده است.

### مرحله 1: شرط را به ورودی G و D اضافه کنید

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

کدگذاری یک گرم ساده ترین راه است. مدل های بزرگتر از گنجانده های آموخته، مدل سازی FiLM یا توجه متقابل استفاده می کنند.

### مرحله دوم: قطار مشروط

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

ژنراتور باید با توزیع واقعی * برای شرایط داده شده * مطابقت داشته باشد، نه با حاشیه.

### مرحله 3: بررسی خروجی در هر کلاس

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## دام ها

- **Condition ignored.**G یاد می گیرد که کنار گذاشته شود، D هرگز مجازات نمی کند زیرا سیگنال وضعیت ضعیف است. اصلاح: حالت D به طور تهاجمی تر (طبق اولیه، نه فقط دیر) ، استفاده از متمایز کننده پروژکتور (Miyato & Koyama 2018)
- **L1 weight too low.**G به نتيجهاي واقعي و تعسفي ميگيره نه به نتيجهاي وفادار$\lambda \approx 100$برای وظایف سبک Pix2Pix.
- **L1 weight too high.**G تولیدات پراکنده ای را ایجاد می کند چون L1 هنوز یک $L_p$وقتي که تمرین مستقر بشه
- **Ground-truth leakage in D.**کنکاتنات$(x, y)$به عنوان D input، نه فقط$y$بدون اين "دي" نميتونم همبستگی رو چک کنم
- **Mode collapse per class.**هر کلاس مي تونه به طور مستقل سقوط کنه.

## ازش استفاده کن

2026 وضعیت وظایف تصویر به تصویر:

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

Pix2Pix ابزار مناسب باقی می ماند زمانی که (ا) شما هزاران مثال جفت داشته باشید، (ب) کار محدود و تکرار پذیر است و (ج) شما نیاز به نتیجه گیری سریع دارید. در کارهای عمومی دامنه باز، انتشار برنده می شود.

## -باده

نگه دار`outputs/skill-img2img-chooser.md`مهارت یک توصیف کار، دسترسی به داده ها (مجموعه های جفت و غیر جفت، نمونه های N) و بودجه تاخیر/کوالتی را می گیرد، سپس نتایج: رویکرد (Pix2Pix، CycleGAN، ویرانت ControlNet، SDXL + IP-Adapter) ، نیازهای داده های آموزشی، هزینه نتیجه گیری و پروتکل ارزیابی (LPIPS، FID، خاص وظیفه).

## تمرینات

1. **Easy.**تغییرش`code/main.py`برای اضافه کردن کلاس سوم. تایید G هنوز هم نقشه های هر کلاس صدا به حالت درست.
2. **Medium.**جایگزین L1 با یک از دست دادن سبک ادراک در تنظیم 1-D (به عنوان مثال یک D کوچک منجمد که به عنوان استخراج کننده ویژگی عمل می کند) آیا آن تغییر در شدت توزیع مشروط می کند؟
3. **Hard.**یک CycleGAN را در تنظیم 1-D رسم کنید: دو توزیع، دو ژنراتور، از دست دادن چرخه. نشان دهید که یاد می گیرد تا بدون داده های جفت بین آنها نقشه برداری کند.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## یادداشت تولید: Pix2Pix به عنوان یک خط پایه محدود به تاخیر

هنگامی که داده ها و یک کار باریک (سکیچ → رندر، نقشه معنوی → عکس، روز → شب) را جفت کرده اید، نتیجه گیری یک شوت Pix2Pix انتشار را با یک ترتیب از شدت در تاخیر می کشد. مقایسه تولید معمولاً:

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix در تولید در دسته های جامد برنده می شود (هر درخواست همان FLOPs است). انتشار بر کیفیت و عمومی سازی برنده می شود. بازی مدرن اغلب برای ارسال یک مدل مستقیم به سبک Pix2Pix برای کار تنگ و یک سقوط انتشار برای ورودی دم است.

## خواندن بیشتر

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) کاغذ cGAN
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) Pix2Pix
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) CycleGAN
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) Pix2PixHD
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) اسپید / گاوگان
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) پروژکتور D
