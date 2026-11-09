# Tầm nhìn nền tảng kinh tế  pháo hoa, cùng nhau, Baseten, Modal, sao chép, bất kỳ quy mô

> Thị trường suy luận năm 2026 không còn là thuê thời gian GPU nữa. Nó phân chia thành silic tùy chỉnh (Groq, Cerebras, SambaNova), nền tảng GPU (Baseten, Together, Fireworks, Modal), và thị trường đầu tiên của API (Replicate, DeepInfra).$1/hr per GPU on May 1, 2026, and $Giá trị 4B trên 10T + token/ngày cho bạn biết mô hình vận hành dựa trên khối lượng.$300M Series E at $Quy tắc định vị trí cạnh tranh là đơn giản: pháo hoa tối ưu hóa độ trễ, cùng nhau tối ưu hóa chiều rộng danh mục, Baseten tối ưu hóa tinh hoa doanh nghiệp, Modal tối ưu hóa Python-native DX, Tái tạo tối ưu hóa đa phương tiện tiếp cận, Anyscale tối ưu hóa phân phối Python. Bài học này cung cấp cho bạn một matrix bạn có thể trao cho một người sáng lập.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy per-call economics comparator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nêu tên ba phân khúc thị trường (silicon tùy chỉnh, nền tảng GPU, API-first) và lập bản đồ cho mỗi nhà cung cấp cho một phân khúc.
- Giải thích tại sao mô hình định giá API "cho mỗi token" bị nén về đường cong chi phí của động cơ phục vụ, chứ không phải của phần cứng.
- Xét chi phí hiệu quả trên mỗi yêu cầu trên ít nhất ba nhà cung cấp và giải thích khi nào mỗi phút (Baseten, Modal) đánh bại mỗi token.
- Xác định nền tảng nào là mặc định phù hợp cho một khối lượng công việc nhất định (bùng nổ không máy chủ, hiệu suất cao ổn định, các biến thể được điều chỉnh tốt, đa phương thức).

## Vấn đề

Bạn đã đánh giá các nền tảng siêu quy mô quản lý. Bạn quyết định bạn cần một nhà cung cấp hẹp hơn, nhanh hơn  pháo hoa cho độ trễ, cùng với nhau cho chiều rộng, Baseten cho một mô hình tùy chỉnh tinh chỉnh. Bây giờ bạn có sáu lựa chọn thực và các trang giá cả không xếp hàng. pháo hoa hiển thị $/M tokens; Baseten shows $/minute; Modal show $/second; Replicate shows $Bạn không thể so sánh chúng trực tiếp mà không mô hình hóa khối lượng công việc.

Tệ hơn, mô hình kinh doanh đằng sau mỗi trang định giá khác nhau. Fireworks chạy động cơ tùy chỉnh của riêng mình (FireAttention) trên GPU chia sẻ; tỷ lệ mỗi token phản ánh đường cong sử dụng của chúng. Baseten cung cấp cho bạn Truss + GPU chuyên dụng; mỗi phút phản ánh sự độc quyền. Modal là Python không máy chủ thực sự  tính phí mỗi giây với khởi đầu lạnh dưới giây. Khả năng đầu ra tương tự (một phản ứng LLM), ba chức năng chi phí khác nhau.

Bài học này mô hình 6 người và cho bạn biết mỗi người thắng.

## Khái niệm

### Ba phần

**Custom silicon** Groq (LPU), Cerebras (WSE), SambaNova (RDU). Thông thường decode nhanh hơn 5-10 lần so với một cluster dựa trên GPU trên cùng một mô hình. Giá cao hơn mỗi token (Groq là ~ $ 0,99 / M trên Llama-70B cuối năm 2025) nhưng không thể đánh bại cho các trường hợp sử dụng nhạy cảm với độ trễ. Groq là lựa chọn sản xuất cho các đại lý giọng nói và dịch thuật thời gian thực.

