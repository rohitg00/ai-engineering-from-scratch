# Verileri ve Tipleri Geri Almak: Strukt, Array, C++ Nesneleri ve DWARF

> Bir dekompiler izleri `a->balance`bir tip masası olduğunda ve `*(int *)(param_1 + 4)`Bu ders, girişlerden tablo oluşturur, DWARF 5'ten gerçek olanı okuyor ve iki tarafın nerede anlaştığını gösterir.

**Type:** Build
**Languages:** Python, TypeScript, C, C++, x86-64 assembly
**Prerequisites:** Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~140 minutes

## Öğrenme Hedefleri

- Intel SDM adresleme kurallarından bir struct üyesi erişimi temel kayıt artı yer değiştirme olarak ve bir dizi erişimi temel artı indeks zaman adım olarak okuyun.
- Sistem V uyum kurallarını el ile uygulayın `struct account`ve her bir boytu açıklayın.
- Bir listedeki erişimi her bir alanın karşılığı, genişliği, türleri, bir adım ve boyutuna çeviren bir tip kurtarma geçitini oluşturun.
- DWARF 5 okuyucuyu yaz `.debug_info`- Evet .`.debug_abbrev`- Evet .`.debug_str_offsets`ve`.debug_addr`Yer değiştirilebilir bir nesneyi kontrol ederek `llvm-dwarfdump`- Evet .
- Geri alınan düzenle DWARF düzenle karşılaştırın ve her farkı eksik kanıt, birleşik erişim veya kanıtlanamayan bir tür olarak adlandırın.
- Bir Itanium C ++ vtable, tipinfo ve yer değiştirme isimlerini okuyun ve bir yuvaya sanal bir çağrı çözün.

## Sorun

- Sen topladın .`account.c`- Hayır .`-g`Bir ajanı ne diye sordu.`bump`Ajan nesneyi Ghidra 12.1.4'e gönderdi ve geri aldı:

```c
void bump(long param_1,int param_2)
{
  *(int *)(param_1 + 4) = param_2 + *(int *)(param_1 + 4);
  return;
}
```

Aynı kaynakla oluşturulmuş .`-g`Aynı dekompilerden verilmiş:

```c
int bump(account *a,int by)
{
  a->balance = by + a->balance;
  return a->balance;
}
```

Bu nedenle, bu tabloyla ilgili olarak, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir dizi metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, bir metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin, metin`int`Adı:`balance`Bu olmadan , dekompiler sadece 8 byt genişliğinde bir şey geldiğini bilir .`%rdi`ve 4 byte'de `+4`Okuduk ve yazıldılar.

Bu tabloda her şeyin kaynağı vardır.`addl 0x4(%rax), %ecx`Genişlik 4 ından geliyor .`l`İsim bir `DW_TAG_member`Giriş `.debug_info`Bu ders iki yarı oluşturur: talimatların kanıtladığı şeyi geri alan bir geçiş ve kompiliörün kaydettiği şeyi çözen bir okuyucu.

```figure
re-41-struct-recovery
```

## Üyelik Erişimi Deplaşması

Intel SDM Cild 1, bölüm 3.7.5, etkin adresin  olarak tanımlandığını belirtir.`Offset = Base + (Index * Scale) + Displacement`, 1, 2, 4 veya 8'lik bir ölçekle ve 8, 16 veya 32 bitlik bir yer değiştirme ile.`RIP + Displacement`. Strukt üye erişiminde, indekssiz ilk form kullanılır: temel kayıt, nesnenin adresini ve yer değiştirme üye sıfırını içerir. Bir dizide erişim indeks terimini ekler ve ölçek veya ayrı bir katılımcı eleman boyutunu taşır.

Al .`bump`- ...`-O0`- Listeden .`llvm-objdump -d -r`Bu da şöyle:

```text
       4: 48 89 7d f8                  	movq	%rdi, -0x8(%rbp)
       e: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      12: 03 48 04                     	addl	0x4(%rax), %ecx
      15: 89 48 04                     	movl	%ecx, 0x4(%rax)
```

Çözümleme`03 48 04`Dersin kuralları ile 33.`03`- Evet .`ADD r32, r/m32`ModRM `48`- Evet .`01 001 000`- Evet .`mod = 01`8 bitlik bir yer değiştirme ile bir hafıza operandı anlamına gelir. `reg = 001`- Evet .`%ecx`- Evet .`r/m = 000`- Evet .`%rax`- Deplacement byte `04`- Kural 4 byte okur .`%rax + 4`ve onları `%ecx`- Ne ?`l`İleği `llvm-objdump`Baskılar operand boyutunda, bu yüzden alanın genişliği 4 byte.`%rax`Çizgilik boşluğundan geldi .`-0x8(%rbp)`, ve bu boşluk aldı .`%rdi`, Sistem V çağrı kuralı altında ilk tam sayı argümanı. Üç gerçek aşağıda: ilk parametresi bir işaretçi, işaret ettiği nesne 4 byet bir alanı vardır ofset 4, ve `bump`O alanı okuyor ve yazıyor.

Bu baytlarda hiçbir şey söylemiyor .`int`- Evet .`balance`veya`struct account`Hiçbir şey nesnenin ne kadar büyük olduğunu söylemez.`bump`- Evet .

## Sistem V düzen kuralları

x86-64 psABI, bölüm 3.1.2, toplamalar için üç kural verir. "Yönemler ve sendikalar en sıkı bir şekilde uyumlu bileşenlerinin hizalanmasını varsayırlar. Her üye uygun hizalanma ile en düşük mevcut ofset'e atılır. Her nesnenin boyutu her zaman nesnenin hizalanmasının katııdır". Aynı belgenin 3.1 Şekili skalar boyutları ve hizalanmaları verir: `char`1 ve 1'i,`short`2 ve 2, `int`4 ve 4'e.`double`8 ve 8, herhangi bir işaretçi 8 ve 8.

Kurallar, yapılara uygulanmalıdır.`account.c`- ...

```c
struct account {
    char kind;
    int balance;
    short code;
    double rate;
    const char *label;
};
```

| Member | Size | Alignment | Lowest offset that fits | Padding before |
|---|---|---|---|---|
| `kind` | 1 | 1 | 0 | 0 |
| `balance` | 4 | 4 | 4 | 3 (bytes 1 to 3) |
| `code` | 2 | 2 | 8 | 0 |
| `rate` | 8 | 8 | 16 | 6 (bytes 10 to 15) |
| `label` | 8 | 8 | 24 | 0 |

Son üye 32'de sona erer. En sıkı düzeltme 8, 32'nin de 8'in katı olması, bu nedenle boyutu 32'dir.

Üyelerin sırası büyüklüğü belirler.`double, pointer, int, short, char`0'u, 8'i, 16'u, 20'i, 22'i ve 23'e kadar döngülmüş olan 23'e kadar tamamlanır. `sysv_layout()`İçeride`code/main.py`Python'un üç kuralını uyguladığında her iki sonuç da elde edilir.`ctypes`modül, host kompozisyonunun bir kuralı ile aynı kuralları uyguluyor ve `ctypes.sizeof`- Evet .`ctypes.alignment`, ve `.offset`Her alanın 32, 8 ve `0, 4, 8, 16, 24`Bu makineyi oluşturduğunuzda programın kendisi üçüncü kopyayı basıyor:

```text
sizeof 32 align 8
kind 0 balance 4 code 8 rate 16 label 24
sum 315 tag -3 projected 318.75 label_length 7
```

Bu yerel yapı, arm64'dir. Arm AAPCS64 bölüm 5.10.1'de aynı toplam kuralları belirtir ve Apple'ın arm64 belgesi bu beş skalar boyutunu korur, bu nedenle rakamlar iki hedefte uyumlu olur.`-target x86_64-unknown-linux-gnu`Böylece ders 33'ten ELF okuyucu ve aşağıdaki DWARF okuyucu bunları üzerinde çalışacak.

