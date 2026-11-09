# Async và Hogwild!

> Việc giải mã giả định (Phase 10 · 15) song song các token trong một chuỗi. Các khung đa đại lý song song trên toàn bộ chuỗi nhưng buộc sự phối hợp rõ ràng (đánh phiếu, phân chia các nhiệm vụ phụ). Hogwild! Inference (Rodionov et al., arXiv:2504.06261) làm một điều khác: chạy N trường hợp của cùng một LLM song song với một cache giá trị khóa SHARED. Mỗi công nhân nhìn thấy các mã thông báo được tạo ra bởi mỗi công nhân khác ngay lập tức. Các mô hình lý luận hiện đại  QwQ, DeepSeek-R1  có thể tự phối hợp thông qua bộ nhớ cache được chia sẻ mà không cần điều chỉnh. Cách tiếp cận là thử nghiệm nhưng nó mở ra một trục hoàn toàn mới của sự song song suy luận nằm ngang với việc giải mã spec. Bài học này thực hiện Hogwild hai người lao động! mô phỏng trong stdlib Python và giải thích tại sao sự hợp tác lưu trữ chung xuất hiện từ khả năng lý luận của mô hình hiện có.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Mục tiêu học tập

- Mô tả ba topology LLM song song phổ biến (nhà bỏ phiếu, nhiệm vụ phụ, Hogwild!) và tên các vấn đề mà mỗi mục tiêu.
- Định nghĩa thiết lập cốt lõi Hogwild!: nhiều nhân viên, một bộ nhớ cache KV chung, phối hợp mới nổi thông qua tự động hóa.
- Xét tốc độ thời gian tường của Hogwild! như một chức năng của nhân viên đếm `N`, sự tương đồng cấp độ nhiệm vụ `p`, và tổng chi phí phối hợp `c`- Tôi không biết.
- Thực hiện mô phỏng Hogwild! hai người làm việc trên một vấn đề đồ chơi và quan sát phân khúc nhiệm vụ mới nổi.

## Vấn đề

Các LLM hiện đại giải quyết các vấn đề khó khăn bằng cách tạo ra chuỗi suy luận dài  5000 token logic từng bước là phổ biến, hàng chục ngàn token xảy ra trên các vấn đề toán học sâu sắc.

Việc giải mã giả định (Phase 10 · 15) giúp bạn tăng tốc độ 3-5x bằng cách song song trong một chuỗi.

Câu hỏi rõ ràng là: chúng ta có thể song song giữa các chuỗi? chạy nhiều bản sao của cùng một mô hình trên cùng một vấn đề, để họ hợp tác, để họ chia làm việc?

Công việc trước đây: tập hợp bỏ phiếu (giải hành các mô hình N, chọn câu trả lời đa số), cây tư tưởng (các con đường suy luận của chi nhánh và tái kết hợp), và các khung đa đại lý (chính định cho mỗi đại lý một nhiệm vụ phụ, sử dụng một điều phối viên). Tất cả đều giúp trong các lĩnh vực nhiệm vụ cụ thể.

Hogwild! Thuyết đoán có một cách tiếp cận khác. N nhân viên chia sẻ một bộ nhớ cache KV duy nhất. Mỗi công nhân nhìn thấy các mã thông báo được tạo ra bởi mỗi công nhân khác ngay lập tức, như thể chúng là bối cảnh của riêng mình. Những người lao động  không có bất kỳ đào tạo hoặc điều chỉnh tinh tế  tìm ra cách chia sẻ công việc. Các mô hình lý luận hiện đại (QwQ, DeepSeek-R1, Claude-family logic mode) có thể đọc bộ nhớ cache chia sẻ và nói những điều như "Tôi thấy người lao động 2 đã xử lý trường hợp cơ bản, vì vậy tôi sẽ làm việc trên bước inductive".

Sự tăng tốc phụ thuộc vào tải trọng công việc và thử nghiệm từ tháng 4 năm 2026. Nhưng ý tưởng này đáng được biết bởi vì nó mở ra một trục mới của sự song song kết suy luận.

## Khái niệm

### Việc thiết lập

Tạo ra các quy trình nhân viên N, tất cả chạy cùng một LLM. Thay vì bộ nhớ cache KV mỗi nhân viên, duy trì ONE chia sẻ bộ nhớ cache. Khi nhân viên `i`tạo ra token `t_j`, token được ghi vào cache chia sẻ ở vị trí tiếp theo.`k`khi bước tiếp theo, nó đọc trạng thái hiện tại của kho lưu trữ (bao gồm tất cả mọi thứ tất cả các công nhân N đã tạo ra cho đến nay).

