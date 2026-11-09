# نموذج المراقبة في الإنتاج  التدفق البيانات وتدفق المفاهيم

> النموذج المُنشر يفشل دون رسالة خطأ. يواصل إرجاع النتائج بينما يتحرك العالم بعيداً عن بياناته التدريبية، و فقط المراقبة تظهر الفجوة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## أهداف التعلم

- اختر إشارات المراقبة في أربع طبقات: صحة النظام، المدخلات، التنبؤات، والنتائج
- تمييز التدفق المتغير ، والتدفق السابق ، والتدفق المفاهيم من خلال الجزء من التوزيع المشترك الذي يتغير
- تنفيذ مؤشر استقرار السكان، وإحصاء كولموجوروف-سميرنوف من عينتين، واختبار المربع الصيني من الصفر
- مقارنة نافذة مرجعية ثابتة مع نافذة متحركة الحالية، وشرح كيف تغير حجم النافذة الضوضاء والتأخير
- تصميم سياسة تحذير تحد من الإنذارات الكاذبة مع حجم التأثيرات، وتصحيح اختبار متعدد، وقاعدة الاستمرار
- تحديد نوع التجول الذي يحتاج إلى إعادة التدريب، والذي يحتاج إلى علامات جديدة، والذي لا يحتاج إلى أي إجراء

## المشكلة

نموذج مخاطر الدفع ينطلق مع دقة 95 في المائة. بعد شهرين، تجلب حملة تسويقية مستخدمي التطبيقات مع أسطول أكبر. بعد أربعة أشهر، يغير المحتالون تكتيكاتهم، وتبدأ الدفع التي كانت آمنة في تحويل إلى إعادة التسويق.

تعيد خدمة النموذج HTTP 200 لكل طلب خلال كل هذا. التأخير طبيعي، ولا تظهر السجلات أي أخطاء. أول علامة على مشكلة هي تقرير مالي حول إعادة التسديدات، بعد أسابيع من الأضرار.

يُحقق مراقبة البرمجيات ما إذا كانت خدمة تستجيب. يُحقق مراقبة النموذج ما إذا كانت الإجابات ما زالت صحيحة، وما إذا كانت البيانات ما زالت تبدو مثل البيانات التي تدربت النموذج. يُبني هذا الدروس الإحصاءات والنوافذ وسياسة التحذير لهذا العمل الثاني. تقوم بتشغيلها على تيار اصطناعي مع تغييرين مسبوقين ومراقبة ما الذي يتفاعل مع أي تغيير.

## المفهوم

### ما الذي يجب مراقبته

مراقبة أربع طبقات، أول ثلاثة تنبيهات مبكرة، فقط الرابعة تقيس الدقة، وتصل متأخرة.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

مراقبة المدخلات هي الموضوع الرئيسي لهذا الدروس، لأنه يعمل قبل وصول اللبوابات. لديها حد يظهر في التجربة: بعض التغييرات تترك المدخلات دون تغيير.

### ثلاثة أنواع من التجول

اكتب التوزيع المشترك للمدخلات`x`و العلامات`y`بطرق اثنتين:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

كل نوع من التجرف يغير عامل مختلف:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

(غاما) وآخرون) دعوة لتغيير في`P(y | x)`التجول المفاهيم الحقيقية.`P(x)`هذا يترك`P(y | x)`ويقومون بتقسيم التجول حسب كيفية حدوثها مع مرور الوقت: فجأة أو تدريجياً أو تدريجياً أو كفكرة تعود مرة أخرى.

التجول المتغير لا يؤذي دائماً إذا تعلم النموذج`P(y | x)`حسناً، فإنه يبقى صحيحاً لكل مدخل، ومازال يمكن أن يفقد دقة عندما يتحرك المرور إلى مناطق مع قلة بيانات التدريب أو قريبة من حدود القرار.

### التسميات المتأخرة

النتيجة تأتي بعد التنبؤ، التأخير يعتمد على المشكلة:

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

خلال التأخير، لديك المدخلات والتنبؤات ولكن لا نتائج. مراقبة المدخلات والتنبؤات، والانضمام إلى اللبصات عندما تصل، وحساب مقاييس النتيجة على الجزء الملصق فقط. تستخدم التجربة التجريبية تأخير اللبص من 500 حدث، لذلك يبحث مراقب النتيجة دائما 500 حدث في الماضي.

### النوافذ المرجعية والتيارية

كل اختبار تجري مقارنة عينين:

