# التشفير المضارب والنسر

> إن إدارة الشراكات الحدودية التي تولد رمز واحد تتطلب إعطاء كامل للأمام على مليارات المعلمات. هذا المخطط المقدم مزيد من المزودية: في معظم الأحيان يمكن لنموذج أصغر بكثير أن يحدد 3-5 رمزاً التالية بشكل صحيح، والنموذج الكبير فقط يحتاج إلى * التحقق* من الظن. عندما يكون الرهان صحيحاً لديك 5 رموز مقابل سعر واحد التشفير المضارب (ليفياثان وآخرون) 2023) جعل هذا بالضبط، واندفع EAGLE-3 (2025) معدلات القبول إلى ~ 4.5 رموز لكل تأكيد  4 - 5x تسريع عند توزيع الخروج المماثل.

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## المشكلة

إن تسريع تشكيل نموذج من فئة 70B على H100 عادةً ما يكون 40-80 رمزًا في الثانية. يتطلب كل رمز مرورًا إلى الأمام كاملًا يقرأ جميع أوزان النموذج من HBM. لا يمكنك جعل النموذج أصغر دون تغيير خروجه. لا يمكنك زيادة حجم الحزمة خارج الذاكرة. أنت عالق  إلا إذا تمكنت من السماح للنموذج بمخرج أكثر من رمز واحد لكل مرور إلى الأمام.

الجيل السريع يبدو بطبيعته سلسلية`x_{t+1} = sample(p(· | x_{1:t}))`ولكن هناك فرصة للتزامن. إذا كان لديك متنبؤ رخيص يقول "الربعة رموز التالية هي على الأرجح [a، b، c، d]" يمكنك التحقق من جميع المواقع الخمسة في a **single forward pass of the big model**و تقبل أطول مُتطابقة المُستقبل

قام ليفياثان وكالاي وماتياس (2023 ، "التخفيف السريع من المحولات عبر التشخيص المضارب") بهذا الدقيق من خلال قاعدة قبول / رفض ذكية تحافظ على توزيع العينات للنموذج المستهدف. نفس توزيع الخروج ، 2-4 × أسرع.

## المفهوم

### الإعداد من النماذج الثنائية

- **Target model** `M_p`النموذج الكبير البطيء والجودة العالية التي تريد عينات منها`p(x)`. . .
- **Draft model** `M_q`: نموذج صغير سريع منخفض الجودة. التوزيع: `q(x)`5-30 × أصغر

لكل خطوة:

1. مشروع النموذج المقترح `K`الـ " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " "`x_1, x_2, ..., x_K ~ q`. . .
2. نموذج الهدف يستخدم واحد إلى الأمام عبر كل `K+1`المواقع المتوازية، وتنتج `p(x_k)`لكل رمز مقترح
3. اقبل/رفض كل رمز من اليسار إلى اليمين من خلال قاعدة الرفض المعدلة أدناه. اقبل أطول ملحق المقبل.
4. إذا تم رفض أي رمز، عينة البديل من التوزيع المصحّح ووقف. وإلا عينة واحدة من إعلانات الخصم من `p(· | x_1...x_K)`. . .

إذا كان المسودة تتطابق مع الهدف بشكل مثالي، تحصل على رموز K + 1 لكل هدف. إذا كان المسودة خاطئة في الموقف 1، تحصل فقط على رمزا 1.

### قاعدة الدقة

التشفير المضارب هو**provably equivalent in distribution to sampling from p**قاعدة الرفض:

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

أين`(p - q)+`يرمز إلى الجزء الإيجابي من الفرق بين النقاط. عندما يتفق المسودة والهدف (`p ≈ q`) القبول هو تقريبا 1. عندما يختلفان، يتم بناء التوزيع المتبقية بحيث لا يزال العينة الكلية بالضبط `p`. . .

**Greedy case.**لقطة العينات من درجة الحرارة=0 فقط تحقق`argmax(p) == x_t`إذا كان ذلك صحيحاً، فاقبل، وإذا كان لا، فانطلق`argmax(p)`و توقف

### التسارع المتوقع

إذا كان معدل قبول النموذج المشروع على مستوى الرمز هو `α`، فإن الرموز المتوقعة التي يتم إنتاجها لكل مرسلة متقدمة هدف هي:

```math
\mathbb{E}[\text{tokens}] = \frac{1 - \alpha^{K+1}}{1 - \alpha} \qquad K = \text{draft length}, \ \alpha \in [0, 1]
```

في`α = 0.8, K = 4`: `(1 - 0.8^5)/(1 - 0.8) = 3.36`الـ "Token" لكل مؤشر.`cost_q * K + cost_p`(إثبات خطوات مسودة K بالإضافة إلى هدف واحد)`cost_p >> cost_q * K`نسبة تسريع هي `3.36× / 1 = 3.36×`على التدفق

المعلم الحقيقي الوحيد هو`α`، والذي يعتمد بالكامل على التوصل إلى مسودة-هدف. مسودة جيدة هي كل شيء.

### تدريب المشروع: التطهير

