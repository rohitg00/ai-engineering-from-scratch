# Yeniden Yap ve Düzgün Göster: Farklılık Testleri, Byte karşılaştırması ve Kanıt Çubuğu

> Testlerinize geçmek testlerinize katılmayı kanıtlar. Dürüstlük için her kenara ulaşan ve yer değiştirme maskesinden sonra eşleşen byte bir ağ gerekir.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## Öğrenme Hedefleri

- Bu talimat listesinden bir yeniden yapı yaz ve nereden geldiğini gösteren kanıt kayıtlarını isimlendirin.
- Tehlike başına bir sınıfla giriş şebekesi oluşturun: sıfır koruma, negatif değerler, kısaltma bölümü, 32 bit aşırı akış ve bölme tuzağı.
- Orijinal ve yeniden oluşturmayı tek bir programla çalıştır ve bir tuzak da dahil olmak üzere her hücreyi kaydet.
- Yeniden oluşturmayı orijinal bayraklarla yeniden oluşturun ve yer değiştirme alanlarını gizledikten sonra işlev baytlarını karşılaştırın.
- Yer değiştirme noktaları sabitleri okuyun ve karşılaştırın, böylece yanlış bir kelime geçemez.
- Rea'nın MCP sunucusu küçük bir stüdyo istemcisinden çalıştır ve her adımı kanıt kimliği ile kaydet.
- İddia ve kanıt bağlantılarının üzerine bir hash olan bir kanıt kaydı oluştur.

## Sorun

Reya ' dan iş dosyasını istedin .`percent_change`Bizim içinde`ledger-x86_64-O1.o`Ghidra 12.1.4'in sahte kodunu geri verdi ve ajan bu C'yi yazdı:

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

Dört test geçiyor:`(100, 150)`50 verir.`(200, 100)`-50 verir.`(0, 5)`0 verir.`(50, 100)`- Ajan da yeniden inşa edildi.`grade`Dört kişi gibi.`if`90, 80, 70 ve 60'daki ifadeler.

Bu rapor şu soruların hiç birine cevap vermiyor:

- Orijinal ne zaman geri döner ?`(after - before) * 100`32 bit içinde değil mi?
- Orijinal skor 110'e ne verir?
- Yeniden inşa edilen yapı orijinal 16 byte ile aynı şekilde toplanıyor mu?
- İki işlev aynı baytlara sahip olduğunda, yer değiştirmeleri aynı sabitlere işaret eder mi?
- Yeniden inşaat hangi kanıt kaydından geldi ve ajan listeni mi okudu yoksa sahte kodumu mu?
- C kompiliörü olmayan bir host üzerinde kanıtın durumu nedir?

Bu dersin her hedefi bizim yazdığımız ve hazırladığımız bir program.

```figure
re-36-prove-equal
```

## Kanıtlar Ne Söyler

Ajan döngüsü .`code/main.py`Stüdyo üzerinden 6.5.0'a 6 kez telefon ettim.`code/fixtures/runs/agent-run.json`- Sunucu cevap verdi .`initialize`Protokol versiyonu ile `2025-11-25`Üç arama kanıt kayıtlarını geri verdi:

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

