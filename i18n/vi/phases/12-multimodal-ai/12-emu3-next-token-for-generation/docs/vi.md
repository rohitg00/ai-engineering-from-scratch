# Emu3: Dự báo tiếp theo cho việc tạo hình ảnh và video

> BAAI's Emu3 (Wang et al., tháng 9 năm 2024) là kết quả năm 2024 nên kết thúc cuộc tranh luận phân tán chống lại tự rút lui. Một bộ biến đổi chỉ có decoder kiểu Llama, được đào tạo chỉ trên mục tiêu dự đoán mã thông báo tiếp theo, trên một từ vựng thống nhất của văn bản + mã thông báo hình ảnh VQ + mã thông báo video VQ 3D, đánh bại SDXL về sản xuất hình ảnh và LLaVA-1.6 về nhận thức. Không mất CLIP. Không có lịch trình phát sóng. Các hướng dẫn không phân loại được sử dụng để suy luận về chất lượng, nhưng mục tiêu đào tạo cốt lõi là dự đoán mã thông báo tiếp theo với việc buộc giáo viên. Được xuất bản trên tạp chí Nature. Bài học này đọc luận án Emu3  tại sao một tokenizer cộng quy mô tốt hơn là tất cả bạn cần  và trái ngược với các phương pháp phân phối.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## Mục tiêu học tập

- Giải thích lý do tại sao mục tiêu token tiếp theo của Emu3 có hiệu quả mặc dù giả định lâu năm rằng sự phân tán là cần thiết cho chất lượng hình ảnh.
- Mô tả các 3D video tokenizer: một VQ codebook không gian-thời gian trông như thế nào, tại sao các bản vá kéo dài thời gian.
- So sánh Emu3 vs Stable Diffusion XL trên (cuộc tính đào tạo, chi phí suy luận, trần chất lượng).
- Tên gọi ba vai trò mà mô hình Emu3 cùng chơi: Emu3-Gen (phần hình ảnh), Emu3-Chat (phản thức), Emu3-Stage2 (phần video).

## Vấn đề

Sự thông minh thông thường cho đến năm 2024: việc tạo ra hình ảnh cần được phổ biến. Nguyên lý: các token hình ảnh phân biệt mất quá nhiều thông tin để tái cấu trúc chi tiết, và lấy mẫu tự rút tích lũy lỗi trên hàng ngàn token. Stable Diffusion, DALL- E 3, Imagen, Midjourney đều sử dụng một số hình thức pha trộn. Chameleon (Dân 12.11) một phần bác bỏ điều này ở quy mô nhỏ nhưng không phù hợp với SDXL về chất lượng.

Emu3 tấn công lập luận trực tiếp. tuyên bố: tokenizer thị giác tốt hơn + quy mô đủ + mất token tiếp theo = tạo hình ảnh bẻ cong trong cùng mô hình cũng nhận thức.

Cuộc cá cược đã gây tranh cãi khi được công bố. Hai năm sau, gia đình thế hệ thống nhất mã nguồn mở (Emu3, Show-o, Janus-Pro, Transfusion) là con đường mặc định cho nghiên cứu; các mô hình biên giới sản xuất dường như sử dụng một số biến thể.

## Khái niệm

### Chiếc token Emu3

Thành phần chính là token thị giác. Emu3 đào tạo một token tùy chỉnh lớp IBQ (Quantizer khớp chai ngược, SBER-MoVQGAN gia đình) với độ phân giải giảm 8x8 mỗi token. Một hình ảnh 512x512 trở thành 64x64 = 4096 token ở kích thước sổ mã 32768.

Điều này lớn hơn 1024 token của Chameleon cho mỗi 512x512 ở K=8192 trên cả hai trục: bốn lần các token và một cuốn sách mã gấp bốn lần. Khả năng bổ sung mua chất lượng tái thiết.

Đối với video: một tokenizer 3D VQ mã hóa một bản vá không gian-thời gian (4 khung x 8x8 pixel) thành một số nguyên. Một clip 4s ở 8 FPS có 32 khung; ở 256x256 với giảm không gian 8x và thời gian 4x, số lượng token là (256/8) * (256/8) * (32/4) = 32 * 32 * 8 = 8,192 token.

