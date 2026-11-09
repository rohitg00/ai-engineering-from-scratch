# Capstone 10  تیم مهندسی نرم افزار چند عامل

> شکل 2026 یک تیم مهندسی چند عامل به هم پیوسته است: یک طراح برنامه ریزی می کند، N کدرها در درختان کار موازی کار می کنند، یک بازرس دروازه می کند، یک آزمایش کننده تأیید می کند. معماری کارخانه SWE-AF، انگیزه مبتنی بر نقش MetaGPT، نمودار بازیگر تایپ شده AutoGen 0.4، Devin Cognition و Droids Factory همه به طور مستقل روی آن فرود آمدند. درختان کار موازی، ساعت دیواری را به تولید تبدیل می کنند. پروتکل های مشترک و انتقال به صورت سطح شکست تبدیل می شوند. هدفش اينه که تيم رو بسازيم، بر روي صندلي س.و.ي. پرو ارزیابی کنيم و گزارش بدهيم که چه بازي هايي و چقدر مي شکند

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## مشکل

کدن های کدگذاری یک عامل در کارهای بزرگ به سقف رسیده اند. نه به این دلیل که هر عامل فردی ضعیف است، بلکه به این دلیل که یک زمینه 200k-توکن نمی تواند یک طرح معماری به علاوه چهار قطعه کد پایه موازی به علاوه نظرات بازرس به علاوه تولید تست را نگه دارد. کارخانه های چند عامل مشکل را تقسیم می کنند: یک معمار مالک طرح است، برنامه نویس ها مالک اجرای آن در درختان کار موازی هستند، یک بازرس دروازه است، یک آزمایش کننده تأیید می کند. معماری "فابریکه" SWE-AF، نقش MetaGPT، نمودار بازیگر تایپ شده AutoGen  هر سه فریمنگ شکل مشابه را توصیف می کنند.

سطح شکست، انتقال است. معمار برنامه هایی را که کدهای نمی توانند اجرا کنند، برنامه ریزی می کند. کدهای متضاد تفاوت ها را ایجاد می کنند. بازرس تصحیحات توهم را تأیید می کند. آزمونگر یک کدهای هنوز را می نویسد. شما یکی از این تیم ها را ایجاد می کنید، آن را در 50 شماره SWE-bench Pro اجرا می کنید، هر انتقال را ردیابی کنید و بعد از مرگ منتشر کنید.

## مفهوم

