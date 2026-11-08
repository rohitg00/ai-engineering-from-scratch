# بهینه سازی مخروط

> مشکلات مخلوط یک دره دارند شبکه های عصبی میلیون ها هستند. دانستن تفاوت مهم است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 04 (Calculus for ML), 08 (Optimization)
**Time:** ~90 minutes

## اهداف یادگیری

- آزمایش اینکه آیا یک تابع با استفاده از تعریف، مشتق دوم و معیارهای هسیان مخلوط است
- روش نیوتن را اجرا کنید و کنورژن مربع آن را با کاهش گرادیانت مقایسه کنید
- حل مشکلات بهینه سازی محدود با استفاده از ضربات لاگرنج و تفسیر شرایط KKT
- توضیح بده چرا منظره ی تلف شدن شبکه عصبی غیر متناوب است ولی SGD هنوز راه حل های خوبی پیدا می کند

## مشکل

درس ۸ به شما کاهش گرادینت، حرکت و آدم یاد داد. این بهینه سازی ها در هر سطح به پایین می روند. اما بدون هیچ تضمینی می آیند. کاهش گرادینت در یک منظره غیر خمیده ممکن است در حداقل محلی ضعیف فرود بیاید، در یک نقطه سعد گیر شود یا برای همیشه نوسان کند. شما به هر حال از آن استفاده کردید زیرا شبکه های عصبی خمیده نیستند و هیچ جایگزین ای وجود ندارد.

اما بسیاری از مشکلات یادگیری ماشین مخلوط هستند. بازپسین خطی، بازپسین لجستیک، SVM، LASSO، بازپسین خطی. برای این ها، چیزی قوی تر وجود دارد: بهینه سازی با تضمین های ریاضی. یک مشکل مخلوط هیچ دره ی دروغین ندارد: هر حداقل محلی حداقل جهانی است. برای یک تابع مخروط صاف که حداقل باشد، نزول گرادینت با اندازه پله مناسب به آن نزدیک می شود. نیازی به بازشویی نیست. هیچ برنامه ای برای یادگیری نیست دعا نکن

درک کنوکسیت سه چیز را انجام می دهد. اول، آن به شما می گوید که مشکل شما آسان (کونیکس) در مقابل سخت (غیر کنوکس) است. دوم، آن به شما ابزار سریع تر مانند روش نیوتن برای مشکلات کنوکس می دهد. سوم، آن مفاهیم را که در سراسر ML ظاهر می شود توضیح می دهد: تنظیم به عنوان یک محدودیت، دوگانه در SVMs، و چرا یادگیری عمیق با نقض هر ویژگی خوب کنوکسیت به شما می دهد کار می کند.

## مفهوم

### مجموعه های مخلوط

يه مجموعه$S$اگر برای هر دو نقطه در $S$، بخش خط بین آنها هم به طور کامل در $S$. .

| Convex sets | Not convex |
|---|---|
| **Rectangle**: any two points inside can be connected by a line segment that stays inside | **Star/crescent shape**: a line between two interior points can pass outside the set |
| **Triangle**: same property holds for all interior points | **Donut/annulus**: the hole means some line segments leave the set |
| The line segment between any two points stays within the set | The line segment between some pairs of points exits the set |

آزمون رسمی: برای هر نقطه ای$x, y$در$S$و هر کدام$t \in [0, 1]$، نکته$tx + (1-t)y$هم در$S$. .

نمونه های مجموعه های مخروط:
- خط، هواپيما، همه چيز$\mathbb{R}^n$
- یک توپ (دوگ، توپ، هیپر اسپیر)
- نصف فضا:$\lbrace x : a^T x \le b \rbrace$
- متقاطع هر عدد مجموعه های مخروط

نمونه های مجموعه های غیر خمیده:
- یک دونات (آنولوس)
- اتحاد دو دایره متناقض
- هر مجموعه ای که دارای "دنت" یا "جره" باشد

### عملکردهای مخروط

یک تابع$f$اگر دامنه آن مجموعه ای مخلوط باشد و برای هر دو نقطه باشد مخلوط است$x, y$در حوزه ی خود و هر$t \in [0, 1]$:

