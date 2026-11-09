# التدفقات المتناسبة وتدفقات المصلحة

> تستخدم نماذج التوزيع خطوات العينات 20-50 لأنها تمر على مسار منحني من الضوضاء إلى البيانات. تم تدريب مطابقة التدفق (ليبمان وآخرون، 2023) والتوجه المصلح (ليو وآخرون، 2022) على مسارات مستقيمة. تعني المسارات المستقيمة أقل خطوات يعني استنتاج أسرع. تمت تغيير مسار التوزيع المستقيم 3، Flux.1, و AudioCraft 2 إلى مطابقة التدفق في عام 2024.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## المشكلة

عملية العكس في DDPM هي 1000 خطوة من المشي$\mathcal{N}(0, I)$المُحَرِّر هو أنّ ODE يُحلّ العملية العكسية صلبة، المسار منحني.

إذا كنت تستطيع تدريب النموذج بحيث يكون المسار من الضوضاء إلى البيانات خط مستقيم واحد من خطوة أولر$t=1$إلى$t=0$يُبني مطابقة التدفق هذا مباشرة: تحديد التقاطع على خط مستقيم من$x_1 \sim \mathcal{N}(0, I)$إلى$x_0 \sim \text{data}$، تدريب حقل متجه $v_\theta(x, t)$لتطابق مشتق الوقت، والتكامل عند الاستنتاج.

تدفق المصلح (Liu 2022) يذهب إلى أبعد من ذلك: إصلاح المسارات بشكل متكرر باستخدام إجراء إعادة التدفق الذي ينتج إعادة التدفق بشكل متزايد أقرب إلى خطي. بعد إعادة التدفق اثنين، يطابق عينات خطوة 2 نوعية DDPM خطوة 50.

## المفهوم

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### تدفق خط مستقيم

تعريف:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

أين$x_0 \sim \text{data}$و$x_1 \sim \mathcal{N}(0, I)$المشتق من الوقت على طول هذا الخط المستقيم ثابت:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

تعريف حقل متجه عصبي $v_\theta(x_t, t)$و تدربها لتتطابق مع هذا المشتق:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

هذا هو**conditional flow matching**التدريب خالي من المحاكاة: لا يمكنك أبداً فتح ODE. مجرد عينة$(x_0, x_1, t)$والعودة

### أخذ العينات

عند الاستنتاج، دمج حقل المتجه المعلم * إلى الوراء* في الوقت:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

ابدأ$x_1 \sim \mathcal{N}(0, I)$، خطوة (أولير) إلى أسفل$t=0$. . .

### التدفق المصحّح (Liu 2022)

التدفق المستقيم يعمل ولكن المسارات المكتسبة ليست مستقيمة في الواقع$x_0$يمكن أن تقوم بتخريطه إلى نفس الشيء$x_1$خطوة إعادة التدفق المصحّحة:

1. نموذج تدفق القطار $v_1$مع الزوجات العشوائية.
2. عينة N أزواج $(x_1, x_0)$من خلال دمج$v_1$من$x_1$إلى هبوطها$x_0$. . .
3. القطار$v_2$لأن الأزواج الآن "ODE متطابقة"، فإن المقاطع المستقيمة بينهم هي حقا أكثر شحية.
4. أكرر

في الممارسة العملية 2 إعادة التدريبات تحصل على خطية تقريبا، مما يسمح بإستنتاج 2-4 خطوات. SDXL-توربو، SD3-توربو، LCM كلها نموذجات تتناسب التدفق من التدفق.

### لماذا هذا الفوز بالصور في 2024

ثلاثة أسباب:

1. **Simulation-free training** لا توجد إدارة إدارية إدارية تنشأ أثناء التدريب، لا شيء مهم لتنفيذها.
2. **Better loss geometry** المسارات المستقيمة لديها إشارة إلى الضجيج متسقة، في حين أن ضياع DDPM ε لديه SNR سيء في أطراف الجدول الزمني.
3. **Faster inference** 4-8 خطوات عند جودة SDXL-Turbo؛ خطوة واحدة مع عملية نزيف التماسك.

## التطابق التدفقي مقابل DDPM  الاتصال الدقيق

التطابق في التدفق مع مسار غوسياني مشروط هو التوزيع *مع جدول ضجيج محدد *. اختر $x_t = \alpha(t) x_0 + \sigma(t) x_1$التطابق في الجدول الزمني والجريان يعيد التوزيع المعدل لـ Stratonovich مع $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$هذان هما معادلين الجبرياً لطرق غوس

