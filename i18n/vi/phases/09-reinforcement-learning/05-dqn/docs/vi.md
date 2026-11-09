# Deep Q-Networks (DQN)

> 2013: Mnih đào tạo một mạng học Q trên các pixel nguyên liệu, đánh bại mọi đại lý RL cổ điển trên bảy trò chơi Atari. 2015: mở rộng đến 49 trò chơi, được xuất bản trên Nature, đã kích hoạt thời đại RL sâu. DQN là học Q cộng với ba thủ thuật làm cho việc gần gũi chức năng ổn định.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## Vấn đề

Tablar Q-learning cần một giá trị Q riêng biệt cho mỗi cặp (thế độ, hành động). Một bảng cờ vua có ~1043 trạng thái. Một khung Atari là 210 × 160 × 3 = 100,800 tính năng. Tablar RL chết ở hàng ngàn trạng thái, chưa kể hàng tỷ.

Sự khắc phục rõ ràng khi nhìn lại: thay thế bảng Q bằng một mạng lưới thần kinh,$Q(s, a; \theta)$Nhưng việc gần gũi với hàm tính ngây thơ với việc học Q khác nhau dưới "triad chết người"  gần gũi với hàm tính + khởi động + học ngoài chính sách. Mnih et al. (2013, 2015) xác định ba thủ thuật kỹ thuật ổn định học tập:

1. **Experience replay**decorreates chuyển đổi.
2. **Target network**làm đông lạnh mục tiêu khởi động.
3. **Reward clipping**bình thường hóa độ lớn của gradient.

DQN trên Atari là lần đầu tiên một kiến trúc duy nhất với một bộ siêu tham số duy nhất giải quyết hàng chục vấn đề điều khiển từ các pixel thô. Mọi thứ "độ-RL" được xây dựng kể từ DDQN, Rainbow, Dueling, phân phối, R2D2, Agent57  được xếp chồng lên trên đỉnh của cơ sở ba trò chơi này.

## Khái niệm

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**DQN giảm thiểu sự mất TD một bước trên chức năng Q thần kinh:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$= mạng trực tuyến, cập nhật từng bước theo độ giảm gradient. $\theta^-$= mạng mục tiêu, thường xuyên sao chép từ $\theta$(mỗi ~ 10.000 bước). $D$= Buffer play của quá trình chuyển đổi trước đây.

**The three tricks, in order of importance:**

**Experience replay.**Một bộ đệm vòng của `~10⁶`mỗi bước đào tạo lấy mẫu một bộ nhỏ một cách ngẫu nhiên. Điều này phá vỡ mối tương quan thời gian (chốt khung liên tiếp gần như giống nhau), cho phép mạng học hỏi từ những chuyển đổi rác mẻ nhiều lần, và gỡ liên tục cập nhật gradient.

**Target network.**Sử dụng mạng tương tự $Q(\cdot; \theta)$trên cả hai bên của phương trình Bellman làm cho mục tiêu di chuyển mỗi cập nhật  "cách đuôi của riêng bạn".$Q(\cdot; \theta^-)$Với trọng lượng đông lạnh.$C$bước, sao chép $\theta \to \theta^-$Điều này ổn định mục tiêu hồi quy cho hàng ngàn bước gradient cùng một lúc.$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(được sử dụng trong DDPG, SAC) là một biến thể mượt mà hơn.

**Reward clipping.**Tầm thưởng của Atari dao động từ 1 đến 1000+.$\lbrace-1, 0, +1 \rbrace$sai khi mức độ thưởng quan trọng, tốt cho Atari khi chỉ cần ký kết quan trọng.

**Double DQN.**Hasselt (2016) khắc phục sự thiên vị tối đa hóa: sử dụng mạng trực tuyến để *chọn* hành động, mạng mục tiêu để *chánh giá* nó.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

Đổi lại, luôn tốt hơn.

**Other improvements (Rainbow, 2017):**phát lại ưu tiên (ví dụ chuyển đổi lỗi TD cao hơn), kiến trúc đấu đôi (lỗi $V(s)$và đầu lợi thế), mạng ồn ào (khám phá học tập), n- bước trả về, phân phối Q (C51/QR-DQN), multi- bước khởi động.

```figure
f3-dqn-stability
```

## Hãy xây dựng nó

Mã ở đây là stdlib-only numpy-free  chúng tôi sử dụng một MLP một lớp ẩn được quét bằng tay trên một GridWorld liên tục nhỏ, vì vậy mỗi bước đào tạo chạy trong microsecond.

### Bước 1: Buffer play

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

~106 dung lượng cho Atari, như trong DQN ban đầu (nó thu thập 50.000 chuyển đổi trước khi bắt đầu học); 5.000 đủ cho môi trường đồ chơi của chúng tôi.

### Bước 2: một mạng Q nhỏ (MLP thủ công)

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

Chuyển đi phía trước: tuyến tính → ReLU → tuyến tính. Đó là toàn bộ lưới.

### Bước 3: Cập nhật DQN

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

Hình dạng là Q-làm học từ Bài học 04 với hai khác biệt: (a) chúng ta backprop thông qua một phân biệt $Q(\cdot; \theta)$thay vì chỉ mục hóa một bảng, (b) mục tiêu sử dụng $Q(\cdot; \theta^-)$- Tôi không biết.