**GPU platforms** Baseten, Together, Fireworks, Modal, Anyscale. chạy trên NVIDIA (H100, H200, B200 vào năm 2026) hoặc đôi khi AMD.

**API-first marketplaces** Tái tạo, DeepInfra, OpenRouter, Fal. danh mục rộng, trả tiền dự đoán hoặc trả tiền mỗi giây, nhấn mạnh thời gian gọi đầu tiên.

### pháo hoa  nền tảng GPU tối ưu hóa độ trễ

- Engine FireAttention (custom); được bán với độ trễ thấp hơn vLLM 4 lần trên các cấu hình tương đương.
- Lớp hàng ở mức ~ 50% không có máy chủ để tải trọng công việc không tương tác.
- Mô hình được điều chỉnh tốt phục vụ với tốc độ tương tự như mô hình cơ bản  một sự khác biệt thực sự so với các nhà cung cấp tính phí cao cho LoRA của bạn.
- Giữa năm 2026: tăng giá thuê GPU theo yêu cầu 1 đô la một giờ có hiệu lực vào ngày 1 tháng 5 năm 2026.
- Tiếp theo, chỉ số này sẽ được tăng thêm một lần.

### Cùng nhau  tối ưu hóa chiều rộng

- 200+ mô hình bao gồm các bản phát hành nguồn mở trong vòng vài ngày kể từ khi xuất bản.
- 50-70% rẻ hơn so với Replicate trên các mô hình LLM tương đương  vị trí "AI Native Cloud" là khối lượng và danh mục.
- Thuyết định + điều chỉnh tinh tế + đào tạo trong một API.

### Baseten  tối ưu hóa doanh nghiệp-phô-liên

- Truss framework: mẫu gói với phụ thuộc, bí mật, phục vụ config trong một biểu đồ.
- GPU từ T4 đến B200, tính phí mỗi phút với giảm thiểu hiệu suất khởi động lạnh hợp lý.
- SOC 2 loại II, HIPAA sẵn sàng.
- $5B valuation, January 2026 Series E ($300M từ CapitalG, IVP, NVIDIA).

### Modal  Python-native-optimized

- Infrastructure-as-code trong Python thuần túy.`@modal.function(gpu="A100")`và triển khai với một lệnh.
- Đánh giá mỗi giây. Mạnh bắt đầu 2-4s với quá trình nóng trước; <1s cho các mô hình nhỏ.
- $87M Series B at $1.1B đánh giá (2025). Điểm số kinh nghiệm phát triển mạnh nhất trong các cuộc khảo sát độc lập.

### Tái tạo  chiều rộng đa phương thức

- Pay-per-prediction, nền tảng mặc định cho hình ảnh, video và âm thanh.
- Hệ sinh thái tích hợp (Zapier, Vercel, plugin CMS).
- Thêm cạnh tranh trên LLM mỗi tỷ lệ token nhưng thắng trên đa phương thức đa phương thức.

### Anyscale  Ray-native

- Được xây dựng trên Ray; RayTurbo là động cơ suy luận độc quyền của Anyscale (cạnh tranh với vLLM).
- Tốt nhất cho khối lượng công việc Python phân tán nơi bước suy luận là một nút trong biểu đồ lớn hơn.
- Quản lý các cluster Ray; tích hợp chặt chẽ với Ray AIR và Ray Serve.

### Per-token vs per-minute  khi mỗi người thắng

Per-token có ý nghĩa khi khối lượng công việc không nhạy cảm với độ trễ và bùng nổ  bạn chỉ trả tiền cho những gì bạn sử dụng. Per-minute có ý nghĩa khi sử dụng cao và dự đoán được  bạn đánh bại per-token khi bạn bão hòa GPU.

Quy tắc thô lỗ: đối với tải trọng công việc trên ~ 30% sử dụng liên tục của một GPU chuyên dụng, mỗi phút (Baseten, Modal) bắt đầu đánh bại mỗi mã thông báo (Fireworks, Together).

### Động cơ tùy chỉnh là cái hào thật sự

