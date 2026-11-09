# مؤلفة MCP في الإنتاج: التسجيل المرتبط بالمصدر والرموز

> دروس 16 بنيت آلة حالة OAuth 2.1. هذا الدروس يضيق حدود إنتاجها لمكب 2026-07-28: وثائق معرف العميل البيانات المعدنية أولاً ، وتسجيل ديناميكي مسبوق فقط للموافقة ، وتصديق المصدر من خلال الإذن-رد على الإصدار ، وإثباتات العميل المفتاحية للمصدر ، وتجديد JWKS ، والرموز المضمونة للجمهور على كل طلب غير حكومي.
>
> **Spec note (2026-07-28):**يتم تجاهل تسجيل العميل الديناميكي لصالح وثائق بيانات المستخدم. DCR لا يزال آلية التوافق. عند استخدامه، يعلن العميل صحيح `application_type`. العميل يؤكد أن RFC 9207 موجودة`iss`لا تستخدم أبداً إحصائيات الإعتماد عبر مستثمرين خادم الإذن.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90 minutes

## أهداف التعلم

- اكتشف خادم التصريح من خلال RFC 8414 البيانات المعدنية وتحقق من العقد.
- تسجيل من خلال وثيقة بيانات المستخدم و عزل DCR المنتهية من التطبيق كخلف.
- تصحيح RFC 9207 `iss`، تسجيلات رئيسية من قبل مستثمر خادم الترخيص، والرموز الرئيسية المرتبطة بالموارد من قبل مستثمر زائد الموارد.
- حفظ وتجديد مفاتيح JWKS على جدول زمني بحيث يتم التحقق من التوقيع على ما يصل إلى إعادة المفتاح.
- إضافة الرموز إلى مصدر واحد من MCP باستخدام مؤشرات مصدر RFC 8707 ورفض إعادة استخدام النائب المرتبط.
- اختر تأكيد JWT أو إشعار التفتيش، حدد طازجة الإلغاء، وفشل بأمان عندما لا توجد اعتمادات الهوية.
- إفصلا الخادم المعتمد، الخادم الموارد، والعميل بحيث كل واحد ينفذ فقط التحققات الخاصة به.
- مراجعة خادم الإذن ضد قائمة التحقق من التنفيذ ورفض التسجيل غير الآمن أو إعادة استخدام الرمز.

## المشكلة

يدير محاكي الدروس 16 OAuth 2.1 في الذاكرة. إنتاج لديه ثلاث ثغرات تشغيلية لا يراها محاكي الذاكرة فقط.

الفجوة الأولى هي التسجيل والعزل المؤهل. يمكن أن تشغيل منظمة حقيقية مئات الخوادم MCP وآلاف العملاء MCP.**Client ID Metadata Document**: يستخدم العميل عنوان URL HTTPS مع مسار يسيطر عليه كمتعرفه ، ويجذب خادم الإذن البيانات المعدنية. يبقى تسجيل RFC 7591 الديناميكي فقط كمسار متوافقية مسبقاً. عندما يكون DCR لا مفر منه ، يعلن الطلب الصحيح `application_type`. يقوم العميل بتخزين التسجيلات تحت مستثمر خادم الإذن و توكنات الوصول تحت `(issuer, resource)`زوج: إصدار مُغيّر يعني تسجيل جديد، ومصدر مختلف يعني رمز محدد بشكل منفصل للجمهور.

الفجوة الثانية هي دوران المفتاح يعتمد التحقق من JWT على مفاتيح توقيع خادم الائتمان، والتي يتم نشرها على أنها مجموعة مفاتيح ويب JSON (JWKS). يقوم خادم الإذن بتدوير هذه في جدول زمني (غالباً ما في الساعة، وأحياناً أسرع في حالة استجابة الحوادث). خادم MCP الذي يحصل على JWKS مرة واحدة في بدء يصدق بشكل جيد حتى نافذة الدوران  ثم كل طلب يفشل حتى إعادة تشغيل. سلك الإنتاج JWKS كمقيمة مخفية مع عمل التجديد الذي يغطي الاحتفاظ قبل انتهاء الفترة السابقة من المفاتيح، بالإضافة إلى إرجاع التقطيع على الاحتفاظ الفاشل للحالة التي يتم فيها توقيع رمز من قبل مفتاح أحدث من الاحتفاظ.

الفجوة الثالثة هي الالتزام بالجمهور. قدم الدروس 16 مؤشرات الموارد RFC 8707. في الإنتاج، يصبح هذا المؤشر تحقيقاً صعباً للمطالبة على كل طلب. يقوم خادم MCP بالمقارنة `token.aud`ضد عنوان URL الموارد القنوني الخاص به ورفض عدم الموافقة مع HTTP 401. هذا هو الدفاع الوحيد ضد خادم MCP متجهة إلى الأمام (أو عميل ضار يحمل رمزًا مصممة لمخادم واحد) يعيد تشغيل هذا الشك ضد خادم آخر في شبكة الثقة نفسها.

هذه الدروس ترسم كل فجوة على قطعة خرسانية من السطح. وثيقة البيانات المعدنية هي نقطة نهاية HTTP. تحديث التخزين التخزيني JWKS هو عمل مُجدد بالإضافة إلى التخزين التخزيني القيم المفتاحية. التحقق من JWT هو روتين يعمل عليه خادم الموارد قبل إرسال أي أداة. حافظ على الأدوار الثلاث منفصلة و كل واحد ينفذ فقط التحققات التي يملكها: خادم الإذن يصدر ويتناول المفاتيح، خادم الموارد تخزين وتؤكد، ويكشف العميل ويتسجل.

