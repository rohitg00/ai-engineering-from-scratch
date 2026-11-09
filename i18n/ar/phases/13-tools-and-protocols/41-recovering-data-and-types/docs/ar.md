# استعادة البيانات وأنواعها: الهياكل والسلسلات والكائنات C ++ و DWARF

> طابعات مُفكّر`a->balance`عندما يكون لديها طاولة النمط و`*(int *)(param_1 + 4)`عندما لا يفعل ذلك. هذا الدروس يُبني الجدول من الوصولات، يقرأ الجدول الحقيقي من DWARF 5، ويعرض أين يوافق الاثنان.

**Type:** Build
**Languages:** Python, TypeScript, C, C++, x86-64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~140 minutes

## أهداف التعلم

- اقرأ وصول عضو البنية كمسجل أساسي بالإضافة إلى التنقل، ووصول الترتيب كخطوة أساسي بالإضافة إلى أوقات المؤشر، من قواعد التعامل مع نظام Intel SDM.
- تطبيق قواعد التنظيم في النظام V يدوياً على `struct account`ويشرح كل بايت
- قم ببناء مرسلة استرداد النوع التي تحول الوصولات في قائمة إلى تعويضات الحقل والعرض وأنواع، خطوة، وحجم، مع الأدلة لكل منها.
- اكتب قراءة DWARF 5`.debug_info`،`.debug_abbrev`،`.debug_str_offsets`و`.debug_addr`من كائن قابل للتنقل، والتحقق منه من`llvm-dwarfdump`. . .
- مقارنة التخطيط المُسترد مع التخطيط DWARF وسمي كل اختلاف كدليل مفقود أو وصول مُدمج أو نوع غير قابل للتثبت.
- اقرأ إيتانيوم C ++ vtable، نوع المعلومات، وأسماءها المهزومة من عمليات التنقل، وحل مكالمة افتراضية إلى فتحة.

## المشكلة

لقد قمت بتجميعها`account.c`بدون`-g`و سألت عميل ما`bump`لقد أرسل العميل الكائن إلى (غيدرا) 12.1.4 و حصل على هذا

```c
void bump(long param_1,int param_2)
{
  *(int *)(param_1 + 4) = param_2 + *(int *)(param_1 + 4);
  return;
}
```

نفس المصدر الذي تم تجميعه مع`-g`يعطي هذا من نفس المتحلل:

```c
int bump(account *a,int by)
{
  a->balance = by + a->balance;
  return a->balance;
}
```

التوجيهيات متطابقة في كلا الكائنات. الفرق هو جدول النوع. مع الجدول يعرف المتحلل أن المعلم الأول يشير إلى هيكل 32 بايت الذي يكون حقل في التداخل 4 هو 4 بايت `int`اسمها`balance`بدونها ، المفكّر يعرف فقط أنّ شيء بعيد 8 بايت وصل إلى هنا`%rdi`وذلك 4 بايت في `+4`قراءة و كتابة

كل شيء في هذه الجدول لديه مصدر. التخفيض 4 يأتي من التخفيض بايت من `addl 0x4(%rax), %ecx`. الـ 4 من عرض`l`الإضافة، الاسم يأتي من`DW_TAG_member`الدخول في `.debug_info`هذه الدروس تبني كلا النصفين: مرسل يعيد ما تثبت التعليمات، وقارئ يفكّر ما سجّل المحامّل. الفجوة بينهما هي تكلفة اسم النموذج.

```figure
re-41-struct-recovery
```

## الوصول إلى عضو هو نزوح

تعريف إدارة إدارة الإنترنت الإنترنت (Intel SDM) الجدول 1، القسم 3.7.5 عنوان الفعال`Offset = Base + (Index * Scale) + Displacement`، مع مقياس 1، 2، 4 أو 8 وتحرك 8، 16 أو 32 بت. في القسم 3.7.5.1 يضيف نموذج وضع 64 بت `RIP + Displacement`. يستخدم وصول عضو البنية النموذج الأول دون مؤشر: سجل الأساس يحمل عنوان الكائن والتحرك هو تعويض العضو. يضيف وصول صفحة مصطلح المؤشر، والقياس أو مضاعفة منفصلة تحمل حجم العنصر.

خذ`bump`في`-O0`. الإدراج من`llvm-objdump -d -r`يقرأ:

```text
       4: 48 89 7d f8                  	movq	%rdi, -0x8(%rbp)
       e: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      12: 03 48 04                     	addl	0x4(%rax), %ecx
      15: 89 48 04                     	movl	%ecx, 0x4(%rax)
```

فك الرمز`03 48 04`مع القواعد من الدروس 33. `03`هو`ADD r32, r/m32`. مودر ام`48`هو`01 001 000`: `mod = 01`يعني جهاز عمل ذاكرة مع تحرك 8 بتات، `reg = 001`هو`%ecx`،`r/m = 000`هو`%rax`. البايت التنقل هو `04`. التعليمات تقرأ 4 بايت في `%rax + 4`و يضيفهم إلى`%ecx`- المُؤمنون`l`الإضافة التي `llvm-objdump`الطابع هو حجم العرض، لذلك الحقل هو 4 بايت على عريض.`%rax`جاء من فتحة الإطار في`-0x8(%rbp)`، وذلك الفراغ قد تلقى`%rdi`ثلاث حقائق تلي: المعلم الأول هو مؤشر، والجسم الذي يشير إليه لديه حقل 4 بايت في التداخل 4، و `bump`يقرأ ويكتب هذا الحقل

لا شيء في هذه البايت تقول`int`،`balance`أو`struct account`لا يوجد شيء يخبرنا كم حجم الكائن الباقي من الـ 28 بايت من الهيكل غير مرئي`bump`. . .

## قواعد ترتيب النظام V

يقدم x86-64 psABI ، القسم 3.1.2 ، ثلاثة قواعد للمجمعات. "تفترض الهياكل والاتحادات تحسيس مكوناتها الأكثر صرامة. يتم تعيين كل عضو إلى أدنى تعادل متاح مع التوجه المناسب. حجم أي كائن هو دائمًا مضاعف من تحسيس الكائن". تشير الشكل 3.1 من نفس الوثيقة إلى أحجام التوجه والتحسيس: `char`1 و 1 ، `short`2 و 2 ، `int`4 و 4، `double`8 و 8، أي مؤشر 8 و 8.

تطبيق القواعد على الهياكل`account.c`:

```c
struct account {
    char kind;
    int balance;
    short code;
    double rate;
    const char *label;
};
```

| Member | Size | Alignment | Lowest offset that fits | Padding before |
|---|---|---|---|---|
| `kind` | 1 | 1 | 0 | 0 |
| `balance` | 4 | 4 | 4 | 3 (bytes 1 to 3) |
| `code` | 2 | 2 | 8 | 0 |
| `rate` | 8 | 8 | 16 | 6 (bytes 10 to 15) |
| `label` | 8 | 8 | 24 | 0 |

ينتهي العضو الأخير في 32 . التوجه الأكثر صرامة هو 8 ، و 32 هو مضاعف من 8 ، لذلك الحجم هو 32 دون ملعب ذيل. تسعة بايت من 32 ملعب ، و psABI يقول "محتويات أي ملعب غير محددة".

ترتيب الأعضاء يحدد حجمهم.`double, pointer, int, short, char`تعويضات الاكتفاء 0، 8، 16، 20، 22 وتنتهي عند 23، والتي تصل إلى 24 `sysv_layout()`في`code/main.py`يطبق القواعد الثلاثة ويجلب كلا النتائج.`ctypes`يطبق الوحدة نفس القواعد من خلال اتفاقية المُجمّع المضيف، و `ctypes.sizeof`،`ctypes.alignment`، و `.offset`من كل حقل أعطوا 32، 8 و `0, 4, 8, 16, 24`البرنامج نفسه يقوم بطبع النسخة الثالثة عندما تقوم ببناءها وتشغيلها على هذه الآلة:

```text
sizeof 32 align 8
kind 0 balance 4 code 8 rate 16 label 24
sum 315 tag -3 projected 318.75 label_length 7
```

