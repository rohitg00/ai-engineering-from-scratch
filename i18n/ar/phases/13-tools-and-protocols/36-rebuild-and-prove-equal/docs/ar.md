# إعادة بناء وتثبت المساواة: اختبارات التفاوت، مقارنة البايت، ومركز الأدلة

> اجتيازك في الاختبارات يثبت توافقك على الاختبارات، لذا المساواة تحتاج إلى شبكة تصل إلى كل حافة وتتطابق بتاتها بعد تغيير الاختبارات.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## أهداف التعلم

- اكتب إعادة بناء من قائمة التعليمات و اسم سجل الدليل الذي جاء منه.
- بناء شبكة مدخلة مع فئة واحدة لكل خطر: صفر الحماية، القيم السلبية، تقسيم القص، 32 بتات إفراط، وفرق فخ.
- إشغلي الأصلي وإعادة بناءه في برنامج واحد و سجل كل خلية، بما في ذلك فخ
- إعادة بناء الإعادة مع العلامات الأصلية ومقارنة البايتات الوظيفة بعد غطاء حقل التنقل.
- اقرأ المستمرات التي يُحتوى عليها نقطة التنقل و قارنها، حتى لا يمكن أن يمر حرف خاطئ.
- إشغلي خادم MCP ريا من عميل استديو صغير و سجل كل خطوة مع هويته دليل.
- صممت سجل إثبات مغلق غير مُصادر، والذي هو هاشي على مزاعمه و روابط الأدلة.

## المشكلة

لقد طلبت من ريا ملف الوظائف`percent_change`في مجالنا`ledger-x86_64-O1.o`غيدرا 12.1.4 أعادت رمزًا مزيفًا، وكتب العميل هذا "سي" منه:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

أربعة اختبارات تمر:`(100, 150)`يعطي 50`(200, 100)`يعطي -50`(0, 5)`يعطي 0`(50, 100)`ويعطي 100 دولار، ويعيد بناء العميل أيضاً`grade`أربعة`if`ستة اختبارات أخرى تمت، ويقول التقرير "محقق"

هذا التقرير لا يجيب على أي من هذه الأسئلة:

- ما الذي يعود به الأصلي عندما`(after - before) * 100`لا يتناسب في 32 بت؟
- ما هو العودة الأصلية لدرجة 110؟
- هل يقوم الإعادة بتجميعها إلى نفس 16 بايت كما كان الأصلي؟
- عندما تكون الوظائف المجمعة تحتوي على نفس البايت، هل توضع إعادة توزيعها في نفس الثابتات؟
- من أي دليل جاءت عملية إعادة البناء، وهل قرأ العميل الإدراج أو الرمز السري؟
- ما هو الوضع الذي يحصل عليه الدليل على مضيف بدون مُحامِل C؟

كل هدف في هذا الدروس هو برنامج كتبنا و مرتبنا.

```figure
re-36-prove-equal
```

## ما تقول الأدلة

حلقة العميل في`code/main.py`لقد قمت بـ 6 مكالمات إلى 6.5.0 عبر الاستديو`code/fixtures/runs/agent-run.json`.الخادم أجاب`initialize`مع نسخة بروتوكول `2025-11-25`ثلاث مكالمات أعادت سجلات الأدلة

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

الدعوة الأولى دفعت لإستيراد "غيدرا" وتحليل ذاتي`confidence: "observed"`،`authority: "shipped-artifact"`، و SHA-256 من الكائن ،`9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`غيدرا تحميل الكائن الذي يمكن نقله`.text`في`0x100000`، لذا`percent_change`يجلس في`0x100000`و`grade`في`0x100010`. . .

