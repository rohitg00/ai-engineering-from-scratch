# التكرير الذاتي والانتقاد: تحسين الناتج المتكرر

> يستخدم Self-Refine (Madaan et al., 2023) LLM واحد في ثلاثة أدوار  توليد، التعليق، وتحسين  في حلقة. متوسط المكاسب: +20 مطلقًا على 7 مهام. CRITIC (Gou et al., 2023) يُقسِّم خطوة التعليق عن طريق توجيه التحقق من خلال أدوات خارجية. في عام 2026 يتم إرسال هذا النمط في كل إطار ك"مُقيِّم-تحسين" (Anthropic) أو حلقة حفر (OpenAI Agents SDK).

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 03 (Reflexion)
**Time:** ~60 minutes

## أهداف التعلم

- تحسين الذات الدولة ثلاث طلبات (إنتاج، ردود الفعل، تحسين) وتوضيح لماذا التاريخ مهمة للحصول على تحسين.
- شرح البصيرة الحرجة لـ CRITIC: لا يمكن الاعتماد على الـ LLM في التحقق الذاتي دون تأسيس خارجي.
- تنفيذ حلقة stdlib Self-Refine مع التاريخ ومؤكد خارجي اختياري.
- خريط هذا النمط إلى سير عمل "مقيّم-تحسين" Anthropic ومدفوعات الإنتاج OpenAI Agents SDK.

## المشكلة

وكيل ينتج إجابة صحيحة تقريباً. ربما خط من الرمز لديه خطأ في النصوص. ربما ملخص طويل جداً. ربما تخسر خطة حالة حافة. ما تريد هو: أن يقوم وكيل النقد من إصداره الخاص، ثم يصلحه.

يظهر Self-Refine أن هذا يعمل مع نموذج واحد ، لا بيانات تدريب ، لا RL. ولكن هناك خدعة: LLM سيئة في التحقق الذاتي على الحقائق الصعبة. يطلق CRITIC على الإصلاح  طريق الخطوة التحقق من خلال أدوات خارجية (البحث ، مترجم الرمز ، آلة الحاسبة ، رئيسي الاختبار).

معا هذه الأوراقتان تحدد افتراض 2026 للتحسين المتكرر: توليد، التحقق (في الخارج عندما يكون ذلك ممكنا) ، وتحسين، وتوقف عند مرور المحقق.

## المفهوم

### التكرير الذاتي (Madaan et al., NeurIPS 2023)

ماجستير في العلوم، ثلاثة أدوار:

```
generate(task)            -> output_0
feedback(task, output_0)  -> critique_0
refine(task, output_0, critique_0, history) -> output_1
feedback(task, output_1)  -> critique_1
refine(task, output_1, critique_1, history) -> output_2
...
stop when feedback says "no issues" or budget exhausted.
```

التفاصيل الرئيسية:`refine`يرى التاريخ الكامل  جميع النتائج والانتقادات السابقة  حتى لا تكرر الأخطاء.

عنوان: +20 تحسن مطلقا في المتوسط في 7 مهام (الرياضيات، الرمز، الإختصار، الحوار) بما في ذلك GPT-4. لا تدريب، لا أدوات خارجية، نموذج واحد.

### المراجعة (Gou et al., arXiv:2305.11738, v4 فبراير 2024)

ضعف Self-Refine: خطوة التعليق هي درجة LLM نفسها. بالنسبة للمزاعم الفعلية هذا غير موثوق (غالبا ما تبدو الهلوسة مقنعة للنموذج الذي أنتجه) CRITIC يستبدل `feedback(task, output)`مع`verify(task, output, tools)`أين`tools`يتضمن:

- محرك بحث عن ادعاءات حقيقية
- مترجم رمز لصحّة الشفرة
- آلة حسابية للعدل
- المحققون المحددين للمجال (اختبارات الوحدة، والمتحققون من النوع، والطوابع).

يقوم المحقق بتقديم انتقاد مهيكلي على أساس نتائج الأدوات. ثم يقوم المصفّح بتشريع هذا النقد.

عنوان: CRITIC يفوق Self-Refine في المهام الفعلية لأن النقد مؤسس. في المهام دون مؤكدين خارجيين (الكتابة الإبداعية ، التنسيق) ، تقلل CRITIC إلى Self-Refine.

### حالة التوقف

شكلين شائعين:

1. **Verifier passes.**الاختبار الخارجي يعود نجاحاً. يفضل عند الوصول (اختبارات الوحدة، فحص النوع، تأكيد الحائط).
2. **No feedback issued.**النموذج يقول "المخرج جيد" أرخص ولكن غير موثوق؛ إضاف مع أقصى حد من التكرار.

2026 افتراضي: مزجها. "وقف إذا مر التحقق من OR النموذج يقول جيد وإعادة التكرار >= 2 أو تكرار >= max_iterations".

### المقيّم-منحرف (أنثروپي، 2024)

تحديدات Anthropic في ديسمبر 2024 تعتبر هذه واحدة من أنماط سير العمل الخمسة.

- المقيّم: يُسجل النتائج ويُنتج انتقادًا.
- تحسين: يعيد النظر في الناتج بالنظر إلى النقد.

