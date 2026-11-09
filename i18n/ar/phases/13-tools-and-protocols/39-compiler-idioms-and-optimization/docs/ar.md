# لغات المجمعين: ما الذي يفعله التحسين على رمزك وكيفية قراءته

> يقوم محفز التحسين باستبدال بناءات المصدر بأشكال تعليمات أرخص. لكل شكل مشتق، وهذا الدروس يبني المعرف الذي يعمل على مشتق إلى الوراء ويحقق منه ضد المصدر.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, AArch64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode), Phase 13 · 38 (calling conventions)
**Time:** ~150 minutes

## أهداف التعلم

- استنتاج العدد السحري وتحويل للقسم من خلال أي ثابت مع مقيدة Granlund-Montgomery، واسترداد القسم من ثابتات الصوت المنبعث.
- أسمائهم خمسة طرق لخفض الـ LLVM`switch`وقراءة عدد الدخول وموقع الجدول، والدخولات من الموضوع.
- اقرأ حلقة متجهة كخطوط، ومركبات، و عناصر لكل تكرار، و قناع العد الثلاثي، والحد، و حلقة الباقي.
- تَعْرفُ مكالمات الذيل، المُخطّطاتِ المُشَطَّةِ، المُختارين بدون فروع، والحلقاتِ التي أصبحتِ`memset`أو`memcpy`. . .
- إبلاغ كل لغة مع تعليمات الأدلة وشكل المصدر المفكّر، على x86-64 وعلى AArch64, على `-O0`من خلال`-O3`. . .
- مقارنة النتيجة مع ما يظهر Ghidra، Angr، radare2، rizin، و lldb لنفس البايت.

## المشكلة

لقد قمت بتجميعها`idioms.c`في`-O2`و سألت عميل ما`div7u`نعم، العميل قرأ`imulq $0x24924925, %rax, %rax`و أجاب أن الوظيفة تضرب ب 613566757 ، تحولت ، و تضيف. كل كلمة صحيحة.`x / 7`. . .

نفس الكائن يحمل`switch`مع سبعة حالات لا تملك قفزة على الإطلاق،`switch`مع خمسة قضايا التي هي طاولة قفزة،`switch`مع قضيتين هي `sete`و (أ)`cmovne`، و حلقة فوق `n`عدد كامل يستخدم ثمانية أرقام كاملة لكل إعادة التكرار في اثنين `xmm`يسجل ثم ينهي الباقي في حلقة ثانية.`-O0`نفس المصدر المنتج `divl`، و طاولات قفزة سبعة دخولات ، و حلقة مستوى واحدة`-O1`أصبح المفتاح السبع حروف جدول القيم ولم يكن هناك حلقة متجهة بعد.

هذه الأشكال هي الافكار. يقوم المُجمّع بإصدار كل منها من قاعدة يمكنك قراءتها في مصدرها، ويمكن فك كل منها إلى البناء الذي جاء منه. يتم فك فك الرقم الحسابي، ويمكن التحقق من الحساب. أثبتت الدروس 34 واحدة منها، مضاعفة بـ `0x66666667`هذه الدروس تبني المعرف لجميعهم، وتشغيلها على 18 بناء من رمزنا الخاص، وتتحقق من كل 373 تقرير ضد مصدر C.

```figure
re-39-idioms-by-level
```

## لغة صيغة ذات مشتق

لغة إيقام هي سلسلة من التعليمات التي يصدرها المجمع لبناء المصدر الواحد. ثلاثة أشياء تجعله قابل للتعرف عليه. لديه شكل ثابت ، والعملات تحمل ثابتات يتوقعها الاستحداث ، والشكل يختلف عن ما يكتبه البرمجي يدويا.

الجهاز التعرفي في`code/main.py`العمل على نص `llvm-objdump -d -r`، الذي أنشأ الدروس 33 كحرمة للتعليمات. يصف كل وظيفة إلى تعليمات مع عنوان، بايت، المينيومونيك، العاملات، وخط نقل يليها. يقرأ الملف الكائن لشيءين فقط: بايت من`.rodata`، حيث تعيش جداول القيم، وال `.rela.rodata`الإدخالات، حيث يعيش أهداف الجدول القصص قبل الربط.

كل اكتشاف هو`Idiom`سجل مع `kind`، و تم تشفيرها`source`النموذج، قائمة `evidence`العناوين،`detail`قاموس، و `verified`العلم يأتي من مصدر C.`parse_source()`يقرأ`idioms.c`, يجد كل وظيفة , ويستخرج المقسمين بعد `/`و`%`، المتضاعفات بعد `*`،`switch`القضايا والقيم التي تتبعها`? :`المُشغلون`for`اللولز، والدعوات. يتم التحقق من لغة التقسيم عندما يكون مقسمها في قائمة التقسيم للعمل. يتم التحقق من جدول البحث عندما تتطابق إدخاله مع قيم الحالة، حتى عامل ثابت. يتم التحقق من دعوة الذيل عندما يتم استدعاء الدعوة في المصدر. ينتهي تقرير التجربة بـ `unverified`قائمة، و مجموعة الاختبار تؤكد أن القائمة فارغة لجميع 18 بناء.

يستخدم المعرف تقييم رمزي صغير على كل كتلة أساسية للعمل، في ترتيب إدراج، مع أسماء المعلمات من المصدر في سجلات الحجج من اتفاقيات النظام V و AAPCS64 من الدروس 38. يتم تتبع فتحات الكعب من خلال نصها التشغيلي`-O0`يقرأ الرمز من خلال تسريقه. في كل مدخل كتلة يتم دمج دولة السلفين، وحيث أنها تختلف اسم الذي تم تعيين لغة سابقة تفوز على ثابت. هكذا`cmovll %edx, %eax`في`digest`يقرأ مرة أخرى`sum % 10 < 5 ? sum % 10 : 5`: لغة الحلقة اسم المتراكم `sum`، إيقام التقسيم يسمى معدل`sum / 10`، وسميت لغة modulo نتيجه`sum % 10`. المصدر يكتب`rem > 5 ? 5 : rem`كلتا التعبيرات تعطي أصغر من`rem`و 5 ووافقون على`rem == 5`. . .

## الانقسام بواسطة ثابت

غرانلوند ومونتغومري، "التقسيم بواسطة عدد كامل غير متغير باستخدام الارتفاع" (PLDI 1994) ، استبدال `n / d`مع مضاعفة و تحول اختر نوبة`s`و مضاعف`m = ceil(2^s / d)`- إذن`floor(n * m / 2^s)`متساوية`floor(n / d)`لكل`n`في النطاق عندما يكون الخطأ`e = m * d - 2^s`صغير بما فيه الكفاية. لغير موقّع على 32 بت`n`الحدود هي`e <= 2^(s - 32)`. لـ الموقعة`n`مع`|n| < 2^31`الحدود هي`e <= 2^(s - 31)`، و إصلاح إشارة يضيف 1 عندما `n`هو سلبي، لأن الأرضية تدور في الطريق الخطأ للنسبة السلبية.

`magic_numbers(d, bits, signed)`في`main.py`البحث`s`ثم يعود الزوج الأول الذي يلبي الحد. وهذا البحث يعيد كل صدى ثابت ينبعث في الأجهزة.

### 10 بدون توقيع يدوياً

`2^35 / 10 = 3435973836.8`السقف هو`3435973837 = 0xCCCCCCCD`الخطأ هو`0xCCCCCCCD * 10 - 2^35 = 2`، والحزمة في `s = 35`هو`2^3 = 8`في`s = 34`الخطأ سيكون 6 مقابل الحدود من 4، لذلك 35 هو أصغر تحول. تحقق مع `n = 123`: `123 * 3435973837 = 422624781951`و`422624781951 >> 35 = 12`. . .

