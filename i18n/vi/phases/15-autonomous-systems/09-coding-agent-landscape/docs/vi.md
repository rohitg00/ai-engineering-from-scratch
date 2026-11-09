# Tâm cảnh của các tác nhân lập trình tự trị (2026)

> SWE-bench Verified đã tăng từ 4% lên 80,9% trong vòng chưa đầy ba năm. Cùng Claude Sonnet 4.5 ghi 43,2% trên SWE-agent v1 và 59,8% trên Cline tự động OpenHands (trước đây là OpenDevin) là nền tảng được cấp phép MIT hoạt động nhất và vòng lặp CodeAct của nó thực hiện các hành động Python trực tiếp trong một hộp cát thay vì các cuộc gọi công cụ JSON. Các số tiêu đề che giấu một vấn đề về phương pháp: 161 trong số 500 nhiệm vụ SWE-bench Verified chỉ yêu cầu thay đổi đường dây 12, và SWE-bench Pro (10 nhiệm vụ đường dây) nằm ở mức 2359% cho các mô hình biên giới tương tự.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## Vấn đề

"Đại diện lập trình nào là tốt nhất" là câu hỏi sai lầm. Câu hỏi đúng là: trên một phân phối nhiệm vụ phù hợp với công việc của tôi, với các giàn khoan tôi sẽ chạy trong sản xuất, tôi có được độ tin cậy cuối đến cuối như thế nào?

Giữa năm 2022 và 2026, lĩnh vực này đã học được rằng sàn nhà  lớp lấy lại, lập kế hoạch, hộp cát, vòng chỉnh sửa-thêm lại, định dạng phản hồi  chịu tải. Claude Sonnet 4.5 trên SWE-agent v1 đạt điểm 43,2% trên SWE-bench Verified; cùng một mô hình bên trong giàn tay tự động của Cline đạt điểm 59,8%. 16.6 điểm khác biệt tuyệt đối, cùng trọng lượng. Mô hình cơ bản là một thành phần; vòng lặp là sản phẩm.

Vấn đề đồng hành là sự bão hòa điểm chuẩn ẩn lại sự lùi. SWE-bench Verified gần như bão hòa, và đuôi dễ làm (161 trong 500 nhiệm vụ đòi hỏi ≤ 2 dòng) kéo điểm số cao nhất lên. Chất lượng thế giới thực được đo tốt hơn trên các phân phối như SWE-bench Pro (10 + thay đổi dòng), nơi cùng một nhà lãnh đạo vẫn ngồi ở 2359%.

## Khái niệm

### SWE-bench, một đoạn

SWE-bench (Jimenez et al.) lấy các vấn đề thực của GitHub với các bản vá thực tại và yêu cầu một đại lý sản xuất một bản vá mà làm cho bộ thử nghiệm vượt qua. SWE-bench Verified (OpenAI, 2024) là một bộ phận 500 nhiệm vụ do con người điều chỉnh với các nhiệm vụ mơ hồ và bị phá vỡ được loại bỏ. SWE-bench Pro là người kế nhiệm khó khăn hơn  các nhiệm vụ đòi hỏi 10 + dòng thay đổi, nơi các đại lý biên giới hiện tại ngồi ở 2359%.

### Điều gì đường cong 2022 → 2026 thực sự cho thấy

- **2022**: các mô hình nghiên cứu ở ~ 4% trên sàn SWE thô.
- **2024**: GPT-4 + bàn phẳng kiểu Devin ở ~ 14%; SWE-agent ở ~ 12%.
- **2025**Claude 3.5/3.7 Sonnet bên trong Aider và SWE-được đẩy vào phạm vi 4055%.
- **2026**Claude Sonnet 4.5 và các đối thủ cạnh tranh biên giới ở mức 7080%+ trên SWE-bench Verified.

Sự nghiêng đến từ ba nguồn hợp chất: mô hình cơ sở tốt hơn, sàn nhà tốt hơn (CodeAct, phản xạ, vòng xác minh), và điểm tham khảo tốt hơn (Tài minh loại bỏ tiếng ồn).

### CodeAct vs JSON tool call

OpenHands (All-Hands-AI, arXiv:2407.16741, trước đây là OpenDevin) đã đặt cược kiến trúc cụ thể: thay vì mô hình phát ra các cuộc gọi công cụ JSON mà một máy chủ giải mã và thực hiện, mô hình phát ra mã Python và một hạt nhân kiểu Jupyter chạy nó trong một hộp cát.

Sự đổi mới:

- **JSON tool calls**: mỗi hành động là một lượt; dễ kiểm tra; tính kết hợp hạn chế; an toàn theo mặc định vì mỗi cuộc gọi đi qua một xác thực viên rõ ràng.
- **CodeAct**: một hành động có thể là một chương trình toàn bộ; kết hợp; yêu cầu một hộp cát cứng (OpenHands sử dụng cách ly Docker); chế độ thất bại bao gồm bất cứ điều gì thời gian chạy sandbox cho phép.

Cả hai kiến trúc đều đang được sản xuất. CodeAct chiếm ưu thế trong các nền tảng mở (OpenHands, smolagents). Các cuộc gọi công cụ JSON vẫn chiếm ưu thế trong các dịch vụ được quản lý (Anthropic Managed Agents, OpenAI Assistants) nơi nhà cung cấp kiểm soát người thực hiện.

### Các trạm trên cảnh quan năm 2026

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### Tại sao bàn phế

Một đường chạy mã hóa là một quỹ đạo đường chân trời dài (Học 1).

1. **Retrieval**Tìm ra các tệp thích hợp để đọc là nút thắt kín. ACI của SWE-agent, chỉ mục tệp của OpenHands và repo-map của Aider tất cả tấn công điều này.
2. **Verifier loop**: chạy thử nghiệm, đọc dấu vết hàng, và thử lại là một điểm delta 10+ trên ghế SWE.
3. **Failure containment**Một mô hình với và không có vòng xác minh trông giống như hai sản phẩm khác nhau.

### Sự bão hòa của điểm chuẩn và phân phối thực tế

Các tác giả OpenHands và Epoch AI đều chỉ ra rằng SWE-bench Verified có một đuôi dễ dàng: 161 trong 500 nhiệm vụ chỉ cần 12 dòng thay đổi. Điểm cao được thúc đẩy một phần bởi đuôi này. SWE-bench Pro hạn chế cho 10 + thay đổi dòng và trả lại điểm trong phạm vi 2359% ngay cả cho các hệ thống biên giới. Phân phối sản xuất của bạn gần như chắc chắn gần hơn với Pro hơn với Verified.

Sự liên quan để lựa chọn một đại lý: chạy một bộ phận giống Pro của bản bug của riêng bạn. Điểm quan trọng là điểm trên các nhiệm vụ đại diện cho những gì bạn gửi.

```figure
a5-scaffold-delta
```

## Sử dụng nó

`code/main.py`so sánh hai bàn phẳng đại lý đồ chơi trên phân phối mini-cách cố định:

1. A **JSON tool-call**một cái bàn phế liệu có thể thực hiện một hành động mỗi lần.
2. A **CodeAct**một cái bàn phẳng có thể phát ra một đoạn Python nhỏ mỗi hành động.

Cả hai đều sử dụng một "chương tự" (quyền định nghĩa) để so sánh tách ra sàn nhà từ chất lượng mô hình.

## Chuyển nó

`outputs/skill-scaffold-audit.md`giúp bạn kiểm tra một sàn dự kiến của các bộ phận lập trình trước khi được chấp nhận: chất lượng thu thập, sự hiện diện của các xác minh viên, cách ly hộp cát và phù hợp với phân phối điểm chuẩn.

## Các bài tập

1. Đi chạy`code/main.py`Mỗi bàn gác có bao nhiêu lượt đi trong cùng một tập nhiệm vụ?

2. Đọc bài báo OpenHands (arXiv:2407.16741). Bài báo cho rằng CodeAct vượt qua các cuộc gọi công cụ JSON trong các nhiệm vụ phức tạp.

3. Chọn một nhiệm vụ từ backlog lỗi của bạn mà sẽ yêu cầu 10 + dòng thay đổi trên hai tệp. ước tính xác suất thành công kết thúc đến kết thúc cho một mô hình biên giới dưới (a) JSON tool calls và (b) CodeAct. Định lý khoảng cách.

4. SWE-bench Verified có 161 task đơn, 12 dòng.

5. Đọc "Tạo SWE-bench Verified" (OpenAI). Giải thích phương pháp cụ thể được sử dụng để loại bỏ các nhiệm vụ mơ hồ, và đặt tên một danh mục mà người quản lý sẽ bỏ lỡ.

## Các điều khoản chính

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## Đọc thêm

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) chỉ số chuẩn và phương pháp ban đầu.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) cách xây dựng bộ phụ được sắp xếp.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) Kiến trúc CodeAct và thiết kế dòng sự kiện.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) Điểm số được theo dõi trực tiếp.
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) khung độ tin cậy của các tác nhân mã hóa đường chân trời dài.
