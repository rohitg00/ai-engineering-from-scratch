# الفن و الفوركس

> جيانغ، شيو، نيو، شيانغ، راماسوبرامانيان، لي، بوفندران، "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753). غطاء الرموز ذات الصلة بالسلامة في طلب ضار، واستبدالها بتسجيلات ASCII الفنية من نفس الحروف، وإرسال الطلب المغطوس. GPT-3.5، GPT-4, جيميني، كلود، لاما-2 فشل جميعًا في التعرف على رموز أسكي الفن بشكل قوي. الهجوم يُغيب عن PPL (مصفحات الارتباك) ، دفاعات الفقرات، و Retokenization. ذات الصلة: قياسات مقياس ViTC الاعتراف بالطلبات البصرية غير المفصلة؛ StructuralSleight يجميع إلى الهياكل غير المشتركة المترجمة بالنص (الشجرة والرسوم البيانية وال JSON المتعظمة) كعائلة من هجمات التشفير.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## أهداف التعلم

- وصف هجوم ArtPrompt: خطوة تحديد الكلمة، استبدال ASCII-art، استغلال مخفي النهائي.
- شرح لماذا تفشل الدفاعات القياسية (PPL، Paraphrase، Retokenization) على ArtPrompt.
- تعريف ViTC ووصف ما يقيسه.
- وصف StructuralSleight كعملية لتجميع الهياكل غير المشتركة المرموزة بالنص التعسفي.

## المشكلة

الهجمات عبر المقاطع واللعب الدوري (الدرس 12) و عبر السياق الطويل (الدرس 13) تعمل على نمط مستوى النص. تعمل ArtPrompt على مستوى التعرف: لا يقوم النموذج بتحليل الرمز المحظور. يقوم بتحليل صورة تم عرضها في الأحرف. يرى فلتر الأمان علامات التقاط غير ضارة. يرى النموذج كلمة.

## المفهوم

### (آرت برومب) ، خطوتين

الخطوة الأولى: تحديد الكلمات. في حالة طلب ضار، يستخدم المهاجم LLM لتحديد الكلمات ذات الصلة بالسلامة (على سبيل المثال، "قنبلة" في "كيفية صنع قنبلة"). 

الخطوة 2. إنتاج اللحظة المغطاة. استبدل كل كلمة مع تقديمها الفني ASCII (بلوك من الأحرف 7x5 أو 7x7 يشكل شكل الحرف). يتلقى النموذج شبكة من النقاط والمساحات التي يمكن أن يتعرف عليها نموذج قادر بما فيه الكفاية ككلمة. تصفية السلامة ترى الشبكة فقط.

النتيجة: GPT-4، Gemini، Claude، Llama-2، GPT-3.5 فشل جميعها. معدل نجاح الهجوم فوق 75% على مجموعة فرعية مقارنة.

### لماذا تفشل الدفاعات القياسية

- **PPL (perplexity filter).**فن ASCII لديه تعقيد عالية  ولكن كذلك كل إدخال جديد. اختيارات العدالة التي تحجب ArtPrompt تحجب أيضا إدخال منظم شرعي.
- **Paraphrase.**إعادة تشكيل الإشارة تدمير فن ASCII. في الممارسة العملية، غالبا ما تحافظ أو ترميم الفن.
- **Retokenization.**تقسيم الرموز بشكل مختلف لا يغير أن رؤية النموذج هي التعرف على أشكال الحروف.

المشكلة الأساسية هي أن مرشحات السلامة هي على مستوى رمزية أو معنوية؛ تعمل ArtPrompt على مستوى التعرف البصري.

### مؤشر الموازنة في إيكس

التعرف على الإشارات البصرية غير الارضية. يقيّد قدرة النموذج على قراءة ASCII-art، wingdings، وغيرها من المحتوى البصري غير النصي-الارضية. تنسجم فعالية ArtPrompt مع دقة ViTC: كلما كان النموذج أفضل قراءة النص البصري، كلما كان ArtPrompt أفضل العمل عليه. هذا هو تنازل القدرة على السلامة.

### الهيكل

تعامل ArtPrompt: هيكلات متنية غير شائعة (UTES). الأشجار والرسومات وال JSON المضغوطة ، CSV-in-JSON ، كتلة رمز مختلفة. إذا كانت الهيكل نادرة في تدريب بيانات السلامة ولكن يمكن تحليلها من قبل النموذج ، فيمكن أن يخفي محتوى ضار.

ويعني ذلك أنّه يجب أن يكون هناك أساس عام في الأشكال المُهيّدة التي يمكن أن يُحللها النموذج، ويتمّ تطوير مجموعة كبيرة.

### التناظر بين الصورة والتنقل

يوسع LLM البصرية (GPT-5.2 ، Gemini 3 Pro ، Claude Opus 4.5 ، Grok 4.1) سطح الهجوم. الهجمات على شكل ArtPrompt مع الصور الفعلية أقوى من مقارنات ASCII-art لأن مرموز الصور ينتج إشارة أكثر غنى.

### حيث يتناسب هذا مع المرحلة 18

تصف الدروس 12-14 ثلاثة متجهات هجوم ثابتة: التكرير المتكرر (PAIR) وطول السياق (MSJ) ، والترميز (ArtPrompt / StructuralSleight). يتحول الدروس 15 من الهجمات المركزة على النموذج إلى الهجمات الحدودية للنظام (الحقن السريع غير المباشر). يصف الدروس 16 استجابة الأدوات الدفاعية.

```figure
al-ascii-cloak
```

## استخدمها

`code/main.py`يمكنك تغطية كلمات محددة في استفسار ضار مع أسسي الفن glyphs، التحقق من السلسلة الغطية يمر المرشح كلمة رئيسية، و (اختياري) فك رمز السلسلة الغطية مرة أخرى باستخدام معترف بسيط.

## أرسله

هذا الدرس يُنتج`outputs/skill-encoding-audit.md`. في إطار تقرير دفاع عن الهجمات، يُدرج هذا التقرير أسماء الهجمات المشمولة (فنون ASCII، قاعدة 64، كلمة الرابط، UTF-8 homoglyph، UTES) وطبقة الدفاع التي تمسك بكل منها.

## التمارين

1. أركض`code/main.py`التحقق من أن السلسلة المغطاة تمر مرشحًا بسيطًا للكلمات الرئيسية. أبلغ عن التغيير المطلوب في مستوى الأحرف.

2. تنفيذ تشفير ثان: base64 لنفس الكلمة المستهدفة. مقارنة معدل تجاهل المرشح مع ArtPrompt وصعوبة الاسترداد.

3. اقرأ جيانغ وزملاءه في القسم 4.3 من 2024 (نتائج النموذج الخمسة). اقترح سببًا لكون مقاومة كلود ArtPrompt أعلى من مقاومة جيميني في نفس المعيار.

4. تصميم دفاع ما قبل الجيل الذي يكتشف مناطق تشكل فن ASCII في المفاجأة. قياس معدل الإيجابية الخاطئة على الرمز الشرعي، الجداول، واللخصة الرياضية.

5. StructuralSleight يدرج 10 هيكلات تشفير. رسم دفاع عام يدير كل 10 وتقدير تكلفة الحساب لكل طلب دفاع.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## المزيد من القراءة

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753)ورقة الفن ASCII jailbreak
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) عامة UTES
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) هجوم متكرر مكمل
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) هجوم طول مكمل