الرمز السوداني لـ`percent_change`هو حيث `long`جاء من:

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{
  long lVar1;
  undefined1 auVar3 [16];
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  ...
}
```

المتحلل رأى`cltd`و`idivl`اكتب كليهما`edx`و`eax`ووضع نموذج قيمة عائدة 16 بايت مع قسم 64 بايت. القائمة في نفس السجل تقول شيئا أكثر وضوحا:

```
0x100000: TEST EDI, EDI
0x100002: JZ 0x0010000d
0x100004: SUB ESI, EDI
0x100006: IMUL EAX, ESI, 0x64
0x100009: CDQ
0x10000a: IDIV EDI
0x10000c: RET
0x10000d: XOR EAX, EAX
0x10000f: RET
```

كل عملية عرضها 32 بت`IMUL EAX, ESI, 0x64`يضاعف في 32 بت ويحافظ على النصف المنخفض`CDQ`إشارات التوسع`eax`في`edx`و`IDIV EDI`يُقسم زوج 64 بت بـ 32 بت. إعادة بناء تلي القائمة هي `100 * (after - before) / before`في`int`. . .

- نعم`grade`السجل لديه نفس الشكل. الرمز السيدو يسمي جدول،`*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`، و تعبير افتراضي لا يمكن قراءته مبني من`0x66666667`. الإدراج يظهر الانقسام بـ 10`IMUL RAX, RAX, 0x66666667`،`SAR RCX, 0x22`،`SHR RAX, 0x3f`،`ADD ECX, EAX`- إذن`ADD ECX, -0x6`،`CMP ECX, 0x4`و`JA`أبقي عشرات من 6 إلى 10.`XOR EAX, EAX`قبل مقارنة هو الاختيار الافتراضي من 0. `LEA RCX, [0x1000b4]`و`MOV EAX, dword ptr [RCX + RAX*0x4]`اقرأ جدول من خمسة إدخالات 4 بايت.

الخطوة 4 قراءة تلك 20 بايت: `01000000 02000000 03000000 04000000 04000000`الطاولة هي`1, 2, 3, 4, 4`على عشرات 6، 7، 8، 9، 10 هذا هو `switch`في`ledger.c`، مع`case 10`و`case 9`تقاسم القيمة 4.

كلتا الأدلة في صفحات الأدلة الخاصة بـ "ريا" بدأت من القائمة و من`read_bytes`أول رمز مزيف لـ "DX-Ball" كان`FUN_00406400(void)`بدون إدخال كومة، و عرض التعليمات تصحيحه. اقرأ القائمة أولا. ذكر رقم تسجيل، ثم اكتب C.

## اكتبوا المرشحين

المجلد`code/fixtures/candidates/`تحتوي على ثمانية إعادة بناء، وظيفة واحدة لكل ملف. أربعة تتبع القائمة أو تجميع إلى نفس الرمز. أربعة معقولة وغير صحيحة، أو خاطئة في الطريقة التي يجد اختبار مكتوب يدويا.

| File | Source | What it does |
|---|---|---|
| `percent_change_mul_first.c` | `100 * (after - before) / before` | the listing in C |
| `percent_change_split.c` | `(after * 100 - before * 100) / before` | different text, same bytes after clang folds it |
| `percent_change_wide.c` | `(int)(((long)after - before) * 100 / before)` | the pseudocode's `long`, divides before it wraps |
| `percent_change_div_first.c` | `(after - before) / before * 100` | divides first, so rounding differs |
| `grade_switch.c` | `switch (score / 10)` with the five cases | the original source |
| `grade_table.c` | `unsigned slot = score / 10 - 6; slot < 5 ? points[slot] : 0` | the listing in C |
| `grade_thresholds.c` | `if (score >= 90) return 4; ...` | no upper bound on the top band |
| `grade_case10_wrong.c` | `case 10: return 3;` | one table entry wrong |

كل ملف يتم تجميعه مع أمر الإعدادات ،`clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`. تم تعيين الأشياء المجمعة بجوار المصادر بحيث يتم إجراء الاختبارات على مضيف دون كلانغ

## الساق الأول: تنفيذ ومقارنة

تعريف ماكيمن لعام 1998 للتحقيق التفاضلي يحتاج إلى "نظامين أو أكثر مقارنة" تغذية "حالات الاختبار التي تم إنشاؤها بشكل ميكانيكي"، ويعامل نتيجة مختلفة، أو تعليق، أو حادث كمرشح حشيش. لقد سمى الجزء الصعب: "أسوأ مشكلة في الاختبار هو تقييم نتيجة الاختبار". نحن لا نحتاج إلى معرفة الإجابة الصحيحة. نحتاج إلى الأصلي والإعادة بناء لا يختلفون في أي مكان على شبكة التي تصل إلى كل خطر.

### تصميم الشبكة

`input_grid()`في`code/main.py`يُبني 92 خلية.`percent_change`إنه يأخذ كل زوج من عشرة`before`القيم والسبعة `after`القيم:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

لأجل`grade`يتطلب 22 نقطة: كلا الجانبين من كل حافة الفرقة، السلبيات، 0، 110، والثنين `int`الحدود`classify()`علامات كل خلية. التدفق الزائد لديه 32 خلية، سلبي 17، الحدود 14، 12 عادية، و حماية صفر 7. التخفيض السلبي لديه 5، التجويب 2، خارج المفتاح 2، والطاردة 1.

كل فئة موجودة لسبب واحد الخلايا الحارس الصفر تفتيش`TEST EDI, EDI`الفرع الخلايا السلبية تحقق تقسيم القصبة:`idiv`حول نحو الصفر، لذلك `-9 / 10`هو 0 و `-10 / 10`هي -1، الخلايا الدائرة تحقق أن الضربة تحدث قبل الانقسام، لذلك `(105 - 100) * 100 / 100`5 وليس 0. تخطي الخلايا الزائدة`(after - before) * 100`يتجاوز 32 بت. خلية واحدة تعادل المنتج الملفوف`INT_MIN`مع`before`يساوي -1.

كانغ، تشين، إيد، و ريجر بنيت Csmith لتوليد البرامج بدون سلوك غير محدد. الخلاف في النبيذ حول سلوك غير محدد هو الضوضاء ولا تقرير عن حوادث. لا يتم تعريف التفاوض الموقعة في C. النبيذ هو كائن مرتب مع سلوك ثابت واحد، لذلك الخلايا المتفاوضة في نطاق. الدروس هي معرفة الخلايا التي تعتمد على المعيار والتي تعتمد على البايتات المجمعة.

### السائق والفخ

`code/driver.c`يقرأ خلية واحدة لكل سطر من stdin ويقوم بطبع المدخلات والنتيجة الأصلية ونتيجة إعادة البناء. `build_harness()`يجمع المرشح مع `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`في المضيف لينكس x86-64 هو الأصلي هو الكائن الثابت نفسه. في أي مضيف آخر هو`ledger.c`تم تجميعها بشكل أصلي، وتسجيلات التقرير `original_kind: fixture-source`. . .

السائق يثبت جهاز`SIGFPE`المدير مع`sigsetjmp`و`siglongjmp`- لأجل`before = -1`و`after = 536870911`، الفرق هو 536870912 والنتج 32 بت تغلف إلى -2147483648 . على x86-64 ، `idiv`مع هذا الفائدة والقسم من -1 يزيد من استثناء خطأ القسم. النسبة لا تناسب في 32 بت (Intel SDM Volume 2, IDIV).`trap`. . .

على "آرك 64"`sdiv`لا يوجد فخ ويعود -2147483648 لنفس الأوبرانديات. لقد سجلت تشغيلنا على جهاز Arm64 Mac بالضبط ذلك.

### النتائج

`prove_behaviour(PLAUSIBLE)`يُبني`long`إعادة بناء، وإعادة بناء العدوان، تمرّت الحالات البرية العشر، فشلت الشبكة في 28 خلية:

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

جميع 26 `percent_change`الفشل هو تفريغ الخلايا مع `|before| > 1`- لأجل`before`يساوي 1 أو -1، يختصر النسبة 64 بت إلى القيمة الملفوفة، لذلك تتفق هذه الخلايا عن طريق الخطأ.`grade`فشل لأن المفتاح الأصلي لا يحمل أي قضية لعشرات من 11 و فوق، و `110 / 10`هو 11

`prove_behaviour(EQUAL)`يُبني`percent_change_mul_first.c`و`grade_switch.c`جميع الخلايا 92 توافق.`percent_change_div_first.c`فشلت في اثنين من الحالات البرية الأربعة، وهي الحالة الوحيدة التي يكتشفها اختبار مكتوب يدوياً.

`oracle_disagreements()`يُحقق من شيء آخر.`percent_change_model()`و`grade_model()`هي نماذج Python في القائمة، مع `wrap32()`للـ 32 بت مضاعفة و `idiv32()`للقاعدة الهندسة المعمارية. تقارن التقرير النموذج مع الأصلي الملاحظ على كل خلية. صفر الخلافات يعني أن النموذج والبائنري يتفقون على كل خلية. النموذج هو دليل مشتق والجري دليل الملاحظ. يحتفظ التقرير بهم في مجالات منفصلة.

## الساق الثانية: إعادة التجميع ومقارنة

سلوك على شبكة هي ساق واحدة. يسأل الجانب الثاني ما إذا كان إعادة البناء ، التي تم تجميعها بنفس المكوّن والعلامات ، تنتج نفس البايتات. أفاد مشروع DX-Ball "63 بايت متطابقة" لمساعدته. أفاد مشروع TH04 بمطابقة 2,139 بايت. كل واحد استخدم المكوّن من فترة خاصته. لا يمكن أن تفعل ذلك نفسها.`compare_functions`نص مزود التفرقات الخطية ورفق القيود "التجميع هو نص مزود غير شفاف؛ تعاديل التنقل غير متوفر".

### اقرأ الموضوع

`ElfObject`في`code/main.py`يقرأ كائن ELF64 قابل للتنقل مع `struct.unpack_from`إنه يُحقق من السحر، من الفئة ذات الـ64 بت، من البيانات الصغيرة،`e_machine`62، و `e_type`ثم يمر الرأس القسم، طاولة الخيوط،`.symtab`وكل`.rela`في القسم. في الجهاز،`percent_change`يبدأ في`.text`تعويض 0 مع الحجم 16 و `grade`في`0x10`بحجم 46`total`يبدأ في`0x40`مع الحجم 31 و `grade_label`في`0x60`مع الحجم 63

الـ16 بايت من `percent_change`هل هي`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`. لا يوجد أي إعادة التنقل`grade`لديه واحد: تعويض`0x26`داخل الوظيفة، النمط `R_X86_64_PC32`الرمز`.rodata`، إضافة`0x10`إنه ينتمي إلى 7 بايت`leaq`في التكافؤ`0x23`، والتي تكون أربعة بايت الأخيرة حقل التنقل

### القناع، ثم مقارنة السجلات

في كائن RELA يعيش الإضافة في سجل الإنتقال، والحقل الأربعة بايتات هي صفر.`grade_switch.o`يحتفظ أيضاً بالصفر هناك. يمر بايت موازنة بسيطة بينما يتم نقل المواقع إلى أماكن مختلفة. `mask_relocations()`يُصفر الحقل على جانبي الأمر على أي حال، لذا فإن نفس الطريقة تنطبق على كائنات REL وبالنسبة إلى ماخ-أو، حيث يحمل الحقل الإضافة.

إذن`prove_bytes()`يُقارن سجلات التنقل حسب قسم التعويض والطراز والقسم المستهدف.`.rodata+0x10`ويقول المرشح`.rodata-0x4`. الاضافة تختلف لأن الموضوع المرشح لا يحتوي على`labels.rel`طاولة أمام طاولة المفتاح. إضافة مختلفة هي تعويض مختلف، وليس وظيفة مختلفة.

### اقرأ المستمرات نقاط التنقل في

بالنسبة لحقل ذي علاقة بالجهاز الذي ينتهي إرشاداته، يضيف المعالج عنوان الإرشاد التالي، لذلك الهدف هو الرمز بالإضافة إلى الإضافة بالإضافة إلى 4.`.rodata+0x14`، وفي المرشح هو`.rodata+0x0`. .`read_table()`يقرأ خمسة إدخالات 4 بايت هناك. كلاهما يحمل`1, 2, 3, 4, 4`. . .

العد الخامس يأتي من القائمة:`CMP ECX, 0x4`مع`JA`يسمح بالمعايير 0 إلى 4، و `[RCX + RAX*0x4]`يقرأ 4 بايت لكل مؤشر`CLAIMS`في`code/main.py`سجلات تشكيل `grade`و سجل صفر عمليات نقل`percent_change`. . .

هذه الخطوة موجودة بسبب خطأ تم توثيقه في مشروع TH08. تم تقييمها في وقت سابق "استعادة عنوان الهدف إلى حقل نقل التعليمات ، ثم مقارنة بايت التعليمات دون التحقق من البيانات اللاتبية العائمة في هذا العنوان. مصدر `0.0`ويمكن أن يبدو بالضبط ضد الهدف`128.0`." تمت مراجعة 1548 مرجعية حرفية عائمة وتصحيح اثني عشر آخرين. `grade_case10_wrong.c`هو نسختنا من هذا الخطأ. 46 بايت رمزها يساوي الأصلي، سجل إعادة التنظيم له نفس الشكل، و جدولها هو`1, 2, 3, 4, 3`فقط التحقق المستمر يفشل

### النتائج

| Candidate | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 vs 16 | equal | none | none | pass |
| `percent_change_split` | 16 vs 16 | equal | none | none | pass |
| `percent_change_wide` | 16 vs 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 vs 18 | size differs | none | none | fail |
| `grade_switch` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_table` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_thresholds` | 46 vs 39 | size differs | 1 vs 0 | none | fail |
| `grade_case10_wrong` | 46 vs 46 | equal | same shape | `1,2,3,4,4` vs `1,2,3,4,3` | fail |

نتيجة تستحق النظر ثانية`percent_change_split.c`يحتوي على نص مصدر مختلف ومقاطع متطابقة ، لأن Clang يعالج التخطيط الموقع على أنه غير محدد ويقوم بتثبيت `after * 100 - before * 100`إلى واحد مضاعفة.`grade_table.c`يطابق أيضاً بايت بـ بايت، لذا وصل المُجمّع إلى نفس الجدول من مؤشر صفوف و من `switch`. يثبت مطابقة البايت أن هذا المجمع، مع هذه العلامات، أنتج نفس الشفرة من المرشح.

الحجم هو تشخيص وليس قبول. صفحات دليل ريا تسجل 1825 بايت مرشح مع طول صحيح و 467 بايت مختلفة.`wide`إعادة البناء هو 26 بايت لأن `movslq`،`imulq`،`cqto`و`idivq`لقد تم تحديد عرضها قبل أي تجميع

## العميل يُحلق فوق الواقع

خمسة وستين من أدوات MCP rea لا تمتلك أي أمر CLI، و `verify_reconstruction`هو واحد منهم.`McpStdioClient`في`code/main.py`هو أصغر عميل يصل إليهم.`npx -y rea-agents@6.5.0 mcp`، يكتب طلب JSON-RPC واحد لكل سطر إلى stdin ، ويقرأ كائن JSON واحد لكل سطر من stdout على حلقة.`initialize`مع نسخة بروتوكول `2025-11-25`، ثم`notifications/initialized`، ثم`tools/call`. الموعد النهائي الافتراضي لكل مكالمة هو 330 ثانية، نفس الرقم الذي يسمح بدء غيدرا بارد.

`agent_loop()`يقوم بالست مكالمات وتسجيل كل واحدة:

```json
{
  "step": 2,
  "tool": "analyze_function",
  "arguments": {"procedure": "percent_change"},
  "seconds": 6.31,
  "is_error": false,
  "evidence_id": "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd",
  "confidence": "observed",
  "authority": "shipped-artifact",
  "limitations": ["Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.", "..."],
  "result_sha256": "..."
}
```

يتم تخزين سجلات الأدلة الكاملة تحت هوياتهم في نفس الملف.`table_address()`يجد`LEA`و العمل في`grade`إدراجها وتغذيتها`read_bytes`. .`open_binary`،`get_evidence_bundle`و`close_binary`لا يعيدون سجل الأدلة ويُسجلون مع هوية صفراء.

`run_agent(live=True)`تحركات ريال عندما `npx`هو على الطريق و`GHIDRA_INSTALL_DIR`اسم دليل، وإلا فإنه يعيد تعيين العرض ويقول ذلك على stderr. الاختبارات تذهب خطوة أخرى. `code/tests/fake_rea_server.py`هو خادم بديل يرد على كل`tools/call`مع سجل المسجل لنفس الأداة والحجج. العميل والحلقة تعمل على مواجهته في كل تجربة، دون إثارة rea، Ghidra، أو Java.

### ما يمكن ومصادق "ريا" أن يقوله

ريا `verify_reconstruction`يستخدم الدليل والإرجاعات المترتبة على المعلومات المقدمة أو غير المعروفة لكل مطالبة. يقرأ قيودها الثابت "المرور يعني كل مطالبة مدعومة تم ترتيبه؛ فإنه لا يحدد مساواة التنفيذ العالمية".`compare_functions`. تُقارن ادعاء سلوكية اثنين من عمليات التقاط المسجلة من`compare_process_captures`عندما يكون سجل المصدر غير مكتمل في تغطية المكالمات، فإن المطالبة بشأن المكالمات هي`unknown`لا شيء داخل ريا يجمع وظيفة أعاد بناؤها أو يديرها على شبكة المدخل الخاص بك.

سجل الالتزامات لـ rea يتوقع سجل إثبات مع `predicate_type: "rea.reconstruction-proof"`،`operation: "verify_reconstruction_obligations"`،`confidence: "observed"`و`normalized_result.passed === true`لا توجد أداة حقيقة عامة تنبعث منها`build_proof()`في`code/main.py`يُصنع:

```json
{
  "predicate_type": "rea.reconstruction-proof",
  "operation": "verify_reconstruction_obligations",
  "confidence": "observed",
  "authority": "controlled-replay",
  "normalized_result": {
    "passed": true,
    "status": "pass",
    "claims": [
      {"claim_id": "percent_change.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "percent_change.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "grade.referenced-constants", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]}
    ]
  },
  "evidence_links": ["ev_e88b10dc...", "ev_67b6d3f9..."],
  "evidence_id": "ev_..."
}
```

الهوية هي`ev_`بالإضافة إلى SHA-256 من السجل دون الهوية، على المفتاح المرتبة JSON. `aggregate()`يتم إغلاقها بشكل غير فعال: `fail`فازت، إذاً`unknown`و قائمة دعم فارغة هي`unknown`على مضيف بدون مُحامِل C ، فإنّ مزاعم السلوكين هي`unknown`، لذا السجل يقول`unknown`حتى عندما تمر كلتا الطلبين`authority`هو`controlled-replay`، لأن الدليل يأتي من قناعةنا وليس من ملف الكائن وحده.

## ما يقول البحوث

قياس ليو وراف وميسينسكي ثمانية أنظمة إزالة التجميع في تسعة تكوينات في عام 2026. لا يزال المرشحون الذين اجتازوا كل اختبار يضمينه المعيار المرجعي مختلفين عن المدخلات المضطربة. كان هذا النسبة 4.9 بالمئة بشكل عام و 13 بالمئة في نظام واحد على 300 وظيفة مكتبة غيتهوب و 287 وظيفة أساسية على CVE، أشد نموذج التحسين رفع معدل بناء غيدرا من 75 في المائة إلى 90 في المائة. على نفس الوظائف انخفض معدل التطابق السلوكي من 74% إلى 62%. لقد تعقبوا السبب إلى الحقول والمختلفات والحراس التي تم اختراعها، والتي استبدلت المجهولات المرئية التي يتركها المتحلل التقليدي.

لدينا`percent_change_wide.c`هو واحد من تلك الأنواع المخترعة.`long`تم إعادة بناءها ، وأحرزت النتيجة ، اجتازت عشرة اختبارات ، وفشلت 26 خلية تجاوزية. إعادة بناء العدالة هو حارس مخترع. كل منهما يمكن إعادة تنفيذها بموجب مقياس LLM4Decompile ، الذي يعيد تجميع الناتج ويجري تأكيدات المعيار المرجعي. اجتاز جيدرا نفسه السيدو-C 20.12٪ من تلك التأكيدات على HumanEval-Decompile.

قام DecompileBench بقياس 23400 وظيفة من 130 برنامجًا حقيقيًا. وجد أن أساليب LLM أقل بـ52.2 في المائة على دقة الوظائف من المفكّر الصناعي ، مع درجات تفهمية أعلى.

الأدلة الثلاثة التي تستخدمها الحقل هي الساقين الثلاثة التي يمكنك بناؤها. فينيكس و دريم أعادوا تجميع الناتج وتشغيل اختبارات البرنامج الأصلي. ماكيمن وسميث يديرون المدخلات المولدة ضد الأصلية مع المدخلات التي يتم احتفاظها داخل السلوك المحدد. رامس وإنجلر يبحثون عن وظائف C مع تنفيذ رمزي محدود، مما يثبت المساواة على جميع المسارات المستكشفة حتى حجم المدخل. هذه الدروس تبني الاثنين الأولين الثالث هو مختبر التدريب في دفتر الدليل في الدروس 35 عندما تكون الشبكة صغيرة جداً للاثقة.

## بناءها

أستخدم الحزام المعتاد للمكتبة

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
```

