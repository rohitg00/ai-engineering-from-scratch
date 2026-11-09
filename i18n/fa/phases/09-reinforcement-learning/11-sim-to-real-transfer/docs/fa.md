# انتقال سیم به واقعی

> یک سیاست آموزش دیده در یک شبیه ساز که در سخت افزار شکست می خورد یک سیاست است که شبیه ساز را به یاد آورد. تصادفی سازی دامنه، سازگاری دامنه و شناسایی سیستم سه ابزار برای عبور کنترلرهای آموخته از شکاف واقعیت هستند.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## مشکل

آموزش یک ربات واقعی آهسته، خطرناک و گران است. یک دوپای واقعی برای یادگیری راه رفتن میلیون ها دوره آموزش می گیرد؛ یک دوپای واقعی که حتی یک بار هم سخت افزار را خراب می کند، سقوط می کند. شبیه سازی به شما تنظیمات بیحد، قابلیت بازیافت تعیین کننده، محیط موازی و هیچ آسیب فیزیکی می دهد.

اما شبیه سازها اشتباه هستند. بیئر ها در مقایسه با مدل های MuJoCo تراش بیشتری دارند. دوربین ها دارای انحراف لنز هستند که شبیه ساز شامل نمی شود. موتورها تاخیر، واکنش منفی و شتاب دارند که 99٪ از مدل های سیم را رد می کنند. باد، گرد و غبار و روشنایی متغیر یک سیاست آموزش دیده را تحت تأثیر قرار می دهند.**reality gap** تفاوت سیستماتیک بین توزیع سیم و توزیع واقعی  مشکل اصلی RL برای رباتیک است.

شما به یک سیاست نیاز دارید که برای تغییر توزیع از سیم به واقعی * قوی باشد. سه رویکرد تاریخی: شبیه سازی تصادفی (تأریفی دامنه) ، تطبیق سیاست با کمی داده های واقعی (تأریف دامنه / تنظیم دقیق) ، یا شناسایی پارامترهای سیستم واقعی و مطابقت با آنها (تأریف سیستم). در سال 2026، نسخه غالب سه مورد را با شبیه سازی موازی عظیم (Isaac Sim، Isaac Lab، Mujoco MJX در GPU) ترکیب می کند.

## مفهوم

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**توبن و همکاران 2017، Peng و همکارانش سال 2018 در طول آموزش، هر پارامتر سیم را که ممکن است در روبات واقعی متفاوت باشد تصادفی کنید: جرم، معادلات تراش، افزایش PD موتور، صدا سنسور، موقعیت دوربین، نور، بافت، مدل های تماس. این سیاست توزیع مشروط را بر اساس "چه سیم امروز است" می آموزد و در طول کل دوره عمومی می شود. اگه ربات واقعی در چارچوب آموزش قرار بگیرد، این سیاست جواب میده.

- **Upside:**.حتيچي به اطلاعات واقعي نيازي نداره . يک دستور کار، خيلي روبات
- **Downside:**آموزش بیش از حد تصادفی سیاست "عالمگیر" اما بیش از حد محتاط را تولید می کند.

**System Identification (SI).**اگر بتوانیم در ربات واقعی کشش دست و مفاصل را اندازه گیری کنیم، آن را به سیم کارت وصل کنید. سپس یک سیاست را تمرین کنید که انتظار این ارزش ها را داشته باشد. نیاز به دسترسی به سیستم واقعی دارد اما شکاف واقعیت را مستقیماً کاهش می دهد.

- **Upside:**هدف آموزش دقیق و کم شور
- **Downside:**خطای باقیمانده مدل برای سیاست نامرئی است؛ اثرات کوچک ناشناخته (به عنوان مثال، باند مرده موتور) هنوز هم انتشار را متوقف می کند.

**Domain Adaptation.**آموزش در سيم، تنظیم دقیق با مقدار کمی از داده های واقعی. دو طعم:

- **Real2Sim2Real:**یاد بگیرید که یک شبیه ساز باقی مانده را چگونه انجام دهید$f(s, a, z) - f_{\text{sim}}(s, a)$با استفاده از راه اندازی های واقعی، تمرین در سیم کارت اصلاح شده. شکاف را بدون اطلاعات واقعی می کند.
- **Observation adaptation:**آموزش یک سیاست که از طریق یک استخراج کننده ویژگی های آموخته (به عنوان مثال، GAN پیکسل به پیکسل) نقش اصلی obs → sim مانند obs را نقشه برداری می کند. کنترل کننده در sim باقی می ماند.

**Privileged learning / teacher-student.**مکی و همکاران 2022 (اینگیل چهار نفره) * معلم را در شبیه سازی آموزش دهید که به اطلاعات امتیاز یافته دسترسی داشته باشد (احداث حقیقت زمین، ارتفاع زمین، حرکت IMU). * دانش آموز را که فقط مشاهدات سنسور واقعی را می بیند، جدا کنید. دانش آموز یاد می گیرد تا ویژگی های امتیاز یافته را از تاریخ، قوی در پارامترهای فیزیکی، نتیجه دهد.

**Massively parallel simulation.**20242026 . ایزاک لابراتوار ، Mujoco MJX ، Brax همه هزاران ربات موازی را بر روی یک GPU واحد اجرا می کنند. PPO با 4,096 انسان های موازی سال ها تجربه را در ساعت ها جمع می کند. "شکاف واقعیت" با گسترش توزیع آموزش کاهش می یابد. DR تقریباً آزاد می شود وقتی هر یک از این 4,096 envs دارای پارامترهای تصادفی متفاوت است.

**The real-world 2026 recipe (quadruped walking example):**

1. همگامي بزرگ با جاذبه ي تصادفي، کشش، زيادتي موتور، بار فايدي
2. سیاست معلم با اطلاعات خصوصی آموزش دیده (نقشه زمین، سرعت بدن حقیقت زمین).
3. سیاست دانشجویی از معلم با استفاده از فقط proprioception (کدرهای مفاصل پا) مستفید شده است.
4. سازگاری اختیاری مشاهده از طریق خودکار کدگذاری در IMU واقعی.
5. پخش، صفر عکس در 10+ محیط، اگر شکست خورد، چند دقیقه از تنظیم دقیق دنیای واقعی با PPO محدود به ایمنی انجام دهید.

```figure
f3-reality-gap
```

## آن را بسازید

کد این درس یک نمایش کوچک از تصادفی سازی دامنه در یک GridWorld با * شور * انتقال است. ما یک سیاست را آموزش می دهیم که احتمالات تصادفی حرکت در "sim" را تجربه می کند و با سطح حرکت که هرگز در طول آموزش دیده نشده است ، بر "حقیقی" ارزیابی می کند. شکل مستقیماً به انتقال MuJoCo به سخت افزار نقشه می کشد.

