# Mô hình Show-o và Diffusion Discrete

> Thuốc truyền trộn các biểu diễn liên tục và riêng biệt. Show-o (Xie et al., tháng 8 năm 2024) đi theo hướng khác: mã thông báo văn bản sử dụng dự đoán mã thông báo tiếp theo nguyên nhân, mã thông báo hình ảnh sử dụng sự lan truyền kín kín trong tinh thần của MaskGIT. Cả hai đều ngồi trong một bộ biến đổi với một mặt nạ tập trung lai. Kết quả thống nhất VQA, text-to-image, inpainting, và sản xuất modality hỗn hợp trên một xương sống, một tokeniser mỗi modality, một công thức mất mát (token tiếp theo mở rộng đến dự đoán che giấu). Bài học này đi theo thiết kế Show-o tại sao sự phân tán phân biệt được che giấu là một máy tạo hình ảnh song song, vài bước và tương phản với Transfusion và Emu3.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## Mục tiêu học tập

- Giải thích sự phân tán phân biệt được che giấu: lịch trình che giấu token một cách đồng nhất sau đó yêu cầu biến đổi để phục hồi chúng.
- So sánh việc giải mã hình ảnh song song (Show-o, MaskGIT) với việc giải mã hình ảnh tự rút (Chameleon, Emu3) về tốc độ và chất lượng.
- Hãy nêu tên bốn nhiệm vụ Show-o xử lý trong một điểm kiểm soát: tạo văn bản, VQA, T2I, vẽ hình ảnh.
- Chọn một lịch trình che giấu (các, tuyến tính, cắt) và lý luận về tác động của nó đối với chất lượng mẫu.

## Vấn đề

Việc đào tạo hai lỗ của sự truyền máu hoạt động nhưng có động lực phức tạp hơn.

Câu trả lời của Show-o: giữ cả hai phương pháp tách biệt (như Chameleon), nhưng tạo ra hình ảnh song song bằng cách phân tán phân biệt được che giấu thay vì theo trình tự. Mục tiêu đào tạo trở thành một dự đoán mã hóa được che giấu duy nhất, tổng quát dự đoán mã hóa tiếp theo tự nhiên.

## Khái niệm

### Phân phối phân biệt được che giấu (MaskGIT)

Trận thuật của Chang et al. (2022) MaskGIT là thanh lịch. Bắt đầu từ một hình ảnh hoàn toàn che giấu (mỗi biểu tượng là đặc biệt `<MASK>`ID). Tại mỗi bước, dự đoán tất cả các token che giấu song song, sau đó giữ các dự đoán tự tin nhất ở trên-K và che giấu lại phần còn lại. Sau ~ 8-16 lần lặp lại, tất cả các token được điền vào.

Việc đào tạo đơn giản: lấy mẫu tỷ lệ che giấu một cách đồng đều từ [0, 1], áp dụng nó vào các token VQ của hình ảnh, đào tạo bộ biến đổi để lấy lại những mã che phủ.

### Show-o: một biến thể, mặt nạ lai

Show-o đặt MaskGIT bên trong một biến thể mô hình ngôn ngữ nguyên nhân.

- Các mã thông báo văn bản: nguyên nhân (Mỹ pháp luật tiêu chuẩn).
- Các token hình ảnh: hoàn toàn hai chiều trong khối hình ảnh (vì vậy các token che giấu có thể nhìn thấy mọi token hình ảnh khác trong quá trình dự đoán).
- Text-to-image: text sẽ phụ thuộc vào hình ảnh trước, hình ảnh sẽ phụ thuộc vào text trước.

Các sự thay thế đào tạo giữa:
1. NTP tiêu chuẩn trên các chuỗi văn bản.
2. Các mẫu T2I: văn bản → hình ảnh với mã thông báo hình ảnh che giấu, mất tiền báo ký hiệu che giấu.
3. Các mẫu VQA: hình ảnh → văn bản với các mã thông báo văn bản được che giấu (thực sự chỉ là NTP).

Sự mất mát thống nhất là sự chuyển động giữa các loài.`<MASK>`token, bao gồm cả NTP văn bản (chỉ token cuối cùng là "đã che giấu") và hình ảnh được che giấu-sải (đã bộ phận ngẫu nhiên được che giấu).

### Tiêu chuẩn lấy mẫu song song

Show-o tạo ra một hình ảnh trong ~ 16 bước thay vì ~ 1000 (để tự rút lại mỗi token) hoặc ~ 20 (đối truyền).

So sánh:
- Chameleon / Emu3 (được tự rút trên token): N_tokens đi trước, thường là 1024-4096 cho mỗi hình ảnh.
- Thuốc truyền (tải truyền liên tục): ~ 20 bước, mỗi bước là một chuyển đổi viên đầy đủ.
- Show-o (các pha trộn phân biệt được che giấu): ~ 16 bước, mỗi bước là một bước chuyển đổi đầy đủ.

Show-o nhanh hơn Chameleon ở các mô hình quy mô tương tự, tương đương với số bước Transfusion với chi phí từng bước thấp hơn (những logit từ ngữ riêng biệt so với mất MSE liên tục).

