# خارج الشفرة الأصلية: Python ، JVM ، .NET ، و WebAssembly Bytecode

> ملف رمز البايت هو برنامج بالإضافة إلى ملاحظات المُحامِل حول ذلك، وهذه الدروس تُبني القراء التي تُظهر أي ملاحظات كل حاوية تحتفظ بها.

**Type:** Build
**Languages:** Python, TypeScript, Java, C#, WebAssembly text
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow)
**Time:** ~150 minutes

## أهداف التعلم

- اقرأ 16 بايت `.pyc`العنوان من PEP 552 و إزالة الرمز من الكود دون `marshal`الوحدة، للملفات التي كتبها أربعة إصدارات مترجم.
- تحليل ملف فئة JVM من JVMS الفصل 4: مجموعة ثابتة، الحقول، الأساليب، `Code`الصفة الثانية`javac -g`يضيف
- تفكيك رموز JVM في `Ledger.class`و إثبات الإدراج ضد`javap -c`على أربعة بناءات من نفس المصدر
- اقرأ قسم وحدات WebAssembly قسمًا بعد قسم ، و فك كل جسم وظيفة ، و أثبت النتيجة مقابل `wasm-objdump -d`. . .
- قم بتنقل البيانات المعدنية ECMA-335 من مجموعة .NET من دليل البيانات PE إلى `MethodDef`الصفوف و CIL لكل طريقة، والتحقق من مكتبة القارئ التي تستخدم ILSpy.
- قياس، لعمل واحد في خمسة حاويات، أي أسماء وأنواع، وهيكل التحكم كل تنسيق يحتفظ بها والتي تفقدها.

## المشكلة

لقد بنيت`ledger.py`ووجدت`ledger.cpython-314.pyc`في`__pycache__`سألت العميل ما الذي يحتوي عليه الملف، قام العميل بإجراء عملية تحليل، طبعت الأداة`Unsupported opcode`وخط يقول`# WARNING: Decompyle incomplete`وخلص العميل إلى أن الملف قد تم التشويش عليه

الملف لم يُغمض، أول بايتين لهما`2b 0e`، الكلمة 3627 . هذا هو الرقم CPython 3.14 يكتب، وتوقف جداول الكود الاكتتاب في 3.13. كانت الأداة قديمة. وكيل لم يقرأ الرأس، لذلك لم يتمكن من معرفة الفرق.

دراسة 33 أظهرت ما يفقد الرمز الأصلي: أسماء المعلمات، الأنواع، والـ `switch`أصبح هذا طاولة قفزة حاويات رمز البايت تفقد أقل، وكل واحد يفقد شيئا مختلفا. الـ (بايك) يحافظ على كل اسم متغير ولا يوجد نوع ملف الفئة يحفظ النماذج والأسماء المحلية فقط عندما تسأل. وحدة "وازم" تحتفظ بهيكل التحكم وتسقط الأسماء ما لم يحملها قسم مخصص. يحتفظ الجمعية .NET بأسماء المعلمات في الجدول ويترك الأسماء المحلية إلى ملف منفصل. لا يمكنك تحكم في نتائج المتحلل على أي منها حتى تعرف من الملاحظات كان الحاوية لبدء.

هذه الدروس تبني أربعة قراء في مكتبة Python القياسية. كل واحد يقرأ الحاوية من أول بايت، ويرسل وظيفة واحدة، ويتم التحقق من أداة النموذج الخاصة على الأدوات التي قمت ببناءها.`grade`من`ledger`جنبا إلى جنب في جميع الحاويات الخمسة

```figure
re-43-five-containers
```

## الرأس هو أربعة كلمات

تعريف PEP 552 الرأس بأربعة كلمات 32 بت. الأول هو الرقم السحري. الثاني هو حقل بيت. مجموعة بيت 0 تعني الملف على أساس الهاش. مجموعة بيت 1 تعني `check_source`: المترجم يضغط المصدر عند الاستيراد ويقارن. مع بيت 0 واضحة، الكلمات الثالثة والرابعة هي mtime المصدر وحجم المصدر. مع مجموعة بيت 0، فإنها تحتوي على SipHash 64 بت من المصدر.

العدد السحري يعيش في`Include/internal/pycore_magic_number.h`قاعدة من 3.11 هي أن Python 3.n تبدأ عند 2900 + 50n ، وكل تغيير في رمز البايت داخل دورة الإصدار يضيف واحد. الوهم المخزن هو رقم 16 بت متبوعا`\r\n`3،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،5،

الأجهزة تحتوي على ملفات بيك لكل مترجم`compile_pyc.py`كتبهم مع`py_compile.compile(..., dfile="ledger.py")`حتى يكون اسم الملف المحفوظ`ledger.py`وليس مسار آلة البناء أول 16 بايت من الملفات 3.14:

```text
checked-hash   2b 0e 0d 0a  03 00 00 00  c7 16 c7 fc c5 1d 81 01
timestamp      2b 0e 0d 0a  00 00 00 00  8d 60 cf 6a  f1 01 00 00
```

اقرأ رأس العلامة الزمنية كلمة بعد كلمة`03 00 00 00`أو`00 00 00 00`هو كلمة العلم`8d 60 cf 6a`هو 0x6acf608d = 1791975565, mtime من `ledger.py`عندما تم بناء الملف`f1 01 00 00`هو 497، حجم المصدر. الملف المحقق من الهاش يحمل العلامات 3 وثمانية بايتات الهاش بدلا من ذلك. يوافق المترجمون الأربعة على كل شيء في العنوان باستثناء الكلمة السحرية:

| Interpreter | Magic bytes | Word | File bytes | `grade.co_code` bytes | `grade` instructions |
|---|---|---|---|---|---|
| 3.11.14 | `a7 0d 0d 0a` | 3495 | 1054 | 80 | 31 |
| 3.12.12 | `cb 0d 0d 0a` | 3531 | 937 | 62 | 26 |
| 3.13.12 | `f3 0d 0d 0a` | 3571 | 943 | 70 | 26 |
| 3.14.6 | `2b 0e 0d 0a` | 3627 | 965 | 96 | 35 |

`read_pyc_header()`في`code/main.py`يعيد هذه الحقول ويعطي الاسم للنسخة من الكلمة. `importlib.util.MAGIC_NUMBER`يعطي نفس أربعة بايتات للمترجم الجاري. `python3 code/main.py compare`يجمع المصدر مع كل `python3.11`إلى`python3.15`وجدت على`PATH`لكل منها يطبع الرأس الذي يراه قارئنا بجانب الحقائق التي يبلغ عنها المترجم عن نفسه

## مارشال يكتب الرمز موضوع الحقل حسب الحقل

البايت 16 من كل جهاز هو `e3`هذا هو`0x80 | ord('c')`: رمز النوع المرجعي لشيء رمز مع `FLAG_REF`مجموعة، التي تخبر القارئ لتذكر الكائن لاحقا `r`المرجحات. الوثائق المرجعية تقول أن النموذج غير مُوثق بشكل متعمد وأن كود الأشياء غير متوافقة بين الإصدارات. كلاهما صحيحان، والنموذج لا يزال صغيرًا بما فيه الكفاية للقراءة. `Python/marshal.c`يصف رموز النوع: `N`لا أحد`i`إدخال 32 بت، `s`البايتات`z`و`Z`سلسلة ASCII قصيرة`(`و`)`أضعاف`c`كائن رمزي، `r`إشارة خلفية، يحجز الحاويات مساحة الإشارة أمام أطفالهم، لذا يقوم القارئ بنفس الشيء.

