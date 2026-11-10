# MCP uyumlu muhendisliği: Versiyonlama, Kanıt ve İşlemler

> Bir sunucu uyumlu değildir çünkü mutlu yolu bir SDK üzerinden çalıştı. uyum, telde, sürüm sınırlarında, aracılar aracılığıyla ve geri dönüş sırasında yaşar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 17 (gateways), Phase 13 · 30 (registry admission)
**Time:** ~100 minutes

## Öğrenme Hedefleri

- Yasal MCP kurallarını altın ve negatif tel kayıtlarına dönüştürün.
- Sıkı tutun .`2026-07-28`- Bu davranışlar, sınırlı miras geri dönüşünden ayrı.
- Ek olarak bilinmeyen alanları geçersiz bilinmeyen alanlardan ayırt edin `resultType`- Evet .
- Çiğ JSON-RPC kanıtlarını SDK-normal görüşle karşılaştırın.
- Başlık ve vücut bütünlüğünü gerçek bir vekil sınırı üzerinden kanıtla.
- Geçit yayınları, düzenlenmiş transkripti, sağlık ve geri dönüş kanıtları ile.

## Sorun

Müşteriniz arıyor .`tools/list`Bir SDK'yi kullanarak araçlar alır.

Bu sonuç önemli sorular cevaplanmamış durumda:

- Sorguda modern bir talep protokolü metadataları var mıydı?
- - Evet .`MCP-Protocol-Version`- Evet .`Mcp-Method`ve`Mcp-Name`JSON-RPC'nin vücutlarına eşleşir mi?
- Cevap geçerli bir cevap içerir miydi?`resultType`Kabloda mı, yoksa SDK'nin birini sentetik mi yaptı?
- Müşteri gelecekte bir katkı alanını koruyacak mı?
- Günümüzde bir hata fark edilse bile bile bir el sıkışması olur mu?
- Bir vekil, kaynak durumunu ve JSON-RPC hatasını korudu mu?
- İletişim seriyalizerinin yasak bir yanıt verdiği var mı?
- İşlemler, gizli gizli bir şey saklanmadan serbest bırakmanın neden teşvik edildiğini veya geri döndürüldüğünü kanıtlayabilir mi?

Konformity, gözlemlenebilir invariantların bir kümesidir.

```figure
mcp-conformance-operations
```

## Versiyon Zamanları ile Başlayın

MCP `2026-07-28`Modern bir istek, kendiliğinden talep başına metadata kullanır.`params._meta.io.modelcontextprotocol/protocolVersion`ve `params._meta.io.modelcontextprotocol/clientCapabilities`- Ad aralığındaki anahtarlar önemli .`protocolVersion`veya `clientCapabilities`HTTP sınırında aynalı yönlendirme başlıkları bulunduğunda, değerleri JSON-RPC vücuduyla uyumlu olmalıdır.`resultType`- Evet .

Versiyonlar `2025-11-25`Daha önceki başlangıç dönemini kullanın.`resultType`Müşteri daha önceki dönemi seçtikten sonra tamamlanmış olarak yorumlanır.

İki şekli aynı anda kabul eden tek bir izin verilatörü oluşturmayın.

| Branch | Entry evidence | Missing `resultType` | Initialization |
|---|---|---|---|
| Modern | Successful `server/discover` or recognized modern response | Invalid | Not the default path |
| Legacy | Configured allowlist plus a valid legacy `initialize` result after an inconclusive modern probe | Interpreted as complete | Required by that era |

Ayrılma, yanlış şekillenen modern bir yaşıtın daha zayıf bir doğrulama ile ödüllendirilmesini engeller.

### Sıkı mod

Sıkı mod modern davranışların kanıtını gerektirir.`server/discover`Modern bir JSON-RPC hatası da bunu kanıtlıyor.`-32020`- Evet .`-32021`veya`-32022`- Evet .

### Geri dönüş modusu

Fallback modunda sınırlı bir modern sonda bulunur. Zaman kesimi, boş cevap, kapalı bağlantı veya tanınmamış cevap kesin değildir. Eşdeğerlerin miras olduğunu kanıtlamaz. Sadece uyumluluk için açıkça yapılandırılmış veya izin verilen bir son nokta sınırlı bir miras sondasını alabilir ve istemci miras dalını yalnızca bu sondun değerlendirmesinden sonra seçir.`initialize`Sonuç ve müzakere edilen miras revizi.

