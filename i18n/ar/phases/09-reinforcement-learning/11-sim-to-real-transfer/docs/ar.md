# نقل من سم إلى حقيقة

> سياسة تدرب في محاكاة تفشل في الأجهزة هي سياسة تذكرت المحاكاة. تعديل النطاقات العشوائية، وتكيف النطاقات، وتحديد النظام هي الأدوات الثلاثة لجعل المراقبين المتعلمين يعبرون الفجوة الواقعية.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## المشكلة

تدريب الروبوت الحقيقي بطيء وخطير و مكلف. يستغرق الروبوت الثنائي الملايين من حلقات التدريب لتعلم المشي؛ والروبوت الحقيقي الذي يسقط حتى لو كسرت الأجهزة. تمثل لك إعادة تعديل غير محدودة، وتكرارية تحديدية، بيئات متوازية، ولا ضرر جسدي.

لكن المحاكاة خاطئة. الحامل لديها مزيد من الاحتكاك من نماذج MuJoCo. الكاميرات لديها تشوه عدسة لا يضم المحاكاة. المحركات لديها تأخيرات، رد فعل عكسي، والشباعة التي تفوت 99٪ من نماذج سيم. الرياح، الغبار، والإضاءة المتغيرة تخريب سياسة تدرب على التسليم العقم.**reality gap** الفرق المنهجي بين توزيع السيم والتوزيع الحقيقي  هو المشكلة المركزية لتنفيذ RL للروبوتات.

تحتاج إلى سياسة * قوية لتحويل التوزيع من الوضع التجاري إلى الواقعي* ثلاثة نهج تاريخية: تعديل المحاكي (تقييم النطاقات عشوائية) ، وتكييف السياسة مع بعض البيانات الحقيقية (تكييف النطاقات / ضبط الدقيقة) ، أو تحديد معايير النظام الحقيقي وتطابقها (تعرف النظام). في عام 2026، يجمع الوصفة المهيمنة الثلاثة مع محاكاة متوازية ضخمة (إيزاك سيم، إيزاك لاب، موجوكو MJX على GPU).

## المفهوم

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**(توبين) وآخرون 2017، بينغ وآخرون عام 2018 أثناء التدريب، قم بتشغيل عشوائية كل ملامح محاكاة قد تختلف عن الروبوت الحقيقي: الكتلة، معايير الاحتكاك، مكاسب PD المحرك، ضجيج المستشعر، وضع الكاميرا، الإضاءة، النسيج، نماذج الاتصال. تتعلم السياسة توزيعا مشروطا على "ما هو سمة اليوم" وتقوم بتعميمها على امتداد المدى الكامل. إذا كان الروبوت الحقيقي يقع ضمن غلاف التدريب، فإن السياسة تعمل.

- **Upside:**لا حاجة إلى بيانات حقيقية وصفة واحدة، العديد من الروبوتات.
- **Downside:**التدريب المُتفرّغ بشكلٍ غير عشوائي يُنتج سياسةً "جامعيةً" ولكنها حذرة للغاية. ضجيجٌ كثيرٌ جداً ≈ تنظيمٌ كثيرٌ جداً.

**System Identification (SI).**قم بتكييف معايير المحاكي إلى بيانات العالم الحقيقي قبل التدريب. إذا كنت تستطيع قياس الاحتكاك المشترك على الروبوت الحقيقي، قم بتوصيل ذلك إلى الروبوت الحقيقي. ثم قم بتدريب سياسة تتوقع هذه القيم. تحتاج إلى الوصول إلى النظام الحقيقي ولكن تقلل الفجوة الواقعية مباشرة.

- **Upside:**هدف تدريب دقيق و منخفض الضوضاء
- **Downside:**خطأ النموذج المتبقية غير مرئية للسياسة؛ آثار صغيرة غير محددة (مثل الشريط الميت للسيارات) لا تزال تعطل النشر.

**Domain Adaptation.**تدريب في التشغيل التجهيزي، التنسيق الدقيق مع كمية صغيرة من البيانات الحقيقية.

- **Real2Sim2Real:**تعلم محاكاة البقايا$f(s, a, z) - f_{\text{sim}}(s, a)$باستخدام عمليات التشغيل الحقيقية، تدريب في التشغيل المحسّن يغلق الفجوة دون الكثير من البيانات الحقيقية.
- **Observation adaptation:**تدريب سياسة تقوم بتخريط المواقع الحقيقية من خلال محرك استخراج الميزات المكتسبة (مثل GAN من بكسل إلى بكسل). يبقى المحكم في sim.

