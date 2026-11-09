# نموذج المكافآت & RLHF

> لا يمكن للبشر كتابة وظيفة مكافأة لـ "استجابة مساعد جيدة"، ولكن يمكنهم مقارنة ردود فعل اثنين واختيار أفضل. تناسب نموذج مكافأة لتلك المقارنات، ثم RL نموذج اللغة ضد ذلك. كريستيانو 2017.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## المشكلة

لقد تدربت نموذج لغة على هدف التنبؤ التالي. يكتب اللغة الإنجليزية الجهامية. كما يكذب ويتجول ويرفض الرفض. لا يمكنك إصلاح هذا مع المزيد من التدريب.

تريد مكافأة * مقياسية* تقول "الرد A أفضل من الرد B للتعليمات X". كتابة وظيفة مكافأة يدويا مستحيل. "المساعدة" ليست تعبيرًا مغلقًا على الرموز. ولكن البشر يمكنهم مقارنة نتائج اثنين وتحديد تفضيل. وهذا رخيص لجمعها على مقياس.

RLHF (Christiano et al. 2017; Ouyang et al. 2022) تحويل التفضيلات إلى نموذج مكافأة ، ثم تحسين LM عن طريق PPO ضد هذه المكافأة. في ثلاث خطوات: SFT → RM → PPO. إنها وصفة شحن ChatGPT ، كلود ، جيميني ، وجميع التوافقات الأخرى-LLM في 20232025.

في عام 2026 يتم استبدال خطوة PPO معظمها ب DPO (المرحلة 10 · 08) لأنه أرخص وأكثر فائدة تقريباً للتحديد التوالي. ولكن قطعة * نموذج الجائزة * لا تزال تتمثل في كل عينة أفضل من N ، وكل خط أنبوب RL-من-المكافآت المتحققة ، وكل نموذج التفكير باستخدام نموذج مكافأة العملية. فهم RLHF وفهم كومة التوالي بأكملها.

## المفهوم

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**البدء من نموذج أساسي مدرب مسبقًا. تحسين التوضيحات المكتوبة من قبل الإنسان لسلوك الهدف (ردود تتابع التعليمات، الردود المفيدة، إلخ). النتيجة: نموذج $\pi_{\text{SFT}}$التي * تحيز نحو السلوك الجيد * ولكن لا يزال لها مساحة عمل غير محدودة.

**Stage 2: Reward Model training.**

- جمع أزواج من الردود $(y_+, y_-)$إلى الإشارات$x$، يسميها البشر "y_+ تفضل على y_-. "
- تدريب نموذج مكافأة $R_\phi(x, y)$لتحديد درجات أعلى ل$y_+$. . .
- الخسارة:**Bradley-Terry pairwise logistic**:

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$هو sigmoid. الفرق في المكافأة يعني تراجع التوقيت. BT كانت المعيار منذ 1952 (برادلي تيري) وهي الخيار المهيمن في RLHF الحديث.

- $R_\phi$عادة ما يتم تشغيلها من نموذج SFT مع رأس سكالي على الأعلى. نفس العمود الفقري للمتحول؛ طبقة خطية واحدة تنطلق الجائزة.

**Stage 3: PPO against the RM with KL penalty.**

- إطلاق سياسة التدريب$\pi_\theta$من$\pi_{\text{SFT}}$. إبقَ مرجعًا مُجمدًا$\pi_{\text{ref}} = \pi_{\text{SFT}}$. . .
- مكافأة في نهاية الإجابة$y$:

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  عقوبة ك.إل تمنع$\pi_\theta$من التجول تعسفيًا من$\pi_{\text{SFT}}$ هو * تنظيمي *، وليس منطقة ثقة صعبة. $\beta$عادةً 0.01-0.05.
- تشغيل PPO (دروس 08) مع هذه المكافأة. يتم حساب المزايا على مسار مستوى الرمز، ولكن RM تسجل فقط الاستجابة الكاملة.

