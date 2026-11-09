# المشهد الهندسي العكسي: التاريخ، أدوات الأسر، وكيفية بناء جهاز إزالة

> خمس أدوات تقرأ نفس الكائن وتعطى أربعة عناوين، ثلاثة حسابات كتلة، و اثنين من الإجابات لمفتاح واحد، وهذا الدروس يبني الخيط الذي يظهر أي هو أي.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, Java (one Ghidra script)
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~150 minutes

## أهداف التعلم

- ضع أدوات الميدان الرئيسية على جدول زمني يُؤرخ من عام 1973 إلى عام 2026 واطلق اسم العائلة التي تنتمي إليها كل واحدة.
- أسمائ الدورات الثمانية لتحليل الملفات والمعنى الذي يستخدمه غيدرا، النينجا الثنائية، الأشعة السبعية، الرادار2، الريزين، و Angr لكل مرحلة.
- ارفع تعليمات واحدة إلى ESIL و RzIL و P- code و VEX و اشرح من بينها يكتب العلامات بحماس و الذي يحفظ قطعة.
- خفض عناوين خمسة أدوات إلى واحد `.text`تعويض وتثبت الحد من وظيفة واحدة.
- قم ببناء خط مقارنة يقرأ نتائج الأداة المكتسبة ويعلن الاتفاق على بدء التعليمات والكتلة والحواف والعمل.
- اسم، من الأدلة المسجلة، حيث كل أداة يختلق الرمز، يفتقد الرمز، أو يتوقف عند قفزة غير مباشرة.

## المشكلة

تطلب من العميل أن يجمع ما تقول عنه ثلاثة أدوات هندسة عكسية`grade`في`ledger-x86_64-O1.o`. العميل يدير كل أداة، يقرأ ثلاثة قائمة، ويقول أن الوظيفة تقع في `0x08000050`في أداة واحدة`0x400010`في آخر، و`0x100010`في الثالثة، يخلص إلى أن الأدوات تختلف حول مكان الوظيفة.

الأدوات توافق. يمكن نقل الكائن و ليس لديه عنوان تحميل، لذلك كل أداة تختار واحدة. خصم العنوان الذي أعطاه كل أداة `.text`وكل إجابة هي`0x10`لقد قارن العميل العناوين الخامة لأن لا شيء يخبرها ما يعنيه العنوان في كل أداة

لاحقاً نفس العميل يقرأ`grade`في`-O0`بناء وتقديم تقارير عن 3، 8، 8، و 9 كتلة أساسية من أربعة أدوات. كل الأرقام الأربعة حقيقية. أداة واحدة توقفت في`jmp rax`اثنان من الأدوات تقرأ جدول القفز من خلال عمليات إعادة توزيعه. أداة واحدة تقسم كتلة عند القفز لوضع علامة. حساب كتلة دون سبب وراءه هو رقم دون دعوى.

هذه الدروس هي الخريطة التي تحتاجها قبل أن تثق بأي من هذه الأرقام دروس 32 إلى 36 قاموا ببناء جهاز تشخيص واحد، ورفع واحد، و سجل واحد من الأدلة، و إعادة بناء واحد. النصف الثاني من المسار يضعهم بجانب الأدوات التي يستخدمها الناس. للقيام بذلك تحتاج إلى تاريخ الحقل، والعائلات التي تقع فيها الأدوات، والخط الأنابيب التي تعمل كل مفصل، والحبل الذي يقارن ما تقول الأدوات على الأشياء التي قمت بتجميعها بنفسك.

```figure
re-37-field-map
```

## ثلاث وخمسين عاماً في خطوات متأرخة

هذا الحقل قديم أكثر من معظم أدواته. كل تاريخ أدناه لديه مصدر أساسي في القراءة المتقدمة.

### 1973 إلى 1991: أول من يقوم بتحريف المعلومات، ثم من يقوم بتفكيكها

أول أطروحة إزالة هي من عام 1973. كتبها هولاندر في ستانفورد وهوسل في بوردو، وكلاهما معروف اليوم من خلال الاقتباسات. كانت الأدوات العملية في الفترة هي المخططات. كتب مارانزانو وبورن`adb`وذلك في عام 1977، وذلك في عام 1979، وذلك في عام 1979، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1979، وذلك في عام 1979، وذلك في عام 1979، وذلك في عام 1979، وذلك في عام 1979، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام 1977، وذلك في عام عام 2007، وذلك في عام 2008، وذلك في عام 2008، في عام 2008، وذلك في عام 2008، في عام 2008، وذلك في عام 2008، في عام 2008، في عام 2008،`DEBUG`، مع إزالة 8086 ، تم إرسالها في PC-DOS 1.00 في أغسطس 1981. دخلت GDB من ريتشارد ستالمان التوزيع في عام 1986. وضع SoftICE إزالة عوارض النواة تحت DOS في عام 1987.

جاءت أجهزة تفكيك المجموعات التالية. قام Sourcer ، من V Communications في عام 1988 ، بتشغيل مرورات متعددة على برنامج DOS وكتب قائمة تعليقات. بدأت أجهزة GNU Binutils مع صور سريعة غير عددية في عام 1988 ، و `objdump`يحمل حق النشر في عام 1990. كتب إلفاك غيلفانوف أول سطر من IDA في يناير 1991 و أصدرت IDA 0.1 كبرنامج مشارك في 20 مايو 1991.

### 1991 إلى 2009: مفكّرات تفكّر وتفكّرات أولى

أكملت كريستينا سيفونيتس "تقنيات التجميع العكسي" في جامعة كيوت في يوليو 1994.`dcc`، أخذ i80286 برامج DOS إلى C ، ورقتها 1995 مع غوف وضع المراحل التي تبقيها كل مفكّر لاحقا. تابع REC في عام 1997 و Boomerang في عام 2002 ، أول مفكّر مفتوح المصدر ، تحت رخصة BSD.

أصبحت IDA منتجًا تجاريًا في DataRescue في عام 1996 ، واكتسب SDK التضمين في عام 1999 ، ثم انتقل إلى Hex-Rays ، التي تأسست في عام 2005. تم شحن Hex-Rays Decompiler 1.0 في 17 سبتمبر 2007. في نفس العام قدم مايك فان إيمريك "التعيين الواحد الدولي لتحميل" ، وهو أطروحة وضعت SSA في مركز تدفق البيانات لتحميل. بدأ "المقارنة الهيكلية للأشياء القابلة للتنفيذ" (2004) من هالفار فلايك عائلة مختلفة، ودخل بنديف للبيع في أغسطس 2004.

بدأت radare في فبراير 2006 كمحرر شفرة للطب الشرعي مع تعويضات 64 بت. كان radare2 ، الإعادة كتابة المودولية تحت LGPL-3.0 ، تم إصدارها لأول مرة في 7 مارس 2009.

### 2009 إلى 2019: الإطار والتمثيلات الوسطى

أعلنت LLDB كشركة LLVM في 8 يونيو 2010. ظهرت BAP ، منصة تحليل ثنائي مع لغتها المتوسطة BIL ، في CAV 2011. اشترت Google zynamics ، صانعي BinDiff ، في 1 مارس 2011. ظهرت Hopper على متجر Mac App حوالي نهاية عام 2011. بدأ Matt Godbolt Compiler Explorer في عام 2012 بحيث يمكن لمبرمج C ++ رؤية الجمعية التي ينتجها المُحَرِّق.

