# Cảnh sát Langfuse, Phoenix, Opik

> Ba nền tảng quan sát nhân vật tự lưu trữ thống trị năm 2026. Langfuse (MIT)  6M+ cài đặt / tháng, theo dõi + quản lý nhanh chóng + đánh giá + phiên bản lặp lại. Arize Phoenix (Elastic 2.0)  đánh giá chuyên sâu cụ thể đối với nhân vật, sự liên quan RAG, OpenInference tự động dụng cụ. Comet Opik (Apache 2.0)  tối ưu hóa nhanh chóng tự động, guardrails, phát hiện ảo giác của thẩm phán LLM.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## Mục tiêu học tập

- Hãy cho tên ba nền tảng quan sát được thực hiện tự chủ và giấy phép của họ, và nói giấy phép nào không phải là nguồn mở OSI.
- Nhận ra những gì mỗi người là mạnh nhất: Langfuse (giữa họp mgmt + nhanh), Phoenix (RAG + tự động dụng cụ), Opik (tích cực + guardrails).
- Giải thích tại sao 89% các tổ chức báo cáo có khả năng quan sát các chất tác nhân vào năm 2026.
- Thực hiện một đường ống dẫn trace-to-dashboard với đánh giá của thẩm phán LLM.

## Vấn đề

OTel GenAI (Dạy 23) cung cấp cho bạn sơ đồ. Bạn vẫn cần nền tảng hấp thụ khoảng thời gian, chạy đánh giá, lưu trữ phiên bản nhanh và làm trượt các sự lùi. Ba đối thủ đều nhấn mạnh các phần khác nhau của chu kỳ cuộc sống.

## Khái niệm

### Langfuse (MIT)

- 6M+ SDK cài đặt / tháng, 19k+ GitHub sao.
- Tính năng: theo dõi, quản lý nhanh chóng với phiên bản + sân chơi, đánh giá (LLM-as-judge, phản hồi của người dùng, tùy chỉnh), phiên bản thay thế.
- Tháng 6 năm 2025: trước đây là các mô-đun thương mại (LLM-as-a-judge, hàng lưu ý, thí nghiệm nhanh chóng, sân chơi) nguồn mở dưới MIT.
- Nguyệt nhất cho: khả năng quan sát kết thúc với vòng quản lý nhanh chặt chẽ.

### Arize Phoenix (Lí thư 2.0)

- Đánh giá chuyên sâu hơn về các tác nhân: phân nhóm dấu vết, phát hiện bất thường, liên quan đến việc lấy lại cho RAG.
- Native OpenInference tự động dụng cụ.
- Các cặp với quản lý Arize AX cho sản xuất.
- Không có phiên bản nhanh  được định vị như một công cụ chuyển hướng/hành vi-hệch giảm cùng với các nền tảng rộng hơn.
- Nguyệt nhất cho: sự liên quan RAG, biến động hành vi, phát hiện bất thường.

### Sao chổi Opik (Apache 2.0)

- Tự động tối ưu hóa nhanh thông qua thử nghiệm A / B.
- Các đường dây bảo vệ (đánh dấu PII, hạn chế hiện tại).
- Đánh giá chứng ảo giác.
- Điểm chuẩn từ đo lường của Comet: Các bản ghi Opik + đánh giá trong 23.44s so với Langfuse 327.15s (~ 14x khoảng cách)  lấy các điểm chuẩn của nhà cung cấp như là hướng dẫn.
- Nguyệt nhất cho: vòng tối ưu hóa, thử nghiệm tự động, thực thi thám.

### Dữ liệu ngành công nghiệp

Theo Maxim (2026 phân tích thực địa): 89% các tổ chức có khả năng quan sát các đại lý; vấn đề chất lượng là rào cản sản xuất hàng đầu (32% người được hỏi trích dẫn chúng).

### Chọn một

