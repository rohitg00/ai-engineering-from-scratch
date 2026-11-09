# انتشار پنهان و انتشار پایدار

> انتشار فضای پیکسل در تصاویر 512 × 512 یک جرم جنگی محاسباتی است. Rombach و همکاران (2022) متوجه شدند که شما برای تولید یک تصویر به تمام ابعاد 786k نیاز ندارید. شما برای گرفتن ساختار معنوی و یک دیکودر جداگانه برای بقیه نیاز دارید. انتشار را در فضای پنهان VAE اجرا کنید. این ایده یک انتشار پایدار است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## مشکل

انتشار پکسل-فضا در 5122 به این معنی است که U-Net روی تنسورهای شکل اجرا می شود`[B, 3, 512, 512]`هر مرحله نمونه گیری حدود 100 GFLOPS برای یک شبکه U-Net 500M است. 50 مرحله 5 TFLOPS برای هر تصویر است. در یک میلیارد تصویر راه اندازی کنید و حساب حساب بی معنی است.

اکثر این FLOPs به فشار دادن جزئیات بی اهمیت در نظر گرفته شده از طریق شبکه می روند  بافت فرکانس بالا که یک VAE از دست رفته می تواند فشرده شود. ایده Rombach: آموزش یک VAE یک بار (در مرحله اول*) ، آن را منجمد کنید و انتشار را به طور کامل در فضای پنهان 4 کانال 64×64 (در مرحله دوم*) اجرا کنید. همان U-Net. 1/16 پیکسل. ~ 64x FLOPs کمتر برای کیفیت قابل مقایسه.

این نسخه ی انتشار پایدار است. SD 1.x / 2.x از یک شبکه ی U-Net 860M استفاده کرد.`64×64×4`در حال حاضر، SDXL از شبکه U-Net 2.6B استفاده کرده است`128×128×4`در سال ۲۰۲۴، SD3 U-Net را با یک ترانسفورماتور انتشار (DiT) با تطابق جریان جایگزین کرد. Flux.1-dev (Black Forest Labs، 2024) یک DiT-MMDiT 12B-param را حمل می کند. همه بر روی یک زیربنای دو مرحله ای اجرا می شوند.

