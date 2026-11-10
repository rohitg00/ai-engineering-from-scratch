# Kendi Programınızın Dinamik Analizleri: Debuggers, Traces ve Confirming Static Claims

> Bir kırılma noktası, bir kuruluşun bir koşusu hakkında bir gözlemdir. Bu ders, bu gözlemleri statik derslerin verdiği iddialar üzerine onaylanmış, iptal edilmiş ve gözlemlenmemiş hükümlere dönüştüren bir harman oluşturur.

**Type:** Build
**Languages:** Python, TypeScript, C, arm64 assembly, lldb command language
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~130 minutes

## Öğrenme Hedefleri

- Bir defeger'in Linux'taki işletim sisteminden ne ihtiyacı olduğunu açıklayın (`ptrace`) ve macOS'da (Mach görev portları ve istisna portları) ve neden kum kutulu bir kabuğun bir hata işlemini başlatamayacağı.
- Yazılım kesinti noktalarını isimle ve adres listesi ile ayarlayın, donanım izleme noktasını ayarlayın ve işlemcinin her ikisine de koyduğu sınırları okuyun.
- Lldb'yi her durakta kayıtları, belleği ve çerçeve değişkenlerini kaydeden bir durak hokuyla Python'dan seri modunda çalıştırın ve transkripti zaman çizgisine geri analiz edin.
- 32, 33, 34 ve 41 derslerden statik iddiaları bu zaman çizgisi ile karşılaştırın: argüman kayıtları, yapı alanlarının karşılaştırmaları, koşullu bir dalın hangi kenarları aldığı ve hangi çağrılar gerçekleşti.
- Aynı planı bir `-O2`Kur, çözülmüş ve asla vurulmayan kesinti noktalarını oku ve kanıtlayan ve kanıtlamayan şeyleri söyle.
- Bir çekirdek dosyasını kaydet ve yükle ve bir yığın tarzında çekirdekten kaçanları isimlendir.
- Gdb ve lldb komut setlerini haritalayın ve yerleştirin `strace`- Evet .`ltrace`- Evet .`bpftrace`- Evet .`dtrace`ve`rr`Sürümleri ve lisansları ile ilgili doğru işletim sistemine.
- MacOS kod imzalama faktörlerini belirtin. Lldb'nin kendiniz oluşturduğunuz bir ikili işlemini düzeltmesine izin verdi.

## Sorun

Ders 41 okuyun `struct account`DWARF ' dan ve dedi ki`balance`Ders 33 kontrol akışı grafikini oluşturdu `classify`Ve ilk dalın da `return -1`32 dersinde ilk iki argümanın gelmesi söylendi.`x0`ve `x1`Bu cümlelerin her biri baytlardan alınmış.

Bir ajan aynı programı okuyor ve "Ana aramalar" raporunu veriyor.`bump`- Evet .`classify`ve`sum_balances`"Simbol tablosunda üçü de listelenir, bu yüzden cümle güvenli görünüyor.`-O2`Bu işlem, her fonksiyonun bir kırılma noktasını belirler ve onu çalıştırır.`hit count = 0`- Evet .

Agent kaynak hakkında yanılmadı. Sorulan yapı hakkında yanılmadı.`sum_balances(rows, 3)`Bu makine için ikili olduğunu bilmek için tek yol bir defiger altında çalıştırmak ve bakmak.

Bu ders, bakış açısını etkileyen bir harman oluşturur.`account.c`, listeni okuyor, bir LLDB seansını planlıyor, çalıştırıyor ve her statik iddiayı durdurmaların gösterdiği ile değerlendiriyor.`confirmed`Bu koşuda iddiaların doğruluğunu gösteren bir durak anlamına gelir.`refuted`- Kesinlikle yanlış olduğunu gösterdi.`not-observed`35 ders sonra her hüküm bir kayıt olarak kaydedilir.`observed`yetkili bir kayıt`controlled-replay`- Evet .

```figure
re-42-run-timeline
```

## Bir Debugger Üç Sistem Hizmetleri ve Bir Masa

Bir defugger, koduna sahip olmadığı bir sürece dört şey yapar. Procesin durdurulmasını, kayıtlarını okuyuşunu ve yazmasını, hafızasını okuyuşunu ve yazmasını ve sürecin tekrar durduğunu öğrenmesini sağlar.

Linux ' da hizmet `ptrace(2)`Bu el kitabı "bir işlemin (içindeki izleyici) başka bir işlemin yürütülmesini gözlemleyebilmesi ve kontrol edebilmesi için bir araç sağlar" diyor.`PTRACE_TRACEME`Bir çocuğun, ebeveyninin onu izleyeceğini duyurmasına izin verir.`PTRACE_ATTACH`İlişkisi olmayan bir süreç geçiyor.`PTRACE_PEEKDATA`"Tresyenin hafızasında Adr adresindeki bir kelime"`PTRACE_GETREGS`Kayıtları okuyor ve `PTRACE_SINGLESTEP`Yama modül limitleri eklenir: `/proc/sys/kernel/yama/ptrace_scope`1'nin varsayılmadığı durumlarda " hedef işlemin aramacıdan bir soy hattı olması gerekir", 2'nin sadece bir yöneticinin bağlanabileceği anlamına gelmesi ve 3'nin kimseye bağlanamayacağı anlamına gelmesi.

MacOS' da `ptrace`Apple'ın el yazısı listeleri.`PT_TRACE_ME`- Evet .`PT_ATTACHEXC`- Evet .`PT_STEP`- Evet .`PT_CONTINUE`ve`PT_KILL`, ve bunu söyler `PT_ATTACHEXC`"Çocuklardan gelen sinyaller anne-babalara geçer.`ptrace`Hiç. İldb'nin `debugserver`Çağrılar`task_for_pid()`Bu işlem için Mach görev limanı almak için, o zaman `task_set_exception_ports()`Bu yüzden kesinti noktaları istisna mesajları olarak gelir.`taskgated`Kim arayacağını belirler.`task_for_pid`- Evet .

Bu dersdeki bir transkriptte tasarımın maliyetini görebilirsiniz. Oturumun kabuğu bir Seatbelt kum kutusu altında çalışır. Kum kutusu dışında on bir durak üreten aynı plan, içeride bunu üretir:

```text
(lldb) run
error: process exited with status -1 (attach failed ((os/kern) invalid address))
```

Bu işlem oluşturuldu ve sonra kabul edilemedi. Hata defiger hakkı hakkında ve program hakkında hiçbir şey söylemiyor. Harness onu bir başlatma başarısızlığı olarak kaydeder, sıfır duraklar ve hiçbir hüküm ile.

Tablo, kırılma nokta tablosudur. Debugger hangi talimat bytesini hangi adresde değiştirdiğini hatırlar, böylece devam ettiğinizde orijinalini geri koyabilir ve konum başına vurgu sayır. `breakpoint list`Masayı yazdırır ve her atışın sonunda harman okuyor.

## Ayrılık: Bir Byte veya Tek Kelimenin Yerine

Bir yazılım kırılma noktası, işlemcinin kapana kısması olarak, durmak istediğiniz talimatın ilk baytlarında yazılmış bir talimat. x86-64'te bu `INT3`, opcode `CC`, bir bayt uzunluğunda, Intel el kitabında "debug istisna işlemcisini çağırmak için tasarlanmış" olarak tanımlanır.`BRK #imm16`, bir dört baytlı talimat, bunun istisnası "EC değer 0x3C kullanarak ESR_ELx'de istisnasını kaydeder".`BRK`Bu nedenle bir durak, değiştirilen talimatın adresini rapor eder ve sonrasını değil.

lldb, kesinti noktalarını isimle, dosya ve satırla veya adresle belirler.

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O0`bump + 12 at account.c:13:19, address = 0x00000001000004bc
```

