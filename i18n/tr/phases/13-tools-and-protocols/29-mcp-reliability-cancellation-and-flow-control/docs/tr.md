# MCP güvenilirliği, iptal ve akış kontrolü

> Bir istek kimliği mesajla ilişkilidir. Yan etkisi güvenli, bir işçiyi durdurmaz veya akışın yavaş bir tüketiciden korunmasını sağlamaz.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 09 and 13
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Stdio ve Streamable HTTP için doğru iptal sinyali uygulayın.
- İptal sonrası mesaj göndermeden tamamlama ve iptal yarışlarını çözün.
- Durumlu ile ayrı bir talep iptalı `tasks/cancel`- Semantik.
- Yan etkiler ve açık bir idempotency anahtarlarından kararlar ver.
- Son cevapları korurken ilerleme sırasını bağlayın.
- Yeniden bağlanarak, yeniden bağlayarak ve sarsılmış geri çekim yoluyla akımları kurtarmak.

## Sorun

Mutlu yol en pahalı dağıtılmış sistemlerdeki hataları saklar.

Bir istemci bir aracı arar. Sunucu çalışmaya başlar. Gelişme gelir. Bir vekil akışını tamponlar. istemci zaman sonuna ulaşır ve bağlanmaz. Sunucu bir milisaniye sonra tamamlanır. istemci yeni bir JSON-RPC kimliği ile tekrar çalışır. Mutasyon iki kez çalışır.

Her bileşen yerel olarak davranmış ve sistem küresel olarak başarısız olmuş.

MCP mesaj ve nakliye davranışını tanımlar, ancak uygulamanız hala sahip:

- Zaman bütçeleri;
- İşletme özgürlüğü;
- sınırlı kuyruklar;
- yeniden deneme sınıflandırması;
- Kalıcı görev durumu;
- politikayı yeniden bağlamak ve yeniden düzenlemek.

Bu ders, bu kararları bir deterministik simülatör haline getirir.
Uyku, soket veya rastgele hatalar yok.
Bir senkronize edilmiş ip testi iki büyüklük istemcisini rekabet etmeye zorlar.
Aynı özgürlük anahtarı için.

## İptal talebi ulaşım için özel

Her nakliye için aynı amaç vardır: müşterinin uçuş sonucu daha fazla ihtiyacı yoktur.

### studio

