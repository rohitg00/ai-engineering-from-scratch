# الأدلة والثقة والجهول في التحليل الثنائي

> اكتشاف حول برنامج مرتب هو سجل مع الاختبار، الثقة، السلطة، و قائمة من ما لا يمكن أن يظهر.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## أهداف التعلم

- بناء سجل دليل على النموذج من REAL`Evidence`مع الاعتقاد الملاحظ والمستحوذ والإستنتاج
- احسب هاشات المحتوى التي تبقى نفسها عندما ينتقل الملف إلى مجلد آخر.
- تسجيل ما لا يمكن لكل مزود أن يظهر كقيود التي تسافر مع السجل.
- رفض إعلان النتيجة حتى تدعمها تشغيل الملاحظ للعمل.
- حفظ البقايا غير المعروفة كسجلات مراجعة يضمها سلسلة الهاش.
- مزود الاحتفاظ بالإجابة تحت مفتاح دقيق ورفض إعادة تشغيل قديم.

## المشكلة

سألت عميل ماذا`grade`في`ledger-x86_64-O1.o`يعود الوكيل لدرجة 55، يتصل rea، يقرأ رمز Ghidra، ويرجح 0.`uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`البايتات في تلك النقطة تقول`xor eax, eax`. . .

يُنتج التعليمات والعبرة كلتا 0 لكل إدخال. لم يكن العامل يعلم ذلك. كان يثق بالنص لأنه أداة أنتجته. أجريت دراسة عام 2026 على ثلاثة عملاء على 24 مهمة هندسة عكسية ([NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)وقد أعلنت الدراسة عن أربع نقاط ضعف متكررة: تحيز التدريب، والثقة المفرطة في الملاحظات، والحدود السياقية، ومواصلة الخطة. وقد وضعت دراسة أخرى عام 2026 النص داخل النصوص الثنائية ووجدت أن النماذج قد اقترحت العمل غير الآمن في 35 من أصل 40 حالة ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507))

rea 6.5.0 يعطي الوكيل ذخيرة لغوية لهذا. كل مكالمة أداة ناجحة تنتج واحدة `Evidence`سجل مع `confidence`من`observed`،`derived`أو`inferred`، و`authority`و قائمة`limitations`. المهارة المعبأة تخبر العميل: "كل نتيجة يجب أن تميز الملاحظات، الاستنتاجات، وغير المعروفة. اقتباس هويات الأدلة، الحفاظ على القيود والغطاء غير الكامل، ولا يعني أبدا أن التحليل الدولي لاحظ التنفيذ".

ثلاثة أشياء تترك لك rea. تحفظ صورها الفورية نتائج الاستفسار الدقيقة ، وليس التحليل. تتم إثباتها بمطالبة عندما لا يتغير بعدة مقارنة ، وتقول تعليقها الخاص أن المرور "لا يضع تعادل تنفيذ عالمي. " يأخذ دفتر التزامها المرشحين فقط من جاوا سكريبت وجرافات مدروسة ، لذلك لا يصل وظيفة محلية أبداً`verified`عبرها

هذه الدروس تبني الجزء المفقود في بيثون البسيط. أنت تكتب دفترًا كبيرًا يحتوي على كل حقائق حول العضو كسجل مع hash المحتوى. أنت تقوم بتنبؤات حول`percent_change`و`grade`و تُستورد سجلين حقيقيين و اللقطة الفورية التي جاءوا منها، و يقوم دفترك الرئيسي بإعادة حساب كل رسالة hash rea كتبت.

```figure
re-evidence-ledger
```

## ثلاث كلمات لثقة وخمسة لسلطة

`confidence`هو عدد مع ثلاثة قيم، أبدا رقم. `authority`عندما لا يقول المنتج شيئاً، يستخدم`shipped-artifact`مع`observed`. . .

| Value | Meaning on the fixture | Records in this lesson |
|---|---|---|
| `observed` | A fact read from bytes or from a run | the ELF reader's section and symbol reads, the two Ghidra records, 17 host runs |
| `derived` | A fact computed from observed records | the switch table model, the division model, every unknown mutation |
| `inferred` | An expectation that no observation states yet | 18 predictions |
| `shipped-artifact` | The file on disk was the source | every read of `ledger-x86_64-O1.o` |
| `controlled-replay` | A run you controlled produced the fact | the host runs of `harness.c` |
| `analyst-inference` | Your own judgement | predictions and unknown mutations |
| `historical-reference` | An older source tree or document | none here |
| `external-service` | A service outside the file and the host | none here |

اثنين من الخلطات تكلف أكثر من الوقت. الأول يعامل الرمز السوداني كملاحظة للسلوك. إنه ملاحظة لما طبعته غيدرا. الثاني يعامل قائمة فارغة كدليل على غياب. ملاحظة تصميم rea صارمة: "التغطية المفقودة غير معروفة، وليس غياب. "`code/main.py`يرمز كلا القواعد

## السجل

