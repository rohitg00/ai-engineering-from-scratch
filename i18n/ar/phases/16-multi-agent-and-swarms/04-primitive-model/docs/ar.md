# النموذج البدائي متعدد الوكلاء

> أربعة بدائيات، لا شيء أكثر  الوكيل، التسليم، الحالة المشتركة، الموسيقي  امتداد مساحة التصميم الأربع الأبعاد، والإطاريات متعددة الوكلاء الرئيسية شحن في 2026 (أوتوجين، لانغغغراف، كرواي، OpenAI وكلاء SDK، مايكروسوفت وكيل إطار) هي نقاط في ذلك. هذا الدروس يبنيهم من الصفر، يدير نظام لعبة على كل أربعة، ثم يرسم كل إطار رئيسي على نفس المحاور حتى تتمكن من قراءة أي إصدار جديد في فقرة واحدة.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## المشكلة

كل ستة أشهر يتم شحن إطار جديد متعدد الوكلاء. أوتوجين في عام 2023. كرو آي في عام 2024. لانغغراف و OpenAI سوارم في عام 2024. جوجل ADK في أبريل 2025. مايكروسوفت وكيل إطار RC في فبراير 2026. كل بيان صحفي يدعي أنه "الامتصاص الصحيح".

إذا حاولت تعلمها واحدة في كل مرة سوف تتلاشى. تبدو APIs مختلفة. الأدلة تختلف حول ما هو "وكيل". إطار واحد يدعى ذاكرته المشتركة "لوحة سوداء" ، آخر يدعى "بولز الرسائل" ، وثالث يدعى "StateGraph". تبدأ في الشك في أن الحقل هو مجرد التهجير.

ليس كذلك، تحت التسويق، الأربعة البدائيات مستقرة. تعلمها مرة واحدة، قراءة كل إطار جديد في فقرة واحدة.

## المفهوم

### الأربعة البدائية

1. **Agent** عرض نظام بالإضافة إلى قائمة أدوات. بدون حالة؛ كل تشغيل يبدأ من عرض نظامها وتاريخ الرسالة الحالية.
2. **Handoff** نقل منظم للسيطرة من وكيل إلى آخر.
3. **Shared state** أي هيكل بيانات يمكن لأكثر من وكيل واحد قراءتها (أحيانا الكتابة). مجموعة رسائل، لوحة سوداء، تخزين قيمة المفاتيح، ذاكرة المتجه.
4. **Orchestrator** من يقرر من يتحدث بعد ذلك. الخيارات: رسم بياني صريح (تعريفية) ، مختار المتحدثين في ماجستير في التدريس (رذيل) ، دعوة المتكلم الأخير (OpenAI Swarm) ، أو المخطط على صف (هندسة المعمارات السحرية).

هذا هو مساحة التصميم بأكملها. كل إطار يختار الإعدادات الافتراضية لكل محور. الباقي هو السطحية.

### كيف كل إطار 2026 يخطط له

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

الفرق في السطح يبدو ضخماً، أسفل: نفس أربعة أزرار

### لماذا هذا مهم

بمجرد أن ترى الأسباب الأولية، تصبح مقارنة الإطار قائمة اختبار قصيرة:

- هل يثق الموسيقي في الـ LLM لتوجه (Swarm) أم أنه يضع التوجيه في الرمز (LangGraph) ؟
- هل المشاركة هي التاريخ الكامل للدولة (GroupChat) أو المُتوقع (StateGraph reducer) ؟
- هل يمكن للعملاء تعديل طلبات بعضهم البعض (مدير فريق الإدارة) أو فقط إرسالهم (السحابة) ؟

هذه الأسئلة الثلاثة تجيب على 80% من الإطار الذي يناسب مشكلة معينة. تتوقف عن التسوق "أفضل إطار متعدد الوكلاء" وتبدأ في تصميم المحور الذي تهتم به فعلا.

