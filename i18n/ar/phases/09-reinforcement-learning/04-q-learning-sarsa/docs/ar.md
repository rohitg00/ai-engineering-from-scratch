# الفرق في الوقت الزمني  Q-Learning & SARSA

> ينتظر مونت كارلو حتى تنتهي الحلقة. يقوم TD بتحديث كل خطوة من خلال إطلاق تقدير القيمة التالي. Q-تعلم غير سياسية ومثالي؛ SARSA على السياسة ومحذرة. كلاهما خط واحد من الشفرة. كلاهما يستند إلى كل طريقة عميقة RL في هذه المرحلة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## المشكلة

يعمل مونت كارلو ولكن لديه طلبان مكلفان. يحتاج إلى حلقات تنتهي، ويُحديث فقط بعد العودة النهائية. إذا كانت حلقةك 1000 خطوة، ينتظر MC 1000 خطوة لتحديث أي شيء. إنها عالية التباين، منخفضة التحيز، وبطيئة في الممارسة.

البرمجة الديناميكية لديها الملف المقابل  النسخ الاحتياطية المبدئية ذات التغير الصفر  ولكن تتطلب نموذجاً معروفًا.

التعلم الفرق في الزمن (TD) يفرق الفرق. من انتقال واحد $(s, a, r, s')$، تشكيل هدف خطوة واحدة$r + \gamma V(s')$و الدفع$V(s)$لا نموذج، لا حلقات كاملة، تحيزات من استخدام تقريبي$V$على RHS، ولكن أقل بكثير من الاختلافات من MC والتحديثات على الانترنت من الخطوة الأولى.

هذه هي المحور الذي يتحول عليه جميع RL  DQN الحديثة، A2C، PPO، SAC . الباقي من المرحلة 9 هي طبقات من التقريب الوظيفي والحيل التي بنيت على رأس تحديث TD خطوة واحدة ستكتب في هذا الدروس.

## المفهوم

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