## المجال: التنفيذ في الإنتاج بعد الدروس 16

[Lesson 16: MCP Security with OAuth 2.1](../../16-mcp-security-oauth-2-1/docs/en.md)يمتلك جهاز حالة رمز التأذن ، PKCE ، اكتشاف الموارد المحمية ، مؤشرات الموارد ، وقرارات النطاق. هذه الدروس لا تحدد تدفق OAuth الثاني. تبدأ بعد وجود هذه العقود وتسأل كيف يواصل خادم الموارد المنشغول تطبيقها أثناء دوران المفاتيح ، وصحة الوهام غير الشفافة ، والإلغاء ، وفشل الاعتماد ، والإرسال ، والاستجابة للحوادث.

الحدود الإنتاجية أصغر وأكثر تشغيلاً:

- تتحقق مسار JWT من المصدر المثبت ، والخوارزمية ، ومفتاح التوقيع ، والجمهور ، والمدة ، والمدة على كل طلب أثناء تجديد JWKS بأمان.
- يطلق مسار رمز غير شفاف على نقطة نهاية التفتيش الداخلي المصدر الموثقة ويمتحق حالة النشاط المرجعة أو الجمهور أو الموارد والانتهاء من الصلاحية والمسألة والطول.
- سياسة الإلغاء تحدد سرعة توقف الإعتماد عن العمل وما الذي يمكن أن يؤخر ذلك.
- سياسة الفشل تقرر ما يحدث عندما لا توجد البنية التحتية للاكتشاف أو JWKS أو التفتيش أو الإلغاء.
- سجلات الأدلة التي أدت إلى إصدار البيانات الأساسية، ومجموعة مفاتيح أو استجابة للتفتيش، ومطالبات الوهم، ونسخة السياسة، وسبب الرفض دون تخزين الوهم.

هذا التمييز يبقي الدروس قابلة للتكوين. الدروس 16 تثبت التدفق. الدروس 18 تثبت أن رمز يبقى موثوق، أو يرفض، بعد أن يصل إلى مسار طلب MCP الحقيقي.

## المفهوم

### RFC 8414  أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت أوت

وثيقة في `/.well-known/oauth-authorization-server`يصف كل ما يحتاجه العميل:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "client_id_metadata_document_supported": true,
  "registration_endpoint": "https://auth.example.com/register",
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

العميل الذي تم إعطائه سلسلة URL للموارد MCP اكتشاف: `oauth-protected-resource`من RFC 9728 (وثيقة خادم الموارد) اسم المصدر ، ثم `oauth-authorization-server`(هذه المعلومات) تسمي كل نقطة نهاية العميل لا يرمز أبداً عنوان URL الموافقة

لتحديد الموارد مع مسار، أدخل القطاع المعروف قبل ذلك المسار. على سبيل المثال، `https://mcp.example.com/team/server`يُحلّل البيانات المعدنية المُحَمَّنة في الـ `https://mcp.example.com/.well-known/oauth-protected-resource/team/server`. إضافة`/.well-known/...`بعد أن يكون مسار الموارد غير صحيح.

العقد الذي تفحصه قبل أن تثق في شركة " إيد ب " لـ " م سي بي

- `code_challenge_methods_supported`يشمل `S256`(PKCE لكل RFC 7636). التفاصيل واضحة: إذا كان هذا الحقل**absent**، لا يدعم خادم الإذن PKCE والعميل **MUST**رفضوا المضي قدماً
- `grant_types_supported`يشمل `authorization_code`ورفض`password`و`implicit`. . .
- هناك مسار واحد على الأقل للتسجيل: `client_id_metadata_document_supported: true`(CIMD، المفضلة) ، عميل مسجل مسبقًا، أو `registration_endpoint`(توافق RFC 7591 المتناقض).
- إذا`authorization_response_iss_parameter_supported`صحيح، العميل يتطلب المرجع RFC 9207`iss`ويقارنها بالضبط مع المصدر المسجل قبل إعادة التوجيه.
- `response_types_supported`هو بالضبط`["code"]`لـ OAuth 2.1.

إذا`S256`إذا غيب، يرفض خادم MCP نشر ضد هذا IdP  لا يوجد وضع مهدّد ل PKCE. إذا *لا * طريق التسجيل يتم الإعلان عنه ولم يكن لديك تسجيل مسبق `client_id`لا يمكنك التسجيل أيضاً، إنّ مذكرة التنفيذ خاطئة، وليس الرمز.

### RFC 9728 (إعادة التأهيل)  بيانات الموردة المحمية

غطت الدروس 16 RFC 9728. الدلتا في الإنتاج: هذا الوثيقة هو المكان الوحيد الذي يبحث فيه العميل للعثور على خوادم الإذن الموثوق بها من قبل * هذا * خادم MCP. يمكن لمخادم MCP واحد قبول رموز من العديد من IdP (واحد للموظفين ، واحد للشركاء). يعلن RFC 9728 ذلك المجموعة ؛ RFC 8414 يستند إلى ما يدعمه كل IdP.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### وثائق بيانات المستخدم (المتميزة الموصى بها)

