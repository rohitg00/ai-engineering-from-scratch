# İkilik Analizde Kanıtlar, Güven ve Bilinmeyenler

> Bir program hakkında bir bulgu, bir hash, bir güven, bir yetki ve gösteremeyeceği şeylerin bir listesini içeren bir kayıttır.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 32 (ELF from scratch), Phase 13 · 33 (disassembly and control flow), Phase 13 · 34 (lifting to pseudocode)
**Time:** ~105 minutes

## Öğrenme Hedefleri

- Rea'nın modeline göre bir kanıt kaydı oluşturun.`Evidence`Gözlem, elde ve çıkarılan güvenle.
- Dosya başka bir klasöre taşındığında aynı kalmış içerik-hash kimliklerini hesaplayın.
- Her sağlayıcı kayıtla birlikte seyahat eden sınırlamalar olarak gösteremeyeceği şeyleri kaydet.
- Görevden alınan bir işlevin gösterdiği sonuçlar onu desteklemeden sonuç belirtmeyi reddetmek.
- Geri kalan bilinmeyenleri bir hash zinciri ile birleştirilen gözden geçirilmiş kayıtlar olarak tutun.
- Kaş sağlayıcısı tam bir anahtar altında cevap verir ve eski bir tekrarlamayı reddeder.

## Sorun

Bir ajanı ne diye sorarsan .`grade`İçeride`ledger-x86_64-O1.o`Bu durumda, bir değerlendirmeci, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeciyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirmeyi, bir değerlendirme, değerlendirmeyi, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değer, değerlendirme, değerlendirme, değerlendirme, değerlendirme, değer, değerlendirme, değer, değerlendirme, değer, değer, değerlendirme, değer, değerlendirme, değerlendirme, değer, değer, değerlendirme, değer, değer, değer değer değer değer, değer değer, değer değer, değer, değer değer değer değer değer, değer, değer değer değer değer, değer değer değer değer`uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);`O noktada baytlar `xor eax, eax`- Evet .

Bu ifade ve talimat her girişi için 0'dur. Ajan bunu bilmiyordu.[NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)) Dört tekrarlanan zayıflık belirtiyor: eğitim önyargısı, gözlemlere aşırı güven, bağlam sınırları ve plan kalıcılığı. 2026'da yapılan bir başka çalışmada ikili metinler içine eklenmiş ve modellerin 40 durumdan 35'te eklenmiş güvenli olmayan eylem önerdiğini bulmuştur ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507))

rea 6.5.0 ajanı bunun için bir kelime havuzunu sağlar.`Evidence`bir kayıt ile`confidence``observed`- Evet .`derived`veya`inferred`, bir `authority`, ve bir liste .`limitations`Paketlenmiş yetenek ajanı şöyle uyarır: "Her sonuç gözlemleri, sonuçları ve bilinmeyenleri ayırt etmelidir. Kanıt ID'lerini alıntılayın, sınırlamaları ve eksik kapsamayı koruyun ve asla statik analiz gözlemlenmiş bir yürütme anlamına gelmesin".

Bu işlemin gerçekleştirici bir yönü bulunmadığında, bir verifikasyon bir iddiayı geçer ve kendi yorumunda bir geçişin "küresel uygulama eşdeğerliği oluşturmadığını" belirtir.`verified`- İçinden geç.

Bu ders, kayıp parçayı basit Python'da oluşturur. Bu cihazla ilgili her şeyi bir kayıt olarak kaydeden bir defter yazarsınız.`percent_change`ve `grade`Bu yüzden, bu kayıtları kendi başınıza oluşturduğunuz test programının çalışmasına karşı kontrol edin.

```figure
re-evidence-ledger
```

## Güven için üç kelime, yetki için beş kelime

`confidence`üç değerli bir enum, asla bir sayı değildir. `authority`Bir üreticinin hiçbir şey söylemediği zaman, rea kullanır.`shipped-artifact`- Evet .`observed`- Evet .

| Value | Meaning on the fixture | Records in this lesson |
|---|---|---|
| `observed` | A fact read from bytes or from a run | the ELF reader's section and symbol reads, the two Ghidra records, 17 host runs |
| `derived` | A fact computed from observed records | the switch table model, the division model, every unknown mutation |
| `inferred` | An expectation that no observation states yet | 18 predictions |
| `shipped-artifact` | The file on disk was the source | every read of `ledger-x86_64-O1.o` |
| `controlled-replay` | A run you controlled produced the fact | the host runs of `harness.c` |
| `analyst-inference` | Your own judgement | predictions and unknown mutations |
| `historical-reference` | An older source tree or document | none here |
| `external-service` | A service outside the file and the host | none here |

İki karışıklık en çok zaman harcar. Birincisi, pseudokod'u davranış gözlemleri olarak değerlendirir. Ghidra'nın yazdığı bir gözlemdir. İkincisi boş bir listeyi yokluğun kanıtı olarak değerlendirir. rea'nın tasarım notu sıkıdır: "Gelip giden kapsam bilinmemektedir, yokluk değil".`code/main.py`Her iki kural da kodlanır.

## Kayıt

Bir kayıt tam olarak on altı alanı vardır ve rea 6.5.0 diğer alanları reddeder. `code/main.py`Bu yüzden her iki tarafta kayıt diğer tarafta geçerlidir.`relationship_coverage`, bir arama yapanların veya çağrıda bulunanların listesinin ne kadar tam olduğunu gösterir.`complete`- Evet .`partial`veya`unknown`veya`null`Operasyon arama ilişkileri olmadığını bildirirken.

