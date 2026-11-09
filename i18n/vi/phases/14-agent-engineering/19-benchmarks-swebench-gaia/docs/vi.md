# Các điểm chuẩn: SWE-bench, GAIA, AgentBench

> Ba điểm chuẩn đánh giá các đại lý neo vào năm 2026. SWE-bench kiểm tra mã patching. GAIA kiểm tra việc sử dụng công cụ tổng quát. AgentBench kiểm tra lý luận đa môi trường. Biết thành phần của chúng, lịch sử ô nhiễm của chúng và những gì chúng không đo.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## Mục tiêu học tập

- Tên gọi dây thừng thử nghiệm của SWE-bench (FAIL_TO_PASS) và giải thích lý do tại sao nó không được kiểm tra đơn vị.
- Giải thích lý do tại sao SWE-bench Verified (OpenAI, 500 nhiệm vụ) tồn tại và nó loại bỏ những gì.
- Mô tả thiết kế của GAIA: đơn giản cho con người, khó khăn cho AI; ba mức độ khó khăn.
- Tên tám môi trường của AgentBench và ngăn chặn chính của nó cho mã nguồn mở LLM.
- Kết luận về kết quả nhiễm SWE-bench+ và những tác động của nó.

## Vấn đề

Các bảng xếp hạng cho bạn biết mô hình nào thắng trên một điểm chuẩn.

- Nếu chỉ số chuẩn bị bị ô nhiễm (solution trong dữ liệu đào tạo, rò rỉ thử nghiệm).
- Nếu chỉ số chuẩn đo lường những gì bạn quan tâm (định nghĩa so với duyệt web so với tổng thể).
- Liệu người đánh giá có mạnh mẽ hay không (sự phù hợp của AST, kiểm tra nhà nước, đánh giá của con người).

Biết ba điểm chuẩn neo và các chế độ thất bại của chúng trước khi bạn trích dẫn một số.

## Khái niệm

### SWE-bench (Jimenez et al., ICLR 2024 uống)

- 2.294 lỗi GitHub thực sự từ 12 bộ nhớ Python phổ biến.
- Trình tác viên nhận: cơ sở mã tại commit trước + mô tả vấn đề ngôn ngữ tự nhiên.
- Thuộc nhân sản xuất: một vá.
- Thử nghiệm: áp dụng bản vá, chạy bộ thử nghiệm của repo. Bản vá phải lật lại các thử nghiệm FAIL_TO_PASS (trước đây thất bại, bây giờ vượt qua) mà không phá vỡ các thử nghiệm PASS_TO_PASS.

SWE-agent (Yang et al., 2024) đạt 12,5% khi phát hành bằng cách nhấn mạnh giao diện đại lý- máy tính (pháp lệnh biên tập tập tệp, tổng hợp tìm kiếm mô hình hiểu).

### SWE-bench Verified

OpenAI, tháng 8 năm 2024. Bộ phận 500 nhiệm vụ do con người điều chỉnh. loại bỏ các vấn đề mơ hồ, thử nghiệm không đáng tin cậy và nhiệm vụ mà sự khắc phục không rõ ràng. Điểm chuẩn chính cho "có đại lý của bạn gửi các bản vá thực sự không?"

### Ô nhiễm

- Hơn 94% các vấn đề của SWE ban trước hầu hết các model cắt giảm.
- **SWE-bench+**thấy 32,67% các bản vá thành công đã rò rỉ các giải pháp trong văn bản vấn đề (chương tự đã thấy sự sửa chữa trong mô tả), và 31,08% là đáng ngờ do bảo hiểm thử nghiệm kém.
- Được xác minh sạch hơn nhưng không bị ô nhiễm.

Hướng dẫn thực tế: mô hình có điểm 50% trên SWE-bench có thể đạt điểm 35% trên SWE-bench+. Luôn báo cáo cả hai nếu bạn tuyên bố hiệu suất SWE-bench.

### GAIA (Mialon et al., Nov 2023)

- 466 câu hỏi; 300 được giữ lại cho bảng xếp hạng tư nhân tại huggingface.co/gaia-benchmark.
- Triết lý thiết kế: "từ quan điểm đơn giản cho con người (92%) nhưng khó khăn cho AI (GPT-4 với plugin: 15%). "
- Thử lý lý luận, đa phương pháp, web, sử dụng công cụ.
- Ba mức độ khó khăn; cấp độ 3 đòi hỏi chuỗi công cụ dài trên các phương pháp.

