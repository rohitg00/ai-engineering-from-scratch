# المواد المزروعة في المواد المزروعة

> كانت خدعة غودفيلو في عام 2014 هي تجاوز الكثافة بالكامل. شبكتين. واحد يصنع مزيفات. واحد يلتقطهم. يناضلون حتى تكون مزيفة لا يمكن التمييز بينها والواقعية. لا ينبغي أن تعمل. غالباً ما لا تعمل. عندما تفعل ذلك، فإن العينات لا تزال أكثر حيوية في الأدب للمناطق الضيقة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## المشكلة

تنتج VAEs عينات مشمسة لأن فقدان مُشفِّر MSE الخاص بهم هو مطلوب بـ Bayes لـ * المتوسط * الصورة  ومتوسط العديد من الأرقام المُثبتة هو رقم غامض. تريد خسارة مكافأة * المُثبتة * ، وليس القرب الحكسي لأي هدف واحد. لا يوجد شكل مغلق للمُثبتة. عليك أن تتعلم ذلك.

فكرة (غويدفيلو) ، تدريب مصنف$D(x)$لتفرق الصور الحقيقية عن المزيفة.$G(z)$للاستحواذ$D$إشارة الخسارة$G$هو ما هو$D$يعتقد حالياً أنّه يجعل شيئاً ما يبدو حقيقياً$G$تحسن، مطاردة هدف متحرك إذا التقيت الشبكات$G$تعلمت توزيع البيانات دون أن تكتب`log p(x)`. . .

هذا تدريب معارض، الرياضيات هي لعبة "الحد الأدنى"

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

في عام 2026 لم تعد GAN مولد SOTA (الانتشار والتطابق في التدفق أكلت هذه التاج). ولكن StyleGAN 2/3 لا تزال أشد نماذج الوجه التي تم شحنها على الإطلاق، يتم استخدام مميزات GAN كـ * خسائر تصورية* في تدريب التنشر، وتدريب العدائي يزود بتصفيات سريعة في خطوة واحدة (SDXL-Turbo، SD3-Turbo، LCM) التي تسمح لك بتشحن التنشر في الوقت الحقيقي.

## المفهوم

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**خريطة متجه الضوضاء$z \sim \mathcal{N}(0, I)$إلى عينة$\hat{x}$شبكة تشبه المفكّر (مكتظة أو مُتحولة).

**Discriminator $D(x)$.**خريطة العينة إلى احتمالية (أو درجة) المتعددة. حقيقية → 1 ، مزيفة → 0.

**Loss.**تحديثان متناوبان:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$. إنتروبيّة ثنائيّة على حقيقية = 1، وهمية = 0
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$هذه هي الشكل غير المشبعة الذي استخدمه (البدء)$\log(1 - D(G(z)))$يملئ ويقتل التدرج عندما$D$(تثق)

**Training loop.**خطوة واحدة من$D$، خطوة واحدة من$G$أكرر

**Why it works.**إذا$G$يطابق تماماً$p_{\text{data}}$، ثم$D$لا يمكن أن تفعل أفضل من فرصة والخروج 0.5 في كل مكان.$G$لا يوجد أي تراجع بعد الآن.

