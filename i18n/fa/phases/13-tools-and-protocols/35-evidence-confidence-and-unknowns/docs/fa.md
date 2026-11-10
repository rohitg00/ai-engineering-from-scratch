# شواهد، اعتماد و ناشناخته ها در تجزیه و تحلیل دوگانه

> یک یافته در مورد یک برنامه مرتب شده یک سوابق با یک هش، اعتماد، یک مقام و یک لیست از آنچه که نمی تواند نشان دهد است.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## اهداف یادگیری

- ساخت یک پرونده شواهد مدل شده بر اساس REA`Evidence`با اطمینان مشاهده شده، مشتق شده و نتیجه گیری شده.
- شماره های هاش محتوا را محاسبه کنید که وقتی فایل به پوشه دیگری منتقل می شود یکسان باقی می مانند.
- آنچه هر ارائه دهنده نمی تواند نشان دهد را به عنوان محدودیت هایی که با این رکورد سفر می کنند ثبت کنید.
- از بیان یک نتیجه تا زمانی که یک اجرا مشاهده شده از تابع آن را پشتیبانی کند، انکار کنید.
- باقیمانده نامعلوم ها را به عنوان سوابق تجدیدپذیر و با یک زنجیره هش به هم پیوسته نگه دارید.
- ارائه دهنده حافظه کش با کلید دقیق جواب می دهد و بازخورد قدیمی را رد می کند.

## مشکل

از يه مامور ميپرسي چي؟`grade`در`ledger-x86_64-O1.o`یک بازرس از او می پرسد که چگونه این عامل می داند. این عامل یک بلوک متن دارد که Ghidra چاپ کرده است. برای مسیر پیش فرض، این متن می خواند`uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`بايت ها در اين نقطه ميگن`xor eax, eax`. .

این عبارت و دستورالعمل هر دو برای هر ورودی 0 تولید می کنند. عامل نمی دانست. به متن اعتماد می کرد زیرا یک ابزار آن را تولید کرد. یک مطالعه 2026 سه عامل را در 24 کار مهندسی معکوس انجام داد ([NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)) چهار ضعف مکرر را نامید: تعصب آموزش، اعتماد بیش از حد به مشاهدات، محدودیت های زمینه و پایداری برنامه. مطالعه دیگری در سال 2026 متن را در داخل دوگانه ها کاشته و دریافت که مدل ها در 35 مورد از 40 مورد اقدام غیر امن کاشته شده را پیشنهاد می کنند ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507))

rea 6.5.0 به عامل یک لغت برای این کار می دهد.`Evidence`ثبت با یک`confidence`از`observed`،`derived`، یا`inferred`، یک`authority`، و لیست از`limitations`مهارت بسته به عامل می گوید: "هر نتیجه گیری باید مشاهدات، نتیجه گیری ها و ناشناخته ها را متمایز کند. شناسه های شواهد را ذکر کنید، محدودیت ها و پوشش نامکمل را حفظ کنید و هرگز به این معنی نیست که تجزیه و تحلیل جامد اجرا مشاهده شده است".

سه چیز را به شما می گذارد. عکس های فوری آن نتایج دقیق جستجو را ذخیره می کند، نه تجزیه و تحلیل. تأیید آن ادعا را هنگامی که یک ابعاد مقایسه بدون تغییر است، و نظر خود می گوید که یک گذر "مسافت اجرای جهانی را ایجاد نمی کند". دفترچه تعهد آن فقط از جاوا اسکریپت و نمودار های مدیریت شده کاندیداها را می گیرد، بنابراین یک تابع بومی هرگز به دست نمی آید.`verified`از طریقش

این درس قطعه گمشده را در پایتون ساده می سازد. شما یک دفترچه بزرگ می نویسید که هر واقعیت در مورد دستگاه را به عنوان یک رکورد با یک محتوای هش ذخیره می کند. شما پیش بینی هایی را در مورد`percent_change`و`grade`شما دو رکورد واقعی را وارد می کنید و عکس فوری که از آن ها آمده است، و دفترچه شما هر هاش ریا را که نوشته شده است دوباره محاسبه می کند.

```figure
re-evidence-ledger
```

## سه کلمه برای اعتماد و پنج کلمه برای مقام

`confidence`این یک عدد با سه مقدار است، هرگز یک عدد نیست.`authority`وقتی یک تولید کننده چیزی نگفته، ریا استفاده می کند`shipped-artifact`با`observed`. .

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

