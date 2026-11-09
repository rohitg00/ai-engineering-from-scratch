# نسل ویدیویی

> یک تصویر یک تنسور 2D است. یک ویدیو یک تنسور 3D است. نظریه یکسان است؛ محاسبه 10-100 برابر سخت تر است. Sora OpenAI (فروری 2024) ثابت کرد که این امکان وجود دارد. تا سال 2026 Veo 2 ، Kling 1.5 ، Runway Gen 3 ، Pika 2.0 ، و WAN 2.2 ویدئو تولید کشتی از متن در 1080p  و استیک وزن باز (CogVideoX ، HunyuanVideo ، Mochi-1 ، WAN 2.2) 12 ماه عقب است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## مشکل

یک ویدیو ۱۰ ثانیه ای 1080p در ۲۴ فیتس فی ثانیه ۲۴۰ فریم از ۲۰۲۰×۱۰۸۰×۳ پیکسل است. این حدود ۱.۵ جی بی داده خام در هر کلیپ است. انتشار فضای پیکسل غیرممکن است. شما نیاز دارید:

1. **Spatiotemporal compression.**یک VAE که ویدیو ها را، نه فریم ها را، به یک ردیابی از پیچ های فضایی-زمان رمزگذاری می کند.
2. **Temporal coherence.**فریم ها باید محتوای، نور و هویت اشیاء را در عرض چند ثانیه به اشتراک بگذارند. شبکه باید حرکت را مدل کند.
3. **Compute budget.**آموزش ویدیویی 10-100 برابر گران تر از تصویر برای اندازه مدل است.
4. **Conditioning.**متن، تصویر (در اولین فریم) ، صوتی یا ویدئو دیگر. اکثر مدل های تولید همه این چهار را قبول می کنند.

معماری که این مسئله را حل کرد،**Diffusion Transformer (DiT)**در مورد پیچ های فضایی و زمانی استفاده می شود، که در مجموعه داده های بزرگ (پروپ، عنوان، ویدیو) آموزش دیده می شود. همان از دست دادن انتشار مانند درس 06.

## مفهوم

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### پخت کردن

این ویدیو را با یک VAE 3D (تضغط فضایی و زمانی آموخته) رمزگذاری کنید.`[T_latent, H_latent, W_latent, C_latent]`. به قسمت هاي بزرگ جدا شده`[t_p, h_p, w_p]`براي مدل هاي سبک سورا`t_p = 1`(پات ها در هر فریم) یا `t_p = 2`(هر دو فریم) یک ویدیو ۱۰ ثانیه ای 1080p به حدود ۲۰،۰۰۰ تا ۱۰۰،۰۰۰ تکه فشرده می شود.

### زمان و مکان

یک ترانسفورماتور به ترتیب صاف پیچ ها عمل می کند. هر پیچ دارای یک گنجانشی موقعیت 3D (زمان + y + x) است. توجه معمولاً فاکتور شده است:

- **Spatial attention**در داخل هر قاب.
- **Temporal attention**در هر چارچوبی در همان مکان فضایی.
- **Full 3D attention**16-100 برابر گران تر است؛ تنها در وضوح پایین یا در تحقیقات استفاده می شود.

### تنظیم متن

توجه متقابل با یک کدگر متن بزرگ (T5-XXL برای Sora، CogVideoX-5B از T5-XXL استفاده می کند). درخواست های طولانی مهم است  مجموعه آموزشی Sora دارای پیش نویس های کثیف تولید شده توسط GPT با میانگین 200 توکن در هر کلیپ بود.

### آموزش

ضایع انتشار استاندارد (ε یا v پیش بینی) در طول زمان و مکان. داده ها: ویدئو وب + ~ 100M کلیپ های مرتب + عناوین متن مصنوعی. محاسبه: 10,000 + ساعت GPU برای حتی یک تحقیق کوچک؛ مقیاس Sora 100,000 + است.

## منظره تولید 2026

