# مدل های انتشار  DDPM از ابتدا

> هو، جین، ابیل (2020) به این زمینه یک دستور کار را دادند که نمی توانست از آن دست بکشد. اطلاعات را با صدا در هزار گام کوچک نابود کنید. یک شبکه عصبی را برای پیش بینی صدا آموزش دهید. روند را با نتیجه گیری معکوس کنید. امروزه هر تصویر اصلی، ویدیو، 3D و مدل موسیقی در این حلقه اجرا می شود، احتمالا با تطابق جریان یا ترفند های منسجم در بالای آن.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## مشکل

تو ميخواي نمونه برداري$p_{\text{data}}(x)$.GAN ها بازی حداقل می کنند که اغلب متفاوت است. VAEs نمونه های مبهم را از یک کادر گوس تولید می کنند. آنچه شما واقعا می خواهید یک هدف آموزشی است که (ا) یک ضرر پایدار (هیچ نقطه سعد، هیچ حداقل) ، (ب) یک مرز پایین در $\log p(x)$(تا احتمالات داشته باشید) و (ج) نمونه هایی که با کیفیت SOTA مطابقت دارند.

Sohl-Dickstein et al. (2015) پاسخ نظری داشت: یک زنجیره مارکوف تعریف کنید $q(x_t \mid x_{t-1})$که به تدریج صداهای گاوسی را اضافه می کند و یک زنجیره معکوس را آموزش می دهد$p_\theta(x_{t-1} \mid x_t)$برای انکار. هو، جین، آبیل (2020) نشان داد که این ضرر می تواند به یک خط ساده شود  پیش بینی صدا  و ریاضیات را تمیز کرد. در سال 2020 این یک کنجکاوی بود. در سال 2021 این نمونه های پیشرفته تولید کرد. در سال 2022 تبدیل به انتشار پایدار شد. در سال 2026 این زیربنایی است.

## مفهوم

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**صداي گاوسي رو اضافه کن$T$مرحله های کوچک. شکل بسته  دلیل قابل درمان ریاضی  این است که مرحله تجمعی نیز گاسین است:

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

کجا$\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$برای جدول زمان$\beta_t$انتخاب کن$\beta_t$از 1e-4 تا 0.02 خطي$T=1000$قدم ها و$x_T$تقریباً$\mathcal{N}(0, I)$. .

**Reverse process $p_\theta$.**شبکه عصبی رو یاد بگیره$\epsilon_\theta(x_t, t)$که از صداي اضافه شده پيش بيني ميکنه$x_t$، به عبارت دیگر:

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

کجا$\sigma_t$یا هم$\sqrt{\beta_t}$این عبارت زشت است اما فقط الجبر است$x_{t-1}$با توجه به عقب$q(x_{t-1} \mid x_t, x_0)$و جایگزین کردن$x_0$با تخمین پیش بینی شده در مورد صدا.

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

نمونه$x_0$از داده ها، تصادفی را انتخاب کنید$t$نمونه$\epsilon \sim \mathcal{N}(0, I)$، حسابرسي صداي ها$x_t$در يک شات از طریق فرم بسته و بازپسين در سر صداي يک بازده، هيچ کميکس، هيچ KL، هيچ ترفند هاي بازسازي

**Sampling.**شروع کن$x_T \sim \mathcal{N}(0, I)$. مرحله برگشتي رو از$t = T$تا 1 تموم شد

## چرا کار ميکنه

سه تا حس:

1. **Denoising is easy; generating is hard.**در$t=T$، داده ها صداهای خالص هستند شبکه باید یک مشکل معمولی را حل کند.$t=0$، شبکه فقط چند پیکسل رو پاک کردن داره$t$، مشکل سخته اما شبکه دارای گرادینت های زیادی است که از طریق وزن های مشابه از هر سطح شور جریان می یابد.

2. **Score matching in disguise.**وینسن (2011) ثابت کرد که پیش بینی صدا برابر با تخمین است$\nabla_x \log q(x_t \mid x_0)$, * سکور*. SDE معکوس از این سکور برای رفتن به سمت گرادینت تراکم  یک قدم تصادفی هدایت شده به سمت مناطق احتمال بالا استفاده می کند.

3. **The ELBO reduces to simple MSE.**خط پایین کامل تنوع دارای یک اصطلاح KL در هر مرحله زمانی است. با پارامترسازی DDPM این اصطلاح KL به MSE در پیش بینی شور با معادلات خاص ساده می شود؛ Ho معادلات را کاهش داد (که آن را "ساده" از دست دادن می نامد) و کیفیت *بهبود شده است*.

```figure
diffusion-denoise
```

## آن را بسازید

`code/main.py`یک DDPM یک بعدی را اجرا می کند. داده ها ترکیبی دو حالت است. شبکه یک MLP کوچک است که می گیرد$(x_t, t)$و خروجی های پیش بینی شده از صدا. آموزش یک خط از دست دادن است. نمونه گیری زنجیره برگشت تکرار می کند.

### مرحله ی اول: برنامه پیش بینی (برنامه بسته)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### مرحله دوم: نمونه`x_t`در یک شات

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### مرحله سوم: یک مرحله آموزش

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### مرحله 4: نمونه گیری معکوس

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

