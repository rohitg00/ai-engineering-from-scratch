# Tương thích dòng chảy và dòng chảy được sửa chữa

> Các mô hình phân phối thực hiện các bước lấy mẫu 20-50 bởi vì chúng đi theo một con đường cong từ tiếng ồn đến dữ liệu. Sự phù hợp dòng chảy (Lipman et al., 2023) và dòng chảy chỉnh sửa (Liu et al., 2022) được đào tạo bằng các con đường thẳng. Các con đường thẳng hơn có nghĩa là ít bước hơn có nghĩa là suy luận nhanh hơn. Stable Diffusion 3, Flux.1, và AudioCraft 2 tất cả chuyển sang sự phù hợp dòng chảy vào năm 2024.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## Vấn đề

Quá trình ngược của DDPM là một bước đi stochastic 1000 bước từ $\mathcal{N}(0, I)$DDIM đã phá vỡ nó thành 20-50 bước xác định. Bạn muốn ít hơn các bước  lý tưởng là một.

Nếu bạn có thể đào tạo mô hình như vậy rằng con đường từ tiếng ồn đến dữ liệu là một đường thẳng, một bước đơn giản của Euler từ $t=1$đến$t=0$sẽ hoạt động. Tích hợp dòng chảy xây dựng điều này trực tiếp: xác định một sự phân cực thẳng từ$x_1 \sim \mathcal{N}(0, I)$đến$x_0 \sim \text{data}$, tập hợp một trường vector $v_\theta(x, t)$để phù hợp với phái sinh thời gian của nó, tích hợp khi suy luận.

Phong trào sửa đổi (Liu 2022) đi xa hơn: lặp đi lặp lại khớp các con đường bằng một thủ tục tái lưu dẫn đến một ODE dần gần hơn đến tuyến tính. Sau hai lần tái lưu, một mẫu 2 bước phù hợp với chất lượng DDPM 50 bước.

## Khái niệm

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### Dòng chảy thẳng

Định nghĩa:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

nơi $x_0 \sim \text{data}$và $x_1 \sim \mathcal{N}(0, I)$. Tiến dẫn thời gian dọc theo đường thẳng này là không đổi:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

Định nghĩa một trường vector thần kinh $v_\theta(x_t, t)$và đào tạo nó để phù hợp với phái sinh này:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

Đây là **conditional flow matching**Lỗ tập không có mô phỏng: bạn không bao giờ mở ODE. Chỉ cần lấy mẫu$(x_0, x_1, t)$và lùi lại.

### Tiêu chuẩn

Khi suy luận, tích hợp trường vector học * trở lại* trong thời gian:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

Bắt đầu từ $x_1 \sim \mathcal{N}(0, I)$, bước Euler xuống $t=0$- Tôi không biết.

### Lượng lưu lượng được sửa đổi (Liu 2022)

dòng chảy thẳng hoạt động nhưng các con đường học được không thực sự thẳng$x_0$- Có thể được lập bản đồ cho cùng một điểm$x_1$. bước tái lưu của dòng chảy được sửa chữa:

1. Mô hình dòng chảy tàu $v_1$với các cặp ngẫu nhiên.
2. Mô hình N cặp $(x_1, x_0)$bằng cách tích hợp $v_1$từ $x_1$đến khi hạ cánh $x_0$- Tôi không biết.
3. Đào tàu $v_2$Vì các cặp hiện nay là "ODE-tích hợp", các interpolant thẳng giữa chúng thực sự phẳng hơn.
4. Lặp lại.

Trong thực tế, 2 lặp lại tái lưu đưa bạn đến gần tuyến tính, cho phép suy luận 2-4 bước. SDXL-Turbo, SD3-Turbo, LCM đều là mô hình khâu khâu từ dòng chảy phù hợp.

### Tại sao đây là chiến thắng cho hình ảnh năm 2024

Ba lý do:

1. **Simulation-free training** không có ODE được thả ra trong quá trình đào tạo, không cần thiết để thực hiện.
2. **Better loss geometry** Các đường thẳng có tín hiệu-xồn nhất quán, trong khi DDPM ε-loss có SNR xấu ở các cạnh lịch trình.
3. **Faster inference** 4-8 bước ở chất lượng SDXL-Turbo; 1 bước với chưng cất phù hợp.

## Tương thích dòng chảy so với DDPM  kết nối chính xác

Tương thích dòng chảy với một con đường Gaussian-conditional là phân tán *with a specific noise schedule*.$x_t = \alpha(t) x_0 + \sigma(t) x_1$thời gian và dòng chảy phù hợp phục hồi Stratonovich-reformed phân tán với $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$Hai con đường này là tương đương với đường dẫn Gaussian.

Những gì phù hợp dòng chảy đã thêm vào: độ rõ ràng của mục tiêu (một tốc độ đơn giản), một mất mát sạch hơn, và giấy phép để thử nghiệm với các chất can thiệp không Gaussian.

```figure
normalizing-flow
```

## Hãy xây dựng nó

