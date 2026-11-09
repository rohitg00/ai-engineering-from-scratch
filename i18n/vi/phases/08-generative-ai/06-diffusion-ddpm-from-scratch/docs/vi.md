# Các mô hình phân tán  DDPM từ đầu

> Ho, Jain, Abbeel (2020) đã cho lĩnh vực một công thức mà nó không thể ngừng. Hủy bỏ dữ liệu bằng tiếng ồn trên một ngàn bước nhỏ. Hướng dẫn một mạng lưới thần kinh để dự đoán tiếng ồn. đảo ngược quá trình khi suy luận. Ngày nay mọi hình ảnh, video, 3D và mô hình âm nhạc chính thống chạy trên vòng lặp này, có thể với các thủ thuật phù hợp hoặc phù hợp trên đầu.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## Vấn đề

Anh muốn lấy mẫu cho $p_{\text{data}}(x)$. GANs chơi một trò chơi tối thiểu mà thường khác nhau. VAEs sản xuất các mẫu mờ từ một decoder Gaussian.$\log p(x)$(vì vậy bạn có khả năng), và (c) các mẫu tương tự chất lượng SOTA.

Sohl-Dickstein et al. (2015) đã có một câu trả lời lý thuyết: xác định một chuỗi Markov $q(x_t \mid x_{t-1})$Điều này dần dần thêm tiếng ồn Gaussian, và đào tạo một chuỗi ngược.$p_\theta(x_{t-1} \mid x_t)$Ho, Jain, Abbeel (2020) cho thấy mất mát có thể được đơn giản hóa thành một dòng  dự đoán tiếng  và làm sạch toán học.

## Khái niệm

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**Thêm tiếng ồn Gaussian vào $T$Các bước nhỏ. hình thức đóng  lý do toán học có thể xử lý  là bước tích lũy cũng là Gaussian:

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

nơi $\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$cho một lịch trình của $\beta_t$- Chọn$\beta_t$từ 1e-4 đến 0,02 theo đường thẳng $T=1000$bước và $x_T$là khoảng $\mathcal{N}(0, I)$- Tôi không biết.

**Reverse process $p_\theta$.**Học một mạng lưới thần kinh$\epsilon_\theta(x_t, t)$Điều này dự đoán về tiếng ồn đã được thêm vào.$x_t$, chỉ định bằng:

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

nơi $\sigma_t$là hoặc $\sqrt{\beta_t}$hoặc một sự khác biệt học.$x_{t-1}$vì phía sau $q(x_{t-1} \mid x_t, x_0)$và thay thế $x_0$với ước tính dự đoán về tiếng ồn của nó.

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

Mô hình $x_0$từ dữ liệu, chọn một số ngẫu nhiên $t$, mẫu $\epsilon \sim \mathcal{N}(0, I)$, tính toán tiếng ồn ồn ồn ồn ồn$x_t$Một lần bắn qua hình thức đóng, và lùi lại tiếng ồn.

**Sampling.**Bắt đầu$x_T \sim \mathcal{N}(0, I)$. Lặp lại bước ngược từ $t = T$1 xong rồi.

## Tại sao nó hoạt động

Ba cảm giác:

1. **Denoising is easy; generating is hard.**Tại $t=T$, dữ liệu là tiếng ồn thuần túy  mạng phải giải quyết một vấn đề tầm thường.$t=0$, mạng chỉ cần làm sạch một vài pixel.$t$, vấn đề là khó khăn nhưng mạng có nhiều gradient chảy qua cùng một trọng lượng từ mọi mức tiếng ồn.

2. **Score matching in disguise.**Vincent (2011) chứng minh rằng dự đoán tiếng ồn tương đương với ước tính $\nabla_x \log q(x_t \mid x_0)$, điểm * điểm*. SDE ngược sử dụng điểm này để đi lên độ d density gradient  một bước ngẫu nhiên hướng về các vùng có khả năng cao.

3. **The ELBO reduces to simple MSE.**Các biến động bên dưới hoàn toàn có một thuật ngữ KL mỗi bước thời gian. Với các tham số của DDPM các thuật ngữ KL đơn giản hóa cho MSE về dự đoán tiếng ồn với các hệ số cụ thể; Ho giảm các hệ số (chẳng định nó là "simple" mất mát) và chất lượng * cải thiện*.

```figure
diffusion-denoise
```

## Hãy xây dựng nó

`code/main.py`thực hiện một DDPM 1D. Dữ liệu là một hỗn hợp hai chế độ. "Net" là một MLP nhỏ mà mất$(x_t, t)$và các kết quả dự đoán tiếng ồn. đào tạo là mất một dòng. lấy mẫu lặp lại chuỗi ngược.

### Bước 1: lịch trình tiến hành (mẫu đóng)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### Bước 2: mẫu`x_t`trong một cú bắn

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### Bước 3: một bước đào tạo

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### Bước 4: lấy mẫu ngược

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

Đối với một vấn đề 1-D với 40 bước thời gian và 24 đơn vị MLP, điều này học được hỗn hợp hai chế độ trong ~ 200 thời đại.

## Điều kiện thời gian

Mạng cần biết nó đang chỉ ra thời gian nào.

- **Sinusoidal embedding.**Giống như Transformer định vị mã hóa.$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$- Đi qua một MLP, phát sóng lên mạng.
- **Film / group-norm conditioning.**Dự án tích hợp theo quy mô/chânal (FiLM) tại mỗi khối.

