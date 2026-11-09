# StyleGAN

> بیشتر ژنراتورها حرکت ميکنن$z$به هر لایه در همان زمان. StyleGAN آن را به سمت جداگانه: نقشه اول$z$به یک واسطه$w$، پس از آن * تزریق *$w$این تغییر تنها فضا را از بین برد و چهره های عکاسی واقعی را برای هفت سال متوالی یک مشکل حل شده ساخت.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## مشکل

نقشه هاي DCGAN$z$به صورت صورتي که از طریق چند تکه از تکه هاي نقل شده صورت گرفته$z$کنترل همه چیز را کنترل می کند  حالت، روشنایی، هویت، پس زمینه  با هم پیچیده شده است.$z$شما نمی توانید از مدل "هم فرد، حالت متفاوت" بپرسید چون نشان دهنده این روش را فاکتور نمی کند.

کاراس و همکارانش (2019، NVIDIA) پیشنهاد کردند: تغذیه را متوقف کنید $z$به طور مستقیم به لایه های کنو.`4×4×512`این یک برنامه ی 8 لایه ای است که نقشه می زند$z \in Z \to w \in W$. تزریق$w$در هر رزولوشن از طریق * عادی سازی نمونه ساز (AdaIN): هر نقشه ویژگی های conv را عادی سازی کنید، سپس مقیاس و تغییر با طرح های مرتبط از $w$. برای جزئیات استوکاستیک (چرم پوست، رشته های مو) ، صداهای هر لایه را اضافه کنید.

نتیجه:$W$دارای محورهای تقریباً راست راست برای "نویس سطح بالا" (موقف، هویت) در مقابل "نویس سبک" (روشنه، رنگ) است. شما می توانید با استفاده از تصویر A سبک های بین دو تصویر را تغییر دهید $w$برای سطح های کم وضوح و تصویر B $w$این ویرایش باز، استایلینگ در میان دامنه ها و کل رشته ی تحقیق "استایل گان-انورژن"

## مفهوم

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$، یک MLP 8 لایه ای$Z = \mathcal{N}(0, I)^{512}$.$W$مجبور نیست که گاسسی باشد  شکل داده ای را یاد می گیرد.