İlk çağrı Ghidra ithalatı ve otomatik analiz için ödeme yapıldı.`confidence: "observed"`- Evet .`authority: "shipped-artifact"`, ve nesnenin SHA-256'ı,`9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`Ghidra , yer değiştirilecek nesneyi yükler .`.text`- ...`0x100000`- Evet .`percent_change`Oturmuş .`0x100000`ve `grade`- ...`0x100010`- Evet .

 için pseudokod`percent_change`Bu da `long`Ürün:

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{
  long lVar1;
  undefined1 auVar3 [16];
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  ...
}
```

Decompiler gördü .`cltd`ve `idivl`İkisini de yaz `edx`ve `eax`Aynı kayıtta yer alan listede daha net bir şey belirtildi:

```
0x100000: TEST EDI, EDI
0x100002: JZ 0x0010000d
0x100004: SUB ESI, EDI
0x100006: IMUL EAX, ESI, 0x64
0x100009: CDQ
0x10000a: IDIV EDI
0x10000c: RET
0x10000d: XOR EAX, EAX
0x10000f: RET
```

Her operasyon 32 bit genişliğinde.`IMUL EAX, ESI, 0x64`32 bit olarak çarpır ve yarısını düşük tutar.`CDQ`işaret uzatmaları`eax`- ...`edx`ve`IDIV EDI`64 bit çiftini 32 bit bölücü ile bölüyor.`100 * (after - before) / before`İçeride`int`- Evet .

- Evet .`grade`Bu kayıt aynı şekilde.`*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`, ve okunabilir olmayan bir varsayılan ifadeler`0x66666667`. Listede 10 ' a bölünme gösterildi .`IMUL RAX, RAX, 0x66666667`- Evet .`SAR RCX, 0x22`- Evet .`SHR RAX, 0x3f`- Evet .`ADD ECX, EAX`- O zaman ...`ADD ECX, -0x6`- Evet .`CMP ECX, 0x4`ve`JA`Onlar 6'dan 10'a kadar kalsın.`XOR EAX, EAX`karşılaştırmadan önce varsayılan 0. `LEA RCX, [0x1000b4]`ve `MOV EAX, dword ptr [RCX + RAX*0x4]`5 4 baytlı girişten oluşan bir tablo okuyun.

4. Adım 20 bayt okuyun:`01000000 02000000 03000000 04000000 04000000`Masanın adı...`1, 2, 3, 4, 4`Onlar için 6, 7, 8, 9, 10.`switch`İçeride`ledger.c`, ile`case 10`ve `case 9`4. değer paylaşımı.

Rea'nın kendi kanıt sayfalarında bulunan her iki kanıt da listeden ve `read_bytes`DX-Ball'ın ilk pseudokodu`FUN_00406400(void)`Bu kayıt, bir sürü giriş olmadan, talimat görünümünde düzeltilmiştir.

## adayları yazın

Dizin`code/fixtures/candidates/`Bu test, bir dosya için bir fonksiyon olan sekiz yeniden oluşturma içeriyor. Dörtü listeni takip ediyor veya aynı kodun üzerine oluşturmaktadır. Dörtü doğru ve yanlış veya bir el yazılı testin bulduğu şekilde yanlış.

| File | Source | What it does |
|---|---|---|
| `percent_change_mul_first.c` | `100 * (after - before) / before` | the listing in C |
| `percent_change_split.c` | `(after * 100 - before * 100) / before` | different text, same bytes after clang folds it |
| `percent_change_wide.c` | `(int)(((long)after - before) * 100 / before)` | the pseudocode's `long`, divides before it wraps |
| `percent_change_div_first.c` | `(after - before) / before * 100` | divides first, so rounding differs |
| `grade_switch.c` | `switch (score / 10)` with the five cases | the original source |
| `grade_table.c` | `unsigned slot = score / 10 - 6; slot < 5 ? points[slot] : 0` | the listing in C |
| `grade_thresholds.c` | `if (score >= 90) return 4; ...` | no upper bound on the top band |
| `grade_case10_wrong.c` | `case 10: return 3;` | one table entry wrong |

Her dosya , sabit komut ile oluşturulur .`clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`- Yüklenen nesneler kaynakların yanında yapılır.

## Birinci Bacak: Yürüt ve karşılaştır

McKeeman'ın 1998'deki farklılık testi tanımı "iki veya daha fazla karşılaştırılabilir sistem" gerektiriyor ve farklı bir sonuç, bir asılma veya bir kaza ile bir hata adayı olarak ilgileniyor. Zor kısmı şöyle adlandırıyor: "Sınavlarda en çirkin sorun, bir testin sonuçlarını değerlendirmek". Doğru cevabı bilmemiz gerekmiyor. Orijinal ve yeniden inşa edilen bir ağın hiçbir yerinde anlaşmazlığa uğraması gerekiyor.

### Şebekenin tasarımı

`input_grid()`İçeride`code/main.py`92 hücre oluşturur.`percent_change`On kişilik her çift alıyor.`before`değerleri ve yedi `after`değerler:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

- Evet .`grade`22 puan alır: her çubuğun her iki tarafı, negatif, 0, 110, ve iki `int`Sınırlar.`classify()`-17 sınırı 14, düz 12 ve sıfır koruma 7. negatif kesim 5'e, yuvarlaklaştırma 2'ye, anahtar 2'nin ötesine ve tuzağa 1.

Her sınıf bir nedenden dolayı var.`TEST EDI, EDI`Salısal hücreler, kesinti bölümü kontrol eder: C ve `idiv`sıfıra doğru yuvarlak, yani `-9 / 10`0 ve `-10 / 10`-1. Dörtlü hücreler çarpımın bölünmeden önce olup olmadığını kontrol eder.`(105 - 100) * 100 / 100`5 değil 0. Aşırı akış hücreleri oluşturur `(after - before) * 100`32 bitten fazla. tek bir tuzak hücresi, paketlenmiş ürünü eşit yapar.`INT_MIN`- Evet .`before`-1'e eşit.

Yang, Chen, Eide ve Regehr, Csmith'i tanımlanamayan davranışlar olmayan programlar oluşturmak için inşa ettiler. tanımlanamayan davranışlar üzerine bir oracle anlaşmazlığı gürültüdür ve asla bir hata raporudur. İmza edilen aşırı akış C'de tanımlanamıyor. Orakelimiz sabit bir davranışlı bir toplanmış nesnedir, bu nedenle aşırı akış hücreleri kapsamda. Ders hangisi standartta ve hangisi toplanmış baytlarda dayanır.

### Şoför ve Tuzak

`code/driver.c`Stdin'den her satırda bir hücre okuyor ve girişleri, orijinal sonucu ve yeniden inşa sonucu yazdırıyor. `build_harness()`adayın  ile birlikte oluşturulması`-Dpercent_change=cand_percent_change -Dgrade=cand_grade`Bu nedenle, her iki versiyon da farklı isimlerle bir programla bağlantılıdır. x86-64 Linux host'ta orijinal nesne sabit nesnedir.`ledger.c`Doğal olarak oluşturulan ve rapor kayıtları `original_kind: fixture-source`- Evet .

Sürücü bir `SIGFPE``sigsetjmp`ve `siglongjmp`- Evet .`before = -1`ve `after = 536870911`, fark 536870912 ve 32 bit ürün 2147483648 olarak sarılır.`idiv`Bu dividend ve -1 bölücü ile bölme hatası istisna yükseltilmektedir.`trap`- Evet .

AArch64'te.`sdiv`Arşivde bir arşiv var ve raporda hangisinin çalıştığı belirtildi.

### Sonuçlar

`prove_behaviour(PLAUSIBLE)`Bu da `long`10 saf olay geçer. 28 hücreye şebeke düşüyor.

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

26'sı da .`percent_change`Başarısızlıkları `|before| > 1`- Evet .`before`1 veya -1'e eşit olan 64 bit oranı, paketlenmiş değere geri döner, bu yüzden bu hücreler tesadüfen birleşiyor.`grade`Başarısız oldu çünkü orijinal anahtarın onlarca 11 ve üstü için bir sebebi yok ve `110 / 10`11'dir.

`prove_behaviour(EQUAL)`inşa eder.`percent_change_mul_first.c`ve `grade_switch.c`Bütün 92 hücre aynı fikirde.`percent_change_div_first.c`Bu dört safdan iki tane başarısız oldu. Bu da el yazılı bir testin bulduğu tek durum.

`oracle_disagreements()`İkinci bir şeyi kontrol ediyor.`percent_change_model()`ve `grade_model()`listede Python modelleri, `wrap32()`32 bit çarpma için ve `idiv32()`Rapor, modelin her hücre üzerinde gözlemlenen orijinal ile karşılaştırıldığını gösterir. sıfır anlaşmazlıklar model ve ikili her hücre üzerinde anlaşılır demektir.

## İkinci Bacak: Yeniden Toplayıp karşılaştır

Bir şebekede davranış bir bacak. İkinci bacak aynı kompili ve bayraklarla oluşturulan yeniden yapılandırmanın aynı baytlar üretip üretmediğini sorar. DX-Ball projesi yardımcı için "63 eşleşen bayt" rapor etti. TH04 projesi 2.139 bayt eşleşimi rapor etti. Her biri kendi döneminin kompili kullanmıştır. rea kendisinin bunu yapamaz.`compare_functions`Line-diffs sağlayıcı metni ve "Yüzleşme açık olmayan sağlayıcı metindir; yer değiştirme normalleşmesi kullanılamıyor" sınırlamasını ekler.

### Nesneyi oku

`ElfObject`İçeride`code/main.py` ile bir ELF64 yer değiştirilebilir nesne okur`struct.unpack_from`Büyüyü, 64 bit sınıfı, küçük bir veriyi kontrol ediyor.`e_machine`62, ve `e_type`1. Sonra bölüm başlıklarını, dizileri,`.symtab`, ve her `.rela`Bölüm.`percent_change`Başlıyor .`.text`0 ile 16 boyutlu sıfırlama ve `grade`- ...`0x10`46 boyutlu.`total`Başlıyor .`0x40`31 boyutlu ve `grade_label`- ...`0x60`63 boyutlu.

16 byte `percent_change`- Evet .`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`- Fonksiyonda yer değiştirilmez.`grade`Bir tane var: Ofset `0x26`fonksiyonun içinde, tip `R_X86_64_PC32`, sembol`.rodata`, ekleme`0x10`7 baytlı bir cihaz .`leaq`- Yapabilir miyim ?`0x23`, son dört baytı yer değiştirme alanı.

### Maske, sonra kayıtları karşılaştır

RELA nesnesinde ekleme yer değiştirme kaydında yaşar ve dört alan baytı sıfırdır.`grade_switch.o`Bir basit bayt karşılaştırma iki yer değiştirme farklı yerlerin isimleri geçerken geçer. `mask_relocations()`her iki tarafta da alanı sıfırlıyor, bu yüzden aynı yöntem REL nesneleri ve alanın eklenmesini taşıyan Mach-O için geçerlidir.

O zaman ...`prove_bytes()`Yer değiştirme kayıtlarını, ofset, tip ve hedef bölümleri ile karşılaştırır.`.rodata+0x10`ve aday diyor ki:`.rodata-0x4`. Ekleme , aday nesneyi kullanmayan bir nesne olduğu için farklıdır .`labels.rel`Farklı bir ekleme farklı bir fonksiyon değil, farklı bir sıfırlama.

### Konstantleri okuyun . Yer değiştirme noktaları

Kuralını bitiren bir PC ile ilgili alan için, CPU bir sonraki talimat adresini ekler, bu nedenle hedefi simge artı ekleme artı 4'tür.`.rodata+0x14`, ve adayda öyle .`.rodata+0x0`- Evet .`read_table()`Burada 5 4 baytlı giriş var.`1, 2, 3, 4, 4`- Evet .

Beşinci sayım listeden geliyor:`CMP ECX, 0x4`- Evet .`JA`0 ila 4 arasındaki indeksleri kabul eder ve `[RCX + RAX*0x4]`indeks başına 4 byte okuyor. `CLAIMS`İçeride`code/main.py`Bu şekli kaydetmek için `grade`ve  için sıfır yer değiştirme kaydını kaydeder.`percent_change`- Evet .

Bu adım TH08 projesi tarafından belgelenen bir hata nedeniyle var. Daha eski bir karşılaştırma "enti adresini talimatın yer değiştirme alanına tekrar oynadı, ardından bu adresdeki yüzen-yazılı verileri kontrol etmeden talimat baytlarını karşılaştırdı. Kaynak `0.0`Bu nedenle hedef karşısında tam olarak doğru görünmek mümkün .`128.0`"Düzeltme 1,548 kayarak kelimelerden alıntı yapıldı ve on iki tane daha düzeltildiler. `grade_case10_wrong.c`46 byte kodu orijinaline eşit, yer değiştirme kaydı aynı şekle sahip ve tablo`1, 2, 3, 4, 3`Sadece sürekli kontrol başarısız olur.

### Sonuçlar

| Candidate | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 vs 16 | equal | none | none | pass |
| `percent_change_split` | 16 vs 16 | equal | none | none | pass |
| `percent_change_wide` | 16 vs 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 vs 18 | size differs | none | none | fail |
| `grade_switch` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_table` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_thresholds` | 46 vs 39 | size differs | 1 vs 0 | none | fail |
| `grade_case10_wrong` | 46 vs 46 | equal | same shape | `1,2,3,4,4` vs `1,2,3,4,3` | fail |

İki sonuç ikinci bir bakışa değer.`percent_change_split.c`farklı kaynak metni ve aynı baytları vardır, çünkü clang imzalanmış aşırı akışları tanımlanmamış olarak değerlendirir ve katlanır `after * 100 - before * 100`Bir katlayalım.`grade_table.c`Ayrıca byte byte ile eşleşir, böylece kompiliör bir dizi endeksinden ve bir `switch`. Byte eşleşmesi bu bayraklarla bu kompilicinin adaydan aynı kod ürettiğini kanıtlar.

Ölçüm bir teşhis değil bir kabul. rea'nın kanıt sayfaları doğru uzunluğu olan ve 467 farklı bayt olan 1.825 baytlı bir aday kaydeder.`wide`yeniden inşa etmek 26 byte çünkü `movslq`- Evet .`imulq`- Evet .`cqto`ve`idivq`32 bit formları değiştirdi. listede herhangi bir kompileden önce genişliği belirtiyorlardı.

## Ajanın Çelişkiyi Çıkarmak

Rea'nın MCP araçlarından altmış beşte CLI komutu yoktur ve `verify_reconstruction`- Bunlardan biri.`McpStdioClient`İçeride`code/main.py`Bu, en küçük müşterinin ulaştığını gösteriyor.`npx -y rea-agents@6.5.0 mcp`, stdin'e her satır başına bir JSON-RPC talebi yazar ve bir ipten bir satır başına bir JSON nesnesini okur.`initialize`Protokol versiyonu ile `2025-11-25`O zaman ...`notifications/initialized`O zaman ...`tools/call`- Arama başına varsayılan süre 330 saniye, aynı rea numarası Ghidra soğuk açılış için izin verir.

`agent_loop()`Altı çağrı yapar ve her birini kaydeder:

```json
{
  "step": 2,
  "tool": "analyze_function",
  "arguments": {"procedure": "percent_change"},
  "seconds": 6.31,
  "is_error": false,
  "evidence_id": "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd",
  "confidence": "observed",
  "authority": "shipped-artifact",
  "limitations": ["Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.", "..."],
  "result_sha256": "..."
}
```

Tam kanıt kayıtları aynı dosyada kimliklerinin altında saklanır.`table_address()`Bulur `LEA``grade`listelenme ve besleme `read_bytes`- Evet .`open_binary`- Evet .`get_evidence_bundle`ve`close_binary`Delil kayıtlarını geri gönderme ve sıfır bir kimlik ile kaydedilmelidir.

`run_agent(live=True)``npx`Yolda ve `GHIDRA_INSTALL_DIR`Eğer bu testler bir adım daha ileriye doğru ilerlerse, bu testler bir adım daha ileriye doğru ilerler.`code/tests/fake_rea_server.py`her bir sunucuya cevap veren bir stand-in sunucu.`tools/call`Bu, aynı araç ve argüman için kaydedilen kayıtlara sahip.

### REA'nın doğrulayıcısı ne söyleyebilir ve söyleyemez

- Evet.`verify_reconstruction`Bu özellikler, bir fonksiyonla ilgili bir iddiada, bir sunucu metnini karşılaştırır.`compare_functions`. Davranışsal bir iddia , iki kayıtlı işlemin yakalanmasını karşılaştırır .`compare_process_captures`Kaynak kayıtlarının arama kapsamı eksik olduğunda, aramalar hakkındaki iddia `unknown`Rea'nın içindeki hiçbir şey yeniden inşa edilmiş bir işlevi oluşturmaz veya giriş şebekenizin üzerinde çalıştırmaz.

rea'nın yükümlülük defteri, bir kanıt kaydı bekliyor.`predicate_type: "rea.reconstruction-proof"`- Evet .`operation: "verify_reconstruction_obligations"`- Evet .`confidence: "observed"`ve`normalized_result.passed === true`Hiçbir kamu tesisi bunu yaymaz.`build_proof()`İçeride`code/main.py`- Çerez:

```json
{
  "predicate_type": "rea.reconstruction-proof",
  "operation": "verify_reconstruction_obligations",
  "confidence": "observed",
  "authority": "controlled-replay",
  "normalized_result": {
    "passed": true,
    "status": "pass",
    "claims": [
      {"claim_id": "percent_change.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "percent_change.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "grade.referenced-constants", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]}
    ]
  },
  "evidence_links": ["ev_e88b10dc...", "ev_67b6d3f9..."],
  "evidence_id": "ev_..."
}
```

Kimlik adı `ev_`Ayrıca, kimliği olmayan kayıtın SHA-256'sını, sıralanmış anahtarlı kompakt JSON'a ekle.`aggregate()`Başarısız olarak kapatılmıştır: `fail`O zaman kazanır.`unknown`, ve boş bir talep listesi `unknown`C kompozisyoncu olmayan bir sunucuda iki davranış iddiası `unknown`Kayıtta şöyle yazıyor:`unknown`Her iki bayt davası geçerken bile.`authority`- Evet .`controlled-replay`, çünkü kanıt kendi harmanımızdan geliyor ve sadece nesne dosyasından değil.

## Araştırma Ne Söyler

Liu, Raff ve Micinski 2026'da dokuz konfigürasyonda sekiz dekompiliasyon sistemini ölçtüler. Referans değerinin içeren her testi geçen adaylar hala fuzzed girişler konusunda farklıdır. Bu oran genel olarak yüzde 4,9'du ve bir sistem için yüzde 13'e kadar. GitHub'un 300 kütüphane fonksiyonunda ve 287 CVE tabanlı fonksiyonda en güçlü gelişme modeli Ghidra'nın oluşturma oranını yüzde 75'ten yüzde 90'a yükseltti. Aynı fonksiyonlarda davranışsal eşleşme oranı yüzde 74'ten yüzde 62'ye düştü. Sebebini, geleneksel bir dekompilerci'nin geride bıraktığı görünür bilinmeyenleri değiştiren icat edilmiş alanlara, türlere, kallelere ve gardiyanlara kadar izlediler.

Bizim .`percent_change_wide.c`Bu tür bir türden bir tür.`long`Bu nedenle, Ghidra'nın kendi pseudo-C'si, HumanEval-Decompile'de bu iddiaların yüzde 20.12'ini geçti.

DecompileBench, gerçek 130 programdan 23.400 işlevi ölçtü. LLM yöntemlerini endüstriyel dekompiliyecilere göre işlevsel doğrulukta yüzde 52,2 daha düşük olduğunu ve daha yüksek anlaşılabilirlik puanları olduğunu buldu.

Alanın kullandığı üç kanıt da yapabileceğiniz üç bacak. Phoenix ve DREAM çıkışını yeniden birleştirir ve orijinal programın testlerini yürütür. McKeeman ve Csmith, orijinal ile karşılaştırıldığında oluşturulan girişleri tanımlanmış davranış içinde tutarak çalıştırırlar. Ramos ve Engler, sınırlı sembolik uygulamalar ile iki C fonksiyonunu kontrol ederek, bir giriş boyutuna kadar tüm keşfedilen yollarda eşitliği kanıtlar. Bu ders ilk iki dersi oluşturur. Üçüncüsü ders 35'in kanıt defterindeki pratik laboratuvarı. Bir şebekenin güvenilmesi için çok küçük olduğu zaman.

## Yapın

Standart kütüphane harnesini çalıştır:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
```

