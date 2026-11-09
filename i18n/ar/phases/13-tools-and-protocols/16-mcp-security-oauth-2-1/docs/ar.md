# إذن MCP: CIMD، إلتزام المصدر، PKCE، والتحقيق

> طلب MCP عن بعد غير مصدر للدولة، ولكن تفويضها ليس مجهولا. ربط كل إعتمادات إلى المصدر الذي خلقها وكل رمز إلى الموارد التي تتلقىها.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security)
**Time:** ~90 minutes

## أهداف التعلم

- اكتشاف خادمات الائتمان من خلال البيانات المعدنية الموارد المحمية.
- تفضل وثائق بيانات المستخدم على تسجيل العميل الديناميكي القديم.
- أعلن الحق`application_type`عندما يكون مسار التوافق مع DCR لا مفر منه.
- تأكيد رد الإذن `iss`وتعزل الإثباتات حسب المصدر.
- استخدم PKCE، مؤشرات الموارد، تأكيد الجمهور، والطول المتزايد.
- إرسال طلبات المكتب المعتمدة 2026-07-28 بدون جلسات البروتوكول.

## المشكلة

قد يقرأ خادم MCP عن بعد السجلات الخاصة، أو يكتب أنظمة خارجية، أو يؤدي إلى عمل مكلف. يخبر المصادقة من قدم شهادة اعتماد. يجب على الائتمان أيضًا الإجابة:

- أي خادم تصريح أصدر هذه الإصدارات؟
- أي مصدر من MCP هو رمز؟
- أي عميل وإعادة توجيه URI أكملت التدفق؟
- أي عمليات المستخدم قد وافق عليها؟
- هل هذا الطلب الدقيق لا يزال يناسب هذا الموافقة؟

ملف تفويض 2026-07-28 يزيد من صرامة تسجيل العملاء ومعالجة المصدرين. يفضل وثائق بيانات المستخدم، يرفض تسجيل العملاء الديناميكي، يتطلب الحق `application_type`على DCR، تؤكد استجابات المصدر RFC 9207، وتمنع إعادة استخدام المراجع بين المصدرين.

هذه القواعد تكملة الـ "جوهر" غير الحكومي.`Mcp-Session-Id`. . .

## المفهوم

### تعرف على الأدوار الثلاثة

- **MCP client:**يرسل طلبات نيابة عن صاحب الموارد.
- **MCP resource server:**يقبل رمز الوصول و يخدم نقطة نهاية MCP.
- **Authorization server:**يثبت أصحاب الموارد، ويجمع الموافقة، ويصدر رموز.

يمكن تشغيل خادم الموارد وخادم الترخيص معاً، ولكن إبقاء تحديداتهم ومسؤوليات التحقق من التحقق منفصلة.

### التأليف ينطبق على HTTP

تطبق تخصيص تفويضات MCP على النقلات القائمة على HTTP. يعمل خادم استوديوه محلي تحت حدود ثقة العملية والنظام التشغيلي. لا تضيف تدفق OAuth المتنقل مزيف إلى الاستوديوه فقط من أجل التناظر.

لـ Streamable HTTP عن بعد، أرسل رمز المحمل في `Authorization`العنوان على كل طلب. لا تضعه أبدا في عنوان URL.

### ابدأ بمعلومات البيانات المعدنية المستخدمة في الموارد المحمية

يقوم خادم الموارد بنشر RFC 9728 البيانات الوصفية:

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

يبدأ العميل من عنوان URL الموارد MCP ، ويستلم هذا الوثيقة ، ويختار خادم الإذن المعلن ، ثم يستلم بيانات الميتاء OAuth أو OpenID Connect لهذا الخادم.

الحفاظ على مسار الموارد عند بناء RFC 9728 URL معروفة.`https://notes.example.com/mcp`، هذا الدروس يستخدم`https://notes.example.com/.well-known/oauth-protected-resource/mcp`. أترك`/mcp`يمكن للاستحقاق اختيار البيانات المعدنية لمصدر محمي مختلف من نفس المنشأ.

لا تخمين خادم الائتمان من اسم مضيف. لا تتبع مستثمرًا اكتشف من جسم خطأ غير معتمد. احتفظ بسياسة يود العميل الثقة في مستثمرين.

### التحقق من بيانات المستخدم المعتمدة

