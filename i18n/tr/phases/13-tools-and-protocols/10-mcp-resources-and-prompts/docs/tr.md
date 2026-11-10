# MCP Kaynakları ve İpuçları: İttifaksiz Sunucular için Adres edilebilir Koleksiyon

> Kullanıcı tarafından seçilen mesaj şablonlarını uyarır. İyi bir MCP sunucusu bu sözleşmeleri ayrı ve öngörülebilir tutar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07 (Building an MCP Server), Phase 13, Lesson 09 (MCP Transports)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Kullanıcının niyetinden kaynaklar, araçlar ve ipuçları arasında seçim yapın.
- Kaynak ve zorunlu bir şekilde açıklama yapın `server/discover`- Evet .
- Determinatçı bir yapı oluştur .`resources/list`ve `prompts/list`Sonuçlar.
- Uygula`ttlMs`ve `cacheScope`Kullanıcı özel verileri sızdırılmadan.
- JSON-RPC hatasını gönder `-32602`geçersiz veya bilinmeyen bir kaynak URI için.
- Açın bir`subscriptions/listen`POST- yanıt akışı ve abonelik kimliği ile her olayı ilişkilendirmek.
- Kaynak içeriğini ve istek şablonlarını güvenilmeyen sunucu çıkışı olarak değerlendirin.

## Kullanıcıyla Başlayın

MCP'yi kötüye kullanmanın en kolay yolu uygulama kodu ile başlamak. Bir veritabanı sorusu işlevleri tanıdık olduğu için bir araç haline gelir. Bir tekrar kullanılabilir iş akışı bir dosyada saklandığı için bir kaynak haline gelir. Bir istek, ev sahibi onu enjekte edebileceği için gizli politika haline gelir.

Kimler seçtiği ve ne beklediği ile başla.

| Primitive | Primary intent | Selection owner | Typical result |
|---|---|---|---|
| Tool | Perform an operation | Model or application | Structured action result |
| Resource | Read content at a URI | Host, application, or user | Text or binary content |
| Prompt | Start a reusable message workflow | User through host UI | One or more prompt messages |

Bir not .`notes://note-1`adreslenebilir içerik olduğu için bir kaynak. `delete_note`Bu bir araç çünkü devlet değiştirir.`review_note`bir istekçi, çünkü bir kullanıcı hazırlanmış bir inceleme iş akışını seçer.

Her ek yüzey keşif, yetki, önbelleğe kaydetme, hata işleme, test ve belgelere ihtiyaç duyar.

## 2026-07-28 Vatandaşsızlık zarfı

Bu ders , MCP protokolünün revizyona yöneliktir .`2026-07-28`Bu profilde başlangıç el sıkışması veya protokol seansı yoktur. Her talebin protokol sürümü ve istemci özellikleri rezerve edilmiş olarak taşınır.`_meta`Anahtarları.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

Bir sunucu uygulamalıdır `server/discover`Sonuç reklamları desteklenir
sürümler, kaynak ve çabukluk özellikleri, uygulama kimliği ve
Bir istemci diğer yöntemi doğrudan arayabilir, ama keşif onu
Bir UI oluşturmadan önce bir sabit anlık görüntü.

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "resources": {"listChanged": true, "subscribe": true},
    "prompts": {"listChanged": true}
  },
  "ttlMs": 3600000,
  "cacheScope": "public"
}
```

Normal sonuçlar ortaya çıkar .`"resultType": "complete"`Cevap .`_meta` ile hizmet uygulamasını tanımlar`io.modelcontextprotocol/serverInfo`Bu bilgi teşhis için yararlıdır. Doğrulama kimliği değildir. Desteklenmeyen bir gözden geçirme ile ilgili bir taleb geri gelir.`-32022`İstediği düzeltme ve sunucu tarafından desteklenen düzeltmeler ile birlikte.

İletişimsiz sözleşme tasarım içgüdünüzü değiştirir. Bir liste bir bağlantıda önceki bir çağrıya bağlı olamaz. Yetki görünen seti değiştirebilir çünkü kimlik bilgileri giriş istekleri, ancak bağlantı tarihi değişemez.

## Kaynaklar Stabil URI Sözleşmeleri

Bir kaynak, bir URI tarafından tanımlanan içeriğe sahiptir. URI'yi yöneticiden önce tasarlayın.

İyi URI özellikleri:

- Kayıt işaretleri veya istekler arasında geçiş için yeterince istikrarlı.
- Ad alanı sunucu alanına yerleştirildi.
- Bir işlem kimliğinden veya bağlantıdan bağımsız.
- Depolama erişimi öncesi onaylanmıştır.
- Her okuma için yetkili.

`notes://note-1`Daha iyi .`note-1`Çünkü isim alanı açık. Dosya sunucusu kullanabilir `file://`URI'ler, ancak sim bağlantıları ve ilgili segmentleri çözünce yapılandırılmış dizin sınırlarını kontrol etmelidir.

