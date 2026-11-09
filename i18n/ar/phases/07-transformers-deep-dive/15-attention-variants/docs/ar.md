# الاهتمام المتغيرات  نافذة زلقة، شقق، فرقية

> الاهتمام الكامل هو دائرة. كل رمز يرى كل رمز، والذاكرة تدفع الثمن. ثلاثة فوارق يلتوي شكل الدائرة ويسترد نصف التكلفة.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## المشكلة

تكاليف الاهتمام الكامل$O(N^2)$الذاكرة و$O(N^2)$الحساب في طول التسلسل. بالنسبة لـ 128K-context Llama 3 70B الذي هو 16 مليار إدخال الاهتمام في كل طبقة، × 80 طبقة. الاهتمام الفلاشي (درس 12) يخفي$O(N^2)$ذاكرة التفعيل ولكن لا تغير التكلفة الحسابية  كل رمز لا يزال يشارك في كل رمز آخر.

ثلاث فئات من المتغيرات تغير توبولوجي المصفوفة الاهتمام نفسها:

1. **Sliding window attention (SWA).**كل رمز يحتفظ بنفذة ثابتة من الجيران، وليس المقبل الكامل.$O(N \cdot W)$أين$W$(جيمما 2/3، أول طبقات (ميسرال 7ب، (في-3-لونغ
2. **Sparse / block attention.**فقط أزواج مختارة`(i, j)`والباقي يضطرون إلى زيرو الوزن. Longformer، BigBird، OpenAI محول نادر.
3. **Differential attention.**قم بحساب خرائط اهتمامين مع توقعات Q / K منفصلة ، وقل واحدة من الأخرى. يقتل "مصهر الاهتمام" الذي ينزف الوزن إلى الرموز القليلة الأولى. تحويل DIFF من مايكروسوفت (2024).

هذه تتواجد معًا. نموذج حدود 2026 غالباً ما يخلط بينها: معظم الطبقات هي SWA-1024, كل خمس هي الاهتمام الكامل العالمي، ومجموعة قليلة من رؤوس التفاضل التي تنظف الاسترداد. نسبة Gemma 3 5: 1 SWA إلى العالمية هي القاعدة التعليمية الحالية.

## المفهوم

### مراقبة النافذة المنزلقة (SWA)

كل استفسار في الموقف$i$يشارك فقط في المواقف في $[i - W, i]$(المتوسط السريع) أو $[i - W/2, i + W/2]$(مباشرة) الوهم خارج النافذة الحصول$-\infty$في المصفوفة

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

لأجل$N = 8192$و$W = 1024$، المصفوفة النتيجة لديها 1024 × 8192 صفوف غير صفر في التوقعات  خفض 8 ×.

**KV cache shrinks with SWA.**فقط الأخيرة$W$يجب الاحتفاظ بطباقات K و V لكل طبقة. بالنسبة لتنظيم Gemma-3-ish (1024 نافذة ، سياق 128K) ، ينخفض cache KV 128 ×.

**Quality cost.**محولات SWA فقط تكافح مع الاسترداد على المدى الطويل. التحدي: التخلي عن طبقات SWA مع طبقات الاهتمام الكامل. Gemma 3 تستخدم 5:1 SWA: عالمية. استخدم Mistral 7B كومة SWA السببية حيث "تدفق الأمام" المعلومات من خلال نوافذ تتداخل  كل طبقة تمديد المجال الاستقبلي الفعال من قبل $W$، وبعد ذلك`L`الطبقات التي يمكن أن يشاركها النموذج`L × W`الرد على الرمز

### الاهتمام القليل / الحظر

اختر واحد`N × N`نمط التنقل قبل الزمن ثلاثة أشكال قائمة:

- **Local + strided (OpenAI sparse transformer).**إعتني بالآخرين$W$الرموز الإلكترونية`stride`-الرمز الأول قبل ذلك، يلتقط على حد سواء المحلي والطويل المدى$O(N \cdot \sqrt{N})$الحساب
- **Longformer / BigBird.**نافذة محلية + مجموعة صغيرة من الرموز العالمية (مثل `[CLS]`) التي تشتمل على الجميع و تشتمل على الجميع + روابط عشوائية.
- **Native Sparse Attention (DeepSeek, 2025).**تعلم أي كتلة من `(Q, K)`المادة، تخطي بلاك الصفر على مستوى النواة

الاهتمام الرخيص هو قصة هندسة النواة. الرياضيات بسيطة (قنع ماتريكس النتيجة) ؛ النصر يأتي من عدم تحميل الإدخالات الصفرية في SRAM. فلاشاتشن-3 و 2026 فليكساتشن API جعل الأنماط الرخيصة المخصصة من الدرجة الأولى في PyTorch.

### الاهتمام المختلف (محول DIFF ، 2024)

الاهتمام المنتظم لديه مشكلة "مصدر الاهتمام": softmax يضطر كل سطر إلى جمع إلى 1, لذلك الرموز التي لا تريد الاهتمام بأي شيء معين ضغط على الرموز الأولى (أو القليل الأول). هذا يسرق القدرة التي كان ينبغي أن تذهب إلى المحتوى الحقيقي.

الاهتمام المختلفة يصلح هذا عن طريق الحوسبة**two**خرائط الاهتمام والخصم:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

أين$\lambda$هو مقياس تعلم (عادة 0.50.8). A1 يلتقط أوزان المحتوى الحقيقي؛ A2 يلتقط الغسالة. الاخصاب يلغي الغسالة، يعيد توزيع الوزن إلى الرموز ذات الصلة.

النتائج المعلنة (مايكروسوفت 2024): 510% أقل تعقيدًا، 1.52 × أكثر فترة من السياق الفعلي في نفس الطول المدرب، استرداد إبرة أكثر حدة في كومة الشوفان.

### مقارنة مختلفة

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## بناءها

انظر`code/main.py`أو ميناء " رست "`code/main.rs`لتشغيل نسخة " الرست "`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`نطبق مقارنة قناع السببية التي تظهر كاملة، SWA، محلية+خطوة، والاهتمام المختلف جنبا إلى جنب على تسلسل اللعبة.

### الخطوة الأولى: قناع السببية الكامل (الخط الأساسي)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

خط أساسي من الدروس 7 . مثلث أسفل؛ وزنه صفر فوق المقاطع.

### الخطوة الثانية: قناع سببية للنوافذ المزلقة

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

مُعَدّة واحدة  `window`- لأجل`window >= n`، ستستعيد الاهتمام السببي الكامل`window = 1`كل رمز يُعتني بنفسه

### الخطوة الثالثة: قناع محلي + خطوة نادرة

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

نافذة محلية كثيفة زائد كل `stride`-الرمز الثاني يعود إلى بداية السلسلة.

### الخطوة الرابعة: الاهتمام المختلف

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

اثنين من الانتباه يمرون، خصم مع معدل الاختلاط تعلم. في الرمز نقارن خريطة حرارة الانتباه-الغموض من واحد مقابل التفاضل ونشاهد انهيار المحموض.

### الخطوة 5: حجم مخزن KV

طبع حجم الاحتفاظ بالمتخزن لكل طبقة في $N = 131072$في كل فاركس، فإن الفاركسات المختلفة والتي تصل إلى 10 × 100 ×، وتضاعف الفواركس، وتدفع فاتورة الذاكرة بشكل واعي.

## استخدمها

نمط الإنتاج 2026:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

FlexAttention في PyTorch 2.5+ يقبل وظيفة قناع:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

هذا يجمع إلى kernel Triton المخصص. في حدود 10% من سرعة FlashAttention-3 للأنماط الشائعة، ويكون وظيفة القناع هو Python.

**When to pick each:**

- **Pure full attention** كل طبقة حتى حوالي 16K، أو عندما تكون جودة الاسترداد هي الأساسية.
- **SWA + global mix** سياق طويل (> 32K) ، التدريب والإستنتاج المرتبط بالذاكرة.
- **Sparse block attention**النواة المخصصة، النمط المخصص. احتفظت لأحمل العمل المتخصصة (التحقيق، الصوت).
- **Differential attention** أي عبء عمل يؤلم فيه تلوث الغوص بالاهتمام (RAG ذات السياق الطويل، الإبر في كومة الخشب).

## أرسله

انظر`outputs/skill-attention-variant-picker.md`. تحدد المهارة توبولوجيات الاهتمام لنموذج جديد نظراً لعدد السياق المستهدف، ومتطلبات الاسترداد، وملف تعليمي/إضافي.

## التمارين

1. **Easy.**أركض`code/main.py`. تأكد من الـ SWA في`window=4`يُصفر كل شيء خارج الرموز الأربعة الأخيرة في كل صف.`window=n`يعيد التفكير في الاهتمام السببي الكامل بشكل متطابق
2. **Medium.**تنفيذ SWA السببية مع `window=1024`على رأس الحجر الرئيسي للدرس 07، تدريب على 1000 خطوة على Tinyshakespeare. كم يتراجع فقدان القيمة مقابل الاهتمام الكامل؟ كم تنخفض الذكريات الذكرية الذكية الذكية الذكية الذكية؟
3. **Hard.**تنفيذ مزيج من طبقات 5: 1 على النمط Gemma-3 (5 SWA ، 1 عالمية) في نموذج الحجر النهائي. مقارنة خسارة الذاكرة وجميع جنيات الجودة ضد خطوط أساس SWA النقية والعالمية النقية عند الموازنة.
4. **Hard.**تنفيذ الاهتمام المختلف مع المتعلمين$\lambda$لكل شخص. تدريب على مهمة استرداد اصطناعية (إبرة واحدة، 2000 جهاز إشتت). قياس دقة الاسترداد مقابل خط أساسية للاهتمام الواحد عند المعلمات المقابلة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## المزيد من القراءة

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) ورقة الزرقة القنونية + ورقة الوسائل العالمية.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062)محلي + عالمي + عشوائي
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) نمط OpenAI المحلي+المخطط
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) المزيج العالمي 1: 1 SWA:
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) الخليط 5:1 مع نافذة =1024 هذا الآن الكتاب المقدس الافتراضي.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) ورق DIFF Transformer.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) الاهتمام المتعلم في التناثر في DeepSeek-V3.2
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) إشارة API لنمط القناع كالمكالمة في استخدامها.
