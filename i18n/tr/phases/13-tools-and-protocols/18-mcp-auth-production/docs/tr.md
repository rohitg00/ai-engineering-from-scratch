# Üretimdeki MCP Auth: Emitter-Bind Enrollment ve Tokens

> Ders 16 OAuth 2.1 devlet makinesi inşa etti. Bu ders MCP 2026-07-28 için üretim sınırlarını sertleştirir: Önce Client ID Metadata Belgeler, sadece uyumluluk için geçersiz dinamik kayıt, yetki- yanıt emiten onay, emiten anahtarı müşterilerinin kimliklerini, JWKS yenilenmesi ve her devletsiz istek üzerinde izleyiciler tarafından dayalı tokenler.
>
> **Spec note (2026-07-28):**Dinamik Müşteri Kayıtlaması, Müşteri Kimliği Metadata Belgelerinin yararına geçersiz hale getirilmiştir. DCR uyumluluk mekanizması olarak kalır. Kullanıldığında, müşteri doğru olduğunu belirtir `application_type`Bir müşteri mevcut RFC 9207 ' i onaylar .`iss`yetki sunucu emitenler arasında kimlik kimliklerini değerlendirir ve asla tekrar kullanmaz.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- RFC 8414 metadataları üzerinden yetki sunucusu bulun ve sözleşmeyi doğrulayın.
- Müşteri Kimliği Metadata Belgesini kaydet ve eski DCR'yi geri dönüş olarak izole et.
- RFC 9207' yi geçerli kılmak `iss`, yetki sunucu emitenin anahtar kayıtları ve emitenin ek kaynaklı anahtar tokenleri.
- JWKS anahtarlarını bir programda saklayın ve yenilenti yapın ki imza doğrulama anahtarın devrilmesi sırasında hayatta kalsın.
- RFC 8707 kaynak göstergeleri kullanarak tek bir MCP kaynağına tokenler bağlayın ve karışık bir vekil yeniden kullanımı reddedin.
- JWT doğrulama veya belirti içgörüsü seçin, iptal tazeliğini tanımlayın ve kimlik bağımlılıkları bulunmadığında güvenli bir şekilde başarısız olun.
- Yetki sunucusu, kaynak sunucusu ve istemciyi ayırın böylece her biri sadece kendi kontrollerini uygulayabilir.
- Yetki sunucusunu dağıtım kontrol listesi ile karşılaştırın ve güvenli olmayan kayıt veya token yeniden kullanımı reddedin.

## Sorun

Ders 16 simülatörü OAuth 2.1'i bellekte çalışır. Üretim sadece bellek simülatörü görmeyen üç işletim boşluğuna sahiptir.

İlk boşluk kayıt ve kredi izolesi. Gerçek bir organizasyon yüzlerce MCP sunucusu ve binlerce MCP istemcisi çalıştırabilir. 2026-07-28'deki revizyona göre bir **Client ID Metadata Document**: müşteri, tanımlayıcı olarak kontrol ettiği bir yolla HTTPS URL kullanır ve yetki sunucusu metadata çekir. RFC 7591 dinamik kayıt sadece eski uyumluluk yolu olarak kalır. DCR kaçınılmaz olduğunda, istek doğru olduğunu ilan eder `application_type`. Müşteri , kayıtları izin sunucu emitenin ve erişim tokenlarını `(issuer, resource)`Değişen bir emiten yeni bir kayıt anlamına gelir ve farklı bir kaynak ise farklı bir kitle için belirtilmiş bir token anlamına gelir.

İkinci boşluk anahtar dönüştürülmesidir. JWT doğrulama, yetki sunucusunun imza anahtarlarına bağlıdır, JSON Web Key Set (JWKS) olarak yayınlanır. Yetki sunucusu bunları bir programda döndürür (sık sık saatte, bazen olay tepkisi altında daha hızlı). Bir kez JWKS'i başlatırken getiren bir MCP sunucusu, dönüş penceresine kadar doğrulamayı başarır  sonra yeniden başlatıncaya kadar her istek başarısız olur. Üretim kabloları JWKS'i önbelleğe kaydedilen bir değere sahip, önceki anahtarların sona ermesinden önce önbelleği üstü yazır ve önbelleğe daha yeni bir anahtar tarafından imzalanan bir token geldiğinde önbelleğe kaydedilen durum için önbelleğe geri dönme kaydını getirir.

Üçüncü boşluk, kitle bağlayıcılığıdır.16 ders RFC 8707 kaynak göstergeleri tanıttı.`token.aud`Bu, bir sunucu için amaçlanan bir token tutan bir MCP sunucusu (veya kötü niyetli bir istemci) bu token'ı aynı güven ağında başka bir sunucuya karşı oynamasından korunmak için tek savunma.

