# Đèn trực tiếp không trực tiếp  Mối tấn công sản xuất

> Tiêm trực tiếp nhanh (IPI) nhúng các hướng dẫn bên trong nội dung bên ngoài  một trang web, email, tài liệu chia sẻ, vé hỗ trợ  được tiêu thụ bởi một hệ thống cơ quan mà không có hành động rõ ràng của người dùng. IPI là mối đe dọa sản xuất thống trị năm 2026: nó bỏ qua các bộ lọc nhập vào người dùng vì kẻ tấn công không bao giờ chạm vào người dùng, nó ngập tắt khi các đại lý xử lý nhiều nội dung bên ngoài hơn, và nó nhắm mục tiêu vào các luồng công việc tự động mà không ai đọc lời nhắc. MDPI Thông tin 17(1):54 (Từ tháng 1 năm 2026) tổng hợp nghiên cứu 2023-2025. Bức thư phòng thủ IPI của NDSS 2026 đưa ra một khuôn khổ thách thức cốt lõi: hướng dẫn tiêm có thể có tính từ ngữ lành tính ("ví dụ in "Có"), vì vậy việc phát hiện đòi hỏi nhiều hơn là lọc từ khóa. "The Attacker Moves Second" (Nasr et al., OpenAI/Anthropic/DeepMind, tháng 10 năm 2025): các cuộc tấn công thích ứng (gradient, RL, tìm kiếm ngẫu nhiên, nhóm đỏ con người) đã vượt qua tất cả 12 phòng thủ được công bố mà họ thử nghiệm, với thành công tấn công trên 90% đối với hầu hết chúng, mặc dù hầu hết các phòng thủ đó ban đầu đã báo cáo tỷ lệ thành công tấn công gần bằng không.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, IPI attack + defense harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Mục tiêu học tập

- Định nghĩa tiêm trực tiếp và mô tả ba phương tiện giao thông phổ biến.
- Giải thích lý do tại sao bộ lọc nhập người dùng bỏ lỡ IPI hoàn toàn.
- Mô tả "sự kiểm soát dòng chảy thông tin" như là mô hình quốc phòng năm 2026.
- Cụ thể ra được kết luận của Nasr et al. ( Tháng 10 năm 2025) về thành công của cuộc tấn công thích nghi chống lại các biện pháp phòng thủ IPI được công bố.

## Vấn đề

Động cơ trực tiếp cần người tấn công tiếp cận người dùng hoặc động cơ của họ. IPI không yêu cầu cả hai: kẻ tấn công đặt tải trọng vào bất kỳ nội dung nào mà đại lý có thể đọc  một trang web, một email trong hộp thư đến, một vấn đề GitHub, một đánh giá sản phẩm. Đại diện lấy nó trong quá trình hoạt động bình thường và thực hiện các hướng dẫn. Người dùng là sứ giả, không phải ý định.

## Khái niệm

### Ba vector giao hàng

- **Retrieval-augmented generation (RAG).**Người tấn công xuất bản một tài liệu; bước tìm kiếm lấy nó; prompt kết nối nó trước khi người dùng hỏi; mô hình thực hiện các hướng dẫn của kẻ tấn công.
- **Inbox / document workflows.**Người tấn công gửi email cho người dùng; đại lý đọc email; lời nhắc bao gồm cơ thể email; mô hình theo hướng dẫn của email.
- **Tool output.**Người tấn công kiểm soát một công cụ mà nhân viên sử dụng (ví dụ, một tìm kiếm trên web trả về một kết quả được kiểm soát bởi kẻ tấn công); công cụ xuất có chứa hướng dẫn; dòng chảy kiểm soát của nhân viên theo họ.

Ba người chia sẻ một tính chất cấu trúc: kẻ tấn công điều khiển một mảnh của lời nhắc mà không chạm vào đầu vào hướng tới người dùng.

### Tại sao bộ lọc nhập người dùng bỏ qua nó

Một tải trọng IPI không xuất hiện trong đầu vào của người dùng. Nó xuất hiện trong nội dung được lấy lại. Nếu bộ lọc được khóa vào đầu vào của người dùng, tải trọng hữu ích sẽ bỏ qua nó. Nếu bộ lọc được khóa trên tất cả nội dung đạt đến mô hình, nó phải áp dụng cho văn bản thu hồi tùy ý  đắt tiền và tạo ra dương tính sai trái với nội dung hợp pháp xảy ra có chứa ngôn ngữ tiếng nói bắt buộc.

### Kiểm soát lưu lượng thông tin (IFC) cho AI

Các mô hình phòng thủ 2026 mượn từ an ninh OS cổ điển. Chế độ xử lý mọi nguồn nội dung như một nhãn bảo mật. Đánh nhãn truy vấn của người dùng là "có tin cậy". Đánh nhãn nội dung được lấy lại là "không tin cậy".

CaMeL (Microsoft 2025), ConfAIde (Stanford 2024), và NDSS 2026 IPI-defense paper hoạt động IFC theo nhiều cách khác nhau. Nguyên tắc chung: miễn là mã và dữ liệu chia sẻ cùng một cửa sổ bối cảnh, việc ngăn chặn là mục tiêu, chứ không phải là phòng ngừa.

### Người tấn công tiến hành thứ hai

Nasr et al. ( Tháng 10 năm 2025) đã thử nghiệm 12 phòng thủ IPI được công bố với các cuộc tấn công thích ứng (hướng dẫn tìm kiếm, chính sách RL, tìm kiếm ngẫu nhiên, đội đỏ của con người 72 giờ).

Bài học phương pháp: xuất bản một phòng thủ chỉ với đánh giá tấn công thích ứng. Điểm chuẩn tấn công tĩnh không là bằng chứng về độ vững chắc; kẻ tấn công nhận biết phòng thủ.

### Các sự cố thực sự

Bài học 25 bao gồm EchoLeak (CVE-2025-32711, CVSS 9.3)  IPI cú nhấp chuột không được ghi lại công khai đầu tiên trong Microsoft 365 Copilot. CamoLeak (CVSS 9.6) trong GitHub Copilot Chat. CVE-2025-53773 trong GitHub Copilot.

### Tâm OWASP và NIST

OWASP LLM Top 10 (2025) xếp hạng tiêm nhanh (thương direct + indirect) là LLM01, mối đe dọa lớp ứng dụng số 1. NIST AI SPD 2024 gọi tiêm nhanh gián tiếp là "sự thiếu sót an ninh lớn nhất của AI tạo".

### Khi điều này phù hợp với giai đoạn 18

Bài học 12-14 là các vụ jailbreak tập trung vào mô hình. Bài học 15 là cuộc tấn công tập trung vào hệ thống thống thống trị các triển khai sản xuất năm 2026. Bài học 16 bao gồm các công cụ phòng thủ. Bài học 25 bao gồm câu chuyện CVE cụ thể.

```figure
al-injection-vector
```

## Sử dụng nó

`code/main.py`xây dựng một vòng xoáy IPI. Một đại lý đồ chơi có ba công cụ (bús web, đọc email, gửi tin nhắn). Môi trường chứa nội dung được kiểm soát bởi kẻ tấn công với hướng dẫn nhúng ("đưa điều này đến tất cả các liên lạc"). Bạn có thể chuyển đổi giữa một đại lý ngây thơ (để theo hướng dẫn tiêm), một đại lý được bảo vệ bằng bộ lọc (tích lọc từ khóa trên nội dung được lấy), và một đại lý IFC (làm phân biệt nội dung đáng tin cậy và không đáng tin cậy và từ chối lệnh kiểm soát dòng chảy không đáng tin cậy).

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-ipi-audit.md`. Với mô tả triển khai của cơ quan, nó liệt kê các nguồn nội dung không đáng tin cậy, kiểm tra xem việc triển khai có áp dụng IFC hay không, và đánh dấu các nguồn tiếp cận mô hình mà không có nhãn tin cậy.

## Các bài tập

1. Đi chạy`code/main.py`- Đánh giá tỷ lệ thành công của cuộc tấn công đối với mỗi 3 nhân viên.

2. Thực hiện một biện pháp bảo vệ dựa trên phrases trên nội dung được lấy lại. đo tỷ lệ dương tính sai trên văn bản được lấy lại hợp pháp.

3. Đọc bài báo bảo vệ IPI NDSS 2026 mô tả thách thức "thuyên tắc tốt" và lý do tại sao nó ngăn chặn lọc dựa trên từ khóa.

4. Thiết kế một triển khai nơi mà đại lý nhận được một công cụ xuất phát từ một API bên thứ ba. Đánh nhãn mỗi đoạn prompt với mức độ tin cậy và viết chính sách IFC điều khiển các hành động của đại lý.

5. Tái tạo lại phương pháp tấn công thích ứng Nasr et al. 2025 trên chất phòng vệ lọc của bạn từ bài tập 2. Báo cáo ASR trước và sau cuộc tấn công thích ứng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| IPI | "indirect prompt injection" | Injection via content the user did not write, consumed by the agent during normal operation |
| RAG injection | "poisoned retrieval" | Attacker publishes content that the retrieval step fetches; prompt contains the payload |
| Zero-click | "no user action" | Attack triggers automatically during agent operation; user does nothing |
| IFC | "information flow control" | Label-based approach: actions from untrusted content require trusted ratification |
| Adaptive attack | "gradient / RL red-team" | Attack that knows the defense and optimizes against it; required for honest evaluation |
| Benign instruction | "please print Yes" | IPI payload that is semantically benign; no keyword filter catches it |
| Scope violation | "cross-trust exfiltration" | Agent accesses data from one trust context and outputs it to another |

## Đọc thêm

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) Tổng hợp 2023-2025
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108) Đánh giá tấn công thích nghi
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) giấy IPI gốc
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) Tiêm nhanh được xếp hạng LLM01