يعكس CIMD التسجيل من * push* إلى * pull*. بدلاً من طلب خادم الإذن لخسارة `client_id`، يستخدم العميل عنوان HTTPS الذي يسيطر عليه **as**- نعم`client_id`. يتم تحديد عنوان URL إلى وثيقة بيانات JSON ؛ يحصل خادم الإذن عليه عند الطلب أثناء تدفق OAuth. يتم ترشيح الثقة في DNS: إذا كان مشغل الخادم يثق `app.example.com`، انها تثق العميل خدمة من`https://app.example.com/client.json`لا تسجيل ذهاب وإياب، لا`client_id`مساحة الأسماء إلى التفريغ، لا حالة لكل خادم للحفاظ على التزام المزامنة.

الوثيقة المعدنية التي يستضيفها العميل:

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

- نعم`client_id`القيمة في الوثيقة **MUST**يُساوي عنوان URL الذي يتم خدمته منه (يؤكد خادم الإذن هذا ، يتم رفض عدم المطابقة). يعلن خادم الإذن عن الدعم مع `client_id_metadata_document_supported: true`في بياناتها المعدنية RFC 8414

بالنسبة للعقد الحالي لـ CIMD ،`client_id`،`client_name`، و غير فارغ`redirect_uris`المعرف العميل هو عنوان HTTPS مطلق مع مسار. `application_type`قد يتم تضمينها، ولكنه ليس حقل إلزامي من CIMD. لا تنسخ متطلب DCR لـ `application_type`في مسار CIMD المفضل

هناك حقائق أمنية واضحة حولها:

- **SSRF.**يقوم خادم الإذن بتحويل عنوان URL المقدم من المهاجم. يجب أن يتحمي ضد مزيف طلبات جانب الخادم (لا توجد تحويلات إلى نقاط نهاية داخلية / إدارية).
- **localhost impersonation.**لا يمكن لـ CIMD وحدها منع المهاجم المحلي من المطالبة بمدفوعات البيانات المعدنية لعميل شرعي والربط بأي `localhost`إعادة توجيه خادم الإذن**MUST**إظهار اسم المضيف لإعادة توجيه URI بوضوح أثناء الإذن و **SHOULD**تحذير`localhost`-إعادة توجيهات فقط

لأن CIMD لا تحتاج إلى حالة جانب الخادم ، لا يوجد مسجل للوقوف على الطريقة التي تتطلبها DCR. الجانب العميل يقرأ فقط: خدمة وثيقة البيانات المعدنية من نقطة نهاية HTTPS ثابتة ودع خادم الإذن يسحبها.

إذا كان مشغل خادم الترخيص قد قدم بالفعل معرفًا لعميل ، فاستخدم هذا التسجيل الذي يحدد مستوى المصدر قبل محاولة التسجيل التلقائي. وإلا تفضل CIMD. استخدم DCR القديم فقط عندما لا يستطيع المصدر استخدام إما التسجيل المسبق أو CIMD.

### RFC 7591: تسجيل التوافق المنتهي السن

تم تجاهل DCR في مراجعة 2026-07-28. احتفظ به فقط لسيرفرات الائتمان التي لا تستطيع استهلاك CIMD وحيث يكون التسجيل المسبق غير عملي. يشارك عميل التوافق:

```json
POST /register
Content-Type: application/json

{
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

الجهاز يستجيب بـ `client_id`و (أ)`registration_access_token`للتحديثات اللاحقة:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`application_type`لا يُعدّ ديكوراتياً.`native`؛ يعلن عميل مضيف على خادم `web`و يستخدم إعادة توجيه HTTPS URIs. `token_endpoint_auth_method: none`هو الاختيار المسبق للعميل العام الأصلي.`client_id`فقط، مع تقديم PKCE دليل على امتلاكها.

ثلاثة مشاكل في الإنتاج:

- يجب أن يحدد نقطة التسجيل المحددة حسب عنوان المصدره بدون ذلك، يقوم الفاعل العدائي بتسجيل ملايين التسجيلات المزيفة ويستنفد`client_id`إجراء فحص الحد الأدنى قبل أن يتعامل المسجل مع الطلب
- `software_statement`(التأكيد على JWT الموقع للعميل) مطلوب من قبل بعض IDPs المؤسسة. تخطي مزيفة الدروس ذلك؛ تشغيل الإنتاج خطوة التحقق التي ترفض التسجيلات غير الموقعة من أي شيء آخر غير localhost إعادة توجيه URIs.
- - نعم`registration_access_token`يجب أن يتم تخزينها كـ "هاش" وليس كـ "نص" عادي. سرقة هذه الرمزية تعني أن المهاجم يمكنه إعادة كتابة إعادة توجيهات العميل

### RFC 8707 (إعادة التأهيل)  مؤشرات الموارد

الدروس 16 وضعت الشكل قاعدة الإنتاج: كل طلب رمزية يتضمن`resource=<canonical-mcp-url>`، و خادم MCP يُحقق`token.aud`يطابق عنوان URL الموارد الخاص به في كل مكالمة. يعد URI القنوني هو * أكثر المعرفات محددة * للخادم: يستخدم مخططًا صغيرًا ومضيفًا ، لا يوجد قطعة ، ولا يوجد شرائح متأخرة تقليديًا.**not**يتم تجاهلها بالقاعدة  يحتفظ المفرد بها عندما تكون ضرورية لتحديد خادم MCP فردي. `https://mcp.example.com`،`https://mcp.example.com/mcp`،`https://mcp.example.com:8443`و`https://mcp.example.com/server/mcp`كل هذه المعلومات هي ملفات إلكترونية رسمية صالحة. اختر واحدة لكل خادم و محط`aud`(تلك الدرجة تستخدم الجمهور العاري مثل`https://notes.example.com`للوقت القصير: تنشر يستضيف العديد من خادمات MCP تحت أصل واحد يفرز بينها من خلال المسار.)

