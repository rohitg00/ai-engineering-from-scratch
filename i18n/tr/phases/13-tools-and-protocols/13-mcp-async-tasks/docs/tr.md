# MCP Görevleri Genişletilmesi: Ülkesiz bir çekirdeğin kalıcı çalışması

> Devletsiz MCP, her işlemin tek bir talepte tamamlanması gerektiği anlamına gelmez. Resmi Görevler uzantısı uzun süreli çalışmalar için açıkça dayanıklı bir eleştiri sağlar. Bir sunucu bu eleştiriyi `tools/call`, her örnek cevap verebilir .`tasks/get`, ve müşteri girişleri `tasks/update`Protokol seanslarını yeniden canlandırmadan.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- Devletsiz protokol taşımacılığını dayanıklı uygulama görev durumundan ayırt edin.
- - Konuşmak için .`io.modelcontextprotocol/tasks`İstekleri karşılama kapasitesinin genişletilmesi ve `server/discover`- Evet .
- Sunucu yönlendirilen bir sunucu geri gönder `CreateTaskResult`- Evet .`resultType: "task"`Ancak, kalıcı bir yaratılıştan sonra.
- Anketle`tasks/get`, görev girişini yerine getirmek için `tasks/update`, ve işbirliği iptal edilmesini talep eder .`tasks/cancel`- Evet .
- Yaşlıları çıkarın .`tasks/status`- Evet .`tasks/result`ve`tasks/list`- Bu bir varsayım.
- Seçmeli görev bildirimlerine abone olun `subscriptions/listen`POST cevap SSE akışında.
- Model görev süresi sona erdi, kurtarma yeniden başlatıldı, giriş anahtarı deduplikasyon ve uygulanma hataları doğru.

## Görevler Neden Bir Gelişme?

Görevler ilk kez 2025-11-25 yıllarında deneysel bir çekirdek özellik olarak ortaya çıktı. Temmuz 2026 yeniden tasarımı onları resmi bir şekilde değiştirdi.`io.modelcontextprotocol/tasks`Bu genişleme, müşterilerin ve sunucuların herkes için temel protokolü genişletmeden ek yaşam döngüsüne girmelerini sağlar.

Uzantı özellikleri, görevlerin mevcut resmi evleri olmasına rağmen bir taslak yüzey olarak kalır. SDK'niz tarafından desteklenen uzantı sürümünü takın, uyum senaryolarını çalıştırın ve kablo adaptörlerini işçi ve depolama alanınızdan izole edin.

İşlemin aşağıdaki özelliklerden biri veya daha fazlası olduğunda bir görev kullanın:

- Sıradan bir talep süreci geçirebilir.
- İşçi sırası veya dış iş sistemi zaten idamın sahibi.
- Müşteri kendi yeniden başlatmasından sonra iyileşmesi gerekiyor.
- İşlem, çalıştırma sırasında kullanıcı veya model girişleri için durur.
- İptal ve kalıcı sonuçların alınması ürün gereksinimleri.

Ucuz bir belirleyici arama için bir görev yaratmayın. Bir eleştiri, ısrar, oylama, sona erme ve iptal gerçek karmaşıklıklardır.

## Ülkesizler Ürün, Devletle İlgili Uygulama

MCP 2026-07-28 kaldırılıyor `initialize`- Evet .`notifications/initialized`, protokol seansları ve`Mcp-Session-Id`Bu, devlet ürünlerini yasaklamaz.

Bir görev id açık bir uygulama durumu:

- Sunucu geri vermeden önce ısrar eder.
- Müşteri onu saklayabilir ve yeniden başlatıldıktan sonra tekrar sorabilir.
- Kimlik aynı dayanıklı mağazanın desteklediği herhangi bir kopyaya yönlendirilebilir.
- Her görev yönteminde yetki kontrol edilir.
- Geçmiş ve silme, taşıma ömrü değil görev alanları ile tanımlanır.

Bu, bağlantıya bağlı gizli durumdan operasyonel olarak farklıdır.

Dört hayatı ayırın:

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

Bir görev kaydını işlem belleğine taşımak MCP'yi devletsiz yapmaz. Uygulama güvenilir değildir. Protokol statesiz kalır, ancak bir sonraki bir süre için`tasks/get`Bu işlem, bir diğer kopya için yönlendirilmiş olarak kayıtları geri alamayacaktır.

## Yetkinlik müzakere

Müşteri, her uygun talepte destek ilan eder:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

