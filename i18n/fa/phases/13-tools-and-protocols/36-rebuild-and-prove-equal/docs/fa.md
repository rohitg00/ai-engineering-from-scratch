# بازسازی و ثابت کردن مساوی: آزمایش های تفاوت، مقایسه بایت ها و حلقه شواهد

> گذراندن آزمون ها توافق در آزمون ها را ثابت می کند، بنابراین برابری به یک شبکه نیاز دارد که به هر لبه و بایت ها برسد که بعد از نقاب انتقال مطابقت داشته باشد.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## اهداف یادگیری

- از فهرست دستورالعمل ها یک بازسازی بنویسید و پرونده شواهد را که از آن آمده نام ببرید.
- یک شبکه ورودی را با یک کلاس در هر خطر بسازید: حفاظت صفر، مقادیر منفی، تقسیم کوتاه کردن، 32 بیت بیش از حد و یک تله تقسیم.
- اصل و بازسازی رو در یک برنامه اجرا کن و هر سلول رو بشمول یک تله رو ضبط کن
- بازسازی را با پرچم های اصلی دوباره جمع آوری کنید و بایت های تابع را پس از پنهان کردن زمینه های نقل مکان مقایسه کنید.
- ثابت ها را که نقطه ی انتقال به آن ها را می خوانید و مقایسه کنید، بنابراین یک حرف واقعی اشتباه نمی تواند عبور کند.
- سرور MCP rea رو از یک مشتری استودیوی کوچک هدایت کن و هر مرحله رو با هویت شواهد ثبت کن
- یک پرونده اثبات شکست خورده که هویتش یک هاشه بر روی ادعاها و لینک های شواهد است.

## مشکل

تو از ريا از پرونده وظيفه هاي`percent_change`در قسمت ما`ledger-x86_64-O1.o`گيدرا 12.1.4 کد پديده رو برگرداند و مامور اين سي را از اون نوشت:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

چهار تست عبور کرد:`(100, 150)`50 ميده`(200, 100)`-50 میره`(0, 5)`0 می دهد`(50, 100)`اين 100 تا ميده، و مامور هم دوباره ساخته شده`grade`چهار تا`if`،در گزارش نوشته شده که "مطمئن شده"

این گزارش هیچ کدام از این سوال ها را جواب نمی دهد:

- وقتی اصل برگرده چه اتفاقی می افتد؟`(after - before) * 100`در 32 بیت نمیشه؟
- اصلش چه مقدار به خاطر نمره 110 باز می گردد؟
- آیا بازسازی به همان 16 بایت با اصل کامپایل می شود؟
- وقتی دو تابع جمع آوری شده باایت های مشابه داشته باشند، آیا جابجایی آنها به ثابت های مشابه اشاره دارد؟
- از چه مدرکي اين بازسازی اومده و مامور اين فهرست رو يا کد مخففي رو خوند؟
- ثابت چه حالتی در میزبان بدون کامپایلر C دارد؟

هر هدف در اين درس برنامه اي است که ما نوشتيم و مرتب کرديم.

```figure
re-36-prove-equal
```

## آنچه شواهد می گویند

. حلقات مامور داخل`code/main.py`شش بار به ريال 6.5.0 از طریق استديو تماس گرفتم`code/fixtures/runs/agent-run.json`سرور جواب داد`initialize`با نسخه پروتکل`2025-11-25`سه تماس به ثبت شواهد برگشت:

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

اولین تماس برای واردات و تجزیه و تحلیل خودکار گیدرا پرداخت شد.`confidence: "observed"`،`authority: "shipped-artifact"`, و SHA-256 از این شی ,`9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`. گيدرا اين كسي را كه ميتونه جايگزين شود بار ميده`.text`در`0x100000`، پس`percent_change`در`0x100000`و`grade`در`0x100010`. .

رمز مخففي براي`percent_change`اينجوري`long`از:

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

. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`cltd`و`idivl`هر دوتا رو بنویسی`edx`و`eax`و یک مقدار بازگشت 16 بیت با تقسیم 64 بیت مدل کرد. لیست در همان رکورد چیزی ساده تر می گوید:

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

