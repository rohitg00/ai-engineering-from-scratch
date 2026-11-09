# ستايلجان

> معظم المولدات تتحرك$z$في كل طبقة في نفس الوقت. ستايلجان تقسيمها إلى جانبها: الخريطة الأولى$z$إلى مركز متوسط $w$، ثم * حقن * $w$هذا التغيير الوحيد فك الفضاء الخفيف وجعل الوجهات الصورية حقيقية مشكلة حل لسبع سنوات متتالية.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## المشكلة

خرائط " دي سي جيان "$z$إلى صورة من خلال كومة من التحولات المنقولة. المشكلة:$z$يسيطر على كل شيء  وضع، الإضاءة، الهوية، الخلفية  متصمة مع بعضها البعض.$z$لا يمكنك أن تسأل النموذج " نفس الشخص، وضع مختلف" لأن التمثيل لا يعد ذلك العامل.

Karras et al. (2019, NVIDIA) اقترح: توقف عن التغذية $z$مباشرة إلى طبقات المكوكات.`4×4×512`التنسور كمدخول الشبكة. تعلم MLP من 8 طبقات التي تقوم بتخريط $z \in Z \to w \in W$. حقن$w$في كل قرار عبر *طبيعية الحالة التكيفية* (AdaIN): الطبيعية كل خريطة ميزات conv، ثم النطاق والتحول من خلال التنبؤات التواصلية من $w$إضافة ضجيج لكل طبقة للتفاصيل المثقلة (مسام الجلد، حبل الشعر).

النتيجة:$W$يحتوي على محورات متقاطعة تقريبًا لـ "نمط مستوى عالٍ" (موقف، هوية) مقابل "نمطٍ جيد" (إضاءة، لون). يمكنك تبادل الأساليب بين صورين باستخدام صورة A $w$للاستراتيجية منخفضة الدقة والصور B $w$هذا التحرير المفتوح، التوسيع عبر النطاقات، وخط البحث بأكمله "التحول إلى "ستايلجان".

## المفهوم

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$، 8 طبقات MLP. $Z = \mathcal{N}(0, I)^{512}$. .$W$لا يجبر على أن يكون غوسياً يتعلم شكلًا مُتكيفًا مع البيانات

**Synthesis network.**يبدأ من ثابتة تعلم`4×4×512`كل كتلة تحديد:`upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`القرارات المزدوجة: 4، 8، 16، 32، 64، 128، 256، 512، 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

أين$y_{\text{scale}}$و$y_{\text{bias}}$تأتي من توقعات متقاربة$w$. تعاديل لكل خريطة ميزة، ثم إعادة التصميم. "السلسلة" هنا هي الإحصاءات من الدرجة الأولى والثانية من خريطة ميزة.

**Per-layer noise.**ضجيج غوسي القناة الواحدة يضاف إلى كل خريطة ميزة، مقياسًا عن طريق عامل تعلم لكل قناة. يتحكم بالتفاصيل الاستوكاسية دون التأثير على الهيكل العالمي.

**Truncation trick.**عند الاستنتاج، العينة $z$، الحساب$w = \text{mapping}(z)$، ثم$w' = \hat{w} + \psi \cdot (w - \hat{w})$أين$\hat{w}$هو المتوسط$w$على عدة عينات$\psi < 1$يتداول التنوع مقابل الجودة.$\psi \approx 0.7$. . .

## ستايلجان 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

