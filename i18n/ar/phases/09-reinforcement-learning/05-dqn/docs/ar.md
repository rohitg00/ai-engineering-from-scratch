# شبكات Q العميقة (DQN)

> 2013: تدرب Mnih شبكة Q-تعلم على البيكسل الخام، هزمت كل وكيل RL كلاسيكي على سبعة ألعاب Atari. 2015: تمتد إلى 49 لعبة، نشرت في الطبيعة، أطلقت عصر العميقة RL. DQN هو Q-تعلم بالإضافة إلى ثلاث حيل تجعل التقريب الوظيفي مستقرة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## المشكلة

يتطلب تعلم Q الجدولي قيمة Q منفصلة لكل زوج (حالة ، عمل). لوح الشطرنج لديه ~ 1043 حالة. إطار Atari هو 210 × 160 × 3 = 100,800 ميزة. يموت RL الجدولي في آلاف الحالات ، ناهيك عن المليارات.

والإصلاح واضح في الماضي: استبدال جدول Q بشبكة عصبية،$Q(s, a; \theta)$لكن عملية التعرف على الوظائف الواضحة في الخلف استغرق عقود. يختلف التقريب المميز مع تعلم Q تحت "ثلاثة مميتة"  التقريب الوظائف + التشغيل + التعلم خارج السياسة. حدد Mnih et al. (2013, 2015) ثلاثة حيل هندسية تحافظ على التعلم:

1. **Experience replay**يُفصل بين الانتقالات.
2. **Target network**يجمد الهدف من إطلاق القيادة
3. **Reward clipping**يُعادِلُ أحجام التراجع.

كانت DQN على Atari هي المرة الأولى التي تحل فيها بنية واحدة مع مجموعة مفاتيح خارقة واحدة عشرات المشاكل التحكمية من البيكسلات الخام. كل شيء "عميق-RL" تم بناؤه منذ DDQN ، Rainbow ، Dueling ، Distribution ، R2D2 ، Agent57  يتم تجميعه فوق هذه القاعدة الثلاثية.

## المفهوم

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**DQN يقلل من خسارة TD خطوة واحدة على وظيفة Q العصبية:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$= شبكة الإنترنت، تحديث كل خطوة بالتراجع. $\theta^-$= شبكة المستهدفة، يتم نسخها بشكل دوري من $\theta$(كل 10000 خطوة)$D$= تعيد تعزيز الانتقالات الماضية.

**The three tricks, in order of importance:**

**Experience replay.**حلقة عازلة من`~10⁶`التحولات. كل خطوة تدريبية تعرض مجموعة صغيرة بشكل متساوي عشوائي. هذا يكسر التواصل الزمني (الإطارات المتتالية متطابقة تقريبًا) ، ويسمح للشبكة بالتعلم من التحولات النادرة المثمرة عدة مرات ، ويقوم بتحديثات التراجع المتتالية. بدون ذلك ، تختلف التد في السياسة مع شبكة عصبية على أتاري.

**Target network.**باستخدام نفس الشبكة$Q(\cdot; \theta)$على جانبي معادلة بيلمان يجعل الهدف يتحرك كل تحديث  "المتابعة ذيلك".$Q(\cdot; \theta^-)$مع الأوزان المجمدة.$C$خطوات، نسخة $\theta \to \theta^-$هذا يُثبت هدف التراجعة لآلاف الخطوات المرتفعة في وقت واحد$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(مستخدم في DDPG، SAC) هي نوع أكثر سلاسة.

**Reward clipping.**مقياس مكافأة أتاري يختلف من 1 إلى 1000 +.$\lbrace-1, 0, +1 \rbrace$يمنع أي لعبة واحدة من السيطرة على المرجع خطأ عندما تكون حجم الجائزة مهمة، جيد لـ Atari حيث فقط التوقيع مهمة.

**Double DQN.**Hasselt (2016) تصحيح تحيز القياس القصوى: استخدام الشبكة على الإنترنت لـ * اختيار * الإجراء ، والشبكة المستهدفة لـ * تقييم * له.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

استبدال التسجيل، أفضل بشكل ثابت، استخدميه بشكل افتراضي

**Other improvements (Rainbow, 2017):**إعادة التمثيل ذات الأولوية (مثل عدة عمليات انتقالية عالية التلفزيون) ، معمارة المواجهة (فصل $V(s)$و الرؤوس المفيدة) ، الشبكات الضوضاء (التنقيب المتعلم) ، عائدات خطوة n، Q التوزيعي (C51/QR-DQN) ، التشغيل متعدد الخطوات. كل واحد يضيف بضع في المئة؛ والمكاسب تقريبا إضافية.

```figure
f3-dqn-stability
```

## بناءها

الرمز هنا هو stdlib فقط خالية من النمبي  نستخدم MLP المتحركة اليدوية ذات الطبقة الواحدة المخفية على شبكة الإنترنت المستمرة الصغيرة، لذلك كل خطوة تدريبية تعمل في ميكروثانية. الخوارزمية هي نفس Atari DQN على النطاق.

### الخطوة 1: تعبئة إعادة

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

~106 قدرة لـ Atari، كما هو الحال في DQN الأصلي (يتجمع 50،000 انتقال قبل بدء التعلم) ؛ 5000 يكفي لتغطية بيئة الألعاب لدينا.

### الخطوة الثانية: شبكة Q الصغيرة (MLP اليدوية)

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

الممر الأمامي: خطي → ريلو → خطي. هذا هو الشبكة بأكملها.

### الخطوة الثالثة: تحديث DQN

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

الشكل هو Q-التعلم من الدروس 04 مع اختلافين: (أ) نحن نراجع من خلال التفريق $Q(\cdot; \theta)$بدلاً من تحديد جدول، (ب) استخدامات الهدف $Q(\cdot; \theta^-)$. . .