هر عمليات 32 بت عرض داره`IMUL EAX, ESI, 0x64`در 32 بیت ضرب می شود و نصف پایین را نگه می دارد.`CDQ`-مدد علامت`eax`به`edx`و`IDIV EDI`این دو تا را با یک تقسیم کننده 32 بت تقسیم می کند.`100 * (after - before) / before`در`int`. .

.`grade`سئو کود اسم جدول را می دهد`*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`، و یک عبارت پیش فرض غیر قابل خواندن ساخته شده از `0x66666667`. فهرست نشان ميده که قسمت 10 به عنوان`IMUL RAX, RAX, 0x66666667`،`SAR RCX, 0x22`،`SHR RAX, 0x3f`،`ADD ECX, EAX`پس`ADD ECX, -0x6`،`CMP ECX, 0x4`و`JA`ده ها نفر رو از 6 تا 10 نگه دار.`XOR EAX, EAX`قبل از مقایسه، پیش فرض 0 است.`LEA RCX, [0x1000b4]`و`MOV EAX, dword ptr [RCX + RAX*0x4]`جدول پنج تایپ 4 بایت را بخوانید.

مرحله 4 اين 20 بايت رو بخوان:`01000000 02000000 03000000 04000000 04000000`. ميز اينه`1, 2, 3, 4, 4`برای ده ها، شش، هفت، هشت، نه، ده، این است`switch`در`ledger.c`، با`case 10`و`case 9`4- تقسیم ارزش

هر دو مدرک در صفحات شواهد ریا از لیست و از `read_bytes`اولين رمز پشو کود DX-Ball بود`FUN_00406400(void)`بدون ورودی ستک، و نمای دستورالعمل آن را اصلاح کرد. ابتدا لیست را بخوانید. نام ثبت را ذکر کنید، سپس C را بنویسید.

## نامزدها را بنویسید

پوشه`code/fixtures/candidates/`چهار تا از این دو متنی به همان کد مرتب شده است. چهار تا از این متنی که یک آزمون دست نوشته می کند قابل قبول و اشتباه است.

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

هر فایل با دستور نصب جمع آوری می شود`clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`. اجسام جمع آوری شده در کنار منابع انجام می شوند بنابراین تست ها بدون clang روی میزبان اجرا می شوند.

## پا اول: اجرا و مقایسه

تعریف مک کیمن در سال 1998 از آزمایش های متمایز به "دو یا چند سیستم قابل مقایسه" نیاز دارد که "مشهد آزمایش تولید شده مکانیک" را تغذیه کند و نتیجه، آسیب یا تصادف را به عنوان نامزد خطا در نظر می گیرد. او بخش سخت را نامید: "زشت ترین مشکل در آزمایش ارزیابی نتیجه آزمایش است". ما نیازی نداریم که پاسخ درست را بدانیم. ما به اصل و بازسازی نیاز داریم تا هیچ جا در شبکه ای که به هر خطر برسد اختلاف نکند.

### طراحی شبکه

`input_grid()`در`code/main.py`92 سلول را می سازد.`percent_change`هر جفت از ده تا طول مي کشيد`before`ارزش ها و هفت`after`ارزش ها:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

برای`grade`22 تا نمره داره: هر دو طرف هر لبه باند، منفی، 0، 110 و دو`int`محدودیت ها`classify()`برچسب هر سلول. جریان بیش از حد دارای 32 سلول، منفی 17، مرز 14، ساده 12 و حفاظت صفر است.

هر کلاس به يه دليل وجود داره سلول هاي نگهبان صفر`TEST EDI, EDI`شاخه. سلول های منفی بررسی بخش تراکم: C و `idiv`به سمت صفر گرد، پس`-9 / 10`0 و `-10 / 10`سلول های گردی بررسی می کنند که ضرب قبل از تقسیم اتفاق می افتد، بنابراین`(105 - 100) * 100 / 100`5 و نه 0 است.`(after - before) * 100`بیش از 32 بیت. یک سلول گیربنده باعث می شود محصول بسته شده برابر باشد`INT_MIN`با`before`برابر با -1.