مع كلانغ على المسار، يقوم التجربة بتجميع كل من أزواج المرشحين وتشغيل 92 خلية لكل منهما. فإنه يعيد تجميع ثمانية مرشحين، ويعيد تشغيل العميل، ويختم سجل الدليل. دون كلانغ يقرأ الأشياء الملتزمة ويبلغ عن ادعاءات السلوك على أنه`unknown`. . .

الشكل المتوقع على جهاز arm64 Mac:

```json
{
  "host": "aarch64 Darwin",
  "originalKind": "fixture-source",
  "gridCells": 92,
  "plausible": {"naivePassed": true, "gridMismatches": 28, "oracleDisagreements": 0},
  "equal": {"naivePassed": true, "gridMismatches": 0, "oracleDisagreements": 0},
  "legTwo": {
    "percent_change_mul_first": {"status": "pass", "reasons": []},
    "percent_change_wide": {"status": "fail", "reasons": ["size 16 vs 26 bytes"]},
    "grade_case10_wrong": {"status": "fail", "reasons": ["referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"]}
  },
  "agentRun": {"mode": "replayed fixture", "server": {"name": "rea", "version": "6.5.0", "protocolVersion": "2025-11-25"}},
  "proof": {"status": "pass", "evidence_id": "ev_..."}
}
```