دو سردرگمی بیشترین هزینه را دارد. اولین یک pseudocode را به عنوان یک مشاهده رفتار می داند. این یک مشاهده از آنچه Ghidra چاپ کرده است. دوم یک لیست خالی را به عنوان اثبات عدم وجود می داند. یادداشت طراحی rea سخت است: "پوشش گمشده ناشناخته است، نه عدم وجود. "`code/main.py`هر دو قانون رو رمزنگاري مي کنه

## تاریخچه

یک رکورد دقیقاً ۱۶ میدان دارد و rea 6.5.0 هر میدان دیگری را رد می کند.`code/main.py`به عنوان مثال، در قسمت 16،`relationship_coverage`، نشان می دهد که لیست تماس گیرندگان یا دعوت کنندگان چقدر کامل است.`complete`،`partial`، یا`unknown`، یا`null`وقتی عملیات گزارش نمی دهد که هیچ تماس وجود نداشته باشد.

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

اين اون ريكورد واقعييه که ريال برايش نوشته`grade`، به قسمت هاي مهم اينجا قطع کن`code/fixtures/rea-evidence-grade.json`، 37573 بايت

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

واقعاً`parameters`موضوع پروفایل 25 کلید داره`limitations`لیست ده جمله دارد. آنها را نگه دارید. محدودیت بخشی از محتوا است، بنابراین حذف یک تغییر هویت، و دفترچه شما سپس رکورد را رد می کند.

به آنچه در این کتاب نوشته نشده توجه کنید.`environment`.`null`چون گيدرا پرونده اي رو خوند و هيچ چيزي رو پيدا نکرد`locations`خالی است چون این گزارش عملیات در داخل آدرس ها است`normalized_result`.`relationship_coverage`دارای وضعیت`complete`تشخیص آن می گوید که فقط مرجع تماس های حل شده Ghidra بازگردانده می شود و تماس های غیر حل نشده و غیر مستقیم نامعلوم باقی می مانند. بنابراین لیست تماس گیرنده و تماس گیرنده فقط برای تماس های حل شده کامل است.

## آيد يك مشت از محتواست و راه در آن نيست

ریال کامپيوتر`evidence_id`مثل`ev_`به علاوه SHA-256 بر روی RFC 8785 JSON کانونیک یک پروژکتور از ثبت.`digest`،`format`و`architecture`و قطره ها`name`و`local_path`. سقوط ميکنه`relationship_coverage`وقتی ارزشش `null`، پس یک رکورد بدون روابط تماس، همان هویت را که قبل از وجود این میدان داشت، حفظ می کند.`raw_result`و هر محدودیتی، هاش شده است.

RFC 8785 کلید های شی را مرتب می کند، فضای سفید را حذف می کند و فرم های شماره و رشته را تنظیم می کند. برای سوابق که شماره آنها اعداد کامل است، کتابخانه استاندارد پایتون باایت های مشابه را تولید می کند:

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py`این نسخه قبل از هاش کردن، شناورها را رد می کند، زیرا RFC 8785 و پایتون برخی از شناورها را متفاوت چاپ می کنند. دو رکورد واقعی و عکس فوری هیچ شناور را نگه نمی دارند، بنابراین دستور هر هاش واقعی را بازیافت می کند:

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

چرا مسیر را حذف کنیم؟ همان مشاهده از همان بائتهای یک شناسه مشابه در هر دستگاه و در هر پوشه ای پیدا می کند.`local_path`در لیست بالا نام پوشه ای در یک Mac وجود دارد. ID تغییر نمی کند وقتی که فایل را به `/home/you/re`.`rebind_subject_path()`اجازه می دهد تا شما یک رکورد را تحت یک مسیر جدید نشان دهید.`sha256`،`format`، یا`architecture`تفاوت. rea 6.5.0 به طور مشابه با `rebindEvidenceToTargetPath`وقتی که یک عکس سریع برای یک هدف در مسیر جدید پخش می شود.

`validate_evidence()`به عنوان مثال، این سیستم، یک شناسه را دوباره محاسبه می کند و یک عدم مطابقت با جمله "دليل شناسه معنوی اش با ثبتش مطابقت ندارد" را رد می کند.`analysis_profile.provider`از اون فرق داره`provider`. آزمون`test_tampered_id_and_mismatched_profile_are_rejected`يه خط رمز مخفي داخل اصل رو تصويب ميکنه`grade`ثبت و نگاه می کند که دفترچه انکارش می کند.

## خود را به این موضوع نگاه کن

قبل از هر ارائه دهنده، دفترچه پرونده رو میخواد.`observe_object()`برگه های بخش ELF64 را تجزیه می کند. `.symtab`،`.strtab`و`.rela.text`با`struct.unpack_from`يه حرف مي نويسه`inspect_object`ثبت و یک`read_function_bytes`هر نماد تابع را ثبت کنید.`observed`با اختیار`shipped-artifact`، چون منبع پرونده در دیسک بود

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t`موافقم: `grade`در`0000000000000010`با اندازه`2e`. سه بار نقل مکان کردن`.rela.text`.`R_X86_64_PC32`مخالف`.rodata`در تعویضات`0x36`،`0x84`و`0x93`، با اضافه کردن`0x10`،`0x24`و`-0x4`هر ريكوردي يه`file-offset-range`مکان و یک محدودیت: "بایت های بخش از فایل در دیسک خوانده می شوند. خواننده هیچ جابجایی و اجرا کد را اعمال نمی کند".