Chất lượng tokenizer là trần nhà. đóng góp của Emu3 là một phần "chúng tôi đào tạo một tokenizer rất tốt".

### Việc đào tạo một lần mất

Emu3 sử dụng một mục tiêu: dự đoán token tiếp theo trên một từ vựng chung trên các token văn bản, token hình ảnh 2D và token video 3D. Các trọng lượng được nhân bằng các yếu tố cụ thể về phương thức trong quá trình đào tạo để cân bằng đóng góp, nhưng chức năng mất mát là giống nhau.

Đào trên một hỗn hợp của:
- Gen hình ảnh: `<text caption> <image> image_tokens </image>`
- Nhận thức hình ảnh: `<image> image_tokens </image> <question> text_tokens`
- Video Gen: `<text caption> <video> video_tokens </video>`
- Nhận thức video: tương tự.
- Chỉ có văn bản: NTP tiêu chuẩn.

Mô hình học được khi nào phát ra các token hình ảnh so với các token văn bản từ phân phối dữ liệu.`<image>`Đăng ký.

### Định hướng và nhiệt độ không có trình phân loại

Tạo hình ảnh tự động trở nên tốt hơn nhiều với hướng dẫn không phân loại (CFG) khi suy luận. Emu3 sử dụng nó: tạo hai lần, một lần với tiêu đề đầy đủ, một lần với tiêu đề trống, trộn các logit với trọng lượng hướng dẫn (tình thường 3.0-7.0). Đây là cùng một CFG trick diffusion sử dụng, vay cho cài đặt tự động.

Nhiệt độ quan trọng: quá cao, đồ tạo vật; quá thấp, chế độ sụp đổ. Nhiệt độ khuyến cáo của Emu3 là 1.0 cho nhận thức, 0,8 cho việc tạo hình ảnh.

### Ba vai, một mô hình

Tàu Emu3 như ba API khác nhau về chức năng nhưng một bộ trọng lượng cơ bản:

- Emu3-Gen. Tạo hình ảnh.
- Emu3-Chat. VQA và captioning. Input image (tokens), output text.
- Emu3-Stage2. Tạo video và video VQA. nhập văn bản hoặc video, xuất văn bản hoặc video.

Không có các mục tiêu cụ thể, chỉ là các mẫu đơn giản khác nhau, cùng một điểm kiểm soát.

### Điểm chuẩn

Từ bài báo Emu3 (Tháng 9 năm 2024):

- Tạo hình ảnh: đánh bại SDXL trên MJHQ-30K FID (5.4 vs 5.6), GenEval tổng thể (0.54 vs 0.55  liên kết thống kê), và kết hợp của Deep-Eval trên bình đẳng.
- Nhận thức hình ảnh: theo dõi LLaVA-1.6 trên VQAv2 (75.1 vs 81.8) và MMMU (31.6 vs 35.1), nhưng đánh bại nó trên SEED-Bench, OCRBench và ChartQA.
- Sản xuất video: chất lượng clip 4 giây tại FVD cạnh tranh với các mô hình được đánh giá chung của thời kỳ Sora.

Các số không phải lúc nào cũng thắng  Emu3 giao dịch một điểm ở đây cho một điểm ở đó  nhưng tuyên bố "định đoán mã thông báo tiếp theo là tất cả những gì bạn cần" là đáng bảo vệ trên tất cả các phương pháp.

### Chi phí tính toán

Emu3 là một mô hình tham số 8B. Báo cáo không công bố tổng số giờ GPU; cho quy mô, Llama-2-7B trước khi đào tạo sử dụng khoảng 184k A100 giờ GPU, khoảng 21 năm GPU. Mô hình phân tán như Stable Diffusion 3 đào tạo trong ngân sách tương tự nhưng cần bộ mã văn bản riêng biệt và đường ống dẫn phức tạp hơn.

