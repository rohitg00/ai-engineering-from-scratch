# Đơn, vẽ ngoài và chỉnh sửa hình ảnh

> Text-to-image tạo ra những thứ mới. Inpainting sửa chữa những thứ cũ. Trong sản xuất, 70% công việc hình ảnh có thể thanh toán là chỉnh sửa  thay đổi nền, loại bỏ logo, mở rộng tấm vải, tái tạo một tay. Inpainting là nơi sự lan truyền kiếm được sự duy trì của nó.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## Vấn đề

Một khách hàng gửi một bức ảnh sản phẩm hoàn hảo với một dấu hiệu làm phân tâm ở nền. Bạn muốn xóa dấu hiệu và để lại mọi thứ khác giống hệt như pixel. Bạn không thể chạy văn bản sang hình ảnh từ đầu  kết quả sẽ có một màu sắc khác nhau, ánh sáng khác nhau, góc sản phẩm khác nhau. Bạn muốn tái tạo *chỉ * khu vực che giấu, và bạn muốn tái tạo tôn trọng bối cảnh xung quanh.

Đó là vẽ tranh.

- **Inpainting.**Tạo lại trong mặt nạ, giữ bên ngoài các pixel.
- **Outpainting.**Tạo lại bên ngoài mặt nạ (hoặc bên ngoài tấm vải), giữ bên trong.
- **Image editing.**Tạo lại toàn bộ hình ảnh nhưng giữ sự trung thành về ngữ nghĩa hoặc cấu trúc với bản gốc (SDEdit, InstructPix2Pix).

Mỗi đường ống dẫn phân phối vào năm 2026 đều có chế độ vẽ màu. Flux.1-Fill, Stable Diffusion Inpaint, SDXL-Inpaint, DALL-E 3 Edit.

## Khái niệm

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### Cách tiếp cận ngây thơ (và tại sao nó sai)

Đưa một hình ảnh theo tiêu chuẩn bằng một mặt nạ. Mỗi bước lấy mẫu, thay thế vùng không che giấu của âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh âm thanh.

### Mô hình sơn đúng

Đưa một mạng U-Net được sửa đổi sử dụng 9 kênh nhập thay vì 4:

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

Các kênh bổ sung là một bản sao của hình ảnh nguồn mã hóa VAE cộng với một mặt nạ đơn kênh. Trong thời gian đào tạo, bạn ngẫu nhiên che giấu các khu vực của hình ảnh và đào tạo mô hình chỉ để chỉ định khu vực che giấu trong khi khu vực không che giấu được đưa ra như một tín hiệu điều kiện sạch.

SD-Inpaint, SDXL-Inpaint, Flux-Fill đều sử dụng đầu vào 9 kênh (hoặc tương tự).`StableDiffusionInpaintPipeline`- `FluxFillPipeline`- Tôi không biết.

### SDEdit (Meng et al., 2022)  chỉnh sửa miễn phí

Thêm tiếng ồn vào hình ảnh nguồn lên đến một số trung gian `t`, sau đó chạy chuỗi ngược từ `t`xuống 0 với một lời nhắc mới không có đào tạo lại lựa chọn bắt đầu`t`thương mại trung thành cho tự do sáng tạo:

- `t/T = 0.3`→ gần giống nhau với nguồn, thay đổi phong cách nhỏ
- `t/T = 0.6`→ chỉnh sửa vừa phải, giữ lại cấu trúc thô
- `t/T = 0.9`→ được tạo ra từ gần tiếng ồn, bảo quản nguồn tối thiểu

### InstructPix2Pix (Brooks et al., 2023)

Định chỉnh mô hình phân tán trên `(input_image, instruction, output_image)`Khi suy luận, điều kiện trên cả hình ảnh nhập và một hướng dẫn văn bản ("mở nó hoàng hôn", "lên một con rồng"). Hai thang CFG: thang hình ảnh và thang văn bản.

### RePaint (Lugmayr et al., 2022)

