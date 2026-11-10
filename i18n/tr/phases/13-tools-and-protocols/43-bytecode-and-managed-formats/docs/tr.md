# Doğal Kodu Üstüne: Python, JVM, .NET ve WebAssembly Bytecode

> Bir bytecode dosyası bir program ve bu dersi, her konteyner hangi notları sakladığını gösteren okuyucuları oluşturur.

**Type:** Build
**Languages:** Python, TypeScript, Java, C#, WebAssembly text
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow)
**Time:** ~150 minutes

## Öğrenme Hedefleri

- 16 bayt oku `.pyc`PEP 552 başlığı ve kod nesnesini  olmadan açma`marshal`Modül, dört tercüman versiyonu tarafından yazılmış dosyalar için.
- JVM sınıf dosyasını JVMS Bölümü 4'ten analiz edin: sabit havuz, alanlar, yöntemler, `Code`Bu özellik ve `javac -g`- Ekle.
- JVM kodlarını `Ledger.class`ve listeye alınmış olduğunu kanıtlamak için `javap -c`Aynı kaynağın dört binasındadır.
- WebAssembly modül bölüm bölüm okuyun, her fonksiyon vücudu çözün ve sonuçları karşılaştırın `wasm-objdump -d`- Evet .
- .NET birimi ECMA-335 metadatalarını PE veri dizininden `MethodDef`İLSpy'nin kullandığı okuyucu kütüphanesine karşı kontrol edilen her yöntemin satırları ve CIL'si.
- Beş konteynerde bir fonksiyon için, her biçim hangi isimleri, türleri ve kontrol yapısını saklıyor ve hangilerini kaybediyor.

## Sorun

Sen inşa ettin .`ledger.py`ve buldum .`ledger.cpython-314.pyc`İçeride`__pycache__`Bir ajanı dosyanın içeriğini sordun.`Unsupported opcode`ve bir satır da şöyle diyordu:`# WARNING: Decompyle incomplete`Ajan dosyanın gizlendiğine karar verdi.

Dosya gizlenmedi. İlk iki baytı`2b 0e`Bu sayı CPython 3.14 yazıyor ve dekompiler'in opkod tabloları 3.13. araç günceldi. ajan başlığı okumadı, bu yüzden farkı göremiyordu.

Ders 33 native kodun ne kaybettiğini gösterdi: parametre isimleri, türleri ve `switch`Bu bir atlama masası haline geldi. Bytecode konteynerleri daha az kaybeder ve her biri farklı bir şey kaybeder. Bir pyc, her değişkenin adını ve hiç bir türü saklar. Bir sınıf dosyası sadece sorulduğunda tipleri ve yerel isimleri saklar. Bir Wasm modülü kontrol yapısını korur ve özel bir bölümde taşıyılmadıkça isimleri düşürür. Bir .NET birimi bir tabloda parametreler isimlerini tutar ve yerel isimleri ayrı bir dosyayaya bırakır. Bir depolamacının hangi notlarla başladığını bilmeden, bunların herhangi birinde çıkışını yargılayamazsın.

Bu ders Python standart kütüphanesinde dört okuyucu oluşturur. Her biri konteyneri ilk bayttan okuyor, bir işlevi listeler ve oluşturduğunuz armatürlerde biçimin kendi aracı ile kontrol edilir. Son bölümde yerleştirir `grade`-`ledger`Beş konteynerde de yan yana.

```figure
re-43-five-containers
```

## PYC Başlığı Dört Kelimedir

PEP 552 başlığı dört 32 bit kelime olarak tanımlar. Birincisi sihirli sayı. İkincisi bir bit alanı. Bit 0 seti dosyanın hash tabanlı olduğunu gösterir. Bit 1 seti `check_source`Bit 0 açık olduğunda, üç ve dört kelime kaynak mtime ve kaynak boyutu. Bit 0 seti ile, kaynakın 64 bit SipHash'ini tutar.

Sihirli sayı orada yaşıyor .`Include/internal/pycore_magic_number.h`3.11'den bu yana kuralı Python 3.n'un 2900 + 50n'de başlaması ve bir yayın döngüsü içinde her bytecode değişimi bir tane eklemesi.`\r\n`Python 3.15.0 2026-10-09'da yayınlandı ve bu cihazları yapan makineye yüklenmediğinden, bu yüzden numarası başlık dosyasından değil, buradaki bir dosyadan geliyor.

Anlatıcı başına iki pyc dosyası var.`compile_pyc.py`Onları yazdı .`py_compile.compile(..., dfile="ledger.py")`Böylece kaydedilen dosya adı `ledger.py`3.14 dosyalarının ilk 16 baytı:

```text
checked-hash   2b 0e 0d 0a  03 00 00 00  c7 16 c7 fc c5 1d 81 01
timestamp      2b 0e 0d 0a  00 00 00 00  8d 60 cf 6a  f1 01 00 00
```

Zaman damgası başlığı kelimesi kelimesi oku. `03 00 00 00`veya `00 00 00 00`Bayrak kelimesi.`8d 60 cf 6a`0x6acf608d = 1791975565, mtime of `ledger.py`Dosya oluşturulduğunda.`f1 01 00 00`Kaynak boyutu 497. Kontrol edilen hash dosyası 3 ve sekiz hash bayt yerine bayraklar taşıyor.

| Interpreter | Magic bytes | Word | File bytes | `grade.co_code` bytes | `grade` instructions |
|---|---|---|---|---|---|
| 3.11.14 | `a7 0d 0d 0a` | 3495 | 1054 | 80 | 31 |
| 3.12.12 | `cb 0d 0d 0a` | 3531 | 937 | 62 | 26 |
| 3.13.12 | `f3 0d 0d 0a` | 3571 | 943 | 70 | 26 |
| 3.14.6 | `2b 0e 0d 0a` | 3627 | 965 | 96 | 35 |

`read_pyc_header()`İçeride`code/main.py`Bu alanları geri gönderir ve kelimeden versiyonu isimlendirir. `importlib.util.MAGIC_NUMBER`Çalışan tercüman için aynı dört byte verir. `python3 code/main.py compare`kaynağı her bir ile birleştirir `python3.11`- ...`python3.15``PATH`Her biri için, okuyucu tarafından görülen başlığı, tercümanın kendisi hakkında bildirdiği gerçeklerin yanında basıyor.

