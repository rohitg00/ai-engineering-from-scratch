# GPT  نمذجة لغة السببية

> برت يرى كلا الجانبين، جبت يرى الماضي فقط، قناع المثلث هو خط واحد من الشفرة الأكثر أهمية في الذكاء الاصطناعي الحديث.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## المشكلة

نموذج اللغة يجيب على سؤال واحد: بالنظر إلى الأول `t-1`الوهم، ما هو توزيع الاحتمال على الوهم`t`تدريب على هذه الإشارة  التنبؤ بالتوقيت التالي  وتحصل على نموذج يمكن أن تولد نص تعسفي رمز واحد في كل مرة.

لتدريبها من نهاية إلى نهاية على تسلسل كامل بالتوازي، تحتاج إلى تنبؤ كل موقف يعتمد فقط على المواقع السابقة. وإلا فإن النموذج يخدع بشكل طفيف من خلال النظر إلى الإجابة.

القناع السببي يفعل هذا. إنه ماتريكس ثلاثية أعلى واحدة من`-inf`قيم إضافية إلى نقاط الاهتمام قبل softmax. بعد softmax، تصبح تلك المواقع 0. كل موقف يمكن أن يلتحق فقط لنفسه والمواقع السابقة. ولأن تطبيقها مرة واحدة على التسلسل كله، تحصل على N متوازية التنبؤات التوقيت التالي في واحد تقدم.

GPT-1 (2018) ، GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), كلود، لاما، قوان، ميسرال، ديب سيك، كيمي  جميعها محولات سببية لمعرفة الكمبيوتر فقط مع نفس الحلقة الأساسية. ما يفصل بينها هو جودة البيانات والتنقية في النطاق والهندسة المعمارية، وبعد التدريب (SFT، RLHF، DPO، وخلفائهم).

## المفهوم

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### القناع

نظراً لسلسلة من الطول$N$، بناء$N \times N$المصفوفة:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

إضافة`M`إلى درجات الاهتمام الخام قبل softmax. $\exp(-\infty) = 0$كل صف من المصفوفة الاهتمام هي توزيع الاحتمالات على المواقع السابقة فقط.

تكلفة التنفيذ: واحد `torch.tril()`وقت الحساب: نانو ثانية تأثير على الميدان: كل شيء

### من أين تأتي المثلث

عادة ما يتم عرض القناع كشلاء مقبض على الاهتمام. قم بتشغيل الاستنتج في الاتجاه الآخر ويتوقف عن أن يكون غامضًا: الاهتمام هو التطور الثالث للمستقبل المتوسط ، والثلاثي هو حدود الحلقة من ذلك المتوسط ، مكتوبة كمصفوفة.

**Stage 1 — prefix average.**أهم خلاصة سببية من التسلسل: الموقف$i$يصبح متوسط المواقف$0 \ldots i$كحلقة، هذا هو`out[i] = X[:i+1].mean(0)`نفس الحساب هو مضاعفة المصفوفة واحدة. خذ المصفوفة الثلاثية السفلية من الأعداد، وقسم كل سطر بحسب عددها، مضاعفة:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

