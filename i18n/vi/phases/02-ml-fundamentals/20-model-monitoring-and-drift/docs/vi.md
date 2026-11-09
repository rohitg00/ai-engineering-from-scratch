# Mô hình giám sát trong sản xuất  Drift dữ liệu và Drift khái niệm

> Một mô hình được triển khai thất bại mà không có thông báo lỗi. Nó tiếp tục trả lại điểm số trong khi thế giới di chuyển ra khỏi dữ liệu đào tạo của nó, và chỉ có giám sát cho thấy khoảng cách.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## Mục tiêu học tập

- Chọn tín hiệu giám sát ở bốn tầng: sức khỏe hệ thống, đầu vào, dự đoán và kết quả
- Sự phân biệt giữa trôi động đồng biến, trôi động trước và trôi động khái niệm bằng phần phân phối chung thay đổi
- Thực hiện Chỉ số ổn định dân số, hai mẫu thống kê Kolmogorov-Smirnov, và kiểm tra chi-quad từ đầu
- So sánh một cửa sổ tham chiếu cố định với các cửa sổ chạy trượt, và giải thích kích thước cửa sổ thay đổi tiếng ồn và chậm trễ
- Thiết kế một chính sách cảnh báo giới hạn các báo động sai với kích thước hiệu ứng, sửa đổi nhiều lần kiểm tra và quy tắc kiên trì
- Quyết định loại drift cần đào tạo lại, cần nhãn mới và không cần hành động

## Vấn đề

Một mô hình rủi ro thanh toán được thực hiện với độ chính xác 95%. Hai tháng sau, một chiến dịch tiếp thị đưa người dùng ứng dụng vào với những chiếc rổ lớn hơn.

Dịch vụ mô hình trả về HTTP 200 cho mỗi yêu cầu trong suốt tất cả những điều này. Thời gian trễ là bình thường, và các nhật ký không cho thấy sai lầm. dấu hiệu đầu tiên của vấn đề là một báo cáo tài chính về các khoản hoàn lại, vài tuần sau khi thiệt hại.

Việc giám sát phần mềm kiểm tra xem dịch vụ có trả lời hay không. Việc giám sát mô hình kiểm tra xem câu trả lời vẫn đúng hay không và liệu dữ liệu vẫn trông giống như dữ liệu đã đào tạo mô hình hay không. Bài học này xây dựng các số liệu thống kê, cửa sổ và chính sách cảnh báo cho công việc thứ hai đó. Bạn chạy chúng trên một dòng tổng hợp với hai thay đổi tiêm và xem màn hình nào phản ứng với thay đổi nào.

## Khái niệm

### Điều gì cần theo dõi

Theo dõi bốn lớp, ba lớp đầu tiên báo trước, chỉ có thứ tư đo độ chính xác, và nó đến muộn.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

Việc giám sát đầu vào là chủ đề chính của bài học này, bởi vì nó hoạt động trước khi các nhãn đến. Nó có một giới hạn mà bản demo cho thấy: một số thay đổi để lại đầu vào không bị ảnh hưởng.

### Ba loại trôi

Viết phân phối chung của các đầu vào `x`và nhãn`y`Hai cách:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

Mỗi loại biến động thay đổi một yếu tố khác nhau:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

Gama et al. gọi thay đổi trong `P(y | x)`Họ gọi là sự thay đổi trong`P(x)`- Nó còn lại.`P(y | x)`Phân tích của họ cũng phân loại sự xoay xở theo cách nó xảy ra theo thời gian: đột ngột, tăng dần, dần dần, hoặc như một khái niệm trở lại.

Sự trôi dạt có tính biến đổi không phải lúc nào cũng gây tổn thương.`P(y | x)`Nó vẫn có thể mất độ chính xác khi giao thông di chuyển đến các khu vực có ít dữ liệu đào tạo hoặc gần biên giới quyết định.

### Các nhãn chậm

Kết quả đến sau khi dự đoán.

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

Trong thời gian trì hoãn, bạn có đầu vào và dự đoán nhưng không có kết quả. Theo dõi đầu vào và dự đoán, tham gia vào các nhãn khi chúng đến và tính toán số liệu kết quả chỉ trên phần được dán nhãn. Demo sử dụng một sự trì hoãn nhãn 500 sự kiện, vì vậy màn hình kết quả luôn nhìn vào 500 sự kiện trong quá khứ.

### Chiếc cửa sổ tham chiếu và cửa sổ hiện tại

Mỗi thử nghiệm dẫn dắt so sánh hai mẫu:

