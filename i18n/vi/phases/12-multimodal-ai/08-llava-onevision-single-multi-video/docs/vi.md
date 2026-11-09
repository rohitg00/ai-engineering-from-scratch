# LLaVA-OneVision: Một hình ảnh, nhiều hình ảnh, video trong một mô hình

> Trước LLaVA-OneVision (Li et al., tháng 8 năm 2024) thế giới VLM mở có dòng dõi riêng biệt: LLaVA-1.5 cho hình ảnh đơn, các mô hình hình ảnh đa như Mantis và VILA, các mô hình video như Video-LLaVA và Video-LLaMA. Mỗi người đều giành được điểm chuẩn của mình và thất bại ở những người khác. LLaVA-OneVision lập luận rằng một chương trình giảng dạy duy nhất có thể đào tạo một mô hình để thống trị cả ba kịch bản, và rằng các hiệu ứng chuyển giao nhiệm vụ mới nổi (nghệ năng hình ảnh duy nhất được xuất khẩu sang video, lý luận nhiều hình ảnh được xuất khẩu sang hình ảnh duy nhất) vượt qua tổng số các chuyên gia. Công thức này là một cách đơn giản: một ngân sách biểu tượng trực quan cân bằng giữa các kịch bản, cộng với một chương trình giảng dạy rõ ràng chuyển từ hình ảnh đơn đến OneVision (phần hình đa) sang video. Bài học này đọc ngân sách, chương trình học, và hành vi mới nổi.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token budget solver + curriculum planner)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 06 (any-resolution)
**Time:** ~180 minutes

## Mục tiêu học tập

- Thiết kế ngân sách biểu tượng trực quan giữ cân bằng giữa đầu vào hình ảnh đơn, nhiều hình ảnh và video.
- Đặt một chương trình giảng dạy đào tạo chuyển giao kỹ năng từ hình ảnh đơn sang video mà không bị lãng quên thảm khốc.
- Giải thích tại sao một mô hình duy nhất đánh bại các chuyên gia ở cùng một số parameter khi chương trình giảng dạy được thực hiện đúng.
- Hãy nêu tên ba khả năng mới nổi được báo cáo bởi LLaVA-OneVision: lý luận nhiều máy ảnh, yêu cầu đặt dấu, đại lý chụp màn hình iPhone.

## Vấn đề

Hình ảnh, đa hình ảnh và video đều nhấn mạnh một mô hình khác nhau.

Một hình ảnh cần các token độ phân giải cao (AnyRes, ~ 2880 token hình ảnh) để chụp OCR và chi tiết tinh tế.

Multi-image muốn nhiều hình ảnh ở độ phân giải vừa phải (~ 576 token mỗi) vì vậy lý luận giữa các hình ảnh phù hợp với bối cảnh. Ngân sách cho mỗi mẫu: 4-8 hình ảnh, 576 mỗi, 2300-4600 token.

Video cần nhiều khung hình ở độ phân giải thấp (~ 196 token mỗi khung hình sau khi hợp nhất) để nắm bắt động lực thời gian. Ngân sách cho mỗi mẫu: 8-32 khung hình, 196 mỗi, 1600-6200 token.

Nếu bạn đào tạo các mô hình riêng biệt, bạn chọn một ngân sách. Nếu bạn đào tạo một mô hình, bạn cần ngân sách để quy mô hợp lý qua các kịch bản mà không làm hỏng bối cảnh.

Trước OneVision, câu trả lời mặc định là "để đào tạo một kịch bản, bỏ qua những kịch bản khác". Video-LLaVA đã trang bị video vào một mô hình hình ảnh với các giai đoạn đào tạo bổ sung. LLaVA-NeXT đã thêm hỗ trợ nhiều hình ảnh với gạch. Không ai xử lý cả ba đều sạch.

## Khái niệm

### Ngân sách mã thông báo OneVision

LLaVA-OneVision không xác định một con số mã thông báo chính xác. Nó cân bằng con số mã thông báo trực quan tối đa cho mỗi mẫu, vì vậy ba kịch bản rơi vào cùng phạm vi, khoảng 6.000 đến 9.000 mã thông báo, được phân bổ khác nhau cho mỗi kịch bản:

- Hình đơn: AnyRes-Max-9 (tối đa 9 tấm + một khung hình cơ sở), mỗi khung hình 384x384 cho ra 729 token từ SigLIP SO400M. Tối đa: 729 * (1 + 9) = 7290 token.
- Multi-image: mỗi hình ảnh ở 384 không có tấm, 729 token không hợp nhất.
- Video: lên đến 32 khung hình ở 384 với 2x2 bilinear pooling → 196 token mỗi khung hình.

Việc phân bổ giữ tổng số tối đa trong cùng một dải, do đó không có kịch bản nào thống trị bối cảnh hoặc độ nghiêng.`code/main.py`Planner dưới đây sử dụng một ngân sách đồ chơi nhỏ hơn của 4096 để hiển thị logic cân bằng tương tự.

### Chương trình giảng dạy ba giai đoạn

Các chuyến tàu LLaVA-OneVision được chia thành ba giai đoạn:

1. SFT hình ảnh đơn (Stage SI). Tất cả dữ liệu là hình ảnh đơn-thêm văn bản. Đào tạo vào đầu vào AnyRes độ phân giải cao. Điều này dạy nhận thức, OCR và hiểu biết tinh vi. Sử dụng dữ liệu LLaVA-NeXT cộng với dữ liệu hình ảnh đơn cụ thể OneVision.
2. OneVision SFT (phases OV). Trộn hình ảnh đơn + nhiều hình ảnh + video (phases được lấy mẫu một cách đồng nhất). Tập luyện vào ngân sách token thống nhất. Điều này dạy mô hình xử lý hình dạng lô khác nhau. Không có thiết lập lại trọng lượng  tiếp tục từ giai đoạn SI.
3. Chuyển giao nhiệm vụ (phases TT). Cứ tiếp tục với một hỗn hợp nhiệm vụ mục tiêu, thường nặng hơn cho nhiều hình ảnh hoặc video tùy thuộc vào sản phẩm.

Điều quan trọng: trật tự chương trình học quan trọng. Việc đào tạo video đầu tiên hoặc nhiều hình ảnh đầu tiên tạo ra hiệu suất hình ảnh tồi tệ hơn so với hình ảnh một lần, ngay cả với cùng một dữ liệu. Bài báo này rõ ràng loại bỏ điều này.

### Tại sao chương trình giảng dạy hoạt động

Việc đào tạo hình ảnh đơn xây dựng cơ sở nhận thức. Các mã hóa patch mang các tính năng trực quan tinh tế; LLM học cách tích hợp chúng với văn bản. Nhiều hình ảnh và video giới thiệu những thách thức cấu trúc (phình nào là cái gì, điều gì xảy ra đầu tiên) khó học nếu không có cơ sở nhận thức mạnh mẽ.

Nếu bạn tập hợp tất cả các kịch bản từ đầu cùng nhau, mô hình này không phù hợp với nhận thức (dữ liệu hình ảnh đơn giới hạn mỗi lô) và cấu trúc quá mức (rất dữ liệu đa hình ảnh / video). Kết quả: mô hình theo các mô hình lý luận qua hình ảnh nhưng là nông cạn về thị giác.

Việc sắp xếp chương trình giảng dạy cho bạn sức mạnh nhận thức từ giai đoạn SI, sau đó là lý luận về cấu trúc/thời gian từ giai đoạn OV, mà không mất cả hai.

### Kỹ năng liên quan đến các kịch bản mới nổi

Báo cáo LLaVA-OneVision báo cáo ba khả năng mới nổi:

1. Nhận xét nhiều máy ảnh. Được đào tạo trên nhiều hình ảnh + video riêng biệt; khi suy luận, được yêu cầu suy luận về một cảnh lái xe nhiều máy ảnh. Mô hình tích hợp chính xác các quan điểm mặc dù chưa bao giờ thấy định dạng chính xác đó trong đào tạo.
2. Set of mark prompting. Người dùng ghi chú các đối tượng trong một hình ảnh với các dấu hiệu có số; các lý do mô hình về "điều gì mà dấu 3 đang làm so với dấu 7." Được đào tạo trên cả dấu hiệu và ghi chú; học từ sự kết hợp của việc đặt đất không gian + tham chiếu nhiều hình ảnh.
3. Người dùng cung cấp một ảnh chụp màn hình của màn hình iPhone và yêu cầu lập kế hoạch nhấp chuột tiếp theo. Được đào tạo về ảnh chụp màn hình UI, video của dòng công việc của người dùng và nhiều hình ảnh trước / sau cặp.

Đây không phải là những nhiệm vụ được đào tạo; chúng xuất hiện từ cấu trúc thành phần của chương trình giảng dạy.

