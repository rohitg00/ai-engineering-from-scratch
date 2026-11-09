# الجيل الثلاثي الأبعاد

> 3D هو طريقة حيث يصل الرافعة الثانية إلى 3D إلى أقوى. كان الانفجار 2023 3D Gaussian Splating. طبقات دفع مولدة 2024-2026 تعزيز متعدد الرؤية + إعادة بناء 3D على الأعلى لإنتاج الأشياء والمشاهد من عرض واحد أو صورة.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## المشكلة

المحتوى ثلاثي الأبعاد مؤلم:

- **Representation.**الشبكات، سحابة النقاط، شبكات الفوكسل، حقل المسافة الموقعة (SDFs) ، حقل الإشعاع العصبي (NeRFs) ، غوسيانات 3D. كل منها لديه تعادلات.
- **Data scarcity.**ImageNet لديها 14 مليون صورة. أكبر مجموعة بيانات 3D نظيفة (Objaverse-XL، 2023) لديها ~ 10 مليون كائن، والجودة الأكثر انخفاضا.
- **Memory.**شبكة 5123 صوتية هي 128M صوتية؛ مشهد مفيد NeRF تحتاج إلى 1M عينات / أشعة. إنتاج أصعب من إعادة الإعمار.
- **Supervision.**للصورة الثنائية الأبعاد لديك البكسلات، للصورة الثلاثية الأبعاد عادةً لديك حفنة من الرؤى الثنائية الأبعاد و يجب أن ترتفع إلى ثلاثية الأبعاد.

تعزف كومة 2026 المشاكل. أولاً، إنتاج * صور متعددة الرؤية 2D * مع نموذج انتشار. ثانياً، تكييف * تمثيل 3D * (عادةً شرب غوس) إلى تلك الصور.

## المفهوم

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### تمثيل: 3D Gaussian Splatting (Kerbl et al., 2023)

تمثل مشهدًا كغيض من غوسيانات 3D ~ 1M. لكل منها 59 ملامح: الموقف (3) ، التباين (6, أو الرباعي 4 + مقياس 3), الضموضة (1) ، اللون المتساوي الكروي (48 في درجة 3 ، 3 في درجة 0).

التمثيل = التنبيه + التركيب الألفي. سريع (~ 100 صورة في الثانية عند 1080p على 4090). قابل للتفريق. يناسب من خلال انخفاض التراجع ضد صور الحقيقة الأرضية. يناسب المشهد في 5-30 دقيقة على جهاز GPU المستهلك.

اثنين من الابتكارات 2023-2024 على رأس:
- **Generative Gaussian splats.**نماذج مثل LGM، LRM، InstantMesh تتوقع سحابة غوسية مباشرة من صورة واحدة أو بضع صور.
- **4D Gaussian Splatting.**غوسيانات مع تعويضات لكل إطار للمشاهد الديناميكية

### التوزيع متعدد الرؤى

ضبط النظام الدقيق نموذج انتشار الصورة المسبق للتدريب لتوليد العديد من الرؤى المتسقة لنفس الكائن من عرض نص أو صورة واحدة. صفر123 (Liu et al., 2023) ، MVDream (Shi et al., 2023) ، SV3D (استقرار ، 2024) ، CAT3D (جوجل ، 2024). عادة ما تنطلق 4-16 مشاهدة حول الكائن ، ورفعت إلى 3D عن طريق البصق الغاسية أو NeRF.

### خطوط الأنابيب من نص إلى ثلاثية الأبعاد

| Model | Input | Output | Time |
|-------|-------|--------|------|
| DreamFusion (2022) | text | NeRF via SDS | ~1 hour per asset |
| Magic3D | text | mesh + texture | ~40 min |
| Shap-E (OpenAI, 2023) | text | implicit 3D | ~1 min |
| SJC / ProlificDreamer | text | NeRF / mesh | ~30 min |
| LRM (Meta, 2023) | image | triplane | ~5 s |
| InstantMesh (2024) | image | mesh | ~10 s |
| SV3D (Stability, 2024) | image | novel views | ~2 min |
| CAT3D (Google, 2024) | 1-64 images | 3D NeRF | ~1 min |
| TripoSR (2024) | image | mesh | ~1 s |
| Meshy 4 (2025) | text + image | PBR mesh | ~30 s |
| Rodin Gen-1.5 (2025) | text + image | PBR mesh | ~60 s |
| Tencent Hunyuan3D 2.0 (2025) | image | mesh | ~30 s |

2025-2026 الاتجاه: نماذج مباشرة من النص إلى الشبكة مع مواد PBR مناسبة لمحركات اللعبة. الخطوة المتوسطة للتنشر متعدد الرؤية لا تزال أفضل وصفة للأشياء العامة.

### (نيرف)

حقل الإشعاع العصبي (ميلدنهول وآخرون، 2020).`(x, y, z, view direction)`والخروج`(color, density)`. التعبير عن طريق التكامل على طول الأشعة. يتفوق على تركيب الرؤية الجديدة القائمة على الشبكة في الجودة ولكن بطيئة في التعبير 100-1000 مرة. يتم تكرارها من قبل الغوسيانة البلاستين للكثير من الاستخدامات في الوقت الحقيقي ولكن لا يزال سيطرا في البحث.

```figure
v4-3d-multiview
```

## بناءها

`code/main.py`يطبق لعبة 2D "مصفوفة غوسيان" تناسب: تمثل صورة هدف اصطناعية (مصفوفة سلسة) كمجموع من المصفوفات غوسيانية 2D. تحسين المواقف والألوان والتشابهات عن طريق انخفاض المصفوفات لتتطابق الهدف. ترى العمليات الأساسية الثانية: التسجيل الأمامي (مصفوفة + ألفا مركبة) والتناسب عن طريق انخفاض المصفوفات.