Sunucu tam olarak gönderir .`supportedVersions`, yetenekleri,`ttlMs`ve`cacheScope`-`server/discover`Bu araçlar reklamını yapıyor, aynı zamanda zorunlu uygulamaları da yapıyor.`tools/list`Bu sonuç bir belirleyici değer verir .`generate_report`Açıklayıcı, geçerli nesne `inputSchema`- Evet .`resultType: "complete"`, sunucu kimliği metadataları ve kamu kaş ipuçları.

Uzatma devresini bildirmeyen bir istemciden bir görev yöntemi `-32021`, İhtiyaclı Müşteri Doluğu Eksik,`data.requiredCapabilities` ayarlanmıştır`{"extensions":{"io.modelcontextprotocol/tasks":{}}}`Desteklenmeyen bir protokol zinciri gönderir .`-32022`Tam olarak`supported`ve `requested`Veriler; kayıp veya ipsiz bir versiyon gönderir `-32602`- Evet .

JSON-RPC olmadan bir zarf `id`bir bildirimdir. Alıcı onu işleyebilir, ancak JSON-RPC sonucu veya hatası göndermez.`202 Accepted`Kabul edilmiş bir bildirim için hiçbir organ bulunmamaktadır.

Şu anda sadece `tools/call`İşlerin artırılmış çalışmasını destekler. İç soyutlamanızı tasarlayın, böylece gelecek taleb türlerinin depolama yazısını yeniden yazması gerekmez.

## Sunucu yönlendirilmiş görev oluşturma

Eski müşteri bayrağı .`params._meta.task.required`Müşteri uzantı desteğini açıklar, sonra sunucu belirli bir `tools/call`Bir görev haline gelir.

İstek:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Cevap:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

Sunucu , bu eldivenin bir `tasks/get`Bu durumda bir müşteri geçerli görünen bir kimlik alabilir ve hemen "bulunmaz" alabilir.

Görev cevabı, istemci görev modunu istemediği anlamda istenmez.

## Görev şekli

Her görevde şunlar vardır:

- `taskId`: sabit sunucu oluşturulan kimlik;
- `status`- Evet .`working`- Evet .`input_required`- Evet .`completed`- Evet .`cancelled`veya`failed`- ...
- `createdAt`ve `lastUpdatedAt`: ISO 8601 zaman damgaları;
- `ttlMs`: yaratılmasından itibaren geçerli kalma süresi veya `null`Reklamsız bir sınırlama için;
- seçeneği `pollIntervalMs`: sunucu'nun mevcut en az önerilen seçim kadenci;
- seçeneği `statusMessage`: kullanıcıya veya modelye yönelik bağlam.

Duruma özel alanlar sadece ilgili olduğunda görünür:

- `input_required`içerir .`inputRequests`- Evet .
- `completed`Orijinal talebin yazısını içerir `result`şekli.
- `failed`JSON-RPC içerir `error`- Ne? - Ne?

Müşteri onurlandırmalı .`pollIntervalMs`. Bir sunucu daha agresif anketleri oran-sınırlayabilir ve görev ömrü boyunca ara değişebilir.

## Anketle`tasks/get`

