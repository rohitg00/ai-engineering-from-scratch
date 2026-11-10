# مهارت های مامور: قرارداد قابل حمل و محدودیت زمان اجرا

> یک مهارت یک پرامپت طولانی با یک نام فایل بهتر نیست. این یک بسته کشف شده از دستورالعمل ها، منابع و دستیاران اجرایی است که از طریق یک قرارداد اجرا وارد زمینه یک عامل می شود.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 01 (The Tool Interface), Phase 13 · 05 (Tool Schema Design)
**Time:** ~90 minutes

## اهداف یادگیری

- مهارت های یک عامل را تعریف کنید بدون اینکه آن را با یک پرامپ، دستورالعمل های مخزن، ابزار، هک، زیرنویس یا افزونه اشتباه بگیرید.
- تلفن همراه رو بخون`SKILL.md`قرارداد و جدا کردن آن از تمدیدات خاص زمان اجرا.
- کشف، انتخاب، فعال سازی، بارگذاری منابع، استفاده از ابزار و تأیید را به عنوان مراحل زندگی جداگانه توضیح دهید.
- قبل از اينکه زمان اجرا به فهرست مامور ها برسيد، يه بسته مهارت رو تایید کنيد
- بین یک مهارت، ابزار MCP، هک، زیرکد یا کد معمولی برای یک کار خاص انتخاب کنید.

## ۱۰ دقیقه ی موفقیت اول

قبل از توضیح طولانی این کار را انجام دهید. شما یک مهارت کوچک ایجاد خواهید کرد، نصب
کامل بازرس بسته به یک میزبان واقعی عامل، آن را به عنوان، تایید
این ثابت می کند چرخه زندگی با یک نتیجه قابل مشاهده است.

### پرواز پیش از لابراتوار میزبان واقعی

نقطه کنترل میزبان واقعی نیاز به Node.js دارد`npx`، پایتون 3 ، یکی انتخاب شده
میزبان با مهارت و توانایی، و دسترسی به پروژه یا دامنه کاربر را که در آن انتخاب می کنید، بنویسید
اول دستورات محلی رو چک کن

```bash
node --version
npx --version
python3 --version
```

قبل از نصب تصمیم بگیرید که از کدام میزبان و دامنه استفاده خواهید کرد.
در صورت عدم وجود این نیاز، این درس را در وب سایت بخوانید یا ادامه دهید
این تمرین بسته دستی زیر است. این سقوط به قرارداد یاد می دهد، اما
اثبات نمی کند که میزبان کشف، دعوت، اجرای اسکریپت بسته شده است، یا
رفتارهاي غير نصب شده رو حذف کنين

### 1. از یک دایرکتوری کار خالی شروع کنید

این دستورها را از هر دایرکتوری والدین که در آن کار یادگیری می کنید اجرا کنید:

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

فرمان آخر نباید چیزی چاپ کند. اگر فایل ها را چاپ می کند، یک دستور متفاوت را انتخاب کنید
فهرست خالی باشه پس بررسی یه مرز واضح داره

براي اولین مهارتتون يه فهرست بسازيد:

```bash
mkdir -p my-first-skill
```

ایجاد کنید`my-first-skill/SKILL.md`با این محتوای:

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

تایید کنید که فایل را در دایرکتوری مورد نظر ایجاد کرده اید:

```bash
test -f my-first-skill/SKILL.md
```

بدون کد خروجی و خروج 0 به این معنی است که فایل وجود دارد.

### 2. بسته کامل بازرس را نصب کنید

داخل بمون`agent-skills-first-run`و اجرا کنید:

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

میزبان و دامنه ای را که می خواهید انتخاب کنید. نصب کننده باید لیست
`skill-contract-reviewer`و مقصد که نوشته بود`--full-depth`است
لازم است چون مهارت این درس یک بسته ی سرپوشیده با مرجع ها است،
اسطوره و يه اثري

تنظیم شده`SKILL_ROOT`به فهرست مطلق که توسط نصب کننده گزارش شده است.
فهرست موجودی که شامل نصب شده است`SKILL.md`، نه منبع درس
دایرکتوری و نه فضای کاری فعلی:

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