تلقت angr أول سطر من الشفرة في أغسطس 2013. أظهرت ورقة فينيكس (Schwartz, Lee, Woo, Brumley, USENIX Security 2013) الهيكلات التي تحافظ على التسمية مع 40 `goto`التعبيرات عبر 8676 وظيفة.`goto`البيانات ذات الهيكل المستقل عن النمط. تأسست شركة Vector 35 في 14 يناير 2015 ، وبدأت Binary Ninja للبيع في 23 يوليو 2016 مع IL منخفض المستوى و API Python. تم إطلاق Angr علناً في عام 2015 ، وتم تحدي DARPA Cyber Grand Challenge في أغسطس 2016. أصبحت بنديف مجانية في مارس 2016. أعطى Cutter 1.0 radare2 واجهة تعريف Qt في ديسمبر 2017. في عام 2018 قدم غيلفانوف "الجهاز الداخلي لـ Decompiler: microcode" في Recon ، وهو أول وصف عام لـ Hex-Rays IR.

### 2019 إلى 2026: فتح المتحللين والتحقيقات

تم إصدار Ghidra 9.0 من قبل وكالة الأمن القومي في مؤتمر RSA في 5 مارس 2019 تحت Apache-2.0, مع المصدر الكامل على GitHub بعد شهر. إضافة إضافة إضافية إضافية في نفس العام. أصدرت Binary Ninja 2.0 جهاز تحرير IL عالي المستوى في 20 مايو 2020. أعلن عن ريزين كشوكة من رادار2 في 8 ديسمبر 2020 ، وانتقل فريق كاتر إليه. إيدا فريوار 7.6 أضاف إصدارًا لـ cloud x64 decompiler في مايو 2021.

تم إطلاق BinDiff 8 بموجب Apache-2.0 مفتوحًا في 25 سبتمبر 2023. أصبحت SAILR (بالباسك وغيرها ، USENIX Security 2024) مهيمنًا افتراضيًا لـ Angr وقالت إنها مجرد مزيفة `goto`يجب إزالة البيانات ، لأن لينكس 6.1 لديه 3754 منها في مصدرها. إضافة النينجا الثنائية 4.0 إصدار مجاني في فبراير 2024, وإضافة IDA 9.0 `idalib`يبدأ دراسة "SLaDe" (2023) من "LLM4Decompile" (2024) إلى "DecompileBench" (2025) ، ودوران دراسات 2026 حول القراءة بمساعدة الوكيل وعن المتحللين الذين يقومون بإعادة جمع المزيد والحفاظ على أقل.

الإصدارات التي تم تشغيلها هذه الدروس هي الإصدارات الحالية في 14 أكتوبر 2026: غيدرا 12.1.4 (21 سبتمبر 2026) ، الرادار2 6.2.4 (5 أكتوبر 2026) ، الريزين 0.9.1 (29 يونيو 2026) ، و Angr 10.0.3 (10 أكتوبر 2026). النينجا الثنائية 6.0 "كريبتون" (3 سبتمبر 2026) و IDA 9.4 (13 يوليو 2026) هي الأدوات المغلقة الحالية. لم تشغلها هذه الدروس.

## العائلات الأدوات

الأداة تنتمي إلى عائلة من خلال ما تنتجها العائلات تتداخل في برنامج واحد، والتداخل هو حيث يبدأ معظم الخلط.

### المزج

تشكيل صفوف خطي من أول بايت من قسم الرمز إلى آخر.`objdump -d`و`llvm-objdump -d`يعمل بهذه الطريقة، ولا أحد يبني رسمية تدفق التحكم.`objdump`يعامل الرموز على أنها حدود التعليمات ويتم مسحها بينها. binutils 2.47 (26 يوليو 2026) هو GPL-3.0 أو أحدث. LLVM 23.1.3 هو Apache-2.0 مع استثناء LLVM. أبل أدوات خط الأوامر السفينة `llvm-objdump`"أبل LLVM نسخة 17.0.0"، وهذا هو النسخة هذه الدروس التقاط.

يقوم جهاز تفكيك تفكيكي بتشغيل النزول الترددي من الإدخالات المعروفة، ويضيف الهورستيات لبدء الوظيفة، ويحتفظ بقاعدة بيانات.`Disassembler`بالإضافة إلى المحللات التلقائية ، النينجا الثنائية (النزول المتكرر ، ثم التصفية الخطية على مناطق غير معروفة) ، هوبر ، رادار2 و ريزين (`aa`،`aaa`،`af`), مع كاتر وإياتو كGUI، جميعها في هذه العائلة. قياس أندرييس وغيرها (USENIX Security 2016) تسعة منهم على ثنائيات التي يولدها المُجمّع. كانت دقة التعليمات قريبة من 100 في المائة، وكانت البدائية الصلبة هي بدء الوظيفة، مع معدلات سلبية كاذبة من 20 في المائة أو أكثر.

### المتحللات

المتحللات التجارية: Hex-Rays Decompiler (عشرة عشرة عائلة هدفا من x86 إلى RISC-V) ، HLIL من Binary Ninja مع تقديمها Pseudo C ، ومشاهدة هوبر من رموز مزيفة. المتحللات المفتوحة: تحلل Ghidra، محرك C ++ تحت Apache-2.0 الذي r2ghidra و rz-ghidra يستخدمون مرة أخرى كمنشط و الذي pypcode يستخدمون مرة أخرى كرفيع؛ تحلل Angr على AIL مع SAILR هيكلة تحت BSD-2-Clause؛ r2dec و jsdec في JavaScript؛ بوميرانغ و `dcc`كما هو الحال في التاريخ. رادار2 لديه أيضاً مدمج`pdc`"إخراج مفصل مزيف في نحو تشبه "سي" "ريسين" ليس لديه مفصل متكامل`pdc`لا توجد في الريزين 0. 9. 1 و `pdg`يحتاج إلى مضخة RZ-Gidra.

### إزالة الأخطاء

GDB (1986) مع GEF و pwndbg front-end ، LLDB (2010) ، WinDbg مع Time Travel Debugging (2017) ، OllyDbg (مجمود في 2014) ، x64dbg (GPL-3.0, 2014) ، Ghidra Debugger مع وصلات Python ، Binary Ninja debugger ، والمنشطات المدمجة ل radare2 و rizin. يستخدم الدروس 42 اثنين منهم على بناءاتك الخاصة.

### إطار تحليل ثنائي