Fallback herhangi bir hata sonrası test legacy değildir. Tanınan modern bir hata yararlı düzeltme bilgileri içerir.

Bu, saldırganın, kesintiye uğramış veya filtreleme proxy'nin modern yanıtları düşürerek aşağı derecelendirmeyi zorlamasını engeller. Son nokta politikasını, kesin olmayan modern gözlemleri, kesin olumlu miras kanıtlarını ve seçilmiş çağı birlikte kaydet.

Bu gerçek olmadan, eksik bir alan bir test çalışmasında kabul edilebilir, diğerinde geçersiz görünebilir.

## Bir Kayıt Yapın

Bir transkript ayarı sadece SDK çağrısı değil, sınırı geçenleri kaydeder:

```json
{
  "name": "golden-modern-list",
  "era": "modern",
  "headers": {
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "tools/list"
  },
  "request": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  },
  "responseStatus": 200,
  "responseBody": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "resultType": "complete",
      "tools": []
    }
  }
}
```

İki sınıf alet tut.

### Altın transkriptler

Altın transkriptler kabul edilen davranışları kanıtlıyor:

- Eşleşen metadata ve başlıklarla modern keşif veya yöntem talebi
- Gerekli alanlarla tam sonuç
- `input_required`Metod daha fazla giriş talep edebilirken sonuç
- Genişleme sonucu sadece ilgili kapasite ilan edildikten sonra
- `resultType`, ama sadece seçilen miras çağında
- JSON-RPC cevabı olmayan bildirim işleme

Altın bir transkript çok doğru, büyük değil.

### Negatif transkriptler

Negatif transkriptler reddetme davranışını kanıtlıyor:

- Baş ve vücut eşleşmezliği
- İstekleri karşılama yetenekleri eksik
- Desteklenmeyen eşleşen protokol versiyonu
- Modern yok .`resultType`
- Bilinmeyen veya reklam edilmeyen `resultType`
- Cevap`jsonrpc` dışında`2.0`veya değer veya JSON tipiyle farklı bir kimlik
- Her ikisini içeren bir cevap `result`ve `error`Ya da hiçbiri
- Tam sayı olmayan bir hata `code`ve ip .`message`
- yanlış HTTP durumuna haritaslanmış bilinen bir protokol hatası
- Bir bildirim için verilen cevap
- yanlış biçimlendirilmiş JSON-RPC zarfı
- Protokol hatası proxy çöküşü

Her negatif durum için reddetme sınırı ve sabit hata kodu belirleyin. Çalışmayı başarısız etti Çok zayıf.`-32020`Operatörlere tamamen farklı hikayeler anlatırken ikisi de başarısızlık gibi görünebilir.

Başlık-birbirle uyumsuzluk düzeni, sunucunun gerçek HTTP 400 JSON-RPC yanıtını eşleşen talep kimliği ve hata kodu ile içermektedir `-32020`Yerel onaylayıcı tarafından gözlemlendiğinde otomatik olarak uygulayın .`HeaderMismatch`Bu durum, HTTP 500 ile bir durum ve yerel reddetme kodu doğru olduğunda bile başarısız olur. Kendi isteği doğrulayıcı atıldıktan sonra durur bir harnes yalnızca kendini test etti, sunucu'nun tel davranışını değil.

Resmi MCP uyumluluk projesi, dış bir paket ve sürümlü referans olarak kullanışlıdır. Yerel transkriptlerinizi de tutun. Genel bir paket bilmediği vekil, SDK, kimlik doğrulama, uzantılar ve yayın yoluyu yakalar.

## Başlık Değerleri RPC Bedenine Uyumlu Olmalıdır

Modern Streamable HTTP'de, aracılar aynalı başlıkları kullanarak politikaları yönlendirebilir veya uygulayabilir. JSON-RPC vücudu gerçeğin protokol kaynağı olarak kalır.

Bu sırada geçerli:

1. JSON-RPC zarfını ve metadata türlerini analiz edin ve doğrulayın.
2. Benzer`MCP-Protocol-Version`- Evet .`params._meta.io.modelcontextprotocol/protocolVersion`- Evet .
3. Benzer`Mcp-Method`- Evet .`method`- Evet .
4. Metodun bir yönlendirme adı varsa, karşılaştır `Mcp-Name`Bu değerle ilgili vücut değeri ile.
5. Dürüstlük belirledikten sonra, eşleşen sürüm ve kapasite kümesi desteklenmeyeceğine karar verin.

Bu sırada eşleşme eksikliği belirlenir .`-32020`Desteklenmeyen versiyondan`-32022`Ayrıca bir geçit başlık adını yetkilileştirmekten saklarken, köken farklı bir vücut adını yürütür.

HTTP alan isimleri durum hassas değildir, değerleri durum hassas kalır. Arama öncesi başlık isimlerini normalleştirin ve çelişkili kopyaları reddedin. Güvensiz, ASCII olmayan veya önde gelen veya takip eden beyaz alan için `Mcp-Name`, tam olarak çözülür .`=?base64?{Base64EncodedValue}?=`UTF-8 sentinel'i vücutla karşılaştırmadan önce.`-32020`.Hem vücut aynı karakterleri içerdiğinde bile çamurlu çevre beyaz alanı geçersizdir, çünkü bu değer taşınmadan önce sentinel kodlamasını gerektiriyor.

Bir aracı, bir istek MCP sunucusuna ulaşmadan önce yanlış biçimlendirilmiş HTTP'yi reddedebilir, bu nedenle başarısızlığı JSON-RPC olmadan HTTP hatası olabilir. Bir reddedilmenin aracından veya kökenden geldiğini yakalayın.

## Bilinmeyen Alanlar Bilinmeyen Sonuçlar Olmuyor

Önceki uyumluluğun iki farklı kural gerektirdiği.

### Eklenme bilinmeyen alanlar

Sonuç nesneleri ve `_meta`Haritalar alanlar kazanabilir. Bir onaylayıcı, alanın bir sözleşmeyi ihlal etmediği sürece, rolüne göre bir katkı alanını korumalı veya görmezden gelmeli. Örnek, tüm ham sonuçları kanıt olarak tutar ve kabul eder `futureHint`Bilinen bir sonucu dışında.

Eğer şeffaf bir vekil iseniz, bilinmeyen bir alanı korumak genellikle çıkarmaktan daha güvenli. Bir uygulama istemcisi iseniz, bunu görmezden gelmek geçerli olabilir. Farklı testi hala SDK'nin onu atmadığını ortaya çıkarmalıdır. Bu nedenle davranış kasıtlıdır.

### Bilinmeyen`resultType`

`resultType`Modern sonuçlar temel kullanımı`complete`veya `input_required`. Bir uzantı, yeteneği reklamlandığında başka bir değer ekleyebilir.`task`Bu pazarlık yapılmış kapasite bağlamında.

Bilinmeyen veya reklam edilmeyen bir ayrımcı güvenle tamamlanmış olarak kabul edilemez.

Aynı çiğ cevap bu nedenle kabul edilebilir bir bilinmeyen alan ve kabul edilemez bir bilinmeyen sonuç türünü içerebilir.

Ardından, yöntem hassas pay yükünü doğrulayın.`tools/list`Sonuç bir `tools`Array'ın tanımlayıcılarının eşsiz boş olmayan isimleri, yararlı tanımları ve nesne kökü olduğu `inputSchema`Değerler.`task`Sonuç sadece uygun olan kişi için geçerlidir `tools/call`Görevler kapasitesi ve gereksinimleri ile`taskId`, bilinen durum, oluşturma ve güncelleme zaman damgaları ve `ttlMs`, ek olarak geçerli bir seçme araları.`completion/complete`Sonuç bir `completion`100'den fazla string değeri olmayan nesne, seçmeli olmayan negatif tam bir sayı `total`Bu değer, geri gönderilen değerlerden daha küçük değil ve seçmeli bir Boolean `hasMore`- İyi yazılmış bir .`resultType`yanlış şekil verilen bir yük conformansını yapamaz.

## İletişim Değişikliği

