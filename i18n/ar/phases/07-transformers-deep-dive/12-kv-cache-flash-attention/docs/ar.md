# كيش كيف، الانتباه الفلاش وتحسين الإستدلال

> التدريب متوازي ومتعلق بالفلوب، والإستعراض متسلسل ومتعلق بالذاكرة، عقدة زجاجة مختلفة، خدوش مختلفة.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## المشكلة

إنّ جهاز تشخيص التأثير السلبيّ يقوم بذلك$O(N^2)$العمل لتوليد$N$الوهم: في كل خطوة يعيد حساب الاهتمام على المقبلات الكاملة. لرد 4K-الوهم الذي هو 16M عمليات الاهتمام، معظمهم من الضروري. كل حالة مخفية من الوهم المقبلات هي تحديدية بمجرد الحساب  تحتاج فقط لتشغيل استفسار الوهم الجديد ضد المفاتيح المحفوظة في الاحتفاظ والقيم من كل شيء من قبل.

بالإضافة إلى ذلك، ينتقل الاهتمام نفسه الكثير من البيانات. الاهتمام القياسي يضمن ماتريكس N × N درجة، N × d softmax output، N × d output النهائي  الكثير من القراءة والكتابة إلى HBM. بالنسبة إلى N≥2K، يصبح الاهتمام مقيدًا في الذاكرة قبل أن يصبح مقيدًا في FLOP. أجزاء الاهتمام الكلاسيكية لا تستخدم GPUs الحديثة بنسبة 410 ×.

اثنين من التحسينات، كلاهما من داو وغيرها، دفع استنتاج الحدود من "بطيء" إلى "سرعة":

1. **KV cache.**تخزين متجهات K و V لكل رمز إضافية. انتباه كل رمز جديد هو استفسار واحد ضد المفاتيح المحفوظة في الاحتفاظ. التسجيل يقلل من $O(N^2)$إلى$O(N)$لكل خطوة
2. **Flash Attention.**طلاء حساب الاهتمام بحيث لا يصل المصفوفة الكاملة N × N أبدا HBM. كل من softmax + matmul يحدث في SRAM. 24× سجل الساعة الجدارية على A100؛ 510× على H100 مع FP8.

بحلول عام 2026 كلتا الطرازين عالمياً. كل كومة استنتاج الإنتاج (vLLM، TensorRT-LLM، SGLang، llama.cpp) تتخذها. كل سفينة نموذج حدودية مع الإنتباه الفلاش فعالة.

## المفهوم

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### كيو كاش رياضيات

لكل طبقة مُعكس، لكل رمز، عبر جميع رؤوس KV:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

بالنسبة لنموذج 7B مع 32 طبقة، 32 رأس (جميعها يستخدم لـ K و V) ، d_head=128، fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

لـ Llama 3 70B (80 طبقة، d_head=128, GQA مع 8 رؤوس KV):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

هذا 10 جي بي عند 32 كيلو غرام ينمو إلى 40 جي بي عند 128 كيلو غرام، وهو ما هو كامل 40 جي بي A100 فقط لخزنة KV في حجم المجموعة 1.

**GQA is the KV-cache win.**المملكة العربية المتحدة مع 64 كيلو فيترا في المئة أكبر من 8 مرات، حوالي 80 جي بي عند 32K.

سحب الأبعاد ومشاهدة حجم الكاش تتحرك. اضغط على طول التسلسل أو الإفراز وترى كيف سريعا ينفجر عبر GPU واحد:

```figure
kv-cache-sizer
```

### الاهتمام الوهمية

الاهتمام القياسي:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

ثلاث رحلات ذهاب وإياب HBM. على H100، HBM عرض النطاق هو 3 TB / ثانية؛ SRAM هو 30 TB / ثانية. كل رحلة HBM هو عامل 10 تباطؤ مقابل الحفاظ على كل شيء على رقاقة.

انتباه فلاش:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

رحلة واحدة من HBM لكل طوب$O(N^2)$إلى$O(N)$. الحسابات الخلفية تعيد حساب بعض القيم من الحسابات الأمامية بدلا من تخزينها

**Numerical trick.**تدريب softmax يحافظ على `(max, sum)`على طول البلاطات حتى يكون التطبيع النهائي دقيقًا. ليس تقريري  تنسيق الانتباه في البصمة يحسب الناتج المتطابق مع الانتباه القياسي (مودول fp16 غير التراجعية).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

فلاش 4 هو التقدم إلى الأمام فقط عند الإطلاق. لا يزال التدريب يستخدم فلاش 3. دعم GQA وvarlen لـ فلاش 4 لا يزال متوقع (في منتصف عام 2026).

### التشفير المضارب  الفوز الآخر التأخير

النموذج الرخيص يقدم N رموز. النموذج الكبير يصدق جميع N بالتوازي. إذا قبلت التحقق من k رموز، دفعت 1 نموذج كبير إلى الأمام لعمليات k. النموذج النموذجي k = 35 على الرمز والنص.

2026 الاختلالات:
- **EAGLE 2 / Medusa.**رؤوس مسودة متكاملة تشارك الحالات الخفية للمحقق. 23× تسريع دون فقدان الجودة.
- **Speculative decoding with draft model.**2×4 تسرع على الأجهزة الاستهلاكية.
- **Lookahead decoding.**إعادة التكرار جاكوبي، لا حاجة إلى نموذج مسودة، مستحيل ولكن مجاني.

