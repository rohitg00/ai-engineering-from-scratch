# MDPs، دولت ها، اقدامات و پاداش ها

> یک فرآیند تصمیم گیری مارکوف پنج چیز است: حالت ها، اقدامات، انتقال ها، پاداش ها، تخفیف. همه چیز در RL  Q-learning، PPO، DPO، GRPO  برای این شکل بهینه سازی می شود. آن را یک بار یاد بگیرید، بقیه یادگیری تقویت را رایگان بخوانید.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## مشکل

شما یک ربات شطرنج یا یک برنامه ریز موجودی یا یک نماینده تجاری یا حلقه PPO که یک مدل استدلال را آموزش می دهد چهار حوزه مختلف، یک واقعیت شگفت انگیز: همه چهار به یک شی ریاضی سقوط می کنند.

آموزش تحت نظارت به شما می دهد`(x, y)`در این مرحله، شما می توانید به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به عنوان یک فرد به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به به به به طور کامل به طور کامل به به طور کامل به به به طور کامل به طور کامل به به طور کامل به به به به طور کامل به طور کامل به به به به طور کامل به به به به طور کامل به به به طور کامل به.

شما نمی توانید از این جریان یاد بگیرید تا زمانی که آن را رسمی کنید. "چه چیزی دیدم،" "چه کاری کردم،" "چه اتفاقی افتاد،" "چقدر خوب بود" هر یک باید به یک شی تبدیل شود که می توانید در مورد آن استدلال کنید. این رسمیت گیری یک فرآیند تصمیم گیری مارکوف است. هر الگوریتم RL در این مرحله، از جمله حلقه های RLHF و GRPO در پایان، بر روی این شکل بهینه سازی می کند.

## مفهوم

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**The five objects.**