```math
f(tx + (1-t)y) \le t f(x) + (1-t) f(y)
```

از لحاظ هندسی: قطعه خط بین هر دو نقطه در نمودار در بالای یا در نمودار قرار دارد.

| Property | Convex function | Non-convex function |
|---|---|---|
| **Line segment test** | The line between any two points on the graph lies **above or on** the curve | The line between some points on the graph dips **below** the curve |
| **Shape** | Single bowl/valley curving upward | Multiple peaks and valleys with mixed curvature |
| **Local minima** | Every local minimum is the global minimum | Multiple local minima may exist at different heights |

عملکردهای مخروط مشترک:
- $f(x) = x^2$(مثل)
- $f(x) = \lvert x \rvert$(قیمت مطلق)
- $f(x) = e^x$(معدل)
- $f(x) = \max(0, x)$(ReLU، هر چند قطعه خطی)
- $f(x) = -\log(x)$برای$x > 0$(سوابق منفی)
- هر تابع خطی $f(x) = a^T x + b$(هم مخلوط و هم مخلوط)

### آزمایش تراکم

سه آزمون عملي از ساده ترين تا سخت ترين

**Test 1: Second derivative test (1D).**اگه$f''(x) \ge 0$برای همه$x$، پس$f$مخروط است.

- $f(x) = x^2$.$f''(x) = 2 \ge 0$. مخلوط
- $f(x) = x^3$.$f''(x) = 6x$. منفی برای$x < 0$نه مخروط
- $f(x) = e^x$.$f''(x) = e^x > 0$. مخلوط

**Test 2: Hessian test (multivariate).**اگر ماتریکس هسی$H(x)$مثبت است و برای همه نصف مشخصه$x$، پس$f$مخلوط است. Hessian ماتریس مشتق های جزئی دوم است.

**Test 3: Definition test.**نابرابری رو چک کن$f(tx + (1-t)y) \le t f(x) + (1-t) f(y)$به طور مستقیم. برای عملکردهایی که مشتقات سخت محاسبه می شوند مفید است.

### چرا تعقيب مهم است

نظریه مرکزی بهینه سازی مخروط:

**For a convex function, every local minimum is a global minimum.**

این بدان معنی است که نشت gradient نمی تواند در یک حداقل محلی بد گیر شود. هر حداقل می تواند به آن برسد از دست دادن یکسان دارد. برای یک عملکرد مخروط صاف که دارای حداقل است، نشت gradient با اندازه پله مناسب تضمین شده است که به ارزش مطلوب نزدیک شود.

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

پیامدهای:
- نیازی به بازخورد تصادفی نیست
- نیازی به برنامه های پیشرفته یادگیری نیست
- اثبات تراکم ممکن است (سرمایه بستگی به خواص تابع دارد)
- راه حل منحصر به فرد است (تا مناطق صاف)

### مخلوط با غیر مخلوط در ML

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

مدل های خطی با ضایعات مخروط مخروط هستند. وقتی لایه های پنهان با فعال سازی های غیر خطی اضافه می کنید، مخروطیت شکسته می شود.

### ماتریکس هسی

هسیان$H$یک تابع$f: \mathbb{R}^n \to \mathbb{R}$.$n \times n$ماتریک مشتق های جزئی دوم

```math
H_{ij} = \frac{\partial^2 f}{\partial x_i \, \partial x_j}
```

برای$f(x, y) = x^2 + 3xy + y^2$:

```math
\begin{gathered}
\begin{aligned}
\frac{\partial f}{\partial x} &= 2x + 3y & \frac{\partial^2 f}{\partial x^2} &= 2 & \frac{\partial^2 f}{\partial x \, \partial y} &= 3 \\
\frac{\partial f}{\partial y} &= 3x + 2y & \frac{\partial^2 f}{\partial y \, \partial x} &= 3 & \frac{\partial^2 f}{\partial y^2} &= 2
\end{aligned} \\[8pt]
H = \begin{bmatrix} 2 & 3 \\ 3 & 2 \end{bmatrix}
\end{gathered}
```

