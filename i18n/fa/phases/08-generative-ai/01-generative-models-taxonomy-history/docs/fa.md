# مدل های نسلآورانه  تاکسونومی و تاریخ

> هر مدل تصویری، مدل متن، مدل ویدیویی و مدل سه بعدی در یکی از پنج سطل قرار می گیرد. سطل اشتباه را انتخاب کنید و شما هفته ها با ریاضیات مبارزه خواهید کرد. درست را انتخاب کنید و آخرین 12 سال پیشرفت این زمینه به خوبی در ذهن شما جمع می شود.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## مشکل

یک مدل تولید کننده یک کار را انجام می دهد: نمونه های آموزش داده شده از برخی توزیع ناشناخته گرفته شده است $p_{\text{data}}(x)$صورت ها، جمله ها، فایل های MIDI، ساختار پروتئین ها همه همان مشکل هستند اگر چشمک بزنید.

مشکل اينه که$p_{\text{data}}$در یک فضا با میلیون ها ابعاد زندگی می کند (تصاویر 512x512 RGB ابعاد ~786k است) ، نمونه ها روی یک دسته نازک در داخل این فضا قرار دارند و شما فقط 10M نمونه دارید. فشار دادن کثافت بی امید است. هر مدل تولید کننده یک سازشی است که یک مشکل سخت را به یک مشکل کمی کمتر سخت می کند.

پنج خانواده در 12 سال گذشته زنده ماندند. دانستن اینکه هر خانواده چه سازشی می کند، به شما می گوید چرا در برخی وظایف برنده می شود و در دیگران سقوط می کند.

## مفهوم

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**بنویس$\log p(x)$در این حالت، ما می توانیم به طور کلی با توجه به این که ما در حال بررسی این موضوع هستیم، به عنوان یک مبلغ که شما واقعا می توانید ارزیابی کنید.$p(x) = \prod_i p(x_i \mid x_{<i})$.تولید جریان های عادی (RealNVP, Glow)$p(x)$Pro: احتمال دقیق، از دست دادن آموزش تمیز Con: نتیجه گیری خودکشی تسلسل است (در دنباله های طولانی آهسته) ، جریان ها نیاز به معماری های قابل برگشت (متمرکز معماری) دارند.

**2. Explicit density, approximate.**بسته شده$\log p(x)$از پایین (ELBO) و بهینه سازی مرز. VAEs (Kingma 2013) از یک کدگر-دکودر با یک عقب تغییر استفاده می کنند. مدل های انتشار (DDPM، Ho 2020) یک داینوسر را آموزش می دهند که ضمنی طور یک ELBO وزن شده را بهینه می کند. انتشار است که ستون فقرات تصویر، ویدیو و 3D در سال 2026 غالب است.

**3. Implicit density.**تمامي تراکم رو رد کنيد. يک ژنراتور ياد بگيريد.$G(z)$که نمونه ها و یک تبعیض کننده تولید می کند$D(x)$این مدل به عنوان یک مدل جدید برای عکاسی با دامنه ثابت ( چهره ها، اتاق خواب) در سال 2026 نیز در حال پیشرفت است.

**4. Score-based / continuous-time.**گرادینت تراکم چوب را یاد بگیرید$\nabla_x \log p(x)$(نمره) مستقیماً. Song & Ermon (2019) نشان داد که مطابقت نمره انتشار را به یک SDE عمومی می کند. مطابقت جریان (Lipman 2023) گرمای 2024-2026 است: آموزش بدون شبیه سازی، مسیرهای مستقیم تر، نمونه گیری 4-10 برابر سریعتر از DDPM. Stable Diffusion 3, Flux، AudioCraft 2 همه از مطابقت جریان استفاده می کنند.

**5. Token-based autoregressive over discrete codes.**داده های با حجم بالا را با یک VQ-VAE یا کوانتیزر باقیمانده به یک سلسله کوتاه از توکن های متمایز فشرده کنید، سپس از یک ترانسفارمر برای مدل سازی تسلسل توکن استفاده کنید. Parti، MuseNet، AudioLM، VALL-E، توکنایزر پیچ Sora همه از این استفاده می کنند. این سطل 1 به علاوه یک توکنایزر آموخته است.

## تاریخچه ای کوتاه

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## پنج سوال

وقتی یک مقاله جدید مدل تولید کننده کاهش می یابد، قبل از خواندن بخش روش، به این پنج سوال پاسخ دهید.