درسی 32 این خواننده را به طور کامل ساخته است. اینجا 60 خط است، چون این درس درباره آنچه شما در مورد خواندن ثبت می کنید.

## جدول را بدست آور و بگو که خودت آن را بدست آوردی

46 بايت از `grade`چهار الگوی را در درس 33 رمزگذاری کرده است:

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

ضرب به `0x66666667`بعدش با تغییر 34 تقسیم شده با 10 است. پرونده شماره 10 را نگه دارد.`derive_grade_model()`این واقعیت را به عنوان یک محدودیت می نویسد: "قسم دهنده 10 مشتق از ضربگر 0x66666667 و تغییر 34 است. فایل شماره 10 را نگه دارد".

.`add ecx, -6`این اولین مورد را به 6 میرساند.`cmp ecx, 4`با یک پرش بدون امضا پنج پرونده، 6 تا 10 مورد را قبول می کند.

.`lea`در`.text+0x33`نقل مکان را با اضافه کننده انجام می دهد`0x10`. یک PC32 از پایان 4 بایت جابجایی اقدام می کند، بنابراین جدول از `.rodata+0x14`پنج کلمه کوچک و احمقانه در آن جا خوانده شده`1, 2, 3, 4, 4`. مبدل رو وارد کن`ledger.c`1 برای 60 تا 69، 2 برای دهه هفتاد، 3 برای دهه هشتاد، و 4 برای 90 تا 100 را باز می کند.

سوابق حاصل شده`ev_605106bff2d9998f…`.`confidence` `derived`و اون`evidence_links`نام دو رکورد مشاهده شده را که بر روی آن است. رکورد بایت ها را از دفترچه حذف کنید و رکورد حاصل شده دارای یک لینک آویزان است. شکل بالا نشان می دهد که حالت زمانی که شما خاموش می شوید`ev_a467c242…`. .

حالا با گيدرا مقایسه کن کد پلويدو براي همين بايت ها

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

گيدرا نقل مکان رو اجرا کرد و ميز رو نام داد`DAT_001000b4`، که`.rodata+0x14`بعد از اينکه قرار داد`.text`در`0x100000`. این بخش با 10 و پنج مورد را بازیابی کرد. برای ارزش پیش فرض یک عبارت را چاپ کرد که همیشه 0 است و هرگز 0 نمی گوید.`native_value_flow`این عملیات را نشان می دهد`is_dead: true`.اسلام مشاهدات وفادار از گيدرا است .معنى که از آن مي خوانيد مشتق شده و ارزش انتظاراتي که از يه مسابقه ميگيريد مشتق شده

.`percent_change`ثبت شکست دیگری رو نشان میده`undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`. منبع ميگه`int percent_change(int before, int after)`.`idiv`نوشته شده`EDX:EAX`، و مسیر صفر به عقب می رود`EDX`بدون لمس شدن، پس کمپایلر نتیجه گیری کرد که 16 بایت بازمی گردد و یک پارامتر سوم.`native_api.return_type.confidence`برای`grade`.`"low"`.از امضا بازیافت شده به عنوان نتیجه گیری ارائه دهنده استفاده کنید و آن را به این شکل ثبت کنید

## پیش بینی ها به دست آمده است

پیش بینی یک ادعای در مورد رفتار است که هیچ مشاهدات نشان داده نشده است. `claim_suite()`18 مورد از آنها را از مدل های مشتق و از منبع ساخته است. `record_prediction()`هرکدوم رو به عنوان یک رکورد با `confidence` `inferred`و`authority` `analyst-inference`، به سوابق مربوطه که برشون پشتيباني ميکنه

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

`predict()`از سیمنتک C استفاده می کند نه سیمنتک پایتون.`c_div()`به سمت صفر تراکم می کند و`wrap32()`هر میانگین را به 32 بیت خم می کند.`//`به سمت بی نهایت منفی میره، پس`(3 - -7) * 100 // -7`درسی 36 این شبکه را خیلی بزرگتر می کند.