" هسی " به شما در مورد منحنیات میگه:
- ارزش های خاص تمام مثبت: تابع در هر جهت به بالا منحنی می شود (به این نقطه مخلوط است)
- ارزش های خاص تمام منفی: منحنیات به سمت پایین در هر جهت (کونکاو، حداکثر محلی)
- نشانه های مخلوط: نقطه سیله (در برخی جهت ها به بالا و در برخی دیگر به پایین خم می شود)
- ارزش خاص صفر: مسطح در این جهت (از دست رفته)

برای خم شدن، Hessian باید نیمه مشخص مثبت باشد (همه ارزش های خاص $\ge 0$) همه جا، نه فقط در یک نقطه.

### روش نیوتن

در حال حاضر، در حال کاهش درجه بندی، اطلاعات درجه اول (در حال گرادینت) استفاده می شود. روش نیوتن از اطلاعات درجه دوم (در حال هسیان) استفاده می کند. این یک مقربات مربع در نقطه فعلی مناسب است و مستقیما به حداقل این مربع می رود.

```math
\begin{aligned}
\text{Update rule:} \quad & x_{\text{new}} = x - H^{-1} \cdot \text{gradient} \\
\text{Compare to gradient descent:} \quad & x_{\text{new}} = x - \text{lr} \cdot \text{gradient}
\end{aligned}
```

روش نیوتن سرعت یادگیری مقیاس را با Hessian معکوس جایگزین می کند. این به طور خودکار اندازه و جهت گام را بر اساس منحنیات محلی تنظیم می کند.

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

مزایا:
- تراکم مربع نزدیک به حداقل (مربع خطای هر مرحله)
- بدون سرعت یادگیری برای تنظیم
- تغییر مقیاس (به هر حال کار می کند، بدون توجه به اینکه چگونه شما مشکل را پارامتر می کنید)

معایب:
- محاسبه هزینه های هسیانی $O(n^2)$حافظه و$O(n^3)$برای برگشت
- برای یک شبکه عصبی با یک میلیون وزن، این است$10^{12}$نوشته ها و$10^{18}$عملیات
- برای یادگیری عمیق عملی نیست

### بهینه سازی محدود

بهینه سازی بدون محدودیت: به حداقل رساندن$f(x)$همه چیز رو$x$. .
بهینه سازی محدود: به حداقل رساندن$f(x)$با محدودیت ها

مشکلات واقعی محدودیت هایی دارند. شما می خواهید هزینه ها را به حداقل برسانید اما بودجه شما محدود است. شما می خواهید خطا ها را به حداقل برسانید اما پیچیدگی مدل شما محدود است.

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

### ضربگر های لاگارنج

روش ضربگرهای لاگرنج یک مشکل محدود را به یک مشکل بدون محدودیت تبدیل می کند.

مشکل: حداقلش$f(x)$تابع$g(x) = 0$. .

راه حل: معرفی یک متغیر جدید (گوهرگر لاگارنج)$\lambda$) و حل مشکل بدون محدودیت:

```math
L(x, \lambda) = f(x) + \lambda g(x)
```

در محلول، گرادینت $L$صفر است:

```math
\begin{aligned}
\frac{\partial L}{\partial x} &= \frac{\partial f}{\partial x} + \lambda \frac{\partial g}{\partial x} = 0 \\
\frac{\partial L}{\partial \lambda} &= g(x) = 0
\end{aligned}
```

حس هندسی: در حداقل محدود، گرادینت $f$باید موازی با گرادینت محدودیت باشد$g$اگه موازی نبودن میتونی در طول سطح محدودیت حرکت کنی و کاهش$f$بیشتر

```mermaid
graph LR
    A["Contours of f(x,y): concentric ellipses"] --- S["Solution point"]
    B["Constraint curve g(x,y) = 0"] --- S
    S --- C["At the solution, gradient of f is parallel to gradient of g"]
```

مثال: حداقلش کنید$f(x,y) = x^2 + y^2$تابع$x + y = 1$. .

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

نزدیک ترین نقطه خط$x + y = 1$به اصلش$(0.5, 0.5)$. .

### شرایط KKT

شرایط کاروش-کوهن-تکر ضربات لاگرنج را به محدودیت های نابرابری گسترش می دهد.