stdio, ortak iki yönlü bir kanal kullanır.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 41,
    "reason": "User closed the operation"
  }
}
```

Uyarı ateşle ve unut. Sunucu ona JSON-RPC cevabı göndermez.

Sunucu, çalışmayı durdurmalı, kaynakları serbest bırakmalı ve iptal edilen talebe cevap göndermekten kaçınmalıdır. İptal edilmeyi, istek bilinmeyen, zaten bitirilmiş veya güvenli bir şekilde durdurulmadığında görmezden gelebilir.

Yanlış şekillendirilen, bilinmeyen ve zaten tamamlanmış iptal bildirimleri görmezden gelenilir.

### Akışlanabilir HTTP

Modern Streamable HTTP, her talebe kendi HTTP yanıtını veya SSE yanıt akışını verir.

Post etmeyin `notifications/cancelled`Normal bir HTTP istek için. Akım kapatılması iptal sinyalidir.

Sunucu bağlantı kesimini gözlemledikten sonra çalışmayı durdurmalı ve bu talebe daha fazla mesaj göndermemelidir.

### Sunucu gönderilen iptal kısıtlı

Bir sunucu kullanmıyor `notifications/cancelled`Studio'da, sunucu gönderilen iptal bir arama sonlandırmak için tasarlanmıştır.`subscriptions/listen`Bu yol, sıradan müşteri talepleri iptal edilmesinden ayrı kalsın.

## İptal Bir Yarış

İki etkinlik emri de geçerlidir.

### İptal kazanır

```text
request starts
client sends cancellation signal
server marks request cancelled
worker reaches completion
server suppresses the response
```

### Tamamlama kazanır

```text
request starts
worker commits the result
server sends the response
cancellation arrives late
server ignores the late notification
```

Müşteri, zaten terk ettiği bir talebe geç bir cevap vermemizi de unutmalıdır. Ağ gecikmesi, diğer tarafın önce hangi olayı gözlemlediğini hiçbir taraf kanıtlayamayacağını gösterir.

```figure
mcp-reliability-race
```

Dersimiz `RequestCoordinator`Bir terminal durumunu saklar. `complete()`Geç bir iptal tamamlanmış bir kaydı değiştiremez.

## Zaman Zamanı İki Saat Gerektirir

Tek bir hareketsizlik zamanlaması yeterli değildir.

İki sınır kullan:

1. **Idle timeout.**İstek ne kadar süre yararlı bir faaliyet göstermeyebilir.
2. **Maximum timeout.**Arama başlamasından itibaren mutlak bir bütçe.

Gelişme, boş saatleri geri ayarlayabilir.

```text
start: 0 ms
progress: 400 ms
progress: 800 ms
progress: 1200 ms
idle timeout: 500 ms
maximum timeout: 2000 ms
```

1500 ms'de, en son gelişme sadece 300 ms'lik olduğu için talep hala aktifdir. 2000 ms'de, bir diğer gelişme olayı 1999 ms'de geldiğinde bile maksimum süre onu iptal eder.

Bir sunucu bir ilerleme belirti kabul edebilir ve hiçbir güncelleme yayınlayamaz. Bir belirti varlığını sonsuz bir süreliğe asla dönüştürme.

MCP ilerleme değerleri yükselmeli. İletişim tamamlandıktan veya iptal edildikten sonra durur.

## İptal İstediği Değil `tasks/cancel`

Bu mekanizmalar farklı yaşamları çözüyor.

| Mechanism | Target | Signal | What success means |
|-----------|--------|--------|--------------------|
| Request cancellation on stdio | One in-flight RPC | `notifications/cancelled` | Client abandoned the request; server should stop if practical |
| Request cancellation on HTTP | One in-flight response stream | Close the stream | Client abandoned the request; server should stop if practical |
| `tasks/cancel` | One durable Task | Ordinary MCP request | Server acknowledged cancellation intent |

Başarılı bir `tasks/cancel`Bu işçiyi durdurmak için bir işçiyi durdurmak zorunda kalır.`working`İşçi kontrol noktası bayrağı izlerken iş bu kontrol noktasından önce tamamlanabilir.

HTTP bağlantısı kapanırken kalıcı görev durumunu silmeyin. Bir Görev oluşturmanın nedeni, yaşam döngüsünün bir istek ve bir bağlantıdan daha uzun yaşamasıdır.

## Yeni JSON-RPC Kimliği İdempotency Değildir

JSON-RPC kimlikleri, istek ve yanıtları ilişkilendirir.

Bir müşteri id ile bir ücret gönderir diyelim .`41`, cevap kaybeder ve tekrar id ile dener.`42`Sunucu iki farklı mesaj görür. Bir uygulama anahtarı olmadan, bir verilemeyi temsil ettiklerini bilmiyor.

İdempotency anahtarı iş niyetini belirler:

```json
{
  "name": "charge_account",
  "arguments": {
    "account": "acct-7",
    "cents": 1200,
    "idempotencyKey": "checkout-7"
  }
}
```

Sunucu depoları:

- Anahtarı;
- İşlem argümanlarının parmak izi;
- Söz verilen sonuç.

Aynı anahtar ve aynı argümanlar kaydedilen sonucu gönderir. Aynı anahtar farklı argümanlar ile reddedilmektedir. Bu, yanlışlıkla anahtarın yeniden kullanılması farklı bir iş işlemini mutasyona uğratmasını engeller.

### Lider sınırları atomik ve dayanıklı olmalıdır.

Bu dizi güvenli değil:

```text
check key
run mutation
store result
```

İki işçi hem kayıp bir anahtarı gözlemleyebilir hem de mutasyonu çalıştırırlar.
Efektten sonra ama mağazanın yeniden deneme sırasında aynı belirsizlik yaratmadan önce.

Ders dosya desteklenmiş bir SQLite büyüklüğü kullanıyor. `BEGIN IMMEDIATE`serileştirir
Anahtar kontrol, simülasyon iş etkisi, yürütme hesaplamacı ve kaydedilen sonuç
İki bağımsız defter bağlantısı aynı anahtarla yarışıyor.
Bu nedenle, bir sözleşme sonucu ve bir yürütme izle.
Bu kayıtlar büyük kitapta kalır.

Her geri dönüş değeri kaydedilen JSON'dan yeniden yapılandırılır.
büyüklüğünde bulunan değişken nesne, bu nedenle geri gönderilen bir sözlüğü değiştirmek mümkün değildir
Daha sonra tekrarlama sonuçlarını bozuyor.

Simülatörün iş etkisi,
Gerçek bir ödeme, dağıtım veya dış API çağrısı
Bu, sadece yerel bir tablo yazarak atomik yapılmaz.
Paylaşılan veritabanı işlemleri, işlem dış kutusunu veya yukarıdaki sunucuyu
Bu, aynı idempotency anahtarını uygulayan bir sistem.
Bir sürü kopya veya yeniden başlatma.

### Yeniden deneme matrisi

Uygulamaları uygulamadan önce yeniden sınıflandırın.

| Class | Example | Retry rule |
|------|---------|------------|
| Safe | Deterministic read with no side effect | Retry with a new JSON-RPC id after the failure boundary is understood |
| Conditional | Mutation with a durable idempotency key | Retry with the same key and identical arguments |
| Unsafe | Mutation without business deduplication | Do not retry automatically; reconcile first |

 gibi araç açıklamaları`readOnlyHint`ve `idempotentHint`Uygulama sözleşmesi ve sunucu uygulaması güvenlik için yeniden denemeyi kararlaştırır.

## Baskı Doğru Olmanın Bir Yeri

SSE üreticisi bir istemci, vekil veya ağ tüketebildiğinden daha hızlı ilerleme oluşturabilir.

Sınırlı bir kuyruk kullanın ve ne kaybedebileceğini belirleyin.

Progress değiştirilebilir. Daha sonraki bir ilerleme değeri aynı token için önceki bir değerini değiştirir.

Ders tamponu bu politikayı uyguluyor:

1. Aynı şekilde, yakınındaki ilerlemeleri de birleştirin.
2. Kapasite ulaştığında en eski ilerlemeyi bırakın.
3. Akıntıya yetkili bir yeniden düzenleme gerektirdiğini işaretle.
4. Son cevabı koruyun.
5. Son cevabın korunması için başka bir son cevabın düşürülmesini gerektiren bir durum reddetmek.

Bu açık bir iyileşme ile sınırlı bir kayıp.

### Yasalama tamponu

Bir sunucu, ters vekil bir tampondaki olayları tuturken doğru bir şekilde akışlayabilir.

SSE cevabı için, aşağıdakiları gönderin:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

2026 Akışlanabilir HTTP özellikleri önerir `X-Accel-Buffering: no`Bu yüzden uyumlu vekiller olayları hemen teslim ediyor.

Sessiz uzun ömürlü akışlar için, SSE'nin bir yorumunu düzenli olarak yayınlayın:

```text
:
```

Müşteri yorum satırlarını görmezden gelir. Ortaklar trafiği görür ve boş bir bağlantıyı kapatma olasılığı daha azdır.

Bir işlemin semantik boş zaman sonunu sadece bir nakliye yorumunun geldiği için yeniden ayarlamayın.

## Yeniden Bağlantı Yeniden Bağlantı

Modern Streamable HTTP , yeniden başlatılabilir SSE'yi desteklemiyor `Last-Event-ID`- Evet .

Bir an sonra`subscriptions/listen`Akış düşüşleri:

1. Yeni bir JSON-RPC kimliği ile yeni bir dinleme istekini açın.
2. İsteyen abonelik filtresini geri yükle.
3. Etkili yöntemlerden etkilenen araçları, kaynakları, ipuçlarını veya Görevleri geri alın.
4. Dönüştürme uygulaması durumları stabil tanımlayıcılar tarafından.
5. Güvensiz bir mutasyonun tepkisi kayboldu diye tekrar oynatmayın.

Örnek geri kazanma planı açıkça belirtiyor `sendLastEventId`Yalancılık için kaynakları listeler.

### Bir sürü yeniden bağlanmasını engelle

Eğer 10.000 müşteri tam bir saniye içinde tekrar bağlanırsa, kurtarma sunucusu yine başarısız olur.

Ders, belirleyici jitter'i müşteri kimliği ve deneme numarasından hesaplar, böylece testler tekrarlanabilir kalır:

```text
attempt 0: up to 250 ms
attempt 1: up to 500 ms
attempt 2: up to 1000 ms
...
cap: 8000 ms
```

Üretim kriptoografik olarak güvenli veya çalıştırma zamanını rastgele kullanır. Değişkin bir formül değil, dağılımdır.

## Yapın

`code/main.py`Beş küçük güvenilirlik bileşenini oluşturur.

### `RequestCoordinator`

- Uçuşta boş ve maksimum tarihlerle bir talep başlatır;
- teker teker ilerleme bildirimleri verir;
- doğru stdio veya HTTP iptal sinyalini üretir;
- geçersiz iptal bildirimlerini görmezden gelir;
- iptal ve tamamlama terminal yarışlarını açıkça belirtir;
- Studio abonelikleri için sunucu gönderilen iptal rezervasyonu.

### `MutationLedger`

- İki JSON-RPC kimliğinin iş anahtarı olmadan iki kez çalıştırıldığını kanıtlar;
- Anahtar kontrolü için dosya desteklenen SQLite işlemini kullanır, simülasyon etkisi,
  İcra hesaplama ve sonuç güvencesi;
- eşleşen argümanları tek bir bağımsızlık anahtarı altında kopyalanır
  büyüklük bağlantıları;
- farklı argümanlarla tekrar kullanılan bir anahtarı reddeder;
- Defensif kopyaları geri verir ve yeniden açılan kayıtları korur.

### `DurableTaskService`

- iptal talebini onaylar;
- Görevini yerine getirir.`working`İşçi kontrol noktasına kadar;
- onayın nihai statüsü olmadığını gösterir.

### `BoundedSseBuffer`

- basınç altında ilerlemeyi birleştirir veya düşürür;
- yetkili bir yeniden düzenleme gerekliliğinin kaydedilmesi;
- Son cevabı asla bırakmaz.

### Sağlık yardımcıları

- Proxy güvenli SSE başlıklarını ve tutma yorumu geri gönderin;
- Yeniden bağlantı kurma ve yeniden bağlantı planı oluşturmak;
- Deterministik eksponensel geri çekim ve gerginlik ile tekrar yayılma denemeleri.

## Kullan

Depo kökü:

```bash
cd phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Demo, merkezi yarışın her iki tarafını da yürütüyor, işlemsel bir işlem yürütüyor.
geçici dosya desteklenen bir büyük kayda deduplikasyon mutasyon, sınırlı bir
ilerleme tamponu, ve kabul edilen iptalden hareket eden kalıcı bir Görev gösterir
İşçi tarafından gözlemlenen iptal.