هذا ما يُصدره الصوت`div10u`في`-O2`على x86-64:

```text
       0: 89 f9                        	movl	%edi, %ecx
       2: b8 cd cc cc cc               	movl	$0xcccccccd, %eax
       7: 48 0f af c1                  	imulq	%rcx, %rax
       b: 48 c1 e8 23                  	shrq	$0x23, %rax
```

`0x23`هو 35 `movl %edi, %ecx`يمتد الصفر الحجة 32-bit إلى سجل 64-bit، وهو الشكل غير الموقّع.`movl $imm`الذي يغذى المُشَاقِلَين`imulq`، يقرأ النقابة ، ويتصل`divisor_from_magic(0xCCCCCCCD, 35)`هذه الوظيفة تحاول`2^35 // m = 10`و11، ويقبل 10 لأن `magic_numbers(10)`يعطي نفس المضاعف ويتحول للخلف

على AArch64 نفس الوظيفة هي `mov w8, #0xcccd; movk w8, #0xcccc, lsl #16; umull x8, w0, w8; lsr x0, x8, #35`. المستمر يصل في نصفين 16 بت، مضاعفة هو `umull`ويتم كتابة التحول بالعشرية، ويتجمع المعرف الأجزاء ويعطي نفس القسم

### 7 غير موقعة يدوياً، مع إضافة إصلاح

`2^35 / 7 = 4908534052.57`السقف هو`4908534053 = 0x124924925`، الذي يحتاج إلى 33 بت. الخطأ هو 3 ضد حدود 8 ، لذلك التحول هو 35 ، ولا يعمل أي تحول أصغر. مضاعفة 32 بت لا يمكن أن تحتفظ المضاعف ، لذلك المجمع يضاعف منخفض 32 بت`0x24924925`ويعيد إضافة الفائدة في تسلسل ثابت:

```text
      32: 48 69 c0 25 49 92 24         	imulq	$0x24924925, %rax, %rax
      39: 48 c1 e8 20                  	shrq	$0x20, %rax
      3d: 29 c7                        	subl	%eax, %edi
      3f: d1 ef                        	shrl	%edi
      41: 01 f8                        	addl	%edi, %eax
      43: c1 e8 02                     	shrl	$0x2, %eax
```

اقرأها على النحو`t = (n * 0x24924925) >> 32`، ثم`q = (((n - t) >> 1) + t) >> 2`. التحول الكلي هو`32 + 1 + 2 = 35`مع`n = 100`: `t = 14`،`(100 - 14) >> 1 = 43`،`43 + 14 = 57`،`57 >> 2 = 14`. الجهاز يكتشف`sub`،`shr`،`add`،`shr`الذيل بعد تحول 32 بت، يضيف `2^32`عودة إلى المضاعف، وتستعيد 7. `evaluate_division()`يُجري هذا التسلسل الدقيق والاختبار يُحقق منه`n // 7`على قيم الحافة 32 بت. النموذج AArch64 هو `sub w9, w0, w8; add w8, w8, w9, lsr #1; lsr w0, w8, #2`، إرشاد واحد أقصر لأن إضافة محولة هي تعليم واحد.

### توقيع 3 يدوياً

`2^32 / 3 = 1431655765.33`السقف`1431655766 = 0x55555556`الخطأ 2 والخطوط الموقعة في `s = 32`هو`2^1 = 2`. الحدود تمسك بدون مساحة لتتخصيصها، لذلك النقابة هي 32 و استخدامات كلانغ`shrq $0x20`مع`n = -7`: المنتج هو `-10021590362`، التحول الحسابي بـ 32 يعطي`-3`، يتم تعيين بيت الإشارة، لذلك إصلاح يضيف 1 والنتيجة هي `-2`، وهو`-7 / 3`في ج. الأجهزة الموقعة`div10s`و`div3s`كلاهما يحملون الإصلاح`shrq $0x3f`على نسخة من المنتج تليها `addl`. . .

### ما هي الثابتات ليست

المضاعف وحده لا يسمي أي مقسم`0x66666667`مع التحول 34 هو 10. نفس المضاعف مع التحول 33 هو 5 ، كما أظهرت الدروس 34. لذلك فإن المعرف دائما يزدوج المضاعف مع التحول الإجمالي ، و `clangMatchesAlgorithm`السجلات الميدانية التي يتم تحديدها هي زوج الذي ينتج عنه البحث. قوى اثنين لا تستخدم أبداً المضاعفة. `magic_numbers()`يرفضها، لأن المُجمّع يُصدّر تحولًا مع تحيز إشارة بدلاً من ذلك، و `mod8s`في القسم التالي يظهر هذا الشكل.

### اللغة تعود إلى اختيار التعليمات

في`-O0`،`div10u`هو`movl $0xa, %ecx; xorl %edx, %edx; divl %ecx`. .`div10s`هو`cltd; idivl %ecx`في نفس الكائن`digest`يُقسم مجموع حلقةها بـ 10 مع `imulq $0x66666667`هناك علم واحد يفسر الفرق`idioms-x86_64-nofastisel-O0.o`تم بناؤه مع`-O0 -mllvm -fast-isel=false`و في كل قسم هو مضاعفة، بما في ذلك`div10u`مع`movl $0xcccccccd, %ecx; imulq %rcx, %rax; shrq $0x23`. الفرق في الأجهزة هو اختيار اختيار التعليمات السريعة في `-O0`. المضاعفة هي خفض SelectionDAG، وهو ما LLVM `UnsignedDivisionByConstantInfo`و`SignedDivisionByConstantInfo`المنتجات`digest`الكتلة التي تحتوي على القسم تحتوي أيضا على`switch`وذهب ذلك الحجر إلى "المرجع الاختياري" ويقول المُعترف عن كلا النماذج`hardware idivl`و`magic multiply`و الرقم يظهر المختلطة`-O0`وظيفة

## مودولو يتبع النقطة

`x % d`هو`x - (x / d) * d`. المحاسب يحسب النسبة مع الإيقاع أعلاه ، ويعدلها مرة أخرى ، ويعزل. على x86-64 مضاعفة مرة أخرى ب 10 هو `addl %ecx, %ecx; leal (%rcx,%rcx,4), %ecx`، وهو`2 * q * 5`على AArch64 هو تعليمات واحدة،`msub w0, w8, w9, w0`، الذي يحسب`w0 - w8 * w9`مع`w9 = 10`. المتعرف يتبع سجل النسب من خلال نسخ، يتتبع العامل المتراكم من خلال `add`،`lea`،`shl`و`imul`، ويقبل`sub`عندما يكون العامل مساوياً للقاسم

عندما يغذى نفس العدد أيضاً تعبير آخر، تبقى كلا الإغرافات في التقرير.`-O1`المحاسب المحمول`sum / 10`مرة واحدة`digest`و يستخدمها للـ`switch`في x86-64 حتى يجمع النسبة مرتين`leal (%rax,%rsi), %edi`للشكل و`addl %esi, %eax`لـ المفتاح. المعرف يبلغ عن قسم واحد وحدة واحدة ويعبر النسبة المشتركة. تقرير الذي فقد التقسيم هنا سيفعل `switch`المؤشر غير قراءة

المودولو الموقّع بقدرة من اثنين لديه شكل خاص به، لأنّ النسب لا يتم حسابه أبداً:

```text
      92: 8d 48 07                     	leal	0x7(%rax), %ecx
      95: 85 ff                        	testl	%edi, %edi
      97: 0f 49 cf                     	cmovnsl	%edi, %ecx
      9a: 83 e1 f8                     	andl	$-0x8, %ecx
      9d: 29 c8                        	subl	%ecx, %eax
```

-لـ (نـيجيـتـو)`x`يُحيز الرمز بـ 7 قبل التخفيض، بحيث يتجول التخفيض نحو الصفر كما يطلب C. القيمة المختفية هي `x`مستديرة إلى مضاعف 8 ، والسحب يترك `x % 8`. أرك64 يفعل ذلك مع`negs w8, w0; and w9, w0, #0x7; and w8, w8, #0x7; csneg w0, w9, w8, mi`: قناع كليهما`x`و`-x`ثم اختر و حرّم بالرسوم`RuleSignMod2nOpt`، مع المختصر "تحويل نماذج INT_SREM: `(V + (sign >> (64-n)) & (2^n-1)) - (sign >> (64-n)) => V s% 2^n`" . "

في`-O0`أرك64 يكتب modulo`sdiv w9, w8, w10; mul w9, w9, w10; subs w0, w8, w9`.المعترف يقبل هذا النموذج أيضاً ويعلم`hardware sdiv + mul + subs`. . .

## خمسة طرق لخفض المفتاح

يقرر الـ LLVM شكل الـ`switch`في مكانين`SimplifyCFG::simplifySwitchLookup`يذهب في`-O1`و فوق و تحول مفاتيح التي تنتج جميع الحالات ثابتات في جدول القيم ، عندما يكون هناك ثلاثة الحالات على الأقل والهدف يمكن أن تبني جداول البحث. أنواع الجدول هي`SingleValueKind`،`LinearMapKind`،`BitMapKind`و`ArrayKind`- المُؤمنون`-O0`لا يمر هذا الممر أبداً، المفاتيح المتبقية تصل`SwitchLowering::findJumpTables`في اختيار التعليمات، والتي تبني طاولة قفزة عندما يكون العنقود على الأقل `min-jump-table-entries`الإدخالات، 4 حسب الاختيار، و كثافة كافية: `NumCases * 100 >= Range * MinDensity`مع`jump-table-density`10 للعمل الطبيعي و 40 تحت`-Os`ما تبقى يصبح بحث ثنائي على ثابتات الحالة، مع`splitWorkItem`اختيار المحور، الأجهزة تحتوي على وظيفة واحدة لكل نتيجة

| Function | Source | `-O0` x86-64 | `-O2` x86-64 | `-O2` AArch64 |
|---|---|---|---|---|
| `linear_switch` | cases 0 to 6 return 10 to 70 | jump table, 7 entries | linear map `10*k + 10`, default -1 | `madd` and `csinv` |
| `table_switch` | cases 0 to 6 return 10 to 60 then 71 | jump table, 7 entries | lookup table at `.rodata+0x28` | lookup table at `.rodata+0x0` |
| `call_switch` | cases 0 to 4 call one of five pointers | jump table, 5 entries | jump table, 5 entries | comparison tree, pivot 1 |
| `sparse_switch` | cases 1, 100, 10000, 1000000, 100000000 | compare chain | comparison tree, pivot 9999 | comparison tree, pivot 9999 |
| `two_cases` | cases 3 and 4 return 7 and 9 | compare chain | select chain `k != 3 ? (k == 4)*9 : 7` | two `csel` |

### طاولة البحث، قراءة من الكائن

`table_switch`في`-O2`:

```text
      d0: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      d5: 83 ff 06                     	cmpl	$0x6, %edi
      d8: 77 0c                        	ja	0xe6 <table_switch+0x16>
      da: 89 f8                        	movl	%edi, %eax
      dc: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		00000000000000df:  R_X86_64_PC32	.rodata+0x24
      e3: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      e6: c3                           	retq
```

التحقق من الحدود`cmpl $6; ja`يعني 7 إدخالات سارية. إضافة الإنتقال`0x24`+ 4 بايت من الحقل النسبي لـ RIP يضع الجدول في `.rodata+0x28`، قاعدة الدروس 33 مشتقة.`0a 00 00 00 14 00 00 00 ...`، لذا الإدخالات هي`[10, 20, 30, 40, 50, 60, 71]`و هي تساوي قيم الحالة المصدر. اسم الجمع هذا الجدول`.Lswitch.table.table_switch`في`.s`الملف، مع تعليق `@switch.table.table_switch`في الكائن فقط الانتقال والبايتات تبقى. لا يوجد قفزة، لذلك الرسم البياني للتدفق التحكم لديه ثلاثة كتلة.

النموذج AArch64 يضع عنوان الجدول مع `adrp x8`و`add x8, x8, #0x0`كل واحد يحمل نقل خاص به إلى`.rodata`و تحميلات مع`ldr w0, [x8, w0, uxtw #2]`. الجهاز يقرأ الإضافة من`add`إعادة التأهيل

### الخريطة الخطية، بدون طاولة على الإطلاق

`linear_switch`العائدات`10 * (k + 1)`لـ`k`في 0 إلى 6.`simplifySwitchLookup`يكتشف العلاقة المرتبطة بالخلافات ويمنح الحساب:

```text
      b0: 83 ff 07                     	cmpl	$0x7, %edi
      b3: 8d 04 bf                     	leal	(%rdi,%rdi,4), %eax
      b6: 8d 4c 00 0a                  	leal	0xa(%rax,%rax), %ecx
      ba: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      bf: 0f 42 c1                     	cmovbl	%ecx, %eax
```

القيّم يقرأ `leal (%rdi,%rdi,4)`كـ`5*k`،`leal 0xa(%rax,%rax)`كـ`10*k + 10`، و `cmovb`بعد`cmpl $7`كـ`k < 7 ? 10*k + 10 : -1`. ثم يقوم المُعترف بتحقق الصيغة من كل حالة مصدر وتعريض اللغة المحققة. AArch64 يصل إلى نفس العبارة مع `madd w8, w0, w8, w9`و`csinv w0, w8, wzr, lo`، حيث`csinv`مع`wzr`الإستحداثات`-1`على المسار الافتراضي

### طاولة القفز، قراءة من عمليات التنقل

`call_switch`في`-O2`هو الدروس الشكل 33 استعادت في `grade`في`-O0`: `cmpl $4; ja`، أ`leaq`إلى`.rodata-0x4`، أ`movslq`من مدخل 4 بايت، `addq`و`jmpq *%rax`. الإدخالات الخمسة هي عمليات نقل في`.rela.rodata`و`target = addend - 4k`يعطي`0x10c, 0x107, 0x10e, 0x110, 0x109`، خمسة كتلة مختلفة التي كل ذيل قفز من خلال مؤشر وظيفة.`dispatch`يصل المعدل إلى 16 حالة: 16 إدخال نقل على x86-64 ، وعلى AArch64 جدول مضغوط من 16 بايت واحد يقرأ مع `ldrb w11, [x9, x8]`، مقياس 4 مع `add x10, x10, x11, lsl #2`و على أساس`adr`من أول كتلة الحالة.`[0x24, 0x74, 0x54, ...]`من جدول البايتات والتقارير `compressed: true`. . .

### نفس المفتاح على أربع مستويات

