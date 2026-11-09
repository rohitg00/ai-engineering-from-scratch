# التخطيط الديناميكي  تعديل السياسات وتعديل القيمة

> البرمجة الديناميكية هي RL مع الغش. أنت تعرف بالفعل وظائف الانتقال والمكافأة؛ أنت فقط تكرر معادلة بيلمان حتى $V$أو$\pi$إنه المعيار الذي تحاول كل طريقة تستند إلى العينات.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## المشكلة

لديك MDP مع نموذج معروف: يمكنك استفسار $P(s' \mid s, a)$و$R(s, a, s')$لجميع أزواج الحالة. مدير المخزون يعرف توزيع الطلب. لعبة اللوحة لديها انتقالات تحديدية. عالم الشبكة هو أربعة خطوط من بيثون. لديك * نموذج *.

تم اختراع RL الخالية من النموذج (Q-learning ، PPO ، REINFORCE) للحالة التي لا يكون لديك نموذج  يمكنك فقط أخذ عينات من البيئة. ولكن عندما يكون لديك واحد ، هناك أساليب أسرع وأفضل: البرمجة الديناميكية. صممها بيلمان في عام 1957. لا يزالون يحددون الصواب: عندما يقول الناس "سياسة مثالية لهذا MDP ،" يعنيون أن السياسة DP ستعود.

تحتاج إليها في عام 2026 لثلاث أسباب. أولاً، يتم حل كل بيئة جدولية في أبحاث RL (GridWorld، FrozenLake، CliffWalking) مع DP لإنتاج سياسة معيار الذهب. ثانياً، القيم الدقيقة تسمح لك * إزالة * أساليب العينات: إذا كان تقدير Q-تعلم ل $V^{\ast}(s_0)$يختلف مع إجابة DP بنسبة 30% ، فإن Q-learning لديك خطأ. ثالثًا ، فإن أساليب التخطيط والتنظيم الحديثة غير المتعلقة بالإنترنت (MCTS ، البحث في AlphaZero ، RL القائمة على النموذج في المرحلة 9 · 10) كلها تكرر نسخة احتياطية Bellman على النموذج المعلم أو المقدم.

## المفهوم

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**يتناوب خطوتين حتى تتوقف السياسة عن التغيير

1. *التقييم:* السياسة المقدمة $\pi$، الحساب$V^\pi$من خلال تطبيقها مراراً وتكراراً$V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$حتى يتقارب
2. *تحسين:* تم إعطائه $V^\pi$, جعل$\pi$الشريعون$V^\pi$: $\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$. . .

يتم ضمان التقارب لأن (أ) كل خطوة تحسين إما تحافظ على$\pi$نفس أو زيادة صارمة $V^\pi$بالنسبة لبعض الدول، (ب) مساحة السياسات التحديدية محدودة. عادة ما تتقارب في ~ 520 التكرارات الخارجية حتى بالنسبة إلى مساحات الدولة الكبيرة.

**Value iteration.**ينهار التقييم والتحسين إلى صفعة واحدة. تطبيق معادلة بيلمان * الإيجابية *:

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

كرر حتى$\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. استخراج السياسة في النهاية عن طريق اتخاذ الإجراء الطموح. أسرع بشكل صارم لكل إعادة التكرار  لا يوجد حلول تقييم داخلي  ولكن عادة ما تحتاج إلى المزيد من الإعادة التكرارية للتقارب.

**Generalized policy iteration (GPI).**الإطار الموحد. يتم حبس وظيفة القيمة والسياسة في حلقة تحسين متجهين. أي طريقة تدفع كلا نحو التوافق المتبادل (تكرار القيمة غير المزامنة، وتكرار السياسة المعدلة، Q-التعلم، الممثل-النقاد، PPO) هي مثال على GPI.

**Why $\gamma < 1$ matters.**عامل بيلمان هو$\gamma$-التقلص في القاعدة السائدة:$\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$. التقلص يعني نقطة ثابتة و تقارب هندسي فريدة من نوعها.$\gamma < 1$و أنت تفقد الضمان تحتاج إلى أفق محدود أو حالة نهاية امتصاص

```figure
value-iteration-gamma
```

## بناءها

### الخطوة الأولى: بناء نموذج GridWorld MDP