| Model | Date | Max duration | Max res | Open weights? | Notable |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | No | First model to show world simulator properties at scale |
| Sora Turbo | 2024-12 | 20s | 1080p | No | Production Sora at 5x faster inference |
| Veo 2 (Google) | 2024-12 | 8s | 4K | No | Highest quality + physics in 2025 |
| Veo 3 | 2025 Q3 | 15s | 4K | No | Native audio and stronger camera control |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | No | Best human motion in 2025 Q1 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | No | Professional video tools on top |
| Pika 2.0 | 2024-10 | 5s | 1080p | No | Strongest character consistency |
| CogVideoX (THUDM) | 2024 | 10s | 720p | Yes (2B, 5B) | First open 5B-scale video |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | Yes (13B) | Open SOTA late 2024 |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | Yes (10B) | Most permissively licensed |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | Yes | Strongest open model mid-2025 |

وزن های باز، شکاف را سریعتر از فضای تصویر می پوشاند: HunyuanVideo + WAN 2.2 LoRA ها در اواسط سال 2026 بیشتر جریان های کار منبع باز را تقویت می کنند.

```figure
video-diffusion-denoise
```

## آن را بسازید

`code/main.py`شبیه سازی ایده اصلی فضای زمانی DiT: یک ویدیو مصنوعی کوچک را پیچ کنید، یک پیوند موقعیت هر پیچ اضافه کنید و کل دنباله را با توجه به سبک ترانسفورماتور بر روی پیچ ها نامزدی کنید. هیچ نمپی نیست؛ پاک پایتون. ما نشان می دهیم که همبستگی زمانی حتی در 1-D ظاهر می شود وقتی پیچ های فریم مجاور یک نامزدی و پیوند موقعیت را به اشتراک می گذارند.

### مرحله ی اول: یک ویدیو مصنوعی یک بعدی را پیچ کنید

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### مرحله دوم: قرار دادن موقعیت در هر قاب

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### مرحله 3: denoiser کل دنباله را می بیند

به جای اینکه هر قاب را به طور مستقل رد کنیم، شبکه کوچک ما تمام ارزش های قاب را + گنجانده های موقعیت آنها را به هم متصل می کند و صدای تمام قاب را به طور مشترک پیش بینی می کند.

### مرحله 4: آزمایش همبستگی زمانی

بعد از تمرین، نمونه ای از یک ویدیو را انجام دهید. دلتای فریم به فریم را اندازه گیری کنید. اگر مدل ساختار زمانی را آموخته است، دلتاها کوچکتر از نمونه گیری هر فریم به طور مستقل باقی می مانند.

## دام ها

- **Independent per-frame sampling = flicker.**اگر شما پخش تصویر را در هر فریم به طور جداگانه اجرا کنید، خروجی به دلیل صدا هر فریم مستقل می شود. پخش ویدئویی این را با اتصال فریم ها از طریق توجه یا صدا مشترک حل می کند.
- **Naive 3D attention = OOM.**توجه ۳ بعدی کامل در یک ۱۰ ثانیه 1080p پنهان صدها میلیارد عملیات است. فاکتور به فضا + زمان.
- **Data captioning matters more than size.**پیشرفت اصلی Sora نسبت به کارهای قبلی آموزش در مورد عناوین دقیق تر (کلیپ های GPT-4 تغییر نام) بود. گزارش فنی OpenAI در این مورد صریح است.
- **First-frame conditioning.**اکثر مدل های تولید همچنین یک تصویر را به عنوان فریم اول پذیرفته اند. این حالت "تصاویر به ویدئو" است؛ آموزش شامل این نوع است.
- **Physics drift.**کلیپ های طولانی (> 10s) عدم مطابقت ظریف را جمع می کنند. تولید پنجره های لانه + لنگر کردن کلید کمک می کند.

## ازش استفاده کن

| Use case | 2026 pick |
|----------|-----------|
| Highest-quality text-to-video, hosted | Veo 3 or Sora |
| Camera-controlled cinematic | Runway Gen-3 with motion brushes |
| Character consistency across clips | Pika 2.0 or Kling 2.1 |
| Open weights, fast fine-tune | WAN 2.2 + LoRA |
| Image-to-video | WAN 2.2-I2V, Kling 2.1 I2V, or Runway |
| Audio-to-video lip sync | Veo 3 (native audio) or a dedicated lip-sync model |
| Video editing | Runway Act-Two, Kling Motion Brush, Flux-Kontext (still-frame) |

