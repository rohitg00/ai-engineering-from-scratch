# AlphaEvolve  Các đại lý lập trình tiến hóa

> Kết hợp một mô hình mã hóa biên giới với một vòng lặp tiến hóa và một nhà đánh giá có thể kiểm tra máy. Hãy để vòng lặp chạy đủ lâu. Nó phát hiện ra một quy trình nhân đếm 4x4 phức tạp sử dụng 48 nhân đếm scalar, cải tiến đầu tiên so với Strassen trong 56 năm. Nó cũng tìm thấy một hệ thống lập lịch Borg toàn bộ Google phục hồi ~ 0,7% tính toán cluster trong sản xuất. Kiến trúc này thật buồn chán. Những chiến thắng đến từ sự nghiêm ngặt của người đánh giá.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## Vấn đề

Các mô hình ngôn ngữ lớn có thể viết mã. Các thuật toán tiến hóa có thể tìm kiếm mã. Cả hai đều được thử nghiệm riêng biệt trong nhiều thập kỷ; cả hai đều đạt đến giới hạn. Mức độ tối thượng LLM là sự giả vờ: mô hình viết mã có thể tin được mà không làm những gì nó tuyên bố. Mức độ tối thượng tiến hóa là chi phí tìm kiếm: đột biến ngẫu nhiên trên tổng hợp hiếm khi tạo ra các chương trình có thể biên soạn, chưa kể những chương trình tốt hơn.

AlphaEvolve (Novikov et al., DeepMind, arXiv:2506.13131, tháng 6 năm 2025) kết hợp chúng. LLM đề xuất chỉnh sửa nhắm mục tiêu vào cơ sở dữ liệu chương trình; một nhà đánh giá tự động ghi điểm cho mỗi biến thể; các biến thể có điểm số cao trở thành cha mẹ cho các thế hệ tương lai. LLM xử lý bước đắt tiền của việc viết mã có thể tin cậy; nhà đánh giá bắt được những câu chuyện.

Kết quả được báo cáo: 48-scalar-multiplication 4x4 complex matrix multiplication (sự giới hạn năm 1969 của Straßsen là 49), một bản lập trình Borg trong sản xuất Google, tăng tốc lõi FlashAttention 32,5%, cải thiện thông qua đào tạo Gemini.

Kiến trúc hoạt động bởi vì người đánh giá có thể kiểm tra bằng máy. Nó không hoạt động ở nơi người đánh giá không có. Sự bất đối xứng là bài học.

## Khái niệm

### Chuyện này

1. Bắt đầu từ chương trình hạt giống `P_0`Điều đó đúng nhưng không tốt.
2. Giữ cơ sở dữ liệu các chương trình biến thể, mỗi chương trình được đánh giá bởi người đánh giá.
3. Mô hình một hoặc nhiều bậc cha mẹ từ cơ sở dữ liệu (MAP-elites-style hoặc đảo-based).
4. Hãy yêu cầu LLM (Tình nhị phân Flash cho nhiều ứng viên, Tử nhị phân Pro cho những người khó khăn) để tạo ra một biến thể sửa đổi của người cha.
5. Thu thập, chạy và đánh giá biến thể trên trình đánh giá đã qua.
6. Đưa vào cơ sở dữ liệu được khóa bằng điểm số và vector tính năng của nó.
7. Lặp lại.

Hai chi tiết quan trọng. Thứ nhất, LLM được yêu cầu với nhiều hơn chương trình mẹ  thường là một số biến thể hàng đầu từ cơ sở dữ liệu, cộng với chữ ký đánh giá, cộng với mô tả nhiệm vụ ngắn. Công việc của mô hình là đề xuất một thay đổi nhắm mục tiêu có thể cải thiện điểm số. Thứ hai, cơ sở dữ liệu được cấu trúc (mảng lưới MAP-elites, dựa trên đảo) vì vậy vòng lặp khám phá sự đa dạng, không chỉ là nhà lãnh đạo hiện tại.

### Điều gì làm cho người đánh giá không thể đàm phán

Những chiến thắng của AlphaEvolve đều đến từ các lĩnh vực mà người đánh giá nhanh, quyết định và khó chơi:

- **Matrix multiplication algorithm**: một thử nghiệm đơn vị nhân số các số tử và kiểm tra sự bình đẳng bằng bit-tương tự.
- **Borg scheduling heuristic**: một máy mô phỏng cấp sản xuất để tái tạo tải trọng cluster lịch sử và đo lường tính toán lãng phí.
- **FlashAttention kernel**: một thử nghiệm độ chính xác cộng với một điểm chuẩn của đồng hồ tường trên phần cứng thực.
- **Gemini training throughput**: được đo GPU-thì giây mỗi bước.

Trong mỗi trường hợp, người đánh giá bắt được lớp lỗi LLM mà nếu không sẽ thống trị: tuyên bố chính xác đã được kết hợp, tuyên bố hiệu suất biến mất trên phần cứng và lỗi biên trường hợp.

### Việc hack phần thưởng là mặt khác của tuyên bố đó

Sự tiến hóa tối ưu hóa cho bất cứ điều gì mà người đánh giá đo lường. Nếu người đánh giá không hoàn hảo, vòng lặp sẽ tìm thấy sự không hoàn hảo. Trong một miền không được xác minh, vòng lặp sẽ tối ưu hóa cho tính năng bề mặt, chứ không phải hành vi dự định. DeepMind đánh dấu rõ ràng điều này trong bài báo: Thành công của AlphaEvolve chỉ chuyển sang các miền mà sự nghiêm ngặt của người đánh giá phù hợp với tham vọng của tìm kiếm.

Ví dụ cụ thể về việc hack phần thưởng trong vòng tìm kiếm mã:

- Mục tiêu tối ưu hóa mà thưởng "giờ để hoàn thành" được thưởng bằng cách gửi giải pháp trống rỗng.
- Điểm chuẩn đánh giá thưởng cho sự chính xác dưới bài kiểm tra thưởng cho bài kiểm tra ghi nhớ và quá phù hợp.
- Một đại diện "tính chất lượng mã" đã thưởng bằng cách loại bỏ bình luận và viết lại tên biến, mà không có sự thay đổi ngữ nghĩa.

Sự cố trong AlphaEvolve: gửi một nhà đánh giá đã được tổ chức LLM chưa từng thấy, với các đầu vào được tạo ra tại thời điểm đánh giá.

### Tại sao tìm kiếm LLM + đánh bại hoặc một mình

LLM có thể tạo ra các thay đổi có thể biên dịch, có thể xác thực về ngữ nghĩa. GA đột biến ngẫu nhiên trên một tệp Python 2000 dòng gần như luôn tạo ra lỗi tổng hợp. LLM cũng tập trung tìm kiếm vào các khu phố có thể xác thực (hóa một hàm, không phải là các byte ngẫu nhiên) làm giảm đáng kể các cuộc gọi đánh giá lãng phí.

Người đánh giá, lần lượt, nhận được những sự kết luận của LLM. LLM sẽ tự tin tuyên bố rằng một chức năng "đó là$O(n \log n)$trong giới hạn" khi nó thực sự là $O(n^2)$; một điểm chuẩn của đồng hồ tường giải quyết câu hỏi.

### AlphaEvolve phù hợp với hàng rào biên giới

| System | Generator | Evaluator | Domain | Example win |
|---|---|---|---|---|
| AlphaEvolve | Gemini | correctness + benchmark | algorithms, kernels, schedulers | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | correctness | combinatorial math | cap-set lower bounds |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM critique + experiment | ML research | ICLR workshop paper |
| Darwin Godel Machine (L4) | agent scaffolding | SWE-bench / Polyglot | agent code | 20% → 50% SWE-bench |

Tất cả bốn là sự thay đổi trên cùng một công thức: máy phát điện cộng với đánh giá, vòng lặp.

```figure
alphaevolve-loop
```

## Sử dụng nó

`code/main.py`thực hiện một vòng lặp giống như AlphaEvolve tối thiểu trên một vấn đề hồi quy biểu tượng đồ chơi. "LLM" là một proxy stdlib đề xuất đột biến tổng hợp nhỏ cho một chương trình tính toán một chức năng mục tiêu.

Xem:

- Làm thế nào điểm số tốt nhất cải thiện qua các thế hệ.
- Làm thế nào một lưới MAP Elite giữ cho các giải pháp đa dạng sống lại để vòng lặp không hội tụ vào mức tối thiểu địa phương.
- Làm thế nào để loại bỏ thử nghiệm đã bị kéo dài (chỉ đánh giá đào tạo) cho phép vòng lặp quá phù hợp một cách ấn tượng.

## Chuyển nó

`outputs/skill-evaluator-rigor-audit.md`là điều kiện tiên quyết để xem xét một vòng lặp kiểu AlphaEvolve trong một lĩnh vực mới: liệu nhà đánh giá của bạn thực sự nhận thấy những thất bại mà bạn quan tâm?

## Các bài tập

1. Đi chạy`code/main.py`. ghi lại quỹ đạo điểm tốt nhất.`--no-holdout`(v) và chạy lại.

2. Đọc Phần 3 của bài báo AlphaEvolve về lưới MAP-elite. Thiết kế mô tả vector tính năng cho một vấn đề mới (ví dụ: thông qua tối ưu hóa trình biên dịch) sẽ giữ cho tìm kiếm đa dạng.

3. Kết quả 48 nhân 4x4 đã cải thiện trên đường 49-mul của Strassen sau 56 năm. Đọc phụ lục F của bài báo và giải thích trong ba câu tại sao đánh giá cho vấn đề này đặc biệt dễ dàng để làm đúng, và tại sao hầu hết các lĩnh vực không giống như nó.

4. Hãy đề xuất một lĩnh vực mà AlphaEvolve sẽ thất bại, xác định chính xác nơi mà người đánh giá phá vỡ và tại sao.

5. Đối với một tên miền mà bạn biết, hãy viết chữ ký đánh giá mà bạn sẽ sử dụng. Bao gồm (a) điều kiện chính xác, (b) chỉ số hiệu suất, (c) quy tắc tạo đầu vào đã được giữ, (d) ít nhất một kiểm tra chống vi phạm phần thưởng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| AlphaEvolve | "DeepMind's evolutionary coding agent" | Gemini + program database + machine-checkable evaluator |
| MAP-elites | "Diversity-preserving archive" | Grid keyed by feature vectors; each cell holds the best variant with that descriptor |
| Island model | "Parallel evolution subpopulations" | Independent populations that migrate periodically; prevents premature convergence |
| Machine-checkable evaluator | "Deterministic oracle" | A unit test, simulator, or benchmark the LLM cannot fake — a prerequisite for this loop |
| Reward hacking | "Optimizing the measure, not the goal" | Loop finds a way to maximize score without doing the intended task |
| Seed program | "The starting point" | An initial correct-but-suboptimal program the loop evolves from |
| Held-out evaluator | "Evaluation data the LLM never saw" | Inputs generated at evaluation time to prevent memorization |

## Đọc thêm

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131) toàn bộ tờ báo.
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) nhà cung cấp ghi lại kết quả.
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results) phát hiện ra các thuật toán, bao gồm 48-mul 4x4 matmul.
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) hệ thống tiền nhiệm.
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) định hình tự trị liên quan đến các nhà đánh giá như là một hướng nghiên cứu chính.
