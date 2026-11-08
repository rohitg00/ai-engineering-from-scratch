# الاستقرار الرقمي

> نقطة العبور هي مجرد تجريئة لا تسرب، ستقوم بتعضيك أثناء التدريب، ولن تلاحظها

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## أهداف التعلم

- تنفيذ softmax مستقرة عدديًا و log-sum-exp باستخدام خدعة الحد الأقصى
- تحديد التدفقات الزائدة، التدفقات السيئة، والإلغاء الكارثي في حسابات النقاط المتحركة
- التحقق من التدرج التحليلي مقابل التدرج الرقمي باستخدام الاختلافات المحدودة المركزية
- شرح لماذا يفضل bfloat16 على float16 للتدريب وكيف يمنع تحديد حجم الخسائر انخفاض تدفق التدفق

## المشكلة

تمتد النموذج لمدة ثلاث ساعات، ثم يصبح الخسارة NaN. تضيف بيان مطبوع. التسجيلات جيدة في الخطوة 9.000. في الخطوة 9.001 هم`inf`. من خلال خطوة 9 002 كل تراجع هو`nan`و التدريب ميت

أو: نموذجك يتجه إلى الانتهاء ولكن دقة هو 2% أسوأ من المطالبة الورقية. تفحص كل شيء. التطابق الهندسة المعمارية. المعلمات المرتفعة مطابقة. المعلومات تتطابق. المشكلة هي أن الورق استخدم float32 وأنت استخدم float16 دون التوسع الصحيح. 32 قطعة من التراكم التراكم التراكمية أكلت دقةك بهدوء.

أو: تقوم بتنفيذ خسارة الانتروبيا المتقاطعة من الصفر. يعمل على علامات صغيرة. عندما تتجاوز علامات 100، فإنه يعود`inf`لقد تجاوزت القوة الناعمة لأن`exp(100)`كل إطار ML يتعامل مع هذه مع خدعة خطين. لم تكن تعرف خدعة وجود.

الاستقرار الرقمي ليس من المشكلة النظرية. إنه الفرق بين عملية تدريب ناجحة وتفشل بصمت. كل خطأ ML خطير سوف تحل في نهاية المطاف إلى نقطة عائمة.

## المفهوم

### IEEE 754: كيف تخزين الحواسيب الأرقام الحقيقية

تخزين أجهزة الكمبيوتر الأرقام الحقيقية كمقيمات نقطة عائمة تتبع معيار IEEE 754. يحتوي العائمة على ثلاثة أجزاء: بيت إشارة، ومعبر، ومانتيسا (مهمة).

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

يحدد المنتيسا الدقة (كم عدد أرقام مهمة). يحدد المُعبر النطاق (كم عدد كبير أو صغير يمكن أن يكون).

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

فلوات32 يعطيك حوالي 7 أرقام عشرية من الدقة. وهذا يعني أنه يمكن أن تفصل بين 1.0000001 و 1.0000002, ولكن ليس 1.00000001 و 1.00000002. بعد 7 أرقام، كل شيء هو ضجيج مستديرة.

يقدم لك float16 حوالي 3 أرقام. أكبر عدد يمكن أن يمثل هو 65,504. وهذا صغير بشكل مثير للقلق بالنسبة لـ ML حيث تتجاوز التنقلات والتحركات والتنشيطات هذا بشكل روتيني.

bfloat16 هو إجابة جوجل لمشكلة النطاق في float16. لديها نفس المعبرة 8-bit مثل float32 (المجموعة نفسها ، تصل إلى 3.4e38) ولكن 7 بتات mantissa فقط (أقل دقة من float16).

### لماذا 0.1 + 0.2 ! = 0.3

لا يمكن تمثيل الرقم 0.1 بالضبط في نقطة عائمة ثنائية. في القاعدة 2 ، هو جزء متكرر:

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

يختصر Float32 هذا إلى 23 بت من mantissa. القيمة المخزنة هي حوالي 0.100000001490116. وبالمثل، يتم تخزين 0.2 على أنها حوالي 0.200000002980232. مجموعها هو 0.300000004470348 ، وليس 0.3.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

هذا مهم بالنسبة لـ ML لأن:

1. مقارنات الخسارة مثل`if loss < threshold`يمكن أن تعطى إجابات خاطئة
2. تراكم العديد من القيم الصغيرة (تحديثات تدريجية على مدى آلاف الخطوات) تتحرك عن المبلغ الحقيقي
3. الفحوصات والاختبارات التكرارية تفشل إذا قارنت العائدات مع `==`

