# Các nền tảng LLM được quản lý  Bedrock, Vertex AI, Azure OpenAI

> Ba siêu quy mô, ba chiến lược khác nhau. AWS Bedrock là một thị trường mô hình  Claude, Llama, Titan, ổn định, Cohere đằng sau một API. Azure OpenAI là một quan hệ đối tác OpenAI độc quyền cộng với các đơn vị thông qua được cung cấp (PTU) cho công suất chuyên dụng. Vertex AI là Gemini đầu tiên với câu chuyện dài và đa phương tiện tốt nhất. Năm 2026, Phân tích nhân tạo đo Azure OpenAI ở ~ 50 ms trung bình và Bedrock ở ~ 75 ms trên tương đương Llama 3.1 405B  PTU giải thích khoảng cách bởi vì năng lượng chuyên dụng đánh bại chia sẻ theo yêu cầu. Quy tắc quyết định không phải là "các mô hình nào nhanh nhất" mà là "mô hình nào và bề mặt FinOps phù hợp với sản phẩm của tôi". Bài học này dạy bạn chọn với các sự thỏa hiệp được ghi lại, không phải là xung.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## Mục tiêu học tập

- Hãy nêu tên ba chiến lược nền tảng (trọng trường vs độc quyền vs Gemini-lần đầu tiên) và phù hợp với từng trường hợp sử dụng sản phẩm.
- Giải thích các đơn vị thông qua được cung cấp (PTU) mua cho bạn trong Azure OpenAI và tại sao Bedrock theo yêu cầu thường đọc chậm hơn ~ 25 ms ở thang 405B.
- Chụp đồ thị bề mặt thuộc về FinOps cho mỗi nền tảng (Bedrock Application Inference Profiles vs Vertex project-per-team vs Azure scopes + PTU reservations).
- Viết ra một chính sách "mức tối thiểu hai nhà cung cấp" và giải thích tại sao khóa vào một nhà cung cấp là sai lầm đắt tiền vào năm 2026.

## Vấn đề

Bạn đã chọn Claude 3.7 Sonnet cho sản phẩm của mình. Bây giờ bạn cần phải phục vụ nó. Bạn có thể gọi API Anthropic trực tiếp, hoặc bạn có thể gọi nó thông qua AWS Bedrock, hoặc bạn có thể đi qua một cổng thông tin. API trực tiếp là đơn giản nhất; Bedrock thêm BAAs, điểm cuối VPC, IAM và CloudWatch thuộc tính. Cổng thông tin thêm failover, hóa đơn thống nhất và giới hạn tỷ lệ trên các nhà cung cấp.

Câu hỏi sâu hơn là danh mục. Nếu bạn cần Claude và Llama và Gemini trong cùng một sản phẩm, bạn không thể mua tất cả chúng từ một nơi trừ khi nơi đó là Bedrock cộng với Vertex cộng với Azure OpenAI cùng một lúc.

Bài học này mô tả ba cược, khoảng cách trễ, khoảng cách FinOps và rủi ro khóa.

## Khái niệm

### Ba chiến lược

**AWS Bedrock** thị trường. Claude (Anthropic), Llama (Meta), Titan (AWS first-party), Stability (image), Cohere (embeddings), Mistral, cộng với hình ảnh và nhúng các danh mục phụ. Một API, một bề mặt IAM, một xuất CloudWatch. Bedrock đặt cược là khách hàng muốn tùy chọn hơn họ muốn một mô hình duy nhất.

**Azure OpenAI** hợp tác độc quyền. Bạn có được GPT-4 / 4o / 5 / o-series, DALL·E, Whisper, và điều chỉnh tinh tế các mô hình OpenAI trong các trung tâm dữ liệu Azure. Không có mô hình không phải OpenAI trong danh mục "Azure OpenAI Service"  những người đi đến Azure AI Foundry (sản phẩm riêng biệt).

**Vertex AI** Gemini đầu tiên, tất cả mọi thứ khác thứ hai. Gemini 1.5 / 2.0 / 2.5 Flash và Pro, cộng với Model Garden (các bên thứ ba). Vertex đặt cược là đa phương thức ngữ cảnh dài  1M-token Gemini ngữ cảnh là sự khác biệt.

