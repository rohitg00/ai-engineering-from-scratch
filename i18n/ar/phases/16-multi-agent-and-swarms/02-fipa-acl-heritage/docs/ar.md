# تراث FIPA-ACL وقانونات الكلام

> قبل MCP، قبل A2A، كان هناك FIPA-ACL. في عام 2000، صادقت مؤسسة العاملين الفيزيائيين الذكاء (FIPA، التي أصبحت لجنة معايير مجتمع الكمبيوتر IEEE في عام 2005) على لغة اتصال العامل مع عشرين لغة تنفيذية، ولغتين محتوى، ومجموعة من بروتوكولات التفاعل  العقد الشبكة، الاشتراك / الإخطار، الطلب-عندما. لقد اختفى من الصناعة لأن تكاليف الإنتولوجيا العليا كانت ثقيلة جداً على شبكة الإنترنت، ولكن إحياء LLM لنظم متعددة الوكلاء يعد ببساطة نفس الأفكار دون التعريف الرسمي: تعاقد JSON تعوض عن الأداء، اللغة الطبيعية تعوض عن الإنتولوجيا. هذا الدروس يقرأ FIPA-ACL بجدية حتى تتمكن من رؤية ما هي قرارات بروتوكول 2026 إعادة الاختراع، والتي هي الابتكار،

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## المشكلة

إنّ المشهد الـ 2026 من الوكلاء والبروتوكولات مشغول: MCP للأدوات، A2A للوكلاء، ACP لمراجعة المؤسسات، ANP للثقة اللامركزية، NLIP للمحتوى باللغة الطبيعية، بالإضافة إلى CA-MCP وعشرات مقترحات بحثية. كلّ مُحدد يعلن نفسه كأساسي.

القراءة الصادقة هي أن معظمهم يعيدون اكتشاف شجرة قرار محددة جداً عمرها عشرين عاماً. نظرية الخطاب من أوستن (1962) و سيرل (1969) أعطتنا "التعبيرات هي الأعمال". KQML (1993) حول ذلك إلى بروتوكول الأسلاك. فايبا-ACL (مصدقة عام 2000) أنتجت قياس المرجعية: عشرين أداء، لغات المحتوى SL0/SL1، بروتوكولات التفاعل للشبكة العقدة والإشعار. كانت JADE و JACK منصات مرجعية Java. انحدر الجهد في حوالي عام 2010 لأن تكاليف التطبيقات كانت ثقيلة جداً وكان الويب يفوز.

عندما تنظر إلى MCP `tools/call`، دورة حياة المهام A2A، أو مخزن السياق المشترك CA-MCP، أنت تلقي نظرة على أكثر لينة، JSON-أصل إعادة التأهيل من قرارات FIPA. معرفة التراث يخبرك أمرين: أي "الابتكارات" الجديدة هي في الواقع إعادة الاختراع، وأي أنماط الفشل القديمة ستجد المواصفات الجديدة مرة أخرى.

## المفهوم

### أفعال الخطاب، في فقرة واحدة

لاحظ أوستن أن بعض الجمل لا تصف العالم  أنها تغيره. "أوعد". "أطلب". "أعلن". "أطلق على هذه البيانات التمثيلية. أعلنت سيرل خمسة فئات: الإيجابية، الإرشادية، المفروضة، التعبيرية، الإعلانية. جعلت KQML (Finin et al., 1993) هذه العملية للعملاء البرمجيات: رسالة هي أداء (الفعلية) بالإضافة إلى المحتوى (ما هو العمل). قام الاتحاد الدولي للطاقة النفسية (FIPA-ACL) بتنظيف الفجوات في KQML ووضعها على مستوى حوالي عشرين أداء.

### العشرين أداءات FIPA (قائمة جزئية)

| Performative | Intent |
|---|---|
| `inform` | "I tell you P is true" |
| `request` | "I ask you to do X" |
| `query-if` | "Is P true?" |
| `query-ref` | "What is the value of X?" |
| `propose` | "I propose we do X" |
| `accept-proposal` | "I accept the proposal" |
| `reject-proposal` | "I reject the proposal" |
| `agree` | "I agree to do X" |
| `refuse` | "I refuse to do X" |
| `confirm` | "I confirm P is true" |
| `disconfirm` | "I deny P" |
| `not-understood` | "Your message did not parse" |
| `cfp` | "Call for proposals on X" |
| `subscribe` | "Notify me when X changes" |
| `cancel` | "Cancel the ongoing X" |
| `failure` | "I tried X and failed" |

القائمة الكاملة موجودة`fipa00037.pdf`النقطة ليست في حفظها النقطة هي أن كل واحد منهم يتوافق مع البدائية بروتوكول LLM في نهاية المطاف إعادة إضافة.

### رسالة FIPA-ACL القنونية

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