### الإفراز المستمر

الإستنتاج الكلاسيكي: إنتظر أن تنتهي أبطأ تسلسل، ثم بدء سلسلة جديدة. يضيع GPU عندما تنتهي ردود الفعل القصيرة مبكرا.

التوصيل المستمر (أول مرة شُرِع في أوركا، والآن في vLLM، TensorRT-LLM، SGLang): تبادل الطلبات الجديدة في اللحظة التي تنتهي فيها الطلبات القديمة. 510 × زيادة التوصيل لحملات العمل المشتركة.

### PagedAttention  KV cache كذاكرة افتراضية

ميزة الرئيسية في vLLM. يتم تخصيص cache KV في كتلة 16 رمزًا. خريطة صفحة تقوم بتخطيط المواقع المنطقية إلى كتلة مادية. يسمح لك بمشاركة KV عبر عينات متوازية (بحث الشعاع ، أخذ عينات متوازية) ، ومساومة التبادل الساخن للتخزين السريع ، وذاكرة التفكيك. تحسن الانتقال 4x على التخصيص المجاور البغيض.

```figure
flash-attention-memory
```

## بناءها

```figure
iso-machine {"machine":"kv-cache"}
```

انظر`code/main.py`نطبق:

1. سذاجة$O(N^2)$مُشفّر إضافي
2. أ$O(N)$كيف-كاشة الكشيف الكشيف
3. -أحد أقصى أساسات التشغيل المُسلّطة التي تحاكي خوارزمية "فلش أوتشن"

### الخطوة الأولى: KV cache

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

بسيط: استمر في النمو لكل مؤشر K، V المتجهات في كل طبقة، كل قائمة رأس.

### الخطوة الثانية: المصفوفة بـ "softmax"

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

الناتج متطابق بـ `softmax(qK) V`في صورة واحدة، ولكن في أي وقت مجموعة العمل هي `tile × d_head`الكتلة، وليس الكاملة`N × d_head`. . .

### الخطوة الثالثة: مقارنة التشفير البديل مقابل التشفير المتخزّن

أعد عمليات الاهتمام. كلا المفكّرين يقومون بنفس المقارنات بين مفتاح الاستفسار: الخطوة `t`يشارك أكثر `t`الوهم، لذلك مجموع 1 + 2 + ... + N = N(N+1)/2. يستخدم الرمز N = 10 ويقوم بطبع 55 لكل مُعبر. بالنسبة لجيل 100 رمز، كل منهما يجعل 5050 مقارنات. الاحتفاظ الاحتفاظ بـ K و V بدون تخزين، كل خطوة تحسب K و V مرة أخرى للحصول على المقبل الكامل، لذلك جيل 100 رمز يحسب 5050 حالة رمز. مع التخزين الآلي، يتم حساب كل رمز K و V مرة واحدة، لذلك نفس الجيل يحسب 100 حالة رمز.

## استخدمها

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

إنتاج الـ vLLM:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

الاحتفاظ بالأمنية المتبقية عبر الطلبات هو فوز كبير 2026  نفس خطوة النظام ، أمثلة قصيرة ، أو وثيقة سياق طويلة تستخدم KV عبر المكالمات. بالنسبة لحملات عمل وكيل مع طلبات أداة متكررة ، فإن احتفاظ الأمنية المتبقية هو بشكل روتيني 5 × زيادة التنفيذ.

## أرسله

انظر`outputs/skill-inference-optimizer.md`. المهارة تختار تنفيذ الاهتمام، استراتيجية KV cache، الكمية، وتفكير المضاربة لنشر استنتاج جديد.

## التمارين

1. **Easy.**أركض`code/main.py`تأكد من أن المكشفات البديلة والمتخزنة في الاحتفاظ بها تنتج نفس الخروج، لاحظ الفرق في العدد الخيار.
2. **Medium.**تنفيذ التخزين الآلي المسبق: مع إعطاء طلب P وعدة إكمالات ، قم بتشغيل مرور واحد إلى الأمام فوق P لملء التخزين الآلي KV ، ثم فرع لكل إكمال. قم بتحديد السرعة مقابل إعادة تشفير P لكل منها.
3. **Hard.**تنفيذ لعبة PagedAttention: KV cache في كتلة ثابتة 16 رمز مع قائمة مجانية. عندما تنتهي تسلسل، أعيد كتلها إلى حوض الاستجمام. محاكاة 1000 إكمال دردشة بطول مختلف. مقارنة تمزيق الذاكرة مقابل التخصيص المتماشى.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## المزيد من القراءة

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) فلاش 1
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) فلاش 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) فلاش 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) خط أنابيب بلاكويل 5 مراحل و خدعة البرمجيات-exp2؛ اقرأ إعادة القراءة للخطط الإطلاق للأمام فقط التي ذكرت هذه الدروس.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180)ورقة "VLLM"
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) تشفير المواصفات
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) ورقة إيغل-1/2 لمنهج مشروع متكامل يذكر في الدروس.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) مقاربة ميدوسا المشار إليها جنبا إلى جنب مع النسر.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) الغوص العميق القنوني على كتلة 16 رمزا وتصميم الجدول الصفحة.