يجب أن تكشف البيانات الوصفية نقاط النهاية والتحكمات المدعومة:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": true
}
```

احتاج S256 ل PKCE. سجل سلسلة المصدر الدقيقة. هذه القيمة الدقيقة تصبح مفتاح التسجيل وتخزين الرمز.

### اتبع أولوية التسجيل

استخدم معلومات العميل المسجلة مسبقاً عندما يكون لدى العميل علاقة صريحة بالفعل مع المصدر المختار. وإلا تفضل وثائق بيانات بيانات المستخدم عندما يعلن خادم الترخيص عن الدعم. استخدم DCR فقط كإعلان إعاقة التوافق القديمة ، ثم استدعاء معلومات العميل إذا لم تكن أي من هذه الآليات متاحة.

### تفضيل وثائق بيانات المستخدم

يمنح وثيقة بيانات المستخدم المستخدم (Client ID Metadata Document) خادم الإذن عنوان URL HTTPS الذي هو هو هو معرف العميل وموقع بياناتها المستخدمة:

```json
{
  "client_id": "https://client.example.com/oauth/metadata.json",
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

خادم الإذن يحصل على الوثيقة ويمتحقه.`client_id`يجب أن يكون عنوان URL HTTPS مع مسار، والقيمة داخل الوثيقة يجب أن تكون مساوية لهذا عنوان URL بالضبط.`client_id`،`client_name`و`redirect_uris`. .`application_type`يظهر في هذا المثال لكنه ليس متطلب من CIMD. استخدامها الإلزامي الجديد هو على وجه التحديد طريق DCR.

تعامل استلام الوثيقة كعملية حساسة لـ SSRF. حل وتؤكيد الوجهة المقصودة ، ورفض العناوين الخلفية والخاصة والمنطقة المحلية والمنع عن الإرسال ، والتحقق مرة أخرى بعد إعادة التوجيهات وتغييرات DNS ، وتحديد الإعادة التوجيهات والبايتات والوقت ، وتطلب JSON ، ووفقاً فقط لتحكمات التخزين الآلي HTTP الموثقة. تعامل `client_name`و غيرها من حقل العرض كنص غير موثوق به.

يزيل CIMD الحاجة إلى وضع معرف ديناميكي جديد لكل اتصال أول. لا يزيل إعادة توجيه التحقق من المعلومات الرقمية، أو سياسة المصدر، أو موافقة المستخدم.

### DCR هو مسار التوافق

لا يزال تسجيل العميل الديناميكي متاحًا لمستخدمات الإذن القديمة ، لكنه قد انتهى من الصلاحية للتنفيذات الجديدة من MCP.

عند استخدام DCR، أعلن `application_type`:

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- مستخدمي سطح المكتب والهاتف المحمول وخط الأوامر و الخلفية`native`. . .
- استخدام تطبيقات المتصفح المضيفة عن بعد `web`وإعادة توجيهات HTTPS عن بعد.

إغلاق الحقل يمكن أن يكون بطبيعة الحال `web`في تنفيذ تسجيل OpenID Connect وإجراء إعادة توجيه محكمة للخلفية فشل.

حافظ على رمز DCR وراء قرار التراجع الصريح. لا تقع بعد فشل تصحيح CIMD التعسفي. قد يحول هذا فشل الأمن إلى مسار تسجيل أضعف.

### إرشادات الوصف للمصدر

تخزين مواد التسجيل التي يكتبها المصدر تحت عنوان المصدر الدقيق:

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

إذا كان اكتشاف الموارد المحمية يتغير من`https://auth-one.example`إلى`https://auth-two.example`لا ترسل أبداً سر العميل للمصدر الأول، أو هوية العميل DCR، أو رمز الوصول للتسجيل، أو رمز التجديد، أو رمز الوصول للثاني. يجب على عملاء DCR المسجلين مسبقاً واستخدام إثباتات اعتماد صادرة عن المصدر الجديد.

يختلف هوية عميل CIMD لأنه URL HTTPS المضيفة ذاتياً ، وليس بطاقة اعتماد تم تصنيفها من قبل خادم التصريح. نفس URL CIMD محمولة: يقوم مصدر موثوق جديد بتحويل وثيقة وتؤكيدها دون إعادة تسجيل DCR. لا تزال ردود الطلبات والرموز يتم التحقق منها وتخزينها تحت المصدر الجديد.

### رمز الترخيص مع PKCE

التدفق التفاعلي هو:

1. توليد طاقة عالية من الانتروبيا`code_verifier`. . .
2. استنتاج S256 `code_challenge`. . .
3. أرسل طلب التأذن مع الدقة`client_id`،`redirect_uri`،`scope`،`code_challenge`و`resource`. . .
4. تلقي رد على الموافقة يحتوي على `code`و عندما يتم توفيرها`iss`. . .
5. تأكيدي`iss`ضد المصدر المسجل الدقيق قبل استخدام أي حقل استجابة.
6. تبادل الرمز مع `code_verifier`، نفس إعادة توجيه URI ، والشيء نفسه `resource`. . .
7. تخزين الرمز الناتج تحت `(issuer, resource)`. . .

- نعم`resource`يظهر المعلم من RFC 8707 في كل من طلبات التأذن والرمز. يحدد URI خادم MCP القنوية.

### تأكيدي`iss`بالضبط

يمنع RFC 9207 من خلط رد تصريح من مصدر واحد مع رد من مصدر آخر.

متى`iss`إذا كان موجوداً، قم بمقارنةها مع المصدر المسجل دون طيّة الحالة، وتغييرات التقطيعات التالية، وإزالة منفذ افتراضي، أو تطبيع تشفير النسبة المئوية. في حالة عدم التطابق، لا تتصرف على الرمز أو حتى تعرض تفاصيل الخطأ التي يتحكم بها المهاجم من تلك الاستجابة.

خادم تصريح يتضمن `iss`الإعلانات`authorization_response_iss_parameter_supported: true`العملاء الحاليون لا يزالون يصدقون هدية`iss`حتى عندما يفتقد هذا الإعلان

### تأكيد الجمهور في خادم MCP

يقبل خادم الموارد فقط الرموز المصدرة لنفسه:

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

تتلقى الرموز غير صالحة أو انتهت صلاحيتها أو أصدرها بشكل خاطئ أو الجمهور الخطأ 401. لا يجوز لمخادم MCP قبول أو نقل الرموز المخصصة لخدمة أخرى.

### طلب أصغر نطاق للشحن

ابدأ من النطاق المطلوب الآن. إذا كانت أداة لاحقة تتطلب المزيد، يعود الخادم 403 مع تحد النطاق المعتمد:

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

يقوم العميل بتفسير الإذن الجديد، ويحصل على موافقة، ويقوم بتدفق الإذن الجديد مع مجموعة النطاق المشترك، ويعيد تجربة طلب MCP مع معرف JSON-RPC الجديد.

لا نفترض أن النطاق المتحدّث هو مجموعة فرعية من`scopes_supported`التحدي هو المعتمد للعملية الحالية.

### التأذن والسلك المتحكم في المعلومات المتحركة

دعوة أداة مصرح بها لا تزال تحتوي على غلاف الطلبات الكاملة الحالية:

```text
POST /mcp
Authorization: Bearer <access-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.delete
```

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "notes.delete",
    "arguments": {"id": "note-7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "oauth-lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

الوهم يسمح للمدير، البيانات المطلوبة تتفاوض على سلوك البروتوكول، ولا أحد يبدل الآخر.

تأكيد الأسلاك في ترتيب ثابت: JSON-RPC وأنواع البيانات المعدنية، رأس والجسم المساواة، ثم دعم البروتوكول. إضطرابات توجيه أو نسخة رأس يعود HTTP 400 مع `-32020`. إذا كان الرأس والجسم يوافقون على نسخة غير مدعومة، أعيد HTTP 400 مع `-32022`و`data`بالضبط`{"supported":["2026-07-28"],"requested":"<actual>"}`. طريقة غير معروفة تعيد HTTP 404 مع `-32601`. . .

كل خطأ في الطلب، بما في ذلك 401 رمز غير صالح و 403 نطاق غير كاف، هو غلاف خطأ JSON-RPC مع الطلب الأصلي `id`. معلومات الاسترداد المهيكلة تنتمي إلى خطأ اختياري `data`.`WWW-Authenticate`لا يزال عنوان استجابة HTTP. الإخطار لا يحتوي على`id`، لذلك لا تتلقى جسم JSON-RPC. إشعار HTTP المقبول يعود 202 مع جسم فارغ.

الخادم ينفذ `server/discover`وتعلن عن الأدوات، لذلك تنفيذ أيضاً الإجبارية`tools/list`طريقة. وصف الأدوات لها أسماء مستقرة، وصف، وجذر الكائن `inputSchema`القيم القائمة هي تحديدية وتعطي`resultType`، بيانات المستخدم المحدودة`ttlMs`و`cacheScope`. يمكن الحصول على قائمة أدوات اكتشافية ومستقلة عن المستخدم قبل الحصول على الموافقة. تطبق السياسة العادية والاحتفاظ بحفظ الاحتياطي الخاص إذا كان أي منها يختلف حسب الرقم.

### لا يوجد رمز عبر

لا يجوز لخادم MCP إرسال رمز وصول MCP للعميل إلى API أسفل التيار. الحصول على رمز منفصل أسفل التيار مع الجمهور المناسب أو استخدام تصميم صريح لتبادل الرمز. يؤدي تأكيد الجمهور فقط عندما ترفض الخدمات الرمز المختص لشخص آخر.

### رموز التجديد

إعادة إصدار الرموز اختياريًا. عند إصدارها، تخزينها سرية وتقوم بتفريغها حسب المصدر والموارد. لا نفترض وجودها. قم بتدويرها عندما يدعم خادم الإذن الدوران وتكتشف إعادة استخدام القيم غير صالحة.

```figure
t3-scope-stepup
```

## بناءها

`code/main.py`هو بروتوكول في عملية ومحاكاة الترخيص. ينفذ اكتشاف الموارد المحمية، بيانات المستخدم المستخدم الموثوقة، تسجيل CIMD، إعادة التأمين في DCR، فحص نوع التطبيقات، PKCE، تصحيح المصدر، رموز محدودة بالموارد، زيادة نطاق،`server/discover`،`tools/list`، وطلب أداة بلا جنسية

يتلقى النموذج أجسام الطلبات المتحسّسة و رؤوس التوجيه. إنه ليس مُعدّل HTTP كامل ولا يحلل `Content-Type`أو`Accept`. قم بتوصيله إلى مُعدّل HTTP المُباشر للدروس 09، الذي يتطلب `Content-Type: application/json`و`Accept`قيمة تحتوي على كلتا `application/json`و`text/event-stream`. . .

إشغله

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

وتظهر الخروج اكتشاف أولاً، وقبول CIMD، قراءة عادية، واثنين من مرحلتين منفصلة من النطاق، وتخزين المعلومات الموثوقة بمفتاح المصدر.

## استخدمها

خريطة كائنات المحاكاة إلى مكونات الإنتاج:

- `ResourceServer.protected_resource_metadata`يصبح نقطة نهاية RFC 9728
- `AuthorizationServer.metadata`يصبح RFC 8414 أو OpenID Connect اكتشاف.
- `Client.enroll`يصبح قرار CIMD بالإضافة إلى فرع صريح لموافقة DCR.
- إثباتات العميل المُصدرة و`tokens_by_issuer_resource`تصبح سجلات مشفرة. URL CIMD قد تظل قابلًا للنقل بينما تظل نتائج تصريحها مرتبطة بالمصدر.
- `ResourceServer.handle`يصبح البرمجيات المتوسطة التي تؤكد رؤوس MCP الحالية، والرمز، ومدى الأدوات قبل إرسال مع الحفاظ على كل خطأ الطلب في غلاف JSON-RPC المتناسب.

## أرسله

هذه الدروس تُسافر`outputs/skill-oauth-scope-planner.md`. الآن تصمم أولوية التسجيل، وتخزين المراسلات الموثوقة المرتبطة بالمصدر، ونوع الطلبات، PKCE، مؤشرات الموارد، تحديات النطاق، والحدود الحالية لطلبات اللاعبين.

## التمارين

1. إضافة دوران رمز التجديد ورفض إعادة استخدام رمز التجديد السابق.
2. إضافة قائمة تصاريح المصدر. عند تغيير المصدر، إعادة استخدام فقط عنوان URL CIMD المحمول؛ رفض جميع الكتب والرموز المذكورة من قبل المصدر.
3. إضافة انتهاء الصلاحية إلى رموز الترخيصات وتأكيد فشل التبادل المتأخر.
4. قم ببناء خيار عميل الويب مع إعادة توجيه HTTPS عن بعد وقارن بيانات DCR الخاصة به مع العميل الأصلي.
5. إضافة مصدر ثان تحت نفس المصدر. تأكد من لا يمكن استخدام رمز الوصول في المصدر الأول.

## الشروط الرئيسية

| Term | Meaning |
|------|---------|
| Protected-resource metadata | RFC 9728 document that identifies the resource and authorization servers |
| CIMD | HTTPS metadata document whose URL is the OAuth client identifier |
| DCR | Deprecated dynamic client enrollment retained for compatibility |
| `application_type` | `native` or `web`, used to validate redirect URI rules |
| PKCE | Verifier and S256 challenge that protect an intercepted authorization code |
| `iss` | RFC 9207 authorization response issuer identifier |
| Resource indicator | RFC 8707 parameter that binds a token request to an MCP resource |
| Audience | Resource for which a token is valid |
| Step-up | New consent and token issuance for an additional current-operation scope |
| Issuer-bound credentials | Registration and token records isolated by exact authorization server issuer |

## المزيد من القراءة

- [MCP 2026-07-28 authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [OAuth Client ID Metadata Document draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)
