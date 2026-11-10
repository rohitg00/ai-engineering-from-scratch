# Sözleşmeleri ve Yüklü Çerçeve Çağırma: Sistem V, Windows x64, ve AArch64

> Bir parçacık bir fonksiyonun hangi kayıtları okuduğunu gösterir. Sadece ABI bu kayıtların ne anlama geldiğini söyler ve ABI nesne başlığı tarafından seçilir, bu nedenle bu ders başlığı önce okur ve sonra her kayıtları oraya koyan kurallara karşı kontrol eder.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 and AArch64 assembly
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow)
**Time:** ~140 minutes

## Öğrenme Hedefleri

- Nesne başlığından arama konvansiyonunu seçin: ELF x86-64 System V psABI, COFF AMD64 Microsoft x64, ELF AArch64 AAPCS64, Mach-O arm64 Apple'ın variansıdır.
- Her ABI için bir fonksiyonun byte byte'sinin önbölcüsünü çöz ve kaydedilen her kayıt, geri dönüş adresi ve çerçeve işaretçisini giriş yığın göstergesinden tersine yerleştir.
- Bir fonksiyonun parametrelerinin kayıtlarını, bunları yazmadan önce okuduğu kayıtlardan ve giriş yığın göstergesi üzerindeki yüklerden yığın argüman boşluklarını yerleştir.
- Microsoft x64'in konum yuvarlaklarından ve AAPCS64'in NGRN ve NSRN sayıcılarından Sistem V'nin bağımsız kayıt dizilerini söyleyin.
- Her sonucu kaynağın imzasına, spesifikasyondaki kurallara ve kompilicin kendi çözme verilerine karşı kontrol edin.`.pdata`- Evet .`.xdata`ve`.eh_frame`- Evet .
- Ghidra, IDA, Binary Ninja, radar2, rizin ve angr isimlerini karşılaştırın ve aynı gerçekleri geri alın ve çıktısının kaynağa katılmadığı yerleri kaydetin.

## Sorun

- Sen topladın .`convention.c`Linux için x86-64`-O2`ve radar2.4.'ın argümanlarını sordu.`eight_args`Yedi ile cevap verdi:`rdi`- Evet .`rsi`- Evet .`rdx`- Evet .`r8`- Evet .`r9`- Evet .`rsp+0x8`ve`rsp+0x10`C kaynağı sekiz parametreye sahiptir.`%rcx`Tam bir kez, `leaq (%rdx,%rcx), %rax`, ve araç değişken kurtarma sadece bir adres içinde görünen bir kayıt sayılmadı.

Sonra aynı dosyanın Windows yapısını rizin 0.9.1'de açtın.`amd64`ve buldum .`r8`- Evet .`rcx`- Evet .`rdx`Bu nesne COFF, bu yüzden konvansiyon Microsoft x64, dördüncü kayıt argümanı `r9`İki araç aynı kaynağı farklı kayıtlardan kaçıyor.

Bir liste, talimatların bir sırasıdır. Bir çağrı sözleşmesi, listeden dışarıda yaşayan bir sözleşmedir: hangi kayıtlar, çağrıda bulunmuş kişinin koruması gereken argümanları taşıyor, geri dönüş adresi ve yığın argümanları nerede yer almaktadır ve çağrıda bulunmuş kişinin yığın işaretçisinin üstünde ne bırakması gerekir. Burada önemli olan anlaşmaları dört belge tanımlıyor. Sistem V AMD64 psABI (Versiyon 1.0, 12 Mart 2025 tarihli yapı) bölümleri 3.2.1 ile 3.2.3. Microsoft x64 çağrı konvansiyonu, yığın kullanımı ve önbellek ve epilog sayfaları (2018-12-17'den 2025-03-19'e kadar sayfa tarihleri). Arm AAPCS64 2025Q4 (23 Ocak 2026) bölümleri 6.1 ila 6.9'u yayınlıyor. Apple'ın arm64 platform notları. Bu ders bu kuralları okuyor, onları üç şekilde oluşturulan bir C dosyasına uyguluyor ve bir listeyi parametre konumlarının, kaydedilen kayıtların ve çerçeve sıfırlamalarının kontrol edilen bir listesine dönüştüren analizörü oluşturur.

```figure
re-38-three-frames
```

## Bir Başlık Kurallar Kitabını Seçir

`convention.c`On iki fonksiyonunu vardır: `leaf_add`- Evet .`eight_args`- Evet .`mixed`- Evet .`by_value`- Evet .`big_ret`- Evet .`sum_varargs`- Evet .`keeps`, ve beş kişi aradı .`extern`Bu, aynı şekillerle işlevler oluşturur.`long long`Çünkü ...`long`MSVC hedefinde 4 byte ve diğerlerinde 8 byte ve boyut değişikliğini değiştiren bir yapı.`-target x86_64-unknown-linux-gnu`- Evet .`x86_64-pc-windows-msvc`ve`aarch64-unknown-linux-gnu`- ...`-O0`ve `-O2`ve`arm64-apple-macos`- ...`-O2`. Linux veya Windows başlıkları yüklenmiyor, bu yüzden dosya ihtiyacı olanları açıklıyor ve sadece clang'ın kendi başlıklarını içerir `stdarg.h`ve `stddef.h`- Evet .

`describe_object()`İçeride`code/main.py`4 bayt sihirli sayıyı ve bir makine alanını okuyor ve sözleşmeyi isimlendiriyor:

| Header | Field | Value | Rulebook |
|---|---|---|---|
| `7f 45 4c 46` ELF | `e_machine` at offset 0x12 | 62 | System V AMD64 psABI |
| `64 86` COFF | `Machine` at offset 0 | 0x8664 | Microsoft x64 |
| `7f 45 4c 46` ELF | `e_machine` | 183 | AAPCS64 |
| `cf fa ed fe` Mach-O 64 | `cputype` at offset 4 | 0x0100000c | AAPCS64 with Apple differences |

Üç sözleşme, aşağıdaki tabloda neredeyse her satırda aynı fikirde değildir. Her değer başlık satırında adı verilen belgeye alıntı yapılır ve her biri sabitlemelere karşı bir testle kontrol edilir.

| Rule | System V psABI | Microsoft x64 | AAPCS64 |
|---|---|---|---|
| Integer arguments | `%rdi %rsi %rdx %rcx %r8 %r9`, next free register | `RCX RDX R8 R9`, by position | `x0` to `x7`, by NGRN |
| Floating-point arguments | `%xmm0` to `%xmm7`, next free register | `XMM0` to `XMM3`, by position | `v0` to `v7`, by NSRN |
| Integer result | `%rax`, then `%rdx` | `RAX` | `x0`, then `x1` |
| Floating-point result | `%xmm0`, then `%xmm1` | `XMM0` | `v0` |
| Result too large for registers | address passed in `%rdi` "as if it were the first argument", returned in `%rax` | pointer in `RCX`, arguments shifted right, returned in `RAX` | address in `x8`, `x0` to `x7` untouched |
| Callee-saved | `%rbp %rbx %r12` to `%r15` | `RBX RBP RDI RSI RSP R12` to `R15`, `XMM6` to `XMM15` | `r19` to `r29`, `SP`, low 64 bits of `v8` to `v15` |
| First stack argument on entry | `8(%rsp)` | `40(%rsp)`, above a 32-byte shadow store | `0(sp)` |
| Below the stack pointer | 128-byte red zone | "considered volatile" | no red zone (Apple: 128 bytes) |
| Alignment at the call | `(%rsp + 8)` multiple of 16 on entry | 16-byte aligned outside prolog and epilog | `SP mod 16 = 0` |
| Variadic marker | `%al` holds an upper bound on vector registers used | floats duplicated in the integer register | none in registers; Apple uses 8-byte stack slots |

