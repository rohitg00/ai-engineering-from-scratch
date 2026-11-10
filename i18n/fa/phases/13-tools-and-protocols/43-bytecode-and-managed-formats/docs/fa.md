# فراتر از کد بومی: پایتون، JVM، .NET و Bytecode WebAssembly

> یک فایل بایت کد یک برنامه و یادداشت های سازنده در مورد آن است، و این درس خوانندگان را ایجاد می کند که نشان می دهد هر کانتینر کدام یادداشت را نگه می دارد.

**Type:** Build
**Languages:** Python, TypeScript, Java, C#, WebAssembly text
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow)
**Time:** ~150 minutes

## اهداف یادگیری

- 16-byte رو بخونيد`.pyc`سرنخ از PEP 552 و رمز را بدون `marshal`ماژول برای فایل هایی که توسط چهار نسخه مترجم نوشته شده است.
- تجزیه یک فایل کلاس JVM از JVMS فصل 4: مجموعه ثابت، زمینه ها، روش ها، `Code`ویژگی و جدول هایی که`javac -g`اضافه می کنه
- کد های JVM را در  جدا کنید`Ledger.class`و اثبات ثبت نام در مقابل`javap -c`بر روی چهار ساختاری از همان منبع
- بخش ماژول WebAssembly را به بخش بخونید، هر بدن عملکرد را رمزگذاری کنید و نتیجه را با `wasm-objdump -d`. .
- از دایرکتوری داده های PE به `MethodDef`ردیف ها و CIL هر روش، با کتابخانه خواننده ای که ILSpy استفاده می کند بررسی می شود.
- اندازه گیری، برای یک تابع در پنج ظرف، کدام نام، نوع و ساختار کنترل هر فرمت نگه دارد و کدام را از دست می دهد.

## مشکل

تو ساختي`ledger.py`و پیدا شد`ledger.cpython-314.pyc`در`__pycache__`از يه مامور پرسيديد که پرونده چي هست، مامور يه دستگاه تخريب کننده رو اجرا کرد`Unsupported opcode`و یک خط که میگه`# WARNING: Decompyle incomplete`مامور نتیجه گرفت که پرونده ها پوشيده شده

پرونده رو پوشيده نکرد دو بايت اولش`2b 0e`این عدد CPython 3.14 می نویسد و جدول های کد آپکامپایلر در 3.13 متوقف می شوند. این ابزار قدیمی بود. عامل سر را نمی خواند، بنابراین نمی توانست تفاوت را تشخیص دهد.

درس 33 نشان داد که کد بومی چه چیزی را از دست می دهد: نام پارامتر، انواع و `switch`که تبدیل به یک میز پرتاب شد. کانتینر های بایت کد کمتر از دست می دهند و هر کدام چیزی متفاوت از دست می دهند. یک pyc هر نام متغیر را نگه می دارد و هیچ نوعی ندارد. یک فایل کلاس فقط زمانی که شما درخواست کنید نوعها و نام های محلی را حفظ می کند. یک ماژول Wasm ساختار کنترل را حفظ می کند و نام ها را می گذارد مگر اینکه بخش سفارشی آنها را حمل کند. یک مجموعه .NET نام پارامتر را در یک جدول نگه می دارد و نام های محلی را به یک فایل جداگانه می گذارد. شما نمی توانید از هر یک از آنها نتیجه ی یک کمپایلر را قضاوت کنید تا زمانی که بدانید که آن ظرف با چه یادداشت هایی شروع شده است.

این درس چهار خواننده را در کتابخانه استاندارد پایتون ایجاد می کند. هر کدام کانتینر را از اولین بائتهای خود می خوانند، یک تابع را لیست می کنند و در ابزار فرمت خود در وسایل ساخت شده شما بررسی می شوند. بخش آخر می گوید:`grade`از`ledger`در هر پنج ظرف هم کنار هم

```figure
re-43-five-containers
```

## سرپرستی "پی سی" چهار کلمه است

PEP 552 عنوان را به عنوان چهار کلمه 32 بت تعریف می کند. اولین کلمه عدد جادویی است. دومین یک میدان بیت است. بیت 0 مجموعه به معنای فایل مبتنی بر هش است. بیت 1 مجموعه به معنای `check_source`: مترجم منبع را در واردات هاش می کند و مقایسه می کند. با بیت 0 پاک، کلمات سه و چهار mtime منبع و اندازه منبع هستند. با بیت 0 مجموعه، آنها یک SipHash 64 بیت از منبع را دارند.

شماره جادويي در`Include/internal/pycore_magic_number.h`. قاعده آن از 3.11 این است که پایتون 3.n از 2900 + 50n شروع می شود و هر تغییر بایت کد در یک چرخه انتشار یک اضافه می کند. توکن ذخیره شده عدد 16 بیت است که از آن بعد `\r\n`در این حالت، پیتون 3.15.0 در سال 2026-10-09 منتشر شد و در ماشین که این وسایل را ساخته است نصب نشده است، بنابراین شماره آن از فایل سرپرستی و نه از یک فایل در اینجا است.

چراغ ها دو فایل pyc در هر مترجم دارند.`compile_pyc.py`نوشته بود`py_compile.compile(..., dfile="ledger.py")`تا نام فایل ذخیره شده باشد`ledger.py`نه مسیر ماشین ساخت. اولین 16 بایت فایل 3.14:

```text
checked-hash   2b 0e 0d 0a  03 00 00 00  c7 16 c7 fc c5 1d 81 01
timestamp      2b 0e 0d 0a  00 00 00 00  8d 60 cf 6a  f1 01 00 00
```

سرنخ مهر زمان رو کلمه به کلمه بخونيد.`03 00 00 00`یا`00 00 00 00`اين کلمه پرچميه`8d 60 cf 6a`0x6acf608d = 1791975565, mtime از `ledger.py`وقتی پرونده ساخته شد`f1 01 00 00`در این فایل ها، 3 و 8 بایت ها شامل است. چهار مترجم در همه چیز در عنوان موافقند، به جز کلمه جادویی:

| Interpreter | Magic bytes | Word | File bytes | `grade.co_code` bytes | `grade` instructions |
|---|---|---|---|---|---|
| 3.11.14 | `a7 0d 0d 0a` | 3495 | 1054 | 80 | 31 |
| 3.12.12 | `cb 0d 0d 0a` | 3531 | 937 | 62 | 26 |
| 3.13.12 | `f3 0d 0d 0a` | 3571 | 943 | 70 | 26 |
| 3.14.6 | `2b 0e 0d 0a` | 3627 | 965 | 96 | 35 |