### RFC 7636 (إعادة التأهيل)  PKCE

PKCE إلزامية في OAuth 2.1. تدفق رمز الترخيص للدرس دائما يحمل `code_challenge`و`code_verifier`. يرفض الخادم أي طلب رمزية دون مؤكد أو مع مؤكد لا يختلف عن التحدي المخزن.

### ملف تفويضات MCP 2026-07-28

يحتفظ مراجعة MCP الحالية بالحدود الموارد-خادم OAuth مع جعل نقل MCP غير متعلقة. لا توجد جلسة بروتوكول لإخفاء قرار الهوية. وبالتالي فإن طبقة الإذن تؤكد كل طلب بشكل مستقل:

- تنفيذ RFC 9728 المعلومات المتحفظة، وتوفير موقعها إما من خلال `WWW-Authenticate: Bearer resource_metadata="..."`الرأس على 401 **or**المعلومات المشهورة`/.well-known/oauth-protected-resource`(SEP-985 جعلت الرأس اختياريًا مع تعليق معروف) البيانات المعدنية `authorization_servers`الحقل**MUST**اسم خادم واحد على الأقل
- تقبل الرموز فقط عبر `Authorization: Bearer ...`على**every**طلب  أبدا في سلسلة استفسارات، أبدا معتمدة فقط في بداية الجلسة.
- تأكيدي`aud`،`iss`،`exp`و المجال المطلوب لكل طلب . الخادم**MUST**يؤكد أن الرمز تم إصداره خصيصاً له (الجمهور) ؛ اختفاء أو عدم مطابقة`aud`يتم رفضه، لا يعامل أبداً كخريطة.
- في 401/403، العودة `WWW-Authenticate: Bearer`الحمل`error=...`،`resource_metadata="<PRM-URL>"`المعلم (URL الوثيقة البيانات المعدنية ، *ليس *المصدر العادي) ، و `scope="..."`على`insufficient_scope`(403) ملاحظة: المعلم هو `resource_metadata`، مؤشر اكتشاف  لا يوجد `resource`المعلم في التحدي.
- الوصول إلى خادم الموافقة يقبل **either**RFC 8414 المعلومات المتحركة**or**OpenID Connect Discovery 1.0، يجب على العملاء تجربة كل من الإضافات المعروفة بالتالي في الترتيب الأولوي.
- العميل (وليس الخادم) يدافع عن**mix-up attacks**: تسجل المتوقع `issuer`قبل إعادة توجيه وتؤكيد`iss`القيمة المرجعة في رد الإذن الفعلي (RFC 9207) قبل استرداد الرمز. PKCE وحدها لا تتوقف عن الاختلط، لأن العميل يقدم `code_verifier`إلى أيّ نقطةٍ كانت تُوجّه إليها
- إن إئتمان العميل ينتمي إلى أحد أصحاب الخادم المعتمد. إذا حل الاكتشاف إلى مصدر آخر، يقوم العميل بإعادة التسجيل بدلاً من تقديم القائمة القديمة `client_id`رمز التسجيل أو رمز الوصول
- الميزة المفضلة للتسجيل هي CIMD. تمت إبطال الـ DCR؛ لا يزال طلب التوافق من الـ DCR يعلن عن الصواب `application_type`. . .

مسودة OAuth 2.1 هي الأساس؛ RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD هي السطح؛ وتحديد MCP هو الملف.

### قائمة التحقق من قدرات الانتشار

يتم تعديل جدولات ميزات البائعين بسرعة. تحقق من البيانات المعدنية التي يعيدها خادم الإذن الذي ستقوم بتنفيذها بدلاً من ذلك. البوابة ميكانيكية:

| Check | Required decision |
|---|---|
| Discovered issuer | Exact HTTPS issuer expected by policy |
| PKCE | `S256` advertised; otherwise stop |
| Enrollment | CIMD preferred, pre-registration accepted, DCR only as deprecated compatibility |
| Authorization response | Validate RFC 9207 `iss` when present or advertised |
| Resource binding | Token request carries `resource`; resource server requires the matching `aud` |
| Credential storage | Key client IDs and registration credentials by issuer; key access tokens by issuer plus resource |
| DCR compatibility | Declare `native` or `web`; reject redirect URIs that do not fit the declared application type |

لا تستنتج الدعم من اسم المنتج أو مستوى التسعير. احتفظ بالوثيقة المكتشفة في دليل التنفيذ وتغلق عندما لا يكون هناك حقل إلزامي.

### نمط إعادة التأهيل JWKS (التناوب في AS، التأهيل في خادم الموارد)

أبقَ اللفظين منفصلين، لأنّ إصطحابهم يُعدّ خطأً حقيقيّاً في الإنتاج:

- **Rotate**ما يفعله * خادم الإذن *: وضع مفتاح توقيع جديد ، ونشره في JWKS ، وإلغاء القديم في وقت لاحق. لا تشارك خادم الموارد في هذا ولا يمكنه القيام بذلك  لا يحمل مفتاح IDP الخاص.
- **Refresh**هو ما يفعله * خادم الموارد *:`GET`هذا هو الإجراء الوحيد الذي يقوم به خادم الموارد

