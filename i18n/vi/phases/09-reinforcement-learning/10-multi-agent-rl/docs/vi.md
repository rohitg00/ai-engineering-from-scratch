# RL đa tác nhân

> Một đại lý RL giả định môi trường không hoạt động. Đặt hai đại lý học tập trong cùng một thế giới và giả định đó phá vỡ: mỗi đại lý là một phần của môi trường của người khác, và cả hai đều thay đổi.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## Vấn đề

Một robot học cách điều hướng một căn phòng là một vấn đề RL của một đại lý duy nhất. Một đội bóng không. AlphaStar vs StarCraft đối thủ không. Một thị trường của đại lý đấu giá không. Hai xe đàm phán một dừng bốn chiều không. Nhiều vấn đề trên nhiều thế giới thực không.

Trong mọi môi trường đa tác nhân, từ quan điểm của bất kỳ tác nhân nào, các tác nhân khác * là * một phần của môi trường. Khi chúng học và thay đổi hành vi của mình, môi trường trở nên không ổn định. Tài sản Markov "thị trạng tiếp theo chỉ phụ thuộc vào trạng thái hiện tại và hành động của tôi" bị vi phạm bởi vì trạng thái tiếp theo cũng phụ thuộc vào những gì các đại lý khác đã chọn, và chính sách của họ là chuyển mục tiêu.

Điều này phá vỡ các bằng chứng hội tụ bảng (các bảo đảm của Q-learning giả định một môi trường tĩnh). Nó phá vỡ RL sâu sắc ngây thơ: các đại lý đuổi theo nhau trong vòng lặp, không bao giờ hội tụ với một chính sách ổn định. Bạn cần các kỹ thuật đa đại lý cụ thể: đào tạo tập trung / thực hiện phi tập trung, cơ sở đối thực, chơi giải đấu, tự chơi.

2026 ứng dụng: robot swarms, giao thông định tuyến, hạm đội xe tự động, mô phỏng thị trường, hệ thống LLM đa đại lý (Phase 16), và bất kỳ trò chơi nào với nhiều người chơi thông minh hơn một.

## Khái niệm

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**Một khái quát hóa của MDP: các tiểu bang $S$, một hành động chung $a = (a_1, \ldots, a_n)$, chuyển tiếp $P(s' \mid s, a)$, và phần thưởng cho mỗi đại lý $R_i(s, a, s')$Mỗi đại lý$i$tối đa hóa lợi nhuận của riêng mình theo chính sách của riêng mình $\pi_i$Nếu phần thưởng giống nhau, thì đó là**fully cooperative**Nếu số tiền bằng không, thì nó là**adversarial**Nếu trộn, thì nó là **general-sum**- Tôi không biết.

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$từ đại lý $i$Quan điểm của anh phụ thuộc vào$\pi_{-i}$, mà đang thay đổi.
- **Credit assignment.**Với phần thưởng chia sẻ, đại lý nào gây ra nó?
- **Exploration coordination.**Các đại lý phải khám phá các chiến lược bổ sung, không phải khám phá một trạng thái tương tự.
- **Scalability.**Không gian hành động chung tăng trưởng theo cấp sốt $n$- Tôi không biết.
- **Partial observability.**Mỗi nhân viên chỉ thấy quan sát của riêng mình; tình trạng toàn cầu được che giấu.

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**Mỗi đại lý học được Q hoặc chính sách của riêng mình, đối xử với những người khác như là một phần của môi trường. đơn giản, đôi khi nó hoạt động (đặc biệt là với trải nghiệm lặp lại hoạt động như một thủ thuật mô hình hóa đại lý làm mượt mà).

**2. Centralized training, decentralized execution (CTDE).**Phương pháp hiện đại phổ biến nhất.$\pi_i$Điều kiện về quan sát địa phương $o_i$ thực hiện phân cấp tiêu chuẩn khi triển khai.$Q(s, a_1, \ldots, a_n)$Điều kiện về tình trạng toàn cầu và hành động chung.
- **MADDPG**(Lowe et al. 2017): DDPG với một nhà phê bình tập trung cho mỗi đại lý.
- **COMA**(Foerster et al. 2017): cơ sở phản thực  hỏi "bảo thưởng của tôi sẽ là gì nếu tôi đã hành động $a'$thay vì đó?"  cô lập sự đóng góp của tôi.
- **MAPPO**- **IPPO**với nhà phê bình chung (Yu et al. 2022): PPO với chức năng giá trị tập trung.
- **QMIX**(Rashid et al. 2018): phân hủy giá trị  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$với sự trộn lẫn đơn điệu.

**3. Self-play.**Hai bản sao của cùng một đại lý chơi với nhau. Chính sách của đối thủ * là chính sách của tôi từ một snapshot trước đây. AlphaGo / AlphaZero / MuZero. OpenAI Năm.