سجل لديه بالضبط 16 حقل، و 6.5.0 رفض أي حقل آخر. `code/main.py`تحتفظ بنفس الأسماء التي يستخدمها ريا، لذا سجل من كلا الجانبين يؤكد على الآخر.`relationship_coverage`، يظهر كم عدد المُتصلين أو المُدعوين كامل.`complete`،`partial`أو`unknown`أو`null`عندما لا تُبلغ العملية عن أي اتصال

| Field | What it holds |
| --- | --- |
| `evidence_id` | `ev_` and 64 hex digits, a hash of the content |
| `subject` | `name`, `digest.sha256`, `format`, `architecture`, `local_path`, or `null` |
| `provider` | `id`, `name`, `version` or `null` |
| `analysis_profile` | the provider's settings and their digest, or `null`, always present |
| `predicate_type` | a tag, `rea.analysis` by default |
| `operation`, `parameters` | the tool and its input |
| `raw_result`, `normalized_result` | provider output and the canonical result |
| `confidence`, `authority` | the enums above |
| `environment` | `id`, `platform`, `architecture`, `isolation`, or `null` |
| `limitations` | plain sentences |
| `relationship_coverage` | `status` `complete`, `partial`, or `unknown` with diagnostics, or `null` |
| `locations` | `address`, `address-range`, `artifact-path`, `file-offset`, `file-offset-range` |
| `evidence_links` | the `ev_` ids this record rests on |

هذا هو السجل الحقيقي الذي كتبته ريا`grade`، وقطع إلى الحقول التي تهم هنا`code/fixtures/rea-evidence-grade.json`، 37،573 بايت

```json
{
  "evidence_id": "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1",
  "subject": {
    "name": "ledger-x86_64-O1.o",
    "digest": { "sha256": "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f" },
    "format": "elf",
    "architecture": "x86_64",
    "local_path": "/private/tmp/aiefs-re/phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures/ledger-x86_64-O1.o"
  },
  "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
  "analysis_profile": {
    "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
    "parameters": { "jump_table_evidence": "typed-case-default-blocks-v1", "import_mode": "ephemeral-source-immutable" },
    "digest": "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
  },
  "operation": "analyze_function",
  "parameters": { "procedure": "grade" },
  "confidence": "observed",
  "authority": "shipped-artifact",
  "environment": null,
  "limitations": [
    "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>.",
    "Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals."
  ],
  "relationship_coverage": {
    "status": "complete",
    "diagnostics": [
      "Only resolved Ghidra call references are returned; unresolved computed or indirect calls remain unknown, while function classifications distinguish thunks and externals."
    ]
  },
  "locations": [],
  "evidence_links": []
}
```

الحقيقي`parameters`الملف المُلف يحتوي على 25 مفتاحاً.`limitations`القائمة لديها عشر جمل. احتفظ بها. الحد هو جزء من المحتوى، لذلك إلقاء واحد يغير الهوية، وسوف دفتر الكتب الخاص بك بعد ذلك رفض السجل.

لاحظ ما لا يخبرنا به السجل.`environment`هو`null`لأن (غيدرا) قرأ ملفاً ولم يجد شيئاً`locations`هو فارغ لأن هذه العملية تقارير العناوين داخل `normalized_result`. .`relationship_coverage`لديه الوضع`complete`. تشخيصها يقول أن إشارات المكالمة الحلّة فقط هي التي يتم إرجاعها، وأن المكالمات الحاسوبية أو غير المباشرة غير الحلّة تظل مجهولة. لذا فإن قوائم المكالمين والمكالمات كاملة للمكالمات الحلّة فقط.

## الهوية هي حش من السعاده، والطريق ليس فيها

الحوسبة الحقيقية`evidence_id`كـ`ev_`بالإضافة إلى SHA-256 على RFC 8785 JSON القنوني من مشهد من السجل.`digest`،`format`و`architecture`وقطرات`name`و`local_path`- إنّه ينزلق`relationship_coverage`عندما تكون قيمتها`null`، لذا سجل بدون علاقات المكالمة يحافظ على نفس الهوية التي كانت بها قبل وجود الحقل. كل شيء آخر، بما في ذلك`raw_result`وكل قيود، يتم تحديدها

