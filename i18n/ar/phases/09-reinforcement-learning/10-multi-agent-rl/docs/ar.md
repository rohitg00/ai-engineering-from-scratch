# الـ RL متعددة الوكلاء

> يفترض RL الوكيل الواحد أن البيئة ثابتة. وضع اثنين من عوامل التعلم في نفس العالم وتلك الافتراضات تنتهي: كل وكيل هو جزء من بيئة الآخر، وكلاهما يتغير. RL الوكيل المتعدد هو مجموعة من الحيل لجعل التعلم يتقارب عندما افتراض ماركوف لم يعد ينطبق.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## المشكلة

إن الروبوت الذي يتعلم كيفية التنقل في غرفة هو مشكلة RL لموكل واحد. فريق كرة القدم ليس كذلك. منافسين ألفا ستار مقابل ستار كرافت ليس كذلك. سوق من وكلاء العطاء ليس كذلك. سيارتان يتفاوضان على توقف أربعة طرق ليس كذلك. العديد من المشاكل في العالم الحقيقي ليست كذلك.

في كل بيئة متعددة الوكلاء، من منظور أي وكيل، الوكلاء الآخرين *هي* جزء من البيئة. مع تعلمهم وتغيير سلوكهم، تصبح البيئة غير ثابتة. تم انتهاك خاصية ماركوف "الدولة التالية تعتمد فقط على الحالة الحالية وعملي" لأن الدولة التالية تعتمد أيضا على ما اختارته العملاء الآخرون، وسياساتهم هي الهدف المتحرك.

هذا يكسر إثباتات التقارب الجدري (ضمان Q-learning يفترض بيئة ثابتة). إنه يكسر أيضًا RL عميقة ساذجة: يتطارد العاملون بعضهم البعض في حلقات ، لا يتقاربون أبداً إلى سياسة مستقرة. تحتاج إلى تقنيات متعددة العملاء: التدريب المركزي / التنفيذ اللامركزي ، خطوط أساسية معاكسة ، لعبة الدوري ، لعبة الذات.

تطبيقات 2026: حشود الروبوتات، توجيه المرور، أسطولات المركبات المستقلة، محاكاة السوق، أنظمة LLM متعددة الوكلاء (مرحلة 16) ، وأي لعبة تضم أكثر من لاعب ذكي واحد.

## المفهوم

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**تعاملية للمدنيات: الدول $S$، عمل مشترك $a = (a_1, \ldots, a_n)$، الانتقال$P(s' \mid s, a)$و مكافآت لكل عميل$R_i(s, a, s')$كل عميل$i$يزيد عائداتها بموجب سياساتها الخاصة$\pi_i$إذا كانت المكافآت متطابقة، فهي**fully cooperative**إذا كان الصفر المجموع، هو **adversarial**إذا كان مختلقاً، فهو كذلك**general-sum**. . .

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$من الوكيل$i$وجهة نظر يعتمد على$\pi_{-i}$، والذي يتغير
- **Credit assignment.**مع مكافأة مشتركة، أي وكيل أسببت به؟
- **Exploration coordination.**يجب على العملاء استكشاف استراتيجيات متكاملة، وليس استكشاف نفس الحالة بشكل زائد.
- **Scalability.**يزداد مساحة العمل المشترك بشكل متسارع في $n$. . .
- **Partial observability.**كل عميل يرى فقط مراقبته الخاصة؛ الحالة العالمية مخفية.

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**يتعلم كل عميل Q أو سياسة خاصة به، ويعامل الآخرين كجزء من البيئة. بسيط، في بعض الأحيان يعمل (وخاصة مع تجربة إعادة التعبير التي تعمل كحيلة نمذجة العميل السلسة). التقارب النظري: لا. في الممارسة العملية: جيد للمهام المرتبطة بشكل بطيء، سيء للمهام المرتبطة بشكل وثيق.

**2. Centralized training, decentralized execution (CTDE).**المثال الحديث الأكثر شيوعاً لكل وكيل سياسة خاصة به$\pi_i$هذه الشروط على الملاحظة المحلية$o_i$ تنفيذ مستوى لامركزي عند النشر. أثناء *التدريب* ، نقدي مركزي $Q(s, a_1, \ldots, a_n)$الشروط المتعلقة بالحالة العالمية الكاملة والعمل المشترك.
- **MADDPG**(لو وآخرون 2017): DDPG مع منتقد مركزي لكل وكيل.
- **COMA**(فوارستر وزملاء 2017): نقطة أساسية مُضادة للواقع  اسأل "ما كان مكافأتي لو اتخذت إجراءات $a'$بدلاً من ذلك؟"
- **MAPPO**- لا ، لا**IPPO**مع النقاد المشترك (Yu et al. 2022): PPO مع وظيفة قيمة مركزية. هيمنة في عام 2026 للمؤسسة التعاونية MARL.
- **QMIX**(Rashid et al. 2018): تدهور القيمة  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$مع خلط واحد.

**3. Self-play.**نسختان من نفس الوكيل يلعبون بعضها البعض. سياسة الخصم * هو سياسة من اللقطة السابقة. ألفاغو / ألفا زيرو / MuZero. مفتوحة خمسة. يعمل بشكل أفضل لعبة الصفر المجموعة؛ إشارة التدريب متماثلة.

**4. League play.**تمديد اللعب الذاتي إلى بيئات مجموعية / معادلة عامة: الحفاظ على سكان السياسات السابقة والحالية ، ومعينة خصم من الدوري ، وتدريب ضدهم. يضيف المستغلين (مخصصين في هزيمة أفضل الحالي) والمستغلين الرئيسيين (مخصصين في هزيمة المستغلين). ألفا ستار (ستار كرافت II). مطلوب عندما تعترف اللعبة "حلقة استراتيجية ورقة ورق-قصان".