استخدم نفس 4 × 4 GridWorld من الدروس 01. نضيف إختلاف استوكاستيك: مع احتمال `0.1`الوكيل ينزلق في اتجاه عمودي عشوائي

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

`transitions(s, a)`يعود قائمة `(s', r, p)`هذا هو النموذج بأكمله

### الخطوة الثانية: تقييم السياسات

نظراً لسياسة`π(s) = {action: prob}`، أعيد تعاديل معادلة بيلمان حتى $V$يتوقف عن التحرك:

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

### الخطوة الثالثة: تحسين السياسات

استبدل$\pi$مع السياسة الطموحة w.r.t.$V$إذا$\pi$لم يتغير، العودة نحن في المثالي.

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

### الخطوة الرابعة: خياطهما معاً

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

التقارب النموذجي على 4 × 4: 46 التكرارات الخارجية.$V^{\ast}(0,0) \approx -6$و سياسة تقلل صارمة من عدد الخطوات

### الخطوة 5: التكرار القيم (إصدار حلقة واحدة)

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

نفس النقطة الثابتة، أقل خطات من الرمز.

## الفخاخ

- **Forgetting to handle terminals.**إذا وضعت بيلمان في حالة امتصاص، فإنه لا يزال يلتقط "أفضل عمل" الذي لا يغير أي شيء.`if s == terminal: V[s] = 0`. . .
- **Sup-norm vs L2 convergence.**استخدام`max |V_new - V|`الضمان النظري هو على القاعدة السائدة
- **In-place vs synchronous updates.**تحديث`V[s]`في مكان (غوس-سايدل) يتقارب أسرع من منفصل `V_new`(جاكوبي) رمز الإنتاج يستخدم في المكان
- **Policy ties.**إذا كانت اثنين من الأعمال لها قيمة Q متساوية،`argmax`قد يقطع الروابط بشكل مختلف في كل تكرار، مما يسبب تذبذب في عملية التحقق من "استقرار السياسة". استخدم وقف الربط المستقر (الفعال الأول في ترتيب ثابت).
- **State-space explosion.**دبي هو$O(\lvert S \rvert \cdot \lvert A \rvert)$يعمل حتى ~ 107 حالة. وبالإضافة إلى ذلك، تحتاج إلى تقريب الوظيفة (المرحلة 9 · 05 وما بعدها).

## استخدمها

في عام 2026، فإن DP هي خط الأساس للصواب والحلقة الداخلية للمخططين:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

كلما قال شخص ما "العمل القيمة المثلى" ، يعنى "نقطة DP ثابتة". عندما ترى $V^{\ast}$أو$Q^{\ast}$في ورقة، تخيل هذه الحلقة.

## أرسله

إبقوا`outputs/skill-dp-solver.md`:

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

## التمارين

1. **Easy.**إدارة التكرار القيمة على شبكة 4 × 4 العالم مع $\gamma \in \lbrace 0.9, 0.99 \rbrace$كم عدد المراقبين حتى$\max \lvert \Delta V \rvert < 10^{-6}$طباعة$V^{\ast}$كشبكة 4 × 4.
2. **Medium.**مقارنة التكرار السياسة مقابل التكرار القيم على الشبكة التجاري * ستوكاستيك * (احتمال التزلج `0.1`العد: المصفحات، ساعة الحائط، النهائي $V^{\ast}(0,0)$أيّها يتقارب أسرع في التكرار؟
3. **Hard.**إعداد تكرار سياسة معدلة: في خطوة التقييم، تشغيلها فقط $k$يُسحف بدلاً من التناغم$V^{\ast}(0,0)$خطأ vs$k$لـ$k \in \lbrace 1, 2, 5, 10, 50 \rbrace$ماذا يخبرك المنحنى عن التداول بين التقييم والتحسين؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## المزيد من القراءة

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) العرض القنوني للتكرار السياسي وتكرار القيمة.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) التعامل الصارم مع حجج خريطة التقلص.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) تكرار السياسة المعدل وتحليل التقارب.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/)ورقة التكرار الأصلية للسياسة.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html)الجسر من دبي إلى تقريبي دبي / عميق RL المستخدم في كل درس لاحقا.
