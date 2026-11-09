# چت بوت ها  قوانین مبتنی بر عصب به LLM عوامل

> ایلیزا با تطابق الگوها پاسخ داد. DialogFlow قصد را نقشه برداری کرد. GPT از وزن پاسخ داد. کلاود ابزارها را اجرا می کند و تأیید می کند. هر عصر بدترین شکست قبلی را حل می کند.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## مشکل

یک کاربر می گوید "من می خواهم پروازم را تغییر دهم". سیستم باید بفهمد که چه چیزی می خواهد، چه اطلاعاتی از دست می دهد، چگونه آن را بدست آورد و چگونه عمل را به پایان رساند. سپس کاربر می گوید "انتظار کنید، اگر من در عوض آن را لغو کنم؟" و سیستم باید زمینه را به یاد داشته باشد، وظایف را تغییر دهد و وضعیت را حفظ کند.

مکالمه برای یک سیستم ML دشوار است. ورودی باز است. خروجی باید در چندین نوبت همبستگی داشته باشد. ممکن است سیستم نیاز به عمل در جهان داشته باشد (پرواز تغییر کند، کارت شارژ کند). هر گام اشتباه برای کاربر قابل مشاهده است.

معماری چتبوت از طریق چهار پارادایم چرخه ای انجام شده است، هر کدام از آنها به دلیل اینکه یکی قبلی به طور قابل مشاهده شکست خورده است. این درس آنها را در ترتیب هدایت می کند. منظره تولید 2026 ترکیبی از دو گذشته است.

## مفهوم

![Chatbot evolution: rule-based → retrieval → neural → agent](../assets/chatbot.svg)

### نیمه قرن نوشته شده، 1950-2001

اولین پارادایم پنج سال دوام نیاورد. پنجاه سال دوام یافت. دانستن قوس آن مهم است زیرا هر سیستم در آن همان دستگاه است  واردات مطابقت دارد، یک پاسخ در کیسه ای ارسال می کند، یک حالت کوچک  را به روز می کند و پنجاه سال اضافه کردن قوانین به آن ماشین هرگز پرونده کلی را تولید نکرد. این سقف دلیل وجود پارادایم دو تا چهار است.

**1950.**تورینگ با پیشنهاد جایگزینی عملیاتی از "آیا ماشین ها می توانند فکر کنند؟" دور می رود: اگر یک بازجویی کننده نمی تواند ماشین را از یک فرد بر روی تلیپ تشخیص دهد، سوال فلسفی بحث برانگیز است. مکالمه قبل از اینکه میدان نام داشته باشد، معیار میدان می شود.

**1956.**نام این کارگاه در تابستان در دارتموث به عنوان "ذخیره سازی مصنوعی" در نظر گرفته شده است که هر ویژگی هوش "در اصل می تواند به گونه ای دقیق توصیف شود که یک ماشین برای شبیه سازی آن ساخته شود".

**1966.**ELIZA راه حل بازتاب را که در مرحله اول ایجاد می کنید ارسال می کند: قوانین تجزیه از ورودی ها را به صورت سوالات بازتاب می کند. حدود 200 الگوی کل، حالت صفر، درک صفر  و کاربران به هر حال به آن اعتماد می کنند. ویزنباوم بقیه عمر خود را به خاطر کمی ماشین آلات که نیاز دارد، نگرانانه گذراند.

**1972.**پارري که در استنفورد به عنوان مدل پارانوئیا ساخته شده است، اضافه می کند که ELIZA از آن کس نبود: حالت داخلی. متغیرهای عددی برای ترس، خشم و عدم اعتماد در هر نوبت و دروازه ای که اسکریپت بعدی را می کشد، به روز می شوند، بنابراین ورودی های یکسان به طور متفاوت بسته به مکالمه تا کنون پاسخ می دهند. در یک آزمایش نسخۀ کور، روانشناسان PARRY را از بیماران انسانی به طور تصادفی تشخیص دادند. این اجداد مستقیم شخصیت است  یک سیستم فوری که به عنوان سه شناور اجرا می شود. در همان سال، دو ربات به یکدیگر در ارپانت اشاره کردند: یک اسکریپت درمانگر مصاحبه با یک ماشین حالت پارانوئیا، اولین مکالمه ربات به ربات در یک شبکه.

**1995.**ALICE نسخه ELIZA را با AIML، یک گویش XML برای زوج های الگوی-نمونه مقیاس می دهد. حدود ۴۰ هزار دسته نوشته شده به دست، سه جایزه لوبنر برنده شده است. این قانون مقیاس بندی سیستم های مبتنی بر قوانین را ثابت کرد: قوانین بیشتر پوشش را می خرید، هرگز عمومی نیست. هر قانون یک مسئولیت است که کسی باید حفظ کند.