یانگ، چن، ایده و ریجر Csmith را برای تولید برنامه هایی که بدون رفتار نامعین وجود دارد ساخته اند. اختلاف نظر در مورد رفتار نامعین شور و هرگز گزارش خطا است. overflow امضا شده در C نامعین است. Oracle ما یک شی جمع آوری شده با یک رفتار ثابت است، بنابراین سلول های overflow در محدوده هستند. درس این است که بدانید کدام سلول ها بر روی استاندارد و کدام بر روی بایت های جمع آوری شده می باشند.

### راننده و تله

`code/driver.c`یک سلول در هر خط از stdin را می خواند و ورودی ها، نتیجه اصلی و نتیجه بازسازی را چاپ می کند. `build_harness()`کاندید را با `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`در یک میزبان لینوکس x86-64، اصلی خود شی نصب است. در هر میزبان دیگر آن است`ledger.c`به صورت بومی جمع آوری شده و گزارش ها ثبت شده است`original_kind: fixture-source`. .

راننده يه دستگاه نصب مي کنه`SIGFPE`با`sigsetjmp`و`siglongjmp`. برای`before = -1`و`after = 536870911`، تفاوت 536870912 و محصول 32 بت به -2147483648 بسته می شود.`idiv`با این تقسیم و تقسیم کننده -1، استثناء خطا تقسیم را افزایش می دهد. این مقدار در 32 بیت (Intel SDM جلد 2، IDIV) قرار نمی گیرد. عامل آن را به مقدار ثبت می کند `trap`. .

در آرک 64`sdiv`و به نظر می رسد که این کار به اندازه کافی قابل انجام است تا به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی به اندازه کافی است.

### نتایج

`prove_behaviour(PLAUSIBLE)`ساخت و ساز`long`اون ده مورد ساده از دست رفته، شبکه در 28 سلول شکست خورده

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

همه 26`percent_change`شکست ها سلول های پرتاب هستند`|before| > 1`. برای`before`برابر با 1 یا -1، مقدار 64 بیت به مقدار بسته شده باز می گردد، بنابراین این سلول ها به طور تصادفی با هم موافق هستند.`grade`شکست می خورد چون سوئیچ اصلی هیچ دلیل برای ده ها تا 11 و بالاتر ندارد و`110 / 10`11 است

`prove_behaviour(EQUAL)`ساخت و ساز می کنه`percent_change_mul_first.c`و`grade_switch.c`همه 92 سلول موافقند`percent_change_div_first.c`دو مورد از چهار مورد ساده، که تنها موردی است که یک آزمون دست نوشته پیدا می کند، شکست می خورد.

`oracle_disagreements()`يه چيز ديگه رو چک ميکنه`percent_change_model()`و`grade_model()`مدل های پایتون این لیست هستند، با `wrap32()`برای ضرب 32 بت و `idiv32()`برای قانون معماری. گزارش مدل را با اصلی مشاهده شده در هر سلول مقایسه می کند. صفر اختلافات به این معنی است که مدل و دوگانه در هر سلول موافق هستند. مدل شواهد حاصل شده و اجرا شواهد مشاهده شده است. گزارش آنها را در زمینه های جداگانه نگه می دارد.

## پا دوم: جمع آوری و مقایسه

رفتار در یک شبکه یک پا است. پا دوم می پرسد که آیا بازسازی، که با همان کامپایلر و پرچم ها مرتب شده است، باایت های مشابهی تولید می کند. پروژه DX-Ball گزارش "63 باایت مطابقت" برای دستیار خود را. پروژه TH04 گزارش یک مطابقت 2.139 باایت. هر یک از آنها از کامپایلر دوره خود استفاده کرد. rea خود نمی تواند این کار را انجام دهد.`compare_functions`متن ارائه دهنده خطوط و محدودیت "اجمع متن ارائه دهنده غیر شفاف است؛ نرمال سازی نقل مکان در دسترس نیست".

### شی را بخونید

`ElfObject`در`code/main.py`یک ELF64 را می خواند که با `struct.unpack_from`. اون جادويي رو چک ميکنه ، کلاس 64 بت ، داده هاي کوچولو`e_machine`۶۲، و`e_type`بعد از اون به عنوانات بخش ها، جدول رشته ها،`.symtab`، و هر`.rela`بخش. در دستگاه`percent_change`شروع می شه`.text`تعویض 0 با اندازه 16 و `grade`در`0x10`با اندازه 46`total`شروع می شه`0x40`با اندازه 31 و `grade_label`در`0x60`با اندازه 63

