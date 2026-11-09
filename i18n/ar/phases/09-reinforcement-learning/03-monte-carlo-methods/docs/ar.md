# أساليب مونت كارلو  تعلم من الحلقات الكاملة

> البرمجة الديناميكية تحتاج إلى نموذج. مونت كارلو لا تحتاج سوى الحلقات. تشغيل السياسة، مشاهدة العائدات، متوسطها. الأسهل فكرة في RL  والتي تفتح كل شيء أسفل التيار.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## المشكلة

البرمجة الديناميكية هي جميلة، ولكن يفترض أنه يمكنك استفسار$P(s' \mid s, a)$لا يمكن للروبوت تحليلًا لتوزيع بيكسلات الكاميرا بعد محركة مشتركة. لا يمكن ل خوارزمية التسعير أن تتكامل مع كل رد فعل محتمل للعميل. لا يمكن لشركة التسليم المختلف للاستمرار في جميع المواصلات الممكنة بعد رمز.

تحتاج إلى طريقة لا تحتاج إلا إلى القدرة على * أخذ عينات * من البيئة. تنفيذ السياسة. الحصول على مسار`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`استخدمها لتقدير القيم هذا مونت كارلو

التحول من DP إلى MC مهم فلسفيا: نقوم بالانتقال من * النموذج المعروف + النسخة الاحتياطية الدقيقة * إلى * التنفيذات المعدنية + العائد المتوسط *. يرتفع التباين ، ولكن التطبيق يتفجر. كل خوارزمية RL بعد هذه الدروس  TD ، Q-learning ، REINFORCE ، PPO ، GRPO  هي تقدير مونت كارلو في قلبها ، في بعض الأحيان مع إطلاق التطبيقات على الطوابق فوق.

## المفهوم

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$أين$G^{(i)}(s)$تُلاحظ العوائد بعد زيارات $s$في سياسة$\pi$. . .

**First-visit vs every-visit MC.**نظراً للفصل الذي يزور الولاية$s$في العديد من المرات، MC الزيارة الأولى تعتبر فقط العودة من الزيارة الأولى؛ كل زيارة MC تعتبر جميع الزيارات. MC الزيارة الأولى غير متحيزة. كل زيارة MC يمكن أن تكون متحيزة قليلا بعد عدد محدود من الحلقات، لأنه يمتوسط عدد عشوائي من العوائد لكل حلقة ويمكن أن يكون هذا العدد مرتبطا مع العوائد، ولكن كليهما يتقارب إلى $V^\pi(s)$كما يذهب عدد الزيارات إلى اللانهاية. الزيارة الأولى أسهل لتحليل (معاكرات iid). كل زيارة تستخدم المزيد من البيانات لكل حلقة وعادة ما تتقارب أسرع في الممارسة.

**Incremental mean.**بدلاً من تخزين جميع العائدات، قم بتحديث المتوسط التشغيلي:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

إعادة تنظيم: $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$مع$\alpha = 1/n$. تغيير$1/n$لـ (حجم خطوة ثابت)$\alpha \in (0, 1)$و تحصل على مقياس MC غير ثابت الذي يتبع التغيرات في$\pi$هذه الخطوة هي قفزة كاملة من MC إلى TD إلى كل خوارزمية RL الحديثة.

**Exploration is now a problem.**و"دي بي" لمست كل ولاية من خلال الإحصاءات، و"إم سي" ترى فقط الدول الزيارات السياسية.$\pi$إنّها تحديدية، لا يتمّ أخذ عينات على مناطق كاملة من مساحة الدولة، وتقديرات قيمتها تبقى عند الصفر إلى الأبد.

1. **Exploring starts.**تبدأ كل حلقة من زوج عشوائي (ات) يضمن تغطية؛ غير واقعي في الممارسة العملية (لا يمكنك "إعادة تعيين" الروبوت إلى حالة تعسفية).
2. **ε-greedy.**تصرف طمعية في ق ق الحالي، ولكن مع احتمال$\epsilon$اختر عمل عشوائي جميع أزواج الحالة يتم أخذ عينات بشكل غير متزامن
3. **Off-policy MC.**جمع البيانات بموجب سياسة السلوك$\mu$، تعلم عن السياسة المستهدفة$\pi$الاختلافات عالية، ولكنها هي الجسر إلى طرق التعبير مثل DQN

**Monte Carlo Control.**تقييم → تحسين → تقييم، تماما مثل التكرار السياسي، ولكن التقييم يعتمد على أخذ العينات:

1. أركض$\pi$، احصل على حلقة.
2. تحديث $Q(s, a)$من العائدات الملاحظة
3. - أفعلها$\pi$الـ طمع$Q$. . .
4. أكرر

يتحرك إلى$Q^{\ast}$و$\pi^{\ast}$مع احتمال 1 في ظروف خفيفة (كل زوج زيارة في كثير من الأحيان ،$\alpha$يرضي (روبينز مونرو)

```figure
epsilon-greedy
```

## بناءها

### الخطوة الأولى: الإرسال → قائمة (s، a، r)

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

لا نموذج، فقط`env.reset()`و`env.step(s, a)`نفس الواجهة مثل بيئة رياضية ولكن تم تجريدها

### الخطوة الثانية: إرجاع الحساب (التصفية العكسية)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

مرّة واحدة،$O(T)$التكرار الراجع$G_t = r_{t+1} + \gamma G_{t+1}$يتجنب إعادة جمع.

### الخطوة الثالثة: تقييم المملكة العربية المتحدة في الزيارة الأولى

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

ثلاث خطوط تقوم بالعمل: علامة حالة كما هو مرر على الزيارة الأولى، عدد الزيادة، تحديث متوسط التشغيل.

### الخطوة الرابعة: إضفاء الضوابط على المجموعة المتحركة (على السياسة)

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

### الخطوة 5: مقارنة مع معيار الذهب DP

تقديرات المجلس الوطني$V^\pi$يجب أن توافق مع نتيجة DP من الدروس 02 كحلقات → ∞. في الممارسة العملية: 50,000 حلقة على 4×4 GridWorld يجعلك في غضون `~0.1`من إجابة DP.

## الفخاخ

- **Infinite episodes.**إن كان سياستك يمكن أن تكون دائمة للأبد، فليكن ذلك صحيحاً`max_steps`واعتبروا أنّه فشل ضمني، وذلك أمر طبيعي، فقط تأكد من احتسابها بشكل صحيح.
- **Variance.**الموسيقى تستخدم العائدات الكاملة في الحلقات الطويلة، الاختلاف هائل  مكافأة واحدة غير محظوظة في نهاية النقبات $V(s_0)$وذلك في نفس المبلغ. أساليب التد (دروس 04) خفض هذا عن طريق إطلاق.
- **State coverage.**الموسيقي الطمأنسي على ق جديد مع العلاقات سوف تجرب فقط عمل واحد يجب عليك استكشاف (ε-طمأنسي، استكشاف بدايات، UCB).
- **Non-stationary policies.**إذا$\pi$تغيرات (كما هو الحال في مراقبة MC) ، العائدات القديمة هي من سياسة مختلفة.
- **Off-policy importance sampling.**الوزن$\pi(a \mid s)/\mu(a \mid s)$يضاعف عبر مسار. ينفجر التباين مع الأفق. القيادة مع IS الموزن لكل قرار أو الانتقال إلى TD.

## استخدمها

دور أساليب مونت كارلو لعام 2026:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

الخوارزميات الحديثة للخلفية العميقة (PPO، SAC) تتقاطع بين MC (العائد الكامل) و TD (الخطوة الواحدة من التشغيل)$n$-المستويات الخطوة أو GAE. كلا النقاط النهائية هي حالات من نفس المقدرة.

## أرسله

إبقوا`outputs/skill-mc-evaluator.md`:

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

## التمارين

1. **Easy.**تنفيذ تقييم الممثلين في الزيارة الأولى لسياسة التعرض العشوائي الموحد على 4 × 4 GridWorld. تشغيل 10،000 حلقة.$V(0,0)$كعمل على عدد الحلقات مقابل إجابة DP.
2. **Medium.**تنفيذ التحكم في الـ " MC " الفطري مع$\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$مقارنة معدل العودة بعد 20000 حلقة كيف يبدو منحنى؟ أين يعيش التداول بين التباينات والتحيزات؟
3. **Hard.**تنفيذ * خارج السياسة* MC مع أخذ العينات المهمة: جمع البيانات في إطار سياسة متساوية متساوية $\mu$، تقدير $V^\pi$لسياسة التحديد المثلى$\pi$. مقارنة IS بسيطة مقابل IS لكل قرار مقابل IS الموزن

## الشروط الرئيسية

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

## المزيد من القراءة

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) العلاج القنوني
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) أول زيارة مقابل تحليل كل زيارة
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) خارج السياسة MC والتحكم في التباين.
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) مقياسات IS الحديثة ذات التغيرات المنخفضة.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) أول إثبات تجريبي واسع النطاق لعبة MC/TD الذاتية تتحول إلى لعبة فائقة الإنسانية؛ مقدمة مفهومية لكل درس في النصف الثاني من هذه المرحلة.
