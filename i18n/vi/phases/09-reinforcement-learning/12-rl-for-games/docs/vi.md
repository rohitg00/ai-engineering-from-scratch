# RL cho trò chơi  AlphaZero, MuZero, và thời đại lý luận LLM

> 1992: TD-Gammon đánh bại các nhà vô địch người ở backgammon bằng TD tinh khiết. 2016: AlphaGo đánh bại Lee Sedol. 2017: AlphaZero thống trị cờ vua, shogi và Go từ đầu. 2025: DeepSeek-R1 chứng minh công thức tương tự, với GRPO thay thế PPO, hoạt động trên lý luận.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## Vấn đề

Trò chơi có tất cả những gì RL muốn. Giải thưởng sạch (trận thắng/ thua). Phiên bản vô hạn (đặt lại tự chơi). mô phỏng hoàn hảo (trò chơi * là * mô phỏng). Không gian hành động liên tục nhỏ hoặc nhỏ.

Và các trò chơi là cách để kiểm tra mọi bước đột phá lớn của RL. TD-Gammon (backgammon, 1992). Atari-DQN (2013). AlphaGo (2016). AlphaZero (2017). OpenAI Five (Dota 2, 2019). AlphaStar (StarCraft II, 2019). MuZero (tiếng học mô hình, 2019). AlphaTensor (tổ số ma trận, 2022). AlphaDev (chế thuật phân loại, 2023). DeepSeek-R1 (chủ nghĩa toán học, 2025)  minh chứng mới nhất rằng các kỹ thuật game-RL hoạt động trên văn bản.

Ngọc đá này khảo sát ba kiến trúc nổi bật  AlphaZero, MuZero và GRPO  thông qua một ống kính thống nhất: **self-play + search + policy improvement**. Mỗi một tổng quát trước đó; GRPO đặc biệt là công thức của AlphaZero được áp dụng cho lý luận LLM, với các token như các hành động và xác minh toán học như tín hiệu chiến thắng.

## Khái niệm

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**Silver et al. Với một trò chơi (chess, shogi, Go) với các quy tắc được biết đến:

- Mạng lưới giá trị chính sách: một tháp $f_\theta(s) \to (p, v)$- $p$là một tiền nhiệm về các động thái pháp lý.$v$là kết quả trò chơi mong đợi.
- Monte Carlo Tree Search (MCTS): với mỗi chuyển động, mở rộng một cây có thể tiếp tục. Sử dụng $(p, v)$như trước + bootstrap. Chọn các nút theo UCB (PUCT): $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$- Tôi không biết.
- tự chơi: chơi trò chơi đại lý-về- đại lý.$t$, phân phối các chuyến thăm của MCTS $\pi_t$trở thành mục tiêu đào tạo chính sách.
- Lối mất:$L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$- $z$là kết quả trò chơi (+1 / 0 / -1).

Không có kiến thức con người, không có tính toán bằng tay, một công thức duy nhất làm chủ cờ vua, shogi và Go sau vài chục triệu trò chơi tự chơi.

**MuZero (2019).**Schrittwieser et al. Tháo bỏ yêu cầu biết các quy tắc.

- Thay vì một môi trường cố định, học một mô hình động lực tiềm ẩn$(h, g, f)$- Có thể là:
  - $h(s)$: mã hóa quan sát vào trạng thái ẩn.
  - $g(s_{\text{latent}}, a)$: dự đoán trạng thái ẩn chứa tiếp theo + phần thưởng.
  - $f(s_{\text{latent}})$: dự đoán chính sách trước + giá trị.
- MCTS chạy trong không gian ẩn học.
- Làm việc trên Go, cờ vua, shogi và Atari một thuật toán, không có luật lệ.

**Stochastic MuZero (2022).**Thêm động lực stochastic và nút cơ hội; mở rộng đến các trò chơi lớp backgammon.

**Muesli, Gumbel MuZero (2022-2024).**Cải thiện hiệu quả mẫu và tìm kiếm xác định.

**GRPO (2024-2025).**Công thức DeepSeek-R1. cùng một vòng lặp hình AlphaZero, áp dụng cho lí luận mô hình ngôn ngữ:

- "Game": trả lời một vấn đề toán học / mã hóa / lý luận. "Win" = xác minh (trình thử nghiệm vượt qua, số lượng trả lời phù hợp) trả lại 1.
- Chính sách: LLM. Các hành động: token.
- Không có nhà phê bình (tình thức của PPO $V_\phi$Thay vào đó, cho mỗi lần nhắc, lấy mẫu$G$- Đánh giá tiền thưởng cho mỗi người.**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$như là tín hiệu cho việc cập nhật kiểu REINFORCE.
- KL phạt để chính sách tham chiếu để ngăn chặn trôi (như RLHF).
- Lối mất hoàn toàn:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

Không mô hình phần thưởng được học, không có nhà phê bình, không có MCTS. Một kiểm chứng dựa trên quy tắc cung cấp phần thưởng, đường cơ sở liên quan đến nhóm thay thế nhà phê bình, và bước tìm kiếm bị bỏ.

**The R1 recipe in full.**DeepSeek-R1 (DeepSeek 2025) là hai mô hình trong một bài báo:

- **R1-Zero.**Bắt đầu từ mô hình cơ bản DeepSeek-V3. Không có SFT. Sử dụng GRPO trực tiếp với hai thành phần phần thưởng: * thưởng chính xác * (tựa trên quy tắc  đã phân tích câu trả lời cuối cùng đến số chính xác / mã đã vượt qua các thử nghiệm đơn vị) và * thưởng định dạng * (có hoàn thành chuỗi suy nghĩ của nó trong `<think>…</think>`Trong hàng ngàn bước, độ dài phản ứng trung bình tăng từ ~100 đến ~10,000 token và điểm số chuẩn toán học leo lên gần o1 mức xem trước. Mô hình học cách lý luận từ đầu.
- **R1.**Xác định các vấn đề khả năng đọc của R1-Zero bằng một đường ống bốn giai đoạn:
  1. **Cold-start SFT.**Thu thập vài ngàn biểu hiện CoT dài với định dạng sạch. giám sát-finetune mô hình cơ bản trên chúng. Điều này cung cấp một điểm khởi đầu dễ đọc.
  2. **Reasoning-oriented GRPO.**Sử dụng GRPO với phần thưởng độ chính xác + định dạng cộng với phần thưởng phù hợp với ngôn ngữ để ngăn chặn chuyển đổi mã.
  3. **Rejection sampling + SFT round 2.**lấy mẫu ~ 600K quỹ đạo lý luận từ điểm kiểm soát RL, chỉ giữ những câu trả lời cuối cùng chính xác và CoT có thể đọc được, và kết hợp với ~ 200K ví dụ SFT không lý luận (sự viết, QA, nhận thức về bản thân).
  4. **Full-spectrum GRPO.**Một vòng RL nữa bao gồm cả lý luận (bước thưởng dựa trên quy tắc) và sự sắp xếp chung (bước thưởng dựa trên ưu tiên hữu ích/không hại).

Kết quả tương ứng với o1 trên AIME và MATH-500 ở trọng lượng mở, và đủ nhỏ để chưng cất. cùng một bài báo cũng phát hành sáu mô hình mật độ chưng cất (Qwen-1.5B thông qua Llama-70B) bằng cách SFT'ing trên dấu vết lý luận của R1  không có RL ở học sinh. Chưng cất của một giáo viên RL mạnh liên tục đánh bại RL từ đầu ở quy mô của học sinh.

**Why GRPO instead of PPO for reasoning.**Ba lý do trong bài báo DeepSeekMath (Từ tháng 2 năm 2024): (1) không có mạng giá trị để đào tạo, giảm bộ nhớ một nửa; (2) cơ sở nhóm tự nhiên xử lý phần thưởng cuối quỹ đạo hiếm khi mà các nhiệm vụ lý luận tạo ra; (3) bình thường hóa mỗi lần làm cho lợi ích tương đương trên các vấn đề khó khăn khác nhau, mà chỉ một nhà phê bình của PPO không thể.

**Search-free vs search-based.**Các trò chơi đã được phân nhánh:

- *Các trò chơi thông tin hoàn hảo với chân trời dài * (Go, cờ vua): vẫn dựa trên tìm kiếm. AlphaZero / MuZero thống trị.
- *Làm lý luận LLM*: chưa có MCTS trong sản xuất; GRPO trên các triển khai đầy đủ, tốt nhất của N cho tính toán suy luận.

```figure
f3-selfplay-ladder
```

## Hãy xây dựng nó

Mã trong `code/main.py`thực hiện **GRPO in miniature**: một tên cướp có nhiều nhóm mẫu. thuật toán giống như trên một LLM; chỉ chính sách và môi trường đơn giản hơn. Nó dạy về * mất mát * và * lợi thế liên quan đến nhóm *, đó là sự đổi mới 2024 từ DeepSeekMath.

### Bước 1: một môi trường xác minh nhỏ

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

Trong GRPO thực sự, người xác minh chạy các bài kiểm tra đơn vị hoặc kiểm tra sự bình đẳng toán học.

### Bước 2: chính sách: softmax trên K trả lời token mỗi prompt

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

Tương đương với kết quả lớp cuối cùng của LLM theo điều kiện theo một prompt.

### Bước 3: Tiểu mẫu nhóm và lợi thế liên quan đến nhóm

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

Lợi thế liên quan đến nhóm là thủ thuật DeepSeek 2024. Không cần người phê bình. "Baseline" là trung bình nhóm, và bình thường hóa sử dụng nhóm std.

### Bước 4: so sánh với mức cơ sở REINFORCE (không có giá trị)

Tương tự thiết lập, tính toán, đơn giản là REINFORCE. GRPO hội tụ nhanh hơn và ổn định hơn.

### Bước 5: quan sát entropy và KL

Các chẩn đoán giống như RLHF: trung bình KL để tham chiếu, entropy chính sách, phần thưởng trên thời gian.

## Những bẫy

- **Reward hacking via verifier gaming.**GRPO thừa hưởng rủi ro của RLHF: nếu người xác minh sai hoặc có thể khai thác, LLM sẽ tìm thấy lợi dụng.
- **Group size too small.**Sự biến động của cơ sở trung bình nhóm là như $1/G$(sự sai lầm tiêu chuẩn của nó như $1/\sqrt{G}$Dưới đây$G = 4$, tín hiệu lợi thế là ồn ào; lựa chọn tiêu chuẩn là $G = 8$đến 64.
- **Length bias.**LLM hoàn thành với độ dài khác nhau có khả năng log khác nhau. bình thường bằng số lượng token, hoặc sử dụng log-prob cấp độ chuỗi, hoặc cắt ngắn cho chiều dài tối đa.
- **Pure self-play cycles.**Trình luyện theo kiểu AlphaZero có thể bị mắc kẹt trong vòng thống trị trong các trò chơi tổng cộng.
- **Search-policy mismatch.**AlphaZero đào tạo chính sách để bắt chước kết quả tìm kiếm. Nếu mạng lưới chính sách quá nhỏ để đại diện cho phân phối tìm kiếm, đào tạo sẽ dừng lại.
- **Compute floor.**MuZero / AlphaZero cần tính toán lớn. Một lần bỏ thường là hàng trăm giờ GPU.
- **Verifier coverage.**Các thử nghiệm đơn vị vượt qua cho một giải pháp lỗi tăng cường lỗi. Thiết kế xác minh để bắt được các trường hợp cạnh.

## Sử dụng nó

Khảo cảnh game-RL năm 2026, theo lĩnh vực:

| Domain | Dominant method |
|--------|-----------------|
| Two-player zero-sum board games (Go, chess, shogi) | AlphaZero / MuZero / KataGo |
| Imperfect info card games (poker) | CFR + deep learning (DeepStack, Libratus, Pluribus) |
| Atari / pixel games | Muesli / MuZero / IMPALA-PPO |
| Large multiplayer strategy (Dota, StarCraft) | PPO + self-play + league (OpenAI Five, AlphaStar) |
| LLM math/code reasoning | GRPO (DeepSeek-R1, Qwen-RL, open replications) |
| LLM alignment | DPO / RLHF-PPO (not GRPO; verifier is preference not verifiable) |
| Robotics | PPO + DR (not game-RL, but uses same policy-gradient tools) |
| Combinatorial problems | AlphaZero variants (AlphaTensor, AlphaDev) |

* Công thức *  tự chơi, cải thiện tìm kiếm, phân giải chính sách  trải dài trên văn bản, pixel và kiểm soát vật lý. GRPO là phiên bản trẻ nhất; nhiều hơn nữa đang đến.

## Chuyển nó

Cứ như `outputs/skill-game-rl-designer.md`- Có thể là:

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## Các bài tập

1. **Easy.**Thực hiện hành vi của GRPO trong `code/main.py`. Đào tạo trên 2 lời nhắc × 4 mã thông báo trả lời mỗi.$G=8$- Tôi không biết.
2. **Medium.**Chuẩn bị PPO (cắt) và vanilla REINFORCE. So sánh hiệu quả mẫu và sự khác biệt phần thưởng với GRPO trên cùng một tên cướp.
3. **Hard.**Tăng đến một "sợi dây chuyền lý luận" dài-2: đại lý phát ra hai token và người xác minh thưởng cho cặp. đo lường cách GRPO xử lý giao tín dụng qua chuỗi hai bước. (Công dẫn: tính toán lợi thế nhóm cho mỗi * chuỗi đầy đủ*, lan rộng đến cả hai vị trí token.)

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | Monte Carlo Tree Search; UCB1/PUCT selection with learned $(p, v)$ priors. |
| AlphaZero | "Self-play + MCTS" | Policy-value net trained to match MCTS visits and game outcome. |
| MuZero | "Learned-model AlphaZero" | Same loop but in latent space via learned dynamics. |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization; REINFORCE with group-mean baseline + KL. |
| PUCT | "AlphaZero's UCB" | $Q + c \cdot p \cdot \sqrt{N} / (1 + N_a)$ — balances value estimate with prior. |
| Self-play | "Agent vs past self" | Standard for zero-sum; symmetric training signal. |
| League play | "Population-based self-play" | Past + current + exploiters sampled as opponents. |
| Verifier reward | "Verifiable RL" | Reward comes from a deterministic checker (tests pass, answer matches). |
| Process reward | "PRM" | Scores each reasoning step, not just the final answer. |

## Đọc thêm

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)- Tôi không biết.
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404)- Tôi không biết.
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4)- Tôi không biết.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)- Tôi không biết.
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) bài báo giới thiệu GRPO và cơ sở liên quan đến nhóm.
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) công thức R1 đầy đủ bốn giai đoạn cộng với R1-Zero ablation.
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) CFR + học sâu quy mô.
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)- Báo bắt đầu mọi chuyện.
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) tham chiếu sản xuất để áp dụng GRPO với các chức năng thưởng tùy chỉnh.
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) sao chép mở của công thức R1 ở nhiều quy mô.
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) khung sách giáo khoa cho tự chơi, tìm kiếm và "bảo quy định phần thưởng" mà R1 trình bày ở quy mô LLM.