اقرأ`code/main.py`في هذا الترتيب:

1. `wrap32()`،`c_div()`،`idiv32()`، والثنين`*_model()`المهام تحتوي على تعبيرات الأرقام الكاملة في القائمة.
2. `input_grid()`و`classify()`بناء وتسمية الخلايا 92
3. `build_harness()`و`execute()`قم بتجميع برنامج واحد من الأصلي، والمرشحين الذين تم تغيير أسمائهم، و `driver.c`ثم تشغيل الخلايا
4. `prove_behaviour()`يعيد تقرير الجانب الأول مع عدم المطابقة والاختلافات في النموذج.
5. `ElfObject`يقرأ العناوين والرموز`.rela`السجلات`mask_relocations()`و`read_table()`إعداد المقارنة.
6. `prove_bytes()`يعيد تقرير الساقين مع الأحجام والمناطق المخفية وشكل الإنتقال والجدوليات.
7. `McpStdioClient`و`agent_loop()`القيادة الحقيقية وتسجيل كل خطوة.
8. `build_proof()`و`aggregate()`لا يوجد سجل مغلق

## استخدمها

لإثبات أن وظيفة جديدة متساوية، كرر هذه الخطوات:

1. أحضر`analyze_function`و سجل هوية الدليل. اقرأ القائمة قبل الرمز السوداوي.
2. اكتب المرشح من عرض العملية في القائمة. احتفظ باسم الوظيفة الأصلية.
3. قم بإدراج كل مضاعفة، و أضف، و استبعاد، و تقسيم في القائمة. أضف مدخلات الشبكة التي تغلف كل واحد على عرضه.
4. إضافة كلا الجانبين من كل ثابت مقارنة في القائمة.`grade`تلك كانت 6 و 4 بعد الخسارة
5. أضف كل مقسم يمكن أن يقع على الهدف، وتسجيل أي بنية كانت تعمل على الشبكة.
6. إذهب على كلتا الساقين وقرأ الأسباب قبل الحالة
7. أبقوا سجل الدليل بجانب المرشح`evidence_links`أخبر القارئ على أي سجل يستند المطالبة.

