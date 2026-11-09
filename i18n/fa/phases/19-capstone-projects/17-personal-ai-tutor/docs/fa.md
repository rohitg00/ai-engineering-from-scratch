# Capstone 17  آموزشگاه هوش مصنوعی شخصی (تضاویل، چندرنگ، با حافظه)

> خانمیگو (آکادمی خان) ، دوولینگو مکس، گوگل LearnLM / Gemini برای آموزش، Quizlet Q-Chat و Synthesis Tutor همه آموزش های چند مدل سازنده را در سال 2026 در مقیاس عرضه کردند. شکل مشترک یک سیاست سقراط (هیچ وقت فقط جواب را رها نکنید) ، یک مدل یادگیری است که پس از هر تعامل (طریقه ردیابی دانش بیزی) ، ورودی صدای + متن + عکس ریاضی، بازیافت گرافی برنامه درسی، برنامه ریزی تکرار با فاصله و فیلترهای ایمنی سخت برای محتوای مناسب به سن، به روز می شود. هدف این است که یک معلم خاص موضوع (جبر K-12 یا مقدمه Python) را ارسال کنید، یک مطالعه اثربخشی دو هفته ای را با 10 دانش آموز انجام دهید و یک حسابرسی ایمنی محتوا را پاس کنید.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## مشکل

آموزش سازگار قبلا یک حوزه تحقیقاتی فناوری بود. تا سال 2026 این یک محصول مصرفی خواهد بود. خانمیگو در اکثر مناطق مدرسه ایالات متحده پخش می شود. دوالنگو مکس ده ها میلیون ماین رو به دست آورد برنامه LearnLM / Gemini برای آموزش گوگل آموزش در کلاس درس گوگل را تقویت می کند. "کويزلت" "چات" کنار کارت ها نشسته "توتور" با "توتور" برای بچه های کنجکاو به شدت در حال گسترش بود. عناصر مشترک: ورودی چند مدل (نوع، صحبت، معادلات عکاسی) ، آموزش سقراط (اول بپرسید، بعدا توضیح دهید) ، یک مدل دانش آموز که پس از هر تعامل به روز می شود و ایمنی دقیق مناسب به سن.

شما یکی از این ها را برای یک گروه خاص ایجاد خواهید کرد. بار اندازه گیری یک مطالعه اثربخشی واقعی است: نمرات قبل از آزمایش و پس از آزمایش در طول دو هفته با 10 دانش آموز. حلقه صدا باید طبیعی باشد (کاپستون 03 زیرپاک). حافظه باید احترام به حریم خصوصی باشد. فیلتر ایمنی باید از گروه قرمز COPPA آگاه برای K-12 عبور کند.

## مفهوم

چهار قسمت**Tutor policy**یک حلقه سقراط است: وقتی دانش آموز پاسخ را می خواهد، سیاست یک سوال اصلی را می پرسد؛ وقتی که آن را درست می کند، به مفهوم بعدی حرکت می کند؛ وقتی آنها گیر کرده اند، یک اشاره ی استقرار ارائه می دهد. **Learner model**ردیابی دانش بیزی (یا یک نوع ساده) است که احتمال تسلط را در هر گره برنامه در هر تعامل به روز می کند. **Curriculum graph**یک Neo4j از مفاهیم با حواشی پیش شرط است؛ سیاست برای انتخاب مفهوم بعدی در نمودار حرکت می کند. **Memory**یک فروشگاه ایپیزودیک + معنوی (به سبک حافظه عامل) است که تعاملات گذشته، اشتباهات و ترجیحات را نگه می دارد.

UX چند حالت است. ورودی متن برای پاسخ های تایپ شده. ورودی صدا از طریق LiveKit + Whisper (باز استفاده از سنگ پای 03). ورودی عکس برای مشکلات ریاضی از طریق dots.ocr یا PaliGemma 2. ورودی صدا از طریق Cartesia Sonic-2. ایمنی از Llama Guard 4 به همراه فیلتر مناسب برای سن استفاده می کند (محتفظات بزرگسالان، خشونت، آسیب خود را مسدود می کند) و سیاست حفظ حافظه COPPA آگاه است.

مطالعه اثربخشی نتیجه گیری است. 10 دانش آموز، قبل از آزمون و پس از آزمون، دو هفته. گزارش یادگیری سود دلتا و اعتماد به نفس. مقایسه با یک خط پایه غیر سازگاری (محتوی مشابه به صورت خطی بدون سیاست مربی ارائه شده است).

## معماری

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## دسته

- انتخاب موضوع: الجبر K-12 یا مقدمه پایتون (یک برای عمق انتخاب کنید)
- سیاست راهنمای: LangGraph بر روی Claude Sonnet 4.7 (با پیشگیری سریع)
- مدل یادگیرنده: ردیابی دانش بائیزی (کلاسیک) یا FSRS برای فاصله گذاری
- نمودار برنامه درسی: Neo4j از مفاهیم + حواشی پیش شرط + محتوای OER
- حافظه: عامل ویکتور مداوم سبک حافظه + قسمت + ذخیره معنوی
- صدا: LiveKit Agents 1.0 + Cartesia Sonic-2 (تکثیر زیر سنگ 03 را دوباره استفاده کنید)
- ریاضیات عکس: dots.ocr یا PaliGemma 2 برای تشخیص معادلات
- ایمنی: Llama Guard 4 + فیلتر متناسب با سن
- Eval: تولید سوالات در سطح گل، استفاده از قبل/پشت آزمایش، ابزار مطالعه اثربخشی