- **Reference window.**بيانات التدريب أو فترة الإنتاج التي تحققت منها يدوياً، تبقى ثابتة حتى تعيد التدريب
- **Current window.**أحدث الأحداث، أو الأخيرة`N`الأحداث أو الأخيرة`T`ساعات

تتحرك النافذة المنزلقة إلى الأمام بخطوة أصغر من حجمها، لذلك تتداخل النوافذ المتتالية. تتحرك النافذة المنزلقة بحجمها الكامل. حجم النافذة هو تغيير. تتفاعل النافذة الصغيرة بسرعة ولكن تسجل الضجيج كما التحرك. النافذة الكبيرة مستقرة ولكن تبلغ عن تغيير في وقت متأخر.

الموسمية تقطع نوافذ ساذجة. حركة المرور يوم الاثنين تختلف عن حركة المرور يوم السبت في العديد من المنتجات. اجعل المرجح تغطي دورة كاملة، أو مقارنة كل نافذة مع نفس الفترة في دورة سابقة.

### مؤشر استقرار السكان

يُعتبر أنّه من المُقدّر أنّه يُحَصّل على 10٪ من المُقدّر. وذلك من خلال إحصاء القيم الحاليّة في كلّ قِطَع. ثمّ قم بتجميع عبارة واحدة لكلّ قِطع:

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

إن القمامة ذات حصة من الصفر تجعل السجل لا نهائي، لذلك قم بتقطيع كل حصة إلى قيمة صغيرة مثل 0.0001. PSI متماثلة. إنها تساوي تباين KL من التيار إلى المرجع بالإضافة إلى تباين KL من المرجع إلى التيار.

يقرأ الممارسون PSI مع فئات ثابتة: أقل من 0.1 مستقرة ، و 0.1 إلى 0.25 هي تحول معتدل ، و فوق 0.25 هو تحول كبير. تعامل هذه الفئات كقاعدة ، وليس اختبار. ينمو PSI مع عدد الحاويات وتقلص مع حجم العينة. في التجربة ، تشكّل نوافذ 500 حدث بدون نتيجة تجريدية بين 0.01 و 0.04.

### إحصاء كولموجوروف-سميرنوف

