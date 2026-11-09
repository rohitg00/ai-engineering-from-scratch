# إنتاج الفيديو

> الصورة هي مؤشر ثنائي الأبعاد. الفيديو هو مؤشر ثنائي الأبعاد. النظرية هي نفسها؛ الحساب هو 10-100 مرة أصعب. أثبت سورا OpenAI (فبراير 2024) أنه من الممكن. بحلول عام 2026 فيو 2 ، كلينغ 1.5 ، رينواي جين 3 ، بيكا 2.0 ، و WAN 2.2 فيديو إنتاج السفينة من النص عند 1080p  والحجم المفتوح (CogVideoX ، HunyuanVideo ، Mochi-1 ، WAN 2.2) يتخلف 12 شهرا.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## المشكلة

فيديو 1080p 10 ثانية في 24fps هو 240 إطار من 1920 × 1080 × 3 بيكسل. وهذا هو حوالي 1.5 جيجا غايب من البيانات الخام لكل شريط. انتشار الفضاء بيكسل غير ممكن. تحتاج:

1. **Spatiotemporal compression.**جهاز VAE الذي يرمز الفيديوهات، وليس الإطارات، إلى تسلسل من المزقات الفضائية-الوقتية.
2. **Temporal coherence.**يجب على الإطارات أن تشارك المحتوى والإضاءة و هوية الكائنات على مدى ثوانٍ.
3. **Compute budget.**تدريب الفيديو أكثر تكلفة 10-100 مرة من الصورة لنفس حجم النموذج.
4. **Conditioning.**النص، الصورة (الصور الأولى) ، الصوت، أو فيديو آخر. معظم نماذج الإنتاج تقبل كل أربعة.

الهندسة المعمارية التي حلّت هذا هو**Diffusion Transformer (DiT)**تطبق على المزقات الفضائية-زمانية، تدرب على مجموعات بيانات ضخمة (السرعة، الأسطح، الفيديو). نفس فقدان التوزيع مثل الدروس 06.

## المفهوم

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### إصلاح

تشفير الفيديو مع VAE 3D (التضغط الفضائي-الزمني المتعلم).`[T_latent, H_latent, W_latent, C_latent]`. تم تقسيمها إلى بقايا كبيرة`[t_p, h_p, w_p]`.للموديلات في نمط (سورا)`t_p = 1`(مصطلحات لكل إطار) أو `t_p = 2`(كل إطارين) فيديو 1080p 10 ثانية يضغط إلى حوالي 20,000-100,000 مساحة.

### التغيرات الفضائية-الزمنية

يقوم المحول بمعالجة تسلسل مسطح للمصطلحات. لكل مصطلح تضم ثلاثية أبعاد وضعية (الوقت + y + x). عادة ما يتم تقسيم الاهتمام:

- **Spatial attention**داخل كل إطار من الملامح.
- **Temporal attention**عبر الإطار في نفس الموقع الفضائي.
- **Full 3D attention**هو 16-100x أكثر تكلفة؛ تستخدم فقط في درجة الحل المنخفض أو في البحوث.

### تكييف النص

الاهتمام المتقاطع مع مرموز نص كبير (T5-XXL لـ Sora ، CogVideoX-5B يستخدم T5-XXL). مهمة الطلبات الطويلة  مجموعة تدريب سورا كانت لديها إعادة الترجمة الكثيفة التي تم إنشاؤها من GPT بمعدل 200 رمز لكل مقطع.

### التدريب

فقدان الانتشار القياسي (ε أو v التنبؤ) على الاختفاءات الفضائية-الزمنية. البيانات: فيديو الويب + ~ 100 مليون مقطع منتظمة + عناوين نصية اصطناعية. الحساب: 10,000 + ساعة GPU حتى في مجال بحث صغير.

## منظومة الإنتاج لعام 2026

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

الوزن المفتوح يغلق الفجوة أسرع من الفضاء الصوير: HunyuanVideo + WAN 2.2 LoRAs بالفعل تشغيل معظم عمليات العمل مفتوحة المصدر بحلول منتصف عام 2026.

```figure
video-diffusion-denoise
```

## بناءها

`code/main.py`يحاكي فكرة DiT الفضائية-الوقتية الأساسية: تصفيف فيديو اصطناعي صغير، وإضافة وضع لكل تصفيح، وتخفيض التسلسل بأكمله مع اهتمام على الطراز المحول على اللصيحات. لا نومبي؛ بيثون نقية. نظهر أن التماسك الزمني يظهر حتى في 1D عندما تشارك اللصيحات الإطار المجاورة مع معبر وموضع التشبيحات.

### الخطوة الأولى: إصلاح "فيديو" 1D الاصطناعي

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### الخطوة الثانية: وضع الإضافة لكل إطار

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### الخطوة الثالثة: يرى المُحدد التسلسل بأكمله

بدلاً من تغيير كل إطار بشكل مستقل، شبكتنا الصغيرة تضم جميع قيم الإطار + إدخالات الموقع وتتوقع الضجيج لجميع الإطار معاً.

### الخطوة الرابعة: اختبار التماسك الزمني

بعد التدريب، قم بعمل عينة فيديو. قم بقياس دلتا الإطار إلى الإطار. إذا تعلم النموذج بنية زمنية، فإن الدلتا تبقى أصغر من عينة كل إطار بشكل مستقل.

## الفخاخ