`resources/list`URI gibi sabit bir anahtarla sıralamayı önler. Deterministik düzen gürültülü önbelleği kayıplarını, ani görüntüleri değiştirmeyi ve yenilenmeler arasında sıçrayan host UI'leri önler.

```json
{
  "resultType": "complete",
  "resources": [
    {
      "uri": "notes://note-1",
      "name": "Architecture decision",
      "description": "Why the service uses a stateless boundary",
      "mimeType": "text/markdown"
    }
  ],
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

`resources/read`Bilinmeyen bir URI başarılı bir boş okuma değildir. Mevcut Kaynak özellikleri geçersiz veya bilinmeyen kaynak URI'leri JSON-RPC geçersiz parametrelerine, kodlara tahsis eder `-32602`- Evet .

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Unknown or invalid resource URI",
    "data": {
      "uri": "notes://missing"
    }
  }
}
```

Bu ayrım bir istemci için geçerli boş belgeye ait olmayanları ayırt etmenizi sağlar.

### Kaynak Şablonları

Bir kaynak şablonu parametreli URI ailesini tanımlar. Her beton öğenin listelenmesinde bir tane kullanın. Örneğin, `notes://projects/{project}/decisions/{decision}`bir müşterinin her kararını iade etmeden geçerli bir adres oluşturma yolunu söyler.

Şablon bir doğrulama zayıflatmaz. Değişkenleri analiz edin, yetki uygulayın, uzunluk ve karakter sınırlarını uygulayın ve metin parametreleri ile depolama sorgularını oluşturun. Hiç de keyfi bir URI kuyruğunu bir dosya sistemi yolu veya veritabanı açıklaması olarak birleştirmeyin.

### İçerik güvenilir bir talimat değil

Kaynak metni, hızlı enjeksiyon, sırlar, yanıltıcı komutlar veya yanlış biçimlendirilmiş işaretleme içeriği olabilir. Ev sahibi kaynak içeriğini veri olarak korumalı ve ele almalıyordur. Sunucu içeriğin boyutunu sınırlamalı, doğru bir MIME tipi göndermelidir, arayanın erişemeyeceği alanları düzenlemeli ve ilgili olmayan kayıtları göndermekten kaçınmalıdır.

## İpuçlar Kullanıcı Kontrolü Şablonları

MCP istekleri açık kullanıcı seçimi için tasarlanmıştır. Bir host onları kesik komutlar, menü öğeleri veya iş akışı düğmeleri olarak gösterir. Protokol tek bir kullanıcı kullanımı kullanıma ihtiyacı yoktur.

`prompts/list`Bu nedenle, bu sorunun aynı istek yetkisi için belirleyici olması gerekir. Her sorgulamanın önce giriş toplamalarına izin veren sabit bir isim, kullanışlı bir açıklama ve argüman açıklamaları gerekir.`prompts/get`- Evet .

```json
{
  "resultType": "complete",
  "prompts": [
    {
      "name": "review_note",
      "title": "Review a note",
      "description": "Review one note for a named concern",
      "arguments": [
        {
          "name": "uri",
          "description": "The note resource URI",
          "required": true
        }
      ]
    }
  ],
  "ttlMs": 600000,
  "cacheScope": "public"
}
```

`prompts/get`Bu, sunucu'nun sistem talimatlarını değiştirmez. Host geri gönderilen mesajların model bağlamına nasıl girdiğini belirler ve kendi güvenilir politikasını daha yüksek öncelik altında tutar.

