# التشخيص المضارب  مسودة، التحقق، تكرار

> التشفير السريع هو سلسلة. كل رمز ينتظر السابق. التشفير المضاربة يكسر السلسلة: النموذج الرخيص يخطط N رموز، النموذج الثمين يصدق كل N في مرور واحد إلى الأمام. عندما يكون المسودة صحيحة دفعت واحدة كبيرة إلى الأمام لجيول N.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## المشكلة

أخذ عينة 70B LLM واحدة تأخذ ~ 30 ms على H100. نموذج مشروع 3B يستغرق ~ 3 ms. إذا تركنا مشروع 3B 5 رموز في الأمام، ثم تشغيل 70B * مرة واحدة * للتحقق من جميع 5 ، فإن إجمالي $5 \times 3 + 30 = 45$ms لحد يصل إلى 5 رموز مقبولة  مقابل `5×30 = 150 ms`هذا هو خط الكمية التخفيفية التخفيفية: تبادل كمية صغيرة من ذاكرة GPU الإضافية (نموذج مشروع) مقابل 24× تأخير أقل لتخفيف.

يجب أن تحافظ على التوزيع. يضمن العينات التكهنوية، التي قدمها ليفياثان وآخرون (2023) وآخرون تشين وآخرون في وقت واحد، أن تسلسل الخروج هو **identically distributed**ما كان يمكن أن ينتجها النموذج الكبير بمفرده لا يوجد تعادل في الجودة فقط أسرع

أربعة أسرة من أزواج التحقق من المسودة تهيمن على استنتاج 2026:

1. **Vanilla speculative (Leviathan 2023).**نموذج مسودة منفصل (مثل Llama 3 1B) + مؤكد (مثل Llama 3 70B).
2. **Medusa (Cai 2024).**رؤوس فك تشفير متعددة على مؤكد التنبؤ المواقع `t+1..t+k`في موازية لا يوجد نموذج منفصل
3. **EAGLE family (Li 2024, 2025).**مسودة خفيفة الوزن التي تستخدم مرة أخرى الحالات الخفية للمحقق؛ معدل قبول أقرب من الفانيليا؛ 34 × نموذجي.
4. **Lookahead decoding (Fu 2024).**التكرار جاكوبي، لا حاجة إلى نموذج مشروع على الإطلاق، التكهن الذاتي، مكانة، ولكن خالية من الاعتماد.

كل استنتاج إنتاج مكعب في 2026 سفن فك التشفير الافتراضي الافتراضي. vLLM، TensorRT-LLM، SGLang، و llama.cpp جميع دعم على الأقل الفانيلا + EAGLE-2.

## المفهوم

### الخوارزمية الأساسية

مع إعطاء مؤكد $M_q$و مسودة أرخص$M_p$:

1. دعونا$x_1 \ldots x_k$يجب أن يكون المقبلة تم فك رموزها بالفعل.
2. **Draft**: استخدام $M_p$تقديم اقتراحات متراجعية$d_{k+1}, d_{k+2}, \ldots, d_{k+N}$مع احتمالات مسودة$p_1 \ldots p_N$. . .
3. **Verify in parallel**: تشغيل$M_q$مرة واحدة على$x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$، الحصول على احتمالات المؤكد $q_1 \ldots q_{N+1}$للمواقف$k+1 \ldots k+N+1$. . .
4. **Accept/reject each draft token left to right**: لكل $i$, اقبل مع احتمال$\min(1, q_i(d_i) / p_i(d_i))$. . .
5. على الرفض الأول في الموقف$j$: العينة $t_j$من التوزيع "البقية" $(q_j - p_j)_+$تمت تطبيقها، كل المسودات بعد$j$يتم التخلص منها
6. على قبول كل شيء$N$: عينة رمز إضافي $t_{N+1}$من$q_{N+1}$(وهذا هو رمز المكافأة المجانية)

خدعة التوزيع المتبقية هي البصيرة الرياضية التي تبقي الناتج موزع تماما كما لو$M_q$لقد أخذنا عينات من الصفر

### ما الذي يحدد السرعة

دعونا$\alpha$= معدل قبول المتوقع لكل مشروع رمز.$c$= نسبة تكاليف المسودة إلى المحقق. لكل خطوة:

