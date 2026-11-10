# MCP Araç Sözleşmeleri ve İçeriği

> Bir araç, keşif, argüman, sonuçlar, sayfalama ve taşıma metadataları tek bir sözleşme üzerinde anlaştığında otomatik olarak güvenli bir araçtır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07, 09, and 10
**Time:** ~120 minutes

## Öğrenme Hedefleri

- JSON Schema 2020-12 ile araç girişlerini ve çıkışlarını tanımlayın.
- Yapılandırılmış sonuçları JSON nesneleri olduğunu varsaymadan doğrulayın.
- Metin, resim, ses, kaynak bağlantıları ve gömülü kaynaklar arasında seçim yapın.
- Güvensiz bir şekilde reddet .`x-mcp-header`Bir araç modeline ulaşmadan önce tanımlar.
- Parametre başlık değerlerini kodlayıp başlık-vücut tam eşitliğini doğrulayın.
- Kürsör değerlerini yorumlamadan geçiş kursor sayfalama.
- Bağlanıp yetki ver .`completion/complete`öneriler.

## Sorun

Python fonksiyonunu aramak kolaydır. AI barındırma aracılığıyla uzaktan bir kapasiteyi aramak bir sözleşme sorunu.

Server bir açıklayıcı yayınlar. Müşteri bu açıklayıcıyı model bağlamına ve kullanıcı arayüzüne dönüştürür. Model argümanlar oluşturur. Bir geçit, istekleri ayna başlıklardan yönlendirebilir. Server aracı yürütür. Müşteri daha sonra sonuçın modeline dönmek için yeterince güvenli ve geçerli olup olmadığını belirler.

Bir zayıf sınır bütün zinciri bozar.

Beş başarısızlığa bakalım:

- Deskriptör sonuç bir nesne olduğunu söylüyor, ama sunucu bir diziyi gönderir.
- Müşteri sayfalama işlemini durdurur.`nextCursor`boş bir ip.
- Bir token parametri HTTP başlığı içine yansıtılır ve aracılara görünür hale gelir.
- Bir Unicode yönlendirme değeri bir çiğ başlık olarak gönderilmektedir, sonra geçit ve köken farklı baytları yorumlar.
- Bir tamamlama son noktası, erişemeyecek bir aramacıya bir üretim ortamı önerir.

Bu hataların hiçbiri daha iyi bir teşvikle çözülmez.

## Sözleşme boru hattı

Her araç çağrısı beş kapı olarak değerlendirin:

1. **Discover.**Deterministik, sayfalardaki araç listesini okuyun.
2. **Admit.**Her tanımlayıcıyı doğrulayın ve yerel güvenlik politikasını uygulayın.
3. **Invoke.**Dönüşüm argümanlarını doğrulayın ve ulaşım metadatalarını oluşturun.
4. **Execute.**Yöneticini çalıştır ve hataları doğru bir şekilde sınıflandır.
5. **Consume.**Modelle kullanımdan önce içerik bloklarını ve yapılandırılmış çıkışları doğrulayın.

```figure
mcp-contract-pipeline
```

Bir sunucu bir müşteriyi notlarına, şemalarına veya çıkışlarına güvenmeye zorlayamaz.

## JSON Şema Çalışma Zamanı Sınırıdır

MCP'de `2026-07-28`- Evet .`inputSchema`ve `outputSchema`JSON Şema kullanın.`$schema`eksik, varsayılan diyalek 2020-12'dir.

Giriş şeması bir şeması nesnesi olmalıdır. Hiç argüman olmayan bir araç hala kabul ettiği şeyi tam olarak söylemesi gerekir:

```json
{
  "type": "object",
  "additionalProperties": false
}
```

Bu daha sıkı .`{ "type": "object" }`, ki keyfi özellikleri kabul eder.

Bir çıkış şeması seçeneğidir. Bir sunucu bir tane yayınladıktan sonra, her tam araç
sonuç , uygun olarak geri dönüş yapmayı taahhüt eder `structuredContent`, sonuçları da dahil
- Evet .`isError: true`. Hata bayrağı , yürütme sonucu sınıflandırır;
Müşteriler sonuçları onaylamalı.
- Deskriptöre güvenmek.

