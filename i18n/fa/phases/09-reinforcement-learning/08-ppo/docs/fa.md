# بهینه سازی سیاست های نزدیک (PPO)

> A2C هر انتشار را پس از یک بروزرسانی از بین می برد. PPO گرادینت سیاست را در یک نسبت اهمیت کاهش داده است تا بتوانید 10 دوره بیشتر را در داده های مشابه بدون انفجار سیاست انجام دهید. Schulman et al. (2017). هنوز الگوریتم پیش فرض سیاست-گرادینت در سال 2026 است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## مشکل

A2C (درسی 07) در سیاست است: گرادینت $\mathbb E_{\pi_\theta}[A \cdot \nabla \log \pi_\theta]$نیاز به داده های نمونه گیری از *در حال حاضر*$\pi_\theta$يه بار تازه کار باش و$\pi_\theta$تغییراتی که شما استفاده کرده اید، غیر از سیاست است. دوباره از آن استفاده کنید و گرادینت شما منحرف است.

پخش کردن هزینه های زیادی دارد. در آتاری، یک پخش در طول 8 envs × 128 مرحله = 1024 انتقال و یک دوجین ثانیه زمان محیط. پس از یک گام گرادینت، از بین بردن آن، ضایع کننده است.

بهینه سازی سیاست های منطقه اعتماد (TRPO، Schulman 2015) اولین راه حل بود: هر بروزرسانی را محدود کنید تا تفاوت KL بین سیاست های قدیمی و جدید پایین تر بماند $\delta$نظري طور پاک، ولي به حل هر تازه ايجادي ميخواد

PPO (Schulman et al. 2017) محدودیت منطقه اعتماد سخت را با یک هدف ساده حذف می کند. یک خط اضافی کد. ده دوره در هر انتشار. هیچ گرادیانت همبستگی. تضمین های نظری کافی خوب. نه سال بعد هنوز هم الگوریتم گاردیانت سیاست پیش فرض برای همه چیز از MuJoCo تا RLHF است.

## مفهوم

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**The importance ratio.**

```math
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}
```

این نسبت احتمال سیاست جدید نسبت به سیاست که داده ها را جمع آوری کرده است. $r_t = 1$به معنی هیچ تغییری نیست$r_t = 2$یعنی که سیاست جدید دو برابر بیشتر از این امکان داره$a_t$مثل اون پير

**The clipped surrogate.**

```math
L^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) A_t, \mathop{\mathrm{clip}}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]
```

دو تا شرط:

- اگر مزیت$A_t > 0$و نسبت تلاش می کند تا از گذشته بربیاید$1 + \epsilon$، کلپ تراز را صاف می کند  یک عمل خوب را بیشتر از  فشار ندهید$+\epsilon$از احتمالات قدیمی بالاتر
- اگر مزیت$A_t < 0$و نسبت تلاش می کنه پایین تر بشه$1 - \epsilon$(به این معنی که ما یک عمل بد را بسیار کمتر از سیاست قدیمی انجام می دهیم) ، کلیپ تراز را صاف می کند: یک عمل بد را بیشتر از $-\epsilon$کمتر از احتمال قدیمی

.`min`در جهت دیگر کار می کند: اگر نسبت به جهت * مفید* حرکت کرده باشد، هنوز هم گرادینت را دریافت می کنید (هیچ برش روی طرف که به شما آسیب برساند).

نماديه$\epsilon = 0.2$. هدف را به عنوان تابع از$r_t$: یک عملکرد قطعه ای خطی با یک سقف صاف در "جانب خوب" و یک طبقه صاف در "جانب بد".

**The full PPO loss.**

```math
L(\theta, \phi) = L^{\text{CLIP}}(\theta) - c_v \cdot (V_\phi(s_t) - V_t^{\text{target}})^2 + c_e \cdot H(\pi_\theta(\cdot \mid s_t))
```

ساختار مشابهي از A2C. سه معادل، معمولا$c_v = 0.5$،$c_e = 0.01$،$\epsilon = 0.2$. .

**The training loop.**