`digest`يحتفظ بمفتاح`sum / 10`مع الحالات 6 إلى 10 والقيم 1, 2, 4, 8, 8 ثم تضاعف النتيجة ب 16 على x86-64 هو جدول قفزة في `-O0`، طاولة بحث في `-O1`مع إدخالات `[16, 32, 64, 128, 128]`، و طاولة قفزة مرة أخرى في`-O2`و`-O3`الذي أربعة كتلة الحجرة تخزن`0x10`،`0x20`،`0x40`،`0x80`من`-O1`ارتفاع ضرب 16 قد انتقل إلى الحالات.`-O0`الحالات تخزن 1، 2، 4، و 8، والضاعفة تبقى بعد التبديل.`-O1`جدول البحث يقوم المعرف بمقارنة الإدخالات مع القيم المصدرة، ويعثر على نسبة ثابتة، ويعطي تقارير `foldedFactor: 16`على " آرك 64 "`-O2`الشكل هو شجرة مقارنة مع محور في 8 ، اختبارات المساواة ل 6 ، 7 ، و 8 ، واختبار المدى `sub w9, w9, #9; cmp w9, #2; b.hs`و التي تغطي الحالات 9 و 10 في تعليمات اثنتين.`rangeTests: [[9, 10]]`. . .

هناك علمان يقلعون هذه الحدود`-fno-jump-tables`تدور`table_switch`،`call_switch`، و `digest`على أرقام 64، `-mllvm -min-jump-table-entries=4`أوراق`call_switch`كشجرة مقارنة، لذلك على هذا الهدف عدد الدخول لم يكن المدخل القائم لخمس حالات التبديل من الدعوات غير المباشرة.`idioms-arm64-jt4-O2.o`سجلات تعمل

مجلس التعاون الخليجي يضع كلا القرارين في القانون`tree-switch-conversion.cc`، مع الفصول`jump_table_cluster`،`bit_test_cluster`،`switch_decision_tree`و`switch_conversion`. إنه`-ftree-switch-conversion`هو على `-O2`،`-fjump-tables`و`-fbit-tests`في`-O1`، وفرق طاولة القفز يأتي من`case-values-threshold`لا يوجد GCC مثبت على هذه الآلة، لذلك هذه الأسماء تأتي من مصدر GCC والدليل، و Compiler Explorer هو حيث يمكنك التحقق منها.

## الحلقات: متجهة، مُفصلة، أو مُستبدلة

محرك محرك الحلقة في LLVM يعمل`-O2`،`-O3`و`-Os`، و أخرج في`-O0`و`-O1`، قاعدة تعود إلى LLVM 3.4 في يناير 2014. `sum_n`في`-O2`يظهر كل جزء من الشكل:

```text
     1f6: 83 fe 07                     	cmpl	$0x7, %esi
     1f9: 77 09                        	ja	0x204 <sum_n+0x14>
     206: 81 e2 f8 ff ff 7f            	andl	$0x7ffffff8, %edx
     230: f3 0f 6f 14 37               	movdqu	(%rdi,%rsi), %xmm2
     235: 66 0f fe c2                  	paddd	%xmm2, %xmm0
     239: f3 0f 6f 54 37 10            	movdqu	0x10(%rdi,%rsi), %xmm2
     23f: 66 0f fe ca                  	paddd	%xmm2, %xmm1
     243: 48 83 c6 20                  	addq	$0x20, %rsi
     24a: 75 e4                        	jne	0x230 <sum_n+0x40>
     24c: 66 0f fe c8                  	paddd	%xmm0, %xmm1
     250: 66 0f 70 c1 ee               	pshufd	$0xee, %xmm1, %xmm0
     262: 66 0f 7e c8                  	movd	%xmm1, %eax
     270: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
     279: 75 f5                        	jne	0x270 <sum_n+0x80>
```

الحارس`cmpl $7; ja`يرسل عدد الرحلات إلى الحلقة المتقدمة`andl $0x7ffffff8`الجولات تسجل الرحلة إلى عدد مضاعف من 8.`xmm`المجموعات، أربعة خطوط 32 بت لكل، لذلك عامل التنقل هو 4 و عامل التخلي عن هو 2. بعد الحلقة، `paddd`، اثنان`pshufd`، إثنان آخران`paddd`و`movd`قم بتقليص 8 طرق إلى واحد كامل.`0x270`هو الباقي المتعدد للعنصرات 0 إلى 7 الأخيرة. العرّف يجد الحلقة من حافة الخلفية، يرى سجلات SIMD، يقرأ عدد المسارات من `paddd`، يحتسب الاكتمالات المختلفة، يقسّم الخطوة`0x20`في 4 و تقارير `4 lanes x 2 accumulators = 8 elements per iteration`، مع القناع، الحارس، التخفيض، والحلقة المتبقية كحقول.`ldp q2, q3`، اثنان`add v.4s`،`addv s0, v0.4s`و`fmov w8, s0`. . .

عدد الرحلات الثابتة يزيل الحلقة`sum4`هو واحد`movdqu`، والحد من`movd`، بدون حافة خلفية`poly8`لا يمكن أن يتم تحويل كل مرة إلى متجر، لأن كل إعادة تعتمد على الاكمبيوتر السابق، لذلك يقوم المُجمّع بتفكيكها ثمانية مرات: ثمانية حملات عند التداول 0 إلى `0x1c`من`%rdi`، كل واحد يليه تحول بـ 5 وخصم الذي يحسب`acc * 31`. يعدّ المُعترف الحملات عند التداولات المتتالية من قاعدة واحدة ويعطي تقارير `loop unrolled by 8, no back edge`على " آرك 64 " نفس الحمولة تصل إلى أربعة`ldp`أزواج

أطفئ جهاز التقاط المواد`-fno-vectorize -fno-slp-vectorize`و`sum_n`يصبح حلقة مستوى يتم تفريغها بواسطة 8 ، مع 8 `addl k(%rdi,%rdx,4), %eax`و`addq $8`، بالإضافة إلى حلقة بقية`sum4`يصبح أربعة إضافات.`unrolled loop`مع`copies: 8`و`indexStep: 8`لأول مرة و`copies: 4`لثانية

دراسة 33 وجدت حوافين خلفية في`total`في`-O2`وسميتها حلقين. هذه الدروس تسمى لهم: جسم متجه واحد وبقية واحدة من نفس حلقة المصدر. حافة الخلفية هي حلقة فقط عندما يمكن له هدفها الوصول إليها مرة أخرى. `is_loop()`تحقق من ذلك، لأن `digest`على AArch64 تحتوي على فروع متأخرة إلى كتلة افتراضية مشتركة ليست حلقات، والإصدار الأول من المعرف احتسبها كحلقات متجهة.

### الحلقات التي تصبح مكالمات المكتبة

`LoopIdiomRecognize`يُحول حلقة تخزين الصفر في كل بايت إلى مكالمة إلى `memset`، من`-O1`صعوداً`fill`في`-O2`هو`testl %esi, %esi; jle; movl %esi, %edx; xorl %esi, %esi; jmp memset@PLT`- المكالمة هي قفزة في الذيل مع الإنتقال`R_X86_64_PLT32 memset-0x4`، و وظيفة `retq`إنّها فقط على المسار الفارغ، ويقول المُعترف`store loop recognized as memset(...)`ويتحقق من ذلك ضد حلقة المصدر، لأن المصدر لا يطلق اسم`memset`. . .

`copy16`مكالمات`memcpy`مع ثابت 16 ، والخلفية x86 توسيعها على الخط`movups (%rsi), %xmm0; movups %xmm0, (%rdi)`، في حدود 8 متاجر لكل`memcpy`في`-O0`نفس المكالمة هي اثنين من 8 بايت `movq`أزواج مع`-fno-builtin`المكالمة تبقى مكالمة`jmp memcpy@PLT`مع`movl $0x10, %edx`و`fill`يحتفظ بالحلقة التي يغيرها المتجه بعد ذلك إلى حلقة من 16 بايت`movups`تخزينات لكل إعادة التكرار.`vectorized store loop: 2 x 16-byte stores = 32 bytes per iteration`لهذا البناء