إحصاءات KS من عينتين `D`هو أكبر فجوة عمودية بين وظائف التوزيع التراكمية التجريبية:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`هو 0 بالنسبة للعينات المتماثلة و 1 بالنسبة للعينات التي لا تتداخل. لا تحتاج إلى حاويات. القيمة p تأتي من توزيع كولموجوروف مع حجم العينة الفعلي `n * m / (n + m)`. . .

مع عينات كبيرة، يذهب قيمة p إلى الصفر لفجوة لا يهتم بها أحد. تحول من الاختلافات القياسية 0.02 هو "مهم" مع مليون حدث في كل نافذة. استخدام `D`نفسها كحجم تأثير، والتحذير فقط عندما كلاهما `D`و قيمة p تتجاوز عتبة

### اختبار المربع الشي لخصائص فصلية

لصفف فصلي، مثل قناة الدفع، قم ببناء جدول يضم صفين (المرجعية، الحالية) وعمدة واحدة لكل فئة.

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

الاختبار لديه`k - 1`درجات الحرية لـ`k`فئة. فئة التي تظهر فقط في النافذة الحالية تضيف مصطلح كبير، لذلك يستجيب الاختبار إلى قيم جديدة. V من كرامير هو حجم التأثير. بالنسبة إلى جدول مع صفين، هو يساوي الجذر التربيعي من `chi2 / grand_total`. . .

### حدود التحذير والإشعارات الكاذبة

كل اختبار لديه معدل إنذار خاطئ`alpha`عندما لا يتغير شيء، يقوم المراقبة بتجربة كثيرة، مع 50 ميزة يتم التحقق منها كل ساعة`alpha = 0.05`تتوقع حوالي 60 إنذار كاذب يومياً عندما لا يتغير شيء الناس يتوقفون عن قراءة الإشعارات قبل ذلك بكثير

أربعة قواعد تبقي معدل الإنذار مفيد:

1. **Correct for multiple tests.**تصحيح بونفيروني يفرق `alpha`و حسب عدد الاختبارات، الظهور يستخدم عائلة`alpha`من 0.01 على اختبارات اثنتين، لذلك كل اختبار يستخدم 0.005.
2. **Require an effect size.**تحذير فقط عندما يكون جهاز التحكم في الأجهزة`D`أو V من Cramér أيضا يمر عتبة.
3. **Require persistence.**تحذير فقط بعد`k`نافذة التجول المتتالية`k = 2`. . .
4. **Separate warnings from alerts.**تحذير يذهب إلى لوحة التحكم تحذير يذهب إلى شخص

يظهر التجربة القاعدة 2 في العمل. نافذة واحدة نظيفة لديها قيمة p-مربع 0.0009 ، أقل من الاختبار`alpha`. إنّ "ف" (كرامر) أقل من 0.1، لذا سيّدة التأمين تسجل تحذيرًا، وليس تحذيرًا

### محفزات إعادة التدريب

هناك ثلاثة عوامل عامة لإعادة التدريب:

- **Schedule.**إعادة التدريب كل أسبوع أو شهر، هذا بسيط، لكنه يعيد التدريب عندما لا يتغير شيء وينتظر عندما يحدث شيء
- **Drift.**إعادة التدريب عندما يظل التدفق المدخل على الميزات الهامة فوق العد.
- **Performance.**إعادة التدريب عندما تنخفض مقياس النتيجة تحت قيمة المرجعية ناقص التسامح.

نوع التجول يقرر ما يمكن إعادة التدريب أن تفعل:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

بعد إعادة التدريب، اختبر النموذج الجديد على أحدث البيانات الملصقة. اطلع عليه مع مراحل الظل والقناري من درس تصميم النظام. ثم أعيد تعيين نافذة المرجعية إلى بيانات التدريب الجديدة.

```figure
mlprod-drift-psi
```

## بناءها

الرمز في`code/main.py`يستخدم المكتبة القياسية فقط.

### الخطوة الأولى: صناديق الكمية و PSI

حواف القمامة هي الديسيلات المرجعية`bisect_right`يجد القمامة لكل قيمة

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

### الخطوة الثانية: إحصاءات KS وقيمة p

قم بمشي كل عينتين المرتبتين معاً. عند كل قيمة متميزة، قم بتجاوز كل نسخة منها في كل عينتين، ثم مقارنة الشركات الإجمالية. هذا يتعامل مع العلاقات بشكل صحيح.

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

تستخدم قيمة p سلسلة لتوزيع كولموجوروف`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`، مع`lambda = sqrt(n * m / (n + m)) * D`. . .

### الخطوة الثالثة: اختبار المربع الشي

`chi2_sf`يحسب وظيفة بقاء المربع من خلال وظيفة غاما غير كاملة العليا المعتادة. يستخدم سلسلة للحقائق الصغيرة وقطع مستمر للحقائق الكبيرة. `chi_square_test`يقوم ببناء الجدول المكون من صفين، ويحسب الإحصاءات، ويرجع قيمة p و V من Cramér.

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

### الخطوة الرابعة: النوافذ و جهاز التدفق

`SlidingWindow`يحتفظ بالآخرين`size`الأحداث في `deque`. .`DriftMonitor`يحسب صناديق المرجعية ويعد مرة واحدة.`check`الطريقة تعيد PSI، `D`و قيمة KS p لكل صفة رقمية و نتيجة chi- مربع لكل صفة فصلية

### الخطوة 5: سياسة التحذير

تحويل السياسة كل مقياس محدد إلى مستوى وتحسب نافذة التدفق المتتالية لكل إشارة:

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

`update`العائدات`ALERT`على النافذة التي تكمّل السلسلة، و`resolved`على أول نافذة نظيفة بعد الإشعار

### الخطوة 6: تيار مع تدفق الحقن

يتضمن هذا التدفق 9000 حدث دفع مع `amount`، أ`channel`واحتيال`label`أربعة قطاعات تعرّفها:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

النموذج هو عتبة على`amount`ويتم تثبيتها على أول 2000 حدث ويندوز تحتوي على 500 حدث ويتحرك بحلول 250

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

اقرأ النتيجة في ثلاثة أجزاء:

- **Covariate drift.**يبدأ التجول في الحدث 3000، و `amount`التنبيه يتبع عند 3500، والدقة تبقى بين 0.89 و 0.95، لأن قاعدة العلامة لم تتغير.
- **Recovery.**العودة إلى طبيعة المدخلات عند 5000، وتحل كلتا الإشعارات عند 5500.
- **Concept drift.**تبدأ التدفق عند 6500 ، وتبقى أجهزة مراقبة المدخلات هادئة لأن المدخلات لم تتغير. تنخفض دقة من 0.946 إلى ما بين 0.76 و 0.79. يأتي إنذار الدقة عند 7500 ، 1000 حدث بعد التغيير ، ويمثل تأخير اللقب 500 منهم.

## استخدمها

**scipy.** `scipy.stats`لا تحتاج إلى دراسة لتشغيل هذا الدروس.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

لقد تحققت`ks_statistic`و`chi_square_test`في عام 2011 ، تم تقييم قيمة المعدل في المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل المعدل الم

الفجوة تأتي من الطريقة، لدينا رمز يستخدم التوزيع القياسي كولموجوروف.`ks_2samp`يستخدم طريقة دقيقة عندما يكون لكل عينتين قيمًا 10,000 على الأكثر. يستخدم وضعها غير المفروض توزيع نموذج محدود مع حجم العينة الفعلية المستديرة. مع فئتين ، `chi2_contingency`يطبق تصحيح استمرارية ييتس بطبيعة الحال، لذلك تختلف الإحصاءات هناك.

**Monitoring libraries.**العديد من مكتبات المصدر المفتوحة تضم هذه الاختبارات ببيانات ومؤشرات التحكم:

- **Evidently**يختار اختبار التدفق لكل عمود. بالنسبة للمراجعة التي تضم 1000 سطر أو أقل، فإنه يستخدم اختبار KS للعمود الرقمية واختبار chi-square للعمود الفئوية. بالنسبة للبيانات الأكبر، فإنه يستخدم مسافة Wasserstein واختلاف Jensen-Shannon مع عتبة 0.1. PSI هي واحدة من الطرق الأخرى التي يمكنك اختيارها.
- **NannyML**تقدير أداء النموذج قبل وصول العلامات التجارية. تستخدم تقدير الأداء القائم على الثقة (CBPE) احتمالات النموذج المتوقعة ، والتي يجب أن تكون مقياسة بشكل جيد. تنص وثائق NannyML على أن CBPE يتعامل مع التحول المتغير ولكن لا يتعامل مع التحرك المفاهيم. يظهر تدفق التجربة لماذا: فقط العلامات التجارية كشفت عن التحرك المفاهيمي.
- **TensorFlow Data Validation**يستخدم المسافة L-اللامتناهي للميزات الفئوية واختلاف جينسن-شانون المحدود للميزات الرقمية. يُقارن أيضًا بيانات التدريب مع بيانات الخدمة، التي تغطي درس مخزن الميزات.

يظهر الرمز من الصفر ما تقوم به كل هذه الأدوات. الأدوات تضيف التخزين والجدول الجوي واللواح المراقبة، وغيرها من الاختبارات.

بالنسبة لطلبات الماجستير في مجال القانون،[LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)في مرحلة البنية التحتية تغطي أدوات التتبع والتقييم. لا تزال الأفكار في هذا الدروس تطبق على المدخلات والخروجات من تلك الأنظمة.

## أرسله

هذا الدرس يُنتج`outputs/skill-drift-monitoring.md`. تقوم المهارة بتخطيط المراقبين لنموذج جديد وتحديد حالة التحذير عن التجول. تسأل عن الطبقة التي أطلقتها، وما نوع التجول الذي يتناسب مع الأدلة، وما إذا كان الإجراء الصحيح هو الانتظار، وإعادة تصنيف، وجمع العلامات، أو إعادة التدريب.

## التمارين

1. إشغلي التيار مع نافذة من 200 و 2000 حدث، سجل التحذيرات الكاذبة قبل الحدث 3000 والتأخير الإلهام.
2. المجموعة`n_tests=1`،`patience=1`و`min_cramers_v=0`عد الإشعارات في الفترة النظيفة من 5000 إلى 6500.
3. أضف ميزة يزيد متوسطها 0.01 لكل 100 حدث. اكتشف أي إشارة، PSI أو KS، تتفاعل أولاً.
4. قم بتنفيذ مسافة (جينسن شانون) على نفس الحاويات المتحركة، وقارنها مع (بي إس آي) على كل نافذة.
5. أضف جهاز مراقب لمعدل التنبؤ الإيجابي للنموذج و اشرح لماذا يبقى هادئا خلال التجول المفاهيم

## الشروط الرئيسية

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

## المزيد من القراءة

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): التجرف الحقيقي والعملي، وأنماط التجرف، وأساليب التكيف
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): اختبارات نموذجية للكشف عن التحول
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): أساليب الكشف عن التحرك والفهم والتكيف
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): كيفية سلوك PSI مع حجم العينة وعدد القمامة
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): أساليب الدقة والعكسية للقيمة p للاختبار KS على عينتين
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): اختيار اختبار افتراضي حسب نوع العمود وحجم البيانات
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE وافتراضاتها
