# Chameleon và Early-Fusion chỉ có mã thông báo-Mô hình đa mô hình

> Mỗi VLM mà chúng ta đã thấy cho đến nay giữ hình ảnh và văn bản riêng biệt. Các token hình ảnh đến từ một bộ mã hóa thị giác, chảy vào một máy chiếu, sau đó gặp văn bản bên trong LLM. Từ vựng của tầm nhìn và văn bản không bao giờ chồng chéo. Chameleon (Meta, tháng 5 năm 2024) hỏi: nếu họ làm thế thì sao? Trình luyện một VQ-VAE biến hình thành một chuỗi các token riêng biệt từ một từ vựng chung. Mỗi tài liệu đa phương thức hiện là một chuỗi mã thông báo văn bản và mã thông báo hình ảnh được giao nhau, một lỗ tự động. Hiệu ứng phụ: mô hình có thể tạo ra các đầu ra hỗn hợp  mã thông báo văn bản và hình ảnh thay thế trong một cuộc gọi suy luận duy nhất. Bài học này đọc luận án early-fusion và xây dựng một phiên bản đồ chơi cuối cùng.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## Mục tiêu học tập

- Giải thích lý do tại sao một từ vựng chung + mất một lần thay đổi những gì mô hình có thể làm.
- Mô tả cách một VQ-VAE biểu tượng hóa một hình ảnh thành một chuỗi riêng biệt tương thích với mục tiêu biểu tượng tiếp theo của một biến thể.
- Tên các thủ thuật huấn luyện ổn định của Chameleon: QK-Norm, đặt hàng bỏ học, LayerNorm đặt hàng.
- So sánh cách tiếp cận Q-Former của Chameleon vs BLIP-2 và mô tả khi nào là lựa chọn đúng.

## Vấn đề

VLM dựa trên bộ điều chỉnh (LLaVA, BLIP-2, Qwen-VL) xử lý văn bản và hình ảnh như hai thứ khác nhau.`embed(text_token)`Một hình ảnh đi qua `visual_encoder(image) → projector → ... pseudo_tokens`Mô hình có hai đường lối nhập mà hợp nhất một phần trong.

Ba hậu quả:

1. LLM chỉ có thể tiêu thụ hình ảnh, không phát ra chúng.
2. Các tài liệu có tính cách hỗn hợp (làm thay đổi các đoạn văn và hình ảnh, như trong một bài viết) là khó khăn  bạn hoặc phân tích đầu vào đa phương thức bên ngoài mô hình hoặc các thế hệ chuỗi.
3. Sự không phù hợp phân phối. Các token hình ảnh và các token văn bản sống ở các khu vực khác nhau của không gian ẩn, tạo ra các vấn đề sắp xếp tinh tế.

Chameleon bác bỏ giả định: hình ảnh chỉ là chuỗi các token riêng biệt từ một từ vựng chung. Tập mô hình trên các tài liệu được giao lưu, một lỗ, một máy giải mã tự động, và bạn mở khóa việc tạo các chế độ hỗn hợp miễn phí.

## Khái niệm

### VQ-VAE như là tokenizer hình ảnh

Tokenizer là một bộ mã hóa tự động biến thể theo phương thức vector.

- Mã hóa: CNN + ViT mà lập bản đồ hình ảnh cho một bản đồ tính năng không gian, nói 32x32 tính năng của dim 256.
- Codebook: một từ vựng được học của các vector K (Chameleon sử dụng 8192), cũng là dim 256.
- Quantization: cho mỗi tính năng không gian, tìm kiếm mục codebook gần nhất bằng khoảng cách L2. Thay thế tính năng liên tục bằng chỉ số nguyên.
- Bộ giải mã: CNN đưa các tính năng lượng tử trở lại các pixel.

Việc đào tạo: VAE tái tạo mất + mất cam kết + mất sổ sách code.

