# طرق أخذ العينات

> أخذ العينات هو كيفية استكشاف الذكاء الاصطناعي مساحة الإمكانيات.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06-07 (Probability, Bayes' Theorem)
**Time:** ~120 minutes

## أهداف التعلم

- تنفيذ عكس CDF ، الرفض ، والاهمية العينات من الصفر باستخدام أرقام عشوائية متساوية فقط
- بناء درجة الحرارة، top-k، و top-p (النواة) العينات لتوليد نموذج اللغة رمز
- شرح خدعة إعادة التقييم ولماذا تسمح بالانتشار الخلفي من خلال أخذ العينات في الـ VAEs
- إشغال Metropolis-Hastings MCMC لنقل العينات من توزيع هدف غير طبيعي

## المشكلة

نموذج اللغة ينتهي من معالجة طلبك وينتج متجهًا من 50،000 لوجيت، واحد لكل رمز في مفردته. الآن يجب أن تختار واحد. كيف؟

إذا كان دائما يختار رمز أعلى احتمالات، كل رد هو نفسه. تحديد. ممل. إذا كان يختار بشكل متساوي عشوائيا، فإن الخروج هو غيبريش. الجواب يعيش في مكان ما بين هذه التطرفات، وهذا في مكان ما يتم التحكم في العينات.

لا تقتصر أخذ العينات على توليد النص. يقدر التعلم المتمحور تراجيع السياسات عن طريق أخذ العينات. تتعلم الـ VAE تمثيلات متخفية عن طريق أخذ عينات من التوزيعات المتعلمة والانتشار إلى الوراء من خلال الاختلافات العشوائية. النماذج التفريغية تولد الصور عن طريق أخذ عينات من الضوضاء وتخفيفها بشكل متكرر. تقييم أساليب مونت كارلو للتكاملات التي لا تملك حلًا مغلقًا. تستكشف خوارزميات MCMC توزيعات خلفية عالية الأبعاد لا يمكن إدراجها.

كل نظام إصطناعي اصطناعي توليدي هو نظام أخذ العينات. استراتيجية أخذ العينات تحدد جودة وتنوع وتحكم في الخروج. هذا الدروس يبني كل طريقة أخذ العينات الرئيسية من الصفر، بدءا من أرقام عشوائية متساوية وينتهي مع التقنيات التي تدعم LLM الحديثة والنماذج توليدية.

## المفهوم

### لماذا مهمة الاختبار

يظهر أخذ العينات في أربع أدوار أساسية عبر الذكاء الاصطناعي والتعلم الآلي:

**Generation.**النماذج اللغوية ونماذج التوزيع والGAN تنتج جميعها الناتج عن طريق أخذ العينات. يقوم خوارزمية أخذ العينات بالتحكم مباشرة في الإبداع والاتساق والتنوع. هي درجة الحرارة و top-k و عينة النواة التي يديرها المهندسون يوميا.

**Training.**عينة نزول التراجع التدريجي الستوكاستيكي مجموعات صغيرة. عينة التراجع النوراني لتعطيل. عينة زيادة البيانات تحول عشوائية. عينة الأهمية تعيد الوزن على العينات لتقليل اختلاف التراجع في التعلم التمهيدي (PPO ، TRPO).

**Estimation.**العديد من الكميات في ML لا تملك حلًا مغلقًا. الخسارة المتوقعة على توزيع البيانات ، وظيفة القسم في نموذج قائم على الطاقة ، والدليل في استنتاج بايزي. تقدير مونتي كارلو يقترب من كل هذه عن طريق متوسط العينات.

**Exploration.**تستكشف خوارزميات MCMC التوزيعات اللاحقة في استنتاج بايزيان. الاستراتيجيات التطورية عينات اضطرابات المعلمات. تثومسون استنتاج العينات توازن الاستكشاف والاستغلال في اللصوص.

التحدي الأساسي: يمكنك فقط أخذ عينات مباشرة من التوزيعات البسيطة (وحدة، طبيعية). بالنسبة لكل شيء آخر، تحتاج إلى طريقة لتحويل عينات بسيطة إلى عينات من التوزيع المستهدف الخاص بك.

### عينة عشوائية موحدة

كل طريقة أخذ العينات تبدأ هنا. مولد عدد عشوائي متساوي ينتج قيم في$[0, 1)$حيث كل فاصل فرعي مساوٍ لعدد مساوٍ لديه احتمال مساوٍ.

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

ليعمل عينة متساوية من مجموعة منفصلة من$n$المواد، توليد $U$و العودة$\lfloor n U \rfloor$. لإجراء عينة من نطاق مستمر $[a, b]$، الحساب$a + (b - a) U$. . .

المفهوم الرئيسي: عدد عشوائي موحد واحد يحتوي بالضبط على كمية مناسبة من الاختيارات عشوائية لإنتاج عينة واحدة من أي توزيع. الحيلة هي العثور على التحول الصحيح.

### طريقة CDF العكسية (تقاط عينات من التحول العكسي)

تقوم وظيفة التوزيع التراكمي (CDF) بتحديد القيم إلى الاحتمالات:

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

المعدل المقابل CDF يرسم احتمالات مرة أخرى إلى القيم.$U \sim \text{Uniform}(0, 1)$، ثم$X = F^{-1}(U)$يتبع التوزيع المستهدف.

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Exponential distribution example:**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

هذا يعمل بشكل مثالي عندما يمكنك كتابة$F^{-1}$في شكل مغلق. بالنسبة للتوزيع الطبيعي، لا يوجد CDF المعاكس المغلق، لذلك نستخدم طرق أخرى (بوكس-مولر، أو التقريب الرقمي).

**Discrete version:**بالنسبة للتوزيعات المفصلة، قم ببناء CDF ككمية تجميعية،$U$، و العثور على المؤشر الأول حيث يتجاوز المبلغ الإجمالي $U$هكذا`sample_categorical`العمل في الدروس 06.

### الرفض عن عينات

عندما لا يمكنك عكس CDF ولكن يمكنك تقييم PDF المستهدف حتى ثابتة، الرفض العينات يعمل.

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = Z/M, where Z is the integral of p(x)
                (Z = 1, so the rate is 1/M, when p is normalized)
```

كلما كانت الحدود أكثر صرامة$M$في الأبعاد المنخفضة (1-3) ، يعمل أخذ العينات بشكل جيد. في الأبعاد العالية، ينخفض معدل القبول بشكل متسارع لأن معظم حجم المقترح يتم رفضه. هذا هو لعنة الأبعاد لامتثال العينات.

**Example: sampling from a truncated normal.**استخدم اقتراحًا موحدًا على النطاق المختصر.$M$هو أقصى عدد من PDF العادي في هذه النطاق.

**Example: sampling from a semicircle.**اقترح بشكل متساوي في مستطيل الحدود. اقبل إذا سقطت النقطة داخل نصف الدائرة. هكذا يقوم مونت كارلو بحساب$\pi$: معدل قبول يساوي نسبة المساحة $\pi/4$. . .

### أهمية أخذ العينات

في بعض الأحيان لا تحتاج إلى عينات من التوزيع المستهدف $p(x)$يجب أن تقيم توقعاتك تحت$p(x)$، و لديك عينات من توزيع مختلف$q(x)$. . .

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

هذا أمر حاسم في التعلم التمويلي. في PPO (التحسين السياسة القريبة) ، تقوم بتجميع المسارات تحت سياسة قديمة $\pi_{\text{old}}$ولكن يريدون تحسين سياسة جديدة$\pi_{\text{new}}$. الوزن المهم هو$\pi_{\text{new}}(a \mid s) / \pi_{\text{old}}(a \mid s)$ويقلل (بي بي أو) هذه الأوزان لمنع السياسة الجديدة من الانحراف عن السياسة القديمة

تغير تقدير الأهمية في أخذ العينات يعتمد على مدى شباهته$q$هو ل$p$إذا$q$هو مختلف جدا عن$p$يُقسم أخذ العينات بأهمية ذاتية بمجموع الأوزان لتقليل هذه المشكلة:

```math
\mathbb{E}_p[f(x)] \approx \frac{\sum_i w_i \, f(x_i)}{\sum_i w_i}
```

### تقدير مونتي كارلو

تقدير مونت كارلو يقترب من الإجماليات عن طريق متوسط عينات عشوائية. قانون الأعداد الكبيرة يضمن التقارب.

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

معدل الخطأ مستقل عن الأبعاد هذا هو السبب في أن أساليب مونت كارلو تهيمن على الأبعاد العالية حيث لا يمكن دمجها على أساس الشبكة.

**Estimating pi:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Estimating expectations:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### سلسلة ماركوف مونتي كارلو (MCMC): متروبوليس-هستنغز

إن المكرسية تقوم ببناء سلسلة ماركوف التي يُعتبر توزيعها ثابت هو توزيعها المستهدف$p(x)$بعد خطوات كافية، يتم أخذ عينات من السلسلة (تقريبًا)$p(x)$. . .

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

بالنسبة للمقترحات التوافقية $(q(x' \mid x) = q(x \mid x'))$، يسهل النسبة إلى $p(x')/p(x)$هذا هو خوارزمية "ميتروبوليس" الأصلية

**Why it works.**قاعدة القبول تضمن التوازن التفصيلي: احتمال وجود$x$ونتحرك إلى$x'$يساوي احتمال وجودها في$x'$ونتحرك إلى$x$التوازن المفصل يعني أن$p(x)$هو توزيع ثابت للسلسلة.

**Practical considerations:**
- الحرق: إلقاء العينات المبكرة قبل أن تصل السلسلة إلى التوازن
- التثني: احتفظ بكل$k$- العينة الثالثة لتقليل التواصل الذاتي
- نطاق المقترحات: صغير جداً وتتحرك السلسلة ببطء (قبول كبير، استكشاف بطيء) ؛ كبير جداً ويتم رفض معظم المقترحات (قليل القبول، عالق في مكانه)
- معدل قبول المثالي لمقترح غوسسي في الأبعاد العالية هو حوالي 0.234

### عينة غيبز

عينة غيبز هي حالة خاصة من MCMC للتوزيعات المتعددة المتغيرات. بدلاً من اقتراح نقل في جميع الأبعاد في وقت واحد ، فإنه يحدث متغير واحد في وقت واحد من التوزيع المشروط.

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

أخذ العينات من (غيبز) يتطلب أن تتمكن من أخذ العينات من كل توزيع مشروط$p(x_i \mid x_{-i})$هذا بسيط بالنسبة للعديد من النماذج
- شبكات بايزية: تتبع الشروط من هيكل الرسم البياني
- مخليطات غوسيان: الشروط هي غوسيانية
- نماذج الإيزينغ: مشروط كل دورة يعتمد فقط على جيرانه

معدل قبول هو دائما 1 (أي اقتراح مقبول) لأن أخذ العينات من الشروط الدقيقة يلبي تلقائيا التوازن التفصيلي.

**Limitation.**عندما تكون المتغيرات مرتبطة للغاية، يختلط أخذ العينات من جيبس ببطء لأن تحديث متغير واحد في وقت لا يمكن أن يجعل تحركات متقاطعة كبيرة من خلال التوزيع.

### عينة درجة الحرارة (مستخدمة في الـ LLM)

النماذج اللغوية تسجيلات الإخراج $z_1, \ldots, z_V$للكل رمز في المفردات. Softmax تحويل هذه إلى احتمالات.

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Why it works.**تقسيم اللوغات$T < 1$يضخم الاختلافات بين اللوجيتات.$z_1 = 2$و$z_2 = 1$، تقسيمها بـ $T = 0.5$يعطي$z_1/T = 4$و$z_2/T = 2$بعد softmax، أعلى علامة التخمين يحصل على حصة أكبر بكثير.

**In practice:**
- $T = 0.0$: تشفير طموح، أفضل للقوال والإجابات الفعلية
- $T = 0.3\text{-}0.7$: مبتكر قليلاً، جيد لتوليد الرموز
- $T = 0.7\text{-}1.0$: متوازنة، جيدة للحوار العام
- $T = 1.0\text{-}1.5$: الكتابة الإبداعية، استفجار الأفكار
- $T > 1.5$: بشكل متزايد عشوائية، نادرا ما تكون مفيدة

الحرارة لا تغير أي رموز ممكنة. إنها تغير كتلة الاحتمال المخصصة لكل رمزا.

### عينة من أعلى

الاختبار العريض يقتصر على المرشح المحدد إلى $k$الوهم مع أعلى احتمالات، ثم تجدد طبيعة ومعينة من تلك مجموعة مقيدة.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

تُمنع (توب-ك) النموذج من اختيار رموز غير محتملة للغاية (خطأ، سخافة) الموجودة في ذيل طويل من توزيع المفردات. المشكلة: $k$يتم تحديدها بغض النظر عن السياق. عندما يكون النموذج واثقًا (وهناك رمز واحد لديه احتمال بنسبة 95%) ، $k = 40$لا يزال يسمح بـ 39 بديلاً. عندما يكون النموذج غير مؤكد (الاحتمال ينشر على 1000 رمز) ، $k = 40$يقطع الخيارات المثيرة للصدق

### عينة من أعلى (النواة)

يعدل أخذ العينات من أعلى النقاط بشكل ديناميكي حجم مجموعة المرشحين. بدلاً من الاحتفاظ بأعداد ثابتة من الرموز، فإنه يحتفظ بأصغر مجموعة من الرموز التي تتجاوز احتمالها التراكمي $p$. . .

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

عندما يكون النموذج واثقًا ، فإن أخذ العينات النووية يحتفظ ببعض الرموز (ربما 2-3). عندما يكون النموذج غير مؤكد ، فإنه يحتفظ بالعديد (ربما 200). هذا السلوك التكيفي هو السبب في أن أخذ العينات النووية ينتج بشكل عام نصًا أفضل من top-k.

**Common combinations:**
- درجة الحرارة 0.7 + أعلى-p 0.9: إعداد جيد للأغراض العامة
- درجة الحرارة 0.0 (الحشاشة): أفضل للمهام التحديدية
- درجة الحرارة 1.0 + أعلى 50: Fan et al. (2018) إعداد ورقة أصلية

يمكن دمج top-k و top-p أولاً، و top-p على مجموعة الباقية

### خدعة إعادة التأهيل (مستخدمة في VAEs)

يتعلم المُخترفون الذاتيّون المتغيرون (VAEs) عن طريق ترميز المدخلات إلى توزيع في الفضاء الخاطئ، وتقطيع العينات من هذا التوزيع، وتفكير العينات مرة أخرى. المشكلة: لا يمكنك التنشر مرة أخرى من خلال عملية أخذ العينات.

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

خدعة إعادة التقييم تفصل العشوائية عن المعلمات:

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

هذا يعمل لأن$\mathcal{N}(\mu, \sigma^2)$يمتلك نفس التوزيع$\mu + \sigma \cdot \mathcal{N}(0, 1)$. المعلومات الرئيسية: نقل العشوائية إلى مصدر خالي من المعلمات ($\epsilon$ثم تعبر عن العينة كتحويل قابل للتفريق للمعلمات.

**In the VAE training loop:**
1. خروجيات تشفير$\mu$و$\log(\sigma^2)$لكل مدخل
2. العينة$\epsilon \sim \mathcal{N}(0, 1)$
3. الحساب$z = \mu + \sigma \epsilon$
4. فك الرمز$z$لإعادة بناء المدخل
5. التنشر إلى الوراء من خلال الخطوات 4، 3، 2، 1 (محتمل لأن الخطوة 3 يمكن تفاصيلها)

بدون خدعة إعادة التقييم، لا يمكن تدريب VAEs مع التنشر الخلفي القياسي. هذه البصيرة الوحيدة جعلت VAEs عملية.

### غومبل-سوفتماكس (مختلفة العينات الفئوية)

خدعة إعادة التقييم تعمل على التوزيعات المستمرة (غوسيان). بالنسبة للتوزيعات الفئوية المفصلة ، نحتاج إلى نهج مختلف. توفر Gumbel-Softmax تقريبًا قابل للتفريق إلى العينات الفئوية.

**The Gumbel-Max trick (non-differentiable):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (differentiable approximation):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

يُنتج Gumbel-Softmax إسترخاء مستمر لعينة منفصلة. إنتاجها متجه احتمالي (رآة واحدة ساخنة) بدلاً من واحدة ساخنة صلبة. تدفق التدرجات من خلال softmax. أثناء الممر المباشر في التدريب، يمكنك استخدام مقياس "مباشر": استخدم argmax الصلب للممر المباشر ولكن التدرجات Gumbel-Softmax الناعمة للممر الخلفي.

**Applications:**
- المتغيرات الخفية المختلفة في الـ VAEs
- البحث في الهندسة المعمارية العصبية (اختيار العمليات المفصلة)
- آليات الاهتمام الصلب
- تعزيز التعلم من خلال الإجراءات المفصلة

### الاختيار الطبقي

يمكن أن يترك العينات القياسية من مونت كارلو فجوات في مساحة العينات عن طريق الصدفة.

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

الاختيارات الطبقة المختلفة دائماً تكون أقل أو متساوية بالمقارنة مع معيار مونت كارلو:

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Applications:**
- التكامل الرقمي (التي تصل إلى مونتي كارلو)
- تقسيم بيانات التدريب (ضمان توازن الفصول في كل طائرة)
- أخذ العينات من الأهمية مع التصنيف (جمع كلتا التقنيتين)
- تستخدم NeRF (حقول الإشعاع العصبي) أخذ العينات الطبقة على طول أشعة الكاميرا

### الاتصال مع نماذج التوزيع

النماذج التفريغية تولد الصور من خلال عملية أخذ العينات.$T$تتعلم العملية العكسية التخريب، وتستعيد الصورة الأصلية خطوة بخطوة.

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

الارتباط مع الأساليب في هذا الدروس:
- كل خطوة إعلانية تستخدم خدعة إعادة التقييم (ضوضاء العينات، تطبيق تحويل تحديد)
- جدول الضوضاء$\lbrace \alpha_t \rbrace$يسيطر على شكل من أشكال التخفيف في درجة الحرارة
- التدريب يستخدم تقدير مونت كارلو لتقريب ELBO (دليل الحد السفلي)
- أخذ العينات من الأجداد في نماذج التوزيع هو سلسلة ماركوف (كل خطوة تعتمد فقط على الحالة الحالية)

عملية توليد الصور بأكملها هي أخذ العينات التكرارية: تبدأ من الضوضاء، وفي كل خطوة، عينة نسخة أقل ضوضاء قليلا مشروطة على نموذج التخفيض المتعلم.

```figure
monte-carlo-pi
```

## بناءها

### الخطوة الأولى: أخذ عينات CDF موحدة وعكسية

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

إنشاء 10،000 عينات تعريفة وتحقق من المتوسط هو $1/\lambda$. . .

### الخطوة الثانية: أخذ العينات من الرفض

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

استخدم عينات الرفض لتحديد الشكل عن طريق رسم العينات.

### الخطوة الثالثة: أخذ العينات من الأهمية

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

تقدير$\mathbb{E}[X^2]$في حالة توزيع طبيعي باستخدام اقتراح موحد.$\mu^2 + \sigma^2$)

### الخطوة الرابعة: تقدير مونت كارلو لـ pi

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### الخطوة 5: مركز المشاريع المتروبوليس-هستنغز

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

عينة من توزيع ثنائي (مزيج من غوسيان) ، تخيل مسار السلسلة.

### الخطوة 6: أخذ عينات غيبز

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### الخطوة 7: أخذ العينات من درجة الحرارة

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

أظهر كيف تغير درجة الحرارة توزيع الخروج لمجموعة من علامات التسجيل.

### الخطوة الثامنة: أخذ العينات من الأعلى و من الأعلى

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### الخطوة التاسعة: خدعة إعادة التأهيل

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

إثبات أن التدفقات تدفق عبر العينة المعدلة ولكن ليس من خلال أخذ العينات مباشرة.

### الخطوة 10: Gumbel- Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

أظهر كيف أن انخفاض درجة الحرارة يجعل الخروج يقترب من متجه واحد حار.

التنفيذ الكامل مع جميع التصورات في `code/sampling.py`. . .

منفذ النسخة النسخة هو في `code/sampling.ts`يستخدم مولد عشوائي خاص به، لذا فإن أرقامه عشوائية تختلف عن إصدار Python.

## استخدمها

مع NumPy و SciPy، نسخ الإنتاج:

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

لـ MCMC على نطاق واسع، استخدم المكتبات المخصصة:
- PyMC: النموذج البايسي الكامل مع NUTS (HMC التكيفي)
- المُسَمِّح: عينة MCMC المُجتمعية
- NumPyro/JAX: MCMC المتسارع مع GPU

لقد بنيت هذه من الصفر، والآن تعرف ما الذي تفعله المكتبة

## التمارين

1. تنفيذ عكس عينة CDF للتوزيع كوشي.$F(x) = 0.5 + \arctan(x)/\pi$. توليد 10،000 عينات و رسم رسم اللوحة النسخية ضد PDF الحقيقي. لاحظ الذيل الثقيل (القييمات المتطرفة بعيدا عن المركز).

2. استخدم عينة الرفض لتوليد العينات من توزيع بيتا ((2, 5) باستخدام اقتراح موحد ((0, 1). رسم العينات المقبولة ضد PDF بيتا الحقيقي. ما هو معدل القبول النظري؟

3. تقدير الكاملة من $\sin(x)$من 0 إلى $\pi$استخدام مونت كارلو مع 1000، 10000، و100000 عينات. مقارنة الخطأ في كل مستوى. التحقق من أن الخطأ مقياسات مثل$O(1/\sqrt{N})$. . .

4. تنفيذ Metropolis-Hastings لنقل العينات من توزيع ثنائي الأبعاد $p(x, y)$متناسبة مع$\exp(-(x^2 y^2 + x^2 + y^2 - 8x - 8y) / 2)$- رسم العينات ومسار السلسلة التجربة مع مختلف الانحرافات القياسية المقترحة.

5. قم ببناء عرض كامل لتوليد النص: مع إعطاء المفردات من 10 كلمات مع علامات التسجيل، قم بتوليد تسلسلات من 20 رمز باستخدام (أ) الفلسفة، (ب) درجة الحرارة = 0.7، (ج) أعلى-ك = 3، (د) أعلى-ب = 0.9 . قم بمقارنة تنوع الخروج عبر 5 أداء.

### إشارات

**Exercise 1.**حل$u = F(x)$لـ$x$، مما يعطي$x = \tan(\pi(u - 0.5))$تحقق من أن متوسط العينة قريب من 0 وأن حوالي 6% من العينات لديها$\lvert x \rvert > 10$، وهو$1 - (2/\pi)\arctan(10)$. . .

**Exercise 2.**كثافة بيتا ((2, 5) هي $30x(1-x)^4$. اعثر على أعلى قيمته في وضع$x = 1/5$واستخدم هذا القيمة$M$في`rejection_sample`. معدل قبول النظرية هو$1/M$، لذا قارنه مع جزء من المقترحات التي تقبلينها

**Exercise 3.**القيمة الدقيقة هي 2 اتصل`monte_carlo_integral(math.sin, 0, math.pi, n)`لكل واحد$n$وكرر كل جولة مع عدة بذور$n$ينمو بمعدل 10 ، يجب أن ينخفض متوسط الخطأ بنحو $\sqrt{10} \approx 3.2$. . .

**Exercise 4.**اكتب سجل الهدف، وهو$-(x^2 y^2 + x^2 + y^2 - 8x - 8y)/2$، ومرّها إلى`metropolis_hastings_2d`- سجل معدل قبول كل اقتراح من الانحرافات القياسية: قيمة صغيرة جدا تقبل كل خطوة تقريباً ولكن تتحرك ببطء، وتقبل قيمة كبيرة جداً كل خطوة تقريباً.

**Exercise 5.**تشفير الطمع يأخذ مؤشر أكبر التسجيل في كل خطوة.`temperature_sample`،`top_k_sample`و`top_p_sample`يجب أن يعطي الجشع نفس التسلسل في جميع الرحلات الخمسة، لذلك احتساب التسلسلات المختلفة لكل طريقة لقياس التنوع.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Sampling | "Drawing random values" | Generating values according to a probability distribution. The mechanism behind all generative AI |
| Uniform distribution | "All equally likely" | Every value in $[a, b]$ has equal probability density $1/(b-a)$. The starting point for all sampling methods |
| Inverse CDF | "Probability transform" | $F^{-1}(U)$ converts a uniform sample into a sample from any distribution with known CDF. Exact and efficient |
| Rejection sampling | "Propose and accept/reject" | Generate from a simple proposal, accept with probability proportional to target/proposal ratio. Exact but wastes samples |
| Importance sampling | "Reweight samples" | Estimate expectations under $p(x)$ using samples from $q(x)$ by weighting each sample by $p(x)/q(x)$. Core to PPO in RL |
| Monte Carlo | "Average random samples" | Approximate integrals as sample averages. Error $O(1/\sqrt{N})$ regardless of dimension |
| MCMC | "Random walk that converges" | Construct a Markov chain whose stationary distribution is the target. Metropolis-Hastings is the foundational algorithm |
| Metropolis-Hastings | "Accept uphill, sometimes downhill" | Propose moves, accept based on density ratio. Detailed balance ensures convergence to target distribution |
| Gibbs sampling | "One variable at a time" | Update each variable from its conditional distribution holding others fixed. 100% acceptance rate |
| Temperature | "Confidence knob" | Divides logits by $T$ before softmax. $T<1$ sharpens (more confident), $T>1$ flattens (more diverse) |
| Top-k sampling | "Keep the k best" | Zero out all but the $k$ highest-probability tokens, renormalize, sample. Fixed candidate set size |
| Nucleus sampling (top-p) | "Keep the probable ones" | Keep the smallest set of tokens whose cumulative probability exceeds $p$. Adaptive candidate set size |
| Reparameterization trick | "Move randomness outside" | Write $z = \mu + \sigma \epsilon$ where $\epsilon \sim \mathcal{N}(0,1)$. Makes sampling differentiable. Essential for VAE training |
| Gumbel-Softmax | "Soft categorical sampling" | Differentiable approximation to categorical sampling using Gumbel noise + softmax with temperature |
| Stratified sampling | "Forced coverage" | Divide sample space into strata, sample from each. Always lower variance than naive Monte Carlo |
| Burn-in | "Warm-up period" | Initial MCMC samples discarded before the chain reaches its stationary distribution |
| Detailed balance | "Reversibility condition" | $p(x) T(x \to y) = p(y) T(y \to x)$. Sufficient condition for $p$ to be the stationary distribution of a Markov chain |
| Diffusion sampling | "Iterative denoising" | Generate data by starting from noise and applying learned denoising steps. Each step is a conditional sampling operation |

## المزيد من القراءة

- [Holbrook (2023): The Metropolis-Hastings Algorithm](https://arxiv.org/abs/2304.07010)- دراسة مفصلة حول أسس MCMC
- [Jang, Gu, Poole (2017): Categorical Reparameterization with Gumbel-Softmax](https://arxiv.org/abs/1611.01144)- ورق جومبل- سافتماكس الأصلي
- [Holtzman et al. (2020): The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751)- ورق أخذ العينات من النواة (أعلى-ب)
- [Kingma & Welling (2014): Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)- ورقة VAE التي تعرض خدعة إعادة التقييم
- [Ho, Jain, Abbeel (2020): Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)- DDPM يربط أخذ العينات بتوليد الصور