## Yapıların Geri kalanını Elden Oku

`bump`Diğer dört işlev `account.c`Diğerleri de farklı bir talimat formunu gösterir.`account-x86_64-O0-g.objdump.txt`- Evet .

`sum_balances`Struktörün bir diziyi indeksize eder:

```text
      51: 48 8b 45 f8                  	movq	-0x8(%rbp), %rax
      55: 48 63 4d ec                  	movslq	-0x14(%rbp), %rcx
      59: 48 c1 e1 05                  	shlq	$0x5, %rcx
      5d: 48 01 c8                     	addq	%rcx, %rax
      60: 8b 40 04                     	movl	0x4(%rax), %eax
```

`%rax`- Evet .`list`- Evet .`%rcx`- Evet .`i`64 bitlik bir işaretle uzanmış ve `shlq $0x5`32 çarpı çarpı.`addq`- Evet .`%rax`- Evet .`list + 32 * i`, ve yük 4 byet olarak öğenin 4 ' ün tersine okur `i`Bu nesnede, yapı boyutunun bir sayı olarak görünen tek yer var.`0x49`- ...`jmp 0x49`- ...`0x72`- Evet .

`tag`İki dar alanı okuyor:

```text
      8c: 0f be 00                     	movsbl	(%rax), %eax
      98: 0f bf 48 08                  	movswl	0x8(%rax), %ecx
```

`movsbl`0'da bir byte yükler ve onu işaretle uzatır, bu yüzden 0'daki alan imzalı 1 byte tam bir sayıdır. `movswl`8. ofset'te iki byte yüklerken, işaret uzantısı ile, 8. alanın imzalanan 2 byte tam bir sayı olduğu ortaya çıkar.`-O1`İlk erişim `cmpb $0x6c, (%rdi)`, yine de 0'da 1 byte diyor ve işaret hakkında hiçbir şey söylemiyor.

`projected`Bir kayganı okuyor:

```text
      cc: f2 0f 2a 40 04               	cvtsi2sdl	0x4(%rax), %xmm0
      d5: f2 0f 59 40 10               	mulsd	0x10(%rax), %xmm0
```

`cvtsi2sdl`32 bitlik imzalanan bir tam sayıyı bellekten çiftine dönüştürür. Bu da ofset 4'ün imzalanan 4 byet tam sayıyı taşıdığını doğruluyor. `mulsd`hafızadan iki katına çarpır, bu yüzden 16'nın 8 baytlı bir akış noktası değeri var.

`label_length`bir işaretçi okuyor ve sonra takip ediyor:

```text
      f3: 48 8b 40 18                  	movq	0x18(%rax), %rax
      f7: 48 63 4d f4                  	movslq	-0xc(%rbp), %rcx
      fb: 80 3c 08 00                  	cmpb	$0x0, (%rax,%rcx)
```

- Evet .`movq`Bu 8 byte bir bütün sayıdır.`cmpb`Bir adres olarak kullanılan bir değer bir işaretçi.`cmpb`indekste 1 byte okuyor `%rcx`Bu yüzden de`-O1`işaretçi ileriye doğru `leaq 0x1(%rcx), %rcx`Bu da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da bir yandan da da da bir yandan da bir yandan da da da bir yandan da da bir yandan da bir yandan da da bir da bir da bir da bir da bir da bir da bir da bir da bir da bir da bir da bir da da da da da bir da bir da bir da bir da da da bir da bir da bir da

Beş fonksiyonu bir araya getirirsek yapı `{ i8 at 0, i32 at 4, i16 at 8, f64 at 16, pointer at 24 }`1 ila 3 ve 10 ila 15 arasındaki boşluklar, psABI kurallarının öngördüğü dolgulama şeklidir.`const char *`, 0 ' da imzalanan baytın açıklanmış türü , kaynak tarafından yazılmıştır `char`, ve beş fonksiyonun aynı tipte olduğunu.`main`, ki bir çerçeve nesnesini tüm beşine geçirir.`-O0`Çağrı siteleri bunu görülebilir hale getirir: `leaq -0x70(%rbp), %rdi`Ardından `addq $0x20, %rdi`Daha önce`callq bump`ve`addq $0x40, %rdi`Daha önce`callq tag`- 0'luk oranı.`0x20`ve`0x40`Bir dizi üç unsur ve `memcpy``0x60`Bu, 32'nin üç elementini oluşturan 96 byt'tır.

## Geçit

`trace_function()`İçeride`code/main.py`Bir tutıcı 64 bitlik bir kayıt veya bir çerçeve boşluğu gibi `-0x8(%rbp)`Her sahibin üç değerden biri vardır.`Pointer`bir adımın bir adımın bir bilinmeyen katı sayısı eklendiğini kaydettiği bir kök artı sabit bir sıfır artı bir adımlar kümesi.`Index`Bilinmeyen bir değerin tam bir sayısıdır.

Devlet , altı Sistem V argüman kayıtlarının olması ile başlar .`Pointer("param0", 0)`- Evet .`Pointer("param5", 0)`O zaman her talimat bir kuralı uyguluyor:

- A.`movq`64 bitlik bir kayıt ve çerçeve boşluğu arasındaki değer kopyalanır. 32 bitlik veya daha dar bir kayıt kayıt bir kayıt yapar `Index`1 ölçeği ile.
- A.`leaq`Bir işaretleme tabanı ile bir işaretleme oluşturur ve bir indeks kaydı ile ekler `scale * index_scale`- Yapacak adımlar.`leaq`Kimin tabanı `%rbp`veya `%rsp`Bir çerçeve nesnesinin adını verir, bu nasıl olur?`main`Geçitler`rows`- Evet .
- `shlq $n`Bir `Index`ölçeğini çarpır `2^n`ve`imulq $k`çarpı `k`- Evet .
- `addq`Bir işaretçi ve bir gösterge göstergeyi tutar ve gösterge ölçeğini adımlara ekler. `addq $k`Bir işaretçiye karşı çıkışını hareket ettirir ve bu kayıtların bir artışı olarak da kaydedilir.
- Bir çağrı, her aramacı kaydedilen kayıtları bilinmez hale getirir ve işaretleri tutan argüman kayıtları bir arama sitesi olarak kaydedilir.
- Bas kayıtları bir işaretçiyi taşıyan her hafıza operandı bir `Access`İzleyenin kökü ve sıfırı, genişliği ve türü ile mnemonik ve bir depo bayrağı.

Genişlik ve tür sadece mnemonikten gelir.`access_width()`haritalar `b`- Evet .`w`- Evet .`l`ve`q`1, 2, 4 ve 8 bayt için sufişler, `movsbl`ve `movswl`İmza edilen dar yüklere,`movzbl`İmza edilmemiş olanlara,`sd`ve `ss`8 byet ve 4 byet yüzenlere verilen skalar SSE talimatları, `cvtsi2sdl`İmzalanmış 4 bayt tam sayı kaynağına ve 16 bayt `movaps`Bir vektöre aile. `leaq`ve `nop`Formular erişim değildir.

```python
if memory.base in FRAME_REGISTERS:
    return Pointer(f"frame({memory.base}{format_signed(memory.displacement) if memory.displacement else ''})", 0)
base = env.get(memory.base)
if not isinstance(base, Pointer):
    return Unknown
strides = set(base.strides)
if memory.index is not None:
    index_value = env.get(memory.index)
    strides.add((index_value.scale if isinstance(index_value, Index) else 1) * memory.scale)
return Pointer(base.root, base.offset + memory.displacement, frozenset(strides), base.origin)
```