Mỗi nền tảng trên vLLM và SGLang tuyên bố một động cơ tùy chỉnh. FireAttention, RayTurbo, bộ đống suy luận của Baseten.

### Những con số mà bạn nên nhớ

- Thuê GPU pháo hoa: $1/h tăng hiệu lực ngày 1 tháng 5 năm 2026.
- Tầm pháo hoa: độ trễ thấp hơn vLLM 4 lần trên các cấu hình tương đương.
- Cùng nhau: 50-70% rẻ hơn so với Replicate trên LLM.
- Đánh giá cơ bản: $5B (Series E, Jan 2026, $300m vòng).
- Đánh giá vốn: $1.1B (Series B, 2025).
- Per-minute beats per token trên ~ 30% sử dụng bền vững.

```figure
cost-per-token
```

## Sử dụng nó

`code/main.py`so sánh sáu nhà cung cấp trên một khối lượng công việc tổng hợp trên các mô hình định giá.$/day and effective $- Đơn vị M. Hãy chạy nó để tìm sự đồng bằng giữa mỗi mã và mỗi phút.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-inference-platform-picker.md`. Với hồ sơ tải trọng công việc, SLA và ngân sách, chọn nền tảng suy luận chính và đặt tên cho người đứng thứ hai.

## Các bài tập

1. Đi chạy`code/main.py`Baseten (per-minute) đánh bại Fireworks (per-token) cho một mô hình 70B trên một H100?
2. Sản phẩm của bạn phục vụ việc tạo hình ảnh cộng với trò chuyện cộng với nói chuyện văn bản. Chọn nền tảng cho mỗi phương thức và đặt tên mô hình cửa ngõ thống nhất chúng.
3. Những pháo hoa làm tăng giá một đô la một giờ trên mô hình chính của bạn. mô hình tác động chi phí hỗn hợp nếu 40% lưu lượng truy cập của bạn chuyển sang cấp hàng (50% giảm).
4. Một khách hàng được quy định yêu cầu các GPU chuyên dụng SOC 2 Type II + HIPAA +. Ba nền tảng nào có thể thực hiện được và một trong số đó chiến thắng trên FinOps?
5. So sánh chi phí cho mỗi 1.000 dự đoán cho Llama 3.1 70B trên Fireworks serverless, Together on demand, Baseten chuyên dụng, và Replicate API.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Custom silicon | "non-GPU chips" | Groq LPU, Cerebras WSE, SambaNova RDU — optimized for decode |
| FireAttention | "Fireworks engine" | Custom attention kernel; marketed at 4x lower latency than vLLM |
| Truss | "Baseten's format" | Model packaging manifest; dependencies + secrets + serving config |
| Per-token | "API pricing" | Charge by tokens consumed; pay for no idle |
| Per-minute | "dedicated pricing" | Charge by wall-clock GPU time; wins at high utilization |
| Per-prediction | "Replicate pricing" | Charge per model invocation; common for image/video |
| RayTurbo | "Anyscale engine" | Proprietary inference on Ray; competes with vLLM on Ray clusters |
| Batch tier | "50% off" | Non-interactive queue at reduced rate; common on Fireworks, OpenAI |
| Fine-tuned at base rate | "Fireworks LoRA" | Charge LoRA-served requests at base model's rate (differentiator) |

## Đọc thêm

- [Fireworks Pricing](https://fireworks.ai/pricing) Giá mỗi token, cấp hàng, thuê GPU.
- [Baseten Pricing](https://www.baseten.co/pricing/) Tỷ lệ mỗi phút, năng lực cam kết, cấp độ doanh nghiệp.
- [Modal Pricing](https://modal.com/pricing) tốc độ GPU mỗi giây và cấp độ miễn phí.
- [Together AI Pricing](https://www.together.ai/pricing) danh mục mô hình và giá mỗi token.
- [Anyscale Pricing](https://www.anyscale.com/pricing) RayTurbo và quản lý giá Ray.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) đánh giá so sánh.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) Vị cảnh nhà cung cấp.