`bump + 12`Bu dördüncü talimat.`sub sp, sp, #0x10`- Evet .`str x0, [sp, #0x8]`ve`str w1, [sp, #0x4]`, DWARF çizgi tablosunun fonksiyonun açılış çizgisine atfeddiği çerçeve ayarı.`x0`ve `x1`Bu argümanları hala tutuyorum çünkü başlık sadece kopyaladı.

Adresle, İldb adresin hangi modülüne ait olduğunu bilmelidir.`breakpoint set -a 0x100000504`Bu işlemin var olması öncesinde, arkasında bir bölüm olmayan bir yük adresi bulunur ve ilk testte kalır `unresolved`Tüm yol boyunca `hit count = 0`. Harnelenin kullandığı form modülün isimlerini verir:

```text
(lldb) breakpoint set -a 0x100000504 -s account-O0
Breakpoint 4: address = 0x0000000100000504
```

- Evet .`-s`Numara içeride bir dosya adresi .`account-O0`, lldb yük slaytını ekler ve koşuştan sonra konum okur `resolved, hit count = 2`Ders 33 listesi dosya adreslerini verir, bu yüzden bu bir statik listeni dinamik bir duruma bağlayan form.

### Şubeni el ile çöz

İlk şartlı dalı .`classify`- ...`-O0`Bu kelime.`36f800a8`- ...`0x1000004f0`, ki `llvm-objdump` gibi izler`tbz w8, #0x1f, 0x100000504`. Armak A64 kodlamasından kodlamayı çöz .`TBZ`- Evet .

1. 31 bit .`b5`Bu bit sayısının yüksek bitini.
2. 30 ila 25 bit .`011011`Bit 24 0, seçer `TBZ`Ve hayır .`TBNZ`- Evet .
3. 23 ila 19 bitler `b40`, bit sayısının en düşük beş bitini:`11111`- 31 .`b5`= 0 test edilen bit 31, 32 bit değerinin işaret bitidir.
4. 18 ila 5 bit .`imm14`- Evet .`00000000000101`= 5. Şubenin sıfırlaması `imm14 * 4`= 20 = `0x14`, yani hedef `0x1000004f0 + 0x14 = 0x100000504`- Evet .
5. 4'den 0'a kadar bitler `Rt`- Evet .`01000`= 8, bu yüzden kayıt `w8`- Evet .

`w8`Daha önce bir talimat yüklendi `ldr w8, [x8, #0x4]`, yani `a->balance`4. sıfırlama.`TBZ`Şubesi, işaret bitinin temiz olduğu zaman alınır.`balance >= 0`Kaynak yazdı .`if (a->balance < 0) return -1;`, böylece kompiliör durumu tersine çevirdi: alınan kenar `return -1`blok ve düşüş geçişleri`0x1000004f4`Bu nedenle, kemerin taşıdığı statik iddia, bir predikat ile bir kenar iddiasıdır:`a->balance >= 0`İkinci dalın asansörü aynı şekilde çalışır.`subs w8, w8, #0xc8`hesaplamalar`balance - 200`ve `b.le 0x100000524`en fazla sıfır olduğunda alınır, yani `balance <= 200`- Evet .

## Gözleme Noktaları Hardware ve Az

Bir gözlem noktası, bir adresdeki belleğe erişildiğinde işlemleri durdurur. Bu bir değiştirme talimatı olamaz, çünkü erişimi herhangi bir yerde yapabilecek herhangi bir talimat yapabilir.`DR0`- Evet .`DR3`"4'e kadar kesinti noktasının adreslerini" tutmak ve `DR7`Armadaki çiftler, 1.2, 4. veya 8. byte uzunluğunda, her birini etkinleştirir ve koşulunu (öğüt, yaz veya okuyucu yaz) belirler.`DBGWVR<n>_EL1`, "Gizleme noktası eşleşmesi için kullanılan veri sanal adresini saklar" ve `DBGWCR<n>_EL1`Kontroller için, ve Arm el kitabında "Bir uygulamanın 2-64 nöbet arasında olabileceği" yazıyor.

İldb, kendisine verilen numarayı bildirir:

```text
(lldb) watchpoint set variable a->balance
Watchpoint created: Watchpoint 1: addr = 0x16fdfe00c size = 4 state = enabled type = m
(lldb) watchpoint list
Number of supported hardware watchpoints: 4
```

Bu makineye dört kişi girdi.`0x16fdfe00c`- Evet .`x0 + 4`:           `bump`Dur + DWARF ın geçiş oranı`balance`- Evet .`size = 4`- Bu ...`int`- Evet .`type = m`Yedekleme alanı, bir sonraki gözlem noktasını reddeder ve ikilik güç olmayan bir bölge iki boşluk alabildiği için, ayarlayabileceğiniz gözlem noktalarının sayısı dörtten daha az olabilir.

Veri nöbetleri erişimin ardından rapor verir. Intel el kitabı "memory yazma talimatı, bir veri kırılma noktası tarafından oluşturulan defag istisna oluşturulmadan önce orijinal verileri üstü yazır" diyor ve lldb, eski değeri kendi önbelleğinde iki şeyi de yazdırmak için saklar:

```text
Watchpoint 1 hit:
old value: 250
new value: 255
* thread #1, queue = 'com.apple.main-thread', stop reason = watchpoint 1
    frame #0: 0x00000001000004d0 account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:14:12
```

Durum şu anda.`0x1000004d0`, talimat sonrası `str w8, [x9, #0x4]`- ...`0x1000004cc`Bir şey öğrenmeye değer, sonuçları analiz etmeden önce.`watchpoint set`, İldb parmak izleri `Watchpoint 1 hit:`boş bir eski değer ve `new value: 250`Bu ilk okuma ve harman eski bir değeri olmayan bir vurmayı görmezden gelir.

## Adım, Durma Hakları ve Toplama Modu

İldb'in komut dilbilimesi `<noun> <verb> [-options] [arguments]`- Adım verpleri `thread step-in`(`s`), `thread step-over`(`n`), `thread step-inst`(`si`), `thread step-inst-over`(`ni`), ve `thread step-out`(`finish` ).`thread until 12`Bir çizgiye doğru gider.`thread return <expr>`Harness adım atmaz. Planlanmış adreslerde durur ve bir stop hook'un okuma yapmasına izin verir:

```text
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
```

`-o`Her durakta komutlar düzenli olarak çalıştırılabilir.`register read`İki argüman kaydı ve program sayıcısı isimlerini belirleyin. `memory read -s4 -fx -c24 $x0`24 dört baytlı kelimeyi hex adresinden basıyor `x0`, 96 byte, üç `struct account`Satırlar.`frame variable -P 1`Argütleri ve yerel yerleri yazdırır ve işaretleri bir seviyeye genişletir, böylece `a`Beş alanını gösterir.

Batch modunun `lldb -b`- Bu el kitabında yazıyor .`--batch``-s`- Evet .`-S`- Evet .`-o`ve`-O`ve sonra bırakır ve eğer bir komut "sinyal veya çöküş nedeniyle durdurulursa, hata defektörü etkileşimli çağrısına geri dönecektir". Harnes planı bir dosyaya yazar ve onunla geçirir `-s`Bir konuya bak:`settings set interpreter.stop-command-source-on-error false`- Bu olmadan ilk...`continue`İşlem bittikten sonra tüm dosya sona erer ve `breakpoint list`- İldb parmak izi.`error: Process must be launched.`Ve devam eder.

Çıkış şekli hakkında iki faktör, analiz cihazının nasıl çalıştığını belirler.`Process N stopped`blokla `frame #0`Ardından çizgi basılır. Parser bu nedenle kayıt, bellek ve değişken çizgileri bekleyen bir parçaya toplar ve parçayı bir sonraki parçaya bağlar.`frame #0`Program sayıcısı olan bir parça.`dyld`- ...`_dyld_start`Programın çalışmasından önce giriş durağıdır ve hayır `frame #0`İkincisi, bir kırılma noktası.`--auto-continue`Bu sistemin ilk versiyonu otomatik olarak devam ederek hiçbir şey kaydetmez.`continue`Bunun yerine komutlar.