```figure
cf-tutor-loop
```

## آن را بسازید

1. **Curriculum graph.**یک Neo4j از 50-150 گره مفهوم (به عنوان مثال، الجبر K-12 از "خط شماره" به "فارمول مربع") با حواشی پیش شرط بسازید. محتوای OER را در هر گره (Open Textbook، OpenStax) متصل کنید.

2. **Learner model.**شروع کردن ردیابی دانش بیزیایی با سابقه: حدس زدن، خروجی، سرعت یادگیری. به روز رسانی تسلط هر مفهوم پس از هر تعامل. ادامه هر دانش آموز.

3. **Tutor policy.**لنگ گراف با گره ها: `read_signal`(پاسخ آموز درست / جزئی / گیر کرده بود؟)`select_concept`(گراف برنامه درسی راه رفتن که مفهوم اولویت بالا را انتخاب می کند)`scaffold`(سوکراطي به عنوان اشاره)`update_mastery`. .

4. **Memory.**هر تعامل به یک فروشگاه قسمت نوشته می شود. اشتباهات و ترجیحات به حافظه معنوی کمک می کنند. سیاست حفظ COPPA آگاه: حذف خودکار پس از 1 سال، دسترسی والدین.

5. **Voice path.**کارکن LiveKit Agents به سیاست راهنمای متصل شده است. ASR از طریق Whisper-v3-turbo. TTS از طریق Cartesia Sonic-2. Barge-in پشتیبانی می شود (مکانیک Capstone 03 را دوباره استفاده کنید).

6. **Photo-math path.**تصویر را بارگذاری یا ضبط کنید؛ برای تشخیص معادله dots.ocr یا PaliGemma 2 اجرا کنید؛ به عنوان ورودی ساختار یافته به معلم ارسال کنید.

7. **Safety.**هر محصول مدل Llama Guard 4 + فیلتر مناسب به سن (محدود کردن آسیب شخصی، محتوای بزرگسالان، خشونت) را عبور می کند. دسترسی به حافظه توسط شناسه یادگیرنده انجام می شود؛ سطح دسترسی والدین برای حذف.

8. **Efficacy study.**10 دانش آموز، پیش از آزمون (بنیاد استاندارد 30 سوال) ، دو هفته تعامل مربی (3 جلسه/ هفته) ، پس از آزمون. مقایسه با یک گروه پایه غیر سازگاری از 10 دانش آموز در مورد همان محتوا.

9. **Weekly progress reports.**برای هر دانش آموز، خلاصه ای از موضوعات مورد بررسی، مسیرهای تسلط و مراحل بعدی توصیه شده را به صورت خودکار در PDF ایجاد کنید.

## ازش استفاده کن

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## -باده

`outputs/skill-ai-tutor.md`یک معلم سازگار خاص موضوع با ورودی چند مدل، یک مدل یادگیرنده، حافظه، ایمنی و میزان اثربخشی.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## تمرینات

1. مطالعه اثربخشی را با و بدون مدل یادگیری سازنده (آردهای تصادفی مفهوم) اجرا کنید. دلتا را گزارش کنید. انتظار دارید سازنده برنده شود، اما اندازه شماره جالب است.

2. یک ساند چند مدل را اضافه کنید: همان سوال مفهوم به عنوان متن، صدا و عکس ارائه شده است. اندازه گیری کنید که آیا دانش آموزان با روش مورد نظر خود سریعتر به هم می رسند یا خیر.

3. یک داشبورد اصلی بسازید: موضوعات تمرین شده، مسیرهای تسلط، مفاهیم آینده، رویدادهای ایمنی (هر گونه ضربه به رایل)

4. حالت تغییر زبان را اضافه کنید: معلم ورودی اسپانیایی را قبول می کند و به زبان اسپانیایی تدریس می کند. پوشش X-Guard را اندازه گیری کنید.

5. بر حفظ حریم خصوصی حافظه تاکید کنید: تایید کنید که دانش آموز A نمی تواند داده های دانش آموز B را حتی از طریق حمله مجدد ضبط صدای B ببیند. سعی در دسترسی و هشدار را ثبت کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## خواندن بیشتر

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) راهنمای K-12 مصرف کننده مرجع
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) معلم زبان های مرجع
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) مدل مرجع میزبانی شده
- [Quizlet Q-Chat](https://quizlet.com) مرجع متناوب
- [Synthesis Tutor](https://www.synthesis.com) شروع کردن
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) برنامه ریزی تکرار با فاصله
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) مدل کلاسیک دانش آموز
- [LiveKit Agents](https://github.com/livekit/agents) صدای بلند
