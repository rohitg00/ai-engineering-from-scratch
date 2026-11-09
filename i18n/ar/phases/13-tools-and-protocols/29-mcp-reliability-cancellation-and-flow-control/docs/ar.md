# موثوقية المخططات المعدنية، وإلغاء، ومراقبة التدفق

> تحديد المعلومات لا يجعلها الآثار الجانبية آمنة، أو يوقف العامل، أو يحمي التيار من المستهلك البطيء.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 09 and 13
**Time:** ~120 minutes

## أهداف التعلم

- تنفيذ إشارة إلغاء الصحيحة لـ stdio و Streamable HTTP.
- حل سباقات الانتهاء والإلغاء دون إرسال رسائل بعد الإلغاء.
- إلغاء طلب منفصل عن الطلبات المتواصلة`tasks/cancel`النطقية
- بناء قرارات إعادة المحاولة من الآثار الجانبية و مفاتيح الإعدام الصريح.
- تحديد صفوف التقدم مع الحفاظ على الردود النهائية.
- استعادة التيارات من خلال إعادة الاتصال، إعادة التوصيل، والعودة القلق.

## المشكلة

الطريق السعيد يخفي أغلى حشرات النظم الموزعة

يقوم العميل بدعوة أداة. يبدأ الخادم العمل. يصل التقدم. يقوم بروكسي بتخزين التدفق. يصل العميل إلى وقت انتهاءه ويتوقف الاتصال. ينتهي الخادم بعد ميل ثانية واحدة. يحاول العميل مرة أخرى مع معرف JSON-RPC الجديد. يتم تشغيل الطفرة مرتين.

كل مكونات تتصرف محلياً النظام فشل عالميًا

MCP تعريف الرسائل والسلوك النقل، ولكن تطبيقك لا يزال يمتلك:

- الميزانيات الزمنية
- عدم القدرة على العمل؛
- الصفوف المحدودة
- تصنيف التجربة المُجددة
- حالة المهمة الدائمة
- إعادة الاتصال وإعادة تعديل السياسة.

هذه الدروس تقوم ببناء تلك القرارات في محاكاة تحديدية
لا توجد أجهزة النوم أو المفاصل أو فشل عشوائي
مباشرة. اختبار خيط متزامن يفرض على عملاء دفتر التسجيلين التنافس
لنفس مفتاح الإستقلال

## طلب إلغاء هو خاصة للنقل

النية هي نفسها في كل نقل: العميل لم يعد بحاجة إلى نتيجة أثناء الرحلة.

### الاستديو

