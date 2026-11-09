# Mô hình hóa phần thưởng & RLHF

> Con người không thể viết một chức năng phần thưởng cho "đáp ứng trợ lý tốt", nhưng họ có thể so sánh hai phản ứng và chọn một tốt hơn. Đáp lại mô hình phần thưởng cho những so sánh đó, sau đó RL mô hình ngôn ngữ chống lại nó. Christiano 2017. InstructGPT 2022.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## Vấn đề

Bạn đã đào tạo một mô hình ngôn ngữ về mục tiêu dự đoán mã thông báo tiếp theo. Nó viết tiếng Anh ngữ pháp. Nó cũng nói dối, rambles, và từ chối từ chối. Bạn không thể khắc phục điều này với nhiều hơn trước khi tập  văn bản web là vấn đề, không phải là phương thuốc.

Bạn muốn một *scalar reward* nói "đáp ứng A tốt hơn phản ứng B cho hướng dẫn X". Việc viết chức năng thưởng bằng tay là không thể. "Helpfulness" không phải là một biểu hiện đóng cửa trên mã thông báo. Nhưng con người có thể so sánh hai đầu ra và đánh dấu một ưu tiên.

RLHF (Christiano et al. 2017; Ouyang et al. 2022) chuyển đổi sở thích thành mô hình phần thưởng, sau đó tối ưu hóa LM thông qua PPO so với phần thưởng đó. Trong ba bước: SFT → RM → PPO. Đó là công thức đã vận chuyển ChatGPT, Claude, Gemini và mọi LM khác được sắp xếp vào năm 20232025.

Năm 2026, bước PPO chủ yếu được thay thế bởi DPO (Phase 10 · 08) vì nó rẻ hơn và gần như tốt cho việc điều chỉnh sự sắp xếp. Nhưng phần * mô hình phần thưởng * vẫn là nền tảng của mỗi mẫu Best-of-N, mỗi đường ống dẫn phần thưởng RL-from-verifiable, và mọi mô hình lý luận sử dụng mô hình phần thưởng quy trình.

## Khái niệm

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**Bắt đầu từ một mô hình cơ bản được đào tạo trước. Định chỉnh về các biểu hiện bằng văn bản của con người về hành vi mục tiêu (những phản ứng theo hướng dẫn, những câu trả lời hữu ích, v.v.). Kết quả: một mô hình $\pi_{\text{SFT}}$là *đối向 hành vi tốt* nhưng vẫn có không gian hành động không giới hạn.

**Stage 2: Reward Model training.**

- Thu thập các cặp phản hồi $(y_+, y_-)$để được nhắc nhở $x$, được đánh dấu bởi con người như "y_+ được ưa thích so với y_-. "
- Trình hình thưởng$R_\phi(x, y)$để gán điểm cao hơn cho $y_+$- Tôi không biết.
- Lối mất:**Bradley-Terry pairwise logistic**- Có thể là:

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$BT đã là tiêu chuẩn từ năm 1952 (Bradley-Terry) và là lựa chọn thống trị trong RLHF hiện đại.

- $R_\phi$thường được khởi tạo từ mô hình SFT với đầu scalar trên cùng.

**Stage 3: PPO against the RM with KL penalty.**

- Tạo ra chính sách có thể đào tạo $\pi_\theta$từ $\pi_{\text{SFT}}$- Giữ một cái băng lạnh$\pi_{\text{ref}} = \pi_{\text{SFT}}$- Tôi không biết.
- Giải thưởng sau khi trả lời $y$- Có thể là:

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  Lệnh phạt KL ngăn cản $\pi_\theta$từ trôi dạt tùy ý từ $\pi_{\text{SFT}}$ nó là một *regularizer*, không phải một vùng tin tưởng khó. $\beta$Thông thường là 0,01-0,05.
- Tiếp tục chạy PPO (Dạy 08) với phần thưởng này.

