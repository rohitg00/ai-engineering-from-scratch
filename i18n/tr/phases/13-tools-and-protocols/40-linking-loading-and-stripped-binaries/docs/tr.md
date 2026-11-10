# Bağlantı, yükleme ve Çekilen Binaryler: PLT, GOT, İçe Aktarma, Düzeltme ve Fonksiyon Kimliği

> Bağlı bir program içermeyen fonksiyonları çağırır. Bu ders bağlantı editörü bu çağrılar için yazdığı tabloları üç formatta okuyor, yüklemeci dolduran yuvaya bir çağrıdan sonra, isimlerinin kaybolmasından sonra bir yapılandırmanın fonksiyonlarını bulur.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and arm64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), 33 (disassembly and control flow), 38 (calling conventions)
**Time:** ~160 minutes

## Öğrenme Hedefleri

- Yer değiştirme kaydından ve sembol tablolarından bağlantı editörünün ondan ne yapacağını belirleyin: sabit bir mesafe, GOT yuvası ile PLT giriş veya dinamik bir yer değiştirme.
- Bir pozisyon bağımsız ELF yürütülebilirinin dinamik bölümünü, PLT'sini ve GOT'sini okuyun ve psABI formülleriyle bir çağrıda bulunarak bunları takip edin.
- COFF nesnesini (20 bayt dosya başlığı, 40 bayt bölüm girişleri, 18 bayt sembolleri, 10 bayt yer değiştirmeler) ve PE32+ görüntüsünün ithalat, ihracat ve temel yer değiştirme dizinlerini okuyun.
- Mach-O zincirlenmiş bir fixup zinciri kelimeden kelimesine çöz ve her kelimeyi karşılaştır .`dyld_info`- Evet .
- Neyi söyleyin .`strip`her formatta kalanları kaldırır ve hala çalıştığını kanıtlamak için çıkarılmış programı çalıştırır.
-  ile silinmiş bir arm64 yapılandırmasının başlaması fonksiyonunu kurtar`LC_FUNCTION_STARTS`, prolog taramaları ve çağrı hedefleri, her yöntemi kesilmemiş ikiz simge masasına karşı puanlayın ve işlevlerin FLIRT şeklinde imzası ile isimlendirilmesini sağlayın.

## Sorun

İlişkiniz var .`main.c``libledger.dylib`Ve bir ajanın nasıl çalıştığını sordu.`main`Telefonlar`0x1000005a0`Ajan talimatları söküp okudu .`bl 0x100000694`Adres 12 byte içeriyor:`adrp x16`- Evet .`ldr x16, [x16, #0x38]`- Evet .`br x16`Ajan yükü takip etti .`0x100004038`, sekiz bayt okuyun .`00 00 00 00 00 00 10 80`, ve bir yolsuz işaretçi aracılığıyla çekirdek alanına bir arama rapor etti.

Sonra aynı programın statik yapısını çıkarıp kaç fonksiyon olduğunu sordun.`nm`, bir isim gördü,`__mh_execute_header`Ve bir tanesini cevapladı.

Her iki cevap da dosyayı çalıştırma süreci gibi okuyor.`0x100004038`Bit 63 bind diyor, 12 bit sonraki fixup nerede olduğunu söyler ve düşük bitler hangi ithal bağlamak için söyler.`_puts`Daha önce`main`Çıkarılmış dosya simge tablosunu kaybetti ve saklandı.`LC_FUNCTION_STARTS`, tüm beş işlevi 9 byte ile başlıyor.

Bu ders, standart kütüphane Python'da beş okuma makinesi oluşturur. Kendi nesnelerimiz için bir COFF okuyucu ve ithalat, ihracat ve temel yer değiştirme dizinleri için bir PE32+ okuyucu. Yükleme komutları, çubuklar, dolaylı sembol tablosu, zincirlenmiş düzeltme zinciri ve ihracat denetimi için bir Mach-O okuyucu, sözcük sözcük karşılığı kontrol edildi `dyld_info`. Dinamik bölüm, PLT ve GOT için ELF okuyucu, ayrıca nesnelerimizin PIE bağlantısının ne yaratacağını söyleyen bir planlayıcı. Dört yöntemle ve her biri için skor ile bir boşaltılmış yapı için bir fonksiyon arayışı.

Bu makineye sadece Mach-O bağlantıları var. arm64 çalıştırılabilirleri ve dylib bağlantılı, çıkarılmış ve çalıştırılmış. ELF ve COFF nesneleri burada `clang -target`, ve hiçbir ELF veya PE bağlantı editörü kurulmamıştır, bu nedenle bu biçimlerde iki bağlantılı görüntü, sabitlik klasöründeki iki Python senaryo tarafından özelliklerden bayt-bayt yazılmıştır. `llvm-objdump`Kitaplık araştırması da okuyor, çalıştırılmamışlar ve önemli olan yerde metin de öyle diyor.

```figure
re-40-call-through-three-formats
```

## Bağlantı Düzenleyicisi Yer değiştirme ile Ne Yapıyor

Ders 32 yer değiştirme kayıtlarını okudu ve ders 33 uygulandı `S + A - P`A'ya kadar`lea`Bir kayıt bir yerin adını verir .`P`, bir tip, bir sembol`S`, ve bir ekleme`A`. x86-64 psABI Tablosu 4.9 tip başına bir formül verir.`L`Simgolu PLT girişinin yeri için, `G`Allah'ın karşılığını verdiği için.`GOT`GOT adresine göre ve`B`Üç sonuç nesnelerimizi kapsar.

Bağlantı editörü değeri alanına yazar ve kayıt kaybolur. `R_X86_64_PC32`Bu durum, girişlerde tanımlanan bir simge karşısında geçerlidir.

Bağlantı editörü PLT girişini ve GOT yuvasını yapar. `R_X86_64_PLT32`Bu durumda, belirlenmeyen bir fonksiyona karşı.`L + A - P`A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A. A.`R_X86_64_JUMP_SLOT`Kayıt `.rela.plt`Dinamik bağlantılayıcıya boşluğu doldurmasını söyler.

Bağlantı editörü yükleyici için bir yer değiştirme tutar. `R_X86_64_64`8 baytlık mutlak adresdir ve konum bağımsız bir çalıştırılabilir, yüklenene kadar adresini bilmiyor.`R_X86_64_RELATIVE`Şekil ile `B + A`İçeride`.rela.dyn`- Evet .

`main-x86_64-O1.o`18 kayıtlı: 14'e`.text`, 2 in `.data.rel.ro`, ve 2'de .`.rodata`- Evet .`plan_dynamic_link()`İçeride`code/main.py`Bu üç kuralın uygulanması için,`ledger-x86_64-O1.o`- ...

| Record | Count | Decision | Why |
|---|---|---|---|
| `R_X86_64_PC32` to `.rodata`, `.L.str`, `fns`, the table in `.rodata` | 16 | in place | the symbol is defined in the inputs |
| `R_X86_64_PLT32` to `percent_change`, `grade`, `total`, `grade_label` | 4 | direct, no PLT | defined in `ledger-x86_64-O1.o`, so the link editor reduces PLT32 to PC32 |
| `R_X86_64_PLT32` to `puts` twice and `printf` twice | 4 | PLT entry and GOT slot | undefined, provided by a shared library |
| `R_X86_64_64` to `grade` in `fns[]` | 2 | `R_X86_64_RELATIVE` | an absolute field in a PIE |