`read_pyc_header()`در`code/main.py`این زمینه ها را باز می گرداند و نام نسخه را از کلمه می گیرد. `importlib.util.MAGIC_NUMBER`به همان چهار بایت برای مترجم در حال اجرا می دهد. `python3 code/main.py compare`منبع رو با هر `python3.11`به`python3.15`در `PATH`برای هر یک از آنها سرنخ را چاپ می کند که خواننده ما در کنار حقایق که مترجم در مورد خود گزارش می دهد می بیند.

## مارشال کدهاي موضوعي را به صورت فيلدهاي

بايت 16 از هر دستگاه`e3`. اینا`0x80 | ord('c')`: کد نوع مارشال برای یک شی کد با `FLAG_REF`مجموعه ای که به خواننده میگه برای بعد از این موضوع را به یاد داشته باشه`r`اسناد مارشال می گوید که فرمت به طور عمدی مستند نشده است و که اشیاء کد بین نسخه ها سازگار نیستند. هر دو بیانیه درست است و فرمت هنوز به اندازه کافی کوچک است تا برای خواندن باشد. `Python/marshal.c`کد های نوع را ذکر می کند: `N`هيچکس`i`یک int 32 بیت`s`بائتهای`z`و`Z`رشته های کوتاه ASCII، `(`و`)`دوتا`c`یک شی رمز، `r`کنتینر ها جای مرجع خود را قبل از بچه هایشان ذخیره می کنند، بنابراین خواننده همین کار را می کند.

`w_complex_object()`برای 3.11 تا 3.15 این است`argcount`،`posonlyargcount`،`kwonlyargcount`،`stacksize`،`flags`به عنوان 32 بایت اینچ، پس `code`،`consts`،`names`،`localsplusnames`،`localspluskinds`،`filename`،`name`،`qualname`پس به عنوان اجسام`firstlineno`، پس`linetable`و`exceptiontable`. کد ماژول کدی شی فایل 3.14 را از بایت 17 به دست رمزگذاری کنید:

```text
00 00 00 00   argcount 0
00 00 00 00   posonlyargcount 0
00 00 00 00   kwonlyargcount 0
01 00 00 00   stacksize 1
00 00 00 00   flags 0
f3 22 00 00 00   type 's' with FLAG_REF, 34 bytes of co_code follow
80 00  52 06  74 00  52 01  17 00  74 01 ...
```

بائت های کد دو تا برای هر دستور هستند: `80 00`.`RESUME 0`،`52 06`.`LOAD_CONST 6`،`74 00`.`STORE_NAME 0`و`17 00`.`MAKE_FUNCTION`. فهرست 3.14 در فکسچر ها همان پنج بیانیه در سطح ماژول را چاپ می کند.`code`بعد ثابت ها، که چهار مورد کد را نگه می دارند، و بعد از آنها`names`.`('LABELS', 'percent_change', 'grade', 'total', 'grade_label')`. .

`Unmarshaller`در`code/main.py`این طرح و قدیمی تر که 3.9 و 3.10 استفاده می کند، جایی که `nlocals`،`varnames`،`freevars`و`cellvars`این زمینه ها جدا شده اند.`CodeObject`با اسم هاي صفاتي که موجود واقعي داره`varnames`فیلتر ها`localsplusnames`توسط`CO_FAST_LOCAL`یه کمی`localspluskinds`. برای`grade`در هر يک از چهار پرونده بازمي گردد`('score', 'bucket')`،`firstlineno`10 تا و یک خالی`linetable`. آزمون`test_unmarshaller_agrees_with_the_running_interpreter`هر رشته رو با `marshal.loads()`سه پرونده ديگه توسط کد ما قابل خواندن و توسط کد ما قابل خواندن نیستند`marshal`تحت اين مترجم

## چهار مترجم، چهار باکت کد برای درجه

در این مستندات یک هشدار در هر نسخه وجود دارد: بایت کد یک جزئیات پیاده سازی CPython است و هیچ تضمینی وجود ندارد که ثابت بماند.`python3.1N -m dis ledger.py`برای هر مترجم ضبط شد.

در 3.11`grade`شروعش اينطوره:

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

`BINARY_OP`در آفس 6 و دستورالعمل بعدی در 10 قرار دارد. دو بایت بین آنها یک ورودی ذخیره شده از PEP 659 است. مترجم تخصصی سازنده. `COMPARE_OP`در 16 دنبالش 22 هست پس دو تا از اونها هست`show_caches=True`3.12 جایگزین می شود`LOAD_CONST`و اضافه`RETURN_VALUE`با`RETURN_CONST`، نام پرش رو به `POP_JUMP_IF_FALSE`و درمانگرها`grade`از 80 تا 62 بايت. 3.13 چاپ برچسب ها `L1`به`L4`به جای تعویض و دادن CLI `-C`برای مخزن و`-O`برای تعویضات 3.14 حذف می شود `RETURN_CONST`دوباره اضافه می کنه`LOAD_SMALL_INT`و`LOAD_FAST_BORROW`, و ورودی ها`NOT_TAKEN`بعد از هر پرش مشروط:

```text
 12         20       LOAD_FAST_BORROW         1 (bucket)
            22       LOAD_SMALL_INT           9
            24       COMPARE_OP             188 (bool(>=))
            26       CACHE                    0 (counter: 0)
            28       POP_JUMP_IF_FALSE        3 (to L1)
            30       CACHE                    0 (counter: 0)
            32       NOT_TAKEN
```

.`-C -O`لیست نشان می دهد 13 `CACHE`نوشته ها داخل`grade`: بعد از پنج`BINARY_OP`، یکی پس از دیگری`COMPARE_OP`، یکی پس از دیگری`POP_JUMP_IF_FALSE`. دستگاه سازنده نشان ميده که حافظه هاي پيشگيري براي چي هستن بعد از 200 تماس`dis.dis(grade, adaptive=True)`چاپ`RESUME_CHECK`و`COMPARE_OP_INT`جایی که لیست ساده داشت`RESUME`و`COMPARE_OP`و`total`نمایش ها`FOR_ITER_LIST`،`BINARY_OP_ADD_INT`و`JUMP_BACKWARD_NO_JIT`. شکل های تخصصی در همان`co_code`بائتهاي پي سي هرگز آنها را در خود ندارد چون تخصص در حافظه اتفاق می افتد.

