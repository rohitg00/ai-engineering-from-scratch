# حظر الذاكرة و حساب وقت النوم

> يمنع الذاكرة الوظيفية المختلفة التي يمكن أن يقوم النموذج بتحريرها مباشرة، ووكيل وقت النوم الذي يوحد الذاكرة بشكل غير متزامن بينما يكون الوكيل الأساسي عاطلاً. هذه الأفكار هي كيفية توسيع الذاكرة خارج محادثة واحدة.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## أهداف التعلم

- أسمائ المستويات الثلاثة للذاكرة التي تستخدمها ليتا (البرة، والذكرى، والإرشيف) ودور كل منها.
- شرح نمط حظر الذاكرة: حظر الإنسان، حظر شخصية، والحجر المحدد من قبل المستخدم كمتعلقات طبقة أولى.
- وصف ما هو حساب وقت النوم، لماذا يقع خارج المسار الحرج، ولماذا يمكن أن تشغيل نموذج أقوى من العامل الأساسي.
- تنفيذ حلقة من عاملين مكتوب فيها عامل أساسي يخدم الاستجابات ووكيل وقت النوم يوحد الكتل بين التحولات.

## المشكلة

حل MemGPT (دروس 07) تدفق التحكم في الذاكرة الافتراضية. ظهرت ثلاثة مشاكل إنتاجية:

1. **Latency.**كل عملية ذاكرة تقع على المسار الحرج إذا كان على العميل أن يقطع أو يجمع أو يصلح بينما ينتظر المستخدم
2. **Memory rot.**الكتابات تتراكم، والحقائق المتناقضة تبقى، والحصول على المعلومات يغرق في المحتوى القديم.
3. **Structure loss.**لا يمكن أن يعبر متجر الأرشيف السطحي عن "مجموعة البشر دائما في المشاركة؛ ومدفع الشخص دائما في المشاركة؛ ومدفع المهام يتبادل في كل جلسة".

Letta (letta.com) هو اسم المنصة المشاريع MemGPT الأصلية التي اعتمدت في عام 2024  نمط الورقة يبقى اسم MemGPT  وإعادة كتابة 2026 Letta V1 هي خطوة لاحقة منفصلة. تجعل كتب الذاكرة الهيكل صريحًا. تحسيب وقت النوم يزيل التوحيد عن المسار الحرج.

## المفهوم

### ثلاثة مستويات

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | Always visible | Inside the main prompt | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | Arbitrary facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

الأساس هو أساس MemGPT. تذكر هو حافظة المحادثة مع ذيلها المنفصل. الأرشيف هو المتجر الخارجي. الانقسام يطهر من زائدة MemGPT من مستويين.

### حواجز الذاكرة

الكتلة هي قسم من نوعها، المستمر، قابل للتحرير من المستوى الأساسي. وصفت ورقة MemGPT الأصلية اثنين:

- **Human block** حقائق عن المستخدم (اسم، دور، تفضيلات، أهداف).
- **Persona block** مفهوم الشخص نفسه (هوية، نغمة، قيود).

Letta يُعمّل إلى كتلة تعريفية تعسفية للمستخدم: a `Task`حظر الهدف الحالي،`Project`حظر للحقائق القائمة على الرمز،`Safety`كل بلاك لديه`id`،`label`،`value`،`limit`(قيمة الكترونية)`description`(حيث يعرف النموذج متى يحرره)