- الجيل البطيء يقدم مكالمة نموذجية كبيرة واحدة لكل رمز
- المضاربة تقوم بمكالمة نموذجية كبيرة واحدة لكل$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$الـ " توكن " عندما$\alpha$هو مرتفع.

قاعدة عامة في$\alpha = 0.75$و$N = 5$: 3x أقل مكالمات النموذج الكبير. تكلفة المسودة 5x رخيصة. إجمالي ساعة الجدار انخفض ~ 2.5x.

**$\alpha$ depends on:**

- كيف يقترب المسودة من المؤكد. نفس العائلة / نفس البيانات التدريبية تعزز$\alpha$بشكل كبير
- استراتيجية فك الرقمية مسودة طموحة ضد المحقق طموحة: عالية $\alpha$. أخذ العينات في درجة الحرارة: أصعب التطابق، انخفاض القبول.
- نوع المهمة: القانون والإخراج المهيكلي يقبل أكثر (من الممكن التنبؤ به) ؛ الكتابة الإبداعية في النموذج الحر يقبل أقل.

### مدوسة  مسودات بدون مسودة نموذج

"ميدوزا" تستبدل النموذج المخطط بأواصيل إضافية على المحقق.`t`:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

كل رأس يخرج من علاماتها الخاصة. عند الاستنتاج تقوم بعينية من كل رأس للحصول على تسلسل مرشح، ثم التحقق من ذلك باستخدام مرور واحد إلى الأمام باستخدام نظام الاهتمام الشجرة الذي يعتبر جميع مواصلات المرشح في وقت واحد.

المزايا: لا نموذج آخر. السلبيات: يضيف معايير قابلة للتدريب؛ يحتاج إلى مرحلة تحسين رقابة (~ 1B رموز) ؛ معدل قبول أقل قليلا من المضاربة الفانيليا مع مسودة جيدة.

### النسر  أفضل مسودة من خلال إعادة استخدام الحالات المخفية

يجعلها EAGLE-1/2/3 (Li et al., 20242025) نموذج مشروع محول صغير (عادة 1 طبقة) يتناول الحالات الخفية في الطبقة الأخيرة للمحقق. لأن المسودة ترى تمثيل ميزة المحقق، تتواصل توقعاتها بقوة مع توزيع الخروج للمحقق. معدلات القبول ترتفع من ~ 0.6 (فانيلا) إلى 0.85+. هذه هي أسعار لكل رمز على مقارنات الدردشة، مع مسودة تدرب على مطابقة بيانات الدردشة. في مجال حركة الإنتاج المختلطة، يمكن أن تكون المرحلة 17 · 05 خططاً مع 0.6 إلى 0.8 بالنسبة لـ EAGLE-3، ويمكن أن تكون حركة النطاق أقل.

إيغل-3 (2025) أضاف بحث الأشجار على استمرارات المرشحين. vLLM و SGLang سفن إيغل-2/3 كمسار التفاصيل الافتراضية الافتراضية للاما 3/4 و Qwen 3.

### رقص الكشاف الكهربائي

إمدادات التحقق $N$مسودة رموز إلى المؤكد في مرور واحد إلى الأمام. وهذا يمتد مخزن KV المؤكد$N$إدخالات. إذا رفض بعض المسودات، يجب أن تتمكن من إعادة التخزين إلى طول المقبل المقبول.

