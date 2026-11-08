# نورم ها و فاصله ها

> تابع فاصله شما تعريف ميکنه "مثل" چيست انتخاب اشتباه ميکنه و همه چيز در پايين سير مي شکسته

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## اهداف یادگیری

- پیاده سازی L1، L2، کوسین، ماهالانوبیس، جاکارد و ویرایش عملکرد فاصله از ابتدا
- متریک مناسب فاصله را برای یک کار ML داده شده انتخاب کنید و توضیح دهید که چرا گزینه های جایگزین شکست می خورند
- ارتباط با نورم های L1 و L2 به تنظیم LASSO و Ridge و مناطق محدودیت هندسی آنها
- نشان دهید که چگونه مجموعه داده های مشابه همسایه های نزدیک تر را تحت متریک های مختلف تولید می کند

## مشکل

شما دو متری دارید. شاید آنها کلمات گنجانده شده باشند. شاید آنها پروفایل های کاربر باشند. شاید آنها آرایه های پیکسل باشند. شما باید بدانید: چقدر نزدیک هستند؟

پاسخ به طور کامل بستگی به عملکرد فاصله ای دارد که انتخاب می کنید. دو نقطه داده می توانند نزدیک ترین همسایه ها در زیر یک متریک و دورتر از یکدیگر در زیر یک دیگر باشند. طبقه بندی KNN شما، موتور توصیه، پایگاه داده ویکتور، الگوریتم خوشه بندی، عملکرد ضرر شما - همه این ها به این انتخاب بستگی دارند. اشتباه کنید و مدل شما برای چیز اشتباه بهینه سازی می شود.

هیچ فاصله ی عالی جهانی وجود ندارد. L2 برای داده های فضایی کار می کند. شباهت کوسین بر NLP تسلط دارد. جکارد مجموعه ها را اداره می کند. فاصله ی ویرایش رشته ها را اداره می کند. ماهالانوبیس برای ارتباط حساب می کند. واسستین جرم احتمال را حرکت می دهد. هر یک فرضیه متفاوتی را در مورد معنی "مثل" رمزگذاری می کند.

این درس هر تابع مسافات اصلی را از ابتدا می سازد، نشان می دهد که هر یک از آنها ابزار مناسب است، و نشان می دهد که چگونه داده های مشابه به طور کامل همسایه های نزدیک را تولید می کند بسته به اینکه کدام متریک را استفاده می کنید.

## مفهوم

### نورم: اندازه گیری حجم بردار

یک استاندارد اندازه گیری "حجم" یک متری است. هر تابع فاصله بین دو متری می تواند به عنوان استاندارد تفاوت آنها نوشته شود:$d(a, b) = \lVert a - b \rVert$پس درک اصول، درک فاصله است.

### L1 نورم (مسافت مانهاتن)

استاندارد L1 ارزش های مطلق تمام اجزای را جمع می کند.

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

این فاصله به نام فاصله منهتن است چون اندازه گیری می کند که چقدر در یک شبکه شهر می توانید حرکت کنید که فقط در امتداد محورها حرکت کنید. هیچ دایگانال.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

چه زمانی باید L1 را استفاده کنید:
- داده های کمیاب با ابعاد بالا (ميزه های متن، کدگذاری های یکطرفه)
- وقتی می خواهید قوی به غیر معمول (یک تفاوت بزرگ حاکم نیست)
- مشکلات انتخاب ویژگی ها (تدبیر L1 باعث کمکی می شود)

ارتباط با تنظیم L1 (Lasso): اضافه کردن $\lVert w \rVert_1$این کار وزن های کوچک را به صفر می اندازد و انتخاب ویژگی های خودکار را انجام می دهد. مجازات L1 مناطق محدود شکل الماس را در فضای وزن ایجاد می کند و گوشه های الماس بر محور هایی قرار دارند که برخی از وزن ها صفر هستند.

ارتباط با عملکردهای از دست دادن: خطای مطلق متوسط (MAE) فاصله L1 میان پیش بینی ها و اهداف است. این خطایی را خطی مجازات می کند و در مقایسه با MSE به طور قابل اعتماد به غیرمعمولی تبدیل می شود.

### L2 نورم (افقای اوکلید)

استاندارد L2 فاصله خط مستقيم است. ریشه مربع مجموع اجزای مربع.

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

اين فاصله اي است که تو در کلاس هندسي ياد گرفتي.$n$ابعاد

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

چه زمانی باید L2 را استفاده کنید:
- داده های پیوسته ابعاد پایین تا متوسط
- وقتی که مقیاس ویژگی ها قابل مقایسه است
- فاصله های فیزیکی (داده های فضایی، خواندن سنسورها)
- شباهت تصویر در سطح پیکسل

