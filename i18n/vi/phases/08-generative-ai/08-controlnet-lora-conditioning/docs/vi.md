# ControlNet, LoRA & Conditioning

> Chỉ riêng văn bản là một tín hiệu điều khiển khó xử. ControlNet cho phép bạn sao chép một mô hình phân tán được đào tạo trước và điều khiển nó bằng một bản đồ độ sâu, hình dạng hình dạng xương, vỏ hoặc cạnh. LoRA cho phép bạn điều chỉnh một mô hình tham số 2B bằng cách đào tạo 10 triệu tham số. Cùng nhau họ đã biến Stable Diffusion từ một đồ chơi thành đường ống dẫn hình ảnh 2026 được gửi đến mọi cơ quan.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## Vấn đề

Một lời nhắc nhở như "một người phụ nữ mặc váy đỏ đi bộ một con chó trên một con đường bận rộn" không cho mô hình thông tin về * đâu * con chó, * tư thế nào * người phụ nữ đang ở, hoặc * quan điểm * của đường phố.

Việc đào tạo một mô hình điều kiện mới từ đầu cho mỗi tín hiệu (phòng, độ sâu, tinh tế, phân đoạn) là cấm kỵ. Bạn muốn giữ cho xương sống SDXL 2.6B-param được đóng băng, gắn một mạng bên nhỏ đọc điều kiện, và nó đẩy các tính năng trung gian của xương sống. đó là ControlNet.

Bạn cũng muốn dạy cho mô hình những khái niệm mới (mô hình của bạn, sản phẩm của bạn, phong cách của bạn) mà không cần đào tạo lại mô hình đầy đủ. Bạn muốn một delta nhỏ hơn 100 lần. Đó là các bộ điều chỉnh hạng thấp LoRA  kết nối với trọng lượng chú ý hiện có.

ControlNet + LoRA + text = bộ công cụ của người thực hành năm 2026. Hầu hết các ống dẫn hình ảnh sản xuất lớp 2-5 LoRA, 1-3 ControlNets và một bộ điều chỉnh IP trên đỉnh một SDXL / SD3 / Flux.

## Khái niệm

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet (Zhang et al., 2023)

Hãy lấy một SD được đào tạo trước. *Clone* một nửa mã hóa của U-Net. Đóng băng bản gốc. Trén nhân tạo để chấp nhận một đầu vào điều kiện bổ sung (về, độ sâu, tư thế). Kết nối nhân tạo trở lại phần mã hóa nửa của bản gốc với *zero-convolution* skip kết nối (1×1 convs khởi tạo thành 0  bắt đầu như một no-op, học một delta).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

Zero-conv init có nghĩa là ControlNet bắt đầu với tính cách  không gây hại ngay cả trước khi đào tạo.

Các ControlNets cho tính năng tính năng được vận chuyển như các mô hình phụ nhỏ (~ 360M cho SDXL, ~ 70M cho SD 1.5).

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu et al., 2021)

Đối với bất kỳ lớp tuyến tính nào $W \in \mathbb{R}^{d \times d}$trong mô hình, đóng băng $W$và thêm một delta hạng thấp:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

với $r \ll d$. Đường 4-16 là tiêu chuẩn cho sự chú ý, hạng 64-128 cho các âm thanh tinh tế nặng.$2 \cdot d \cdot r$thay vì $d^2$. Để SDXL chú ý với $d=640$- $r=16$: 20k params mỗi bộ điều chỉnh thay vì 410k  giảm 20x. Trên toàn bộ mô hình: một LoRA thường là 20-200MB so với 5GB cơ sở.

Khi suy luận bạn có thể mở rộng LoRA: $W' = W + \alpha \cdot B A$- $\alpha = 0.5\text{-}1.5$LoRA nhiều chồng lên bổ sung (với cảnh báo thông thường rằng chúng tương tác theo cách không tuyến tính).

### Đáp ứng IP (Ye et al., 2023)

Một bộ điều chỉnh nhỏ chấp nhận một hình ảnh như là điều kiện (cùng với văn bản). Sử dụng mã hóa hình ảnh CLIP để tạo ra các mã thông báo hình ảnh, tiêm chúng vào sự chú ý chéo bên cạnh các mã thông báo văn bản. ~ 20MB mỗi mô hình cơ sở. Cho phép bạn "tạo một hình ảnh theo phong cách của tham chiếu này" mà không cần LoRA.

## Matrix khả năng hợp tác

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

ControlNet ≈ không gian, LoRA ≈ ngữ nghĩa.

```figure
v4-controlnet-zero
```

## Hãy xây dựng nó

`code/main.py`mô phỏng hai cơ chế trên 1-D:

1. **LoRA.**Một lớp tuyến tính được huấn luyện trước $W$- Đưa máy xuống.$BA$như thế này$W + BA$phù hợp với một lớp đường thẳng mục tiêu.$r = 1$là đủ để học một sự điều chỉnh cấp 1 hoàn hảo.