## Sistem V: İki bağımsız kayıt sırası ve kırmızı bir bölge

psABI 3.2.3 her argümanın her sekiz baytını INTEGER, SSE veya MEMORY olarak sınıflandırır ve ardından etkileşime girmeyen iki listeden kayıtları tahsis eder. "INTEGER" "%rdi, %rsi, %rdx, %rcx, %r8 ve %r9 dizisinin bir sonraki mevcut kayıtlarını" alır. SSE alır `%xmm0`- ...`%xmm7`"Eğer bir argümanın herhangi bir sekizbayt için kayıtlar mevcut değilse, tüm argüman yığın üzerinde geçer", ve bellek argümanları "yığın üzerinde ters (sağdan sola) sırada itilir".

`eight_args(a, b, c, d, e, f, g, h)`- ...`-O2`27 byte:

```text
      10: 48 01 fe                     	addq	%rdi, %rsi
      13: 48 8d 04 0a                  	leaq	(%rdx,%rcx), %rax
      17: 48 01 f0                     	addq	%rsi, %rax
      1a: 4c 01 c0                     	addq	%r8, %rax
      1d: 4c 01 c8                     	addq	%r9, %rax
      20: 48 03 44 24 08               	addq	0x8(%rsp), %rax
      25: 48 03 44 24 10               	addq	0x10(%rsp), %rax
      2a: c3                           	retq
```

Altı kas, sonra iki yük.`8(%rsp)`ve `16(%rsp)`. psABI'nin 3.3 şablonunda "memory argument eightbyte 0" yerleştirildi.`16(%rbp)`Ne zaman ?`%rbp`çerçeve tabanı, yani `8(%rsp)`Herhangi bir itme olmadan giriş.`g`8'de.`h`16 yaşında.

`mixed(int i, double d, long long l, float f)`İki listeyi gösterir.`%edi`ve `%rsi`, ilk ve ikinci INTEGER kayıtları.`%xmm0`ve `%xmm1`İlk talimat ise:`cvtsi2sd %edi, %xmm2`ve`%xmm2`Bu, işlevin okumadan önce yazdığı bir çizim kaydıdır.`cvtsi2sd`Bir okuyucu üçüncü bir akış noktası argümanı icat etti. Radar2 tam olarak bunu yaptı ve rapor verdi.`mixed`- Evet .`(double arg1, double arg2, double arg3)`İçeride`xmm0`- Evet .`xmm1`- Evet .`xmm2`- Evet .

`by_value(struct pair p)`16 byet bir yapı iki INTEGER 8 byet olarak geçer `%rdi`ve `%rsi`, ve aynı şekilde geri gönderir: `leaq 0x1(%rdi), %rax; leaq -0x1(%rsi), %rdx; retq`- Evet .`big_ret(long long seed)`32 byte, yani sınıf YADANlığı gönderir ve psABI "Çalışan, geri dönüş değerine yer sağlar ve bu depolamanın adresini %rdi'de ilk argüman gibi geçer". diyor. `seed``%rsi`, ve işlev  ile başlar .`movq %rdi, %rax`Çünkü "%rax, %rdi'de arayan tarafından gönderilen adresi içerir".

Kırmızı bölge, diğer Sistem V imzası. psABI 3.2.2: "%rsp tarafından gösterilen konumdan öte 128 bayt alanı rezerve sayılır ve sinyal veya kesinti işleyicileri tarafından değiştirilmez. "`-O0`- Evet .`eight_args`- Evet .`pushq %rbp; movq %rsp, %rbp`Ve sonra altı mağazaya .`-0x8(%rbp)`- Evet .`-0x30(%rbp)`Hayır .`subq`Mağazalar, yığın göstergesi altında 48 byt yer alıyor.`-O2`yapılandırma`sum_varargs`88 byteyi  ile ayırır`subq $0x58, %rsp`ve sonra kayda kaydetme alanını `-0x58(%rsp)`Aşağıya kadar`-0x80(%rsp)`: 128 byte daha aşağıda, tüm kırmızı bölge.`-mno-red-zone`ve `leaf_add`kazançlar `pushq %rax`ve bir `addq $0x8, %rsp`Yerlilerin 8 bytesini yığın işaretçisinin üstünde tutmak için.

Variadic çağrılar bir kayıt ekler. "%al, kullanılan vektör kayıtlarının sayısını belirtmek için gizli bir argüman olarak kullanılır", 0 ila 8 arasında bir üst sınırı. `call_varargs`- Evet .`xorl %eax, %eax`- ...`-O2`ve `movb $0x0, %al`- ...`-O0`- Evet .`sum_varargs`Önce okuyun: `testb %al, %al; je`Sekiz atlıyor.`movaps %xmmN`vektör kayıtları kullanılmadığında kaydedilir.

## Microsoft x64: Konumlar, Gölge Mağazası ve Kırmızı Bölge Yok

Microsoft kuralları pozisyonaldır. "Tam argümanlar RCX, RDX, R8 ve R9 kayıtlarında geçer. Dalgıç nokta argümanlar XMM0L, XMM1L, XMM2L ve XMM3L'de geçer. " ve "Önce dört parametredeki herhangi bir dalgıç nokta ve çift hassaslık argümanı konumuna bağlı olarak XMM0 - XMM3'de geçer. " Aynı `mixed``%ecx`- Evet .`%xmm1`- Evet .`%r8`- Evet .`%xmm3`: 0 bir int, yani `RCX`1 numaralı yuva iki katlı.`XMM1`; 3. yuva yüzer, bu yüzden `XMM3`- Evet .`XMM0`ve `XMM2`- Boş kal.

Arayan da yer bırakmalıdır. "Arayan her zaman dört kayıt parametresi depolamak için yeterli alan ayırmalıdır, hatta arayan o kadar parametre almazsa bile". Sayfalar ona gölge mağazası veya ev adresleri adını verir ve dört yuva "verilen işlevi tarafından etkin olarak sahiplenir". Giriş sırasında `0(%rsp)`dönüş adresi, `8(%rsp)`- ...`39(%rsp)`Dört ev var ve ilk toplu tartışma`40(%rsp)`- Evet .`eight_args`- ...`-O2`okur `0x28(%rsp)`- Evet .`0x30(%rsp)`- Evet .`0x38(%rsp)`- Evet .`0x40(%rsp)`40, 48, 56, 64.

Arayıcı tarafı aritmetik gösterir.`call8`- ...`-O2`- Evet .`subq $0x48, %rsp`Ve sonra da 5, 6, 7, 8'lik dükkanlar.`0x20(%rsp)`- ...`0x38(%rsp)`Daha önce`movl $1, %ecx`72 byte gölge depo için 32, 32 dört yığın argüman için ve 8 böylece geri dönüş adresi 16 byte bir sınır. `call_varargs`Sadece argümanları kaydetir ve hala dağıtır `subq $0x28, %rsp`: 32 gölge depo için ve 8 düzeltme için. `keeps`üç volatile kayıt (24 byte) i itirir ve sonra `subq $0x20, %rsp`, yani bu`ext`32 baytlık gölge depolarını geri dönüş adresinin altında bulur.

Struktlar kendi kurallarını izler. "Eşit bayt içine girmeyen veya 1, 2, 4 veya 8 bayt olmayan herhangi bir argüman referans yoluyla geçmelidir". ve "16 baytlı argümanlar referans yoluyla geçmelidir". `by_value`Bu nedenle bir kopyayı gösterir.`%rdx`, gizli bir sonuç göstergesi sonrası `%rcx`: "Çalışan, geri dönüş değeri için bellek ayırmalı ve ona bir işaretçi göndermelidir.`call_pair``0x20(%rsp)`- Evet .`movaps`, geçiyor `leaq 0x20(%rsp), %rdx`, sonuç tamponu ile geçer `leaq 0x38(%rsp), %rcx`ve okuyor .`.b`Geri dönmek için`0x40(%rsp)`- Evet .

