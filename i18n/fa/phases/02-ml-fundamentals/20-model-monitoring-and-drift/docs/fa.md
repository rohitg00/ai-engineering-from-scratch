# مدل های نظارت در تولید  جریان داده ها و جریان مفهوم

> یک مدل در حال اجرا بدون پیام خطا شکست می خورد. در حالی که جهان از داده های آموزش خود دور می شود، امتیازات را باز می گرداند و تنها نظارت شکاف را نشان می دهد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## اهداف یادگیری

- سیگنال های نظارت را در چهار لایه انتخاب کنید: سلامت سیستم، ورودی، پیش بینی و نتایج
- تفاوت میان فرش های همتای، فرش های قبلی و فرش های مفهومی را با بخش توزیع مشترک که تغییر می کند تشخیص دهید.
- اجرای شاخص ثبات جمعیت، آمار دو نمونه کلمگوروف-سمرنوف و آزمون چایی از نو
- یک پنجره مرجع ثابت را با پنجره های پرتاب کننده فعلی مقایسه کنید و توضیح دهید که چگونه اندازه پنجره تغییر می کند صدا و تاخیر
- یک سیاست هشدار را طراحی کنید که به اندازه های اثر، اصلاح چند بار آزمایش و قانون پایداری هشدار های غلط محدود کند
- تصمیم بگیرید که چه نوع حرکت نیاز به آموزش مجدد دارد، چه نوع حرکت نیاز به برچسب های جدید دارد و چه نوع حرکت نیاز به هیچ اقدام نیست

## مشکل

یک مدل خطر پرداخت با 95 درصد دقت به کار می رود. دو ماه بعد، یک کمپین بازاریابی کاربران را با سبد های بزرگتر به کار می آورد. چهار ماه بعد، کلاهبرداران تاکتیک خود را تغییر می دهند و پرداخت هایی که قبلا ایمن بودند شروع به تبدیل به پرداخت مجدد می کنند.

سرویس مدل HTTP 200 را برای هر درخواست در طول این کار باز می گرداند. تاخیر طبیعی است و سوابق هیچ خطا ای را نشان نمی دهد. اولین نشانه مشکل گزارش مالی در مورد هزینه های بازپرداخت است، هفته ها پس از آسیب.

نظارت نرم افزار بررسی می کند که آیا یک سرویس پاسخ می دهد. نظارت مدل بررسی می کند که آیا پاسخ ها هنوز درست هستند و آیا داده ها هنوز شبیه داده هایی هستند که مدل را آموزش داده اند. این درس آمار، پنجره ها و سیاست هشدار را برای این کار دوم ایجاد می کند. شما آنها را در جریان مصنوعی با دو تغییر تزریق می کنید و تماشا کنید که چه مانیتور به کدام تغییر واکنش نشان می دهد.

## مفهوم

### چه چیزی را باید نظارت کنیم

چهار لایه را نظارت کنید. سه لایه اول هشدار زودرس می دهند. تنها چهارمه اندازه گیری درستگی می کند و دیر می رسد.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

نظارت بر ورودی موضوع اصلی این درس است، زیرا قبل از ورود برچسب ها کار می کند. این محدودیت را دارد که نمایش نشان می دهد: برخی تغییرات ورودی را بدون لمس می کند.

### سه نوع حرکت

تقسیم مشترک ورودی ها را بنویسید `x`و برچسب ها`y`دو راه:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

هر نوع انحراف عامل متفاوتی را تغییر می دهد:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

گاما و همکارانش تغییراتی را در`P(y | x)`.فکر واقعی حرکت می کند . آنها تغییر در`P(x)`که میره`P(y | x)`در نظرسنجی آنها همچنین به این ترتیب که چگونه در طول زمان اتفاق می افتد، فراری می کند: ناگهانی، افزون، تدریجی، یا به عنوان یک مفهوم که به عقب می آید.