2. **ControlNet-lite.**Một dự đoán "đấu chốt" và một "hạng bên" đọc một tín hiệu bổ sung.

### Bước 1: LH toán LoRA

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Bước 2: mạng bên không-init

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

Ở bước 0 đầu ra giống hệt với cơ sở.`gate`chậm rãi không có sự xoay xở thảm khốc.

## Những bẫy

- **Over-scaling LoRAs.** $\alpha = 2$hoặc $\alpha = 3$là một hack "làm nó mạnh hơn" phổ biến tạo ra các kết quả quá kiểu hóa / bị phá vỡ.$\alpha \le 1.5$- Tôi không biết.
- **ControlNet weight conflict.**Sử dụng một Pose ControlNet với trọng lượng 1.0 và một Depth ControlNet với trọng lượng 1.0 thường vượt quá.
- **LoRA on the wrong base.**SDXL LoRA âm thầm không hoạt động trên SD 1.5 vì kích thước chú ý không phù hợp.
- **Textual Inversion drift.**Các token được huấn luyện tại một điểm kiểm soát sẽ bị lôi kéo xấu ở điểm kiểm soát khác.
- **LoRA weight-merging and storage.**Bạn có thể nướng một LoRA vào các trọng lượng mô hình cơ bản để suy luận nhanh hơn (không thêm thời gian chạy), nhưng bạn mất khả năng để mở rộng $\alpha$- Giữ cả hai phiên bản.

## Sử dụng nó

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## Chuyển nó

- Cứu lại`outputs/skill-sd-toolkit-composer.md`. Nghệ năng thực hiện một nhiệm vụ (tài sản đầu vào: prompt, hình ảnh tham chiếu tùy chọn, tư thế tùy chọn, độ sâu tùy chọn, vít tùy chọn) và đưa ra các khối công cụ, trọng lượng và một giao thức hạt giống có thể tái tạo.

## Các bài tập

1. **Easy.**Trong `code/main.py`, thay đổi cấp độ LoRA `r`Từ 1 đến 4, ở mức nào LoRA chính xác phù hợp với một điểm mục tiêu hạng 2?
2. **Medium.**Đào tạo hai LoRA riêng biệt trên hai biến đổi mục tiêu. Lái chúng lại với nhau và cho thấy sự tương tác phụ gia của chúng.
3. **Hard.**Sử dụng các diffuser để xếp chồng: SDXL-base + Canny-ControlNet (tín 0.8) + một kiểu LoRA ($\alpha$0.8) + IP-Adapter (tín 0.6). đo FID-vs-quan-ngháp-đáp ứng trade-off khi các khối lượng chồng cân khác nhau.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## Thông báo sản xuất: LoRA swaps, ControlNet lanes, dịch vụ cho nhiều người thuê

Một SaaS văn bản thực tế phục vụ hàng trăm LoRA và một chục ControlNets trên cùng một điểm kiểm soát cơ sở. Vấn đề phục vụ trông giống như LLM đa thuê (bibliografi sản xuất bao gồm trường hợp LLM dưới sự phân phối liên tục và LoRAX / S-LoRA):

- **Hot-swap LoRAs, do not merge.**Thêm vào$W' = W + \alpha \cdot B \cdot A$vào cơ sở cho ~ 3-5% nhanh hơn mỗi bước suy luận nhưng đóng băng $\alpha$Giữ LoRAs nóng trong VRAM như rank-r delta; diffuser phơi bày `pipe.load_lora_weights()`+ `pipe.set_adapters([...], adapter_weights=[...])`cho kích hoạt theo yêu cầu. chi phí trao đổi là `2 · d · r · num_layers`trọng lượng  MB-scale, sub-second.
- **ControlNet as a second attention lane.**Các mã hóa được sao chép chạy song song với cơ sở. Hai ControlNets với trọng lượng 1.0 mỗi = hai vượt qua phía trước thêm mỗi bước, không phải một vượt qua hợp nhất.
- **Quantized LoRAs too.**Nếu bạn định lượng cơ sở (xem Bài học 07, Flux trên 8GB), delta LoRA cũng định lượng sạch đến 8-bit hoặc 4-bit. Loading theo kiểu QLoRA cho phép bạn xếp 5-10 LoRA trên đỉnh cơ sở Flux 4-bit mà không làm hư hỏng bộ nhớ.

Flux-specific: Niels' Flux-on-8GB notebook định lượng cơ sở thành 4 bit; xếp chồng một kiểu LoRA (`pipe.load_lora_weights("user/style-lora")`) trên cơ sở lượng tử đó tại `weight_name="pytorch_lora_weights.safetensors"`Đây là công thức mà hầu hết các công ty SaaS sẽ đưa ra vào năm 2026.

## Đọc thêm

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543)ControlNet.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) LoRA (trước đây là LLM; các cổng để pha trộn).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) Đổi IP
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) thay thế nhẹ hơn cho ControlNet.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) DreamBooth.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) đường ống dẫn tham chiếu.
