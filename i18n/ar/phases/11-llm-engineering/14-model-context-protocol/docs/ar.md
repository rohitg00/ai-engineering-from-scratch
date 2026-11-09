# نموذج بروتوكول السياق (MCP)

> يمنح MCP مضيفًا لذكاء الاصطناعي بروتوكولًا واحدًا لاكتشاف واستدعاء الأدوات والموارد والإشارات. يجعل مراجعة 2026-07-28 هذا البروتوكول بلا بيانات: تتحرك القدرة والسياق الإصداري مع كل طلب ، وليس في ضغط يد متصل بالاتصال.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## أهداف التعلم

- تمييز مضيف MCP، العميل، الخادم، النقل، والخادم البدائي.
- قم ببناء طلب JSON-RPC مع البيانات المعدنية المطلوبة من MCP 2026-07-28.
- استخدام`server/discover`للتفتيش على الإصدارات والهوية والقدرات.
- أعيد النتائج المكتوبة والمتخزنة من الأدوات والموارد والطلبات.
- شرح كيفية تفاعل MCP العصري غير الحكومي مع خوادم عصر اليد.
- اختر الحالة الآمنة، النقل، والحدود الموافقة للخادم.

## المشكلة

تطبيقك يحتاج إلى استفسار قاعدة البيانات، وعمل التقويم، وقارئ الملفات. بدون بروتوكول مشترك، يحتاج كل مضيف الذكاء الاصطناعي إلى اكتشاف مخصص، الدعوة، الأخطاء، النقل، والصبغ التفويض لتلك القدرات نفسها.

يقلل MCP هذه المصفوفة التكاملية. يقوم الخادم بنشر سطح JSON-RPC القياسي. يمكن للعميل المتوافق اكتشاف سطحها وتقديمها إلى نموذج أو مستخدم، واستدعائها وتفسير النتيجة دون جهاز تعديل خاص للخادم.

الحدود المهمة سهلة الفشل. MCP تقييم الاتصالات. فإنه لا يقرر ما هي الأداة التي يجب أن يطلبها النموذج، أو جعل المحتوى غير الموثوق به آمنا، أو تحويل طلب بلا ولاية إلى حالة تطبيق دائمة. مضيفك والخادم لا يزال يمتلك تلك القرارات.

## المفهوم

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### ثلاث خادمات بدائية

1. **Tools**كل أداة لديها اسم وصف وإدخال مخطط JSON ومعامل.
2. **Resources**يتم تسمية المحتوى، وترتيبات URI التي يمكن للعميل قراءتها.
3. **Prompts**هي نماذج قابلة لإعادة الاستخدام يمكن للمضيف تعريضها للمستخدم.

المضيف هو تطبيق الذكاء الاصطناعي. عميل MCP داخل هذا المضيف يتحدث إلى خادم واحد. النقل يحمل رسائل JSON-RPC بينهم.

### طلبات العدالة عن الجنسية تحل محل ضغط اليد

إزالة MCP 2026-07-28 `initialize`و`notifications/initialized`. كما أنه يزيل جلسات على مستوى البروتوكول. كل طلب يحمل السياق اللازم لتفسيره في`params._meta`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

