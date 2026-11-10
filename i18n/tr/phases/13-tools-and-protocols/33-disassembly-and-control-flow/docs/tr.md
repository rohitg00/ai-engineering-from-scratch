# Çıkarma ve Kontrol Akışı: Bytes'ten Grafeye Kontrol Edilebilir

> Bir söküm listesi, hangi baytların talimatları olduğu hakkında bir iddiadır ve bu ders, iddiayı kontrol eden dekoderi ve grafik oluşturur.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch)
**Time:** ~150 minutes

## Öğrenme Hedefleri

- Lider ayarlarında x86-64 talimat alt kümesini Intel SDM 2. cilt 2. bölümdeki kurallardan çözün.
- Dekodörü `llvm-objdump -d`Her yapıda bir emir verilir.
- Aynı baytlar üzerinde bir çizgi tarama ve bir geri dönüşlü düşüş yapın ve her birinin nerede yanlış olduğunu açıklayın.
- talimatları temel bloklara ayırıp, kenarları yazılmış bir kontrol akışı grafik oluşturun.
- Cooper, Harvey ve Kennedy'nin tekrarlama algoritması ile hemen hakimleri hesaplayın ve arka kenarlardan döngüleri bulun.
- Meseleye atlayan yer değiştirme girişlerinden dolaylı bir atlamanın hedeflerini geri alın.

## Sorun

- Sen topladın .`ledger.c`- ...`-O0`Bir ajanı ne diye sordu.`grade`Ajan bir monteyici aradı, listeyi okudu ve fonksiyonun sonunda olduğunu söyledi.`jmpq *%rax`Sonra bir tek kodla pseudokod yazdı.`return 0`- Evet .

Aynı şeyi açarsın.`llvm-objdump -d`Bu listede hiçbir şey, nasıl uygulanması onlara ulaşır, bu yüzden araç onları ölü kod olarak görüyor.

Bir liste sadece bir soruya cevap verir: hangi talimat hangi talimat biçiminde baytlar. Hangi talimatların hangi sırada çalışıldığını veya nereden çalışıldığını söylemez.

rea 6.5.0'da kendi parçacığı yok. Derin analiz için, README'nin Ghidra, Hopper veya IDA'yı getirmenizi ister. Çevrimiçi denetim için, rea ayrıca yüklediğiniz bir GNU objdump veya Rizin'i arayabilir. Çağrı grafikleri çözülmemiş hedeflerde durur: "Çalışmalar/Çalışmalar yalnızca çözülmüş fonksiyonları içerir.... Hedefsiz bilgisayar akışı bilinmiyor". Bu ders, bu gerçekleri oluşturan bölümü oluşturur, böylece bir araç bunları rapor ettiğinde onları yargılayabilirsiniz.

```figure
re-33-sweep-vs-descent
```

## Eğitim biçiminde her alan için bir kural vardır

Intel SDM Cild 2, Şekil 2-1 her talimatın bayt sırasını verir. Önce seçmeli önbellekler, sonra bir ila üç opcode byte, sonra seçmeli bir ModRM byte ve seçmeli bir SIB byte. 0, 1, 2 veya 4 byte bir yer değiştirme ardından, hemen sonra 0, 1, 2 veya 4 byte bir yer değiştirme. Tüm talimat en fazla 15 byte (SDM 2.3.11) olacaktır. AMD APM Cilt 3, Bölüm 1, Bölüm 1.1 ila 1.7 aynı biçimi daha az sayfalarda tanımlar ve iyi bir çapraz kontroldür.

Her alan, bir sonraki alanın ne anlama geldiğini belirler. Bu nedenle bir dekodör küçük kararlar zinciridir ve her kararın arkasında el kitabında bir cümle vardır.

### Önceden 4 grupta yer alır.

SDM 2.1.1'de eski önlükler listelenir.`F0`kilitleme ve tekrarlama önlemleri `F2`ve `F3`. Grup 2 altı segmentin üst kısmını tutar (`2E`- Evet .`%cs`) ve dal ipuçları.`66`Grup 4'ün,`67`, adres boyutunun üstesinden gelmek.

Bu nedenle, bu konularda, bir gruptan bir önbölü kullanılabilir.`ledger-x86_64-O0.o`- Yapabilir miyim ?`0xf2`okur `66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00`, beş kopyası`66`Bir sırada.`llvm-objdump`Bu şekilde basıyor .`nopw %cs:(%rax,%rax)`Bu kodlayıcı, gördüğü her bir önbaytı toplayıp hangisinin önemli olduğunu sorar.

`66`SSE talimatları için, opkodu seçen zorunlu bir önlüktür.`66 0f ef c0`- Evet .`pxor %xmm0, %xmm0`16 bit bir şey değil.`F3 0f 6f`- Evet .`movdqu`. Dekodör öncelikle zorunlu önbellek ve ikinci opcode byte çiftini arar.`66`16 bitlik bir operand demek.

### REX dört bit ekler ve opkodun yanında oturmalıdır

SDM 2.2.1 REX 'i bir byte olarak tanımlar .`40`- ...`4F`şekliyle`0100WRXB`- Evet .`W`64 bitlik bir operand seçer. `R`ModRM reg alanını genişletiyor. `X`SIB indeksi alanını genişletiyor. `B`ModRM r/m alanını, SIB taban alanını veya opcode bytesindeki kayıt alanını (Tablo 2-4) genişletir. REX, opcode veya kaçış bytesinden hemen önce gelmelidir ve REX'in ardından eski bir önlük ile izlenmesi ihmal edilir.

İçeri`48 89 e5`byte`48`REX ile `W`- Sınıf.`89`- Evet .`MOV r/m, r`, ve ModRM `e5`seçilir `%rsp`- ...`%rbp`- REX ' i çıkar ve aynı baytlar `movl %esp, %ebp`- Evet .

REX, bayt kayıtlarının isimlerini de değiştirir.`%spl`- Evet .`%bpl`- Evet .`%sil`ve`%dil`yerine`%ah`- Evet .`%ch`- Evet .`%dh`ve`%bh`Dekodör bu nedenle iki masa tutar.

### Opkodlar iki haritada yer alır