حرکت متغیر همیشه درد نمی کنه`P(y | x)`خب، برای هر ورودی درست می ماند. هنوز هم می تواند دقت خود را از دست بدهد وقتی ترافیک به مناطق با اطلاعات آموزشی کمی یا نزدیک به مرز تصمیم گیری حرکت می کند.

### برچسب های تاخیر

نتیجه بعد از پیش بینی میرسد. تاخیر به مشکل بستگی دارد:

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

در طول تاخیر، شما ورودی و پیش بینی ها دارید اما هیچ نتیجه ای ندارید. ورودی ها و پیش بینی ها را نظارت کنید، وقتی به برچسب ها می رسند، به آنها پیوسته شوید و فقط بر روی بخش برچسب گذاری شده معیارهای نتیجه را محاسبه کنید. نمایشگر از تاخیر برچسب 500 رویداد استفاده می کند، بنابراین مانیتور نتیجه همیشه 500 رویداد را به گذشته نگاه می کند.

### پنجره های مرجع و جریان

هر آزمایش حرکت دو نمونه را مقایسه می کند:

- **Reference window.**اطلاعات آموزش، یا دوره تولید که شما دستانه بررسی کردید، ثابت باقی می ماند تا زمانی که شما دوباره آموزش بگیرید.
- **Current window.**آخرین اتفاقات، یا آخرین اتفاقات`N`اتفاقات یا آخرین اتفاقات`T`ساعت ها

یک پنجره پرتاب به جلو یک قدم کوچکتر از اندازه اش حرکت می کند، بنابراین پنجره های متوالی همپوش می شوند. یک پنجره پرتاب به اندازه کامل خود حرکت می کند. اندازه پنجره یک تعادل است. یک پنجره کوچک به سرعت واکنش نشان می دهد اما صدای حرکت را نشان می دهد. یک پنجره بزرگ پایدار است اما تغییر را دیر گزارش می دهد.

فصلی بودن پنجره های ساده را شکسته است. ترافیک دوشنبه در بسیاری از محصولات از ترافیک شنبه متفاوت است. قرار دهید که مرجع یک چرخه کامل را پوشش دهد، یا هر پنجره را با دوره مشابه در یک چرخه قبلی مقایسه کنید.

### شاخص ثبات جمعیت

PSI از امتیاز اعتبار حاصل می شود. مقادیر مرجع را به سطل ها، معمولاً ده سطل در دسیل مرجع، برش دهید تا هر سطل 10 درصد از مرجع را نگه دارد. سهم ارزش های فعلی را در هر سطل محاسبه کنید. سپس یک اصطلاح را در هر سطل اضافه کنید:

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

یک باین با سهم صفر باعث می شود که این سوابق بی نهایت باشد، بنابراین هر سهم را به یک مقدار کوچک مانند 0.0001 کاپ کنید. PSI متقابل است. این برابر با انحراف KL از جریان به مرجع و همچنین انحراف KL از مرجع به جریان است.

تمرین کنندگان PSI را با باند های ثابت می خوانند: زیر 0.1 پایدار است، 0.1 تا 0.25 تغییر متوسط است و بالاتر از 0.25 تغییر قابل توجهی است. این باند ها را به عنوان یک کنوانسیون، نه یک آزمایش، رفتار کنید. PSI با تعداد سطل و کوچک شدن اندازه نمونه رشد می کند. در نمایشگاه، پنجره های 500 رویداد بدون امتیاز حرکت بین 0.01 تا 0.04 است.

### آمار کلموگوروف-سمرنوف