نموذج صغير عشوائي يُصنع مسودة سيئة، وصفة قياسية هي تقطيعها من الهدف:

1. اختر معمارة صغيرة (~ 1B لهدف 70B، ~ 500M لهدف 7B).
2. قم بتشغيل النموذج المستهدف على مجموعة كبيرة من النص؛ تخزين توزيعات الوهم التالي.
3. قم بتدريب المسودة مع تباين KL ضد توزيع الهدف (وليس ضد رموز الحقيقة القائمة).

النتيجة:`α`عادةً 0.6-0.8 في التشفير، 0.7-0.85 في الدردشة باللغة الطبيعية. تسريع 2-3x في الإنتاج.

### النسر: رسم الأشجار + إعادة استخدام الميزة

لاحظ لي ووي وجانغ وجانغ (2024، "إيغل: يتطلب العينات المضاربة إعادة التفكير في عدم اليقين الخاص") عدم كفاءة في فك التشفير المضاربي القياسي:

1. يقدم المسودة خطوات تسلسلية K ، كل خطوة كاملة. ولكن يمكن للمسودة إعادة استخدام ميزات الهدف (الولايات المخفية) من أحدث التحقق من تمثيلات الغنية الحسابية التي قام بها الهدف بالفعل أن المسودة تستند مرة أخرى من الصفر.
2. إن المسودة تنطلق سلسلة خطية. إذا كان يمكن للمسودة أن تنطلق * شجرة * من المرشحين (كل عقدة تخمينات متعددة) ، فإن مرور الهدف الواحد للأمام يمكن التحقق من مسارات المرشحين المتعددة بالتوازي عبر قناع مراقبة شجرة ، واختيار أطول فرع مقبول.

تغييرات في إيغل-1:
- مدخل مسودة = الحالة الخفية النهائية للهدف في الموقف t، وليس رموز خام.
- المخططات الهندسة المعمارية = 1 طبقة مُعدل مُعدل للمحول (ليس نموذج صغير منفصل).
- إنتاج = شجرة من K = 4-8 مرشحين لكل عمق، عمق 4-6.

إيجل-2 (2024) يضيف توبولوجيّة الأشجار الديناميكية: ينمو الشجرة أوسع حيث يكون المسح غير مؤكّد ويبقى ضيقًا حيث يكون واثقًا.`α_effective`دون زيادة تكلفة التحقق.

(Li et al. 2025، "EAGLE-3: زيادة تسريع الإدلاء على نماذج اللغة الكبيرة عبر اختبار وقت التدريب") يزيل اعتماد الميزات العليا الثابتة ويعمل على تدريب المسودة بخسارة جديدة "تحاكي وقت الاختبار" يرتفع معدل قبول من 0.75 (EAGLE-2) إلى 0.82 (EAGLE-3) ، ومتوسط الرموز / التحقق من 3.0 إلى 4.5. هذه الأرقام تأتي من إعداد مرجعي واحد. يعتمد القبول على زوج النموذج، شجرة مشروع والحركة المرور: المرحلة 10 · 15 اقتباسات 0.88 إلى 0.92 لكل رمز المسار المقبول على مقاييس الدردشة، والمرحلة 17 · 05 خطط مع 0.6 إلى 0.8 على الدردشة العامة الإنتاج.

### التحقق من الاهتمام بالأشجار

عندما يخرج المسودة شجرة، يقوم النموذج المستهدف بتحققها في مرور واحد للأمام باستخدام **tree attention mask**قناع سببي يرمز أصل الشجرة بدلاً من خط نقي. كل رمز يقدم فقط لأجداده في الشجرة. يظل مرسل التحقق واحد إلى الأمام ، واحد ماتمول ؛ يكلّف قناع الأصل عدد قليل من إدخالات KV الإضافية فقط.

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

إذا`a, b`يتنافس المرشحون الأولين والتي تُحصل على الرمز`c, d, e, f`يتم التحقق من جميع المواقف الستة في مرور واحد إلى الأمام. الخروج هو أطول مقدمة على طول أي مسار مقبول.

### عندما يفوز، عندما لا يفوز

**Wins:**
- دردشة / إكمال مع نص يمكن التنبؤ به (رمز، الإنجليزية المشتركة، الخروج المهيكلي). `α`هو مرتفع.
- الإعدادات مع حساب GPU غير المستخدم أثناء فك الرمز (مرحلة مقيدة بالذاكرة). استخدام رسم الأشجار FLOPs المتاحة.

**Loses / no win:**
- نتائج متوقعة للغاية (الكتبة الإبداعية عند درجة حرارة عالية). `α`ينخفض نحو`1/|vocab|`. . .
- الحزمة التي تقدم مع التزامن عالية جدا  الحزمة تملأ بالفعل FLOPs، فليس هناك مجال للتحقق من الأشجار.
- طرازات هدف صغيرة جدا حيث لا يكون المسودة أصغر بكثير.