## İnteraktif Laboratuvar

Uyku eklemeden dört etkinlik siparişini yürüt.

1. Başlatma talebi`A`, iptal, sonra aramak `complete()`- Evet .
2. Başlatma talebi`B`Tamamlayın, sonra iptal yapın.
3. Başlatma talebi`C`, her boş vaktin öncesinde ilerleme gösterir, sonra maksimum vakti geçiyor.
4. Başlatma talebi`D`Akışlı HTTP üzerinden ve cevap akışını kapat.

Her senaryo için kayıt:

- terminal talebinin durumu;
- Son bir cevap olup olmadığını;
- telde yerleştirilen iptal sinyalini;
- Müşteri hangi olayı görmezden gelmeli.

O zaman değiş .`D`Operasyon aynı, ama iptal sinyalinin değişmesi gerekiyor.

## Pratik Laboratuvar

Bir ekle`reserve_inventory` mutasyon`MutationLedger`- Evet .

Gereksinimler:

1. Anahtar SKU, miktar, kiracı ve işletme adını bağlar.
2. Aynı anahtarla ve aynı argümanlarla tekrar denemek ilk rezervasyonu geri verir.
3. Değişen miktarla yeniden deneme bir başka rezervasyon olmadan başarısız olur.
4. Yaptığı ama cevapını kaybettiği bir idam anahtarla uzlaştırılabilir.
5. Sonuçta gizli veya ödeme verileri kaydedilmiyor.
6. Müşteri anahtarı vermediğinde otomatik tekrar deneme devre dışı bırakılır.
7. Bir abonelik düşüşü simülasyonu ekle ve sonraki şeyi ne yapacağınızı karar vermeden önce stok kaydını yeniden düzenle.
8. Bir bariyerde iki büyüklük bağlantısını başlatın ve aynı anahtarı gönderin
   Bir rezervasyon yapıldı.