هزینه هر ثانیه ویدیو در برابر کیفیت بین سال های 2024 و 2026 20 برابر کاهش یافته است.

## -باده

نگه دار`outputs/skill-video-brief.md`. مهارت یک خلاصه ویدیویی (مدت، نسبت ابعاد، سبک، طرح دوربین، هماهنگی موضوع، صوتی) و خروجی را می گیرد: مدل + میزبانی، استقرار فوری (زبان دوربین، توصیف موضوع، توصیف حرکت) ، پروتکل تخم + تولید مجدد و یک لیست چک QA سطح فریم.

## تمرینات

1. **Easy.**در`code/main.py`در این زمینه، دلتای فریم به فریم را برای (ا) نمونه گیری مستقل در هر فریم، (ب) نمونه گیری در یک سری مشترک مقایسه کنید.
2. **Medium.**یک شرط فریم اول اضافه کنید: فریم پین 0 به یک مقدار داده شده و بقیه را نمونه کنید. اندازه گیری چگونگی گسترش ارزش پین شده را اندازه گیری کنید.
3. **Hard.**با استفاده از پخش کننده های HuggingFace برای اجرا CogVideoX-2B در یک GPU محلی. زمان 20 نتیجه گیری در 720p برای یک کلیپ 6 ثانیه. پروفایل توجه فضایی-زمان برای شناسایی گلو بطن.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | Encoder that compresses `(T, H, W, C)` → spatiotemporal latent. |
| Patches | "The tokens" | Fixed-size 3-D blocks of the latent; input to the DiT. |
| Factorized attention | "Spatial + temporal" | Run attention over space, then over time; skip full 3-D attention. |
| Image-to-video (I2V) | "Animate this photo" | Model takes an image + text, outputs a video that starts from it. |
| Keyframe conditioning | "Anchor frames" | Pin specific frames to control the video's arc. |
| Motion brush | "Directional hint" | UI input where the user paints motion vectors onto the image. |
| Re-captioning | "Dense captions" | Using an LLM to re-label training clips with detailed prompts. |
| Flicker | "Temporal artifact" | Frame-to-frame inconsistency; fixed with coupled denoising. |

## توجه تولید: لانت های ویدیویی یک مشکل حافظه و عرض باند هستند

یک کلیپ 10 ثانیه 1080p در 24 fps 240 فریم × 1920 × 1080 × 3 ≈ 1.5 جی بی پیکسل خام است. پس از فشرده سازی VAE ویدیویی 4 × (`2 × spatial × 2 × temporal`) در حال حاضر در حال حرکت در یک DiT فضایی-زمان برای 30 مرحله در دسته 1 و شما در حال حرکت در ~3 GB / قدم از طریق HBM  بیند برد حافظه، نه FLOPs، شکاف است.

سه تله تولید، همه از فصل تولید-تثبیت ادبیات:

- **TP across the DiT.**مدل های متن به ویدئو معمولاً ≥10B پارام هستند. TP=4 در 4 H100 استاندارد است؛ PP=2 × TP=2 برای مدل های کلاس 405B. لیتین در هر مرحله تقریباً خطی کاهش می یابد.
- **Frame batching = continuous batching.**در زمان تولید، ویدیو به طور مفهومی یک دسته از فریم ها است که توسط توجه به هم متصل می شوند.`t+1`در حالی که قاب`t-1`در حال بازگشت است، اگر معماری مدل اجازه تولید پنجره های شیفت را می دهد.
- **Clip-level prefill cache.**برای تصویر به ویدیو، تنظیم فریم اول شبیه به پر کردن سریع LLM است: آن را یک بار محاسبه کنید، از طریق گذرگاه های دیکودر زمانی استفاده مجدد کنید. این به طور موثر یک کیش KV برای ویدیو است.

## خواندن بیشتر

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/)گزارش فنی سورا
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) CogVideoX
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) HunyuanVideo
- [Genmo (2024). Mochi 1 preview model card](https://huggingface.co/genmo/mochi-1-preview)-موتشي-1
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) SOTA در اواسط سال 2025 باز شود.
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) کاغذ پخش ویدئویی اصلی.
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) اجداد انتشار ویدیویی پایدار.