"RSP'nin mevcut adresinden öte tüm bellek değişken olarak kabul edilir: OS veya bir defugger, bir kullanıcı defug sesyonu veya bir kesinti yöneticisi sırasında bu belleği üst yazıyor olabilir. "`-O0` `leaf_add`8 byte yerel ihtiyaç ve onları alır `pushq %rax`Giriş ve `popq %rcx`Daha önce`retq`, bir yerine iki tek baytlı talimat`subq`ve bir `addq`.Stack kullanımı sayfasında bunu yapabilecek bir yaprak tanımlanır: "Bir yaprak işlevi, bir işlev tablosu girişini gerektirmeyen bir işlevi içerir. RSP dahil olmak üzere herhangi bir değişkenlik olmayan kayıtlara değişiklik yapamaz".

Variadic, kayıtlarını evlerine çağırır. "Vararg veya prototipsiz fonksiyonlar için, herhangi bir yüzer nokta değerleri ilgili genel amaçlı kayıtta çoğaltılmalıdır". `sum_varargs`- ...`-O2`mağazalar `%rdx`- Evet .`%r8`- Evet .`%r9`- ...`0x18(%rsp)`- Evet .`0x20(%rsp)`- Evet .`0x28(%rsp)`Birinden sonra .`pushq %rax`, yani giriş oranları 16, 24, 32: ikinci, üçüncü ve dördüncü kayıt parametrelerinin evleri.`va_list`- Evet .`leaq 0x18(%rsp), %rax`, evinin`%rdx`, isimsiz ilk argüman.

## AAPCS64, ve Apple'ın Neyi Değiştirdiği

AAPCS64 6.8.2 iki sayıcı ile kuralların bir listesini yürütür. C.9: bir bütün argümanı "x[NGRN]" ve NGRN artışlarına en az önemli bitlere kopyalanır. C.1 aynı şeyi NSRN ile yüzen nokta argümanları için yapar. C.12: en fazla `8 - NGRN`C.13 "NGRN'nin 8'e ayarlanması" bir argüman yığınına geçtiğinde, bu nedenle hiçbir şey daha sonra kayıtlara geri dönmez. `eight_args`kullanımı `x0`- ...`x7`Ve asla yığınlara dokunmaz.`mixed`- Evet .`w0`- Evet .`d0`- Evet .`x1`- Evet .`s1`- Evet .`by_value`- Evet .`x0`ve `x1`İçeri ve dışarı.

6.9 kayıtlarda geçerli olan bir sonuç "aynı kayıtlarda geri verilir", aksi takdirde "Hoturum blokunun adresi x8 işlevi için ek bir argüman olarak geçer".`big_ret`Yazar `str x0, [x8]`- Evet .`stur q0, [x8, #0x8]`- Evet .`str x9, [x8, #0x18]`Ve asla yazmaz.`x0`- Evet .`call_big`takımlar `mov x8, sp`ve`seed`İçeride kalır.`x0`, çünkü 6.9 "callee'nin x8'de saklanan değeri korumasına gerek yoktur" ve `x8`- Tartışma kayıtlarından biri değil.

6.1.1: "Bir alt-düzen çağrısı r19-r29 ve SP kayıtlarının içeriğini korumalıdır". 6.4.5.2: "SP mod 16 = 0" kamu arayüzünde.`-O0` `leaf_add`yayımlar`sub sp, sp, #0x10`Sistem V'nin kırmızı bölge kullandığı 8 byte yerel halk için.

6.4.6 çerçeve kaydını tanımlar: "dağdaki iki 64 bit değerli çerçeve kaydı... En düşük adresli çift kelime önceki çerçeve kaydını gösterir ve en yüksek adresli çift kelime mevcut fonksiyona girerken LR'de geçen değeri içerir". ve "Bir çerçeve kaydının bir sürü çerçeve içinde bulunduğu yeri belirtilmemiştir". clang bu tek dosyada her iki pozisyonu gösterir. `keeps`- ...`-O2`Linux'ta en alt kısmında kayıt var.`stp x29, x30, [sp, #-0x30]!; mov x29, sp`Aynı fonksiyon .`-O0`Üstüne koyar `sub sp, sp, #0x20; stp x29, x30, [sp, #0x10]; add x29, sp, #0x10`- Evet .

Apple'ın arm64 notları kayıtları ve uyumluluğu korur ve çerçeveyi, kırmızı bölgeyi ve varyadik çağrıları değiştirir. "Frame pointer register (x29) her zaman geçerli bir çerçeve kaydı ile ilgilenmelidir.`keeps`tasarruf eder .`x22, x21, x20, x19`İlk ve en üstteki rekorları yerleştirir:`stp x29, x30, [sp, #0x20]; add x29, sp, #0x20`"ARM64 kırmızı bölgesi, yığın işaretçisinin hemen altındaki 128 bayttan oluşur" ve hala yayılan çığlık.`sub sp, sp, #0x10`- ...`-O0`Varyadik argümanlar "a uygun sayıda 8 baytlı yığın boşluklarına" ve "va_list tipi char* için bir takmaca" atanır. `call_varargs`Apple mağazalarında 10, 20, 30'dan `[sp]`- Evet .`[sp, #8]`- Evet .`[sp, #0x10]`ve sadece geçer.`w0`Linux yapılandırması geçerli .`w1`- Evet .`w2`- Evet .`w3`ve  ile arkaplan çağrıları`b extva`- Elma .`sum_varargs`okur `add x8, sp, #0x10`, arayanın yığın göstergesi, onun gibi`va_list`Linux `sum_varargs`tasarruf eder .`x1`- ...`x7`ve `q0`- ...`q7`224 baytlı bir çerçeveye girer ve yapı alanlarını initialize eder `__gr_offs`-56 ve `__vr_offs`-128'e bir tane ile `mov x8, #-0x38; movk x8, #0xff80, lsl #32`- Evet .

Mach-O her C sembolünü bir önleme ile belirler.`_`, listede gösterildiği gibi`_keeps`ve ilk işlev özel etiket altında görünür `ltmp0`Analizör, simge tablosu ile etiketlerin adını değiştirir.

## Bir Başlık'ı Elden Üç kez Çıkar

`keeps(int n)`Çağrılar`ext(i)`Bir döngü içinde ve devam eder.`n`- Evet .`i`ve`acc`Bu yüzden her ABI kayıtları kaydetmeli.`-O2`Her hedefe göre inşaat yapın.

Sistem V, 4 byte:

1. `55`- Evet .`push r64`Aşağı üç bitte kayıtlı: `50 + 5`- Evet .`%rbp`- 8 derinlik.`%rbp`Giriş geçişinden -8'de kaydedildi.
2. `41 56`- Evet .`41`REX ile `B`bir dizi,`56`- Evet .`50 + 6`REX.B 6 ' dan 14 ' e kadar uzanıyor .`pushq %r14`- 16'da.
3. `53`- Evet .`50 + 3`- Evet .`pushq %rbx`-24'te.

3 basmak 24 byte. geri dönüş adresi 8 ekler ve 32 16'ın katı, bu yüzden `callq ext`Çubuk içinde bir  olmadan düzeltilmiştir`subq`- Yok .`movq %rsp, %rbp`Bu yapıta bir çerçeve işaretçisi yok.`%rbp`Bu da , o çağrıların kaydedilen kayıt .`acc`(`xorl %ebp, %ebp`- Evet .`addl %eax, %ebp`Epilog aynadır .`5b 41 5e 5d c3`- Evet .

Microsoft x64, 7 bayt:

1. `56`- Evet .`pushq %rsi`-8'de.`57`- Evet .`pushq %rdi`-16'da.`53`- Evet .`pushq %rbx`-24'te.`RDI`ve `RSI`Sistem V'deki argüman kayıtlarıydı.
2. `48 83 ec 20`: REX.W, opcode `83 /5`8 bitlik bir modrm ile.`ec`- Evet .`11 101 100`- Evet .`subq $0x20, %rsp`- 56 derinlik.

56 artı geri dönüş adresi 64'dir, 32 byet gölge depo.`ext`Epilog sayfasında sadece "RSP, sabit veya Lea RSP, sabit [FPReg] eklenmesine izin verilir, ardından sıfır veya daha fazla 8 baytlı kayıt popları ve bir geri dönüş veya bir jmp" bir dizi ve baytlar vardır.`48 83 c4 20 5b 5f 5e c3`- Evet .

AArch64, 16 byte dört kelimeyle, küçük bir endian:

1. `a9bd7bfd`- Evet .`stp`- İndeks öncesi.`10`64 bitlik kayıtları seçin, 25:23 bit.`011`Seçili pre-index, bit 22 depo için 0'dur. imm7 bit 21:15'te `1111010`Rt2 14:10'da 30'a eşit Rn 9:5'da 31'e eşit (`sp`), Rt 4:0 29'dur.`stp x29, x30, [sp, #-0x30]!`: yığın göstergesi 48'e düşüyor.`x29`-48'e gidiyor ve `x30`-40'a kadar.
2. `f9000bf5`- Evet .`str`İmza edilmemiş 12 bitlik bir ofset ile 8 ile ölçeklenmiş: imm12 21:10'da 2'dir, Rn `sp`Rt 21 ' e eşittir .`str x21, [sp, #0x10]`Giriş oranı -32'dir.
3. `910003fd`- Evet .`add`hemen: imm12 0, Rn `sp`Rd 29 ' dır .`mov x29, sp`: çerçeve işaretçisi -48'e kadar kayda atıyor.
4. `a9024ff4`- Evet .`stp`İmza edilen bir ofset ile: imm7 4'e, 32'ye kadar ölçeklendirilmiş. Rt2 19'a, Rt 20'e eşit.`stp x20, x19, [sp, #0x20]`- Evet .`x20`-16'da.`x19`-8'de.

Çerçeve 48 byte: `x29`0'da.`x30`Saat 8'de.`x21`16.8 byte, 24.`x20`32 yaşında.`x19`Kaydın en düşük kelime önceki kaydı gösterir ve 6.4.6'nın gerektirdiği gibi sonraki kelime LR tutar. `cmp w0, #0x1`Birinci ve ikinci depo arasında yer alır; programcı onu prologuna taşıyor ve analizci yığın işlemleri arasında bir karşılaştırma veya bir aritmetik talimatı kabul eder.

## Yöneticisi Aynı Bilgiyi İki Keşke Yazmış Olsun

Bir öncü analiz bir çıkartmadır. Yükleyici bir ikinci bir çıkartmayı çıkarır ve ikisi de aynı fikirde olmalıdır.

Windows ' da ikinci derivasyon `.pdata`ve `.xdata`- Yapın .`-O2`nesne olmadan `-fno-asynchronous-unwind-tables`ve `llvm-objdump -h`gösteriler`.xdata`0x34 byte ve `.pdata`0x48 bytes. 0x48 72, 6 `RUNTIME_FUNCTION`12 byte ve üç `IMAGE_REL_AMD64_ADDR32NB`Her biri yer değiştirdi.`sum_varargs`- Evet .`keeps`- Evet .`call8`- Evet .`call_varargs`- Evet .`call_pair`ve`call_big`Diğer altı fonksiyonlar yapraklar ve istisna işleme sayfasında "Eğer arama bir fonksiyon tablosu girişini bulamıyorsa, kodun bir yaprak fonksiyonunun bir parçası olduğu varsayılır ve RSP doğrudan geri göstergeyi ele alır".

- Evet .`.xdata` için bytes`keeps`- Evet .`01 07 04 00 07 32 03 30 02 70 01 60`- Evet .`UNWIND_INFO`3 bitli Versiyon ve 5 bitli Bayraklar ile başlar: 1. versiyon, bayraklar yok. SizeOfProlog 7, CountOfCodes 4, FrameRegister ve FrameOffset 0. Her biri `UNWIND_CODE`Prolog'daki bir ofset ve bir byte opkod ve bilgi. `07 32`: ofset 7'de, op 2'de `UWOP_ALLOC_SMALL`, info 3 anlamı `3 * 8 + 8 = 32`Baytlar.`03 30`: op 0 `UWOP_PUSH_NONVOL`, kayıt 3 `rbx`- Evet .`02 70`- Evet .`rdi`- Evet .`01 60`- Evet .`rsi`. Kodlar geri yönlü bir şekilde depolanır ve aynı üç baskı ve 32 baytlı tahsis ile aynı baytları adlandırırlar `56 57 53 48 83 ec 20`- Ne ?`sum_varargs`Giriş:`01 01 01 00 01 02 00 00`: bir kodlu 1 baytlı bir prolog, `UWOP_ALLOC_SMALL`Bu da bir devirci tarafından görülen bir şey.`pushq %rax`: bir tahsis, çünkü `%rax`Uçurgan ve hiçbir şey kurtarılmıyor.

Linux ' ta ikinci türü `.eh_frame`, ki bu kısımlar, psABI 4.2.4'te tanımlanmıştır ve DWARF 5 bölüm 6.4'te kodlanmıştır. `llvm-dwarfdump --eh-frame`Yer değiştirilebilir nesne üzerinde fonksiyona bir FDE yazdırır ve `R_X86_64_PC32`- Bu yüzden alanlar kullanılabilir.`keeps`- ...

```text
  DW_CFA_def_cfa_offset: +16
  DW_CFA_def_cfa_offset: +24
  DW_CFA_def_cfa_offset: +32
  DW_CFA_offset: RBX -32
  DW_CFA_offset: R14 -24
  DW_CFA_offset: RBP -16
```

CFA, çağrıdan önce yığın göstergesidir, giriş yığın göstergesinin üstünde 8'dir, bu nedenle `RBP -16`Giriş oranı -8'dir.`R14 -24`-16'ın.`RBX -32`-24'e, en derin CFA 32'nin de 24 bayt çerçevesini ekleyerek geri dönüş adresi.`keeps`diyor ki`DW_CFA_def_cfa: W29 +48`- Evet .`W29 -48`- Evet .`W30 -40`- Evet .`W21 -32`- Evet .`W20 -16`- Evet .`W19 -8`. Orada CFA giriş yığın göstergesi kendisidir, bu nedenle karşılaştırmalar dönüşümsüz çerçeve karşılaştırmalarıdır ve CFA'nın tanımlanması `x29`Çerçeve kayıtları canlıyken.`eh_frame_cross_check()`Bu, her iki nesnenin 12 FDE'si için bu karşılaştırmayı yapar.`call8`Sistem V altında iki çıkış argümanı vücut ortalarına doğru itmektedir. Yani en derin CFA ofset 32'dir. Prolog çerçevesinde ise 8'dir.

## Bu aletlerin adı ne ?

Bu alanın her bir aracı, çağrı konvansiyonu için bir veri yapısı ve bir işlevi atanır bir geçiş vardır. İsimler farklıdır ve boşluklar farklıdır. Kapalı araçlar belgeleriyle tanımlanır; açık olanlar armatürlerde çalıştırılır ve çıkışı nesnelerin yanında ele alınır.