## Marshal Kod Nesne Alanı Alanı Yazıyor

Her bir cihazın 16 byte'si `e3`- Evet .`0x80 | ord('c')`:  ile kodlanmış bir nesne için marşal tip kodu`FLAG_REF`Satır, okuyucuya nesneyi daha sonra hatırlamasını söyler.`r`Referanslar. Marshall belgeleri biçimin amaçlı belgelenmemiş olduğunu ve kod nesnelerin sürümler arasında uyumlu olmadığını söylüyor. Her iki ifade de doğru ve biçim hala okunmak için yeterince küçük. `Python/marshal.c`Tip kodlarını listeler: `N`Hiç değil.`i`32 bit int, `s`bytes, `z`ve `Z`Kısa ASCII ipleri, `(`ve `)`Tüpler,`c`bir kod nesnesi, `r`Bağlantılar, referans alanını çocuklarının önünde rezervasyon eder, böylece okuyucu da aynı şeyi yapar.

`w_complex_object()`3.11 ile 3.15 arasında bir kod nesnesini sabit bir sırada yazıyor.`argcount`- Evet .`posonlyargcount`- Evet .`kwonlyargcount`- Evet .`stacksize`- Evet .`flags`32 bit inci olarak, o zaman `code`- Evet .`consts`- Evet .`names`- Evet .`localsplusnames`- Evet .`localspluskinds`- Evet .`filename`- Evet .`name`- Evet .`qualname`O zaman nesneler olarak `firstlineno`O zaman ...`linetable`ve `exceptiontable`3.14 dosyasının modül kod nesnesini 17 byte'den elle çöz:

```text
00 00 00 00   argcount 0
00 00 00 00   posonlyargcount 0
00 00 00 00   kwonlyargcount 0
01 00 00 00   stacksize 1
00 00 00 00   flags 0
f3 22 00 00 00   type 's' with FLAG_REF, 34 bytes of co_code follow
80 00  52 06  74 00  52 01  17 00  74 01 ...
```

Kod baytları her talimat için iki: `80 00`- Evet .`RESUME 0`- Evet .`52 06`- Evet .`LOAD_CONST 6`- Evet .`74 00`- Evet .`STORE_NAME 0`ve`17 00`- Evet .`MAKE_FUNCTION`. 3.14 listesi, aynı beş modül düzeyinde açıklamalar basıyor.`code`Dört kutuş kod nesnesini tutan sabitler gelir ve sonralar.`names`- Evet .`('LABELS', 'percent_change', 'grade', 'total', 'grade_label')`- Evet .

`Unmarshaller`İçeride`code/main.py`Bu düzeni ve 3.9 ve 3.10'un kullandığı eski düzeni okuyor.`nlocals`- Evet .`varnames`- Evet .`freevars`ve`cellvars`Bu, bir alan oluşturur.`CodeObject`Gerçek nesneyle aynı özellik isimleri ile.`varnames`Filtreler`localsplusnames`- ...`CO_FAST_LOCAL`Birazcık .`localspluskinds`- Evet .`grade`Dört dosyanın her birinde geri gönderir.`('score', 'bucket')`- Evet .`firstlineno`10 ve boş olmayan bir tane.`linetable`- Test .`test_unmarshaller_agrees_with_the_running_interpreter`her alanı `marshal.loads()`Diğer üç dosya bizim kodumuzla okunur ve okunmaz.`marshal`Bu tercümanın altında.

## Dört Anlatıcı, dört Bytecode derecesi

Bu belgede her versiyonda bir uyarı vardır: bytecode CPython'un uygulanma ayrıntılarıdır ve aynı kalmayacağı garanti edilmez.`python3.1N -m dis ledger.py`Her tercüman için yakalamıştı.

3.11'de`grade`Bu şekilde başlar:

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

`BINARY_OP`Ofset 6'da ve sonraki talimat 10'da oturuyor. Arasındaki iki bayt, PEP 659'dan gelen özel adapttif tercümanın bir içe aktarım girişidir. `COMPARE_OP`16'da 22'den sonra, yani iki önbelleğe sahip.`show_caches=True`3.12 yerine`LOAD_CONST`Ek olarak .`RETURN_VALUE`- Evet .`RETURN_CONST`, atlamayı `POP_JUMP_IF_FALSE`, ve delirtiyor .`grade`80'den 62 byte'ye kadar. 3.13 etiket basıyor.`L1`- ...`L4`Karşılaştırmak yerine CLI verir `-C`depolama ve`-O`3.14 çıkarır `RETURN_CONST`tekrar ekliyor `LOAD_SMALL_INT`ve `LOAD_FAST_BORROW`, ve eklemler `NOT_TAKEN`Her şartlı sıçrayıştan sonra:

```text
 12         20       LOAD_FAST_BORROW         1 (bucket)
            22       LOAD_SMALL_INT           9
            24       COMPARE_OP             188 (bool(>=))
            26       CACHE                    0 (counter: 0)
            28       POP_JUMP_IF_FALSE        3 (to L1)
            30       CACHE                    0 (counter: 0)
            32       NOT_TAKEN
```

- Evet .`-C -O`listede gösteriler 13 `CACHE`İçeride yazılar `grade`: beş gün sonra `BINARY_OP`, birbiri ardınca .`COMPARE_OP`, birbiri ardınca .`POP_JUMP_IF_FALSE`Adaptif cihaz, kasların ne için olduğunu gösteriyor.`dis.dis(grade, adaptive=True)`Parmak izi`RESUME_CHECK`ve `COMPARE_OP_INT`Açık bir listeye göre`RESUME`ve `COMPARE_OP`ve`total`gösteriler`FOR_ITER_LIST`- Evet .`BINARY_OP_ADD_INT`ve`JUMP_BACKWARD_NO_JIT`Uzman biçimler aynı yerde yaşar.`co_code`Bir pyc asla bunları içermez, çünkü uzmanlaşım hafıza ile gerçekleşir.

Bu nedenle dekompiler versiyon tavanlarına sahiptir. uncompyle6 3.9.3 Python 1.0'dan 3.8'e kadar bytecode kabul ettiğini belirtir. decompyle3 3.9.3 3.7 ve 3.8'i okuyor. xdis 6.3.0, her ikisinin arkasındaki çapraz versiyon sökücü, 3.13.`python_3_13.cpp`Bu dosyada ve bilinmeyen bir opkod yazısında.`Unsupported opcode`PyLingual 3.6'dan bu yana yayınlanan her sürümü iddia eder ve kendi çıktısını yeniden oluşturmak ve kontrol etmek için 3.8'den 3.15'e kadar yorumcu kullanır. 3.14 dosyası için ilk üç dosya reddedilir veya başarısız olur ve sadece son iki geçerlidir. Bir araç seçmeden önce sihirli kelimeyi okuyun.

