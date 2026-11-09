# RL برای بازی ها  AlphaZero، MuZero و عصر استدلال LLM

> 1992: TD-Gammon قهرمانان انسانی را در بازی پشت بازی با TD خالص شکست داد. 2016: AlphaGo Lee Sedol را شکست داد. 2017: AlphaZero از ابتدا بر شطرنج، شوگی و گو تسلط داشت. 2025: DeepSeek-R1 ثابت کرد که همان دستور کار را با جایگزین کردن PPO، GRPO بر روی استدلال کار می کند. بازی ها معیار است که هر پیشرفت را در این مرحله هدایت می کند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## مشکل

بازی ها هر چیزی را که RL می خواهد دارند. پاداش پاک (انتخاب / بازنده). حلقات بی نهایت (بازدید بازی خود). شبیه سازی کامل (بازی * شبیه ساز است). فضاهای عمل مداوم کوچک یا متناوب. ساختار چند عامل که قدرت مقاومت در برابر مخالفان را مجبور می کند.

و بازی ها نحوه آزمایش هر پیشرفت اصلی RL هستند. TD-Gammon (بازگامون، 1992). آتاری-DQN (2013). آلفاگو (2016). آلفازرو (2017). OpenAI پنج (دوتای ۲، ۲۰۱۹). آلفا استار (استر کرافت دوم، 2019) MuZero (نموذج آموخته، 2019). آلفا تنسور (مربوطی ماتریکس، 2022). آلفا دیو (الگوریتم های مرتب، 2023). DeepSeek-R1 (بررایی ریاضی، 2025)  آخرین نشان دادن که تکنیک های بازی-RL در متن کار می کنند.

این سنگ پایه سه معماری تاریخی  AlphaZero، MuZero و GRPO  را از طریق یک لنز متحد کننده بررسی می کند: **self-play + search + policy improvement**هر یک از آنها به طور کلی قبلی را عمومی می کند؛ GRPO به ویژه نسخه AlphaZero برای استدلال LLM استفاده می شود، با توکن ها به عنوان اقدامات و تأیید ریاضی به عنوان سیگنال برنده.

## مفهوم

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**Silver et al. به عنوان یک بازی (شطرنج، شوجی، گاو) با قوانین شناخته شده:

- شبکه ارزش سیاست: یک برج $f_\theta(s) \to (p, v)$.$p$. در مورد اقدامات حقوقی پیش رويه$v$نتیجه بازی انتظار می رود.
- جستجوی درخت مونت کارلو (MCTS): در هر حرکت، درختی از ادامه های احتمالی را گسترش دهید. استفاده کنید $(p, v)$به عنوان پیش + بوترپ. نودها را با UCB (PUCT) انتخاب کنید: $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$. .
- خود بازی: بازی های بازیگر علیه بازیگر.$t$، توزیع بازدیدهای MCTS$\pi_t$به عنوان هدف آموزش سیاست تبدیل می شود.
- خسارت:$L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$.$z$نتیجه بازی (+1 / 0 / -1) است.

صفر دانش انسان، صفر هوریستیک دستکاری، یک دستورالعملی که پس از چند ده میلیون بازی خود بازی، شطرنج، شوگی و گاو را تسلط می دهد.

**MuZero (2019).**Schrittwieser et al. نیاز به دانستن قوانین را حذف می کند.

- به جای یک محیط ثابت، یک مدل دینامیک پنهان یاد بگیرید$(h, g, f)$:
  - $h(s)$: مشاهده را به حالت غفلت کدگذاری کنید.
  - $g(s_{\text{latent}}, a)$: پیش بینی حالت غائب بعدی + پاداش
  - $f(s_{\text{latent}})$: پیش بینی سیاست قبلی + ارزش
- MCTS در فضای پنهان آموخته اجرا می شود. همان جستجو، همان حلقه آموزش.
- کار ميکنه روي گو، شطرنج، شگوي و آتاري يه الگوریتم، بدون علم قاعده

**Stochastic MuZero (2022).**دینامیک استوکاستیک و گره های تصادفی را اضافه می کند؛ به بازی های کلاس بازک بازی می شود.

**Muesli, Gumbel MuZero (2022-2024).**بهبود بهره وری نمونه ها و جستجوی تعیین کننده

**GRPO (2024-2025).**نسخه DeepSeek-R1، همان حلقه شکل آلفا صفر، که برای استدلال مدل زبان استفاده می شود:

- "Game": پاسخ به یک مشکل ریاضی / کدگذاری / استدلال. "Win" = تایید کننده (پاس آزمون مورد، پاسخ عددی مطابقت) 1 را باز می آورد.
- سیاست: LLM. اقدامات: توکن ها. دولت: فوری + پاسخ - تا کنون.
- هیچ منتقدی (به سبک PPO)$V_\phi$) در عوض، برای هر پرامپ، نمونه$G$از پوليس به دست آمده است. پاداش را براي هر يك محاسبه كنيد. از روش**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$به عنوان سیگنال برای بروزرسانی به سبک REINFORCE.
- مجازات KL به سیاست مرجع برای جلوگیری از حرکت (مانند RLHF).
- خسارت کامل:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

هیچ مدل پاداش آموخته، هیچ منتقد، هیچ MCTS. یک تأیید کننده مبتنی بر قوانین پاداش را فراهم می کند، خط پایه مربوط به گروه جایگزین منتقد می شود و مرحله جستجو رها می شود. کیفیت PPO-RLHF در معیار های استدلال در یک بخش از محاسبه مطابقت دارد یا از آن فراتر می رود.

**The R1 recipe in full.**DeepSeek-R1 (DeepSeek 2025) دو مدل در یک مقاله است:

- **R1-Zero.**از مدل پایه DeepSeek-V3 شروع کنید. بدون SFT. GRPO را مستقیما با دو بخش پاداش اعمال کنید: * پاداش دقت* (بناظر قواعد  آیا پاسخ نهایی به شماره صحیح تجزیه و تحلیل شد / آیا کد از آزمون واحد عبور کرد) و * پاداش شکل (آیا تکمیل زنجیره فکر خود را در `<think>…</think>`در طول هزاران مرحله، طول متوسط پاسخ از ~100 تا ~10,000 توکن افزایش می یابد و نمرات معیار ریاضی به سطح پیش نمایش نزدیک به o1 می رسد. مدل از ابتدا به استدلال یاد می گیرد. زیان آن: زنجیره های تفکر آن اغلب غیر قابل خواندن، زبان های مخلوط و عدم شیش سبک است.
- **R1.**مشکلات قابل خواندن R1-Zero را با یک خط لوله چهار مرحله ای حل کنید:
  1. **Cold-start SFT.**چند هزار نمايش طولاني CoT را با فرمتي پاک جمع آوری کنيد و مدل پايين را بر روي آنها کنترل کنيد
  2. **Reasoning-oriented GRPO.**برای جلوگیری از تغییر کد GRPO با پاداش دقت + فرمت و پاداش *تبصیری از زبان* اعمال کنید.
  3. **Rejection sampling + SFT round 2.**نمونه ~ 600K مسیر استدلال از نقطه بازرسی RL، فقط آنهایی را که پاسخ های نهایی درست و CoT قابل خواندن دارند، نگه دارید و با ~ 200K نمونه های SFT غیر استدلال (نویس، QA، خود شناسایی) ترکیب کنید. دوباره پایه را تنظیم کنید.
  4. **Full-spectrum GRPO.**یک دور دیگر RL که هم استدلال (تجوبات مبتنی بر قوانین) و هم هماهنگی عمومی (تجوبات مبتنی بر اولویت مفید/ بی ضرر) را پوشش می دهد.

نتیجه با o1 در AIME و MATH-500 در وزن های باز مطابقت دارد و به اندازه کافی کوچک است تا تصفیه شود. همان مقاله همچنین شش مدل کثافت تصفیه شده (Qwen-1.5B تا Llama-70B) را با SFT'ing در ردیف استدلال R1  هیچ RL در دانش آموز منتشر می کند. تصفیه یک معلم RL قوی به طور مداوم از صفر در مقیاس دانش آموز RL را شکست می دهد.

**Why GRPO instead of PPO for reasoning.**سه دلیل در مقاله DeepSeekMath (فبروری 2024): (1) هیچ شبکه ارزش برای آموزش، نصف حافظه؛ (2) خط پایه گروه به طور طبیعی پاداش نادر پایان مسیر را که وظایف استدلال ایجاد می کند، اداره می کند؛ (3) نرمال سازی به صورت فوری باعث می شود مزایای قابل مقایسه در میان مشکلات سختی بسیار متفاوت باشد، که تنها منتقد PPO نمی تواند انجام دهد.

**Search-free vs search-based.**بازي ها شاخه هاي مختلفي دارن:

- * بازی های اطلاعات کامل با افق های طولانی* (روید، شطرنج): هنوز هم مبتنی بر جستجو.
- * استدلال LLM*: هنوز MCTS در تولید نیست؛ GRPO در راه اندازی کامل، بهترین N برای محاسبه نتیجه گیری. مدل های پاداش فرآیند (PRM) اشاره به اضافه کردن جستجوی مرحله ای در مرحله است.

```figure
f3-selfplay-ladder
```

## آن را بسازید

کد در`code/main.py`ابزارها**GRPO in miniature**: یک غارتگر با گروه های متعدد نمونه. الگوریتم مشابه در یک LLM است؛ تنها سیاست و محیط ساده تر است. این * ضرر * و * مزایای مربوط به گروه * را یاد می دهد، که نوآوری 2024 از DeepSeekMath است.

### مرحله اول: یک محیط کوچک تایید کننده

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

در GRPO واقعی، تایید کننده تست های واحد را اجرا می کند یا برابری ریاضی را بررسی می کند.

### مرحله دوم: سیاست: softmax بر روی K جواب نشان ها در هر پرامپ

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

معادل محصول لایه نهایی یک LLM که به یک پرامپت مشروط است.

### مرحله سوم: نمونه گیری گروهی و مزایای مربوط به گروه

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

مزیت مربوط به گروه، ترفند DeepSeek 2024 است. نیازی به انتقاد نیست. "بز لائن" متوسط گروه است و عادی سازی از گروه std استفاده می کند.

### مرحله 4: مقایسه با خط پایه REINFORCE (بدون ارزش)

همون تنظیم، همون محاسبه، ساده REINFORCE GRPO همگامش سریعتر و پایدارتر

### مرحله 5: مشاهده انترپی و KL

همان تشخیص هایی که RLHF انجام می دهد: متوسط KL برای مرجع، انتروپی سیاست، پاداش بیش از زمان.

## دام ها

- **Reward hacking via verifier gaming.**GRPO ریسک RLHF را به ارث می برد: اگر تأیید کننده اشتباه باشد یا قابل بهره برداری باشد، LLM به دنبال بهره برداری خواهد بود.
- **Group size too small.**تفاوت میانگین گروه به این شکل است:$1/G$(خطای استانداردش مثل$1/\sqrt{G}$) زیر$G = 4$، سیگنال مزایایی سر و صداست ، انتخاب استاندارد$G = 8$تا 64
- **Length bias.**تکمیل LLM در طول های مختلف احتمالات مختلف ثبت را دارند. با تعداد توکن ها عادی سازی کنید، یا از سطح ردیابی استفاده کنید، یا به حداکثر طول کوتاه کنید.
- **Pure self-play cycles.**تمرینات سبک آلفا صفر می تواند در حلقه های تسلط در بازی های مجموع عمومی گیر کند.
- **Search-policy mismatch.**آلفازرو سیاست را برای تقلید از نتایج جستجو آموزش می دهد. اگر شبکه سیاست برای نشان دادن توزیع جستجو خیلی کوچک باشد، آموزش متوقف می شود.
- **Compute floor.**MuZero / AlphaZero نیاز به محاسبات عظیم دارد. یک حذف واحد اغلب صدها ساعت GPU است. نمایشگاه های کوچک وجود دارد (به عنوان مثال ، AlphaZero در Connect Four) برای یادگیری.
- **Verifier coverage.**آزمایشات واحد که برای یک راه حل خطا عبور می کنند، خطای را تقویت می کنند.

## ازش استفاده کن

چشم انداز بازی-RL 2026، به عنوان دامنه:

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

*وصیه *  خود بازی، بهبود افزوده شده با جستجو، اصلاح سیاست  شامل متن، پیکسل ها و کنترل فیزیکی است. GRPO جوانترین نمونه است؛ بیشتر در حال حاضر هستند.

## -باده

پس از`outputs/skill-game-rl-designer.md`:

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

## تمرینات

1. **Easy.**در سال ۲۰۰۱،`code/main.py`. آموزش در 2 پیامک × 4 جواب هر نشان. به هم در < 1000 بروزرسانی با $G=8$. .
2. **Medium.**پلو در PPO (کسته شده) و وانیل REINFORCE. مقایسه بهره وری نمونه و تفاوت پاداش به GRPO در همان باندیت.
3. **Hard.**به یک "سلسلۀ استدلال" طول-2 گسترش دهید: نماینده دو توکن را صادر می کند و تأیید کننده جفت را پاداش می دهد. اندازه گیری چگونگی GRPO در جهت تعیین اعتبار در دو ردیف مرحله ای انجام می شود. (تغییر: مزایای گروه محاسبه در هر *سلسل کامل*، به هر دو موقعیت توکن گسترش دهید.)

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270). .
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404). .
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4). .
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z). .
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) مقاله ای که GRPO و پایه مربوط به گروه را معرفی کرد.
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) نسخه کامل چهار مرحله R1 به علاوه آبلاسیون R1- صفر.
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) CFR + یادگیری عمیق در مقیاس
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)روزنامه ای که همه چیز رو شروع کرد
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) مرجع تولید برای استفاده از GRPO با عملکردهای پاداش سفارشی.
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) تکرار باز نسخه R1 در مقیاس های متعدد.
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) چارچوب کتاب درسی برای بازی خود، جستجو و "جایز طراحی شده" که R1 در مقیاس LLM ارائه می دهد.
