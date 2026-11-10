# Yükleyici İdyoları: Optimize Kodunuza Ne Yarar Verir ve Nasıl Okulur

> Optimize eden bir kompiliyatör kaynak yapılarını daha ucuz talimat şekillerle değiştirir. Her şeklin bir türevine sahiptir ve bu ders türevini geriye doğru çalıştıran ve kaynağa karşı kontrol eden tanıtıcı oluşturur.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, AArch64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode), Phase 13 · 38 (calling conventions)
**Time:** ~150 minutes

## Öğrenme Hedefleri

- Sihirli sayıyı çıkarın ve Granlund-Montgomery sınırlı herhangi bir sabitle bölünmek için kaydırın ve bölücüyi yayılan sabitler clang'dan geri alın.
- LLVM ' in bir oranı düşürmesinin beş yolunu belirleyin .`switch`ve giriş sayısını, tablo konumunu ve nesnenin girişlerini okuyun.
- Bir vektörlü döngü, şerid, akumülatör, her iterasyon başına element, üçlü sayım maskası, azaltma ve kalan döngü olarak okuyun.
- Kuyruk çağrılarını, içe çizilen çağrıları, dalsız seçimler ve çevrilen döngüleri tanın.`memset`veya `memcpy`- Evet .
- Her dilde kanıt talimatları ve çözülmüş kaynak formunu x86-64 ve AArch64 adresinde bildirin.`-O0`- Evet .`-O3`- Evet .
- Sonuçları Ghidra, Angr, radar2, rizin ve lldb'nin aynı baytlar için gösterdiği ile karşılaştırın.

## Sorun

- Sen topladın .`idioms.c`- ...`-O2`Bir ajanı ne diye sordu.`div7u`Ajan okudu.`imulq $0x24924925, %rax, %rax`Bu da bir işlev olarak görülebilir.`x / 7`- Evet .

Aynı nesne bir `switch`Yedi olayla birlikte hiç atlama yapmayan bir `switch`5 adet bir atlama masası olan bir kasa ile.`switch`İki durumda bu bir `sete`ve bir `cmovne`, ve bir döngü geç .`n`İki iterasyonda sekiz tam sayı çalıştıran tam sayı `xmm`Kayıtlar ve sonra kalanı ikinci bir döngüde bitirir.`-O0`Aynı kaynaktan üretildi `divl`, yedi giriş atlama masası ve bir skalar döngü.`-O1`Yedi-kayı anahtar değerler tablosuna dönüştü ve vektör döngüsü henüz yoktu.

Bu şekiller, dil biçimleri. Bir yazıcı her birini kaynağında okuyabileceğiniz bir kuraldan yayar ve her biri geldiği yapılara geri dekode edilebilir. Dekodeleme aritmetiktir ve aritmetik kontrol edilebilir. Ders 34 bunlardan biri olduğunu kanıtladı, çarpma `0x66666667`Bu ders, hepsinin tanıtıcısını oluşturur, kendi kodumuzun 18 versiyonunu çalıştırır ve C kaynağına karşı tüm 373 raporunu doğruluyor.

```figure
re-39-idioms-by-level
```

## Bir İdyon, Bir Kökeniyle Bir Şekildir

Bir dil, bir kaynak yapısı için kompiliör tarafından gönderilen talimatların bir dizilidir. Üç şey onu tanıma olanağı sağlar.

Tanımlayıcı .`code/main.py``llvm-objdump -d -r`Bu, her fonksiyonu adres, bayt, mnemonik, operand ve ardından gelen yerleştirme hattı ile talimatlara ayırır.`.rodata`, değer tablolarının yaşadığı yer ve `.rela.rodata`bağlantı kurmadan önce atlama masası hedeflerinin yaşadığı yerler.

Her tespit bir `Idiom`bir kayıt ile`kind`, bir kodlanmış .`source`form, listesi `evidence`adresleri, a `detail`Sözlük ve bir `verified`Bayrak C kaynağından geliyor.`parse_source()`okur `idioms.c`, her fonksiyonu bulur ve bölücüleri sonra çıkarır `/`ve `%`,  sonrası katılayıcıları`*`, `switch`Bu durumlar ve değerleri,`? :`İşçiler,`for`bir bölme idiomu, bölme listesinde bölücü olduğu zaman doğrulanır. bir arama tablosu, girişleri durum değerlerine eşleşince, sabit bir faktöre kadar doğrulanır. bir kuyruğu çağrı, kaynağa çağrıldığında doğrulanır. demo raporu bir  ile sona erer`unverified`listesi, test süiti ise listeyi tüm 18 yapı için boş olduğunu belirtir.

Çözümleme isimlere ihtiyaç duyar. Tanımlayıcı, her fonksiyonun temel blokları üzerinde küçük bir sembolik değerlendirici çalıştırır.`-O0`Bu nedenle, bu kodun bir blok girişinde, önceki durumların birleşmesi ve farklı olduğu bir yerde, daha önceki bir dilin sabitden üstün olduğu bir isim vardır.`cmovll %edx, %eax`İçeride`digest`Bu da şöyle:`sum % 10 < 5 ? sum % 10 : 5`: bir kemer idiomu olarak akumulatörü adlandırıldı `sum`, bölme dilinin özelliği .`sum / 10`, ve modulo idiomu sonucu adını verdi .`sum % 10`Kaynak yazar .`rem > 5 ? 5 : rem`Her iki ifade de küçük olanı verir .`rem`Ve 5 ve onlar da aynı fikirde.`rem == 5`- Evet .

## Bir Sürekli tarafından Bölünme

Granlund ve Montgomery, "Küpleme kullanarak değişmez tam sayılarla bölünme" (PLDI 1994), yerine `n / d`Bir çarpma ve bir vardiya ile.`s`ve bir katılayıcı.`m = ceil(2^s / d)`- O zaman ...`floor(n * m / 2^s)`eşit `floor(n / d)`Her biri için .`n`Hatası olduğunda aralığında `e = m * d - 2^s`İmzalamamış 32-bit için yeterli.`n`Sınır `e <= 2^(s - 32)`İmza için .`n`- Evet .`|n| < 2^31`Sınır `e <= 2^(s - 31)`, ve bir işaret düzeltme 1 ekler.`n`negatifdir, çünkü zemin negatif oranlar için yanlış yönde yuvarlanır.

`magic_numbers(d, bits, signed)`İçeride`main.py`Aramalar `s`Bu arama, cihazlarda yayılan her sabit sesini yeniden üretir.

### El ile imzalı 10

`2^35 / 10 = 3435973836.8`Tavanın üstünde.`3435973837 = 0xCCCCCCCD`Hata şu .`0xCCCCCCCD * 10 - 2^35 = 2`, ve bağlanmış `s = 35`- Evet .`2^3 = 8`- Ne ?`s = 34`Bu da en küçük değişimdir.`n = 123`- Evet .`123 * 3435973837 = 422624781951`ve`422624781951 >> 35 = 12`- Evet .

Clang tam olarak bunun için yayıyor.`div10u`- ...`-O2`x86-64'te:

```text
       0: 89 f9                        	movl	%edi, %ecx
       2: b8 cd cc cc cc               	movl	$0xcccccccd, %eax
       7: 48 0f af c1                  	imulq	%rcx, %rax
       b: 48 c1 e8 23                  	shrq	$0x23, %rax
```

