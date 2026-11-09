# التوزيع المتخفي و التوزيع المستقر

> انتشار الفضاء البيكسل على 512 × 512 الصور هو جريمة حرب محاسبية. لاحظ رومباخ وزملاءه (2022) أنه لا تحتاج إلى جميع أبعاد 786k لتوليد صورة  تحتاج إلى ما يكفي لالتقاط الهيكل الدلالي ، ومدخن منفصل للبقية. تشغيل انتشار داخل الفضاء الخفيف ل VAE. هذه الفكرة واحدة هي Diffusion مستقر.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## المشكلة

التوزيع في الفضاء البكسل في 5122 يعني أن شبكة U-Net تعمل على ضغط الشكل`[B, 3, 512, 512]`كل خطوة من خريط العينات هي ~ 100 GFLOPS ل 500M-param U-Net. خمسين خطوة هي 5 TFLOPS لكل صورة. تدرب على مليار الصور و فاتورة الحساب سخيفة.

معظم هذه FLOP تذهب إلى دفع تفاصيل غير مهمة من الناحية البصرية من خلال الشبكة  التركيبة عالية التردد التي يمكن أن تضغط VAE الخسارة بعيدا. فكرة Rombach: تدريب VAE مرة واحدة (المرحلة الأولى*) ، وتجمدها ، وتشغيل التوزيع بالكامل في الفضاء المتخفي 4 قنوات 64 × 64 (المرحلة الثانية*). نفس U-Net. 1/16 من البكسلات. ~ 64x أقل FLOPs لجودة مقارنة.

هذه وصفة التنشر المستقر. أدرست 1.x / 2.x استخدام 860M U-شبكة أكثر من `64×64×4`في حالة وجود أجهزة متخفية، استخدم SDXL شبكة U-Net 2.6B`128×128×4`أبدل SD3 شبكة U-Net مع محول للتنشر (DiT) مع مطابقة التدفق. Flux.1-dev (مختبرات الغابة السوداء ، 2024) يرسل DiT-MMDiT بمعدل 12B. جميعها تعمل على نفس الأساس المكون من مرحلتين.

