# التحسين الملتوي

> المشاكل الملتوية لديها وادي واحد شبكات عصبية لديها ملايين معرفة الفرق مهم

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 04 (Calculus for ML), 08 (Optimization)
**Time:** ~90 minutes

## أهداف التعلم

- اختبار ما إذا كانت الوظيفة متواصلة باستخدام التعريف والمشتق الثاني والمعايير الهسسي
- قم بتطبيق طريقة نيوتن ومقارنة التقارب التربيعي له مع تراجع التراجع
- حل مشاكل التحسين المحدود باستخدام مضاعفات لاجرنج وتفسير ظروف KKT
- شرح لماذا لا تكون المناظر الطبيعية للخسائر في الشبكات العصبية متواصلة ومع ذلك فإن SGD لا تزال تجد حلول جيدة

## المشكلة

درس 08 علمك انخفاض التدفق والزخم، و آدم. هؤلاء المتحفسين يسيرون أسفل على أي سطح. لكنهم يأتون مع عدم وجود ضمانات. انخفاض التدفق على المناظر الطبيعية غير الملتوية قد يقع في الحد الأدنى المحلي السيئ، أو يعلق على نقطة السعد، أو يتذبذب إلى الأبد. استخدمتها على أي حال لأن الشبكات العصبية غير متدفقة وليس هناك بديل.

ولكن العديد من المشاكل في التعلم الآلي متناثرة. التراجع الخطى، التراجع اللوجستي، SVMs، LASSO، التراجع الخضري. بالنسبة لهؤلاء، هناك شيء أقوى: التحسين مع ضمانات رياضية. المشكلة الملتوية لا تملك واديًا كاذبة: كل أدنى الحد المحلي هو أدنى الحد العالمي. بالنسبة لـ وظيفة متواصلة سلسة لديها الحد الأدنى، يتقارب انخفاض التدفق مع حجم خطوة مناسبة. لا حاجة لإعادة تشغيل لا توجد جداول معدل التعلم لا صلاة

فهم التخفيف يفعله ثلاثة أشياء. أولاً، فإنه يخبرك عندما تكون مشكلتك سهلة (تخفيف) مقابل صعبة (غير متخفيف). ثانياً، فإنه يمنحك أدوات أسرع مثل طريقة نيوتن للمشاكل المتخففة. ثالثاً، فإنه يفسّر المفاهيم التي تظهر في جميع أنحاء ML: التنظيم كقيض، الثنائيّة في SVMs، ولماذا التعلم العميق يعمل على الرغم من انتهاك كل خصائص لطيفة تعطي لك التخفيف.

## المفهوم

### مجموعات متواصلة

مجموعة$S$هو متواصل إذا كان لأي نقطتين في $S$، وقطاع الخط بينهم يقع تماما في$S$. . .

| Convex sets | Not convex |
|---|---|
| **Rectangle**: any two points inside can be connected by a line segment that stays inside | **Star/crescent shape**: a line between two interior points can pass outside the set |
| **Triangle**: same property holds for all interior points | **Donut/annulus**: the hole means some line segments leave the set |
| The line segment between any two points stays within the set | The line segment between some pairs of points exits the set |

الاختبار الرسمي: لأي نقطة$x, y$في$S$و أيّة$t \in [0, 1]$، النقطة$tx + (1-t)y$هو أيضا في $S$. . .

أمثلة على مجموعات متواصلة:
- خط، طائرة، كل شيء$\mathbb{R}^n$
- كرة (حلقة، كرة، هائبرسفيرة)
- نصف الفضاء:$\lbrace x : a^T x \le b \rbrace$
- التقاطع لأي عدد من مجموعات الملتوية

أمثلة على مجموعات غير متواصلة:
- كعك (أنولوس)
- اتحاد دوائر منفصلة
- أي مجموعة مع "دنت" أو "ثقب"

### وظائف متواصلة

وظيفة$f$هو متواصل إذا كان مجالها هو مجموعة متواصلة و لأي نقطتين $x, y$في مجالها و أي$t \in [0, 1]$:

```math
f(tx + (1-t)y) \le t f(x) + (1-t) f(y)
```

جغرافيا: القطاع الخطوي بين أي نقطتين على الرسم البياني يقع فوق أو على الرسم البياني.

| Property | Convex function | Non-convex function |
|---|---|---|
| **Line segment test** | The line between any two points on the graph lies **above or on** the curve | The line between some points on the graph dips **below** the curve |
| **Shape** | Single bowl/valley curving upward | Multiple peaks and valleys with mixed curvature |
| **Local minima** | Every local minimum is the global minimum | Multiple local minima may exist at different heights |