### مرحله 1: سیم پارامتر شده

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`در روباتيكاي واقعي مي تواند رگزش، جرم، كسب موتوري باشد هر چيزي كه بين سيم و واقعي تغییر كند

### مرحله دوم: آموزش با DR

در شروع هر قسمت نمونه`slip ~ Uniform[0.0, 0.4]`آموزش PPO / Q-تعلم / هرچیزی انجامش بده اینو برای چندین قسمت انجامش بده

### مرحله 3: ارزیابی صفر شات در اسلاید "حقیقی"

ارزیابی کنید`slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`. چهار نفر اول در حوزه آموزش پشتیبانی می شوند.`0.5`و`0.7`یک سیاست آموزش دیده در DR باید نزدیک به مطلوب در داخل پشتیبانی باقی بماند و به صورت زیبایی در خارج کاهش یابد. یک سیاست آموزش دیده در شیب ثابت خارج از شیب آموزش شکننده خواهد بود.

### مرحله 4: مقایسه با آموزش باریک

یک سیاست دوم را با `slip = 0.0`فقط. بر اساس همان ارزیابی`slip`باید یک سقوط فاجعه بار را ببینید تا وقتی که ریال شیپ > 0 باشد.

## دام ها

- **Too much randomization.**قطار در حال حرکت`slip ∈ [0, 0.9]`و سیاست شما به اندازه ی خطرناکی است که هرگز راه مطلوبی را امتحان نمی کند.
- **Too little randomization.**آموزش در یک قطعه نازک و سیاست نمی تواند به طور کلی. استفاده از برنامه درسی سازنده (خودمرکز تصادفی) که توزیع را با بهبود سیاست گسترش می دهد.
- **Misidentified parameter space.**به طور تصادفی چیزی را اشتباه کنید (نور دوربین در زمانی که شکاف واقعی تاخیر موتور است) و DR کمک نمی کند.
- **Privileged info leakage.**یک معلم که از وضعیت جهانی برای اقدامات استفاده می کند نه فقط مشاهدات، می تواند یک دانش آموز را تولید کند که نمی تواند به دنبال آن باشد. اطمینان حاصل کنید که سیاست معلم توسط دانش آموز به تاریخ مشاهدات قابل اجرا است.
- **Sim-to-sim transfer failure.**اگر سیاست شما برای یک نوع سیم سخت تر قوی نباشد، برای دنیای واقعی نیز قوی نخواهد بود. همیشه قبل از انتشار روی یک نوع سیم طولانی تست کنید.
- **No real-world safety envelope.**یک سیاست که در سیم کارت کار می کند و بدون یک سپر ایمنی سطح پایین "در واقع کار می کند" هنوز هم می تواند سخت افزار را شکسته باشد. محدودیت سرعت، محدودیت تورک، محدودیت های مشترک را در یک کنترلر غیر آموخته اضافه کنید.

## ازش استفاده کن

"مجموعه " "ي" 2026 "از سيم به واقع"

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

برای کنترل در تمام مقیاس ها، جریان کار سازگار است: بهترین کاری که می توانید انجام دهید، آنچه را که نمی توانید انجام دهید، تصادفی کنید، سیاست های عظیم را آموزش دهید، از هم جدا کنید، با یک سپر ایمنی استفاده کنید.

## -باده

پس از`outputs/skill-sim2real-planner.md`:

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

## تمرینات

1. **Easy.**آموزش یک عامل Q-Learning در شبکه ی ثابت-slipWorld (slip=0.0). ارزیابی در $\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$. نقشه برگشت مقابل فرار
2. **Medium.**آموزش نمونه گیری از عامل یادگیری DR Q`slip ~ Uniform[0, 0.3]`. ارزیابی همان پاک کردن. DR چقدر با slip=0.5 (خارج از توزیع) میخرد؟
3. **Hard.**برنامه آموزشی را اجرا کنید: با slipp=0.0 شروع کنید، هر بار که سیاست 90 درصد از مطلوب را به دست آورد، دامنه DR را گسترش دهید. کل مراحل محیط را اندازه گیری کنید تا به slipp=0.3 صفر شوت نسبت به یک خط پایه DR ثابت برسید.

## اصطلاحات کلیدی

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

## خواندن بیشتر

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) کاغذ اصلی DR (رؤیا برای رباتیک).
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) DR برای دینامیک، حرکت چهار برابر
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) Dactyl، ADR در مقیاس
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822) معلم- دانشجو برای ANYmal
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) سیمسنگ موازی که باعث انتشار 20252026 می شود.
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) روش برنامه ی آموزشی ADR
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) چارچوب Dyna (با استفاده از یک مدل برای برنامه ریزی + انتشار) که پایه ی خطوط لوله مدرن سیم به واقعی است.
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) طبقه بندی روش های sim-to-real با نتایج معیار.