### Yapılandırılmış içerik herhangi bir JSON değeri

Kısıtlama `structuredContent`Sözlük olarak.

- bir nesne;
- bir dizi;
- bir ip;
- bir sayı;
- bir boolean;
- `null`- Evet .

Bu araç bir dizini gönderir:

```json
{
  "name": "tag_catalog",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "array",
    "items": {"type": "string"}
  }
}
```

Başarılı sonuç geçerlidir:

```json
{
  "resultType": "complete",
  "content": [
    {
      "type": "text",
      "text": "[\"contracts\", \"mcp\", \"stateless\"]"
    }
  ],
  "structuredContent": ["contracts", "mcp", "stateless"],
  "isError": false
}
```

Uygunluk için yapılandırılmış sonuçlar bir metin blokunda seryal JSON'u da içermelidir. Metin onay kaynağı değildir. `structuredContent`- Evet.

### Küçük bir onaylayıcı hala sınırları öğretir .

Ders, Python standart kütüphanesi içinde kalır ve örnek araçların kullandığı mekanizmaları kontrol eder.

- nesne, diz, ip, tam sayı, sayı, boolean ve sıfır türleri;
- Gerekli özellikler;
- `additionalProperties: false`- ...
- Array öğeleri;
- enum değerleri;
- En az ip uzunluğu.

Bu, tam bir üretim onaylayıcıyı değiştirmez. Tekrar kullanılabilir ders, onaylamanın gerçekleşmesinde bulunur: tanımlayıcılar için keşif sonrası, argümanlar için uygulanmadan önce ve yapılandırılmış sonuçlar için tüketim öncesi.

## İçerik Blokları Farklı Maliyetlerle Yükleniyor

- Evet .`content`Aray çeşitli içerik türlerini birleştirebilir.

| Type | Use it for | Main boundary |
|------|------------|---------------|
| `text` | Human and model-readable summaries | Treat text as untrusted output |
| `image` | Visual evidence encoded as base64 | Validate media type and size |
| `audio` | Spoken or recorded output encoded as base64 | Validate media type and duration limits |
| `resource_link` | A URI the client may fetch later | Reauthorize the later resource read |
| `resource` | Data embedded directly in the result | Enforce payload and content limits now |

Kaynak bağlantısı , kaynının `resources/list`Bu araç çağrısı ile geri gönderilen bir referans. URI'yi takip ederken müşteri hala kaynak politikasını uyguluyor.

Bir gömülü kaynak bir başka dönüş yolculuğunu önler ancak mevcut yanıt boyutunu arttırır. Büyük veya bağımsız olarak değişen eserler için bağlantılar kullanın.

Dersimiz `evidence_bundle`Sonuç, tüm beş türü içerir. Müşteri sonuç kabul edilmeden önce her bloku onaylar.

## `x-mcp-header`Metadata yönlendiriyor mu ?

İçeride bir mülk var .`inputSchema`açıklayabilir.`x-mcp-header`. Streamable HTTP üzerinden, istemci bu argümanı `Mcp-Param-{name}`- Evet .

```json
{
  "region": {
    "type": "string",
    "x-mcp-header": "Region"
  }
}
```

- Evet .`region: "eu-west"`, taşımacılık:

```http
Mcp-Param-Region: eu-west
```

Notasyon var, böylece yük dengeleyici, geçit veya politika motoru JSON vücudu analiz etmeden yönlendirebilir.

Protokol, açıklamaları kısıtlıyor:

- Başlık adı boş değil ve HTTP alan adı token sintaksını takip eder;
- Başlık isimleri durumlara bakılmaksızın eşsizdir.
- Özellik türü string, tam sayı veya boolean;
- `number`izin verilmez;
- Not sadece doğrudan bir üye üzerinde görünür `inputSchema.properties`- ...
- Tam sayı değerleri içinde kalır `-9007199254740991`- Evet .`9007199254740991`- Evet .

