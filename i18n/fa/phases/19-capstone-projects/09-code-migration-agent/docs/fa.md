# Capstone 09  عامل مهاجرت کد (توسع زبان سطح Repo / زمان اجرا)

> مگراسیون بنچ آمازون (جاوا 8 تا 17) و مگراسیون Py2-to-Py3 موتور اپلیکیشن گوگل بار 2026 را تعیین می کنند. OpenRewrite Moderne در مقیاس AST تغییر نامه های تعیین کننده را انجام می دهد. Grit با DSL مدل کد مدل هم همین مشکل را هدف قرار می دهد. الگوی تولید هر دو را ترکیب می کند: یک زیربنای تعیین کننده برای بازنویسی های ایمن و یک لایه عامل برای موارد مبهم، یک جعبه قمار برای هر شاخه و یک هارم آزمون که قبل از باز شدن PR سبز می شود. هدف اينه که 50 تا بازخريد واقعي رو مهاجرت کنيم و نرخ گذر با تگزينومي شکست رو منتشر کنيم.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## مشکل

مهاجرت کد در مقیاس بزرگ یکی از پاکترین کاربردهای تولید عوامل کدگذاری 2026 است. حقیقت اصلی آشکار است (آیا مجموعه آزمایش پس از مهاجرت عبور می کند؟) ، پاداش ها واقعی هستند (مغریتی ناوگان جاوا-8 یک پروژه در مقیاس جمعیت است) و معیارها عمومی هستند (ذیلی مجموعه 50 ریپو MigrationBench). OpenRewrite مدرن طرف تعیین کننده را اداره می کند. لایه عامل هر چیزی را که دستورات OpenRewrite نمی تواند انجام دهد: نوسخه های مبهم، حرکت سیستم ساخت، سنتکس دم طولانی، شکستن وابستگی انتقالی.

شما یک عامل را ایجاد خواهید کرد که یک جاوا 8 ریپو (یا پایتون 2 ریپو) را بگیرد و شاخه مهاجرت سبز CI را تولید کند. شما نرخ عبور، حفظ پوشش آزمایش، هزینه هر ریپو را اندازه گیری خواهید کرد و یک تاکسونومی شکست را ایجاد خواهید کرد. کنار هم با یک خط پایه تعیین کننده فقط به شما می گوید که ارزش عامل در واقع در کجا زندگی می کند.

## مفهوم

لوله دو لایه داره**deterministic substrate**(OpenRewrite برای جاوا، libcst برای پایتون) بخش عمده ای از بازنویسی های مکانیکی را به طور ایمن اجرا می کند: واردات، امضای روش، ویرایش های بی فایده، تلاش با منابع، جایگزینی API قدیمی. این سریع است و تفاوت های قابل بررسی را ایجاد می کند.**agent layer**(OpenAI Agents SDK یا LangGraph over Claude Opus 4.7 و GPT-5.4-Codex) موارد را که دستورات نمی توانند انجام دهند: ارتقاء فایل های ساخت (Maven/Gradle/pyproject), تعارض وابستگی های انتقالی، فلش های تست، تشریح های سفارشی.

هر repo یک sandbox Daytona با زمان اجرا هدف را پیش از نصب می کند. آژانس تکرار می کند: ساخت اجرا کنید، شکست ها را طبقه بندی کنید، اصلاحات را اعمال کنید، تکرار کنید. محدودیت های سخت: 30 دقیقه در هر repo، 8 دلار در هر repo، 20 عامل می چرخد. اگر همه تست ها موفق شوند و پوشش بیش از 2 درصد کاهش یابد، شاخه PR را باز می کند. اگر نه، repo تحت یک کلاس شکست با شواهد ثبت می شود.

طبقاتی شکست قابل تحویل است. در میان 50 بازبینی، چه چیزی خراب شده است؟ Deps انتقالی؟ تشریح های سفارشی؟ نسخه ابزار بسازید؟ فلک های تست غیر مرتبط با مهاجرت؟ هر کلاس یک شمارش و تفاوت نمونه ای را می گیرد. نویسندگان نسخه آینده می توانند سه مورد برتر را هدف قرار دهند.

## معماری

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## دسته

- زیربنای تعیین کننده: OpenRewrite (Java) یا libcst (Python)
- عامل: OpenAI Agents SDK یا LangGraph بر روی Claude Opus 4.7 + GPT-5.4-کودکس
- Sandbox: Daytona devcontainers per branch، پیش نصب زمان اجرا هدف (Java 17 / Python 3.12)
- سیستم های ساخت: Maven، Gradle، uv (Python)
- معیار: Amazon MigrationBench 50 ریپو زیر مجموعه (Java 8 تا 17), گوگل App Engine Py2-to-Py3 repos
- استفاده از تست: دوچرخه مواز، پوشش از طریق Jacoco (Java) یا coverage.py (Python)
- مشاهده: Langfuse + ردیابی بسته هر repo با هر قسمت متفاوت
- داشبورد: داشبورد با شمارش هر کلاس و تفاوت های نمونه ای