16 بايت از `percent_change`.`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`. وظيفه هيچ جايگزيني نداره`grade`یک: تعویض`0x26`داخل تابع، نوع`R_X86_64_PC32`، نماد`.rodata`، اضافه کردن`0x10`. متعلق به 7 بايت`leaq`در تعویض`0x23`، که چهار بايت آخرش میدان جابجا شدن است

### ماسک، پس از آن، ضبط ها را مقایسه کنید

در یک شی RELA، اضافه در پرونده نقل مکان زندگی می کند و چهار بایت میدان صفر هستند.`grade_switch.o`یک بایت ساده مقایسه می گذرد در حالی که دو نقل مکان نام مکان های مختلف را می دهد. `mask_relocations()`به هر حال میدان را در هر دو طرف صفر می کند، بنابراین همان روش برای اشیاء REL و Mach-O، جایی که میدان شامل اضافه می شود، صدق می کند.

پس`prove_bytes()`مقایسه پرونده های نقل مکان با بخش های تعویض، نوع و هدف.`.rodata+0x10`و نامزد میگه`.rodata-0x4`. اضافه متفاوت است چون موضوع کاندید هیچ`labels.rel`جدول در مقابل میز سوئیچ آن. یک اضافه متفاوت یک تعویض متفاوت است، نه یک تابع متفاوت.

### ثابت ها را بخوانید نقاط نقل مکان در

برای یک فیلدی مربوط به PC که دستورالعمل خود را به پایان می رساند، CPU آدرس دستورالعمل بعدی را اضافه می کند، بنابراین هدف رمز افزون اضافه 4 است. در اصل که `.rodata+0x14`، و در کاندیدایش هم هست`.rodata+0x0`.`read_table()`پنج تا 4 بايت وارد شده است`1, 2, 3, 4, 4`. .

شماره پنج از لیست آمده:`CMP ECX, 0x4`با`JA`شاخص های 0 تا 4 را پذیرفته است و`[RCX + RAX*0x4]`4 بايت در هر شاخص ميخواد`CLAIMS`در`code/main.py`این شکل را برای `grade`و ثبت صفر نقل مکان برای `percent_change`. .

این مرحله به دلیل یک خطای مستند شده توسط پروژه TH08 وجود دارد. مقایسه قدیمی آن "در زمینه نقل مکان دستورالعمل، آدرس هدف را تکرار کرد، سپس باایت های دستورالعمل را بدون بررسی داده های لغوی شناور در آن آدرس مقایسه کرد. منبع `0.0`بنابراین ممکن است به نظر برسد که دقیقاً در مقابل هدف قرار داده شده است`128.0`." این اصلاح 1548 مرجع متغیر را بررسی کرده و 12 مرجع دیگر را اصلاح کرده است. `grade_case10_wrong.c`این نسخه ما از این خطا است. 46 بایت کد آن برابر با اصلی است، رکورد نقل مکان آن دارای شکل مشابه است، و جدول آن است`1, 2, 3, 4, 3`فقط چک ثابت شکست میده

### نتایج

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

دو نتیجه ارزش نگاه دوم رو داره`percent_change_split.c`متن منبع مختلف و بائتهای یکسان دارد، زیرا Clang به عنوان نامحدود و پوشیده شده، عبور را تحت پوشش قرار می دهد `after * 100 - before * 100`به يک چندان`grade_table.c`همچنین باایت با بیت مطابقت دارد، بنابراین کامپایلر از یک شاخص آرایه و از یک جدول به همان جدول رسید.`switch`یک بایت مطابقت ثابت می کند که این کامپایلر با این پرچم ها، کد مشابهی را از کاندید تولید کرده است. این ثابت نمی کند که کاندید متن منبع اصلی است.

اندازه یک تشخیص است نه یک پذیرش. صفحات شواهد rea یک کاندیدای 1,825 بایت با طول مناسب و 467 بایت متفاوت را ثبت می کند.`wide`بازسازي 26 بايت است چون`movslq`،`imulq`،`cqto`و`idivq`این لیست قبل از هر کامپایل، عرض آن را به ما می گفت.