هر پيش بيني يک غريزه نامعلوم رو باز ميکنه`observed`شواهد با اجازه`controlled-replay`و توصیه مي کنه يه بار بررسي کنه:`execute_function`در بخش بعدی این شواهد را تولید می کند. سوال برای ادعای درجه اول می گوید "آیا درجه ((95) == 4 در زمان اجرا عملکرد مرتب می شود؟"

## با دویدن مقایسه کنید

`code/fixtures/harness.c`شامل می شود`ledger.c`و هر بار به هر درخواستي يه نتيجه چاپ مي کنه`observe_runs()`با اولین نسخه اش را جمع آوری می کند`clang`،`cc`، یا`gcc`در مسیر شما و هر ورودی را در شبکه یک بار اجرا کنید. هر اجرا به یک رکورد تبدیل می شود:

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

موضوعي که در اين ريكورد اجرا شده، دوينر هنيز، يک فایل Mach-O arm64 در اين Mac است، با SHA-256 خودش.`course-harness`با خط نسخه ی سازنده، اینجا`Apple clang version 17.0.0 (clang-1700.6.3.2)`.`evidence_links`نام ثبت منبع را مشخص کنید`ev_2f1e6d251543d017…`، چون راه و اجسام باهم باهم هستند`ledger.c`و هیچی دیگه

این موضوع را به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به عنوان یک گزارش به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به طور کامل به.

17 تا واحد واردات همه با پیش بینی ها موافقند`code/fixtures/run-evidence.json`این 17 رکورد و رکورد منبع را در اختیار دارد که با `--record`در سال 2026-10-13 وقتی که هیچ کامپایلر وجود ندارد`build_ledger()`در این گزارش آمده است که در این گزارش آمده است که`runs`میدان

## قوانین ترویج