اگر جلسه عامل قبلا باز بود، جلسه جدیدی را شروع کنید یا از برنامه میزبان استفاده کنید
فرض نکن هر میزبان کاتالوگش رو باردار کنه

### 3. به طور صریح درخواستش کنید

در عامل نصب شده، با `agent-skills-first-run`به عنوان کار
در دایرکتوری، از سنتکس پشتیبانی شده توسط میزبان استفاده کنید:

| Host | Explicit invocation |
|---|---|
| Codex | `skill-contract-reviewer`, or choose it from `/skills`, then provide the review request |
| Claude Code | `/skill-contract-reviewer` followed by the review request |
| Portable fallback | `Use skill-contract-reviewer to review the target package.` |

از مقادیر مطلق چاپ شده برای  استفاده کنید`SKILL_ROOT`و`TARGET_ROOT`در
درخواست. از میزبان بخواهید تا قبل از اجرا آن ها را گسترش دهد و نشان دهد که
دستور حل شده، نه دستور که به دایرکتوری کار فرآیند بستگی دارد:

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

فرمان حل شده باید این شکل باشد، بدون نگهدارنده جای باقی مانده:

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

یک نتیجه موفق سه ویژگی را دارد:

1. میزبان پیدا کرد`skill-contract-reviewer`با اسمش
2. بازرس قرارداد بسته را می خواند و تایید کننده بسته اش را اجرا می کند.
3. پاسخ شامل یک گزارش تأیید بدون خطا ساختاری برای
   نمونه، به علاوه یک انتخاب اولیه معقول.

شواهد اعدام باید مسیر اسکریپت، مسیر هدف، cwd، دقیق
یک گزارش بدون این زمینه ها
ثابت کنه که اسکریپت همراه نصب شده اجرا شده

اگر میزبان گزارش دهد که مهارت در دسترس نیست، نصب را تایید کنید
هدف، یک بار دوباره اسکن یا دوباره شروع کنید و درخواست صریح را دوباره امتحان کنید.
برای پنهان کردن شکست نصب، توضیحات مهارت را دوباره بنویسید.

### 4. انتخاب ضمنی از نظر تست

شروع به یک نوبت جدید از مامور و وارد کردن همان کار بدون نام دادن مهارت:

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

اگر میزبان مهارت های انتخاب شده را نشان دهد، ثبت کنید که آیا انتخاب کرده است
`skill-contract-reviewer`. اگر میزبان رویت را افشا نکنه، علامت ضمنی
انتخاب به عنوان غیر تایید شده است. دعوت صریح است که سقوط قابل حمل است.

### 5. تمیز کن

فقط بسته بازرس نصب شده را حذف کنید:

```bash
npx skills remove skill-contract-reviewer
```

همان میزبان و دامنه ای را که در هنگام نصب استفاده شده انتخاب کنید. پس از اسکن مجدد یا جدید
جلسه، درخواست صریح برای`skill-contract-reviewer`باید گزارش دهد که
. دستياب نيست نگه دار`my-first-skill`برای درس های بعدی، یا حذف
بعد از اينکه راه رو تموم کردي

## مشکل

فرض کنید تیم شما یک جریان کاری انتشار قابل اعتماد دارد. آن تغییرات ادغام شده را پیدا می کند، یادداشت های مهاجرت را بررسی می کند، نوار تغییر را به روز می کند، دستور بسته بندی را اجرا می کند و یک لیست بررسی را تولید می کند.

قرار دادن این جریان کار در یک پرامپت، پیوند دادن آن را آسان و کار کردن آن را دشوار می کند. پرامپت هیچ هویت پایدار، هیچ قاعده کشف، هیچ مرز منابع، هیچ شکل بسته قابل آزمایش و هیچ پاسخ به سوالات اساسی ندارد: چه کسی می تواند آن را فراخوانی کند؟ چه زمانی باید مدل آن را انتخاب کند؟ چه اسکریپت هایی را می تواند اجرا کند؟ چه فایل هایی قابل اعتماد هستند؟ چه چیزی در هنگام فشرده سازی زمینه زنده می ماند؟