Yer kuralı sentaksik ve başarısız olarak kapatılmıştır.
Sadece onaylayıcılarınızın anladığı özellikler değil.
Yatağındaki nesnenin altındaki not`properties`, a `oneOf`Şubesi,`items`, bir
`$ref`Referans çözmek
Referanslanmış düğümü doğrudan üst düzey bir özelliğe dönüştürmez.

Bu ders bir uygulama politikası ekliyor:  gibi isimleri yansıtan tanımlayıcıları reddetmek.`password`- Evet .`secret`- Evet .`token`- Evet .`api_key`veya`authorization`Resmi özellik, sunucu yazarlarına hassas parametreleri yansıtmamak konusunda tavsiye ediyor.

Başlık adını kontrol et, değeri değil.`Mcp-Param-Region`- Ne ?`eu-west`denetim etkinliğinden çıkmış.

### HTTP başlıkları oluşturmadan önce kodlama değerleri

Bir parametre değeri sadece boş olmayan bir dizilere sahip olduğunda düz metin olarak seyahat edebilir
            `!`- Evet .`~`ve benzemiyor
Diğer her şey bu şekli kullanıyor:

```text
=?base64?{Base64UTF8}?=
```

`Base64UTF8`UTF-8 baytları üzerinde standart base64'dir.
Encode Unicode, boş ipler, boşluklar,
Sekmeler, kontrol karakterleri, CR veya LF, ön veya arka beyaz alanlar ve herhangi bir
 ile başlayan değer`=?base64?`. Bir bekçi gibi görünen bir değeri yeniden kodlamak
Alıcıya kodlama yerine orijinal metni geri almasına izin veren nedir?
- Bu da bir taşıma sözcük.

Booleans küçük harflerle ifade eder.`true`veya `false`. 10 tabanında verilen tam sayı ve
JavaScript güvenli tam sayı aralığında kalmalıdır.
bir aracı tarafından yuvarlanmak yerine reddedilmektedir.

### Sunucu ayna kopyasını kontrol ediyor .

Başlık üretimi sadece istemcinin yarısı.
sunucu:

1. Tanınmış bul .`Mcp-Param-*`Başlık isimleri durumuna bakılmadan isimler;
2. var olduğunda, tam base64 sentinel formunu çözün;
3. Açıklanan metni, ilgili JSON beden argümanı ile tam olarak karşılaştırın;
4. Kayıp, çoğaltılmış, beklenmedik, yanlış şekillendirilmiş veya eşleşmeyen bir şeyi reddetmek
   Göndermeden önce tanınan başlık.

Reddedilme HTTP `400`JSON-RPC hata kodu ile `-32020`- Ne de
Desteğe ait değer, kodlanmış başlık formunun da denetim kayıtlarına ait olmadığı belirtilmiştir.
Tanınan başlık adı ve reddedilen kategorisi.

`code/main.py`Bu sınırları doğrudan modeller.[Lesson 09](../../09-mcp-transports/)
Metod ve
Protokol-versiyon paritesi.

## Sayfa Kuralları Açık Olmuyor

MCP listesi işlemleri, kursor sayfalama kullanır. Sunucu sayfa boyutunu ve kursor biçimini seçer.

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

Bunu yazma:

```python
if not result.get("nextCursor"):
    break
```

Boş bir ip geçerli bir işaretçidir.

Müşteriler bir kursorun kodunu çözmemelidir, onu artırmamalı, sipariş için önceki bir kursorla karşılaştırmamalı veya bir sayfa numarasını çıkarmamalıdır. Bir sunucu bir kursoru imzalayabilir, bir katalog sürümüne bağlayabilir veya özel durumuna haritasına sahip olabilir. Bu sunucu uygulamasının ayrıntılarıdır.

Örnek sunucu kasıtlı olarak geri döndürür `""`Müşteri ikinci talepte bu değerleri göndermelidir.

```text
<first request with no cursor>
<second request with cursor "">
```