1. جمع آوری کنید$N \times T$انتقال ها در سراسر$N$محیط های موازی برای $T$هر قدم
2. مزایای محاسبه (GAE) را به عنوان ثابت منجمد کنید.
3. یخ زده$\pi_{\theta_{\text{old}}}$به عنوان یک عکس از جریان$\pi_\theta$. .
4. برای$K$دوره ها، برای هر دسته کوچک از`(s, a, A, V_target, log π_old(a|s))`:
   - حساب کردن$r_t(\theta) = \exp(\log \pi_\theta(a \mid s) - \log \pi_{\text{old}}(a \mid s))$. .
   - درخواست کنید$L^{\text{CLIP}}$+ از دست دادن ارزش + انتروپ
   - مرحله ي درجه ي بالا
5. از راه اندازی بازتاب کن برگرد به مرحله اول

$K = 10$و تعداد 64 عدد کمی از آن ها مجموعه ای از پارامترهای استاندارد است.

**KL-penalty variant.**مقاله اصلی پیشنهاد کرد که با استفاده از مجازات KL سازگار جایگزین شود: $L = L^{\text{PG}} - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$با$\beta$نسخه برش تبدیل به غالب شد؛ ویرانت KL در RLHF زنده ماند (که KL به سیاست مرجع یک محدودیت جداگانه است که همیشه می خواهید).

```figure
ppo-clip
```

## آن را بسازید

### مرحله اول: گرفتن`log π_old(a | s)`در زمان پخش

```python
for step in range(T):
    probs = softmax(logits(theta, state_features(s)))
    a = sample(probs, rng)
    s_next, r, done = env.step(s, a)
    buffer.append({
        "s": s, "a": a, "r": r, "done": done,
        "v_old": value(w, state_features(s)),
        "log_pi_old": log(probs[a] + 1e-12),
    })
    s = s_next
```

عکس یک بار در زمان انتشار گرفته می شود. در دوران بروزرسانی تغییر نمی کند.

### مرحله دوم: مزایای GAE را محاسبه کنید (درسی 07)

همونطور که A2C هست، در تمام دسته عادی بشه

### مرحله 3: بروز رسانی جایگزین حذف شده

```python
for _ in range(K_EPOCHS):
    for mb in minibatches(buffer, size=64):
        for rec in mb:
            x = state_features(rec["s"])
            probs = softmax(logits(theta, x))
            logp = log(probs[rec["a"]] + 1e-12)
            ratio = exp(logp - rec["log_pi_old"])
            adv = rec["advantage"]
            surrogate = min(
                ratio * adv,
                clamp(ratio, 1 - EPS, 1 + EPS) * adv,
            )
            # backprop -surrogate, add value loss, subtract entropy
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # clipped
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

الگوی "کوتاه شدن → صفر" قلب PPO است. اگر سیاست جدید در جهت سودمند بیش از حد حرکت کرده باشد، به روزرسانی متوقف می شود.

### مرحله 4: ارزش و انترپی

به هدف منتقد MSE استاندارد و یک پاداش انتروپی در بازیگر اضافه کنید، همان طور که A2C.

### مرحله 5: تشخیص

سه تا چيز براي نگاه کردن به هر تازه ترين:

- **Mean KL** $\mathbb{E}[\log \pi_{\text{old}} - \log \pi_\theta]$باید توی خونه بمون`[0, 0.02]`اگه اون از قبل پرواز کنه`0.1`، کاهش`K_EPOCHS`یا`LR`. .
- **Clip fraction** بخش نمونه هایی که نسبت آن خارج از آن قرار دارد $[1-\epsilon, 1+\epsilon]$باید باشه`~0.1-0.3`اگه`~0`، کلپ هرگز باعث افزایش نمیشه`LR`یا`K_EPOCHS`اگه`~0.5+`، شما بیش از حد نصب کردن رولوت → پایین آوردن آنها.
- **Explained variance** $1 - \text{Var}(V_{\text{target}} - V_{\text{pred}}) / \text{Var}(V_{\text{target}})$. معیار کیفیت انتقادی . باید به سمت 1 بالا برود

## دام ها

- **Clip coefficient mistuned.** $\epsilon = 0.2$این استاندارد واقعی است.`0.1`تازه ها رو خیلی ترسناک می کنه`0.3+`به عدم ثبات دعوت می کند.
- **Too many epochs.** $K > 20$به طور معمول از ثبات بی ثباتی می کند چون سیاست ها از راه دور حرکت می کنند.$\pi_{\text{old}}$. دوره های محدود، به خصوص برای شبکه های بزرگ
- **No reward normalization.**مقیاس های بزرگ پاداش به محدوده کلیپ می خوردند. پاداش ها را قبل از مزایای محاسباتی عادی سازی کنید.
- **Forgetting advantage normalization.**نرمال سازی صفر متوسط/وحده std در هر دسته استاندارد است.
- **Learning rate not decayed.**PPO از انحلال LR خطی به صفر بهره مند می شود. LR ثابت اغلب بدتر است.
- **Importance ratio math errors.**همیشه`exp(log_new - log_old)`برای ثبات عددی، نه `new / old`. .
- **Wrong gradient sign.***بخاطر زایمان جایگزین*$-L^{\text{CLIP}}$. علامت برگشتي رایج ترين خطاي PPO است

## ازش استفاده کن

PPO الگورتھم RL پیش فرض 2026 در تعداد شگفت انگیزی از دامنه ها است:

| Use case | PPO variant |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — PPO variant without critic |
| Preference-only data | DPO — closed-form collapsing of PPO+KL, no online sampling |

شکل PPO *خسارت*  جایگزین برش شده + ارزش + انتروپی  است که برای DPO، GRPO و تقریبا هر لوله RLHF است.

## -باده

پس از`outputs/skill-ppo-trainer.md`:

```markdown
---
name: ppo-trainer
description: Produce a PPO training config and a diagnostic plan for a given environment.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Given an environment and training budget, output:

1. Rollout size. `N` envs × `T` steps.
2. Update schedule. `K` epochs, minibatch size, LR schedule.
3. Surrogate params. `ε` (clip), `c_v`, `c_e`, advantage normalization on.
4. Advantage. GAE(`λ`) with explicit `γ` and `λ`.
5. Diagnostics plan. KL, clip fraction, explained variance thresholds with alerts.

Refuse `K > 30` or `ε > 0.3` (unsafe trust region). Refuse any PPO run without advantage normalization or KL/clip monitoring. Flag clip fraction sustained above 0.4 as drift.
```

## تمرینات

1. **Easy.**از پي پي او در 4×4 گريد ورلد استفاده کن$\epsilon=0.2, K=4$.با عملکرد نمونه ها در مراحل سازگار با A2C (یک دوره در هر رول) مقایسه کنید.
2. **Medium.**پاک کردن$K \in \lbrace 1, 4, 10, 30 \rbrace$. نقشه برگشت به مقابل مرحله های محیط و ردیابی متوسط KL در هر بروزرسانی$K$کلوپین در این کار منفجر میشه؟
3. **Hard.**جایگزین جایگزین برش شده را با مجازات KL سازگار ($\beta$دو برابر شده اگر$\mathrm{KL} > 2 \cdot \text{target}$، نصف شده اگر$\mathrm{KL} < \text{target}/2$) بازده نهایی، ثبات و بدون کلپ را مقایسه کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | $\pi_\theta(a \mid s) / \pi_{\text{old}}(a \mid s)$; deviation from the policy that collected the data. |
| Clipped surrogate | "PPO's main trick" | $\min(r \cdot A, \mathop{\mathrm{clip}}(r, 1-\epsilon, 1+\epsilon) \cdot A)$; flat gradient past the clip on beneficial side. |
| Trust region | "TRPO / PPO intent" | Limit each update's KL to guarantee monotone improvement. |
| KL penalty | "Soft trust region" | Alternative PPO: $L - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$. Adaptive $\beta$. |
| Clip fraction | "How often clipping triggers" | Diagnostic — should be 0.1-0.3; outside means mistuned. |
| Multi-epoch training | "Data reuse" | K epochs on each rollout; variance cost traded for sample efficiency. |
| On-policy-ish | "Mostly on-policy" | PPO is nominally on-policy but K>1 epochs uses slightly-off-policy data safely. |
| PPO-KL | "The other PPO" | KL-penalty variant; used in RLHF where KL-to-reference is already a constraint. |

## خواندن بیشتر

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)روزنامه
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) TRPO، پيشگام PPO
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) هر پارامتر PPO حذف شده است.
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) InstructGPT؛ دستور کار PPO-in-RLHF
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) نمايش مدرن با PyTorch پاک
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) PPO یک فایل مرجع مورد استفاده در بسیاری از مقالات.
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) دستور تهیه PPO در مدل های زبان؛ همراه با درس 09 (RLHF) بخوانید.
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) مقاله "37 بهینه سازی سطح کد" ؛ چه ترفند های PPO باردار هستند و کدام ها فولکلور هستند.