یک ادعا از نتیجه گیری به حمایت فقط از طریق اجرا مشاهده می شود. `check_claim()`دنبالش مي گرده`execute_function`ثبت با همان عملکرد و استدلال، مقایسه هر نتیجه با پیش بینی، و شمارش ورودی های پوشش داده شده:

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()`اين شکل سخته.`ClaimError`وقتی یه اسم باشه`inferred`یا`derived`. این هنگام افزایش می یابد که یک id نام یک سری از تابع دیگر یا استدلال های دیگر را. این هنگام افزایش می یابد که لیست خالی است و زمانی که اجراها ورودی کمتری از ادعای را پوشش می دهند. ثبت سئو کد Ghidra و مدل جدول هر دو برای وجود دارند.`grade(55)`و هيچکدوم از اونا نمي تونن به اون ارتقا برسند`ev_7be90c0c…`در این شکل و مشاهده کنید که ادعای سقوط به `unsupported`و دو تا از اون دو تا`grade`.بقا

ادعای دامنه مورد جزئی را نشان می دهد. تنها دو از 11 ورودی آن، 95 و 100، در شبکه اجرا ظاهر می شوند. `check_claim()`بازپرداخت`unknown`با`covered`2 از 11 و`promote_claim()`با 2 از 11 ورودی مشاهده شده اجرا می کند.

`completion_ledger()`آینه های ریا`EvidenceCompletionLedger`. شناسه اش`ecl_`و افزون به هاشي پرونده هاش`complete`فقط وقتی درست میشه`pass`برابر است`total`. چاپ های دمو`ecl_da64933ea13befed…`با`complete: false`، به خاطر اين ادعاي يک دامنه

## ناشناخته ها سوابق با یک زنجیره هش هستند

rea یک باقی مانده ناشناخته را به عنوان یک رکورد دقیق ذخیره می کند. `code/main.py`با همينه رشته ها و همينه متغيرات

اسمش اینه`unk_`+ SHA-256 اضافه شد`{domain, question, scope_digest}`دو تحلیلگر که از یک پرونده مشابه سوال می کنند، یک شناسه مشابه دریافت می کنند.`scope_digest`SHA-256 این شیست.

هر تغییر یک تجدید نظر جدید است.`previous_revision_digest` `null`هر نظرسنجی بعد نام ها را به نام`revision_digest`از آن قبلي كه در آن بود و هر جا را جز خود پوشش مى دهد.`verify_unknown_chain()`این لیست را می گذرد و هر هضم را دوباره محاسبه می کند. این بررسی می کند که هر لینک به نظرسنجی قبلی اشاره دارد. این بررسی می کند که شواهد جهش هر نام تجدید نظر در دفترچه است.

هر جهش خودش یک ثبت شواهد است، همانطور که در مورد ارائه دهنده انجام می شود`rea-unknown-registry`. مال ما`confidence` `derived`،`authority` `analyst-inference`و موضوعي نيست. محدودیتش ميگه " يه جهش ثبت شده چيزي که تحلیلگر تصميم گرفته است.

به همین دلیل است که 81 رکورد در نمایش شامل 36 رکورد جهش مشتق شده: 18 باز کردن و 18 بروزرسانی است.

سه نوع غیر متغیر در هر تجدید نظر اعمال می شود:

- فقط یه`resolved`نامعلوم به همراهش داره`resolution`، و فقط نسخه 1 هیچ پیشگامش را ندارد.
- A`contradicted`نام های ناشناخته حداقل یک شناسه متناقض و هیچ شناسه ای در هر دو لیست ظاهر نمی شود.
- A`verified`قطعنامه حداقل یک هویت اثبات با اعتماد و صلاحیت مورد نیاز را نام می دهد.

قانون سوم جایی است که دفترچه اغلب از آن انکار می کند. یادداشت های جریان کار rea می گویند "تنها شواهد مشاهده شده واجد شرایط می توانند یک قطعنامه را تأیید کنند". `resolve_unknown()`بنابراین مدل جدول را رد می کند، یک گزارش مشاهده شده را با اختیار رد می کند`shipped-artifact`و رکورد اجرا را قبول می کند`ev_f4ffbe8f922ec7fe…`. اصلاحات حل شده برای `grade(95)`این نسخه 2 است و`previous_revision_digest`.`ffca840b55a8a188…`، بازبینی 1

`update_unknown()`میره`expected_revision`و افزایش دادن`revision-conflict`وقتی که قدیمی شده، مثل ریا`update_unknown`واکنش درست این است که یادداشت های ریا می دهند: بازبینی فعلی را بخوانید و دوباره تصمیم بگیرید.

بعد از نمایشي يه نفر ناشناس باز مي ماند:`unk_f2eb0d7f84c80a19…`، "درست ((نمره) == 4 برای هر نمره از 90 تا 100 نگه دارید وقتی که تابع مرتب اجرا می شود؟" وضعیت آن است `investigating`، شناسه های پشتیبانی آن شامل دو اجرا است و سوند آن هنوز هم ۹ ورودی را بدون اجرا نام می دهد.

## یک مخزن پاسخ ها پایگاه داده ای برای تحلیل نیست

rea سه چیز دارد که شبیه یک کش است. عکس هدف Ghidra یک کپی خصوصی از ورودی است، که با `-readOnly -deleteProject`و در زمان بسته شدن حذف شده`AnalysisSnapshotCache`تا 10 هزار تا ثبت نام برای یک هویت دوگانه را نگه دارد. فایل عکس فوری نگه دارد`target`،`binding`،`entries`،`workflow_entries`، و یک`evidence_bundle`. .

کلید حافظه کشش`query_`+ SHA-256 اضافه شد`{target, binding, operation, parameters}`.`target`.`{sha256, kind, format, architecture}`، و یک`raw-binary`هدف هم داره`entry_point`.`binding`ارائه دهنده و کل پروفایل تجزیه و تحلیل، شامل هضم است. به عنوان مثال هر یک از 25 پارامتر پروفایل را تغییر دهید`jump_table_evidence`از`typed-case-default-blocks-v1`به یک`v2`، و هضم تغییر می کند، بنابراین هر کلید تغییر می کند.

`code/fixtures/rea-snapshot.json`فایل rea در طول دو اجرا، 142,690 بایت نوشته شده است. rea آن را با مجوزهای فقط صاحب نوشته است و کپی انجام شده توسط همه قابل خواندن است. این دو ورودی و یک بسته شواهد با همان دو رکورد دارد. `AnswerCache.import_snapshot()`هرکدوم رو دوباره محاسبه مي کنه`query_id`و پرونده را رد می کند وقتی که هر کدام متفاوت باشد.`target`یا`binding`از فعال متفاوت است، با عبارت REA`profile_mismatch`. از عکس ي كسي كه`format_version`نه`course-answer-cache-1`. .

سه اندازه گیری از این دستگاه.`grade`سوال 8.6 ثانیه طول کشید، با واردات تازه Ghidra.`percent_change`سوال با همان عکس فوری 8.5 ثانیه طول کشید، چون یک سوال متفاوت یک کاش گم شده است.`grade`سوال 2.1 ثانیه طول کشید و به ثبت مشابه با همان `evidence_id`. بازیابی مجدد در حافظه در rea محدودیت را اضافه می کند "از یک عکس تحلیل REA محلی بارگذاری شده است؛ این تماس ارائه دهنده را دوباره اجرا نکرد. "`lookup()`به جمله ی مشابه اضافه می کند تا خواننده بتواند تکرار را از پاسخ تازه تشخیص دهد.

یک جهش حافظه کش را متوقف می کند. در rea 6.5.0، نامگذاری یا یک نظر، حافظه کش لحظه ای را قبل از اینکه rea تماس را به ارائه دهنده ارسال کند پاک می کند. یک پاسخ شکست خورده نمی تواند اثبات کند که نوشتن به عقب کشیده شده است، بنابراین نوشتن شکست خورده نیز پخش مجدد را متوقف می کند. واردات متادتا که پایگاه داده را تغییر می دهد، همین کار را می کند.

## چرا يه مامور به اين نياز داره

يه مامور که از طریق MCP ريال رو مي فرستد ، تمام اطلاعات هر تماس رو مي بينه و مي تونه نقل قول کنه`evidence_id`در این مطالعه، محتوای دوگانه به عنوان داده ها به تنهایی هنوز 15 پیشنهاد غیر ایمن از 40 را ترک کرد و بررسی های منبع با مجوز ابزار آنها را حذف کرد. در یک مطالعه سوم شاهد یک عامل رانندگی Ghidra از طریق MCP (مجموعه ای از داده های موجود در سیستم های موجود در سیستم) بود.[arXiv 2606.06838](https://arxiv.org/abs/2606.06838)) در دوگانه ای که صدها تابع دارند، تنها ۱۰ تا ۱۵ درصد قبل از اینکه عامل تکه ها را تولید کند، تجزیه و تحلیل واقعی را دریافت می کنند.

دفترچه پاسخ به هر یک از این موارد با یک رکورد، و آژانس تنها گزارش آنچه در دفترچه نگه داشته است. یک ادعا بدون یک اجرا مشاهده شده است.`unsupported`. يه ادعا با چند رين`unknown`. یک متن ارائه دهنده`observed`فقط به مامور اطلاعات مهارت رو بده`outputs/`و به دفترچه ی کتاب تنها جایی که نتیجه گیری می نویسد، که برای کلود، کورسور، کودکس، اوپن کلاو، هرمز، یا هر نماینده ای که SKILL.md را می خواند، درست است.

## آن را بسازید

نمایش کتابخانه استاندارد رو اجرا کن:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
```