Sunucu sınırında istintah argümanlarını doğrulayın. Bir istintah URI doğrudan kaynak okumasıyla aynı yetki kontrolünü geçmelidir.

## Kaş Etme İpuçları Doğru Olmanın Bir Parçasıdır

`ttlMs`bir sonuç ne kadar süre tekrar kullanılabileceğini belirtir. `cacheScope`bu önbelleğe kaydedilen değeri kimin paylaşabileceğini açıklar.

| Scope | Meaning | Typical use |
|---|---|---|
| `public` | May be reused across users when authorization permits | Public prompt catalog |
| `private` | Bound to the requesting user or credential context | User-owned note content |

Verilerin değişim oranından ve gecikme hasarından bir TTL seçin. Beş dakika kamu istekli bir katalog için uygun olabilir.

MCP sadece `public`ve `private`- Evet .`cacheScope`Gizli bir sonuç veya hızlı değişen sonuç için, geri gönderin.`cacheScope: "private"`- Evet .`ttlMs: 0`, sonra host cache politikasında daha sıkı bir depo yok kuralını uygula. `no-store`Kendisi bir MCP değildir `cacheScope`Değer.

Kaş ipuçları asla yetkiyi değiştirmez. Kaş anahtarı, kiracı, kullanıcı, kapsam, yerleşim ve sayfalama göstergesi dahil olmak üzere görünürlüğü değiştiren her talep boyutunu içermelidir. Paylaşılan bir kaş bu boyutları güvenli bir şekilde ifade edemiyorsa, kullanın `private`sıfır TTL ve host seviyesindeki hiçbir mağaza yokluğu politikası ile.

## Abonelikler Müşteri Açık Cevap Akışını Kullan

Modern abonelik modeli eski bir aboneliği değiştirir `resources/subscribe`RPC ve eski HTTP GET olay son noktası.

Müşteri gönderir .`subscriptions/listen`Bu, SSE akışı olarak açık kalmış bir POST'tur.`notifications`Bir sunucu, isteklenmeyen bildirim türlerini göndermemelidir.

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    },
    "notifications": {
      "resourcesListChanged": true,
      "promptsListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

İstek kimliği abonelik kimliği. İstediğiniz herhangi bir olayın öncesinde, sunucu gönderir `notifications/subscriptions/acknowledged`Filtresi sadece sunucu tarafından kabul edilen alt kümeleri içerir.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "notifications": {
      "resourcesListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

Bu akışta her sonraki olay aynı metadata taşıyor.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "uri": "notes://note-1"
  }
}
```

Bilgide kaynak değişmiş, istemci tekrar okuyor.`resources/read`Bu olayın yeni belgeyi içerdiğini düşünmez.

Birden fazla abonelik bir stdio kanalı paylaşabilir. abonelik kimliği istemciyi onları demultiplex etmesine izin verir. HTTP üzerinden, cevap akışı kapatmak aboneliği iptal eder. Akışı güzelce bitiren bir sunucu bir son gönderir `resultType: "complete"`İlk talebe ilişkili bir cevap.

Bir abonelik akışını protokol seansı olarak kullanmayın. Daha sonraki bir okuma hala herhangi bir sağlıklı sunucu örneğine ulaşabilecek tam bir istektir.

```figure
t3-primitive-sort
```

## İnteraktif Laboratuvar

Proje izleyicisinden beş yeteneği sınıflandırmak için bu rakamı kullanın: konu detayları, konu oluşturmak, sprint inceleme şablonu, proje politikası ve kapanma sorunu. Daha sonra hangi listelerin kamuya önbelleğe alınması, hangi listelerin gizli kalması gerektiği ve hangi kaynakların güncelleme bildirimlerini hak ettiğini belirleyin.

Her sınıflandırma için seçeneği isimlendirin. Eğer model bir eylem gerçekleştirirse, bir araç kullanın. Eğer bir host URI adresli içeriği okuyorsa, bir kaynak kullanın. Kullanıcı hazırlanmış bir mesaj iş akışını başlatırsa, bir isteklendirme kullanın.

## Pratik Laboratuvar

Simülatörü depo kökü ile çalıştır:

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Transkripti bu sırada kontrol edin:

1. - Evet .`server/discover`mevcut revizyonu ve her iki özelliği de reklam eder.
2. Her iki liste sonuçlarının de sıraladığını ve kullanıldığını onaylayın `resultType: "complete"`- Evet .
3. Listesi onaylayın ve okudukları sonuçlarda kasıtlı önbelleğe işaretler bulunur.
4. Okunan URI ' yi  olarak değiştirin .`notes://missing`ve gözlemle .`-32602`- Evet .
5. Kayıt etkinliğinden önce abonelik onayını onaylayın.
6. Olayı onaylayın ve her iki takvimin de onay belgesi alın .`5`- Evet .