**2001.**SmarterChild این دستور را در مقابل 30 میلیون کاربر پیام رسان فوری قرار می دهد و جستجوی پس زمینه را اضافه می کند  آب و هوا، سهام، زمان فیلم  به قالب ها. Squint و این ابزار تماس با پوشیدن لباس سال 2001 است: قصد تجزیه و تحلیل، تماس با یک سرویس، نتیجه را به پاسخ ارائه می دهد.

پنجاه سال، یک مکانیسم، افزایش قاعده شمار می شود. پارادایم به این دلیل که کسی آن را رد نکرده است، پایان یافت، بلکه به این دلیل که هزینه نگهداری ماشین آلات دولتی دست نوشته با پوشش خطی رشد می کند در حالی که انتظارات کاربران با آنچه هفته گذشته دیدند رشد می کند.

```figure
chatbot-lineage
```

**Rule-based (ELIZA, AIML, DialogFlow).**الگوهای دست نوشته شده با ورودی کاربر مطابقت دارند و پاسخ ها را تولید می کنند. طبقه بندی کننده های قصد به جریان های پیش تعریف شده مسیر می یابند. ماشین های پر کردن اسلات اطلاعات مورد نیاز را جمع آوری می کنند. در داخل محدوده باریک طراحی شده برای آن به خوبی کار می کند. بلافاصله خارج از آن شکست می خورد. هنوز هم در حوزه های امنیتی حیاتی (صدی سازی بانکداری، رزرو هواپیمایی) که توهمات تحمل نمی شود، حمل می شود.

**Retrieval-based.**یک سیستم سبک سوالات عمومی. هر جفت از (تعبیر، پاسخ) را رمزگذاری کنید. در زمان اجرا، پیام کاربر را رمزگذاری کنید و نزدیکترین پاسخ ذخیره شده را بازپس بگیرید. به ویژگی کلاسیک "مقالات مشابه" Zendesk فکر کنید. فراریز ها را بهتر از قوانین اداره می کند. هیچ نسل، بنابراین هیچ توهم نیست.

**Neural (seq2seq).**کدگر-دکودر در روزنامه های مکالمه آموزش دیده است. پاسخ ها را از ابتدا تولید می کند. روان اما مستعد به خروجی عمومی ("من نمی دانم") و حرکت واقعی است. هرگز به طور قابل اعتماد در مورد موضوع. دلیل این است که گوگل، فیس بوک و مایکروسافت در سال های 2016-2019 همه چتبوت های ناامید کننده داشتند.

**LLM agents.**یک مدل زبان بسته شده در یک حلقه است که برنامه ریزی می کند، ابزارها را می خواند و نتایج را تأیید می کند. یک چت روت با یک پرامپت طولانی نیست. یک حلقه عامل: برنامه → ابزار تماس → مشاهده نتیجه → تصمیم گیری مرحله بعدی. زمین گیری اولین بازیافت (RAG) آن را از توهم جلوگیری می کند. تماس ابزار اجازه می دهد تا واقعا کارها را انجام دهد. این معماری 2026 است.

چهار پارادایم جایگزین های متوالی نیستند. یک چتبات تولید 2026 از طریق چهار روش: مبتنی بر قوانین برای تأیید هویت و اقدامات مخرب، بازیافت برای سوالات عمومی، تولید عصبی برای عبارت های طبیعی، عامل LLM برای سوالات باز و مبهم.

## آن را بسازید

### مرحله ی اول: تطابق الگوی مبتنی بر قوانین

```python
import re


class RulePattern:
    def __init__(self, pattern, response_template):
        self.regex = re.compile(pattern, re.IGNORECASE)
        self.template = response_template


PATTERNS = [
    RulePattern(r"my name is (\w+)", "Nice to meet you, {0}."),
    RulePattern(r"i (need|want) (.+)", "Why do you {0} {1}?"),
    RulePattern(r"i feel (.+)", "Why do you feel {0}?"),
    RulePattern(r"(.*)", "Tell me more about that."),
]


def rule_based_respond(user_input):
    for pattern in PATTERNS:
        m = pattern.regex.match(user_input.strip())
        if m:
            return pattern.template.format(*m.groups())
    return "I don't understand."
```

ELIZA در 20 خط. ترفند بازتاب ("من احساس غمگین هستم" → "چرا شما احساس غمگین هستید") یک دمو روانشناس کلیه از ویزنباوم 1966 است. هنوز هم آموزنده است.

