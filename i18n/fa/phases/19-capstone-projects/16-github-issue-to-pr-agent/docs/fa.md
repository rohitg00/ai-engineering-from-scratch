# Capstone 16  GitHub ایشئوم به PR آٹونوم عامل

> یک مسئله را برچسب بزنید، یک PR دریافت کنید  شکل محصول 2026 برای عوامل کدگذاری مستقل: یک عامل را در یک جعبه قمار ابر اجرا کنید، آزمون ها را تایید کنید و یک PR آماده بررسی را با استدلال ارسال کنید. آژانس های AWS SWE، آژانس های پس زمینه cursor، ابر OpenAI Codex و گوگل جولز همه آن را ارسال می کنند. بخش های سخت، بازتولید خودکار محیط ساخت repo، جلوگیری از دزدیدن اسناد، اجرای بودجه های هر repo، و اطمینان از اینکه عامل نمی تواند فشار زور. این سنگ پایانی نسخه خود میزبان را ایجاد می کند و آن را بر اساس هزینه و نرخ گذر با گزینه های میزبانی شده مقایسه می کند.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## مشکل

عامل کدگذاری ابر غیرمتزاد یک دسته محصول جداگانه از عوامل کدگذاری تعاملی است (Capstone 01). UX یک برچسب GitHub است. شما یک مشکل را برچسب می دهید `@agent fix this`در این مورد، یک کارگر در یک جعبه شن و ماسه ابر می چرخد، ریپو را کلر می کند، آزمایشات را اجرا می کند، فایل ها را ویرایش می کند، تأیید می کند و یک PR را با منطق عامل در بدن باز می کند. هیچ حلقه تعاملی، هیچ ترمینل. آژانس های AWS SWE از راه دور، عوامل پس زمینه cursor، ابر OpenAI Codex، گوگل جولز و شرکت های فراری همه در این زمینه جمع می شوند.

چالش های مهندسی مشخص هستند: تولید محیط (آموزگر باید repo را بدون تصویر پیشگیر شده توسعه دهنده از ابتدا بسازد) ، تست های فلیکی (ظروف انجام مجدد یا جداسازی) ، دامنه اعتبار (یک برنامه GitHub با حداقل مجوزهای باریک) ، اجرای بودجه برای هر repo در روز و سیاست فشار فشار.

## مفهوم

عامل عامل این کار، یک وب هاوک GitHub (تعارف مسئله یا نظر روابط عمومی) است. یک فرستنده کار را به ECS Fargate یا Lambda ارسال می کند. کارگر repo را به یک جعبه شن و ماسه Daytona یا E2B با یک فایل Docker عمومی که از repo (زبان، چارچوب) نتیجه گرفته شده است، می کشد. عامل یک حلقه کوچک SWE-agent یا SWE-agent v2 را در برابر Claude Opus 4.7 یا GPT-5.4-Codex اجرا می کند. این تکرار می کند: کد را بخوانید، پیشنهاد اصلاح، استفاده از پیچ، آزمایشات را اجرا کنید.

تایید مرحله گاتینگ است. قبل از باز شدن PR، CI کامل باید در جعبه قمر عبور کند. دلتای پوشش محاسبه می شود؛ اگر منفی فراتر از یک حد باشد، PR باز می شود اما برچسب گذاری می شود `needs-review`. مامور اين دليل رو به عنوان شرح روابط عمومی و اضافه به`@agent`در مورد موضوعي که بازرس مي تونه دنبالش کنه

امنیت از طریق دو سطح مختلف GitHub بررسی می شود: اپلیکیشن یک توکن نصب کوتاه مدت را با `workflows: read`و محتوای ریپو و دامنه های روابط عمومی محدود است. حفاظت از شاخه ها (نه مجوزهای برنامه) "هیچ نوشته مستقیم به `main`" و "هیچ فشار زور"  اپلیکیشن هرگز به لیست بای پاس اضافه نمی شود.`.github/workflows`این برنامه اصلی GitHub نیست، بنابراین اجازه دادن به لیست در ویرایش فایل توسط آژانس باید در کارکن اعمال شود. سقف بودجه در هر repo در روز در فرستنده اعمال می شود (به عنوان مثال، حداکثر 5 PR در هر repo در روز، 20 دلار در هر PR).

## معماری

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## دسته

- تگگر: برنامه GitHub با توکن ذره های نازک؛ گیرنده webhook از طریق Lambda یا Fly.io
- کارکن: کار ECS Fargate (یا GitHub Actions خود میزبان اجرا)
- جعبه شن: ظرف توسعه ی دیتونا یا جعبه شن E2B برای هر کار
- حلقه عامل: خط پایه mini-swe-agent یا SWE-agent v2 بر روی Claude Opus 4.7 / GPT-5.4-Codex
- بازیافت: نقشه بازیافت کننده درخت + ripgrep
- تأیید: IC کامل در جعبه شن + پوشش دروازه دلتا
- قابل مشاهده بودن: لنگ فوز با آرکائیو ردیابی هر PR که از سازمان روابط عمومی مرتبط است
- بودجه: سقف روزانه دلاری در هر ریپو؛ حداکثر روابط عمومی در هر ریپو در هر روز

