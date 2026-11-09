# توسعه عوامل Eval-Driven

> راهنمای Anthropic: "با دستورات ساده شروع کنید، آنها را با ارزیابی جامع بهینه سازی کنید و سیستم های چند مرحله ای را تنها در صورت نیاز اضافه کنید". ارزیابی آخرین مرحله نیست. این حلقه بیرونی است که هر انتخاب دیگری را در مرحله 14 هدایت می کند.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## اهداف یادگیری

- سه لایه ارزیابی را نام دهید  معیار های ثابت، آف لائن سفارشی، تولید آنلاین  و هر کدام برای چه هدف است.
- حلقه تنگي ارزیابی کننده-اپتيميزر رو شرح بده
- بهترین شیوه های 2026 را شرح دهید: ارزیابی ها در کنار کد، اجرا در CI، روابط دروازه.
- هر درس فاز 14 رو به مورد ارزیابی که تولید ميکنه وصل کن

## مشکل

عوامل از نمایش ها عبور می کنند. آنها در تولید به شیوه ای که نمایش ها نمی توانند پیش بینی کنند شکست می خورند. معیارها پاسخ می دهند "آیا این مدل به طور گسترده قابل است؟" نه "آیا این عامل پیچ های مناسب را برای محصول من ارسال می کند؟" پاسخ: ارزیابی در سه لایه، به طور مداوم اجرا می شود، با هر محافظ و قانون آموخته به یک مورد ارزیابی نقشه برداری شده است.

## مفهوم

### سه لایه ارزیابی

1. **Static benchmarks** SWE-bench برای کد (درسی 19) ، WebArena / OSWorld برای مرور / کامپیوتری (درسی 20) ، GAIA برای عمومی (درسی 19) ، BFCL V4 برای استفاده از ابزار (درسی 06) استفاده می شود. استفاده برای مقایسه مدل های مختلف و بازپسین. آلودگی واقعی است: SWE-bench + 32.67% از انتشار راه حل یافت. همیشه در SWE-bench Verified یا در مجموعه بازرسی از انتشار مانند SWE-bench + گزارش کنید.

2. **Custom offline evals** شکل محصول شما:
   - LLM به عنوان قاضی (Langfuse، Phoenix، Opik  درس 24)
   - بر اساس اجرای (پچ اجرا، تست های چک)
   - بر اساس مسیر (موازنه ی دنباله های عمل در برابر طلا؛ OSWorld-Human نشان می دهد عوامل برتر 1.4-2.7x بر روی طلا).

3. **Online evals**تولید:
   - تکرار جلسه (Langfuse).
   - هشدارهای فعال شده در رایل نگهبان (درسی 16، 21).
   - ردیابی هزینه / تاخیر در هر مرحله (درسی 23 OTel شامل می شود).

### ارزیابی کننده- بهینه ساز (انتروپک)

حلقه تنگ:

1. پیشنهاد کننده تولید می کند.
2. قاضي معين
3. تا وقتي که معين کننده عبور کنه رو درست کن

این خود تصفیه (درسی 05) عمومی است. هر جریان عامل که به شما اهمیت می دهد می تواند در ارزیابی کننده بهینه سازی برای قابلیت اطمینان بسته شود.

### 2026 بهترین شیوه ها

- ايفال ها در کنار کد زندگی ميکنن
- هر بار که به مردم رسمي ميگم
- در نتیجه، در نظر گرفتن این که آیا این در نظر گرفته شده است، این در نظر گرفته می شود که در نظر گرفتن این در نظر گرفته شده است که در نظر گرفتن این در نظر گرفته شده است که در نظر گرفتن این در نظر گرفته شده است که در نظر گرفتن این در نظر گرفته شده است که در نظر گرفتن این در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است که در نظر گرفته شده است.
- هر ريل نگهبان نقشه اي به يه پرونده ي تقييم داده شده
- هر قانون آموخته (ردخانی، جریان کار، قانون یادگیری) به یک مورد شکست می پردازد.

### پیوند مرحله 14

اکثر درس های مرحله 14 موارد ارزیابی را تولید می کنند. جدول درس های با روشن ترین را فهرست می کند:

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

اگه مجموعه ارزیابی شما برای هر ردیف یه پرونده داشته باشه، شما هسته ی مرحله 14 رو پوشش داده اید.

### در صورتی که توسعه مبتنی بر ارزیابی شکست خورده باشد

- **No baseline.**بدون آخرین چیز شناخته شده، قابل خواندن نیست.
- **LLM-judge without grounding.**قاضیان هم توهم می کنند. الگوی انتقادی (درسی 05)  اساس قضاوت بر روی ابزار خارجی.
- **Over-fitting to evals.**بهینه سازی برای ارزیابی از کاربرد تولید متفاوت است.
- **Flaky evals.**موارد غیر تعیین کننده باعث هشدارهای غلط می شوند.

```figure
ae-eval-three-layers
```

## آن را بسازید

`code/main.py`یک خط ارزیابی stdlib است:

- ثبت پرونده ها با دسته بندی (مطابق، سفارشی، آنلاین).
- يه مامور با اسطوره تحت آزمون
- حلقه ارزیابی کننده- بهینه ساز: پیشنهاد، قضاوت، اصلاح تا عبور یا حداکثر دور.
- دروازه CI: نرخ عبور جمع آوری شده + بازگشت نسبت به خط پایه.

اجرا کن

```
python3 code/main.py
npx tsx code/main.ts
```

نتیجه: هر مورد موفق/شکست، پرچم بازپسین، حکم دروازه CI.

## ازش استفاده کن

- پرونده هاي eval رو با کد ماموريت خودتون بنویسيد
- ازشون بررسي کنين که هر ارتباطي رو از طریق اطلاعاتي انجام بده
- شکست دادن بر اساس بازپسین
- سرعت عبور رو در طول زمان دنبال کن
- هر شکست تولید رو به يه پرونده جديد مرتبط کن

## -باده

`outputs/skill-eval-suite.md`یک مجموعه ارزیابی سه لایه برای یک محصول عامل با دروازه های CI و ردیابی رجسی را ایجاد می کند.

## تمرینات

1. یکی از شکست های تولیدت رو بگیر، یه پرونده ی ارزیابی بنویسی که تکرارش کنه
2. یک عنوان قضاوت LLM را برای دامنه خود با سه ابعاد (واقع، صدا، دامنه) بسازید. 50 جلسه را امتیاز دهید.
3. مجموعه ارزیابی را به CI متصل کنید. ساخت بر روی بازپسین >=5% شکست می خورید.
4. یک متریک تراکتوری-ثربت پذیری اضافه کنید: چند گام را عامل نسبت به یک تراکتوری طلا انجام داد؟
5. هر درس فاز 14 رو به پرونده ي ارزیابی در اتاقت نقشه بزن

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## خواندن بیشتر

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) " شروع ساده، بهینه سازی با ارزیابی ها "
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) شاخص مرجعیت مورد نظر
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) معیار استفاده از ابزار
- [Langfuse docs](https://langfuse.com/) ارزیابی + تکرار جلسه در عمل