مشکل: حداقلش$f(x)$تابع$g_i(x) \le 0$برای$i = 1, \ldots, m$. .

شرایط KKT (ضروری برای بهینه سازی):

```math
\begin{aligned}
&\text{1. Stationarity:} && \frac{\partial f}{\partial x} + \sum_i \lambda_i \frac{\partial g_i}{\partial x} = 0 \\
&\text{2. Primal feasibility:} && g_i(x) \le 0 \quad \text{for all } i \\
&\text{3. Dual feasibility:} && \lambda_i \ge 0 \quad \text{for all } i \\
&\text{4. Complementary slackness:} && \lambda_i \, g_i(x) = 0 \quad \text{for all } i
\end{aligned}
```

کمکی اضافی بینش اصلی است: یا محدودیت فعال است ($g_i = 0$، محلول روی مرز قرار دارد) یا ضربگر صفر است (محدودیت مهم نیست).$\lambda = 0$. .

شرایط KKT برای SVM ها محور هستند. ویکتورهای پشتیبانی نقاط داده هایی هستند که در آن محدودیت فعال است ($\lambda > 0$) همه نقاط داده های دیگر دارای$\lambda = 0$و بر مرز تصمیم گیری تاثیر نمی گذارند.

### تنظیم به عنوان بهینه سازی محدود

تنظیم L1 و L2 ترفند های تعسفی نیستند بلکه مشکلات بهینه سازی محدود در حال پنهان شدن هستند.

**L2 regularization (Ridge):**

```math
\begin{aligned}
&\text{minimize } \text{Loss}(w) \text{ subject to } \lVert w \rVert^2 \le t \\[4pt]
&\text{Equivalent unconstrained form:} \\
&\text{minimize } \text{Loss}(w) + \lambda \lVert w \rVert^2
\end{aligned}
```

محدودیت$\lVert w \rVert^2 \le t$یک توپ را تعریف می کند (دو بعدی دایره، دو بعدی توپ) راه حل این است که خطوط ضایع اول این توپ را لمس می کنند.

**L1 regularization (LASSO):**

```math
\begin{aligned}
&\text{minimize } \text{Loss}(w) \text{ subject to } \lVert w \rVert_1 \le t \\[4pt]
&\text{Equivalent unconstrained form:} \\
&\text{minimize } \text{Loss}(w) + \lambda \lVert w \rVert_1
\end{aligned}
```

محدودیت$\lVert w \rVert_1 \le t$یک الماس را تعریف می کند ( مربع چرخش در 2D).

| Property | L2 constraint (circle) | L1 constraint (diamond) |
|---|---|---|
| **Constraint shape** | Circle (sphere in higher dims) | Diamond (rotated square in 2D) |
| **Where loss contour touches** | Smooth boundary — any point on the circle | Corner — aligned with an axis |
| **Solution behavior** | Weights are small but nonzero | Some weights are exactly zero (sparse) |
| **Result** | Weight shrinkage | Feature selection |

این توضیح می دهد که چرا L1 مدل های کمیاب (انتخاب ویژگی ها) را تولید می کند در حالی که L2 فقط وزن را کاهش می دهد. الماس گوشه هایی را با محورها خط می دهد. خطوط از دست دادن بیشتر احتمال دارد به گوشه ای لمس کند و یک یا چند وزن را دقیقا به صفر تنظیم کند.

### دوگانه بودن

هر مشکل بهینه سازی محدود (اول) یک مشکل همراه (دوگانه) دارد. برای مشکلات مخلوط، اول و دوگانه دارای همان ارزش مطلوب هستند. این دوگانه ی قوی است.

تابع دوگانه لاگارنج:

```math
\begin{aligned}
&\text{Primal:} && \text{minimize } f(x) \text{ subject to } g(x) \le 0 \\
&\text{Lagrangian:} && L(x, \lambda) = f(x) + \lambda g(x) \\
&\text{Dual function:} && d(\lambda) = \min_x L(x, \lambda) \\
&\text{Dual problem:} && \text{maximize } d(\lambda) \text{ subject to } \lambda \ge 0
\end{aligned}
```