**Why the KL?**Nếu không có nó, PPO sẽ tìm ra chiến lược hack phần thưởng  RM chỉ được đào tạo về hoàn thành trong phân phối.$\pi_\theta$gần các đa dạng nơi mà RM được đào tạo.

**2026 status:**

- **DPO**(Rafailov 2023): đại số hình thức đóng sụp đổ giai đoạn 2 + 3 thành một lỗ duy nhất được giám sát trên dữ liệu ưu tiên. Không RM, không PPO.
- **GRPO**(DeepSeek 20242025): PPO với cơ sở tương quan nhóm thay vì một nhà phê bình, phần thưởng từ một *verifier* (công trình mã / kết hợp câu trả lời toán học) thay vì một người đào tạo RM. Quyền thống cho các mô hình lý luận. Được bao gồm trong giai đoạn 9 · 12.
- **Process reward models (PRMs):**giải pháp phân tích điểm (mỗi bước lý luận), được sử dụng trong cả RLHF và các biến thể GRPO để lý luận.
- **Constitutional AI / RLAIF:**sử dụng một LLM phù hợp để tạo ra ưu tiên thay vì con người.

```figure
reward-model
```

## Hãy xây dựng nó

Bài học này sử dụng "phản ứng" và "câu trả lời" tổng hợp nhỏ được đại diện như chuỗi. RM là một điểm số tuyến tính trên một đại diện túi mã thông báo. Không có LLM thực sự  hình dạng * của đường ống quan trọng, không phải quy mô. Xem `code/main.py`- Tôi không biết.

### Bước 1: dữ liệu ưu tiên tổng hợp

```python
PROMPTS = ["help me", "answer me", "explain this"]
GOOD_WORDS = {"clear", "specific", "kind", "thorough"}
BAD_WORDS = {"vague", "rude", "wrong", "short"}

def make_pair(rng):
    x = rng.choice(PROMPTS)
    y_good = rng.choice(list(GOOD_WORDS)) + " " + rng.choice(list(GOOD_WORDS))
    y_bad = rng.choice(list(BAD_WORDS)) + " " + rng.choice(list(BAD_WORDS))
    return (x, y_good, y_bad)
```

Trong RLHF thực sự, nó được thay thế bởi các nhãn nhân.`(prompt, preferred_response, rejected_response)` giống nhau.

### Bước 2: Mô hình phần thưởng Bradley-Terry

Điểm số tuyến tính: `R(x, y) = w · bag(y)`- Đào tạo để giảm thiểu lỗ log BT theo cặp:

```python
def rm_train_step(w, x, y_pos, y_neg, lr):
    r_pos = dot(w, bag(y_pos))
    r_neg = dot(w, bag(y_neg))
    p = sigmoid(r_pos - r_neg)
    for tok, cnt in bag(y_pos).items():
        w[tok] += lr * (1 - p) * cnt
    for tok, cnt in bag(y_neg).items():
        w[tok] -= lr * (1 - p) * cnt
```

Sau vài trăm bản cập nhật,`w`Đưa trọng lượng tích cực cho các biểu tượng từ tốt và tiêu cực cho xấu.

### Bước 3: Chính sách giống như PPO trên RM

Chính sách đồ chơi của chúng tôi tạo ra một token từ một từ vựng.$\log \pi_\theta(\text{token} \mid \text{prompt})$, thêm một hình phạt KL-to-reference, và áp dụng các cắt giảm PPO thay thế.

```python
def rlhf_step(theta, ref, w, prompt, rng, eps=0.2, beta=0.1, lr=0.05):
    logits_theta = policy_logits(theta, prompt)
    probs = softmax(logits_theta)
    token = sample(probs, rng)
    logits_ref = policy_logits(ref, prompt)
    probs_ref = softmax(logits_ref)
    reward = dot(w, bag([token])) - beta * kl(probs, probs_ref)
    # ppo-style update on theta, treating reward as the return
    ...
```

### Bước 4: Kiểm tra KL

