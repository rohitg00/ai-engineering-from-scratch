# روش های مونت کارلو  یادگیری از قسمت های کامل

> برنامه نویسی پویا به یک مدل نیاز دارد. مونت کارلو به جز قسمت ها نیاز ندارد. سیاست را اجرا کنید، بازده ها را تماشا کنید، آنها را متوسط کنید. ساده ترین ایده در RL  و آن چیزی که همه چیز را در جریان باز می کند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## مشکل

برنامه نویسی پویا زیباست، اما فرض می کند که می توانید سوال کنید$P(s' \mid s, a)$برای هر حالت و عمل. تقریبا هیچ چیز در دنیای واقعی به این ترتیب کار نمی کند. یک ربات نمی تواند توزیع بر روی پیکسل های دوربین را پس از یک تور مشترک تحلیلی محاسبه کند. یک الگوریتم قیمت گذاری نمی تواند در هر واکنش مشتری احتمالی ادغام شود. یک LLM نمی تواند تمام ادامه های ممکن پس از یک توکن را لیست کند.

شما به یک روش نیاز دارید که فقط توانایی نمونه گیری از محیط زیست را داشته باشید.`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`ازش براي برآوردي ارزش ها استفاده کن اين مونت کارلو

تغییر از DP به MC از نظر فلسفی مهم است: ما از * مدل شناخته شده + پشتیبان گیری دقیق * به * نمونه های اجرا شده + بازده متوسط * حرکت می کنیم. تفاوت ها افزایش می یابد، اما کاربرد پذیری انفجار می یابد. هر الگوریتم RL پس از این درس  TD، Q-learning، REINFORCE، PPO، GRPO  یک تخمین دهنده مونت کارلو است. گاهی اوقات با بوترسترپینگ لایه بالا.

## مفهوم

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$کجا$G^{(i)}(s)$در نتیجه بازدید از $s$در چارچوب سیاست$\pi$. .

**First-visit vs every-visit MC.**با توجه به قسمتي که از ايالت بازدید ميکنه$s$چندین بار، MC اولین بازدید فقط بازگشت از اولین بازدید را محاسبه می کند؛ هر بازدید MC همه بازدید را محاسبه می کند. MC اولین بازدید غیر جانبدار است. هر بازدید MC می تواند کمی طرفدار باشد پس از تعداد محدود قسمت ها، زیرا به طور متوسط تعداد تصادفی بازگشت در هر قسمت و این تعداد می تواند با بازگشت ها مرتبط باشد، اما هر دو به$V^\pi(s)$هر بار که بازدید می شود، تعداد بازدیدها به بی نهایت می رسد. اولین بازدید آسان تر برای تجزیه و تحلیل است (نمونه های iid). هر بازدید از داده های بیشتری در هر قسمت استفاده می کند و معمولاً در عمل سریعتر به هم می پیوندد.

**Incremental mean.**به جای ذخیره کردن تمام بازپرداخت ها، متوسط اجرا را به روز کنید:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

سازماندهی مجدد: $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$با$\alpha = 1/n$. عوضش کن$1/n$برای اندازه قدم ثابت$\alpha \in (0, 1)$و شما یک تخمین دهنده MC غیر ثابت را دریافت می کنید که تغییرات را در $\pi$اين حرکت تمام پرش از MC به TD به هر الگوریتم RL مدرن است

**Exploration is now a problem.**دی پی به هر ایالت با شماره گیری دست پیدا کرد.$\pi$در واقع، تمام مناطق از فضای دولتی هرگز نمونه نمی گیرند و تخمین های ارزش آنها برای همیشه در صفر باقی می ماند.

1. **Exploring starts.**هر قسمت را از یک جفت تصادفی شروع کنید. پوشش را تضمین می کند؛ غیر واقع بینانه در عمل (شما نمی توانید یک ربات را به حالت تعسفی "بازگردانید").
2. **ε-greedy.**عمل طمعي و با احتمالي$\epsilon$هر دو جفت عمل حالت به صورت غیرمثل نمونه می شوند.
3. **Off-policy MC.**جمع آوری اطلاعات تحت یک سیاست رفتار$\mu$، درباره سیاست هدف آشنا شو$\pi$با استفاده از نمونه گیری اهمیت، تفاوت زیاد، اما این پل به روش های بازخورد مانند DQN است.

**Monte Carlo Control.**ارزیابی → بهبود → ارزیابی، درست مانند تکرار سیاست، اما ارزیابی مبتنی بر نمونه گیری است:

1. فرار کن$\pi$، یه قسمت رو بگیر
2. تازه شدن$Q(s, a)$از بازده های مشاهده شده
3. -بذار$\pi$. یه طمع و طمع$Q$. .
4. تکرار کنم

به $Q^{\ast}$و$\pi^{\ast}$با احتمال 1 در شرایط خنثی (هر جفت به طور بی نهایت مکرر بازدید می شود)$\alpha$روبنز مونرو را راضی می کند

```figure
epsilon-greedy
```

## آن را بسازید

### مرحله 1: انتشار → لیست (s، a، r)

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

نه مدل، فقط`env.reset()`و`env.step(s, a)`. همون رابطي که يه محیط تمرينگاهه اما از دست رفته

### مرحله دوم: بازپرداخت محاسبه (سوی باز)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

يه گذرگاه$O(T)$تکرار عقب$G_t = r_{t+1} + \gamma G_{t+1}$از جمع بندی مجدد اجتناب می کند.

### مرحله سوم: ارزیابی MC در اولین بازدید

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

سه خط کار را انجام می دهند: وضعیت را در اولین بازدید مشاهده کنید، تعداد افزایشی، متوسط اجرا تازه.

### مرحله 4: کنترل کلانترال های خوشخواهی (در سیاست)

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### مرحله 5: مقایسه با استاندارد طلا DP

برآورد شما از$V^\pi$در واقع: ۵۰ هزار قسمت در شبکه شبکه جهانی ۴×۴ شما را در داخل می کند`~0.1`از پاسخ DP

## دام ها

- **Infinite episodes.**اگه مي توني براي هميشه به صورت لوپ عمل کني،`max_steps`و با گارد ورلد با یک سیاست تصادفی به طور معمول اوقات خارج شده است که طبیعی است، فقط مطمئن شوید که شما آن را به درستی شمارش.
- **Variance.**MC از بازده هاي كامل استفاده ميکنه. در قسمت هاي بلند، تفاوت بسيار بزرگ است$V(s_0)$روش TD (درسی 04) این را با بوتسترپینگ کاهش می دهد.
- **State coverage.**.کسي بخل در يک "کيو" تازه با رباط فقط يه عمل رو امتحان ميکنه .تو بايد "کشف" کني
- **Non-stationary policies.**اگه$\pi$تغییرات (مانند کنترل MC) ، بازپرداخت های قدیمی از یک سیاست متفاوت است.
- **Off-policy importance sampling.**وزن ها$\pi(a \mid s)/\mu(a \mid s)$در طول مسیر، ضرب می شود. تغیر با افق انفجار می کند. با IS وزن شده در هر تصمیم، یا به TD می گذرد.

## ازش استفاده کن

نقش روش های مونت کارلو در سال 2026:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

الگوریتم های مدرن Deep-RL (PPO، SAC) بین MC خالص (بازای کامل) و TD خالص (بوتر یک مرحله) از طریق $n$هر دو نقطه آخر نمونه ای از یک تخمین دهنده هستند.

## -باده

پس از`outputs/skill-mc-evaluator.md`:

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## تمرینات

1. **Easy.**بررسي هاي اولين بار از سيستم هاي تعريفگاهي براي سيستم هاي تصادفي در 4×4 GridWorld اجرا کنيد 10 هزار قسمت$V(0,0)$به عنوان تابع تعداد قسمت ها در مقابل پاسخ DP
2. **Medium.**کنترل کليک هاي طمعي را با $\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$.با مقایسه متوسط بازگشت پس از 20 هزار قسمت . منحنی به نظر می رسد کجا تغییر تغییر تغییر شکل می ماند؟
3. **Hard.**پیاده سازی * غیر سیاست * MC با نمونه گیری اهمیت: جمع آوری داده ها در چارچوب سیاست های تصادفی یکسانی $\mu$، تخمین زده شده$V^\pi$برای سیاست مطلوب تعیین کننده$\pi$.با هم مقایسه کنید IS ساده با IS تصمیم گیری شده با IS وزن شده. کدام یک از آنها کمترین تفاوت دارد؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## خواندن بیشتر

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) درمان قنونی
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) اولین بازدید در مقابل هر بازدید
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) کنترل MC و متغیرات خارج از سیاست
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) تخمین های مدرن IS با تنوع پایین.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) اولین نمایش تجربی در مقیاس بزرگ از بازی خود MC / TD به بازی فوق انسانی نزدیک می شود؛ پیشگام مفهومی برای هر درس در نیمه دوم این مرحله.
