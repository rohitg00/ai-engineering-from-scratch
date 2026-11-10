# MCP Registry Supply Chain: Giriş, Drift ve Rollback

> Bir yayıncı tarafından açıklanan bir kayıt kayıt, aldığınız, gözlemlediğiniz, onayladığınız ve güvenli bir şekilde geri getirebileceğiniz şeyleri kanıtlar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 17 (gateways and registries), Phase 13 · 18 (production authentication)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- Ayrı bir kayıt yayınlaması, paketlerin kökenliliği, çalıştırma süresi keşfi ve yerel onay.
- MCP sunucu isim alanını kendi kayıtları içinde adı güvenmeden doğrulayın.
- Değişmez yayın, yürütme kaynağı, köken ve canlı açıklayıcı kanıtları.
- Kayıt durum değişikliği ve giriş sonrası çalıştırma süresi süresi tespit edilmelidir.
- Tarihi yeniden yazmadan önce kabul edilen bir sürümüne yönlendirmeyi geri çevirin.
- Her kararın açıklandığı bir kabul defteri tut.

## Sorun

Bulursun .`com.example/inventory`Bu kayıt doğru görünüyor, paket var, sunucu cevap veriyor.`server/discover`- Evet .

Bu bir gerçek değil, farklı yetkililerin bir dizi gerçek zinciri.

1. Bir isim alanı için doğrulanmış bir yayıncı bir kayıt gönderdi.
2. Paket kayıtları, belirli bir kimlik ve sindirim ile bir eser hizmet etti.
3. Bir çalışan uç noktası protokol sürümünü, yeteneklerini, araçlarını ve teşhis sunucu bilgilerini bildirdi.
4. Teşkilatınız bu kombinasyonun izin verildiğini karar verdi.

Bu gerçekleri it'e düşürmek, kayıtta bulunur, bu yüzden güvenin  bir tedarik zinciri kör noktasını oluşturur. Geçerli bir yayın hala geçersiz hale gelebilir. Bir paket etiketinin bir süslemesini yapmazsanız beklenmedik bir eserle işaret edebileceğini gösterir. Bir sunucu incelemeden sonra yıkıcı bir araç ekleyebilir. Bir geri dönüş sessizce kabul edilmemiş bir versiyonu seçebilir.

Bu bir giriş kontrolörü, her sınırda kanıtlar var.

## Kayıt, Sizin onay sisteminiz değil bir indeks

Resmi MCP Kayıtları sunucu metadatalarını saklar.`server.json`Bir sunucu sürümünün isimlerini kaydetir ve bir veya daha fazla paket veya uzaktan son noktaları açıklar. Yayınlama kuralları isim alanı kimlik doğrulama, paket sahipliği kontrolleri, kısıtlı kayıt kuralları ve dar bir yayıncı metadata konumunu ekler.

Bu kontroller yayın sorularına cevap verir.

| Boundary | Question | Evidence owner |
|---|---|---|
| Namespace | Was the publisher allowed to use this name? | Registry authentication plus your verified namespace input |
| Record | What did the publisher declare for this version? | Immutable `server.json` digest |
| Execution source | Which package or remote endpoint will execute? | Declared source fields, verified ownership result, transport, and trusted digest |
| Runtime | What does the endpoint expose now? | `server/discover` and tool descriptors |
| Admission | Did your policy approve this exact set? | Local pin and ledger entry |
| Operations | Is it still safe, and what can replace it? | Drift checks, status sync, health, and rollback route |

Registry schema versiyonu ve MCP protokol versiyonu bağımsızdır.`2025-12-11`canlı sunucu MCP desteklerken sunucu skeması `2026-07-28`Birini diğerinden çıkarma.

```figure
mcp-registry-admission
```

## Tek kabul kararında yedi kontrol

### 1. Ad alanı doğrulama

Resmi Kayıt Adları doğrulanmış isim alanları kullanır. Doğrulanmış bir alan ters bir alan önlüğüne haritasını yapabilir. Örneğin, kontrol `example.com`- ... ... ... .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. .. ..`com.example/*`- Evet .

İpuç prefiks kontrolünü kabul etmeyin:

```python
server_name.startswith("com.example")
```

