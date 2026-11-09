# توسيع مهام المفوضية: العمل المستدام على أساس بلا جنسية

> لا يعني MCP بدون جنسية أن كل عملية يجب أن تنتهي في طلب واحد. تمديد المهام الرسمية يعطي العمل الطويل المشي مسدسة دائمة صريحة. يمكن للخادم إعادة هذا المسدس من `tools/call`، أي حالة يمكن أن تجيب`tasks/get`ومدخل العميل يصل من خلال`tasks/update`بدون إحياء جلسات البروتوكول

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## أهداف التعلم

- تمييز النقل البروتوكول بدون ولاية عن حالة مهمة التطبيق الدائمة.
- التفاوض`io.modelcontextprotocol/tasks`توسيع قدرات الطلب و`server/discover`. . .
- أعد إرسال محرك الخادم`CreateTaskResult`مع`resultType: "task"`إلا بعد خلق دائم
- استطلاع مع`tasks/get`، اجتياز مدخل المهمة مع `tasks/update`، وطلب إلغاء التعاون مع `tasks/cancel`. . .
- إزالة الأكبر سنا `tasks/status`،`tasks/result`و`tasks/list`الافتراضات
- الاشتراك في إشعارات المهام الاختيارية عبر `subscriptions/listen`على سلسلة SSE الإجابة POST.
- انتهاء صلاحية المهام النموذجية، وإعادة تشغيل الاسترداد، وتقليل النسخة في مفتاح المدخل، وأخطاء التنفيذ بشكل صحيح.

## لماذا المهام هي امتداد

ظهرت المهام لأول مرة كجزء تجريبي أساسي في 2025-11-25.`io.modelcontextprotocol/tasks`التوسع حتى يتمكن العملاء والسيرفر من اختيار دورة حياة إضافية دون توسيع بروتوكول الأساس للجميع.

تبقى مواصفات التوسع مسودة سطحية على الرغم من أنها هي الموقع الرسمي الحالي للمهام. قم بتثبيت إصدار التوسع المدعوم من SDK الخاص بك، وتشغيل سيناريوهات التوافق، وعزل مكيّفات الأسلاك من مستخدمك ومجال التخزين.

استخدم المهمة عندما يكون للعملية واحدة أو أكثر من هذه الخصائص:

- قد تفوق وقت الطلب العادي
- نظام عمل عمل خارجي يمتلك بالفعل تنفيذ.
- العميل بحاجة إلى التعافي بعد إعادة تشغيله
- يتم وقف العملية لإدخال المستخدم أو النموذج أثناء التنفيذ.
- الإلغاء والحصول على النتائج الدائمة هي متطلبات المنتج.

لا تخلق مهمة للبحث التحديدي الرخيص. التدخل، الاستمرار، الاستطلاع، انتهاء الصلاحية، والإلغاء تعقيدا حقيقيا.

## أساسية بدون جنسية، تطبيق دولي

إزالة MCP 2026-07-28 `initialize`،`notifications/initialized`، جلسات البروتوكول، و`Mcp-Session-Id`هذا لا يحظر المنتجات الحكومية

تُعد هوية المهمة حالة تطبيق صريحة:

- الخادم يصرّ عليه قبل إعادتها
- العميل يمكنه تخزينها وتجربة مرة أخرى بعد إعادة تشغيلها
- يمكن أن يُوجّه الهوية إلى أي نسخة مدعومة من نفس المتجر الدائم.
- يتم التحقق من الائتمان على كل طريقة المهمة.
- يتم تعريف انتهاء الصلاحية والحذف من خلال حقل المهام، وليس مدة حياة النقل.

هذا مختلف عن الحالة الخفية المرتبطة بالاتصال.

أبقوا أربع حياة منفصلة

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

نقل سجل المهام إلى ذاكرة العملية لا يجعل MCP حالة. يجعل التطبيق غير موثوق به. البروتوكول يبقى بلا حالة، ولكن في وقت لاحق `tasks/get`لا يمكن استرداد السجل. استمر قبل إعادة المقبض، ثم جعل كل طريقة المهمة لحل نفس السجل المشترك تحت الفائز والفحص الرئيسي.