`w_complex_object()`يكتب كود كائن في ترتيب ثابت. بالنسبة 3.11 إلى 3.15 هو `argcount`،`posonlyargcount`،`kwonlyargcount`،`stacksize`،`flags`بـ 32 بت، ثم `code`،`consts`،`names`،`localsplusnames`،`localspluskinds`،`filename`،`name`،`qualname`كجسام، ثم `firstlineno`، ثم`linetable`و`exceptiontable`. فك رمز الوحدة كود كائن ملف 3.14 يدويا من بايت 17:

```text
00 00 00 00   argcount 0
00 00 00 00   posonlyargcount 0
00 00 00 00   kwonlyargcount 0
01 00 00 00   stacksize 1
00 00 00 00   flags 0
f3 22 00 00 00   type 's' with FLAG_REF, 34 bytes of co_code follow
80 00  52 06  74 00  52 01  17 00  74 01 ...
```

إن بايتات الرمز اثنان لكل تعليم: `80 00`هو`RESUME 0`،`52 06`هو`LOAD_CONST 6`،`74 00`هو`STORE_NAME 0`و`17 00`هو`MAKE_FUNCTION`. في القائمة 3.14 في الأجهزة الطباعة نفس البيانات الخمسة على مستوى الوحدة. بعد `code`يأتي الثابتات، التي تحتوي على أربعة كائنات رمزية مستوى، وبعد ذلك `names`: `('LABELS', 'percent_change', 'grade', 'total', 'grade_label')`. . .

`Unmarshaller`في`code/main.py`يقرأ هذا التخطيط والقديم الذي استخدم 3.9 و 3.10، حيث `nlocals`،`varnames`،`freevars`و`cellvars`كانت حقل منفصلة.`CodeObject`مع نفس أسماء الصفات التي يمتلكها الكائن الحقيقي.`varnames`الصفائح`localsplusnames`من قبل`CO_FAST_LOCAL`قليلاً`localspluskinds`- لأجل`grade`في كل ملف من الملفات الأربعة التي يعود بها`('score', 'bucket')`،`firstlineno`10، و غير فارغ `linetable`- الاختبار`test_unmarshaller_agrees_with_the_running_interpreter`يُقارن كل مجال مع`marshal.loads()`الملفات الثلاثة الأخرى يمكن قراءتها بواسطة رمزنا وغير يمكن قراءتها بواسطة`marshal`تحت هذا المترجم.

## أربعة مترجمين، أربعة رمزات للاستعراض

يحتوي المستندات المزيفة على تحذير واحد على كل نسخة: رمز البايت هو تفاصيل تنفيذ CPython ولا يوجد ضمان بأن يبقى نفسه.`python3.1N -m dis ledger.py`تم التقاط كل مترجم

في 3.11 `grade`يبدأ هكذا:

```text
 11           2 LOAD_FAST                0 (score)
              4 LOAD_CONST               1 (10)
              6 BINARY_OP                2 (//)
             10 STORE_FAST               1 (bucket)
 12          12 LOAD_FAST                1 (bucket)
             14 LOAD_CONST               2 (9)
             16 COMPARE_OP               5 (>=)
             22 POP_JUMP_FORWARD_IF_FALSE     2 (to 28)
```

`BINARY_OP`يقع في التفاصيل 6 والإرشاد التالي في 10. البايتين بينهم هو مدخل مخزن مخزن داخلي من PEP 659، المترجم التكيفي المتخصص. `COMPARE_OP`في 16 يلي 22، لذلك هو يمتلك إدخالات مخزن اثنين.`show_caches=True`. 3.12 يبدل `LOAD_CONST`بالإضافة`RETURN_VALUE`مع`RETURN_CONST`, تغيير اسم القفز إلى `POP_JUMP_IF_FALSE`و يختصرون`grade`من 80 إلى 62 بايت. 3.13 طباعة العلامات `L1`إلى`L4`بدلا من تعويضات وتعطى CLI `-C`لخزائن الاحتياطي و`-O`لتحويلات. 3.14 إزالة `RETURN_CONST`مرة أخرى، يضيف `LOAD_SMALL_INT`و`LOAD_FAST_BORROW`، و إدخالات `NOT_TAKEN`بعد كل قفزة مشروطة:

```text
 12         20       LOAD_FAST_BORROW         1 (bucket)
            22       LOAD_SMALL_INT           9
            24       COMPARE_OP             188 (bool(>=))
            26       CACHE                    0 (counter: 0)
            28       POP_JUMP_IF_FALSE        3 (to L1)
            30       CACHE                    0 (counter: 0)
            32       NOT_TAKEN
```

- نعم`-C -O`العروض المدرجة 13 `CACHE`إدخالات داخل `grade`: بعد خمسة`BINARY_OP`، واحد بعد كل واحد`COMPARE_OP`، واحد بعد كل واحد`POP_JUMP_IF_FALSE`.الجهاز التكيفي يظهر ما هي الاكشافات .بعد 200 مكالمة`dis.dis(grade, adaptive=True)`بصمات`RESUME_CHECK`و`COMPARE_OP_INT`حيث كان الإدراج المُباشر`RESUME`و`COMPARE_OP`و`total`تظهر`FOR_ITER_LIST`،`BINARY_OP_ADD_INT`و`JUMP_BACKWARD_NO_JIT`. الأشكال المتخصصة تعيش في نفس`co_code`البايتات. لم يحتوي جهاز الكمبيوتر على هذه البايتات أبداً، لأن التخصص يحدث في الذاكرة.

هذا هو السبب في أن المفكّرات لديها سقف إصدار. uncompyle6 3.9.3 تقول أنها تقبل رمز البايت من Python 1.0 إلى 3.8. decompyle3 3.9.3 يقرأ 3.7 و 3.8. xdis 6.3.0, وقطع الإصدارات المتقاطعة وراء كل منهما، يقرأ إلى 3.13. pycdc لديه جداول رمز الاختيار حتى `python_3_13.cpp`في ملف بناءها، وعلى طبعات رمز opcode مجهولة `Unsupported opcode`ويشير الملف إلى أن النتائج غير كاملة. يطالب PyLingual بكل إصدار صدر منذ 3.6 ويستخدم مترجمين من 3.8 إلى 3.15 لإعادة تجميع وتحقق من النتائج الخاصة به. بالنسبة لملف 3.14، فإن الثلاثة الأولى ترفض أو تفشل، ولا تنطبق إلا الأخيرتين. اقرأ الكلمة السحرية قبل اختيار أداة.

## ملف الفئة يحافظ على قاموسه