Bu da kabul eder .`com.exampleevil/tool`Adı bölün .`/`, boş olmayan bir kurşun gerektirir ve isim alanı bölümünü tam olarak karşılaştırır. Daha da önemlisi, doğrulanmış isim alanını doğrulama sonucuyla kabul edin. Güvensiz kayıtlardan güven çıkarmayın.

GitHub desteklenen isim alanları ve alan desteklenen isim alanları farklı kimlik doğrulama yollarını kullanır. Her iki yolu bir giriş girişine normalleştirin: doğru doğrulanmış isim alanı dizilisi.

### 2. Kaynaklılık

Paket kayıtları için, deklarasyon ve alınan eser açık alanlarda birleştirilmelidir:

- paket kayıt tipi
- paket kimliği
- paket versiyonu
- doğrulanmış mülkiyet sonucu
- indirilen eserlerin içi

Ayrıca açıklanan paket nakliyesi doğrulanır. Sadece uzak bir uç noktası olan bir kayıt geçerlidir ve paket eksikliği nedeniyle reddedilmemelidir. Uzak bir kaynak için, açıklanan URL'yi ve nakliye türünü bağımsız olarak doğrulanmış uç noktası sahipliği ve güvenilir bağlantı veya dağıtım kanıtı bir digest ile birleştirin.

Ders kodu hem kaynak türlerini destekler hem de seçilen kaynağı, kayıt kaynağı, sunucu adı, kayıt sürümü, kayıt penceresi ve kanıt penceresi ile birlikte hash eder.

Hiçbir zaman sadece doğrulama denediğiniz eser tarafından sağlanan bir belgeyi kabul etmeyin.

### 3. Sadece versiyon değil kararı da sabitle.

Registry sürümleri benzersiz yayın tanımlayıcılarıdır. Yayınlanan metadata değişmez. Değiştirilmiş bir kayıt yeni bir sürüm gerektirir. Semantik sürümleme önerilir, ancak Registry bunu gerektirmez ve sürüm aralıkları kabul etmez.

Bu demek oluyor ki ...`^1.4`lastest. Bir yararlı pin içerir:

```json
{
  "server": "com.example/inventory",
  "version": "1.0.0",
  "recordDigest": "...",
  "source": {"kind": "package", "registryType": "pypi"},
  "sourceDigest": "...",
  "toolsetDigest": "...",
  "provenanceDigest": "...",
  "registryStatus": "active"
}
```

Birkaç katmanı yerleştirmek hangi sınır değişmiş olduğunu belirlemenizi sağlar. Aynı Registry sürümünde kayıt penceresi değişimi bir Registry bütünlüğü başarısızlığıdır. Aynı paket koordinatı veya uzaktan dağıtım altında kaynak penceresi değişimi bir yürütme kaynak bütünlüğü başarısızlığıdır. Bir araç kümesi penceresi değişimi çalıştırma süresi sürüştür.

### 4. Canlı sürükleme tespiti

Giriş, trafiği alacak sunucuyu gözlemlemesi gerekir.`server/discover`, listelenme veya diğer şekilde açık araç tanımlayıcılarını güvenilir yolunuz üzerinden alın ve doğrulayın:

- `2026-07-28`İçeride .`supportedVersions`
- Yerel olarak gerekli tüm yetenekler mevcuttur.
- Her araç tanımlayıcıda gerekli kimlik ve şema yüzeyi bulunur
- Normal tanımlayıcı belgesinin daha sonraki kontrollerde kabul edilen pin ile eşleşmesi

Seçim sonucu `_meta["io.modelcontextprotocol/serverInfo"]`değer, kendi kendini bildiren görüntüleme, kayıt ve hatalama bağlamıdır. Bunu teşhis kanıtı olarak kaydet, ancak ad alanını, paket sahipliğini, son nokta sahipliğini, kabul veya başka bir güvenlik kararı belirlemek için asla kullanmayın.`serverInfo`Dışarıda.`_meta`Sözleşme alanı değil ve teşhis kanıtlarına terfi edilmemelidir.

Normalleştirme sadece sırası anlamsız alanlar. Örnek, araç listesini sabit isimle hash yapmadan önce sıralar, böylece zararsız bir listesi sırası değişimi sürüklenmeye neden olmaz. Açıklayıcı alanları atmaz. Yeni bir araç, değiştirilmiş şema, değiştirilmiş açıklama veya yeni notlar pin değiştirir.