| Need | Pick |
|------|------|
| All-in-one with prompt management | Langfuse |
| Deep RAG evaluation + drift | Phoenix |
| Automated optimization + guardrails | Opik |
| Open licensing, no ELv2 | Langfuse (MIT) or Opik (Apache 2.0) |
| Datadog / New Relic integration | Any — they all export OTel |

### Khi mô hình này đi sai

- **No eval strategy.**Việc theo dõi mà không có đánh giá chỉ là việc khai thác gỗ đắt tiền.
- **Self-rolled LLM-judge without grounding.**Mô hình CRITIC (Dạy học 05) áp dụng  các thẩm phán cần các công cụ bên ngoài để xác minh thực tế.
- **Prompt versions not tied to traces.**Khi sự phản ứng giảm, bạn không thể phân chia cho sự thúc đẩy đã gây ra nó.

```figure
wb-trace-ingest
```

## Hãy xây dựng nó

`code/main.py`thực hiện một bộ sưu tập dấu vết stdlib + thẩm phán đánh giá LLM:

- Giống các con giọt hình GenAI.
- Nhóm theo phiên, thẻ không chạy (các chuyến đi bảo vệ, đánh giá low-trust).
- Một thẩm phán LLM có kịch bản ghi điểm phản ứng của đại lý trên một rubric.
- Một bản tóm tắt giống như bảng điều khiển: tỷ lệ thất bại, lý do thất bại hàng đầu, phân phối điểm đánh giá.

Đi đi.

```
python3 code/main.py
npx tsx code/main.ts
```

Kết quả: điểm đánh giá mỗi phiên và phân loại thất bại phù hợp với những gì Langfuse / Phoenix / Opik sẽ hiển thị.

## Sử dụng nó

- **Langfuse**tự lưu trữ hoặc đám mây; dây thông qua OTel hoặc SDK của họ.
- **Arize Phoenix**tự lưu trữ; tự động công cụ OpenInference.
- **Comet Opik**tự lưu trữ hoặc đám mây; vòng tối ưu hóa tự động.
- **Datadog LLM Observability**cho các đội hỗn hợp + ML đã chạy Datadog.

## Chuyển nó

`outputs/skill-obs-platform-wiring.md`chọn một nền tảng và dẫn các dấu vết + đánh giá + phiên bản nhanh vào một đại lý hiện có.

## Các bài tập

1. Xuất khẩu một tuần các dấu vết OTel sang đám mây Langfuse.
2. Viết một chương trình thẩm phán LLM cho lĩnh vực của bạn (sự chính xác thực tế, âm thanh, tuân thủ phạm vi).
3. So sánh phiên bản Langfuse với tập hợp dấu vết của Phoenix.
4. Đọc hồ sơ của Opik, đưa một tấm dây bảo vệ thông tin thông tin thông tin cho một trong những người làm việc của anh.
5. Hãy đánh giá điểm số của 3 người trong cơ thể của bạn, bỏ qua số lượng được công bố bởi nhà cung cấp, đo lường số của bạn.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tracing | "Spans collector" | Ingest OTel / SDK spans; index by session |
| Prompt management | "Prompt CMS" | Versioned prompts tied to traces |
| LLM-as-judge | "Automated eval" | Separate LLM scores agent output against a rubric |
| Session replay | "Trace playback" | Step through past runs for debugging |
| RAG relevancy | "Retrieval quality" | Does the retrieved context match the query |
| Trace clustering | "Behavioral grouping" | Cluster similar runs for drift detection |
| Guardrail enforcement | "Policy at log time" | PII/toxicity/scope checks on logged content |

## Đọc thêm

- [Langfuse docs](https://langfuse.com/) theo dõi, đánh giá, nhanh chóng
- [Arize Phoenix docs](https://docs.arize.com/phoenix) tự động dụng cụ, trôi
- [Comet Opik](https://www.comet.com/site/products/opik/) tối ưu hóa + tháp bảo vệ
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) các kế hoạch cả ba tiêu thụ
