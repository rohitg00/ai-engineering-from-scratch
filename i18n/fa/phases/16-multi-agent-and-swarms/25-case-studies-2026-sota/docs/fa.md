# مطالعات موردی و پیشرفت سال 2026

> سه مرجع درجه تولید برای مطالعه از پایان به پایان، هر کدام یک قطعه متفاوت از مهندسی چند عامل را نشان می دهد. **Anthropic's Research system**(کارگر گروه ساز، توکن های 15x، +90.2٪ نسبت به واحد عامل Opus 4، انتشار قوس قزح) مورد نظارت کنونی است. **MetaGPT / ChatDev**(مخصخصیص نقش کدگذاری شده SOP برای مهندسی نرم افزار؛ "حلال خوری ارتباطی" ChatDev؛ گسترش MacNet به >1000 عامل از طریق DAGs، arXiv:2406.07155) مورد تجزیه نقش کانونیک است. **OpenClaw / Moltbook**(در اصل Clawdbot توسط پیتر استاینبرگر، نوامبر 2025؛ نامگذاری شده دو بار؛ 247k ستاره های GitHub تا مارس 2026; عوامل محلی ReAct-loop؛ Moltbook به عنوان یک شبکه اجتماعی تنها با نمایندگی با ~ 2.3M حساب های عامل در عرض چند روز از راه اندازی، توسط Meta 2026-03-10) نشان می دهد که چه اتفاقی در مقیاس جمعیت می افتد: فعالیت اقتصادی نوظهور، خطرات تزریق فوری، مقررات در سطح دولت (چین OpenClaw را در رایانه های دولتی محدود کرد، مارس 2026).**Framework landscape April 2026:**تولید اصلی LangGraph و CrewAI؛ AG2 ادامه AutoGen جامعه است؛ Microsoft AutoGen در حالت نگهداری است (در چارچوب عامل مایکروسافت ادغام شده است، RC Feb 2026) ؛ OpenAI Agents SDK جانشین تولید Swarm است؛ Google ADK (اپریل 2025) شرکت کننده بومی A2A است. هر چارچوب اصلی در حال حاضر پشتیبانی از MCP را ارسال می کند؛ اکثر A2A را ارسال می کنند. این درس هر مورد را از انتها به انتها می خواند و الگوهای رایج را تجزیه می کند تا بتوانید مرجع مناسب را برای سیستم تولید بعدی خود انتخاب کنید.

**Type:** Learn (capstone)
**Languages:** Python, TypeScript
**Prerequisites:** all of Phase 16 (Lessons 01-24)
**Time:** ~90 minutes

## مشکل

مهندسی چند عامل رشته ای جوان است. مرجع تولید کمی است و هر کدام بخشی از فضا را پوشش می دهند. خواندن آنها یک به یک مفید است؛ مقایسه آنها به عنوان مجموعه مفید تر است. این درس سه مورد مطالعه ای را در سال 2026 به عنوان یک لیست خواندن از پایان به پایان، الگوهای مشترک را نشان می دهد و منظره چارچوب را نقشه می زند تا بتوانید از دانش، نه بازاریابی، انتخاب های چارچوبی را انجام دهید.

## مفهوم

### سیستم تحقیقات انسان شناسی

مورد کارگزار نظارت تولید. کلود اوپوس 4 برنامه ها و ترکیب می کند. کلود سونت 4 تحقیقات زیر در موازی. پست مهندسی منتشر شده: https://www.anthropic.com/engineering/multi-agent-research-system.

نتایج اصلی اندازه گیری شده:

- **+90.2%**بهبود نسبت به واحد عامل Opus 4 در ارزیابی های تحقیقاتی داخلی.
- **80% of BrowseComp variance**توضیح داده شده توسط**token usage alone** چند عامل به طور عمده برنده می شوند زیرا هر زیرکار یک پنجره زمینه تازه را دریافت می کند.
- **15x tokens per query**مقابل یک عامل
- **Rainbow deployment**چون ماموران خيلي طولانی مدت و دولت دار هستن

درس های طراحی:

1. **Scale effort to query complexity.**ساده → 1 عامل با 3-10 تماس ابزار. متوسط → 3 عامل. تحقیقات پیچیده → 10+ زیرکاره.
2. **Broad first, then narrow.**زیرنویس ها جستجوهای گسترده انجام می دهند؛ سرب ترکیب می کند؛ زیرنویس های پیگیری عمق های هدفمند انجام می دهند.
3. **Rainbow deploys.**نسخه هاي قدیمی رو زنده نگه دار تا وقتي که ماموران پروازشون تموم بشه
4. **Verification is not optional.**این سیستم بدون نقش صریح تأیید کننده، حسی می کند.

