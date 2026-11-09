# مدل سازی پاداش و RLHF

> انسان ها نمی توانند یک تابع پاداش را برای "پاسخ دستیار خوب" بنویسند، اما می توانند دو پاسخ را مقایسه کنند و یکی بهتر را انتخاب کنند. یک مدل پاداش را به این مقایسه ها مناسب کنید، سپس مدل زبان را در مقابل آن تنظیم کنید. کریستیانو 2017. InstructGPT 2022.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment), Phase 9 · 08 (PPO)
**Time:** ~45 minutes

## مشکل

شما یک مدل زبان را بر روی هدف پیش بینی نشانه بعدی آموزش داده اید. آن زبان انگلیسی گرائماتیک را می نویسد. همچنین دروغ می گوید، سرگردان است و از انکار انکار انکار می کند. شما نمی توانید این را با آموزش بیشتر حل کنید.

شما می خواهید * پاداش مقیاس* که می گوید "جواب A بهتر از پاسخ B برای دستورالعمل X است". نوشتن این عملکرد پاداش به دست غیرممکن است. "مفید بودن" یک عبارت بسته در مورد توکن نیست. اما انسان می تواند دو محصول را مقایسه کند و یک اولویت را نشان دهد. این برای جمع آوری در مقیاس ارزان است.

RLHF (Christiano et al. 2017; Ouyang et al. 2022) ترجیحات را به یک مدل پاداش تبدیل می کند، سپس LM را از طریق PPO در برابر این پاداش بهینه می کند. در سه مرحله: SFT → RM → PPO. این نسخه است که ChatGPT، Claude، Gemini و هر LLM دیگر را در سال 2023 2025 ارسال کرد.

در سال 2026 مرحله PPO عمدتاً با DPO (فاز 10 · 08) جایگزین می شود زیرا ارزان تر و تقریباً برای تنظیم خط است. اما قطعه * مدل پاداش* هنوز هم زیربنای هر نمونه گیری بهترین N ، هر خط پاداش RL- از-تحقیقی ، و هر مدل استدلال با استفاده از مدل پاداش فرآیند است. درک RLHF و شما درک کل استیک خط استیکشن را درک می کنید.

## مفهوم

![Three-stage RLHF: SFT, RM training on pairwise prefs, PPO with KL penalty](../assets/rlhf.svg)

**Stage 1: Supervised Fine-Tuning (SFT).**از یک مدل پایه پیش از آموزش آغاز کنید. تنظیم دقیق در نمایش های نوشته شده توسط انسان از رفتار هدف (پاسخ های پس از دستورالعمل، پاسخ های مفید و غیره). نتیجه: یک مدل $\pi_{\text{SFT}}$که *به سمت رفتار خوب طرفدار است* اما هنوز فضای عمل نامحدود دارد.

**Stage 2: Reward Model training.**

- جفت های پاسخ جمع آوری کنید $(y_+, y_-)$به دستورات$x$, توسط انسان ها به عنوان "y_+ در مقابل y_-. ترجیح داده می شود".
- مدل پاداش رو آموزش بده$R_\phi(x, y)$برای دادن نمره های بالاتر به $y_+$. .
- خسارت:**Bradley-Terry pairwise logistic**:

  $L(\phi) = -\mathbb{E}[ \log \sigma(R_\phi(x, y_+) - R_\phi(x, y_-)) ]$

  $\sigma$BT از سال 1952 (برادلی-ترری) استاندارد بوده و انتخاب غالب در RLHF مدرن است.

- $R_\phi$معمولا از مدل SFT با سر اسکالر در بالا آغاز می شود. همان ستون فقرات ترانسفورماتور؛ یک لایه خطی واحد پاداش را خارج می کند.

**Stage 3: PPO against the RM with KL penalty.**

- شروع کردن سیاست آموزش پذیر$\pi_\theta$از$\pi_{\text{SFT}}$. يه مرجع رو نگه دار$\pi_{\text{ref}} = \pi_{\text{SFT}}$. .
- پاداش در پایان پاسخ$y$:

  $r_{\text{total}}(x, y) = R_\phi(x, y) - \beta \cdot \mathrm{KL}(\pi_\theta(\cdot \mid x) \Vert \pi_{\text{ref}}(\cdot \mid x))$

  مجازات " کلو " مانع از اين مي شود$\pi_\theta$از انحراف تعسفي از$\pi_{\text{SFT}}$ این یک *regularizer* است، نه یک منطقه اعتماد سخت. $\beta$معمولاً 0.01-0.05
- با این پاداش PPO (درسی 08) اجرا کنید. مزایای بر روی مسیر سطح توکن محاسبه می شوند، اما RM فقط پاسخ کامل را نمره می دهد.

