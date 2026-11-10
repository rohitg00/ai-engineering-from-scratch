# MCP Transport: stdio ve stateless Streamable HTTP

> Transport MCP mesajlarını taşır.`2026-07-28`, yerel studio ve uzaktan Streamable HTTP her ikisi de kendi kendini tanımlayan istekleri taşır.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07 and 08
**Time:** ~65 minutes

## Öğrenme Hedefleri

- Yerel çocuk süreçleri için stdio ve ağ hizmetleri için Streamable HTTP seçin.
- Modern tek son nokta, sadece POST Streamable HTTP sözleşmesini uygulayın.
- MCP sürüm, yöntem ve isim başlıklarını JSON-RPC bedenine karşı aynalayın ve doğrulayın.
- İsteğe göre ve uzun ömürlü bir SSE teslimat `subscriptions/listen`Akışlar doğru.
- Geçmiş davranışları modern olarak sunmadan oturum tabanlı ve eski HTTP+SSE dağıtımlarını göç edin.

## Sorun

Daha önce Streamable HTTP revizyondaki protokol müzakereyi bağlantı ve oturum davranışıyla birleştirdi.`Mcp-Session-Id`, bağımsız bir GET akışını ortaya çıkarmak, seans sonlandırılması için DELETE'yi kabul etmek ve SSE'yi yeniden başlatmak için `Last-Event-ID`- Evet .

MCP `2026-07-28`HTTP başlıkları yönlendirme ve politika için seçilen alanları yansıtır, ancak sunucu bu başlıkları yürütmeden önce vücuda karşı doğruluyor.

Sonuç daha kolay ölçeklenebilir ve mantık yürütülür. Ayrıca 2025 nakliyeyi akım olarak öğreten bir sunucunun yanlış bir başarısızlık ve güvenlik modeli öğrettiği anlamına gelir.

## Anlaşım

### studio

Studio bağlaması, müşteri tarafından başlatılan bir alt işlem için:

- Müşteri, stdin'e her satırda bir UTF-8 JSON-RPC mesajı yazar.
- Sunucu, stdout'a her satırda bir UTF-8 JSON-RPC mesajı yazar.
- Server stderr'e teşhis yazıyor.
- Sistemi hızla stdin EOF'den çıkartıyor.
- Her modern talebinde `params._meta`- Evet .

Bu süreç birçok arama için geçerli olabilir, ancak bu modern bir protokol oturumudur. Beklenmedik bir şekilde çıkarsa, uçuşta yapılan istekler kaybolur.

### 2026-07-28'de akışlanabilir HTTP

Modern bir sunucu, bir MCP son noktasını ortaya çıkarır, örneğin `/mcp`, bu POST kabul eder.

Her JSON-RPC istek veya bildirim yeni bir HTTP POST'tur. Beden bir JSON-RPC mesajı içerir. Müşteriler sunucuya JSON-RPC yanıtları göndermez.

Bir istek için sunucu aşağıdakileri gönderir:

- `Content-Type: application/json`Bir JSON-RPC cevabı ile; veya
- `Content-Type: text/event-stream`Bu talebe ilişkin bildirimlerle, ardından son JSON-RPC cevabı ile birlikte.

Kabul edilen bir bildirim için, sunucu geri gönderir `202 Accepted`Cesetsiz.

Müşteriler her iki tepki türünü de reklam ediyor:

```http
Accept: application/json, text/event-stream
```

### Sadece POST, sadece POST anlamına gelir.

Modern Akışlı HTTP'nin bağımsız bir GET akışı ve DELETE oturum son noktası yoktur.

- `GET /mcp`Devamı`405 Method Not Allowed`- Evet .
- `DELETE /mcp`Devamı`405 Method Not Allowed`- Evet .
- `Mcp-Session-Id`İlgilenir ve asla kalıplanmaz.
- `Last-Event-ID`modern akışların yeniden başlatılamaması nedeniyle göz ardı edilir.

Eğer bir istek ölçeği akışı son cevabından önce kesilse, istemci bu uçuşta istek kaybetmiştir. Yeniden deneme güvenli olduğunda yeni bir JSON-RPC kimliği ile yeni bir istek gönderebilir. Akım yeniden başlatmaya çalışmamalıdır.

### Doğrulama

Sunucular onaylıyor `Origin`DNS yeniden bağlanmasını önlemek için gelen bağlantılardaki başlık mevcutsa ve açıkça izin verilmiyorsa, geri gönder `403 Forbidden`. Tarayıcı olmayan bir müşteri , bu bilgiyi kaybedebilmektedir .`Origin`, resmi taşıma kuralları tarafından izin verilir.

Yerel sunucular bağlanmalıdır `127.0.0.1`Ağ hizmetleri hala her istek için kimlik doğrulama ve yetki verilmesi gerektirir.