به همین دلیل است که decompiler ها دارای سقف نسخه هستند. uncompyle6 3.9.3 می گوید که بایت کد را از پایتون 1.0 تا 3.8 پذیرفته است. decompyle3 3.9.3 3.7 و 3.8 را می خواند. xdis 6.3.0, جداکننده نسخه های متقاطع پشت هر دو، تا 3.13 می خواند. pycdc دارای جدول های opcode تا `python_3_13.cpp`در فایل ساختش و در یک کد چاپ نامعلوم`Unsupported opcode`و نشان دهنده محصول نامکمل است. PyLingual ادعا می کند که هر نسخه منتشر شده از 3.6 و استفاده مترجم از 3.8 تا 3.15 برای بازسازی و بررسی محصول خود را. برای یک فایل 3.14، سه مورد اول رد یا شکست می یابد و تنها دو مورد آخر اعمال می شود. قبل از انتخاب یک ابزار کلمه جادویی را بخوانید.

## پرونده کلاس ها یک فرهنگ لغت خود را حفظ می کند

JVMS Java SE 25، بخش 4.1 طرح را به عنوان یک ساختار می دهد: `magic`،`minor_version`،`major_version`،`constant_pool_count`, استخر ثابت ,`access_flags`،`this_class`،`super_class`، رابط ها ، زمینه ها ، روش ها ، ویژگی ها`0xCAFEBABE`یک ماشین مجازی جاوا SE 25 نسخه های اصلی 45 تا 69 را پذیرفته و یک نسخه کوچک از 65535 یک فایل پیش نمایش ویژگی را نشان می دهد.`Ledger-g.class`.`ca fe ba be 00 00 00 41 00 5e`: اصلی 65 جاوا 21 است و`0x5e`= 94 شمارش ثابت است.`Ledger-jdk25.class`, ساخته شده توسط javac 25.0.2 از همان منبع شروع می شود`ca fe ba be 00 00 00 45`: 69 درجه

در استخر ثابت، فایل کلاس فرهنگ لغت خود را نگه می دارد.`#13`در`-g`ساخت یک`Methodref`که به کلاس اشاره داره`#8`و نام و نوع`#14`. دنبال کردن شاخص ها میاد`Ledger.grade:(I)I`، که دقیقاً همینطوره`javap -v`بعد از اون`//`. وصف کننده`(I)I`یک است`int`پارامتر و یک`int`نتیجه`([I)I`در`total`میگه پارامتر یک است`int`هر روش، میدان و کلاس که کد لمس می کند چنین ورودی دارد و تایید کننده در بخش 4.10 یک فایل را که دستورالعمل آن با آنها مخالف است رد می کند.`ClassFile`کلاس در`code/main.py`تمام 17 تاگ ثابت را از جدول 4.4 می خواند و یک را درمان می کند `Long`یا`Double`به عنوان دو نقطه. این در یک برچسب ناشناخته و باایت ها پس از ویژگی آخر افزایش می یابد.

ویژگی ها به کلاس، هر زمینه، هر روش و `Code`JVMS می گوید که ماشین مجازی باید ویژگی هایی را که نمی داند نادیده بگیرد، به همین دلیل می توان بدون تغییر یک جسم روش جدول های دیبگ را اضافه یا رها کرد. راهنمای javac می گوید `-g`تمام اطلاعات دیبگینگ را از جمله متغیرهای محلی تولید می کند، که پیش فرض فقط شماره خط و فایل منبع را تولید می کند و که `-g:none`سه تا اندازه را می سازند که:

| Build | Bytes | Constant pool count | `LineNumberTable` | `LocalVariableTable` | `SourceFile` | `grade` code bytes |
|---|---|---|---|---|---|---|
| `javac -g` | 1832 | 94 | 7 methods | 6 methods | yes | 50 |
| `javac` | 1581 | 82 | 7 methods | none | yes | 50 |
| `javac -g:none` | 1404 | 79 | none | none | no | 50 |

50 بايت کد از `grade`در هر سه پرونده همسان هستند و تست آن را بررسی می کند.`-g`اضافه شده برای `grade`یک است`LocalVariableTable`خط: شروع 0، طول 50، سوراخ 0، نام `score`، وصف کننده`I`بدونش یک decompiler قسمت 0 را می بیند`int`و باید اسم ای اختراع کنه`StackMapTable`در هر ساخت باقی می ماند چون تایید کننده به آن نیاز دارد و `BootstrapMethods`ویژگی باقی می ماند چون`main`رشته ها رو به هم متصل مي کنه`invokedynamic`. .

## کدنویچ میز ها با دست

فصل 6 JVMS هر دستورالعمل را به عنوان یک بایت آپکد و آپراند که نام های آپکد را می دهد تعریف می کند. آفس های شاخه ارزش های امضا شده 16 بیت نسبت به آدرس آپکد شاخه هستند که از x86-64 متفاوت است، جایی که جابجایی نسبت به دستورالعمل بعدی است. `tableswitch`و`lookupswitch`با صفر تا سه بايت پديده شروع ميکنن تا 32 بيت اپرندها از آدرس 4 شروع بشه

بائتهاي `grade`از pc 4 در `Ledger-g.class`:

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

36 بايت، يک دستور و کل`switch (score / 10)`با پرونده مشترکش برای 9 و 10. ساخت بومی همان `switch`در درس 33 نیاز به چک محدودیت ها داشت`lea`، یک`movslq`، یک`add`، یک پرش غیرمستقیم و پنج نقل مکان در بخش دیگری در اینجا اهداف در دستورالعمل هستند و همینطور این واقعیت که آنها به هم تعلق دارند

`disassemble_jvm()`تمام 202 کد تعریف شده را با عرض اپراند خود پوشش می دهد، از قانون پر کردن پیروی می کند و راه را به کار می کند `javap`.`compare_with_javap()`بازرسي زنداني ها`javap -c -p`متن، از جمله متن چند خط`tableswitch`تمام چهار ساختار با 108 دستور توافق دارند. آزمون`test_branch_offsets_are_relative_to_the_branch_instruction`چک ها`ifne`در pc 1 فرود در 6`if_icmpge`در 13 فرود در 33 و`goto`در 30 به عقب در 10 فرود مياد