| Field | What it holds |
| --- | --- |
| `evidence_id` | `ev_` and 64 hex digits, a hash of the content |
| `subject` | `name`, `digest.sha256`, `format`, `architecture`, `local_path`, or `null` |
| `provider` | `id`, `name`, `version` or `null` |
| `analysis_profile` | the provider's settings and their digest, or `null`, always present |
| `predicate_type` | a tag, `rea.analysis` by default |
| `operation`, `parameters` | the tool and its input |
| `raw_result`, `normalized_result` | provider output and the canonical result |
| `confidence`, `authority` | the enums above |
| `environment` | `id`, `platform`, `architecture`, `isolation`, or `null` |
| `limitations` | plain sentences |
| `relationship_coverage` | `status` `complete`, `partial`, or `unknown` with diagnostics, or `null` |
| `locations` | `address`, `address-range`, `artifact-path`, `file-offset`, `file-offset-range` |
| `evidence_links` | the `ev_` ids this record rests on |

Bu gerçek kayıt .`grade`Burada önemli olan alanlara kesin.`code/fixtures/rea-evidence-grade.json`37,573 byte.

```json
{
  "evidence_id": "ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1",
  "subject": {
    "name": "ledger-x86_64-O1.o",
    "digest": { "sha256": "9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f" },
    "format": "elf",
    "architecture": "x86_64",
    "local_path": "/private/tmp/aiefs-re/phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/fixtures/ledger-x86_64-O1.o"
  },
  "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
  "analysis_profile": {
    "provider": { "id": "ghidra", "name": "Ghidra", "version": "12.1.4" },
    "parameters": { "jump_table_evidence": "typed-case-default-blocks-v1", "import_mode": "ephemeral-source-immutable" },
    "digest": "9c7f6b24be69294e61da046e4583e3856cb9e40433b149c1bf8bb534d2fe03ef"
  },
  "operation": "analyze_function",
  "parameters": { "procedure": "grade" },
  "confidence": "observed",
  "authority": "shipped-artifact",
  "environment": null,
  "limitations": [
    "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>.",
    "Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals."
  ],
  "relationship_coverage": {
    "status": "complete",
    "diagnostics": [
      "Only resolved Ghidra call references are returned; unresolved computed or indirect calls remain unknown, while function classifications distinguish thunks and externals."
    ]
  },
  "locations": [],
  "evidence_links": []
}
```

Gerçek .`parameters`Profil nesnesinin 25 anahtarı var.`limitations`Bir kısıtlama içeriğin bir parçasıdır, bu yüzden birini düşürmek kimliği değiştirir ve büyük kaydı kayıtı reddeder.

Kayıtta ne söylenmediğine dikkat edin. `environment`- Evet .`null`Çünkü Ghidra bir dosyayı okudu ve hiçbir şey çıkmadı.`locations`Bu operasyon raporları içeride adresler için boştur `normalized_result`- Evet .`relationship_coverage`- Durumu var .`complete`Diagnostik olarak sadece çözülmüş Ghidra çağrı referansları geri gönderildiğini ve çözülmemiş bilgisayar veya dolaylı çağrıların bilinmediğini söylüyor.

## İd, bir içerik bir karışımdır ve yol içi değildir

gerçek hesaplamalar`evidence_id`- Evet .`ev_`RFC 8785 kanonik JSON'a SHA-256 ekleyerek kaydın bir projeksiyonunu tutar.`digest`- Evet .`format`ve`architecture`ve damlalar .`name`ve `local_path`Düşüyor .`relationship_coverage`değeri `null`Bu yüzden arama ilişkileri olmayan bir kayıt, alanın var olmasından önceki kimliği korur.`raw_result`Ve her sınırlama, hashed.

RFC 8785 nesne anahtarlarını sıralar, beyaz alanı çıkarır ve sayı ve dizilme formlarını düzeltir.

```python
def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
```

`code/main.py`RFC 8785 ve Python'un bazı floatları farklı yazdırması nedeniyle, hash yapmadan önce floatları reddeder.

| rea value | Recomputed by `code/main.py` |
|---|---|
| `ev_67b6d3f992eaf49a…` for `grade` | equal |
| `ev_e88b10dc0c6400e5…` for `percent_change` | equal |
| profile digest `9c7f6b24be69294e…` over `{provider, parameters}` | equal |
| `query_26122aebe9d8abae…` for the `grade` snapshot entry | equal |
| `query_0f95ef38038d3666…` for the `percent_change` entry | equal |

Aynı baytların aynı gözlemleri her makinede ve her klasörde aynı kimliği elde eder.`local_path`Yukarıdaki listede bir Mac'teki bir klasörün isimleri bulunmaktadır.`/home/you/re`- Evet .`rebind_subject_path()`Yeni bir yol altında bir kayıt göstermenizi sağlar.`sha256`- Evet .`format`veya`architecture`farklılık gösterir. rea 6.5.0 aynı şeyi yapar `rebindEvidenceToTargetPath`Yeni bir yolda bir hedefe bir anlık görüntü kaydını tekrar yaparken.

`validate_evidence()`Bu, "Deliliğin semantik tanımlayıcıı kayıtlarına uymıyor" cümlesiyle uyumsuzluğunu reddeder.`analysis_profile.provider``provider`- Test .`test_tampered_id_and_mismatched_profile_are_rejected`Gerçek içindeki bir satır sahte kod düzenler `grade`Kayıt ve kayıt kayıtları reddediyor.

## Nesneyi Kendiniz Dikkat Edin