ستديو يستخدم قناة مشتركة ثنائية الاتجاه. يقوم العميل بإرسال إشعار:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 41,
    "reason": "User closed the operation"
  }
}
```

الإخطار هو النار ونسيان. الخادم لا ينشر أي رد JSON-RPC عليه.

يجب على الخادم وقف العمل، وتحرر الموارد، وتجنب إرسال رد على الطلب المحل. قد يتجاهل الإلغاء عندما يكون الطلب غير معروف أو قد انتهى بالفعل، أو لا يمكن إيقافه بأمان.

يتم تجاهل إشعارات الإلغاء غير المشكولة وغير المعروفة والتي تم إكمالها بالفعل. تحويل تلك السباقات إلى أخطاء جديدة سيخلق المزيد من السباقات.

### HTTP المباشر

يمنح HTTP المباشر الحديث كل طلب استجابة HTTP الخاصة به أو سلسلة استجابة SSE. يقوم العميل بإلغاء سلسلة استجابة هذا الطلب.

لا تنشر`notifications/cancelled`لإغلاق التيار هو إشارة إلغاء.

بمجرد أن يلاحظ الخادم انقطاع الاتصال، يجب أن يتوقف عن العمل ولا يجوز أن يرسل المزيد من الرسائل لهذا الطلب.

### الإلغاء الذي يرسله الخادم ضيق

الخادم لا يستخدم`notifications/cancelled`لتحذير مكالمات العميل التعسفي. في الاستديو، يتم احتفاظ إلغاء الخادم المرسل لإنهاء`subscriptions/listen`إبق هذه المسار منفصلة عن إلغاء طلب العميل العادي

## الإلغاء هو سباق

أمران من الحدث ساريان

### الإلغاء يفوز

```text
request starts
client sends cancellation signal
server marks request cancelled
worker reaches completion
server suppresses the response
```

### الانتهاء يفوز

```text
request starts
worker commits the result
server sends the response
cancellation arrives late
server ignores the late notification
```

يجب على العميل أيضًا تجاهل استجابة متأخرة لطلب قد تخلى عنه بالفعل. يعني تأخر الشبكة أن كلا الطرفين لا يستطيعون إثبات الحدث الذي لاحظه الطرف الآخر أولاً.

```figure
mcp-reliability-race
```

الدرس هو`RequestCoordinator`تخزين حالة واحدة من المحطة.`complete()`لا يعود أي رد بعد الإلغاء. الإلغاء المتأخر لا يمكن أن يغير سجل مكتمل.

## المواعيد تحتاج إلى ساعتين

توقيت عدم النشاط واحد ليس كافياً

استخدموا حدودين:

1. **Idle timeout.**كم من الوقت قد لا يؤدي الطلب إلى نشاط مفيد.
2. **Maximum timeout.**الميزانية المطلقة من بداية الطلب

قد يعيد التقدم إعادة تعيين الساعة العاطفة يجب ألا يزيل أقصى موعد

```text
start: 0 ms
progress: 400 ms
progress: 800 ms
progress: 1200 ms
idle timeout: 500 ms
maximum timeout: 2000 ms
```

عند 1500 ms، لا يزال الطلب نشطًا لأن آخر تقدم قدمت فقط 300 ms. عند 2000 ms، يُلغي الموعد النهائي أقصى حتى لو وصلت حدوث تقدم آخر في 1999 ms.

التقدم هو اختياري. يمكن للخادم قبول رمز التقدم ولا ينشر أي تحديثات. لا تحويل وجود رمز إلى وقت لا نهائي.

يجب أن ترتفع قيم تقدم المكافآت المعدنية. تتوقف الإخطارات بعد الانتهاء أو إلغاء. تقدم الحد السريع حتى لا يتمكن العامل السريع من تغمر النقل.

## طلب إلغاء ليس`tasks/cancel`

هذه الآليات تحلّ حياة مختلفة

| Mechanism | Target | Signal | What success means |
|-----------|--------|--------|--------------------|
| Request cancellation on stdio | One in-flight RPC | `notifications/cancelled` | Client abandoned the request; server should stop if practical |
| Request cancellation on HTTP | One in-flight response stream | Close the stream | Client abandoned the request; server should stop if practical |
| `tasks/cancel` | One durable Task | Ordinary MCP request | Server acknowledged cancellation intent |

ناجح`tasks/cancel`لا يثبت النتيجة أن العامل توقف.`working`حتى يلاحظ نقطة تفتيش العمال العلم. قد يتم الانتهاء من العمل قبل تلك النقطة.

لا تمحى حالة المهمة الدائمة عندما تغلق اتصال HTTP. السبب في إنشاء مهمة هو أن دورة عمرها تفوق طلب واحد وعلاقة واحدة.

## معرف JSON-RPC الجديد ليس إمكانية التخلّص

يرتبط هوات JSON-RPC بالطلبات والردود. لا تحدد العملية التجارية.

لنفترض أن العميل قدّم رسالة مع اسم`41`، يفقد الإجابة ، ويعود محاولة أخرى مع id `42`الخادم يرى رسالتين مختلفتين بدون مفتاح تطبيق لا يمكنه أن يعرف أنها تمثل عملية تسجيل واحدة

مفتاح الاختفاء يحدد نية العمل:

```json
{
  "name": "charge_account",
  "arguments": {
    "account": "acct-7",
    "cents": 1200,
    "idempotencyKey": "checkout-7"
  }
}
```

مخازن الخادم:

- المفتاح
- بصمة أصابع من حجج العملية
- النتيجة المطلوبة.

نفس المفتاح والحجج نفسها تعيد النتيجة المخزنة. يتم رفض نفس المفتاح مع حجج مختلفة. هذا يمنع إعادة استخدام المفتاح عن طريق الخطأ من طفرة عملية عمل مختلفة.

### يجب أن يكون الحدود الذرية ودائمة

هذا التسلسل غير آمن

```text
check key
run mutation
store result
```

يمكن للعاملين أن يلاحظوا مفتاحاً مفقوداً و يديرون الطفرة
بعد التأثير ولكن قبل أن يخلق المتجر نفس الغامضة في محاولة ثانية.

الدروس تستخدم دفتر SQLite المدعوم من الملفات. `BEGIN IMMEDIATE`يسلسل
التحقق من المفتاح، وتحاكي تأثير الأعمال التجارية، ومعدل التنفيذ، والنتائج المخزنة في
صفقة واحدة، اتصالين مستقلين في دفتر التسجيل يشاركون نفس المفتاح
لذلك، لاحظ نتيجة واحدة ملتزمة و تنفيذ واحد.
سجل الحساب يحافظ على هذا السجل

يتم إعادة بناء كل قيمة عائدة من JSON المخزنة.
الكائن المتغير الذي يحتفظ به دفتر التسجيل، لذلك لا يمكن تغيير قاموس أعيد
نتائج إعادة تشغيل بعد ذلك فاسدة.

التأثير التجاري للمحاكي هو عداد الإيصالات والتنفيذ داخل
نفس المعاملة SQLite. الدفع الحقيقي، أو نشر، أو مكالمة API الخارجية هي
لا يتم تصنيعها عن طريق كتابة جدول محلي فقط.
المعاملة المشتركة في قاعدة البيانات، صندوق خارج المعاملة المعاملة، أو مزود أعلى التيار
لا يمكن أن يكون هناك أي شيء آخر في هذا المجال.
عدة نسخ أو نجا من إعادة البدء

### المصفوفة التجريبية

تصنيف التجربات المُجددة قبل تنفيذها.

| Class | Example | Retry rule |
|------|---------|------------|
| Safe | Deterministic read with no side effect | Retry with a new JSON-RPC id after the failure boundary is understood |
| Conditional | Mutation with a durable idempotency key | Retry with the same key and identical arguments |
| Unsafe | Mutation without business deduplication | Do not retry automatically; reconcile first |

ملاحظات أداة مثل `readOnlyHint`و`idempotentHint`لا يزال الإشارات غير موثوق بها. عقد التطبيق وتنفيذ الخادم يقرر السلامة مرة أخرى.

## الضغط العكسى جزء من الصواب

إن منتج SSE يمكن أن يولد تقدمًا أسرع من يمكن لعميل أو وكيل أو شبكة استهلاكها. يصبح صف غير محدود بطءًا في استنفاد الذاكرة.

استخدم صف محدود و حدد ما يمكن أن يُضيع.

يمكن استبدال التقدم. قيمة تقدم لاحقة تحل محل سابقة لنفس الوسيلة. لا يمكن استبدال استجابة JSON-RPC النهائية.

يطبق خازن الدروس هذه السياسة:

1. وذلك من أجل التقدم المجاور
2. أوقفوا أقدم تقدم عندما تصلوا إلى القدرة
3. اشير إلى أن التيار يحتاج إلى إعادة تأهيله
4. احفظ الرد النهائي
5. رفض حالة حيث الحفاظ على الاستجابة النهائية يتطلب إسقاط استجابة نهائية أخرى.

هذه خسارة محددة مع تعافي صريح. الخسارة الصامتة ليست استراتيجية.

### الاختيار المكلف

يمكن للخادم التدفق بشكل صحيح بينما يقوم وكيل العكس بحفظ الأحداث في حافظة.

للحصول على رد من SSE، أرسل:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

توصي مواصفات HTTP المباشرة لعام 2026 `X-Accel-Buffering: no`لذا الأوكسيت الموافقة تسليم الأحداث على الفور

بالنسبة لتدفقات طويلة الأمد الهادئة، أصدري تعليق SSE بشكل دوري:

```text
:
```

العميل يتجاهل خطوط التعليقات، ويتعرف الوسطاء على حركة المرور ويحد من احتمال إغلاق اتصال عفوي.

الحفاظ على التكامل ليس تقدماً. لا تعيد تعيين وقت التوقف المفصل للعملية فقط لأن تعليق النقل قد وصل.

## إعادة الاتصال يعني إعادة الإصلاح

لا يدعم HTTP المتداول الحديث SSE المتداول عبر `Last-Event-ID`. . .

بعد`subscriptions/listen`انخفاضات التيار:

1. افتح طلب الاستماع الجديد مع معرف JSON-RPC الجديد.
2. استعادة مرشح الاشتراك المرغوب فيه.
3. إعادة أدوات، الموارد، الإشارات، أو المهام المتأثرة من طرق موثوقة.
4. وضع التطبيق المتكرر بواسطة المعرفات المستقرة.
5. لا تعيد تعديل طفرة غير آمنة فقط لأن ردّها قد فقد.

خطة استرداد العينات تحدد صراحة `sendLastEventId`و يضع قائمة بالموارد التي يجب إعادة إعادة إصلاحها

### منع إعادة الاتصال

إذا اعاد الاتصال بـ 10 آلاف عميل في ثانية واحدة، فإن الخادم الذي يسترد يفشل مرة أخرى.

استخدم الاحتفاظ بالتعريض مع jitter و a cap. يحسب الدروس الاختيار من عنوان العميل وعدد المحاولة بحيث تظل الاختبارات قابلة للتكرار:

```text
attempt 0: up to 250 ms
attempt 1: up to 500 ms
attempt 2: up to 1000 ms
...
cap: 8000 ms
```

يمكن أن تستخدم الإنتاج أمانًا رمزيًا أو عشوائية وقت التشغيل.

## بناءها

`code/main.py`يُبني خمسة مكونات صغيرة من الموثوقية.

### `RequestCoordinator`

- يبدأ طلب في رحلة الطيران مع المواعيد النهائية المحددة؛
- يصدّر إخطارات تقدم متواضعة؛
- إنتاج إشارة الإلغاء الصحيحة أو إشارة إلغاء HTTP ؛
- يتجاهل إشعارات الإلغاء غير صالحة؛
- يوضح صراحة سباقات الإلغاء والانتهاء من السباقات النهائية؛
- يحتفظ بإلغاء خدمة الإستديو

### `MutationLedger`

- يثبت أن هويات JSON-RPC تنفذ مرتين دون مفتاح عمل؛
- يستخدم معاملة SQLite المدعومة بالملف للتحقق من المفتاح، والإثارة المحاكاة،
  معداد التنفيذ، والتزاما بالنتائج؛
- يُضاعف الحجج المقابلة تحت مفتاح إزالة واحد عبر الحجج المستقلة
  وصلات الكتب الكبرى
- يرفض استخدام مفتاح واحد مرة أخرى مع حجج مختلفة.
- يعيد نسخ دفاعية ويحفظ سجلات المخطط لها عبر إعادة فتحها

### `DurableTaskService`

- يؤكد طلب إلغاء العمل؛
- يحتفظ بالمهام`working`حتى نقطة تفتيش للعمال
- يوضح لماذا الاعتراف ليس حالة نهائية.

### `BoundedSseBuffer`

- يجمع أو يقلل من التقدم تحت الضغط.
- سجلات تتطلب إعادة التأهيل المعتمدة؛
- لا يترك رد النهائي أبداً

### مساعدي الإستعادة

- إرجاع عناوين SSE الآمنة بالوكالة والتبصرات الحافظة عليها
- إعداد خطة لإعادة الاتصال وإعادة التوصيل
- التجربة المتكررة على الانتشار مع تعريضية تعريضية الظهور والارتداد.

## استخدمها

من جذور المخبأ:

```bash
cd phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