```figure
cf-issue-to-pr
```

## آن را بسازید

1. **GitHub App.**توکن نصب با دانه های خوب: مسائل خواندن + نوشتن، pull_requests نوشتن، محتوای خواندن + نوشتن، جریان کار خواندن. حفاظت از شاخه (تنها سطح که می تواند این کار را انجام دهد) اعمال "هیچ فشار مستقیم به `main`" و "هیچ فشار زور" اپلیکیشن در لیست بازگویی نیست. کارگر "هیچ نوشتن تحت`.github/workflows`" به عنوان یک چک لیست اجازه در اختلاف پیشنهادی، از آنجا که مجوزهای برنامه GitHub راه است.

2. **Webhook receiver.**تابع Lambda برچسب های مسئله / نظرات روابط عمومی وب ها را قبول می کند.`@agent fix this`.به سمت "سکويس"

3. **Dispatcher.**کار هاي SQS رو اجرا مي کنه، بودجه رو اجرا مي کنه، کار هاي ECS Fargate رو با URL repo، بدن شماره و يه جعبه ي جديد "ديتونا" مي گردونه

4. **Environment inference.**زبان تشخیص (Python، Node، Go، Rust) و مدیر بسته (uv، pnpm، go mod، cargo) ایجاد کنید. یک فایل Docker در حال پرواز اگر وجود ندارد.

5. **Agent loop.**ابزار: ripgrep، tree-sitter repo-map، read_file، edit_file، run_tests، git. محدودیت های سخت: 20 دلار هزینه، 30 دقیقه ساعت دیواری، 30 ساعت عامل.

6. **Verification.**پس از پایان حلقه، مجموعه آزمایش کامل را در جعبه شن و ماسه اجرا کنید. دلتای پوشش را از طریق jacoco / coverage.py محاسبه کنید. اگر CI قرمز: توقف، PR را باز نکنید. اگر پوشش بیش از 2٪ کاهش یابد: PR را با `needs-review`برچسب

7. **PR posting.**شاخه مامور را فشار دهید. از طریق API GitHub PR را با عنوان، استدلال، خلاصه تفاوت، URL ردیابی، هزینه، نوبت باز کنید.

8. **Credential hygiene.**کارگر با یک توکن نصب برنامه GitHub کوتاه مدت اجرا می شود.

9. **Eval.**30 موضوع داخلی با مشکل متفاوت را به دنبال داشت. نرخ عبور، کیفیت روابط عمومی (حجم متفاوت، سبک، پوشش) ، هزینه، تاخیر را اندازه گیری کنید. در مورد همان مسائل با عوامل پس زمینه Cursor و عوامل AWS SWE از راه دور مقایسه کنید.

## ازش استفاده کن

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## -باده

`outputs/skill-issue-to-pr.md`یک کارگر ابر async GitHub App + که مسائل برچسب شده را به روابط عمومی آماده بررسی با هزینه محدود و اعتبارات محدودی می کند.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## تمرینات

1. حالت "تحقیق فلو" را اضافه کنید: برچسب `@agent stabilize-flake TestX`50 بار تست را در جعبه شن و ماسه انجام می دهد و پیشنهاد می کند که حداقل تغییراتی که آن را ثابت می کند.

2. هزینه ها را با عوامل پس زمینه کورسر در سه مسئله مشترک مقایسه کنید. گزارش دهید که کدام ابزار برنده می شود.

3. برنامه بودجه اي رو اجرا کنيد: هزینه روزانه هر گزارش، هزینه هر کاربر، هشدار در مورد ناهنجاري

4. یک حالت "جستن راه اندازی" بسازید که بدون اجرای CI یک طرح روابط عمومی را باز کند، بنابراین بازرس ها می توانند برنامه را ارزان بررسی کنند.

5. سیاست حفظ را اضافه کنید: شعبه های روابط عمومی که سن آنها بیش از 7 روز است و بدون ادغام می شوند به طور خودکار حذف می شوند.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## خواندن بیشتر

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) مرجع عامل ابر غیر متوافق کنونی
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) مرجع CLI
- [Cursor Background Agents](https://docs.cursor.com/background-agent) جایگزین تجاری
- [OpenAI Codex (cloud)](https://openai.com/codex) رقبای میزبان
- [Google Jules](https://jules.google) نسخه میزبان گوگل
- [Factory Droids](https://www.factory.ai) مرجع تجاری جایگزین
- [GitHub App documentation](https://docs.github.com/en/apps) هویت بوتی در محدوده
- [Daytona cloud sandboxes](https://daytona.io) جعبه ی مرجع