`code/main.py`thực hiện sự phù hợp dòng chảy 1-D trên một hỗn hợp Gaussian hai chế độ.$v_\theta(x, t)$là một MLP nhỏ được đào tạo với mục tiêu thẳng. Khi suy luận, tích hợp 1, 2, 4 và 20 bước của Euler và so sánh chất lượng mẫu.

### Bước 1: mất tập luyện

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### Bước 2: Kết luận nhiều bước

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### Bước 3: so sánh số bước

Hi vọng mẫu 4 bước sẽ phù hợp với chất lượng 20 bước  một vấn đề lớn cho thời gian trễ.

## Những bẫy

- **Time parameterization.**Sử dụng phù hợp dòng chảy $t \in [0, 1]$với $t=0$trong dữ liệu, $t=1$DDPM sử dụng $t \in [0, T]$với $t=0$trong dữ liệu, $t=T$cùng hướng, khác nhau quy mô, báo cáo luôn sai lầm.
- **Schedule choice.**Dòng thẳng của dòng chảy được sửa là "the" dòng chảy phù hợp lịch trình, nhưng bạn có thể sử dụng cosine hoặc logit-normal t-sampling (SD3 làm điều này) để bao phủ quy mô tốt hơn.
- **Reflow cost.**Tạo bộ dữ liệu kết hợp để tái lưu là một thông qua suy luận đầy đủ cho mỗi mẫu. Chỉ làm tái lưu khi bạn thực sự cần suy luận 1-2 bước.
- **Classifier-free guidance still applies.**Chỉ cần đổi $\epsilon$cho $v$trong kết hợp tuyến tính: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$- Tôi không biết.

## Sử dụng nó

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

Bất cứ khi nào một bài báo nói "quá nhanh hơn sự pha trộn" trong năm 2025-2026, nó gần như luôn luôn là dòng chảy phù hợp + chưng cất.

## Chuyển nó

- Cứu lại`outputs/skill-fm-tuner.md`. Skill lấy một mô hình mô hình kiểu phân tán và chuyển đổi nó thành một cấu hình đào tạo phù hợp với dòng chảy: lựa chọn lịch trình, phân phối mẫu thời gian (tương đồng / logit- bình thường), tối ưu, kế hoạch tái lưu, con số bước mục tiêu, giao thức đánh giá.

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`và so sánh 1 bước vs 20 bước MSE vs phân phối dữ liệu thực.
2. **Medium.**Thay đổi đồng phục$t$lấy mẫu thành logit-normal (đồng độ lấy mẫu ở giữa t).
3. **Hard.**Thực hiện một lần lặp lại dòng chảy: tạo cặp $(x_0, x_1)$bằng cách tích hợp mô hình đầu tiên, đào tạo mô hình thứ hai trên các cặp, và so sánh chất lượng mẫu 1 bước.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Flow matching | "Straight-line diffusion" | Train $v_\theta(x, t)$ to match $x_1 - x_0$ along an interpolant. |
| Rectified flow | "Reflow" | Iterative procedure that straightens learned flows. |
| Velocity field | "v_θ" | Output of the model — the direction to move $x_t$. |
| Straight-line interpolant | "The path" | $x_t = (1-t) \cdot x_0 + t \cdot x_1$; trivial target derivative. |
| Euler sampler | "1st order ODE solver" | Simplest integrator; works well when paths are straight. |
| Logit-normal t | "SD3 sampling" | Concentrate $t$ sampling toward mid-values where gradients are strongest. |
| Consistency distillation | "1-step sampler" | Train a student to map any $x_t$ directly to $x_0$. |
| CFG with velocity | "v-CFG" | $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$; same trick, new variable. |

## Lưu ý sản xuất: Flux.1-schnell là dòng chảy phù hợp với tốc độ nhanh nhất của nó

Chiến thắng sản xuất của Flow matching là Flux.1-schnell  một DiT phù hợp với dòng chảy được chưng cất đến 1-4 bước suy luận trong khi vẫn giữ chất lượng cấp độ Flux-dev. sổ ghi chép "Run Flux trên một máy 8GB" của Niels là công thức triển khai tham khảo: T5 + CLIP mã hóa, định nghĩa MMDiT định lượng (trong 4 bước cho nhanh vs 50 cho dev), VAE mã hóa.

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

Quy tắc sản xuất: **flow-matched base + distillation = the 2026 default for fast text-to-image.**Mỗi nhà cung cấp lớn đều cung cấp bộ kết hợp này: SD3-Turbo (SD3 + dòng chảy + chưng cất), Flux-schnell (Flux-dev + chỉnh dòng chảy), CogView-4-Flash.

## Đọc thêm

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) dòng chảy được chỉnh sửa.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) dòng chảy phù hợp.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, lưu lượng được chỉnh sửa ở quy mô.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) khung chung bao gồm FM + phát tán.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) 1 bước chưng cất của sự pha trộn / dòng chảy.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) biến thể turbo.
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) dòng chảy phù hợp trong sản xuất.