Herhangi bir sağlayıcıdan önce, defter dosyayı okuyor.`observe_object()`ELF64 bölüm başlıklarını analiz eder. `.symtab`- Evet .`.strtab`ve`.rela.text`- Evet .`struct.unpack_from`Bir tane yazıyor .`inspect_object`Kayıt ve bir .`read_function_bytes`- Bu beş işlev simgesi için kayıt.`observed`yetkili bir şekilde`shipped-artifact`, çünkü kaynak disk üzerindeki dosyadı.

| Record | Content | Id |
|---|---|---|
| `inspect_object` | five sections with offsets, sizes, and hashes, four functions, three relocations | `ev_645e0a145f28bd5c…` |
| `read_function_bytes percent_change` | 16 bytes at `.text+0x00` | `ev_2572a7d254ad15cb…` |
| `read_function_bytes grade` | 46 bytes at `.text+0x10`, SHA-256 `ffcb75c2a7bb1104…` | `ev_a467c2427bfc0c56…` |
| `read_function_bytes total` | 31 bytes at `.text+0x40` | `ev_b1e845cea2543073…` |
| `read_function_bytes grade_label` | 63 bytes at `.text+0x60` | `ev_c50041be26e6b7f4…` |

`llvm-objdump -t`Katılıyorum: `grade`- ...`0000000000000010`büyüklüğü ile`2e`- Üç yer değiştirme .`.rela.text`- Evet .`R_X86_64_PC32``.rodata`Tasarruflarda`0x36`- Evet .`0x84`ve`0x93`, eklemlerle`0x10`- Evet .`0x24`ve`-0x4`Her kayıtta bir `file-offset-range`konum ve bir sınırlama: "Section bytes disk üzerindeki dosyadan okunuyor. Okuyucu yer değiştirme uygulanmaz ve hiçbir kod çalıştırmaz".

Ders 32 bu okuyucuyu tamamıyla oluşturur. Burada 60 satır var, çünkü bu ders okuduklarınız hakkında kaydettiklerinizle ilgilidir.

## Tabloyu Al ve Onu Aldığını De

46 byte `grade`Ders 33'ün çözdüğü dört örneği içerir:

| Bytes | Instruction | Offset in `grade` |
|---|---|---|
| `48 69 c0 67 66 66 66` | `imul rax, rax, 0x66666667` | 3 |
| `48 c1 f9 22` | `sar rcx, 34` | 13 |
| `83 c1 fa` | `add ecx, -6` | 23 |
| `83 f9 04 77 0c` | `cmp ecx, 4` then `ja` | 28 |

Bir çarpma `0x66666667`34'ün ardından 10'a bölünmüş bir bölünme yapılır. Dosya 10 numarasını tutar.`derive_grade_model()`Bu gerçeği bir sınırlama olarak yazıyor: "10 bölücü 0x66666667 çarpıcısından ve 34'ün değişiminden bir çıkıştır. Dosya 10 sayısını tutmaktadır".

- Evet .`add ecx, -6`İlk dava 6'a çıkar.`cmp ecx, 4`İmza almamış bir atlama ile beş dava kabul ediyor, 6-10.

- Evet .`lea`- ...`.text+0x33`Yer değiştirmeyi ekleme ile taşıyor `0x10`. PC32 bir yer değiştirme ölçümleri 4 byet yer değiştirme sonundan, böylece tablo `.rodata+0x14`Beş küçük " indian " kelime okudu .`1, 2, 3, 4, 4`- Çıkışa gir .`ledger.c`60'dan 69'a 1'yi, 70'li yıllarda 2'yi, 80'li yıllarda 3'ü ve 90'dan 100'e 4'ü gönderir.

Sonuç olarak kayıtlar `ev_605106bff2d9998f…`- Evet .`confidence` `derived`, ve onun `evidence_links`Bu kayıtların adı, üzerinde bulunan iki gözlemlenen kayıtların adı.`ev_a467c242…`- Evet .

Şimdi Ghidra ile karşılaştırın. Aynı baytlar için pseudokod:

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

Ghidra yer değiştirmeyi uyguladı ve tabloya isim verdi .`DAT_001000b4`, yani `.rodata+0x14`yerleştirildikten sonra`.text`- ...`0x100000`Bu, 10 ve beş kesiden bölünmeyi geri aldı. Öntanımlı değer için her zaman 0 olduğunu ve asla 0 olmadığını söyleyen bir ifade yazdırdı.`native_value_flow`Bu işlemleri işaretler.`is_dead: true`Kayıt Ghidra'nın sadık bir gözlemidir.Okuduğunuz anlam ondan çıkarılır ve bir koşudan beklediğiniz değer çıkarılır.

- Evet .`percent_change`Kayıt diğer başarısızlığı gösteriyor.`undefined1 [16] percent_change(int param_1,int param_2,ulong param_3)`Kaynak diyor ki:`int percent_change(int before, int after)`- Evet .`idiv`Yazar `EDX:EAX`, ve sıfır yol gider `EDX`Bu yüzden dekompiler 16 baytlı bir geri dönüş ve üçüncü bir parametresi çıkarmış.`native_api.return_type.confidence`için`grade`- Evet .`"low"`- Kaydedilen imzanı sağlayıcı tarafından çıkarılan sonuç olarak değerlendirin ve bu şekilde kaydetin.

## Önceden Yapılan Tahminler