هذا البناء الأصلي هو arm64. يذكر Arm AAPCS64 نفس القواعد الإجمالية في قسم 5.10.1 ، ويقوم وثيقة Apple arm64 بحفاظ على هذه الأحجام المتعددة الخمسة ، لذلك تتوافق الأرقام على طول الهدفين. يتم تجميع كائنات x86-64 في الدروس مع `-target x86_64-unknown-linux-gnu`حتى قارئ ELF من الدروس 33 وقارئ DWARF أدناه يعمل على ذلك.

## اقرأ بقية المخطوطة يدويا

`bump`يرى حقل واحد.`account.c`انظر البقية، وكل منها يظهر نموذج تعليمات مختلفة.`account-x86_64-O0-g.objdump.txt`. . .

`sum_balances`يُؤشر صفوف من الهياكل:

```text
      51: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      55: 48 63 4d ec                  	movslq	-0x14(%rbp), %rcx
      59: 48 c1 e1 05                  	shlq	$0x5, %rcx
      5d: 48 01 c8                     	addq	%rcx, %rax
      60: 8b 40 04                     	movl	0x4(%rax), %eax
```

`%rax`هو`list`،`%rcx`هو`i`التسجيل الممتد إلى 64 بت، و `shlq $0x5`مضاعفة ب 32 بعد `addq`،`%rax`هو`list + 32 * i`، والحمل يقرأ 4 بايت في تعويض 4 من العنصر `i`. تعد الحلقة هي المكان الوحيد في هذا الكائن حيث يظهر حجم الهيكل كرقم. الحلقة التي تحتوي على هذه التعليمات تبدأ من `0x49`إلى`jmp 0x49`في`0x72`. . .

`tag`يقرأ حقلين ضيقين:

```text
      8c: 0f be 00                     	movsbl	(%rax), %eax
      98: 0f bf 48 08                  	movswl	0x8(%rax), %ecx
```

`movsbl`تحميل بايت واحد في التداول 0 وتوسيعها، لذلك الحقل في 0 هو عدد كامل من 1 بايت. `movswl`تحميل بايتين في التداول 8 مع تمديد الإشارة، لذلك الحقل في 8 هو رقم كامل مؤلف من 2 بايت.`-O1`أول وصول يصبح`cmpb $0x6c, (%rdi)`، الذي لا يزال يقول 1 بايت عند تعويض 0 ولا يقول شيئا عن الشارة.

`projected`يقرأ على العباء:

```text
      cc: f2 0f 2a 40 04               	cvtsi2sdl	0x4(%rax), %xmm0
      d5: f2 0f 59 40 10               	mulsd	0x10(%rax), %xmm0
```

`cvtsi2sdl`تحويل عدد كامل من 32 بت من الذاكرة إلى مزدوج، مما يؤكد أن التفويض 4 يحمل عدد كامل من 4 بت. `mulsd`مضاعفة بمضاعفة من الذاكرة، لذلك تعويض 16 يحمل قيمة نقطة عائمة 8 بايت.

`label_length`يقرأ مؤشراً ثم يتابعه:

```text
      f3: 48 8b 40 18                  	movq	0x18(%rax), %rax
      f7: 48 63 4d f4                  	movslq	-0xc(%rbp), %rcx
      fb: 80 3c 08 00                  	cmpb	$0x0, (%rax,%rcx)
```

- نعم`movq`يقرأ 8 بايت في التداول 24. بمفرده هذا هو عدد كامل من 8 بايت أو مؤشر.`cmpb`يستخدم القيمة المحملة كأساس لعملة الذاكرة. القيمة التي تستخدم كعنوان هي مؤشر.`cmpb`يقرأ 1 بايت في المؤشر `%rcx`من ذلك، وفي`-O1`المؤشر متقدم مع `leaq 0x1(%rcx), %rcx`داخل الحلقة، لذلك العناصر المستهدفة إلى 1 بايت بعيدا.

لو وضعت الوظائف الخمسة معاً فإن الهيكل هو`{ i8 at 0, i32 at 4, i16 at 8, f64 at 16, pointer at 24 }`مع خطوة 32 . الفجوات في 1 إلى 3 و 10 إلى 15 هي بالضبط التدوية التي توقعها قواعد psABI. ما لا يقوله التعليمات: أسماء الأعضاء ، أن المؤشر هو `const char *`، النوع المعلن من البايت الموقّع عند 0 ، الذي يكتب المصدر `char`، وأن الوظائف الخمسة تتلقى نفس النوع.`main`، الذي يمر كائن إطار واحد إلى جميع الخمسة.`-O0`مواقع المكالمات تجعل ذلك مرئيًا: `leaq -0x70(%rbp), %rdi`يليها `addq $0x20, %rdi`قبل ذلك`callq bump`و`addq $0x40, %rdi`قبل ذلك`callq tag`. التكفيف 0`0x20`و`0x40`هي ثلاثة عناصر من صف واحد، وال `memcpy`من`0x60`البايتات التي تملأه هي 96 بايت، وهو ثلاثة عناصر من 32.

## المرور

`trace_function()`في`code/main.py`يمر إرشادات الوظيفة في ترتيب العنوان ويحافظ على حالة تجريدية صغيرة. حامل هو سجل 64 بت أو فتحة الإطار مثل `-0x8(%rbp)`كل حامل لديه واحد من ثلاثة قيم`Pointer`هو الجذر زائد تعويض ثابت زائد مجموعة من الخطوات، حيث تسجل خطوة أن مضاعفة مجهولة من ذلك العدد من البايتات قد تم إضافة.`Index`هو عدد كامل من القيمة غير المعروفة التي هي مضاعفة من مقياس. أي شيء آخر هو لا شيء.

البداية من ستة سجلات حجة النظام V`Pointer("param0", 0)`من خلال`Pointer("param5", 0)`ثم كل تعليمة تطبق قاعدة واحدة:

- أ`movq`بين سجل 64 بت وفرق الإطار نسخ القيمة. كتابة 32 بت أو أصغر إلى سجل تجعلها `Index`مع مقياس 1.
- أ`leaq`مع قاعدة المؤشر ينتج مؤشر مع إضافة التحول، وبالإضافة إلى سجل المؤشر يضيف `scale * index_scale`إلى الخطوات`leaq`قاعدة من`%rbp`أو`%rsp`اسم جسم الإطار، وهذا هو كيف `main`يمر`rows`. . .
- `shlq $n`على`Index`يضاعف حجمها`2^n`و`imulq $k`يضاعف ب `k`. . .
- `addq`من المؤشر والمرجع يحافظ على المؤشر ويضيف مقياس المؤشر إلى الخطوات. `addq $k`إلى مؤشر يُحرك تعويضها ويُسجل أيضاً كإضافة إلى هذا السجل.
- يجعلها المكالمة كل سجل مدفوع من المكالمة غير معروفة، و سجلات الحجج التي تحتوي على المؤشرات يتم تسجيلها كموقع المكالمة.
- أي عملة ذاكرة تحتوي على سجل أساسي يشير إلى أن تكون`Access`مع جذور المؤشر والعكس، وعرض ونوع من النموم، ودرجة المخزن.

الواسعة والنوع تأتي من الـ"منيمونيك" وحدها`access_width()`خرائط `b`،`w`،`l`و`q`الإضافات إلى 1، 2، 4، و 8 بايت، `movsbl`و`movswl`لتحملات ضيقة موقعة، `movzbl`إلى غير الموقعة،`sd`و`ss`تعليمات SSE المتقدمة للطائرات العائمة بـ8 بايت و4 بايت`cvtsi2sdl`إلى مصدر كامل من 4 بايت وقع عليه، و16 بايت `movaps`العائلة إلى المتجه`leaq`و `nop`الأوراق ليست إمكانية الوصول

```python
if memory.base in FRAME_REGISTERS:
    return Pointer(f"frame({memory.base}{format_signed(memory.displacement) if memory.displacement else ''})", 0)
base = env.get(memory.base)
if not isinstance(base, Pointer):
    return Unknown
strides = set(base.strides)
if memory.index is not None:
    index_value = env.get(memory.index)
    strides.add((index_value.scale if isinstance(index_value, Index) else 1) * memory.scale)
return Pointer(base.root, base.offset + memory.displacement, frozenset(strides), base.origin)
```