عادة ما تُبلغ متاجر الإنتاج عن تسريع الساعة الجدارية 2-3x على الدردشة، و 3-5x على إنتاج الرموز، و 0 تقريباً على الكتابة الإبداعية.

```figure
speculative-decoding
```

## بناءها

`code/main.py`:

- مرجع`speculative_decode(target, draft, prompt, K, temperature)`التي تنفذ قاعدة الرفض الدقيقة وتحقق من أنها تحافظ على توزيع الهدف ( KL < 0.01 بمقارنة بعينات عينات الهدف العادي).
- شكل شجرة النسر التي تبني شجرة عمق K مع فرع أعلى.
- مُصنع قناع الاهتمام للشجرة الذي ينتج النمط السببي المناسب للمؤكد
- حزمة معدل قبول تعمل على كلتا الحدود الصغيرة (تقطيع واحد GPT-2-صغير من هدف GPT-2- المتوسط).

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_dists = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_dists.append(probs)
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_dists[k][tok]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_dists[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## استخدمها

- **vLLM**و**SGLang**في vLLM، اجتياز `--speculative-config`كائن JSON مع `method`،`model`و`num_speculative_tokens`؛ الـ 3 هي`"method": "eagle3"`. . .
- **NVIDIA TensorRT-LLM**يدعم شجرة ميدوسا و شجرة النسر بشكل أصلي
- **Reference draft models**: `Qwen/Qwen3-0.6B`(مصادر قوانين 32-32ب) ،`meta-llama/Llama-3.2-1B-Instruct`(مصادر للاما 3.x 70B)
- **Medusa heads**(Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"): بدلاً من مشروع نموذج، أضف رؤوس تنبؤ متوازية K إلى الهدف نفسه. أبسط في النشر، وقبول أقل قليلاً من EAGLE.

## أرسله

هذا الدرس يُنتج`outputs/skill-speculative-tuning.md` مهارة تحدد تحديد حجم العمل للنموذج المستهدف وتختار: نموذج مشروع، K (طول مشروع) ، عرض الشجرة، درجة الحرارة، ومتى يجب أن يعود إلى عملية فك الرمز.

## التمارين

1. تنفيذ قاعدة الرفض الدقيقة والتحقق من ذلك تجريبيا.`speculative_decode`و عن طريق أخذ عينات واضحة للمستهدف؛ حساب المسافة التلفزيونية بين توزيعات المخرجين. يجب أن يكون < 0.01.

2. احسب صيغة تسريع`α`و`K`، رسم الرموز المتوقعة لكل هدف - إلى الأمام.$K$لـ$\alpha \in \lbrace 0.5, 0.7, 0.9 \rbrace$. . .

3. قم بتدريب مسودة صغيرة، خذ هدف 124 مليون جبت-2 وقطع مسودة 30 مليون جبت-2 على رموز 100 مليون مع خسارة KL.`α`على النص المُتَمَرّد. المتوقع: 0.6-0.7.

4. قم بتنفيذ رسم شجرة على طراز EAGLE. بدلاً من سلسلة، قم بتقديم مسودة الخروج لأعلى 3 فروع في كل عمق. قم ببناء قناع مراقبة الشجرة. تحقق من قبول الهدف لأطول فروع صحيحة.

5. قياس أوضاع الفشل. تشغيل فك التفكير عند درجة حرارة = 1.5 (استوكاستية عالية). عرض α ينهار والخوارزمية بطيئة من فك العادي بسبب مسودة التكلفة العليا.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Target model | "The big model" | The slow, high-quality model you want samples from (p distribution) |
| Draft model | "The speculator" | The small, fast predictor (q distribution); 5-30x smaller |
| K / draft length | "Look-ahead" | Number of speculated tokens per verify pass |
| α / acceptance rate | "Hit rate" | Per-token probability that the draft's proposal is accepted |
| Exact rejection rule | "The accept test" | r < p/q compare that preserves target's distribution |
| Residual distribution | "Corrected p-q" | (p - q)+ / ||(p - q)+||_1, the distribution to sample from on rejection |
| Tree drafting | "Branching speculation" | Draft outputs a tree of candidates, verified in one pass with tree-structured attention mask |
| Tree attention mask | "Topological mask" | Causal mask encoding the tree topology so each node attends only to its ancestors |
| Medusa heads | "Parallel heads" | K extra prediction heads on the target itself; no separate draft model |
| EAGLE feature reuse | "Hidden-state draft" | Draft input is target's last hidden state, not raw tokens, shrinking the draft |
| Test-time simulation loss | "EAGLE-3 training" | Train draft on outputs matching target's test-time distribution, not teacher forcing |

## المزيد من القراءة

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) قاعدة الرفض الدقيقة وتحليل السرعة النظرية
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) ورقة استنتاج عينات متزايدة في DeepMind
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) البدائل المتوازية للنموذج المخطط
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) إعادة استخدام الميزات وصياغة الأشجار
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) توبولوجيات الأشجار الديناميكية
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) توازن الوقت الاختبار في الوقت المتعلق بالقطار
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) تشفير جاكوبي/لوكا هيد، بديل خالي من المضاربين