Bir işaretçi aracılığıyla 8 byte yüklenmesi, köken adı alanı oluşturan yeni bir işaretçi üretir, örneğin `param0->0x18`Bu değer daha sonra bir temel olarak kullanıldığında veya `leaq`Bu kural, "8 byte"den "pointer"e çeviren 24'i karşılaştırır.

### Dört çeşit adım kanıtı

`infer_layout()`Her tanık fonksiyonunun erişimlerini birleştirir ve her bir adımın ürettiği talimat ile birlikte dört kaynağından bir araya getirir.

| Kind | Where it comes from | Build that shows it |
|---|---|---|
| `scale` | an `Index` with scale above 1 reached a pointer, from `shlq $0x5` or `imulq` | `-O0`, `shlq $0x5, %rcx` at `0x59` |
| `loop-step` | a 64-bit increment of the base or index register inside a loop that also contains the access | `-O1`, `addq $0x20, %rdx` at `0x24` |
| `offset-delta` | same-width accesses through one base register inside one loop, at offsets a constant apart | `-O2`, eight loads 32 apart |
| `call-site` | the offsets at which one frame object is passed to the witness functions | `-O0`, `main` passes `rows`, `rows+0x20`, `rows+0x40` |

Bir döngü geriye döner .`jmp`Bu kural,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           `addl $0x1, %eax`Bu ilerliyor.`i`- ...`-O0`, çünkü 32 bit bir eklemedir ve erişim geçmediği için `%eax`Son adım, bulunduğu her değerin en büyük ortak bölücüdür.

### -O2'deki vektörlü döngü

- Evet .`-O2`Klang vektörler `sum_balances`- Çubuk vücudu .`0x50`- ...`0xaa`Bir geçit için sekiz element okuyor:

```text
      3b: 48 8d 87 e4 00 00 00         	leaq	0xe4(%rdi), %rax
      50: 66 0f 6e 50 80               	movd	-0x80(%rax), %xmm2
      55: 66 0f 6e 98 60 ff ff ff      	movd	-0xa0(%rax), %xmm3
      61: 66 0f 6e 90 40 ff ff ff      	movd	-0xc0(%rax), %xmm2
      69: 66 0f 6e a0 20 ff ff ff      	movd	-0xe0(%rax), %xmm4
      7d: 66 0f 6e 10                  	movd	(%rax), %xmm2
      81: 66 0f 6e 58 e0               	movd	-0x20(%rax), %xmm3
      8a: 66 0f 6e 50 c0               	movd	-0x40(%rax), %xmm2
      8f: 66 0f 6e 60 a0               	movd	-0x60(%rax), %xmm4
      a0: 48 05 00 01 00 00            	addq	$0x100, %rax
      aa: 75 a4                        	jne	0x50 <sum_balances+0x40>
```

`%rax`Başlıyor .`list + 0xe4`Sekiz yer değiştirme yükleri karıştırmalara yerleştirir .`0x04, 0x24, 0x44, 0x64, 0x84, 0xa4, 0xc4, 0xe4`-`list`, ki `4, 36, 68, 100, 132, 164, 196, 228`- Artış `0x100`Bu sayede, bir geçit, görüldüğü gibi, 8 alan ve en az 232 bytelik bir yapı rapor eder.

`fold_unrolled()`Bir döngü içinde, aynı genişliğe sahip erişimleri bir baz kayıtçası üzerinden alın.`d`Eğer döngü adımları `k * d`Ve tam olarak var.`k`Ayrılıklı sıyrılar, döngü çözüldü.`k`Zamanlar ve her erişim aynı eleman erişimini ofset olarak `(offset - lowest) mod d`- İşte .`256 = 8 * 32`8 kargoyla kargoya 4'e katılır ve adımlar kaydedilmektedir.`offset-delta 32`- Evet .`unrolled 32`ve`loop-step 256`- Skalare kalıntı döngüsü`0xe0`ekliyor `scale 32`-`shlq $0x5, %rdx`ve `loop-step 32`-`addq $0x20, %rdx`Beş değerin en büyük ortak bölücü 32'dir.

Şekilde katlanmayı kapatan bir düğme var.`-O2`Bu durum, bu halka olmadan yer değiştirme güvenen bir okuyucu tarafından görülen bir durumdur.

## DWARF 5 Bytes'ten

- Evet .`-g`yapılandırma`account.c`Sekiz tane defekt bölümü var.`.debug_info`493 byte.`.debug_abbrev`179, `.debug_str`230, `.debug_str_offsets`124, `.debug_addr`112, `.debug_line`312, `.debug_line_str`12, ve `.debug_frame`264. DWARF 5 standart listelerinin kullanılması `.debug_str_offsets`- Evet .`.debug_addr`ve`.debug_line_str`5. versiyonda yeni olarak.`code/main.py`İlk beş tane lazım.

### Birim başlığı

Standartın 7.5.1.1 bölümünde, toplam birim başlığı verilmiştir: `unit_length`- Evet .`version`- Evet .`unit_type`- Evet .`address_size`ve`debug_abbrev_offset`İlk 12 byte .`.debug_info`Bunlar:

```text
e9 01 00 00   unit_length = 0x1e9 = 489
05 00         version = 5
01            unit_type = DW_UT_compile
08            address_size = 8
00 00 00 00   debug_abbrev_offset = 0
```

- Evet .`unit_type`Bu sayede, bir sonraki birim `4 + 489 = 493`Bölümün sonunda.`llvm-dwarfdump --debug-info`Aynı beş değerleri yazdırır `Compile Unit:`İlk test bu çizgiyi inceliyor ve karşılaştırıyor.

### Kısacalar

Bölüm 2.1'de, her defuggerleme bilgisi girişinin "bir tanımlama etiketinden ve bir dizi özelliğinden oluştuğu" belirtilmektedir.`.debug_abbrev`Bu nesne 14 açıklamada bulunur. Burada iki önemli konu vardır:

```text
[12] DW_TAG_structure_type  DW_CHILDREN_yes
     DW_AT_name              DW_FORM_strx1
     DW_AT_byte_size         DW_FORM_data1
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
[13] DW_TAG_member           DW_CHILDREN_no
     DW_AT_name              DW_FORM_strx1
     DW_AT_type              DW_FORM_ref4
     DW_AT_decl_file         DW_FORM_data1
     DW_AT_decl_line         DW_FORM_data1
     DW_AT_data_member_location  DW_FORM_data1
```

`parse_abbreviations()`ULEB128 kodu, ULEB128 etiket, bir çocuk bayt, sonra bir `0, 0`7.5.6 bölümünde form kodlamaları bulunmaktadır: `data1`1 byte.`ref4`birim ile ilişkili 4 baytlı bir sıfırlama. `strx1`dizileri karşılaştırma tablosuna 1 baytlı bir indeks. `sec_offset`ve `data4`4 byte.`addrx`adres tablosuna ULEB128 indeksi olarak yerleştirilmiştir. `exprloc`ULEB128 uzunluğu ve bu çok bayt, ve `flag_present`Hiç bayt yok.

### Balanç üyesini el ile çöz

 için yapı giriş`account`- Ofset'ten başlıyor.`0x195`Baytlarla `0c 15 20 00 03`Kısaca 12'e ait bir kod, yapı.`DW_AT_name`İndeks dizilisi `0x15`- Evet .`DW_AT_byte_size`- Evet .`0x20`= 32,`DW_AT_decl_file`0 ve `DW_AT_decl_line`3'ün çizgisi.`struct account {`Kaynağı.

İkinci üye girişleri `0x1a3`- Evet .`0d 10 88 01 00 00 00 05 04`- ...

