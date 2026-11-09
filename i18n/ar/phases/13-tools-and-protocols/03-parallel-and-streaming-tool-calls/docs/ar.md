# مكالمات الأدوات المتوازية وتدفق الأدوات

> ثلاثة عمليات بحث عن الطقس المستقلة المسلسلة هي ثلاث رحلات ذهابًا وإيابًا. قم بها بالتوازي وتنهار الوقت الإجمالي إلى أبطأ مكالمة واحدة. يصدّر كل مزود حدودي الآن مكالمات أداة متعددة في جولة واحدة. الجائزة حقيقية؛ والسباكة ظريفة. يدور هذا الدروس في النصفين: التمويع الموازي والحجة المتوصلة إعادة التجميع، مع التركيز على فخ الاصمة.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## أهداف التعلم

- اشرح لماذا`parallel_tool_calls: true`وجوده ومتى تعطيله
- ربط قطع الحجج المتدفقة مع الهوية الصحيحة للدعوة خلال التشغيل الموازي.
- إعادة تجميع الجزئي `arguments`السلاسل إلى JSON كاملة دون تحليل مبكر.
- إشغلي مقياس طقس ثلاث مدن يظهر التسلسل مقابل التخفيف المتوازي.

## المشكلة

بدون مكالمات متوازية، يقوم وكيل يجيب على "ما هو الطقس في بنغالورو وتوكيو وزيورخ" بهذا:

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

ثلاث رحلات ذهاب وإياب لدرجة الماجستير، كل منها يدفع أيضاً تأخير المُنفذ، حوالي أربع مرات الوقت المثالي للسيارة.

مع المكالمات المتوازية:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

رحلة ذهاب وإياب واحدة في ماجستير في العلوم العليا. وقت تنفيذ هو أقصى من الثلاثة ، وليس المجموع. أرقام قياسية الإنتاج على OpenAI ، Anthropic ، و Gemini تظهر 60 إلى 70 في المائة من خفض الساعة الجدارية على عبء العمل المتحركة.

السعر هو تعقيد التواصل عندما تكون المكالمات الثلاثة خارج النظام، يجب أن تكون نتائجك مطابقة`tool_call_id`حتى يمكن أن يقوم النموذج بتصويرها. عند تدفق النتائج، يجب عليك تجميع شظايا الحجج الجزئية إلى JSON كاملة قبل تنفيذها. أضاف Gemini 3 IDs فريدة جزئيا لحل مشكلة في العالم الحقيقي حيث كانت المكالمات المتوازية إلى نفس الأداة لا يمكن التمييز.

## المفهوم

### إمكانية التشابه

- **OpenAI.** `parallel_tool_calls: true`على افتراضياً.`false`للاضطراب المتسلسل
- **Anthropic.**متوازية عبر `disable_parallel_tool_use: false`(الوضع الافتراضي على كلود 3.5 وما فوق)`true`لسلسلة
- **Gemini.**دائماً متوازياً`tool_config.function_calling_config.mode = "AUTO"`دع النموذج يقرر.

إيقاف التوازي عندما تكون لدى الأدوات اعتمادات ترتيب (`create_file`إذاً`write_file`), عندما تكون خروج مكالمة واحدة تُخبر مدخلات أخرى، أو عندما لا يستطيع مقيّد المعدلات التعامل مع إفراز المروحة.

### التواصل بين

كل مكالمة التي يصدرها النموذج لديها`id`كل نتيجة يعودها المضيف يجب أن يحتوي على نفس الهوية بدون هذا النتيجة غير واضحة

- **OpenAI.** `tool_call_id`على كل رسالة أداة
- **Anthropic.** `tool_use_id`على كل واحد`tool_result`-بلوك
- **Gemini.** `id`على كل واحد`functionResponse`(جمائز 3 وما فوق، جمائز 2 مطابقة باسمها التي انفصلت عن نفس الاسم مكالمات متوازية).

### إجراء المكالمات في وقت واحد

يدير المضيف تنفيذ كل مكالمة على خيطه الخاص ، أو coroutine ، أو عامل بعيد. يستخدم أسهل الحزام مجموعة خيطات ؛ ويستخدم الإنتاج asyncio مع `asyncio.gather`أو التزامن المهيكلي. ترتيب الانتهاء غير متوقع  هو المعرف.