- **Reference window.**Dữ liệu đào tạo, hoặc thời gian sản xuất mà bạn kiểm tra bằng tay. Nó sẽ không bị cố định cho đến khi bạn đào tạo lại.
- **Current window.**Những sự kiện gần đây nhất, hoặc là những sự kiện cuối cùng `N`sự kiện hoặc những sự kiện cuối cùng `T`- Nhiều giờ.

Một cửa sổ trượt di chuyển về phía trước một bước nhỏ hơn kích thước của nó, do đó các cửa sổ liên tiếp chồng chéo. Một cửa sổ trượt di chuyển bằng kích thước đầy đủ của nó. kích thước cửa sổ là một sự đổi giá. Một cửa sổ nhỏ phản ứng nhanh nhưng ghi âm như lở. Một cửa sổ lớn ổn định nhưng báo cáo một sự thay đổi muộn.

Tính theo mùa phá vỡ các cửa sổ ngây thơ. giao thông thứ Hai khác với giao thông thứ Bảy trong nhiều sản phẩm. Hãy làm cho các tài liệu tham chiếu bao gồm một chu kỳ đầy đủ, hoặc so sánh mỗi cửa sổ với cùng một thời gian trong một chu kỳ trước đó.

### Chỉ số ổn định dân số

PSI đến từ điểm tín dụng. Giảm các giá trị tham chiếu thành các thùng, thường là mười thùng ở các phân số tham chiếu, để mỗi thùng chứa 10% tham chiếu. Đếm tỷ lệ giá trị hiện tại trong mỗi thùng. Sau đó cộng một thuật ngữ cho mỗi thùng:

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

Một bin với một phần của không làm cho nhật ký vô hạn, vì vậy clip mỗi phần vào một giá trị nhỏ như 0.0001. PSI là đối xứng. Nó bằng với sự khác biệt KL từ dòng sang tham chiếu cộng với sự khác biệt KL từ tham chiếu đến dòng.

Các học viên đọc PSI với băng tần cố định: dưới 0,1 ổn định, 0,1 đến 0.25 là một thay đổi vừa phải, và trên 0.25 là một thay đổi đáng kể. Hãy coi các băng tần này như một quy ước, chứ không phải là một thử nghiệm. PSI tăng lên với số lượng thùng và thu nhỏ với kích thước mẫu. Trong demo, cửa sổ của 500 sự kiện không có điểm trôi giữa 0.01 và 0.04.

### Thống kê Kolmogorov-Smirnov

