# Program Anatomisi: Bir ELF Okuyucu sıfırdan

> Bir program, birbirine işaret eden bir dizi tablo. Yazdığınız bir okuyucu, bayt byte kontrol edebileceğiniz çıkış sağlar.

**Type:** Build
**Languages:** Python (stdlib), TypeScript, C (fixture only)
**Prerequisites:** Phase 0 · 01 (Dev Environment) with clang installed, Python 3.10 or later, hexadecimal arithmetic
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Bu pistteki her hedef için izin kuralı ve 17 U.S.C. 1201 f'nin dört sınırını belirtin.
- ELF başlığı, bölüm başlığı tablosunu ve her iki dizilenin de tablosunu  ile okuyun.`struct.unpack`- Evet .
- Çözümleme`.symtab`Notlar ve `.rela`gABI ve x86-64 psABI isimleri ile kayıtlar.
- Adlı bir fonksiyonun tam baytlarını geri gönderin ve her dosyayı sahip olduğu yapıya haritasınız.
- Program başlıklarını okuyun ve bir dosya için bir sanal adresi haritasını oluşturun.`PT_LOAD`- Evet .
- Mach-O nesnesinin yük komutlarını oku ve her birinin eşleşen ELF fikri adını ver.

## Başlamadan Önce: Yetki ve Kanun

32 ila 36 derslerindeki her hedef senin yazdığın ve oluşturduğun bir program.`code/fixtures/ledger.c`Bu yazılımın kaynağı, kompiliör komutası ve oluşturduğu nesne dosyaları sizin. Okumak için lisans yok, geçmek için koruma yok, ve kodunu açan üçüncü taraf yoktur.

Kural var çünkü yasa kopyalanmayı kopyalama olarak görüyor. *Sega Enterprises Ltd. V. Accolade, Inc.*, 977 F.2d 1510 (9th Cir. 1992), mahkeme, sökülürken yapılan ara kopyaların Telif Hakları Kanunu uyarınca kopya olduğunu kararlaştırdı. Daha sonra, "Mücutlık hakkı korunan bir bilgisayar programında yer alan fikirlere ve işlevsel unsurlara erişmenin tek yolu ve bu erişimi talep etmek için meşru bir neden olduğu yerlerde, muhakkak ki, muhakkak ki, muhakkak ki bu yasal bir konudur".

İkinci dava * Sony Computer Entertainment, Inc. v. Connectix Corp. *, 203 F.3d 596 (9th Cir. 2000). Connectix bir emülatör inşa ederken PlayStation BIOS kopyalandı ve mahkeme bu kopyaları adil kullanım olarak gördü.

İki kanun sınırları belirliyor. 17 U.S.C. 1201 ((f) "bir bilgisayar programının kopyasını kullanma hakkını yasal olarak elde eden" bir kişiye erişim kontrolünü "tek amaçla bağımsız olarak oluşturulan bir bilgisayar programının diğer programlarla birlikte etkileşime geçmesi için gerekli olan programın öğelerini tanımlamak ve analiz etmek için" elden geçirme hakkı verir. Dört sınırlı yığın: yasal bir kopya, birlikte çalışabilme amacı, zaten "sadece mevcut olmayan" öğeler ve başka türlü ihlal edilmeyen analizler. 1201 (f) bölümü, sadece kaçakçılık önleme kuralına istisna. Kopyalama sorusu adil bir şekilde kullanılır.

Avrupa Birliği'nde, 2009/24/EK Direktifi'nin 5*3) maddesinde çalışma kapsamaktadır. Kopyayı kullanma hakkı olan bir kişi "programın herhangi bir öğesinin temelinde bulunan fikirleri ve ilkeleri belirlemek için programın işleyişini gözlemleyebilir, inceleyebilir veya test edebilir".