Đối với Chameleon: một hình ảnh trở thành 32 * 32 = 1024 mã thông báo được rút ra từ một từ vựng của 8192. Đặt các ID hình ảnh đó trong cùng không gian ID với các mã thông báo văn bản BPE. Chameleon chỉ có 65,536 mục nhập, và số lượng đó đã bao gồm mã hình ảnh 8192 và các mã thông báo đặc biệt như bộ tách hình ảnh.

### Thuật ngữ chung

Từ vựng của Chameleon kết hợp mã thông báo văn bản, mã thông báo hình ảnh và phân chia phương thức. Mỗi mã thông báo có một ID duy nhất. Lớp nhúng đầu vào lập bản đồ mỗi ID cho một vector ẩn D-dim. Bản đồ chiếu đầu ra ẩn lại cho logit từ vựng. Softmax chọn mã thông báo tiếp theo, bất kể phương thức nào.

Các bộ phân tách quan trọng: `<image>`và `</image>`Tags bracket chuỗi mã hóa hình ảnh.`<image>`, phần mềm dòng chảy biết 1024 token tiếp theo là chỉ số VQ để gửi đến decoder cho rendering pixel.

### Sản xuất hỗn hợp

Inference là dự đoán mã thông báo tiếp theo trong từ vựng chung. Ví dụ: "Hãy vẽ một con mèo và mô tả nó". Chameleon phát ra:

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

Mô hình chọn thứ tự tự động  nó có thể tạo ra hình ảnh sau văn bản, văn bản sau hình ảnh, hoặc chia sẻ.

So sánh với các máy điều chỉnh VLM nơi việc tạo chỉ có văn bản. Chameleon mở lại câu hỏi về các phương thức sản xuất mô hình.

### Sự ổn định đào tạo  QK-Norm, bỏ cuộc, LayerNorm đặt hàng

Việc đào tạo với sự hợp nhất sớm là không ổn định về quy mô.

- QK-Norm. Sử dụng LayerNorm cho truy vấn và dự đoán chính bên trong sự chú ý, trước khi sản phẩm chấm. ngăn chặn vụ nổ độ lớn logit ở độ sâu. Được sử dụng bởi nhiều mô hình lớn sau năm 2024.
- Đặt bỏ. bỏ bỏ sau mỗi phần dư thêm, không chỉ sau sự chú ý và MLP. cần phải có sự điều chỉnh hơn khi gradient từ các token hình ảnh có thể thống trị.
- LayerNorm sắp xếp. Pre-LN trên chi nhánh còn lại (thực lệ), cộng thêm một LN thêm trên kết nối skip của khối cuối cùng.

Không có những thủ thuật này, huấn luyện 34B-param Chameleon đã đi ngược tại nhiều điểm kiểm soát. Với họ, nó hội tụ.

### Trần nhà tái tạo của tokeniser

VQ-VAE là lỗ hổng. Với 8192 mục codebook và 1024 token mỗi hình ảnh 512x512, tái tạo PSNR là khoảng 26-28 dB.

Tokenizer là nút thắt. Tokenizer tốt hơn (MAGVIT-v2, IBQ, SBER-MoVQGAN) nâng trần. Emu3 (Dạy 12.12) đạt được sản xuất chất lượng SDXL thông qua một tokenizer tốt hơn một mình.

### Chameleon vs BLIP-2 / LLaVA

Chameleon (sự hợp nhất sớm, từ ngữ chung):
- Một lỗ, một decoder.
- Tạo ra sản lượng hỗn hợp.
- Tokenizer là trần chất lượng.
- Chi phí: VQ-VAE decoder cho mỗi hình ảnh được tạo trên đường suy luận.

BLIP-2 / LLaVA (trộn hợp nhất, tháp riêng biệt):
- Nhìn vào, chỉ gửi tin nhắn.
- Sử dụng lại bằng LLM trước khi được đào tạo.
- Không có nút thắt để hiểu.
- Giá rẻ: một lần đi trước.

Nếu bạn cần tạo hình ảnh, gia đình Chameleon, nếu bạn chỉ cần hiểu, adapter-VLM đơn giản hơn và sử dụng lại tính toán được đào tạo trước.