`0x23`35'e eşit.`movl %edi, %ecx`0'da 32 bit argümanı 64 bit bir kayıtlıya uzatır.`movl $imm`İki operandı besleyen.`imulq`, vardiyanı okuyor ve arıyor `divisor_from_magic(0xCCCCCCCD, 35)`Bu işlev dener.`2^35 // m = 10`ve 11 ve 10 kabul eder çünkü`magic_numbers(10)`Aynı katlayıcıyı verir ve geriye döner.

AArch64 ' te aynı fonksiyon `mov w8, #0xcccd; movk w8, #0xcccc, lsl #16; umull x8, w0, w8; lsr x0, x8, #35`Devrim 16 bit iki yarıda gelir, çarpı `umull`Tanıdıcı yarıları bir araya getirir ve aynı bölücüyi rapor eder.

### Elle imzalanmamış 7 ekleme ile

`2^35 / 7 = 4908534052.57`Tavanın üstünde.`4908534053 = 0x124924925`Bu da 32 bit çarpımını tutar. Bu da 32 bit çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpımı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarp`0x24924925`ve dividendi sabit bir sırada geri ekler:

```text
      32: 48 69 c0 25 49 92 24         	imulq	$0x24924925, %rax, %rax
      39: 48 c1 e8 20                  	shrq	$0x20, %rax
      3d: 29 c7                        	subl	%eax, %edi
      3f: d1 ef                        	shrl	%edi
      41: 01 f8                        	addl	%edi, %eax
      43: c1 e8 02                     	shrl	$0x2, %eax
```

Okuyun .`t = (n * 0x24924925) >> 32`O zaman ...`q = (((n - t) >> 1) + t) >> 2`Toplam değişim `32 + 1 + 2 = 35`- Evet .`n = 100`- Evet .`t = 14`- Evet .`(100 - 14) >> 1 = 43`- Evet .`43 + 14 = 57`- Evet .`57 >> 2 = 14`Tanımlayıcı `sub`- Evet .`shr`- Evet .`add`- Evet .`shr`32 bitlik bir vardiyanın ardından kuyruğu ekliyor `2^32`- 7'e geri dönüp tekrar çıkıyor.`evaluate_division()`Bu sırayı kullanır ve test onu kontrol eder.`n // 7`32 bit kenar değerlerinde.`sub w9, w0, w8; add w8, w8, w9, lsr #1; lsr w0, w8, #2`, bir talimat daha kısa çünkü kaydırılan ekleme bir talimat.

### El ile imzalanmış 3

`2^32 / 3 = 1431655765.33`, tavan`1431655766 = 0x55555556`, hata 2 ve imzalanmış bağlama `s = 32`- Evet .`2^1 = 2`- Sınır boşlukta kalıyor, bu yüzden 32'ye varır ve clang kullanır.`shrq $0x20`- Evet .`n = -7`: ürün `-10021590362`, 32 ' lerin aritmetik değişimi verir `-3`, işaret bit ayarlandı, böylece düzeltme 1 ekliyor ve sonuç `-2`, yani `-7 / 3`C. İmzalanmış armatürler `div10s`ve `div3s`İkisi de tamirleri taşıyor.`shrq $0x3f`Ürünün bir kopyasında, ardından `addl`- Evet .

### Devamlar ne değildir

Tek başına katılımcı bir bölücü tanımlamıyor.`0x66666667`34'ün değişimi ile 10'dur. Aynı çarpıcı 33'ün değişimiyle 5'dür.`clangMatchesAlgorithm`Arama sırasında çiftin üretildiği alan kayıtları.`magic_numbers()`Bu yüzden, bu programı reddediyor. Çünkü, kompiliör, bunun yerine bir işaret kaydıyla bir değişim yayıyor.`mod8s`Bu şekli sonraki bölümde gösterir.

### İdiom talimat seçeneğine aittir .

- Evet .`-O0`- Evet .`div10u`- Evet .`movl $0xa, %ecx; xorl %edx, %edx; divl %ecx`- Evet .`div10s`- Evet .`cltd; idivl %ecx`Aynı nesneye.`digest`Çaplık toplamını 10 ile bölüyor .`imulq $0x66666667`Bir bayrak farkı açıklıyor.`idioms-x86_64-nofastisel-O0.o`Bu bir inşaat .`-O0 -mllvm -fast-isel=false`, ve onda her bölünme çarpı,  dahil`div10u`- Evet .`movl $0xcccccccd, %ecx; imulq %rcx, %rax; shrq $0x23`Hardware bölümü hızlı talimat seçicisinin seçimi.`-O0`. Karşılık SelectionDAG'ın düşürülmesidir, bu da LLVM'in `UnsignedDivisionByConstantInfo`ve `SignedDivisionByConstantInfo`Ürünler.`digest`Bölümü tutan blok da bir `switch`Bu blok, seçme günlüğüne gitti.`hardware idivl`ve `magic multiply`, ve figür karışıklık gösterir .`-O0`fonksiyon.

## Modulo, Kütleyi Takip Ediyor

`x % d`- Evet .`x - (x / d) * d`. Kompilatör, oranı yukarıdaki dil ile hesaplar, tekrar çarpır ve çıkarır. x86-64'te tekrar çarpı 10'a çarpır `addl %ecx, %ecx; leal (%rcx,%rcx,4), %ecx`, yani `2 * q * 5`AArch64'te tek bir talimat var.`msub w0, w8, w9, w0`, hesaplar yapar .`w0 - w8 * w9`- Evet .`w9 = 10`. Tanıdıcı, oran kaydını kopyalar yoluyla takip eder, birikmiş faktörü `add`- Evet .`lea`- Evet .`shl`ve`imul`, ve kabul eder `sub`Eğer faktör bölücü ile eşit olduğunda.

Aynı oranın başka bir ifadesi de olduğu durumlarda, her iki dil de raporta kalır.`-O1`Yükleyici hesaplar `sum / 10`Bir kere .`digest`ve onu kullanıyor `switch`x86-64'te bile oranı iki kez birleştirir.`leal (%rax,%rsi), %edi`modulo ve  için`addl %esi, %eax`Bir bölümü ve bir modulu bildirir ve oranı paylaşılmış olarak işaretler.`switch`İndeks okunamıyor.

İki güç ile imzalanan modulo kendi şekli vardır, çünkü oran asla hesaplanmaz:

```text
      92: 8d 48 07                     	leal	0x7(%rax), %ecx
      95: 85 ff                        	testl	%edi, %edi
      97: 0f 49 cf                     	cmovnsl	%edi, %ecx
      9a: 83 e1 f8                     	andl	$-0x8, %ecx
      9d: 29 c8                        	subl	%ecx, %eax
```

Negatif için .`x`Kod maskeleme öncesi 7'e kaydırılır, böylece kesim C'nin istediği gibi sıfıra doğru döner.`x`8'in katına yuvarlanmış ve çıkarma kalıntıları `x % 8`AArch64 ile yapar .`negs w8, w0; and w9, w0, #0x7; and w8, w8, #0x7; csneg w0, w9, w8, mi`: ikisini de maske edin .`x`ve `-x`Ghidra bunun için kuralını isimlendirdi.`RuleSignMod2nOpt`, kısaca "INT_SREM formlarını dönüştür: `(V + (sign >> (64-n)) & (2^n-1)) - (sign >> (64-n)) => V s% 2^n`" ...bir şey.