Giữ một mô hình phân tán vô điều kiện tiêu chuẩn. Ở mỗi bước ngược, lấy lại mẫu  nhảy trở lại trạng thái tiếng ồn nhiều lần và tái tạo. Tránh các đồ tạo biên giới. Được sử dụng khi bạn không có mô hình sơn được đào tạo.

```figure
inpaint-mask-reinject
```

## Hãy xây dựng nó

`code/main.py`thực hiện một kế hoạch sơn đồ chơi 1-D trên dữ liệu 5 chiều. Chúng tôi đào tạo một DDPM trên dữ liệu hỗn hợp 5 chiều nơi mỗi mẫu là 5 floats từ một trong hai cluster. Khi suy luận, chúng tôi "mái" 2 trong 5 chiều, tiêm phiên bản tiếng ồn về phía trước của 3 không mặt nạ ở mỗi bước, và tái tạo chỉ các chiều mặt nạ.

### Bước 1: Dữ liệu DDPM 5-D

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### Bước 2: Đánh giá tàu trên tất cả 5 điểm tối

DDPM tiêu chuẩn. Khả năng phát ra tiếng ồn 5D cho đầu vào tiếng ồn 5D.

### Bước 3: khi suy luận, mặt nạ nhận thức ngược

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

Đây là cách tiếp cận ngây thơ và nó hoạt động trên dữ liệu đồ chơi 1-D. Việc vẽ hình ảnh thực sự sử dụng đầu vào 9 kênh vì sự liên kết kết kết cấu quan trọng hơn.

### Bước 4: vẽ

Chất vẽ ngoài là vẽ với mặt nạ đảo ngược: che mặt nạ mới (họ chưa tồn tại trước đây), lấp đầy phần còn lại với nguyên bản. Mục tiêu đào tạo giống nhau.

## Những bẫy

- **Seams.**Cách tiếp cận ngây thơ để lại ranh giới hiển thị bởi vì thông tin gradient không chảy qua mặt nạ. Giải quyết: mở rộng mặt nạ 8-16 pixel, hoặc sử dụng mô hình sơn đúng.
- **Mask leakage.**Nếu khu vực không che mặt của hình ảnh điều hòa là chất lượng thấp hoặc tiếng ồn, nó làm ô nhiễm thế hệ bên trong mặt nạ.
- **CFG interacts with mask size.**CFG cao trên một mặt nạ nhỏ = vá bão hòa. Giảm CFG cho các chỉnh sửa nhỏ.
- **SDEdit fidelity cliff.**Từ `t/T = 0.5`đến`t/T = 0.6`Có thể mất danh tính của đối tượng.
- **Prompt mismatch.**Lời nhắc phải mô tả hình ảnh toàn bộ, không chỉ là nội dung mới. "Một con mèo ngồi trên ghế" chứ không phải "một con mèo".

## Sử dụng nó

| Task | Pipeline |
|------|----------|
| Remove object, small mask | SD-Inpaint or Flux-Fill, standard prompt |
| Replace sky | SD-Inpaint + "blue sky at sunset" |
| Extend canvas | SDXL outpaint mode (8px feather) or Flux-Fill with outpaint mask |
| Regenerate hand / face | SD-Inpaint with prompt re-describing the subject + ControlNet-Openpose |
| Change style of one region | SDEdit at `t/T=0.5` on masked region |
| "Make it sunset" | InstructPix2Pix or Flux-Kontext |
| Background replacement | SAM mask → SD-Inpaint |
| Ultra-high-fidelity | Flux-Fill or GPT-Image (hosted) for hardest cases |

