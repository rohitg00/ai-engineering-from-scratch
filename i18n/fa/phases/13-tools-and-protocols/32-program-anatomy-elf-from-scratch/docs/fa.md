# آناتومی برنامه: یک خواننده ELF از ابتدا

> یک برنامه مرتب مجموعه ای از جدول هایی است که به یکدیگر اشاره می کنند. یک خواننده که شما نوشتید می دهد که می توانید باایت به باایت بررسی کنید.

**Type:** Build
**Languages:** Python (stdlib), TypeScript, C (fixture only)
**Prerequisites:** Phase 0 · 01 (Dev Environment) with clang installed, Python 3.10 or later, hexadecimal arithmetic
**Time:** ~120 minutes

## اهداف یادگیری

- قانون مجوز برای هر هدف در این مسیر و چهار محدودیت 17 USC 1201 ((f) را بیان کنید.
- سرنخ ELF، جدول سرنخ بخش و هر دو جدول رشته را با `struct.unpack`. .
- رمزگشایی`.symtab`نوشته ها و`.rela`سوابق با نام های gABI و x86-64 psABI
- بائتهای دقیق یک تابع به نام را برگردانید و هر فایل تعویض شده را به ساختار مالک آن نقشه بزنید.
- سرنخ برنامه ها را بخونید و یک آدرس مجازی را به یک فایل تعویض شده از طریق نقشه برداری کنید`PT_LOAD`. .
- دستورات بارگذاری یک شیوی ماچ-او را بخوانید و ایده ELF را که هر یک از آنها مطابقت دارد نام ببرید.

## قبل از شروع: مجوز و قانون

هر هدف در درس 32 تا 36 برنامه ای است که تو نوشتی و مرتب کردی`code/fixtures/ledger.c`شما مالک منبع، دستور ساز و فایل های شیری هستید که آن را تولید کرده است. هیچ مجوز برای خواندن وجود ندارد، هیچ محافظت برای گذراندن و هیچ شخص ثالثی که کد آن را باز می کنید. آهنگ هرگز حفاظت از نرم افزار، چک مجوز یا برنامه هایی را که شما مالک نیستید پوشش نمی دهد.

اين قاعده وجود داره چون قانون از خلع كننده به عنوان کپي کردن استفاده ميکنه در شرکت "سیگا شرکت های محدود" v. Accolade, Inc.*، 977 F.2d 1510 (9th Cir. 1992) دادگاه تصمیم گرفت که کپی های واسطه ای که در هنگام تجزیه ساخته شده، کپی های تحت قانون حقوق چاپ هستند. سپس این دادگاه اعلام کرد که "در صورتی که خلع واحد راه برای دسترسی به ایده ها و عناصر کاربردی موجود در یک برنامه کامپیوتری که تحت حقوق مالکیت است و در صورتی که دلیل مشروع برای جستجوی چنین دسترسی وجود دارد، خلع یک استفاده عادلانه از اثر تحت حقوق مالکیت است، به عنوان یک موضوع قانونی". 

پرونده دوم * Sony Computer Entertainment, Inc. v. Connectix Corp. *، 203 F.3d 596 (9th Cir. 2000). Connectix در حالی که یک شبیه ساز ساخته بود، نسخه های BIOS PlayStation را کپی کرد و دادگاه این کپی ها را استفاده عادلانه داد. هر دو پرونده مطالعه را محافظت می کردند. هیچ یک از کد کپی شده در محصول نهایی محافظت نمی کردند.

دو قانون محدودیت ها را تعیین می کنند. 17 قانون ایالات متحده 1201 ((ف) اجازه می دهد تا کسی که "حق استفاده از نسخه ای از یک برنامه کامپیوتری را به طور قانونی بدست آورده است" کنترل دسترسی را دور کند "به منظور شناسایی و تجزیه و تحلیل عناصر برنامه ای که برای دستیابی به قابلیت همکاری یک برنامه کامپیوتری مستقل با سایر برنامه ها ضروری است". چهار دسته محدودیت: یک کپی قانونی، هدف قابلیت همکاری، عناصر که قبلاً "به راحتی در دسترس نبودند" و تجزیه و تحلیل که به طور دیگر نقض نمی کند. بخش 1201 ((f) تنها استثنا از قانون ضد تجاوز است. سوال کپی کردن با استفاده عادلانه باقی می ماند.

در اتحادیه اروپا، ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (3) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (2) ماده 5 (3) ماده 5 (2) ماده 5 (2) ماده 5 (3) ماده 5 (2) ماده 5 (3) ماده 5 (2) ماده 5 (3) ماده 5 (2) ماده 5 (3) ماده 5 (2) ماده 5 (3) ماده 5 (3) ماده 5 (2) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 (3) ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 5 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6 ماده 6

ماده ۶ اجازه ی جمع آوری بدون اجازه صاحب حق را می دهد، زمانی که "حصول اطلاعات لازم برای دستیابی به قابلیت همکاری یک برنامه کامپیوتری مستقل ضروری است". شرایط مطابق با 1201 ((f) است. یک مجوزدار اعمال را انجام می دهد، اطلاعات قبلاً به راحتی در دسترس نبودند و اعمال در قسمت های لازم باقی می ماند. ماده 6 ((2) ممنوع است که از نتیجه برای هر هدف دیگر یا برای برنامه ای که در بیان به طور قابل توجهی مشابه است استفاده شود. ماده 8 شرایط قرارداد مخالف ماده 6 یا ماده 5 (3) را باطل می کند.

| Source | What it allows | Conditions |
|---|---|---|
| 17 U.S.C. 1201(f) | Circumventing an access control to analyze a program | Lawful copy, interoperability purpose, information not readily available, no infringement |
| Directive 2009/24/EC Art. 5(3) | Observing, studying, and testing a running program | A right to use the copy, acts within normal loading and running |
| Directive 2009/24/EC Art. 6 | Decompilation | Licensee, interoperability purpose, information not readily available, confined to the needed parts |
| *Sega v. Accolade* | Disassembly as fair use | The only way to reach the ideas and functional elements, a legitimate reason |
| *Sony v. Connectix* | Intermediate copies during reverse engineering | A non-infringing final product |

این یادداشت ها از قانون و نظرات آمده و مشاوره حقوقی نیستند. وقتی هدف آینده شما نیست، قبل از باز کردن پرونده و نگه داشتن گواهی با شواهد خود، مجوز نوشتاری دریافت کنید. بخش 2.1 از راهنمای مهندسی معکوس 101 به صورت کامل و پرونده های دادگاه اروپا اشاره دارد.

## مشکل

تو جمع آوری کردی`ledger.c`و فرار کرد`llvm-objdump -t`در مورد اين موضوع. فهرست هاي خروجي`percent_change`در ارزش`0000000000000000`با اندازه`0000000000000010`. کدام 16 بایت از فایل 1768 بایت این تابع هستند؟ لیست همچنین نشان می دهد`R_X86_64_PC32 .rodata+0x10`در تعویض`0x36`و چهار بایت در آن نقطه در فایل صفر است. آنها چه چیزی خواهد شد و چرا اضافه شده است`0x10`وقتی میز شروع میشه`0x14`؟

rea پاسخ به سوالات طرح با `inspect_binary_layout`، و اون ابزار فقط در لينوکس x64 با pwntools 4.15.0 وجود داره`REA_PWNTOOLS_PYTHON`. در اين مک از دست رفته`address_to_file_offset`نیاز به یک جلسه Ghidra و یک کپی کامل باایت های فایل اصلی با یک SHA-256 مطابقت دارد. `inspect_artifact`این صفحه به عنوان یک صفحه نمایش داده شده است که در آن آن ها موجود است. این صفحه هیچ وقت جدول های داخل یک فایل شی را باز نمی کند. بنابراین شما خود خواننده را در حدود 950 خط پایتون با`struct.unpack`و هيچ وابستگیي نداره.`llvm-objdump`متن یک بار به داخل چراغ ها ثبت شده

```figure
elf-byte-map
```

## فایل ها جدول هایی هستند که به جدول ها اشاره می کنند

سیستم V gABI، فصل 4، شکل 4-1 دو دیدگاه از یک فایل را می کشد. دیدگاه لینک یک سرپرست ELF، یک جدول سرپرست برنامه، بخش ها و یک جدول سرپرست بخش مورد نیاز را دارد. نمایش اجرای دارای یک سرپرست ELF، یک جدول سرپرست برنامه مورد نیاز، بخش ها و یک جدول سرپرست بخش اختیاری است. gABI یک جمله را اضافه می کند که کل خواننده را تحت کنترل قرار می دهد: "تنها سرنخ ELF دارای موقعیت ثابت در فایل است". هر ساختار دیگری توسط یک آفسیت ذخیره شده در ساختار دیگری یافت می شود.

gABI همچنین انواع مقیاس را اصلاح می کند و می گوید که "ELF از هیچ میدان بیت استفاده نمی کند". `Elf64_Addr`و`Elf64_Off`8 بایت است`Elf64_Half`2 است`Elf64_Word`4 است و`Elf64_Xword`x86-64 psABI، بخش 4.1.1، نیاز دارد`ELFCLASS64`،`ELFDATA2LSB`،`e_machine` `EM_X86_64`(62) و`e_flags`0. اندازه ی کوچک و دارای عرض ثابت`struct.unpack`با یک`<`پيشگويي هر سوابق رو در يک تماس ميخواد

اولين 64 بايت از `ledger-x86_64-O1.o`:

```text
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0100 3e00 0100 0000 0000 0000 0000 0000  ..>.............
00000020: 0000 0000 0000 0000 2804 0000 0000 0000  ........(.......
00000030: 0000 0000 4000 0000 0000 4000 0b00 0100  ....@.....@.....
```

اونها رو با صفحه "ELF Header" GABI ببين`e_ident`16 بايت است`7f 45 4c 46`(جادو) ، کلاس 2 (64-بایت) ، داده 1 (کوتاه-اندیان) ، نسخه 1، OS ABI 0 (سیستم V) و پوشاندن.

پس`e_type` `0x0001`.`ET_REL`، یک شی قابل انتقال`e_machine` `0x003e`62 است`EM_X86_64`.`e_entry`صفر است چون یک شی نقطه ورود ندارد. `e_phoff`صفر است چون یک شی هیچ عنوان برنامه ای ندارد.`e_shoff`.`0x428`, فایل تعویض جدول سرگویی بخش.`e_ehsize` `0x40`،`e_phentsize`0`e_phnum`0`e_shentsize` `0x40`،`e_shnum` `0x0b`(۱۱ سرنخ) و`e_shstrndx` `0x0001`. .

خواننده اون خط رو به يه تماس مي گيره:

```python
fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
```

رشته فرمت، شکل gABI است که از چپ به راست خوانده می شود: دو نیم کلمه، یک کلمه، سه ارزش 8 بایت، یک کلمه و شش نیم کلمه. خواننده یک فایل را که ترتیب جادویی، کلاس یا بایت متفاوت است رد می کند و رد می کند.`e_shentsize`یا`e_phentsize`با عرض اشتباه هر تعویض بعدی اشتباه می شود، بنابراین چک در بالای صفحه قرار دارد.

## عنوان بخش ها و دو جدول رشته ای

هر عنوان بخش یک `Elf64_Shdr`از 64 بایت (gABI شکل 4-8): `sh_name`،`sh_type`،`sh_flags`،`sh_addr`،`sh_offset`،`sh_size`،`sh_link`،`sh_info`،`sh_addralign`و`sh_entsize`. رشته فرمتي`<IIQQQQIIQQ`.`sh_name`یک تعویض به بخش که شاخص آن `e_shstrndx`، و نامش در اولین بايت صفر به پایان می رسد.`e_shstrndx`1 است و clang نام آن بخش را `.strtab`، بنابراین یک جدول هم نام بخش و هم نام نماد را خدمت می کند.

خواننده 11 سر را از -O1 پرینت می کند:

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

شاخص 0 عنوان صفر ذخیره شده است. `.text`159 بايت کد در فایل آفسه شده است`0x40`، درست بعد از سرش، با پرچم`A`(در حافظه اختصاص داده شده) و`X`(قابل اجرا)`.rodata`80 بایت اطلاعات فقط برای خواندن را در اختیار دارد. `.rodata.str1.1`پنج رشته برچسب را نگه دارد`F\0D\0C\0B\0A\0`، 10 بايت، با پرچم`M`(مربوط) و`S`(حافظه ها)

`.comment`نماد 47 بايت را در دست دارد`\0Apple clang version 17.0.0 (clang-1700.6.3.2)\0`.`.llvm_addrsig`نوع داره`0x6fff4c03`، در محدوده خاص سیستم عامل`SHT_LOOS`به`SHT_HIOS`که ذخایر gABI و LLVM `ELF.h`اسمش رو به اون بزنه پرچمش رو به اون بزنه`E`.`SHF_EXCLUDE`، پس یه لینکر میذاره

.`sh_link`و`sh_info`ستون ها نشان دهنده های بین جدول ها هستند. `.rela.text`.`sh_info`2 و `sh_link`10: بخش 2 را اصلاح می کند و نمادهای خود را از بخش 10 می گیرد.`.symtab`.`sh_link`1، جدول رشته ای برای نام های نماد و `sh_info`9, شاخص اولین نماد غیر محلی. `sh_addr`صفر در هر ردیف است چون یک شی هنوز آدرس ندارد. لینکر آنها را اختصاص می دهد.

دو قانون gABI اجازه می دهد تا خواننده یک نقشه کامل از فایل را رسم کند. بخش ها "مقابل است و تعادل ندارند" و یک فایل "می تواند فضای غیرفعال را داشته باشد". خواننده هر ساختار را با تعویض طبقه بندی می کند و سوراخ ها را پر می کند:

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

سه شکاف به مجموع 10 بایت است و هر یک از آنها تعادل است.`.rodata`.`sh_addralign`8، پس شروع میشه`0xe0`به جای`0xdf`.`.symtab`خط 8 داره پس 7 بايت بعد ازش استفاده نشده`.comment`جدول سرنخ بخش خودش به 8 هموار شده

بخش های نوع`SHT_NOBITS`هیچ بائتی فایل را در اختیار نمی گیرد، بنابراین نقشه آنها را رد می کند. هیچ چیز در این شی دارای این نوع نیست.`.bss`در برنامه مرتبط هست و یک خواننده که به او اعتماد داره`sh_size`اون جا نوشته شده که پرونده رو رد کرده

## نماد: پیوند، نوع، بخش، ارزش، اندازه

یک`Elf64_Sym`24 بایت است (گابای شکل 4-18): `st_name`،`st_info`،`st_other`،`st_shndx`،`st_value`،`st_size`، شکل`<IBBHQQ`.`st_info`بسته بندی دو میدان: پیوند در چهار بیت بالا و نوع در چهار پایین. gABI نام های پیوند `STB_LOCAL`0`STB_GLOBAL`1، `STB_WEAK`۲، و انواع`STT_NOTYPE`0`STT_OBJECT`1، `STT_FUNC`۲، `STT_SECTION`۳، `STT_FILE`۴. دو قطعه پایین از`st_other`در نظر گرفتن دید`STV_DEFAULT`0 در تمام این جا

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

شاخص 0 نماد غیر تعریف شده مخصوص است. `st_shndx`بخش تعریف کننده نماد را با سه مقدار ذخیره نام می دهد: `SHN_UNDEF`0`SHN_ABS` `0xfff1`برای نام فایل و`SHN_COMMON` `0xfff2`نماد بخش ها اسم خالی دارن، پس`llvm-objdump`نام بخش را برای آنها چاپ می کند و خواننده نیز همین کار را می کند. قاعده gABI که "همه نمادها با پیوند STB_LOCAL قبل از نمادهای ضعیف و جهانی" به عنوان نه ردیف اول ظاهر می شود و `.symtab`ثبت شده 9 در `sh_info`به همین دلیل

در یک شی قابل انتقال`st_value`یک تعویض در داخل بخش نماد است، چون`sh_addr`صفر است. پس فایل تعویض یک تابع`sh_offset + st_value - sh_addr`و طولش هم`st_size`:

```python
section = elf.sections[symbol.st_shndx]
file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
code = elf.data[file_offset : file_offset + symbol.st_size]
```

برای`percent_change`اینا`0x40 + 0`، و 16 بايت`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`اندازه ها هم مثل شروع مهمه`grade`در `.text`تعویض`0x3e`. دو بايت`66 90`که دنباله دار هستند`nop`کمپایلر اضافه شده تا`total`شروع می شه`0x40`درسي 33 استفاده ميکنه`st_size`و درس 36 آنها را قبل از مقایسه بازسازی، پنهان می کند.

## نقل مکان: معنی صفر بایت

یک`Elf64_Rela`24 بایت است (گابای شکل 4-23): `r_offset`،`r_info`و امضا شده`r_addend`، شکل`<QQq`. گابي دوتا مي شود`r_info`با دو ماکرو: `ELF64_R_SYM(i)`.`i >> 32`و`ELF64_R_TYPE(i)`.`i & 0xffffffff`. در پرونده ي قابل انتقال`r_offset`یک تعویض در داخل بخش نامگذاری شده توسط جدول است `sh_info`نام ها و فرمولا از x86-64 psABI، جدول 4.9 آمده است.`S`ارزش نماد است، `A`اضافه کننده`P`محل که درست می شود و`L`ورودی PLT`R_X86_64_64`.`S + A`،`R_X86_64_PC32`.`S + A - P`و`R_X86_64_PLT32`.`L + A - P`. .

-O1 8 تا رکورد داره

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

اولين رو از هم جدا کن`0x36`در داخل`grade`، که در طولش`0x10`به`0x3e`. آموزش در`0x33`.`48 8d 0d 00 00 00 00`، یک`lea`از یک آدرس مربوط به RIP، و تغییر مکان چهار بیت آن در `0x36`. پردازنده، جابجا شدن را به آدرس دستورات بعدی اضافه می کند`0x3a`. .

کامپایلر میخواد نتیجه اش باشه`.rodata + 0x14`، جایی که یک جدول پنج ورودی با 32 بیت ارزش دارد `1, 2, 3, 4, 4`پس ارزش ذخیره شده باید`(.rodata + 0x14) - 0x3a`. فرمول`S + A - P`با`P = 0x36`می دهد`.rodata + A - 0x36`. تنظیم دو برابر به دست می آید`A = 0x14 - 4 = 0x10`. اضافه کردن هدف را از بین چهار بایت بین جابجایی و پایان دستورالعمل می برد.

این جدول اینه که چطور clang جمع آوری کرد`switch`در`grade`در -O1 کد حساب می کنه`score / 10`با ضرب از `0x66666667`و دو تغییر، از 6 تخفیف می کند، با 4 مقایسه می کند و جدول را شاخص می کند. شیء -O1 ELF هیچ نماد برای جدول را حفظ نمی کند. مرجع نماد بخش است `.rodata`و فقط ساخت بازي 64 از همان منبع نامش را مي دهد`l_switch.table.grade`. دوين رکورد، در`0x84`در`grade_label`, نقطه ها در جدول دوم با ارزش های 8 بایت در `.rodata + 0x28`سومين، در`0x93`، اشاره به`.rodata + 0x0`، آغاز`labels.rel`. .

پنج نفر`.rela.rodata`ثبتات پر شود`labels.rel`. هر ورودی در تعویض قرار داره`4i`و به دست آوردش اضافه می شود`4i`، پس`S + A - P`به عنوان آدرس رشته کاهش می یابد.`grade_label`يه نوشته رو با `movslq`, پایه میز را به عقب می اندازد و اشاره را دارد. اولین رکورد نماد بخش را نام می دهد`.rodata.str1.1`با اضافه کردن 0 چون رشته `F`این اولین بائته ی این بخش است. بقیه نامها`.L.str.1`به`.L.str.4`، برچسب های محلی کامپایلر برای`D`،`C`،`B`و`A`. .

همان منبع به سه جدول مختلف در سه سطح بهینه سازی ترکیب می کند. خواننده تفاوت را بدون یک جداکننده نشان می دهد:

| Build | Where `labels` lives | How `grade` selects | How `grade_label` reaches `grade` |
|---|---|---|---|
| -O0 | `.data`, five 8-byte pointers, five `R_X86_64_64` records | A jump table in `.rodata`: five `R_X86_64_PC32` records pointing into `.text` | A call with `R_X86_64_PLT32 grade-0x4` |
| -O1 | `.rodata` as `labels.rel`, five 32-bit relative entries | A value table at `.rodata+0x14`, one `R_X86_64_PC32` | Inlined, no call |
| -O2 | Same as -O1 | Same as -O1 | Inlined, `total` grows to 140 bytes |

در -0`switch`يه ميز واقعي است که پنج تا ورودي به سمتش مياد`.text`در`+0x91`،`+0x8c`،`+0x87`،`+0x82`و`+0x86`. تماس با`grade`همش رو حمل ميکنه`-0x4`به همین دلیل که`lea`در -O1 بهینه ساز دید که هر مورد ثابت را باز می گرداند و پرش ها را با جدول نتایج جایگزین کرد. درس 33 هر دو شکل را رمزنگاری می کند.

## عنوان برنامه ها: دیدگاه بارگذاری

يه شيوه ي ي يابين جا نيست، پس`e_phnum`یک اجراء یا یک شی مشترک آنها را دارد و بارگذاریگر چیزی دیگر نمی خواند.`Elf64_Phdr`56 بایت است (نمای 5-1 GABI): `p_type`،`p_flags`،`p_offset`،`p_vaddr`،`p_paddr`،`p_filesz`،`p_memsz`،`p_align`، شکل`<IIQQQQQQ`. گابي سه قانون براي`PT_LOAD`. واردات . در بالا رفتن ظاهر می شوند`p_vaddr`دستور و یک`p_memsz`بزرگتر از `p_filesz`یعنی صفر پر شدن`p_vaddr`همگام است`p_offset`ماژول`p_align`. .

هر هدف در این آهنگ یک برنامه ای است که شما ساخته اید و هیچ لینکر در این مک تولید یک لینوکس اجرا از `ledger.o`پس اين دستگاه`tiny-x86_64`از`code/fixtures/build_tiny_elf.py`، که 736 بايت با `struct.pack`. فایل يه سرپرستي ELF، دو سرپرستي برنامه، يک 36 بايت داره`_start`، یک 3 بايت`.rodata`، یک جدول نماد و شش عنوان بخش`_start`نوشته شده`ok\n`در لینوکس x86-64 اجرا می شود. اینجا یک فستور برای مسیر عنوان برنامه است.

```text
Program headers:
  PT_LOAD          r-x offset=0x0 vaddr=0x400000 filesz=0x2e0 memsz=0x2e0 align=0x1000
  PT_GNU_STACK     rw- offset=0x0 vaddr=0x0 filesz=0x0 memsz=0x0 align=0x10

entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

تک آهنگ`PT_LOAD`نقشه کل فایل 736 بايت را در `0x400000`. خواننده با پیدا کردن `PT_LOAD`که شامل آن و محاسبات است`p_offset + (address - p_vaddr)`. برای نقطه ورود که`0 + (0x4000b0 - 0x400000) = 0xb0`، آغاز`.text`. .

اين حسابي پشت رياست`address_to_file_offset`براي يه هدف گيدرا، اون ابزار بازميگرده`{address, file_offset}`.برندگان هاپر هم برگردن`provider_file_offset`و`image_base_file_offset`. ابزار نیاز به یک نسخه اصلی کامل از پرونده دارد و SHA-256 از آن نسخه باید با هدف مطابقت داشته باشد.`inspect_binary_layout`یک خط برای حفظ اضافه می کند: " یک آدرس مرتبط آدرس زمان اجرا نیست". یک بارگذاری قابل اجرا مستقل از موقعیت در پایه ای که هسته انتخاب می کند ، و تعویض فایل تنها هماهنگی پایدار است.

عنوان های برنامه همچنین توضیح می دهند که چرا یک اجراگر خالی هنوز اجرا می شود. یک لینکر می تواند جدول عنوان بخش را کاملا حذف کند و `e_shoff`یک ابزار که بخش ها را حرکت می دهد هیچ چیز را نمی بیند. بارنده هرگز به آنها نگاه نمی کند.

## ایده های مشابه در Mach-O

اپل هیچ مشخصات پروزی برای Mach-O را منتشر نمی کند. سرنخ های منبع XNU مشخصات هستند: `EXTERNAL_HEADERS/mach-o/loader.h`،`nlist.h`و`reloc.h`. سازش`ledger-arm64-O1.o`همش همینطوره`ledger.c`با ساخت`clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c`. .

A`mach_header_64`32 بايت است: `magic`،`cputype`،`cpusubtype`،`filetype`،`ncmds`،`sizeofcmds`،`flags`،`reserved`جادويي اينه`0xfeedfacf`،`MH_MAGIC_64`.`cputype`.`0x0100000c`،`CPU_TYPE_ARM64`.`filetype`1 است`MH_OBJECT`.`ncmds`5 و `sizeofcmds`616 است: دستورات بارگیری 616 بایت را پس از سر و کله اش می گیرد و هر یک از آنها با  شروع می شود`{cmd, cmdsize}`. پرچم`0x2000`.`MH_SUBSECTIONS_VIA_SYMBOLS`. .

```text
Load commands:
  0 LC_SEGMENT_64                cmdsize=472 at 0x20
  1 LC_BUILD_VERSION             cmdsize=24 at 0x1f8
  2 LC_LINKER_OPTIMIZATION_HINT  cmdsize=16 at 0x210
  3 LC_SYMTAB                    cmdsize=24 at 0x220
  4 LC_DYSYMTAB                  cmdsize=80 at 0x238
```

`LC_SEGMENT_64`(0x19) پاسخ Mach-O برای هر دو جدول ELF است.`segment_command_64`.`segname`،`vmaddr`،`vmsize`،`fileoff`،`filesize`،`maxprot`،`initprot`،`nsects`و`flags`پس`nsects`سوابق نوع`section_64`،80 بايت هرکدوم، با همون دستور عمل کنين`loader.h`نظرش در مورد`MH_OBJECT`می گوید بخش ها در یک بخش نامناسب بدون پوشاندن بخش زندگی می کنند.`fileoff`648،`filesize`456 و پنج بخش

```text
  Idx Section                    Addr   Size Offset Reloff Nreloc Type
    1 __TEXT,__text               0x0   0xd0    648   1104      6 S_REGULAR
    2 __DATA,__const             0xd0   0x28    856   1152      5 S_REGULAR
    3 __TEXT,__cstring           0xf8    0xa    896      0      0 S_CSTRING_LITERALS
    4 __TEXT,__const            0x108   0x40    912      0      0 S_REGULAR
    5 __LD,__compact_unwind     0x148   0x80    976   1192      4 S_REGULAR
```

هر بخش به بخش اصلی خود نام می دهد`segname`، پس دو بخش به نام`__const`فرق داره چون یکی از اونا`__DATA,__const`و اوني ديگه`__TEXT,__const`. نقل مکان ها به هر بخش از`reloff`و`nreloc`، جایی که ELF دارای یک جدا شده است`.rela.X`بخش به هر هدف

هرکدوم`relocation_info`8 بايت است.`r_address`اول می آید. یک فیلد 32 بیت بعد می آید، بسته بندی شده به عنوان`r_symbolnum`(24 بت)`r_pcrel`(1) `r_length`(2) ، `r_extern`(1) و`r_type`(4) شش`__text`سوابق سه جفت است`ARM64_RELOC_PAGE21`و`ARM64_RELOC_PAGEOFF12`، یک جفت برای هر میز مرجع.`adrp`و اضافه`add`چه کاري ميکنه؟`lea`آره، پس هر مرجع به دو پرونده نیاز داره.`__DATA,__const`سوابق ها`ARM64_RELOC_UNSIGNED`با`r_length`3، پس هر یک از آنها یک شاخص مطلق 8 بایت را درست می کند.

در -O1 ساخت دست64 حفظ شد`labels`به عنوان اشاره های ساده که در آن x86-64 ساخت یک جدول نسبی ساخته شده است.

`LC_SYMTAB`(0x2) نگه داره`symoff`1240،`nsyms`17،`stroff`1512،`strsize`176 و 1512 + 176، 1688 است، اندازه فایل. هر یک.`nlist_64`16 بايت است: `n_strx`،`n_type`،`n_sect`،`n_desc`،`n_value`.`n_type`یه میدان کمی است`N_TYPE`(ماسک)`0x0e`) برابر به `N_SECT`(`0xe`) معنی آن در بخش تعریف شده است که حکم 1 است`n_sect`.`N_EXT`(`0x01`) یک نماد خارجی را نشان می دهد.

`nlist_64`برای گرفتن 24 بایت از`_percent_change`خواننده آدرس علامت بعدی را در همان بخش می گیرد.`_grade`در`0x18`. نماد C نماد اولي داره`_`اینجا، بنابراین تابع است`_percent_change`. .

`LC_DYSYMTAB`(0xb) همان قانون اول محلی را با ELF ثبت می کند `sh_info`.`ilocalsym`0`nlocalsym`13،`iextdefsym`13،`nextdefsym`۴.`LC_BUILD_VERSION`(0x32) ثبت شده`platform`1 (macOS) ، `minos`۲۶.۰ و`sdk`26.2 بسته بندی شده`XXXX.YY.ZZ`این دستور است که دلیل این است که دستگاه arm64 به عنوان بائتهای انجام شده است. ساخت یک Mac با SDK دیگر یک فایل متفاوت تولید می کند.

. خواننده`compare_formats`دو پرونده را کنار هم قرار می دهد:

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

"آریا" میخواد "ماچ" رو از طریق "`inspect_macho`، که اجرا مي کنه`otool -h -l`،`nm -gjU`،`dyld_info -imports -exports`و`dwarfdump --uuid`از طریق`xcrun`خواننده شما به هیچکدوم از این ها نیاز نداره و همین رو میخواد`symoff`و`stroff`این`otool -l`. اثر انگشت`open_binary`ابزار ریا ELF، MZ، PE و نازک یا جهانی Mach-O را از بایت های جادویی تشخیص می دهد.`e_machine`این اولین 20 بایت از آنچه که شما در اینجا ساخته اید است. برای یک فایل بدون سر و کله، شما می دهید`format: raw-binary`.سازش و آدرس ورود. ارائه دهنده Ghidra یک دوگانه جهانی را رد می کند و از یک قطعه نازک می خواهد. خواننده شما همین کار را می کند وقتی می بیند`0xcafebabe`. .

## آن را بسازید

خواننده استاندارد کتابخانه رو اجرا کن:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
```

نمایش نوشته شده`ledger-x86_64-O1.o`و سر و قسمت، بخش ها، نمادها، نقل مکان ها و نقشه تعویض فایل را چاپ می کند. سپس چهار رشته بایت تابع را چاپ می کند، می خواند `ledger-arm64-O1.o`و جدول مقایسه را چاپ می کند.`tiny-x86_64`. خط هاي انتظار شده:

```text
percent_change: 16 bytes at file offset 0x40: 85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3
grade: 46 bytes at file offset 0x50: 48 63 c7 48 69 c0 67 66 66 66 ...
entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

مسیر را برای خواندن یک فایل عبور کنید: `python3 code/main.py code/fixtures/ledger-x86_64-O0.o`خواننده از چهار بايت اول ELF یا Mach-O را انتخاب مي کند.

بخون`code/main.py`در این ترتیب:

1. `ElfFile._read_header()`جادو، کلاس، ترتيب بايت و اندازه ورودي را چک مي کند، سپس سرگير را باز مي کند.
2. `ElfFile._read_sections()`و`read_cstring()`جدول سرگوه بخش را بخوانید و نام ها را از طریق  حل کنید`e_shstrndx`. .
3. `ElfFile._read_symbols()`تقسیم شدن`st_info`، اسم ها رو حل ميکنه`sh_link`، و شاخص های بخش رزرو شده را قابل خواندن نگه می دارد.
4. `ElfFile._read_relocations()`هر بار راه میره`SHT_RELA`بخش، تقسیم`r_info`, و انواع نام از جدول 4.9.
5. `ElfFile.function_span()`و`function_bytes()`یک نماد را به یک دامنه فایل و بائتهای آن تبدیل کنید.
6. `ElfFile.file_offset_map()`هر ساختار را با تعویض طبقه بندی می کند و فضای غیرفعال را پر می کند.
7. `ElfFile._read_program_headers()`و`address_to_file_offset()`دستکاری های اجرا کننده
8. `MachOFile`سر و کله رو ميخواد، فرمان هاي بار رو ميخواد`LC_SEGMENT_64`با بخش های آن،`LC_SYMTAB`،`LC_BUILD_VERSION`، و نقل مکان در هر بخش
9. `compare_formats()`اسم ها در هر دو پرونده با ارزش های خوانده شده از هر یک از آنها به عنوان یک ایده است.

## ازش استفاده کن

و درآمدی خواننده از درس های بعدی با `from main import ElfFile`بعد از اضافه کردن درس`code`فهرست به `sys.path`درس 33 ازش ميخواد`function_bytes`و`relocations_for(".text")`دروس 35 به عنوان شواهد مشاهده شده، تولید آن را ثبت می کند. دروس 36 از آن می خواهد که تعویضات نقل مکان را قبل از مقایسه باایت ها پنهان کند.

خودتون را به C خودتون به یک شی با همان`clang -target x86_64-unknown-linux-gnu -c`فرمان و اجرا خواننده در آن. فقط زمانی که x86-64 psABI جدول 4.9 آن را لیست می کند نام نقل مکان را اضافه کنید. فقط زمانی که gABI یا زنجیره ابزار تولید کننده آن را مستند کند، یک نوع بخش را اضافه کنید. هنگامی که خواننده با یک مقدار که نام ندارد ملاقات می کند، تعداد را به جای حدس زدن به صورت شش اعشاری چاپ می کند.

## آزمایشگاه تعاملی

### آزمایشگاه A: سرنخ دست

از`code`دایرکتوری، پیتون باز:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code
python3 -q
```

راه رفتن:

```python
import struct
from main import ElfFile, FIXTURES
data = (FIXTURES / "ledger-x86_64-O1.o").read_bytes()
data[:4], data[4], data[5]
struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
elf = ElfFile(data)
elf.header.e_shoff, elf.header.e_shnum, elf.sections[elf.header.e_shstrndx].name
```

توپل نشان میده`e_type`1، `e_machine`۶۲، و`e_shoff`1064، که`0x428`. آخرين خط نشان ميده که بخش 1`.strtab`، اسم بخش ها رو نگه داره

### آزمایشگاه B: جدول ارزش پشت سوئیچ

```python
rodata = elf.section_bytes(elf.section(".rodata"))
[int.from_bytes(rodata[i : i + 4], "little") for i in range(0x14, 0x28, 4)]
[int.from_bytes(rodata[i : i + 8], "little") for i in range(0x28, 0x50, 8)]
[r for r in elf.relocations_for(".text") if r.symbol == ".rodata"]
```

هر دو جدول رو مطالعه کن`1, 2, 3, 4, 4`. با اونها رو چک کن`ledger.c`.`grade(65)`حساب ها`65 / 10 - 6 = 0`و نوشته شده در 0 که 1 است، ارزش `case 6`.`grade(100)`نوشته شده در 4، که 4 است، ارزش مشترک توسط `case 10`و`case 9`. .

### آزمایشگاه C: سه ساخت یک منبع

```python
for level in ("O0", "O1", "O2"):
    obj = ElfFile.from_path(FIXTURES / f"ledger-x86_64-{level}.o")
    print(level, [s.name for s in obj.sections if s.name in (".data", ".rodata")])
    print(level, sorted({r.type_name for r in obj.relocations}))
    print(level, {s.name: s.st_size for s in obj.symbols if s.type == "FUNC"})
```

-0 رو به صورت -0`.data`بخش و سه نوع نقل مکان.`.data`و يه نوع`total`66 بایت در -O0، 31 در -O1 و 140 در -O2 است.

### آزمایشگاه D: همان عملکرد در Mach-O

```python
from main import MachOFile
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
[(c.name, c.cmdsize) for c in macho.load_commands]
macho.function_span("_percent_change")
macho.function_bytes("_percent_change")[:4].hex()
```

طول زمان 24 بایت در فایل 648 است. چهار بایت اول`a0000034`، شکل کوچولو اين آموزش ها`0x340000a0`، که`llvm-objdump -d`چاپ شده`cbz w0, 0x14`. اينم`before == 0`محافظ، همان تست که ساخت x86-64 به عنوان`85 ff 74 09`. .

## آزمایشگاه تمرین

در یک ماشین لینوکس x86-64، ساخت `clang -O1 -shared -fPIC code/fixtures/ledger.c -o libledger.so`و`clang -O1 code/fixtures/ledger.c -o ledger_main`با یک`main`شما اضافه می کنید، سپس خواننده را روی هر دو اجرا کنید.

الزامات:

- بخون`.dynsym`با هم`Elf64_Sym`طرح، از زمان`SHT_DYNSYM`11 و سابقه هم بدون تغییر
- بخون`.dynamic`مثل`Elf64_Dyn`ثبت`d_tag`و`d_val`و اسمش`DT_NEEDED`،`DT_STRTAB`،`DT_SYMTAB`،`DT_RELA`و`DT_JMPREL`از صفحه gABI "قسم دینامیک"
- نماد های نامحدود را با  فهرست کنید`st_shndx` `SHN_UNDEF`به عنوان واردات و`R_X86_64_JUMP_SLOT`ثبت شده در `.rela.plt`به عنوان سایت های تماس که به آنها می رسد.
- نقشه هرکدوم`PT_LOAD`بخش به بخش هایی که در آن است، با استفاده از قانون gABI که "یک بخش فایل شی حاوی یک یا چند بخش است".
- ثابت کن`address_to_file_offset`که بائتهای هر تابع تعریف شده در شی مشترک بائتهایی هستند`function_bytes`باز می گردد
- دستگیرش کن`llvm-objdump -h -t -r -p`و`llvm-objdump -T`متن برای هر دو فایل وارد `code/fixtures/`و خواننده را با آنها در آزمون مقایسه کنید.

موفقیت به این معنی است که لیست واردات، نقشه بخش و هر محدوده عملکرد با محصول ابزار ضبط شده موافق هستند، بدون اجرای ابزار در طول آزمایشات.

## آزمایشگاه درجه بندی شده

پنج سوال در مورد نصبات این درس. هر جواب را با کد ساختی پیدا کن، سپس آن را به `code/lab_answers.json`. اعداد رو به عنوان اعداد یا به عنوان رشته های ششگانه بنویس`"0x40"`, و لیست ها به عنوان لیست JSON

1. `t1`: e_shoff از دفترچه x86_64-O1.o به عنوان یک عدد.
2. `t2`: st_size of percent_change در دفترچه x86_64-O1.o
3. `t3`: فایل تعویض .text در دفترچه-x86_64-O1.o، به عنوان hex.
4. `t4`: نام های نوع نقل مکان در دفترچه x86_64-O0.o، به عنوان یک لیست مرتب شده است.
5. `t5`: پنج مقدار int در .rodata+0x14 در دفترچه x86_64-O1.o، به عنوان یک لیست.

جواباتتون رو چک کنيد:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/lab.py
npx tsx code/lab.ts
```

چکگر هر ارزش انتظار شده را از  محاسبه می کند`code/main.py`بر روی وسایل بسته شده چاپ می کند`PASS`،`FAIL`یا`TODO`برای هر کار و یک امتیاز، و فقط وقتی که پنج مورد از آن عبور می کنند از صفر خارج می شود.`python3 code/lab.py my-answers.json`پرونده ي ديگه رو چک مي کنه`code/tests/test_lab.py`ثابت می کند که چک کننده پاسخ های درست را قبول کرده و پاسخ های اشتباه را رد کرده است.

### ببینیم که میره

.[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)ماشین این درس را به عنوان دو ایستگاه اولش اجرا می کند. ریل سر را از فایل شی که نگه دارد می خواند`percent_change`، و کابينت باز ميشه`.text`علامت ها را خاموش کنید تا ببینید جدول علامت چه حقایق را دارد.

## درس هنرپیشه

این درس به ما کمک می کند`outputs/skill-program-anatomy-elf-from-scratch.md`. با کلوید، کورسور، کودکس، OpenClaw، هرمز، یا هر عامل دیگری که SKILL.md را می خواند استفاده کنید. این مهارت یک شی یا قابل اجرا را که کاربر در یک گزارش طرح ساخته است تبدیل می کند. گزارش دامنه فایل هر ساختار، نماد و نقل مکان را می دهد، با محصول ابزار ضبط شده بررسی می شود.

## بررسی کنید

نمایش و مجموعه تعیین کننده را اجرا کنید:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

جنازه ثابت ميکنه:

- هر بخش، اسم، اندازه، آدرس و نوعي که با دستگير شده ها مطابقت داره`llvm-objdump -h`متن برای سه شی x86-64 و اجرا قابل انجام کوچک
- هر ارزش نماد، پیوند، نوع، بخش، اندازه و نام با ضبط شده مطابقت دارد `llvm-objdump -t`متن
- هر تعویض نقل مکان، نام نوع، نماد و اضافه با دستاورده ها مطابقت دارد`llvm-objdump -r`متن، از جمله `R_X86_64_PLT32`و`R_X86_64_64`در -O0
- هر دو سرپرست برنامه`tiny-x86_64`با دستگير ها مطابقت داشته باش`llvm-objdump -p`متن، و اشیاء هیچ
- `percent_change`16 بايت در تعویض فایل است`0x40`با بايت هاي انتظار مي رود و هر تابع در داخلش قرار داره`.text`
- نقشه تعویض فایل هر بایت هر دستگاه را یک بار پوشش می دهد، با سه شکاف تعویض اشیاء -O1 در مکان های خود
- نقطه ورود `tiny-x86_64`نقشه ها برای فایل های تعویض`0xb0`از طریق`PT_LOAD`، و یک شی قابل انتقال از نقشه برداری آدرس ها رد می کند
- سرش ميچ-او، هر فرمان بار، بخش، پنج بخش`LC_SYMTAB`و`LC_BUILD_VERSION`با دستگير ها مطابقت داشته باش`--private-headers`متن
- نماد هاي ماش او و 15 تغيير مکاني با نيروهاي دستگير شده مطابقت ميکنه`llvm-objdump`متن و`_percent_change`24 بایت در 648 آفسه
- یک جادوی اشتباه، یک کلاس ۳۲ بت، یک فایل بزرگ، یک جدول کوتاه، یک دوگانه جهانی، و یک فایل منبع C همه بالا می روند.`FormatError`
- `build_tiny_elf.py`تکرار کرده است`tiny-x86_64`بایت برای بایت
- ماژول ارقام`site/figures-re-32.js`با کت های دقیق `ledger-x86_64-O1.o`

## روش های شکست تولید

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

## قاعده عملیاتی

در این بخش، شما می توانید یک عنوان را بخوانید که می توانید به آن اعتماد کنید، از تعویضات آن پیروی کنید و هر فیلدی را از مشخصات که آن را تعریف می کند نام دهید. محصول ابزار را که با آن مقایسه کرده اید به عنوان یک ابزار متعهد نگه دارید، بنابراین مقایسه بدون ابزار اجرا می شود. هنگامی که یک مقدار نامی در مشخصات ندارد، شماره را چاپ کنید. خواننده ای که می توانید باایت به باایت بررسی کنید، آن است که هر درس بعدی بر آن بنا می شود.

## خواندن بیشتر

- [System V gABI, chapter 4: Object Files](https://www.sco.com/developers/gabi/latest/ch4.intro.html)و[ELF Header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html)،[Sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html)،[Symbol Table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html)و[Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)صفحات
- [System V gABI, chapter 5: Program Header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html)و[Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V ABI, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI), جدول 4.9 انواع نقل مکان
- [Apple XNU `loader.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)،[`nlist.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)و[`reloc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/reloc.h)
- [17 U.S.C. 1201](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section1201&num=0&edition=prelim)و[Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng)
- [Sega v. Accolade, 977 F.2d 1510](https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html)و[Sony v. Connectix, 203 F.3d 596](https://law.resource.org/pub/us/case/reporter/F3/203/203.F3d.596.99-15852.html)
- [rea 6.5.0 `docs/binary-diagnostics.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/binary-diagnostics.md)و[`docs/ghidra-provider.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