Clang'ın yol üzerinde olması ile, demo her iki aday çiftini de oluşturur ve her biri için 92 hücre çalışır. Sekiz adayı yeniden oluşturur, ajan çalışmasını tekrar yapar ve kanıt kaydını oluşturur. Clang olmadan, görevli nesneleri okuyor ve davranış iddialarını rapor eder.`unknown`- Evet .

Bir arm64 Mac'de beklenen şekil:

```json
{
  "host": "aarch64 Darwin",
  "originalKind": "fixture-source",
  "gridCells": 92,
  "plausible": {"naivePassed": true, "gridMismatches": 28, "oracleDisagreements": 0},
  "equal": {"naivePassed": true, "gridMismatches": 0, "oracleDisagreements": 0},
  "legTwo": {
    "percent_change_mul_first": {"status": "pass", "reasons": []},
    "percent_change_wide": {"status": "fail", "reasons": ["size 16 vs 26 bytes"]},
    "grade_case10_wrong": {"status": "fail", "reasons": ["referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"]}
  },
  "agentRun": {"mode": "replayed fixture", "server": {"name": "rea", "version": "6.5.0", "protocolVersion": "2025-11-25"}},
  "proof": {"status": "pass", "evidence_id": "ev_..."}
}
```

Oku `code/main.py`Bu sırada:

1. `wrap32()`- Evet .`c_div()`- Evet .`idiv32()`, ve ikisi de .`*_model()`fonksiyonlar listenin tam sayı semantiklerini içerir.
2. `input_grid()`ve `classify()`92 hücreyi oluşturup etikete koyun.
3. `build_harness()`ve `execute()`Bir programı orijinalden, yeniden adlandırılan adaylardan oluşturun ve `driver.c`Sonra hücreleri çalıştır.
4. `prove_behaviour()`1. adım raporunu eşleşmezlik ve model anlaşmazlıklarıyla gönderir.
5. `ElfObject`Başlıkları, sembolleri ve `.rela`Kayıtlar.`mask_relocations()`ve `read_table()`- Karşılaştırmayı hazırla.
6. `prove_bytes()`boyutları, maskeli aralıkları, yer değiştirme şekli ve tabloları ile iki ayak raporunu gönderir.
7. `McpStdioClient`ve `agent_loop()`- Evet. - Evet.
8. `build_proof()`ve `aggregate()`Başarısız bir kayıt oluşturdu.

## Kullan

Yeni bir fonksiyonun eşit olduğunu kanıtlamak için, bu adımları tekrarlayın:

1. Getir .`analyze_function`Bu işlev için kanıt kimliğini kaydet.
2. İhtiyacını listenin işlevi genişliklerinden yaz.
3. Listeye her katlayış, ekleme, çıkarma ve bölme yapın. Her birini genişliğinde sarıp alan grid girişlerini ekleyin.
4. Listede her karşılaştırma sabitinin her iki tarafını ekleyin.`grade`Bu, çıkarmadan sonra 6 ve 4 oldu.
5. Hedef üzerinde tuzağa düşebilecek her bölücüyi ekle ve hangi mimarisi ağı çalıştığı kaydedilsin.
6. İki bacağını da çalıştır ve durumdan önce nedenleri oku.
7. Kanıt kaydı adayın yanında kalsın.`evidence_links`Bir okuyucuya iddiaların hangi kayıtlara dayandığını söyleyin.