برای یک مشکل 1-D با 40 مرحله زمان و یک MLP 24 واحد، این ترکیب دو حالت را در حدود 200 دوره یاد می گیرد.

## تنظیم زمان

شبکه باید بداند که چه مرحله ای را در حال رد کردن است. دو گزینه استاندارد:

- **Sinusoidal embedding.**مثل کدگذاری موقعیت ترانسفورماتور$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$از طریق یک MLP عبور می کند، به شبکه پخش می شود.
- **Film / group-norm conditioning.**برنامه های داخلی پروژه به مقیاس/تاهید در هر کانال (FiLM) در هر بلوک.

کد اسباب بازی ما از sinusoidal → concat استفاده می کند. U-Nets تولید از FiLM استفاده می کند.

## دام ها

- **Schedule matters a lot.**خطی$\beta$این برنامه پیش فرض DDPM است اما جدول cosine (Nichol & Dhariwal، 2021) FID بهتر برای همان محاسبه را می دهد.
- **Timestep embedding is fragile.**. از دست دادن خام$t$به عنوان یک شناور برای اسباب بازی 1-D کار می کند اما برای تصاویر شکست می خورد؛ همیشه از یک گنجانشی مناسب استفاده کنید.
- **V-prediction vs ε-prediction.**برای رژیم های باریک (ت خیلی کوچک یا خیلی بزرگ) ،$\epsilon$سیگنال تا صدا ضعیف دارد.$v = \alpha \cdot \epsilon - \sigma \cdot x$) پایدارتر است؛ SDXL، SD3 و Flux از آن استفاده می کنند.
- **Classifier-free guidance.**در نتیجه، هم مشروط و هم بی مشروط محاسبه کنید$\epsilon$، پس$\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$با$w \approx 3\text{-}7$در درس 8 پوشش داده شده
- **1000 steps is a lot.**تولید از DDIM (20-50 مرحله) ، DPM-Solver (10-20 مرحله) یا لوله سازی (1-4 مرحله) استفاده می کند. دروس 12 را ببینید.

## ازش استفاده کن

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

انتشار ستون فقرات تولید جهانی است. تطابق جریان (درسی 13) رقبای 2024-2026 است که معمولاً در سرعت نتیجه گیری برای همان کیفیت برنده می شود.

## -باده

نگه دار`outputs/skill-diffusion-trainer.md`مهارت یک مجموعه داده + بودجه و محصول محاسبه: برنامه (خطی / کوسین / سیگمائید) ، هدف پیش بینی (ε / v / x) ، تعداد مراحل، مقیاس راهنمایی، خانواده نمونه ها و پروتکل ارزیابی.

## تمرینات

1. **Easy.**T را از 40 تا 10 تغییر بده`code/main.py`کیفیت نمونه (هیستogram بصری از تولیدات) چگونه کاهش می یابد؟ ساختار دو حالت در چه T فرو می ریزد؟
2. **Medium.**از پیش بینی ε به پیش بینی v تغییر دهید، مرحله برعکس را دوباره بازگردانید، کیفیت نمونه نهایی را مقایسه کنید.
3. **Hard.**اضافه کردن راهنمای بدون طبقه بندی کننده.$c \in \lbrace 0, 1 \rbrace$، 10 درصد از زمان در طول آموزش و در زمان نمونه گیری استفاده کنید$\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$. اندازه گیری نرخ ضربه های حالت مشروط در $w = 0, 1, 3, 7$. .

## اصطلاحات کلیدی

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

## توجه تولید: نتیجه گیری انتشار یک مشکل قدم شمارش است

در مقاله DDPM T=1000 گام های معکوس اجرا می شود. هیچ کس در تولید آن را ارسال نمی کند. هر استیک نتیجه گیری واقعی یکی از سه استراتژی را انتخاب می کند  و هر نقشه به طور تمیز به چارچوب تولید از "از کجا تاخیر می آید":

1. **Faster sampler, same model.**DDIM (20-50 مرحله) ، DPM-Solver++ (10-20) ، UniPC (8-16).$\epsilon_\theta$وزن ها تاثيري ندارند.
2. **Distillation.**یک دانش آموز را به اندازه ی کمتر به معلم آموزش دهید: نماد های پیوستگی (خودخواهانه → 1-4) ، LCM، SDXL-Turbo، SD3-Turbo. تاخیر را 5-10x دیگر کاهش می دهد، نیاز به آموزش مجدد دارد.
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`, پس زمینه های انتشار TensorRT-LLM ,`xformers`توجه SDPA، وزن bf16، کاهش تاخیر در هر مرحله ~ 2×. با (1) و (2) جمع می شود.

برای یک سرور انتشار تولید، مکالمه بودجه همان چیزی است که ادبیات تولید برای LLM توصیف می کند: تاخیر `num_steps × step_cost + VAE_decode`، تولیدش`batch_size × (num_steps × step_cost)^-1`TTFT کوچک است (یک مرحله) TPOT معادل زمان پاسخ کامل است زیرا تولید تصویر از دیدگاه کاربر "همه یک بار" است.

## خواندن بیشتر

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) کاغذ انتشار، پیش از زمانش.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) DDPM
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) DDIM، قدم های کمتری
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672)برنامه ی کوسین، تفاوت های آموخته
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) راهنمایی برای طبقه بندی کننده
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) نماد متحد، تمیز ترین دستور