**Ghidra 12.1.4 (Apache-2.0).**Kurallar, kompiliör özellik dosyalarında canlıdır.`.cspec`, SLEIGH dili yanında.`x86-64-gcc.cspec`bir `<default_proto>`Adı:`__stdcall`, "Sistem V Uygulama Binary Interface AMD64 Arsitektur Süperleri Ekisi Nisan 2016" ile `<pentry>`listeler için`XMM0_Qa`- ...`XMM7_Qa`ve `RDI, RSI, RDX, RCX, R8, R9`, 8'te bir yığın giriş, a `join_dual_class`16 byte'ye kadar türler için kural, çıkışlar `XMM0_Qa, XMM1_Qa, RAX, RDX`ve`hidden_return`Gerisi için.`x86-64-win.cspec`Açıklamalar`__fastcall`Dört kişiyle.`<group>`Çiftleşen elementler`XMM0_Qa`- Evet .`RCX`- Evet .`XMM1_Qa`- Evet .`RDX`, ve böylece, konum kuralı, 40'ın karşılaştırılmasındaki bir yığın girişidir.`convert_to_ptr`3, 5, 6 veya 7 baytlı çizgiler için "Registrasyon için sadece 8,16,32,64 bit büyüklüğündeki çizgiler paketlenebilir" yorumunu kullanın. `unaffected`listelenme`RBX RBP RDI RSI RSP R12`- ...`R15`ve `XMM6`- ...`XMM15`, ve bir `localrange`8 ila 39'daki yığın, gölge mağazası.`AARCH64.cspec`Açıklamalar`__cdecl`İlk girişleri `x8`- Evet .`storage="hiddenret"`O zaman ...`q0`- ...`q7`ve `x0`- ...`x7`- Evet .`convert_to_ptr`17 bayt veya daha fazla olan yapılandırmalar için ve `killedbycall`İçinde:`x8`"Yöntemsel sonuç konum kaydı, pentry listesinde yansıtılmamıştır" yorumunu ile. Dekompiler'in son aşaması "Establish Function's Prototype" olarak adlandırılır; analizörler "Call Convention ID" ve "Decompiler Parameter ID"dir; "Prototype Evaluation" program seçeneği varsayılan modeli seçer.

**IDA Pro and IDA Free (Hex-Rays, commercial; current release 9.4, build 9.4.260714).**Fonksiyon tipi, SetType aracılığıyla belirtilen bir C deklarasyonudır ve "IDA, tip bilgilerini, fonksiyon argümanları hakkında bilgi ile birlikte sökülmeyi yorumlamak için kullanacaktır". Standart bir kuralı oluşturmayan yerler, IDA'nın kendi kuralı yazılmıştır: `int __usercall func@<ebx>(int x, int y@<esi>)`sonuçları `EBX`ve `y`İçeride`ESI`ve`@<^12.4>`Düğme konumunun, ölçüm ve oranla adlandırılması. `__userpurge`Aynı sayfa listesi.`__spoils`Çıkartılmış takım için, `__hidden`- Evet .`__return_ptr`ve`__struct_ptr`Bu ders, içeriksiz argümanlar için el ile geri kazanılır.`__usercall`IDA Free sadece x86 ve x86-64'i destekler.

**Binary Ninja 6.0 "Krypton" (Vector 35, commercial, with a Free edition that decompiles x86, x86_64, ARMv7, and AArch64).**A.`Platform`"biner ortamın yürütme ortamı ile ilgili tüm bilgileri içerir, esas olarak kullanılan arama sözleşmeleri, işletim sistemi ve mimari" ve liste `linux-x86_64`- Evet .`windows-x86_64`- Evet .`linux-aarch64`ve`mac-aarch64`, her biri bir`default_calling_convention`- A.`CallingConvention`- Evet .`int_arg_regs`- Evet .`float_arg_regs`- Evet .`callee_saved_regs`- Evet .`caller_saved_regs`- Evet .`int_return_reg`- Evet .`high_int_return_reg`- Evet .`float_return_reg`, ve bu dersdeki farklılıkları doğrudan kodlayan iki bayrak:`arg_regs_share_index`, "Doğru olduğunda, Nth argümanı, türünden bağımsız olarak hem tam sayı hem de akışlı kayıt listelerinin Nth boşluğunu tüketir" ve `stack_reserved_for_arg_regs`, "Windows x64 çağrı konvansiyonu tarafından kullanılan gölge/ev alanı". `eligible_for_heuristics`- Evet .`required_arg_regs`ve`required_clobbered_regs`Platform türleri C başlıkları altında `types/platform/`, platform adı başına bir tane.

**radare2 6.2.4 (LGPL-3.0, run here).** `afcl`mimarlık eklentisi bildiği konvansiyonları listeler: `amd64 amd64syscall dlang golang golang_abi0 ms p9 reg swift`x86-64 ve  için`arm64 dlang golang p9 reg swift`AArch64 için.`afc`mevcut fonksiyonun konvansiyonunu bildirir. `afcr`Parmak izi`cc.amd64.arg0: rdi`- Evet .`arg5: r9`ve `ret0: rax`, ve profiller SDB dosyaları olarak adlandırılır `cc-ARCH-BITS.sdb`Radar seçildi .`amd64`ELF nesnesi için ve `ms`COFF nesnesi için doğru bölünme. `afv`argüman ve değişkenlerin listelerini yapar ve `afs`Linux'ta bir imza yazdırırır.`-O2`nesne`afv`Yedi argüman bulmuştum .`eight_args`ve düştü .`rcx`; bulduğu Windows nesnesinde `rcx, rdx, r8`Ve dört yığın yuvası ve düştü .`r9`İkisi de sadece bir kartın içinde görünmektedir .`lea`- Evet .`mixed`rapor etti .`double arg1 @ xmm0, arg2 @ xmm1, arg3 @ xmm2`Linux'ta ve Windows'ta hiçbir argüman yok.`x0`- ...`x7`için`eight_args`ve için`big_ret`- Listede .`x0`ve `double arg2 @ d1`fonksiyonun okuduğu yer `x8`ve sabit yükler `q1`Her zaman .`afs`İmza , `void`, çünkü geri dönüş türü çıkarılmamıştır.`-O0`, her argüman çerçeveye kaydedildiği,`afv`Tüm sekiz argümanı buldum .`eight_args`- Evet .`rbp+0x10`ve `rbp+0x18`- Yüklü çift için.

**rizin 0.9.1 (LGPL-3.0, run here) and Cutter 2.5.0.** `afcl`listeler`amd64 amd64syscall ms reg swift`- Evet .`afc`Geri döndü .`amd64`COFF nesnesi için, Microsoft profili var ve biçimden seçilmedi. `afi``eight_args`Linux'ta, yine olmadan `rcx`, ve Windows ' ta `r8, rcx, rdx`Üç tane yığın boşluğu ile, `r9`ve boşluk olmadan `0x40`- Evet .`afv`var değil; listelenme komutası `afvl`Cutter, Rizin'in grafik ön ucudur.

**angr 10.0.3 (BSD-2, run here).** `CFGFast`Ardından `CompleteCallingConventions(recover_variables=True)`takımlar `function.calling_convention`- ...`SimCCSystemVAMD64`- Evet .`SimCCMicrosoftAMD64`veya`SimCCAArch64`, ikili biçimle ve `function.prototype`Bu, tüm sekiz argümanı geri aldı.`eight_args`Üç hedefin de gizli işaretçisi.`big_ret`x86-64'te.`(BOT*, long long) -> BOT*`, Windows'un yan referans yapıları `by_value`- Evet .`(BOT*, BOT*) -> BOT*`, ve Sistem V varyadı `sum_varargs`- Evet .`(long long, ...)`Radar'ın boşlukları radarlardan farklıdır.`mixed`Geri döndüğümde`(long long, long long, double, float)`Sistem V ve AArch64'te, doğru kayıtlar yanlış sırada yazılır, çünkü tam sayılar listesi yüzen listeden önce basılır; AArch64 `big_ret`Geri döndüğümde`(long long) -> double`, yani `x8`Toplantı kaçırıldı ve bu nedenle vektör depoları okundu; ve AArch64 `sum_varargs`16 parametreyle geri döndüm, tüm kayıt alanı kurtarıldı.

