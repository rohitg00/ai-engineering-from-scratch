# المعايير والمسافات

> وظيفتك المسافة تعريف ما تعنيه "مثل" اختر خطأ وكل شيء أسفل التيار ينكسر.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## أهداف التعلم

- تنفيذ L1، L2، كوسين، مهالانوبي، جاكارد، وتحرير وظائف المسافة من الصفر
- حدد مقياس المسافة المناسبة لمهمة ML معينة وشرح لماذا تفشل البدائل
- ربط معايير L1 و L2 إلى تنظيم LASSO و Ridge ومناطق القيود الهندسية الخاصة بهم
- إظهار كيف أن مجموعة البيانات نفسها تنتج مختلف الجيران القريبين تحت قياسات مختلفة

## المشكلة

لديك متجهين. ربما يكونون مدخلات كلمات. ربما تكون ملفات تعريف للمستخدم. ربما تكون صفوف بيكسل. تحتاج إلى معرفة: كم هي قريبة؟

الإجابة تعتمد تماما على وظيفة المسافة التي تختارها. نقطتين بيانيتين يمكن أن تكون أقرب جيران تحت مقياس واحد والبعيدة عن بعضها البعض تحت آخر. تصنيف KNN الخاص بك، محرك التوصيات الخاصة بك، قاعدة بيانات المتجهات الخاصة بك، خوارزمية التجميع الخاصة بك، وظيفة الخسارة الخاصة بك - كل ذلك يعتمد على هذا الخيار. الحصول على خطأ ونموذجك تحسن للشيء الخطأ.

لا توجد أفضل مسافة عالمية. يعمل L2 للبيانات المكانية. تهيمن على شبيهة الكوسينات على NLP. يتعامل جاكارد مع المجموعات. تحرير المسافة يتعامل مع السلاسل. يحسب مهالانوبيس التواصلات. يتنقل واسستيرين كتلة الاحتمال. كل منهما يرمز افتراضًا مختلفًا حول ما يعنيه "مثل".

هذه الدروس تبني كل وظيفة مسافة رئيسية من الصفر، وتظهر لك عندما كل واحد هو الأداة الصحيحة، وتظهر كيف نفس البيانات تنتج مختلفة تماماً أقرب جيران اعتماداً على المقياس الذي تستخدم.

## المفهوم

### المعايير: قياس حجم المتجه

يُقيس القاعدة "حجم" المتجه. يمكن كتابة كل وظيفة مسافة بين متجهين كقاعدة اختلافهما: $d(a, b) = \lVert a - b \rVert$لذا فهم المعايير هو فهم المسافات

### L1 نورم (مسافة مانهاتن)

المعيار L1 يجمع القيم المطلقة لجميع المكونات.

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

يُسمى مسافة مانهاتن لأنه يقيس مدى المشي على شبكة مدينة حيث يمكنك فقط التحرك على طول المحاور. لا يوجد شوارع.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

متى تستخدم L1:
- بيانات نادرة عالية الأبعاد (ميزات النص، تشفيرات واحدة حارة)
- عندما تريد قوة إلى مستويات خارجية (ففرق واحد ضخم لا يهيمن)
- مشاكل في اختيار الميزات (تعزيز التنظيم L1 يُعزز النقطة)

الاتصال بتنظيم L1 (Lasso): إضافة $\lVert w \rVert_1$لـ L1 العقوبة تخلق مناطق قيودية على شكل الماس في مساحة الوزن، وتقع زوايا الماس على المحاور حيث بعض الوزن صفر.

اتصال بـ وظائف الخسارة: متوسط الخطأ المطلق (MAE) هو متوسط مسافة L1 بين التنبؤات والهدف. فإنه يعاقب جميع الأخطاء بشكل خطي ، مما يجعلها قوية إلى مستويات خارجية مقارنة مع MSE.

### L2 القاعدة (مسافة يوكليدي)

القاعدة L2 هي المسافة المستقيمة الجذر التربيعي من مجموع المكونات التربيعية

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

هذه المسافة التي تعلمتها في صف الهندسة$n$الأبعاد

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

متى تستخدم L2:
- بيانات مستمرة من الأبعاد المنخفضة إلى المتوسطة
- عندما تكون مقاييس الميزات مقارنة
- المسافات الجسدية (بيانات المكان، قراءات المستشعرين)
- تشابه الصورة على مستوى البيكسل