(VEX IR، التنفيذ الرمزي، `CFGFast`و`CFGEmulated`(BIL, OCaml), Dyninst, Jakstab, و ByteWeight هي الإطارات التي سميت أنديس.`import binaryninja`، و إدارة الدفاع عبر`idalib`. . .

### المكتبات المنسيقية والحرك

يصفح LIEF 1.0.0 (12 يوليو 2026, Apache-2.0) ELF، PE، Mach-O، COFF، و تنسيقات أندرويد. CLE، "CLE Loads Everything" ، هو محرك تحميل Angr. كابستون 5.0.9 (28 مايو 2026, BSD-3-Clause) يقرر؛ كايستون 0.9.2 (GPL-2.0) تجمع؛ يونيكورن 2.1.4 (GPL-2.0) محاكاة. radare2 6.2.4 حزم كابستون 5، و رزين 0.9.1 بائع كابستون، زيدس، و محارس الأشجار.

### أدوات التفريغ ومشاهد جانبية للمحاكم

بنديف 8 (أباتشي-2.0) مع ملحق BinExport 12 له ل IDA Pro ، Binary Ninja ، و Ghidra ؛ Diaphora 3.4.3 (11 أكتوبر 2026, AGPL-3.0) كملحق IDA ؛ `radiff2`و`rz-diff`. يظهر متصفح المجمعين (BSD-2-Clause) الجمعية التي ينبعث منها المجمعين لقطعة المصدر ، والتي هي الاتجاه الأمامي لكل شيء آخر في هذه القائمة. يستخدم الدروس 44 العائلة المختلفة.

### الإصدارات والترخيصات وما كان هذا الدروس

| Tool | Version read on 2026-10-14 | Licence | Headless entry | Ran here |
|---|---|---|---|---|
| Ghidra | 12.1.4 | Apache-2.0 | `analyzeHeadless`, `pyghidra.start()` | yes, on all four objects |
| radare2 | 6.2.4 | LGPL-3.0 | `r2 -qc '<cmds>' file`, `rabin2` | yes |
| rizin | 0.9.1 | LGPL-3.0 | `rizin -qc '<cmds>' file`, `rz-bin` | yes |
| angr | 10.0.3 | BSD-2-Clause | `angr.Project` in Python | yes |
| llvm-objdump | Apple LLVM 17.0.0 | Apache-2.0 with LLVM exception | `llvm-objdump -d -r` | yes |
| Binary Ninja | 6.0 "Krypton" | commercial; Free edition for non-commercial use | `binaryninja.load()` with a Commercial, Ultimate, or headless licence | no, documentation only |
| IDA Pro | 9.4 | commercial subscription; IDA Free for non-commercial x86 and x86-64 | `idat`, `ida -A -S`, `idalib` | no, documentation only |
| Hopper | 6.6.0 | commercial, perpetual | none documented | no, documentation only |
| Cutter | 2.5.0 | GPL-3.0 | GUI over rizin | no |

الإصدار المجانى من ثنائي نينجا يفكّر x86, x86-64, ARMv7 و AArch64 فقط وليس لديه API. لا يوجد IDA Free IDAPython، لا SDK، ولا `idalib`كل بيان عن هذين الأدويتين في هذه الدروس يأتي من وثائقهم وملاحظات الإفراج، والرقم يُعَلِّمهم بأنهم لا يعملون.

## خط أنابيب إزالة المواد، خطوة بخطوة

سمي سيفوانتس المراحل في عام 1994: تحليل النص، التحليل الترجموي، توليد الرمز المتوسط، توليد الرسم البياني للتدفق التحكم، تحليل التدفق البيانات، تحليل التدفق التحكم، وتوليد الرمز. وقسمتهم إلى نهاية مقدمة تعتمد على الآلة، ووسط مستقل عن الآلة واللغة، وآخر خلفي تعتمد على اللغة. كل مُفكّر منذ ذلك الحين يبقي هذا الشكل ويعيد تسمية الأجزاء. الجدول أدناه يعطي الثمانية مراحل تستخدم هذه الدروس والاسم الذي يعطيه كل أداة. الرسمي يظهر نفس الجدول مع أعمدة الأدوات قابلة للاختيار.

| Stage | Ghidra | Binary Ninja | Hex-Rays / IDA | radare2 | rizin | angr |
|---|---|---|---|---|---|---|
| Loader | `ElfLoader`, `MachoLoader`, `PeLoader`; `.ldefs` picks the language | `BinaryView`, `BinaryViewType` | loader module (`LDSC`) | RBin (`rabin2`) | RzBin (`rz-bin`) | CLE (`cle.Loader`, `main_object`) |
| Disassembly | `Disassembler`; SLEIGH `.slaspec` compiled to `.sla`; analyzers "Disassemble Entry Points", "Function Start Search" | architecture plugin; Recursive Descent, then linear sweep phases | processor module (`ana.cpp`, `emu.cpp`, `out.cpp`); autoanalysis queues; FLIRT | RArch plugin to `RAnalOp`; `aa`, `aaa`, `af` | RzAnalysis plugin; `aa`, `aaa`, `af` | Capstone blocks; `CFGFast` function start search |
| CFG recovery | "Generate Basic Blocks and the CFG"; `BlockGraph`; "Decompiler Switch Analysis" | `Function`, `BasicBlock`; "Control Flow Graph (CFG) Analysis" phase | `mbl_graph_t`, ready at `MMAT_LOCOPT` | `afb`, `agf`, `aab` | `afb`, `agf`, `aab` (Nucleus) | `CFGFast`, `CFGEmulated`; `kb.functions`; IRSB |
| Lifting | "Generate Raw P-code"; Varnodes in `ram`, `register`, `const`, `unique` | Lifted IL, LLIL, Mapped MLIL, MLIL | microcode (`minsn_t`, `mop_t`); `MMAT_GENERATED` | ESIL (`asm.esil`, `ae`) | RzIL (`aoi`, `aez`) | VEX (`pyvex.lift`, IRSB), then AIL |
| SSA | `Heritage`, `ActionHeritage`; `MULTIEQUAL`, `INDIRECT` | LLIL SSA, MLIL SSA, HLIL SSA; `HLIL_VAR_PHI` | no named SSA; use-def data flow in `MMAT_GLBOPT1` to `3` | none; ESIL is built for emulation | none; RzIL is built for emulation | `_stage_transform_to_ssa_level0` and `level1`; `SeqNodeDephication` |
| Data flow and types | `ActionDeadCode`, `ActionInferTypes`, the `Rule` pool; prototype from `.cspec` | MLIL constant propagation, variables and types; `analyzeReturns` | "Transform microcode"; `MMAT_CALLS`, `MMAT_GLBOPT`, `MMAT_LVARS`; TIL | `afv`, `afc`, `aaft`; ESIL emulation | `afv`, `afc`, `aft` | `CallingConventionAnalysis`, `VariableRecoveryFast`, `Typehoon` |
| Structuring | `CollapseStructure`; `BlockIf`, `BlockWhileDo`, `BlockSwitch`, `BlockGoto` | `HLIL_IF`, `HLIL_WHILE`, `HLIL_SWITCH`; AST at `root` | "Generate ctree"; structural analysis; goto regions | `pdc`; `pdd` (r2dec); `pdg` (r2ghidra) | `pdg` (rz-ghidra); jsdec | `RegionIdentifier`; `RecursiveStructurer` with `SAILRStructurer` |
| Emission | "Emit Final C Tokens"; `PrintC`, `ActionNameVars`, `ActionSetCasts` | HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python | "Beautify ctree; Print ctree"; `cfunc_t` | text of `pdc`, `pdd`, `pdg` | `pdg` text | `CStructuredCodeGenerator`; `codegen.text` |

### الحمولة

يقوم الشاحن بتحليل الحاوية، ويقوم بتحليل القسمات، ويقرأ الرموز والتحويلات. في كائن قابل للتحويل لا يوجد شيء لديه عنوان بعد، لذلك يختار الشاحن واحد.`0x08000000`، مما يضع`.text`في`0x08000040`لأن القسم يبدأ عند تعويض الملف `0x40`. أماكن CLE`.text`في`0x400000`-جيدرا`ElfLoader`يضعها في`0x100000`. .`llvm-objdump`يُطبعُ مُزَحَفَاتَ القسمِ و لا قاعدةَ على الإطلاقِ.

يختلف الحملات أيضاً في عمليات التنقل. تقوم Ghidra بمعالجةها عند الاستيراد، وتطبقها CLE.`bin.relocs.apply=true`ما يفعله الحامل مع عمليات التنقل يقرر ما يمكن أن يراه كل مرحلة لاحقة، وسوف تلتقي بالنتيجة في `-O0`قفزوا على الطاولة من أسفل.

### التفكيك

دراسة 33 بنيت كلا الطرق كل أداة في الطاولة باستثناء`llvm-objdump`يدير التنزل الترددي ثم يضيف بحث عن البداية تسمي وثائق Ninja الثنائية المراحل بالترتيب: التراجعية التنازلية، تحليل الهدف الدعوة، تحليل CFG على أنها "انزلاق خطي للمناطق غير المعروفة"، وتحليل الدعوة الذيل. تقوم "غيدرا" بتشغيل المحللات حسب الأولوية، مع "فك نقاط الدخول" و "بحث بدء الوظيفة" مبكراً. إدارة التحليلات المركزية تحتفظ بعلامات التحليل الذاتي، كل منها مع الأولوية، وقراعات FLIRT للكود المكتبي. غر `CFGFast`وثائق أربعة مصادر من الوظيفة تبدأ: الرموز، مسح مقدمة، استدعاء أهداف، والمسح الكامل للبايتات المتبقية. هذا المصدر الأخير هو حيث أنغر يختلق الوظائف في التدفق.

### استعادة CFG

كل أداة تقطع حظر بالطريقة التي فعل الدرس 33، مع فرق واحد سوف تقيس.`call`لأن IRSB هو مدخل واحد، كتلة خروج متعددة والاتصال هو الخروج.`grade_label`في`-O0`، الذي يدعو`grade`، و"إنجر" تقرير 2 كتلة والثلاثة الأخرى تقرير 1.

### رفع

تعرّف النينجا الثنائية رفع "ترجمة من لغة مستوى أقل إلى لغة متوسطة تعتبر أعلى". تختلف IRs في ما هي له. تم بناء P-code و VEX للتحليل و إزالة. تم بناء ESIL و RzIL للتقليد ، ولا يوجد في أي منها مرحلة SSA. يبدأ Hex-Rays ميكرو كود RISC يشبه 72 opcodes و يمر من خلال مستويات النضج من `MMAT_GENERATED`إلى`MMAT_LVARS`. يرفع النينجا الثنائي إلى Lifted IL ، ثم يطوي العلامات إلى ظروف في LLIL ، و "يترجم MLIL السجلات والوصول إلى الذاكرة إلى متغيرات". القسم التالي يضع أربعة من هذه IR جنبا إلى جنب على إمرأة واحدة.

### الـ SSA

يصف أطروحة فان إمريك ما يشتريه SSA في جهاز تحرير: انتشار التعبيرات والبرامج وتحديد العودة دون افتراض ABI ، وتحليل الحفاظ على الوصول ، وتحليل النوع كمشكلة ضئيلة في تدفق البيانات ، وتحليل القفزات والمكالمات غير المباشرة. تدعو Ghidra بناء SSA `Heritage`و يضيف عمليتين موجودتين فقط في الرسم البياني`MULTIEQUAL`للـ (في) و (`INDIRECT`النينجا الثنائية تعرض شكل من أشكال SSA في كل مستوى IL. angr لديها مرحلتين من SSA داخل `Clinic`. هيكس-رايز لا تسمي شكل SSA وتستخدم تدفق البيانات في مرسومات التحسين العالمية. ليس لدى ESIL و RzIL أي واحدة.

### تدفق البيانات وأنواعها

يبدأ حلقة تبسيط الرئيسية لـ Ghidra "إزالة الرمز الميت" و "ترويج الأنواع المحلية" و "إجراء إعادة كتابة المدة" حتى لا يتغير أي شيء، مع إعادة كتابة يتم بواسطة مجموعة من `Rule`الـ (هيكس-راي) تحول الرمز الميكرو، واكتشاف حجج الدعوة في`MMAT_CALLS`، ويعطي المتغيرات المحلية في `MMAT_LVARS`. غر رينز`CallingConventionAnalysis`،`VariableRecoveryFast`و`Typehoon`، تنفيذ من نونان، لوجينوف، وكوك النوع البوليمورفية استنتاج. الدروس 41 حول هذه المرحلة.

### الإنشاءات

غيدرا `CollapseStructure`يبحث عن الرسومات الفرعية التي تتطابق مع هيكل، ينهارها إلى عقدة واحدة، وعندما يصبح عالقا يزيل حافة ويجعلها غير مهيكلة.`if`،`while`،`do`و`switch`وتترك البقية على أنها مناطق غوتو.`SAILRStructurer`بطبيعة الحال ، مع `PhoenixStructurer`و`DreamStructurer`درجة 34 كتب من قبل أحد المهنيين

### الإصدار

غيدرا تنشر رموز C عبر`PrintC`مع طباعة اوبن جميلة بعد`ActionNameVars`و`ActionSetCasts`. هيكس-رايز تجميل وتطبيق الشجرة. نينجا ثنائي تقديم HLIL كـ Pseudo C، Pseudo Rust، أو Pseudo Python. angr يعود `codegen.text`. بصمات الرادار2`pdc`،`pdd`أو`pdg`. . .

## تعليم واحد في أربع إطار

خذ`48 83 ec 10`،`subq $0x10, %rsp`. فكّرها على الورق مع القواعد من الدروس 33

1. `48`هل REX مع `W = 1`-الآوبراندي 64 بت
2. `83`هو مجموعة-1 رمز حسابي مع 8 بتات مباشرة. حقل ModRM reg يختار العملية.
3. `ec`هو ModRM `11 101 100`. .`mod = 11`هو نموذج السجل. `reg = 101`هو`/5`، وهو`sub`. .`r/m = 100`هو`%rsp`. . .
4. `10`هو الفورية، 16.

أربعة رفعيين أعطوا هذه الأربعة بايتات.

ESIL من radare2 6.2.4 هو سلسلة واحدة منفصلة عن العنصر العكسي من 30 رمزا:

```text
16,0x8000000000000000,-,!,16,rsp,-=,63,$o,^,of,:=,63,$s,sf,:=,$z,zf,:=,$p,pf,:=,64,$b,cf,:=,4,$b,af,:=
```

إنها آلة تحميل`16,rsp,-=`يُسحب في مكان كل علم يكتب بعد ذلك مع عامل داخلي: `$o`التجاوز`$s`علامة`$z`صفر`$p`المساواة`$b`اقترض

RzIL من rizin 0. 9. 1 هو تعبير S مع 14 `set`الآثار:

```text
(seq (set op1 (var rsp)) (set op2 (bv 64 0x10)) (set sub (- (var op1) (var op2))) (set rsp (var sub))
     (set _result (var sub)) (set pf (! (lsb (let _val (cast 8 false (var _result)) ...))))
     (set zf (is_zero (var _result))) (set sf (msb (var _result))) ... (set cf (|| ...)) (set of (|| ...)) (set af (|| ...)))
```

كل علم هو تعبير بولي على متجهات البيت. علم المساواة وحدها هو أربع مستويات`let`. . .

رمز "ب" من مواصفات "سليغ"`x86:LE:64:default`عبر الرمز النقدي 4.0.1 هو تسعة عمليات بعد`IMARK`:

```text
CF = RSP < 0x10
OF = sborrow(RSP, 0x10)
RSP = RSP - 0x10
SF = RSP s< 0x0
ZF = RSP == 0x0
unique[58300:8] = RSP & 0xff
unique[58400:1] = popcount(unique[58300:8])
unique[58500:1] = unique[58400:1] & 0x1
PF = unique[58500:1] == 0x0
```

سجل التحويلات مع المؤقتين في `unique`يتم حساب العلامات عند التعليمات، بحماس،`CF`و`OF`يتم حسابها قبل أن يتم تغطية الحساب`RSP`. . .

ويكس من pyvex 10. 0. 3 هو سبعة بيانات بعد `IMark`:

```text
t2 = GET:I64(offset=48)
t0 = Sub64(t2,0x0000000000000010)
PUT(offset=144) = 0x0000000000000008
PUT(offset=152) = t2
PUT(offset=160) = 0x0000000000000010
PUT(offset=168) = 0x0000000000000000
PUT(offset=48) = t0
```

لا يظهر أي علم. تسجل أسماء VEX حسب تعويضاتها في دولة الضيوف، وتعويض 48 هو `rsp`. الرسوم المُسَدَّدة 144 إلى 168 هي`cc_op`،`cc_dep1`،`cc_dep2`و`cc_ndep`. الرفع يحتفظ برقم العملية 8 ، وهو 64 بتة خصم ، والعملين. فروع لاحقة التي تقرأ العلم يحسبها من العصا. لهذا السبب`pcode.writesFlags`هو صحيح و`vex.computesFlags`هو خاطئ في تقرير الحزام، ولماذا VEX هو أقصر من الأربعة.

نفس أربعة رماة`48 63 c7`،`movslq %edi, %rax`، أول تعليمات من`grade`في`-O1`، أعط 5 رموز ESIL (`32,edi,~,rax,=`), 1 رزيل `set`, 1 عمل ب- كود (`RAX = sext(EDI)`لا يوجد رافعي يكتب راية، لأن التعليمات لا تملكها. قائمة غيدرا الخاصة بتلك التعليمات، التي تم التقاطها من خلال النص بدون رأس، طباعة نفس العملية مثل `(register, 0x0, 8) INT_SEXT (register, 0x38, 4)`: سجل تعويض 0 هو `RAX`، تعويض`0x38`هو`RDI`والحجم هو 8 و 4 بايت

`83 f9 04`،`cmpl $0x4, %ecx`، من المراقبة الحدودية`grade`، يعطي 30 رمزا ESIL، 13 RzIL `set`الآثار، 10 عمليات رمز P، و 7 بيانات VEX مع `cc_op`7، الحد من 32 بت، لا شيء يكتب`%ecx`. عرضان الحد من العد الذي ستقابلونه في VEX 7 ل 32 بت و 8 ل 64 بت ، وترجمة تقوم بناؤها تحمل تلك الجدول.

## أربعة قواعد عنوان لمهمة واحدة

قبل أن يتمكن الحزام من مقارنة أي شيء يجب أن يتفق مع نفسه حول مكان الوظيفة.`grade`في`ledger-x86_64-O1.o`. . .

| Tool | Address of `.text` | Address of `grade` | Offset |
|---|---|---|---|
| `llvm-objdump` | `0x0` | `0x10` | `0x10 - 0x0 = 0x10` |
| radare2, rizin | `0x08000040` | `0x08000050` | `0x08000050 - 0x08000040 = 0x10` |
| angr | `0x400000` | `0x400010` | `0x400010 - 0x400000 = 0x10` |
| Ghidra | `0x100000` | `0x100010` | `0x100010 - 0x100000 = 0x10` |

جدول الرمز يقول`grade`هو في`.text + 0x10`كل أداة تتفق بعد إزالة القاعدة.`iSj`في الرادار2 والريزن،`.text`إدخال قسم في التقاط اللوحات، `.text`حظر الذاكرة في التقاط الغيدرا، و صفر للمسح.`test_every_tool_places_grade_at_offset_0x10_from_its_own_base`يصلح هذا الحقيقة

## أين تتوافق الأدوات وأين تفرق

الحزام في`code/main.py`يقرأ الأخذات، يقلل من كل عنوان، ويقارن هذه هي الأرقام التي يبلغ عنها، والاختبارات تؤكد كل منها.

### حالة الاتفاق: دفتر التسجيل عند -O1

أربعة وظائف، 56 تعليمات في التصفية، 54 داخل الرموز و 2 في التدليك. كل أداة تقرير نفس التعليمات تبدأ في كل وظيفة: 9، 14، 13، و 18. أربعة صانعي الرسوم البيانية تقرير 3، 3، 5، و 4 كتلة و 2، 3، 5، و 4 حواف، ومجموعات الحافة هي نفسها، زوج للزوج، عبر الرادار، ريزين، Angr، و Ghidra. خمسة كتلة وخمس حواف من `total`هذه هي الدرسة 33 رسمها يدوياً

الفرق الوحيد هو في التدليك.`66 90`بعد`grade`،`90`بعد`total`) يتم فك رموزها من قبل التصفح ، الذي ليس لديه سبب للاستمرار ، و من قبل الغضب ، الذي يخلق `sub_40003e`و`sub_40005f`لا يوجد رمز، لا يُدعي الرادار، لا يُدعى الريزين، ولا يُدعى غيدرا أيًا منهم

### الحالة المتجهة: دفتر التسجيل عند -O2

`total`هو 41 تعليمات في 10 كتب مع 13 حافة، في كل من أربعة مُصنعي الرسوم البيانية. حلقة SSE2 والحلقة المتبقية من الدروس 33 يتم قطعها بنفس الطريقة في كل مكان. angr يضيف مرة أخرى وظائف اثنتين في التدليك.

### طاولة القفز: درجة عند -0

هنا أدوات تقسيم، والقسم هو الدرس.

| Tool | Blocks | Edges | What the capture says |
|---|---|---|---|
| radare2 | 3 | 2 | the block at `0x62` has no successor; bytes `0x76` to `0x9a` are never reached; 8 instruction starts missing |
| rizin | 8 | 11 | the block at `0x62` carries a `switch_op` with 5 cases and 4 distinct targets |
| angr | 8 | 7 | the case blocks exist, and the transfer at `0x62` goes to an unresolvable target node |
| Ghidra | 9 | 12 | `switchD` label at `0x74` splits the block; four `COMPUTED_JUMP` flows to `0x76`, `0x7f`, `0x88`, `0x91` |

كلّ الأربعة قاموا بتفكير نفس التعليمات 33 عندما وصلوا إليها`jmp rax`وترك 36 بايت غير مسموح بها، وسمات الحاسوب التي تتراوح بين كود مفقود. ريزين و غيدرا وجدوا الأهداف الأربعة المختلفة التي قرأ الدروس 33 من خمسة عمليات نقل في`.rela.rodata`. Angr يردد كتلة القضية داخل `grade`ولا يزال لا يملك حافة من حجر القفز إليهم ؛ تسجل القبض عليه نقل في `0x62`حيث يؤدي إلى عقدة هدف لا يمكن حلها ، و طبع مفكّرها`goto`. غيدرا لديها كتلة واحدة وحافة واحدة أكثر من الريزين لنفس تدفق التحكم لأن تحليل المفتاح وضع علامة على`jmp rax`وبدأ نموذج الكتل كتل جديد في علامة.

الرسم البياني للدرس-33 كان لديه 8 كتلة و 11 حافة. يطابق rizin تماما. النقطة هي أن نرى أن 9 و 11 و 7 و 2 ليست أربعة قياسات من الرمز وجدت. إنها أربعة إجابات إلى مدى أداة اتبعت قفزة واحدة غير مباشرة وأين اختارت للقطع.

### البيانات في الرمز: فخ

`lookup`هو 24 بايت مع 4 بايت الجدول `31 c0 90 48`في`0x10`. التفاصيل التفاصيل 8 التعليمات تبدأ في هذا النطاق.`0x10`،`0x12`و`0x13`، و بداية مفقودة في`0x14`هذا هو`addq $0x1, %rax`من الدروس 33 بيع واحد مبكراً. رادار2، ريزين، و غيدرا تقرير 6 يبدأ، 2 كتلة، 1 حافة، و مغادرة `0x10`إلى`0x14`لا يُطالب بها . Angr تقرير نفس 2 كتلة و 1 حافة ل `lookup`ثم يختلق`sub_400010`على الجدول بايت: 2 تعليمات في كتلة 4 بايت التي تنتهي في `0x14`، حيث الكتلة الثانية من `lookup`يبدأ، لذلك البايت REX في `0x13`آخر ما وجدته الحبل لهذا الكائن هو أنه لا يوجد بناء للكرائح`0x10`إلى`0x14`، لذلك تلك البايتات تقع داخل وظيفة و هي بيانات.

### اختراعى وفق الأدوات

عبر الأجسام الأربعة، يطلق الحزام أسماء 9 وظائف التي يختاره Angr دون رمز، كل واحدة عند الغطاء أو على طاولة الفخ. يطلق على نطاق واحد يفوت الرادار2، 36 بايت حالة من `grade`في`-O0`. يطلق على 9 نطاقات التي يقوم بها المصفح الخطى بتفكيرها ولا يعامل أي بناء للجراف كرمز: ثمانية فجوات التدفق بالإضافة إلى جدول الفخ.

## ثلاثة مُحللين على الصف

ثلاثة من الأدوات التي تم التقاطها تنبعث نصاً تشبه C`grade`في`-O1`المصدر هو`switch (score / 10)`مع خمسة حالات، تم تجميعها على شكل فحص الحدود وجدول قيم العائد.

غيدرا 12.1.4:

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

Angr 10.0.3:

```c
extern unsigned int g_4000b4[4];

unsigned int grade(int a0)
{
    unsigned int v1;  // ecx
    unsigned int v2;  // eax

    v1 = (unsigned int)((long long)(a0 * 1717986919) >> 0x22) + (unsigned int)(a0 * 1717986919 >> 63) - 6;
    v2 = 0;
    if (v1 <= 4)
        v2 = g_4000b4[v1];
    return v2;
}
```

الـ 6.2.4`pdc`:

```c
void sym.grade (int64_t arg1) {
    rax = edi
    rax = rax * 0x66666667
    rcx = rax
    rcx >>= 0x22
    rax >>>= 0x3f
    ecx += eax
    ecx += 0xfffffffa
    eax = 0
    v = ecx - 4
    if (((unsigned) v) <= 0) {
        eax = ecx
        rcx = rip
        eax = dword [rcx + rax*4]
    }
    return
}
```

قراءة الثلاثة ضد خط الأنابيب.`0x66666667`و التحول ب 34 مرة أخرى إلى`param_1 / 10`، وهو لغة الدروس 34 . Angr رفع نفس البايت وترك الحساب`a0 * 1717986919 >> 0x22`. رادار2's `pdc`هو ESIL emulation plus pseudo syntax: أسماء السجلات، لا متغيرات، لا أنواع، والتحقق الحدود مطبوعة على شكل `<= 0`بعد خصم غير مؤشر غيدرا كتب تحميل الطاولة من خلال`DAT_001000b4`; إعلان غر `g_4000b4[4]`لا غيدرا ولا أنغر استعادت إحصاء الحالات، لأن في`-O1`لا يوجد مبدّل في البايتات`-O0`، حيث يوجد طاولة القفز، غيدرا طبعت `switch(param_1 / 10)`مع الحالات 6 إلى 10 والطريقة الافتراضية، و Angr طبعت`goto`. . .

ليس لدى (ريزن) مفكّر خاص به، و سجلات التقاط تلك`pdc`إنّ HLIL من Ninja ثنائيّة و شجرة الأشعة السبع هي النتائج التي لم تتمكن هذه الدروس من التقاطها

## بناءها

أطلق التجربة:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
```

إنتاج هو تقرير JSON واحد. يفتح مع نسخ الأدوات المسجلة في وقت التقاط وأدوات موجودة على جهازك، والتي قد تكون غائبة. ثم لكل من الأجسام الأربعة يعطي التوسع الرمزي، وفرق التدليك، والقاعدة كل أداة تستخدم، والعمل يبدأ كل أداة وجدت أو اخترع، و لكل وظيفة الاتفاقية التعليمات-بدء، حسابات الكتل، حسابات الحافة، والحافة كل أداة تفتقر. إنه ينتهي بمحاسبة البايت لكل أداة، وملاحظات الأدوات نفسها، وقائمة النتائج في جمل بسيطة، وقطاع IR: إنتاج المترجم للمعليمات الثلاثة بجوار العد القاس على المصاعد التي تم التقاطها.

الشكل المتوقع:

```json
{
  "captureTools": {"llvm-objdump": "Apple LLVM version 17.0.0", "radare2": "radare2 6.2.4 ...", "rizin": "rizin 0.9.1 ...", "angr": "10.0.3", "ghidra": "12.1.4"},
  "localTools": {"radare2": "absent", "...": "..."},
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "bases": {"llvm-objdump": "0x0", "radare2": "0x8000040", "angr": "0x400000", "ghidra": "0x100000", "...": "..."},
      "functions": {"grade": {"blocks": {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9}, "edges": {"radare2": 2, "rizin": 11, "angr": 7, "ghidra": 12}, "...": "..."}},
      "findings": ["radare2 never reaches bytes 0x76-0x9a inside grade that the other graph builders decode", "..."]
    }
  },
  "ir": {"translator": [{"text": "subq $0x10, %rsp", "flags": {"pcodeLike": "eager", "vexLike": "thunk"}, "...": "..."}], "observed": {"...": "..."}}
}
```

اقرأ`code/main.py`في هذا الترتيب:

1. `read_text_symbols()`يقرأ عناوين القسم و `STT_FUNC`رموز `.text`الطاولة الرمزية هي الحقيقة الوحيدة التي يمتلكها الحزام`TextSection.gaps()`يستخرج من ذلك التدليك
2. `parse_objdump()`،`parse_r2_family()`،`parse_angr()`و`parse_ghidra()`كل واحد يُحوّل إلى ...`ToolView`: قاعدة، التعليمات كعكس إلى الطول، و واحد `FunctionView`لكل وظيفة مع الكتل، الحواف، وأي نص تم فكيه. كل محلل يعرف مخزون لغات أداة واحدة ولا شيء آخر.
3. `majority()`و`ranges()`" أَنَّ المُسَاعِدَين " أي المُسَاعِدين " كلَّ مُقَارَنٍ يُفِيدُهُم .
4. `function_report()`يُقارن الإرشادات التي تبدأ مع معظم مُبني الرسوم البيانية، ثم يُعدّ الحدود، ثم يُحدد الحافة، ويرسل ما يفتقر إليه كل أداة.
5. `byte_report()`يحسب كل بايت كرمز داخل رمز، ملء، غير المطالبة، المخترع، أو المفقود، وسمي البايت داخل الرموز التي لا يفكرها بناء الرسوم البيانية.
6. `findings()`يُحوّل هذه الجمل، و`compare()`يجمع تقرير واحد لكل كائن.
7. `decode_small()`،`to_pcode_like()`و`to_vex_like()`هو مترجم: ثلاثة تشفيرات في شكل سجل، ونمط واحد حريص، ونمط واحد ثنك.
8. `observed_ir()`قياس المصاعد التي تم القبض عليها، و `figure_data()`يجمع جدول الزمني و جدول المرحلة والدليل الذي يظهر الرسم

هناك ثلاثة أوامر أخرى`python3 code/main.py compare FIXTURE.o`يطبخ تقرير كائن واحد. `python3 code/main.py ir 4883ec10`يطبخ المترجم النماذج الثنائية لتعليم واحد. `python3 code/main.py figure-data`يطبخ البيانات المضمنة في الرسم.

تم القبض على هذه الأقراص مرة واحدة من قبل`code/fixtures/capture_tools.py`، الذي يسجل كل أمر و نسخة في`captures.json`. لا يبدأ الحزام والاختبارات أداة أبداً. إذا كان لديك الأدوات، قم بتشغيل نص التقاط لتجديد الملفات، وقراءة إضافات README للبيئة التي تحتاجها.

## استخدمها

استخدم الحزام على كائن جديد بهذا الترتيب

1. قم ببناء الكائن بنفسك واحفظ أمر المُحْتَرِق. اقرأ جدول رموزه قبل فتح أي أداة، حتى تعرف كم وظيفة هناك وأين المُغطاة.
2. التقاط كل أداة مرة واحدة في وضع بدون رأس. تخزين الخروج الخام والإرشاد الدقيق إلى جانب الموضوع. عدم توافق لا يمكنك إعادة قراءته ليس اكتشافا.
3. تحقق من القاعدة. اختر وظيفة واحدة وتأكد من أن كل أداة يضعها في نفس التوازن بعد أن تقوم باستبعادها `.text`إذا لم يكن هناك واحد، توقف وتعرف ما أداة تحميل.
4. تبدأ تعليمات المقارنة أولاً. إذا كان المبدعين على الرسم البياني يختلفون هنا، فإن بقية المقارنة تتعلق بتشخيص وليس بتحليل.
5. مقارنة الكتل والحواف، وقرأ ملاحظات كل أداة قبل أن تحكم على العد.`switch_op`، أ`COMPUTED_JUMP`أو عقدة هدف لا يمكن حل لها تفسر معظم الاختلافات
6. حساب البايتس. إضافة أن أداة تدعي هوهيرية في العمل. البايتس الرمزية التي ترك أداة هي المشي وقف. البايتس الرمزية التي لا يدعي بناء الرسم البياني هي البيانات.
7. اكتب أدوات لم تشغلها. وصف من الوثائق مفيد وهو نوع مختلف من الأدلة من التقاط.

## المختبر التفاعلي

### المختبر (أ): وظيفة واحدة، أربعة قواعد

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/code
python3 -q
```

