# تفاوت زمانی  Q-Learning & SARSA

> مونت کارلو تا پایان قسمت انتظار می رود. TD پس از هر مرحله با بوتستراپ تخمین ارزش بعدی به روز می شود. Q-learning غیر از سیاست و خوش بینانه است. SARSA در سیاست و محتاط است. هر دو یک خط کد هستند. هر دو در این مرحله هر روش عمیق RL را پشت سر می گذارند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## مشکل

مونت کارلو کار می کند اما دو تقاضا گران دارد. به قسمت هایی نیاز دارد که پایان می یابد و فقط پس از بازگشت نهایی به روز می شود. اگر قسمت شما 1000 مرحله است، MC انتظار می رود 1000 مرحله برای به روز کردن هر چیزی است. این تنوع بالا، کم تعصب و کند در عمل است.

برنامه نویسی پویا دارای پروفایل مخالف است  نسخه پشتیبان با صفر تنوع  اما نیاز به یک مدل شناخته شده دارد.

یادگیری تفاوت زمانی (TD) تفاوت را تقسیم می کند. از یک انتقال واحد $(s, a, r, s')$، هدف یک قدم رو تشکیل بده$r + \gamma V(s')$و فشار دادن$V(s)$. نه مدل ، نه قسمت هاي کامل ، نه تعصب از استفاده از$V$در RHS، اما به طور چشمگیری کمتر از MC و به روزرسانی های آنلاین از مرحله اول.

این محور است که تمام RL های مدرن DQN، A2C، PPO، SAC  روی آن می چرخد. بقیه مرحله 9 لایه های تقریب عملکرد و ترفند هایی است که بر روی یک مرحله TD تازه کاری که در این درس می نویسید ساخته شده است.

## مفهوم

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