Bir tahmin, hiçbir gözlem tarafından belirtilmemiş bir davranış hakkındaki bir iddiadır. `claim_suite()`Bu modellerin 18'ini elde edilen modellerden ve kaynağından oluşturur. `record_prediction()`Her birini bir kayıt olarak saklar.`confidence` `inferred`ve `authority` `analyst-inference`, üzerine dayanan kayıtlara bağlı.

| Claim | Predicted value | Rests on |
|---|---|---|
| `percent_change(12400, 15500)` | 25, from 310000 / 12400 | division model `ev_076a9167…` |
| `percent_change(0, 5)` | 0, the zero guard | division model |
| `percent_change(100, 50)` | -50 | division model |
| `percent_change(-7, 3)` | -142, because `idiv` truncates toward zero | division model |
| `grade(55)` | 0, index -1 fails the unsigned compare | table model `ev_605106bf…` |
| `grade(60)`, `grade(69)` | 1, 1 | table model |
| `grade(70)`, `grade(85)` | 2, 3 | table model |
| `grade(95)`, `grade(100)`, `grade(105)` | 4, 4, 4 | table model |
| `grade(110)`, `grade(-5)` | 0, 0 | table model |
| `total(1, 2, 3)`, `total()` | 6, 0 | source record `ev_2f1e6d25…` |
| `grade_label(85)` | `"B"` | source record and table model |
| `grade(score)` for 90 to 100 | 4 for all eleven inputs | table model |

`predict()`Python semantik değil, C semantik kullanıyor.`c_div()`sıfıra doğru kesilir ve `wrap32()`- Her aracını 32 bit olarak katlar.`//`Negatif sonsuzluk yönünde yuvarlaklar, yani `(3 - -7) * 100 // -7`Bu da -143 ve C programı -142 verir.

Her tahmin bir bilinmeyen kalıntı açar.`observed`Yetkili kanıtlar `controlled-replay`Ve bir sonda önerir:`execute_function`Birinci sınıf iddiası için sorunun cevabı "Yazımlı işlev çalışırken 95) == 4 tutar mı?"

## Onları Kaçmakla Karşı Kontrol Et

`code/fixtures/harness.c`içerir .`ledger.c`Ve her çağrıda bir sonuç yazdırır.`observe_runs()`İlk bölümde bir araya getirir.`clang`- Evet .`cc`veya`gcc`Her girişi bir kayıt haline getirir.

```json
{
  "operation": "execute_function",
  "parameters": { "function": "grade", "args": [95] },
  "normalized_result": { "result": 4, "stdout": "4\n", "exit_code": 0 },
  "confidence": "observed",
  "authority": "controlled-replay",
  "environment": { "id": "host-process", "platform": "darwin", "architecture": "arm64", "isolation": "process" },
  "limitations": [
    "The run executed a host build of ledger.c, not the x86-64 object. The claim about the object rests on the shared source and on the compiler.",
    "One run observes one input. It proves nothing about other inputs."
  ]
}
```

Bir çalıştırma kaydının konusu, bu Mac'deki bir Mach-O arm64 dosyası olan harness binary'dir.`course-harness`Bu da bir kompiliör versiyonu.`Apple clang version 17.0.0 (clang-1700.6.3.2)`- Ne ?`evidence_links`Kaynak kaydının adını belirleyin `ev_2f1e6d251543d017…`, çünkü koşuk ve nesne paylaşıyor .`ledger.c`- Başka bir şey yok.

İlk sınırlama iki kez okuyun. x86-64 nesnesi bu makine üzerinde hiç çalışmadı. çalışkan olan başka bir mimari için aynı kaynağın ikinci bir yapılandırmasıydı. Bu hala bir gözlemdir ve emülatör olmadan mevcut en güçlü bir gözlemdir, bu yüzden iddia bu cümle ile geçer.

17 tek girişli çalışmalar tüm tahminlerle uyumludur.`code/fixtures/run-evidence.json`Bu 17 kayıt ve kaynak kayıtları ile birlikte ihraç edilen `--record`2026-10-13'te bir kompiliör bulunmadığında,`build_ledger()`Bu, çalışmak yerine bu paketleri ithal ediyor ve rapor da bunu kendi`runs`- Alan.

## Gelişme Kuralları

Bir talep sadece gözlemlenen koşular yoluyla çıkarılanlardan desteklenmişe geçiyor. `check_claim()`bakıyor .`execute_function`Aynı fonksiyonu ve argümanları olan kayıtlar, her sonucu tahminle karşılaştırır ve kapsamlı girişleri sayır:

| Status | Condition | rea's completion ledger |
|---|---|---|
| `pass` | every input has an agreeing run and none disagrees | `pass` |
| `fail` | any run disagrees | `fail` |
| `unknown` | some inputs have runs, others have none | `unknown` |
| `unsupported` | no input has a run | `unsupported` |

`promote_claim()`Bu, zor bir formdur.`ClaimError`Eğer bir kimlik varsa`inferred`veya `derived`. Bir id başka bir fonksiyonun veya diğer argümanların bir dizisinin isimlendirilmesi sırasında yükseltilmektedir.`grade(55)`- Bu da onu teşvik edemez.`ev_7be90c0c…`Şekilde ve bakın talebin düşüşü `unsupported`İki kayıtta.`grade`Kalın.

Aralık iddiası kısmi durumunu gösterir.On bir girişinden sadece ikisi, 95 ve 100, çalıştırma şebekesinde görünür. `check_claim()`Devamı`unknown`- Evet .`covered`11'den 2 ve `promote_claim()`"11 girişin 2'si gözlemlenmiş çalışmalar" ile reddediyor.