ما أضاف التطابقات في التدفق: * وضوح * من الهدف (سرعة عادية) ، خسارة أكثر نظافة، والترخيص للتجربة مع المتقاطعات غير غوسية.

```figure
normalizing-flow
```

## بناءها

`code/main.py`يطبق التطابق في التدفق 1D على خليط غوسيان مزدوج.$v_\theta(x, t)$هو MLP صغير تدرب مع الهدف على الخط المستقيم. عند الاستنتاج، دمج خطوات 1، 2، 4 و 20 Euler ومقارنة نوعية العينة.

### الخطوة الأولى: فقدان التدريب

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

### الخطوة الثانية: استنتاج متعدد الخطوات

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### الخطوة الثالثة: مقارنة عدد الخطوات

توقع أن يطابق معينة 4 خطوات بالفعل نوعية 20 خطوة

## الفخاخ

- **Time parameterization.**استخدامات مطابقة التدفق $t \in [0, 1]$مع$t=0$في البيانات$t=1$في ضجيج.$t \in [0, T]$مع$t=0$في البيانات$t=T$نفس الاتجاه، مقياس مختلف، الأوراق تُخطئ هذا باستمرار.
- **Schedule choice.**الخط المستقيم للدفق المصحّح هو جدول مطابقة التدفق، ولكن يمكنك استخدام عينات t-normal cosine أو logit (SD3 تفعل ذلك) لتغطية أفضل على المقياس.
- **Reflow cost.**إن إنشاء مجموعة البيانات المزدوجة لإعادة التدفق هو مرسل استنتاج كامل لكل عينة. فقط إعادة التدفق عندما تحتاج حقا إلى استنتاج خطوة 1-2.
- **Classifier-free guidance still applies.**فقط استبدل$\epsilon$لـ$v$في الجمعية الخطية: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$. . .

## استخدمها

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

عندما تقول ورقة "سرعة من التوزيع" في 2025-2026، فإنه تقريبا دائما ما تتطابق التدفق + التقطير.

## أرسله

إنقاذ`outputs/skill-fm-tuner.md`. تتخذ مهارة تحديد نموذج على أسلوب التوزيع وتحولها إلى تشكيل تدريب يطابق التدفق: اختيار الجدول الزمني، توزيع العينات في الوقت (وحدة / منطقية-طبيعية) ، المحفز، خطة إعادة التدفق، عدد الخطوات المستهدفة، بروتوكول التقييم.

## التمارين

1. **Easy.**أركض`code/main.py`و مقارنة خطوة واحدة مقابل خطوة 20 MSE مقابل توزيع البيانات الحقيقية.
2. **Medium.**تغيير من الزي$t$أخذ العينات إلى اللوجيت-نورمال (مركز العينات في منتصف (ت) هل تتحسن جودة النموذج؟
3. **Hard.**تنفيذ إعادة التكرار واحد: توليد المزدوج $(x_0, x_1)$من خلال دمج النموذج الأول، قم بتدريب النموذج الثاني على الأزواج، ومقارنة نوعية العينة في خطوة واحدة.

## الشروط الرئيسية

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

## ملاحظة الإنتاج: Flux.1-schnell هو التدفق مطابقة بأسرع

فوز الإنتاج من تطابق التدفق هو Flux.1-schnell  ديت المتناسب التدفق مستقطب إلى 1-4 خطوات الاستنتاج مع الحفاظ على جودة فلوكس-ديف. دفتر ملاحظات نيل "Run Flux على آلة 8GB" هو وصفة التنفيذ المرجعية: T5 + CLIP رمز، تعريف MMDiT كمية (في 4 خطوات لشربن vs 50 لديف) ، VAE رمز. حساب التكلفة:

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

قاعدة الإنتاج: **flow-matched base + distillation = the 2026 default for fast text-to-image.**كل البائعين الرئيسيين يرسلون هذا المزيج: SD3-Turbo (SD3 + تدفق + نزف) ، Flux-schnell (Flux-dev + تصحيح تدفق) ، CogView-4-Flash. قواعد التوزيع النقي موجودة فقط لمواقع التفتيش القديمة.

## المزيد من القراءة

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) تدفق معدل
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) تناغم التدفق
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3، تدفق معدل على مقياس.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797)الإطار العام الذي يغطي انتشار FM +.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) عملية تصفية 1 خطوة من التوزيع / التدفق.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) تغيرات توربو
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) تناغم التدفق في الإنتاج
