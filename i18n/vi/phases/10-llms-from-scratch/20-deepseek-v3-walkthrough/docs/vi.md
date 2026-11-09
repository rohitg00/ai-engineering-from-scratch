# Thiết kế DeepSeek-V3

> Giai đoạn 10 · Bài học 14 đặt tên cho sáu nút kiến trúc mỗi khi mô hình mở quay. DeepSeek-V3 (Từ tháng 12 năm 2024, tổng số tham số 671B, hoạt động 37B) biến tất cả sáu và thêm bốn: Multi-Head Latent Attention, cân bằng tải trọng hỗ trợ không mất, Dự đoán Multi-Token và đào tạo DualPipe. Bài học này đọc kiến trúc của DeepSeek-V3 từ trên xuống dưới và lấy mọi số parameter từ cấu hình được xuất bản. Đến cuối, bạn có thể giải thích tại sao tỷ lệ 671B/37B là cược đúng và tại sao MLA + MoE cùng nhau đánh bại một mình ở biên giới.

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## Mục tiêu học tập

- Đọc cấu hình DeepSeek-V3 từ trên xuống dưới và giải thích từng trường theo các nút GPT-2 sáu cộng với bốn bổ sung cụ thể cho DeepSeek.
- Thuộc dẫn tổng số parameter (671B), số parameter hoạt động (37B) và các thành phần đóng góp cho mỗi.
- Xét dấu chân cache KV của MLA ở ngữ cảnh 128k và so sánh với mức giá của mô hình dày đặc các param cùng hoạt động với GQA.
- Cần nêu tên bốn sáng tạo cụ thể của DeepSeek (MLA, MTP, định tuyến không mất mát phụ trợ, DualPipe) và tên phần nào của cấu trúc/các bộ đào tạo được nhắm mục tiêu.

## Vấn đề

DeepSeek-V3 là mô hình mở biên giới đầu tiên mà kiến trúc của nó khác biệt đáng kể với gia đình Llama. Llama 3 405B là "GPT-2 với sáu nút xoay". DeepSeek-V3 là GPT-2 với tất cả sáu nút cộng thêm bốn nút nữa. Đọc cấu hình Llama 3 là một sự nóng lên để đọc cấu hình DeepSeek, nhưng cấu trúc sâu  hình dạng của khối chú ý, logic định tuyến, mục tiêu thời gian đào tạo  là đủ khác nhau để bạn cần một bước đi riêng biệt.

Sự thưởng thức của việc học nó: Phiên bản mở của DeepSeek-V3 đã thay đổi ý nghĩa của "capacity biên giới" trong các mô hình mở. Kiến trúc là bản phác thảo mà nhiều khóa đào tạo 2026 đang sao chép.

## Khái niệm

### Lòng lõi không thay đổi, một lần nữa

DeepSeek-V3 vẫn tự lập. Nó vẫn xếp chồng các khối decoder. Mỗi khối vẫn có sự chú ý cộng với MLP cộng với hai RMSNorms. Nó vẫn sử dụng SwiGLU trong MLP. Nó vẫn sử dụng RoPE. Pre-norm. Cài đặt gắn trọng lượng. cùng một đường cơ sở như mọi Llama hoặc Mistral.

### Sự xoay quanh: MLA thay vì GQA