Bir baytlı bir opkod yaygın durumdur. `0F`İki baytlı haritaya kaçıyor ve `0F 38`veya `0F 3A`Bu nedenle, bazı opkodlar, ModRM reg alanını üç opkod bit olarak kullanır.`/digit`Bu el kitabında.`83 /7`- Evet .`cmp`8 bitlik bir anlık ile.`83 /5`- Evet .`sub`ve`FF /4`- indirekt`jmp`- Evet .

- Çözücü .`code/main.py`Dört sabit nesneden oluşan kodları ve birkaç komşuyu kapsar.`mov`- Evet .`lea`- Evet .`movslq`- Evet .`movzbl`- Evet .`imul`, vardiyalar,`test`ve`idiv`- Devam ediyor .`push`- Evet .`pop`- Evet .`call`- Evet .`ret`, on altı şartlı sıçrayış, çok baytlı `nop`, ve beş SSE2 opkodu.`DecodeError`Tahmin eden bir dekodör durduğundan daha kötü.

### ModRM ve SIB operandları seçer

SDM 2.1.3 ModRM'yi ikiye bölüyor.`mod`(bits 7:6), `reg`(5:3), ve `r/m`(2:0).`mod = 11`r/m bir kayıt anlamına gelir. `mod = 00`- Evet .`01`ve`10`Değişiklik olmayan ortalama bellek, 8 bitlik bir değişiklik veya 32 bitlik bir değişiklik. `r/m = 100`SIB'nin bir baytı takip ettiği anlamına gelir.`scale`- 7:6'da.`index`(5:3), ve `base`(2:0) ve `100`İndeks kayıtları yok demektir.

Tablo 2-2'deki iki özel satır 64 bit modunda geçer. `mod = 00`- Evet .`r/m = 101`- Hayır .`(%rbp)`. Bir sonraki talimata göre 32 bitlik bir kaydırma (SDM 2.2.1.6). `mod = 00`SIB tabanı ile `101`32 bitlik bir yer değiştirme, temel kayıt yok.

Al .`8d 44 08 fa`-`grade`- ...`-O0`- Opkod .`8D`- Evet .`lea`ModRM `44`- Evet .`01 000 100`: 8 bitlik bir yer değiştirme, reg `%eax`, ve bir SIB takip eder.`08`- Evet .`00 001 000`: ölçek 1, indeks `%rcx`, tabanı `%rax`- Deplacement byte`fa`AT&T'nin metni -6'dır.`leal -0x6(%rax,%rcx), %eax`, hesaplar yapar .`score / 10 - 6`, anahtar indeksini.

### Yer değiştirme, bağlantı editörünün yazdığı yer

`48 8d 0d 00 00 00 00`- Evet .`leaq (%rip), %rcx`Dört sıfır bayt, bir RIP-süre ilişkili operandın yer değiştirme alanıdır.`.rela.text`- Yapabilir miyim ?`0x69`diyor ki`R_X86_64_PC32.rodata-0x4`. PsABI (Tablo 4.9) tanımlar `R_X86_64_PC32`- Evet .`S + A - P`: simge adresi artı eksi alan adresi.

İşlemci, alanı bir sonraki talimatın adresine ekler, böylece son hedef `S + A + (end - P)`Bu yüzden .`lea`Alan son dört bayt, yani `end - P`4 ve hedef `.rodata + (-4) + 4 =.rodata + 0x0`-4'ün eklenmesi bu dört baytı önceden telafi eder.`.rodata+0x10`- ...`-O1` `lea`- Yöntemleri`.rodata+0x14`- Evet .

Dekoder, her talimatın içinde yer değiştirme alanının sıyrılmasını kaydeder. `resolve_reference()`Bu işlevi, dönüşüm tablolarında karşılaştırılan ve operandın bağlantı sonrasında gösterdiği raporlar.`leaq (%rip), %rcx`"Mesa'ya"`.rodata+0x0`" ...bir şey.

### Bir istisna dışında en fazla 32 bit olan anlıklar

SDM 2.2.1.5 64 bit modunda en fazla 32 bit kalıp işaret uzattığı belirtilir.`MOV r64, imm64`(`B8+r`- Evet .`REX.W`), AT&T'nin sözcükleri olarak adlandırılır.`movabsq`. Dekodör 8 bitlik imzayı okuyor.`83 c1 fa`- Evet .`addl $-0x6, %ecx`) ve vardiya sayımları ve karıştırma seçicileri için imzalanmamış olarak (`pshufd $0xee`Bu bölünme neyle eşleşir ?`llvm-objdump`Parmak izleri.

Yakın dallar,`push`ve`pop`64 bit işletim sistemine varsayılan ve görmezden gelen `66`Bu nedenle, dekodörler bu isimleri kullanıyor.`pushq`- Evet .`popq`- Evet .`callq`ve`retq`Operand boyutlu bir önbellek okumadan.

## Bir talimatı elden çözün

Kodu güvenmeden önce, şifreyi çöz.`48 69 c0 67 66 66 66`-`grade`Kağıt üzerinde.

1. `48`İçeride .`40`- ...`4F`, yani REX ile `W = 1`Operand boyutu 64 bit.
2. `69`- Evet .`IMUL r, r/m, imm32`- Evet .
3. `c0`ModRM' dır.`11 000 000`: kayıt formı, reg `%rax`, r/m `%rax`- Evet .
4. Sonraki dört bayt hemen, küçük endian:`0x66666667`- Evet .
5. AT&T siparişi hemen, kaynağı, hedefi: `imulq $0x66666667, %rax, %rax`- Evet .

Bu yedi bayt ve `llvm-objdump`Devamı, klang'ı 10 ile çarpma ile bölünmesine izin veren karşılıklıdır.`sarq $0x22`34'e kaydırılan 34'ün ardından, 34'ün ardından, 34'ün sonunda tekrar bu çiftle karşılaşırsınız.`score / 10`- Evet .

Dekodör bu beş adımı yapar.`Decoder.decode()`- Evet .`_State.modrm()`ve`_State.finish()`. Onları bu sırada okuyun ve her dalı dosya dizisinde adı verilen SDM bölümüne eşleştirin.

## Düzsel Arama

Schwarz, Debray ve Andrews, "Executable Code Revisited" (WCRE 2002) bölümünün 3.1'ünde doğrusal tarama tanımlıyor.`objdump`Bu şekilde çalışır, ve öyle de yapar `llvm-objdump`- Evet .