تنفيذات الإنتاج (vLLMs `--speculative-config`(تنسورRT-LLM's LookaheadDecoder) التعامل مع هذا مع خفازات KV الرموز. كتابة أولا، الالتزام على قبول.

```figure
draft-verify-tokens
```

## بناءها

انظر`code/main.py`نطبق خوارزمية العينات المضاربة الأساسية (خطوة الرفض + التوزيع المتبقي) مع:

- "نموذج كبير" وهو ما يصل إلى حد كبير من التوصلات المرموقة على التوزيع المرموز يدوياً (لذلك يمكننا التحقق من قبول الرياضيات تحليلياً).
- "نموذج مسودة" وهو اضطراب النموذج الكبير.
- حلقة قبول / رفض تنتج نفس التوزيع الحدودي مثل العينات المباشرة.

### الخطوة الأولى: خطوة الرفض

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`هو رقم عشوائي متساوي.`q_prob`هو احتمال المؤكد للبرنامج المخطط له. `p_prob`نظرية ليفياثان هي أن هذا قرار برنولي، تليها أخذ العينات من البقايا عند رفضها، يحافظ على توزيع المؤكد بالضبط.

### الخطوة الثانية: توزيع البقايا

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

إقلال`p`من`q`معدل العنصر، ضغط القيم السلبية إلى الصفر، تجدد طبيعتها.

### الخطوة الثالثة: خطوة تكهنة واحدة

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

خمسة قبول → مكافأة واحدة → ستة رموز تم إنتاجها في مرسلة تثبيت واحدة.

### الخطوة الرابعة: قياس معدل قبول

اجري 10,000 خطوة تخمينية على مستويات مختلفة من نوعية المسودة. معدل قبول المسودة مقابل تباين KL بين مسودة ومصادق التوزيع. يجب أن ترى علاقة واحدة نظيفة.

### الخطوة 5: التحقق من مساواة التوزيع

تجربيًا: يجب أن تتطابق نظام التاريخ للرموز المنتجة عن طريق الحلقة المضاربة مع نظام التاريخ المنتج عن طريق أخذ العينات مباشرة من المؤكد. هذه هي نظرية ليفياثان في الممارسة العملية. يؤكد اختبار كيس كربع في داخل خطأ أخذ العينات.

## استخدمها

الإنتاج:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

تينسورRT-LLM لديها أسرع مسار في مدوسا اعتبارا من منتصف عام 2026`faster-whisper`يحتوي على تشفيرات مفكرية لـ "سيسبر-غر" مع مسودة صغيرة

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- إنتاج تسلسل واحد من 15 رموز. التكلفة العليا تهيمن.
- إختبار العينات في درجة حرارة عالية ($\alpha$(قليل من النفايات)
- التنفيذات المحدودة بالذاكرة (النموذج المسودة يضيف VRAM).

## أرسله

انظر`outputs/skill-spec-decode-picker.md`. تتخذ المهارة استراتيجية تشخيص مفكرية (فانيلا / ميدوسا / إيغل / رأس النظر) ومعايير ضبط (N ، درجة حرارة المسودة) لحملة عمل استنتاج جديدة.

## التمارين

1. **Easy.**أركض`code/main.py`تأكيد أن توزيع الرمز المضارب يطابق توزيع العينة المباشرة للمحقق على 50،000 الرمز داخل p = 0.05 في المربع
2. **Medium.**سرعة المسار (الرموز لكل نموذج كبير للأمام) كعمل من $N$لـ$\alpha = 0.5, 0.7, 0.85$تحديد المُثلى$N$لكل واحد$\alpha$. (تلميح: الوهم المتوقع لكل دعوة للتحقق = $(1 - \alpha^{N+1}) / (1 - \alpha)$().
3. **Hard.**تنفيذ Medusa الصغيرة: خذ GPT من الدروس 14، أضف 3 رؤوس LM إضافية تتوقع المواقف t+2، t+3، t+4. تدريب على tinyshakespeare مع خسارة متعددة الرؤوس المشتركة. مقارنة معدلات قبول مقابل مسودة الفانيليا التي تمت من خلال تقسيم نفس النموذج.
4. **Hard.**تنفيذ التراجع: ابدأ بحافظة KV من قبل 10 رموز ، ومدفوعة 5 رموز مشروع ، ومحاكاة رفض في الموقف 3. التحقق من قراءة الاحتياطي الخاصة بك مطابقة صحيحة "المتميز + أول 2 مسودات مقبولة" في التكرار التالي.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## المزيد من القراءة

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)الخوارزمية الأساسية ونظرية المساواة
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) إدخال متزامن؛ دليل برنولي صافي.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) ورقة ميدوزا؛ التحقق من الاهتمام بالأشجار.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) إيغل-1؛ مشروع مخفي
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) النسر-2؛ عمق شجرة ديناميكي.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840)-أجل-3
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057)-تراقب، لا يوجد مسودة
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) إشارة إنتاجية طائفة مع جميع الاستراتيجيات الأربعة متواصلة.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) رمز المرجع لـ EAGLE-1/2/3.