## Plan Listeden Geldi

`Plan.commands()``llvm-objdump -d`Bu, biner metin için çalıştırılacak.`account-O0`- ...

```text
breakpoint set -n bump
breakpoint set -n classify
breakpoint set -n sum_balances
breakpoint set -a 0x100000504 -s account-O0
breakpoint set -a 0x1000004f4 -s account-O0
breakpoint set -a 0x100000524 -s account-O0
breakpoint set -a 0x100000514 -s account-O0
target stop-hook add -o "register read x0 x1 pc" -o "memory read -s4 -fx -c24 $x0" -o "frame variable -P 1"
run
watchpoint set variable a->balance
watchpoint list
continue
...
breakpoint list
watchpoint list -v
```

Üç isim kırılma noktası fonksiyon girişleri. Dört adres kırılma noktası hedef ve her koşullu dalın sonucudır.`Listing.conditional_branches()`bulur `classify`- Evet .`tbz`- ...`0x1000004f0`ve `b.le`- ...`0x100000510`Planın bekleme noktası ilk durağında belirlenmiştir.`bump`- On altı .`continue`Bu programın bir kısmı, programın bir kısmı değil, bir tavan.

İddialar aynı girişlerden oluşan `claims_for()`- ...

| Id | Kind | Claim | Source |
|---|---|---|---|
| `arg-registers` | argument-register | at every entry the first arguments arrive in `x0` and `x1` | lesson 32 and AAPCS64 |
| `field-offsets` | field-offset | `struct account` is 32 bytes with `kind` at 0, `balance` at 4, `code` at 8, `rate` at 16, `label` at 24 | lesson 41 and the DWARF dump |
| `branch-1` | branch-taken | `tbz` at `0x1000004f0` goes to `0x100000504` when `a->balance >= 0`, otherwise to `0x1000004f4` | lesson 33 edges and the lesson 34 lift |
| `branch-2` | branch-taken | `b.le` at `0x100000510` goes to `0x100000524` when `a->balance <= 200`, otherwise to `0x100000514` | lesson 33 edges and the lesson 34 lift |
| `calls` | call-edge | `main` calls `bump` once, `classify` three times, `sum_balances` once | source text and `nm` |
| `store-once` | store | `bump` writes `a->balance` once and the new value is the old value plus `by` | lesson 34 pseudocode |
| `stride` | struct-stride | `list[i].balance` sits at `list + 32*i + 4` | lesson 41 and the psABI aggregate rule |
| `output` | behaviour | the program prints `class 0 1 -1` and `sum 315` | source arithmetic |

Alan karşılığı `struct_layout()`, şöyle okuyor:`DW_TAG_structure_type`- Evet .`DW_AT_byte_size (0x20)`Ve beş kişi.`DW_TAG_member`Notlar ile birlikte`DW_AT_data_member_location`Planda 4 numarası yazılmıyor.

## -0'da Koşu: 11 Durum

İlk durağımız `bump`Çıkış noktası.

```text
      x0 = 0x000000016fdfe008
      x1 = 0x0000000000000005
      pc = 0x00000001000004bc  account-O0`bump + 12 at account.c:13:19
0x16fdfe008: 0x00000073 0x000000fa 0x00000009 0x00000000
0x16fdfe018: 0x00000000 0x3ff40000 0x00000719 0x00000001
0x16fdfe028: 0x0000006c 0xffffffd8 0x00000003 0x00000000
0x16fdfe038: 0x00000000 0x40000000 0x00000721 0x00000001
(account *) a = 0x000000016fdfe008 {
  kind = 's'
  balance = 250
  code = 9
  rate = 1.25
  label = 0x0000000100000719 "savings"
}
(int) by = 5
```

DWARF ofsetlerine karşı ilk satırdaki sekiz kelimeyi okuyun.`0x73`, yani `'s'`, `kind`Oftet 4'te kelime 1 `0xfa`= 250`balance`2. kelime 8. sıfırlama ile `0x9`- Evet .`code`, a `short`Alt yarısında, üstündeki iki boyutla.`double`16. bölümde 4 ve 5 kelimeleri `0x3ff4000000000000`, yani 1.25. sözcük IEEE-754 kodlaması.`0x100000719`, `label` işaretleme`__TEXT`Sonraki sekiz kelime `0x6c`= `'l'`ve `0xffffffd8`= -40: üçüncü satır, `loan`- Her sayı aynıdır.`frame variable`- Evet .`_check_layout()`Kayıtlar`field-offsets`- Evet .`confirmed`Bu durakta ve 11 durakta tekrar yapar.`x0`- Bir yapı göstergesi var.

`x0`eşit `a`ve `x1`eşit `by`- Evet .`arg-registers`Bu girişte doğrulanır.`classify`Durur .`x1`Hala okuyor.`0x5`, bir kalıntı `bump`ve`classify`Bir argümanın içinde yaşanmayan bir kayıt gürültüdür ve ders 32 iddiası bu konuda hiçbir şey söylemez.

İkinci durak, izleme noktası, eski değer 250, yeni değer 255,`by`= 5. Tüm seferde bir darbe, yani `store-once`Sonra üç aktivasyon geliyor.`classify`, her biri giriş durağı ve bir veya iki kenar durağı ile:

| Stop | Address | Stop reason | What it tests |
|---|---|---|---|
| 2 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 100, `x0` = `a` |
| 3 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 100 >= 0, `branch-1` confirmed |
| 4 | `0x100000524` | breakpoint 6.1 | `b.le` taken, 100 <= 200, `branch-2` confirmed |
| 5 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = 255 |
| 6 | `0x100000504` | breakpoint 4.1 | `tbz` taken, 255 >= 0 |
| 7 | `0x100000514` | breakpoint 7.1 | `b.le` fell through, 255 > 200 |
| 8 | `0x1000004e8` | breakpoint 2.1 | entry, `a->balance` = -40 |
| 9 | `0x1000004f4` | breakpoint 5.1 | `tbz` fell through, -40 < 0 |
| 10 | `0x100000544` | breakpoint 3.1 | `sum_balances` entry, `x1` = 3 |

`_check_branches()`Bu sayede, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir sonraki bir süre için, bir diğer bir süre için, bir diğer bir süre için, bir diğer bir süre için, bir diğer bir süre için, bir diğer bir süre için, bir diğer bir süre için, bir diğer bir diğer bir süre için, bir diğer bir diğer bir diğer bir diğer bir diğer bir diğer için, bir diğer bir diğer bir diğer için, bir diğer bir diğer bir diğerine, bir diğerine, bir diğer bir diğerine, bir diğerine, bir diğerine, bir diğer bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir, bir diğerine, bir diğerine, bir diğerine, bir, bir diğerine, bir diğerine, bir diğerine, bir, bir diğerine, bir, bir, bir diğerine, bir diğerine, bir, bir, bir, bir diğerine, bir, bir diğerine, bir diğerine, bir, bir diğerine, bir, bir, bir diğerine, bir, bir, bir diğerine, bir, bir diğerine, bir, bir diğer`branch-1`Üç kez doğrulandı.`branch-2`Durum 5 dengesini 255 olarak gösterir, bu da izleme noktasının yazdığı değerdir.

10 numaralı durağında , hok 24 kelimeyi okudu .`list`- Evet .`_check_stride()`1. kelime, 9. kelime ve 17. kelime, 4, 36, 68: 100, 255, ve -40'lık sıfatları.`classify`Aynı adreste görülen bir görüntü, toplamı 315'e çıkarır ve toplamı `sum 315`Programın basıldığı çizgi.`breakpoint list`İsimler için 1, 3, 1 ve dört kenar için 2, 1, 1 numaralı sayı gösterir.`confirmed`25 rekor geride, 23'ü bir durakla ve 2'si de son koşuya bağlı.

## -O2'de Çıkış: Zıfır Durum

Aynı kaynakta .`-O2`Farklı bir program.`llvm-objdump -d``main`4 tane var.`bl`talimatlar, hepsi `printf`- O çağrıların yerine .`mov w8, #-0x1`- Evet .`mov w8, #0x1`, sıfırdan geçiyor .`xzr`ve`mov w8, #0x13b`, 315'dir. Yükleyici her sonucu oluşturma zamanında hesapladı.`nm`Hâlâ listeler `_bump`- Evet .`_classify`ve`_sum_balances`, çünkü bunlar dış fonksiyonlar ve diğer nesnelerin çağrısı için çevrimdışı kopyalar bulunmalıdır.`DW_TAG_subprogram`Dört fonksiyon için girişler ve sıfır `DW_TAG_inlined_subroutine`Girişler, hatalama bilgisi bile iç çizgisini kaydetmez.