وضع فشل الإنتاج هو مخزن سلفي. حلله مع وظيفة تحديث محددة بالإضافة إلى مخزن ذا قيمة مفتاحية. يقوم خادم الموارد بتشغيل وظيفة (cron، timer، أيا كان وقت تشغيلك يقدم) التي ، على فترة محددة ، تجلب `<issuer>/.well-known/jwks.json`و التداول`cache[issuer] = {keys, fetched_at}`.المؤكد يقرأ من هذا الجهاز التخزيني .وهو رمز`kid`غائب من محفزات التخزين**one**التجديد المزامن كإرجاع، ثم التحقق من جديد. هذا يتعامل مع الحالتين في وقت واحد: التجديد المخطط، ونوافذ التداخل المفتاحي حيث يتم وصول رمز موقّع بمفتاح جديد تماما قبل التجديد المخطط التالي.

الظهور الخلفي**must be a re-fetch, never a rotate**إذا قمت بتوصيل مسار التخفيض إلى مسار التداول، ستنتهي أمرين: (1) إن تم وضع مفتاح جديد ينتج`kid`لا يطابق الـ "Token" ، لذا فإن البحث يفشل على أي حال. و (2) مهاجم يفرش الـ "tokens" بالصدفة`kid`القيم تجبر سلسلة لا حدود لها من الإبداع الرئيسي`kid`تكلفة واحدة في المقام الأول

شكل الجهاز التخفيضي:

```json
{
  "https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

مفتاحان في وقت واحد هو حالة ثابتة. يقوم خادمات الإذن بالدوار عن طريق إدخال مفتاح التالي (`k_2026_04`قبل التقاعد (`k_2026_03`), لذلك تظل الرموز المصدرة تحت المفتاح القديم صالحة حتى تنتهي صلاحيتها. الاحتفاظ بالخزنة يحتوي على الاتحاد.`kid`. . .

### روتين التحقق من التحقق

خادم MCP يدير التحقق قبل إرسال أي أداة.`code/main.py`استخدامات:

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate`يفكّر JWT، يحل مفتاح التوقيع من ذاكرة التخزين JWKS (تتجديد مرة واحدة في غياب) ، يصدق التوقيع، ثم يُحقق `iss`ضد قائمة الإذن`aud`ضد الموارد القنونية لهذا الخادم`exp`، والطاق المطلوب  إرجاع`WWW-Authenticate`التحدي في الفشل الأول. الحفاظ على روتين واحد على خادم الموارد يعني أن كل نقطة دخول (كل مكالمة أداة، كل نقل) تمر بنفس التحققات. لا توجد مسار يصل إلى أداة دون التحقق أولاً.

### الوهم غير الشفاف يستخدم التفتيش الداخلي وليس التخمين

ليس كل رمز الوصول هو JWT. إذا قام المصدر بتوثيق رمز غير شفاف، لا يمكن لخادم الموارد فك رموزه إلى مطالبات موثوقة. فإنه يرسل الرمز إلى نقطة نهاية مراقبة داخلية RFC 7662 للمصدر عبر قناة خلفية مصحوبة ويتطلب`active: true`، والسياق المتوقع للمصدر، والجمهور أو الموارد الدقيقة للمؤسسات المالية المعدنية، والمدة غير المتأخرة للمطالبات، والطول المطلوب من الأداة المحددة.

التفتيش المتخفي من قبل المصدر، و إعادة إصدار رمز واحد، ومصدر MCP. لا تستخدم أبداً الرمز البيضاء كمنشور أو علامة التخزين. إرتبط بإدخال الاحتفاظ الإيجابي بأوائل انتهاء صلاحية الرمز، وإرشادات الاحتفاظ بإصدارها، و هدف الطفافة لإلغاء النشر. حافظ على الاحتفاظ بالخزينة السلبية قصيرة بما فيه الكفاية حتى لا تبقى رمزاً أصدر حديثاً غير نشطة بشكل خاطئ. لا يمكن لنتيجة لمصدر واحد أن تسمح بمصدر آخر حتى عندما يكون سلسلة الرمز غير المرئي متطابقة.

لا تختار وضع التحقق من المحتويات الرمزية التي يتحكم بها المهاجم. قم بتحديد سلوك JWT مقابل التفتيش إلى البيانات المعدنية المصدرة المصدقة وتكوين التنفيذ. على مسار JWT ، تم قبول الخوارزميات وتثق بها.`jwks_uri`لا تتبع أبداً عنوان URL أو خوارزمية رئيسية تم اختيارها فقط من قبل عنوان الرمز.

### الإلغاء هو عقد الطفولة

RFC 7009 يسمح للعميل بطلب من خادم الإذن إلغاء رمز. هذا الطلب لا يمحو النسخ التي تم حفظها بالفعل من قبل كل خادم مصدر. حدد أقصى تأخير الإلغاء المقبول وجعل كل cache يحتفظ به.