رادار2 6.2.4 که از منبع برای این درس ها ساخته شده است، همان فایل را می خواند.`rabin2 -I`گزارش ها`arch java`،`lang java 21`،`linenum true`و`lsyms true`, که خواندن نسخه و دو جدول دیبگ است. `pd 14 @ sym.Ledger.grade`چاپش`tableswitch`با تيرها به پنج هدفش`Unable to parse code attribute: 2`در این فایل، که یک محدودیت ابزار نام خود و یک دلیل برای حفظ`javap`به عنوان کلام. decompileers برای این فرمت در مقایسه با پایتون بالغ هستند. CFR 0.152 به مجوز MIT صادر شده پروکیون 0.6.0 و Vineflower 1.12.0 Apache 2.0 هستند و Vineflower یک شکنی Fernflower با پشتیبانی از جاوا 21 است. خود "فرن فلوور" در داخل مخزن جامعه "انتلج" زندگی می کنه JADX 1.5.6 فرمت Android DEX را پوشش می دهد و JD-GUI آخرین نسخه اش در سال 2019 بود. هاراند، سوتو والرو، مونپرروس و باودری هشت مورد را در سال 2020 اندازه گیری کردند. بهترین تولیدات ترکیب درست برای 84 درصد از کلاس ها و تولیدات معادل معنوی برای 78 درصد. متاداکامپلر آنها ۳۷.۶ درصد از کلاس هایی را که هیچ ابزار دیگری نمی توانست با آن ها کار کند، بازیابی کرد. انواع، نام ها و دسته های تایید شده باعث می شوند که فرمت قابل تجزیه باشد. آنها هیچ یک از decompiler کامل نمی کنند.

## یک ماژول وسم یک لیست از بخش ها است

مشخصات اصلی یک ماژول را به عنوان پیشگام تعریف می کند`00 61 73 6d 01 00 00 00`، رشته`\0asm`و نسخه 1، و بعد از آن بخش ها. هر بخش یک بایت ID است، یک `u32`اندازه در LEB128 و محتوای آن. IDs 1 تا 13 بخش های شناخته شده هستند، هر یک در حد حداکثر یک بار و به ترتیب. ID 0 یک بخش سفارشی با نام است، اجازه می دهد در هر نقطه. همه اعداد کامل LEB128 هستند، بنابراین `e4 00`100 و `80 08`1024مست`wasm-objdump -h`در`ledger.wasm`هفت بخش را فهرست می کند و`WasmModule`هفت مورد را با همان تعویض بار مفید پیدا می کند:

| Section | Payload | Count | What it holds for ledger |
|---|---|---|---|
| Type | 10 to 26 | 3 | `(i32) -> nil`, `(i32, i32) -> i32`, `(i32) -> i32` |
| Import | 28 to 39 | 1 | `env.log` with type 0 |
| Function | 41 to 46 | 4 | type index for each defined function |
| Memory | 48 to 51 | 1 | one page, no maximum |
| Export | 53 to 110 | 5 | `memory` and the four function names |
| Code | 113 to 271 | 4 | bodies of 23, 63, 44, and 23 bytes |
| Data | 273 to 290 | 1 | `F\0D\0C\0B\0A\0` at offset 1024 |

تقسیم بین بخش های تابع و کد وجود دارد تا مرورگر بتواند قبل از ورود کل فایل شروع به جمع آوری کند. هر ورودی کد یک اندازه، یک ویکتور اعلامیه های محلی و یک عبارت است. برای `grade`وکتور محلی`01 7f`: یک گروه از یک نفر`i32`. اینا`bucket`، با نوعش و بدون اسمش

جریان کنترل توسط ساخت ساختار می شود. مشخصات می گوید شاخه ها فقط می توانند بسته شدن را هدف قرار دهند.`block`،`loop`، یا`if`برچسب ها با توجه به عمق انبوه بندی انندکس می شوند.`br_table`یک شاخه غیر مستقیم را از طریق یک اپراند انجام می دهد که یک لیست برچسب را شاخص می کند.`grade`در فایل آفسه`0xa3`:

```text
0e                  br_table
0b                  11 labels follow
04 04 04 04 04 04   buckets 0 to 5: label 4, the outermost block, returns 0
03 02 01 00         buckets 6, 7, 8, 9: labels 3, 2, 1, 0
00                  bucket 10: label 0, shared with 9
04                  default label 4
```

هر برچسب عمق است. برچسب 0 درونی ترین است.`block`، و کد بعد از آن`end`.`i32.const 4`بعدش`br 4`از بلوک نتیجه خارج شد.`block`دستورالعمل های پیش روی میز، ۱۱ برچسب و ۵ برچسب`br`بعد از اينکه تمامش رو هم بگيريم`switch`، و یک اعتبار دهنده هر شاخه ای را که ساختار را ترک می کند رد می کند.`disassemble_wasm()`عمق رو ردیابی می کنه پس قطعات فهرست مثل`wasm-objdump`, هر کد آپ بايتي از `unreachable`به`i64.extend32_s`و با دستگير ها مطابقت داره`wasm-objdump -d`در 77 از 77 دستورات برای هر دو ساختمون

اسم ها تنها چیزی هستند که یک ماژول ساده می گذارد.`wasm-objdump`هنوز چاپ شده`<grade>`به این دلیل که بخش صادرات نقشه هایی را که رشته به شاخص عملکرد 2 می کند، و خواننده همان کار را انجام می دهد. نام های محلی در هیچ جایی در فایل 290 بایت وجود ندارد. `wat2wasm --debug-names`بخش سفارشی را با نام اضافه می کند `name`با زیر بخش هایی برای نام ماژول، نام عملکرد و نام های محلی. فایل به 425 بایت می رسد. خواننده پیدا می کند `{0: 'score', 1: 'bucket'}`برای تابع 2 و `{0: 'values', 1: 'count', 2: 'sum', 3: 'i'}`برای تابع 3`wasm-strip`در ورق ذخیره سازی کنوانسیون ابزار دو حامل دیگر را توصیف می کند. DWARF می تواند به عنوان`.debug_*`بخش های سفارشی.`sourceMappingURL`بخش سفارشی می تواند به یک نقشه منبع اشاره کند که شماره ستون آن باایت های تعویض شده به دوگانه است.