الاتصال بتنظيم L2 (Ridge): إضافة $\lVert w \rVert_2^2$فعلى عكس L1 ، لا تدفع الوزن إلى الصفر. إنها تقلص جميع الوزن نحو الصفر بشكل متناسب. تعتبر الجزء L2 منطقة قيود دائرية ، لذلك لا توجد زوايا على المحاور. تصبح الوزن صغيرة ولكن نادرا ما تكون صفرة تمامًا.

اتصال إلى وظائف الخسارة: متوسط الخطأ التربيعي (MSE) هو متوسط المسافات التربيعية L2. يعاقب التربيع الأخطاء الكبيرة بشكل أكبر من الأخطاء الصغيرة.

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### القواعد: العائلة العامة

L1 و L2 هي حالات خاصة من معيار Lp:

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

قيم مختلفة من$p$تنتج "كرات الوحدة" ذات شكل مختلف (مجموعة من جميع النقاط على مسافة لا تقل عن 1 من المنشأ؛ والشكلات أدناه هي حدودها):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### معايير اللانهاية (مسافة تشيبيشيف)

كـ$p$يقترب من اللانهاية، فإن معايير Lp تتقارب إلى أقصى مكون مطلق.

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

المسافة بين نقطتين تحدد الأبعاد الوحيدة التي تختلف فيها أكثر. يتم تجاهل جميع الأبعاد الأخرى.

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

متى تستخدم L- Infinity:
- عندما يكون أسوأ حالة من الانحراف في أي بعد واحد مهم
- لوحات اللعب (ملك في الشطرنج يتحرك في L- لا نهاية لها: خطوة واحدة في أي اتجاه تكلف 1)
- تسامح التصنيع (يجب أن تكون كل ابعاد ضمن المواصفات)

### تشابه الكوزين والمسافة الكوزينية

تقيس تشابه الكوزين زاوية بين متجهين، دون تجاهل حجمهم.

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

يمتد من -1 (الجهات المعاكسة) إلى +1 (المثل). المتجهات المرتفعة لها تشابه كوزين 0.

المسافة الكوسينية تحويلها إلى مسافة: cosine_distance = 1 - cosine_similarity. هذا يتراوح من 0 (الجهة المماثلة) إلى 2 (الجهة المعاكسة).

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

لماذا يهيمن الكوسين على النمط النووي والإدمج: في النص، لا ينبغي أن يؤثر طول الوثيقة على التشابه. وثيقة عن القطط التي هي أطول مرتين من وثيقة أخرى عن القطط يجب أن تكون "مماثلة". وثائق مع نفس توزيع الكلمات ولكن طول مختلف يندرج في نفس الاتجاه ويصبح تشابه كوسين 1.0.

متى تستخدم تشابهات الكوسين:
- تشابه النص (متجهات TF-IDF، تضمين الكلمات، تضمين الجملة)
- أي مجال حيث الحجم هو الضجيج والاتجاه هو الإشارة
- أنظمة التوصيات (متجهات تفضيل المستخدم)
- إدراج البحث (قواعد البيانات المتجهة تستخدم دائما تقريباً كوسين أو نقطة النقاط)

### شبيهة المنتج عند النقطة مقابل شبيهة الكوزين

نسبة النقاط من متجهين هي:

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

تشابه الكوزين هو نسبة نقطة تمت عاديلها من قبل كلا الكبرى. عندما يكون كل من المتجهين بالفعل عاديًا وحدة (الكم = 1) ، فإن نسبة نقطة ومشابهة الكوزين متطابقة.

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

عندما تختلف: نقطة المنتج يتضمن معلومات عن الكبيرة. يتم الحصول على متجه مع أكبر حجم نسبة أكبر من النقاط. هذا يهم في بعض أنظمة الاسترداد حيث تريد العناصر "الشعبية" لتصنيف أعلى. يعمل الكبيرة كإشارة ضمنية للجودة أو الأهمية.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

في الممارسة العملية:
- استخدم شبيهة كوسين عندما تريد شبيهة اتجاهية نقية
- استخدم منتج النقاط عندما تحمل الكبيرة معلومات ذات مغزى
- العديد من قواعد البيانات المتجهة (Pinecone، Weaviate، Qdrant) تسمح لك بالاختيار بينهم
- إذا كانت إضافةك معادلة لـ2 ، فلن يهم الخيار

