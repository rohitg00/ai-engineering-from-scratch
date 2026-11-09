# Native Sparse Attention (Dân sâu tìm NSA)

> Với 64k token, sự chú ý tiêu thụ 70-80% thời gian trễ giải mã. Mỗi phòng thí nghiệm mở có kế hoạch sửa chữa nó. NSA của DeepSeek (ACL 2025 bài báo tốt nhất) là một trong những gì bị mắc kẹt: ba chi nhánh chú ý song song  token hạt thô bị nén, token hạt mỏng được giữ lại một cách chọn lọc, và cửa sổ trượt cho bối cảnh địa phương  kết hợp thông qua một cổng học. Nó được sắp xếp theo phần cứng (tương tự với lõi), có thể đào tạo bản địa (công việc trong đào tạo trước, không được khóa vào khi suy luận), và trên 64k decodes nó chạy nhanh hơn FlashAttention trong khi phù hợp hoặc đánh bại chất lượng chú ý đầy đủ. Bài học này xây dựng ba nhánh đầu đến cuối và cho thấy tại sao sự ít có thể phân biệt được đầu đến cuối.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 12 (KV cache, flash-attention), Phase 7 · 15 (attention variants), Phase 10 · 16 (differential attention)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nói cho tôi biết ba cơ quan quan sát của NSA và mỗi cơ quan này bắt được gì.
- Giải thích tại sao NSA là "đáng tạo có thể đào tạo" trong khi các phương pháp chú ý hiếm hoi trước đó chỉ là suy luận.
- Xét tính tiết kiệm tính toán chú ý của NSA so với sự chú ý đầy đủ tại ngữ cảnh 64k như một chức năng của kích thước khối nén và chọn top-k.
- Thực hiện kết hợp ba chi nhánh trong stdlib Python trên một chuỗi tổng hợp ngắn và xác minh hành vi của các trọng lượng gating.

## Vấn đề

Sự chú ý đầy đủ tại chiều dài chuỗi N chi phí `O(N^2)`thời gian và`O(N)`KV cache mỗi lớp. Tại 64k token, số lượng băng thông tính toán và bộ nhớ là thảm khốc. ước tính lý thuyết được đo từ giấy NSA: sự chú ý chiếm 70-80% tổng thời gian trễ giải mã tại 64k. Mọi thứ theo dòng  TTFT, token / giây, chi phí mỗi triệu token  được chi phí chú ý thống trị.

Sự chú ý ít là câu trả lời rõ ràng. Những nỗ lực trước đây đã bị chia thành hai cái rỗng. Sự thâm hụt của mô hình cố định (trung cửa sổ trượt, bước, khối địa phương) làm rơi thông tin và thất bại trong các nhiệm vụ nhớ tầm xa. Sự thâm hụt thời gian suy luận (KV cache pruning, H2O, StreamingLLM) được áp dụng cho một mô hình được đào tạo trước khi tập trung vào sự chú ý dày đặc và chỉ phục hồi một phần nhỏ của tốc độ tăng tốc tiềm năng vì mô hình chưa bao giờ được yêu cầu định tuyến thông tin thông qua mô hình thâm hụt.

Native Sparse Attention (Yuan et al., DeepSeek + PKU + UW, ACL 2025 best paper, arXiv:2502.11089) làm cả hai: một mô hình sự thâm hụt mà mô hình học được trong quá trình đào tạo trước, được thực hiện như một thuật toán liên kết với lõi thực sự cung cấp tiết kiệm tính toán khi suy luận. Hai năm nữa, NSA hoặc một hậu duệ trực tiếp là sự chú ý mặc định trên mọi mô hình ngữ cảnh dài biên giới.

## Khái niệm

### Ba nhánh song song

Đối với mỗi truy vấn, NSA chạy sự chú ý ba lần, đối với ba lượt xem khác nhau của bộ nhớ cache KV:

1. **Compressed branch.**Các token được nhóm thành khối kích thước `l`(thường là 32 hoặc 64). Mỗi khối được nén thành một token tóm tắt duy nhất thông qua một MLP học được nhỏ.