SAM (Meta's Segment Anything, 2023) + diffusion inpaint là đường ống xóa nền 2026 SAM 2 (2024) hoạt động trên video.

## Chuyển nó

- Cứu lại`outputs/skill-editing-pipeline.md`. Skill lấy hình ảnh gốc + mô tả chỉnh sửa + mặt nạ tùy chọn (hoặc lời nhắc SAM) và đầu ra: cách tiếp cận tạo mặt nạ, mô hình cơ sở, thang CFG (hình ảnh + văn bản), chế độ SDEdit-t hoặc inpainting, và danh sách kiểm tra QA.

## Các bài tập

1. **Easy.**Trong `code/main.py`, thay đổi phần các kích thước được che giấu từ 0,2 đến 0,8. Ở phần nào chất lượng sơn (tại còn lại trong sơn bị che giấu) bằng với việc tạo ra không điều kiện?
2. **Medium.**Thực hiện RePaint: ở mỗi bước ngược thứ 10, nhảy lại 5 bước (làm thêm tiếng ồn) và tái xác định.
3. **Hard.**Sử dụng các chất pha trộn khuôn mặt để so sánh: SD 1.5 Inpaint + ControlNet-Openpose vs Flux.1-Tập vào 20 nhiệm vụ tái tạo khuôn mặt.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Inpainting | "Fill the hole" | Regenerate inside a mask; keep outside pixels. |
| Outpainting | "Extend the canvas" | Regenerate outside the canvas; keep inside. |
| 9-channel U-Net | "Proper inpainting model" | U-Net with `noisy \| encoded-source \| mask` as input. |
| SDEdit | "Img2img with noise level" | Noise to time `t`, denoise with new prompt. |
| InstructPix2Pix | "Text-only edits" | Fine-tuned diffusion on (image, instruction, output) triples. |
| RePaint | "No retraining" | Re-noise periodically during reverse to reduce seams. |
| SAM | "Segment Anything" | Mask generator by clicks or boxes; pairs with inpaint. |
| Flux-Kontext | "Edit with context" | Flux variant that accepts a reference image + instruction for edits. |

## Lưu ý sản xuất: edit pipelines là nhạy cảm với độ trễ

Người dùng chỉnh sửa hình ảnh mong đợi các chuyến đi vòng vòng dưới 5 giây. Một SDXL-Inpaint 30 bước ở 10242 là 3-4 s trên một L4, cộng với SAM mask generation (~ 200 ms) và VAE encode/decode (~ 500 ms kết hợp). Trong khung sản xuất, đây là TTFT-bound thay vì thông suất-bound  batch 1, đồng thời thấp, giảm thiểu mọi giai đoạn:

- **SAM-H is the slow one.**SAM-H ở 10242 là ~ 200 ms; SAM-ViT-B là ~ 40 ms với mất chất lượng nhỏ. SAM 2 (video) thêm chi phí trên thời gian; không sử dụng nó cho chỉnh sửa hình ảnh đơn.
- **Skip the encode when possible.** `pipe.image_processor.preprocess(img)`mã hóa cho laten. Nếu bạn có các laten từ thế hệ trước (đặc trưng trong UI chỉnh sửa lặp lại), truyền chúng trực tiếp qua `latents=...`để bỏ qua một mã VAE.
- **Mask dilation matters for throughput too.**Một mặt nạ nhỏ có nghĩa là hầu hết các thông qua U-Net đi trước bị lãng phí (những pixel không được che nạ đều bị chặt). `diffusers`" `StableDiffusionInpaintPipeline`chạy toàn bộ U-Net bất kể; chỉ có các phiên bản 9 kênh đúng màu khai thác tính toán ẩn.
- **Flux-Kontext is the 2025 answer.**Đơn vị đi trước đi qua `(source_image, instruction)`Không có mặt nạ riêng biệt, không có thanh sôi SDEdit. trên một H100 nó gửi một chỉnh sửa trong ~ 1,5 s. Bài học kiến trúc: sụp đổ các giai đoạn.

## Đọc thêm

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) Đơn không được đào tạo.
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) SDEdit.
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) chỉnh sửa hướng dẫn văn bản.
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643)SAM, nguồn mặt nạ.
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) video SAM.
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) chỉnh sửa cấp độ chú ý.
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) 2024 công cụ.
