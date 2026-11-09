# مزيج من الخبراء (ميزة)

> محول 70B كثيف ينشط كل معايير لكل رمز. 671B MoE ينشط 37B فقط لكل رمز ويضربه على كل مقياس.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## المشكلة

فلوفات محولات كثيفة عند الاستنتاج يساوي عدد المعايير (مرة 2 للخطوة الأمامية). قم بتقييم نموذج كثيف وتدفع كل رمز كامل الفاتورة. بحلول عام 2024 كان الحدود تضرب جدار الحساب: لتكون أكثر ذكاءً ، كنت بحاجة إلى المزيد من فلوفات لكل رمز.

خليط الخبراء يقطع هذا الرابط.$E$خبراء مستقلين + جهاز توجيه يختار$k$خبراء لكل رمز. مجموع المعايير = $E \times \text{FFN size}$. المعلمات النشطة لكل رمز = $k \times \text{FFN size}$. تشكيل عام 2026: $E=256$،$k=8$. مقياسات تخزين مع$E$، حساب مقياس مع $k$. . .

الحدود 2026 هي تقريبا تماما MoE: DeepSeek-V3 (671B إجمالي / 37B نشط) ، Mixtral 8×22B ، Qwen2.5-MoE ، Llama 4 ، Kimi K2 ، gpt-oss. على قائمة تحليل الاصطناعي المستقلة ، أفضل 10 نماذج مفتوحة المصدر هي جميعًا MoE.

## المفهوم

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### تبادل FFN

كتلة محول كثيفة:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

حظر المياه

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

كل خبير هو FFN مستقل (عادة SwiGLU). الجهاز التوجيهي هو طبقة خطية واحدة. كل رمز يختار نفسه `k`ويحصل على مزيج مغلق من نتائجهم.

### مشكلة توازن الحمل

إذا قام الجهاز بتسجيل 90% من الرموز عبر الخبير 3 ، فإن الخبراء الآخرين يضيعون

1. **Auxiliary load-balancing loss**إضافة عقوبة متناسبة مع التباين في استخدام الخبراء يعمل، ولكن يضيف مُعدل فائض و إشارة تراجعة ثانية.
2. **Expert capacity + token dropping**كل معالج عمل على الأكثر$C \times N/E$الوهم، الوهم المفرط يخطو الطبقة، يؤذي الجودة.
3. **Auxiliary-loss-free balancing**(DeepSeek-V3). إضافة تحيز تعلم لكل خبير الذي يغير اختيار الموجّه أعلى-ك. يتم تحديث التحيز خارج خسارة التدريب. لا جريمة على الهدف الرئيسي. فتح كبير 2024.

نهج DeepSeek-V3: بعد كل خطوة تدريبية، لكل خبير، تحقق ما إذا كان استخدامها فوق الهدف أو أقل منه.`±γ`. استخدامات اختيار`scores + bias`الاحتمالات الخبيرة المستخدمة في إغلاق البوابات هي الخام`scores`غير متغيرة، تفصل التوجيه عن التعبير

### خبراء مشتركون

تقسم DeepSeek-V2/V3 الخبراء أيضًا إلى * مشاركة * و * توجيه. تمر كل رمز عبر جميع الخبراء المشتركين. يتم اختيار الخبراء المشتركين من خلال top-k. يتم التقاط الخبراء المشتركين من المعرفة العامة. يتخصص الخبراء المشتركون. يتم تشغيل V3 بمشاركة الخبير 1 بالإضافة إلى 8 من 256 توجيه.

### خبراء في الحيوانات

كلاسيكية (GShard، Switch): كل خبير واسع مثل FFN كامل. `E`صغيرة (864) ، `k`هو صغير (12).

الحديثات الحميدة الحمقى (DeepSeek-V3، Qwen-MoE): كل خبير أصغر (1/8 حجم FFN). $E$هو كبير (256+) ، $k$أكبر (8+) نفس مجموع المعايير، ولكن الجمعيات تتحرك بسرعة أكبر. $\binom{256}{8} \approx 400$تريليون "خبراء" محتملين لكل رمز، الجودة ترتفع، وتبقى التأخير ثابتة.

### ملف التكلفة

لكل رمز، لكل طبقة:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

ديب سيك-ف3 يضرب Llama 3 70B (كثيفة) على كل مقياس تقريباً أثناء القيام بذلك**fewer active FLOPs per token**. المزيد من المعايير = المزيد من المعرفة. أكثر فعالية FLOPs = أكثر حسابات لكل رمز.