### المسافة إلى مهالانوبي

المسافة اليوكليدية تعامل مع جميع الأبعاد على قدم المساواة ولكن إذا كانت خصائصك مرتبطة أو لديها مقياس مختلف، L2 يعطي نتائج مضللة.

المسافة المحالونوبية تعتبر هيكل التباين للبيانات.

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

أين$S$هو ماتريكيس التباين من البيانات.

بصورة بديهية: مسافة ماهالانوبي تُحلل أولاً وتطبيع البيانات (البيضاء) ، ثم تقوم بحساب مسافة L2 في هذا الفضاء المتحول.$S$هو المصفوفة الهوية (غير مرتبطة، ميزات التباين الوحدية) ، فمدى مهالانوبي يقلل إلى مسافة أوكليدي.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

متى تستخدم مسافة مهالانوبي:
- الكشف عن حالات خارجية (النقاط التي تكون بعيدة عن المتوسط مع مهالانوبيز كبيرة هي حالات خارجية)
- التصنيف عندما تكون لهما ميزات مختلفة وتقارير مختلفة
- عندما يكون لديك ما يكفي من البيانات لتقدير ماتريكس التباين الموثوق بها
- مراقبة الجودة في التصنيع (مراقبة العمليات المتعددة المتغيرات)

### تشابه جاكارد (للمجموعات)

تدابير تشابه جاكارد تتداخل بين مجموعتين.

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

يمتد من 0 (لا تخطي) إلى 1 (مجموعات متطابقة). مسافة جاكارد = 1 - تشابه جاكارد.

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

متى تستخدم Jaccard:
- مقارنة مجموعات من العلامات أو الفئات أو الميزات
- تشابه الوثائق بناء على وجود الكلمة (ليس التردد)
- الكشف عن ضعف تقريب (تقريب MinHash من Jaccard)
- مقارنة متجهات الميزات الثنائية (بيانات الحضور/غياب)
- تقييم نماذج التقسيم (القطع على الاتحاد = جاكارد)

### إصلاح المسافة (مسافة ليفينشتاين)

مسافة التحرير تعتبر الحد الأدنى من عمليات الحرف الواحد اللازمة لتحويل سلسلة واحدة إلى أخرى. العمليات هي: إدراج أو حذف أو استبدال.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

حاسوب باستخدام البرمجة الديناميكية. ملء المصفوفة حيث يدخل $(i, j)$هو المسافة بين المحرر الأول $i$حرفات سلسلة A والاولى $j$حرفات سلسلة B

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

متى تستخدم مسافة التحرير:
- التحقق من التهجير وتصحيحه
- تحديد تسلسل الحمض النووي (مع العمليات الموزعة)
- تناغم السلاسل المضطربة
- إضافة بيانات النص المزعج

### KL التباين (ليس مسافة، ولكن تستخدم كمسافة واحدة)

يُقيّم اختلاف KL كيف يختلف توزيع الاحتمالات من التوزيع الآخر. تم تغطيته في الدروس 09, ولكنه ينتمي إلى هذه المناقشة لأن الناس يستخدمونها كـ "مسافة" على الرغم من أنها ليست واحدة.

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

الخصية الحرجة: الاختلاف KL ليس متناغمًا.

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

هذا يعني أنه يفشل في متطلبات الأساسية لمقاييس المسافة. كما أنه لا يلبي عدم المساواة الثلاثية. إنه تباين، وليس مسافة.

إلى الأمام$(D_{KL}(P \Vert Q))$هو "البحث عن المعنى": $Q$يحاول تغطية جميع أنواع$P$. . .
عكس KL $(D_{KL}(Q \Vert P))$هو "بحث عن الوضع": $Q$يركز على طريقة واحدة من$P$. . .

عندما ترى انعكاسات ك.إل:
- VAEs (مصطلح KL في ELBO يدفع التوزيع الخفية نحو سابقة)
- تقطيع المعرفة (يحاول الطالب مطابقة توزيع المعلم)
- RLHF (عقوبة KL تبقي النموذج المعدل بشكل جيد بالقرب من النموذج الأساسي)
- أساليب تراجع السياسات (تحديثات السياسات القيّدة)

### مسافة Wasserstein (مسافة محرك الأرض)

يُقيس مسافة واسستيرين الحد الأدنى من "العمل" اللازم لتحويل توزيع الاحتمالات إلى آخر. فكر في ذلك: إذا كان توزيع واحد كومة من التراب والآخر هو ثقب، كم من التراب يجب أن تتحرك إلى أي مدى؟

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