## مكالمات تختفي أو تصبح قفزات

`tail_caller`العائدات`tail_target(x + 1)`في`-O0`إنه كذلك`addl $0x1, %edi; callq tail_target@PLT; addq $0x10, %rsp; popq %rbp; retq`في`-O2`إنه كذلك`incl %edi; jmp tail_target@PLT`و لا شيء آخر، إطار المُتصل قد اختفى و المُتصل يعود إلى المُتصل`b tail_target`مع`R_AARCH64_JUMP26`.المعترف يعالج`jmp`أو`b`يجب أن يعالج التنزل الترددي في الدروس 33 كخروج من الوظيفة، لأن الهدف خارج الوظيفة.

`twice_sum`مكالمات`leaf_add`في`-O0`المكالمة هناك`callq leaf_add@PLT`من`-O1`جسم الـ`leaf_add`،`leal (%rdi,%rsi), %eax`، يظهر داخل`twice_sum`ولا يوجد مكالمة متبقية`-O0`كلغ يمثل كل وظيفة`optnone`و`noinline`ويقوم فقط بالعمل على جهاز التعرف على المعلومات`twice_sum`مكالمات`leaf_add`، لا تجد أي مكالمة أو قفزة الذيل إليها ، ثم تبحث عن شكل جسم الكال في المكالمة: النموية والصدر يعمل مع إزالة الوجهة ، لذلك `add w8, w1, w0`في أرقام المكالمات`add w0, w1, w0`في القاعة، واحدة هي الدليل

`dispatch`يجمع بين كلتا: طاولة قفزة 16 دخول كل حالة هي`movl %esi, %edi; jmp fN@PLT`. المعرف يبلغ عن مفاتيح واحدة و 16 مكالمة من الذيل ، كل ذلك مُحقق من 16 مكالمة في المصدر.

## فرع صار بيانات

`clamp_max`هو`movl %esi, %eax; cmpl %esi, %edi; cmovgl %edi, %eax`. أسماء المقيّمين`%edi`كـ`a`و`%esi`كـ`b`، سجل المقارنة، وقراءة `cmovg`كـ`a > b ? a : b`، والذي هو النص المصدر. `abs_int`هو`movl %edi, %eax; negl %eax; cmovsl %edi, %eax`ويقول:`-x < 0 ? x : -x`؛ أرك64 يكتبها`cmp w0, #0; cneg w0, w0, mi`ويقول:`x < 0 ? -x : x`. .`is_pos`هو`xorl %eax, %eax; testl %edi, %edi; setg %al`، والتي تقرأ على النحو`(x > 0)`هذه هي`-fif-conversion`في كلمات مجلس التعاون الخليجي و`cmov`اختيار في الـ LLVMs. الـ LLVMs `X86CmovConversion`يمكن أن يُمضي`cmov`يعود إلى الفروع عندما يحكم أن مربحة، وهذا هو السبب في أن المصدر نفسه يمكن أن تظهر أي من الشكل في حلقة.

في`-O0`لا يوجد أي من هذه`clamp_max`هو مقارنة،`jle`،متجرين في نفس الفتحة، وملء.المعترف لا يبلغ عن أي شيء`-O0`و`branchless select`من`-O1`، وهو أحد الحقائق التي يجعل الرقم مرئيًا.

`mul9`هو واحد`leal (%rdi,%rdi,8), %eax`و تقارير المُعترف`strength reduction`مع`x * 9`، لأن المصدر يضاعف بـ 9 .`lea`الذي يُقيم مؤشر الجدول ليس مضاعفاً.

## خصائص صلبة تبدو مثل لغز

حماية كومة هي ميزة مُحاميل، وتترك شكلًا يقرأه وكيلًا كمنطق البرنامج. `canary.c`تم تجميعها مع `-fstack-protector-strong`لـ x86-64 لينكس يعطي:

```text
       7: 64 48 8b 04 25 28 00 00 00   	movq	%fs:0x28, %rax
      10: 48 89 44 24 40               	movq	%rax, 0x40(%rsp)
      26: 64 48 8b 0c 25 28 00 00 00   	movq	%fs:0x28, %rcx
      2f: 48 3b 4c 24 40               	cmpq	0x40(%rsp), %rcx
      34: 75 05                        	jne	0x3b <with_canary+0x3b>
      3b: e8 00 00 00 00               	callq	0x40 <plain_leaf>
		000000000000003c:  R_X86_64_PLT32	__stack_chk_fail-0x4
```

`%fs:0x28`هو`stack_guard`في Glibc's `tcbhead_t`، في بايت تعويض 40، و LLVM `getIRStackGuard`أسماء التي تحدد مساحة glibc و bionic و Fuchsia. المبتكر ينسخ الحارس فوق المضخة، ويقارن المخطط، ويقول مسار الفشل`__stack_chk_fail`على AArch64 لينكس الحارس يأتي من العالم`__stack_chk_guard`من خلال GOT مع `adrp`و`ldr`، والفشل هو`bl __stack_chk_fail`.المعترف يبلغ عن مصدر الحراسة ، والمساحة ، والمقارنة ، والدعوة الفاشلة`plain_leaf`، الذي ليس لديه صفوف، ليس لديه قناري تحت`strong`، الذي يحمي الوظائف مع المصفوفات ،`alloca`أوراق البحث تسجل أيضا نموذج MSVC تحت`/GS`، كعك مختلط مع`%rsp`و تم التحقق من`__security_check_cookie`لا يوجد رابط MSVC على هذه الآلة، لذلك يتم وصف هذا الشكل من خروج تجميع المجمع فقط.

`-fcf-protection=full`يضع`endbr64`، بايت `f3 0f 1e fa`، كأول تعليمات لكل وظيفة. إنها مساحة الهبوط للفرع غير المباشرة على المعالجات مع فرض تدفق التحكم، وتعمل كـ`nop`في أماكن أخرى. أنماط غيدرا x86-64 وظيفة-بدء تشمل `endbr64`الإختلافات المسبقة لـ`push rbp; mov rbp, rsp`ولهذا السبب، يبلغ المُعترف به`cet landing pad`، لذلك لا يمكن الخلط بين وظيفة تبدأ بأربعة بايت غير عادية للبيانات.

## ما يضعه المُحللون

كل مفصل في الدروس 37 يستخدم بعض هذه الاستثمارات كقواعد إعادة كتابة.`ruleaction.cc`. .`RuleDivOpt`هو "تحويل INT_MULT وتحويل النماذج إلى INT_DIV أو INT_SDIV" ، مع النماذج `sub( (zext(V)*c), d) >> e => V / (2^n/(c-1)) where n = d*8 + e`والفراز الموقع مع `sext`و`s>>`. .`RuleModOpt`هو "بسيط تعبيرات تعمل على تحسين INT_REM و INT_SREM". `RuleDivTermAdd`يدير الإضافة`RuleSignDiv2`تدور`(V + -1*(V s>> 31)) s>> 1`في`V s/ 2`و`RulePositiveDiv`يُحول تقسيم الموقع من القيم مع قطع إشارة واضحة إلى واحد غير مؤقّت.`grade`في`-O1`، والخروج يقرأ `uVar2 = param_1 / 10 - 6;`-تُجْمَعَتِ القسمَ.