```python
def linear_sweep(code: bytes, start: int = 0, end: int | None = None) -> SweepResult:
    position = start
    while position < end:
        try:
            instruction = decode(code[:end], position)
        except DecodeError:
            undecodable.append((position, code[position]))
            position += 1
            continue
        instructions.append(instruction)
        position = instruction.end
```

Bu yöntemin bir hata moduna sahip ve bu, kağıtın 1. resminde gösterilmiştir. Veriler olan baytlar talimat olarak çözülür ve dekodör bir süre için gerçek talimat sınırlarını kaçırır. X86'de dekodör genellikle birkaç bayt içinde yeniden senkronize olur, bu da hatayı görmek zorlaştırır. Bu algılama sadece geçersiz bir opkod üzerinde gerçekleşir ve makale sonuçları bu algoritmaların "sessizçe başarısız" olduğu.

Bu ders için de tarama bir oracle.`llvm-objdump -d`Her bir düzenin talimatlarına göre ve`llvm-objdump`Kaydedilen metin, içinde yaşar.`code/fixtures/*.objdump.txt`. Test, her satırı adres, bayt ve metne olarak analiz eder, yorumları `#`Dört nesne 86, 56, 84 ve 11 talimatları içerir, toplamda 237 ve dekodör hepsine eşittir.

## Tekrar Düşüş

Aynı kağıtın 3.2 bölümünde ikinci yöntem rekürsiv geçiş olarak adlandırılır. Bilinen bir giriş noktasından başlayarak kontrol aktarımına kadar kodlamayı başlatın. Doğrudan atlamak için hedefe devam edin. Şartlı bir dal için hem hedefe hem de bir sonraki talimata devam edin, ve bir çağrı için, aradan sonra devam edin, çünkü arayan geri döner. Bir dönüş için durun. Yürüyüşün sona ermesi için ziyaret edilen adresler bir dizi tutun.

```python
if instruction.flow == "branch":
    worklist.append(instruction.target)
    address = instruction.end
elif instruction.flow == "indirect-jump":
    table = resolver(instruction, instructions) if resolver else None
    if table is None:
        unresolved.append(instruction)
        break
```

Başarısızlık modunun tersidir. Doğrudan atlamak bytesinde hedef yoktur. Yürüyüş orada durur ve atlamak yoluyla ulaşılabilecek her blok bilinmez kalır. Kağıtın 2. Şekili ikinci bir tehlikeni gösterir: bir talimatın ortasına işaret eden yer değiştirmelerden elde edilen bir hedef kümesi.`main.py`Bu olayı bir çatışma olarak kaydetir ve bu yolu durdurur. Böylece üst üstelik iki kez sessiz olarak çözülmek yerine, örtüşme görünür.

Andriesse ve diğerleri 981 kompiler tarafından oluşturulan ikili üzerinde dokuz parçacık ölçtüler (USENIX Security 2016). İç hatlı veriler ve üst üste geçiş kodları, literatürün öngördüğü gerçek kompiler çıkışında daha nadirdi ve sert primitif işlev sınırları kurtarma idi. Her iki bulguyu da aklınızda tutun.`grade`Bu çok yaygın.

## Yanlış Yıkış ve Doğru Düşüş Yapılan Bir Çevre

`code/fixtures/sweep-trap.s`Bu, 24 byte el yazılı bir diziyle birlikte işlev bedeninin içinde dört bytelik bir tablo ile oluşur.`movzbl (%rcx,%rax), %eax`ve atlar.

```asm
lookup:
        movslq  %edi, %rax
        leaq    .Ltable(%rip), %rcx
        movzbl  (%rcx,%rax), %eax
        jmp     .Ldone
.Ltable:
        .byte   0x31, 0xc0, 0x90, 0x48
.Ldone:
        addl    $1, %eax
        retq
```

Bunu yapın .`clang -target x86_64-unknown-linux-gnu -c sweep-trap.s`.Dört tablo baytı, doğru talimatlar olarak çözülmesi için seçildi.`31 c0`- Evet .`xorl %eax, %eax`- Evet .`90`- Evet .`nop`- Evet .`48`REX önlüğü, bu yüzden tarama gerçekin üç baytıyla birleşiyor.`addl $1, %eax`ve parmak izi`addq $0x1, %rax`Tutuklananlar .`llvm-objdump`çıkış tam olarak şunu gösteriyor:

```text
       e: eb 04                        	jmp	0x14 <lookup+0x14>
      10: 31 c0                        	xorl	%eax, %eax
      12: 90                           	nop
      13: 48 83 c0 01                  	addq	$0x1, %rax
      17: c3                           	retq
```

Bu listede hiçbir şey kırılmış görünmüyor. her bayt çözüldü, her mnemonik gerçek ve `retq`Bu listede üç yönde yanlış bir şey var.`0xe`hedefler`0x14`, ve listede hiçbir talimat `0x14`- Bu talimatın başında .`0x14`32 bit .`addl`, ve listede 64 bit bir gösterir `addq`Tablo'nun dört baytı kod olarak görünür.

`lookup`Simbol altı talimatı çözüyor, atlamayı takip eder `0x14`ve raporlar `addl $0x1, %eax`Bu tabloda dört bayttan ve sekiz dolgu bayttan hiçbirini iddia etmiyor .`plus_one`- Evet .`trap_report()`İçeride`main.py`karşılaştırmayı basıyor:

```json
"linearSweep": {
  "instructions": 9,
  "atJumpTarget": {"starts": "0x13", "text": "addq\t$0x1, %rax", "startsAtTarget": false},
  "claimedDataBytes": 4,
  "claimedPaddingBytes": 8
},
"recursiveDescent": {
  "instructions": 6,
  "atJumpTarget": "addl\t$0x1, %eax",
  "claimedDataBytes": 0,
  "claimedPaddingBytes": 0
}
```

Test .`test_sweep_and_objdump_share_the_same_mistake`Bunu iddia ediyor.`llvm-objdump`basılı`addq $0x1, %rax`- ...`0x13`Orakel, doğrusal bir tarama ve kör noktasını miras alır.

## Temel Bloklar

