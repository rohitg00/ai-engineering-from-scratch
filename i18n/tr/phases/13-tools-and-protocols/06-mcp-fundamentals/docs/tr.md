# MCP Temellikleri: İttifaksiz İstekler ve JSON-RPC

> Modern MCP'de el sıkışması ve protokol seansı yoktur. Her talebin kendi başına anlaşılabilir, yetkilendirilebilir, yönlendirilebilir ve tekrar denenebilir kadar yeterli metadata taşıması gerekir.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 01 through 05
**Time:** ~55 minutes

## Öğrenme Hedefleri

- MCP'nin sunucu primitiflerini istemci tarafı özelliklerinden ayırt edin.
- MCP için geçerli JSON-RPC 2.0 istekleri ve yanıtları oluştur `2026-07-28`- Evet .
- Her talebe protokol versiyonu, istemci yetenekleri ve istemci kimliği ekleyin.
- Kullanım`server/discover`ve elini tut .`UnsupportedProtocolVersionError`El sıkışmadan.
- Tam bir sonuçla birlikte bir bağımsız talebi doğrulama ile takip edin.

## Sorun

Bir MCP sunucusu, aynı işlem veya HTTP çalışanında farklı özelliklere sahip farklı istemcilerden iki ardıcıl istek alabilir. Eğer sunucu önceki isteklerin açıklandığını hatırlarsa, yanlış izinleri uygulayabilir veya yanlış tel şeklini geri verebilir.

MCP `2026-07-28`Bu, protokol çekirdeğinin devletsiz olduğunu gösterir. Bir sunucu, mevcut talebi bağlantı geçmişinden değil, mevcut talebi nasıl ele alacağını belirlemesi gerekir.

Bu zihinsel modelde değişiklikler yapmaktadır. Eski dizide ilk bağlantı, ikinci el sıkışması, üçüncü işlemler vardı.

1. Müşteri kendini tanımlama isteği gönderir.
2. Sunucu bu talebin versiyonunu ve özelliklerini onaylar.
3. Sunucu yöntemle ilgileniyor.
4. Sunucu yazdırılmış bir sonuç veya JSON-RPC hatası gönderir.

Bir sonraki talebinde aynı süreç sıfırdan tekrarlanır.

## Anlaşım

### Sunucu ilkesi

MCP sunucuları üç temel primitif açıklar:

1. **Tools**model kontrolü olan eylemler,`tools/list`Ve çağırıldık .`tools/call`- Evet .
2. **Resources**URI adresli veriler, `resources/list`ve `resources/read`- Evet .
3. **Prompts** ile keşfedilen tekrar kullanılabilir şablonlar.`prompts/list`ve `prompts/get`- Evet .

Kökleri, örnekleme ve ağaç kesimi `2026-07-28`uyumluluk için bir schema, ama onlar eski. Yeni uygulamalar kökler için açık bir araç veya kaynak girişlerini, örnekleme için doğrudan model sağlayıcı API'lerini ve kayıt için stderr veya OpenTelemetry'yi kullanmalıdır. Bir sunucu giriş istekini geri gönderir ve istemci orijinal işlemini tekrar yaparken, birçok döngü yolculuğu istekleri aracılığıyla başlatma hala mevcuttur. Modern bir sunucu bağımsız bir JSON-RPC talebini asla başlatmaz.

### JSON-RPC zarfları

MCP JSON-RPC 2.0 kullanıyor:

- İstek: `{jsonrpc, id, method, params}`
- Cevap:`{jsonrpc, id, result}`veya `{jsonrpc, id, error}`
- İletişim: `{jsonrpc, method, params}`Hayır .`id`

Talep`id`Bir cevapla ilişkili. Protokol seansı oluşturmaz.

### Gerekli talep metadataları

Her modern talebin içinde bir `_meta`İçeride bir nesne`params`- ...

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Protokol sürümü ve istemci yetenekleri gereklidir. istemci kimliği önerilir. Bu kendi kendini rapor eden görüntüleme ve hata işlemleri verileri, güvenlik kimliği değil.

Sunucu, bu değerlerden herhangi birini daha önceki bir istek, bir stdio süreci, bir HTTP bağlantısı veya tek başına bir nakliye başlığından çıkarmamalıdır.

### Tam sonuçlar ve sunucu kimliği

