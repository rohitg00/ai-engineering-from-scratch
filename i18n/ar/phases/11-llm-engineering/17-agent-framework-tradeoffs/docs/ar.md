# التداولات الإطارية للعملاء  الرسم البياني ، الدور ، وركبت الممثل

> كل إطار يبيع نفس التجربة (مُدبر البحث يُبني تقريرًا) ويخفي نفس الخطأ (تقاتل مخطط الحالة مع طبقة التنسيق). اختر الإطار الذي يطابق تجرياته شكل مشكلتك. كل شيء آخر هو الغراء الذي تكتبينه مرتين.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## المشكلة

لديك مهمة تحتاج إلى أكثر من مكالمة واحدة لدرجة الماجستير. ربما يكون ذلك سير عمل بحثي (خطة، بحث، تلخيص، اقتباس). ربما يكون خط أنابيب مراجعة الشفرة (مختلفة البحث، النقد، تصحيح، تصحيح). ربما يكون مساعد متعدد التحولات الذي يحفظ الرحلات، ويكتب رسائل البريد الإلكتروني، ويملأ تقارير الإنفاق. انت تختار إطار.

بعد ثلاثة أيام، تكتشف تسربات التجريدات في الإطار. يمنحك CrewAI أدوار لكنها تقاتلك عندما يحتاج "المباحث" إلى تسليم خطة مهيكلة إلى "الكاتب". AutoGen يمنحك دردشة بين العملاء ولكن ليس لديها حالة من الدرجة الأولى لذلك نقطة التفتيش الخاصة بك هي حشيش من سجل المحادثة. (لانغغغراف) يعطيك رسمياً للحالة لكنه يضطرك إلى تسمية كل انتقال قبل أن تعرف ما سيفعله العميل (آجنو) يعطيك عملية تجريدية من وكيل واحد تصرخ عندما تحاول أن تُنتشر إلى ثلاثة عمال متزامنين

ليس الحل هو "اختر أفضل إطار". إنه لتطابق استرداد الأساسي للإطار إلى شكل مشكلتك. هذا الدروس رسم تلك الخريطة.

## المفهوم

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

أربعة إطار يهيمن على المشهد 2026، لا تكون تجريدها الأساسية هي نفسها.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### ما تعنيه كلمة "التجريد" في الواقع

الجرد الجوهري من الإطار هو الشيء الذي ترسم عليه على اللوحة البيضاء عندما تقوم بتقديم الهندسة المعمارية.

- **LangGraph**الرمز هو خطوات، والحواف هي انتقالات، ويتم كتابة كائن الحالة في كل نقطة. النموذج العقلي هو آلة الحالة.
- **CrewAI**- يمكنك رسم جدول الأعضاء. لكل دور وصف وظيفي ومدير يتوجه المهام. النموذج العقلي هو فريق صغير من المتخصصين.
- **AutoGen**إذا كنت ترسم رسالة "سلاك دي إم" ، يقوم وكلاء اثنان برسالة إلى بعضهم البعض ، والثالث ينضم إذا كنت بحاجة إلى مراقب. النموذج العقلي هو الدردشة.
- **Agno**يمكنك رسم صندوق واحد مع أدوات معلقة عليه. وضع صناديق بجانب بعضها البعض لفريق. النموذج العقلي هو "وكيل مع بطاريات شاملة".

### السؤال الدولي

الدولة هي المكان الذي تفشل فيه معظم الخيارات الإطارية في الإنتاج.

- **LangGraph.**حالة النمط (`TypedDict`أو نموذج بيدانتيك) ، ومرادخات لكل مجال، ومقاطع التفتيش من الدرجة الأولى (SQLite/Postgres/Redis).
- **CrewAI.**تدفقات الدولة كسلسلة بين المهام عبر `context`المجال، أو المُهيّدة من خلال `output_pydantic`لا يوجد متجر دائم لكل طاقم خارج الصندوق، أنت تخرج من هنا لو كان الطاقم يجب أن ينجو من إعادة البدء
- **AutoGen.**الحالة هي تاريخ الدردشة وأي حدد من قبل المستخدم `context`. لا تزال نسخ المحادثة قائمة، حالة سير العمل التعسفي لا تفعل إلا إذا كتبت مُعدّلات.
- **Agno.**برامج التخزين المدمجة (SQLite، Postgres، Mongo، Redis، DynamoDB) متصلة بـ `Agent`عبر`storage=` جلسات المحادثة وتذكريات المستخدم تستمر تلقائيا. ليس نقطة التفتيش الكاملة الرسمية؛ متجر جلسات.