اشتباه برعکس این است که با هر دستورالعمل قابل استفاده مجدد به عنوان یک مهارت برخورد کنیم. کنوانسیون های مخزن، اتوماسیون تعیین کننده، ابزارهای خارجی، هک های رویداد و عوامل اختصاصی مشکلات مختلف را حل می کنند. بسته بندی همه آنها در `SKILL.md`یک دایرکتوری تولید می کند که در حالی که وابسته به رفتار نامتوظف یک میزبان است، قابل حمل به نظر می رسد.

اولين کار مهندسی طبقه بندی است. قبل از اينکه تصميم بگيري چطور بسته بندي کني، تصميم بگيري که آثار آثار چه چيزي هستند.

## مفهوم

### مهارت های رمزگذاری دانش رویه

مهارت مامور، یک دایرکتوری است که نقطه ورود آن`SKILL.md`. فایل ورودی شامل YAML frontmatter و سپس دستورالعمل Markdown است. فهرست همچنین می تواند شامل مرجع، اسکریپت و دارایی است.

```figure
skill-package-anatomy
```

فهرست، نه فقط پرونده مارک داون، واحد قابل استفاده است.`SKILL.md`با بازي هاي گمشده بسته ي شکسته است حتی اگر ماده ي جلو آن تجزیه شود.

### تجزيه هاي همسايه

| Artifact | Primary job | Loaded or run when | What it should not impersonate |
|---|---|---|---|
| Prompt | Shape one model interaction | Included by an application or user | A versioned package with resources |
| Repository instructions | Explain one codebase's standing rules | A coding runtime enters that scope | A reusable task workflow |
| Agent skill | Supply reusable procedural knowledge | Explicit or implicit activation | A hard authorization boundary |
| MCP tool | Expose a typed remote capability | The model or application calls it | A detailed operating procedure |
| Hook | Run deterministic logic on an event | The declared event occurs | Probabilistic model routing |
| Subagent | Delegate work with separate context and state | An orchestrator creates or calls it | A static instruction bundle |
| Plugin | Distribute a larger runtime extension | The host installs or enables it | The portable skill contract itself |
| Learned skill library | Store behavior discovered through experience | A policy retrieves a prior program or trajectory | A standards-based `SKILL.md` package |

یک مهارت آزادسازی می تواند به آژانس بگوید که چگونه یک انتشار را بررسی کند. یک سرور MCP می تواند ثبت انتشار را افشا کند. یک هک می تواند فشار مستقیم را ممنوع کند. یک زیرکاره می تواند به طور مستقل از کاندیدیت بررسی کند. این قطعات به دلیل مسئولیت های مختلف تشکیل می شوند.

### کلمه "مهارت" دو ایده متفاوت را نام می دهد

سیستم های تحقیقاتی گاهی اوقات یک برنامه آموخته، مسیر موفق یا قطعه سیاست خاص محیط را مهارت می نامند. یک عامل می تواند این آثار را در طول اکتشاف ایجاد کند، آنها را با مشابهی وظایف بازپس بگیرد، اجرا کند و کتابخانه را از بازخورد بررسی کند. مرحله 14 · 10 چنین کتابخانه ای را برای یادگیری در طول عمر ایجاد می کند.

یک مهارت عامل در این آهنگ کوچک متفاوت است. این یک بسته نویسنده با یک قرارداد سیستم فایل اعلام شده، متاداتا کاتالوگ، افشای تدریجی، دعوت با زمان اجرا و ابزار کنترل شده توسط میزبان است. این می تواند توسط یک عامل تولید یا بهبود یابد، اما یادگیری برای فرمت مورد نیاز نیست.

| Dimension | Agent Skill package | Learned skill library |
|---|---|---|
| Primary unit | `SKILL.md` directory | Program, policy, trajectory, or memory record |
| Creation | Authored, generated, or curated | Usually discovered from environment experience |
| Selection | Catalog description plus runtime policy | Retrieval or policy over task state |
| Execution | Model follows instructions and calls host tools | Environment runs a stored behavior or code artifact |
| Portability | Package contract can cross compatible hosts | Often tied to one environment and action space |
| Evaluation | Routing, artifact, safety, and host compatibility | Reward, success rate, transfer, and library growth |

هر دو ایده صلاحیت قابل استفاده مجدد را شامل می کنند. آنها نباید ادعاهای اجرای را به سادگی به خاطر اینکه یک نام مشترک دارند، به اشتراک بگذارند.