## التفاوض حول القدرة

يعلن العميل عن الدعم على كل طلب مؤهل:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

الخادم يعود بالضبط`supportedVersions`، القدرات ،`ttlMs`و`cacheScope`من`server/discover`حيث أنها تعلن عن الأدوات، فإنها تنفيذ أيضا إلزامية`tools/list`هذا النتيجة تعود إلى تحديد`generate_report`وصف، كائن صالح `inputSchema`،`resultType: "complete"`، بيانات الهوية الخادم، وتلميحات التخزين العام.

طريقة مهمة من عميل لم يعلن عن إرجاع التوسع `-32021`, عدم وجود القدرة المطلوبة للعميل ، مع`data.requiredCapabilities`المحددة إلى`{"extensions":{"io.modelcontextprotocol/tasks":{}}}`. تُعيد سلسلة بروتوكول غير مدعومة`-32022`مع دقة`supported`و`requested`البيانات ؛ إعادة نسخة مفقودة أو غير سلسلة `-32602`. . .

غلاف بدون JSON-RPC `id`هو إشعار. قد يعالج المستلمها ، لكنه لا ينبعث عن نتيجة JSON-RPC أو خطأ. يعود مكيّف HTTP قابل للتدفق `202 Accepted`بدون هيئة للإخطار المقبول.

في الوقت الحالي فقط`tools/call`يدعم تنفيذ مهام معززة. تصميم التجريد الداخلي الخاص بك بحيث أن أنواع الطلبات المستقبلية لا تتطلب إعادة كتابة التخزين.

## إنشاء المهام الموجهة إلى الخادم

العلم القديم للعميل`params._meta.task.required`يُعلن العميل دعم التوسع، ثم يقرر الخادم ما إذا كان هناك`tools/call`يصبح مهمة

الطلب:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

رد:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

يجب أن لا يعيد الخادم هذه المقبضة حتى`tasks/get`في متجر متسق في نهاية المطاف، انتظر رؤية القراءة قبل الإجابة. خلاف ذلك يمكن للعميل الحصول على هوية صالحة تبدو و تحصل على "لا يمكن العثور على" على الفور.

لا يتم طلب استجابة للمهمة بمعنى أن العميل لا يطلب وضع المهمة. لا يتم التفاوض عليه: لا يزال على الطلب الحالي إعلان التوسع.

## شكل المهمة

كل مهمة تحمل:

- `taskId`: معرف مستقر منخفض الخادم
- `status`: `working`،`input_required`،`completed`،`cancelled`أو`failed`(إنه)
- `createdAt`و`lastUpdatedAt`: طوابع زمنية ISO 8601
- `ttlMs`: مدة انتهاء الصلاحية من الابتكار، أو `null`بدون حد إعلاني
- اختيارية`pollIntervalMs`: الحد الأدنى المفترض للحصول على الانتخابات من الخادم
- اختيارية`statusMessage`: سياق يستهدف المستخدم أو النموذج.

تظهر الحقول الخاصة بالحالة فقط عندما تكون ذات صلة:

- `input_required`يشمل `inputRequests`. . .
- `completed`يتضمن طلب الأصلي `result`الشكل
- `failed`يتضمن JSON-RPC `error`-أجسام

يجب على العميل أن يحترم`pollIntervalMs`قد يحدد الخادم المعدلات التي تستهدف استطلاعات أكثر عدوانية ويمكن أن يغير الفاصل على مدى عمر المهمة.

## استطلاع مع`tasks/get`

