# Các mô hình tiếng Anh: tiếng thì thầm đến tiếng Anh Flamingo 3 Arc

> Whisper (Radford et al., tháng 12 năm 2022) đã giải quyết nhận dạng giọng nói  680k giờ nói nhiều ngôn ngữ được giám sát yếu, một bộ biến đổi mã hóa-đánh mã đơn giản, một tiêu chuẩn khiến mọi bản phát hành ASR sau đó trích dẫn nó. Nhưng sự nhận ra không phải là lý luận. Để hỏi "vài nhạc cụ nào trong bản ghi âm này" hay "người nói đang bày tỏ cảm xúc gì" hay "cái gì đã xảy ra trong phút 3" cần phải hiểu âm thanh, chứ không phải bản sao. Qwen-Audio, SALMONN, LTU và NVIDIA's Audio Flamingo 3 (AF3, tháng 7 năm 2025) dần xây dựng đống đó: giữ các bộ mã lớp Whisper, đập vào các máy hình thành Q, đào tạo dữ liệu hướng dẫn văn bản âm thanh, thêm lý luận chuỗi suy nghĩ. Bài học này đi qua vòng cung.

**Type:** Build
**Languages:** Python (stdlib, log-Mel spectrogram + audio Q-former skeleton), TypeScript
**Prerequisites:** Phase 6 (Speech and Audio), Phase 12 · 03 (Q-Former)
**Time:** ~180 minutes

## Mục tiêu học tập

- Xét ra một quang phổ log-Mel từ hình dạng sóng: cửa sổ, FFT, ngân hàng lọc, chuyển đổi log.
- So sánh các tùy chọn mã hóa: mã hóa Whisper, BEAT, AF-Whisper hybrid.
- Xây dựng một âm thanh Q-former: N tìm kiếm có thể học được phục vụ chéo cho các bản vá quang phổ.
- Giải thích đào tạo âm thanh-LLM theo từng giàn (Whisper-then-LLM) so với đào tạo âm thanh-LLM từ đầu đến cuối: tại sao kết thúc đến cuối cân bằng tốt hơn cho lý luận.

## Vấn đề

Việc nhận dạng giọng nói được giải quyết bởi Whisper. OCR của âm thanh là một hàng hóa. Nhưng " hàng hóa " dừng lại khi ghi âm. Nếu mô hình không thể lý luận về những gì nó nghe thấy  thời gian, loa, cảm xúc, cấu trúc âm nhạc, âm thanh môi trường  bản ghi âm một mình không thể thúc đẩy các tính năng sản phẩm.

Ba tuyến đường rõ ràng:

1. Cascade: Whisper ghi lại, LLM lý luận về ghi chép. Làm việc cho kịch bản nói chuyện thuần túy. thất bại cho âm nhạc, âm thanh môi trường, chồng chéo đa loa, cảm xúc.

2. End-to-end audio-LLM: một bộ mã hóa âm thanh cung cấp các token âm thanh trực tiếp vào LLM, bỏ qua bản sao chép. Giữ lại thông tin âm thanh ( cảm xúc, loa, môi trường).

3. Hybrid: mã hóa âm thanh + mã hóa văn bản có thể cả sao chép và lý luận. Qwen-Audio và Audio Flamingo chọn con đường này.

## Khái niệm

### Nhãn quang phổ Log-Mel: tính năng đầu vào

Mỗi bộ mã hóa âm thanh bắt đầu với cùng một tính năng: một quang phổ log-Mel.

1. Mẫu lại lên 16 kHz.
2. Chuyển đổi Fourier ngắn thời gian với cửa sổ 25ms, nhảy 10ms.
3. Hãy lấy kích thước của kết quả FFT.
4. Sử dụng các băng lọc Mel (thường là 80 bộ lọc có khoảng thời gian log 0-8000 Hz) để biến dạng đến tần số nhận thức.
5. Lớp nén gỗ$(\log(1 + x))$cho phạm vi động.

Kết quả: một mảng hình dạng 2D (T, 80) nơi T là số khung thời gian. Đối với clip 30 giây với tốc độ khung hình 100 Hz: (3000, 80).

### Bộ mã hóa của Whisper

Bộ mã hóa của Whisper là một bộ biến đổi kiểu ViT 12 tầng xử lý quang phổ log-Mel như một chuỗi khung thời gian.

Đối với ASR, decoder của Whisper là một biến đổi sự chú ý qua nhau tạo ra các mã thông báo văn bản được điều chỉnh trên đầu ra encoder.

Đối với ALM (audio-LLM), bạn muốn nguồn đầu ra mã hóa như là đầu vào một LLM khác.

### Các bộ mã hóa BEAT và các bộ mã hóa âm thanh cụ thể

Whisper được đào tạo dựa trên dữ liệu nói chung. Nó yếu hơn cho âm nhạc và âm thanh môi trường.

BEATs (Chen et al., 2022) là một bộ biến đổi tự giám sát được đào tạo trên AudioSet.