### Bước 4: vòng ngoài

Đối với mỗi tập, hãy hành động khiêu dâm.$Q(\cdot; \theta)$, đẩy chuyển đổi vào bộ đệm, lấy mẫu một mini batch, thực hiện một bước nghiêng, theo thời gian đồng bộ $\theta^- \leftarrow \theta$- Mẫu:

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

Trên mạng lưới GridWorld nhỏ bé của chúng tôi với trạng thái 16 chiều, đại lý học được một chính sách gần như tối ưu trong khoảng 500 tập.

## Những bẫy

- **Deadly triad.**Phân tích chức năng + ngoại chính sách + bootstrapping có thể khác nhau. DQN giảm nhẹ với target net + replay; không loại bỏ cả hai.
- **Exploration.**ε phải phân hủy, thường từ 1.0 đến 0.01 trong ~ 10% đầu tiên của đào tạo.
- **Overestimation.** `max`Over noise Q là thiên hướng lên. luôn sử dụng Double DQN trong sản xuất.
- **Reward scale.**Clip hoặc bình thường hóa phần thưởng; độ lớn gradient tương xứng với độ lớn phần thưởng.
- **Replay buffer coldstart.**Đừng tập luyện cho đến khi bộ đệm có vài ngàn chuyển tiếp.
- **Target sync frequency.**Thường xuyên quá ≈ không có lưới mục tiêu; quá hiếm ≈ mục tiêu lỗi thời. Atari DQN sử dụng 10.000 bước env. Quy tắc ngón tay: đồng bộ hóa mỗi ~1/100 chân trời huấn luyện.
- **Observation preprocessing.**Atari DQN xếp 4 khung để làm cho trạng thái Markov. bất kỳ env với thông tin tốc độ cần khung xếp hoặc trạng thái lặp lại.

## Sử dụng nó

Năm 2026, DQN hiếm khi là hiện đại nhưng vẫn là thuật toán tham chiếu ngoài chính sách:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

Các bài học vẫn đi lại. Phân hồi và các mạng mục tiêu xuất hiện trong SAC, TD3, DDPG, SAC-X, bộ đệm tự chơi của AlphaZero và mọi phương pháp RL ngoại tuyến.

## Chuyển nó

Cứ như `outputs/skill-dqn-trainer.md`- Có thể là:

```markdown
---
name: dqn-trainer
description: Produce a DQN training config (buffer, target sync, ε schedule, reward clipping) for a discrete-action RL task.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Given a discrete-action environment (observation shape, action count, horizon, reward scale), output:

1. Network. Architecture (MLP / CNN / Transformer), feature dim, depth.
2. Replay buffer. Capacity, minibatch size, warmup size.
3. Target network. Sync strategy (hard every C steps or soft τ).
4. Exploration. ε start / end / schedule length.
5. Loss. Huber vs MSE, gradient clip value, reward clipping rule.
6. Double DQN. On by default unless explicit reason to disable.

Refuse to ship a DQN with no target network, no replay buffer, or ε held at 1. Refuse continuous-action tasks (route to SAC / TD3). Flag any reward range > 10× per-step mean as needing clipping or scale normalization.
```

## Các bài tập

1. **Easy.**Đi chạy`code/main.py`- Bước quay trở lại mỗi tập. bao nhiêu tập cho đến khi trung bình chạy vượt quá -10?
2. **Medium.**Thiết lập mạng mục tiêu ( Sử dụng mạng trực tuyến cho cả hai bên của mục tiêu Bellman). đo sự bất ổn đào tạo  liệu trả lại dao động hay khác nhau?
3. **Hard.**Thêm DQN TP: sử dụng mạng trực tuyến để chọn `argmax a'`, mục tiêu lưới để đánh giá. So sánh thiên vị của `Q(s_0, best_a)`Vâng đúng $V^{\ast}(s_0)$Sau 1.000 tập với vs không có Double DQN trên một GridWorld có phần thưởng lớn.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Q-learning with a neural Q-function, replay buffer, and target network. |
| Experience replay | "Shuffled transitions" | Ring buffer sampled uniformly each gradient step; decorrelates data. |
| Target network | "Frozen bootstrap" | Periodic copy of Q used in the Bellman target; stabilizes training. |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = no convergence guarantee. |
| Double DQN | "Fix for maximization bias" | Online net selects action, target net evaluates it. |
| Dueling DQN | "V and A heads" | Decompose Q = V + A - mean(A); same output, better gradient flow. |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional in one. |
| PER | "Prioritized Replay" | Sample transitions proportional to TD-error magnitude. |

## Đọc thêm

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) bài viết của hội thảo NeurIPS năm 2013 đã bắt đầu RL sâu.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) báo Nature, 49 game DQN.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN.
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) Đấu đấu DQN.
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298)- Báo đống thủ thuật.
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) việc xử lý sách giáo khoa của "những phần ba chết người" (chấp gần chức năng + bootstrapping + ngoại lệ chính sách) mà mạng mục tiêu của DQN và bộ đệm lặp lại được thiết kế để làm đục.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) DQN tài liệu đơn tham khảo được sử dụng trong các nghiên cứu ablation; tốt để đọc cùng với phiên bản đầu tiên của bài học này.