JSON-RPC bildirimi bulunmuyor `id`Alıcı, JSON-RPC başarısı veya hata cevabını göndermemelidir.

Kabul edilen HTTP bildirim biçimi için, harness bir HTTP bekliyor `202`Boş bir vücutla.`2026-07-28`Streamable HTTP üzerinden hiçbir temel istemci-sözümcü bildirim tanımlamıyor. Örnek, isim aralığı olan bir kurs uzantısı bildirimini yalnızca tek yönlü seriyalizör değişkenliğini test etmek için kullanıyor. Yeni bir temel yöntem olarak sunmayın.

Sadece kontrol cihazını değil, seriyalı cihazı test et.`None`Orta yazılım ise JSON başarı nesnesi olarak sarar.

## SDK Farklılığı Ekle

SDK'lar sıklıkla kablo nesneleri uygun dil türlerine dönüştürür. Bu yararlıdır, ancak normalleştirilmiş bir nesne aldığı şeyi kanıtlayamaz.

Her yüksek riskli cihaz için:

1. SDK'nin çözümü öncesi ham durum, başlıklar ve yanıt vücudu.
2. SDK'ye normalleştirilmiş geri dönüş değeri veya istisna.
3. Seçilen dönem için beklenen semantik tahmin.
4. SDK tarafından kaldırılan, sentezlenen, çıkarılan veya değiştirilen alanlar.

Örnek , sadece SDK'de bilinen tel hesaplarının kaldırılmasına izin verir .`resultType`- Evet .`_meta`- Evet .`ttlMs`ve`cacheScope`Uygulama yükünü karşılaştırırken düştüğünü bildirir.`futureHint`Çünkü bu bilinmeyen semantik alan ortadan kayboldu.

Her farkın bir SDK hatası olduğunu düşünmeyin. Önemli olan dönüşümün görünür olmasını sağlamak. Bileşeninizin bir ek alanı görmezden gelebilecek bir uygulama son noktası olup olmadığını veya onu koruması gereken şeffaf bir aracı olup olmadığını karar verin.

Gönderdiğiniz her SDK ve sürümle karşı farklılık çalıştırın. İki SDK aynı transkripti farklı şekilde normallaştırırsa, yayın politikası, gerçekten sonra en uygun çıkışı seçmek yerine hangi davranışın kabul edilebilir olduğunu belirtmelidir.

## Yönetim Kurulu Kanıtı Yakalayın

Çoğu üretim MCP başarısızlığı birden fazla süreçte meydana gelir.

| View | Minimum evidence |
|---|---|
| Ingress | request headers, JSON-RPC body, content type, authenticated route, receive time |
| Origin | forwarded headers and body digest, origin status, response headers and body |
| Egress | client-visible status, headers, body, and send time |

Örnek iki ortak dönüşümü tespit eder:

- bir HTTP 400 veya 404 JSON-RPC hatası genel bir vekil 500 olur
- çıkış JSON-RPC vücudu, kaynak vücuduyla farklıdır.

İçerik tipi için uygulama özel iddialar ekle, `Accept`TLS'in sonlandırılmasının her iki tarafını yakalayın.

## Devam Etmek, Bilgi Hatıraları Kalkmadan

Yazı düzenleme, daha sonra temizleme işinin değil uyum işlemlerinin bir parçasıdır. Seryalılaştırmadan, hashingten, günlüklerden, test eserlerinden veya başarısız yüklemelerden önce uygulayın.

Örnek kapı anahtar isimlerini katlar ve eşleşmeden önce ayırıcıları çıkarır, ardından  gibi anahtarlar altında değerleri geri dönüşlü olarak değiştirir.`Authorization`- Evet .`Cookie`- Evet .`Set-Cookie`- Evet .`X-Api-Key`- Evet .`accessToken`- Evet .`clientSecret`- Evet .`registrationAccessToken`- Evet .`token`- Evet .`password`- Evet .`secret`ve`api_key`. Kanonikasyon ve denilist aynı formdan kullanmalıdır, böylece camelCase, ipek, vurgu ve noktalı çeşitler birbirlerinin politikasını atlayamaz.`query`hala kişisel veya düzenlenmiş verileri içerebilir.