يقوم RFC 8785 بتنظيم مفاتيح الأشياء ، وإزالة الفضاء الأبيض ، وتصنيع أشكال الأرقام والسلسلة. بالنسبة للسجلات التي تكون أرقامها عدداً صحيحاً ، تنتج مكتبة Python القياسية نفس البايت:

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py`يرفض العائدات قبل أن يضخ، لأن RFC 8785 و Python طبع بعض العائدات بشكل مختلف. السجلين rea والتصوير الفوري لا تحتوي على أي العائدات، لذلك الوصفة تعيد كل hash rea:

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

لماذا استبعاد المسار؟ نفس الملاحظة من نفس البايتات تحصل على نفس الهوية على أي آلة وفي أي مجلد.`local_path`في القائمة أعلاه أسماء المجلد على جهاز Mac واحد. لا يتغير الهوية عند نسخ الجهاز إلى `/home/you/re`. .`rebind_subject_path()`يسمح لك بإظهار سجل تحت مسار جديد.`sha256`،`format`أو`architecture`يختلف.`rebindEvidenceToTargetPath`عندما يعيد تشغيل سجل لقطة لهدف في مسار جديد.

`validate_evidence()`يعيد حساب الهوية ويرفض عدم مطابقة مع جملة "الادلة المعرفية المفصلة لا تتطابق مع سجلها"`analysis_profile.provider`يختلف عن الـ`provider`- الاختبار`test_tampered_id_and_mismatched_profile_are_rejected`يُحَرّر سطر واحد من الرمز الخفيف داخل الفيديو الحقيقي `grade`سجل ومشاهدة دفتر التسجيل رفض ذلك.

## لاحظوا الشيء بنفسك

قبل أي مزود، يقرأ الكاتب الملف.`observe_object()`يدرس عناوين القسم ELF64, `.symtab`،`.strtab`و`.rela.text`مع`struct.unpack_from`- يكتب واحد`inspect_object`سجل و واحد `read_function_bytes`سجل لكل رمز وظيفة. كل خمسة هي`observed`مع السلطة`shipped-artifact`، لأن المصدر كان الملف على القرص

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t`يوافق: `grade`في`0000000000000010`مع حجم`2e`. ثلاث عمليات نقل في`.rela.text`هل هي`R_X86_64_PC32`ضد`.rodata`في التكافؤات`0x36`،`0x84`و`0x93`، مع إضافات`0x10`،`0x24`و`-0x4`كل سجل يحمل رقم`file-offset-range`الموقع والقيود الواحد: "تقرأ البايتات من القسم من الملف على القرص. القارئ لا يطبق أي نقل ولا يعمل أي رمز".

الدرس 32 يبني القارئ بالكامل. هنا هو 60 سطر، لأن هذا الدرس يتعلق بما تسجل عن القراءة.

## استنتاج الجدول، وقول أنك استنتاجته

الـ 46 بايت من `grade`تحتوي على أربعة أنماط التي فك الدروس 33:

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

مضاعفة بـ `0x66666667`يليها تحويل من 34 هو تقسيم موقّم بـ 10. الملف يحمل رقم 10.`derive_grade_model()`يكتب هذا الحقيقة كحد: "مقسم 10 هو مشتق من المضاعف 0x66666667 والتحول 34. الملف يحمل رقم 10. "

- نعم`add ecx, -6`يضع الحالة الأولى إلى 6.`cmp ecx, 4`مع قفزة غير موقعة يعترف خمسة قضايا، 6 إلى 10.

- نعم`lea`في`.text+0x33`يُحمل الإنتقال مع إضافة`0x10`. PC32 تدير عمليات نقل من نهاية التنقل البايت 4، لذلك تبدأ الجدول في `.rodata+0x14`خمسة كلمات صغيرة من القراءة`1, 2, 3, 4, 4`- المفتاح في`ledger.c`يعود 1 ل 60 إلى 69, 2 ل سبعينات، 3 ل الثمانينيات، و 4 ل 90 إلى 100. قام المجمع بتحويل المفتاح إلى جدول بحث من القيم العائدة.

السجل الناتج`ev_605106bff2d9998f…`- نعم`confidence` `derived`، و هو`evidence_links`اسم السجلين الملاحظين الذي يتوقف عليه. إزالة سجل البايتز من دفتر التسجيل والسجل المشتق له رابط متعلق. الرسم أعلاه يظهر هذه الحالة عندما تقوم بتعطيل`ev_a467c242…`. . .

الآن مقارنة مع غيدرا، رمزها السيدو للعمليات نفسها:

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

جيدرا قام بتنفيذ عملية الإنتقال وسمّى الجدول`DAT_001000b4`، وهو`.rodata+0x14`بعد وضعها`.text`في`0x100000`. استعاد القسم بال 10 والحالات الخمسة. للقيمة الافتراضية طبعت تعبيرًا هو 0 دائماً ولا يقول أبداً 0.`native_value_flow`يُعَلِّم هذه العمليات `is_dead: true`السجل هو ملاحظة صادقة من غيده، والمعنى الذي تقرأ منه مشتق، والقيمة التي تتوقعها من ركض يتم استنتاجها.

- نعم`percent_change`السجل يظهر الفشل الآخر توقيع غيدرا يقرأ`undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`المصدر يقول`int percent_change(int before, int after)`. .`idiv`يكتب`EDX:EAX`، و سلك الصفر يترك`EDX`غير متأثر، لذا قام المُفكّر بإستنتج عودة 16 بايت وبرامج ثالثة.`native_api.return_type.confidence`لـ`grade`هو`"low"`. اعتبر توقيعًا تم استعادته استنتاجًا للمقدم ، واكتبها بهذه الطريقة

## التنبؤات هي سجلات

التنبؤ هو ادعاء حول السلوك الذي لم يظهر أي ملاحظة. `claim_suite()`يُبني ثمانية عشر منها من النماذج المستمدة ومن المصدر. `record_prediction()`تخزن كل واحد كسجل مع `confidence` `inferred`و`authority` `analyst-inference`، مرتبطة بالسجلات التي تستند إليها