إدخال هذه القواعد مرئية دون جاوا. يرفع رمز البايب 4.0.1 من venv مع نفس المواصفات SLEIGH يستخدم Ghidra، و `code/fixtures/idioms-x86_64-O2.lifts.json`يحتوي على رمز P الخام ل `div10s`: 112 إدخال لسبعة تعليمات، منها 7 هي`IMARK`علامات تفتح كل تعليمات، من بينهم `RAX = RAX * unique[95a00:8]`بعد`unique[95a00:8] = sext(0x66666667)`،`RCX = RCX >> unique[d1a00:4]`و`RAX = RAX s>> unique[c5c00:4]`- المُؤمنون`shrq`ينفذ 41 عملية و `sarq`يحمل 40، ومعظمهم يحسب العلامات.`RuleDivOpt`يطابق مضاعفة و 2 تحولات في هذا التيار، و القضاء على الرمز الميت يزيل العلامات التي لا يقرأها شيء.

Angr 10.0.3 تم تشغيل على لدينا `-O2`الموضوع، و`idioms-x86_64-O2.angr.json`يحتفظ بمخرج المتحلل لـ 20 وظيفة. يطوي الشكل غير الموقّع: `div10u`هو`return a0 / 10;`لا ينقلب النموذج الموقّع:`div10s`هو`v1 = a0 * 1717986919; return ((long long)(v1) >> 0x22) + (v1 >> 63);`و`mod10s`هو`a0 - (...) * 2 * 5`- لأجل`div7u`إنه يطبع`(a0 / 7 + ((a0 * 6 / 7 & 0xffffffff) >> 1 & 0xffffffff) & 0xffffffff) >> 2`حيث تعود المصطلحات المرتبطة بالعدد إلى الحساب`mul9`إلى`a0 * 9`،`linear_switch`إلى`(a0 < 7 ? a0 * 10 + 10 : 0xffffffff)`،`clamp_max`إلى`((int)a1 < (int)a0 ? a0 : a1)`،`is_pos`إلى`a0 > 0`و`fill`إلى`return memset(a0, 0, a1);`إنه يطبع`table_switch`كحمل`*(int *)(4 * a0 + 4195400)`بدون القيم`sum_n`مع`_mm_add_epi32`و`_mm_shuffle_epi32`الاصطناعية، و`tail_caller`كـ`tail_target(); return;`مع فقدان الحجة`digest`طاولة القفز تصبح`goto *((void *)(...))`مع حسابات الجدول مكتوبة.

رادار2 6.2.4 و ريزين 0.9.1، التي تم بناؤها من المصدر في مخزن البحث، تم تشغيلها على نفس الكائن.`pdc`بصمات`div10s`كـ`rax = rax * 0x66666667; rcx >>>= 0x3f; rax >>= 0x22; eax += ecx`، مستوى السجل السوداء-C بدون طليق ، و `table_switch`كـ`eax = dword [rcx + rax*4]`مع`RELOC 32 .rodata`التعليق على `lea`. لا يوجد في الـ rizin جهاز تحلل الملفات`aoi`يطبع RzIL من `imul`كمنتج 128 بت. lldb-1703.0.236.21 تحميل كائن ELF و `disassemble -n div10s`يطبخ نفس التعليمات السبع`llvm-objdump`، لأن كلاهما يستخدم إزالة LLVM. كابستون 5.0.7 يفكّر نفس البايتات ويُذكر مجموعات مثل `ret`و`mode64`إن إيدا برو و Binary Ninja لم يتم تشغيلها هنا. توضح وثائقهم المراحل التي يحدث فيها هذا الإعادة الكتابة ، وتحسين الرمز الميكروكيدي والمرور من MLIL إلى HLIL ، وهذا الدروس لا يدل على أي لغات يتم طيّتها.

المجمع Explorer هو أداة للتوجيه للأمام.`idioms.c`، اختيار إدخال المجمّع مثل "x86-64 clang 18.1.0" أو "ARM64 GCC 14.2.0"، وتعيين العلامات.`GET /api/compilers/c`يعيد المعرفات و`POST /api/compiler/<id>/compile`يعيد الجمعية على أنها JSON. مقالة ACM Queue 2019 التي كتبها مات غودبولت تمر عبر القسم ، وعد السكان ، والشروط المشروطة ، والإغرافات الموجزة مع هذه الأداة. استخدمها لمخرجات GCC ، التي لا يمكن أن تنتجها هذه الآلة ، ومقارنة عتبة جدول قفزة GCC و `-O2`التشغيل المتجه من GCC 12 مع إنتاج الكلانغ في الأضواء.

## بناءها

أطلق التجربة:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
```

إن المخرج هو تقرير JSON واحد. لكل من 18 بناء يدرج كل وظيفة وأغراضها ، مع نوع ، شكل المصدر ، وعناوين الأدلة ، والتحقق ، وحقول التفاصيل. ينتهي مع ماتريكس نوع لكل بناء ،`-O2`مقابل`-O3`مقارنة لكل من الهندسة المعمارية، وال`unverified`قائمة

الشكل المتوقع:

```json
{
  "builds": {
    "idioms-x86_64-O2": {
      "arch": "x86_64", "level": "O2", "flags": "x86_64",
      "functions": {
        "div7u": [{"kind": "division", "source": "x / 7", "evidence": ["0x30", "0x32", "0x39", "0x3d", "0x3f", "0x41", "0x43"], "verified": true, "form": "magic multiply with add fix-up", "magic": "0x24924925", "effectiveMagic": "0x124924925", "shift": 35, "...": "..."}],
        "table_switch": [{"kind": "switch", "source": "switch (k) as lookup table", "table": ".rodata+0x28", "entries": 7, "values": [10, 20, 30, 40, 50, 60, 71], "...": "..."}],
        "sum_n": [{"kind": "vector loop", "lanes": 4, "accumulators": 2, "elementsPerIteration": 8, "...": "..."}]
      }
    }
  },
  "kindMatrix": {"idioms-x86_64-O2": {"division": 5, "modulo": 3, "switch": 6, "vector loop": 3, "...": "..."}},
  "sameCodeAtO2AndO3": {"x86_64": {"identical": true}, "arm64": {"identical": false, "differences": ["..."]}},
  "unverified": []
}
```

اقرأ`code/main.py`في هذا الترتيب:

1. `parse_listing()`يدور`llvm-objdump -d -r`النص في الوظائف والإرشادات والتحركات المرفقة لكل من الهندسة المعمارية.
2. `ElfFile`يقرأ القسمات والرموز`.rela.*`الإدخالات، و`words()`يقرأ إدخالات الطاولة.
3. `magic_numbers()`،`divisor_from_magic()`و`evaluate_division()`هي مشتق غرانلوند مونتغومري للأمام والخلف، وكسلسلة التعليمات.
4. `parse_source()`يستخرج البنود الاحتياجات للتحقق من ملف C.
5. `Evaluator`هو مرور رمزي كتلة بعد كتلة يسجل الأسماء ويمسك فتحات.
6. `find_divisions()`و`find_modulos()`يطابق ضرب، تحويل، إصلاح، مضاعفة، و قوة من أشكال اثنين.
7. `find_switches()`تصنف جداول القفز، جداول البحث، خرائط خطية، اختيار السلاسل، أشجار المقارنة، ومقارنة السلاسل.
8. `find_vector_loops()`،`find_unrolled_loops()`،`find_tail_calls()`،`find_inlined_calls()`،`find_selects()`،`find_memory_builtins()`،`find_stack_protector()`،`find_cet()`و`find_strength_reduction()`تغطي البقية
9. `analyze_function()`يضعها في الترتيب، ويمضي اسم النتيجة لكل لغة في المرور التالي للمقيّم.

هناك ثلاثة أوامر أخرى`python3 code/main.py scan FILE.objdump.txt [FUNCTION]`يستخدم المعرف على قائمة واحدة، مع الكائن والملف C المماثل الموجود بجوارها. `python3 code/main.py magic DIVISOR [signed]`يطبخ المضاعف، التحول، الخطأ، وما إذا كانت الهوية تحافظ على قيم الحافة. `python3 code/main.py figure-data`يطبخ البيانات التي تضمها الرسم.

## استخدمها

استخدم المعرف بهذه الترتيب على جسم جديد قمت ببناءه

1. القبض`llvm-objdump -d -r`ويحفظ الأمر المُحْتَرِق الدقيق بجانبه. الجهاز يقرأ الهندسة المعمارية من عنوان القائمة.
2. أركض`scan`على القائمة وقراءة `unverified`كل واحد من هذه الإدخالات إما أنشطة لم يرها المحقق المصدر أو شكل لم يقرأه المعرف بشكل خاطئ، وكلاهما يستحق النظر في عناوين الدليل.
3. لكل قسم، اقرأ`algorithm`في الميدان`clangMatchesAlgorithm`صحيح، قام المُحَرِّر بإختيار أصغر تحول صالح. عندما يكون خاطئًا، كان لدى المُحَرِّر سببًا لا تعرفه بعد؛ اكتب المستمرات.
4. لكل تغيير، مقارنة `lowering`طاولة تصبح شجرة، أو شجرة تصبح طاولة، تعتبر عتبة يمكنك تسميتها من مصدر LLVM.
5. لكل حلقة، اقرأ`elementsPerIteration`و`scalarRemainderLoop`، ثم تأكد من أن الحواف الخلفية الدروس 33 تقارير واحدة مصدر حلقة.
6. إشغلي جهاز إفكاري واحد على نفس الكائن، واستشهد بنصه بجانب كل لغة، وتسجل أي منها طي. هذا السجل هو خط أساس للدرس 45.

## المختبر التفاعلي

### المختبر أ: استنبذ رقم سحري، ثم العثور عليه

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/code
python3 -q
```