Bu inşaat için planda üç isim kırılma noktası ve kenar kırılma noktası yoktur. `classify`- ...`-O2`Altı talimat.`ldr`- Evet .`cmp`- Evet .`cset`- Evet .`cmp`- Evet .`csinv`- Evet .`ret`Kısımları, ırmaklardan elde edilen hakları`-O0`listing bu ikili adresde bulunmaz ve harness onları taşımamaktadır. bir kenar hakkında bir iddia kenarını taşıyan bir binaya aitdir.

Koşu:

```text
(lldb) breakpoint set -n bump
Breakpoint 1: where = account-O2`bump at account.c:13:16, address = 0x0000000100000460
(lldb) run
sizeof 32 align 8
offsets 0 4 8 16 24
class 0 1 -1
sum 315
Process 48444 exited with status = 0 (0x00000000)
(lldb) watchpoint set variable a->balance
error: Command requires a process which is currently stopped.
(lldb) breakpoint list
1: name = 'bump', locations = 1, resolved = 1, hit count = 0
```

Her kesinti çözüldü. Adres var, sembol var ve LLDB bir yazı yazdı.`BRK`Öldürülmüşler sayısı sıfır çünkü hiçbir talimat alıcı adresi bulmamış.

| Claim | Verdict | Record |
|---|---|---|
| `calls` | refuted | after a full run with exit status 0, entry stops bump 0, classify 0, sum_balances 0 |
| `output` | confirmed | the four lines and exit status 0 |
| `arg-registers` | not-observed | no stop tested it, hit counts all 0 |
| `field-offsets` | not-observed | no stop tested it |
| `store-once` | not-observed | no stop in bump, so the watchpoint was never set |
| `stride` | not-observed | no stop in sum_balances |

İtirazın ne dediği konusunda kesin olun.`main`Bu programdaki üç fonksiyonu çağırıyor. Bu kurma ve bu koşma için yapmaz ve harness koşunun tamamlandığını kontrol eder, çünkü çıkıştan önce sıfırdan bir sayı, koşumun henüz çağrıyı ulaşmadığını gösterir. İddia, fonksiyonların ölü kod olduğunu söylemedi ve çalışmanın da bunu söylemediğini belirtti: ihraç ediliyor ve başka bir nesne onları arayabilir. Diğer dört iddia ne onaylanmış ne de reddedilmiş. - Yapı hâlâ var .`balance`Bu yapıdaki 4'ün ötesinde ve `-O2`DWARF öyle diyor ama bunu göstermek için hiçbir durak yok.`not-observed`bu ayrımı korur ve ders 35 bir koşuk onu gözlemleyecek kadar bilinmeyenin açık kalmasını sağlar.

## Çöpler

Bir çekirdek dosyası, işlemin bellek ve diske yazılan kayıtlardır, böylece defugger programın kaybolduğu zaman durdurulmuş bir program okuyabilir.`core(5)`"Bir sürecin anormal bir sonuna neden olan küçük sayıda sinyal, aynı zamanda sürecin çekirdek durumunun bir kaydının diske yazılmasına neden olur".`/cores/core.pid`"Bugün bitmiş işlemin dizinde yazma izni olduğu ve dizinin var olduğu sürece".`sysctl`Raporlar`kern.coredump: 1`ve `kern.corefile: /cores/core.%P`- Evet .`/cores`mod ile var `drwxrwxr-t root admin`, ve kabuğu `ulimit -c`0 ile sınırını yükseltmeden hiçbir çekirdek çekirdeği yazılmıyor.`ulimit -c unlimited`, veya sistem genelinde `launchctl limit core unlimited`- Evet .

İldb, bir çekirdek yazıyor, istek üzerine, bir kaza olmadan.`bump`Bozukluk noktası:

```text
(lldb) process save-core --style stack account-O0-stack.core
Saving 49152 bytes of data for memory region at 0x16fdf4000

Modified-memory or stack-memory only corefile created.  This corefile may 
not show library/framework/app binaries on a different system, or when 
those binaries have been updated/modified. Copies are not included
in this corefile.  Use --style full to include all process memory.
```

Dosya 53.248 byteydi.

```text
(lldb) target create "./account-O0" --core "account-O0-stack.core"
(lldb) bt
* thread #1, stop reason = ESR_EC_BRK_AARCH64 (fault address: 0x0)
  * frame #0: 0x00000001000004bc account-O0`bump(a=0x000000016fdfe008, by=5) at account.c:13:19
    frame #1: 0x0000000100000640 account-O0`main at account.c:40:5
    frame #2: 0x000000019a949d54 dyld`start + 7184
