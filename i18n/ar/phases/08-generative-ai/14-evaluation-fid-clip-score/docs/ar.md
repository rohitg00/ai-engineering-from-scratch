# التقييم  FID، درجة CLIP، تفضيل البشر

> كل جدول قياسي للنموذج التوليد يذكر FID ، درجة CLIP ، ومعدل الفوز من ساحة تفضيل البشر. لكل رقم وضع فشل يمكن للباحثين المحددين اللعب. إذا لم تعرف أطر الفشل ، لا يمكنك معرفة تحسن حقيقي من عملية اللعب.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## المشكلة

يتم تقييم النموذج التوليد على * جودة العينات * و * الالتزام بالشروط *. لا يوجد في كل منهما مقياس شكل مغلق. يجب أن يعطي نموذجك 10,000 صورة؛ يجب أن يعين شيء لهم أرقام؛ يجب أن تثق بالأرقام عبر عائلات النموذج، عبر القرارات، عبر الهندسة المعمارية. نجت ثلاث قياسات من القمص 2014-2026:

- **FID (Fréchet Inception Distance).**المسافة بين توزيعين  حقيقيين ومتولدين  في مساحة ميزات شبكة Inception. أقل أفضل.
- **CLIP score.**تشابه كوزين بين إدراج صورة CLIP من الصورة المولدة وإدراج نص CLIP من عرض. أعلى هو أفضل. القياسات تطلب الالتزام.
- **Human preference.**وضع نموذجين رأسًا على رأس على نفس الطلب، دع البشر (أو نموذج من فئة GPT-4) يختارون أفضل واحد، ويتجمعون إلى درجة Elo.

سترى أيضا: IS (درجة البدء، متقاعد إلى حد كبير) ، KID، CMMD، ImageReward، PickScore، HPSv2، MJHQ-30k. كل تصحيح لفشل واحد من السابق.

## المفهوم

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### جودة العينة

(هيوزل وآخرون) (2017)

1. استخراج ميزات Inception-v3 (2048-D) ل N صور حقيقية و N التي تم إنشاؤها.
2. أضع غوسيان لكل بركة: متوسط الحساب$\mu_r, \mu_g$و التغيرات$\Sigma_r, \Sigma_g$. . .
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$. . .

تفسير: مسافة فريشيت بين غوسيانين متعددين المتغيرات في مساحة الميزات. أسفل = توزيعات أكثر شبيهة.

أساليب الفشل:
- **Biased on small N.**FID هو متوسط مربع على التوزيع الميزة  N صغيرة يقلل من التباين، يعطي FID منخفضة كاذبة. استخدم دائما $N \ge 10{,}000$. . .
- **Inception-dependent.**تم تدريب Inception-v3 على ImageNet. تنتج المجالات البعيدة عن ImageNet (الوجوه والفن والصور النصية) FID غير ذات معنى. استخدم مستخرج ميزات محددة للمجال.
- **Gaming.**إضافة المكاسب إلى ما قبل البدء يمنح منخفضة FID دون تحسين نوعية البصر.

### درجة CLIP  التزام سريع

رادفورد وغيرهم (2021). لصور تم إنشاؤها + عرض:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

متوسط على مدار 30k صور تم إنشاؤها → مقياس مقارنة بين النماذج.

أساليب الفشل:
- **CLIP's own blind spots.**يحتوي CLIP على منطق تركيب ضعيف ("كوب أحمر على كرة زرقاء" غالبا ما يفشل). يمكن أن تصنف النماذج بشكل جيد على درجة CLIP دون اتباع إشارات معقدة حقا.
- **Short prompt bias.**الإشارات القصيرة لديها المزيد من مطابقات الصورة CLIP في البرية. الإشارات الطويلة لديها درجات CLIP أقل ميكانيكا.
- **Prompt gaming.**إضافة "جودة عالية، 4K، تحفة" في المشاركة المطلوبة تضخم درجة CLIP دون تحسين ربط الصورة والنص.

يصلح CMMD (Jayasumana et al., 2024) بعض هذه المواضيع: يستخدم ميزات CLIP بدلاً من Inception، والانفصال القصوى المتوسط بدلاً من Fréchet. أفضل في الكشف عن اختلافات الجودة الخفيفة.

### تفضيل البشر الحقيقة الأرضية

اختر مجموعة من الإشارات. تولد مع النموذج A و النموذج B. أظهر أزواج للبشر (أو قاضي LLM قوي). جمع الفوز إلى نتيجة Elo أو Bradley-Terry. النماذج:

- **PartiPrompts (Google)**: 1600 طلب مختلف، 12 فئة.
- **HPSv2**: 107 ألف ملاحظة بشرية، تستخدم على نطاق واسع كوكب آلي.
- **ImageReward**: 137k أزواج تفضيل الصورة السريعة، مرخصة من MIT.
- **PickScore**: تدرب على تفضيلات الاختيار
- **Chatbot-Arena-style image arenas**: https://imagearena.ai/وآخرين

أساليب الفشل:
- **Judge variance.**غير الخبراء لديهم تفضيلات مختلفة عن الخبراء. استخدم كليهما.
- **Prompt distribution.**الإشارات المختارة من الكرز تفضيّل لعائلة واحدة، دائماً ما تكون وثيقة
- **LLM-judge reward hacking.**قاضي "جبت-4" يخدع من خلال نتائج جميلة لكن خاطئة

## استخدم معًا

يجب أن يتضمن تقرير تقييم الإنتاج:

1. التقييم المعدني على 10-30 ألف عينة مقابل توزيع حقيقي (جودة العينات).
2. درجة CLIP / CMMD على نفس العينات مقابل طلباتها (التزام).
3. معدل الفوز في ساحة معلقة مقابل النموذج السابق (الفضيلة العامة).
4. تحليل وضع الفشل: 50 خروجاً تم اختبارها عشوائياً، تم وضع علامات على المشاكل المعروفة (شكل اليد، إظهار النص، عدد الأشياء المتسقة).

أي مقياس واحد هو كذبة ثلاثة مقياسات مؤكدة + مراجعة نوعية هي ادعاء.

```figure
gx-fid-distributions
```

## بناءها

`code/main.py`يطبق FID، CLIP-نقطة مثل، و Elo تجميع على "ملامح الميزات" الاصطناعية (نحن نستخدم متجهات 4D كمركزين لميزات البداية). ترى:

- حساب FID على N صغير وعلى N  التحيز الكبير.
- "معدل CLIP" كشبهة كوسين بين مجموعات الميزات.
- قاعدة تحديث Elo من تيار تفضيل اصطناعي.

### الخطوة الأولى: التسجيل في أربعة خطوط

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### الخطوة الثانية: تشابه كوسين على النمط CLIP

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### الخطوة الثالثة: جمع اليلو

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## الفخاخ

- **FID at N=1000.**الهيورستيك غير موثوق بها تحت N=10k. الأوراق التي تُبلغ عن انخفاض N FID هي اللعب.
- **Comparing FID across resolutions.**تبدل حجم 299 × 299 في البداية توزيع الميزات. مقارنة عند القرار المماثل فقط.
- **Reporting one seed.**أطلقوا 3 بذور على الأقل
- **CLIP score inflation via negative prompts.**بعض الأنابيب تعزز CLIP عن طريق إعادة تثبيت الإشارة. تحقق من التشبية البصرية.
- **Elo bias from prompt overlap.**إذا رأت كلا النماذج عرضًا مقارنًا أثناء التدريب ، فإن Elo لا معنى لها. استخدم مجموعات عرض متأخرة.
- **Human eval paid-crowd skew.**الملاحظون المنتجين في MTurk يمتلكون شبابًا / صديقيًا للتكنولوجيا.

## استخدمها

بروتوكول تقييم الإنتاج في عام 2026:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

كل الرابع من الركائز في تقرير واحد = دعوى. أي واحد وحده = تسويق.

## أرسله

إنقاذ`outputs/skill-eval-report.md`. تتخذ Skill نقطة تفتيش نموذجية جديدة + خط أساسي وتخرج خطة تقييم كاملة: أحجام العينات، المقاييس، صواريخ وضع الفشل، معايير الإشارة.

## التمارين

1. **Easy.**أركض`code/main.py`. مقارنة FID عند N=100 مقابل N=1000 على نفس التوزيعات الاصطناعية.
2. **Medium.**تنفيذ CMMD من ميزات CLIP الاصطناعية (انظر Jayasumana et al., 2024 للصيغة). مقارنة الحساسية للفروق في الجودة مقابل FID.
3. **Hard.**قم بتكرار إعداد HPSv2: خذ 1000 زوج من صور الفوركس من مجموعة فرعية من Pick-a-Pic ، وتحسين مستحق الرقم القليل القائم على CLIP على التفضيلات ، وقاس توافقه مع مجموعة متبقية.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | Fréchet distance of Gaussian fits to real vs gen Inception features. |
| CLIP score | "Text-image similarity" | Cosine similarity between CLIP image and text embeddings. |
| CMMD | "FID's replacement" | CLIP-feature MMD; less biased, no Gaussian assumption. |
| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlates poorly on modern models, retired. |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Small models trained on human preferences; used as automatic judges. |
| Elo | "Chess rating" | Bradley-Terry aggregation of pairwise wins. |
| PartiPrompts | "The benchmark prompt set" | 1,600 Google-curated prompts across 12 categories. |
| FD-DINO | "Self-sup replacement" | FD using DINOv2 features; better for out-of-ImageNet domains. |

## ملاحظة الإنتاج: التقييم هو عبء عمل استنتاج أيضا

تشغيل FID على عينات 10k يعني إنتاج صور 10k. بالنسبة لقاعدة SDXL 50 خطوة عند 10242 على L4 واحد ، وهذا يعني ~ 11 ساعة من استنتاج الطلب الواحد. ميزانيات التقييم حقيقية ، والإطار هو بالضبط سيناريو الإستنتاج غير متصل (تحقيق أقصى قدر من التوصيل ، تجاهل TTFT):

- **Batch hard, forget latency.**تقييم غير متصل = التجمع الدوري في أكبر حجم يناسب الذاكرة. `pipe(...).images`مع`num_images_per_prompt=8`على 80 جيجابايت H100 يعمل 4-6x أسرع ساعة الحائط من طلب واحد.
- **Cache the real features.**يتم تشغيل إستخراج ميزة Inception (FID) أو CLIP (CLIP-score، CMMD) على مجموعة المرجعية الحقيقية *once*، وتخزينها كـ `.npz`لا تعيد الحسابات حسب التقييم

لـ CI / بوابات التراجعة: تشغيل FID + CLIP درجة على مجموعة فرعية من 500 عينة لكل PR (~ 30 دقيقة) ؛ تشغيل كامل 10k FID + HPSv2 + Elo كل ليلة.

## المزيد من القراءة

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500)ورقة FID
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) CMMD
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020)-تقطّع
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) HPSv2
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ImageReward
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) إشارات
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) مسح وضع الفشل