تمارس الاكتشاف على جانبي السباق المركزي، وتقوم بتنفيذ عملية
التحول المزدوج في دفتر الدراسة المؤقتة المدعومة بالملفات، يفرط في حد
مسدس التقدم ، ويعرض مهمة دائمة تتحرك من إلغاء معترف به
إلى الإلغاء الذي يلاحظه العاملون.

## المختبر التفاعلي

إدارة أربعة ترتيبات من الأحداث دون إضافة النوم.

1. أبدأ الطلب`A`، إلغاءها ، ثم الاتصال`complete()`. . .
2. أبدأ الطلب`B`، إكمالها، ثم تقديم إلغاء.
3. أبدأ الطلب`C`، إصدار تقدم قبل كل موعد فظيع، ثم تجاوز الموعد النهائي.
4. أبدأ الطلب`D`عبر HTTP المباشر و إغلاق تدفق الاستجابة

سجل لكل سيناريو:

- حالة طلب المحطة
- ما إذا كانت هناك ردة فعل نهائية.
- إشارة الإلغاء الموضعة على السلك
- أي حدث يجب أن يتجاهله العميل

ثم تغيير`D`العملية متشابهة لكن إشارة الإلغاء يجب أن تتغير

## مختبر التدريب

إضافة`reserve_inventory`التحول إلى`MutationLedger`. . .