في عام 2026 ستايلجان3 لا يزال الافتراضي (أ) لـ (تصور النطاق الضيق في FPS العالي، (ب) تكييف النطاق القليل من الصور (التدريب على مجموعة بيانات جديدة مع 100 صورة، خريطة التجميد) ، (ج) التحرير القائم على العكس (العثور على $w$الذي يعيد بناء صورة حقيقية، ثم تحرير ذلك $w$) بالنسبة للمجال المفتوح من النص إلى الصورة، ليست أداة  انتشار هو.

```figure
gx-stylegan-mapping
```

## بناءها

`code/main.py`يطبق لعبة "style-GAN lite" في 1-D: MLP الخريطة، وظيفة التكوين التي تأخذ متجه ثابت تعلم وتقوم بتحويله مع $w$-المتحدرات/التحيزات، والضوضاء لكل طبقة.$w$عبر تطابقات التكيف أو ضربات تتراكم$z$إلى مدخلات المولد.

### الخطوة الأولى: شبكة الخرائط

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### الخطوة 2: تطبيع الحالة التكيفية

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

نطاق الخريطة المميزة والتحيز يأتي من$w$عبر التنبيه الخطى

### الخطوة الثالثة: ضجيج لكل طبقة

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

سيغما على القناة يمكن تعلمها

## الفخاخ

- **Droplet artifacts.**أنتج StyleGAN 1 قطرة ضخمة في خرائط الميزات لأن AdaIN قد أُصفر عن المتوسط. تحلّل نظام تحميل الوزن في StyleGAN 2 ذلك عن طريق تحميل أوزان التخزين بدلاً من ذلك.
- **Texture sticking.**تتبع النسيج StyleGAN 1 و 2 إحداثيات البيكسل ، وليس إحداثيات الكائن (ملاحظة عند التقاطع). تحللات StyleGAN 3 الخالية من الاسم تصلح هذا مع مرشحات سينك المزودة بالزجاجات.
- **Mode coverage.**التقطيع`ψ < 0.7`تبدو نظيفة ولكن عينات من مخروط ضيقة ؛ استخدام `ψ = 1.0`إذا كنت بحاجة إلى التنوع.
- **Inversion is lossy.**إعادة صورة حقيقية إلى$W$عادة ما يتم من خلال التحسين أو مرموز (e4e ، ReStyle ، HyperStyle). النتائج تتحرك عبر العديد من التكرارات.

## استخدمها

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

بالنسبة إلى عرضات عرضية ذات مستوى منتج حيث تكون الإجابة "صورة وجه شخص" ، تضرب StyleGAN التوزيع على تكلفة الاستنتاج (مرة واحدة إلى الأمام ، <10ms على 4090) والحادة لنفس شريط الجودة.

## أرسله

إنقاذ`outputs/skill-stylegan-inversion.md`. تلتقط مهارة صورة حقيقية وتخرجات: طريقة التحول (e4e / ReStyle / HyperStyle) ، الخسارة المتوقعة الخفية ، ميزانية التحرير (كم في $W$يمكنك التحرك قبل الأثاث) ، و قائمة من المعروفة جيدة التحرير الاتجاهات (العمر، والتعبير، وضعية).

## التمارين

1. **Easy.**أركض`code/main.py`مع`adain_on=True`و`adain_on=False`مقارنة انتشار الخروج لخاطئ ثابت مقابل خاطئ مشوش
2. **Medium.**تنفيذ تنظيم الخلط: لفرقة تدريبية، الحساب $w_a$،$w_b$و تطبق$w_a$في النصف الأول من التوليد و$w_b$هل يتعلم المفكّر أنماطًا مختلطة؟
3. **Hard.**خذ نموذج StyleGAN3 FFHQ المُدرب مسبقاً (ffhq-1024.pkl).$w$التوجيه الذي يتحكم في "الإبتسامة" عن طريق تدريب المدير السريع على عينات معينة؛ تقرير إلى أي مدى يمكنك دفع قبل أن تتحرك الهوية.

## الشروط الرئيسية

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

## ملاحظة الإنتاج: لماذا ستايلجان لا تزال تشحن في عام 2026

ستايلجان3 على 4090 يخلق وجه 10242 FFHQ في أقل من 10 ms `num_steps = 1`لا توجد تشخيصات VAE، لا توجد مرسلات الانتباه المتقاطعة. من حيث الإنتاج هذه هي تأخير الأرضية لأي مولد الصور. خط أنابيب تشخيص SDXL + VAE 50 خطوة بنفس القرار هو ~ 3 ثواني. وهذا هو **300× gap**وبالنسبة للمنتجات ذات النطاق الضيق (خدمات الأفاطار، خطوط أنابيب وثائق الهوية، وتوليد مخزون الوجه) فاز على TCO.

عواقب عمليّتين:

- **No scheduler, no batcher.**الحزمة الدقيقة في الموقع المستهدف هي المثلى. الحزمة المستمرة (التي تكون ضرورية لـ LLM والانتشار) توفر صفر فائدة لأن كل طلب يحصل على نفس FLOPs.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`عينات من مخروط ضيقة من نطاق شبكة الخرائط. هذه هي الرافعة الوحيدة التي لديها طبقة الخدمة على اختلاف العينة.`ψ`عند ذروة الحمل، رفعها للمستخدمين المتميزين.

## المزيد من القراءة

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) StyleGAN
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) إكسارة e4e
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) StyleGAN-XL
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441)وصفة GAN الحد الأدنى الحديثة