### البصيرة التي لا تملك ولاية

كل شيء بدائي باستثناء الحالة المشتركة غير مصدر للدولة. العميل هو وظيفة (تفويض، الأدوات). التسليم هو دعوة وظيفة. الموسيقي هو المخطط. **The only stateful thing in the system is shared state.**هذا هو المكان الذي تعيش فيه جميع الأخطاء المثيرة للاهتمام: تسمم الذاكرة (المدرس 15) ، ترتيب الرسائل، الإصدار، كتابة الخلافات.

الإطار الذي يخفي الحالة المشتركة (السحابة) يدفع المشكلة إلى المدعو. الإطار الذي يمركزها (نقطة تفتيش لنجراف، مجموعة AutoGen) تجعلها قابلة للتفتيش ولكن تحويل تكلفة التنسيق على تنفيذ الحالة المشتركة.

### تشريح البدائية الواحدة

#### عميل

```
Agent = (system_prompt, tools, model, optional_name)
```

لا ذاكرة، لا حالة، وكلاء مع نفس النظام و الأدوات قابلين للتبادل كل شيء يبدو وكأنه حالة كل وكيل في الواقع في حالة مشتركة أو بروتوكول التسليم.

#### التسليم

```
Handoff = (from_agent, to_agent, reason, payload)
```

هناك ثلاثة تنفيذات تهيمن على:

- **Function return** أداة تعيد العميل التالي. هذا هو نمط OpenAI Swarm. العملاء يحملون التوجيه في مخططات الأداة الخاصة بهم.
- **Graph edge** لنجغراف. الحواف إعلانية. LLM تنتج قيمة؛ شرط يختار العقدة التالية.
- **Speaker selection** AutoGen GroupChat. وظيفة اختيار (أحيانا نفسها مكالمة LLM) تقرأ الحجم وتختار من يتحدث بعد ذلك.

#### الدولة المشتركة

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

على الأقل قائمة رسائل. غالبًا ما تكون: عناصر بنية (خروجات مهمة CrewAI) ، والسياق الممثل (مخفضات LongGraph) ، والذاكرة الخارجية (MCP ، DB المتجه).

توبولوجيات:**full pool**(كل عميل يرى كل رسالة) و **projected**(الوكلاء يرون عرضًا منجمًا للدور). البحيرات الكاملة بسيطة وتحجم سيئة. البحيرات المُتوقعة تتحجم ولكن تتطلب تصميمًا مخططًا مسبقًا.

#### الموسيقي

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

أربع طعم:

- **Static** يتم تحديد الرسم البياني في وقت البناء (الحدد لـ LongGraph، CrewAI Sequential).
- **LLM-selected** يقرأ ماجستير في العلوم القانونية المجموعة و يختار المتحدث التالي (AutoGen، CrewAI Hierarchical).
- **Handoff-driven** الوكيل الحالي يقرر عن طريق استدعاء أداة التسليم (السحابة).
- **Queue-driven** السيارات المشتركة من الموظفين؛ لا يوجد متحدث صريح (عمارات السلالة، المصفوفة).

### ما هي التغييرات بين الإطار

بمجرد إصلاح الأصول الأولية، فإن قرارات التصميم المتبقية هي:

- **Memory strategy** التفتيش المؤقت مقابل التفتيش الدائم (تفتيش لنجراف).
- **Safety boundary** الذي يمكنه الموافقة على التسليم (الإنسان في الحلقة).
- **Cost accounting**ميزانيات الوسائل لكل وكيل
- **Observability**تتبع التسلل، وتستمر في حالة إعادة التسلل

كلّها قابلة للتنفيذ فوق البدائيّات، ولا أحد منهم أبدائيّ جديد.

```figure
a5-primitive-radar
```

## بناءها

`code/main.py`يطبق الأسباب الأربعة في ~ 150 سطر من stdlib Python. لا LLM حقيقي  كل وكيل هو سياسة مكتوبة لذلك يبقى التركيز على بنية التنسيق.