المتطلبات:

1. المفتاح يربط SKU والكمية والمساكن، والاسم التشغيلي.
2. محاولة ثانية بنفس المفتاح ونفس الحجج تعيد الحجز الأول.
3. محاولة جديدة مع كميات غيره تفشل دون تحفظ آخر.
4. إعدام ارتكب لكنه فقد استجابته يمكن أن يتم التوفيق بينهما بمثابة مفتاح
5. النتيجة لا تسجل أي بيانات سرية أو مدفوعة.
6. يتم تعطيل إعادة المحاولة التلقائية عندما لا يقدم العميل مفتاحًا.
7. أضف قطعة اشتراك محاكاة وإعادة ضبط سجل المخزون قبل أن تقرر ما يجب القيام به بعد ذلك.
8. أبدأ اتصالين للكدّر في حاجز وإرسال نفس المفتاح
   تأكيد حجز واحد تم التزامها
9. تحوّل أول كائن احتجاز عاد، أعد المفتاح وإثبات
   النتيجة المخزنة لم تتغير.
10. أغلق وإعادة فتح ملف الكتيب، ثم استند الحجز عن طريق المفتاح.

أبقي المختبر صادقًا: إذا كان المخزون يعيش في خدمة أخرى، اشرح ما إذا كان
أن هذه الخدمة تقبل نفس مفتاح الاختيار أو ما إذا كانت صندوق إرسال صفقة
الجسور المحلية الالتزام بالفعال عن بعد.