أركض

```python
from main import *
views = load_views("ledger-x86_64-O1.o")
{tool: hex(view.base) for tool, view in views.items()}
{tool: hex(view.functions["grade"].start + view.base) for tool, view in views.items()}
```

اكتب الأدوات الأربعة الخامة قبل تشغيل الخط الثاني و تحقق منها ضد الجدول في هذه الدروس`grade`مع`grade_label`ويحسب يدوياً أين يجلس في غيدرا

### المختبر ب: طاولة القفز من أربعة جانبي

```python
report = compare("ledger-x86_64-O0.o")
report["functions"]["grade"]["blocks"]
report["functions"]["grade"]["edgesMissingPerTool"]["radare2"]
report["notes"]["rizin"]
report["notes"]["ghidra"]
report["bytes"]["radare2"]["misses"]
```

عد الحواف التي تفتقر الرادار2 وتطابق كل واحد من خط من `-O0`بعد ذلك اقرأ ملاحظة غيدرا و ابحث عن`switchD`اللقب في القبض على "غيدرا".

### المختبر "ج": العلامات المهتمة ضد قطعة

```python
translate("48 83 ec 10")["pcodeLike"]
translate("48 83 ec 10")["vexLike"]
translate("83 f9 04")["vexLike"]
{row["name"]: (row["pcode"]["ops"], row["vex"]["statements"]) for row in observed_ir()["instructions"]}
```

