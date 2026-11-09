# Dynamic Programming  Policy Iteration & Value Iteration

> Chương trình năng động là RL với gian lận. Bạn đã biết các chức năng chuyển đổi và phần thưởng; bạn chỉ cần lặp lại phương trình Bellman cho đến khi$V$hoặc $\pi$là chuẩn mực mà mọi phương pháp dựa trên lấy mẫu đều cố gắng tiếp cận.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## Vấn đề

Bạn có một MDP với một mô hình được biết đến: bạn có thể truy vấn $P(s' \mid s, a)$và $R(s, a, s')$Một nhà quản lý hàng tồn kho biết phân phối nhu cầu. Một trò chơi bảng có chuyển đổi xác định. Một gridworld là bốn dòng Python. Bạn có một * mô hình *.

RL không có mô hình (Q-learning, PPO, REINFORCE) được phát minh cho trường hợp bạn không có mô hình  bạn chỉ có thể lấy mẫu từ môi trường. Nhưng khi bạn có một, có các phương pháp nhanh hơn, tốt hơn: lập trình năng động. Bellman thiết kế chúng vào năm 1957.

Bạn cần chúng vào năm 2026 vì ba lý do. Thứ nhất, mọi môi trường bảng tính trong nghiên cứu RL (GridWorld, FrozenLake, CliffWalking) được giải quyết với DP để tạo ra chính sách tiêu chuẩn vàng. thứ hai, các giá trị chính xác cho phép bạn *debug* phương pháp lấy mẫu: nếu ước tính của Q-learning cho $V^{\ast}(s_0)$Không đồng ý với câu trả lời DP bằng 30%, Q-learning của bạn có một lỗi. Thứ ba, các phương pháp RL ngoại tuyến hiện đại và lập kế hoạch (MCTS, tìm kiếm của AlphaZero, RL dựa trên mô hình trong giai đoạn 9 · 10) tất cả lặp lại một bản sao Bellman trên một mô hình được học hoặc được đưa ra.

## Khái niệm

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**Chuyển đổi hai bước cho đến khi chính sách ngừng thay đổi.

1. *Thêm đánh giá:* chính sách nhất định $\pi$, tính toán$V^\pi$bằng cách áp dụng nhiều lần $V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$cho đến khi nó hội tụ.
2. *Cải thiện:* được đưa ra $V^\pi$, làm $\pi$Thằng tham lam.$V^\pi$$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$- Tôi không biết.

Sự hội tụ được đảm bảo bởi vì (a) mỗi bước cải tiến hoặc giữ $\pi$tương tự hoặc tăng chặt chẽ $V^\pi$cho một số trạng thái, (b) không gian của các chính sách xác định là hữu hạn. thường hội tụ trong ~ 520 lặp lại bên ngoài ngay cả cho không gian nhà nước lớn.

**Value iteration.**Phong trào đánh giá và cải tiến thành một lần phơi bày.

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

Lặp lại cho đến khi $\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. Tạo ra chính sách vào cuối bằng cách thực hiện hành động tham lam. Cụ thể nhanh hơn cho mỗi lặp  không có vòng đánh giá bên trong  nhưng thường cần nhiều lần lặp hơn để hội tụ.

**Generalized policy iteration (GPI).**Các khung thống nhất. chức năng giá trị và chính sách được khóa trong một vòng cải thiện hai chiều; bất kỳ phương pháp nào thúc đẩy cả hai hướng đến sự nhất quán lẫn nhau (lần lặp lại giá trị không đồng bộ, lặp lại chính sách sửa đổi, Q-learning, diễn viên-chính trị, PPO) là một ví dụ của GPI.

**Why $\gamma < 1$ matters.**Người vận hành Bellman là một $\gamma$-sự thu hẹp trong chuẩn sup: $\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$Sự thu hẹp liên quan đến điểm cố định và sự hội tụ hình học độc đáo.$\gamma < 1$và bạn mất bảo đảm  bạn cần một chân trời hữu hạn hoặc một trạng thái hấp thụ cuối cùng.

```figure
value-iteration-gamma
```

## Hãy xây dựng nó

### Bước 1: xây dựng mô hình GridWorld MDP