Her başarılı modern sonuç içerir .`resultType`Normal bir son sonuç kullanır.`"complete"`. Sunucular da sonuç metadatalarında kendilerini tanımlamalıdır:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "tools": [],
    "ttlMs": 30000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "notes-server",
        "version": "1.0.0"
      }
    }
  }
}
```

`tools/list`- Evet .`resources/list`- Evet .`prompts/list`- Evet .`resources/templates/list`- Evet .`resources/read`ve`server/discover`Bu sonuçlar, önbelleğe alınan sonuçlardır.`ttlMs`ve `cacheScope`Güvenli bir varsayım .`ttlMs: 0`ve `cacheScope: "private"`Listede bulunan öğelerin belirleyici bir sırayla olması gerekir, böylece eşdeğer yanıtlar sabit önbelleğe anahtarlar ve sabit model bağlamını oluşturur.

### El sıkışmadan keşfet

Her modern sunucu uygulamalıdır .`server/discover`Müşteri , diğer bir yöntemden önce bu yöntemi arayabilir:

- `supportedVersions`
- sunucu`capabilities`
- seçmeli kullanımı `instructions`
- Sonuç olarak sunucu kimliği `_meta`
- Kayıtlı ipuçları

Bulma yararlı, ama bir kapı değil.`tools/list`Öncelikle, bu talebin protokol versiyonu ve özellikleri zaten var.

İstediğiniz sürüm desteklenmiyorsa, sunucu JSON-RPC kodu gönderir `-32022`ile:

```json
{
  "requested": "2027-01-01",
  "supported": ["2026-07-28"]
}
```

Müşteri karşılıklı desteklenen modern bir sürümü seçer ve yeni bir JSON-RPC istek kimliği ile tekrar dener.

### Tek talep yaşam döngüsü

Modern bir talebi bu sırada izleyin:

1. Birinci JSON-RPC zarfını inceleyin.
2. - Evet .`jsonrpc`- Evet .`"2.0"`, bir `id`var.`method`bir ip ve `params`bir nesne.
3. Versiyon dizilisi ve kapasite nesnesini `params._meta`; yanlış biçimlendirilmiş veya eksik olan metadata `-32602`- Evet .
4. HTTP sınırında, versiyonu, yöntemi ve geçerli isim başlıklarını vücut ile karşılaştırın.`-32020`İki versiyon değerinden biri desteklenmemiş olsa bile.
5. Dürüstlük belirledikten sonra, eşleşen ama desteklenmeyen bir versiyonu reddedin.`-32022`- Evet .
6. Gerekli kapasiteleri kontrol edin ve sonra yolculuk edin.`method`ve yöntem-özel argümanları onaylamak.
7. İşlemini yürütmeden önce beton işlemini doğrulayın ve onaylayın.
8. Server kimliği ile tam bir sonuç iade edin.
9. İstek ölçülü protokol metadatalarını unut.

Bu emir iki bileşenin farklı çağrıları yorumlamasını engeller.`Mcp-Name: notes.read`Kaynaklar yerine getirilirken`params.name: notes.delete`Ayrıca yanlış biçimlendirilmiş giriş, başlık karışıklığı, sürüm müzakere, yetenek başarısızlığı, yetki ve işleme başarısızlığı da belirgin kanıtlar olarak saklanır.

Stdin veya HTTP cevabını kapatmak, nakliye etkinliğini sona erdirir.

### Açıkça miras verenlik

Versiyonlar `2025-11-25`kullanımı`initialize`- Evet .`notifications/initialized`Bu davranış, iki çağdaki bir istemci eski bir sunucuyla konuşurken hâlâ geçerlidir.

Zamanları ayrı tutun. Modern bir istek, istek başına gerekli metadata ile tanımlanır. Eski bir bağlantı yalnızca belgelemiş geri dönüş yolu yoluyla seçilir. Gönderme `initialize`bir  için default olarak`2026-07-28`- Sunucu.

Stateless bu nedenle çağ-sözlü bir anlam taşır.`2026-07-28`Bu, protokol değişmezliği içeren bir süreçtir. Her sıradan talebin bağımsız olarak yorumlanabilmesi ve MCP oturumunun bulunmaması gerekir.`2025-11-25`Bu nedenle, uyumluluk adaptörü eski bağlantı durumunu koruyabilir. İki çağ uygulaması bir izin veren durum makinesi değildir.

Bu iki anlam da kalıcı bir uygulama durumunu yasaklamaz. Bir iş akışı, görev veya taslak ortak bir mağazada açık olmayan bir eldivenin arkasında yaşayabilir. Müşteri bu eldivenini sıradan giriş olarak gönderir ve her kopya kullanımını doğruluyor ve yetkilendiriyor. Protokol bağlamı kaldırılan oturumun yerine bu mağazaya sızmamalıdır.

```figure
mcp-tool-call
```

## Kullan

`code/main.py`Modern MCP mesajlarını çerçeve olmadan oluşturur, onaylar, izler ve gönderir.

```bash
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Çıktıran üç değişken için dikkat edin:

- Her talep tekrarlanır .`_meta`Alanlar.
- Her başarılı sonuç`resultType: "complete"`ve sunucu kimliğini içerir.
- Listenin sonucu belirleyici bir şekilde düzenlenmiş ve açık bir önbelleğe işaretler sunmaktadır.

## Gönder

Bu ders gemileri `outputs/skill-mcp-handshake-tracer.md`Tarihi dosya adı sabit kalır, ancak eser artık bir devletsiz istek izleyicisi. Her mesajı bağımsız olarak denetler ve sadece gerçekte var olduğunda eski el sıkışması trafiğini etiketler.

## Egzersizler

1. Bir istek protokol versiyonunu  olarak değiştirin.`2027-01-01`Hata kodunun doğru olduğunu onaylayın .`-32022`ve veriler desteklenen versiyonu reklam eder.
2. Çıkar `io.modelcontextprotocol/clientCapabilities`Sunucu ilk istekten gelen özellikleri tekrar kullanmıyor.
3. Hatırlatma araçları kayıtlarını tersine çevirin.`tools/list`Yine de aynı belirleyici sırayı geri verir.
4. Değişiklik`cacheScope`-`public`- ...`private`. Her durumda yanıtın hangi yetki bağlamlarında tekrar kullanılabileceğini açıklayın.
5. Seçeneği ekle `clientInfo`İstek geçerli kalmalıdır çünkü müşteri kimliği gerekmez, tavsiye edilir.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| Stateless protocol | Every request supplies the metadata needed to interpret it |
| Request metadata | Version, client capabilities, and recommended client identity in `params._meta` |
| `server/discover` | Mandatory server method for versions, capabilities, instructions, and identity |
| `resultType` | Discriminator on every successful modern result |
| Cacheable result | Result that includes required `ttlMs` and `cacheScope` hints |
| Protocol era | Modern per-request metadata or legacy connection-scoped initialization |
| Transport lifetime | Process, connection, or response-stream lifetime, not protocol session state |
| `-32022` | Unsupported protocol version error with requested and supported versions |

## Daha Fazla Okumak

- [MCP Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
