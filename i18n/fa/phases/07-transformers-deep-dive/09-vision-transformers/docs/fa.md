# ترانسفورماتورهای بینایی (ViT)

> یک تصویر یک شبکه از پیچ ها است. یک جمله یک شبکه از توکن ها است. یک ترانسفورماتور هر دو را می خورد.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## مشکل

قبل از سال 2020، بینایی کامپیوتری به معنای تحولات بود. هر SOTA در ImageNet، COCO و معیار تشخیص از یک ستون فقرات CNN استفاده می کرد. ترانسفورمرها برای زبان بودند.

دوسویتسکی و همکارانش (2020)  "یک تصویر ارزش 16 × 16 کلمه دارد"  نشان داد که می توانید پیچیدگی ها را به طور کامل کاهش دهید. یک تصویر را به پچ های اندازه ثابت برش دهید، هر پچ را به صورت خطی به یک پیوند نمایش دهید، دنباله را به یک کدگر ترانسفارمر وانیل تغذیه کنید. در مقیاس کافی (پیش از آموزش ImageNet-21k یا بزرگتر) ، ViT با مدل های مبتنی بر ResNet مطابقت دارد یا بهتر است.

ViT آغاز یک الگوی گسترده تر در سال 2026 بود: یک معماری، بسیاری از روش ها. Whisper آڈیو را نشان می دهد. ViT تصاویر را نشان می دهد. Token های عمل برای رباتیک. Token های پیکسل برای ویدیو. ترانسفورماتور اهمیتی نمی دهد.

تا سال 2026، ViT و فرزندان آن (DeiT، Swin، DINOv2، ViT-22B، SAM 3) بیشتر چشم انداز را دارند. CNN ها هنوز در دستگاه های کناری و وظایف حساس به تاخیر برنده می شوند. همه چیز دیگری یک ViT در جایی در استیک دارد.

## مفهوم

![Image → patches → tokens → transformer](../assets/vit.svg)

### مرحله 1  پیچ کردن

تقسیم یک`H × W × C`تصویر به یک `N × (P·P·C)`ترتیب پیچ های صاف. تنظیمات معمول: `224 × 224`تصویر`16 × 16`پچ ها → 196 پچ از هر یک 768 ارزش

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

اندازه پچ ها، نفوذ است. پچ های کوچکتر = توکن های بیشتر، رزولوشن بهتر، هزینه توجه مربع. پچ های بزرگتر = خشنتر، ارزان تر.

### مرحله 2  ادغام خطی

یک ماتریکس یاد گرفته هر یک از پیچ های مسطح را به `d_model`. معادل یک پیچ اندازه هسته`P`و قدم بزن`P`در " پيتورچ " اين حرفي است`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` اجرای دو خط.

### مرحله 3  پیشگیری `[CLS]`توکن، اضافه کردن ورودی های موقعیت

- آماده کردن یک یادگیری`[CLS]`. نشاني . آخرين حالت پنهانش نشاني تصويري است که براي طبقه بندي استفاده مي شود
- اضافه کردن ورودی های موضعی قابل یادگیری (ViT-اصلی) یا 2D سینوسایدی (ورژن های بعدی).
- در سال 2024+ RoPE به حالت 2D برای موقعیت، گاهی بدون گنجانده های صریح گسترش یافت.

### مرحله 4  کدگر استاندارد ترانسفورمتر

بلوک های L را جمع کنید`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`. مشابه برت . بدون لایه های خاص چشم . این خط آموزشی مقاله است

### مرحله پنجم

برای طبقه بندی: take `[CLS]`حالت پنهان → خطی → نرمmax. برای DINOv2 یا SAM، رد کنید `[CLS]`، از داخلش ها استفاده کن

### انواع مهم

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### چرا چند وقت طول کشید