Mã đồ chơi của chúng tôi sử dụng sinusoidal → concat.

## Những bẫy

- **Schedule matters a lot.**Đường thẳng$\beta$là DDPM mặc định nhưng lịch trình cosine (Nichol & Dhariwal, 2021) cung cấp FID tốt hơn cho cùng một tính toán.
- **Timestep embedding is fragile.**Tới qua .$t$như một float hoạt động cho đồ chơi 1-D nhưng thất bại cho hình ảnh; luôn sử dụng một nhúng đúng.
- **V-prediction vs ε-prediction.**Đối với các chế độ hẹp (t rất nhỏ hoặc rất lớn), $\epsilon$có tín hiệu-đồn kém.$v = \alpha \cdot \epsilon - \sigma \cdot x$) ổn định hơn; SDXL, SD3 và Flux sử dụng nó.
- **Classifier-free guidance.**Khi suy luận, tính toán cả điều kiện và vô điều kiện $\epsilon$, sau đó $\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$với $w \approx 3\text{-}7$- Được đề cập trong Bài học 8.
- **1000 steps is a lot.**Việc sản xuất sử dụng DDIM (20-50 bước), DPM-Solver (10-20 bước) hoặc chưng cất (1-4 bước).

## Sử dụng nó

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

Sự pha trộn là xương sống tạo ra phổ quát. Sự phù hợp dòng chảy (Dạy học 13) là đối thủ cạnh tranh 2024-2026 thường chiến thắng trên tốc độ suy luận cho chất lượng tương tự.

## Chuyển nó

- Cứu lại`outputs/skill-diffusion-trainer.md`. Skill lấy một bộ dữ liệu + ngân sách tính toán và đầu ra: lịch trình (lín/cosine/sigmoid), mục tiêu dự đoán (ε/v/x), số bước, quy mô hướng dẫn, gia đình mẫu và một giao thức đánh giá.

## Các bài tập

1. **Easy.**Thay đổi T từ 40 lên 10 trong `code/main.py`. Làm thế nào chất lượng mẫu (histogram hình ảnh của các sản phẩm) suy giảm?
2. **Medium.**Chuyển từ dự đoán ε sang dự đoán v. Lấy lại bước ngược. So sánh chất lượng mẫu cuối cùng.
3. **Hard.**Thêm hướng dẫn không có phân loại.$c \in \lbrace 0, 1 \rbrace$, giảm nó 10% thời gian trong quá trình đào tạo, và trong thời gian lấy mẫu sử dụng $\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$- đo tỷ lệ bị ảnh hưởng theo chế độ điều kiện ở $w = 0, 1, 3, 7$- Tôi không biết.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | Fixed Markov chain $q(x_t \mid x_{t-1})$ that destroys the data. |
| Reverse process | "Denoising" | Learned chain $p_\theta(x_{t-1} \mid x_t)$ that reconstructs the data. |
| β schedule | "The noise ladder" | Per-step variance; linear, cosine, or sigmoid. |
| α̅ | "Alpha bar" | Cumulative product $\prod (1 - \beta)$; gives closed-form $x_t$ from $x_0$. |
| Simple loss | "MSE on noise" | $\lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$; all variational derivations collapse to this. |
| ε-prediction | "Predict noise" | Output is the noise added; standard DDPM. |
| V-prediction | "Predict velocity" | Output is $\alpha \cdot \epsilon - \sigma \cdot x$; better conditioning across t. |
| DDPM | "The paper" | Ho et al. 2020; linear β, 1000 steps, U-Net. |
| DDIM | "Deterministic sampler" | Non-Markov sampler, 20-50 steps, same training objective. |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional noise predictions to amplify conditioning. |

## Lưu ý sản xuất: suy luận phân tán là một vấn đề đếm từng bước

Bảng DDPM chạy các bước ngược T=1000. Không ai đưa ra trong sản xuất. Mỗi đống suy luận thực sự chọn một trong ba chiến lược  và mỗi bản đồ sạch sẽ đến khung sản xuất của "tạm thời đến từ đâu":

1. **Faster sampler, same model.**DDIM (20-50 bước), DPM-Solver++ (10-20), UniPC (8-16).$\epsilon_\theta$- Cắt độ trễ 20 đến 50 lần.
2. **Distillation.**Căn nuôi học sinh để phù hợp với giáo viên trong ít bước: Phân phối tiến bộ (2 → 1), Mô hình nhất quán (tự nguyện → 1-4), LCM, SDXL-Turbo, SD3-Turbo. Giảm độ trễ thêm 5-10x, đòi hỏi phải tái đào tạo.
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`, các hậu cảnh phân tán của TensorRT-LLM,`xformers`/SDPA chú ý, bf16 trọng lượng. Giảm độ trễ mỗi bước ~ 2x.

Đối với một máy chủ truyền tải sản xuất, cuộc trò chuyện về ngân sách giống như văn học sản xuất mô tả cho LLM: độ trễ là `num_steps × step_cost + VAE_decode`, thông qua là `batch_size × (num_steps × step_cost)^-1`TTFT là nhỏ (một bước); TPOT tương đương với thời gian phản ứng đầy đủ vì việc tạo hình ảnh là "tất cả một lần" từ quan điểm của người dùng.

## Đọc thêm

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) giấy truyền, trước thời gian của nó.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) DDPM.
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) DDIM, ít bước hơn.
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) lịch trình cosine, học biến.
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) hướng dẫn về phân loại.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG.
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) ghi chú thống nhất, công thức sạch nhất.