Yaptıkları açıklamalar, bir araştırma için gerekli olduğunda, sadece onaylanmış kısa ömürlü bir sistemde tutulur. Bir inceleme, hangi düzenlenmiş birliğin kararı yönlendirdiğini kanıtlar; çıkarılan değeri ortaya çıkarmaz.

## Sağlık ve Geri Dönüşü Kapının Bir parçası Olun

Protokol uyumluluğu gerekli ama serbest bırakmak için yeterli değildir.

Uygulama öncesi bir sağlık penceresi tanımlayın:

- En az örnek sayısı
- Maksimum hata oranı
- Maksimum gecikme yüzdesi
- Doymuşluk veya kaynak sınırları
- gözlem süresi
- kabul edilen başlangıç seviyesine karşılaştırma

Devam etmeden önce de geri dönüş kanıtlarını tanımlayın:

- Tam önceki versiyon
- Kabul kanıtı
- SHA-256 eser ve tanımlayıcı çubukları
- Güncel Kayıt Durumu
- mevcut sağlık sonucu
- Yol restorasyonu prosedürü
- Bu alanların üzerinde güvenilir bir serbest bırakma denetleyicisi kimliğinden bir sertifika

Bu geri dönüş hedefinin sadece aday başarısız olduktan sonra değil, terfi edilmeden önce doğrulanmasını ve sağlıklı olmasını talep edin.

Eğer bir aday başarısız olursa ve geri dönüş hedefi bu kanıtlardan yoksunsa, tahmin etmek yerine trafiği durdurun.

Boş olmayan bir versiyon gibi doğruluk kontrollerine hazırlıklılığı azaltmayın. `healthy: "yes"`Bu test, bir örnek, tam bir tür, aktif bir durum, üç SHA-256 digest, güvenilir bir imzalayıcı ve tam geri dönüş paylı yük üzerinde geçerli bir HMAC-SHA-256 sertifikası gerektirir.

Yayın kapısı ayrıca boş transkripti, SDK farklılığı veya vekil kanıtını reddeder. Her kaynak geçerli kanıtları içerecektir. Yeşil sağlık penceresi hiç gözlemlenmemiş bir sınırı dolduramaz.

## Yapın

Standart kütüphane harnesini çalıştır:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
```

Demo, geçerli ve yanlış biçimlendirilmiş tamamlama sonuçları dahil olmak üzere tam olarak on beş altın ve negatif transkripti yürütür, ham sonuçları bir SDK görünümü ile karşılaştırır, bir kaynak hatası çökmüş bir vekili inceliyor, sağlığı değerlendirir, geri dönüş kanıtlarını doğruluyor ve hedef seçer.

Beklenen şekil:

```json
{
  "transcriptsPassed": 15,
  "transcriptsTotal": 15,
  "sdkDroppedFields": ["futureHint"],
  "proxyIssues": [
    "proxy collapsed a protocol error into HTTP 500",
    "proxy changed the origin JSON-RPC body"
  ],
  "releaseAction": "rollback",
  "evidenceDigest": "..."
}
```

Oku `code/main.py`Bu sırada:

1. `validate_request()`çağ-sözlü talep ve başlık kurallarını uyguluyor.
2. `validate_result()`eksik olan miras ayrımcılarını, geçerli modern değerleri, genişlemeleri ve bilinmeyen değerleri ayırır.
3. `select_era()`Sıkı ve sınırlı bir geri dönüş politikası uyguluyor.
4. `run_transcript()`Altın ve negatif ışıkları değerlendirir.
5. `compare_sdk_view()`Normalleşme farklılıklarını ortaya çıkarır.
6. `inspect_proxy()`Giriş, köken ve çıkış kanıtlarını karşılaştırır.
7. `redact()`Kanıtların kullanılmasından önce açık gizli sırları çıkarır.
8. `rollback_evidence_ready()`Tam bir pin alanı ve güvenilir serbest bırakma sertifikasını onaylar.
9. `ReleaseGate.evaluate()`boş olmayan uyum, SDK, vekillik, sağlık ve geri dönüş kanıtlarına katılır.

## Kullan

Haresleri dört noktada çalıştır:

1. Her uygulamada, iş sürecinde test adaptörü ile değişiklik yapılır.
2. Gerçek taşımacılık üzerinde biner istemci ve sunucu oluşturulmuş.
3. Bir aşama ortamında yerleştirilen vekil veya geçit aracılığıyla.
4. Canary'ler canlı sağlık ve geri dönüş kanıtlarıyla birlikte.

Aynı sabit durum isimlerini katmanlar arasında tutun. `negative-header-body-mismatch`Birim, son-son, vekil ve kanary raporlarında aynı değişkenliği ifade etmelidir.

Versiyon kontrolünde düzenleme şemelerini saklayın. Çıkarım sisteminizde düzenlenmiş çalıştırma kanıtlarını saklayın. Kısa ömürlü ham çekimleri sadece olay erişim kontrolleri altında saklayın.

## İnteraktif Laboratuvar

### Laboratuvar A: Çağ sınırını kanıtla

- Evet .`code`Dizin, açık Python:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code
python3 -q
```

