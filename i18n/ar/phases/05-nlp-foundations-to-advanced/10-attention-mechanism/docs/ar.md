# آلية الاهتمام

> و يبدأ المفكّر في النظر إلى المصدر كله و كلّ شيء بعد ذلك هو الاهتمام بالإضافة إلى الهندسة

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## المشكلة

انتهت الدروس 09 على فشل مقياس. يذهب مُشفّر GRU المُعدّد-مُفكّر مدرب على مهمة نسخة اللعبة من دقة 89٪ على طول 5 إلى تقريبًا على طول 80. السبب هو هيكليّ، وليس خطأ تدريبي: كلّ جزء من المعلومات التي يجمعها المُشفّر يجب أن يتناسب في حالة مخفية ذات حجم ثابت، ولا يرى المُفكّر أيّ شيء آخر.

نشرت Bahdanau ، Cho ، و Bengio تصحيح ثلاث خطوط في عام 2014. بدلاً من إعطاء المفكّر الحالة النهائية فقط للمفكّر ، حافظ على حالة كل مفكّر. في كل خطوة من مراحل المفكّر ، احسب متوسط المفزن من حالات المفكّر حيث يقول الوزن "كم يحتاج المفكّر إلى النظر في وضع المفكّر .`i`هذا المتوسط الموزن هو السياق، ويتغير كل خطوة من عملية القيادة.

هذه هي الفكرة كلها. قام المحولون بتوسيعها. التأثير الذاتي يطبقها على تسلسل واحد. الاهتمام المتعدد الرأس يديرها بالتوازي. ولكن نسخة 2014 كسرت بالفعل ضباب الزجاجة، وبمجرد أن يكون لديك، محور المحولات للمحولات هو الهندسة، وليس المفهوم.

## المفهوم

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

في كل خطوة من عملية تشكيل القيود`t`:

1. استخدم المفكّر السابق في حالة مخفية`s_{t-1}`كـ**query**. . .
2. احصله على كل حالة مخفية`h_1, ..., h_T`-سكانار واحد لكل موقع
3. أضعف النتائج لتحصل على الوزن الاهتمام`α_{t,1}, ..., α_{t,T}`هذا المبلغ إلى 1.
4. متجه السياق`c_t = Σ α_{t,i} * h_i`. متوسط الموزن من حالات المُشفّر
5. القيادة تأخذ`c_t`+ رمز الخروج السابق، ينتج الرمز التالي.

متوسط الموزن هو النقطة. عندما يحتاج المقرر إلى ترجمة "Je" إلى "I"، فإنه يوزن حالة المقرر فوق "Je" عالية والآخرين منخفضة. عندما يحتاج "لا"، فإنه يوزن "pas" عالية. ويكتر السياق يعد شكل كل خطوة.

## الشكل (الشيء الذي يُعض الجميع)

