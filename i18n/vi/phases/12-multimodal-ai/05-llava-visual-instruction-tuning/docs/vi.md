# LLaVA và điều chỉnh hướng dẫn thị giác

> LLaVA (ngày tháng 4 năm 2023) là kiến trúc đa phương thức được sao chép nhiều nhất trên hành tinh. Nó thay thế BLIP-2's Q-Former bằng một MLP 2 lớp, thay thế sự chú ý chéo của Flamingo bằng sự kết nối mã thông báo ngây thơ, và được đào tạo trên 158k lượt hướng dẫn thị giác được tạo bởi GPT-4 từ các tiêu đề chỉ văn bản. Bất kỳ học viên nào xây dựng một VLM giữa năm 2023 và 2026 đã xây dựng một số biến thể của LLaVA. LLaVA-1.5 được đổi thành một máy chiếu MLP và một bộ mã hóa 336px. LLaVA-NeXT đã thêm AnyRes tay cho đầu vào độ phân giải cao. LLaVA-OneVision hình ảnh thống nhất, nhiều hình ảnh và video trong một công thức. Bài học này đọc công thức, thực hiện máy chiếu và giải thích tại sao "simple hơn thắng".

**Type:** Build
**Languages:** Python (stdlib, projector + instruction-template builder)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 11 (LLM Engineering — instruction tuning)
**Time:** ~180 minutes

## Mục tiêu học tập

- Xây dựng một máy chiếu MLP 2 lớp mà lập bản đồ ViT patch embedments (dim 1024) đến LLM's embedment dim (dim 4096).
- Đi theo công thức LLaVA hai giai đoạn: (1) sắp xếp máy chiếu trên 558k cặp caption, (2) điều chỉnh hướng dẫn trực quan trên 158k lượt tạo ra bởi GPT-4.
- Xây dựng một lệnh nhắc theo định dạng LLaVA với thẻ đặt hình ảnh, lệnh nhắc hệ thống và lượt người dùng / trợ lý.
- Giải thích tại sao cộng đồng chuyển từ Q-Former sang MLP mặc dù Q-Former đã giành chiến thắng trong ngân sách.

## Vấn đề

BLIP-2's Q-Former (Dạy 12.03) nén một hình ảnh thành 32 token. sạch, hiệu quả, tốt cho các điểm chuẩn. Nhưng nó có hai vấn đề.

Đầu tiên, Q-Former có thể được đào tạo nhưng mất nó không phải là nhiệm vụ cuối cùng. Giai đoạn 1 đào tạo ITC + ITM + ITG. Giai đoạn 2 đào tạo mất LM. Các truy vấn học được một số đại diện trung gian mà LLM sau đó phải giải mã. Thông tin bị mất trong nút thắt.

Thứ hai, Q-Former có 188 triệu param, và ở thang LLaVA năm 2023, bạn phải cùng thiết kế với LLM mục tiêu của mình. Thay đổi LLM, đào tạo lại Q-Former. Thay đổi bộ mã hóa tầm nhìn, đào tạo lại. Mỗi sự kết hợp là một dự án R&D riêng biệt.