الكمية المرتبطة هي خطأ TD $\delta = r + \gamma V(s') - V(s)$إنه التناظر عبر الإنترنت لـ$G_t - V(s_t)$في المياه المختلفة .$\alpha$(مُرضى (روبينز مونرو$\sum \alpha = \infty$،$\sum \alpha^2 < \infty$وكل الدول زارت كثيراً

**Q-learning.**طريقة TD خارج السياسة للسيطرة:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

- نعم`max`يفترض أن سياسة * طمعية * سيتم اتباعها من$s'$وذلك التخلّص يجعل تعلم القيّة يتعلم$Q^{\ast}$بينما يستكشف العميل عن طريق ε-greedy. Mnih et al. (2015) حول هذا إلى Deep Q-learning على Atari (دروس 05).

**SARSA.**طريقة التنقل التجاري في السياسة:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

الاسم هو الـ " توبل "$(s, a, r, s', a')$. سارسا تستخدم الإجراء$a'$العميل يأخذ التالي، وليس الجشع`argmax`. يتحرك إلى$Q^\pi$لأي شيءٍ طموح$\pi$يدير، الذي في الحد$\epsilon \to 0$يصبح$Q^{\ast}$. . .

**The cliff-walking difference.**في مهمة المشي على الصخره الكلاسيكية (سقطة-من-الصخره = مكافأة -100) ، يتعلم Q-التعلم المسار الأمثل على طول حافة الصخره ولكن في بعض الأحيان يأخذ العقوبة أثناء الاستكشاف. تعلم SARSA مسار أكثر أمانا خطوة واحدة بعيدا عن الصخره لأنه يعامل ضجيج الاستكشاف في قيمة Q. مع التدريب، كلتا الوصول إلى المثالي عند $\epsilon \to 0$في الممارسة المهمة: عندما يحدث الاستكشاف في الواقع عند النشر، سلوك SARSA أكثر تحفظًا.

**Expected SARSA.**استبدل$Q(s', a')$مع قيمته المتوقعة أقل من $\pi$:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

انخفاض التباين من SARSA (لا يوجد عينة من$a'$() نفس الهدف السياسي، غالباً ما يكون الاختلاف في الكتب المدرسية الحديثة.

**n-step TD and TD(λ).**التقاط بين TD(0) و MC عن طريق الانتظار $n$خطوات قبل إطلاقها. $n=1$هو TD، $n=\infty$هو MC. TD(λ) المتوسطات على كل $n$مع الوزن الهندسي $(1-\lambda)\lambda^{n-1}$معظم استخدامات القوة العمقية$n$بين 3 و 20.

```figure
qlearning-gridworld
```

## بناءها

### الخطوة الأولى: SARSA بشأن السياسة الـ "الحريصة"

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

ثمانية خطوط، الفرق الوحيد بين Q-Learning هو خط الهدف.

### الخطوة الثانية: تعلم القي

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

- نعم`max`يفرق الهدف عن السلوك. هذا الرمز الواحد هو الفرق بين السياسة والسياسة الخارجي.

### الخطوة الثالثة: منحنى التعلم

متوسط العودة في 100 حلقة. يتقارب تعلم Q أسرع على شبكة التشبيه البسيطة ؛ SARSA أكثر تحفظا على المشي على الصخور. على شبكة 4 × 4 في `code/main.py`كلاهما مثالي تقريباً بعد 2000 حلقة$\alpha=0.1, \epsilon=0.1$. . .

### الخطوة الرابعة: مقارنة الحقيقة

إعادة تشغيل القيمة (درس 02) للحصول على $Q^{\ast}$- تفقد$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$. وكيل TD صحي جداول الهبوط داخل `~0.5`على شبكة 4×4 العالم بعد 10,000 حلقة.

## الفخاخ

- **Initial Q values matter.**بداية متفائلة ($Q = 0$يُشجع التنقيب. يمكن أن يقع بداية السوء في حُصّة سياسة طموحة إلى الأبد.
- **α schedule.**مستمرة$\alpha$لا بأس في مشاكل غير ثابتة.$\alpha_n = 1/n$يعطي التقارب النظري ولكن بطيء جدا في الممارسة $\alpha$في`[0.05, 0.3]`وراقب منحنى التعلم
- **ε schedule.**البدء مرتفع ($\epsilon=1.0$، تدهور إلى$\epsilon=0.05$"GLIE" (الحس في الحد مع استكشاف لا نهاية له) هو حالة التقارب.
- **Max bias in Q-learning.**- نعم`max`المستخدم متحيز للأعلى عندما$Q$يؤدي إلى زيادة التقدير  تعلم هاسلت المزدوج Q (الذي استخدمه DDQN في الدروس 05) يصلح هذا مع جدولين Q.
- **Non-terminating episodes.**يمكن لـ TD أن يتعلم دون محطات ، ولكن عليك إما أن تطبق الخطوات أو التعامل مع إطلاق الصوت بشكل صحيح في الحائط.
- **State hashing.**إذا كانت الحالات هي أجزاء متجمدة/مضغوطات، استخدم مفتاحًا يمكن التشغيل به (أجزاء متجمدة، وليس قائمة؛ أجزاء متجمدة من العلو، وليس خامًا).

## استخدمها

المشهد التجاري لعام 2026:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

90% من "RL" التي تقرأ عنها في ورق 2026 هي بعض التطويرات من Q- تعلم أو SARSA. فهم تحديث الجدول المتحدي في أصابعك قبل قراءة أعمق.

## أرسله

إبقوا`outputs/skill-td-agent.md`:

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

## التمارين

1. **Easy.**تنفيذ Q-تعلم و SARSA على 4 × 4 GridWorld. خطة منحنى التعلم (متوسط العائد لكل 100 حلقة) ل 2000 حلقة. من يتقارب أسرع؟
2. **Medium.**قم ببناء بيئة المشي على الصخره (4 × 12 ، الصف الأخير هو الصخره مع مكافأة -100 وإعادة ضبطها للبدء). مقارنة سياسات Q-learning و SARSA النهائية. صور شاشة المسارات التي يتخذها كل واحد. أي من هذه السلالم أقرب إلى الصخره؟
3. **Hard.**تنفيذ تعلم Q مزدوج. على جريد ورلد (ضوضاء غوسيان $\sigma=5$إضافة إلى مكافأة خطوة واحدة) ، يظهر Q-التعلم المبالغة في تقديرات $V^{\ast}(0,0)$وبالقدر المفيد بينما تعلم القي المزدوج لا يفعل

## الشروط الرئيسية

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

## المزيد من القراءة

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) الورقة الأصلية و دليل التقارب.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0) ، SARSA، Q-تعلم، المتوقع SARSA.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) إصلاح تحيز القياس
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) تحفيز سارسا المتوقع
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) الورقة التي ابتكرت SARSA (التي كانت تسمى "التعلم Q-المرتبط المعدل) ".
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) يجميع TD(0) إلى TD(n) ، المسار من Q-تعلم إلى آثار التأهل، ولاحقاً، GAE في PPO.
