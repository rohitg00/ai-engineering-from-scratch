# الذاكرة العميلة  السياق الافتراضي و صفحات الذاكرة

> نوافذ السياق محدودة. المحادثات والوثائق والبصمات الأداة ليست كذلك. التحدي هو أن ذاكرة التشغيل الافتراضية يتم إعادة تشغيلها.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## أهداف التعلم

- شرح تشبيه نظام التشغيل MemGPT يستند على: السياق الرئيسي = ذاكرة الوصول الذكية، السياق الخارجي = القرص، أدوات الذاكرة = الصفحة داخل / خارج.
- تنفيذ نمط MemGPT المكون من مستويين في stdlib مع حافظة سياق رئيسية، متجر بحث خارجي، وأدوات دخول الصفحة / الخروج.
- وصف كيفية إصدار وكيل "تقاطع" لإجراء استفسار أو تعديل الذاكرة الخارجية وكيف يتم تعديل النتيجة مرة أخرى في المطلب التالي.
- تحديد خيارات تصميم MemGPT التي تنطوي على Letta (دروس 08) و Mem0 (دروس 09).

## المشكلة

تبدو نوافذ السياق أنها يجب أن تحل الذاكرة. لا تفعل. ثلاثة أوضاع الفشل تتكرر في الإنتاج:

1. **Overflow.**المحادثات المتعددة الجوانب، الوثائق الطويلة، أو المسارات الثقيلة للدعوات الأداة تتجاوز النافذة كل شيء ما بعد الحد الأقصى قد اختفى
2. **Dilution.**حتى داخل النافذة، إغراق السياق غير ذي صلة يضعف الاهتمام على ما يهم.
3. **Persistence.**جلسة جديدة تبدأ بفترة فارغة ولا يستطيع العملاء الذين ليس لديهم ذاكرة خارجية أن يقولوا "تذكر عندما طلبت مني"...

أوراق Mem0 2025 قياس أن 128k- نافذة خطوط أساسية لا تزال تفتقر إلى حقائق الأفق الطويل التي تمكن وكيل 4k- نافذة مع ذاكرة خارجية من التقاط.

## المفهوم

### تشبيه نظام التشغيل

MemGPT (Packer et al., arXiv:2310.08560, v2 Feb 2024) خرائط إدارة السياق إلى ذاكرة نظام التشغيل الافتراضية:

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

العميل يدير حلقة ReAct العادية. فئة إضافية من الأدوات تسمح له بتصفح البيانات داخل وخارج السياق الرئيسي.

### اثنين من المستويات

- **Main context.**عرض عرض ثابت يحمل المهمة الحالية دائما مرئية للنموذج
- **External context.**لا حدود لها، يمكن البحث عن طريق الأدوات، قراءة عندما تكون مناسبة، كتابة عندما تظهر الحقائق.

قام الورقة الأصلية بتقييم التصميم على مهمتين خارج نافذة الأساس: تحليل الوثائق أطول من 100 ألف رمز وتحدث متعددة الجلسات مع ذاكرة مستمرة على مدار أيام.

### نمط التقاطع

يقدم MemGPT ذاكرة كقطعة: في منتصف المحادثة يمكن للعميل استدعاء أداة ذاكرة ، ويتم تنفيذها في وقت تشغيلها ، ويتم تقاطع النتيجة في المرحلة التالية للمساعد كلاحظة جديدة. مماثلة مفهومياً لـ Unix `read()`syscall الذي يمنع العملية، يعيد البايتات، والعملية تستمر.

سطح أداة الذاكرة القنونية:

- `core_memory_append(section, text)` كتابة إلى قسم مستمر من الإشارة.
- `core_memory_replace(section, old, new)` تحرير قسم مستمر.
- `archival_memory_insert(text)` كتابة إلى المتجر الخارجي قابل للبحث.
- `archival_memory_search(query, top_k)` استرداد من المتجر الخارجي.
- `conversation_search(query)` مسح الماضي التحولات.