### Các nhiệm vụ tại một điểm kiểm soát

Show-o hỗ trợ bốn nhiệm vụ khi suy luận, được chọn theo định dạng nhanh:

- Tạo văn bản: đầu ra văn bản tự rút tiêu chuẩn.
- VQA: hình ảnh vào, tin nhắn ra.
- T2I: text in, image out qua masked discrete diffusion.
- Đơn: hình ảnh với một số mã thông báo được che giấu, điền vào.

Khả năng vẽ màu được miễn phí từ đào tạo dự đoán ẩn mặt. n một khu vực của lưới mã VQ, cung cấp phần còn lại cộng với lời nhắc văn bản, dự đoán mã ẩn mặt.

### Thời gian đeo mặt nạ

Chương trình về số lượng token để tháo mặt nạ mỗi bước hình thành chất lượng.

```math
\text{mask\_ratio}(t) = \cos\left(\frac{\pi t}{2T}\right) \qquad t = 0, \ldots, T
```

Ở bước 0, tất cả các token được che giấu ( tỷ lệ 1.0).$T$Cosine tập trung khối lượng vào tỷ lệ giữa phạm vi nơi dự đoán là thông tin quan trọng nhất.

### Show-o2

Show-o2 (2025 theo dõi, arXiv 2506.15564) quy mô Show-o: cơ sở LLM lớn hơn, tokenizer tốt hơn, lịch trình mặt nạ cải thiện.

### Ở chỗ Show-o ngồi

Trong phân loại năm 2026:

- Các mã thông báo riêng biệt + NTP: Chameleon, Emu3.
- Các token riêng biệt + phân tán ẩn: Show-o, MaskGIT, LlamaGen, Muse.
- Tiếp tục + phân tán: Thuốc truyền, MMDiT, DiT. Chất lượng cao nhất, đào tạo phức tạp hơn.
- Tiếp tục + dòng chảy phù hợp trong một VLM: JanusFlow, InternVL-U.

Chọn theo nhiệm vụ: Show-o khi bạn muốn T2I + inpainting + VQA trong một mô hình mở với tốc độ hợp lý; Chuyển máu khi chất lượng là tối ưu và bạn có thể đủ khả năng để trả tiền cho ống nước hai lỗ.

```figure
masked-diffusion-unmask
```

## Sử dụng nó

`code/main.py`mô phỏng lấy mẫu show-o:

- Một lưới đồ chơi gồm 16 token VQ.
- Một "giới chuyển đổi" giả mạo dự đoán logits dựa trên một lời nhắc và các token hiện chưa được che giấu.
- Phân tích mẫu ngụy trang song song trên 8 bước với lịch trình cosine.
- Bác in các trạng thái trung gian (tự tiến hóa mô hình mặt nạ) và các token cuối cùng.

Đi, xem mặt nạ tan chảy từng bước.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-unified-gen-model-picker.md`. Với một sản phẩm cần cả sự hiểu biết (VQA, captioning) và thế hệ (T2I, inpainting) với giới hạn trọng lượng mở, chọn giữa gia đình Show-o, gia đình Transfusion/MMDiT, và gia đình Emu3 / Chameleon với sự thỏa hiệp cụ thể.

## Các bài tập

1. Các mẫu phân tán phân tán được che giấu trong ~ 16 bước. Tại sao không 1?

2. Đơn màu miễn phí với sự pha trộn che giấu. đề xuất một trường hợp sử dụng sản phẩm (thực tế hoặc giả thuyết) nơi mà màu màu của Show-o vượt qua mô hình chuyên môn.

3. Chương trình Cosine vs lịch trình tuyến tính: theo dõi số lượng các token không che giấu mỗi bước cho T = 8.

4. Một hình ảnh 512x512 Show-o là 1024 token.$K=16384$, mô hình phát ra $1024 \cdot \log_2(16384) = 14{,}336$Bit (~ 1,75 KiB) dữ liệu. Phát ra Stable Diffusion 512*512*24 bit = 6,291,456 bit (~ 768 KiB) của các pixel nguyên liệu.

5. LlamaGen (arXiv:2406.06525). mô hình hình ảnh tự rút theo điều kiện lớp học của LlamaGen khác với cách tiếp cận che giấu của Show-o như thế nào?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Masked discrete diffusion | "MaskGIT-style" | Training to predict masked tokens; at inference, iteratively unmask the most-confident predictions |
| Cosine schedule | "Unmask schedule" | Decay of mask ratio over inference steps; concentrates confidence growth at mid-range |
| Parallel decoding | "All tokens at once" | Every step predicts the full sequence of masked tokens in one forward pass, then commits top-K |
| Hybrid attention | "Causal + bidirectional" | Mask that is causal over text tokens and bidirectional within image blocks |
| Inpainting | "Fill-in generation" | Condition on an image with some tokens masked, predict the missing ones; free from the training objective |
| Commitment rate | "Top-K per step" | How many tokens are declared "done" per iteration; controls inference vs quality trade-off |

## Đọc thêm

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
