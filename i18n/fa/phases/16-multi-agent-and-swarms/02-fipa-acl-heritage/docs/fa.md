# میراث FIPA-ACL و قوانین سخنرانی

> قبل از MCP، قبل از A2A، FIPA-ACL وجود داشت. در سال 2000 بنیاد اجنتی های فیزیکی هوشمند (FIPA که در سال 2005 به کمیته استاندارد های انجمن کامپیوتر IEEE تبدیل شد) یک زبان ارتباطی اجنتی با بیست عملکردی، دو زبان محتوا و مجموعه ای از پروتکل های تعامل را تصویب کرد. این از صنعت محو شد زیرا هزینه های آنتولوژی برای وب بیش از حد سنگین بود، اما احیای LLM از سیستم های چند عامل به طور آرام همان ایده ها را بدون معنای رسمی پیاده سازی می کند: قراردادهای JSON برای عملکردی ها، زبان طبیعی برای آنتولوژی ها است. این درس به طور جدی FIPA-ACL را می خواند تا بتوانید ببینید که کدام تصمیمات پروتکل 2026 دوباره اختراع شده اند، که چه چیزی جدید است، و در کجا موج فعلی مشکلات حل شده در دهه 2000 را دوباره کشف می کند.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## مشکل

چشم انداز پروتکل عامل در سال 2026 پرش است: MCP برای ابزارها، A2A برای عوامل، ACP برای حسابرسی شرکت، ANP برای اعتماد غیرمتمرکز، NLIP برای محتوای زبان طبیعی، به علاوه CA-MCP و دو دو دوزنه پیشنهاد تحقیقاتی. هر مشخصه خود را به عنوان اساسی اعلام می کند.

صادقانه میگم که بیشتر آنها در حال کشف یک درخت تصمیم گیری ۲۰ ساله هستند. نظریه گفتار عمل از اوستن (1962) و سیرل (1969) به ما "گفتار ها عمل هستند". KQML (1993) این را به یک پروتکل سیم تبدیل کرد. FIPA-ACL (تصدیق شده در سال 2000) استاندارد سازی مرجع را ارائه داد: بیست عملکردی، زبان های محتوا SL0/SL1، پروتکل های تعامل برای شبکه قرارداد و اشتراک- اطلاع رسانی. JADE و JACK پلتفرم های مرجع جاوا بودند. تلاش در حدود سال 2010 محو شد زیرا هزینه های آنتولوژی بیش از حد سنگین بود و وب برنده بود.

وقتی به MCP نگاه می کنی`tools/call`در این زمینه، شما در حال بررسی یک تغییر نرم تر و بومی JSON از تصمیمات FIPA هستید. دانستن میراث به شما دو چیز می گوید: چه "تفکری" جدید در واقع اختراع مجدد هستند و چه حالت های شکست قدیمی مشخصات جدید دوباره کشف می شود.

## مفهوم

### اعمال سخنرانی، در یک پاراگراف

اوستن متوجه شد که برخی جملات جهان را توصیف نمی کنند بلکه آن را تغییر می دهند. "به من قول ميدم" "من درخواست ميکنم" "من اعلام ميکنم" اون اين حرف ها رو "استفاده هاي انجامي" مي نامد. سیریل پنج دسته را رسمی کرد: اصرار، دستورالعمل، کمیسیو، بیان، اعلامی. KQML (Finin و همکارانش، 1993) این را برای عوامل نرم افزار عملی کرد: یک پیام یک عملکرد (کار) به علاوه محتوای (چه کار در مورد است). FIPA-ACL شکاف های KQML را تمیز کرده و حدود بیست عملکرد را استاندارد کرده است.

### بیست عملکردی FIPA (درآمدی جزئی)