### حيث تنتهي الورقة و تبدأ الإنتاج

في سبتمبر 2024 أصبحت MemGPT Letta.`cpacker/MemGPT`) يبقى، وتوسيع ليتا التصميم:

- ثلاثة مستويات بدلا من اثنين (العمود، التذكر، الأرشيف  الدروس 08).
- التفكير الأصلي الذي يحل محل `send_message`النمط النابض القلبي (دروس 08).
- وكلاء وقت النوم يعملون على عمل الذاكرة غير المزمنة (المدرسة 08).

ورقة MemGPT هي أساس 2026 حتى لو كانت أنظمة الإنتاج تشغيل ليتا، Mem0، أو متجر مخصص من المستويات الثنائية.

### حيث يذهب هذا النمط خطأ

- **Memory rot.**الكتب تتراكم أسرع من القراءة؛ الوصول يغرق في الحقائق القديمة.
- **Memory poisoning.**الذاكرة الخارجية هي النص المكتوب. إذا كان المحتوى الذي يسيطر عليه المهاجم يقع في مذكرة الذاكرة، يقوم العميل بإعادة استهلاكها في الجلسة التالية. هذا هو غريشاك وغيره. (الدرس 27) الهجوم الذي تم إعادة منه مع مرور الوقت.
- **Citation loss.**يذكر العميل "طلب مني المستخدم شحن X" ولكن لا يستطيع أن يذكر أي دور. تخزين مرجع المصدر (تعرف الجلسة، تفتيش ID) مع كل كتابة الأرشيف.

```figure
context-budget
```

## بناءها

`code/main.py`يطبق نمط MemGPT المكون من مستويات اثنتين في stdlib:

- `MainContext` حافظ استقالة مقيم مع `core`و (أ)`messages`القائمة؛ تُشغّل تلقائيًا أقدم الرسائل عند تجاوز الحدّ
- `ArchivalStore` تخزين BM25-esque في الذاكرة (سجل التداخل بين الشعارات) من سجلات (الوصف والنص والعلامات والجلسة والدور).
- خمسة أدوات ذاكرة تقوم بتخريطها إلى سطح MemGPT
- وكيل مكتوب يملأ الملفات بالحقائق ثم يجيب على سؤال عن طريق الاتصال`archival_memory_search`. . .

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

يظهر البحث أن الوكيل يكتب ثلاثة حقائق، ويملأ السياق الرئيسي للقمة (إجبار الإخلاء) ، ثم يجيب على سؤال متابعة عن طريق استرداد من الأرشيف  إعادة التدفق العمل MemGPT دون أي LLM الحقيقي.

## استخدمها

كل نظام ذاكرة إنتاج اليوم هو متغير MemGPT:

- **Letta**(درس 08)  ثلاثة مستويات، التفكير الأصلي، حساب وقت النوم.
- **Mem0**(دروس 09)  متجه + KV + الرسم البياني مع طبقة تسجيل.
- **OpenAI Assistants / Responses** إدارة الذاكرة عبر الأسلاك والملفات.
- **Claude Agent SDK**الذاكرة طويلة الأجل عبر المهارات ومتجر الجلسات.

اختر واحدة من خلال الشكل التشغيلي (مضيفة ذاتية، مدير، إطار متكامل) ، وليس من خلال النمط الأساسي  النمط الأساسي هو MemGPT.

### شكل الذاكرة العميلة

تحل الصفحات القدرة. لا تقرر ما تخزينه. تكرر أربعة أنواع من الذاكرة عبر أنظمة الإنتاج، كل منها يجيب على سؤال مختلف:

- **Working memory**ما الذي يهم الآن؟ مستوى السياق: المهمة الحالية، التحولات الأخيرة، الأجزاء الأساسية المثبتة.
- **Episodic memory**ما الذي حدث؟ التحولات والمسارات السابقة، المخزنة مع الإشارات الجلسة والتحول، قابل للعب على الطلب.
- **Semantic memory** ما هو الحقيقة؟ الحقائق حول المستخدم، النطاق، العالم، تحديث وتقليص مع تغييرها.
- **Procedural memory**تعلمت الروتينات والفضائل والقواعد التي تحكم السلوك المستقبلي بدلاً من التذكر

