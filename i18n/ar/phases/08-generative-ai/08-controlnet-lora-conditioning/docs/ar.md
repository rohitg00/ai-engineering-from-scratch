# ControlNet، LoRA & Conditioning

> يسمح لك ControlNet بتنسيق نموذج التوزيع المسبق للتدريب وتوجيهه باستخدام خريطة عمق أو هيكل عظمي أو خدش أو صورة حافة. يسمح لك LoRA بتحسين نموذج معايير 2B من خلال تدريب 10 ملايين ملامح. معا حولوا Diffusion Stable من لعبة إلى خط أنابيب الصور 2026 الذي يتم شحنه في كل وكالة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## المشكلة

إن إشارة مثل "مرأة في ثوب أحمر تمشي كلباً في شارع مزدحم" لا تعطي النموذج معلومات عن * أين * الكلب ، * ما هي وضعية * المرأة ، أو * منظور * من الشارع. يحدد النص حوالي 10% مما تحتاج إليه لتضمين صورة. الباقي بصري ولا يمكن وصفه بكلمات بكفاءة.

تعليماً نموذج مشروط جديد من الصفر لكل إشارة (موقف، عمق، حكمة، قسم) أمر محظور. تريد أن تبقي العمود الفقري SDXL 2.6B-param مقفوفة، وربط شبكة جانبية صغيرة تقرأ التشريع، وتجعلها تدفع الميزات المتوسطة للعمود الفقري. وهذا هو ControlNet.

كما تريد تعليم النموذج مفاهيم جديدة (وجهك، منتجك، أسلوبك) دون إعادة تدريب النموذج الكامل. تريد دلتا أصغر بنسبة 100 مرة. هذا هو مكيّفات LoRA  منخفضة الدرجة التي تتواصل مع أوزان الاهتمام القائمة.

ControlNet + LoRA + text = مجموعة أدوات الممارس 2026. معظم خطوط أنابيب الصورة الإنتاجية تضم 2-5 LoRAs ، 1-3 ControlNets ، ومعدل IP فوق قاعدة SDXL / SD3 / Flux.

## المفهوم

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### (تشارون)

خذ SD متدربة مسبقاً. * قم بتسجيلها* من نصف تشفير U-Net. قم بتجميد الأصلي. قم بتسجيله لتقبل مدخل إضافي للتشغيل (الحواف والعمق والوضع). قم بتوصيل الكلون إلى نصف تشفير الأصلي مع * صفر-convolution* تخطي الاتصالات (1 × 1 convs المبدئية إلى الصفر  تبدأ كإغلاق، تعلم دلتا).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

0-conv init يعني أن ControlNet يبدأ على شكل هوية  لا ضرر حتى قبل التدريب. القطار على 1M (السرعة، الحالة، الصورة) يضاعف إلى ثلاثة أضعاف مع فقدان الانتشار القياسي.

تم إرسال ControlNets للطريقة الواحدة كنموذج جانبي صغير (~ 360M لـ SDXL، ~ 70M لـ SD 1.5).

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### (هو وزملاء)

لأي طبقة خطية$W \in \mathbb{R}^{d \times d}$في النموذج، التجمد $W$و أضف ديلتا منخفضة الدرجة:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

مع$r \ll d$. الدرجة 4-16 هي معيار للاهتمام، الدرجة 64-128 لخطوات دقيقة ثقيلة. عدد المعلمات الجديدة: $2 \cdot d \cdot r$بدلاً من$d^2$. لـ (SDXL) الاهتمام مع$d=640$،$r=16$: 20k في كل جهاز تعديل بدلا من 410k  تخفيض 20x. عبر النموذج بأكمله: لورا عادة ما تكون 20-200MB مقابل 5GB القاعدة.

عند الاستنتاج يمكنك أن تقوم بتحقيق حجم المعدل$W' = W + \alpha \cdot B A$. .$\alpha = 0.5\text{-}1.5$المواد المتعددة لـ LoRA تتراكم بشكل إضافي (مع الحذارة المعتادة بأنها تتفاعل بطريقة غير خطية).

### المعدل المعدل (Ye et al., 2023)

مُعدّل صغير يقبل الصورة كشروط (بجانب النص). يستخدم مُرمّد الصورة CLIP لإنتاج رموز الصورة، ويُحققها في الاهتمام المتقاطع جنباً إلى جنب مع رموز النص. ~ 20 ميب لكل نموذج أساسي. يسمح لك بـ "إنتاج صورة في أسلوب هذا المرجع" دون لورا.

## ماتريكس التراكم

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

شبكة التحكم فضائية، لورا معنوية، استخدم الاثنين

```figure
v4-controlnet-zero
```

## بناءها

`code/main.py`يحاكي الآليين في 1-D:

1. **LoRA.**طبقة خطية مسبقة$W$أجمدوه، تدربوا منخفضين$BA$مثل هذا$W + BA$يطابق طبقة خطية هدف.$r = 1$يكفي لتعلم تصحيح الدرجة 1 بشكل مثالي

2. **ControlNet-lite.**"قاعدة مقفزة" و "شبكة جانبية" تقرأ إشارة إضافية. يتم إغلاق خروج الشبكة الجانبية بواسطة مقياس قابل للتعلم تم تشريعه إلى الصفر (إصدارنا من الصفر-conv). قم بتشغيل ومراقبة البوابة.