Đường trung bình đường$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$Nếu nó trượt qua`~5-10`(khi trả lời KL trong nats, tổng cộng trên token, đơn vị TRL ghi chép) chính sách đã trôi xa từ $\pi_{\text{SFT}}$: hoặc $\beta$là quá thấp (tăng nó để rút lại chính sách) hoặc phần thưởng hack bắt đầu. Đây là chẩn đoán hàng đầu trong RLHF thực.

### Bước 5: công thức sản xuất với TRL

Khi bạn hiểu được đường ống đồ chơi, đây là vòng lặp giống như người dùng thư viện thực sự viết nó.[TRL](https://huggingface.co/docs/trl)là thực hiện tham chiếu  `RewardTrainer`cho giai đoạn 2 và `PPOTrainer`(với một KL-to-reference tích hợp) cho giai đoạn 3.

```python
# Stage 2: reward model from pairwise preferences
from trl import RewardTrainer, RewardConfig
from transformers import AutoModelForSequenceClassification, AutoTokenizer

tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct")
rm = AutoModelForSequenceClassification.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct", num_labels=1
)

# dataset rows: {"prompt", "chosen", "rejected"} — Bradley-Terry format
trainer = RewardTrainer(
    model=rm,
    tokenizer=tok,
    train_dataset=preference_data,
    args=RewardConfig(output_dir="./rm", num_train_epochs=1, learning_rate=1e-5),
)
trainer.train()
```

```python
# Stage 3: PPO against the RM with KL penalty to the SFT reference
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

policy = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")
ref    = AutoModelForCausalLMWithValueHead.from_pretrained("./sft-checkpoint")  # frozen

ppo = PPOTrainer(
    config=PPOConfig(learning_rate=1.41e-5, batch_size=64, init_kl_coef=0.05,
                     target_kl=6.0, adap_kl_ctrl=True),
    model=policy, ref_model=ref, tokenizer=tok,
)

for batch in dataloader:
    responses = ppo.generate(batch["query_ids"], max_new_tokens=128)
    rewards   = rm(torch.cat([batch["query_ids"], responses], dim=-1)).logits[:, 0]
    stats     = ppo.step(batch["query_ids"], responses, rewards)
    # stats includes: mean_kl, clip_frac, value_loss — the three PPO diagnostics
```

Ba điều thư viện làm cho bạn.`adap_kl_ctrl=True`thực hiện lịch trình thích ứng-β: nếu quan sát thấy KL vượt quá `target_kl`, β gấp đôi; nếu dưới một nửa, β phân nửa. Mô hình tham chiếu được đóng băng theo quy ước  bạn không được ngẫu nhiên chia sẻ các tham số với `policy`Và giá trị đầu sống trên cùng xương sống như chính sách (`AutoModelForCausalLMWithValueHead`gắn đầu MLP scalar), đó là lý do tại sao TRL báo cáo `policy/kl`và `value/loss`riêng biệt.

## Những bẫy

- **Over-optimization / reward hacking.**RM là không hoàn hảo.$\pi_\theta$tìm thấy kết quả đối kháng có điểm số cao nhưng xấu. Các triệu chứng: phần thưởng leo lên vô hạn trong khi điểm đánh giá của con người cao cấp hoặc giảm.$\beta$, mở rộng dữ liệu đào tạo RM.
- **Length hacking.**RM được đào tạo về các phản ứng hữu ích thường vô nghĩa thưởng dài. Chính sách học cách đệm các phản ứng. Phong trào khắc phục: phần thưởng bình thường hóa chiều dài, hoặc RLAIF với một RM nhận thức về chiều dài.
- **Too-small RM.**RM cần phải lớn bằng chính sách. một RM nhỏ không thể ghi điểm chính xác về sản phẩm chính sách.
- **KL tuning.**quá thấp β → drift và phần thưởng hack. quá cao β → chính sách hầu như không thay đổi. thủ thuật tiêu chuẩn là một * thích nghi * β nhắm mục tiêu một KL cố định mỗi bước.
- **Preference-data noise.**~ 30% nhãn của con người là tiếng ồn hoặc mơ hồ.
- **Off-policy problems.**Dữ liệu PPO là một chút ngoài chính sách sau thời kỳ đầu tiên.

## Sử dụng nó

RLHF vào năm 2026 được xếp lớp:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

RLHF là phương pháp * trong năm 2022-2024. Năm 2026, đường ống sắp xếp sản xuất là DPO-thì, chỉ là PPO-cho các bước cao RM hoặc quan trọng về an toàn.

## Chuyển nó

Cứ như `outputs/skill-rlhf-architect.md`- Có thể là:

```markdown
---
name: rlhf-architect
description: Design an RLHF / DPO / GRPO alignment pipeline for a language model, including RM, KL, and data strategy.
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

Given a base LM, a target behavior (alignment / reasoning / refusal / agent), and a preference or verifier budget, output:

1. Stage. SFT? RM? DPO? GRPO? With justification.
2. Preference or verifier source. Humans, AI feedback, rule-based, unit-test-pass, or reward distillation.
3. KL strategy. Fixed β, adaptive β, or DPO (implicit KL).
4. Diagnostics. Mean KL, reward stability, over-optimization guard (holdout human eval).
5. Safety gate. Red-team set, refusal rate, safety RM separate from helpfulness RM.

Refuse to ship RLHF-PPO without a KL monitor. Refuse to use an RM smaller than the target policy. Refuse length-only rewards. Flag any pipeline that does not hold back a blind human-eval set as lacking over-optimization protection.
```

## Các bài tập

1. **Easy.**Đào tạo mô hình giải thưởng Bradley-Terry vào `code/main.py`trên 500 cặp ưu tiên tổng hợp. đo độ chính xác đôi trên 100 cặp được giữ.
2. **Medium.**Động hành vòng đồ chơi PPO-RLHF với $\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$Đối với mỗi người, ghi điểm RM so với KL-to-reference trên các bản cập nhật.
3. **Hard.**Thực hiện DPO (các định giá trị ưu tiên trong dạng đóng) trên cùng một dữ liệu ưu tiên và so sánh với đường ống RLHF-PPO trong tính toán được sử dụng và điểm RM cuối cùng đạt được.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RLHF | "Alignment RL" | Three-stage SFT + RM + PPO pipeline (Christiano 2017, Ouyang 2022). |
| Reward Model (RM) | "The scoring net" | Learned scalar function fit to pairwise preferences via Bradley-Terry. |
| Bradley-Terry | "Pairwise logistic loss" | $P(y_+ \succ y_-) = \sigma(R(y_+) - R(y_-))$; the standard RM objective. |
| KL penalty | "Stay near the reference" | $\beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$ in the reward; the anti-reward-hacking regularizer. |
| Reward hacking | "Goodhart's law" | Policy exploits RM flaws; symptoms: reward up, human eval flat. |
| RLAIF | "AI-labeled preferences" | RLHF where labels come from another LM instead of humans. |
| PRM | "Process Reward Model" | Scores partial reasoning steps; used in reasoning pipelines. |
| Constitutional AI | "Anthropic's method" | AI-generated preferences guided by explicit rules. |

## Đọc thêm

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741) tờ báo bắt đầu RLHF.
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) công thức đằng sau ChatGPT.
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) RLHF trước đây để tóm tắt.
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) DPO; sự cố sau RLHF vào năm 2026.
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF và tự phê bình vòng lặp.
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) tờ HH.
- [Hugging Face TRL library](https://huggingface.co/docs/trl) sản xuất `RewardTrainer`và `PPOTrainer`Đọc nguồn huấn luyện viên cho thông tin về KL thích ứng và giá trị đầu.
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)bởi Lambert, Castricato, von Werra, Havrilla  bước đi thông qua của đường ống ba giai đoạn với sơ đồ.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) thư viện; `examples/`có các kịch bản RLHF cuối đến cuối cho Llama, Mistral và Qwen.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) quan điểm giả thuyết phần thưởng; điều kiện tiên quyết thiết yếu để suy nghĩ về việc hack phần thưởng.
