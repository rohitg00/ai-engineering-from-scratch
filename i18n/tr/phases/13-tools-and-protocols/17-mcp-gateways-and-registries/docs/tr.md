# Ülkesiz MCP Girişleri ve Kayıt Girişi

> Bir geçit her yolu açık olmalıdır. 2026-07-28 protokolü, bir taşıma oturum olmadan ona yöntem, isim, sürüm, yetenek, kimlik, önbelleği ve iz sınırları verir.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 15 (security), Phase 13 · 16 (authorization)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Sessiyon yakınlığı olmadan bir 2026-07-28 son noktasının arkasında birkaç MCP sunucusu toplayın.
- Politika veya göndermeden önce, istek başına metadata ve yönlendirme başlıklarını doğrulayın.
- Durgan isim boşlukları, belirleyici sırayla, tanımlayıcı çubukları, RBAC ve özel önbelleği ile araçları birleştirin.
- Kayıt kayıtlarını hala kabul politikası gerektiren bir keşif kanıtı olarak değerlendirin.
- Yol istekleri doğrultusunda yapılan SSE, `subscriptions/listen`MRTR tekrar denedi ve Görevler uzantısı doğru çağrılar yaptı.
- Eskiden gelen el sıkışması ve seans desteği modern yollardan uzaklaştırın.

## Sorun

Bir istemciyi doğrudan bir sunucuya bağlamak basit. Daha büyük bir dağıtım daha zor sorulara tutarlı bir cevap gerektirir:

- Hangi sunucular izin veriliyor?
- Hangi müdür her aletini görebilir ve arayabilir?
- İki arka plan aynı ismi ortaya çıkarınca ne olur?
- Deskriptör değişiklikleri nasıl gözden geçirilir?
- Sıfır limitleri ve denetim olayları nerede uygulanır?
- Bir örnek sonraki talebi karşılayabilir mi?

Bir geçit, müşteri ve arka uç MCP sunucuları arasında yer alır. Bir MCP son noktasını sunar, çapraz politika uygulayar ve onaylanmış istekleri gönderir.

Eski geçit tasarımları genellikle bir istemci oturumunu birkaç arka uç oturumuna çoğaltır ve yeniden yazılır `Mcp-Session-Id`2026-07-28 çekirdeğinde protokol seansları yok.

## Anlaşım

### Modern kapı yolu

Her talebe göre:

1. Taşıma izni ile ilgili başkasının kimliğini doğrulayın.
2. Geçerlileştir`MCP-Protocol-Version`- Evet .`Mcp-Method`- Evet .`Mcp-Name`ve`params._meta`- Evet .
3. Anahtar, kaynak, yöntem, araç ve argümanları yetkilendir.
4. Deskriptör, kayıt, oran ve veri politikasını uygulayın.
5. Seçilen arka uç için yeni, bağımsız bir talebi oluşturun.
6. Arka son sonucu doğrulanır ve bir geçit sonucu gönderir.
7. Gizlilik kayıtları olmadan bir denetim olayını kaydet.

Hiçbir adım gizli protokol seansına ihtiyaç duymaz. Uygulama durumu hala veritabanlarında, açık tutumlarda, Görevlerde veya bütünlük korunan MRTR durumunda olabilir.

### Çalışma süresi politikası ana kapı kararıdır

Giriş, geçit kapısına hangi arka uç sürümünün girebileceğini belirler. Canlı bir arama yetkisi vermez. Her istek için, geçit, doğrulanmış ana, emiten ve kaynak, kiracı, eşleşen yöntem ve isim, normal argümanlar, kabul edilen tanımlayıcı pin, mevcut arka uç sağlığı, kapasite kesişimi, veri sınıflandırması, oran durumu ve herhangi bir eylemle bağlı onaytan politikaları yeniden hesaplar.

Bu sipariş önemlidir. Bir kullanıcı rolü iptal edildiği sürece bir kayıt kaydı aktif kalabilir. Bir hedef argümanı kiracı sınırı geçtikçe bir tanımlayıcı sabit kalabilir. Bir arka uç olay politikası karantineler devleti değiştiren çağrılar sırasında onaylanmaya devam edebilir. Bu nedenle çalıştırma zamanı politikası, giriş olarak kayıt ve tanımlayıcı kanıtları ile öncelikli izin veya reddetme kararıdır.

