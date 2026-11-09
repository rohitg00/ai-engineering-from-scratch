# الاتصالات والإطارات المتعددة: النظام V و Windows x64 و AArch64

> يظهر التفكيك الذي يقرأه المرجسمه. فقط ABI يقول ما تعنيه تلك السجلات، و ABI يتم اختيارها من قبل عنوان الموضوع، لذلك هذا الدروس يقرأ الرأس أولا ثم يفتقد كل سجل ضد القاعدة التي وضعته هناك.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and AArch64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow)
**Time:** ~140 minutes

## أهداف التعلم

- اختر الاتفاقية المكالمة من عنوان الموضوع: ELF x86-64 هو نظام V psABI، COFF AMD64 هو مايكروسوفت x64, ELF AArch64 هو AAPCS64, Mach-O arm64 هو تغير أبل.
- قم بتفكيك خط البداية لـ"بايت" من وظيفة واحدة ب"بايت" لكل ABI ووضع كل سجل مدفوع وعنوان العودة ومؤشر الإطار في عكسها من مؤشر كومة الدخول.
- إدخال سجلات المعلمات للعمل من السجلات التي تقرأها قبل أن تكتبها، وفرق الحجج الكبيرة من الحملات فوق مؤشر الكبيرة الدخول.
- أخبر تسلسلات السجل المستقل للنظام V من فتحات الموقف من مايكروسوفت x64، وكلاهما من معدادات NGRN و NSRN من AAPCS64.
- تحقق من كل استنتاج ضد توقيع المصدر والقاعدة في المواصفات، والمدمج الخاص بيانات التسريح في `.pdata`،`.xdata`و`.eh_frame`. . .
- مقارنة كيفية Ghidra، IDA، Binary Ninja، radare2، rizin، و Angr اسم واسترداد نفس الحقائق، وتسجيل حيث انتاجها لا يوافق مع المصدر.

## المشكلة

لقد قمت بتجميعها`convention.c`لـ لينكس x86-64 في `-O2`وطلب من radare2 6.2.4`eight_args`لقد أجاب بسبعة:`rdi`،`rsi`،`rdx`،`r8`،`r9`،`rsp+0x8`و`rsp+0x10`المصدر C لديه ثمانية معايير.`%rcx`مرة واحدة بالضبط، في`leaq (%rdx,%rcx), %rax`، والحصول على المتغيرات في الأداة لم يحسب سجل يظهر فقط داخل عنوان.

ثم قمت بفتح نسخة Windows لنفس الملف في rizin 0.9.1.`amd64`ووجدت`r8`،`rcx`،`rdx`و ثلاث فتحات كومة. الكائن هو COFF، لذلك الاتفاقية هي مايكروسوفت x64, الحجة الرابعة السجل هو `r9`هناك أربعة فتحات في كومة، ويتفوت الأدوات في نفس المصدر

قائمة هي سلسلة من التعليمات. اتفاقية الدعوة هو عقد يعيش خارج القائمة: التي تسجل الحملات الحجج التي يجب أن يحفظها المدعو، حيث العنوان العائدة وحجج كومة الجلسة، وما يجب أن يترك المدعو فوق مؤشر كومة. أربع وثائق تحدد العقود التي تهم هنا. النظام V AMD64 psABI (إصدار 1.0 ، بناء بتاريخ 12 مارس 2025) القواعد 3.2.1 إلى 3.2.3. مؤتمر مكالمة Microsoft x64 ، واستخدام كومة ، وصفحات المبادئ والإبيلوج (تاريخ الصفحة من 2018-12-17 إلى 2025-03-19). إصدار Arm AAPCS64 2025Q4 (23 يناير 2026) القواعد 6.1 إلى 6.9. أوراق منصة أبل arm64 هذا الدروس يقرأ تلك القواعد، يطبقها على ملف واحد C مرتبة ثلاث طرق، ويعمل على بناء المحلل الذي يحول قائمة إلى قائمة معقولة من مواقع المعلمات، سجلات مدخنة، وتعويضات الإطار.

```figure
re-38-three-frames
```

## واحد من الرؤساء يختار كتاب القواعد

`convention.c`لديه اثني عشر وظيفة: `leaf_add`،`eight_args`،`mixed`،`by_value`،`big_ret`،`sum_varargs`،`keeps`، وخمسة من المُتصلين`extern`تعمل بنفس الأشكال.`long long`، لأن`long`هو 4 بايت على هدف MSVC و 8 بايت على الآخرين، وهياكل تغير تغييرات الحجم الاتفاقية.`-target x86_64-unknown-linux-gnu`،`x86_64-pc-windows-msvc`و`aarch64-unknown-linux-gnu`في`-O0`و`-O2`و`arm64-apple-macos`في`-O2`لا يوجد عناوين لينكس أو ويندوز مثبتة، لذلك يعلن الملف ما يحتاجه ويشمل فقط كلانغ الخاص `stdarg.h`و`stddef.h`. . .

`describe_object()`في`code/main.py`يقرأ الرقم السحري البايت 4 وحقل آلة واحدة ويعد العقد:

| Header | Field | Value | Rulebook |
|---|---|---|---|
| `7f 45 4c 46` ELF | `e_machine` at offset 0x12 | 62 | System V AMD64 psABI |
| `64 86` COFF | `Machine` at offset 0 | 0x8664 | Microsoft x64 |
| `7f 45 4c 46` ELF | `e_machine` | 183 | AAPCS64 |
| `cf fa ed fe` Mach-O 64 | `cputype` at offset 4 | 0x0100000c | AAPCS64 with Apple differences |

العقود الثلاثة تختلف على كل سطر تقريبا من الجدول التالي. يتم اقتباس كل قيمة من الوثيقة المذكورة في سطر العنوان، ويتم التحقق من كل واحدة من خلال اختبار ضد العلامات.

| Rule | System V psABI | Microsoft x64 | AAPCS64 |
|---|---|---|---|
| Integer arguments | `%rdi %rsi %rdx %rcx %r8 %r9`, next free register | `RCX RDX R8 R9`, by position | `x0` to `x7`, by NGRN |
| Floating-point arguments | `%xmm0` to `%xmm7`, next free register | `XMM0` to `XMM3`, by position | `v0` to `v7`, by NSRN |
| Integer result | `%rax`, then `%rdx` | `RAX` | `x0`, then `x1` |
| Floating-point result | `%xmm0`, then `%xmm1` | `XMM0` | `v0` |
| Result too large for registers | address passed in `%rdi` "as if it were the first argument", returned in `%rax` | pointer in `RCX`, arguments shifted right, returned in `RAX` | address in `x8`, `x0` to `x7` untouched |
| Callee-saved | `%rbp %rbx %r12` to `%r15` | `RBX RBP RDI RSI RSP R12` to `R15`, `XMM6` to `XMM15` | `r19` to `r29`, `SP`, low 64 bits of `v8` to `v15` |
| First stack argument on entry | `8(%rsp)` | `40(%rsp)`, above a 32-byte shadow store | `0(sp)` |
| Below the stack pointer | 128-byte red zone | "considered volatile" | no red zone (Apple: 128 bytes) |
| Alignment at the call | `(%rsp + 8)` multiple of 16 on entry | 16-byte aligned outside prolog and epilog | `SP mod 16 = 0` |
| Variadic marker | `%al` holds an upper bound on vector registers used | floats duplicated in the integer register | none in registers; Apple uses 8-byte stack slots |

## النظام V: تسلسلين مستقلين من السجلات ومناطق حمراء

صABI 3.2.3 تصنف كل ثمانية بايت من كل حججة INTEGER أو SSE أو MEMORY ثم تعيين السجلات من قائمتين لا تتفاعل. "INTEGER" تأخذ "السجل المتاحة التالية من التسلسل %rdi، %rsi، %rdx، %rcx، %r8 و %r9". SSE تأخذ `%xmm0`إلى`%xmm7`. "إذا لم يكن هناك سجلات متاحة لأي ثمانية بايت من الحجج، يتم نقل الحجة بأكملها على كومة" و "يتم دفع الحجج الذاكرة على كومة في ترتيب معاكس (من اليمين إلى اليسار).

