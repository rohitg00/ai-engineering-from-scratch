# النماذج الجيناتية  التصنيف والتاريخ

> كل نموذج الصورة، نموذج النص، نموذج الفيديو، ونموذج 3D يناسب في واحد من خمسة سطل. اختيار سطل خاطئ وسوف تقاتل الرياضيات لأسابيع. اختيار الحق واحد والحقل الـ 12 سنة الأخيرة من التقدم تتراكم نظيفة في رأسك.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## المشكلة

النموذج التوليد يقوم بعمل واحد: عينات التدريب المقدمة من بعض التوزيع غير المعروف $p_{\text{data}}(x)$أظهر عينات جديدة تبدو وكأنها جاءت من نفس التوزيع. وجوه، جمل، ملفات MIDI، هيكل البروتين

المشكلة هي أن$p_{\text{data}}$يعيش في مساحة ذات ملايين الأبعاد (صورة RGB 512 × 512 تبلغ 786K أبعاد) ، والعينة تجلس على مجموعة رقيقة داخل هذا المساحة، ويمكنك الحصول على فقط ربما 10M من الأمثلة. القوة الوحشية الكثافة هي بلا أمل. كل نموذج توليدي هو تنازل الذي يتداول مشكلة واحدة صعبة مقابل واحدة أقل صعوبة قليلا.

خمسة عائلات نجوت خلال الاثني عشر عاماً الماضية، معرفة ما الذي يفعله كل عائلة يخبرك لماذا تفوز في بعض المهام وتنهار في الآخرين.

## المفهوم

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**اكتب$\log p(x)$النماذج السلبية (PixelCNN، WaveNet، GPT) تصنع$p(x) = \prod_i p(x_i \mid x_{<i})$. إنشاء التدفقات الطبيعية (الواقعية النفطية، الوهاء) $p(x)$كتحويل قابل للتحويل من قاعدة بسيطة. المزايا: احتمالات دقيقة، فقدان التدريب النظيف. المشكلة: استنتاج السريع هو تسلسل (بطيء لسلسلة طويلة) ، وتدفقات تحتاج إلى معمارات قابل للتحويل (مقيّدة من الناحية الهندسة المعمارية).

**2. Explicit density, approximate.**مقيد$\log p(x)$من أسفل (ELBO) وتحسين الحدود. تستخدم VAEs (Kingma 2013) مرموزة-مقررة مع خلفية متغيرة. تدرب نماذج التفريق (DDPM ، Ho 2020) على مفسر يفضل بشكل ضمني ELBO الموزن. التفريق هو العمود الفقري المهيمن الصورة والفيديو وال3D في عام 2026.

**3. Implicit density.**تخطي الكثافة بالكامل ، تعلم المولد$G(z)$التي تنتج عينات و تمييز$D(x)$النظام النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي النمطي

**4. Score-based / continuous-time.**تعلم تدريج كثافة الحشيش$\nabla_x \log p(x)$(النتيجة) مباشرة. أظهرت سونغ و إرمون (2019) أن مطابقة النتيجة تعامل التوزيع إلى SDE. تطابق التدفق (ليبمان 2023) هو الدرجة الساخنة 2024-2026: التدريب الخالي من المحاكاة ، المسارات المستقيمة ، 4-10 مرات أسرع من DDPM. الاستقرار التوزيع 3 ، التدفق ، الصوت 2 جميع استخدام تطابق التدفق.

**5. Token-based autoregressive over discrete codes.**قم بتضغط البيانات عالية التميز باستخدام VQ-VAE أو الكميات المتبقية إلى تسلسل قصير من الرموز المتفصلة ، ثم استخدم محول لنموذج تسلسل الرموز. Parti ، MuseNet ، AudioLM ، VALL-E ، Tokenizer الصغرى سورا تستخدم كل هذا. هذا هو علبة 1 بالإضافة إلى Tokenizer تعلم.

## قصة قصيرة

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

## التجريب الخمسة

عندما تنخفض ورقة النموذج الجيني الجديد، اجيب على هذه الأسئلة الخمسة قبل قراءة قسم الطرق.