## Sınıf Dosyası Kendi Sözlüğünü Korur

JVMS Java SE 25, bölüm 4.1, düzenlemeyi bir yapı olarak verir: `magic`- Evet .`minor_version`- Evet .`major_version`- Evet .`constant_pool_count`, sabit havuz,`access_flags`- Evet .`this_class`- Evet .`super_class`- ...birbirliği, alanlar, yöntemler, özellikler.`0xCAFEBABE`Java SE 25 sanal makinesi büyük sürümleri 45 ila 69 arasında kabul eder ve 65535'in küçük bir kısmı bir ön görüntüleme özelliği dosyasını işaret eder.`Ledger-g.class`- Evet .`ca fe ba be 00 00 00 41 00 5e`: büyük 65 Java 21 ve `0x5e`= 94 sabit havuz sayısıdır.`Ledger-jdk25.class`, aynı kaynaktan javac 25.0.2 tarafından oluşturulmuş, başlıyor `ca fe ba be 00 00 00 45`69 büyük.

Sürekli havuz sınıf dosyasının kendi sözlüğünü tutduğu yerdir.`#13`- ... ...`-g`Bu bir `Methodref`Bu sınıfı işaret ediyor.`#8`ve isim ve tip `#14`. Indeksleri takip ederek `Ledger.grade:(I)I`Tam olarak ne demek oluyor ?`javap -v``//`- Deskriptör .`(I)I`Bir tane .`int`parametre ve bir `int`Sonuç.`([I)I`- Evet .`total`Parametre bir `int`Array. kodun dokunduğu her yöntem, alan ve sınıf böyle bir giriş vardır ve bölüm 4.10'daki doğrulayıcı talimatları onlarla aynı olmayan bir dosyayı reddeder.`ClassFile`sınıfı `code/main.py`Tablo 4.4 ' deki 17 sabit etiketleri okuyor ve bir `Long`veya `Double`Bilinmeyen bir etiket ve son özelliğin ardından baytlar üzerine yükseltilmektedir.

Atributlar sınıf, her alan, her yöntem ve `Code`JVMS, sanal makineyi bilmediği özellikleri görmezden gelmesi gerektiğini söylüyor, bu nedenle hatalama tabloları bir yöntem vücudu değiştirmeden eklenebilir veya düşebilir.`-g`Yerel değişkenler dahil tüm debugging bilgileri oluşturur, varsayılan satır numaraları ve kaynak dosyası sadece oluşturur ve `-g:none`Üçü de ölçüyü oluşturur:

| Build | Bytes | Constant pool count | `LineNumberTable` | `LocalVariableTable` | `SourceFile` | `grade` code bytes |
|---|---|---|---|---|---|---|
| `javac -g` | 1832 | 94 | 7 methods | 6 methods | yes | 50 |
| `javac` | 1581 | 82 | 7 methods | none | yes | 50 |
| `javac -g:none` | 1404 | 79 | none | none | no | 50 |

50 byte kodunu `grade`Üç dosyada da aynıdır ve test onu kontrol ediyor.`-g`eklenir `grade`Bir tane .`LocalVariableTable`Satır: başlangıç 0, uzunluk 50, boşluk 0, isim `score`, tanımlayıcı `I`Bu olmadan bir dekompiler 0 tipi boşluğu görür .`int`Bir isim uydurmak zorunda.`StackMapTable`Her yapıtaşta kalır çünkü doğrulayıcıya ihtiyacı var ve `BootstrapMethods`Bu özellik kalır çünkü `main` Bağlantıları bağlar`invokedynamic`- Evet .

## Masa Çıkartıcıları Elle Çıkart

JVMS 6. bölümünde her talimat bir opcode byte ve opcode isimlerini veren operandlar olarak tanımlanır. Şube ofsetleri, şube opcode adresine göre 16 bit imzalanmış değerlerdir. Bu, x86-64'ten farklıdır.`tableswitch`ve `lookupswitch`32 bitli operandları 4'ün katı bir adresden başlayacak şekilde sıfırdan üç byteye kadar doldurma ile başlayın.

 bytes`grade`4'te bir bilgisayar`Ledger-g.class`- ...

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

36 byte, tek talimat ve tümü.`switch (score / 10)`9 ve 10 için ortak bir dava ile.`switch`33 dersinde sınır kontrolü yapılması gerekiyordu.`lea`, a `movslq`, bir `add`Burada hedefler talimatlarda ve aynı zamanda birlikte olmaları da var.

`disassemble_jvm()`Tüm 202 tanımlanmış opkodları operand genişlikleri ile kapsar, dolgu kuralını izler ve operandları yol gösterir `javap`- Evet.`compare_with_javap()`Tutuklananları inceliyor .`javap -c -p`Çok satırlı metin de dahil olmak üzere `tableswitch`Bu test, tüm dört yapıdaki 108 talimatın 108'ine uyum sağlıyor.`test_branch_offsets_are_relative_to_the_branch_instruction`kontroller`ifne`6'da pc 1 inişinde.`if_icmpge`33'te 13'te iniş yaparak ve`goto`30'da 10'da geriye inmek.

Radare2 6.2.4, bu dersler için kaynaktan inşa edilmiş, aynı dosyayı okuyor. `rabin2 -I`Raporlar`arch java`- Evet .`lang java 21`- Evet .`linenum true`ve`lsyms true`, yani versiyon ve iki düzeltme tablosunun okunması. `pd 14 @ sym.Ledger.grade`basıyor `tableswitch`Beş hedefine oklar ile vurur.`Unable to parse code attribute: 2`Bu dosyada, araçın kendi adları sınırlı ve bir neden olarak kalmak için `javap`- İbadetçi olarak. Bu biçim için dekompilicular Python ile karşılaştırıldığında olgunlaşmıştır. CFR 0.152 MIT lisanslı. Procyon 0.6.0 ve Vineflower 1.12.0 Apache-2.0'dur ve Vineflower Java 21 desteği ile Fernflower bir çatal. Fernflower'in kendisi IntelliJ Topluluğu depolarının içinde yaşıyor. JADX 1.5.6 Android DEX biçimini kapsar ve JD-GUI son sürümünü 2019'da yayınladı. Harrand, Soto-Valero, Monperrus ve Baudry 2020 yılında sekiz tane ölçtüler. Sintiktiksel olarak en iyi üretilen çıkış sınıfların yüzde 84'i için ve semantik olarak eşdeğer çıkış yüzde 78'dir. Meta-decompilerleri, tek bir araç tarafından işlenmeyen sınıfların yüzde 37,6'sını geri aldı. Tipler, isimler ve doğrulanmış yığınlar biçimi çözülebilir hale getirir. Hiçbir dekompiler tamamlanamaz.