نسخة البروتوكول و قدرات العميل مطلوبة. هويت العميل يوصى بها.`_meta`، يتم تشكيل حقل مطلوب مفقود أو حقل مطلوب مع النوع الخطأ بشكل خاطئ ويرد Params غير صالح (`-32602`) تعود سلسلة نسخة شكلت بشكل جيد لا يدعمها الخادم `UnsupportedProtocolVersionError`(`-32022`يمكن للخادم معالجة طلب صالح دون استعادة سجلات تفاوض سابقة.

لا يعني أن الطلب لا يمكن أن يحافظ على حالة.`Mcp-Session-Id`إذا كانت عملية العمل تحتاج إلى استمرارية، يقوم الخادم بتصميم مسدس غير شفاف، ويمر العميل هذا المسدس كحجة أداة عادية في المكالمات اللاحقة. لا يزال يجب التحقق من الائتمان في كل طلب.

### إكتشاف واختيار الإصدار

كل خادم حديث ينفذ`server/discover`النتيجة تعلن عن الإصدارات المدعومة والإمكانيات و هوية الخادم:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

قد يدعو العميل طريقة أخرى مباشرة وتتعامل مع خطأ النسخة ، ولكن اكتشاف يجعل عرض القدرة واختيار النسخة صريحًا. يعود نسخة غير مدعومة `UnsupportedProtocolVersionError`مع رمز`-32022`. بياناته تحتوي على`supported`، مجموعة من مراجعات الخادم ، و `requested`، والإصلاح الذي رفضته.

في الاستديو، عميل من العصر المزدوج يبحث مع`server/discover`نتيجة اكتشاف أو خطأ معترف به في الوقت الحاضر مثل`UnsupportedProtocolVersionError`يحدد خادم حديث. أي خطأ أو توقيت وقت غير معترف به كحديث يسمح بالعودة إلى 2025-11-25`initialize`السلوك المتخلف هو رمز التوافق، وليس الافتراضي الحديث.

### النتائج واضحة

كل نتيجة جوهرية 2026-07-28 لديها`resultType`:

- `complete`يعني أن العملية قد انتهت
- `input_required`يعني أن الخادم يحتاج إلى رحلة ذهاب وإياب أخرى من خلال نمط طلبات رحلة ذهاب وراء متعددة. الخوادم الأساسية قد تعيد ذلك فقط من `tools/call`،`resources/read`أو`prompts/get`. . .

يجب على العملاء التعامل مع نتيجة سابقة تُفشل`resultType`ككل

يجب أن تشمل الخوادم`io.modelcontextprotocol/serverInfo`في كل نتيجة`_meta`هذه الهوية هي ذاتية الإبلاغ وتستخدم لعرض وتسجيل السجلات والتحريفات، وليس لاتخاذ قرارات أمنية.

قائمة ونتائج القراءة تحمل أيضا `ttlMs`و`cacheScope`- تحديدية`tools/list`النظام بالإضافة إلى إشارة الطازجة يسمح للعملاء بحفظ الاكتشاف بأمان ويحسن استقرار الاكتشاف السريع. `cacheScope: public`تسمح بتخزين الاحتياطي المشترك`private`يقتصر إعادة الاستخدام على السياق المطلوب.

### شكل الأسلاك والنقل

يستخدم MCP JSON-RPC 2.0 عبر stdio أو Streamable HTTP.

- طلب لديه`jsonrpc`،`id`،`method`و`params`. . .
- الرد يطابق`id`و إما`result`أو`error`. . .
- الإخطار لا يحتوي على`id`ولا يتوقع أي رد

يكتشف HTTP المباشر الحديث نقطة نهاية واحدة تقبل POST. كل رسالة JSON-RPC تحصل على POST خاصة بها. تتلقى POST الطلب إما كائن JSON واحد أو سلسلة من أحداث Server-Sent التي تنتهي الطلب الذي ينتهي بالرد النهائي. تتلقى POST الإخطار المقبول HTTP 202 بدون جسم استجابة. هذا الإصلاح الأساسي لا يحدد أي إخطارات العميل إلى الخادم على HTTP المباشر.

لا يوجد سلسلة MCP GET مستقلة ، نقطة نهاية جلسة DELETE ، `Mcp-Session-Id`أو`Last-Event-ID`إعادة تشغيل في 2026-07-28. إشعارات التغييرات طويلة الأمد تستخدم`subscriptions/listen`تحرير يظل استجابة مفتوحة كمتد.

### إدخال العميل دون طلبات من الخادم

الإصدارات القديمة تسمح للخادم بإرسال طلبات مثل `sampling/createMessage`،`roots/list`أو`elicitation/create`على سلسلة. البروتوكول الحالي يستخدم طلبات رحلة متعددة بدلاً من ذلك. دعوة أداة مؤهلة ، قراءة الموارد ، أو طلب الحصول على العائدات`resultType: input_required`مع واحدة على الأقل من `inputRequests`أو`requestState`. يقوم العميل بجمع أي مدخل مطلوب ، ويعيد تجربة الطريقة الأصلية مع معرف JSON-RPC الجديد والمرجع المقابلة `inputResponses`، ويعكس بالضبط`requestState`عندما تم توفير واحد.`inputRequests`كان هناك، المحاولة الإعادة تُغيب `inputResponses`. . .

لا تزال الجذور، ومعينة، وتسجيل السجل وظيفية ولكنها قد تبدأ في التنفيذ، لذلك لا ينبغي على التنفيذات الجديدة تبنيها.`inputRequests`، أبداً كطلبات JSON-RPC مستقلة من خادم إلى عميل. تفضل معايير الملف أو السجلات الصريحة ، و URIs الموارد ، وتكوين الخادم ، وتكامل الموديل المزود مباشرة. استخدم stderr للتشخيص الاستوديوي و OpenTelemetry للتلفزيون الإنتاج.

```figure
mcp-nxm-collapse
```

## بناءها

### الخطوة الأولى: تسجيل سطح الخادم

لا يزال التسجيل بسيطًا على الرغم من تغيير عقد الطلب:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

التنفيذ الذي تم شحنه في `code/main.py`يُسجل أيضاً الموارد والمساعدة. يستخدم عمداً المكتبة القياسية حتى تتمكن من رؤية كل غلاف بدلاً من تفويض البروتوكول إلى SDK.

### الخطوة الثانية: ضمنت البيانات المعدنية لكل طلب

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

لا تخزين هذه البيانات المعدنية فقط في كائن اتصال. يقوم الخادم بتؤكيدها على كل طلب.

### الخطوة الثالثة: اخترتاً اكتشاف قبل الإدراج

اتصل`server/discover`، اختر نسخة مدعومة ، ثم اتصل `tools/list`- مباشرة`tools/list`صحيح أيضا إذا كنت تعرف النسخة بالفعل وتستطيع التعامل معها`-32022`. . .

يعيد المشاهد قائمة الأدوات حسب الاسم ويربطها `ttlMs`،`cacheScope`،`resultType`، و هوية الخادم. استدعاء أداة يعود نتيجة كاملة غير قابلة للتخزين لأن إصدارها يمكن أن يعتمد على الحالة الحالية.

### الخطوة 4: رسم نفس الطلب إلى HTTP

جهاز التحكم عن بعد`tools/call`POST يتضمن عناوين تعكس جسم JSON-RPC:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

- نعم`MCP-Protocol-Version`يجب أن يطابق العنوان الإصدار في `_meta`. .`Mcp-Method`مطلوب في كل طلب JSON-RPC ويجب أن يطابق `method`. .`Mcp-Name`مطلوب فقط ل`tools/call`،`resources/read`و`prompts/get`، حيث يجب أن يطابق اسم الأداة أو URI الموارد أو اسم العرض. يفتقد رأس مطلوب أو عدم التطابق يعيد HTTP 400 مع `HeaderMismatch`الرمز`-32020`. . .

### الخطوة 5: فرض الأمان خارج حالة البروتوكول

- تأكيد الموافقة والجمهور على كل طلب HTTP.
- ربط الخوادم المحلية بأضيف محلي وتؤكد`Origin`على HTTP المباشر
- قم بتشخيص أدوات الطفرة مع `destructiveHint: true`ويتطلب موافقة المضيف
- إضافة المجلد ومدى الملف صراحة بدلاً من الاعتماد على الجذور القديمة.
- تعامل الموارد والمواد المنتجة كأشياء غير موثوق بها.
- حافظ على المعلومات المخصصة لـ JSON-RPC تحت stdio؛ كتابة التشخيصات إلى stderr.

## استخدمها

إشغلي الدروس من دليلها:

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

السطر الأول يجب أن يبلغ عن اكتشاف`demo-server`في البروتوكول`2026-07-28`ثم تحقق`MCPClient.request`: إنه يعيد بناءه`_meta`إزالة البيانات المعدنية من طلب واحد ولاحظ الخادم رفضه.

## أرسله

`outputs/skill-mcp-server-designer.md`يحول النطاق إلى تصميم MCP غير مصدر للدولة. بوابة قبوله تتطلب نتيجة اكتشاف ، وسياسة البيانات المعدنية لكل طلب ، وقوائم تحديدية واعية بالخزنة ، ومعالجة الحالة الصريحة ، و عناوين النقل ، والإذن ، وقواعد الموافقة.

## استمر في الغوص العميق في MCP

هذه الدروس تعطيك نموذج البروتوكول، المرحلة 13 تحول أربع حدود إنتاج إلى دروس منفصلة لبناء والتحقق:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)تغطي مخططات المدخلات المغلقة والمحتوى المهيكلي ومعلومات التوجيه والصفحات غير الشفافة وافقية الإكمال والفرق بين الأخطاء بين بروتوكول وسلطات الأدوات.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)تغطي إلغاء الطلبات، إلغاء المهام الدائمة، والمدود، والفشل، والضغط المتردد، والبرفير بالوكالة، وسلوك الإعادة الاتصال.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)تغطي دليل مساحة الأسماء، ومصدر الأثاث، ورقبات لا تتغير، والانحراف الحي، وحالة السجل، ودليل القبول، والعودة.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)تغطي النصوص الذهبية والسلبية، وعصور الإصدار الصارم، ومفروق SDK، والأدلة النظامية، والتحرير، وبوابات الصحة، والإصدار الراجع.

