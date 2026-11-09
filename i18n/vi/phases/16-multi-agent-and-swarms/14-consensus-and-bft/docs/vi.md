# Sự đồng thuận và sự dung nạp lỗi của Byzantine đối với các đại lý

> Các hệ thống phân tán cổ điển BFT đáp ứng LLM stochastic. Trong năm 2025-2026 ba hướng nghiên cứu đã xuất hiện: **CP-WBFT**(arXiv:2511.10400) cân nhắc mỗi phiếu bằng một cuộc điều tra tin tưởng; **DecentLLMs**(arXiv:2507.14928) đi không có lãnh đạo với các đề xuất công nhân song song và tổng hợp hình học-đối trung; **WBFT**(arXiv:2505.05103) kết hợp bỏ phiếu cân nhắc với Cluster Structure Hierarchical để chia các nút Core và Edge. Kết quả thực tế thực nghiệm từ "Can AI Agents Agree?" (arXiv:2603.01213) là ngay cả thỏa thuận quy mô là mỏng manh ngày nay  một đại lý lừa đảo duy nhất có thể làm tổn hại một hỗn hợp các đại lý. BFT là cần thiết nhưng không đủ. Bài học này xây dựng một giao thức BFT tối thiểu, tiêm ba cuộc tấn công cụ thể của các đại lý (sự dối trá Byzantine, sự phù hợp sycophantic, đồng văn hóa lỗi liên quan), và đo lường cách mỗi biến thể đồng thuận đối phó như thế nào.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Vấn đề

Bạn có các đại lý LLM N mỗi sản xuất một câu trả lời. Họ không đồng ý. Phần lớn bỏ phiếu chọn sai bởi vì hai đại lý có liên quan (những mô hình cơ sở tương tự, dữ liệu đào tạo tương tự, các chế độ thất bại tương tự). Một đại lý thứ ba xảy ra sai một cách mới lạ  do đó đa số là đa số sai.

Bây giờ thêm một tác nhân lừa dối: nó nằm cố ý. hoặc một tác nhân đồng cảm: nó đồng ý với ai nói cuối cùng. Trong BFT cổ điển, giả định là các nút Byzantine là một phần nhỏ.`f < n/3`thực tế là các nút LLM là stochastic ngay cả khi trung thực, tương quan giữa các mô hình, và bị ảnh hưởng bởi kết quả của nhau. Bạn không thể đối xử với họ như cử tri Bernoulli độc lập.

BFT cổ điển (PBFT, 1999) không sai  nó không đầy đủ. Nó xử lý chuyển đổi bit tùy ý. Nó không xử lý "ba đại lý trung thực chia sẻ ảo giác vì họ chia sẻ dữ liệu đào tạo". Bài học này xây dựng từ nền tảng và lớp của PBFT trên ba sự thích nghi 2025-2026.

## Khái niệm

### BFT cổ điển cho bạn

Thực tế Biệt Vị Thể Thoả Thận Phụng (Castro & Liskov, OSDI 1999) `f < n/3`Các nút Byzantine. Các giao thức có ba giai đoạn (sẵn sàng, chuẩn bị, cam kết) và hai nguyên thủy (tin nhắn ký kết, chứng chỉ số số lượng).`n >= 3f + 1`các nút trung thực hay độc hại.

Các bảo đảm là mạnh mẽ nhưng giả định:

1. **Independent faults.**Người Byzantine không phối hợp.
2. **Honest nodes are truly honest.**Sự chính xác của các kết quả trung thực là một vấn đề không có vấn đề; giao thức chỉ phù hợp với sự bất đồng.
3. **The question has a ground-truth answer.**Sự đồng thuận về một sự thật sai lầm vẫn là sự đồng thuận.

Các đại lý LLM vi phạm cả ba. Hai đại lý chạy cùng một mô hình cơ bản chia sẻ sai lầm. Một LLM "sự thật" vẫn ảo giác. Và trên những câu hỏi mơ hồ, "thực" là những gì các đại lý quyết định  không có lời tiên tri bên ngoài.

### Ba vụ tấn công đặc biệt của LLM

**Byzantine lie.**Một đại lý đưa ra một câu trả lời sai lầm cố ý.`f < n/3`- Tôi không biết.

**Sycophantic conformity.**Một đại lý đọc câu trả lời của người khác trước khi bỏ phiếu và phù hợp với người nói cuối cùng. Không có ý hại, nhưng tương quan với giọng nói lớn nhất. BFT cổ điển không ngăn chặn điều này bởi vì đại lý vượt qua mọi kiểm tra chữ ký.

