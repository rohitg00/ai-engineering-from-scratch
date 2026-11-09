# RL چند عامل

> یک عامل RL فرض می کند که محیط ثابت است. دو عامل یادگیری را در یک جهان قرار دهید و این فرضیه شکسته می شود: هر عامل بخشی از محیط دیگری است و هر دو در حال تغییر هستند. RL چند عامل مجموعه ای از ترفند ها برای تبدیل یادگیری به هم می باشد زمانی که فرضیه مارکوف دیگر برقرار نیست.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## مشکل

یک ربات که می آموزد که در یک اتاق حرکت کند مشکل یک عامل RL است. یک تیم فوتبال نیست. مخالفان آلفا استار vs استار کرافت نیست. یک بازار از نمایندگان داوطلبی نیست. دو ماشین مذاکره یک توقف چهارراه نیست. بسیاری از مشکلات دنیای واقعی نیست.

در هر محیط چند عامل، از دیدگاه هر عامل، سایر عوامل * بخشی از محیط هستند. وقتی که آنها یاد می گیرند و رفتار خود را تغییر می دهند، محیط غیر ثابت می شود. ملک مارکوف  "دولت بعدی فقط به وضعیت فعلی و عمل من بستگی دارد"  نقض می شود زیرا دولت بعدی نیز به آنچه عوامل دیگر انتخاب کرده اند بستگی دارد و سیاست های آنها هدف های متحرک هستند.

این شکستن مدارک تراکنش جدول (ضمان Q-learning فرض می کند یک محیط ثابت است). این شکستن ساده عمیق RL: عوامل به دنبال یکدیگر در حلقه ها، هرگز به یک سیاست پایدار تراکنش. شما نیاز به تکنیک های چند عامل خاص: آموزش متمرکز / اجرای غیرمتمرکز، خط های اصلی معکوس، لیگ بازی، خود بازی.

برنامه های کاربردی 2026: سوره های ربات، مسیر ترافیک، ناوگان های اتوماتیک خودرو، شبیه سازهای بازار، سیستم های LLM چند عامل (فاز 16) و هر بازی با بیش از یک بازیکن هوشمند.

## مفهوم

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**یک عمومی سازی از MDP: دولت ها $S$، یک اقدام مشترک$a = (a_1, \ldots, a_n)$، انتقال$P(s' \mid s, a)$، و پاداش هر مامور$R_i(s, a, s')$. هر مامور$i$به حداکثر رساندن بازده خودش در چارچوب سیاست خودش$\pi_i$اگه پاداش ها همديگه باشه،**fully cooperative**اگه صفر جمع بشه، اونم**adversarial**اگه مخلوط باشه، درست ميشه**general-sum**. .

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$از مامور$i$نظر شما بستگی داره$\pi_{-i}$، که داره عوض ميشه
- **Credit assignment.**با پاداش مشترک، کدام عامل باعثش شد؟
- **Exploration coordination.**ماموران باید استراتژی های مکمل را کشف کنند نه به طور فرعی در مورد یک وضعیت مشابه.
- **Scalability.**فضای عمل مشترک به طور نمایی در $n$. .
- **Partial observability.**هر عامل فقط مشاهدات خودش رو می بیند؛ وضعیت جهانی پنهان شده

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**هر عامل Q یا سیاست خود را یاد می گیرد و دیگران را به عنوان بخشی از محیط می شناسد. ساده است، گاهی کار می کند (به ویژه با تکرار تجربه به عنوان یک ترفند مدل سازی عامل نرم کننده عمل می کند). کنورژن نظری: هیچ. در عمل: برای وظایف بسته بندی شل، خوب برای کارهای بسته بندی بد است.

**2. Centralized training, decentralized execution (CTDE).**رایج ترین پارادایم مدرن هر عامل دارای سیاست خودش است$\pi_i$که شرایط مشاهده محلی$o_i$ اجرای استاندارد غیرمتمرکز در زمان استفاده. در طول *تدريب* یک منتقد متمرکز $Q(s, a_1, \ldots, a_n)$شرایط وضعیت جهانی کامل و اقدامات مشترک.
- **MADDPG**(لو و همکاران 2017): DDPG با یک منتقد متمرکز در هر نماینده.
- **COMA**(Foerster et al. 2017): اصل اصل ضدفی  بپرسید "اگر اقدام می کردم پاداش من چه خواهد بود $a'$در عوض؟"  سهم من را جدا می کند.
- **MAPPO**-**IPPO**با منتقد مشترک (Yu et al. 2022): PPO با یک عملکرد ارزش متمرکز. در سال 2026 برای همکاری MARL غالب است.
- **QMIX**(Rashid و همکاران 2018): تجزیه ارزش  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$با مخلوط کردن یکسره.

**3. Self-play.**دو نسخه از همان عامل با یکدیگر بازی می کنند. سیاست مخالف *است* سیاست من از یک عکس گذشته. الفاگو / الفا زرو / MuZero. OpenAI پنج. بهترین کار برای بازی های صفر جمع است؛ سیگنال آموزش همتقارن است.

**4. League play.**گسترش خود بازی به محیط های عمومی / خصومت: نگه داشتن جمعیت از سیاست های گذشته و فعلی، نمونه یک مخالف از لیگ، آموزش در برابر آنها. اضافه استفاده کنندگان (تخصص در شکست بهترین فعلی) و استحصال کنندگان اصلی (تخصص در شکست استحصال کنندگان). AlphaStar (StarCraft II). مورد نیاز زمانی که بازی اجازه می دهد چرخه استراتژی "روک کاغذ-کاسیور".