### سؤال التفرق

كل عميل غير بسيط يتخذ قرارات عن الفرع

- **LangGraph** يمكنك أن تقرر، عبر الحواف المشروطة. التوجيه هو وظيفة Python مع فرع مسمى. الفرع هي من الدرجة الأولى في الرسم البياني المجمعة؛ سجل نقطة التفتيش التي تم أخذ فرع.
- **CrewAI** يقرر المدير في وضع Hierarchical؛ في وضع تسلسلية تقرر في وقت البناء. التوجيه ضمني في قائمة المهام؛ لا يوجد "إذا" من الدرجة الأولى خارج طلب المدير.
- **AutoGen**الوكلاء يقررون عن طريق الدردشة، فالتفرع يتبادر من الذي يتحدث بعد ذلك.`GroupChatManager`يختار المتحدث التالي ، يمكنك كتابة خط يدوي `speaker_selection_method`لكن الاختيار المعيّن هو القيادة على القانون.
- **Agno** يقرر الوكيل ما هي الأداة التي سيتم الاتصال بها بعد ذلك. لدى الفرق وضع منسق/موج/مساعد؛ وتكون الفرع التي تتجاوز ذلك مسؤولية المطور.

### سؤال الملاحظة

- **LangGraph** OpenTelemetry عبر LangSmith أو أي مصدر OTel. كل انتقال عقدة هو فترة تتبع؛ نقاط التفتيش مزدوجة كمتابعة قابلة للعب. LangSmith هو الخيار الأول للطرف؛ Langfuse / Phoenix لديها أيضاً مكيّفات.
- **CrewAI** أول درجة OpenTelemetry منذ أواخر 2025؛ التكامل مع Langfuse، Phoenix، Opik، AgentOps.
- **AutoGen** إدماج OpenTelemetry عبر `autogen-core`العميل العميل و أوبيك لديهم وصلات تتبع الكتلة لكل رسالة العميل وليس لكل عقدة
- **Agno**- مدمج`monitoring=True`العلم بالإضافة إلى مصدرات OpenTelemetry؛ التكامل الوثيق مع Langfuse لمتابعة الجلسات.

### التكلفة والخفض

جميع الإطار الأربعة تضيف تكاليف عامة لكل مكالمة (منطق الإطار، التحقق من التحقق من التحقق من التسلسل). ترتيب تقريب لزيادة التكاليف العامة: Agno ≈ LangGraph < CrewAI ≈ AutoGen. يهيمن الفرق على مقدار توجيه LLM الإطار الإضافي. ينفق مدير التسلسل التسلسل في CrewAI رموزًا لتحديد من سيذهب بعدًا.`GroupChatManager`مثل ذلك. لانغغراف ينفق الرموز فقط عندما تكتب`llm.invoke`طريق (أغنو) بمثابة عميل واحد ضيق

عندما يكون التكلفة لكل جولة مهمة، تفضل التوجيه الصريح (حواف LongGraph، AutoGen `speaker_selection_method`) على طريق اختيار الدرجة العليا.

### التفاعلية

- **LangGraph** **LangChain**أدوات، محفظات، أدوات القانون. مُعدّل MCP من الدرجة الأولى (الأدوات المستوردة كخادمات MCP).
- **CrewAI**أدوات تتراث من`BaseTool`أدوات لانج تشين وأدوات لاما إنديكس وأدوات MCP كلها تتكيف مع.`allow_delegation=True`. . .
- **AutoGen**`FunctionTool`يُغلف أيّة صوتاً من Python، ومتكيف MCP متاح، ويتم ربطها بقوة إلى نظام بيئي AG2 لنمطات العميل إلى العميل.
- **Agno**`@tool`المعدات المعدنية أو الفرعية BaseTool؛ مكيّف MCP؛ يمكن مشاركة الأدوات بين العملاء والفرق.

## المهارة