تحميل من 8 بايت من خلال المؤشر ينتج مؤشر جديد يطلق عليه الاسم الجذري على الحقل الذي جاء منه ، مثل `param0->0x18`عندما تستخدم هذه القيمة لاحقاً كقاعدة أو تقدم مع`leaq`، الحقل الذي جاء منه هو مسموح كمرشح مثبت. هذه هي القاعدة التي تحول تعويض 24 من "8 بايت" إلى "مرشح".

### أربعة أنواع من الدليل

`infer_layout()`يدمج إمكانات وصول كل وظيفة الشاهد ويجمع الخطوة من أربعة مصادر، كل منها مع التعليم الذي أنتجته.

| Kind | Where it comes from | Build that shows it |
|---|---|---|
| `scale` | an `Index` with scale above 1 reached a pointer, from `shlq $0x5` or `imulq` | `-O0`, `shlq $0x5, %rcx` at `0x59` |
| `loop-step` | a 64-bit increment of the base or index register inside a loop that also contains the access | `-O1`, `addq $0x20, %rdx` at `0x24` |
| `offset-delta` | same-width accesses through one base register inside one loop, at offsets a constant apart | `-O2`, eight loads 32 apart |
| `call-site` | the offsets at which one frame object is passed to the witness functions | `-O0`, `main` passes `rows`, `rows+0x20`, `rows+0x40` |

الحلقة هي عكس`jmp`أو فرع مشروط، ويعتبر زيادة فقط عندما يحتوي نطاق الحلقة على كل من زيادة والوصول.`addl $0x1, %eax`الذي يتقدم`i`في`-O0`، لأنه إضافة 32 بتة ولأن الوصول لا يمر من خلال `%eax`الخطوة الأخيرة هي أكبر مقسم مشترك لكل قيمة وجدت. الحجم هو الخطوة عندما يكون الخطوة أكبر على الأقل من نهاية الحقل الأخير.

### الحلقة المتجهة إلى -O2

في`-O2`الجهازات المتجهة`sum_balances`. جسم الحلقة من`0x50`إلى`0xaa`يقرأ ثمانية عناصر لكل مرسل:

```text
      3b: 48 8d 87 e4 00 00 00         	leaq	0xe4(%rdi), %rax
      50: 66 0f 6e 50 80               	movd	-0x80(%rax), %xmm2
      55: 66 0f 6e 98 60 ff ff ff      	movd	-0xa0(%rax), %xmm3
      61: 66 0f 6e 90 40 ff ff ff      	movd	-0xc0(%rax), %xmm2
      69: 66 0f 6e a0 20 ff ff ff      	movd	-0xe0(%rax), %xmm4
      7d: 66 0f 6e 10                  	movd	(%rax), %xmm2
      81: 66 0f 6e 58 e0               	movd	-0x20(%rax), %xmm3
      8a: 66 0f 6e 50 c0               	movd	-0x40(%rax), %xmm2
      8f: 66 0f 6e 60 a0               	movd	-0x60(%rax), %xmm4
      a0: 48 05 00 01 00 00            	addq	$0x100, %rax
      aa: 75 a4                        	jne	0x50 <sum_balances+0x40>
```

`%rax`يبدأ في`list + 0xe4`. ثمانية عمليات نقل تحوي الحمولة إلى تعويضات`0x04, 0x24, 0x44, 0x64, 0x84, 0xa4, 0xc4, 0xe4`من`list`، والتي هي`4, 36, 68, 100, 132, 164, 196, 228`. الزيادة هي`0x100`، وهو 256 . تمرير يسجل تعويضات كما يراه يبلغ ثمانية حقل وهيكل من 232 بايت على الأقل. القائمة صحيحة والنتائج خاطئة.

`fold_unrolled()`تطبق قاعدة واحدة. داخل حلقة واحدة، تأخذ وصولات ذات الاحجام من خلال سجل واحد أساسي. تعويضاتهم هي `d`بعيدا، هنا 32. إذا كانت خطوة الحلقة هي `k * d`وهناك بالضبط`k`التداعيات المختلفة، وكانت الحلقة مفتوحة`k`في بعض الأحيان، وكل وصول هو نفس عنصر الوصول في التداخل `(offset - lowest) mod d`- ها هي`256 = 8 * 32`مع ثمانية تعويضات، لذا كل ثمانية الحمولات ينحني على تعويض 4، والدقة دليل تسجيل`offset-delta 32`،`unrolled 32`و`loop-step 256`. حلقة بقايا القياسية في`0xe0`يضيف`scale 32`من`shlq $0x5, %rdx`و`loop-step 32`من`addq $0x20, %rdx`أكبر مقسم مشترك من جميع القيم الخمس هي 32

الصورة لديها زر يطفئ التطيع مع إيقافه`-O2`يظهر البناء سبعة حقل بعد البايت 32 و لا يوجد حجم. هذه الحالة هي ما يراه القارئ الذي يثق في التحول دون الحلقة.

## DWARF 5 من البايت

- نعم`-g`بناء`account.c`يحمل ثمانية أقسام إصلاح. `.debug_info`هو 493 بايت، `.debug_abbrev`179, `.debug_str`230، `.debug_str_offsets`124، `.debug_addr`112، `.debug_line`312`.debug_line_str`12، و `.debug_frame`264 - إدخال قوائم معيار DWARF 5 `.debug_str_offsets`،`.debug_addr`و`.debug_line_str`كما هو جديد في النسخة 5 . القارئ في `code/main.py`يحتاج الخمسة الأولى

### الرأس الوحدة

يقدم القسم 7.5.1.1 من المعيار عنوان الوحدة الكاملة لـ"التجميع": `unit_length`،`version`،`unit_type`،`address_size`و`debug_abbrev_offset`أول 12 بايت من`.debug_info`هي:

```text
e9 01 00 00   unit_length = 0x1e9 = 489
05 00         version = 5
01            unit_type = DW_UT_compile
08            address_size = 8
00 00 00 00   debug_abbrev_offset = 0
```

- نعم`unit_type`الطول يحتسب البايتات بعد نفسه، لذلك الوحدة التالية ستبدأ في `4 + 489 = 493`، نهاية القسم`llvm-dwarfdump --debug-info`يطبخ نفس القيم الخمسة على مقالاته`Compile Unit:`خط، والاختبار الأول يبحث عن هذا الخط ويقارن.

### اختصارات

يقول القسم 2.1 أن كل إدخال معلومات التحليل "يتكون من علامة تحديد ومجموعة من الصفات".`.debug_abbrev`(القطع 7.5.3) الذي يسمي العلامة، يقول ما إذا كان الأطفال يتبعون، ويرسل كل صفة مع شكلها. هذا الكائن لديه 14 إعلانات.

```text
[12] DW_TAG_structure_type  DW_CHILDREN_yes
     DW_AT_name              DW_FORM_strx1
     DW_AT_byte_size         DW_FORM_data1
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
[13] DW_TAG_member           DW_CHILDREN_no
     DW_AT_name              DW_FORM_strx1
     DW_AT_type              DW_FORM_ref4
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
     DW_AT_data_member_location  DW_FORM_data1
```

`parse_abbreviations()`يقرأ رمز ULEB128، علامة ULEB128، واحد الأطفال البايت، ثم صفة ونوع الأزواج حتى `0, 0`زوج. في القسم 7.5.6 يقدم رمزية النموذج: `data1`هو بايت واحد`ref4`هو تعويض 4 بايت بالنسبة لوحدة، `strx1`هو مؤشر بايت واحد في جدول تعويضات السلاسل`sec_offset`و`data4`هي 4 بايت، `addrx`هو مؤشر ULEB128 في جدول العناوين، `exprloc`هو طول ULEB128 و ذلك العديد من البايت، و `flag_present`لا يوجد بها بايت على الإطلاق

### فك الرقم من عضو الرصيد يدويا