**Why the KL?**بدون آن، PPO با خوشحالی استراتژی های هک پاداش را پیدا می کند. RM فقط در تکمیل در توزیع آموزش دیده است. پاسخ خارج از توزیع ممکن است بالاتر از هر پاسخ نوشته شده توسط انسان باشد. KL نگه می دارد.$\pi_\theta$در نزدیکی دسته بندی که RM آموزش داده شده است. این مهم ترین دستبندی در RLHF است.

**2026 status:**

- **DPO**(Rafailov 2023): الجبر شکل بسته به مرحله 2 + 3 به یک ضرر واحد تحت نظارت بر داده های اولویت سقوط می کند. هیچ RM، هیچ PPO. کیفیت مشابه در معیار های مرزی جهت تنظیم برای یک بخش از محاسبه. در مرحله 10 · 08 پوشش داده شده است.
- **GRPO**(DeepSeek 20242025): PPO با یک خط پایه مربوط به گروه به جای یک منتقد، پاداش از یک *verifier* (کد اجرا / پاسخ ریاضی مطابقت) به جای RM آموزش دیده توسط انسان. غالب برای مدل های استدلال. در مرحله 9 · 12 پوشش داده شده است.
- **Process reward models (PRMs):**راه حل های جزئی (هر مرحله استدلال) را که در هر دو نسخه RLHF و GRPO برای استدلال استفاده می شود، به دست آورید.
- **Constitutional AI / RLAIF:**استفاده از یک LLM هماهنگ برای ایجاد ترجیحات به جای انسان.

```figure
reward-model
```

## آن را بسازید

در این درس از "تغییرات" و "جوابات" مصنوعی کوچک استفاده می شود که به عنوان رشته ها نشان داده می شود. RM یک امتیاز خطی بر روی نمایش کیف توکن است. هیچ LLM واقعی  شکل * خط لوله مهم نیست، نه مقیاس. ببینید `code/main.py`. .

### مرحله اول: اطلاعات ارجاع مصنوعی

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

در RLHF واقعی این توسط برچسب های انسانی جایگزین می شود.`(prompt, preferred_response, rejected_response)` یکسان است.

### مرحله دوم: مدل پاداش برادلی-ترری

نمره خطی: `R(x, y) = w · bag(y)`. آموزش برای حداقل رساندن خسارت دوگانه ی ثبت نام BT:

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

بعد از چندصد تا اپدیت`w`به نشانه های خوب و منفی به نشانه های بد وزن مثبت می دهد.

### مرحله سوم: سیاست مشابه PPO بر روی RM

ما در قانون اسباب بازی ما یک توکن واحد از یک لغت تولید می کنیم.$\log \pi_\theta(\text{token} \mid \text{prompt})$، به جریمه ی KL به عنوان مرجع اضافه کنید و جایگزین PPO را که قطع شده است اعمال کنید.

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

### مرحله 4: کنترل KL

متوسط مسیر$\mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$هر تازه کاری اگه از قبل هم پیش بره`~5-10`(در هر پاسخ KL در nats، جمع آوری بیش از توکن ها، واحد TRL ثبت) سیاست به دور از $\pi_{\text{SFT}}$: یا$\beta$این تشخیص بالا در RLHF واقعی است.

### مرحله 5: دستور تهیه با TRL