نمایشگر، شی را می خواند، دو رکورد واقعی را وارد می کند، عکس واقعی را تأیید می کند و دو مدل را اخذ می کند. سپس 18 پیش بینی را ثبت می کند، 18 ناشناخته را باز می کند، هرنس را مرتب و اجرا می کند، هر ادعای را بررسی می کند و 17 ناشناخته را حل می کند. شکل انتظار می رود:

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

بدون کمپایلر C،`runs`میخواد`imported 17 recorded run records from run-evidence.json`و بقیه هم همینطوره.

بخون`code/main.py`در این ترتیب:

1. `canonical_json()`و`compute_evidence_id()`دستورات هاش و پروژکتور معنوی رو نگه دار
2. `create_evidence()`و`validate_evidence()`و ثبتش رو چک کن
3. `EvidenceLedger.record()`و`import_bundle()`پرونده ها را ذخیره کنید و درگیری ها را رد کنید.
4. `open_unknown()`،`update_unknown()`و`resolve_unknown()`زنجیره بازنگري رو نگه دار
5. `observe_object()`این ELF را می خواند و`derive_grade_model()`میز رو میخواد
6. `claim_suite()`،`predict()`و`record_prediction()`سطح نتیجه گیری را بنویسید.
7. `observe_runs()`هر بارش رو به یک رکورد مشاهده می کنه
8. `check_claim()`،`promote_claim()`و`completion_ledger()`قوانین ارتقاء را اعمال کنید.
9. `AnswerCache`کليدها مثل عکس هاي ريا جواب ميده و عکس هاي قدیمی رو رد ميکنه

## ازش استفاده کن

هر هدف و هر تحقیق یک دفترچه داشته باش، SHA-256 هدف را در هر موضوع و دامنه سوال را در هر نامعلوم قرار بده. وقتی ابزار را تغییر می دهی،`provider`و اجازه دهید شناسه ها متفاوت باشند. وقتی شما فایل را بازسازی می کنید، موضوع تغییراتی را هضم می کند و هر رکورد قدیمی به شواهد مربوط به فایل دیگری تبدیل می شود.