İzin verme kararı bağlantı veya kaldırılmış oturum kimliği altında önbelleğe alınmamalıdır. Eğer politika bulunmazsa, operasyon sınıfı açısından açıklanmış bir başarısızlık politikasına uyun. Güvenli bir özelliğin, devlet değişiklikleri ve hassas okumalar için kapatılmamasıdır. Açıkça onaylanmış kamu okuma yolları, kısa süredir bilinen son politikaları ancak risk modellerinin izin verdiği zaman kullanabilirler. Hangi politika sürümü ve başarısızlık yolu karar verdiğini kaydet, sonra geri dönüşe dönmeden önce arka uç sonucu doğrulayın.

### Bir POST son noktası

Modern Streamable HTTP, her JSON-RPC mesajını POST üzerinden gönderir:

```text
POST /mcp
Authorization: Bearer <gateway-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.search
Accept: application/json, text/event-stream
```

Geçit, bu POST için JSON veya talep-skalatlı SSE'yi geri verebilir. GET ve DELETE modern istekler için 405'i geri verebilir. `Mcp-Session-Id`ve `Last-Event-ID`yetki, yakınlık veya tekrar davranış yaratmayın.

Başlık ve vücut değerleri aynı olmalıdır.`-32020`Bu, yük dengeleyici, geçit ve hız sınırlayıcılarının tüm vücutları analiz etmeden ve sonundan sonuna kadar bütünlüğü korurken yönlendirilmesine olanak sağlar.

Bir tam sırada doğrulanır: JSON-RPC ve metadata türleri, başlık ve vücut eşitliği, ardından eşleşen sürüm için destek.`-32020`. Başlık ve vücut desteklenmeyen bir versiyon için anlaşılırsa, HTTP 400'i  ile geri gönderin.`-32022`ve `data`Tam olarak .`{"supported":["2026-07-28"],"requested":"<actual>"}`Bilinmeyen bir yöntem HTTP 404 ' i  ile gönderir .`-32601`- Evet .

`ProtocolError`seçmeli taşıyor `data`, ve geçit onu JSON-RPC hatası nesneye serilize eder.`id`Bu nedenle, hiçbir zaman JSON-RPC başarısı veya hatası almaz. Kabul edilen HTTP bildirimi boş bir vücutla 202'yi gönderir.

### Her katman üzerinde keşif uygulaması

Geçit uygulamaları `server/discover`Ayrıca her arka uçı keşfeder, böylece protokol sürümlerini, özelliklerini ve uzantıları bilir.

Örnek geçit sonucu:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": true}
  },
  "ttlMs": 30000,
  "cacheScope": "private",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "enterprise-gateway",
      "version": "2.0.0"
    }
  }
}
```

Geçit kapısı tarafından onurlandırılabilen yalnızca yetenek kesişimi reklam edin. Bir arka uç özelliği otomatik olarak açığa çıkarmak için güvenli değildir.

`serverInfo`Kendini ifade eden görüntüleme ve teşhis verileri.

### İstek başına müşteri yetenekleri

Gönderilen her talebin bir güncelleme ihtiyacı vardır `_meta`zarf:

```json
{
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    "name": "enterprise-gateway",
    "version": "1.0.0"
  }
}
```

Dış istemci yeteneklerini bir arka uçta körü körü körü körü körü kopyalamayın. Geçit arka uçun istemcisidir. Sadece reklam özellikleri geçit doğru bir şekilde aracılık edecek.

### Deterministik isim aralığı

Dayanıklı kamu isimleri altında arka uç araçları birleştirin:

```text
notes.search
notes.create
issues.list
issues.open
```

Bir kamu adı ile arka uç ve orijinal araç adı arasında bir harita tutun. İlk veya son çarpışma asla seçmeyin. Bir kamu adı onay ve denetim sözleşmesinin bir parçasıdır, bu yüzden değiştirmek bir göçtür.

`tools/list`Görünümlilik, temel olarak farklı olduğunda, geri dönüş`cacheScope: private`- Bir sınırlı .`ttlMs`kullanıcı özel bir listenin yetki bağlamlarında sızmasına izin vermeden arka uç keşif yükünü azaltır.

Her açık araç tanımlayıcıda sabit bir isim, açıklama ve nesne kökü bulunur `inputSchema`. Ad aralığı gerekli tanımlayıcı alanlarını kaldıramaz.`resultType`, sunucu kimliği metadataları ve önbelleğe işaretler.

### Çaplak onaylı tanımlayıcılar

Giriş sırasında, tamamı tanımlayıcıyı kanonikleştirin ve onun içeriklerini uygun kamu adı altında saklayın.

Değişirse:

- Çıkarın .`tools/list`- Evet .
- Doğrudan aramaları reddet.
- Bir denetim etkinliği yapın.
- Pinna güncelleştirmeden önce politika veya insan onayını gerektirir.

Bir geçit, yararlı bir merkezi uygulama noktasıdır, ancak ilk kez görülen bir tanımlayıcıyı güvenli bir hale getirmez.

### Kayıtlar karar vermek yerine keşfetmeye yardımcı olur.

Bir Kayıt`server.json`Paket desteklenen bir kayıt şöyle görünebilir:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.example/notes",
  "description": "Example notes MCP server.",
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/notes-mcp",
      "version": "1.0.0",
      "transport": {"type": "stdio"}
    }
  ]
}
```