## Bir Wasm Modül Bölümler Listesidir

Temel özellikler bir modülün önbellek olarak tanımlanmaktadır.`00 61 73 6d 01 00 00 00`, iplik `\0asm`ve 1. versiyon, ardından bölümler.`u32`LEB128'deki boyut ve içeriği. 1 ila 13'e kadar olan tanımlı bölümler, her biri en fazla bir kez ve sırada. 0 isimli özel bir bölümdür, herhangi bir yerde izin verilir. Tüm tam sayıların LEB128 olduğu için`e4 00`100 ve `80 08`1024'e kadar.`wasm-objdump -h`- Evet .`ledger.wasm`7 bölümden bir liste oluşturur ve `WasmModule`Aynı yedi tane aynı yük oranları ile bulur:

| Section | Payload | Count | What it holds for ledger |
|---|---|---|---|
| Type | 10 to 26 | 3 | `(i32) -> nil`, `(i32, i32) -> i32`, `(i32) -> i32` |
| Import | 28 to 39 | 1 | `env.log` with type 0 |
| Function | 41 to 46 | 4 | type index for each defined function |
| Memory | 48 to 51 | 1 | one page, no maximum |
| Export | 53 to 110 | 5 | `memory` and the four function names |
| Code | 113 to 271 | 4 | bodies of 23, 63, 44, and 23 bytes |
| Data | 273 to 290 | 1 | `F\0D\0C\0B\0A\0` at offset 1024 |

Fonksiyon ve Kod bölümleri arasındaki bölme var, böylece bir tarayıcı tüm dosya gelmeden önce oluşturmaya başlayabilir. Her kod girişinin bir boyutu, yerel açıklamaların vektörü ve bir ifadedir.`grade`Yerli vektör `01 7f`: bir grup bir `i32`- Evet .`bucket`, türüyle ve adı olmadan.

Kontrol akışı yapısal olarak yapılandırılır.`block`- Evet .`loop`veya`if`Etiketler yuva derinliği ile indekslenir.`br_table`Etiket listesi indeksi eden bir operand aracılığıyla dolaylı bir şubesi gerçekleştirir.`grade`Dosya ödemesi`0xa3`- ...

```text
0e                  br_table
0b                  11 labels follow
04 04 04 04 04 04   buckets 0 to 5: label 4, the outermost block, returns 0
03 02 01 00         buckets 6, 7, 8, 9: labels 3, 2, 1, 0
00                  bucket 10: label 0, shared with 9
04                  default label 4
```

Her etiket derinliktir. 0 etiket en içidir.`block`, ve kodunun ardından `end`- Evet .`i32.const 4`Ardından `br 4`Sonuç blokundan çıkmış.`block`Masanın önündeki talimatlar, on bir etiket ve beş etiket.`br`Tümden sonra talimatlar `switch`, ve bir onaylayıcı yapıdan çıkan herhangi bir dalı reddeder.`disassemble_wasm()`derinliği izler. Yani listeleme indentleri gibi`wasm-objdump`,                                            `unreachable`- ...`i64.extend32_s`, ve tutsaklarla eşleşir .`wasm-objdump -d`Her iki yapı için de 77 talimatın 77.'sinde.

Adlar, basit bir modülün düştüğü tek şeydir.`wasm-objdump`Hâlâ izler `<grade>`Çünkü Dışarı çıkarma bölümü, işlev indeks 2'e doğru bir dizileri haritası yapar ve okuyucu da aynı şeyi yapar. 290 baytlı dosyada yerel isimler hiçbir yerde bulunmaz. `wat2wasm --debug-names`Adaylık bir bölüm ekliyor `name`Modül adı, fonksiyon adı ve yerel isimler için alt bölümler ile. Dosya 425 byte'ye kadar büyüyor. Okuyucu bulur `{0: 'score', 1: 'bucket'}`2 ve  fonksiyon için`{0: 'values', 1: 'count', 2: 'sum', 3: 'i'}`3. fonksiyon için.`wasm-strip`Bu kısım, bir kez daha kaldırılır. Araç-konvensiyon deposu iki taşıyıcıyı daha tanımlar.`.debug_*`Gümrük bölümleri.`sourceMappingURL`Özel bölüm, sütun numaraları ikili olarak byte karşılaştırılmış olan bir kaynak haritasını gösterebilir.

2026-09-15'te yayınlanan 1.0.42'de, araçlar 2026 yılının sonunda hareket etti.`wasm-decompile`Bu makinede Homebrew'un 11 aletini bulmuştur.`print`- Evet .`objdump`ve`demangle`. Binaryen versiyonu_133 `wasm-dis`6.2.4 modülü de okuyor.`rabin2 -I`diyor ki`arch wasm`- Simgolu .`grade`Başlıyor .`0x8e`, yerel vektörün başladığı yer,`wasm-objdump``0x8b`Bu listeye eski mnemonikler kullanılıyor.`get_local`- Evet .`set_local`ve`brtable 11 4 4 ...`Etiket sayısını yazdırarak. Üç alette de baytlar aynıdır ve yazım farklıdır, bu yüzden bir karşılaştırma, alındığı aletin adını vermektedir. Bu ders için yapılan araştırma, Ghidra'nın işlemci dizininde WebAssembly işlemci modülü bulunmadı ve bu liste tam olarak okunmadı. Üçüncü taraf Ghidra-wasm eklentisi v2.4.0 Ghidra 12.0'yu hedef alır. Özelliklerin kendisi bir canlı belgedir. W3C sayfası `wasm-core-2`13 Ekim 2026'da başvuru önerisi taslağı, özetinde 3.0 sürümü açıklanır ve editörlerin taslağı aynı tarihte bulunur.