İki ithalat bir `.plt`48 byte (PLT0 artı 16'dan iki giriş)`.got.plt`40 bytelik (üç rezerve slot artı iki) ve bir `.rela.plt`İki nispet kayıt bir `.rela.dyn`Bu rakamlar kayıtlarımızdaki özelliklerden geliyor.`tiny-dyn-x86_64`Bu planın PLT kısmını aynı iki ithalat için uyguluyor ve boyutları planla eşleşmektedir.

Yükleyici yazıyor `PLT32`Her çağrıda, tanımlanmış veya tanımlanmamış, binutils 2.31 (H.J. Lu, 2018-02-13) ve LLVM 7.0.0 (D43383, 2018-02-20) ile.`PLT32`Bu nedenle bir nesne içinde "bir çağrı" yazıyor ve PLT girişinin olup olmayacağı hakkında hiçbir şey söylemiyor. Diğer yapılarda iki tür daha görünür. `R_X86_64_GOTPCRELX`ve `R_X86_64_REX_GOTPCRELX`(`G + GOT + A - P`) PLT olmadan GOT boşluğu istemek için,`-fno-plt`Üretir ve bağlantı editörü doğrudan bir`lea`veya `call`Simbol yerel olduğunda (psABI Eklem B). `R_X86_64_32`ve `R_X86_64_32S`Bir PIE'de bir adres tutamaz ve bağlantı bozulur.

## Dinamik Bölüm, PLT ve GOT

GABI 5. bölümünde, dinamik bağlantılarda yer alan bir yürütülebilir şeyin bir `PT_INTERP`Program başlığı, herhangi bir yüklenebilir segmentin öncesinde olmalıdır ve bir `PT_DYNAMIC`, ki `.dynamic`Bölüm bir dizi `Elf64_Dyn`çiftler, imzalanan bir etiket ve bir değer,  ile sona erer`DT_NULL`- Evet .

`tiny-dyn-x86_64`5.184 byte tarafından yazılmıştır.`build_tiny_dyn_elf.py`Dinamik bölümünde 12 çift var.`0x1000`- ...

| Tag | Number | Value | Meaning |
|---|---|---|---|
| `DT_NEEDED` | 1 | `libc.so.6` | a string table offset, `0xb`, the library to load |
| `DT_HASH` | 4 | `0x1a0` | the SysV hash table |
| `DT_STRTAB` | 5 | `0x188` | `.dynstr` |
| `DT_SYMTAB` | 6 | `0x140` | `.dynsym`, 24 bytes per entry |
| `DT_STRSZ` | 10 | `0x15` | 21 bytes of strings |
| `DT_SYMENT` | 11 | `0x18` | 24 |
| `DT_PLTGOT` | 3 | `0x10c0` | `.got.plt` |
| `DT_PLTRELSZ` | 2 | `0x30` | two 24-byte records |
| `DT_PLTREL` | 20 | 7 | the records are `DT_RELA` |
| `DT_JMPREL` | 23 | `0x1b8` | `.rela.plt` |
| `DT_FLAGS_1` | `0x6ffffffb` | `0x08000000` | `DF_1_PIE`, a GNU tag |
| `DT_NULL` | 0 | 0 | end |

GABI nedenini söylüyor .`DT_JMPREL`Bu işlemlerin birleştirilmesi için, bu işlemlerin birleştirilmesi için kullanılan bir bağlantı sistemi kullanılır.`DF_BIND_NOW`İçeride`DT_FLAGS`- Evet .`DF_1_NOW`İçeride`DT_FLAGS_1`veya`LD_BIND_NOW`Bu nedenle, bu ortamda tembel bağlamalar kapanır ve dinamik bağlantılayıcı onları başlatırken işleme yapar.

### PLT0 ve yerleştirme için giriş

psABI bölüm 5.2 Şekilde iki şekli verir.

```text
     1f0: ff 35 d2 0e 00 00    pushq  0xed2(%rip)      # 0x10c8 = GOT+8
     1f6: ff 25 d4 0e 00 00    jmpq   *0xed4(%rip)     # 0x10d0 = GOT+16
     1fc: 0f 1f 40 00          nopl   (%rax)

     200: ff 25 d2 0e 00 00    jmpq   *0xed2(%rip)     # 0x10d8 = GOT+24, the slot for puts
     206: 68 00 00 00 00       pushq  $0x0             # index 0 into DT_JMPREL
     20b: e9 e0 ff ff ff       jmp    0x1f0            # PLT0
```

Bir kez hesap yapın. RIP-sözü görevi, bir sonraki talimatla görelidir. `0x1f6 + 0xed2 = 0x10c8`, yani `.got.plt + 8`- Evet .`0x1fc + 0xed4 = 0x10d0`, yani `.got.plt + 16`- Evet .`0x206 + 0xed2 = 0x10d8`, dördüncü yuva.`0x210 - 0x20 = 0x1f0`Her giriş 16 byte, yani giriş için `exit`Başlıyor .`0x210`, itirir .`$0x1`ve okuyor .`0x10e0`- Evet .

Hükümet üç boşluk rezervasyonu yapar. psABI 5.2: sıfır giriş, `_DYNAMIC`, ve "global ofset tablosundaki bir ve iki giriş de rezerve edilmiştir".`.got.plt`okur `0x1000, 0, 0, 0x206, 0x216`Glibc 1. bölümü dolduruyor .`struct link_map`Ve ikilik bölümü `_dl_runtime_resolve`Dosyayı yüklerken.`0x206`Dosyada, yani `pushq`İçeride .`puts@plt`. psABI: "İlk olarak ... aşağıdaki pushq talimatının adresini içerir".

İlk çağrı devam ediyor .`call 0x200`- Evet .`jmpq *0x10d8`Ülkeler`pushq $0`- Evet .`jmp 0x1f0`GOT+8'i itirir ve GOT+16'u çözücüye atlar.`DT_JMPREL`- Evet .`R_X86_64_JUMP_SLOT puts`- Göründü .`puts`İçeri .`libc.so.6`Adresini yazıyor .`0x10d8`İkinci çağrı geçer.`call`- Evet .`jmpq *0x10d8`Drepper, "İlk çağrı hariç, tüm için genel maliyet, dolayısıyla 'tek' bir dolaylı sıçrama" olduğunu yazıyor.`%r11`Bu, "PLT'deki kodun herhangi bir kayıt dökülmesine gerek yok" diye bir kayda seçimi ders 38'de açıklıyor.

Arama sitesi `.text`okur `e8 d4 ff ff ff`- ...`0x227`ve`0x22c - 0x2c = 0x200`- Evet .`llvm-objdump`Parmak izi`callq 0x200 <puts@plt>`Bu sayede, `.rela.plt`Kayıt, nasıl oluyor da?`plt_entries()`Adını da ver.

### Dosyada bulunmayanlar

Dosyada yok .`PT_GNU_RELRO`. Jakub Jelinek, 2004-01-06 tarihinde RELRO'yu ikili araçlar listesine dahil etmeyi önerdi: Sadece yer değiştirme sırasında yazılan bölümleri yazılabilir segmentin başlangıcına taşı, böylece dinamik bağlantı `mprotect`GNU'nun varsayılan metni,`.init_array`- Evet .`.fini_array`- Evet .`.data.rel.ro`- Evet .`.dynamic`ve`.got`İçeride ve sadece üç rezerve slotunu saklıyor.`.got.plt`İçeride 24 byte, çünkü diğer yuvalar tembel yazılmıştır.`-z now`takımlar `DF_BIND_NOW`Ve bütünü hareket ettirir.`.got.plt`İçeride, tam RELRO, çünkü başlangıçtan sonra hiçbir şey yazılmıyor.`_dl_protect_relro`Çağrılar`mprotect(start, end - start, PROT_READ)`Sayfalara uygun aralığında. `-fno-plt`Yükleyici tarafında bir adım daha ileri gider: aramalar devam eder `jmpq *name@GOTPCREL(%rip)`, tembel bağlanmak imkansızdır ve GCC'nin el kitabı "tüm dış semboller yükleme sırasında çözülür" diyor.

Dosyada da versiyon bölümleri yok.`libc.so.6`ekliyor `.gnu.version`Bir .`Elfxx_Half`-`.dynsym`giriş ve`.gnu.version_r`, a `Verneed``Vernaux`Her versiyon adı için kayıtlar. `printf@GLIBC_2.2.5`Yöntem: `printf`İçeride`.gnu.version`bir indeksi taşıyor, `Vernaux`Kimin ?`vna_other`               `vna_name`"GLIBC_2.2.5", altındaki `Verneed`Kimin ?`vn_file`0 yerel, 1 küresel ve bit 15 (`VERSYM_HIDDEN`- Evet .`0x8000`) bir versiyonu bağlantı editöründen saklar.

Hash tablosu bir SysV `DT_HASH`Bir kova ve üç giriş zinciri ile 24 byte.`DT_HASH`veya `DT_GNU_HASH`Bu dosya hiçbir şey ihraç etmez ve burada çalıştırılmamıştır, bu yüzden glibc'in tek kovalı bir tablo kabul etmesi doğrulanmamıştır.

### .dynsym, .symtab ve strip

GABI yaptırır.`.dynsym`ve `.dynstr`ayrılmış bölümler ve `.symtab`ve `.strtab`Drepper: "Normal sembol tablosu çalıştırma sırasında kullanılmıyor ve bu nedenle ikili bir parçayı çıkarmak gerekmez. Performans üzerinde hiçbir etkisi yoktur".

GNU `strip --strip-all`çıkarır `.symtab`- Evet .`.strtab`- Evet .`.debug_*`ve`.comment`Her bölümü:`.interp`- Evet .`.dynsym`- Evet .`.dynstr`- Evet .`.gnu.hash`- Evet .`.gnu.version*`- Evet .`.rela.dyn`- Evet .`.rela.plt`- Evet .`.plt`- Evet .`.text`- Evet .`.rodata`- Evet .`.eh_frame`- Evet .`.init_array`- Evet .`.dynamic`- Evet .`.got`- Evet .`.got.plt`- Evet .`.data`- Evet .`.bss`Bölüm başlıkları eklenmedikçe kalır.`--strip-section-headers`(Binutils 2.41) veya run `llvm-strip --strip-sections`- Evet .`--strip-debug`Simgolleri saklar.`--only-keep-debug`Bu dosyayı yazar `--add-gnu-debuglink`Çıkarılmış olanın isimleri, içinde bir CRC32 var.`.gnu_debuglink`ve`ld --build-id`Yazar `.note.gnu.build-id`Bu yüzden bir defektör ikisini eşleştirebilir.

## COFF nesnesi

`clang -target x86_64-pc-windows-msvc -O1 -fno-asynchronous-unwind-tables -c`üretilen `main-x86_64.obj`ve `ledger-x86_64.obj`PE Format sayfası nesneyi tanımlar: 20 byet dosya başlığı, seçeneği olmayan başlık, 40 byet girişlerden oluşan bölüm tablo, 18 byet kayıtlardan oluşan sembolik tablo ve her bölüm için 10 byet yer değiştirme kayıtları.

`CoffObject`İçeride`code/main.py`Dosya başlığı, "makine" diyor.`0x8664`, 10 bölüm, 37 sembol kayıtları,`SizeOfOptionalHeader`Bölüm tablolarının isimleri `.text`- Evet .`.data`- Evet .`.bss`, altı bölümden `.rdata`ve`/16`- Bir isim ki , `/`kendi dört bayt boyutundan başlayan bir dizimallı sıfırlama.`/16`karar verir `.llvm_addrsig`, bu da adı `llvm-objdump -h`Parmak izleri.

37 kayıt, yardımcı kayıtları içerir. Bir bölüm sembolü (depolama sınıfı 3) bölüm uzunluğunu, yer değiştirme sayısını, bir kontrol toplamını ve COMDAT seçimini taşıyan bir simge taşır.`.rdata`Bölümler 2 seçeneğine sahiptir, "herhangi" ve her biri MSVC-değişik bir isim altında bir satır harfi tutar: `??_C@_04JDDJEAHN@even?$AA@`İletişim editörü her birinin bir kopyasını tutar.`.file`"main.c" yardımcı kaydı ile. `llvm-objdump -t`Bunları yazdırır:`[ 0]`- Evet .`AUX scnlen ...`- Evet .`[ 2]`, ve benzeri, yardımcı indeksleri atlamak ve test indeks ve isim çiftlerini bu metinle karşılaştırır.

Yer değiştirmeler: 14 `IMAGE_REL_AMD64_REL32`İçeride`.text`Ve 4 `IMAGE_REL_AMD64_ADDR64`İçeride`.rdata`- Evet .`REL32`"Yüklenmeden sonraki 32 bitlik görevi adres".`R_X86_64_PC32`- ... ...`-4`İçeri girilmiş: ELF kayıtları ekleme taşıyor `-4`Çünkü kayıtta bir ek alan var ve COFF kayıtta hiç bir alan yok. `ledger-x86_64.obj`Üç tane var.`REL32`- ...`0x36`- Evet .`0x84`ve`0x93`, ve ders 32'si `ledger-x86_64-O1.o`Üç tane var.`R_X86_64_PC32`Aynı kod aynı ve formatlar sadece dört yazılı olarak farklıdır.`ADDR64`8 bayt mutlak adresidir.`labels`Bir çizgi göstericisi tablosu ve görüntüde bir temel yerleşim haline gelir.`R_X86_64_64``R_X86_64_RELATIVE`- Evet .

| | ELF `Elf64_Rela` | COFF relocation | Mach-O `relocation_info` |
|---|---|---|---|
| record size | 24 bytes | 10 bytes | 8 bytes |
| fields | offset, type and symbol in `r_info`, addend | offset, symbol index, type | address, then a 32-bit word with symbolnum:24, pcrel:1, length:2, extern:1, type:4 |
| addend | explicit | none, lives in the field | none, or an `ARM64_RELOC_ADDEND` record before the real one |
| the call to `puts` | `R_X86_64_PLT32 puts-0x4` | `IMAGE_REL_AMD64_REL32 puts` | `ARM64_RELOC_BRANCH26 _puts` |

## PE Görünümü: İhracat, İhracat ve Üssü Değişiklikler

`tiny-x86_64.exe`2.560 byte tarafından yazılmıştır.`build_tiny_pe.py`Küçük ELF ' in işi aynı .`puts`ve `exit`-`msvcrt.dll`Aynı zamanda bir isim ihraç eder ve bir üssü taşıyor, bu yüzden bu ders için gereken üç dizin hepsi mevcuttur. `pefile`2024.8.26 ve `llvm-objdump -p`Her ikisi de okudu ve her iki yakalama da birer cihaz.

Başlıkları yürüyün. MS-DOS'un başlığı`MZ`ve karşılaştırma`0x3c`Tutulur .`e_lfanew`- Evet .`0x40`- Ne ?`0x40`İmzalama`PE\0\0`Sonra COFF dosya başlığı: makine`0x8664`, 4 bölüm, `SizeOfOptionalHeader`240, özellikleri `0x22`Seçeneği seçeneği başlığı  ile başlar.`Magic`alanı,`0x20b`, yani PE32+.`AddressOfEntryPoint`- Evet .`0x1000`- Evet .`ImageBase`- Evet .`0x140000000`- Evet .`SectionAlignment` `0x1000`- Evet .`FileAlignment` `0x200`- Evet .`SizeOfImage` `0x5000`- Evet .`Subsystem`3 (konsole).`DllCharacteristics` `0x8160``HIGH_ENTROPY_VA 0x0020`- Evet .`DYNAMIC_BASE 0x0040`- Evet .`NX_COMPAT 0x0100`ve`TERMINAL_SERVER_AWARE 0x8000`Ardından 16 RVA ve boyut verileri dizinleri.`0x2080`boyut`0x4d`, Import at `0x2000`boyut`0x28`, Üssü Değiştirme`0x4000`boyut`0xc`, IAT'da`0x2040`boyut`0x18`- Evet .

Bir görüntüdeki adresler yük tabanından sıyrılan RVAs'dır. Bölüm tabloları onları dosya sıyrılarına haritası yapar: `.text`RVA `0x1000`Dosyada`0x200`- Evet .`.rdata`RVA `0x2000`- ...`0x400`- Evet .`.data`RVA `0x3000`- ...`0x600`- Evet .`.reloc`RVA `0x4000`- ...`0x800`- Evet .`PeImage.rva_to_offset()`O masada.

### İçe aktarım dizinleri

RVA ' da .`0x2000`20 baytlı bir import tanımlayıcı dizisi bulunur ve 0 tanımlayıcı ile sona erer.`0x2028`, zaman damgası 0, nakliyeci zinciri 0, isim `0x2068`, İçe aktarım adres tablosu `0x2040`. RVA adı "msvcrt.dll"e işaret eder. Arama tablosunda sıfırla biten 64 bit girişler bulunur. Bit 63 seti, sıradan olarak, sıradan olarak 15 ila 0 bit arasında içeriyor. Bit 63 açık olarak 30 ila 0 bitler anlamına gelir.`0x2058`(söyleme 0, "sıkıştırır") ve `0x2060`(sunuç 0, "çıkış").

Spec'de IAT'in "resim bağlanana kadar ithalat arama tablosunun içeriğiyle aynı" olduğu belirtiliyor.`0x2040`Aynı iki RVA'yı içerir ve test 24 bytesin `0x2028`           `0x2040`. "Bindirme sırasında, ithalat adres tablosundaki girişler ithal edilen sembollerin 32-bit (PE32) veya 64-bit (PE32+) adresleriyle üst yazılır". Windows yükleyici giriş noktası çalışmadan önce bunu yapar.

```text
    100b: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1011 + 0x102f = 0x2040, the IAT slot of puts
    1013: ff 15 2f 10 00 00    call qword ptr [rip + 0x102f]   # 0x1019 + 0x102f = 0x2048, the IAT slot of exit
```

`FF /2`İki talimat aynı baytlara sahiptir çünkü her biri diğerinden sekiz bayt sonra oturur ve bir boşluğu diğerinden sekiz bayt sonra okuyor. `iat_calls()` için kod bölümünü tarar`ff 15`, 6 ve yer değiştirme eklenir ve ithalat dizininden boşluğu isimlendirir.

### İhracat Dizini

RVA ' da .`0x2080`40 baytlı ihracat dizin tablosu: bayraklar, zaman damgası, sürüm, "tiny-x86_64.exe" işaret eden bir RVA adı, sıradan taban 1, 1 adres tablosu giriş, 1 isim işaretçisi.`0x20a8`1 RVA'yı tutar.`0x1000`. Dışarıya Çekilme Adı İzleme Tablosu`0x20ac`"Tiny_entry" dizinine bir RVA tutar.`0x20b0`16 bitlik tarafsız bir indeks, 0. Adı `k`Giriş adresleri için haritalar `ordinals[k]`, ve ihraç edilen ordinal `ordinals[k] + ordinal base`Spec. specification kullanmadığımız bir kural ekler: bir adres girişini ihracat bölümünün içine işaret ederek `MYDLL.expfunc`, ve isim işaretleme tablosu "biner aramaları izin vermek için leksik olarak düzenlenmiştir".

### Üssü yer değiştirme

`.reloc`Her blok bir sayfa RVA ve bir blok boyutu ile başlar, sonra üst dört bitte türlü 16 bit giriş ve alt on iki sayfa karşılaştırılmış.`0x3000`, boyut 12, giriş `0xa000`, 10 tip.`IMAGE_REL_BASED_DIR64`, 0'nun sıfırlanması ve 0'nun doldurma girişleri.`IMAGE_REL_BASED_ABSOLUTE`RVA ' daki sekiz bayt .`0x3000`Durun .`0x1400020d0`, resim tabanı artı "Elle bağlantılı" dizinin RVA. Eğer yükleyici görüntüyi başka bir yere yerleştirirse, bu alanın farkını ekler. Spec: "Şekil dosyaları COFF yer değiştirmelerini içermez ... Bir görüntü .reloc bölümünde temel yer değiştirmeler biçiminde yer değiştirme bilgileri içerir (şekil IMAGE_FILE_RELOCS_STRIPPED özelliğine sahip değilse)." `/DYNAMICBASE`mevcut link.exe'de varsayılan olarak etkinleştirilmiştir, bu yüzden görüntüler taşıyor `.reloc`ve `DYNAMIC_BASE`- Evet .

PE görüntüsünde çizilen sembol tablosu yoktur.`PointerToSymbolTable`"Bir görüntü için sıfır olmalıdır çünkü COFF debugging bilgileri eski haline gelmiştir" ve isimler ayrı bir PDB'de yaşanır.`.pdata`, kimin `RUNTIME_FUNCTION`Girişler, yığınları tahsis eden veya başka bir fonksiyonu çağıran her fonksiyonun başlangıcının ve sonunun adını verir.

## Mach-O Görünümü: Yük Komutları, Stubs ve Doğrudan Doğrudan Simgolu Tablosu

`ledger_main`bağlantılı arm64 çalıştırılabilir.`otool -h`19 yük komut ve bayrak yazdırıyor `0x00200085`- Evet .`MH_NOUNDEFS 0x1`- Evet .`MH_DYLDLINK 0x4`- Evet .`MH_TWOLEVEL 0x80`ve`MH_PIE 0x200000`19 komut dörttür.`LC_SEGMENT_64`(`__PAGEZERO`- Evet .`__TEXT`- Evet .`__DATA_CONST`- Evet .`__LINKEDIT`), iki `LC_LOAD_DYLIB`(`@rpath/libledger.dylib`O zaman ...`/usr/lib/libSystem.B.dylib`), ve her biri `LC_DYLD_CHAINED_FIXUPS`- Evet .`LC_DYLD_EXPORTS_TRIE`- Evet .`LC_SYMTAB`- Evet .`LC_DYSYMTAB`- Evet .`LC_LOAD_DYLINKER`- Evet .`LC_UUID`- Evet .`LC_BUILD_VERSION`- Evet .`LC_SOURCE_VERSION`- Evet .`LC_MAIN`- Evet .`LC_RPATH`- Evet .`LC_FUNCTION_STARTS`- Evet .`LC_DATA_IN_CODE`ve`LC_CODE_SIGNATURE`- Evet .`MachoFile.command_names()`aynı listeyi aynı sırada gönderir .`otool -l`- Evet .

`__TEXT`Başlıyor .`0x100000000`- Evet .`__text`256 byte .`0x100000558`- Evet .`main`Ve başka bir şey yok, çünkü dört büyüklük fonksiyonu DYLIB'de yaşar.`__stubs`84 byte `0x100000658`, 12 byetlik yedi parça.`__DATA_CONST`Başlıyor .`0x100004000`- Evet .`__got`, 64 byte, seksiyon tipi sekiz işaretleme yuvası `S_NON_LAZY_SYMBOL_POINTERS`ve`__const`, 32 byte, `fns[]`ve `names[]`tabloları`main.c`- Evet .

### Bir çubuk, el ile

- Bu da bir şey .`_puts`- Evet .`0x100000694`- ...

```text
    30 00 00 90    adrp x16, 0x100004000
    10 1e 40 f9    ldr  x16, [x16, #0x38]
    00 02 1f d6    br   x16
```

`0x90000030`- Evet .`adrp`Kayıt, en düşük beş bit, 16.`immlo`30 ila 29 bit, 0.`immhi`23 bit 5'e kadar.`immhi << 2 | immlo = 4`, 4.096 byte sayfalarında, hedef sayfa talimat sayfasıdır,`0x100000000`, artı `0x4000`- Evet .`0xf9401e10`- Evet .`ldr`İmzalamamış 12 bitlik bir ofset ile 8 ile ölçeklenmiş: 21 bitten 10'a 7 çarpı 8'e `0x38`, yükün de görevi `0x100004038`- Evet .`0xd61f0200`- Evet .`br x16`ID64'in kaynağının Arm64'i bu üç yönlendirmeyle oluşturdu.`StubAtom`- Evet .

Bu boşluğa ait olan isim indirekt sembol masasından gelir. `LC_DYSYMTAB`Bir parça bölümünde, `reserved1`indekslerinin başlangıcı ve`reserved2`Her bir çubuk ne kadar büyük (12), bir işaretleme bölümü kullanır `reserved1`Ve her yuva için sekiz byte.`__stubs`0 ve `__got`İndeks 7'de, 5 haritayı simge tablosunun 10 girişine atın. `_puts`, ve 7 numaralı bölüm .`__got`Aynı giriş için haritalar. `otool -Iv`İkisi de basıyor ve `indirect_table()`Her satırı yeniden üretir.

### İki seviye isim alanı

`nm -m`Parmak izi`(undefined) external _puts (from libSystem)`ve `(undefined) external _grade (from libledger)`Kütüphane, simgelerin kayıtlarından geliyor.`nlist.h`tanımlar `GET_LIBRARY_ORDINAL(n_desc)`15 ila 8 bit olarak `n_desc`, 1 ilk için `LC_LOAD_DYLIB`, 2 ikinci için,`0xfe`Dinamik arama için, `0xff`Yaptırılabilir için.`ld(1)`: " -two_levelnamespace (devletim) ile, bağlantıcı sadece semboller için komut satırındaki dylib'leri ve hangi dylib'lerde bulunduğunu kaydeder. " `nm_lines()`12 albümün göstergesi`n_type`- Evet .`n_sect`- Evet .`n_desc`ve`n_value`, ve test çıkış hattını hatla yakaladığı hattı karşılaştırır `nm -m`- İlişkiniz .`-Wl,-flat_namespace`Ve oku .`otool -h`- Görmek için .`MH_TWOLEVEL`Biraz kaybol.

## Zincirlenmiş Çözümler, Bayt Bayt

`LC_DYLD_CHAINED_FIXUPS`- bir`linkedit_data_command`- Evet .`dataoff 0x8000`- Evet .`datasize 208`208 bayt daha sonra.`fixup-chains.h`- Evet .

Başlık yedi 32-bit alanı: `fixups_version 0`- Evet .`starts_offset 32`- Evet .`imports_offset 80`- Evet .`symbols_offset 112`- Evet .`imports_count 8`- Evet .`imports_format 1`(`DYLD_CHAINED_IMPORT`), `symbols_format 0`(Sıfırlanmamış) `llvm-objdump --macho --chained-fixups`Bu yedi değeryi yazdırırır ve test onları karşılaştırır.

32'de.`dyld_chained_starts_in_image`- Evet .`seg_count 4`Ve dört taksit, her segment için bir, tamirsiz segmentler için sıfır.`__DATA_CONST`- Bir tane var.`dyld_chained_starts_in_segment`okur `size 24`- Evet .`page_size 0x4000`- Evet .`pointer_format 6`(`DYLD_CHAINED_PTR_64_OFFSET`, "hedef vm offset"),`segment_offset 0x4000`- Evet .`max_valid_pointer 0`- Evet .`page_count 1`Ve bir tane .`page_start`0'dan.`DYLD_CHAINED_PTR_START_NONE`- Evet .`0xffff`, yanlışlıkları olmayan bir sayfa anlamına gelir.

Zincir dosya sıfırlaması ile başlar `0x4000 + 0`Her 64 bit kelime iki şeyi taşıyor: Orada ne yazmalı ve sonraki kelime nerede.

```text
  dyld_chained_ptr_64_bind    ordinal:24  addend:8  reserved:19  next:12  bind:1 = 1
  dyld_chained_ptr_64_rebase  target:36   high8:8   reserved:7   next:12  bind:1 = 0
```

İlk kelimeyi oku.`0x8010000000000000`Bit 63 ayarlandı, bir bağ.`next`62-51 bit.`0x002`Bu da bir sonraki düzeltme için 8 byte.`0x4058`- Evet .`0x00000000000006db`63 bit açık, bir rebase.`next`- 0, zincirin sonu.`0x6db`, vm ofset ve resim tabanı `0x100000000`- Evet .`0x1000006db`, "odd" dizinin içinde.`__cstring`- Sözcük öncesinde,`0x00100000000006d6`, geriye dönme `names[0]`"Evet" demek.

Yürüyüş 12 kelimeyi ziyaret eder: 8 kelimeyi bağlar `__got`0 ila 7 arası sırayla, iki bağlama `__const`0'luk sırayla (hem 'nin iki girişinde de)`fns[]``_grade`), ve iki basınç `names[]`- Evet .`chained_fixups()`Dosyaların sıfırlamaları ve çiğ kelimeleri ile geri gönderir ve test on ikiyi karşılaştırır `(offset, raw)` ile çiftler`dyld_info -fixup_chain_details`, ki basıyor .`raw: 0x8010000000000000 bind: (next: 002, bindOrdinal: 0x000000)`İlk kez.