## مامور "لوپ" از روي "رویا"

۶۵ ابزار MCP rea هیچ فرمان CLI ندارند و`verify_reconstruction`یکی از اونا هست`McpStdioClient`در`code/main.py`کوچکترین مشتری که به آنها می رسد.`npx -y rea-agents@6.5.0 mcp`، یک درخواست JSON-RPC را در هر خط به stdin می نویسد و یک شی JSON را در هر خط از stdout در یک موضوع می خواند.`initialize`با نسخه پروتکل`2025-11-25`، پس`notifications/initialized`، پس`tools/call`.مدت پیش فرض هر تماس 330 ثانیه است، همان شماره rea اجازه می دهد تا Ghidra سرد شروع شود.

`agent_loop()`اون شش تماس رو ميکنه و هر يک رو ضبط ميکنه:

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

پرونده های کامل شواهد زیر شناسه های آنها در همان فایل ذخیره می شوند. کد نامزدی و لیست بازسازی از آن آمده بخشی از دستگاه هستند.`table_address()`پیدا می کنه`LEA`و در`grade`فهرستش رو ميذاره و بهشون ميده`read_bytes`.`open_binary`،`get_evidence_bundle`و`close_binary`هیچ ثبت شواهد را بازنمی گرداند و با یک شناسه بی فایده ثبت می شود.

`run_agent(live=True)`راننده های واقعی`npx`در راه است و`GHIDRA_INSTALL_DIR`نام یک دایرکتوری را می دهد. در غیر این صورت این دستگاه را دوباره می کند و می گوید که در stderr. تست ها یک قدم بیشتر می روند.`code/tests/fake_rea_server.py`یک سرور جایگزین است که به هر یک پاسخ می دهد`tools/call`کلائنت و حلقه در هر آزمایش با هیچ rea، Ghidra یا Java نصب نشده با آن مواجه می شوند.

### چه چیزی می تواند و نمی تواند تایید کننده rea بگوید

واقعاً`verify_reconstruction`در این گزارش، در مورد یک عملکرد، یک ادعا در مورد یک عملکرد، متن ارائه دهنده را از ۰.۱۰۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱۰.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.۱.`compare_functions`یک ادعای رفتاری دو ثبت شده فرآیند ضبط را با `compare_process_captures`وقتی یک سوابق منبع پوشش تماس های نامکمل را دارد، ادعای مربوط به تماس ها است`unknown`هیچ چیز در داخل rea یک تابع بازسازی شده را مرتب نمی کند یا آن را بر روی شبکه ورودی شما اجرا نمی کند. دو پا در این درس بخشی هستند که rea به شما می گذارد.

دفتر حساب تعهدات rea انتظار دارد که یک سوابق اثبات شده با `predicate_type: "rea.reconstruction-proof"`،`operation: "verify_reconstruction_obligations"`،`confidence: "observed"`و`normalized_result.passed === true`. هیچ ابزار واقعی عمومی چیزی را نمی دهد`build_proof()`در`code/main.py`این را می کند:

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

اسمش اینه`ev_`به علاوه SHA-256 از ضبط بدون شناسه، از طریق طبقه بندی کلید کامپکت JSON. `aggregate()`بسته شده است: `fail`پس برنده میشه`unknown`، و لیست خالی درخواست ها`unknown`در یک میزبان بدون یک C کمپایلر دو ادعای رفتار`unknown`، پس پرونده ميگه`unknown`حتی وقتی هر دو ادعای بایت از دست میرسد.`authority`.`controlled-replay`، چون مدرک از دست دستمزد ما مياد نه تنها از پرونده اشياء

## آنچه تحقیقات می گوید