## ECMA-335 Metadata Programın Kendi Veritabanı

.NET birimi bir PE dosyası. `LedgerNet.dll` ile başlar.`MZ`, üç bölümden oluşuyor .`.text`- Evet .`.rsrc`ve`.reloc`, ve makineyi ilan eder .`0x14c`Çünkü kompiliör platform tarafsız kodu yayımladı. Seçimsel başlıkta, CLR Runtime Header'in veri dizisi 14 RVA'ya işaret eder `0x2008`. ECMA-335 II.25.3.3 72 byteyi burada tanımlar:

```text
48 00 00 00   Cb 72
02 00 05 00   MajorRuntimeVersion 2, MinorRuntimeVersion 5
78 21 00 00   MetaData RVA 0x2178
84 07 00 00   MetaData size 1924
01 00 00 00   Flags: COMIMAGE_FLAGS_ILONLY
05 00 00 06   EntryPointToken 0x06000005, MethodDef row 5, which is Main
```

RVA' daki metadata kökü `0x2178`İmza ile başlar.`42 53 4a 42`, şöyle okuyor:`BSJB`, sonra 1.1 sürüm ve dizileri `v4.0.30319`Beş akış başlığı takip ediyor:`#~`- Yapabilir miyim ?`0x6c`O zaman ...`#Strings`- Evet .`#US`- Evet .`#GUID`ve`#Blob`II.24.2 her tür akım en fazla bir kez meydana gelir diyor.`#~`Akış bir  ile başlar.`HeapSizes`Bayt, burada sıfır, yani her ip, GUID ve blob indeks 2 bayt genişliğinde ve 64 bit.`Valid`Maske, mevcut tabloların isimlerini belirler.

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

Bir satır boyutu hiçbir yerde saklanmaz. II.22 her sütunu bir tür verir ve II.24.2.6 boyut kuralını verir.`HeapSizes`. Basit bir tablo endeksi, 65536 satırdan az olduğu halde iki byte. B etiket bitleri ile n tabloya işaret edebilen kodlanmış bir indeks, her bir tabloda 2^(16-b) satırdan az olduğu halde iki byte. `CliAssembly`Bu kurallardan 14 satır boyutlarını hesaplar ve satır sayılır. Sistem.Reflection.Metadata dump'u, aynı boyutları ve aynı tablo sıfırlamalarını rapor eder. Bu test aritmetikleri kanıtlar.

III.1.9 simgesini tanımlar: yüksek bayt tablo, düşük üç bayt ise 1 tabanlı satırdır. `0x06000002`- Evet .`MethodDef`Satır 2. Bu satır RVA'ya sahiptir.`0x2060`, isim`Grade`, ve bir imza blob .`00 01 08 08`: Varsayılan arama konvansiyonu, bir parametresi, geri dönüş `int32`, parametre`int32`- Bu .`ParamList``Param`, adı `score`Param masası , ILSpy ' nin yazdırma gücünün bir nedeni .`Grade(int score)`RVA'da, bir boşaltma yapısı.`0x2060`Metod vücudu bir yağ başlığı ile başlar:

```text
13 30         flags 0x13: fat, init locals; size 3 dwords
02 00         MaxStack 2
2d 00 00 00   CodeSize 45
01 00 00 11   LocalVarSigTok 0x11000001
```

`StandAloneSig`1 satır tutulur `07 01 08`- Evet .`LOCAL_SIG`, bir yerel, `int32`. Yerli bir tür ve isim yoktur. ECMA-335 bölümü V'nin hatalama değişimi biçiminde yerli isimleri tutar ve .NET SDK onları bir PDB'ye yazar. Bu cihaz `DebugType`Hiçbir şey yok, yani hiçbir tablo ve dosya adı taşımaz.`bucket`- Evet .`PercentChange`yerine küçük bir başlık var: ilk baytı `3a`- Evet .`0x0e << 2 | 2`, 14 baytlı bir vücut ve yerel olmayan ve varsayılan 8'lik bir yığın.

45 kod baytları `Grade`Partition III opcode tablosu ile çözülür. `switch`- Opcode`0x45`Ardından bir `u32`Sayım ve o kadar çok.`int32`Tablo sonrası talimat ile ilgili hedefler:

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

Yükleyici , `switch`Bu yüzden 6 numaralı dava ilk hedef.`disassemble_cil()`tablolardaki simgelerden birikim: `ldsfld Labels`- Evet .`call Grade`- Evet .`call System.Console::WriteLine`ve`ldstr ' '`- ...`#US`Tüm bunların orakelinin adı`MetaDump`, kısa bir C # programı , üzerinde inşa edilmiş armatürlerde .`System.Reflection.Metadata`Bu, her tablo sayısını, boyutunu ve sıfırlamasını, her yöntemin RVA'sını, imzasını, parametrelerin isimlerini ve IL bytesini ve 226 alanını yazdırırır.`System.Reflection.Emit.OpCodes`- Evet .`compare_with_metadump()`246 kontrol için aynı fikirde.`prefix`Ders masasında 219 giriş var çünkü içerir `no.`III.2.2'den, emisyon tablosunun hiç sahip olmadığı.

Format için araçlar: ILSpy 11.0 (MIT, 2026-08-12) Avalonia masaüstü yapılandırması aracılığıyla macOS'ta çalışır. `ilspycmd`11.1.0.9782 ile birlikte IL baskı`-il`ve bir yöntem seçerken `-m 0x06000002`. dnSpyEx 6.6.0 sadece Windows'ta dnSpy devam ediyor.`ildasm`Bu yüzden, bu sistemin içinde değil, NuGet paketleri olarak gemiyi kullanıyoruz.`rabin2 -I`diyor ki`arch cil`ve `class PE32`ve`is`listeler`Ledger.Grade(int:score):int`Bu yapıtaşta CIL sökücü bulunmamaktadır. Bu yapıtaş .NET SDK 8.0.205 ile inşa edilmiştir çünkü bu yapıtaş makinesinde kurulan SDK. .NET 10 2025-11-11'den beri geçerlidir ve aynı ECMA-335 yapılarını yazar.

## Her konteynerde Ne Var

- Yapacağım .`grade`Bir masadaki beş konteynerden.`python3 code/main.py keeps`, okuyucuları cihazların üzerinde kullanır:

| Container | Body bytes | Function name | Parameter names | Parameter and return types | Local names | Line numbers | Control flow |
|---|---|---|---|---|---|---|---|
| ELF object, clang -O0 | 118 | `grade` in `.symtab` | none | none | none | none, no `.debug_*` sections | 5 jumps and 1 indirect jump through a relocation table |
| CPython 3.14 pyc | 96 | `co_qualname` | `score` | none | `bucket` | `co_linetable`, first line 10 | 4 compare and `POP_JUMP_IF_FALSE` pairs |
| JVM class, `javac -g` | 50 | constant pool | `score` in `LocalVariableTable` | `(I)I` | none beyond the parameter | `LineNumberTable`, 6 rows | 1 `tableswitch` |
| WebAssembly | 63 | Export section | only with a name section | `(i32) -> i32` | only with a name section | none | 6 nested blocks, 1 `br_table`, 4 `br` |
| .NET assembly | 45 | `MethodDef` | `score` in `Param` | `static int32(int32)` | none, types only in `StandAloneSig` | none without a PDB | 1 `switch`, 1 `br.s` |

Tabloda göreceğiniz dekompiler sonuçları açıklanıyor.`int total(const int *, int)`- ... ...`int total(long param_1, uint param_2)`Bu nedenle Python dekompilerleri her versiyonda kırılır ve isimleri ücretsiz olarak kurtarır. Bir sınıf dosyası tipleri ve doğrulanmış yığınları tutar, isimleri tutar.`-g`Bu, bir "sürekli"`switch`Bir Wasm modülü yapıyı inşa ederek korur.`wasm2wat`.NET birimi en tam tanımını korur, çünkü metadata tabloları normatifdir ve hala yerel bir ad için bir PDB gerektirir.

Tablo, dekompilerin neyle çalışması gerektiğini ve hangi çıkışlarının kaydedilen bir gerçeği kopyaladığını ve hangi çıkışların birini çıkarıldığını söyler. ILSpy çıkışında bir parametrel adı bir kopyadır. Aynı çıkışta bir yerel isim bir PDB bulunmadıkça bir sonuçtır. Ders 35 bu farkı her iddianın otoritesi olarak kaydeder.

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu. her pyc için hem başlıkları, dosya ve `grade`Bu sayede, sınıfın oluşturduğu tüm sınıflar için, sınıfın sürümü, boyutları, hatalama tablosunun sayıları ve `javap`Her Wasm yapı için bölümler, türler, fonksiyonlar, isim bölüm içeriği ve `wasm-objdump`birleştirme için CLI başlığı, akışları, masa satır sayıları, yöntemleri ve Sistem.Reflection.Metadata anlaşması verir.`PATH`- Evet .

Oku `code/main.py`Bu sırada:

1. `Reader`Kürsör ve tam sayılar genişliğini tutar. `uleb()`ve `sleb()`Wasm ve .NET blob toplularının ihtiyaç duyduğu LEB128 okuyucuları.
2. `read_pyc_header()`- Evet .`Unmarshaller`ve`PycFile`Bir pyc oku.`parse_dis_text()`Tutuklananları okuyor .`dis`listeler, böylece çapraz versiyon karşılaştırması test sırasında dört tercüman gerekmez.
3. `ClassFile`sınıf dosyasını okuyor ve `disassemble_jvm()`Kodunu çözüyor.`parse_javap_code()`ve `compare_with_javap()`- Orakel kontrolü.
4. `WasmModule`bölümleri okuyor ve `disassemble_wasm()`Bir ifadeyi derinliğiyle çözüyor.`compare_with_wasm_objdump()`- Bu oracle kontrolü.
5. `CliAssembly`PE, CLI başlığı, metadata kökü, akışlar ve tabloları yürütür. `TABLE_SCHEMAS`ve `CODED_INDEXES`II.22 ve II.24.2.6 veriler olarak kullanılır. `disassemble_cil()`Bir cesedi çözüyor ve `compare_with_metadump()`- Kontrol et.
6. `NativeObject`işlevi sembollerini listedecek kadar ELF okuyor ve ders 33 listesi metni olarak alıyor. `what_each_keeps()`ve `figure_data()`karşılaştırmayı yapın.

Beş emir daha var.`python3 code/main.py pyc FILE`- Evet .`class FILE`- Evet .`wasm FILE`ve`dll FILE`Verdiğiniz dosyada yapı ve her fonksiyonun listesi basın. `python3 code/main.py compare`bir araya getirir `ledger.py`Her tercümanla birlikte.`PATH`Ve her birinin yazdıklarını basıyor.

## Kullan

Bu sırada okuyucuları kendi yaptığın bir konteynerde kullan.

1. İlk baytları oku ve biçimi isimlendirin.`0d 0a`bir pyc,`ca fe ba be`sınıf dosyası, `00 61 73 6d`bir modül, `4d 5a`Veri dizin 14'te bir monte ayarlanır.
2. Başlığı okuyun ve adı verilen üretici versiyonunu yazın. Bir pyc için sihirli kelime, bir sınıf dosyası için ana versiyon, bir montaj için çalıştırma süresi ve metadata versiyonu zincirleri.
3. Çalıştırmadan önce çalıştırmayı planladığınız her dekompilerle o versiyonla karşılaştırın.
4. Okuyucuyu ve biçimin kendi araçlarını aynı dosyada çalıştırın ve onları satır satır karşılaştırın.
5. Kayıp veya kayıp olarak belirleyin ve tablo, özelliği veya bölümün adını verin.
6. Sadece sonra dekompiler çıkışını okuyun. Her bir ismi işaretleyin ve bir gerçekin bir kopyası veya bir sonucu olarak yazın.

Bir tercüman, JDK, SDK veya wabt sürümü değiştirdiğinde,  ile yeniden inşa edin.`build_fixtures.sh`Ve yeniden yakalamak, çünkü değiştirilmiş bir listede değişmiş bir yer vardır.

## İnteraktif Laboratuvar