Kanonik yapılandırmadan sonra tam bir köken eşleşmesini kullanın.`origin.startswith("https://trusted.example")`Güvenli değiller çünkü saldırgan kontrolü altında olan ekleri kabul edebilirler.

### Gerekli HTTP metadata başlıkları

Her modern POST talebi şunları içerir:

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes_search
```

Başlık kuralları:

- `MCP-Protocol-Version`Gerekli ve eşit olmalıdır.`params._meta.io.modelcontextprotocol/protocolVersion`- Evet .
- `Mcp-Method`Gerekli ve JSON-RPC'ye eşit olmalıdır `method`- Evet .
- `Mcp-Name``tools/call`- Evet .`resources/read`ve`prompts/get`- Evet .
- `Mcp-Name`eşit `params.name`veya`params.uri`için`resources/read`- Evet .
- Başlık değerleri başlık isimleri başlıklara karşı duyarlı olmasa da, durumlara karşı duyarlıdır.

Güvenli olmayan veya ASCII olmayan `Mcp-Name`değerler tam UTF-8 Base64 sentinel kullanır:

```text
=?base64?{Base64EncodedValue}?=
```

Sunucu, bu değerleri vücutla karşılaştırmadan önce çözüyor.

Kayıp, yanlış biçimlendirilmiş veya eşleşmeyen ayna başlıkları HTTP'yi gönderir `400`JSON-RPC kodu ile `-32020`. Eğer başlık ve vücut sunucu desteklemeyen bir versiyon için anlaşılırsa, HTTP `400`- Evet .`-32022`ve tıpkı  gibi doğru hata verileri`{"supported":["2026-07-28"],"requested":"2027-01-01"}`- Evet .

Bilinmeyen modern bir yöntem HTTP ' i gönderir `404`JSON-RPC ile `-32601`JSON-RPC vücudu önemlidir çünkü iki çağ istemcisi onu modern bir hatayı eski bir son nokta eksikliği ile ayırt etmek için kullanır.

### İsteklere göre genişletilmiş SSE

Bir sunucu, uzun süreli bir talebe göre SSE'yi seçebilir:

```text
POST tools/call id=41
  <- notifications/progress related to id=41
  <- notifications/progress related to id=41
  <- JSON-RPC response id=41
stream closes
```

Sunucu bu akışta bağımsız JSON-RPC isteklerini göndermemelidir. Örnekleme, çıkartma ve kök etkileşimleri Multi Round-Trip Arama sonuçlarını kullanır. Cevap akışı kapatmak bu istekleri iptal eder.

SSE etkinlik kimliklerini tekrar oynatmak için eklemeyin. `Last-Event-ID`Tekrarlanmak modern revizyonun bir parçası değil.

### Uzun süreli değişiklikler abonelik/dinleme kullanımı

Değişiklik bildirimleri, bağımsız GET değil, istemci tarafından açılan bir istek kullanır:

```json
{
  "jsonrpc": "2.0",
  "id": "listen-1",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true,
      "resourceSubscriptions": ["notes://note-1"]
    },
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

POST cevabı uzun ömürlü bir SSE akışıdır.`notifications/subscriptions/acknowledged`- Kabul, her değişiklik bildirimi ve son sonuç taşıma`io.modelcontextprotocol/subscriptionId`İçeride`_meta`Sunucu SSE yorumlarını tutıcı olarak yayınlayabilir. Akış düştüğünde, istemci yeniden yayınlar `subscriptions/listen`Yeni bir talebinin kimliği ile ilgili verileri yeniden düzenle.

`resources/subscribe`ve `resources/unsubscribe`Modern bir bağlantıda kullanmayın.

### Açıkça başvuru durumu

Protokol seanslarını kaldırmak, durumla iş akışlarını yasaklamaz. Sunucu, bir açık olmayan durum elini çizebilir ve normal bir araç sonucu olarak geri verebilir. Müşteri, daha sonraki aramalarda açık bir argüman olarak bu elini geçer.

Elleri doğrulanmış başlık ile bağlayın, onları denememeden, sona erdirerek ve her kullanım için yetki verin. Bu durum, taşıma ilişkisinde gizlenmek yerine uygulama katmanında görünür hale getirir.

Gizli replik durumunun neden olduğu başarısızlık mekaniktir:

1. A talebi 1 kopyasına ulaşır ve bu sürecin hafızasında bir taslak oluşturur.
2. Cevap bir taslak eleştiriyi geri göndermez çünkü uygulanma bağlantıyı taslak tanımlamayı varsayır.
3. B talebi yeni bir POST ve 2'ye ulaşır.
4. Replik 2 geçerli protokol metadataları vardır ama taslakın adını ya da yüklenmesini mümkün kılmaz, bu nedenle iş akışı başarısız olur veya yanlış yerel nesne okur.
5. Yapışkan yönlendirme, bir yeniden başlatma, başlatma, yeniden planlama veya başarısızlık sonrası bir sonraki istek geçene kadar semptomları düzeltir.

