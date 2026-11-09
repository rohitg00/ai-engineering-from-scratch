# سياسة تدريجية  تعزيز من الصفر

> توقف عن تقدير القيمة. حدد السياسة مباشرة، وحسب تراجع العائد المتوقع، خطوة صعودا. كتب ويليامز (1992) ذلك في نظرية واحدة. هذا هو السبب في وجود PPO، GRPO، وكل حلقة LLM RL.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## المشكلة

Q-التعلم و DQN تعريف وظيفة * القيمة *. انت تختار الإجراءات عن طريق `argmax Q`هذا جيد للأفعال المفصلة والحالات المفصلة. انهار عندما تكون الأفعال مستمرة (التي`argmax`أكثر من 10 أبعاد الدوران؟) أو عندما تريد سياسة استوكاستية (`argmax`هو تحديد من خلال البناء).

تُعَدّل نسبة السياسة * السياسة* بدلاً من ذلك. $\pi_\theta(a \mid s)$شبكة عصبية تنتج توزيع على الإجراءات.$\theta$خطوة صعوداً`argmax`لا يوجد استرجاع بيلمان، فقط صعود التسلسل$J(\theta) = \mathbb E_{\pi_\theta}[G]$. . .

نظرية REINFORCE (ويليامز 1992) تقول لك أن هذا التراجع يمكن حسابه:$\nabla J(\theta) = \mathbb E_\pi[ G \cdot \nabla_\theta \log \pi_\theta(a \mid s) ]$أطلق حلقة، احسب العائد، مضاعفة بال$\nabla \log \pi_\theta(a \mid s)$في كل خطوة، متوسط، صعود درجة، انتهى

كل خوارزمية LLM-RL في 2026  PPO، DPO، GRPO  هي تحسين من REINFORCE. فهمها في أصابعك هو شرط أساسي لبقية هذه المرحلة، وللمرحلة 10 · 07 (تنفيذ RLHF) والمرحلة 10 · 08 (DPO).

## المفهوم

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**The policy gradient theorem.**لأي سياسة$\pi_\theta$المعلمات بواسطة $\theta$:

```math
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[ \sum_{t=0}^{T} G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]
```

أين$G_t = \sum_{k=t}^{T} \gamma^{k-t} r_{k+1}$هو العائد المخصوم من الخطوة$t$التوقعات تجاوزت المسارات الكاملة$\tau$تم أخذ عينات من$\pi_\theta$. . .

**The proof is short.**التفريق$J(\theta) = \sum_\tau P(\tau; \theta) G(\tau)$تحت التوقعات.$\nabla P(\tau; \theta) = P(\tau; \theta) \nabla \log P(\tau; \theta)$(حيلة المشتقات السجلية) عامل$\log P(\tau; \theta) = \sum \log \pi_\theta(a_t \mid s_t) + \text{environment terms that do not depend on } \theta$تعبيرات البيئة تختفي خطين من الجبر يعطيكما النظرية

**Variance reduction tricks.**"فانيلا رينفورس" لديها اختلافات قاتلة "الردود ضجة"$\nabla \log \pi$إنّهم صاخبان، إنّ منتجاتهم صاخبة جداً.

1. **Baseline subtraction.**استبدل$G_t$مع$G_t - b(s_t)$لأي خط أساسي $b(s_t)$لا تعتمد على$a_t$غير متحيز لأن$\mathbb{E}[b(s_t) \cdot \nabla \log \pi(a_t \mid s_t)] = 0$اختيار نموذجي:$b(s_t) = \hat{V}(s_t)$تعلم من قبل النقاد → الممثل-النقاد (درس 07).
2. **Reward-to-go.**استبدل$\sum_t G_t \cdot \nabla \log \pi_\theta(a_t \mid s_t)$مع$\sum_t G_t^{\text{from } t} \cdot \nabla \log \pi_\theta(a_t \mid s_t)$. فقط العائدات المستقبلية مهمة لفعل معين  مكافآت سابقة تساهم في ضجيج صفر المتوسط.

مجتمعة، تحصل على:

```math
\nabla J \approx (1/N) \sum_{i=1}^{N} \sum_{t=0}^{T_i} [ G_t^{(i)} - \hat{V}(s_t^{(i)}) ] \cdot \nabla_\theta \log \pi_\theta(a_t^{(i)} \mid s_t^{(i)})
```

وهو REINFORCE مع خط أساسي  الجدول المباشر لـ A2C (دراسة 07) و PPO (دراسة 08).

**Softmax policy parameterization.**بالنسبة للقيام بعمل منفصل، الخيار القياسي:

```math
\pi_\theta(a \mid s) = \exp(f_\theta(s, a)) / \sum_{a'} \exp(f_\theta(s, a'))
```

أين$f_\theta$أي شبكة عصبية تنتج نتيجة لكل عمل.

```math
\nabla_\theta \log \pi_\theta(a \mid s) = \nabla_\theta f_\theta(s, a) - \sum_{a'} \pi_\theta(a' \mid s) \nabla_\theta f_\theta(s, a')
```