| Performative | Intent |
|---|---|
| `inform` | "I tell you P is true" |
| `request` | "I ask you to do X" |
| `query-if` | "Is P true?" |
| `query-ref` | "What is the value of X?" |
| `propose` | "I propose we do X" |
| `accept-proposal` | "I accept the proposal" |
| `reject-proposal` | "I reject the proposal" |
| `agree` | "I agree to do X" |
| `refuse` | "I refuse to do X" |
| `confirm` | "I confirm P is true" |
| `disconfirm` | "I deny P" |
| `not-understood` | "Your message did not parse" |
| `cfp` | "Call for proposals on X" |
| `subscribe` | "Notify me when X changes" |
| `cancel` | "Cancel the ongoing X" |
| `failure` | "I tried X and failed" |

لیست کامل در اینجاست`fipa00037.pdf`نکته این نیست که آن را به یاد داشته باشید، نکته این است که هر یک از این موارد با یک پروتکل اولیه مطابقت دارد که یک پروتکل LLM در نهایت دوباره اضافه می کند.

### پیام کنونیک FIPA-ACL

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

هفت زمینه بر روی پاکت پروتکل قرار دارد؛ یک میدان (`content`بقیه ی زمینه ها دقیقا همان چیزی هستند که هر بار که دوباره تلاش، رشته و اونولوژی را روی پروتکل JSON ایجاد می کنید.

### دو پلتفرم قدیمی

**JADE**(Java Agent DEvelopment framework, 19992020s) زمان اجرا مطابق با FIPA مورد استفاده قرار گرفت. عوامل یک کلاس پایه را گسترش دادند، پیام های ACL را تبادل کردند، در داخل کانتینر اجرا کردند و با استفاده از "رفتارها" هماهنگ شدند. کتابخانه پروتکل تعامل با قرارداد-net، اشتراک-اطلاع، درخواست-زمان و پیشنهاد-قبل ارسال شد.

**JACK**(برنامه ای که به عوامل هدایت می شود، تجاری) استدلال BDI (اعتقاد-خواهی-عزم) را در بالای پیام های FIPA تاکید کرد. رسمی تر، کمتر پذیرفته شده است.

هر دو پس از اینکه یک استیک وب موارد استفاده از چندین عامل را خورد، کاهش یافتند. MCP و A2A "کنتینر" زمان اجرا در سال 2026 هستند.

### چرا FIPA محو شد

- **Ontology overhead.**FIPA نیاز به یک اونتولوژی مشترک برای تجزیه و تحلیل داشت`content`توافق در مورد اونتولوژی ها یک فرآیند استانداردی سال هاست. وب فقط از HTTP + JSON استفاده کرده است.
- **Formal semantics nobody used.**SL (زبان معنوی) شرایط دقیق حقیقت را ارائه داد، اما اکثر سیستم های تولید از محتوای فرم آزاد استفاده می کردند و فرمالیت را نادیده می گرفتند.
- **Tooling lock-in.**جید فقط به جاوا بود، جاک تجاری بود. تیم های چند زبانی در اطراف هر دو راه می رفتند.
- **The internet won the stack.**REST، بعد JSON-RPC، بعد gRPC جایگزین انتقال ACL شد.

### احیای LLM FIPA-lite است

مقایسه یک FIPA`request`به یک MCP`tools/call`:

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

هر دو حامل: چه کسی، چه کسی، قصد، بار مفید، ارتباط ID. هیچ یک از انقلاب بر روی دیگر نیست.

بررسی سال 2025 توسط لیو و همکاران ("مطالعه پروتکل های همکاری عامل: MCP، ACP، A2A، ANP"، arXiv:2505.02279) این سلسله را واضح می کند: MCP به اقدامات گفتاری استفاده از ابزار، A2A به اقدامات گفتاری عامل-دوست، ACP به اقدامات گفتاری ردیابی بازرسی، ANP به تمدیدات هویت غیرمتمرکز است. مشخصات جدید نسل ACL با سنتکس JSON و سیمانیک نرم تر است.

### معامله، به وضوح اعلام شده

**What FIPA gave you and modern specs drop:**

- معنوی رسمی  می تونید ثابت کنید `inform`این بدان معناست که فرستنده به محتوای آن اعتقاد دارد.
- یک کتالوگ کامونیک از اجراات  شما مجبور نیستید دوباره استدلال کنید "اگر ما باید یک `cancel`؟ "
- دهه ها از الگوهای تعامل-پروتوکول  قرارداد-شبکه، اشتراک-اطلاعات، پیشنهاد- پذیرش  با ویژگی های درستگی شناخته شده.

**What modern specs give you and FIPA did not:**

- بارهای مفید بومی JSON با هر ابزار مدرن سازگار است.
- محتوای زبان طبیعی که LLM ها بدون آنتولوژی دستکاری می توانند تفسیر کنند.
- حمل و نقل وب استیک (HTTP، SSE، WebSocket).
- کشف قابلیت ها از طریق MCP زنده `server/discover`و کارت هاي مامور A2A

معنای هدف نرم تر برای پیاده سازی آسان تر. این دقیقا تجارت است.

### پروتکل های تعامل که ارزش پورت کردن دارند

FIPA 15 پروتکل تعامل را ارسال کرد. سه مورد ارزش انتقال به سیستم های چند عامل LLM را دارند:

1. **Contract Net Protocol (CNP).**مسائل مدیر`cfp`(دعوت به ارائه پیشنهادات) ، داوطلبان پاسخ می دهند:`propose`این الگوی معمول بازار کار است (فاز 16 · 16 مذاکره).
2. **Subscribe/Notify.**اشتراکگر ارسال می کند`subscribe`؛ ناشر ارسال می کند `inform`هر وقت موضوع عوض بشه. این هر رویداد-بس در سال 2026 است.
3. **Request-When.**"X را انجام دهید وقتی شرایط Y برقرار است". عمل تاخیر شده با شرایط پیش فرض. 2026 آنالوگ وظایف تأخیر شده در موتورهای جریان کار پایدار است (فاز 16 · 22 مقیاس تولید).

هر نقشه به طور تمیز به صف های پیام مدرن، نظرسنجی HTTP + یا پخش SSE می پردازد.

### وقتی اونتولوژی رو کنار میذاری چه شکافی میخوای؟

بدون یک اونتولوژی مشترک، عوامل از محتوای زبان طبیعی معنی را نتیجه می دهند. حالت شکست 2026 مستند شده است.**semantic drift**: دو عامل از همان کلمه استفاده می کنند (`"customer"`) برای مفاهیم متفاوت، نماینده گیر بر اساس تفسیر اشتباه عمل می کند، هیچ تأیید کننده طرح آن را نمی گیرد.

کاهش بدون رفتن به آنتولوژی کامل:

- طرح JSON در `content` خطا های ساختاری در سیم را رد می کند.
- آثار هنری تایپ شده (A2A)  روش های نادرستی را رد می کند.
- عملکردی صریح در پاکت  باعث می شود که هدف یکجنگ باشد حتی زمانی که محتوای آن زبان طبیعی باشد.

### مشخصات 2026، نقشه برداری شده به میراث گفتار عمل

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

در خواندن جدول از بالا تا پایین، الگوی این است: ساختار اولیه را حفظ کنید، فرمالیت را رها کنید، اجازه دهید LLM ها بر روی مبهمیت کاغذی باشند.

```figure
sw-contract-net
```

## آن را بسازید

`code/main.py`این برنامه یک مترجم FIPA-ACL خالص است. این پاکت ACL کانونیک را کدگذاری و رمزگذاری می کند و نشان می دهد که چگونه هر شکل پیام MCP / A2A به همان هفت زمینه کاهش می یابد.

- پنج پیام به سبک MCP و A2A را به عنوان FIPA-ACL رمزگذاری می کند.
- فايپا-ACL را به معادل مدرن بازمی گرداند.
- معامله ای که توسط یک مدیر و سه داوطلب انجام می شود`cfp`،`propose`،`accept-proposal`،`reject-proposal`. .

راه رفتن:

```
python3 code/main.py
npx tsx code/main.ts
```

محصول یک ردیابی در کنار هم است که هر پیام مدرن را در هر دو شکل JSON 2026 و شکل FIPA-ACL نشان می دهد، سپس یک سفر برگشت از یک پیشنهاد قرارداد-شبکه است. همان پروتکل های اولیه از سفر برگشت زنده می مانند؛ تنها سنتکس متفاوت است.

## ازش استفاده کن

`outputs/skill-fipa-mapper.md`این مهارت است که هر مشخصات پروتکل عامل را می خواند و نقشه برداری FIPA-ACL را تولید می کند. قبل از اتخاذ پروتکل جدید از آن استفاده کنید تا پاسخ دهید: "آیا این واقعاً جدید است، یا آیا این`inform`با ترکیب JSON؟"

## -باده

فايپا-ACL رو برگردونيد.

- هدف اولیه (فعالیت) هر پیام چیست؟
- آیا یک شناسه مرتبط برای درخواست پاسخ و لغو وجود دارد؟
- آیا یک زبان محتوای صریح (JSON-RPC، متن ساده، آرتیفکت تایپ شده ساختار یافته) وجود دارد؟
- پروتکل های تعامل درجه اول هستند یا شما دوباره از نو به کار می برید؟
- چه اتفاقی می افتد وقتی دو عامل در مورد معنی محتوا (دریفت معنوی) اختلاف نظر دارند؟

این پنج سوال رو برای هر پروتکل جدید قبل از اینکه به تولید بفرستید مستند کنید.

## تمرینات

1. فرار کن`code/main.py`. مشاهده کدگذاری سفر برگشت و برگشت. شناسایی کنید که عملکرد FIPA به چه نوع است`tools/call`،`resources/read`، و ایجاد وظایف A2A
2. نمایش شبکه قرارداد را با یک`cancel`عملکردي که به مدير اجازه ميده تا کار رو وسط عرض بکشه`cancel`فقط اين تلاش ها رو حل ميکنه؟
3. ساختار پیام ACL FIPA را بخوانید (http://www.fipa.org/specs/fipa00037/) بخش 4.14.3 یک عملکردی را که در این درس پوشش داده نشده است انتخاب کنید و آنالوگ JSON-RPC مدرن را توصیف کنید.
4. لیو و همکارانش را بخوانید. arXiv:2505.02279. برای هر یک از MCP، A2A، ACP، ANP، خانواده های عملکردی FIPA را که نگه می دارند و رها می کنند، لیست کنید.
5. طراحی یک JSON-Schema حداقل برای `content`میدان یک`request`این طرح چه چیزی را به شما می دهد که زبان طبیعی خالص نمی کند و چه هزینه ای دارد؟

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions. The theoretical parent of ACL. |
| FIPA | "That old XML thing" | Foundation for Intelligent Physical Agents. Standardized ACL in 2000; became an IEEE Computer Society standards committee in 2005. |
| ACL | "Agent Communication Language" | FIPA's envelope format: performative + content + metadata. |
| Performative | "The verb" | The intent class of a message: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993). Simpler, narrower. |
| Ontology | "Shared vocabulary" | A formal definition of the concepts the content language talks about. |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1 — the formal content language family. |
| Contract Net | "Task market" | Manager issues cfp; bidders propose; manager accepts. The canonical interaction protocol. |
| Interaction protocol | "Pattern of messages" | A sequence of performatives with known correctness: request-when, subscribe-notify, etc. |

## خواندن بیشتر

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) بررسی کنونیکی سال 2025 که مشخصات مدرن را با میراث FIPA مرتبط می کند
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) شکل پاکت 2000 تایید شده
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) کتاگول کامل عملکردی
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) معادل استفاده از ابزار بدون دولت فعلی `request`-بله .`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/) معادل مدرن عامل-برابر از قرارداد-شبکه و اشتراک-بخاطر