| Claim | Predicted value | Rests on |
|---|---|---|
| `percent_change(12400, 15500)` | 25, from 310000 / 12400 | division model `ev_076a9167…` |
| `percent_change(0, 5)` | 0, the zero guard | division model |
| `percent_change(100, 50)` | -50 | division model |
| `percent_change(-7, 3)` | -142, because `idiv` truncates toward zero | division model |
| `grade(55)` | 0, index -1 fails the unsigned compare | table model `ev_605106bf…` |
| `grade(60)`, `grade(69)` | 1, 1 | table model |
| `grade(70)`, `grade(85)` | 2, 3 | table model |
| `grade(95)`, `grade(100)`, `grade(105)` | 4, 4, 4 | table model |
| `grade(110)`, `grade(-5)` | 0, 0 | table model |
| `total(1, 2, 3)`, `total()` | 6, 0 | source record `ev_2f1e6d25…` |
| `grade_label(85)` | `"B"` | source record and table model |
| `grade(score)` for 90 to 100 | 4 for all eleven inputs | table model |

`predict()`يستخدم المفاهيم C، وليس المفاهيم Python. `c_div()`يختصر نحو الصفر، و`wrap32()`يطوي كل متوسطة إلى 32 بت.`//`الجولات نحو اللانهاية السلبية، لذلك `(3 - -7) * 100 // -7`يعطي -143 وبرنامج C يعطي -142. الدروس 36 يجعل هذه الشبكة أكبر بكثير.

كل تنبؤ يفتح بقية مجهولة.`observed`دليل مع السلطة`controlled-replay`و يوصي بمسح واحد:`execute_function`على بناء المضيف. القسم التالي ينتج هذا الدليل. يسأل السؤال لمتطلب الصف الأول "هل تصفية ((95) == 4 تحافظ عندما تعمل الوظيفة المجمعة؟"

## تحقق منهم من السباق

`code/fixtures/harness.c`يشمل `ledger.c`ويقوم بطبع نتيجة واحدة لكل دعوة`observe_runs()`يجمعها مع أول من `clang`،`cc`أو`gcc`على طريقك وتشغيل كل مدخل في الشبكة مرة واحدة. كل جولة تصبح سجل واحد:

```json
{
  "operation": "execute_function",
  "parameters": { "function": "grade", "args": [95] },
  "normalized_result": { "result": 4, "stdout": "4\n", "exit_code": 0 },
  "confidence": "observed",
  "authority": "controlled-replay",
  "environment": { "id": "host-process", "platform": "darwin", "architecture": "arm64", "isolation": "process" },
  "limitations": [
    "The run executed a host build of ledger.c, not the x86-64 object. The claim about the object rests on the shared source and on the compiler.",
    "One run observes one input. It proves nothing about other inputs."
  ]
}
```

موضوع سجل تشغيل هو ثنائي الحزام، ملف Mach-O arm64 على هذا ماك، مع SHA-256 الخاص به.`course-harness`مع خط نسخة المُجمّع، هنا `Apple clang version 17.0.0 (clang-1700.6.3.2)`- المُؤمنون`evidence_links`اسم سجل المصدر `ev_2f1e6d251543d017…`، لأن الجري والجسم يتشاركون`ledger.c`ولا شيء آخر

قراءة الحد الأول مرتين. لم يتم تشغيل كائن x86-64 على هذه الآلة. ما تم تشغيله كان بناء ثان من نفس المصدر لمهندسة معمارية أخرى. هذا ما زال ملاحظة، وهو أقوى واحد متاح دون محاكاة، لذلك يمر المطالبة مع هذه الجملة المرفقة. تقرير يفقده فقد المعلومات التي يحتاجها القارئ.

17 مدخل واحد يوافقون على التنبؤات`code/fixtures/run-evidence.json`يحتفظ بهذه السجلات الـ 17 و سجل المصدر ، يتم تصديرها مع `--record`في 2026-10-13. عندما لا يوجد محفز،`build_ledger()`ويقول التقرير ذلك في تقريره`runs`المجال

## قواعد الترقية