Các số liệu thống kê KS hai mẫu `D`là khoảng cách dọc lớn nhất giữa hai hàm phân phối tích lũy empirical:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`là 0 cho các mẫu giống nhau và 1 cho các mẫu không chồng chéo. Nó không cần các thùng. Giá trị p đến từ phân bố Kolmogorov với kích thước mẫu thực tế `n * m / (n + m)`- Tôi không biết.

Với các mẫu lớn, giá trị p sẽ giảm xuống 0,0 cho một khoảng cách mà không ai quan tâm.`D`tự như là kích thước hiệu ứng, và chỉ báo động khi cả hai `D`và giá trị p vượt qua ngưỡng của chúng.

### Kiểm tra hình chữ số cho các tính năng phân loại

Đối với một tính năng danh mục, chẳng hạn như kênh thanh toán, tạo ra một bảng với hai hàng (thường tham chiếu, dòng) và một cột cho mỗi loại.

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

Thử nghiệm đã`k - 1`Tỷ lệ tự do cho `k`Category. Một danh mục chỉ xuất hiện trong cửa sổ hiện tại thêm một thuật ngữ lớn, do đó thử nghiệm phản ứng với các giá trị mới. V của Cramér là kích thước hiệu ứng. Đối với một bảng có hai hàng, nó bằng với gốc vuông của `chi2 / grand_total`- Tôi không biết.

### Các ngưỡng cảnh báo và báo động sai

Mỗi thử nghiệm đều có tỷ lệ báo động sai .`alpha`Khi không có gì thay đổi. giám sát chạy nhiều thử nghiệm. với 50 tính năng kiểm tra mỗi giờ tại`alpha = 0.05`Bạn mong đợi khoảng 60 báo động sai mỗi ngày khi không có gì thay đổi.

Bốn quy tắc giữ cho tốc độ cảnh báo hữu ích:

1. **Correct for multiple tests.**Sự điều chỉnh Bonferroni chia `alpha`bằng số lượng các thử nghiệm.`alpha`của 0,01 trên hai thử nghiệm, do đó mỗi thử nghiệm sử dụng 0,005.
2. **Require an effect size.**Chỉ báo động khi PSI,`D`, hoặc Cramér's V cũng vượt qua ngưỡng.
3. **Require persistence.**Chỉ cần cảnh báo sau đó`k`Dòng cửa sổ kéo theo.`k = 2`- Tôi không biết.
4. **Separate warnings from alerts.**Một cảnh báo đi đến bảng điều khiển.

Demos cho thấy quy tắc 2 đang hoạt động. Một cửa sổ sạch có giá trị p-quadrat chi của 0,0009, dưới mỗi thử nghiệm`alpha`V của Cramér dưới 0,1 nên chính sách ghi nhận cảnh báo, không phải cảnh báo.

### Các tác động tái tập

Có ba nguyên nhân gây ra việc tái đào tạo:

- **Schedule.**Trải tập mỗi tuần hoặc mỗi tháng. Điều này đơn giản, nhưng nó sẽ tập lại khi không có gì thay đổi và chờ đợi khi có gì thay đổi.
- **Drift.**Chuẩn bị lại khi sự trôi chảy đầu vào các tính năng quan trọng vẫn vượt quá ngưỡng.
- **Performance.**Trải tập lại khi một số lượng kết quả giảm xuống dưới giá trị tham chiếu trừ dung lượng.

Loại trôi động quyết định những gì tái đào tạo có thể làm:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

Sau khi đào tạo lại, thử nghiệm mô hình mới trên dữ liệu được dán nhãn gần đây nhất. Chuyển nó với các giai đoạn bóng và canary từ bài học thiết kế hệ thống. Sau đó đặt lại cửa sổ tham chiếu cho dữ liệu đào tạo mới.

```figure
mlprod-drift-psi
```

## Hãy xây dựng nó

Mã trong `code/main.py`chỉ sử dụng thư viện tiêu chuẩn.

### Bước 1: Thùng chứa lượng tử và PSI

Các cạnh của thùng là các deciles tham chiếu. `bisect_right`tìm thấy thùng của mỗi giá trị.

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

### Bước 2: Các số liệu thống kê KS và giá trị p của nó

Đi cùng hai mẫu được sắp xếp. Ở mỗi giá trị khác nhau, di chuyển qua mỗi bản sao của nó trong cả hai mẫu, sau đó so sánh hai cổ phần tích lũy. Điều này xử lý liên kết đúng.

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

Giá trị p sử dụng chuỗi cho phân bố Kolmogorov,`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`, với `lambda = sqrt(n * m / (n + m)) * D`- Tôi không biết.

### Bước 3: Kiểm tra chi-quad

`chi2_sf`tính toán hàm sống sót chi-quad thông qua hàm gamma không hoàn chỉnh trên được điều chỉnh. Nó sử dụng một chuỗi cho các lập luận nhỏ và một phần liên tục cho các lập luận lớn. `chi_square_test`xây dựng bảng hai hàng, tính toán số liệu thống kê, và trả lại giá trị p và V của Cramér.

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

### Bước 4: Các cửa sổ và màn hình drift

`SlidingWindow`giữ cho người cuối cùng `size`các sự kiện trong một `deque`- `DriftMonitor`tính toán các thùng tham chiếu và đếm một lần.`check`Phương pháp trả lại PSI, `D`, và giá trị KS p cho mỗi tính năng số, và kết quả chi-quadrat cho mỗi tính năng danh mục.

### Bước 5: Chính sách cảnh báo

Chính sách biến mỗi số liệu được thiết lập thành một mức và đếm các cửa sổ xoay lánh liên tiếp cho mỗi tín hiệu:

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

`update`trả lại `ALERT`trên cửa sổ hoàn thành dải, và `resolved`trên cửa sổ sạch đầu tiên sau khi báo động.

### Bước 6: Một dòng chảy với sự nhét nhét

Dòng chảy có 9000 sự kiện thanh toán với một `amount`, một `channel`, và một kẻ lừa đảo`label`Có bốn phần định nghĩa nó:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

Mô hình là ngưỡng trên `amount`Windows tổ chức 500 sự kiện và di chuyển đến 250.

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

Hãy đọc kết quả trong ba phần:

- **Covariate drift.**Drift bắt đầu tại sự kiện 3000, và `amount`báo động theo dõi ở 3500. độ chính xác vẫn ở giữa 0,89 và 0,95, bởi vì quy tắc nhãn không thay đổi.
- **Recovery.**Các đầu vào trở lại bình thường ở 5000, và cả hai cảnh báo giải quyết ở 5500.
- **Concept drift.**Drift bắt đầu ở 6500, và các màn hình đầu vào giữ im lặng vì đầu vào không thay đổi. Độ chính xác giảm từ 0,946 xuống giữa 0,76 và 0,79.

## Sử dụng nó

**scipy.** `scipy.stats`thực hiện cả hai bài kiểm tra. Các thống kê phù hợp với mã từ đầu. không cần thiết để chạy bài học này.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

Chúng tôi đã kiểm tra`ks_statistic`và `chi_square_test`KS, chi-quadrat và chi-quadrat p-đáng giá phù hợp với độ chính xác điểm nổi. Hơn 200 cặp mẫu ngẫu nhiên, các giá trị p-KS khác với scipy lên đến 18% giá trị scipy.

Sự chênh lệch đến từ phương pháp. mã của chúng tôi sử dụng phân bố Kolmogorov hạn chế.`ks_2samp`sử dụng một phương pháp chính xác khi cả hai mẫu có tối đa 10.000 giá trị.`chi2_contingency`áp dụng sự điều chỉnh liên tục của Yates theo mặc định, vì vậy số liệu thống kê khác nhau ở đó.

**Monitoring libraries.**Một số thư viện mã nguồn mở đóng gói các bài kiểm tra này với các báo cáo và bảng điều khiển:

- **Evidently**chọn một thử nghiệm xoay xô cho mỗi cột. Đối với một tham chiếu với 1000 hàng hoặc ít hơn, nó sử dụng thử nghiệm KS cho cột số và thử nghiệm chi-quad cho cột thể loại. Đối với dữ liệu lớn hơn, nó sử dụng khoảng cách Wasserstein và sự khác biệt Jensen-Shannon với ngưỡng 0.1. PSI là một trong những phương pháp khác mà bạn có thể chọn.
- **NannyML**ước tính hiệu suất của mô hình trước khi các nhãn đến. ước tính hiệu suất dựa trên sự tự tin của nó (CBPE) sử dụng xác suất dự đoán của mô hình, phải được cân bằng tốt. Tài liệu NannyML nói rằng CBPE xử lý chuyển đổi biến đổi nhưng không đối phó với biến động khái niệm. Xu hướng demo cho thấy tại sao: chỉ có nhãn tiết lộ biến động khái niệm.
- **TensorFlow Data Validation**so sánh các khoảng thời gian liên tiếp của dữ liệu. Nó sử dụng khoảng cách vô hạn L cho các tính năng danh mục và sự khác biệt Jensen-Shannon gần gũi cho các tính năng số. Nó cũng so sánh dữ liệu đào tạo với dữ liệu phục vụ, mà bài học lưu trữ tính năng bao gồm.

Mã từ đầu cho thấy mỗi công cụ này tính toán những gì.

Đối với các ứng dụng LLM, các [LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)Trong giai đoạn cơ sở hạ tầng bao gồm các công cụ theo dõi và đánh giá.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-drift-monitoring.md`. Kỹ năng lập kế hoạch cho các màn hình cho một mô hình mới và phân loại một cảnh báo trôi chảy. Nó hỏi mà lớp bắn, loại trôi chảy phù hợp với bằng chứng, và liệu hành động đúng là chờ đợi, tái chuẩn, thu thập nhãn, hoặc tái tập luyện.