يمكن لنشر الوهم الغير مرئي تحقيق إلغاء أقوى من خلال التدقيق في كل مكالمة عالية المخاطر أو استخدام مخزن محفظة إيجابي قصير. عادة ما يجمع نشر JWT المستقلة بين عمر الوصول القصير للشعار مع إلغاء الشعار التجديد، والتقاعد المفتاحي للحوادث على مستوى المصدر، وقائمة موضوع أو جلسة أو رمز رمزية اختيارية لرفض الطوارئ المحلية. تبقى JWT الموقعة صالحة رمزيا حتى انتهاء صلاحيتها ما لم يكن لدى خادم الموارد دليل إلغاء خارجي حالي.

إن تسجيل الدخول، وإبطال الحساب، وإسقاط الموافقة، والاستجابة للحوادث هي عوامل مختلفة ولكن يجب أن تتحرك على بيان واحد قابلة للقياس: بعد نافذة الإلغاء المعلنة على أقصى حد، ترفض كل نسخة الإئتمانات. اختبر هذه البيانة من خلال ميزان الحمل، وليس فقط ضد عملية واحدة دافئة.

### فشل الإعتماد يحتاج إلى قرار مُعلن

لا تتلاعب أبداً بسياسة الوصول داخل عامل الاستثناء

| Failure | Safe production behavior |
|---|---|
| Scheduled JWKS refresh fails, known `kid` remains in a still-valid bounded cache | Continue only within the declared stale-on-error window and emit degraded health evidence |
| Token has an unknown `kid` and the one allowed refresh fails | Reject; never accept an unverifiable signature |
| Introspection is unavailable | Fail closed for protected calls; do not convert network failure into `active: true` |
| Protected-resource or issuer metadata changes unexpectedly | Stop new enrollment and token acquisition; keep only explicitly pinned, unexpired configuration under a bounded incident policy |
| Revocation endpoint is unavailable | Report logout or revocation as incomplete, retain the credential locally as unusable when possible, and do not claim global revocation succeeded |
| Clock source or claim type is invalid | Reject rather than widening skew until the token passes |

تصنيف الفشل بشكل منفصل عن الإثباتات غير صالحة. إنقطاع الاعتماد هو خطأ عملي مع سياسة الصحة وإعادة المحاولة. سوء التوقيع، المصدر، الجمهور، انتهاء الصلاحية، أو نطاق هو رفض الترخيص. لا يصل أي من أدوات المعاملة، ولا ينبغي أن تسرب محتويات الرمز إلى أدلة مراجعة.

### التشغيل المتكرر للجمهور (قيود على امتيازات الوصول إلى رموز الوصول)

الخادم (`notes.example.com`) و الخادم ب (`tasks.example.com`) كلا التسجيل ضد نفس خادم الموافقة. الخادم A هو المخترق. المهاجم يأخذ رمز ملاحظات المستخدم ويعيد تشغيله ضد الخادم B.

مؤكدة الخادم ب:

1. فك رموز JWT، احضر JWKS من خلال `kid`، تأكيد التوقيع
2. تحقق`iss`ضد بياناتها المتحمية`authorization_servers`(مُجريّة نفس الـ"آي دي بي"
3. تحقق`aud == "https://tasks.example.com"`(فشل رمز)`aud`هو`https://notes.example.com`().
4. أعد 401 مع `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"`. . .

دعوى الجمهور هو الدفاع الوحيد ضد هذا الهجوم في طبقة البروتوكول. تخطي ذلك لأداء هو الخطأ الإنتاج الأكثر شيوعا؛ يجب أن يعمل المؤكد على كل طلب، وليس فقط في بداية الجلسة.**access-token privilege restriction**: خادم MCP `MUST`رفض أي رمز لا يسميه في الجمهور

> **Naming note.**يحتفظ المفرد بالصيغة * نائب مخبط * لمشكلة ذات صلة ولكنها واضحة: خادم MCP يعمل كموظف**proxy**إلى API طرف ثالث ، باستخدام معرف العميل ثابت ، الذي ينقل رمزًا دون الحصول على موافقة المستخدم لكل العميل. تحلّل ربط الجمهور التشغيل أعلاه. تحلّل حلّ النائب الخلط موافقة كل العميل **plus**لا تمرّر الرمز المُدخل أبداً إلى مُصدرات إدارة التكنولوجيا (MCP server `MUST`الحصول على رمز منفصل صعودا).

### هجمات مختلطة (دفاع من جانب العميل لا يمكن أن يوفر الخادم)

يتحدث العميل مع العديد من خادمات التأليف على مدى حياته. يمكن أن يحاول AS الخبيث أن يجعل العميل يسترد رمز التأليف الصادق من AS في نقطة نهاية رمزية للمهاجم. لا يساعد ربط الجمهور هنا  يحدث الهجوم قبل وجود أي رمز. يعيش الدفاع في العميل (RFC 9207):

1. قبل إعادة توجيه، يقوم العميل بتسجيل المتوقع `issuer`من البيانات المعدنية المعتمدة للطريقة المعمول بها.
2. على رد الموافقة، يُقارن العميل المرجع `iss`المعلمة ضد المصدر المسجل (مقارنة بسيطة من السلاسل، لا توجد طبيعة) قبل إرسال الرمز إلى أي مكان.
3. عدم الانسجام (أو `iss`غياب عندما أعلنت النظام التجاري `authorization_response_iss_parameter_supported`) → رفض، ولا حتى يعرض`error`الحقول

PKCE وحدها لا تتوقف عن الارتباك، لأن العميل يقدم`code_verifier`إلى أي نقطة نهاية رمزية تم توجيهها إليها لهذا السبب يقوم المواصفات بتسجيل المصدر على الطلب جنبا إلى جنب مع مؤكد PKCE و`state`. . .

### أساليب الفشل

- **Stale JWKS.**يرفض المؤكد رموز صالحة بعد أن يقوم AS بتدوير مفتاح. التحديد هو نمط cron-refresh + cache-miss-refetch أعلاه. لا تخزن JWKS أبدا دون عمل التجديد.
- **Rotate-as-fall-back.**إن توصيل مسار التخفيض إلى مسار التداول بدلاً من إعادة التوصيل هو خطأ حقيقي: لا ينتج أبداً المفقودين`kid`، و يصبح المهاجم يسيطر عليه`kid`القيم في إدارة الإدارة التركيزية. يجب أن يكون الخلفية هي المتميزة`refresh-jwks`. . .
- **Missing `aud` claim.**بعض المعلومات الإلكترونية تُغيب عن الإغلاق`aud`إلا إذا`resource`يحتوي على طلب الرمز. يجب على المؤكد رفض الرمز مع غياب`aud`لا تعامل مع غيابك كطرد
- **Mix-up via missing `iss` check.**العميل الذي لا يؤكد RFC 9207 `iss`يمكن توجيه مبرمير الامتحان والرد على المصدر الذي سجله قبل إعادة التوجيه إلى استرداد رمز AS الصادق في نقطة نهاية رمزية للمهاجم. هذا فشل من جانب العميل؛ لا يمكن لمخادم الموارد تعويض ذلك.
- **Scope upgrade race.**يمكن أن تنجح تدفقات تصعيد متزامنين لنفس المستخدم وتنتج رمزين وصولين ذوي نطاق مختلف. يجب على المؤكد استخدام الرمز المقدم على الطلب ، وليس البحث عن "نطاق المستخدم الحالي"  الذي يخلق نافذة TOCTOU.
- **Registration token theft.**- تسريب`registration_access_token`يسمح للمهاجم بإعادة كتابة إعادة توجيه URIs. حدد هذه في حالة راحة؛ تطلب من العميل تقديم النص الصريح في كل تحديث؛ تدوير على الشك.
- **`iss` not pinned.**مؤكد يقبل أي`iss`يسمح للمهاجمين بتقديم خادم تفويضهم الخاص، وتسجيل عميل للجمهور المستهدف، وإصدار رموز.`authorization_servers`القائمة هي القائمة المسموح بها، قم بتنفيذها.
- **Credential or token cache collision.**يمكن للعميل الذي يقوم بمفاتيح تسجيلات فقط عن طريق الموارد تقديم هوية خادم تصريح واحد إلى آخر. يمكن للعميل الذي يقوم بمفاتيح وصول توكنات فقط عن طريق المصدر إعادة تشغيل رمز في جمهور خاطئ. يمكن تسجيلات مفتاح من قبل المصدر المعتمد، توكنات الوصول مفتاح من قبل `(issuer, resource)`، وإعادة تسجيل كلما تغير المصدر

```figure
t3-jwks-rotate
```

## استخدمها

`code/main.py`يمر في كامل تدفق الإنتاج مع stdlib Python و ثلاثة أدوار: `AuthorizationServer`،`ResourceServer`و`Client`التدفق:

من جذور المخبأ، تشغيل:

```bash
cd phases/13-tools-and-protocols/18-mcp-auth-production
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

القيادة الأولى طباعة التسجيل المرتبط بالمصدر والتحقق من التحقق من الرمز
النسخة الثانية تقرير ثمانية عشر عملية مرور. لا أحد من الأوامر يفتح
المستمع للشبكة أو يكتب إشارات اعتمادية.

1. خادم الإذن ينشر RFC 8414 البيانات الأساسية في `/.well-known/oauth-authorization-server`. . .
2. العميل MCP يدعو نقطة نهاية البيانات المعدنية ويتحقق من خيارات التسجيل (`client_id_metadata_document_supported`لـ CIMD`registration_endpoint`لـ (DCR) و`S256`دعم PKCE
3. يبحث العميل عن تسجيل مسبق يحدد من قبل المصدر، وإلا يسجل مع وثيقة بيانات المستخدم HTTPS. DCR المهدر لا يزال طريقة توافق قابلة للتحقق بشكل منفصل.
4. يقوم العميل بتسجيل المصدر المعتمد، وخلق تحد S256، ويتلقى رمز تصريح لمرة واحدة بالإضافة `iss`، يؤكد أن المصدر المرجع ، ويستبدل الرمز مع المؤكد الأصلي و RFC 8707 `resource`مؤشر
5. العميل MCP يدعو أداة على خادم MCP مع `Authorization: Bearer ...`. . .
6. يعمل خادم MCP `validate`، حل مفتاح التوقيع من ذاكرة التخزين JWKS.
7. يدور IDP مفتاحاً؛ والإعادة المخطط لها تجذب JWKS مرة أخرى إلى التخزين الآلي.
8. المكالمة التالية تؤكد ضد المفاتيح المتجددة دون إعادة تشغيل، والرمز السابق لا يزال يؤكد خلال نافذة التداخل.
9. محاولة إعادة عرض الجمهور ضد مصدر مختلف من المملكة المتحدة تحصل على 401 مع`audience mismatch`و (أ)`resource_metadata`المؤشر

يستخدم JWT هنا HS256 مع سر مشترك (لذلك الدروس تعمل على stdlib فقط). إنتاج يستخدم RS256 أو EdDSA مع نمط JWKS أعلاه. منطق التحقق هو نفسه في غير ذلك. لأن IDP وخادم الموارد يعيش في عملية واحدة ، `refresh_jwks`يقرأ قائمة المفاتيح الخاصة بخادم الإذن مباشرة؛ عبر الأسلاك هو HTTP `GET`إلى`jwks_uri`. . .

## أرسله

هذا الدرس يُنتج`outputs/skill-mcp-auth.md`. بالنظر إلى تكوين خادم MCP ومجموعة قدرات IdP ، فإن المهارة تنبعث من سطح auth للاستقرار  البيانات المحتفظة الموارد، وسيلة التسجيل للاستخدام (CIMD، التسجيل المسبق، أو DCR fallback) ، وتوقيت إعادة التشغيل JWKS، خريطة النطاق، وقواعد الرفض للتطبيق عندما لا يدعم IdP الملف RFC الكامل.

## التمارين

1. أركض`code/main.py`. تتبع التدفق. لاحظ كيف يدور IdP مفتاح في الخطوة 6 من الناتج من النص (خطوة 7 من التدفق أعلاه) ، المخطط `refresh_jwks`يُسحب مرة أخرى المجموعة المنشورة، ويتم تأكيد كل من الرمز القديم (فوترة التداخل) و الرمز الجديد دون إعادة تشغيل.

2. إضافة IDP جديد إلى البيانات المعدنية المستخدمة في الموارد المحمية `authorization_servers`إصدار رمز وقعه IDP الجديد وتأكيد المحقق يقبل به إصدار رمز وقعه IDP غير المدرجة وتأكيد الرفض المحقق مع `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`. . .

3. إضافة إحصاء على الحد من المعدلات إلى `register_client`تستخدم رموز-بوكيت لكل مصدر IP التي تمتلكها في إشارة صغيرة مع مفتاح IP.

4. اقرأ RFC 7591 وتحدد مجالات الدروس`/register`المدير لا يؤكد. إضافة التحقق.`software_statement`و`redirect_uris`نظام URI)

5. إضافة خادم تصريح ثان. تأكيد العميل تخزين تسجيل منفصل مفتاح المصدر ويرفض إعادة استخدام رمز المصدر الأول أو `client_id`. . .

6. إثبت إصلاح الدولية إرسال مؤكداً رمزياً مع إصدار عشوائي`kid`و تأكيد`refresh_jwks`يبدأ في التشغيل مرة واحدة على الأكثر وعدد المفاتيح في خادم الترخيص لا ينمو ثم أعيد إعادة تشغيل الركود إلى دورة وذرة ومشاهدة ارتفاع عدد المفاتيح لكل رمز مزيف

7. ممارسة DCR المعتاد مع كلتا`native`و`web`المستخدمين. تأكيد عميل الويب مع إعادة توجيه HTTP URI و عميل الأصلي دون إعادة توجيه اللوبك بالضبط يتم رفضها.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ASM | "OAuth metadata document" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | "Client metadata URL" | Client ID Metadata Document: an HTTPS URL used as the `client_id`; the AS pulls the JSON. Preferred enrollment in MCP 2026-07-28 |
| DCR | "Self-service client registration" | RFC 7591 `POST /register`; deprecated for current MCP and retained only for compatibility |
| JWKS | "Public keys for JWT validation" | JSON Web Key Set, fetched from `jwks_uri`, indexed by `kid` |
| Rotate vs refresh | "Updating the keys" | *Rotate* = AS mints/retires signing keys; *refresh* = resource server re-fetches the published set. Resource servers only ever refresh |
| Resource indicator | "Audience parameter" | RFC 8707 `resource` parameter pinning the token to one server |
| `aud` claim | "Audience" | JWT claim the validator compares against the canonical resource URL |
| Audience replay | "Token replay" | Token issued for Server A presented to Server B; defended by audience validation (spec: access-token privilege restriction) |
| Confused deputy | "Proxy token misuse" | An MCP proxy with a static client ID forwarding a token without per-client consent; distinct from audience replay |
| Mix-up attack | "Wrong token endpoint" | Client steered to redeem an honest AS's code at an attacker's endpoint; defended client-side via RFC 9207 `iss` |
| `iss` allow-list | "Trusted authorization servers" | The set named in protected-resource metadata's `authorization_servers` |
| `resource_metadata` | "Where to find the PRM doc" | `WWW-Authenticate` parameter naming the RFC 9728 metadata URL on a 401/403 |
| Public client | "Native or browser client" | OAuth client with no `client_secret`; PKCE compensates |
| `WWW-Authenticate` | "401/403 response header" | Carries `Bearer error=...` directives that drive client recovery |

## المزيد من القراءة

- [MCP authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)- ملف تفويضات المخططات المختلفة الحالي
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)- CIMD، وصح المصدّر، إيقاف DCR، وتغييرات تصريحات المصدّر المحدّدة
- [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) CIMD
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)عقد اكتشاف
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) DCR (مسار العودة)
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) دليل على امتلاك العميل العام
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) إضافة الجمهور
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) اكتشاف الخادم الموارد
- [RFC 9207 — OAuth 2.0 Authorization Server Issuer Identification](https://datatracker.ietf.org/doc/html/rfc9207) الموقع `iss`المعلم الذي يحمي ضد الهجمات المختلطة
- [RFC 7662: OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 7009: OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