چرا دوگانه بودن مهمه:
- مشکل دوگانه گاهی اوقات حلش آسان تر از مشکل اولیه است
- SVM ها به صورت دوگانه خود حل می شوند، جایی که مشکل بستگی به محصولات نقطه ای بین نقاط داده دارد (که امکان ترفند هسته را فراهم می کند)
- دوگانه یک مرز پایین تر را در بهینه اولیه فراهم می کند، مفید برای بررسی کیفیت محلول

برای SVM ها به طور خاص:

```
Primal: find w, b that maximize the margin 2/||w|| subject to
        y_i(w^T x_i + b) >= 1 for all i

Dual:   maximize sum(alpha_i) - 0.5 * sum_ij(alpha_i * alpha_j * y_i * y_j * x_i^T x_j)
        subject to alpha_i >= 0 and sum(alpha_i * y_i) = 0

The dual only involves dot products x_i^T x_j.
Replace x_i^T x_j with K(x_i, x_j) to get the kernel trick.
```

### چرا یادگیری عمیق با وجود عدم تعقّب کار می کند

عملکردهای از دست دادن شبکه عصبی کاملا غیر متناوب هستند. با هر اندازه گیری کلاسیک، بهینه سازی آنها باید شکست یابد. با این حال، کاهش گرادینت استوکاستیک راه حل های خوبی را به طور قابل اعتماد پیدا می کند. چندین عامل این را توضیح می دهد.

**Most local minima are good enough.**در فضاهای ابعاد بالا، نقاط انتقادی تصادفی (که در آن گرادینت صفر است) به طور گسترده ای نقاط سیله هستند، نه حداقل های محلی. حداقل های محلی موجود به طور معمول دارای ارزش های از دست دادن نزدیک به حداقل جهانی هستند. گیر در حداقل محلی وحشتناک بسیار بعید است هنگامی که فضای پارامتر دارای میلیون ها ابعاد است.

**Saddle points, not local minima, are the real obstacle.**در یک تابع با $n$در این حالت، یک نقطه سیله ترکیبی از جهت های مثبت و منفی منحنی دارد. برای یک نقطه انتقادی تصادفی در ابعاد بالا، احتمال همه $n$ارزش های خاص مثبت (حداقل محلی) تقریباً $2^{-n}$تقریباً همه نقاط مهم نقطه ی صعد هستند.

**Overparameterization smooths the landscape.**شبکه هایی که پارامترهای بیشتری نسبت به نمونه های آموزشی دارند، سطوح خستگی هموارتر و متصل تر دارند. شبکه های گسترده تر حداقل های محلی منفی کمتری دارند. این برعکس است، اما از نظر تجربی سازگار است.

**Loss landscape structure:**

| Property | Low-dimensional space | High-dimensional space |
|---|---|---|
| **Landscape** | Many isolated peaks and valleys | Smoothly connected valleys |
| **Minima** | Many isolated local minima | Few bad local minima; most are near-optimal |
| **Navigation** | Hard to find global minimum | Many paths lead to good solutions |
| **Critical points** | Mix of local minima and saddle points | Overwhelmingly saddle points, not local minima |

**Stochastic noise acts as implicit regularization.**SGD دسته کوچک اضافه می کند که مانع از تنظیم به حداقل های شدید می شود. حداقل های شدید بیش از حد متناسب؛ حداقل های صاف عمومی می شوند. ضوضای تعصب بهینه سازی به سمت مناطق صاف چشم انداز زیان است.

### روش های درجه دوم در عمل

روش نیوتن خالص برای مدل های بزرگ غیر عملی است. چندین محاسبات اطلاعات درجه دوم را قابل استفاده می کند.

**L-BFGS (Limited-memory BFGS):**با استفاده از آخرین $m$تفاوت گرادینت ها$O(mn)$حافظه به جای$O(n^2)$. برای مشکلات با حداکثر 10000 پارامتر کار می کند. در ML کلاسیک (رجع لوژیستی، CRF) استفاده می شود اما یادگیری عمیق نیست.