`eight_args(a, b, c, d, e, f, g, h)`في`-O2`هو 27 بايت:

```text
      10: 48 01 fe                     	addq	%rdi, %rsi
      13: 48 8d 04 0a                  	leaq	(%rdx,%rcx), %rax
      17: 48 01 f0                     	addq	%rsi, %rax
      1a: 4c 01 c0                     	addq	%r8, %rax
      1d: 4c 01 c8                     	addq	%r9, %rax
      20: 48 03 44 24 08               	addq	0x8(%rsp), %rax
      25: 48 03 44 24 10               	addq	0x10(%rsp), %rax
      2a: c3                           	retq
```

ستة سجلات، ثم حمولتين في`8(%rsp)`و`16(%rsp)`. الشكل 3.3 من psABI يضع "حجة الذاكرة 8byte 0" في `16(%rbp)`متى`%rbp`هو قاعدة الإطار، والتي هي `8(%rsp)`عند دخول قبل أي إضغط`g`هو في الثامنة`h`في 16

`mixed(int i, double d, long long l, float f)`يظهر القائمة الثانية.`%edi`و`%rsi`، أول و ثانيا INTEGER سجلات.`%xmm0`و`%xmm1`، السجلات الأولى والثانية SSE.`cvtsi2sd %edi, %xmm2`و`%xmm2`هو سجل الخدش الذي يكتبه الوظيفة قبل قراءته. تحليل يعالج وجهة `cvtsi2sd`كما يختلق القراءة حجة نقطة عائمة ثالثة.`mixed`كـ`(double arg1, double arg2, double arg3)`في`xmm0`،`xmm1`،`xmm2`. . .

`by_value(struct pair p)`يمر على 16 بايت من الهيكل كـ 2 INTEGER 8 بايت في `%rdi`و`%rsi`، ويعيدها بنفس الطريقة:`leaq 0x1(%rdi), %rax; leaq -0x1(%rsi), %rdx; retq`. .`big_ret(long long seed)`يعود 32 بايت، وهو ذاكرة الفئة، ويقول psABI "المدعو يوفر مساحة لقيمة العودة ويمر عنوان هذا التخزين في %rdi كما لو كان الحجة الأولى". `seed`يتحرك إلى`%rsi`، وبدأت الوظيفة بـ`movq %rdi, %rax`لأن " عند العودة %rax سوف تحتوي على العنوان الذي تم إدخاله من قبل المتصل في %rdi".

المنطقة الحمراء هي التوقيع الآخر للنظام V. psABI 3.2.2: "منطقة 128 بايت خارج الموقع الذي يشير إليه %rsp تعتبر محجوزة ولا يمكن تعديلها بواسطة معالجات الإشارة أو المقاطعة".`-O0`،`eight_args`هو`pushq %rbp; movq %rsp, %rbp`ثم ستة متاجر إلى`-0x8(%rbp)`من خلال`-0x30(%rbp)`بدون أي`subq`المتاجر تقع بـ 48 بايت تحت مؤشر الكمبيوتر`-O2`بناء`sum_varargs`يخصص 88 بايت مع `subq $0x58, %rsp`ثم يكتب مساحة حفظ السجل في `-0x58(%rsp)`إلى`-0x80(%rsp)`128 بايت تحت مؤشر كومة، المنطقة الحمراء بأكملها.`-mno-red-zone`و`leaf_add`يكتسب`pushq %rax`و`addq $0x8, %rsp`ليحافظ على 8 بايت من السكان المحليين فوق المؤشر

إضافة مسجل واحد. "%al يستخدم كحجة مخفية لتحديد عدد السجلات المتجهة المستخدمة"، الحدود العليا من 0 إلى 8. `call_varargs`يضعها مع`xorl %eax, %eax`في`-O2`و`movb $0x0, %al`في`-O0`. .`sum_varargs`يقرأها أولاً: `testb %al, %al; je`يقفز الثامن`movaps %xmmN`يحتفظ عندما لم يتم استخدام سجل المتجه.

## مايكروسوفت x64: المواقف، متجر الظل، و لا منطقة حمراء

قواعد مايكروسوفت هي موضعية. "تتم تمرير الحجج الكاملة في السجلات RCX ، RDX ، R8 ، و R9 . يتم تمرير حجج النقطة العائمة في XMM0L ، XMM1L ، XMM2L ، و XMM3L. " و" يتم تمرير أي حجج النقطة العائمة والدقة المزدوجة في المعلمات الأربعة الأولى في XMM0 - XMM3 ، اعتمادا على الموقع. "`mixed`يصل كـ`%ecx`،`%xmm1`،`%r8`،`%xmm3`: الفراغ 0 هو int، لذلك `RCX`؛ فتحة 1 هي مزدوجة ، لذلك `XMM1`السباق 3 هو عائم، لذلك`XMM3`. .`XMM0`و`XMM2`إبق فارغًا

يجب على المتصل أيضاً مغادرة الغرفة. "يجب على المتصل دائمًا تخصيص مساحة كافية لتخزين أربعة ملامح السجل، حتى لو لم يأخذ المتصل العديد من الملامح". الصفحات تدعوها متجر الظل أو عناوين المنزل، والحظير الأربعة "مملوكة بشكل فعال للعمل المطلوب". عند الدخول `0(%rsp)`هو عنوان العودة`8(%rsp)`إلى`39(%rsp)`هذه هي المنازل الأربعة، والحجة الأولى على كومة هي في`40(%rsp)`. .`eight_args`في`-O2`يقرأ`0x28(%rsp)`،`0x30(%rsp)`،`0x38(%rsp)`،`0x40(%rsp)`: 40، 48، 56، 64

الجانب المكالم يظهر الحساب`call8`في`-O2`هو`subq $0x48, %rsp`ثم متجر من 5، 6، 7، 8 في `0x20(%rsp)`إلى`0x38(%rsp)`قبل ذلك`movl $1, %ecx`و الأصدقاء. 72 بايت هو 32 لتخزين الظل، 32 لأربعة حجج كومة، و 8 حتى عنوان العودة هو على حدود 16 بايت. `call_varargs`لا يزال يكتب الحجج و لا يزال يخصص`subq $0x28, %rsp`: 32 للمخزن الظل و 8 للمواءمة`keeps`يدفع ثلاثة سجلات غير متطايرة (24 بايت) ثم `subq $0x20, %rsp`، لذلك`ext`يجد مخزن الظل الـ32 بايت تحت عنوان العودة

تتبع القواعد الخاصة بها. "أي حججة لا تناسب 8 بايت، أو ليست 1، 2، 4 أو 8 بايت، يجب أن تمر عبر مرجع". و "الحجج 16 بايت يتم مرجعها". `by_value`لذلك يتلقى مؤشراً لنسخة في `%rdx`، بعد مؤشر النتيجة المخفية في `%rcx`: "يجب على المدعو تخصيص الذاكرة لقيمة العودة وإرسال مؤشر لها كحجة أولى. يتم تحويل الحجج المتبقية بعد ذلك إلى الحجة الواحدة إلى اليمين". `call_pair`يُبني النسخة في `0x20(%rsp)`مع`movaps`، يمر`leaq 0x20(%rsp), %rdx`، يمر بمضخة النتيجة`leaq 0x38(%rsp), %rcx`، ويقرأ`.b`عودتي من`0x40(%rsp)`. . .

