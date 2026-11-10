# Ülkesizler Protokolü Üzerindeki MCP Uygulamaları

> Bir etkileşimli sonuç hala bir MCP aracı ve kaynak değişimi. 2026-07-28 çekirdeği bu değişimi kendi kendine içerirken, Apps uzantısı kum kutulu tarayıcı yüzeyini ekler.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- MCP Uygulamalarını  üzerinden reklamlandırın`server/discover`ve talep üzerine uzatma yetenekleri.
- Bir `ui://`Bir araç çağrılmadan önce bir araç üzerinde kaynak kullanmak.
- 2026-07-28'deki devletsiz tel üzerinde tüm araç ve kaynak sonuçlarını geri gönderin.
- Uygulamaları Ayrılayın `ui/initialize`Kaldırılmış MCP çekirdeği el sıkışmasından gelen köprü mesajı.
- Kaynak doğrulama, kum kutu, CSP ve en az ayrıcalıklı izinler uygulayın.

## Sorun

Metin sonucu bir zaman çizgisini tanımlayabilir. Kullanıcıya filtreleyebilir, kontrol edebilir veya hareket edebilecek bir zaman çizgisini veremez.

MCP Apps, sunum sorunuyu seçmeli bir uzantı ile çözüyor.`ui://`Kullanıcı, araç çalıştırılmadan önce bu kaynağı alabilir ve gözden geçirebilir, sandboxed iframe'de görüntüleyebilir ve tüm uygulama eylemlerini JSON-RPC köprü üzerinden aracılık edebilir.

2026-07-28'de temel protokol değiştirildi.

- Yüklü bir çekirdek yok .`initialize`talebiniz veya`notifications/initialized`bildirim.
- - Hayır .`Mcp-Session-Id`Başlık.
- Her talepte protokol versiyonu ve istemci özellikleri bulunmaktadır.`params._meta`- Evet .
- Bir sunucu uygulaması `server/discover`Böylece müşteriler versiyonları, temel özellikleri ve uzantıları kontrol edebilirler.
- Her başarılı sonuç bir `resultType`ayrımcılık.
- Akışlanabilir HTTP, istek başına bir POST kullanır. Modern GET ve DELETE giriş noktaları 405'i gönderir.

Apps köprüde hala adı verilen bir yöntem var `ui/initialize`İframe mesaj sonrası diyaloguna aittir.

## Anlaşım

### İki protokol, bir özellik

Katmanları açık tut:

1. MCP çekirdeği taşıyor `server/discover`- Evet .`tools/list`- Evet .`tools/call`- Evet .`resources/list`ve`resources/read`- Evet .
2. MCP Apps uzantısı kullanıcı aracını açıklar ve iframe-host köprüsünü tanımlar.
3. Tarayıcı sandbox kuralları kullanıcı aracının ulaşabildiğini sınırlıyor.

Uzatma tanımlayıcısı `io.modelcontextprotocol/ui`Her bir istek için bir istemci, özellikler nesnesinin içinde uzantı desteği gönderir:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {}
        }
      },
      "io.modelcontextprotocol/clientInfo": {
        "name": "timeline-host",
        "version": "1.0.0"
      }
    }
  }
}
```

`clientInfo`Bu, kendiliğinden bildirilen veriler, yetki kimliği değil.

### Yükleme öncesi keşfet

Sunucunun keşif sonucu uzantıyı reklam eder:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {},
    "resources": {},
    "extensions": {
      "io.modelcontextprotocol/ui": {}
    }
  },
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "timeline-app-server",
      "version": "2.0.0"
    }
  }
}
```

Sunucu keşif desteklemesi gerekir. Bir istemci her eylemden önce keşif çağrısı yapmak zorunda değildir çünkü her eylem kendi yeteneklerini taşır.

### Araç tanımlamasında kullanıcı arayüzünü bildir

Modern Apps sözleşmesi bir UI 'yi araçla bağlar `tools/list`- ...

```json
{
  "name": "notes_timeline",
  "description": "Render a timeline of notes.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline.html"
    }
  }
}
```

Bu kasıtlı olarak çağrı öncesi metadata. Host, bir sonuç görüntülemesini istemekten önce HTML'i önceden yükleyebilir, önbelleğe kaydediyor ve güvenlik değerlendirmesini yapabilir. Eski düz metadata anahtarları uyumluluk kodu tarafından kabul edilebilir, ancak yeni sunucular yuvalanmış olan metadataları yayımlamalıdır.`_meta.ui.resourceUri`- Şekil.

`tools/list`- Deterministik sıralama dahil,`ttlMs`ve`cacheScope`Kullan .`private`Görünen araçlar kullanıcı veya token'a göre değişirken.