## الأثاث المُرسل

`outputs/skill-mcp-reliability-reviewer.md`هو مهارة مراجعة موثوقية مسطحة. أعطها عملية MCP ، النقل ، سياسة التوقف الزمني ، سلوك التجربة المُجددة ، سياسة الصف ، وخطة الاسترداد. يعيد جدول السباق ، تصنيف التجربة المُجددة ، حدود الإعاقة ، فحصات مراقبة التدفق ، ومصطلحات الفشل.

## تحقق من ذلك

الدرس يكمل عندما تكون هذه التصريحات صحيحة:

- الإلغاء الإستديو يرسله`notifications/cancelled`ولا يتلقى أي رد
- إلغاء HTTP المباشر يغلق سلسلة الطلب ولا يرسل أي إلغاء POST.
- إلغاء قبل الانتهاء يضغط على الاستجابة النهائية.
- الإجابة الكاملة قبل الإلغاء تحافظ على الاستجابة وتجاهل الإلغاء المتأخر.
- التقدم يمكن إعادة تعيين وقت البطء ولكن لا أقصى وقت
- هوية JSON-RPC الجديدة وحدها تنفذ الطفرة مرة أخرى.
- مفتاح إزالة واحدة والحجج المماثلة تنفذ مرة واحدة تحت متزامن
  سباق اتصالين
