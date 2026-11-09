# التبرعات والروتينات

> أوبن إي (أكتوبر 2024) سوارم تم تصريف التنسيق متعدد الوكلاء إلى اثنين من البدائيين: **routines**(إرشادات + أدوات كإرشادات النظام) و **handoffs**(أداة تعيد عميل آخر) لا توجد آلة حكومية، لا توجد فرع DSL  طرق LLM عن طريق الاتصال بأداة التسليم الصحيحة. ويعتبر SDK OpenAI Agents (مارس 2025) خليفة الإنتاج. السلالة نفسها لا تزال أكثر مرجعية مفهومية نظيفة  مصدرها كله يناسب في بضع مئات من الخطوط. النمط فيروسي لأن سطح API تقريبًا "الوكيل = التسجيل + الأدوات؛ التسليم = وكيل العودة للعمل". الحد: غير الحكومي ، لذلك الذاكرة هي مشكلة المدعو.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## المشكلة

كل إطار عمل متعدد الوكلاء يريد منك أن تتعلم DSL: العقد والحواف LangGraph، طاقم CrewAI ومهام، AutoGen GroupChat والمديرين. DSLs مجرد تجريدي حقيقي، لكنها تجعل الشيء يشعر أكثر ثقلًا مما يحتاج إلى أن يكون.

يضغط السحابة في الاتجاه المعاكس: استخدم القدرة على استدعاء الأدوات التي يمتلكها النموذج بالفعل. تصبح التسليمات دعوات الأدوات. الموسيقي هو أي وكيل يدير الحوار حاليا. الآلة الحكومية متضمنة في طلبات نظام العملاء.

## المفهوم

### اثنان من البدائيين

**Routine.**إشارة نظامية تحدد دور وكيل وأدوات متاحة. فكر في ذلك مثل مجموعة محددة من التعليمات: "أنت وكيل التجديد؛ إذا سأل المستخدم عن استردادات، تسلم إلى وكيل استرداد".

**Handoff.**أداة يمكن للعميل أن يطلق عليها التي تعيد كائن عميل جديد. وقت تشغيل السلال يكتشف قيمة العامل العاملة وتبديل العامل النشط للدور التالي.

هذا هو مجردة كاملة.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

تُجعل طلب نظام وكيل التجديد يختار التسليم الصحيح بناءً على رسالة المستخدم.

### لماذا هو فيري

- **Small API.**مفاهيم يجب أن تتعلمها
- **Uses what the model already does.**الاتصال بالأدوات هو بالفعل في مستوى الإنتاج عبر مقدمي الخدمات.
- **No state-machine burden.**أنت لا تصف الرسم البياني، بل تحذيرات العملاء تصف من يسلّمونها.

### التجارة بدون جنسية

السجدة غير ذات أساسية صراحة بين الجرائد. يحتفظ الإطار بتاريخ الرسالة خلال الجولة، لكنه لا يستمر في أي شيء. الذاكرة، الاستمرارية، المهام الطويلة الجولة  كل مشكلة المدعو.

في الإنتاج (OpenAI Agents SDK ، مارس 2025) ، كان هذا أحد الأشياء الرئيسية التي تغيرت: يضيف SDK إدارة جلسات مدمجة ، والحواجز ، والتتبع مع الحفاظ على التسليم بدائي.

### عندما يتناسب السحابة/الرفاق

- **Triage patterns.**وكيل الخط الأمامي يُرسل المستخدم إلى متخصص
- **Skill-based handoffs.**"إذا كانت المهمة تحتاج إلى رمز، اتصل بالمدمج؛ وإذا كانت تحتاج إلى بحث، اتصل بالباحث".
- **Short, bounded conversations.**دعم العملاء، أسئلة استبيانية إلى تذاكر، عمليات عمل بسيطة.

### عندما يناضل السجّاد

- **Long sessions with shared memory.**إعادة إعادة وضع المحادثة إلى إشارة العميل الجديد بالإضافة إلى تاريخها، لا توجد حالة ثابتة عبر العملاء دون ذاكرة مديرات المكالمة
- **Parallel execution.**التداول هو واحد في كل مرة  المفتوحات العميلة النشطة. التوازي يتطلب من المدعو تشكيل عدة أداءات السوارم.
- **Audit and replay.**من الصعب إعادة تشغيل الرحلات التي لا تملك ولاية الدولة بالضبط؛ اختيار الـ LLM للاستقبال ليس محدداً.