`completion_ledger()`Reya'nın aynası.`EvidenceCompletionLedger`Kimliği:`ecl_`Ayrıca kayıtlarının hashini de ekler.`complete`Sadece o zaman geçerli olur.`pass`eşit `total`- Demo izleri .`ecl_da64933ea13befed…`- Evet .`complete: false`, bu tek alan iddiası yüzünden.

## Bilinmeyenler Hash Zinciriyle Kayıtlar

rea, kalıntılı bir kayıt olarak bilinmeyen bir kalıntı kaydeder. `code/main.py`Aynı alanları ve değişkenleri korur.

Kimlik adı `unk_`SHA-256'ı ekleyin.`{domain, question, scope_digest}`İki analist aynı dosya hakkında aynı soru sorduğunda aynı kimliği elde ettiler.`scope_digest`nesnenin SHA-256'sidir.

Her değişiklik yeni bir revizyondur.`previous_revision_digest` `null`. Her sonraki revizyona göre `revision_digest`Önceki kitaptan, kendi dışında her alanı kaplar.`verify_unknown_chain()`Bu listeyi yürütür ve her bir dizeyi yeniden hesaplar. Her bağlantının önceki düzeltmeye işaret ettiğini kontrol eder. Her bir düzeltme isimlerinin mutasyon kanıtının büyük defterde olup olmadığını kontrol eder.

Her mutasyon kendiliğinden bir kanıt kaydıdır, tıpkı sağlayıcıyla olduğu gibi.`rea-unknown-registry`- Bizim taşıyıcılarımız .`confidence` `derived`- Evet .`authority` `analyst-inference`"Bir kayıt mutasyonu analizin kararını kaydeder.

Bu nedenle demo'nun 81 kayıtları 36 türlü mutasyon kayıtlarını içerir: 18 açılış ve 18 güncelleme.

Her bir inceleme için üç değişken geçerlidir:

- Sadece bir .`resolved`Bilinmeyen bir `resolution`, ve sadece 1. revizyona bir öncü yoktur.
- A.`contradicted`Bilinmeyen isimler en az bir çelişkili kimlik ve her iki listede de kimlik görünmüyor.
- A.`verified`Karar verme, gerekli güven ve yetki ile en az bir kanıt kimliğini belirler.

Üçüncü kural, büyük kaydın en sık reddettiği yerlerdir. rea'nın iş akışı notlarında "Tek değerlendirilebilir gözlemlenen kanıtlar bir çözümü doğrulayabilir".`resolve_unknown()`Bu nedenle tablo modelini reddediyor, gözlemlenen bir kayıtı yetkili bir şekilde reddediyor `shipped-artifact`, ve koşuşturma kaydını kabul eder .`ev_f4ffbe8f922ec7fe…`. Dönüşüm için kararlı bir şekilde düzenlenmiş .`grade(95)`2. revizyona ve`previous_revision_digest`- Evet .`ffca840b55a8a188…`, 1. inceleme dergisinin başlığı.

`update_unknown()`Alıyor .`expected_revision`ve yükseltir.`revision-conflict`Reya'nın yaptığı gibi, zamanında.`update_unknown`Bu yüzden, gerçek bir tepki, Rea'nın notları verdiği tek tepkidir: mevcut düzeltmeyi tekrar okuyun ve tekrar karar verin.

Bir tanınmamış , demo sonrası açık kalır:`unk_f2eb0d7f84c80a19…`, "Kompil fonksiyonun çalıştırıldığı zaman 90 ila 100 arasındaki her puan için 4 puanı var mı?"`investigating`, destekleme kimlikleri iki koşuyu içerir ve sonda hala dokuz giriş adı koşusu olmayan.

## Cevapların Kaydedilmesi Analiz Verisi Değildir

Ghidra hedef anketinin girişlerin özel bir kopyası, `-readOnly -deleteProject`Ve son anda silinmiş.`AnalysisSnapshotCache`Bir ikili kimlik için 10.000'e kadar giriş tutar.`target`- Evet .`binding`- Evet .`entries`- Evet .`workflow_entries`ve bir `evidence_bundle`- Evet .

Önbelleğin anahtarı `query_`SHA-256'ı ekleyin.`{target, binding, operation, parameters}`- Evet .`target`- Evet .`{sha256, kind, format, architecture}`, ve bir `raw-binary`Hedef de `entry_point`- Evet .`binding`Bu nedenle, bu değerler, bir diğer değerlendirmenin değerlendirmesi için kullanılabilir.`jump_table_evidence`-`typed-case-default-blocks-v1`A'ya kadar`v2`, ve sindirim değişir, böylece her anahtar değişir.

`code/fixtures/rea-snapshot.json`rea iki çalışmada yazılmış dosya, 142.690 byte. rea sadece sahiplerin izinleri ile yazıldı ve yapılmış kopya herkes tarafından okunur.`AnswerCache.import_snapshot()`Her birini yeniden hesaplar.`query_id`Ve dosya farklı olduğunda dosyayı reddeder.`target`veya `binding`rea'nın kelimesi ile aktif olanından farklıdır `profile_mismatch`- Bir fotoğrafı reddediyor .`format_version`- Hayır .`course-answer-cache-1`- Evet .