Doğru sınırın iki parçası vardır. Protokol bağlamı her talepte kalır. Kalıcı uygulama durumu, müşterilere gönderilen bir sunucu-minted eldiven altında paylaşılan bir mağazada yaşar. Bir sonraki çağrıda, her kopya aynı kayıtları yükler ve yetki kayıtları doğrulanmış ana ve kiracıya bağlar. Replik belleği bir kaydı önbelleğe koyabilir, ancak doğruluk için gerekli olan tek kopya olamaz.

Durum mekanizmasını ömür boyu seçin. İstediği yerel değişkenler bir çağrıya hizmet verebilir. Kısa bir MRTR devamı bütünlük korunan bir uygulama kullanabilir `requestState`. Bir taslak veya kalıcı görev açık bir eleştiri, ayrıca paylaşılan kalıcılık, sona erme, eşzamanlılık kontrolü ve idempotency gerektirir.

### HTTP çift çağ uyumluluğu

Modern ve eski sunucuları destekleyen bir istemci önce modern bir POST dener.`400`- Evet .`404`veya`405`, cesedi kontrol eder:

- Bilinen modern JSON-RPC hatası sunucunun modern olduğunu kanıtlar.
- Boş bir vücut veya tanınmamış bir cevap, eski bir HTTP+SSE sunucusu gösterir.`endpoint`olay.

Bir sunucu, modern metadataları modern POST uygulamasına yönlendirerek ve eski müşteriler için ayrı eski son noktaları korarak göç sırasında her iki dönemi destekleyebilir.`2026-07-28`- Evet .

```figure
tp-transport-handshake
```

## Kullan

`code/main.py`Python standart kütüphanesi ile sınırlı, modern Streamable HTTP sunucusu uyguluyor.`subscriptions/listen`SSE akışı.

```bash
cd code
python3 main.py --probe
npx tsx main.ts --probe
python3 -m unittest discover tests -v
```

Sonda kontrolü:

- geçersiz bir köken reddedildi;
- Bir seans kimliği olmadan keşif başarılı olur;
- `Mcp-Session-Id`ve `Last-Event-ID`İlgilenmezler.
- Başlık eşleşmezliği gönderir `-32020`- ...
- Desteklenmeyen versiyonları gönderir `-32022`Tam olarak`supported`ve `requested`veriler;
- kabul edilen bir idsiz bildirim HTTP'yi gönderir `202`Vücutsız;
- GET ve DELETE geri dönüşü`405`- ...
- `subscriptions/listen`onay, bildirim ve nihai sonuçları abonelik kimliği taşıyan bir POST cevap akışıdır.

## Gönder

Bu ders gemileri `outputs/skill-mcp-transport-migrator.md`Modern protokol seanslarını kaldırır, başlık-vücut doğrulama ekler, bağımsız GET'i `subscriptions/listen`, ve her miras köprüyü görünür olarak ayırır.

## Egzersizler

1. Çıkar `Mcp-Method`HTTP'yi onayla`400`ve hata .`-32020`- Evet .
2. Eşleşen başlık ve vücut versiyonunu gönder `2027-01-01`HTTP ' i onayla .`400`, hata`-32022`, ve kesin veriler .`{"supported":["2026-07-28"],"requested":"2027-01-01"}`- Evet .
3. Base64 nöbetçisi gönder .`Mcp-Name`ASCII olmayan bir kaynak URI için.`params.uri`- Evet .
4. Son cevabından önce son dinleme akışını kes ve yeni bir JSON-RPC kimliği ile yeniden yayınla ve yeniden düzenle araçları.
5. Ping aracına açık bir iş akışı elini ekle. Bağlantı afinitesini kullanmadan bir yetki konusu ile bağla.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| stdio | Newline-delimited JSON-RPC over a client-launched subprocess |
| Streamable HTTP | Single endpoint where each modern message is a new POST |
| Request-scoped SSE | POST response stream containing related notifications and final response |
| `subscriptions/listen` | Long-lived POST request for opted-in change notifications |
| Header mismatch | HTTP `400` and JSON-RPC `-32020` when mirrored headers disagree with body |
| Origin validation | DNS-rebinding defense for incoming connections, not authentication |
| Explicit state handle | Application token passed as an ordinary argument instead of hidden session state |
| Legacy bridge | Separate earlier-era behavior kept only for compatibility |

## Daha Fazla Okumak

- [MCP Transport Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