Bu ders, her boşluğu bir beton parçası üzerinde haritası yapar. Metadata belgesi bir HTTP son noktasıdır. JWKS önbelleği güncelleme programlı bir iş ve anahtar değerli bir önbelleğe sahiptir. JWT doğrulama, herhangi bir aracı göndermeden önce kaynak sunucusu tarafından çalıştırılan bir rutindir. Üç rolü ayrı tutun ve her biri sadece sahip olduğu kontrolleri uyguluyor: yetki sunucusu anahtarları çıkarır ve döndürür, kaynak sunucusu önbelleği ve onaylar, istemci keşfeder ve kayıt yapar.

## Uygulama: Ders 16'dan sonra üretim uygulanması

[Lesson 16: MCP Security with OAuth 2.1](../../16-mcp-security-oauth-2-1/docs/en.md)Bu ders ikinci bir OAuth akışını tanımlamaz. Bu sözleşmeler var olduktan sonra başlar ve dağıtılan bir kaynak sunucusu anahtar dönüşüm, açık olmayan token doğrulama, iptal, bağımlılık başarısızlığı, dağıtım ve olay tepkisi sırasında bunları nasıl uyguluyor sorar.

Üretim sınırı daha dar ve daha operasyonel:

- JWT yolu, sabit bir emitenin, algoritmanın, imza anahtarının, izleyicinin, zaman taleplerinin ve her talebin kapsamını doğruluyor.
- Açıklama olmayan bir token yolu, emitenin doğrulanmış içsel gözlem son noktasını çağırır ve geri gönderilen aktif durumu, kitle veya kaynak, sona ermesi, konu ve kapsamı doğruluyor.
- İptal politikası, bir tanıklık bilgisinin ne kadar hızlı çalışmayı bırakması gerektiğini ve hangi önbelleğin bu gerçeği geciktirebildiğini belirler.
- Başarısızlık politikası keşif, JWKS, iç gözlem veya iptal altyapısı bulunmadığında ne olacağını belirler.
- Emitent metadata, anahtar seti veya içten bakış tepkisi, token talepleri, politika versiyonu ve reddedilme nedeni, token'ı saklamadan sonuçları yönlendirdiği kanıt kayıtları.

Bu ayrım dersleri birleştirir. 16. dersi akışı kanıtlar. 18. dersi bir token'ın gerçek bir MCP istek yoluna ulaştıktan sonra güvenilir kalıp reddedildiğini kanıtlar.

## Anlaşım

### RFC 8414  OAuth yetkisi sunucu Metadata

Bir belge .`/.well-known/oauth-authorization-server`Bir müşterinin ihtiyaç duyduğu her şeyi açıklar:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "client_id_metadata_document_supported": true,
  "registration_endpoint": "https://auth.example.com/register",
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

Bir MCP kaynak URL zinciri keşfi verilen bir istemci: `oauth-protected-resource`RFC 9728'den (resurs sunucusunun belgesinden) emitenin adı verilir, sonra `oauth-authorization-server`(Bu RFC) her son noktayı isimlendirir.

Bir yollu bir kaynak tanımlayıcısı için, bu yolun önüne bilinen segment ekleyin.`https://mcp.example.com/team/server`                  `https://mcp.example.com/.well-known/oauth-protected-resource/team/server`- Ekle .`/.well-known/...`Kaynak yolu yanlış olduktan sonra.

MCP için bir IDP'ye güvenmeden önce onayladığın sözleşme:

- `code_challenge_methods_supported`içerir .`S256`Spec açık: eğer bu alan **absent**, yetki sunucusu PKCE ve müşteriyi desteklemiyor **MUST**Başlamayı reddediyor.
- `grant_types_supported`içerir .`authorization_code`ve reddeder .`password`ve `implicit`- Evet .
- En az bir kayıt yolu mevcut: `client_id_metadata_document_supported: true`(CIMD, tercih edilen), önceden kayıtlı bir müşteri veya`registration_endpoint`(RFC 7591 uyumluluğu azalmış)
- - Eğer`authorization_response_iss_parameter_supported`Doğru, müşteri geri gönderilen RFC 9207'yi istiyor.`iss`ve yeniden yönlendirme öncesi kaydedilen emitenle tam olarak karşılaştırır.
- `response_types_supported`Tam olarak .`["code"]`OAuth 2.1. için.

- Eğer`S256`Eğer PKCE'nin * hiçbir * kayıt yolu reklam edilmiyorsa ve önceden kayıtlı değilseniz `client_id`, kayıt edemezsiniz; görev açıklaması yanlış, kod değil.

### RFC 9728 (recap)  Korunan Kaynak Metadataları

Ders 16 RFC 9728'i kapsar. Üretimdeki delta: Bu belge bir istemcinin * bu * MCP sunucusu tarafından güvenilen yetki sunucularını bulmak için aradığı tek yerdir. Tek bir MCP sunucusu birden fazla IDP'den (bir kişilik için, ortaklar için bir tane) token kabul edebilir. RFC 9728 bu seti açıklar; RFC 8414 her bir IDP'nin desteklediğini belgelendirir.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### Müşteri Kimliği Metadata Belgeler (öntemlendirilen önlenme)

