# ثبات عددی

> نقطه شناور یک تجرّئ نفوذی است. در طول تمرین شما را گاز می گیرد و نمی بینید که می آید.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## اهداف یادگیری

- استفاده از ترفند حذف حداکثر را با استفاده از نرممکس و لاگ سوم-exp با استفاده از ترفند حذف حداکثر انجام دهید
- شناسایی overflow، underflow و حذف فاجعه بار در محاسبات نقطه شناور
- بررسی گرادین های تحلیلی در مقابل گرادین های عددی با استفاده از تفاوت های محدود متمرکز
- توضیح دهید که چرا bfloat16 برای آموزش در مقابل float16 ترجیح داده می شود و چگونه مقیاس گذاری از دست دادن مانع از جریان پایین گرادینت می شود

## مشکل

شما مدل شما را به مدت سه ساعت قطار می کند، سپس از دست دادن به NaN می شود. شما یک بیانیه چاپ اضافه می کنید. logits در مرحله 9000 خوب است. در مرحله 9,001 آنها هستند.`inf`. در مرحله 9 002 هر گرادينت`nan`و آموزش مرده

یا: مدل شما به اتمام می رسد اما دقت آن 2 درصد بدتر از ادعاهای کاغذ است. شما همه چیز را بررسی می کنید. معماری مطابقت دارد. پارامترهای فوق العاده مطابقت دارند. داده ها مطابقت دارند. مشکل این است که کاغذ از float32 استفاده کرده و شما بدون مقیاس مناسب از float16 استفاده کرده اید. 32 بیت از اشتباه گردآوری جمع شده به آرامی دقت شما را خورده است.

یا: شما از نو از دست دادن کرسی اندروپی را اجرا می کنید. این روی logits کوچک کار می کند. وقتی logits بیش از 100 است، آن را باز می کند.`inf`. اون نرمترین آب رو از دست داد چون`exp(100)`هر چارچوب ML با دو خط ترفند انجام می دهد. شما نمی دانستید ترفند وجود دارد.

ثبات عددی یک نگرانی تئوری نیست. این تفاوت بین یک تمرین موفق و یک تمرین که به طور ساکت شکست می خورد است. هر خطا ML جدی شما را به پایان می رسد به نقطه شناور.

## مفهوم

### IEEE 754: چگونه کامپیوترها اعداد واقعی را ذخیره می کنند

کامپیوترها اعداد واقعی را به عنوان مقادیر نقطه شناور در طبق استاندارد IEEE 754 ذخیره می کنند. یک شناور سه بخش دارد: یک بیت علامت، یک معارض و یک mantissa (معنوی).

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

مانتیسا دقت (چقدر ارقام مهم را تعیین می کند) را تعیین می کند. معارض محدوده (چه قدر بزرگ یا کوچک یک عدد می تواند باشد) را تعیین می کند.

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

فلوات32 به شما حدود 7 رقمی دسمال دقت می دهد. این بدان معنی است که می تواند 1.0000001 و 1.0000002 را تشخیص دهد، اما نه 1.00000001 و 1.00000002. پس از 7 رقمی، همه چیز شور گرد است.

در این حالت، این عدد در حال حاضر به اندازه ی ۵۵۵۰۴ است. این تعداد برای ML بسیار کوچک است که در آن جا که لوجیت ها، گرادینت ها و فعال سازی ها به طور معمول از این عدد بیشتر است.

bfloat16 پاسخ گوگل به مشکل دامنه float16 است. این دارای همان 8 بت است که float32 (همین محدوده، تا 3.4e38) اما فقط 7 بیت mantissa (در مقایسه با float16) است. برای آموزش شبکه های عصبی، محدوده مهم تر از دقت است، بنابراین bfloat16 معمولا برنده می شود.

### چرا 0.1 + 0.2 != 0.3

