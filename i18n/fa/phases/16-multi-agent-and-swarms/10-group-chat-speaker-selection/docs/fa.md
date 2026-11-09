# انتخاب گروه چت و سخنران

> سازش مکالمه مشترک، N عامل را در یک مکالمه قرار می دهد؛ یک تابع انتخاب کننده (LLM، round-robin یا custom) انتخاب می کند که چه کسی بعدی صحبت می کند. این آرشیتایپ گفتگوی چند عامل در حال ظهور است. عوامل نقش خود را در یک نمودار ثابت نمی دانند، آنها فقط به استخر مشترک واکنش نشان می دهند. AutoGen GroupChat و AG2 GroupChat پیاده سازی های مرجع هستند: سیمنتکس GroupChat AutoGen v0.2 در فورک AG2 حفظ شد؛ AutoGen v0.4 آن را به عنوان یک مدل بازیگر مبتنی بر رویدادها دوباره نوشت. مایکروسافت AutoGen را در فوریه 2026 به حالت نگهداری قرار داد و آن را با هسته سیمانیک به Microsoft Agent Framework (RC فوریه 2026) ادغام کرد. گروه چت ابتدایی در هر دو AG2 و Microsoft Agent Framework زنده می ماند  یک بار یاد بگیرید، در هر جا استفاده کنید.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## مشکل

گراف های ثابت (LangGraph) وقتی جریان کار شناخته شده است عالی هستند. مکالمه واقعی ثابت نیستند: گاهی اوقات کدر از نظرسنجی، گاهی محقق، گاهی نویسنده می پرسد. هر ارسال ممکن را سخت کدگذاری می کند. شما می خواهید * عوامل واکنش نشان دهند به یک استخر مشترک *، با برخی از عملکرد تصمیم گیری که چه کسی بعدی صحبت می کند.

این دقیقا کاری است که AutoGen GroupChat انجام می دهد.

## مفهوم

### شکل

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

هر مامور هر پيام رو مي بينه و در هر نوبت يه تابع انتخابي براي انتخاب کسي که بعد صحبت مي کنه، به صداي مياد

### سه طعم انتخاب کننده

**Round-robin.**چرخه ثابت. تعیین کننده. مقیاس خطی در N اما متن را نادیده می گیرد  یک کدگر حتی زمانی که موضوع بررسی قانونی است، نوبت می گیرد.

**LLM-selected.**یک تماس به یک LLM که مجموعه اخیر را می خواند و بهترین سخنران بعدی را باز می گرداند. آگاه به زمینه اما کند: هر نوبت یک تماس LLM را اضافه می کند. پیش فرض AutoGen.

**Custom.**یک تابع پایتون با هر منطق که می خواهید. معمول: LLM با قوانین فال بیک انتخاب شده است (به عنوان مثال، "همیشه به تایید کننده نوبت بعد از کدر را بدهید").