Sử dụng cùng một 4x4 GridWorld từ Bài học 01. Chúng tôi thêm một biến thể stochastic: với xác suất `0.1`Máy bay trượt sang một hướng thẳng đứng ngẫu nhiên.

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)`trả lại danh sách `(s', r, p)`Đây là toàn bộ mô hình.

### Bước 2: Đánh giá chính sách

Với một chính sách `π(s) = {action: prob}`, lặp lại phương trình Bellman cho đến khi $V$dừng di chuyển:

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### Bước 3: Cải thiện chính sách

Thay thế $\pi$với chính sách tham lam w.r.t.$V$Nếu$\pi$không thay đổi, trở lại  chúng ta ở mức tối ưu.

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### Bước 4: Thâu chúng lại với nhau

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

Sự hội tụ điển hình trên 4×4: 46 lặp lại bên ngoài.$V^{\ast}(0,0) \approx -6$và một chính sách cắt giảm nghiêm ngặt số bước.

### Bước 5: lặp lại giá trị (định dạng vòng một)

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

Điểm cố định giống nhau, ít dòng mã hơn.

## Những bẫy

- **Forgetting to handle terminals.**Nếu bạn áp dụng Bellman vào trạng thái hấp thụ, nó vẫn nhận được "các hành động tốt nhất" mà không thay đổi gì.`if s == terminal: V[s] = 0`- Tôi không biết.
- **Sup-norm vs L2 convergence.**Sử dụng `max |V_new - V|`Chứng chỉ lý thuyết là trên chuẩn sup.
- **In-place vs synchronous updates.**Tới hạn `V[s]`trong chỗ (Gauss-Seidel) hội tụ nhanh hơn một tách biệt `V_new`Định nghĩa (Jacobi). mã sản xuất sử dụng tại chỗ.
- **Policy ties.**Nếu hai hành động có giá trị Q bằng nhau,`argmax`có thể phá vỡ các liên kết khác nhau mỗi lần lặp lại, khiến kiểm tra "chính sách ổn định" dao động. Sử dụng một liên kết ổn định (phản ứng đầu tiên theo thứ tự cố định).
- **State-space explosion.**DP là $O(\lvert S \rvert \cdot \lvert A \rvert)$Phương pháp này có thể được sử dụng cho các hoạt động khác nhau.

## Sử dụng nó

Năm 2026, DP là đường cơ sở chính xác và vòng lặp bên trong của các nhà hoạch định:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

Mỗi khi ai đó nói "động lực giá trị tối ưu", họ có nghĩa là "điểm cố định DP".$V^{\ast}$hoặc $Q^{\ast}$trong một tờ báo, hình dung vòng lặp này.

## Chuyển nó

Cứ như `outputs/skill-dp-solver.md`- Có thể là:

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## Các bài tập

1. **Easy.**Tiến đổi giá trị chạy trên GridWorld 4×4 với $\gamma \in \lbrace 0.9, 0.99 \rbrace$- Bao nhiêu lần quét cho đến khi$\max \lvert \Delta V \rvert < 10^{-6}$?$V^{\ast}$như một lưới 4x4.
2. **Medium.**So sánh lặp lại chính sách so với lặp lại giá trị trên GridWorld (slip probability `0.1` Số: quét, giờ tường, cuối cùng $V^{\ast}(0,0)$- Cái nào hội tụ nhanh hơn trong các lần lặp lại?
3. **Hard.**Xây dựng lặp lại chính sách sửa đổi: trong bước đánh giá, chỉ chạy $k$Trải qua thay vì hội tụ.$V^{\ast}(0,0)$lỗi vs $k$cho $k \in \lbrace 1, 2, 5, 10, 50 \rbrace$- Hẻo cong cho bạn biết gì về sự đổi giá/ cải thiện?

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## Đọc thêm

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) trình bày theo quy định của sự lặp lại chính sách và sự lặp lại giá trị.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) xử lý nghiêm ngặt các lập luận lập bản đồ thu hẹp.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) Phác thảo chính sách đã được sửa đổi và phân tích sự hội tụ của nó.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) giấy lặp lại chính sách ban đầu.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) cầu từ DP đến khoảng-DP / RL sâu được sử dụng trong mỗi bài học tiếp theo.
