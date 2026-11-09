# Tầm nhìn bất kỳ độ phân giải nào: Patch-n'-Pack và NaFlex

> Hình ảnh thực không phải là 224x224 vuông. Một tờ biên lai là 1:3, một biểu đồ là 16:9, một quét y tế có thể là 4096x4096, một ảnh chụp màn hình di động là 9:19.5. Câu trả lời VLM trước năm 2024  thay đổi kích thước mọi thứ thành một hình vuông cố định  ném đi tín hiệu làm cho OCR, hiểu tài liệu và phân tích cảnh độ phân giải cao làm việc. NaViT (Google, 2023) cho thấy bạn có thể gói các bản vá độ phân giải biến thành một lô biến đổi đơn với nén đường khối. M-RoPE (2024) của Qwen2-VL đã loại bỏ hoàn toàn các bảng vị trí tuyệt đối. AnyRes của LLaVA-NeXT đã làm phẳng hình ảnh độ phân giải cao thành hình ảnh cơ sở + phụ. Thay đổi NaFlex của SigLIP 2 (2025) hiện là mã hóa mặc định cho các VLM mở muốn một điểm kiểm soát duy nhất phục vụ mọi tỷ lệ khía cạnh. Bài học này thực hiện patch-n'-pack cuối đến cuối.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, patch packer + block-diagonal mask)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 12 · 05 (LLaVA)
**Time:** ~120 minutes

## Mục tiêu học tập

- Lắp ráp các bản vá từ một loạt hình ảnh độ phân giải biến thành một chuỗi và xây dựng mặt nạ chú ý khối-châm.
- Chọn giữa AnyRes tileing (LLaVA-NeXT), NaFlex (SigLIP 2) và M-RoPE (Qwen2-VL) cho một nhiệm vụ nhất định.
- Lập kế hoạch ngân sách token cho OCR, biểu đồ và chụp ảnh mà không cần đổi kích thước.
- Hãy nêu tên ba chế độ thất bại của việc hình vuông: văn bản bị bẻ, nội dung bị cắt, mã thông báo bị lãng phí trên đệm.

## Vấn đề

Các bộ biến đổi mong đợi một chuỗi. Một lô là một loạt các chuỗi cùng chiều dài. Nếu hình ảnh của bạn là 224x224, bạn nhận được 196 mã đệm mỗi lần, không cần đệm, công việc đã hoàn thành. Đào trên 224, suy luận trên 224, không bao giờ nghĩ về độ phân giải nữa.

Các tài liệu là chân dung (8,5x11 inch, 2:3-ish). Chart screenshots là cảnh quan (16:9). Quản đơn là cao và mỏng (1:3). Tàu hình ảnh y tế ở 2048x2048 hoặc lớn hơn.

Ba lựa chọn trước năm 2024 và tại sao mỗi lựa chọn đều thất bại:

1. Tái kích thước lên một hình vuông cố định (224x224 hoặc 336x336).
2. Crop to a fixed aspect ratio. Bạn ném đi phần lớn hình ảnh, và chọn vị trí của crop là vấn đề thị giác của nó.
3. Pad đến phía dài nhất. sửa sai lệch nhưng lãng phí 50% + của các token trên đệm hình ảnh chân dung. chi phí chú ý vuông trên tất cả các token pad.

Câu trả lời 2024-2025: để biến đổi ăn các đốm ở độ phân giải bản địa của hình ảnh, và tìm ra cách đóng gói một lô khác nhau vào một chuỗi mà không lãng phí tính toán.

## Khái niệm

### NaViT và patch-n'-pack

NaViT (Dehghani et al., 2023) là bài báo cho thấy công việc này trên quy mô.

1. Đối với mỗi hình ảnh trong lô, tính toán lưới nhựa bản địa của nó ở kích thước nhựa được chọn (chẳng hạn là 14).
2. Mời các bản vá của mỗi hình ảnh vào chuỗi dài biến của riêng nó.
3. Kết hợp tất cả các bản vá hình ảnh thành một chuỗi dài cho lô.
4. Xây dựng một mặt nạ chú ý khối-châm để các bản vá hình ảnh A chỉ đi bên trong hình ảnh A.
5. Mang theo thông tin vị trí cho mỗi vá (2D RoPE hoặc các embedment vị trí phân đoạn).

Một loạt ba hình ảnh ở 336x336 (576 mã thông báo), 224x224 (256 mã thông báo) và 448x336 (768 mã thông báo) trở thành một chuỗi 1600 mã thông báo với một mặt nạ khối-châm 1600x1600. Không đệm. Không có tính toán lãng phí.