اتصال به تنظیم L2 (Ridge): اضافه کردن $\lVert w \rVert_2^2$در این حالت، این قابلیت به طور قابل توجهی به وزن های بزرگ کمک می کند. برخلاف L1, وزن ها را به صفر فشار نمی دهد. این تمام وزن ها را به طور متناسب به سمت صفر کاهش می دهد. مجازات L2 مناطق محدود گرد ایجاد می کند، بنابراین گوشه ای در محور وجود ندارد. وزن ها کوچک می شوند اما به ندرت دقیقا صفر.

ارتباط با عملکردهای از دست دادن: خطای مربع متوسط (MSE) میانگین فاصله های L2 مربع است. مربع سازی خطاهای بزرگ را بیشتر از کوچک مجازات می کند.

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### Lp نورم: خانواده عمومی

L1 و L2 موارد ویژه ی استاندارد Lp هستند:

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

ارزش های مختلف $p$"کاله های واحد" شکل های مختلف را تولید می کنند (مجموعه همه نقاط در فاصله حداکثر 1 از اصل؛ شکل های زیر مرزهای آنها هستند):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### نورم بی نهایت L (سافه چبیشوف)

مثل$p$در حال نزدیک شدن به بی نهایت، نورم Lp به حداکثر قطعه مطلق نزدیک می شود.

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

فاصله بین دو نقطه توسط ابعاد تک تعیین می شود که بیشترین تفاوت آنها را دارند.

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

چه زمانی باید L- Infinity را استفاده کنید:
- وقتی که بدترین انحراف در هر ابعاد مهم باشد
- تخت های بازی (یک پادشاه در شطرنج حرکت در L-نامحدود: یک قدم در هر جهت هزینه 1)
- تحمل تولید (هر ابعاد باید در محدوده مشخصات باشد)

### شباهت کوسین و فاصله کوسین

شباهت کوسین زاویه بین دو متری را اندازه گیری می کند، بدون توجه به شدت آنها.

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

این از -1 (جهات مخالف) تا +1 (جهات مشابه) متفاوت است. متریک عمودی دارای شباهت کوسین 0 هستند.

فاصله کوسین آن را به فاصله تبدیل می کند: cosine_distance = 1 - cosine_similarity. این از 0 (سیستم یکسان) تا 2 (سیستم مخالف) می باشد.

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

چرا کوزین بر NLP و ادغام ها تسلط دارد: در متن، طول سند نباید بر شباهت تاثیر بگذارد. یک سند در مورد گربه ها که دو برابر طولانی تر از سند دیگری در مورد گربه ها است باید هنوز هم "مثل" باشد. شباهت کوسین حجم (طول) را نادیده می گیرد و فقط به جهت اهمیت می دهد. دو سند با همان توزیع کلمه اما طول های مختلف به سمت یک جهت اشاره می کنند و شبیه سازی کوسینو 1.0 را دریافت می کنند.

زمانی که از شباهت کوسین استفاده کنید:
- شباهت متن (وکتورهای TF-IDF، گنجانده شدن کلمات، گنجانده شدن جملات)
- هر حوزه ای که در آن شدت شور و جهت سیگنال است
- سیستم های توصیه (وکتورهای ترجیح کاربر)
- جستجوی ادغام (بای های داده ویکتور تقریبا همیشه از محصول cosine یا dot استفاده می کنند)

### شباهت قطبی محصول در مقابل شباهت کوسین

عدد نقطه ای دو متری است:

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

شباهت کوسین محصول نقطه ای است که توسط هر دو مقادیر نرمال می شود. هنگامی که هر دو بردار قبلاً به صورت واحد نرمال می شوند (مقادیر = 1) ، محصول نقطه ای و شباهت کوسین یکسان هستند.

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

وقتی که آنها متفاوت هستند: مقدار قطبی شامل اطلاعات بزرگی است. ویکتور با مقدار بزرگتر نمره محصول قطبی بالاتر را می گیرد. این در برخی از سیستم های بازیافت اهمیت دارد که می خواهید موارد "عالی" رتبه بالاتر را داشته باشند. مقدار به عنوان یک سیگنال ضمنی کیفیت یا اهمیت عمل می کند.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

در عمل:
- وقتی می خواهید شباهت جهت خالص را داشته باشید از شباهت کوسین استفاده کنید
- استفاده از محصول نقطه زمانی که مقادیر اطلاعات معنی دار را حمل می کنند
- بسیاری از پایگاه داده های متری (Pinecone، Weaviate، Qdrant) اجازه می دهد تا شما بین آنها را انتخاب کنید
- اگر گنجانده های شما L2-نورمال شده باشد، انتخاب مهم نیست