### API ConversableAgent

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`وقتی یک عامل نوبت را تکمیل می کند، مدیر به انتخاب کننده زنگ می زند که عامل بعدی را باز می گرداند. حلقه تا شرط پایان ادامه می یابد.

### پایان دادن

سه الگوی مشترک:

- **Max rounds.**کلاه سخت در کل پیچ ها
- **"TERMINATE" token.**ماموران ميتونن يه پيام نگهباني بفرستند، مدیر وقتي که يکي از اونا ظاهر بشه متوقف ميشه
- **Goal-reached check.**یک تایید کننده سبک وزن هر نوبت را اجرا می کند و وقتی انجام شود مکالمه را متوقف می کند.

### نسب: فورک ها و ادغام ها

در اوایل سال 2025، مایکروسافت شروع به نوشتن مجدد عمده AutoGen (v0.4) در اطراف یک مدل بازیگر مبتنی بر رویدادها کرد. جامعه GroupChat GroupChat AutoGen v0.2 را به عنوان AG2 معرفی کرد. این API را که متعهد کنندگان اولیه آن را به هم متصل کرده بودند، حفظ کرد.

در فوریه 2026، مایکروسافت اعلام کرد که آتوژن به حالت نگهداری خواهد رفت، با ادغام مدل بازیگر مبتنی بر رویدادها به **Microsoft Agent Framework**(RC فوریه 2026 ، اکنون با هسته سیمانیک ادغام شده است). مفهوم GroupChat در هر دو مسیر زنده مانده است؛ جزئیات پیاده سازی متفاوت است. AG2 کد سازگار v0.2 است.

### وقتی که GroupChat مناسب است

- **Emergent conversations.**نمیخوای هر اسپکر بعدی رو پیش از این سیم کنی
- **Role-mixing tasks.**کدر از محقق می پرسد، محقق از آرشیوکار می پرسد، آرشیوکار از کدر می پرسد. جریان یک DAG نیست.
- **Exploratory problem-solving.**فکر کن "اجتماع طوفان مغزی" نه "خط جمع آوری"

### وقتی شکست می خورد

- **Strict determinism.**انتخاب کننده ی LLM ممکن است متناقض باشد، همان سرعت، اجراهای مختلف، سخنران های بعدی متفاوت.
- **Sycophancy cascades.**ماموران به هر کسي که با اعتماد به نفس صحبت مي کنه، رد ميکنن
- **Context bloat.**هر عامل هر پیام را می خواند؛ پس از 10 نوبت، زمینه بسیار بزرگ است. از پیش بینی ها (درس 15) برای دامنه دیدگاه استفاده کنید.
- **Hot speakers.**یک عامل بر مکالمه تسلط دارد چون انتخاب کننده تخصص های خود را ترجیح می دهد. تعادل سخنران را به عنوان ویژگی انتخاب کننده معرفی کنید.

### چت گروهی در مقابل سرپرست

همون ابتدایی ها، فرقی از پیش فرض:

- نظارت: یکی از ماموران برنامه ها و بقیه اجرا می کنند. انتخاب کننده " از برنامه نویس بپرسید چه کاری انجام دهد".
- چت گروهی: همه عوامل همسال هستند؛ انتخابگر یک تابع بر روی استخر مشترک است.

هر دو از چهار ابتدایی در درس 04 استفاده می کنند. چت گروهی به طور پیش فرض به آرکیستراسیون انتخاب شده توسط LLM و حالت مشترک کامل است.

```figure
swarm-speaker
```

## آن را بسازید

`code/main.py`در این برنامه، یک گروه چت از ابتدا در stdlib اجرا می شود. سه عامل (کدر، بازرس، مدیر) ، گزینه های راوند رابین و LLM انتخاب شده و یک پایان در یک`TERMINATE`. نشاني

نمایش نسخه ی مکالمه ی همراه با تصمیم گیری انتخاب کننده برای هر دو نسخه چاپ می شود.

راه رفتن:

```
python3 code/main.py
npx tsx code/main.ts
```

## ازش استفاده کن

`outputs/skill-groupchat-selector.md`تنظیم یک انتخاب کننده GroupChat برای یک کار داده شده  round-robin vs LLM-selected vs custom، و اینکه کدام ورودی انتخاب کننده (رساله های اخیر، تخصص های عامل، شمارش نوبت) را برای استفاده استفاده استفاده می کند.

## -باده

فهرست چک:

- **Max rounds cap.**هميشه 10-20 تا براي وظايف معمول
- **Speaker-balance metric.**مسیر به هر عامل تبدیل می شود؛ هشدار زمانی که عدم تعادل بیش از یک حد باشد.
- **Termination token.** `TERMINATE`یا یک عامل تایید کننده اختصاصی.
- **Projection or scoped memory.**پس از ~ 10 پیام، به هر عامل فقط یک دید محدودی را برای جلوگیری از انفجاری زمینه بدهید.
- **Selector logging.**برای انواع انتخاب شده LLM، هر دو ورودی انتخاب کننده و انتخاب آن را ثبت کنید. در غیر این صورت، دیبگ کردن غیرممکن است.

## تمرینات

1. فرار کن`code/main.py`.موازنه مکالمه تحت دور روبن با LLM انتخاب شده .کدوم مامور تحت هرکدوم تسلط داره؟
2. يه قاعده "به هر مامور حداکثر صحبت ميکنه" رو توي سلیکتور اضافه کنيد.
3. اجرای پایان نامه به هدف رسیده: وقتی بازبینی کننده "مقرر" می شود متوقف می شود.
4. اسناد ثابت AutoGen را در GroupChat بخوانید (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html). انتخاب کننده پیش فرض را که توسط `GroupChatManager`. .
5. گزارش AG2 را بخوانید (https://github.com/ag2ai/ag2) و مقایسه v0.2 GroupChat با نسخه v0.4 مبتنی بر رویداد. v0.4 چه ویژگی های خاص (توانایی، تحمل خطا، ترکیب پذیری) را اضافه می کند؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## خواندن بیشتر

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) اجرای مرجع
- [AG2 repo](https://github.com/ag2ai/ag2) جامعه AutoGen v0.2 ادامه
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) جانشین ادغام شده، RC فوریه 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) جزئیات تغییر نوشته مدل بازیگر مبتنی بر رویداد