CIMD, kayıtları * push*'den * pull'e çevirir.`client_id`, müşteri kontrol ettiği HTTPS URL kullanıyor **as**- ...`client_id`. URL bir JSON metadata belgesine çözülür; yetki sunucusu OAuth akışı sırasında istek üzerine alır. Güven DNS'te kök salınır: eğer sunucu operatörü güvenir `app.example.com`, müşterinin hizmet verdiğine güveniyor .`https://app.example.com/client.json`- Kayıt yok, dönüş yok.`client_id`İzin alanı tükenir, sunucu başına senkronize edilecek bir durum yok.

Müşteriye konutlanan metadata belgesi:

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

- Evet .`client_id`belgedeki değer **MUST**Servis edilen URL'e eşit (ve yetki sunucusu bunu doğruluyor; eşleşmeyenler reddediliyor).`client_id_metadata_document_supported: true`RFC 8414 metadatalarında.

Mevcut CIMD sözleşmesi için, `client_id`- Evet .`client_name`, ve boş olmayan bir`redirect_uris`Array gereklidir. Müşteri tanımlayıcısı bir yollu mutlak HTTPS URL'dir. `application_type`DCR'nin kopyasını yapmayın.`application_type`Tercih edilen CIMD yoluna.

İki güvenlik faktörü açıkça açık:

- **SSRF.**Yetki sunucusu saldırgan tarafından sağlanan bir URL'yi alır. Sunucu tarafındaki istek sahteliğine karşı savunmalıdır (işçi / yöneticisi son noktalarına hiçbir şekilde alınmaz).
- **localhost impersonation.**CIMD tek başına yerel bir saldırganın meşru bir istemcinin metadata URL'sini talep etmesini ve herhangi birini bağlamasını engelleyemektedir.`localhost`İzin sunucusu **MUST**İzin verme sırasında URI barındırma adının yönlendirilmesini açıkça gösterir ve **SHOULD**Uyarın .`localhost`- Sadece yönlendirme.

CIMD'nin sunucu tarafındaki durumuna ihtiyacı olmadığı için, DCR'nin talep ettiği şekilde durmak için bir kayıtci yoktur. Müşteri tarafı sadece okunur: metadata belgeleri statik bir HTTPS uç noktasından servis edin ve yetki sunucusu çekmesine izin verin.

Yetki sunucu operatörü zaten bir müşteri kimliği sağlamışsa, otomatik kayıt yaptırmadan önce bu emitenin ölçüsünde kayıt yaptırın. Aksi takdirde CIMD'yi tercih edin. Emitenin önceden kayıt yapamayacağı veya CIMD'yi kullanamayacağı durumlarda sadece geçersiz olan DCR'yi kullanın.

### RFC 7591: Geçmişteki uyumluluk kayıtları

DCR 2026-07-28'deki düzeltildiklerinde geçersiz hale geldi. CIMD'yi tüketemeyen ve önceden kayıt pratik olmayan yetki sunucuları için tutun.

```json
POST /register
Content-Type: application/json

{
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

Sunucu cevap verir:`client_id`ve bir `registration_access_token`Sonraki güncellemeler için:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`application_type`Bir loopback masaüstü istemcisi açıklıyor`native`; bir sunucu barındırılmış istemci açıklamasını yapar `web`HTTPS yönlendirmesi URI'lerini kullanıyor. `token_endpoint_auth_method: none`Bu, yerel bir müşterinin için doğru varsayımdır.`client_id`Sadece PKCE'nin sahip olduğu kanıtını sağlaması gerekmektedir.

Üç üretim tuzağı:

- Kayıt son noktası kaynak IP'ye göre sınırlama oranı olmalıdır.`client_id`Kayıtçı talebi ele almadan önce ücret sınırını kontrol et.
- `software_statement`(klient için imzalanan JWT teminatı) bazı işletme IDP'leri tarafından gereklidir. Dersin sahteliği bunu atlar; üretim kabloları, localhost yönlendirmesinden başka herhangi bir şeyden imzalanmamış kayıtları reddeden bir doğrulama adımı atlar.
- - Evet .`registration_access_token`Bu token çalınması saldırganın istemcinin yönlendirmelerini yeniden yazabilmesi anlamına gelir.

### RFC 8707 (recap)  Kaynak göstergeler

Ders 16 şekli belirledi. üretim kural: her token talebi içerir `resource=<canonical-mcp-url>`, ve MCP sunucusu doğruluyor `token.aud`Kanonik URI, sunucu için * en spesifik* kimlik kimliğidir: küçük harflerle şema ve host kullanır, parça yoktur ve geleneksel olarak arka kesik yoktur.**not** spesifikasyon, bireysel bir MCP sunucusu tanımlamak için gerekli olduğunda saklar. `https://mcp.example.com`- Evet .`https://mcp.example.com/mcp`- Evet .`https://mcp.example.com:8443`ve`https://mcp.example.com/server/mcp`Tüm geçerli kanonik URI'ler.`aud`Bu dersin numarası, çıplak host izleyicileri kullanıyor.`https://notes.example.com`Kısaca olarak; bir MCP sunucusunun bir kaynağı altında birlikte barındırıldığı bir dağıtım, onları yol açısından ayırt eder.)