Tại thời gian bước, công nhân chạy đua để viết token. Không có chỉ số vị trí cho mỗi công nhân  bộ nhớ cache là một chuỗi phát triển duy nhất.

### Tại sao sự phối hợp xuất hiện

Các công nhân chia sẻ một lời nhắc nhở. Thông thường là kiểu như "Bạn là một trong số các trường hợp làm việc cùng nhau về vấn đề này. Mỗi trường hợp đọc bộ nhớ chia sẻ và có thể xem những trường hợp khác đã viết gì. Tránh làm việc dư thừa". Chỉ cần nhắc lại và lưu trữ cache chung là đủ. Các mô hình lý luận đọc bộ nhớ cache, nhận thấy những phần của vấn đề đã được cố gắng, và (thường nhưng không phải lúc nào cũng) chuyển sang các phần chưa được khám phá.

Bài báo Hogwild! (Rodionov et al., 2025) báo cáo các quan sát như:

- Công nhân xây dựng kế hoạch và truyền đạt cho các công nhân khác thông qua bộ nhớ cache.
- Người lao động nhận thấy những sai lầm trong lý luận của người lao động khác và gọi chúng ra.
- Công nhân thích nghi khi một kế hoạch thất bại và đề xuất các thay thế.
- Khi được yêu cầu kiểm tra việc vứt công nhân, công nhân phát hiện ra và quay lại.

Không có điều gì trong những điều này đòi hỏi sự điều chỉnh tinh tế. Hành vi mới nổi xuất phát từ khả năng suy luận mà mô hình đã có.

### Việc đặt tên

Tên của bài báo là Hogwild! SGD (Recht et al., 2011), một trình tối ưu hóa cập nhật không đồng bộ.

### RoPE làm cho điều này dễ dàng

Các vị trí quay (RoPE, Su et al. 2021) mã hóa thông tin vị trí thông qua quay trong các vector Q và K. Bởi vì điểm chú ý giữa một truy vấn xoay và một phím xoay chỉ phụ thuộc vào khoảng cách tương đối của chúng, một khối các mục được lưu trữ trong cache có thể di chuyển đến một sự thay thế mới mà không cần tính toán lại: xoay truy vấn thay vì quay lại mỗi phím được lưu trữ trong cache. Hogwild! Inference thực hiện điều này một lần cho mỗi khối cache: cho truy vấn tại vị trí `i_q`và một khối bắt đầu từ `i_k`theo quan điểm của người lao động đó, câu hỏi được xoay bởi khoảng cách tương đối `i_q - i_k`Đó là cách mà mỗi người làm việc nhìn thấy các khối cache chia sẻ theo thứ tự của riêng mình. Trù này hoạt động cho một chuyển đổi đồng nhất của một khối liền kề.

Trong mô hình vị trí học hoặc vị trí tuyệt đối, Hogwild! sẽ cần phải vô hiệu hóa cache trên mỗi lần viết đồng thời. RoPE cho phép cache duy trì ổn định.

### Phương pháp toán thời gian tường

Để `T_serial`là thời gian cho một công nhân để giải quyết vấn đề một mình.`p`là phần phân tích tương đương ở cấp độ nhiệm vụ.`c`là chi phí tổng hợp phối hợp từng bước (đọc bộ nhớ cache mở rộng, quyết định phải viết gì).