Bir bayt eşleşmesi, bir bayrak seti ile bir kompilatör hakkında bir ifade.

## İnteraktif Laboratuvar

### Laboratuvar A: model ve çalışma

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

Çık:

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

İlk çağrıda -133 değerini, ikinci çağrıda 3 ile bölünmüş paketlenmiş ürün değerini verir.`'trap'`Ve üçüncü -2147483648 verir. rapor 10 saf vaka geçildiğini ve 28 grid hücresi başarısız olduğunu gösteriyor.`report.oracle_disagreements`Boş bir listeyle.

### Laboratuvar B: nesneyi oku

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

Alan baytları `00000000`- Yer değiştirme isimleri .`.rodata`Ekleyici ile`0x10`, ve masa da şöyle okuyor .`[1, 2, 3, 4, 4]`- Evet .

### C laboratuvarı: Bir sabit kırın

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

Baytlar eşleşir, kayıtlar eşleşir ve tablolar eşleşmez.`grade_case10_wrong.c`- Evet .`case 10`4'ü tekrar gönderir, sabit komut ile yeniden birleştirir ve durum değişimini izler `pass`- Evet .

### Laboratuvar D: sürücü rea

6.5.0 rea ve Ghidra 12.1.4 ile:

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
npx tsx code/main.ts --live
```

İlk .`analyze_function`Ghidra nesneyi içeri aktarırken birkaç saniye sürer. Yeni kanıt ID'lerini görevlendirilen çalışmayla karşılaştırın. Aynı analiz profili altında aynı baytlar aynı ID'leri verir, çünkü id dosya yolunu dışlayan bir içerik hashidir.

## Pratik Laboratuvar

İki bacağını da uzat .`total`ve `grade_label`Aynı nesnenin.

Gereksinimler:

- - Evet .`total`Bu sayıyı oluşturmak için, 0 sayısını, bir negatif sayısını, bir element ve 32 bit ile toplamları oluşturun.
- - Evet .`grade_label`, fonksiyon çağrıları `grade`İndirim ve okuma `labels.rel`, bir tabloda kendi yerlerini değiştiren beş nispetik iplik karşılaştırma`.rela.rodata`- Evet .
- Bir ekle`CLAIMS` için giriş`grade_label`İki yer değiştirme ve beş 4 baytlı girişden oluşan bir tablo ile, girişlerin işaret ettiği ipleri karşılaştırın.
- Eğer varsa, model ve çalışmanın hangi hücrelerle anlaşamadığını kaydet ve her birini listeye dahil ederek açıklayın.
- Kanıt kaydına her fonksiyon için bir tek iddia ekleyin ve toplamı başarısızlıkla kapatmayın.

Başarılı olmak, kanıt kaydı dört işlevi listeler, her iddia bir kanıt kimliği taşır ve `grade_label`etiket bir ip farklı olduğunda başarısız olur.

## Sınıflandırılmış Laboratuvar

Bu dersin ayarları hakkında beş soru.`code/lab_answers.json`. Sayıları sayılar olarak ya da  gibi altıbuçluk ipler olarak yaz .`"0x40"`, ve listeler JSON listeleri olarak.

1. `t1`%_change_model(3, 105) x86_64'te.
2. `t2`%_change_model(0, 5) x86_64'te.
3. `t3`: grade_model(100).
4. `t4`: input_grid'deki hücrelerin sayısı().
5. `t5`: x86_64 modelinin tuzağa düştüğü ağ hücrelerinin sayısı.

Cevaplarınızı kontrol edin:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
npx tsx code/lab.ts
```