Madde 6'da, "Bağımsız olarak oluşturulan bir bilgisayar programının birlikte çalışması için gerekli olan bilgileri elde etmek için gerekli olan" durumlarda, hak sahibi'nin izni olmadan kopyalanma izin verilir. Şartlar 1201 ((f) ile aynıdır. Bir lisans sahibi, eylemleri yapar, bilgi zaten kolayca kullanılamıyordu ve eylemler gerekli parçalar içinde kalır. Madde 6 ((2) sonucu herhangi bir başka amaç veya ifade açısından önemli ölçüde benzer bir program için kullanmayı yasaklar. Madde 8'de, 6. veya 5. (3) maddelere aykırı sözleşme şartları geçersiz kılındı.

| Source | What it allows | Conditions |
|---|---|---|
| 17 U.S.C. 1201(f) | Circumventing an access control to analyze a program | Lawful copy, interoperability purpose, information not readily available, no infringement |
| Directive 2009/24/EC Art. 5(3) | Observing, studying, and testing a running program | A right to use the copy, acts within normal loading and running |
| Directive 2009/24/EC Art. 6 | Decompilation | Licensee, interoperability purpose, information not readily available, confined to the needed parts |
| *Sega v. Accolade* | Disassembly as fair use | The only way to reach the ideas and functional elements, a legitimate reason |
| *Sony v. Connectix* | Intermediate copies during reverse engineering | A non-infringing final product |

Bu notlar, statülerden ve görüşlerden gelir ve yasal tavsiyeler değildir. Gelecekte bir hedef sizin değilse dosyayı açmadan önce yazılı bir yetki alın ve yetkiyi kanıtlarınızla birlikte tutun.

## Sorun

- Sen topladın .`ledger.c`Ve koştu .`llvm-objdump -t`- Çıktı listeler.`percent_change`değerinde`0000000000000000`büyüklüğü ile`0000000000000010`1.768 baytlı dosyanın hangi 16 baytı fonksiyonu var?`R_X86_64_PC32 .rodata+0x10`- Yapabilir miyim ?`0x36`Bu da bir diğer şey. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`0x10`Masa başlanda `0x14`- Ne ?

rea düzen sorularını cevaplar `inspect_binary_layout`, ve bu araç sadece Linux x64 ' te var ve 4.15.0 ' un arkasında pwntools var .`REA_PWNTOOLS_PYTHON`Bu Mac'te yok.`address_to_file_offset`Ghidra oturumuna ve orijinal dosya bytesinin tamamı kopyasına ihtiyaç duyar.`inspect_artifact`Bu, bir nesne dosyasının içindeki tabloları asla açmaz. Bu yüzden okuyucuyu kendiniz Python'un yaklaşık 950 satırı ile yazırsınız.`struct.unpack`Testler her tabloyu karşılaştırır.`llvm-objdump`Bir kez fotoğraflara yerleştirilmiş metin.

```figure
elf-byte-map
```

## Dosya, Masalara Göre Göre Görülen Tablolardır

Sistem V gABI, bölüm 4, Resim 4-1, bir dosyanın iki görünümünü çizer. Bağlantı görünümünde ELF başlığı, seçmeli bir program başlığı tablosu, bölümler ve gerekli bir bölüm başlığı tablosu bulunur. Çalışma görünümünde ELF başlığı, gerekli program başlığı tablosu, bölümler ve seçmeli bir bölüm başlığı tablosu bulunur. GABI, tüm okuyucuyu yönlendiren bir cümle ekler: "Yalnızca ELF başlığı dosyada sabit bir konuma sahiptir". Diğer tüm yapılar başka bir yapıda saklanan bir ofset tarafından bulunur.

GABI ayrıca skalar türlerini de düzeltir ve "ELF bit alanlarını kullanmaz" diyor. `Elf64_Addr`ve `Elf64_Off`8 byte.`Elf64_Half`2'dir.`Elf64_Word`4'dir ve `Elf64_Xword`8. x86-64 psABI, bölüm 4.1.1' ü talep eder.`ELFCLASS64`- Evet .`ELFDATA2LSB`- Evet .`e_machine` `EM_X86_64`(62) ve `e_flags`0. Sıkı genişliğe sahip küçük endian ortalama `struct.unpack`bir `<`Önceden her kayıt tek bir çağrıda okunuyor.

İlk 64 byte `ledger-x86_64-O1.o`- ...

```text
00000000: 7f45 4c46 0201 0100 0000 0000 0000 0000  .ELF............
00000010: 0100 3e00 0100 0000 0000 0000 0000 0000  ..>.............
00000020: 0000 0000 0000 0000 2804 0000 0000 0000  ........(.......
00000030: 0000 0000 4000 0000 0000 4000 0b00 0100  ....@.....@.....
```

Onları GABI "ELF Header" sayfasına karşı oku.`e_ident`16 byte .`7f 45 4c 46`(Sihir), sınıf 2 (64-bit), veri 1 (çocuk-endyan), sürüm 1, OS ABI 0 (Sistem V), ve dolgu.

O zaman ...`e_type` `0x0001`- Evet .`ET_REL`, yer değiştirilebilir bir nesne.`e_machine` `0x003e`62'dir.`EM_X86_64`- Evet .`e_entry`bir nesne giriş noktası olmadığı için sıfırdır. `e_phoff`bir nesne program başlıkları olmadığı için sıfırdır. `e_shoff`- Evet .`0x428`, bölüm başlık tablosunun dosya sıfırlaması. Son satır tutar `e_ehsize` `0x40`- Evet .`e_phentsize`0 , `e_phnum`0 , `e_shentsize` `0x40`- Evet .`e_shnum` `0x0b`(11 başlık) ve`e_shstrndx` `0x0001`- Evet .

Okuyucu bu satırı tek bir çağrıya dönüştürüyor:

```python
fields = struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
```

Format dizilisi, soldan sağa okunan gABI figürüdür: iki yarım kelime, bir kelime, üç 8 bayt değerleri, bir kelime ve altı yarım kelime. Okuyucu sihirli, sınıf veya bayt sırası farklı bir dosyayı reddeder ve reddeder.`e_shentsize`veya `e_phentsize`Yanlış genişlik, her sonraki geçişin yanlış olmasını sağlar, bu yüzden çek en üstte yer alır.

## Bölüm Başlıkları ve İki İpi Tablo

Her bölüm başlığı bir `Elf64_Shdr`64 byte (gABI Resim 4-8): `sh_name`- Evet .`sh_type`- Evet .`sh_flags`- Evet .`sh_addr`- Evet .`sh_offset`- Evet .`sh_size`- Evet .`sh_link`- Evet .`sh_info`- Evet .`sh_addralign`ve`sh_entsize`Format dizilisi `<IIQQQQIIQQ`- Evet .`sh_name`indeksinin bölüme bir karşılığıdır `e_shstrndx`Bu nesne, 0 byte ile biter.`e_shstrndx`1'dir ve clang bu bölgeyi adlandırıyor.`.strtab`, yani bir masa hem bölüm isimlerini hem de sembol isimlerini sunuyor.

Okuyucu -O1 nesnesinin 11 başlığını basıyor:

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

Endeks 0, rezerve edilen sıfır başlık. `.text`Dosya ofset'te 159 byte kod içerir `0x40`Başlıktan hemen sonra bayraklarla.`A`(hüye hafızasında yerleştirilmiştir) ve `X`(Yapılabilir). `.rodata`80 byte sadece okunur verileri içerir. `.rodata.str1.1`5 etiket ipini tutuyor `F\0D\0C\0B\0A\0`, 10 byte, bayraklarla `M`(kemiş) ve `S`- Evet.

`.comment`47 baytlı bir kompiliör damgasını taşıyor `\0Apple clang version 17.0.0 (clang-1700.6.3.2)\0`- Evet .`.llvm_addrsig`türü vardır .`0x6fff4c03`, işletim sistemi spesifik aralığında `SHT_LOOS`- ...`SHT_HIOS`GABİ'nin rezervleri ve LLVM'in `ELF.h`Bayrağı.`E`- Evet .`SHF_EXCLUDE`, yani bir bağlantılayıcı düşürüyor.

- Evet .`sh_link`ve `sh_info`sütunlar, tablolar arasındaki işaretlerdir. `.rela.text`- Evet .`sh_info`2 ve `sh_link`10: Bölüm 2' yi patch eder ve sembollerini bölüm 10' dan alır. `.symtab`- Evet .`sh_link`1, sembol isimleri için dizileri tablo ve `sh_info`9, ilk yerel olmayan sembolün indeksi. `sh_addr`Bu sayede, bir nesneyi tanımlayan bir nesne, her satırda sıfırdır.

İki gABI kuralı, okuyucuya dosyanın tam bir haritasını çizmesine izin verir. Bölümler "ait ve üst üste geçmez" ve bir dosya "aktiv olmayan alan içerebilir". Okuyucu her yapıyı ofset ile sıralar ve delikleri doldurur:

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

Üç boşluk toplam 10 byte ve her biri bir uyumdur. `.rodata`- Evet .`sh_addralign`8, yani `0xe0`- Hayır .`0xdf`- Evet .`.symtab`8 düzeni var, yani 7 byte kullanılmaz.`.comment`Bölüm başlık tablosunun kendisi 8.

Tip bölümleri `SHT_NOBITS`Bu nesneyi hiç bir şey bu tür değil.`.bss`Bağlı bir programda yapar ve güvenen bir okuyucu `sh_size`Dosyanın arkasında okur.

## Simgeler: Bağlama, Tip, Bölüm, Değer, Boyut

Bir `Elf64_Sym`24 byte (gABI Şekil 4-18): `st_name`- Evet .`st_info`- Evet .`st_other`- Evet .`st_shndx`- Evet .`st_value`- Evet .`st_size`, biçimlendirme`<IBBHQQ`- Evet .`st_info`İki alan içerir: yüksek dört bitte bağlama ve düşük dörtte tür.`STB_LOCAL`0 , `STB_GLOBAL`1 , `STB_WEAK`2 ve türleri`STT_NOTYPE`0 , `STT_OBJECT`1 , `STT_FUNC`2 , `STT_SECTION`3 , `STT_FILE`4. Düşük iki bit `st_other`Görülebilirliği korumak,`STV_DEFAULT`Burada 0'dur.

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

0 indeks, belirlenmemiş sembolden oluşan bir simgedir. `st_shndx`Simgeyi tanımlayan bölümün isimleri, üç değerle rezerve edilir: `SHN_UNDEF`0 , `SHN_ABS` `0xfff1`dosya adı için ve `SHN_COMMON` `0xfff2`Bölüm sembollerinin boş bir adı var, bu yüzden `llvm-objdump`GABI kuralının "STB_LOCAL bağlayan tüm sembollerin zayıf ve küresel sembollerden önce" olduğu ilk dokuz satır olarak gösterilmektedir.`.symtab`9 'da kaydedildi .`sh_info`Bu yüzden.

Yer değiştirilebilir bir nesneye .`st_value`simgelenin bölümünde bir sıfırlama, çünkü `sh_addr`Bu işlevin dosya sıfırdır.`sh_offset + st_value - sh_addr`, ve uzunluğu `st_size`- ...

```python
section = elf.sections[symbol.st_shndx]
file_offset = section.sh_offset + (symbol.st_value - section.sh_addr)
code = elf.data[file_offset : file_offset + symbol.st_size]
```

- Evet .`percent_change`- Evet .`0x40 + 0`, ve 16 bayt `85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`Boyutlar da başlangıç kadar önemli.`grade``.text`- Değerlendirme`0x3e`İki bayt .`66 90`Bu da bir `nop`Yükleyici eklendi böylece `total`Başlıyor .`0x40`Bu iki bayt hiçbir simgeye ait değil.`st_size`Bir söküntü için durma koşulları olarak, ve ders 36 yeniden inşaat karşılaştırmadan önce onları maske eder.

## Yer değiştirme: sıfır baytların anlamı

Bir `Elf64_Rela`24 byte (gABI Şekil 4-23): `r_offset`- Evet .`r_info`, ve imzalanmış bir`r_addend`, biçimlendirme`<QQq`- GABİ bölünüyor .`r_info`İki makro ile: `ELF64_R_SYM(i)`- Evet .`i >> 32`ve `ELF64_R_TYPE(i)`- Evet .`i & 0xffffffff`- Yer değiştirilebilir bir dosyada .`r_offset`tabloya ait olan bölümde bir sıfırlama `sh_info`Tip isimleri ve formülleri x86-64 psABI, Tablo 4.9'dan gelir.`S`simge değeridir, `A`Ekleme, `P`Dökülmekte olan yer ve `L`PLT girişini. `R_X86_64_64`- Evet .`S + A`- Evet .`R_X86_64_PC32`- Evet .`S + A - P`ve`R_X86_64_PLT32`- Evet .`L + A - P`- Evet .

-O1 nesnesinin sekiz kayıtları vardır:

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

İlkini ayır.`0x36`İçinde yatıyor .`grade`, ki genişliyor .`0x10`- ...`0x3e`- Eğitimleri`0x33`- Evet .`48 8d 0d 00 00 00 00`, a `lea`RIP'ye göre bir adresin 4 baytlı yer değiştirmesi `0x36`. İşlemci, yer değiştirmeyi bir sonraki talimatın adresine ekler.`0x3a`- Evet .

Yükleyici sonuçları `.rodata + 0x14`, burada 32 bit değerli beş giriş tablosu `1, 2, 3, 4, 4`Yani depolanmış değer`(.rodata + 0x14) - 0x3a`- Formula`S + A - P`- Evet .`P = 0x36`ver .`.rodata + A - 0x36`İki eşit verenin ayarlanması`A = 0x14 - 4 = 0x10`Ekleme, hedef ofset'i ekleyerek, talimatın yer değiştirilmesi ile sona ermesi arasındaki dört byteyi taşıyor.

Bu tablo , clang ' ın `switch`İçeride`grade`-O1'de.`score / 10` çarpı ile`0x66666667`-O1 ELF nesnesi, tablo için hiçbir sembol tutmuyor. İpucu bölüm sembolüdür `.rodata`Ek olarak bir ekleme ve sadece aynı kaynaklı arm64 yapı onu isimlendirir.`l_switch.table.grade`İkinci kayıt,`0x84`İçeride`grade_label`, 8 bayt değerlerinin ikinci bir tablosunda noktaları `.rodata + 0x28`Üçüncü,`0x93`, `.rodata + 0x0`, `labels.rel`- Evet .

Beş kişi .`.rela.rodata`Kayıtlar doldur `labels.rel`Her giriş , karşılaştırıldığında yer alır .`4i`Ve eklenir.`4i`- Evet .`S + A - P`dizinin adresine eksi tablo tabanına indirir. `grade_label` ile bir giriş okuyor`movslq`, tablo tabanını geri ekler ve işaretçi vardır. İlk kayıt bölüm sembolü isimlendirir`.rodata.str1.1`0 ekleyerek, çünkü dizileri `F`Bu bölümün ilk baytıdır.`.L.str.1`- ...`.L.str.4`, kompilatörün yerel etiketleri için `D`- Evet .`C`- Evet .`B`ve`A`- Evet .

Aynı kaynak üç optimizasyon seviyesiyle üç farklı tabloya bir araya getiriyor. Okuyucu, ayrıştırıcı olmadan farkı gösterir:

| Build | Where `labels` lives | How `grade` selects | How `grade_label` reaches `grade` |
|---|---|---|---|
| -O0 | `.data`, five 8-byte pointers, five `R_X86_64_64` records | A jump table in `.rodata`: five `R_X86_64_PC32` records pointing into `.text` | A call with `R_X86_64_PLT32 grade-0x4` |
| -O1 | `.rodata` as `labels.rel`, five 32-bit relative entries | A value table at `.rodata+0x14`, one `R_X86_64_PC32` | Inlined, no call |
| -O2 | Same as -O1 | Same as -O1 | Inlined, `total` grows to 140 bytes |

-0'da `switch`5 girişinin geriye doğru yönlendirdiği gerçek bir atlama masası.`.text`- ...`+0x91`- Evet .`+0x8c`- Evet .`+0x87`- Evet .`+0x82`ve`+0x86`- Telefonla .`grade`Aynı şeyi taşıyor.`-0x4`Bu nedenle, `lea`-O1'de optimizer her durumun sabit bir değer gönderdiğini gördü ve sıçramaları sonuçlar tablosu ile değiştirdi.

## Program Başlıkları: Kayıtçı'nın Görüşü

Yer değiştirilebilir bir nesne program başlıkları yoktur, bu yüzden `e_phnum`Bu, bir ekle edilebilir veya paylaşılan nesne tarafından kullanılır ve yüklemeci başka bir şey okumamaktadır.`Elf64_Phdr`56 byte (gABI Şekil 5-1): `p_type`- Evet .`p_flags`- Evet .`p_offset`- Evet .`p_vaddr`- Evet .`p_paddr`- Evet .`p_filesz`- Evet .`p_memsz`- Evet .`p_align`, biçimlendirme`<IIQQQQQQ`GABI , üç kural belirler .`PT_LOAD`Girişler yükseliş olarak görünür.`p_vaddr`Bir de bir de bir`p_memsz``p_filesz`sıfır dolma anlamına gelir.`p_vaddr` ile eşleşir`p_offset`modulo `p_align`- Evet .

Bu parçadaki her hedef sizin oluşturduğunuz bir program. Bu Mac'teki hiçbir bağlantı cihazı Linux'un çalıştırılabilir bir cihazı üretmez.`ledger.o`- Yani , bu cihaz ...`tiny-x86_64`- ...den geliyor .`code/fixtures/build_tiny_elf.py`, 736 byte ile yazıyor `struct.pack`Dosyada bir ELF başlığı, iki program başlığı ve 36 baytlı bir başlık var.`_start`, 3 baytlı .`.rodata`, bir simge tablosu ve altı bölüm başlığı.`_start`Yazar `ok\n`Linux'ta x86-64 çalıştırılır. Burada program başlığı yoluna bir ayar vardır.

```text
Program headers:
  PT_LOAD          r-x offset=0x0 vaddr=0x400000 filesz=0x2e0 memsz=0x2e0 align=0x1000
  PT_GNU_STACK     rw- offset=0x0 vaddr=0x0 filesz=0x0 memsz=0x0 align=0x10

entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

Tek kişi`PT_LOAD`736 baytlı dosyanın tümünü haritalar `0x400000`. Okuyucu , `PT_LOAD`Bu bilgi ve bilgi içerir.`p_offset + (address - p_vaddr)`Giriş noktası için .`0 + (0x4000b0 - 0x400000) = 0xb0`, `.text`- Evet .

Bu, rea'nın arkasındaki hesaplama.`address_to_file_offset`Ghidra hedefi için, bu araç geri döner.`{address, file_offset}`Hopper sağlayıcısı da geri dönüyor .`provider_file_offset`ve `image_base_file_offset`. Araç dosyanın tam bir orijinal kopyasına ihtiyaç duyar ve bu kopyanın SHA-256'sı hedefe eşleşmelidir.`inspect_binary_layout`"Bir bağlantılı adres çalıştırma zamanı adresi değildir". Bir konum bağımsız çalıştırılabilir yükler çekirdeğin seçtiği bir taban, ve dosya ofset tek sabit koordinat.

Program başlıkları ayrıca çıkarılmış bir yürütülebilir hala neden çalışmakta olduğunu açıklar. Bir bağlantılayıcı bölüm başlık tablosunu tamamen silebilir ve `e_shoff`Bir araç bölümleri yürürken hiçbir şey görmez.

## Mach-O'da Aynı Fikirler

Apple Mach-O için bir proza spesifikasyonu yayınlamıyor. XNU kaynağının başlıkları spesifikasyon: `EXTERNAL_HEADERS/mach-o/loader.h`- Evet .`nlist.h`ve`reloc.h`- Düzeltme .`ledger-arm64-O1.o`Aynı şey .`ledger.c`ile inşa edilmiş`clang -target arm64-apple-macos -O1 -fno-asynchronous-unwind-tables -c`- Evet .

A.`mach_header_64`32 byte: `magic`- Evet .`cputype`- Evet .`cpusubtype`- Evet .`filetype`- Evet .`ncmds`- Evet .`sizeofcmds`- Evet .`flags`- Evet .`reserved`Büyü ise ...`0xfeedfacf`- Evet .`MH_MAGIC_64`- Evet .`cputype`- Evet .`0x0100000c`- Evet .`CPU_TYPE_ARM64`- Evet .`filetype`1'dir.`MH_OBJECT`- Evet .`ncmds`5 ve `sizeofcmds`616: yükleme komutları başlıktan sonra 616 byteyi yer alır ve her biri  ile başlar.`{cmd, cmdsize}`Bayrak .`0x2000`- Evet .`MH_SUBSECTIONS_VIA_SYMBOLS`- Evet .

```text
Load commands:
  0 LC_SEGMENT_64                cmdsize=472 at 0x20
  1 LC_BUILD_VERSION             cmdsize=24 at 0x1f8
  2 LC_LINKER_OPTIMIZATION_HINT  cmdsize=16 at 0x210
  3 LC_SYMTAB                    cmdsize=24 at 0x220
  4 LC_DYSYMTAB                  cmdsize=80 at 0x238
```

`LC_SEGMENT_64`(0x19) iki ELF tablosuna da Mach-O cevabı.`segment_command_64`- Evet .`segname`- Evet .`vmaddr`- Evet .`vmsize`- Evet .`fileoff`- Evet .`filesize`- Evet .`maxprot`- Evet .`initprot`- Evet .`nsects`ve`flags`- O zaman ...`nsects`Tip kayıtları `section_64`, 80 byte her biri, aynı komuta ile takip edin.`loader.h`yorum yapın `MH_OBJECT`Bölümlerin "Üzerinde bir bölüm olmayan bir bölümde" yaşadığını söylüyor.`fileoff`648, `filesize`456 ve beş bölüm.

```text
  Idx Section                    Addr   Size Offset Reloff Nreloc Type
    1 __TEXT,__text               0x0   0xd0    648   1104      6 S_REGULAR
    2 __DATA,__const             0xd0   0x28    856   1152      5 S_REGULAR
    3 __TEXT,__cstring           0xf8    0xa    896      0      0 S_CSTRING_LITERALS
    4 __TEXT,__const            0x108   0x40    912      0      0 S_REGULAR
    5 __LD,__compact_unwind     0x148   0x80    976   1192      4 S_REGULAR
```

Her bölüm ana bölümünü `segname`, bu yüzden iki bölümden bahsediyorum .`__const`Farklıdır çünkü biri `__DATA,__const`Ve diğerleri .`__TEXT,__const`Yer değiştirmeler bölgeye göre yapılır.`reloff`ve `nreloc`, ELF ' nin ayrı bir `.rela.X`Hedef başına bölme.

Her biri .`relocation_info`8 byte.`r_address`32 bitlik bir alan daha sonra,`r_symbolnum`(24 bit),`r_pcrel`(1) `r_length`(2) `r_extern`(1) ve `r_type`(4) Altı `__text`Kayıtlar üç çift .`ARM64_RELOC_PAGE21`ve `ARM64_RELOC_PAGEOFF12`, bir çift bir masa referansı.`adrp`Ek olarak .`add`Ne yaparsın x86-64 `lea`Yani her referans iki kayıt gerektirir.`__DATA,__const`Kayıtlar `ARM64_RELOC_UNSIGNED`- Evet .`r_length`3, böylece her biri 8 bayt mutlak göstergeyi düzeltir.

-O1'de , arm64 yapı tutuldu .`labels`x86-64 yapısının görevi bir tablo oluşturduğu düz göstergeleri olarak.

`LC_SYMTAB`(0x2) tutulur `symoff`1240'a kadar.`nsyms`17, `stroff`1512'de.`strsize`176 ve 1512 artı 176 1688'dir.`nlist_64`16 byte: `n_strx`- Evet .`n_type`- Evet .`n_sect`- Evet .`n_desc`- Evet .`n_value`- Evet .`n_type`Biraz alan.`N_TYPE`(maske)`0x0e`) eşittir `N_SECT`(`0xe`) 1 tabanlı sırası olan bölümde tanımlanan anlamına gelir.`n_sect`- Evet .`N_EXT`(`0x01`) bir dış sembolü işaret eder.

`nlist_64`24 byte'yi elde etmek için.`_percent_change`okuyucu aynı bölümde bir sonraki simge adresini alır. `_grade`- ...`0x18`C sembolleri önde taşıyor .`_`Burada, yani işlev `_percent_change`- Evet .

`LC_DYSYMTAB`(0xb) ELF ile aynı yerel ilk kural kaydedilir `sh_info`- Evet .`ilocalsym`0 , `nlocalsym`13, `iextdefsym`13, `nextdefsym`4.`LC_BUILD_VERSION`(0x32) kayıtlar `platform`1 (macOS), `minos`26.0 ve `sdk`26.2 paketlenmiş gibi`XXXX.YY.ZZ`Bu komut, arm64 cihazının byte olarak devreye alınmasının nedeni.

Okuyucu'nun `compare_formats`iki dosyayı yan yana koyuyor:

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

rea Mach-O'yu okuyor.`inspect_macho`, ki devam ediyor .`otool -h -l`- Evet .`nm -gjU`- Evet .`dyld_info -imports -exports`ve`dwarfdump --uuid`- Evet .`xcrun`Okuyucuya hiç bir şeye gerek yok ve aynı şeyi okuyor.`symoff`ve `stroff`Bu ...`otool -l`Parmak izleri.`open_binary`REA aracı ELF, MZ, PE ve ince veya evrensel Mach-O'yu sihirli baytlardan algılar.`e_machine`Bu, burada oluşturduğunuz şeyin ilk 20 bytesidir. Başlıksız bir dosya için,`format: raw-binary`Ghidra sağlayıcısı evrensel bir ikili göndermeyi reddediyor ve ince bir parça istiyor.`0xcafebabe`- Evet .

## Yapın

Standart kütüphane okuyucuyu çalıştır:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
```

Demo şöyle diyor:`ledger-x86_64-O1.o`ve başlığı, bölümleri, sembollerini, yer değiştirmeleri ve dosya ofset haritasını yazdırır.`ledger-arm64-O1.o`Program başlıkları ile biter.`tiny-x86_64`Beklenen çizgiler:

```text
percent_change: 16 bytes at file offset 0x40: 85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3
grade: 46 bytes at file offset 0x50: 48 63 c7 48 69 c0 67 66 66 66 ...
entry 0x4000b0 is file offset 0xb0 through PT_LOAD
```

Bir dosyayı okuman için bir yol geçin: `python3 code/main.py code/fixtures/ledger-x86_64-O0.o`Okuyucu ilk dört bayttan ELF veya Mach-O seçer.

Oku `code/main.py`Bu sırada:

1. `ElfFile._read_header()`Sihir, sınıf, bayt sırası ve giriş boyutlarını kontrol eder, sonra başlığı açar.
2. `ElfFile._read_sections()`ve `read_cstring()`Bölüm başlık tablosunu okuyun ve isimleri çözün `e_shstrndx`- Evet .
3. `ElfFile._read_symbols()`bölünmüştür .`st_info`, isimleri çözüyor `sh_link`, ve rezerve edilen bölüm indekslerini okuyabilir hale getirir.
4. `ElfFile._read_relocations()`Her zaman yürür.`SHT_RELA`Bölüm, bölünmeler `r_info`, ve 4.9 tabloda isim türleri.
5. `ElfFile.function_span()`ve `function_bytes()`Bir simgeyi dosya aralığına ve içindeki baytlara dönüştürün.
6. `ElfFile.file_offset_map()`Her yapıyı ofset olarak sıralar ve aktif olmayan alanı doldurur.
7. `ElfFile._read_program_headers()`ve `address_to_file_offset()`Yürütülebilir işlemleri.
8. `MachOFile`Başlığı okuyor, yük komutları,`LC_SEGMENT_64`Bölümleri ile birlikte,`LC_SYMTAB`- Evet .`LC_BUILD_VERSION`, ve bölge başına yer değiştirme.
9. `compare_formats()`Her iki dosyada aynı fikirleri, her birinden değerleri okuyarak isimlendiriyor.

## Kullan

Daha sonraki derslerden okuyucuyu `from main import ElfFile`Bu dersi ekledikten sonra `code`Dizin`sys.path`Ders 33 bunu istiyor .`function_bytes`ve `relocations_for(".text")`.35 ders, çıkışını gözlemli kanıt olarak kaydeder.36 ders, byte karşılaştırmasından önce maske yapılması için yer değiştirme karşılığını ister.

Kendi C ' yi aynı nesne ile bir nesneye oluştur .`clang -target x86_64-unknown-linux-gnu -c`Bu sayede, bir bölüm adı eklenir. Bu sayede, bir bölüm adı eklenir. Bu sayede, bir bölüm adı eklenir.

## İnteraktif Laboratuvar

### Laboratuvar A: başlık elden

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code
python3 -q
```

Çık:

```python
import struct
from main import ElfFile, FIXTURES
data = (FIXTURES / "ledger-x86_64-O1.o").read_bytes()
data[:4], data[4], data[5]
struct.unpack_from("<HHIQQQIHHHHHH", data, 16)
elf = ElfFile(data)
elf.header.e_shoff, elf.header.e_shnum, elf.sections[elf.header.e_shstrndx].name
```

Tuple gösterileri`e_type`1 , `e_machine`62, ve `e_shoff`1064, yani `0x428`Son satır 1. bölümün gösterdiği gibi.`.strtab`Bölüm isimlerini taşıyor.

### Laboratuvar B: anahtarın arkasındaki değer tablosu

```python
rodata = elf.section_bytes(elf.section(".rodata"))
[int.from_bytes(rodata[i : i + 4], "little") for i in range(0x14, 0x28, 4)]
[int.from_bytes(rodata[i : i + 8], "little") for i in range(0x28, 0x50, 8)]
[r for r in elf.relocations_for(".text") if r.symbol == ".rodata"]
```

Her iki tablo da okuyucu .`1, 2, 3, 4, 4`- Karşılarına bak .`ledger.c`- Evet .`grade(65)`hesaplamalar`65 / 10 - 6 = 0`ve 0'u okuyor, bu da 1'in değeri `case 6`- Evet .`grade(100)`4 yazısı, yani 4 , paylaşılan değer .`case 10`ve `case 9`- Evet .

### Laboratuvar C: tek kaynağın üç yapılandırması

```python
for level in ("O0", "O1", "O2"):
    obj = ElfFile.from_path(FIXTURES / f"ledger-x86_64-{level}.o")
    print(level, [s.name for s in obj.sections if s.name in (".data", ".rodata")])
    print(level, sorted({r.type_name for r in obj.relocations}))
    print(level, {s.name: s.st_size for s in obj.symbols if s.type == "FUNC"})
```

-O0 nesnesinin bir `.data`-O1 ve -O2 nesneleri hiçbir `.data`Ve bir tür.`total`-O0'da 66 byte, -O1'de 31 ve -O2'de 140 byte.

### Laboratuvar D: Mach-O'da aynı işlev

```python
from main import MachOFile
macho = MachOFile.from_path(FIXTURES / "ledger-arm64-O1.o")
[(c.name, c.cmdsize) for c in macho.load_commands]
macho.function_span("_percent_change")
macho.function_bytes("_percent_change")[:4].hex()
```

Dosya 648'in geçici süresi 24 byte. İlk dört byte `a0000034`, küçük bir eğitim biçimi .`0x340000a0`, ki `llvm-objdump -d` gibi izler`cbz w0, 0x14`Bu da o .`before == 0`koruyucu, x86-64 yapıdaki aynı test.`85 ff 74 09`- Evet .

## Pratik Laboratuvar

Okuyucuyu bağlantılı bir programa uzatın.`clang -O1 -shared -fPIC code/fixtures/ledger.c -o libledger.so`ve `clang -O1 code/fixtures/ledger.c -o ledger_main`bir `main`eklersiniz, sonra da okuyucuyu her ikisine de çalıştırırsınız.

Gereksinimler:

- Oku `.dynsym`Aynı şeyle.`Elf64_Sym`düzenlenmesi,`SHT_DYNSYM`11'e kadar ve kayıt değişmedi.
- Oku `.dynamic`- Evet .`Elf64_Dyn`Kayıtlar`d_tag`ve `d_val`, ve isim `DT_NEEDED`- Evet .`DT_STRTAB`- Evet .`DT_SYMTAB`- Evet .`DT_RELA`ve`DT_JMPREL`gABI "Dinamik Bölüm" sayfasından.
- Defini edilmemiş sembolleri  ile listelenir.`st_shndx` `SHN_UNDEF`Ülkeler ve ülkeler`R_X86_64_JUMP_SLOT`Kayıtlar `.rela.plt`Bu yüzden, bu telefonları onlara ulaştıran siteler olarak kullanıyoruz.
- Her yeri haritada .`PT_LOAD`gABI kuralını kullanarak, "bir nesne dosyası segmenti bir veya daha fazla bölüm içerir".
- Bunu kanıtla .`address_to_file_offset`paylaşılan nesnede her tanımlanmış fonksiyonun baytları baytlardır.`function_bytes`Geri dönüyor.
- Yakalama`llvm-objdump -h -t -r -p`ve `llvm-objdump -T`Her iki dosya için de metin `code/fixtures/`Okuyucuyu onlarla testlerde karşılaştır.

Başarılı olmak, ithalat listesi, segment haritası ve her fonksiyon aralığı, testler sırasında araç çalıştırılmadan kaydedilen araç çıkışı ile uyumlu anlamına gelir.

## Sınıflandırılmış Laboratuvar

Bu dersin ayarları hakkında beş soru.`code/lab_answers.json`. Sayıları sayılar olarak ya da  gibi altıbuçluk ipler olarak yaz .`"0x40"`, ve listeler JSON listeleri olarak.

1. `t1`: e_shoff of ledger-x86_64-O1.o, as a number.
2. `t2`: %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de %_de_de %_de_de_de_de_de_de_de_de_de_de_de___de_de____de_de_____de____________________________________________________________________________________________________________________________________________________________________________________
3. `t3`: .text dosyasının büyüklükte-x86_64-O1.o'da, hex olarak değiştirilmesi.
4. `t4`: büyüklükte yer değiştirme türü isimleri-x86_64-O0.o, bir liste olarak sıralanmıştır.
5. `t5`: .rodata+0x14'deki beş int değerleri, bir liste olarak, büyüklük-x86_64-O1.o'da.

Cevaplarınızı kontrol edin:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/lab.py
npx tsx code/lab.ts
```

Kontrolcü , her beklenen değerini `code/main.py`- Bu, yazılı.`PASS`- Evet .`FAIL`veya `TODO`Her görev ve puan için, ve sadece beşinin geçtiği zaman 0'dan çıkıyor. `python3 code/lab.py my-answers.json`Başka bir dosyayı kontrol ediyor.`code/tests/test_lab.py`kontrol eden kişinin doğru cevapları kabul ettiğini ve yanlışını reddettiğini kanıtlar.

### Çıkıyor gör .

- Evet .[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)Makine bu dersleri ilk iki istasyon olarak çalıştırır.`percent_change`, ve kabin açılır .`.text`Simgolu açıp simge masasında hangi gerçekleri taşıdığını gör.

## Ders Artifakti

Bu ders bize çok yararlı .`outputs/skill-program-anatomy-elf-from-scratch.md`. Claude, Cursor, Codex, OpenClaw, Hermes veya SKILL.md okuyan herhangi bir ajanla kullanın. Bu beceri, kullanıcının oluşturduğu bir düzen raporu haline getirilen bir kompile edilen nesne veya yürütülebilirliği dönüştürür. Rapor, her yapının, sembolün ve yer değiştirmenin dosya aralığını, yakaladığı araç çıkışına karşı kontrol eder.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

- Suit kanıtlıyor:

- Her bölümde, isim, boyut, adres ve türü yakaladıklarla eşleşir.`llvm-objdump -h`Üç x86-64 nesne ve küçük çalıştırılabilir için metin
- Her simge değeri, bağlayıcı, türü, bölümü, boyutu ve adı yakaladıklarla eşleşir `llvm-objdump -t`metin
- Her yer değiştirme ofset, tip adı, sembol ve ekleme, yakaladıklarla eşleşir.`llvm-objdump -r`metin,  dahil olmak üzere`R_X86_64_PLT32`ve `R_X86_64_64`-O0
- Program başlıkları `tiny-x86_64`Tutuklanmakla eşleşir .`llvm-objdump -p`metin, ve nesneler hiçbir
- `percent_change`dosya sıfırlaması 16 byte `0x40`beklenen baytlarla ve her fonksiyonun içinde olduğu`.text`
- Dosya ofset haritası, her sabitlemenin her baytını bir kez kapsar ve -O1 nesnesinin üç uyum boşluğu yerlerinde yer alır
-  giriş noktası`tiny-x86_64`Dosyaların karıştırılması için haritalar `0xb0`- Evet .`PT_LOAD`, ve yer değiştirilebilir bir nesne adres haritasını reddediyor
- Mach-O başlığı, her yük komutu, bölümü, beş bölümü,`LC_SYMTAB`ve`LC_BUILD_VERSION`Tutuklanmakla eşleşir .`--private-headers`metin
- Mach-O simgelerinin ve 15 yer değiştirme olayının , yakaladıkları ile uyumlu olduğunu .`llvm-objdump`metin ve`_percent_change`648'de 24 byte
- Yanlış bir sihir, 32 bitlik bir sınıf, büyük bir indian dosyası, kısaltılmış bir masa, evrensel bir ikili ve C kaynak dosyası hepsi yükselmektedir.`FormatError`
- `build_tiny_elf.py`Yapılanları yeniden üretir `tiny-x86_64`Bayt bayt
- rakam modülü `site/figures-re-32.js``ledger-x86_64-O1.o`

## Üretim Başarısızlık Modları

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

## İşlem Kuralı

Güvendiğiniz başlığı okuyun, sahip olduğu ofsetleri takip edin ve tanımlayan spesifikasyondan her alanın adını verin. Karşılaştırdığınız araç çıkışını bağlı bir ayar olarak tutun, böylece karşılaştırma aracı olmadan çalışır. Bir değerin spesifikasyonda adı yoksa, sayıyı yazdırın.

## Daha Fazla Okumak

- [System V gABI, chapter 4: Object Files](https://www.sco.com/developers/gabi/latest/ch4.intro.html)ve [ELF Header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html)- Evet .[Sections](https://www.sco.com/developers/gabi/latest/ch4.sheader.html)- Evet .[Symbol Table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html)ve[Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)sayfalar
- [System V gABI, chapter 5: Program Header](https://www.sco.com/developers/gabi/latest/ch5.pheader.html)ve [Dynamic Linking](https://www.sco.com/developers/gabi/latest/ch5.dynamic.html)
- [System V ABI, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)Tablo 4.9 Yer değiştirme türleri
- [Apple XNU `loader.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)- Evet .[`nlist.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)ve[`reloc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/reloc.h)
- [17 U.S.C. 1201](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title17-section1201&num=0&edition=prelim)ve [Directive 2009/24/EC](https://eur-lex.europa.eu/eli/dir/2009/24/oj/eng)
- [Sega v. Accolade, 977 F.2d 1510](https://law.resource.org/pub/us/case/reporter/F2/977/977.F2d.1510.92-15655.html)ve [Sony v. Connectix, 203 F.3d 596](https://law.resource.org/pub/us/case/reporter/F3/203/203.F3d.596.99-15852.html)
- [rea 6.5.0 `docs/binary-diagnostics.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/binary-diagnostics.md)ve [`docs/ghidra-provider.md`](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/ghidra-provider.md)