**Synthesis network.**از یک ثابت آموخته شروع می شود`4×4×512`. هر بلوک قطعنامه: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`قطعنامه های دوگانه: ۴، ۸، ۱۶، ۳۲، ۶۴، ۱۲۸، ۲۵۶، ۵۱۲، ۱۰۲۴

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

کجا$y_{\text{scale}}$و$y_{\text{bias}}$از پیش بینی های مرتبط با$w$. به طور معمول در هر نقشه ویژگی، سپس تغییر سبک. " سبک " در اینجا آمار درجه اول و دوم نقشه ویژگی است.

**Per-layer noise.**صداهای گاوسی یک کانال به هر نقشه ویژگی اضافه شده است، با یک عامل هر کانال آموخته شده مقیاس بندی شده است. جزئیات استوکاستیک را بدون تأثیر بر ساختار جهانی کنترل می کند.

**Truncation trick.**در نتیجه، نمونه$z$، حساب کردن$w = \text{mapping}(z)$، پس$w' = \hat{w} + \psi \cdot (w - \hat{w})$کجا$\hat{w}$متوسط$w$در مورد نمونه های زیادی.$\psi < 1$تقریباً هر دیمو مدل StyleGAN استفاده می کند$\psi \approx 0.7$. .

## StyleGAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

در سال 2026 StyleGAN3 پیش فرض برای (a) فوتوریالیسم دامنه باریک با FPS بالا، (b) سازگاری دامنه چند شوت (در یک مجموعه داده جدید با 100 تصویر، نقشه گیری منجمد) (ج) ویرایش مبتنی بر معکوس (دستگاه را پیدا کنید) باقی می ماند.$w$که عکس واقعی رو بازسازی کنه، بعدش ویرایشش کنه$w$) برای دامنه باز متن به تصویر، این ابزار نیست  انتشار است.

```figure
gx-stylegan-mapping
```

## آن را بسازید

`code/main.py`یک بازی "style-GAN lite" را در 1-D پیاده سازی می کند: یک MLP نقشه برداری، یک عملکرد سنتز که یک ویکتور ثابت آموخته و آن را با $w$-در مقیاس/تاهید و صداهای هر لایه$w$از طریق تعادلات و تعدیل آفلاین یا ضربه های همبستگی $z$به ورودی ژنراتور

### مرحله ی اول: شبکه نقشه برداری

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### مرحله 2: عادی سازی نمونه ساز

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

مقیاس و تعصب نقشه ویژگی ها از$w$از طریق پروژکتور خطی

### مرحله سوم: صدا در هر لایه

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

سگما در هر کانال قابل یادگیری است.

## دام ها

- **Droplet artifacts.**StyleGAN 1 قطره ای خفاش در نقشه های ویژگی ایجاد کرد زیرا AdaIN میانگین را صفر کرد. دمودولاسیون وزن StyleGAN 2 آن را با مقیاس کردن وزن کنولسیون اصلاح می کند.
- **Texture sticking.**بافت های StyleGAN 1 و 2 از هماهنگی پیکسل پیروی می کنند، نه هماهنگی اشیاء (در هنگام بین بردن) . پیچیدگی های بدون اسم StyleGAN 3 با فیلترهای سینک پنجره ای این مشکل را حل می کنند.
- **Mode coverage.**قطع کردن`ψ < 0.7`به نظر می رسد پاک است اما نمونه هایی از یک مخروط باریک است. استفاده کنید `ψ = 1.0`اگر به تنوع نیاز دارید.
- **Inversion is lossy.**تبدیل یک عکس واقعی به $W$معمولاً از طریق بهینه سازی یا یک کدگر (e4e، ReStyle، HyperStyle) انجام می شود. نتایج در طول چندین تکرار حرکت می کنند.

## ازش استفاده کن

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

برای نمایش های درجه محصول که پاسخ "تصاویر چهره یک فرد" است، StyleGAN از انتشار در هزینه نتیجه گیری (پاس تک جلو، <10ms در 4090) و تیزه بودن برای همان بار کیفیت بر می گردد.

## -باده

نگه دار`outputs/skill-stylegan-inversion.md`. مهارت یک عکس واقعی می گیرد و نتایج: روش برگشت (e4e / ReStyle / HyperStyle) ، انتظار از دست دادن پنهان، بودجه ویرایش (چه قدر در $W$شما می توانید قبل از آثار هنری حرکت کنید) و یک لیست از دستورالعمل های ویرایش شناخته شده (عمر، بیان، حالت).

## تمرینات

1. **Easy.**فرار کن`code/main.py`با`adain_on=True`و`adain_on=False`.با هم مقایسه انتشار خروجی برای یک خرده ثابت با خرده مختل شده
2. **Medium.**پیاده سازی تنظیمات مخلوط: برای یک دسته آموزش، محاسبه$w_a$،$w_b$و اعمالش$w_a$برای نیمه اول سنتز و$w_b$در نیمه دوم، دیکودر سبک های متمایز را می آموزد؟
3. **Hard.**یک مدل پیش از آموزش StyleGAN3 FFHQ (ffhq-1024.pkl) را بگیرید.$w$جهت کنترل "خنده" با آموزش یک SVM در نمونه های برچسب گذاری شده؛ گزارش کنید که قبل از حرکت هویت تا چه حد می توانید حرکت کنید.

## اصطلاحات کلیدی

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

## يادداشت تولیدی: چرا StyleGAN هنوز در سال 2026 عرضه می شود

StyleGAN3 در 4090 باعث ایجاد 10242 FFHQ در کمتر از 10 ms `num_steps = 1`در شرایط تولید این تاخیر کف برای هر ژنراتور تصویر است. یک 50 مرحله SDXL + VAE decode لوله در همان رزولوشن است ~ 3 ثانیه است. این یک**300× gap**، و برای محصولات دامنه باریک (خدمات اوتار، خطوط لوله اسناد شناسایی، تولید چهره سهام) این برنده در TCO است.

دو نتیجه عملیاتی:

- **No scheduler, no batcher.**دسته بندی ثابت در محل اشغال هدف مطلوب است. دسته بندی مداوم (ضروری برای LLM ها و انتشار) مزایای صفر را فراهم می کند زیرا هر درخواست FLOPs یکسان را می گیرد.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`نمونه های از یک مخروط باریک از محدوده شبکه نقشه برداری. این تنها اهرم لایه خدمت در مورد نمونه اختلاف دارد. پایین تر `ψ`در اوج بار، آن را برای کاربران پریمیم افزایش دهید.

## خواندن بیشتر

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) StyleGAN
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) معکوس شدن e4e
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) StyleGAN-XL
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) نسخه مدرن حداقل GAN
