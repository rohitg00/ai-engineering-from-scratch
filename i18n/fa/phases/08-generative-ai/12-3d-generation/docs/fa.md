# نسل 3D

> 3D روش است که در آن نفوذ 2D به 3D قوی تر است. پیشرفت 2023 3D Gaussian Splating بود. لایه های فشار تولید کننده 2024-2026 انتشار چند منظره + بازسازی 3D در بالای آن برای تولید اشیاء و صحنه ها از یک پرامپت یا عکس واحد است.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 4 (Vision), Phase 8 · 07 (Latent Diffusion)
**Time:** ~45 minutes

## مشکل

محتوای 3D دردناک است:

- **Representation.**شبکه های نقطه ای، ابرهای نقطه ای، شبکه های فوکسل، میدان های فاصله امضا شده (SDFs) ، میدان های نورال رادیانس (NeRFs) ، غوسیان های 3D. هر کدام دارای تعادلات هستند.
- **Data scarcity.**ImageNet دارای 14 میلیون تصویر است. بزرگترین مجموعه داده های 3D تمیز (Objaverse-XL، 2023) دارای ~ 10 میلیون شی است، که کیفیت پایین ترین است.
- **Memory.**یک شبکه 5123 ووکسل 128M ووکسل است؛ یک صحنه مفید NeRF نیاز به 1M نمونه / اشعه دارد. تولید سخت تر از بازسازی است.
- **Supervision.**برای یک تصویر دو بعدی شما پیکسل ها را دارید. برای 3D شما معمولا چند تا از دیدگاه های دو بعدی را دارید و باید به 3D حرکت کنید.

ستون 2026 این دو مشکل را جدا می کند. اول، * 2D تصاویر چند منظره * با یک مدل انتشار تولید کنید. دوم، * 3D نمایش * (معمولاً اسپلاتینگ گاوسی) را به آن تصاویر متصل کنید.

## مفهوم

![3D generation: multi-view diffusion + 3D reconstruction](../assets/3d-generation.svg)

### نمایندگی: 3D Gaussian Splatting (Kerbl و همکارانش، 2023)

یک صحنه را به عنوان ابر از Gaussians 3D 1M نشان می دهد. هر کدام دارای 59 پارامتر: موقعیت (3) ، همتای (6, یا کواترنیون 4 + مقیاس 3) ، ناپاکی (1) ، رنگ گانه ساز-هارمونیک (48 در درجه 3, 3 در درجه 0) است.

نمایش = پروژکتور + آلفا-مجموعه سازی. سریع (~100 فاب / ثانیه در 1080p در 4090). قابل تشخیص. متناسب با کاهش گرادینت در برابر عکس های واقعی زمین. یک صحنه در 5-30 دقیقه در یک GPU مصرف کننده قرار می گیرد.

دو نوآوری 2023-2024 در بالا:
- **Generative Gaussian splats.**مدل هایی مانند LGM، LRM، InstantMesh، ابر گوسسی را مستقیماً از یک یا چند تصویر پیش بینی می کنند.
- **4D Gaussian Splatting.**گاسین ها با تعویضات هر فریم برای صحنه های پویا

### پخش چند منظره

تنظیم دقیق یک مدل انتشار تصویر پیش از آموزش برای تولید چندین دیدگاه متناظر از یک شی از یک پیامک متن یا یک تصویر واحد. صفر123 (Liu و همکاران، 2023), MVDream (Shi و همکاران، 2023), SV3D (ثبات، 2024), CAT3D (گوگل، 2024). معمولا 4-16 دیدگاه در اطراف شی تولید می شود، که از طریق اسپلاتینگ گاسیان یا NeRF به 3D بالا می رود.

### خط لوله های متن به 3D

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

2025-2026 جهت: مدل های مستقیم متن به شبکه با مواد PBR مناسب برای موتورهای بازی. مرحله میانگین انتشار چند منظره هنوز بهترین دستور کار برای اشیاء عمومی است.

### NERF (برای زمینه)

