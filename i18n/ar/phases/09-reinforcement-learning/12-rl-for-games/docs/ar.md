# RL للألعاب  ألفا زيرو ، MuZero ، والعصر LLM-المنطق

> 1992: هزمت TD-Gammon أبطال البشر في اللعبة الخلفية مع TD نقية. 2016: هزمت AlphaGo Lee Sedol. 2017: هيمنت AlphaZero على الشطرنج والشوجي والجوا من الصفر. 2025: أثبت DeepSeek-R1 نفس الوصفة ، مع استبدال GRPO PPO ، يعمل على التفكير. الألعاب هي المعيار الذي يقود كل اختراق في هذه المرحلة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## المشكلة

اللعب لديه كل ما يريده RL. مكافأة نظيفة (الفوز / الخسارة). حلقات لا نهاية لها (إعادة تعيين اللعب الذاتي). محاكاة مثالية (اللعبة * هي * المحاكاة). مساحات عمل متواصلة أو صغيرة. بنية متعددة العملاء التي تدفع قوة العداوة.

واللعب هو كيف كل اختراق رلي رئيسية تم اختبارها. (بيكغامون، 1992). أتاري-دي كيو إن (2013). ألفاغو (2016) ألفا زيرو (2017). OpenAI Five (دوتا 2، 2019). ألفا ستار (ستار كرافت II، 2019). موزرو (نموذج متعلم، 2019). الفا تينزور (تضاعف المصفوفة، 2022). ألفا ديف (ال خوارزميات التفرقة، 2023). DeepSeek-R1 (الاعتقاد الرياضي، 2025)  أحدث إثبات أن تقنيات اللعبة-RL تعمل على النص.

هذه الحجر الرئيسي يستطلع ثلاث معمارات هامة  ألفا زيرو، موزيرو، و GRPO  من خلال عدسة موحدة واحدة: **self-play + search + policy improvement**. كل منهما يعملي ما سبق؛ وبالأخص GRPO هو وصفة ألفا زيرو المطبقة على التفكير في ماجستير في مجال القانون، مع الرموز كعملات والتحقق الرياضي كإشارة الفوز.

## المفهوم

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**الفضة وغيرها. في اللعبة (الشطرنج، الشوجي، الجو) مع قواعد معروفة:

- شبكة القيمة السياسية: برج واحد $f_\theta(s) \to (p, v)$. .$p$هو مقدم على التحركات القانونية.$v$هو النتيجة المتوقعة من اللعبة.
- البحث عن شجرة مونت كارلو (MCTS): في كل خطوة، توسع شجرة من المواصلات المحتملة. استخدام $(p, v)$كـ "المركز السابق + التشغيل". اختر العقدات حسب UCB (PUCT): $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$. . .
- لعب الذاتي: لعب ألعاب عميل ضد عميل.$t$، توزيع زيارات المكثولات$\pi_t$يصبح هدف التدريب السياسي.
- الخسارة:$L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$. .$z$هو نتيجة اللعبة (+1 / 0 / -1).

صفر معارف بشرية، صفر هيرستيات صناعية يدوياً وصفة واحدة تتقن الشطرنج، الشوجي، والذهاب بعد عدة عشرات الملايين من ألعاب اللعب الذاتي

**MuZero (2019).**إزالة الاحتياج من معرفة القواعد

- بدلاً من بيئة ثابتة، تعلم نموذج ديناميكي متخفي$(h, g, f)$:
  - $h(s)$: تشفير الملاحظة إلى حالة غامضة.
  - $g(s_{\text{latent}}, a)$: التنبؤ بالحالة الخفية القادمة + المكافأة.
  - $f(s_{\text{latent}})$: التنبؤ بالسياسة السابقة + القيمة.
- يُجري MCTS في الفضاء الخفي المُتعلّم نفس البحث، نفس حلقة التدريب.
- يعمل على الجو، الشطرنج، الشوجي * و * أتاري  خوارزمية واحدة، لا معرفة القواعد.