**Correlated-error monoculture.**Ba đại lý chia sẻ một mô hình cơ bản. Họ ảo giác cùng một câu trả lời sai. Phần lớn sai. BFT cổ điển không giúp vì cả ba "thực sự" đồng ý.

### Các câu trả lời 2025-2026

**CP-WBFT**(arXiv:2511.10400)  BFT có trọng lượng được chứng minh bởi sự tin tưởng. Mỗi cử tri gắn một cuộc thăm dò tin tưởng vào câu trả lời của mình (một xác suất tự báo cáo hoặc dự đoán của mô hình hiệu chuẩn riêng).

**DecentLLMs**(arXiv:2507.14928)  Không có lãnh đạo. Các nhân viên lao động đề xuất song song, các nhân viên đánh giá ghi điểm các đề xuất, câu trả lời cuối cùng là trung bình hình học của các vị trí được ghi điểm.`f < n/2`. Giảm thiểu cho: Sự dối trá của Byzantine và các lỗi tương quan (đường trung bình hình học là mạnh mẽ đến các điểm ngoại lệ và kéo về phía cluster dày đặc, không phải là trung bình dựa trên mô hình).

**WBFT**(arXiv:2505.05103)  BFT được cân nhắc với Clustering cấu trúc hàng bậc. Nên phiếu bầu được gán theo chất lượng phản ứng cộng với điểm tin cậy học được từ lịch sử. Các đại lý cluster vào Core và Edge; Các đại lý cốt phải đạt được sự đồng thuận trước, các đại lý Edge tiếp theo. Giảm thiểu cho: khả năng mở rộng (Core consensus là nhỏ và nhanh chóng) và một phần cho monoculture (Core có thể được chọn cho sự đa dạng).

### Phương pháp kinh nghiệm: "Các đại lý AI có thể đồng ý không?" (arXiv:2603.01213)

Các giấy đo lường sự đồng thuận quy mô (những đại lý LLM đồng ý về một giá trị số duy nhất) trên nhiều mô hình biên giới.

- Ngay cả khi không có đối thủ, các đại lý LLM không đồng ý về các câu hỏi quy mô ở mức cao hơn 30% trên nhiều tiêu chuẩn.
- Một đại lý duy nhất áp dụng một nhân vật lừa dối có thể rút ra sự đồng thuận của Mixture of Agents 40+ điểm phần trăm khỏi đường cơ bản trung thực.
- Tỷ lệ bất đồng tương quan với sự đa dạng mô hình  các tập hợp đa dạng không đồng ý nhiều hơn so với các tập hợp đồng nhất (tốt: sai lầm không tương quan) nhưng cũng lôi kéo chậm hơn (xấu: thời gian dài hơn để đạt được thỏa thuận).

Điểm rút ra: BFT cung cấp cho bạn một thiết bị để sắp xếp các kết quả, nhưng nó không cho bạn biết liệu kết quả sắp xếp có đúng hay không.

### Các giao thức cốt lõi, được tháo dỡ

Một vòng BFT tối thiểu cho các đại lý LLM:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

Bước cụm hợp ngữ là sự xoay quanh cụm LLM. Hai câu trả lời "báo cáo nghiên cứu 4,2%" và "bảo tiến 4,2%" là cùng một cụm.

### Định hướng ngưỡng

- `threshold`các thông số cho phép bạn chấp nhận khi nào và khi nào để thử lại. quá thấp: bạn chấp nhận đa số yếu. quá cao: bạn không bao giờ chấp nhận bất cứ điều gì.`n=5-7`đại lý, cao hơn cho nhỏ hơn `n`- Ở dưới ngưỡng, leo thang lên một con người hoặc một nhóm đặc vụ khác.

### Khi sự đồng thuận không giúp ích

- **Ambiguous questions.**Nếu câu hỏi không có sự thật cơ bản thì sự đồng thuận là một ý kiến.
- **Compound questions.**"Thiết mã và giải thích nó"  hai câu trả lời.
- **Adversarial multi-round.**Nếu các đại lý có thể quan sát các vòng trước và bắt chước (debat Du 2023), họ bắt đầu đồng ý với nhau bất kể sự thật.

```figure
swarm-consensus-wave
```

## Hãy xây dựng nó

`code/main.py`thực hiện:

- `AgentVoter` một chính sách được viết kịch bản với (phản hồi, sự tự tin).
- `MajorityVote` đa dạng cổ điển.
- `CPWBFT` Đánh phiếu dựa trên sự tin tưởng với phân nhóm ngữ nghĩa.
- `DecentLLMs` tổng hợp số liệu trung bình hình học về các đề xuất được ghi điểm.
- `Scenario` chạy mỗi bộ tổng hợp theo ba mô hình tấn công.

