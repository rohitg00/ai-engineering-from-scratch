# MIO và bất kỳ mô hình đa phương tiện phát trực tuyến nào

> GPT-4o đưa ra một sản phẩm mà hầu hết các mô hình mở không thể sao chép: một đại lý nghe giọng nói, xem video và nói lại trong thời gian thực. Câu trả lời về hệ sinh thái mở vào cuối năm 2024 là MIO (Wang et al., tháng 9 năm 2024). MIO ký hiệu hóa văn bản, hình ảnh, ngôn ngữ và âm nhạc, đào tạo một biến thể nguyên nhân trên các chuỗi liên kết, và tạo ra bất kỳ phương thức nào cho bất kỳ phương thức nào. AnyGPT (Zhan et al., tháng 2 năm 2024) là bằng chứng về khái niệm; MIO là quy mô; Unified-IO 2 (Allen AI, tháng 12 năm 2023) là người anh em họ với nền tảng thị giác + hành động. Bài học này đọc mô hình bất cứ gì đến bất cứ gì 4 tokenizers, một biến thể, giải mã thân thiện với streaming.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, four-modality token allocator + streaming decode loop)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 6 (Speech and Audio)
**Time:** ~120 minutes

## Mục tiêu học tập

- Thiết kế một từ vựng chung để lưu trữ các mã thông báo văn bản, hình ảnh, nói và âm nhạc mà không va chạm.
- So sánh SEED-Tokenizer (hình ảnh) và SpeechTokenizer residual-VQ (những lời nói) về sự bớt áp suất + tái thiết.
- Giải thích chương trình học bốn giai đoạn xây dựng bất kỳ thế hệ nào.
- Hãy nêu tên ba công thức mở bất cứ ai và các sự thỏa hiệp chính của chúng: MIO, AnyGPT, Unified-IO 2.

## Vấn đề

Một mô hình đa phương tiện thống nhất dễ tuyên bố và khó xây dựng ở quy mô. Hầu hết các hệ thống "bất cứ ai đến bất kỳ ai" cho đến năm 2024 đã được đưa vào đường ống dẫn: mô hình thị giác → đại diện văn bản → mô hình nói chuyện → âm thanh. Mỗi hop mất thông tin, thêm độ trễ và phức tạp đào tạo. Video demo của GPT-4o cho thấy một lựa chọn thay thế mô hình duy nhất với phản ứng tiếp theo; hệ thống mở theo sau nhiều tháng.

Những thách thức kỹ thuật:

- Các token phải tồn tại cho mọi phương thức, nén không mất - đủ để tái tạo, và sản xuất token theo tốc độ mà biến thể có thể tiêu thụ.
- Một từ vựng duy nhất phải phân bổ không gian cho văn bản (32k+), hình ảnh (8k+), nói (4k+), âm nhạc (8k+).
- Dữ liệu đào tạo phải bao gồm mỗi cặp đầu vào-phản xuất (text→image, image→speech, speech→image, vv) hoặc mô hình phải được tạo thành.
- Inference phải truyền các token đầu ra đủ nhanh để có thể trì hoãn cuộc trò chuyện (<500ms thời gian đến đầu tiên-byte âm thanh).

## Khái niệm

### Bốn tokeniser cho bốn phương thức

Bộ token của MIO:

- Văn bản: BPE tiêu chuẩn, từ ngữ ~ 32000.
- Hình ảnh: SEED-Tokenizer (2023), một token hóa hình ảnh riêng biệt với sổ mã nhập 8192 phát ra 32 token mỗi hình ảnh.
- Phát biểu: SpeechTokenizer residual-VQ (2023), mã hóa một dạng sóng 16kHz thành 8 sách mã thứ tự; cấp độ đầu tiên là nội dung thô, cấp độ sau này thêm prosody và danh tính loa. MIO giữ mức nội dung cộng với ba cấp độ timbre đầu tiên, mỗi mã 1024 do đó 4096 ID phát biểu.
- Âm nhạc: tương tự residual-VQ (các gia đình MusicGen / Encodec của Meta), 4-8 codebook. MIO tự nó không vận chuyển một token nhạc (tương thức thứ tư của nó là video, như khung thông qua token hình ảnh); đồ chơi bài học này thêm âm nhạc để chỉ ra cách thức mới tuyên bố một phạm vi ID.

Mỗi phương thức tạo ra các token nguyên số. Các token nhận được các phạm vi ID không liên kết trong từ vựng chung:

```
text:   0..31999
image:  32000..40191  (8192 image tokens)
speech: 40192..44287  (4 codebooks x 1024 speech tokens)
music:  44288..52479  (8192 music tokens, the toy's extension)
sep:    52480..52485  (<image>, <speech>, <music>, </...>)
```

Tổng: ~ 52k từ vựng.

### Đánh mã phát sóng

Tạo phát biểu sử dụng residual-VQ. Bộ biến đổi dự đoán các token phát biểu cơ sở (vị lớp 0); một bộ định lượng residual được mã hóa song song dự đoán các lớp tiếp theo. Mỗi token lớp 0 là khoảng 50ms âm thanh ở 16kHz.

Mô hình phát sóng:

1. Người dùng nói trong mic; đồng hồ ghi âm thời gian thực phát ra các đồng hồ ghi âm mỗi 50ms.
2. MIO tiêu thụ token khi chúng đến (quayền nhanh + tăng lên tăng lên).
3. Các token đầu ra được phát ra khi được tạo ra; một bộ giải mã giọng nói song song chuyển chúng thành mẫu âm thanh với độ trễ ~ 50-150ms.
4. Thời gian đến lần đầu tiên: MIO báo cáo không có số độ trễ. Ngân sách dưới đây đặt thiết kế này ở khoảng 300ms ở tốt nhất, so với ~ 250ms của GPT-4o.

Mini-Omni (arXiv:2408.16725), GLM-4-Voice (arXiv:2412.02612), và Moshi (arXiv:2410.00037) là các thiết kế phát âm-LLM phát sóng bổ sung.

### Chương trình giảng dạy bốn giai đoạn

Chương trình giảng dạy đào tạo của MIO:

1. Giai đoạn 1  sự sắp xếp. Cặp thể hình ảnh văn bản, văn bản, âm nhạc. Mỗi cặp sử dụng phân đoạn từ vựng mã thông báo riêng của mình.
2. Giai đoạn 2  liên kết. Tài liệu liên kết đa phương pháp (blog với hình ảnh + video, podcast với bản ghi chép, vv.).
3. Giai đoạn 3  tăng cường giọng nói. Dữ liệu âm thanh bổ sung để nâng cao chất lượng giọng nói mà không mất khả năng văn bản.
4. Giai đoạn 4  SFT. Định hướng điều chỉnh qua các phương pháp: VQA, ghi chú, kể chuyện, đối thoại từ nói đến nói.

Thiếu một giai đoạn làm suy giảm khả năng cụ thể: bỏ qua giai đoạn 2 và mô hình mất bối cảnh liên tục; bỏ qua giai đoạn 3 và ngôn ngữ kém.

### Dòng tư tưởng trực quan

MIO giới thiệu chuỗi tư duy thị giác: mô hình phát ra các token hình ảnh trung gian như một bước lý luận. Đối với "con mèo leo lên cây hay không?" mô hình:

1. Tạo ra `<image>`Các token hiển thị cảnh (từ hình ảnh nhập hoặc bản phác thảo).
2. Gửi tin nhắn phân tích bản phác thảo.
3. Giả lời cuối cùng.

Hình ảnh trung gian được hiển thị phục vụ như một bảng điểm. Điểm so sánh cải thiện các nhiệm vụ lý luận không gian. Ý tưởng phản ánh chuỗi suy nghĩ cho lý luận văn bản.

### Các đối thủ cạnh tranh trong bất kỳ

- AnyGPT (arXiv:2402.12226): 4 phương thức (môn văn, hình ảnh, ngôn ngữ, âm nhạc), thiết kế tương tự.
- Unified-IO 2 (arXiv:2312.17172): thêm các kết quả hành động thị giác, độ sâu, bình thường.
- NExT-GPT (arXiv:2309.05519): LLM + các bộ giải mã phân tán cụ thể về phương thức. Không phải là một cách tiếp cận mô hình duy nhất.
- CoDi (arXiv:2305.11846): sự pha trộn hợp nhất; bất kỳ-to-nhà qua chia sẻ tiềm ẩn.

MIO là gần nhất với mã thông báo nguyên chất bất kỳ ai. AnyGPT là tổ tiên khái niệm của nó.

### Ngân sách thời gian trễ

Đối với một sản phẩm trò chuyện, độ trễ của mỗi thành phần quan trọng:

- Mic đến mã thông báo âm thanh: ~ 50ms.
- Prefill (tài báo âm thanh + lịch sử): ~ 100ms trên mô hình 8B.
- Điểm đầu tiên: ~ 50ms.
- Các bộ giải mã giọng nói tương đối - VQ +: ~ 100-150ms.

Tổng thời gian từ đầu tiên đến đầu tiên: ~ 300ms tối thiểu. GPT-4o tuyên bố ~ 250ms. Moshi tuyên bố 160ms. Cả MIO và AnyGPT đều không công bố con số được đo, vì vậy hãy coi ngân sách này như một ước tính, chứ không phải là một tiêu chuẩn.

### Tại sao bất cứ ai cũng không thể

Ngay cả năm 2026, mở bất kỳ mô hình nào theo dõi những mô hình đóng cửa trên hai trục:

- Chất lượng nói chuyện. Tokenizer residual-VQ là lỗ hổng; nói chuyện âm thanh robot so với giọng nói lớp ElevenLabs.
- Việc hỏi mô hình "tự hát về những gì bạn thấy" vẫn thất bại thường xuyên hơn các nhiệm vụ nhìn tinh khiết.

Đây là những vấn đề nghiên cứu mở. Qwen3-Omni (Dạy 12.20) là nỗ lực mở tiên tiến nhất vào năm 2025.

```figure
any-to-any-stream
```

## Sử dụng nó

`code/main.py`- Có thể là:

- Định nghĩa phân bổ từ vựng bốn phương thức và in nó.
- Đường bộ một danh sách đầu vào đa phương thức (léc văn bản, hình ảnh, âm thanh, âm nhạc) thông qua bộ định tuyến tokeniser.
- Tái bộ giải mã phát sóng cho phản ứng văn bản-thủ ngôn với tính độ trễ.
- Xét toán thời gian dự kiến đến đầu tiên-byte âm thanh cho mã hóa, prefill, và decoder latencies.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-any-to-any-pipeline-auditor.md`. Với một thông số cụ thể của sản phẩm nói chuyện (các cách thức vào, các cách thức ra, mục tiêu trễ), nó kiểm tra các lựa chọn thiết kế của gia đình MIO và tính toán ngân sách trễ.

## Các bài tập

1. Sản phẩm của bạn chấp nhận đầu vào giọng nói và trả lại đầu ra giọng nói. Mục tiêu ngân sách trễ cuối đến cuối là gì?

2. SpeechTokenizer residual-VQ sử dụng 8 codebook. đề xuất tại sao việc giải mã tương tự các mức dư là cần thiết (trên theo trình tự) và những tiết kiệm độ trễ mà nó mang lại.

3. Thuật ngữ của bạn có 32k văn bản + 8k hình ảnh + 4k nói. Thêm âm nhạc 8k và ~ 10 bộ tách. chi phí tham số trúng-đường tử là bao nhiêu ở ẩn dim 4096?

4. Các câu hỏi nào có lợi, những câu hỏi nào bị tổn thương bởi các token bổ sung?

5. Đọc Moshi (arXiv:2410.00037). Mô tả kỹ thuật "mônolog nội bộ" của nó và so sánh với chuỗi tư duy thị giác của MIO.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Any-to-any | "Multimodal in/out" | A single model that accepts and emits text, image, speech, and music in any direction |
| Residual-VQ | "Speech tokenizer stack" | Multi-codebook tokenization where each layer adds information; base layer is content, later layers are prosody |
| SEED-Tokenizer | "Image codes" | Discrete image tokenizer with an 8192-entry codebook and 32 tokens per image, used by MIO |
| Chain-of-visual-thought | "Visual scratchpad" | The model generates an intermediate image as a reasoning step before its final answer |
| Time-to-first-audio-byte | "TTFAB" | Latency from user voice to first audio output; <500ms for conversational feel |
| Four-stage curriculum | "Training recipe" | Alignment -> interleaved -> speech-enhanced -> SFT, in that order |

## Đọc thêm

- [Wang et al. — MIO (arXiv:2409.17692)](https://arxiv.org/abs/2409.17692)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Lu et al. — Unified-IO 2 (arXiv:2312.17172)](https://arxiv.org/abs/2312.17172)
- [Wu et al. — NExT-GPT (arXiv:2309.05519)](https://arxiv.org/abs/2309.05519)
- [Tang et al. — CoDi (arXiv:2305.11846)](https://arxiv.org/abs/2305.11846)