لیو، راف و میسینسکی هشت سیستم تجزیه را در نه پیکربندی در سال 2026 اندازه گیری کردند. کاندیداهای که هر آزمون را که معیار معیار شامل آن است، به پایان رسانده اند، هنوز هم در مورد ورودی های گیج شده متفاوت هستند. این نرخ ۴.۹ درصد در کل و تا ۱۳ درصد برای یک سیستم بود. در 300 عملکرد کتابخانه گیت هاب و 287 عملکرد مبتنی بر CVE، قوی ترین مدل اصلاح، میزان ساخت گیدرا را از 75 درصد به 90 درصد افزایش داد. در طول عملکردهای مشابه، میزان مطابقت رفتاری از ۷۴ درصد به ۶۲ درصد کاهش یافت. آنها علت آن را به زمینه های اختراع شده، انواع، کالای ها و نگهبانان که جایگزین ناشناخته های قابل مشاهده شده یک decompiler سنتی را پس می گذارد، ردیابی کردند.

ما`percent_change_wide.c`این نوع اختراع شده یکی از این نوع ها است.`long`در این مورد، در سال ۲۰۱۴، در یک آزمایش جدید، به عنوان یک آزمایش جدید، یک آزمایش جدید انجام شد که در آن به طور کامل به عنوان یک آزمایش جدید انجام شد. در سال ۲۰۱۴، این آزمایش دوباره انجام شد و نتیجه آن مرتب شد، ده آزمایش را به پایان رساند و ۲۶ سلول تخلیه شکست خورد. بازسازی حد درجه یک محافظ اختراع شده است. هر دو به عنوان قابل اجرا مجدد تحت متریک LLM4Decompile حساب می شوند، که تولید را دوباره جمع آوری می کند و ادعاهای معیار را اجرا می کند. خود جیدرا در 20.12 درصد از این ادعاها در HumanEval-Decompile عبور کرد.

DecompileBench 23400 عملکرد را از 130 برنامه واقعی اندازه گیری کرد. روش های LLM را 52.2 درصد کمتر از قابلیت های کاربردی از تجزیه کننده های صنعتی با نمره های درک بالاتر یافت.

سه مدرک که میدان استفاده می کند سه پا هستند که می توانید بسازید. فینکس و درام پیدایش رو دوباره جمع آوری کرده و تست های برنامه اصلی رو اجرا می کنن مک کیمن و سمیت ورودی های تولید شده را در مقابل اصلی با ورودی های نگهداری شده در درون رفتار تعریف شده اجرا می کنند. راموس و انگلر دو تابع C را با اجرای رمزنگاری محدود بررسی می کنند که برابری را در تمام مسیرهای مورد بررسی تا اندازه ورودی ثابت می کند. این درس دو تا اول را می سازد. سومين، آزمایشگاهي در درس 35 است که در دفتر شواهد وجود دارد، وقتی که شبکه ای برای اعتماد خیلی کوچک است.

## آن را بسازید