Ofset 80 ' deki ithalat tablosunda sekiz 32- bit giriş bulunmaktadır: `lib_ordinal:8`- Evet .`weak_import:1`- Evet .`name_offset:23`, isimleri 112 'de sıfırlanır. 0 ila 3 arasında bir sırada `_grade`- Evet .`_grade_label`- Evet .`_percent_change`- Evet .`_total`Kitap 1 ve 4 ile 7 arasında `___stack_chk_fail`- Evet .`___stack_chk_guard`- Evet .`_printf`- Evet .`_puts`Kütüphane 2.`fixup_rows()`iki tabloyu çizgilerle birleştirir `dyld_info -fixups` gibi parmak izi`__DATA_CONST __got 0x100004038 bind libSystem/_puts`, ve test on ikisini de karşılaştırır.

Yani "korrupt işaretçi"`0x100004038`Dyld bu zinciri yüklenmiş bir kez yürür ve adresini yazar.`_puts`- Çukuruna. Apple'ın WWDC22 oturumunda şöyle ifade edildi: "DATA'daki 64 bit işaretçi konumunda, bazı bitler bir sonraki düzeltme konumuna karşılaştırmayı içerir. Ayrıca paketlenen bir bit, düzeltmenin bağlanması veya yeniden temellenmesi olup olmadığını söylüyor. " Xcode 13 bu biçimi macOS 12 veya iOS 15'in dağıtım hedefi için öntanımlı hale getirdi ve Xcode 13.3 onu macOS 11 ve iOS 13.4'e uzattı. Bu formatta tembel bağlama yoktur. Her yuva önceden bağlanmış .`main`Çıkıyor.