(lldb) frame variable *a
(account) *a = (kind = 's', balance = 250, code = 9, rate = 1.25, label = "")
(lldb) frame variable a->label
(const char *) a->label = 0x0000000100000719 ""
```

Geriye doğru ve tam sayı alanları sağlamdır, çünkü çekirdeğin koruduğu yığın üzerinde yaşıyorlar.`label`İzlemeci sağlam bir boş bir ip olarak izler.`0x100000719`doğru; işaret ettiği baytlar kelimenin tam anlamıyla `"savings"`- ... ...`__TEXT`Bu bölüm, bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide bir dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide dizide diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz diz`--style full`Tüm süreç belleğini içerir ve araştırma makinesinde bulunan bu 34 KB programın tam çekirdeği 2.1 GB'dı, çünkü süreç paylaşılan önbelleği haritalar.`ESR_EC_BRK_AARCH64`: çekirdeği `BRK`Bu kesinti noktasının ortaya koyduğu istisna.

Linux'ta çekirdek çekirdeği `/proc/sys/kernel/core_pattern`,  ile bir şablon`%p`PID için, `%e`Komut adı için, `%s`sinyal için ve `%t`Zamanın ve liderliğin`|`Sistemli dağıtımlar bu boruyu kullanıyor.`systemd-coredump`ve`coredumpctl list`- Evet .`info`- Evet .`dump`ve`debug`Sakladıklarını geri al.`gdb prog core`ve `lldb -c core prog`Her ikisi de sonucu açıyor.

## GDB ve LLDB Yan yana

İki defogör farklı kelimelerle aynı işi yapar. `COMMAND_MAP`Harnes'te 35 satır var, baskı `python3 code/main.py commands`Bu derste kullanılanlar:

| Task | gdb | lldb | lldb alias |
|---|---|---|---|
| break at a function | `break bump` | `breakpoint set -n bump` | `b bump` |
| break at an address in one module | `break *0x1000004f0` | `breakpoint set -a 0x1000004f0 -s account-O0` | |
| run commands at every stop | `define hook-stop` ... `end` | `target stop-hook add -o '...'` | |
| list breakpoints with hit counts | `info breakpoints` | `breakpoint list` | `br l` |
| watch a variable for writes | `watch a->balance` | `watchpoint set variable a->balance` | `wa s v a->balance` |
| list watchpoints | `info watchpoints` | `watchpoint list -v` | `wa l -v` |
| read one register | `p $x0` | `register read x0` | |
| read memory as words | `x/8xw 0x16fdfe008` | `memory read -s4 -fx -c8 0x16fdfe008` | `x -s4 -fx -c8 0x16fdfe008` |
| show arguments | `info args` | `frame variable --no-locals` | |
| step one instruction | `stepi` | `thread step-inst` | `si` |
| run until the function returns | `finish` | `thread step-out` | `finish` |
| write a core file | `gcore core` | `process save-core --style stack core` | |
| open a core file | `gdb account-O0 core` | `lldb -c core account-O0` | |

İldb'nin `p``dwim-print`,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `frame variable`Yol ve düşüş geri `expression`Başka bir şey için.`v`- Evet .`frame variable`- Ben tercih ederim .`frame variable`bir harness'te: DWARF konumlarını okuyor ve hata defektöründe asla kod çalıştırmaz.

2026-10-14 tarihlerinde versiyonlar ve lisanslar. lldb LLVM sürüm numarası taşıyor ve mevcut llvm.org sürümü 2026-10-06'daki LLVM 23.1.3'dir.`lldb`Bu makine gemisindeki Komut Linesini Araçları .`lldb-1703.0.236.21`GDB 18.1 2026-09-25'te GPL-3.0 veya daha sonraki bir uygulama altında yayınlandı.`.gdb_index`, AArch64 `FPMR`, ve Python `gdb.Corefile`GDB'nin 18.1'e kadar Apple silikon işlemleri için yerel destek olmadığı için, 15 parş "İnsani AArch64-Darwin desteği" serisi Ekim 2025'te yayınlandı ve Şubat 2026'da bir bakımcı, telif hakkı verimi ve BFD parşlarını önce indirme yolunu belirledi.`gdb`Formula , arm64 şişelerinden oluşur ve sahte bir ile yapılır .`--target=x86_64-apple-darwin20`MacOS'ta Apple olmayan herhangi bir defugger'in de kendi imzaladığı bir sertifika ve `com.apple.security.cs.debugger`Hak, veya`task_for_pid`"(os/kern) başarısızlığı (0x5) ile başarısız olur". gdb'nin bu kursta yeri Linux'dur, Debian'ın gdb 16.3'ü arm64 için sabit gemilerinde ve `rr`Hayatları.

## İzleme: Program Nedir Kernel'den İstedi

Bir defeger, programın durduğu durumunu gösterir. Bir izleyici programın sistem üzerindeki etkilerini uzun süre durmadan gösterir. Araçlar her işletim sistemi için.

| Tool | OS | Version | Licence | What it records |
|---|---|---|---|---|
| `strace` | Linux | 7.2, 2026-08-18 | LGPL-2.1-or-later | system calls with arguments and return values |
| `ltrace` | Linux | 0.7.3 last tarball, git snapshots in Debian | GPL-2.0 | dynamic library calls |
| `bpftrace` | Linux | v0.27.0, 2026-09-10 | Apache-2.0 | kernel and user probes through eBPF |
| `dtrace` and `dtruss` | macOS | `Sun D 1.19` in macOS 26.2 | CDDL, from Sun's OpenSolaris | D probes; `dtruss` prints system calls |

`dtruss`Bu komut, "Bu DTrace kullanıldığından, sadece kök ayrıcalıkları olan kullanıcılar bu komutu çalıştırabilir".`dtrace(1)`"Önlü standard Sistem Doğruluk Koruma ayarları ile, D programlarının çekirdek adres değerlerine veya çekirdek bellek içeriğine erişmesine izin verilmez" ve SIP altında yıkıcı eylemlerin izin verilmemesi. `sudo dtruss ./account-O0`Bu makine bu ders içinde çalıştırılmadı, çünkü harness kök olmadan çalışır, ve ders kayıtları doğrulanmamış olarak.`write`Her biri için`printf`"Line" bir iz sorusu, "did `x1`5'i tut .`bump`" sorusu bir debuger sorusu.

## Kayıt ve Tekrar Çalma

`rr`bir atışı bir kez kaydetir ve gdb altında belirleyici olarak tekrar yaparken, ters uygulanma ile: değerinizi önemsediğiniz bir gözlem noktasını ayarlayın ve `reverse-cont`Yazıya geriye doğru gider. Proje kendini şöyle tanımlıyor: "Bir hata kaydedilir, sonra kaydı istediğiniz kadar defa defeg edin". Mevcut yayın, 2025-02-13'te 5.9.0'dur. MIT lisansıyla BSD-2-Klavü bloklu. Sadece Linux. Şubeleri saymak için donanım performans sayıcılarına ihtiyaç duyar, bu nedenle Intel Nehalem ve daha sonra, bazı AMD Zen çekirdekleri ve "belirli AArch64 mikro mimarisi (örneğin ARM Neoverse N1 veya Apple Silicon M serisi) " Linux altında. Sanal bir makine içinde sayıcılar sanal hale getirilmelidir ve proje wiki "Mac'da başka sanal hale getirilme de yapmaz" diyor, bu yüzden Docker ve Colima bu makine üzerinde çalıştıramaz. Pernosco, RR kayıtları üzerine kurulan ticari hizmettir.

GDB'nin kendi yazılım kaydedici var.`record full`200 bin talimatın varsayılan bir sınırı olan "işlem idaresinin bir günlüğü" kaydedilir ve `record btrace`Bu macOS makinesinde, harnesin kaydedilen transkripti kayıttur: aynı ikili üzerinde aynı plan aynı sırada aynı durağı üretir ve sabitleme bu sırayı test eder.

## Koşmanın Kanıtı

Bir çalıştırma bir yapıdaki bir girişyi kanıtlar. C standardı tanımlanamayan davranışı "ağır veya yanlış bir program yapısı veya yanlış verilerin kullanıldığı bir davranış olarak tanımlar. Bu belge için herhangi bir gereklilik yoktur".`int`                            `-O0`ve `-O2`Ders 36 bunu `percent_change`UBSan soruyu bir duruma dönüştürüyor:`-fsanitize=signed-integer-overflow -fsanitize-trap=undefined`Bu da bir sebepten dolayı bir durak olarak LLDB'ye yerleşen bir tuzak talimatını gerçekleştirir.

Optimized code ayrıca izlemek istediğiniz şeyi de hareket ettirir. GDB'nin el kitabı "optimizer kodu yeniden düzenledi; hata defektörü size gerçekten ne olduğunu gösterir" ve varlığından optimize edilmiş bir değişken "GDB asla görmez". GDB böyle bir değer yazdırır `<optimized out>`, ve kaynağı onu `<unavailable>`: optimize edilmiş "programda gerçekten bulunmuyor", kullanılamayan "programda bulunmaktadır (makine düzeyinde), ancak GDB'nin buna ulaşma imkanı yoktur".`<variable not available>`Program sayıcısı değişkenin DWARF konum listesinin her aralığı dışında olduğunda. Bir kayıtta yaşayan bir yerel üzerinde bir gözlem noktası asla ateşlenmez, çünkü bir kayıt hafızası değildir.`-O2`Yukarıdaki koşuk aşırı durumunu gösterir: tüm işlev katlanıldı ve hiç belirlenmemiş bir gözlem noktasının sessizliği hiçbir şey kanıtlamaz.

Bu yüzden, harness üç çeşit kayıt yazıyor ve hiç dördüncü bir durak yazmıyor.`confirmed`Bir durak test etti ve anlaşamadı .`refuted`Bir durak test edemeyeceği iddia .`not-observed`Bu nedenle, ders 35'in büyük kitabı ilk iki bölümü kabul eder.`observed`yetkili kayıtlar `controlled-replay`Ve üçüncü kişiyi açık bir bilinmeyen olarak saklıyor.

## MacOS'ta Sadece Kendi Yapımlarınızı Debug Etmek

Apple silikon üzerinde bağlantı işaretleri sizin için.`ld(1)`- Evet .`-adhoc_codesign`: "Apple Silicon ikili işlemlerinin varsayılan özellikleri ad hoc kodlamalarıdır". `codesign -dvvv account-O0`Donanım izlerinde:

```text
Format=Mach-O thin (arm64)
CodeDirectory v=20400 size=387 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
Signature=adhoc
TeamIdentifier=not set
```

`0x20002`- Evet .`CS_ADHOC`(`0x2`) artı `CS_LINKER_SIGNED`(`0x20000`), "Linker tarafından otomatik olarak imzalanmıştır" Apple'ın kod imzalanma başlığı. `codesign -d --entitlements -`İcra edilebilir adın ardından hiçbir şey yazdırmaz: ikili hiçbir hakkı yoktur. lldb onu başlattı, her kesinti noktasına vurdu, bir donanım izleme noktası ayarladı ve bir çekirdek yazdı, `DevToolsSecurity -status`"Geçimci modu şu anda devre dışı" ve Sistem Doğruluk Koruma etkinleştirildiğini bildirmek.

İki hak, kimin neyi yanlış yapabileceğini kontrol ediyor ve karşı tarafa otururlar. `com.apple.security.cs.debugger`Bu, "Bir uygulama bir debuger olup olmadığını ve diğer süreçlere bağlanabilir veya görev limanlarını alabilir" anlamına gelir.`debugserver`özel bir biçiminde bulunur ve`codesign -d --entitlements -`Komut Satır Araçları kopya listelerinde `com.apple.private.cs.debugger`- Evet .`com.apple.private.set-exception-port`- Evet .`com.apple.private.thread-set-state`ve`com.apple.private.logging.diagnostic`- Evet .`com.apple.security.get-task-allow`Xcode, bu işlemleri defekt yapımlarına enjekte eder, ihracattan çıkarır ve notaryalanma hala sahip olan bir ikili işlemini reddeder. Apple mühendisleri reddedilme kuralını belirtir: hedef sertleştirilmiş çalıştırma süresi etkinleştirildiğinde ve yapmadığında görev limanı reddedilmektedir.`get-task-allow`- Bir düzlük .`clang`Eğer bir anlaşmayı imzalarsan, bu anlaşmayı yaparsanız,`codesign --options runtime`, yeniden imzalayın .`codesign -s - -f --entitlements get-task-allow.plist`Debug yapmadan önce.

Bölümü üç daha gerçekle kapatır. İlk olarak, giriş seansında ilk kez "Developer Tools Access devam etmek için başka bir işlemin kontrolünü almak zorunda" diyalogunu görebilirsiniz. `sudo DevToolsSecurity -enable``admin`veya `_developer`SIP'i öz kodunuzu düzeltmek için devre dışı bırakmayın. Apple "Xcode'dan uygulamaları çalıştırmak ve düzeltmek için SIP'i devre dışı bırakmanız gerekmez" diyor ve defeglemeyi etkileyen tek SIP bileşen ise bir SIP'dir.`csrutil enable --without debug`Üçüncü olarak, bu oturumda Seatbelt kum kutusunun blokları.`task_for_pid`Tamamen ve tam olarak `sandbox-O0.lldb.txt`Başlayamayan bir koşuk bir çevre faktörüdür ve harness bunu bir faktör olarak bildirir.

Bu dersdeki her şey, oluşturduğun programlara da geçerlidir. Aynı komutlar başka bir işlemin sahibi kabul ederse bağlanır ve burada bunu nasıl değiştireceğimizi öğreten hiçbir şey yok.

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu kaydedilen transkriptler üzerinde. Her bir yapı için çözünürlükleri ve isabet sayıları ile kesinti noktalarını, donanım nöbet sayısını, kayıtları ve argümanları ile her durak, çıkış durumunu, programın çıkışını, yazdırılan hataları lldb ve hükümleri ile iddiaları ve arkasındaki kanıt kayıtlarını listeler. Bu, çekirdek geri dönüş, Python API sonuçları, kum kutu başarısızlığı ve bu makine üzerinde hangi dış araçlar eksik olduğunu ekler.

Beklenen şekil:

```json
{
  "program": "account.c",
  "variants": {
    "O0": {
      "binary": "account-O0",
      "breakpoints": {"1": {"spec": "name=bump", "address": "0x1000004bc", "resolved": true, "hits": 1}, "...": "..."},
      "hardwareWatchpoints": 4,
      "watchpoints": {"1": {"address": "0x16fdfe00c", "size": 4, "type": "m", "hits": [[250, 255]], "hitCount": 1}},
      "stops": [{"index": 0, "pc": "0x1000004bc", "function": "bump", "kind": "entry", "registers": {"x0": "0x16fdfe008", "x1": "0x5"}, "...": "..."}],
      "exitStatus": 0,
      "claims": [{"id": "arg-registers", "verdict": "confirmed", "confirmed": 5, "refuted": 0, "not-observed": 0, "...": "..."}],
      "evidence": [{"claim": "arg-registers", "verdict": "confirmed", "stop": 0, "observation": "bump: x0 = 0x16fdfe008 and a = 0x000000016fdfe008, x1 = 0x5 and by = 5"}]
    },
    "O2": {"stops": [], "claims": [{"id": "calls", "verdict": "refuted", "...": "..."}], "...": "..."}
  },
  "core": {"savedAt": {"function": "bump", "pc": "0x1000004bc"}, "labelString": "", "...": "..."},
  "types": {"python": "3.9.6", "size": 32, "...": "..."},
  "sandbox": {"stops": 0, "errors": ["process exited with status -1 (attach failed ((os/kern) invalid address))"]},
  "absentTools": ["bpftrace", "gdb", "llvm-objdump", "ltrace", "rr", "strace"]
}
```

Oku `code/main.py`Bu sırada:

1. `Listing``llvm-objdump -d`Metinleri işlevler ve talimatlar olarak oluşturmak ve `Function.conditional_branches()`Tarlaları ve düşüşleri ile dalları bulur.
2. `struct_layout()`                       `llvm-dwarfdump`Mesaj.
3. `lift_condition()`Bir koşullu dalı bir predikat haline getirir, ders 34 adım için `tbz`- Evet .`cbz`, ve karşılaştırma ve şubesi formları.
4. `Plan.commands()`listeden lldb komut dosyasını yazar ve `Plan.lldb_command()`- Bu birim çağrısı.
5. `parse_transcript()`çıkışları sırayla yürütür ve oluşturur `Stop`Kayıtlar, bellek, değişkenler ve gözlem noktaları değerleri, ayrıca kırılma nokta tablosu ve çıkış durumu olan kayıtlar.
6. `claims_for()`Sekiz iddiayı belirtir ve `evaluate()`Notları durdurun durun `_check_*`fonksiyonları.
7. `rollup()`Kayıtları her iddia için bir hükümle azaltır ve onaylanmamış olanın onaylanmamış olanın önüne geçiyor.
8. `capture()`ve `capture_extras()``live()`Yeni bir yapı üzerinde tüm döngüyü tekrarlar .`clang`ve `lldb`Kaçabilmek için.

Dört emir daha var.`python3 code/main.py plan O0`Bu bir yapı için komut dosyasını yazdırır. `python3 code/main.py commands`GDB ve LLDB tablolarını basar. `python3 code/main.py tools`Dış araçların hangi raporlara dayandığını `PATH`- Evet .`python3 code/main.py live O0`bir araya getirir `account.c`Bir sandbox içinde, Lldb'nin işlem başlatamadığını, hata ile, ve çıkış 1.

## Kullan

Bu sırada kendi programınızda harness kullanın.

1. Bunu yapın .`-g`Binary, dSYM veya DWARF'ini ve `llvm-objdump -d`Birlikte mesaj atın.
2. Çalışma başlamadan önce talepleri yazın. Her biri bir fonksiyon, bir kayıt veya bir adres veya bir ofset, beklenen bir değer veya kenar ve geldiği ders veya belgeyi adlandırır. Durumu gördükten sonra yazdığınız bir talep durumu tanımlar ve hiçbir şey test etmez.
3. Listeden planı oluşturup okuyun. Listedeki her adres listedeki bir satırla bağlantılı olmalıdır. Eğer bir kırılma noktasında böyle bir satır yoksa, onu kaldırın.
4. Bir kez seri modunda çalıştırın ve komut satırı ve hata defteri versiyonu ile transkripti başlıkta tutun. transkript kanıt. Yargılamalar ondan çıkarılır ve herkes onları yeniden çıkarır.
5. Sınıf. Her birini oku.`not-observed`Bu nedenle, hangi iddiaların başka bir giriş, başka bir yapı veya başka bir kırılma noktasına ihtiyacı olduğunu belirten nedenler.
6. Optimize edilmiş yapılandırmayı aynı taleplerle çalıştırın. Yükleyici'nin çizilen sıfır çarpma ile çözülmüş kesinti noktalarını bekleyin ve bu talepleri açık tutun.
7. Dayanmış ve reddedilen kayıtları ders 35 defterine girin .`observed`, yetki`controlled-replay`Gözlem edilmeyenleri bilinmeyen olarak bırakın.

## İnteraktif Laboratuvar

### Laboratuvar A: bir durakla el ele okuyun

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/code
python3 -q
```

