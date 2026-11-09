# تشريح البرنامج: قارئ ELF من الصفر

> البرنامج المجمّع هو مجموعة من الجداول التي تشير إلى بعضها البعض. القارئ الذي كتبته يعطي الناتج يمكنك التحقق من البايت بـ البايت.

**Type:** Build
**Languages:** Python (stdlib), TypeScript, C (fixture only)
**Prerequisites:** Phase 0 · 01 (Dev Environment) with clang installed, Python 3.10 or later, hexadecimal arithmetic
**Time:** ~120 minutes

## أهداف التعلم

- أوضح قاعدة الإذن لكل هدف في هذا المسار والحدود الأربعة في 17 يو إس سي 1201 ((f).
- اقرأ رأس ELF، جدول رأس القسم، وكلا الجداول الثنائية`struct.unpack`. . .
- فك الرمز`.symtab`الإدخالات و`.rela`سجلات مع الأسماء من gABI و x86-64 psABI.
- أعيد البايتات الدقيقة للعمل المسمى و خريطة كل ملف تعويض إلى الهيكل الذي يملكه.
- قراءة عناوين البرنامج و خريطة عنوان افتراضي إلى ملف تعويض من خلال `PT_LOAD`. . .
- اقرأ أوامر الحمل من كائن ماخ او وسمي فكرة ELF التي تتطابق كل واحد.

## قبل أن تبدأ: الاختيار والقانون

كل هدف في الدروس 32 إلى 36 هو برنامج كتبته و تجمعه`code/fixtures/ledger.c`لا توجد ترخيص للقراءة، لا توجد حماية للعبور، ولا ثالثين تفتحون رموزهم. لا تغطي المسار أبدا حماية البرمجيات، أو فحص الترخيصات، أو البرامج التي لا تملكها.

القاعدة موجودة لأن القانون يعامل التفكيك كنسخة. في شركة "سيغا إنتربرايزز" المحدودة (ف) أكوليد، إك.*، 977 ف.2د 1510 (9th Cir. 1992) ، قضت المحكمة أن النسخة الوسطى التي تمت خلال تفكيكها هي نسخ بموجب قانون حقوق الطبع والنشر. ثم أعلنت أنه "حيث يكون التفكيك هو الطريقة الوحيدة للحصول على الوصول إلى الأفكار والعناصر الوظيفية التي تجسد في برنامج كمبيوتر يحمي حقوق الطبع والنشر، وحيث يكون هناك سبب مشروع لطلب هذا الوصول، فإن التفكيك هو استخدام عادل للعمل يحمي حقوق الطبع والنشر، كموضوع قانوني". 

القضية الثانية هي * Sony Computer Entertainment, Inc. بمقابلة شركة Connectix Corp.*، 203 F.3d 596 (9th Cir. 2000). نسخ Connectix نظام البيولوجيا البيولوجية للاستشعار بينما كانت تبني محاكاة، وقالت المحكمة إن هذه النسخ تستخدم بشكل عادل. كلتا القضايا حماية الدراسة. لا أحد من النسخ المنسخة محمية في المنتج النهائي.

قانونان يحددون الحدود 17 قانون الولايات المتحدة 1201 ((و) يسمح لشخص "حصل على الحق في استخدام نسخة من برنامج كمبيوتر" بتحايل ضوابط الوصول "لأغراض الوحيدة لتحديد وتحليل عناصر البرنامج اللازمة لتحقيق التفاعل بين برنامج كمبيوتر تم إنشاؤه بشكل مستقل مع برامج أخرى". أربعة قواعد الحد: نسخة قانونية، الغرض من التشغيل، العناصر التي لم تكن متاحة "بسهولة" بالفعل، والتحليل الذي لا ينتهك خلافا. القسم 1201 ((f) هو استثناء من قاعدة مكافحة التجاوز فقط. السؤال عن النسخ يبقى مع الاستخدام العادل.

في الاتحاد الأوروبي، تغطي المادة 5*3 من التوجيه 2009/24/EC الدراسة. يمكن للشخص الذي يحق له استخدام نسخة "الملاحظة أو الدراسة أو اختبار عمل البرنامج من أجل تحديد الأفكار والمبادئ التي تستند إلى أي عنصر من عناصر البرنامج". ينطبق هذا الحق أثناء تحميل البرنامج أو عرضه أو تشغيله أو إرساله أو تخزينه.

المادة 6 تسمح بتفكيكها دون إذن حامل الحقوق عندما يكون "لا غنى عنه للحصول على المعلومات اللازمة لتحقيق قابلية التشغيل لبرنامج كمبيوتر تم إنشاؤه بشكل مستقل". الشروط تتماشى مع 1201 ((f). يقوم صاحب الترخيص بأعمال، ولم تكن المعلومات متاحة بسهولة، والعمل يبقى ضمن الأجزاء اللازمة. المادة 6 ((2) تحظر استخدام النتيجة لأي هدف آخر أو لبرنامج مشابه بشكل كبير في التعبير. المادة 8 تجعل شروط العقد التي تتعارض مع المادة 6 أو المادة 5 ((3) غير صالحة.

| Source | What it allows | Conditions |
|---|---|---|
| 17 U.S.C. 1201(f) | Circumventing an access control to analyze a program | Lawful copy, interoperability purpose, information not readily available, no infringement |
| Directive 2009/24/EC Art. 5(3) | Observing, studying, and testing a running program | A right to use the copy, acts within normal loading and running |
| Directive 2009/24/EC Art. 6 | Decompilation | Licensee, interoperability purpose, information not readily available, confined to the needed parts |
| *Sega v. Accolade* | Disassembly as fair use | The only way to reach the ideas and functional elements, a legitimate reason |
| *Sony v. Connectix* | Intermediate copies during reverse engineering | A non-infringing final product |

هذه الملاحظات تأتي من النظام الأساسي والمراجعات، وهي ليست نصائح قانونية. عندما لا يكون هدف مستقبلي لك، الحصول على إذن كتابي قبل فتح الملف والاحتفاظ بالترخيص مع الأدلة الخاصة بك.

## المشكلة

لقد قمت بتجميعها`ledger.c`و ركضت`llvm-objdump -t`على الكائن. قوائم الخروج `percent_change`في القيمة`0000000000000000`مع حجم`0000000000000010`أي 16 بايت من الملف البايت 1768 هي هذه الوظيفة؟`R_X86_64_PC32 .rodata+0x10`في التكافؤ`0x36`و الأربعة بايت في تلك الملفة هي صفر. ما الذي سوف تصبح، ولماذا هو الإضافة`0x10`عندما تبدأ الطاولة في`0x14`- ماذا ؟

رد على أسئلة التخطيط مع `inspect_binary_layout`، و هذه الأداة موجودة فقط على لينكس x64 مع أدوات pwntools 4.15.0 خلف `REA_PWNTOOLS_PYTHON`على هذا ماك هو غائب.`address_to_file_offset`يحتاج إلى جلسة Ghidra ونسخة كاملة من البايتات الملف الأصلية مع مطابقة SHA-256. `inspect_artifact`يصف ما يحتوي عليه الحاوية حسب المسار والحجم المحتوى. فإنه لا يفتح أبدا الجداول داخل ملف كائن. لذلك يمكنك كتابة القارئ بنفسك في حوالي 950 سطر من بيثون مع `struct.unpack`لا يوجد إعتماد، الاختبارات تقارن كل جدول مع`llvm-objdump`النص الذي تم التقاطه مرة واحدة في الأجهزة

```figure
elf-byte-map
```

## الملف هو الجداول التي تشير إلى الجداول

النظام V gABI، الفصل 4، الشكل 4-1، يرسم نظرين من ملف واحد. يحتوي عرض الرابط على عنوان ELF ، وجداول رأس البرنامج الاختياري ، والقسمات ، وجداول رأس القسم المطلوب. يحتوي منظر التنفيذ على عنوان ELF ، وجداول عنوان البرنامج المطلوبة ، والقطع ، وجداول عنوان القسم الاختياري. يضيف gABI جملة واحدة تحكم القارئ بأكمله: "القائمة ELF فقط لديها موقع ثابت في الملف". كل هيكل آخر يتم العثور عليه من خلال تعويض مخزن في هيكل آخر.

كما أن gABI يصلح أنواع القياس ويقول أن "ELF لا تستخدم حقل البيت". `Elf64_Addr`و`Elf64_Off`هي 8 بايت، `Elf64_Half`هو 2`Elf64_Word`هو 4 و`Elf64_Xword`هو 8. psaBI x86-64، القسم 4. 1. 1، يتطلب `ELFCLASS64`،`ELFDATA2LSB`،`e_machine` `EM_X86_64`(62) ، و`e_flags`0 - الـ "انديان الصغير" ذو عرض ثابت`struct.unpack`مع`<`المُقبل يقرأ كل سجل في مكالمة واحدة

أول 64 بايت من `ledger-x86_64-O1.o`:

```text
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0100 3e00 0100 0000 0000 0000 0000 0000  ..>.............
00000020: 0000 0000 0000 0000 2804 0000 0000 0000  ........(.......
00000030: 0000 0000 4000 0000 0000 4000 0b00 0100  ....@.....@.....
```

اقرأها ضد صفحة "ELF Header"`e_ident`هو 16 بايت `7f 45 4c 46`(السحر) ، الفئة 2 (64 بت) ، البيانات 1 (قليل-endian) ، النسخة 1، نظام التشغيل ABI 0 (النظام V) ، والشباك.

إذن`e_type` `0x0001`هو`ET_REL`، كائن قابل للتنقل`e_machine` `0x003e`هو 62`EM_X86_64`. .`e_entry`هو صفر لأن كائن ليس لديه نقطة دخول. `e_phoff`هو صفر لأن كائن ليس لديه عناوين برنامج. `e_shoff`هو`0x428`، تعديل ملف جدول عنوان القسم. الصف الأخير يحتوي على`e_ehsize` `0x40`،`e_phentsize`0`e_phnum`0`e_shentsize` `0x40`،`e_shnum` `0x0b`(١١ عنوان) ، و`e_shstrndx` `0x0001`. . .

القارئ يحول هذا الصف إلى مكالمة واحدة:

```python
fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
```

سلسلة التنسيق هي رقم gABI القراءة من اليسار إلى اليمين: اثنين من نصف الكلمات، كلمة، ثلاثة قيم 8-byte، كلمة، وستة نصف الكلمات. يرفض القارئ ملف يختلف السحر، أو الفئة، أو ترتيب البايت، ويرفض `e_shentsize`أو`e_phentsize`قيم ليست 64 و 56 عرض خاطئ سوف تجعل كل تعويض لاحقا خاطئا، لذلك الشيك يقع في الأعلى.

## عناوين القسم و جداول حبلين

كل عنوان قسم هو `Elf64_Shdr`من 64 بايت (GABI الشكل 4-8): `sh_name`،`sh_type`،`sh_flags`،`sh_addr`،`sh_offset`،`sh_size`،`sh_link`،`sh_info`،`sh_addralign`و`sh_entsize`. سلسلة التنسيق هي`<IIQQQQIIQQ`. .`sh_name`هو تعويض في القسم الذي يعد مؤشر `e_shstrndx`و ينتهي الاسم عند أول صفر بايت`e_shstrndx`هو 1، وسمي هذا القسم`.strtab`، لذا طاولة واحدة تخدم كل من أسماء القسم والأسماء الرمزية.

القارئ يطبع 11 رأس من -O1 الكائن:

```text
Idx Name             Type         Flags   Offset     Size       Addr Link Info Align
  0                  NULL                    0x0      0x0        0x0    0    0     0
  1 .strtab          STRTAB                0x368     0xbe        0x0    0    0     1
  2 .text            PROGBITS     AX        0x40     0x9f        0x0    0    0    16
  3 .rela.text       RELA         I        0x2a8     0x48        0x0   10    2     8
  4 .rodata          PROGBITS     A         0xe0     0x50        0x0    0    0     8
  5 .rela.rodata     RELA         I        0x2f0     0x78        0x0   10    4     8
  6 .rodata.str1.1   PROGBITS     AMS      0x130      0xa        0x0    0    0     1
  7 .comment         PROGBITS     MS       0x13a     0x2f        0x0    0    0     1
  8 .note.GNU-stack  PROGBITS              0x169      0x0        0x0    0    0     1
  9 .llvm_addrsig    LLVM_ADDRSIG E        0x368      0x0        0x0   10    0     1
 10 .symtab          SYMTAB                0x170    0x138        0x0    1    9     8
```

الفائدة 0 هي الرأس الصفري المخصص. `.text`تحتوي على 159 بايت من الشفرة عند تعويض الملف `0x40`، مباشرة بعد الرأس، مع العلامات`A`(مخصصة في الذاكرة) و`X`(مفعول) `.rodata`تحتوي على 80 بايت من البيانات القراءة فقط. `.rodata.str1.1`يحمل الخمسة سلاسل العلامة`F\0D\0C\0B\0A\0`، 10 بايت، مع العلامات `M`(مدمجة) و `S`(الخطوط)

`.comment`يحمل طابع المُجمّع البييت 47`\0Apple clang version 17.0.0 (clang-1700.6.3.2)\0`. .`.llvm_addrsig`لديه نوع`0x6fff4c03`، داخل النطاق المحدد للنظام التنفيذي `SHT_LOOS`إلى`SHT_HIOS`أن الاحتياطيات gABI، و LLVM `ELF.h`اسمها، علمها`E`هو`SHF_EXCLUDE`، لذا يُسقطه رابط

- نعم`sh_link`و`sh_info`العمود هي المؤشرات بين الجداول. `.rela.text`- نعم`sh_info`2 و `sh_link`10: يصلح القسم 2 و يأخذ رموزه من القسم 10. `.symtab`- نعم`sh_link`1، جدول السلاسل لأسماء الرمز، و `sh_info`9، مؤشر الرمز الأول غير المحلي. `sh_addr`هو صفر في كل سطر لأن كائن ليس لديه عناوين بعد.

قواعد gABI اثنتان تسمح للقارئ رسم خريطة كاملة للملف. القسمات "مواصلة ولا تتداخل" ، ويمكن للملف "حتي تحتوي على مساحة غير نشطة". يقوم القارئ بتنظيم كل هيكل حسب التداخل ويملأ الثقوب:

```text
     0x0 +64    header   ELF header
    0x40 +159   section  .text
    0xdf +1     gap      inactive space
    0xe0 +80    section  .rodata
   0x130 +10    section  .rodata.str1.1
   0x13a +47    section  .comment
   0x169 +7     gap      inactive space
   0x170 +312   section  .symtab
   0x2a8 +72    section  .rela.text
   0x2f0 +120   section  .rela.rodata
   0x368 +190   section  .strtab
   0x426 +2     gap      inactive space
   0x428 +704   table    section header table
```

الفجوات الثلاثة تصل إلى 10 بايت، وكل واحد هو التوجه. `.rodata`- نعم`sh_addralign`8، لذلك يبدأ في `0xe0`بدلاً من`0xdf`. .`.symtab`لديه التوجه 8 ، لذلك سبعة بايت لا تستخدم بعد `.comment`طاولة الرأس الخاصة بالقطعة نفسها مرتبطة بـ 8.

قسم النوع `SHT_NOBITS`لا تشغل أي بايتات ملف على الإطلاق، لذلك تخطي الخريطة لهم. لا شيء في هذا الكائن له هذا النوع.`.bss`في برنامج متصل يفعل، والقارئ الذي يثق `sh_size`هناك يقرأ ما بعد الملف.

## الرموز: الالتزام، النوع، القسم، القيمة، الحجم

- نعم`Elf64_Sym`هو 24 بايت (GABI الرسم 4-18): `st_name`،`st_info`،`st_other`،`st_shndx`،`st_value`،`st_size`، صيغة`<IBBHQQ`. .`st_info`يحتوي على حقلين: الارتباط في الأربعة البيتات العليا والنوع في الأربعة السفلية.`STB_LOCAL`0`STB_GLOBAL`1، `STB_WEAK`2، والأنواع`STT_NOTYPE`0`STT_OBJECT`1، `STT_FUNC`2، `STT_SECTION`3، `STT_FILE`4، القطع الـ2 المنخفضة`st_other`الحفاظ على المرئية`STV_DEFAULT`0 هنا في جميع أنحاء.

```text
Idx            Value   Size Bind   Type    Section          Name
  0              0x0      0 LOCAL  NOTYPE  *UND*
  1              0x0      0 LOCAL  FILE    *ABS*            ledger.c
  2              0x0     20 LOCAL  OBJECT  .rodata          labels.rel
  3              0x0      0 LOCAL  SECTION .rodata          .rodata
  4              0x2      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.1
  5              0x4      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.2
  6              0x6      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.3
  7              0x8      2 LOCAL  OBJECT  .rodata.str1.1   .L.str.4
  8              0x0      0 LOCAL  SECTION .rodata.str1.1   .rodata.str1.1
  9              0x0     16 GLOBAL FUNC    .text            percent_change
 10             0x10     46 GLOBAL FUNC    .text            grade
 11             0x40     31 GLOBAL FUNC    .text            total
 12             0x60     63 GLOBAL FUNC    .text            grade_label
```

المؤشر 0 هو الرمز غير المحدد المحفوظ. `st_shndx`يطلق على القسم الذي يحدد الرمز، مع ثلاثة قيم محجوزة: `SHN_UNDEF`0`SHN_ABS` `0xfff1`لسم الملف، و `SHN_COMMON` `0xfff2`رموز القسم لها اسم فارغ، لذلك`llvm-objdump`يطبخ اسم القسم الخاص بهم ، والقارئ يفعل الشيء نفسه. قاعدة gABI التي تقول "كل الرموز مع ربط STB_LOCAL يسبق الرموز الضعيفة والعالمية" تظهر كالتسعة الأولى من الصفوف ، و `.symtab`تسجل 9 في `sh_info`لهذا السبب

في جسم قابل للتنقل`st_value`هو تعويض داخل قسم الرمز، لأن `sh_addr`هو صفر. تعويض الملف من وظيفة هو`sh_offset + st_value - sh_addr`، وطولها هو`st_size`:

```python
section = elf.sections[symbol.st_shndx]
file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
code = elf.data[file_offset : file_offset + symbol.st_size]
```

لأجل`percent_change`هذا هو`0x40 + 0`، وال16 بايت هي`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`الحجم مهم بقدر ما هو البداية`grade`ينتهي في`.text`التكفيف`0x3e`. البايتين`66 90`التي تتبعها هي `nop`المُجمّع أضاف حتى `total`يبدأ في`0x40`هذه البايتين لا تنتمي إلى أي رمز`st_size`و الدروس 36 تُخفي هذه الأشياء قبل أن تقارن إعادة البناء.

## عمليات نقل: ما تعنيه الصفر

- نعم`Elf64_Rela`هو 24 بايت (GABI الرسم 4-23): `r_offset`،`r_info`ووقعت`r_addend`، صيغة`<QQq`. غابي ينقسم`r_info`مع ماكروين: `ELF64_R_SYM(i)`هو`i >> 32`و`ELF64_R_TYPE(i)`هو`i & 0xffffffff`في ملف قابل للتنقل`r_offset`هو تعويض داخل القسم المسمى من قبل الجدول `sh_info`. أسماء النوع والصيغ تأتي من x86-64 psABI، الجدول 4.9. هناك `S`هو قيمة الرمز`A`الإضافة`P`المكان الذي يتم تصحيحه، و`L`إدخال PLT. `R_X86_64_64`هو`S + A`،`R_X86_64_PC32`هو`S + A - P`و`R_X86_64_PLT32`هو`L + A - P`. . .

الكائن -O1 لديه ثمانية سجلات:

```text
  .rela.text       0x36 R_X86_64_PC32          .rodata+0x10
  .rela.text       0x84 R_X86_64_PC32          .rodata+0x24
  .rela.text       0x93 R_X86_64_PC32          .rodata-0x4
  .rela.rodata      0x0 R_X86_64_PC32          .rodata.str1.1
  .rela.rodata      0x4 R_X86_64_PC32          .L.str.1+0x4
  .rela.rodata      0x8 R_X86_64_PC32          .L.str.2+0x8
  .rela.rodata      0xc R_X86_64_PC32          .L.str.3+0xc
  .rela.rodata     0x10 R_X86_64_PC32          .L.str.4+0x10
```

إزالة أول واحد.`0x36`يقع بداخله`grade`، والتي تمتد`0x10`إلى`0x3e`. التعليمات في`0x33`هو`48 8d 0d 00 00 00 00`، أ`lea`من عنوان RIP-سريع، وتحركها أربعة بايتات يقع في `0x36`. المعالج يضيف التحول إلى عنوان التعليمات التالية`0x3a`. . .

المُجمّع يريد النتيجة أن تكون`.rodata + 0x14`، حيث جدول خمس مدخلات من قيم 32 بت `1, 2, 3, 4, 4`يبدأ. لذا يجب أن تكون القيمة المخزنة`(.rodata + 0x14) - 0x3a`. الصيغة`S + A - P`مع`P = 0x36`يعطي`.rodata + A - 0x36`. تحديد العطيات المتساوية`A = 0x14 - 4 = 0x10`. الإضافة تحمل تعويض الهدف ناقص أربعة بايت بين التنقل و نهاية التعليمات.

هذا الجدول هو كيف قام Clang بتجميع `switch`في`grade`في -O1، الرمز يحسب`score / 10`مع مضاعفة ب `0x66666667`و 2 تحولات، خصم 6، مقارنة مع 4، وتصفية الجدول. لا يوجد رمز للجدول. المرجع هو رمز القسم `.rodata`بالإضافة إلى إضافة، و فقط البناء الأذرع64 من نفس المصدر يسميها `l_switch.table.grade`. السجل الثاني ، في`0x84`في`grade_label`، نقاط في الجدول الثاني من قيم 8 بايت في `.rodata + 0x28`الثالثة، في`0x93`، تشير إلى`.rodata + 0x0`، بداية`labels.rel`. . .

الخمسة`.rela.rodata`سجلات ملء`labels.rel`كل مدخل يجلس في التسويق`4i`ويحصل على الإضافة`4i`، لذا`S + A - P`يقلل إلى عنوان السلسلة ناقص قاعدة الجدول. `grade_label`يقرأ إدخال مع `movslq`، يضيف قاعدة الجدول مرة أخرى، ويكون له المؤشر. السجل الأول يسمى رمز القسم`.rodata.str1.1`مع إضافة 0 لأن السلسلة `F`هو أول بايت في هذا القسم.`.L.str.1`إلى`.L.str.4`، علامات المحليّة للمُجمّع`D`،`C`،`B`و`A`. . .

يجمع المصدر نفسه إلى ثلاث جداول مختلفة في ثلاثة مستويات تحسين. يظهر القارئ الفرق دون إزالة:

| Build | Where `labels` lives | How `grade` selects | How `grade_label` reaches `grade` |
|---|---|---|---|
| -O0 | `.data`, five 8-byte pointers, five `R_X86_64_64` records | A jump table in `.rodata`: five `R_X86_64_PC32` records pointing into `.text` | A call with `R_X86_64_PLT32 grade-0x4` |
| -O1 | `.rodata` as `labels.rel`, five 32-bit relative entries | A value table at `.rodata+0x14`, one `R_X86_64_PC32` | Inlined, no call |
| -O2 | Same as -O1 | Same as -O1 | Inlined, `total` grows to 140 bytes |

في -0`switch`هو طاولة قفزة حقيقية التي تُؤشر خمس إدخالات إلى`.text`في`+0x91`،`+0x8c`،`+0x87`،`+0x82`و`+0x86`- المكالمة إلى`grade`يحمل نفس الشيء`-0x4`الإضافة لأي سبب`lea`عند -O1 رأى المحسن أن كل حالة تعود ثابتة واستبدل القفزات بطاولة النتائج.

## عناوين البرنامج: وجهة نظر المُحمل

كائن قابل للتنقل ليس لديه عناوين برنامج، لذا `e_phnum`هو 0، ويتم تنفيذها في كائن أو كائن مشترك، ولا يقرأ المحمول أي شيء آخر.`Elf64_Phdr`هو 56 بايت (GABI الشكل 5-1): `p_type`،`p_flags`،`p_offset`،`p_vaddr`،`p_paddr`،`p_filesz`،`p_memsz`،`p_align`، صيغة`<IIQQQQQQ`- الـ (جابي) يضع ثلاثة قواعد`PT_LOAD`إدخالات، تظهر في الصعود`p_vaddr`النظام، و `p_memsz`أكبر من `p_filesz`يعني صفر ملء.`p_vaddr`هو متطابق مع `p_offset`المودول`p_align`. . .

كل هدف في هذا المسار هو برنامج قمت بإنشائه، ولا يوجد رابط على هذا ماك ينتج إدارة لينكس من`ledger.o`إذاً ، المُثبت`tiny-x86_64`يأتي من`code/fixtures/build_tiny_elf.py`، الذي يكتب 736 بايت مع `struct.pack`الملف يحتوي على رأس ELF، رأس برنامجين، 36 بايت`_start`، 3 بايت `.rodata`، جدول رمزي، وستة عناوين قسم.`_start`يكتب`ok\n`في لينكس x86-64 يعمل. هنا هو إصلاح لسهولة عنوان البرنامج.

```text
Program headers:
  PT_LOAD          r-x offset=0x0 vaddr=0x400000 filesz=0x2e0 memsz=0x2e0 align=0x1000
  PT_GNU_STACK     rw- offset=0x0 vaddr=0x0 filesz=0x0 memsz=0x0 align=0x10

entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

الـ"فردي"`PT_LOAD`يقوم بتخريط الملف بأكمله بـ 736 بايت في `0x400000`القارئ يقوم بتخريط عنوان إلى ملف تعويض عن طريق العثور على `PT_LOAD`الذي يحتوي عليه والحوسبة`p_offset + (address - p_vaddr)`. لـ نقطة الدخول التي هي`0 + (0x4000b0 - 0x400000) = 0xb0`، بداية`.text`. . .

هذا هو الحساب وراء ريا`address_to_file_offset`بالنسبة لاهداف غيدرة، هذه الأداة تعود`{address, file_offset}`. مقدم " هوبر " أيضاً يعود`provider_file_offset`و`image_base_file_offset`. تحتاج الأداة إلى نسخة أصلية كاملة من الملف، و يجب أن يطابق SHA-256 من تلك النسخة الهدف.`inspect_binary_layout`يضيف سطر للحفاظ عليه: "ال عنوان المرتبط ليس عنوان وقت التشغيل". تحميل قابلة للتنفيذ مستقلة عن الموقع في قاعدة تختارها النجم، وتكون تعويض الملف هو الإحدى الإحداثيات المستقرة.

تعبر عناوين البرنامج أيضًا عن سبب استمرار تشغيل جهاز تنفيذية تم تجنبه. يمكن لشركة ربط إزالة جدول عناوين القسم بالكامل ، و `e_shoff`يصبح الصفر أداة التي تمشي في أقسام ثم لا ترى شيئا.

## نفس الأفكار في ماخ-او

لا تنشر شركة آبل مواصفات بروتوكولية لمش-او. العناوين في مصدر XNU هي المواصفات: `EXTERNAL_HEADERS/mach-o/loader.h`،`nlist.h`و`reloc.h`- الجهاز`ledger-arm64-O1.o`هو نفس الشيء`ledger.c`بنيت مع`clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c`. . .

أ`mach_header_64`هو 32 بايت: `magic`،`cputype`،`cpusubtype`،`filetype`،`ncmds`،`sizeofcmds`،`flags`،`reserved`السحر هو`0xfeedfacf`،`MH_MAGIC_64`. .`cputype`هو`0x0100000c`،`CPU_TYPE_ARM64`. .`filetype`هو 1`MH_OBJECT`. .`ncmds`هو 5 و `sizeofcmds`هو 616: أوامر الحمل تشغل 616 بايت بعد الرأس، وكل واحد يبدأ مع `{cmd, cmdsize}`. العلم`0x2000`هو`MH_SUBSECTIONS_VIA_SYMBOLS`. . .

```text
Load commands:
  0 LC_SEGMENT_64                cmdsize=472 at 0x20
  1 LC_BUILD_VERSION             cmdsize=24 at 0x1f8
  2 LC_LINKER_OPTIMIZATION_HINT  cmdsize=16 at 0x210
  3 LC_SYMTAB                    cmdsize=24 at 0x220
  4 LC_DYSYMTAB                  cmdsize=80 at 0x238
```

`LC_SEGMENT_64`(0x19) هو إجابة ماخ-او لكل من الجداول ELF.`segment_command_64`- نعم`segname`،`vmaddr`،`vmsize`،`fileoff`،`filesize`،`maxprot`،`initprot`،`nsects`و`flags`- إذن`nsects`سجلات النوع `section_64`80 بايت لكل واحد، اتبعوا نفس الأوامر.`loader.h`تعليق على`MH_OBJECT`يقول القسمات تعيش "في قطاع واحد غير مسمى دون ملابس قطاع".`fileoff`648`filesize`456، و 5 أقسام

```text
  Idx Section                    Addr   Size Offset Reloff Nreloc Type
    1 __TEXT,__text               0x0   0xd0    648   1104      6 S_REGULAR
    2 __DATA,__const             0xd0   0x28    856   1152      5 S_REGULAR
    3 __TEXT,__cstring           0xf8    0xa    896      0      0 S_CSTRING_LITERALS
    4 __TEXT,__const            0x108   0x40    912      0      0 S_REGULAR
    5 __LD,__compact_unwind     0x148   0x80    976   1192      4 S_REGULAR
```

كل قسم يسمي قطاعه الأم في `segname`، لذا فجزأين يدعى`__const`يختلفون لأن واحد هو`__DATA,__const`والآخر`__TEXT,__const`. عمليات الإنتقال هي لكل قسم من خلال`reloff`و`nreloc`، حيث ELF لديها منفصلة`.rela.X`قسم لكل هدف

كل واحد`relocation_info`هو 8 بايت.`r_address`يأتي أولاً. حقل 32 بت يتبع، معبأة مثل `r_symbolnum`(24 بت)`r_pcrel`(1) `r_length`(2) ، `r_extern`(1) و `r_type`(4) الستة `__text`السجلات هي ثلاثة أزواج من`ARM64_RELOC_PAGE21`و`ARM64_RELOC_PAGEOFF12`، زوج واحد لكل جدول مرجعية.`adrp`بالإضافة`add`هل ما واحد x86-64 `lea`لا، لذلك كل مرجع يحتاج إلى سجلين.`__DATA,__const`السجلات هي`ARM64_RELOC_UNSIGNED`مع`r_length`3، لذلك كل واحد يصلح 8 بايت المؤشر المطلق.

عند -O1 تم الحفاظ على قاعدة الـ 64`labels`كمرشحات بسيطة حيث بناء x86-64 صنع جدول نسبي.

`LC_SYMTAB`0x2) يحتفظ`symoff`1240، `nsyms`17`stroff`1512،`strsize`176 و 1512 + 176 = 1688، حجم الملف`nlist_64`هو 16 بايت: `n_strx`،`n_type`،`n_sect`،`n_desc`،`n_value`. .`n_type`هو قليلا من الحقل.`N_TYPE`(قناع)`0x0e`) = `N_SECT`(`0xe`) تعني المحدد في القسم الذي يعد رقم 1`n_sect`. .`N_EXT`(`0x01`) يمثل رمز خارجي.

`nlist_64`ليس لديه حقل حجم. للحصول على 24 بايت من`_percent_change`القارئ يأخذ العنوان التالي للرمز في نفس القسم`_grade`في`0x18`الرموز C تحمل علامة قيادية`_`هنا، لذلك الوظيفة هي `_percent_change`. . .

`LC_DYSYMTAB`(0xb) يسجل نفس القاعدة المحلية أولاً مثل ELF `sh_info`: `ilocalsym`0`nlocalsym`13، `iextdefsym`13، `nextdefsym`4`LC_BUILD_VERSION`0x32) سجلات `platform`1 (macOS) ، `minos`26.0 و `sdk`26.2 كما هو مغلف`XXXX.YY.ZZ`هذه هي السبب في أن جهاز arm64 يتم تعيينها كبايت. إنشاء على جهاز Mac مع SDK آخر ينتج ملفًا مختلفًا.

القارئ`compare_formats`يضع الملفين جانباً إلى جانبه:

| Idea | ELF, `ledger-x86_64-O1.o` | Mach-O, `ledger-arm64-O1.o` |
|---|---|---|
| File identity | `e_ident` `7f 45 4c 46`, class 64, data LSB | `magic` `0xfeedfacf` |
| Machine | `e_machine` 62, `EM_X86_64` | `cputype` `0x100000c`, `CPU_TYPE_ARM64` |
| File kind | `e_type` 1, `ET_REL` | `filetype` 1, `MH_OBJECT` |
| Where the tables are | `e_shoff` `0x428`, 11 section headers | 5 load commands, 616 bytes after the header |
| The code | `.text` at `0x40`, size `0x9f`, flags `AX` | `__TEXT,__text` at 648, size `0xd0`, in the unnamed segment |
| Symbol names | `.symtab` (section 10), names in `.strtab` through `sh_link` 1 | `LC_SYMTAB` `symoff` 1240, `nsyms` 17, names at `stroff` 1512 |
| Symbol size | `st_size`: `percent_change` is 16 bytes | No field: next symbol minus this one, 24 bytes |
| Relocations | `.rela.text`, 3 records, `R_X86_64_PC32` | `__text` `reloff` 1104, 6 records, `PAGE21` and `PAGEOFF12` |
| Function bytes | `percent_change`: 16 bytes at `0x40` | `_percent_change`: 24 bytes at `0x288` |

" ريا " تقرأ " ماخ " او "`inspect_macho`، الذي يدير`otool -h -l`،`nm -gjU`،`dyld_info -imports -exports`و`dwarfdump --uuid`من خلال`xcrun`قرائك لا يحتاجوا إليها، ويقرأ نفسها`symoff`و`stroff`هذا`otool -l`بصمات`open_binary`أداة ريا يكتشف ELF، MZ، PE، والقليل أو عالمية Mach-O من البايت السحرية.`e_machine`هذا هو أول 20 بايت من ما بنيت هنا.`format: raw-binary`المزود في Ghidra يرفض ثنائي عالمي و يطلب قطعة نحيفة. قارئك يفعل الشيء نفسه عندما يرى`0xcafebabe`. . .

## بناءها

تشغيل قراءة المكتبة القياسية:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
```

الظهور يقرأ`ledger-x86_64-O1.o`ويقوم بطبع العنوان، والأقسام، والرموز، والتحويلات، وخريطة تعويض الملف. ثم يقوم بطبع السلاسل الأربعة`ledger-arm64-O1.o`ويقوم بطبع جدول المقارنة. ينتهي به عنوان البرنامج من`tiny-x86_64`- الخطوط المتوقعة:

```text
percent_change: 16 bytes at file offset 0x40: 85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3
grade: 46 bytes at file offset 0x50: 48 63 c7 48 69 c0 67 66 66 66 ...
entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

مرر مسار لقراءة ملف واحد: `python3 code/main.py code/fixtures/ledger-x86_64-O0.o`القارئ يختار ELF أو Mach-O من أول أربعة بايت

اقرأ`code/main.py`في هذا الترتيب:

1. `ElfFile._read_header()`يُحقق من السحر، والفئة، ترتيب البايت، وحجم الإدخال، ثم يفتح الرأس.
2. `ElfFile._read_sections()`و`read_cstring()`اقرأ جدول عناوين القسم وافصل الاسماء من خلال `e_shstrndx`. . .
3. `ElfFile._read_symbols()`الانقسام`st_info`، يُحلّ أسماء من خلال `sh_link`ويحافظ على إدراجات القسم المحجوز قابلة للقراءة.
4. `ElfFile._read_relocations()`يَمْشي كلّ `SHT_RELA`القسم، التقسيم`r_info`، و أنواع الأسماء من الجدول 4.9.
5. `ElfFile.function_span()`و`function_bytes()`تحويل رمز إلى مجموعة ملفات والبايتات في ذلك.
6. `ElfFile.file_offset_map()`يُصنف كل هيكل حسب التعويض ويملأ الفضاء غير النشط
7. `ElfFile._read_program_headers()`و`address_to_file_offset()`معالجة المعدات التنفيذية
8. `MachOFile`يقرأ الرأس، ويقوم بإرسال الأوامر،`LC_SEGMENT_64`مع أقسامها`LC_SYMTAB`،`LC_BUILD_VERSION`، و إعادة التنقل في كل قطعة
9. `compare_formats()`اسم نفس الفكرة في كلتا الملفين مع القيم القراءة من كل واحد.

## استخدمها

استيراد القارئ من الدروس اللاحقة مع `from main import ElfFile`بعد إضافة هذه الدروس`code`دليل `sys.path`الدروس 33 تطلب ذلك`function_bytes`و`relocations_for(".text")`. الدروس 35 تسجل انتاجها كدليل مراقب. الدروس 36 تطلب من ذلك للتعويضات الإنتقالية لتخفيض قبل مقارنة البايت.

قم بتجميع C الخاص بك إلى كائن مع نفس `clang -target x86_64-unknown-linux-gnu -c`إضافة اسم التنظيم فقط عندما يردها الجدول x86-64 psABI جدول 4.9 إضافة نوع قسم فقط عندما يثبتها gABI أو سلسلة الأدوات الإنتاجية عندما يلتقي القارئ بقيمة لا يوجد لها اسم لها، فإنه يطبخ الرقم في السبع عشرية بدلا من التخمين.

## المختبر التفاعلي

### المختبر (أ): الرأس يدوياً

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code
python3 -q
```

أركض

```python
import struct
from main import ElfFile, FIXTURES
data = (FIXTURES / "ledger-x86_64-O1.o").read_bytes()
data[:4], data[4], data[5]
struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
elf = ElfFile(data)
elf.header.e_shoff, elf.header.e_shnum, elf.sections[elf.header.e_shstrndx].name
```

تُظهر الـ " توبل "`e_type`1، `e_machine`62، و `e_shoff`1064, الذي هو `0x428`السطر الأخير يظهر أن القسم 1`.strtab`، يحمل أسماء القسم

### المختبر ب: جدول القيم وراء المفتاح

```python
rodata = elf.section_bytes(elf.section(".rodata"))
[int.from_bytes(rodata[i : i + 4], "little") for i in range(0x14, 0x28, 4)]
[int.from_bytes(rodata[i : i + 8], "little") for i in range(0x28, 0x50, 8)]
[r for r in elf.relocations_for(".text") if r.symbol == ".rodata"]
```

كل من الجداول قراءة`1, 2, 3, 4, 4`تحقق منهم ضد`ledger.c`: `grade(65)`الحسابات`65 / 10 - 6 = 0`ويقرأ المدخل 0 ، وهو 1 ، قيمة `case 6`. .`grade(100)`يقرأ المدخل 4 ، وهو 4 ، القيمة المشتركة من `case 10`و`case 9`. . .

### المختبر "ج": ثلاثة بناءات من مصدر واحد

```python
for level in ("O0", "O1", "O2"):
    obj = ElfFile.from_path(FIXTURES / f"ledger-x86_64-{level}.o")
    print(level, [s.name for s in obj.sections if s.name in (".data", ".rodata")])
    print(level, sorted({r.type_name for r in obj.relocations}))
    print(level, {s.name: s.st_size for s in obj.symbols if s.type == "FUNC"})
```

كائن -0 لديه `.data`القسم و ثلاثة أنواع نقل.`.data`و نوع واحد`total`هو 66 بايت في -O0، 31 في -O1، و 140 في -O2.

### المختبر D: نفس الوظيفة في ماخ-او

```python
from main import MachOFile
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
[(c.name, c.cmdsize) for c in macho.load_commands]
macho.function_span("_percent_change")
macho.function_bytes("_percent_change")[:4].hex()
```

فترة الاختلاف هي 24 بايت في ملف تعويض 648. أول أربعة بايت هي `a0000034`، شكل التدريس الصغير`0x340000a0`، الذي`llvm-objdump -d`بصمات مثل`cbz w0, 0x14`هذا هو`before == 0`الحارس، نفس الاختبار الذي يرمز بناء x86-64`85 ff 74 09`. . .

## مختبر التدريب

تمديد القارئ إلى برنامج متصل. على آلة لينكس x86-64، بناء `clang -O1 -shared -fPIC code/fixtures/ledger.c -o libledger.so`و`clang -O1 code/fixtures/ledger.c -o ledger_main`مع`main`تضيف، ثم تشغيل القارئ على كليهما.

المتطلبات:

- اقرأ`.dynsym`مع نفسها`Elf64_Sym`التخطيط، منذ `SHT_DYNSYM`هو 11 والسجل غير متغير.
- اقرأ`.dynamic`كـ`Elf64_Dyn`سجلات `d_tag`و`d_val`، والاسم`DT_NEEDED`،`DT_STRTAB`،`DT_SYMTAB`،`DT_RELA`و`DT_JMPREL`من صفحة gABI "قسم الديناميكي".
- قم بإدراج الرموز غير المحددة`st_shndx` `SHN_UNDEF`مثل الواردات، والـ`R_X86_64_JUMP_SLOT`السجلات في`.rela.plt`كمواقع المكالمات التي تصل إليهم
- خريطة كل`PT_LOAD`القسم إلى القسمات التي تحتوي عليها، باستخدام قاعدة gABI أن "قسم ملف كائن يحتوي على قسم واحد أو أكثر".
- إثبت ذلك`address_to_file_offset`أن بايت كل وظيفة محددة في الكائن المشترك هي بايت `function_bytes`يعود
- القبض`llvm-objdump -h -t -r -p`و`llvm-objdump -T`النص لكلتا الملفين في `code/fixtures/`ويقارن القارئ معهم في الاختبارات

النجاح يعني أن قائمة الاستيراد وخريطة القطاع، وكل مجموعة من الوظائف تتفق مع إصدار الأداة المسجلة، دون تشغيل الأداة خلال الاختبارات.

## المختبر المعدل

خمس أسئلة حول أجهزة هذا الدروس. ابحث عن كل إجابة مع الرمز الذي بنيته، ثم اكتبها في`code/lab_answers.json`. اكتب الأرقام بأرقام أو بأسلسلسلة شماسية مثل`"0x40"`، والقوائم كقوائم JSON.

1. `t1`: e_shoff من دفتر التسجيل-x86_64-O1.o، كرقم.
2. `t2`: st_size of percent_change في دفتر التسجيل-x86_64-O1.o.
3. `t3`: تعديل ملف .text في دفتر الدراسة-x86_64-O1.o، كهيكس.
4. `t4`: أسماء نوع الترحيل في دفتر التسجيل-x86_64-O0.o، مرتبة، كقائمة.
5. `t5`: قيم الـ 5 int عند .rodata+0x14 في دفتر التسجيل-x86_64-O1.o، كقائمة.

تحقق من إجاباتك:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/lab.py
npx tsx code/lab.ts
```

يقوم المحقق بحساب كل قيمة متوقعة من `code/main.py`على الأجهزة المشتركة.`PASS`،`FAIL`أو`TODO`لكل مهمة و نسبة، و يخرج من 0 فقط عندما يمر الخمسة`python3 code/lab.py my-answers.json`يبحث عن ملف آخر`code/tests/test_lab.py`يثبت أن المحقق يقبل الإجابات الصحيحة ويرفض الإجابات الخاطئة.

### أشاهدها تسير

- نعم[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)الآلة تشغيل هذا الدروس كأول محطتين. القرص القرصية من الملف الكائن الذي يحمل `percent_change`، وفتح الخزانة`.text`ويقرأ الرمز. قم بتبديل الرموز لمعرفة الحقائق التي تحملها جدول الرموز.

## درساً أساسياً

هذا الدرس يُنتج`outputs/skill-program-anatomy-elf-from-scratch.md`. استخدمها مع كلود، كورسور، كودكس، OpenClaw، هرمز، أو أي وكيل يقرأ SKILL.md. تحويل المهارة إلى كائن مرتب أو قابل للتنفيذ الذي قام المستخدم ببناءه في تقرير التخطيط. يعطي التقرير مجموعة الملفات لكل هيكل، رمز، وإعادة التنظيم، مع التحقق من أداة المخرجة المسجلة.

## تحقق من ذلك

إشغال التجربة والسلسلة التحديدية:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

الفندق يثبت:

- كل إندكس قسم، الاسم، الحجم، العنوان، والنوع يطابق المقبض عليه`llvm-objdump -h`نص لثلاثة كائنات x86-64 و التنفيذية الصغيرة
- كل قيمة رمزية، والربط، والنوع، والقسم، والحجم، والاسم يطابقون ما تم التقاطه `llvm-objdump -t`النص
- كل تعويض نقل، اسم النموذج، الرمز، والإضافة يطابق ما تم التقاطه`llvm-objdump -r`النص، بما في ذلك `R_X86_64_PLT32`و`R_X86_64_64`في -0
- كل من رؤساء البرنامج`tiny-x86_64`يطابقون المعتقلين`llvm-objdump -p`النص، والكائنات لا تملك أي
- `percent_change`هو 16 بايت في تعويض الملف `0x40`مع البايتات المتوقعة، وكل وظيفة تقع داخل `.text`
- خريطة تعويض الملف تغطي كل بايت من كل جهاز مرة واحدة ، مع ثلاثة فجوات التوجه من -O1 الكائن في مواقعها
- نقطة دخول `tiny-x86_64`خرائط لتعويض الملف `0xb0`من خلال`PT_LOAD`، و كائن قابل للتنقل يرفض رسم الخرائط
- الرأس "ماك او" كل أمر تحميل، القطاع، الخمسة أقسام`LC_SYMTAB`و`LC_BUILD_VERSION`يطابقون المعتقلين`--private-headers`النص
- الرموز " ماخ " و 15 إعادة التنقل تتطابق مع المقبوضين`llvm-objdump`النص، و`_percent_change`هو 24 بايت عند 648
- السحر الخطأ، فئة 32 بت، ملف الكبير منديان، جدول قصير، ثنائي عالمي، وملف مصدر C كل رفع.`FormatError`
- `build_tiny_elf.py`يعيد إعادة التعبير عن الالتزام`tiny-x86_64`بايت مقابل بايت
- الوحدة الرقمية `site/figures-re-32.js`يحمل البايتات الدقيقة من `ledger-x86_64-O1.o`

## أساليب فشل الإنتاج

| Failure | What the weak reading reports | What the reader must prove |
|---|---|---|
| `st_value` used as a file offset | "`percent_change` is at 0" | Offset is `sh_offset + st_value - sh_addr`, here `0x40` |
| Padding counted as code | "`grade` is 48 bytes" | `st_size` is 46 and the `66 90` after it belongs to no symbol |
| Section names read from the wrong table | Garbage names or an exception | `e_shstrndx` names the table, here section 1 |
| `sh_size` trusted for `SHT_NOBITS` | A read past the end of the file | `.bss` has no file bytes and the map skips it |
| Zero bytes read as the operand | "`lea 0(%rip)`" | The `.rela.text` record at `0x36` names `.rodata+0x10` |
| Addend read as the target offset | "the table starts at `0x10`" | `S + A - P` with the instruction end gives `0x14` |
| Sections walked on a stripped executable | "the file has no code" | `PT_LOAD` maps every address the loader uses |
| A linked address treated as a runtime address | A wrong offset under a random base | The file offset from `PT_LOAD` is the stable coordinate |
| A Mach-O section looked up by `sectname` alone | Two `__const` sections collapse into one | `segname,sectname` is the name |
| A size field expected in `nlist_64` | An exception or zero bytes | The next symbol in the same section ends the function |
| A universal binary read as one Mach-O | "magic `0xcafebabe` is unknown" | Refuse it and ask for a thinned slice |
| The arm64 object rebuilt on another Mac | "the fixture changed" | `LC_BUILD_VERSION` records the SDK, so the committed bytes are the fixture |

## قاعدة العمليات

اقرأ الرأس الذي يمكنك الوثوق به، اتبع تعويضاتها، وسمي كل حقل من المواصفات التي تحددها. احتفظ بمخرج الأداة التي مقارنتها بها كصيغة ملتزمة، بحيث يتم تشغيل المقارنة دون الأداة. عندما لا يكون لدى قيمة اسم في المواصفات، طبع الرقم. القارئ الذي يمكنك التحقق منه بايت بوايت هو الذي تقوم كل درس لاحقا على بناء عليه.

## المزيد من القراءة

- [System V gABI, chapter 4: Object Files](https://www.sco.com/developers/gabi/latest/ch4.intro.html)و [ELF Header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html)،[Sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html)،[Symbol Table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html)و[Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)الصفحات
- [System V gABI, chapter 5: Program Header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html)و[Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V ABI, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)الجدول 4.9 أنواع الإنتقال
- [Apple XNU `loader.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)،[`nlist.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)و[`reloc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/reloc.h)
- [17 U.S.C. 1201](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section1201&num=0&edition=prelim)و[Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng)
- [Sega v. Accolade, 977 F.2d 1510](https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html)و[Sony v. Connectix, 203 F.3d 596](https://law.resource.org/pub/us/case/reporter/F3/203/203.F3d.596.99-15852.html)
- [rea 6.5.0 `docs/binary-diagnostics.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/binary-diagnostics.md)و[`docs/ghidra-provider.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
