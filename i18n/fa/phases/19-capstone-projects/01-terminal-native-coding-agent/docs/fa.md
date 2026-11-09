# Capstone 01  عامل کدگذاری بومی ترمینال

> تا سال 2026 شکل یک عامل کدگذاری مشخص شده است. یک خط TUI، یک طرح حالت، یک سطح ابزار با جعبه قمار، یک حلقه که برنامه ریزی می کند، عمل می کند، مشاهده می کند، بازیابی می کند. کلوید کد، کورسور 3 و اوپن کد از 50 فوت هم شبیه هم هستند این سنگ پایان از شما می خواهد تا یک پایان را به پایان  CLI در، کشیدن درخواست  و اندازه گیری آن در برابر mini-swe-agent و Live-SWE-agent در SWE-bench Pro. شما خواهید فهمید که چرا بخش سخت تر از همه، نه تماس مدل، بلکه حلقه ابزار، جعبه شن و سقف هزینه در یک 50 نوبت است.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## مشکل

عوامل کوڈنگ در سال 2026 به عنوان دسته ای از برنامه های کاربردی AI تبدیل شدند. کلوید کد (انتروپک) ، کورسور 3 با کمپوزر 2 و تاب های عامل (کورسور) ، Amp (Sourcegraph) ، OpenCode (112k ستاره) ، Factory Droids و Google Jules همه تغییرات کشتی از همان معماری: یک هارن ترمینال، یک سطح ابزار مجاز، یک جعبه شن و یک حلقه برنامه-عمل-نظرت ساخته شده در اطراف یک مدل مرزی. مرز تنگ است  Live-SWE-agent به 79.2% در SWE-bench رسید با Opus 4.5  اما صنایع مهندسی گسترده است. اکثر حالت های شکست اشتباهات مدل نیستند. این ها عدم ثبات حلقه ابزار، مسمومیت زمینه، هزینه های رمزنگاری شده فرار و عملیات سیستم فایل های مخرب هستند.

شما نمیتونید درباره این عوامل از خارج استدلال کنید شما باید یکی بسازید، به دنبال سقوط حلقه در خم 47 باشید وقتی ریپگرپ 8 میگابایت از پیچ ها را باز می کند و لایه تراکم را بازسازی کنید.

## مفهوم

آستین چهار سطح داره**Plan**یک شی حالت سبک TodoWrite را حفظ می کند که مدل هر نوبت را دوباره می نویسد. **Act**تماس های ابزار را ارسال می کند (خواندن، ویرایش، اجرا، جستجو، git). **Observe**کد های خروج / stdout / stderr را ضبط می کند، کوتاه می کند و خلاصه را به عقب می فرستد. **Recover**اشکال ابزار بدون انفجار پنجره زمینه یا لوله شدن برای همیشه. شکل 2026 یک چیز دیگر اضافه می کند: **hooks**.`PreToolUse`،`PostToolUse`،`SessionStart`،`SessionEnd`،`UserPromptSubmit`،`Notification`،`Stop`و`PreCompact` نقاط تمدید قابل تنظیم که در آن اپراتور سیاست، تله متری و رایل های حفاظت را تزریق می کند.

جعبه شن و ماسه اي 2 بي يا ديتونا هر کاری در یک کنتینر تازه توسعه یافته با یک Git Worktree نصب شده است. این هیرنس هرگز به سیستم فایل میزبان دست نمی زند. درخت کار در مورد موفقیت یا شکست از بین می رود. کنترل هزینه ها در سه لایه اجرا می شود: یک سقف توکن در هر نوبت، بودجه در هر جلسه و محدودیت سخت در هر نوبت (معمولا 50). لایه مشاهده ای، دامنه های OpenTelemetry با کنوانسیون های معنوی GenAI است که به یک Langfuse خود میزبان ارسال می شود.

## معماری

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## دسته

- زمان اجرا: Bun 1.2 + Ink 5 (رایاکت در ترمینال)
- دسترسی مدل: API یکپارچه OpenRouter با Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (برای سخت ترین وظایف)
- حمل ابزار: مدل پروتکل کنستکت StreamableHTTP (مکان اصلاح 2026)
- جعبه شن: جعبه شن E2B (JS SDK) یا کانتینر های توسعه Daytona
- جستجوی کد: فرعی ripgrep، پارسرهای درختان برای 17 زبان (پیش از تهیه)
- جداسازی:`git worktree add`در هر کار، تمیز کردن در مورد موفقیت / شکست
- آرمینش برابر: SWE-bench Pro (تعداد فرعی تایید شده) + Terminal-Bench 2.0 + 30 وظیفه خود را نگه دارید
- مشاهده: SDK OpenTelemetry با `gen_ai.*`semconv → خود میزبان Langfuse
- ارسال روابط عمومی: اپلیکیشن GitHub با توکن های نخود نازک، دامنه محدود به repo هدف

```figure
ce-agent-loop
```

## آن را بسازید