2. **Selected branch.**Sử dụng điểm chú ý từ chi nhánh nén, các khối top-k phù hợp nhất với truy vấn hiện tại được xác định. Các token hạt mỏng (không nén) từ các khối đó được đọc và truy vấn được xem trên tất cả chúng. Hãy nghĩ về sự chú ý của chi nhánh nén như là tín hiệu định tuyến cho sự lựa chọn.

3. **Sliding-window branch.**Câu hỏi này được trả lời cho các câu hỏi gần đây nhất `W`Các mã thông báo (thường là 512) cho bối cảnh địa phương. Chi nhánh này nắm bắt các mô hình tầm ngắn nặng cấu trúc (tế ngôn, coreference địa phương) mà hai người khác có thể bỏ lỡ.

Ba đầu ra của nhánh được kết hợp qua một cổng học được học theo vị trí:

```math
\text{out} = g_{\text{cmp}} \cdot \text{out}_{\text{cmp}} + g_{\text{sel}} \cdot \text{out}_{\text{sel}} + g_{\text{win}} \cdot \text{out}_{\text{win}}
```

`g_cmp, g_sel, g_win`là trọng lượng cổng từ một MLP nhỏ trên truy vấn. Họ không phải cộng vào 1  họ có thể cân nặng các nhánh độc lập.

### Tại sao điều này là "đáng tạo"

Bước lựa chọn (những khối top-k) là riêng biệt. Các hoạt động riêng biệt phá vỡ dòng chảy gradient. Công việc chú ý ít trước đó hoặc bỏ qua backprop thông qua lựa chọn (các khóa học) hoặc sử dụng thư giãn liên tục mà không cung cấp sự ít thực tế khi suy luận.

NSA bỏ qua điều này: sự chú ý của các nhánh nén là một sự chú ý thô lỗ phân biệt trên toàn bộ chuỗi. Hoạt động top-k chỉ sử dụng lại điểm chú ý cao nhất từ nhánh nén để chọn những khối hạt mỏng để tải. Các gradient đạt đến điểm số của nhánh nén thông qua sản lượng của nhánh nén, chứ không phải thông qua sự lựa chọn các khối. Bên trong các khối được chọn, sự chú ý đến các khóa và giá trị được chọn là sự chú ý bình thường, vì vậy đóng góp của chúng vào kết quả cuối cùng cũng có thể phân biệt được. - `top_k`tự chọn chỉ số không có gradient: nó chỉ kiểm soát các khối được tải từ bộ nhớ.

Đây là lý do tại sao NSA có thể được sử dụng trong việc huấn luyện trước cuối đến cuối. mô hình học cách định tuyến thông tin qua ba chi nhánh chung, tạo ra một mô hình hiếm có mà khi suy luận thực sự cung cấp tốc độ hứa hẹn.

### Bộ hạt nhân được sắp xếp với phần cứng

Lớp lõi của NSA được thiết kế cho các hệ thống phân cấp bộ nhớ GPU hiện đại. Lớp lõi tải các truy vấn bởi các nhóm GQA (cuối bên ngoài), lấy các khối KV hiếm tương ứng trên mỗi nhóm (cuối bên trong), và chạy sự chú ý trên SRAM. Bởi vì mỗi nhóm truy vấn nhìn thấy các khối được chọn giống nhau (chuyển chọn là mỗi nhóm truy vấn, không phải mỗi đầu truy vấn), các khối KV được giảm giá trên toàn nhóm. Độ cường số toán vẫn cao.

Báo cáo báo cáo hạt nhân Triton chạy nhanh hơn 9 lần so với FlashAttention trên 64k decode, với tỷ lệ tăng tốc tăng theo chiều dài chuỗi.

### Ngân sách tính toán

