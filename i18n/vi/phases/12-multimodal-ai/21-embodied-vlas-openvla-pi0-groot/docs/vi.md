# VLA thể hiện: RT-2, OpenVLA, π0, GR00T

> Lần đầu tiên một mô hình đọc một công thức từ một trang web và thực hiện nó trong một robot nhà bếp là RT-2 (Google DeepMind, tháng 7 năm 2023). RT-2 đã phân loại các hành động như các mã thông báo văn bản, đồng thời điều chỉnh một VLM trên dữ liệu web cộng với dữ liệu hành động robot, và chứng minh rằng kiến thức ngôn ngữ thị giác quy mô web chuyển sang kiểm soát robot. OpenVLA (tháng 6 năm 2024) đã gửi tham chiếu mở 7B. Phòng π0 của Cơ thể Trí tuệ (2024-2025) đã thêm các chuyên gia hành động phù hợp với dòng chảy. GR00T N1 (Tổng thống NVIDIA) (Từ tháng 3 năm 2025) cung cấp hệ thống kiểm soát kép (System 1 / System 2) cho robot nhân vật ở quy mô lớn. VLA nguyên thủy  thị giác-lời nói-phản ứng, một mô hình duy nhất nhìn thấy, đọc và hành động  là cầu nối giữa các mô hình hiểu biết của giai đoạn này và các hệ thống tự trị trong giai đoạn 15.

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## Mục tiêu học tập

- Mô tả mã hóa hành động: mã hóa bin riêng biệt (RT-2), mã hóa hành động hiệu quả FAST, các hành động phù hợp dòng chảy liên tục (π0).
- Giải thích tại sao việc đồng chỉnh trên dữ liệu web + robot bảo vệ việc chuyển giao kiến thức chung cho các nhiệm vụ mới.
- So sánh OpenVLA (cởi mở 7B Llama + VLM), π0 (sự phù hợp dòng chảy) và GR00T N1 (hệ thống kép) trên cùng một nhiệm vụ robot.
- Hãy nêu tên bộ dữ liệu Open X-Embodiment và vai trò của nó như là cơ quan đào tạo RT-X.

## Vấn đề

Một robot làm việc từ hướng dẫn ngôn ngữ tự nhiên đã là mục tiêu nghiên cứu kể từ những năm 1970. Câu trả lời của những năm 2020: mô hình hoạt động ngôn ngữ thị giác (VLA).

Những thách thức đặc biệt đối với VLA:

1. Không gian hành động là liên tục (thây góc, lực) và có chiều cao (7-DOF cánh tay + 3-DOF nắm giữ = 10 dims ở 30 Hz).
2. Dữ liệu đào tạo cụ thể cho robot hiếm. Open X-Embodiment có ~ 1M quỹ đạo; hình ảnh văn bản web là 5B+.
3. Điều khiển tần số quan trọng. vòng điều khiển 30 Hz có nghĩa là ngân sách 33ms mỗi hành động.
4. An toàn: Một hành động sai lầm làm hỏng phần cứng, con người hoặc tài sản.

## Khái niệm

### Đánh dấu hành động (RT-2)

Trù của RT-2: đại diện cho mỗi mục tiêu chung như một token văn bản định lượng. Phân biệt phạm vi bình thường hóa [-1, 1] thành 256 bin, lập bản đồ mỗi bin cho một ID từ vựng. Một hành động 10-DOF trở thành 10 token tại mỗi bước kiểm soát.

Đồng tinh chỉnh PaLM-X VLM trên một hỗn hợp:

- Cặp hình ảnh-tinh văn web (chữ viết tắt, VQA).
- Robot biểu tình, hành động như các token.

Mô hình thấy "tăng khối đỏ" ( ngôn ngữ) → hình ảnh (thìn) → chuỗi hành động 10 token (những mục tiêu liên kết được phân tiết). Web pretraining bảo tồn chuyển giao kiến thức chung: RT-2 có thể theo "lưu ý đối tượng chuyển động nhanh" mặc dù "lưu ý nhanh" không có trong dữ liệu đào tạo.

Nhẫn ở 3-5 Hz trong giấy RT-2, bị giới hạn bởi mã tự rút VLM.

### OpenVLA  tham chiếu mở 7B

OpenVLA (Kim et al., tháng 6 năm 2024) là tương đương RT-2 trọng lượng mở. 7B Llama backbone, DINOv2 + SigLIP mã hóa thị giác kép, mã hóa hành động trên 256 thùng.

Được đào tạo trên Open X-Embodiment (970k quỹ đạo trên 22 robot).

Tự động: 4-5 Hz trên A100 với định lượng, đủ nhanh để thao tác chậm, không phải để điều khiển tần số cao.

### FAST tokenizer  mã hóa hành động nhanh hơn

Pertsch et al. (2024) cho thấy rằng token hóa bin phân biệt là không hiệu quả  hầu hết các tập hợp hành động trong một khu vực nhỏ của bin-space. FAST (Frequency-domain Action Sequence Tokenizer) nén các chuỗi hành động thông qua DCT và định lượng các hệ số.

Một quỹ đạo hành động 30 bước trở thành ~ 10 token FAST thay vì 300 token bin riêng biệt.

### π0 và các hành động phù hợp dòng chảy

Phương pháp π0 của Physical Intelligence (Black et al., tháng 10 năm 2024) thay thế các token hành động riêng biệt bằng chuyên gia hành động phù hợp dòng chảy:

- Một biến đổi hành động nhỏ đọc các trạng thái ẩn của VLM và phát ra một chuỗi hành động liên tục 50 bước thông qua dòng chảy được chỉnh sửa.
- Các bộ phận đầu hành động có sự mất mát phù hợp dòng chảy; VLM trước khi tập luyện vẫn không thay đổi.
- Tự phát: chuỗi hành động đầy đủ phát ra trong ~ 5 bước biểu thị, kiểm soát hiệu quả 50 Hz.

