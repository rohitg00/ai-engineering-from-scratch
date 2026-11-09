# منظره ی عامل های خودکار کدگذاری (2026)

> SWE-bench Verified از ۴ درصد به ۸۰.۹ درصد در کمتر از سه سال رسیده است. همان کلاود سونت 4.5 43.2 درصد در SWE-agent v1 و 59.8 درصد در Cline خود مختار  استقرار اطراف مدل اکنون به اندازه خود مدل اهمیت دارد. OpenHands (که قبلا OpenDevin بود) فعال ترین پلت فرم مجوز MIT است و حلقه CodeAct آن اقدامات پایتون را به جای تماس های ابزار JSON به طور مستقیم در یک جعبه شنک اجرا می کند. شماره های سرایت یک مشکل میتودولوژیکی را پنهان می کنند: 161 از 500 کار SWE-bench Verified تنها نیاز به تغییر 12 خط دارد و SWE-bench Pro (10+ کار خط) برای مدل های مرز مشابه 2359% است.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## مشکل

سوال درست این است که: در یک توزیع کار که با کار من مطابقت دارد، با استفادینگ که در تولید اجرا می کنم، چه قابلیت اطمینان پایان به پایان دارم؟

بین سال های 2022 و 2026 میدان آموخت که استفندینگ  لایه بازیافت، برنامه نویس، جعبه شن، حلقه ویرایش-تحقق، قالب بازخورد  تحمل بار است. کلاود سونت 4.5 در SWE-agent v1 43.2 درصد در SWE-bench Verified را کسب کرد؛ همان مدل در داخل استقرار خودکار کلین 59.8 درصد را کسب کرد. 16.6 امتیاز مطلق تفاوت، وزن یکسان مدل پایه یک جزء است، حلقه محصول است.

مشکل همراه این است که شتاب معیار بازپسین ها را پنهان می کند. SWE-bench Verified نزدیک به شبعتی است و دم کار آسان (۱۶۱ از ۵۰۰ کار نیاز به ≤ ۲ خط) نمره های برتر را بالا می برد. کیفیت دنیای واقعی در توزیع هایی مانند SWE-bench Pro (10+ تغییر خط) اندازه گیری می شود، جایی که رهبران مشابه هنوز در ۲۳۵۹٪ می نشینند.

## مفهوم

### SWE-bench، یک پاراگراف

SWE-bench (Jimenez و همکاران) با پیچ های واقعی GitHub با پیچ های واقعی زمین را می گیرد و از یک عامل می خواهد که یک پیچ تولید کند که مجموعه آزمایش را عبور دهد. SWE-bench Verified (OpenAI، 2024) یک زیر مجموعه 500 وظیفه ای است که توسط انسان تنظیم شده است و وظایف مبهم و شکسته حذف شده است. SWE-bench Pro جانشین سخت تر است  وظایف که نیاز به 10 خط تغییر دارند ، جایی که عوامل مرزی فعلی در 2359٪ می نشینند.

### آنچه منحنی 2022 → 2026 واقعا نشان می دهد

- **2022**: مدل های تحقیقاتی در ~4% در بنچ SWE خام.
- **2024**: GPT-4 + کفش سبک دیوین در ~14%؛ SWE-آژانت در ~12%.
- **2025**: کلاود 3.5/3.7 سونت داخل Aider و SWE-آژانت فشار به 4055% محدوده.
- **2026**: کلاود سونت 4.5 و رقبای مرز در 7080%+ در SWE-bench Verified.

این مهار از سه منبع ترکیب شده آمده است: مدل های پایه بهتر، استقرار بهتر (CodeAct، بازتاب، حلقه های تأیید کننده) و معیار های بهتر (کاهش شور تایید شده).

### تماس های ابزار CodeAct در مقابل JSON

OpenHands (All-Hands-AI, arXiv:2407.16741, قبلا OpenDevin) شرط معماری خاصی را اتخاذ کرد: به جای مدل که کال های ابزار JSON را که یک میزبان رمزگذاری و اجرا می کند، مدل کد پایتون را منتشر می کند و هسته سبک Jupyter آن را در یک جعبه شن اجرا می کند. عامل می تواند روی فایل ها، ابزارهای زنجیره ای و استثناء های خود را در داخل یک عمل بگیرد.

معامله:

- **JSON tool calls**: هر عمل یک نوبت است؛ آسان برای بررسی؛ ترکیب محدود؛ به طور پیش فرض امن است زیرا هر تماس از طریق یک اعتبار دهنده صریح انجام می شود.
- **CodeAct**: یک عمل می تواند یک برنامه کامل باشد؛ ترکیب؛ نیاز به یک جعبه شنک سخت (OpenHands از تعزیر Docker استفاده می کند) ؛ حالت شکست شامل هر چیزی است که زمان اجرا جعبه شنک اجازه می دهد.