ابزارها در طول سال 2026 حرکت کردند.`wasm-decompile`، و ساخت Homebrew روی این ماشین دقیقاً ۱۱ ابزار باقی مانده را دارد.`print`،`objdump`و`demangle`. نسخه_133 بينيارين ارائه ميده`wasm-dis`رادار2 6.2.4 ماژول رو هم ميخواد`rabin2 -I`میگه`arch wasm`. نمادش براي`grade`شروع می شه`0x8e`، جایی که متری محلی شروع می شود، در حالی که `wasm-objdump`برچسب ها تابع در `0x8b`در فهرستش از يادداشت هاي قدیمی تر استفاده ميکنه`get_local`،`set_local`و`brtable 11 4 4 ...`با چاپ شماره برچسب بائتهای در هر سه ابزار یکسان هستند و املاکی متفاوت است، بنابراین یک مقایسه باید نام ابزار را که با آن ضبط شده است نام دهد. تحقیقات برای این درس هیچ ماژول پردازنده WebAssembly در دایرکتوری پردازنده های Ghidra پیدا نکردند و این لیست به طور کامل خوانده نشد. افزونه Ghidra-wasm v2.4.0 طرف سوم هدف Ghidra 12.0 است. مشخصات خودش یک سند زنده است. صفحه W3C برای `wasm-core-2`یک طرح توصیه کاندید از 13 اکتبر 2026 است که خلاصه آن نسخه 3.0 را توصیف می کند و طرح ویرایشگر نیز همان تاریخ را دارد.

## ECMA-335 متاداتا پایگاه داده برنامه است

یک مجموعه .NET یک فایل PE است.`LedgerNet.dll`با شروع می شه`MZ`، سه بخش به اسمش داده شده`.text`،`.rsrc`و`.reloc`، و اعلام میکنه`0x14c`به این دلیل که کامپایلر کد خنثی سیستم عامل را منتشر کرده است. دایرکتوری داده 14 از سرپرست اختیاری، سرپرست زمان اجرا CLR، به RVA اشاره دارد `0x2008`ECMA-335 II.25.3.3 72 بایت را در آن تعریف می کند:

```text
48 00 00 00   Cb 72
02 00 05 00   MajorRuntimeVersion 2, MinorRuntimeVersion 5
78 21 00 00   MetaData RVA 0x2178
84 07 00 00   MetaData size 1924
01 00 00 00   Flags: COMIMAGE_FLAGS_ILONLY
05 00 00 06   EntryPointToken 0x06000005, MethodDef row 5, which is Main
```

ریشه متادتا در RVA `0x2178`با امضا شروع میشه`42 53 4a 42`، که میگه`BSJB`، بعد نسخه 1.1 و رشته`v4.0.30319`پنج تا از سرپرستان جریان ها:`#~`در تعویض`0x6c`، پس`#Strings`،`#US`،`#GUID`و`#Blob`II.24.2 می گوید هر نوع جریان حداکثر یک بار رخ می دهد.`#~`جریان با یک شروع می شود`HeapSizes`بايت، صفر در اینجا، پس هر رشته، GUID، و شاخص نقطه دو بايت گسترده است، و یک 64 بيت`Valid`ماسک که نام جدول های موجود را مشخص می کند. چهارده بیت تنظیم شده است:

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

اندازه یک ردیف در هیچ جایی ذخیره نمی شود. II.22 به هر ستون نوعی می دهد و II.24.2.6 به قانون اندازه گیری می دهد. یک شاخص توده دو یا چهار بایت به `HeapSizes`یک شاخص جدول ساده دو بایت است در حالی که این جدول کمتر از 65536 ردیف دارد. یک شاخص کدگذاری شده که می تواند به جدول های n با بایت های برچسب اشاره کند دو بایت است در حالی که هر یک از این جدول ها کمتر از 2^(16-b) ردیف دارد. `CliAssembly`اندازه 14 ردیف را از این قوانین محاسبه می کند و ردیف ها شمارش می شوند. سیستم.عكس.پرداد متادایی در وسایل گزارش می دهد اندازه های مشابه و تعویضات جدول مشابه است، که این روش آزمایش ثابت حسابداری است.

III.1.9 نشان دهنده را تعریف می کند: بائت بالا جدول است، سه بائت پایین ردیف مبتنی بر 1 است. `0x06000002`.`MethodDef`خط 2 . این خط RVA دارد`0x2060`، اسم`Grade`، و یه خال امضا`00 01 08 08`: کنوانسیون تماس پیش فرض، یک پارامتر، بازگشت `int32`، پارامتر`int32`. اون`ParamList`نقاط در ردیف 3 از `Param`، که اسمش`score`. ميز پارام براي اينه که اين جاسوسها ميتونن چاپ کنن`Grade(int score)`از ساخت و ساز آزاد شده`0x2060`بدن روش با یک سر سر چربی شروع می شود:

```text
13 30         flags 0x13: fat, init locals; size 3 dwords
02 00         MaxStack 2
2d 00 00 00   CodeSize 45
01 00 00 11   LocalVarSigTok 0x11000001
```

`StandAloneSig`خط 1 نگه دارد`07 01 08`.`LOCAL_SIG`، یه محلی`int32`. محلی دارای نوع و نام نیست. ECMA-335 نام های محلی را در قالب تغییر تغییر اشکال بخش V نگه می دارد و SDK .NET آنها را به یک PDB می نویسد. این ابزار با `DebugType`هيچکدوم، پس هيچ ميز و پرونده اي با اين اسم نيست`bucket`.`PercentChange`در عوض يه سرگير کوچولو داره: اولين بايتش`3a`.`0x0e << 2 | 2`، يه جسم 14 بايت بدون هيچ محلي و يک دسته پيش فرض از 8

45 بايت کد از `Grade`با جدول کد Opcode بخش III رمزگذاری شود. `switch`کد آپکود`0x45`بعدش یک`u32`شمارش و اون همه`int32`اهداف مربوط به دستورالعمل بعد از جدول:

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