Örnek, yanlış biçimlendirilmiş tanımlayıcıları ve herhangi bir tanımlayıcı sindirim değişikliğini sürükleyici olarak ele alır, pin'i karantinaya alır, aktif rotasını çıkarır ve bu versiyonu bir geri dönüş hedefi olarak engeller. Bir üretim politikası, editörel değişikliğe ancak yeni bir inceleme yoluyla izin verebilir, çünkü tanımlar model araç seçimini etkiler.

### 5. Kayıt durumu canlı durumdur

Kayıt API bir cevap seviyesini bağlar `_meta`Her sunucu kaydı yanında nesne.`_meta["io.modelcontextprotocol.registry/official"]`Cevabı ver .`_meta`Kabul edilmeye itiraz eder ve okuyor.`_meta["io.modelcontextprotocol.registry/official"].status`- Bir direkt .`_meta.status`değer resmi tel şekli değildir. Cevap metadatalarını yayın kaydının kendi metadatalarıyla karıştırmayın `_meta`Durum:

- `active`: geri gönderilmiş ve yerel kabul için uygun
- `deprecated`: hala bir uyarı ile keşfedilebilir, ama artık güvenli bir otomatik seçim değil
- `deleted`: tarihsel kayıtları silinmiş veya artış görüntüler yoluyla mevcutken varsayılan olarak gizlenir

Giriş sonrası senkronize durumunu. Eğer aktif bir sürüm geçersiz hale gelirse veya silinilirse, pinini karantinaya alın ve yeni çalışmayı ona yönlendirmeyi durdurun. Kanıtları koruyun. Varsayılan listeye silinmek, denetim izinizi silmek için izin değildir.

Yayıncı tarafından sağlanan özel metadata sadece `_meta.io.modelcontextprotocol.registry/publisher-provided`Registre yönetilen cevap metadataları ayrıdır. Bir yayıncının kendi resmi statüsünü belirlemesine izin vermeyin.

### 6. Rollback, yolun yeniden kurulması anlamına gelir.

Değişmez bir yayın rollback sırasında düzenlenmez. Rollback, daha önce kabul edilen, şu anda uygun bir pin seçer ve aktif rotayı değiştirir.

Güvenli bir hedef:

1. Tamamlanmış bir kayıt var.
2. Hala polisiniz altında aktif bir kayıt statüsüne sahipsiniz.
3. Uçuş zamanı veya güvenlik kanıtı nedeniyle karantinaya alınmamalı.
4. Hala sabit paket ve canlı açıklama setiye karar ver.
5. Geçmiş sağlık kontrollerini geç.

Örnek ilk üç şartı ele alıyor. Gerçek bir uzlaştırıcı paketleri yeniden almalı ve etkinleştirmeden önce canlı son noktayı tekrar kontrol etmeli.

### 7. Giriş defterini ekle

Giriş verisi neyin aktif olduğunu ve nedenini açıklıyor.

Her örnek giriş bir dizi, zaman, olay, sunucu, sürüm, sonuç, nedenler, kanıt, önceki giriş hash ve kendi hash içerir. Eski bir sonuç değiştirmek bu giriş ve her sonraki bağlantının doğrulanmasını keser.

Bu, sihirli bir şekilde değiştirilmez, tersine açık. İmza edilen yayın metadataları veya bir kez yazma depolama gibi ayrı bir güven alanında demirleme döngü defteri başlatır. Ekleyebilecekleri kısıtlayın. Yetki belirtilerini, paket kimliklerini, araç argümanlarını ve özel son nokta verilerini kanıtlardan uzak tutun.

## Yapın

Çalıştırılabilir kontrol cihazı çalıştırıldı .`code/main.py`Sadece Python standart kütüphanesi kullanıyor.