**Why the KL?**بدونها، سوف يجد PPO بكل سرور استراتيجيات اختراق المكافآت  تم تدريب RM فقط على الانتهاءات في التوزيع. قد يحصل استجابة خارج التوزيع على درجة أعلى من أي من كتب البشر.$\pi_\theta$بالقرب من المجموعة حيث تم تدريب RM.

**2026 status:**

- **DPO**(رافائيلوف 2023): الهجرة المغلقة تسقط المرحلة 2 + 3 إلى خسارة واحدة تحت الإشراف على بيانات الاختيارات. لا RM، لا PPO. نفس الجودة على معايير التنظيم لجزء من الحساب. تغطية في المرحلة 10 · 08.
- **GRPO**(DeepSeek 20242025): PPO مع خط أساسي مرتبط بالجماعة بدلاً من النقاد، مكافأة من *verifier* (مشاركات الرمز / مطابقات الإجابات الرياضية) بدلاً من RM المدربة من قبل البشر. غالب على نماذج التفكير. تغطية في المرحلة 9 · 12.
- **Process reward models (PRMs):**حلول جزئية (كل خطوة من الحجج) تستخدم في كل من فترات RLHF و GRPO للتحقيق.
- **Constitutional AI / RLAIF:**استخدام القانون القانوني المتماشى لتوليد التفضيلات بدلا من البشر.

```figure
reward-model
```

## بناءها

تستخدم هذه الدروس "التسجيلات" وال"ردود" الصناعية الصغيرة الممثلة على أنها سلسلة. RM هو مستحق رصيد خطي على تمثيل حقيبة من الرموز. لا يوجد LLM حقيقي  * شكل * من خط الأنابيب يهم ، وليس المقياس. انظر `code/main.py`. . .

### الخطوة الأولى: بيانات تفضيل صناعية

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

في RLHF الحقيقي يتم استبدال هذا بالعلامات البشرية.`(prompt, preferred_response, rejected_response)` هو نفس الشيء

### الخطوة الثانية: نموذج مكافأة برادلي تيري

النتيجة الخطية: `R(x, y) = w · bag(y)`. التدريب لتقليل خسارة التسجيلات بالتزامن مع التسجيلات

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

بعد بضع مئات من التحديثات`w`يُعطي الوزن الإيجابي لرمز الكلمات الجيدة والسلبي للسيئ.

### الخطوة الثالثة: سياسة تشبه PPO فوق RM

سياسة ألعابنا تنتج رمز واحد من المفردات$\log \pi_\theta(\text{token} \mid \text{prompt})$، إضافة عقوبة KL إلى المرجع، وتطبيق قطع PPO بديل.

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

### الخطوة الرابعة: مراقبة الممر

متوسط المسار$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$كل تحديث، إذا كان يمر`~5-10`(كل في الرد على كل رد في ناتس، وجميعها على الرموز، وحدات سجلات TRL)$\pi_{\text{SFT}}$: إما$\beta$إن كان منخفضًا جدًا (رفعه ليرجع السياسة) أو بدأ عمليات اختراق المكافآت. هذا هو التشخيص الأعلى في RLHF الحقيقي.

### الخطوة 5: وصفة الإنتاج مع TRL

