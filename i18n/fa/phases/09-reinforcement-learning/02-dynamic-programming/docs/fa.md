# برنامه نویسی پویا  تکرار سیاست و تکرار ارزش

> برنامه نویسی پویا با فریب است. شما قبلاً عملکردهای انتقال و پاداش را می دانید؛ شما فقط معادله بلمن را تکرار می کنید تا$V$یا$\pi$این معیار است که هر روش مبتنی بر نمونه گیری سعی می کند به آن نزدیک شود.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## مشکل

شما یک MDP با یک مدل شناخته شده دارید: می توانید سوال کنید $P(s' \mid s, a)$و$R(s, a, s')$برای هر جفت عمل دولت. یک مدیر موجودی توزیع تقاضا را می داند. یک بازی هیئت مدیره دارای انتقال تعیین کننده است. یک شبکه جهان چهار خط از پایتون است. شما یک * مدل * دارید.

مدل های بدون مدل (RL) (Q-learning، PPO، REINFORCE) برای مواردی که شما مدل ای ندارید اختراع شده است. اما وقتی شما یک مدل دارید، روش های سریع تر و بهتر وجود دارد: برنامه نویسی پویا. بلمن آنها را در سال 1957 طراحی کرده است. آنها هنوز هم درست بودن را تعریف می کنند: وقتی مردم می گویند "سیاست بهینه برای این MDP،" آنها به معنای سیاست DP بازگشت خواهد کرد.

شما به آنها در سال 2026 به سه دلیل نیاز دارید. اول، هر محیط تابلو در تحقیقات RL (GridWorld، FrozenLake، CliffWalking) با DP برای تولید سیاست استاندارد طلا حل می شود. دوم، ارزش های دقیق به شما اجازه می دهد که روش های نمونه گیری را *debug* کنید: اگر Q-learning تخمین زده است برای $V^{\ast}(s_0)$در سوم، روش های مدرن RL و برنامه ریزی غیررسمی (MCTS، جستجوی AlphaZero، RL مبتنی بر مدل در مرحله 9 · 10) همه یک پشتیبان Bellman را بر روی یک مدل آموخته یا داده تکرار می کنند.

## مفهوم

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**دو مرحله رو عوض ميکنه تا وقتي که سیاست عوض بشه

1. * ارزیابی:* سیاست داده شده$\pi$، حساب کردن$V^\pi$با استفاده مکرر از$V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$تا وقتي که همگير بشه
2. *بهبودی:* داده شده$V^\pi$، ساخت$\pi$طمع و طمع$V^\pi$.$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$. .

تقارب تضمین شده است چون (الف) هر مرحله بهبود یا نگه می دارد $\pi$همان یا به طور دقیق افزایش می یابد$V^\pi$برای برخی از حالت ها، (ب) فضای سیاست های تعیین کننده محدود است. معمولا در تکرار های بیرونی حتی برای فضاهای بزرگ حالت هم در ~ 520 متقابل می باشد.

**Value iteration.**ارزیابی و بهبود را به یک سویه فرو می برد. معادله Bellman *optimality* را اعمال کنید:

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

تا زمان تکرارش$\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. از سیاست در پایان با انجام اقدام طمع آمیز خارج کنید. به طور دقیق سریعتر در هر تکرار  هیچ حلقه ارزیابی داخلی  اما معمولا نیاز به تکرار بیشتر برای همگام شدن دارد.

**Generalized policy iteration (GPI).**چارچوبی متحد کننده. عملکرد ارزش و سیاست در یک حلقه بهبود دو طرفه قفل شده است؛ هر روش که هر دو را به سمت پیوستگی متقابل هدایت می کند (تکرار ارزش غیر هماهنگ، تکرار سیاست اصلاح شده، Q-تعلمی، بازیگر-انتقاد، PPO) نمونه ای از GPI است.

**Why $\gamma < 1$ matters.**اپراتور بيلمن يه$\gamma$- انقباض در ضمیمه:$\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$انقباض به معنی نقطه ثابت و تراکم هندسی منحصر به فرد است.$\gamma < 1$و شما تضمین را از دست می دهید  شما نیاز به افق محدود یا یک حالت انتهای جذب دارید.

```figure
value-iteration-gamma
```