اتبعهم في التسلسل عندما يتخطى الخادم حدود الفريق أو الثقة. معاً ينتقلون من الوسيلة تعمل إلى العقد يبقى آمنًا ويمكن تشخيصه من خلال النشر.

## التمارين

1. إضافة`subtract`أداة و تأكيد `tools/list`يبقى مرتبة أحرفية
2. إزالة مفتاح نسخة البروتوكول والتحقق من المعلمات غير صالحة (`-32602`ثم أرسل النسخة المشكولة جيدا ولكن غير المدعومة`2025-11-25`، التحقق`-32022`، تأكيد`requested`يردد هذا الإصلاح، واختيار من بين `supported`. . .
3. إضافة خادم-منت `draftId`لإنشاء عملية، ثم تطلبها كحجة لتحديث. شرح لماذا هذا هو حالة التطبيق بدلا من جلسة بروتوكول.
4. العودة`input_required`من أداة تحتاج إلى تأكيد المستخدم. حاول مرة أخرى الاتصال الأصلي مع هوية جديدة،`inputResponses`الدخول، والتحديد `requestState`بدلاً من اختراع طلب JSON-RPC من خادم إلى عميل.
5. رسم عميل استديو من عصر مزدوج. تعامل نتيجة أو خطأ معترف به الحديثة على أنه حديث، والسماح بالعودة إلى `initialize`فقط عن خطأ غير معروف أو توقيت

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## المزيد من القراءة

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