## مفهوم

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**کدیگر$E(x) \to z$، کدگر$D(z) \to x$. فشرده سازی هدف: 8× نمونه پایین در هر محور فضایی + تنظیم کانال ها به طوری که کل اندازه پنهان ~1/16 از تعداد پیکسل است. از دست دادن = بازسازی (L1 + LPIPS درک) + KL (وزن کوچک بنابراین $z$به اندازه گاوسیان مجبور نیست، چون ما به نمونه گیری دقیق از$z$اغلب با شکست در مقابل مقابل تمرین می کنند، بنابراین تصاویر رمزگذاری شده به شدت تیز هستند.

2. **Stage 2 — diffusion on $z$.**درمان$z = E(x_{\text{real}})$آموزش یک شبکه U-Net (یا DiT) برای انکار$z_t$. در نتیجه: نمونه$z_0$پس از پخش$x = D(z_0)$. .

**Text conditioning.**دو جزء اضافی. یک کدگر متن منجمد (CLIP-L برای SD 1.x، CLIP-L+OpenCLIP-G برای SD 2/XL، T5-XXL برای SD3 و Flux). یک تزریق توجه متقابل: هر بلوک U-Net می گیرد `[Q = image features, K = V = text tokens]`و آنها را در میان می گذارد. توکن ها تنها راه تاثیر متن بر تصویر هستند.

**The loss function is identical to Lesson 06.**همان DDPM / جریان مطابق MSE در صدا. شما فقط دامنه داده را عوض می کنید.

## انواع معماری

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

روند: جایگزین U-Net با DiT (ترانسفارمر در پیچ های پنهان) ، مقیاس کدرس متن (T5 برای پیوستن سریع CLIP را می پیشه است) ، افزایش کانال های پنهان (4 → 16 فضای بیشتر جزئیات را می دهد).

```figure
noise-schedule
```

## آن را بسازید

`code/main.py`یک بازی 1D "VAE" (یک کدگر ثابت مقیاس به 0.5 و برعکس آن به عنوان کدگر، برای نشان دادن؛ یک VAE واقعی یک شبکه conv خواهد بود) را در بالای DDPM از درس 06 و اضافه کردن شرایط کلاس با راهنمایی بدون طبقه بندی. این نشان می دهد که همان ضایعات انتشار کار می کند چه شما در خام 1D ارزش ها یا در کد ارزش ها. این بینش کلیدی است.

### مرحله اول: کدگر/دکدر

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

یک VAE واقعی دارای وزنه های آموزش دیده است. برای آموزش، این نقشه خطی کافی است تا نشان دهد که انتشار بر روی $z$بدون اینکه به فضای داده های اصلی اهمیت بدهیم.

### مرحله دوم: پخش در`z`- فضا

همان DDPM با درس 06. داده های شبکه دیده می شود$z = E(x)$بعد از نمونه گیری$z_0$، رمزگشاییش با $D(z_0)$. .

### مرحله سوم: راهنمایی بدون طبقه بندی

در طول آموزش، برچسب کلاس را 10% از زمان رها کنید (به جای یک توکن صفر) در نتیجه، هر دو را محاسبه کنید $\epsilon_{\text{cond}}$و$\epsilon_{\text{uncond}}$، پس:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= هیچ راهنمایی (تنوع کامل)$w = 3$= پیش فرض، $w = 7+$= پر شده / بیش از حد تیز

### مرحله 4: تنظیم متن (فهام، نه کد)

برچسب کلاس را با یک کدگر متن منجمد جایگزین کنید. متن درون U-Net را از طریق توجه متقابل تغذیه کنید:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

این تنها تفاوت اساسی بین یک مدل انتشار طبقاتی و انتشار ثابت است.

## دام ها

- **VAE-scale mismatch.**SD 1.x VAEs دارای ثابت مقیاس (`scaling_factor ≈ 0.18215`. پس از رمزگذاری استفاده می شود. فراموش کردن این باعث می شود شبکه ی U-Net در حال حرکت است.
- **Text encoder silently wrong.**SD3 به T5-XXL با >=128 توکن نیاز دارد و بازگشت به CLIP-فقط زیان آور است. همیشه چک کنید `use_t5=True`یا کراترهای وفاداری سریع
- **Mixing latent spaces.**SDXL، SD3، Flux همه از VAEs مختلف استفاده می کنند. یک LoRA که در SDXL پنهان آموزش داده شده است، در SD3 کار نمی کند. پخش کننده های Hugging Face 0.30+ از بارگذاری نقاط بازرسی نامتناسبه خودداری می کند.
- **CFG too high.** `w > 10`این محصول تصاویر پرتو و روغن دار را تولید می کند و به قیمت تنوع به این موضوع اضافه می کند.`w = 3-7`. .
- **Negative prompts leaking.**یک پیام منفی خالی به علامت صفر تبدیل می شود؛ یک پیام منفی پر شده به  می شود$\epsilon_{\text{uncond}}$این ها یکسان نیستند؛ بعضی از لوله ها به طور خاموش به صفر می رسند.

## ازش استفاده کن

دسته های تولید در سال 2026:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## -باده

نگه دار`outputs/skill-sd-prompter.md`. مهارت یک پیامک متن + سبک هدف و خروجی را می گیرد: مدل + نقطه چک، مقیاس CFG، نمونه، پیامک منفی، وضوح، ترکیب کنترولنت / IP-آداپتور اختیاری و یک لیست چک QA در هر مرحله.

## تمرینات

1. **Easy.**فرار کن`code/main.py`با راهنمائی$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$. نمونه متوسطي را به طبقات ثبت کن$w$آیا کلاس معنی فراتر از داده های واقعی معنی متفاوت است؟
2. **Medium.**کدگر خطی بازی را با یک کدگر/دکودر TANH-MLP با یک از دست دادن بازسازی عوض کنید. انتشار را در لانت های جدید تمرین کنید. آیا کیفیت نمونه تغییر می کند؟
3. **Hard.**با پخش کننده ها یک نتیجه گیری واقعی Stable Diffusion را تنظیم کنید: بار `sdxl-base`،30 مرحله ایولر رو با CFG=7 اجرا کن، زمانش رو بگیره`sdxl-turbo`با 4 مرحله و CFG=0، همان موضوع، کیفیت متفاوت  توضیح دهید چه چیزی تغییر کرده و چرا.

## اصطلاحات کلیدی

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

## یادداشت تولید: اجرا کردن Flux-12B در یک GPU مصرف کننده 8GB

ترکیب فلوکس مرجع این است که دستور "من یک GPU مصرف کننده دارم، آیا می توانم این را ارسال کنم؟"

1. **Staggered loading.**فلکس چهار شبکه دارد که هرگز نیازی به همبستگی در VRAM ندارند: کدگر متن T5-XXL (~ 10 GB در fp32) ، CLIP-L (کوچیک) ، 12B MMDiT و VAE. ابتدا پرامپت را کدگذاری کنید ، * حذف * کدرها ، بارگذاری DiT ، نامگذاری ، * حذف * DiT ، بارگذاری VAE ، رمزگذاری. GPU های مصرف کننده 8GB فقط در یک مرحله مناسب هستند.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`در هر دو کدگر T5 و DiT. حافظه 8× را کاهش می دهد، کاهش کیفیت برای متن به تصویر در معیار های آریترا (در نوت بوک مرتبط) قابل تشخیص نیست.
3. **CPU offload.** `pipe.enable_model_cpu_offload()`ماژول های خودکار را بین CPU و GPU تغییر می دهد تا هر گذرگاه پیشروی پیشرفت کند. تاخیر 10-20٪ را اضافه می کند اما لوله را به طور کامل اجرا می کند.

حسابداري حافظه:`10 GB T5 / 8 = 1.25 GB`مقدارش مشخص شده`12 B params × 0.5 bytes = ~6 GB`در اصطلاح stas00 این انتهای انتهای TP=1 است نتیجه گیری  هیچ موازی مدل، حداکثر کوانتاسیون. برای تولید شما TP=2 یا TP=4 را روی H100 اجرا می کنید؛ برای یک لپ تاپ واحد توسعه دهنده، این دستور است.

## خواندن بیشتر

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) انتشار ثابت
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) دیت
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3، MMDiT
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) خانواده Flux.1
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) اجرای مرجع برای هر نقطه بازرسی بالا.