در لحظه ای که آنها را می دانید محدودیت هایی را بنویسید. خواننده ای که هیچ جابجایی را اعمال نمی کند چنین می گوید. اجرا یک ساخت میزبان چنین می گوید. مدل ای که تقسیم کننده را تحمیل می کند چنین می گوید. یک رکورد بدون محدودیت های خود نوشته شده قوی تر از واقعیت به نظر می رسد و خواننده بعدی نمی تواند آن را اصلاح کند.

هر متن ارائه دهنده را به عنوان داده ها در نظر بگیرید. رشته ها و کد های نامزدی از هدف عبارتند از متن که هدف کنترل می کند. آنها هرگز به دستورالعمل تبدیل نمی شوند و هرگز به مشاهدات رفتاری تبدیل نمی شوند. rea 6.5.0 چنین نتایج را با `_meta.provenance.untrusted_content: true`دستورالعمل های سرور آن به مدل می گوید که محتوای هدف را به عنوان داده ها در نظر بگیرد و هر درخواستی را که در آن اجرا، نصب، دانلود یا ارسال چیزی به عنوان یک تلاش تزریق فوری گزارش دهد. نشانگر کمک می کند، اما دفترچه شما باید هنوز متن هدف را از دستورالعمل ها خارج کند.

## آزمایشگاه تعاملی

### آزمایشگاه A: دوباره حساب کردن یک آدی واقعی

از`code`دایرکتوری، پیتون باز:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

راه رفتن:

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

دو مقایسه اول درست است. مسیر در هش نیست. سوم غلط است، زیرا یک محدودیت محتوا است.

### لابراتوار ب: رد ارتقاء

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

صدا بلند ميشه`ClaimError`و نام شناسه مشتق شده را نام دهد. حالا نام شناسه اجرا را رد کنید:

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

وضعیتش اینه`pass`و بازگردانده شد`limitations`و حکم ساخت میزبان را به عهده دارند.

### لابراتوار C: عکس های قدیمی را رد کنید

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

اولین بازخواست وارداتی 2`CacheError`با`profile_mismatch`. يک رشته نسخه تغيير شده و کل عکس رد شده

### لابراتوار D: زنجیره رو بشکنید

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

اولين تماس باز مياد دوين تماس بلند مي شود`EvidenceIntegrityError`، چون نسخه 1 دیگر با هضم خودش مطابقت ندارد و نسخه 2 در هضم که دیگر وجود ندارد، اشاره دارد.

## آزمایشگاه تمرین

بازي نامعلوم را ببنديد و يه ارائه دهنده دوم اضافه كنيد.

الزامات:

- طولاني`run_grid()`پس 9 ورودی گمشده در دامنه اجرا می شود، سپس حرکت ناشناخته را به `resolved`در نظرسنجی 3.
- اضافه کردن`llvm-objdump -d`به عنوان یک تامین کننده دوم با خود`provider`اعتراض و ثبت فهرستش از`grade`مثل`observed`. .
- يه حرف بنويس`derived`اون دو لیست، گیدرا و llvm-objdump را مشخص می کنه، همان 14 دستورالعمل رو رمزنگاري مي کنه و هر دو رو به هم مي پیوندد.
- براي يه نامعلوم باز کن`grade_label(105)`با شدت`high`، از آنجایی که شاخص جدول 4 میگه `labels[4]`و با فرارش حلش کن
- دفترچه ی بزرگ را با `export_bundle()`، واردش ميکنه به يه دفترچه تازه و ثابت ميکنه که هر زنجیره اي هنوز هم تصديق ميکنه

موفقیت به معنای گزارش است که در هر جمله یک اسم از بسته و یک کلمه را ذکر می کند`unknown`ادعا از دست رفته

## آزمایشگاه درجه بندی شده

پنج سوال در مورد نصبات این درس. هر جواب را با کد ساختی پیدا کن، سپس آن را به `code/lab_answers.json`. اعداد رو به عنوان اعداد یا به عنوان رشته های ششگانه بنویس`"0x40"`, و لیست ها به عنوان لیست JSON

1. `t1`: مدرک ID که compute_evidence_id برای RE-evidence-grade می دهد.
2. `t2`: تعداد محدودیت ها در ثبت درجه
3. `t3`: وضعیت رابطه_ پوشش ثبت درجه
4. `t4`: اعتماد و اعتبار ثبت نمره، به عنوان یک لیست دو رشته.
5. `t5`: SHA-256 از موضوع ثبت درجه.