**Natural gradient:**از ماتریس اطلاعات فیشر (توقع شده هسیان احتمالات تراشه) به جای استاندارد هسیان استفاده می کند. این حساب برای هندسه توزیع احتمالات است. K-FAC (کرونکر-فاکتور شده منحنیات نزدیک) متریس فیشر را به عنوان یک محصول کرونکر نزدیک می کند و آن را برای شبکه های عصبی عملی می کند.

**Hessian-free optimization:**برای حل مشکل استفاده می کند$Hx = g$بدون اینکه هیچ وقت شکل گیری کنه$H$فقط نیاز به محصولات ویکتور هسی دارد که می تواند در $O(n)$زمان از طریق فرقی خودکار

**Diagonal approximations:**لحظه دوم آدم یک تقرب دیگنالی از دیگنالی هسیان است. AdaHessian این را با استفاده از عناصر دیگنالی هسیان واقعی از طریق تخمینگر هچینسون گسترش می دهد.

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

## آن را بسازید

### مرحله ی اول: چک کنویکسیت

یک تابع بسازید که با نمونه گیری نقاط و بررسی تعریف، تعویض را تجربی آزمایش کند.

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

### مرحله دوم: روش نیوتن برای 2D

روش نيوتن را با استفاده از هسيان صريح اجرا کنيد. سرعت نزديک با نزديک گرادينت را مقایسه کنيد.

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

### مرحله 3: حل کننده ضربگر لاگارنج

بهینه سازی محدود را با استفاده از کاهش گرادینت در لاگارنجین حل کنید.

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

### مرحله 4: مقایسه ی درجه اول و درجه دوم

از پايين گرادينت و روش نيوتن بر روي همون تابع مربع استفاده کنين و مراحل رو به سمت تقارب شمارش کنين

```python
def quadratic(x):
    return 5 * x[0] ** 2 + x[1] ** 2

def quadratic_grad(x):
    return [10 * x[0], 2 * x[1]]

def quadratic_hessian(x):
    return [[10, 0], [0, 2]]
```

روش نیوتن در یک مرحله (این برای مربع ها دقیق است) به هم می رسد. کاهش درجه به صدها مرحله می رود زیرا ارزش های خاص هسیان با یک فاکتور 5 متفاوت است، ایجاد یک دره طولانی می شود.

## ازش استفاده کن

تجزیه و تحلیل کنوکسیت به طور مستقیم هنگام انتخاب مدل ها و حل کننده های ML اعمال می شود.

برای مشکلات مخلوط (رجساسیون لوژیستیک، SVM، LASSO):
- استفاده از حل کننده های اختصاصی (liblinear، CVXPY، scipy.optimize.minimize با method='L-BFGS-B')
- انتظار راه حل جهانی منحصر به فرد
- روش های دومین درجه عملی و سریع هستند

برای مشکلات غیر خمیده (شبکه های عصبی):
- استفاده از روش های درجه اول (SGD، Adam)
- قبول کن که راه حل بستگی به شروع و تصادفی داره
- استفاده از پارامترسازی بیش از حد، صدا و برنامه های نرخ یادگیری به عنوان تنظیم ضمنی
- وقت خود را برای جستجوی حداقل جهانی تلف نکنید. حداقل محلی خوب کافی است.

```python
from scipy.optimize import minimize

result = minimize(
    fun=lambda w: sum((y - X @ w) ** 2) + 0.1 * sum(w ** 2),
    x0=np.zeros(d),
    method='L-BFGS-B',
    jac=lambda w: -2 * X.T @ (y - X @ w) + 0.2 * w,
)
```

برای SVM، فرمول دوگانه اجازه می دهد تا از ترفند هسته استفاده کنید:

```python
from sklearn.svm import SVC

svm = SVC(kernel='rbf', C=1.0)
svm.fit(X_train, y_train)
print(f"Support vectors: {svm.n_support_}")
```

## تمرینات

1. **Convexity gallery.**این تابع ها را با استفاده از چکگر برای تراکم کنونی تست کنید: $f(x) = x^4$،$f(x) = \sin(x)$،$f(x,y) = x^2 + y^2$،$f(x,y) = xy$،$f(x) = \max(x, 0)$توضیح بده که چرا هر نتیجه منطقی است

