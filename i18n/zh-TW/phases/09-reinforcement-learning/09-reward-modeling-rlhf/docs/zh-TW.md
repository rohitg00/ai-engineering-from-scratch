# 獎勵模型（reward model）與 RLHF

> 人類寫不出「好的助理回應」的獎勵函數，但可以比較兩個回應、挑出較好的那個。把獎勵模型擬合到這些比較上，再讓語言模型（language model）用 RL 以該獎勵為目標最佳化。Christiano，2017。InstructGPT，2022。把 GPT-3 變成 ChatGPT 的那份配方。2026 年它大多已被 DPO 取代，但心智模型仍然適用。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## The Problem｜問題

你用下一個 token 預測的目標訓練了一個語言模型。它寫得出文法正確的英文。它也說謊、閒扯，而且該拒絕的時候不拒絕。再多預訓練（pretraining）修不好——網頁文字是問題，不是解藥。

你要一個*純量獎勵（scalar reward）*，說「給指令 X，回應 A 比回應 B 好」。這個獎勵函數無法手動撰寫。「有幫助」無法用 token 的閉式函數表示。但人類可以比較兩個輸出、標出偏好（preference）。大規模蒐集的成本低。

RLHF（Christiano 等人，2017；Ouyang 等人，2022）把偏好轉成獎勵模型，再用 PPO 讓語言模型去追那個獎勵。三步：SFT → RM → PPO。這份配方讓 ChatGPT、Claude、Gemini，以及 2023 到 2025 年每一個對齊過的 LLM 得以部署上線。

2026 年，PPO 那一步大多被 DPO（第 10 階段 · 08）取代，因為更便宜，對齊調校上又幾乎一樣好。但*獎勵模型*這一塊，仍是每個 Best-of-N 取樣器、每條從可驗證獎勵做 RL 的管線，以及每個用過程獎勵模型（process reward model）的推理模型的基礎。理解 RLHF，就等於理解整套對齊技術。

## The Concept｜核心概念

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**階段 1：監督式 fine-tuning（SFT）。** 從預訓練好的基模型（base model）開始。以人類撰寫的目標行為示範進行 fine-tuning（遵照指令的回應、有幫助的回覆，諸如此類）。結果：一個*偏向好行為*、但動作空間仍沒有上界的模型 `π_SFT`。

**階段 2：獎勵模型訓練。**

- 蒐集回應配對 `(y_+, y_-)`，對應 prompt `x`，由人類標成「y_+ 比另一個好」。
- 訓練獎勵模型 `R_φ(x, y)`，讓它給 `y_+` 更高的分數。
- 損失是 **Bradley-Terry 配對邏輯斯損失**。

  `L(φ) = -E[ log σ(R_φ(x, y_+) - R_φ(x, y_-)) ]`

  σ 是 sigmoid。獎勵差異代表偏好的對數勝算（log-odds）。BT 從 1952 年（Bradley-Terry）就是標準，也是現代 RLHF 的主流選擇。

- `R_φ` 通常從 SFT 模型初始化，上面加一個純量頭。同一個 transformer 骨幹，另加一層線性層輸出獎勵分數。

**階段 3：帶 KL 懲罰，用 RM 當獎勵來跑 PPO。**

- 可訓練的策略（policy） `π_θ` 從 `π_SFT` 初始化。保留一份凍結的*參考策略* `π_ref = π_SFT`。
- 回應 `y` 結尾的獎勵：

  `r_total(x, y) = R_φ(x, y) - β · KL(π_θ(·|x) || π_ref(·|x))`

  KL 懲罰防止 `π_θ` 任意偏離 `π_SFT`——它是*正則化項*，不是硬的信賴域。`β` 通常是 `0.01` 到 `0.05`。
- 用這個獎勵跑 PPO（第 08 課）。優勢在 token 層級的軌跡（trajectory）上算，但 RM 只對完整回應打分。

**為什麼要 KL？** 沒有它，PPO 會毫不遲疑地找出獎勵操弄（reward hacking）的策略——RM 只在分布內（in-distribution）的完成結果上訓練過。分布外（out-of-distribution）的回應，分數可能高過任何人類寫的。KL 把 `π_θ` 留在 RM 訓練過的那個流形（manifold）附近。它是 RLHF 裡最重要的調整參數。