### الخطوة 1: 2D غوسيان المزق

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### الخطوة الثانية: تقديم العرض عن طريق جمع البقع

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

إنّ البقع الثلاثية الأبعاد الحقيقية لـ (غوس) تحدد (غوس) حسب عمقها وترتيباتها حسب التركيبات الفالفية

### الخطوة الثالثة: التكيف حسب التراجع المرتفعة

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## الفخاخ

- **View inconsistency.**إذا قمت بتوليد 4 مشاهد بشكل مستقل ويتفقون حول هيكل الكائن ، فإن التكيف 3D غامض.
- **Back-side hallucination.**الصورة الواحدة → 3D يجب أن يختلق الجانب غير المرئي. الجودة تختلف بشكل كبير.
- **Gaussian splat explosion.**يزداد التدريب غير المقيد إلى 10 ملايين مكثف وأكثر من المكثف.
- **Topology issues.**الشبكات من الحقول الضمنية (SDFs) غالباً ما تكون لها ثقوب أو تقاطعات ذاتية. قم بإجراء إعادة التقاطع (مثل إعادة التقاطع الصوتي للمخلوط) قبل الشحن.
- **License of training data.**Objaverse لديها تراخيص مختلطة؛ الاستخدام التجاري يختلف من نموذج إلى نموذج.

## استخدمها

| Task | 2026 pick |
|------|-----------|
| Scene reconstruction from photos | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| Text-to-3D object for games | Meshy 4 or Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| Novel-view synthesis from few images | CAT3D, SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar, HUGS |
| Research / SOTA | Whatever dropped last week |

للشحن الإنتاج 3D في لعبة أو خط أنابيب التجارة الإلكترونية: Meshy 4 أو Rodin Gen-1.5 خروج شبكات PBR التي تذهب مباشرة إلى Unity / Unreal.

## أرسله

إنقاذ`outputs/skill-3d-pipeline.md`. تتخذ مهارة المعلومات الثلاثية الأبعاد (المدخل: نص / صورة واحدة / صور قليلة ؛ الخروج: شبكة / شقق / NeRF ؛ الاستخدام: عرض / لعبة / VR) والخروج: خط الأنابيب (الانتشار متعدد المشاهد + التكيف ، أو نموذج شبكة مباشرة) ، النموذج الأساسي ، ميزانية التكرار ، بعد معالجة التطبيقات ، القنوات المادية المطلوبة.

## التمارين

1. **Easy.**أركض`code/main.py`مع 4، 16، 64 غوسيان، تقرير النهائي MSE مقابل الهدف.
2. **Medium.**تمديد إلى غوسيان اللون (RGB) تأكد من أن إعادة الإعمار تتطابق مع نمط اللون المستهدف.
3. **Hard.**باستخدام gsplat أو Nerfstudio، اعادة بناء جسم حقيقي من 50 صورة التقاط. تقرير وقت التكيف والإحصاءات النهائية على المشاهد المحتفظ بها.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | Scene as a cloud of 3D Gaussians; differentiable alpha-composite render. |
| NeRF | "Neural radiance field" | MLP that outputs color + density at a 3D point; render by ray integration. |
| Triplane | "Three 2-D planes" | Factor 3D into three 2-D axis-aligned feature grids; cheaper than volumetric. |
| SDS | "Score distillation sampling" | Train 3D model by using 2D-diffusion score as pseudo-gradient. |
| Multi-view diffusion | "Many views at once" | Diffusion model that outputs a batch of consistent camera views. |
| PBR | "Physically-based rendering" | Material with albedo, roughness, metallic, normal channels. |
| Densification | "Grow splats" | 3DGS training heuristic: split / clone splats in high-gradient regions. |

## ملاحظة الإنتاج: 3D لا يوجد تحتة مشتركة بعد

على عكس الصورة (الانتشار المتخفف + ديت) والفيديو (التخفيف الفضائي الزائم) ، لا يوجد 3D وقت تشغيل واحد مهيمن في عام 2026. شجرة قرار الإنتاج تنشأ على التمثيل:

- **NeRF / triplane.**التأثير هو تعديل الأشعة + MLP إلى الأمام لكل عينة. 5122 تعديل يتطلب ملايين من MLP إلى الأمام. شحنة عينات الأشعة بشكل عنيف؛ SDPA / xformers يطبق.
- **Multi-view diffusion + LRM reconstruction.**خط أنابيب مرحلتين. مرحلة 1 (متعددة المشاهدة DiT) هي خادم انتشار تماما مثل الدروس 07. مرحلة 2 (LRM محول) هو مرور واحد الصور إلى الأمام على المشاهدات. الملف الشخصي التأخير العام هو "الانتشار + واحد الصور"  اختيار لكل مرحلة خدمة البدائيات وفقا لذلك.
- **SDS / DreamFusion.**تحسين لكل أصول، وليس استنتاج، بناء وظائف، لا طلبات التعامل مع الموظفين.

بالنسبة لمعظم منتجات 2026 ، فإن الإجابة الصحيحة هي "تشغيل نموذج انتشار متعدد الرؤية بناء على الطلب ، وإعادة بناء 3DGS بشكل غير متزامن ، وخدمة 3DGS للمشاهدة في الوقت الحقيقي". وهذا ينقسم عبء العمل نظيفًا بين خادم إضفاءات GPU (سرعة) ومحافظ تحسين خارجي (بطيء).

## المزيد من القراءة

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) نيرف
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) 3DGS.
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) SDS
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) صفر123
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) انتشار متعدد الرؤى.
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) LRM
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314)- CAT3D
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion) SV3D.