### Laboratuvar A: başlığı okuyun, sonra kod nesnesini okuyun

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats/code
python3 -q
```

Çık:

```python
from main import *
pyc = load_pyc("ledger.cpython-311.pyc")
pyc.header.to_dict()
pyc.module.names
pyc.functions()["grade"].varnames
len(pyc.functions()["grade"].code)
```

İlk çağrıdan önce sihirli kelimeyi yazın.`ledger.cpython-314.pyc`Ve ikisini karşılaştır.`code`- Sonra dene.`import marshal; marshal.loads(pyc.data[16:])`3.11 dosyasını çevirmenizin altında okuyun ve hatayı okuyun.

### Laboratuvar B: sabit havuz zinciri

```python
cls = load_class("Ledger-g.class")
cls.constant(13)
cls.constant(14)
cls.describe_constant(13)
[row["text"] for row in jvm_listing(cls, "grade")]
```

Takip edin .`#13`- ...`#8`ve `#14`Sonra da `Utf8`Telefon etmeden önce elden yazılar.`describe_constant`- O zaman yüklen .`Ledger-gnone.class`Ve aramak .`cls.method("grade").attribute_names()`İkisi de.`Code`Array aynı, özellikler değil.

### Laboratuvar C: derinlik ve etiketler

```python
module = load_wasm("ledger.wasm")
[(row["depth"], row["text"]) for row in wasm_listing(module, "grade")]
module.function_name(2)
load_wasm("ledger-names.wasm").names["locals"][2]
```

Bul .`br_table`Sırayla ve derinliğini oku.`end`Ardından sırayı çiz ve her birini tabloda bir etiket numarası ile eşleştir.`ledger.wat`Ve bul .`block $six`Bu etikette 3 isim var.

### Laboratuvar D: token'dan byte'e

```python
asm = load_assembly("LedgerNet.dll")
asm.method("Grade")
body = asm.method_body(asm.method("Grade")["RVA"])
body.fat, body.max_stack, body.code_size, hex(body.local_signature_token)
asm.token_text(0x11000001)
[row["text"] for row in cil_listing(asm, "GradeLabel")]
```

RVA dosya sıfırını hesaplayın `0x2060`- ...`.text`Bölüm başlığı el ile yapıp karşılaştırın `asm.rva_to_offset(0x2060)`O zaman yukarı bak .`asm.row(0x08, 3)`Ve isim nerede bul .`score`Hayatları.

## Pratik Laboratuvar

Karşılaştırmaya beşinci bir kaynak dili veya tabloya altıncı bir gerçek ekleyin.

Gereksinimler:

- Bir kompili olan bir dilde bir işlevi bir döngü ve yerel değişken ile yazın, örneğin Kotlin bir sınıf dosyasına veya Rust bir Wasm modülüne.`build_fixtures.sh`- Evet .
- Okurla uyumlu olan okuyucuyu her talimat için müjdeciye uygun hale getir.
- Uzaklaştırma`what_each_keeps()`Yeni konteynerle birlikte, her konteyner için bir faktör daha: vücut bir istisna masası taşıyor mu yoksa `try`Bölge.
- Yeni konteyneri `figure_data()`ve yeniden canlandırmak için.`site/figures-re-43.js`- Evet .
- Bir okuyucu, bir gerçeği bulduğu tablo, özelliği veya bölümü isimlendirmeden kaydettikçe başarısız olan bir test yazın.

Başarılı olmak demektir .`python3 code/main.py keeps`Her hücre için kanıt olan yeni satır gösterir ve her oracle karşılaştırması hala aynı fikirde.

## Ders Artifakti

Bu ders de içerir .`outputs/skill-bytecode-and-managed-formats.md`. Bir bytecode konteynerini bir başlık raporu, bir fonksiyonun kontrol edilmiş listesi ve her isim, tip ve yapıyı saklanan veya kaybedilen olarak işaretleyen bir faktör tablosuna dönüştürmek için kullanın.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/43-bytecode-and-managed-formats
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Verifikasyon, şunu kanıtlamalıdır:

- Dört pyc başlığı 3495, 3531, 3571, ve 3627 sihirli kelimeleri taşıyor, bayraklar 3, 8 baytlık bir haş, ve zaman damgası dosyaları bayraklar 0, mtime 1791975565 ve boyut 497 taşıyor
- 3.11 ve sonrası için her sihirli kelime, `2900 + 50n`Kural serbest bırakır.
- Unmarshaller aynı isimleri, sabitleri, kod bytesini, değişken isimlerini ve çizgi tablosunu gönderir.`marshal.loads()`Dosyada çalışan tercüman yazdı
- Dört dosyanın hepsi modül adlarını saklıyor.`('score', 'bucket')`için`grade`, ilk satır 10 ve `ledger.py`Dosya adı olarak
- `grade.co_code`Dört versiyonda 80, 62, 70 ve 96 byte ve kaydedilen listeler 31, 26, 26 ve 35 talimatları vardır.
- 3.11 listesi `POP_JUMP_FORWARD_IF_FALSE`, 3.12 ve 3.13'te `RETURN_CONST`, ve 3.14'te `LOAD_SMALL_INT`- Evet .`LOAD_FAST_BORROW`ve`NOT_TAKEN`
- 3.14'ü`-C -O`listede 13 önbelleğe girdi gösterildi `grade`, beş tanesi sonra .`BINARY_OP`, ve uyarlama listesi gösterileri `COMPARE_OP_INT`
- Başlık olmadan `0d 0a`, bir kısaltılmış başlık ve bir kod nesnesi olmayan bir vücut yükseltmek `FormatError`
- Bir talimat listesi sadece çalışmakta olan tercüman tarafından yazılmış pyc için mevcuttur ve alınanlara eşleşir `dis`çıkış
- sınıf dosyalarının büyükleri 65 veya 69, boyutları 1581, 1832, 1404 ve 1581 ve sabit bir grup sayıları 82, 94, 79, ve 82
- sabit`#13`karar verir `Method Ledger.grade:(I)I`ve `#47`- ...`String F`
- JVM sökücü kabul ediyor `javap -c -p`Dört yapıdaki 108 talimatın 108-nde
- `tableswitch`pc 4'te düşük 6, yüksek 10, varsayılan 48, hedefleri 46, 44, 42, 40, 40 ile 36 byte
- Üç hatalama seviyesi atribut sayısını değiştirir ve 50 kod baytını `grade`Aynı
- `ifne`- Evet .`if_icmpge`ve`goto`hedefler şubenin opkoduna göre
- Yanlış bir sihir, geri kalan baytlar ve belirsiz bir opkod yükseltmesi.`FormatError`
- Yedi Wasm bölümü yararlı yükleri karşılaştırıyor .`wasm-objdump -h`İsimler oluşturmak bir `name`Gümrük bölümü 293 ila 425
- türleri, `env.log`İtkinlik, 5 ihracat ve 1024'te yazılmış olan veri bölümü`ledger.wat`
- Wasm dağıtıcısı onaylıyor .`wasm-objdump -d`Her iki yapıda da 77 talimatın 77'sinde
- `grade`6 adet yuva blokları var.`br_table`Etiketlerle`4 4 4 4 4 4 3 2 1 0 0`ve 4'ün 6'da varsayılan derinlik ve 1'in `i32`yerel
- İşlev isimleri, isim bölümü olmayan ve sadece yerel isimlerle birlikte yapılan ihracatlardan gelir.
- LEB128 `e4 00`100'e eşit.`7f`-1, `80 08`1024'e benzer blok türleri.`wasm-objdump`
- Yanlış bir önbellek, 2. versiyon ve bilinmeyen bir opkod yükseltmesi.`FormatError`
- Birleştirme PE32 makine ile `0x14c`, RVA'da CLI başlığı `0x2008`, 2.5, `ILONLY`, ve giriş noktası `0x06000005`
- Metadata versiyonu `v4.0.30319`, beş akıntı var ve 14 tabloda sıra sayıları ve sıra boyutları vardır Oracle raporları
- .NET okuyucu , 246 kontrolün 246 ' sında Sistem.Reflection.Metadata ile aynı fikirde .
- `Grade`parametreye sahip `score`İmzalama`static int32(int32)`, şişman bir başlık ile `MaxStack`2 ve 45 kod bayt ve 1 `int32`Adı olmayan yerel
- CIL `switch`hedefler,`br.s`- Evet .`ldsfld`- Evet .`call`ve`ldstr`Operandlar tablolar ve yığınlar üzerinden çözülür.
- CIL opcode tablosu her çalıştırma süresi opcodeyi kapsar ve sadece `no.`
- Bu sayede, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için bir simgeyi oluşturmak için, bir simgeyi oluşturmak için.
- Demo'daki her oracle satırı n'den n'e kadar okunuyor.
- Eğitimsel rakam aynı verileri içerir `figure_data()`üretir

