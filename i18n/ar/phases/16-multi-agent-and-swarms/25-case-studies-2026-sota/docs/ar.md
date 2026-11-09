# دراسات الحالة ووضع التقنية لعام 2026

> ثلاثة مرجعية في درجة الإنتاج لدراسة من نهايتها إلى النهاية، كل منها يوضح شريحة مختلفة من الهندسة متعددة الوكلاء. **Anthropic's Research system**(مُشغّل الأوركستراتور، رموز 15x، +90.2% على عمليات تشغيل أوبوس 4 التي تعمل بمثابة وكيل واحد، قوس قزح) هو حالة الإشراف القنوني. **MetaGPT / ChatDev**(التخصص في الدورات المشفورة بواسطة SOP لمهندسة البرمجيات ؛ "التخفيف التواصلي" من ChatDev ؛ تمديد MacNet إلى > 1000 وكيل عبر DAGs ، arXiv: 2406.07155) هو حالة تفكيك الدور القنوني. **OpenClaw / Moltbook**(أصلًا Clawdbot من قبل بيتر شتاينبرجر ، نوفمبر 2025 ؛ تم تغيير اسمها مرتين ؛ 247 ألف نجم GitHub بحلول مارس 2026; وكلاء ReAct-loop المحليين ؛ Moltbook كشبكة اجتماعية للعملاء فقط مع ~ 2.3 مليون حساب عميل في غضون أيام من الإطلاق ، التي استحوذ عليها Meta 2026-03-10) يوضح ما يحدث على نطاق السكان: النشاط الاقتصادي الناشئ ، مخاطر الحقن السريع ، التنظيم على مستوى الدولة (قيد الصين OpenClaw على أجهزة الكمبيوتر الحكومية ، مارس 2026).**Framework landscape April 2026:**إنتاج لانغغغراف وكرو آي أبرز؛ AG2 هو استمرار مجتمع أوتوجين؛ مايكروسوفت أوتوجين في وضع الصيانة (تم دمجها في Microsoft Agent Framework ، RC Feb 2026) ؛ OpenAI Agents SDK هو خليف إنتاج Swarm ؛ Google ADK (أبريل 2025) هو المشارك الأصلي A2A. كل إطار كبير الآن يقدم دعم MCP؛ معظم السفينة A2A. هذا الدروس يقرأ كل حالة من نهايتها إلى نهايتها ويستقطب الأنماط المشتركة حتى تتمكن من اختيار المرجح المناسب لنظام الإنتاج القادم.

**Type:** Learn (capstone)
**Languages:** Python, TypeScript
**Prerequisites:** all of Phase 16 (Lessons 01-24)
**Time:** ~90 minutes

## المشكلة

الهندسة متعددة الوكلاء هي تخصص شاب. الإشارات الإنتاجية قليلة، وتغطي كل منها جزءًا مختلفًا من المساحة. قراءة كل واحد من هذه المواد مفيدة، ومقارنةها كجميع هي أكثر فائدة. هذه الدروس تعالج ثلاث دراسات قضائية طائفية لعام 2026 كقراءة نهاية إلى نهاية قائمة، وتحديد الأنماط المشتركة، وتخريط المشهد الإطارية حتى تتمكن من اتخاذ خيارات الإطار من المعرفة، وليس التسويق.

## المفهوم

### نظام البحث الإنساني

قضية المشرفين على الإنتاج العاملين. تخطيط وتركيبات كلود أوبوس 4؛ كلود سونيت 4 البحوث الفرعية في الموازية. نشرت وظيفة هندسية: https://www.anthropic.com/engineering/multi-agent-research-system.

النتائج المقاييس الرئيسية:

- **+90.2%**تحسين على أوبوس 4 عن تقييمات البحوث الداخلية
- **80% of BrowseComp variance**شرحها**token usage alone** الفوز متعدد الوكلاء إلى حد كبير لأن كل عضو يحصل على نافذة سياق جديدة.
- **15x tokens per query**مقابل عميل واحد
- **Rainbow deployment**لأن العملاء هم طويل الأمد والدولة.

دروس التصميم الموحدة:

1. **Scale effort to query complexity.**بسيط → وكيل واحد مع 3-10 مكالمات الأدوات. متوسط → 3 وكلاء. بحث معقد → 10+ فرعية.
2. **Broad first, then narrow.**يقوم السباقنتون بالبحث على نطاق واسع؛ يقوم بتوليد الرصاص؛ يقوم السباقنتون المتابعين بعمليات عمق مستهدفة.
3. **Rainbow deploys.**أبقي النسخة القديمة في الوقت المناسب حية حتى ينتهي عملائهم في الطائرة
4. **Verification is not optional.**تم ملاحظة أن النظام يسهل دون أدوار مؤكدة صريحة.

هذه هي حالة المرجعية لتطبيق أوضاع العاملين المراقبين (المرحلة 16 · 05) على نطاق الإنتاج.

### الميتاجبت / تشاتديف

حالة إصدار SOP-دور التفكك. تغطي arXiv:2308.00352 (MetaGPT) و arXiv:2307.07924 (ChatDev).

يرمز MetaGPT SOPs الهندسة البرمجية كطلبات للدور: مدير المنتج ، المهندس المعماري ، مدير المشروع ، المهندس ، مهندس QA. إطار الورقة: `Code = SOP(Team)`. كل دور لديه خطوة ضيقة متخصصة؛ وتحمل التسليمات بين الأدوار أثاثًا مهيكلة (وثائق PRD، وثائق الهندسة المعمارية، والرقم).

مساهمة ChatDev: **communicative dehallucination**. يطلب الوكلاء تفاصيل قبل الإجابة  يطلب وكيل المصمم من البرنامج ما هي اللغة المقصودة قبل رسم واجهة المستخدم، بدلاً من التخمين.

ماكنت (arXiv:2406.07155) تمديد ChatDev إلى **>1000 agents via DAGs**كل عقد DAG هو تخصص الدور؛ الحواف ترمز عقود التسليم. النطاق ممكن لأن التوجيه صريح ويمكن حسابها خارج الاتصال.

دروس التصميم:

1. **Structure matters more than size.**فريق 5 أدوار ضيق يضرب مجموعة غير منظمة من 50 عميل
2. **Handoff contracts in writing.**الأثاث التي تم نقلها بين الأدوار تتبع مخططًا.
3. **Communicative dehallucination**هو نمط رخيص و تحمل الحمولة.
4. **DAGs scale further than chat.**عندما يكون التدفق قابلاً للتعرف عليه، قم بتشفيره

هذه هي الحالة المرجعية للتخصص في الدورات (مرحلة 16 · 08) وتطبيقات الترتيبات المهيكلة (مرحلة 16 · 15).

### النظام البيئي OpenClaw / Moltbook

حالة النطاق السكاني للإنتاج