يتحرك المطالبة من المستنتاج إلى المُدعم فقط من خلال عمليات الملاحظة. `check_claim()`يبحث عن`execute_function`تسجل نفس الوظيفة والحجج، وتقارن كل نتيجة مع التنبؤ، وتحسب المدخلات المغطاة:

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()`هو الشكل الصارم.`ClaimError`عندما يكون أي هوية`inferred`أو`derived`يُثير عندما يطلق اسم id على سلسلة من وظيفة أخرى أو من حجج أخرى. يُثير عندما تكون القائمة فارغة، وعندما تغطي الرحلات أدخلاً أقل من المطالبة. سجل رمز غيدرا السيدو كود ونموذج الجدول موجودان لـ`grade(55)`ولا يمكن أن يروج لها إطفئ`ev_7be90c0c…`في الرسم وشاهد انخفاض المطالبة إلى `unsupported`بينما سجلين حول`grade`البقاء

يظهر ادعاء المدى الحالة الجزئية. فقط اثنان من مدخلاته الحادية عشر، 95 و100، تظهر في شبكة التشغيل. `check_claim()`العائدات`unknown`مع`covered`2 من 11 ، و `promote_claim()`رفض مع "2 من 11 مدخلات قد لاحظت الجري".

`completion_ledger()`مرآة ريا`EvidenceCompletionLedger`هو هو`ecl_`بالإضافة إلى الـ "هاش" من سجلاته، و`complete`صحيح فقط عندما`pass`متساوية`total`. بصمات التجربة`ecl_da64933ea13befed…`مع`complete: false`، بسبب هذا المطالبة المدى الواحد

## المجهولات هي سجلات مع سلسلة هاش

تُخزن rea بقايا غير معروفة كسجل صارم. `code/main.py`يحتفظ بنفس الحقول والخيارات المتغيرة

الهوية هي`unk_`+ SHA-256 فوق `{domain, question, scope_digest}`و مع انهيار الفضاء البيضاء للأسئلة إلى فراغات فردية. تحليلين يسألون نفس السؤال عن نفس الملف يحصلون على نفس الهوية.`scope_digest`هو SHA-256 من الكائن.

كل تغيير هو مراجعة جديدة.`previous_revision_digest` `null`كل مراجعة لاحقة تسمي`revision_digest`من قبلها، والحذف يغطي كل حقل إلا نفسه.`verify_unknown_chain()`يمر قائمة ويعيد حساب كل إعادة. يُحقق من أن كل رابط يشير إلى الإصلاح السابق. يُحقق من أن أدلة الطفرة لكل أسماء الإصلاح موجودة في دفتر التسجيل.

كل طفرة هي نفسها سجل دليل، كما هو الحال مع المقدم `rea-unknown-registry`. حمولاتنا`confidence` `derived`،`authority` `analyst-inference`و لا يوجد موضوع، ويقول حدوده "التحولات السجلية تسجل ما قرر المحلل، إنها ليست دليل على الإجابة".

لهذا السبب تتضمن سجلات الديمو 81 سجلات طفرات مشتقة 36: 18 فتحة و 18 تحديث.

يتم فرض ثلاثة ثنائيات على كل مراجعة:

- فقط`resolved`لا يعرف يحمل`resolution`، و فقط الإصلاح 1 ليس لديه سلف
- أ`contradicted`أسماء مجهولة على الأقل هوية واحدة تتناقض، ولا يوجد هوية في كلتا القائمين.
- أ`verified`تحديد اسم واحد على الأقل من أشكال الأدلة التي تتمتع بالثقة والسلطة المطلوبة.

القاعدة الثالثة هي حيث يرفض دفتر التسجيل في أغلب الأحيان. ملاحظات سير العمل في rea تقول "لا يمكن إلا التحقق من الأدلة الملاحظة المؤهلة التحقق من القرار". `resolve_unknown()`ولهذا السبب يرفض نموذج الجدول، يرفض سجل مراقب مع السلطة`shipped-artifact`، ويقبل سجل الجري`ev_f4ffbe8f922ec7fe…`. الإصلاح المقرر لـ`grade(95)`هو مراجعة 2، و `previous_revision_digest`هو`ffca840b55a8a188…`، إعادة النظر 1

`update_unknown()`يأخذ`expected_revision`و يرفع`revision-conflict`عندما يكون قديمًا، كما هو الحال`update_unknown`رد فعل صحيح هو أن ملاحظات ريا تعطى: إعادة قراءة مراجعة الحالية وقرار مرة أخرى.

واحد غير معروف يبقى مفتوح بعد التجربة:`unk_f2eb0d7f84c80a19…`هل تصنيف ((نقطة) == 4 لكل نقطة من 90 إلى 100 تحتفظ عندما يتم تشغيل الوظيفة المجمعة؟ وضعها هو `investigating`، وتشمل أرقامها الداعمة الجريتين، ولا تزال صنعتها تسمي التسعة المدخلات دون جري.

## مخزن الإجابات ليس قاعدة بيانات للتحليل

في الواقع، هناك ثلاثة أشياء تبدو مثل التخزين.`-readOnly -deleteProject`و تم حذفها في وقت قريب`AnalysisSnapshotCache`يحتوي على ما يصل إلى 10،000 إدخال لتحديد هوية ثنائية واحدة. الملف الفوري يحتوي على `target`،`binding`،`entries`،`workflow_entries`و`evidence_bundle`. . .

مفتاح التخزين هو`query_`+ SHA-256 فوق `{target, binding, operation, parameters}`. .`target`هو`{sha256, kind, format, architecture}`و`raw-binary`الهدف أيضاً`entry_point`. .`binding`هو المقدم وكل ملف التحليل، ومضمنة التهليل. تغيير أي من 25 ملف ملف، على سبيل المثال `jump_table_evidence`من`typed-case-default-blocks-v1`إلى`v2`ويتغير الهضم، لذا كل مفتاح يتغير.

`code/fixtures/rea-snapshot.json`هو الملف الذي كتبه rea خلال الإجراءات الثنائية، 142,690 بايت. كتبه rea مع الإذنات المالكة فقط، والنسخة الملتزمة يمكن قراءتها من قبل الجميع.`AnswerCache.import_snapshot()`يعيد حساب كل واحد`query_id`و يرفض الملف عندما يختلف أي.`target`أو`binding`يختلف عن النشطة، مع صياغة rea `profile_mismatch`. يرفض صورة`format_version`ليس كذلك`course-answer-cache-1`. . .

ثلاثة قياسات من هذه الآلة.`grade`استغرق استفسار 8.6 ثانية، مع استيراد جديد Ghidra.`percent_change`استغرق استفسار ضد نفس اللقطة الفورية 8.5 ثانية، لأن استفسار مختلف هو خطأ التخفيض.`grade`استغرق الاستطلاع 2.1 ثانية وعاد السجل نفسه مع نفس `evidence_id`. إعادة تشغيل في الذاكرة في rea يضيف الحد "حملت من صورة تحليل REA محلية؛ هذه المكالمة لم تعيد تشغيل المقدم. "`lookup()`يضيف جملة من نفس النوع، حتى القارئ يمكن أن تعرف التكرار من إجابة جديدة.

ينتهي الطفرة الاحتفاظ بالخزنة. في rea 6.5.0، يتم إعادة تسمية أو تعليق تطهير الاحتفاظ بالقطة اللقطية قبل أن ترسل rea المكالمة إلى المقدم. لا يمكن أن يثبت رد فشل أن الكتابة قد تم إعادة التدوير، لذلك توقف الكتابة الفاشلة أيضًا عن التردد. يقوم استيراد البيانات المعدنية التي تغير قاعدة البيانات بنفس الشيء.

## لماذا العميل يحتاج هذا

وكيل الذي يدير " ريا " عبر " ميكب " يرى السجل الكامل في كل مكالمة ويمكن أن يقتبس`evidence_id`في تقريرها. يوضح البحث من عام 2026 أين يذهب ذلك خطأ. كان الثقة المفرطة في إنتاج الأدوات أحد نقاط الضعف الأربعة في دراسة NDSS BAR. في دراسة النص المزرع، التي أظهرت المحتوى الثنائي على أنه البيانات وحدها ما زالت تترك 15 مقترح غير آمن من 40، وتحققات المصلحة مع تصريح الأدوات أزالتهم. دراسة ثالثة شاهدت وكيل يقود Ghidra من خلال MCP ([arXiv 2606.06838](https://arxiv.org/abs/2606.06838)في المجموعات الثنائية التي لديها مئات الوظائف، فقط 10 إلى 15 في المئة حصلوا على التحليل الحقيقي قبل أن ينتج العامل القطع.

يرد دفتر التسجيل على كل هذه السجلات، ويقول الوكيل فقط ما يحتوي عليه دفتر التسجيل.`unsupported`. دعوة مع بعض الركضات هو`unknown`رسالة الموردة هي`observed`عن المزود ولا شيء آخر أعط العميل ملف المهارات`outputs/`و جعل هذا الكتاب المكان الوحيد الذي يكتب فيه الاستنتاجات هذا ينطبق على كلود، كورسور، كودكس، أوبين كلوا، هرمز، أو أي وكيل يقرأ SKILL.md

## بناءها

أطلق عرض المكتبة القياسية:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
```

