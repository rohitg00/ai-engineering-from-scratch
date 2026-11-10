# Geri Mühendislik Manzarası: Tarih, Araç Aileleri ve Bir Decompiler Nasıl Yapılır

> Beş araç aynı nesneyi okuyor ve dört adres, üç blok sayımı ve bir anahtar için iki cevap veriyor ve bu ders hangisinin hangisinin hangisinin olduğunu gösteren bir harness oluşturur.

**Type:** Build
**Languages:** Python, TypeScript, C, x86-64 assembly, Java (one Ghidra script)
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~150 minutes

## Öğrenme Hedefleri

- Sahenin ana aletlerini 1973 ile 2026 yılları arasında tarihsel bir zaman çizelgesine yerleştirin ve her birinin ait olduğu aileyi isimlendirin.
- Bir dekompilerin sekiz aşamasını ve her aşama için Ghidra, Binary Ninja, Hex-Rays, radar2, rizin ve angr'ın kullandığı terimi söyleyin.
- Bir talimatı ESIL, RzIL, P-kod ve VEX'e kaldırın ve hangisinin bayrakları hevesle yazıp hangisinin bir parça sakladığını açıklayın.
- Beş araç adresini bir hale indir `.text`Bir fonksiyonda azaltmayı karşılaştırıp kanıtlamak.
- Alınan araç çıkışlarını okuyan ve talimat başlatma, bloklar, kenarlar ve işlev başlatma konusunda anlaşma raporlarını veren bir karşılaştırma harnesini oluşturun.
- Ad, yakaladığımız kanıtlardan, her aletin kod icat ettiği, kod kaçırdığı veya dolaylı bir atlamada durduğu yer.

## Sorun

Bir ajanı üç ters mühendislik aracı hakkında ne söylediğini özetlemesini istersin .`grade`İçeride`ledger-x86_64-O1.o`. Ajan her aracı çalıştırır, üç listeyi okuyor ve fonksiyonun yer aldığını bildirir `0x08000050`Bir alette,`0x400010`Başka bir yerde ve`0x100010`Bu, araçların fonksiyonun nerede olduğu konusunda anlaşmazlık yaşadığını gösteriyor.

Aletler aynı fikirde. Nesne yer değiştirilebilir ve yükleme adresi yoktur, bu yüzden her alet bir seçer. Her aletin verdiği adresi çıkarın `.text`Ve her cevap `0x10`Ajan, çiğ adresleri karşılaştırdı çünkü hiçbir şey her bir araçta adresin ne anlama geldiğini söylemedi.

Daha sonra aynı ajan okuyor .`grade`- ... ...`-O0`Bu sayede, üç, sekiz, sekiz ve dokuz temel blok oluşturulur.`jmp rax`İki araç atlama masasını yer değiştirmelerinden okuyor. Bir araç atlama sırasında bir blok bölüyor bir etiket yerleştirmek için. arkasındaki neden olmadan blok sayımı bir talep olmadan bir sayıdır.

Bu ders, bu rakamlardan birine güvenmeden önce ihtiyacınız olan haritadır. Dersler 32 ila 36'da bir dekoder, bir kaldırıcı, bir kanıt kaydı ve bir yeniden inşa ediliyor. İzin verenler, ikinci yarısında, insanların kullandığı araçların yanında yer alırlar. Bunu yapmak için alanın geçmişine, araçların ailelere, her dekompilerin çalışması için bir boru hattına ve kendi tarafından oluşturulan nesnelere ait araçların söylediklerini karşılaştıran bir harness'e ihtiyacınız var.

```figure
re-37-field-map
```

## Tarihsiz Adımlar İçin 53 Yıl

Bu alanın çoğu araçtan daha eski olduğu için, aşağıdaki tarihlerin her birinin daha fazla okuma için bir kaynağı vardır.

### 1973-1991: önce debuggers, sonra deassemblers

İlk dekompiliasyon tezleri 1973'te, Stanford'daki Hollander ve Purdue'daki Housel tarafından yazılmıştır ve bugün her ikisi de alıntılar yoluyla bilinir.`adb`1977'de Bell Laboratuvarlarında bir derslik ve 1979'da UNIX V7 ile gönderilen hata defektörü.`DEBUG`, 8086 bir parçacık ile birlikte, Ağustos 1981'de PC-DOS 1.00'de gönderilmiştir. Richard Stallman'ın GDB 1986'da dağıtımına girdi. SoftICE, 1987'de DOS'a bir çekirdek defugger koymuştur.

Bir sonraki seri dağıtımcıları geldi. 1988'de V Communications'ten Sourcer, bir DOS programı üzerinde birden fazla geçiş yaptı ve yorumlu bir liste yazdı. GNU binutils 1988'de sayısız anlık fotoğraflarla başladı ve `objdump`Ilfak Guilfanov, IDA'nın ilk satırını Ocak 1991'de yazdı ve 20 Mayıs 1991'de IDA 0.1'i paylaşılan yazılım olarak yayınladı.

### 1991-2009: etkileşimli parçacıklar ve ilk parçacıklar

Cristina Cifuentes, Temmuz 1994'te QUT'da "Refers Compilation Techniques" adlı kitabı tamamladı.`dcc`, i80286 DOS programlarını C'ye götürdü ve 1995'te Gough ile yaptığı makalede, sonraki her dekompilerinin tutduğu aşamaları belirledi. 1997'de REC ve 2002'de Boomerang, BSD lisansı altında ilk açık kaynaklı dekompiler oldu.

IDA, 1996'da DataRescue'da ticari bir ürün haline geldi, 1999'da bir eklenti SDK'si elde etti ve 2005'te kurulan Hex-Rays'e taşındı. Hex-Rays Decompiler 1.0 17 Eylül 2007'de gönderildi. Aynı yıl Mike Van Emmerik, SSA'yı dekompiliye verileri akışının merkezinde yerleştiren "Dekompili için Statik Tek Görev" tezini gönderdi. Halvar Flake'in "Ekseküble Nesnelerin Yapısal Tıpkılaştırması" (2004) farklı aileyi başlattı ve BinDiff Ağustos 2004'te satışa çıktı.

Radare, Şubat 2006'da 64 bitli ofsetlerle bir adli hex editörü olarak başladı. LGPL 3.0 altında modüler yeniden yazma olan radare2, ilk kez 7 Mart 2009'da yayınlandı.

### 2009-2019: çerçeveler ve ara temsiller

LLDB, 8 Haziran 2010'da LLVM alt projesi olarak duyuruldu. BAP, Binary Analysis Platform ile BIL ara dili, CAV 2011'de ortaya çıktı. 1 Mart 2011'de Google BinDiff'in üreticileri olan zynamics'i satın aldı. Hopper 2011 yılının sonlarında Mac App Store'da ortaya çıktı. Matt Godbolt 2012'de Compiler Explorer'ı başlattı. Böylece bir C++ programcısı bir kompiliör tarafından üretilen bir montajı görebilirdi.

Angr ilk kod satırını Ağustos 2013'te aldı. Phoenix makalesinde (Schwartz, Lee, Woo, Brumley, USENIX Security 2013) semantik korumacı yapılandırma gösterildi.`goto`DREAM (Yakdan ve diğerleri, NDSS 2015)`goto`Şekilden bağımsız yapılandırma ile ifade edilen ifadeler. Vector 35 14 Ocak 2015'te kuruldu ve Binary Ninja 23 Temmuz 2016'da Low Level IL ve Python API ile satışa çıktı. Angr 2015 yılında halka açık olarak yayınlandı ve Ağustos 2016'da DARPA Siber Büyük Sıkıntıda üçüncü oldu. BinDiff Mart 2016'da ücretsiz oldu. Cutter 1.0, Radar2'e Aralık 2017'de Qt GUI'si verdi. 2018 yılında Guilfanov, Recon'da Hex-Rays IR'in ilk kamuya açık açıklaması olan "Decompiler internals: microcode" i sunmuştu.