**Stochastic MuZero (2022).**يضيف الديناميكيات الاستوكاسية وعقدات العرض؛ يمتد إلى ألعاب فئة اللعب الخلفي.

**Muesli, Gumbel MuZero (2022-2024).**تحسينات في كفاءة العينات والبحث الدستري.

**GRPO (2024-2025).**وصفة DeepSeek-R1 نفس الحلقة ذات شكل ألفا زيرو، تطبق على التفكير نموذج اللغة:

- "العاب": الإجابة على مشكلة الرياضيات / التشفير / التفكير. "الفوز" = المؤكد (جوزات حالة الاختبار، تجازات الإجابة العددية) يعود 1.
- السياسة: ماجستير في مجال القانون. الإجراءات: الرموز. الحالة: السرعة + الاستجابة-حتى الآن.
- لا نقاد (مثل "PPO" $V_\phi$) بدلاً من ذلك، لكل إشارة، عينة$G$إكمالات من السياسة حساب مكافأة لكل واحد**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$كإشارة لتحديث على النمط REINFORCE.
- عقوبة KL إلى سياسة مرجعية لمنع الانحراف (مثل RLHF).
- الخسارة الكاملة:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

لا نموذج مكافأة تعلم، لا نقاد، لا MCTS. يقدم المؤكد القائم على القواعد المكافأة، ويستبدل خط الأساس المتعلق بالجماعة النقدي، ويتم إسقاط خطوة البحث. يطابق أو يتجاوز جودة PPO-RLHF على معايير التفكير في جزء صغير من الحساب.

**The R1 recipe in full.**DeepSeek-R1 (DeepSeek 2025) هو نموذجين في ورقة واحدة:

- **R1-Zero.**البدء من النموذج الأساسي DeepSeek-V3. لا SFT. تطبيق GRPO مباشرة مع عنصرين مكافأة: * مكافأة الدقة * (قاعدة قائمة  هل الجواب النهائي تحليل إلى الرقم الصحيح / هل اجتاز رمز اختبارات الوحدة) و * مكافأة النموذج * (هل استكمال لفصل سلسلة التفكير في `<think>…</think>`على مدى آلاف الخطوات، يزداد متوسط طول الاستجابة من ~100 إلى ~10,000 رمز وترتفع درجات مقياس الرياضيات إلى مستويات قريبة من o1 . يتعلم النموذج التفكير من الصفر. الجانب السلبي: أن سلسلة أفكاره لا يمكن قراءتها غالبًا ، وتختلط اللغات ، ونقص النموذجية.
- **R1.**إصلاح مشاكل القراءة R1-Zero مع خط أنابيب أربعة مراحل:
  1. **Cold-start SFT.**جمع بضعة آلاف من المظاهرات طويلة من CoT مع تنسيق نظيف، وراقب-تحسين النموذج الأساسي عليها. وهذا يوفر نقطة بداية قابلة للقراءة.
  2. **Reasoning-oriented GRPO.**تطبيق GRPO مع مكافآت الدقة + الشكل بالإضافة إلى مكافأة * التوافق اللغوي * لمنع تغيير الرمز.
  3. **Rejection sampling + SFT round 2.**قم بعمل نموذج من مسارات التفكير ~ 600K من نقطة تفتيش RL ، وابق فقط تلك التي لديها إجابات نهائية صحيحة و CoT القراءة ، وجمع مع ~ 200K غير مثالات SFT غير معقولة (الكتابة ، QA ، التعرف على الذات).
  4. **Full-spectrum GRPO.**جولة أخرى من المعلومات المتعلقة بالتحديد والتحديد تغطي كل من التفكير (المكافآت القائمة على القواعد) والتنسيق العام (المكافآت القائمة على تفضيل المفيدية/الغير الضارة).

النتيجة تتطابق مع o1 على AIME و MATH-500 عند الوزن المفتوح ، وهي صغيرة بما فيه الكفاية لتحلية. نفس الورقة أيضاً تطلق ستة نماذج كثيفة محلية (Qwen-1.5B إلى Llama-70B) عن طريق SFT'ing على آثار التفكير R1  لا RL لدى الطالب. تحلية معلم RL قوية تضرب باستمرار RL من الصفر على مقياس الطالب.

**Why GRPO instead of PPO for reasoning.**ثلاثة أسباب في ورقة DeepSeekMath (فبراير 2024): (1) لا شبكة قيمة لتدريب، وتقليل الذاكرة؛ (2) يدير خط الأساس المجموعة بشكل طبيعي مكافأة نهاية المسار النادرة التي تنتجها مهام التفكير؛ (3) يجعل التطبيع على الفور مزايا مقارنة عبر مشاكل صعوبة مختلفة للغاية، والتي لا يمكن للمنتقد الوحيد لـ PPO أن يفعل.

**Search-free vs search-based.**اللعبات تمت إشراكه:

- *لعبات المعلومات المثالية مع آفاق طويلة* (ذهب، الشطرنج): لا تزال قائمة على البحث. يهيمن ألفا زيرو / موزيرو.
- * التفكير في إدارة الدراسة العلمية*: لا توجد MCTS في الإنتاج بعد؛ GRPO على التنفيذ الكامل، أفضل من N للحسابات الاستنتاجية.

```figure
f3-selfplay-ladder
```

## بناءها

الرمز في`code/main.py`أدوات **GRPO in miniature**: القاتل مع مجموعات متعددة من العينات. ال خوارزمية هي نفسها على ماجستير في العلوم التدريبية؛ إلا أن السياسة والبيئة أسهل. فإنه يعلم * الخسارة* والفائدة النسبية للجماعة*، والتي هي الابتكار 2024 من DeepSeekMath.

### الخطوة الأولى: بيئة تحقيقة صغيرة

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

في GRPO الحقيقي يقوم المؤكد بإجراء اختبارات وحدة أو التحقق من المساواة الرياضية.

### الخطوة 2: السياسة: softmax على رموز الرد K لكل طلب

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

يعادل الناتج النهائي للقاعدة العليا المشتركة على الإستعراض.

### الخطوة الثالثة: أخذ العينات في المجموعة والفائدة النسبية للجماعة

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

الميزة النسبية للجماعة هي خدعة 2024 DeepSeek. لا حاجة للمنتقد. "المرحلة الأساسية" هي متوسط المجموعة، وتستخدم التطبيع مجموعة std.

### الخطوة الرابعة: مقارنة مع خطة الأساسية لـ REINFORCE (بدون قيمة)

نفس الإعداد، نفس الحساب، مجرد تعزيز، جرويبو يتقارب أسرع وأكثر استقرارًا.

### الخطوة 5: ملاحظة الإنتروبي و KL

نفس التشخيصات مثل RLHF: متوسط KL للإشارة، الإنتروبي السياسي، مكافأة فوق الوقت. بمجرد أن تستقر هذه، يتم التدريب.

## الفخاخ

- **Reward hacking via verifier gaming.**ورثت شركة GRPO مخاطر RLHF: إذا كان المحقق خاطئًا أو يمكن استغلاله، فسوف يجد LLM الاستغلال.
- **Group size too small.**التباين في متوسط المجموعة$1/G$(خطأها القياسي مثل$1/\sqrt{G}$أدناه$G = 4$إشارة الميزة ضوضاء ، اختيار القياس هو$G = 8$إلى 64
- **Length bias.**إكمالات LLM من أطول مختلفة لها احتمالات سجل مختلفة. عادي من خلال عدد الرمز، أو استخدام مستوى التسلسل سجل-بصيرة، أو تقسيم إلى أقصى طول.
- **Pure self-play cycles.**يمكن أن يعلق التدريب على النمط الألفازي في حلقات الهيمنة في ألعاب الجملة العامة. يتم تخفيف ذلك من قبل مجموعة متنوعة من المعارضين (لعب الدوري، الدروس 10).
- **Search-policy mismatch.**يقوم ألفا زيرو بتدريب السياسة لتحاكي نتائج البحث. إذا كان شبكة السياسة صغيرة جداً لتمثيل توزيع البحث، فإن التدريب يتوقف.
- **Compute floor.**تحتاج MuZero / AlphaZero إلى حوسبة ضخمة. عادة ما تكون عملية إزالة واحدة مئات ساعات GPU. توجد ديموات صغيرة (مثل AlphaZero على Connect Four) للتعلم.
- **Verifier coverage.**اختبارات الوحدة التي تمت مع حل الحذاء تعزز الحذاء تصميم المحققين الذين يلتقطون الحالات الحافة.

## استخدمها

المشهد لعبة 2026 - RL ، حسب المجال:

| Domain | Dominant method |
|--------|-----------------|
| Two-player zero-sum board games (Go, chess, shogi) | AlphaZero / MuZero / KataGo |
| Imperfect info card games (poker) | CFR + deep learning (DeepStack, Libratus, Pluribus) |
| Atari / pixel games | Muesli / MuZero / IMPALA-PPO |
| Large multiplayer strategy (Dota, StarCraft) | PPO + self-play + league (OpenAI Five, AlphaStar) |
| LLM math/code reasoning | GRPO (DeepSeek-R1, Qwen-RL, open replications) |
| LLM alignment | DPO / RLHF-PPO (not GRPO; verifier is preference not verifiable) |
| Robotics | PPO + DR (not game-RL, but uses same policy-gradient tools) |
| Combinatorial problems | AlphaZero variants (AlphaTensor, AlphaDev) |

*الوصفة*  لعب الذاتي، التحسين المزدوج بالبحث، تنسخ السياسات  يتجاوز النص، البيكسلات، والتحكم المادي. GRPO هي أصغر مثال؛ المزيد قادمة.

## أرسله

إبقوا`outputs/skill-game-rl-designer.md`:

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## التمارين

1. **Easy.**تنفيذ القاتل GRPO في `code/main.py`. تدريب على 2 طلبات × 4 رموز الإجابة كل. التقارب في < 1000 تحديثات مع $G=8$. . .
2. **Medium.**قم بتقارن كفاءة العينة وتباين الجائزة مع جروبو على نفس القاتل
3. **Hard.**تمديد إلى "سلسلة التفكير" طويلة-2: يقوم الوكيل بإصدار رموز اثنين ويمكّن المؤكد من مكافأة الزوج. قياس كيفية تعامل GRPO مع تعيين الائتمان عبر تسلسل خطويين. (تلميح: ميزة مجموعة الحساب لكل *سلسلة كاملة*، انتشر إلى كلا المراكز الرمزية).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | Monte Carlo Tree Search; UCB1/PUCT selection with learned $(p, v)$ priors. |
| AlphaZero | "Self-play + MCTS" | Policy-value net trained to match MCTS visits and game outcome. |
| MuZero | "Learned-model AlphaZero" | Same loop but in latent space via learned dynamics. |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization; REINFORCE with group-mean baseline + KL. |
| PUCT | "AlphaZero's UCB" | $Q + c \cdot p \cdot \sqrt{N} / (1 + N_a)$ — balances value estimate with prior. |
| Self-play | "Agent vs past self" | Standard for zero-sum; symmetric training signal. |
| League play | "Population-based self-play" | Past + current + exploiters sampled as opponents. |
| Verifier reward | "Verifiable RL" | Reward comes from a deterministic checker (tests pass, answer matches). |
| Process reward | "PRM" | Scores each reasoning step, not just the final answer. |

## المزيد من القراءة

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270). . .
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404). . .
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4). . .
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z). . .
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) الورقة التي أدخلت GRPO والخط الأساسي المتعلق بالجماعة.
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) وصفة R1 كاملة من أربع مراحل بالإضافة إلى إزالة R1-Zero.
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) CFR + التعلم العميق على نطاق واسع.
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)-الورقة التي بدأت كل شيء
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) مرجع الإنتاج لتطبيق GRPO مع وظائف مكافأة مخصصة.
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) نسخة مفتوحة من وصفة R1 على مقياسات متعددة.
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) إطار الكتب المدرسية لللعب الذاتي والبحث وال "مكافأة المصممة" التي يوضحها R1 على مستوى LLM.