میدان نورال تابش (Mildenhall و همکاران، 2020). یک MLP کوچک نیاز دارد `(x, y, z, view direction)`و تولیدات`(color, density)`. رندینگ با ادغام در طول اشعه. از سنتز جدید دید مبتنی بر میش در کیفیت بهتر است اما 100-1000 برابر کندتر است. برای استفاده بیشتر در زمان واقعی با اسپلاتینگ گاوسی جایگزین می شود اما هنوز هم در تحقیقات غالب است.

```figure
v4-3d-multiview
```

## آن را بسازید

`code/main.py`یک بازی 2D "گاسین اسپلاتینگ" را پیاده سازی می کند: یک تصویر هدف مصنوعی (گراژینت صاف) را به عنوان مجموعه ای از اسپلات های 2D Gaussian نشان می دهد. موقعیت ها، رنگ ها و همگرفتگی ها را با کاهش gradient برای مطابقت با هدف بهینه سازی کنید. شما دو عملیات اصلی را می بینید: پیش نمایش (splat + آلفا-کمپوزیت) و تناسب با کاهش gradient.

### مرحله 1: 2D اسپلات گاوسی

```python
def gaussian_at(x, y, gaussian):
    px, py = gaussian["pos"]
    sigma = gaussian["sigma"]
    d2 = (x - px) ** 2 + (y - py) ** 2
    return math.exp(-d2 / (2 * sigma * sigma))
```

### مرحله دوم: با جمع کردن نقاط

```python
def render(image_size, gaussians):
    img = [[0.0] * image_size for _ in range(image_size)]
    for g in gaussians:
        for y in range(image_size):
            for x in range(image_size):
                img[y][x] += g["color"] * gaussian_at(x, y, g)
    return img
```

پراکندهاي 3D واقعی گاوسيايي گاوسيايي ها را به لحاظ عمق و آلفا-کمپوزیت ها به ترتيب ميده

### مرحله 3: متناسب با نشت گرادینتی

```python
for step in range(steps):
    pred = render(size, gaussians)
    loss = mse(pred, target)
    gradients = compute_grads(pred, target, gaussians)
    update(gaussians, gradients, lr)
```

## دام ها

- **View inconsistency.**اگر شما 4 دیدگاه را به طور مستقل تولید کنید و آنها در مورد ساختار اشیاء مخالفند، فیت 3D مبهم است.
- **Back-side hallucination.**عکس تک بعدی باید جنبه ی نامرئی را اختراع کند. کیفیت بسیار متفاوت است.
- **Gaussian splat explosion.**آموزش بدون محدودیت به 10 میلیون جای و بیش از حد رشد می کند. هوریستیک های فشرده سازی + برش (از کاغذ اصلی 3D-GS) ضروری است.
- **Topology issues.**میش های از زمینه های ضمنی (SDF) اغلب سوراخ یا خود-قاطع دارند. پیش از ارسال یک remescher (به عنوان مثال، remesx voxel مخلوط کننده) اجرا کنید.
- **License of training data.**Objaverse دارای مجوزهای مخلوط است؛ استفاده تجاری از هر مدل متفاوت است.

## ازش استفاده کن

| Task | 2026 pick |
|------|-----------|
| Scene reconstruction from photos | Gaussian splatting (3DGS, Gsplat, Scaniverse) |
| Text-to-3D object for games | Meshy 4 or Rodin Gen-1.5 (PBR output) |
| Image-to-3D | Hunyuan3D 2.0, TripoSR, InstantMesh |
| Novel-view synthesis from few images | CAT3D, SV3D |
| Dynamic scene reconstruction | 4D Gaussian Splatting |
| Avatar / clothed human | Gaussian Avatar, HUGS |
| Research / SOTA | Whatever dropped last week |

برای ارسال تولید 3D در یک بازی یا لوله تجارت الکترونیک: Mesh 4 یا Rodin Gen-1.5 پلت های PBR تولید که مستقیما به Unity / Unreal می روند.

## -باده

نگه دار`outputs/skill-3d-pipeline.md`مهارت یک خلاصه 3D (دخول: متن / یک تصویر / چند تصویر؛ خروجی: میش / سپلات / NeRF؛ استفاده: رندر / بازی / VR) و خروجی: لوله (افشاری چند منظره + مناسب یا مدل میش مستقیم) ، مدل پایه، بودجه تکرار، توپولوژی پس از پردازش، کانال های مواد مورد نیاز است.