بالنسبة للتوزيعات الـ 1D، فإنه يسهل إلى التكامل الفرق المطلق من وظائف التوزيع التراكمية:

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

لماذا يهم (واسترين):
- إنها مقياسية حقيقية (متطابقة، تلبي عدم المساواة الثلاثية)
- يوفر تراجع حتى عندما لا تتداخل التوزيعات (الاختلاف في KL يذهب إلى اللانهاية)
- هذه الخصائص جعلتها مركزية لـ Wasserstein GANs (WGANs) ، والتي حل عدم استقرار التدريب من GANs الأصلية

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

متى تستخدم Wasserstein:
- تدريب GAN (WGAN، WGAN-GP)
- مقارنة التوزيعات التي قد لا تتداخل
- مشاكل النقل المثلى
- استرداد الصورة (مقارنة رسومات اللون)

### لماذا تطلب المهام المختلفة مسافة مختلفة

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using $Q$ instead of $P$ |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### العلاقة مع وظائف الخسارة

وظائف الخسارة هي وظائف المسافة المطبقة على التنبؤات مقابل الأهداف.

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### الرابط مع التنظيم

الإعادة التنظيمية تضيف عقوبة قياسية على الأوزان إلى وظيفة الخسارة.

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

لماذا L1 ينتج القصور ولكن L2 لا: تصور منطقة القيود في مساحة الوزن 2D. L1 هو الماس، L2 هو دائرة. خطوط وظيفة الخسارة (الليبسيات) هي الأكثر عرضة لمس الماس في الزاوية، حيث وزن واحد هو صفر. أنها تلمس الدائرة في نقطة سلسة، حيث كل من الوزن غير صفر.

### البحث عن أقرب جيران

كل وظيفة مسافة تشير إلى مشكلة بحث القريب القريب: مع إعطاء نقطة استفسار، العثور على أقرب نقاط في مجموعة بيانات.

أقرب جيران بالتحديد$O(n \cdot d)$لكل استفسار في مجموعة بيانات $n$النقاط مع $d$بالنسبة لمجموعات بيانات كبيرة، هذا بطيء جدا.

تحديدات القريبة القريبة (ANN) تتداول كمية صغيرة من الدقة لتحقيق مكاسب كبيرة في السرعة:

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW (Hirarchical Navigable Small World) هو الخوارزمية المهيمنة في قواعد بيانات المتجهات الحديثة. فإنه يبنغ رسم بيانات متعددة الطبقات حيث يتصل كل عقدة إلى أقرب جيرانها التقريبية. تبدأ البحث في الطبقة العلوية (المتفاصلة، القفزات الطويلة) وتنزل إلى الطبقة السفلى (الاكثافة، القفزات القصيرة).

```figure
norm-unit-balls
```

## بناءها

### الخطوة الأولى: جميع وظائف القاعدة والمسافة

انظر`code/distances.py`كل وظيفة بنيت من الصفر باستخدام فقط الرياضيات الأساسية Python. الملف `code/distances.ts`هو منفذ TypeScript مع نفس الوظائف والإعراضات.

### الخطوة الثانية: نفس البيانات، مسافات مختلفة، جيران مختلفين

التجربة في`distances.py`يخلق مجموعة بيانات، يختار نقطة استفسار، ويظهر كيف يتغير أقرب جيران اعتمادا على مقياس المسافة. نقطة "الأقرب" تحت L1 قد لا تكون أقرب تحت L2 أو كوسين.

### الخطوة الثالثة: إدخال بحث التشابه

يتضمن الرمز بحثًا مزيفًا يضم تشابهًا يجد أكثر "وثائق" تشابهًا للبحث باستخدام تشابه الكوزين مقابل مسافة L2, مما يظهر أن التصنيفات يمكن أن تختلف.

## استخدمها

الاستخدام العملي الأكثر شيوعا: العثور على عناصر مماثلة في قاعدة بيانات متجهة.

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

عندما تتصلين`model.encode(text)`و بعد ذلك البحث في قاعدة بيانات المتجهة، وهذا ما يحدث تحت الغطاء. نموذج التضمين خريطة النص إلى المتجهات. قاعدة بيانات المتجهة يحسب التشابه الكوسين (أو منتج نقطة) بين متجهة الاستفسار الخاص بك و كل متجه مخزن، باستخدام خوارزميات ANN لتجنب التحقق من كل منهم.