عدد 0.1 نمی تواند به طور دقیق در نقطه شناور دوگانه نشان داده شود. در پایه 2، آن یک کسری تکراری است:

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 این مقدار را به 23 بیت مانتیسا کاهش می دهد. ارزش ذخیره شده تقریبا 0.100000001490116 است. به همین ترتیب 0.2 به عنوان تقریبا 0.200000002980232 ذخیره می شود. مجموع آنها 0.300000004470348 است، نه 0.3.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

این برای ML مهم است زیرا:

1. مقایسه های تلفات مثل`if loss < threshold`می تواند جواب های اشتباه بدهد
2. جمع آوری بسیاری از ارزش های کوچک (تازهکاری های تدریجی در هزاران مرحله) از مجموع واقعی منحرف می شود
3. اگر فلوترها را با `==`

راه حل: هرگز شناورها رو با`==`استفاده کن`abs(a - b) < epsilon`یا`math.isclose()`. .

### لغو فاجعه بار

وقتی دو عدد نقطه شناور تقریباً برابر را از دست می دهید، اعداد مهم را حذف می کنید و شما با صدای گرد و گرد به اعداد پیشرو ارتقا می یابید.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

این یک خطا نسبت به ۱۹٪ از یک معاینه ی واحد است. در ML، این اتفاق می افتد هر زمان که شما:

- تفاوت داده ها را با میانگین بزرگی محاسبه کنید: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$چه وقت$\mathbb{E}[x]$بزرگ است
- از احتمالات تقریبا برابر ثبت تخفیف
- ترازۀ تفاوت های محدود را با یک اپسایلون بسیار کوچک محاسبه کنید

راه حل: فرمول ها را تغییر دهید تا از عدد های بزرگ و تقریبا برابر اجتناب کنید. برای تغییر، الگوریتم ویلفورد را استفاده کنید یا ابتدا داده ها را متمرکز کنید. برای احتمالات ثبت، در فضای ثبت کار کنید.

### جریان بیش از حد و جریان پایین

جریان بیش از حد زمانی اتفاق می افتد که یک نتیجه برای نشان دادن بیش از حد بزرگ باشد. جریان پایین زمانی اتفاق می افتد که بسیار کوچک باشد (به صفر نزدیک تر از کوچکترین عدد مثبت قابل نشان دادن است).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

.`exp()`عملکرد منبع اصلی پرش در ML است:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

.`log()`تابع به سمت دیگر می رسد:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

در زبان ML`exp()`در نرمماکس، سیگمائید و محاسبات احتمال ظاهر می شود. `log()`در این ترکیب، این در حال ظهور در اینترپی های متقابل، احتمالات تراز و انحراف KL است.`log(exp(x))`یه میدان مین بدون ترفند های درست

### راه حل ثبت رقم و اخراج

محاسبات`log(sum(exp(x_i)))`به طور مستقیم به لحاظ عددي خطرناک است.`x_i`بزرگ است`exp(x_i)`اگه همه`x_i`خیلی منفی هستند، هر`exp(x_i)`به صفر و `log(0)`.`-inf`. .

ترفند: قبل از نمادگذاری، حداکثر ارزش را از دست بدهید.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

چرا این کار می کند: پس از معاینه`max(x)`، بزرگترین نمادش`exp(0) = 1`. هیچ تخلیه ای امکان پذیر نیست. حداقل یک اصطلاح در مجموع 1 است، بنابراین مجموع حداقل 1 است و`log(1) = 0`. هيچ آبي به سمت`-inf`ممکنه

اثبات:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

تنظیم شده`c = max(x)`و از آن پس از آن، آب فراز از بین می رود.

اين ترفند در همه جا در ML ظاهر ميشه:
- نرمال شدن نرم ماکس
- محاسبه از دست دادن های کراس-انترپی
- جمع بندی احتمال ثبت در مدل های تسلسل
- ترکیب گاسیان
- نتیجه گیری متغیر

