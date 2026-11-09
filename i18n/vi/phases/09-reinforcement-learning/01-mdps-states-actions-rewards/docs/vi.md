# MDP, các quốc gia, các hành động và phần thưởng

> Một Quá trình Quyết định Markov là năm thứ: trạng thái, hành động, chuyển đổi, phần thưởng, giảm giá. Mọi thứ trong RL  Q-learning, PPO, DPO, GRPO  tối ưu hóa trên hình dạng này. Học nó một lần, đọc phần còn lại của việc học tăng cường miễn phí.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## Vấn đề

Bạn đang viết một bot cờ vua, hoặc một nhà hoạch định hàng tồn kho, hoặc một đại lý giao dịch, hoặc vòng PPO đào tạo một mô hình lý luận, bốn lĩnh vực khác nhau, một sự thật đáng ngạc nhiên: tất cả bốn đều sụp đổ thành cùng một đối tượng toán học.

Học tập được giám sát cho bạn `(x, y)`Đơn vị này có thể được sử dụng để tạo ra một số kết quả tốt hơn, nhưng bạn có thể không thể làm được điều đó.

Bạn không thể học hỏi từ dòng này cho đến khi bạn chính thức hóa nó. "Những gì tôi đã thấy", "Những gì tôi đã làm, "Những gì đã xảy ra sau đó", "tốt như thế nào là"  mỗi phải trở thành một đối tượng bạn có thể suy luận về.

## Khái niệm

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**The five objects.**