## التمارين

1. احسب مسافات L1، L2، و L- لا نهاية لها بين (1, 2, 3) و (4, 0, 6). تحقق من$L_\infty \le L_2 \le L_1$دائماً ما يحافظ على أي زوج من النقاط إثبات لماذا هذا التنظيم مضمون

2. قم بإنشاء متجهين حيث تكون شباهة الكوسين عالية (> 0.9) ولكن المسافة L2 كبيرة (> 10). شرح بشكل هندسي ما يحدث. ثم قم بإنشاء متجهين حيث تكون شباهة الكوسين منخفضة (< 0.3) ولكن المسافة L2 صغيرة (< 0.5).

3. تنفيذ وظيفة تأخذ مجموعة بيانات ونقطة استفسار وتعيد أقرب جيران تحت مسافة L1، L2، كوسين، ومحالونوبيس. العثور على مجموعة بيانات حيث لا يوافق كل أربعة على أي نقطة هي أقرب.

4. قم بحساب المسافة واصيرستين بين [0.5، 0.5، 0.5] و [0, 0, 0.5، 0.5] يدوياً باستخدام طريقة CDF. ثم احسبها بين [0.25، 0.25، 0.25، 0.25] و [0, 0, 0.5, 0.5]. أي أكبر ولماذا؟

5. تنفيذ MinHash لتحقيق شبيهة جاكارد التقريبي. توليد 100 مجموعة عشوائية، وحساب جاكارد الدقيق لجميع الأزواج، ومقارنة مع تقريبي MinHash باستخدام وظائف 50، 100 و200 الهاش. رسم الخطأ التقريب.

### إشارات

**Exercise 1.**وكتور الفرق هو (-3, 2, -3), لذلك احسب القواعد الثلاثة لهذا الجهاز`l1_norm`،`l2_norm`و`linf_norm`. لإثبات، مقارنة أكبر$\lvert d_i \rvert$مع مجموع المربعات، ومقارنة مجموع المربعات مع مربع مجموع القيم المطلقة.

**Exercise 2.**يُجاهل التشابه الكوزيني الطول، لذلك ابدأ بمتوترين يندرجون في نفس الاتجاه تقريباً وجعل واحد منهم أطول بكثير. في الحالة الثانية، استخدم متوترين قصيرين بالقرب من المنشأ يندرجون في اتجاهات مختلفة، ثم تحقق من كلا الشرطين باستخدام `cosine_similarity`و`l2_distance`. . .

**Exercise 3.**اتصل`find_nearest_neighbor(query, dataset, distance_fn)`مرة واحدة لكل واحد`l1_distance`،`l2_distance`،`cosine_distance`و`mahalanobis_distance`. .`demo_different_neighbors`يظهر مجموعة بيانات حيث لا تتفق المقاييس، لذا اقرأها أولاً ثم تغير النقاط حتى تختلف جميع الإجابات الأربعة.

**Exercise 4.**اكتب المجموع الإجمالي لكل توزيع، ثم أضف الاختلافات المطلقة للجميعين الإجماليين. تحقق من نتائج كل من اليدين مع `wasserstein_1d(p, q)`ثم شرح القيمة الأكبر بمدى مسافة مساحة الاحتمال يجب أن تتحرك.

**Exercise 5.**لكل وظيفة هش، فإن توقيع MinHash لمجموعة هو الحد الأدنى من قيمة هش على عناصرها، والجزء من وظائف هش حيث تحصل مجموعتان على نفس الحد الأدنى تقديرات تشابه جاكارد. مقارنة كل تقدير مع `jaccard_similarity`يجب أن يكون الخطأ تقريباً$1/\sqrt{k}$لـ$k$وظائف الهمش

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The $p$-th root of the sum of $p$-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as $p$ approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using $Q$ to encode $P$ |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## المزيد من القراءة

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)- مكتبة "ميتا" للبحث على نطاق مليار من النتائج
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- الورقة التي قدمت مسافة الأرض المتحرك إلى GANs
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- خوارزمية ANN الأساسية
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec، حيث أصبحت التشابه الكوسينية هي الافتراض الافتراضي للتوابل
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- دليل عملي لمقاييس المسافة وخوارزميات الجيران في التعلم