Từ giai đoạn 10 · 14 bạn biết GQA thu hẹp bộ nhớ cache KV bằng cách chia sẻ K và V trên các nhóm đầu Q. Sự chú ý tiềm ẩn đa đầu (MLA) đi xa hơn: K và V được nén thành một đại diện tiềm ẩn cấp thấp được chia sẻ (the `kv_lora_rank`KV cache chỉ lưu trữ ẩn  thường là 512 floats per token per layer, không phải 8 x 128 = 1024 floats.

Trong bối cảnh 128k, DeepSeek-V3 với MLA (một shared latent `c^{KV}`mỗi token mỗi lớp; K và V đều được dẫn từ tiềm ẩn này thông qua các dự đoán lên mà có thể được hấp thụ vào matmul tiếp theo):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

Một đường cơ sở GQA giả định (Llama 3 hình 70B, 8 đầu KV, đầu mờ 128) sẽ trả:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA nhỏ hơn 4 lần so với bộ nhớ cache GQA kiểu Llama-3-70B ở ngữ cảnh 128k.

Sự thỏa hiệp: MLA thêm một bước giảm nén mỗi tính toán chú ý (trên đầu).

### Đường dẫn: cân bằng tải phụ trợ không mất mát

Các bộ định tuyến MoE quyết định các chuyên gia top-k xử lý mỗi token. Một router ngây thơ tập trung quá nhiều công việc vào một vài chuyên gia, để lại những chuyên gia khác vô hiệu.

DeepSeek-V3 giới thiệu một chương trình hỗ trợ không mất mát. Các thuật ngữ thiên vị cho mỗi chuyên gia được thêm vào các logit router, được điều chỉnh trong quá trình đào tạo bằng một quy tắc đơn giản: nếu chuyên gia `e`quá tải, giảm `bias_e`Nếu bị tải quá mức, tăng nó. Không mất thêm thời gian.

Ảnh hưởng đến lỗ hổng chính: không có thể đo lường. Ảnh hưởng đến kiến trúc MoE: sạch hơn, không có siêu tham số lỗ phụ giúp để điều chỉnh.

### MTP: đào tạo dày đặc hơn + draft miễn phí

Từ giai đoạn 10 · 18 bạn biết DeepSeek-V3 thêm mô-đun D=1 MTP dự đoán mã thông báo hai vị trí phía trước.

Các tham số: 14B trên đầu của 671B chính.

### Việc đào tạo: DualPipe

Từ giai đoạn 10 · 19 bạn biết DualPipe là một đường ống dẫn hai chiều chồng chéo về phía trước và phía sau với các đoạn truyền thông toàn bộ qua nút.

### Các cấu hình, trường theo trường

Đây là cấu hình DeepSeek-V3 (đơn giản):

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

Hãy phân tích nó:

- `hidden_size=7168`: kích thước nhúng.
- `num_hidden_layers=61`: độ sâu khối tổng thể.
- `first_k_dense_layers=3`Các khối đầu tiên 3 sử dụng một MLP dày đặc kích thước 18432.
- `num_attention_heads=128`: 128 đầu truy vấn.
- `kv_lora_rank=512`: K và V được nén đến chiều kích ẩn này và bị nén mỗi đầu.
- `num_experts=256, num_experts_per_tok=8`Mỗi khối của Bộ Ngoại giao có 256 chuyên gia, các tuyến đường đứng đầu 8.
- `shared_experts=1`: trên đỉnh 256 chuyên gia đã được hướng dẫn, 1 chuyên gia luôn đóng góp cho mỗi token. Hãy nghĩ về nó như một "màn bằng dày đặc" đảm bảo mỗi token nhận được một cái gì đó đáng tin cậy.
- `moe_intermediate_size=2048`: kích thước ẩn của MLP của mỗi chuyên gia.

### Tài khoản tham số

Việc tính toán đầy đủ là trong `code/main.py`- Tiêu đề:

- Đêm: `vocab * hidden = 129280 * 7168 = ~0.93B`- Tôi không biết.
- 3 khối dày đặc đầu tiên: chú ý với MLA (~ 84M mỗi khối trong số đơn giản hóa máy tính) + SwiftU MLP dày đặc (`3 * 7168 * 18432 = ~396M`mỗi khối) + các tiêu chuẩn.
- 58 khối MoE: sự chú ý với MLA (~ 84M) + 256 chuyên gia hướng (`3 * 7168 * 2048 = ~44M`mỗi người) + 1 chuyên gia chia sẻ (~ 44M) + router + tiêu chuẩn. Khoảng 11.4B mỗi khối, bao gồm tất cả các chuyên gia. Khoảng 661B cho 58 khối MoE.
- Mô-đun MTP: mô-đun được xuất bản là 14B. Máy tính sử dụng một stand-in dày đặc của ~ 0,8B.

Tổng cộng: máy tính hạ cánh ở ~664B so với 671B được công bố cho mô hình chính. Điểm kiểm tra Hugging Face là 685B vì nó thêm mô-đun MTP 14B lên trên 671B. Khoảng cách ~ 1% còn lại đến từ việc đơn giản hóa: máy tính bỏ qua các kích thước RoPE tách rời trong MLA, đầu đầu ra không được gắn, và một vài tensor nhỏ.

Các tham số hoạt động cho mỗi forward:

- Lưu ý: 84M mỗi lớp * 61 = ~5.1B (tất cả các lớp cháy).
- MLP hoạt động: 3 lớp đầu tiên dày đặc (`3 * 396M = ~1.2B`), 58 lớp MOE hoạt động với 8 chuyên gia được chuyển hướng + 1 chuyên gia chia sẻ (`9 * 44M = ~396M`Mỗi lớp, tổng cộng là 23B.
- Đan nhúng + chuẩn: ~ 0,9B.
- Tổng hoạt động: ~ 30B từ máy tính so với 37B được xuất bản. Phần lớn khoảng cách là sự chú ý: MLA đầy đủ, với kích thước RoPE và truy vấn rộng hơn và đầu khóa, lớn hơn con số đơn giản hóa. Mô-đun MTP không tính đến 37B.

### Tỷ lệ 671B / 37B

Hình ảnh này được xem là một trong những hình ảnh ảnh ảnh ảnh ảnh ảnh ảnh ảnh ảnh ảnh ảnh hưởng đến sự phát triển của các máy tính.

### Đâu DeepSeek-V3 ngồi

| Model | Total | Active | Ratio | Attention | Novel ideas |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### Tiếp theo: R1, V4

DeepSeek-R1 (2025) là một cuộc chạy đào tạo lý luận trên xương sống V3. R1 sử dụng cùng một kiến trúc. Điều thay đổi là công thức sau đào tạo (RL quy mô lớn trên các nhiệm vụ có thể xác minh), chứ không phải kiến trúc trước đào tạo.

DeepSeek-V4 (nếu nó được xuất khẩu) dự kiến sẽ giữ MLA + MoE + MTP và thêm DSA (DeepSeek Sparse Attention), người kế nhiệm NSA từ giai đoạn 10 · 17.

```figure
moe-routing
```

## Sử dụng nó

`code/main.py`là máy tính tính tham số chuyên về hình dạng của DeepSeek-V3. chạy nó, so sánh đầu ra của nó với số của giấy, và sử dụng nó trên các biến thể giả thuyết (256 chuyên gia so với 512, top-8 so với top-16, MLA xếp hạng 512 so với 1024).

Những gì cần xem:

- Tổng số lượng tham số so với 671B được công bố.
- Số lượng tham số hoạt động so với công bố 37B.
- KV cache ở ngữ cảnh 128k  so sánh MLA vs GQA.
- Phân tích từng lớp để xem ngân sách tham số thực sự đi đâu.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-deepseek-v3-reader.md`. Với một mô hình gia đình DeepSeek (V3, R1 hoặc bất kỳ biến thể nào trong tương lai), nó tạo ra một kiến trúc đọc thành phần theo thành phần cho tên mỗi lĩnh vực của cấu hình, lấy số lượng tham số theo thành phần, và xác định được mô hình sử dụng những sáng tạo cụ thể của DeepSeek.

## Các bài tập

1. Đi chạy`code/main.py`- So sánh ước tính số tham số tổng của máy tính tính với 671B và xác định nơi delta đến.

2. Thay đổi cấu hình để sử dụng MLA xếp hạng 256 thay vì 512. Xét kích thước cache KV kết quả tại ngữ cảnh 128k.

3. So sánh DeepSeek-V3 (256 chuyên gia, top-8) định tuyến với một biến thể giả thuyết (512 chuyên gia, top-8). Tổng tham số tăng lên; tham số hoạt động vẫn giống nhau.

4. Đọc Phần 2.1 của báo cáo kỹ thuật DeepSeek-V3 (arXiv:2412.19437) về MLA. Giải thích bằng ba câu tại sao các matrices decompression K và V có thể được "thấm" vào matmul sau đó để hiệu quả thời gian suy luận.

5. DeepSeek-V3 sử dụng đào tạo FP8 cho hầu hết các hoạt động. Xét tiết kiệm bộ nhớ của FP8 so với BF16 để lưu trữ trọng lượng 671B. Điều này giao nhau như thế nào với ngân sách đào tạo token 14.8T?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | Compress K and V into a shared low-rank latent (kv_lora_rank, typically 512), decompress per head on-the-fly; KV cache stores only the latent |
| kv_lora_rank | "MLA compression dim" | The size of the shared latent for K and V; DeepSeek-V3 uses 512 |
| First k dense layers | "Early layers stay dense" | The first few MoE-model layers skip the MoE router and run a dense MLP for stability |
| num_experts_per_tok | "Top-k routing" | How many routed experts fire per token; DeepSeek-V3 uses 8 |
| Shared experts | "Always-on experts" | Experts that process every token regardless of routing; DeepSeek-V3 uses 1 |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | Per-expert bias terms adjusted during training to keep expert load balanced without adding a loss term |
| MTP module | "Extra prediction head" | Transformer block predicting $t+2$ from $h^{(1)}$ and $E(t+1)$; denser training, free speculative-decoding draft |
| DualPipe | "Bidirectional pipeline" | Training schedule that overlaps forward/backward compute with cross-node all-to-all |
| Active parameter ratio | "Sparsity" | active_params / total_params; DeepSeek-V3 hits 5.5% |
| FP8 training | "8-bit training" | Training storage and many compute ops in FP8; roughly halves memory vs BF16 at a small quality cost |

## Đọc thêm

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) tài liệu kiến trúc, đào tạo và kết quả đầy đủ
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) config file và các ghi chú triển khai
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) người tiền nhiệm đã giới thiệu MLA
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) kế thừa đào tạo lý luận về kiến trúc của V3
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) hướng tương lai cho sự chú ý của gia đình DeepSeek
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) tham chiếu lịch trình đào tạo