جواباتتون رو چک کنيد:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
npx tsx code/lab.ts
```

چکگر هر ارزش انتظار شده را از  محاسبه می کند`code/main.py`بر روی وسایل بسته شده چاپ می کند`PASS`،`FAIL`یا`TODO`برای هر کار و یک امتیاز، و فقط وقتی که پنج مورد از آن عبور می کنند از صفر خارج می شود.`python3 code/lab.py my-answers.json`پرونده ي ديگه رو چک مي کنه`code/tests/test_lab.py`ثابت می کند که چک کننده پاسخ های درست را قبول کرده و پاسخ های اشتباه را رد کرده است.

### ببینیم که میره

.[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off)این لینک اجرا را با خاموش کردن جدول نماد باز می کند، بنابراین نام و پایان فایل تابع به عنوان نامعلوم و فایل های شروع به عنوان نتیجه گیری می شود.

## درس هنرپیشه

این درس به ما کمک می کند`outputs/skill-evidence-ledger.md`به یک نماینده می گوید که چگونه هر یافته را به عنوان یک سوابق با اعتماد به نفس، صلاحیت، محدودیت ها و لینک ها بنویسد. به آژانس می گوید که چگونه ناشناخته ها را به عنوان بازبینی نگه دارد و وقتی ادعای مورد نظر است.`pass`،`fail`،`unknown`، یا`unsupported`. .

## بررسی کنید

نمایش و مجموعه تعیین کننده را اجرا کنید:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

28 تست ثابت ميکنه:

- هر دو واقعا`evidence_id`ارزش ها، پروفایل و هر دو عکس`query_id`ارزش ها از محتوای آن محاسبه می شوند
- مسیر تغییر یافته، هویت را حفظ می کند و محدودیت تغییر یافته، تغییر می کند.
- یک رکورد تغییر یافته، یک ارائه دهنده پروفایل نامتناسب، یک شناور و یک ارزش enum ناشناخته رد می شوند
- گزارشات دوگانه`duplicate`، رکورد متناقض بالا می رود و واردات بسته ای اتمی است
- واردات بسته های ثبت شده با ۱۸ رکورد و بدون لینک های لنگ
- يه ناشناس در نسخه 1 باز ميشه ، رد ميشه`expected_revision`، و فقط با مشاهده حل می شود`controlled-replay`شواهد
- یک اصلاح اصلاح شده زنجیره را شکسته است
- تبلیغ انکار یافته، مشتق، خالی و غیر مرتبط شواهد و با یک توافق اجرا می کند
- پوشش جزئی`unknown`و دویدن متناقض`fail`
- حافظه کش روی کلید دقیق ضربه می زند و در پارامترهای دیگر گم می شود
- حافظه پیشگیری از نسخه پروفایل خراب شده، هدف اشتباه، نسخه فرمت اشتباه و کلید تغییر یافته را رد می کند
- خواننده ELF موافق است`llvm-objdump`در تعویضات، اندازه ها، بائتهای و نقل مکان ها، و جدول می خواد `1, 2, 3, 4, 4`
- پیش بینی ها از تقسیم C استفاده می کنند و اجراهای ثبت شده با همه 17 ادعای واحد وارد کننده موافق هستند
- با وجود یک کمپایلر، اجرا های زنده هم موافق هستند

## روش های شکست تولید

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

## قاعده عملیاتی

آنچه را که خوانده اید، آنچه را که محاسبه کرده اید و آنچه را که انتظار دارید به عنوان سه نوع ضبط با سه کلمه ثبت کنید. نامعلوم را با یک شناسه، هرگز با یک جمله ببندید. پاسخ را فقط تحت کلید دقیق ذخیره شده است، تکرار کنید و آن را رد کنید زمانی که یک رشته نسخه متفاوت است.

## خواندن بیشتر

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- rea 6.5.0 منبع در برچسب `3b79af2`که این درس شرح می دهد:`src/domain/evidence.ts`،`.agents/skills/reverse-engineer-anything/SKILL.md`،`docs/cli.md`،`src/domain/reconstructionVerification.ts`،`src/application/ReconstructionObligationCandidates.ts`،`docs/tool-design.md`،`src/domain/evidenceCompletionLedger.ts`،`src/domain/residualUnknown.ts`،`src/application/investigation/UnknownEvidence.ts`،`.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`،`src/application/binary/AnalysisSnapshotCache.ts`،`src/domain/analysisSnapshot.ts`،`src/application/binary/BinarySession.ts`،`src/application/binary/BinarySessionRecords.ts`،`docs/mcp-contracts.md`. .