Son gösteriden başlayalım:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
```

Gösterim beş işlem gerçekleştirir:

1. Kabul et .`1.0.0`Eşleşen isim alanı, paket kökeni, protokol, yetenekler ve araçlarla.
2. Kabul et .`1.1.0`Ve aktif hale getirin.
3. Çalışma zamanı beklenmedik bir silme aracı gözlemleyin.
4. Kayıt statüsünü izle`1.1.0`Olmak`deprecated`- Evet .
5. Yollamayı hala kabul edilenlere geri döndür .`1.0.0`- Çekil.

Beklenen şekil:

```json
{
  "admitted": [true, true],
  "driftAllowed": false,
  "rollbackAllowed": true,
  "activeVersion": "1.0.0",
  "ledgerValid": true
}
```

Uygulamaları bu sırada okuyun:

1. `namespace_for_domain()`ve `namespace_matches()`Tam bir isim verme yetkisini belirle.
2. `digest()`ve `normalized_tools()`Determinizm kanıtları üretmek.
3. `RegistryAdmissionController.admit()`Yayınlama, kaynak, çalışma süresi ve politika ile birlikte.
4. `check_live()`Yeni bir gözlemle çubukla karşılaştırır.
5. `observe_registry_status()`Kayıt devreyi değiştirilen karantin versiyonları.
6. `rollback()`Sadece daha önce kabul edilen uygun hedefleri etkinleştirir.
7. `AdmissionLedger.verify()`Kaydedilen tarihte değişiklikler tespit eder.

## Kullan

Kontrolörü keşif ve yönlendirme arasında koy:

```text
Registry sync -> artifact verifier -> live discovery -> admission controller -> route table
                                               |                 |
                                               v                 v
                                          evidence store    admission ledger
```

Bu işlerde ayrı kimlikler kullanın. Bir kayıt senkronize işçisi metadata okuma erişimi gerekir. Bir artefakt doğrulayıcısı paket getirme erişimi gerekir. Bir rota uyumlu bir onaylanmış bir pin etkinleştirmek için izin gerekir. Bunların hiçbiri tüm tanıtım bilgileri gerekir.

Çıkış durumunu açık bir şekilde yapın. Tamamlanmış  kanıt geçerli olan politika anlamına gelir. Active şu anda seçilen rota anlamına gelir. Kuarantinin altında  yeni çalışmalar alamayacağı anlamına gelir. Superseded başka kabul edilmiş bir sürüm aktif olduğu anlamına gelir.

Bir sunucuyu açmadan önce giriş çalıştır `tools/list`Aksi takdirde bir müşteri yayınlama ve politika değerlendirmesi arasındaki boşluk sırasında bir araç bulabilir.

## İnteraktif Laboratuvar

Bir sınırın bir seferde düştüğünü göreceksin.

### Laboratuvar A: Ad alanı çarpışması

Kod diziniyle Python Shell aç:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code
python3 -q
```

O zaman koş:

```python
from main import namespace_matches
namespace_matches("com.example/inventory", "com.example")
namespace_matches("com.exampleevil/inventory", "com.example")
```

İlk sonuç:`True`İkinci olan:`False`- Tam karşılaştırmayı  ile değiştir .`startswith`Yerel olarak, ikinci ismi neden sınırı geçtiğini gözlemleyin.

### Laboratuvar B: Deskriptor sürüşü

```python
from main import *
times = iter(f"2026-08-21T12:00:{n:02d}+00:00" for n in range(10))
c = RegistryAdmissionController(clock=lambda: next(times))
meta = {OFFICIAL_META_KEY: {"status": "active"}}
c.admit(sample_record("1.0.0"), meta, "com.example", evidence_for("1.0.0"), sample_live("1.0.0"))
c.check_live("com.example/inventory", "1.0.0", sample_live("1.0.0", True))
```

Paket ve Kayıt kaydı değişmedi. Çalışma zamanı alet yüzeyi değişmedi, bu nedenle denetçi pin'i karantinaya aldı ve devre dışı bıraktı. Bu nedenle tedarik zinciri kontrolü kurulandan sonra devam etmelidir.

### Laboratuvar C: Durum ve geri dönüş

Kabul et .`1.1.0`, onu geçersiz olarak işaretle ve her iki geri dönüş hedefini de dene:

```python
c.admit(sample_record("1.1.0"), meta, "com.example", evidence_for("1.1.0"), sample_live("1.1.0"))
c.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
c.rollback("com.example/inventory", "1.1.0", "unsafe retry")
c.rollback("com.example/inventory", "1.0.0", "restore known release")
c.ledger.verify()
```