- Evet .`-O0`AArch64 modulo'yu şöyle yazıyor:`sdiv w9, w8, w10; mul w9, w9, w10; subs w0, w8, w9`Tanımlayıcı da bu formu kabul eder ve raporlar verir .`hardware sdiv + mul + subs`- Evet .

## Bir anahtarı düşürmenin beş yolu

LLVM bir `switch`İki yerde.`SimplifyCFG::simplifySwitchLookup``-O1`ve yukarı ve tüm kapakları sabit üreten bir anahtarı bir değer tablosuna dönüştürür, en az üç kapak olduğunda ve hedef arama tabloları oluşturabilir.`SingleValueKind`- Evet .`LinearMapKind`- Evet .`BitMapKind`ve`ArrayKind`- Ne ?`-O0`Bu geçit asla geçmez.`SwitchLowering::findJumpTables`Kural seçimi, kümenin en az `min-jump-table-entries`Girişler, varsayılan 4 ve yeterince yoğun: `NumCases * 100 >= Range * MinDensity`- Evet .`jump-table-density`Normal fonksiyonlar için 10 ve 40 ' dan daha düşük .`-Os`. Geride kalan şey, durum sabitlerinin üzerinde ikili bir arama olur.`splitWorkItem`Çelişkiler her sonuca göre bir fonksiyon tutar.

| Function | Source | `-O0` x86-64 | `-O2` x86-64 | `-O2` AArch64 |
|---|---|---|---|---|
| `linear_switch` | cases 0 to 6 return 10 to 70 | jump table, 7 entries | linear map `10*k + 10`, default -1 | `madd` and `csinv` |
| `table_switch` | cases 0 to 6 return 10 to 60 then 71 | jump table, 7 entries | lookup table at `.rodata+0x28` | lookup table at `.rodata+0x0` |
| `call_switch` | cases 0 to 4 call one of five pointers | jump table, 5 entries | jump table, 5 entries | comparison tree, pivot 1 |
| `sparse_switch` | cases 1, 100, 10000, 1000000, 100000000 | compare chain | comparison tree, pivot 9999 | comparison tree, pivot 9999 |
| `two_cases` | cases 3 and 4 return 7 and 9 | compare chain | select chain `k != 3 ? (k == 4)*9 : 7` | two `csel` |

### Arama masası, nesnenin okunması

`table_switch`- ...`-O2`- ...

```text
      d0: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      d5: 83 ff 06                     	cmpl	$0x6, %edi
      d8: 77 0c                        	ja	0xe6 <table_switch+0x16>
      da: 89 f8                        	movl	%edi, %eax
      dc: 48 8d 0d 00 00 00 00         	leaq	(%rip), %rcx
		00000000000000df:  R_X86_64_PC32	.rodata+0x24
      e3: 8b 04 81                     	movl	(%rcx,%rax,4), %eax
      e6: c3                           	retq
```

Sınır kontrolü .`cmpl $6; ja`Yer değiştirme eklemesi`0x24`RIP oranlı alanın 4 baytı eklenince tablo `.rodata+0x28`Bu da bir kural ders 33'ü oluşturur.`0a 00 00 00 14 00 00 00 ...`, yani yazılar `[10, 20, 30, 40, 50, 60, 71]`Bu tabloyu bir araya getiren kişi bu tabloya isim verdi.`.Lswitch.table.table_switch`- ... ...`.s`Dosya, yorumla birlikte `@switch.table.table_switch`- nesne sadece yer değiştirme ve bytes kalır.

AArch64 formunda tablo adresi  ile birlikte yerleştirilir.`adrp x8`ve `add x8, x8, #0x0`, her biri kendi yerlerini taşıyor `.rodata`, ve yüklerle `ldr w0, [x8, w0, uxtw #2]`Tanımlayıcı , `add`Yer değiştirme.

### Tablo olmadan çizgi haritası

`linear_switch`Devamı`10 * (k + 1)`için`k`0 ila 6 arasında.`simplifySwitchLookup`Afine ilişkisini tespit eder ve aritmetik gönderir:

```text
      b0: 83 ff 07                     	cmpl	$0x7, %edi
      b3: 8d 04 bf                     	leal	(%rdi,%rdi,4), %eax
      b6: 8d 4c 00 0a                  	leal	0xa(%rax,%rax), %ecx
      ba: b8 ff ff ff ff               	movl	$0xffffffff, %eax
      bf: 0f 42 c1                     	cmovbl	%ecx, %eax
```

Değerlendirici okur `leal (%rdi,%rdi,4)`- Evet .`5*k`- Evet .`leal 0xa(%rax,%rax)`- Evet .`10*k + 10`, ve `cmovb`Sonra .`cmpl $7`- Evet .`k < 7 ? 10*k + 10 : -1`. Tanıyan, sonra formülü her kaynak durumuna karşı kontrol eder ve doğrulanmış dil işaretler.`madd w8, w0, w8, w9`ve `csinv w0, w8, wzr, lo`, nerede `csinv`- Evet .`wzr`verimleri `-1`Öntanımlı yol üzerinde.

### Yürüyüş masası, yer değiştirmelerden oku

`call_switch`- ...`-O2`Bu da form dersi 33'te bulundukları .`grade`- ...`-O0`- Evet .`cmpl $4; ja`, a `leaq`- ...`.rodata-0x4`, a `movslq`4 baytlı bir giriş, `addq`ve`jmpq *%rax`Beş giriş , yer değiştirme işidir .`.rela.rodata`ve`target = addend - 4k`ver .`0x10c, 0x107, 0x10e, 0x110, 0x109`, beş farklı blok, her biri bir fonksiyon göstergesi üzerinden atlamak.`dispatch`fixture bu durumu 16 vaka olarak ölçeyor: x86-64'te 16 yer değiştirme girişleri ve AArch64'te 16 tek bayttan oluşan sıkıştırılmış bir tablo okuyor `ldrb w11, [x9, x8]`, 4 ile ölçeği `add x10, x10, x11, lsl #2`, ve bir `adr`İlk blokun tanıtıcısı kodlama.`[0x24, 0x74, 0x54, ...]`Byte tablosundan ve raporlardan `compressed: true`- Evet .

### Dört seviyede aynı anahtar

`digest`Bir anahtar tutmuş .`sum / 10`6 ile 10 arasında ve değerleri 1, 2, 4, 8, 8 ile sonuç 16 çarpır.`-O0`, bir arama masası `-O1`Notlar ile birlikte`[16, 32, 64, 128, 128]`, ve yine bir atlama masası .`-O2`ve `-O3`Dört kutu depoları olan.`0x10`- Evet .`0x20`- Evet .`0x40`- Evet .`0x80`- Evet .`-O1`16 çarpı artışla vakalara geçmiştir.`-O0`Bu durumlar 1, 2, 4 ve 8'e ait ve çarpma anahtarı geçtikten sonra kalır.`-O1`arama tablosu tanıtıcı girişleri kaynak değerleriyle karşılaştırır, sabit bir oran bulur ve raporlar `foldedFactor: 16`AArch64 ' te .`-O2`form, 8'de bir pütol ile karşılaştırma ağacıdır, 6, 7 ve 8 için eşitlik testleri ve bir aralık testi `sub w9, w9, #9; cmp w9, #2; b.hs`Bu, 9 ve 10 olayları iki talimatla kapsar.`rangeTests: [[9, 10]]`- Evet .