في JVMS Java SE 25، القسم 4.1، يقدم التخطيط كهيكل واحد: `magic`،`minor_version`،`major_version`،`constant_pool_count`, المسبح المستمر ,`access_flags`،`this_class`،`super_class`، واجهات ، حقل ، طرق ، صفات السحر هو`0xCAFEBABE`. يقبل جهاز جاوا SE 25 الافتراضي الإصدارات الرئيسية 45 إلى 69، ويعتبر أقل من 65535 ملفًا من ميزة المشاهدة المسبقة.`Ledger-g.class`هل هي`ca fe ba be 00 00 00 41 00 5e`: الرئيسية 65 هو جاوا 21 و `0x5e`= 94 هو عدد المجموعة المستمرة. `Ledger-jdk25.class`، تم بناؤه بواسطة javac 25.0.2 من نفس المصدر، يبدأ `ca fe ba be 00 00 00 45`الرئيسي 69

المجموعة المستمرة هي حيث يحتفظ ملف الفصل قاموسه الخاص.`#13`في`-g`البناء هو`Methodref`هذا يشير إلى الصف`#8`و الاسم و النوع`#14`. تتبع المؤشرات يعطي`Ledger.grade:(I)I`، والذي هو بالضبط ما`javap -v`بصمات بعد`//`. وصف`(I)I`هو واحد`int`المعلم و`int`النتيجة`([I)I`على`total`يقول أن المعلم هو`int`المصفوفة. كل طريقة، وحقل، والفئة التي يلمسها الرمز له مثل هذا الإدخال، والتحقق في القسم 4.10 يرفض الملف الذي لا يوافق مع تعليماتها.`ClassFile`الفصل في`code/main.py`يقرأ جميع علامات الثابتة الـ 17 من الجدول 4.4 ويعالج`Long`أو`Double`يرتفع على علامة مجهولة وعلى البايتات بعد الصفحة الأخيرة

الصفات تعتمد على الفئة، كل حقل، كل طريقة، وال `Code`سمة نفسها. يقول JVMS أن الآلة الافتراضية يجب أن تتجاهل الصفات التي لا تعرفها ، ولهذا السبب يمكن إضافة جداول التحليل أو إسقاطها دون تغيير جسم طريقة. دليل javac يقول `-g`يُولد كل معلومات التحليل بما في ذلك المتغيرات المحلية، أن الإعداد الافتراضي يُولد أرقام الخط والملف المصدر فقط، وأن `-g:none`لا يخلق شيئاً، الثلاثة يبني مقياساً

| Build | Bytes | Constant pool count | `LineNumberTable` | `LocalVariableTable` | `SourceFile` | `grade` code bytes |
|---|---|---|---|---|---|---|
| `javac -g` | 1832 | 94 | 7 methods | 6 methods | yes | 50 |
| `javac` | 1581 | 82 | 7 methods | none | yes | 50 |
| `javac -g:none` | 1404 | 79 | none | none | no | 50 |

50 بايت رمزية من `grade`ويتم التحقق من ذلك`-g`يضيف ل`grade`هو واحد`LocalVariableTable`الصف: بداية 0، طول 50، فتحة 0، اسم `score`، وصف`I`بدونها ، فالمُفكّر يرى فتحة 0 من النوع`int`و يجب أن يختلق اسمًا`StackMapTable`يبقى في كل بناء لأن المؤكد يحتاجه، وال `BootstrapMethods`الصفحة تبقى لأن `main`يُحدد الخيوط عبر `invokedynamic`. . .

## فك تشفير المفاتيح من خلال اليد

يحدد الفصل 6 من JVMS كل تعليمات بايت واحد opcode والعمليات التي تسمي opcode. تعادلات الفرع هي قيم مؤكدة 16-bit بالنسبة إلى عنوان الفرع opcode، والتي تختلف عن x86-64, حيث التحول بالنسبة إلى التعليمات التالية. `tableswitch`و`lookupswitch`تبدأ مع صفر إلى ثلاثة بايتات التشغيل بحيث تبدأ أوبراندها 32-بيت من عنوان هو مضاعف أربعة.

البايتات من `grade`من حاسوب 4 في `Ledger-g.class`:

```text
aa                 tableswitch at pc 4
00 00 00           padding to pc 8
00 00 00 2c        default: 4 + 44 = 48
00 00 00 06        low 6
00 00 00 0a        high 10
00 00 00 2a        case 6:  4 + 42 = 46
00 00 00 28        case 7:  4 + 40 = 44
00 00 00 26        case 8:  4 + 38 = 42
00 00 00 24        case 9:  4 + 36 = 40
00 00 00 24        case 10: 4 + 36 = 40
```

36 بايت، تعليمات واحدة، والكل`switch (score / 10)`مع قضيتها المشتركة ل 9 و 10.`switch`في الدروس 33 كان يحتاج إلى فحص الحدود`lea`، أ`movslq`، و`add`هنا الأهداف في التعليمات، وكذلك حقيقة أنهم ينتمون معا.

`disassemble_jvm()`تغطي جميع 202 رمزًا محددًا مع عرض أوبراندها ، وتتبع قاعدة التدليك ، وتجعل أوبراندها طريقة `javap`نعم`compare_with_javap()`يُحلل المُسجنين`javap -c -p`النص، بما في ذلك الخطوط المتعددة `tableswitch`كل أربعة تشكيلات تتفق على 108 من 108 تعليمات.`test_branch_offsets_are_relative_to_the_branch_instruction`التحققات`ifne`في pc 1 الهبوط على 6 ، `if_icmpge`عند 13 الهبوط على 33 ، و`goto`في 30 الهبوط مرة أخرى على 10.

رادار2 6.2.4 ، تم بناؤه من المصدر لهذه الدروس ، يقرأ نفس الملف. `rabin2 -I`تقارير `arch java`،`lang java 21`،`linenum true`و`lsyms true`، والتي هي قراءة الإصدار والجدولين التصحيحي. `pd 14 @ sym.Ledger.grade`يطبع`tableswitch`مع السهام إلى أهدافها الخمسة.`Unable to parse code attribute: 2`في هذا الملف، وهو قيود أداة أسماء نفسها وسبب للحفاظ على `javap`كالمعرفة. إنّ مُحللات هذا النموذج متقدمة بالمقارنة مع Python. CFR 0.152 مرخصة مع معهد ماساتشوستس للتكنولوجيا Procyon 0.6.0 و Vineflower 1.12.0 هي Apache-2.0 و Vineflower هو فرن فلور مع دعم جاوا 21. (فيرنفلور) نفسه يعيش داخل مخزن مجتمع (إنتلي جي) تغطي JADX 1.5.6 تنسيق Android DEX ، وكانت آخر إصدار JD-GUI في عام 2019. قام هاراند وسوتو فاليرو ومونبروس وبودري بقياس ثمانية منها في عام 2020. أفضل إنتاج صحيحة نحو نحو 84 في المائة من الفصول والإنتاج معادل معنويًا لـ 78 في المائة. استعاد مُحلل التلفزيونات المُتَعَدّدُ 37.6 بالمئة من الفئات التي لم تتعامل بها أداة واحدة. الأنواع والأسماء والكؤوس المحققة تجعل النموذج قابل للكمبلة. لا يُكملون أيّ مُحاميل واحد.

## وحدة الجذع قائمة من القسمات

