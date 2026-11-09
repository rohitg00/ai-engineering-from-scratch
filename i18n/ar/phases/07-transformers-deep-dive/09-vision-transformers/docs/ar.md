# تحويلات الرؤية (ViT)

> الصورة هي شبكة من المزيفات، الجملة هي شبكة من الرموز. نفس المحول يأكل كليهما.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## المشكلة

قبل عام 2020، كان رؤية الكمبيوتر تعني تحولات. كل SOTA على ImageNet، COCO، ومعايير الكشف استخدمت قاعدة قاعدة قاعدة CNN. كان المحولات لغة.

دوسويتسكي وزملاء (2020)  "الصورة تساوي 16 × 16 كلمة"  أظهر أنه يمكنك إسقاط التحولات بالكامل. قم بتقطيع صورة إلى ملصقات ذات حجم ثابت ، وبرمج كل ملصق خطياً في إضافة ، ومدفئة التسلسل إلى مُرسل مُحول فانيلياً. على نطاق كاف (مُقبل التدريب على ImageNet-21k أو أكبر) ، يطابق ViT أو يفوق النماذج القائمة على ResNet.

كانت ViT بداية نمط أوسع في عام 2026: بنية واحدة، العديد من الطرق. يُشير إلى الصوت. ViT يُشير إلى الصور. توكنات العمل للروبوتات. توكنات البيكسل للفيديو. لا يهتم المحول  يُغذيه تسلسلًا ويعلم.

بحلول عام 2026، يمتلك ViT وذريته (DeiT، Swin، DINOv2، ViT-22B، SAM 3) معظم الرؤية. لا تزال قنوات CNN تفوز على الأجهزة الحافة والمهام الحساسة بالخمول. كل شيء آخر لديه ViT في مكان ما في كومة.

## المفهوم

![Image → patches → tokens → transformer](../assets/vit.svg)

### الخطوة 1  إصلاح

تقسيم`H × W × C`الصورة إلى صورة`N × (P·P·C)`تسلسل اللقطات المسطحة.`224 × 224`الصورة`16 × 16`اللقطات → 196 اللقطات ذات 768 قيمة لكل منها.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

حجم اللصوص هو الرافعة. اللصوص الصغيرة = المزيد من الرموز، وضوح أفضل، تكلفة الاهتمام التربيعي. اللصوص الكبيرة = أكثر صعوبة، أرخص.

### الخطوة 2  إضافة خطية

المصفوفة المعلمة واحدة تعرض كل مسطح مسطح إلى`d_model`. يعادل صعوبة من حجم النواة`P`و خطوات`P`في (بيتورش) هذا حرفياً`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` تنفيذ خطين.

### الخطوة 3  إعداد `[CLS]`رمز، إضافة التوابل الموضعية

- إعداد شيء يمكن التعلم`[CLS]`الـ (Token) ، الحالة الخفية النهائية هي تمثيل الصورة المستخدمة للتصنيف
- إضافة التوابل الموضعية القابلة للتعلم (في تي الأصلية) أو 2D السينوسويدية (المختلفات اللاحقة).
- في عام 2024+ تم تمديد RoPE إلى 2D للموقع، أحياناً دون تضمين صريح.

### الخطوة 4  مُرمّد مُحول قياسي

كومة من الكتل`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`. متطابقة مع برت . لا توجد طبقات محددة للرؤية . هذه هي الخطوط التعليمية للورقة

### الخطوة 5

للتصنيف: خذ `[CLS]`الحالة الخفية → خطية → softmax. بالنسبة لـ DINOv2 أو SAM، إرمي`[CLS]`، استخدموا إضافة المفاتيح مباشرة

### الإختلافات التي كانت مهمة

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### لماذا استغرق الأمر وقتاً

تحتاج شركة ViT إلى * الكثير من البيانات لتطابق CNN لأنها لا تملك أي من التحيزات التحديدية لـ CNN (غير تغير الترجمة ، المحلية). بدون صور معينة > 100 مليون أو تدريبات سابقة ذاتية إشراف قوية ، لا تزال شركة CNN تفوز في الحسابات المتطابقة. حل DeiT هذا في عام 2021 باستخدام خدوش التقطير ؛ حل DINOv2 بشكل دائم في عام 2023 باستخدام الإشراف الذاتي.

```figure
n5-patch-stream
```

## بناءها

انظر`code/main.py`. صبغات مستحقة + إضافة خطية + فحص الصحة العقلية. لا تدريب  ViT على أي نطاق واقعي يحتاج PyTorch و ساعات من وقت GPU.

### الخطوة الأولى: صورة مزيفة

صورة RGB 24 × 24 كقائمة من صفوف `(R, G, B)`نستخدم 6×6 معطيات → 16 معطيات، 108-D وضع متجه لكل.

### الخطوة الثانية: إصلاح

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

ترتيب الرأس: الصف الرئيسي عبر الشبكة كل ViT يستخدم هذا الترتيب

### الخطوة الثالثة: إرسال خطي

ضرب كل مسطح مسطح بالشكل العشوائي`(patch_flat_size, d_model)`المصفوفة. التحقق من شكل الخروج هو `(N_patches + 1, d_model)`بعد الإعداد`[CLS]`. . .

### الخطوة الرابعة: إعداد المعايير لـ ViT الواقعي

طبع عدد المعايير لـ ViT-Base: 12 طبقة، 12 رأس، d = 768, معصمة = 16. مقارنة مع ResNet-50 (~ 25M). ViT-Base يصل إلى ~ 86M. ViT-Large ~ 307M. ViT-Huge ~ 632M.

## استخدمها

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings are the 2026 default for image features.**تجميد العمود الفقري، تدريب رأس صغير يعمل للتصنيف، الاستعراض، الكشف، الترجمة. نقاط التفتيش DINOv2 في Meta تتفوق على CLIP في كل مهمة رؤية غير نصية.

**Patch-size picking.**تستخدم النماذج الصغيرة 16 × 16 (ViT-B/16). تستخدم التنبؤات الكثيفة (التقسيم) 8 × 8 أو 14 × 14 (SAM ، DINOv2). تستخدم النماذج الكبيرة جدا 14 × 14.

## أرسله

انظر`outputs/skill-vit-configurator.md`. تتختر المهارة فاريان ViT وحجم الإصلاح لمهمة رؤية جديدة نظراً لقياس مجموعة البيانات والقرار وميزانية الحساب.

## التمارين

1. **Easy.**أركض`code/main.py`. تأكد من عدد المزقين يساوي`(H/P) * (W/P)`وبعملية المزج المسطح مساوية`P*P*C`. . .
2. **Medium.**تنفيذ إدخالات موقفية في الحلبة السينوسيدالية 2D  اثنين من رموز الحلبة السينوسيدالية المستقلة ل `row`و`col`كل ملصق، متسلسل. إعطائهم في جهاز PyTorch ViT الصغير وقارن الدقة مقابل التوابل الموضعية القابلة للتعلم على CIFAR-10.
3. **Hard.**قم ببناء ViT (PyTorch) ثلاثية الطبقات ، وتدريب على 1000 صورة MNIST مع ملصقات 4 × 4. قياس دقة الاختبار. الآن أضف DINOv2 التدريب المسبق على نفس 1000 صورة (بسهولة: فقط تدريب المبرمج للتنبؤ بتضمين اللصوص من ملصقات مخفية). هل تتحسن الدقة؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## المزيد من القراءة

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929)ورقة "في تي".
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) إختيار
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030)-تسلل
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) DINOv2
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) إصلاح رمز التسجيل لـ DINOv2.