### 2019-2026: açık dekompiler ve araştırma dönemi

Ghidra 9.0, 5 Mart 2019'da RSA Konferansı'nda bir ay sonra GitHub'da tam kaynakla Apache 2.0 altında yayınlandı. 8.19.2.4'te aynı yıl bir ön inceleme yazısı eklendi. Binary Ninja 2.0 20 Mayıs 2020'de Yüksek Denizin IL dekompilerini gönderdi. Rizin 8 Aralık 2020'de radar2'nin bir çatısı olarak duyuruldu ve Cutter ekibi ona geçti. IDA Freeware 7.6 Mayıs 2021'de bir bulut x64 dekompiler ekledi.

BinDiff 8 25 Eylül 2023'te Apache-2.0 altında açık kaynaklı olarak yayınlandı. SAILR (Basque ve diğerleri, USENIX Security 2024) angr'ın varsayılan yapılandırıcısı oldu ve sadece sahte olduğunu savundu.`goto`Linux 6.1'ün kaynağında 3.754 tane olduğu için açıklamalar kaldırılmalıdır. Binary Ninja 4.0 Şubat 2024'te ücretsiz bir baskıyı ekledi ve IDA 9.0 eklendi.`idalib`SLaDe (2023) ile LLM4Decompile (2024) ile DecompileBench (2025) arasında ve ajan yardımıyla okunma ve daha fazla yeniden oluşturan ve daha az koruyan dekompiliyerler üzerine 2026'da iki çalışma yürütülmektedir.

Bu ders 14 Ekim 2026'da yürütülen sürümler mevcut olanlardır: Ghidra 12.1.4 (21 Eylül 2026), radare2 6.2.4 (5 Ekim 2026), rizin 0.9.1 (29 Haziran 2026), ve angr 10.0.3 (10 Ekim 2026). Binary Ninja 6.0 "Krypton" (3 Eylül 2026) ve IDA 9.4 (13 Temmuz 2026) mevcut kapalı araçlardır.

## Aileler - Araçlar

Bir araç, ürettiği şeyle bir aileye ait olur. Aileler bir programda üst-üstüne kesilir ve üst-üstü kesişme en çok karışıklığın başlangıcıdır.

### Çıkartıcılar

Bir kod bölümünün ilk baytesinden sonuna kadar bir çizgi tarama dekodları.`objdump -d`ve `llvm-objdump -d`Bu şekilde çalışmak ve hiçbirisi kontrol akışı grafikini oluşturmaz.`objdump`Binutils 2.47 (26 Temmuz 2026) GPL-3.0 veya daha sonraki. LLVM 23.1.3 LLVM istisna ile Apache-2.0'dur.`llvm-objdump`Bu dersin çekilen kopyası.

Bir etkileşimli parçacık bilinen girişlerden rekürsiv düşüş yürütür, fonksiyon başlatmaları için heuristik ekler ve bir veritabanı tutar.`Disassembler`Ek olarak Otomatik Analiz Analizleri, Binary Ninja (sıkı geri dönüşlü, sonra bilinmeyen bölgeler üzerinde doğrusal süpürme), Hopper, radare2 ve rizin (`aa`- Evet .`aaa`- Evet .`af`), Cutter ve iaito ile birlikte, tüm bu aileden. Andriesse ve diğerleri (USENIX Security 2016) bunların dokuzunu kompiliör tarafından oluşturulan ikili üzerinde ölçtüler.

### Decompilers

Ticari dekompiler: Hex-Rays Decompiler (x86'den RISC-V'ye kadar on iki hedef ailesi), Binary Ninja'nın Pseudo C renderi ile HLIL ve Hopper'ın pseudo-kod görünümü. Açık dekompiler: Ghidra dekompiler, r2ghidra ve rz-ghidra'nın bir eklenti olarak tekrar kullandığı Apache-2.0 altında bir C++ motorudur ve pypcode'yi bir kaldırıcı olarak tekrar kullanır. BSD-2-Klavü altında yapılandırılan SAILR ile AIL'deki angr dekompiler; JavaScript'te r2dec ve jsdec; Boomerang ve `dcc`Radar2'nin de bir içe gömülü bir sistemi var.`pdc`Rizin'in içinde bir dekompiler yok.`pdc`rizin 0. 9. 1' de bulunmuyor ve `pdg`Rz-Gidra eklentisine ihtiyacı var.

### Çözücüler

GDB (1986) GEF ve pwndbg ön uçları, LLDB (2010), WinDbg Time Travel Debugging (2017), OllyDbg (2014 yılında dondurulmuş), x64dbg (GPL-3.0, 2014), Python bağlantıları olan Ghidra Debugger, Binary Ninja debugger ve radare2 ve rizin'in yerleşik debuggeri ile.

### İkili analiz çerçeveleri