المواصفات الأساسية تعرّف الوحدة على أنها المواصلة `00 61 73 6d 01 00 00 00`، السلسلة`\0asm`والإصدار 1، تليها أقسام. كل أقسام هي بايت واحد`u32`حجم في LEB128 ومحتوياته. أرقام 1 إلى 13 هي القسمات المعروفة، كل مرة على الأكثر في الترتيب. id 0 هو قسم مخصص مع اسم، يسمح في أي مكان. جميع الأرقام الكاملة هي LEB128, لذلك `e4 00`هو 100 و `80 08`هو 1024`wasm-objdump -h`على`ledger.wasm`يذكر سبع أقسام، و`WasmModule`يجد نفس السبع مع نفس تعويضات الحمولة المفيدة:

| Section | Payload | Count | What it holds for ledger |
|---|---|---|---|
| Type | 10 to 26 | 3 | `(i32) -> nil`, `(i32, i32) -> i32`, `(i32) -> i32` |
| Import | 28 to 39 | 1 | `env.log` with type 0 |
| Function | 41 to 46 | 4 | type index for each defined function |
| Memory | 48 to 51 | 1 | one page, no maximum |
| Export | 53 to 110 | 5 | `memory` and the four function names |
| Code | 113 to 271 | 4 | bodies of 23, 63, 44, and 23 bytes |
| Data | 273 to 290 | 1 | `F\0D\0C\0B\0A\0` at offset 1024 |

توجد فصل بين أجزاء الوظيفة والرمز بحيث يمكن للمتنشر أن يبدأ في تجميع قبل وصول الملف بأكمله. كل إدخال رمز هو حجم، ومركز من الإعلانات المحلية، والتعبير.`grade`المتجه المحلي هو`01 7f`: مجموعة واحدة من واحد `i32`هذا هو`bucket`، مع نوعها ودون اسمه

تدفق التحكم هو مهيكل من خلال البناء.`block`،`loop`أو`if`المكونات. يتم تحديد العلامات حسب عمق العشب. `br_table`يقوم بإجراء فرع غير مباشر من خلال جهاز عمل يُصفف قائمة العلامات.`grade`في تعويض الملفات`0xa3`:

```text
0e                  br_table
0b                  11 labels follow
04 04 04 04 04 04   buckets 0 to 5: label 4, the outermost block, returns 0
03 02 01 00         buckets 6, 7, 8, 9: labels 3, 2, 1, 0
00                  bucket 10: label 0, shared with 9
04                  default label 4
```

كل ملصق هو عمق.`block`، والرقم بعد`end`هو`i32.const 4`يليها `br 4`خارج حجر النتيجة.`block`التعليمات أمام الطاولة، والعشرة علامات، والخمسة `br`التعليمات بعد أن يكون كله `switch`ويقوم المحقق بتجاهل أي فرع يغادر الهيكل`disassemble_wasm()`تتبع العمق حتى الرسومات المدرجة مثل `wasm-objdump`، تغطي كل رمز خيار واحد من `unreachable`إلى`i64.extend32_s`، و يطابق الاعتقالات`wasm-objdump -d`على 77 من 77 تعليمات لكل من البنايات.

الأسماء هي الشيء الوحيد الذي يُسقطه الوحدة العادية`wasm-objdump`بصمات مستمرة`<grade>`لأن قسم التصدير يقوم بتخريط تلك السلسلة إلى مؤشر الوظيفة 2 ، والقارئ يفعل الشيء نفسه. الأسماء المحلية لا توجد في أي مكان في الملف البايت 290. `wat2wasm --debug-names`يضيف قسمًا مخصصًا يسمى `name`مع الفرق الفرعية لسم الوحدة، أسماء الوظائف، والأسماء المحلية. النظام الملف ينمو إلى 425 بايت. القارئ يجد `{0: 'score', 1: 'bucket'}`للعمل 2 و `{0: 'values', 1: 'count', 2: 'sum', 3: 'i'}`للعمل 3. `wasm-strip`يزيل القسم مرة أخرى. مخزن الاتفاقيات الأداة يصف اثنين من المحاملين. يمكن دمج DWARF على النحو`.debug_*`القسمات المخصصة.`sourceMappingURL`يمكن أن يشير القسم المخصص إلى خريطة مصدر أعداد العمود هي تعويضات بايت إلى الثنائي.

أدوات تحرك خلال عام 2026، وبت 1.0.42، أصدرت في عام 2026-09-15, تم إزالتها`wasm-decompile`و المُبني على هذه الآلة لديه بالضبط الأدوات الـ11 المتبقية`print`،`objdump`و`demangle`. إصدار (بيناريان)_133 يقدم `wasm-dis`. رادار2 6.2.4 يقرأ الوحدة أيضاً.`rabin2 -I`يقول`arch wasm`. رمزها لـ`grade`يبدأ في`0x8e`، حيث يبدأ متجه المحليين، بينما `wasm-objdump`تسمية الوظيفة في `0x8b`حيث تبدأ حقل الحجم.`get_local`،`set_local`و`brtable 11 4 4 ...`مع طباعة عدد العلامات البايتات هي نفسها في كل الأدوات الثلاثة وتختلف التكليف، لذلك يجب أن يكون المقارنة اسم الأداة التي تم التقاطها بها. البحث لهذا الدروس لم يجد أي وحدات معالج WebAssembly في دليل معالج Ghidra، ولم يتم قراءة هذا القائمة بالكامل. إنّ مُبنى Ghidra-wasm-plugin v2.4.0 من طرف ثالث يستهدف Ghidra 12.0. المواصفات نفسها هي وثيقة حية واحدة. صفحة W3C لل`wasm-core-2`هو مشروع توصية المرشحين المؤرخ 13 أكتوبر 2026 الذي يصف ملخصه الإصدار 3.0، ومشروع المحررين يحمل نفس التاريخ.

## البيانات المعدنية ECMA-335 هي قاعدة بيانات البرنامج الخاصة

مجموعة .NET هي ملف PE. `LedgerNet.dll`يبدأ بـ`MZ`، لديه ثلاثة أقسام اسمها`.text`،`.rsrc`و`.reloc`، ويقول آلة`0x14c`لأن المجمع أصدرت رمز محايد المنصة. دليل البيانات 14 من الرأس الاختياري، الرأس CLR Runtime، يشير إلى RVA `0x2008`. ECMA-335 II.25.3.3 تعريف 72 بايت هناك:

```text
48 00 00 00   Cb 72
02 00 05 00   MajorRuntimeVersion 2, MinorRuntimeVersion 5
78 21 00 00   MetaData RVA 0x2178
84 07 00 00   MetaData size 1924
01 00 00 00   Flags: COMIMAGE_FLAGS_ILONLY
05 00 00 06   EntryPointToken 0x06000005, MethodDef row 5, which is Main
```

جذور البيانات المعدنية في RVA `0x2178`يبدأ بالتوقيع`42 53 4a 42`، والتي تقرأ`BSJB`، ثم النسخة 1.1 والسلسلة `v4.0.30319`خمسة رؤوس التيار تتبع:`#~`في التكافؤ`0x6c`، ثم`#Strings`،`#US`،`#GUID`و`#Blob`. II.24.2 يقول كل نوع من التيارات تحدث مرة واحدة على الأكثر.`#~`التيار يبدأ بـ`HeapSizes`بايت، صفر هنا، لذلك كل سلسلة، GUID، ومرجع البقع هو 2 بايت واسع، و 64 بت `Valid`القناع الذي يسمي الجداول المحتلة. يتم تعيين 14 قطعة:

| Table | Id | Rows | Row size | What the rows say |
|---|---|---|---|---|
| Module | 0x00 | 1 | 10 | the module name and its GUID |
| TypeRef | 0x01 | 21 | 6 | `System.Object`, `System.Console`, 19 more |
| TypeDef | 0x02 | 4 | 14 | `<Module>`, `Ledger`, and two compiler helpers |
| Field | 0x04 | 2 | 6 | `Labels` and a static array initialiser |
| MethodDef | 0x06 | 6 | 14 | the five methods and `.cctor` |
| Param | 0x08 | 5 | 6 | `before`, `after`, `score`, `values`, `score` |
| MemberRef | 0x0a | 16 | 6 | 12 attribute constructors and the 4 methods that `Main` calls |
| CustomAttribute | 0x0c | 12 | 6 | attributes the compiler and the SDK add |
| StandAloneSig | 0x11 | 3 | 2 | the three local variable signatures |
| Assembly, AssemblyRef, ClassLayout, FieldRva, NestedClass | | 1, 2, 1, 1, 1 | | identity, references, layout |

لا يتم تخزين حجم الصف في أي مكان. يعطي II.22 لكل عمود نوعاً، و II.24.2.6 يعطي قاعدة الحجم. مؤشر كومة هو بثنين أو أربعة بايتات من `HeapSizes`. مؤشر الجدول البسيط هو بثنين بايت بينما يكون هذا الجدول أقل من 65536 سطر. مؤشر مدمج يمكن أن يشير إلى n جداول مع ب بيتات علامة هو بثنين بايت بينما كل من هذه الجدول لديها أقل من 2^(16-b) الصفوف. `CliAssembly`يحسب حجم 14 صف من هذه القواعد ويعد الصف. النظام.التفكير.مدونة البيانات المعدنية في الأجهزة الإصدارية تقرير نفس الحجم و نفس تعويضات الجدول، وهذا هو كيفية إثبات الاختبار الحساب.

يحدد III.1.9 الرمز: البايت العالي هو الجدول، والبايت الثلاثة المنخفضة هي الصف القائم على 1. `0x06000002`هو`MethodDef`الصف 2 . هذا الصف لديه RVA `0x2060`اسمك`Grade`، وقطعة توقيع`00 01 08 08`: الاتفاقية الافتراضية للاتصال، معايير واحدة، العودة `int32`، المعلم`int32`. إنه`ParamList`النقاط في الصف 3 من `Param`، اسمها`score`طاولة " بارام " هي سبب إمكانية طباعة " إيلسبي "`Grade(int score)`من إطلاق منشأة منقطعة.`0x2060`يبدأ جسم المنهج بالرأس الدهني:

```text
13 30         flags 0x13: fat, init locals; size 3 dwords
02 00         MaxStack 2
2d 00 00 00   CodeSize 45
01 00 00 11   LocalVarSigTok 0x11000001
```

`StandAloneSig`الصف 1 يحتفظ`07 01 08`: `LOCAL_SIG`، محلي واحد ،`int32`. المحلية لديها نوع وليس اسم. ECMA-335 تحتفظ بأسماء محلية في شكل إصلاح تبادل القسم V، و .NET SDK يكتبها إلى PDB. تم بناء هذا الجهاز مع `DebugType`لا يوجد أي طاولة ولا ملف يحمل اسم`bucket`. .`PercentChange`لديه رأس صغير بدلاً من ذلك: أول بايت`3a`هو`0x0e << 2 | 2`، جسم 14 بايت بدون محليين و كومة افتراضية من 8.

45 بايت رمزية من `Grade`فك الرمز مع جدول الشفرات المشتركة في القسم الثالث. `switch`هو رمز الاختيار`0x45`يليها `u32`العد والكثير من ذلك`int32`الأهداف المتعلقة بالمرشد بعد الجدول:

```text
IL_0000: 02           ldarg.0
IL_0001: 1f 0a        ldc.i4.s 10
IL_0003: 5b           div
IL_0004: 0a           stloc.0
IL_0005: 06           ldloc.0
IL_0006: 1c           ldc.i4.6
IL_0007: 59           sub
IL_0008: 45 05 00 00 00 08 00 00 00 06 00 00 00 04 00 00 00 02 00 00 00 02 00 00 00
                      switch (IL_0029, IL_0027, IL_0025, IL_0023, IL_0023)
IL_0021: 2b 08        br.s IL_002b
IL_0023: 1a 2a        ldc.i4.4, ret
```

المحمول خصم 6 قبل `switch`، لذا الحالة 6 هي الهدف الأول.`disassemble_cil()`يعطي الرموز عبر الجداول: `ldsfld Labels`،`call Grade`،`call System.Console::WriteLine`و`ldstr ' '`من`#US`المُتَكَلُّمُ لكلّ هذا هو`MetaDump`، برنامج C# قصير في الأجهزة المبنية على`System.Reflection.Metadata`يطبخ عدد الصفوف، وحجم، وتعويض كل طرق، و RVA كل التوقيع، أسماء المعلمات، و بايت IL، و 226 حقل من `System.Reflection.Emit.OpCodes`. .`compare_with_metadump()`يوافق على جميع الشيكات 246 . الجدول الزمني لديه 218 رمزات إضافة إلى ثمانية`prefix`المشاركين في الجدول الدراسي يحتوي على 219 إدخالًا لأنه يحتوي على`no.`من III.2.2 ، التي لم يكن لها جدول إصدار.

أدوات للصيغة: ILSpy 11.0 (MIT ، أصدرت 2026-08-12) تعمل على macOS من خلال إعداد سطح المكتب Avalonia. `ilspycmd`11.1.0.9782 طباعة IL مع `-il`و يختار طريقة من خلال الوهم مع `-m 0x06000002`. dnSpyEx 6.6.0 يستمر dnSpy على Windows فقط.`ildasm`السفن كحزمة NuGet بدلا من داخل SDK. radare2 6.2.4 يقرأ البيانات المعدنية أيضا: `rabin2 -I`يقول`arch cil`و`class PE32`و`is`القوائم`Ledger.Grade(int:score):int`مع اسم المعلمات وكلاهما من النوعين المأخوذة من الجداول المعلمية والتوقيع. ليس لديها إزالة CIL في هذا البناء. تم بناء هذا الإصلاح مع .NET SDK 8.0.205 لأن هذا هو SDK مثبت على آلة البناء. .NET 10 كان حاليا منذ 2025-11-11 ويكتب نفس الهياكل ECMA-335 .

## ما تحتفظ به كل حاوية

ضع`grade`من كل الحاويات الخمسة في طاولة واحدة. كل سطر يأتي من`python3 code/main.py keeps`، الذي يُشغل القراء على الأجهزة:

| Container | Body bytes | Function name | Parameter names | Parameter and return types | Local names | Line numbers | Control flow |
|---|---|---|---|---|---|---|---|
| ELF object, clang -O0 | 118 | `grade` in `.symtab` | none | none | none | none, no `.debug_*` sections | 5 jumps and 1 indirect jump through a relocation table |
| CPython 3.14 pyc | 96 | `co_qualname` | `score` | none | `bucket` | `co_linetable`, first line 10 | 4 compare and `POP_JUMP_IF_FALSE` pairs |
| JVM class, `javac -g` | 50 | constant pool | `score` in `LocalVariableTable` | `(I)I` | none beyond the parameter | `LineNumberTable`, 6 rows | 1 `tableswitch` |
| WebAssembly | 63 | Export section | only with a name section | `(i32) -> i32` | only with a name section | none | 6 nested blocks, 1 `br_table`, 4 `br` |
| .NET assembly | 45 | `MethodDef` | `score` in `Param` | `static int32(int32)` | none, types only in `StandAloneSig` | none without a PDB | 1 `switch`, 1 `br.s` |

الجدول يشرح نتائج تحليل الملفات التي ستراها.`int total(const int *, int)`مع`int total(long param_1, uint param_2)`أن Ghidra استنتج من الرمز الأصلي، لأن الرمز الأصلي لا يحفظ أي من هذه العمودات. يحتفظ Pyc كل الاسم ولا أي نوع، وتدفق التحكم هو القفزات التي تتغير شكلها كل إصدار، لذلك يقوم مفكّر Python بقطع كل نسخة واسترداد الأسماء مجانا.`-g`هو على، ويُعبر عن`switch`وحدة "الغص" تبقي الهيكل من خلال البناء، لذا`wasm2wat`هو رحلة ذهاب وإياب بدون خسائر والخسارة الوحيدة هي الأسماء. مجموعة .NET تحتفظ بالوصف الأكثر اكتمالاً، لأن الجداول البيانات المعدنية هي قياسية، ولا تزال بحاجة إلى PDB لاسم محلي.

يخبرك الجدول ما كان على المتحلل العمل معه ، ومع أي من نتائجها نسخ حقيقة مخزنة ومع أي إستنتاج. اسم المعلم في إرسال ILSpy هو نسخة. اسم محلي في نفس الإنفاذ هو استنتاج ما لم يكن PDB موجودًا. تدرسة 35 تسجل هذا الفرق كسلطة لكل ادعاء.

## بناءها

أطلق التجربة:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
```

إن المخرج هو تقرير JSON واحد. لكل Pyc يعطي كل من العناوين، الملف و `grade`الحجم، عدد التعليمات وأسماء رمزات الاختيار من القائمة التي تم التقاطها، وما إذا كان المترجم الجاري يمكن قراءتها. لكل طبقة يقدم النسخة، الحجم، حسابات جدول التحليل، والـ `javap`لكل بناء من "السوم" يقدم أقسام، أنواع، وظائف، محتويات قسم الاسم، وال`wasm-objdump`الاتفاق. لجميعها يعطي عنوان CLI، وتدفقات، وعد صفوف الجدول، والطرق، واتفاق النظام.التفكير. البيانات المعدنية. إنه ينتهي بتبيع الجدول والقائمة من المترجمين الموجودة على `PATH`. . .

اقرأ`code/main.py`في هذا الترتيب:

1. `Reader`يحمل الوسيط والعرض الكامل. `uleb()`و`sleb()`هذه قراءة LEB128 التي تحتاجها Wasm و .NET
2. `read_pyc_header()`،`Unmarshaller`و`PycFile`اقرأوا جهاز التشغيل`parse_dis_text()`يقرأ المعتقلين`dis`القوائم بحيث لا يحتاج المقارنة بين الإصدارات إلى أربعة مترجمين في وقت الاختبار.
3. `ClassFile`يقرأ ملف الفصل و `disassemble_jvm()`يفكّر رمزها`parse_javap_code()`و`compare_with_javap()`هو التحقق من الوساطة.
4. `WasmModule`يقرأ القصص و`disassemble_wasm()`يُفكّر تعبيرًا بعمقها`compare_with_wasm_objdump()`هو التحقق من الوساطة.
5. `CliAssembly`يمرون PE، رأس CLI، جذور البيانات المعدنية، التيارات، والجدولات. `TABLE_SCHEMAS`و`CODED_INDEXES`هي II.22 و II.24.2.6 كمعلومات. `disassemble_cil()`يُفكّر الجسم و`compare_with_metadump()`تحقق من ذلك.
6. `NativeObject`يقرأ ELF بما فيه الكفاية لرد الرموز الوظيفية ويأخذ الدروس 33 قائمة كنصها. `what_each_keeps()`و`figure_data()`بناء المقارنة.

هناك خمسة أوامر أخرى`python3 code/main.py pyc FILE`،`class FILE`،`wasm FILE`و`dll FILE`طبع الهيكل و قائمة كل وظيفة في الملف الذي تعطيه لهم. `python3 code/main.py compare`تجميعات `ledger.py`مع كل مترجم على`PATH`ويقومون بطبع ما كتب كل منهم

## استخدمها

استخدم القراء بهذه الترتيب على حاوية صنعتها

1. اقرأ أول بايت و اسم النموذج ثم بايتين`0d 0a`هو (بيك)`ca fe ba be`ملف الفصل، `00 61 73 6d`وحدة،`4d 5a`مع إدراج البيانات 14 وضع الجمع.
2. اقرأ الرأس واكتب النسخة المنتجة التي يسميها. لـ pyc التي هي الكلمة السحرية، لملف الصفحة النسخة الرئيسية، لجمعة وقت تشغيل و metadata نسخة السلاسل.
3. تحقق من كل جهاز إزالة الكمبيوتر الذي تخططين لتنفيذه مقابل هذا النسخة قبل تشغيله، وقم بتسجيل السقف وأين توثيق الأداة.
4. قم بتشغيل القارئ وأداة النموذج الخاصة به على نفس الملف وقارنها صف بعد صف. عدم الملاءمة هو خطأ في القارئ أو تغيير في الأداة، ويجب فهم أي من هذه الأدوات قبل أن تكون القائمة دليلًا.
5. املأ جدول الاحتفاظ بالوظيفة التي تهتم بها، وقم بتشخيص كل حقيقة كمتحتفظ بها أو ضائعة، واطلق اسم الجدول أو الصف أو القسم الذي جاء منه.
6. فقط بعد ذلك قراءة إصدار المتحول، وقم بتشخيص كل اسم وتكليف في ذلك كنسخة من حقيقة حفظ أو كإستنتاج.

احتفظ بملفات النص في Oracle مع الحاويات. عندما يتغير مترجم، JDK، SDK، أو نسخة wabt، اعيد بناءها مع `build_fixtures.sh`وإعادة التقاطها، لأن القائمة المتغيرة هي جهاز متغير.

## المختبر التفاعلي

### المختبر A: قراءة العنوان، ثم الكود الكائن

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code
python3 -q
```

أركض

```python
from main import *
pyc = load_pyc("ledger.cpython-311.pyc")
pyc.header.to_dict()
pyc.module.names
pyc.functions()["grade"].varnames
len(pyc.functions()["grade"].code)
```

اكتب الكلمة السحرية قبل المكالمة الأولى ثم قم بتحميل`ledger.cpython-314.pyc`و قم بتقارن الاثنين`code`ثم حاول`import marshal; marshal.loads(pyc.data[16:])`في الملف 3.11 تحت مترجمك وقرأ الخطأ.