### Yerine aldığı düzen

`ledger_main_nochain`Aynı bağlantıdır.`-Wl,-no_fixup_chains`- Evet .`LC_DYLD_INFO_ONLY`Bunun yerine, dört bayt kodlu tablo ile: 8 bayt yeniden temel, 72, tembel bind 120, ihracat 64. Ayrıca zincirlenmiş dosyanın eksik olduğu üç bölüm vardır: `__TEXT,__stub_helper`(108 byte), bir `__got`Sadece 16 bytelik bir depolama `___stack_chk_guard`ve `dyld_stub_binder`ve`__DATA,__la_symbol_ptr`(56 byte, yedi slot).`dyld_info -fixups`7 liste `lazy-bind`Her tembel boşluk kendi trampolinin içine yönlendiriyor .`__stub_helper`Trampolin bir işaretlemeyi itti ve atladı.`dyld_stub_binder`, adı çözüp boşluğu yazar. Bu önceki bölümün PLT ve GOT'sidir.`__la_symbol_ptr`- Evet .`.got.plt`- Evet .`__stub_helper`PLT0 ve `pushq $index`ve`dyld_stub_binder`- Evet .`_dl_runtime_resolve`- Evet .`code/main.py`Bu dosyanın sıfırlama ve bölümlerini bildirir ve bind opkodlarını çözmez; pratik laboratuvar bunu ister.

