# Đánh giá diễn viên  A2C và A3C

> Đăng lực là tiếng ồn.$\hat{V}(s)$A2C chạy nó đồng bộ; A3C chạy nó qua các chuỗi. Cả hai đều là mô hình tâm lý cho mọi phương pháp RL sâu hiện đại.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## Vấn đề

Vanilla ReINFORCE có hiệu quả, nhưng sự khác biệt của nó là khủng khiếp.$G_t$có thể dao động qua một nhân tố 10 giữa các tập.$\nabla \log \pi$và trung bình tạo ra một ước tính gradient mất hàng ngàn tập để di chuyển chính sách cùng khoảng cách bạn có thể di chuyển nó với nhiều hơn cập nhật DQN.

Sự khác biệt xuất phát từ việc sử dụng các lợi nhuận nguyên liệu. Nếu bạn trừ một đường cơ bản $b(s_t)$ bất kỳ hàm nào của trạng thái, bao gồm cả một giá trị được học  kỳ vọng không thay đổi và sự biến đổi giảm.$\hat{V}(s_t)$Bây giờ số lượng nhân$\nabla \log \pi$là lợi thế:

```math
A(s, a) = G - \hat{V}(s)
```

Một hành động là tốt nếu nó tạo ra lợi nhuận trên mức trung bình; xấu nếu dưới. REINFORCE với một nhà phê bình học tập là *actor-critic*. Nhà phê bình cho diễn viên một giáo viên biến thể thấp. Đây là mọi phương pháp chính sách sâu sắc sau năm 2015 (A2C, A3C, PPO, SAC, IMPALA).

## Khái niệm

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$Các nhà nghiên cứu đã được đào tạo để làm việc.
- **Critic** $V_\phi(s)$: ước tính dự kiến thu hồi từ nhà nước.$(V_\phi(s) - \text{target})^2$- Tôi không biết.

**The advantage.**Hai mẫu tiêu chuẩn:

- *Lợi thế MC:* $A_t = G_t - V_\phi(s_t)$Không thiên vị, sự khác biệt cao hơn.
- *Lợi thế TD:* $A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. Nhận định (sử dụng)$V_\phi$), sự biến động thấp hơn nhiều.$\delta_t$- Tôi không biết.

**n-step advantage.**Chuyển đổi giữa hai:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$là TD tinh khiết. $n = \infty$là MC. Hầu hết các thực hiện sử dụng $n = 5$cho Atari, $n = 2048$cho PPO trên MuJoCo.

**Generalized Advantage Estimation (GAE).**Schulman et al. (2016) đề xuất một trung bình cân nặng theo tỷ lệ theo số lượng lớn trên tất cả các lợi thế của n- bước:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

với $\lambda \in [0, 1]$- $\lambda = 0$là TD (varian thấp, thiên vị cao). $\lambda = 1$là MC (trang độ cao, không thiên vị). $\lambda = 0.95$là âm thanh mặc định 2026  cho đến khi số số bias / biến số là nơi bạn muốn nó.

**A2C: synchronous advantage actor-critic.**Thu thập$T$bước qua $N$Các môi trường song song tính lợi thế cho mỗi bước cập nhật diễn viên và nhà phê bình trên loạt kết hợp lặp lại.

**A3C: asynchronous advantage actor-critic.**Mnih et al. (2016). Spawn $N$Các work thread, mỗi người chạy một env. Mỗi worker tính toán gradient tại địa phương trên bản triển khai của riêng mình, sau đó áp dụng chúng theo cách không đồng bộ cho một máy chủ tham số chia sẻ. Không cần bộ đệm lặp lại  nhân viên giải khớp bằng cách chạy các quỹ đạo khác nhau. A3C chứng minh bạn có thể đào tạo trên CPU ở quy mô. Năm 2026, A2C dựa trên GPU (batched parallel envs) thống trị vì GPUs muốn các lô lớn.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

Ba điều khoản: lỗ theo mức chính sách, sự lùi giá trị, tiền thưởng entropy. `c_v ~ 0.5`- `c_e ~ 0.01`là các điểm khởi đầu theo luật pháp.

```figure
actor-critic
```

## Hãy xây dựng nó

### Bước 1: một nhà phê bình

Nhận xét tuyến tính$V_\phi(s) = w \cdot \text{features}(s)$được cập nhật với MSE:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