لا توجد منطقة حمراء. "يعتبر كل الذاكرة خارج عنوان RSP الحالي متقلبة: قد يقوم نظام التشغيل أو جهاز إزالة الحذاء بإعادة كتابة هذه الذاكرة خلال جلسة إزالة الحذاء المستخدم أو معالج إزالة الحذاء".`-O0` `leaf_add`يحتاج 8 بايت من المحليين و يحصل عليهم مع `pushq %rax`عند دخول و`popq %rcx`قبل ذلك`retq`، إرشادات واحدة بدلاً من`subq`و`addq`. صفحة الاستخدامات المتعددة تعريف الورقة التي يمكن أن تفعل هذا: "عمل الورقة هو واحد لا يتطلب إدخال جدول الوظائف. لا يمكن أن تجري تغييرات على أي سجلات غير متطايرة، بما في ذلك RSP".

يطلق Variadic على سجلاتهم. "للمهام المتغيرة أو غير النموذجية، يجب أن يتم نقل أي قيم نقطة عائمة في السجل العام المقابلة". `sum_varargs`في`-O2`المتاجر`%rdx`،`%r8`،`%r9`إلى`0x18(%rsp)`،`0x20(%rsp)`،`0x28(%rsp)`بعد واحد`pushq %rax`، وهو تعويضات الدخول 16، 24، 32: المنازل في المعلمات السجل الثاني، الثالث، والرابع.`va_list`هو`leaq 0x18(%rsp), %rax`، منزل`%rdx`، أول حجة غير مسموح بها

## AAPCS64، وما تغيره Apple

AAPCS64 6.8.2 يمر قائمة القواعد مع مقاسين. C.9: يتم نسخ الحجة التكاملية "إلى الأجزاء الأقل أهمية في x[NGRN]" وزيادات NGRN. C.1 يفعل الشيء نفسه للحجج في النقاط العائمة مع NSRN. C.12: مركبة من أقصى حد `8 - NGRN`يتم "نسخ الكلمات المزدوجة في سجلات ذات الغرض العام متتالية". يحدد C.13 "تعيين NGRN إلى 8" بمجرد أن يذهب الحجج إلى كومة، لذلك لا يعود أي شيء إلى السجلات بعد ذلك. `eight_args`استخدامات`x0`إلى`x7`و لا يلمس أبداً الكتلة`mixed`هو`w0`،`d0`،`x1`،`s1`. .`by_value`هو`x0`و`x1`في الداخل والخارج

6.9 يقول نتيجة التي سوف يتم إرسالها في السجلات "يتم إرجاعها في نفس السجلات"، وإلا "يجب إرسال عنوان كتلة الذاكرة كحجة إضافية للعمل في x8". `big_ret`يكتب`str x0, [x8]`،`stur q0, [x8, #0x8]`،`str x9, [x8, #0x18]`و لا يكتب أبداً`x0`. .`call_big`المجموعات`mov x8, sp`و`seed`يبقى في`x0`، لأن 6.9 يضيف "لا يوجد شرط على الجهاز للحفاظ على القيمة المخزنة في x8" و `x8`ليس أحد سجلات الحجج.

6.1.1: "يجب على دعوة فرعية الروتين الحفاظ على محتويات السجلات r19-r29 و SP. " 6.4.5.2: في واجهة عامة "SP mod 16 = 0". الدرجة التدريجية هي كاملة التنزيل و "لا يسمح لأي خيط بالوصول (للوصول إلى القراءة أو الكتابة) للمنطقة غير النشطة" أسفلها، لذلك لينكس `-O0` `leaf_add`الإصدارات`sub sp, sp, #0x10`لـ 8 بايت من السكان المحليين حيث استخدم النظام V المنطقة الحمراء

6.4.6 تعريف سجل الإطار: "سجل الإطار من قيمين 64 بت على كومة ... يجب أن تشير أدنى كلمة مضاعفة معلقة إلى سجل الإطار السابق والأكبر كلمة مضاعفة معلقة يجب أن تحتوي على القيمة التي تم تمريرها في LR عند دخول الوظيفة الحالية. " و" موقع سجل الإطار داخل إطار كومة غير محدد. " تشير المزج المواقع في هذا الملف الواحد. `keeps`في`-O2`على لينكس يضع السجل في الأسفل مع `stp x29, x30, [sp, #-0x30]!; mov x29, sp`نفس الوظيفة في`-O0`يضعها في القمة مع `sub sp, sp, #0x20; stp x29, x30, [sp, #0x10]; add x29, sp, #0x10`. . .

يحتفظ مذكرات Apple arm64 بالسجلات والمواءمة وتغيير الإطار والمنطقة الحمراء والدعوات المتغيرة. "يجب على سجل مؤشر الإطار (x29) دائمًا معالجة سجل الإطار الصالح. قد تختار بعض الوظائف ، مثل وظائف الورق أو دعوات الذيل ، عدم إنشاء إدخال في هذه القائمة".`keeps`يوفّر`x22, x21, x20, x19`أولاً و يضع القائمة على القائمة:`stp x29, x30, [sp, #0x20]; add x29, sp, #0x20`. "المسجلات الاحتياطية للمنظمات x18. لا تستخدم هذا السجل. " "المنطقة الحمراء ARM64 تتكون من 128 بايت مباشرة تحت مؤشر كومة" ، والصوت لا يزال ينبعث `sub sp, sp, #0x10`للـ`-O0`ورقة، لذلك لا يستخدمها المجمع بشكل افتراضي. يتم تعيين الحجج المتعددة "لعدد المناسب من فتحات كومة 8 بايت" و "أنواع va_list هو اسم مستعار ل char*". `call_varargs`في متاجر " آبل " من 10، 20، 30 إلى `[sp]`،`[sp, #8]`،`[sp, #0x10]`و يمر فقط`w0`؛ تمرير إعداد لينكس `w1`،`w2`،`w3`و التصويتات التالية مع`b extva`التفاح`sum_varargs`يقرأ`add x8, sp, #0x10`، مؤشر مكالمة المتصل ، كما هو `va_list`؛ لينكس `sum_varargs`يوفّر`x1`إلى`x7`و`q0`إلى`q7`في إطار 224 بايت ويقوم بتبديل حقل الهيكل `__gr_offs`إلى -56 و `__vr_offs`إلى -128 مع واحد `mov x8, #-0x38; movk x8, #0xff80, lsl #32`. . .

الرموز تختلف أيضاً. ماخ-او يُسجل كل رمز في "سي"`_`، لذا الإدراج يظهر`_keeps`والعمل الأول يظهر تحت العلامة الخاصة`ltmp0`. المحلل يُعيد تسمية العلامات عبر جدول الرمز

## فك المخططات الأولى يدوياً ثلاث مرات

`keeps(int n)`مكالمات`ext(i)`في حلقة ويحافظ`n`،`i`و`acc`على طول المكالمة، لذلك كل ABI يجب أن حفظ السجلات. اقرأ أول البايتات من`-O2`بناء لكل هدف

النظام V، 4 بايت:

1. `55`هو`push r64`مع السجل في القطع الثلاثة السفلية: `50 + 5`،`%rbp`عمق 8`%rbp`تم حفظها عند تعويض الدخول -8.
2. `41 56`: `41`هل REX مع `B`المجموعة`56`هو`50 + 6`. REX.B تمتد من 6 إلى 14: `pushq %r14`في -16.
3. `53`هو`50 + 3`: `pushq %rbx`في -24.