کمپایلر 6 قبل از `switch`، پس پرونده 6 هدف اوله`disassemble_cil()`نشان دهنده توکن ها در جدول ها: `ldsfld Labels`،`call Grade`،`call System.Console::WriteLine`و`ldstr ' '`از`#US`.کليک .کليک براي همه اين ها`MetaDump`، یک برنامه کوتاه C# در چراغ های ساخته شده`System.Reflection.Metadata`این تعداد صف ها، اندازه و تعویض هر جدول، RVA هر روش، امضا، نام پارامتر ها و بائتهای IL و 226 میدان از `System.Reflection.Emit.OpCodes`.`compare_with_metadump()`با تمام 246 چک موافقم جدول زمان اجرا 218 کد اضافه هشت`prefix`جدول درس 219 مطلب دارد چون شامل`no.`از III.2.2 که جدول emit هرگز نداشت.

ابزار برای فرمت: ILSpy 11.0 (MIT، منتشر شده 2026-08-12) از طریق ساخت ورودی Avalonia در macOS اجرا می شود. `ilspycmd`11.1.0.9782 چاپ IL با `-il`و روش رو به صورت نماد با `-m 0x06000002`. dnSpyEx 6.6.0 فقط در ویندوز ادامه داره dnSpy`ildasm`سفینه ها به عنوان بسته های NuGet به جای داخل SDK. radare2 6.2.4 میتا داده ها را هم می خواند: `rabin2 -I`میگه`arch cil`و`class PE32`و`is`لیست ها`Ledger.Grade(int:score):int`این ابزار با .NET SDK 8.0.205 ساخته شده است زیرا این SDK در ماشین ساخت نصب شده است. .NET 10 از سال 2025-11-11 به طور فعلی بوده و همان ساختار ECMA-335 را می نویسد.

## آنچه هر ظرف نگه دارد

بذار`grade`از تمام پنج ظرف در یک میز. هر ردیف از`python3 code/main.py keeps`، که خواننده ها رو بر روی چراغ ها می گذرد:

| Container | Body bytes | Function name | Parameter names | Parameter and return types | Local names | Line numbers | Control flow |
|---|---|---|---|---|---|---|---|
| ELF object, clang -O0 | 118 | `grade` in `.symtab` | none | none | none | none, no `.debug_*` sections | 5 jumps and 1 indirect jump through a relocation table |
| CPython 3.14 pyc | 96 | `co_qualname` | `score` | none | `bucket` | `co_linetable`, first line 10 | 4 compare and `POP_JUMP_IF_FALSE` pairs |
| JVM class, `javac -g` | 50 | constant pool | `score` in `LocalVariableTable` | `(I)I` | none beyond the parameter | `LineNumberTable`, 6 rows | 1 `tableswitch` |
| WebAssembly | 63 | Export section | only with a name section | `(i32) -> i32` | only with a name section | none | 6 nested blocks, 1 `br_table`, 4 `br` |
| .NET assembly | 45 | `MethodDef` | `score` in `Param` | `static int32(int32)` | none, types only in `StandAloneSig` | none without a PDB | 1 `switch`, 1 `br.s` |

جدول نتایج تجزیه کننده را که خواهید دید توضیح می دهد. درس 34 مقایسه`int total(const int *, int)`با`int total(long param_1, uint param_2)`که گیدرا از کد بومی نتیجه گرفت، زیرا کد بومی هیچ یک از این ستون ها را حفظ نمی کند. یک pyc هر نام و هیچ نوع را حفظ می کند، و جریان کنترل آن پریدن هایی است که شکل آنها هر نسخه تغییر می کند، بنابراین پیکپین ها در هر نسخه شکسته می شوند و نام ها را به صورت رایگان بازیابی می کنند. یک فایل کلاس انواع و دسته های تأیید شده را حفظ می کند، نام ها را حفظ می کند وقتی`-g`در حال اجرا است و بیان می کند`switch`یک ماژول "ویسم" ساختار را با ساخت نگه می دارد، بنابراین`wasm2wat`یک مجموعه .NET کامل ترین توصیف را حفظ می کند، زیرا جدول های متادتا قانونی هستند و هنوز هم برای نام یک محلی نیاز به PDB دارند.

جدول به شما می گوید که decompiler با چه چیزی کار می کند و کدام از خروجی ها یک واقعیت ذخیره شده را کپی می کنند و کدام یک را نتیجه می دهند. نام پارامتر در خروجی ILSpy کپی است. نام محلی در همان خروجی یک نتیجه است مگر اینکه PDB وجود داشته باشد. درس 35 این تفاوت را به عنوان مقام هر ادعای ثبت می کند.

## آن را بسازید