### Khoảng cách độ trễ ở quy mô

Phân tích nhân tạo chạy các điểm chuẩn liên tục. Trên các triển khai tương đương Llama 3.1 405B, độ trễ trung bình của token đầu tiên của Azure là khoảng 50 ms với PTU; Bedrock trên chia sẻ theo yêu cầu là khoảng 75 ms. Sự khác biệt không phải là sự thất bại của AWS  nó là sự khác biệt về mô hình năng lực. Azure bán PTU (Provisioned Throughput Units), dự trữ dung lượng GPU cho người thuê nhà của bạn. Đồng bằng của Bedrock (Provisioned Throughput) tồn tại nhưng bắt đầu khoảng $ 21 / giờ mỗi đơn vị, và hầu hết khách hàng vẫn ở trên chia sẻ theo yêu cầu.

Khả năng chia sẻ theo yêu cầu cạnh tranh với lưu lượng truy cập của mọi khách hàng khác. Khả năng chuyên dụng không. Nếu SLA sản phẩm của bạn là TTFT < 100 ms tại P99, bạn hoặc mua PTU trên Azure, mua Bedrock Provisioned Throughput, hoặc chấp nhận sự khác biệt mặc định.

### Kinh tế thông qua cung cấp

Azure PTU: một khối dự trữ của tính toán suy luận. Tương đương đến ~ 70% tiết kiệm so với nhu cầu cho tải trọng công việc dự đoán được. Chi phí cố định mỗi giờ bất kể lưu lượng truy cập  bạn trả tiền cho việc đặt chỗ ngay cả khi không hoạt động. Break-even thường là khoảng 40-60% sử dụng bền vững.

Tấm thông qua được cung cấp bằng giường: $21-$50/giờ tùy thuộc vào mô hình và khu vực. Phân tích tương tự  Break-even là khoảng một nửa mức sử dụng đỉnh.

Công suất cung cấp Vertex được bán cho mỗi SKU Gemini; giá thay đổi theo mô hình và khu vực và ít được quảng cáo công khai hơn.

### bề mặt FinOps  phân biệt thực tế

**Bedrock Application Inference Profiles**là tính năng sạch nhất trên thị trường.`team`- `product`- `feature`; chuyển tất cả các cuộc gọi mô hình thông qua nó; CloudWatch phá vỡ chi phí cho mỗi hồ sơ mà không cần xử lý sau.

**Vertex**bạn mô hình hóa mỗi nhóm như một dự án GCP, đặt nhãn trên mọi tài nguyên, và sử dụng BigQuery Billing Export + DataStudio cho các rollup.

**Azure**dựa trên phạm vi đăng ký / nhóm tài nguyên cộng với thẻ, với đặt phòng PTU như một đối tượng chi phí hạng nhất. Tags được thừa kế từ các nhóm tài nguyên, chứ không phải yêu cầu, vì vậy thuộc tính theo yêu cầu đòi hỏi các métrics tùy chỉnh của Application Insights hoặc một cổng để dán tiêu đề.

Mô hình: Bedrock là bản địa sạch nhất, Vertex linh hoạt nhất thông qua BigQuery, Azure là không minh bạch nhất trừ khi bạn chơi nhạc cụ.

### Khóa lại là rủi ro năm 2026

Lập kế hoạch đơn siêu quy mô là tốt khi một mô hình thống trị. Năm 2026 biên giới di chuyển hàng tháng  Claude 3.7 một quý, Gemini 2.5 tiếp theo, GPT-5 quý sau đó.

Các nhóm làm việc theo mô hình áp dụng: tối thiểu hai nhà cung cấp cho bất kỳ cuộc gọi LLM quan trọng sản phẩm nào. Bedrock cộng với Azure OpenAI là cặp chung  Claude từ một, GPT từ một, sự cố giữa hai, cùng cổng thông tin. Việc tăng chi phí là không đáng kể vì các tuyến đường cổng tối ưu; tăng khả năng sẵn có trong thời gian bị gián đoạn (như sự cố Azure OpenAI tháng 1 năm 2025, sự cố AWS us-east-1) là quyết định.

### Data residency, BAA và các ngành công nghiệp được quy định