İki bayrak bu sınırları hareket ettiriyor.`-fno-jump-tables`Döner .`table_switch`- Evet .`call_switch`, ve `digest`Yedi-kaza fonksiyonu için 2 ve 4 pivotları ile x86-64'te karşılaştırma ağaçlarına geçin.`-mllvm -min-jump-table-entries=4`yapraklar`call_switch`Bu nedenle, bu hedefte giriş sayısı, dolaylı çağrıların beş vakalı bir anahtarı için kararlı giriş değildi.`idioms-arm64-jt4-O2.o`Kayıtlar çalışmaktadır.

GCC her iki kararı da kabul etti .`tree-switch-conversion.cc`, sınıflarla birlikte `jump_table_cluster`- Evet .`bit_test_cluster`- Evet .`switch_decision_tree`ve`switch_conversion`- Bu .`-ftree-switch-conversion`- Evet .`-O2`- Evet .`-fjump-tables`ve `-fbit-tests`- ...`-O1`, ve atlama masası eşiği geliyor `case-values-threshold`Bu makineye GCC yüklenmedi, bu isimler GCC kaynağı ve el kitabından geliyor ve Compiler Explorer onları kontrol edeceğiniz yerdir.

## Çubuklar: Vektörlü, Çıkarılmış veya Değiştirilmiş

LLVM'in döngü vektörlüğü açık.`-O2`- Evet .`-O3`ve`-Os`, ve `-O0`ve `-O1`, Ocak 2014'te LLVM 3.4'e dayanan bir kural. `sum_n`- ...`-O2`şeklin her kısmını gösterir:

```text
     1f6: 83 fe 07                     	cmpl	$0x7, %esi
     1f9: 77 09                        	ja	0x204 <sum_n+0x14>
     206: 81 e2 f8 ff ff 7f            	andl	$0x7ffffff8, %edx
     230: f3 0f 6f 14 37               	movdqu	(%rdi,%rsi), %xmm2
     235: 66 0f fe c2                  	paddd	%xmm2, %xmm0
     239: f3 0f 6f 54 37 10            	movdqu	0x10(%rdi,%rsi), %xmm2
     23f: 66 0f fe ca                  	paddd	%xmm2, %xmm1
     243: 48 83 c6 20                  	addq	$0x20, %rsi
     24a: 75 e4                        	jne	0x230 <sum_n+0x40>
     24c: 66 0f fe c8                  	paddd	%xmm0, %xmm1
     250: 66 0f 70 c1 ee               	pshufd	$0xee, %xmm1, %xmm0
     262: 66 0f 7e c8                  	movd	%xmm1, %eax
     270: 03 04 97                     	addl	(%rdi,%rdx,4), %eax
     279: 75 f5                        	jne	0x270 <sum_n+0x80>
```

Muhafız .`cmpl $7; ja`8'in altında yolculuk sayısını skalar döngüsüne gönderir.`andl $0x7ffffff8`Bu sayede, yolculuk 8'in katına kadar sayılır.`xmm`Bir sürüşmeci, her biri dört 32 bitlik yol, veektoryasyon faktörü 4 ve interleave faktörü 2'dir.`paddd`İki .`pshufd`, iki tane daha .`paddd`ve`movd`Sekiz hatı tam bir sayıya indir.`0x270`Bu, son 0 ila 7 öğenin skalar kalıntııdır. Tanıdıcı, arka kenarından döngüyü bulur, SIMD kayıtlarını görür, `paddd`, ayrı bir toplama sayıyor, adımları bölüyor `0x20`4 ve raporlar `4 lanes x 2 accumulators = 8 elements per iteration`AArch64 aynı şeyi yapar.`ldp q2, q3`İki .`add v.4s`- Evet .`addv s0, v0.4s`ve`fmov w8, s0`- Evet .

Sıkı bir yol sayımı da bu döngüyü kaldırır.`sum4`Bir tane .`movdqu`, azaltma ve `movd`, arka kenarı olmadan.`poly8`vectorize edemez, çünkü her iterasyon önceki akkumülatörden bağlıdır, bu yüzden kompiler onu sekiz kez açar: 0 ile  arasında sıfırlamalarda sekiz yük`0x1c`-`%rdi`, her biri 5 ile bir değişim ve hesaplayan bir çıkarma ile takip edilir `acc * 31`. Tanıtıcı , bir tabandan sırayla sıfırlamalarda yükleri sayır ve raporlar yapar `loop unrolled by 8, no back edge`AArch64 ' te aynı yükler 4 ile gelir .`ldp`Çiftler.

Vektörlü cihazı kapat `-fno-vectorize -fno-slp-vectorize`ve `sum_n`8 ile açılan bir skalar döngü haline gelir.`addl k(%rdi,%rdx,4), %eax`ve `addq $8`, artı bir kalıntı döngüsü.`sum4`Tanımlayıcı raporlar.`unrolled loop`- Evet .`copies: 8`ve `indexStep: 8`İlk ve`copies: 4`İkinci kez.

Ders 33 iki arka kenar buldu .`total`- ...`-O2`Bu ders onları iki döngü olarak adlandırıyor: bir vektör vücudu ve aynı kaynak döngüsünün bir skalar kalıntı.`is_loop()`Bunu kontrol eder, çünkü`digest`AArch64'de, ortak bir varsayılan blokta döngü olmayan geriye doğru dallar bulunur ve tanıtıcının ilk sürümü onları vektör döngü olarak sayır.

### Kütüphane aramaları olan döngüler

`LoopIdiomRecognize`her baytta sıfır kaydeten bir döngüyi `memset`, `-O1`Yukarı.`fill`- ...`-O2`- Evet .`testl %esi, %esi; jle; movl %esi, %edx; xorl %esi, %esi; jmp memset@PLT`- Bu çağrı , yer değiştirme ile bir atlama .`R_X86_64_PLT32 memset-0x4`, ve fonksiyon `retq`Sadece boş yol üzerinde.`store loop recognized as memset(...)`ve kaynak döngüsüne karşı doğruluyor, çünkü kaynak asla isim vermez.`memset`- Evet .

`copy16`Çağrılar`memcpy`16 sabitliğinde, x86 arka uçları da onu  olarak genişletiyor.`movups (%rsi), %xmm0; movups %xmm0, (%rdi)`, 8 tane mağazası içindeki`memcpy`- Ne ?`-O0`Aynı çağrı iki 8 bayt .`movq`Çiftler.`-fno-builtin`Çağrı bir çağrı kalır.`jmp memcpy@PLT`- Evet .`movl $0x10, %edx`ve`fill`Vectoryzer'in ardından iki 16 baytlı bir döngü haline getirmesi.`movups`İterasyon başına depolar.`vectorized store loop: 2 x 16-byte stores = 32 bytes per iteration`Bu inşaat için.

## Kaybolan Ya da Atlayan Çağlar

`tail_caller`Devamı`tail_target(x + 1)`- Ne ?`-O0`Evet .`addl $0x1, %edi; callq tail_target@PLT; addq $0x10, %rsp; popq %rbp; retq`- Ne ?`-O2`Evet .`incl %edi; jmp tail_target@PLT`Arayanın çerçevesinin yok olması ve arayanın arayan kişiye geri dönmesi için AArch64'te atlama`b tail_target`- Evet .`R_AARCH64_JUMP26`Tanıdıcı bir `jmp`veya `b`33 dersinin geri dönüşlü düşüşü, hedefin fonksiyon dışında olduğu için fonksiyon çıkışı olarak görmelidir.