Kontrolcü , her beklenen değerini `code/main.py`- Bu, yazılı.`PASS`- Evet .`FAIL`veya `TODO`Her görev ve puan için, ve sadece beşinin geçtiği zaman 0'dan çıkıyor. `python3 code/lab.py my-answers.json`Başka bir dosyayı kontrol ediyor.`code/tests/test_lab.py`kontrol eden kişinin doğru cevapları kabul ettiğini ve yanlışını reddettiğini kanıtlar.

### Çıkıyor gör .

- Evet .[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)Bu ders, bu iddiayı kontrol edilen bir adım haline getiren bir adımdır.

## Çıktıran beceriler

Bu ders bize çok yararlı .`outputs/skill-rebuild-and-prove-equal.md`. Fonksiyon kanıtını ve bir adayın yeniden oluşturulmasını iki ayaklı bir kanıt ve bir kanıt kaydı haline getirmek için kullanın.

## Kontrol et

Demo ve test süiti çalıştır:

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

35 test kanıtlıyor:

- `c_div()`sıfıra doğru kesilir ve `wrap32()`İki kişinin tamamını takip eder.
- model -133'e göre `(3, INT_MAX)`- Evet .`trap`x86-64 numaralı tuzak hücresi ve AArch64 numaralı -2147483648 numaralı tuzak hücresi için
- Grid 92 hücre ve her tehlike sınıfına sahiptir ve saf durumlar her sert sınıfı önler.
- ELF okuyucu kaydedilen sıfırlama ve boyutlarda dört işlevi bulur.
- `percent_change`16 byte , yer değiştirilmeden ve `grade`- Bir tane var .`R_X86_64_PC32`- ...`0x26`
- Yer değiştirme alanı baytları sıfırdır ve maskeli bir şey değiştirmez bu RELA nesnesinde
- Tüm sekiz aday beklenen statüye ulaşırken, kayıtlı nedenlerle
- `grade_case10_wrong`Gizli baytlar geçer ve sadece sabit kontrolden geçer
- Kaydedilen bir bacaklı atışlar 10 saf geçiş, 28 eşleşme eksikliği ve sıfır model anlaşmazlıklarını gösteriyor.
- Bir kompiliörle, her iki çift de aynı sonuçla yeniden inşa ve tekrar çalıştırır.
- SHA-256 ile ilgili olarak, `ev_`Her kanıt adımında kimlikler
- `read_bytes`kayıt ELF okuyucu bulduğu tabloya eşittir
- Müşteri sahte sunucuyu çalıştırır ve gerçek çalıştırma ile aynı kanıt kimliklerini kaydeder .
- sunucudan bir hata sonucu çalıştırma kaydına girer
- `aggregate()`Başarısız olarak kapatılmış ve kanıt kimliği içeriğinden yeniden hesaplanır