إبحث عن`cc_op`ثابتا في كلتا النتائج وأيضح لماذا واحد هو 8 والآخر 7. ثم حاول`translate("48 01 c8")`و قراءة `TranslateError`. . .

### المختبر D: الفخ تحت خمسة أدوات

```python
report = compare("sweep-trap.o")
report["functions"]["lookup"]["instructionStarts"]
report["bytes"]["dataInsideSymbols"]
report["functionStarts"]["angr"]
```

فك رموز البايت `31 c0 90 48 83 c0 01`على الورق مثل مسح، ثم مثل الهبوط بعد`jmp`. تطابق قائمتك مع الإضافات و تبدأ تقارير الضغط المفقودة

## مختبر التدريب

أضف قبضة خامسة و تمدد الحزام

المتطلبات:

- اختر أداة واحدة لم يتم التقاطها في هذا الدروس ويمكنك تشغيلها على جهازك: GNU `objdump`, LIEF مع Capstone , جلسة Binary Ninja Free المصدرة يدوياً ، أو Ghidra مع مجموعة تحليل مختلفة.`captures.json`. . .
- اكتب محلل واحد يحول الاعتقال الى`ToolView`مع قاعدة الأداة، والإرشادات، والمهام، والبلوكات حيث الأداة لديها، والحواف حيث لديها.
- إضافة الأداة إلى `TOOLS`و إذا كان يبني رسمياً،`DESCENT_TOOLS`أطلقي الظهور وقرأي ما تغير في مجموعات الأغلبية
- اكتب اختبار يؤكد أن حجر الأداة يعتبر`ledger-x86_64-O1.o`و اختبار يثبت ما تفعله مع طاولة الفخ
- اكتب فقرة واحدة للدرس التي تقول، بكلمات الأداة نفسها، ما يسميه الشحن، المفكّك، و CFG.

