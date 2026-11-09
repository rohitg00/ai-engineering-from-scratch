# Phương pháp Monte Carlo  Học hỏi từ các tập hoàn chỉnh

> Phương pháp lập trình năng động cần một mô hình. Monte Carlo chỉ cần các tập.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## Vấn đề

Quá trình lập trình năng động là thanh lịch, nhưng nó cho rằng bạn có thể truy vấn $P(s' \mid s, a)$Một robot không thể tính toán phân phối trên các pixel máy ảnh theo một mô-men xoắn chung. Một thuật toán định giá không thể tích hợp trên mọi phản ứng khách hàng có thể. Một LLM không thể liệt kê tất cả các tiếp tục có thể sau một token.

Bạn cần một phương pháp mà chỉ cần khả năng *mặt mẫu* từ môi trường.`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`- Sử dụng nó để ước tính giá trị.

Sự chuyển đổi từ DP sang MC là triết học quan trọng: chúng ta chuyển từ * mô hình được biết + sao lưu chính xác * sang * triển khai mẫu + lợi nhuận trung bình *. Sự khác biệt nhảy vọt, nhưng tính áp dụng nổ. Mỗi thuật toán RL sau bài học này  TD, Q-learning, REINFORCE, PPO, GRPO  là một ước tính Monte Carlo ở cốt lõi, đôi khi với bootstrapping được layered trên.

## Khái niệm

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$nơi $G^{(i)}(s)$được quan sát về những lần thăm $s$trong chính sách$\pi$- Tôi không biết.

**First-visit vs every-visit MC.**Với một tập phim đến thăm tiểu bang $s$nhiều lần, MC lần đầu tiên chỉ tính toán sự trở lại từ lần đầu tiên; mỗi lần MC lần đầu tiên tính toán tất cả các chuyến thăm. MC lần đầu tiên là khách quan. Mỗi lần MC lần đầu tiên có thể bị thiên vị một chút sau một số tập giới hạn, bởi vì nó trung bình một số lần thu hồi ngẫu nhiên cho mỗi tập và số đó có thể tương quan với các lần trở lại, nhưng cả hai đều hội tụ với $V^\pi(s)$khi số lần truy cập đi đến vô hạn. lần truy cập đầu tiên dễ phân tích hơn (iid mẫu). mỗi lần truy cập sử dụng nhiều dữ liệu hơn cho mỗi tập và thường hội tụ nhanh hơn trong thực tế.

**Incremental mean.**Thay vì lưu trữ tất cả các thông tin trả lại, cập nhật trung bình chạy:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

Tái tổ chức: $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$với $\alpha = 1/n$- Thay đổi$1/n$cho một bước kích thước liên tục $\alpha \in (0, 1)$và bạn có một máy ước tính MC không tĩnh mà theo dõi thay đổi trong $\pi$Chuyển động đó là toàn bộ bước từ MC đến TD đến mọi thuật toán RL hiện đại.

**Exploration is now a problem.**DP đã chạm vào mọi tiểu bang bằng cách đếm. MC chỉ nhìn thấy các tiểu bang các chuyến thăm chính sách. Nếu$\pi$là xác định, toàn bộ khu vực trong không gian nhà nước không bao giờ được lấy mẫu, và ước tính giá trị của chúng vẫn ở mức không mãi mãi.

1. **Exploring starts.**Bắt đầu mỗi tập từ một cặp ngẫu nhiên (s, a). Giảm bảo bảo hiểm; không thực tế trong thực tế (bạn không thể "đưa lại" một robot vào trạng thái tùy tiện).
2. **ε-greedy.**Tạo hành tham lam với Q hiện tại, nhưng với khả năng$\epsilon$chọn một hành động ngẫu nhiên. tất cả các cặp hành động trạng thái được lấy mẫu theo cách không đồng nghĩa.
3. **Off-policy MC.**Thu thập dữ liệu theo chính sách hành vi $\mu$, tìm hiểu về chính sách mục tiêu $\pi$Sự khác biệt cao, nhưng nó là cầu nối với các phương pháp buffer như DQN.

**Monte Carlo Control.**Đánh giá → cải thiện → đánh giá, giống như lặp lại chính sách, nhưng đánh giá dựa trên mẫu:

1. Đi chạy$\pi$, lấy một tập phim.
2. Tới thiệu $Q(s, a)$từ những kết quả được quan sát.
3. Làm $\pi$ε-cái tham lam w.r.t. $Q$- Tôi không biết.
4. Lặp lại.

Tương ứng với $Q^{\ast}$và $\pi^{\ast}$với xác suất 1 trong điều kiện nhẹ (mỗi cặp được truy cập vô hạn thường xuyên,$\alpha$làm hài lòng Robbins-Monro).

```figure
epsilon-greedy
```

## Hãy xây dựng nó

### Bước 1: rollout → danh sách (s, a, r)

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

Không có mô hình, chỉ là `env.reset()`và `env.step(s, a)`- Giống như môi trường tập thể dục nhưng không được trang bị.

### Bước 2: trả lại tính toán (tránh ngược)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

Một lần đi qua.$O(T)$Sự tái phát ngược lại$G_t = r_{t+1} + \gamma G_{t+1}$tránh tổng hợp lại.

### Bước 3: đánh giá MC lần đầu tiên

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

Ba dòng làm việc: đánh dấu trạng thái như được nhìn thấy trong chuyến thăm đầu tiên, số lượng tăng, trung bình chạy cập nhật.

### Bước 4: kiểm soát MC tham lam (trong chính sách)

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### Bước 5: so sánh với tiêu chuẩn vàng DP

Đánh giá của MC của bạn về$V^\pi$nên đồng ý với kết quả DP từ Bài học 02 như các tập → ∞. Trong thực tế: 50.000 tập trên 4×4 GridWorld đưa bạn trong `~0.1`của câu trả lời DP.

## Những bẫy

- **Infinite episodes.**MC cần các tập phim để chấm dứt. Nếu chính sách của bạn có thể lặp mãi mãi, cap `max_steps`và coi nắp như thất bại ngầm. GridWorld với một chính sách ngẫu nhiên thường xuyên thời gian ra  đó là bình thường, chỉ cần đảm bảo bạn đếm nó đúng.
- **Variance.**MC sử dụng hoàn toàn trả lại. Trong các tập dài, sự khác biệt là rất lớn  một phần thưởng không may ở cuối các phiên $V(s_0)$Các phương pháp TD (Lớp 04) cắt giảm điều này bằng cách khởi động.
- **State coverage.**MC tham lam trên một Q mới với dây xích sẽ chỉ thử một hành động.
- **Non-stationary policies.**Nếu$\pi$(như trong kiểm soát MC), các khoản trả lại cũ là từ một chính sách khác.
- **Off-policy importance sampling.**Những trọng lượng $\pi(a \mid s)/\mu(a \mid s)$Tăng bằng đường đi, biến động nổ với chân trời, giới hạn với IS/phát quyết hoặc chuyển sang TD.

## Sử dụng nó

Vai trò của phương pháp Monte Carlo năm 2026:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

Các thuật toán sâu-RL hiện đại (PPO, SAC) liên kết giữa MC tinh khiết (cũng trả lại) và TD tinh khiết (một bước khởi động) thông qua $n$- bước trở lại hoặc GAE. Cả hai điểm cuối là các trường hợp của ước tính tương tự.

## Chuyển nó

Cứ như `outputs/skill-mc-evaluator.md`- Có thể là:

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## Các bài tập

1. **Easy.**Thực hiện đánh giá MC lần đầu tiên về chính sách đồng bộ ngẫu nhiên trên 4×4 GridWorld.$V(0,0)$như một hàm số tập so với câu trả lời DP.
2. **Medium.**Thực hiện kiểm soát MC tham lam với $\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$So sánh mức thu hồi trung bình sau 20.000 tập.
3. **Hard.**Thực hiện các MC ngoài chính sách với việc lấy mẫu quan trọng: thu thập dữ liệu theo chính sách ngẫu nhiên đồng nhất $\mu$, ước tính$V^\pi$cho chính sách tối ưu định nghĩa $\pi$So sánh IS đơn giản so với IS theo quyết định so với IS trọng lượng.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## Đọc thêm

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) điều trị theo luật pháp.
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) lần đầu tiên và mỗi lần thăm.
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) MC và kiểm soát biến động ngoài chính sách.
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) Máy ước tính IS hiện đại có biến thể thấp.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) sự chứng minh thực nghiệm quy mô lớn đầu tiên của MC/TD tự chơi hội tụ với trò chơi siêu nhân; tiền thân khái niệm cho mỗi bài học trong nửa sau của giai đoạn này.