إدخال الهيكل ل `account`يبدأ في التكفيف`0x195`مع البايتات`0c 15 20 00 03`رمز الإختصار هو 12، الهيكل`DW_AT_name`هو مؤشر السلاسل`0x15`،`DW_AT_byte_size`هو`0x20`= 32`DW_AT_decl_file`هو 0 و `DW_AT_decl_line`هو 3، وهو خط `struct account {`في المصدر

يبدأ الدخول الثاني للعضو في `0x1a3`مع`0d 10 88 01 00 00 00 05 04`:

1. `0d`هو اختصار 13، عضو.
2. `10`هو`DW_AT_name`كـ`strx1`: مؤشر السلاسل 16.
3. `88 01 00 00`هو`DW_AT_type`كـ`ref4`: تعويضات `0x188`من بداية الوحدة، وهو `DW_TAG_base_type`الإدخال المسمى`int`. . .
4. `00`هو`DW_AT_decl_file`و`05`هو`DW_AT_decl_line`: الخط 5 من `account.c`. . .
5. `04`هو`DW_AT_data_member_location`: التكفيف 4.

يقول القسم 5.7.6 أن إدخال عضو "يمكن أن يكون إما صفة DW_AT_data_member_location أو صفة DW_AT_data_bit_offset" وأن ثابت عدداً كاملا "هو التخفيض في البايتز من بداية الكيان المحتوى". هذا البايت هو نفس العدد الذي يتم تحويله في `addl 0x4(%rax), %ecx`و`compare_layouts()`هو الوظيفة التي تضع الجانبين جنبا إلى جنب.

### السلاسل والعناوين تذهب من خلال جدولين

مؤشر السلاسل 16 ليس تعويضًا لـ `.debug_str`القارئ يأخذ`DW_AT_str_offsets_base`من إدخال الوحدة، والذي هو 8، ويقرأ إدخال 4 بايت في `8 + 4 * 16`في`.debug_str_offsets`هذا الإدخال يحمل تعويضات`"balance"`في`.debug_str`نفس الإرشادات غير المباشرة تنطبق على العناوين.`sum_balances`يبدأ بالبايت`07 07`: اختصار 7، وبرنامج فرعي، ثم `DW_AT_low_pc`كـ`addrx`الإندكس 7 الإدخال 8-byte في `8 + 8 * 7`في`.debug_addr`هو`0x30`، عنوان الوظيفة في `.text`أول ستة إدخالات في هذه الجدول هي عناوين ستة سلسلة حرفية.

في كائن قابل للتنقل لا يوجد أي من الجداول تحتوي على قيمها النهائية.`.debug_str_offsets`هو صفر في الملف، و `.rela.debug_str_offsets`يحتفظ 29 `R_X86_64_32`عمليات نقل ضد`.debug_str`مع التعويض الحقيقي في الإضافة. `.debug_addr`لديه 13 `R_X86_64_64`عمليات نقل ضد`.text`و`.rodata.str1.1`. .`.debug_info`لديها أربع عمليات نقل خاصة بها: التكافؤ المختصر، `DW_AT_str_offsets_base`كـ`.debug_str_offsets+0x8`،`DW_AT_stmt_list`و`DW_AT_addr_base`كـ`.debug_addr+0x8`. .`ElfObject.relocated()`يطبق`S + A`للأنواع 32 بت و 64 بت قبل أن يقوم القارئ بتحليل قسم. رمز قسم لديه قيمة 0 في ملف كائن، لذلك يحصل الحقل على الإضافة. `llvm-dwarfdump`يظهر نفس القرار، ولهذا السبب يظهر إصدارها أسماء وعناوين مع كل مؤشر حل.

### الأنواع والوظائف والمواقع

`DwarfInfo.type_name()`يلي `DW_AT_type`الإشارات.`label`نقاط عضو في `DW_TAG_pointer_type`، والتي تشير إلى`DW_TAG_const_type`، والتي تشير إلى`char`النوع الأساسي، لذلك الاسم يتكون من `const char *`. .`type_size()`العائدات`DW_AT_byte_size`للأنواع والهياكل الأساسية، 8 للنقاط، والعد مرات حجم العنصر للمصفوفة. `type_kind()`يقلل من`DW_AT_encoding`من نوع أساسي إلى `int`مع علامة، أو`float`، و نوع المؤشر إلى `pointer`، وهو المفرد الذي تستخدمه المقارنة.

`DwarfInfo.functions()`يقرأ ستة `DW_TAG_subprogram`الإدخالات`bump`يذهب من`0x0`إلى`0x21`، وهو`DW_AT_low_pc`بالإضافة إلى`DW_AT_high_pc`طوله قاعدة الإطار هي`DW_OP_reg6 RBP`، وبرامجها`a`لديه تعبير الموقع`91 78`: `DW_OP_fbreg`مع قيمة SLEB128 `0x78`، وهو -8 . هذا هو فتحة الإطار`-0x8(%rbp)`حيث يتم تخزين الإدراجات`%rdi`في العنوان`0x4`معلومات التحليل والإرشادات تصف نفس الفتحة من جانبي

## مقارنة المخططين

`compare_layouts()`يمر أعضاء DWARF ويبحث عن حقل استنتاج في نفس التنازل.`no-evidence`. حقل من حجم مختلف هو `size-mismatch`عضو المؤشر الذي لم يتم إزالة الحقل من قبل هو`pointer-unproven`. نوع غير متفق ، مثل العباء حيث تستخدم التعليمات الرياضية للأعداد الكاملة ، هو `kind-mismatch`. الحقول المُسجلة التي تبدأ داخل عضو أو داخل التغطية هي`unexpected`الحجم يقارن الخطوة`DW_AT_byte_size`. . .

أرقام البناء الثلاثة، من`python3 code/main.py`:

| Build | Accesses through the first parameter | Fields | Stride evidence | Members matched | Size |
|---|---|---|---|---|---|
| `-O0` | 11 | 5 | `scale 32`, `call-site 32`, `call-site 64` | 5 of 5 | 32, match |
| `-O1` | 9 | 5 | `loop-step 32` | 5 of 5 | 32, match |
| `-O2` | 17 | 5 after folding, 12 before | `offset-delta 32`, `unrolled 32`, `loop-step 256`, `scale 32`, `loop-step 32` | 5 of 5 | 32, match |

الفجوات المستنتاجة هي بايت 1 إلى 3 و 10 إلى 15 في كل بناء، وهذه هي بالضبط بايتات التشغيل من ترتيب DWARF. كل حقل المستنتاج يقع في مضاعف من حجمها الخاص، وهو ما يتطلب قواعد psABI، و `natural_alignment_ok()`سجل ذلك.

إضافة الوظائف واحدة في كل مرة وتغير الصورة.`bump`وحدها التخطيط هو حقل واحد في التخفيف 4 ، والحجم غير معروف ، والحدود السفلى هو 8. `sum_balances`يضيف الخطوة.`tag`يضيف التداعيات 0 و 8. `projected`يضيف العائفة إلى 16.`label_length`يضيف المؤشر إلى 24 و يثبت أنه مؤشر. `main`يضيف مواقع المكالمات في `-O0`ولا يضيف أي شيء إلى`-O1`و`-O2`لأن المجمع وضع كل مكالمة في خط.

ثلاثة أشياء لا تصل إليها، الأسماء ليست في التعليمات`const`ليس في التعليمات النوع البنتا`label`هو فقط "عنصراً 1 بايت بعيداً" عن `leaq 0x1(%rcx), %rcx`في حلقة السلاسل، والتي تتوافق مع `char`و مع`unsigned char`و`_Bool`في`-O1`علامة البايت عند التداخل 0 غير معروفة، لأن `cmpb $0x6c, (%rdi)`تقارير الموافقة `int8`هناك و`i8`في`-O0`، حيث`movsbl`هذه هي الحقائق الدروس 35 سجلات كغير معروفة.

## كائنات C ++