## تمرینات

1. **Easy.**فرار کن`code/main.py`با 4، 16، 64 گاسین گزارش نهایی MSE در مقابل هدف
2. **Medium.**به رنگ گاسیان (RGB) گسترش دهید. بازسازی را با الگوی رنگ هدف مطابقت دهید.
3. **Hard.**با استفاده از gsplat یا Nerfstudio، یک شی واقعی را از یک تصویر 50 عکس بازسازی کنید. گزارش زمان مناسب و آخرین SSIM در دیدگاه های نگه داشته شده.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 3D Gaussian Splatting | "3DGS" | Scene as a cloud of 3D Gaussians; differentiable alpha-composite render. |
| NeRF | "Neural radiance field" | MLP that outputs color + density at a 3D point; render by ray integration. |
| Triplane | "Three 2-D planes" | Factor 3D into three 2-D axis-aligned feature grids; cheaper than volumetric. |
| SDS | "Score distillation sampling" | Train 3D model by using 2D-diffusion score as pseudo-gradient. |
| Multi-view diffusion | "Many views at once" | Diffusion model that outputs a batch of consistent camera views. |
| PBR | "Physically-based rendering" | Material with albedo, roughness, metallic, normal channels. |
| Densification | "Grow splats" | 3DGS training heuristic: split / clone splats in high-gradient regions. |

## توجه به تولید: 3D هنوز زیربنای مشترک ندارد

برخلاف تصویر (افشاری لاتنت + DiT) و ویدیو (diT فضایی) ، 3D هیچ زمان اجرا واحد غالب در سال 2026 ندارد. درخت تصمیم گیری تولید بر روی نمایش:

- **NeRF / triplane.**بازتاب درخشش نشان دادن + یک MLP به جلو در هر نمونه است. 5122 ارائه نیاز به میلیون ها MLP به جلو. نمونه های اشعه را به طور پرخنده انجام دهید؛ SDPA / xformers اعمال می شود.
- **Multi-view diffusion + LRM reconstruction.**خط لوله دو مرحله ای. مرحله 1 (DiT چند منظره ای) یک سرور انتشار است درست مانند درس 07. مرحله 2 (LRM ترانسفارمر) یک شات جلوتر از دیدگاه ها است. مشخصات عمومي تاخیر "تشریع + یک شات" است.
- **SDS / DreamFusion.**بهینه سازی هر دارایی نه نتیجه گیری شغل بساز نه درخواست کارکنان

برای اکثر محصولات 2026، پاسخ درست این است که "در صورت درخواست یک مدل انتشار چند منظره را اجرا کنید، به صورت غیرمسلح به 3DGS بازسازی کنید، برای مشاهده در زمان واقعی به 3DGS خدمت کنید". این بار کار را به طور تمیز بین یک سرور زیرنویس GPU (سرع) و یک بهینه ساز آفلاین (سست) تقسیم می کند.

## خواندن بیشتر

- [Mildenhall et al. (2020). NeRF: Representing Scenes as Neural Radiance Fields](https://arxiv.org/abs/2003.08934) نی آر ايف
- [Kerbl et al. (2023). 3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://arxiv.org/abs/2308.04079) 3DGS
- [Poole et al. (2022). DreamFusion: Text-to-3D using 2D Diffusion](https://arxiv.org/abs/2209.14988) SDS
- [Liu et al. (2023). Zero-1-to-3: Zero-shot One Image to 3D Object](https://arxiv.org/abs/2303.11328) صفر123
- [Shi et al. (2023). MVDream](https://arxiv.org/abs/2308.16512) پخش چند منظره
- [Hong et al. (2023). LRM: Large Reconstruction Model for Single Image to 3D](https://arxiv.org/abs/2311.04400) LRM
- [Gao et al. (2024). CAT3D: Create Anything in 3D with Multi-View Diffusion Models](https://arxiv.org/abs/2405.10314) CAT3D
- [Stability AI (2024). Stable Video 3D (SV3D)](https://stability.ai/research/sv3d-novel-multi-view-synthesis-and-3d-generation-from-a-single-image-using-latent-video-diffusion) SV3D