أركض

```python
from main import *
magic_numbers(10), magic_numbers(10, signed=True)
magic_numbers(7), magic_numbers(7, signed=True)
divisor_from_magic(0x66666667, 34, signed=True), divisor_from_magic(0x66666667, 33, signed=True)
```

الحساب`ceil(2^35 / 10)`على الورق قبل المكالمة الأولى. ثم أضف وظيفة `unsigned div13(unsigned x) { return x / 13; }`إلى نسخة من `idioms.c`، بناءه في`-O2`مع القيادة في `build_fixtures.sh`، و تحقق من ثابت في القائمة مقابل `magic_numbers(13)`. . .

### المختبر ب: الطاولة والشجرة

```python
listing = load_listing("idioms-x86_64-O2.objdump.txt")
elf = load_elf("idioms-x86_64-O2.o")
sources = load_source("idioms.c")
[i.to_dict() for i in analyze_function(listing, "table_switch", elf, sources)]
[i.to_dict() for i in analyze_function(listing, "sparse_switch", elf, sources)]
elf.words(".rodata", 0x28, 7)
```

التغيير`71`عودوا إلى`70`في نسخة من `table_switch`، أعيد بناءها في`-O2`ثم تغيير قيمة حالة واحدة إلى 1000 ومشاهدة أنها تبقى`ArrayKind`طاولة

### المختبر C: الحلقة عند ثلاث إعدادات

```python
for name in ("idioms-x86_64-O1", "idioms-x86_64-O2", "idioms-x86_64-novec-O2"):
    print(name, [i.source for i in analyze_function(load_listing(name + ".objdump.txt"), "sum_n", load_elf(name + ".o"), sources)])
```

رسم الرسم البياني للتدفق التحكم`sum_n`في`-O2`باليد، علامة الحارس، القناع، الجسم المتجه، التخفيض، والقائمة حلقة، ومقارنة مع `detail`الحقول

### المختبر D: النسبة المشتركة

```python
for name in ("idioms-x86_64-O1", "idioms-arm64-O1"):
    print([(i.kind, i.source, i.detail.get("sharedQuotient")) for i in analyze_function(load_listing(name + ".objdump.txt"), "digest", load_elf(name + ".o"), sources)])
```

اقرأ`-O1`قائمة `digest`و العثور على التعليمات التي تجمع معدل مع إصلاحها علامة على x86-64. ثم شرح لماذا AArch64 بناء تحتاج فقط واحد.

## مختبر التدريب

إضافة خدوش صغيرة إلى الأجهزة وتوسيع التعرف.

المتطلبات:

- اكتب`popcount`،`ctz`و`rotl`وظائف مع المباني الخليجية وتحويل أو تدوير، بناءهم في `-O2`مع و بدون`-mpopcnt -mbmi`و إلتزام الأشياء مع قائمتها
- اعترف بالعالم`0x55555555`،`0x33333333`،`0x0f0f0f0f`،`0x01010101`تسلسل عدد السكان الذي`TargetLowering::expandCTPOP`يُصدّر، ويتّقَرّب عنه على أنه`popcount`مع الثابتات الأربعة كدليل
- تَعْرفُ `rep bsfl`كـ`tzcnt`-أو -`bsf`التشفير و`roll %cl`كما تدور، و فك كلاهما إلى البناء.
- إضافة الأنواع الجديدة إلى `parse_source()`التحقق، لذلك `popcount`يتم التحقق من اللغة فقط عندما يطلب المصدر`__builtin_popcount`. . .
- إضافة اختبار لكل لغة تقرأ الثوابت من قائمة العوامل.

النجاح يعني`python3 code/main.py`تقرير عن النوع الثلاثة الجديد مع `verified: true`في كلتا البنايات، والسويت لا يزال يبلغ عن فارغة`unverified`قائمة

## درساً أساسياً

هذا الدروس يتضمن`outputs/skill-compiler-idioms-and-optimization.md`. استخدمها لتحويل قائمة، ومواد، ومصدرها إلى تقرير لغة معتمدة مع مقارنة المتحلل. يتطلب عنوانات دليل لكل ادعاء، والنسخة السحرية للأرقام لكل قسم، والنوع التخفيض ومصدر الدخول لكل مفارق، وعبارة المتحلل المقتبس لكل لغة.

## تحقق من ذلك

إشغال التجربة والسلسلة التحديدية:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

يجب أن تثبت التحقق:

- يقرأ محلل القائمة 25 وظيفة من `-O2`المادة، يحافظ على البايتز، ويشمل `R_X86_64_PC32 .rodata+0x24`إلى`leaq`في`table_switch`
- قراءة ELF يعود `[10, 20, 30, 40, 50, 60, 71]`من`.rodata+0x28`وعشرة عمليات نقل في`.rela.rodata`
- `magic_numbers`العائدات`0xcccccccd`مع النوبة 35`0x66666667`مع 34`0x124924925`مع 35 وملف الإضافة`0x55555556`مع 32 ، و `0xaaaaaaab`مع 33
- التعرف يحافظ على قيم الحافة 32 بت لكل مقسم من 2 إلى 64 ليس قوة من اثنين، الموقع وغير الموقع
- `divisor_from_magic`يعود 10، 5، 7، و 3 من أزواجهم ويرفض الزوجة الخطأ
- الحسابات المتصلة بالإضافة`n // 7`بالضبط
- أربعة أقسام x86-64 تقرير المضاعف اليمنى، التحول، القسم، والشكل، وأربعة أقسام AArch64 فك `mov`و`movk`
- `-O0`استخدامات`divl`و`idivl`،`-O0 -fast-isel=false`يستخدم الـ "المضاعفة" و`digest`في`-O0`يخلط بينهما
- ويعرف modulo بأنه مضاعف للخلف`msub`, قوة اثنين ,`sdiv`بالإضافة`mul`بالإضافة`subs`و الأجهزة`idivl`
- يحتفظ النسبة المشتركة بالتقسيم والحجم في `-O1`
- التخفيضات الخمسة تصنف في `-O2`على كلا الهندسة المعمارية، مع الصيغة والقيم والهدف والحوافز، والعبرة المختارة
- `-O0`المفتاحات هي طاولات القفز على x86-64 ومقارنة السلاسل على AArch64
- الموقع`digest`المفتاح هو جدول القفز، ثم جدول البحث مع عامل 16 مقلوب، ثم جدول القفز مع أربعة أهداف متميزة على x86-64, وشجرة المقارنة مع اختبار المدى 9 إلى 10 على AArch64
- `-fno-jump-tables`يُنتج شجرة مقارنة، والحالة 16 `dispatch`يقرأ أهدافه من عمليات التنقل على x86-64 ومن جدول بايت مضغوط على AArch64
- حلقة المتجهة تقرير 4 خطوط، 2 محطات، 8 عناصر لكل تكرار، القناع، الحراسة، التخفيض، والحلقة المتبقية
- حلقات الركوب الثابتة متجهة تماما أو مفتوحة تماما، و`-fno-vectorize`يفتحون في 8
- `-O1`لا يوجد لها متجهات،`-O2`و`-O3`هم متطابقون على x86-64، وعلى AArch64 يختلفون فقط في `call_switch`، حيث`-O3`لديه 17 تعليمات و`-O2`لديه 18
- `-fno-builtin`يُحوّل حلقة المخزن إلى حلقة مخزن متجهة ويحافظ على`memcpy`مكالمة
- دعوات الذيل،`memset`استبدال، نسخة 16 بايت داخل الخط، وال `-O0`يتم التعرف على نسخة مزدوجة
- الـ "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" "الـ" " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " " "`-O1`على شكل جسده
- يختار إفكاره إلى `a > b ? a : b`،`-x < 0 ? x : -x`،`(x > 0)`و`sum % 10 < 5 ? sum % 10 : 5`
- تقارير حماية الدرج`%fs:0x28`، فتحة ، و `__stack_chk_fail`و`endbr64`يتم الإبلاغ عن كل وظيفة من أدوات CET
- يقرأ المصفح المصدر معايير مؤشر الوظيفة ، وقوائم التبديل ، والمكالمات ، وأسماء الاكمولات
- كل لغة في كل بناء يتم التحقق منها والنوع من المصفوفات مطابقة
- الرقم التفاعلي يضم نفس البيانات التي ينتجها التحليل

## أساليب فشل الإنتاج

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Multiply by a large odd constant | "multiplies by 1717986919" | The constant is `ceil(2^s / d)` for one `d`, the error satisfies the bound, and the shift is the smallest valid one |
| Add fix-up after a 32-bit shift | Five arithmetic instructions | The multiplier is 33 bits wide and the tail is the add form of the same method |
| Same multiplier, different shift | The same divisor | The shift selects the divisor: 34 is 10, 33 is 5 |
| Power-of-two signed modulo | "adds 7, masks, subtracts" | The bias rounds toward zero and the result is `x % 8` |
| Indexed load from `.rodata` | "a jump table" | A lookup table of values, with entries read from the bytes at addend plus 4 |
| Affine arithmetic and a `cmov` | "computes 10k + 10" | A switch lowered as a linear map, verified against every source case |
| Compare chain with ordered splits | "a sequence of ifs" | A binary search over the case constants with the pivots named |
| Backward branch to a default block | "a loop" | The target leaves the region with an unconditional jump; it is a shared tail |
| Two back edges in one function | "two loops" | One source loop: the vector body and its scalar remainder |
| `jmp memset@PLT` with no `ret` | "the function has no return" | A tail call that returns through the callee, replacing a store loop |
| Callee missing from the call graph | "never called" | Inlined: the callee's body shape appears in the caller |
| `%fs:0x28` load and compare | "reads thread-local data" | The stack protector canary, with the fail path to `__stack_chk_fail` |
| Four odd bytes at function start | "data before the function" | `endbr64`, the CET landing pad |
| Decompiler shows raw arithmetic | "the tool is wrong" | The tool did not apply a fold; the derivation gives the source form and the quoted output records the gap |

## قاعدة العمليات

تطابق الشكل، تشغيل الاستحداث إلى الوراء، وكتب الثوابت التي تثبت ذلك. تقرير كل لغة مع عناوين الأدلة ونموذج المصدر المفكّر لها، التحقق من كل واحد ضد المصدر الذي قمت بتجميعه، ونقلها ما طبعته كل مفكّر للعباءات نفسها.

## المزيد من القراءة

- [Granlund, Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994)](https://gmplib.org/~tege/divcnst-pldi94.pdf)
- [Warren, Hacker's Delight, 2nd edition, Chapter 10: Integer Division By Constants](https://www.informit.com/store/hackers-delight-9780321842688)
- [Lemire, Kaser, Kurz, "Faster Remainder by Direct Computation" (2019)](https://arxiv.org/abs/1902.01961)
- [libdivide, header-only division by runtime constants](https://github.com/ridiculousfish/libdivide)
- [LLVM `DivisionByConstantInfo.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Support/DivisionByConstantInfo.cpp)
- [LLVM `SwitchLoweringUtils.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/SwitchLoweringUtils.cpp)و[`TargetLoweringBase.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/TargetLoweringBase.cpp)
- [LLVM `SimplifyCFG.cpp`, `simplifySwitchLookup`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Utils/SimplifyCFG.cpp)
- [LLVM Auto-Vectorization documentation](https://llvm.org/docs/Vectorizers.html)و[LLVM 3.4 release notes](https://releases.llvm.org/3.4/docs/ReleaseNotes.html)
- [LLVM `LoopIdiomRecognize.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Scalar/LoopIdiomRecognize.cpp)
- [LLVM `X86CmovConversion.cpp`](https://github.com/llvm/llvm-project/blob/release/20.x/llvm/lib/Target/X86/X86CmovConversion.cpp)
- [LLVM `StackProtector.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/StackProtector.cpp)و[`X86ISelLoweringCall.cpp`, `getIRStackGuard`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/X86/X86ISelLoweringCall.cpp)
- [glibc `sysdeps/x86_64/nptl/tls.h`, `tcbhead_t`](https://sourceware.org/git/?p=glibc.git;a=blob;f=sysdeps/x86_64/nptl/tls.h)
- [GCC `tree-switch-conversion.cc`](https://github.com/gcc-mirror/gcc/blob/master/gcc/tree-switch-conversion.cc)،[GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html)و[GCC 12 release notes](https://gcc.gnu.org/gcc-12/changes.html)
- [Ghidra decompiler `ruleaction.cc`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/decompile/cpp/ruleaction.cc)
- [angr decompiler documentation](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 book: decompilers](https://book.rada.re/arch/decompile.html)
- [Compiler Explorer API](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/API.md)
- [Godbolt, "Optimizations in C++ Compilers: A practical journey", ACM Queue 17(5), 2019](https://queue.acm.org/detail.cfm?id=3372264)
- [Microsoft, `/GS` (Buffer Security Check)](https://learn.microsoft.com/en-us/cpp/build/reference/gs-buffer-security-check)