1. **What is being modeled?**پیکسل ها، غش ها، توکن های متمایز، گاسیان های 3D، میش ها، شکل های موج؟
2. **Is the density explicit or implicit?**آیا می نویسند؟$\log p(x)$؟
3. **Sampling: one-shot or iterative?**تکرار به معنای نتیجه گیری کندتر است؛ یک شات معمولا به معنای مخالف یا مستقیم است.
4. **Conditioning: unconditional, class, text, image, pose?**این باعث می شود که از دست دادن و ساخت و ساز را تعیین کند.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**هر کدام از آنها روش های شکست را می شناسند (به درس ۱۴ نگاه کنید).

شما به این پنج تا برای هر درس در این مرحله پاسخ می دهید تا در پایان، آنها بازتاب خواهند شد.

```figure
autoencoder-bottleneck
```

## آن را بسازید

کد این درس یک تصویربرداری سبک وزن است: یک ترکیب 1-D از گاسیان ها را از نمونه ها با استفاده از سه رویکرد بازی (شبیه هسته، هیستogram متمایز و ژنراتور "GAN-ish" نمونه نزدیک) متناسب کنید تا بتوانید تفاوت بین کثافت صریح و ضمنی را در یک مشکل مشاهده کنید که می توانید در یک صفحه چاپ کنید.

فرار کن`code/main.py`. از دو حالت مخلوط گاسین 2000 نمونه می گیرد و سپس چاپ می کند:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

توجه کنید: دو مورد اول اجازه می دهد تا شما بپرسید "این نقطه چقدر احتمال دارد؟" سوم نمی تواند. این تفاوت * صریح و غیر صریح* است که برای هر درس آینده مهم خواهد بود.

## ازش استفاده کن

چه خانواده، برای چه وظیفه، در سال 2026؟

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact $\log p(x)$. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## -باده

پس از`outputs/skill-model-chooser.md`. .

مهارت یک توصیف و نتایج وظیفه را می گیرد: (1) کدام خانواده را استفاده کنید، (2) یک لیست مرتب از سه گزینه باز و سه گزینه میزبان، (3) حالت احتمالی شکست که باید دنبال کنید، و (4) بودجه محاسبه / زمان.

## تمرینات

1. **Easy.**برای هر یک از این پنج محصول، خانواده و ستون فقرات را شناسایی کنید: تصویر ChatGPT، Midjourney v7, Sora، Runway Gen-3, ElevenLabs. شواهد باید از گزارش های فنی عمومی باشد.
2. **Medium.**مقاله ای که فردا می خوانید، ادعا می کند که نمونه گیری ۱۰۰ برابر سریع تر از انتشار است. سه سوال را بنویسید تا ببینید آیا سرعت افزایشی از حالت و وضوح بالا زنده می ماند یا نه.
3. **Hard.**یک دامنه را که به آن اهمیت می دهید (به عنوان مثال ساختار پروتئین، CAD، مولکول ها، مسیرها) بگیرید. به پنج سوال برای مدل SOTA فعلی در آن دامنه پاسخ دهید و نشان دهید که یک مدل بهتر چه چیزی را تغییر می دهد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for $p_{\text{data}}(x)$, optionally exposes $\log p(x)$. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable $\log p(x)$. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate $p(x)$ of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on $\log p(x)$; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | $\nabla_x \log p(x)$; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## یادداشت تولید: پنج خانواده، پنج شکل نتیجه گیری

هر خانواده نقشه به یک منحنی هزینه خادم نتیجه گیری متفاوت. ادبیات تولید-انفرنس، نتیجه گیری LLM را به عنوان prefill + decode قرار می دهد؛ همان تجزیه در اینجا اعمال می شود:

- **Autoregressive (bucket 1 and 5).**کد بندی تسلسل بر تاخیر غالب است؛ KV-کاش، دسته بندی مداوم و کدگذاری حدس زده همه مستقیماً اعمال می شوند.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**در مفهوم LLM هیچ رمزگذاری وجود ندارد.`num_steps × step_cost`و`step_cost`یک ترانسفورماتور یا U-Net در پیش با وضوح کامل غش است. دکمه های تولید تعداد مراحل (DDIM / DPM-Solver / destillation) ، اندازه دسته و دقت (bf16 / fp8 / int4) هستند.
- **GAN (bucket 3).**یک پاس جلو، هیچ برنامه، هیچ کیش KV، TTFT ≈ تمام تاخیر. به همین دلیل است که StyleGAN هنوز در UX دامنه باریک برنده است.

وقتی در یک خلاصه کاغذ "سرعت تر از انتشار" را می بینید، آن را به "کم تر گام × هزینه همان گام" یا "همان گام × هزینه پایین تر گام" ترجمه کنید.

## خواندن بیشتر

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) کاغذ GAN
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) کاغذ VAE
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) مقاله DDPM
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) انتشار به عنوان یک SDE.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) کاغذ مطابقت جریان
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) انتشار ثابت 3.