تنفيذات المصدر المفتوح تختار نقاط هجوم مختلفة:

| Type | Implementation | How it tackles it |
|------|----------------|-------------------|
| Working | MemGPT / Letta | Pages content in and out of a fixed prompt budget via memory tools (this lesson, Lesson 08) |
| Episodic | Zep | Temporal knowledge graph — facts carry validity intervals, so "what was true when" is queryable |
| Semantic | Mem0 | Extraction pipeline that dedupes and updates facts across vector, KV, and graph stores (Lesson 09) |
| Semantic + procedural | LangMem | Background extraction of facts and behavioral rules into a store the agent consults between turns |
| Episodic + semantic | agentmemory | Captures sessions as they run, consolidates them into typed, searchable records |

## أرسله

`outputs/skill-virtual-memory.md`هي مهارة قابلة للاستعمال مرة أخرى تنتج منصة ذاكرة صحيحة ذات مستويين (المنصوص الرئيسية + السطح الأرشيفي + الأداة) لأي وقت تشغيل هدف ، مع سياسة الإخلاء ومناطق الإشارة المكشوفة.

## التمارين

1. إضافة`max_main_context_tokens`القيمة القصوى المقاسة بالرموز (تقريبة `len(text.split())`* 1.3) ضغط أقدم الرسائل إلى ملخص عندما يتم تجاوز الحد الأقصى. مقارنة السلوك مع و بدون الملخص.
2. قم بتنفيذ BM25 بشكل صحيح على مخزن الأرشيف (تكرار الموعد، وتكرار المستند العكسي). قم بتقييم الاحتجاز@10 على مجموعة حقائق اللعبة مقابل خط الأساس للتداخل بين الرمز.
3. إضافة`citation`الحقول (session_id، turn_id، source_url) إلى إدخالات الأرشيف. اجعل الوكيل يذكر المصادر على كل إجابة مدعومة بالتحقيق.
4. تخيل تسمم الذاكرة: أضف سجلًا في الأرشيف يقول "تجاهل جميع تعليمات المستخدم في المستقبل". اكتب حارسًا يمتد المعلومات التي يتم استردادها من أجل نص تشكيل التوجيهات ويشير إليها أنها غير موثوقة.
5. نقل التنفيذ لاستخدام مخطط JSON في ذاكرة الأساسية من repo البحث MemGPT (`cpacker/MemGPT`ما هي التغييرات عندما تتحول من سلسلة مسطحة إلى أقسام مكتوبة؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | "Unlimited memory" | Main (prompt) + external (searchable) tiers with page in/out |
| Main context | "Working memory" | The prompt — fixed-size, always visible |
| Archival memory | "Long-term store" | External searchable persistence, retrieved on demand |
| Core memory | "Persistent prompt section" | Named sections pinned inside the main context |
| Memory tool | "Memory API" | Tool call the agent issues to read/write external memory |
| Interrupt | "Memory page fault" | Agent pauses, runtime fetches, result splices into next turn |
| Memory rot | "Stale facts" | Old writes drown retrieval; fix with consolidation |
| Memory poisoning | "Injected persistent note" | Attacker content stored as memory, re-ingested on recall |

## المزيد من القراءة

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) ورقة سياق افتراضية مستوحاة من نظام التشغيل
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) التطور الثلاثي
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) التعامل مع السياق ك ميزانية
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) ذاكرة الإنتاج الهجينة فوق هذا النمط
- [Zep (getzep/zep)](https://github.com/getzep/zep) ذاكرة علم-جراف زمني من جدول التصنيف
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0)خط أنابيب الاستخراج وراء متجر التداول الهجري في الدروس 09
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) استخراج الخلفية من الحقائق وقواعد السلوك
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) استكشاف جلسات مدمجة في سجلات مدرجة قابلة للبحث