## آن را بسازید

### مرحله اول: ساخت مدل GridWorld MDP

از همان 4×4 GridWorld از درس 1 استفاده کنیم. ما یک نوع استوکاستیک اضافه می کنیم: با احتمال`0.1`عامل به سمت تصادفی عمودی حرکت می کند.

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)`لیست از `(s', r, p)`اين کل مدل است

### مرحله دوم: ارزیابی سیاست

با توجه به سیاست`π(s) = {action: prob}`، معادله بيلمن رو تکرار کن تا$V$حرکت کردن را متوقف می کند:

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### مرحله سوم: بهبود سیاست

جایگزینش کن$\pi$با سیاست طمع آمیز و.ر.ت.$V$اگه$\pi$تغییر نکرد، برگشت کردیم، ما در حالت مطلوب هستیم.

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### مرحله 4: آنها را با هم بخیه

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

تراکم معمول در 4×4: 46 تکرار های خارجی.$V^{\ast}(0,0) \approx -6$و يک سيستم که تعداد قدم ها رو به شدت کاهش ميده

### مرحله 5: تکرار ارزش (ورژن یک حلقه)

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

همون نقطه ثابت، خطوط کد کمتر

## دام ها

- **Forgetting to handle terminals.**اگه بيلمن رو به حالت جذب کننده اعمال کني، هنوز هم بهترين عمل رو مي پذيره که هيچ چيزي رو عوض نميکنه`if s == terminal: V[s] = 0`. .
- **Sup-norm vs L2 convergence.**استفاده کنید`max |V_new - V|`، نه متوسط ، ضمانت تئوری در مورد سوپر نورم است
- **In-place vs synchronous updates.**به روز رسانی`V[s]`در محل (گاوس-سایدل) به سرعت به هم می رسد تا یک جدا`V_new`کد توليدي از موقع استفاده ميکنه
- **Policy ties.**اگر دو عمل ارزش Q برابر داشته باشند`argmax`ممکن است هر تکرار ارتباط را متفاوت شکسته و باعث نوسان چک "سیستم پایدار" شود.
- **State-space explosion.**دپ:$O(\lvert S \rvert \cdot \lvert A \rvert)$در هر سویه. تا ~ 107 حالت کار می کند. فراتر از آن، شما نیاز به تقریب عملکرد (فاز 9 · 05 و بعد).

## ازش استفاده کن

در سال 2026، DP خط اصلی درستی و حلقه داخلی برنامه نویسان است:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

هر بار که کسی میگه "کارکرد مطلوب ارزش" منظورش "قطه ثابت DP"ه$V^{\ast}$یا$Q^{\ast}$در یک روزنامه، این حلقه را تصور کنید.

## -باده

پس از`outputs/skill-dp-solver.md`:

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## تمرینات

1. **Easy.**تکرار ارزش را در شبکه 4×4 World اجرا کنید$\gamma \in \lbrace 0.9, 0.99 \rbrace$تا چند تا تا$\max \lvert \Delta V \rvert < 10^{-6}$چاپ$V^{\ast}$به عنوان یک شبکه 4×4
2. **Medium.**مقایسه تکرار سیاست در مقابل تکرار ارزش در * استوکاستیک * GridWorld (احتمال حرکت `0.1`) شمارش: سيف، ساعت ديواري، پايان$V^{\ast}(0,0)$که در تکرار سریعتر به هم می پیوندد؟
3. **Hard.**ایجاد تکرار اصلاح شده سیاست: در مرحله ارزیابی، فقط اجرا کنید $k$به جای همگامگی، پاک می کنه$V^{\ast}(0,0)$اشتباه در مقابل$k$برای$k \in \lbrace 1, 2, 5, 10, 50 \rbrace$منحنی در مورد تعویض ارزیابی/تحسين چه میگه؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## خواندن بیشتر

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) ارائه کانونیک تکرار سیاست و تکرار ارزش.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) درمان دقیق استدلال نقشه برداری انقباض.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) تکرار اصلاح شده سیاست و تجزیه و تحلیل کنورژانس آن.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) کاغذ تکرار سیاست اصلی.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) پل از DP تا نزدیک-DP / عمیق RL که در هر درس بعدی استفاده می شود.