> يمكنك أن تشرح، في جملة واحدة، لماذا إطار معين هو مناسب لمشكلة عامل معين.

قائمة التحقق من قبل:

1. **Draw the shape.**هل هذه هي الرسم البياني (حالة مصممة، عمليات انتقالية مسمومة) ؟ لعبة دور (المختصون يمنحون العمل) ؟ دردشة (الوكلاء يتحدثون حتى ينتهيون) ؟ وكيل واحد مع الأدوات؟
2. **Decide who branches.**التفرع الذي يقرر المطور → لانغغراف. المدير الذي يقرر وكيل → CrewAI التسلسلي. دردشة الناشئة → AutoGen. أداة مكالمة - قرر → Agno.
3. **Check the state budget.**هل تحتاج إلى استئناف من نقطة التفتيش؟ السفر عبر الزمن؟ الإنسان يقاطع في منتصف الجولة؟ إذا كان ذلك صحيحًا، فإن لنجغراف هو الافتراض الافتراضي؛ جلسات أجنو تغطي حالة المحادثة.
4. **Check the cost budget.**التوجيه المختارة لشركة الشؤون التجارية تكلف رموز إضافية في كل دور إذا كان الوكيل يدير آلاف المرات في اليوم، يفضل التوجيه الصريح.
5. **Budget the framework overhead.**كل إطار يعتمد على آخر. إذا كانت المهمة هي اثنين من مكالمات LLM و أداة، اكتب 30 سطر من بيثون بسيطة؛ لا إطار أرخص من أي إطار.

رفض الوصول إلى إطار قبل أن تتمكن من رسم الرسم البياني أو الرسم البياني أو الدردشة أو مربع الوكيل أو رفض اختيار واحد يضطرك إلى محاربة نموذج الدولة من أجل الشيء الذي تحتاجه فعلاً.

## المصفوفة القرارية

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## التمارين

1. **Easy.**خذ نفس المهمة "بحث مقر Anthropic، كتابة 200 كلمة قصيرة، اقتباس المصادر" و تنفيذها في LangGraph (أربعة عقدات: خطة، بحث، كتابة، اقتباس) وفي CrewAI (ثلاث أدوار: الباحث، الكاتب، المحرر). تقرير تكلفة رمز لكل تشغيل وخط من الرمز.
2. **Medium.**بناء نفس المهمة في AutoGen (المباحث  كاتب دردشة، المحرر ينضم عبر `GroupChat`) و (أجنو)`search_tools`و`write_tools`(ب) القدرة على الاستئناف بعد الحادث، (ج) القدرة على حقن موافقة بشرية قبل خطوة الكتابة.
3. **Hard.**قم ببناء نص شجرة القرار `pick_framework.py`الذي يأخذ وصفًا قصيرًا للمشكلة (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`) ويرجع توصية مع توجيه جملة واحدة. تحقق منها على ست حالات تصممتها بنفسك.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## المزيد من القراءة

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/)الرسم البياني للدولة، نقاط التفتيش، المقاطعات، السفر عبر الزمن.
- [CrewAI documentation](https://docs.crewai.com/) طاقم، تدفقات، وكلاء، مهام، عمليات.
- [AutoGen documentation](https://microsoft.github.io/autogen/) وكيل المحادثة، دردشة المجموعة، فرق، أدوات.
- [Agno documentation](https://docs.agno.com/)العميل، الفريق، التدفق العملي، التخزين، الذاكرة.
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) مكتبة النمط (سلاسل السرعة، التوجيه، التوازي، الموسيقي-العمال، المقيّم-التحسين) إطار-مستعد.
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629)كل إطار يرتدي ملابس
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155)ورقة تصميم شركة "أوتوجين".
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442)أساس لعبة الدور التي تقوم عليها كومات الشخصيات على أسلوب CrewAI.
- المرحلة 11 · 16 (الخطوط العريضة)  الإطار الذي يحدد هذا الدروس الموازنة عليه.
- المرحلة 11 · 19 (التفكير)  نمط يخطط نظيفا إلى LangGraph ولكن محرجة إلى CrewAI.
- المرحلة 11 · 22 (ملاحظة الإنتاج)  كيفية استخدام الأدوات أياً كان الإطار الذي تختاره.