خطأ شائع واحد: الإجابة بالنتائج في ترتيب قائمة المكالمات بدلاً من ترتيب الانتهاء. هذا عادة ما يعمل لأن النموذج يهتم فقط`tool_call_id`، ولكن إذا تم إلقاء النتيجة أو تكرارها، فإن قائمة الإجابات التي يتم ترتيبها من جديد بعيدا عن الترتيب الذي وصلت إليه النتائج تجعل العجز أصعب العثور عليه في السجلات.

### مكالمات أداة التدفق

عندما يتدفق النموذج`arguments`ثلاث تدفقات منفصلة من قطع لثلاث مكالمات متوازية تتداخل على السلك.

شكل من قبل المقدم:

- **OpenAI.**كل قطعة هي`choices[0].delta.tool_calls[i].function.arguments`(السلسلة الجزئية)`index`(موقع في قائمة المكالمات) تتراكم لكل مؤشر، اقرأ `id`عندما يظهر لأول مرة ، و تحليل JSON عندما `finish_reason = "tool_calls"`. . .
- **Anthropic.**أحداث التدفق هي`message_start`، ثم واحد `content_block_start`لكل كتلة مع نوع `tool_use`(يحتوي على الهوية والاسم والمدخل الفارغ). `content_block_delta`الأحداث تحمل `input_json_delta`قطع.`content_block_stop`يغلق كل حي
- **Gemini.** `streamFunctionCallArguments`(التوأم 3 وما فوق) يُصدّر قطع مع `functionCallId`قبل التشغيل التجويري 3، أعاد المكالمة كاملة واحدة في كل مرة.

### JSON الجزئي والفخ في وقت مبكر

لا يمكنك تحليل`arguments`حتى يتم اكتمالها. جزئي JSON مثل `{"city": "Beng`لا يطابق مع الموقع و سوف يرفع. البوابة الصحيحة هي إشارة نهاية المكالمة من مقدم المكالمة: OpenAI `finish_reason = "tool_calls"`، إنثروبيك `content_block_stop`أو حدث نهاية التيار التوأم فقط بعد ذلك حاول`json.loads`. يستخدم نهج أكثر قوة محلل JSON متزايد يعطي الأحداث عندما تكتمل الهيكل. يوصي دليل البث التابع لـ OpenAI بذلك لـ UX الذي يظهر مؤشر "التفكير" الحي. لا يمكن الاعتماد على حساب الأزواج كاختبار الكمال (القطع داخل السلاسل المقتبسة أو المحتوى المنفذ يسبب إيجابيات خاطئة) ويجب استخدامها فقط كحكم التحليل غير الرسمي.

### الإكمال خارج النظام

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

يجب على رد المضيف أن يذكر الهويات:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

النظام في الإجابة لا يهم للصواب على OpenAI أو Anthropic. يتقبل Gemini أي أمر طالما أن الهويات تتطابق.

### المرجعية: متتالية مقابل متوازية

الحزام في`code/main.py`يحاكي ثلاثة تنفيذيات مع تأخر 400، 600، و 800 ms. يدير التسلسل في 1800 ms إجمالي. يدير متوازي في ماكسب 400، 600، 800) = 800 ms. الفرق ثابت، وليس متناسب، لذلك تزداد التوفير مع عدد الأدوات.

تحذير في العالم الحقيقي: مكالمات متوازية تضغط على APIs أسفل التيار. سيتعطل إصدار عشرة طرق لمنتصف خدمة محدودة بالمعدلات. المرحلة 13 · 17 تغطي الضغط على مستوى البوابة. يتم تخطيط تجربة إعادة التعبيرية للمرحلة المستقبلية.

### التدفق المروحة خارج ساعة الحائط

إذا كان النموذج نفسه يتدفق، يمكنك البدء في تنفيذها بمجرد اكتمال حججات مكالمة واحدة، بدلاً من الانتظار لجميع المكالمات لإنهاءها. هذه تحسين OpenAI وثائق ولكن ليس كل SDKs الكشف. الحل في هذا الدروس يفعل ذلك: بمجرد أن يتيح التدفق المحاكي كائن حجج كامل، يستدعي المضيف تلك المكالمة.

```figure
tp-parallel-fanout
```

## استخدمها