`twice_sum`Çağrılar`leaf_add`- Ne ?`-O0`Çağrı orada.`callq leaf_add@PLT`- Evet .`-O1``leaf_add`- Evet .`leal (%rdi,%rsi), %eax`İçeride görünüyordu .`twice_sum`Ve hiçbir çağrı kalmadı.`-O0`Clang her fonksiyonu işaretler `optnone`ve `noinline`Bu, sadece her zaman içe giden bir cihazın çalışmasını sağlar.`twice_sum`Çağrılar`leaf_add`, arama veya kuyruğu atlamayı bulmaz ve sonra aramacıda aramacı'nın vücut şeklini arar: mnemonik ve kaynak operandları hedeflenme ile kaldırılır, böylece `add w8, w1, w0`AArch64 çağrıda bulunma eşleşmelerinde `add w0, w1, w0`Bir eşleşme delil.

`dispatch`Her kesiği 16 kişilik bir atlama masası.`movl %esi, %edi; jmp fN@PLT`Tanımlayıcı bir anahtar ve 16 arkaplan çağrısı rapor ediyor. Bunların hepsi kaynağdaki 16 çağrıya karşı doğrulanıyor.

## Veriler Oluşan Şubeler Değişiyor

`clamp_max`- Evet .`movl %esi, %eax; cmpl %esi, %edi; cmovgl %edi, %eax`- Değerlendirici isimleri`%edi`- Evet .`a`ve `%esi`- Evet .`b`, karşılaştırmayı kaydeder ve okuyor `cmovg`- Evet .`a > b ? a : b`, kaynak metni olan. `abs_int`- Evet .`movl %edi, %eax; negl %eax; cmovsl %edi, %eax`ve şöyle okuruz:`-x < 0 ? x : -x`AArch64 ' in yazdığı gibi`cmp w0, #0; cneg w0, w0, mi`ve şöyle okuruz:`x < 0 ? -x : x`- Evet .`is_pos`- Evet .`xorl %eax, %eax; testl %edi, %edi; setg %al`, ki şöyle okur:`(x > 0)`Bunlar ...`-fif-conversion`GCC'nin sözlerinde ve`cmov`LLVM'lerde seçim. LLVM'lerde `X86CmovConversion`Geçmek bir dönüş yapabilir.`cmov`Bu yüzden aynı kaynak bir döngüde herhangi bir şekli gösterebilir.

- Evet .`-O0`Bunların hiçbiri yok.`clamp_max`bir karşılaştırma, bir `jle`Bir tanıklık cihazı, bir yerde hiçbir şey bildirmez.`-O0`ve `branchless select`-`-O1`Bu rakamın görülebilir hale getirdiği gerçeklerden biri.

`mul9`Bir tane .`leal (%rdi,%rdi,8), %eax`, ve tanıtım raporları `strength reduction`- Evet .`x * 9`, çünkü kaynak 9 ile çarpılır.`lea`Bir tablo indeksinin ölçeği bir çarpma değildir.

## İdime Görünen İki Zorlayıcı Özellik

Yumruk koruyucu bir kompilatör özelliğidir ve bir ajanın program mantığı olarak okuyacağı bir şekil bırakır. `canary.c` ile birleştirilmiştir`-fstack-protector-strong`x86-64 için Linux verir:

```text
       7: 64 48 8b 04 25 28 00 00 00   	movq	%fs:0x28, %rax
      10: 48 89 44 24 40               	movq	%rax, 0x40(%rsp)
      26: 64 48 8b 0c 25 28 00 00 00   	movq	%fs:0x28, %rcx
      2f: 48 3b 4c 24 40               	cmpq	0x40(%rsp), %rcx
      34: 75 05                        	jne	0x3b <with_canary+0x3b>
      3b: e8 00 00 00 00               	callq	0x40 <plain_leaf>
		000000000000003c:  R_X86_64_PLT32	__stack_chk_fail-0x4
```

`%fs:0x28`- Evet .`stack_guard`Glibc'de.`tcbhead_t`, byte offset 40 ve LLVM'in `getIRStackGuard`Glibc, Bionic ve Fuchsia için yer alan isimler.`__stack_chk_fail`AArch64 Linux ' ta koruma globalden geliyor .`__stack_chk_guard`GOT ile birlikte`adrp`ve `ldr`ve başarısızlık `bl __stack_chk_fail`Tanıdıcı güvenlik kaynağını, boşluğu, karşılaştırmayı ve aramayı bildirir.`plain_leaf`, ki bir dizi yok, altında bir kanarya yok.`strong`, fonksiyonları dizilerle koruyor,`alloca`Araştırma notlarında MSVC formunu da kaydeder.`/GS`, bir kurabiye ile karıştırılmış`%rsp`ve kontrol edildi `__security_check_cookie`Bu makine üzerinde MSVC bağlantısı yoktur, bu nedenle bu şekil yalnızca kompiliörün montaj çıkışından tanımlanır.

`-fcf-protection=full`- Evet .`endbr64`, baytlar `f3 0f 1e fa`Bu, kontrol akışı uygulanması ile işlemcilerde dolaylı şubeler için bir iniş pistidir ve bir `nop`Ghidra'nın x86-64 fonksiyon başlangıç kalıpları arasında `endbr64``push rbp; mov rbp, rsp`Tanımlayıcı bunu şöyle bildirir:`cet landing pad`, yani dört alışılmadık bayt ile başlayan bir işlev veriler olarak yanlışlıkla algılanabilir.

## Decompilers'in Neyi Yıkadığı

Ders 37'deki her dekompiler, bu tür tür türevlerin bir kısmını yeniden yazma kuralları olarak çalıştırır.`ruleaction.cc`- Evet .`RuleDivOpt`"INT_MULT'i INT_DIV veya INT_SDIV'e dönüştür ve şekilleri değiştir" şeklinde, `sub( (zext(V)*c), d) >> e => V / (2^n/(c-1)) where n = d*8 + e`ve imzaladığı variantı `sext`ve `s>>`- Evet .`RuleModOpt`"INT_REM ve INT_SREM'i optimize eden ifadeleri basitleştir".`RuleDivTermAdd`Ek düzenlemeyi ele alır.`RuleSignDiv2`Döner .`(V + -1*(V s>> 31)) s>> 1`- ...`V s/ 2`ve`RulePositiveDiv`Bu, açık işaret parçaları ile imzalanan değerlerin bölünmesini imzalanmamış olan değerlere dönüştürür.`grade`- ...`-O1`, ve çıkış okur `uVar2 = param_1 / 10 - 6;`Bölüm katlandı.

Bu kurallara girme Java olmadan görünür. venv'in pypcode 4.0.1 Ghidra'nın kullandığı aynı SLEIGH spesifikasyonu ile yüklenir ve `code/fixtures/idioms-x86_64-O2.lifts.json` için çiğ P-kodunu taşıyor`div10s`: 112 giriş yedi talimat için, bunların 7'si`IMARK`Her talimatın açılışını gösteren işaretler, bunlardan biri `RAX = RAX * unique[95a00:8]`Sonra .`unique[95a00:8] = sext(0x66666667)`- Evet .`RCX = RCX >> unique[d1a00:4]`ve`RAX = RAX s>> unique[c5c00:4]`- Ne ?`shrq`41 operasyon ve `sarq`40 tane taşıyor ve çoğu bayrakları hesaplıyor.`RuleDivOpt`Bu akışta çarpma ve iki değişim eşleşir ve ölü kod ortadan kaldırmak hiçbir şey okur bayrakları kaldırır.