Câu trả lời của LLaVA là đáng xấu hổ vì đơn giản: lấy 576 mã đệm của ViT, mỗi lần thông qua một MLP 2 lớp (`1024 → 4096 → 4096`Không có nút thắt, không có giai đoạn 1 dự tập về các mục tiêu kỳ lạ, chỉ cần huấn luyện MLP về một mất LM trực tiếp.

Dữ liệu này xuất phát từ đâu? Nhìn sâu thứ hai của LLaVA: sử dụng GPT-4 (chỉ văn bản) để tạo dữ liệu hướng dẫn. Đưa GPT-4 tiêu đề COCO và dữ liệu hộp biên giới cho một hình ảnh, yêu cầu nó tạo ra các cuộc trò chuyện, mô tả và câu hỏi lý luận phức tạp. 158k hướng dẫn-đáp ứng quay miễn phí. Không có ghi chú của con người.

Kết quả: một VLM chạy trên 8 chiếc A100 trong một ngày, đánh bại Flamingo trên MMMU, và gửi một điểm kiểm soát mở mà cộng đồng có thể mở rộng. Đến cuối năm 2023, nó đã sinh ra hơn 50 chiếc gao.

## Khái niệm

### Kiến trúc

LLaVA-1.5 ở 7B:
- Bộ mã hóa tầm nhìn: CLIP ViT-L/14 @ 336 (đóng trong giai đoạn 1, tùy chọn không đóng băng giai đoạn 2).
- Động cơ chiếu: 2 lớp MLP với kích hoạt GELU, `1024 → 4096 → 4096`- Tôi không biết.
- LLM: Vicuna-7B v1.5 (một biến thể 13B sử dụng Vicuna-13B; sau đó các cành chuyển sang Llama-3.1-8B).

Chuyển tiếp một hình ảnh + văn bản prompt:

```
img -> ViT -> 576 patches of dim 1024
patches -> MLP -> 576 tokens of dim 4096
prompt: system + "<image>" placeholder + user question
replace <image> token with the 576 projected tokens
feed the full sequence to the LLM
decode response
```

Hình ảnh chiếm 576 token của ngữ cảnh LLM. Ở ngữ cảnh 2048, nó để lại 1472 token cho văn bản. Ở ngữ cảnh 32k, đó là một lỗi tròn.

### Giai đoạn 1: Lớp nối máy chiếu

Freeze ViT. Freeze LLM. Train chỉ 2 lớp MLP. Dataset: 558k image-caption pairs (LAION-CC-SBU). Loss: ngôn ngữ mô hình hóa trên tiêu đề, điều kiện trên các token hình ảnh dự đoán.

Trong một thời đại duy nhất với lô 128 điều này được thực hiện trong vài giờ. máy chiếu học cách lập bản đồ không gian ViT đến không gian LLM. Không giám sát cụ thể về nhiệm vụ.

### Giai đoạn 2: Khớp hướng dẫn trực quan

Tháo đông máy chiếu (vẫn có thể đào tạo). Tháo đông LLM (thường là hoàn toàn, đôi khi là LoRA).

Dữ liệu hướng dẫn là thủ thuật. Liu et al. đã tạo ra nó bằng:
1. Hãy chụp ảnh COCO.
2. Tạo ra mô tả văn bản (5 chú thích của con người + danh sách hộp giới hạn).
3. Gửi đến GPT-4 với ba mẫu đơn giản:
   - Cuộc trò chuyện: "Tạo ra một cuộc đối thoại trở lại và trở lại giữa người dùng và trợ lý về hình ảnh này".
   - Mô tả chi tiết: "Đưa một mô tả chi tiết phong phú về hình ảnh".
   - Giải thích phức tạp: "Hãy hỏi một câu hỏi đòi hỏi phải giải thích về hình ảnh, rồi trả lời".
4. Phân tích đầu ra của GPT-4 thành cặp (trình chỉ dẫn, phản ứng).

Không có gì trong những điều này chạm trực tiếp vào hình ảnh  chỉ mô tả văn bản. GPT-4 ảo giác nội dung hình ảnh hợp lý. Một số tiếng ồn, nhưng nó đã hoạt động: 158k quay là đủ để mở khóa đối thoại.

### Tại sao cộng đồng đã sao chép điều này

- Không có tổn thất cụ thể giai đoạn 1 để điều chỉnh.
- Đường chiếu sẽ chạy trong vài giờ, không phải vài ngày.
- LLM có thể được trao đổi (LLaVA-Llama2, LLaVA-Mistral, LLaVA-Llama3) bằng cách đào tạo lại chỉ với máy chiếu.
- Đường ống dữ liệu hướng dẫn thị giác sử dụng GPT-4 và rẻ để tái tạo cho một miền mới.

### LLaVA-1.5 và LLaVA-NeXT

LLaVA-1.5 (tháng 10 năm 2023) thêm:
- Dữ liệu về nhiệm vụ học thuật (VQA, OKVQA, RefCOCO) trộn vào điều chỉnh hướng dẫn.
- Hệ thống nhanh hơn.
- Một máy chiếu MLP 2 tầng thay vì lớp tuyến tính đơn gốc, và CLIP ViT-L/14 ở 336px (576 token) thay vì 224px (256 token).
- Một biến thể HD chia lưới trong báo, mà LLaVA-NeXT sau đó gửi như AnyRes.

LLaVA-NeXT (từ tháng 1 năm 2024) thêm:
- AnyRes: chia hình ảnh độ phân giải cao thành một lưới 2x2 hoặc 1x3 gồm 336x336 cây trồng, cộng với một hình ảnh nhỏ độ phân giải thấp toàn cầu. Mỗi cây trồng trở thành 576 token. Một lưới 2x2 cộng với hình ảnh nhỏ cung cấp khoảng 2880 token hình ảnh cho mỗi hình ảnh. Một lưới 1x3 có ít cây trồng, vì vậy nó tốn ít token hơn.
- Sự kết hợp dữ liệu hướng dẫn tốt hơn với ShareGPT4V (chữ bản GPT-4V chất lượng cao).
- Các LLM cơ sở mạnh hơn (Mistral-7B, Yi-34B).

### LLaVA-OneVision

Bài học 12.08 bao gồm OneVision sâu sắc. Phiên bản ngắn: cùng một máy chiếu, nhưng được đào tạo với chương trình giảng dạy bao gồm hình ảnh đơn, nhiều hình ảnh và video trong một mô hình với ngân sách biểu tượng trực quan được chia sẻ.

### So sánh với Q-Former

| | Q-Former (BLIP-2) | MLP (LLaVA) |
|---|---|---|
| Visual tokens per image | 32 | 576 (base) or about 2880 (AnyRes, 2x2 grid) |
| Trainable params | 188M + LM | ~22M (7B) + LM |
| Stage 1 loss | ITC+ITM+ITG | LM only |
| LLM drop-in | Requires retrain | Swap with minimal retrain |
| Multi-image | Awkward | Natural (concat) |
| Video | Awkward | Natural (per-frame concat) |
| Token budget | Small | Large |

MLP thắng về sự đơn giản và tính linh hoạt của token. Q-Former thắng về ngân sách token. Đến cuối năm 2023, ngân sách token không còn là ràng buộc (các bối cảnh LLM tăng lên 32k-128k+) và sự đơn giản thống trị.

### Phương thức prompt

```
A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions. USER: <image> Describe this image in detail. ASSISTANT: The image shows ...
```

`<image>`là một token giữ chỗ. Trước khi token hóa, nó được thay thế bằng 576 token thị giác (hoặc khoảng 2880 với một lưới AnyRes 2x2). Tokenizer nhìn thấy một chuỗi dài hơn một chút so với nó được đào tạo, nhưng LLM xử lý đầu vào mới vì giai đoạn 1 đã dạy nó.

### Tỷ lệ số

LLaVA-1.5-7B phân chia:
- CLIP ViT-L/14 @ 336: 303M (phase đông lạnh 1, thường không đông lạnh giai đoạn 2).
- Động cơ chiếu (2x tuyến tính): ~ 22M có thể được điều khiển.
- Llama-7B: 7B.
- Tổng: 7,3B Params. Có thể được huấn luyện trong giai đoạn 2: máy chiếu 7B + 22M đầy đủ.

Chi phí đào tạo cho giai đoạn 2: ~ 20 giờ trên 8xA100. Đây là số khóa  một ngày, một nút, có thể tái tạo. Đó là lý do tại sao LLaVA lan rộng.

```figure
mm-llava-projector
```

## Sử dụng nó

`code/main.py`thực hiện:

1. Máy chiếu MLP 2 tầng (dim 16 → 32 → 32 cho quy mô đồ chơi) trong Python tinh khiết.
2. Các đường ống xây dựng nhanh chóng: hệ thống nhanh chóng + `<image>`được thay thế bằng N token dự đoán + user turn + assistant generation placeholder.
3. Một trình hiển thị cho khối hình ảnh 576 token trông như thế nào trong bối cảnh LLM (nhiều phần trăm 2k / 32k / 128k bối cảnh tiêu thụ).

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-llava-vibes-eval.md`. Với một điểm kiểm soát gia đình LLaVA, nó chạy một bộ vibes-eval 10 lần (3 captioning, 3 VQA, 2 lý luận, 2 từ chối) và báo cáo một thẻ điểm số có thể đọc được bởi con người. Không phải một điểm chuẩn; một thử nghiệm khói để xác nhận máy chiếu và LLM kết nối tốt.

## Các bài tập

1. Xét số các tham số có thể được đào tạo cho máy chiếu MLP 2 lớp tại `1024 → 4096 → 4096`Với GELU và bias, nó đại diện cho phần nào của LLaVA-13B?

2. Xây dựng một lời nhắc LLaVA cho một trường hợp "đưa" hình ảnh chứa một cá nhân. Viết phản ứng trợ lý dự kiến. Tại sao LLaVA nên từ chối cú bắn không và dữ liệu đào tạo nào sẽ cần thiết để củng cố sự từ chối?

3. Đọc phần AnyRes của blog LLaVA-NeXT. Xét số lượng mã thông báo trực quan cho một hình ảnh 1344x672 tại AnyRes. So sánh với 576 mã thông báo cơ sở tại 336x336.

4. Máy chiếu LLaVA giai đoạn 1 được đào tạo với mất LM trên tiêu đề. Điều gì sẽ xảy ra nếu bạn bỏ qua giai đoạn 1 và đi thẳng đến giai đoạn 2 (chính giác hướng dẫn điều chỉnh)?

5. LLaVA-Instruct-150k sử dụng GPT-4 với phụ đề COCO để tạo ra hướng dẫn. Đối với một lĩnh vực mới (những tia X y tế, hình ảnh vệ tinh), mô tả đường ống dữ liệu bốn bước để tạo ra hướng dẫn lĩnh vực.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Projector | "MLP bridge" | 2-layer MLP with GELU mapping ViT dim to LLM dim |
| Image token | "<image> placeholder" | Prompt marker replaced by N projected visual tokens before inference |
| Visual instruction tuning | "LLaVA stage 2" | Training on GPT-4-generated (image, instruction, response) triplets |
| Stage 1 alignment | "Projector pretraining" | Freeze ViT and LLM, train projector with LM loss on captions |
| AnyRes | "Multi-crop tiling" | Split high-res image into a tile grid and concatenate each tile's visual tokens |
| LLaVA-Instruct | "GPT-4-generated" | 158k instruction-response pairs synthesized from COCO captions + GPT-4 |
| Vision encoder freeze | "Backbone locked" | CLIP weights do not update in stage 1, sometimes not in stage 2 either |
| ShareGPT4V | "Better captions" | 1M dense captions generated by GPT-4V, used for higher-quality alignment |
| VQA | "Visual question answering" | Task of answering a free-form question about an image |
| Prismatic VLMs | "Design-space paper" | Karamcheti 2024 ablation systematically testing projector and data choices |

## Đọc thêm

- [Liu et al. — Visual Instruction Tuning (arXiv:2304.08485)](https://arxiv.org/abs/2304.08485) giấy LLaVA.
- [Liu et al. — Improved Baselines with Visual Instruction Tuning (arXiv:2310.03744)](https://arxiv.org/abs/2310.03744) LLaVA-1.5.
- [Chen et al. — ShareGPT4V (arXiv:2311.12793)](https://arxiv.org/abs/2311.12793) bộ dữ liệu chữ viết tắt dày đặc.
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865) thiết kế không gian ablations.
- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326) Unified single-image, multi-image, video.
