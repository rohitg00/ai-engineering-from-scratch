# بازیگر- منتقد  A2C و A3C

> "رينفورس" شور و صداي داره، يه منتقدي بيشتر از اونها رو بيار که ياد بگيره$\hat{V}(s)$A2C آن را همزمان اجرا می کند؛ A3C آن را در سراسر رشته ها اجرا می کند. هر دو مدل ذهنی برای هر روش مدرن عمیق RL هستند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## مشکل

وانيلا رينفورس کار ميکنه ولي تفاوتش وحشتناکه مونت کارلو برگرده$G_t$می تواند میان حوادث 10 برابر تغییر کند.$\nabla \log \pi$و متوسط سازی یک تخمین گرادینت تولید می کند که هزاران قسمت برای حرکت سیاست به همان فاصله ای که می توانید با به روز رسانی های DQN بسیار کمتر حرکت کنید.

تفاوت از استفاده از بازده خام ناشی می شود. اگر یک خط پایه را از دست بدهید$b(s_t)$ هر تابع ای از حالت، از جمله یک ارزش آموخته شده  انتظارات بدون تغییر و تفاوت کاهش می یابد. بهترین خط پایه قابل کنترل است $\hat{V}(s_t)$حالا مقدار ضرب شده$\nabla \log \pi$این *فائده* است:

```math
A(s, a) = G - \hat{V}(s)
```

یک عمل خوب است اگر به دست آورد بالاتر از متوسط بازگشت؛ بد اگر پایین تر. REINFORCE با یک منتقد آموخته است * بازیگر منتقد است.* منتقد به بازیگر یک معلم با تنوع پایین می دهد. این هر روش سیاست عمیق پس از 2015 (A2C، A3C، PPO، SAC، IMPALA) است.

## مفهوم

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$: سیاست. نمونه برداری برای عمل. آموزش داده شده با gradient سیاست.
- **Critic** $V_\phi(s)$: تخمین های انتظار بازگشت از دولت آموزش داده شده برای حداقل$(V_\phi(s) - \text{target})^2$. .

**The advantage.**دو فرم استاندارد:

- *فائده ی MC*$A_t = G_t - V_\phi(s_t)$. غیر جانبدار ، متغیرات بالاتر
- *فائده ی TD*$A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. تعصب (استفاده)$V_\phi$), تفاوت بسیار پایین تر. همچنین به نام باقی مانده TD$\delta_t$. .

**n-step advantage.**بین دوتا تعادل کنید:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$خالص ترفند.$n = \infty$بیشتر اجرای ها استفاده می کنند$n = 5$برای آتاری$n = 2048$براي پي پي او در موجوکو

**Generalized Advantage Estimation (GAE).**Schulman et al. (2016) یک متوسط وزن شده نمایی بر روی تمام مزایا n- مرحله را پیشنهاد کرد:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

با$\lambda \in [0, 1]$.$\lambda = 0$TD (تغیرات پایین، تحریف بالا) است. $\lambda = 1$MC (تغیرات بالا، غیر جانبدار) است.$\lambda = 0.95$این است که 2026  ضبط پیش فرض تا زمانی که دایره تعصب / تغییر در جایی که شما می خواهید آن را است.

**A2C: synchronous advantage actor-critic.**جمع آوری کنید$T$قدم ها رو به هم$N$محیط های موازی. مزایای هر مرحله را محاسبه کنید. بازیگر و منتقد را در دسته ترکیبی به روز کنید. تکرار کنید. برادر ساده تر و مقیاس پذیر تر A3C.

**A3C: asynchronous advantage actor-critic.**Mnih et al. (2016). اسپون $N$هر کارگر gradients را در سطح محلی در انتشار خود محاسبه می کند، سپس آن را به صورت غیرمسلح به یک سرور پارامتر مشترک اعمال می کند. هیچ بازخوردی مورد نیاز نیست. کارگران با اجرای مسیرهای مختلف غیر مرتبط می شوند. A3C ثابت کرد که می توانید در مقیاس CPU ها تمرین کنید. در سال 2026، A2C مبتنی بر GPU (Batted Parallel Envs) غالب است زیرا GPU ها به دسته های بزرگ نیاز دارند.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

سه اصطلاح: خسارت درجه بندی، بازپسین ارزش، پاداش انتروپی.`c_v ~ 0.5`،`c_e ~ 0.01`این ها نقطه شروع قنونی هستند.

```figure
actor-critic
```

## آن را بسازید

### مرحله اول: یک منتقد

نقد کننده خطی$V_\phi(s) = w \cdot \text{features}(s)$با MSE به روز شده:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