```figure
ce-migration-funnel
```

## آن را بسازید

1. **Recipe pass.**اولین نسخه های OpenRewrite (Java) یا libcst (Python) را اجرا کنید. 70-80٪ مهاجرت های مکانیکی را ضبط کنید. به عنوان "وصیه" انجام دهید.

2. **Build trial.**"دایتونا ساند باکس": زمان اجرا هدف را نصب کنید، ساخت را اجرا کنید. اگر سبز باشد، به تست ها بروید. اگر قرمز باشد، به آژانس بدهید.

3. **Agent loop.**لنگ گراف با ابزار: `run_build`،`read_file`،`edit_file`،`run_test`،`git_diff`. عامل شکست را طبقه بندی می کند (عمق، ترکیب، آزمایش، ابزار ساخت) و یک اصلاح هدفمند را اعمال می کند.

4. **Budget caps.**30 دقيقه ساعت ديواري در هر رپو، 8 دلار هزینه، 20 بازيگر بازي ميکنه هر نقض و پرونده اي که تحت "بژت_کاهش" قرار داره با تفاوت فعلی متوقف ميشه

5. **Test + coverage gate.**پس از ساخت سبز، مجموعه آزمایش را اجرا کنید. پوشش را با repo پایه مقایسه کنید. اگر پوشش بیش از 2 درصد کاهش یافته است، فایل را تحت "coverage_regression" ثبت کنید.

6. **PR open.**در صورت موفقیت، شاخه را فشار دهید، PR را با تفاوت و خلاصه ای از اینکه کدام دستورات استفاده شده و کدام عامل را به عنوان نویسنده اختصاص داده است باز کنید.

7. **Failure taxonomy.**برای هر ریپو شکست خورده، با یک کلاس برچسب بزنید: `dep_upgrade_required`،`build_tool_drift`،`custom_annotation`،`test_flake`،`syntax_edge_case`،`budget_exhausted`يه داشبورد بساز

8. **50-repo run.**در زیر مجموعه MigrationBench اجرا کنید. گزارش نرخ گذر در هر کلاس، هزینه در هر گزارش، پوشش حفظ و یک مقایسه با تعیین کننده تنها پایه.

## ازش استفاده کن

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## -باده

`outputs/skill-migration-agent.md`در صورت ارائه یک repo، آن را اجرا می کند دستورات تعیین کننده سپس یک حلقه عامل برای تولید یک شاخه سبز مهاجرت، یا فایل های repo تحت یک کلاس تاکسونمی.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## تمرینات

1. لوله مهاجرت را فقط با OpenRewrite اجرا کنید (هیچ عامل وجود ندارد). نرخ عبور را با کل لوله مقایسه کنید. موارد را شناسایی کنید که تنها عامل تفاوت است.

2. یک چک "Lint-clean" را اجرا کنید: پس از مهاجرت، یک linter سبک (بدین لکه برای جاوا، ruff برای پایتون) اجرا کنید. PR را شکست دهید اگر خطاهای جدید lint ظاهر شوند. نرخ پوشش حفظ شده اما سبک بازگردانده شده را اندازه گیری کنید.

3. یک بهینه ساز "دقیقی کوچک" اضافه کنید: پس از اینکه شاخه عامل از آزمون ها عبور کرده، تغییرات غیر ضروری را با یک گذر دوم حذف کنید. کاهش اندازه تفاوت را گزارش کنید.

4. به یک مهاجرت سوم گسترش دهید: گره 18 به گره 22. بسته بندی جعبه شن را دوباره استفاده کنید؛ لایه نسخه را برای یک کدومد سفارشی عوض کنید.

5. زمان ساخت سبز اول (TTFGB) را به عنوان یک متریک UX اندازه گیری کنید. هدف: p50 کمتر از 10 دقیقه.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## خواندن بیشتر

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) معیار کنونیکی 2026
- [Moderne.io OpenRewrite platform](https://www.moderne.io) مرجع زیربنایی تعیین کننده
- [OpenRewrite documentation](https://docs.openrewrite.org) نویسندگان دستورات
- [Grit.io](https://www.grit.io) کد متناوب DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) ارجنت SDK
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) شاخص مرجع مهاجرت جایگزین
- [libcst](https://github.com/Instagram/LibCST) زیربنای تعیین کننده پایتون
- [Daytona sandboxes](https://daytona.io) مرجع هر شاخه جعبه ی شن