نمایش نمایش را اجرا کن:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
```

محصول یک گزارش JSON است. برای هر pyc هر دو عنوان، فایل و  را می دهد`grade`اندازه ها، تعداد دستورالعمل ها و نام های کد های opcode از لیست گرفته شده، و اینکه آیا مترجم در حال اجرا می تواند آن را بخواند. برای هر کلاس ساخت آن را به نسخه، اندازه، شمارش جدول دیبگ، و `javap`برای هر ساخت و ساز Wasm بخش ها، انواع، عملکردها، محتوای بخش نام و`wasm-objdump`برای جمع آوری، این CLI را به عنوان، جریان، شمارش ردیف جدول، روش ها و سیستم می دهد.`PATH`. .

بخون`code/main.py`در این ترتیب:

1. `Reader`در برنده و عرض عددی کامل قرار دارد.`uleb()`و`sleb()`این خواننده های LEB128 هستند که واسم و .NET نیاز دارند.
2. `read_pyc_header()`،`Unmarshaller`و`PycFile`يه پي سي رو بخون`parse_dis_text()`‫از دستگیران میخواد`dis`لیست ها به طوری که مقایسه بین نسخه ها به چهار مترجم در زمان آزمون نیاز ندارد.
3. `ClassFile`پرونده کلاس رو میخواد و`disassemble_jvm()`کدش رو رمزنگاري ميکنه`parse_javap_code()`و`compare_with_javap()`.آرهکل چک ميکنه
4. `WasmModule`بخش ها رو مي خواد و`disassemble_wasm()`یک عبارت را با عمق آن رمزنگاری می کند.`compare_with_wasm_objdump()`این چکِ آسمانییه
5. `CliAssembly`در پی، CLI سر، metadata root، جریان ها و جدول ها راه می رود. `TABLE_SCHEMAS`و`CODED_INDEXES`II.22 و II.24.2.6 به عنوان داده ها هستند. `disassemble_cil()`یک بدن رو رمزگشایی می کنه و`compare_with_metadump()`-آره، چکش کن
6. `NativeObject`به اندازه کافی ELF را برای فهرست کردن نمادهای تابع می خواند و درس 33 را به عنوان متن خود می گیرد. `what_each_keeps()`و`figure_data()`مقایسه رو بساز

پنج فرمان ديگه وجود داره`python3 code/main.py pyc FILE`،`class FILE`،`wasm FILE`و`dll FILE`ساختار و لیست هر تابع را در یک فایل که به آنها می دهید چاپ کنید. `python3 code/main.py compare`مجموعه ها`ledger.py`با هر مترجمي که داره`PATH`و آنچه هرکدوم نوشته چاپ مي کنه

## ازش استفاده کن

از خواننده ها در اين ترتيب در يک ظرف ساختي استفاده کنيد

1. اولین بائتهای اول را بخوانید و نام فرمت را بنویسید. دو بائته بعد`0d 0a`یک پی سی است`ca fe ba be`یک پرونده کلاس، `00 61 73 6d`یک ماژول`4d 5a`با فهرست داده 14 مجموعه ای را تنظیم کنید.
2. برای یک pyc که کلمه جادویی است، برای یک فایل کلاس نسخه اصلی، برای یک مجموعه رشته های نسخه اجرا و متادتا.
3. قبل از اجرا کردن هر نسخه ای که می خواهید اجرا کنید را با آن نسخه مقایسه کنید. سقف و جایی که ابزار آن را مستند می کند را ثبت کنید.
4. در یک فایل، خواننده و ابزار فرمت خود را اجرا کنید و آنها را ردیف به ردیف مقایسه کنید. یک عدم مطابقت یک خطا در خواننده یا تغییر در ابزار است و هر یک از آنها باید قبل از اینکه لیست به عنوان مدرک شناخته شود درک شود.
5. جدول نگهدارنده ها را برای عملکرد مورد علاقه تان پر کنید. هر واقعیت را به عنوان نگه داشته یا گم شده نشان دهید و جدول، ویژگی یا بخش که از آن آمده نام دهید.
6. فقط بعد از آن محصول تخلیق کننده را بخوانید. هر نام را نشان دهید و آن را به عنوان یک کپی از یک واقعیت ذخیره شده یا به عنوان یک نتیجه گیری تایپ کنید.

فایل های متن Oracle را در کانتینرها نگه دارید. هنگامی که یک مترجم، JDK، SDK یا نسخه wabt تغییر می کند، با `build_fixtures.sh`و دوباره ضبطش کنیم، چون لیست تغییر داده شده یک قسمت تغییر داده شده است.

## آزمایشگاه تعاملی

### لابراتوار A: سر و بعد کدهای موردی را بخوانید

از`code`دایرکتوری، پیتون باز:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code
python3 -q
```

راه رفتن:

```python
from main import *
pyc = load_pyc("ledger.cpython-311.pyc")
pyc.header.to_dict()
pyc.module.names
pyc.functions()["grade"].varnames
len(pyc.functions()["grade"].code)
```

قبل از اولین تماس کلمه جادویی رو بنویس و بعدش بارگذاری کن`ledger.cpython-314.pyc`و آن دو را مقایسه کنید`code`بعدش امتحان کن`import marshal; marshal.loads(pyc.data[16:])`در فایل 3.11 زیر مترجم خود را و خطا را بخوانید.

### آزمایشگاه B: زنجیره ثابت استخر

```python
cls = load_class("Ledger-g.class")
cls.constant(13)
cls.constant(14)
cls.describe_constant(13)
[row["text"] for row in jvm_listing(cls, "grade")]
```

دنبالش کن`#13`به`#8`و`#14`، بعدش به`Utf8`نوشته ها، قبل از تماس`describe_constant`پس بارش رو بردار`Ledger-gnone.class`و تماس بگیرید`cls.method("grade").attribute_names()`در هر دو مورد`Code`صفات یکسان هستند، صفات یکسان نیستند.

### آزمایشگاه C: عمق و برچسب ها

```python
module = load_wasm("ledger.wasm")
[(row["depth"], row["text"]) for row in wasm_listing(module, "grade")]
module.function_name(2)
load_wasm("ledger-names.wasm").names["locals"][2]
```

پیدا کن`br_table`و عمق آن را بخوان.`end`بعد از آن ردیف ها و هر یک را با یک شماره برچسب در جدول مطابقت دهید. سپس باز کنید `ledger.wat`و پیدا کردن`block $six`اون برچسب 3 اسم

### لابراتوار D: از توکن به بایت

```python
asm = load_assembly("LedgerNet.dll")
asm.method("Grade")
body = asm.method_body(asm.method("Grade")["RVA"])
body.fat, body.max_stack, body.code_size, hex(body.local_signature_token)
asm.token_text(0x11000001)
[row["text"] for row in cil_listing(asm, "GradeLabel")]
```

محاسبه تعویض فایل RVA `0x2060`از`.text`سرگوشن بخش با دست و مقایسه با `asm.rva_to_offset(0x2060)`پس نگاه کن بالا`asm.row(0x08, 3)`و پیدا کن اسمش کجاست`score`زندگی می کنه

## آزمایشگاه تمرین

یک زبان منبع پنجم را به مقایسه اضافه کنید، یا یک واقعیت ششم را به جدول اضافه کنید.

الزامات:

- یک تابع با یک حلقه و یک متغیر محلی را در یک زبان که شما سازنده آن را دارید، بنویسید، به عنوان مثال Kotlin به یک فایل کلاس یا Rust به یک ماژول Wasm. محصول و لیست Oracle را با دستور دقیق در `build_fixtures.sh`. .
- با هر دستور و دستورات اوکرال موافق باشید. فقط زمانی که دستگاه به آنها نیاز دارد، اوکرال اضافه کنید.
- طولاني`what_each_keeps()`با ظرف جدید و با یک واقعیت دیگر برای هر ظرف: آیا جسم دارای یک میز استثنا یا `try`منطقه
- ظرف جدید را به  اضافه کنید`figure_data()`و دوباره بازنشسته شدن`site/figures-re-43.js`. .
- یک آزمون را بنویسید که وقتی یک خواننده یک واقعیت را بدون نام دادن جدول، ویژگی یا بخش که آن را در بر دارد گزارش می دهد، شکست می خورد.

موفقیت به معنی`python3 code/main.py keeps`که نشان می دهد خط جدید با شواهد برای هر سلول و هر مقایسه Oracle هنوز هم موافق است.

