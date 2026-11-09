# Model Konekst Protokolü (MCP)

> MCP, bir AI sunucusuna araçları, kaynakları ve istekleri keşfetmek ve çağrıştırmak için bir protokol verir. 2026-07-28 baskısı bu protokolü devletsiz hale getirir: yetenek ve sürüm bağlamı her taleple seyahat eder, bağlantı bağlı bir el sıkışmasında değil.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Bir MCP barındırma, istemci, sunucu, nakliye ve sunucu primitif ayırt edin.
- MCP 2026-07-28 tarafından istenen metadata ile JSON-RPC talebi oluşturun.
- Kullanım`server/discover`Versiyonları, kimliği ve özelliklerini incelemek için.
- Araçlardan, kaynaklardan ve isteklerden yazılmış ve önbelleğe anlaşılan sonuçları geri gönderin.
- Modern devletsiz MCP'nin el sıkışması çağındaki sunucularla nasıl etkileşime girdiğini açıklayın.
- Bir sunucu için güvenli durum, ulaşım ve onay sınırlarını seçin.

## Sorun

Uygulama bir veritabanı sorgu, bir takvim işlevi ve bir dosya okuyucuya ihtiyaç duyar. Paylaşılan bir protokol olmadan, her AI sunucusu aynı özellikler için özel keşif, çağrı, hata, nakliye ve yetki yapıştırıcıya ihtiyaç duyar.

MCP, bu entegrasyon matrisini azaltır. Bir sunucu standart bir JSON-RPC yüzeyini yayınlar. Uyumlu bir istemci yüzeyi keşfedebilir, bir model veya kullanıcıya sunar, çağrıştırır ve sonuçları sunucu özel bir adaptör olmadan yorumlayabilir.

MCP iletişim standartlaştırır. Model hangi aracı çağırması gerektiğini, güvenilmeyen içeriği güvenli hale getirmesi veya devletsiz bir talebi dayanıklı bir uygulama durumuna dönüştürmesi gerektiğini belirlemez. Ev sahibi ve sunucu bu kararları hala sahip.

## Anlaşım

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### Üç sunucu ilkesi

1. **Tools**Her araç bir isim, açıklama, JSON Schema giriş ve işlemci vardır.
2. **Resources**URI adresli ve müşterinin okuyabileceği içerikler.
3. **Prompts**bir host tarafından kullanıcının açıklayabileceği tekrar kullanılabilir şablonlardır.

Host, AI uygulamasıdır. Bu host içindeki bir MCP istemcisi bir sunucuyla konuşur.

### İnsansızlık talepleri el sıkışının yerini alır

MCP 2026-07-28 kaldırılıyor `initialize`ve `notifications/initialized`Ayrıca protokol düzeyinde oturumları da kaldırır.`params._meta`- ...

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Protokol versiyonu ve istemci yetenekleri gereklidir.`_meta`, eksik olan gerekli alan veya yanlış tipi olan gerekli alan yanlış biçimlendirilmiş ve geçersiz Parameler gönderilmiştir (`-32602`). Server tarafından desteklenmeyen iyi oluşan bir sürüm dizisi gönderir `UnsupportedProtocolVersionError`(`-32022`). Bir sunucu, geçerli bir talebi daha önce yapılan müzakere kayıtlarını geri kazanmadan işleyebilir.

İstemsizlik, bir başvuru hiçbir zaman durumunu koruyabilme anlamına gelmez.`Mcp-Session-Id`. Eğer bir iş akışı süreklilik gerektirirse, sunucu bir açık olmayan eldiven oluşturur ve müşteri daha sonraki aramalarda sıradan bir araç argümanı olarak bu eldivenini geçer.

### Bulma ve sürüm seçimi

Her modern sunucu uygulaması `server/discover`. Sonuç desteklenen sürümleri , özellikleri ve sunucu kimliğini reklam eder:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

Bir istemci doğrudan başka bir yöntemi arayabilir ve bir sürüm hatasını ele alabilir, ancak keşif yetenek gösterisini ve sürüm seçimini açık yapar. Desteklenmeyen bir sürüm geri gelir `UnsupportedProtocolVersionError`Kodla `-32022`Verilerinde `supported`, bir dizi sunucu revizyonu ve `requested`, reddedilen düzenleme.

Stüdyoda, ikili çağda çalışan bir müşteri ile konuşuyor.`server/discover`Bir keşif sonucu veya tanınan modern bir hata .`UnsupportedProtocolVersionError`Modern olarak tanınmayan herhangi bir hata veya zamanlama 2025-11-25'e geri dönmenizi sağlar.`initialize`Geçmiş davranışlar uyumluluk kodu, modern standart değil.