النجاح يعني`python3 code/main.py`تقرير عن الوسيلة الجديدة في `captureTools`، كل وظيفة في`ledger-x86_64-O1.o`يحتفظ`allDescentToolsAgree`صحيح، والنتائج`sweep-trap.o`أخبرني ما فعله الأداة الجديدة مع البايتات `0x10`إلى`0x14`. . .

## درساً أساسياً

هذا الدروس يتضمن`outputs/skill-the-reverse-engineering-landscape.md`استخدمها لتشغيل العديد من الأدوات على أحد الأشياء التي قمت ببناءها ، وقلل عناوينها إلى قاعدة واحدة ، وذكر ، لكل وظيفة ، حيث يتفقون على إطلاق التعليمات ، والكتائب ، والحواف ، وما هو البايت كل أداة يخترا أو يفتقد. يتطلب ذلك التقاط مع الأوامر والإصدارات المسجلة ، و جدول رموز يقرأ من الملف ، وإصدار بيان عن الأدوات التي وصفت من الوثائق فقط.

## تحقق من ذلك

إشغال التجربة والسلسلة التحديدية:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

يجب أن تثبت التحقق:

- قراءة ELF يجد أربعة رموز وظيفة في `ledger-x86_64-O1.o`مع أحجام 16، 46، 31، و63، وفرق إطارات
- التوصل إلى الملاحظات 86, 56, 84 و 11 للأشياء الأربعة
- رادار2 و ريزين تقرير نفس التعليمات، الكتل، والحواف على `ledger-x86_64-O1.o`و فقط رادار2 لديه`pdc`النص
- علامات الغضب`sub_40003e`و`sub_40005f`كـ وظائف بدون رمز
- حجرات غيدرا للـ`total`هي الكتل الخمسة في الدروس 33 وتدفقات الدعوة ليست حواف الرسم البياني
- كل أداة مكان `grade`في التكافؤ`0x10`بعد إزالة قاعدته
- كل أداة تتفق على كل تعليمات تبدأ في كل وظيفة من `ledger-x86_64-O1.o`
- يبلغ البنّاء الأربعة من الرسوم البيانية عن 3، 3، 5، 4 كتلة و 2، 3، 5، 4 حواف هناك، مع مجموعات الحواف متطابقة
- `total`في`-O2`لديه 10 كتلة و 13 حافة في كل بناء الرسم البياني
- `grade`في`-O0`لديه 3، 8، 8، و 9 كتلة و 2، 11، 7، و 12 حافة في الرادار 2، ريزين، أنجر، و غيدرا، مع الأسباب في ملاحظات كل أداة
- `grade_label`في`-O0`هو كتلة واحدة في كل مكان باستثناء Angr، والتي تنتهي كتلة في المكالمة
- إنّ angr يختلق وظيفة واحدة لكل فجوة إدلاء زائد واحدة على طاولة الفخ، ولا يوجد أداة أخرى تختلق وظيفة أو تفوتها
- المكاسب البيضاء تبدأ`0x10`،`0x12`،`0x13`و يخسر`0x14`على الفخ، ولا يوجد بناء الرسومات تشكيل`0x10`إلى`0x14`
- النتائج تسمية النطاق المفقود في الرادار2 وكل وظيفة المخترعة في Angr
- يُسجل المخطط نسخة وأمر لجميع ملفات التقاط 21
- ثلاثة أدوات تفكيك `grade`و فقط غيدرا يضع لغة التقسيم
- يكتب المترجم CF، OF، SF، ZF، PF بحماس في نمط واحد و `cc_op`لا يوجد سجل لـ`cmp`، ولا يوجد أي علم`movslq`
- يرفض المترجم نماذج الذاكرة، وبرامج أخرى، وقطع REX إضافية، وطول خاطئة
- ترجمة المترجم `cc_op`الأرقام 8 و 7 تساوي تلك التي في VEX المقبوض عليها
- المرفقات التي تم القبض عليها تعطى 9, 1, 10 عمليات رمز P و 7, 4, 7 بيانات VEX للثلاثة تعليمات
- يمتد خط التوقيت من عام 1973 إلى عام 2026 بالتسلسل، ويتكون خط الأنابيب من ثمانية مراحل وست أدوات مع مصطلح في كل خلية، ويتم وضع علامة على الأدوات المغلقة كغير تعمل
- الرقم التفاعلي يضم نفس البيانات التي تنتجها الحزام