آمار دو نمونه KS `D`بزرگترین شکاف عمودی بین دو تابع توزیع تجمیمی تجربی است:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`برای نمونه های یکسان 0 و 1 برای نمونه هایی که همپوش نمی شوند. به هیچ سطل نیاز ندارد. ارزش p از توزیع کلمگوروف با اندازه نمونه واقعی می آید `n * m / (n + m)`. .

با نمونه های بزرگ، ارزش p برای شکافی که هیچ کس به آن اهمیت نمی دهد به صفر می رسد. تغییر انحرافات استاندارد 0.02 با یک میلیون رویداد در هر پنجره "معنی" است. استفاده `D`خود را به عنوان یک اندازه اثر، و هشدار فقط زمانی که هر دو `D`و ارزش p از حد عبور می کند.

### آزمون چِ- مربع برای ویژگی های دسته بندی

برای یک ویژگی دسته بندی مانند کانال پرداخت، یک جدول با دو ردیف (رجای، جریان) و یک ستون در هر دسته ایجاد کنید. تعداد انتظار می رود در هر سلول از کل ردیف و ستون ها می آید:

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

آزمایش داره`k - 1`درجه آزادی برای`k`دسته بندی: یک دسته که فقط در پنجره فعلی ظاهر می شود یک اصطلاح بزرگ اضافه می کند، بنابراین تست به ارزش های جدید واکنش نشان می دهد. V Cramér اندازه اثر است. برای یک جدول با دو ردیف، برابر با ریشه مربع `chi2 / grand_total`. .

### آستانه های هشدار و آستانه های دروغین

هر تست يه ريت از زنگ هاي دروغين داره`alpha`وقتی هیچ تغییری نکرده، نظارت آزمایش های زیادی انجام می دهد. با 50 ویژگی هر ساعت در`alpha = 0.05`، شما انتظار دارید که در روز حدود 60 تا هشدار دروغین داشته باشید وقتی هیچ تغییری نداشته باشد مردم خیلی قبل از آن از خواندن هشدارها دست بردارند

چهار قانون باعث می شه نرخ هشدار مفید باشه:

1. **Correct for multiple tests.**اصلاح بونفرونی تقسیم می کنه`alpha`از تعداد تست ها استفاده ميکنه`alpha`از 0.01 در دو آزمایش، بنابراین هر آزمایش از 0.005 استفاده می کند.
2. **Require an effect size.**فقط در صورت بروز PSI هشدار بده`D`، یا V Cramér هم از یک حد عبور می کند.
3. **Require persistence.**فقط بعد از`k`پنجره هاي دوچرخه ي پيوند`k = 2`. .
4. **Separate warnings from alerts.**يه هشدار به يه داشبورد مياد يه هشدار به يه نفر مياد

در نمایشنامه قانون 2 در حال کار است. یک پنجره پاک دارای p-قیمت chi- مربع 0.0009 است، پایین تر از هر آزمون`alpha`. درجه "کرامر"ش کمتر از 0.1ه، پس سيستم هشدار ميده نه هشدار

### عوامل فعال تربیتی مجدد

سه عامل رایج برای آموزش مجدد وجود دارد:

- **Schedule.**هر هفته یا هر ماه تمرین می کنم، این کار ساده است، اما وقتی هیچ چیز تغییر نکرده، تمرین می کند و وقتی چیزی تغییر کرده، منتظر می ماند.
- **Drift.**بازتدريب زمانی که حرکت ورودی در ویژگی های مهم بالاتر از حد قرار گیرد.
- **Performance.**بازتدريب زمانی که یک متریک نتیجه پایین تر از مقدار مرجع به دست آوردن تحمل می رسد.

نوع حرکت تصمیم می گیرد که آموزش مجدد چه کاری می تواند انجام دهد:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

پس از آموزش مجدد، مدل جدید را بر اساس آخرین داده های برچسب گذاری آزمایش کنید. آن را با مراحل سایه و کاناری از درس طراحی سیستم اجرا کنید. سپس پنجره مرجع را به داده های جدید آموزش تنظیم کنید.

```figure
mlprod-drift-psi
```

## آن را بسازید

کد در`code/main.py`فقط از کتابخانه استاندارد استفاده می کنه.

### مرحله ی اول: کاشی های کوانتلی و PSI

لبهاي سطل بازيکي هستند.`bisect_right`ردیف هر ارزش را پیدا می کند.

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### مرحله دوم: آمار KS و p-قیمت آن

هر دو نمونه را با هم جمع کنید. در هر مقدار متفاوت، از هر کپی آن در هر دو نمونه عبور کنید، سپس دو سهم تجمعی را مقایسه کنید. این به درستی روابط را اداره می کند.

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

ارزش p از سری برای توزیع کولمگوروف استفاده می کند`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`، با`lambda = sqrt(n * m / (n + m)) * D`. .

### مرحله سوم: آزمون چِ مربع

`chi2_sf`این سیستم از یک سری برای استدلال های کوچک و یک کسری مداوم برای استدلال های بزرگ استفاده می کند.`chi_square_test`جدول دو ردیف را ایجاد می کند، آمار را محاسبه می کند و ارزش p و V Cramér را باز می گرداند.

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### مرحله 4: پنجره ها و مانیتور حرکت

`SlidingWindow`آخرین ها رو نگه می داره`size`رویدادهای یک`deque`.`DriftMonitor`حساب کنترولات مرجع و شمارش یک بار`check`روش بازرس PSI`D`, و KS p-قیمت برای هر ویژگی عددی و chi- مربع نتیجه برای هر ویژگی دسته ای.

### مرحله پنجم: سیاست هشدار

این سیاست هر متریک را به یک سطح تبدیل می کند و پنجره های حرکت متناوب را برای هر سیگنال می شمرد:

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update`بازپرداخت`ALERT`در پنجره ای که خط را تکمیل می کند و`resolved`در اولين پنجره پاک بعد از هشدار