**Why it breaks.**انقطاع الوضع ($G$يجد وضع واحد$D$لا يمكن تصنيفه و يختمله للأبد) ، التراجع المتلاشى ($D$يتعلم بسرعة كبيرة و$\log D$(معدلات التعلم، حجم الحزم، أي شيء).

## الإختلافات التي جعلت GANs تعمل

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

## بناءها

`code/main.py`تدرب GAN صغيرة على بيانات 1-D: مزيج من غوسيان. مولد ومتمييز هي MLPs ذات طبقة واحدة مخفية. نطبق للأمام والخلف ، والحلقة minimax يدويا. الهدف هو رؤية وضعين الفشل الرئيسية (انهيار الوضع + تراجع التلاشى) كما يحدث.

### الخطوة الأولى: خسارة غير مشبعة

الخسارة الفانيليا Goodfellow$\log(1 - D(G(z)))$يصل إلى 0 عندما تصنف D G مزيفة كزائفة مع ثقة عالية. عند هذه النقطة تراجع ل G هو في الأساس صفر  G لا يمكن تحسينه.$-\log D(G(z))$لديه العكس من التشريح: فإنه ينفجر عندما D هو واثق، مما يعطي G إشارة قوية.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### الخطوة الثانية: خطوة تمييز واحدة لكل خطوة مولد

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

مزيفات جديدة لـ (ج) ، وإلا فإن التراجعات قديمة

### الخطوة الثالثة: مراقبة انهيار الوضع

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

العرض القنوني: توقف إحدى النظرتين الحقيقيتين عن التوليد، ويقف المتمييز عن تصحيحه لأنه لم يُنظر إليه أبداً كزيء.

## الفخاخ

- **Discriminator too strong.**خفض معدل تعلم D بنسبة 2-5x، أو أضف ضجيج مثالي/طبقة. إذا وصل D إلى دقة >95%، فإن G ميت.
- **Generator memorizes a mode.**إضافة الضوضاء إلى مدخلات D، استخدام طبقة ميني-بارت-متمييز، أو الانتقال إلى WGAN-GP.
- **Batch norm leaking statistics.**اللحظة الحقيقية + اللحظة المزيفة التي تتدفق عبر نفس طبقة BN تضمين إحصائهم. استخدم معايير الحالة أو المعايير الطيفية بدلاً من ذلك.
- **Inception-score gaming.**FID و IS ضجيج عند عدد العينات المنخفضة. استخدم عينة ≥10k عند تقييم.
- **One-shot sampling is a lie for conditional tasks.**ما زلت تحتاج إلى مقياسات CFG، خدوش التخفيض، وإعادة العينات للحصول على نتائج قابلة للاستخدام.

## استخدمها

كومة 2026 GAN:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

إن النقاط النقدية النقدية الحادة، ولكن الضيقة. بمجرد فتح نطاقك للصور، يتم إرسال نص تعسفي، وتحول الفيديو إلى التوزيع. تتواصل الخدعة المعادلة ككون (الخسائر الفكرية، التقطير) ، وليس مولد مستقل.

## أرسله

إنقاذ`outputs/skill-gan-debugger.md`. تتخذ مهارة إدارة GAN الفاشلة (تعابير الخسارة، شبكة العينات، حجم مجموعة البيانات) وتخرج قائمة مرتبة بالأسباب المحتملة، وتصحيحات خط واحد، وبروتوكول إعادة الإعداد.

## التمارين

1. **Easy.**أركض`code/main.py`مع إعدادات الأسهم ثم تعيين `D_LR = 5 * G_LR`و إعادة التشغيل. كم سرعة انهيار خسارة (جي) إلى ثابت؟
2. **Medium.**استبدل خسارة Goodfellow BCE بخسارة WGAN: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$،$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$، وقطع وزن D إلى `[-0.01, 0.01]`هل التدريب أكثر استقراراً؟
3. **Hard.**تمديد مثال 1-D إلى بيانات 2-D (خليط من 8 غوسيان على حلقة). تتبع عدد الحالات الثمانية التي يتم التقاطها من قبل المولد في الخطوات 1k، 5k، 10k. تنفيذ التمييز الحصري وإعادة القياس.

## الشروط الرئيسية

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

## ملاحظة الإنتاج: استنتاج واحد هو ميزة دائمة لـ GAN

لم تعد GAN تفوز بجودة العينات لإنتاج النطاق المفتوح ، لكنها لا تزال تفوز بتكلفة الاستنتاج. في المفردات الأدبية الإنتاجية-الإستنتاجية ، تمتلك GAN:

- **No prefill, no decode stages.**واحد$G(z)$المضي قدماً، التلفزيون المتأخر
- **No KV-cache pressure.**الحالة الوحيدة هي الوزن حجم الحزمة محدد من خلال ذاكرة التفعيل وليس الاحتفاظ
- **Trivial continuous batching.**نظرًا لأن كل طلب يحصل على نفس FLOPs الثابتة ، فإن دفعة ثابتة في الموقع المستهدف للخادم عادة ما تكون مثالية. لا حاجة إلى خريط جدول أثناء الرحلة.

هذا هو السبب في أن عملية تصفية GAN (SDXL-Turbo ، SD3-Turbo ، ADD ، LCM) هي التقنية المهيمنة للتصوير السريع من النص إلى الصورة في عام 2026: إنها تنهار خط أنابيب التوزيع 20-50 خطوة إلى 1-4 مرسلات إلى الأمام على النمط GAN مع الحفاظ على توزيع قاعدة التوزيع.

## المزيد من القراءة

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661)ورقة GAN الأصلية
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434)أول معمارة مستقرة
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) SDXL-توربو.
