# الاهتمام المختلف (V2)

> الاهتمام Softmax يفرز كمية صغيرة من الاحتمالات على كل رمز غير متطابق. أكثر من 100 ألف رمز يجمع الضجيج ويقوم بإغراق الإشارة تحدد محول التفاوت (Ye et al., ICLR 2025) ذلك عن طريق حساب الاهتمام على أنه اختلاف اثنين من المواد الغليظة، مما يقلل من الأرضية المشتركة للضوضاء. DIFF V2 (مايكروسوفت ، يناير 2026) هو إعادة كتابة كومة الإنتاج: مطابقة تأخر فك الرمز إلى محول خط الأساس ، لا نواة مخصصة ، متوافقة مع FlashAttention. هذه الدروس هي V1 إلى V2 من نهاية إلى نهاية، مع تنفيذ لعبة العمل من عملية الفرق يمكنك تشغيلها في stdlib Python.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## أهداف التعلم

- أوضح بالضبط لماذا يحتوي الاهتمام على قاع ضجيج ولماذا ينمو مع طول السياق.
- استنتاج صيغة الاهتمام المختلفة وشرح لماذا تخفض إلغاء مكون الضوضاء المشتركة مع الحفاظ على الإشارة.
- اتبع الفرق بين V1 و V2: ما أصبح أسرع، ما أصبح أسهل، ما أصبح أكثر استقرارا، ولماذا كان كل تغيير ضروريًا للتدريب المسبق للإنتاج.
- تنفيذ الاهتمام المختلف من الصفر في Python النقي والتحقق من التطورات التجريبية من خصائص إلغاء الضوضاء على استفسار إشارة صناعية زائد ضوضاء.

## المشكلة

الاهتمام القياسي لـ softmax لديه خصائص رياضية تتحول إلى صداع عملي على نطاق واسع.`q`، أوزان الاهتمام هي`softmax(qK^T / sqrt(d))`. لا يمكن لـ Softmax أبداً أن تنتج الصفرات الدقيقة: كل رمز غير متطابق يحصل على كتلة إيجابية. هذه الكتلة المتبقية هي الضوضاء ، وتتقييمها مع طول السياق. عند رموز 128k ، حتى لو حصل كل رمز غير متطابق على 0.0001% فقط من الاحتمال ، فإن 127,999 منهم مجتمعين يسهمون بنحو 13% من الإجمالي. يجب على النموذج تعلم توجيه حول قاع الضوضاء الذي ينمو مع السياق.

من الناحية التجريبية، تظهر هذه في صورة تدخل الرأس للاهتمام: المشاركات الهلوسة في RAG في السياق الطويل، فشل في الوسط في مهام استرداد 100k، وتدهور دقة دقيقة على مستوى الإبر في كومة الشوفان ما بعد 32k. قياس ورقة التحول المختلف (arXiv:2410.05258 ، ICLR 2025) الفجوة: أثر تحويلات DIFF على أقل تعقيد ، ودقة أكبر في السياق الطويل ، وأقل توهمًا من خطوط أساسية ذات الحجم نفسه.

كان لدى DIFF V1 ثلاثة مشاكل أبقيه خارج خطوط الأنابيب المسبقة للتدريب على الحدود. كان يجب تحميل ذاكرة التخزين القيمة مرتين لكل خطوة لتفكيك الرمز، وكان يتطلب أجزاء CUDA المخصصة التي كسر توافق FlashAttention، و RMSNorm لكل رأس منزعزعة التدريب الطويل الأجل في نطاق 70B- زائد. DIFF V2 (مدونة Microsoft unilm ، 20 يناير 2026) إصلاح كل ثلاثة. هذه الدروس تمشي على كلا النسخين، وبناء عامل الفرق، ومقارير إلغاء الضوضاء على استفسار لعبة.

## المفهوم

### أرضية الضوضاء من softmax

لأجل استفسار`q`و المفاتيح`K = [k_1, ..., k_N]`، ووزن الاهتمام هو:

```math
w_i = \frac{\exp(q \cdot k_i / \sqrt{d})}{\sum_j \exp(q \cdot k_j / \sqrt{d})}
```