## المفهوم

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**مُشفّر$E(x) \to z$، المُفكّر$D(z) \to x$. الضغط المستهدف: 8 × العينة التنازلية في كل محور فضائي + ضبط القنوات بحيث يكون إجمالي حجم الخفاء ~ 1/16 من عدد البيكسل. الخسارة = إعادة التكوين (L1 + LPIPS الإدراكية) + KL (وزن صغير لذلك $z$لا يجبرنا على فعل ذلك لأننا لا نحتاج إلى عينة دقيقة من$z$غالباً ما يتم تدريبها مع خسارة معادلة لذا الصور المفكورة حادة

2. **Stage 2 — diffusion on $z$.**العلاج$z = E(x_{\text{real}})$تدريب شبكة U-Net (أو DiT) للتخفيض$z_t$عند الاستنتاج: عينة$z_0$عبر التوزيع، ثم $x = D(z_0)$. . .

**Text conditioning.**اثنين من المكونات الإضافية. مرموز نص تجميد (CLIP-L ل SD 1.x، CLIP-L + OpenCLIP-G ل SD 2 / XL، T5-XXL ل SD3 و Flux). حقن الانتباه المتقاطع: كل بلوك U-Net يأخذ `[Q = image features, K = V = text tokens]`ويقومون بتخليطها بينها. الوهم هي الطريقة الوحيدة التي يؤثر فيها النص على الصورة.

**The loss function is identical to Lesson 06.**نفس DDPM / تدفق مطابقة MSE على الضجيج. يمكنك فقط تبادل المجال البيانات.

## أنواع الهندسة المعمارية

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

الاتجاه: استبدال شبكة U-Net بـ DiT (المحول على المكالمات الخفية) ، وتوسيع حجم مرموز النص (T5 يفوق CLIP لتحقيق الالتزام السريع) ، وزيادة القنوات الخفية (4 → 16 يعطي المزيد من الفاصلة التفصيلية.

```figure
noise-schedule
```

## بناءها

`code/main.py`يضع لعبة 1-D "VAE" (مخترف ثابت على مقياس 0.5 و العكس الدقيق منه كمخترف ، للدليل ؛ فإن VAE الحقيقي سيكون شبكة مغطاة) فوق DDPM من الدروس 06 ويضيف تكييف الفئة مع إرشادات خالية من التصنيف. يظهر أن نفس خسارة التوزيع تعمل سواء كنت تعمل على قيم خام 1-D أو على قيم مرمومة. هذه هي المفهوم الرئيسي.

### الخطوة الأولى: إشعار/إشعار

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

الـ VAE الحقيقي لديه أوزان تدريبية.$z$دون اهتمام بالمساحة البيانية الأصلية.

### الخطوة الثانية: التوزيع في`z`-المجال

نفس DDPM كما دراسة 06. البيانات التي يراها الشبكة هي $z = E(x)$بعد أخذ العينات$z_0$، فك رموزها مع $D(z_0)$. . .

### الخطوة الثالثة: إرشادات خالية من التصنيف

أثناء التدريب، اترك علامة الفصل 10% من الوقت (استبدلها بـ رمز صفر). عند الاستنتاج، احسب كلتا $\epsilon_{\text{cond}}$و$\epsilon_{\text{uncond}}$، ثم:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= لا توجد إرشادات (تنوع كامل) ،$w = 3$= الاختلاف، $w = 7+$= ملئ / حاد جدا.

### الخطوة الرابعة: تكييف النص (المفهوم وليس الرمز)

استبدل علامة الفصل بمخرج مبرم مبرم نصي. إطعام النص المضمن إلى شبكة U-Net عبر الانتباه المتقاطع:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

هذا هو الفرق الجوهري الوحيد بين نموذج التخريب الشريطية للطبقة والتخريب المستقر.

## الفخاخ

- **VAE-scale mismatch.**SD 1.x VAEs لديها ثابتة التوسع (`scaling_factor ≈ 0.18215`ويتم تطبيقها بعد التشفير، ويتم تنسيه هذا يجعل شبكة الإنترنت تعمل على التخفيضات مع اختلاف خاطئ للغاية.
- **Text encoder silently wrong.**SD3 تحتاج T5-XXL مع >=128 رموز، والعودة إلى CLIP فقط خسارة. تحقق دائما `use_t5=True`أو كراتيرات الصدقة السريعة
- **Mixing latent spaces.**SDXL، SD3، وFlux تستخدم جميعها VAEs مختلفة. لا تعمل LoRA المدربة على SDXL latences على SD3.
- **CFG too high.** `w > 10`يُنتج صورًا مشبعة وشمّة ويتكيف مع الإشارة على حساب التنوع.`w = 3-7`. . .
- **Negative prompts leaking.**إن طلب سلبي فارغ يصبح رمز الصفر ، إن طلب سلبي ملء يصبح الـ$\epsilon_{\text{uncond}}$هذه ليست نفسها، بعض خطوط الأنابيب تُخلف صامتًا إلى الصفر.

## استخدمها

مستويات الإنتاج في عام 2026:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## أرسله

إنقاذ`outputs/skill-sd-prompter.md`. تتخذ مهارة عرض نصي + نمط هدفي ومخرجات: نموذج + نقطة تفتيش ، مقياس CFG ، عينة ، عرض سلبي ، قرار ، مزيج اختياري من ControlNet / IP-Adapter ، وقائمة تفتيش QA لكل خطوة.

## التمارين

1. **Easy.**أركض`code/main.py`مع توجيه$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$سجل العينة المتوسطة حسب الفئة$w$هل الوسائل الطبقة تختلف عن الوسائل الحقيقية للبيانات؟
2. **Medium.**تغيير مُشفّر اللعبة الخطيّة إلى زوج مُشفّر/مُفَكّر من TANH-MLP مع فقدان إعادة الإعمار. إعادة تدريب التوزيع على المُختلفات الجديدة. هل تتغير جودة العينة؟
3. **Hard.**قم بتعيين استنتاج انتشار مستقيم حقيقي مع المنتشرين: الحمل `sdxl-base`, إضافة 30 خطوة (أولير) مع (سي.إف.جي) =7 , توقيتها`sdxl-turbo`مع 4 خطوات و CFG = 0 نفس الموضوع، نوعية مختلفة  وصف ما تغير ولماذا.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## ملاحظة الإنتاج: تشغيل Flux-12B على GPU المستهلك 8GB

الإشارة إدماج التدفق هو وصفة "لدي GPU المستهلك، هل يمكنني شحن هذا؟" الخدعة هي نفس قائمة الأدب الاستنتاجية لإنتاج وصفة ثلاثية الأزرار المطبقة على DiT التوزيع:

1. **Staggered loading.**فلوكس لديها أربعة شبكات لا تحتاج إلى التعايش مع VRAM: T5-XXL رمز النص (~ 10 GB في fp32) ، CLIP-L (صغير) ، 12B MMDiT ، وال VAE. رمزية المشروع أولاً ، * حذف * المرموز ، تحميل DiT ، التخفيض ، * حذف * DiT ، تحميل VAE ، فك تشفير. GPUs المستهلك 8 GB فقط تناسب مرحلة واحدة في وقت واحد.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`على كل من مرموز T5 و DiT. يقطع الذاكرة 8 ×، انخفاض الجودة غير قابل للتحديد من خلال النص إلى الصورة حسب معايير Aritra (المرتبطة في دفتر الملاحظات).
3. **CPU offload.** `pipe.enable_model_cpu_offload()`يغير وحدات التشغيل الآلية بين CPU و GPU كل مرور إلى الأمام يقدم. يضيف 10-20% تأخير ولكن يجعل خط الأنابيب يعمل على الإطلاق.

حسابات الذاكرة هي: `10 GB T5 / 8 = 1.25 GB`كمية،`12 B params × 0.5 bytes = ~6 GB`في صيغ stas00 هذا هو نهاية متطرفة من TP = 1 استنتاج  لا نموذج التوازي، أقصى كمية. للإنتاج كنت تشغيل TP = 2 أو TP = 4 على H100s؛ لجهاز محمول واحد تطوير، هذه هي وصفة.

## المزيد من القراءة

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) انتشار ثابت.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) ديت
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3، MMDiT.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) عائلة Flux.1
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) تنفيذ مرجعية لكل نقطة تفتيش أعلاه.