### فاصله ماهالانوبیس

فاصله ی اوکلید تمام ابعاد را به طور مساوی می گیرد اما اگر ویژگی های شما مرتبط باشند یا مقیاس های متفاوتی داشته باشند، L2 نتایج گمراه کننده ای می دهد.

فاصله ماهالانوبیس ساختار کوویاریانس داده ها را محاسبه می کند.

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

کجا$S$ماتریس همتای داده ها است.

با توجه به این که فاصله ماهالانوبی ابتدا داده ها را غیر مرتبط و عادی می کند (پاک کردن) ، سپس فاصله L2 را در این فضا تبدیل می کند. اگر$S$میترکس هویت (غیر مرتبط، ویژگی های متغیر واحد) است، فاصله ماهالانوبی به فاصله یوکلیدی کاهش می یابد.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

چه موقع از فاصله ماهالانوبیس استفاده کنید:
- تشخیص غیر معمول (نقطه هایی که فاصله زیادی از ماهالانوبیس از میانگین دارند، غیر معمول هستند)
- طبقه بندی زمانی که ویژگی ها دارای مقیاس و ارتباط های مختلف باشند
- وقتی اطلاعات کافی برای تخمین گیری ماتریس متکی همگامگی دارید
- کنترل کیفیت در تولید (مراقب فرایندهای فراینده)

### شباهت جکارد (برای مجموعه ها)

اندازه گیری های شباهت جکارد بین دو مجموعه تعاونی می کند.

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

این فاصله از 0 (بدون تعادل) تا 1 (مجموعه های یکسان) می باشد. فاصله جکارد = 1 - شباهت جکارد.

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

چه زمانی باید Jaccard را استفاده کنید:
- مقایسه مجموعه ای از برچسب ها، دسته ها یا ویژگی ها
- شباهت اسناد بر اساس حضور کلمه (نه فرکانس)
- تشخیص دوگانه نزدیک (تقریباً MinHash از Jaccard)
- مقایسه ویکتورهای ویژگی های دوگانه (داده های حضور/نا وجود)
- مدل های ارزیابی بخش بندی (تقاطع اتحادیه = جیکارد)

### فاصله (مسافت لئونشتین)

فاصله ویرایش حداقل تعداد عملیات یک کاراکتر مورد نیاز برای تبدیل یک رشته به یک رشته دیگر را محاسبه می کند. عملیات عبارتند از: وارد کردن، حذف کردن یا جایگزینی.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

با استفاده از برنامه نویسی پویا محاسبه شده. یک ماتریس را پر کنید که در آن درج شده است $(i, j)$فاصله ی ویرایش بین اولین $i$حرف های رشته A و اول $j$حرف های رشته B

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

زمان استفاده از فاصله ویرایش:
- بررسی و اصلاح امجادی
- تعادل تسلسل DNA (با عملیات وزن شده)
- تعادل رشته های غش
- تخفیف از داده های متن آشفته

### KL انحراف (نه فاصله، اما به عنوان یک استفاده می شود)

انحراف KL اندازه گیری می کند که چگونه توزیع احتمال از دیگری متفاوت است. در درس 09 پوشش داده شده است، اما به این بحث تعلق دارد زیرا مردم آن را به عنوان یک "مسافت" با وجود اینکه یک نیست، استفاده می کنند.

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

ویژگی حیاتی: انحراف KL متقابل نیست.

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

این بدان معنی است که این مورد نیاز اساسی یک متریک فاصله را برآورده نمی کند. همچنین عدم برابری مثلث را برآورده نمی کند. این یک انحراف است، نه فاصله.

جلو KL $(D_{KL}(P \Vert Q))$"مطالب به معنی" است: $Q$تلاش می کند تمام روش های$P$. .
کالا رو برگردون$(D_{KL}(Q \Vert P))$"طلب کردن حالت": $Q$تمرکز بر یک روش واحد$P$. .

وقتی که انحراف KL رو میبینید:
- VAEs (مدد KL در ELBO توزیع پنهان را به سمت یک پیش رو فشار می دهد)
- تخلیه دانش (مطالب سعی می کند با توزیع معلم مطابقت داشته باشد)
- RLHF (جریمه KL باعث می شود مدل اصلاح شده نزدیک به مدل پایه باشد)
- روش های گرادینت سیاست (توسعه های محدودی سیاست)

### فاصله واسستین (سافه حرکت کننده زمین)