## أساليب فشل الإنتاج

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Raw addresses from different tools | "the tools disagree about where grade is" | one offset after each base is removed, checked on one function |
| Block count as a measure of code found | "Ghidra found the most code" | the same instruction starts, with the extra block explained by a label |
| One tool as the oracle | "objdump shows the table bytes are instructions" | the sweep is a linear sweep; three graph builders leave the bytes unclaimed |
| Padding functions counted as discoveries | "angr found seven more functions" | every one sits in a padding gap or on data, and none has a symbol |
| A stopped walk reported as dead code | "the four case blocks are unreachable" | 36 bytes missed by one tool and reached by three |
| Edge counts compared without the notes | "rizin and Ghidra disagree on grade" | the same four computed targets, one extra split at a label |
| A decompiler's arithmetic read as the program | "the function multiplies by 1717986919" | the idiom from lesson 34, folded by one tool and left by another |
| A closed tool described as if run | "Binary Ninja reports five blocks" | the figure and the table mark it as documentation only |
| Captures without commands | "we ran radare2" | the manifest with version, command, and date for every file |
| An IR with no flags read as a lossy lift | "VEX dropped the flags" | the thunk in `cc_op`, `cc_dep1`, `cc_dep2`, evaluated at the branch |

## قاعدة العمليات