- **States** $S$Trong GridWorld, tế bào, cờ vua, bảng, trong LLM, cửa sổ ngữ cảnh cộng với bất kỳ ký ức nào.
- **Actions** $A$Các lựa chọn, di chuyển lên/ xuống/ trái/ phải, chơi một động thái, phát hành một token.
- **Transitions** $P(s' \mid s, a)$- Với tình trạng$s$và hành động$a$Định nghĩa trong cờ vua, stochastic trong hàng tồn kho, gần như quyết định trong giải mã LLM.
- **Rewards** $R(s, a, s')$- Tín hiệu scalar. Win = +1, mất = -1. Thu nhập trừ chi phí.
- **Discount** $\gamma \in [0, 1)$- Lương lai sẽ được thưởng bao nhiêu so với hiện tại.$\gamma = 0.99$mua một đường chân trời ~ 100 bước; $\gamma = 0.9$mua ~ 10.

**The Markov property** $P(s_{t+1} \mid s_t, a_t) = P(s_{t+1} \mid s_0, a_0, \ldots, s_t, a_t)$Tương lai chỉ phụ thuộc vào trạng thái hiện tại. Nếu không, đại diện của nhà nước là không đầy đủ không phải là một thất bại của phương pháp, một thất bại của nhà nước.

**Policies and returns.**Một chính sách$\pi(a \mid s)$bản đồ các trạng thái để phân phối hành động.$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$là tổng số tiền giảm giá của các phần thưởng trong tương lai.$V^\pi(s) = \mathbb{E}[G_t \mid s_t = s]$là lợi nhuận dự kiến bắt đầu từ $s$trong chính sách$\pi$Giá trị Q$Q^\pi(s, a) = \mathbb{E}[G_t \mid s_t = s, a_t = a]$là lợi nhuận dự kiến bắt đầu với một hành động cụ thể. Mỗi thuật toán RL ước tính một trong hai, sau đó cải thiện $\pi$Theo đó.

**The Bellman equations.**Các phương trình điểm cố định mà mọi thứ trong giai đoạn này sử dụng:

```math
\begin{aligned}
V^\pi(s) &= \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')] \\
Q^\pi(s, a) &= \sum_{s', r} P(s', r \mid s, a) [r + \gamma \sum_{a'} \pi(a' \mid s') Q^\pi(s', a')]
\end{aligned}
```

Những chia dự kiến này trở lại vào "bước này phần thưởng" cộng với "đáng giá giảm giá của nơi bạn hạ cánh". Khôi phục. Mỗi thuật toán trong giai đoạn 9 hoặc lặp lại phương trình này để hội tụ (quá trình lập trình động), các mẫu từ nó (Monte Carlo), hoặc khởi động nó một bước (các biệt thời gian).

```figure
discount-horizon
```

## Hãy xây dựng nó

### Bước 1: một MDP xác định nhỏ

Một 4x4 GridWorld. Trưởng bắt đầu ở phía trên bên trái, cuối ở phía dưới bên phải, phần thưởng là -1 mỗi bước, hành động`{up, down, left, right}`- Nhìn xem .`code/main.py`- Tôi không biết.

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

5 đường, đó là toàn bộ môi trường, chuyển đổi quyết định, hình phạt bước liên tục, hấp thụ trạng thái cuối cùng.

### Bước 2: triển khai chính sách

Một chính sách là một chức năng từ phân phối trạng thái đến hành động.

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

Lấy chính sách ngẫu nhiên 1000 lần. Phản hồi trung bình là khoảng -60 đến -80 cho bảng 4x4. Phản hồi tối ưu là -6 (cách đường thẳng xuống phải).

### Bước 3: tính toán`V^π`chính xác qua phương trình Bellman

Đối với MDP nhỏ phương trình Bellman là một hệ thống tuyến tính.

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

Đây là đánh giá chính sách lặp lại. Đây là thuật toán đầu tiên trong Sutton & Barto và nền tảng lý thuyết của mọi phương pháp RL tiếp theo.

### Bước 4: `γ`là một siêu tham số có ý nghĩa vật lý

Tầm nhìn hiệu quả là khoảng $1 / (1 - \gamma)$- $\gamma = 0.9$→ 10 bước. $\gamma = 0.99$→ 100 bước. $\gamma = 0.999$→ 1000 bước.

quá thấp và đại lý hành động cận thị. quá cao và giao tín dụng trở nên ồn ào, bởi vì nhiều bước đầu chia sẻ trách nhiệm cho phần thưởng trong tương lai xa. LLM RLHF thường sử dụng $\gamma = 1$vì các tập phim ngắn và giới hạn.`0.95–0.99`. Trò chơi chiến lược đường dài sử dụng`0.999`- Tôi không biết.

## Những bẫy

- **Non-Markovian state.**Nếu bạn cần ba quan sát cuối cùng để quyết định, "thế trạng" không chỉ là quan sát hiện tại.
- **Sparse rewards.**Những phần thưởng chỉ dành cho người chiến thắng làm cho việc học gần như không thể trong không gian lớn.
- **Reward hacking.**Tối ưu hóa phần thưởng đại diện thường tạo ra hành vi bệnh lý. Đại diện đua thuyền của OpenAI xoay quanh vòng tròn thu thập sức mạnh mãi mãi thay vì kết thúc cuộc đua. Luôn xác định phần thưởng từ kết quả mục tiêu, chứ không phải đại diện.
- **Discount mis-spec.** $\gamma = 1$trong một nhiệm vụ đường chân trời vô hạn làm cho mọi giá trị vô hạn.$\gamma < 1$- Tôi không biết.
- **Reward scale.**Các phần thưởng của {+100, -100} so với {+1, -1} cho các chính sách tối ưu giống nhau nhưng độ lớn gradient khác nhau.`[-1, 1]`- trước khi kết nối với PPO/DQN.

## Sử dụng nó

Dòng 2026 giảm mỗi đường ống RL thành MDP trước khi chạm vào mã:

| Situation | State | Action | Reward | γ |
|-----------|-------|--------|--------|---|
| Control (locomotion, manipulation) | Joint angles + velocities | Continuous torques | Task-specific shaped | 0.99 |
| Games (chess, Go, poker) | Board + history | Legal move | Win=+1 / loss=-1 | 1.0 (finite) |
| Inventory / pricing | Stock + demand | Order qty | Revenue - cost | 0.95 |
| RLHF for LLMs | Context tokens | Next token | Reward-model score at end | 1.0 (episode ~200 tokens) |
| GRPO for reasoning | Prompt + partial response | Next token | Verifier 0/1 at end | 1.0 |

Viết năm tuples trước khi viết bất kỳ vòng lặp đào tạo. Hầu hết các báo cáo lỗi "RL không hoạt động" bắt nguồn từ một công thức MDP đã bị phá vỡ trên giấy.

## Chuyển nó

Cứ như `outputs/skill-mdp-modeler.md`- Có thể là:

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## Các bài tập

1. **Easy.**Thực hiện 4×4 GridWorld và triển khai chính sách ngẫu nhiên trong `code/main.py`- chạy 10.000 tập. báo cáo trung bình và std của lợi nhuận. so sánh với lợi nhuận tối ưu (-6).
2. **Medium.**Đi chạy`policy_evaluation`với $\gamma \in \lbrace 0.5, 0.9, 0.99 \rbrace$cho chính sách đồng bộ ngẫu nhiên.`V`Giải thích tại sao các giá trị trạng thái gần ga kết thúc tăng nhanh hơn với lớn hơn $\gamma$- Tôi không biết.
3. **Hard.**Chuyển lại GridWorld stochastic: mỗi hành động trượt đến một hướng lân cận với xác suất $p = 0.1$- Đánh giá lại chính sách đồng phục.`V[start]`- Tốt hơn hay tồi tệ hơn?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MDP | "Reinforcement learning setup" | Tuple $(S, A, P, R, \gamma)$ satisfying the Markov property. |
| State | "What the agent sees" | Sufficient statistic for future dynamics under the chosen policy class. |
| Policy | "Agent's behavior" | Conditional distribution $\pi(a \mid s)$ or deterministic map $s \to a$. |
| Return | "Total reward" | Discounted sum $\sum \gamma^t r_t$ from the current step. |
| Value | "How good a state is" | Expected return under $\pi$ starting from $s$. |
| Q-value | "How good an action is" | Expected return under $\pi$ starting from $s$ with first action $a$. |
| Bellman equation | "Dynamic programming recursion" | Fixed-point decomposition of value / Q into one-step reward plus discounted successor value. |
| Discount $\gamma$ | "Future vs present" | Geometric weight on far-future reward; effective horizon $\approx 1/(1-\gamma)$. |

## Đọc thêm

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)Chương 3 bao gồm MDP và phương trình Bellman; Chương 1 thúc đẩy giả thuyết phần thưởng đặt nền tảng cho mỗi bài học tiếp theo.
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) nguồn gốc của phương trình Bellman.
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) Nút đầu tiên MDP ngắn gọn từ góc RL sâu.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) tham chiếu nghiên cứu hoạt động về MDP và phương pháp giải pháp chính xác.
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) nguồn gốc sạch nhất của MDP như một chuyên môn lập trình động.