### Dışarıya aktarım

`LC_DYLD_EXPORTS_TRIE`her düğüm bir uleb128 terminal boyutudur, o zaman sıfır dışı ise, uleb128 bayrakları ve uleb128 ofset, sonra bir byte çocuk sayısı ve her çocuk için bir string kenarı ve uleb128 düğüm ofset. `exports_trie()`Yürü.`libledger.dylib`Geri dönüyor.`_percent_change 0x410`- Evet .`_grade 0x428`- Evet .`_total 0x464`- Evet .`_grade_label 0x498`, dört taksit .`dyld_info -exports`İpucu üzerinde geri döner.`__mh_execute_header`- Evet .`_fns`ve`_main`- Evet .

## Ne çizgi bırakır

Apple's `strip(1)`Dinamik olarak bağlantılı bir yürütülebilir üzerinde seçenekleri olmadan  gibi davranır diyor`-u -r`: tanımlanmamış sembolleri ve dinamik olarak referans edilen sembolleri saklayın. `-x`Yerel sembolleri kaldırır. `-N`"Dinamik paylaşım kütüphaneleri için, en fazla çıkartma seviyesi genellikle -x'dir", çünkü "Dinamik bağlantı süreci yalnızca küresel semboller kullanır".

- Çekilen aletlerimizde görüldü.`strip ledger_main`Aldı .`LC_SYMTAB`12 ' den 10 ' a kadar kayıtlar ve kaldırıldı `_main`- Evet .`_fns`ve`_names`. Sekiz tanımlanmamış ithalat kalır çünkü Dild'in isimlerinin bağlanması gerekiyor.`__mh_execute_header`Kalır çünkü öyle.`REFERENCED_DYNAMICALLY`10. kayıt bir tip bir bıçak .`N_OPT`Adı:`radr://5614542`, Apple'ın araçları yazıyor böylece masa asla boş değildir;`nm`Çıkarılmış program orijinal ile aynı üç satır basıyor ve 0'dan çıkıyor.`LC_FUNCTION_STARTS`Hâlâ bir başlangıç var.`main`- Evet .

`strip libledger.dylib`Hiçbir seçenek olmadan, insan sayfasının alışkanlıklarından daha ileri gitti.`-x`- Evet .`LC_SYMTAB`0 kayıtları var ve `nm`Dışarı çıkarma trie'de yine de aynı sıfırlamalarda dört işlevi listeler, çünkü dyld trie üzerinden bağlanır ve asla geçmez.`LC_SYMTAB`- Evet .`LC_FUNCTION_STARTS`C laboratuvarı yeni bir bağlantı kurdu.`main.c`Bu, bağlantı editörünün de trie tarafından servis edildiğini göstermek için çıkarılmış DYLIB'e karşı.

| What | ELF after `--strip-all` | PE image | Mach-O after `strip` |
|---|---|---|---|
| static symbol table | gone | never present in an image | local and defined names gone, undefined imports stay |
| names the loader binds | `.dynsym` and `.dynstr` stay | import directory stays | imports stay in `LC_SYMTAB` and in the chained imports table |
| exported names | `.dynsym` stays | export directory stays | exports trie stays |
| function starts | `.eh_frame` FDEs, unless built without unwind tables | `.pdata` for non-leaf functions | `LC_FUNCTION_STARTS` stays |
| debug information | `.debug_*` gone | in the PDB, never in the image | in the dSYM, never in the image |
| section or load command headers | stay unless `--strip-section-headers` | stay | stay |

## Simvolsuz İşlevler Bulmak

`static-arm64-O2`bağlantılar`main-arm64-O2.o`ve `ledger-arm64-O2.o`5 işlevi olan bir çalıştırılabilir `__text`- Evet .`nm -n`Çekilmemiş dosyanın temel gerçeği:`_main`- ...`0x100000500`(244 bayt), `_percent_change`- ...`0x1000005f4`(24), `_grade`- ...`0x10000060c`60), `_total`- ...`0x100000648`(248), `_grade_label`- ...`0x100000740`(72). `static-arm64-O2.stripped`- Hayır .`N_SECT`İçeride simge`__text`- Evet .`FunctionFinder`Bu konuda dört yöntem kullanıyor.`score()`Her listeyi gerçekle karşılaştırır.

### LC_FUNCTION_STARTS

Komut noktaları dokuz bayt .`__LINKEDIT`- Evet .`80 0a f4 01 18 3c f8 01 00`. Formatı uleb128 deltas, ilk `__TEXT`Adres.`80 0a`- Evet .`0x500`İlk başlangıç .`0x100000500`- Evet .`f4 01`- Evet .`0xf4`- Evet .`0x1000005f4`- Evet .`18`ver .`0x10000060c`- Evet .`3c`ver .`0x100000648`- Evet .`f8 01`ver .`0x100000740`ve`00`5'den 5'e yanlış pozitif yok.`-O0`ve `-O2`Bağlantı editörü bu tabloyu Windsor ve Crash Reporter için yazıyor.`strip`Ghidra, "Mach-O Fonksiyon Başlıyor" analizöründe okuyor.`dyld_info -function_starts`Yazdırır, LIEF ise onu `function_starts`- Evet .

### Başlık taramaları

Ghidra'nın AARCH64 başlangıç kalıpları `fd 7b bf a9`, yani `stp x29, x30, [sp, #-0x10]!`Dosyalarımızda her iki seviyede de 0'dan 5'e ulaşır.`sub sp, sp, #N`Önce ve sonra .`stp x29, x30, [sp, #M]`Bu yüzden pre-index form hiç ortaya çıkmaz.`sub sp, sp, #imm`- Evet .`(word & 0xff0003ff) == 0xd10003ff`, 5'ten 5'e ulaştı.`-O0`, her fonksiyonun bir çerçevesinin olduğu ve 5'in 1'si`-O2`, nerede `percent_change`- Evet .`grade`- Evet .`total`ve`grade_label`- Yaprak fonksiyonları, çerçevesiz.`percent_change` ile başlar.`cbz w0, ...`Bir öncü tarama, kompiliratörün yayınlamayı seçtiğini bildirir ve ders 38 bunun ne kadar sıklıkta hiçbir şey olmadığını gösterir.

Bu görüntüleme yanlışı göstermedi çünkü program küçük. x86-64 gibi bir baytlı kalıplar.`55``push rbp`Diğer talimatların içine girdi, bu yüzden Ghidra'nın x86-64 model dosyaları post-pattern gibi bir çiftleştirdi.`55 48 89 e5` gibi bir ön örneği ile`ret`veya `nop`Bu, önceki işlevi sona erdirmek zorunda.

### Arama hedefleri

Her zaman .`bl`İçeride`__text`bir fonksiyon başlatma adı verir, çünkü bir `bl`C için bir kompiliörün göndermediği bir şey bir fonksiyonun ortasına girer. Kodlama `0x94000000`26 bitlik bir sözcük taksitle.`bl`- ...`0x1000005a0`okur `3d 00 00 94`- Evet .`0x3d`61'dir, 4 çarpı `0xf4`, yani hedef `0x100000694`- İçeride .`ledger_main`Bu da bir şey.`_puts`- Statik yapıtaşta.`call_targets()`İçeride hedefleri toplar.`__text`, içeriye düşenleri düşürür .`__stubs`, ve  ekler .`LC_MAIN`Giriş, çünkü hiçbir şey çağırmıyor.`main`Nucleus (Andriesse, Slowinska, Bos, 2017) işlevi algılamalarını, kompiliör tarafından oluşturulan kod için bu fikir üzerine inşa eder ve Andriesse ve diğerleri 2016'da işlev sınırlarının, talimat sınırlarından daha zor bir parça olduğunu ölçtüler.