## درس هنرپیشه

این درس شامل`outputs/skill-bytecode-and-managed-formats.md`از آن برای تبدیل یک کانتینر بایت کد به یک گزارش سر، یک لیست چک شده از یک تابع و یک جدول واقعیت هایی که هر نام، نوع و ساختار را به عنوان ذخیره یا گم شده نشان می دهد استفاده کنید. این نیاز به ابزار خود از فرمت به عنوان یک کلام، بررسی نسخه قبل از هر decompiler و بیانیه ای از جایی که هر واقعیت گم شده زندگی می کند.

## بررسی کنید

نمایش و مجموعه تعیین کننده را اجرا کنید:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

بررسی باید ثابت کند:

- چهار سرنخ pyc دارای کلمات جادویی 3495, 3531, 3571, و 3627, پرچم های 3, و یک هشت باایت, و فایل های تایم استیمپ پرچم های 0, mtime 1791975565, و اندازه 497
- هر کلمه جادويي براي 3.11 و بعدش در محدوده ي`2900 + 50n`قانون آزاد کردن
- unmarshaller همان نام ها، ثابت ها، بائتهای کد، نام متغیرها و جدول خط را به عنوان `marshal.loads()`در پرونده که مترجم اجرا می کند نوشته شده است
- همه چهار پرونده اسم ماژول رو نگه می دارن`('score', 'bucket')`برای`grade`، اولين خط 10 و`ledger.py`به عنوان نام فایل
- `grade.co_code`این هشتاد، ۶۲، ۷۰ و ۹۶ بایت در چهار نسخه است و لیست های ضبط شده دارای دستورالعمل ۳۱، ۲۶، ۲۶ و ۳۵ هستند
- فهرست 3.11 داره`POP_JUMP_FORWARD_IF_FALSE`، 3.12 و 3.13 دارند`RETURN_CONST`، و 3.14 داره`LOAD_SMALL_INT`،`LOAD_FAST_BORROW`و`NOT_TAKEN`
- ۳.۱۴`-C -O`لیست 13 ورودی ذخیره شده را در `grade`، پنج تا بعد از اون`BINARY_OP`، و نمایش های لیست سازنده`COMPARE_OP_INT`
- سرنخ بدون`0d 0a`، يه سر و کله کوتاه شده و يه جسم که كود آبجيت نيست بلندش كنه`FormatError`
- یک لیست دستورالعمل فقط برای pyc نوشته شده توسط مترجم در حال اجرا وجود دارد و با ضبط مطابقت دارد `dis`تولید
- پرونده های کلاس دارای 65 یا 69 اصلی، اندازه 1581, 1832, 1404 و 1581, و تعداد ثابت مجموعه 82, 94, 79, و 82 هستند
- ثابت`#13`تصمیم می گیرد`Method Ledger.grade:(I)I`و`#47`به`String F`
- دستگاه جداسازی JVM موافق است`javap -c -p`در 108 از 108 دستورالعمل در هر چهار ساخت
- `tableswitch`در pc 4 36 بایت با 6 پایین، 10 بالا، 48 پیش فرض، و اهداف 46, 44, 42, 40, 40 است
- سه سطح دیبگ تعداد صفات را تغییر می دهد و 50 بایت کد را از `grade`یکسان
- `ifne`،`if_icmpge`و`goto`هدف ها نسبت به کد آپکود شاخه هستند
- جادو اشتباه، بايت هاي عقب و افزايش نامعريف کد آپ`FormatError`
- هفت بخش " وسم " دارای تعویض بار مفید هستند`wasm-objdump -h`چاپ و نام ها اضافه می کند `name`بخش سفارشی در 293 تا 425
- انواع`env.log`واردات، پنج صادرات و بخش داده ها در 1024 رمزگذاری شده در `ledger.wat`
- دستگاه جدا کردن واسم موافقه`wasm-objdump -d`در 77 از 77 دستورالعمل در هر دو ساختمون
- `grade`6 تا بلوک هست که به هم میره`br_table`با برچسب ها`4 4 4 4 4 4 3 2 1 0 0`و 4 به طور پیش فرض در عمق 6 و 1 `i32`محلی
- نام های عملکردی از صادرات بدون بخش نام و نام های محلی فقط با آن می آیند
- LEB128 `e4 00`100 است`7f`-1 است`80 08`1024 است و نوع بلوک مثل `wasm-objdump`
- یک پیش فرض اشتباه، نسخه 2 و افزایش کد غیرقابل شناخت`FormatError`
- مجموعه PE32 با ماشین`0x14c`, CLI سر در RVA `0x2008`, زمان اجرا 2.5 ,`ILONLY`، و نقطه ورود`0x06000005`
- نسخه متاداتا اینه`v4.0.30319`، پنج جریان وجود دارد و 14 جدول تعداد صف ها و اندازه صف ها را گزارش می دهد
- خواننده .NET با سیستم.آزمایش.متاداتا در 246 از 246 چک موافق است
- `Grade`دارای پارامتر است`score`، امضا`static int32(int32)`، يه سرپرستي چاق با`MaxStack`2 و 45 بايت کد و 1 `int32`محلی بدون نام
- CIL `switch`هدف ها`br.s`،`ldsfld`،`call`و`ldstr`اپراندها از طریق جدول ها و توده ها حل می شوند
- جدول کد های CIL هر کد های زمان اجرا را پوشش می دهد و فقط اضافه می کند `no.`
- جدول نگهدار نام پارامتر را در چهار ظرف و در هیچ یک برای کد بومی گزارش می دهد و در سه نوع
- هر خط درامو در نماد N از n میخواد
- این شکل تعاملی همان داده ها را در خود قرار می دهد `figure_data()`تولید می کند

## روش های شکست تولید

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

## قاعده عملیاتی

اول عنوان را بخوانید و نام تولید کننده را که به آن اشاره می کند بخوانید. با یک خواننده که آنچه را که نمی داند را رد می کند، کنتینر را بخوانید و لیست آن را با ابزار فرمت خود در همان فایل بررسی کنید. سپس بگویید، برای هر نام و نوع در محصول یک کپیک، چه کنتینر آن را ذخیره کرده است یا ابزار آن را نتیجه گرفت.

## خواندن بیشتر

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
- [radare2 on GitHub](https://github.com/radareorg/radare2)، نسخه 6.2.4 از منبع برای این درس ساخته شده است