### هسته قابل حمل

مشخصات مهارت های مامور دو میدان مقدماتی را نیاز دارد:

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name`این شناسه مستحکم است. باید قوانین نامگذاری مشخصات را برآورده کند و با دایرکتوری اصلی مطابقت داشته باشد. `description`این باید نشان دهد که مهارت چه کاری انجام می دهد و چه زمانی اعمال می شود.

زمینه های اختیاری قابل حمل عبارتند از:

| Field | Purpose | Portability note |
|---|---|---|
| `license` | State the terms for the package | Core specification |
| `compatibility` | State environmental requirements | Core specification |
| `metadata` | Carry string-valued extension data | Core specification |
| `allowed-tools` | Suggest pre-approved tools | Experimental; host support varies |

بدن مارک داون دستورالعمل های عملیاتی را در اختیار دارد. باید جریان کار، نقاط تصمیم گیری، رفتار شکست و مسیرهای مستقیم به منابع پشتیبانی را تعریف کند.

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### تمدید زمان اجرا لایه دوم است

برخی میزبان ها فرنت متر یا پیکربندی همراه اضافی را قبول می کنند. این زمینه ها می توانند مفید باشند، اما به طور خودکار قابل حمل نیستند.

| Behavior | Example host extension | Portable core? |
|---|---|:---:|
| Hide a skill from model routing while keeping direct user invocation | `disable-model-invocation` | No |
| Hide a skill from the user's command menu while allowing model routing | `user-invocable` | No |
| Show argument help in a command menu | `argument-hint` | No |
| Run the skill in delegated context | `context`, `agent` | No |
| Pin model or reasoning settings | `model`, `effort` | No |
| Register lifecycle automation | `hooks` | No |
| Disable implicit invocation in Codex | `agents/openai.yaml` policy | No |

هر افزونه را به عنوان یک آداپتور رفتار کنید. جریان کار اصلی را بدون آن معتبر نگه دارید، پسپاشی را مستند کنید و میزبان را که آن را مصرف می کند آزمایش کنید. یک زمان اجرا ممکن است یک میدان ناشناخته را نادیده بگیرد، آن را رد کند یا بدون پیاده سازی رفتار آن را حفظ کند.

### ماده جلو متاداتا اجرا می شود

متاداتا قبل از خواندن بدن مهارت ها رفتار سیستم را تغییر می دهد.

- يه شکلي که خراب شده`name`می تواند باعث شکست کشف شود.
- يه چيز مبهم`description`می تونه درخواست های اشتباه رو رو هدایت کنه
- يه پرچم فقط براي انسان مي تونه مهارت رو از فهرست مدل خارج کنه
- اجازه ابزار می تواند تغییر کند که آیا میزبان از اجازه می خواهد.
- تنظیمات زمینه می توانند اجرای را به یک جلسه عامل جداگانه منتقل کنند.

فرنت ماتر را مانند کد پیکربندی بررسی کنید، آن را تأیید کنید، نسخه آن را، و رفتار آن را در ارزیابی ها شامل کنید.

### چرخه زندگی مهارت

```figure
skill-runtime-lifecycle
```

هر تير يه مرز با حالت شکست خودشون هست

1. **Discovery**پیدا کردن بسته های احتمالی در مکان های پیکربندی شده.
2. **Validation**بسته های نادرست یا ناامن را قبل از انتشار کتالوگ رد می کند.
3. **Cataloging**يه کمکته رو افشا ميکنه`name`و`description`، نه بسته کامل
4. **Selection**تصمیم می گیرد که آیا مهارت مربوطه است یا خیر.
5. **Activation**بدن را به یک زمینه قابل مشاهده مدل می کند.
6. **Disclosure**فقط وقتی که یک شعبه به آن ها نیاز دارد، مرجع ها یا دارایی ها را می خواند.
7. **Execution**استفاده از ابزار میزبان تحت اجازه و قوانین انزوا میزبان.
8. **Verification**بررسی آثار هنری تولید شده را به طور مستقل از ادعای مدل انجام می دهد.

یک مهارت کشف شده فعال نیست. یک مهارت فعال مجاز نیست که همه آنچه را که توصیف می کند انجام دهد. یک تماس مجاز به ابزار اثبات درستی نتیجه نیست.

### مهارت ها و ابزارها همگوني هستند

MCP پاسخ می دهد: "این برنامه چه قابلیت هایی را می تواند به آن ها نیاز داشته باشد و طرح های آنها چیست؟" یک مهارت پاسخ می دهد: " چگونه یک عامل باید به این کلاس کار نزدیک شود؟"

```figure
skill-tool-orthogonality
```

مهارت ممکن است یک ابزار را نام دهد، اما میزبان مالک ثبت قابلیت های واقعی است. اگر ابزار غائب باشد، مهارت باید به وضوح یک شکست یا شکست را بیان کند. هرگز نباید به این معنی باشد که نامگذاری یک قابلیت ایجاد می کند.

### مهارت ها و دستورالعمل های مخزن دامنه های مختلف هستند

دستورالعمل های مخزن محیط را توصیف می کند که شما در آن هستید: دستورات، کنوانسیون ها، فایل های تولید شده و مرزهای. یک مهارت روش قابل استفاده مجدد برای یک کار را فراهم می کند که ممکن است در بسیاری از مخزن ها رخ دهد.

هنگامی که هر دو مورد مورد مورد استفاده قرار می گیرند، درخواست کاربر فعال و قوانین مخزن مهارت را محدود می کند. یک مهارت بازتولید عمومی نباید از یک قانون مخزن که از ویرایش فایل های تولید شده منع می کند، رد شود.

### مهارت ها همدیگر را وارد نمی کنند

یک مهارت می تواند عامل را هدایت کند تا دیگری را فراخ بگیرد، اما این یک واردات سطح زبان نیست. مهارت دوم هنوز از طریق کشف زمان اجرا، واجد شرایطی، فعال سازی، مجوزها و مدیریت زمینه انجام می شود.

وابستگی های بین مهارت ها را به عنوان حواشی از جریان کار قابل مشاهده بنویسید:

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

این باعث می شود وابستگی قابل آزمایش باشد و میزبان را فرصتی برای اجرای سیاست فراهم کند.

## آن را بسازید

`code/main.py`یک اعتبار دهنده استاندارد کوچک و یک انتخاب کننده آرتیفکت را اجرا می کند. این تنها stdlib باقی می ماند تا هر قاعده قابل مشاهده باشد.

اعتبار دهنده نشان می دهد:

- `parse_frontmatter(text)`برای جدا کردن متاداتا از بدن
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`برای بررسی زمینه های مورد نیاز، نامگذاری، تمدید نامعلوم، حضور بدن و محدودیت های قابل حمل.
- `ValidationIssue`و`SkillReport`برای بازگشت شواهد ساختاری به جای یک boolean نامشفق.
- `FrontmatterSyntaxError`برای ورودی که نمی تواند به طور ایمن تفسیر شود.