يقرأ الديمو الكائن، ويستورد سجلين حقيقيين، ويتحقق من اللقطة الفورية الحقيقية، ويستمد النماذج. ثم يسجل 18 تنبؤًا، وفتح 18 مجهولاً، ويجمع ويمارس الحزمة، ويتحقق من كل ادعاء، ويحل 17 مجهولاً. شكل متوقع:

```json
{
  "records": 81,
  "by_confidence": { "observed": 25, "derived": 38, "inferred": 18 },
  "rea_snapshot": { "entries": 2, "replay_hit": true, "stale_profile_refused": true },
  "grade_table": [1, 2, 3, 4, 4],
  "runs": "live: Apple clang version 17.0.0 (clang-1700.6.3.2)",
  "claims": [ { "claim_id": "grade(95)", "status": "pass", "covered": "1/1" }, { "claim_id": "grade(90..100)", "status": "unknown", "covered": "2/11" } ],
  "completion_ledger_id": "ecl_da64933ea13befed9483f8b00447bb3f4ceb74324c01e2515eff03f3af3ca750",
  "complete": false,
  "unknowns": { "resolved": 17, "investigating": 1 }
}
```

بدون مُجمّع "سي"،`runs`يقرأ`imported 17 recorded run records from run-evidence.json`والباقي هو نفسه.

اقرأ`code/main.py`في هذا الترتيب:

1. `canonical_json()`و`compute_evidence_id()`إحتفظ بإصدار الـ "هاش" والتنبيهات التفاصلية
2. `create_evidence()`و`validate_evidence()`بناء وتحقق من سجل.
3. `EvidenceLedger.record()`و`import_bundle()`تخزين السجلات ورفض النزاعات.
4. `open_unknown()`،`update_unknown()`و`resolve_unknown()`إبق سلسلة الإصلاح
5. `observe_object()`يقرأ ELF، و `derive_grade_model()`يقرأ الطاولة
6. `claim_suite()`،`predict()`و`record_prediction()`اكتب المستوى المستنير
7. `observe_runs()`يُحوّل كلّ إطارٍ من السلاح إلى سجلٍ مراقب.
8. `check_claim()`،`promote_claim()`و`completion_ledger()`تطبيق قواعد الترويج.
9. `AnswerCache`المفاتيح تجيب مثل صور ريا و ترفض تلك القديمة.

