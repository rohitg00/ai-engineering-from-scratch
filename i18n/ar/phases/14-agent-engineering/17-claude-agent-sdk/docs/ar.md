# الحزمة كمكتبة  المختلفات ومخزنات الجلسات

> الحزمة التي يمكنك استيرادها: الأدوات المدمجة ، والحوافز الفرعية لعزل السياق ، والقبضات ، وانتشار آثار W3C ، استمرار الجلسة. كود وكيل SDK هو المثال المرجعي  شكل مكتبة الحزمة كود كود  وكلاء مدير هو البديل المضيف للعمل التزامن الطويل المدى.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## أهداف التعلم

- شرح الفرق بين SDK العميل الإنثروبي (API الخام) و SDK وكيل كلود (شكل القنبلة).
- وصف المكونات الفرعية  التوازي والعزل السياسي  ومتى يجب الوصول إليها.
- اسم سطح تخزين جلسة في متجر Python SDK (`append`،`load`،`list_sessions`،`delete`،`list_subkeys`) ودور `--session-mirror`. . .
- تنفيذ حزمة stdlib مع أدوات متضمنة ، والإزالة السوباجنت مع سياق معزول ، والكوك في دورة الحياة ، ومخزن جلسة.

## المشكلة

يقدم لك API LLM الخام رحلة ذهابًا وإيابًا واحدة. يحتاج وكيل الإنتاج إلى تنفيذ الأدوات، وخادمات MCP، خطط دورة الحياة، إزالة السباقات، استمرار الجلسة، انتشار الأثر. يقوم Cloud Agent SDK بنقل هذا الشكل كمكتبة  نفس القيادة التي يستخدمها Claude Code، معرضة للوكلاء المخصصين.

## المفهوم

### SDK العميل مقابل SDK العميل

- **Client SDK (`anthropic`).**إمبراطورية الرسائل الخام، أنتِ من تملكين الحلقة، الأدوات، الدولة
- **Agent SDK (`claude-agent-sdk`).**أداة تنفيذ متكاملة، اتصالات MCP، الركاب، التنمو السوباجنت، متجر جلسات.

### الأدوات المدمجة

يقوم SDK بإرسال أكثر من 10 أدوات من الصندوق: قراءة / كتابة الملفات ، والغلاف ، والغريب ، والجول ، والحصول على الويب ، وما إلى ذلك. تسجيل الأدوات المخصصة عبر واجهة النظام الأداة القياسية.

### السباقات

هدفان وثقتهما شركة "أنثروبيك":

1. **Parallelization.**إنجاز العمل المستقل في وقت واحد. "العثور على ملف الاختبار لكل من هذه الوحدات 20" هو 20 مهمة متوازية.
2. **Context isolation.**يستخدم المشاركون الفرعيون نافذة سياقهم الخاصة؛ فقط النتائج تعود إلى الموسيقي. يتم الحفاظ على ميزانية الموسيقي.

إضافة حديثة لـ Python SDK: `list_subagents()`،`get_subagent_messages()`لقراءة النصوص المضادة

### متجر الجلسات

بروتوكول الموازاة مع TypeScript:

- `append(session_id, message)` إضافة جولة.
- `load(session_id)` استعادة المحادثة.
- `list_sessions()` إدراج
- `delete(session_id)` مع جلسات تسلسل إلى جلسات فرعية
- `list_subkeys(session_id)` قائمة مفاتيح السباق

`--session-mirror`(علم CLI) يعكس النص إلى ملف خارجي أثناء تدفقه، للتحليل.

### الكوك

مضادات دورة الحياة يمكنك تسجيل:

- `PreToolUse`،`PostToolUse` مكالمات البوابة أو أداة التحقيق.
- `SessionStart`،`SessionEnd`-إقامة وإسقاطها
- `UserPromptSubmit` التصرف على مدخل المستخدم قبل أن يراه النموذج.
- `PreCompact` تشغيل قبل ضغط السياق.
- `Stop`تنظيف عند خروج العميل
- `Notification` تحذيرات القناة الجانبية

الجهاز هو كيفية تدفق العمل (المراجعة للمنهج الدراسي في المرحلة 14) والأنظمة المماثلة تضيف سلوك عبر القطاعات.

### إطار تعقب W3C

تتوزع امتدادات OTel النشطة على المدعو إلى عملية CLI الفرعية عبر عناوين السياق W3C. تظهر جميع آثار متعددة العمليات كثرة واحدة في الخلفية.

### كلود يدير العملاء

البديل المضيف (رأس البيتا `managed-agents-2026-04-01`) العمل المزدوج الطويل الأمد، التخزين الآلي المتبني، التضخم المتبني، التحكم في التجارة للبنية التحتية المدارة.

### حيث يذهب هذا النمط خطأ

- **Subagent over-spawn.**يُمكنكِ أن تُزفّر 100 خادم لـ 100 مهمة صغيرة، والتي تُسيطر على التكلفة العليا، بدلاً من ذلك
- **Hook creep.**كل فريق يضيف الكعبات، كرات الوقت الناشئة، يراجعون الكعبات ربع سنويًا.
- **Session bloat.**الجلسات تتراكم، والحجم ينمو. استخدام `list_sessions`+ سياسة انتهاء الصلاحية

```figure
ae-subagent-isolation
```

## بناءها

`code/main.py`يطبق شكل SDK في stdlib:

- `Tool`،`ToolRegistry`مع مدمج`read_file`،`write_file`،`list_dir`. . .
- `Subagent`- السياق الخاص، الجولة المعزولة، نتائج عائدة.
- `SessionStore` إضافة، تحميل، قائمة، حذف، list_subkeys.
- `Hooks` `pre_tool_use`،`post_tool_use`،`session_start`،`session_end`. . .
- الظهور: العامل الرئيسي يخلق 3 فرع في متوازية (كل فرد منفصل) ، ويتجمّع النتائج، تستمر الجلسة.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

يظهر البصمة عزل السياق السوباجنت (بقي حجم السياق للموسيقي محدوداً) ، تنفيذ الركبة، ومواصلة الجلسة.

## استخدمها

- **Claude Agent SDK**لأول منتجات (كلود) التي تريد شكل (كلود كود)
- **Claude Managed Agents**للعمل المضيف المزمن طويل الأمد.
- **OpenAI Agents SDK**(دروس 16) بالنسبة للشركاء الأوليين في OpenAI.
- **LangGraph + custom tools**إذا كنت تريد آلة الحالة على شكل الرسم البياني بدلا من ذلك.

## أرسله

`outputs/skill-claude-agent-scaffold.md`يضع تطبيق كلود وكيل SDK مع المضخات ، والقبضات ، متجر الجلسات ، و مرفق خادم MCP ، وتوزيع آثار W3C.

## التمارين

1. إضافة عداد من المهام التي تقوم بتجميع 20 مهمة إلى مجموعات من 5 مادة متوازية. قياس حجم سياق الموسيقي مقابل واحد لكل مهمة.
2. تنفيذ`PreToolUse`-حزمة السعر`write_file`المكالمات (5 دقيقة في جلسة) تتبع السلوك.
3. السلك`list_subkeys`كيف يبدو التجميع العميق؟
4. أحضر اللعبة إلى الحقيقية`claude-agent-sdk`حزمة Python ما هي التغييرات حول تسجيل الأدوات؟
5. اقرأ وثائق "كلود" المديرين، متى ستنتقل من المضيف الذاتي إلى المدير؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## المزيد من القراءة

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) شكل مكتبة كود كلويد
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)نمط الإنتاج
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) بديل مضيف
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) النقابة