هر دو معماری در حال تولید هستند. CodeAct در سیستم عامل های باز (OpenHands، smolagents) غالب است. تماس های ابزار JSON در خدمات مدیریت شده (آژانتهای مدیریت انسان، دستیاران OpenAI) غالب هستند که در آن ارائه دهنده کنترل اجرا کننده را کنترل می کند.

### سکهفول در چشم انداز 2026

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### چرا کفش ها غالب هستند

یک مسیر کدگذاری یک مسیر افق دراز است (درس 1) . ترکیب های قابل اعتماد در سراسر مراحل. سه مکان که اسکانفورد نقاط را می خرید:

1. **Retrieval**در این زمینه، این مشکل را حل می کند. در واقع، این مشکل را حل می کند. در واقع، این مشکل را حل می کند.
2. **Verifier loop**: انجام تست ها، خواندن ردیف های استیک و دوباره تلاش کردن یک دلتا 10+ نقطه در SWE-بینچ است.
3. **Failure containment**یک جعبه شن روی خطا باز می گردد و از آسیب های ترکیب جلوگیری می کند. یک مدل با و بدون حلقه تأیید کننده به دو محصول متفاوت به نظر می رسد.

### اشباع شاخص سنجی و توزیع واقعی

نویسندگان OpenHands و Epoch AI هر دو نشان می دهند که SWE-bench Verified دارای دم آسان است: 161 از 500 کار فقط به 12 خط تغییر نیاز دارند. نمرات بالا تا حدودی توسط این دم هدایت می شود. SWE-bench Pro به 10 + تغییر خط محدود می شود و نمرات را در محدوده 2359% حتی برای سیستم های مرزی باز می کند. توزیع تولید شما تقریباً مطمئناً به Pro نزدیک تر از Verified است.

پیامدهای انتخاب یک عامل: یک زیر مجموعه Pro مانند پس انداز خطا خود را اجرا کنید. نمره مهم نمره در وظایف است که نماینده آنچه شما ارسال می کنید.

```figure
a5-scaffold-delta
```

## ازش استفاده کن

`code/main.py`مقایسه دو استقرار بازیگری در یک توزیع کاری کوچک ثابت:

1. A**JSON tool-call**یک استایل که یک حرکت در هر نوبت انجام می دهد.
2. A**CodeAct**یک استایل که می تواند یک قطعه کوچک پایتون را در هر عمل منتشر کند.

هر دو از یک "نموذج" (قواعد تعیین کننده) استفاده می کنند بنابراین مقایسه استقرار را از کیفیت مدل جدا می کند. نتیجه نشان می دهد که استقرار CodeAct وظایف بیشتری را در دور های کمتر با هزینه شعاع انفجار بزرگ تر در هر عمل حل می کند.

## -باده

`outputs/skill-scaffold-audit.md`کمک می کند تا قبل از تصویب، یک سازه ای از عوامل کدگذاری پیشنهادی را بررسی کنید: کیفیت بازیافت، حضور تأیید کننده، انزوا جعبه های شن و مناسب بودن معیار به توزیع.

## تمرینات

1. فرار کن`code/main.py`هر اسکارفورد چند دور در یک مجموعه کار انجام می دهد؟

2. مقاله OpenHands را بخوانید (arXiv:2407.16741). مقاله استدلال می کند CodeAct از تماس های ابزار JSON در وظایف پیچیده بهتر است. یک حالت شکست را شناسایی کنید که کاغذ تشخیص می دهد و یک جمله را در مورد زمانی که این حالت در تولید تسلط خواهد داشت بنویسید.

3. یک کار را از پس انداز خطا خود انتخاب کنید که نیاز به 10 خط تغییر در دو فایل دارد. احتمال موفقیت پایان به پایان برای یک مدل مرزی را تحت (a) تماس ابزار JSON و (b) CodeAct تخمین بزنید. شکاف را توجیه کنید.

4. SWE-bench Verified 161 فایل واحد، 12 خط وظایف دارد. یک امتیاز بسازید که آنها را حذف کند. چگونه جدول رتبه بندی مخلوط می شود؟

5. " معرفی SWE-bench Verified " (OpenAI) را بخوانید. روش خاصی را که برای حذف وظایف مبهم استفاده می شود توضیح دهید و یک دسته ای را نام ببرید که به نظر نمی رسد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## خواندن بیشتر

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) معیار اصلی و روش.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) چگونه زیر مجموعه انتخاب شده ساخته شده است.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) معماری CodeAct و طراحی جریان رویداد.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) نمره های زنده
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) چارچوبی برای قابلیت اطمینان از عامل کدگذاری افق بلند