Angr 10.0.3 bizim üzerimize çıktı.`-O2`nesne ve `idioms-x86_64-O2.angr.json`20 işlevi için dekompiler çıkışını tutar. İmza edilmemiş formu katlar: `div10u`- Evet .`return a0 / 10;`İmzalanmış form katlanmaz:`div10s`- Evet .`v1 = a0 * 1717986919; return ((long long)(v1) >> 0x22) + (v1 >> 63);`ve `mod10s`- Evet .`a0 - (...) * 2 * 5`- Evet .`div7u`- Yazdırıyor .`(a0 / 7 + ((a0 * 6 / 7 & 0xffffffff) >> 1 & 0xffffffff) & 0xffffffff) >> 2`Bu da bir matematik olarak kalır.`mul9`- ...`a0 * 9`- Evet .`linear_switch`- ...`(a0 < 7 ? a0 * 10 + 10 : 0xffffffff)`- Evet .`clamp_max`- ...`((int)a1 < (int)a0 ? a0 : a1)`- Evet .`is_pos`- ...`a0 > 0`ve`fill`- ...`return memset(a0, 0, a1);`- Yazdırıyor .`table_switch`Bir yük olarak .`*(int *)(4 * a0 + 4195400)`Değerleri olmadan,`sum_n`- Evet .`_mm_add_epi32`ve `_mm_shuffle_epi32`içsel bilgiler ve`tail_caller`- Evet .`tail_target(); return;`- Bu da bir tartışmanın sonucu.`digest`Atlama masası `goto *((void *)(...))`Tablo hesaplamaları yazılmış.

Radar2 6.2.4 ve Risin 0.9.1 kaynağından araştırma önbelleğine yerleştirilmiştir. Aynı nesne üzerinde çalıştırılmış.`pdc`Parmak izi`div10s`- Evet .`rax = rax * 0x66666667; rcx >>>= 0x3f; rax >>= 0x22; eax += ecx`, kayıt seviyesindeki katlanmadan pseudo-C ve `table_switch`- Evet .`eax = dword [rcx + rax*4]`bir `RELOC 32 .rodata``lea`. rizin'in içinde bir dekompiler yok .`aoi``imul`Lldb-1703.0.236.21 ELF nesnesini ve onun `disassemble -n div10s`Aynı yedi talimatı basıyor.`llvm-objdump`Capstone 5.0.7 aynı baytları çözüp, `ret`ve `mode64`Bu, bir dekodördür ve bir dilbilim bir dekodörün çıkışında asla bulunmaz. IDA Pro ve Binary Ninja burada çalıştırılmamıştır. Dokümanları bu tür yeniden yazmanın gerçekleşeceği aşamaları, mikrokod optimizasyonu ve MLIL'den HLIL'e geçişleri tanımlar ve bu ders hangi dilbilimleri katladıkları konusunda hiçbir iddia yapmaz.

Yükleyici Explorer ileri yön için araçtır.`idioms.c`, "x86-64 clang 18.1.0" veya "ARM64 GCC 14.2.0" gibi bir kompilatör girişini seçin ve bayrakları ayarlayın.`GET /api/compilers/c`İttifakçıları geri gönderir ve `POST /api/compiler/<id>/compile`Matt Godbolt'in 2019 ACM Queue makalesinde bölünme, nüfus sayımı, zincirli koşullu ve toplam ifadeleri ile bu araçla yürür. Bu makine üretemediği GCC çıkışı için kullanın ve GCC'nin atlama masası eşiğini ve `-O2`GCC 12'den gelen vektörleşme standartları, sabitlemelerde clang çıkışı ile.

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu. 18 yapıtaştan her biri için her işlevi ve dillerini, tür, kaynak biçimi, kanıt adresleri, doğrulama ve ayrıntı alanları ile listeler.`-O2`karşılaştırıldığında`-O3`Bu iki yapı için de bir karşılaştırma yapıldı.`unverified`Listesi.

Beklenen şekil:

```json
{
  "builds": {
    "idioms-x86_64-O2": {
      "arch": "x86_64", "level": "O2", "flags": "x86_64",
      "functions": {
        "div7u": [{"kind": "division", "source": "x / 7", "evidence": ["0x30", "0x32", "0x39", "0x3d", "0x3f", "0x41", "0x43"], "verified": true, "form": "magic multiply with add fix-up", "magic": "0x24924925", "effectiveMagic": "0x124924925", "shift": 35, "...": "..."}],
        "table_switch": [{"kind": "switch", "source": "switch (k) as lookup table", "table": ".rodata+0x28", "entries": 7, "values": [10, 20, 30, 40, 50, 60, 71], "...": "..."}],
        "sum_n": [{"kind": "vector loop", "lanes": 4, "accumulators": 2, "elementsPerIteration": 8, "...": "..."}]
      }
    }
  },
  "kindMatrix": {"idioms-x86_64-O2": {"division": 5, "modulo": 3, "switch": 6, "vector loop": 3, "...": "..."}},
  "sameCodeAtO2AndO3": {"x86_64": {"identical": true}, "arm64": {"identical": false, "differences": ["..."]}},
  "unverified": []
}
```

Oku `code/main.py`Bu sırada:

1. `parse_listing()`Dönüştürür `llvm-objdump -d -r`Bu iki yapı için fonksiyonlara, talimatlara ve ek yerleşimlere metin.
2. `ElfFile`Bölümleri, sembolleri ve `.rela.*`girişler ve `words()`Masa girişlerini okuyor.
3. `magic_numbers()`- Evet .`divisor_from_magic()`ve`evaluate_division()`Granlund-Montgomery çıkışı ileri, geri ve talimat dizisi olarak.
4. `parse_source()`C dosyasından verifikasyon gereksinimlerini oluşturan yapıları çıkarır.
5. `Evaluator`blok-bloke simgesel geçit, isim kayıtları ve yığın slotları.
6. `find_divisions()`ve `find_modulos()`- Bir çiftlik, bir değişim, birleştirme, bir çiftlik, bir çiftlik.
7. `find_switches()`atlama tablolarını, arama tablolarını, çizgi haritaları, seçilen zincirleri, karşılaştırma ağaçlarını ve karşılaştırma zincirlerini sınıflandırır.
8. `find_vector_loops()`- Evet .`find_unrolled_loops()`- Evet .`find_tail_calls()`- Evet .`find_inlined_calls()`- Evet .`find_selects()`- Evet .`find_memory_builtins()`- Evet .`find_stack_protector()`- Evet .`find_cet()`ve`find_strength_reduction()`Gerisini kapayın.
9. `analyze_function()`Bu sayede her bir dilin sonuç adını bir sonraki değerlendirme atışına ekler.

Üç emir daha var.`python3 code/main.py scan FILE.objdump.txt [FUNCTION]`Bir listeye ait tanıtıcıyı kullanır, nesne ve yanındaki eşleşen C dosyası bulunur. `python3 code/main.py magic DIVISOR [signed]`Karşılıklı, değişim, hata ve kimlik kenar değerlerini tutar mı yazıyor. `python3 code/main.py figure-data`Resim içeren verileri yazdırır.

## Kullan