## استخدمها

ضع سجل واحد لكل هدف و لكل تحقيق ضع SHA-256 للهدف في كل موضوع و إضافة نطاق السؤال في كل مجهول عندما تغير الأدوات`provider`عندما تقوم بإعادة بناء الملف، يتغير الموضوع وكل سجل قديم يصبح دليل على ملف آخر

اكتب القيود في اللحظة التي تعرفها فيها القارئ الذي لا يطبق أي نقل يقول ذلك. تشغيل بناء مضيف يقول ذلك. النموذج الذي يستدل على مقسم يقول ذلك. سجل مكتوب دون قيودها يبدو أقوى من الحقائق تسمح، والقارئ لاحقا لا يمكن إصلاح ذلك.

تعامل كل نص مزود كبيانات. السلاسل والرموز السودية من الهدف هي نص يسيطر عليه الهدف.`_meta.provenance.untrusted_content: true`تُخبر تعليمات الخادم النموذج بمعالجة المحتوى المستهدف على أنه بيانات وإبلاغ أي طلب فيه لتشغيل أو تثبيت أو تنزيل أو إرسال شيء كحاولة حقن سريع. يساعد العلامة، ولكن يجب على دفترك الكبرى إبقاء النص المستهدف خارج التعليمات.

## المختبر التفاعلي

### المختبر (أ): إعادة حساب الهوية الحقيقية

من`code`الإرشادات، مفتوحة Python:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

أركض

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

المقارنات الأولى صحيحة. المسار ليس في الهاش. الثالث غير صحيح، لأن الحد يحتوي.

### المختبر ب: رفض الترقية

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

الطلب يطلع`ClaimError`و اسم الهوية المستمدة. الآن مرر الهوية التشغيل:

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

الوضع هو`pass`و العائدين`limitations`تحمل عقوبة بناء المضيف.

### المختبر "ج" رفض صورة سريعة

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

الإقرارات الأولى للدخل الثانية`CacheError`مع`profile_mismatch`. تغيرت سلسلة نسخة واحدة، و يتم رفض الصورة الفورية بأكملها.

### المختبر (د): كسر السلسلة

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

المكالمة الأولى تعود، والثانية ترتفع`EvidenceIntegrityError`، لأن المراجعة 1 لم تعد تتطابق مع المراجعة الخاصة بها والمتراجعة 2 نقطة في المراجعة التي لم تعد موجودة.

## مختبر التدريب

أغلق المفتوح غير معروف وأضف مزودًا آخر.

المتطلبات:

- التمديد`run_grid()`إذاً، فإنّ الدخولات المفقودة التسعة التي تظهر في الدعم، ثمّ تأكيد التحركات المجهولة إلى`resolved`في المراجعة 3.
- إضافة`llvm-objdump -d`كمقدم ثان مع خاصته`provider`الاعتراض و تسجيل إدراجها في قائمة `grade`كـ`observed`. . .
- اكتب`derived`سجل يذكر القائمة، غيدرا و llvm-objdump، فك تشفير نفس 14 تعليمات، وربط كل منهما.
- افتح شخص مجهول`grade_label(105)`بشدة`high`، حيث أن المؤشر الرابع يقرأ `labels[4]`و أنتهى الأمر بالركض
- إصدار دفتر التسجيل مع `export_bundle()`، و إدخاله إلى دفتر جديد و إثبات أن كل سلسلة ما زالت تثبت

النجاح يعني تقرير يذكر فيه كل جملة هوية من الحزمة والتي`unknown`لقد اختفت المطالبة

## المختبر المعدل

خمس أسئلة حول أجهزة هذا الدروس. ابحث عن كل إجابة مع الرمز الذي بنيته، ثم اكتبها في`code/lab_answers.json`. اكتب الأرقام بأرقام أو بأسلسلسلة شماسية مثل`"0x40"`، والقوائم كقوائم JSON.

1. `t1`: هو دليل ID الذي يقدمها compute_evidence_id للدقة في درجة الأدلة.
2. `t2`: عدد القيود في سجل الدرجة.
3. `t3`: حالة علاقة_غطاء سجل الدرجة.
4. `t4`: الثقة والسلطة في سجل الدرجة، كقائمة من سلسلتين.
5. `t5`: SHA-256 من موضوع السجل الدرجة.