وی تی به *بسیاری* داده برای مطابقت با سی ان ان نیاز دارد زیرا هیچ یک از تعصب های انتخابی سی ان ان (غیرتبدیل ترجمه، محل وقوع) ندارد. بدون تصاویر برچسب گذاری شده > 100 میلیون یا آموزش های پیش از خود نظارت قوی، سی ان ان هنوز هم در محاسبه مطابقت برنده می شوند. DeiT این را در سال 2021 با ترفند های تخلیه حل کرد؛ DINOv2 آن را به طور دائمی در سال 2023 با نظارت خود حل کرد.

```figure
n5-patch-stream
```

## آن را بسازید

ببین`code/main.py`.پاکسازی خالص-stdlib + گنجاندن خطی + بررسی های ذهنی. هیچ آموزش  ViT در هر مقیاس واقعی نیاز به PyTorch و ساعت های زمان GPU.

### مرحله اول: تصویر جعلی

یک تصویر 24 × 24 RGB به عنوان یک لیست از ردیف های `(R, G, B)`دو تپل. ما از 6×6 پیچ استفاده می کنیم → 16 پیچ، هر یک از 108-D ویکتور های گنجانده شده.

### مرحله دوم: پیچش

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

آرژانتین راستر: ردیف اصلی در سراسر شبکه. هر ViT از این آرژانتین استفاده می کند.

### مرحله سوم: ثبت خطی

هر تکه مسطح رو با تصادفی ضرب کن`(patch_flat_size, d_model)`ماتریکس. شکل خروجی را بررسی کنید`(N_patches + 1, d_model)`بعد از آماده شدن`[CLS]`. .

### مرحله 4: شمارش پارامترهای برای یک ViT واقع بین

شمارش پارامای برای ViT-Base چاپ کنید: 12 لایه، 12 سر، d=768, پیچ=16. مقایسه با ResNet-50 (~25M). ViT-Base در ~86M. ViT-Large ~307M. ViT-Huge ~632M.

## ازش استفاده کن

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

**DINOv2 embeddings are the 2026 default for image features.**ستون فقرات رو منجمد کن، سر کوچکی رو آموزش بده، کار میکنه برای طبقه بندی، بازیافت، تشخیص، سرنخ بندی، نقاط کنترل DINOv2 Meta در هر کاری بدون متن از CLIP بهتر عمل میکنه

**Patch-size picking.**مدل های کوچک از 16 × 16 (ViT-B/16) استفاده می کنند. پیش بینی ضخیم (تقسمت) از 8 × 8 یا 14 × 14 (SAM، DINOv2) استفاده می کند. مدل های بسیار بزرگ از 14 × 14 استفاده می کنند.

## -باده

ببین`outputs/skill-vit-configurator.md`مهارت برای یک کار جدید با توجه به اندازه مجموعه داده ها، وضوح و بودجه محاسبه، یک ویرانت و اندازه پیچ ViT را انتخاب می کند.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. تعداد تکه ها رو چک کن`(H/P) * (W/P)`و ابعاد مسطح پلت برابر است`P*P*C`. .
2. **Medium.**پیاده سازی 2D sinusoidal موقعیت های گنجانده  دو کد مستقل sinusoidal برای `row`و`col`از هر پیچ، به هم متصل شده. آنها را به یک PyTorch ViT کوچک تغذیه کنید و دقت و تعبیرات موقعیت قابل یادگیری را در CIFAR-10 مقایسه کنید.
3. **Hard.**یک ViT سه لایه (PyTorch) بسازید، بر روی ۱۰۰۰ تصویر MNIST با پیچ های ۴×۴ تمرین کنید. دقت آزمایش را اندازه گیری کنید. حالا DINOv2 را قبل از تمرین بر روی همان ۱۰۰۰ تصویر اضافه کنید (به سادگی: فقط کدگر را برای پیش بینی پیوند های پیچ از پیچ های ماسک شده آموزش دهید). آیا دقت بهبود می یابد؟

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929)- روزنامه "ویتی"
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) DeiT
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) سوين
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) DINOv2
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) تصحیح رمز ثبت DINOv2
