# تحديد المحادثة الجماعية والمتحدثين

> يضع التنسيق المشترك للمحادثة N العملاء في محادثة واحدة؛ وظيفة اختيار (LLM، دوري-روبين، أو حسب الطابع) يختار من يتحدث بعد ذلك. هذا هو النموذج الأساسي من المحادثة المتعددة العملاء الناشئة  العملاء لا يعرفون دورهم في الرسم البياني ثابت، فإنهم فقط يتفاعلون مع المجموعة المشتركة. أوتوجين غروب تشات و AG2 GroupChat هي التنفيذات المرجعية: تم الحفاظ على تعبيرات GroupChat في AutoGen v0.2 في فورك AG2; أعادت AutoGen v0.4 كتابتها كنموذج ممثل مدفوع بالحدث. وضعت مايكروسوفت AutoGen في وضع الصيانة في فبراير 2026 وجمعتها مع Kernel Semantic في Microsoft Agent Framework (RC فبراير 2026). البدائية GroupChat تبقى في كل من AG2 و Microsoft وكيل الإطار  تعلمها مرة واحدة، استخدامه في كل مكان.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## المشكلة

الرسوم البيانية ثابتة (LangGraph) رائعة عندما يعرف التدفق العمل. المحادثات الحقيقية ليست ثابتة: أحياناً يسأل المشفر المراجع، أحياناً الباحث، أحياناً الكاتب. إن وضع الرسوم البيانية الصلبة في كل عملية إرسال ممكن ينتج انفجارًا حافة. تريد * العملاء الذين يتفاعلون مع حوض مشاركة * ، مع بعض الوظائف التي تحدد من يتحدث بعد ذلك.

هذا بالضبط ما تفعله (أوتوجين غروب تشات)

## المفهوم

### الشكل

```
              ┌─── shared pool ────┐
              │   m1  m2  m3  ...  │
              └─────────┬──────────┘
                        │ (everyone reads all)
      ┌───────┬─────────┼─────────┬───────┐
      ▼       ▼         ▼         ▼       ▼
    Agent A  Agent B  Agent C  Agent D  Selector
                                           │
                                           ▼
                                  "next speaker = C"
```

كل عميل يرى كل رسالة يتم استدعاء وظيفة اختيار في كل جولة لتحديد من يتحدث بعد ذلك

### الوجوه الثلاثة المختارة

**Round-robin.**دورة ثابتة. تحديد. يُقيس خطياً في N لكنه يتجاهل السياق  يُحصل على المُبرمج على التحول حتى عندما يكون الموضوع مراجعة قانونية.

**LLM-selected.**مكالمة إلى ماجستير في مجال التعليمات العليا التي تقرأ مجموعة الأخيرة وتعطي أفضل المتحدث التالي. واعية السياق ولكن بطيئة: كل دور يضيف مكالمة ماجستير في مجال التعليمات العليا. افتراض AutoGen.

**Custom.**وظيفة Python مع أي منطق تريد. نموذجية: LLM-اختيار مع قواعد الرد (على سبيل المثال، "أعطى دائما المحقق التحول بعد المبرمج").

### API للعملاء المقابلين

```
agent = ConversableAgent(
    name="coder",
    system_message="You write Python.",
    llm_config={...},
)
chat = GroupChat(agents=[coder, reviewer, tester], messages=[])
manager = GroupChatManager(groupchat=chat, llm_config={...})
```

`GroupChatManager`عندما يقوم وكيل بإكمال دورة، يدعو المدير الكائن الذي يعيد العامل التالي.

### الإنهاء

ثلاثة أنماط شائعة:

- **Max rounds.**القفص الصلب في التحولات الكاملة.
- **"TERMINATE" token.**يمكن للعملاء إرسال رسالة من الرقابة، ويقف المدير عندما يظهر واحد.
- **Goal-reached check.**مُحقق خفيف يدير كل دور ويقفز المحادثة عندما تنتهي

### العائلة: الشوك والاندماج

في أوائل عام 2025 ، بدأت مايكروسوفت إعادة كتابة كبيرة من AutoGen (v0.4) حول نموذج ممثل مدفوع بالحدث. قام المجتمع بتشكل سمانيات GroupChat من AutoGen v0.2 باسم AG2 ، الحفاظ على API التي دمجها المستخدمون المبكرون.

في فبراير 2026، أعلنت مايكروسوفت أن AutoGen ستذهب إلى وضع الصيانة، مع دمج نموذج الممثل القائم على الأحداث في **Microsoft Agent Framework**(RC فبراير 2026 ، والتي اندمجت الآن مع Kernel Semantic). مفهوم GroupChat يبقى في كلا المسارات؛ تفاصيل التنفيذ تختلف. AG2 هو المفضل في النهاية لبرنامج v0.2 متوافق.

### عندما يتناسب GroupChat

- **Emergent conversations.**لا تريد أن تُسلك كل المتحدث المحتمل
- **Role-mixing tasks.**يطلب المبرمج الباحث، والباحث يطلب من الموثق، والمتوثق يطلب من المبرمج مرة أخرى. التدفق ليس DAG.
- **Exploratory problem-solving.**فكر في "اجتماع العصابة العقلية" وليس "خط التجميع".