الوظائف الملتوية المشتركة:
- $f(x) = x^2$(مثل)
- $f(x) = \lvert x \rvert$(قيمة مطلقة)
- $f(x) = e^x$(معدل)
- $f(x) = \max(0, x)$(المركز الرئيسي، على الرغم من قطعة خطية)
- $f(x) = -\log(x)$لـ$x > 0$(سجل سلبي)
- أي وظيفة خطية $f(x) = a^T x + b$(ملتوي ومتوت)

### اختبار التخثر

ثلاثة اختبارات عملية، من أسهل إلى أكثر صرامة.

**Test 1: Second derivative test (1D).**إذا$f''(x) \ge 0$للجميع$x$، ثم$f$هو مخروط.

- $f(x) = x^2$: $f''(x) = 2 \ge 0$-مُتَوَجِّه
- $f(x) = x^3$: $f''(x) = 6x$- سلبي$x < 0$ليس مخروطاً
- $f(x) = e^x$: $f''(x) = e^x > 0$-مُتَوَجِّه

**Test 2: Hessian test (multivariate).**إذا كانت المصفوفة الهسسيّة$H(x)$هو إيجابي نصف محدد للجميع$x$، ثم$f$هو مخروط. هي ماريخ المشتقات الجزئية الثانية.

**Test 3: Definition test.**تحقق من عدم المساواة$f(tx + (1-t)y) \le t f(x) + (1-t) f(y)$مباشرة. مفيد للعمل حيث المشتقات صعبة الحساب.

### لماذا الارتباط مهم

النظريه المركزية لتحسين الملتوي:

**For a convex function, every local minimum is a global minimum.**

هذا يعني أن هبوط التراجع لا يمكن أن يقع في الحبس في الحد الأدنى المحلي السيئ. كل الحد الأدنى الذي يمكن أن يصل إليه لديه نفس الخسارة. بالنسبة للعمل الملتوي السلس الذي لديه الحد الأدنى، فإن هبوط التراجع مع حجم خطوة مناسبة مضمون لتحقيق القيمة المثلى.

```mermaid
graph LR
    subgraph "Convex: ONE answer"
        direction TB
        C1["Loss surface has no false valleys"] --> C2["Gradient descent with a suitable step converges to the global minimum"]
    end
    subgraph "Non-convex: MANY traps"
        direction TB
        N1["Loss surface has multiple valleys and peaks"] --> N2["Gradient descent may get stuck in a local minimum"]
        N2 --> N3["Global minimum might be missed"]
    end
```

النتائج:
- لا حاجة لإعادة تشغيل عشوائي
- لا حاجة إلى جدول أعمال معقدة
- إثباتات التقارب ممكنة (تعتمد المعدل على خصائص الوظيفة)
- الحل فريد (حتى المناطق المستقرة)

### المواصلات المواصلة مقابل غير المواصلة في ML

| Problem | Convex? | Why |
|---------|---------|-----|
| Linear regression (MSE) | Yes | Loss is quadratic in weights |
| Logistic regression | Yes | Log-loss is convex in weights |
| SVM (hinge loss) | Yes | Maximum of linear functions |
| LASSO (L1 regression) | Yes | Sum of convex functions is convex |
| Ridge regression (L2) | Yes | Quadratic + quadratic = convex |
| Neural network (any loss) | No | Nonlinear activations create non-convex landscape |
| k-means clustering | No | Discrete assignment step |
| Matrix factorization | No | Product of unknowns |

النماذج الخطية مع الخسائر الملتوية هي الملتوية. في اللحظة التي تضيف فيها طبقات مخفية مع تنشيطات غير خطية، تتوقف الملتوية.

### المصفوفة الهيسي

الهيسيين $H$من وظيفة $f: \mathbb{R}^n \to \mathbb{R}$هل هو$n \times n$المصفوفة من المشتقات الجزئية الثانية.

```math
H_{ij} = \frac{\partial^2 f}{\partial x_i \, \partial x_j}
```

لأجل$f(x, y) = x^2 + 3xy + y^2$:

```math
\begin{gathered}
\begin{aligned}
\frac{\partial f}{\partial x} &= 2x + 3y & \frac{\partial^2 f}{\partial x^2} &= 2 & \frac{\partial^2 f}{\partial x \, \partial y} &= 3 \\
\frac{\partial f}{\partial y} &= 3x + 2y & \frac{\partial^2 f}{\partial y \, \partial x} &= 3 & \frac{\partial^2 f}{\partial y^2} &= 2
\end{aligned} \\[8pt]
H = \begin{bmatrix} 2 & 3 \\ 3 & 2 \end{bmatrix}
\end{gathered}
```

"الهيسي" يخبرك عن التوتر:
- قيمة خاصة كلها إيجابية: تعمل المادية نحو الأعلى في كل اتجاه (ملتوية في تلك النقطة)
- القيم الخاصة كلها سلبية: منحنى إلى أسفل في كل اتجاه (مؤثرة، أقصى محلية)
- علامات مختلطة: نقطة السرير (تلتوي في بعض الاتجاهات، وتتوي في بعضها)
- القيمة الفردية الصفرة: مسطحة في هذا الاتجاه (تدهور)

لتحقيق التخفيف، يجب أن يكون الهيسيان إيجابي شبه محدد (جميع القيم الخاصة $\ge 0$) في كل مكان، وليس فقط في نقطة واحدة.

### طريقة نيوتن

يستخدم طريقة نيوتن معلومات من النظام الثاني (الهيسيان). يتناسب مع تقريب مربع في النقطة الحالية ويقفز مباشرة إلى الحد الأدنى من ذلك التربيعي.

```math
\begin{aligned}
\text{Update rule:} \quad & x_{\text{new}} = x - H^{-1} \cdot \text{gradient} \\
\text{Compare to gradient descent:} \quad & x_{\text{new}} = x - \text{lr} \cdot \text{gradient}
\end{aligned}
```

طريقة نيوتن تحل محل معدل التعلم المتعدد بالهسيان المعاكس. هذا يعدل تلقائيًا حجم الخطوة والاتجاه بناءً على التوتر المحلي.

```mermaid
graph TD
    subgraph "Gradient Descent"
        GD1["Start"] --> GD2["Step 1"]
        GD2 --> GD3["Step 2"]
        GD3 --> GD4["..."]
        GD4 --> GD5["Step ~500: Converged"]
        GD_note["Follows gradient blindly — many small steps"]
    end
    subgraph "Newton's Method"
        NM1["Start"] --> NM2["Step 1"]
        NM2 --> NM3["..."]
        NM3 --> NM4["Step ~5: Converged"]
        NM_note["Uses curvature for optimal steps"]
    end
```

المزايا:
- التقارب التربيعي بالقرب من الحد الأدنى (مربع الخطأ في كل خطوة)
- لا معدل تعلم للتنسيق
- متغير النطاق (يعمل بغض النظر عن كيفية تعريف المشكلة)

الإعاقة:
- حساب التكاليف الهسية $O(n^2)$الذاكرة و$O(n^3)$لتحويل
- لشبكة عصبية مع مليون وزن، وهذا هو $10^{12}$الإدخالات و$10^{18}$العمليات
- غير مميز للتعلم العميق

### التحسين المحدود

التحسين غير المقيد: تقليل $f(x)$على كل شيء$x$. . .
التحسين المحدود: تقليل $f(x)$تخضع لقيود

المشكلة الحقيقية لها قيود تريد تقليل التكلفة ولكن ميزانيتك محدودة تريد تقليل الأخطاء ولكن تعقييد النموذج محدود

```mermaid
graph LR
    subgraph "Unconstrained"
        U1["Loss function"] --> U2["Free minimum: lowest point of the loss surface"]
    end
    subgraph "Constrained"
        C1["Loss function"] --> C2["Constrained minimum: lowest point within the feasible region"]
        C3["Constraint boundary limits the search space"]
    end
```

### مضاعفات اللجرنج

طريقة مضاعفات لاغرانج تحويل مشكلة مقيدة إلى مشكلة غير مقيدة.

المشكلة: تقليل$f(x)$تخضع لـ$g(x) = 0$. . .

الحل: إدخال متغير جديد (مضاعف لاغرانج $\lambda$) وحل المشكلة غير المحدودة:

```math
L(x, \lambda) = f(x) + \lambda g(x)
```

عند الحل، تراجع $L$هو صفر:

```math
\begin{aligned}
\frac{\partial L}{\partial x} &= \frac{\partial f}{\partial x} + \lambda \frac{\partial g}{\partial x} = 0 \\
\frac{\partial L}{\partial \lambda} &= g(x) = 0
\end{aligned}
```