ثلاث دفعات هي 24 بايت. عنوان العودة يضيف 8 و 32 هو مضاعف 16 ، لذلك `callq ext`داخل الحلقة متوافقة بدون `subq`لا يوجد`movq %rsp, %rbp`لذا هذه البناء لا تملك مؤشر الإطار`%rbp`كمسجلة الوصول إلى الجهاز`acc`(`xorl %ebp, %ebp`،`addl %eax, %ebp`المشهد هو المرآة`5b 41 5e 5d c3`. . .

مايكروسوفت x64، 7 بايت:

1. `56`هو`pushq %rsi`عند -8`57`هو`pushq %rdi`في -16.`53`هو`pushq %rbx`في -24. كل ثلاثة غير متطايرة هنا، و`RDI`و`RSI`كانت سجلات الحجج تحت النظام V.
2. `48 83 ec 20`: REX.W، opcode `83 /5`مع 8 بتات فورية، ModRM `ec`هو`11 101 100`: `subq $0x20, %rsp`عمق 56

56 + عنوان العودة هو 64 ، متوافق. 32 بايت هو مخزن الظل الذي`ext`يسمح صفحة البيانات المختلفة فقط "إضافة RSP، ثابتة أو RSP، ثابتة [FPReg] ، تليها سلسلة من الصفر أو أكثر من 8 بايتات تسجيل الظهور والعودة أو jmp" ، والبايتات هي `48 83 c4 20 5b 5f 5e c3`. . .

أرك 64، 16 بايت في أربع كلمات،

1. `a9bd7bfd`هو`stp`مع مؤشر مسبق.`10`إختار سجلات 64 بت، بت 25:23 `011`إختار المؤشر المسبق، بت 22 هو 0 للمخزن. imm7 في بت 21:15 هو `1111010`، وهو -6 ، مقياس 8: -48. Rt2 عند 14:10 هو 30، Rn عند 9:5 هو 31 (`sp`), Rt عند 4: 0 هو 29. `stp x29, x30, [sp, #-0x30]!`: مؤشر الدرج يسقط 48`x29`يذهب إلى -48 و `x30`إلى -40.
2. `f9000bf5`هو`str`مع تعويض غير مؤلف من 12 بت مقياس 8: imm12 في 21:10 هو 2 ، Rn هو `sp`، ريت هو 21 `str x21, [sp, #0x10]`، تعويض دخول -32.
3. `910003fd`هو`add`فوري: imm12 هو 0، Rn هو `sp`، ردي هو 29`mov x29, sp`: مؤشر الإطار يشار إلى -48
4. `a9024ff4`هو`stp`مع تعويض مؤلف: imm7 هو 4 ، مقياس إلى 32. Rt2 هو 19 ، Rt هو 20. `stp x20, x19, [sp, #0x20]`: `x20`في -16, `x19`عند -8

الإطار 48 بايت:`x29`عند 0`x30`في الثامنة`x21`عند 16، 8 بايت من التشغيل عند 24، `x20`في 32`x19`في 40، أقل كلمة في السجل تشير إلى السجل السابق والكلمة التالية تحتوي على LR، كما يتطلب 6.4.6. `cmp w0, #0x1`يقع بين المخزن الأول والثاني، قام المخطط بتحويله إلى المخطط، ويحمل المحلل مقارنة أو تعليمات حسابية بين عمليات كومة.

## كتب المجمّع نفس الحقائق مرتين

تحليل المبتكر هو مشتق واحد. يقوم المُجمّع بإصدار آخر لـ (المتخفّف) ، ويجب أن يوافق الاثنان.

على ويندوز النتيجة الثانية هي`.pdata`و`.xdata`. بناء`-O2`كائن بدون`-fno-asynchronous-unwind-tables`و`llvm-objdump -h`تظهر`.xdata`من 0x34 بايت و `.pdata`من 0x48 بايت. 0x48 هو 72, ست `RUNTIME_FUNCTION`إدخالات من 12 بايت مع ثلاثة `IMAGE_REL_AMD64_ADDR32NB`كلّ منكم يُنقل`sum_varargs`،`keeps`،`call8`،`call_varargs`،`call_pair`و`call_big`. وظائف الستة الأخرى هي الأوراق، ويقول صفحة التعامل مع الاستثناء "إذا لم يجد البحث إدخال جدول الوظائف، يفترض أن يكون الرمز جزءًا من وظيفة الأوراق، و RSP يُعطي إشارة العودة مباشرةً".

- نعم`.xdata`البايتات`keeps`هل هي`01 07 04 00 07 32 03 30 02 70 01 60`. .`UNWIND_INFO`يبدأ مع النسخة في 3 بتات و العلامات في 5 بتات: النسخة 1 ، لا العلامات. حجمProlog هو 7 ، CountOfCodes هو 4 ، FrameRegister و FrameOffset هي 0. كل `UNWIND_CODE`هو تعويض في المنتج الأول والبايت من رمز الخيارات والمعرفة. `07 32`: في التسعير 7 ، والعمل 2 هو `UWOP_ALLOC_SMALL`، المعلومات 3 يعني`3 * 8 + 8 = 32`البايتات`03 30`: op 0 هو `UWOP_PUSH_NONVOL`, السجل 3 هو`rbx`. .`02 70`: `rdi`. .`01 60`: `rsi`يتم تخزين الرموز في ترتيب معاكس من التنفيذ، وتحوي نفس الأطراف الثلاثة وتوزيع 32 بايت كما البايت `56 57 53 48 83 ec 20`- المُؤمنون`sum_varargs`الدخول هو`01 01 01 00 01 02 00 00`: إضافة 1 بايت مع رمز واحد،`UWOP_ALLOC_SMALL`من 8 بايت. هكذا يرى المتحرك`pushq %rax`: تخصيص، لأن `%rax`هو متطاير ولا يتم حفظ أي شيء.

على لينكس النتيجة الثانية هي`.eh_frame`، التي تعرّفها المادة 4.2.4 وترمز في القسم 6.4 من DWARF 5. `llvm-dwarfdump --eh-frame`على الكائن الذي يمكن نقله يطبخ FDE واحد لكل وظيفة ويحل`R_X86_64_PC32`التنقلات، حتى تكون النطاقات قابلة للاستخدام.`keeps`:

```text
  DW_CFA_def_cfa_offset: +16
  DW_CFA_def_cfa_offset: +24
  DW_CFA_def_cfa_offset: +32
  DW_CFA_offset: RBX -32
  DW_CFA_offset: R14 -24
  DW_CFA_offset: RBP -16
```

CFA هو مؤشر كومة قبل الدعوة، 8 فوق مؤشر كومة دخول، لذلك `RBP -16`هو تعويض الدخول -8، `R14 -24`هو -16, `RBX -32`هو -24, وأعمق تعويض CFA من 32 هو الإطار 24 بايت زائد عنوان العودة.`keeps`يقول`DW_CFA_def_cfa: W29 +48`مع`W29 -48`،`W30 -40`،`W21 -32`،`W20 -16`،`W19 -8`هناك CFA هو مؤشر كومة الدخول نفسه، لذلك تعتبر التداعيات هي التداعيات الإطارية دون تحويل، ويتم تعريف CFA من `x29`بينما سجل الإطار على الهواء`eh_frame_cross_check()`يقدم هذا المقارنة لجميع 12 FDE من كلا الكائنات.`call8`تحت النظام V يدفع اثنين من الحجج الخارجة في منتصف الجسم، لذلك أعمق تعويض CFA هو 32 بينما إطار البروج هو 8، والتحقق يقارن أعمق مؤشر كومة الجسم يصل، 24 زائد 8.

## ما الذي تسميه الأدوات هذا

كل أداة في هذا المجال لديها بنية بيانات لمؤتمر الدعوة والمرور الذي يعين واحد لمهام. تختلف الأسماء والفجوات. يتم وصف الأدوات المغلقة من وثائقها. تم تشغيل الأدوات المفتوحة على الأجهزة وتتم تسجيل إنتاجها إلى جانب الأشياء.

**Ghidra 12.1.4 (Apache-2.0).**القواعد تعيش في ملفات مواصفات المُجمّع،`.cspec`، بجانب لغة "سليغ"`x86-64-gcc.cspec`يعلن عن`<default_proto>`اسمها`__stdcall`، "مستمد من نظام V التطبيقات واجهة ثنائية AMD64 معمليات المعالجة الهندسة المعمارية أبريل 2016"، مع `<pentry>`القوائم لـ`XMM0_Qa`إلى`XMM7_Qa`و`RDI, RSI, RDX, RCX, R8, R9`, دخول كومة في التسويق 8 , a `join_dual_class`القاعدة للأنواع التي تصل إلى 16 بايت، المخرجات `XMM0_Qa, XMM1_Qa, RAX, RDX`و`hidden_return`للبقية`x86-64-win.cspec`يعلن`__fastcall`مع أربعة`<group>`العناصر التي تتزامن`XMM0_Qa`مع`RCX`،`XMM1_Qa`مع`RDX`، وهكذا، والتي هي القاعدة الموضعية، مدخل كومة في التكفيف 40، `convert_to_ptr`بالنسبة لخطوط ذات 3، 5، 6 أو 7 بايت مع تعليق "يمكن إغلاق خطوط ذات حجم 8,16,32,64 بيت فقط للتسجيل"`unaffected`الإدراج`RBX RBP RDI RSI RSP R12`إلى`R15`و`XMM6`إلى`XMM15`و`localrange`من كومة 8 إلى 39، وهو متجر الظل. `AARCH64.cspec`يعلن`__cdecl`والذي يُدخل أولاً`x8`مع`storage="hiddenret"`، ثم`q0`إلى`q7`و`x0`إلى`x7`،`convert_to_ptr`لخطوط ذات 17 بايت أو أكثر، و `killedbycall`بما في ذلك`x8`مع تعليق "سجل الموقع غير المباشر للنتيجة ، والذي لا يعكس في قائمة المنتج". تدعى المرحلة النهائية لتحميل "مثيل عمل إقامة" ؛ المحللين "مثيل الاتفاقية الدعوة" و "مثيل إشارة التحميل". اختيار البرنامج "تقييم النمط" يختار النموذج الافتراضي.

**IDA Pro and IDA Free (Hex-Rays, commercial; current release 9.4, build 9.4.260714).**نوع الوظيفة هو إعلان C المحدد من خلال SetType، و "سوف يستخدم IDA معلومات النوع للتعليق على التفكيك مع المعلومات حول حجج الوظيفة". يتم كتابة المواقع التي لا تنتجها أي اتفاقية قياسية في اتفاقية IDA الخاصة: `int __usercall func@<ebx>(int x, int y@<esi>)`يضع النتيجة في`EBX`و`y`في`ESI`و`@<^12.4>`أسماء موقع كومة حسب التداخل والحجم. `__userpurge`نفس الشيء مع تنظيف كومة الكاليه نفس الصفحة قائمة`__spoils`للكتلة المزججة`__hidden`،`__return_ptr`و`__struct_ptr`للحقائق الضمنية هذه الدروس تسترد يدويا. عمل "Decompile as call" من المتحلل يقبل `__usercall`النموذج الأول للتعليمات الواحدة. IDA Free يدعم x86 و x86-64 فقط.

**Binary Ninja 6.0 "Krypton" (Vector 35, commercial, with a Free edition that decompiles x86, x86_64, ARMv7, and AArch64).**أ`Platform`"يحتوي على كل المعلومات المتعلقة بيئة تنفيذ الثنائي، وخاصة الاتفاقيات الدعوة المستخدمة، والنظام التشغيلي، والهندسة المعمارية" ويتضمن القائمة `linux-x86_64`،`windows-x86_64`،`linux-aarch64`و`mac-aarch64`، كل واحد مع `default_calling_convention`.`CallingConvention`- نعم`int_arg_regs`،`float_arg_regs`،`callee_saved_regs`،`caller_saved_regs`،`int_return_reg`،`high_int_return_reg`،`float_return_reg`، و 2 أعلام تشفر الاختلافات في هذا الدروس مباشرة:`arg_regs_share_index`"عندما يكون True، فإن الحجة Nth تستغرق فتحة Nth من كل من القوائم الإعدادية والسجلات العائمة بغض النظر عن نوعها" ، و `stack_reserved_for_arg_regs`، "مساحة الظل / المنزل المستخدمة من قبل Windows x64 الاتفاقية الدعوة". `eligible_for_heuristics`،`required_arg_regs`و`required_clobbered_regs`تحديد المواقف السرية. أنواع المنصات هي أصول C تحت `types/platform/`واحد لكل اسم منصة

**radare2 6.2.4 (LGPL-3.0, run here).** `afcl`يردد الاتفاقيات التي يعرفها مكونات المكونات: `amd64 amd64syscall dlang golang golang_abi0 ms p9 reg swift`لـ x86-64 و `arm64 dlang golang p9 reg swift`لـ (أرك64). `afc`تقرير عن اتفاقية الوظيفة الحالية`afcr`بصمات`cc.amd64.arg0: rdi`من خلال`arg5: r9`و`ret0: rax`، والملفات الشخصية هي ملفات SDB تسمى`cc-ARCH-BITS.sdb`. رادار2 اخترت`amd64`لـ (الـ) كائن ELF و`ms`لـ كائن COFF، وهو الانقسام الصحيح. `afv`قائمة بالحقائق والمتغيرات، و `afs`يطبخ توقيعاً على لينكس`-O2`الموضوع`afv`وجدت سبعة حجج ل`eight_args`و سقطت`rcx`على جسم ويندوز الذي وجدته`rcx, rdx, r8`و أربعة فتحات و سقطت`r9`كلا السجلين المفقودين يظهرون فقط داخل`lea`. على`mixed`لقد أبلغت`double arg1 @ xmm0, arg2 @ xmm1, arg3 @ xmm2`على لينكس ولا توجد حجج على الإطلاق على ويندوز. على AArch64 وجدت`x0`إلى`x7`لـ`eight_args`وبالنسبة`big_ret`لقد تم سردها`x0`و`double arg2 @ d1`حيث يقرأ الوظيفة`x8`و تحميل ثابتة في `q1`كلّ شخص`afs`التوقيع يبدأ بـ`void`لأن نوع العودة لا يتم استنتاجها`-O0`حيث يتم تخزين كل حججة في الإطار`afv`وجدت جميع الحجج الثمانية`eight_args`مع`rbp+0x10`و`rbp+0x18`للزوجين

**rizin 0.9.1 (LGPL-3.0, run here) and Cutter 2.5.0.** `afcl`القوائم`amd64 amd64syscall ms reg swift`. .`afc`أعيد`amd64`لـ COFF، إذاً وجود ملف Microsoft لم يتم اختياره من النموذج. `afi`أدرجت سبعة حجج لـ`eight_args`على لينكس، مرة أخرى دون `rcx`، و على Windows `r8, rcx, rdx`مع ثلاث فتحات، بدون `r9`وبدون فتحة في`0x40`. .`afv`لا يوجد ، أمر الإدراج هو`afvl`كاتر هو الجانب الجانبي على (ريسين)

**angr 10.0.3 (BSD-2, run here).** `CFGFast`يليها `CompleteCallingConventions(recover_variables=True)`المجموعات`function.calling_convention`إلى`SimCCSystemVAMD64`،`SimCCMicrosoftAMD64`أو`SimCCAArch64`، في شكل ثنائي، و `function.prototype`لقد استعادت جميع الحجج الثمانية`eight_args`على كل الهدف الثلاثة، المؤشر الخفي من`big_ret`على x86-64 ك `(BOT*, long long) -> BOT*`، هياكل الإشارة المشتركة للنوافذ`by_value`كـ`(BOT*, BOT*) -> BOT*`، و النظام V المتغير `sum_varargs`كـ`(long long, ...)`فجواته مختلفة عن الرادار2`mixed`عاد كـ`(long long, long long, double, float)`في النظام V و AArch64، تسجل الجهات الصحيحة بالترتيب الخطأ، لأن قائمة الأعداد الكاملة يتم طباعتها قبل قائمة العائمة.`big_ret`عاد كـ`(long long) -> double`، لذا`x8`لم يتم إلقاء نظرة على الإجتماع ويتم قراءة مخازن المتجهة نتيجة لذلك ، و`sum_varargs`عدت مع 16 ملامح، كل السجل حفظ المساحة.

**Others.**هوبر 6.6.0 هو إزالة التجميع والتفكيك التجاري ل macOS و Linux؛ لم يتم تشغيل أو توثيق معالجة الاتفاقيات الخاصة به لهذا الدروس.`frame info`و`register read`يظهر المجمع Explorer القوائم الثلاث جنبا إلى جنب من المصدر، وهو أسرع طريقة لتحديد قاعدة قبل البحث عنها في البايت.

| Concept | Ghidra | IDA | Binary Ninja | radare2 / rizin | angr | this lesson |
|---|---|---|---|---|---|---|
| The convention object | `prototype` in a `.cspec` | calling convention keyword in the function type | `CallingConvention` on a `Platform` | `afc` name, `cc-ARCH-BITS.sdb` | `SimCC` subclass | `expected_locations(abi, name)` |
| Default per target | `<default_proto>` per cspec | compiler setting | `Platform.default_calling_convention` | `afc=`, `anal.cc` | by format | `describe_object()` |
| Argument registers | `<pentry>` list, `<group>` for positional | `@<reg>` in `__usercall` | `int_arg_regs`, `float_arg_regs`, `arg_regs_share_index` | `cc.NAME.argN` | `ARG_REGS`, `FP_ARG_REGS` | `INT_ARG_REGS`, `FLOAT_ARG_REGS` |
| Shadow store | `localrange` stack 8 to 39 | implicit | `stack_reserved_for_arg_regs` | `cc.ms.argn=stack` | `STACKARG_SP_DIFF` | `STACK_ARG_BASE[WIN64] = 40` |
| Hidden result pointer | `hidden_return`, `storage="hiddenret"` | `__return_ptr`, `__hidden` | return type too large for `int_return_reg` | not modelled | `BOT*` first argument | `HIDDEN_RETURN_REG` |
| Callee-saved | `<unaffected>` | `__spoils` lists the opposite | `callee_saved_regs` | profile | `CALLEE_CLEANUP` and arch | `CALLEE_SAVED` |
| Assigning one to a function | "Call Convention ID" analyzer, "Establish Function's Prototype" | user or type library | heuristic detection with `required_arg_regs` | `afc`, `afva`, `aaft` | `CallingConventionAnalysis` | read-before-write plus the rulebook |

## بناءها

أطلق التجربة:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
```

إنتاج هو تقرير JSON واحد. لكل من السبعة الأشياء يطلق على النموذج، والآلة، والإب.إي.بي، ولكل من الوظائف الثانية عشرة يقدم البايتات البروجوجية، والسجلات المحفوظة مع تعويضات الدخول، وحجم الإطار، ومؤشر الإطار، ومؤشر الإطار، ومؤشر المعلمات، ومؤشرات الحجج المتعثرة، والسفائر، ومؤشر العودة أو المخفي، وعمق الدعوة، ومؤشرات الخروج ومخازن المندعين. تنتهي كل وظيفة بمراجعاتها: القاعدة والقيمة المتوقعة من التوقيع والقيمة الملاحظة من البايتات، وما إذا كانت توافق. و ينتهي التقرير بالتحققين المتقاطعين والآلة التي يتم التقاطها. في 84 تحليل وظيفي، تم إجراء 489 عملية فحص ويتفق جميع 489.

الشكل المتوقع:

```json
{
  "objects": {
    "convention-x86_64-windows-O2": {
      "format": "COFF", "machine": "AMD64", "abi": "Microsoft x64", "checks": "73/73 agree",
      "functions": {
        "keeps": {
          "prologue": ["56  pushq %rsi", "57  pushq %rdi", "53  pushq %rbx", "48 83 ec 20  subq $0x20, %rsp"],
          "frameBytes": 56,
          "savedRegisters": [{"register": "rsi", "entryOffset": -8}, {"register": "rdi", "entryOffset": -16}, {"register": "rbx", "entryOffset": -24}],
          "parameterRegisters": ["rcx"],
          "returnRegisters": ["rax"],
          "calls": [{"callee": "ext", "depth": 56}],
          "checks": [{"rule": "Microsoft x64: the caller must always allocate ...", "expected": "at least 32 bytes ...", "observed": [56], "agree": true}, "..."]
        }
      }
    }
  },
  "sehCrossCheck": ["..."],
  "ehFrameCrossCheck": {"...": "..."}
}
```

اقرأ`code/main.py`في هذا الترتيب:

1. `describe_object()`يقرأ رأس ELF أو COFF أو Mach-O والجدول الرمزي ويرد ABI وقائمة الوظائف.
2. `parse_listing()`يفرق`llvm-objdump -d -r`يحتفظ الهدف من نقل كل مكالمة وقفز، ويخرج التعليقات مع علامة النص المطلوب: `#`لـ AT&T`//`و`;`لـ AArch64 ، حيث `#`يُدخل فوريًا.
3. `effect_x86()`و`effect_arm()`تحويل تعليمات واحدة إلى قراءة، قراءة العنوان، كتابة، تحميل، المحلات التجارية، و دلتا مؤشر كومة. آخر أوبراند AT&T هو الوجهة؛ أول أوبراند AArch64 هو الوجهة باستثناء المحلات التجارية، المقارنة، والفروع. `lea`يقرأ عنوان ولا يحمل أي شيء`mov`،`cvtsi2sd`،`setcc`، والعبارة الصفرة`xor r, r`هو كتابة فقط. مكالمة تكتب مجموعة متقلبة كاملة. متجر مقدم للتصفية يتحرك`sp`قبل وصوله و بعد تحميل المرجعي
4. `analyze_function()`يمر الجسم مرة واحدة حتى الأولى `ret`أو قفزة الذيل. يتتبع عمق مؤشر كومة أقل من قيمته الدخول، لذلك عمل ذاكرة`disp(%rsp)`هو في المواجهة المدخول `disp - depth`و`disp(%rbp)`هو في`frame_pointer + disp`. يسجل سجلات فئة الحجج التي يتم قراءتها قبل كتابتها، ويحمل في أو فوق أول سجل حجة كومة تعويض من ABI، وتخزين سجلات الحجج في الإطار، والوصول أسفل مؤشر كومة الحالية، والعمق في كل مكالمة.
5. `_return_registers()`يحتفظ سجل النتائج عندما يكون آخر وصول له قبل الخروج كتابة. قراءة كعمل بيانات تقتل المرشح. قراءة كقاعدة عناوين لا، وهو ما يحافظ `rax`حيّة في`big_ret`تحت مايكروسوفت x64 ، حيث `movq %rcx, %rax`يتبعها المتاجر من خلال `(%rax)`. . .
6. `expected_locations()`يطبق ثلاثة كتب القواعد على توقيع C: القائمة System V مع فئات ثمانية بايت، وفرق Microsoft الموضعية مع إشارات إشارة، و AAPCS64 معدادات `x8`لنتائج تتجاوز 16 بايت.
7. `run_checks()`يُقارن الاثنين ويضيف قواعد الإطار: يجب حفظ السجلات المكتوبة التي يتم حفظها من خلال الدعوات، `(rsp + 8) % 16 == 0`أو`sp % 16 == 0`في كل مكالمة، 32 بايت من الظل في كل مكالمة مايكروسوفت، لا توجد إمكانية الوصول تحت المؤشر المتعثر تحت مايكروسوفت و AAPCS64 و ما لا يزيد عن 128 بايت تحت النظام V، و إيبيلوغ الذي يعكس المبادئ الأولية مع مؤشر المتعثر مرة أخرى في قيمة دخولها.
8. `seh_cross_check()`و`eh_frame_cross_check()`قراءة بيانات التوقف عن التحول من الأشياء التي بنيت دون `-fno-asynchronous-unwind-tables`و قم بتقارنةها مع تحليل المبدء

هناك ثلاثة أوامر أخرى`python3 code/main.py analyze convention-x86_64-windows-O2 keeps`يطبخ وظيفة واحدة`python3 code/main.py object FILE`يطبخ قرار الرأس`python3 code/main.py seh`يطبع الرمز المفكّر`UNWIND_INFO`من كل وظيفة لديها واحدة.

## استخدمها

استخدم المحلل بهذه الترتيب على جسم جديد قمت ببناءه

1. أركض`python3 code/main.py object FILE.o`واكتب ABI الذي يسميه. إذا كان الرأس و إقامة أمرك لا يوافقون، توقف؛ واحد منهم خاطئ.
2. القبض`llvm-objdump -d -r FILE.o`قراءة البايتز البروجوج والسجلات المحفوظة قبل أي شيء آخر، ومقارنة حجم الإطار مع الضغطات وال `sub`. . .
3. اقرأ سجلات المعلمات وتعديلات الكمبيوتر ضد توقيع المصدر الخاص بك. سجل لا يفسر توقيع هو مؤشر مخفي، علامة متغيرة، أو سجل خدش الذي أخطأ المحلل مع حججة. الحالة الأخيرة هي خطأ في جدول التأثيرات. إصلاحها مع قاعدة عامة لهذا التعليم.
4. اقرأ التحققات التي تختلف، إذا كانت هناك، كل اسم القاعدة التي تستند إليها، لذا أول شيء يجب التحقق منه هو القاعدة، ثم البايت، ثم المحلل.
5. عندما يكون لدى الكائن بيانات إزالة، قم بالتحقق المتقاطع. مشتقات متفقتان هي أقوى دليل هذا الدروس تنتج.
6. عندما يتم تثبيت أداة أخرى، التقاط المخرج مع الأمر الدقيق ومقارنة. حيث توافق لديك ثلاثة مشتقات. حيث يختلف لديك سجل محدد وتعليم محدد للنظر في، وهذا هو العثور على الدروس 35.

## المختبر التفاعلي

### المختبر (أ): تعليم واحد، ثلاثة تأثيرات

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/code
python3 -q
```

أركض

```python
from main import *
effect(Instruction(0, "48 8d 04 0a", "leaq", "(%rdx,%rcx), %rax"), SYSV)
effect(Instruction(0, "f2 0f 2a d7", "cvtsi2sd", "%edi, %xmm2"), SYSV)
effect(Instruction(0, "a9bd7bfd", "stp", "x29, x30, [sp, #-0x30]!"), AAPCS64)
```

اكتب القراءات والعنوان القراءة والكتابة والثلتا المتوقع قبل كل مكالمة ثم تغيير`[sp, #-0x30]!`إلى`[sp], #0x30`مع`ldp`وراقب التحرّك من دلتا`sp_delta`إلى`post_sp_delta`. . .

### المختبر ب: إطار الحفظات

```python
info, listing = load_fixture("convention-aarch64-linux-O2")
keeps = analyze_function("keeps", listing["keeps"], info.abi)
keeps.saved
keeps.frame_pointer
[c.to_dict() for c in frame_cells(keeps)]
```

مقارنة التخفيضات مع رمز اليد أعلاه ثم تحميل`convention-arm64-macos-O2`و تشغيل نفس الخطوط الثلاثة، سجل ينتقل إلى -16 و أربعة سجلات تقع تحتها. ثم تحميل`convention-x86_64-linux-O2-fp`و اقرأ`saved`لـ`keeps`: مؤشر الإطار هو مرة أخرى، وكذلك هو `pushq %rax`والذي وظيفته الوحيدة هي أن تقوم`(rsp + 8)`مضاعف 16 عند المكالمة.

### المختبر (ج): قراءة قبل الكتابة على مخلوط

```python
info, listing = load_fixture("convention-x86_64-linux-O2")
mixed = analyze_function("mixed", listing["mixed"], info.abi)
mixed.param_registers
mixed.return_registers
expected_locations(SYSV, "mixed")["parameters"]
expected_locations(WIN64, "mixed")["parameters"]
```

قائمة النظام V هي`rdi, xmm0, rsi, xmm1`و قائمة مايكروسوفت هي`rcx, xmm1, r8, xmm3`الآن قم بتحميل كائن ويندوز وتشغيل الخطوط الثلاثة الأولى مرة أخرى ثم افتح رادار2 التقاط للكائن لينكس وبحث`[afv mixed]`: ثلاثة مزدوجة. ابحث عن التعليمات التي تفسر الثالثة.

### المختبر D: رأي الثاني من المُحَرِّر

```python
for row in seh_cross_check():
    print(row["function"], row["sizeOfProlog"], row["unwindPushes"], row["unwindAllocBytes"], row["agree"])
for row in eh_frame_cross_check("convention-x86_64-linux-O2-eh"):
    print(row["function"], row["cfiSaved"], row["cfiMaxOffset"], row["deepestStack"], row["agree"])
```

إبحث عن`pushq %rax`من`sum_varargs`في جدول SEH ويشرح لماذا يكتب رمز التسريح كمخصص. ثم العثور على `call8`في`.eh_frame`و أوضحوا 32

## مختبر التدريب

أضف هدف رابع و كتاب قواعد رابع

المتطلبات:

- قم بتجميع`convention.c`مع`-target x86_64-apple-macos -O2`و تلتقط قائمةها`describe_object()`لاقراءة ماخ-او `cputype`0x01000007 و خريطه إلى نظام V psABI، الذي تتبعها أبل على x86-64, مع `_`علامة المُسبق
- تحقق من أن كل وظيفة تتفق مع التحققات النظام V. سجل الفرق الوحيد الذي تجده في المبادئ الأولية: داروين يحتفظ بمؤشر الإطار في كل مستوى من التحسينات.
- إضافة`-fstack-protector-strong`بناء من كائن لينكس x86-64 . تمديد المسح البروج حتى تحميل القناري من `%fs:0x28`و المتاجر تحت السكان المحليين مسجلة كـ`canary`الخلية، والمقارنة قبل `ret`كالشيك الذي يحرس المقال
- إضافة اختبار يفشل عندما يعتبر متجر القناري حجة سلبية
- اكتب الإطار`with_canary`-الرمز النمطي يدوياً قبل تشغيل المحلل، وابق الرسم بجوار الاختبار.

النجاح يعني`python3 code/main.py`يبلغ الكائن الجديد مع كل مراجعة توافق، وخلايا الإطار من وظيفة المحمية تظهر القناري بين السجلات المحلية والمنقذ.

## درساً أساسياً

هذا الدروس يتضمن`outputs/skill-calling-conventions-and-stack-frames.md`استخدمها لتحويل كائن قمت بإنشائه، وإدراجها، وتوقيعات C إلى مواقع المعلمات، وتخطيط الإطار، سجل العودة، ومراجعة كل استنتاج ضد القاعدة التي تستند إليها ومع بيانات التنسيق المتكامل.`cvtsi2sd`أو`xor r, r`المواقع كما يقرأ، و ينتهي بالخلاف الأول.

## تحقق من ذلك

إشغال التجربة والسلسلة التحديدية:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

يجب أن تثبت التحقق:

- الرؤوس ELF و COFF و Mach-O لسبعة كائنات اسم نظام V و Microsoft x64 و AAPCS64 و Apple arm64
- كل جدول رمزية من الأشياء يرد نفس اثني عشر وظيفة، مع ماخ-او `_`المقبل والـ`ltmp0`اللوحة حل
- المصفح الرائد يحافظ على قائمة`ext`كهدف المكالمة ويحافظ على AArch64 على الفور مثل `#-0x30`غير متأثر
- `leaq (%rdx,%rcx), %rax`يقرأ سجلين من السجلات ولا يحمل أي شيء`xorl %eax, %eax`و`cvtsi2sd`هي كتابة فقط ، مؤشر مسبق`stp`تحركات`sp`قبل المتجر و بعد التسجيل`ldp`بعد الحمل
- `keeps`في`-O2`هو`55 41 56 53`على النظام V مع إطار 24 بايت و لا مؤشر إطار، `56 57 53 48 83 ec 20`على مايكروسوفت x64 مع إطار 56 بايت، و `a9bd7bfd`أول على AArch64 مع السجل في -48
- إنّ إعداد Apple يضع السجل عند -16 فوق أربعة سجلات مدخنة
- كل وظيفة لديها مؤشر الإطار في `-O0`على لينكس ولا يوجد`-O2`و`-fno-omit-frame-pointer`يعيدها مع دفع التوجه
- الموقع`-O0`يستخدم ورقة 8 بايت من المنطقة الحمراء تحت النظام V، `pushq %rax`تحت مايكروسوفت x64، و `sub sp, sp, #0x10`بموجب AAPCS64`-mno-red-zone`يزيل استخدام المنطقة الحمراء
- كل قصة تعكس مقدمتها ومرجع الدليل في الموقع
- `eight_args`يقرأ ستة سجلات وفرق 8 و16 ، أربعة سجلات وفرق 40 إلى 64 ، أو `x0`إلى`x7`، على مستويات التحسين
- `mixed`هو`rdi, xmm0, rsi, xmm1`في النظام V و `rcx, xmm1, r8, xmm3`تحت مايكروسوفت x64 ، مع `xmm0`نتيجة لذلك على كلتا
- يمر الهيكل البيط 16 في سجلين تحت النظام V و AAPCS64 وبتحديد خلف مؤشر مخفي تحت Microsoft x64
- إنّه يُرجع إلى الـ 32 بايت`rdi`،`rcx`أو`x8`
- القول المتغير يقرأ`%al`, المنازل`rdx, r8, r9`في 16، 24، 32، ينقذ `x1`إلى`x7`و`q0`إلى`q7`أو يقرأ مؤشر مكالمة المتصل على Apple
- يضع المتصلون السجلات المتوقعة، ويحفظون 7 و 8 عند 0 و 8 أو 5 إلى 8 عند 32 إلى 56، صفر `%al`للدعوة المتغيرة، وإرسال عنوان البوفر النتيجة في `rdi`،`rcx`أو`x8`
- جميع 489 عملية التحقق توافق على قواعدهم
- الستة`UNWIND_INFO`الإدخالات تتطابق مع البداية و لا يوجد أي أوراق
- 24 FDE تتطابق مع تعويضات السجل المحفوظ وأعمق مؤشر كومة
- الوسيلة تسجل رادار2 `amd64`و`ms`، (ريزن)`amd64`على كائن COFF، المفقود `rcx`، الثلاثة مزدوجة، و النماذج الأولية Angr
- البيانات الرقمية المضمنة في وحدة الموقع تساوي خروج المحلل

## أساليب فشل الإنتاج

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| COFF object read as System V | `rdi` and `rsi` as arguments that the function never reads | The header says 0x8664; the convention is Microsoft x64 |
| Register read only inside a `lea` | Seven arguments for an eight-argument function | Base and index registers are reads |
| `cvtsi2sd` destination counted as a read | A third double argument in `xmm2` | The first write to `xmm2` is a write; `mixed` has two SSE arguments |
| Positional slots read as sequences | `xmm0` named as the double argument on Windows | Slot 1 is `XMM1`, slot 3 is `XMM3` |
| `push rbp` taken as a frame pointer | A frame pointer in an `-O2` function that uses `rbp` as an accumulator | Only `mov %rsp, %rbp` after the push creates one |
| Red zone measured from the entry stack pointer | 216 bytes "below the stack pointer" | 128 bytes below the current stack pointer after an 88-byte `sub` |
| Shadow store treated as locals | Stack arguments at 8 to 32 | Microsoft stack arguments start at 40 |
| `lea` treated as a load | A stack argument at `0x60(%rsp)` in a variadic callee | `lea` computes `overflow_arg_area`; it loads nothing |
| Hidden pointer read as a normal argument | `big_ret(void *, long long)` | The pointer is stored through and copied to `rax`, `rax`, or stays in `x8` |
| Deepest CFA compared with the prologue frame | A mismatch on a caller that pushes outgoing arguments | Compare with the deepest stack pointer the body reaches |
| Convention asserted from the ISA | `amd64` for a COFF object | The format picks the rulebook, then the ISA picks the registers |
| Prototype trusted from one tool | Three doubles, or sixteen variadic parameters | The source signature or a second derivation must agree |

## قاعدة العمليات

اقرأ الرأس قبل التعليمات الأولى، وتسمي كتاب القواعد. ضع كل سجل مدفوع وكل حججة في تعويض من مؤشر كومة الدخول، و تحقق منه ضد القاعدة التي وضعته هناك ومع بيانات التسريح التي كتبها المجمع لنفس الإطار. تعامل نموذج أداة كطالب حتى تؤكدها البايتات أو المصدر.

## المزيد من القراءة

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Version 1.0 (sections 3.2.1 to 3.2.3, 4.2.4)](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Microsoft x64 calling convention](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention)
- [Microsoft x64 stack usage](https://learn.microsoft.com/en-us/cpp/build/stack-usage)
- [Microsoft x64 prolog and epilog](https://learn.microsoft.com/en-us/cpp/build/prolog-and-epilog)
- [Microsoft x64 exception handling: RUNTIME_FUNCTION, UNWIND_INFO, UNWIND_CODE](https://learn.microsoft.com/en-us/cpp/build/exception-handling-x64)
- [Arm Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), release 2025Q4](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Apple: Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [DWARF Debugging Information Format Version 5, section 6.4 Call Frame Information](https://dwarfstd.org/doc/DWARF5.pdf)
- [Clang driver frame-pointer defaults, `useFramePointerForTargetByDefault` in `CommonArgs.cpp`](https://github.com/llvm/llvm-project/blob/main/clang/lib/Driver/ToolChains/CommonArgs.cpp)
- [Clang command line reference: `-fomit-frame-pointer`, `-momit-leaf-frame-pointer`](https://clang.llvm.org/docs/ClangCommandLineReference.html)
- [Fedora 38 change: frame pointers by default](https://fedoraproject.org/wiki/Changes/fno-omit-frame-pointer)
- [Ubuntu 24.04: performance engineering with frame pointers by default](https://ubuntu.com/blog/ubuntu-performance-engineering-with-frame-pointers-by-default)
- [Ghidra compiler specification: `x86-64-gcc.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-gcc.cspec)
- [Ghidra compiler specification: `x86-64-win.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-win.cspec)
- [Ghidra compiler specification: `AARCH64.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/languages/AARCH64.cspec)
- [Hex-Rays: SetType and the `__usercall` convention](https://docs.hex-rays.com/ida-actions/settype)
- [Hex-Rays: Decompile as call](https://docs.hex-rays.com/ida-actions/hx_userdefinedcall)
- [Binary Ninja API 6.0: `callingconvention` module](https://api.binary.ninja/binaryninja.callingconvention-module.html)
- [Binary Ninja API 6.0: `platform` module](https://api.binary.ninja/binaryninja.platform-module.html)
- [Binary Ninja user documentation: platform types](https://docs.binary.ninja/guide/types/platformtypes.html)
- [The Official Radare2 Book: calling conventions](https://book.rada.re/analysis/calling_conventions.html)
- [The Official Radare2 Book: code analysis](https://book.rada.re/analysis/code_analysis.html)
- [angr documentation: decompiler analysis passes, including calling convention recovery](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)
- [rizin 0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