Çık:

```python
from main import *
validate_result({"tools": []}, "legacy")
validate_result({"tools": []}, "modern")
```

Eski çağrı sonuçları .`complete`Modern çağrılar ortaya çıkıyor .`ProtocolViolation`Şimdi geri dönüş testi:

```python
select_era({"kind": "timeout"}, "fallback")
select_era(
    {"kind": "timeout"},
    "fallback",
    legacy_allowed=True,
    legacy_evidence={"kind": "initialize_success", "protocolVersion": LEGACY_VERSION},
)
select_era({"kind": "jsonrpc_error", "code": -32021}, "fallback")
```

İlk zamanlama kapanmaz çünkü sessizlik mirasçı kanıt değildir. İkinci çağrı sadece yapılandırma izin verdiği için miras seçer ve geçerli bir miras başlangıç sonucu gözlemlenmiştir. Tanınan eksik kapasite hatası modern dalı kanıtlar.

### Laboratuvar B: Ekleyici alan karşı ayrımcı

```python
validate_result({"resultType": "complete", "tools": [], "futureHint": True}, "modern")
validate_result({"resultType": "future_mode", "tools": []}, "modern")
```

İlk sonuç korunmuştur .`futureHint`İkinci, yaşam döngüsü ayrımcılığı bilinmemesi nedeniyle reddedildi.

### Laboratuvar C: SDK dönüşümünü incelemek

```python
compare_sdk_view(
    {"resultType": "complete", "tools": [], "futureHint": {"mode": "new"}},
    {"tools": []},
)
```

Bileşeninizin görmezden gelebileceğini belirleyin .`futureHint`Bu seçeneği serbest bırakma politikasına yazın.

### Laboratuvar D: vekili tamir edin

Demo değişimini değiştirin böylece çıkışın köken statüsünü ve vücudu korur.`python3 main.py`Proxy sorunları ortadan kalkacak ama SDK farklılığı hala promosyonları engeller.`futureHint`SDK görünümünde ve eylem değişikliğini gözlemleyin `promote`Her kanıt kaynaması geçtikçe.

## Pratik Laboratuvar

İsteğe göre taratılmış SSE transkriptlerini kemere ekleyin.

Gereksinimler:

- Cevap durumunu, içerik türünü, SSE olaylarını ve akış sonunu yakalayın.
- Her JSON-RPC olayının geçerli bir çağ-spesifik bir sonucu veya hata olduğunu kanıtlayın.
- Göndermeden önce tüm akışı tamponlayan bir vekil için negatif bir durum ekleyin.
- JSON-RPC kimliği istekten farklı olan bir SSE olayı için negatif bir durum ekleyin.
- Kanıt yazmadan önce olay verilerini yeniden yazın.
- Sağlık penceresinde akış süresi, ilk olay gecikmesi ve olay sayısını ekleyin.
- Sızdırma kapısı akım ters düştüğünde sadece kanıtlanmış bir geri dönüş hedefi seçsin.

Başarı, aynı vaka doğrudan ve vekil aracılığıyla geçer ve davranış değişikliğinin tam sınırı belirlenen bir rapor ile gerçekleşir.

## Nakliye edilen Sanatlı

Bu ders gemileri `outputs/skill-mcp-conformance-release-gate.md`. Bir sunucu, istemci, geçit veya SDK değişikliğini bir sürümlü uyumlu matris ve yayın kararına dönüştürmek için kullanın.