Bu sırada, yeni bir nesne üzerinde tanıtıcıyı kullan.

1. Yakalama`llvm-objdump -d -r`Bu sayede, bir nesneyi oluşturmak için, bir komut oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneyi oluşturmak için, bir nesneye oluşturmak için, bir nesneye oluşturmak için, bir nesneye oluşturmak için, bir nesneye, bir nesneye oluşturmak için, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesne, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, bir nesneye, nesneye, bir nesneye, bir nesne, bir nesneye, bir nesne, nesneye, nesne, nesne, nesne, nesne, nes
2. Çık .`scan`Listede bulun ve oku `unverified`Her biri kaynağı analiz eden kişi görmediği bir yapı ya da tanık yanlış okuyan bir biçimdir ve her ikisi de kanıt adreslerine bir göz atmaya haklıdır.
3. Her bölüme göre, okunun.`algorithm`- Ne zaman?`clangMatchesAlgorithm`Eğer yanlış ise, kompilerde henüz bilmediğiniz bir neden vardı; sabitleri yazın.
4. Her anahtar için `lowering`Bir ağaç haline gelen bir masa, bir ağaç haline gelen bir masa, LLVM kaynağından adlandırabileceğiniz bir eşiği işaretler.
5. Her döngü için oku.`elementsPerIteration`ve `scalarRemainderLoop`, sonra iki arka kenarları ders 33 raporları bir kaynak döngüsü olduğunu onaylayın.
6. Aynı nesne üzerinde bir dekompiler çalıştırın, her bir dilin yanında metni alıntılayın ve hangi kelimeleri katladığını kaydetin.

## İnteraktif Laboratuvar

### Laboratuvar A: Sihirli bir sayı çıkarın, sonra bulun.

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization/code
python3 -q
```

Çık:

```python
from main import *
magic_numbers(10), magic_numbers(10, signed=True)
magic_numbers(7), magic_numbers(7, signed=True)
divisor_from_magic(0x66666667, 34, signed=True), divisor_from_magic(0x66666667, 33, signed=True)
```

Hesaplama`ceil(2^35 / 10)`İlk çağrıdan önce kağıt üzerinde.`unsigned div13(unsigned x) { return x / 13; }``idioms.c`, onu inşa et .`-O2`Komutanlık ile.`build_fixtures.sh`, ve listede sabit karşı kontrol `magic_numbers(13)`- Evet .

### Laboratuvar B: Masa ve ağaç

```python
listing = load_listing("idioms-x86_64-O2.objdump.txt")
elf = load_elf("idioms-x86_64-O2.o")
sources = load_source("idioms.c")
[i.to_dict() for i in analyze_function(listing, "table_switch", elf, sources)]
[i.to_dict() for i in analyze_function(listing, "sparse_switch", elf, sources)]
elf.words(".rodata", 0x28, 7)
```

Değişiklik`71`Geri dön .`70``table_switch`, yeniden inşa `-O2`Bu da bir tabloyu çizgi haritası haline getirir.`ArrayKind`Masada.

### Laboratuvar C: üç ayarlı döngü

```python
for name in ("idioms-x86_64-O1", "idioms-x86_64-O2", "idioms-x86_64-novec-O2"):
    print(name, [i.source for i in analyze_function(load_listing(name + ".objdump.txt"), "sum_n", load_elf(name + ".o"), sources)])
```

 Kontrol akışı grafikini çiz`sum_n`- ...`-O2`el ile, koruyucu, maske, vektör vücudu, kısaltma ve kalan döngüyi işaretleyin ve `detail`Alanlar.

### Laboratuvar D: paylaşılan oran

```python
for name in ("idioms-x86_64-O1", "idioms-arm64-O1"):
    print([(i.kind, i.source, i.detail.get("sharedQuotient")) for i in analyze_function(load_listing(name + ".objdump.txt"), "digest", load_elf(name + ".o"), sources)])
```

Oku `-O1`listesi `digest`ve x86-64'te işaretleme ayarıyla birlikte iki yönlendirmeyi bul.

## Pratik Laboratuvar

Ayaklara biraz numara ekle ve tanıklığı genişlet.

Gereksinimler:

- Yazmın .`popcount`- Evet .`ctz`ve`rotl`Bu, GCC'nin inşaatları ve bir dönüştürme veya dönüştürme ile birlikte,`-O2`ile ve olmadan `-mpopcnt -mbmi`, ve nesneleri listelerle birlikte yükle.
- Anlayın `0x55555555`- Evet .`0x33333333`- Evet .`0x0f0f0f0f`- Evet .`0x01010101`Nüfusa göre bir dizi`TargetLowering::expandCTPOP`yayıyor ve raporunu `popcount`Dört sabitle kanıt olarak.
- Tanınmak`rep bsfl`Bu da ...`tzcnt`- Ya da...`bsf`kodlama ve `roll %cl`Dönüştür ve her ikisini de yapılandırmaya dekode et.
- Yeni türleri ekle `parse_source()`verifikasyonu, yani bir `popcount`İdiom sadece kaynak aradığında doğrulanır `__builtin_popcount`- Evet .
- Aygıt listesinden sabitleri okuyan bir dil testi ekleyin.

Başarılı olmak demektir .`python3 code/main.py``verified: true`Her iki yapıtaşında da, ve süit hala boş bir rapor veriyor.`unverified`Listesi.

## Ders Artifakti

Bu ders de içerir .`outputs/skill-compiler-idioms-and-optimization.md`. Bir listeyi, bir nesneyi ve kaynağını bir dekompiler karşılaştırması ile doğrulanmış bir dil raporu haline getirmek için kullanın. Her iddiada kanıt adreslerini, her bölüm için sihirli sayı türünü, her anahtar için düşürme türünü ve giriş kaynağını ve her dil için alıntılı dekompiler satırını gerektirir.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/39-compiler-idioms-and-optimization
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Verifikasyon, şunu kanıtlamalıdır:

- listing parser 25 işlevi okuyor `-O2`nesne, baytları tutar ve bağlar `R_X86_64_PC32 .rodata+0x24`- ...`leaq`İçeride`table_switch`
- ELF okuyucuyu gönderir `[10, 20, 30, 40, 50, 60, 71]`-`.rodata+0x28`ve on yer değiştirme `.rela.rodata`
- `magic_numbers`Devamı`0xcccccccd`35 vardiya ile.`0x66666667`34 ile.`0x124924925`35 ile ekleme formuna, `0x55555556`32 ile birlikte, ve`0xaaaaaaab`33 ile
- kimlik, 2'den 64'e kadar iki, imzalanan ve imzalanmamış ikili olmayan her bölücü için 32 bitlik kenar değerlerini tutar
- `divisor_from_magic`10, 5, 7 ve 3 çiftlerini geri alır ve yanlış çiftini reddeder.
- Ekleme sabitleme dizisi hesaplamaları `n // 7`Tam olarak
- Dört x86-64 bölümü sağ katkı, değişim, bölücü ve formunu bildirir ve dört AArch64 bölümü de kodunu çözür `mov`ve `movk`
- `-O0`kullanımı `divl`ve `idivl`- Evet .`-O0 -fast-isel=false`çarpımı kullanır ve`digest`- ...`-O0`İkisini karıştırır.
- modulo, tekrar çarpma olarak tanınır.`msub`, iki güç, `sdiv`Ek olarak .`mul`Ek olarak .`subs`, ve donanım `idivl`
- Paylaşılan bir oran hem bölümü hem de modülü tutar `-O1`
- Beş düşüşü `-O2`Her iki yapı üzerinde de formül, değerler, hedefler, pivotlar ve seçilmiş ifadeler ile
- `-O0`Switches x86-64 üzerinde atlama masası ve AArch64 üzerinde zincirleri karşılaştırmak
- `digest`switch bir atlama tablosu, sonra katlanmış 16 oranlı bir arama tablosu, sonra x86-64 üzerinde dört farklı hedefe sahip bir atlama tablosu ve AArch64'te 9 ila 10 aralığı testi ile bir karşılaştırma ağacı
- `-fno-jump-tables`16 vaka karşılaştırma ağaçları üretir.`dispatch`hedeflerini x86-64'te yer değiştirmelerden ve AArch64'te sıkıştırılmış bayt tablolarından okuyor.
- vektör döngüsü 4 satır, 2 akumülatör, her iterasyonda 8 element, maske, koruma, azaltma ve kalan döngü rapor eder
- sabit yol döngüleri tamamen vektörlü veya tamamen çözülmüştür ve `-fno-vectorize`8'e kadar açılır
- `-O1`vektörleşme yok.`-O2`ve `-O3`x86-64'te aynıdır ve AArch64'te sadece `call_switch`, nerede `-O3`17 talimat ve `-O2`18
- `-fno-builtin`depo döngüsünü vektörlü bir depo döngüsüne dönüştürür ve tutar `memcpy`Bir çağrı
- İzleyici çağrıları,`memset`Değiştirme, 16 baytlı kopyası ve `-O0`iki hareketli kopya tanınır
- Çizilen çanlı , `-O1`Vücut şekliyle
-  için kodlama seçer`a > b ? a : b`- Evet .`-x < 0 ? x : -x`- Evet .`(x > 0)`ve`sum % 10 < 5 ? sum % 10 : 5`
- Yüklü koruyucu raporları `%fs:0x28`, yuva ve `__stack_chk_fail`ve`endbr64`CET yapılarının her bir fonksiyonunda rapor edilir.
- Kaynak analizörü fonksiyon işaretleme parametrelerini, anahtarlık durumlarını, çağrıları ve akkumülatör isimlerini okuyor
- Her yapıdaki her dil doğrulanır ve tür matrisleri eşleşir
- İnteraktif rakam analizle elde edilen aynı verileri içerir.