### SDK OpenAI Agents (مارس 2025)

يضيف الخليفة الإنتاجية:

- **Session state.**خيط مستمر عبر الركوب
- **Guardrails.**خطوات التحقق من الصلاحية المدخلة/المخرجة
- **Tracing.**كل مكالمة وكل تسليم أدوات مسجلة
- **Handoff filters.**كنسيراً على ما يُحمل السياق عند التسليم

البدائية التي يتم تسليمها على قيد الحياة؛ يتم إضافة التجهيزات الإنتاجية حولها.

### المجموعة مقابل المجموعة

كلاهما يستخدم توجيهات القيادة العليا، ولكنهما تختلفان في**who picks next**:

- مجموعة الدردشة: اختيار (العمل أو LLM) يختار المتحدث التالي من الخارج.
- السحابة: الوكيل الحالي يختار خليفته عن طريق استدعاء أداة التسليم.

"السوارم" هو "الوكيل يقرر ما هو التالي" ؛ "الجماعةChat" هو "المدير يقرر ما هو التالي". قرار السوارم يعيش في أداة العميل النشط المكالمة ؛ حياة الجماعةChat في `GroupChatManager`. . .

```figure
sw-handoff-routing
```

## بناءها

`code/main.py`تنفيذ Swarm من الصفر: فئة بيانات العميل، آلية التسليم (الأداة تعيد العميل) ، ومركبة تشغيل التي تكتشف مفاتيح العميل.

الديمو: طريق وكيل التجديد لتسديد المبالغ أو المبيعات أو دعم المتخصصين. لكل متخصص أدوات خاصة به. يقوم حلقة التشغيل بطبع كل عملية تسليم.

أركض

```
python3 code/main.py
npx tsx code/main.ts
```

## استخدمها

`outputs/skill-handoff-designer.md`تصميم توبولوجيات التسليم للمهمة المعينة: أي عوامل موجودة، أي التسليمات التي يمكن أن تدعو إليها، ما هي النطاقات التي تنتقل.

## أرسله

قائمة التحقق:

- **Handoff logging.**كل عملية تسليم يكتب حدث تتبع مع من وكيل، إلى وكيل، صورة سياقية.
- **Context transfer rules.**قرر ما يتحرك في التسليم: التاريخ الكامل (غالي) ، آخر رسائل N، أو ملخص.
- **Guardrail on handoff.**يجب أن تكون التسليم إلى متخصص لديه تصريحات مختلفة للأدوات مصحوبة  وإلا فإن الحقن السريع يمكن أن يفرض التسليم غير المرغوب فيه.
- **Loop detection.**اثنين من العاملين يقدمون ذهابا وإيابا هو فشل شائع؛ الكشف عن مع التحقق بسيط آخر K حلقة.
- **Fallback agent.**إذا لم يكن هناك هدف للتسليم، فلتعود إلى وضع آمن.

## التمارين

1. أركض`code/main.py`تأكد من أن العميل النشط في الجولة الثانية قد تم استرداده
2. إضافة قاعدة الكشف عن الحلقة: إذا كان نفس العاملين قد سلموا 3 مرات على التوالي، إجبار الخروج. تصميم الرد الخلفي.
3. اقرأ مستندات OpenAI Agents SDK على مرشحات التسليم. تنفيذ نسخة "التخميم على التسليم": يقوم الوكيل الخارجي بتضغط السياق إلى ملخص رصاص قبل أن يتولى الوكيل الداخلي.
4. مقارنة إرسال السوارم مع مجموعة تشات مينيجر الاختيار. ما النمط الذي يجعل الحقن السريع أسوأ، ولماذا؟
5. اقرأ كتاب الطبخ السحريةhttps://developers.openai.com/cookbook/examples/orchestrating_agentsتُحدد قرار تصميم صريح واحد يقوم Swarm بتغيير SDK OpenAI Agents أو الاحتفاظ به.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## المزيد من القراءة

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) المفصل المرجعي
- [OpenAI Swarm repo](https://github.com/openai/swarm) التنفيذ الأصلي، والذي يتم الاحتفاظ به كمرجع مفهوم
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) خليفة الإنتاج مع جلسات وتتبع
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) كيف يستخدم مستخدمو كود كود نمطاً شبيهًا بالتسليم عبر `Task`