**4. League play.**Một sự mở rộng của tự chơi đến môi trường tổng / đối đầu: giữ một dân số của chính sách quá khứ và hiện tại, lấy mẫu đối thủ từ giải đấu, tập luyện chống lại họ. Thêm khai thác (khóa học chuyên đánh bại những người giỏi nhất hiện tại) và khai thác chính (khóa học chuyên đánh bại các khai thác). AlphaStar (StarCraft II).

**Communication.**Cho phép các nhân viên gửi tin nhắn học hỏi $m_i$Các hệ thống đa đại lý dựa trên LLM ngày nay (Phase 16) về cơ bản giao tiếp bằng ngôn ngữ tự nhiên.

```figure
f3-marl-orbit
```

## Hãy xây dựng nó

Bài học này sử dụng một GridWorld 6×6 với hai đại lý hợp tác.`-1`mỗi bước trong khi bất kỳ đại lý nào vẫn đang di chuyển,`+10`Khi cả hai đến.`code/main.py`- Tôi không biết.

### Bước 1: môi trường đa đại lý

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

Không gian hành động chung là`|A|² = 16`- Tình trạng toàn cầu là hai vị trí.

### Bước 2: Học Q độc lập

Mỗi đại lý chạy bảng Q riêng của mình được khóa vào trạng thái chung. Ở mỗi bước: cả hai chọn các hành động tham lam, thu thập chuyển đổi chung, mỗi người cập nhật Q của riêng mình với phần thưởng chia sẻ.

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

Làm việc trên nhiệm vụ này bởi vì phần thưởng dày đặc và phù hợp. Không thành công trong các nhiệm vụ gắn liền chặt chẽ (ví dụ, nơi một đại lý phải *ngợi * cho người khác).

### Bước 3: Q tập trung với cập nhật giá trị phân hủy

Sử dụng một Q thay vì các hành động chung $Q(s, a_1, a_2)$. Cập nhật từ phần thưởng chia sẻ. Phân tâm hóa khi thực hiện bằng cách bìa: $\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$. Giao dịch không gian hành động chung theo tỷ lệ thoáng để có một cái nhìn toàn cầu * đúng * .

### Bước 4: tự chơi đơn giản (nhân 2 đối thủ)

- Cảnh sát A chống lại Cảnh sát B.$K$tập, sao chép trọng lượng của A thành B. Tập luyện đối xứng, tiến bộ liên tục.

## Những bẫy

- **Non-stationary replay.**Lại chơi kinh nghiệm với các đại lý độc lập là tồi tệ hơn so với một đại lý đơn bởi vì những chuyển đổi cũ được tạo ra bởi các đối thủ đã lỗi thời.
- **Credit assignment ambiguity.**Giải thưởng chia sẻ sau một tập dài; không có cách rõ ràng để nói là đại lý nào đóng góp.
- **Policy drift / chasing.**Phản ứng tốt nhất của mỗi đại lý thay đổi với cập nhật của nhau.
- **Reward hacking via coordination.**Các đại lý tìm thấy những hoạt động phối hợp mà nhà thiết kế không dự đoán. Các đại lý đấu giá hội tụ để đặt giá không.
- **Exploration redundancy.**Cả hai đại lý đều khám phá các cặp hành động trạng thái tương tự.
- **League cycles.**Chơi tự chơi tinh khiết có thể bị mắc kẹt trong chu kỳ thống trị.
- **Sample explosion.** `n`Các nhân viên × không gian trạng thái × hành động chung. Phân tích với sự gần gũi chức năng; không gian hành động nhân tố (một đầu sản xuất chính sách cho mỗi nhân viên).

## Sử dụng nó

Bản đồ ứng dụng MARL 2026:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

Năm 2026, lĩnh vực tăng trưởng lớn nhất của MARL là dựa trên LLM: những đám đại lý mô hình ngôn ngữ đàm phán, tranh luận, xây dựng phần mềm.

## Chuyển nó

Cứ như `outputs/skill-marl-architect.md`- Có thể là:

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## Các bài tập

1. **Easy.**Trình luyện học Q độc lập trên hợp tác cộng tác GridWorld 2 đại lý. Bao nhiêu tập cho đến khi trung bình trở lại > 0?
2. **Medium.**Thêm một nhiệm vụ "sự phối hợp": mục tiêu chỉ đạt được khi cả hai đại lý bước lên nó trên cùng một lượt.
3. **Hard.**Thực hiện một nhà phê bình tập trung cho đào tạo theo kiểu MAPPO và so sánh tốc độ hội tụ với PPO độc lập trong nhiệm vụ phối hợp.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## Đọc thêm

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) CTDE với một nhà phê bình tập trung.
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) Các đường cơ sở đối lập cho việc phân bổ tín dụng.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) phân hủy giá trị với sự đơn điệu.
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955)PPO rất mạnh với MARL.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) chơi giải đấu ở quy mô.
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) tự chơi tự chơi trong các trò chơi số không.
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) bao gồm việc xử lý ngắn của sách giáo khoa về các thiết lập đa đại lý và vấn đề không ổn định mà CTDE được thiết kế để giải quyết.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) khảo sát bao gồm các MARL hợp tác, cạnh tranh và hỗn hợp với kết quả hội tụ.