### RFC 7636 (recap)  PKCE

PKCE, OAuth 2.1'de zorunlu.`code_challenge`ve `code_verifier`. Sunucu, verifikatör olmadan veya kaydedilen meydan okumaya hash yapmayan bir verifikatör ile herhangi bir token talebini reddeder.

### MCP 2026-07-28 yetki profili

Mevcut MCP reviziyonu, MCP nakliyesi devresiz hale getirirken OAuth kaynak-sörver sınırını korur. Kimlik kararını önbelleğe koyacak bir protokol seansı yoktur. Bu nedenle yetki katmanı her talebi bağımsız olarak doğruluyor:

- RFC 9728 korunan kaynak metadatalarını uygula ve konumunu ya `WWW-Authenticate: Bearer resource_metadata="..."`401 ' de başlık**or**Tanınmış URI `/.well-known/oauth-protected-resource`(SEP-985 başlığı bilinen bir geri dönüş ile seçkin yaptı).`authorization_servers`alanı**MUST**En az bir sunucuya isim verin.
- Tokenleri sadece  üzerinden kabul edin`Authorization: Bearer ...`- Evet .**every**sorgu  asla sorgu dizisinde, asla yalnızca oturum başlangıcında doğrulanmaz.
- Geçerlileştir`aud`- Evet .`iss`- Evet .`exp`, ve istek başına gerekli alanlar .**MUST**Tokenin özel olarak ona (seyirciye) gönderildiğini onaylayın; eksik veya eşleşmemiş bir not`aud`reddedildi, asla bir wildcard olarak değerlendirilmedi.
- 401/403'te geri dön.`WWW-Authenticate: Bearer`taşımacılık`error=...`, `resource_metadata="<PRM-URL>"`parametre (metadata belgesinin URL'si, *aklı kaynak değil*) ve `scope="..."`- Evet .`insufficient_scope`Not: parametre `resource_metadata`, bir keşif işaretçisi  yok `resource`Çabada bir parametredir.
- Yetki sunucusu keşif kabul eder **either**RFC 8414 OAut metadata **or**OpenID Connect Discovery 1.0; müşteriler öncelik sırasıyla her iki tanınmış eklentiyi denemeleri gerekir.
- Müşteri (server değil) **mix-up attacks**Bu , beklenenleri kaydeder .`issuer``iss`PKCE'nin tek başına karışımı durdurmaz, çünkü müşteri kendi `code_verifier`Neye yönlendirilmişse yönlendirilmiş olsun.
- Bir müşteri krediteleri bir yetki sunucu emitenine aittir.`client_id`, kayıt simgesi veya erişim simgesi.
- CIMD, kayıt için tercih edilen mekanizmadır. DCR geçersiz hale geldi; uyumluluk DCR talebi hala doğru olduğunu belirtir `application_type`- Evet .

OAuth 2.1 taslakı altyapıdır; RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD yüzeyidir; MCP spesifikasyonu profilidir.

### Uygulama yetenekleri kontrol listesini

Satıcı özellikleri tabloları hızla eski hale gelir. Bunun yerine gerçekte dağıtmak istediğiniz yetki sunucusu tarafından gönderilen metadataları kontrol edin. Geçit mekanik:

| Check | Required decision |
|---|---|
| Discovered issuer | Exact HTTPS issuer expected by policy |
| PKCE | `S256` advertised; otherwise stop |
| Enrollment | CIMD preferred, pre-registration accepted, DCR only as deprecated compatibility |
| Authorization response | Validate RFC 9207 `iss` when present or advertised |
| Resource binding | Token request carries `resource`; resource server requires the matching `aud` |
| Credential storage | Key client IDs and registration credentials by issuer; key access tokens by issuer plus resource |
| DCR compatibility | Declare `native` or `web`; reject redirect URIs that do not fit the declared application type |

Bir ürün adı veya fiyat seviyesinden destek çıkarmayın. Bulunan belgeyi dağıtım kanıtlarında yakalayın ve zorunlu bir alan eksik olduğunda kapatılmayı bırakın.

### JWKS yenilenme örneği (AS'de dön, kaynak sunucusunda yenilen)

İki fiili ayrı tutun, çünkü onları birleştirmek gerçek bir üretim hatasıdır:

- **Rotate*** yetki sunucusu* ne yapar: yeni bir imza anahtarı çiziyor, JWKS'de yayınlıyor, eski bir anahtarı daha sonra geri çekmektedir.
- **Refresh*** kaynak sunucusu* ne yapar:`GET`Bu, bir kaynak sunucusu tarafından gerçekleştirilen tek JWKS eylemidir.

