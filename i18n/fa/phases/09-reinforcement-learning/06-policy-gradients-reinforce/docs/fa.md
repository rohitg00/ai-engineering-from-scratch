# سیاست درجه بندی  تقویت از ابتدا

> ارزش تخمین را متوقف کنید. سیاست را مستقیماً پارامتر کنید، گرادینت بازگشت انتظار می رود را محاسبه کنید، قدم به بالا بردارید. ویلیامز (1992) آن را در یک نظریه نوشت. به همین دلیل PPO، GRPO و هر حلقه LLM RL وجود دارد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## مشکل

Q-Learning و DQN عملکرد *value* را پارامتر می کنند. شما اقدامات را با `argmax Q`این برای اقدامات متمایز و حالت متمایز خوب است.`argmax`در مورد یک چرخش 10 بعدی?) یا زمانی که شما می خواهید یک سیاست استوکاستیک (`argmax`(به لحاظ ساختاری تعیین کننده است).

در عوض گرادینت های سیاست، *سیاست* را پارامتر می کنند. $\pi_\theta(a \mid s)$شبکه عصبی است که توزیع بر روی اقدامات را تولید می کند. از آن برای عمل نمونه بگیرید.$\theta$. قدم به بالا . نه`argmax`. نه بازپسين بيلمن فقط ارتفاع گرادينت$J(\theta) = \mathbb E_{\pi_\theta}[G]$. .

نظریه REINFORCE (ویلیامز 1992) به شما می گوید این گرادینت قابل محاسبه است:$\nabla J(\theta) = \mathbb E_\pi[ G \cdot \nabla_\theta \log \pi_\theta(a \mid s) ]$. قسمتي رو اجرا کن حسابي رو بکني$\nabla \log \pi_\theta(a \mid s)$در هر مرحله، متوسط، ارتفاع درجه، تمام شد

هر الگوریتم LLM-RL در 2026  PPO، DPO، GRPO  یک اصلاح REINFORCE است. درک آن در انگشتان شما شرط لازم برای بقیه این مرحله و برای مرحله 10 · 07 (تطبيق RLHF) و مرحله 10 · 08 (DPO) است.

## مفهوم

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**The policy gradient theorem.**برای هر سیاست$\pi_\theta$که توسط $\theta$:

```math
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[ \sum_{t=0}^{T} G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]
```

کجا$G_t = \sum_{k=t}^{T} \gamma^{k-t} r_{k+1}$بازده تخفیف شده از مرحله است$t$انتظارات از مسیرهای کامل گذشته$\tau$نمونه ای از$\pi_\theta$. .

**The proof is short.**فرقش رو تشخیص بده$J(\theta) = \sum_\tau P(\tau; \theta) G(\tau)$از انتظارش کم شده$\nabla P(\tau; \theta) = P(\tau; \theta) \nabla \log P(\tau; \theta)$(ترک مشتقات روزنامه) فاکتور$\log P(\tau; \theta) = \sum \log \pi_\theta(a_t \mid s_t) + \text{environment terms that do not depend on } \theta$اصطلاحات محیط ناپدید می شوند. دو خط الجبر به شما نظریه می دهند.

**Variance reduction tricks.**وانيلا رينفورس تغيرات قاتلانه اي داره$\nabla \log \pi$دو راه حل استاندارد:

1. **Baseline subtraction.**جایگزینش کن$G_t$با$G_t - b(s_t)$برای هر خط اصلی$b(s_t)$که بستگی به $a_t$. بدون طرفدار چون$\mathbb{E}[b(s_t) \cdot \nabla \log \pi(a_t \mid s_t)] = 0$انتخاب معمول:$b(s_t) = \hat{V}(s_t)$یک منتقد به او آموخته است (درسی 07).
2. **Reward-to-go.**جایگزینش کن$\sum_t G_t \cdot \nabla \log \pi_\theta(a_t \mid s_t)$با$\sum_t G_t^{\text{from } t} \cdot \nabla \log \pi_\theta(a_t \mid s_t)$فقط بازده های آینده برای یک اقدام خاص مهم است  پاداش های گذشته به صداهای صفر متوسط کمک می کنند.

با هم جمع می کنید:

```math
\nabla J \approx (1/N) \sum_{i=1}^{N} \sum_{t=0}^{T_i} [ G_t^{(i)} - \hat{V}(s_t^{(i)}) ] \cdot \nabla_\theta \log \pi_\theta(a_t^{(i)} \mid s_t^{(i)})
```

که REINFORCE با خط پایه است  اجداد مستقیم A2C (درسی 07) و PPO (درسی 08).

**Softmax policy parameterization.**برای اقدامات متمایز، انتخاب استاندارد:

```math
\pi_\theta(a \mid s) = \exp(f_\theta(s, a)) / \sum_{a'} \exp(f_\theta(s, a'))
```

کجا$f_\theta$هر شبکه عصبی است که در هر عمل نمره ای را تولید می کند. گرادینت دارای شکل پاک است:

```math
\nabla_\theta \log \pi_\theta(a \mid s) = \nabla_\theta f_\theta(s, a) - \sum_{a'} \pi_\theta(a' \mid s) \nabla_\theta f_\theta(s, a')
```

یعنی امتیاز اقدام انجام شده به غیر از ارزش انتظار شده در چارچوب سیاست.

**Gaussian policy for continuous actions.** $\pi_\theta(a \mid s) = N(\mu_\theta(s), \sigma_\theta(s))$.$\nabla \log N(a; \mu, \sigma)$این تمام نیازهای SAC مرحله 9 · 07 است.

```figure
policy-gradient-landscape
```

## آن را بسازید

### مرحله اول: شبکه سیاست softmax

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

برای یک محیط جدول ای از یک سیاست خطی (یک ویکتور وزن در هر عمل) استفاده کنید. برای Atari، در یک CNN تغییر دهید و سر softmax را نگه دارید.

### مرحله دوم: نمونه گیری و احتمال ثبت

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### مرحله 3: پیاده سازی با ضبط سوابق

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### مرحله 4: بروزرسانی REINFORCE

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

گرادینت$\nabla \log \pi(a \mid s) = e_a - \pi(\cdot \mid s)$(به جز$a$- احتمالات) قلب گرادینت های سیاست نرم ماکس است. آن را به حافظه عضلانی بسوزانید.

### مرحله 5: خط پایه

. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .$G$در مورد قسمت های اخیر کاهش تفاوت کافی برای اجرای یک 4 × 4 GridWorld است؛ برای همگام شدن حدود 500 قسمت طول می کشد.$\hat{V}(s)$و شما نقاد بازیگر می گیرید.

## دام ها

- **Exploding gradients.**بازده ها مي تونن بيشتر باشه هميشه به حالت عادی برسه$G$به`~N(0, 1)`در طول دسته قبل از ضرب با $\nabla \log \pi$. .
- **Entropy collapse.**اين سيستم به يک عمل نزديک تقرير گرانه زودي تبديل ميشه، بازيابي رو متوقف ميکنه، گیر ميکنه.$\beta \cdot H(\pi(\cdot \mid s))$به هدف
- **High variance.**وانیل REINFORCE به هزاران قسمت نیاز دارد. یک خط پایه انتقادی (درسی 07) یا منطقه اعتماد TRPO / PPO (درسی 08) استانداردی است.
- **Sample inefficiency.**در سیاست به این معنی است که شما هر انتقال را پس از یک بروزرسانی از بین می برید. اصلاحات خارج از سیاست از طریق نمونه گیری اهمیت، داده ها را به هزینه اختلاف می آورند (نسب PPO وزن IS کاهش یافته است).
- **Non-stationary gradients.**همون گرادينت از 100 قسمت پيش از اون استفاده ميکنه$\pi$روش هاي مربوط به سياست هر چند بار به روز رسيدن به اين دليل
- **Credit assignment.**بدون پاداش به دست، پاداش های گذشته باعث شور می شوند.

## ازش استفاده کن

در سال 2026، REINFORCE به ندرت به طور مستقیم اجرا می شود اما فرمول گرادینت آن در همه جا وجود دارد:

| Use case | Derived method |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — REINFORCE with group-relative baseline, no critic |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — REINFORCE rewritten as a preference-likelihood loss, no sampling |

وقتی میخواین`loss = -advantage * log_prob`در یک اسکریپت آموزش 2026، یعنی REINFORCE با یک خط پایه. مقاله های کامل (DPO، GRPO، RLOO) ترفند های کاهش تفاوت در بالای این یک خط هستند.

## -باده

پس از`outputs/skill-policy-gradient-trainer.md`:

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## تمرینات

1. **Easy.**اجرای REINFORCE در 4 × 4 GridWorld با یک سیاست نرم حداکثر خطی. آموزش برای 1000 قسمت بدون خط پایه. نقشه منحنی یادگیری؛ اندازه گیری متغیر (std بازگشت).
2. **Medium.**یک خط پایه متوسط اجرا را اضافه کنید. دوباره تمرین کنید. بهره وری نمونه و تفاوت را با جریان وانیل مقایسه کنید. خط پایه مراحل به سمت تقارب را تا چه اندازه کاهش می دهد؟
3. **Hard.**اضافه کردن یک امتیاز انتروپی$\beta \cdot H(\pi)$. پاک کردن$\beta \in \lbrace 0, 0.01, 0.1, 1.0 \rbrace$. نقشه بازگشت نهایی و انتروپی سیاست کجا نقطه ی خوش این کار است؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy gradient | "Train the policy directly" | $\nabla J(\theta) = \mathbb{E}[G \cdot \nabla \log \pi_\theta(a \mid s)]$; derived from the log-derivative trick. |
| REINFORCE | "The original PG algorithm" | Williams (1992); Monte Carlo returns multiplied by log-policy gradient. |
| Log-derivative trick | "Score function estimator" | $\nabla P(\tau;\theta) = P(\tau;\theta) \cdot \nabla \log P(\tau;\theta)$; makes gradients of expectations tractable. |
| Baseline | "Variance reduction" | Any $b(s)$ subtracted from $G$; unbiased because $\mathbb{E}[b \cdot \nabla \log \pi] = 0$. |
| Reward-to-go | "Only future returns count" | $G_t^{\text{from } t}$ instead of the full $G_0$; correct and lower-variance. |
| Entropy bonus | "Encourage exploration" | $+\beta \cdot H(\pi(\cdot \mid s))$ term keeps the policy from collapsing. |
| On-policy | "Train on what you just saw" | Gradient expectation is w.r.t. the current policy — cannot reuse old data directly. |
| Advantage | "How much better than average" | $A(s, a) = G(s, a) - V(s)$; the signed quantity REINFORCE-with-baseline multiplies. |

## خواندن بیشتر

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) کاغذ اصلی REINFORCE
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) نظریه ی جدید سیاست- درجه بندی با تقریب عملکرد
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) ارائه کتاب های درسی
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) توضیحات واضح آموزشی با کد PyTorch.
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) کاهش تفاوت و دیدگاه طبیعی-گریادینت که REINFORCE را به خانواده منطقه اعتماد (TRPO، PPO) متصل می کند.