**2026 年的狀態：**

- **DPO**（Rafailov，2023）：閉式代數把第 2、3 階段化成偏好資料上的單一監督損失。沒有 RM，沒有 PPO。對齊基準上品質相同，只需部分運算資源。第 10 階段 · 08 會講。
- **GRPO**（DeepSeek，2024–2025）：用組內相對基準（group-relative baseline）取代評論者的 PPO，獎勵來自*驗證器（verifier）*（程式跑得過／數學答案對得上），不是人類訓練的 RM。推理模型的主流。第 9 階段 · 12 會講。
- **過程獎勵模型（process reward model，PRM）：** 給部分解答打分（每一步推理），推理用的 RLHF 和 GRPO 變體都在用。
- **憲法式 AI（Constitutional AI）／RLAIF：** 用一個已對齊的 LLM 產生偏好，取代人類。擴大可蒐集偏好資料的規模。

```figure
reward-model
```

## Build It｜動手實作

這一課用很小的合成「prompt」和「回應」，用字串表示。RM 是詞袋式 token（bag-of-tokens）表示上的線性評分器。沒有真的 LLM——真正重要的是管線（pipeline）的*架構*，而非規模。見 `code/main.py`。

### 步驟 1：合成偏好資料

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

真實 RLHF 中，這一步由人類標註者完成。形狀——`(prompt, preferred_response, rejected_response)`——是一樣的。

### 步驟 2：Bradley-Terry 獎勵模型

線性分數：`R(x, y) = w · bag(y)`。訓練來最小化 BT 配對對數損失（log loss）：

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

幾百次更新之後，`w` 會對好字的 token 給正權重，對壞字給負權重。

### 步驟 3：疊在 RM 上的類 PPO 策略

我們的玩具策略從詞彙表取樣一個 token。用 RM 給這個 token 打分，計算 `log π_θ(token | prompt)`，加上對參考的 KL 懲罰，再套上截斷的 PPO 代理目標。

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

### 步驟 4：盯著 KL

每次更新追蹤平均 `KL(π_θ || π_ref)`。如果慢慢超過 `~5-10`，策略已經偏離 `π_SFT` 很遠——可能是 `β` 偏低，也可能是獎勵操弄已經開始。這是真實 RLHF 裡最重要的診斷。

### 步驟 5：用 TRL 寫的正式環境配方