Thời gian làm việc độc lập: `T_serial`- Tôi không biết.
N-công nhân Hogwild! thời gian, nếu sự phối hợp là miễn phí: `T_serial * ((1 - p) + p / N)`- Amdahl cổ điển.
Với chi phí phối hợp chung: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`- Tôi không biết.

Để một công nhân có năng suất,`c`Trong các mô hình lý luận sản xuất 5k + token, công nhân có thể đủ khả năng để có hàng trăm token phối hợp trên đầu và vẫn đi trước.

### Ví dụ cụ thể

Vấn đề lý luận: 10k token chuỗi suy nghĩ. giả sử vấn đề có`p = 0.7`Nội dung tương đồng (các chiến lược chứng minh khác nhau, phân tích trường hợp khác nhau) và`c = 200`Các chỉ số tổng chi phí phối hợp cho mỗi công nhân.`N = 4`Công nhân:

- Thời gian hàng loạt: 10000 bước giải mã.
- Hogwild! thời gian: 10000 * (0.3 + 0.7 / 4) + 200 * 4 = 10000 * 0.475 + 800 = 5550 bước giải mã.
- Tốc độ tăng: 10000 / 5550 = 1,8x.

Nhưng với các vấn đề suy luận dài hơn (50k token), chi phí phối hợp giảm và tăng tốc tăng lên 2,5-3x. Hogwild! là tương đương suy luận của sự song song cấp bằng sợi trong một ngôn ngữ cho phép bạn viết mã đa sợi tự nhiên.

### Khi nào để tiếp cận Hogwild!

- Các vấn đề lý luận dài (chỉ ngàn token) nơi mà nhiệm vụ có thể được song song trên các mục tiêu phụ độc lập.
- Những mô hình lý luận được đào tạo để suy nghĩ từng bước. Những mô hình không lý luận không phối hợp tốt.
- Các triển khai node duy nhất với đủ VRAM để giữ bộ nhớ cache được chia sẻ cộng với các quy trình nhân viên N. Bộ nhớ cache được chia sẻ, nhưng mỗi nhân viên có bộ nhớ kích hoạt riêng của mình.

### Khi nào không nên

- Hỗ trợ giao tiếp ngắn, phối hợp trên cao.
- Các nhiệm vụ không song song (chứng minh tuyến tính đơn, biên soạn đơn). N=1 là tối đa.
- Những mô hình không hợp lý, không có sự phối hợp.
- Các ứng dụng đa node. bộ nhớ cache được chia sẻ cần đồng bộ hóa nhân viên nhanh chóng. Intra-node là tốt; cross-node là một thảm họa độ trễ.

### Tình trạng thử nghiệm

Tính đến tháng 4 năm 2026, Hogwild! là một phương pháp nghiên cứu với một ứng dụng PyTorch mã nguồn mở.

1. Quản lý bộ nhớ cache KV chung trên các quy trình đồng thời là kỹ thuật không tầm thường.
2. Sự phối hợp mới bắt đầu phụ thuộc vào nhiệm vụ; các tiêu chuẩn vẫn đang được xây dựng.
3. Các tốc độ tăng tốc là khiêm tốn so với những gì giải mã giả định đã cung cấp, và hai có thể được kết hợp nhưng kỹ thuật kết hợp là một lớp khác.

Đáng biết, đáng thử nghiệm, nhưng chưa đáng đặt cược vào sản phẩm.

```figure
continuous-batching
```

## Hãy xây dựng nó

`code/main.py`thực hiện một mô phỏng Hogwild!

- Hai quy trình công nhân, mỗi quy trình là "LLM" xác định tạo ra một trong nhiều danh mục mã thông báo (work-token, observe-token, coordinate-token) với xác suất được biết đến.
- Một bộ nhớ cache được chia sẻ (chỉ là một danh sách các token) mà cả hai nhân viên đều đọc và viết.
- Một logic phối hợp đơn giản: khi một công nhân thấy rằng người khác đã sản xuất đủ các mã công việc trong một danh mục, nó chọn một danh mục khác.

Máy mô phỏng chạy với một ngân sách từng bước cố định và báo cáo:

- Tổng số công cụ công việc được sản xuất.
- Tổng thời gian tường (nhiều bước của công nhân).
- Tốc độ hiệu quả hơn một công nhân.
- Một dấu vết của công nhân nào đã viết ra dấu hiệu nào.

### Bước 1: bộ nhớ cache chia sẻ

Một danh sách mà cả hai công nhân thêm vào.`threading.Lock`) trong một thực hiện thực tế; chúng tôi mô phỏng bằng một bộ đếm.

### Bước 2: vòng lặp người lao động

Mỗi công nhân, trên mỗi bước:

- Đọc cache hiện tại được chia sẻ.
- Quyết định loại mã thông báo nào để viết dựa trên những gì đã có.
- Tác một mã thông báo.

### Bước 3: tính toán phối hợp

Nếu hạng X đã có các mã thông báo K trong bộ nhớ cache và hạng mục dự định của người lao động là X, người lao động chuyển sang hạng Y. Đây là một đồ chơi thay thế cho hành vi mô hình lý luận của "xem đây đã được bao phủ, hãy làm điều gì đó thay thế".

### Bước 4: tăng tốc được đo

Tiếp tục chạy mô phỏng với nhân viên N=1 và với nhân viên N=2, cùng ngân sách bước tổng cộng.

### Bước 5: nhấn mạnh sự phối hợp

Giảm độ nhạy cảm của bộ nhớ phối hợp. Lại chạy. Quan sát rằng nếu không có sự phối hợp tốt, N=2 sẽ tạo ra các mã thông báo tương tự và tốc độ giảm xuống dưới 1. Điều này phù hợp với quan sát của tờ báo: thủ thuật chỉ hoạt động nếu công nhân có khả năng suy luận để tự phối hợp.

## Sử dụng nó

Hoạt động đầu tư của Yandex/HSE/IST dựa trên PyTorch và nhắm vào việc thiết lập nhiều quy trình đơn nút trên các mô hình DeepSeek-R1 và QwQ.

Đường lối chấp nhận thực tế:

1. Xác định khối lượng công việc lý luận của bạn. đo phần nhỏ các token là khám phá (những chiến lược, phân tích trường hợp, tìm kiếm) vs tuyến tính.
2. Nếu khám phá chiếm ưu thế, hãy tiến hành thí nghiệm Hogwild! với hai người làm việc.
3. Nếu sự cải thiện dưới 1,3x, bạn đang trong chế độ phối hợp chủ yếu.
4. Nếu sự cải thiện là hơn 1,5x, đẩy đến N = 4 và đo lại.

Kết hợp với giải mã giả định: mỗi nhân viên Hogwild! có thể sử dụng giải mã đặc tính độc lập. Hai tốc độ tăng gấp đôi (khoảng), mang lại một giải mã đặc tính 3x và Hogwild! 1,8x lên hiệu quả 5,4x so với giải mã đơn công nhân ngây thơ.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-parallel-inference-router.md`. Với một hồ sơ tải trọng công việc lý luận (khuế hoạch mã thông báo, hồ sơ song song nhiệm, nhóm mô hình, mục tiêu triển khai), nó đi giữa các chiến lược bỏ phiếu, cây tư tưởng, đa đại lý, Hogwild! và giải mã giả định.