الحد الأدنى المحدود، تراجع $f$يجب أن تكون متوازية مع تراجع القيود $g$إذا لم تكن متوازية، يمكنك التحرك على طول سطح القيود وتقليل$f$-إلى أبعد من ذلك

```mermaid
graph LR
    A["Contours of f(x,y): concentric ellipses"] --- S["Solution point"]
    B["Constraint curve g(x,y) = 0"] --- S
    S --- C["At the solution, gradient of f is parallel to gradient of g"]
```

مثال: تقليل$f(x,y) = x^2 + y^2$تخضع لـ$x + y = 1$. . .

```math
\begin{aligned}
L &= x^2 + y^2 + \lambda(x + y - 1) \\[4pt]
\frac{\partial L}{\partial x} &= 2x + \lambda = 0 \implies x = -\lambda/2 \\
\frac{\partial L}{\partial y} &= 2y + \lambda = 0 \implies y = -\lambda/2 \\
\frac{\partial L}{\partial \lambda} &= x + y - 1 = 0 \\[4pt]
&\text{From first two: } x = y \\
&\text{Substituting: } 2x = 1, \text{ so } x = y = 0.5, \ \lambda = -1
\end{aligned}
```

أقرب نقطة على الخط$x + y = 1$إلى المنشأ هو $(0.5, 0.5)$. . .

### شروط الـ KKT

ظروف كاروش-كوهن-توكر تمتد مضاعفات لاجرنج إلى قيود عدم المساواة.

المشكلة: تقليل$f(x)$تخضع لـ$g_i(x) \le 0$لـ$i = 1, \ldots, m$. . .

ظروف KKT (التي تكون ضرورية لتحقيق التكمل الأمثل):

```math
\begin{aligned}
&\text{1. Stationarity:} && \frac{\partial f}{\partial x} + \sum_i \lambda_i \frac{\partial g_i}{\partial x} = 0 \\
&\text{2. Primal feasibility:} && g_i(x) \le 0 \quad \text{for all } i \\
&\text{3. Dual feasibility:} && \lambda_i \ge 0 \quad \text{for all } i \\
&\text{4. Complementary slackness:} && \lambda_i \, g_i(x) = 0 \quad \text{for all } i
\end{aligned}
```

التباطل المكمل هو المفهوم الرئيسي: إما أن القيود نشطة ($g_i = 0$، يقع الحل على الحدود) أو المضاعف هو صفر (القيود لا يهم).$\lambda = 0$. . .