1. `0d`13 kısaltması, bir üye.
2. `10`- Evet .`DW_AT_name`- Evet .`strx1`: string index 16.
3. `88 01 00 00`- Evet .`DW_AT_type`- Evet .`ref4`: karşılığı `0x188`Birim başlangıcından itibaren, yani `DW_TAG_base_type`Adı:`int`- Evet .
4. `00`- Evet .`DW_AT_decl_file`ve `05`- Evet .`DW_AT_decl_line`: 5 satır `account.c`- Evet .
5. `04`- Evet .`DW_AT_data_member_location`: 4.

Bölüm 5.7.6 'da bir üye girişinin "ya DW_AT_data_member_location özelliğine veya DW_AT_data_bit_offset özelliğine sahip olabileceğini" ve tam bir sayı sabitinin "aşıyan bir varlıktan itibaren baytlarda karşılaştırıldığını" belirtmektedir. Bu bayt, `addl 0x4(%rax), %ecx`ve`compare_layouts()`Bu iki şeyi bir kenara koyan fonksiyon.

### İpi ve adresler iki tabloda geçer

İpiş indeks 16 bir sıfırlama değil `.debug_str`Okuyucu alır .`DW_AT_str_offsets_base`8 olan birim girişinden 4 bayt girişini okur `8 + 4 * 16`İçeride`.debug_str_offsets`Bu giriş , `"balance"`İçeride`.debug_str`Aynı indirektlik adreslere de geçerlidir.`sum_balances`Baytlarla başlar `07 07`: kısaltma 7, bir alt program, sonra `DW_AT_low_pc`- Evet .`addrx`indeks 7. 8 baytlı giriş `8 + 8 * 7`İçeride`.debug_addr`- Evet .`0x30`, fonksiyonun adresi `.text`Bu tabloda ilk altı giriş, altı satırlı yazılardaki adreslerdir.

Yer değiştirilebilir bir nesnedeki hiçbir tablo son değerlerini tutmaz.`.debug_str_offsets`Dosyada sıfırdır ve `.rela.debug_str_offsets`29'u tutmaktadır.`R_X86_64_32``.debug_str`Ek olarak gerçek tazminat ile.`.debug_addr`13'ü var.`R_X86_64_64``.text`ve `.rodata.str1.1`- Evet .`.debug_info`Dört farklı yer değiştirme sistemi vardır: kısaltma ofset,`DW_AT_str_offsets_base`- Evet .`.debug_str_offsets+0x8`- Evet .`DW_AT_stmt_list`ve`DW_AT_addr_base`- Evet .`.debug_addr+0x8`- Evet .`ElfObject.relocated()`uygulanır .`S + A`Okur bir bölüm analizini yapmadan önce 32 bit ve 64 bit türleri için. Bir bölüm simgesi bir nesne dosyasında 0 değerine sahiptir, bu nedenle alan eklemeyi alır. `llvm-dwarfdump`aynı çözünürlükte, bu yüzden çıkış her çözünürlükte isim ve adresleri gösterir.

### Tipler, fonksiyonlar ve yerler

`DwarfInfo.type_name()`Bu da ...`DW_AT_type`İpuçlar.`label`üye noktaları bir `DW_TAG_pointer_type`, bir `DW_TAG_const_type`, bu da `char`Bas tip, bu yüzden isim `const char *`- Evet .`type_size()`Devamı`DW_AT_byte_size`Temel türler ve yapılarda, bir işaretçi için 8 ve bir dizi için element boyutunun sayısını çarpı. `type_kind()``DW_AT_encoding`Üst tipten `int`bir işaretle, veya`float`, ve  için bir işaretçi tipi`pointer`, bu da karşılaştırma kullanan kelime birikimi.

`DwarfInfo.functions()`Altı okur.`DW_TAG_subprogram`Girişler.`bump``0x0`- ...`0x21`, yani `DW_AT_low_pc`artı `DW_AT_high_pc`Uzunluğu. Çerçeve tabanı `DW_OP_reg6 RBP`, ve parametre `a`konum ifadesini içerir `91 78`- Evet .`DW_OP_fbreg`SLEB128 değeri ile `0x78`Bu da çerçeve boşluğu.`-0x8(%rbp)`listelenmenin depolanması`%rdi`Adresinde`0x4`Debug bilgisi ve talimatlar aynı boşluğu iki taraftan açıklar.

## İki Yöntemin Karşılaştırılması

`compare_layouts()`DWARF üyelerini yürütür ve aynı sıyrıtındaki çıkarılan bir alanı arar.`no-evidence`Farklı boyutlu bir alan`size-mismatch`Alanı hiç geri alınmamış bir işaretçi üyesi`pointer-unproven`. Anıtlamalarda tam sayı aritmetik kullanıldığı bir float gibi, aynı fikirde olmayan bir tür, `kind-mismatch`Üyelik veya yastık içinden başlayan yerleşik alanlar `unexpected`Boyut adımları karşılaştırır .`DW_AT_byte_size`- Evet .

Üç yapı için numaralar, `python3 code/main.py`- ...

| Build | Accesses through the first parameter | Fields | Stride evidence | Members matched | Size |
|---|---|---|---|---|---|
| `-O0` | 11 | 5 | `scale 32`, `call-site 32`, `call-site 64` | 5 of 5 | 32, match |
| `-O1` | 9 | 5 | `loop-step 32` | 5 of 5 | 32, match |
| `-O2` | 17 | 5 after folding, 12 before | `offset-delta 32`, `unrolled 32`, `loop-step 256`, `scale 32`, `loop-step 32` | 5 of 5 | 32, match |

Sonuçlanan boşluklar her yapıdaki 1 ila 3 ve 10 ila 15 bytlerdir ve bunlar tam olarak DWARF düzeninin doldurma bytleri.`natural_alignment_ok()`Kayıtlar.

İşlevleri birbiriyle ekle ve resim değişir.`bump`Tek başına düzen 4'ün karşılaştırmasında bir alan, boyut bilinmemektedir ve alt sınır 8'dir. `sum_balances`adımını ekler.`tag`0 ve 8 oranlarını ekler. `projected`16'da yüzen ekliyor.`label_length`24'e işaretçi ekler ve işaretçi olduğunu kanıtlar. `main``-O0`Ve hiçbir şey eklemez.`-O1`ve `-O2`Bu sayede her yapılandırma için bu sırayı geçiyor.

Üç şey ulaşılmaz.İsimler talimatlarda bulunmuyor.`const`- Bu talimatlarda bulunmuyor.`label`sadece "elementler 1 byte ayrı" `leaq 0x1(%rcx), %rcx` ile uyumlu olan string döngüsünde`char`ve ile`unsigned char`ve `_Bool`- Ne ?`-O1`0'da byte işaretinin bilinmemesi, çünkü `cmpb $0x6c, (%rdi)`- Uzatmadan karşılaştırmalar yapılıyor.`int8`Orada ve`i8`- ...`-O0`, nerede `movsbl`Bu gerçekler ders 35 kayıtları bilinmeyen olarak.

## C++ nesneleri

`shapes.cpp`tanımlar `Shape`Sanal bir yıkıcı, saf bir sanal `area()`, ve sanal bir `name()`ve`Rect`, `Shape`ve iki ekliyor.`int`Itanium C++ ABI, clang'ın x86-64 Linux'ta bunları nasıl düzenlediğini yönetir.

### Bozuk isimler