玩具管線懂了之後，下面是同一個迴圈、真正的函式庫使用者會寫的樣子。Hugging Face 的 [TRL](https://huggingface.co/docs/trl) 是參考實作——階段 2 用 `RewardTrainer`，階段 3 用 `PPOTrainer`（內建對參考的 KL）。

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

函式庫幫你做三件事。`adap_kl_ctrl=True` 實作自適應 β 排程：觀察到的 KL 超過 `target_kl`，β 就加倍；低於一半，β 就減半。參考模型依慣例是凍結的——你不能意外和 `policy` 共享參數。價值頭與策略共用同一個骨幹（`AutoModelForCausalLMWithValueHead` 接上一個純量 MLP 頭），所以 TRL 把 `policy/kl` 和 `value/loss` 分開回報。

## 容易踩的坑

- **過度最佳化（over-optimization）／獎勵操弄。** RM 不完美；`π_θ` 會找出分數高、其實很糟的對抗性完成結果。症狀：獎勵持續上升，人類評估分數卻停住或下降。解法：提早停止訓練、提高 `β`、擴大 RM 訓練資料涵蓋範圍。
- **長度操弄（length hacking）。** 在有幫助的回應上訓練的 RM，常常隱含地獎勵長度。策略就學會把回應拉長。補救：依長度正規化的獎勵，或用會看長度的 RM 做 RLAIF。
- **RM 太小。** RM 至少要和策略一樣大。太小的 RM 無法忠實地給策略的輸出打分。
- **KL 調校。** β 太低 → 漂移和獎勵操弄。β 太高 → 策略幾乎不動。標準技巧是*自適應* β，把每一步的 KL 維持在一個固定目標值。
- **偏好資料的雜訊。** 人類標籤大約有 30% 含雜訊或有歧義。用只留標註一致的資料來訓練 RM，或在 BT 上加溫度，來校準。
- **異策略問題。** 第一個 epoch 之後，PPO 的資料就稍微異策略。像第 08 課那樣監控截斷比例。

## Use It｜實際應用

2026 年的 RLHF 是分層的：

| 層 | 目標 | 方法 |
|----|------|------|
| 遵照指令、有幫助、無害 | 對齊 | 更常用 DPO（第 10 階段 · 08），而不是 RLHF-PPO。 |
| 推理正確性（數學、程式） | 能力 | 帶驗證器獎勵的 GRPO（第 9 階段 · 12）。 |
| 長視野的多步任務 | agent 式 | 在步驟上用過程獎勵模型的 PPO／GRPO。 |
| 安全／拒絕行為 | 安全 | 帶獨立安全 RM 的 RLHF-PPO，或憲法式 AI。 |
| 推論時的 Best-of-N | 快速對齊 | 解碼時用 RM；不需要訓練策略。 |
| 獎勵蒸餾（reward distillation） | 推論算力 | 在凍結的 LM 上訓練一個小的「獎勵頭」。 |

2022 到 2024 年，RLHF *就是*那個方法。2026 年，正式環境的對齊管線先用 DPO，只有 RM 很重或安全關鍵的步驟才用 PPO。

## Ship It｜交付成果

存成 `outputs/skill-rlhf-architect.md`：

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

## Exercises｜練習

1. **簡單。** 在 `code/main.py` 用 500 對合成偏好訓練 Bradley-Terry 獎勵模型。在留出的 100 對上量配對準確率。應該超過 90%。
2. **中等。** 用 `β ∈ {0.0, 0.1, 1.0}` 跑玩具 PPO-RLHF 迴圈。每一組都畫 RM 分數，以及相對參考策略的 KL，隨更新怎麼走。哪些跑出了獎勵操弄？
3. **困難。** 在同一份偏好資料上實作 DPO（閉式的偏好概似損失），和 RLHF-PPO 管線比用掉的算力，以及最後達到的 RM 分數。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| RLHF | 「對齊用的 RL」 | 三階段管線：SFT + RM + PPO（Christiano 2017、Ouyang 2022）。 |
| 獎勵模型（RM） | 「打分的網路」 | 用 Bradley-Terry 擬合到配對偏好上的純量函數。 |
| Bradley-Terry | 「配對邏輯損失」 | `P(y_+ ≻ y_-) = σ(R(y_+) - R(y_-))`；標準的 RM 目標。 |
| KL 懲罰 | 「留在參考附近」 | 獎勵裡的 `β · KL(π_θ \|\| π_ref)`；對抗獎勵操弄的正則化項。 |
| 獎勵操弄 | 「Goodhart 定律」 | 策略利用 RM 的缺陷；症狀是獎勵上升、人類評估持平。 |
| RLAIF | 「AI 標的偏好」 | 標籤來自另一個 LM、不是人類的 RLHF。 |
| PRM | 「過程獎勵模型」 | 給部分推理步驟打分；用在推理管線。 |
| 憲法式 AI | 「Anthropic 的方法」 | 由明示規則引導、AI 產生的偏好。 |

## Further Reading｜延伸閱讀

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741) ——RLHF 從這篇開始。
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) ——ChatGPT 背後的配方。
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) ——更早、用在摘要的 RLHF。
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) ——DPO；2026 年 RLHF 之後的預設。
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) ——RLAIF 和自我批評迴圈。
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) ——HH 那篇。
- [Hugging Face TRL library](https://huggingface.co/docs/trl) ——正式環境的 `RewardTrainer` 和 `PPOTrainer`。讀 trainer 的原始碼，看自適應 KL 和價值頭的細節。
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf) ——Lambert、Castricato、von Werra、Havrilla 寫的，三階段管線最標準的圖解導覽。
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) ——這個函式庫；`examples/` 有 Llama、Mistral、Qwen 的端到端 RLHF 腳本。
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) ——獎勵假說的觀點；探討獎勵操弄之前必讀。