Yayınlama metadataları geçit güvenliğinin kararını taşımaz.

```json
{
  "registryName": "com.example/notes",
  "registryVersion": "1.0.0",
  "publisher": {"namespace": "com.example", "status": "verified"},
  "provenance": {
    "source": "registry.modelcontextprotocol.io",
    "recordId": "com.example/notes@1.0.0"
  },
  "admission": {"status": "approved", "reviewedBy": "gateway-policy"}
}
```

Kapı kontrolü .`server.json`Kapı hala kabul politikasına ihtiyaç duyar.

Her kabul edilen arka uç için kayda:

- Tam kayıt ve kayıt kimliği.
- Verified publisher namespace veya domain evidence.
- Taşıma ve son noktası izin verilir.
- Dönüştürülmüş versiyon veya onaylanmış yükseltme politikası.
- Sanat veya tanımlayıcı sindirme.
- Yetki veren ve kaynak.
- Eleştirmen, onaylama süresi ve sona ermesi.

Serverenin gösterim adının tanıdık bir ürüne benzediği için kabul edilmemesi. Kayıt varlığını operasyonel güvenlik incelemesi olarak görmemesi gerekir.

Bu ders geçit dikişini uyguluyor: bir arka uç yönlendirici olmadan önce yayın kanıtlarını yerel kabul ile birleştirin. [Lesson 30: MCP Registry Supply Chain, Admission, Drift, and Rollback](../../30-mcp-registry-supply-chain-and-drift/docs/en.md)Tam bir isim alanı kanıtı, eserlerin kökeni, değişmez pinler, canlı açıklayıcı sürüşü, kayıt durumunun uzlaştırılması, bir yanlış kanıtlı kabul defteri ve kanıt desteklenen geri dönüş için tam kontrol düzeni oluşturur.

### İttifak aracılığı

Geçit, aramacılarını doğruluyor ve arka planlarda ayrı olarak doğruluyor.

Bu bağlamaları açık tutun:

```text
outer principal -> gateway role and policy
backend issuer + resource -> backend registration and token
```

Bir kaynak veya emitenin dışında bir destek simgesi asla kullanılmasın. Bir araç bir son kullanıcı adına hareket ederse, kullanıcıyı paylaşılan bir hizmet kimliği ile taklit etmek yerine, bu delegasyonu tasarlanmış bir değişim veya talep modeli ile koruyun.

### Sessiyonlar olmadan oran sınırları

Kimlik sınırları, kimlik doğrulanmış bir başlık, emiten, kaynak, kamu aracı, maliyet sınıfı ve zaman penceresi ile belirlenir.

Pahalı iş yapmadan önce ucuz onaylama uygulayın. İptal edilen çağrıların kötüye kullanma sınırları, iş kvotaları veya her ikisinin de dahil olup olmadığını belirleyin.

### Karar zincirini denetleme

Bir çağrıyı yeniden yapılandırmak için yeterli kayıt:

- İstek ve iz kimlikleri.
- Doğrulanmış başlık ve emiten.
- Kamu aracı ve arka uç yolu.
- Descriptor pin versiyonu.
- Politik karar ve neden.
- Gecikme ve sonuç sınıfı.
- MRTR yuvarlak veya görev kimliği, gerektiğinde.

Redakt taşıyıcısı simgeler, yetki kodları, yenilenme simgeler, çiğ sırlar ve gereksiz hassas argümanlar.

### İsteklere göre genişletilmiş SSE

Normal bir POST, bu tek talepte iş akışları sırasında istek skenali SSE'yi geri verebilir. Cevap akışı kapatmak uçuşta bulunan modern HTTP isteklerini iptal eder.

Ayrı bir GET akışı oluşturmayın ve Son Olay-İtirafı tekrarlamasını söz vermeyin.

### Uzun süreli değişiklik bildirimleri

Listeler ve kaynak değişikliği bildirimleri için, mevcut bir istemci gönderir `subscriptions/listen`Uygulama filtreleri tam düz alanları kullanır `toolsListChanged`- Evet .`promptsListChanged`- Evet .`resourcesListChanged`ve`resourceSubscriptions`- ...

```json
{
  "jsonrpc": "2.0",
  "id": "listen-tools",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

İlk etkinlik desteklenen alt kümeni tanır. Abonelik tanımlayıcısı akışı açan isteklerin JSON-RPC kimliği:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": "listen-tools"
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

Geçit, daha sonra sadece kabul edilen değişiklik türlerini gönderir.`io.modelcontextprotocol/subscriptionId`İçeride`params._meta`. Otomatik tekrar çalma veya otomatik yeniden dinleme yoktur. Yeniden bağlandığında, istemci aboneliği yeniden açar ve güvendiği listeleri yenilendirir. Bir sunucu tarafından başlatılan şık kapanma aynı abonelik kimliği ile etiketlenen son tam bir sonuç verir.

Modern yol değiştiriyor .`resources/subscribe`- Evet .`resources/unsubscribe`Bu türleri sadece eski bir versiyon kapalı yollarda tutun.

### MRTR bir kapıdan geçiyor.

Bir arka uç geri döndüğünde`resultType: input_required`, geçit sadece dış istemci gerekli giriş istekini desteklediğinde bu sonucu gönderebilir.`requestState`Kapı geçidi etkileşimi kasıtlı olarak sona erdirmez ve yeniden yayınlamazsa.

Müşteri orijinal kamu aracı yeni bir JSON-RPC kimliği ile yeniden dener ve `inputResponses`Giriş geçidi yeniden denemeyi onaylar, aynı kamu rotasını kontrol eder ve daha sonra yeni bir arka uç talebi gönderir.

### Görevler uzantı yönlendirme

Görevler, resmi bir uzantı olarak belirlenmiştir.`io.modelcontextprotocol/tasks`- Bunlar temel seansın yerine geçmez.

Müşteri, istemci özelliklerinin içinde uzantıyı açıklar ve geçit, yaşam döngüsünü sonuna kadar koruyabildiği zaman keşfede reklam eder.`tools/call`, sıradan sonucu geri göndermek mi , yoksa geriye dönmek mi , tek başına geriye döner.`resultType: task`Bir görev sonucu `taskId`- Evet .`status`, zaman damgaları,`ttlMs`, ve bir seçeneği `pollIntervalMs`Bu görev, sonuç gönderilmeden önce kalıcı olarak okunur.

Geçit, açık olmayan görev tanımlayıcısı için doğrulanmış ana ve arka uç yolu kaydeder.`tasks/get`- Evet .`tasks/update`ve`tasks/cancel`Çağrı kullanımı `params.taskId`- Evet .`Mcp-Name`, bu da aracılara bir yönlendirme anahtarı verir. `tasks/get`Devamı`resultType: complete`Geçerli görev durumuna göre, son sonuç veya protokol hatası terminal durumunda yer alır. `tasks/update`Anahtarlı gönderir `inputResponses`Bekleyen görev girişleri için ve boş bir tam onay gönderir. `tasks/cancel`İşin durdurulması için bir garanti değil, boş bir tam onayla işbirliği niyeti.

Yeni uygulama yapmayın `tasks/list`veya `tasks/result`Bu yöntemler daha eski deneysel modellere aittir.`tasks/get`Müşteri onlara cevap verir .`tasks/update`Bu nedenle, bu işlemin başlatılması için, öncelik verilen işlemleri tekrar yaparak değil, orijinal araç çağrısını tekrar denerek yapılır.

Kalıcı görev rotası durumu, bir protokol oturumunun değil, görev eleştirici tarafından anahtarlanmış uygulama veridir.

### Uygunluk sınırı

Giriş kapısı eski bir müşteriye veya arka uçlara hizmet etmek zorunda ise:

- Çağı açıkça tespit et.
- Başlangıç, nakliye seansları, GET akışları, kaynak abonelikleri ve eski görev sözlüklerini eski bir adaptörün içinde tutun.
- Asla eski bir oturum kimliğini modern yönlendirme veya yetki vermeye sızdırmayın.
- Sessiz bir derecelendirme yerine sınırlı bir keşif sonde ve açık bir geri dönüş politikasını tercih ederim.

```figure
t3-gateway-funnel
```

## Yapın

`code/main.py`Bu uygulama, bir süreç protokol geçidi ve iki arka uç sunucusu uyguluyor. Her arka uç yeni bir akım protokol istekini alır.`tools/list`, isim aralığı yönlendirme, Kayıt`server.json`Eksteneksel kabul durumu, tanımlayıcı çubukları, RBAC, temel anahtar oran sınırları, denetim kararları ve bir modelli `subscriptions/listen`SSE onayını.

Modelle analiz edilen istek organları, yönlendirme başlıkları ve doğrulanmış bir taşıyıcı kimliği bulunmaktadır.`Content-Type`Ya da tam .`Accept`Ders 09'un Akışlanabilir HTTP adaptörüne bağlayın, bu da `Content-Type: application/json`ve bir `Accept`her ikisini içeren değer `application/json`ve `text/event-stream`- Evet .

Çek şunu:

```bash
cd phases/13-tools-and-protocols/17-mcp-gateways-and-registries
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Demo, dış talep kimliğini ve yeni arka uç talep kimliğini yazdırır. Böylece devletsiz hop görünür.