انتخاب کننده نشان می دهد`TaskShape`و`select_primitives(task)`. نیاز یک کار را به کد معمولی، دستورالعمل های مخزن، مهارت، یک هک، یک زیرکاره یا یک ابزار MCP نقشه می زند.

آزمایشگاه رو اداره کن

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

اين بلوک فرماني به يك کلون محلي نياز داره و بايد از هر جا داخل شروع بشه
اون کلون رو هم`git rev-parse --show-toplevel`ميتونه ریشه مخزن رو حل کنه

در این نسخه JSON برای یک مهارت قابل حمل معتبر، یک مهارت میزبان گسترش یافته، یک بسته غیرفعال و چندین تصمیم در شکل کار چاپ می شود. کد های مسئله را بررسی کنید. یک اعتبار دهنده بسته باید توضیح دهد که چگونه یک اثر را بدون حدس زدن به نمایندگی از نویسنده درست کنید.

### مسئله ی سفارش اعتبار

تایید حقایق ساختاری ارزان قبل از قوانین عمیق تر:

```figure
skill-validation-order
```

این ترتیب از اشتباهات ثانویه جلوگیری می کند تا اولین غیر متغیر شکسته را پنهان کند.

## ازش استفاده کن

قبل از نوشتن مهارت، این کارت تصمیم را پر کنید:

| Question | If yes | Likely primitive |
|---|---|---|
| Does this need reusable model judgment across several steps? | The procedure is stable but decisions vary | Skill |
| Must this happen every time an event fires? | Missing one execution is unacceptable | Hook or application code |
| Does the model need an external capability with typed inputs? | The operation lives outside model context | Tool or MCP server |
| Does the work need isolated context, state, or ownership? | A separate worker returns a bounded result | Subagent |
| Is this guidance specific to one repository? | It describes local commands and constraints | Repository instructions |
| Is one interaction enough? | No package lifecycle is needed | Prompt |

بسیاری از جریان های کاری تولید از بیش از یک ردیف استفاده می کنند. کارت مانع از یک اثر از تظاهر به ارائه هر ملک می شود.

## -باده

این درس باعث می شه`skill-contract-reviewer`بسته زیر`outputs/`. شامل:

- یک موبایل`SKILL.md`که یک بسته مهارت پیشنهادی را بررسی می کند؛
- چک لیست مرجع برای قرارداد حمل پذیر و انتخاب اولیه؛
- یک اسکریپت تأیید تعیین کننده؛
- وسایل شکل کاری که شامل پیام ها، مهارت ها، ابزارها، هک ها، کد معمولی و زیرکد ها می باشد.

بسته کامل را نصب کنید، نه تنها فایل ورودی آن:

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

نصب کننده دوره گزارش هر مهارت مرحله 13 کپی شده و می نویسد
`/tmp/aiefs-skills/manifest.json`این مقصد تمیز شکل بسته را بررسی می کند
حلقه موفقیت اول بالا کشف و دعوت را در یک میزبان واقعی بررسی می کند.

دروس زیر هر مرحله چرخه زندگی را عمیق تر می کند. درس 24 کشف و افشای تدریجی را ایجاد می کند. درس 25 سیاست دعوت و مسیر را ایجاد می کند. درس 26 مجوزها را از sandboxing جدا می کند. درس 27 کل بسته را به یک اثر آزادسازی ارزیابی می کند.

## تمرینات

1. پنج جریان کار را از تیم خود با استفاده از `TaskShape`هر پرونده ای که بیش از یک ابتدایی را انتخاب کنی دفاع کن
2. اضافه کردن تست های مرزی که ثابت می کند که یک 500 حرف`compatibility`ارزش عبور می کند و یک مقدار 501 کاراکتر به عنوان یک خطا مشخصات شکست می خورد.
3. یک تمدید زمان اجرا را به لیست اجازه دهید. یک آزمون بنویسید که ثابت کند همان فایل هنوز هم قابل تشخیص از یک مهارت فقط قابل حمل است.
4. يه خط 400 رو به قسمت 2 تقسیم کن`SKILL.md`، یک مرجع، یک قرارداد اسکریپت و یک قالب خروجی.
5. یک پاسخ شکست برای یک مهارت طراحی کنید که به یک ابزار MCP در دسترس نیست. به صورت ساکت ابزار را با مجوزهای گسترده تر جایگزین نکنید.
6. مهارت موجود را بررسی کنید و هر جمله را به عنوان مسیر، روش، سیاست، اشاره کننده مرجع یا قرارداد خروجی برچسب بزنید. هر چیزی که متعلق به آن نیست را حرکت دهید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|---|---|---|
| Agent skill | "A saved prompt" | A discoverable directory of procedural instructions and optional resources |
| Portable core | "Fields every runtime shares" | The contract defined by the Agent Skills specification |
| Runtime extension | "Extra frontmatter" | Host-specific configuration whose behavior requires a compatible adapter |
| Activation | "The skill ran" | The skill body entered model-visible context; execution may come later |
| Skill dependency | "Import another skill" | A runtime-mediated invocation edge with availability and policy checks |
| Tool contract | "A function schema" | Inputs, outputs, permissions, side effects, errors, and evidence for a capability |

## خواندن بیشتر

- [Agent Skills specification](https://agentskills.io/specification)برای دفترچه قابل حمل و قرارداد مقدم.
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)برای دامنه، دستورالعمل ها و سازمان منابع.
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)برای رفتار کشف و دعوت کنونی کدکس.
- [Claude Code skills](https://code.claude.com/docs/en/skills)برای یک زمان اجرا، درخواست، استدلال، ابزار و تمدیدات متن مرجع شده.