Các mô hình tấn công được thực hiện:

1. `byzantine`Một nhân viên nói dối với sự tự tin cao.
2. `sycophancy`Một đại lý sao chép câu trả lời đầu tiên mà họ thấy, với sự tự tin tương tự.
3. `monoculture`: ba đại lý chia sẻ một câu trả lời sai (sự sai lầm liên quan) với sự tự tin vừa phải.

Đi chạy:

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả dự kiến: một bảng của (việc tấn công, tổng hợp) -> câu trả lời cuối cùng, với câu trả lời chính xác được nhấn mạnh. Sự đa dạng thất bại trong trường hợp monoculture. Đánh nặng sự tin tưởng của CPWBFT giảm bớt sự đồng hóa. Đường trung gian hình học của DecentLLMs kéo về phía cụm trung thực khi monoculture ít hơn một nửa dân số.

## Sử dụng nó

`outputs/skill-consensus-designer.md`thiết kế một giao thức đồng thuận cho một tập hợp đa tác nhân: phương pháp nhóm, trọng lượng, ngưỡng và chính sách leo thang cho các vòng dưới ngưỡng.

## Chuyển nó

Trước khi vận chuyển bất kỳ cơ chế đồng thuận nào:

- **Attack-test with at least the three patterns**Quy tắc của bạn sẽ thất bại một cách có thể đoán trước, không phải là lặng lẽ.
- **Log every minority cluster**Các nhóm thiểu số là hệ thống cảnh báo sớm cho các lỗi liên quan.
- **Enforce bounded rounds.**Không "đang thảo luận cho đến khi có thỏa thuận"  mà thưởng cho sự đồng tình.
- **Separate agreement from correctness.**Khả năng đồng thuận đi đến một người xác minh; người xác minh độc lập với tập hợp.
- **Monitor the agreement rate.**Một sự gia tăng mạnh có nghĩa là sự thiên vị về sự phù hợp; một sự sụt giảm mạnh có nghĩa là sự trôi dạt của mô hình.

## Các bài tập

1. Đi chạy`code/main.py`- Đảm bảo đa số không đạt được cuộc tấn công của đơn cây nhưng CPWBFT giảm thiểu một phần khi sự tin tưởng của đơn cây dưới 0,7.
2. Thêm một mô hình tấn công thứ tư: **silent abstention** một đại lý từ chối trả lời ("Tôi không biết").
3. Thay đổi nhóm ngữ nghĩa từ canonicalization chuỗi sang tương tự nhúng ( Sử dụng bất kỳ mô hình nhúng nguồn mở nào).
4. Đọc CP-WBFT (arXiv:2511.10400). Thực hiện bước hiệu chuẩn hóa bằng dò tin cậy (một mô hình hiệu chuẩn riêng biệt kiểm tra sự tin tưởng tự báo cáo của mỗi đại lý). Đo mức độ tăng độ chính xác trên kịch bản monoculture.
5. Đọc "Can AI Agents Agree?" (arXiv:2603.01213). Tạo lại một thí nghiệm thỏa thuận quy mô đơn giản: ba đại lý, một câu hỏi quy mô, lời nhắc người lừa dối. CPWBFT hay DecentLLMs có nhận được nó không?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | Castro-Liskov 1999 protocol for consensus with `f < n/3` arbitrary faults. |
| Byzantine | "Any bad behavior" | A node that can lie, drop messages, fail silently — anything but crash safely. |
| Confidence probe | "How sure are you?" | Self-reported or calibrator-predicted probability attached to a vote. |
| Semantic clustering | "Same answer, different words" | Grouping equivalent answers before counting votes. |
| Geometric median | "Robust center" | The point minimizing sum of distances to sample points. Robust to outliers, unlike the mean. |
| Monoculture | "Same model, same failures" | Correlated errors when agents share training data or base model. |
| Sycophantic conformity | "Agreeing with the loud voice" | An agent's vote biases toward whoever spoke first/loudest. |
| Core/Edge | "Hierarchical BFT" | WBFT split: small Core consensus first, Edge nodes follow. Bounds latency. |

## Đọc thêm

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance) cơ sở
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) trọng lượng phiếu bằng sự tin tưởng
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) Phân tích trung bình hình học
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) Chia Core/Edge cho thời gian trễ giới hạn
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) Sự dễ dàng của thỏa thuận quy mô và tấn công cá nhân lừa đảo