هذا هو المكان الذي يذهب فيه كل تنفيذ الاهتمام بشكل خاطئ في المرة الأولى.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`. . .

- `s_{t-1}`لديه شكل`(d_s,)`،`h_i`لديه شكل`(d_h,)`. . .
- `W_a`لديه شكل`(d_attn, d_s)`. .`U_a`لديه شكل`(d_attn, d_h)`. . .
- مجموعهم داخل الشعر لديه شكل`(d_attn,)`. . .
- `v_α`لديه شكل`(d_attn,)`المنتج الداخلي مع`v_α`ينهار إلى مستوى مستوى.**This is what `v_α` does.**إنها ليست سحرية إنها التنبيه الذي يحول متجه الاهتمام إلى نسبة تراكمية

**Luong (multiplicative) score.**ثلاثة خيارات:

- `dot`: `e_{t,i} = s_t^T * h_i`. يتطلب`d_s == d_h`القيود القاسية، قفز إذا كان جهازك المُشفّر مُتجهًا إلى الاتجاهين.
- `general`: `e_{t,i} = s_t^T * W * h_i`مع`W`الشكل`(d_s, d_h)`. يزيل القيود المتساوية
- `concat`: في الأساس شكل Bahdanau. نادرا ما يستخدم لأن الأولين أرخص.

**One Bahdanau / Luong gotcha worth naming.**Bahdanau يستخدم `s_{t-1}`(حالة المفكّر * قبل * توليد الكلمة الحالية). يستخدم Luong `s_t`(الحالة * بعد *). خلطهم يخلق تراجعات خاطئة بشكل ظريف يصعب تحديدها للغاية.

```figure
attention-heatmap
```

## بناءها

### الخطوة الأولى: الاهتمام بالمزيد (Bahdanau)

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

تحقق من أشكالك مع الطاولة أعلاه`encoder_states`لديه شكل`(T_enc, d_h)`. .`projected_enc`لديه شكل`(T_enc, d_attn)`. .`projected_dec`لديه شكل`(d_attn,)`والبثات`combined`لديه شكل`(T_enc, d_attn)`. .`scores`لديه شكل`(T_enc,)`. .`weights`لديه شكل`(T_enc,)`. .`context`لديه شكل`(d_h,)`أرسلها

### الخطوة الثانية: نقطة لونغ والعامة

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

ثلاث خطات لكل هذا هو سبب وصول ورقة لونغ نفس الدقة في معظم المهام، أقل بكثير من الشفرة

### الخطوة الثالثة: مثال عددي عمل

في حالة ثلاثة حالات مُشفّر (تقريبًا "قطة" و "قمرة" و "مات") وحالة مُشفّر تتوافق مع الأولى، يركز توزيع الاهتمام على الموقف 0. إذا تحولت حالة المُشفّر لتوافق مع الأخير، ينتقل الاهتمام إلى الموقف 2. يتبع متجه السياق.

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

السطر الأول يفوز، ثم نقلب حالة المُشفّر إلى حالة المُشفّر الثالث ومشاهدة تغيير الوزن. هذا هو الأمر. الاهتمام هو التنحي الصريح.

### الخطوة الرابعة: لماذا هذا هو الجسر إلى المحولات

ترجمة اللغة أعلاه إلى Q/K/V:

- **Query**= حالة المُفكّر `s_{t-1}`
- **Key**= حالة المُشفّر (ما نُسجل عليه)
- **Value**= حالة المُرمّد (ما نوزن وجمع)

في الاهتمام الكلاسيكي، المفاتيح والقيم هي نفس الشيء. الاهتمام الذاتي يفصلها: يمكنك استفسار تسلسل ضد نفسه، مع مختلف التنبؤات المتعلقة K و V. الاهتمام متعدد الرأس يعمل على نفس الوقت مع التنبؤات المتعلقة المختلفة. تقوم المحولات بتجميع المرحلة بأكملها عدة مرات وتسقط RNNs.

الرياضيات هي نفسها، الأشكال هي نفسها، والقفز التربوي من اهتمام Bahdanau إلى اهتمام النقطة المنتج على نطاق واسع هو في الغالب العلامة.

## استخدمها

(بيتورش) و (تنسور فلو) يرسلون الإنتباه مباشرة

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

هذه طبقة إنتباه المحولات، مجموعة استفسارات من 5 مواقع، مجموعة مفتاح/قيمة من 10 مواقع، 128 غرار لكل، 8 رؤوس.`output`هو الاستفسارات الجديدة المزودة السياق. `weights`هو 5x10 المصفوفة المصفوفة يمكنك أن تظهر.

### عندما لا يزال الاهتمام الكلاسيكي مهم

- التعليمية، النسخة ذات الرأس الواحد، ذات الطبقة الواحدة، القائمة على RNN تجعل كل مفهوم مرئي.
- مهام تسلسل على الجهاز حيث لا يناسب المحولات.
- أي ورقة من 2014-2017 ستقرأها بشكل خاطئ دون معرفة اتفاقية Bahdanau.
- تحليل التنحية الدقيقة في MT. أوزان الاهتمام الخام هي أداة تفسيرية حتى على نماذج المحولات، وقراءتها تتطلب معرفة ما هي.

### فخ الاهتمام و الوزن كالتفسير

الوزن الاهتمام يبدو تفسير. انها وزن التي تضم إلى واحد عبر المواقع؛ يمكنك رسمها؛ عالية يعني "نظر في هذا". المراجعون يحبونها.

لا يمكن تفسيرها كما تبدو. أظهر جين ووالاس (2019) أن توزيعات الاهتمام يمكن تحويلها واستبدالها بخيارات تعسفية دون تغيير التنبؤات النموذجية لبعض المهام. لا تقرر أبدًا بأوزان الاهتمام كدليل على التفكير دون إزالة أو تحقق معاد.

## أرسله

إبقوا`outputs/prompt-attention-shapes.md`:

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## التمارين

1. **Easy.**تنفيذ`softmax`اختبار على مجموعة مع تسلسلات طول متغير.
2. **Medium.**إضافة الاهتمام متعدد الرؤوس إلى لونغ `general`شكل. تقسيم `d_h`في`n_heads`مجموعة، إشغال الاهتمام لكل رأس، إشغال المجموعة، تأكد من أن قضية رأس واحد تتطابق مع تنفيذك السابق.
3. **Hard.**قم بتدريب جهاز تشفير-تشفير GRU مع اهتمام Bahdanau على مهمة نسخ اللعبة من الدروس 09. دقة اللقطة مقابل طول التسلسل. مقارنة مع خط الأساس من عدم الاهتمام. يجب أن ترى الفجوة توسع مع نمو الطول، مؤكدة الاهتمام يرفع عنق الزجاجة.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## المزيد من القراءة

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)-الورقة
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) ثلاثة فترات النتيجة ومقارنتها.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) تحذير التفسير
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) ممر قابل للجري مع PyTorch.