ABI'nin 5.1.2 bölümünde "Bir isim, öntanımla bozulur" der.`_Z`Bu nesne 19 simgeye sahip.`_ZNK4Rect4areaEv`Bu da şöyle:`_Z`O zaman ...`N`Yatağındaki isim için,`K`const üyesi işlevi için, `4Rect`ve `4area`uzunlukla belirlenmiş kaynak isimleri olarak, `E`Yatağındaki isim kapatmak için ve`v`boş bir parametrelist için. `llvm-cxxfilt`Parmak izi`Rect::area() const`- Evet .`_Z8describeRK5Shapei`- Evet .`describe(Shape const&, int)`- Evet .`R`referans olarak kullanılır.`K`- sabit.`5Shape`sınıfı.`i`- Evet .`int`5.1.4 bölümdeki özel isimler `_ZTV`bir masa için,`_ZTI`tipinfo için ve `_ZTS`Typeinfo isimleri dizisi için.`C1`- Evet .`C2`- Evet .`D0`- Evet .`D1`ve`D2`- Evet .`_ZN4RectD0Ev`ve `_ZN4RectD2Ev`İkisi de basılı .`Rect::~Rect()`: silme yıkıcısı ve temel nesne yıkıcısı bir kaynak adı paylaşırlar.

`Demangler`İçeride`code/main.py`Bu alt kümeni ve 5.1.5.2 bölümünün yapı tipi kodlarını kapsar.`S_`5.1.10 bölümünün yerine getirilmesi. Test tüm 19 isimle çalıştırılır ve yakalananlarla karşılaştırılır.`llvm-cxxfilt --no-strip-underscore`output. macOS'ta bayrak önemli, araç varsayılan bir önde gelen altını çıkarır ve ardından tanımamaktadır `Z8describe...`- Evet .

### Yer değiştirmelerinden kaynaklanan

ABI'nin 2.5.2 bölümünde, sanal bir tabloun bileşenleri sırayla listelenir: sanal çağrı sıfırlamaları, sanal temel sıfırlamaları, üstteki sıfırlama, tipinfo işaretçisi ve ardından sanal fonksiyon işaretçileri. Adres noktası, bir nesnenin vptr değerinin, ilk fonksiyon işaretçisinin adresidir (2.6.2 bölüm). `Rect`Sanal tabanı yok, bu yüzden tablo üst, tipinfo ve fonksiyonlara karşılaştırılmıştır.

Simge .`_ZTV4Rect`Bu, 0x30 byte, 6 8-byte boşluk.`.rela.data.rel.ro._ZTV4Rect`- ...

```text
0000000000000008 R_X86_64_64              _ZTI4Rect
0000000000000010 R_X86_64_64              _ZN4RectD2Ev
0000000000000018 R_X86_64_64              _ZN4RectD0Ev
0000000000000020 R_X86_64_64              _ZNK4Rect4areaEv
0000000000000028 R_X86_64_64              _ZNK4Rect4nameEv
```

Slot 0, sıfırla yukarıya kadar sıfırlanır ve yer değiştirilmeye ihtiyaç duymaz. Slot 1 tipinfo.`+16`Oradan, 0'luk slot tam nesne yıkıcısı, 1'lik slot silme yıkıcısı, 2'lik slot.`area`, 3. bölüm`name`- Evet .`read_vtable()`simge boyutunu, aralığında yer değiştirmeleri ve sıfırı sıfırdan okur.`Shape`Masanın şekli aynı .`__cxa_pure_virtual`2. slot'da, saf bir sanal çağrıya ulaşan çalıştırma süresi fonksiyonu.

### RTTI

Bölüm 2.9.4'te `std::type_info`bir vptr olarak, mangled tip adına bir işaretçi ile takip edilir ve elde edilen sınıfları listeler. `_ZTI4Rect`Üç yer değiştirdi: `_ZTVN10__cxxabiv120__si_class_type_infoE+0x10`- Evet .`_ZTS4Rect`ve`_ZTI5Shape`Birincisi , Vtable ' deki`__si_class_type_info`, ABI'nin sıfır sıfırında tek bir kamu-virtual olmayan tabanlı bir tip için kullandığı sınıf ve `+0x10`Bu vtable'nin adres noktası.`4Rect`, ki bu da kırık tip adı ve `name()`Bir .`type_info`Üçüncü, taban.`_ZTI5Shape`kullanımı `__class_type_info`Ve bir temel işaretçisi yok.`read_typeinfo()`Bu üç gerçeği geri verir.

### Sanal çağrı

`describe`- ...`-O0`Bir sanal çağrı yapar:

```text
       f: 48 8b 7d f8                  	movq	-0x8(%rbp), %rdi
      13: 48 8b 07                     	movq	(%rdi), %rax
      16: ff 50 10                     	callq	*0x10(%rax)
```

İlk .`movq`İkinci birinde, nesneyi vptr olarak adlandırılan 0'da 8 byte okuyor, çünkü ABI onu ilk olarak sanal fonksiyonlu bir sınıfa yerleştirir.`callq`Geçer.`0x10`VPTR'den geçti ve`0x10 / 8`2. bölüm.`find_virtual_calls()`İhtiyacımız olan iki adayla aynı şekilde konuşur ve raporlar verir: `Rect::area() const`-`_ZTV4Rect`ve `__cxa_pure_virtual`-`_ZTV5Shape`Hangisi çalışacak, nesneye bağlıdır, bu yüzden arama dolaylı.

DWARF aynı bölgeyi kaydeder.`DW_TAG_subprogram` için girişler`area`Her iki sınıf da taşıyıcıdır.`DW_AT_vtable_elem_location (DW_OP_constu 0x2)`- Evet .`name`3 numaralı slot taşıyor, destruktorlar 0 numaralı slot taşıyor.`Rect`- bir`DW_TAG_structure_type`16 bytelik bir `DW_TAG_inheritance` için giriş`Shape`0 ve üyeleri `w`8 ve `h`Saat 12.`Shape`8 byte bir yapay üye ile `_vptr$Shape`İki bağımsız türeç 2 bölümü verir `area`: yer değiştirme tablosu ve hatalama girişleri.

- Evet .`-O1`nesne hiçbir şekilde vtable'a sahip değil.`main`yapıları `Rect`Yerel olarak, böylece derleyici çözüldü `r.name()`ve `describe(r, 2)`Bu yüzden tablo yayınlanmıyor. `describe`Hala içerir `movq (%rdi), %rax`ve `callq *0x10(%rax)`, çünkü parametri herhangi bir olabilir .`Shape`Kayıp bir vtable bir nesne dosyası hakkında bir gerçek ve test `test_the_optimised_object_keeps_the_call_pattern_but_drops_the_vtables`İki yarısını da kontrol eder.

Microsoft ABI'nin bu detayların her biriyle farklılık gösterir.`?`Ve çağrı konvansiyonunu kodlayacağız.`void test(void)`C++ olarak oluşturulmuştur.`__cdecl`- Evet .`?test@@ZAXXZ`RTTI konumlandırıcısı `vfptr[-1]`bir `_RTTICompleteObjectLocator`, ve semboller `??_7`bir vftable ve `??_R4`Microsoft'un kendi belgeleri "kompilatör satıcıları arasında C++ isimlendirme standartları yoktur" diyor.

## Araçlar Nasıl Yenilen Türleri Tanıtır

Aşağıdaki her satırda bir çıkış adı var . Bu makine üzerinde üretilmiş ve içeriye kaydedilmiş .`code/fixtures/tools/`Burada kurulmayan aletler için satırlar, belgeleri anlatır ve böyle söyler.