### مرحله 6: جریان با حرکت تزریق شده

جریان 9 هزار رویداد پرداخت با یک`amount`، یک`channel`، و یک تقلب`label`چهار بخش آن را تعریف می کنند:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

مدل یک حد در`amount`در اين قسمت، اين برنامه براي اولين 2000 رویداد نصب شده است. ویندوز 500 رویداد را نگه دارد و تا 250 حرکت مي کند. برچسب ها 500 رویداد را دير مي کنند.

```bash
python3 code/main.py
npx tsx code/main.ts
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

نتیجه را در سه بخش بخوانید:

- **Covariate drift.**حرکت در رویداد 3000 شروع میشه و`amount`دقت بین 0.89 تا 0.95 باقی می ماند چون قانون برچسب تغییر نکرده است.
- **Recovery.**ورودی ها به حالت عادی در 5000 برمی گردند و هر دو هشدار در 5500 حل می شوند.
- **Concept drift.**درایو در 6500 شروع می شود و مانیتورهای ورودی خاموش می مانند زیرا ورودی تغییر نکرده است. دقت از 0.946 به بین 0.76 تا 0.79 کاهش می یابد. هشدار دقیق در 7500، 1000 رویداد پس از تغییر می آید و تأخیر برچسب برای 500 از آنها حساب می کند.

## ازش استفاده کن

**scipy.** `scipy.stats`این آزمون ها را اجرا می کند. آمارها با کد از ابتدا مطابقت دارند. برای اجرای این درس نیازی به آموزش نیست.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

ما چک کردیم`ks_statistic`و`chi_square_test`در مقایسه با scipy 1.18.1 در نمونه های تصادفی. آمار KS، آمار چی مربع و ارزش p مربع چی با دقت نقطه شناور مطابقت داشت. بیش از 200 جفت نمونه تصادفی، ارزش p KS تا 18 درصد از ارزش scipy متفاوت بود. بزرگترین شکاف ها در ارزش p بسیار کوچک بود.

شکاف از روش مياد. کد ما از توزیع محدود کولمگوروف استفاده ميکنه.`ks_2samp`روش دقیق را در صورت داشتن هر دو نمونه حداکثر 10،000 مقدار استفاده می کند. حالت اسیمپتوتیک آن از توزیع نمونه نهایی با اندازه نمونه موثر گرد استفاده می کند. با دو دسته، `chi2_contingency`تعدیل تسلسل ییتس را بطور پیش فرض اعمال می کند، بنابراین آمار در آنجا متفاوت است.

**Monitoring libraries.**چندین کتابخانه منبع باز این آزمایش ها را با گزارش ها و داشبورد ها بسته بندی می کنند:

- **Evidently**برای یک تست حرکت در هر ستون. برای یک تست با 1000 ردیف یا کمتر، از آزمون KS برای ستون های عددی و آزمون chi-square برای ستون های دسته ای استفاده می کند. برای داده های بزرگتر، از فاصله Wasserstein و انحراف Jensen-Shannon با یک حد 0.1 استفاده می کند. PSI یکی از روش های دیگر است که می توانید انتخاب کنید.
- **NannyML**تخمین عملکرد مدل قبل از ورود برچسب ها. تخمین عملکرد مبتنی بر اعتماد (CBPE) از احتمالات پیش بینی شده مدل استفاده می کند که باید به خوبی کالیبر شود. اسناد NannyML می گوید که CBPE تغییر متغیر را اداره می کند اما با حرکت مفهوم مقابله نمی کند. جریان نمایش نشان می دهد چرا: تنها برچسب ها انحراف مفهوم را نشان داد.
- **TensorFlow Data Validation**این برنامه از فاصله بی نهایت L برای ویژگی های دسته بندی و انحراف جنزن-شانون برای ویژگی های عددی استفاده می کند. همچنین داده های آموزشی را با داده های ارائه شده که در درس ذخیره ویژگی پوشش داده می شود، مقایسه می کند.

کد از ابتدا نشان می دهد که هر یک از این ابزارها چه چیزی را محاسبه می کنند. ابزارها ذخیره سازی، برنامه ریزی، داشبورد و بسیاری از آزمایشات دیگر را اضافه می کنند.

برای درخواست های LLM، [LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)در مرحله زیرساخت، ابزار ردیابی و ارزیابی را پوشش می دهد. ایده های این درس هنوز هم برای ورودی و خروجی این سیستم ها اعمال می شود.

## -باده

این درس به ما کمک می کند`outputs/skill-drift-monitoring.md`مهارت برنامه ریزی مانیتورها برای یک مدل جدید و triages یک هشدار حرکت می پرسد. آن را می پرسد که چه لایه شلیک شده است، چه نوع حرکت متناسب با شواهد و آیا اقدام درست است برای صبر، دوباره کیلیبر، جمع آوری برچسب ها، یا آموزش مجدد.

## تمرینات

1. جریان رو با پنجره های 200 و 2000 رویداد اجرا کن، هشدار های غلط قبل از رویداد 3000 و تاخیر هشدار را ثبت کن.
2. تنظیم شده`n_tests=1`،`patience=1`و`min_cramers_v=0`. شماره هاي هشدار در دوره پاکي از 5000 تا 6500
3. یک ویژگی اضافه کنید که متوسط آن 0.01 در هر 100 رویداد افزایش می یابد. پیدا کنید که کدام سیگنال، PSI یا KS، اول واکنش نشان می دهد.
4. فاصله "جینسن-شانون" رو روی همان سطل های دسیلی اجرا کن.
5. یک مانیتور برای پیش بینی مثبت مدل اضافه کنید. توضیح دهید که چرا در طول حرکت مفهوم خاموش می ماند.

## اصطلاحات کلیدی

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## خواندن بیشتر

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): حرکت واقعی و مجازی، الگوهای حرکت و روش های سازگاری
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): دو نمونه آزمایش برای تشخیص تغییر
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): روش های تشخیص، درک و سازگاری
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): چگونه PSI با اندازه نمونه و تعداد سطل رفتار می کند
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): روش های دقیق و بی تفاوت ارزش p برای آزمون KS دو نمونه
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): انتخاب آزمون پیش فرض با توجه به نوع ستون و اندازه داده
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE و فرضیات آن