`code/main.py`يحتوي على نصفين. الأول يعمل على ثلاثة مكالمات موسمية محاكاة تسلسليًا وموازية باستخدام`concurrent.futures.ThreadPoolExecutor`والنصف الثاني يعيد استجابة التدفق المزيف  قطع من `arguments`لثلاث مكالمات متوازية متداخلة على تيار واحد ويعيد تجميعها لكل شخصية مع`StreamAccumulator`لا ماجستير في العلوم، لا شبكة، فقط منطق إعادة التجميع.

ما الذي يجب أن ننظر إليه:

- الزمات التسلسل يصل إلى 1.8 ثانية و الزمات المتوازية يصل إلى 0.8 ثانية على نفس التأخيرات المزيفة
- يقوم المجموعة بمعالجة قطع تصل خارج النظام عن طريق التخزين لكل معرف وتحليل فقط عندما تكون JSON لكل مكالمة مكتملة.
- يبدأ الإنفاذ بمجرد أن تنتهي حججات الهوية، وليس بعد أن تنتهي جميع التدفقات.

## أرسله

هذا الدرس يُنتج`outputs/skill-parallel-call-safety-check.md`. في إطار سجل أدوات، تقوم عمليات تدقيق المهارات التي يمكن تحليلها بأمان، والتي لها اعتمادات على الطلبات، والتي من شأنها أن تزداد من حدود أسعار التدفق التدريجي  إعادة سجل معدل مع كل أداة `parallel_safe`العلامات

## التمارين

1. أركض`code/main.py`وتغير التأخيرات المحاكاة. تأكد أن النسبة الموازية إلى التسلسل هي تقريبا `max/sum`(الدورات الحقيقية تختلف قليلاً عن المثالي بسبب جدولة الخيوط والتسلسل والتكامل الجوي). في أي توزيع التأخير يتوقف التضامن الموازي عن التضامن؟

2. تمديد الاكمبيوتر للتعامل مع حالة "تم إلغاء المكالمة في منتصف التيار" عن طريق إسقاط حافظة البفر وإصدار `cancelled`أي مزود يستند إلى هذه القضية صراحة؟`content_block_stop`النطقية و OpenAI `finish_reason: "length"`السلوك

3. استبدل حفرة الخيوط بـ `asyncio.gather`يجب أن ترى أرباح صغيرة على async بسبب أقل تكلفة تغيير السياق، ولكن فقط إذا قام المنفذون بإجراء إدخال / إدخال حقيقي.

4. اختر اثنين من الأدوات التي لا يجب أن تكون متوازية (مثل `create_file`إذاً`write_file`) إضافة `ordering_dependency`هذا هو الحد الأدنى من الآلات لتنظيم التوقيت واعي الاعتماد، والتي يتم رسمها في مرحلة مستقبلية من الهندسة العملية.

5. اقرأ قسم OpenAI للاتصال بالوظائف المتوازية و Anthropic `disable_parallel_tool_use`أوراق البحث: حدد نوع الأداة الحقيقية التي توصي بها Anthropic بإيقاف التوازي. (تلميح: الطفرات التالية على نفس المصدر).

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | Model emits multiple tool calls in a single assistant message |
| `parallel_tool_calls` | "OpenAI's flag" | Enable or disable multi-call emission |
| `disable_parallel_tool_use` | "Anthropic's inverse" | Opt-out flag; default is parallel enabled |
| Tool call id | "Correlation handle" | Per-call identifier the result message must echo |
| Accumulator | "Stream buffer" | Per-id string buffer for partial `arguments` chunks |
| Out-of-order completion | "Fastest first" | Parallel calls finish in unpredictable order; ids are the glue |
| Dependency graph | "Ordering constraints" | Tools whose outputs feed into inputs of other tools; cannot parallelize |
| Parse-early trap | "JSON.parse exploded" | Attempting to parse an incomplete `arguments` string |
| `streamFunctionCallArguments` | "Gemini 3 feature" | Streamed argument chunks with unique id per call |
| Completion-order reply | "Don't wait for all" | Reply with results as they arrive, keyed by id |

## المزيد من القراءة

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) سلوك الافتراضي والعلامة الامتناع عن الاشتراك
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) `disable_parallel_tool_use`وفرق النتائج
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) مكالمات متوازية ذات صلة بالصورة من Gemini 3
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) إعادة تجميع الحجج المقطوعة لتدفقات OpenAI
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) `content_block_delta`مع`input_json_delta`