### Kết hợp mã thông báo trực quan

Ngân sách token đòi hỏi sự hợp nhất. OneVision sử dụng sự phân cực hàng tuyến trên lưới đệm 2D: 24x24 = 576 đệm trở thành 12x12 = 144 (2x factor) hoặc 8x8 = 64 (3x factor).

Sự lựa chọn của các yếu tố hợp nhất cho mỗi kịch bản là một siêu tham số. ít hợp nhất = nhiều token = đại diện phong phú hơn.

### LLaVA-OneVision-1.5

Việc tiếp tục năm 2025 (LLaVA-OneVision-1.5, arXiv 2509.23661) là "bình trọn mở" về dữ liệu đào tạo, trọng lượng mô hình và mã.

### Khác biệt với Qwen2.5-VL

Qwen2.5-VL (Dạy 12.09) đưa ra các lựa chọn khác nhau. Nó sử dụng M-RoPE và FPS động thay vì hợp nhất cố định.

```figure
l5-onevision-budget
```

## Sử dụng nó

`code/main.py`là một kế hoạch giảng dạy và ngân sách cho một VLM kiểu OneVision. Với ngân sách token cho mỗi mẫu và một hỗn hợp kịch bản mục tiêu (chẳng hạn 40% hình ảnh đơn, 30% hình ảnh đa, 30% video), nó:

- Đưa ra độ phân giải, yếu tố hợp nhất và khung cho từng kịch bản.
- Kiểm tra rằng mọi kịch bản phù hợp với ngân sách chung.
- Báo cáo số lượng token dự kiến, LLM FLOPs và các kịch bản nào bị thiếu token.
- Bác in một lịch trình đào tạo từng giai đoạn.

Sử dụng nó để lên kế hoạch một sự điều chỉnh tinh tế của OneVision hoặc để kiểm tra sức khoẻ của một chi phí của việc triển khai VLM theo yêu cầu.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-onevision-budget-planner.md`Với phân phối nhiệm vụ mục tiêu và ngân sách cho mỗi mẫu, nó phát ra nhân tố AnyRes, tích hợp mỗi khung hình, số lượng khung video và trọng lượng giai đoạn chương trình giảng dạy.

## Các bài tập

1. Sản phẩm của bạn hỗ trợ 80% hình ảnh đơn, 10% hình ảnh đa (2-4 hình ảnh), 10% video (8-16 khung hình). Thiết kế ngân sách token. Bạn sẽ đặt ngân sách bổ sung mà bạn tiết kiệm vì không làm nhiều hình ảnh nặng?

2. Đọc LLaVA-OneVision Phần 4.3 (capacities emergent). đề xuất một kỹ năng mới nổi thứ tư mà chương trình giảng dạy có thể mở ra nhưng báo cáo không báo cáo.

3. Thay đổi trình tự chương trình học tập  đào tạo hình ảnh đa hình ảnh trước, sau đó hình ảnh đơn, sau đó video.

4. Bài báo báo cáo các tiêu chuẩn video được đào tạo chỉ trên 8 khung hình mỗi mẫu. Liệu điều đó có tổng quát hóa thành video 30 giây khi suy luận?

5. Kết hợp hai tuyến của 24x24 patch đến 12x12 là giảm 2x mỗi chiều kích, do đó 4x ít hơn token. Thực hiện việc kết hợp trong stdlib Python và xác minh rằng trung bình trên mỗi khối 2x2 phù hợp với đầu ra hai tuyến.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OneVision scenario | "Single-image, multi-image, or video" | One of three input shapes the unified VLM handles; the budget stays balanced across |
| Token budget | "How many tokens per sample" | Total visual tokens the LLM sees per training / inference sample, about 6k to 9k at most in LLaVA-OneVision |
| Curriculum | "Training order" | Stage ordering (single-image → multi-image → video) chosen for emergent transfer |
| Bilinear pooling | "Token shrink" | Applying bilinear interpolation to the patch grid (2D) to reduce token count while preserving locality |
| Emergent skill | "Not trained, still works" | Capability that appears at inference without matching training data, due to curriculum composition |
| AnyRes-k | "k-tile setup" | k sub-tiles of fixed resolution plus one thumbnail, typical $k \in \lbrace 4, 9 \rbrace$ |
| Task transfer | "Cross-scenario generalization" | Skills learned on single-image that apply to video (and vice versa) via shared backbone |

## Đọc thêm

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