تحقق من إجاباتك:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
npx tsx code/lab.ts
```

يقوم المحقق بحساب كل قيمة متوقعة من `code/main.py`على الأجهزة المشتركة.`PASS`،`FAIL`أو`TODO`لكل مهمة و نسبة، و يخرج من 0 فقط عندما يمر الخمسة`python3 code/lab.py my-answers.json`يبحث عن ملف آخر`code/tests/test_lab.py`يثبت أن المحقق يقبل الإجابات الصحيحة ويرفض الإجابات الخاطئة.

### أشاهدها تسير

- نعم[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off)يحتفظ الآلة بسجل دليل مع أربعة صناديق: الملاحظة، المستمدة، المستنشرة وغير المعروفة. يفتح هذا الرابط الجدول مع إيقاف جدول الرمز، وبالتالي فإن اسم ومكملة ملف الوظيفة غير معروفة وملفات البدء كما يتم استنتاجها.

## درساً أساسياً

هذا الدرس يُنتج`outputs/skill-evidence-ledger.md`يخبر الوكيل كيفية كتابة كل اكتشاف كسجل مع الثقة والسلطة والقيود والروابط.`pass`،`fail`،`unknown`أو`unsupported`. . .

## تحقق من ذلك

إشغال التجربة والسلسلة التحديدية:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

الاختبارات الـ 28 تثبت:

- كلاهما حقيقي`evidence_id`القيم، و الملفات الموضعية، وكلاهما الصورة`query_id`القيم تعود إلى الحساب من المحتوى
- مسار تغيير يحافظ على الهوية وتغيير الحد تغيرها
- يتم رفض سجل مُتَعَدَّد، ومُقدِّم ملف مُختلف، ومُعَدَّد، وقيمة enum غير معروفة
- إرجاع سجل مزدوج `duplicate`، وارتفاعات السجل المتناقضة، و استيراد مجموعة هو الذرية
- المجموعة المُسجلة من الواردات التي تم تسجيلها مع 18 سجلًا وبدون روابط متعلقة
- لا يعرف يفتح عند مراجعة 1 ، يرفض إيقاف`expected_revision`و يُحلّ فقط مع الملاحظة`controlled-replay`الأدلة
- إصدار تحرير يكسّر السلسلة
- يرفض الترويج أدلة استنتاجية ومستمدة فارغة وغير مرتبطة، ويجري مع إجراء متفق
- التغطية الجزئية هي `unknown`و (الجهاز) غير متفق عليه`fail`
- الاحتفاظ بالمساحة الزمنية يضرب المفتاح الدقيق ويغيب عن المعلمات الأخرى
- الاحتياطي الاحتياطي يرفض نسخة ملف تعريفية متضايقة، هدف خاطئ، نسخة في شكل خاطئ، ومفتاح تعديل
- يوافق قارئ ELF`llvm-objdump`على التداولات والحجم والبايتات والتحويلات، والجدول يقرأ `1, 2, 3, 4, 4`
- التنبؤات تستخدم قسم C، والمسارات المسجلة تتفق مع جميع 17 دعوى المدخل الواحد
- مع وجود مُحامٍ، السباقات المباشرة تتفق أيضاً

## أساليب فشل الإنتاج

| Failure | What the weak report says | What the ledger requires |
|---|---|---|
| Pseudocode read as behaviour | "grade returns 0 for failing scores" | an `execute_function` record for that input, or `unsupported` |
| Decompiler signature trusted | "percent_change returns 16 bytes" | the signature marked as the provider's inference with its `low` confidence |
| Empty list read as absence | "the function has no callers" | an `unknown` status, or a coverage field when the tool provides one |
| Path hashed into the id | "the record changed" after a copy | the semantic projection without `name` and `local_path` |
| Limitation dropped from a copy | a record that looks stronger than the source | id mismatch and rejection on import |
| Partial grid rounded up | "all scores from 90 pass" | `unknown` with `covered` 2 of 11 |
| Host run presented as the object's run | "the x86-64 object returned 25" | the host-build limitation carried on the claim |
| Unknown closed by a sentence | "resolved, see above" | a `verified` resolution with observed ids of the required authority |
| Stale revision overwritten | two analysts' edits collide | `revision-conflict` and a reread |
| Old snapshot replayed after a release | answers from a changed contract | `profile_mismatch` on import |
| Cache kept after a rename | a replay that hides a metadata write | invalidation before dispatch and a failed export |

## قاعدة العمليات

سجل ما قرأت، ما حاسبته، وما تتوقعه كثلاث أنواع من السجلات مع ثلاث كلمات. أغلق المجهول مع هويت، أبدا مع جملة. إعادة عرض الإجابة فقط تحت المفتاح الدقيق الذي تم تخزينها به، ورفضها عندما تختلف سلسلة نسخة واحدة.

## المزيد من القراءة

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- 6.5.0 مصدر في التج `3b79af2`أن هذا الدروس يصف: `src/domain/evidence.ts`،`.agents/skills/reverse-engineer-anything/SKILL.md`،`docs/cli.md`،`src/domain/reconstructionVerification.ts`،`src/application/ReconstructionObligationCandidates.ts`،`docs/tool-design.md`،`src/domain/evidenceCompletionLedger.ts`،`src/domain/residualUnknown.ts`،`src/application/investigation/UnknownEvidence.ts`،`.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`،`src/application/binary/AnalysisSnapshotCache.ts`،`src/domain/analysisSnapshot.ts`،`src/application/binary/BinarySession.ts`،`src/application/binary/BinarySessionRecords.ts`،`docs/mcp-contracts.md`. . .