Geçersiz göstergeler JSON-RPC geçersiz parametreleri oluşturur, kod `-32602`- Evet .

## Tamamlama Yetki Yüzeyi

`completion/complete`Bu, interaktif formlar için yararlıdır, ancak sıradan listeler yöntemlerinin koruduğu isimleri sızdırır.

Tamamlama talebi bir referans ve tamamlanan argümanın isimlerini belirtir:

```json
{
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "deployment_review"
    },
    "argument": {
      "name": "environment",
      "value": "st"
    }
  }
}
```

Sonuç en fazla 100 değer gönderir ve rapor edebilir `total`Ek olarak .`hasMore`- Evet .

Referanslı prompt veya kaynak tarafından kullanılan aynı yetki sınırı uygulayın.`development`ve `staging`Sadece bir operatör alabilir .`production`- Evet .

Üretim tamamlanması ayrıca şunları gerektirir:

- Giriş doğrulama;
- Arayıcı bilinci filtresi;
- Müşteride açıklama talep etmesi;
- Sunucuda hız sınırlaması;
- sınırlı sonuç sayıları;
- Hissedici önerme değerlerini ortaya çıkarmayan günlükler.

Tamamlama yardımdır, keşif bypass değil.

## İki Hata Katmanı

Protokol hatalarını araç işlev hatalarından ayrı tutun.

MCP talebi doğru şekilde gönderilmediğinde JSON-RPC hatası kullanılır:

- Bilinmeyen araç adı;
- yanlış biçimlendirilmiş talep şekli;
- Kayıp talep metadataları;
- geçersiz bir işaretleme.

 ile birlikte tam bir araç sonucu kullanın`isError: true`Çağrı aracıya ulaştığında ve araç, uygulanabilir bir hata bildirdikten sonra:

- Rapor kaynağı bulunmuyor;
- bir tarih desteklenen aralığın dışında;
- Bir iş kuralı talep edilen işlemini reddeder.

Modeller genellikle bir araç işlev hatasını onarabilir. Kendi çıkış şeması ihlal eden bir sunucu onarabilir.

Araç bir çıkış şeması açıklarsa, model bir işlemelmiş hata içinde
Şema.`route_report`Başarısızlık, istediği bölgeyi geri gönderir
`accepted: false`, insan okuyabilir hatası metnin yanında ve `isError: true`- Evet .

## Yapın

`code/main.py`Python standart kütüphanesi ile sınırın her iki tarafını oluşturur.

Sunucu:

- talebe göre MCP metadata doğrulama;
- `server/discover`araç ve tamamlama yetenekleri ile;
- Determinizmi `tools/list`sayfalama;
- reddedilmesi gereken bir araç tanımlayıcı da dahil olmak üzere dört araç tanımlayıcı;
- Array yapılandırılmış çıkış;
- her mevcut araç içeriği blok tipi;
- Tanınan parametreler başlıklarını çözüp
  HTTP gönderir `400`artı JSON-RPC `-32020`eşleşmezlik;
- Yetkili ve ücretli tamamlama.

Müşteri:

- Deskriptör kabulü;
- Tam ağaç`x-mcp-header`yerleştirme doğrulama ve hassas alan politikası;
- Tam olarak açık görünür ASCII veya base64 UTF-8 değer kodlaması;
- Boş bir iplik izleyen bir açık olmayan bir kursor döngüsü;
- argüman ve sonuç doğrulama;
- İçerik blokları doğrulama;
- isimler içeren ama değerleri içermeyen başlık denetim etkinlikleri.

Bilerek güvenli olmayan tanımlayıcı, öğretim verileri. Bu, reddedilen bir araçın geçerli araçların yüklenmesini engellemediğini kanıtlar.

## Kullan

Depo kökü:

```bash
cd phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Demo baskıları kabul edilen araçlar, reddedilen tanımlayıcı, hem sayfalama
talepler, yapılandırılmış dizin içeriği, içerik blokları türleri, aynalı başlık
isimler, gereksiz kodlama değeri, HTTP paritliği durumu ve
Çağrıcı filtreli tamamlama değerleri.

## İnteraktif Laboratuvar

Açık .`code/main.py`ve bul .`TOOLS`- Evet .

1. Değişiklik`tag_catalog.outputSchema.type`-`array`- ...`object`- Evet .
2. Demo çalıştırın, istemci geri gönderilen dizini reddetmeli.
3. Şemayi geri getir.
4. İlk sayfayı sakla.`nextCursor`- Evet .`""`, sonra son sayfayı geri gönder .
   `nextCursor: None`Alanı atlamak yerine.
5. Testleri yapın ve kursor izini karşılaştırın.
6. Ekle`x-mcp-header: "Authorization"`Bir iplik özellikine.
7. Bildirme tanımlayıcı kabul, çağrılmadan önce reddedilir.
8. Deneme .`region`Unicode, yeni bir satır, çevresindeki boşluklar içeren değerler ve
   - Sözcük metin .`=?base64?SGVsbG8=?=`. Her gönderilen başlığı çözüp kanıtlayın .
   Orijinal değer tam olarak kalır.
9. Notasyonu aşağıya taşı`oneOf`- Evet .`items`, veya bir `$ref`Defini.
   Her tanımlayıcı, bu dalın demo tarafından hiç kullanılmaması halinde reddedilmektedir.
10. Tanınan başlığı kaldırın veya çözülmüş değerini değiştirin. HTTP'yi onaylayın
    Sınır devre durumunu `400`ve JSON-RPC kodu `-32020`- Evet .

Amaç JSON şeklini ezberlemek değil, her kapının sahip olduğu sınırda başarısız olduğunu izlemek.

## Pratik Laboratuvar

Sözleşme laboratuvarını bir `search_evidence`Araç.

Gereksinimler:

1. Giriş şeması kabul eder `query`- Evet .`limit`, ve bir kasap .`region`yönlendirme alanı.
2. Çıktı şema ,  ile birlikte nesnelerin bir dizi .`uri`- Evet .`title`ve`score`- Evet .
3. Sonuç, her bir madde için uyumluluk metni ve bir kaynak bağlantısı içerir.
4. Deliller bilinmeyen özellikleri reddeder.
5. `limit`başvuru onaylaması ile sınırlıdır.
6. Bir URI'ye erişimi olmayan bir aramacı, bu URI'yi tamamlama veya araç çıkışı yoluyla asla görmez.
7. Testler uyumsuz bir puan, geçersiz başlık notasyonu ve iki sayfalık bir liste içerir.
8. Başlık değerleri testleri görünür ASCII, Unicode, kontrol karakterlerini kapsar.
   beyaz alan, sentinel görünümlü metin ve her ikisi de JavaScript güvenli tam sayı sınırları.
9. HTTP ayarı, durumlara karşı duyarlı olmayan başlık isimlerini kabul eder, ancak eksik olanları reddeder
   veya status ile eşleşmeyen tanınan değerler `400`ve kod`-32020`- Evet .

## Nakliye edilen Sanatlı

`outputs/skill-mcp-contract-reviewer.md`Bu, bir kabul kararı, sonuç doğrulama planı, başlık politikası ve belirli başarısızlık testlerini gönderir.

## Kontrol et

Ders, şu ifadeler doğru olduğunda tamamlanır:

- `tools/list`Tekrar tekrarlanan aramalarda aynı mantıklı sırayı gönderir.
- Müşteri ikinci bir talebi yaparken`nextCursor`- Evet .`""`- Evet .
- Güvenli olmayan hassas başlık tanımlayıcıı dışlanmıştır, diğer araçlar kullanılabilir kalır.
- Bir dizi, dizilme çıkış şemasından geçer.
- Bir nesne aynı dizide şema başarısız.
- Hata sonuçları yayınlanan bir çıkış şeması'nı ihmal edemez veya ihlal edemez.
- Metin, görüntü, ses, kaynak bağlantısı ve gömülü kaynak blokları geçerlidir.
- Başlık denetim etkinlikleri isim ve değer içermez.
- Görülebilir ASCII düz kalır; Unicode, kontrol, dolgu, boş ve
  Sentinel görünümlü değerler, tam base64 UTF-8 kodlaması üzerinden geri dönüş.
- JavaScript güvenli aralığı dışında aynalanmış tam sayılar reddedilmiştir.
- Altındaki Notlar `oneOf`- Evet .`items`, yuvalanmış nesneler, `$ref`tanımlar veya
  çıkış düzenleri kabul sırasında reddedilmektedir.
- Durum duyarsız tanınan başlık isimleri sadece çözülmüş değer geçerken geçer
  tam olarak vücuda eşleşir; eksik veya eşleşmeyen kopyalar HTTP üretir `400`
  ve JSON-RPC `-32020`- Evet .
- Analist tamamlanıp geri dönmez .`production`- Evet .
- Bir araç başarısızlığı kullanır `isError: true`; yanlış biçimlendirilmiş bir protokol çağrısı JSON-RPC kullanır `error`- Evet .

## Üretim Başarısızlık Modları

| Failure | What the learner sees | Correct response |
|---------|-----------------------|------------------|
| Client assumes object output | Valid arrays fail or are silently wrapped | Validate against the published schema without object-only types |
| Empty cursor treated as false | Final pages disappear | Continue whenever `nextCursor` is present and non-null |
| Sensitive value mirrored | Secret appears in proxy, WAF, or trace data | Reject the descriptor and keep secrets in protected request data |
| Raw Unicode or whitespace mirrored | Gateway and origin disagree or the value is normalized | Use exact base64 UTF-8 sentinel encoding and compare after decoding |
| Annotation hidden in a schema branch | A client misses routing metadata during admission | Traverse the entire schema tree and allow only direct top-level properties |
| Large integer mirrored | JavaScript intermediary rounds the routing value | Reject values outside the JavaScript safe integer range |
| Header and body disagree | Gateway routes one target while the origin executes another | Reject before dispatch with HTTP `400` and JSON-RPC `-32020` |
| Output schema ignored | Downstream code consumes corrupt structure | Validate before model or application use |
| Resource link trusted automatically | Caller follows an unauthorized URI | Reauthorize every resource read |
| Completion shares global suggestions | Hidden tenant names leak | Filter by caller, reference, and authorization |
| Tool annotations treated as policy | Destructive operation bypasses confirmation | Enforce authorization and approval outside annotations |
| One malformed tool breaks discovery | Entire server becomes unavailable | Reject the bad descriptor and admit valid tools independently |

## Capstone Bağlantısı

Faz 13'ün kapı taşı, birkaç sunucudan araçları birleştirebilen bir geçit gerektirir.

Bu eseri dört taştan kanıt için kullanın:

- Deterministik ve tamamı sayfalama keşif;
- Model maruz bırakılmadan önce tanımlayıcı doğrulama;
- onaylanmış yapılandırılmış çıkış artı sınırlı içerik blokları;
- yetki sınırlarını koruyan metadata tamamlama ve yönlendirme.

Başarılı bir geçit uyumluluğunu iddia etmeyin `tools/call`Tek başına. Deskriptörü, sayfa izini, kabul edilen araç seti, reddedilen araç seti ve bir onaylanmış sonucu yakalayın.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| `inputSchema` | JSON Schema object defining accepted tool arguments |
| `outputSchema` | Optional JSON Schema defining `structuredContent` |
| `structuredContent` | Any JSON value produced by a tool result |
| Content block | Typed text, image, audio, resource link, or embedded resource |
| `x-mcp-header` | Schema annotation that mirrors a primitive argument into Streamable HTTP metadata |
| Opaque cursor | Server-issued pagination token whose value the client does not interpret |
| Completion reference | Prompt name or resource URI/template whose argument is being completed |
| Admission | Client decision to expose or reject a discovered descriptor |

## Daha Fazla Okumak

- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- [MCP Streamable HTTP Parameter Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#custom-headers-from-tool-parameters)