Trên một bảng xếp hạng, nhà phê bình hội tụ trong vài trăm tập. trên Atari, thay thế nhà phê bình tuyến tính bằng một shared CNN trunk + value head.

### Bước 2: lợi thế n- bước

Với một sự triển khai dài $T$và một trận chung kết không được khởi động $V(s_T)$- Có thể là:

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns`là mục tiêu của những người phê bình.`advantages`là điều nhân lên.$\nabla \log \pi$- Tôi không biết.

### Bước 3: cập nhật kết hợp

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

Chính sách, một lần phát hành mỗi bản cập nhật, tỷ lệ học tập riêng biệt cho diễn viên và nhà phê bình.

### Bước 4: Phối tương đồng (A3C vs A2C)

- **A3C:**quay lên $N$mỗi bộ chạy bản xoay của riêng mình và thông qua phía trước của riêng mình. định kỳ đẩy cập nhật gradient để một chủ shared. Không khóa trên chủ  đua là ok, họ chỉ thêm tiếng ồn.
- **A2C:**chạy$N$Env các trường hợp trong một quá trình, xếp các quan sát thành một `[N, obs_dim]`Lượng lớn hơn, tính toán xác định, dễ lý luận hơn.

Mã đồ chơi của chúng tôi là một sợi đơn cho sự rõ ràng; viết lại cho A2C đúc là ba dòng numpy.

## Những bẫy

- **Critic bias before actor gradient.**Nếu nhà phê bình là ngẫu nhiên, cơ sở của nó là không thông tin và bạn đang tập luyện trên tiếng ồn thuần túy. Đáp ấm nhà phê bình trong vài trăm bước trước khi bật gradient chính sách, hoặc sử dụng tốc độ học tập diễn viên chậm.
- **Advantage normalization.**Tiêu chuẩn hóa lợi thế cho số trung bình / đơn vị / std mỗi lô.
- **Shared trunk.**Sử dụng bộ thu thập tính năng chung cho diễn viên và nhà phê bình trên đầu vào hình ảnh. Đầu tách biệt. Các tính năng chung tự lái trên cả hai lỗ.
- **On-policy contract.**A2C sử dụng lại dữ liệu cho chính xác một bản cập nhật. Nhiều hơn và gradient của bạn bị thiên vị (chính xác lấy mẫu quan trọng là điều PPO thêm vào).
- **Entropy collapse.**Không có$c_e > 0$, chính sách trở nên gần như quyết định trong vài trăm cập nhật và ngừng khám phá.
- **Reward scale.**Tầm quan trọng lợi thế phụ thuộc vào quy mô phần thưởng. bình thường hóa phần thưởng (ví dụ, chia run-std) cho độ lớn gradient phù hợp giữa các nhiệm vụ.

## Sử dụng nó

A2C/A3C hiếm khi là lựa chọn cuối cùng vào năm 2026 nhưng chúng là kiến trúc mọi thứ sau đó tinh chỉnh:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

Nếu bạn thấy "lợi thế" trong một bài báo năm 2026, hãy nghĩ đến nhà phê bình diễn viên.

## Chuyển nó

Cứ như `outputs/skill-actor-critic-trainer.md`- Có thể là:

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## Các bài tập

1. **Easy.**Đào tạo diễn viên-chính trị với lợi thế MC $(G_t - V(s_t))$So sánh hiệu quả mẫu với REINFORCE-with-running-median-baseline từ bài học 06.
2. **Medium.**Chuyển sang lợi thế TD- residual $(r + \gamma V(s') - V(s))$- Đo sự khác biệt của các lô lợi thế.
3. **Hard.**Thực hiện GAE ((λ).$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$Phản hồi cuối cùng của bản đồ so với hiệu quả mẫu.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## Đọc thêm

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) A3C, bài báo phê bình diễn viên đồng bộ ban đầu.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) GAE.
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) nền tảng; kết hợp điều này với chương 9 về việc gần gũi chức năng khi người phê bình là một mạng thần kinh.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) có thể mở rộng phân phối các nhà phê bình diễn viên với sự sửa đổi ngoài chính sách theo dấu vết V.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) thực hiện A2C/PPO đáng đọc.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) kết quả hội tụ cơ bản cho sự phân hủy hai thang điểm diễn viên-nhân trọng.