الحل: لا تقارن السلاحين مع`==`استخدم`abs(a - b) < epsilon`أو`math.isclose()`. . .

### إلغاء كارثي

عندما تقوم بإسقاط رقمين متطوفين تقريباً متساوين، يتم إلغاء الأرقام المهمة ويتم تركك مع ضجيج التجويب الذي يتم تعزيزه إلى أرقام أوائل.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

هذا هو خطأ نسبي 19% من خصم واحد. في ML، يحدث هذا كلما كنت:

- الحساب المتباينات من البيانات مع متوسط كبير: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$متى$\mathbb{E}[x]$كبيرة
- إزالة احتمالات التسجيل المتساوية تقريباً
- احسب تراجع الفرق المحدودة مع إيبسيلون صغير جدا

الإصلاح: إعادة ترتيب الصيغ لتجنب خصم أعداد كبيرة، متساوية تقريبا. للفوارانس، استخدم خوارزمية ويلفورد أو مركز البيانات أولا. للوج-احتمالات، العمل في المجال المكتبية في جميع أنحاء.

### التدفقات الزائدة والتدفقات السيئة

يحدث التدفق الزائد عندما يكون النتيجة كبيرة جداً للاستعراض. يحدث التدفق السفلي عندما يكون صغير جداً (أقرب إلى الصفر من أصغر عدد إيجابي قابل للتمثيل).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

- نعم`exp()`الميزة هي المصدر الرئيسي للانتفاضة في ML:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

- نعم`log()`الموقف يصل إلى الاتجاه الآخر:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

في اللغة الإنجليزية`exp()`يظهر في softmax، sigmoid، والحسابات الاحتمالية. `log()`يظهر في الإنتروبي المتقاطع، وفرق المرجحات، واختلاف KL.`log(exp(x))`هو حقل ألغام بدون الحيل الصحيحة.

### خدعة التسجيلات

الحوسبة`log(sum(exp(x_i)))`هذا أمر خطير عدديًا`x_i`كبيرة`exp(x_i)`إن كان كلّها`x_i`سلبية جداً، كل`exp(x_i)`التدفقات إلى الصفر و`log(0)`هو`-inf`. . .

الخدعة: خصم القيمة القصوى قبل أن تعبر.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

لماذا هذا يعمل: بعد الحد `max(x)`، أكبر مؤشر هو`exp(0) = 1`لا يمكن تجاوزها. على الأقل تعبير واحد في الجملة هو 1، لذلك الجملة هي على الأقل 1، و`log(1) = 0`لا تدفق إلى`-inf`هو ممكن.

دليل:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

المجموعة`c = max(x)`ويتم القضاء على الزحام

هذه الحيلة تظهر في كل مكان في ML:
- التطبيع المضمن
- الحسابات المتعددة للخسائر المتعددة
- جمع احتمالات السجل في نماذج التسلسل
- خليط من غوسيان
- استنتاجات التباين

### لماذا تحتاج Softmax إلى خدعة Max- Subtraction

Softmax تحويل المواقع إلى احتمالات:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

بدون الحيلة، تسبب التسجيلات من [100، 101, 102] التجاوز:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