Bu makinenin üç ölçümü.`grade`Yeni bir Ghidra içeriği ile 8.6 saniye sürdü.`percent_change`Aynı anketle karşı sorgu 8.5 saniye sürdü, çünkü farklı bir sorgu bir önbelleğe kayıp.`grade`sorgu 2.1 saniye sürdü ve aynı kayıt ile aynı kayıtları geri verdi `evidence_id`.Reah'da hafıza tekrarlaması "Yerel bir REA analiz anketinden yüklenmiş; bu çağrı sağlayıcıyı tekrar çalıştırmadı". sınırını ekler.`lookup()`Aynı tür bir cümle ekler, böylece bir okuyucu yeni bir cevaptan bir tekrarı ayırt edebilir.

Bir mutasyon önbelleği sona erdirir. rea 6.5.0'da, bir isim değiştirme veya bir yorum, rea'nın provayderye çağrı göndermeden önce anlık önbelleği temizler. Başarısız bir cevap yazının geri döndüğünü kanıtlayamaz, bu nedenle başarısız bir yazma da tekrarlamayı durdurur. Veritabanı değiştiren bir metadata ithalatı aynı şeyi yapar.

## Bir Ajanın Buna Neden İhtiyacı Var?

MCP ' den REA ' yı yönlendiren bir ajan her çağrıda tüm kayıtları görür ve sitayı kullanabilir .`evidence_id`Bu nedenle, bu çalışma, bir araştırmacı tarafından yapılan bir araştırma olarak, bir araştırmacı tarafından yapılan bir araştırma olarak, bir araştırmacı tarafından yapılan bir araştırma olarak, bir araştırmacı tarafından yapılan bir araştırma olarak, bir araştırmacı tarafından yapılan bir çalışma olarak, bir araştırmacı tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılan bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma tarafından yapılmış bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir çalışma olarak, bir olarak, bir olarak, bir çalışma olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak, olarak,[arXiv 2606.06838](https://arxiv.org/abs/2606.06838)Yüzlerce işlevi olan ikili işlemlerde, ajanın kalıntıları üretmeden önce sadece yüzde 10 ila 15'i gerçek analiz aldı.

Bu kayıtların her birine kayıt ile cevap verir ve ajan sadece bu kayıtta ne olduğunu bildirir.`unsupported`Bazı koşularla bir iddia .`unknown`- Bir sunucu metni`observed`- Ajanın yetenek dosyasını ver.`outputs/`Ve bu da Claude, Cursor, Codex, OpenClaw, Hermes veya SKILL.md'i okuyan herhangi bir ajan için geçerli.

## Yapın

Standart kütüphane demo'sunu çalıştır:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
```

Demo nesneyi okuyor, iki rea kayıtlarını ithal ediyor, rea anlık görüntüsünü doğruluyor ve iki modeli çıkarıyor.

```json
{
  "records": 81,
  "by_confidence": { "observed": 25, "derived": 38, "inferred": 18 },
  "rea_snapshot": { "entries": 2, "replay_hit": true, "stale_profile_refused": true },
  "grade_table": [1, 2, 3, 4, 4],
  "runs": "live: Apple clang version 17.0.0 (clang-1700.6.3.2)",
  "claims": [ { "claim_id": "grade(95)", "status": "pass", "covered": "1/1" }, { "claim_id": "grade(90..100)", "status": "unknown", "covered": "2/11" } ],
  "completion_ledger_id": "ecl_da64933ea13befed9483f8b00447bb3f4ceb74324c01e2515eff03f3af3ca750",
  "complete": false,
  "unknowns": { "resolved": 17, "investigating": 1 }
}
```

C kompozisyoncu olmadan,`runs`okur `imported 17 recorded run records from run-evidence.json`Gerisi de aynı.

Oku `code/main.py`Bu sırada:

1. `canonical_json()`ve `compute_evidence_id()`Hash tarifini ve semantik projeksiyonu tutun.
2. `create_evidence()`ve `validate_evidence()`Bir kayıt oluşturup kontrol et.
3. `EvidenceLedger.record()`ve `import_bundle()`Kayıtları saklamak ve çatışmaları reddetmek.
4. `open_unknown()`- Evet .`update_unknown()`ve`resolve_unknown()`Değerlendirme zincirini tut.
5. `observe_object()`ELF'yi okuyor ve `derive_grade_model()`Masayı okuyor.
6. `claim_suite()`- Evet .`predict()`ve`record_prediction()`- Yukarıdaki katı yaz.
7. `observe_runs()`Her harnasın çalışması izlenilen bir kayıt haline gelir.
8. `check_claim()`- Evet .`promote_claim()`ve`completion_ledger()`Tanıtım kurallarını uygulayacak.
9. `AnswerCache`Anahtarlar Rea'nın anlık fotoğraflarını cevaplarken, eski fotoğrafları reddeder.

## Kullan

Her hedefe ve araştırmaya göre bir defter tutun. Her konuyu hedefinin SHA-256'sine, sorunun kapsamını da her bilinmeyen konuya koyun.`provider`Bu durumda, bu kayıtlar, bir başka dosya hakkında kanıt haline gelir.

Bu kısıtlamaları bildiğiniz anda yazın. Yer değiştirmeyi uygulayan okuyucu bunu söylüyor. Host yapılandırmasının çalışması bunu söylüyor. Bir bölücü indiren model bunu söylüyor.

Her sunucu metnini veri olarak ele alın. Hedefden gelen dizileri ve pseudokodlar hedeflerin kontrol ettiği metindir.`_meta.provenance.untrusted_content: true`Server talimatları, modelin hedef içeriği veriler olarak ele almasını ve içinde herhangi bir istek, yükleme, indirme veya bir şey gönderme girişimini bildirmesini söyler.

## İnteraktif Laboratuvar

### Laboratuvar A: bir rea id yeniden hesaplamak

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code
python3 -q
```

Çık:

```python
from main import *
record = load_evidence_file(FIXTURES / "rea-evidence-grade.json")
record["evidence_id"] == compute_evidence_id(record)
record["subject"]["local_path"] = "/home/you/re/ledger-x86_64-O1.o"
record["evidence_id"] == compute_evidence_id(record)
record["limitations"].pop()
record["evidence_id"] == compute_evidence_id(record)
```

İlk iki karşılaştırma doğru. Yolu hash'te değil. Üçüncü yanlış, çünkü bir sınırlama içeriği vardır.

### B laboratuvarı: terfi reddet

```python
ledger, report = build_ledger(live_runs=False)
claim = [c for c in claim_suite(ledger.find(operation="derive_switch_model")[0], ledger.find(operation="derive_arithmetic_model")[0], ledger.find(operation="read_source")[0]) if c.claim_id == "grade(55)"][0]
promote_claim(ledger, claim, [ledger.find(operation="derive_switch_model")[0]["evidence_id"]])
```

Çağrı yükselmektedir .`ClaimError`Şimdi çalıştırma kimliğini geçin:

```python
run = run_records_for(ledger, "grade", [55])[0]
promote_claim(ledger, claim, [run["evidence_id"]])["status"]
```

Durum `pass`Ve geri döndükleri .`limitations`Ev sahibi yapma cezasını taşı.

### C laboratuvarı: eski bir anlık fotoğrafı reddet

```python
import json
snapshot = json.loads(REA_SNAPSHOT_PATH.read_text())
target, binding = rea_snapshot_binding(snapshot)
AnswerCache(target, binding).import_snapshot(snapshot)
stale = dict(binding["analysis_profile"]["parameters"], jump_table_evidence="typed-case-default-blocks-v2")
AnswerCache(target, {"provider": binding["provider"], "analysis_profile": make_profile(binding["provider"], stale)}).import_snapshot(snapshot)
```

İlk ithalat raporları 2. İkinci yükselişler `CacheError`- Evet .`profile_mismatch`Bir versiyon dizisi değişti ve tüm anlık fotoğraf reddedildi.

### Laboratuvar D: zinciri kırın

```python
unknown_id = [u for u, r in ledger.unknowns.items() if r[-1]["status"] == "investigating"][0]
ledger.verify_unknown_chain(unknown_id)
ledger.unknowns[unknown_id][0]["severity"] = "critical"
ledger.verify_unknown_chain(unknown_id)
```

İlk çağrıda 2. İkinci çağrıda yükseltildi.`EvidenceIntegrityError`, çünkü 1 numaralı inceleme artık kendi incelemesine uygun değil ve 2 numaralı inceleme artık mevcut olmayan incelemesine uygun değil.

## Pratik Laboratuvar

Açık bilinmeyenleri kapat ve ikinci bir sunucu ekle.

Gereksinimler:

- Uzaklaştırma`run_grid()`Yani alanın 9 kayıp girişini çalıştırın, sonra bilinmeyen hareketleri doğrulayın `resolved`3. revizyondayken.
- Ekle`llvm-objdump -d`Kendiliğinden ikinci bir tedarikçi olarak `provider``grade`- Evet .`observed`- Evet .
- Bir yazın .`derived`Ghidra'nın ve llvm-objdump'un iki listesi belirtilen kayıt aynı 14 talimatı çözüp ikisini de bağlar.
- Bilinmeyen bir kişiyi aç `grade_label(105)`- Çok ciddi .`high`, Tablo indeksi 4 ' te okuyor `labels[4]`, ve koşarak çöz.
- Büyük defteri  ile ihraç edin`export_bundle()`Yeni bir defterde içeri aktarıp her zincirden bir verifikasyon olduğunu kanıtlayın.

Başarı , her cümlenin bir paketden bir kimliği ve birinin kimliğini belirten bir raporu ifade eder .`unknown`İddia yok.

## Sınıflandırılmış Laboratuvar

Bu dersin ayarları hakkında beş soru.`code/lab_answers.json`. Sayıları sayılar olarak ya da  gibi altıbuçluk ipler olarak yaz .`"0x40"`, ve listeler JSON listeleri olarak.

1. `t1`: verili kanıt id ki hesaplama_delil_id veriliyor rea-evidence-grade.json.
2. `t2`: not kayıtlarında sınırlama sayısı.
3. `t3`: not kayıtlarının ilişki_koşul durumu.
4. `t4`: iki iplik bir liste olarak, not kayıtlarının güven ve yetki.
5. `t5`: not kayıtı konuunun SHA-256'sı.

Cevaplarınızı kontrol edin:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/lab.py
npx tsx code/lab.ts
```

Kontrolcü , her beklenen değerini `code/main.py`- Bu, yazılı.`PASS`- Evet .`FAIL`veya `TODO`Her görev ve puan için, ve sadece beşinin geçtiği zaman 0'dan çıkıyor. `python3 code/lab.py my-answers.json`Başka bir dosyayı kontrol ediyor.`code/tests/test_lab.py`kontrol eden kişinin doğru cevapları kabul ettiğini ve yanlışını reddettiğini kanıtlar.

### Çıkıyor gör .

- Evet .[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off)makine dört tabaklı bir kanıt defteri tutar: gözlemlenmiş, çıkarılmış, çıkarılmış ve bilinmeyen. Bu bağlantı simge tablosu kapatılmış olarak çalışmayı açar, bu nedenle işlev dosyasının adı ve sonu bilinmeyen olarak ve başlangıç dosyaları çıkarılmış olarak.

## Ders Artifakti

Bu ders bize çok yararlı .`outputs/skill-evidence-ledger.md`Bu, bir ajanın her bulguyu güven, yetki, sınırlamalar ve bağlantılarla bir kayıt olarak nasıl yazacağını söyler.`pass`- Evet .`fail`- Evet .`unknown`veya`unsupported`- Evet .

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

28 test şöyle kanıtlıyor:

- her ikisi de gerçek .`evidence_id`değerleri, profil dijesini ve her iki anlık fotoğrafı `query_id`değerler içeriğiyle yeniden hesaplanır
- Değişen bir yol kimliği korur ve değişen bir sınırlama onu değiştirir
- Bozuk bir kayıt, eşleşmeyen bir profil sağlayıcısı, bir yüzen ve bilinmeyen bir enum değeri reddedildi
- Bir çift kayıt raporları `duplicate`, çelişkili bir rekor yükseltir ve bir paket ithalat atomik
- Kaydedilen süren paketler, 18 kayıtlı ve asılı bağlantı olmayan ithalat
- Bilinmeyen bir kişi 1 numaralı inceleme sırasında açılır , bir geri dönüş reddeder .`expected_revision`, ve sadece gözlemlenmiş ile çözülür .`controlled-replay`kanıt
- Düzenlenmiş bir revizyondan sonra zincir kırılır.
- Önemli bir şekilde, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir sürecececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececece
- kısmi kapsam `unknown`Ve anlaşmazlıktan kaçmak .`fail`
- Önbellek tam anahtarı vurur ve diğer parametreleri kaçırır
- önbelleği çarpık bir profil sürümünü, yanlış bir hedefi, yanlış bir biçim sürümünü ve bozuk bir tuşunu reddediyor
- ELF okuyucuları buna katılıyor `llvm-objdump`Değişiklikler, boyutlar, baytlar ve yer değiştirmeler hakkında, ve tablo okur `1, 2, 3, 4, 4`
- tahminler C bölümü kullanıyor ve kaydedilen koşular 17 tek giriş iddiasıyla uyumludur.
- Bir kompilatör mevcutken, canlı yayınlar da aynı fikirde

## Üretim Başarısızlık Modları

| Failure | What the weak report says | What the ledger requires |
|---|---|---|
| Pseudocode read as behaviour | "grade returns 0 for failing scores" | an `execute_function` record for that input, or `unsupported` |
| Decompiler signature trusted | "percent_change returns 16 bytes" | the signature marked as the provider's inference with its `low` confidence |
| Empty list read as absence | "the function has no callers" | an `unknown` status, or a coverage field when the tool provides one |
| Path hashed into the id | "the record changed" after a copy | the semantic projection without `name` and `local_path` |
| Limitation dropped from a copy | a record that looks stronger than the source | id mismatch and rejection on import |
| Partial grid rounded up | "all scores from 90 pass" | `unknown` with `covered` 2 of 11 |
| Host run presented as the object's run | "the x86-64 object returned 25" | the host-build limitation carried on the claim |
| Unknown closed by a sentence | "resolved, see above" | a `verified` resolution with observed ids of the required authority |
| Stale revision overwritten | two analysts' edits collide | `revision-conflict` and a reread |
| Old snapshot replayed after a release | answers from a changed contract | `profile_mismatch` on import |
| Cache kept after a rename | a replay that hides a metadata write | invalidation before dispatch and a failed export |

## İşlem Kuralı

Okuduğunuzu, hesapladığınızı ve beklediğiniz şeyi üç kelimeyle üç tür kayıt olarak kaydetin. Bilinmeyen bir şeyi bir id ile kapatın, asla bir cümleyle. Cevabı sadece kaydedilen anahtar altında tekrarlayın ve bir versiyon dizisi farklı olduğunda reddedin.

## Daha Fazla Okumak

- [rea 6.5.0 source, `src/domain/evidence.ts` and `src/domain/residualUnknown.ts`](https://github.com/morluto/rea)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [Ghidra 12.1.4 release](https://github.com/NationalSecurityAgency/ghidra/releases)
- [Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)
- [When Binaries Talk Back: Representation-Confusion Attacks on LLM-Assisted Reverse Engineering, arXiv 2607.12507](https://arxiv.org/abs/2607.12507)
- [Agentic decompilation study, arXiv 2606.06838](https://arxiv.org/abs/2606.06838)
- [When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370](https://arxiv.org/abs/2609.05370)
- rea 6.5.0 kaynağı tag `3b79af2`Bu ders şöyle anlatıyor:`src/domain/evidence.ts`- Evet .`.agents/skills/reverse-engineer-anything/SKILL.md`- Evet .`docs/cli.md`- Evet .`src/domain/reconstructionVerification.ts`- Evet .`src/application/ReconstructionObligationCandidates.ts`- Evet .`docs/tool-design.md`- Evet .`src/domain/evidenceCompletionLedger.ts`- Evet .`src/domain/residualUnknown.ts`- Evet .`src/application/investigation/UnknownEvidence.ts`- Evet .`.agents/skills/reverse-engineer-anything/references/evidence-workflows.md`- Evet .`src/application/binary/AnalysisSnapshotCache.ts`- Evet .`src/domain/analysisSnapshot.ts`- Evet .`src/application/binary/BinarySession.ts`- Evet .`src/application/binary/BinarySessionRecords.ts`- Evet .`docs/mcp-contracts.md`- Evet .