| Tool | Version, licence | Where types live | On our fixtures |
|---|---|---|---|
| Ghidra | 12.1.4, 2026-09-21, Apache-2.0 | Data Type Manager with built-in, user-defined, and derived types; `.gdt` archives; types used by a program are copied into it | With DWARF: `/DWARF/account.c/account size=32 align=8` and `a->balance = by + a->balance;`. Without: `*(int *)(param_1 + 4)` with `long param_1`, `tag(char *param_1)`, and `*(char **)(param_1 + 0x18)` |
| IDA Pro | 9.4, 2026-07-13, commercial; IDA Free is non-commercial with a cloud decompiler for x86 only | Local Types window, `.til` type libraries, DWARF and PDB import into a `dwarf` or `pdb` folder | Not installed. Documentation only |
| Binary Ninja | 6.0, 2026-09-03, commercial with a Free edition | Type editing, header import and export, type archives, debug info from DWARF and PDB, type libraries, platform types | Not installed. Documentation only |
| radare2 | 6.2.4, 2026-10-05, LGPLv3 | `ts`, `tsc`, `afvd` | `ts` and `tsc account` printed nothing for the relocatable object with `bin.dbginfo=true`; `pdf` shows `mov dword [rax + 4], ecx` with source line comments from DWARF |
| rizin | 0.9.1, 2026-06-29, LGPL core | `ts`, `tsc`, `afvd` | `tsc account` printed `struct account { char kind; int balance; short code; double rate; const char *label; };` from DWARF; the build without `-g` lists only its bundled header types |
| lldb | lldb-1703.0.236.21 | `image lookup -t` | `byte-size = 32` and the full `compiler_type` text from the ELF object |
| gdb | not installed here | `ptype /o` prints "the offsets and sizes of fields in a struct" with holes marked | Documentation only |
| pyelftools | 0.33, public domain | Python API over `.debug_info` | A 43-line script prints the same five members and `unit version 5` |
| llvm-dwarfdump | Apple LLVM 17.0.0 | `--debug-info`, `--debug-abbrev`, `--debug-str-offsets` | The oracle for every reader test |

Ghidra'nın DWARF olmadan çıkışı aynı iki kuralın çalışmasını gösterir.`char *` parametreye kadar`tag`Çünkü işlev bir bayt ile karşılaştırılır ve `char **`Sahaya çıkmak için`0x18`Çünkü ...`label_length`yüklenmiş değerden ayrılır ve baytları karşılaştırır. Bu dersdeki geçiş aynı iki kuraldır: talimattan genişlik, işaretten işaret. Ghidra'nın dekompiler belgesinde, p-kod varnodlarının "her zaman onlarla ilişkili bir veri türüne sahip olmadığı" ve dekompilerin "sonunda yayım yoluyla resmi bir veri türü tahsis ettiği" belirtiliyor. "Konsant göstericileri yerleştir" seçeneği aynı yayılımı sabitlere uzattır. Ghidra 12.1 bu ders için kullanılan cihazlarda kullanılamayan bitfield recovery'i dekompilerle birlikte ekledi.

Ghidra'nın Veri Tipi Yöneticisi, IDA'nın Yerel Tipleri, Binary Ninja'nın Arşivleri ve Rizin'in `td`Bu sayede, tüm bu programlar, geri alınan düzenden struct'u yazıp, dekompiler yeniden gönderilmesini izleyebilirsiniz.

rea 6.5.0 Ghidra sağlayıcısı ile dekompiler metnini bir kayıt olarak gönderir. Ghidra satırındaki her şey ona uygulanır ve kayıt, tür isimlerini üreten kanıt olmadan taşıyor.`python3 code/main.py infer`Aynı listeye girerek de bu kanıtı bulmuşsunuz.

## Tip İflası Araştırmaları

Bu geçiş, bir tip çıkarma sisteminin kısıtlama-genreasyon yarısını, bir parametre ile elde edilen bir yapı ile sınırlı olarak gösterir.

- TIE (Lee, Avgerinos, Brumley, NDSS 2011) tip yeniden yapılandırmasını kısıtlama üretimi olarak çerçeveledi ve ikili bir IR üzerinde çözme, muhafazakârlığı ve hassasiyeti ölçtü ve 87 temel programda ticari bir dekompilerle karşılaştırdı.
- Retypd (Noonan, Loginov, Cok, PLDI 2016) alt türleme, polimorfizm ve rekürsiv türler ekledi ve gösterge yeniden yapılandırılması rapor edildi `const`GrammaTech'in adı altında açık kaynaklı bir uygulamada mevcuttur.
- OSPREY (Zhang ve diğerleri, IEEE S&P 2021) her bellek konumunu rastgele bir değişken olarak değerlendirir ve en olası türleri çıkarır.
- DIRTY (Chen ve diğerleri, USENIX Security 2022) ve ReSym (Xie ve diğerleri, CCS 2024) öğrenilmiş modellerle işlem sonrası dekompiler çıkışı ve ReSym, tam yapı düzenleri üzerinde 72,9% doğruluk raporları.
- RecStruct (Chen ve diğerleri, USENIX Security 2026), akış-ansız sembolik yürütme ve yığın boşlukları üzerinde birlik-görme ile, bir dekompiler olmadan yuvalanmış structs kurtarır.

Bu dersin geçişinin atladığı ilk şey, yığın yapısı.`-O1`- Evet .`main`- Devam ediyor .`rows`Düğme ve içe yazılmış kod üzerinde yazıyor .`0x24(%rsp)`- Evet .`0x40(%rsp)`- Evet .`0x48(%rsp)`- Evet .`0x30(%rsp)`ve`0x38(%rsp)`Bu modül 32 oranları 4, 0, 8, 16 ve 24'dir. Aynı yapı, ekmek için parametre yoktur.

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu beş parçalı. `dwarf`Birim başlığı, yapıları ve fonksiyonlarını içerir.`-O0`- Ne? - Ne?`oracles`psABI kural düzenini içerir, `ctypes`düzen, DWARF düzen, yerel çalıştırma ve `agree`Bayrak.`builds`erişimleri, çıkarılan düzen ve üç nesnenin her biri için karşılaştırmayı içerir. `cxx`İsimleri, her iki vtables, her iki tipinfo kayıtlarını, sanal çağrı ve DWARF yuvalarını içerir. `tools`Kaydedilen araç çıkışlarını listeler.

Beklenen şekil:

```json
{
  "dwarf": {"unit": {"unitLength": 489, "version": 5, "unitType": "DW_UT_compile", "addressSize": 8, "abbrevOffset": 0}, "...": "..."},
  "oracles": {"agree": true, "psabiRules": {"size": 32, "align": 8, "...": "..."}, "...": "..."},
  "builds": {
    "O0": {"layout": {"stride": 32, "size": 32, "gaps": [1, 2, 3, 10, 11, 12, 13, 14, 15], "...": "..."}, "comparison": {"matches": 5, "members": 5, "...": "..."}},
    "O1": {"...": "..."},
    "O2": {"...": "..."}
  },
  "cxx": {"virtualCalls": [{"slot": 2, "candidates": {"Shape": "__cxa_pure_virtual", "Rect": "_ZNK4Rect4areaEv"}, "...": "..."}], "...": "..."}
}
```

Oku `code/main.py`Bu sırada:

1. `ElfObject`Bölümleri, sembolleri ve yer değiştirmeleri okuyor ve `relocated()`uygulanır .`S + A`Bir hata düzeltme bölümüne.
2. `parse_abbreviations()`ve `DwarfInfo._parse_unit()`Başlığı, kısaltma tablosunu ve girişleri okuyun ve sonra çözün `strx`ve `addrx`İki masa üzerinden.
3. `DwarfInfo.struct_layouts()`ve `functions()`Girişleri `StructLayout`ve `FunctionInfo`Kayıtlar, `type_name()`- Evet .`type_size()`ve`type_kind()`- Evet .
4. `parse_listing()`- Evet .`parse_memory()`ve`access_width()`Okuyun .`llvm-objdump`Mesaj.
5. `trace_function()`- Abstrakt devlet makinesi ve`fold_unrolled()`ve `infer_layout()`Girişleri bir düzenle dönüştürün.
6. `compare_layouts()`Durum satırlarını oluşturur ve `sysv_layout()`ve `ctypes_layout()`Diğer iki peygamber.
7. `Demangler`- Evet .`read_vtable()`- Evet .`read_typeinfo()`ve`find_virtual_calls()`C++ nesnesini kapsar.