## Üretim Başarısızlık Modları

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

## İşlem Kuralı

Başlık ilk önce okuyun ve gösterdiği üreticiyi isimlendirin. Bilmediği şeyi reddeden bir okuyucu ile konteyneri okuyun ve listesini aynı dosyadaki formatın kendi aracı ile karşılaştırın. Sonra, bir dekompiler'in çıkışında her isim ve tipli için, konteyner onu sakladı veya araç onu çıkarmıştır.

## Daha Fazla Okumak

- [PEP 552: Deterministic pycs](https://peps.python.org/pep-0552/)
- [CPython `Include/internal/pycore_magic_number.h`](https://github.com/python/cpython/blob/main/Include/internal/pycore_magic_number.h)
- [Python `marshal` module documentation](https://docs.python.org/3/library/marshal.html)
- [CPython `Python/marshal.c`](https://github.com/python/cpython/blob/main/Python/marshal.c)
- [Python 3.14 `dis` module documentation](https://docs.python.org/3.14/library/dis.html)
- [PEP 659: Specializing Adaptive Interpreter](https://peps.python.org/pep-0659/)
- [PEP 626: Precise line numbers for debugging and other tools](https://peps.python.org/pep-0626/)
- [PEP 790: Python 3.15 Release Schedule](https://peps.python.org/pep-0790/)
- [uncompyle6 on PyPI](https://pypi.org/project/uncompyle6/)- Evet .[decompyle3 on PyPI](https://pypi.org/project/decompyle3/)- Evet .[xdis on PyPI](https://pypi.org/project/xdis/)- Evet .[pycdc on GitHub](https://github.com/zrax/pycdc)- Evet .[PyLingual on GitHub](https://github.com/syssec-utd/pylingual)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 4: The class File Format](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-4.html)
- [The Java Virtual Machine Specification, Java SE 25, Chapter 6: The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-6.html)
- [javac manual, Java SE 25](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html)ve [javap manual](https://docs.oracle.com/en/java/javase/25/docs/specs/man/javap.html)
- [CFR](https://www.benf.org/other/cfr/)- Evet .[Procyon](https://github.com/mstrobel/procyon)- Evet .[Vineflower](https://github.com/Vineflower/vineflower)- Evet .[Fernflower in intellij-community](https://github.com/JetBrains/intellij-community/tree/master/plugins/java-decompiler/engine)- Evet .[JADX](https://github.com/skylot/jadx)
- [Harrand, Soto-Valero, Monperrus, Baudry, "Java Decompiler Diversity and its Application to Meta-decompilation" (JSS 2020)](https://arxiv.org/abs/2005.11315)
- [ECMA-335, Common Language Infrastructure, 6th edition (June 2012)](https://ecma-international.org/publications-and-standards/standards/ecma-335/)
- [PE Format, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [System.Reflection.Metadata.Ecma335.TableIndex](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.metadata.ecma335.tableindex)
- [ILSpy on GitHub](https://github.com/icsharpcode/ILSpy)- Evet .[ilspycmd on NuGet](https://www.nuget.org/packages/ilspycmd)- Evet .[dnSpyEx on GitHub](https://github.com/dnSpyEx/dnSpy)
- [WebAssembly Core Specification: Binary Format, Modules](https://webassembly.github.io/spec/core/binary/modules.html)ve [Values](https://webassembly.github.io/spec/core/binary/values.html)
- [WebAssembly Core Specification: Custom Sections (name section)](https://webassembly.github.io/spec/core/appendix/custom.html)
- [WebAssembly tool-conventions: Debugging](https://github.com/WebAssembly/tool-conventions/blob/main/Debugging.md)
- [wabt 1.0.42 release notes](https://github.com/WebAssembly/wabt/releases/tag/1.0.42)- Evet .[wasm-tools](https://github.com/bytecodealliance/wasm-tools)- Evet .[Binaryen](https://github.com/WebAssembly/binaryen)- Evet .[ghidra-wasm-plugin](https://github.com/nneonneo/ghidra-wasm-plugin)
- [radare2 on GitHub](https://github.com/radareorg/radare2), bu ders için kaynaklı olarak oluşturulan 6.2.4 sürüm