### چرا Softmax به ترفند مکس-سحب نیاز دارد

نرم ماکس Logits رو به احتمالات تبدیل می کنه:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

بدون این ترفند، لوجت های [100، 101, 102] باعث فراز می شوند:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

با این ترفند، حداکثر x = 102 را از دست بدهیم:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

احتمالات یکسان است.حساب امن است. این یک بهینه سازی نیست. این یک نیاز برای دقت است.

### NaN و Inf: تشخیص و پیشگیری

`nan`(نمره ای نیست) و`inf`(بعد از حد) از طریق محاسبات به طور ویروس گسترش می یابد.`nan`در یک بروزرسانی گرادینت وزن را می سازد`nan`، که هر محصول بعدش رو تولید ميکنه`nan`آموزش در يک قدم ديگه تموم ميشه

چطور`inf`ظاهر می شود:
- `exp()`با تعداد مثبت زیادی
- تقسیم به صفر: `1.0 / 0.0`
- `float32`بیش از حد جریان در تجمع

چطور`nan`ظاهر می شود:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`از یک عدد منفی
- `log()`از یک عدد منفی
- هر حسابي که شامل يک حسابي موجود باشه`nan`

تشخیص:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

استراتژی های پیشگیری:

1. ورودی های کلیمپ به `exp()`.`exp(clamp(x, -80, 80))`
2. به نامگذاری ها epsilon اضافه کنید: `x / (y + 1e-8)`
3. داخل این قسمت ایپسایلون را اضافه کنید`log()`.`log(x + 1e-8)`
4. استفاده از پیاده سازی های پایدار (log-sum-exp، softmax پایدار)
5. برش درجه ای برای جلوگیری از انفجار وزن
6. چک کن`nan`-بله .`inf`بعد از هر عبور جلو در طول بازیافت

### بررسی درجه بندی عددی

گرادینت های تحلیلی (از پس گسترش) می توانند اشکال داشته باشند. بررسی گرادینت عددی آنها را با محاسبه گرادینت های با تفاوت های محدود تأیید می کند.

فرمول تفاوت متمرکز:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

اینم$O(h^2)$درست تر از تفاوت جلو$(f(x+h) - f(x)) / h$که فقط$O(h)$. .

انتخاب کردن$h$: خیلی بزرگ و تخمین اشتباه است.`h = 1e-5`به`1e-7`نماديه

چک: تفاوت نسبی بین گرادینت های تحلیلی و عددی را محاسبه کنید.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

قوانین عمومي:
- relative_error < 1e-7: کامل، گرادینت درست است
- relative_error < 1e-5: قابل قبول، احتمالا درست
- relative_error > 1e-3: چیزی اشتباه است
- relative_error > 1: گرادینت کاملاً اشتباه است

همیشه در هنگام پیاده سازی یک لایه یا عملکرد از دست دادن gradients را بررسی کنید. PyTorch ارائه می دهد `torch.autograd.gradcheck()`براي اين

### آموزش دقیق مخلوط

GPU های مدرن دارای سخت افزار تخصصی (Tensor Cores) هستند که ضربات ماتریکس float16 را 2-8 برابر سریعتر از float32 محاسبه می کنند. آموزش دقیق مخلوط از این بهره می برد:

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

مشکل آموزش خالص float16: گرادیانت ها اغلب بسیار کوچک هستند (1e-8 یا کوچکتر). Float16 هر چیزی زیر ~ 6e-8 به صفر جریان می یابد. مدل شما یادگیری را متوقف می کند زیرا تمام بروزرسانی های گرادیانت صفر هستند.

راه حل در مقیاس خسارت است:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

مقیاس گذاری پویا از دست دادن به طور خودکار فاکتور مقیاس را تنظیم می کند. با یک مقدار بزرگ (65536) شروع کنید. اگر گرادینت ها به `inf`، نصفش کن اگه$N$قدم ها بدون پر شدن عبور ميکنن، دو برابرش کن

### بفلوت16 در مقابل بفلوت16: چرا بفلوت16 برنده شدن در تمرینات

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

فلوات ۱۶ دقیق تر است (10 بت مانتیسا در مقابل 7) اما محدوده محدودی (ماکس ~65,504). bfloat 16 دقیق تر است اما محدوده مشابه فلوات 32 (ماکس ~3.4e38) است.

برای آموزش شبکه های عصبی:

- فعال سازی ها و لگوئیت ها به طور منظم بیش از 65504 در طول تمرینات فرا می رسد.
- مقیاس گذاری از دست دادن در float16 مورد نیاز است اما معمولاً غیرضروری است با bfloat16 زیرا محدوده آن طیف گرادینت بزرگ را پوشش می دهد.
- bfloat16 یک کوتاه کردن ساده از float32 است: پایین 16 بیت مانتیسا را رها کنید. تبدیل معمولی و بدون ضرر در نماد است.

float16 برای نتیجه گیری در جایی که ارزش ها محدود هستند و دقت مهم تر است ترجیح داده می شود. bfloat16 برای آموزش در جایی که محدوده مهم تر است ترجیح داده می شود. به همین دلیل TPU ها و GPU های NVIDIA مدرن (A100، H100) پشتیبانی بومی bfloat16 دارند.

### ترازیدن درجه

گرادینت های انفجارگرادیتی زمانی اتفاق می افتد که گرادینت ها به طور نمایی از طریق چندین لایه رشد می کنند (معمولا در RNN ها، شبکه های عمیق و ترانسفورماتورها). یک گرادینت بزرگ واحد می تواند تمام وزن ها را در یک مرحله خراب کند.

دو نوع برش:

**Clip by value:**هر عنصر گرادینت را به طور مستقل خم کنید.

```
grad = clamp(grad, -max_val, max_val)
```

ساده اما می تواند جهت بردار گرادینت را تغییر دهد.

**Clip by norm:**مقیاس کل ویکتور گرادینت را طوری که نورمال آن از یک حد عبور نکند.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

در جهت انحدار نگه می دارد`torch.nn.utils.clip_grad_norm_()`آره، انتخاب استاندارده

ارزش های معمول: `max_norm=1.0`برای ترانسفورماتورها`max_norm=0.5`برای RL، `max_norm=5.0`برای شبکه های ساده تر.

کليپ گريديانت ها يه هک نيست. اين يه مکانیزم ايمني است. بدون اين، يک دسته خارجي مي تواند يه گريديانت بزرگ به اندازه ي اون که هفته ها آموزش خراب کنه تولید کنه.

### لایه های عادی سازی به عنوان ثبات دهنده های عددی

نرمال سازی دسته، نرمال سازی لایه و نرمال سازی RMS معمولا به عنوان تنظیم کننده هایی که به تقلب کمک می کنند ارائه می شوند. آنها همچنین استقرار دهنده های عددی هستند.

بدون نرمال سازی، فعال سازی ها می توانند به طور نمایی از طریق لایه ها رشد یا کاهش یابند:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

عادی سازی جدیدگرها و بازمستقیم فعال سازی در هر لایه:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

.`epsilon`(معمولا 1e-5) مانع تقسیم صفر می شود وقتی تمام فعال سازی ها یکسان هستند.`gamma`و`beta`اجازه بده شبکه هر اندازه ای که نیاز داره رو برگردونه

این امر ارزش ها را در محدوده امن عددی در سراسر شبکه نگه می دارد و از هر دو بیش از حد در گذرگاه جلو و انفجار گرادینت در گذرگاه عقب جلوگیری می کند.

### خطاهای ارقام عمومی ML

**Bug: Loss is NaN after a few epochs.**
علت: logits بیش از حد بزرگ شده، softmax بیش از حد جریان یافته یا سرعت یادگیری بیش از حد بالا و وزن های متمایز شده است.
اصلاح: نرم ترین نرم (بخش حداکثر) را استفاده کنید، سرعت یادگیری را کاهش دهید، برش گرادینت را اضافه کنید.

**Bug: Loss is stuck at log(num_classes).**
علت: نتایج مدل احتمالات تقریبا یکسانی است. اغلب به این معنی است که گرادینت ها ناپدید می شوند یا مدل اصلاً یاد نمی گیرد.
درست کردن: بررسی اینکه برچسب های داده درست هستند، بررسی عملکرد از دست دادن، بررسی برای مرده ReLUs.

**Bug: Validation accuracy is lower than expected by 1-3%.**
علت: دقت مخلوط بدون مقیاس خسارت مناسب. جریان پایین درجه به طور خاموشی به صفر تازه های کوچک می رسد.
درست کردن: فعال کردن مقیاس پذیری پویایی از دست دادن، یا تغییر به bfloat16.

**Bug: Gradient norms are 0.0 for some layers.**
علت: نورون های مرده ReLU (همه ورودی منفی) یا زیر جریان float16
درست کردن: استفاده از LeakyReLU یا GELU، استفاده از مقیاس گرادینت، بررسی وزن شروع.

**Bug: Model works on one GPU but gives different results on another.**
علت: ترتیب جمع بندی نقطه شناور غیر تعیین کننده. کاهش موازی GPU در ترتیب های مختلف در سخت افزار مختلف جمع می شود و اضافه کردن نقطه شناور مرتبط نیست.
اصلاح: تفاوت های کوچک را قبول کنید (1e-6) یا تنظیم کنید `torch.use_deterministic_algorithms(True)`و مجازات سرعت رو قبول کن

**Bug: `exp()` returns `inf` in loss computation.**
علت: لغو خام به `exp()`بدون ترفند معادلات
درست کردن: استفاده`torch.nn.functional.log_softmax()`که از طریق داخلی log-sum-exp اجرا می کند.

**Bug: Training diverges after switching from float32 to float16.**
علت: float16 نمی تواند مقادیر گرادینت زیر 6e-8 یا فعال سازی بالای 65,504 را نشان دهد.
درست کردن: استفاده از دقت مخلوط با مقیاس خسارت (AMP) ، یا استفاده از bfloat16 به جای.

```figure
logsumexp-stability
```

## آن را بسازید

### مرحله ی ۱: محدودیت های دقت نقطه شناور را نشان دهید

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### مرحله 2: پیاده سازی ساده در مقابل نرم مستحکم

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

### مرحله 3: پیاده سازی ثابت log-sum-exp

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

### مرحله چهارم: پیاده سازی انترپی ثابت

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

### مرحله 5: بررسی درجه بندی

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

## ازش استفاده کن

### شبیه سازی دقیق مخلوط

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

### قطع کردن درجه

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

### تشخیص NaN/Inf

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

ببین`code/numerical.py`برای اجرای کامل با تمام موارد کناری نشان داده شده است.`code/numerical.ts`یک پورت تایپ اسکریپت با همان عملکرد و نمایش ها است.

## -باده

این درس نتیجه می دهد:
- `code/numerical.py`با نرم بودن ثابت، log-sum-exp، cross-entropy، gradient checking و مخلوط شبیه سازی دقیق
- `outputs/prompt-numerical-debugger.md`برای تشخیص NaN/Inf و مسائل عددی در آموزش

این پیاده سازی های پایدار در مرحله 3 در هنگام ساخت حلقه آموزش و در مرحله 4 در هنگام پیاده سازی مکانیسم های توجه دوباره ظاهر می شوند.

## تمرینات

1. **Catastrophic cancellation.**با استفاده از فرمول ساده، تفاوت [1000000.0, 1000001.0, 1000002.0] را محاسبه کنید $\mathbb{E}[x^2] - \mathbb{E}[x]^2$سپس با استفاده از الگوریتم آنلاین ولفورد آن را محاسبه کنید. اشتباهات را با تفاوت واقعی (0.6667) مقایسه کنید.

2. **Precision hunt.**کوچکترین ارزش مثبت float32 را پیدا کنید `x`مثل اين`1.0 + x == 1.0`این ماشین ایپسیلون است. مطمئن شوید که با آن مطابقت دارد.`numpy.finfo(numpy.float32).eps`. .

3. **Log-sum-exp edge cases.**امتحان کن`logsumexp_stable`عملکرد با: (ا) همه ارزش ها برابر، (ب) یک مقدار بسیار بزرگتر از بقیه، (ج) همه ارزش های بسیار منفی (-1000).

4. **Gradient checking a neural network layer.**یک لایه خطی واحد را اجرا کنید`y = Wx + b`و مرور تحليلي به عقبش`numerical_gradient`برای بررسی دقت برای یک ماتریس وزن 3x2.

5. **Loss scaling experiment.**تمرین را با float16 شبیه سازی کنید: gradients تصادفی را در محدوده [1e-9, 1e-3] ایجاد کنید، به float16 تبدیل کنید و اندازه گیری کنید که کدام کسری صفر می شود. سپس مقیاس خسارت را اعمال کنید (برابر 1024) ، به float16 تبدیل کنید، مقیاس را دوباره اندازه گیری کنید.

### اشاره ها

**Exercise 1.**3 تا را با `np.float32`قبل از اينکه اونا رو مساوي کني، بعد زنگ بزن`variance_naive`و`welford_variance`. ارزش نزدیک$10^{12}$در float32 فاصله خیلی بزرگتر از 1 است، بنابراین انتظار داشته باشید که نتیجه ساده ای از 0.6667 دور باشد و نتیجه Welford نزدیک باشد.

**Exercise 2.**از شروع به`x = np.float32(1.0)`و نصفش کنم تا`np.float32(1.0) + x != np.float32(1.0)`. هر ارزش را در float32 نگه دارید، سپس آخرین مقدار را که هنوز هم مقدار را تغییر داده است با `numpy.finfo(numpy.float32).eps`، که$2^{-23}$. .

**Exercise 3.**اول هر جواب رو پيش بيني$n$ارزش های برابر$c$، نتیجه اش اینه$c + \ln n$برای یک مقدار بزرگ، نتیجه نزدیک به آن مقدار است. برای ارزش های نزدیک به -1000، نتیجه نزدیک است.$-1000 + \ln n$، در حالیکه`logsumexp_naive`بازپرداخت`-inf`چون هر نمادین زیر 0 می رود.

**Exercise 4.**برای$y = Wx + b$با خسارت$L$، تراشه برای $W$محصول بیرونی گرادینت بالا و $x$. خسارت رو به عنوان تابع مسطحات بسته$W$، تماس بگیرید`numerical_gradient`، و هر دو نتیجه رو به `check_gradient`. .

**Exercise 5.**اندازه ها را در مقیاس یازده ای با `10 ** np.random.uniform(-9, -3, n)`و با آن تبدیل شدن`np.float16`. Float16 نمیتونه ارزش ها رو زیر حدود نگه داره$6 \times 10^{-8}$، پس انتظار داشته باشید که حدود یک چهارم از ارزش ها قبل از مقیاس بندی صفر شوند و تقریبا هیچ بعد از ضرب 1024

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)-- مرجع نهایی، فشرده اما کامل
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- مقاله NVIDIA که مقیاس خسارت را برای آموزش فلوات16 معرفی کرد
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- راهنمای عملی برای دقت مخلوط در PyTorch
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- چرا گوگل این فرمت را برای TPU ها انتخاب کرد
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- الگوریتم برای کاهش خطای گرد کردن در مجموعات نقطه شناور