NaViT cũng giới thiệu giảm đệm phân đoạn trong khi tập luyện  giảm 50% các đệm ngẫu nhiên trên toàn bộ đệm  điều này cả đều điều chỉnh và tăng tốc độ tập luyện. SigLIP 2 thừa hưởng điều này.

### AnyRes (LLaVA-NeXT)

AnyRes của LLaVA-NeXT là một lựa chọn thay thế thực tế. Với hình ảnh độ phân giải cao và mã hóa cố định (CLIP hoặc SigLIP ở 336), hình ảnh được làm bằng tile:

1. Chọn một bố cục lưới từ một bộ được xác định trước  (1x1), (1x2), (2x1), (1x3), (3x1), (2x2), vv  phù hợp nhất với tỷ lệ hình ảnh.
2. Đặt tấm hình đầy đủ vào lưới; mỗi tấm trở thành một cây trồng 336x336.
3. Ngoài ra tạo ra một hình ảnh nhỏ: toàn bộ hình ảnh được kích thước lại thành 336x336 như một token ngữ cảnh toàn cầu.
4. Mã hóa mỗi tấm thông qua mã hóa 336 đóng băng.

Đối với một hình ảnh 672x672 ở lưới 2x2 cộng với hình ảnh nhỏ: 4 * 576 + 576 = 2880 mã thông báo trực quan.

AnyRes là tuyến đường lựa chọn khi mã hóa của bạn bị đóng băng và chỉ hỗ trợ một độ phân giải. Nó làm nổ số lượng token cho hình ảnh lớn (một hình ảnh 1344x1344 ở lưới 4x4 là 9216 + 576 ≈ 9800 token, vượt quá một bối cảnh LLM 8k trước khi bất kỳ văn bản nào đến).

### M-RoPE (Qwen2-VL)

Qwen2-VL đã giới thiệu Đường xếp vị trí xoay đa phương tiện. Thay vì vị trí phân tích của NaViT hoặc tấm và hình ảnh nhỏ của AnyRes, mỗi bản vá có vị trí 3D (thời gian, chiều cao, chiều rộng). Các vòng quay truy vấn / khóa xử lý chiều dài tùy ý H, W và thời gian.

M-RoPE cung cấp độ phân giải động bản địa mà không cần đào tạo lại. Khi bạn đưa ra bất kỳ hình ảnh HxW nào, người nhúng vá sẽ tạo ra các mã H/14 x W/14, mỗi mã sẽ có vị trí (t=0, r=row, c=col), RoPE sẽ quay sự chú ý với tần số phù hợp, được thực hiện. Qwen2.5-VL và Qwen3-VL tiếp tục như vậy.

Không giống như AnyRes, M- RoPE là $O(H \times W / P^2)$Các mã thông báo ở độ phân giải bản địa không có chi phí cao hơn. Không giống như NaViT, nó vẫn mong đợi một hình ảnh duy nhất mỗi chuyển tiếp.

### NaFlex (SigLIP 2)

NaFlex là chế độ tự nhiên của điểm kiểm tra SigLIP 2. Một mô hình duy nhất phục vụ nhiều chiều dài chuỗi (256, 729, 1024 token) khi suy luận. Bên trong nó sử dụng kiểu NaViT patch-n'-pack trong quá trình đào tạo và các vị trí phân tích tuyệt đối cho mỗi bản vá. Điểm bán hàng: một điểm kiểm tra, chọn ngân sách token của bạn khi suy luận dựa trên nhiệm vụ.

Đối với một nhiệm vụ ngữ nghĩa (thân loại, lấy lại), 256 token. Đối với OCR hoặc hiểu đồ thị, 1024 token. Không có đào tạo lại.

### Mặt nạ đóng gói

Mặt nạ hình khối là nơi mà hầu hết các triển khai gặp trục trặc.`N_total`hình ảnh `i=0..B-1`với độ dài `n_i`, mặt nạ `M`hình dạng`(N_total, N_total)`là 1 nếu cả hai chỉ số rơi vào khối hình ảnh tương tự, nếu không 0. Bạn có thể xây dựng nó từ một danh sách chiều dài tích lũy:

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

Đây là một dòng trong PyTorch với `torch.block_diag`FlashAttention's variable-length path (`cu_seqlens`) bỏ qua mặt nạ hoàn toàn và tham gia theo trình tự sử dụng tensor chiều dài tích lũy trực tiếp  ~ 10x nhanh hơn một mặt nạ dày đặc cho các lô điển hình.

### Ngân sách token

Chọn chiến lược theo nhiệm vụ:

- OCR / tài liệu: 1024-4096 token. SigLIP 2 NaFlex tại 1024, hoặc AnyRes 3x3 + hình ảnh nhỏ.
- Hình và UI: 729-1024 token ở 384-448 bản địa. Qwen2.5 VL độ phân giải động với tối đa pixel.
- Hình ảnh tự nhiên: 256-576 token là tốt. LLM dòng chảy xuống nhìn đủ. Thanh tiền cho token nơi mật độ nội dung cao.
- Video: 64-128 token mỗi khung sau khi tích hợp không gian, 2-8 FPS. Bài học 12.17 bao gồm điều này.

Quy tắc sản xuất năm 2026: chọn một nắp tối đa pixel mỗi nhiệm vụ, mã hóa ở tỷ lệ độ native lên nắp đó, đóng gói lô, và bỏ đi đệm.`min_pixels`và `max_pixels`chính xác là cái nút này.

```figure
mm-patch-n-pack
```

## Sử dụng nó

`code/main.py`thực hiện patch-n'-pack cho một loạt hình ảnh đa dạng với các phối điểm pixel nguyên số.

- Có một danh sách kích thước hình ảnh (H, W).
- Xét chiều dài chuỗi các bản vá của mỗi hình ảnh ở kích thước bản vá 14.
- Bao gồm chúng thành một chuỗi dài tổng cộng`sum(n_i)`- Tôi không biết.
- Xây dựng mặt nạ chú ý khối-châm-phương (thấp, để rõ ràng hơn).
- So sánh chi phí đóng gói so với kích thước vuông và các tấm AnyRes.
- Bác bản bảng ngân sách token cho một lô hỗn hợp (trình, biểu đồ, ảnh chụp màn hình, ảnh).

Số lượng bị bỏ rơi là lý do tại sao mỗi VLM mở năm 2026 sử dụng gói vá.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-resolution-budget-planner.md`. Với khối lượng công việc hỗn hợp tỷ lệ khía cạnh (OCR, biểu đồ, ảnh, khung video) và ngân sách tổng cộng token, nó chọn chiến lược phù hợp (NaFlex, AnyRes, M-RoPE, hoặc vuông cố định) và phát ra cấu hình theo yêu cầu. Sử dụng kỹ năng này khi bạn kích thước một VLM cho một sản phẩm  nó ngăn chặn sự bùng nổ token 10x im lặng giết chết ngân sách trễ.

## Các bài tập

1. Một hóa đơn là 600x1500 (1:2.5). Ở kích thước vá 14, có bao nhiêu mã thông báo bản địa? bao nhiêu sau khi kích thước vuông lên 336?

2. Xây dựng mặt nạ hình khối-châm hình cho một loạt bốn hình ảnh với chiều dài 256, 576, 729, 1024.`256^2 + 576^2 + 729^2 + 1024^2`các mục không bằng 0.

3. Đối với một hình ảnh 1792x896 ở bản vá 14, so sánh: (a) kích thước vuông thành 336 sau đó mã hóa, (b) AnyRes 2x1 + hình ảnh nhỏ, (c) M-RoPE ở bản địa.

4. Thực hiện giảm đệm phân đoạn: với một chuỗi đóng gói, thả 50% mã thông báo một cách ngẫu nhiên, và cập nhật mặt nạ khối-châm tương ứng. Đo sự thay đổi độ ít của mặt nạ.

5. Đọc Phần 3.2 của bài báo Qwen2-VL (arXiv:2409.12191).`min_pixels`và `max_pixels`kiểm soát và tại sao cả hai ranh giới đều quan trọng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT-style packing" | Concatenate variable-length patch sequences from different images into one batch dimension |
| Block-diagonal mask | "Packing mask" | Attention mask that confines each image's patches to attend only to themselves, not neighbors in the pack |
| AnyRes | "LLaVA-NeXT tiling" | Split a high-res image into a grid of fixed-size tiles plus a global thumbnail; encode every tile with a fixed encoder |
| NaFlex | "SigLIP 2 native-flex" | Single SigLIP 2 checkpoint that serves 256/729/1024-token budgets at inference without retraining |
| M-RoPE | "Multimodal RoPE" | 3D rotary position encoding (time, row, column) that handles arbitrary H, W, T without position tables |
| cu_seqlens | "FlashAttention packing" | Cumulative-length tensor the FlashAttention varlen path uses instead of a dense block-diagonal mask |
| min_pixels / max_pixels | "Resolution bounds" | Qwen2.5-VL per-request knobs capping token count on very small or very large inputs |
| Visual token budget | "How many tokens per image" | Rough count of patch tokens emitted per image; sets the LLM's prompt budget and attention cost |

## Đọc thêm

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