### Sonuçlar açıkça belirtildi .

2026-07-28 sonuçları her çekirdeğin üzerinde`resultType`- ...

- `complete`Operasyon bitti demektir.
- `input_required`Bu da sunucuyu bir daha dönüşe ve dönüşe yönlendirme şekliyle yönlendirme gerektirir.`tools/call`- Evet .`resources/read`veya`prompts/get`- Evet .

Müşteriler , eklenmiş bir sonuca bakmalıdır .`resultType`Tam olarak.

Sunucular `io.modelcontextprotocol/serverInfo`Her sonuçta.`_meta`Bu kimlik kendiliğinden bildirilmektedir ve güvenlik kararları için değil görüntüleme, kayıt ve hata işlemleri için kullanılır.

Liste ve okuma sonuçları da taşınır `ttlMs`ve `cacheScope`- Deterministik bir`tools/list`sipariş eklenmiş bir tazelik ipucu müşterilerin keşifleri güvenli bir şekilde önbelleğe almalarını sağlar ve hızlı önbelleğin istikrarını artırır. `cacheScope: public`Paylaşılan önbelleğe izin verir; `private`Bu, tekrar kullanımı çağrı bağlamına sınırlıyor.

### Kablo biçimi ve nakliye

MCP, stdio veya Streamable HTTP üzerinden JSON-RPC 2.0 kullanır.

- Bir talebinin `jsonrpc`- Evet .`id`- Evet .`method`ve`params`- Evet .
- Bir cevap eşleşir .`id`Ve ya da`result`veya `error`- Evet .
- Bir bildirim yok .`id`Ve hiçbir tepki beklemiyor.

Modern Streamable HTTP, POST'u kabul eden bir uç noktasını ortaya çıkarır. Her JSON-RPC mesajı kendi POST'unu alır. Bir istek POST, bir JSON nesnesi veya son cevabıyla biten bir istek-scoped Server-Sent Events akışını alır. Kabul edilen bir bildirim POST, hiçbir cevap vücudu olmayan HTTP 202 alır; bu temel revizyondan Streamable HTTP üzerinden hiçbir istemci-sözümci bildirim tanımlanmaz.

Standalone MCP GET akışı, DELETE seans son noktası yok.`Mcp-Session-Id`veya`Last-Event-ID`2026-07-28'de tekrar oynayın.`subscriptions/listen`POST, SSE akışı olarak açık bir cevap olarak kalır.

### Sunucu tarafından başlatılan istekler olmadan istemci girişleri

Daha eski değişiklikler , sunucuya  gibi istekler göndermesine izin verir .`sampling/createMessage`- Evet .`roots/list`veya`elicitation/create`Bir akış üzerinde. Şu anki protokol bunun yerine Multi Round-Trip Requests kullanıyor.`resultType: input_required`en az bir tane ile `inputRequests`veya `requestState`. Müşteri istedikleri herhangi bir giriş toplar, yeni bir JSON-RPC kimliği ve ilgili `inputResponses`, ve tam olarak yankılanır .`requestState`Eğer bir tane sağlanmamışsa`inputRequests`Varken tekrar denemeyi bırakır.`inputResponses`- Evet .

Kökler, Örnekleme ve Kayıtlama işlevsel kalır ancak eski hale gelmiştir, bu nedenle yeni uygulamalar bunları benimsememeli.`inputRequests`, asla bağımsız sunucu-klient JSON-RPC istekleri olarak. Açık dosya veya dizin parametrelerini, kaynak URIs'lerini, sunucu yapılandırmasını ve doğrudan model sağlayıcı entegrasyonu tercih edin. stderr'yi stdio teşhisleri ve OpenTelemetry'yi üretim telemetrisi için kullanın.

```figure
mcp-nxm-collapse
```

## Yapın

### Adım 1: Bir sunucu yüzeyini kaydet

Başvuru sözleşmesi değiştirilmesine rağmen kayıt basit kalır:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

            `code/main.py`Bu program, bir SDK'ye protokolü delegasyon etmek yerine her zarfı görebilmeniz için standart kütüphaneden kasıtlı olarak kullanır.

### Adım 2: Her talebe metadata ekleyin

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

Bu metadataları yalnızca bir bağlantı nesnesinde saklama. Sunucu her istekle onaylar.

### Adım 3: listelenmeden önce seçeneği keşfet

Arama .`server/discover`, desteklenen bir sürüm seçin, sonra arın `tools/list`- Bir direkt .`tools/list`Eğer versiyonu zaten biliyorsanız ve bunu yapabiliyorsanız geçerlidir.`-32022`- Evet .

