# ماموران مرورگر و وظایف وب بلندمدت

> عامل ChatGPT (یولای 2025) آپراتور و تحقیقات عمیق را به یک عامل مرورگر / ترمینال ادغام کرد و BrowseComp SOTA را به 68.9٪ تنظیم کرد. OpenAI 31 اوت 2025 Operator را خاموش کرد خرید ورسیپتی آنترپیک کلود سونت را در OSWorld از زیر 15٪ به 72.5٪ منتقل کرد. WebArena-Verified (ServiceNow، ICLR 2026) نرخ منفی دروغین ~11.3٪ را در WebArena اصلی ثابت کرد و زیر مجموعه 258 وظیفه سخت را ارسال کرد. اعداد واقعی هستن سطح حمله نیز همینطور است: رئیس آماده سازی OpenAI اعلام کرد که تزریق ناڕاستانه فوری به عوامل مرورگر "یک خطای نیست که می تواند به طور کامل اصلاح شود". حملات مستند شده 20252026: خاطرات آلوده (اتلاس CSRF) ، هاش جک (کاتو شبکه ها) و ربودن یک کلیک در کمت تعصب.

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## مشکل

یک عامل مرورگر یک عامل طولانی است که محتوای غیرقابل اعتماد را می خواند و اقدامات بعدی را انجام می دهد. هر صفحه ای که آژانس بازدید می کند ورودی است که کاربر ننوشته است. هر فرم در هر صفحه یک کانال فرمان بالقوه است. کورپوس حمله 20252026 نشان می دهد که این فرضیه نیست: خاطرات آلوده اجازه می دهد تا مهاجم دستورالعمل های مخرب را از طریق یک صفحه ساختگی به حافظه عامل متصل کند. HashJack دستورات را در قطعات URL که عامل بازدید می کند پنهان می کند. ربات های کمات گیج کننده یک کلیک را انجام می دهند.

تصویر دفاعی ناراحت کننده است. رئیس آماده سازی OpenAI گفت که بخش آرام بلند: تزریق فوری غیرمستقیم "یک خطای نیست که به طور کامل قابل اصلاح است". این به این دلیل است که حمله در مرز خواندن به عمل عامل زندگی می کند، که معماری مبهم است.

این درس سطح حمله را نام می دهد، چشم انداز مرجع را نام می دهد (BrowseComp، OSWorld، WebArena-Verified) و یک سناریوی کوچک تزریق فوری غیر مستقیم را مدل می کند تا بتوانید در درس 14 و 18 درباره دفاع های واقعی استدلال کنید.

## مفهوم

### منظره 2026، در یک پاراگراف در هر سیستم

**ChatGPT agent (OpenAI).**در جولای 2025 راه اندازی شد. آپریتر (بررسی) و تحقیقات عمیق (تحقیق چند ساعته) را متحد می کند. آپریتر مستقل را در تاریخ 31 اوت 2025 تعطیل می کند. SOTA در BrowseComp به 68.9٪؛ اعداد قوی در OSWorld و WebArena-Verified.

**Claude Sonnet + Vercept (Anthropic).**خرید ورسیپتی آنترپیک بر قابلیت های استفاده از کامپیوتر متمرکز شد. کلاود سونت را در OSWorld از <15٪ به 72.5٪ منتقل کرد. کلاود کامپیوتر به عنوان یک API ابزار استفاده می کند.

**Gemini 3 Pro with Browser Use (DeepMind).**استفاده از مرورگر یکپارچه سازی کنترل های استفاده از کامپیوتر را ایجاد می کند؛ FSF v3 (اپریل 2026, درس 20) به طور خاص استقلال را در حوزه ML R&D ردیابی می کند.

**WebArena-Verified (ServiceNow, ICLR 2026).**یک مشکل خوب مستند را حل می کند: WebArena اصلی دارای نرخ منفی غلط ~11.3% بود (کار هایی که نشان داده شده بودند که در واقع حل نشده بودند). نسخه تایید شده با معیارهای موفقیت انسان تنظیم شده دوباره رتبه بندی می شود و زیر مجموعه 258 کار سخت را اضافه می کند (ورق ICLR 2026 ، openreview.net/forum?id=94tlGxmqkN).

### BrowseComp vs OSWorld vs WebArena

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

محورهای مختلف. نمره بالا BrowseComp می گوید که آژانس حقایق را پیدا می کند؛ نمی گوید که آژانس می تواند پرواز را رزرو کند. نمره OSWorld نزدیک تر به "آیا در سطح کار من کار می کند". WebArena-Verified نزدیک تر به "آیا می تواند جریان را به پایان برساند". هر تصمیم تولید نیاز به معیار است که با توزیع وظایف مطابقت دارد.

### سطح حمله، به نام

1. **Indirect prompt injection.**محتوای صفحه ای که به آن اعتماد نمی شود حاوی دستورالعمل است. آژانس آن ها را می خواند. آژانس آن ها را اجرا می کند. نمونه های عمومی: 2024 Kai Greshake و همکاران، 2025 کاغذ خاطرات آلوده، 2026 HashJack (کاتو شبکه ها).
2. **URL fragment / query injection.**.`#fragment`یا رشته سوال یک URL جستجو شده شامل دستورات است. هرگز به طور قابل مشاهده ارائه نشده است؛ هنوز هم در زمینه عامل است.
3. **Memory-binding attacks.**صفحه به عامل دستور می دهد تا یک حافظه پایدار بنویسد (درسه 12 وضعیت پایدار را پوشش می دهد). در جلسه بعدی، حافظه بار مفید را بدون محرک قابل مشاهده اجرا می کند.
4. **CSRF-shaped attacks on authenticated sessions.**کلاس حافظه های آلوده: عامل در جایی وارد شده است؛ صفحه مهاجم درخواست های تغییر وضعیت را که توسط عامل با کوکی های کاربر اجرا می شود، منتشر می کند.
5. **One-click hijack.**يه دکمه ي بصري بي ضرر به يه بار فايدي که مامور دنبالش ميکنه سوار ميشه
6. **Content-Security-Policy holes in the agent's host surface.**لایه های رندری و ابزار می توانند خود ویکتور های حمله باشند؛ ستک مرورگر در یک مرورگر- آژانس گسترده است.