مع الحيلة، خصم ماكس ((x) = 102:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

الاحتمالات هي نفسها الحساب آمن هذا ليس تحسيناً إنه شرط للصواب

### الناتج الناتج والإف: الكشف والوقاية

`nan`(ليس عددا) و `inf`(اللامتناهي) ينتشر فيروسياً من خلال الحسابات`nan`في تحديث التراجع يجعله الوزن`nan`، الذي يجعل كل الناتج اللاحق `nan`التدريب ميت في غضون خطوة واحدة

كيف`inf`يظهر:
- `exp()`من عدد إيجابي كبير
- التقسيم بـ 0: `1.0 / 0.0`
- `float32`التجاوز في التراكمات

كيف`nan`يظهر:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`من رقم سلبي
- `log()`من رقم سلبي
- أي حسابات تتضمن وجود`nan`

الكشف عن:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

استراتيجيات الوقاية:

1. مدخلات المقبضات إلى `exp()`: `exp(clamp(x, -80, 80))`
2. إضافة الـ epsilon إلى المعادلة: `x / (y + 1e-8)`
3. إضافة إيبسيلون داخل `log()`: `log(x + 1e-8)`
4. استخدام تنفيذات مستقرة (الدوغ-جميع-exp، مستقر softmax)
5. قطع الدرجة لمنع انفجار الوزن
6. تحقق من`nan`-أجل`inf`بعد كل مرور إلى الأمام أثناء إعداد التحليلات

### التحقق من الدرجات العددية

يمكن أن يكون لدى التدرج التحليلي (من التنشر الخلفي) أخطاء. يحققها التحقق الرقمي من التدرج عن طريق حساب التدرج مع اختلافات محدودة.

صيغة الفرق المركزية:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

هذا هو$O(h^2)$دقيق، أفضل بكثير من الفرق إلى الأمام $(f(x+h) - f(x)) / h$الذي هو فقط $O(h)$. . .

الاختيار$h$: كبيرة جداً و التقريب خاطئ. التخليص الصغير جداً و الكارثة يدمّر الإجابة. `h = 1e-5`إلى`1e-7`هو نموذجي

التحقق: حساب الفرق النسبي بين التراجع التحليلي والرقمي.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

قواعد الإبهام:
- relative_error < 1e-7: مثالية، التراجع هو صحيح
- relative_error < 1e-5: مقبول، ربما صحيح
- relative_error > 1e-3: شيء خاطئ
- relative_error > 1: التراجع خاطئ تماما

دائماً تحقق من التراجع عند تنفيذ طبقة جديدة أو وظيفة الخسارة.`torch.autograd.gradcheck()`لهذا السبب

### تدريبات دقيقة مختلطة

يحتوي أجهزة GPU الحديثة على أجهزة متخصصة (Cores Tensor) تقوم بحساب مضاعفات المصفوفة float16 2-8x أسرع من float32.

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

المشكلة مع تدريب الطائرة الطاهرة: غالباً ما تكون التدرجات صغيرة جداً (1e-8 أو أقل). تتدفق الطائرة الطائرة الطائرة الطائرة أي شيء أقل من ~ 6e-8 إلى الصفر. يتوقف نموذجك عن التعلم لأن جميع تحديثات التدرجات هي الصفر.

الحل هو تحديد حجم الخسارة:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

يعدل مقياس الخسارة الديناميكي عامل المقياس تلقائيًا. تبدأ بقيمة كبيرة (65536). إذا تجاوز التدفقات إلى `inf`، نصفها$N$الخطوات تمر دون إفراط، مضاعفة.

### (bfloat16 vs float16: لماذا (bfloat16) يفوز بالتدريب

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

يحتوي جهاز float16 على دقة أكبر (10 بت من mantissa مقابل 7) ولكن نطاقه محدود (أقصى حد ~65,504).

للتدريب على الشبكات العصبية:

- يتم تنشيط وتسجيلات بشكل منتظم أكثر من 65504 خلال أعلى مستويات التدريب.
- يُطلب قياس الخسارة مع float16 ولكن عادة ما يكون غير ضروري مع bfloat16 لأن نطاقها يغطي طيف الكبيرة التدريجية.
- bfloat16 هو قص بسيط من float32: إسقط 16 بت أسفل من mantissa. التحويل بسيط وغير ضائع في العامل.

يفضل float16 للتخمين حيث تكون القيم محدودة والدقة مهمة أكثر. bfloat16 يفضل للتدريب حيث يكون المدى مهمًا أكثر. لهذا السبب تتميز TPUs و GPUs NVIDIA الحديثة (A100، H100) بدعم bfloat16 الأصلي.

### التقطيع المتدريج

يحدث التدفقات المتفجرة عندما تنمو التدفقات بشكل متسارع عبر العديد من الطبقات (شائعة في RNNs والشبكات العميقة والتحولات). يمكن أن يفسد التدفقات الكبيرة الوحيدة جميع الوزن في خطوة واحدة.

نوعان من التقطيع:

**Clip by value:**ضغط كل عنصر تراجع بشكل مستقل.

```
grad = clamp(grad, -max_val, max_val)
```

بسيط ولكن يمكن أن تغير اتجاه متجه التراجع.

**Clip by norm:**يُقَدِّمُ نطاق متجه التدريج بأكمله بحيث لا يتجاوز معايره عتبة.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

يحافظ على اتجاه التراجع هذا ما`torch.nn.utils.clip_grad_norm_()`نعم، إنه الخيار القياسي

القيم النموذجية: `max_norm=1.0`لتحولات، `max_norm=0.5`لـ RL`max_norm=5.0`للشبكات الأسهل

إنّ قطع المعدلات ليس هيكًا، بل هو آلية سلامة، وبدونها، يمكن أن تنتج مجموعة واحدة من المعدلات المعدلة مدى كبيرًا بما يكفي لتفسد أسابيع من التدريب.

### طبقات التطبيع كمتثباتات عددية

عادة ما يتم عرض تطبيع المجموعات، وتطبيع الطبقات، وتطبيع RMS كمتساعدين على التقارب في التدريب. هم أيضاً استقرارات عددية.

بدون التطبيع، يمكن أن تنمو أو تقلص التفعيلات بشكل متكامل عبر الطبقات:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

التطبيع والتحديثات وإعادة تنشيطات في كل طبقة:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

- نعم`epsilon`(عادة 1e-5) يمنع الانقسام عن طريق الصفر عندما تكون جميع التفعيلات متطابقة.`gamma`و`beta`دع الشبكة تعيد أي نطاق يحتاجه.

هذا يحافظ على القيم في نطاق آمن عدديًا في جميع أنحاء الشبكة، مما يمنع كل من الإفراط في الممر الأمامي والانفجار في التراجع في الممر الخلفي.

### الأخطاء العددية الشائعة في ML

**Bug: Loss is NaN after a few epochs.**
السبب: التسجيلات أصبحت كبيرة جداً، ومدفوعة الغالبية المفرطة، أو معدل التعلم مرتفع جداً ويتباين الوزن.
الإصلاح: استخدام softmax مستقر (سحب أقصى) ، وتقليل معدل التعلم، وإضافة تراجع التراجع.

**Bug: Loss is stuck at log(num_classes).**
السبب: إنّ نتائج النموذج هي احتمالات متساوية تقريباً، وغالباً ما تعني أنّ التراجعات تختفي أو أنّ النموذج لا يتعلم على الإطلاق.
إصلاح: تحقق من صحة علامات البيانات، التحقق من وظيفة الخسارة، التحقق من الميتة RELU.

**Bug: Validation accuracy is lower than expected by 1-3%.**
السبب: دقة مختلطة دون قياس ضياع مناسب. تدفق التدفق التدريجي يُبعد صامتًا تحديثات صغيرة.
إصلاح: تمكين تحليل الخسائر الديناميكية، أو الانتقال إلى bfloat16.

**Bug: Gradient norms are 0.0 for some layers.**
السبب: الخلايا العصبية الميتة لـ ReLU (كل المدخلات سلبية) ، أو التدفق القادم.
الإصلاح: استخدم LeakyReLU أو GELU، استخدم تراكم التراجع، تحقق من تشغيل الوزن.

**Bug: Model works on one GPU but gives different results on another.**
السبب: ترتيب تراكم نقطة عائمة غير محدد. تخفيضات GPU متوازية جمع في ترتيبات مختلفة على أجهزة مختلفة، وتضافة نقطة عائمة ليست ارتباطية.
الإصلاح: تقبل الاختلافات الصغيرة (1e-6) ، أو تعيين `torch.use_deterministic_algorithms(True)`و تقبل عقوبة السرعة

**Bug: `exp()` returns `inf` in loss computation.**
السبب: تم نقل اللوجات الخامة إلى`exp()`بدون خدعة الحد الأقصى
إصلاح: استخدام `torch.nn.functional.log_softmax()`الذي يطبق التسجيلات المجموعة-exp داخليا.

**Bug: Training diverges after switching from float32 to float16.**
السبب: لا يمكن أن يمثل float16 مقياسات تراجعية أقل من 6e-8 أو تنشيطات أعلى من 65,504.
الإصلاح: استخدم الدقة المختلطة مع قياس الخسائر (AMP) ، أو استخدم bfloat16 بدلاً من ذلك.

```figure
logsumexp-stability
```

## بناءها

### الخطوة الأولى: إظهار حدود دقة نقطة العبور

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### الخطوة الثانية: تنفيذ سذاجة مقابل ثابطة softmax

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### الخطوة الثالثة: تنفيذ سجل المجموع الثابت

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### الخطوة الرابعة: تنفيذ إمكانية استقرار الإنتروبي المتقاطع

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### الخطوة 5: التحقق من التدريج

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## استخدمها

### محاكاة بدقة مختلطة

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### التقطيع المتدريج

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### الكشف عن NaN/Inf

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

انظر`code/numerical.py`لتنفيذ كامل مع جميع الحالات الحافة المثبتة.`code/numerical.ts`هو منفذ TypeScript مع نفس الوظائف والإعراضات.

## أرسله

هذا الدرس ينتج عن:
- `code/numerical.py`مع softmax مستقرة، و log-sum-exp، والانتروبيا المتقاطعة، والتحقق من التراجع، ومحاكاة الدقة المختلطة
- `outputs/prompt-numerical-debugger.md`للتشخيص من NaN/Inf والقضايا العددية في التدريب

هذه التنفيذات المستقرة تظهر مرة أخرى في المرحلة 3 عند بناء حلقة التدريب وفي المرحلة 4 عند تنفيذ آليات الاهتمام.

## التمارين

1. **Catastrophic cancellation.**احسب التباين [1000000.0، 1000001.0، 1000002.0] باستخدام الصيغة البديلة $\mathbb{E}[x^2] - \mathbb{E}[x]^2$ثم احسبها باستخدام خوارزمية ويلفورد على الانترنت. مقارنة الأخطاء ضد التباين الحقيقي (0.6667).

2. **Precision hunt.**العثور على أصغر قيمة إيجابية في float32 `x`مثل هذا`1.0 + x == 1.0`هذا هو آلة إيبسيلون، تأكد من أنها تتطابق`numpy.finfo(numpy.float32).eps`. . .

3. **Log-sum-exp edge cases.**اختبر`logsumexp_stable`تعمل مع: (أ) جميع القيم متساوية، (ب) قيمة واحدة أكبر بكثير من البقية، (ج) جميع القيم سلبية جدا (-1000). التحقق من أنها تعطى نتائج صحيحة عندما تفشل النسخة البديلة.

4. **Gradient checking a neural network layer.**تنفيذ طبقة خطية واحدة `y = Wx + b`ومرحلة تحليلية للخلف`numerical_gradient`للتحقق من صحة المصفوفة الثلاث × 2 الوزن.

5. **Loss scaling experiment.**محاكاة التدريب مع float16: إنشاء تراجع عشوائي في النطاق [1e-9, 1e-3] ، وتحويل إلى float16 ، وقياس ما هي الكسور التي تصبح صفراً. ثم تطبيق مقياس الخسارة (تضاعف ب 1024) ، وتحويل إلى float16 ، وتقليل مقياسها ، وقياس الكسور الصفر مرة أخرى.

### إشارات

**Exercise 1.**حول القيم الثلاثة مع `np.float32`قبل أن تُربطهم، ثم اتصل`variance_naive`و`welford_variance`قيمة قريبة$10^{12}$في float32 لديه مسافة أكبر بكثير من 1، لذلك تتوقع النتيجة البديلة أن تكون بعيدة عن 0.6667 والنتيجة ويلفورد أن تكون قريبة.

**Exercise 2.**ابدأ بـ`x = np.float32(1.0)`و نصفها بينما `np.float32(1.0) + x != np.float32(1.0)`. احتفظ بكل قيمة في float32 ، ثم مقارنة القيمة الأخيرة التي تغيرت المبلغ مع `numpy.finfo(numpy.float32).eps`، وهو$2^{-23}$. . .

**Exercise 3.**توقع كل إجابة أولاً$n$قيم متساوية $c$النتيجة هي$c + \ln n$. بالنسبة لقيمة كبيرة واحدة، فإن النتيجة قريبة من تلك القيمة. بالنسبة لقيم قريبة من -1000، فإن النتيجة قريبة $-1000 + \ln n$، بينما`logsumexp_naive`العائدات`-inf`لأن كل تعريض ينخفض إلى 0.

**Exercise 4.**لأجل$y = Wx + b$مع خسارة$L$، التراجع ل$W$هو المنتج الخارجي من التدفق الصعودي و $x$. إغلف الخسارة كعمل من المسطح$W$، اتصل`numerical_gradient`، ونقل كلا النتائج إلى`check_gradient`. . .

**Exercise 5.**عينة من الحجم على مقياس سجل مع `10 ** np.random.uniform(-9, -3, n)`ويتحول مع`np.float16`. لا يمكن لـ Float16 أن تبقي القيم أقل من حوالي $6 \times 10^{-8}$، لذلك تتوقع أن يكون حوالي ربع القيم صفر قبل أن تتحكم في الحجم و تقريبا لا بعد أن تضرب 1024

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## المزيد من القراءة

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)-- المرجع النهائي، كثيف ولكن كامل
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- ورقة NVIDIA التي قدمت استيعاب الخسائر للتدريب على القارب16
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- دليل عملي لتحقيق مخلوط في PyTorch
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- لماذا اختارت جوجل هذا النموذج لـ TPU
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- خوارزمية لتقليل خطأ التدريب في مجموعات النقاط العائمة