### الخطوة الأولى: رياضيات لورا

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### الخطوة الثانية: شبكة جانبية صفر

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

في الخطوة 0 تكون الناتجية متطابقة مع القاعدة. تحديثات التدريب المبكر `gate`ببطء لا يوجد تدفق كارثي

## الفخاخ

- **Over-scaling LoRAs.** $\alpha = 2$أو$\alpha = 3$هو عملية "جعلها أقوى" شائعة التي تنتج نتائج أكثر من اللازمة.$\alpha \le 1.5$. . .
- **ControlNet weight conflict.**استخدام شبكة التحكم في الوزن 1.0 و شبكة التحكم في الغموض عند الوزن 1.0 عادة ما يتجاوز. مجموع الوزن ≈ 1.0 هو افتراض آمن.
- **LoRA on the wrong base.**SDXL LoRA لا تعمل بصمت على SD 1.5 لأن أبعاد الاهتمام لا تتطابق.
- **Textual Inversion drift.**الوهم المدربة في نقطة تفتيش تتحرك بشكل سيء في نقطة أخرى.
- **LoRA weight-merging and storage.**يمكنك تطبيق لورا في أساس النموذج الوزن لتحديد أسرع (لا إضافة وقت التشغيل) ، ولكنك تفقد القدرة على التوسع$\alpha$في وقت تشغيل، احتفظ بالنسختين

## استخدمها

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## أرسله

إنقاذ`outputs/skill-sd-toolkit-composer.md`. تتولى المهارة مهمة (أصول المدخل: عجلة، صورة مرجعية اختيارية، وضع اختياري، عمق اختياري، مسرح اختياري) وتخرج كومة الأدوات، والأوزان، وبروتوكول البذور المتكملة.

## التمارين

1. **Easy.**في`code/main.py`، تغير رتبة لورا`r`من 1 إلى 4 في أي صف يطابق لورا بالضبط دلتا الهدف من صف 2؟
2. **Medium.**قم بتدريب اثنين من الـ LoRA على اثنين من تحويلات الهدف قم بتحميلها معاً وظهر تفاعلهم الإضافي متى ينتهي التفاعل الخطية؟
3. **Hard.**استخدام الموزعات للاستئمار: SDXL- قاعدة + Canny-ControlNet (وزن 0.8) + طراز LoRA ($\alpha$0.8) + IP-Adapter (وزن 0.6) قياس FID مقابل التزام فورية التداول مع اختلاف وزن الكتل.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## ملاحظة الإنتاج: تبادلات لوراء، خطوط مراقبة شبكة التشغيل، خدمة متعددة المستأجرين

يقدم SaaS الحقيقي من النص إلى الصورة مئات من LoRAs وعشرات ControlNets على نفس نقطة التفتيش القاعدة. تبدو مشكلة الخدمة على غرار LLM متعددة التأجير (غطي أدب الإنتاج حالة LLM تحت الإجراءات المستمرة والLoRAX / S-LoRA):

- **Hot-swap LoRAs, do not merge.**الاندماج$W' = W + \alpha \cdot B \cdot A$في القاعدة يعطي ~ 3-5% أسرع في خطوة استنتاج ولكن يتجمد $\alpha$و القاعدة. الحفاظ على لورا ساخنة في VRAM كديلتا رتبة- r؛ الموزعات تعرض `pipe.load_lora_weights()`+ `pipe.set_adapters([...], adapter_weights=[...])`لتنشيط الطلب. تكلفة التبادل هي `2 · d · r · num_layers`الوزن  على مقياس MB، في الجزء الثاني.
- **ControlNet as a second attention lane.**يعمل المُخترف المُستنسخ بالتوازي مع القاعدة. اثنين من ControlNets وزنها 1.0 كل واحد = مرتين إضافيتين إلى الأمام في كل خطوة، وليس مراراً واحداً مدمجاً. تنخفض مساحة المجموعة من الحجم التربيعي. ميزانية ~ 1.5 × تكلفة الخطوة لكل ControlNet نشطة.
- **Quantized LoRAs too.**إذا قمت بتقييم القاعدة (انظر الدروس 07, التدفق على 8GB) ، فإن دلتا LoRA تقييمها أيضاً بشكل نظيف إلى 8 بتات أو 4 بتات. تسمح لك التحميل على شكل QLoRA بتجميع 5-10 LoRA على رأس قاعدة 4 بتات من التدفق دون تفجير الذاكرة.

تحديد التدفق: نيبوك نيلز التدفق على 8GB يقدر القاعدة إلى 4 بتات؛ وضع طراز LoRA (`pipe.load_lora_weights("user/style-lora")`) على هذه القاعدة الكمية في `weight_name="pytorch_lora_weights.safetensors"`هذا هو وصفة معظم وكالات SaaS تسافر في عام 2026.

## المزيد من القراءة

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) ControlNet
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) لورا (أولياً لـ LLM؛ الموانئ إلى التنشر).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) جهاز تعديل IP
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453)بديل أخف للسيطرة على شبكة التحكم
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242)"مكتب الأحلام"
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet)خطوط الأنابيب المرجعية