1. **TUI and command loop.**پروژه "بون" رو با سرمايشي بپوش`agent run <repo> "<task>"`. یک نمای تقسیم شده چاپ کنید: صفحه برنامه (در بالا) ، جریان تماس ابزار (در وسط) ، بودجه توکن (در پایین) اضافه کنید حذف در Ctrl-C که می شود `SessionEnd`قبل از خروج از اينجا

2. **Plan state.**یک طرح TodoWrite تایپ شده را تعریف کنید (نتظار / in_progress / انجام شده با یادداشت ها). مدل حالت کامل را هر نوبت به عنوان یک تماس ابزار دوباره می نویسد. اجازه ندهید به طور تدریجی تغییر کند. برنامه باقی بماند تا `.agent/state.json`تا تصادف ها ادامه پيدا کنه

3. **Tool surface.**شش ابزار رو تعریف کن:`read_file`،`edit_file`(با پیش بینی متفاوت)`ripgrep`،`tree_sitter_symbols`،`run_shell`(با زمان بندی)`git`(حال / تفاوت / انجام / فشار). در MCP StreamableHTTP قرار دهید تا استفاده از حمل و نقل غیرقابل توجه باشد. هر ابزار بازمی گردد output کوتاه (قفل در 4k توکن ها در هر تماس).

4. **Sandbox wrapping.**هر کار یک جعبه شن E2B را تولید می کند.`git worktree add -b agent/$TASK_ID`تمام تماس های ابزار در داخل جعبه شنک اجرا می شوند. سیستم فایل میزبان قابل دسترسی نیست.

5. **Hooks.**تمام هشت نوع هوک 2026 را اجرا کنید. حداقل چهار هوک را که توسط کاربر تایید شده است، سیم بزنید: (الف) `PreToolUse`نگهبان فرماندهي که مانعش مي شه`rm -rf`خارج از درخت کار، ب)`PostToolUse`حسابداری نمادین (ج) `SessionStart`شروع بودجه (د)`Stop`يه بسته ي آخري از آثار رو مي نويسه

6. **Eval loop.**یک زیر مجموعه ۳۰ شماره از SWE-bench Pro Python را کلان کنید. هنیز خود را در برابر هر یک از آنها اجرا کنید. با mini-swe-agent (حداقل پایه) در pass@1, turns-per-task و $-per-task مقایسه کنید. نتایج را به `eval/results.jsonl`. .

7. **Cost control.**محدودیت سخت: 50 نوبت، 200 هزار متن، 5 دلار در هر کار.`PreCompact`هوک به طور خلاصه، دوران قدیمی تر به یک بلوک قبل از حالت در 150K را خلاصه می کند، جایی برای مشاهدات جدید بدون از دست دادن برنامه آزاد می کند.

8. **PR posting.**در مورد موفقیت، آخرین قدم اینه`git push`+ یک تماس API GitHub که یک PR با برنامه و خلاصه تفاوت در بدن را باز می کند.

## ازش استفاده کن

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## -باده

مهارت های قابل ارائه در زندگی می کنند`outputs/skill-terminal-coding-agent.md`. با توجه به مسیر ریپو و توصیف کار، این چرخه کامل برنامه-عمل-نظرت را در یک جعبه شن و برگشته یک URL PR به همراه یک بسته ردیابی.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## تمرینات

1. مدل پشتیبان از کلاود سونت 4.7 را به Qwen3-Coder-30B که در vLLM ارائه می شود تغییر دهید. مقایسه pass@1 و $-per-task را مقایسه کنید. گزارش در مورد عملکرد زیر مدل باز.

2. اضافه کنید`reviewer`فرعی که قبل از ارسال PR تفاوت را می خواند و می تواند یک حلقه بازبینی را درخواست کند. اندازه گیری کنید که آیا بررسی های مثبت نادرست نرخ عبور SWE-bench را زیر خط اصلی یک عامل کاهش می دهد (ملاحظه: معمولا بله).

3. تست استرس جعبه شن: یک کار بنویس که سعی کند`curl`یک URL خارجی و یک کار که در خارج از درخت کار نوشته می شود. تایید کنید هر دو توسط هک PreToolUse مسدود شده است. سعی ها را ثبت کنید.

4. اجرا`PreCompact`خلاصه با یک مدل کوچکتر (Haiku 4.5) اندازه گیری کنید که چقدر وفاداری برنامه در فشرده سازی 3x از دست می شود.

5. انتقال MCP StreamableHTTP را برای استودیو عوض کنید. شروع سرد و تاخیر هر تماس را بررسي کنید. برنده ای را برای استفاده ی محلی انتخاب کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## خواندن بیشتر

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) آرم مرجع از Anthropic
- [Cursor 3 changelog](https://cursor.com/changelog) برچسب های عامل و یادداشت های محصول Composer 2
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) حداقل خط پایه برای مقایسه SWE- بانچ هارن
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79.2% SWE-bench با Opus 4.5 تایید شده
- [OpenCode](https://opencode.ai) بند باز، ستاره های 112 هزار
- [SWE-bench Pro leaderboard](https://www.swebench.com) ارزیابی هدف های این سنگ پای
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) StreamableHTTP، متاداتا قابلیت
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) طرح زمان برای تماس های ابزار و استفاده از توکن