این مورد مرجع برای توپولوژی کارکن نظارت (فاز 16 · 05) در مقیاس تولید است.

### MetaGPT / ChatDev

پرونده تجزیه عملکرد SOP تولید. arXiv:2308.00352 (MetaGPT) و arXiv:2307.07924 (ChatDev) را پوشش دهید.

MetaGPT SOP های مهندسی نرم افزار را به عنوان پیام های نقش رمزگذاری می کند: مدیر محصول، معمار، مدیر پروژه، مهندس، مهندس QA. چارچوب مقاله: `Code = SOP(Team)`هر نقش یک پیام کوتاه و تخصصی دارد؛ ارسال های بین نقش ها آثار ساختاری (دستگاه های PRD، اسناد معماری، کد) را حمل می کنند.

مشارکت ChatDev: **communicative dehallucination**. آژانس ها قبل از پاسخ به سوالات خاص درخواست می کنند  یک آژانس طراح قبل از طراحی UI از برنامه نویس می پرسد که چه زبان مورد نظر است، نه حدس می زند. روزنامه گزارش می دهد که این به طور قابل اندازه گیری توهم در خط لوله های چند عامل را کاهش می دهد.

مک نت (arXiv:2406.07155) ChatDev را به **>1000 agents via DAGs**هر گره DAG یک تخصص نقش است؛ حواشی قراردادهای انتقال را کدگذاری می کند. مقیاس ممکن است زیرا روتینگ صریح و غیر قابل محاسبه است.

درس طراحی:

1. **Structure matters more than size.**يه گروه 5 نفره اي که به عنوان يک گروه غير ساختاره 50 نفره اي که به عنوان يک گروه غير ساختاره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به عنوان 5 نفره اي که به دست ميادادند
2. **Handoff contracts in writing.**آثار هنری که بین نقش ها منتقل می شوند، به یک طرح عمل می کنند.
3. **Communicative dehallucination**این یک الگوی ارزان و تحمل کننده است.
4. **DAGs scale further than chat.**وقتی جریان قابل تشخیص باشه، رمزگذاریش کن

این مورد مرجع برای تخصص نقش (فاز 16 · 08) و توپولوژی ساختاری (فاز 16 · 15) است.

### اکوسیستم OpenClaw / Moltbook

پرونده تولید در مقیاس جمعیت.

- **Nov 2025:**کشتی های کلاودبوت (مسترک کدگذاری ReAct-loop محلی پیتر استاینبرگر)
- **Jan 2026:**نامش دو بار در یک هفته تغییر داده شد (Clawdbot → Moltbot در 27 ژانویه پس از شکایت های علامت تجاری، سپس Moltbot → OpenClaw سه روز بعد).
- **Feb 2026:**Moltbook به عنوان یک شبکه اجتماعی تنها توسط یک عامل در همان ابتدایی ها راه اندازی می شود؛ ~ 2.3 میلیون حساب عامل در عرض چند روز.
- **Mar 2026 (2026-03-10):**متا مالت بوک رو به دست مياره
- **Mar 2026:**چین OpenClaw رو در کامپیوترهای دولتی محدود کرده
- **Mar 2026:**OpenClaw 247 هزار ستاره GitHub را عبور می کند.

این چیزی است که چند عامل به نظر می رسد وقتی شما میلیون ها عامل را در یک زیربنای مشترک قرار دهید:

- **Emergent economic activity.**ماموران با استفاده از پرداخت های رمزنگاری، خرید، فروش و خدمات یکدیگر را انجام می دهند.
- **Prompt-injection risks at population scale.**یک پیام مخرب در پروفایل عامل ویروسی به هزاران تعامل عامل به عامل در ساعت ها گسترش می یابد.
- **State-level regulatory response.**در عرض چند هفته از راه اندازی، مقررات به اکوسیستم می رسد.

درس های طراحی از این مورد تا حدی فنی و تا حدی مدیریت هستند:

1. **Multi-agent at population scale is a new regime.**بهترین شیوه های سیستم های فردی (تحقق، شفافیت نقش) هنوز هم اعمال می شود اما کافی نیست.
2. **Prompt injection is the new XSS.**پروفایل های عامل و پیام های بین عوامل را به عنوان ورودی غیرقابل اعتماد به طور پیش فرض در نظر بگیرید.
3. **Regulation is faster than design cycles.**برنامه ریزی کن
4. **Open-source + viral scale compounds.**247 هزار ستاره در حدود 4 ماه غیرمعمول است؛ طراحی برای انتشار-فجر-حمله.

ببین[OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)برای اطلاعات فنی، ذخیره سازی Clawdbot / OpenClaw حلقه محلی ReAct را نشان می دهد؛ پست های عمومی Moltbook معماری گرافی اجتماعی را در بالا نشان می دهد.

### منظره چارچوب آوریل 2026

| Framework | Status | Best for | Notes |
|---|---|---|---|
| **LangGraph** (LangChain) | Production leader | structured graph + checkpointing + human-in-the-loop | recommended default for production |
| **CrewAI** | Production leader | role-based crews with Sequential/Hierarchical processes | strong for role decomposition |
| **AG2** | Community maintained | GroupChat + speaker selection | AutoGen v0.2 continuation |
| **Microsoft AutoGen** | Maintenance mode (Feb 2026) | — | merged into Microsoft Agent Framework RC |
| **Microsoft Agent Framework** | RC (Feb 2026) | orchestration patterns + enterprise integration | new entrant; watch |
| **OpenAI Agents SDK** | Production | Swarm successor | tool-return handoff pattern |
| **Google ADK** | Production (April 2025) | A2A-native | Google Cloud integration |
| **Anthropic Claude Agent SDK** | Production | single-agent + Research extension | see the Research system post |

هر چارچوبي مهم الان سفينه**MCP**پشتیبانی بیشتر کشتی ها**A2A**. مطابقت پروتکل دیگر یک تفاوت نیست

### الگوهای مشترک در هر سه مورد

1. **Orchestrator + workers**(مراقب صریح بشری، PM- به عنوان نظارت کننده MetaGPT، عوامل فردی OpenClaw + اثرات شبکه).
2. **Structured handoff contracts**(وصف وظایف زیرنویس بشری، اسناد PRD/ارشیکتوری MetaGPT، آثار A2A OpenClaw)
3. **Verification as first-class role**(محقق آنترروپک، مهندس QA MetaGPT، اعتبارگرهای شبکه OpenClaw)
4. **Scaling is topology + substrate, not just more agents**(توسعه های قوس قزح، DAG های MacNet، زیربنایی در مقیاس جمعیت).
5. **Cost is material and disclosed**(15 توکن، بودجه در هر نقش در MetaGPT، قیمت گذاری در هر تعامل در Moltbook).
6. **Security posture is explicit**(ساند باکس آنترپيك، محدودیت هاي نقش ميتاگپت، تزريق سریع اوپن کلاو به عنوان سطح حمله شناخته شده)

### انتخاب یک مرجع برای پروژه بعدی

- **Production research / knowledge task → Anthropic Research.**فرقهاي تازه اي برنده مي شوند
- **Engineering / tool-chain workflow → MetaGPT / ChatDev.**نقش + SOP + قراردادهای انتقال
- **Network-effect social product → OpenClaw / Moltbook.**زیربنایی + اقتصاد نوظهور
- **Classic enterprise automation → CrewAI or LangGraph**(مرد تولید، زمان اجرا ثابت)

### خلاصه ی جدیدترین سال 2026

جایی که میدان در آوریل 2026 قرار دارد:

- **Frameworks are converging.**پشتیبانی از MCP + A2A شرط میز است. معنای انتقال گزینه باقی مانده طراحی است.
- **Evaluation is hardening.**SWE-bench Pro، MARBLE، STRATUS، معیار کاهش آلودگی است.
- **Production failure rates are measurable**(Cemri 2025 MAST؛ 41-86.7٪ در MAS واقعی) این زمینه از عصر "به نظر عالی در نمایش" خارج شده است.
- **Cost is the central engineering constraint.**هزینه توکن در هر کار، ساعت دیواری در هر تعامل، پخش قوس قزح. چند عامل بر روی دقت برنده می شود اما از دست می دهد در هزینه  و این تجارت تصمیم تجاری است.
- **Regulation is a near-term input, not a background concern.**حوزه های قضایی سریع تر از چرخه های تک تک نفاذ حرکت می کنند.

```figure
a5-orchestrator-scale
```

## ازش استفاده کن