## FLIRT şeklinde İmza

Hex-Rays, FLIRT'i belgelendirdiğinde tanımlar: bir desen "her türlü baytın işaretlendiği bir fonksiyonun ilk 32 baytıdır", varyan baytları sabitlemelerden ve dış referanslardan gelir, desenler bir ağaçta yaşar ve örneğin ötesinde " 33 pozisyonundan başlayarak ilk varyan baytına kadar olan baytların CRC16'sını hesaplarız" ve bu uzunluğu saklarız. Aynı kalıplı ve CRC'li iki işlevi, birbirinden farklı oldukları bir konumda bir kuyruğu byte ile ayırır, sonra da referans ettikleri isimlerle ayırır. Hiçbir şeyin ayırmadığı bir çarpışma "doğal zekanın yoluyla çözülür". Dış referansları olmayan dört bayttan daha kısa fonksiyonlar dışlanmıştır ve " imza dosyası fonksiyonların isimlerini hariç, orijinal kütüphanelerden hiçbir bayt içermez".

`signatures_from_object()`Bu da bir şey.`ledger-arm64-O2.o`ve `main-arm64-O2.o`, FLAIR'in kütüphane nesneleriyle inşa ettiği gibi.`relocation_info`Kayıt bir dört baytlı kelimeyi kapsar ve bu baytlar değişik olur.`.pat`Rizin'in analiz cihazında belgelenen çizgi düzeni, örneği, CRC uzunluğu, CRC16 uzunluğu, fonksiyon uzunluğu, `:0000`ve adı, ve `^offset name`Her referanslı isim için:

```text
A00000342800004B890C8052087D091B000DC01AC0035FD6 00 0000 0018 :0000 _percent_change
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 003C :0000 _grade ^0000 l_switch.table.grade ^0001 l_switch.table.grade
E8CC8C52C8CCAC72087C289B09FD7FD308FD62930801090B081900511F110071 04 9AAF 0048 :0000 _grade_label ^0000 l_switch.table.grade_label ^0001 l_switch.table.grade_label ^0002 _labels ^0003 _labels
```

`_percent_change`Bu da 24 byte, yani örneği tüm fonksiyon ve CRC uzunluğu 0'dur.`_grade`Bu yüzden CRC'nin kapsamı dört byte. CRC16 kamu tarafından açıklanan bir sistemdir.`.pat`Parser kullanımı: polinom `0x8408`, başlangıç değeri `0xffff`Bu değer, ASCII dizin için "123456789" değeridir.`0x6e90`, ve test çubukları da.

`match_signatures()`Çıkarılmış yapıdaki her fonksiyon başlangıcında her imzanı dener, önce desen, sonra CRC.`-O0`Tüm beş fonksiyon da isimlerini alır ve hiçbir şey çarpmaz.`-O2`Yukarıdaki iki çizgi çarpışıyor.`grade_label`Yukarıdaki çizgi`grade`Bu nedenle, iki fonksiyon ilk 36 baytlarını ve dört CRC baytını paylaşıyor.`0x10000060c`ve `0x100000740`Kuyruk onları bölüyor: 44 byte .`_grade`- Evet .`20`ve `_grade_label`- Evet .`28`, yani `ldr w0, [x9, w8, uxtw #2]``ldr x8, [x9, w8, uxtw #3]`Raporda çarpışmalar ve onları belirleyen bayt kayıtları yer alır.

Test .`test_object_bytes_equal_linked_bytes_outside_relocated_words`İlişkili çalıştırılabilirde aynı sıfırlamalarda her nesne fonksiyonunun değişmeyen her baytı byte'ye eşittir, bu nedenle bağlantı düzenleyicisi sadece yer değiştirilen kelimeleri değiştirdi. `_total`Yer değiştirme ve hiç bir varians baytı yok.

### Aynı fikirle aletlerin ne yapması

IDA Pro 9.4 işlemci başına FLIRT imzaları gönderir ve `sigmake`Bu araçlar, IDA Free'nin sadece x86 ve x86-64'leri kapsamlı ve ticari olmayan kullanım için kullanılmasıdır. Lumina, fonksiyonun md5'i ile fonksiyon metadatalarını anahtarlayan ve 32 byte altında fonksiyonları atlayan bir sunucu. Ghidra 12.1.4 (Apache-2.0) işlevi kimliği vardır: "Linking nedeniyle değişikliklere karşı sağlam" olan mnemonik ve adresleme modları üzerinde tam bir hash ve ana ve çocuk fonksiyonları bağlayıcı olarak eşleşen talimatlara göre puanlanan sabit operandlar ekleyen belirli bir hash; gönderilen veri tabanları yalnızca Visual Studio kütüphanelerini kapsar ve kendi ikililerinden kendilerini dolduruyorsunuz. Binary Ninja 6.0 Krypton (ticari, ücretsiz bir sürümle) WARP (Apache-2.0) kullanır: işlevi GUID temel blok GUID'ler üzerinde UUIDv5 bir, her biri "tüm yer değiştirilebilir talimatlar" sıfırlamak ve NOPs bırakmak sonra blok bytes üzerinde UUIDv5 bir kısıtlama olarak çağrı, çağıran ve bitişik fonksiyonlar ile. BinDiff 8 (Apache-2.0) iki ikili arasında sabit bir adım sırası olan işlevleri eşleştiriyor. Hash eşleştirici, akış grafik MD indeksleri ile sıra eşleştirici çağrıya kadar ve eşleştirici kenarlardan, bloklardan, talimatlardan ve akış grafik MD indeksinden benzerliği ağırlaştırıyor. Diaphora 3.4.3 (AGPL-3.0, sadece IDA) küçük birincil sayı ürünü ekler, burada her mnemonik bir ilk ve bir fonksiyon ile ürün, bir siparişsiz multiset parmak izi oluşturur. Radar2.6.2.4 (LGPL-3.0) imzalanmış (`zg`- Evet .`z/`- Evet .`zb`) ve FLIRT olarak okur.`.sig`Dosyaları`zfs`Risin 0.9.1 (LGPL-3.0) oluşturur.`.pat`veya `.sig`Açık bir ikiliden `Fc`ve bir ile uygulanır `Fs`- Evet .

IDA ve Binary Ninja kapalı ve burada belgelerinden açıklanmıştır. radar2 ve rizin bu makineye yüklenmemiş ve komutları kitaplarından ve kaynaklarından alıntılanmıştır.`clang`- Evet .`ld`- Evet .`llvm-objdump`- Evet .`otool`- Evet .`nm`- Evet .`strip`ve`dyld_info`Bu test, kontrol cihazı tarafından kontrol edilen ve kontrol cihazı tarafından kontrol edilen tüm formatları okudu.`ledger_main`, aynı 12 düzeltme . Kırmızı aletler sadece ELF dosyalarını okuyor .`main-x86_64.obj`- Evet .`PEFormatError: 'DOS Header magic not found.'`Ve küçük görüntüyü okuyun.

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu beş parçalı. `elf`iki nesnenin yer değiştirme sayısını, bağlantı planını ve dinamik bölümünü, PLT ve GOT'yi tutuyor `tiny-dyn-x86_64`- Evet .`coff`İki nesnenin bölümlerini, yer değiştirmelerini, fonksiyonlarını ve belirlenmemiş isimlerini taşıyor. `pe`Başlıkları, dizinleri, ithalatı, ihracatı, temel yer değiştirmeleri ve IAT çağrılarını tutar.`tiny-x86_64.exe`- Evet .`macho`Tutulur .`ledger_main`Çatışmalar, zincirlenmiş düzeltmeler, düzeltme sıraları ve ihracatları ile, `ledger_main_nochain`, Dylib ve iki strip raporları.`identification`Dört yöntemin gerçek olduğunu ve sonuçları ve çatışmaları ile imzaları.`-O0`ve `-O2`- Evet .

Beklenen şekil:

```json
{
  "elf": {"linkPlan": {"pltSymbols": ["puts", "printf"], "sizes": {".plt": 48, ".got.plt": 40, ".rela.plt": 48, ".rela.dyn": 48}, "...": "..."}, "tiny-dyn-x86_64": {"...": "..."}},
  "coff": {"main-x86_64.obj": {"...": "..."}},
  "pe": {"imports": [{"dll": "msvcrt.dll", "iat": "0x2040", "...": "..."}], "...": "..."},
  "macho": {"ledger_main": {"flags": "0x200085", "fixupRows": ["__DATA_CONST __got 0x100004000 bind libledger/_grade", "..."], "...": "..."}, "strip": {"...": "..."}},
  "identification": {"O2": {"methods": {"functionStarts": {"recall": "5/5"}, "prologueSub": {"recall": "1/5"}, "...": "..."}, "correctNames": 5}}
}
```

Oku `code/main.py`Bu sırada:

1. `ElfFile`başlıkları, bölümleri, hem sembol tabloları hem de yer değiştirmeleri okuyor ve `dynamic_entries()`- Evet .`jump_slots()`- Evet .`plt_entries()`ve`plt0()`Bağlanmış resmi oku.
2. `plan_dynamic_link()`Tabela 4.9 ve 5.2 bölümünde yer değiştirilebilir nesnelerin yer değiştirme kayıtlarına uygulanır.
3. `CoffObject`dosya başlığı, bölüm tablosu, 18 byet simgeler ve yardımcı kayıtları ve 10 byet yer değiştirmelerini okuyor.
4. `PeImage`MS-DOS'un başlığı, PE imzası, seçmeli başlık, veri dizinleri, bölümler ve ithalat, ihracat ve temel yer değiştirme dizinleri okur.`iat_calls()`Çözümler`ff 15`- Evet .
5. `MachoFile`yük komutlarını, bölümleri okuyor.`nlist`Kayıtlar, dolaylı semboller tablosu, çubuklar, zincirlenmiş düzeltmeler, ihracat deneyimi ve nesne yer değiştirmeleri.
6. `FunctionFinder`Dört başlangıç arayanı çalıştırır ve `score()`Her birini gerçekle karşılaştırır.
7. `signatures_from_object()`ve `match_signatures()`FLIRT şeklinde imzalar oluşturup uygulayacak.
8. - Evet .`parse_*`Bu işlemler, testlerin karşılaştırdığı alınacak metinleri okuyor.

Daha fazla komut: `python3 code/main.py elf FILE`- Evet .`coff FILE`- Evet .`pe FILE`ve`macho FILE`Bir rapor yazdır.`python3 code/main.py plan OBJECT...`ELF nesneleri için bağlantı planını basar. `python3 code/main.py functions STRIPPED UNSTRIPPED OBJECT...`Kendi yapımlarınızdan başka bir çiftin imzalarını ve arayanları notlar.

## Kullan

Bu sırada okuyucuları oluşturduğunuz bir programda kullanın.

1. Başlıkları okuyun ve formatı ve türünü belirleyin: yer değiştirilebilir nesne, yürütülebilir veya paylaşılabilir kütüphanede.
2. İhracatları sağlayıcılarıyla birlikte listeleyin: `DT_NEEDED`ve `.dynsym`, ithalat dizinleri veya zincirlenmiş ithalat tabloları ve `LC_LOAD_DYLIB`Bu listedeki bir ad için yapılan her çağrı, resmini bırakır.
3. Bir çağrıyı elden bir yere kadar takip edin. Çağrı bytesini, stub veya PLT bytesini, slot adresini, dosyadaki kelimeyi ve yükleyici'nin orada yazdıklarını yazın. Dosyadaki kelime çöp gibi görünüyorsa, çöp olarak adlandırmadan önce onu bir düzeltme olarak çözün.
4. Simgeler tablosunu ihracat ile karşılaştırın ve işlev başlar.`strip`Sadece bir defektörün adları gerekmiyor.
5. Bir çıkarılmış yapıtaşmada, bulayıcıları çalıştırın ve hala bir tane bulduğunuzda, çıkarılmamış ikizle karşı puan alabilirsiniz.`LC_FUNCTION_STARTS`- Evet .`.pdata`veya`.eh_frame`, bayt kalıpları üzerinde, ve boşlukları doldurmak için arama hedefleri kullanın.
6. Kendi nesnelerinizden imzalar oluşturun ve uygulayın. Her çarpışma ve bölüştüren baytı kaydetin. İki imza iddia ettiği bir isim, kuyruğun veya referanslı bir adın karar verene kadar bilinmez.

Alınan araç metnini dosyalarla birlikte tutun. Araç zinciri değiştiğinde, yeniden alın, çünkü değiştirilen bir liste değişen bir konudur.

## İnteraktif Laboratuvar

### Laboratuvar A: Elden yapılan PLT

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code
python3 -q
```

Çık:

```python
from main import *
elf = load_elf("tiny-dyn-x86_64")
[(e.tag_name, e.text) for e in elf.dynamic_entries()]
elf.plt0()
[(e.symbol, hex(e.address), hex(e.slot), hex(e.slot_initial)) for e in elf.plt_entries()]
[hex(w) for w in elf.got_plt_words()]
```

Her çağrıdan önce, yukarıdaki metinde bulunan baytlardan cevap hesaplayın.`IMPORTS`İçeride`build_tiny_dyn_elf.py`Üç isimle yeniden inşa etmek ve yeni boyutları tahmin etmek için.`.plt`- Evet .`.got.plt`ve`.rela.plt`Onları okumadan önce.

### Laboratuvar B: Bir zincirlenmiş düzeltme

```python
exe = load_macho("ledger_main")
stub = next(s for s in exe.stubs() if s.symbol == "_puts")
stub.lines()
raw = int.from_bytes(exe.read(stub.slot, 8), "little")
hex(raw), raw >> 63, (raw >> 51) & 0xfff, raw & 0xffffff
[(i.index, i.name, i.library) for i in exe.chained_fixups()["imports"]]
```

Önce kağıt üzerinde bind kelimesini çöz: bind bit, `next`4 byte birimlerinde birim alanı, sıradan. 8 byte daha fazla kelimeyi okuyun ve bir sonraki düzeltme olduğunu doğrulayın.`0x100004058`Ve neden olduğunu açıkla.`next`- Zıfrı.

### Laboratuvar C: Çıkart ve yeniden bağlan

Ayakkabı dizisinde, yeni bir programı tamamen soyulmuş olan dilib ile bağlayın:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/code/fixtures
clang -target arm64-apple-macos -O1 main.c -L. -lledger.stripped -Wl,-rpath,@executable_path -o /tmp/relinked
nm /tmp/relinked | grep ' U '
dyld_info -exports libledger.stripped.dylib
```

Bağlantı başarılı bir kütüphanede başarılıyor.`LC_SYMTAB`link editörü ihracatı testini okuyor.`python3 ../main.py macho libledger.stripped.dylib`ve karşılaştır `symtab`- Evet .`exports`ve`functionStarts`Sonra statik yapıtan çıkarın .`-N`Bunun yerine ne olduğunu gör .`dyld_info -function_starts`Hala izler.

### Laboratuvar D: çarpışma

```python
from main import *
stripped = load_macho("static-arm64-O2.stripped")
sigs = signatures_from_object(load_macho("ledger-arm64-O2.o"))
[s.pat_line() for s in sigs]
starts = FunctionFinder(stripped).function_starts()
match_signatures(sigs, stripped, starts)
```

İki çarpışma kaydını okuyun ve imzaları oluşturun.`ledger-arm64-O0.o`, karşı karşıya .`static-arm64-O0.stripped`, ve açıklayın `.pat`                    `-O0`- Sonra kısalt .`PATTERN_LENGTH`16'ya kadar ve kaç fonksiyon çarpıştığını sayın.

## Pratik Laboratuvar

Eski bağlama tablolarını çöz ve PE arayıcısını ekle.

Gereksinimler:

- Kısayolları çöz`LC_DYLD_INFO_ONLY`Basınç, bağlama ve tembel bağlama opkod akışları `ledger_main_nochain`Bölüm, bölüm, adres, tip ve hedef ile sıralara ayırın ve yakaladığınızdaki 21 satırla eşitleştirin `dyld_info -fixups`Mesaj.
- Bir ekle`PT_GNU_RELRO`Program başlığı ve bir `DT_FLAGS`- Evet .`DF_BIND_NOW`- ...`build_tiny_dyn_elf.py`- Hareket et .`.got.plt`kapalı aralığın içinde ve yapın `llvm-objdump -p`README'de tam RELRO'nun hangi bölümünü ve hangi bölümünü sadece glibc yapabileceğini söyleyin.
- Bir yazın .`.pdata`PE32+ görüntü için okuma makinesi ve kullanan fonksiyon arayan bir `RUNTIME_FUNCTION`Adresler başlatın.`clang -target x86_64-pc-windows-msvc -c`- Hayır .`-fno-asynchronous-unwind-tables`, okuyun .`.pdata`Tabelada bulunmayan yaprak fonksiyonlarından hangisini belirtir.
- Her okuyucu için kaydedilen araç metniyle karşılaştırmak için bir test yazın.

Başarılı olmak demektir .`python3 code/main.py macho ledger_main_nochain`Aynı 21 düzeltme satırını basıyor `dyld_info`Parmak izleri, küçük ELF bir `PT_GNU_RELRO`Bu ...`llvm-objdump`listeler ve `.pdata`Arayan, yapabileceği işlevlerin adını verir ve yapamayacağı yaprak işlevlerini listeler.

## Ders Artifakti

Bu ders de içerir .`outputs/skill-linking-loading-and-stripped-binaries.md`Bu programı, yükleme cihazının doldurduğu boşluğa kadar izlenen bir çağrı, yükleme cihazının neyi doldurduğunu belirten bir listeye dönüştürmek için kullanın.`strip`Bu, çıkarılmamış ikizleri temel gerçek olarak, her iddia için bir yakalama araç listesi ve her çarpışma kaydı gerektirir.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

Verifikasyon, şunu kanıtlamalıdır:

-  Dinamik bölüm`tiny-dyn-x86_64`Düzleşmeler`llvm-objdump -p`Etiket için etiket ve `DT_FLAGS_1`taşıyor`DF_1_PIE`
- İki kişi.`R_X86_64_JUMP_SLOT`Kayıtlar eşleşir .`llvm-objdump -R`ve isim`puts`ve `exit`
- PLT0 GOT+8'i itti ve GOT+16'dan atladı, her giriş kendi yuvasını okudu ve indeksini itti ve her yuva kendi adresini taşıdı `pushq`
- Küçük ELF maçının bölümleri ve program başlıkları `llvm-objdump -h -p`
- İki ELF nesnesinin yer değiştirme kayıtları eşleşmektedir `llvm-objdump -r`
- Bağlantı planı iki PLT sembolü, dört doğrudan arama, iki nispet yer değiştirme ve küçük resmin boyutlarını bulur
- COFF bölümü tablosu, 37 sembol kayıtları ve yardımcı kayıtlar ve yer değiştirme eşleşimi `llvm-objdump -h -t -r`ve`/16`karar verir `.llvm_addrsig`
- Üç COFF `REL32`Kayıtlar`ledger`Üç ELF ' de oturun .`PC32`Tasarım
- PE başlıkları, `DllCharacteristics`, ve veri dizinleri eşleşir `llvm-objdump -p`
- İhracat dizin, ipucu/ isim yazıları ve IAT eşleşmesi `llvm-objdump`ve `pefile`, ve IAT , bağlanmadan önce arama tablosuna eşittir .
- Dışarı çıkış listesini ve `DIR64`Bası yer değiştirme dekodunu, yer değiştirilen işaretçi "Elle bağlanmış" dizinini adlandırır.
- `ff 15`RVA'da`0x100b`IAT boşluğuna gider `puts`
- Mach-O bayrakları, 19 yük komut adı ve iki kütüphanenin eşleşmesi.`otool`
- Yedi çubuk sekiz'e dekode ediliyor.`__got`Yakalaşma ve indirek sembol masası eşleşmeleri `otool -Iv`
- Zincirlenmiş başlıklar eşleşir .`llvm-objdump --macho --chained-fixups`
- zincir yürüyüşü , tüm on iki çiğ kelimesini yeniden üretir .`dyld_info -fixup_chain_details`
- Düzeltme sıraları ve ithalat tabloları eşleşmektedir `dyld_info -fixups`ve `-imports`
- Dışarı çıkışlar eşleşir `dyld_info -exports`Dillibe ve onun kopyasına.
- `nm_lines()`eşit `nm -m`Yürütülebilir ve kopyasını çıkarmış olan
- `strip`Çıkarıldı .`_main`- Evet .`_fns`ve`_names`9 isim ve 1 isim sakladı .`radr://5614542`bıçak, ve çıkarılmış program aynı çıkış yazdırır
- Eski düzenin `LC_DYLD_INFO_ONLY`, yedi tembel işaretçi ve basamaklar `__stub_helper`
- arm64 nesne yer değiştirme eşleşimi `llvm-objdump -r`
- `LC_FUNCTION_STARTS`her iki seviyede de beşten beşini geri kazanır ve eşit olur `nm`ve `dyld_info -function_starts`
- `sub sp`Tarama 5'den 5'i buldu.`-O0`Ve beşten biri .`-O2`, ve `stp`Çerçeve taraması hiç bir şey bulamadı
- `bl`hedefler artı `LC_MAIN`Giriş geri kazanma beş beş
- İmzalar her iki seviyede de beş işlevi belirler ve `grade`çarpışma 44 byte ile bölünmüş
- "123456789" CRC16'ı `0x6e90`, ve GOT yüklü çiftinin altındaki sekiz bayt .`main`varyasyonları
- Her değişken olmayan nesne baytı bağlantılı bayt ile eşittir
- Demo ve rakam verileri aynı adresleri rapor eder ve sitesi modülü aynı verileri ES5'e gömür.

## Üretim Başarısızlık Modları

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| A `bl` or `call` lands in a stub | "calls an unnamed function at 0x694" | the stub bytes, the slot it loads, and the import the slot binds |
| A GOT word read from the file | "corrupt pointer 0x8010000000000007" | bit 63 is bind, `next` is 2, ordinal 7 is `_puts` from library 2 |
| `PLT32` in an object | "every call goes through the PLT" | defined symbols are reduced to a direct distance, only undefined ones get an entry |
| Partial RELRO read as full | "GOT is read-only" | `.got.plt` slots after the three reserved ones sit outside `PT_GNU_RELRO` without `-z now` |
| COFF `REL32` compared with ELF `PC32` | "the Windows build has different relocations" | same offsets, the `-4` lives in the ELF addend and in the COFF field |
| IAT read before load | "imports point at strings" | the IAT equals the lookup table until the loader binds, and the strings are hint/name entries |
| A stripped dylib | "no symbols, nothing exported" | the exports trie and `LC_FUNCTION_STARTS` list every function |
| `nm` on a stripped executable | "one function" | `LC_FUNCTION_STARTS` lists five starts, nine bytes long |
| A prologue scan at `-O2` | "one function" | four leaf functions have no frame, call targets and the starts table find them |
| Two functions share 36 bytes | "grade_label is grade" | the tail byte at 44 and the lengths 60 and 72 split the collision |
| A tool run on another machine's build | the numbers in this text | recapture every listing from your own fixtures |

## İşlem Kuralı

Arama sitesinden yükleme cihazının doldurduğu boşluğa her dış çağrıyı takip edin ve bir adres olarak adlandırmadan önce, bu boşluğun formatı tanımladığı şekilde kelimenin kodunu çözün. Kargaçanın hala ihtiyacı olanları kaydettikten sonra çıkar. İndirme işlemi, baytları taramanızdan önce bağlantı editörünün yazdığı tablolardan başlar, her arayanı simgelerle ikizle karşılaştırır ve her imza çarpışmasını bölünen bayt ile kaydeder.

## Daha Fazla Okumak

- [System V gABI, chapter 5: Program Loading and Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement: section 5.2 and Table 4.9](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Drepper, "How To Write Shared Libraries", version 4.1.2](https://akkadia.org/drepper/dsohowto.pdf)
- [Drepper, "ELF Symbol Versioning"](https://akkadia.org/drepper/symbol-versioning)
- [Jelinek, "Little hardening DSOs/executables against exploits", binutils list, 2004-01-06](https://www.sourceware.org/ml/binutils/2004-01/msg00070.html)
- [Taylor, "Linker relro", 2008](https://www.airs.com/blog/archives/189)
- [binutils commit bd7ab16b: PLT32 for calls, 2018-02-13](https://gnu.googlesource.com/binutils-gdb/+/bd7ab16b4537788ad53521c45469a1bdae84ad4a)ve [LLVM D43383](https://reviews.llvm.org/D43383)
- [GNU Binutils: strip](https://sourceware.org/binutils/docs/binutils/strip.html)ve [llvm-objcopy](https://llvm.org/docs/CommandGuide/llvm-objcopy.html)
- [Microsoft, PE Format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [CALL instruction reference, FF /2](https://www.felixcloutier.com/x86/call)
- [Apple, mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)ve [mach-o/nlist.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)
- [Apple dyld, mach-o/fixup-chains.h](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/fixup-chains.h)
- [Apple ld64, stub_arm64.hpp](https://github.com/apple-oss-distributions/ld64/blob/main/src/ld/passes/stubs/stub_arm64.hpp)
- [Xcode 13 release notes: chained fixups](https://developer.apple.com/documentation/xcode-release-notes/xcode-13-release-notes)ve [WWDC22 session 110362, "Link fast: Improve build and launch times"](https://developer.apple.com/videos/play/wwdc2022/110362/)
- [strip(1)](https://keith.github.io/xcode-man-pages/strip.1.html)- Evet .[ld(1)](https://keith.github.io/xcode-man-pages/ld.1.html)ve[dyld(1)](https://keith.github.io/xcode-man-pages/dyld.1.html)
- [Hex-Rays, IDA F.L.I.R.T. Technology: In-Depth](https://docs.hex-rays.com/core/flirt/concepts/ida-f.l.i.r.t.-technology-in-depth)ve [Lumina overview](https://docs.hex-rays.com/add-ons/lumina/overview)
- [Ghidra Function ID help](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/FunctionID/src/main/help/help/topics/FunctionID/FunctionID.html)ve [AARCH64 function start patterns](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/patterns/AARCH64_LE_patterns.xml)
- [Vector 35, WARP](https://github.com/Vector35/warp)ve [Binary Ninja WARP guide](https://docs.binary.ninja/guide/warp.html)
- [BinDiff manual](https://www.zynamics.com/bindiff/manual/)ve [BinDiff source](https://github.com/google/bindiff)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [rizin pat.c, the .pat parser](https://github.com/rizinorg/rizin/blob/dev/librz/sign/pat.c)- Evet .[radare2 flirt.c](https://github.com/radareorg/radare2/blob/master/libr/anal/flirt.c)ve[radare2 book: Zignatures](https://book.rada.re/signatures/zignatures.html)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)ve [Andriesse, Slowinska, Bos, "Compiler-Agnostic Function Detection in Binaries" (EuroS&P 2017)](https://danielandriesse.com/papers/eurosp-2017.pdf)
- [Bao et al., ByteWeight (USENIX Security 2014)](https://www.usenix.org/conference/usenixsecurity14/technical-sessions/presentation/bao)ve [Shin, Song, Moazzezi, "Recognizing Functions in Binaries with Neural Networks" (USENIX Security 2015)](https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/shin)
- [LIEF changelog](https://lief.re/doc/latest/changelog.html)- Evet .[pyelftools](https://github.com/eliben/pyelftools)ve[pefile](https://github.com/erocarrera/pefile)