Để `N`có chiều dài chuỗi, `l`kích thước khối nén, `k`số lựa chọn trên cùng k, `w`cửa sổ trượt, `b`kích thước khối được chọn (thường bằng `l`().

- Chiếc nhánh bị nén: `O(N/l)`khóa cho mỗi truy vấn, vì vậy `O(N * N / l)`Toàn bộ.
- Nh chọn nhánh: `O(k * b)`khóa cho mỗi truy vấn, vì vậy `O(N * k * b)`- Tôi không biết.
- Chiếc nhánh trượt: `O(w)`khóa cho mỗi truy vấn, vì vậy `O(N * w)`- Tôi không biết.

Tổng số: `O(N * (N/l + k*b + w))`- Tôi không biết.

Với `N = 64k, l = 64, k = 16, b = 64, w = 512`: chi phí cho mỗi yêu cầu là `1000 + 1024 + 512 = 2536 keys`- Cảm ơn anh rất nhiều.`64000 keys`. 25 lần giảm tính toán.

Với `N = 128k, l = 64, k = 16, b = 64, w = 512`: chi phí cho mỗi yêu cầu là `2000 + 1024 + 512 = 3536 keys`- Cảm ơn anh rất nhiều.`128000 keys`Tỷ lệ giảm 36x. Lợi ích tăng lên theo chiều dài chuỗi, đó là toàn bộ điểm.

### Nó so sánh như thế nào?

| Method | Differentiable | Real inference speedup | Long-range recall |
|--------|---------------|----------------------|-------------------|
| Sliding window only | yes | yes | fails |
| Strided / block-sparse | yes | yes | partial |
| KV pruning (H2O, StreamingLLM) | N/A (inference-time) | yes | partial |
| MoBA (Moonshot) | partial | yes | good |
| NSA | yes (natively) | yes (9x at 64k) | matches full attention |

MoBA (Moonshot, arXiv:2502.13189) được xuất bản đồng thời và áp dụng một cách tiếp cận tương tự như ba là tốt hơn một, áp dụng nguyên tắc MoE cho các khối chú ý. NSA và MoBA là hai kiến trúc để biết cho 2026 dài ngữ cảnh đào tạo trước.

```figure
sliding-window-attention
```

## Hãy xây dựng nó

`code/main.py`thực hiện ba chi nhánh trên một chuỗi tổng hợp ngắn và cho thấy:

- MLP nén (một đường cơ sở trung bình đơn giản được sử dụng để làm rõ về giáo dục; NSA thực sự sử dụng MLP được học).
- Việc lựa chọn khối top-k được thúc đẩy bởi điểm số của các nhánh nén.
- Sự chú ý của cửa sổ trượt trên cuối cùng `w`- Đồ chơi.
- Sự kết hợp bị khóa.
- Một bản in tính toán so sánh với sự chú ý đầy đủ.

### Bước 1: nén token thành khối

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### Bước 2: Kiểm tra các nhánh bị nén

Tiếp tục softenmax sự chú ý của truy vấn đối với các phím nén. điểm nén-cánh nén gấp đôi như tín hiệu cho lựa chọn top-k.

### Bước 3: Chọn khối top-k

Chọn các chỉ số của `k`Các khối nén có điểm số cao nhất, tải các token không nén gốc từ các khối đó và chú ý đến chúng.

### Bước 4: Kiểm tra cửa sổ trượt

Hãy lấy cái cuối cùng`w`Đèn chỉ và chạy sự chú ý tiêu chuẩn đối với chúng.

### Bước 5: cổng + kết hợp

Một MLP nhỏ trên truy vấn tạo ra ba trọng lượng cổng.

### Bước 6: tính toán

Bác in số lượng phím được tham gia cho mỗi truy vấn cho mỗi chi nhánh và tổng số. So sánh với `N`(có thể chú ý) trên một token tổng hợp 1024 với`l = 32, k = 4, w = 128`NSA thấy`32 + 128 + 128 = 288`các khóa mỗi truy vấn so với 1024 để chú ý đầy đủ  3,5 lần ít hơn.

## Sử dụng nó

NSA đang vận chuyển trong đường ống dẫn đào tạo dài của DeepSeek.

- **DeepSeek internal**: bản địa, các trọng lượng được công bố sử dụng NSA hoặc kế nhiệm của nó DSA (Deepseek Sparse Attention).
- **vLLM**: hỗ trợ thử nghiệm của NSA trong quá trình phát triển cho trọng lượng DeepSeek-V3.x.
- **SGLang**: Các chỉ số chuẩn của NSA được công bố; con đường sản xuất theo vLLM.
- **llama.cpp / CPU**: không được hỗ trợ; Overhead của phân hủy hạt nhân không đáng giá tại CPU thông qua.

Khi nào để liên lạc với NSA:

- Các khóa đào tạo trước hoặc tiếp tục đào tạo nhắm mục tiêu vào hơn 64k bối cảnh với ngân sách tính toán nghiêm trọng.
- Đánh giá từ các điểm kiểm tra trong bối cảnh dài của DeepSeek.

Khi nào không nên:

- Bạn không thể nâng cấp NSA mà không cần đào tạo.
- Mức độ dưới 16k.
- Chat tương tác Batch-1 có lợi ích giải mã nhạy cảm với độ trễ, nhưng chỉ trong các bối cảnh dài.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-nsa-integrator.md`. Với một kỹ thuật chạy trước khi đào tạo trong bối cảnh dài, nó tạo ra một kế hoạch tích hợp NSA: kích thước khối nén, top-k, cửa sổ trượt, chiều rộng gate MLP, lựa chọn lõi và các đánh giá cụ thể trong bối cảnh dài sẽ biện minh cho sự thay đổi kiến trúc.

## Các bài tập

1. Đi chạy`code/main.py`trên một token tổng hợp 1024.`(l, k, w)`xác định các thiết lập sẵn đạt được số lượng khóa thấp nhất cho mỗi truy vấn trong khi giữ 95% nhớ lại với sự chú ý đầy đủ trong một bài kiểm tra kim cương.

2. Thay thế máy nén trung bình bằng một máy nén trung bình nhỏ được học MLP (2 lớp, ẩn 32). Đào tạo nó trên một nhiệm vụ tổng hợp nơi tín hiệu là trung bình của một khối. đo khoảng cách phức tạp so với đường cơ sở trung bình trên dữ liệu được giữ.

3. Thực hiện các cửa MLP. Nó lấy truy vấn như đầu vào và xuất ra ba scalars. cho thấy rằng cửa cư xử hợp lý: trọng lượng gần giống nhau trên truy vấn ngẫu nhiên, trọng lượng nặng trên nhánh được chọn khi truy vấn chạm vào một khối phía sau xa.

4. Xét ngân sách bộ nhớ cache KV cho mô hình 70B được hỗ trợ bởi NSA ở ngữ cảnh 128k. Đầu KV là 8, đầu tối 128, BF16. So sánh với sự chú ý đầy đủ và với MLA (Phase 10 · 14 cho thấy số MLA).

5. Đọc Phần 4 của bài báo NSA (arXiv:2502.11089) và giải thích bằng ba câu tại sao điểm chú ý của nhánh nén được sử dụng lại cho việc lựa chọn top-k thay vì tính toán điểm định tuyến riêng biệt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Compressed branch | "Coarse view" | Attention over block-averaged keys that provides global context in $O(N/l)$ keys per query |
| Selected branch | "Top-k blocks" | Fine-grained attention over the `k` blocks with highest compressed-branch scores |
| Sliding window | "Local context" | Attention over the last `W` tokens for short-range patterns |
| Native trainability | "Pre-train with the sparsity on" | The sparsity pattern is learned during pre-training, not bolted on at inference |
| Compression block size l | "Group size for coarse view" | How many tokens get merged into one summary; 32-64 typical |
| Top-k | "Blocks to keep" | Number of compressed blocks whose uncompressed tokens get read; 16 typical |
| Sliding window W | "Local attention radius" | Typically 512; shorter hurts local coherence, longer wastes compute |
| Branch gate | "How to mix the three" | Per-position MLP output that weights the three branches' contributions |
| Hardware alignment | "Kernel-friendly sparsity" | Sparse pattern chosen so that the actual GPU kernel achieves the theoretical speedup |
| DSA | "NSA's successor" | Deepseek Sparse Attention, the architecture that followed NSA in DeepSeek's lineage |

## Đọc thêm

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 Best Paper)](https://arxiv.org/abs/2502.11089) tờ báo
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) các mục tiêu của gia đình kiến trúc NSA
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) Công việc đồng thời, tập trung vào các khối theo phong cách MoE
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) nguồn gốc cửa sổ trượt
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) Tiêu chuẩn cơ sở của sự thâm hụt thời gian suy luận NSA cải thiện trên
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) cơ sở của sự chú ý đầy đủ của các hạt nhân NSA đánh bại ở 64k