Karantinalı hedef reddedildi, daha önceki aktif pin kabul edildi, büyüklük geçerli kalıyor.

## Pratik Laboratuvar

Kontrolörü iki kişilik bir onay kapısı ile uzatın.

Gereksinimler:

- Onayları imzalanmış kanıt referansları olarak saklayın, pin'deki değişen isimler değil.
-  ile birlikte bir araç içeren bir araç seti için iki farklı değerlendirici kimliğini gerektirir.`destructiveHint: true`- Evet .
- Tekrar inceleme yapan kimliklerini reddet.
- Onaylama tamamlanmamışken, ilk kabul denemesini defterde tutun.
- Nul, bir, ikili ve iki farklı onay için testler ekleyin.
- İmzaları, kimlik bilgileri veya tam özel araç argümanlarını kaydetmeyin.

Başarı, her iki kimlik de kayıt, paket ve araç kümesi doğruyu onaylamadan yıkıcı bir araç aktif hale gelemez.

## Nakliye edilen Sanatlı

Bu ders gemileri `outputs/skill-mcp-registry-admission.md`. Yeni bir Registry sürümünü incelemek veya sürüm araştırırken düz, tekrar kullanılabilir bir runbook olarak kullanın. Örnek sınıf isimlerine bağlı olmadan girişleri, reddetme kurallarını, kanıt paketini, durum uzlaştırmasını ve geri dönüş kanıtını tanımlar.

## Kontrol et

Gösterimi ve belirleyici süiti çalıştır:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Verifikasyon, şunu kanıtlamalıdır:

- Tam isim alanı sınırlar benzer önlükleri reddeder
- Sadece resmi isim aralığı olan kayıt statüsü bir versiyonu uygun hale getirebilir
- doğrulanmamış veya eşleşmeyen paket ve uzaktan kanıt reddedildi
- Yayıncı metadataları, kayıt merkezi yönetilen metadataları taklit edemez.
- Araç düzenlemesi , açıklayıcı değişikliklerini gizlemeden normalleştirilmiştir .
- yanlış şekil almış paket ve araç yapıları güvenli bir şekilde reddedilmektedir.
- `serverInfo`teşhisci olarak kalır ve kabul yetkisini asla sağlamaz.
- Descriptor drift karantineleri, devre dışı bırakır ve pin'e geri dönmeyi engeller
- durum değişikliği karantina aktif pinleri
- rollback, karantinalı veya bilinmeyen bir sürümü seçemez.
- Liderde düzenlenme tespit edilir

## Üretim Başarısızlık Modları

| Failure | Why it happens | Required response |
|---|---|---|
| Name looks valid but namespace was never authenticated | Policy trusted record text | Reject until a trusted namespace verifier supplies the exact prefix |
| Same package coordinate returns new bytes | Mutable upstream or compromised distribution | Stop activation, retain both digests, investigate the fetch boundary |
| “Latest” changes without review | Floating selection escaped the pin | Resolve only exact admitted versions and digests |
| New tool appears after approval | Runtime drift or a different deployment | Quarantine the route and capture a fresh descriptor observation |
| Deprecated version remains active | Status sync is missing or delayed | Reconcile status on a schedule and before activation |
| Deleted record disappears from default sync | Client requested only active records | Use incremental or deleted-aware reconciliation and preserve local history |
| Rollback target was never admitted | Route control and approval state are disconnected | Refuse rollback and run a new admission for the target |
| Ledger verifies locally after an attacker rewrites all entries | Hash chain has no external anchor | Publish signed ledger heads to a separate trust domain |
| Evidence contains bearer tokens or tool arguments | Logging copied whole requests | Redact at collection time and store only the minimum proof |

## İşlem Kuralı

Yayınlama cevapları Bu kimlik bu ismi yayınlayabilir mi? Kabul cevapları Bu tam eseryi uygulayacak ve bu tam davranışı ortaya koyacak mıyız? Bu kararları ayrı tutun, her bir birleşmeyi sabitleyin ve geri dönüşü hafıza yerine kanıt seçin.

## Daha Fazla Okumak

- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [Official Registry OpenAPI contract](https://registry.modelcontextprotocol.io/openapi.yaml)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