Đề xuất của π0: vượt qua OpenVLA và Octo trong một loạt các nhiệm vụ thao tác.

π0.5 và π0-FAST là nâng cấp theo từng bước. π0-FAST kết hợp mã hóa FAST với sự phù hợp dòng chảy.

### GR00T N1  Hệ thống kép cho người

NVIDIA's GR00T N1 (March 2025) được chế tạo cho robot nhân vật (> 30 DOF, toàn thân):

- Hệ thống 2: một cảnh đọc VLM lớn + hướng dẫn, tạo ra các mục tiêu dưới cấp cao ở ~ 1 Hz.
- Hệ thống 1: một biến đổi đầu hành động nhỏ tạo ra các lệnh liên kết 50-100 Hz cấp thấp được điều chỉnh trên các mục tiêu phụ.

Các bản đồ chia để suy nghĩ nhanh và chậm của Kahneman: Hệ thống 2 kế hoạch, Hệ thống 1 hoạt động.

GR00T N1.7 (khuyến 2025) cải thiện quy mô dữ liệu. GR00T tinh chỉnh với dữ liệu sim-to-real từ Omniverse.

### Khám X mở

Dữ liệu đào tạo. RT-X ( Tháng 10 năm 2023) đã tập hợp 22 bộ dữ liệu bao gồm 1M quỹ đạo trên 22 robot. Open X-Embodiment là bộ phận mà mọi người sử dụng:

- ALOHA / Bridge V2 / Droid / RT-2 Kitchen / Language Table.
- Mỗi mẫu: (tiếng robot, hình ảnh máy ảnh, hướng dẫn, chuỗi hành động).
- Hoán vệ sinh đào tạo: thống nhất không gian hành động, bình thường hóa phạm vi khớp, thay đổi kích thước máy ảnh.

OpenVLA và π0 đào tạo trên Open X-Embodiment. Khoảng cách miền đối với bất kỳ robot cụ thể nào được đóng bằng cách điều chỉnh tinh tế LoRA trên 100-1000 bài tập cụ thể.

### Đồng-định-thượng-được so sánh với robot-chỉ

Việc điều chỉnh đồng bộ trộn dữ liệu VQA web với quỹ đạo robot. Tỷ lệ quan trọng: quá nhiều VQA và mô hình quên hành động; quá nhiều dữ liệu robot và mô hình mất kiến thức chung.

Tỷ lệ RT-2: ~1:1. OpenVLA: ~0.5:1 web-to-robot. π0: tương tự. Tỷ lệ chính xác là một siêu tham số để điều chỉnh theo kích thước tập dữ liệu.

Việc đào tạo chỉ bằng robot tạo ra các mô hình cụ thể về nhiệm vụ không thể thực hiện theo hướng dẫn không phân phối. Co-fine-tuning là sự khác biệt giữa "tôi lấy khối đỏ (trong demo) " và "tôi lấy đối tượng lớn thứ ba từ trái (những cụm từ mới). "

### Các giới hạn an toàn và hoạt động

Mỗi tàu VLA sản xuất có:

- Giới hạn khớp cứng (không thể mô-men xoắn vượt qua thông số kỹ thuật).
- Giới hạn tốc độ (clip mềm).
- Các giới hạn không gian làm việc (tài liệu cuối không thể rời khỏi bàn).
- Kiểm duyệt người trong vòng cho các nhiệm vụ mới.

Những thứ này nằm bên ngoài VLA như kiểm tra lớp kiểm soát.

```figure
mm-action-tokens
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Thực hiện token hóa và de-tokenization hành động 256 bin.
- Dấu họa một token hóa FAST dựa trên DCT + định lượng.
- So sánh số lượng token cho mỗi bước hành động qua (discrete-bin, FAST, continuous-flow).
- Bác bản tổng kết dòng dõi của RT-2 → OpenVLA → π0 → GR00T.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-vla-action-format-picker.md`. Với một nhiệm vụ robot (chống chế, điều hướng, toàn bộ cơ thể nhân vật), chọn giữa phân khúc-bin + RT-2, FAST + OpenVLA, phù hợp dòng chảy + π0, hoặc hệ thống kép + GR00T.

## Các bài tập

1. Một cánh tay 10 DOF với tốc độ điều khiển 30 Hz. Đồ ký phân biệt-bin ở 256 thùng phát ra bao nhiêu token mỗi giây?

2. Đơn vị giao dịch nhanh nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén nén n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n n

3. Đầu phù hợp với dòng chảy của π0 bị dập tắt trong ~ 5 bước. So sánh thông qua với mã tự động của OpenVLA ở 4-5 Hz.

4. Hệ thống 1 / Hệ thống 2 của GR00T chia các bản đồ cho Kahneman. đề xuất một phân chia khác (System 3?) có thể giúp đi bộ hai chân.

5. Đọc phần 4 của Open X-Embodiment về việc bảo quản tập hợp dữ liệu.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | Model that takes image + instruction and outputs action commands |
| Action tokenization | "Discrete bins" | Quantize continuous joint targets into 256 bins per dim, each a vocab ID |
| FAST tokenizer | "Frequency action tokens" | DCT + quantize to compress 30-step trajectories to ~10 tokens |
| Co-fine-tune | "Mix web + robot" | Train on web VQA data alongside robot demos to preserve general knowledge |
| Flow-matching action head | "π0 continuous output" | Small transformer that outputs a 50-step action sequence via rectified flow |
| System 1 / System 2 | "Dual-system control" | Large VLM plans slowly, small action head acts quickly; GR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset; the training corpus |

## Đọc thêm

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