### مرحله دوم: بر اساس بازیافت (FAQ)

این قسمت تصویربرداری نیاز به`pip install sentence-transformers`. (که مشعل را می کشد)`code/main.py`برای این درس به جای آن یک شباهت جیکارد stdlib استفاده می کند، بنابراین درس بدون وابستگی های خارجی اجرا می شود.

```python
from sentence_transformers import SentenceTransformer
import numpy as np


FAQ = [
    ("how do i reset my password", "Go to Settings > Security > Reset Password."),
    ("how do i cancel my order", "Go to Orders, find the order, click Cancel."),
    ("what is your return policy", "30-day returns on unused items, original packaging."),
]


encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
faq_questions = [q for q, _ in FAQ]
faq_embeddings = encoder.encode(faq_questions, normalize_embeddings=True)


def faq_respond(user_input, threshold=0.5):
    q_emb = encoder.encode([user_input], normalize_embeddings=True)[0]
    sims = faq_embeddings @ q_emb
    best = int(np.argmax(sims))
    if sims[best] < threshold:
        return None
    return FAQ[best][1]
```

رد بر اساس حد بندی انتخاب اصلی طراحی است. اگر بهترین تطابق به اندازه کافی نزدیک نباشد، برگردید `None`و اجازه بدیم سیستم افزایش یابد.

### مرحله 3: تولید عصبی (بنیاد پایه)

از یک کدگر کوچک و تنظیم شده با دستورالعمل استفاده کنید (FLAN-T5) یا یک مدل مکالمه ای دقیق. تولید غیر قابل استفاده در سال 2026 (تناقض، غیردردستری، بی معنی واقعی) ، اما کشتی ها در سیستم های هیبریدی برای عبارت طبیعی. مدل های فقط با کدگر به سبک DialoGPT برای تولید پاسخ های منسجم به جداکننده های باری صریح و کنترل EOS نیاز دارند؛ یک خط لوله متن متن FLAN-T5 برای مثال آموزشی از جعبه خارج می شود.

```python
from transformers import pipeline

chatbot = pipeline("text2text-generation", model="google/flan-t5-small")

response = chatbot("Respond politely to: Hi there!", max_new_tokens=40)
print(response[0]["generated_text"])
```

### مرحله 4: حلقه ی عامل LLM

شکل تولید 2026:

```python
def agent_loop(user_message, tools, llm, max_steps=5):
    history = [{"role": "user", "content": user_message}]
    for _ in range(max_steps):
        response = llm(history, tools=tools)
        tool_call = response.get("tool_call")
        if tool_call:
            tool_name = tool_call.get("name")
            args = tool_call.get("arguments")
            if not isinstance(tool_name, str) or tool_name not in tools:
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": str(tool_name), "content": f"error: unknown tool {tool_name!r}"})
                continue
            if not isinstance(args, dict):
                history.append({"role": "assistant", "tool_call": tool_call})
                history.append({"role": "tool", "name": tool_name, "content": f"error: arguments must be a dict, got {type(args).__name__}"})
                continue
            fn = tools[tool_name]
            result = fn(**args)
            history.append({"role": "assistant", "tool_call": tool_call})
            history.append({"role": "tool", "name": tool_name, "content": result})
        else:
            return response["content"]
    return "I could not complete the task in the step budget."
```

سه چیز برای نام دادن. ابزارها عملکردهای قابل تماس هستند که LLM می تواند به آنها اشاره کند. حلقه زمانی که LLM پاسخ نهایی را به جای یک تماس ابزار به آنها می دهد، پایان می یابد. بودجه مرحله ای از حلقه های بی نهایت در وظایف مبهم جلوگیری می کند.

تولید واقعی اضافه می کند: بازیافت-اول زمین (دک های مربوطه را قبل از هر تماس LLM تزریق کنید) ، محافظ (حرکت های مخرب را بدون تأیید رد کنید) ، مشاهده (هر مرحله را ثبت کنید) و ارزیابی ها (تحقیقات خودکار که رفتار عامل در زمان مشخص باقی می ماند).

### مرحله 5: مسیرهای هیبریدی

```python
def hybrid_chat(user_input):
    if is_destructive_action(user_input):
        return structured_flow(user_input)

    faq_answer = faq_respond(user_input, threshold=0.6)
    if faq_answer:
        return faq_answer

    return agent_loop(user_input, tools, llm)


def is_destructive_action(text):
    danger_words = ["delete", "cancel", "charge", "refund", "transfer"]
    return any(w in text.lower() for w in danger_words)
```

