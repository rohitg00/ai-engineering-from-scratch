# شبکه های Q عمیق (DQN)

> 2013: Mnih یک شبکه Q-learning را بر روی پیکسل های خام آموزش داد، هر عامل RL کلاسیک را در هفت بازی Atari شکست داد. 2015: گسترش به 49 بازی، منتشر شده در طبیعت، عصر عمیق RL را آغاز کرد. DQN Q-learning به علاوه سه ترسه است که عملکرد تقرب را پایدار می کند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## مشکل

آموزش Q تابلو برای هر جفت (حالت، عمل) به یک مقدار Q جداگانه نیاز دارد. یک تخت شطرنج دارای ~1043 حالت است. یک فریم Atari 210 × 160 × 3 = 100،800 ویژگی است. RL تابلو در هزاران حالت، نه چندان میلیاردها می میرند.

راه حل در گذشته واضح است: جایگزین کردن جدول Q با یک شبکه عصبی،$Q(s, a; \theta)$اما آشکار در پس منظر دهه ها طول کشید. نزدیک شدن عملکرد ساده با یادگیری Q در زیر "تریان مرگبار" تفاوت دارد.

1. **Experience replay**انتقال ها را تحریف می کند.
2. **Target network**هدف باز کردن رو منجمد ميکنه
3. **Reward clipping**اندازه گرادینت را عادی می کند.

DQN در آتاری اولین بار بود که یک معماری با یک مجموعه هیپر پارامتر حل ده ها مشکل کنترل از پیکسل های خام. همه چیز "داخلی-RL" ساخته شده از  DDQN، Rainbow، دوالنگ، توزیع، R2D2، Agent57  در بالای این سه ترفند پایه است.

## مفهوم

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**DQN از دست دادن TD یک مرحله ای در یک عملکرد Q عصبی به حداقل می رساند:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$= شبکه آنلاین، هر مرحله ای با کاهش گرادینت به روز می شود. $\theta^-$= شبکه هدف، به طور دوره ای از $\theta$(هر 10000 قدم)$D$= باز کردن باز کننده انتقال های گذشته

**The three tricks, in order of importance:**

**Experience replay.**يه بازنده حلقه`~10⁶`هر مرحله آموزش یک دسته کوچک را به صورت تصادفی نمونه می کند. این ارتباط زمانی را شکسته است (برنامه های متوالی تقریبا یکسان هستند) ، اجازه می دهد تا شبکه از تغییرات نادر و پاداش دهنده چندین بار یاد بگیرد و به روزرسانی های گرادیانتی متوالی را غیرقابل ارتباط می کند. بدون آن، TD در سیاست با یک شبکه عصبی در آتاری متفاوت است.

**Target network.**با استفاده از همان شبکه$Q(\cdot; \theta)$در هر دو طرف معادله بلمن هدف هر روز به حرکت می رسد  "تراشی از دم خود". راه حل: شبکه دوم را حفظ کنید $Q(\cdot; \theta^-)$با وزن هاي منجمد$C$قدم ها، کپی$\theta \to \theta^-$اين هدف بازپسين را براي هزاران مرحله گرادينتي در يك زمان ايجاد ميکنه$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(در DDPG، SAC استفاده می شود) یک نوع ساده تر هستند.

**Reward clipping.**اندازه پاداش آتاري از 1 تا 1000 + متفاوت است.$\lbrace-1, 0, +1 \rbrace$اشتباهه وقتي که اندازه پاداش مهمه، خوب براي آتاري که فقط علامت مهمه

**Double DQN.**Hasselt (2016) تعصب حداکثر سازی را حل می کند: از شبکه آنلاین برای *انتخاب* اقدام استفاده کنید، از شبکه هدف برای *مقدره* آن استفاده کنید.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

تعویض به صورت قطع، به طور مداوم بهتر است.

**Other improvements (Rainbow, 2017):**بازی مجدد اولویت بندی شده (نمونه های انتقال با خطا TD بالا بیشتر) ، معماری دویدن (مفرقی $V(s)$و سرای مزایندی) ، شبکه های سر و صدا (کشف آموخته) ، بازگشت مرحله n، Q توزیع (C51/QR-DQN) ، بوتسترپ چند مرحله ای. هر یک چند درصد اضافه می کند؛ سود تقریباً اضافی است.

```figure
f3-dqn-stability
```

## آن را بسازید

کد اینجا است stdlib فقط numpy free  ما از یک لایه مخفی MLP دستی در یک شبکه کوچک مداوم استفاده می کنیم، بنابراین هر مرحله آموزش در مایکرو ثانیه اجرا می شود. الگوریتم مشابه Atari DQN در مقیاس است.

### مرحله اول: بازخورد بازخورد

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

