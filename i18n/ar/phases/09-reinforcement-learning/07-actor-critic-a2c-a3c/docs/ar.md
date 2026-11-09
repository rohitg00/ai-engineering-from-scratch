# الممثلين المنتقدين

> "إضافة نقدي يتعلم"$\hat{V}(s)$، ويقلل من العودة، و تحصل على ميزة التي لديها نفس التوقعات ولكن أقل بكثير التباين. وهذا هو الممثل-النقدي. A2C يديرها بالتزامن؛ A3C يديرها عبر الأوتار. كلاهما هو النموذج العقلي لكل طريقة العميقة الحديثة RL.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## المشكلة

فانيلا رينفورس تعمل، ولكن تغيرها رهيب.$G_t$يمكن أن تتدفق على عامل 10 بين الحلقات.$\nabla \log \pi$و يُنتج متوسط تقدير التراجع الذي يستغرق آلاف الحلقات لنقل السياسة على نفس المسافة التي يمكنك نقلها بها مع تحديثات أقل بكثير من DQN.

التباين يأتي من استخدام العائدات الخام. إذا قمت بإسقاط خط أساسي $b(s_t)$ أي وظيفة من الحالة، بما في ذلك القيمة المكتسبة  لا تتغير التوقعات وتقلص التباين.$\hat{V}(s_t)$الآن الكمية مضاعفة$\nabla \log \pi$هو * الميزة*:

```math
A(s, a) = G - \hat{V}(s)
```

عمل جيد إذا كان ينتج عائد فوق المتوسط ؛ سيء إذا كان أقل. REINFORCE مع ناقد مدرب هو *منتقد الممثل. * يعطي النقاد الممثل معلمًا منخفضًا التباين. هذه هي كل طريقة سياسة عميقة بعد عام 2015 (A2C ، A3C ، PPO ، SAC ، IMPALA).

## المفهوم

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$: السياسة. عينات للتصرف. تدرب مع تراجع السياسة.
- **Critic** $V_\phi(s)$: التقديرات المتوقعة العودة من الدولة. تدرب على الحد الأدنى $(V_\phi(s) - \text{target})^2$. . .

**The advantage.**شكلين قياسيين:

- * ميزة المجلس المالي*:$A_t = G_t - V_\phi(s_t)$غير متحيز، متباين أعلى
- *فائدة التكنولوجيا*:$A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. التحيز (استخدامات $V_\phi$() ، المتغيرات أقل بكثير.$\delta_t$. . .

**n-step advantage.**التقاط بين الاثنين:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$هو طاهرة التد.$n = \infty$هو MC. معظم التنفيذات تستخدم $n = 5$لـ " أتاري "$n = 2048$لـ (بوبو) على (ميوجوكو)

**Generalized Advantage Estimation (GAE).**اقترح Schulman et al. (2016) متوسط معدل على نحو متكامل على جميع مزايا الخطوة n:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

مع$\lambda \in [0, 1]$. .$\lambda = 0$هو TD (تباين منخفض، تحيز كبير). $\lambda = 1$هو MC (تباين عال، غير متحيز). $\lambda = 0.95$هو 2026 الوضع الافتراضي  حتى يكون الرقم المتحرك / التغير حيث تريد ذلك.

**A2C: synchronous advantage actor-critic.**جمع$T$خطوات عبر$N$بيئات متوازية، احسب مزايا لكل خطوة، قم بتحديث الممثل والنقيب على اللحظة المشتركة، أكرر، أسهل وأكثر قابلية للتوسع من A3C.

**A3C: asynchronous advantage actor-critic.**Mnih et al. (2016) ، Spawn $N$خيوط العمال، كل واحد يعمل على محيط. يحسب كل عامل تراجعات محليا على تنفيذها الخاص، ثم يطبقها بشكل غير متزامن على خادم معايير مشتركة. لا حاجة إلى مسدس إعادة التشغيل  يعملون على إزالة التنسيق عن طريق تشغيل مسارات مختلفة. أثبت A3C أنه يمكنك التدريب على وحدات المعالجة المركزية على نطاق واسع. في عام 2026، يهيمن A2C القائم على GPU (حوائط متوازية المجموعة) لأن GPUs تريد دفعات كبيرة.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

ثلاثة شروط: خسارة مستوى السياسة، تراجع القيمة، مكافأة الإنتروبي. `c_v ~ 0.5`،`c_e ~ 0.01`هي نقاط بداية طائفية.

```figure
actor-critic
```

## بناءها

### الخطوة الأولى: نقدي

النقاد الخطى$V_\phi(s) = w \cdot \text{features}(s)$تحديث مع MSE:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

على البيانات الجدولية يتقارب النقاد في بضع مئات الحلقات. على Atari، استبدل النقاد الخطية مع صندوق CNN المشترك + رأس القيمة.

### الخطوة الثانية: فائدة الخطوة

نظراً لعدد الطول$T$و نهائيّة محطّمة$V(s_T)$:

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

`returns`هو الهدف النقدي.`advantages`هو ما يضاعف$\nabla \log \pi$. . .

### الخطوة الثالثة: تحديث مشترك

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

في السياسة، تنفيذ واحد لكل تحديث، معدلات التعلم منفصلة للممثل والنقيب.

### الخطوة الرابعة: التوازي (A3C مقابل A2C)

- **A3C:**ألتقط$N$كل واحد يدير محيطه الخاص والمرور الأمامي الخاص به. دفع تحديثات التراجع بشكل دوري إلى الماجستير المشترك. لا قفل على الماجستير  السباقات بخير، فإنها مجرد إضافة الضوضاء.
- **A2C:**أركض$N$في حالة عمل واحد، قم بتجميع الملاحظات إلى مجموعة`[N, obs_dim]`المجموعة، المجموعة المقدمة، المجموعة الخلفية المجموعة. استخدام أعلى من GPU، تحديد، أسهل للتفكير. الافتراض في عام 2026.

رمز ألعابنا هو واحد خيط لوضوح؛ إعادة كتابة إلى A2C المكتوب هو ثلاثة خطوط من numpy.

## الفخاخ

- **Critic bias before actor gradient.**إذا كان النقاد عشوائيًا، فإن خط أساسه غير معلومي وأنت تتدرب على الضوضاء النقية. احترم النقاد لبضعة مئات الخطوات قبل تشغيل نسبة السياسة، أو استخدم معدل تعلم الممثلون البطيء.
- **Advantage normalization.**تعاديل المزايا إلى صفر المتوسط / وحدة-std لكل دفعة. يثبت التدريب بشكل كبير مقابل تكلفة قريبة من الصفر.
- **Shared trunk.**استخدم مخرج الميزات المشتركة للممثل والنقيب على مدخلات الصورة. رؤوس منفصلة. الميزات المشتركة مفتوحة على كل من الخسائر.
- **On-policy contract.**A2C يستخدم البيانات مرة أخرى لنحديث واحد بالضبط. أكثر و تدرجك متحيز (تصحيح العينات المهمة هو ما يضيف PPO).
- **Entropy collapse.**بدون$c_e > 0$سياسة تصبح شبه تحديدية بعد بضع مئات من التحديثات وتتوقف عن الاستكشاف
- **Reward scale.**تعتمد magnitudes الميزة على مقياس المكافآت. عادي مكافآت (مثل، تشغيل-std تقسيم) لعدد التراجع المتسقة عبر المهام.

## استخدمها

A2C / A3C نادرا ما تكون الخيار النهائي في عام 2026 ولكنها هي الهندسة المعمارية التي يضبطها كل شيء لاحقاً:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

إذا رأيت "ميزة" في ورقة عام 2026، فكر في ناقد الممثلين.

## أرسله

إبقوا`outputs/skill-actor-critic-trainer.md`:

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

## التمارين

1. **Easy.**تدرب الممثل المنتقد مع ميزة MC $(G_t - V(s_t))$مقارنة كفاءة العينة مع معدل الأساسية للعمل مع التكثيف من الدروس 06.
2. **Medium.**الانتقال إلى ميزة TD- بقايا $(r + \gamma V(s') - V(s))$.قياس التباين بين مجموعات الميزات .بكم ينخفض ؟
3. **Hard.**تنفيذ GAE ((λ).$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$. العائد النهائي للمخطط مقابل كفاءة العينة أين هو نقطة التحيز/الاختلاف المثالي لهذا المهمة؟

## الشروط الرئيسية

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

## المزيد من القراءة

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) A3C، ورقة الممثلين المنتقدين الأصلية غير المزامن.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) GAE
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf)أساسيات؛ إزواج هذا مع فصل 9 على التقريب الوظيفي عندما يكون النقاد شبكة عصبية.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) تحديداً متوزعاً للمحركين المنتقدين مع تصحيح خارج السياسة في البصمة.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) إنتاج عمليات A2C/PPO التي تستحق القراءة.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) النتيجة الأساسية للتقارب للفشل الممثل-النقدي على مقياسين.