### عندما يفشل

- **Strict determinism.**اختيار الـ "مدرسة العلوم" يمكن أن يكون غير متسقّق، نفس الإجراءات، مختلفة، متحدثين مختلفين.
- **Sycophancy cascades.**العملاء يتوقفون على من يتحدث بأكثر ثقة
- **Context bloat.**كل وكيل يقرأ كل رسالة، بعد 10 جولات يكون السياق ضخم. استخدم التنبؤات (الدرس 15) لتوسيع نطاق المشاهد.
- **Hot speakers.**أحد الوكلاء يهيمن على المحادثة لأن المختار يفضل تخصصاته.

### دردشة المجموعة مقابل المشرف

نفس الأسباب الأولية، مختلفة التخلفات:

- المراقب: أحد العملاء يخطط و الآخرين ينفذون. اختيار هو "اسأل المخطط ماذا يفعل".
- دردشة المجموعة: جميع الوكلاء هم أقرانهم؛ الاختيار هو وظيفة على المجموعة المشتركة.

كلاهما يستخدم الأسباب الأربعة من الدروس 04. تشات المجموعة تفرض افتراضياً إلى التوسيق المختارة في LLM والحالة المشتركة الكاملة.

```figure
swarm-speaker
```

## بناءها

`code/main.py`تنفيذ مجموعةChat من الصفر في stdlib. ثلاثة وكلاء (مبرمج، المراجع، المدير) ، والإختيارات الجولة والشركة القانونية المختارة، وإنهاء على `TERMINATE`إشارة

يطبخ المشاهد النسخة المحادثة بالإضافة إلى تعقب قرار المختار لكلتا التغيرات.

أركض

```
python3 code/main.py
npx tsx code/main.ts
```

## استخدمها

`outputs/skill-groupchat-selector.md`يضبط اختيار مجموعةChat لمهمة معينة  دورية مقابل اختيار LLM مقابل المخصص ، وما هي مدخلات المختار (رسائل حديثة ، تخصصات الوكيل ، حسابات التحول) لاستخدامها.

## أرسله

قائمة التحقق:

- **Max rounds cap.**دائماً، 10-20 لمهام نموذجية
- **Speaker-balance metric.**تدوير المسار لكل عامل، تحذير عندما يتجاوز عدم التوازن عتبة.
- **Termination token.** `TERMINATE`أو وكيل مُحقق مُخصص.
- **Projection or scoped memory.**بعد ~ 10 رسائل، فكر في إعطاء كل وكيل فقط عرض محدد لمنع التورم السياق.
- **Selector logging.**بالنسبة للخيارات المختارة في الجامعة، قم بتسجيل إدخال المختار واختياره. وإلا فإن إزالة التحذير مستحيل.

## التمارين

1. أركض`code/main.py`مقارنة المحادثة تحت دور المكافحة مقابل المختارين في القانون
2. إضافة قاعدة "أقصى حد يتحدث لكل عميل" في المختار كيف يؤثر ذلك على النص؟
3. تنفيذ إيقاف متفق عليه: توقف عندما يعود المراجع "موافق عليه". كم مرة يبدأ قبل السقف الجاري؟
4. اقرأ وثائق AutoGen المستقرة على GroupChat (https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) تحديد الاختيار الافتراضي المستخدم من قبل `GroupChatManager`. . .
5. اقرأ إعادة التأمين AG2 (https://github.com/ag2ai/ag2) ومقارنة v0.2 GroupChat الخاصة به مع v0.4 الإصدار القيادة على الأحداث. ما هي الخصائص الملموسة (الإنتاجية، وتسامح الأخطاء، وتكوين) يضيف v0.4؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GroupChat | "Agents in one chat room" | Shared message pool + selector function. AutoGen / AG2 primitive. |
| Speaker selection | "Who talks next" | The function that picks the next agent. Round-robin, LLM-selected, or custom. |
| GroupChatManager | "The meeting host" | AutoGen component that owns the selector and loops over turns. |
| ConversableAgent | "The base agent" | AutoGen base class; an agent that can send and receive messages. |
| Termination token | "The 'stop' word" | Sentinel string (usually `TERMINATE`) that ends the chat. |
| Hot speaker | "One agent dominates" | Failure mode where the selector keeps picking the same agent. |
| Context bloat | "Pool grows unbounded" | Each agent reads every prior message; context grows with turns. |
| Projection | "Scoped view" | Role-specific view into the shared pool to prevent context bloat. |

## المزيد من القراءة

- [AutoGen group chat docs](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/design-patterns/group-chat.html) تنفيذ المرجعية
- [AG2 repo](https://github.com/ag2ai/ag2) المجتمع AutoGen v0.2 استمرار
- [Microsoft Agent Framework docs](https://learn.microsoft.com/en-us/agent-framework/) الوصي المدمج، RC فبراير 2026
- [AutoGen v0.4 release notes](https://microsoft.github.io/autogen/stable/) إعادة كتابة تفاصيل نموذج الممثل الذي يقود به الأحداث
