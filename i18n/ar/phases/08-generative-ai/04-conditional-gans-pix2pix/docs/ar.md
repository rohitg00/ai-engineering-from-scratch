# المواد المضادة للشروط

> كان أول عملية إفراج كبيرة في 2014-2017 هو التحكم في ما يفعله GAN. ضم علامة أو صورة أو جملة. عمل Pix2Pix نسخة الصورة ولا تزال تضرب كل نموذج عام من النص إلى الصورة في مهام الصورة إلى الصورة الضيقة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## المشكلة

عينة GAN غير مشروطة عينات الوجوه التعسفية. مفيدة لعرض التجربة، غير مفيدة في الإنتاج. تريد: * خريطة رسم إلى صورة * خريطة خريطة إلى صورة جوية * خريطة مشهد النهار إلى الليل * تلوين صورة على نطاق الرمادي * في كل هذه، يتم إعطائك صورة مدخل$x$و يجب أن تنطلق$y$مع بعض التوافقات التفاصلية.$y$- نعم$x$خطأ متوسط مربع يُسطحهم إلى مشوش خسارة معادلة لا تفعل، لأن "يبدو حقيقي" هو حاد.

إضافة شرط (Mirza & Osindero, 2014)$c$كمدخل لكلتا$G$و$D$. Pix2Pix (Isola et al., 2017) متخصص في هذا: حالة هي صورة مدخلة كاملة، مولد هو U-Net، والتمييز هو *بيتش على أساس* تصنيف (PatchGAN) ، والخسارة هي خصومية + L1. هذه الوصفة تتفوق من الصفر النماذج من النص إلى الصورة على مناطق الصورة إلى الصورة الضيقة حتى في 2026 لأنه يتم تدريبها على * بيانات مُزدوجة *  لديك بالضبط الإشارة التي تحتاجها.

## المفهوم

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$في Pix2Pix،$z$هو التوقف داخل G (لا ضجيج مدخل  تم تجاهل الضجيج الصريح الذي وجدت في Isola).

**Conditional D.** $D(x, y) \to [0, 1]$. المدخل هو * زوج* (الشروط، الخروج). هذا هو الفرق الرئيسي: يجب على D أن تقرر ما إذا كان $y$يتوافق مع $x$ليس فقط إذا$y$يبدو حقيقياً

**U-Net generator.**مُشفّر-مُفكّر مع اتصالات تخطي عبر عنق الزجاجة. مهمّ للمهمات التي تتشارك فيها الإدخال والخروج بنية منخفضة المستوى (الحواف، الصورة). بدون تخطي، تختفي التفاصيل عالية التردد.

**PatchGAN discriminator.**بدلاً من إصدار نتيجة حقيقية واحدة أو مزيفة، فإن D يخرج نتيجة$N \times N$شبكة حيث تحكم كل خلية على حقل استقبلي من ~ 70 × 70 بكسل. متوسط. هذا افتراض حقل عشوائي ماركوف: الواقعية محلية. أسرع بكثير للتدريب، أقل ملامح، إنتاج أكثر حدة.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

يثبّت مصطلح L1 التدريب ويدفع G نحو الهدف المعروف. يمنح L1 حواف أكثر حافة من L2 (الوسطاء، وليس الوسيط). $\lambda = 100$كان الوضع الاصطناعي لـ Pix2Pix

## CycleGAN  عندما لا يكون لديك أزواج

Pix2Pix يحتاج إلى مزيج $(x, y)$بيانات. سيكلجان (زو وزملاء 2017) يقلل من هذا الاحتياج على حساب خسارة إضافية: * خسارة استنتاجية الدورة. مولدات $G: X \to Y$و$F: Y \to X$تدربهم هكذا$F(G(x)) \approx x$و$G(F(y)) \approx y$هذا يسمح لك بترجمة الخيول إلى الزيبرا، الصيف إلى الشتاء، دون مثالين.

في عام 2026، يتم إرسال الصورة إلى الصورة غير المزدوجة في الغالب عبر التوزيع (ControlNet، IP-Adapter) بدلاً من CycleGAN، ولكن فكرة التوافق في الدورة تبقى في كل ورقة تكييف نطاق غير المزدوجة تقريبًا.

```figure
gx-patchgan
```