الگوی: قوانین تعیین کننده برای هر چیزی که نابود کننده است، بازیافت برای سوالات کنسری، عوامل LLM برای همه چیز دیگر. این چیزی است که در 2026 سیستم های پشتیبانی از مشتری می فرستند.

## ازش استفاده کن

دسته 2026:

| Use case | Architecture |
|---------|---------------|
| Booking, payment, authentication | Rule-based state machines + slot filling |
| Customer support FAQs | Retrieval over curated answers |
| Open-ended help chat | LLM agent with RAG + tool calls |
| Internal tools / IDE assistants | LLM agent with tool calls (search, read, write) |
| Companion / character chatbots | Tuned LLM with persona system prompt, retrieval on knowledge |

همیشه از رویت های هیبریدی در تولید استفاده کنید. هیچ معماری ای به خوبی با هر درخواست برخورد نمی کند. لایه رویت خود معمولا یک طبقه بندی کننده قصد کوچک است.

## حالت شکست که هنوز هم ارسال می شود

- **Confident fabrication.**مامور LLM ادعا می کند که یک اقدام را که انجام نداده است انجام داده است. کاهش: بررسی نتایج، تماس های ابزار ثبت نام، هرگز اجازه ندهید LLM ادعا کند که بدون بازگشت موفقیت آمیز ابزار کاری انجام داده است.
- **Prompt injection.**کاربر متن را وارد می کند که از دستور سیستم رد می شود. LLM01 در OWASP Top 10 برای برنامه های LLM 2025 رتبه بندی شده است. دو طعم: تزریق مستقیم (در چت چسبیده شده) و تزریق غیر مستقیم (در اسناد، ایمیل ها یا ابزارهای خارج شده توسط نماینده خوانده شده)

  نرخ حمله ها با سناریو متفاوت است. نرخ موفقیت اندازه گیری شده در بین مدل های مرزی در معیار های استفاده از ابزار و کد گذاری عمومی حدود 0.5 تا 8.5 درصد است. تنظیمات خاص با ریسک بالا (هجوم های سازنده علیه عوامل کدگذاری هوش مصنوعی، ارتقا پذیری آسیب پذیر) به 84 درصد رسیده است. CVEs تولید شامل EchoLeak (CVE-2025-32711, CVSS 9.3)  یک نقص تخلیه داده با کلیک صفر در Microsoft 365 Copilot ناشی از یک ایمیل کنترل شده توسط مهاجم است.

  کاهش: واردات کاربر را در طول حلقه به عنوان غیرقابل اعتماد در نظر بگیرید؛ قبل از تماس ابزار پاک کنید؛ خروجی ابزار را از پرامپت اصلی جدا کنید؛ از الگوی برنامه-تحقق-جاری (PVE) استفاده کنید که در آن عامل ابتدا برنامه ریزی می کند، سپس هر عمل را با آن برنامه قبل از اجرای آن تأیید می کند (این نتایج ابزار را از تزریق اقدامات غیر برنامه ریزی شده جدید متوقف می کند) ؛ برای اقدامات مخرب، تأیید کاربر را نیاز دارید؛ حداقل امتیاز را برای دامنه ابزار اعمال کنید.

  هیچ مقدار مهندسی سریع این خطر را به طور کامل از بین نمی برد. لایه های دفاعی خارجی در زمان اجرا (LLM Guard، اعتبار مجوز، تشخیص ناهنجاری معنوی) مورد نیاز است.
- **Scope creep.**عامل خارج از کار می شود زیرا یک تماس ابزار اطلاعات مربوط به ارتباط دستاویزی را باز می آورد. کاهش: قراردادهای ابزار باریک؛ نگه داشتن سیستم سریع متمرکز؛ اضافه کردن ارزیابی برای نرخ خارج از کار.
- **Infinite loops.**مامور به همون ابزار زنگ ميزنه، بودجه قدم، بازتوليد تماس ابزار، قاضي LLM در "آیا پیشرفت می کنیم"
- **Context window exhaustion.**مکالمه های طولانی، اولین مواردی را از زمینه خارج می کند. کاهش: خلاصه مواردی قدیمی تر، بازیافت مواردی مرتبط با گذشته با شباهت، یا استفاده از یک مدل طولانی.

## -باده

پس از`outputs/skill-chatbot-architect.md`:

```markdown
---
name: chatbot-architect
description: Design a chatbot stack for a given use case.
version: 1.0.0
phase: 5
lesson: 17
tags: [nlp, agents, chatbot]
---

Given a product context (user need, compliance constraints, available tools, data volume), output:

1. Architecture. Rule-based, retrieval, neural, LLM agent, or hybrid (specify which paths go where).
2. LLM choice if applicable. Name the model family (Claude, GPT-4, Llama-3.1, Mixtral). Match to tool-use quality and cost.
3. Grounding strategy. RAG sources, retrieval method (see lesson 14), tool contracts.
4. Evaluation plan. Task success rate, tool-call correctness, off-task rate, hallucination rate on held-out dialogs.

Refuse to recommend a pure-LLM agent for any destructive action (payments, account deletion, data modification) without a structured confirmation flow. Refuse to skip the prompt-injection audit if the agent has write access to anything.
```

## تمرینات

1. **Easy.**اجرای پاسخ مبتنی بر قواعد بالا با 10 الگوی برای یک بوت سفارش قهوه ای. موارد کناری آزمون: سفارشات دوگانه، تغییرات، لغو، قصد نامشخص.
2. **Medium.**ساخت یک سوال عمومی ترکیبی + LLM fallback. 50 ورودی سوالات عمومی در یک محصول SaaS، LLM fallback با بازیافت در سایت اسناد. نرخ رد و دقت 100 سوال پشتیبانی واقعی را اندازه گیری کنید.
3. **Hard.**حلقه عامل را با سه ابزار (بحث، اطلاعات کاربر خوانده، ارسال ایمیل) اجرا کنید. یک ارزیابی با 50 سناریو آزمون از جمله تلاش های تزریق فوری انجام دهید. نرخ خارج از کار، میزان شکست وظیفه و موفقیت تزریق را گزارش کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Intent | What the user wants | Categorical label (book_flight, reset_password). Routed to a handler. |
| Slot | A piece of info | Parameter the bot needs (date, destination). Slot filling is the sequence of asks. |
| RAG | Retrieval plus generation | Retrieve relevant docs, then ground the LLM's response. |
| Tool call | Function invocation | LLM emits a structured call with name + args. Runtime executes, returns result. |
| Agent loop | Plan, act, verify | Controller that runs LLM calls interleaved with tool calls until task complete. |
| Prompt injection | User attacks prompt | Malicious input that tries to override the system prompt. |

## خواندن بیشتر

- [Turing (1950). Computing Machinery and Intelligence](https://academic.oup.com/mind/article/LIX/236/433/986238) مقاله ای که گفتگویی را معیار این زمینه قرار داد.
- [Weizenbaum (1966). ELIZA — A Computer Program For the Study of Natural Language Communication](https://web.stanford.edu/class/cs124/p36-weizenabaum.pdf) کاغذ اصلی مبتنی بر قوانین چتbot
- [Colby, Weber, Hilf (1971). Artificial Paranoia](https://doi.org/10.1016/0004-3702(71)90002-6)  معماری متغیر اثر PARRY، اولین چت روبات دولت.
- [Thoppilan et al. (2022). LaMDA: Language Models for Dialog Applications](https://arxiv.org/abs/2201.08239)مقاله ديرني گوگل درباره "چاتبات عصبي" درست قبل از اينکه ماموران رشته تحصيلي تصميم بگيرند
- [Yao et al. (2022). ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)اون روزنامه که نامش رو به الگوی حلقه عامل گذاشت
- [Anthropic's guide on building effective agents](https://www.anthropic.com/research/building-effective-agents) پیش بینی تولید 2024 که هنوز در سال 2026 برقرار است.
- [Greshake et al. (2023). Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection](https://arxiv.org/abs/2302.12173) کاغذ تزریق سریع.
- [OWASP Top 10 for LLM Applications 2025 — LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) رتبه بندی که تزریق سریع را به نگرانی امنیتی اصلی تبدیل کرد.
- [AWS — Securing Amazon Bedrock Agents against Indirect Prompt Injections](https://aws.amazon.com/blogs/machine-learning/securing-amazon-bedrock-agents-a-guide-to-safeguarding-against-indirect-prompt-injections/) دفاع های عملی در لایه های ترسیم شامل جریان های برنامه ریزی-تحقق- اجرا و تأیید کاربر.
- [EchoLeak (CVE-2025-32711)](https://www.vectra.ai/topics/prompt-injection) CVE کاینونیک از سیفلتریشن داده های صفر کلیک از تزریق فوری غیرمستقیم. مورد مرجع برای اینکه چرا عوامل دسترسی به نوشتن به دفاع زمان اجرا نیاز دارند.