**Privileged learning / teacher-student.**ميكي وزملاء 2022 (من نوعية أربعة أضعاف). تدريب * المعلم * في المحاكاة التي لديها إمكانية الوصول إلى المعلومات ذات الصلة (احتكاك الحقيقة الأرضية، ارتفاع الأرض، تجرف IMU). تحليل * الطالب * الذي يرى فقط مشاهدات الاستشعار الحقيقي. يتعلم الطالب استنتاج خصائص ذات الصلة من التاريخ، قوية عبر المعلمات الفيزيائية.

**Massively parallel simulation.**20242026 . Isaac Lab ، Mujoco MJX ، Brax جميعًا يعملون على آلاف الروبوتات المتوازية على GPU واحدة. PPO مع 4,096 humanoid متوازية يجمع سنوات من الخبرة في ساعات. "فجوة الواقع" تقلص مع توسيع توزيع التدريب ؛ يصبح DR تقريباً حرًا عندما يكون لكل من هذه ال 4,096 envs معايير عشوائية مختلفة.

**The real-world 2026 recipe (quadruped walking example):**

1. محاكاة متوازية بشكل كبير مع الجاذبية المرتبطة بالمنطقة ، الاحتكاك ، مكاسب المحرك ، الحمل المفيد
2. سياسة المعلمين المدربين مع المعلومات المميزة (خريطة الأرض، سرعة الجسم الحقيقة الأرضية).
3. سياسة الطلاب من المعلم باستخدام proprioception فقط (مخترفات مفصل الساقين).
4. التكيف الاختياري للملاحظة عبر جهاز تشفير ذاتي على جهاز IMU الحقيقي.
5. إن فشلت، قم بتحسين العالم الحقيقي بضع دقائق مع نظام البيانات المحدد

```figure
f3-reality-gap
```

## بناءها

رمز هذا الدروس هو مظاهرة صغيرة من عشوائية النطاقات على شبكة شبكة الإنترنت مع * صاخبة * انتقالات. نحن تدرب سياسة التي تجري احتمالات الانزلاق عشوائية في "سم" وتقييم على "الحقيقي" مع مستوى الانزلاق لم يرى أثناء التدريب. الخرائط الشكل مباشرة إلى نقل MuJoCo إلى الأجهزة.

### الخطوة 1: سم المعلم

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`في الروبوتات الحقيقية يمكن أن يكون الاحتكاك، الكتلة، مكاسب الحركات أي شيء يتحول بين المثالي والواقع.

### الخطوة الثانية: تدريب مع DR

في بداية كل حلقة، عينة`slip ~ Uniform[0.0, 0.4]`تدريب PPO / Q-تعلم / أي شيء. تفعل هذا لعدة حلقات.

### الخطوة الثالثة: تقييم الصفر على الرسائل "الحقيقية"

تقييم`slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`. الأربعة الأولى ضمن دعم التدريب`0.5`و`0.7`سياسة تدريب الدرجة الثالثة يجب أن تبقى شبه مثالية داخل الدعم وتتدهور بشكل لطيف خارجها سياسة تدريب ثابتة سليب سيكون هشة خارج سليب تدريبها.

### الخطوة الرابعة: مقارنة التدريب الضيق

قم بتدريب سياسة ثانية مع`slip = 0.0`فقط، تقييم على نفس`slip`يجب أن ترى انخفاضًا كارثيًا حالما يصل الانخفاض الحقيقي إلى 0.

## الفخاخ

- **Too much randomization.**القطار على`slip ∈ [0, 0.9]`و سياستك غير متخاطر جداً لا تحاول أبداً أن تجد الطريق الأمثل
- **Too little randomization.**تدريب على شريحة رقيقة والسياسة لا يمكن أن تعميم على الإطلاق. استخدام المناهج الدراسية التكيفية (المنطقة العشوائية الآلية) التي توسع التوزيع مع تحسن السياسة.
- **Misidentified parameter space.**إصطدام الشيء الخطأ (طين الكاميرا عندما يكون الفجوة الحقيقية تأخير محرك) و DR لا يساعد. تحليل الروبوت الحقيقي أولا.
- **Privileged info leakage.**يمكن للمعلم الذي يستخدم الحالة العالمية للأفعال وليس فقط للملاحظات أن ينتج طالبًا لا يستطيع التقاط وقته. تأكد من أن سياسة المعلم يمكن تحقيقها من قبل الطالب الذي يعطي تاريخ الملاحظة.
- **Sim-to-sim transfer failure.**إذا كانت سياسة التشغيل الخاصة بك غير قوية بالنسبة لمتغيرات التشغيل الأصعب، فإنه لن يكون قويا بالنسبة للعالم الحقيقي أيضا.
- **No real-world safety envelope.**سياسة تعمل في التشغيل التجاري و "تعمل في الواقع" دون درع السلامة منخفض المستوى يمكن أن تفشل الأجهزة. إضافة حدود سرعة، حدود الدوران، حدود المشتركة في جهاز تحكم غير متعلم.

## استخدمها

"المركز "المناسب إلى الواقع لعام 2026

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

للسيطرة على جميع المقاييس، فإن سير العمل متسق: تكييف المُقارنة بأفضل ما يمكنك، تطبيق عشوائي ما لا يمكنك إصلاحه، تدريب سياسات هائلة،

## أرسله

إبقوا`outputs/skill-sim2real-planner.md`:

```markdown
---
name: sim2real-planner
description: Plan a sim-to-real transfer pipeline for a given robot + task, covering DR, SI, and safety.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Given a robot platform, a task, and access to real hardware time, output:

1. Reality gap inventory. Suspected sources ranked by expected impact (contact, sensing, actuation delay, vision).
2. DR parameters. Exact list, ranges, distribution. Justify each range against real measurements.
3. SI steps. Which parameters to measure; measurement method.
4. Teacher/student split. What privileged info the teacher uses; what obs the student uses.
5. Safety envelope. Low-level limits, emergency stops, backup controller.

Refuse to deploy without (a) a zero-shot sim-variant test, (b) a safety shield, (c) a rollback plan. Flag any DR range wider than 3× measured real variability as likely over-randomized.
```

## التمارين

1. **Easy.**تدريب وكيل Q- تعلم على شبكة التزلج الثابت (التزلج = 0.0). تقييم على $\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$-عودة المؤامرة مقابل إزالة
2. **Medium.**تدريب عينة من الوكيل لتعلم الـ DR Q `slip ~ Uniform[0, 0.3]`. تقييم نفس التصفح. كم يشتري DR عند سليب=0.5 (خارج التوزيع) ؟
3. **Hard.**تنفيذ منهج: تبدأ من سليب=0.0، وتوسيع نطاق DR كلما وصلت السياسة إلى 90% من المثالي. قياس إجمالي خطوات البيئة للوصول إلى سليب=0.3 صفر-التقاط مقابل خط أساس DR ثابت.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | "Sim-to-real difference" | Distribution shift between training and deployment physics/sensing. |
| Domain randomization (DR) | "Train across random sims" | Randomize sim parameters during training so policy generalizes. |
| System identification (SI) | "Measure real and fit sim" | Estimate real physical parameters; set sim to match. |
| Domain adaptation | "Fine-tune on real data" | Small real-world fine-tune after sim training; may adapt obs or dynamics. |
| Privileged info | "Ground truth for teacher" | Information only the sim has; student must infer it from obs history. |
| Teacher/student | "Distill privileged -> observable" | Teacher trained with shortcuts; student learns to mimic without them. |
| ADR | "Automatic Domain Randomization" | Curriculum that widens DR ranges as the policy improves. |
| Real2Sim | "Close the gap with real data" | Learn a residual to make the sim mimic real rollouts. |

## المزيد من القراءة

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907)ورقة الـ DR الأصلية (رؤية للروبوتات).
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) DR للديناميكية، الحركة الرابعة.
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) داكتيل، ADR على مقياس
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) معلم طالب لـ ANYmal
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) التشغيل الموازي بشكل كبير الذي يقود عمليات نشر 20252026
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) طريقة المناهج الدراسية للدراسة.
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) إطار دينا (استخدام نموذج للتخطيط + التنفيذ) الذي يدعم خطوط الأنابيب الحديثة من التشخيص إلى الواقع.
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) تصنيف أساليب الاختبار المماثل إلى الواقع مع نتائج مقارنة.