`shapes.cpp`يحدد`Shape`مع مدمر افتراضي، افتراضي خالص `area()`وطبيعة افتراضية`name()`و`Rect`، والذي ينبع من`Shape`و يضيف اثنين`int`أيه تيانيوم C++ ABI يحكم كيفية تشغيل هذه على x86-64 لينكس.

### أسماء غير صحيحة

القسم 5.1.2 من القانون يقول "اسم يتم تدميرها من خلال التمهيئة`_Z`"الجهاز لديه 19 رمزاً من هذا القبيل.`_ZNK4Rect4areaEv`يقرأ`_Z`، ثم`N`لسم مستقر`K`لـ وظيفة عضو const، `4Rect`و`4area`كأسماء مصدر ذات مسبوقة طويلة ،`E`لإغلاق الاسم المُعشّر، و`v`لـ قائمة المعلمات الفارغة`llvm-cxxfilt`بصمات`Rect::area() const`. .`_Z8describeRK5Shapei`هو`describe(Shape const&, int)`: `R`هو مرجع`K`هو const،`5Shape`هو الفصل،`i`هو`int`. الاسماء الخاصة في القسم 5.1.4 هي `_ZTV`لـ (فيتبول)`_ZTI`لـ "تايف انفو" و`_ZTS`للسلسلة الاسم Typinfo. المُبنيون والمُدمّرون`C1`،`C2`،`D0`،`D1`و`D2`، لذا`_ZN4RectD0Ev`و`_ZN4RectD2Ev`كلتا الطرازين`Rect::~Rect()`: مدمر القضاء والمدمر الأساسي يشتركون في اسم المصدر.

`Demangler`في`code/main.py`تغطي هذه المجموعة الفرعية بالإضافة إلى رموز نوع البناء في القسم 5.1.5.2 و `S_`استبدال الفقرة 5.1.10 الاختبار ينفذ على جميع الأسماء 19 ويتم مقارنتها مع الأسماء التي تم القبض عليها`llvm-cxxfilt --no-strip-underscore`النتائج: العلم مهم على macOS، حيث تسحب الأداة نقطة تأكيد واحدة مقدمة بشكل افتراضي ثم لا يتم التعرف عليها `Z8describe...`. . .

### المعدات التي تم نقلها

يذكر القسم 2.5.2 من ABI مكونات الجدول الافتراضي بالترتيب: تعويضات الدعوة الافتراضي، تعويضات القاعدة الافتراضي، تعويض إلى الأعلى، مؤشر typeinfo، ومن ثم مؤشرات الوظيفة الافتراضية. نقطة العنوان، القيمة التي تحتوي عليها vptr للكائن، هي عنوان مؤشر الوظيفة الأول (قسم 2.6.2). `Rect`ليس لديها قواعد افتراضية، لذلك يتم تعويض جدولها إلى أعلى، وتصفيف المعلومات، والعملات.

الرمز`_ZTV4Rect`هو 0x30 بايت، ستة فجوات 8 بايت. في الموضوع كل بايت هو صفر. المحتوى في `.rela.data.rel.ro._ZTV4Rect`:

```text
0000000000000008 R_X86_64_64              _ZTI4Rect
0000000000000010 R_X86_64_64              _ZN4RectD2Ev
0000000000000018 R_X86_64_64              _ZN4RectD0Ev
0000000000000020 R_X86_64_64              _ZNK4Rect4areaEv
0000000000000028 R_X86_64_64              _ZNK4Rect4nameEv
```

سلايت 0 تحتفظ بالتعويض إلى الأعلى ، وهو 0 ولا يحتاج إلى إعادة التنقل. سلايت 1 هو نوع المعلومات. نقطة العنوان هي في `+16`من هناك، فتحة 0 هي مدمرة الكائن الكامل، فتحة 1 مدمرة الحذف، فتحة 2`area`، الفقرة 3`name`. .`read_vtable()`يقرأ حجم الرمز، وإعادة التنقل في نطاقه، والصفر عند التنازل 0. `Shape`طاولة لديه نفس الشكل مع`__cxa_pure_virtual`في فتحة 2، وهو وظيفة وقت تشغيل التي تصل مكالمة افتراضية نقية.

### RTTI

القسم 2.9.4 يصف `std::type_info`ك vptr يليها مؤشر لسم النوع المختلف، ويرسل الفئات المشتقة. `_ZTI4Rect`لديه ثلاثة عمليات نقل: `_ZTVN10__cxxabiv120__si_class_type_infoE+0x10`،`_ZTS4Rect`و`_ZTI5Shape`الأول هو القائمة`__si_class_type_info`، فئة تستخدمها ABI للنوع مع قاعدة عامة واحدة غير افتراضية عند التكفيف الصفر، و `+0x10`هو نقطة العنوان في هذه اللوحة. النقاط الثانية في السلسلة `4Rect`، وهو اسم النوع المزعج ، و`name()`على`type_info`يعود بالضبط هذا السلسلة. الثالث هو القاعدة. `_ZTI5Shape`استخدامات`__class_type_info`و لا يوجد له مؤشر أساسي`read_typeinfo()`يعيد هذه الحقائق الثلاثة

### المكالمة الافتراضية

`describe`في`-O0`يقوم بمكالمة افتراضية واحدة:

```text
       f: 48 8b 7d f8                  	movq	-0x8(%rbp), %rdi
      13: 48 8b 07                     	movq	(%rdi), %rax
      16: ff 50 10                     	callq	*0x10(%rax)
```

الأول`movq`يُحمل مؤشر الكائن. يقرأ الثاني 8 بايت في تعويض 0 من الكائن، وهو vptr، لأن ABI يضعها أولاً في فئة ذات وظائف افتراضية.`callq`يمر`0x10`لقد مرّت (VPTR) ، و`0x10 / 8`هو فتحة 2.`find_virtual_calls()`يطابق النمط ويقدم تقارير لكل من المرشحين: `Rect::area() const`من`_ZTV4Rect`و`__cxa_pure_virtual`من`_ZTV5Shape`أي واحد يدير يعتمد على الكائن، وهذا هو السبب في أن المكالمة غير مباشرة.

-تسجيلات DWARF نفس الفتحة`DW_TAG_subprogram`إدخالات `area`في كلا الفئتين تحمل`DW_AT_vtable_elem_location (DW_OP_constu 0x2)`،`name`يحمل فتحة 3 والمدمرون يحملون فتحة 0. `Rect`هو`DW_TAG_structure_type`16 بايت مع `DW_TAG_inheritance`الإدخال`Shape`في الموازنة 0 والعضاء `w`في الساعة الثامنة`h`في الساعة 12`Shape`هو 8 بايت مع عضو اصطناعي واحد `_vptr$Shape`اثنين من مشتقات مستقلة يعطي فتحة 2 ل`area`: جدول الترحيل وإدخالات التحليل.

في`-O1`لا يوجد في هذا الكائن أي شيء`main`المباني`Rect`كالموقع المحلي، لذلك حل المحمول `r.name()`و`describe(r, 2)`في وقت تجميع وتخطيطها. لا شيء يأخذ عنوان الجدول، لذلك الجدول لا يتم إصدار. `describe`لا يزال يحتوي على`movq (%rdi), %rax`و`callq *0x10(%rax)`، لأن ملامحها يمكن أن تكون أي `Shape`. الملف المفقود هو حقيقة حول ملف كائن واحد، والاختبار `test_the_optimised_object_keeps_the_call_pattern_but_drops_the_vtables`يُحقق من كلا النصفين

تختلف ميكروسوفت ABI في كل من هذه التفاصيل.`?`وترجمة الاتفاقية المكالمة، لذلك `void test(void)`تم تجميعها كـ C++ `__cdecl`هو`?test@@ZAXXZ`. مقياس RTTI يقع في `vfptr[-1]`كـ`_RTTICompleteObjectLocator`، والرموز هي`??_7`لـ (vftable) و`??_R4`ويقول وثائق مايكروسوفت الخاصة أنه "لا توجد معايير لتسمية C++ بين بائع المجمعين".

## كيفية توضيح الأدوات الأنواع التي تم استعادتها