Çık:

```python
from main import *
t = load_transcript("session-O0.lldb.txt")
s = t.stops[0]
hex(s.pc), s.function, s.reason, s.registers
[hex(w) for w in s.memory[:8]]
s.struct_pointer().fields
```

İkinci satırdan önce hangi kelimenin 250 ve hangi iki kelimenin 1.25. olduğunu yazın.`struct.unpack("<d", struct.pack("<II", s.memory[4], s.memory[5]))`Sonra bak.`t.stops[1].watch_hit`ve `t.stops[1].pc`, ve adresini bul `account-O0.objdump.txt`Bu da mağazadan sonra verilen talimat.

### Laboratuvar B: Şubesi ve onun halefi

```python
plan = make_plan("O0")
plan.branches()
classify = plan.listing.function("classify")
[lift_condition(classify, b, "a->balance")[0] for b in plan.branches()]
[(hex(s.pc), s.struct_pointer().field_int("balance")) for s in t.stops_in("classify")]
```

Her kenar durakla giriş durakla eşleşin ve kanıtlara bakmadan önce, predikatin hangi halefi öngördüğünü belirleyin.`[e.to_dict() for e in evaluate(plan, t, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim.startswith("branch")]`ve karşılaştır.

### C laboratuvarı: hiç durmayan koşuk