فاصله واسستین حداقل "کار" لازم را برای تبدیل یک توزیع احتمال به دیگری اندازه گیری می کند. به این فکر کنید که: اگر یک توزیع یک توده خاک و دیگری یک سوراخ باشد، چقدر خاک باید حرکت کنید و چقدر؟

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

برای توزیع های یک بعدی، این را به یکپارچه تفاوت مطلق عملکردهای توزیع تجمعی ساده می کند:

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

چرا واسستين مهمه:
- این یک متریک واقعی است (مترافق، عدم مساوات مثلث را برآورده می کند)
- حتی زمانی که توزیع ها همپوش نمی شوند gradients را فراهم می کند (KL انحراف به بی نهایت می رود)
- این ویژگی باعث شد که این سیستم در Wasserstein GANs (WGANs) مرکزی باشد که عدم ثبات آموزش GAN های اصلی را حل کرد.

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

چه زمانی باید Wasserstein را استفاده کنید:
- آموزش GAN (WGAN، WGAN-GP)
- مقایسه توزیع هایی که ممکن است همپوشان نباشند
- مشکلات حمل و نقل مطلوب
- بازیافت تصویر (برابر رنگ های هیستوگرافی)

### چرا وظایف مختلف نیاز به فاصله های مختلف دارد

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

### ارتباط با عملکردهای از دست دادن

عملکردهای از دست دادن عملکردهای فاصله ای هستند که به پیش بینی ها و اهداف اعمال می شوند.

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

### ارتباط با تنظیم

تنظیم کردن یک مجازات استاندارد در وزن به عملکرد از دست دادن اضافه می کند.

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

چرا L1 کم کم تولید می کند اما L2 نمی کند: منطقه محدود در فضای وزن 2D را تصویر کنید. L1 یک الماس است، L2 یک دایره است. خطوط عملکرد از دست دادن (الیپسی) به احتمال زیاد به الماس در گوشه ای لمس می کنند، جایی که یک وزن صفر است. آنها در نقطه صاف، جایی که هر دو وزن صفر نیستند، به دایره لمس می کنند.

### نزدیکترین همسایه را جستجو کنید

هر تابع فاصله به مشکل جستجوی نزدیک ترین همسایه اشاره دارد: با توجه به یک نقطه جستجو، نزدیک ترین نقاط در مجموعه داده ها را پیدا کنید.

نزدیک ترین همسایه جستجو$O(n \cdot d)$در هر سوال در مجموعه داده ای از $n$نقاط با $d$برای مجموعه داده های بزرگ، این خیلی کند است.

الگوریتم های نزدیک ترین همسایه (ANN) مقدار کمی دقت را برای افزایش سرعت عظیم معامله می کنند:

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

HNSW (Hirarchical Navigable Small World) الگوریتم غالب در پایگاه داده های متری مدرن است. این یک نمودار چند لایه ای را ایجاد می کند که هر گره با نزدیکترین همسایه های خود متصل می شود. جستجو در لایه بالای (سپرس، پریدن های طولانی) شروع می شود و به لایه پایین (پریدن های کثیف، کوتاه) پایین می رود.

```figure
norm-unit-balls
```

## آن را بسازید

### مرحله ی ۱: تمام عملکردهای نورم و فاصله

ببین`code/distances.py`برای اجرای کامل. هر تابع از ابتدا با استفاده از ریاضیات پایه پایتون ساخته شده است. فایل `code/distances.ts`یک پورت تایپ اسکریپت با همان عملکرد و نمایش ها است.

### مرحله دوم: داده های مشابه، فاصله های مختلف، همسایه های مختلف

نمایش در`distances.py`یک مجموعه داده ایجاد می کند، یک نقطه جستجو را انتخاب می کند و نشان می دهد که نزدیک ترین همسایه چگونه بسته به متریک فاصله تغییر می کند. نقطه ای که "به نزدیک ترین" تحت L1 است ممکن است نزدیک ترین تحت L2 یا cosine نباشد.

### مرحله سوم: گنجاندن جستجوی شباهت

این کد شامل یک جستجوی شبیه سازی است که شبیه ترین "وثائق" را با استفاده از شبیه سازی کوسین به فاصله L2 پیدا می کند، نشان می دهد که رتبه بندی می تواند متفاوت باشد.

## ازش استفاده کن

رایج ترین کاربرد عملی: پیدا کردن عناصر مشابه در یک پایگاه داده ویکتور.

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