Dört emir daha var.`python3 code/main.py dwarf FILE.o`DWARF 5'in yer değiştirilebilir nesnelerinin yapıları ve fonksiyonlarını yazdırır. `python3 code/main.py infer LISTING.txt [FILE.o]`Bir listeye geçiş yapar ve bir nesne ile DWARF'e karşı karşılaştırır. `python3 code/main.py demangle NAME...`ve `python3 code/main.py vtable FILE.o`C++'in yarısını kapsar.

## Kullan

Kendin inşa ettiğin yeni bir nesne üzerine:

1. Yakalama`llvm-objdump -d -r`Bu, bir nesneyi bir kenara bırakıp, bir nesneyi bir kenara bırakır.
2. Çık .`python3 code/main.py infer`Bir işlev eksikse, parametri bir hafıza operandına asla ulaşmadı veya geçiş izlemeyen bir yol boyunca birine ulaştı.
3. Her alanı erişim sayısıyla okuyun. Bir erişim bir tanık.
4. - Devamı kanıtını oku.`call-site`veya `scale`Giriş güçlü.`loop-step`Diğer bir türden bir giriş zayıfdır, çünkü bir yuvarlak bir döngü birkaç elementin adımını bildirir.`unrolled`Görünür, katılamayı elden kontrol et.
5. Eğer`-g`oluşturmak var, karşılaştırmayı çalıştırmak ve olmayan her satırı okumak `match`- A.`no-evidence`Satır bir üye adını verir.`unexpected`Geçit yerleştiremediği bir giriş için sıra isimleri.
6. Düzenlemeyi araçınızın tip yöneticisine bir yapı olarak yazın ve hangi alanların, isimlerin ve türlerin tahmin olduğunu kaydetin.

Üç müjdeciyi erişime bırak.`ctypes`, ve DWARF yazdığınız bir düzenle ilgili anlaşmazlıklarda, bir paketli yapı, bir bit alanı veya farklı kurallar ile bir hedef bulmuşsunuz.

## İnteraktif Laboratuvar