```python
o2 = load_transcript("session-O2.lldb.txt")
len(o2.stops), o2.exit_status, o2.hits()
o2.errors[:3]
make_plan("O2").branches()
rollup(evaluate(make_plan("O2"), o2, struct_layout(open("fixtures/account-O2.dwarfdump.txt").read(), "account")))
```

Her birini açıkla `not-observed`Kendi sözünle, sonra aç.`account-O2.objdump.txt`ve dört sabit bul `main`Aramaların yerini aldı.`DW_TAG_inlined_subroutine`İçeride`account-O2.dwarfdump.txt`- Evet .`count_tags()`- Evet .

### Laboratuvar D: Kanıtları kırın

```python
text = open("fixtures/session-O0.lldb.txt").read().replace("x1 = 0x0000000000000005", "x1 = 0x0000000000000006", 1)
broken = parse_transcript(text)
[e.to_dict() for e in evaluate(plan, broken, struct_layout(open("fixtures/account-O0.dwarfdump.txt").read(), "account")) if e.claim == "arg-registers"][:2]
```

Bir düzenlenmiş kayıt ilkini çevirir .`arg-registers`Kayıt`refuted`Ve diğer dört giriş kalırken,`confirmed`Sonra  sil .`old value: 250`Gözleme noktasının öncesinde bir çizgi ve izleme`store-once`Düşmek için`not-observed`Başarısız olamayan bir sınıflandırıcı sınıflandırmak değildir.

Eğer Ildb, kabuğunda bir süreç başlatabilirse, `python3 main.py live O0`ve `python3 main.py live O2`- Satır adresleri, katılardan farklı olacak.

## Pratik Laboratuvar

Bağlantıyı , bir dilimle uzatın .`sum_balances`- Evet .

Gereksinimler:

-  Çubukun arka kenarını bul`sum_balances`- ... ...`-O0`listelenme ile `conditional_branches()`ve döngü başlığındaki bir kırılma noktasını ekleyin.
- Başlık tarafından işletilen bir talebi ekleyin `count + 1`Zamanları `count`= 3, yani ders 33 arka kenar artı çıkış testi.
- Stop hook veya planı uzatın böylece hook her başlık durduğu anda döngü sayıcısının yığın boşluğunu okuyor ve bir `_check_loop()`karşı değerlerin sırasını kaydeder.
- Transkripti tekrar alın .`python3 main.py capture O0`Bu test, yeni planla uyum sağlayana kadar plan testi başarısız olur.
- Transkriptte bir karşı değer düzenleyen ve iddia dönüşünü doğrulayan bir test ekleyin `refuted`- Evet .

Başarı, raporun başlıkların karşı değerleriyle sırayla durduğunu göstermesidir.`-O2`Run yeni iddiayı korur .`not-observed`Bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde, bu da bir şekilde,

## Ders Artifakti

Bu ders de içerir .`outputs/skill-dynamic-analysis-of-your-own-program.md`Bu programı, listesini ve statik iddiaların listesini, her bir iddia için kaydedilen bir defektör transkripti ve bir hüküm olarak dönüştürmek için kullanın. Her bir hüküm için bir durak ve her bir iddia için neden olarak.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Suit, İLDB olmadan çalışır.`code/fixtures/`Verifikasyon şunları kanıtlamalıdır:

- listeler analizci, dört fonksiyonu ve iki koşullu dalını bulur.`classify`- ...`-O0`Hedef ve düşüş ile
- `tbz w8, #0x1f`- Evet .`a->balance >= 0`ve `subs`Ek olarak .`b.le`- Evet .`a->balance <= 200`
- `main`- ...`-O0`Çağrılar`bump`- Evet .`classify`Üç kez ve`sum_balances`ve`main`- ...`-O2`Sadece aramaklar `printf`
- x86-64 `j<cc>`Mnemonik şartlı ve `jmp`ve `callq`değiller
- DWARF atık 0, 4, 8, 16 ve 24'teki üyeleri olan 32 byet bir yapı verir.
- `-O2`DWARF'da dört alt program ve sıfır içe girilen alt program girişleri bulunmaktadır.`nm`hala üç fonksiyonu listede
- Plan her iki yapı için de görevli komut dosyasına eşit ve transkript başlığı onu çalıştıran lldb komutunu kaydeder
- `-O0`Transcript beklenen işlevlerde on bir durak, çıkış durumu 0 ve dört çıkış hatına sahiptir
- Hak çıkışı, ardından gelen duruma bağlanır.`x1`= 5, hafıza başlangıçta `x0`, ve etiket dizilisi
- Bozukluk noktaları tablosu çözünürlük ve çarpma sayıları taşır 1, 3, 1, 2, 1, 1, 1
- Gözleme noktası 4 byte türü değiştirir `x0 + 4`, eski değer 250 ve yeni değer 255 ile bir kez vuruldu ve dört donanım yuvası rapor edildi
- `-O2`Transcript'in sıfır durakları, sıfır vurma ile üç çözülmüş kesinti noktası, hiçbir izleme noktası ve kullanılmayan her bir hata vardır.`continue`
- Çamurlu kutu başlatılması, ekleme hatası ile herhangi bir durmadan başarısız olur
- Yöntemli dönüş yolculuğu geriye doğru izler ve `balance`= 250 ve arkadan bir ip kaybeder `label`
- Python API'si beş alanı, 32 boyutunu ve işlev aralığını bir işlem olmadan okuyor
- El yazısı x86-64 transkripti ile analiz eder `rdi`- Evet .`rsi`ve`rip`
- Her iddia onaylanır `-O0`5, 11, 3, 2, 1, 1, 1, 1 kayıtları ile
- Şubenin kanıtları değer, durum ve kenarın adını verir.
- Alan karşılığı kanıtları DWARF düzenlemesi ile kelimeleri çözüyor
- Depo ve adım kanıtları eski ve yeni değer ve üç satırlık dengeler taşır.
- `-O2`Run, çağrı kenarlarını reddeder ve diğer iddiaları gözlemlemediğini bırakır
- Düzenlenmiş bir kayıt değeri reddedildi, silinmiş bir izleme noktası vurulmadı ve redded rollup kazanır
- Komut haritasında her satır için gdb ve lldb formları vardır ve donanım tablosunda dört x86 hata defog kayıtları vardır
- Demo, başarısız olmamak yerine eksik araçları listeler ve canlı modda kayıp araçın adını bildirir
- Resim verileri her iki seanstan gelir ve sitedeki modül aynı verileri yerleştirir