وقتي که زنگ ميزني`model.encode(text)`و سپس به دنبال یک پایگاه داده ویکتور، این چیزی است که در زیر کاپ اتفاق می افتد. مدل گنجانده متن را به ویکتورها نقشه می زند. پایگاه داده ویکتور شباهت کوسین (یا محصول نقطه) بین ویکتور سوال و هر ویکتور ذخیره شده را محاسبه می کند، با استفاده از الگوریتم های ANN برای جلوگیری از بررسی همه آنها.

## تمرینات

1. فاصله های L1, L2 و L- بی نهایت را بین (1, 2, 3) و (4, 0, 6) محاسبه کنید.$L_\infty \le L_2 \le L_1$هميشه براي هر جفت نقطه اي نگه داريد. ثابت کنيد چرا اين سفارش تضمین شده است.

2. دو متری ایجاد کنید که شباهت کوسین بالا (> 0.9) باشد اما فاصله L2 بزرگ (> 10) باشد. به صورت هندسی توضیح دهید که چه اتفاقی می افتد. سپس دو متری ایجاد کنید که شباهت کوسین کم باشد (< 0.3) اما فاصله L2 کوچک باشد (< 0.5).

3. یک تابع را اجرا کنید که مجموعه داده ها و یک نقطه جستجو را بگیرد و نزدیکترین همسایه را در زیر فاصله L1 ، L2 ، cosine و Mahalanobis برگرداند. مجموعه داده ای را پیدا کنید که در آن هر چهار نقطه در مورد نزدیکترین نقطه اختلاف دارند.

4. فاصله واسستین را با استفاده از روش CDF از دست بین [0.5، 0.5، 0.5، 0.0] و [0, 0, 0.5، 0.5] محاسبه کنید. سپس آن را بین [0.25، 0.25, 0.25, 0.25] و [0, 0, 0.5, 0.5] محاسبه کنید. کدام یک بزرگتر است و چرا؟

5. MinHash را برای شباهت جاکارد نزدیک پیاده سازی کنید. 100 مجموعه تصادفی تولید کنید، جاکارد دقیق را برای همه جفت ها محاسبه کنید و با استفاده از 50، 100 و 200 تابع هش با تقرب MinHash مقایسه کنید. خطای تقرب را نقشه برداری کنید.

### اشاره ها

**Exercise 1.**متری تفاوت (-3, 2, -3) است، بنابراین سه قانون متری را با `l1_norm`،`l2_norm`و`linf_norm`برای اثبات، بزرگترين را مقایسه کن$\lvert d_i \rvert$با مجموع مربع ها، و مقایسه مجموع مربع ها با مربع مجموع ارزش های مطلق.

**Exercise 2.**شبیه سازی کوسین طول را نادیده می گیرد، بنابراین با دو متری که تقریبا در همان جهت اشاره می کنند شروع کنید و یکی از آنها را بسیار طولانی تر کنید. برای مورد دوم، از دو متری کوتاه در نزدیکی اصل استفاده کنید که در جهت های مختلف اشاره می کنند، سپس هر دو شرایط را با `cosine_similarity`و`l2_distance`. .

**Exercise 3.**تماس بگیرید`find_nearest_neighbor(query, dataset, distance_fn)`یک بار برای هر یک از آنها`l1_distance`،`l2_distance`،`cosine_distance`و`mahalanobis_distance`.`demo_different_neighbors`یک مجموعه داده را نشان می دهد که در آن متریکها با هم موافق نیستند، بنابراین اول آن را بخوانید و سپس نقاط را تغییر دهید تا همه چهار پاسخ متفاوت باشند.

**Exercise 4.**مجموعه ی تجمعی هر توزیع را بنویسید، سپس تفاوت های مطلق دو مجموعه ی تجمعی را اضافه کنید. نتایج هر دو دست را با `wasserstein_1d(p, q)`، سپس مقدار بزرگتر را با اینکه چه اندازه باید جرم احتمال حرکت کند توضیح دهید.

**Exercise 5.**برای هر تابع هش، امضای MinHash یک مجموعه حداقل ارزش هش بر عناصر آن است و بخش از تابع های هش که دو مجموعه به همان حداقل تخمین ها شباهت جیکارد خود را دریافت می کنند.`jaccard_similarity`اشتباه باید تقریباً به عنوان$1/\sqrt{k}$برای$k$تابع هاش

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)-مكتبة ميتا براي جستجو در مقیاس ANN
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- روزنامه اي که فاصله ي زمين حرکتگر رو به GAN ها معرفي کرد
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- الگوریتم ANN پایه ای
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec، جایی که شبیه سازی cosine برای گنجانده شدن به عنوان پیش فرض تبدیل شد
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- راهنمای عملی برای متریک فاصله و الگوریتم های همسایه در scikit-learn