**Communication.**اجازه بدين که ماموران پيام هاي آموخته رو بفرستند$m_i$Foerster et al. (2016) نشان داد که ارتباطات بین عوامل قابل تفاوتی می تواند از پایان به آخر آموزش داده شود. سیستم های چند عامل مبتنی بر LLM امروز (فاز 16) اساسا به زبان طبیعی ارتباط برقرار می کنند.

```figure
f3-marl-orbit
```

## آن را بسازید

این درس از یک 6 × 6 GridWorld با دو عامل همکاری استفاده می کند. آنها از گوشه های مخالف شروع می کنند و باید به یک هدف مشترک برسند. پاداش مشترک:`-1`در هر مرحله که هر دو مامور هنوز در حال حرکت هستند`+10`وقتي هر دو نفر به اينجا رسيدن`code/main.py`. .

### مرحله ی اول: محیط چند عامل

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

فضای عمل مشترک`|A|² = 16`دولت جهانی دو موقعیت است.

### مرحله دوم: یادگیری مستقل Q

هر عامل جدول Q خود را با کلید مشترک اجرا می کند. در هر مرحله: هر دو عمل های حریصی را انتخاب می کنند، انتقال مشترک را جمع آوری می کنند، هر یک از آنها Q خود را با پاداش مشترک به روز می کنند.

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

در این کار کار می کند زیرا پاداش ها چسب و هماهنگ هستند. در وظایف به شدت مرتبط (به عنوان مثال، جایی که یک عامل باید * منتظر* دیگری باشد) شکست می خورد.

### مرحله 3: Q متمرکز با بروزرسانی ارزش تجزیه شده

از یک Q در مقابل اقدامات مشترک استفاده کنید $Q(s, a_1, a_2)$. از پاداش مشترک به روز رسانی کنید . در اجرای توسط کنار گذاشتن:$\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$. تجارت فضاهای مشترک اکشن برای یک دیدگاه جهانی *صحيح*

### مرحله 4: بازی ساده (دو عامل مخالف)

همون مامور، دو نقش مامور قطار A با مامور B$K$قسمت ها، وزن هاي A رو به B نقل ميکنيم آموزش همتايي، پيشرفت ثابت

## دام ها

- **Non-stationary replay.**تجربه بازي با عوامل مستقل بدتر از واحد است چون انتقال های قدیمی توسط مخالفان قدیمی تولید شده است.
- **Credit assignment ambiguity.**پاداش مشترک پس از یک قسمت طولانی؛ هیچ راهی روشن برای گفتن اینکه کدام عامل کمک کرده است.
- **Policy drift / chasing.**بهترین پاسخ هر عامل با بروزرسانی هر دو تغییر می کند.
- **Reward hacking via coordination.**ماموران تلاش می کنند که کار های هماهنگ ای که طراح پیش بینی نکرده است انجام دهند. ماموران مزاد به صفر پیشنهاد می کنند. درست کردن: طراحی دقیق پاداش، محدودیت های رفتاری.
- **Exploration redundancy.**هر دو مامور هم به دنبال جفتي عمل ايستاده اند
- **League cycles.**بازی خالص خود می تواند در چرخه تسلط گیر شود.
- **Sample explosion.** `n`عوامل × فضای دولت × اقدامات مشترک. نزدیک با تقریب عملکرد؛ فضاهای عمل فاکتور شده (یک سر تولید سیاست در هر عامل).

## ازش استفاده کن

نقشه برنامه های کاربردی MARL 2026:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

در سال 2026، بزرگترین منطقه رشد MARL مبتنی بر LLM است: سوره های عامل مدل زبان مذاکره، بحث، ساخت نرم افزار. RL به عنوان بهینه سازی ترجیح در * سطح مسیر* محصولات، نه سطح توکن (فاز 16 · 03).

## -باده

پس از`outputs/skill-marl-architect.md`:

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

## تمرینات

1. **Easy.**آموزش آموزش Q مستقل در همکاری 2 عامل GridWorld. چند قسمت تا متوسط بازگشت > 0؟ منحنی یادگیری مشترک را نقشه بزنید.
2. **Medium.**یک کار "تنسانس" اضافه کنید: هدف تنها زمانی به دست می آید که هر دو عامل در یک نوبت بر روی آن قدم بزنند. آیا Q مستقل هنوز هم به هم نزدیک است؟ چه شکافی؟
3. **Hard.**یک منتقد متمرکز برای آموزش سبک MAPPO را پیاده سازی کنید و سرعت تقلب را با PPO مستقل در کار هماهنگی مقایسه کنید.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) CTDE با یک منتقد متمرکز
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) خط های پایه معکوس برای اعطای اعتبار.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) تجزیه ارزش با یکمنی
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955) PPO برای مارل شگفت آور است
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) بازی لیگ در مقیاس
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) بازی خالص در بازی های صفر جمع
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) شامل درمان کوتاه کتاب در مورد تنظیمات چند عامل و مشکل عدم ثابت بودن است که CTDE برای حل آن طراحی شده است.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) بررسی مربوط به همکاری، رقابت و MARL مخلوط با نتایج تقارب.
