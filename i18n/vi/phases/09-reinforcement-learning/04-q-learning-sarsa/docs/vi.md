# Sự khác biệt thời gian  Q-Learning & SARSA

> Monte Carlo chờ đợi cho đến khi tập phim kết thúc. TD cập nhật sau mỗi bước bằng cách khởi động ước tính giá trị tiếp theo. Q-learning là không chính sách và lạc quan; SARSA là chính sách và thận trọng. Cả hai đều là một dòng mã. Cả hai đều là nền tảng cho mọi phương pháp RL sâu trong giai đoạn này.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## Vấn đề

Monte Carlo hoạt động nhưng nó có hai yêu cầu đắt tiền. Nó cần các tập kết thúc, và nó chỉ cập nhật sau khi trở lại cuối cùng là. Nếu tập của bạn là 1.000 bước, MC chờ 1.000 bước để cập nhật bất cứ điều gì.

Quá trình lập trình năng động có hồ sơ ngược lại  sao lưu khởi động không biến động  nhưng yêu cầu một mô hình được biết đến.

Sự khác biệt thời gian (TD) học tập chia khác biệt.$(s, a, r, s')$, tạo ra một mục tiêu một bước $r + \gamma V(s')$và đẩy$V(s)$Không có mô hình, không có tập hoàn chỉnh, không có sự thiên vị khi sử dụng một mô hình$V$trên RHS, nhưng sự khác biệt thấp hơn đáng kể so với MC và cập nhật trực tuyến từ bước một.

Đây là khoang xoay mà tất cả các RL  DQN, A2C, PPO, SAC  hiện đại quay. Phần còn lại của giai đoạn 9 là các lớp gần gũi chức năng và thủ thuật được xây dựng trên đỉnh cập nhật TD một bước bạn sẽ viết trong bài học này.

## Khái niệm

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