لا , لا`w_i`هو صفر دائماً`k_i`لا علاقة لها تماماً`q`, النتيجة`q . k_i`ليس 0  يتذبذب حول الصفر مع التباين `||q||^2 / d`بعد تطبيع softmax، كل رمز غير مرتبط لا يزال يساهم `O(1/N)`إلى المبلغ الموزن . إجمالي مساهمة الرموز غير المتعلقة هي `O((N-1)/N) = O(1)` ليس كمية صغيرة

ما يريده النموذج هو شيء مثل القوة القوية: وزن كبير على الرموز المقابلة، وزنه تقريبا صفر في كل مكان آخر.

### فكرة التفريق

تقسيم كل رأس Q و K التنبؤات إلى اثنين: $Q = (Q_1, Q_2)$و$K = (K_1, K_2)$قم بحساب خريطتين للاهتمام

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d})
\end{aligned}
```

الناتج:

```math
\mathop{\mathrm{DiffAttn}} = (A_1 - \lambda \cdot A_2) V
```

يُلغي الخسارة أي توزيع ضجيج يشترك فيه الخرائطتان. إذا كانت كلتا الخرائط ذات وزن متساو على الرموز 127k غير المتعلقة (والتي سوف تقوم بها ، عند البدء عشوائيًا) ، فسيتم إلغاء تلك الرموز. الإشارة  الوزن القصوى على الرموز القليلة ذات الصلة بالفعل  فقط يتم إلغاءها إذا ظهرت في كلتا الخرائط بنفس الكبيرة ، والتي لن تفعل مرة واحدة عندما يتدرب النموذج.

`lambda`هو مقياس قابل للتعلم لكل شخص، معدل ك `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`يمكن أن يكون سلبي`lambda_init`الاختيارات الافتراضية إلى رقم إيجابي صغير مثل 0.8.

### لماذا هذا يطابق الرأس إلغاء الضوضاء

فكر في ميكروفونين ضوضاء تسجل نفس الصوت. كلا يلتقط المتحدث بالإضافة إلى ضجيج الخلفية المتصلة. قم بإسقاط واحد من الآخر والضجيج المشترك ينخفض. الصوت ينجو لأن الإشارات اثنين تختلف في المرحلة أو الضخامة بما يكفي لمنع إلغاء كامل.`lambda`يتعلم هذا التوازن بالضبط

### V1 مقابل V2: الاختلاف

حافظ V1 على عدد المعلمات مساوية لخط الأساسي محول. للحصول على استفسارات اثنتين لكل رأس قلل من بعد الرأس. وهذا يكلف الرأس التعبير و  أكثر ألمًا  نصف القيمة التخزينية لكل رأس. كان على التخزين تحميل القيمة التخزينية مرتين في كل خطوة (مرة واحدة لكل فرع softmax). النتيجة: التخزين أبطأ من الخط الأساسي على الرغم من مطابقة عدد المعلمات.

V2 تضاعف عدد رؤوس الاستفسار وتبقي رؤوس KV نفسها (استعارة المعلمات من التنبؤ الصعودي). يبقى بعدة الرأس نفس الخط الأساسي. بعد الحد من ذلك، يتم إعادة عرض الأبعاد الإضافية إلى أسفل لتتطابق خط الأساس من Transformer $O_W$ثلاثة أشياء تحدث في وقت واحد:

1. سرعة فك الرمز تتطابق مع خط الأساس (تحميل cache KV مرة واحدة).
2. FlashAttention تعمل دون تغيير (لا يوجد جوهر مخصص).
3. يزداد كثافة الحساب عند فك الرمز (مزيد من الحسابات لكل بايت يتم تحميلها من HBM).

كما يزيل V2 RMSNorm لكل رأس الذي استخدمه V1 لتحقيق استقرار الخفض. عند مقياسات ما قبل التدريب من فئة 70B ، أزعج RMSNorm التدريب المتأخر. يستبدله V2 بخطة البدء البسيطة التي تبقي التدريب مستقراً دون الوحدة الإضافية.

### متى يصل إليها

| Workload | Benefit |
|----------|---------|
| Long-context RAG (64k+) | Cleaner attention maps, fewer hallucinated citations |
| Needle-in-haystack benchmarks | Substantial accuracy lift past 32k |
| Multi-document QA | Less cross-document interference |
| Code completion at 8k | Marginal, not worth the architecture change |
| Short chat (< 4k) | Essentially indistinguishable from baseline |

يزداد القيمة مع طول السياق عند الرموز 4K فإن قاع الضوضاء صغير بما فيه الكفاية حتى يكون الاهتمام القياسي على ما يرام عند 128K فإنه يؤذيك

### كيف تتراكم مع 2026 عقدة أخرى

| Feature | Compatible with DIFF V2? |
|---------|------------------------|
| GQA | Yes (V2 increases Q heads, not KV heads) |
| MLA (DeepSeek) | Yes in principle, no published paper combining them |
| MoE | Yes (attention is independent of MLP block) |
| RoPE | Yes (unchanged) |
| YaRN / long-context scaling | Yes (exactly where DIFF helps most) |
| FlashAttention | Yes in V2 (was no in V1) |
| Speculative decoding | Yes (attention change is invisible to the spec-decode loop) |

```figure
differential-attention
```

## بناءها

`code/main.py`يطبق الاهتمام المختلف في Python النقي. استفسار لعبة مع هيكل معروف إشارة زائد ضجيج يسمح لك قياس نسبة إلغاء الضجيج مباشرة.

### الخطوة 1: الاهتمام القياسي لـ softmax

عمليات المصفوفة Stdlib: قوائم القوائم، المصفوفة اليدوية، softmax مع استقرار الرقمية منخفضة من أقصى.

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### الخطوة الثانية: تقسيم Q و K إلى نصفين

نمط V1: نصف بعد الرأس. نمط V2: حافظ على بعد الرأس وتضاعف عدد الرؤوس. تنفيذ اللعبة يستخدم V1 للوضوح التربوي  الرياضيات هي نفسها، إلا أن الحسابات تختلف.

### الخطوة الثالثة: فرعين منخفضة + خصم

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

ملاحظة: يمكن أن تكون أوزان الخروج سلبية. هذا جيد  لا يزال التخزين القيمة يتعامل مع المساهمات الموقعة. التنبؤ V التالي يستوعب العلامة.

### الخطوة الرابعة: قياس إلغاء الضوضاء

بناء تسلسل صناعي بطول 1024 ضع علامة الإشارة في موقع معروف، وملأ الباقي بالضوضاء. احسب (أ) وزن الاهتمام القياسي لـ softmax على وضع الإشارة و (ب) وزن الاهتمام المختلف. قياس نسبة الإشارة إلى الضجيج في كل منها. إنّ الاهتمام DIFF يُنتج بشكل موثوق بنسبة أعلى من الإشارة إلى الضجيج بمعدل 3x-10x اعتماداً على مدى اختلاف الفرعين.

### الخطوة 5: حسابات المعلمات V1 مقابل V2

في حالة إعطاء إعداد (خفية = 4096 ، رؤوس = 32 ، d_head = 128) ، طبع:

- محول خط الأساس: Q، K، V لكل حجم `hidden * hidden`، MLP في 4 * مخفي.
- DIFF V1: Q، K لكل حجم `hidden * hidden`, حجم V`hidden * hidden`(غير تغير) ، رأس ضيق نصف داخليا. يضاف لكل رأس`lambda`المعلمات$(O(\text{heads} \cdot d_{\text{head}}))$. . .
- DIFF V2: حجم Q `2 * hidden * hidden`، حجم K`hidden * hidden`, حجم V`hidden * hidden`ضئيل جداً تم إلقاءه إلى أسفل من قبل$O_W$. يضيف نفس الشيء`lambda`المعلمات

القياس لعبة تكلفة المعايير الإضافية لـ V2 (تقريبًا `hidden * hidden`(إضافية لكل كتلة مراقبة) وطبعتها.

## استخدمها

DIFF V2 لا يتم شحنها بعد في كل خادم استنتاج الإنتاج اعتبارا من أبريل 2026, ولكن التكامل يجري في vLLM و SGLang. في الوقت نفسه يظهر النمط في:

- نماذج الإنتاج الداخلية لـ Microsoft في السياق الطويل.
- تكرار البحوث في عدة تدريبات نموذج مفتوحة تستهدف حوالي 256k +.
- بنيات هجينة تجمع بين اهتمام DIFF مع اهتمام النافذة المنزلقة على طبقات بديلة.

عندما تصلوا لهذا في عام 2026:

- تدريب نموذج جديد من الصفر استهداف 64k + سياق فعال. إضافة الاهتمام التفاضلي من البداية؛ إعادة التدريب في وقت لاحق هو مكلف.
- تحسين نموذج سياق طويل حيث تفشل في الوسط يهيمن على تقييمك. يمكن أن تقترب من هيكل DIFF

عندما لا تريد:

- أنت تخدم نموذجًا كثيفًا تم تدريبه مسبقاً مع أداء مستقر في السياق الطويل.
- سياقك دائماً أقل من 16 ألف، و ضجيج الأرضية لا يُعتبر مهملاً

## أرسله

هذا الدرس يُنتج`outputs/skill-diff-attention-integrator.md`نظراً لتهيئة النموذج، وطول السياق المستهدف، وملف الهلوسة، وميزانية التدريب، فإنه ينتج خطة تكامل لإضافة الاهتمام المختلف إلى مسار جديد قبل التدريب أو تحسين LoRA.

## التمارين

1. أركض`code/main.py`التحقق من أن نسبة الإشارة إلى الضجيج التي تم الإبلاغ عنها عن الاهتمام التفاضلي أعلى من الاهتمام القياسي لـ softmax على البحث الاصطناعي. قم بتغيير amplitude الضجيج وتظهر نقطة التقاطع حيث يصبح الاهتمام القياسي غير صالح للاستخدام.

2. احسب دلتا عدد المعلمات من خط الأساس إلى DIFF V1 ومن خط الأساس إلى DIFF V2 لنموذج من فئة 7B (خفي = 4096 ، الرؤوس = 32 ، d_head = 128 ، 32 طبقة). أظهر أي مكونات حصلت على المعلمات والتي ظلت نفسها.

3. اقرأ القسم 3 من ورقة DIFF V1 (arXiv:2410.05258) والقسم 2 من مدونة DIFF V2 Hugging Face. في جملتين، شرح لماذا كان V1 لكل رأس RMSNorm ضروريا ولماذا يمكن V2 إزالتها دون تسبب الانحرافات التدريبية.

4. تنفيذ عملية التسريب: حساب الاهتمام التفاضلي مع `lambda = 0`(أول ماكسيوم ناعم) و `lambda = 1`(الخصم الكامل) في الاستفسار الاصطناعي، قياس كيفية تغيرات الإشارة إلى الضوضاء عبر التصفح. حدد `lambda`الذي يزيد من إشارة إلى الضجيج.

5. تمديد اللعبة إلى GQA + DIFF V2. اختر 8 رؤوس KV و 32 رأس Q. أظهر أن حجم مخزن KV يطابق نموذج GQA الأساسي مع نفس (8, 32) التكوين.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Differential attention | "Two softmaxes minus each other" | Split Q, K into two halves, compute two softmax maps, subtract the second (scaled by $\lambda$) from the first, then multiply by V |
| Noise floor | "The non-zero tail of softmax" | The $O(1/N)$ weight softmax puts on every unrelated token, which sums to $O(1)$ across long contexts |
| lambda | "The subtraction scale" | Per-head learnable scalar parameterized as `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`; can be negative |
| DIFF V1 | "The ICLR 2025 version" | Original Differential Transformer; halves head dim to preserve parameter count, needs custom kernel, slower decode |
| DIFF V2 | "The January 2026 fix" | Doubles Q heads keeping KV heads; matches baseline decode speed and works with FlashAttention |
| Per-head RMSNorm | "The V1 stabilizer" | Extra norm V1 applied after the difference; V2 removed it to prevent late-training instability |
| Signal-to-noise ratio | "How much attention is wasted" | Ratio of weight on the true signal position to average weight on unrelated positions |
| Lost in the middle | "Long-context failure mode" | Empirical phenomenon where retrieval accuracy dips for documents in the middle of a long context — DIFF attention reduces this |
| Arithmetic intensity | "FLOPs per byte loaded" | Ratio V2 increased at decode by doubling queries per KV load; important for memory-bound decode |

## المزيد من القراءة

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) الورقة الأصلية مع نظرية إلغاء الضوضاء و إضفاءات السياق الطويل
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) إعادة كتابة سلسلة الإنتاج، تطابق رمز القاعدة، FlashAttention متوافقة
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) تحليل نظري لسبب استعادة الخصم من قبل تدريب التركيز
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) متغير مشاركة المعلمات
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) خط البداية من Transformer DIFF
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) مقياس الموازنة للوقت الطويل أهداف الاهتمام في صندوق النقد الدولي