### الصيد: الذاكرة

جميع الخبراء يعيشون على GPU بغض النظر عن أي واحد يطلق. تحتاج نموذج 671B إلى ~ 1.3 TB من VRAM لوزن fp16.

```figure
expert-routing
```

## بناءها

انظر`code/main.py`طبقة موكسيومة صغيرة من الصفراء النقية مع:

- `n_experts=8`خبراء في المجموعة المتحركة (حجمهم خطي واحد، للإشارة)
- التوجيه العلوي k=2
- أوزان المفاتيح المعتادة لـ softmax
- التوازن الخالي من الخسائر المساعدة عبر التحيز لكل خبير

`code/main.rs`هو منفذ Rust مع نفس الوظائف والإثباتات. يستخدم فقط المكتبة القياسية. الأرقام العشوائية تختلف عن Python، ولكن الاستنتاجات المطبوعة هي نفسها.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### الخطوة الأولى: جهاز التوجيه

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

التشوه يؤثر على الاختيار، وليس وزن البوابة. هذا هو خدعة DeepSeek-V3  التشوه تصحيح عدم توازن الحمل دون توجيه توقعات النموذج.

### الخطوة الثانية: تشغيل 100 رمز عبر جهاز التوجيه

تتبع ماهية خبراء النار كم مرة. بدون التحيز، الاستخدام منحرف. مع حلقة تحديث التحيز (`-γ`لخبراء يستخدمونها بشكل مفرط`+γ`(بالإضافة إلى استخدامات غير مستخدمة) ، يتقارب الاستخدام إلى توزيع موحد على مدى عدة تكرارات.

### الخطوة 3: مقارنة عدد المعلمات

طبع "موازي الكثافة" من إعداد MoE. DeepSeek-V3-شكل: 256 توجيه + 1 مشاركة، 8 نشطة، d_model=7168. إجمالي عدد المعايير هو عيون. العدد النشط هو سبعة من كثافة Llama 3 70B.

## استخدمها

تحميل المظهر

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 استنتاج الإنتاج: vLLM تدعم توجيه MoE بشكل طبيعي. SGLang لديه أسرع مسار متوازي خبير. كلا يتعاملان تلقائيًا مع اختيار top-k وموازي الخبراء.

**When to pick MoE:**
- تريد جودة الحدود بتكلفة أقل من التخمين لكل رمز
- لديك البنية التحتية الموازية لـ VRAM / الخبراء
- عبء عملك ثقيل من الشيكات (المحادثة، الرموز) وليس ثقيل من السياق (وثائق طويلة).

**When NOT to pick MoE:**
- نشر الحافة  تدفع تكاليف التخزين الكامل لأي FLOP نشط.
- خدمة مستخدم واحد مهمة للثبات  توجيه الخبراء يضيف التكلفة العامة.
- النماذج الصغيرة (<7B)  ميزة الجودة في MoE تظهر فقط فوق عتبة الحساب (~ 6B أجزاء نشطة).

## أرسله

انظر`outputs/skill-moe-configurator.md`. تختار المهارة إيه، ك، ومشاركة الخبراء لتخطيط لوزارة التنمية الجديدة مع إعطاء ميزانية المعلمات، ورمز التدريب، والهدف التنفيذ.

## التمارين

1. **Easy.**أركض`code/main.py`شاهد كيف تحديث التحيز الخالي من الخسائر المساعدة يُساوى استخدام الخبراء أكثر من 50 تكرار
2. **Medium.**استبدل جهاز التوجيه المعلم بالجهاز التوجيه المستند إلى الهاش (الحدد، لا تعلم). مقارنة الجودة والتوازن. لماذا هو جهاز التوجيه المعلم أفضل؟
3. **Hard.**تنفيذ "التوجيه المماثل للتزويج" (ممارسة DeepSeek-V3.2): سجل ما يطلقه الخبراء أثناء الاستنتاج، وإجبار نفس التوجيه أثناء حساب التراجع. قياس التأثير على إعداد سياسة لعبة-تراجع.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## المزيد من القراءة

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538)الفكرة
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961)-التبديل، كلاسيكي
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) مخلوط 8 × 7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) MLA + MoE + MTP بدون خسائر مساعدة.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664)ورقة التوازن القائمة على التحيز
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) المختبر المشترك المشترك المشترك المشترك المشترك المشترك المشترك المشترك
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) ورقة خبراء مشتركة أصلية.