### Verileri geri gönderin, sonra konuksever görünümü bağlasın

Araç çağrısı sıradan içeriği ve yapılandırılmış verileri gönderir:

```json
{
  "resultType": "complete",
  "content": [
    {"type": "text", "text": "Timeline ready."}
  ],
  "structuredContent": {
    "notes": [
      {"id": "note-1", "title": "Discover", "created": "2026-07-28"}
    ]
  },
  "isError": false
}
```

Ev sahibi, araçtan hangisinin görüntüsünü bildiğinden, URI'yi tekrarlamak için yeni bir içerik blokunun icat edilmesini önleyin.

### Uygulama kaynak olarak kullan

Sunucu reklamlar yapıyor `resources`Bu yüzden zorunlu olanları da uyguluyor.`resources/list`Deterministik listesi girişinde kanonik URI, sabit bir isim, açıklama ve MIME tipi bulunur.`resultType`, sunucu kimliği metadataları, `ttlMs`ve`cacheScope`, tıpkı belirleyici araç listesi gibi.

Ev sahibi gönderir .`resources/read`. Streamable HTTP'de, talebin:

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: resources/read
Mcp-Name: ui://notes/timeline.html
```

Başlık değerleri ve JSON-RPC vücudu eşleşmelidir.`-32020`- Evet .

Sonuç HTML kaynağı ve önbelleği ipuçları içerir:

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "ui://notes/timeline.html",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<!doctype html>...",
      "_meta": {
        "ui": {
          "csp": {
            "connectDomains": [],
            "resourceDomains": [],
            "frameDomains": [],
            "baseUriDomains": []
          },
          "permissions": {}
        }
      }
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

### Kullanılabilir içeriğe göre UI kaynaklarını önbelleğe koy

Bir uygulama kaynağı sıradan bir proza ile değiştirilmez. Kaş girişinin köprü kodu, araç verilerini göstermek ve host aracılığıyla eylemleri talep edebilmesi için kullanılabilir.`ui://`URI, kabul edilen sunucu kimliği ve sürümü, kaynak içeriği sindirme ve yetki bağlamı`cacheScope`Özel bir uygulama kaynağını asla başlıklar arasında yeniden kullanmayın çünkü HTML veya politika metadataları URI aynı olduğunda bile farklı olabilir.

Girişi geçersiz kılmak için `ttlMs`Sonun geldiğinde, aletin kullanımı biter.`_meta.ui.resourceUri`Bağlayıcı değişiklikler, sunucu sürümü veya kabul edilen açıklayıcı pin değişiklikleri veya kabul edilen bir kaynak değiştirme aboneliği URI isimlerini değiştirir. Yeniden yüklenmeden önce CSP ve izin incelemesini yeniden uygulayın ve tekrar uygulayın. Eski bir iframe, yeni bir kaynak sürümü henüz yüklenmediği için daha geniş izinleri tutmamalıdır.

### Özellik politikası öncesi kablo belirsizliklerini reddet

Validasyon, kasıtlı bir sıraya sahiptir. Önce JSON-RPC şeklini doğrulayın ve bir string protokol metadata ve nesne istemcisi yetenekleri haritasını gerektirin. Daha sonra yönlendirme başlıklarını vücut ile karşılaştırın. Sadece o zaman eşleşen protokol sürümünün desteklendiğine karar verin. Bu sırayla bir vekil ve sunucu farklı istekleri yorumlamayı engeller.

| Condition | HTTP | JSON-RPC error |
|-----------|------|----------------|
| Header and body version, method, or name disagree | 400 | `-32020` |
| Header and body agree on an unsupported version | 400 | `-32022`, with `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}` |
| `resources/read` lacks the Apps extension capability | 400 | `-32021`, with `data.requiredCapabilities.extensions.io.modelcontextprotocol/ui` |
| Method is unknown | 404 | `-32601` |

JSON-RPC bildirimi bulunmuyor `id`HTTP'nin kabul edilen bir bildirimi boş bir vücutla 202'yi gönderir. Bir hata HTTP durumunu değiştirebilir, ancak yine de bir bildirim için JSON-RPC hata vücudu oluşturulamıyor.

### Kum kutusu bir sınır, güven kararı değil.

Bir host iframe'i kontrol eder. Uygulama doğrudan host çerezlerini, yerel depolama veya sayfa DOM'i okuyamıyor. Tüm ayrıcalıklı iş köprüden geçmelidir.

Bu öntanımlı seçenekleri kullan:

- Tüm CSP alan listelerini boş bırakın, sonra sadece uygulamanın ihtiyaç duyduğu kökenleri ekleyin. Kullan `connectDomains`Getch, XHR ve WebSocket için kullanın `resourceDomains`senaryolar, stiller, resimler ve şriftler için.
- Kullanılabilir olduğunda kod ve verileri birleştir.
- Görünen bir özelliğin bunu istemediği sürece kamera, mikrofon veya konum izinini istemeyin.
- Çubuk`postMessage`Tam eşcinsel kökenle ve diğer kökenlerden olan olayları reddetmek.
- Araç argümanlarını, araç sonuçlarını, kaynak metnini ve köprü mesajlarını güvenilmeyen giriş olarak değerlendirin.
- Kullanıcı onayını ev sahibi içinde tutun. iframe kendi sonuç eylemini onaylayamaz.

Bir sabit kopyalama .`sandbox`Ev sahibi, uygulamanın köken modeline ve kendi izole tasarımına göre bayraklar seçmelidir.

İzin verilen bir alan hala bir çıkış yolu.`connectDomains: ["https://api.example.com"]`Yani uygulamada çalıştırılan herhangi bir senaryo izin verilen verileri gönderebilir. Doğrudan eşleşme, destinasyon karışıklığını önler, ancak yararlı yükün uygun olup olmadığını belirlemez. Bağlantı erişimini varsayılan olarak boş tutun, iframe'ye taşıyıcı tokenlerinin yerleştirilmesini önleyin, pratik olduğunda host üzerinden proxy dar işlemleri, cevap ve talep boyutlarını sınırlayın ve her çıkış talebi hangi kullanıcı eyleminin neden olduğu denetlensin. Tedavi et .`resourceDomains`ayrı olarak `connectDomains`; Bir yazı tipi veya senaryo yükleme izninin keyfiyetli veri yüklemeyi sağlaması gerekmez.

### Apps köprüsü kendi yaşam döngüsüne sahiptir .

Apps köprü JSON-RPC dili üzerinde `postMessage`- Değişimi yapabilir .`ui/initialize`ve `ui/*`bildirimleri ve proxy gibi çekirdek görünümlü yöntemleri kullanabilir.`tools/call`- Evet .

Görüş gönderir `ui/initialize`- Evet .`appInfo`ve bir `appCapabilities`host özelliğini ve host bağlamını gönderir. Sadece bu cevabın ardından View gönderir `ui/notifications/initialized`Ev sahibi, görüntülemeye mesaj göndermeden önce bu uygulama bildirimini beklemeli.

Bu yerel el sıkışması bir iframe ile bir host çerçeve arasında bir köprü oluşturur. MCP protokol versiyonunu müzakere etmez, sunucu durumunu oluşturmaz veya bir nakliye oturumunu oluşturmaz. Tam ön öncüye dikkat edin: çekirdek `notifications/initialized`Apps `ui/notifications/initialized`Köprüli bir araç çağrısı tarafından oluşturulan bir temel talep, yeni bir JSON-RPC kimliği ve tam talep metadataları ile yeni bir bağımsız bir istektir.

### Ev sahibi bağlamı, eylemler ve iptal

Host, köprü başlangıcından sonra yetki sahibi olmaya devam eder. Bir View, bir araç eylemini, gezintiyi, klipboyu kullanımı veya başka ayrıcalıklı bir etkiyi yalnızca host'ın reklamladığı bir yetenekle talep edebilir. Host, yazdırılmış talebi, mevcut kullanıcıyı, hedefi ve argümanları onaylar, onay politikasını uygulaır ve reddedebilir. Bir düğme tıklaması ve geçerli köprü mesajı açık niyet; hiçbirisi yetki vermez.

Bir kerelik render girişleri yerine konuyu, boyutunu ve erişilebilirliği sunucu bağlamını değiştirmek olarak değerlendirin:

- Host tarafından sağlanan renk ve tipografi belirtilerini uygulayın, sonra tema veya kontrast tercihleri değişince tepki gösterin.
- Görüntü istedikleri boyutları bildirsin, ancak host kapalı ve iframe boyutunu uygulayın, böylece içerik düzeninden kaçamaz veya yanıltıcı üstlükler oluşturabilir.
- Klavye düzenini, görünür odaklanmayı, erişilebilir isimleri, ekran okuyucu statüsünü, yeterli kontrastı, zoom ve iframe içinde az hareket davranışını korumak.
- Host kontrolleri ve View kontrolleri arasında odak aktarımını yeniden test edin boyut değiştirdikten ve yeniden gösterdikten sonra.