GAIA là những gì bạn chạy để đo "capacity tổng quát". Đừng nhầm lẫn với các chuẩn mực cụ thể về mã.

### AgentBench (Liu et al., ICLR 2024)

- 8 môi trường trên mã (Bash, DB, KG), trò chơi (Alfworld, LTP), web (WebShop, Mind2Web), và thế hệ mở.
- Nhiều vòng quay, khoảng 4k-13k vòng quay mỗi chia.
- Kết quả chính: lý luận dài hạn, ra quyết định và hướng dẫn sau đây là những rào cản cho các LLM OSS bắt kịp thương mại.

### Những gì chúng không đo

- Chi phí hoạt động trong thế giới thực (tokens, wall-clock).
- Hành vi an toàn trong điều kiện đối kháng.
- Hiệu suất trên miền của bạn ( Sử dụng đánh giá của riêng bạn, Bài học 30).
- Các lỗi đuôi (tỷ lệ chuẩn trung bình; các nhà khai thác sản xuất quan tâm đến 1% tồi tệ nhất).

### Khi đánh giá so sánh đi sai

- **Single-number fixation.**SWE-bench 50% cho bạn biết ít hơn chi phí P50/P75/P95 + phân phối bước.
- **Contaminated claims.**Báo cáo SWE-bench mà không đề cập đến Verified hoặc SWE-bench+ là sai lầm.
- **Benchmark-as-development-target.**Việc tối ưu hóa cho chỉ số chuẩn khác với lợi ích sản xuất.

```figure
ae-swebench-gate
```

## Hãy xây dựng nó

`code/main.py`thiết lập một dây thắt toy SWE-bench-like:

- Nhiệm vụ sửa lỗi tổng hợp (3 nhiệm vụ).
- Một "hội nhân" có kịch bản đề xuất các bản vá.
- Một người chạy thử nghiệm kiểm tra FAIL_TO_PASS (thói lỗi đã được sửa chữa) và PASS_TO_PASS (không có gì bị hỏng).
- Một phân loại khó khăn theo kiểu GAIA dựa trên độ sâu phân hủy câu hỏi.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả xuất hiện cho thấy tỷ lệ giải pháp cho mỗi nhiệm vụ + cho mỗi khó khăn và làm cho các quy tắc đánh giá cụ thể.

## Sử dụng nó

- **SWE-bench Verified**luôn báo cáo điểm xác minh.
- **GAIA**dùng phân chia bảng xếp hạng tư nhân.
- **AgentBench**cho so sánh đa môi trường.
- **Custom evals**(Dân học 30) cho hình dạng thực tế của sản phẩm của bạn.

## Chuyển nó

`outputs/skill-benchmark-harness.md`xây dựng một vòng xoáy kiểu SWE-bench cho bất kỳ cặp công việc mã cốt lõi nào với cửa FAIL_TO_PASS / PASS_TO_PASS.

## Các bài tập

1. Đưa dây đeo đồ chơi chạy trên một repo thực sự (đưa ra một trong số của bạn).
2. Thêm một số liệu đếm từng bước. Trong 3 nhiệm vụ của bạn, bao nhiêu bước của đại lý cho mỗi giải pháp?
3. Đọc bài báo SWE-bench +. Thực hiện kiểm tra rò rỉ giải pháp (chọn mẫu phù hợp với văn bản vấn đề so với sự khác biệt).
4. Tải xuống câu hỏi của GAIA từ công chúng, theo dõi những gì một đặc vụ lớp GPT-4 sẽ làm.
5. Đọc phân tích môi trường của AgentBench. Môi trường nào phản ánh bề mặt sản phẩm của bạn?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SWE-bench | "Code agent benchmark" | 2,294 GitHub issues; patch must flip FAIL_TO_PASS tests |
| SWE-bench Verified | "Clean SWE-bench" | 500 human-curated tasks, OpenAI |
| FAIL_TO_PASS | "Fix gate" | Tests previously failing that must pass after the patch |
| PASS_TO_PASS | "No-regression gate" | Tests that were passing and must still pass |
| GAIA | "Generalist benchmark" | 466 human-easy / AI-hard multi-tool questions |
| AgentBench | "Multi-env benchmark" | 8 environments; long-horizon multi-turn |
| Contamination | "Training-set leak" | Benchmark tasks present in model training |
| SWE-bench+ | "Contamination audit" | 32.67% solution leakage found in successful SWE-bench patches |

## Đọc thêm

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) chỉ số chuẩn ban đầu
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) bộ phận được chọn lọc
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) điểm chuẩn chung
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) Suite đa môi trường