الصف $i$من$A$هو$[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$الصفر فوق المقاطع هي السببية لم يتم إخفاء أي شيء عن المستقبل، لم يكن المستقبل في المجموع.

**Stage 2 — learned weights.**متوسط متساوي يعامل كل رمز سابق على قدم المساواة. استبدل تلك مع ماتريكس النتيجة المتعلمة`S`. الآن الصفوف لم تعد تعد مجموعة إلى واحد من خلال البناء ، لذلك قم بتطبيع كل سطر مع softmax بدلاً من تقسيمها بالعد. softmax لا ينتج أبداً صفرًا دقيقًا ، مما يكسر الصلة العاملة  ما لم تذهب النتائج المستقبلية إلى `-inf`، لأن`exp(-inf) = 0`:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

نفس المثلث، نفس المصفوفة الصفوية، نفس المثالي.`-inf`ماسك ليس آلة جديدة. إنه إدخال صفر للمرحلة الأولى، مترجم إلى مجال المدخلات لـ softmax.

**Stage 3 — content-dependent weights.**في المرحلة الثانية`S`يتم تحديد النقاط بعد التدريب: وضع 7 دائما يزن وضع 3 نفسه، مهما قال الرموز. دع النقاط تعتمد على الرموز نفسها: `S = Q @ K.T / sqrt(d_k)`لا شيء آخر يتغير قناع، ومدينة، ومتمول متطابق

ثلاث مراحل، واحدة غير متغيرة: صف أسفل مثلث المصفوفة المثبتة ضرب التسلسل. المتوسط الموحد، الوزن ثابتة تعلمت، الوزن يعتمد على المحتوى. القناع لم يضاف أبدا إلى الاهتمام.

```figure
mask-derivation
```

### التدريب المتوازي، الإستنتاج المتسلسل

التدريب: إعادة التدريب`(N, d_model)`التسلسل مرة واحدة، حساب N خسائر الانتروبيا المتقاطعة (واحد لكل موقف) ، المجموع، backprop. متوازية على طول التسلسل. هذا هو السبب في أن مقياس تدريب GPT  يمكنك معالجة 1M رموز في مجموعة في مرسل واحد GPU.

الإستنتاج: أنت تولد رمز بثمن.`[t1, t2, t3]`، الحصول على`t4`.`[t1, t2, t3, t4]`، الحصول على`t5`.`[t1, t2, t3, t4, t5]`، الحصول على`t6`. الـ KV cache (الدرس 12) يحفظ الحالات الخفية من`t1…tn`لذا لا تقوم بإعادة حسابها في كل خطوة. ولكن العمق التسلسلي عند الاستنتاج = طول الخروج. هذا هو الضريبة السريعة و لماذا فك التشفير هو عقد الزجاجة التأخير في كل LLM.

### الخسارة  التحول واحد

أوراق إشارة`[t1, t2, t3, t4]`:

- المدخل: `[t1, t2, t3]`
- الأهداف:`[t2, t3, t4]`

لكل منصب`i`، الحساب`-log P(target_i | inputs[:i+1])`هذا هو التقاطع للترتيب بأكمله

كل محول لعبة (إل إن إم) سمعت عنهم في هذه الخسارة التدريب المسبق، التنسيق الدقيق،

### استراتيجيات فك الكشف

بعد التدريب، اختيار العينات مهم أكثر مما يعتقد الناس.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

في عام 2026، من-p + درجة حرارة 0.7 هي افتراض معقول لنماذج الوزن المفتوحة.

### ما الذي جعل "وصفة GPT" تعمل

1. **Decoder-only.**لا يوجد مبرمجة فوق الصفحة، واحد من الانتباه + FFN لكل طبقة
2. **Scaling.**124M → 1.5B → 175B → تريليونات. قوانين تشينشيللا للتوسع (الدرس 13) تخبرك كيفية إنفاق الحوسبة.
3. **In-context learning.**ظهر حوالي 6B13B. يمكن أن يتبع النموذج أمثلة قليلة دون ضبط دقيقة.
4. **RLHF.**بعد التدريب على تفضيلات الإنسان حول النص الخام المسبق للتدريب إلى مساعدي الدردشة.
5. **Pre-norm + RoPE + SwiGLU.**تدريب مستقر على نطاق واسع

بنية الأساس لم تتغير كثيرا منذ GPT-2 كل شيء مثير للاهتمام حدث في البيانات، والتنمية، وبعد التدريب.

```figure
causal-mask
```

## بناءها

### الخطوة الأولى: قناع السبب

انظر`code/main.py`- خط واحد:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

أضفها إلى درجات الاهتمام قبل "سوف ماكس" هذه هي الآلية بأكملها

### الخطوة الثانية: نموذج GPT ذو 2 طبقات

قم بتجميع بلوكين للكشف (توهم الذاتي المخفي + FFN ، لا توجد اهتمام متقاطع). أضف إضافة رمزية ، وتشفير موضعي ، وقطع (مرتبطة بمصفوفة إضافة رمزية  خدعة قياسية منذ GPT-2).

### الخطوة الثالثة: التنبؤ بالرمز التالي، من نهاية إلى نهاية

على لغة لعبة 20 رمز، قم بتحليل كل موقف. احسب خسارة الانتروبيا المتقاطعة ضد الهدف التحول واحد. لا تراجيع  هذا هو فحص الصحة العقلية إلى الأمام.

### الخطوة الرابعة: أخذ العينات

قم بتنفيذ طموح، درجة الحرارة، أعلى-ك، أعلى-ب، min-ب. قم بتشغيل كل واحد على طلب ثابت ومقارنة الخروج. وظيفة أخذ العينات هي 10 خطوط.

## استخدمها

(بيتورش) ، 2026

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

تحت القبو`generate()`يقوم بتشغيل المخطط الأمامي ، ويسحب علامات الموقف النهائي ، ويأخذ عينات من الرمز التالي ، ويضيفها ، ويكرر. كل كومة استنتاج LLM الإنتاجية (vLLM ، TensorRT-LLM ، llama.cpp ، Ollama ، MLX) تنفذ نفس الحلقة مع تحسين ثقيل  prefill المكونة ، الإعداد المستمر ، KV cache paging ، فك التخمين المضاربة.

**GPT vs BERT, one line each:**توقعات GPT $P(x_t \mid x_{<t})$. برت يتوقع$P(x_{\text{masked}} \mid x_{\text{unmasked}})$الخسارة تحدد ما إذا كان النموذج يمكن أن تولد.

## أرسله

انظر`outputs/skill-sampling-tuner.md`. تحصل المهارة على معايير أخذ العينات لمهمة جيل جديد وتعلم عندما يكون هناك حاجة إلى فك التشخيص المحدد.

## التمارين

1. **Easy.**أركض`code/main.py`والتحقق من أن ماتريكس الاهتمام السببية هي مثلثية أدناه بعد softmax. التحقق من البقع: يجب أن يكون للصف 3 وزنه فقط في الأعمدة 03.
2. **Medium.**قم بتنفيذ بحث الشعاع عن الاحجام 4. مقارنة معقدة الشعاع 4 مقابل الفطري على 10 طلبات قصيرة. هل الشعاع دائما يفوز؟ (تلميح: عادةً للتحويل ، وليس للردشة المفتوحة).
3. **Hard.**تنفيذ فك التشفير المضاربة: استخدم نموذج صغير من 2 طبقات كمسودة ونموذج من 6 طبقات كمتحقق. قياس السرعة في ساعة الجدار على 100 اكتمال من الطول 64.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## المزيد من القراءة

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) GPT-1.
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) GPT-2
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) GPT-3 والتعلم في السياق
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192)ورقة تشخيص المواصفات
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) رمز مرجعية القائمة على السبب-LM.