Üretim başarısızlığı modu eski bir önbellektir. Bunu programlı bir yenilenme işi ile birlikte bir anahtar değeri önbelleği ile çözün. Kaynak sunucusu bir iş (cron, zamanlayıcı, çalıştırma süresi ne olursa olsun) çalıştırır ve sabit bir arala, `<issuer>/.well-known/jwks.json`ve üst yazılar.`cache[issuer] = {keys, fetched_at}`Validatör bu önbelleği okuyor.`kid`Keş tetikleyicilerinden kayıp .**one**Bu, bir kez daha iki vaka ele alıyor: planlı yenileme ve yeni bir anahtarla imzalanan bir token, bir sonraki planlı yenileme öncesi geldiği anahtar üstlenme pencereleri.

Geri dönüş .**must be a re-fetch, never a rotate**Eğer önbelleği kaybedilen yolu bir dönüp-mentiye yönlendirirseniz iki şey kırılır: (1) taze bir anahtarı kessin bir `kid`* hala * token ile eşleşmiyor, bu yüzden arama her şekilde başarısız olur; ve (2) numayel olarak token püskürten bir saldırgan `kid`Değerler sınırsız bir dizi anahtar yaratma zorlar  kendi kendine uygulanan bir DoS. Bir yeniden alım yetersiz, bu yüzden bir sahte `kid`En fazla bir atış masrafı.

Önbelleğin şekli:

```json
{
  "https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

Bir anda iki anahtar sabit durumdur. yetki sunucuları bir sonraki anahtarı girerek döner (`k_2026_04`) önceki yılları emekliye almadan önce (`k_2026_03`), böylece eski anahtar altında verilen tokenler sona erene kadar geçerli kalır.`kid`- Evet .

### Valideleme rutinleri

MCP sunucusu herhangi bir aracı göndermeden önce doğrulama yürütür.`code/main.py`Kullanım:

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate`JWT'yi çözüyor, JWKS önbelleğinden imza anahtarını çözüyor (bir defa sıfırlıyor), imza doğruluyor, sonra kontrol ediyor `iss`izin listesi karşısında,`aud`Bu sunucu'nun kanonik kaynağına karşı.`exp`, ve gerekli kapsamı  bir `WWW-Authenticate`İlk başarısızlıktan sonra bir rutin olarak kaynak sunucusunda tutmak, her giriş noktasının (her araç çağrısı, her taşıma) aynı kontrollerden geçmesi anlamına gelir.

### Çürük simgeler, tahmin değil, içgörü kullanır

Her erişim tokeni JWT değildir. Eğer emiten açık olmayan bir token'ı belgelese, kaynak sunucusu onu güvenilir iddialara dekode edemez. Tokeni emitenin RFC 7662 içsel gözlem son noktasına doğrulanmış bir arka kanal üzerinden gönderir ve gerektiriyor.`active: true`, beklenen emitenin bağlamı, tam MCP kitlesi veya kaynağı, sona ermemiş zaman talepleri ve belirli araç tarafından talep edilen kapsamlar.

Emitent tarafından önbelleğe girme, tek yönlü bir token digest ve MCP kaynağı. Hiç de açık bir simgeyi bir günlük veya önbelleğe etiket olarak kullanmayın. Token'in en erken sona ermesi, emitenin önbelleği rehberliği ve dağıtımın iptal edilmesi yenilik amacı ile pozitif bir önbelleğe girmeyi bağlayın. Yeni yayınlanan bir token yanlış olarak hareketsiz kalmasın diye negatif önbelleği yeterince kısa tutun. Bir kaynak için bir sonuç, açık olmayan simge ipliği aynı olduğunda bile başka bir kaynağa yetki veremez.

Saldırgan tarafından kontrol edilen token içeriğinden geçerlilik modunu seçmeyin. Valide edilen emitenin metadata ve dağıtım yapılandırmasına JWT'yi kendi kendine gözlem davranışına karşı pin yapın. JWT yolunda, pin kabul edilmiş algoritmalar ve güvenilir `jwks_uri`; asla sadece token başlığı tarafından seçilen bir anahtar URL veya algoritma takip etmeyin.

### İptal yenilik sözleşmesi.

RFC 7009 bir istemci bir yetki sunucusuna bir token'ı iptal etmesini istemesini sağlar. Bu taleb her kaynak sunucusunun zaten önbelleği altında bulunan kopyaları silmez. Maksimum kabul edilebilir iptal gecikmesini tanımlayın ve her önbelleği ona saygı gösterin.

Açık olmayan jetonların dağıtılması, her yüksek riskli çağrıyı içtenlikle gözlemleyerek veya kısa bir pozitif önbelleği kullanarak daha sıkı bir iptal elde edebilir. Kendini koruyan JWT dağıtımları genellikle kısa erişim jetonlarının ömrünü, yenilenme jetonlarının iptal edilmesi, emitenin genelinde gerçekleşen olaylar için anahtarların geri çekilmesi ve acil yerel reddedilme için seçmeli bir konu, seans veya jeton-id denil listesi ile birleştirir. İmza edilen JWT, kaynak sunucusunun mevcut dış iptal kanıtı olmadıkça, sona erene kadar kriptografik olarak geçerli kalır.