إعادة تشغيل كلتا الساقين بعد أي تحديث للمؤلف. تعادل البايت هو بيان عن مُؤلف واحد مع مجموعة واحدة من العلامات.

## المختبر التفاعلي

### المختبر (أ): النموذج والعمل

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

أركض

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

المكالمة الأولى تُعطى -133، المنتج المُغلف مقسم على 3.`'trap'`والثالث يعطي -2147483648 . ويقول التقرير ان 10 حالات ساذجة تمت و 28 خلية شبكة فشلت`report.oracle_disagreements`قائمة فارغة

### المختبر ب: قراءة الكائن

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

البايتات في الحقل هي `00000000`أسماء الإنتقال`.rodata`مع إضافة`0x10`، و الطاولة تقرأ`[1, 2, 3, 4, 4]`. . .

### المختبر C: كسر ثابت واحد

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

المقاطع تتطابق، السجلات تتطابق، والجداول لا. الآن تحرير `grade_case10_wrong.c`لذا`case 10`يعود 4 مرة أخرى ، أعيد تجميعه مع أمر العدالة ، ومشاهدة تغيير الحالة إلى `pass`. . .

### المختبر D: محرك

مع ريال 6.5.0 وGhidra 12.1.4 مثبتة:

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
npx tsx code/main.ts --live
```

الأول`analyze_function`يستغرق الأمر عدة ثوان بينما تقوم Ghidra باستيراد الكائن. مقارنة أرقام الأدلة الجديدة مع الجري الملتزم. نفس البايتات تحت نفس ملف التحليل تعطى نفس الأرقام، لأن أرقام الأدوية هي hash المحتوى الذي يستبعد مسار الملف.

## مختبر التدريب

تمدّ كلّ الساقين إلى`total`و`grade_label`من نفس الكائن

المتطلبات:

- لأجل`total`إنشاء الخلايا مع عدد 0، عدد سلبي، عنصر واحد، وجملة التي تغلف في 32 بت.
- لأجل`grade_label`، الدعوة الوظيفة`grade`في الخط ويقرأ`labels.rel`، جدول من خمسة تعويضات سلسلة نسبية مع عمليات إعادة توطين خاصة بها في `.rela.rodata`. . .
- إضافة`CLAIMS`الإدخال`grade_label`مع إعادة التنقلين و جدول من خمسة إدخالات 4 بايت، ومقارنة السلاسل التي تُؤكد الإدخالات.
- سجل الخلايا التي يختلف النموذج والجولة فيها، إذا كان هناك، ويشرح كل منها من القائمة.
- إضافة ادعاء واحد لكل قدم لكل وظيفة إلى سجل الدليل والحفاظ على الإجمالي مغلق.

النجاح يعني أن سجل الدليل يضع قائمة بأربعة وظائف، كل ادعاء يحمل رقم الدليل، و`grade_label`يفشل عندما تختلف سلكة العلامة.

## المختبر المعدل

خمس أسئلة حول أجهزة هذا الدروس. ابحث عن كل إجابة مع الرمز الذي بنيته، ثم اكتبها في`code/lab_answers.json`. اكتب الأرقام بأرقام أو بأسلسلسلة شماسية مثل`"0x40"`، والقوائم كقوائم JSON.

1. `t1`: %_change_model(3, 105) على x86_64.
2. `t2`: percent_change_model(0, 5) على x86_64.
3. `t3`: grade_model ((100).
4. `t4`: عدد الخلايا في input_grid().
5. `t5`: عدد الخلايا الشبكة التي يقع فيها نموذج x86_64.

تحقق من إجاباتك:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
npx tsx code/lab.ts
```