. با استفاده از بند استاندارد کتابخانه:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
```

با clang در مسیر، دمو هر دو جفت کاندید را جمع آوری می کند و برای هر کدام 92 سلول را اجرا می کند. آن هشت کاندید را دوباره جمع آوری می کند، اجرا کننده را دوباره اجرا می کند و رکورد اثبات را می کند. بدون clang آن را می خواند اجزای انجام شده و گزارش ادعاهای رفتار به عنوان`unknown`. .

شکل انتظار شده در یک arm64 Mac:

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

بخون`code/main.py`در این ترتیب:

1. `wrap32()`،`c_div()`،`idiv32()`و دوتا`*_model()`تابع ها دارای معنای عددی کامل لیست هستند.
2. `input_grid()`و`classify()`و سلول های 92 را بسازید و برچسب بزنید.
3. `build_harness()`و`execute()`یک برنامه را از اصلی، نام های جدید نامزد ها جمع آوری کنید و`driver.c`، بعد از اين سلول ها رو اجرا کن
4. `prove_behaviour()`گزارش مرحله اول را با عدم مطابقت و اختلافات مدل باز می گرداند.
5. `ElfObject`سرشت ها، نمادها و`.rela`سوابق`mask_relocations()`و`read_table()`مقایسه رو آماده کن
6. `prove_bytes()`گزارش دو پا را با اندازه ها، محدوده های پوشیده، شکل نقل مکان و جدولها باز می گرداند.
7. `McpStdioClient`و`agent_loop()`هر قدم رو ضبط کن
8. `build_proof()`و`aggregate()`ثبت پرونده ی بسته شده

## ازش استفاده کن

برای اثبات یک تابع جدید برابر، این مراحل را تکرار کنید:

1. بیا`analyze_function`برای عملکرد و ثبت هویت شواهد. لیست قبل از کد مخفف را بخوانید.
2. نامزدی را از عرض عملیات لیست بنویسید. نام عملکرد اصلی را نگه دارید.
3. هر ضرب، اضافه، حذف و تقسیم را در لیست لیست کنید. ورودی های شبکه را اضافه کنید که هر یک را در عرض خود بسته می کند.
4. هر دو طرف هر ثابت مقایسه را در لیست اضافه کنید. برای `grade`این ها بعد از معاینه 6 و 4 بودند.
5. هر قسمتگر رو که ميتونه در هدف گیر کنه اضافه کن و ثبت کن که ساختار رو اجرا کرد
6. هر دو پا رو بزن و قبل از وضعيت دليل رو بخوني
7. پرونده اثبات رو کنار نامزد نگه دار`evidence_links`به خواننده بگو که ثبت ادعای بر چه چیزی است.

پس از هر بروزرسانی کامپایلر هر دو پا را تکرار کنید. یک بایت مطابقت یک بیانیه در مورد یک کامپایلر با یک مجموعه پرچم است.

## آزمایشگاه تعاملی

### آزمایشگاه A: مدل و اجرا

از`code`دایرکتوری، پیتون باز:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

راه رفتن:

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

اولین تماس -133، محصول بسته به 3 تقسیم می شود. دومین تماس -133 می دهد.`'trap'`و سومين شماره -2147483648 است. گزارش نشان ميده 10 مورد ساده گذريده و 28 سلول شبکه شکست خورده است.`report.oracle_disagreements`با یه لیست خالی

### لابراتوار ب: اشیا را بخونید

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

بائتهاي فيلد ها `00000000`. نامي که به جاي ديگري منتقل شده`.rodata`با اضافه کردن`0x10`، و ميز ميگه`[1, 2, 3, 4, 4]`. .

### لابراتوار C: یک ثابت را شکستن

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

بايت ها همديگه، سوابق همديگه و جدول ها همديگه نيست. حالا ویرایش کنید`grade_case10_wrong.c`پس`case 10`دوباره 4 را باز می گرداند، با دستور تنظیم مجدد آن را جمع آوری می کند و وضعیت را به  تغییر می دهد`pass`. .

### آزمایشگاه D: درایو ریا

با نصب REA 6.5.0 و Ghidra 12.1.4:

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
npx tsx code/main.ts --live
```

اولين`analyze_function`چند ثانیه طول می کشد تا Ghidra اشیاء را وارد کند. ID های جدید شواهد را با اجرا انجام شده مقایسه کنید. همان بائتهای تحت همان پروفایل تجزیه و تحلیل همان ID ها را می دهند، زیرا ID یک هاش محتوا است که مسیر فایل را خارج می کند.

## آزمایشگاه تمرین

هر دو پا رو به `total`و`grade_label`از همان جسم

الزامات:

- برای`total`سلول هایی را با تعداد 0، تعداد منفی، یک عنصر و مجموعی که در 32 بیت بسته می شوند بسازید.
- برای`grade_label`، تابع صدا می کند`grade`خط و متن`labels.rel`, جدول پنج تعویض رشته ای نسبی با نقل مکان های خود در `.rela.rodata`. .
- اضافه کنید`CLAIMS`ثبت نام برای `grade_label`با دو نقل مکان و یک جدول از پنج واردات 4 بایت، و مقایسه رشته های واردات اشاره به.
- ثبت کنید که کدام سلول ها مدل و اجرا در مورد آنها اختلاف دارند و هر کدام را از لیست توضیح دهید.
- یک ادعا را در هر پای در هر عملکرد به ثبت اثبات اضافه کنید و کل را بسته نگه دارید.

موفقیت به این معنی است که ثبت اثبات چهار تابع را فهرست می کند، هر ادعای دارای یک هویت شواهد است و`grade_label`وقتی یک رشته برچسب متفاوت باشد شکست می خورد.

## آزمایشگاه درجه بندی شده

پنج سوال در مورد نصبات این درس. هر جواب را با کد ساختی پیدا کن، سپس آن را به `code/lab_answers.json`. اعداد رو به عنوان اعداد یا به عنوان رشته های ششگانه بنویس`"0x40"`, و لیست ها به عنوان لیست JSON