- **Independent per-frame sampling = flicker.**إذا قمت بتشغيل انتشار الصورة على كل إطار بشكل منفصل ، فإن الصور المصدرة تتبصر لأن ضجيج كل إطار مستقل. تصحيح انتشار الفيديو هذا عن طريق ربط الإطار من خلال الانتباه أو الضجيج المشترك.
- **Naive 3D attention = OOM.**الاهتمام الثلاثي الأبعاد الكامل على 1080p غامض لمدة 10 ثواني هو مئات المليارات من العمليات.
- **Data captioning matters more than size.**كان التحديث الرئيسي لـ Sora على العمل السابق هو التدريب على عناوين أكثر تفصيلاً بنحو 10 مرات (مقاطع GPT-4 التي تم إعادة تسميتها).
- **First-frame conditioning.**معظم نماذج الإنتاج تقبل أيضا صورة كإطار أول. هذا هو وضع "الصورة إلى الفيديو" ؛ يتضمن التدريب هذا التنوع.
- **Physics drift.**المقاطع الطويلة (> 10s) تتراكم مع عدم الاتساقات الخفيفة.

## استخدمها

| Use case | 2026 pick |
|----------|-----------|
| Highest-quality text-to-video, hosted | Veo 3 or Sora |
| Camera-controlled cinematic | Runway Gen-3 with motion brushes |
| Character consistency across clips | Pika 2.0 or Kling 2.1 |
| Open weights, fast fine-tune | WAN 2.2 + LoRA |
| Image-to-video | WAN 2.2-I2V, Kling 2.1 I2V, or Runway |
| Audio-to-video lip sync | Veo 3 (native audio) or a dedicated lip-sync model |
| Video editing | Runway Act-Two, Kling Motion Brush, Flux-Kontext (still-frame) |

انخفضت تكلفة الفيديو في الثانية عند المساواة الجودة 20 مرات بين عامي 2024 و2026.

## أرسله

إنقاذ`outputs/skill-video-brief.md`. تتخذ مهارة قصيرة الفيديو (مدة، نسبة الجانب، أسلوب، خطة الكاميرا، استنتاج الموضوع، الصوت) والخروج: النموذج + استضافة، الاستعداد السريع (لغة الكاميرا، وصف الموضوع، وصف الحركة) ، البذور + بروتوكول قابلية التكاثر، وقائمة تفتيش QA على مستوى الإطار.

## التمارين

1. **Easy.**في`code/main.py`، مقارنة الدلتا من الإطار إلى الإطار (أ) عن طريق أخذ العينات المستقلة لكل إطار، (ب) عن طريق أخذ العينات التسلسل المشترك.
2. **Medium.**إضافة شرط الإطار الأول: إطار اللوحة 0 إلى قيمة معينة ومعينة الباقي. قياس كيفية انتشار القيمة المثبتة.
3. **Hard.**استخدم مكشوفات HuggingFace لتشغيل CogVideoX-2B على جهاز GPU محلي. وقت 20 خطوات استنتاج عند 720p لقطة 6 ثواني. تحليل الاهتمام الفضائي-زماني لتحديد عنق الزجاجة.

## الشروط الرئيسية

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

## ملاحظة الإنتاج: تعرضات الفيديو لعرض النطاق النطاق للذاكرة

كليف 1080p 10 ثانية عند 24 صورة في الثانية هو 240 إطار × 1920 × 1080 × 3 ≈ 1.5 جيجا غيغابايت من البيكسلات الخام. بعد ضغط VAE الفيديو 4 × (`2 × spatial × 2 × temporal`) والمتخفي هو ~ 100 MB لكل طلب. قم بتشغيل هذا من خلال DiT الفضائي-زماني لمدة 30 خطوة في المجموعة 1 وأنت تحرك ~ 3 GB / خطوة من خلال HBM  عرض النطاق الذاكري، وليس FLOPs، هو عقدة الزجاجة.

ثلاثة أزرار إنتاج، كل ذلك مباشرة من إدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإدلاء الإ

- **TP across the DiT.**النماذج النصية إلى الفيديو هي بشكل روتيني ≥10B. TP = 4 عبر 4 H100s هو معيار؛ PP = 2 × TP = 2 بالنسبة للنماذج من فئة 405B. تنخفض التأخير لكل خطوة بشكل خطي تقريبًا مع TP حتى الجدار القليل.
- **Frame batching = continuous batching.**في وقت توليد الفيديو، هو مفهوما مجموعة من الإطارات المتصلة بالاهتمام.`t+1`بينما الإطار`t-1`يتم إعادة، إذا سمحت بنية النموذج بتوليد النافذة المنزلقة.
- **Clip-level prefill cache.**بالنسبة لصور إلى فيديو، فإن تكييف الإطار الأول يشبه إعداد المقبلات السريعة لدرجة الماجستير: حسابها مرة واحدة، وإعادة استخدامها عبر مرسلات المفكّر الزمني. هذا هو في الواقع كيف-كاش للفيديو.

## المزيد من القراءة

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/)تقرير فني سورا
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) CogVideoX
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) HunyuanVideo.
- [Genmo (2024). Mochi 1 preview model card](https://huggingface.co/genmo/mochi-1-preview)(موتشي-1)
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) فتح SOTA في منتصف عام 2025.
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458)ورقة التوزيع الفيديو
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) أسلاف انتشار الفيديو المستقر.