Python modeli gerçek bir HTTP bağlantısını açmaz. Bir SDK'nin istek ölçekli yanıt akışında yerleştirmesi gereken mesajları temsil eder.

## Nakliye edilen Sanatlı

`outputs/skill-primitive-splitter.md`MCP primitif seçimi için tekrar kullanılabilir bir tasarım incelemesi. Şimdi deterministik keşif, önbelleğin kapsamını, geçersiz URI davranışını ve modern abonelik filtrelerini kontrol eder.

Ders de gemiler .`assets/primitive-split.svg`, offline çalışma için primitif ve abonelik sınırının statik bir versiyonu.

## Kontrol et

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Beklenen sonuç: ana program bir JSON transkripti basar ve test komutu en az on iki geçiş testi raporlar.

## Capstone Bağlantısı

Bu sözleşmeyi, kapstone sunucunuz, adres edilebilir bilgileri eylemlerin yanı sıra ortaya çıkarırken kullanın. Bir belirleyici katalog anketini, bir yetkili kaynak okuyucuğunu, bir hızlı çözümü, bir geçersiz URI vaka ve bir abonelik transkripti dahil edin.

Kanıtlarınız, hiçbir listenin bağlantı geçmişine bağlı olmadığını ve abonelik olayının hiçbir zaman alt kaynaklara erişim sağlamadığını göstermelidir.

## Egzersizler

1. Bir ekle`notes://projects/{project}/notes/{id}`Kaynak şablonu ve her iki değişken de doğrulanır.
2. Sayfa sayfasını ekle `resources/list`- Deterministik düzen koruyordu.
3. Bir kaynakı  olarak değiştirin`cacheScope: "private"`- Evet .`ttlMs: 0`, host düzeyinde bir mağaza yok politika ekleyin ve her iki kontrolü haklı tehdit açıklayın.
4. İndirme listesine bir değişiklik aboneliği ekleyin ve filtreyi atınca hiçbir olay gönderilmediğini kanıtlayın `promptsListChanged`- Evet .
5. İki eşzamanlı abonelik oluşturun ve her etkinliğin doğru talep kimliğini taşıdığını kanıtlayın.
6. Okuyucu yöneticisine bir yetki konu ekleyin ve önbelleğe girilen bir girişin konuları geçemediğini kanıtlayın.

## Anahtar Terimler

- **Resource:**MCP sunucusu tarafından açığa vurulan URI adresli içerik.
- **Prompt:**Bir MCP sunucusu tarafından açıklanan kullanıcı kontrolü mesaj şablonu.
- **Deterministic list:**Aynı talep girişleri için sabit üyelik ve siparişle keşif sonucu.
- **`ttlMs`:**Tazelik süresi milisaniyede saklanmalı.
- **`cacheScope`:**Kaydedilen sonuç için paylaşım sınırı.
- **`subscriptions/listen`:**Cevap akışı açıkça filtreli bildirimler sağlayan uzun ömürlü bir talep.
- **Subscription ID:**İşitme isteği kimliği, bildirim metadatalarında tekrarlanır.
- **Invalid parameters:**JSON-RPC hatası `-32602`, geçersiz veya bilinmeyen bir kaynak URI için kullanılır.
- **Unsupported protocol version:**JSON-RPC hatası `-32022`, içinde `supported`ve `requested`Değişiklikler.
- **`server/discover`:**Desteklenen değişiklikleri, yetenekleri, kimliği ve seçmeli önbelleği ipuçlarını geri veren zorunlu sunucu yöntemi.

## Daha Fazla Okumak

- [MCP 2026-07-28 Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 2026-07-28 Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP 2026-07-28 Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