Angr (VEX IR, sembolik yürütme, `CFGFast`ve `CFGEmulated`Bu kitaplar, Ghidra'nın PyGhidra, Binary Ninja'nın Binary Ninja'nın bir kütüphanesi olan Ghidra'nın adı altında kullanılmıştır.`import binaryninja`, ve IDA ' dan geçiyor .`idalib`- Evet .

### Format ve motor kütüphaneleri

LIEF 1.0.0 (12 Temmuz 2026, Apache-2.0) ELF, PE, Mach-O, COFF ve Android biçimlerini incelemektedir. CLE, "CLE Herşeyi Yükler", Angr'ın yükleyici. Capstone 5.0.9 (28 Mayıs 2026, BSD-3-Klavü) kodlamaları; Keystone 0.9.2 (GPL-2.0) birimleri; Unicorn 2.1.4 (GPL-2.0) emülatları. radar2 6.2.4 paketleri Capstone 5, ve rizin 0.9.1 satıcıları Capstone, Zydis ve ağaç-sitter.

### Diffing araçları ve kompiliör tarafı izleyicileri

BinDiff 8 (Apache-2.0) ile BinExport 12 eklentisi IDA Pro, Binary Ninja ve Ghidra için; Diaphora 3.4.3 (11 Ekim 2026, AGPL-3.0) bir IDA eklentisi olarak;`radiff2`ve `rz-diff`.Compiler Explorer (BSD-2-Clausel) bir kompilatörün kaynak fragmanı için yaydığı bir montajı gösterir.

### Versiyonlar, lisanslar ve ders neydi

| Tool | Version read on 2026-10-14 | Licence | Headless entry | Ran here |
|---|---|---|---|---|
| Ghidra | 12.1.4 | Apache-2.0 | `analyzeHeadless`, `pyghidra.start()` | yes, on all four objects |
| radare2 | 6.2.4 | LGPL-3.0 | `r2 -qc '<cmds>' file`, `rabin2` | yes |
| rizin | 0.9.1 | LGPL-3.0 | `rizin -qc '<cmds>' file`, `rz-bin` | yes |
| angr | 10.0.3 | BSD-2-Clause | `angr.Project` in Python | yes |
| llvm-objdump | Apple LLVM 17.0.0 | Apache-2.0 with LLVM exception | `llvm-objdump -d -r` | yes |
| Binary Ninja | 6.0 "Krypton" | commercial; Free edition for non-commercial use | `binaryninja.load()` with a Commercial, Ultimate, or headless licence | no, documentation only |
| IDA Pro | 9.4 | commercial subscription; IDA Free for non-commercial x86 and x86-64 | `idat`, `ida -A -S`, `idalib` | no, documentation only |
| Hopper | 6.6.0 | commercial, perpetual | none documented | no, documentation only |
| Cutter | 2.5.0 | GPL-3.0 | GUI over rizin | no |

Binary Ninja'nın ücretsiz baskısı sadece x86, x86-64, ARMv7 ve AArch64'i çözer ve API yoktur.`idalib`Bu dersdeki bu iki araçla ilgili her ifade, onların belgeleri ve yayın notlarından geliyor ve figür onları çalışmamış olarak işaret ediyor.

## Decompiler boru hattı, aşama aşama

Cifuentes 1994 yılında bu aşamaları isimlendirdi: sentaks analizi, semantik analiz, orta kod üretimi, kontrol akışı grafiği üretimi, veri akışı analizi, kontrol akışı analizi ve kod üretimi. Onları makine bağımlı ön uç, makine ve dil bağımsız orta ve dil bağımlı arka uç olarak bölmüştür. O zamandan beri her dekompiler bu şekli koruyor ve parçaların adını değiştirdi. Aşağıdaki tabloda bu ders için kullanılan sekiz aşama ve her bir araç için verilen isim belirtilmiştir. Resim, seçilebilir araç sütunları ile aynı tabloyu gösterir.

| Stage | Ghidra | Binary Ninja | Hex-Rays / IDA | radare2 | rizin | angr |
|---|---|---|---|---|---|---|
| Loader | `ElfLoader`, `MachoLoader`, `PeLoader`; `.ldefs` picks the language | `BinaryView`, `BinaryViewType` | loader module (`LDSC`) | RBin (`rabin2`) | RzBin (`rz-bin`) | CLE (`cle.Loader`, `main_object`) |
| Disassembly | `Disassembler`; SLEIGH `.slaspec` compiled to `.sla`; analyzers "Disassemble Entry Points", "Function Start Search" | architecture plugin; Recursive Descent, then linear sweep phases | processor module (`ana.cpp`, `emu.cpp`, `out.cpp`); autoanalysis queues; FLIRT | RArch plugin to `RAnalOp`; `aa`, `aaa`, `af` | RzAnalysis plugin; `aa`, `aaa`, `af` | Capstone blocks; `CFGFast` function start search |
| CFG recovery | "Generate Basic Blocks and the CFG"; `BlockGraph`; "Decompiler Switch Analysis" | `Function`, `BasicBlock`; "Control Flow Graph (CFG) Analysis" phase | `mbl_graph_t`, ready at `MMAT_LOCOPT` | `afb`, `agf`, `aab` | `afb`, `agf`, `aab` (Nucleus) | `CFGFast`, `CFGEmulated`; `kb.functions`; IRSB |
| Lifting | "Generate Raw P-code"; Varnodes in `ram`, `register`, `const`, `unique` | Lifted IL, LLIL, Mapped MLIL, MLIL | microcode (`minsn_t`, `mop_t`); `MMAT_GENERATED` | ESIL (`asm.esil`, `ae`) | RzIL (`aoi`, `aez`) | VEX (`pyvex.lift`, IRSB), then AIL |
| SSA | `Heritage`, `ActionHeritage`; `MULTIEQUAL`, `INDIRECT` | LLIL SSA, MLIL SSA, HLIL SSA; `HLIL_VAR_PHI` | no named SSA; use-def data flow in `MMAT_GLBOPT1` to `3` | none; ESIL is built for emulation | none; RzIL is built for emulation | `_stage_transform_to_ssa_level0` and `level1`; `SeqNodeDephication` |
| Data flow and types | `ActionDeadCode`, `ActionInferTypes`, the `Rule` pool; prototype from `.cspec` | MLIL constant propagation, variables and types; `analyzeReturns` | "Transform microcode"; `MMAT_CALLS`, `MMAT_GLBOPT`, `MMAT_LVARS`; TIL | `afv`, `afc`, `aaft`; ESIL emulation | `afv`, `afc`, `aft` | `CallingConventionAnalysis`, `VariableRecoveryFast`, `Typehoon` |
| Structuring | `CollapseStructure`; `BlockIf`, `BlockWhileDo`, `BlockSwitch`, `BlockGoto` | `HLIL_IF`, `HLIL_WHILE`, `HLIL_SWITCH`; AST at `root` | "Generate ctree"; structural analysis; goto regions | `pdc`; `pdd` (r2dec); `pdg` (r2ghidra) | `pdg` (rz-ghidra); jsdec | `RegionIdentifier`; `RecursiveStructurer` with `SAILRStructurer` |
| Emission | "Emit Final C Tokens"; `PrintC`, `ActionNameVars`, `ActionSetCasts` | HLIL rendering; Pseudo C, Pseudo Rust, Pseudo Python | "Beautify ctree; Print ctree"; `cfunc_t` | text of `pdc`, `pdd`, `pdg` | `pdg` text | `CStructuredCodeGenerator`; `codegen.text` |

### Kargaç

Kargalayıcı, konteyneri analiz eder, bölümleri haritalar ve sembolleri ve yer değiştirmelerini okuyor. Yer değiştirilebilir bir nesnedeki hiçbir şeyin henüz bir adresi yoktur, bu yüzden yükleyici bir tane seçer.`0x08000000`, yani `.text`- ...`0x08000040`Çünkü bölüm dosya sıfırlaması ile başlar `0x40`- CLE yerleri`.text`- ...`0x400000`Ghidra'nın.`ElfLoader`Otur.`0x100000`- Evet .`llvm-objdump`Bölüm eksikliği çıkarıyor ve hiç temel yok.

Ghidra, taşınma işlemlerini içeriye aktarırken işliyor ve CLE uyguluyor. radar2 nesneyi açtığında bir ipucu yazdırıyor: taşınma uygulanmadı ve `bin.relocs.apply=true`Bir yüklemeci yer değiştirme ile ne yapar karar her sonraki aşamada görebilir, ve siz sonuçta karşılayacaksınız `-O0`Aşağıdaki masayı atlayın.

### Çıkartma

Ders 33 her iki yöntemin de bir parçası.`llvm-objdump`Rekürsiv düşüş çalıştırır ve sonra fonksiyon başlatma arayışı ekler. Binary Ninja'nın belgeleri, aşamaları sırayla isimlendirir: Tekrar Düşüş, Çağrı Hedef Analizisi, CFG Analiz "bilinmeyen bölgelerin doğrusal parçalanması" ve Tail Call Analiz. Ghidra analizerlerini öncelik olarak çalışır, "Giriş Noktalarını Çıkar" ve "Fonksiyon Başlangıç Arama" erken. IDA, her biri öncelikli olarak otomatik analiz kuyruklarını ve kütüphane kodu için FLIRT imzalarını tutar. Angr's `CFGFast`Bu fonksiyonun başlangıcı, simgeler, bir öncü taraması, çağrı hedefleri ve kalan baytların tam taraması.

### CFG'nin geri kazanılması

Her araç blokları 33 dersinde olduğu gibi keser. Bir farkla ölçersiniz.`call`Çünkü IRSB tek giriş, birden fazla çıkış blokudur ve bir arama bir çıkış.`grade_label`- ...`-O0`, bu da arıyor `grade`, 2 blok raporunu ve diğer üç raporunu 1. talimatlar aynı.

### Yükseltme

Binary Ninja, kaldırmayı "alt düzeyde bir dilden daha yüksek olarak kabul edilen bir orta diline çevirmek" olarak tanımlar. IR'ler ne için oldukları konusunda farklıdır. P-kod ve VEX analiz ve dekompilime için inşa edildi. ESIL ve RzIL emülasyon için inşa edildi ve hiçbirinde SSA aşaması yoktur. Hex-Rays mikrokod 72 opkodlu RISC benzeri kod olarak başlar ve olgunluk seviyeleri üzerinden geçiyor.`MMAT_GENERATED`- ...`MMAT_LVARS`. Binary Ninja, Lifted IL'ye yükseltilmiş, ardından bayrakları LLIL'de koşullara katlamış ve MLIL "registre ve hafıza erişimlerini değişkenlere çevirmiştir".

### SSA

Van Emmerik'in tezinde SSA'nın bir dekompilerle satın aldığı şeylerin listesi yer alır: ABI varsayımı olmadan ifade yayılması, parametre ve geri dönüş tanımlaması, koruma analizi, nadir veri akışı sorunu olarak tip analizi ve dolaylı sıçrama ve çağrıların analizi. Ghidra SSA yapısını adlandırır `Heritage`ve sadece grafikte bulunan iki işlem ekler.`MULTIEQUAL`phi ve  için`INDIRECT`Yan etkiler için. Binary Ninja, her IL düzeyinde bir SSA formunu ortaya çıkarır. angr'da iki SSA aşaması vardır.`Clinic`Hex-Rays, SSA formunu belirlememiştir ve küresel optimizasyon geçitlerinde kullanımı-def veri akışını gerçekleştirir.

### Veriler akışı ve türleri

Ghidra'nın ana basitleştirme döngüsü, hiçbir şey değişene kadar "Ölü Kodu Yıkayın", "Yerel Tipleri Öndürün" ve "Term Rewriting'i Yapın" ile çalışır.`Rule`Hex-Rays mikrokodı dönüştürür, çağrı argümanlarını tespit eder.`MMAT_CALLS`, ve yerel değişkenleri `MMAT_LVARS`. Angr runs `CallingConventionAnalysis`- Evet .`VariableRecoveryFast`ve`Typehoon`Bu aşamada, Noonan, Loginov ve Cok'un polimorf tip çıkarımlarının uygulanması.

### Yapılandırma

Ghidra'nın `CollapseStructure`Bu, bir yapı ile eşleşen alt grafikleri aramak, onları bir düğmeye düşürmek ve sıkışınca bir kenar çıkarıp yapılandırılmamış olarak işaretler.`if`- Evet .`while`- Evet .`do`ve`switch`Angr tek giriş ve tek çıkışlı bölgeler tanımlar ve bunları `SAILRStructurer`Öntanımlı olarak `PhoenixStructurer`ve `DreamStructurer`Ders 34'te bir yapılandırıcı elden yazmış.

### Emisyon

Ghidra C simgelerini gönderir .`PrintC`Oppen güzel yazıcıyla.`ActionNameVars`ve `ActionSetCasts`Hex-Rays ctree'i güzelleştirir ve basar. Binary Ninja HLIL'i Pseudo C, Pseudo Rust veya Pseudo Python olarak gösterir.`codegen.text`Radar izleri .`pdc`- Evet .`pdd`veya`pdg`- Evet .

## Dört IR'de tek talimat

Al .`48 83 ec 10`- Evet .`subq $0x10, %rsp`- Kağıt üzerine 33 dersindeki kurallarla yazın.

1. `48`REX ile `W = 1`Operand 64 bit.
2. `83`ModRM reg alanı işlemini seçer.
3. `ec`ModRM' dır.`11 101 100`- Evet .`mod = 11`Bu kayıt formudur.`reg = 101`- Evet .`/5`, yani `sub`- Evet .`r/m = 100`- Evet .`%rsp`- Evet .
4. `10`- 16'sı hemen.

Dört bayt verilen dört yükseltmecisine tam emirler ve tüm metinler yer alıyor.

ESIL radare2 6.2.4'ten 30 tokenden oluşan bir komasıyla ayrı bir dizilerdir:

```text
16,0x8000000000000000,-,!,16,rsp,-=,63,$o,^,of,:=,63,$s,sf,:=,$z,zf,:=,$p,pf,:=,64,$b,cf,:=,4,$b,af,:=
```

Bu bir yığın makinesi.`16,rsp,-=`Her bayrak sonra iç bir operatör ile yazılır: `$o`Aşırı akış,`$s`işaret,`$z`sıfır,`$p`Paritlik,`$b`- Borç al.

RzIL rizin 0. 9. 1 ile S- ifadesi 14 `set`Etkiler:

```text
(seq (set op1 (var rsp)) (set op2 (bv 64 0x10)) (set sub (- (var op1) (var op2))) (set rsp (var sub))
     (set _result (var sub)) (set pf (! (lsb (let _val (cast 8 false (var _result)) ...))))
     (set zf (is_zero (var _result))) (set sf (msb (var _result))) ... (set cf (|| ...)) (set of (|| ...)) (set af (|| ...)))
```

Her bayrak bitvektorlar üzerinde bir Boolean ifadesi.`let`- Evet .

SLEIGH özelliklerinden P-kod `x86:LE:64:default`Pypcode 4.0.1 üzerinden dokuz işlem yapılır.`IMARK`- ...

```text
CF = RSP < 0x10
OF = sborrow(RSP, 0x10)
RSP = RSP - 0x10
SF = RSP s< 0x0
ZF = RSP == 0x0
unique[58300:8] = RSP & 0xff
unique[58400:1] = popcount(unique[58300:8])
unique[58500:1] = unique[58400:1] & 0x1
PF = unique[58500:1] == 0x0
```

Gönderimleri geçici olarak kayıt altına al`unique`Bayraklar talimat üzerine hesaplanır, hevesle ve`CF`ve `OF`Kısıtlama üstlenmeden önce hesaplanır `RSP`- Evet .

pyvex 10.0.3 ' den VEX , `IMark`- ...

```text
t2 = GET:I64(offset=48)
t0 = Sub64(t2,0x0000000000000010)
PUT(offset=144) = 0x0000000000000008
PUT(offset=152) = t2
PUT(offset=160) = 0x0000000000000010
PUT(offset=168) = 0x0000000000000000
PUT(offset=48) = t0
```

VEX isimleri misafir devletindeki karşılığı ile kaydedilir ve karşılığı 48'dir.`rsp`144 ila 168 arasında tazminatlar .`cc_op`- Evet .`cc_dep1`- Evet .`cc_dep2`ve`cc_ndep`.Lifter 64 bit çıkarma olan işlem kodunu 8 ve iki operandı saklar.`pcode.writesFlags`Doğru ve `vex.computesFlags`VEX'in neden dört tanesi arasında en kısa olduğu açıklandı.

Aynı dört yükleyici .`48 63 c7`- Evet .`movslq %edi, %rax`, ilk talimat `grade`- ...`-O1`, 5 ESIL tokeni (`32,edi,~,rax,=`), 1 RzIL `set`, 1 P-kod işlevi (`RAX = sext(EDI)`Ghidra'nın kendi yazısı, başsız yazı yoluyla kaydedilen bu talimatın aynı işlevi yazdırır.`(register, 0x0, 8) INT_SEXT (register, 0x38, 4)`: register offset 0 `RAX`, karşılaştırma`0x38`- Evet .`RDI`, ve boyutları 8 ve 4 byte.

`83 f9 04`- Evet .`cmpl $0x4, %ecx`, sınır kontrolünden .`grade`, 30 ESIL tokeni, 13 RzIL `set`Bu nedenle, bu işlemler, 10 P-kod işlemleri ve 7 VEX açıklaması ile birlikte yapılmıştır.`cc_op`7, 32 bit çıkarma. Hiçbir şey yazmaz.`%ecx`VEX'de karşılaşacağınız iki çıkarma genişliği 32 bit için 7 ve 64 bit için 8'dir ve oluşturduğunuz çevirmen bu tabloyu taşıyor.

## Bir fonksiyon için dört adres tabanı

Harness herhangi bir şeyi karşılaştırmadan önce bir fonksiyonun nerede olduğu konusunda kendisiyle aynı fikirde olmalıdır.`grade`İçeride`ledger-x86_64-O1.o`- Evet .

| Tool | Address of `.text` | Address of `grade` | Offset |
|---|---|---|---|
| `llvm-objdump` | `0x0` | `0x10` | `0x10 - 0x0 = 0x10` |
| radare2, rizin | `0x08000040` | `0x08000050` | `0x08000050 - 0x08000040 = 0x10` |
| angr | `0x400000` | `0x400010` | `0x400010 - 0x400000 = 0x10` |
| Ghidra | `0x100000` | `0x100010` | `0x100010 - 0x100000 = 0x10` |

Simgolu tabloda şöyle yazıyor:`grade`- Evet .`.text + 0x10`Her alet tabanı çıkarınca aynı fikirde olur.`iSj`Radare2 ve rizin'de, `.text`Bölüm girişleri, `.text`Ghidra'nın çekiminde hafıza blokları ve sıfır.`test_every_tool_places_grade_at_offset_0x10_from_its_own_base`Bu gerçeği düzeltir.

## Araçların Nerede Anlaşması Ve Nerede Ayrılığı

- Kırmızı .`code/main.py`Bu rakamlar rapor edilir ve testler her birini doğruluyor.

### Anlaşmanın durumu: -O1'deki büyüklük

Dört fonksiyon, 56 işaretleme, 54 işaretleme ve 2 işaretleme. Her araç aynı talimatları her işlevde başlar: 9, 14, 13 ve 18. Dört grafik yapıcıları 3, 3, 5 ve 4 blok ve 2, 3, 5 ve 4 kenar rapor eder. Kenar kümeleri aynıdır, çift çift, radar2, rizin, angr ve Ghidra üzerinden.`total`33 ders el ile çizilenler.

Tek fark, dolandırıcılık.`66 90`Sonra .`grade`- Evet .`90`Sonra .`total`) tarafından çözülür, bu da durdurulmaya gerek yoktur, ve oluşturur `sub_40003e`ve `sub_40005f`Radar2, Rizin ve Ghidra hiçbirini iddia etmiyor.

### vektörlü durum: -O2'deki büyüklük

`total`Bu, dört grafik yapımcılarından her birinde, 13 kenarlı 10 blokta 41 talimat oluşturur. SSE2 döngüsü ve ders 33'ten gelen skalar kalıntı döngüsü her yerde aynı şekilde kesilir. angr yine iki işlevi doldurma sırasında ekler.

### Atlama masası: -O0 derecesi

Burada aletler bölünmüş ve bölünme ders.

| Tool | Blocks | Edges | What the capture says |
|---|---|---|---|
| radare2 | 3 | 2 | the block at `0x62` has no successor; bytes `0x76` to `0x9a` are never reached; 8 instruction starts missing |
| rizin | 8 | 11 | the block at `0x62` carries a `switch_op` with 5 cases and 4 distinct targets |
| angr | 8 | 7 | the case blocks exist, and the transfer at `0x62` goes to an unresolvable target node |
| Ghidra | 9 | 12 | `switchD` label at `0x74` splits the block; four `COMPUTED_JUMP` flows to `0x76`, `0x7f`, `0x88`, `0x91` |

Dörtü de ulaştıkları zaman aynı 33 talimatı çözmüşler.`jmp rax`Rizin ve Ghidra, ders 33'te okudukları dört farklı hedefi buldular.`.rela.rodata`Angr , içinde bulunan blokları listeler .`grade`ve hala atlama bloktan onlara hiçbir kenar yoktur; onun yakalama transfer kaydeder `0x62`Bu da çözülemez bir hedef düğmesine yol açar ve onun dekompilerinde bir bilgisayar yazısı basılır.`goto`Ghidra aynı kontrol akışında rizin'den bir blok ve bir kenar daha fazla çünkü anahtar analizi `jmp rax`ve blok modeli bir etikette yeni bir blok başlatır.

Ders-33 grafik 8 blok ve 11 kenar vardı. rizin tam olarak eşleşir. Konumuz 9 ve 11 ve 7 ve 2'nin bulunmuş kodun dört ölçümü olmadığını görmek. Bir araç bir dolaylı atlamayı ne kadar takip ettiğine ve nerede kesmeyi seçtiğine dair dört cevap.

### Kodlu veriler: tarama tuzağı

`lookup`tablo 4 bytes ile 24 byte `31 c0 90 48`- ...`0x10`.Süven rapor 8 talimat bu aralığında başlar. Harness çoğunluktan farklılıklarını listeler: ek başlangıçlar `0x10`- Evet .`0x12`ve`0x13`, ve bir başlangıç eksik .`0x14`Bu da o .`addq $0x1, %rax`Radar2, Rizin ve Ghidra raporları 6. başlıyor, 2 blok, 1 kenar ve ayrılıyor.`0x10`- ...`0x14`- 2 blok ve 1 kenar için aynı raporlar`lookup`Sonra da icat eder .`sub_400010`Tabloda bytes: 4 byetlik bir blokta 2 talimat, `0x14`, ikinci blok nerede `lookup`başlıyor, yani REX baytı `0x13`Bu nesne için harness'in son bulguları hiçbir grafik yapıcısının kodlamamıştır.`0x10`- ...`0x14`Bu baytlar bir fonksiyonun içinde yer alır ve veridir.

### Yaratılmış ve kaçırılmış, araçlar

Dört nesne boyunca harness, her biri dolgu veya tuzağı masasında, hiçbir sembol olmadan Angr'ın icat ettiği 9 işlevi isimlendirir.`grade`- ...`-O0`. Düzsel tarama dekodları ve hiçbir grafik yapıcı tarafından kod olarak değerlendirilmeyen 9 aralığı isimlendirir: sekiz dolgu boşluğu artı tuzağı tablosu.

## Üç Decompiler sınıfında .

Alınan araçlardan üçü C gibi metin yayıyor .`grade`- ...`-O1`Kaynak:`switch (score / 10)`5 vaka ile, sınır kontrolü ve geri dönüş değerleri tablosu ile oluşturulmuştur.

Ghidra 12.1.4:

```c
uint grade(int param_1)
{
  uint uVar1;
  uint uVar2;

  uVar2 = param_1 / 10 - 6;
  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);
  if (uVar2 < 5) {
    uVar1 = *(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4);
  }
  return uVar1;
}
```

10.0.3 oranı:

```c
extern unsigned int g_4000b4[4];

unsigned int grade(int a0)
{
    unsigned int v1;  // ecx
    unsigned int v2;  // eax

    v1 = (unsigned int)((long long)(a0 * 1717986919) >> 0x22) + (unsigned int)(a0 * 1717986919 >> 63) - 6;
    v2 = 0;
    if (v1 <= 4)
        v2 = g_4000b4[v1];
    return v2;
}
```

Radare2 6.2.4, `pdc`- ...

```c
void sym.grade (int64_t arg1) {
    rax = edi
    rax = rax * 0x66666667
    rcx = rax
    rcx >>= 0x22
    rax >>>= 0x3f
    ecx += eax
    ecx += 0xfffffffa
    eax = 0
    v = ecx - 4
    if (((unsigned) v) <= 0) {
        eax = ecx
        rcx = rip
        eax = dword [rcx + rax*4]
    }
    return
}
```

Ghidra'nın terimi tekrar yazmak çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı çarpı`0x66666667`ve 34'e geri dönüş`param_1 / 10`Angr aynı baytları kaldırdı ve aritmetikleri bıraktı.`a0 * 1717986919 >> 0x22`Radar2.`pdc`ESIL emülasyonu artı sahte sentaks: kayıt isimleri, değişkenler yok, türler yok ve sınır kontrolü olarak basılmıştır `<= 0`Ghidra, masanın yükünü yazdı.`DAT_001000b4`; açıklanmıştır `g_4000b4[4]`Ghidra ve Angr da vakaların sayısını geri alamadı, çünkü`-O1`Baytlarda anahtar kalmadı.`-O0`, atlama masası var, Ghidra yazdırıldı `switch(param_1 / 10)`6 ile 10 arasında bir durum ve varsayılan bir durum ve angr yazdırılmış bir hesaplanmış `goto`- Evet .

Rizin'in kendi dekompilerine sahip değil ve yakalama kayıtları da bunu gösteriyor.`pdc`Binary Ninja'nın HLIL ve Hex-Rays ağacı bu dersin yakalayamadığı iki çıkış.

## Yapın

Demo çalıştır:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
```

Çıktı bir JSON raporu. Bu, çekim sırasında kaydedilen araç sürümleri ile ve makinenizdeki araçlarla açılır, bunların hepsi yok olabilir. Sonra dört nesnenin her biri için sembol uzantıları, dolgu boşlukları, her bir araçın kullanıldığı tabanı, işlev bulduğumuz veya icat ettiğimiz her bir aracı başlatır ve her işlev için talimat-başlatma anlaşması, blok sayıları, kenar sayıları ve her bir araçta eksik olan kenarları verir. Bu, her alet için bayt hesaplaması, araçların kendi notları, açık cümlelerde bulguların bir listesine ve IR bölümüne bitiyor: kaydedilen asansörlerde ölçülen sayıların yanında üç talimat için tercümanın çıkışı.

Beklenen şekil:

```json
{
  "captureTools": {"llvm-objdump": "Apple LLVM version 17.0.0", "radare2": "radare2 6.2.4 ...", "rizin": "rizin 0.9.1 ...", "angr": "10.0.3", "ghidra": "12.1.4"},
  "localTools": {"radare2": "absent", "...": "..."},
  "fixtures": {
    "ledger-x86_64-O0.o": {
      "bases": {"llvm-objdump": "0x0", "radare2": "0x8000040", "angr": "0x400000", "ghidra": "0x100000", "...": "..."},
      "functions": {"grade": {"blocks": {"radare2": 3, "rizin": 8, "angr": 8, "ghidra": 9}, "edges": {"radare2": 2, "rizin": 11, "angr": 7, "ghidra": 12}, "...": "..."}},
      "findings": ["radare2 never reaches bytes 0x76-0x9a inside grade that the other graph builders decode", "..."]
    }
  },
  "ir": {"translator": [{"text": "subq $0x10, %rsp", "flags": {"pcodeLike": "eager", "vexLike": "thunk"}, "...": "..."}], "observed": {"...": "..."}}
}
```

Oku `code/main.py`Bu sırada:

1. `read_text_symbols()`bölüm başlıklarını ve `STT_FUNC``.text`Simge masası, harmanın sahip olduğu tek temel gerçekliktir.`TextSection.gaps()`Doldurma da ondan çıkar.
2. `parse_objdump()`- Evet .`parse_r2_family()`- Evet .`parse_angr()`ve`parse_ghidra()`Her bir tutsak bir `ToolView`: bir taban, uzunluk için ödenilen talimatlar ve bir `FunctionView`Her analizci bir araç kelimesini ve başka hiçbir şeyi bilmiyor.
3. `majority()`ve `ranges()`Her iki örnek de yardımcıdır.
4. `function_report()`talimat başlangıçlarını grafik yapıcıların çoğunluğuna karşı karşılaştırır, sonra blok sayıları, sonra kenar setleri ve her araçta eksik olanları listeler.
5. `byte_report()`bir simge içindeki her bayt için kod olarak hesaplar, doldurma, talep edilmeyen, icat edilmiş veya kaçırılmış, ve hiçbir grafik yapımcısı tarafından çözülmeyen semgelerin içindeki baytların isimlerini verir.
6. `findings()`Bu cümleleri cümleye dönüştürür.`compare()`her nesne için bir rapor oluşturur.
7. `decode_small()`- Evet .`to_pcode_like()`ve`to_vex_like()`Üç kodlama, bir gayretli stil, bir tonluk stil.
8. `observed_ir()`Yaptıkları asansörleri ölçüyor ve `figure_data()`Zaman çizelgesini, sahne tablosunu ve figürdeki kanıtları bir araya getiriyor.

Üç emir daha var.`python3 code/main.py compare FIXTURE.o`Bir nesnenin raporunu yazdırırır. `python3 code/main.py ir 4883ec10`Tek talimat için tercümanın iki formu basılır. `python3 code/main.py figure-data`Resimde yerleştirilen verileri basar.

Yakalamalar bir kere yapıldı .`code/fixtures/capture_tools.py`, her komutu ve versiyonunu kaydeder .`captures.json`. Harness ve testler asla bir alet başlatmaz. Eğer aletleriniz varsa, dosyaları yenilendirecek şekilde yakalama senaryoyu çalıştırın ve gerekli ortam için README armatürlerini okuyun.

## Kullan

Bu sırada yeni bir nesneye harnası kullan.

1. Bir nesneyi kendiniz yapın ve kompili emrini tutun. Bir araç açmadan önce simge tablosunu okuyun, böylece kaç işlev olduğunu ve doldurmanın nerede olduğunu biliyorsunuz.
2. Her bir aletin başsız modunda bir kez yakalayın. Çizim çıkışı ve tam komutu nesnenin yanında saklayın.
3. Temel kontrol edin. bir fonksiyon seçin ve her aracı onun eksik sonra aynı sıfırlama yerleştirdiğini onaylayın `.text`Eğer bir tane değilse durup, bu aletin ne yüklediğini öğren.
4. Eğer grafik yapımcıları burada anlaşmazlık yaşıyorsa, diğer karşılaştırma analiz değil, çözme ile ilgilidir.
5. Blokları ve kenarları karşılaştırın ve bir sayıyı değerlendirmeden önce her bir araçın notlarını okuyun.`switch_op`, a `COMPUTED_JUMP`, ya da çözülemez bir hedef düğüm çoğu farklılığı açıklar.
6. Bir araçın işleyen bir heuristik olduğunu iddia eden bir takma. Bir araçın bırakdığı simge bytes bir durak yürüyüştür. Graf yapıcısının iddia etmediği simge bytes veri.
7. Belgelerden alınan bir açıklama yararlıdır ve bir yakalama ile farklı bir kanıt türüdür.

## İnteraktif Laboratuvar

### Laboratuvar A: Bir fonksiyon, dört taban

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/code
python3 -q
```

Çık:

```python
from main import *
views = load_views("ledger-x86_64-O1.o")
{tool: hex(view.base) for tool, view in views.items()}
{tool: hex(view.functions["grade"].start + view.base) for tool, view in views.items()}
```

İkinci satır çalışmadan önce dört çiğ adresini yazın ve bu derste masa karşısında kontrol edin.`grade`- Evet .`grade_label`Ve Ghidra'da nerede oturduğunu el ile hesaplayın.

### Laboratuvar B: Dört taraftan atlama masası

```python
report = compare("ledger-x86_64-O0.o")
report["functions"]["grade"]["blocks"]
report["functions"]["grade"]["edgesMissingPerTool"]["radare2"]
report["notes"]["rizin"]
report["notes"]["ghidra"]
report["bytes"]["radare2"]["misses"]
```

Radarın eksik olan kenarlarını say ve her birini bir çizgiye eşleştir .`-O0`Sonra Ghidra notunu okuyun ve `switchD`Ghidra yakalama etiketinde.

### Laboratuvar C: Bir parça karşısına hevesli bayraklar

```python
translate("48 83 ec 10")["pcodeLike"]
translate("48 83 ec 10")["vexLike"]
translate("83 f9 04")["vexLike"]
{row["name"]: (row["pcode"]["ops"], row["vex"]["statements"]) for row in observed_ir()["instructions"]}
```

Bul .`cc_op`Her iki çıkışta da sabit ve neden biri 8 ve diğerinin 7 olduğunu açıklayın.`translate("48 01 c8")`Ve oku `TranslateError`- Evet .

### Laboratuvar D: Beş alet altında tuzak

```python
report = compare("sweep-trap.o")
report["functions"]["lookup"]["instructionStarts"]
report["bytes"]["dataInsideSymbols"]
report["functionStarts"]["angr"]
```

Baytları çöz`31 c0 90 48 83 c0 01`Kağıt üzerinde bir süpürge gibi, sonra bir düşüş gibi.`jmp`İki listenizi eklenti ile eşleştirin ve kayıplar raporlarını açar.

## Pratik Laboratuvar

Beşinci bir yakalama ekle ve kemeri uzat.

Gereksinimler:

- Bu derste alınmayan ve makinenizde çalıştırabileceğiniz bir araç seçin: GNU `objdump`, Capstone ile LIEF, elle ihraç edilen Binary Ninja Free seansı veya farklı bir analizör seti ile Ghidra.`captures.json`- Evet .
- Bir analizci yaz ki bu çekimi bir `ToolView`Araçın tabanı, talimatları, fonksiyonları, araçın bulduğu bloklar ve kenarları.
- Araç ekle `TOOLS`ve eğer bir grafik oluşturursa,`DESCENT_TOOLS`Demo'yu çalıştır ve çoğunluk setlerinde ne değişmiş olduğunu oku.
- Aracın blokunun sayıldığını belirten bir test yazın `ledger-x86_64-O1.o`Ve bir test, tuzak masasıyla ne yaptığını kanıtlar.
- Aletin kendi kelimelerinde, yükleme cihazı, sökme cihazı ve CFG'yi ne dediğini söyleyen ders için bir paragraf yazın.

Başarılı olmak demektir .`python3 code/main.py`Yeni araç hakkında raporlar `captureTools`, her fonksiyonda `ledger-x86_64-O1.o`- Devam ediyor .`allDescentToolsAgree`doğru ve bulgular `sweep-trap.o`Yeni araç byte ile ne yaptı söyle `0x10`- ...`0x14`- Evet .

## Ders Artifakti

Bu ders de içerir .`outputs/skill-the-reverse-engineering-landscape.md`Bu uygulama, oluşturduğunuz bir nesne üzerinde birkaç araç çalıştırmak, adreslerini bir tabanına indirmek ve her fonksiyona göre talimat başlangıcı, blokları ve kenarları hakkında anlaştıkları ve her araçın icat ettiği veya kaçırdığı bytes hakkında rapor vermek için kullanılır. Kaydedilen komutlar ve sürümler ile çekimler, dosyadan okunmuş bir sembol tablosu ve yalnızca belgelere dayanarak hangi araçların tanımlandığı açıklaması gerekir.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/37-the-reverse-engineering-landscape
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Verifikasyon, şunu kanıtlamalıdır:

- ELF okuyucuunda 4 fonksiyon sembolü bulunur `ledger-x86_64-O1.o`16, 46, 31 ve 63 boyutları ve iki dolgu boşluğu ile
- Dört nesne için 86, 56, 84 ve 11 talimatları.
- Radar2 ve rizin aynı talimatları, blokları ve kenarları rapor ediyor.`ledger-x86_64-O1.o`, ve sadece radar2 ' in varlığı .`pdc`metin
- Dönüş işaretleri`sub_40003e`ve `sub_40005f`Simgolu olmayan fonksiyonlar olarak
- Ghidra'nın blokları için.`total`ders 33'ün beş blokları ve çağrı akışları grafik kenarları değil
- Her alet yerleri `grade`- Yapabilir miyim ?`0x10`tabanı çıkarıldıktan sonra
- Her araç , her talimatın başlangıcında , her işlevinde aynı fikirde .`ledger-x86_64-O1.o`
- Dört grafik yapımcısı, aynı kenar setleri olan 3, 3, 5, 4 blok ve 2, 3, 5, 4 kenarları rapor ediyor.
- `total`- ...`-O2`Her grafik yapımcısında 10 blok ve 13 kenar var.
- `grade`- ...`-O0`3, 8, 8 ve 9 blok ve 2, 11, 7 ve 12 kenarları var radare2, rizin, angr ve Ghidra, her aletin notlarında nedenlerle
- `grade_label`- ...`-O0`Arama sırasında bir blok biten Angr hariç her yerde bir blok
- Angr, her dolgu boşluğunda bir fonksiyonu ekleyip, bir tane tuzak masasında icat eder ve başka bir araç bir fonksiyonu icat etmez veya kaçırmaz.
- Artarma kazançları başlar.`0x10`- Evet .`0x12`- Evet .`0x13`ve kaybeder .`0x14`Tuzakta, ve hiçbir grafik yapıcı kodlama yapmıyor.`0x10`- ...`0x14`
- Bulgular radar'da kayıp aralığı ve angr'da ortaya çıkan her fonksiyonun adını verir.
- Manifestoda bir versiyon ve tüm 21 yakalama dosyası için bir komut kaydediliyor .
- Üç aletyi çözelim .`grade`, ve sadece Ghidra bölünme dilini katlar
- Tercüman CF, OF, SF, ZF, PF'yi bir stil ve bir `cc_op`Diğerinde bir tane, kayıt yazmaz.`cmp`, ve bayrak yok `movslq`
- çevirmen hafıza formlarını, diğer opkodları, ekstra REX bitlerini ve yanlış uzunlukları reddediyor.
- Tercümanın `cc_op`8 ve 7 numaraları yakaladığı VEX'deki numaralara eşit.
- Alınan asansörler, üç talimat için 9, 1, 10 P-kod işlemleri ve 7, 4, 7 VEX ifadeleri verir.
- Zaman çizgisi 1973'ten 2026'a kadar devam eder. Bu hattın sekiz aşaması ve her hücrede bir terimi olan altı alet vardır.
- Eğitmeci rakam, harnessin ürettiği aynı verileri içerir.

## Üretim Başarısızlık Modları

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Raw addresses from different tools | "the tools disagree about where grade is" | one offset after each base is removed, checked on one function |
| Block count as a measure of code found | "Ghidra found the most code" | the same instruction starts, with the extra block explained by a label |
| One tool as the oracle | "objdump shows the table bytes are instructions" | the sweep is a linear sweep; three graph builders leave the bytes unclaimed |
| Padding functions counted as discoveries | "angr found seven more functions" | every one sits in a padding gap or on data, and none has a symbol |
| A stopped walk reported as dead code | "the four case blocks are unreachable" | 36 bytes missed by one tool and reached by three |
| Edge counts compared without the notes | "rizin and Ghidra disagree on grade" | the same four computed targets, one extra split at a label |
| A decompiler's arithmetic read as the program | "the function multiplies by 1717986919" | the idiom from lesson 34, folded by one tool and left by another |
| A closed tool described as if run | "Binary Ninja reports five blocks" | the figure and the table mark it as documentation only |
| Captures without commands | "we ran radare2" | the manifest with version, command, and date for every file |
| An IR with no flags read as a lossy lift | "VEX dropped the flags" | the thunk in `cc_op`, `cc_dep1`, `cc_dep2`, evaluated at the branch |

## İşlem Kuralı

Her aletin komut ve sürümü ile bir kez yakalayın, her adresi bir bazaya indiriniz ve talimatları bloklardan önce başlatırken ve blokları kenarlardan önce karşılaştırın. Her baytın iddia edildiği, doldurulduğu, verilerin kaybedildiği gibi hesaplanmasını sağlayın.

## Daha Fazla Okumak

- [Cifuentes, "Reverse Compilation Techniques", PhD thesis, QUT (1994)](https://eprints.qut.edu.au/36820/)
- [Cifuentes and Gough, "Decompilation of Binary Programs", Software: Practice and Experience (1995)](https://doi.org/10.1002/spe.4380250706)
- [Van Emmerik, "Static Single Assignment for Decompilation", PhD thesis, University of Queensland (2007)](https://espace.library.uq.edu.au/view/UQ:158682)
- [Schwartz, Lee, Woo, Brumley, "Native x86 Decompilation Using Semantics-Preserving Structural Analysis and Iterative Control-Flow Structuring" (USENIX Security 2013)](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Yakdan et al., "No More Gotos" (NDSS 2015)](https://www.ndss-symposium.org/ndss2015/ndss-2015-programme/no-more-gotos-decompilation-using-pattern-independent-control-flow-structuring-and-semantics/)
- [Basque et al., "Ahoy SAILR! There is No Need to DREAM of C" (USENIX Security 2024)](https://www.usenix.org/conference/usenixsecurity24/presentation/basque)
- [Andriesse et al., "An In-Depth Analysis of Disassembly on Full-Scale x86/x64 Binaries" (USENIX Security 2016)](https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/andriesse)
- [Flake, "Structural Comparison of Executable Objects" (DIMVA 2004)](https://dl.gi.de/items/7f573931-cb51-49ef-a12c-0452a9fb0ea4)
- [Maranzano and Bourne, "A Tutorial Introduction to ADB", Bell Labs (1977)](http://squoze.net/UNIX/v7/files/doc/18_adb.pdf)
- [Stallman, KTH lecture on GDB entering distribution (30 October 1986)](https://www.gnu.org/philosophy/stallman-kth.html)
- [Hex-Rays, "IDA: celebrating 30 years of binary analysis innovation"](https://hex-rays.com/blog/ida-celebrating-30-years-of-binary-analysis-innovation)
- [Guilfanov, "Decompiler internals: microcode", Recon Brussels 2018 (slides)](https://www.recon.cx/2018/brussels/resources/slides/RECON-BRX-2018-Decompiler-internals-microcode.pdf)
- [Hex-Rays, microcode view and maturity levels](https://docs.hex-rays.com/core/decompiler/how-tos/microcode-view)
- [Hex-Rays, IDA 9.4 release notes](https://docs.hex-rays.com/release-notes/9_4)
- [Hex-Rays, IDA Free](https://hex-rays.com/ida-free)
- [Ghidra releases (12.1.4)](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Ghidra P-code reference](https://github.com/NationalSecurityAgency/ghidra/blob/master/GhidraDocs/languages/html/pcoderef.html)
- [Ghidra decompiler source, main work flow and Action classes](https://github.com/NationalSecurityAgency/ghidra/tree/master/Ghidra/Features/Decompiler/src/decompile/cpp)
- [Ghidra analyzeHeadless README](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/RuntimeScripts/support/analyzeHeadlessREADME.md)
- [Binary Ninja, BNIL overview](https://docs.binary.ninja/dev/bnil-overview.html)
- [Binary Ninja, "Architecture Agnostic Function Detection in Binaries" (2017)](https://binary.ninja/2017/11/06/architecture-agnostic-function-detection-in-binaries.html)
- [Binary Ninja, batch processing and headless licences](https://docs.binary.ninja/dev/batch.html)
- [Binary Ninja 6.0 "Krypton" release post](https://binary.ninja/2026/09/03/binary-ninja-6.0-krypton.html)
- [Binary Ninja Free](https://binary.ninja/free/)
- [radare2 book, ESIL](https://book.rada.re/emulation/esil.html)
- [radare2 book, decompilers](https://book.rada.re/arch/decompile.html)
- [radare2 releases (6.2.4)](https://github.com/radareorg/radare2/releases)
- [rizin, RzIL design notes](https://github.com/rizinorg/rizin/blob/dev/doc/rzil.md)
- [rizin releases (0.9.1)](https://github.com/rizinorg/rizin/releases)
- [Announcing Rizin (8 December 2020)](https://rizin.re/posts/announcing-rizin/)
- [Cutter releases (2.5.0)](https://github.com/rizinorg/cutter/releases)
- [angr documentation, CFG recovery](https://docs.angr.io/en/latest/analyses/cfg.html)
- [angr documentation, the decompiler and its analysis passes](https://docs.angr.io/en/latest/analyses/decompiler.html)
- [angr documentation, intermediate representation (VEX)](https://docs.angr.io/en/latest/advanced-topics/ir.html)
- [angr on PyPI (10.0.3)](https://pypi.org/project/angr/)
- [pypcode on PyPI](https://pypi.org/project/pypcode/)
- [llvm-objdump command guide](https://llvm.org/docs/CommandGuide/llvm-objdump.html)
- [GNU objdump manual](https://sourceware.org/binutils/docs/binutils/objdump.html)
- [LIEF documentation](https://lief.re/doc/stable/index.html)
- [Capstone releases](https://github.com/capstone-engine/capstone/releases)
- [BinDiff releases (v8, open source)](https://github.com/google/bindiff/releases/tag/v8)
- [Diaphora](https://github.com/joxeankoret/diaphora)
- [Hopper Disassembler downloads](https://www.hopperapp.com/download.html)
- [Compiler Explorer](https://github.com/compiler-explorer/compiler-explorer)
- [LLDB announced as an LLVM subproject (2010)](https://blog.llvm.org/2010/06/new-lldb-debugger.html)
- [Boomerang decompiler](https://boomerang.sourceforge.net/)
- [Tan et al., "LLM4Decompile" (EMNLP 2024)](https://aclanthology.org/2024.emnlp-main.203/)
- [Gao et al., "DecompileBench" (Findings of ACL 2025)](https://aclanthology.org/2025.findings-acl.1194/)
- [Liu, Raff, Micinski, "When LLM Decompilers Recompile More and Preserve Less" (2026)](https://arxiv.org/abs/2609.05370)