كل سطر أسفل الذي يسمي خروجا تم إنتاجها على هذه الآلة و تم تسجيلها إلى`code/fixtures/tools/`الصفوف للأدوات التي لا تثبت هنا تصف وثائقها وتقول ذلك.

| Tool | Version, licence | Where types live | On our fixtures |
|---|---|---|---|
| Ghidra | 12.1.4, 2026-09-21, Apache-2.0 | Data Type Manager with built-in, user-defined, and derived types; `.gdt` archives; types used by a program are copied into it | With DWARF: `/DWARF/account.c/account size=32 align=8` and `a->balance = by + a->balance;`. Without: `*(int *)(param_1 + 4)` with `long param_1`, `tag(char *param_1)`, and `*(char **)(param_1 + 0x18)` |
| IDA Pro | 9.4, 2026-07-13, commercial; IDA Free is non-commercial with a cloud decompiler for x86 only | Local Types window, `.til` type libraries, DWARF and PDB import into a `dwarf` or `pdb` folder | Not installed. Documentation only |
| Binary Ninja | 6.0, 2026-09-03, commercial with a Free edition | Type editing, header import and export, type archives, debug info from DWARF and PDB, type libraries, platform types | Not installed. Documentation only |
| radare2 | 6.2.4, 2026-10-05, LGPLv3 | `ts`, `tsc`, `afvd` | `ts` and `tsc account` printed nothing for the relocatable object with `bin.dbginfo=true`; `pdf` shows `mov dword [rax + 4], ecx` with source line comments from DWARF |
| rizin | 0.9.1, 2026-06-29, LGPL core | `ts`, `tsc`, `afvd` | `tsc account` printed `struct account { char kind; int balance; short code; double rate; const char *label; };` from DWARF; the build without `-g` lists only its bundled header types |
| lldb | lldb-1703.0.236.21 | `image lookup -t` | `byte-size = 32` and the full `compiler_type` text from the ELF object |
| gdb | not installed here | `ptype /o` prints "the offsets and sizes of fields in a struct" with holes marked | Documentation only |
| pyelftools | 0.33, public domain | Python API over `.debug_info` | A 43-line script prints the same five members and `unit version 5` |
| llvm-dwarfdump | Apple LLVM 17.0.0 | `--debug-info`, `--debug-abbrev`, `--debug-str-offsets` | The oracle for every reader test |

إن إصدار غيدرا بدون DWARF يظهر نفس القواعد في العمل. تم تعيين مفكّرها `char *`إلى مُعيار `tag`لأن الوظيفة تقارن بايت واحد من خلالها، و`char **`إلى الميدان في`0x18`لأن`label_length`يُحذف القيمة المحملة ويقارن البايتات. هذه نفس القواعد الثنائية التي تطبق عليها الممر في هذا الدروس: عرض من التعليمات، مؤشر من الإشارة. تقول وثائق Ghidra لفك الكود p-code varnodes "لا يكون لزميا نوع البيانات المرتبطة بهم" وأن المفك "في النهاية يعطي نوع البيانات الرسمية" عن طريق الانتشار. خيار "إضافة مؤشرات ثابتة" يمتد نفس الانتشار إلى ثابتات. إضافة Ghidra 12.1 استعادة الحقول البيت إلى المتحلل، والتي لا تنفذ معدات هذا الدروس.

الطاولة المصنوعة يدويا هي النصف الآخر من القصة مدير نوع البيانات في Ghidra، الأنواع المحلية في IDA، أرشيف النوع من Binary Ninja، و rizin `td`كل ما يسمح لك أن تكتب الهيكل من التخطيط المردد ومشاهدة إعادة تقديم المتحلل. المرور يخبرك ما الذي يجب أن تكتب وماذا الحقول التي تخمن.

rea 6.5.0 مع مزودها Ghidra يعيد نص المتحلل كسجل. كل شيء في صف Ghidra ينطبق عليه، والسجل يحمل أسماء النوع دون دليل الذي أنتجهم.`python3 code/main.py infer`في نفس القائمة يعطيك هذا الدليل

## أبحاث التأثيرات النوعية

الممر هنا هو نصف توليد القيود من نظام استنتاج النوع، المحدود إلى واحد من الهياكل التي تمت الوصول إليها من معايير.

- قام TIE (Lee، Avgerinos، Brumley، NDSS 2011) بإعداد إعادة بناء النوع كإنتاج قيود وحل على IR ثنائي، وقاس الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحفاظ على الحما.
- إضافة Retypd (Noonan, Loginov, Cok, PLDI 2016) إلى النماذج الفرعية والكثافة والأنواع المتراجعة، وأبلغ عن إعادة بناء المؤشر `const`تعليقات مع 98٪ استرجاع. تنفيذ مفتوح المصدر موجود تحت اسم GrammaTech.
- تعامل OSPREY (Zhang وغيرها، IEEE S&P 2021) كل موقع ذاكرة كمقعد عشوائي وتستدعي الأنواع الأكثر احتمالا.
- DIRTY (Chen وغيرها، USENIX Security 2022) و ReSym (Xie وغيرها، CCS 2024) إصدار مفصلات بعد العملية مع نماذج متعلمة، و ReSym تقرير دقة 72.9% على التخطيطات البنية الكاملة.
- RecStruct (Chen وغيرها، USENIX Security 2026) يسترد ضربات مستقرة دون جهاز تحلل، مع تنفيذ رمزي غير حساس للتدفق والعثور على الاتحاد على فتحات كومة.

إنّه أول شيء يُغيب عنه هذه الدروس`-O1`،`main`يحتفظ`rows`على كومة و الرمز المخطوط يقرأ`0x24(%rsp)`،`0x40(%rsp)`،`0x48(%rsp)`،`0x30(%rsp)`و`0x38(%rsp)`هذه التكافؤات المودول 32 هي 4، 0، 8، 16 و 24: نفس البنية، بدون أي معايير للزراعة من.

## بناءها