**Others.**Hopper 6.6.0 macOS ve Linux için ticari bir parçacık ve parçacık; bu ders için konvansiyon işleme çalıştırılmamış veya belgelemiş değildir.`frame info`ve `register read`Düzeltme Eksplorörü, üç listeni kaynağın yanında gösterir, bu da bir kuralı baytlar olarak arama yapmadan önce onaylamanın en hızlı yoludur.

| Concept | Ghidra | IDA | Binary Ninja | radare2 / rizin | angr | this lesson |
|---|---|---|---|---|---|---|
| The convention object | `prototype` in a `.cspec` | calling convention keyword in the function type | `CallingConvention` on a `Platform` | `afc` name, `cc-ARCH-BITS.sdb` | `SimCC` subclass | `expected_locations(abi, name)` |
| Default per target | `<default_proto>` per cspec | compiler setting | `Platform.default_calling_convention` | `afc=`, `anal.cc` | by format | `describe_object()` |
| Argument registers | `<pentry>` list, `<group>` for positional | `@<reg>` in `__usercall` | `int_arg_regs`, `float_arg_regs`, `arg_regs_share_index` | `cc.NAME.argN` | `ARG_REGS`, `FP_ARG_REGS` | `INT_ARG_REGS`, `FLOAT_ARG_REGS` |
| Shadow store | `localrange` stack 8 to 39 | implicit | `stack_reserved_for_arg_regs` | `cc.ms.argn=stack` | `STACKARG_SP_DIFF` | `STACK_ARG_BASE[WIN64] = 40` |
| Hidden result pointer | `hidden_return`, `storage="hiddenret"` | `__return_ptr`, `__hidden` | return type too large for `int_return_reg` | not modelled | `BOT*` first argument | `HIDDEN_RETURN_REG` |
| Callee-saved | `<unaffected>` | `__spoils` lists the opposite | `callee_saved_regs` | profile | `CALLEE_CLEANUP` and arch | `CALLEE_SAVED` |
| Assigning one to a function | "Call Convention ID" analyzer, "Establish Function's Prototype" | user or type library | heuristic detection with `required_arg_regs` | `afc`, `afva`, `aaft` | `CallingConventionAnalysis` | read-before-write plus the rulebook |

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu. Yedi nesnenin her biri için format, makine ve ABI adını verir ve on iki işlevin her biri için prolog baytları, giriş karşılığı olan kaydedilen kayıtları, çerçeve boyutu, çerçeve işaretçisi, parametreler kayıtları, yığın argüman karşılığı, dökümler, geri dönüş kayıtları veya gizli işaretçi, arama derinlikleri ve arama yapanların çıkış kayıtları ve depoları verir. Her işlev kontrolleriyle sona erer: kural, imzadan beklenen değer, baytlardan gözlemlenen değer ve uyumlu olup olmadığını. Rapor iki atışlı çapraz kontrol ve araç çekimleriyle sona erer. 84 fonksiyon analizi boyunca 489 kontrol yürütülmüş ve 489'u da aynı fikirdeydi.

Beklenen şekil:

```json
{
  "objects": {
    "convention-x86_64-windows-O2": {
      "format": "COFF", "machine": "AMD64", "abi": "Microsoft x64", "checks": "73/73 agree",
      "functions": {
        "keeps": {
          "prologue": ["56  pushq %rsi", "57  pushq %rdi", "53  pushq %rbx", "48 83 ec 20  subq $0x20, %rsp"],
          "frameBytes": 56,
          "savedRegisters": [{"register": "rsi", "entryOffset": -8}, {"register": "rdi", "entryOffset": -16}, {"register": "rbx", "entryOffset": -24}],
          "parameterRegisters": ["rcx"],
          "returnRegisters": ["rax"],
          "calls": [{"callee": "ext", "depth": 56}],
          "checks": [{"rule": "Microsoft x64: the caller must always allocate ...", "expected": "at least 32 bytes ...", "observed": [56], "agree": true}, "..."]
        }
      }
    }
  },
  "sehCrossCheck": ["..."],
  "ehFrameCrossCheck": {"...": "..."}
}
```

Oku `code/main.py`Bu sırada:

1. `describe_object()`ELF, COFF veya Mach-O başlığı ve simge tablosunu okuyor ve ABI ve fonksiyon listesini gönderir.
2. `parse_listing()`bölüyor `llvm-objdump -d -r`metinleri fonksiyonlara ayırır, her çağrı ve sıçrama için yer değiştirme hedefini tutar ve doğru sözcük anlamının işaretçisi ile yorumları siler: `#`AT&T için, `//`ve `;`AArch64 için,`#`Hemen bir önlem verildi.
3. `effect_x86()`ve `effect_arm()`Bir talimatı oku, adres oku, yaz, yükleme, mağaza ve bir yığın işaretçi delta haline getir. AT&T'nin son operandı hedeftir; ilk AArch64 operandı mağazalarda, karşılaştırmalar ve şubeler hariç hedefdir. `lea`Adres okuyor ve hiçbir şey yüklemiyor.`mov`- Evet .`cvtsi2sd`- Evet .`setcc`, ve sıfır dilini .`xor r, r`Bir çağrı bütün değişken setleri yazıyor.`sp`erişim ve indekslenmeden sonra yük taşıyan bir şey olmadan önce.
4. `analyze_function()`Bir kere vücudu ilk kez yürütür.`ret`Bu, yığın göstergesinin derinliğini giriş değerinin altında izler.`disp(%rsp)`Giriş oranı `disp - depth`ve `disp(%rbp)`- Evet .`frame_pointer + disp`. Yazılmadan önce okunan argüman sınıfı kayıtlarını kaydeder, ABI'nin ilk yığın argümanının karşılaştırılmasına veya üstündeki yükleri, çerçeveye argüman kayıtlarını saklar, mevcut yığın göstergesi altında erişimi ve her çağrıda derinliği kaydeder.
5. `_return_registers()`Bu nedenle, bir veri tabanı olarak okunan bir veri tabanı olarak okunan bir kişiyi öldürür.`rax`Yaşarken`big_ret`Microsoft x64 altında,`movq %rcx, %rax`Sonra da mağazaya kadar gider.`(%rax)`- Evet .
6. `expected_locations()`C imzasına üç kural kitabı uyguluyor: İki Sistem V listesi sekizbayt sınıfları, Microsoft konum boşlukları yan referans yapılarıyla ve AAPCS64 saylayıcıları `x8`16 byt'ten fazla sonuçlar için.
7. `run_checks()`Bu iki şeyi karşılaştırır ve çerçeve kurallarını ekler: Kaydetmiş kayıtlar kaydedilmelidir.`(rsp + 8) % 16 == 0`veya `sp % 16 == 0`Her çağrıda 32 byte gölge, her Microsoft çağrısında Microsoft ve AAPCS64'te yığın göstergesi altında erişim yok ve en fazla 128 byte Sistem V'de ve yığın göstergesi ile giriş değerinde prologu yansıtan bir epilog.
8. `seh_cross_check()`ve `eh_frame_cross_check()`Yapılan nesnelerin çıkış verilerini okuyun.`-fno-asynchronous-unwind-tables`Ve onu prolog analizine karşılaştır.

Üç emir daha var.`python3 code/main.py analyze convention-x86_64-windows-O2 keeps`Bir fonksiyon yazdırır. `python3 code/main.py object FILE`Başlıkta verdiği kararı yazdırıyor.`python3 code/main.py seh`Çizilmişleri yazdırırır `UNWIND_INFO`Bir tane olan her fonksiyonun.