حلقة حتى يمر المقيّم. هذا هو التكرير الذاتي/المتحرج في إطار Anthropic. يضيف التفاصيل الهندسية الحرجة Anthropic: يجب أن تكون طلبات المقيّم والمحسن مختلفة بشكل كبير حتى لا يتمكن النموذج من مجرد طعم.

### أجهزة حماية إصدار OpenAI Agents SDK

يرسل OpenAI Agents SDK هذا النمط كـ "حواجز خروج". الحواجز هي مؤكدة تعمل على الخروج النهائي للوكيل. إذا كانت الحواجز تتحرك (ترفع `OutputGuardrailTripwireTriggered`يمكن أن تكون أدوات الحراسة (على النحو CRITIC) أو وظائف نقية (على النحو Self-Refine).

### 2026 مصدر

- **Rubber-stamp loops.**نفس النموذج الذي يقوم بالإنتاج والانتقاد بنفس أسلوب الإستعراض يتقارب مع "يبدو لي جيداً". استخدم إستعراضات مختلفة من الناحية الهيكلية، أو نموذج أرخص أصغر للإنتقاد.
- **Over-refinement.**كل مرسلة تصفيف تضيف التأخير والرموز. الميزانية 1-3 مرسلات؛ بعد ذلك، تصاعد إلى مراجعة البشر.
- **CRITIC on trivial tasks.**إذا لم يكن هناك مؤكد خارجي، CRITIC تتدهور إلى Self-Refine؛ لا تدفع التأخير مقابل مؤكد البنود.

```figure
self-refine
```

## بناءها

`code/main.py`يطبق Self-Refine و CRITIC على مهمة لعبة: إنتاج قائمة قصيرة من الرصاصات مع إعطاء موضوع. يختبر المؤكد تنسيق (3 رصاصات، كل منها تحت 60 طومار). يضيف CRITIC "مؤكد حقيقة" خارجي يعاقب الهلوسات المعروفة.

المكونات:

- `generate`المنتج المسرحي
- `feedback` النقد الذاتي على النمط LLM.
- `verify_external`التحقق القائم على الأرض على الطراز النقدي.
- `refine` إعادة كتابة الناتج مع تاريخ.
- حالة توقف  تمرير المؤكد أو ماكسب 4 تكرارات.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

مقارنة التطهير الذاتي مقابل التطهير النقدي. التطهير الذاتي يلتقط خطأ حقيقي التطهير الذاتي يفتقد لأنه التحقق الخارجي لديه أرضية النقد الذاتي لا.

## استخدمها

إن محفز التقييم من Anthropic هو هذا النمط في اللغة الصديقة لـ Claude. إن أجهزة حماية الإنتاج في OpenAI Agents SDK تشكل CRITIC (يمكن أن تدعو الأدوات إلى الأجهزة). يرسل LangGraph عقدة تعكس تقرأ مثل Self-Refine. يضيف Gemini 2.5 Computer Use من Google تقييم سلامة لكل خطوة وهو تغير CRITIC: يتم التحقق من كل عمل قبل الالتزام.

## أرسله

`outputs/skill-refine-loop.md`يضيف حلقة التقييم-التحسين مع شكل المهمة، وتوافر المؤكد، وميزانية التكرار. ينشر طلبات لمولد، المؤكد/المؤكد، وتحسين، بالإضافة إلى سياسة وقف.

## التمارين

1. أستخدم اللعبة مع أقصى عدد من الإطارات = 1 هل ما زال CRITIC يساعدك؟
2. استبدل المحقق الخارجي بمثابة ضجيج (% 30 من الإيجابيات الخاطئة عشوائية). ماذا تفعل الحلقة؟ هذا هو الواقع 2026 من معظم كومات الحراسة.
3. تنفيذ "تقدير المولد على نماذج مختلفة" فاريان: نموذج كبير يولد، نموذج صغير انتقادات. هل يتغلب على نفس النموذج؟
4. اقرأ القسم 3 من القسم المفتاح (arXiv:2305.11738 v4). أسمائ فئات أدوات التحقق الثلاثة وأعط مثال لكل منها.
5. خريطة OpenAI وكلاء SDK `output_guardrails`ما الذي يخطئ في SDK، وما الذي يصلح؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Self-Refine | "LLM that fixes itself" | Generate -> feedback -> refine loop in one model, with history |
| CRITIC | "Tool-grounded verification" | Replace feedback with an external verifier (search, code, calc, tests) |
| Evaluator-Optimizer | "Anthropic workflow pattern" | Two roles — evaluator scores, optimizer revises — looped to convergence |
| Output guardrail | "Post-hoc check" | OpenAI Agents SDK validator that runs after an agent produces output |
| Verify step | "Critique phase" | The load-bearing decision: grounded or self-rated |
| Refine history | "What the model already tried" | Prior outputs + critiques prepended to refine prompt; drop and quality collapses |
| Rubber-stamp loop | "Self-agreement failure" | Same-prompt critique returns "looks good"; fix with structurally different prompts |
| Stop condition | "Convergence test" | Verifier passes OR no feedback AND iteration cap; never single-condition |

## المزيد من القراءة

- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) الورق القديس
- [Gou et al., CRITIC (arXiv:2305.11738)](https://arxiv.org/abs/2305.11738)التحقق القائم على الأدوات
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) نمط سير العمل من المقيّم-المُحسن
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) حواجز الخروج كمتحققين على شكل CRITIC