أطلق التجربة:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
```

إن المخرج هو تقرير JSON واحد مع خمسة أجزاء. `dwarf`يحتوي على عنوان الوحدة، والهياكل، والوظائف من `-O0`-أجسام`oracles`يحتوي على ترتيب قاعدة psABI ،`ctypes`التخطيط، التخطيط DWARF، التشغيل الأصلي، و `agree`العلم`builds`يحتوي على الوصولات، والتخطيط المستنير، والمقارنة لكل من الأشياء الثلاثة. `cxx`تحتوي على الأسماء المفصلة، كل من vtables، كل من سجلات typinfo، المكالمة الافتراضية، والمساحات DWARF. `tools`يُدرج أداة النتائج التي تم التقاطها.

الشكل المتوقع:

```json
{
  "dwarf": {"unit": {"unitLength": 489, "version": 5, "unitType": "DW_UT_compile", "addressSize": 8, "abbrevOffset": 0}, "...": "..."},
  "oracles": {"agree": true, "psabiRules": {"size": 32, "align": 8, "...": "..."}, "...": "..."},
  "builds": {
    "O0": {"layout": {"stride": 32, "size": 32, "gaps": [1, 2, 3, 10, 11, 12, 13, 14, 15], "...": "..."}, "comparison": {"matches": 5, "members": 5, "...": "..."}},
    "O1": {"...": "..."},
    "O2": {"...": "..."}
  },
  "cxx": {"virtualCalls": [{"slot": 2, "candidates": {"Shape": "__cxa_pure_virtual", "Rect": "_ZNK4Rect4areaEv"}, "...": "..."}], "...": "..."}
}
```

اقرأ`code/main.py`في هذا الترتيب:

1. `ElfObject`يقرأ القسمات والرموز والتحركات، و`relocated()`يطبق`S + A`إلى قسم التحليل
2. `parse_abbreviations()`و`DwarfInfo._parse_unit()`اقرأ العنوان، و جدول الإختصار، والإدخالات، ثم حل `strx`و`addrx`عبر الطاولتين
3. `DwarfInfo.struct_layouts()`و`functions()`تحويل الإدخالات إلى `StructLayout`و`FunctionInfo`السجلات، مع `type_name()`،`type_size()`و`type_kind()`. . .
4. `parse_listing()`،`parse_memory()`و`access_width()`اقرأ`llvm-objdump`رسالة
5. `trace_function()`هو آلة الحالة المجردة، و`fold_unrolled()`و`infer_layout()`تحويل الوصول إلى تخطيط.
6. `compare_layouts()`يُنتج صفوف الحالة، و`sysv_layout()`و`ctypes_layout()`هي الـ (أوراكول) الثانيين الآخرين
7. `Demangler`،`read_vtable()`،`read_typeinfo()`و`find_virtual_calls()`تغطي كائن C ++

هناك أربعة أوامر أخرى`python3 code/main.py dwarf FILE.o`يطبخ هيكل وظائف أي كائن قابل للانتقال من DWARF 5. `python3 code/main.py infer LISTING.txt [FILE.o]`يستخدم المرور على قائمة ويقارن مع كائن مع DWARF`python3 code/main.py demangle NAME...`و`python3 code/main.py vtable FILE.o`تغطي نصف C ++

## استخدمها

على كائن جديد بنيته بنفسك

1. القبض`llvm-objdump -d -r`ويحفظها بجوار هذا الموضوع.
2. أركض`python3 code/main.py infer`في القائمة. اقرأ خط الشهود أولاً: يذكر الوظائف التي استخدمت فيها المعلمة الأولى كأساس ذاكرة. إذا كانت الوظائف مفقودة، فإن معلمتها لم تصل إلى عمل ذاكرة، أو بلغت واحدة من خلال مسار لا تتبعه المرور.
3. اقرأ كل حقل مع عدد الوصول واحد الوصول هو شاهد واحد سجل حقل مع شاهد واحد كما استنتج
4. اقرأ دليل الخطوات`call-site`أو`scale`دخول قوي واحد`loop-step`إن الدخول بدون نوع آخر ضعيف، لأن حلقة غير مقمعة تشير إلى خطوة عدة عناصر.`unrolled`يبدو، تحقق من المثوب يدويا.
5. إذا كان`-g`إنّه يُوجد، قم بتقارنة القراءة، وقرأ كل سطر غير موجود`match`.`no-evidence`صف أسماء عضو لا عمل لمس.`unexpected`أسماء الصف التي لم يتمكن المرور من إرسالها
6. اكتب التخطيط في مدير النوع في أداتك كمنشأة، وتسجل أي حقل وأسماء وأنواع تخمينات.

أبقوا الأوراقل الثلاثة في متناولكم عندما تصل القواعد`ctypes`و DWARF لا يوافقون على ترتيب كتبتموه، لقد وجدتم بنية معبأة، حقل بيت، أو هدف مع قواعد مختلفة.

## المختبر التفاعلي

### المختبر A: فك رمز إدخال الأعضاء

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types/code
python3 -q
```

أركض

```python
from main import *
elf = load_object("account-x86_64-O0-g.o")
dwarf = DwarfInfo(elf)
dwarf.header()
elf.section(".debug_info").data[0x1a3:0x1ac].hex(" ")
dwarf.dies[0x1a3].attributes
dwarf.type_name(dwarf.type_of(dwarf.dies[0x1a3]))
```

فكّر التسعة بايت على الورق مع اختصار 13 قبل أن تنظر إلى القاموس ثم قراءة القسم الخام دون نقل`elf.section(".debug_str_offsets").data[8:16].hex()`، والذي تم نقله`elf.relocated(".debug_str_offsets")[8:16].hex()`و اشرح الفرق

### المختبر ب: تتبع وظيفة واحدة

```python
listing = load_listing("account-x86_64-O0-g.objdump.txt")
trace = trace_function("label_length", listing["label_length"])
[(hex(a.address), a.root, a.offset, a.width, a.kind) for a in trace.accesses]
trace.pointer_uses
trace_function("sum_balances", listing["sum_balances"]).loops
```

اكتب قبل تشغيله، أي وصول يثبت أن تعويض 24 هو مؤشر. ثم تشغيل نفس الخطوط على `-O1`إدراج العناوين والعثور على `leaq 0x1(%rcx), %rcx`في`trace.increments`. . .

### المختبر C: طي حلقة متجهة

```python
o2 = load_listing("account-x86_64-O2-g.objdump.txt")
trace = trace_function("sum_balances", o2["sum_balances"])
sorted({a.offset for a in trace.accesses})
folded, evidence = fold_unrolled(trace, trace.accesses)
sorted({a.offset for a in folded}), [(e.kind, e.value, e.text) for e in evidence]
```

ثمّ تهرب`analyze_build("O2", fold=False)["comparison"]`و أعد`unexpected`صفوف. تغيير قاعدة التثبيت حتى يتطلب خطوة الحلقة أن تكون بالضبط`k * d`مع`k`على الأقل 2 و تأكد من أن `-O1`حلقة، مع وصول واحد وخطوة 32، يترك وحده.

### المختبر D: المكتب والأسماء

```python
shapes = load_object("shapes-x86_64-O0-g.o")
read_vtable(shapes, "_ZTV4Rect")
read_typeinfo(shapes, "_ZTI4Rect")
demangle("_ZNK4Rect4areaEv"), demangle("_Z8describeRK5Shapei")
find_virtual_calls(load_listing("shapes-x86_64-O0-g.objdump.txt"), [read_vtable(shapes, "_ZTV5Shape"), read_vtable(shapes, "_ZTV4Rect")])
```

احسب الفجوة من`callq *0x10(%rax)`على الورق، ثم تأكيد ضد`DwarfInfo(shapes).struct("Rect").virtual_methods`- ثم تحميل`shapes-x86_64-O1-g.o`و حاول`read_vtable`اقرأ القصة`ElfError`ويشرح لماذا الرمز غائب

## مختبر التدريب

استعادة الهيكل في `main`في`-O1`. . .

المتطلبات:

- التمديد`trace_function()`حتى منطقة فتحة الإطار يمكن أن تكون جذورا.`movaps`المحلات التي تملأ`0x0(%rsp)`إلى`0x5f(%rsp)`من`.data.rel.ro`، وهو المُبداع البيطاني 96 من `rows`. . .
- إعطاء الوصولات المضافة`0x24(%rsp)`،`0x40(%rsp)`،`0x48(%rsp)`،`0x30(%rsp)`و`0x38(%rsp)`إلى ذلك الجذر وتقديم تقرير تعويضاتهم modulo a متقدمة خطوة.
- استنتاج الخطوة 32 من الحلقة في `0x120`إلى`0x12c`، حيث`%r14`يبدأ في 4 ويتقدم في `0x20`حتى`0x64`، و أظهر أن الحلقة مرتبطة`0x64`هو ثلاثة عناصر زائد تعويضات الحقل.
- مقارنة النتيجة مع تصميم DWARF وصلت إلى خمسة تطابقات، وتسجيل أي أنواع لا يزال غير مثبتة.
- إضافة اختبار يفشل عندما يتم إعطاء جذور الإطار إلى معايير.

النجاح يعني`python3 code/main.py infer`على`-O1`قوائم الإدراجات `main`كشهد مع جذور الإطار، والمقارنة تظهر خمسة مطابقات من`main`وحدها

## درساً أساسياً

هذا الدروس يتضمن`outputs/skill-recovering-data-and-types.md`. استخدمها لتحويل قائمة وإعداد إصلاح اخياري إلى تخطيط هيكل مع دليل لكل حقل ، خطوة مع مصادرها ، مقارنة مع DWARF ، وقائمة لما لم يُعرف. يتطلب جدول الوصول ، دليل الخطوة ، والتحقق من التثبيت ، والكتابة DWARF عندما يكون هناك واحد ، وإعلان الأسماء والمؤهلات التي لا يمكن أن تقدم أي تعليمات.

## تحقق من ذلك

إشغال التجربة والسلسلة التحديدية:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

يجب أن تثبت التحقق:

- رأس الوحدة، والـ 14 اختصار، والـ5 أعضاء التوازنات توافق على `llvm-dwarfdump`
- الأسم يصل من خلال المنتقلين`.debug_str_offsets`الطاولة ووحدة `str_offsets_base`و`addr_base`هي 8
- ستة وظائف تحمل النطاقات`DW_OP_reg6 RBP`و`DW_OP_fbreg`المواقع التي يظهرها المجمع، وعناوينها المنخفضة تساوي إدراج الوظيفة يبدأ
- كائن بدون`.debug_info`يرفع، و إدارة ليب128`0x78`كـ -8
- `pyelftools`و`lldb`طبع نفس التخطيط مثل القارئ
- قواعد psABI`ctypes`، DWARF، والسير الأصلي يعطي تعويضات `0, 4, 8, 16, 24`و حجم 32، و إعادة ترتيب الهيكل هو 24 بايت
- يقرأ المصفح المذكور 13 تعليمات في `bump`، المرفقات`R_X86_64_PLT32 bump-0x4`إلى المكالمة`0x194`، ويقوم بالقفز للخلف في`0x72`
- أوبراند الذاكرة، وعرضها، وأنواعها، والرسومات تشفير من نص AT&T والمنمونيك
- `bump`في`-O0`يقرأ المؤشر مرة أخرى من فتحة الإطار ويقوم بثلاث وصولات في التداخل 4
- خطوة تأتي من`shlq $0x5`في`-O0`، من`addq $0x20, %rdx`في`-O1`، ومن ثمانية عبء مطوية بخطوة من 256 في `-O2`
- `label_length`يثبت المؤشر في المكافأة 24 عن طريق إزالتها
- `main`يمر كائن الإطار واحد عند التداعيات 0 `0x20`و`0x40`في`-O0`و لا يطلب شيئا سوى`printf`في`-O1`
- كل بناء يطابق خمسة من خمسة أعضاء بحجم 32 وفرق تساوي ملابس DWARF
- بدون طيّة`-O2`إعداد تقارير سبع حقل ما بعد 32 بايت ولا يوجد حجم
- المُزعج يُعدّل كلّ 19 `llvm-cxxfilt`السلاسل
- كل من الملفات المتحركة، كل من سجلات المعلومات النموذجية، والكالم الافتراضي في `0x16`قرروا في الحفرة 2 و DWARF توافق
- الموقع`-O1`كائن C ++ يحافظ على نمط الدعوة وليس لديه أي vtable
- تظهر صور غيدرا و ريزين و رادار2 الهيكل مع DWARF والعكسات الخام دونها
- الرقم التفاعلي يضم نفس البيانات التي ينتجها التحليل

## أساليب فشل الإنتاج

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Unrolled loop | Eight fields 32 bytes apart and a 232-byte struct | Loop step 256 equals 8 times the offset delta 32, so one field at offset 4 |
| Stride read from one increment | `sizeof` 256 from `addq $0x100` | The greatest common divisor of every stride source, with the scalar tail's `addq $0x20` |
| 8-byte field called a pointer | `void *` at offset 24 | A later access uses the loaded value as a base, or the kind stays `int64` |
| Pointer called an integer | `long` at offset 24 | The dereference at `0xfb`, recorded as pointer proof |
| Narrow compare | `char` with a sign | `cmpb` carries no sign; only `movsbl` or `movzbl` does |
| Five functions assumed to share a type | One struct with no evidence of aliasing | Call sites in `main` that pass one frame object, or an explicit analyst assertion |
| Strings read from `.debug_str` by index | Garbage names from a relocatable object | `str_offsets_base` plus the relocated `.debug_str_offsets` entry |
| Addresses read as numbers | `low_pc` of 0 for every function | `addrx` through the relocated `.debug_addr` table |
| DWARF 4 object | A reader that misparses the header | Version check on the second header field; 4 has no `unit_type` byte |
| Missing vtable | "the class has no virtual functions" | The `-O1` object inlined every call; the `-O0` object has the table and its relocations |
| Vtable slot read from the wrong base | Off-by-two slot numbers | The address point is 16 bytes past the symbol, after offset-to-top and typeinfo |
| Mangled name stripped | `Z8describeRK5Shapei` left as is | `--no-strip-underscore` on macOS, or a demangler that checks for `_Z` |
| Struct typed from one tool's guess | `char *param_1` taken as the field type | The width and the dereference, written as evidence, and the name marked as a guess |

## قاعدة العمليات

استعادة حقل من وصول وخطوة من حلقة، ورابط التعليمات لكل منها. انطلاقاً من الحلقات المفتوحة قبل أن تثق في تعويضات ما بعد الخطوة اقرأ DWARF من خلال اختصاراته وجداولها المتنقلة، أبداً عن طريق الترتيب إلى قسم سلسلة. مقارنة الحقل مع الحقل وكتب كل عضو بدون دليل، كل مؤشر غير مثبت، وكل اسم كما مجهول. في كائن C ++، قراءة vtable من إعادة التنظيمات الخاصة بها والفرق من الدعوة، ثم استخدام DWARF لتأكيد الفرق الذي تقرأ.

## المزيد من القراءة

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, section 3.1.2: Data Representation](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), section 5.10: Composite Types](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 1, section 3.7.5: Specifying an Offset](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [DWARF Debugging Information Format Version 5, sections 2.1, 5.7.6, 7.5.1.1, 7.5.3, 7.5.6](https://dwarfstd.org/doc/DWARF5.pdf)
- [Itanium C++ ABI, sections 2.5 (Virtual Table Layout), 2.9 (Run-Time Type Information), 5.1 (External Names)](https://itanium-cxx-abi.github.io/cxx-abi/abi.html)
- [Microsoft Learn: Decorated names](https://learn.microsoft.com/en-us/cpp/build/reference/decorated-names?view=msvc-170)و[Name Decoration](https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/name-decoration?view=msvc-170)
- [llvm-dwarfdump command guide](https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html)و[llvm-cxxfilt command guide](https://llvm.org/docs/CommandGuide/llvm-cxxfilt.html)
- [Python ctypes: Structure layout, sizeof, alignment](https://docs.python.org/3/library/ctypes.html)
- [Ghidra Data Type Manager](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/help/help/topics/DataTypeManagerPlugin/data_type_manager_description.htm)،[Decompiler Concepts](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerConcepts.html)،[Decompiler Options](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerOptions.html)و[Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build)
- [IDA 9.1 user guide: Types](https://docs.hex-rays.com/9.1/user-guide/types)،[IDA 9.4 release post](https://hex-rays.com/blog/ida-9.4-release-a-new-dyld-shared-cache-swift-analysis-new-teams-add-on-and-more-)و[IDA Free](https://hex-rays.com/ida-free)
- [Binary Ninja user guide: Types](https://docs.binary.ninja/guide/types/)و[Binary Ninja 6.0 Krypton](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)و[rizin v0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
- [GDB manual: Examining the Symbol Table, ptype /o](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Symbols.html)
- [pyelftools on PyPI](https://pypi.org/project/pyelftools/)
- [Lee, Avgerinos, Brumley, "TIE: Principled Reverse Engineering of Types in Binary Programs" (NDSS 2011)](https://www.ndss-symposium.org/ndss2011/tie-principled-reverse-engineering-of-types-in-binary-programs/)
- [Noonan, Loginov, Cok, "Polymorphic Type Inference for Machine Code" (PLDI 2016)](https://arxiv.org/abs/1603.05495)و[the retypd repository](https://github.com/GrammaTech/retypd)
- [Zhang et al., "OSPREY: Recovery of Variable and Data Structure via Probabilistic Analysis for Stripped Binary" (IEEE S&P 2021)](https://ieeexplore.ieee.org/document/9519451/)
- [Chen et al., "Augmenting Decompiler Output with Learned Variable Names and Types" (USENIX Security 2022)](https://www.usenix.org/conference/usenixsecurity22/presentation/chen-qibin)
- [Xie et al., "ReSym: Harnessing LLMs to Recover Variable and Data Structure Symbols from Stripped Binaries" (CCS 2024)](https://dl.acm.org/doi/10.1145/3658644.3670340)
- [Chen et al., "RecStruct" (USENIX Security 2026)](https://www.usenix.org/conference/usenixsecurity26/presentation/chen-yuxin)