## Kullan

Bu sırada, yeni bir nesne üzerinde analizörü kullan.

1. Çık .`python3 code/main.py object FILE.o`Eğer başlık ve yapı komutunuz anlaşmazlıklarda, durun; onlardan biri yanlış.
2. Yakalama`llvm-objdump -d -r FILE.o`Bir sonraki nesneyi okumak ve analiz çalıştırmak. Başlangıç bytesini ve kaydedilen kayıtları başka bir şeyden önce okuyun ve çerçeve boyutunu basmak ve `sub`- Evet .
3. Parametre kayıtlarını ve kaynak imzanıza karşı yığınlıksal sıfırlamaları okuyun. İmzanın açıklamadığı bir kayıt, analizatörün bir argüman olarak yanlış anladığı gizli bir işaretçi, bir varyadik işaretçi veya bir çizim kayıtçısıdır. Son durum, etki tablosundaki bir hata. Bu talimat için genel bir kural ile düzeltin.
4. Her biri üzerine kurulan kuralın adını verir, yani kontrol etmek için ilk şey kural, sonra baytlar, sonra analizör.
5. Nesneye veri açıldığında, çapraz kontrolü yapın.
6. Bir diğer araç kurulduğunda, çıkışını tam komutla yakalayın ve karşılaştırın. Eğer üç türeviniz varsa, eğer farklı ise, belirli bir kayıt ve belirli bir talimatınız var ve bu ders için bir bulgu.

## İnteraktif Laboratuvar