نقش ها عوامل تایپ شده اند.**Architect**(کلود اپوس 4.7) شماره را می خواند، یک برنامه می نویسد و آن را به زیرکار هایی با رابط های صریح تقسیم می کند. **Coders**(کلود سونت 4.7, N نمونه های موازی، هر یک در یک `git worktree`+ "کیتون های شن" (Daytona sandbox) به طور مستقل کارهای زیر را اجرا می کنند. **Reviewer**(GPT-5.4) تفاوت ادغام را می خواند و یا موافقت می کند یا درخواست تغییرات خاص می کند. **Tester**(Gemini 2.5 Pro) مجموعه آزمایش را به طور جداگانه اجرا می کند و گزارش های شکست و شکست با آثار هنری را ارائه می دهد.

ارتباطات از طریق یک صفحه کار مشترک (فایل پشتیبان یا Redis) انجام می شود. هر نقش از وظایف مجاز به انجامش استفاده می کند. ارسال پيامها به صورت پروتکل A2A است نگرانی های هماهنگی: حل اختلافات ادغام (رول هماهنگی یا ادغام سه طرفی خودکار) ، همگام سازی حالت مشترک (خطط پس از شروع برنامه نویسی منجمد می شود؛ برنامه ریزی مجدد رویدادهای جداگانه است) و بازبینی کننده دروازه (بررسی کننده نمی تواند تغییرات خود را تایید کند یا تغییرات پیشنهادی را ارائه دهد).

تقویت توکن هزینه پنهان است. هر مرز نقش به دستورات خلاصه و زمینه ی تحویل اضافه می کند. یک 40 نوبت تک عامل به 160 نوبت کل در چهار نقش تبدیل می شود. Rubric به طور خاص میزان بهره وری توکن را در مقابل پایه ی یک عامل وزن می کند زیرا سوال "کار چند عامل انجام می دهد" نیست بلکه "در هر دلار برنده می شود".

## معماری

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## دسته

- آرکیستر: لینگ گراف با حالت مشترک + زیرگراف های هر عامل
- پیام رسانی: پروتکل A2A (گوگل 2025) برای پیام های بین آژانس تایپ شده
- مدل: Opus 4.7 (معمار) ، سونت 4.7 (کدرها) ، GPT-5.4 (مراجعه کننده) ، Gemini 2.5 Pro (تستر)
- جداسازی درختان کاری: `git worktree add`هر کدگر + جعبه شنوایی دیتونا
- هماهنگ کننده ادغام: ادغام سه طرفی سفارشی + حل تعارض توسط LLM
- Eval: SWE-bench Pro (50 شماره) ، سناریوهای SWE-AF، HumanEval++ برای آزمایشات واحد
- قابل مشاهده: Langfuse با دامنه های برچسب نقش، حسابداری توکن هر عامل
- تعینات: K8 ها با هر نقش به عنوان یک تعینات جداگانه + HPA در پس انداز

```figure
ce-team-handoff
```

## آن را بسازید

1. **Task board.**JSONL با فایل پشتیبان با پیام های تایپ شده: `plan_request`،`subtask`،`diff_ready`،`review_needed`،`test_needed`،`approved`،`rejected`،`replan_needed`. ماموران به برچسب ها امضا ميکنن

2. **Architect.**شماره GitHub را می خواند، Opus 4.7 را با یک قالب برنامه اجرا می کند که نیاز به رابط های فرعی صریح دارد (فایل های لمس شده، عملکردهای عمومی، تأثیر آزمایش). یک `plan_request`با یک روز از زیرکارها.

3. **Coders.**در این زمینه، هر یک از کارگران متوازد، یک وظیفه فرعی از هیئت مدیره را دریافت می کنند.`git worktree add`شاخه و يه جعبه شن ديتاونا`diff_ready`با پیچ + دلتای تست

4. **Merge coordinator.**در تمام کدرها، سه طرفی شاخه های N را به یک شاخه مرحله ای ادغام می کند. حل تعارض توسط LLM تنها زمانی که سطح پرونده ها همپوشانی وجود دارد.

5. **Reviewer.**GPT-5.4 تفاوت های ادغام شده را می خواند. نمی تواند تفاوت های نوشته شده را تایید کند.`approved`(بدون بازي) يا`review_feedback`با درخواست های تغییر خاص به کدگر مربوطه بازگردانده می شود.

6. **Tester.**جمینی 2.5 پرو در یک جعبه قمم پاک آزمایشات را اجرا می کند. آثار هنری را ضبط می کند.`test_passed`یا`test_failed`با دنباله های دسته بندی. آزمایشات شکست خورده به کدگر مالک زیرکار شکست خورده باز می گردند.

7. **Handoff accounting.**هر پیام عبور از مرز نقش یک زمان در Langfuse با اندازه و مدل بار مفید استفاده می شود. تقویت توکن های هر زیرکار را محاسبه کنید (توکن های کدر + توکن های بازبینی کننده + توکن های تستر + معماری_ اشتراک / توکن های کدر).

8. **Eval.**50 شماره SWE-bench Pro اجرا کنید. با یک خط پایه یک عامل (یک سونت 4.7 در یک درخت کار) مقایسه کنید.

9. **Post-mortem.**برای هر شماره شکست خورده، انتقال شکسته را شناسایی کنید (خطای بیش از حد مبهم، تعارض ادغام، تایید نادرست بازرس، فلک آزمایش کننده). یک هیستogram شکست دادن انتقال را تولید کنید.

## ازش استفاده کن

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## -باده

`outputs/skill-multi-agent-team.md`با توجه به URL مسئله و سطح موازی، تیم یک PR آماده ادغام با حسابداری توکن در هر نقش را تولید می کند.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## تمرینات

1. یک خطا آشکار را به یک Diff Mid- Run تزریق کنید (بالای`return None`در این مورد، میزان تایید نادرستی را اندازه گیری کنید.

2. به دو کدگر کاهش دهید (عمارت + دو کدگر + بازرس + آزمایش کننده، هر کدگر دو وظیفه فرعی را به ترتیب اجرا می کند). ساعت دیواری و نرخ عبور را مقایسه کنید.

3. هماهنگ کننده ادغام را با محدودیت یک نویسنده جایگزین کنید (کار فرعی با مجموعه های فایل های منفصل تماس می گیرد). بار برنامه ریزی را بر روی معمار اندازه گیری کنید.

4. بررسی کننده تبادل از GPT-5.4 تا Claude Opus 4.7. نرخ تایید نادرست و دلتای هزینه توکن را اندازه گیری کنید.

5. نقش پنجم را اضافه کنید: مستند کننده (Haiku 4.5). پس از بررسی، یک ورودی در دفترچه تغییر ایجاد می کند. اندازه گیری کنید که آیا کیفیت اسناد هزینه اضافی توکن را توجیه می کند یا خیر.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## خواندن بیشتر

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) کارخانه مرجع 2026 چند عامل
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) چارچوب چند عامل مبتنی بر نقش
- [AutoGen v0.4](https://github.com/microsoft/autogen) چارچوب بازیگران تایپ شده مایکروسافت
- [Cognition AI (Devin)](https://cognition.ai) محصول مرجع
- [Factory Droids](https://www.factory.ai) محصول مرجع جایگزین
- [Google A2A protocol](https://a2a-protocol.org/latest/) مشخصات پیام رسان بین عوامل
- [git worktree documentation](https://git-scm.com/docs/git-worktree) زیربنای جداسازی
- [SWE-bench Pro](https://www.swebench.com) هدف ارزیابی