سبعة حقل تحمل غلاف البروتوكول، وحقل واحد (`content`ويحمل الحمل المفيد. بقية الحقول هي بالضبط ما تقوم بإعادة اختراعها كلما قمت بإعادة محاولات، وتدريب، وترتيبات على بروتوكول JSON.

### المنصات القديمة

**JADE**(تهيئة تطوير وكيل جاوا ، 19992020s) كان الوقت الإضافي الأكثر استخدامًا مطابقًا لـ FIPA. تمدد وكلاء فئة أساسية ، وتبادل رسائل ACL ، وتشغيل داخل الحاويات ، وتنسيقها باستخدام "السلوكيات". تم شحن مكتبة بروتوكول التفاعل مع شبكة العقد ، والإشتراك-إشعار ، والطلب-عندما ، والقبول-مقترح.

**JACK**(برمجيات موجهة للعملاء، تجارية) أكدت على تقرير BDI (الإيمان-الرغبة-النوايا) فوق رسائل FIPA.

كل منهما انخفض بعد أن أكل كومة الويب حالات استخدام متعددة الوكلاء. MCP و A2A هي "المحاوضات" في وقت تشغيل عام 2026.

### لماذا اختفت الـ FIPA

- **Ontology overhead.**وطلب الهيئة الوطنية للصحة العالمية (FIPA) أن تكون هناك أونتولوجيا مشتركة لتحليلها`content`.توافق على المنظومات هي عملية قياسية طويلة السنين.
- **Formal semantics nobody used.**أعطت SL (اللغة السمانية) ظروف حقيقية صارمة، ولكن معظم أنظمة الإنتاج استخدمت محتوى شكل حر وتجاهلت الفورمالية.
- **Tooling lock-in.**كان JADE فقط في جاوا، كان JACK تجاريًا.
- **The internet won the stack.**REST، ثم JSON-RPC، ثم gRPC استبدل نقل ACL.

### إحياء ماجستير في مجال القانون هو FIPA-lite

مقارنة FIPA `request`إلى مؤسسة معتمدة`tools/call`:

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

نفس الغلاف، مختلفة النص. كلا يحملون: من، من، نية، الحمل المفيد، هوية التواصل. لا ثورة على الآخر  هم تنازلات مختلفة على نفس التصميم.

يوضح مسح 2025 الذي أجرته ليو وغيره ("مسح بروتوكولات التفاعلية مع الوكلاء: MCP ، ACP ، A2A ، ANP " arXiv: 2505.02279) هذا التسلسل: يتوافق MCP مع أعمال الكلام باستخدام الأدوات ، A2A مع أعمال الكلام مع العملاء ، ACP مع أعمال الكلام التي تعقب المسار ، ANP مع امتدادات الهوية اللامركزية. التفاصيل الجديدة هي نسيج ACL مع نحو JSON وترتيبات أكثر إطلاعًا.

### التنازل، صرح بوضوح

**What FIPA gave you and modern specs drop:**

- الإدراك الرسمي يمكنك إثبات`inform`يعني أن المرسل يعتقد المحتوى.
- فهرسة قائمة من الأداء لا داعي لإعادة الحجة "يجب أن يكون لدينا`cancel`؟ "
- عقود من أنماط التفاعل-بروتوكول  العقد-شبكة، الاشتراك-إخطار، اقتراح-قبول  مع سمات الدقة المعروفة.

**What modern specs give you and FIPA did not:**

- تحميلات مفيدة من JSON متوافقة مع كل أداة حديثة.
- محتوى اللغة الطبيعية الذي يمكن أن تفسره الـ LLM دون أن يكون هناك علم منقوش يدوياً.
- النقل عبر الإنترنت (HTTP، SSE، WebSocket).
- اكتشاف القدرة عبر MCP مباشرة `server/discover`و بطاقات العميل A2A.

أضعف تعبيرات النية لسهولة تنفيذها، هذه هي التجارة الدقيقة.

### بروتوكولات التفاعل التي تستحق التنسيق

تم إرسال 15 بروتوكول للتفاعل من قبل الهيئة. ثلاثة تستحق نقلها إلى أنظمة LLM متعددة الوكلاء:

1. **Contract Net Protocol (CNP).**قضايا المدير `cfp`(دعوة للمقترحات) ؛ الجهات المقدمة الرد على`propose`• الإدارة تقبل/ترفض هذا هو نمط سوق المهام القنوني (المرحلة 16 · 16 من التفاوض).
2. **Subscribe/Notify.**المشترك يرسل`subscribe`؛ الناشر يرسل `inform`كلما تغير الموضوع هذا كل حفل في عام 2026
3. **Request-When.**"فعل X عندما تستمر الحالة Y". التأجيل في العمل مع الشروط المسبقة. 2026 التناظرية هي مهام تأجيل في محركات سير العمل الدائمة (مرحلة 16 · 22 قياس الإنتاج).

كل خريطة نظيفة على خطوط الرسائل الحديثة، استطلاع HTTP +، أو SSE التدفق.

### ما الذي يكسر عندما تتركون الأونتولوجيا

بدون علم أساسية مشترك، يستنتاج العاملون المعنى من محتوى اللغة الطبيعية.**semantic drift**: اثنين من الوكلاء يستخدمون نفس الكلمة (`"customer"`) بالنسبة للمفاهيم المختلفة بشكل ظريف، يعمل وكيل المستلم على تفسير خاطئ، لا يكتشف أي مؤكد للخطط.

التخفيف دون الذهاب إلى علم كامل:

- مخطط JSON على `content`يرفض الأخطاء الهيكلية في السلك.
- النوعية الأثرية (A2A)  ترفض الوسيلة الخطأ.
- الإجراءات المفصلة في الغلاف تُجعل النية غير واضحة حتى عندما يكون المحتوى لغة طبيعية.

### المواصفات 2026، المخطوطة إلى التراث الكلام-عمل

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

قراءة الجدول من أعلى إلى أسفل، النمط هو: الحفاظ على البدائية الهيكلية، إسقاط الرسمية، دع الجامعات الورقية على الغامضة.

```figure
sw-contract-net
```

## بناءها

`code/main.py`يطبق مترجم FIPA-ACL من مجرد stdlib. يرمز ويقوم بتشخيص غلاف ACL القنوني ويعرض كيفية تقليص كل شكل من رسائل MCP / A2A إلى نفس السبع حقل.

- يرمز خمسة رسائل في طراز MCP و A2A على أنها FIPA-ACL.
- يُفكّر FIPA-ACL إلى ما يعادله الحديث.
- يدير عقد لعبة التفاوض بين مدير واحد وثلاثة متقدمين باستخدام `cfp`،`propose`،`accept-proposal`،`reject-proposal`. . .

أركض

```
python3 code/main.py
npx tsx code/main.ts
```

إن الخروج هو آثار جانبية تظهر كل رسالة حديثة في شكل 2026 JSON وشكل FIPA-ACL ، ثم رحلة ذهابًا وإيابًا من عرض شبكة العقد. نفس البروتوكول البدائية تبقى على قيد الحياة في رحلة ذهابًا وإيابًا؛ إلا أن النص مختلف.

## استخدمها

`outputs/skill-fipa-mapper.md`هي مهارة تقرأ أي مواصفات بروتوكول وكيل وتنتج خرائط FIPA-ACL. استخدمها قبل اعتماد بروتوكول جديد للإجابة: "هل هذا جديد حقاً، أم هو`inform`مع نحو JSON؟"

## أرسله

لا تعيدوا (فيبا) إلى (إيكل) ، أعيدوا قائمة التحقق

- ما هو النية البدائية (الفعالية) لكل رسالة؟
- هل هناك هوية للتواصل بين طلبات الإجابة والإلغاء؟
- هل هناك لغة محتوى صريحة (JSON-RPC، نص بسيط، أدوات مصممة بنية) ؟
- هل بروتوكولات التفاعل من الدرجة الأولى، أم أنك إعادة تنفيذ العقد الشبكة من الصفر؟
- ماذا يحدث عندما يختلف اثنان من العاملين حول معنى المحتوى (الاندفاع النطاقي) ؟

وثّق هذه الأسئلة الخمسة لأي بروتوكول جديد قبل أن تُرسل إلى الإنتاج.

## التمارين

1. أركض`code/main.py`. لاحظ تشفير الرحلة ذهابًا وإيابًا . حدد أي أداء فيبا يتوافق مع `tools/call`،`resources/read`، وخلق مهام A2A
2. تمديد عرض العقد الشبكة مع `cancel`أداء يسمح للمدير بسحب المهمة في منتصف المزاد.`cancel`لا تحل هذه المحاولات بمفردك؟
3. اقرأ هيكل رسالة ACL FIPA (http://www.fipa.org/specs/fipa00037/) القسم 4.14.3 اختيار واحد من أداءات لا يشملها هذا الدروس ووصف مقارنة JSON-RPC الحديثة.
4. اقرأ ليو وزملاءه، arXiv:2505.02279. لجميع MCP، A2A، ACP، ANP، قائمة العائلات الفاعلة FIPA التي يحتفظون بها ويتركونها.
5. تصميم خطة JSON-Schema الحد الأدنى ل `content`حقل من`request`ما الذي يعطيك هذا النظام الذي لا يعطيك اللغة الطبيعية النقية، وما الذي يكلفه؟

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions. The theoretical parent of ACL. |
| FIPA | "That old XML thing" | Foundation for Intelligent Physical Agents. Standardized ACL in 2000; became an IEEE Computer Society standards committee in 2005. |
| ACL | "Agent Communication Language" | FIPA's envelope format: performative + content + metadata. |
| Performative | "The verb" | The intent class of a message: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993). Simpler, narrower. |
| Ontology | "Shared vocabulary" | A formal definition of the concepts the content language talks about. |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1 — the formal content language family. |
| Contract Net | "Task market" | Manager issues cfp; bidders propose; manager accepts. The canonical interaction protocol. |
| Interaction protocol | "Pattern of messages" | A sequence of performatives with known correctness: request-when, subscribe-notify, etc. |

## المزيد من القراءة

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) المسح القنوني لعام 2025 الذي يربط المواصفات الحديثة بالتراث في إفبا
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) صيغة غلاف عام 2000 المصدقة
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) الكتالوج الكامل للأداء
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) مستوى استخدام الأدوات الحالي دون ولاية`request`-أجل`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/) المكافئ الحديث للوكيل-متساوية للعميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل-العميل