التقاط كل أداة مرة واحدة مع إرادتها ونسخها، تقليل كل عنوان إلى قاعدة واحدة، ومقارنة التعليمات تبدأ قبل الكتل والكتل قبل الحواف. حساب لكل بايت كما ادعى، التدفق، البيانات، أو المفقود. قراءة ملاحظة أداة الخاصة قبل أن تحكم على عددها، وقول أدوات كنت فقط تقرأ عن.

## المزيد من القراءة

- [Cifuentes, "Reverse Compilation Techniques", PhD thesis, QUT (1994)](https://eprints.qut.edu.au/36820/)
- [Cifuentes and Gough, "Decompilation of Binary Programs", Software: Practice and Experience (1995)](https://doi.org/10.1002/spe.4380250706)
- [Van Emmerik, "Static Single Assignment for Decompilation", PhD thesis, University of Queensland (2007)](https://espace.library.uq.edu.au/view/UQ:158682)
- [Schwartz, Lee, Woo, Brumley, "Native x86 Decompilation Using Semantics-Preserving Structural Analysis and Iterative Control-Flow Structuring" (USENIX Security 2013)](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Yakdan et al., "No More Gotos" (NDSS 2015)](https://www.ndss-symposium.org/ndss2015/ndss-2015-programme/no-more-gotos-decompilation-using-pattern-independent-control-flow-structuring-and-semantics/)
- [Basque et al., "Ahoy SAILR! There is No Need to DREAM of C" (USENIX Security 2024)](https://www.usenix.org/conference/usenixsecurity24/presentation/basque)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Flake, "Structural Comparison of Executable Objects" (DIMVA 2004)](https://dl.gi.de/items/7f573931-cb51-49ef-a12c-0452a9fb0ea4)
- [Maranzano and Bourne, "A Tutorial Introduction to ADB", Bell Labs (1977)](http://squoze.net/UNIX/v7/files/doc/18_adb.pdf)
- [Stallman, KTH lecture on GDB entering distribution (30 October 1986)](https://www.gnu.org/philosophy/stallman-kth.html)
- [Hex-Rays, "IDA: celebrating 30 years of binary analysis innovation"](https://hex-rays.com/blog/ida-celebrating-30-years-of-binary-analysis-innovation)
- [Guilfanov, "Decompiler internals: microcode", Recon Brussels 2018 (slides)](https://www.recon.cx/2018/brussels/resources/slides/RECON-BRX-2018-Decompiler-internals-microcode.pdf)
- [Hex-Rays, microcode view and maturity levels](https://docs.hex-rays.com/core/decompiler/how-tos/microcode-view)
- [Hex-Rays, IDA 9.4 release notes](https://docs.hex-rays.com/release-notes/9_4)
- [Hex-Rays, IDA Free](https://hex-rays.com/ida-free)
- [Ghidra releases (12.1.4)](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Ghidra P-code reference](https://github.com/NationalSecurityAgency/ghidra/blob/master/GhidraDocs/languages/html/pcoderef.html)
- [Ghidra decompiler source, main work flow and Action classes](https://github.com/NationalSecurityAgency/ghidra/tree/master/Ghidra/Features/Decompiler/src/decompile/cpp)
- [Ghidra analyzeHeadless README](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md)
- [Binary Ninja, BNIL overview](https://docs.binary.ninja/dev/bnil-overview.html)
- [Binary Ninja, "Architecture Agnostic Function Detection in Binaries" (2017)](https://binary.ninja/2017/11/06/architecture-agnostic-function-detection-in-binaries.html)
- [Binary Ninja, batch processing and headless licences](https://docs.binary.ninja/dev/batch.html)
- [Binary Ninja 6.0 "Krypton" release post](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [Binary Ninja Free](https://binary.ninja/free/)
- [radare2 book, ESIL](https://book.rada.re/emulation/esil.html)
- [radare2 book, decompilers](https://book.rada.re/arch/decompile.html)
- [radare2 releases (6.2.4)](https://github.com/radareorg/radare2/releases)
- [rizin, RzIL design notes](https://github.com/rizinorg/rizin/blob/dev/doc/rzil.md)
- [rizin releases (0.9.1)](https://github.com/rizinorg/rizin/releases)
- [Announcing Rizin (8 December 2020)](https://rizin.re/posts/announcing-rizin/)
- [Cutter releases (2.5.0)](https://github.com/rizinorg/cutter/releases)
- [angr documentation, CFG recovery](https://docs.angr.io/en/latest/analyses/cfg.html)
- [angr documentation, the decompiler and its analysis passes](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [angr documentation, intermediate representation (VEX)](https://docs.angr.io/en/latest/advanced-topics/ir.html)
- [angr on PyPI (10.0.3)](https://pypi.org/project/angr/)
- [pypcode on PyPI](https://pypi.org/project/pypcode/)
- [llvm-objdump command guide](https://llvm.org/docs/CommandGuide/llvm-objdump.html)
- [GNU objdump manual](https://sourceware.org/binutils/docs/binutils/objdump.html)
- [LIEF documentation](https://lief.re/doc/stable/index.html)
- [Capstone releases](https://github.com/capstone-engine/capstone/releases)
- [BinDiff releases (v8, open source)](https://github.com/google/bindiff/releases/tag/v8)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [Hopper Disassembler downloads](https://www.hopperapp.com/download.html)
- [Compiler Explorer](https://github.com/compiler-explorer/compiler-explorer)
- [LLDB announced as an LLVM subproject (2010)](https://blog.llvm.org/2010/06/new-lldb-debugger.html)
- [Boomerang decompiler](https://boomerang.sourceforge.net/)
- [Tan et al., "LLM4Decompile" (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.203/)
- [Gao et al., "DecompileBench" (Findings of ACL 2025)](https://aclanthology.org/2025.findings-acl.1194/)
- [Liu, Raff, Micinski, "When LLM Decompilers Recompile More and Preserve Less" (2026)](https://arxiv.org/abs/2609.05370)