2. **Newton vs gradient descent race.**هر دو روش رو اجرا کن$f(x,y) = 50x^2 + y^2$از نقطه شروع$(10, 10)$. هر مرحله برای رسیدن به ضرر < 1e-10 چه تعداد مرحله ای نیاز دارد؟ وقتی تعداد شرایط (تعداد بزرگ ترین تا کوچکترین ارزش خاص هسیان) افزایش یابد، به کاهش گرادینت چه اتفاقی می افتد؟

3. **Lagrange multiplier geometry.**حداقلش کن$f(x,y) = (x-3)^2 + (y-3)^2$تابع$x + 2y = 4$. با بررسی اینکه گرادینت $f$متوازد به گرادینت $g$در راه حل

4. **Regularization constraint.**پیاده سازی بهینه سازی محدود L1: حداقل کردن $(x-3)^2 + (y-2)^2$تابع$\lvert x \rvert + \lvert y \rvert \le 1$نشان دهید که محلول دارای یک هماهنگی برابر با صفر است (تناقض از محدودیت الماس).

5. **Hessian eigenvalue analysis.**Hessian را از تابع Rosenbrock در (1,1) و در (-1,1) محاسبه کنید. ارزش های خاص را در هر دو نقطه محاسبه کنید. ارزش های خاص به شما در مورد منحنی در حداقل در مقابل دور از آن چه می گویند؟

### اشاره ها

**Exercise 1.**قبل از اينکه فرار کني هر نتيجه رو پيش بيني`check_convexity`: در یک ابعاد، به علامت نگاه کنید$f''(x)$در دو ابعاد، به ارزش های خیس نگاه کنید.$f(x,y) = xy$، Hessian دارای ارزش های خونی 1 و -1 است، بنابراین چکگر باید گزارش دهد که مخلوط نیست.

**Exercise 2.**تماس بگیرید`optimize_gd`و`newtons_method`با گرادین و هسیان$f$روش نیوتن یک مربع را در یک مرحله حل می کند. برای کاهش گرادینت، سرعت یادگیری باید کمتر از $2/100$به خاطر$50x^2$اصطلاح، پس از $y$جهت به آرامی حرکت می کند.$100x^2$و قدم ها رو دوباره بشمار

**Exercise 3.**استفاده کنید`lagrange_solve`با$g(x,y) = x + 2y - 4$. در جواب، اينو چک کن$x + 2y = 4$و این$\nabla f = (2(x-3), 2(y-3))$چند برابر از$\nabla g = (1, 2)$. .

**Exercise 4.**حداقل بدون محدودیت (3, 2) خارج از الماس است، بنابراین پاسخ در مرز آن است. از کاهش گرادینت پیش بینی شده استفاده کنید: یک گام گرادینت را بردارید، سپس به سمت $\lvert x \rvert + \lvert y \rvert \le 1$بررسی کنید که نتیجه با مساوات محدودیت را برآورده می کند و آن را با `demo_regularization_geometry`. .

**Exercise 5.**تماس بگیرید`rosenbrock_hessian`در هر نقطه و نتیجه رو به `hessian_eigenvalues_2d`در (1, 1) هر دو ارزش خاص مثبت هستند و نسبت آنها بسیار بزرگ است، بنابراین دره در یک جهت باریک و در سمت دیگر صاف است. این نسبت را با نسبت (-1, 1) مقایسه کنید.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Boyd & Vandenberghe: Convex Optimization](https://web.stanford.edu/~boyd/cvxbook/)- کتاب درسی استاندارد، به صورت رایگان در اینترنت
- [Bottou, Curtis, Nocedal: Optimization Methods for Large-Scale Machine Learning (2018)](https://arxiv.org/abs/1606.04838)- پل های نظریه بهینه سازی مخروط و تمرین یادگیری عمیق
- [Choromanska et al.: The Loss Surfaces of Multilayer Networks (2015)](https://arxiv.org/abs/1412.0233)چرا منظره های شبکه عصبی غیر مخلوط به اندازه ای بد نیستند که به نظر می رسند
- [Nocedal & Wright: Numerical Optimization](https://link.springer.com/book/10.1007/978-0-387-40065-5)- مرجع جامع برای روش نیوتن، L-BFGS و بهینه سازی محدود