يقوم المحقق بحساب كل قيمة متوقعة من `code/main.py`على الأجهزة المشتركة.`PASS`،`FAIL`أو`TODO`لكل مهمة و نسبة، و يخرج من 0 فقط عندما يمر الخمسة`python3 code/lab.py my-answers.json`يبحث عن ملف آخر`code/tests/test_lab.py`يثبت أن المحقق يقبل الإجابات الصحيحة ويرفض الإجابات الخاطئة.

### أشاهدها تسير

- نعم[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)هذه الدروس هي الخطوة التي تحول هذه المطالبة إلى واحدة معتدلة.

## مهارات الناتج

هذا الدرس يُنتج`outputs/skill-rebuild-and-prove-equal.md`. استخدمها لتحويل دليل الوظيفة وإعادة بناء المرشح إلى دليل على قدمين وسجل دليل. تتطلب المهارة إدراج قبل الرمز الخبيث، وشبكة مع كل فئة خطر، وتعويض التخفيضات بالإضافة إلى فحص ثابت، وجميع مغلق.

## تحقق من ذلك

إشغال التجربة التجريبية و مجموعة الاختبار:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

الاختبارات الـ35 تثبت:

- `c_div()`يختصر نحو الصفر و `wrap32()`يتبع إضافة اثنين
- النموذج يعطي -133 ل `(3, INT_MAX)`،`trap`للخلية الخدعة على x86-64 و -2147483648 على AArch64
- الشبكة لديها 92 خلية و كل فئة خطرة، والحالات البغيضة تتجنب كل فئة صعبة
- يجد قراءة ELF أربعة وظائف في التداعيات والحجم المسجلة
- `percent_change`هو 16 بايت بدون إعادة التنقل و `grade`لديه واحد`R_X86_64_PC32`في`0x26`
- إن حقل التنقل هو صفر و لا تغير التخفيض شيء في هذا جسم RELA
- جميع المرشحين المتعهدين الثمانية يصلون إلى الوضع المتوقع، مع الأسباب المسجلة
- `grade_case10_wrong`يمر بثبات مخفي و يفشل فقط في التحقق المستمر
- المشاركات المسجلة في الساق الأولى تظهر عشرة مرّات ساذجة، 28 عدم مطابقة، و صفر الخلافات النموذجية
- مع محفز، كل من الزوجين إعادة بناء وإعادة تشغيل مع نفس النتيجة
- الوكيل يدير أهداف الكائن الملتزم به من خلال SHA-256 ، في الترتيب ، مع `ev_`أوراق الهوية على كل خطوة من الأدلة
- الموقع`read_bytes`السجل يساوي الجدول الذي يجده قارئ ELF
- العميل يدير الخادم المزيف ويستسجل نفس هويات الأدلة التي تم تشغيلها الحقيقية
- نتيجة خطأ من الخادم تذهب إلى سجل التشغيل
- `aggregate()`يتم إغلاقها بشكل غير صحيح وتقوم الهوية الإثباتية بإعادة الحساب من محتوياتها