## بناءها

`code/main.py`يطبق GAN مشروط صغير على البيانات 1D.$c$هو علامة الفئة (0 أو 1). المهمة: إنتاج عينة من التوزيع المشروط للفئة المعينة.

### الخطوة 1: إضافة شرط لكل من مدخلات G و D

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

التشفير الواحد هو أبسط طريقة. تستخدم النماذج الكبيرة التوابل المتعلمة، ووضع FiLM، أو الانتباه المتبادل.

### الخطوة الثانية: القطار مشروط

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

يجب أن يطابق الجناتور التوزيع الحقيقي * للشروط المقدمة * ، وليس الحدودي.

### الخطوة 3: التحقق من النتائج لكل فئة

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## الفخاخ

- **Condition ignored.**تعلم G التهميش، D لا يعاقب أبدا لأن إشارة الحالة ضعيفة. تصحيح: الحالة D أكثر عدوانية (طبقة مبكرة، وليس فقط متأخرة) ، استخدام تمييز التنبؤ (Miyato & Koyama 2018).
- **L1 weight too low.**غ يتحرك إلى نتائج تعسفية تبدو حقيقية، وليس الصوابين.$\lambda \approx 100$للمهام على طراز Pix2Pix.
- **L1 weight too high.**G تنتج نتائج مشمسة لأن L1 لا يزال$L_p$القلب يضعف بمجرد استقرار التدريب
- **Ground-truth leakage in D.**الكونكاتينات$(x, y)$كدخل، ليس فقط$y$بدون هذا "دي" لا يمكن التحقق من التماسك
- **Mode collapse per class.**كل فئة يمكن أن تنهار بشكل مستقل.

## استخدمها

2026 حالة مهام الصورة إلى الصورة:

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

Pix2Pix لا يزال الأداة الصحيحة عندما (أ) لديك آلاف الأمثلة المزدوجة ، (ب) المهمة ضيقة وتكرارية ، و (ج) تحتاج إلى استنتاج سريع. في المهام العامة المفتوحة النطاق ، تفوز التوزيع.

## أرسله

إنقاذ`outputs/skill-img2img-chooser.md`. تتخذ مهارة وصف المهمة، وتوافر البيانات (مزدوجة مقابل غير مزدوجة، عينات N) ، وميزانية التأخير / الجودة، ثم النتائج: النهج (Pix2Pix، CycleGAN، متغير ControlNet، SDXL + IP-Adapter) ، متطلبات البيانات التدريبية، تكلفة الاستنتاج، وبروتوكول التقييم (LPIPS، FID، محدد للمهمة).

## التمارين

1. **Easy.**تغيير`code/main.py`إضافة فئة ثالثة. تأكيد G لا يزال خريطة ضجيج كل فئة إلى الوضع الصحيح.
2. **Medium.**استبدل L1 بخسارة في نمط الإدراك في إعداد 1-D (على سبيل المثال D الصغيرة المجمدة تعمل كمتصدر ميزة). هل يغير حدة التوزيع المشروط؟
3. **Hard.**رسم CycleGAN في إعداد 1-D: توزيعين، مولدين، فقدان دورة. أظهر أنه يتعلم رسم الخرائط بينهما دون بيانات مُزدوجة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## ملاحظة الإنتاج: Pix2Pix كخط أساسي محدود بالخمول

عندما تكون قد أزواج البيانات ومهمة ضيقة (الخريطة → التصوير، الخريطة التعريفية → الصورة، اليوم → الليل) ، فإن استنتاج Pix2Pix من خلال إطلاق واحد يفوق الانتشار بنظام من الحجم على التأخير. عادة ما تكون مقارنة الإنتاج:

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

فاز Pix2Pix على التكامل في دفعات ثابتة (كل طلب هو نفس FLOPs). فاز التوزيع على الجودة والتعميم. غالبًا ما يكون اللعب الحديث هو شحن نموذج مستقيم على طراز Pix2Pix للمهمة الضيقة والانكاسة التوزيعية لدخلات الذيل.

## المزيد من القراءة

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784)ورقة "سي جي أن".
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) Pix2Pix.
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) CycleGAN
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) Pix2PixHD
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291)(سبيد) / (غاجان)
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) التنبؤ D