Số lượng được xếp vào vòng đệm là lỗi TD $\delta = r + \gamma V(s') - V(s)$Nó là analog trực tuyến của $G_t - V(s_t)$trong MC. Sự hội tụ đòi hỏi$\alpha$làm hài lòng Robbins-Monro ($\sum \alpha = \infty$- $\sum \alpha^2 < \infty$) và tất cả các tiểu bang đã đến thăm vô hạn thường xuyên.

**Q-learning.**Một phương pháp TD ngoài chính sách để kiểm soát:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

- `max`cho rằng chính sách tham lam sẽ được theo đuổi từ$s'$tiếp theo, bất kể tác nhân thực sự thực hiện hành động nào.$Q^{\ast}$Mnih et al. (2015) đã chuyển đổi điều này thành deep Q-learning trên Atari (Dạy 05).

**SARSA.**Một phương pháp TD trên chính sách:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

Tên là tuple $(s, a, r, s', a')$SARSA sử dụng hành động này.$a'$- Không, không, không, không.`argmax`- Tương ứng với $Q^\pi$cho bất cứ điều gì $\pi$đang chạy, trong giới hạn $\epsilon \to 0$trở thành $Q^{\ast}$- Tôi không biết.

**The cliff-walking difference.**Trong nhiệm vụ đi bộ vách đá cổ điển (đánh vách đá = phần thưởng -100), Q-learning học được con đường tối ưu dọc theo bờ vách đá nhưng đôi khi nhận được hình phạt trong quá trình khám phá. SARSA học được một con đường an toàn hơn một bước từ vách đá vì nó tạo ra tiếng ồn khám phá vào giá trị Q của nó.$\epsilon \to 0$Trong thực tế nó quan trọng: khi việc khám phá thực sự diễn ra tại triển khai, hành vi của SARSA là bảo thủ hơn.

**Expected SARSA.**Thay thế $Q(s', a')$với giá trị dự kiến của nó dưới $\pi$- Có thể là:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

Sự biến động thấp hơn SARSA (không có mẫu $a'$), cùng một mục tiêu chính sách.

**n-step TD and TD(λ).**Chuyển đổi giữa TD(0) và MC bằng cách chờ $n$bước trước khi khởi động. $n=1$là TD, $n=\infty$là MC. TD(λ) trung bình trên tất cả $n$với trọng lượng hình học $(1-\lambda)\lambda^{n-1}$Hầu hết các sử dụng RL sâu $n$từ 3 đến 20.

```figure
qlearning-gridworld
```

## Hãy xây dựng nó

### Bước 1: SARSA về chính sách tham lam

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

8 dòng. Sự khác biệt duy nhất với Q-learning là đường mục tiêu.

### Bước 2: Học Q

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

- `max`Một biểu tượng đó là sự khác biệt giữa chính sách và ngoại chính sách.

### Bước 3: đường cong học tập

Track trung bình trở lại mỗi 100 tập. Q-learning hội tụ nhanh hơn trên đơn giản xác định GridWorld; SARSA là bảo thủ hơn trên đáy.`code/main.py`, cả hai đều gần như tối ưu sau khoảng 2.000 tập với $\alpha=0.1, \epsilon=0.1$- Tôi không biết.

### Bước 4: so sánh với sự thật DP

Tiến trình lặp lại giá trị chạy (Dạy 02) để có được $Q^{\ast}$- Đánh giá$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$Một chất tác dụng TD bảng hợp chất tốt sẽ rơi vào `~0.5`trên 4×4 GridWorld sau 10.000 tập.

## Những bẫy

- **Initial Q values matter.**Optimistic init ($Q = 0$(với một nhiệm vụ có phần thưởng tiêu cực) khuyến khích khám phá.
- **α schedule.**- Không ngừng$\alpha$Nó tốt cho các vấn đề không ổn định.$\alpha_n = 1/n$cho sự hội tụ về mặt lý thuyết nhưng quá chậm trong thực tế  pin $\alpha$trong `[0.05, 0.3]`và theo dõi đường cong học tập.
- **ε schedule.**Bắt đầu cao ($\epsilon=1.0$), phân rã đến $\epsilon=0.05$"GLIE" (cười tham lam trong giới hạn với khám phá vô hạn) là điều kiện hội tụ.
- **Max bias in Q-learning.**- `max`người vận hành bị thiên vị lên khi $Q$dẫn đến đánh giá quá mức  Hasselt's Double Q-learning (được DDQN sử dụng trong Bài học 05) khắc phục điều này bằng hai bảng Q.
- **Non-terminating episodes.**TD có thể học mà không cần thiết bị kết thúc, nhưng bạn cần phải đóng cửa các bước hoặc xử lý bootstrap đúng ở đầu.
- **State hashing.**Nếu các trạng thái là tuples/tensors, sử dụng một khóa có thể hash (tuple, không phải danh sách; tuple của floats tròn, không là nguyên liệu).

## Sử dụng nó

Tầm nhìn TD năm 2026:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

90% số "RL" mà bạn đọc trong các bài báo 2026 là một số sự tinh chỉnh của Q-learning hoặc SARSA.

## Chuyển nó

Cứ như `outputs/skill-td-agent.md`- Có thể là:

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## Các bài tập

1. **Easy.**Thực hiện Q-learning và SARSA trên 4×4 GridWorld. Lập đường cong học tập (tỷ lệ thu về mỗi 100 tập) cho 2.000 tập. Ai hội tụ nhanh hơn?
2. **Medium.**Xây dựng môi trường đi bộ vách đá (4x12, hàng cuối là vách đá với phần thưởng -100 và đặt lại để bắt đầu). So sánh các chính sách cuối cùng của Q-learning và SARSA.
3. **Hard.**Thực hiện học tập Q hai lần. trên một GridWorld (chuồn Gaussian $\sigma=5$+ phần thưởng mỗi bước), cho thấy Q-làm học đánh giá quá cao $V^{\ast}(0,0)$bằng một số lượng có ý nghĩa trong khi học Double Q không.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## Đọc thêm

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) giấy gốc và bằng chứng hội tụ.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0), SARSA, Q-learning, dự kiến SARSA.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) sửa chữa cho sự thiên vị tối đa hóa.
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) động lực SARSA dự kiến.
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) bài báo đã tạo ra SARSA (sau đó được gọi là "sự học Q-thông tin kết nối sửa đổi").
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) tổng hợp TD(0) đến TD(n), con đường từ Q-làm học đến các dấu vết đủ điều kiện và sau đó, GAE trong PPO.