Logout, hesap etkisizleştirme, onay çekme ve olay tepkisi farklı tetikleyicilerdir ancak bir ölçülebilir ifade üzerinde birleşmelidir: en fazla ilan edilen iptal penceresinden sonra, her kopya tanıtım tanıtımını reddeder.

### Bağımsızlık başarısızlığı açık bir karar gerektirir

Asla bir istisna yöneticisi içinde kullanılabilirlik politikasını improviz etme.

| Failure | Safe production behavior |
|---|---|
| Scheduled JWKS refresh fails, known `kid` remains in a still-valid bounded cache | Continue only within the declared stale-on-error window and emit degraded health evidence |
| Token has an unknown `kid` and the one allowed refresh fails | Reject; never accept an unverifiable signature |
| Introspection is unavailable | Fail closed for protected calls; do not convert network failure into `active: true` |
| Protected-resource or issuer metadata changes unexpectedly | Stop new enrollment and token acquisition; keep only explicitly pinned, unexpired configuration under a bounded incident policy |
| Revocation endpoint is unavailable | Report logout or revocation as incomplete, retain the credential locally as unusable when possible, and do not claim global revocation succeeded |
| Clock source or claim type is invalid | Reject rather than widening skew until the token passes |

Başarısızlıkları geçersiz kimliklerden ayrı olarak sınıflandırın. Bir bağımlılık kesintisi sağlık ve yeniden deneme politikası ile ilgili bir operasyonel hatadır. Kötü bir imza, emiten, izleyici, sona erme veya kapsam bir yetki reddedilmesidir. Her ikisi de araç yöneticisine ulaşmaz ve hiçbirisi token içeriğini denetim kanıtlarına sızdırmamalıdır.

### İzleyici tekrarlaması geçiş (erginlik belirtileri hakkı kısıtlaması)