### المختبر ب: سلسلة المسبح المستمرة

```python
cls = load_class("Ledger-g.class")
cls.constant(13)
cls.constant(14)
cls.describe_constant(13)
[row["text"] for row in jvm_listing(cls, "grade")]
```

اتبع`#13`إلى`#8`و`#14`، ثم إلى`Utf8`الإدخالات، يدوياً قبل الاتصال`describe_constant`- ثم تحميل`Ledger-gnone.class`و اتصل`cls.method("grade").attribute_names()`على كليهما`Code`المجموعة هي نفسها، والخصائص ليست كذلك.

### المختبر (ج): عمق وملفات

```python
module = load_wasm("ledger.wasm")
[(row["depth"], row["text"]) for row in wasm_listing(module, "grade")]
module.function_name(2)
load_wasm("ledger-names.wasm").names["locals"][2]
```

إبحث عن`br_table`صف و اقرأ عمقها اعد`end`الصفوف بعد ذلك وتطابق كل واحد من أرقام اللوحة في الجدول. ثم فتح `ledger.wat`و العثور على`block $six`تلك العلامة 3 أسماء.

### المختبر D: من الرمز إلى البايت

```python
asm = load_assembly("LedgerNet.dll")
asm.method("Grade")
body = asm.method_body(asm.method("Grade")["RVA"])
body.fat, body.max_stack, body.code_size, hex(body.local_signature_token)
asm.token_text(0x11000001)
[row["text"] for row in cil_listing(asm, "GradeLabel")]
```

احسب تعويض الملفات من RVA `0x2060`من`.text`عنوان القسم يدوياً و مقارنة مع `asm.rva_to_offset(0x2060)`إذاً انظر للأعلى`asm.row(0x08, 3)`و ابحث عن مكان الاسم`score`حياة

## مختبر التدريب

أضف لغة مصدر خامس للمقارنة، أو حقيقة سادسة إلى الجدول.

المتطلبات:

- اكتب وظيفة مع حلول وتغير محلي في لغة التي لديك محفز، على سبيل المثال Kotlin إلى ملف فئة أو Rust إلى وحدة Wasm. إلتزام الخروج وإدراج القائمة في النص مع القاعدة الدقيقة في `build_fixtures.sh`. . .
- اجعل القارئ المتطابق يوافق على كل تعليمات القرآن. أضف رموز إضافية فقط عندما يحتاجها المكون.
- التمديد`what_each_keeps()`مع الحاوية الجديدة، و مع حقيقة واحدة أخرى لكل حاوية: ما إذا كان الجسم يحمل طاولة استثناء أو `try`المنطقة
- إضافة الحاوية الجديدة إلى `figure_data()`ويتم إعادة التأهيل`site/figures-re-43.js`. . .
- اكتب اختبار يفشل عندما يبلغ القارئ عن حقيقة كما تم حفظها دون تسمية الجدول أو الصفة أو القسم الذي يحتوي عليها.

النجاح يعني`python3 code/main.py keeps`يظهر الصف الجديد مع أدلة لكل خلية، وكل مقارنة في النبي صلى الله عليه وسلم لا تزال توافق.

## درساً أساسياً

هذا الدروس يتضمن`outputs/skill-bytecode-and-managed-formats.md`. استخدمها لتحويل حاوية رمز البايت إلى تقرير رأس ، وإدراج معين لمهمة واحدة ، وجداول معلومات ترسم كل اسم ونوع ، والهيكل كما تم الحفاظ عليه أو فقدته. يتطلب أداة النموذج الخاصة بها كحكيم ، وتحقق النسخة قبل أي مفكّر ، وإعلان عن مكان كل حقيقة فقدت قد عاش.

## تحقق من ذلك

إشغال التجربة والسلسلة التحديدية:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

يجب أن تثبت التحقق:

- تحتوي الرأس الأربعة على الكلمات السحرية 3495، 3531، 3571، و 3627، العلامات 3، والهاش 8 بايت، وملفات العلامات الزمنية تحتوي على العلامات 0، mtime 1791975565, والحجم 497
- كل كلمة سحرية ل 3.11 و بعد ذلك يجلس في النطاق`2900 + 50n`القاعدة تعطى إطلاقها
- يعيد المُحاكم الأسماء، المستمرات، أجزاء رمزية، أسماء المتغيرات، و جدول الخط`marshal.loads()`على الملف الذي كتب المترجم المدير
- كل الملفات الأربعة تحتفظ بأسم الوحدات`('score', 'bucket')`لـ`grade`، أول سطر 10 ، و `ledger.py`كاسم الملف
- `grade.co_code`هو 80، 62، 70، و 96 بايت في جميع النسخ الأربعة والقوائم التي تم التقاطها لديها 31، 26، 26، و 35 تعليمات
- القائمة 3.11`POP_JUMP_FORWARD_IF_FALSE`3 ، 12 و 3 ، 13`RETURN_CONST`و 3.14 لديه`LOAD_SMALL_INT`،`LOAD_FAST_BORROW`و`NOT_TAKEN`
- 3.14 `-C -O`يظهر القائمة 13 إدخال في الاحتفاظ`grade`، خمسة منهم بعد`BINARY_OP`، وترتيبات الإدراجات`COMPARE_OP_INT`
- رأس بدون`0d 0a`، رأس محطم، وجسم ليس كود كائن رفع `FormatError`
- قائمة التعليمات موجودة فقط للجهاز المكتب الذي كتبه المترجم الجاري وتطابق المقاطع`dis`الناتج
- الملفات الفئة لديها 65 أو 69 أساسية، أحجام 1581, 1832, 1404 و 1581, وتعدد الجمع الثابت 82, 94, 79, و 82
- مستمرة`#13`يقرر`Method Ledger.grade:(I)I`و`#47`إلى`String F`
- إنّ مُفكّر الـ JVM يوافق على `javap -c -p`على 108 من 108 تعليمات في كل أربع البناءات
- `tableswitch`في pc 4 هو 36 بايت مع 6 منخفضة، 10 منخفضة، 48 الافتراضي، والهدف 46, 44, 42, 40, 40
- مستويات التحليل الثلاثة تغير عدد الصفات وتترك 50 بايت رمز من `grade`متطابقة
- `ifne`،`if_icmpge`و`goto`الأهداف نسخية عن رمز الخيارات
- سحرية خاطئة، تعقب البايتز، ورفع رمز الخيار غير محدد `FormatError`
- ستة أقسام " واص " لديها تعويضات للحميل المفيد`wasm-objdump -h`الطوابع، والأسماء المُبنية يضيف `name`قسم العمليات الإجتماعية في 293 إلى 425
- النوع،`env.log`الإيرادات، الخمسة الصادرات، وقطاع البيانات في 1024 رمز التشريح كما هو مكتوب في `ledger.wat`
- إنّ مُفكّر " ويزم " يوافق على ذلك`wasm-objdump -d`على 77 من 77 تعليمات في كل من البناء
- `grade`لديه 6 كتلة متجمعة`br_table`مع علامات`4 4 4 4 4 4 3 2 1 0 0`و 4 افتراضي في عمق 6 و 1 `i32`المحلية
- أسماء الوظائف تأتي من الصادرات بدون قسم الأسماء والأسماء المحلية فقط معها
- LEB128 `e4 00`هو 100`7f`هو -1`80 08`هو 1024، وتعطي أنواع الكتل مثل `wasm-objdump`
- إصدار 2 خاطئ، ورفع رمز الاختيار غير معروف`FormatError`
- الجمع هو PE32 مع آلة `0x14c`، عنوان CLI في RVA `0x2008`, وقت التشغيل 2.5 ,`ILONLY`، و نقطة دخول`0x06000005`
- نسخة البيانات المعدنية هي `v4.0.30319`، هناك خمسة تيار ، والجداول 14 لديها عدد الصفوف وحجم الصفوف تقارير الوساطة
- قراءة .NET يوافقون على نظام.عكس.المعلومات المتعددة على 246 من 246 التحقق
- `Grade`لديه مُعيار`score`, توقيع`static int32(int32)`، رأس سمين مع`MaxStack`2 و 45 بايت رمز، و واحد `int32`محلية بدون اسم
- (CIL)`switch`الأهداف`br.s`،`ldsfld`،`call`و`ldstr`الـ (أوبراند) يُحلّون عبر الجداول والكثائب
- جدول CIL opcode يغطي كل رمز opcode في وقت التشغيل ويضيف فقط `no.`
- تبلغ جدول الحفاظ على اسم المعلم في أربعة حاويات ولا في أي منها للرمز الأصلي، وتصنيف في ثلاثة
- كل خط في التجربة يقرأ n من n
- الرقم التفاعلي يضم نفس البيانات `figure_data()`تنتج