AF-Whisper (coder của Audio Flamingo 3: bắt đầu từ bộ mã hóa Whisper-large-v3 và tiếp tục đào tạo nó về giọng nói, âm thanh và âm nhạc cùng nhau, vì vậy một bộ mã hóa mang cả tín hiệu ngôn ngữ và âm thanh.

### Audio Q-former

Tương tự như hình mẫu hình ảnh Q-former của BLIP-2. Một số lượng cố định của các truy vấn có thể học (thường là 32 hoặc 64) tham gia qua các khung sản xuất của bộ mã hóa âm thanh. Các truy vấn trở thành các token âm thanh được tiêu thụ bởi LLM.

Giai đoạn sắp xếp đào tạo: Q-former đơn độc, giảm điểm + ghi chú trên cặp âm thanh văn bản (AudioCaps, Clotho).

### Vòng vòm  SALMONN, Qwen-Audio, AF3

SALMONN (Tang et al., 2023): Whisper + BEATs + Q-former + LLaMA.

Qwen-Audio (Chu et al., 2023): kiến trúc tương tự, được đào tạo trên một bộ dữ liệu phong phú hơn, được điều chỉnh cho đối thoại nhiều lượt. MMAU ~ 0,60.

LTU  Listen, Think, Understand (Gong et al., 2023): dữ liệu lý luận rõ ràng, tập trung vào chuỗi suy nghĩ hơn các clip âm thanh.

Audio Flamingo 3 (Goel et al., tháng 7 năm 2025): SOTA mở hiện tại. 7B LLM backbone (Qwen2.5-7B), một bộ mã hóa âm thanh AF-Whisper được xây dựng từ Whisper-large-v3, các lớp bộ chuyển đổi nhỏ vào LLM, đào tạo trên các cặp hướng dẫn âm thanh văn bản 1M +. MMAU 0.72, phù hợp với biên giới độc quyền trên một số nhiệm vụ phụ.

AF3 cũng giới thiệu chuỗi suy nghĩ theo yêu cầu cho âm thanh: mô hình có thể tùy chọn phát ra các token suy nghĩ ("hãy cho tôi xác định các công cụ trước: ...") trước khi trả lời cuối cùng. Độ chính xác trong các nhiệm vụ suy luận phức tạp nâng cao 3-5 điểm khi suy nghĩ được bật.

### Cascaded vs end-to-end

Đường ống nước:

1. Whisper ghi âm → văn bản.
2. Lý do LLM trên văn bản.

Làm việc hoàn hảo cho "đánh lại podcast này". Không thành công cho:
- "Cái tâm trạng của bài hát này là gì?"  tâm trạng là trong âm thanh, không phải từ ngữ.
- "Ai đang nói, Alice hay Bob?"  đòi hỏi phải xác định người nói.
- "Vào giây nào vụ nổ xảy ra?"  Địa điểm thời gian bị mất trong văn bản.
- "Đây là âm thanh thực sự hay được tạo ra?"  Phát hiện deepfake cần các tính năng âm thanh.

End-to-end bảo tồn tín hiệu âm thanh. Qwen-Audio và AF3 xử lý âm nhạc, môi trường và cảm xúc theo cách bản địa.

### Công thức sản xuất 2026

Đối với một sản phẩm mới để hiểu âm thanh:

- Nếu: bản sao là mục tiêu, không có âm nhạc, không có suy luận cảm xúc.
- AF3 / Qwen-Audio-family nếu: âm nhạc, cảm xúc, multi-speaker, hoặc lý luận âm thanh phức tạp.

Cascaded rẻ hơn và đơn giản hơn.

### MMAU  điểm chuẩn lý luận âm thanh

MMAU (Masssive Multimodal Audio Understanding) là tiêu chuẩn lý luận âm thanh 2024-2025:

- 10.000 cặp âm thanh qua âm thanh, âm nhạc, âm thanh môi trường.
- Bao gồm phân loại, lý luận thời gian, lý luận nguyên nhân, QA mở.
- Kiểm tra những đường ống nước bị rơi xuống ngập nước mà hệ thống bị bỏ lỡ.

Open SOTA (AF3) ở mức 0,72; biên giới độc quyền ~ 0,78 (Gemini 2.5 Pro, Claude Opus 4.7).

```figure
audio-text-ctc
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Thực hiện tính toán quang phổ log-Mel trong stdlib: windowsing, DFT ngây thơ, filter-bank Mel.
- Audio Q-ex xương: được cung cấp khung phát ra bộ mã hóa, tính toán Q, K, V, chú ý, và phát ra N token.
- So sánh giữa các trò chơi với nhau.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-audio-llm-pipeline-picker.md`. Với một nhiệm vụ âm thanh (tác giả, gắn thẻ âm nhạc, suy luận cảm xúc, nhật ký đa loa, phân loại môi trường), nó chọn AF3 kết thúc đến kết thúc hoặc lai.

## Các bài tập

1. Xét kích thước quang phổ log-Mel cho một clip 30 giây ở 16kHz, cửa sổ 25ms, nhảy 10ms, 80 hộp Mel.

2. Tại sao Whisper lại kém trong âm nhạc?

3. Audio Q-former với 64 truy vấn so với 32: với nhiệm vụ phức tạp nào 64 trả giá? 32 lưu tính toán cho cái gì?

4. Đọc AF3 Phần 4 về suy nghĩ theo yêu cầu. đề xuất ba nhiệm vụ âm thanh mà chuỗi suy nghĩ giúp ích nhất.

5. Thực hiện một đường ống nhật ký tối thiểu sử dụng đầu ra AF3.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Log-Mel spectrogram | "Mel features" | 2D (time, frequency) array of log-magnitude values after Mel filter banks |
| Audio Q-former | "Audio Perceiver" | Cross-attention bottleneck from audio encoder output to fixed-length queries feeding the LLM |
| Cascaded | "ASR-then-LLM" | Pipeline where Whisper transcribes and a text LLM reasons; loses acoustic information |
| End-to-end | "Audio-LLM" | Audio features enter the LLM directly via Q-former; preserves acoustic signal |
| BEATs | "Audio AudioSet encoder" | SSL transformer trained on AudioSet; strong on music + environmental sounds |
| MMAU | "Audio reasoning bench" | 10k QA pairs across speech, music, environment; 2024 eval standard |
| On-demand thinking | "Audio CoT" | Model can optionally emit reasoning tokens before final answer, lifts accuracy 3-5 pts |

## Đọc thêm

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