### Laboratuvar A: Üye girişini çöz

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types/code
python3 -q
```

Çık:

```python
from main import *
elf = load_object("account-x86_64-O0-g.o")
dwarf = DwarfInfo(elf)
dwarf.header()
elf.section(".debug_info").data[0x1a3:0x1ac].hex(" ")
dwarf.dies[0x1a3].attributes
dwarf.type_name(dwarf.type_of(dwarf.dies[0x1a3]))
```

Sözlüğü incelemeden önce dokuz bayt kağıt üzerinde 13 kısaltma ile çöz.`elf.section(".debug_str_offsets").data[8:16].hex()`, ve yer değiştirilmiş olan,`elf.relocated(".debug_str_offsets")[8:16].hex()`, ve farkı açıkla.

### Laboratuvar B: bir fonksiyonu izle

```python
listing = load_listing("account-x86_64-O0-g.objdump.txt")
trace = trace_function("label_length", listing["label_length"])
[(hex(a.address), a.root, a.offset, a.width, a.kind) for a in trace.accesses]
trace.pointer_uses
trace_function("sum_balances", listing["sum_balances"]).loops
```

İndirmeden önce, hangi erişimden, ofset 24'in bir işaretçi olduğunu kanıtladığını yazın.`-O1`listeler ve bulma `leaq 0x1(%rcx), %rcx`İçeride`trace.increments`- Evet .

### Laboratuvar C: vektörlü döngüyü katlayın

```python
o2 = load_listing("account-x86_64-O2-g.objdump.txt")
trace = trace_function("sum_balances", o2["sum_balances"])
sorted({a.offset for a in trace.accesses})
folded, evidence = fold_unrolled(trace, trace.accesses)
sorted({a.offset for a in folded}), [(e.kind, e.value, e.text) for e in evidence]
```

O zaman koş .`analyze_build("O2", fold=False)["comparison"]`Ve sayın `unexpected`Dönüş kuralını değiştir, böylece döngü adımının tam olarak olması gerekir.`k * d`- Evet .`k`En az 2 ve onaylayın ki `-O1`Bir giriş ve 32 adımla, yalnız kalır.

### Laboratuvar D: tablo ve isimler

```python
shapes = load_object("shapes-x86_64-O0-g.o")
read_vtable(shapes, "_ZTV4Rect")
read_typeinfo(shapes, "_ZTI4Rect")
demangle("_ZNK4Rect4areaEv"), demangle("_Z8describeRK5Shapei")
find_virtual_calls(load_listing("shapes-x86_64-O0-g.objdump.txt"), [read_vtable(shapes, "_ZTV5Shape"), read_vtable(shapes, "_ZTV4Rect")])
```

Çizgiyi hesapla `callq *0x10(%rax)`Kağıt üzerinde, sonra onaylayın.`DwarfInfo(shapes).struct("Rect").virtual_methods`- O zaman yüklen .`shapes-x86_64-O1-g.o`Ve denemek için .`read_vtable`- Bu kitapta oku.`ElfError`Simgolu neden yok olduğunu açıklayın.

## Pratik Laboratuvar

Düğüm yapılarını geri alın `main`- ...`-O1`- Evet .

Gereksinimler:

- Uzaklaştırma`trace_function()`Yani çerçeve boşluğu bölgesi bir kök olabilir.`movaps`Dükkanlar dolsun`0x0(%rsp)`- ...`0x5f(%rsp)`-`.data.rel.ro`, 96 baytlı başlangıçlayıcıdır `rows`- Evet .
- İçeride girişleri atfedin `0x24(%rsp)`- Evet .`0x40(%rsp)`- Evet .`0x48(%rsp)`- Evet .`0x30(%rsp)`ve`0x38(%rsp)`Bu kök ve rapor onların modulo bir aday adım karşılaştırır.
- 32 adımını döngüden çıkarın `0x120`- ...`0x12c`, nerede `%r14`4'te başlar ve ilerler.`0x20`- ... ...`0x64`, ve bu döngünün bağlandığını göster .`0x64`3 element artı alan sıfırlaması.
- Sonuçları DWARF düzenle karşılaştırın ve beş maçın içine girin ve hangi türlerin kanıtlanmamış olduğunu kaydetin.
- Çerçeve kökü bir parametre atfedildiğinde başarısız olan bir test ekleyin.

Başarılı olmak demektir .`python3 code/main.py infer`- ...`-O1`listeler listeleri `main`Çizgi kökü olan bir tanık olarak ve karşılaştırma beş eşleşme gösterir `main`- Yalnız.

## Ders Artifakti

Bu ders de içerir .`outputs/skill-recovering-data-and-types.md`. Bir listeni ve seçmeli bir defag yapısını bir alan için kanıtlı bir yapı düzeni, kaynaklarıyla bir adım, DWARF ile karşılaştırma ve bilinmeyenlerin bir listesine dönüştürmek için kullanın.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/41-recovering-data-and-types
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Verifikasyon, şunu kanıtlamalıdır:

- Birim başlığı, 14 kısaltma ve beş üyelik karşılığı `llvm-dwarfdump`
- Adlar yer değiştirilenler üzerinden gelir.`.debug_str_offsets`Masanın ve birimin `str_offsets_base`ve `addr_base`8
- Altı fonksiyon aralıkları taşır.`DW_OP_reg6 RBP`ve`DW_OP_fbreg`Toplama gösterdiği yerler ve düşük adresleri listelenme fonksiyonuna eşittir başlıyor
-  olmadan bir nesne`.debug_info`LEB128 dekodörleri ile birlikte `0x78`-8 olarak
- `pyelftools`ve `lldb`Okuyucu ile aynı düzeni bas
- psABI kuralları, `ctypes`, DWARF ve yerli çalıştırma karşılığı verir `0, 4, 8, 16, 24`ve 32 boyutlu, ve yeniden düzenlenmiş yapı 24 byte.
- listesi analizci 13 talimat okuyor `bump`, bağlayıcılar `R_X86_64_PLT32 bump-0x4`Telefonla görüşme için`0x194`, ve geriye atlamayı bulur .`0x72`
- AT&T metni ve mnemonikten hafıza operandları, genişlikleri, türleri ve işaretleri çözünür
- `bump`- ...`-O0`İzleyiciyi çerçeve boşluğundan geri okuyor ve 4'ün tersine üç kez girişi yapar.
- Bu adımın sebebi `shlq $0x5`- ...`-O0`, `addq $0x20, %rdx`- ...`-O1`, ve sekiz yükten 256 adımla katlanmış olarak `-O2`
- `label_length`Göstericini, referansı geri çevirerek, ofset 24'te göstericini kanıtlar.
- `main`0'da bir çerçeve nesnesini geçiyor. `0x20`ve`0x40`- ...`-O0`Ve sadece `printf`- ...`-O1`
- Her yapı 5 üyenin 5'ine 32 boyutlu ve DWARF dolguya eşit boşluklarla eşittir.
- `-O2`32 byte ve boyutsuz yedi alan rapor oluştur
- Demangler tüm 19'u yeniden üretiyor.`llvm-cxxfilt`ipler
- hem vtables hem de tipinfo kayıtları ve sanal çağrı.`0x16`2 numaralı yuva'ya karar ver. DWARF kabul ediyor.
- `-O1`C++ nesnesi çağrı kalıbını korur ve vtable yoktur
- Ghidra, rizin ve radar2 fotoğrafları, DWARF ile yapı ve olmadan ham karşılaştırmalar gösteriyor.
- İnteraktif rakam analizle elde edilen aynı verileri içerir.

## Üretim Başarısızlık Modları

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| Unrolled loop | Eight fields 32 bytes apart and a 232-byte struct | Loop step 256 equals 8 times the offset delta 32, so one field at offset 4 |
| Stride read from one increment | `sizeof` 256 from `addq $0x100` | The greatest common divisor of every stride source, with the scalar tail's `addq $0x20` |
| 8-byte field called a pointer | `void *` at offset 24 | A later access uses the loaded value as a base, or the kind stays `int64` |
| Pointer called an integer | `long` at offset 24 | The dereference at `0xfb`, recorded as pointer proof |
| Narrow compare | `char` with a sign | `cmpb` carries no sign; only `movsbl` or `movzbl` does |
| Five functions assumed to share a type | One struct with no evidence of aliasing | Call sites in `main` that pass one frame object, or an explicit analyst assertion |
| Strings read from `.debug_str` by index | Garbage names from a relocatable object | `str_offsets_base` plus the relocated `.debug_str_offsets` entry |
| Addresses read as numbers | `low_pc` of 0 for every function | `addrx` through the relocated `.debug_addr` table |
| DWARF 4 object | A reader that misparses the header | Version check on the second header field; 4 has no `unit_type` byte |
| Missing vtable | "the class has no virtual functions" | The `-O1` object inlined every call; the `-O0` object has the table and its relocations |
| Vtable slot read from the wrong base | Off-by-two slot numbers | The address point is 16 bytes past the symbol, after offset-to-top and typeinfo |
| Mangled name stripped | `Z8describeRK5Shapei` left as is | `--no-strip-underscore` on macOS, or a demangler that checks for `_Z` |
| Struct typed from one tool's guess | `char *param_1` taken as the field type | The width and the dereference, written as evidence, and the name marked as a guess |

## İşlem Kuralı

Bir girişten bir alan ve bir döngüden bir adım geri alın ve talimatı her birine bağlayın. Bir atışın ötesine güvenmeden önce, çözülmemiş döngüleri katlayın. DWARF'ı kısaltma ve yer değiştirilmiş tabloları üzerinden oku, hiçbir zaman bir dizilme bölümüne indeksleme yapmayın. Alanla alan karşılaştır ve her üyeyi kanıtsız, kanıtlanmamış her işaretçi ve her isim bilinmeyen olarak yaz. C++ nesnesinde, vtable'yi yer değiştirmelerinden ve çağradan boşluğu okuyun, sonra okuduğunuz boşluğu onaylamak için DWARF kullanın.

## Daha Fazla Okumak

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, section 3.1.2: Data Representation](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), section 5.10: Composite Types](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 1, section 3.7.5: Specifying an Offset](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [DWARF Debugging Information Format Version 5, sections 2.1, 5.7.6, 7.5.1.1, 7.5.3, 7.5.6](https://dwarfstd.org/doc/DWARF5.pdf)
- [Itanium C++ ABI, sections 2.5 (Virtual Table Layout), 2.9 (Run-Time Type Information), 5.1 (External Names)](https://itanium-cxx-abi.github.io/cxx-abi/abi.html)
- [Microsoft Learn: Decorated names](https://learn.microsoft.com/en-us/cpp/build/reference/decorated-names?view=msvc-170)ve [Name Decoration](https://learn.microsoft.com/en-us/cpp/error-messages/tool-errors/name-decoration?view=msvc-170)
- [llvm-dwarfdump command guide](https://llvm.org/docs/CommandGuide/llvm-dwarfdump.html)ve [llvm-cxxfilt command guide](https://llvm.org/docs/CommandGuide/llvm-cxxfilt.html)
- [Python ctypes: Structure layout, sizeof, alignment](https://docs.python.org/3/library/ctypes.html)
- [Ghidra Data Type Manager](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/help/help/topics/DataTypeManagerPlugin/data_type_manager_description.htm)- Evet .[Decompiler Concepts](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerConcepts.html)- Evet .[Decompiler Options](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Decompiler/src/main/help/help/topics/DecompilePlugin/DecompilerOptions.html)ve[Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.4_build)
- [IDA 9.1 user guide: Types](https://docs.hex-rays.com/9.1/user-guide/types)- Evet .[IDA 9.4 release post](https://hex-rays.com/blog/ida-9.4-release-a-new-dyld-shared-cache-swift-analysis-new-teams-add-on-and-more-)ve[IDA Free](https://hex-rays.com/ida-free)
- [Binary Ninja user guide: Types](https://docs.binary.ninja/guide/types/)ve [Binary Ninja 6.0 Krypton](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)ve [rizin v0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
- [GDB manual: Examining the Symbol Table, ptype /o](https://sourceware.org/gdb/current/onlinedocs/gdb.html/Symbols.html)
- [pyelftools on PyPI](https://pypi.org/project/pyelftools/)
- [Lee, Avgerinos, Brumley, "TIE: Principled Reverse Engineering of Types in Binary Programs" (NDSS 2011)](https://www.ndss-symposium.org/ndss2011/tie-principled-reverse-engineering-of-types-in-binary-programs/)
- [Noonan, Loginov, Cok, "Polymorphic Type Inference for Machine Code" (PLDI 2016)](https://arxiv.org/abs/1603.05495)ve [the retypd repository](https://github.com/GrammaTech/retypd)
- [Zhang et al., "OSPREY: Recovery of Variable and Data Structure via Probabilistic Analysis for Stripped Binary" (IEEE S&P 2021)](https://ieeexplore.ieee.org/document/9519451/)
- [Chen et al., "Augmenting Decompiler Output with Learned Variable Names and Types" (USENIX Security 2022)](https://www.usenix.org/conference/usenixsecurity22/presentation/chen-qibin)
- [Xie et al., "ReSym: Harnessing LLMs to Recover Variable and Data Structure Symbols from Stripped Binaries" (CCS 2024)](https://dl.acm.org/doi/10.1145/3658644.3670340)
- [Chen et al., "RecStruct" (USENIX Security 2026)](https://www.usenix.org/conference/usenixsecurity26/presentation/chen-yuxin)