Bedrock: BAA ở hầu hết các khu vực; điểm cuối VPC; vỉa hè.
Azure OpenAI: HIPAA, SOC 2, ISO 27001; cư trú dữ liệu EU; mặc định do doanh nghiệp quy định.
Vertex: HIPAA, GDPR, cư trú dữ liệu theo khu vực; Google Cloud's compliance stack.

Tất cả ba đều đáp ứng các hộp kiểm cơ bản. Sự khác biệt là các chính sách lưu trữ dữ liệu, cách xử lý nhật ký, và liệu giám sát lạm dụng có đọc lưu lượng truy cập của bạn (đưa chọn mặc định trên hầu hết; chọn bỏ sẵn cho doanh nghiệp).

### Những con số mà bạn nên nhớ

- TTFT trung bình của Azure OpenAI trên tương đương Llama 3.1 405B: ~ 50 ms (với PTU).
- TTFT trung bình trên nhu cầu: ~ 75 ms.
- Tấm thông qua được cung cấp bằng giường: $21-$50/h/ đơn vị.
- Azure PTU Break-Even: ~ 40-60% sử dụng bền vững.
- Tiết kiệm PTU so với nhu cầu khi sử dụng cao: lên đến 70%.

```figure
i4-platform-lanes
```

## Sử dụng nó

`code/main.py`So sánh ba nền tảng trên một khối lượng công việc tổng hợp  nó mô hình về kinh tế theo yêu cầu so với PTU, sự khác biệt TTFT và độ trung thành quy định chi phí.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-managed-platform-picker.md`. Với một hồ sơ tải trọng công việc (mô hình cần thiết, TTFT SLA, khối lượng hàng ngày, yêu cầu tuân thủ), nó khuyên nên một nền tảng chính, một sự suy giảm và một kế hoạch dụng cụ FinOps.

## Các bài tập

1. Đi chạy`code/main.py`- Azure PTU vượt qua theo yêu cầu cho một mô hình lớp 70B ở mức sử dụng bền vững nào?
2. Sản phẩm của bạn cần Claude 3.7 Sonnet và GPT-4o. Thiết kế một triển khai hai nhà cung cấp  đi đến hypercaler nào, cửa cổng nào ở phía trước, chính sách lỗi là gì?
3. Một khách hàng chăm sóc sức khỏe được quy định yêu cầu BAA, cư trú dữ liệu Đông Mỹ và sub-100ms P99 TTFT. Chọn một nền tảng và biện minh với ba tính năng cụ thể.
4. Nếu không có hồ sơ thông tin, làm thế nào bạn sẽ tìm ra kẻ phạm tội?
5. Đọc trang giá của Anthropic API và Bedrock. Đối với khối lượng công việc Claude 100M-token / tháng, rẻ hơn  trực tiếp Anthropic API, Bedrock theo yêu cầu, hoặc Bedrock Provisioned Throughput?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Bedrock | "AWS LLM service" | Model marketplace across Claude, Llama, Titan, Mistral, Cohere |
| Azure OpenAI | "Azure's ChatGPT" | Exclusive OpenAI models in Azure datacenters with enterprise controls |
| Vertex AI | "Google's LLM" | Gemini-first platform with Model Garden for third-party models |
| PTU | "dedicated capacity" | Provisioned Throughput Unit — reserved inference GPUs, priced per hour |
| Application Inference Profile | "Bedrock tagging" | Per-product cost/usage profile with tags, CloudWatch-native |
| Model Garden | "Vertex catalog" | Vertex AI's third-party model section, separate from Gemini |
| Two-provider minimum | "LLM redundancy" | Policy of running every critical LLM path across ≥2 hyperscalers |
| BAA | "HIPAA paperwork" | Business Associate Agreement; required for PHI; provided by all three |
| Abuse monitoring | "the log watcher" | Provider-side safety scan on prompts/outputs; opt-out in enterprise |

## Đọc thêm

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) thẻ giá trị chính đáng và giá cả thông qua được cung cấp.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) Kinh tế và thẻ lãi suất của PTU.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) Đứa đôi và Model Garden phụ phí.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) Các điểm chuẩn thời gian trễ và thông qua liên tục trên các nhà cung cấp.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) Quản lý quyết định của doanh nghiệp.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) cơ học phân bổ bên cạnh nhau.