## أساليب فشل الإنتاج

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Rebuild keeps the decompiler's `long` | "ten tests pass" | 26 overflow cells differ from the original |
| Thresholds replace a switch | "every grade band passes" | 110 and larger return 0 in the original |
| Divide before multiply | "formula is algebraically equal" | rounding cells differ, naive cases fail |
| Trap cell skipped | "no crashes" | x86-64 raises `#DE`, AArch64 returns `INT_MIN`, the report names the host |
| Byte compare without masking | "bytes equal" | relocation records name different offsets |
| Masking without reading constants | "bytes equal after masking" | `1,2,3,4,3` differs from `1,2,3,4,4` |
| Size taken as acceptance | "same length" | differing bytes inside the same length |
| Different compiler or flags | "bytes differ, rebuild wrong" | the same source gives different bytes, so the compare is void |
| Model treated as observation | "model agrees" | the run is observed, the model is derived, disagreements are listed |
| Claim without evidence id | "verified" | every claim links an `ev_` record of the function it covers |
| No compiler on the CI host | "passed" | behaviour claims are `unknown` and the aggregate is `unknown` |
| Pseudocode read as source | "decompiler says long" | the listing shows `IMUL EAX`, `CDQ`, `IDIV EDI` |

## قاعدة العمليات

اكتب إعادة البناء من القائمة وسمي السجل الذي جاء منه. قم بتشغيله ضد الأصلي عبر شبكة تغطي كل متوسطة وتعبر كل ثابت مقارنة. قم بتجميعه مع العلامات الأصلية، و قم بتغطية حقل الترحيل، ومقارنة السجلات، وقراءة الثوابت التي تشير إليها. سجل كل ادعاء مع معرفه الدليل، ودع ادعاء غير مؤكد يبقى مجهولا.

## المزيد من القراءة

- [McKeeman, Differential Testing for Software, Digital Technical Journal 10(1), 1998](https://www.cs.tufts.edu/comp/150FP/archive/bill-mckeeman/DifferentailTesting.pdf)
- [Yang, Chen, Eide, Regehr, Finding and Understanding Bugs in C Compilers, PLDI 2011](https://doi.org/10.1145/1993498.1993532)
- [Ramos, Engler, Practical, Low-Effort Equivalence Verification of Real Code, CAV 2011](https://doi.org/10.1007/978-3-642-22110-1_55)
- [Schwartz, Lee, Woo, Brumley, Native x86 Decompilation Using Semantics-Preserving Structural Analysis, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026](https://arxiv.org/abs/2609.05370)
- [Gao et al., DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Tan et al., LLM4Decompile, arXiv 2403.05286, 2024](https://arxiv.org/abs/2403.05286)
- [System V gABI, Chapter 4, Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)
- [x86-64 psABI repository, relocation types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV](https://developer.arm.com/documentation/ddi0487/latest)
- [rea 6.5.0 MCP contracts](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/mcp-contracts.md)
- [rea 6.5.0 reconstruction obligation ledgers](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/reconstruction-obligation-ledgers.md)