### Laboratuvar A: Bir talimat, üç etki

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames/code
python3 -q
```

Çık:

```python
from main import *
effect(Instruction(0, "48 8d 04 0a", "leaq", "(%rdx,%rcx), %rax"), SYSV)
effect(Instruction(0, "f2 0f 2a d7", "cvtsi2sd", "%edi, %xmm2"), SYSV)
effect(Instruction(0, "a9bd7bfd", "stp", "x29, x30, [sp, #-0x30]!"), AAPCS64)
```

Her çağrıdan önce beklediğiniz okumaları, adres okumaları, yazıları ve yığın deltalarını yazın.`[sp, #-0x30]!`- ...`[sp], #0x30`- Evet .`ldp`ve delta ' nın hareketini izle .`sp_delta`- ...`post_sp_delta`- Evet .

### Laboratuvar B: Kapı çerçevesini

```python
info, listing = load_fixture("convention-aarch64-linux-O2")
keeps = analyze_function("keeps", listing["keeps"], info.abi)
keeps.saved
keeps.frame_pointer
[c.to_dict() for c in frame_cells(keeps)]
```

Değişiklikleri yukarıdaki el kodlaması ile karşılaştırın.`convention-arm64-macos-O2`Ve aynı üç satır çalıştırın; kayıt -16'a taşınır ve dört kayıt altındadır.`convention-x86_64-linux-O2-fp`Ve oku .`saved`için`keeps`: çerçeve işaretçisi geri döndü, ve bir de `pushq %rax`Tek işi yapmak.`(rsp + 8)`Çağırışta 16'ın katı.

### Laboratuvar C: Karışık üzerinde okuma-yazmadan önce

```python
info, listing = load_fixture("convention-x86_64-linux-O2")
mixed = analyze_function("mixed", listing["mixed"], info.abi)
mixed.param_registers
mixed.return_registers
expected_locations(SYSV, "mixed")["parameters"]
expected_locations(WIN64, "mixed")["parameters"]
```

Sistem V listesi `rdi, xmm0, rsi, xmm1`ve Microsoft listesi `rcx, xmm1, r8, xmm3`Şimdi Windows nesnesini yükle ve ilk üç satırı tekrar çalıştır.`[afv mixed]`Üçüncüyi açıklayan talimatı bul.

### Laboratuvar D: Windler'in ikinci görüşü

```python
for row in seh_cross_check():
    print(row["function"], row["sizeOfProlog"], row["unwindPushes"], row["unwindAllocBytes"], row["agree"])
for row in eh_frame_cross_check("convention-x86_64-linux-O2-eh"):
    print(row["function"], row["cfiSaved"], row["cfiMaxOffset"], row["deepestStack"], row["agree"])
```

Bul .`pushq %rax``sum_varargs`SEH tablosunda, neden bu kodun bir tahsis olarak kaydedildiğini açıklayın.`call8`- ... ...`.eh_frame`- 32'yi açıkla.

## Pratik Laboratuvar

Dördüncü hedefi ve dördüncü kural kitabı ekleyin.

Gereksinimler:

- Yapıştır `convention.c`- Evet .`-target x86_64-apple-macos -O2`- Ve listesini yakalayalım.`describe_object()`Mak-O'yu okumak için .`cputype`0x01000007 ve sistem V psABI'ye haritasını yaptırmak, Apple'ın x86-64'te takip ettiği`_`Simge önlüğü.
- Her fonksiyonun Sistem V kontrolleriyle uyumlu olduğunu kontrol edin.
- Bir ekle`-fstack-protector-strong`Linux x86-64 nesnesini oluşturun.`%fs:0x28`Ve yerliler altındaki mağazalar bir `canary`hücre ve önceki karşılaştırma`ret`Bu, epilog'u koruyan çek gibi.
- Bir kanarya mağazası dökülen bir tartışmaya sayıldığında başarısız olan bir test ekleyin.
- Çerçeveyi yaz `with_canary`- analizörü çalıştırmadan önce kodun şeklini elden yapın ve çizimi testin yanında tutun.

Başarılı olmak demektir .`python3 code/main.py`her kontrolün onayıyla yeni nesneyi rapor eder ve korunan fonksiyonun çerçeve hücreleri yerel halk ile kaydedilen kayıtlar arasındaki kanarya gösterir.

## Ders Artifakti

Bu ders de içerir .`outputs/skill-calling-conventions-and-stack-frames.md`Bu, oluşturduğunuz bir nesneyi, listesini ve C imzalarını parametre konumlarına, çerçeve düzenine, geri dönüş kayıtlarına ve kompilire dayanan kurallara ve çözülme verilerine karşı her sonucu kontrol etmek için kullanır.`cvtsi2sd`veya `xor r, r`Amacın ne olduğunu ve ilk anlaşmazlıkla sona ermesini.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/38-calling-conventions-and-stack-frames
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Verifikasyon, şunu kanıtlamalıdır:

- Yedi nesnenin isimleri System V, Microsoft x64, AAPCS64 ve Apple arm64'in ELF, COFF ve Mach-O başlıkları
- Her nesnenin simge tablosunda Mach-O ile aynı on iki fonksiyon listelenir.`_`Önbellek ve `ltmp0`Etiket çözülmüş
- listesi analiz eden kişi tutar `ext`Arama hedefi olarak AArch64'i hemen tutarak,`#-0x30`sağlam
- `leaq (%rdx,%rcx), %rax`İki adres kayıtlarını okuyor ve hiçbir şey yüklemiyor .`xorl %eax, %eax`ve `cvtsi2sd`Sadece yazılıdır; önceden indekslenmiş`stp`Hareketler`sp`Mağazadan önce ve indekslenmeden sonra.`ldp`yüklenmeden sonra
- `keeps`- ...`-O2`- Evet .`55 41 56 53`Sistem V'de 24 baytlı bir çerçeve ve çerçeve göstergesi yoktur. `56 57 53 48 83 ec 20`Microsoft x64'te 56 baytlı bir çerçeve ile ve `a9bd7bfd`-48'e kadar rekorla ilk AArch64'de.
- Apple'ın yapımı kayıtları -16'a 4 kaydedilen kayıtların üstünde yerleştirir.
- Her fonksiyonun bir çerçeve göstergesi vardır.`-O0`Linux ' da hiç .`-O2`ve`-fno-omit-frame-pointer`Bir düzeltme baskı ile geri getirir.
- `-O0`yaprak sistem V'de 8 byte kırmızı bölge kullanıyor.`pushq %rax`Microsoft x64 altında ve `sub sp, sp, #0x10`AAPCS64 çerçevesinde; `-mno-red-zone`Kırmızı bölge kullanımı kaldırılır
- Her epilog başlıkını yansıtır ve yığın işaretçisi giriş noktasına geri döner.
- `eight_args`6 kayıt ve 8 ve 16 yuvarlakı, 4 kayıt ve 40 ila 64 yuvarlakı, veya `x0`- ...`x7`, her iki optimizasyon seviyesinde de
- `mixed`- Evet .`rdi, xmm0, rsi, xmm1`Sistem V ve `rcx, xmm1, r8, xmm3`Microsoft x64 altında, `xmm0`Sonuç olarak her iki
- 16 baytlı yapı, sistem V ve AAPCS64 altında iki kayıtta ve Microsoft x64 altında gizli bir işaretçinin arkasında referans olarak seyahat eder.
- 32 baytlı yapı geçiyor `rdi`- Evet .`rcx`veya`x8`
- Variadikal bir kalley okuyor .`%al`, evler`rdx, r8, r9`16, 24, 32, kurtarır `x1`- ...`x7`ve `q0`- ...`q7`, veya Apple ' da arayanın işaretçi yığını okuyor
- Arayanlar beklenen kayıtları ayarlar, 7 ve 8'i 0 ve 8 veya 5 ile 8'e 32 ile 56, sıfırda saklar `%al`Variad çağrısı için, sonuç tampon adresini `rdi`- Evet .`rcx`veya`x8`
- 489 kontrol kendi kurallarına uymuştur.
- Altı .`UNWIND_INFO`Girişler öncü parse ile eşleşir ve yapraklar hiç
- 24 FDE'nin kaydedilen kayıtların karşılığı ve en derin yığın göstergesi ile eşleşmesi
- Araç kayıtlı radarları yakalar.`amd64`ve `ms`- Risin'in.`amd64`COFF nesnesinde, kayıp olan `rcx`, üç çift ve Angr'ın prototipleri
- Sit modülüne yerleştirilen rakam verileri analizatörün çıkışına eşit

## Üretim Başarısızlık Modları

| Failure | What the weak tool reports | What the analysis must prove |
|---|---|---|
| COFF object read as System V | `rdi` and `rsi` as arguments that the function never reads | The header says 0x8664; the convention is Microsoft x64 |
| Register read only inside a `lea` | Seven arguments for an eight-argument function | Base and index registers are reads |
| `cvtsi2sd` destination counted as a read | A third double argument in `xmm2` | The first write to `xmm2` is a write; `mixed` has two SSE arguments |
| Positional slots read as sequences | `xmm0` named as the double argument on Windows | Slot 1 is `XMM1`, slot 3 is `XMM3` |
| `push rbp` taken as a frame pointer | A frame pointer in an `-O2` function that uses `rbp` as an accumulator | Only `mov %rsp, %rbp` after the push creates one |
| Red zone measured from the entry stack pointer | 216 bytes "below the stack pointer" | 128 bytes below the current stack pointer after an 88-byte `sub` |
| Shadow store treated as locals | Stack arguments at 8 to 32 | Microsoft stack arguments start at 40 |
| `lea` treated as a load | A stack argument at `0x60(%rsp)` in a variadic callee | `lea` computes `overflow_arg_area`; it loads nothing |
| Hidden pointer read as a normal argument | `big_ret(void *, long long)` | The pointer is stored through and copied to `rax`, `rax`, or stays in `x8` |
| Deepest CFA compared with the prologue frame | A mismatch on a caller that pushes outgoing arguments | Compare with the deepest stack pointer the body reaches |
| Convention asserted from the ISA | `amd64` for a COFF object | The format picks the rulebook, then the ISA picks the registers |
| Prototype trusted from one tool | Three doubles, or sixteen variadic parameters | The source signature or a second derivation must agree |

## İşlem Kuralı

İlk talimattan önce başlığı okuyun ve kural defterinin adını verin. Kaydettikleri her kayıt ve her argümanı giriş yığın göstergesinden bir sıfırda yerleştirin ve oraya yerleştiren kurallara ve kompilicinin aynı çerçeve için yazdığı çıkartma verilerine karşı kontrol edin.

## Daha Fazla Okumak

- [System V Application Binary Interface, AMD64 Architecture Processor Supplement, Version 1.0 (sections 3.2.1 to 3.2.3, 4.2.4)](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Microsoft x64 calling convention](https://learn.microsoft.com/en-us/cpp/build/x64-calling-convention)
- [Microsoft x64 stack usage](https://learn.microsoft.com/en-us/cpp/build/stack-usage)
- [Microsoft x64 prolog and epilog](https://learn.microsoft.com/en-us/cpp/build/prolog-and-epilog)
- [Microsoft x64 exception handling: RUNTIME_FUNCTION, UNWIND_INFO, UNWIND_CODE](https://learn.microsoft.com/en-us/cpp/build/exception-handling-x64)
- [Arm Procedure Call Standard for the Arm 64-bit Architecture (AAPCS64), release 2025Q4](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst)
- [Apple: Writing ARM64 code for Apple platforms](https://developer.apple.com/documentation/xcode/writing-arm64-code-for-apple-platforms)
- [DWARF Debugging Information Format Version 5, section 6.4 Call Frame Information](https://dwarfstd.org/doc/DWARF5.pdf)
- [Clang driver frame-pointer defaults, `useFramePointerForTargetByDefault` in `CommonArgs.cpp`](https://github.com/llvm/llvm-project/blob/main/clang/lib/Driver/ToolChains/CommonArgs.cpp)
- [Clang command line reference: `-fomit-frame-pointer`, `-momit-leaf-frame-pointer`](https://clang.llvm.org/docs/ClangCommandLineReference.html)
- [Fedora 38 change: frame pointers by default](https://fedoraproject.org/wiki/Changes/fno-omit-frame-pointer)
- [Ubuntu 24.04: performance engineering with frame pointers by default](https://ubuntu.com/blog/ubuntu-performance-engineering-with-frame-pointers-by-default)
- [Ghidra compiler specification: `x86-64-gcc.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-gcc.cspec)
- [Ghidra compiler specification: `x86-64-win.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/x86/data/languages/x86-64-win.cspec)
- [Ghidra compiler specification: `AARCH64.cspec`](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Processors/AARCH64/data/languages/AARCH64.cspec)
- [Hex-Rays: SetType and the `__usercall` convention](https://docs.hex-rays.com/ida-actions/settype)
- [Hex-Rays: Decompile as call](https://docs.hex-rays.com/ida-actions/hx_userdefinedcall)
- [Binary Ninja API 6.0: `callingconvention` module](https://api.binary.ninja/binaryninja.callingconvention-module.html)
- [Binary Ninja API 6.0: `platform` module](https://api.binary.ninja/binaryninja.platform-module.html)
- [Binary Ninja user documentation: platform types](https://docs.binary.ninja/guide/types/platformtypes.html)
- [The Official Radare2 Book: calling conventions](https://book.rada.re/analysis/calling_conventions.html)
- [The Official Radare2 Book: code analysis](https://book.rada.re/analysis/code_analysis.html)
- [angr documentation: decompiler analysis passes, including calling convention recovery](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [radare2 6.2.4 release](https://github.com/radareorg/radare2/releases/tag/6.2.4)
- [rizin 0.9.1 release](https://github.com/rizinorg/rizin/releases/tag/v0.9.1)