## Üretim Başarısızlık Modları

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Multiply by a large odd constant | "multiplies by 1717986919" | The constant is `ceil(2^s / d)` for one `d`, the error satisfies the bound, and the shift is the smallest valid one |
| Add fix-up after a 32-bit shift | Five arithmetic instructions | The multiplier is 33 bits wide and the tail is the add form of the same method |
| Same multiplier, different shift | The same divisor | The shift selects the divisor: 34 is 10, 33 is 5 |
| Power-of-two signed modulo | "adds 7, masks, subtracts" | The bias rounds toward zero and the result is `x % 8` |
| Indexed load from `.rodata` | "a jump table" | A lookup table of values, with entries read from the bytes at addend plus 4 |
| Affine arithmetic and a `cmov` | "computes 10k + 10" | A switch lowered as a linear map, verified against every source case |
| Compare chain with ordered splits | "a sequence of ifs" | A binary search over the case constants with the pivots named |
| Backward branch to a default block | "a loop" | The target leaves the region with an unconditional jump; it is a shared tail |
| Two back edges in one function | "two loops" | One source loop: the vector body and its scalar remainder |
| `jmp memset@PLT` with no `ret` | "the function has no return" | A tail call that returns through the callee, replacing a store loop |
| Callee missing from the call graph | "never called" | Inlined: the callee's body shape appears in the caller |
| `%fs:0x28` load and compare | "reads thread-local data" | The stack protector canary, with the fail path to `__stack_chk_fail` |
| Four odd bytes at function start | "data before the function" | `endbr64`, the CET landing pad |
| Decompiler shows raw arithmetic | "the tool is wrong" | The tool did not apply a fold; the derivation gives the source form and the quoted output records the gap |

## İşlem Kuralı

Şeklini eşleştirin, çıkarımı geriye doğru çalıştırın ve bunu kanıtlayan sabitleri yazın. Her dilçiliği kanıt adresleriyle ve çözülmüş kaynak formlarıyla rapor edin, her birini oluşturduğunuz kaynağa karşı doğrulayın ve her dekompilerin aynı baytlar için yazdığı şeyi alıntılayın.

## Daha Fazla Okumak

- [Granlund, Montgomery, "Division by Invariant Integers using Multiplication" (PLDI 1994)](https://gmplib.org/~tege/divcnst-pldi94.pdf)
- [Warren, Hacker's Delight, 2nd edition, Chapter 10: Integer Division By Constants](https://www.informit.com/store/hackers-delight-9780321842688)
- [Lemire, Kaser, Kurz, "Faster Remainder by Direct Computation" (2019)](https://arxiv.org/abs/1902.01961)
- [libdivide, header-only division by runtime constants](https://github.com/ridiculousfish/libdivide)
- [LLVM `DivisionByConstantInfo.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Support/DivisionByConstantInfo.cpp)
- [LLVM `SwitchLoweringUtils.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/SwitchLoweringUtils.cpp)ve [`TargetLoweringBase.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/TargetLoweringBase.cpp)
- [LLVM `SimplifyCFG.cpp`, `simplifySwitchLookup`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Utils/SimplifyCFG.cpp)
- [LLVM Auto-Vectorization documentation](https://llvm.org/docs/Vectorizers.html)ve [LLVM 3.4 release notes](https://releases.llvm.org/3.4/docs/ReleaseNotes.html)
- [LLVM `LoopIdiomRecognize.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Transforms/Scalar/LoopIdiomRecognize.cpp)
- [LLVM `X86CmovConversion.cpp`](https://github.com/llvm/llvm-project/blob/release/20.x/llvm/lib/Target/X86/X86CmovConversion.cpp)
- [LLVM `StackProtector.cpp`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/StackProtector.cpp)ve [`X86ISelLoweringCall.cpp`, `getIRStackGuard`](https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/X86/X86ISelLoweringCall.cpp)
- [glibc `sysdeps/x86_64/nptl/tls.h`, `tcbhead_t`](https://sourceware.org/git/?p=glibc.git;a=blob;f=sysdeps/x86_64/nptl/tls.h)
- [GCC `tree-switch-conversion.cc`](https://github.com/gcc-mirror/gcc/blob/master/gcc/tree-switch-conversion.cc)- Evet .[GCC Optimize Options](https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html)ve[GCC 12 release notes](https://gcc.gnu.org/gcc-12/changes.html)
- [Ghidra decompiler `ruleaction.cc`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/decompile/cpp/ruleaction.cc)
- [angr decompiler documentation](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 book: decompilers](https://book.rada.re/arch/decompile.html)
- [Compiler Explorer API](https://github.com/compiler-explorer/compiler-explorer/blob/main/docs/API.md)
- [Godbolt, "Optimizations in C++ Compilers: A practical journey", ACM Queue 17(5), 2019](https://queue.acm.org/detail.cfm?id=3372264)
- [Microsoft, `/GS` (Buffer Security Check)](https://learn.microsoft.com/en-us/cpp/build/reference/gs-buffer-security-check)