Khi suy luận, Emu3 chậm hơn SDXL mỗi hình ảnh: 4096 mã thông báo hình ảnh ở 30 tok / s là ~ 2 phút mỗi hình ảnh 512x512 , so với 2-5 giây cho SDXL. Việc giải mã suy đoán và tối ưu hóa cache KV thu hẹp khoảng cách nhưng không đóng cửa nó. Gen hình ảnh Autoregressive là tính toán nặng; đây là sự đổi mới.

### Tại sao nó quan trọng

Sự đóng góp sâu sắc của Emu3 là khái niệm. Nếu quy mô dự đoán token tiếp theo phù hợp với sự lan truyền trên việc tạo hình ảnh, con đường mô hình thống nhất (một lỗ, một xương sống, bất kỳ phương thức nào) là khả thi. Các mô hình trong tương lai không cần các mã hóa văn bản riêng biệt, lập trình phân phối riêng biệt, VAE riêng biệt. Một biến đổi, một tokeniser cho mỗi phương thức, quy mô.

Show-o, Janus-Pro và InternVL-U đều xây dựng hoặc thách thức luận án này. Các phòng thí nghiệm Trung Quốc (BAAI, DeepSeek) xuất bản mạnh mẽ hơn các phòng thí nghiệm Mỹ vào năm 2025.

```figure
l5-emu3-next-token
```

## Sử dụng nó

`code/main.py`tạo ra hai đồ chơi:

- Một máy tính tính tính số lượng token 2D vs 3D VQ: được cho (định giải, vá, clip_length, FPS), tính toán số lượng token cho hình ảnh vs video.
- Một mẫu hình ảnh tự rút theo mã hiệu với hướng dẫn không có phân loại ở nhiệt độ.

Việc thực hiện CFG phù hợp với công thức của Emu3  trộn logit có điều kiện và không điều kiện với trọng lượng hướng dẫn.

## Chuyển nó

Bài học này sẽ mang lại kết quả `outputs/skill-token-gen-cost-analyzer.md`Với một mô hình sản phẩm thế hệ (hình ảnh hoặc video, độ phân giải mục tiêu, cấp độ chất lượng, ngân sách thời gian trễ), nó tính toán số lượng token, chi phí suy luận và chọn Emu3-family vs. diffusion.

## Các bài tập

1. Emu3 tạo ra 4096 token cho mỗi hình ảnh 512x512 với giảm 8x8. tính toán tương đương cho 1024x1024 và 2048x2048.

2. Đọc Emu3 Phần 3.3 trên video tokenizer. mô tả hình dạng vá VQ 3D và lý do tại sao nó trải dài 4 khung x 8x8 pixel thay vì một khung.

3. Đánh nặng hướng dẫn không phân loại 5.0 vs 3.0: hiệu ứng trực quan nào?`code/main.py`- Tôi không biết.

4. Lập toán FLOP đào tạo cho Emu3 (8B) với một số token 300B giả định và so sánh với Stable Diffusion 3.

5. Emu3 đánh bại SDXL trên FID nhưng không trên VQAv2 so với VLM chuyên ngành. Giải thích tại sao cách tiếp cận mất mát thống nhất cho thấy các điểm mạnh khác nhau so với các chuyên gia trên các tiêu chuẩn khác nhau.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | Standard autoregressive loss: predict token[i+1] given token[0..i]; works for every modality when tokenized |
| IBQ tokenizer | "Inverse bottleneck quantizer" | A class of VQ-VAE with larger codebooks (32768+) and better reconstruction than Chameleon's |
| 3D VQ | "Spatiotemporal quantizer" | Codebook indexed by (time, row, col); one token covers 4 frames x 8x8 pixels |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional logits with weight gamma; boosts image quality at inference |
| Unified vocabulary | "Shared tokens" | Text + image + video all draw from the same integer space; model predicts whichever modality comes next |
| MJHQ-30K | "Image gen benchmark" | Midjourney-quality benchmark with 30k prompts; Emu3 reports FID here |

## Đọc thêm

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