**Communication.**اسمحوا للعملاء بإرسال رسائل علمية$m_i$في عام 2016، أظهرت فورستر وآخرون أن التواصل بين الوكلاء يمكن تدريبه من نهاية إلى نهاية. أنظمة القانون الجامعي اليوم القائمة على العديد من الوكلاء (المرحلة 16) تتواصل بشكل أساسي باللغة الطبيعية.

```figure
f3-marl-orbit
```

## بناءها

تستخدم هذه الدروس شبكة 6 × 6 مع اثنين من العملاء التعاونيين. يبدأون في زوايا معادلة ويجب أن يصلوا إلى هدف مشترك. مكافأة مشتركة:`-1`كل خطوة بينما أي من العملاء ما زال يتحرك`+10`عندما يصل كلاهما`code/main.py`. . .

### الخطوة الأولى: بيئة متعددة الوكلاء

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

مساحة العمل المشتركة هي`|A|² = 16`الدولة العالمية هي موقفين

### الخطوة الثانية: تعلم Q المستقل

كل وكيل يدير جدول Q الخاص به المفتاح على حالة مشتركة. في كل خطوة: كل من اختيار عمل ε-شريعة، جمع الانتقال المشترك، كل تحديث Q الخاص به مع مكافأة مشتركة.

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

يعمل على هذه المهمة لأن المكافآت كثيفة ومُتوازنة. يفشل في المهام المرتبطة ارتباطًا وثيقًا (على سبيل المثال، حيث يجب على وكيل واحد * الانتظار* للآخر).

### الخطوة 3: Q مركزية مع تحديث القيمة المتحللة

استخدموا Q واحد على الإجراءات المشتركة $Q(s, a_1, a_2)$تحديث من مكافأة مشتركة . تحويل اللوائح عند التنفيذ عن طريق تجاهل: $\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$. يتداول مساحة العمل المشتركة المتقدمة من أجل رؤية عالمية *صحيحة*

### الخطوة الرابعة: لعبة بسيطة (العدو المضاد)

نفس العميل، دوران، العميل "أ" ضد العميل "ب"$K$التدريب التناظير، التقدم المتواصل وصفة ألفا زيرو في التفاصيل

## الفخاخ

- **Non-stationary replay.**تجربة إعادة التعب مع وكلاء مستقلين أسوأ من وكيل واحد لأن الانتقالات القديمة تم إنشاؤها من قبل خصوم قديمة الآن.
- **Credit assignment ambiguity.**مكافأة مشتركة بعد حلقة طويلة؛ لا توجد طريقة واضحة لقول أي وكيل ساهم.
- **Policy drift / chasing.**كل وكيل أفضل استجابة تتغير مع تحديث الآخر. إصلاح: النقاد المركزي، بطيئة معدلات التعلم، أو تجميد واحد في وقت واحد.
- **Reward hacking via coordination.**العاملون يجدون عمليات تنسيق لم يتوقعها المصمم، وكلاء المزاد يتقاربون إلى الصفر، تصحيح: تصميم مكافأة حذرا، قيود سلوكية.
- **Exploration redundancy.**كلتا العملاء يستكشفون نفس أزواج العمل الحالي، تحديد: مكافآت الإنتروبي لكل عميل، أو تكييف الدور.
- **League cycles.**اللعب الذاتي النقي يمكن أن يعلق في دورة هيمنة
- **Sample explosion.** `n`عوامل × مساحة الحالة × إجراءات مشتركة. تقريبي مع تقريب الوظيفة؛ مساحات العمل المفصلة (رأس إخراج سياسة واحد لكل عامل).

## استخدمها

خريطة طلبات MARL لعام 2026:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

في عام 2026، أكبر مجال نمو لـ MARL هو القائم على LLM: حشود من وكلاء نموذج اللغة يتفاوضون، ويدبرون، ويبنيون البرمجيات. تظهر RL كتحسين تفضيل على * مستوى المسار* المخرجات، وليس على مستوى الرمز (المرحلة 16 · 03).

## أرسله

إبقوا`outputs/skill-marl-architect.md`:

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## التمارين

1. **Easy.**تدريب التعليم Q المستقل على تعاونية GridWorld 2 عملاء. كم حلقة حتى متوسط العودة > 0؟ رسم منحنى التعلم المشترك.
2. **Medium.**إضافة مهمة "التنسيق": يتم تحقيق الهدف فقط عندما يتجه كلا العاملين إليه في نفس المنحنى. هل ما زال Q المستقل يتقارب؟ ما الذي ينتهي؟
3. **Hard.**تنفيذ ناقد مركزي للتدريب على طراز MAPPO ومقارنة سرعة التقارب مع PPO المستقلة في مهمة التنسيق.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## المزيد من القراءة

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) CTDE مع ناقد مركزي
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) أسس أساسية معادلة للتخصيص الائتمان.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) تدهور القيمة مع الوحدة.
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955)إن (بي بي أو) قوية بشكل مفاجئ بالنسبة لـ (مارل)
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)لعب الدوري على نطاق واسع
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)لعب ذاتي خالص في ألعاب الصفر
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) يتضمن التعامل المختصر في الكتاب الدراسي لتحديدات متعددة الوكلاء ومشكلة عدم الثبات التي تم تصميم CTDE لحلها.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) مسح يضم المشاريع التعاونية والتنافسية والمختلطة مع نتائج التقارب.