Uygulama açıkken yetenekler iptal edilebilir çünkü kullanıcı hesabı değiştirir, politika değişiklikleri, bir sunucu karantinaya alınır veya sunucu rızkı daraltır.`ui/initialize`. İptal olunca, bekleyen ayrıcalıklı çağrıları reddetmek, politikaya uygun olmayan ağ faaliyetini durdurmak, hassas gösterilen durumları temizlemek ve kullanıcı arayüzü kaynağı artık kabul edilmediğinde metine yeniden yüklemek veya geri dönmek. Bir Görüntü, reddedilmeyi normal bir sonuç olarak ele almalıyız, sunucu teslim olana kadar tekrar denememeliyiz.

### - Bu sözleşmenin bir parçası.

Uygulamaları bilen bir sunucu hala UI uzantısını reklamlamayan sunucuları hizmet verebilir:

- Aynı aletleri  olmadan geri gönderin`_meta.ui`İçeride`tools/list`- Evet .
- Kullanılabilir bir metin sonucu kaydet .`tools/call`- Evet .
- İtiraz`resources/read`Kayıp kapasite hatası olan kullanıcı aracına göre.
- Araçın tamamlanıp bitmediğine karar verirken asla bir iframe var olduğunu düşünmeyin.

```figure
t3-ui-sandbox
```

## Yapın

`code/main.py`SDK olmadan küçük bir süreç protokol modeli oluşturur. Geçerli talep zarfını ve Akışlanabilir HTTP yönlendirme değerlerini doğruluyor, uygulamaları `server/discover`, araçları ve kaynakları listeler, araçları yürütür ve kendiliğinden bir HTML kaynağı hizmet verir.

Modelle zaten analiz edilmiş vücutlar ve yönlendirme başlıkları bulunmaktadır.`Content-Type`veya `Accept`. Tüm Akışlanabilir HTTP adaptörü için Ders 09 kullanın .`Content-Type: application/json`ve bir `Accept`her ikisini içeren değer `application/json`ve `text/event-stream`- Evet .

Çek şunu:

```bash
cd phases/13-tools-and-protocols/14-mcp-apps
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Çıktıran beş şeyi kontrol edin:

1. Her arama bağımsızdır.
2. Her isteğin var .`_meta`yetenekleri.
3. `resources/list`herhangi bir kaynak okumanın öncesinde sabit bir tanımlayıcı gönderir.
4. Her sonuçta`resultType`ve sunucu kimliği metadataları.
5. Ana seans kimliği görünmüyor.

## Kullan

Başlayın .`server/discover`- İtiraf et .`io.modelcontextprotocol/ui`Sunucu uzantısı haritasında görünmektedir.`tools/list`Birinci cevap kaynağı açıklar. İkinci bir kullanılabilir tek metin araç olarak kalır.

Oku `ui://notes/timeline.html`HTML ' i arayın .`hostOrigin`ve `event.origin`Bu iki çizgi köprüde bir wildcard hedefi olmadığını gösteren en az görünür bir kanıt.

## Gönder

Bu ders gemileri `outputs/skill-mcp-apps-spec.md`. Framework kodu yazmadan önce bir uygulama sözleşmesini incelemek için kullanın. Yazarı mevcut çekirdek zarfı, uzantı müzakere, geri dönüş, UI kaynağı, önbelleği politikası, CSP, izinler, köprü yöntemleri ve onay sınırı belirtmesini zorlar.

## Egzersizler

1. Müşteri yeteneğini boş bir uzantı haritasına değiştir.`tools/list`Araç tutar ama kullanıcı aracını bağlayamaz.
2. Gönder .`Mcp-Name: ui://notes/other.html`Zaman çizgisini okuyacak bir vücutla.`-32020`- Evet .
3. Kaynakı  olarak değiştirin`cacheScope: private`- Kullanıcıya özgü, bunu haklı çıkaran durumunu açıklayın.
4. Senaryoyu `https://static.example.com/app.js`Bu kökeni `resourceDomains`ve yeni tedarik zinciri riskini açıklar.
5. Bir ekle`notes_open`Kullanıcı onayını host'ta tutun.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| MCP Apps | Optional extension for interactive HTML rendered by an MCP host |
| `io.modelcontextprotocol/ui` | Extension identifier advertised by both peers |
| `ui://` | Resource scheme for an App's UI template |
| `text/html;profile=mcp-app` | MIME type for MCP App HTML |
| `server/discover` | Current RPC for protocol and capability discovery |
| `resources/list` | Mandatory resource listing method when the server advertises resources |
| `resultType` | Required discriminator for modern successful results |
| `ui/initialize` | First Apps bridge request, separate from removed core initialization |
| `ui/notifications/initialized` | Apps View readiness notification sent after the host responds |
| CSP | Browser policy that restricts scripts, styles, images, and network origins |
| Text fallback | Tool behavior retained for a host without Apps support |

## Daha Fazla Okumak

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps build guide](https://modelcontextprotocol.io/extensions/apps/build)
- [Official extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix)