### Fuyu và AnyGPT

Fuyu (Adept, 2023) là một cách tiếp cận tương tự: bỏ qua bộ mã hóa thị giác riêng biệt hoàn toàn, cho các bản vá hình ảnh thô thông qua dự đoán đầu vào của LLM như thể chúng là token, không có tokeniser. đơn giản hơn Chameleon, mất sản xuất phát ra từ ngữ chia sẻ.

AnyGPT (Zhan et al., 2024) mở rộng Chameleon cho bốn phương pháp: văn bản, hình ảnh, nói, âm nhạc.

```figure
vq-codebook
```

## Sử dụng nó

`code/main.py`xây dựng mô hình sáp nhập sớm đồ chơi từ đầu đến cuối:

- Một máy định lượng kiểu VQ-VAE nhỏ xíu, lập bản đồ 8x8 bản vá cho chỉ số codebook (K=16).
- Một từ vựng chung của (tác giả văn bản 0..31) + (tác giả hình ảnh 32..47) + (những phân chia 48, 49).
- Một máy giải trí tự động (bảng hình lớn) được đào tạo trên các tiêu đề tổng hợp + chuỗi mã hình ảnh.
- Phòng lấy mẫu phát ra các mã thông báo văn bản + hình ảnh thay thế khi được yêu cầu.

Mã cố tình giữ cho bộ biến đổi nhỏ (những chữ cái lớn) để bạn có thể theo dõi dòng tín hiệu từ đầu đến cuối.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-tokenizer-vs-adapter-picker.md`. Với một đặc điểm sản phẩm (được hiểu chỉ với hiểu + tạo, chất lượng hình ảnh cần thiết, ngân sách chi phí), nó chọn giữa gia đình Chameleon (sự hợp nhất sớm) và gia đình LLaVA (sự hợp nhất muộn) và biện minh bằng các quy tắc số lượng.

## Các bài tập

1. Chameleon sử dụng K=8192 codebook và 1024 token cho mỗi hình ảnh 512x512 . ước tính tỷ lệ nén so với hình ảnh RGB 24 bit.

2. Một hình ảnh 4K (3840x2160) với cùng mật độ VQ-VAE tạo ra bao nhiêu mã thông báo hình ảnh? Một mô hình kiểu Chameleon có thể tạo ra một hình ảnh 4K trong một cuộc gọi suy luận? Điều gì phá vỡ đầu tiên  ngữ cảnh, chất lượng tokeniser, hoặc cache KV?

3. Thực hiện QK-Norm trong Python tinh khiết. Với truy vấn và khóa 64-dim, hiển thị sản phẩm điểm trước và sau LayerNorm. Tại sao điều khiển độ lớn quan trọng ở độ sâu?

4. Đọc phần Chameleon 2.3 về sự ổn định tập luyện. mô tả chế độ thất bại chính xác được ghi nhận trên giấy ở 34B mà không có QK-Norm.

5. Lớn bộ giải mã đồ chơi để phát ra phản ứng kiểu hỗn hợp khi chỉ có lời nhắc văn bản. đo số lần mô hình chọn hình ảnh trước vs văn bản trước khi được đào tạo phân phối dữ liệu 60% văn bản trước / 40% hình ảnh trước.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | Images converted to discrete tokens sharing the transformer's vocabulary from step one |
| VQ-VAE | "Image tokenizer" | CNN + ViT + codebook that maps images to integer indices the transformer can predict |
| Shared vocabulary | "One dictionary" | A single token ID space covering text + image + modality separators |
| QK-Norm | "Attention stabilizer" | LayerNorm applied to query and key before their dot product, prevents norm blowup |
| Mixed-modality generation | "Text + image output" | Inference that autonomously produces interleaved text and image tokens in one pass |
| Codebook size | "K entries" | Number of discrete vectors the VQ-VAE can quantize to; trades compression for fidelity |
| Tokenizer ceiling | "Reconstruction limit" | Best PSNR achievable by decoding VQ tokens; bounds the model's image quality |

## Đọc thêm

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