## Các bài tập

1. Đi chạy`code/main.py`xác nhận cấu hình Hogwild! N=2 tạo ra nhiều mã công việc hơn so với dòng cơ sở N=1 trong cùng thời gian tường.

2. Giảm sức mạnh của bộ phận phối hợp (set `coordination_weight=0.1`(Đại hành, cho thấy tốc độ tăng tốc bị sụp đổ, giải thích tại sao: người lao động làm việc gấp đôi khi họ không thể phối hợp.

3. Xét tính tốc độ Hogwild! dự kiến cho một nhiệm vụ lý luận 50k-token với `p=0.8, c=500`Làm tương tự cho một nhiệm vụ trò chuyện 1k-token với `p=0.3, c=200`Và N=4. Tại sao một là một chiến thắng và một là một thất bại?

4. Đọc phần 4 (phân tích sơ bộ) của bài báo Hogwild! xác định hai chế độ thất bại mà các tác giả báo cáo.

5. Kết hợp Hogwild! với mã hóa dự đoán trong đồ chơi: mỗi công nhân sử dụng mã hóa kỹ thuật 2 token bên trong. báo cáo tăng tốc nhân. Vấn đề kế toán nào xảy ra khi hai công nhân đều muốn mở rộng tiền đề cache chung?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hogwild! | "Parallel workers, shared cache" | N instances of the same LLM running concurrently with one shared KV cache; emergent coordination via self-prompting |
| Shared KV cache | "The coordination medium" | A single growing KV buffer that all workers read and write; enables instant token visibility across workers |
| Emergent coordination | "No training needed" | Reasoning-capable LLMs can read the shared cache and divide work without any fine-tuning or explicit protocol |
| Coordination overhead (c) | "Tokens spent orienting" | The per-worker cost of reading the extended cache and deciding what to do; must stay small vs total decode time |
| Parallelizable fraction (p) | "What can run in parallel" | Task-level parallelism: the fraction of the total work that is not intrinsically sequential |
| RoPE enables Hogwild! | "Rotary positions are shift-invariant" | Because positions are rotations, writing into a shared cache does not require recomputing prior tokens |
| Voting ensemble | "Run N, pick the majority" | The simplest parallel inference topology; useful for classification, less for long-form reasoning |
| Tree of thought | "Branch and prune" | Reasoning strategy that explores multiple branches and prunes; explicit coordination logic |
| Multi-agent framework | "Assign sub-tasks" | Each agent gets a role; a coordinator orchestrates; heavy protocol overhead |

## Đọc thêm

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) bài báo Hogwild!, đánh giá sơ bộ về QwQ và DeepSeek-R1
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) Hogwild gốc!
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) RoPE, thuộc tính làm cho suy luận cache chia sẻ có thể xử lý
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601) chiến lược lý luận cây tư tưởng Hogwild! nằm thẳng thắn với
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) giải mã giả thuyết, sự tương đồng trong chuỗi Hogwild!
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm) nguồn duy nhất của sự thật cho các thí nghiệm của báo