9. İlk geri dönüştürülen rezervasyon nesnesini mutasyon yapın.
   Kaydedilen sonuç değişmedi.
10. Büyük defteri kapatıp yeniden açın, sonra rezervasyonu anahtarla uyumlandırın.

Laboratuvarı dürüst tutun: eğer stok başka bir hizmette yaşarsa,
Bu hizmet aynı idempotency anahtarını kabul ediyor veya işlem dış kutusunun
Köprüler, yerellerin uzak etkiyi yapmalarını sağlar.

## Nakliye edilen Sanatlı

`outputs/skill-mcp-reliability-reviewer.md`MCP işlevi, ulaşım, zamanlama politikası, yeniden deneme davranışı, kuyruk politikası ve kurtarma planı.

## Kontrol et

Ders, şu ifadeler doğru olduğunda tamamlanır:

- stdio iptal gönderir `notifications/cancelled`Ve hiçbir cevap almaz.
- Akışlı HTTP iptal edilmesi istek akışını kapatır ve iptal edilmeyi göndermez.
- İptal-tamamdan önce son tepkiyi bastırır.
- İptal edilmeden önce tamamlanmak, tepkiyi korur ve geç iptal edilmesini görmezden gelir.
- İlerleyiş boş zamanları yeniden ayarlayabilir ama asla maksimum zamanlama yapamaz.
- Yeni bir JSON-RPC kimliği tek başına mutasyonu tekrar yürütür.
- Bir idempotency anahtarı ve aynı argümanlar eşzamanlı bir şekilde bir kez çalıştırılır
  İki bağlantı yarışı.