### الخطوة الرابعة: الحلقة الخارجية

لكل حلقة، تصرف بـ "الجشع"$Q(\cdot; \theta)$، دفع الانتقالات إلى العازلة، عينة مجموعة صغيرة، اتخاذ خطوة تراجعة، التزام المزامنة بشكل دوري $\theta^- \leftarrow \theta$النمط:

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

على شبكة الإنترنت الصغيرة لدينا مع حالة واحدة ساخنة 16 غطاء، العميل يتعلم سياسة مثالية تقريبا في حوالي 500 حلقة. على أتاري، نطيل هذا إلى 200 مليون إطار وإضافة إضافة CNN ميزة استخرج.

## الفخاخ

- **Deadly triad.**يمكن أن تختلف تقارب الوظيفة + خارج السياسة + إطلاق التشغيل. DQN تخفيف مع شبكة الهدف + إعادة تشغيل؛ لا تُزيل أي منها.
- **Exploration.**يجب أن يتحلل ε، عادةً من 1.0 إلى 0.01 خلال أول ~ 10% من التدريب. دون استكشاف مبكر كاف يتقارب شبكة Q إلى حوض محلي.
- **Overestimation.** `max`على Q الضوضاء هي التحيز الصعودي دائما استخدام DQN المزدوج في الإنتاج.
- **Reward scale.**كليف أو تعاديل المكافآت؛ حجم التراجع متناسب مع حجم المكافأة.
- **Replay buffer coldstart.**لا تتدرب حتى يكون لدى المضخّم بضعة آلاف من الانتقالات
- **Target sync frequency.**متكرر جدا ≈ لا شبكة هدف ؛ نادر جدا ≈ أهداف قديمة. Atari DQN يستخدم 10,000 خطوات env. قاعدة عامة: مزامنة كل ~1/100 من آفاق التدريب.
- **Observation preprocessing.**تقوم شركة Atari DQN بتجميع 4 إطارات لتكون حالة Markov. أي بيئة مع معلومات السرعة تحتاج إلى إطارات أو حالة متكررة.

## استخدمها

في عام 2026، نادرا ما تكون DQN حديثة، ولكنها تظل خوارزمية مرجعية خارج السياسة:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

لا تزال الدروس في السفر. تظهر إعادة التشغيل والشبكات المستهدفة في SAC ، TD3 ، DDPG ، SAC-X ، حافظة لعب الذاتية في AlphaZero ، وجميع أساليب RL غير متصلة بالإنترنت. تعيش قصف الجوائز كطبيعية فائدة في PPO. الهندسة المعمارية هي الخطوط المخططة.

## أرسله

إبقوا`outputs/skill-dqn-trainer.md`:

```markdown
---
name: dqn-trainer
description: Produce a DQN training config (buffer, target sync, ε schedule, reward clipping) for a discrete-action RL task.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Given a discrete-action environment (observation shape, action count, horizon, reward scale), output:

1. Network. Architecture (MLP / CNN / Transformer), feature dim, depth.
2. Replay buffer. Capacity, minibatch size, warmup size.
3. Target network. Sync strategy (hard every C steps or soft τ).
4. Exploration. ε start / end / schedule length.
5. Loss. Huber vs MSE, gradient clip value, reward clipping rule.
6. Double DQN. On by default unless explicit reason to disable.

Refuse to ship a DQN with no target network, no replay buffer, or ε held at 1. Refuse continuous-action tasks (route to SAC / TD3). Flag any reward range > 10× per-step mean as needing clipping or scale normalization.
```

## التمارين

1. **Easy.**أركض`code/main.py`-سحب منحنى العودة لكل حلقة كم حلقة حتى تتجاوز المتوسط المتجاري -10؟
2. **Medium.**تعطيل شبكة الهدف (استخدم شبكة الإنترنت على جانبي هدف بيلمان). قياس عدم استقرار التدريب  هل تتذبذب العودة أو تختلف؟
3. **Hard.**إضافة DQN مزدوج: استخدم الشبكة على الانترنت لتحديد `argmax a'`، والهدف الشبكة لتقييم. مقارنة التحيز من`Q(s_0, best_a)`مقابل الحقيقة$V^{\ast}(s_0)$بعد 1000 حلقة مع مقابل دون DQN المزدوج على جريد ورلد مكافأة ضوضاء.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Q-learning with a neural Q-function, replay buffer, and target network. |
| Experience replay | "Shuffled transitions" | Ring buffer sampled uniformly each gradient step; decorrelates data. |
| Target network | "Frozen bootstrap" | Periodic copy of Q used in the Bellman target; stabilizes training. |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = no convergence guarantee. |
| Double DQN | "Fix for maximization bias" | Online net selects action, target net evaluates it. |
| Dueling DQN | "V and A heads" | Decompose Q = V + A - mean(A); same output, better gradient flow. |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional in one. |
| PER | "Prioritized Replay" | Sample transitions proportional to TD-error magnitude. |

## المزيد من القراءة

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602)ورقة ورشة العمل في 2013 NeurIPS التي بدأت العميقة RL.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236)ورقة "نايچر" ، 49 لعبة DQN.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581)-تزاحم (دي.ك.ان)
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298)ورقة الحيل المكتظة
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) التعامل في الكتب الدراسية مع "التلاثة المميتة" (تقريب الوظيفة + إطلاق + خارج السياسة) التي تم تصميم شبكة DQN المستهدفة ومحافظة إعادة التشغيل لتدميرها.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) إشارة DQN ملف واحد المستخدم في دراسات التخلص؛ جيد للقراءة جنبا إلى جنب مع إصدار هذا الدروس من الصفر.