مقدار بسته شده خطا TD است$\delta = r + \gamma V(s') - V(s)$اين آنالوگ اينترنتي از$G_t - V(s_t)$در MC. همگامگی نیاز دارد$\alpha$رضایت ربینز مونرو ($\sum \alpha = \infty$،$\sum \alpha^2 < \infty$) و تمام ايالات به طور بي انتهاي زيارت مي کردند.

**Q-learning.**یک روش TD غیر سیاسی برای کنترل:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

.`max`فرض می کند که سیاست *طمع* از$s'$و در ادامه، بدون توجه به اینکه عامل چه اقداماتی را انجام می دهد. این جدایی باعث می شود Q-learning یاد بگیرد.$Q^{\ast}$Mnih et al. (2015) این را به یادگیری عمیق Q در Atari (متعلّم 05) تبدیل کرد.

**SARSA.**یک روش TD در سیاست:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

اسمش توپل$(s, a, r, s', a')$. سارسا از اين عمل استفاده ميکنه$a'$اين کارگر واقعاً بعدش ميگيره نه طمعگير`argmax`. به سمت$Q^\pi$برای هرچیز بخیل باشه$\pi$داره اجرا ميشه که در حد$\epsilon \to 0$می شه$Q^{\ast}$. .

**The cliff-walking difference.**در کار کلاسیک پیاده روی در صخره (قایق از صخره = پاداش -100) ، Q-learning مسیر بهینه را در امتداد لبه صخره یاد می گیرد اما گاهی اوقات در طول اکتشاف مجازات را می گیرد. SARSA یک مسیر امن تر را به یک قدم از صخره یاد می گیرد زیرا باعث می شود صدای اکتشاف به ارزش Q خود برسد. با آموزش، هر دو به بهترین نقطه می رسند.$\epsilon \to 0$در عمل مهم است: وقتی که اکتشاف در واقع در محل نشریات انجام می شود، رفتار SARSA محافظه کارتر است.

**Expected SARSA.**جایگزینش کن$Q(s', a')$با ارزش انتظارش کمتر از $\pi$:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

تفاوت کمتر از SARSA (هیچ نمونه ای از $a'$در این زمینه، در مورد این موضوع، در مورد یک هدف در سیاست نیز صحبت می شود.

**n-step TD and TD(λ).**بین TD(0) و MC با انتظار فاصله گذاری کنید$n$قبل از شروع کردن$n=1$TD است$n=\infty$MC است. TD ((λ) میانگین در همه $n$با وزن های هندسی$(1-\lambda)\lambda^{n-1}$. بیشتر استفاده های عمیق$n$بین 3 تا 20

```figure
qlearning-gridworld
```

## آن را بسازید

### مرحله ی اول: SARSA در مورد سیاست های حریص

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

هشت خط. تنها تفاوت با یادگیری Q خط هدف است.

### مرحله دوم: یادگیری Q

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

.`max`این یک نماد تفاوت بین سیاست و خارج از سیاست است.

### مرحله سوم: منحنیات یادگیری

تراک متوسط بازگشت در هر 100 قسمت. Q-تعلم در ساده تعیین گرید وولد نزدیکتر می شود. SARSA در پیاده روی در صخره محافظه کارتر است. در 4 × 4 GridWorld در سال 2016`code/main.py`، هر دو بعد از 2 هزار قسمت تقريباً مطلوب هستن$\alpha=0.1, \epsilon=0.1$. .

### مرحله 4: مقایسه با حقیقت DP

تکرار ارزش اجرا (درسی 02) برای بدست آوردن $Q^{\ast}$چک کن$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$. یک عامل TD تابلو سالم در داخل زمین`~0.5`در شبکه 4×4 بعد از 10 هزار قسمت

## دام ها

- **Initial Q values matter.**آغاز خوش بینی ($Q = 0$برای یک کار پاداش منفی) به اکتشاف تشویق می کند.
- **α schedule.**ثابت$\alpha$برای مشکلات غیر ثابت خوب است.$\alpha_n = 1/n$در تئوری همگامگی می دهد اما در عمل خیلی کند است $\alpha$در`[0.05, 0.3]`و مدارک یادگیری را نظارت کنید.
- **ε schedule.**شروع بالا ($\epsilon=1.0$، از انحلال به$\epsilon=0.05$"GLIE" (طمع در حد با اکتشافات بی نهایت) شرط تقارب است.
- **Max bias in Q-learning.**.`max`وقتی که $Q$به بیش از حد ارزیابی منجر می شود  یادگیری دوگانه Q Hasselt (که توسط DDQN در درس 05) استفاده می شود) این مسئله را با دو جدول Q حل می کند.
- **Non-terminating episodes.**TD می تواند بدون ترمینال یاد بگیرد، اما شما باید گام های را یا به طور صحیح در ترمینال کنترل کنید. استاندارد: ترمینال را غیر ترمینال در نظر بگیرید، شروع کردن را ادامه دهید.
- **State hashing.**اگر حالت ها tuples/tensors هستند، از یک کلید hashable استفاده کنید (tuple، not list؛ tuple of floats rounded, not raw).

## ازش استفاده کن

منظره TD 2026:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

۹۰ درصد از "RL" هایی که در مقاله های ۲۰۲۶ درباره آن می خوانید، نوعی توسعه از Q-learning یا SARSA است. قبل از اینکه عمیق تر مطالعه کنید، به روزرسانی جدول را در انگشتان خود درک کنید.

## -باده

پس از`outputs/skill-td-agent.md`:

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## تمرینات

1. **Easy.**Q-learning و SARSA را در 4×4 GridWorld پیاده سازی کنید. منحنیات یادگیری (متوسط بازگشت در هر 100 قسمت) را برای 2000 قسمت پیاده سازی کنید. چه کسی سریعتر به هم می پیوندد؟
2. **Medium.**یک محیط پیاده روی در صخره (4×12، آخرین ردیف صخره با پاداش -100 و تنظیم مجدد برای شروع است). سیاست های نهایی Q-learning و SARSA را مقایسه کنید. عکس صفحه نمایش مسیرهای هر کدام را انجام دهید. کدام نزدیک تر از صخره است؟
3. **Hard.**آموزش دوگانه ق را اجرا کنید. در یک شبکه غمزانی (غوسین شور)$\sigma=5$اضافه شده به پاداش هر مرحله) نشان دادن بیش از حد ارزیابی Q-تعلم$V^{\ast}(0,0)$در حالی که یادگیری دوگانه Q انجام نمی شود.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## خواندن بیشتر

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) کاغذ اصلی و اثبات تقابل
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0) ، SARSA، Q-learning، انتظار می رود که SARSA.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) اصلاح تعصب حداکثر سازی
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) انگیزه انتظار شده SARSA
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) مقاله ای که SARSA را ایجاد کرد (در آن زمان "تعلّم Q-تعلّم ارتباطگرای اصلاح شده" نامیده می شد).
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) TD(0) را به TD(n) عمومی می کند، مسیر از Q-learning به ردیف واجد شرایطی و بعداً GAE در PPO.