## Üretim Başarısızlık Modları

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Rebuild keeps the decompiler's `long` | "ten tests pass" | 26 overflow cells differ from the original |
| Thresholds replace a switch | "every grade band passes" | 110 and larger return 0 in the original |
| Divide before multiply | "formula is algebraically equal" | rounding cells differ, naive cases fail |
| Trap cell skipped | "no crashes" | x86-64 raises `#DE`, AArch64 returns `INT_MIN`, the report names the host |
| Byte compare without masking | "bytes equal" | relocation records name different offsets |
| Masking without reading constants | "bytes equal after masking" | `1,2,3,4,3` differs from `1,2,3,4,4` |
| Size taken as acceptance | "same length" | differing bytes inside the same length |
| Different compiler or flags | "bytes differ, rebuild wrong" | the same source gives different bytes, so the compare is void |
| Model treated as observation | "model agrees" | the run is observed, the model is derived, disagreements are listed |
| Claim without evidence id | "verified" | every claim links an `ev_` record of the function it covers |
| No compiler on the CI host | "passed" | behaviour claims are `unknown` and the aggregate is `unknown` |
| Pseudocode read as source | "decompiler says long" | the listing shows `IMUL EAX`, `CDQ`, `IDIV EDI` |

## İşlem Kuralı

Listeden yeniden oluşturmayı yazın ve kaydeden kaydı isimlendirin. Her araları sarıp her karşılaştırma sabitini geçen bir şerit üzerinde orijinaline karşı çalıştırın. Orijinal bayraklarla yeniden oluşturun, yer değiştirme alanlarını gizleyin, kaydları karşılaştırın ve işaret ettikleri sabitleri okuyun. Her iddiayı kanıt kimliği ile kaydetin ve doğrulanmamış bir iddiayı bilinmesin.

## Daha Fazla Okumak

- [McKeeman, Differential Testing for Software, Digital Technical Journal 10(1), 1998](https://www.cs.tufts.edu/comp/150FP/archive/bill-mckeeman/DifferentailTesting.pdf)
- [Yang, Chen, Eide, Regehr, Finding and Understanding Bugs in C Compilers, PLDI 2011](https://doi.org/10.1145/1993498.1993532)
- [Ramos, Engler, Practical, Low-Effort Equivalence Verification of Real Code, CAV 2011](https://doi.org/10.1007/978-3-642-22110-1_55)
- [Schwartz, Lee, Woo, Brumley, Native x86 Decompilation Using Semantics-Preserving Structural Analysis, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026](https://arxiv.org/abs/2609.05370)
- [Gao et al., DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Tan et al., LLM4Decompile, arXiv 2403.05286, 2024](https://arxiv.org/abs/2403.05286)
- [System V gABI, Chapter 4, Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)
- [x86-64 psABI repository, relocation types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV](https://developer.arm.com/documentation/ddi0487/latest)
- [rea 6.5.0 MCP contracts](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/mcp-contracts.md)
- [rea 6.5.0 reconstruction obligation ledgers](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/reconstruction-obligation-ledgers.md)