`outputs/skill-case-study-mapper.md`این مهارت است که یک طرح سیستم چند عامل پیشنهادی را می خواند و آن را به نزدیک ترین مطالعه موردی نقشه می زند و تصمیمات طراحی که قبلاً در مطالعه موردی آزمایش شده است را به وجود می آورد.

## -باده

قوانین اولیه برای تولید چند عامل در سال 2026:

- **Start from a case study, not from scratch.**نزدیک ترین رشته تحقیقات انسان شناسی / MetaGPT / OpenClaw را انتخاب کنید و آن را تطبیق کنید.
- **Adopt MCP + A2A.**قابلیت حمل و نقل در میان چارچوب ها ارزشمند است؛ پشتیبانی از پروتکل رایگان است.
- **Measure against SWE-bench Pro or your internal Pro-equivalent.**تایید شده آلوده شده
- **Pay the verification tax.**یک تأیید کننده مستقل حدود 20 تا 30 درصد از بودجه توکن شما را هزینه می کند و دقت قابل اندازه گیری را خریداری می کند.
- **Rainbow deploy long-running agents.**انتظار داشته باش که چند ساعته کار مامورها رو به رو رو به رو باشه
- **Read WMAC 2026 and the MAST follow-ups.**اين نظم سريع پيش مي رود

## تمرینات

1. سیستم تحقیقات بشری را از پایان به آخر بخوانید. سه تصمیم طراحی را شناسایی کنید که اگر شما Opus 4 را با یک مدل کوچکتر جایگزین کنید (به عنوان مثال، Haiku 4) تغییر می کند.
2. بخش های ۳-۴ (arXiv:2308.00352) MetaGPT را بخوانید. یک SOP را از دامنه خود (نه نرم افزار) به عنوان پیامک نقش رمزگذاری کنید. SOP چند نقش را تحت تاثیر قرار می دهد؟
3. چت دیو را بخوانید (arXiv:2307.07924). مکانیسم "دحالت شناسي" را شناسایی کنید. آن را در یکی از سیستم های چند عامل موجود خود اجرا کنید.
4. درباره OpenClaw و Moltbook بخونید. یک حالت شکست خاص را انتخاب کنید که در مقیاس جمعیت ظاهر شده است که در یک سیستم 5 عامل ظاهر نمی شود. چگونه می توانید در برابر آن مهندسی کنید؟
5. پروژه چند عامل فعلی خود را انتخاب کنید. کدام یک از سه مطالعه موردی نزدیک ترین مرجع است؟ کدام تصمیم طراحی از آن مطالعه موردی را هنوز اتخاذ نکرده اید؟ یکی را که در این سه ماهه اتخاذ خواهید کرد، بنویسید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Anthropic Research | "The supervisor reference" | Claude Opus 4 + Sonnet 4 subagents; 15x tokens; +90.2% over single-agent. |
| MetaGPT | "SOP as prompts" | Role decomposition for software engineering; `Code = SOP(Team)`. |
| ChatDev | "Agents as roles" | Designer / programmer / reviewer / tester; communicative dehallucination. |
| MacNet | "Scale ChatDev via DAG" | arXiv:2406.07155; 1000+ agents via explicit DAG routing. |
| OpenClaw | "Local ReAct-loop agents" | Steinberger's project; 247k stars by March 2026. |
| Moltbook | "Agent-only social network" | 2.3M agent accounts; acquired by Meta March 2026. |
| Rainbow deploy | "Multiple versions concurrent" | Keep old runtime versions alive for in-flight long-running agents. |
| Communicative dehallucination | "Ask before answering" | Agents request specifics from peers instead of guessing. |
| WMAC 2026 | "The AAAI workshop" | April 2026 community focal point for multi-agent coordination. |

## خواندن بیشتر

- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) مرجع تولید کارکن نظارت
- [MetaGPT — Meta Programming for Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) تجزیه نقش SOP
- [ChatDev — Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924) تخفیف خیره کننده ی ارتباطی
- [MacNet — scaling role-based agents to 1000+](https://arxiv.org/abs/2406.07155) مقیاس مبتنی بر DAG
- [OpenClaw on Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) بررسی کلی از اکوسیستم ها
- [WMAC 2026](https://multiagents.org/2026/) کارگاه برنامه پل 2026 AAAI در مورد هماهنگی چند عامل
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents) رهبر تولید
- [CrewAI docs](https://docs.crewai.com/en/introduction) چارچوبی مبتنی بر نقش