الصادرات الملفية:

- `Agent` فئة بيانات اسم، عرض النظام، الأدوات، وظيفة السياسة.
- `Handoff` وظيفة تعيد وكيل جديد.
- `SharedState` حديقة رسائل آمنة من الأوتار
- `Orchestrator` ثلاثة خيارات: `StaticOrchestrator`،`HandoffOrchestrator`،`LLMSelectorOrchestrator`(مُحاكاة)

يدير التجربة نفس خط الأنابيب الثلاثة (البحث → الكتابة → مراجعة) من خلال جميع أنواع الموسيقي الثلاثة ويطبع مجموعة الرسائل في النهاية. يمكنك أن ترى أن الخروج تختلف فقط في * من يختار التالي * ؛ وكلاء وحالة مشتركة هي نفسها عبر الرسائل.

إشغله

```
python3 code/main.py
npx tsx code/main.ts
```

الناتج المتوقع: ثلاثة أداءات الموسيقي ، واحد لكل نمط. يقوم كل واحد بطبع مجموعة الرسائل النهائية. يصل الركض القيادة عن طريق التسليم إلى عدد أقل من العاملين إذا قرر الباحث أن يتم ذلك مبكرا  وهذا هو التنازل عن طريق LLM في التخفيض.

## استخدمها

`outputs/skill-primitive-mapper.md`هي مهارة تقرأ أي قاعدة كود متعددة الوكلاء أو مستند الإطار وتعيد الخرائط الأربعة البدائية. تشغيله على إصدار إطار جديد للحصول على فهم الفقرة الواحدة قبل قراءة الوثائق بعمق.

## أرسله

قبل اعتماد إطار جديد، اكتب خريطة بدائية له. إذا لم تستطع، فإن الأدلة غير مكتملة أو الإطار يختلق بدائية خامسة (تحقق من النادر  لذوق حالة مشتركة لم ترى).

وضع الخرائط في وثيقة العمارة الخاصة بك. عندما ينضم أحد أعضاء الفريق الجدد، أرسل لهم الخرائط قبل وثائق API. عندما تتغير إصدارات الإطار، تختلف الخرائط، وليس التغييرات.

## التمارين

1. أركض`code/main.py`ثلاث مرات مع سياسات مختلفة للعملاء لاحظ كيف يغير اختيار الموسيقي الذي يعمل العملاء.
2. تنفيذ نوع رابع للمؤلف: نوع قيادة الصف حيث يشارك العملاء في استطلاع الدولة للعمل. ما هو العجز المتاحة الذي يمكن أن يحدث، وكيف يمكنك اكتشافه؟
3. خذوا البدء السريع لـ LangGraph (https://docs.langchain.com/oss/python/langgraph/workflows-agentsأي من خريطة التجريدات من لانغغراف 1: 1 و التي هي غلافات السهولة؟
4. اقرأ كتاب الطبخ OpenAI Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agentsتعرف على أي من الأربعة البدائيات التي تجعل Swarm أكثر إيرغونومية، والتي تدفعها إلى المُتصل.
5. ابحث عن إطار في هذه الجدول الذي يخفي حالة المشاركة بالكامل، و اشرح ما الذي ينتهي عندما يحتاج العملاء للتنسيق بين التسليمات دون إعادة قراءة التاريخ.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## المزيد من القراءة

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) أوضح صياغة لترتيبات التنفيذ
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) مجموعةChat + اختيار المتحدثين هو المرجع لترتيب المشاريع المختارة في LLM
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) التنسيق على الحافة الرسمية والحالة المشتركة القائمة على القلل
- [CrewAI introduction](https://docs.crewai.com/en/introduction) عوامل الأدوار والهدف والخلفية، العمليات التسلسلية / الهرمية
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) الخط الحي AutoGen v0.2 بعد مايكروسوفت نقل v0.4 في الصيانة