Sunucu A (`notes.example.com`) ve Server B (`tasks.example.com`Bu durum, bir kullanıcıya karşı bir saldırganın not tokenini alıp B sunucusu ile tekrar oynatması anlamına gelir.

B sunucusunun onaylayıcı:

1. JWT'yi çöz, JWKS'i getir `kid`İmzanı doğrulayın.
2. Kontrol et .`iss`Korunan kaynak metadatalarına karşı `authorization_servers`(Önceyi aynı IDP'yi geç.)
3. Kontrol et .`aud == "https://tasks.example.com"`(Fall  token's `aud`- Evet .`https://notes.example.com`.)
4. 401 ' i geri getir .`WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"`- Evet .

İzleyiciler iddiaları, protokol katmanındaki bu saldırıya karşı tek savunmadır. Performansı için atlamak en yaygın üretim hatasıdır; onaylayıcı sadece oturum başlaması sırasında değil, her istek üzerinde çalışmalıdır.**access-token privilege restriction**: bir MCP sunucusu `MUST`İzleyiciler arasında adını kullanmayan herhangi bir simgeyi reddet.

> **Naming note.**Spec, * karışık bir yardımcı * terimi ile ilgili ama belirgin bir sorun için saklı tutar: bir OAuth olarak hareket eden bir MCP sunucusu **proxy**Bir istemci için kullanıcı onayını almadan bir token gönderen, statik bir istemci kimliği kullanan üçüncü taraf bir API'ye. İzleyici bağlaması yukarıdaki tekrarlamayı düzeltir; karışık-birimleme düzeltmesi ise istemci için onaydır **plus**Gelen token'ı asla yukarı akımdaki API'lere (MCP sunucusu) geçirme`MUST`Kendi ayrı bir yukarı akım tokenini elde et).

### Karışık saldırılar (server sağlayamayan bir istemci taraflı savunma)

Bir istemci, yaşamı boyunca birçok yetki sunucularıyla konuşur. Bir kötü niyetli AS, istemciyi saldırganın token son noktasında dürüst bir AS'in yetki kodunu satın almaya çalışmayabilir. Seyirci bağlanması burada yardımcı olmaz  saldırı herhangi bir token var olmadan önce gerçekleşir. Savunma istemci içinde yaşar (RFC 9207):

1. Değiştirmeden önce, müşteri beklenenleri kaydeder `issuer`onaylanmış AS metadatalarından.
2. İzin verdiği cevapta, müşteri geri gönderilenleri karşılaştırır `iss`Kodun herhangi bir yere gönderilmeden önce kaydedilen emitenin karşısında parametre (sadece bir string karşılaştırması, normalleştirme yok).
3. Uygunsuzluk (veya `iss`AS reklam verildiğinde yok `authorization_response_iss_parameter_supported`) → reddetmek ve göstermek bile değil `error`Alanlar.

PKCE tek başına karışıklığı durdurmaz, çünkü müşteri kendi`code_verifier`Bu nedenle, spesifikasyon, PKCE doğrulayıcısı ile birlikte, talep üzerine emitenin kaydedilmesi ve`state`- Evet .

### Başarısızlık modları

- **Stale JWKS.**AS bir anahtarı döndürdükten sonra geçerli jetonları onaylayıcı reddeder. Düzeltme yukarıdaki cron-refresh + cache-miss-refetch örneğidir.
- **Rotate-as-fall-back.**Kayıp yolu yeniden almak yerine bir ayarla-ve-minte yönlendirmek gerçek bir hata: asla kayıpları üretmez `kid`, ve saldırgan tarafından kontrol altına alınır .`kid`Bu değerler anahtar oluşturma DoS'ye girmelidir.`refresh-jwks`- Evet .
- **Missing `aud` claim.**Bazı İDP ' ler default olarak atlatma yaparlar `aud`Tabii ki`resource`Validör, eksik olan tokenleri reddetmelidir.`aud`, yokluğu bir oyun gibi görmüyor.
- **Mix-up via missing `iss` check.**RFC 9207 ' yi onaylamayan bir müşteri`iss`Bu, bir saldırganın token son noktasında dürüst bir AS kodu satın almaya yönlendirilebilir. Bu bir müşteri tarafında bir hata; kaynak sunucusu bunun telafi edilmesini sağlayamaz.
- **Scope upgrade race.**Aynı kullanıcı için iki eşzamanlı yükseltme akışı hem başarılı olabilir hem de farklı kapsamlı iki erişim jetonu üretebilir. Validasyoncı, bir TOCTOU penceresi oluşturan "kullanıcının mevcut kapsamı" 'yi aramak yerine, istek üzerinde sunulan jetonu kullanmalıdır.
- **Registration token theft.**Sızmış bir şey .`registration_access_token`URI'leri yeniden yazmasına izin verir. Bu URI'leri sabitleştirir.
- **`iss` not pinned.**Herhangi bir onaylayıcıyı kabul eder.`iss`saldırganın kendi yetki sunucusu kurmasına izin verir, hedef kitle için bir istemci kaydeder ve tokenler verir.`authorization_servers`list izin listesi; uygulayın.
- **Credential or token cache collision.**Kaynaklar için yalnızca kaynaklar ile kayıt anahtarları kullanan bir istemci, bir yetki sunucusunun kimliğini diğerine sunar. Sadece emiten tarafından giriş tokenleri açan bir istemci, yanlış kitleye bir token oynatabilir. Valide edilmiş emiten tarafından anahtar kayıtları, anahtar erişim tokenleri tarafından tekrar oynanır.`(issuer, resource)`, ve emitenin değişmesiyle yeniden kayıt yaptırmak.

```figure
t3-jwks-rotate
```

## Kullan

`code/main.py`Stdlib Python ile tüm üretim akışını yürütür ve üç rolü: `AuthorizationServer`- Evet .`ResourceServer`ve`Client`Akış:

Depo kökü ile çalıştır:

```bash
cd phases/13-tools-and-protocols/18-mcp-auth-production
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

İlk komut, emitenin bağladığı kayıt ve token onayını basıyor.
İkinci komut 18 kontrolden geçiyor.
ağ dinleyicisi veya kimlik bilgileri yazar.

1. Yetkililik sunucusu RFC 8414 metadatalarını `/.well-known/oauth-authorization-server`- Evet .
2. MCP istemcisi metadata son noktasını arıyor ve kayıt seçeneklerini kontrol ediyor (`client_id_metadata_document_supported`CIMD için, `registration_endpoint`DCR için) ve `S256`PKCE desteği.
3. Müşteri, emitenin ölçümlü bir önceden kayıt için kontrol eder, aksi takdirde HTTPS Müşteri Kimliği Metadata Belgesini kullanarak kayıt yapar. Deprecated DCR ayrı olarak test edilebilir bir uyumluluk yöntemi olarak kalır.
4. Müşteri onaylanmış emitenin kayıtlarını yapar, S256 meydan okumasını yapar, bir kez izin kodunu ve bir de `iss`, gönderilen emitenin doğrulanmasını onaylar ve kodu orijinal doğrulayıcı ve RFC 8707 ile satın alır `resource`gösterge.
5. MCP istemcisi , MCP sunucusundaki bir aracı `Authorization: Bearer ...`- Evet .
6. MCP sunucu çalıştırılıyor `validate`, JWKS önbelleğinden imza anahtarını çözmek.
7. IdP bir anahtarı döndürür; programlı yenilenme JWKS'yi önbelleğe geri çeker.
8. Bir sonraki çağrı yeniden başlatılmadan yenilenmiş tuşlara karşı geçerlidir ve önceki token yine üst üstelik penceresi sırasında geçerlidir.
9. Başka bir MCP kaynağıyla izleyici oyunu tekrarlama girişiminde 401 kazanılır .`audience mismatch`ve bir `resource_metadata`- İpucu.

JWT burada HS256'yi ortak bir sır ile kullanır (böylece ders sadece stdlib'de çalışır). Üretim yukarıdaki JWKS örneği ile RS256 veya EdDSA kullanır; doğrulama mantığı başka türlü aynıdır.`refresh_jwks`yetki sunucusunun anahtar listesini doğrudan okuyor; tel üzerinden HTTP `GET`- ...`jwks_uri`- Evet .

## Gönder

Bu ders bize çok yararlı .`outputs/skill-mcp-auth.md`. MCP sunucu yapılandırması ve bir IdP yetenek seti göz önüne alındığında, yetenek,  korunan kaynak metadatalarını, kullanılacak kayıt yolu (CIMD, önceden kayıt veya DCR geri dönüş), JWKS yenilenme programını, kapsam haritasını ve IdP'nin tam RFC profilli desteklemediğinde uygulanmayı reddetme kurallarını yayar.

## Egzersizler

1. Çık .`code/main.py`. Akışın izini sür. IdP'nin, senaryo çıkışının 6. aşamasında (yukarıdaki akışın 7. aşamasında) nasıl bir anahtarı döndürdüğünü, programlanmış `refresh_jwks`yayınlanan set'i yeniden çekir ve hem eski token (tıklama penceresi) hem de yeni token yeniden başlatılmadan geçerlidir.

2. Korunan kaynak metadatalarına yeni bir IDP ekleyin `authorization_servers`list. Yeni IdP tarafından imzalanan bir token gönderin ve onaylayıcı tarafından kabul edildiğini onaylayın. Listelenmemiş bir IdP tarafından imzalanan bir token gönderin ve onaylayıcı tarafından reddedilenleri onaylayın.`WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`- Evet .

3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              `register_client`Bir kayıtçı bir talebi kabul etmeden önce çalıştırılan.

4. RFC 7591'i okuyun ve ders için iki alan belirleyin `/register`Yöneticisi onaylamıyor.`software_statement`ve `redirect_uris`URI sistemi.)

5. İkinci bir yetki sunucusu ekleyin. Müşteri'nin bir emitenin anahtarı ile ayrı bir kayıt kaydettiklerini ve ilk emitenin tokenini yeniden kullanmayı reddettiğini onaylayın.`client_id`- Evet .

6. Değerlendiriciye rastgele bir token gönder.`kid`ve onaylayın .`refresh_jwks`en fazla bir kez çalışır ve yetki sunucusunun anahtar sayısı büyümüyor. Sonra kasıtlı olarak geri dönüşü bir döner-ve-mint olarak yeniden kablo ve sahte token başına anahtar sayısının yükselişini izleyin  tekrar geri alınmayı sonra.

7. İkisiyle de DCR 'yi kullanmayı alıştırmak .`native`ve `web`HTTP yönlendirmesi URI ile web istemcisini ve tam bir loopback yönlendirmesi olmadan yerel istemcisini onaylayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ASM | "OAuth metadata document" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | "Client metadata URL" | Client ID Metadata Document: an HTTPS URL used as the `client_id`; the AS pulls the JSON. Preferred enrollment in MCP 2026-07-28 |
| DCR | "Self-service client registration" | RFC 7591 `POST /register`; deprecated for current MCP and retained only for compatibility |
| JWKS | "Public keys for JWT validation" | JSON Web Key Set, fetched from `jwks_uri`, indexed by `kid` |
| Rotate vs refresh | "Updating the keys" | *Rotate* = AS mints/retires signing keys; *refresh* = resource server re-fetches the published set. Resource servers only ever refresh |
| Resource indicator | "Audience parameter" | RFC 8707 `resource` parameter pinning the token to one server |
| `aud` claim | "Audience" | JWT claim the validator compares against the canonical resource URL |
| Audience replay | "Token replay" | Token issued for Server A presented to Server B; defended by audience validation (spec: access-token privilege restriction) |
| Confused deputy | "Proxy token misuse" | An MCP proxy with a static client ID forwarding a token without per-client consent; distinct from audience replay |
| Mix-up attack | "Wrong token endpoint" | Client steered to redeem an honest AS's code at an attacker's endpoint; defended client-side via RFC 9207 `iss` |
| `iss` allow-list | "Trusted authorization servers" | The set named in protected-resource metadata's `authorization_servers` |
| `resource_metadata` | "Where to find the PRM doc" | `WWW-Authenticate` parameter naming the RFC 9728 metadata URL on a 401/403 |
| Public client | "Native or browser client" | OAuth client with no `client_secret`; PKCE compensates |
| `WWW-Authenticate` | "401/403 response header" | Carries `Bearer error=...` directives that drive client recovery |

## Daha Fazla Okumak

- [MCP authorization specification (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)- mevcut MCP yetkisi profilini
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)- CIMD, emitenin onaylanması, DCR'nin geri alınması ve emitenin anahtarı doğrulama belgelerinin değiştirilmesi
- [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) CIMD
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) Bulma sözleşmesi
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) DCR (sıkıntı yolu)
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) Kamu müşteriye ait sahiplik kanıtı
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) Seyircilik
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) kaynak sunucu keşfi
- [RFC 9207 — OAuth 2.0 Authorization Server Issuer Identification](https://datatracker.ietf.org/doc/html/rfc9207) `iss`Karışık saldırılara karşı savunma parametresi
- [RFC 7662: OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 7009: OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