## Üretim Başarısızlık Modları

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Resolved breakpoint with zero hits | "the function runs" or "the function is dead" | a full run with exit status, hit counts, and the verdict `refuted` for the call edge only |
| Register read at the wrong stop | "`x1` = 5 inside `classify`" | compare only declared arguments at the entry stop |
| Struct read without offsets | a column of hex words | every word mapped to a `DW_AT_data_member_location` and compared with `frame variable` |
| Branch graded from the mnemonic | "`tbz` means taken when negative" | the lifted predicate from the encoding and the stop at the successor |
| Watchpoint on a register-resident local | "no write happened" | the watchpoint was set on an address and was hit, or the record is `not-observed` |
| Auto-continue breakpoints | a clean transcript with no stops | plain breakpoints, a stop hook, and a continue budget |
| Address breakpoint without a module | `unresolved, hit count = 0` | `-s MODULE` so the listing address resolves to a load address |
| First command error ends the batch | no `breakpoint list` at the end | `interpreter.stop-command-source-on-error false` |
| Stack-style core read as full memory | `label = ""` reported as the program's value | the core style, the pointer, and the segment it points into |
| Sandboxed shell | "lldb is broken" | `attach failed ((os/kern) invalid address)` recorded as an environment fact |
| Hardened target without `get-task-allow` | "macOS forbids debugging" | the two conditions from Apple's rule, and a re-sign of your own binary |
| Transcript discarded after grading | verdicts with no source | the transcript file, its command line, and the debugger version |

## İşlem Kuralı

Listeden durakları planlayın, bir kez seri modunda çalıştırın, transkripti tutun ve test edebilecek her durakta her statik iddiayı not edin. Sadece bir duraktan onaylanmış veya reddedilmiş yazın, vurma sayıları ve nedeni ile gözlemlenmemiş yazın ve asla çözülmüş bir kırılma noktasının bir koşuda durmasına izin vermeyin. Sadece yaptığınız yapılandırmaları düzeltin.

## Daha Fazla Okumak

- [LLDB Tutorial: command grammar, breakpoints, watchpoints, stop hooks](https://lldb.llvm.org/use/tutorial.html)
- [lldb(1) manual page: --batch, --one-line, --source, --core](https://lldb.llvm.org/man/lldb.html)
- [GDB to LLDB Command Map](https://lldb.llvm.org/use/map.html)
- [LLDB Python Reference: SBTarget, SBFrame, SBValue, and the embedded interpreter](https://lldb.llvm.org/use/python-reference.html)
- [LLDB Caveats: the Python build lldb links against](https://lldb.llvm.org/resources/caveats.html)
- [LLVM 23.1.3 release](https://github.com/llvm/llvm-project/releases/tag/llvmorg-23.1.3)
- [GDB 18.1 release announcement, 2026-09-25](https://sourceware.org/pipermail/gdb-announce/2026/000150.html)
- [GDB manual: Process Record and Replay](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Process-Record-and-Replay.html)
- [GDB manual: Debugging Optimized Code](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Optimized-Code.html)
- [GDB wiki: Permissions on Darwin, code signing a debugger](https://sourceware.org/gdb/wiki/PermissionsDarwin)
- [gdb-patches: Initial AArch64-Darwin support series, October 2025](https://sourceware.org/pipermail/gdb-patches/2025-October/222196.html)
- [Homebrew gdb formula pull request adding arm64 bottles](https://github.com/Homebrew/homebrew-core/pull/209753)
- [ptrace(2), Linux manual page](https://man7.org/linux/man-pages/man2/ptrace.2.html)
- [lldb debugserver MachTask.mm: task_for_pid and task_set_exception_ports](https://github.com/llvm/llvm-project/blob/main/lldb/tools/debugserver/source/MacOSX/MachTask.mm)
- [Intel SDM Volume 2: INT n, INTO, INT3, INT1](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Intel SDM Volume 3: debug registers DR0 to DR7 (Debug, Branch Profile, TSC, and Resource Monitoring Features)](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm A64 ISA: BRK, Breakpoint instruction](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/BRK--Breakpoint-instruction-)
- [Arm A64 ISA: TBZ, Test bit and branch if zero](https://developer.arm.com/documentation/ddi0602/latest/Base-Instructions/TBZ--Test-bit-and-branch-if-zero-)
- [Arm Architecture Reference Manual, D2.9 Watchpoint exceptions](https://developer.arm.com/documentation/ddi0487/latest/)
- [Apple ld(1): -adhoc_codesign](https://keith.github.io/xcode-man-pages/ld.1.html)
- [Apple ld64 LinkEdit.hpp: CS_LINKER_SIGNED](https://github.com/apple-oss-distributions/ld64/blob/59a99ab60399c5e6c49e6945a9e1049c42b71135/src/ld/LinkEdit.hpp)
- [Apple: Debugging Tool Entitlement, com.apple.security.cs.debugger](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.debugger)
- [Apple: Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)
- [Apple: Resolving common notarization issues, the get-task-allow entitlement](https://developer.apple.com/documentation/security/resolving-common-notarization-issues)
- [Apple: Disabling and Enabling System Integrity Protection](https://developer.apple.com/documentation/security/disabling-and-enabling-system-integrity-protection)
- [Apple Developer Forums: debugserver may not get the taskport of a hardened process](https://developer.apple.com/forums/thread/127544)
- [Apple DevToolsSecurity(8)](https://keith.github.io/xcode-man-pages/DevToolsSecurity.8.html)
- [Apple core(5)](https://keith.github.io/xcode-man-pages/core.5.html)
- [Apple Technical Note TN2124: Mac OS X Debugging Magic, core dumps](https://developer.apple.com/library/archive/technotes/tn2124/_index.html)
- [lldb `process save-core` help text](https://github.com/llvm/llvm-project/pull/143126)
- [core(5), Linux manual page](https://man7.org/linux/man-pages/man5/core.5.html)
- [coredumpctl(1)](https://man7.org/linux/man-pages/man1/coredumpctl.1.html)
- [Apple dtrace(1)](https://keith.github.io/xcode-man-pages/dtrace.1.html)
- [Apple dtruss(1m)](https://keith.github.io/xcode-man-pages/dtruss.1m.html)
- [strace releases](https://github.com/strace/strace/releases)
- [ltrace](https://ltrace.org/)
- [bpftrace CHANGELOG](https://github.com/bpftrace/bpftrace/blob/master/CHANGELOG.md)
- [rr project](https://rr-project.org/)
- [rr 5.9.0 release](https://github.com/rr-debugger/rr/releases/tag/5.9.0)
- [rr wiki: Building And Installing, hardware and VM requirements](https://github.com/rr-debugger/rr/wiki/Building-And-Installing)
- [Clang UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)
- [ISO/IEC 9899:2024 working draft N3220, clause 3.5 undefined behavior](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n3220.pdf)
- [DWARF Debugging Information Format Version 5](https://dwarfstd.org/doc/DWARF5.pdf)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64)](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement](https://gitlab.com/x86-psABIs/x86-64-ABI)