## أساليب فشل الإنتاج

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Decompiler older than the interpreter | `Unsupported opcode`, output marked incomplete, or a claim of obfuscation | The magic word, the release it names, and the tool's documented ceiling |
| pyc read with the wrong interpreter | `marshal.loads` raises or returns garbage | Our unmarshaller reads names, constants, and sizes from any 3.9 to 3.15 file, and instructions come from the matching `dis` |
| Specialised opcodes mistaken for the file's content | `COMPARE_OP_INT` in a listing | A pyc holds the unspecialised form, specialisation happens in memory after warm-up |
| Local names reported for a default javac build | `var1`, `var2` presented as source names | `LocalVariableTable` is present only with `-g`, the 50 code bytes are identical either way |
| Branch target off by the instruction length | A JVM listing whose jumps land mid-instruction | Offsets relative to the branch opcode, checked against `javap` |
| Switch padding skipped | A `tableswitch` with a wrong default and shifted cases | Zero to three padding bytes to a 4-aligned pc, 36 bytes for five cases |
| Wasm names assumed stripped | "no symbols" | Exports name every exported function, locals need the `name` section, `wasm-strip` removes only that section |
| Three tools, three spellings | `get_local` versus `local.get`, a function at `0x8b` versus `0x8e` | Same bytes, and the listing that the comparison was captured with |
| Table row size guessed | Every row after the first table misread | Row sizes from `HeapSizes`, row counts, and coded index widths, equal to the oracle's |
| Local names expected in a release assembly | `V_0` presented as the source name | Locals have types in `StandAloneSig` and names only in a PDB that `DebugType` none did not write |
| Reader guesses an unknown opcode or type code | A plausible mnemonic | `FormatError` with the offset, and the oracle comparison stops there |
| Oracle captured from another build | Tests pass on stale text | `build_fixtures.sh` names every tool version and writes `versions.txt` and `sha256.txt` |

## قاعدة العمليات

اقرأ الرأس أولاً وسمي المنتج الذي يشير إليه. اقرأ الحاوية مع قارئ يرفض ما لا يعرفه، و تحقق من قائمةها مع أداة النموذج الخاصة في نفس الملف. ثم قل، لكل اسم وتصفيف في إصدار المتحول، سواء كان الحاوية قد تخزنها أو أداة استنتجته.

## المزيد من القراءة

- [PEP 552: Deterministic pycs](https://peps.python.org/pep-0552/)
- [CPython `Include/internal/pycore_magic_number.h`](https://github.com/python/cpython/blob/main/Include/internal/pycore_magic_number.h)
- [Python `marshal` module documentation](https://docs.python.org/3/library/marshal.html)
- [CPython `Python/marshal.c`](https://github.com/python/cpython/blob/main/Python/marshal.c)
- [Python 3.14 `dis` module documentation](https://docs.python.org/3.14/library/dis.html)
- [PEP 659: Specializing Adaptive Interpreter](https://peps.python.org/pep-0659/)
- [PEP 626: Precise line numbers for debugging and other tools](https://peps.python.org/pep-0626/)
- [PEP 790: Python 3.15 Release Schedule](https://peps.python.org/pep-0790/)
- [uncompyle6 on PyPI](https://pypi.org/project/uncompyle6/)،[decompyle3 on PyPI](https://pypi.org/project/decompyle3/)،[xdis on PyPI](https://pypi.org/project/xdis/)،[pycdc on GitHub](https://github.com/zrax/pycdc)،[PyLingual on GitHub](https://github.com/syssec-utd/pylingual)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 4: The class File Format](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-4.html)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 6: The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-6.html)
- [javac manual, Java SE 25](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html)و[javap manual](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html)
- [CFR](https://www.benf.org/other/cfr/)،[Procyon](https://github.com/mstrobel/procyon)،[Vineflower](https://github.com/Vineflower/vineflower)،[Fernflower in intellij-community](https://github.com/JetBrains/intellij-community/tree/master/plugins/java-decompiler/engine)،[JADX](https://github.com/skylot/jadx)
- [Harrand, Soto-Valero, Monperrus, Baudry, "Java Decompiler Diversity and its Application to Meta-decompilation" (JSS 2020)](https://arxiv.org/abs/2005.11315)
- [ECMA-335, Common Language Infrastructure, 6th edition (June 2012)](https://ecma-international.org/publications-and-standards/standards/ecma-335/)
- [PE Format, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [System.Reflection.Metadata.Ecma335.TableIndex](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.metadata.ecma335.tableindex)
- [ILSpy on GitHub](https://github.com/icsharpcode/ILSpy)،[ilspycmd on NuGet](https://www.nuget.org/packages/ilspycmd)،[dnSpyEx on GitHub](https://github.com/dnSpyEx/dnSpy)
- [WebAssembly Core Specification: Binary Format, Modules](https://webassembly.github.io/spec/core/binary/modules.html)و[Values](https://webassembly.github.io/spec/core/binary/values.html)
- [WebAssembly Core Specification: Custom Sections (name section)](https://webassembly.github.io/spec/core/appendix/custom.html)
- [WebAssembly tool-conventions: Debugging](https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md)
- [wabt 1.0.42 release notes](https://github.com/WebAssembly/wabt/releases/tag/1.0.42)،[wasm-tools](https://github.com/bytecodealliance/wasm-tools)،[Binaryen](https://github.com/WebAssembly/binaryen)،[ghidra-wasm-plugin](https://github.com/nneonneo/ghidra-wasm-plugin)
- [radare2 on GitHub](https://github.com/radareorg/radare2)، الإصدار 6.2.4 بنيت من المصدر لهذا الدروس