يمكن تحرير الكتل عبر سطح الأداة:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` إضافة حجر قريب من حدته

### حساب وقت النوم

إضافة 2025 Letta: تشغيل وكيل ثان في الخلفية، خارج المسار الحرج. وكلاء وقت النوم معالجة النصوص المحادثة والسياق القاعدة التعليمية، كتابة `learned_context`إلى كتلة مشتركة، وتوحيد أو إلغاء سجلات الأرشيف.

الخصائص التي تسقط:

- **No latency cost.**الردود الأساسية لا تنتظر عمليات الذاكرة.
- **Stronger model allowed.**يمكن أن يكون وكيل وقت النوم نموذجًا أكثر تكلفة وبطء لأنه ليس مقيدًا على التأخير.
- **Natural consolidation window.**إضافة، تلخيص، إلغاء الحقائق المتناقضة عندما لا ينتظر المستخدم.

الشكل يطابق كيف يعمل البشر: تقوم بالمهمة، تنام عليها، وتستقر الذاكرة طويلة الأجل خلال الليل.

### التفكير الأصلي

(Letta V1)`letta_v1_agent`، 2026) يُسلب`send_message`النبض القلبي و التسلسل`Thought:`تُصدر رسائل عبر قناة منفصلة، تمر عبر دورات (تشفير عبر مزودي الإنتاج). حلقة التحكم لا تزال ReAct. تتبع الأفكار بنية، وليس على شكل عرض.

### حيث يذهب هذا النمط خطأ

- **Block bloat.**لا نهاية لها`block_append`يصل إلى الحد السريع. قم بتشغيل مخطط مخطط قبل الكتابة التي تدفع فوق القبو.
- **Silent drift.**وكيل النوم يكتب مرة أخرى حجر و العامل الأساسي لا يلاحظ أبداً.
- **Poisoned consolidation.**وكيل وقت النوم يعالج المحتوى الذي يمكن للمهاجم الوصول إليه في القلب. الدرس 27 ينطبق على سطح وقت النوم أيضا.

```figure
memory-blocks
```

## بناءها

`code/main.py`تطبيقات:

- `Block` الهوية، والعلامة، والقيمة، والحد، والوصف.
- `BlockStore` CRUD + `near_limit(label)`المساعد
- اثنان من العملاء المخطوطين`PrimaryAgent`يقدم دوراً`SleepTimeAgent`يُعزز بين التحولات.
- أثر يظهر محادثة ثلاثية مع كتب بلاك، بالإضافة إلى مرور وقت النوم الذي يجمع على بلاك ويمنع حقيقة قديمة.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

يظهر النص الانقسام: التحولات الأساسية سريعة وتنتج كتابات خامة؛ وتتضخم وتطهر مرور النوم.

## استخدمها

- **Letta**(letta.com) للتنفيذ المرجعي. المضيف الذاتي أو السحابة المدارة.
- **Claude Agent SDK skills**كما علم شكل كتلة  مهارة هي كتلة مسموحة، نسخة، قابل للرد من التعليمات التي يقوم الوكيل بتحملها عند الطلب.
- **Custom builds**للفريقات التي تريد السيطرة على الخلفية التخزينية استخدم عقد إيه بي آي ليتا حتى تتمكن من الهجرة لاحقاً

## أرسله

`outputs/skill-memory-blocks.md`يولد نظام كتلة على شكل ليتا مع مضادات وقت النوم لأي وقت تشغيل، بما في ذلك قواعد السلامة والسلكية الإشارة.

## التمارين

1. إضافة`block_summarize`أداة تحل محل قيمة الكتلة بموجب ملخص من النموذج عندما `near_limit`أي عتبة الإطلاق تقلل من كل من مكالمات التجميع والإغراق؟
2. تنفيذ تخفيض وقت النوم على الأرشيف: تسجيلين يحتويون على نص يتداخل بينهما على نحو 90% يتداخل مع واحد.
3. حظر الإصدار. في كل سجل كتابة القيمة القديمة و الاختلاف.`block_history(label)`حتى يتمكن المشغلون من تحميل "لماذا نسى العميل X".
4. تعامل وكلاء وقت النوم ككاتب غير موثوق بهم عندما يلمسوا كتلة الشخص أو السلامة،
5. نقل المثال لاستخدام API ليتا (`letta_v1_agent`ما هي التغييرات في مخطط الكتل، وكيف يغير التفكير الأصلي شكل العثر؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | "Editable prompt section" | Typed, persistent, LLM-editable segment of core memory |
| Human block | "User memory" | Facts about the user, pinned in core |
| Persona block | "Agent identity" | Self-concept, tone, constraints, pinned in core |
| Sleep-time compute | "Async memory work" | Second agent doing consolidation off the critical path |
| Core / Recall / Archival | "Tiers" | Three-layer memory split: always-visible / conversation / external |
| Block limit | "Cap" | Character limit per block; forces summarization |
| Native reasoning | "Thinking channel" | Provider-level reasoning output, not prompt-level `Thought:` |
| Learned context | "Sleep output" | Facts the sleep-time agent writes into shared blocks |

## المزيد من القراءة

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) نمط الكتل
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) تحسين التوافق
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) إعادة كتابة التفكير الأصلي
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) المنشأ