Demo , araç listelerini isim sırasıyla gönderir ve ekler `ttlMs`- Evet .`cacheScope`- Evet .`resultType`Bir araç çağrısı, mevcut durumdan bağlı olabileceği için, tamamlanmış, önbelleğe kaydedilebilir olmayan bir sonuç gönderir.

### Adım 4: Aynı istekleri HTTP'ye haritasın

Uzaktan bir ...`tools/call`POST, JSON-RPC bedenini yansıtan başlıkları içerir:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

- Evet .`MCP-Protocol-Version`Başlık , `_meta`- Evet .`Mcp-Method`her JSON-RPC talebi için gerekli ve eşleşmelidir `method`- Evet .`Mcp-Name`Sadece `tools/call`- Evet .`resources/read`ve`prompts/get`, tool adı, kaynak URI veya prompt adı ile eşleşmesi gereken.`HeaderMismatch`kod`-32020`- Evet .

### Adım 5: Protokol durumundan dışarıdaki güvenlik güçlendirilmesi

- Her HTTP istek için yetki ve izleyicileri doğrulayın.
- Yerel sunucuları yerel sunucu ile bağlayın ve doğrulayın `Origin`Akışlı HTTP'de.
-  ile mutasyon aletlerini işaretleyin`destructiveHint: true`ve ev sahibi onayını gerektirir.
- Geçmiş köklere bağlı olmaksızın açıkça dizini ve dosya kapsamını geçin.
- Kaynakları ve araç çıkışını güvenilmeyen veriler olarak değerlendirin.
- Stdout'u stdio altında JSON-RPC için ayırın; stderr'e teşhis yazın.

## Kullan

Dersleri dizininden çalıştır:

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

İlk satırda `demo-server`Protokolde`2026-07-28`- Sonra kontrol et .`MCPClient.request`Bu yeniden inşa ediliyor.`_meta`Bir talebinden metadataları çıkar ve sunucu tarafından reddedildiğini gözlemle.

## Gönder

`outputs/skill-mcp-server-designer.md`Bir alanı devletsiz bir MCP tasarımı haline getirir. Kabul kapısı bir keşif sonucu, talep başına metadata politikası, belirleyici önbelleğe farkındalık listesini, açık durum eleştiri, ulaşım başlıklarını, yetki ve onay kurallarını gerektirir.

## MCP Derin Dalışını Sürdürün

Bu ders size protokol modeli verir. 13 aşama dört üretim sınırını ayrı yapı ve doğrulama derslerine dönüştürür:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)Kapalı giriş şemeleri, yapılandırılmış içerik, yönlendirme metadata, netsiz sayfalama, tamamlama yetkisi ve protokol ve araç alanı hataları arasındaki farkı kapsar.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)Başvuru iptalini, kalıcı görev iptalini, tarihleri, boşluğu, geri baskıyı, vekil tamponu ve yeniden bağlama davranışını kapsar.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)Ad alanı kanıtını, eserlerin kökenini, değişmez pinleri, canlı sürüklemeyi, kayıt durumunu, kabul kanıtı ve geri dönüşü kapsar.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)Altın ve negatif tel transkriptleri, sıkı sürüm dönemleri, SDK farklılıkları, vekillik kanıtları, redaksiyon, sağlık kapıları ve serbest bırakma geri dönüşü kapsar.

Bu yöntemler, bir ekip veya güven sınırını geçtikleri sırada takip edilir.

## Egzersizler

1. Bir ekle`subtract`araç ve onay`tools/list`alfabetik olarak sıralanmış.
2. Protokol sürüm anahtarını kaldır ve geçersiz Paramları doğrulay (`-32602`Sonra iyi şekillenen ama desteklenmeyen versiyonu gönderin.`2025-11-25`, doğrulayın `-32022`, onaylayın .`requested`Bu incelemeyi tekrarlıyor ve seçmelisiniz.`supported`- Evet .
3. Sunucu-Mint ekle `draftId`Bu işlemin neden bir protokol seansı yerine bir uygulama durumu olduğunu açıklayın.
4. Geri dön .`input_required`Kullanıcı onayına ihtiyaç duyan bir araçtan.`inputResponses`Giriş ve tam olarak`requestState`Bir sunucu-klient JSON-RPC talebi icat etmek yerine.
5. İki çağda bir stüdyo istemcisini çizin. Bir sonucu veya tanınan modern hatayı modern olarak değerlendirin ve geri dönüşe izin verin.`initialize`Sadece tanınmamış bir hata veya bir süreliğine.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## Daha Fazla Okumak

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