Allen, "Control Flow Analysis" (1970) adlı kitapta temel blokları tanımladı. İlk talimatlarında ve sonlarında girilen talimatların bir dizi. Yakdan ve diğerleri bu yöntemi "No More Gotos" (NDSS 2015) bölümünün II.A.2'nde yeniden oluşturdular.

Yapı, kodlanmış talimatların üzerinde iki geçiş taraması, adresle sıralamaktadır. İlk geçiş liderleri toplar. Bir lider giriş, bir dal veya atlama hedefi, bir masa hedefi veya herhangi bir kontrol aktarımından sonra talimatdır. İkinci geçiş, her liderde ve adres dizisindeki her boşlukta yeni bir blok başlatır.

```python
for instruction in self.instructions:
    if instruction.address in leaders or current is None or current.end != instruction.address:
        current = Block(instruction.address, [])
        self.blocks[instruction.address] = current
    current.instructions.append(instruction)
```

Bir dönüşün bir varisi yoktur. Bir sıçrama bir tane, etiketlenmiş `jump`Şartlı bir dalın iki tane var.`taken`ve `fallthrough`Bir blokun sonunda bir basit talimat, bir sonraki blokta gerçekleşir.`table`, ya da hiç, ve blok kaydedildi `unresolved`- Evet .

Aynı tarayıcıdan iki gerçek daha çıktı. Giriş ulaşamadığı bir blok ulaşılmaz ve tarama geçti.`grade`- ...`-O0`Başlangıç adresi başka bir yöntemin listesi talimatına giren bir blok, tuzaktan gelen örtüşme durumudur.

## Toplamın Kontrol-Akış Grafiği

`total`- ...`-O1`31 byte ve 13 talimat:

```text
      40: 85 f6                        	testl	%esi, %esi
      42: 7e 18                        	jle	0x5c <total+0x1c>
      44: 89 f1                        	movl	%esi, %ecx
      46: 31 d2                        	xorl	%edx, %edx
      48: 31 c0                        	xorl	%eax, %eax
      4a: 66 0f 1f 44 00 00            	nopw	(%rax,%rax)
      50: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
      53: 48 ff c2                     	incq	%rdx
      56: 48 39 d1                     	cmpq	%rdx, %rcx
      59: 75 f5                        	jne	0x50 <total+0x10>
      5b: c3                           	retq
      5c: 31 c0                        	xorl	%eax, %eax
      5e: c3                           	retq
```