بمجرد أن تفهم خط أنابيب الألعاب، هنا نفس الحلقة التي يكتبه مستخدم مكتبة حقيقية.[TRL](https://huggingface.co/docs/trl)هو تنفيذ المرجعية  `RewardTrainer`للمرحلة 2 و `PPOTrainer`(مع جهاز KL-to-reference مدمج) للمرحلة الثالثة.

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

ثلاثة أشياء تقوم بها المكتبة من أجلك`adap_kl_ctrl=True`تنفيذ جدول التكيف-β: إذا تجاوز KL الملاحظ `target_kl`النموذج المرجعي يتم تجميده بالاتفاقية  لا يجب أن تشارك المعلمات مع `policy`و رأس القيمة يعيش على نفس العمود الفقري`AutoModelForCausalLMWithValueHead`يرفق رأس MLP (MLP) ، ولهذا السبب تقرير TRL `policy/kl`و`value/loss`بشكل منفصل

## الفخاخ

- **Over-optimization / reward hacking.**الـ (مـ) غير كاملة$\pi_\theta$العلامات: الافضل يرتفع إلى أجل غير مسمى بينما تقدم البشر تقييم مستطيلات أو انخفاض.$\beta$، وتوسيع بيانات تدريب RM.
- **Length hacking.**غالباً ما يتم تكافؤ المعلمين المهنيين على الاستجابات المفيدة بشكل ضمني. تتعلم السياسة كيفية تعبئة الاستجابات. التعويض: مكافأة طبيعية على طول، أو RLAIF مع RM واعية على طول.
- **Too-small RM.**يجب أن يكون الرقم الكبير على الأقل مثل السياسة، ولا يمكن لـ RM الصغير أن يحصل على نتائج سياسة
- **KL tuning.**انخفاض β → التجريد والكافأة القرصنة. انخفاض β → السياسة بالكاد يتغير. الخدعة القياسية هي * التكيف * β التي تهدف إلى KL ثابتة في كل خطوة.
- **Preference-data noise.**~ 30% من اللوحات البشرية ضوضاء أو غامضة. قم بتعليم RM على بيانات مرشحة بالاتفاق أو استخدم درجة حرارة على BT.
- **Off-policy problems.**بيانات PPO غير سياسية قليلا بعد العصر الأول.

## استخدمها

RLHF في عام 2026 هو طبقات:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

كان RLHF * الطريقة * في 20222024. في عام 2026 ، يتم استخدام خطوط أنابيب التنظيم الإنتاج DPO- أولاً ، PPO- فقط للخطوات المكثفة في RM أو الحرجة في السلامة.

## أرسله

إبقوا`outputs/skill-rlhf-architect.md`:

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

## التمارين

1. **Easy.**تدريب نموذج مكافأة برادلي تيري في`code/main.py`على 500 زوج من الأزواج المفضلة الاصطناعية. قياس دقة الأزواج على 100 زوج من الأزواج المحتملة. يجب أن يتجاوز 90%.
2. **Medium.**إشغال حلقة لعبة PPO-RLHF مع $\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$لكل منهما، قم بتحديد النتيجة المقدمة مقابل النتيجة المرجعية من خلال التحديثات
3. **Hard.**تنفيذ DPO (خسارة احتمالية تفضيل الشكل المغلق) على نفس البيانات المفضلة ومقارنة مع خط أنابيب RLHF-PPO في الحساب المستخدم والنتيجة النهائية RM التي تم تحقيقها.

## الشروط الرئيسية

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

## المزيد من القراءة

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741)- الصحيفة التي بدأت "الـ"ر"هـف
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) وصفة خلف ChatGPT.
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) قبل الـ RLHF للاختصار.
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) DPO؛ الاختلالات بعد RLHF في عام 2026.
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF و حلقة النقد الذاتي.
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862)ورقة "إتش.إتش".
- [Hugging Face TRL library](https://huggingface.co/docs/trl) الإنتاج `RewardTrainer`و`PPOTrainer`. اقرأ مصدر المدرب لتفاصيل التكيفية-KL و القيمة رأس.
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)من قبل لامبرت، كاستريكاتو، فون وررا، هافريلا  المشي القنوني من خلال خط الأنابيب الثلاث المراحل مع الرسومات.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl)المكتبة`examples/`لديه نصوص RLHF من نهاية إلى نهاية للاما، ميسرال، و Qwen.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) وجهة نظر فرضية المكافأة؛ شرط أساسي للتفكير في اختراق المكافأة.