ظروف كيكت هي المركزية لسي.إف.إم. المتجهات الداعمة هي نقاط البيانات التي يكون فيها القيود نشطا ($\lambda > 0$كل نقاط البيانات الأخرى لديها$\lambda = 0$ولا تؤثر على حدود القرار

### التنظيم كتحسين محدود

إن تنظيم L1 و L2 ليسوا خدوش تعسفية بل مشاكل تحسين محدودة في التظاهر.

**L2 regularization (Ridge):**

```math
\begin{aligned}
&\text{minimize } \text{Loss}(w) \text{ subject to } \lVert w \rVert^2 \le t \\[4pt]
&\text{Equivalent unconstrained form:} \\
&\text{minimize } \text{Loss}(w) + \lambda \lVert w \rVert^2
\end{aligned}
```

القيود$\lVert w \rVert^2 \le t$يحدد الكرة (حلقة في 2D، كرة في 3D). الحل هو حيث أن خطوط الخسارة تلمس هذه الكرة أولا.

**L1 regularization (LASSO):**

```math
\begin{aligned}
&\text{minimize } \text{Loss}(w) \text{ subject to } \lVert w \rVert_1 \le t \\[4pt]
&\text{Equivalent unconstrained form:} \\
&\text{minimize } \text{Loss}(w) + \lambda \lVert w \rVert_1
\end{aligned}
```

القيود$\lVert w \rVert_1 \le t$يحدد الماس (الرابع المدوّر في 2D).

| Property | L2 constraint (circle) | L1 constraint (diamond) |
|---|---|---|
| **Constraint shape** | Circle (sphere in higher dims) | Diamond (rotated square in 2D) |
| **Where loss contour touches** | Smooth boundary — any point on the circle | Corner — aligned with an axis |
| **Solution behavior** | Weights are small but nonzero | Some weights are exactly zero (sparse) |
| **Result** | Weight shrinkage | Feature selection |

هذا يفسر لماذا تنتج L1 نماذج نادرة (اختيار الميزات) بينما L2 تقلص فقط من الوزن. الماس لديه زوايا متسلطة مع المحاور. من المرجح أن تلمس خطوط الخسارة زاوية ، مما يضع وزن واحد أو أكثر بالضبط إلى الصفر.

### الثنائي

كل مشكلة تحسين مقيد (الأولي) لديها مشكلة رفيقة (المتزامن). بالنسبة للمشاكل المتواصلة، فإن الأولي والمتزامن لديهم نفس القيمة المثلى. هذه ثنائية قوية.

وظيفة لاجرنجية مزدوجة:

```math
\begin{aligned}
&\text{Primal:} && \text{minimize } f(x) \text{ subject to } g(x) \le 0 \\
&\text{Lagrangian:} && L(x, \lambda) = f(x) + \lambda g(x) \\
&\text{Dual function:} && d(\lambda) = \min_x L(x, \lambda) \\
&\text{Dual problem:} && \text{maximize } d(\lambda) \text{ subject to } \lambda \ge 0
\end{aligned}
```

لماذا الثنائيات مهمة:
- المشكلة المزدوجة أسهل في بعض الأحيان لحلها من المشكلة الأساسية
- يتم حل SVM في شكلها المزدوج ، حيث تعتمد المشكلة على منتجات النقاط بين نقاط البيانات (تمكين خدعة النواة)
- يقدم المزدوج حدوداً أدناه على المثالي الأولي، مفيدًا للتحقق من جودة الحل

بالنسبة لـ (SVM) على وجه التحديد:

```
Primal: find w, b that maximize the margin 2/||w|| subject to
        y_i(w^T x_i + b) >= 1 for all i

Dual:   maximize sum(alpha_i) - 0.5 * sum_ij(alpha_i * alpha_j * y_i * y_j * x_i^T x_j)
        subject to alpha_i >= 0 and sum(alpha_i * y_i) = 0

The dual only involves dot products x_i^T x_j.
Replace x_i^T x_j with K(x_i, x_j) to get the kernel trick.
```

### لماذا يتحسن التعلم العميق على الرغم من عدم التواصل

وظائف فقدان الشبكة العصبية غير متواصلة بشكل كبير. من خلال كل قياس كلاسيكي، يجب أن تفشل تحسينها. ومع ذلك، فإن هبوط التراجع الاستوتيكي يجد حلول جيدة بشكل موثوق. العديد من العوامل تفسر هذا.

**Most local minima are good enough.**في المساحات العالية الأبعاد، النقاط الحرجة العشوائية (حيث يكون التراجع صفر) هي نقاط القيادة بشكل ساحق، وليس الحد الأدنى المحلي. القليل من الحد الأدنى المحلي الموجودة تميل إلى أن يكون لها قيم الخسارة القريبة من الحد الأدنى العالمي. فمن غير المرجح للغاية أن تكون عالقة في الحد الأدنى المحلي الفظيع عندما يكون مساحة المعلمات مليوني أبعاد.

**Saddle points, not local minima, are the real obstacle.**في وظيفة مع$n$في المعلمات، نقطة السرير لديها مزيج من اتجاهات التوتر الإيجابية والسلبية. بالنسبة لمكان حرج عشوائي في أبعاد عالية، احتمال جميع $n$القيم الخاصة تكون إيجابية (الأدنى المحلي) تقريبًا $2^{-n}$تقريباً كل النقاط الحرجة هي نقاط السرير ضوضاء المراقبة تساعد على الهروب منها

**Overparameterization smooths the landscape.**شبكات ذات ملامح أكثر من أمثلة التدريب لديها أسطح الخسارة أكثر سلاسة، والمزيد من الاتصال. شبكات أوسع لديها أدنى الحد الأدنى المحلي السيئ. هذا غير بديهي ولكن ثابت تجريبيا.

**Loss landscape structure:**

| Property | Low-dimensional space | High-dimensional space |
|---|---|---|
| **Landscape** | Many isolated peaks and valleys | Smoothly connected valleys |
| **Minima** | Many isolated local minima | Few bad local minima; most are near-optimal |
| **Navigation** | Hard to find global minimum | Many paths lead to good solutions |
| **Critical points** | Mix of local minima and saddle points | Overwhelmingly saddle points, not local minima |

**Stochastic noise acts as implicit regularization.**تضيف SGD الارتباطات الصغيرة الضجيج الذي يمنع الاستقرار في الحد الأدنى الحاد. الحد الأدنى الحاد يزيد من التكيف؛ الحد الأدنى السطح يعملي. التحيز الضجيج تحسين نحو المناطق السطحية لمشهد الخسائر.

### أساليب النظام الثاني في الممارسة العملية

طريقة نيوتن النقية غير عملية للنماذج الكبيرة. العديد من التقارير تجعل المعلومات من الدرجة الثانية قابلة للاستخدام.

**L-BFGS (Limited-memory BFGS):**يقترب من الـ Hessian المُعكس باستخدام آخر $m$الاختلافات في التراجع.$O(mn)$الذاكرة بدلاً من$O(n^2)$يعمل بشكل جيد للمشاكل التي تصل إلى ~ 10,000 ملامح. يستخدم في ML الكلاسيكية (التراجع اللوجستي ، CRFs) ولكن ليس التعلم العميق.

**Natural gradient:**يستخدم مصفوفة معلومات فيشر (الهيسيان المتوقع من احتمالات التسجيل) بدلاً من المصفوفة المعتادة. هذا يعطي حساب لجيومétrي توزيعات الاحتمالات. K-FAC (Kronecker-Factored Approximate Curvature) يقترب من مصفوفة فيشر كمنتج كروينكر ، مما يجعلها عملية للشبكات العصبية.

**Hessian-free optimization:**يستخدم التراجع المشترك لحل$Hx = g$دون أن تتشكل أبداً$H$. فقط يتطلب محولات متجهة هيسيان، والتي يمكن حسابها في $O(n)$الوقت عن طريق التمييز الآلي.

**Diagonal approximations:**اللحظة الثانية لآدم هي تقارب متقطع مع متقطع هيسيان. يمتد AdaHessian هذا باستخدام عناصر متقطع هيسيان الفعلية عبر مقياس هاتشينسون.

| Method | Memory | Per-step cost | When to use |
|--------|--------|--------------|-------------|
| Gradient descent | $O(n)$ | $O(n)$ | Baseline, large models |
| Newton's method | $O(n^2)$ | $O(n^3)$ | Small convex problems |
| L-BFGS | $O(mn)$ | $O(mn)$ | Medium convex problems |
| Adam | $O(n)$ | $O(n)$ | Deep learning default |
| K-FAC | $O(n)$ | $O(n)$ per layer | Research, large-batch training |

```figure
convex-vs-nonconvex
```

## بناءها

### الخطوة الأولى: فحص التوتر

بناء وظيفة التي تختبر التخفيف تجريبيا عن طريق أخذ عينات من نقاط وتحقق من التعريف.

```python
import random
import math

def check_convexity(f, dim, bounds=(-5, 5), samples=1000):
    violations = 0
    for _ in range(samples):
        x = [random.uniform(*bounds) for _ in range(dim)]
        y = [random.uniform(*bounds) for _ in range(dim)]
        t = random.uniform(0, 1)
        mid = [t * xi + (1 - t) * yi for xi, yi in zip(x, y)]
        lhs = f(mid)
        rhs = t * f(x) + (1 - t) * f(y)
        if lhs > rhs + 1e-10:
            violations += 1
    return violations == 0, violations
```

### الخطوة الثانية: طريقة نيوتن للثانية

قم بتطبيق طريقة نيوتن باستخدام هسيان صريح. قارن سرعة التقارب مع انخفاض التراجع.

```python
def newtons_method(f, grad_f, hessian_f, x0, steps=50, tol=1e-12):
    x = list(x0)
    history = [x[:]]
    for _ in range(steps):
        g = grad_f(x)
        H = hessian_f(x)
        det = H[0][0] * H[1][1] - H[0][1] * H[1][0]
        if abs(det) < 1e-15:
            break
        H_inv = [
            [H[1][1] / det, -H[0][1] / det],
            [-H[1][0] / det, H[0][0] / det],
        ]
        dx = [
            H_inv[0][0] * g[0] + H_inv[0][1] * g[1],
            H_inv[1][0] * g[0] + H_inv[1][1] * g[1],
        ]
        x = [x[0] - dx[0], x[1] - dx[1]]
        history.append(x[:])
        if sum(gi ** 2 for gi in g) < tol:
            break
    return history
```

### الخطوة الثالثة: محلل مضاعف اللجرنج

حل التحسين المحدود باستخدام انخفاض التدرج على لغرانجي.

```python
def lagrange_solve(f_grad, g_val, g_grad, x0, lr=0.01,
                   lr_lambda=0.01, steps=5000):
    x = list(x0)
    lam = 0.0
    history = []
    for _ in range(steps):
        fg = f_grad(x)
        gv = g_val(x)
        gg = g_grad(x)
        x = [
            xi - lr * (fgi + lam * ggi)
            for xi, fgi, ggi in zip(x, fg, gg)
        ]
        lam = lam + lr_lambda * gv
        history.append((x[:], lam, gv))
    return history
```

### الخطوة الرابعة: مقارنة النظام الأول والنظام الثاني

أستخدم طريقة نيوتن على نفس المرتبة، و أعد الخطوات إلى التقارب

```python
def quadratic(x):
    return 5 * x[0] ** 2 + x[1] ** 2

def quadratic_grad(x):
    return [10 * x[0], 2 * x[1]]

def quadratic_hessian(x):
    return [[10, 0], [0, 2]]
```

طريقة نيوتن سوف تتحرك في خطوة واحدة (إنها دقيقة بالنسبة إلى التربيعية). سيقوم التنزل التدريجي بمئات الخطوات لأن القيم الخاصة لـ Hessian تختلف بمعدل 5 ، مما يخلق واديًا مُطولًا.

## استخدمها

تحليل التخثر ينطبق مباشرة عند اختيار نماذج وموصلات ML.

بالنسبة للمشاكل المتعثرة (التراجع اللوجستي، SVMs، LASSO):
- استخدام حلول مخصصة (liblinear، CVXPY، scipy.optimize.minimize مع طريقة='L-BFGS-B')
- توقع حل عالمي فريد
- أساليب النظام الثاني عملية و سريعة

بالنسبة للمشاكل غير الملتوية (شبكات عصبية):
- استخدام أساليب النظام الأول (SGD، آدم)
- اقبل أن الحل يعتمد على البداية والتصوير عشوائي
- استخدام المقاييس المفرطة، الضوضاء، وخطوط جدول معدل التعلم كتنظيم ضمني
- لا تضيعوا الوقت في البحث عن الحد الأدنى العالمي. الحد الأدنى المحلي الجيد يكفي.

```python
from scipy.optimize import minimize

result = minimize(
    fun=lambda w: sum((y - X @ w) ** 2) + 0.1 * sum(w ** 2),
    x0=np.zeros(d),
    method='L-BFGS-B',
    jac=lambda w: -2 * X.T @ (y - X @ w) + 0.2 * w,
)
```

بالنسبة لـ SVM، يسمح لك الصيغة المزدوجة باستخدام خدعة النواة:

```python
from sklearn.svm import SVC

svm = SVC(kernel='rbf', C=1.0)
svm.fit(X_train, y_train)
print(f"Support vectors: {svm.n_support_}")
```

## التمارين

1. **Convexity gallery.**اختبر هذه الوظائف لتحديد الارتباط باستخدام المحقق: $f(x) = x^4$،$f(x) = \sin(x)$،$f(x,y) = x^2 + y^2$،$f(x,y) = xy$،$f(x) = \max(x, 0)$اشرح لماذا كل نتيجة لها معنى

2. **Newton vs gradient descent race.**أستخدم كلا الطرقين$f(x,y) = 50x^2 + y^2$من نقطة البداية$(10, 10)$كم خطوة تحتاج كل واحد للوصول إلى الخسارة < 1e-10؟ ماذا يحدث لسقوط التراجع عند زيادة عدد الحالة (النسبة من أكبر إلى أصغر قيمة خاصة هيسسي) ؟

3. **Lagrange multiplier geometry.**تقليل$f(x,y) = (x-3)^2 + (y-3)^2$تخضع لـ$x + 2y = 4$التحقق من الحل عن طريق التحقق من أن تراجع$f$هو متوازي مع تراجع $g$في الحل

4. **Regularization constraint.**تنفيذ التحسينات المحدودة لـ L1: تقليل$(x-3)^2 + (y-2)^2$تخضع لـ$\lvert x \rvert + \lvert y \rvert \le 1$. إظهار أن الحل لديه إحداثيات تساوي الصفر (المتناثرة من قيود الماس).

5. **Hessian eigenvalue analysis.**احسب Hessian من وظيفة روزنبروك في (1,1) و (-1,1). احسب القيم الخاصة في كلا النقاط. ماذا تخبرك القيم الخاصة عن التوتر في الحد الأدنى مقابل بعيدا عنه؟

### إشارات

**Exercise 1.**توقع كل نتيجة قبل أن تهرب`check_convexity`: في بعد واحد، انظر إلى علامة$f''(x)$في ابعدين، انظر إلى القيم الخاصة لـ Hessian.$f(x,y) = xy$، والهسسي لديها قيم خاصة 1 و -1, لذلك يجب على المحقق الإبلاغ عن أنه ليس متواضع.

**Exercise 2.**اتصل`optimize_gd`و`newtons_method`مع التراجع والهسسي $f$طريقة نيوتن تحل مربع في خطوة واحدة. لتنزيل التراجع، يجب أن يكون معدل التعلم أقل من $2/100$بسبب$50x^2$المفهوم، لذلك $y$اتجاه يتحرك ببطء. كرر مع $100x^2$و أعد الخطوات مرة أخرى

**Exercise 3.**استخدام`lagrange_solve`مع$g(x,y) = x + 2y - 4$عند الإجابة، تحقق من ذلك$x + 2y = 4$و هذا$\nabla f = (2(x-3), 2(y-3))$هو مضاعف من$\nabla g = (1, 2)$. . .

**Exercise 4.**الحد الأدنى غير المقيد (3, 2) خارج الماس، لذلك الجواب على حدودها. استخدم انخفاض تراجعي مشروع: اتخاذ خطوة تراجعي، ثم إلقاء العودة على $\lvert x \rvert + \lvert y \rvert \le 1$تحقق من أن النتيجة تلبي القيود مع المساواة ومقارنة مع`demo_regularization_geometry`. . .

**Exercise 5.**اتصل`rosenbrock_hessian`في كل نقطة ونقل النتيجة إلى`hessian_eigenvalues_2d`عند (1, 1) ، كل من القيم الخاصة إيجابية ونسبةهم كبيرة جدا، لذلك الوادي ضيق في اتجاه واحد وسط في الآخر. مقارنة هذا النسبة مع النسبة في (-1, 1).

## الشروط الرئيسية

| Term | What it means |
|------|---------------|
| Convex set | A set where the line segment between any two points in the set stays inside the set |
| Convex function | A function where the line between any two points on its graph lies above or on the graph. Equivalently, Hessian is positive semidefinite everywhere |
| Local minimum | A point lower than all nearby points. For convex functions, every local minimum is the global minimum |
| Global minimum | The lowest point of a function over its entire domain |
| Hessian matrix | The matrix of all second partial derivatives. Encodes curvature information |
| Positive semidefinite | A matrix whose eigenvalues are all non-negative. The multidimensional analogue of "second derivative >= 0" |
| Condition number | Ratio of largest to smallest eigenvalue of the Hessian. High condition number means elongated valleys and slow gradient descent |
| Newton's method | Second-order optimizer that uses the inverse Hessian to determine step direction and size. Quadratic convergence near the minimum |
| Lagrange multiplier | A variable introduced to convert a constrained optimization problem into an unconstrained one |
| KKT conditions | Necessary conditions for optimality with inequality constraints. Generalize Lagrange multipliers |
| Complementary slackness | At the solution, either a constraint is active or its multiplier is zero. Never both nonzero |
| Duality | Every constrained problem has a companion dual problem. For convex problems, both have the same optimal value |
| Strong duality | Primal and dual optimal values are equal. Holds for convex problems satisfying Slater's condition |
| L-BFGS | Approximate second-order method that stores the last $m$ gradient differences instead of the full Hessian |
| Saddle point | A point where the gradient is zero but it is a minimum in some directions and a maximum in others |
| Overparameterization | Using more parameters than training examples. Smooths the loss landscape and reduces bad local minima |

## المزيد من القراءة

- [Boyd & Vandenberghe: Convex Optimization](https://web.stanford.edu/~boyd/cvxbook/)- الكتب المدرسية القياسية، متوفرة مجانًا على الإنترنت
- [Bottou, Curtis, Nocedal: Optimization Methods for Large-Scale Machine Learning (2018)](https://arxiv.org/abs/1606.04838)- الجسور نظرية التحسين الملتوية وممارسة التعلم العميق
- [Choromanska et al.: The Loss Surfaces of Multilayer Networks (2015)](https://arxiv.org/abs/1412.0233)- لماذا لا تكون المناظر الطبيعية الشبكة العصبية الملتوية سيئة كما تبدو
- [Nocedal & Wright: Numerical Optimization](https://link.springer.com/book/10.1007/978-0-387-40065-5)- إشارة شاملة لنهج نيوتن، L-BFGS، وتحسين القيود