العميل يطلب صورة حالية:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get`نفسها قد اكتملت، لذلك نتيجة لها دائما`resultType: "complete"`المهمة المُعقدة لا تزال قد تكون`status: "working"`أو`status: "input_required"`. . .

هذا التمييز يمنع حدوث خطأ عام في المصفح:

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

لا يوجد`tasks/result`عندما تنتهي المهمة، القادم`tasks/get`رد يطابق الأصلي `CallToolResult`تحت`result`:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

الخارجي`resultType`يقول`tasks/get`تم إكمال عملية التجربة`result.resultType`يقول أن الاتصال الأصلي للدوائر قد تم، ويتطلب ذلك التمييز المتعثر.`CallToolResult`يجب أن تحمل أيضاً`io.modelcontextprotocol/serverInfo`هذا الدروس يتضمنها بدلا من تخزين حمولة مفيدة غير محددة.

لا يوجد`tasks/list`. لا يمكن لخادمات غير الجلسة استنتاج الآمن عن المهام التي تنتمي إلى قائمة محددة عن الاتصال. يجب على التطبيقات التي تحتاج إلى تاريخ الكشف عن أداة نطاق مصرح بها مع مرشحات صريحة وقواعد الملكية.

## إدخال أثناء تنفيذ المهمة

إن إدخال المهمة و MRTR الأساسية تبدو متشابهة ولكنها تستخدم مواصلات مختلفة.

### الإدخال المطلوب قبل إنشاء المهمة

النواة العائدة`resultType: "input_required"`من الأصلي`tools/call`العميل يقوم بذلك ويحاول مرة أخرى الاتصال الأصلي فقط إخلال المهمة بعد انتهاء تلك الجولات المزامنة

### الإدخال المطلوب بعد إنشاء المهمة

حدد المهمة`input_required`. .`tasks/get`يُكشف عن المميزات`inputRequests`و يقوم العميل بإرسال الردود من خلال`tasks/update`العميل لا يحاول إعادة التطبيق الأصلي`tools/call`. . .

صورة سريعة:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

تحديث:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

رد النجاح هو اعتراف فارغ بالإضافة`resultType: "complete"`قد يكون التغيير في الدولة متسقًا في النهاية، لذا يواصل العميل إجراء الاستطلاع أو الاستماع.

كل واحد`inputRequests`يجب أن تكون مفتاحها فريدة طوال عمر المهمة.`tasks/get`قد تظهر اللقطات الفورية نفس المفتاح المتبقي؛ العملاء يقللون من واجهة المستخدم ويتجاهلون الخوادم الاستجابات لمفاتيح غير معروفة أو استبدلت أو تمت بالفعل.`input_required`حتى يتم الإجابة على جميع المفاتيح المطلوبة

## الإلغاء هو تعاون

`tasks/cancel`إشارات النية وتعطي إقرارًا فارغًا كاملًا. هذا الإقرار لا يضمن توقف العامل. قد ينتهي العمل أولاً، أو يتجاهل الإلغاء أو الانتقال في وقت لاحق.

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

لكل أساليب المهمة الثلاثة`Mcp-Name`المرآة`params.taskId`. لا تكرر اسم طريقة JSON-RPC. `code/main.py`يمركز هذا القاعدة في `make_http_request`. . .

يقوم العامل في الدروس بتشرف الإلغاء على الفور، ويعمل على المكالمات المتكررة غير قابلة. لا يزال على عميل الإنتاج أن يعامل الإلغاء كمتعاون بدلاً من استنتاج حالة المهمة النهائية من التأكيد.

لا تستخدم`notifications/cancelled`لتحل مهمة، هذا الإخطار ينتمي إلى طلب إلغاء، وليس مهمات دائمة.

الاختلاف مهم في حدود التوجيه. استبعد الطلب يستهدف عملية JSON-RPC واحدة في الطيران أو استجابة HTTP المحددة لطلبها. إذا `tools/call`لقد عاد بالفعل`resultType: "task"`، أن الطلب كامل وإغلاق النقل لا يمكن أن يذكر أو توقف العمل الدائم. `tasks/cancel`هو مركز جديد مصرح به.`params.taskId`، مرآة تلك الهوية في`Mcp-Name`، يحل الخلفية المملكة للمهمة، ويُسجل نية إلغاء التعاون، ويُعيد تأكيدًا دون أن يدعي العامل أنه توقف.

وبالتالي يجب على البوابة أن تحتفظ بمنسقات الطلبات وطرق المهام في جداول مختلفة. يمكن أن تختفي جدول الطلبات عند انتهاء الاستجابة. يجب أن تبقى مسار المهام حتى تنتهي الحالة النهائية والاحتفاظ بها. [Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md)يُبني السباق، وقتاً وقفياً، وفرصاً، و ضغوطاً، و إعادة محاولة القواعد لكلا الطرق.

## الإخطارات الاختيارية

الاستطلاع هو الخط الأساسي العميل الذي يريد تحديثات دفع يرسلها`subscriptions/listen`مع أرقام المهام. بالنسبة إلى HTTP المباشر ، هذه هي POST التي تكون استجابةها تدفق SSE المطلوب. لا يوجد تدفق حدث GET مستقل ولا جلسة بروتوكول للحفاظ على الحياة.

الجهاز يقر بأسم الشخصية المقبولة مع `notifications/subscriptions/acknowledged`ويمكن بعد ذلك إرسال اللقطات الفورية الكاملة من خلال `notifications/tasks`. الإقرار وكل إشعار مهمة يحمل`io.modelcontextprotocol/subscriptionId`في`_meta`, يساوي `subscriptions/listen`كل إشعار مهمة يعادل ما هو عليه`tasks/get`سيعود في تلك اللحظة

يجب على العملاء أن يعلنوا على طول المهام. يجب أن يعيدوا الاتصال واستئناف من أوراق تعريف المهام الدائمة بدلاً من الاعتماد على إعادة عرض الأحداث أو `Last-Event-ID`. . .

## النقص في النطقية

استخدم طبقتين الخطأ بشكل صحيح.

### خطأ بروتوكول

عدة معايير غير صالحة للطريقة أو اسم مهم مجهول يعيد خطأ JSON-RPC، عادة `-32602`. غياب بيانات دعم التمديد`-32021`مع جسم القدرة المطلوب.

### نتائج تنفيذ المهمة

- نتيجة أداة طبيعية مع`isError: true`ما زال`completed`المهمة لأن دعوة الأداة قدمت نتيجة محددة.
- خطأ JSON-RPC أثناء التنفيذ المؤجل يجعل المهمة `failed`وتخزن خطأ JSON-RPC تحت `error`. . .
- الرفض المستخدم يمكن أن يؤدي إلى`cancelled`نتيجة رفض كاملة أو نتيجة آمنة أخرى محددة للمجال.

## استمرارية، انتهاء صلاحية، وملكية

استمر على الأقل في تحديد اسم المهمة ، والحالة ، والخوابات الزمنية ، ttl ، فترة الاستطلاع ، والمتلكية الأصلية للعملية ، والنتيجة أو الخطأ ، والطلبات المتبقية للمدخول ، وجميع مفاتيح المدخل الصادرة.

يجب أن يحتوي مفتاح التخزين على مستأجر ومدير مصرح أو يحل ذلك. لا يجب أن يمنح معرفة هوية المهمة الوصول. تحقق من ملكية كل `tasks/get`،`tasks/update`،`tasks/cancel`، والإشتراك

`ttlMs`يمكن للمستخدمين أن يستخدموا هذه المعلومات في التطبيقات، ويمكن أن يستخدمها في التطبيقات، ويمكن أن يتم قياسها من وقت إنشاءها ويمكن أن يتغير. يمكن للمستخدمين التعامل معها كمساعدة خلفية عندما توقفت المهمة عن إنتاج تحديثات قابلة للملاحظة. قد يفشل الخادم ويمحو في وقت لاحق مهمة انتهت صلاحيتها. لا تصفها كوعد بالاحتفاظ بالنتيجة المكتملة لعدة ملثانية بعد الانتهاء.

استخدام الكتب الذرية أو المعاملات. الدرس يكتب ملفًا مؤقتًا ويُعيد تسميته بشكل ذري. يجب أن تستخدم خدمة متعددة النسخة متجرًا دائمًا مشتركًا وترخيص عامل أو تحكم متزامن معادلة.

```figure
tp-task-lifecycle
```

## بناءها

`code/main.py`تنفيذ خدمة مهمة تحديدية:

- `server/discover`العائدات`supportedVersions`، إشارات التخزين، ومدّة المهام
- `tools/list`يعود تحديد، قابلة للتخفيض `generate_report`وصف مع مخطط إدخال صالح.
- `tools/call`يخلق و يواصل المهمة قبل العودة`resultType: "task"`. . .
- مثال خدمة جديد يُعيد تحميل نفس المهمة، يُظهر إعادة تشغيل التعافي.
- `tasks/get`يعيد صور اللقطات الكاملة للمهمة.
- العامل ينتقل من`working`إلى`input_required`. . .
- `tasks/update`يقبل استجابة من النموذج ويرد إقرارًا كاملًا فارغًا.
- العامل يحتفظ بمثابة عُش`CallToolResult`مع أفرادها`resultType`و هويت الخادم ، ثم الانتقال إلى `completed`. . .
- `tasks/cancel`لا يُمكن أن يكون ذلك ممكناً في هذا التنفيذ.
- أجهزة بناء HTTP`Mcp-Name`إلى`params.taskId`لـ`tasks/get`،`tasks/update`و`tasks/cancel`. . .
- المساعدون في الإخطار يستخدمون `notifications/subscriptions/acknowledged`و`notifications/tasks`، كلاهما مع علامة اسم طلب الاستماع.
- الإخطارات بدون ID لا تنتج استجابة JSON-RPC.

يعمل العامل بشكل صريح بدلاً من النوم في خيط خلفي، مما يجعل كل انتقال حالة محدداً ويحافظ على مثال البروتوكول منفصل عن ميكانيكا الصف.

## استخدمها

من جذور المخبأ:

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

تسلسل النتائج المتوقع:

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

أيضاً تأكد من ذلك`tasks/status`،`tasks/result`و`tasks/list`طريقة العودة لا توجد في الخدمة الحديثة.
تأكد من ذلك`tools/list`هو تحديدية وكل طريقة مهمة HTTP الحالية تعكس اسم المهمة من خلال `Mcp-Name`. . .

## أرسله

`outputs/skill-task-store-designer.md`الآن تنتج تصميمًا واعًا للتوسع: تفاوض القدرات، إنشاء استمرار قبل العودة، والطرق الحالية، وتدفق تحديث المدخلات، والمالك، والانتهاء من الصلاحية، والإلغاء، والإشتراك، والهجرة من الطرق التجريبية المزودة.

## التمارين

1. إضافة مفتاح إدخال ثانياً لا يزال قائماً. أرسل مفتاح جزئي `tasks/update`و إثبات أن المهمة لا تزال قائمة`input_required`حتى يتم الإجابة على كلتا المفاتيح
2. إضافة ملكية المستأجر إلى المتجر ورفض هوية مهمة صالحة قدمتها رئيس المصادقة الخطأ.
3. إضافة عقد تأجير العمال مع انتهاء صلاحيتها. إثبات أن حالات الخدمة لا يمكن أن تقوم بنفس المهمة في وقت واحد.
4. تنفيذ مُعدل SSE للرد على POST`subscriptions/listen`لا تضيف GET`Last-Event-ID`أو عنوان جلسة
5. إضافة تنظيف انتهاء الصلاحية. تمييز مهمة انتهت الصلاحية من هوية مهمة خاطئة دون تسريب وجود المتبادل المستأجر.

## الشروط الرئيسية

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## التوافق مع التراث

السطح التجريبي 2025-11-25 استخدم زيادة المهام التي طلبها العميل`tasks/status`،`tasks/result`، و اختياري `tasks/list`. إبقوا هذه الأسماء فقط داخل مُعدّل إرث مُثبت . العميل الحالي يستخدم إمكانية التوسع ، يقبل المُسَلّطات المُوجّهة إلى الخادم ، استطلاعات`tasks/get`، يقدم المدخلات مع `tasks/update`، ويقرأ النتيجة النهائية من صورة المهام.

## المزيد من القراءة

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