1. `t1`: percent_change_model(3, 105) در x86_64.
2. `t2`: percent_change_model(0, 5) در x86_64.
3. `t3`: grade_model ((100)
4. `t4`: تعداد سلول ها در input_grid().
5. `t5`: تعداد سلول های شبکه ای که مدل x86_64 در آن گیر می کند.

جواباتتون رو چک کنيد:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
npx tsx code/lab.ts
```

چکگر هر ارزش انتظار شده را از  محاسبه می کند`code/main.py`بر روی وسایل بسته شده چاپ می کند`PASS`،`FAIL`یا`TODO`برای هر کار و یک امتیاز، و فقط وقتی که پنج مورد از آن عبور می کنند از صفر خارج می شود.`python3 code/lab.py my-answers.json`پرونده ي ديگه رو چک مي کنه`code/tests/test_lab.py`ثابت می کند که چک کننده پاسخ های درست را قبول کرده و پاسخ های اشتباه را رد کرده است.

### ببینیم که میره

.[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)این درس مرحله ای است که این ادعا را به یک ادعا تایید شده تبدیل می کند.

## مهارت های تولید

این درس به ما کمک می کند`outputs/skill-rebuild-and-prove-equal.md`. از آن برای تبدیل شواهد عملکرد و بازسازی یک کاندید به یک اثبات دو پای و یک ثبت اثبات استفاده کنید. مهارت نیاز به فهرست قبل از کد مخفف، یک شبکه با هر کلاس خطر، ماسک انتقال و یک چک ثابت و یک مجموعه شکست بسته است.

## بررسی کنید

نمایش و آزمايش را اجرا کنيد:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

35 تست ثابت ميکنه:

- `c_div()`به سمت صفر و `wrap32()`بعد از دو نفر
- مدل -133 برای `(3, INT_MAX)`،`trap`برای سلول های گیرنده در x86-64 و -2147483648 در AArch64
- شبکه 92 سلول و هر کلاس خطر داره و پرونده های ساده ای از هر کلاس سخت اجتناب می کنن
- خواننده ELF چهار تابع را در اندازه و تعویض ثبت شده پیدا می کند
- `percent_change`16 بايت بدون نقل مکان و`grade`يه نفر داره`R_X86_64_PC32`در`0x26`
- بائتهای میدان نقل مکان صفر هستند و پوشاندن هیچ تغییری در این شی RELA ندارد
- تمام هشت نامزد متعهد به وضعیت انتظار می رود، با دلایل ثبت شده
- `grade_case10_wrong`باایتهای پوشیده را رد می کند و تنها چک ثابت را شکست می دهد
- رنز های ثبت شده از پا اول نشان می دهد ده پاس ساده، 28 عدم مطابقت و اختلافات صفر مدل
- با یک کمپایلر، هر دو جفت دوباره ساخته و دوباره اجرا می شود با همان نتیجه
- هدف انجام شده توسط عامل توسط SHA-256 در ترتیب`ev_`شناسه ها در هر مرحله اثبات
- .`read_bytes`ثبت برابر با جدول که خواننده ELF پیدا می کند
- مشتری سرور جعلی را اجرا می کند و هویت های شواهد را با اجرا واقعی ثبت می کند
- یک نتیجه خطا از سرور وارد رکورد اجرا می شود
- `aggregate()`بسته شده و سند اثبات از محتوای آن محاسبه می شود

## روش های شکست تولید

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

## قاعده عملیاتی

بازسازی را از لیست بنویسید و نام رکورد را که از آن آمده است نام دهید. آن را با اصلی بر روی یک شبکه اجرا کنید که هر میانگین را بسته و هر ثابت مقایسه را عبور می کند. آن را با پرچم های اصلی جمع آوری کنید، زمینه های نقل مکان را پنهان کنید، رکورد ها را مقایسه کنید و ثابت هایی را که به آن اشاره می کنند بخوانید. هر ادعای را با هویت شواهد خود ثبت کنید و اجازه دهید ادعای غیر تأیید شده نامعلوم بماند.

## خواندن بیشتر

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