وقتی که خط لوله اسباب بازی رو فهمیدی، این همان حلقه ای است که یک کاربر واقعی کتابخانه می نویسد.[TRL](https://huggingface.co/docs/trl)آیا اجرای مرجع است  `RewardTrainer`برای مرحله 2 و `PPOTrainer`(با یک KL-to-reference ساخته شده) برای مرحله 3.

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

سه تا کاري که کتابخانه براي تو ميکنه`adap_kl_ctrl=True`برنامه ای را اجرا می کند که با استفاده از برنامه ای با حالت تطبیقی (β): اگر KL مشاهده شده از `target_kl`مدل مرجع با سنت منجمد شده است  نباید به طور تصادفی پارامترها را با  به اشتراک بگذارید.`policy`و ارزش سر در همان ستون فقرات با سیاست زندگی می کند (`AutoModelForCausalLMWithValueHead`یک سر MLP اسکالر را متصل می کند) که به همین دلیل گزارش TRL `policy/kl`و`value/loss`به طور جداگانه

## دام ها

- **Over-optimization / reward hacking.**RM ناقصه$\pi_\theta$علائم: پاداش تا حد نامحدودی بالا می رود در حالی که ارزیابی انسانی نمره های بالا یا پایین می آید. تصحیح: زود متوقف شوید، افزایش دهید $\beta$، اطلاعات آموزش RM را گسترش دهید.
- **Length hacking.**RMs آموزش داده شده در پاسخ های مفید اغلب ضمنی پاداش طول. سیاست یاد می گیرد تا پاسخ ها را بسته کند. اصلاح: پاداش نرمال شده در طول، یا RLAIF با RM آگاه در طول.
- **Too-small RM.**RM باید حداقل به اندازه پوليس بزرگ باشه. RM کوچکی نمیتونه به طور وفادار نتایج پوليس رو بدست بیاره
- **KL tuning.***تراکم کردن β → حرکت و هک پاداش. *تراکم کردن β → سیاست به سختی تغییر می کند. *تراکم استاندارد *تراکم است که به یک KL ثابت در هر مرحله هدف قرار می دهد.
- **Preference-data noise.**~ 30% از برچسب های انسانی سر و صدا یا مبهم هستند. با آموزش RM بر اساس داده های فیلتر شده توافق یا استفاده از دمای بر روی BT.
- **Off-policy problems.**داده های PPO بعد از دوره اول کمی غیر از سیاست است.

## ازش استفاده کن

RLHF در سال 2026 لایه هایی است:

| Layer | Target | Method |
|-------|--------|--------|
| Instruction following, helpfulness, harmlessness | Alignment | DPO (Phase 10 · 08) preferred over RLHF-PPO. |
| Reasoning correctness (math, code) | Capability | GRPO with verifier reward (Phase 9 · 12). |
| Long-horizon multi-step tasks | Agentic | PPO / GRPO with process reward models over steps. |
| Safety / refusal behavior | Safety | RLHF-PPO with separate safety RM, or Constitutional AI. |
| Best-of-N at inference | Fast alignment | Use RM at decode time; no policy training needed. |
| Reward distillation | Inference compute | Train a small "reward head" on top of a frozen LM. |

RLHF در سال 2022 تا 2024 * روش * بود. در سال 2026، لوله های خط خط تولید برای مراحل شدید RM یا ایمنی حیاتی DPO-اول و فقط PPO- هستند.

## -باده

پس از`outputs/skill-rlhf-architect.md`:

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

## تمرینات

1. **Easy.**مدل پاداش برادلي-تيري رو آموزش بده`code/main.py`در 500 جفت ترجیح مصنوعی دقت جفتی را در 100 جفت نگه داشته اندازه گیری کنید. باید 90 درصد را فراتر ببرد.
2. **Medium.**با استفاده از حلقه PPO-RLHF بازی رو اجرا کن$\beta \in \lbrace 0.0, 0.1, 1.0 \rbrace$براي هر يک، نمره RM رو به KL نسبت به اطلاعاتي که در موردش هست بازي کنيد
3. **Hard.**DPO (خسرت احتمال اولویت در فرم بسته) را بر روی همان داده های اولویت اعمال کنید و با خط لوله RLHF-PPO در محاسبه مورد استفاده و نمره نهایی RM که بدست آمده است مقایسه کنید.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Christiano et al. (2017). Deep Reinforcement Learning from Human Preferences](https://arxiv.org/abs/1706.03741)روزنامه ای که شروع به RLHF کرد
- [Ouyang et al. (2022). InstructGPT — Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) دستورات پشت ChatGPT
- [Stiennon et al. (2020). Learning to summarize with human feedback](https://arxiv.org/abs/2009.01325) RLHF قبلی برای خلاصه
- [Rafailov et al. (2023). Direct Preference Optimization](https://arxiv.org/abs/2305.18290) DPO؛ پس از RLHF در سال 2026
- [Bai et al. (2022). Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) RLAIF و حلقه انتقاد از خود
- [Anthropic RLHF paper (Bai et al. 2022). Training a Helpful and Harmless Assistant](https://arxiv.org/abs/2204.05862) کاغذ HH
- [Hugging Face TRL library](https://huggingface.co/docs/trl) تولید `RewardTrainer`و`PPOTrainer`. منبع آموزش رو براي اطلاعات مربوط به KL و ارزش بالا بخونيد
- [Hugging Face — Illustrating Reinforcement Learning from Human Feedback](https://huggingface.co/blog/rlhf)توسط لامبرت، کاستریکاتو، فون وررا، هاوریلا  راه رفتن کانونیکی از لوله سه مرحله با نمودار.
- [von Werra et al. (2020). TRL: Transformer Reinforcement Learning](https://github.com/huggingface/trl) کتابخانه`examples/`اسکریپت های RLHF برای Llama، Mistral و Qwen را دارد.
- [Sutton & Barto (2018). Ch. 17.4 — Designing Reward Signals](http://incompleteideas.net/book/RLbook2020.pdf) دیدگاه فرضیه پاداش؛ شرط اصلی برای فکر کردن در مورد هک پاداش.