- **Nov 2025:**سفن (كلاودبوت) (وكيل تشفير "رياكت لوك" المحلي لـ (بيتر شتينبرجر)
- **Jan 2026:**تم تغيير اسمها مرتين في أسبوع واحد (Clawdbot → Moltbot في 27 يناير بعد شكاوى العلامة التجارية، ثم Moltbot → OpenClaw بعد ثلاثة أيام).
- **Feb 2026:**يطلق Moltbook كشبكة اجتماعية للعملاء فقط على نفس الأبدائيات؛ ~ 2.3 مليون حساب عميل في غضون أيام.
- **Mar 2026 (2026-03-10):**(ميتا) تشتري (مولت بوك)
- **Mar 2026:**الصين تقيد OpenClaw على أجهزة الكمبيوتر الحكومية.
- **Mar 2026:**أوبين كلوا يختلف 247 ألف نجمة غيت هوب

هذا ما يبدو عليه الوكيل المتعدد عندما تضع ملايين الوكلاء على أساس مشترك:

- **Emergent economic activity.**العملاء يشترون، يبيعون، ويتعاملون مع بعضهم البعض باستخدام الدفع الرمزي.
- **Prompt-injection risks at population scale.**إنّ إشعارًا ضارًا في ملف الفيروس ينتشر إلى آلاف التفاعلات بين العملاء في غضون ساعات.
- **State-level regulatory response.**خلال أسابيع من الإطلاق، التنظيم يصل إلى النظام البيئي.

دروس التصميم من هذه الحالة هي جزئيًا تقنية، جزئيًا حوكمة:

1. **Multi-agent at population scale is a new regime.**لا تزال أفضل الممارسات في النظام الفردي (التحقق، وضوح الدور) سارية التطبيق، لكنها ليست كافية.
2. **Prompt injection is the new XSS.**تعامل ملفات الشخصية للعملاء والرسائل المتقاطعة مع العملاء كمدخلات غير موثوق بها بشكل افتراضي.
3. **Regulation is faster than design cycles.**خطط لذلك.
4. **Open-source + viral scale compounds.**247 ألف نجم في 4 أشهر غير عادية، تصميم لتنفيذ-إنفجار-حمله.

انظر[OpenClaw Wikipedia](https://en.wikipedia.org/wiki/OpenClaw)وCNBC / Palo Alto Networks تقرير تفاصيل النظام البيئي. بالنسبة للأساس التقني، كشف مخزن Clawdbot / OpenClaw الحلقة المحلية ReAct؛ مشاركات Moltbook العامة تكشف بنية الرسم البياني الاجتماعي في الأعلى.

### منظومة الإطار أبريل 2026

| Framework | Status | Best for | Notes |
|---|---|---|---|
| **LangGraph** (LangChain) | Production leader | structured graph + checkpointing + human-in-the-loop | recommended default for production |
| **CrewAI** | Production leader | role-based crews with Sequential/Hierarchical processes | strong for role decomposition |
| **AG2** | Community maintained | GroupChat + speaker selection | AutoGen v0.2 continuation |
| **Microsoft AutoGen** | Maintenance mode (Feb 2026) | — | merged into Microsoft Agent Framework RC |
| **Microsoft Agent Framework** | RC (Feb 2026) | orchestration patterns + enterprise integration | new entrant; watch |
| **OpenAI Agents SDK** | Production | Swarm successor | tool-return handoff pattern |
| **Google ADK** | Production (April 2025) | A2A-native | Google Cloud integration |
| **Anthropic Claude Agent SDK** | Production | single-agent + Research extension | see the Research system post |

كل إطار كبير الآن سفن**MCP**الدعم ، معظم السفن**A2A**. التوافق بين البروتوكولات لم يعد مُختلفاً

### النماذج المشتركة في كل الحالات الثلاثة

1. **Orchestrator + workers**(المراقب الصريح الأنثروپي، المراقب PM-as-supervisor MetaGPT، وكلاء OpenClaw الفردي + تأثيرات الشبكة).
2. **Structured handoff contracts**(وصف المهام البشرية للشخصيات الفرعية، وثائق المعلومات الخاصة بـ MetaGPT PRD/المعماريات، وأثاث OpenClaw A2A).
3. **Verification as first-class role**(محقق الأنثروبيك، مهندس QA في MetaGPT، ومؤكّدين OpenClaw داخل الشبكة).
4. **Scaling is topology + substrate, not just more agents**(نشر قوس قزح، وخطوط ماكنت الاحتياطية، وخطوط تحتية على نطاق السكان).
5. **Cost is material and disclosed**(15 إشارات، ميزانية لكل دور في MetaGPT، تسعير لكل تفاعل في Moltbook).
6. **Security posture is explicit**(بصحة الرمل من الأنثروبيك، قيود دور MetaGPT، إدخال OpenClaw على الفور كمنطقة هجوم معروفة).

### اختيار مرجع لمشروعك القادم

- **Production research / knowledge task → Anthropic Research.**الفائزون من النطاق الجديد
- **Engineering / tool-chain workflow → MetaGPT / ChatDev.**الأدوار + المعاملات المتعلقة بالشروط + عقود التسليم
- **Network-effect social product → OpenClaw / Moltbook.**الأساس + الاقتصاد الناشئ
- **Classic enterprise automation → CrewAI or LangGraph**(قائد الإنتاج، وقت تشغيل مستقرة).

### الموجة الحديثة لعام 2026

أين يكون الحقل في أبريل 2026:

- **Frameworks are converging.**دعم MCP + A2A هو مخططات الطاولة. تعبيرات التسليم هي الخيار المتبقي للتصميم.
- **Evaluation is hardening.**مقاييس التخفيف من التلوث المضادة للآلات الملوثة
- **Production failure rates are measurable**(Cemri 2025 MAST؛ 41-86.7% على MAS الحقيقي) المجال خارج "يبدو رائع في الظهور" العصر.
- **Cost is the central engineering constraint.**تكلفة الرمز لكل مهمة، و ساعة الجدار لكل تفاعل، قوس قزح نشر التكلفة العليا. وكيل متعدد يفوز على الدقة ولكن يخسر على تكلفة  وهذا التجارة هو قرار الأعمال.
- **Regulation is a near-term input, not a background concern.**الولايات القضائية تتحرك أسرع من دورات نشر فردية.

```figure
a5-orchestrator-scale
```

## استخدمها

`outputs/skill-case-study-mapper.md`هي مهارة تقرأ تصميم نظام متعدد الوكلاء المقترح وتقوم بتخريطه إلى أقرب دراسة حالة، وتظهر قرارات التصميم التي اختبرتها دراسة حالة بالفعل.

## أرسله

القواعد الابتدائية للكثير من الوكلاء في الإنتاج في عام 2026:

- **Start from a case study, not from scratch.**اختر أقرب من أبحاث الأنثروبية / MetaGPT / OpenClaw وتكيف.
- **Adopt MCP + A2A.**التنقل عبر الإطار هو قيمة؛ دعم البروتوكول مجاني.
- **Measure against SWE-bench Pro or your internal Pro-equivalent.**-تأكد من أنّه ملوث
- **Pay the verification tax.**يكلّف المحقق المستقل ~ 20-30% من ميزانية رمزك ويشتري دقة قابلة للقياس.
- **Rainbow deploy long-running agents.**توقع أن تكون عمليات العميل المتعددة الساعات روتينية
- **Read WMAC 2026 and the MAST follow-ups.**الانضباط يتحرك بسرعة

## التمارين

1. اقرأ نظام أبحاث الأنثروبية من نهاية إلى نهاية. حدد ثلاثة قرارات تصميم ستغير إذا استبدلت Opus 4 بنموذج أصغر (على سبيل المثال، Haiku 4).
2. اقرأ أجزاء MetaGPT 3-4 (arXiv:2308.00352). قم بتشفير SOP واحد من نطاقك الخاص (ليس البرمجيات) كطلبات الدور. كم عدد الدورات التي تتضمن SOP؟
3. اقرأ ChatDev (arXiv:2307.07924). حدد آلية "الاهلوسة التواصلية". تنفيذها في أحد أنظمة وكلاء متعددة الحالية.
4. اقرأ عن OpenClaw و Moltbook اختر وضع فشل محدد ظهر على نطاق السكان الذي لن يظهر في نظام 5 وكلاء كيف ستعمل ضد ذلك؟
5. اختر مشروعك الحالي متعدد الوكلاء. أي من الدراسات الحالة الثلاثة هي المرجح الأقرب؟ أي قرارات التصميم من تلك الدراسة الحالة لم تتبنى بعد؟ اكتب واحدة ستبنيها هذا الربع.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Anthropic Research | "The supervisor reference" | Claude Opus 4 + Sonnet 4 subagents; 15x tokens; +90.2% over single-agent. |
| MetaGPT | "SOP as prompts" | Role decomposition for software engineering; `Code = SOP(Team)`. |
| ChatDev | "Agents as roles" | Designer / programmer / reviewer / tester; communicative dehallucination. |
| MacNet | "Scale ChatDev via DAG" | arXiv:2406.07155; 1000+ agents via explicit DAG routing. |
| OpenClaw | "Local ReAct-loop agents" | Steinberger's project; 247k stars by March 2026. |
| Moltbook | "Agent-only social network" | 2.3M agent accounts; acquired by Meta March 2026. |
| Rainbow deploy | "Multiple versions concurrent" | Keep old runtime versions alive for in-flight long-running agents. |
| Communicative dehallucination | "Ask before answering" | Agents request specifics from peers instead of guessing. |
| WMAC 2026 | "The AAAI workshop" | April 2026 community focal point for multi-agent coordination. |

## المزيد من القراءة

- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) إشارة الإنتاج للمشغلين المشرفين
- [MetaGPT — Meta Programming for Multi-Agent Collaborative Framework](https://arxiv.org/abs/2308.00352) تدهور دور SOP
- [ChatDev — Communicative Agents for Software Development](https://arxiv.org/abs/2307.07924) الوهم الاكتئابية
- [MacNet — scaling role-based agents to 1000+](https://arxiv.org/abs/2406.07155) مقياس مبني على يوم التأجيل
- [OpenClaw on Wikipedia](https://en.wikipedia.org/wiki/OpenClaw) نظرة عامة على النظم البيئية
- [WMAC 2026](https://multiagents.org/2026/)ورشة عمل برنامج الجسر 2026 لـ AAAI حول تنسيق متعدد الوكلاء
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/workflows-agents) قائد الإنتاج
- [CrewAI docs](https://docs.crewai.com/en/introduction)الإطار القائم على الأدوار
