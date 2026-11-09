# Thuốc truyền: Văn bản tự động + Hình ảnh truyền trong một biến thể

> Chameleon và Emu3 đặt cược tất cả vào các token riêng biệt. Chúng hoạt động, nhưng nút thắt lượng tử được nhìn thấy  các nguyên bằng chất lượng hình ảnh dưới các mô hình phân tán không gian liên tục. Phong truyền (Meta, Zhou et al., tháng 8 năm 2024) đưa ra cược ngược lại: giữ hình ảnh liên tục, thả VQ-VAE hoàn toàn, và huấn luyện một bộ biến đổi với hai lỗ. Các mã thông báo văn bản có được dự đoán mã thông báo tiếp theo. Các bản vá hình ảnh có sự mất mát phù hợp dòng chảy / phân tán. Cả hai mục tiêu tối ưu hóa cùng một trọng lượng. Kiến trúc cơ bản của Stable Diffusion 3 (MMDiT) là một người anh em họ gần gũi. Bài học này đọc luận án Transfusion, xây dựng một đồ chơi huấn luyện hai lỗ, và theo dõi mặt nạ chú ý cho phép một biến đổi làm cả hai công việc.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## Mục tiêu học tập

- Đưa một bộ biến đổi chạy hai lỗ (NTP trên mã thông báo văn bản, MSE phân tán trên các bản vá hình ảnh) trên một xương sống.
- Giải thích tại sao sự chú ý hai chiều trên các bản vá hình ảnh cộng với sự chú ý nguyên nhân trên các mã thông báo văn bản là lựa chọn tốt nhất.
- So sánh Transfusion-style (hình ảnh liên tục, mất pha trộn) với Chameleon-style (hình ảnh riêng biệt, NTP) về tính toán, chất lượng và phức tạp của mã.
- Tên góp của MMDiT: trọng lượng cụ thể về phương thức tại mỗi khối, sự chú ý chung tại dòng dư thừa.

## Vấn đề

Cuộc tranh luận về các token hình ảnh phân biệt so với liên tục là lâu hơn LLM. Các đại diện liên tục (tốc số nguyên liệu, vAE laten) giữ lại chi tiết. Các token phân biệt (tốc số VQ) phù hợp với từ vựng bản địa của biến thể nhưng mất chi tiết ở bước định lượng.

Chameleon / Emu3 đã đi riêng biệt: một lỗ, một kiến trúc, nhưng độ trung thành hình ảnh bị giới hạn bởi chất lượng tokenizer.

Các mô hình phân tán tiếp tục: chất lượng hình ảnh đặc biệt, nhưng một mô hình riêng biệt với LLM, kỹ thuật lịch trình tiếng ồn phức tạp và không có sự tích hợp sạch với việc tạo văn bản.

Phong truyền hỏi: chúng ta có thể có cả hai? Giữ hình ảnh liên tục, vẫn tập một mô hình, sử dụng hai lỗ đeo vào một bước gradient.

## Khái niệm

### Kiến trúc hai lỗ

Một bộ biến đổi chỉ có bộ giải mã đơn xử lý một chuỗi chứa:

- Các mã thông báo văn bản (tạm dịch: discrete, từ từ ngữ BPE).
- Các bản vá hình ảnh ( liên tục, các khối pixel 16x16 được chiếu vào mờ ẩn thông qua nhúng tuyến tính  giống như đầu vào của một bộ mã hóa ViT).
- `<image>`và `</image>`Đánh dấu nơi các bản vá liên tục sống.

Thêm vào đó, số tiền của các đầu được chọn là 1 trong hai đầu cho mỗi token:

- Đối với các mã thông báo văn bản: trúng trúng chuẩn trên đầu từ ngữ-logits.
- Đối với các bản vá hình ảnh: mất độ phân tán trên các bản vá liên tục  dự đoán tiếng ồn được thêm vào mỗi bản vá.

Các gradient chảy qua cơ thể biến đổi chia sẻ.

### Mặt nạ chú ý: văn bản nguyên nhân + hình ảnh hai chiều

Các mã thông báo văn bản phải là nguyên nhân  bạn không thể để một mã thông báo văn bản tham gia vào văn bản trong tương lai, hoặc giáo viên buộc phải nghỉ ngơi.

Mặt nạ:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i)   # text attends to images that closed before it
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

Được triển khai như một mặt nạ khối-lục hình ba trong đào tạo và suy luận.

### Thiếu luồng trong biến thể

Thiếu độ phân tán là tiêu chuẩn: thêm tiếng ồn vào một bộ vá hình ảnh, yêu cầu mô hình dự đoán tiếng ồn (hoặc bộ vá sạch, tương đương). Phiên bản truyền sử dụng tương thích dòng chảy  dự đoán trường tốc độ từ tiếng ồn đến sạch.

Trong quá trình đào tạo:
1. Đối với mỗi bản vá hình ảnh $x_0$, lấy mẫu một bước thời gian ngẫu nhiên $t$- Tôi không biết.
2. Phản ứng tiếng ồn$\epsilon$, tính toán$x_t = (1-t) \cdot x_0 + t \cdot \epsilon$(sự phân cực tuyến tính để phù hợp dòng chảy).
3. Bộ biến đổi dự đoán $v_\theta(x_t, t)$$\text{loss} = \mathop{\mathrm{MSE}}(v_\theta(x_t, t), \epsilon - x_0)$- Tôi không biết.
4. Backprop cùng với text NTP mất từ cùng một chuỗi.