- سجل مُلتزم يبقى حيّاً بعد إعادة فتحه وتُعيد إعادة تشغيل نسخة دفاعية.
- تحويل النتيجة المرجعة لا يمكن أن يغير النتيجة المخزنة.
- البفر المحدد يبقى داخل القدرة ويحافظ على الاستجابة النهائية.
- إعادة الاتصال تستخدم طلب جديد، لا ترسل `Last-Event-ID`و يعيد التأثير على الحالة
- `tasks/cancel`يترك الاعتراف المهمة غير نهائية حتى يلاحظها العامل.

## أساليب فشل الإنتاج

| Failure | Observable symptom | Correct response |
|---------|--------------------|------------------|
| HTTP client POSTs cancellation notification | Server and client disagree about request lifetime | Close the request's SSE response stream |
| Server responds after accepted cancellation | Client receives an unusable late result | Stop work and suppress further messages when cancellation wins |
| Progress resets every deadline | Hung work survives forever | Keep a separate absolute maximum timeout |
| New RPC id treated as deduplication | Charge, deployment, or deletion runs twice | Add a durable application idempotency key |
| Key check and effect are separate | Concurrent workers both observe a missing key | Commit key claim, effect record, and result atomically |
| In-memory ledger used across replicas | Restart or another worker forgets prior commits | Use shared durable storage or upstream idempotency |
| Stored mutable result returned directly | Caller mutation corrupts later replays | Serialize committed results and return defensive copies |
| Key reused with changed arguments | One key aliases two business intents | Store and compare an argument fingerprint |
| Unbounded progress queue | Memory rises with a slow consumer | Coalesce and drop replaceable progress within a bound |
| Final response dropped under pressure | Client cannot know the request outcome | Reserve capacity or evict progress, never the final response |
| Proxy buffers SSE | Progress arrives in bursts or after timeout | Disable buffering and configure compatible proxy timeouts |
| `Last-Event-ID` assumed | Client resumes from state the server does not support | Reconnect with a new request and refetch |
| Every client reconnects immediately | Recovery creates another outage | Use capped exponential backoff with jitter |
| Task ack treated as final cancellation | Worker keeps running after UI says stopped | Poll the Task until a terminal status |

## اتصال كابستون

يجب أن تعامل حجر أداة النظام البيئي الموثوقية كدليل قابل للتنفيذ، وليس فقرة في رسم هندسي.

احتاج هذه القطع الأثرية:

- نسخة واحدة من سباق الإلغاء لكل نقل
- طاولة إعادة التجربة لكل طفرة تعرضت لها
- سجل مفتاح عدم القدرة على الاستجابة والانضمام غير المتماثل؛
- نسخة متزايدة ذات المفتاح نفسه، والتحقق من إعادة فتحها، والتحقق من اسم الطفرة؛
- نتيجة زيادة الحمولة المحدودة؛
- الرؤوس SSE المُتَعَدِّلة بالوكالة العكسية والسياسة العاطفة؛
- خطة إعادة الاتصال التي تحدد طرق إعادة التوصيل المعتمدة.
- تتبع لإلغاء المهمة دائمة عندما تستخدم الحجر النهائي المهمات.

طلب أخضر في عملية محلية يثبت فقط الطريق السعيد. الحجر النهائي جاهز للإنتاج عندما تكون نتائج محددة عند فقدان الاستجابات، والإلغاء المتأخر، والإستهلاك البطيء، وإعادة ربط القطيع.

## الشروط الرئيسية

| Term | Meaning |
|------|---------|
| Request cancellation | Abandonment of one in-flight MCP request |
| Cancellation race | Competition between terminal completion and cancellation events |
| Idle timeout | Limit since the last useful request activity |
| Maximum timeout | Absolute limit from request start, unaffected by progress |
| Idempotency key | Application identifier that deduplicates one business intent |
| Atomic ledger | Durable boundary that commits the key claim, effect record, and result as one unit |
| Backpressure | Control applied when producers outpace consumers |
| Progress coalescing | Replacing older progress with a newer authoritative value |
| Refetch | Reading current state again after a stream gap |
| Jitter | Deliberate variation that spreads retries across time |

## المزيد من القراءة

- [MCP Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [MCP Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Tasks Extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