در یک محیط تابلوگرانه منتقد در چند صد قسمت همگام می شود. در آتاری، منتقد خطی را با یک صندوق مشترک CNN + سر ارزش جایگزین کنید.

### مرحله دوم: مزیت مرحله n

با توجه به طولش$T$و يک پايان آخري که با شروع به کار رفته$V(s_T)$:

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns`هدف انتقادي هست`advantages`این چیزیه که ضرب میشه$\nabla \log \pi$. .

### مرحله 3: بروزرسانی ترکیبی

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

در مورد سیاست، یک بار در هر تازه کاری، نرخ یادگیری جداگانه برای بازیگر و منتقد.

### مرحله 4: موازی (A3C در مقابل A2C)

- **A3C:**دور کن$N$هر کدام از این رشته ها، محیط و گذرنامه خود را اجرا می کنند. به طور دوره ای به روز رسانی های گرادینتی را به یک استاد مشترک فشار می دهند. هیچ قفل در استاد  مسابقه ها خوب هستند، آنها فقط صدا اضافه می کنند.
- **A2C:**فرار کن$N$در یک فرآیند، مشاهده ها را به یک دسته بندی کنید.`[N, obs_dim]`دسته بندی، دسته بندی پیش، دسته بندی عقب، استفاده بالاتر از GPU، تعیین کننده، ساده تر برای استدلال. پیش فرض در سال 2026.

کد اسباب بازی ما برای شفافیت یک رشته است؛ نوشتن مجدد به A2C دسته بندی سه خط از numpy است.

## دام ها

- **Critic bias before actor gradient.**اگر منتقد تصادفی باشد، خط پایه اش غیر اطلاعاتی است و شما در حال آموزش در مورد صداهای خالص هستید. منتقد را برای چند صد قدم قبل از روشن کردن گرادینت سیاست گرم کنید، یا از نرخ یادگیری بازیگر آهسته استفاده کنید.
- **Advantage normalization.**به طور معمول به صفر متوسط/وحده-std در هر دسته.
- **Shared trunk.**استفاده از یک استخراج ویژگی های مشترک برای بازیگر و منتقد در ورودی تصویر. سر های جداگانه. ویژگی های مشترک در هر دو از دست دادن آزاد سواری.
- **On-policy contract.**A2C اطلاعات را برای دقیقا یک بروزرسانی دوباره استفاده می کند. بیشتر و گرادینت شما منحصرا است (تصحیح نمونه گیری اهمیت چیزی است که PPO اضافه می کند).
- **Entropy collapse.**بدون$c_e > 0$، سیاست در چند صد بار به تعدیل می رسد و کشف را متوقف می کند.
- **Reward scale.**مقادیر مزایای بستگی به مقیاس پاداش دارد. پاداش ها را عادی سازی کنید (به عنوان مثال تقسیم std اجرا) برای مقادیر گرادینت ثابت در میان وظایف.

## ازش استفاده کن

A2C/A3C به ندرت انتخاب نهایی در سال 2026 هستند اما آنها معماری هستند که همه چیز بعد تر را بهبود می بخشد:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

اگر شما "فائده" را در مقاله ای در سال 2026 ببینید، به بازیگر- منتقد فکر کنید.

## -باده

پس از`outputs/skill-actor-critic-trainer.md`:

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## تمرینات

1. **Easy.**هنرپیشه های منتقدین را با مزیت MC آموزش دهید$(G_t - V(s_t))$در 4×4 GridWorld. مقایسه بهره وری نمونه با REINFORCE با راه اندازی متوسط پایه از درس 06.
2. **Medium.**به نفع باقی مانده TD تغییر دهید$(r + \gamma V(s') - V(s))$.تغيرات ميزان ها را اندازه گیری کن چقدر کاهش می یابد؟
3. **Hard.**اجرا کنید GAE ((λ).$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$. بازگشت نهایی نقشه در مقابل بهره وری نمونه. نقطه ی خوش برای این کار کجاست؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## خواندن بیشتر

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) A3C، مقاله اصلی نقاد-تفتیش کننده ای.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) GAE
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) پایه ها؛ این را با فصل 9 در مورد تقریب عملکرد در زمانی که منتقد یک شبکه عصبی است، جفت کنید.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) مقیاس پذیر بازیگر- منتقد توزیع شده با اصلاح خارج از سیاست V-trace.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) اجرای A2C/PPO ارزش خواندن را دارد.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) نتیجه کنورژن اساسی برای تجزیه بازیگر-انتقادگر در دو مقیاس.