- **States** $S$همه چيزي که مامور بايد تصميم بگيره در گريد ورلد سلول در شطرنج بورد در ماجرا تحصيلي پنجره ي زمینه و هر خاطره
- **Actions** $A$انتخاب ها، حرکت بالا/ پایین/ چپ/ راست، حرکت بازی کنید، یک توکن بفرستید.
- **Transitions** $P(s' \mid s, a)$. به نظر می رسد$s$و اقدام$a$در شطرنج، استوکاستیک در موجودی، تقریباً تعیین کننده در رمزگذاری LLM.
- **Rewards** $R(s, a, s')$. سیگنال مقیاس. برنده = +1، ضرر = -1. درآمد - هزینه. اصطلاح نسبت احتمال ثبت در GRPO.
- **Discount** $\gamma \in [0, 1)$چقدر پاداش آینده با حال مهمه$\gamma = 0.99$افق 100 قدم را می خرید.$\gamma = 0.9$10 تا میخر

**The Markov property** $P(s_{t+1} \mid s_t, a_t) = P(s_{t+1} \mid s_0, a_0, \ldots, s_t, a_t)$آینده فقط به وضعیت فعلی بستگی دارد. اگر اینگونه نباشد، نمایندگی دولت نامکمل است.

**Policies and returns.**یک سیاست$\pi(a \mid s)$نقشه ها به توزیع عمل می پردازند.$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$ارزش سود سود سود کم شده پاداش های آینده است.$V^\pi(s) = \mathbb{E}[G_t \mid s_t = s]$عواقب انتظار می رود که از $s$در چارچوب سیاست$\pi$. ارزش ق$Q^\pi(s, a) = \mathbb{E}[G_t \mid s_t = s, a_t = a]$هر الگوریتم RL یکی از این دو را تخمین می زند، سپس بهبود می یابد $\pi$در این صورت

**The Bellman equations.**معادلات نقطه ثابت که همه چیز در این مرحله استفاده می کند:

```math
\begin{aligned}
V^\pi(s) &= \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')] \\
Q^\pi(s, a) &= \sum_{s', r} P(s', r \mid s, a) [r + \gamma \sum_{a'} \pi(a' \mid s') Q^\pi(s', a')]
\end{aligned}
```

این تقسیم انتظار می رود به "جایز این مرحله" به همراه "قیمت تخفیف شده از جایی که فرود می روید" بازگردد. هر الگوریتم در مرحله 9 یا این معادله را به تقارب (برنامه سازی پویا) ، نمونه هایی از آن (مونت کارلو) ، یا یک مرحله (تفاوت زمانی) شروع می کند.

```figure
discount-horizon
```

## آن را بسازید

### مرحله اول: یک MDP کوچک تعیین کننده

يک 4×4 GridWorld. مامور از سمت چپ بالا شروع ميکنه، ترمينال در سمت راست پايين، پاداش -1 در هر مرحله، اعمال`{up, down, left, right}`ببین`code/main.py`. .

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

پنج خط، اين کل محیط است. انتقال هاي تعیین کننده، مجازات قدم ثابت، جذب حالت پاياني.

### مرحله دوم: سیاست را اجرا کنید

یک سیاست یک تابع از تقسیم حالت به عمل است. ساده ترین: تصادفی یکسانی.

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

سیاست تصادفی 1000 بار اجرا کنید. متوسط بازگشت حدود -60 تا -80 برای این صفحه 4 × 4 است. بازگشت مطلوب -6 (راه خط مستقیم به سمت راست) است. بسته شدن این شکاف همه چیز در مرحله 9.

### مرحله سوم: محاسبه`V^π`دقیقا از طریق معادله بلمن

برای MDP های کوچک معادله بلمن یک سیستم خطی است. حالت های شماره گذاری، اعمال انتظار، تکرار تا زمانی که ارزش ها متوقف می شوند تغییر می کنند.

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

این ارزیابی سیاست تکراری است. این اولین الگوریتم در Sutton & Barto و پایه نظری هر روش RL است که بعد از آن انجام می شود.

### مرحله چهارم:`γ`یک پارامتر فوق العاده با معنی فیزیکی است

افق موثر تقریباً$1 / (1 - \gamma)$.$\gamma = 0.9$→ 10 قدم$\gamma = 0.99$→ 100 قدم$\gamma = 0.999$→ 1000 قدم

خیلی کم و عامل به طور نزدیک رفتار می کند. بیش از حد بالا و اختصاص اعتبار می شود شور، زیرا بسیاری از مراحل اولیه مسئولیت پاداش آینده را به اشتراک می گذارند. LLM RLHF معمولا استفاده می کند $\gamma = 1$چون قسمت ها کوتاه و محدود هستند.`0.95–0.99`. بازی های استراتژی افق بلند استفاده می کنند`0.999`. .

## دام ها

- **Non-Markovian state.**اگر شما نیاز به سه مشاهدات اخیر برای تصمیم گیری دارید، "حال" فقط مشاهدات فعلی نیست. درست کنید: فریم های استیک (DQN در استیک های Atari 4) یا از حالت مکرر استفاده کنید (LSTM / GRU در مشاهدات).
- **Sparse rewards.**پاداش های فقط برنده باعث می شود یادگیری در فضاهای بزرگ غیرممکن باشد. پاداش های شکل (سیگنال میانگین) یا بوتستراپ با تقلید (فاز 9 · 09).
- **Reward hacking.**بهینه سازی پاداش پراکسی اغلب باعث ایجاد رفتار بیماری می شود. عامل مسابقه قایق OpenAI در دایره ها چرخش می کند و به جای پایان دادن به مسابقه، برای همیشه قدرت را جمع می کند. همیشه پاداش را از نتیجه هدف تعریف کنید، نه پراکسی.
- **Discount mis-spec.** $\gamma = 1$در یک کار افق بی نهایت هر مقدار بی نهایت را می کند. همیشه با افق محدود یا$\gamma < 1$. .
- **Reward scale.**پاداش {+100، -100} در مقابل {+1, -1} سیاست های مطلوب یکسان اما شدت گرادینت بسیار متفاوت را ارائه می دهد.`[-1, 1]`- قبل از اتصال به PPO/DQN

## ازش استفاده کن

ستک 2026 هر خط لوله RL را به یک MDP کاهش می دهد قبل از لمس کردن کد:

| Situation | State | Action | Reward | γ |
|-----------|-------|--------|--------|---|
| Control (locomotion, manipulation) | Joint angles + velocities | Continuous torques | Task-specific shaped | 0.99 |
| Games (chess, Go, poker) | Board + history | Legal move | Win=+1 / loss=-1 | 1.0 (finite) |
| Inventory / pricing | Stock + demand | Order qty | Revenue - cost | 0.95 |
| RLHF for LLMs | Context tokens | Next token | Reward-model score at end | 1.0 (episode ~200 tokens) |
| GRPO for reasoning | Prompt + partial response | Next token | Verifier 0/1 at end | 1.0 |

پنج تاپل را قبل از نوشتن هر حلقه آموزشی بنویسید. اکثر گزارش های خطا "RL کار نمی کند" به یک فرمول MDP که بر روی کاغذ شکسته شده است، برمی گردد.

## -باده

پس از`outputs/skill-mdp-modeler.md`:

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

## تمرینات

1. **Easy.**اجرای 4×4 GridWorld و انتشار سیاست تصادفی در `code/main.py`. 10 هزار قسمت اجرا کن . متوسط و ستد بازگشت را گزارش کن . با بازده مطلوب (-6) مقایسه کن
2. **Medium.**فرار کن`policy_evaluation`با$\gamma \in \lbrace 0.5, 0.9, 0.99 \rbrace$برای سیاست تصادفی یکسره.`V`توضیح دهید چرا ارزش های حالت نزدیک ترمینال با افزایش سریعتر رشد می کنند.$\gamma$. .
3. **Hard.**شبکه جهانی را به حالت استوکاستیک تبدیل کنید: هر عمل به سمت همسایه با احتمال حرکت می کند $p = 0.1$. دوباره بررسي سيستم يكيده رو انجام بده`V[start]`بهتر میشه یا بدتر میشه؟

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)فصل 3 MDPs و معادلات Bellman را پوشش می دهد؛ فصل 1 فرضیه پاداش را که در هر درس بعدی پایه است، انگیزه می دهد.
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) اصل معادله بلمن
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) یک مبدل MDP خلاصه از زاویه عمیق RL.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) مرجع عملیات-تحقیق در مورد MDPs و روش های دقیق راه حل.
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) خالص ترین مشتق MDP به عنوان یک تخصص برنامه نویسی پویا.