Müşteri şimdiki bir anlık fotoğraf istiyor:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get`Bu yüzden sonuçları her zaman tamamlanmıştır.`resultType: "complete"`- Yatağındaki görev hala olabilir .`status: "working"`veya `status: "input_required"`- Evet .

Bu fark, ortak bir analizçi hatalarını önler:

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

- Hayır .`tasks/result`Görev tamamlandığında, bir sonraki `tasks/get`Cevap orijinalini içe aktarıyor `CallToolResult`Alt `result`- ...

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

Dışarıdan .`resultType`- Evet .`tasks/get`RPC tamamlandı.`result.resultType`Bu, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer şey, bir diğer bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir şey, bir diğer bir diğer bir diğer bir diğer bir diğer bir diğer bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer`CallToolResult`Kendi yükünü taşımalıdır .`io.modelcontextprotocol/serverInfo`Bu ders, tipsiz bir pay yükü depolamak yerine içerir.

- Hayır .`tasks/list`. Sessiyonsuz sunucular bağlantı ölçülü bir listeye hangi görevlerin ait olduğunu güvenle tahmin edemez. Tarihi gerektiren uygulamalar açık filtre ve mülkiyet kuralları ile yetkili bir alan aracı ortaya çıkarmalıdır.

## Görev İcretinde Girdi

Görev girişleri ve çekirdek MRTR benzer görünümlüdür ancak farklı devamları kullanır.

### Görev oluşturmadan önce gerekli giriş

Geri çekirdek`resultType: "input_required"`Orijinalden`tools/call`Müşteri bunu yerine getirir ve orijinal çağrıyı tekrar dener.

### Görev oluşturduktan sonra gerekli giriş

Görevinizi belirleyin .`input_required`- Evet .`tasks/get`- ...büyük bir şey ortaya çıkarıyor.`inputRequests`, ve müşteri cevapları gönderir `tasks/update`Müşteri orijinalini tekrar denemiyor .`tools/call`- Evet .

Anlık fotoğraf:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

Güncelleme:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Başarılı bir cevap boş bir kabul ve bir de `resultType: "complete"`Devlet değişimi sonuçta tutarlı olabilir, bu yüzden müşteri seçim yapmayı ya da dinlemeyi sürdürür.

Her biri .`inputRequests`Anahtar tüm görev ömrü boyunca benzersiz olmalıdır.`tasks/get`Çıkarıcılar, kullanıcı aracını kopyalayıp, sunucular bilinmeyen, değiştirilmiş veya zaten yerine getirilen anahtarlar için yanıtları görmezden gelebilir.`input_required`Tüm gerekli anahtarların cevaplanana kadar.

## İptal İşbirliği

`tasks/cancel`İşçiyi durdurmak için bir işçi gönderir ve işçiyi durdurmak için bir işçi gönderir.

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Üç görev yöntemi için de.`Mcp-Name`Ayneler`params.taskId`JSON-RPC yöntemi adını tekrarlamaz. `code/main.py`Bu kuralın merkezileşmesi için.`make_http_request`- Evet .

Ders çalışanı, iptal edilmeyi hemen onurlandırır ve tekrar tekrar aramaları boşuna yapar. Bir üretim müşteri, yine de iptal edilmeyi onaydan son görev durumunu çıkarmak yerine işbirliği olarak değerlendirmelidir.

Kullanmayın `notifications/cancelled`Bu bildirim, kalıcı görevler değil, iptal talebine aittir.

Farklılık yönlendirme sınırında önemlidir. İstek iptal edilmesi, uçuşta bir JSON-RPC işlemini veya istek ölçülü HTTP yanıtını hedef alır.`tools/call`- Geri döndü .`resultType: "task"`Bu talep tamamlanmıştır ve ulaşımının kapatılması, kalıcı işin adı verilmemesi veya durdurulması mümkün değildir. `tasks/cancel`Yeni bir yetkili RPC'dir.`params.taskId`, bu kimliği yansıtan .`Mcp-Name`, görevin sahibi arka planını çözer, kooperatif iptal niyetini kaydeder ve işçinin durdurulduğunu iddia etmeden bir onay gönderir.

Bu nedenle bir geçit, istek koordinatörlerini ve görev yollarını farklı tablolarda tutmalıdır.[Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md)Yarış, zaman kesimi, özgürlük, geri baskılar ve her iki yol için de kuralları yeniden denemek.

## Seçmeli bildirimler

Toplamalar temel çizgidir.`subscriptions/listen`Streamable HTTP için, bu bir POST'tur ve bu bir POST'dur. Bu POST'un cevabı bir SSE akışıdır.

Sunucu kabul edilen kimlikleri  ile kabul eder`notifications/subscriptions/acknowledged`Sonra da tam fotoğrafları gönderebilirim.`notifications/tasks`- Bilgi ve görev bildirimi`io.modelcontextprotocol/subscriptionId`İçeride`_meta`, `subscriptions/listen`istek id. Her görev bildirimi başka bir şekilde `tasks/get`O anda geri dönecekti.

Müşteriler hala Görevler uzantısını bildirmelidir. Olayları tekrar oynamak veya `Last-Event-ID`- Evet .

## Başarısızlık Semantikası

İki hata katmanını doğru kullanın.

### Protokol hatası

Geçersiz yöntem parametreleri veya bilinmeyen görev kimliği, genellikle JSON-RPC hatasını gönderir `-32602`- Uzaklama destek bildirimleri eksik .`-32021`Gerekli kapasite nesnesi ile.

### Görevlerin icrası sonucu

- Normal bir araç sonucu ile `isError: true`Hala bir `completed`görev, çünkü araç çağrısı belirlenmiş sonucu üretti.
- Geciktirilmiş çalıştırma sırasında bir JSON-RPC hatası görevi yapar `failed`ve JSON-RPC hatasını kaydetir `error`- Evet .
- Kullanıcı reddetimi `cancelled`, tamamlanmış bir reddedilme sonucu veya başka bir alan özel güvenli sonuç.

## Kalıcılık, Son Zaman ve Sahiplik

En azından görev kimliği, durum, zaman damgaları, ttl, oylama aralığı, orijinal operasyon sahibiliği, sonuç veya hata, beklenmedik giriş istekleri ve tüm verilen giriş anahtarları kalsın.

Depolama anahtarı, yetkili bir kiracı ve müdürü içermeli veya çözmeli.`tasks/get`- Evet .`tasks/update`- Evet .`tasks/cancel`, ve abonelik.

`ttlMs`Bu, bir sunucu tarafından oluşturulan bir işlemin sonucunda gerçekleşen bir işlemin sonucunda gerçekleşmesi anlamına gelmez.

Atomik yazılar veya işlemler kullanın. Ders geçici bir dosya yazar ve atomik olarak yeniden adlandırılır. Bir çok replik hizmetinde paylaşılan dayanıklı bir depo ve işçi kira veya eşdeğer eşzamanlılık kontrolü kullanmalıdır.

```figure
tp-task-lifecycle
```

## Yapın

`code/main.py`Deterministik görev hizmeti uyguluyor:

- `server/discover`Devamı`supportedVersions`, önbelleğe işaretler ve Görevler uzantısı.
- `tools/list`Deterministik, cacheable bir `generate_report`Geçerli bir giriş şeması olan tanımlayıcı.
- `tools/call`Geri dönmeden önce görevi oluşturur ve sürdürür.`resultType: "task"`- Evet .
- Yeni bir servis instance aynı görevi yeniden yükler ve yeniden başlatma kurtarmasını gösterir.
- `tasks/get`Tam görev anlık fotoğraflarını gönderir.
- İşçi hareket eder `working`- ...`input_required`- Evet .
- `tasks/update`bir form cevabını kabul eder ve boş bir tam onay gönderir.
- İşçi yuva yapıp bir yerden saklıyor .`CallToolResult`Kendiliğinden .`resultType`ve sunucu kimliği, sonra geçişler `completed`- Evet .
- `tasks/cancel`Bu uygulamada yetersiz.
- HTTP yapılandırıcısı ayarları `Mcp-Name`- ...`params.taskId`için`tasks/get`- Evet .`tasks/update`ve`tasks/cancel`- Evet .
- İletişim yardımcıları kullanıyor `notifications/subscriptions/acknowledged`ve `notifications/tasks`İkisinin de dinleme talebi kimliği var.
- İdsiz bildirimler JSON-RPC cevabını vermez.

İşçi arka planda uyumak yerine açıkça ilerler. Bu her durum geçişini belirleyici yapar ve protokol örneğini kuyruk mekaniğinden ayırır.

## Kullan

Depo kökü:

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Beklenen sonuç sırası:

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

Ayrıca bunu da kontrol et .`tasks/status`- Evet .`tasks/result`ve`tasks/list`Modern serviste bulunmayan geri dönüş yöntemi.
Bunu kontrol et .`tools/list`belirleyici ve her mevcut HTTP görev yöntemi görevi id'sini yansıtır `Mcp-Name`- Evet .

## Gönder

`outputs/skill-task-store-designer.md`Şimdi genişleme konusunda bilinçli bir tasarım üretmektedir: kapasite müzakere, geri dönüş öncesi kalıcı oluşturma, mevcut yöntemler, giriş güncellemesi akışı, mülkiyet, sona erme, iptal, abonelik ve kaldırılan deneysel yöntemlerden göç.

## Egzersizler

1. İkinci beklenmedik giriş anahtarı ekleyin.`tasks/update`Ve görevin kalıp olduğunu kanıtla.`input_required`İki anahtarın da cevaplanana kadar.
2. Mağazalara kiracı mülkiyetini ekle ve yanlış doğrulanmış müdür tarafından sunulan geçerli bir görev kimliğini reddet.
3. İşçi kira sözleşmesi sona ererken ekleyin.
4. POST- yanıt SSE adaptörü uygulamak `subscriptions/listen`GET eklemeyin.`Last-Event-ID`Ya da bir seans başlığı.
5. Geçmiş temizleme ekleyin. Geçmiş bir görevi, yanlış biçimlendirilmiş bir görev kimliği ile, kiracılık varlığı sızdırılmadan ayırt edin.

## Anahtar Terimler

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## Miras Uygunluğu

2025-11-25 deneysel yüzeyi, müşteri tarafından talep edilen görev artışı kullanıldı.`tasks/status`- Evet .`tasks/result`, ve seçmeli `tasks/list`Bu isimleri sadece sabit bir miras adaptöründe tutun.`tasks/get`,  ile birlikte giriş sağlar .`tasks/update`, ve görev anketinden son sonucu okuyor.

## Daha Fazla Okumak

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