~106 ظرفیت برای آتاری، مانند DQN اصلی (این 50،000 انتقال را قبل از شروع یادگیری جمع آوری می کند) ؛ 5000 برای محیط بازی ما کافی است.

### مرحله دوم: یک شبکه کوچک Q (MLP دستی)

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

خط خطی → ReLU → خطی. این کل شبکه است.

### مرحله سوم: بروزرسانی DQN

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

شکل Q-تعلم از درس 04 با دو تفاوت: (a) ما به عقب از طریق یک متمایز$Q(\cdot; \theta)$به جای فهرست کردن یک جدول، ب) استفاده های هدف$Q(\cdot; \theta^-)$. .

### مرحله 4: حلقه بیرونی

برای هر قسمت، عمل کلاهبرداری$Q(\cdot; \theta)$، انتقال ها را به بفر فشار دهید، نمونه ای از یک دسته کوچک را انتخاب کنید، یک مرحله گرادینت را بردارید، به طور دوره ای همگام سازی کنید$\theta^- \leftarrow \theta$. الگوي:

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

در شبکه کوچک ما با حالت 16 بعدی یک گرم، مامور در حدود 500 قسمت یک سیاست تقریبا مطلوب را می آموزد. در آتاری، این را به 200 میلیون فریم افزایش دهید و یک استخراج کننده ویژگی CNN اضافه کنید.

## دام ها

- **Deadly triad.**تقریب تقریبی + خارج از سیاست + بوترسترینگ می تواند متفاوت باشد. DQN با هدف شبکه + تکرار کاهش می یابد؛ هیچ یک را حذف نکنید.
- **Exploration.**ε باید تجزیه شود، معمولاً از 1.0 تا 0.01 در اولین ~ 10% آموزش. بدون تحقیقات اولیه کافی شبکه Q به حوضچه محلی نزدیک می شود.
- **Overestimation.** `max`در تولید همیشه از دوگانه DQN استفاده کنید.
- **Reward scale.**پاداش ها را کلیک یا عادی سازی کنید؛ میزان گرادینت متناسب با میزان پاداش است.
- **Replay buffer coldstart.**تا وقتي که ببفر چند هزار تغيير داشته باشه تمرین نکن
- **Target sync frequency.**خیلی مکرر ≈ هیچ شبکه هدف؛ خیلی نادر ≈ اهداف قدیمی. Atari DQN از 10,000 قدم env استفاده می کند. قاعده عمومي: هر 1 / 100 افق آموزش را همبستگی کنید.
- **Observation preprocessing.**آتاری DQN 4 فریم را برای ایجاد حالت مارکوف جمع می کند. هر محیط با اطلاعات سرعت نیاز به فریم جمع یا حالت تکراری دارد.

## ازش استفاده کن

در سال 2026، DQN به ندرت پیشرفته است اما همچنان الگوریتم غیرسیاسی مرجع است:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

دروس هنوز در حال حرکت است. بازی مجدد و شبکه های هدف در SAC، TD3, DDPG، SAC-X، بفر بازی خودکار AlphaZero و هر روش RL غیر فعال ظاهر می شود. کپی پاداش به عنوان نرمال سازی مزیت در PPO ادامه می یابد. معماری طرح است.

## -باده

پس از`outputs/skill-dqn-trainer.md`:

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

## تمرینات

1. **Easy.**فرار کن`code/main.py`.خط خطي از هر قسمت بازي ميکنه چند تا قسمت تا متوسط اجرا -10 رو به دست بياره؟
2. **Medium.**شبکه هدف را غیرفعال کنید (از شبکه آنلاین برای هر دو طرف هدف بلمن استفاده کنید). عدم ثبات تمرین را اندازه گیری کنید  آیا بازگشت نوسان یا انحراف دارد؟
3. **Hard.**اضافه کردن دوگانه DQN: از شبکه آنلاین برای انتخاب استفاده کنید `argmax a'`, هدف شبکه برای ارزیابی.`Q(s_0, best_a)`در مقابل حقیقت$V^{\ast}(s_0)$بعد از 1000 قسمت با و بدون Double DQN در یک جریید ورلد با جریید

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) مقاله ورشکست 2013 NeurIPS که شروع به RL عمیق کرد.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) مقاله "نایتچر" ، 49 بازی DQN
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581) دوال DQN
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298)-کاغذ تکه تکه
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) درمان کتاب درسی از "تریان مرگبار" (تقریباً عملکرد + بوتسترپینگ + خارج از سیاست) که شبکه هدف و بازخورد بازخورد DQN طراحی شده است برای تدارک.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) DQN یک فایل مرجع استفاده شده در مطالعات آبلاسیون؛ خوب برای خواندن در کنار نسخه از نو از این درس.
