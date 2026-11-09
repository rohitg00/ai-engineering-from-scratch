# تطابق جریان و اصلاح جریان

> مدل های انتشار از ۲۰ تا ۵۰ مرحله نمونه گیری استفاده می کنند زیرا از صدا به داده ها مسیر منحنی را طی می کنند. تطابق جریان (Lipman و همکاران 2023) و جریان اصلاح شده (Liu و همکاران 2022) مسیرهای مستقیم را آموزش می دهد. مسیرهای مستقیم به معنای گام های کمتری است که نتیجه گیری سریعتر است. Stable Diffusion 3 ، Flux.1 و AudioCraft 2 همه به تطابق جریان در سال 2024 تغییر داده اند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## مشکل

فرآیند برگشت DDPM یک قدم استوکاستیک از $\mathcal{N}(0, I)$به توزیع داده ها برگردیم. DDIM آن را به 20-50 مرحله تعیین کننده فرو می برد. شما می خواهید مراحل کمتری داشته باشید  ایده آل یک. مانع این است که ODE حل فرآیند معکوس سخت است؛ مسیر منحنی است.

اگر می توانستید مدل را طوری آموزش دهید که مسیر از صدا به داده ها یک خط مستقیم باشد، یک گام یولر از$t=1$به$t=0$این کار را می کند. تطابق جریان این را مستقیماً ایجاد می کند: یک قطب قطبی مستقیم را از$x_1 \sim \mathcal{N}(0, I)$به$x_0 \sim \text{data}$، یک میدان متری را تمرین کنید$v_\theta(x, t)$برای مطابقت با مشتق زمان، در نتیجه گیری ادغام شود.

جریان اصلاح شده (Liu 2022) فراتر می رود: مسیرها را با یک روش بازخورد که یک ODE به طور فزاینده ای نزدیک به خط تولید می کند، به طور تکراری راست می کند. پس از دو تکرار بازخورد، یک نمونه برداری دو مرحله ای با کیفیت DDPM 50 مرحله مطابقت دارد.

## مفهوم

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### جریان خط مستقیم

تعریف:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

کجا$x_0 \sim \text{data}$و$x_1 \sim \mathcal{N}(0, I)$مشتق زمان در طول این خط مستقيم ثابت است:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

یک میدان متری عصبی را تعریف کنید$v_\theta(x_t, t)$و آن را به این مشتق آموزش دهید:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

اينم**conditional flow matching**آموزش بدون شبیه سازی است: شما هرگز ODE را باز نمی کنید. فقط نمونه$(x_0, x_1, t)$و عقب نشینی

### نمونه گیری

در نتیجه گیری، میدان ویکتور یاد گرفته شده را * به عقب* در زمان ادغام کنید:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

از شروع$x_1 \sim \mathcal{N}(0, I)$، مرحله ایولر به پایین$t=0$. .

### جریان اصلاح شده (Liu 2022)

جریان خط مستقیم کار می کند اما مسیرهای آموخته شده *در واقع راست نیستند*$x_0$می تونم نقشه رو به همون جا بکشم$x_1$. مرحله بازخورد جریان اصلاح شده:

1. مدل جریان قطار$v_1$با جفت بندی تصادفی
2. نمونه N جفت $(x_1, x_0)$با ادغام$v_1$از$x_1$تا فرودش$x_0$. .
3. قطار$v_2$از آنجا که این جفت ها اکنون "ODE-مطابق" هستند، قطب مستقیم بین آنها واقعا مسطح تر است.
4. تکرار کنم

در عمل 2 تکرار تکرار شما را به خطی نزدیک می کند، که 2-4 مرحله نتیجه گیری را امکان پذیر می کند. SDXL-Turbo، SD3-Turbo، LCM همه مدل های تزریق شده از جریان هستند.

### چرا این فیلم در سال 2024 برنده شد؟

سه دلیل:

1. **Simulation-free training** هیچ ODE در طول آموزش و پرورش منتشر نمی شود، برای اجرای آن ساده است.
2. **Better loss geometry** مسیرهای مستقیم دارای سیگنال به صدا ثابت هستند، در حالی که DDPM ε-loss دارای SNR بد در حاشیه های برنامه است.
3. **Faster inference** 4 تا 8 مرحله در کیفیت SDXL-Turbo؛ 1 مرحله با تزریق سازگار.

## تطابق جریان در مقابل DDPM  ارتباط دقیق

جریان مطابق با یک مسیر Gaussian-شرطی انتشار است *با یک برنامه نویسی خاص.$x_t = \alpha(t) x_0 + \sigma(t) x_1$زمان بندی و جریان مطابقت بازیابی استراتونوویچ-reformed انتشار با $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$اين دو تا به صورت الجبري معادل راه هاي گوسي هستند

آنچه که تطابق جریان اضافه کرد: * شفافیت * هدف (سرعت ساده) ، یک از دست دادن تمیز تر و مجوز آزمایش با مداخله های غیر گاسسی.