### چرا "به طور کامل قابل اصلاح نیست"

حمله به توانایی عامل هم شکل داره مامور بايد مطالب ناشناس رو بخونه تا کارش رو انجام بده هر چيزي که مامور ميخواد ميتونه يه دستور باشه هر دستورالعمل ای که عامل دنبال می کنه ممکن است با درخواست واقعی کاربر اشتباه باشد. دفاعی (حدود اعتماد، طبقه بندی کننده، اجازه ابزار، HITL در اقدامات بعدی) هزینه حمله را افزایش می دهد و شعاع انفجار آن را کاهش می دهد. اونا کلاس رو نمي بندن

این همان الگوی استدلال با نظریه لوب (درس ۸) است: عامل نمی تواند نشان دهد که توکن بعدی امن است؛ فقط می تواند یک سیستم را در آن توکن های ناامن قابل تشخیص تر است.

### حالت دفاعي که در واقع سفينه ها

- **Read / write boundary.**خواندن هرگز نتیجه ای ندارد. نوشتن (فراندن فرم، ارسال محتوا، دعوت به یک ابزار با عوارض جانبی) نیاز به تأیید تازه انسانی دارد اگر محتوای آغاز کننده از خارج از مرز اعتماد آمده باشد.
- **Tool allowlist per task.**این عامل می تواند مرور کند؛ نمی تواند یک انتقال مالی را آغاز کند مگر اینکه این ابزار به طور صریح برای این کار فعال شده باشد.
- **Session isolation.**جلسات مأمور مرورگر فقط با اعتبارات محدودی اجرا می شود. هیچ نویسنده تولید، هیچ ایمیل شخصی. ثبت هر درخواست HTTP برای بررسی نگهداری می شود.
- **Content sanitizer.**HTML به دست آمده قبل از اینکه به متن مدل متصل شود از الگوهای بد شناخته شده خلاص می شود. (هجوم های آسان را کاهش می دهد؛ بار های مفید پیچیده را متوقف نمی کند.)
- **HITL on consequential actions.**الگوی پیشنهاد و سپس تعهد (درسی 15).
- **Canary tokens on memory.**اگر یک ورودی حافظه روشن شود، کاربر آن را می بیند (درس 14).

```figure
injection-boundary
```

## ازش استفاده کن

`code/main.py`یک صفحه خفیف است، یکی دارای یک نقطه تزریق مستقیم فوری در متن قابل مشاهده است، یکی دارای تزریق تکه URL (نه قابل مشاهده اما در زمینه عامل است). اسکریپت نشان می دهد (a) یک عامل ساده چه کاری می کند، (b) یک مرز خواندن / نوشتن چه چیزی را می گیرد، (ج) یک ضد عفونی کننده چه چیزی را می گیرد، (د) هیچ یک از آنها چه چیزی را نمی گیرد.

## -باده

`outputs/skill-browser-agent-trust-boundary.md`دامنه یک برنامه کاربردی برنامه بازرسان پیشنهاد شده: چه مناطق اعتماد را لمس می کند، چه چیزی را مجاز به نوشتن است و چه دفاعی ها باید قبل از اولین اجرا در محل باشند.

## تمرینات

1. فرار کن`code/main.py`. مشخص کنید که کدام حمله به وسیله ضد عفونی کننده می رسد اما مرز خواندن/ نوشتن نمی تواند و کدام حمله فقط به مرز خواندن/ نوشتن می شود.

2. تزریق کننده را برای تشخیص یک کلاس تزریق کنده URL به سبک HashJack گسترش دهید. نرخ مثبت دروغین را در URL های خفیف با کنده های مشروع اندازه گیری کنید.

3. یک جریان کاری واقعی برای یک عامل مرورگر را انتخاب کنید که می دانید (به عنوان مثال "هزینه پرواز را رزرو کنید"). هر خواندن و هر نوشتن را لیست کنید. نشان دهنده ای که می نویسد نیاز به HITL دارد و چرا.

4. مقاله ICLR 2026 WebArena-verified را بخوانید. یک دسته از وظایف را شناسایی کنید که در آن امتیاز اصلی WebArena غیرقابل اعتماد بود و توضیح دهید که چگونه زیر مجموعه Verified آن را حل می کند.

5. یک حافظه ی "کاناری" برای تنظیمات یک عامل مرورگر طراحی کنید. چه چیزی را ذخیره می کنید، کجا و چه چیزی هشدار را تحریک می کند؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## خواندن بیشتر

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) ادغام عملیات و تحقیقات عمیق؛ BrowseComp SOTA.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) سلسله عامل و معماری که تبدیل به نماینده ChatGPT شد.
- [Zhou et al. — WebArena](https://webarena.dev/) معیار اصلی
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) کاغذ ICLR 2026 با زیر مجموعه ثابت
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) شامل بحث سطح حمله برای عوامل استفاده از کامپیوتر است.