- Bir kayıt yeniden açılırken hayatta kalır ve tekrar oynanırsa savunma kopyasını gönderir.
- Geri gönderilen bir sonucu değiştirmek kaydedilen sonucu değiştiremez.
- Sınırlı tampon kapasitesinde kalır ve son tepkiyi korur.
- Reconnect yeni bir talebi kullanıyor, göndermiyor `Last-Event-ID`, ve etkilenen durumu yeniden düzenler.
- `tasks/cancel`İşçi bu görevi yerine getirene kadar, onay görevini sonlandırmıyor.

## Üretim Başarısızlık Modları

| Failure | Observable symptom | Correct response |
|---------|--------------------|------------------|
| HTTP client POSTs cancellation notification | Server and client disagree about request lifetime | Close the request's SSE response stream |
| Server responds after accepted cancellation | Client receives an unusable late result | Stop work and suppress further messages when cancellation wins |
| Progress resets every deadline | Hung work survives forever | Keep a separate absolute maximum timeout |
| New RPC id treated as deduplication | Charge, deployment, or deletion runs twice | Add a durable application idempotency key |
| Key check and effect are separate | Concurrent workers both observe a missing key | Commit key claim, effect record, and result atomically |
| In-memory ledger used across replicas | Restart or another worker forgets prior commits | Use shared durable storage or upstream idempotency |
| Stored mutable result returned directly | Caller mutation corrupts later replays | Serialize committed results and return defensive copies |
| Key reused with changed arguments | One key aliases two business intents | Store and compare an argument fingerprint |
| Unbounded progress queue | Memory rises with a slow consumer | Coalesce and drop replaceable progress within a bound |
| Final response dropped under pressure | Client cannot know the request outcome | Reserve capacity or evict progress, never the final response |
| Proxy buffers SSE | Progress arrives in bursts or after timeout | Disable buffering and configure compatible proxy timeouts |
| `Last-Event-ID` assumed | Client resumes from state the server does not support | Reconnect with a new request and refetch |
| Every client reconnects immediately | Recovery creates another outage | Use capped exponential backoff with jitter |
| Task ack treated as final cancellation | Worker keeps running after UI says stopped | Poll the Task until a terminal status |

## Capstone Bağlantısı

Araç ekosisteminin son taşı güvenilirliği bir mimari şema'nın bir paragrafı değil, uygulanabilir bir kanıt olarak değerlendirmelidir.

Bu eserleri istemek:

- her taşıma için bir iptal yarış transkripti;
- Her açık mutasyon için bir tekrar deneme masası;
- İdempotency anahtarı kaydı ve eşleşme eksikliği;
- Aynı anahtarla eşzamanlı bir transkript, yeniden açılış kontrolü ve mutasyon adı kontrolü;
- sınırlı tampon aşırı yüklemesi sonucu;
- Ters temsil SSE başlıkları ve boş politikalar;
- yetkili yeniden bağlantı yöntemlerini belirleyen bir yeniden bağlantı planı;
- Baş taşı Tasks kullanırken kalıcı bir Görev iptal izini.

Yerel bir süreçte yeşil bir talep sadece mutlu yolu kanıtlar. Kayıp cevaplar, geç iptal, yavaş tüketiciler ve yeniden bağlanan sürüler belirleyici sonuçlara sahip olduğunda baş taşı üretime hazırdır.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| Request cancellation | Abandonment of one in-flight MCP request |
| Cancellation race | Competition between terminal completion and cancellation events |
| Idle timeout | Limit since the last useful request activity |
| Maximum timeout | Absolute limit from request start, unaffected by progress |
| Idempotency key | Application identifier that deduplicates one business intent |
| Atomic ledger | Durable boundary that commits the key claim, effect record, and result as one unit |
| Backpressure | Control applied when producers outpace consumers |
| Progress coalescing | Replacing older progress with a newer authoritative value |
| Refetch | Reading current state again after a stream gap |
| Jitter | Deliberate variation that spreads retries across time |

## Daha Fazla Okumak

- [MCP Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [MCP Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Tasks Extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