## Kullan

İşlemdeki arka uç nesneleri gerçek akım protokolü istemcileri ile değiştirin.

- Bağlantıdan önce giriş kaydı.
- - Yetenek açısından daha önce arka plan keşfi.
- Yetkinlikten önce yetkili kamu adı.
- Listeden veya çağrıdan önce tanımlayıcıyı işaretle.
- İletişimden önce talep edilen metadatalar.
- Geri dönüşten önce sonuç doğrulanması.

## Gönder

Bu ders gemileri `outputs/skill-gateway-bootstrap.md`Giriş, keşif, kabul, isim alanları, yetki, önbelleğe kaydetme, akış, abonelik, MRTR, Görevler, gözlemlenme ve miraslı izolesiyonu kapsadığı modern bir geçit tasarımı üretir.

## Egzersizler

1. Dış ve gönderilen talep metadatalarına iz bağlamı ekleyin ve ilişkiyi denetim olayında kaydetin.
2. Görevler için uygun bir arka uç ve yön ekle `tasks/get`Görev kimliği ile `Mcp-Name`- Evet .
3. Bir arka uç açıklayıcıyı değiştir ve hem keşif hem de doğrudan arama engellendiğini kanıtla.
4. Anahtar özel bir sunucu yeteneği ekleyin ve keşif neden özel olarak önbelleğe tutulması gerektiğini açıklayın.
5. Modern bir adaptörye herhangi bir eski durum eklemeden eski bir adaptör arayüzü yazın `Gateway`Sınıf.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| MCP gateway | Policy and routing server between clients and backend MCP servers |
| Admission record | Evidence and policy decision allowing one backend into the gateway |
| Qualified tool name | Stable public route such as `notes.search` |
| Descriptor pin | Approved digest checked during discovery and dispatch |
| Private cache scope | Cached result restricted to one authorization context |
| Request-scoped SSE | Streaming response attached to one POST request |
| `subscriptions/listen` | Client-opened SSE stream for selected long-lived change notifications |
| Task route | Application mapping from an opaque task id to its backend |
| Legacy adapter | Explicit version-gated boundary for old handshake and session behavior |

## Daha Fazla Okumak

- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