Liderler `0x40`(Giriş),`0x44`(Şimdiki`jle`), `0x50`(Tamamı:`jne`), `0x5b`(Şimdiki`jne`), ve `0x5c`(Tamamı:`jle`Beş blok, beş kenar:

| From | To | Kind | Why |
|---|---|---|---|
| `0x40` | `0x44` | fallthrough | `jle` not taken, count is positive |
| `0x40` | `0x5c` | taken | count is zero or negative, return 0 |
| `0x44` | `0x50` | fallthrough | the `nopw` is alignment inside the block, execution passes through it |
| `0x50` | `0x50` | taken | `jne 0x50`, the loop |
| `0x50` | `0x5b` | fallthrough | loop exit, return the sum |

Altı baytlı .`nopw`- ...`0x4a`Bu da bir başlıca şey.`0x50`16 baytlık bir sınırda yer alır.`0x44`- Bir bayt .`nop`- ...`0x5f`Sonuncudan sonra.`retq`Bu işlev için altıncı blok oluşturur ve`unreachable()`- Listede.

- Evet .`-O2`Aynı fonksiyon 140 byte ile iki döngü ile.`0x80` ile geçiş başına sekiz değer ekler`paddd`, ve kalıntı kalıntıları `0xc0`CFG'nin iki arka kenarı var.`0x80 -> 0x80`ve `0xc0 -> 0xc0`, ve test süiti her ikisini de kontrol ediyor.

## İteratif Algoritmle Yöneticiler

Bir blok .`d`Bir blokta hakimdir.`b`Girişten `b`Geçer `d`- ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ... ...`b``b`Bu en yakın yer .`b`Bu kavram Prosser (1959) ile Allen (1970) arasında geçer ve bu, ders 34'ün yerleştirmesi gereken yapıdır.`if`ve `while`Doğru.

Cooper, Harvey ve Kennedy "A Simple, Fast Dominance Algorithm" (2001) yazmışlardır. Onlar, kompakt bir temsil ile ters post sırada çalıştırılan veri akışı formülasyonunun yaklaşık bin düğüm altında grafiklerde Lengauer-Tarjan (1979) 'ı yendiğini savunuyorlar. Makalelerinin amacı "yeni bir algoritma sunmak değil" diyor. Basit algoritmaların pratikte kazanabileceğini ve iyi öğretim araçları olduğunu gösterir. Bir CFG fonksiyonunun neredeyse hiç bin düğümü yoktur.

```python
def intersect(first: int, second: int) -> int:
    while first != second:
        while number[first] > number[second]:
            first = idom[first]
        while number[second] > number[first]:
            second = idom[second]
    return first

changed = True
while changed:
    changed = False
    for start in order[1:]:
        processed = [p for p in self.predecessors(start) if p in idom]
        candidate = processed[0]
        for other in processed[1:]:
            candidate = intersect(other, candidate)
        if idom.get(start) != candidate:
            idom[start] = candidate
            changed = True
```

`number`0'da giriş ile her blokun ters sıradan pozisyonunu tutar. `intersect`Kağıt, karşılaşmalarına kadar iki parmağını geçerli dominanto ağaçtan yukarı yürütür.`<`Bu kod ters sipariş sonrası sayıları kullanıyor, bu yüzden karşılaştırma `>`Diğer her şey gazetenin sahte koduna uyar.

- Evet .`total`- ...`-O1`Sonuç şu:`idom(0x44) = 0x40`- Evet .`idom(0x50) = 0x44`- Evet .`idom(0x5b) = 0x50`ve`idom(0x5c) = 0x40`- Kenarlık .`0x50 -> 0x50`Arka kenar, hedefinin kaynağı üzerinde egemenlik gösterdiği için bir arka kenardır (Allen 1970). `back_edges()`Test geri döndürür.`test_dominators_on_a_hand_built_diamond_with_a_loop`16 baytlı bir dizide aynı kodu birleştirme noktasıyla çalıştırır.`intersect`İki öncekini görür.

## -O0'da sınıflandırılmış atlama masası

- Evet .`-O0`clang `switch`İçeride`grade`pozisyon bağımsız atlama masası diline:

```text
      5d: 83 e8 04                     	subl	$0x4, %eax
      60: 77 38                        	ja	0x9a <grade+0x6a>
      62: 48 8b 45 f0                  	movq	-0x10(%rbp), %rax
      66: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000069:  R_X86_64_PC32	.rodata-0x4
      6d: 48 63 04 81                  	movslq	(%rcx,%rax,4), %rax
      71: 48 01 c8                     	addq	%rcx, %rax
      74: ff e0                        	jmpq	*%rax
```

Dört gerçek olarak okuyun.`subl $0x4`Ardından `ja`sınır kontrolü: 4'ten yüksek indeksler varsayılan durumuna geçer `0x9a`Bu yüzden masada beş giriş var.`leaq`yer değiştirmesiyle birlikte tablo adresini `%rcx`, ve önceki bölümde adresin gösterildiği `.rodata+0x0`- Ne ?`movslq`imzalanmış 32 bit giriş yükler.`addq`tablo tabanını ekler, böylece her giriş, tabloyla kapı blokuna arasındaki mesafedir.

Nesne dosyasında her tablo bytesinin değeri sıfırdır.`.rela.rodata`- ...

```text
RELOCATION RECORDS FOR [.rodata]:
OFFSET           TYPE                     VALUE
0000000000000000 R_X86_64_PC32            .text+0x91
0000000000000004 R_X86_64_PC32            .text+0x8c
0000000000000008 R_X86_64_PC32            .text+0x87
000000000000000c R_X86_64_PC32            .text+0x82
0000000000000010 R_X86_64_PC32            .text+0x86
```

Uygula`S + A - P`Giriş için`k`- Yapabilir miyim ?`4k`Kaydedilen değer `.text + A - (.rodata + 4k)`, ve kod ekliyor `.rodata + 0`- Ama hedef...`.text + A - 4k`Giriş 0 `0x91 - 0 = 0x91`, giriş 1 `0x8c - 4 = 0x88`, ve giriş 2 `0x87 - 8 = 0x7f`3. ve 4. bölümler `0x82 - 12 = 0x76`ve `0x86 - 16 = 0x76`- 6, 7, 8, 9 ve 10 olayları`score / 10`1, 2, 3, 4 ve 4'ü depolayan bloklara gidin. Bu, 9 ve 10 için paylaşılan hücre dahil olmak üzere, C kaynağı hattı için bir çizgi eşleşir.

`recover_table()`Bu hesaplama yapar.`jump_table_resolver()`İdiomla tersine eşleşir.`jmpq`- Bu , `addq`Bu kayıtta,`movslq`Bu yüklenmiş, `leaq`Bu da temel ve sınırları oluşturdu.`ja`. Aşağı düşüş daha sonra dört farklı hedefi zorlar ve devam eder. Bağlı bir yürütülebilir tablonun son değerlerine sahiptir ve yer değiştirilmez. Aynı işlev daha sonra imzalanan 32 bit girişleri okuyor ve tablo adresini ekler ve `evidence`hedeflerin hangi yolla ortaya çıktığını kaydetir.

 için numaralar`grade`- ...`-O0`, `python3 code/main.py cfg code/fixtures/ledger-x86_64-O0.o grade`- ...

| Method | Instructions | Blocks | Edges | Bytes | What is wrong |
|---|---|---|---|---|---|
| linear sweep | 34 | 9 | 7 | 118 code + 10 padding | 5 unreachable blocks, no edge into the four case blocks, padding decoded as `nopw` |
| recursive descent | 25 | 3 | 2 | 82 code | 36 code bytes never reached, `jmpq *%rax` at `0x74` unresolved |
| descent with the table | 33 | 8 | 11 | 118 code | nothing |

Masada, egemenlik ağacı tamamlanmıştır.`idom`Her bir dava blokunun `0x62`, atlama ile blok.`idom``0xa1`Giriş .`0x30`, çünkü `0x9a`ulaşır `0xa1`Geçmeden `0x62`- Evet .

## Optimizer -O1 değerini nasıl değerlendirdi ?

Görürsün .`grade`Bu bir düğme olarak tanımlanır ve bir atlama tablosuna birleştirir.`-O1`ve `-O2`İçeri indirek atlama yok.`grade`Hiç değilse:

```text
      2c: 83 f9 04                     	cmpl	$0x4, %ecx
      2f: 77 0c                        	ja	0x3d <grade+0x2d>
      31: 89 c8                        	movl	%ecx, %eax
      33: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		0000000000000036:  R_X86_64_PC32	.rodata+0x10
      3a: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      3d: c3                           	retq
```

Yer değiştirme eklemesi`0x10`+ 4 ' ü sıralama masayı `.rodata+0x14`- Yük düz bir yer .`movl`, ve orada bulunan baytlar `01 00 00 00 02 00 00 00 03 00 00 00 04 00 00 00 04 00 00 00`. Kompilatör beş durum bloklarını beş geri dönüş değerlerinin bir tablosu ile değiştirdi. Yer değiştirme, bir tablo ve sınır kontrolü vardır. Kontrol akışı üç blok ve üç kenar, bir koşullu dal ile oluşur. `find_value_tables()`Raporları bir `value-table`Notlar ile birlikte`[1, 2, 3, 4, 4]`ve `evidence: "bytes"`- Evet .

`grade_label`- ...`-O2`Bir adım daha ileriye gidiyor.`labels`5 string pointers array'i 5 32-bit offset tablosu haline getirdi.`.rodata+0x0`Her giriş bir `R_X86_64_PC32`İpuç bölümüne karşı yer değiştirme ve işlev yüklediği girişine tablo adresi ekler. `recover_table()`Bu beş yer değiştirme ve geri dönüş karşılığı .`0, 2, 4, 6, 8`- ...`.rodata.str1.1`, ki tutulur .`F`- Evet .`D`- Evet .`C`- Evet .`B`ve`A`. Aynı aritmetik bir atlama tablosunu geri alan bir nispeten veri tablosunu geri alan, çünkü her ikisi de `S + A - P`Bilinen bir ödülden.

Bu iki yapıtan alınan ders, bytes'in gösterdiği şeyi adlandırmaktır. Bir atlama tablosu kontrol akışı grafiğini değiştirir. Bir değer tablosu yükü değiştirir. Her ikisini de "açıştırıcı" olarak adlandırmak, ders 34'ün yeniden yapılandırması gereken farkı gizler.

## Rea ve Ghidra'nın sana verdiği şey

rea 6.5.0 ile Ghidra 12.1.4 sağlayıcısı bir fonksiyonun listelenme metnini gönderir `procedure_assembly`Bir ip gibi.`inspect_native_instruction`bir talimatın bytesini, uzunluğunu, dekodör metnini, operand işaretlerini, yazılmış referansları ve akışını gönderir, geri dönüş p-koddan sınıflandırılır. `xrefs`Ghidra'nın sıralanmış eşsiz kaynak adreslerini gönderir `ReferenceManager.getReferencesTo`- Evet .`analyze_function`CFG'yi taşıyor ve `body`Bu fonksiyonun.`procedure_info`"Kaflar ve ortak kuyruqlar, sahip olduğu baytlar olarak değerlendirilmemelidir" diye uyarıyor.

Bu gerçeklerin her biri Ghidra'nın geri dönüşlü kökenliliği ve analizleri ile serileştirilmiştir.`instruction_flow_evidence`- Evet .`function_references`ve`jump_table_evidence`Bu nedenle bir sonuç, onu üreten kuralları belirler. Yapamadığı şey, çalışmalarını göstermektir. Ghidra tablosunu bulamadığında akış "bilinmez" ve aramacılardan, çağrılardan ve CFG'den durum blokları eksik olur.

Artık işin var.`python3 code/main.py cfg`Bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, ve bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, bu sayede, eğer, bu sayede, bu sayede, bu sayede, eğer, bu sayede, eğer, bu sayede, eğer, bu sayede, eğer, bu sayede, eğer, eğer, bu sayede, eğer, eğer, bu sayede, eğer, eğer, eğer bu sayede, eğer, eğer, eğer, eğer, eğer, eğer, bu sayede, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, varsa, eğer, eğer, eğer, eğer, eğer, eğer, eğer, varsa, eğer, eğer, eğer, eğer, eğer, eğer, varsa, eğer, eğer, eğer, eğer, eğer, eğer, eğer, varsa, varsa, eğer, eğer, varsa, eğer, eğer, eğer, varsa, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, eğer, varsa, varsa, eğer, varsa, eğer, eğer, varsa, eğer, eğer, eğer,

Bir program olarak dekodör üzerinde bir not. Capstone 6.0.0-Alpha10 (2026-07-21) sınır dışı sabit okuma ve yazma CVE-2026-55893 ve CVE-2026-55894 altında ve 5.0.9 (2026-05-28) arka planlı CVE ayarları altında yazılır. Bir dekodör yazmadığı baytları okuyor. 15 bayt sınır, kesim kontrolü `_Cursor.byte()`, ve bilinmeyen bir opkod koruma tahmin etmeyi reddetmek .`main.py`Bu yüzden yapılmamış.

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu. Her sabit nesne için oracle anlaşması verir. Her işlev için üç yöntem altında talimat, blok ve kenar sayıları verir. Ayrıca erişilemez blokları, çözülmemiş dolaylı sıçrayışları, arka kenarları, hemen egemenleri ve herhangi bir tabloyu listeler. Tuzak karşılaştırması ile sona erer.

Beklenen şekil:

```json
{
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "oracle": "86/86 instructions agree with llvm-objdump",
      "functions": {
        "grade": {
          "range": "0x30-0xa6",
          "paddingBytes": 10,
          "linearSweep": {"instructions": 34, "blocks": 9, "edges": 7, "unreachableBlocks": ["0x76", "0x7f", "0x88", "0x91", "0xa6"], "...": "..."},
          "recursiveDescent": {"instructions": 25, "blocks": 3, "edges": 2, "unresolvedIndirectJumps": ["0x74"], "...": "..."},
          "recursiveDescentWithTables": {"instructions": 33, "blocks": 8, "edges": 11, "...": "..."},
          "tables": [{"kind": "jump-table", "table": ".rodata+0x0", "count": 5, "entries": ["0x91", "0x88", "0x7f", "0x76", "0x76"], "evidence": "relocation", "...": "..."}]
        }
      }
    }
  },
  "sweepTrap": {"...": "..."}
}
```

Oku `code/main.py`Bu sırada:

1. `ElfObject`bölüm başlıklarını, sembollerini ve `.rela.*`girişler ve `symbolize()`Yolun bir adresini belirler.`llvm-objdump`- Evet.
2. `Decoder.decode()`Öntanımları ve REX'i okuyor, sonra bir ya da iki baytlı opkod haritasına gönderir.
3. `_State.modrm()`ModRM, SIB ve yer değiştirme kaydını okuyor ve yer değiştirme alanının gidermesini kaydeder.
4. `resolve_reference()`uygulanır .`S + A - P`Yer değiştirme veya yakın bir alanda yer değiştirme.
5. `linear_sweep()`ve `recursive_descent()`Her iki yöntemin başarısızlığı kaydedilmiştir.
6. `recover_table()`ve `jump_table_resolver()`Bir tabloyu yer değiştirmeleri veya baytları ile okuyun.
7. `ControlFlowGraph`liderler, bloklar ve tiplenmiş kenarlar oluşturur ve `dominators()`Bu iteratif algoritma.
8. `analyze_function()`her yöntemi tek bir fonksiyonla çalışır ve `compare_with_oracle()`Dekodörü kontrol eder.

İki emir daha var.`python3 code/main.py disasm FILE.o`Her talimatın ardından yer değiştirme hedefi ile bir liste basar. `python3 code/main.py cfg FILE.o FUNCTION`Bir fonksiyonun analizini basar.

## Kullan

Yeni bir nesne için bu sırada üç yöntemi kullanın.

1. Önce oracle karşılaştırmasını yap.`llvm-objdump`Bir basit talimatın bir hata olduğu ve sonraki tüm yapıların ona miras aldığı bir hata olduğu.
2. Her fonksiyon simgesinden geri dönüşlü düşüşü çalıştırın ve okuyun `unresolved`Her giriş, hedeflerinizin olmadığı bir indirek atlama veya çağrıdır.
3. Her atlama için, masa dilini ve ona işaret eden yer değiştirmeyi araştırın. Eğer dil eşleşmezse, atlamadan önce baytları okuyun ve gördüğünüzü notu yazın.
4. Arama ve düşüş baytını bayt ile karşılaştırın. Sadece arama iddiaları olan baytlar doldurma veya veri. Hiçbir iddiaları erişilemez olan veya bulunmadığı bir fonksiyona ait olan baytlar.
5. CFG'yi geri alınan tablolarla aşağıdan inşa edin ve arka kenarları okuyun.`while`veya `for`- Evet .

Orakel metin dosyalarını nesnelerle birlikte tutun. Yeni bir kompiliç versiyonuna geçtiğinizde, onları yeniden yakalayın, çünkü değiştirilmiş bir liste değişmiş bir konudur.

## İnteraktif Laboratuvar

### Laboratuvar A: Kağıt üzerinde çözünür, sonra kontrol edin.

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow/code
python3 -q
```

Çık:

```python
from main import *
decode(bytes.fromhex("48 8d 0d 00 00 00 00"), 0).text
decode(bytes.fromhex("8d 44 08 fa"), 0).text
decode(bytes.fromhex("66 66 66 66 66 2e 0f 1f 84 00 00 00 00 00"), 0).length
```

Her çağrıdan önce beklediğini yaz ve sonra `48`İlkinden sonra operand boyutunun değişmesini izle.`decode(bytes.fromhex("0f 0a"), 0)`Ve oku `DecodeError`- Evet .

### Laboratuvar B: bir yerleşim

```python
elf = load_fixture("ledger-x86_64-O0.o")
code = elf.section(".text").data
lea = decode(code, 0x66)
lea.displacement_offset
resolve_reference(elf, lea)
```

Referans şöyle diyor:`.rodata+0x0`Adresini değiştir .`0x116`İçeride`grade_label`ve referansı okuyun.`.data`- Sonra da `callq`- ...`0x10e`Hemen alanın taşıdığı`R_X86_64_PLT32 grade-0x4`, ve çözülen hedef `0x30`, yani `grade`- Evet .

### Laboratuvar C: iki yöntemin anlaşmazlığını izle

```python
trap = load_fixture("sweep-trap.o")
text = trap.section(".text").data
[i.text for i in linear_sweep(text, 0, 0x20).instructions]
[i.text for i in recursive_descent(text, [0], 0x20).sorted_instructions()]
```

Her listede talimatları say ve başlayanı bul `0x13`Sonra son tablo baytını `sweep-trap.s`-`0x48`- ...`0xe8`Bu da bir daha çalıştırmak için.`addl`ve `retq`bir `callq`Bu işlev geri dönüşü görmediği gibi görünüyor.

### Laboratuvar D: el ile dominanter

```python
analysis = analyze_function(load_fixture("ledger-x86_64-O1.o"), "total")
analysis.cfg.edges
analysis.cfg.reverse_postorder()
analysis.cfg.dominators()
analysis.cfg.back_edges()
```

Beş blok üzerinde çiz ve sonuçlara bakmadan önce dominanterleri hesapla.`grade`- ...`-O0`Nedenini açıkla.`idom(0xa1)`- Evet .`0x30`Ve hayır .`0x62`- Evet .

## Pratik Laboratuvar

Aydınlıklara dolaylı bir çağrı sitesi ekle ve analizi genişlet.

Gereksinimler:

- Küçük bir diziden seçilen bir fonksiyon göstergesi üzerinden çağrı yapan bir C fonksiyonu yazın.`-O0`ve `-O1`Ve nesneleri kendileriyle bağlayın.`llvm-objdump`Mesaj.
- Bu iki nesne üzerinde de kodlayıcıyı oracle ile uyumlu hale getirir.
- Uzaklaştırma`recursive_descent()`Yani indirek bir arama arama sitesi kayıtları `calls`- Evet .`None`Hedef olarak ve sonra devam eder.
- Fonksiyon gösterge dizisini yer değiştirmeleri üzerinden okuyan ve olası calleleri rapor eden bir çözücü yazın.
- Fonksiyon raporuna callle ayarını  olarak ekleyin.`indirectCalls`Her hedef için kanıt türü ile.
- Çözücü, bir işlev simgesi olmayan bir hedefi döndürdüğünde başarısız olan bir test yazın.

Başarılı olmak demektir .`python3 code/main.py cfg`Her olası kişiye, bunu kanıtlayan yer değiştirme ile birlikte isimler verir ve oracle karşılaştırması her nesneyi hala geçerli kılar.

## Sınıflandırılmış Laboratuvar

Bu dersin ayarları hakkında beş soru.`code/lab_answers.json`. Sayıları sayılar olarak ya da  gibi altıbuçluk ipler olarak yaz .`"0x40"`, ve listeler JSON listeleri olarak.

1. `t1`: -O1 derecesinde rekürsiv düşüşü çözme talimatları.
2. `t2`: -O1'de toplamda temel bloklar.
3. `t3`: -O1'de toplamda döngü başlığı adresini hex olarak.
4. `t4`: sweep-trap.o'da, 0x14'i kapsayan çizgisi temizleme talimatının başlandığı adres, altı boyutlu olarak.
5. `t5`-O0'daki atlama tablounda yer alan yerler.

Cevaplarınızı kontrol edin:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/lab.py
npx tsx code/lab.ts
```

Kontrolcü , her beklenen değerini `code/main.py`- Bu, yazılı.`PASS`- Evet .`FAIL`veya `TODO`Her görev ve puan için, ve sadece beşinin geçtiği zaman 0'dan çıkıyor. `python3 code/lab.py my-answers.json`Başka bir dosyayı kontrol ediyor.`code/tests/test_lab.py`kontrol eden kişinin doğru cevapları kabul ettiğini ve yanlışını reddettiğini kanıtlar.

### Çıkıyor gör .

- Evet .[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?program=trap&sweep=linear)Makine bu dersi, kodlama tahtası ve blok tahtası olarak çalıştırır.`sweep-trap.o`Düzsel tarama ile: yatak, dört veri baytını kod olarak çözmüş ve bir pin atlama hedefini işaretler.`0x14`İçinde`addq`- ...`0x13`Decodaları geri dönüşlü düşüşe çevirin.

## Ders Artifakti

Bu ders de içerir .`outputs/skill-disassembly-and-control-flow.md`Bir nesne ve bir fonksiyon adını kontrol edilmiş bir liste, bloklar, yazılmış kenarlar, dominanterler ve her çözülmemiş aktarım haline getirmek için kullanın.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/33-disassembly-and-control-flow
python3 code/main.py
npx tsx code/main.ts
python3 code/tests/test_main.py
```

Verifikasyon, şunu kanıtlamalıdır:

- Dekodör kabul ediyor .`llvm-objdump -d`Dört sabitleme nesnesinin tüm 237 talimatında
- REX.W 64 bit operandları seçer ve REX.R ve REX.B kayıt alanlarını genişletiyor
- ModRM ve SIB, ölçek, indeks ve imzalanan yer değiştirme dahil AT&T hafıza operandını gösterir
- RIP'ye göre bir yer değiştirme, talimatın içinde alan sıfırlaması ile kaydedilmiştir.
- Tekrarlanan eski öntanımlar ve bir bölüm üstü dekodör gibi oracle
- İhtiyaclı bir`66`Önbellek SSE opkodunu seçer ve 32 bitlik kayıtları bırakır
- 8-bit yakınları aritmetik için işaret uzanır ve saat sayımları için işaretsiz
- 15 byte üzerinde bir talimat, kısaltılmış bir talimat ve bilinmeyen bir opcode yükseltmesi `DecodeError`
- `R_X86_64_PC32`Bir .`lea`Bu konuda bir karar verildi.`R_X86_64_PLT32`Bir .`call`- Evet. - Evet.
- Tarama, tuzak masasını kod olarak çözüyor ve atlama hedefi hakkında hiçbir talimat yok.
- Düşüş hiç masa veya yastık için talep etmez ve okuyor `addl $0x1, %eax`Hedef
- `llvm-objdump`Tuzakta yapılan aramakla aynı hatayı yapar.
- Bir talimatın içindeki bir giriş çatışma olarak kaydedilmiştir.
- çözülmemiş bir dolaylı sıçrayış düşüşü durdurur ve listelenir
- `total`- ...`-O1`Beş blok, beş tiplenmiş kenar, bir arka kenar ve beklenen hemen üstteki baskıcılar
- Bir döngü ile el yapımı bir elmas, algoritma tarafından tanımlanan baskıcıları verir.
- `total`- ...`-O2`İki döngü
- `grade`- ...`-O0`5 girişli bir atlama masası verir `.rela.rodata`Hedeflerle`0x91, 0x88, 0x7f, 0x76, 0x76`
- Masası olmadan.`grade`- ...`-O0`Üç blok ve bir atlama.
- `grade`- ...`-O1`ve `-O2`değer tablosu `[1, 2, 3, 4, 4]`dolaylı atlama olmadan
- `grade_label`- ...`-O2`5 yer değiştirme ile ilgili bir dizilme tablosunu okuyor
- İnteraktif rakam analizle elde edilen aynı verileri içerir.

## Üretim Başarısızlık Modları

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Data inside `.text` | A plausible listing with every byte decoded | The descent claims no data byte and the jump target starts an instruction |
| Padding after the last return | A `nopw` instruction at the end of the function | The bytes are unreachable from the entry |
| Indirect jump through a table | "jmp rax" and four dead blocks | Table address from the `lea` relocation, entry count from the bounds check, targets from `.rela.rodata` |
| Switch turned into a value table | "a jump table with a relocation" | A `movl` load from `.rodata+0x14`, three blocks, no indirect transfer |
| Call with a zero displacement | `callq 0x113`, the next instruction | `R_X86_64_PLT32 grade-0x4` resolves to `0x30` |
| Decoder guesses an unknown opcode | A mnemonic that looks right | `DecodeError` with the address, and the sweep records the byte |
| Instruction longer than 15 bytes | A very long "instruction" | The cursor raises before reading byte 16 |
| Branch into the middle of an instruction | Two overlapping listings | A conflict record with both addresses |
| Loop reported as straight-line code | No `while` in the pseudocode | A back edge whose target dominates its source |
| Oracle captured from a different compiler | Tests pass on stale text | The fixture README names the exact compiler and command |

## İşlem Kuralı

Bir oracle ile kodlama, bilinen girişlerden yürüyüş kontrol akışı ve her baytın iddia edilen, doldurma, veriler veya erişilemez olduğu hesaplama. Yer değiştirdiğiniz bir yerden veya gösterebileceğiniz bir tablodan her dolaylı hedefi kurtarın. Geri kalanı bilinmeyen olarak adresle kaydetin.

## Daha Fazla Okumak

- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, Chapter 2: Instruction Format](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [AMD64 Architecture Programmer's Manual Volume 3, Chapter 1: Instruction Encoding](https://docs.amd.com/v/u/en-US/24594_3.38_APM_Vol3_PUB)
- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Table 4.9: Relocation Types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Schwarz, Debray, Andrews, "Disassembly of Executable Code Revisited" (WCRE 2002)](https://www2.cs.arizona.edu/~debray/Publications/disasm.pdf)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Allen, "Control Flow Analysis" (1970)](https://doi.org/10.1145/800028.808479)
- [Cooper, Harvey, Kennedy, "A Simple, Fast Dominance Algorithm" (2001)](https://www.cs.tufts.edu/~nr/cs257/archive/keith-cooper/dom14.pdf)
- [Lengauer, Tarjan, "A fast algorithm for finding dominators in a flowgraph" (1979)](https://doi.org/10.1145/357062.357071)
- [Capstone 6.0.0-Alpha10 release notes](https://github.com/capstone-engine/capstone/releases/tag/6.0.0-Alpha10)
- rea 6.5.0 kaynağı tag `3b79af2`Bu ders şöyle anlatıyor:`README.md`- Evet .`docs/ghidra-provider.md`- Evet .`docs/ghidra-dos.md`- Evet .`docs/reverse-engineering-tools.md`- Evet .`bridge/ghidra/ReaGhidraBridge.java`- Evet .`src/contracts/officialToolContracts.ts`- Evet .`src/ghidra/GhidraAnalysisProfile.ts`- Evet .