أي، النتيجة من الإجراءات التي تم اتخاذها ناقصاً قيمتها المتوقعة في إطار السياسة.

**Gaussian policy for continuous actions.** $\pi_\theta(a \mid s) = N(\mu_\theta(s), \sigma_\theta(s))$. .$\nabla \log N(a; \mu, \sigma)$هذا كل ما يحتاجه SAC في المرحلة 9 · 07

```figure
policy-gradient-landscape
```

## بناءها

### الخطوة الأولى: شبكة سياسة softmax

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

استخدم سياسة خطية (متجه وزن واحد لكل عمل) لتحويل جدول. بالنسبة لـ Atari ، قم بتبادل في CNN واحافظ على رأس softmax.

### الخطوة الثانية: أخذ العينات وإمكانية تسجيل السجلات

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

### الخطوة الثالثة: الإرسال مع التقاط المراقبة السجلية

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

### الخطوة الرابعة: تحديث REINFORCE

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

التراجع$\nabla \log \pi(a \mid s) = e_a - \pi(\cdot \mid s)$(بما في ذلك)$a$- احتمالات) هو قلب التدرج السياسية softmax. احرقها في الذاكرة العضلية.

### الخطوة 5: خطوط أساسية

متوسط سريع من$G$على الرغم من أنّه لا يزال هناك الكثير من المعلومات عن المجموعة، فإنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ أنّه لا يزال من المفاجئ، ولكنّه لا يزال من المفاجئ أنّه لا يصل إلى المفاجئ.$\hat{V}(s)$و تحصل على نقدي الممثل

## الفخاخ

- **Exploding gradients.**العائدات يمكن أن تكون ضخمة دائماً التطبيع$G$إلى`~N(0, 1)`عبر اللحظة قبل أن تضاعف ب $\nabla \log \pi$. . .
- **Entropy collapse.**السياسة تتحرك نحو عمل تقريب القرار مبكراً جداً، وتوقف عن الاستكشاف، وتعلق.$\beta \cdot H(\pi(\cdot \mid s))$إلى الهدف
- **High variance.**تحتاج فانيلا رينفورس إلى آلاف الحلقات. خط أساسي للنقد (درس 07) أو منطقة الثقة في TRPO/PPO (درس 08) هو الإصلاح القياسي.
- **Sample inefficiency.**على السياسة يعني أنك ترمي كل انتقال بعد تحديث واحد. التصحيحات خارج السياسة عن طريق أخذ العينات الأهمية تجلب البيانات، على تكلفة التباين (نسبة الـPPO هي وزن IS المقلد).
- **Non-stationary gradients.**نفس التراجع من 100 حلقة مضت يستخدم القديم$\pi$أساليب السياسة تحديث كل عدد قليل من التنفيذ لهذا السبب.
- **Credit assignment.**بدون مكافأة للذهاب، مكافآت سابقة تساهم في الضوضاء.

## استخدمها

في عام 2026، نادراً ما يتم تشغيل REINFORCE مباشرة ولكن صيغة تراجعها موجودة في كل مكان:

| Use case | Derived method |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — REINFORCE with group-relative baseline, no critic |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — REINFORCE rewritten as a preference-likelihood loss, no sampling |

عندما تقرأ`loss = -advantage * log_prob`في نص تدريب 2026، وهذا هو REINFORCE مع خط أساسي. الأوراق الكاملة (DPO، GRPO، RLOO) هي خدوش تقليل التباين فوق هذا الخط واحد.

## أرسله

إبقوا`outputs/skill-policy-gradient-trainer.md`:

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

## التمارين

1. **Easy.**تنفيذ REINFORCE على 4 × 4 GridWorld مع سياسة softmax خطية. تدريب لمدة 1000 حلقة دون خط أساسي. رسم منحنى التعلم؛ قياس التباين (std من العائدات).
2. **Medium.**إضافة خط أساسي متوسط التشغيل، تدريب مرة أخرى، مقارنة كفاءة العينة والتشابه مع الجري من الفانيليا. كم يقلل خط أساسي الخطوات إلى التقارب؟
3. **Hard.**إضافة إضافة إضافية للإنتروبيا $\beta \cdot H(\pi)$- أُسحّر$\beta \in \lbrace 0, 0.01, 0.1, 1.0 \rbrace$الخطة النهائية العودة والسياسة الانتروبية أين هو نقطة اللطيفة في هذه المهمة؟

## الشروط الرئيسية

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

## المزيد من القراءة

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696)ورقة REINFORCE الأصلية
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html)النظريه الحديثة للسياسة-المركز مع التقريب الوظيفي.
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) عرض الكتب المدرسية
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) التعليم التربوي الواضح مع رمز PyTorch.
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) تقليل التباين والنظرية الطبيعية-المركزية التي تربط REINFORCE مع عائلة منطقة الثقة (TRPO، PPO).