1. **What is being modeled?**البيكسلات، الاختفاءات، القطع التقطيعية، غوسيانات ثلاثية الأبعاد، الشبكات، أشكال الموجات؟
2. **Is the density explicit or implicit?**هل يكتبون$\log p(x)$- ماذا ؟
3. **Sampling: one-shot or iterative?**تعني التكرار استنتاج أبطأ، وعادة ما تعني إطلاق واحد عداوة أو نزيف.
4. **Conditioning: unconditional, class, text, image, pose?**هذا يحدد الخسارة والهيكل الرفاهية.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**كل منهما لديه أساليب الفشل المعروفة (انظر الدروس 14).

ستجيب على هذه الخمسة في كل درس في هذه المرحلة، في النهاية ستكون ردود فعل.

```figure
autoencoder-bottleneck
```

## بناءها

رمز هذا الدروس هو تصور خفيف الوزن: تكييف خليط 1D من غوسيان من عينات باستخدام ثلاثة نهج لعبة (كثافة النواة، نظام التاريخ المتنقل، واكثر من نموذج "GAN-ish" مولد) حتى تتمكن من رؤية الفرق بين الكثافة الصريحة مقابل الضمنية على مشكلة يمكنك طباعة على شاشة واحدة.

أركض`code/main.py`.إنه يستخرج 2000 عينة من خليط غوسيان مزدوج، ثم يطبع:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

لاحظ: السؤال الأول والثاني يجعلك تسأل "ما هي احتمالية هذه النقطة؟" والثالث لا يمكن. هذا هو التمييز * صريح ضد ضمني* الذي سيكون مهما لكل درس مستقبلي.

## استخدمها

أي عائلة، لأي مهمة، في عام 2026؟

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

## أرسله

إبقوا`outputs/skill-model-chooser.md`. . .

تتطلب المهارة وصف المهمة والمخرجات: (1) العائلة التي تستخدمها، (2) قائمة مرتبة من ثلاثة خيارات مفتوحة وثلاثة مضيفة، (3) وضع الفشل المحتمل الذي يجب عليك الانتباه إليه، و (4) ميزانية الحساب / الوقت.

## التمارين

1. **Easy.**لكل من هذه المنتجات الخمسة، حدد العائلة والعمود الفقري: صورة ChatGPT، Midjourney v7، Sora، Runway Gen-3, ElevenLabs. يجب أن تكون الأدلة من تقارير تقنية عامة.
2. **Medium.**الصحيفة التي ستقرأها غداً تدعي أن العينات أسرع 100 مرة من التوزيع. اكتب ثلاثة أسئلة للتحقق من ما إذا كان التسرع ينجو من التكييف والارتفاع في القرار.
3. **Hard.**خذ مجال واحد يهمك (مثل بنية البروتين، CAD، الجزيئات، المسارات) ، وأجيب على التجريب الخمسة للنموذج SOTA الحالي في هذا المجال وخطط ما الذي يمكن أن يغيره نموذج أفضل.

## الشروط الرئيسية

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

## ملاحظة الإنتاج: خمسة عائلات، خمسة أشكال استنتاج

كل عائلة تخطيط إلى منحنى تكلفة مختلفة من خادم الاستنتاج. إدباطات الإنتاج-الإنتاج الإستنتاج إستنتاج LLM كإعداد مقدم + فك؛ نفس التفكيك ينطبق هنا:

- **Autoregressive (bucket 1 and 5).**يهيمن التشخيص التسلسل على التخفيف؛ KV-Cache، الإعداد المستمر، والتشخيص المضاربي جميعها تنطبق مباشرة.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**لا توجد رمزية في معنى ماجستير في التدريب`num_steps × step_cost`، و `step_cost`هو محول أو شبكة U-مضي قدما في قرار متخفي كامل. أزرار الإنتاج هي عدد الخطوات (DDIM / DPM-Solver / نزيف) ، حجم اللحوم ، والدقة (bf16 / fp8 / int4).
- **GAN (bucket 3).**واحد إلى الأمام، لا جدول، لا تخزين KV، TTFT ≈ تأخير كامل، هذا هو السبب في StyleGAN لا يزال يفوز على النطاق الضيق UX.

عندما ترى "سرعة أكثر من انتشار" في ملخص ورقية، ترجمها إلى "خطوات أقل × تكلفة نفس الخطوة" أو "خطوات نفسها × تكلفة خطوة أرخص". كل شيء آخر هو التسويق.

## المزيد من القراءة

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661)ورقة GAN
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) ورقة VAE
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)ورقة DDPM
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) التوزيع كـ SDE
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) الورق المتطابق
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) انتشار ثابت 3.