Theo kết luận, thế hệ là:
- Các mã thông báo văn bản: lấy mẫu tự rút tiêu chuẩn.
- Các bản vá hình ảnh: vòng lấy mẫu phân tán (10-30 bước điển hình) được điều chỉnh trên các token văn bản trước đó.

### MMDiT: biến thể của Stable Diffusion 3

Stable Diffusion 3 (Esser et al., tháng 3 năm 2024) đã vận chuyển MMDiT (Multimodal Diffusion Transformer) vào khoảng thời gian tương tự như Transfusion.

Sự khác biệt chính của MMDiT:

- Các khối chuyển đổi có trọng lượng Q, K, V và MLP riêng biệt cho các mã thông báo văn bản so với các bản vá hình ảnh.
- Một biến thể phù hợp với dòng chảy cụ thể với việc lấy mẫu được biết đến và toán học đơn giản hơn DDPM.
- Scale. MMDiT là xương sống cho SD3 (2B và 8B biến số param).

Cả hai đều hội tụ về cùng một ý tưởng cốt lõi: một biến thể chạy NTP trên văn bản và phân tán trên các đại diện hình ảnh liên tục.

### Tại sao điều này vượt qua phong cách của Chameleon

Khoảng cách chất lượng giữa phát sóng liên tục và NTP phân biệt trong việc tạo hình ảnh có thể đo lường.

- Ở 7B, nó vượt qua mô hình kiểu Chameleon cùng kích thước trên FID với 3-5 điểm.
- Không cần đào tạo tokeniser  mã hóa hình ảnh đơn giản hơn (động chiếu tuyến tính đến ẩn, giống như lớp đầu vào của ViT).
- Inference có thể song song với việc xác định các bản vá hình ảnh, không giống như các mã thông báo hình ảnh tự rút.

Nhược điểm: Phân truyền là mô hình mất kép, làm cho động lực đào tạo khó khăn hơn. Nặng giảm cần điều chỉnh. Sự không phù hợp lịch trình giữa NTP và sự pha trộn có thể khiến một đầu thống trị.

### Những gì nằm bên dưới dòng chảy

Janus-Pro (Dạy 12.15) tinh chỉnh ý tưởng của Transfusion bằng cách tách lập mã hình ảnh để hiểu và tạo ra SigLIP cho một, VQ cho một  trong khi chia sẻ cơ thể biến đổi. Show-o (Dạy 12.14) thay đổi phân tán cho phân tán riêng biệt (bản đoán đeo mặt nạ).

Các mô hình sản xuất đóng cửa phát ra hình ảnh theo bản địa có thể sử dụng một số hậu duệ của gia đình này, nhưng kiến trúc của chúng không được công bố, vì vậy hãy coi bất kỳ tuyên bố như vậy như một phỏng đoán.

```figure
cfg-guidance-scale
```

## Sử dụng nó

`code/main.py`xây dựng một đồ chơi Transfusion trên một vấn đề nhỏ như MNIST:

- Các tiêu đề văn bản là chuỗi số nguyên ngắn mô tả một con số (0-9).
- Hình ảnh là 4x4 lưới của các byte.
- Một cặp dự đoán tuyến tính chia sẻ trọng lượng hoạt động như là bộ thay thế biến đổi; mất NTP trên văn bản, mất MSE trên các bản vá âm thanh.
- Chuyện tập trung thay đổi hai lỗ, mặt nạ chú ý là rõ ràng.
- Một bản demo mặt nạ in mô hình chú ý ba góc khối cho một văn bản, hình ảnh, chuỗi văn bản.

Bộ biến đổi là một đồ chơi. Phòng ống nước mất hai lỗ, xây dựng mặt nạ chú ý, và vòng suy luận là những đồ tạo vật thực sự.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-two-loss-trainer-designer.md`Với một nhiệm vụ đào tạo đa phương thức mới (text + image, text + audio, text + video), nó thiết kế lịch trình hai lỗ (sự giảm trọng lượng, hình dạng mặt nạ, chia sẻ so với các khối cụ thể về phương thức) và đánh dấu rủi ro thực hiện.

## Các bài tập

1. Một mô hình kiểu Transfusion đào tạo 70% mã thông báo văn bản và 30% các bản vá hình ảnh.

2. Thực hiện mặt nạ khối-lòng ba góc cho một chuỗi: `[T, T, <image>, P, P, P, P, </image>, T]`Đánh dấu mỗi mục 0 hoặc 1.

3. MMDiT có trọng lượng QKV cụ thể về phương thức.

4. Tạo: được đưa ra một lời nhắc văn bản, mô hình chạy NTP cho 50 token, sau đó nhấn `<image>`, sau đó chạy truyền trên 256 đệm trên 20 bước denoise.

5. Đọc bài báo SD3 Phần 3. Mô tả dòng chảy được chỉnh sửa và lý do tại sao nó hội tụ trong ít bước suy luận hơn DDPM.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Two-loss training | "NTP + diffusion" | A single transformer optimizes both cross-entropy on text tokens and MSE on continuous image patches in the same gradient step |
| Flow matching | "Rectified flow" | Diffusion variant that predicts a velocity field from noise to clean data; simpler math than DDPM |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3's architecture: joint attention, modality-specific MLPs and norms |
| Block-triangular mask | "Causal text + bidirectional image" | Attention mask that is causal across text but bidirectional within image regions |
| Continuous image representation | "No VQ" | Image patches as real-valued vectors, not integer codebook indices |
| Velocity prediction | "v-parameterization" | Network output is the velocity field between noise and data, not the noise itself |

## Đọc thêm

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