## Kontrol et

Demo ve Deterministik Suite'i çalıştır:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

Verifikasyon, şunu kanıtlamalıdır:

- Altın ve negatif transkriptlerin hepsi beklenen sonuçlara ulaşır .
- modern istekler tam isim aralığı metadata anahtarları gerektirir
- HTTP başlık isimleri durumlara karşı duyarlı ve kodlanmıştır `Mcp-Name`Değerler tam olarak çözülmüştür.
- Başlık ve vücut eşleşmezliği modern eşleşmezlik kodu gönderir
- cevap versiyonu, kimlik, sonuç veya hata eksikliği, hata şekli ve HTTP haritası doğrulanır
- Metodeye özel araç listesine, görevlere ve tamamlama yüklerine ilişkin gereklilikler uygulanır.
- Her gözlemlenmiş şey .`HeaderMismatch`gerçek bir HTTP 400 JSON-RPC gerektirir `-32020`tepki
- ham`Mcp-Name`Beyaz alan, tam bir sentinel kodlanmış beyaz alan geri dönüş yolculukları sırasında reddedildi.
- Kaybolmuş bir adam .`resultType`Sadece seçilen miras dönemi için geçerlidir.
- Ekle alanlar çiğ doğrulama sağlanırken bilinmeyen sonuç türleri başarısız olur
- Genişleme sonuç türleri reklamlı yeteneklerini gerektirir
- Günümüzün yanlışları asla eski bir düşüşe neden olmaz.
- bildirimler JSON-RPC cevabını vermez
- SDK muhasebe çıkarma ve semantik alan kaybı ayırt edilir
- proxy hatası çöküşü tespit edilir ve kimlikler camelCase ve separator çeşitleri arasında geri dönüşlü olarak silinir
- Geliştirme boş olmayan transkripti, SDK, vekillik ve sağlıklı operasyonel kanıt gerektirir.
- İstihbarat ve geri dönüş hem de doğrulanmış, sabitlenmiş, aktif ve sağlıklı bir geri dönüş hedefi gerektirir.

## Üretim Başarısızlık Modları

| Failure | What the weak test reports | What the harness must prove |
|---|---|---|
| SDK synthesizes a missing discriminator | “tools/list passed” | Raw modern result lacked `resultType` and is invalid |
| Client downgrades after `-32021` | “legacy retry worked” | Recognized modern error forbids fallback |
| Unknown result type treated as complete | “response parsed” | Unadvertised lifecycle discriminator is rejected |
| Proxy authorizes one tool and origin executes another | “request reached server” | `Mcp-Name` equals the body routing name at every hop |
| Harness throws before reading the server response | “header mismatch test passed” | HTTP 400 and JSON-RPC `-32020` response are captured and validated |
| Proxy turns origin 400 into generic 500 | “upstream error” | Origin and egress statuses and JSON-RPC bodies are preserved |
| Notification middleware emits `{result: null}` | “handler returned none” | Final egress body is empty and no JSON-RPC response exists |
| SDK strips an additive field | “typed objects match” | Raw and normalized views show the exact dropped field |
| Failure artifact leaks a bearer token | “debug bundle uploaded” | Redaction occurred before hashing, logging, or upload |
| Credential key style bypasses redaction | “denylist contains api_key” | CamelCase and separator variants share one canonical denylist form |
| Canary has no samples but appears healthy | “zero errors” | Minimum sample count is enforced |
| Rollback selects an unknown build | “previous deployment restored” | Target version, admission digest, pins, status, and health are present |

## İşlem Kuralı

Gönderdiğiniz baytları, gönderdiğiniz baytları, gönderdiğiniz her aracı ileriye, SDK'nin ortaya koyduğu semantikleri ve baskı altında kullanacağı kanıt işlemlerini test edin. Dayanıklılık açık bir daldır. Rollback kanıt temin edilen bir yayın eylemidir. İzin veren bir analizcinin tesadüfen yan etkisi olmamalıdır.

## Daha Fazla Okumak

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP version negotiation](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Official MCP conformance project](https://github.com/modelcontextprotocol/conformance)