```figure
normalizing-flow
```

## آن را بسازید

`code/main.py`یک جریان 1-D را روی یک ترکیب دو حالت گوسسی پیاده سازی می کند. میدان ویکتور $v_\theta(x, t)$یک MLP کوچک با هدف خط مستقیم آموزش دیده است. در نتیجه، مراحل 1، 2، 4 و 20 یولر را ادغام کنید و کیفیت نمونه را مقایسه کنید.

### مرحله ی اول: از دست دادن تمرین

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

### مرحله دوم: نتیجه گیری چند مرحله ای

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### مرحله سوم: مقایسه تعداد مراحل

انتظار داشته باشید که نمونه برداری 4 مرحله ای با کیفیت 20 مرحله مطابقت داشته باشد.

## دام ها

- **Time parameterization.**استفاده از تطابق جریان$t \in [0, 1]$با$t=0$در داده ها$t=1$در هنگام صدا.$t \in [0, T]$با$t=0$در داده ها$t=T$در هر حال، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در هر زمان، در، در هر زمان، در، در هر زمان، در، در هر زمان، در، در هر زمان، در هر زمان، در، در هر زمان، در، در هر زمان، در، در هر زمان، در، در هر زمان، در، در هر چیزی، در، در هر زمان، در، در هر چیزی، در، در، در هر چیزی، در، در، در، در، در هر چیزی، در، در، در هر چیزی، در، در، در، در، در، در هر چیزی، در، در، در، در، در، در، در، در، در، در، در، در، در، در، در،
- **Schedule choice.**خط مستقیم جریان اصلاح شده برنامه تطابق جریان "تعداد" است، اما می توانید از نمونه گیری t-معمولی (SD3 این کار را انجام می دهد) برای پوشش بهتر مقیاس استفاده کنید.
- **Reflow cost.**تولید مجموعه داده های جفت برای بازخورد یک نتیجه گیری کامل در هر نمونه است. فقط زمانی که واقعا به یک یا دو مرحله از بازخورد نیاز دارید بازخورد را انجام دهید.
- **Classifier-free guidance still applies.**فقط عوضش کن$\epsilon$برای$v$در ترکیب خطی: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$. .

## ازش استفاده کن

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

هر وقت در یک مقاله گفته شود "سرعت تر از انتشار" در سال های 2025-2026، تقریبا همیشه جریان مطابقت + تزریق است.

## -باده

نگه دار`outputs/skill-fm-tuner.md`. مهارت یک مدل سبک انتشار را می گیرد و آن را به یک پیکربندی آموزش تطابق جریان تبدیل می کند: انتخاب برنامه، توزیع نمونه گیری زمان (وحد / منطقی-معمول) ، بهینه سازی، برنامه جریان مجدد، شمار مراحل هدف، پروتکل ارزیابی.

## تمرینات

1. **Easy.**فرار کن`code/main.py`و مقایسه یک مرحله با 20 مرحله MSE با توزیع واقعی داده ها.
2. **Medium.**از لباس عوضش کن$t$نمونه گیری به حالت عادی (مجموعه نمونه گیری در وسط t را متمرکز می کند). آیا کیفیت مدل بهبود می یابد؟
3. **Hard.**یک تکرار تکرار تکرار را اجرا کنید: جفت تولید کنید $(x_0, x_1)$با ادغام مدل اول، مدل دوم را روی جفت ها آموزش دهید و کیفیت نمونه را در یک مرحله مقایسه کنید.

## اصطلاحات کلیدی

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

## يادداشت توليد: فلکس.1-شنل در سرعت ترين خود مطابقت جریان است

فلو مچینگ برنده تولید Flux.1-schnell  یک DiT مچ جریان مستقیم به 1-4 مرحله نتیجه گیری در حالی که کیفیت درجه Flux-dev را حفظ می کند. نوت بوک "Run Flux در یک ماشین 8GB" نیلز نسخه استفاده مرجعیه: T5 + کد CLIP، کد MMDiT کوانتایی (در 4 مرحله برای سریع در مقابل 50 برای dev) ، کد VAE. حسابداری هزینه:

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

قانون توليد: **flow-matched base + distillation = the 2026 default for fast text-to-image.**هر فروشنده بزرگ این ترکیب را ارسال می کند: SD3-Turbo (SD3 + جریان + تزریق) ، Flux-schnell (Flux-dev + راست کردن جریان اصلاح شده) ، CogView-4-Flash. پایگاه های انتشار خالص فقط برای نقاط بازرسی قدیمی وجود دارد.

## خواندن بیشتر

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) جریان اصلاح شده
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) تطابق جریان
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3، جریان اصلاح شده در مقیاس.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) چارچوب عمومی که شامل انتشار FM + می شود.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) یک مرحله از تزریق انتشار / جریان.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) توریبو
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) تطابق جریان در تولید