## Các bài tập

1. Thử chạy dòng với cửa sổ của 200 và 2000 sự kiện, ghi lại các cảnh báo sai trước sự kiện 3000 và sự chậm trễ cảnh báo.
2. Đặt `n_tests=1`- `patience=1`, và`min_cramers_v=0`- Đếm báo cáo trong thời gian sạch từ 5000 đến 6500.
3. Thêm một tính năng có trung bình tăng 0,01 cho mỗi 100 sự kiện. Tìm ra tín hiệu nào, PSI hoặc KS, phản ứng đầu tiên.
4. Thực hiện khoảng cách Jensen-Shannon trên cùng một thùng phân tử. So sánh nó với PSI trên mỗi cửa sổ.
5. Thêm một màn hình để xác định tốc độ dự đoán tích cực của mô hình.

## Các điều khoản chính

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

## Đọc thêm

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): trôi động thực tế và ảo, mô hình trôi động và phương pháp thích nghi
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): 2 mẫu thử nghiệm để phát hiện chuyển động
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): phương pháp phát hiện, hiểu và thích nghi
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): cách PSI hành xử với kích thước mẫu và số lượng thùng
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): phương pháp p- giá trị chính xác và không hợp lý cho thử nghiệm KS hai mẫu
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): chọn thử nghiệm mặc định theo loại cột và kích thước dữ liệu
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE và các giả định của nó
