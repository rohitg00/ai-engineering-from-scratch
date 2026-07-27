# Üretimde MCP Kimlik Doğrulaması — Kayıt, JWKS Yenileme, Hedef Kitleye Sabitlenmiş Token'lar

> Ders 16, OAuth 2.1 durum makinesini bellekte ayağa kaldırdı. 2026 yılına gelindiğinde, gerçek bir kuruluşa gönderdiğiniz her MCP sunucusu, üretim kimlik doğrulamasının arkasında yer alır: sınırsız bir istemci popülasyonuna ölçeklenen istemci kaydı (önce İstemci Kimliği Meta Veri Belgeleri, geriye dönük uyumlu bir geri dönüş olarak dinamik istemci kaydı), yetkilendirme sunucusu meta veri keşfi (RFC 8414 *veya* OpenID Connect Discovery), 3 a.m'yi bozmayan JWKS önbellek yenilemesi. token doğrulaması ve kaynaklar arası yeniden oynatmayı reddeden hedef kitleye sabitlenmiş token'ler. Bu ders, tüm yüzeyi üç rolle (bir yetkilendirme sunucusu, bir kaynak sunucusu (MCP sunucusu) ve bir istemci) modelleyerek keşiften doğrulanmış bir araç çağrısına kadar her atlamayı takip edebilirsiniz.
>
> **Özellik notu (2025-11-25):** Kasım 2025 MCP yetkilendirme özelliği, Dinamik İstemci Kaydını `SHOULD`'dan `MAY`'ye düşürdü ve **İstemci Kimliği Meta Veri Belgelerini (CIMD)** önerilen varsayılan kayıt mekanizması haline getirdi. Bu ders, her ikisini de spesifikasyonun öncelik sırasına göre öğretir ve kod, tek bir süreçte tamamen bağımsız olduğundan, DCR'yi gözden geçirme için tutar.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 13 · 16 (OAuth 2.1 durum makinesi), Aşama 13 · 17 (ağ geçitleri)
**Süre:** ~90 dakika

## Öğrenme Hedefleri

- RFC 8414 meta verileri aracılığıyla bir yetkilendirme sunucusunu keşfedin ve sözleşmeyi doğrulayın.
- RFC 7591 dinamik istemci kaydını uygulayarak MCP istemcilerinin yönetici müdahalesi olmadan kaydolmasını sağlayın.
- JWKS anahtarlarını bir programa göre önbelleğe alın ve yenileyin; böylece imza doğrulaması, anahtar aktarımından sonra hayatta kalır.
- RFC 8707 kaynak göstergelerini kullanarak token'ları tek bir MCP kaynağına sabitleyin ve karışık yardımcıların yeniden kullanımını reddedin.
- Üç rolü (yetkilendirme sunucusu, kaynak sunucusu, istemci) temiz bir şekilde ayırın; böylece her biri yalnızca kendisine ait olan kontrolleri uygular.
- Bir IdP yetenek matrisini okuyun ve IdP, MCP'nin kimlik doğrulama profilini karşılayamadığında dağıtımı reddedin.

## Sorun

Ders 16 simülatörü bellekte OAuth 2.1'i çalıştırır. Üretimde, yalnızca bellek içeren bir simülatörün göremediği üç operasyonel boşluk vardır.

İlk boşluk kayıttır. Gerçek bir kuruluş yüzlerce MCP sunucusunu ve binlerce MCP istemcisini çalıştırır. Operatörler her Cursor kullanıcısını OAuth istemcisi olarak elle kaydetmez. 2025-11-25 spesifikasyonu, müşterilere bu sorunu çözmek için bir öncelik sırası verir: varsa önceden kayıtlı bir `client_id` kullanın, aksi takdirde **İstemci Kimliği Meta Veri Belgesi** kullanın (istemci kendisini kontrol ettiği bir HTTPS URL'si ile tanımlar ve yetkilendirme sunucusu meta verileri *çeker*), aksi halde **RFC 7591 dinamik istemci kaydına** geri dönün (istemci bir `POST /register` *ider* ve bir `client_id` yerinde), aksi takdirde kullanıcı prompt. CIMD önerilen varsayılandır çünkü DNS temelli güven modelini korurken sunucu başına kaydı tamamen kaldırır; DCR geriye dönük uyumluluk için korunur. Her ikisi de giriş noktalarını yetkilendirme sunucusunun meta verilerinden keşfeder: CIMD için `client_id_metadata_document_supported`, DCR için `registration_endpoint`.

İkinci boşluk anahtar rotasyonudur. JWT doğrulaması, yetkilendirme sunucusunun JSON Web Anahtar Seti (JWKS) olarak yayınlanan imzalama anahtarlarına bağlıdır. Yetkilendirme sunucusu bunları bir programa göre (çoğunlukla saatlik, bazen olay müdahalesi kapsamında daha hızlı) dönüşümlü olarak gerçekleştirir. JWKS'yi önyükleme sırasında bir kez getiren bir MCP sunucusu, dönüş penceresine kadar sorunsuz bir şekilde doğrulanır; ardından yeniden başlatılana kadar her istek başarısız olur. Üretim, JWKS'yi, önceki anahtarların süresi dolmadan önce önbelleğin üzerine yazan bir yenileme işi ile önbelleğe alınmış bir değer olarak bağlar ve ayrıca önbellekten daha yeni bir anahtar tarafından imzalanmış bir token'nin geldiği durum için önbellek kaçırıldığında bir geri dönüş alma işlemi gerçekleştirir.

Üçüncü boşluk izleyiciyi bağlayıcıdır. Ders 16'da RFC 8707 kaynak göstergeleri anlatıldı. Üretimde bu gösterge, her talepte kesin talep kontrolüne dönüşür. MCP sunucusu, `token.aud`'yi kendi kanonik kaynak URL'si ile karşılaştırır ve HTTP 401 ile olan uyumsuzlukları reddeder. Bu, yukarı akışlı bir MCP sunucusunun (veya bir sunucu için tasarlanmış bir token tutan kötü niyetli bir istemcinin) aynı güven ağında başka bir sunucuya karşı token'yi tekrar oynatmasına karşı tek savunmadır.

Bu ders her boşluğu yüzeyin somut bir parçasına eşler. Meta veri belgesi bir HTTP uç noktasıdır. JWKS önbellek yenilemesi, zamanlanmış bir işin yanı sıra bir anahtar/değer önbelleğidir. JWT doğrulaması, kaynak sunucusunun herhangi bir aracı göndermeden önce çalıştırdığı bir rutindir. Üç rolü ayrı tutun ve her biri yalnızca sahip olduğu kontrolleri uygular: Yetkilendirme sunucusu anahtarları yayınlar ve döndürür, kaynak sunucusu önbelleğe alır ve doğrular, istemci keşfeder ve kaydeder.

## Konsept

### RFC 8414 — OAuth Yetkilendirme Sunucusu Meta Verileri

`/.well-known/oauth-authorization-server` adresindeki bir belge, müşterinin ihtiyaç duyduğu her şeyi açıklar:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

MCP kaynak URL'si zincir keşfi verilen bir istemci: RFC 9728'den (kaynak sunucusunun belgesi) `oauth-protected-resource`, vereni adlandırır, ardından `oauth-authorization-server` (bu RFC) her uç noktayı adlandırır. İstemci hiçbir zaman bir yetkilendirme URL'sini sabit kodlamaz.

MCP için bir IdP'ye güvenmeden önce doğruladığınız sözleşme:

- `code_challenge_methods_supported`, `S256`'yi içerir (RFC 7636'ya göre PKCE). Spesifikasyon açıktır: eğer bu alan **yoksa**, yetkilendirme sunucusu PKCE'yi desteklemiyor ve istemcinin **ZORUNLU** devam etmeyi reddetmesi gerekiyor.
- `grant_types_supported`, `authorization_code`'yi içerir ve `password` ile `implicit`'yi reddeder.
- En az bir kayıt yolu tanıtılır: `client_id_metadata_document_supported: true` (CIMD, tercih edilir) **veya** `registration_endpoint` (RFC 7591 DCR, geri dönüş). Ya sözleşmeyi karşılar; artık DCR'ye kesinlikle ihtiyaç duymuyorsunuz.
- OAuth 2.1 için `response_types_supported` tam olarak `["code"]`'dir.

`S256` eksikse MCP sunucusu bu IdP'ye karşı dağıtım yapmayı reddeder; PKCE için düşürülmüş mod yoktur. Eğer *hiçbiri* kayıt yolu duyurulmazsa ve ön kayıt yaptırmış `client_id`'ınız yoksa, kayıt da yapamazsınız; deployment bildirimi yanlış, kod değil.

### RFC 9728 (özet) — Korumalı Kaynak Meta Verileri

Ders 16, RFC 9728'i ele almaktadır. Üretimdeki delta: bu belge, bir istemcinin *bu* MCP sunucusu tarafından güvenilen yetkilendirme sunucularını bulmak için baktığı tek yerdir. Tek bir MCP sunucusu birden fazla IdP'den (biri personel için, biri iş ortakları için) token'ları kabul edebilir. RFC 9728 bu seti bildirir; RFC 8414, her IdP'nin neyi desteklediğini belgeler.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### İstemci Kimliği Meta Veri Belgeleri (önerilen varsayılan)

CIMD, kaydı *itme* durumundan *çekme* durumuna çevirir. Yetkilendirme sunucusundan bir `client_id` oluşturmasını istemek yerine istemci, `client_id` olarak** kontrol ettiği bir HTTPS URL'sini kullanır. URL, bir JSON meta veri belgesine çözümlenir; yetkilendirme sunucusu bunu OAuth akışı sırasında talep üzerine getirir. Güven DNS'e dayanır: Sunucu operatörü `app.example.com`'ye güveniyorsa, `https://app.example.com/client.json` tarafından sunulan istemciye de güvenir. Kayıt gidiş dönüşü yok, tüketilecek `client_id` ad alanı yok, senkronize tutulması gereken sunucu başına durum yok.

İstemcinin barındırdığı meta veri belgesi:

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

Belgedeki `client_id` değeri **ZORUNLU**, belgenin sunulduğu URL'ye eşit olmalıdır (yetkilendirme sunucusu bunu doğrular; uyuşmazlıklar reddedilir). Yetkilendirme sunucusu, RFC 8414 meta verilerinde `client_id_metadata_document_supported: true` ile desteğin tanıtımını yapar.

Spesifikasyonun açık bir şekilde ifade ettiği iki güvenlik gerçeği:

- **SSRF.** Yetkilendirme sunucusu, saldırgan tarafından sağlanan bir URL'yi getirir. Sunucu tarafı istek sahteciliğine karşı koruma sağlamalıdır (dahili/yönetici uç noktalarına getirme yapılmaz).
- **localhost kimliğine bürünme.** CIMD tek başına yerel bir saldırganın meşru bir istemcinin meta veri URL'sini talep etmesini ve herhangi bir `localhost` yönlendirmesini bağlamasını engelleyemez. Yetkilendirme sunucusu **ZORUNLU** izin sırasında yönlendirme URI ana bilgisayar adını açıkça görüntülemeli ve **ZORUNLU** yalnızca `localhost` yönlendirmeleri konusunda uyarmalıdır.

CIMD'nin sunucu tarafı durumuna ihtiyacı olmadığından, DCR'nin gerektirdiği şekilde ayakta duracak bir kayıt şirketi yoktur. İstemci tarafı salt okunurdur: meta veri belgenizi statik bir HTTPS uç noktasından sunun ve yetkilendirme sunucusunun onu çekmesine izin verin.

### RFC 7591 — Dinamik İstemci Kaydı (geri dönüş / geriye dönük uyumluluk)

DCR artık bir `MAY` olup, 2025-11-25 öncesi deployment'ler ve henüz CIMD'yi desteklemeyen IdP'lerle geriye dönük uyumluluk için tutulmaktadır. Bu olmadan (ve CIMD veya ön kayıt olmadan), her MCP istemcisinin (Cursor, Claude Masaüstü, özel bir agent) IdP yöneticisiyle bant dışı bir değişime ihtiyacı vardır. DCR ile müşteri şunları gönderir:

```json
POST /register
Content-Type: application/json

{
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

Sunucu daha sonraki güncellemeler için `client_id` ve `registration_access_token` ile yanıt verir:

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

`token_endpoint_auth_method: none`, kullanıcının cihazında çalışan MCP istemcileri için doğru varsayılandır. Yalnızca `client_id` alıyorlar — dışarı sızacak `client_secret` yok. PKCE, kamu müşterilerinin ihtiyaç duyduğu mülkiyet kanıtını sağlar.

Üç üretim tuzağı:

- Kayıt uç noktasının kaynak IP'ye göre hız sınırı olması gerekir. Bu olmadan, düşmanca bir aktör milyonlarca sahte kayıt komut dosyası yazar ve `client_id` ad alanını tüketir. Kayıt şirketi isteği işleme almadan önce bir hız sınırı kontrolü çalıştırın.
- Bazı kurumsal IdP'ler için `software_statement` (istemci için imzalı bir JWT makbuzu) gereklidir. Dersin alayı bunu atlıyor; üretim, localhost yönlendirme URI'leri dışında herhangi bir şeyden gelen imzasız kayıtları reddeden bir doğrulama adımını bağlar.
- `registration_access_token` düz metin olarak değil karma olarak saklanmalıdır. Bu token'nin çalınması, saldırganın istemcinin yönlendirme URI'lerini yeniden yazabileceği anlamına gelir.

### RFC 8707 (özet) — Kaynak Göstergeleri

Ders 16 şekli oluşturdu. Üretim kuralı: her token isteği `resource=<canonical-mcp-url>`'yi içerir ve MCP sunucusu, her çağrıda `token.aud`'nin kendi kaynak URL'siyle eşleştiğini doğrular. Kurallı URI, sunucunun *en spesifik* tanımlayıcısıdır: küçük harf düzeni ve ana bilgisayar kullanır, parça içermez ve geleneksel olarak sonunda eğik çizgi yoktur. Yol bileşeni kural gereği **çıkarılmaz**; spesifikasyon, bireysel bir MCP sunucusunu tanımlamak gerektiğinde onu korur. `https://mcp.example.com`, `https://mcp.example.com/mcp`, `https://mcp.example.com:8443` ve `https://mcp.example.com/server/mcp`'nin tümü geçerli kanonik URI'lerdir. Sunucu başına bir tane seçin ve `aud`'yı tam olarak buna sabitleyin. (Bu dersin modeli, kısalık sağlamak için `https://notes.example.com` gibi çıplak ana bilgisayar kitlelerini kullanır; tek bir kaynak altında birden fazla MCP sunucusunu birlikte barındıran bir deployment, bunları yola göre ayırır.)

### RFC 7636 (özet) — PKCE

OAuth 2.1'de PKCE zorunludur. Dersin yetkilendirme kodu akışı her zaman `code_challenge` ve `code_verifier`'yi taşır. Sunucu, herhangi bir token isteğini, doğrulayıcı olmadan veya saklanan sorgulamaya hash oluşturmayan bir doğrulayıcıyla reddeder.

### MCP Spesifikasyonu 2025-11-25 Kimlik Doğrulama Profili

MCP spesifikasyonu (2025-11-25), bir MCP sunucusunun yetkilendirme katmanının ne yapması gerektiği konusunda kesindir:

- RFC 9728 korumalı kaynak meta verilerini uygulayın ve konumunu ya 401 **veya** iyi bilinen URI `/.well-known/oauth-protected-resource` üzerindeki `WWW-Authenticate: Bearer resource_metadata="..."` başlığı aracılığıyla sağlayın (SEP-985, iyi bilinen bir geri dönüş ile başlığı isteğe bağlı hale getirdi). Meta veri `authorization_servers` alanı **ZORUNLU** en az bir sunucuyu adlandırmalıdır.
- token'ları yalnızca **her** istekte `Authorization: Bearer ...` aracılığıyla kabul edin; asla bir sorgu dizesinde değil, hiçbir zaman yalnızca oturum başlangıcında doğrulanmaz.
- `aud`, `iss`, `exp` ve istek başına gerekli kapsamları doğrulayın. Sunucu **ZORUNLU**, token'nin özellikle kendisi (izleyici) için verildiğini doğrulamalıdır; eksik veya eşleşmeyen bir `aud` reddedilir, hiçbir zaman joker karakter olarak değerlendirilmez.
- 401/403'te, `error=...` taşıyan `WWW-Authenticate: Bearer`, `resource_metadata="<PRM-URL>"` parametresini (meta veri belgesinin URL'si, çıplak kaynak *değil*) ve `insufficient_scope` (403) üzerinde `scope="..."` döndürün. Not: parametre `resource_metadata`, bir keşif işaretçisidir — sorgulamada `resource` parametresi yoktur.
- Yetkilendirme sunucusu keşfi **ya** RFC 8414 OAuth meta verilerini **veya** OpenID Connect Discovery 1.0'ı kabul eder; istemciler her iki iyi bilinen son eki de öncelik sırasına göre denemelidir.
- İstemci (sunucu değil) **karışıklık saldırılarına** karşı savunma yapar: yeniden yönlendirmeden önce beklenen `issuer` değerini kaydeder ve kodu kullanmadan önce `iss` yetkilendirme-yanıt parametresini (RFC 9207) doğrular. PKCE tek başına karışıklığı durdurmaz çünkü istemci, `code_verifier`'sini yönlendirildiği token uç noktasına verir.

OAuth 2.1 taslağı alt tabakadır; RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD yüzeydir; MCP spesifikasyonu profildir.

### IdP yetenek matrisi

Her IdP MCP profilinin tamamını desteklemez. Aşağıdaki matris, 2025-11-25 spesifikasyonundan itibaren gerçek yetenek beyanlarını belgelemektedir. Bu bir *deployment kapısıdır*, bir öneri değildir.

CIMD, 2025-11-25 spesifikasyonunda gönderildi ve temel OAuth taslağı yalnızca Ekim 2025'te kabul edildi, dolayısıyla satıcı desteği hala geliyor - aşağıdaki "CIMD"yi kalıcı bir ifade olarak değil "bugünkü yeri, kiracınızda doğrulayın" olarak değerlendirin.

| Kimlik kategorisi | AS meta verileri (8414/OIDC) | CIMD | RFC 7591 DCR | RFC 8707 kaynağı | RFC 7636 S256 PKCE | Notlar |
|---|---|---|---|---|---|---|
| Kendi kendine barındırılan (Anahtarlık) | evet | ortaya çıkan | evet | evet (24.x'ten beri) | evet | Bu derste MCP profili için referans IdP; uçtan uca tam DCR yolu, CIMD yeni spesifikasyonu takip ediyor. |
| Kurumsal SSO (Microsoft Entra ID) | evet | ortaya çıkan | evet (premium katmanlar) | evet | evet | DCR kullanılabilirliği kiracı katmanına göre farklılık gösterir; Dağıtımdan önce hedef kiracıyı doğrulayın. |
| Kurumsal SSO (Okta) | evet | ortaya çıkan | evet (Okta CIC / Auth0) | evet | evet | DCR, Auth0'da mevcuttur (şimdi Okta CIC); klasik Okta kuruluşları yönetici ön kaydı gerektirir. |
| Sosyal giriş kimlik bilgileri (genel) | değişir | hayır | nadiren | nadiren | evet | Çoğu sosyal IdP, müşterilere statik ortaklar gibi davranır; self-servis kayıt yok. Yalnızca kimlik kaynağı olarak kullanın, kendi MCP uyumlu yetkilendirme sunucunuzu en üste katmanlayın. |
| Özel / evde yetiştirilen | bağlıdır | bağlıdır | bağlıdır | bağlıdır | bağlıdır | Kendinizinkini gönderirseniz, tam profili gönderin ve CIMD'yi tercih edin. PKCE'nin veya hedef kitle bağlamanın atlanması MCP kimlik doğrulama sözleşmesini ihlal eder. |

deployment bildirimi için reddetme kuralı: Seçilen IdP, `code_challenge_methods_supported` içinde `S256`'yi listelemiyorsa, MCP sunucusu başlamayı reddeder — PKCE'nin düşürülmüş modu yoktur. Kayıt daha yumuşak bir geçiştir: *bir* çalışma yoluna ihtiyacınız vardır (önceden kayıtlı bir `client_id`, `client_id_metadata_document_supported: true` veya bir `registration_endpoint`). DCR'nin yokluğu artık tek başına bir ret tetikleyicisi değil çünkü CIMD veya ön kayıt bunu kapsayabilir.

### JWKS yenileme düzeni (AS'de döndürün, kaynak sunucuda yenileyin)

İki fiili ayrı tutun çünkü bunları birleştirmek gerçek bir üretim hatasıdır:

- **Döndürme**, *yetkilendirme sunucusunun* yaptığı şeydir: yeni bir imzalama anahtarı oluşturun, bunu JWKS'de yayınlayın, eskisini daha sonra kullanımdan kaldırın. Kaynak sunucusunun bunda hiçbir rolü yoktur ve bunu yapamaz; IdP'nin özel anahtarlarını tutmaz.
- **Yenileme** *kaynak sunucusunun* yaptığı şeydir: yayınlanan JWKS'yi önbelleğine yeniden`GET` yerleştirir. Bu, bir kaynak sunucusunun şimdiye kadar gerçekleştirdiği tek JWKS eylemidir.

Üretim hatası modu eski bir önbellektir. Zamanlanmış bir yenileme işinin yanı sıra bir anahtar/değer önbelleğiyle bu sorunu çözün. Kaynak sunucusu, sabit bir aralıkta `<issuer>/.well-known/jwks.json`'yi getiren ve `cache[issuer] = {keys, fetched_at}`'nin üzerine yazan bir işi (cron, zamanlayıcı, çalışma zamanınızın sunduğu her şey) çalıştırır. Doğrulayıcı bu önbellekten okur. Önbellekte `kid` eksik olan bir token, geri dönüş olarak **bir** eşzamanlı yenilemeyi tetikler ve ardından yeniden kontrol eder. Bu, aynı anda iki durumu ele alır: planlanmış yenileme ve yepyeni bir anahtar tarafından imzalanan bir token'nin bir sonraki programlanmış yenilemeden önce geldiği anahtar çakışma pencereleri.

Geri çekilme **yeniden getirme olmalı, asla döndürme olmamalıdır**. Önbellek kaçırma yolunu bir döndürme ve nane işlemine bağlarsanız iki şey bozulur: (1) yeni bir anahtar basmak, *hala* token ile eşleşmeyen bir `kid` üretir, dolayısıyla arama yine de başarısız olur; ve (2) token'lere rastgele `kid` değerleri püskürten bir saldırgan, sınırsız sayıda anahtar oluşturma işlemini (kendi kendine gerçekleştirilen bir DoS) zorlar. Yeniden getirme önemsizdir, dolayısıyla sahte bir `kid` en fazla bir boşa alma maliyetine mal olur.

Önbellek şekli:

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

Aynı anda iki anahtar kararlı durumdur. Yetkilendirme sunucuları, önceki anahtarı (`k_2026_03`) kullanımdan kaldırmadan önce sonraki anahtarı (`k_2026_04`) tanıtarak dönüşümlü olarak çalışır, böylece eski anahtar altında verilen token'ler, süreleri dolana kadar geçerli kalır. Önbellek birliği tutar; doğrulayıcı `kid` tarafından seçilir.

### Doğrulama rutini

MCP sunucusu herhangi bir aracı göndermeden önce doğrulama işlemini gerçekleştirir. `code/main.py` şekli şunu kullanır:

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate`, JWT'nin kodunu çözer, JWKS önbelleğindeki imzalama anahtarını çözer (kaçırıldığında bir kez yenilenir), imzayı doğrular, ardından `iss`'yi izin verilenler listesine göre, `aud`'yi bu sunucunun kurallı kaynağına, `exp`'ya ve gerekli kapsama göre kontrol eder; ilk başarısızlıkta bir `WWW-Authenticate` sınaması döndürür. Kaynak sunucusunda bunu tek bir rutin olarak tutmak, her giriş noktasının (her araç çağrısı, her aktarım) aynı kontrollerden geçmesi anlamına gelir; Önce doğrulama yapılmadan bir araca ulaşan bir yol yoktur.

### İzleyiciyi tekrar oynatma kılavuzu (erişim-token ayrıcalık kısıtlaması)

A Sunucusu (`notes.example.com`) ve Sunucu B (`tasks.example.com`) aynı yetkilendirme sunucusuna kaydolur. Sunucu A'nın güvenliği ihlal edildi. Saldırgan bir kullanıcının token notlarını alır ve bunu Sunucu B'de tekrar oynatır.

Sunucu B'nin doğrulayıcısı:

1. JWT'nin kodunu çözün, `kid` tarihine kadar JWKS'yi getirin, imzayı doğrulayın.
2. `iss`'yi korumalı kaynak meta verilerinin `authorization_servers`'sine göre kontrol edin. (Geçti — aynı IdP.)
3. `aud == "https://tasks.example.com"`'yi kontrol edin. (Başarısız — token'nın `aud`'si `https://notes.example.com`'dir.)
4. `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"` ile 401'e dönün.

İzleyici iddiası, protokol katmanındaki bu saldırıya karşı tek savunmadır. Performans için bunu atlamak en yaygın üretim hatasıdır; doğrulayıcı yalnızca oturum başlangıcında değil, her istekte çalışmalıdır. Spesifikasyon buna **access-token ayrıcalık kısıtlaması** adını verir: bir MCP sunucusu `MUST`, hedef kitlede kendisini adlandırmayan herhangi bir token'yi reddeder.

> **Adlandırma notu.** Spesifikasyon, *karışık vekil* terimini ilgili ama farklı bir sorun için saklı tutar: statik bir istemci kimliği kullanan ve istemci başına kullanıcı onayı almadan bir token ileten, üçüncü taraf bir API'ye OAuth **proxy** görevi gören bir MCP sunucusu. İzleyici bağlama yukarıdaki tekrarı düzeltir; karışık vekil düzeltmesi, müşteri başına izin **artı** gelen token'yi hiçbir zaman yukarı akış API'lerine aktarmaz (MCP sunucusu `MUST` kendi ayrı yukarı akış token'sini alır).

### Karışık saldırılar (sunucunun sağlayamayacağı bir istemci tarafı savunması)

Bir istemci, ömrü boyunca birçok yetkilendirme sunucusuyla konuşur. Kötü niyetli bir AS, istemcinin, saldırganın token uç noktasında dürüst bir AS'nin yetkilendirme kodunu kullanmasını sağlamaya çalışabilir. Hedef kitle bağlamanın burada bir faydası yok; saldırı herhangi bir token var olmadan önce gerçekleşiyor. Savunma istemcide bulunur (RFC 9207):

1. Yönlendirmeden önce istemci, doğrulanmış AS meta verisinden beklenen `issuer` değerini kaydeder.
2. Yetkilendirme yanıtında istemci, kodu herhangi bir yere göndermeden önce döndürülen `iss` parametresini kayıtlı veren kuruluşla karşılaştırır (basit dize karşılaştırması, normalleştirme yok).
3. Uyumsuzluk (veya AS `authorization_response_iss_parameter_supported` bildirdiğinde `iss` yok) → reddedin ve `error` alanlarını bile görüntülemeyin.

PKCE tek başına karışıklığı durdurmaz çünkü istemci, `code_verifier`'sini yönlendirildiği token uç noktasına verir. Bu nedenle spesifikasyon, PKCE doğrulayıcı ve `state` ile birlikte istek başına veren kuruluşu kaydeder.

### Arıza modları

- **Eski JWKS.** Doğrulayıcı, AS bir anahtarı döndürdükten sonra geçerli token'leri reddeder. Düzeltme, yukarıdaki cron-yenileme + önbellek-kaçırma-yeniden getirme modelidir. JWKS'yi yenileme işi olmadan asla önbelleğe almayın.
- **Geri dönüş olarak döndür.** Önbellek kaçırma yolunu yeniden getirme yerine bir döndürme ve nane işlemine bağlamak gerçek bir hatadır: hiçbir zaman eksik `kid` üretmez ve saldırgan tarafından kontrol edilen `kid` değerlerini anahtar oluşturma DoS'sine dönüştürür. Geri dönüş, idempotent `refresh-jwks` olmalıdır.
- **Eksik `aud` talebi.** Bazı IdP'ler, token isteğinde `resource` bulunmadığı sürece varsayılan olarak `aud`'yi atlar. Doğrulayıcı, eksik `aud` içeren token'leri reddetmeli, yokluğu joker karakter olarak değerlendirmemelidir.
- **Eksik `iss` kontrolü nedeniyle karışıklık.** Yönlendirmeden önce kaydettiği RFC 9207 `iss` yetkilendirme-yanıt parametresini veren kuruluşa karşı doğrulamayan bir istemci, bir saldırganın token uç noktasında dürüst bir AS kodunu kullanmaya yönlendirilebilir. Bu, istemci tarafında bir hatadır; kaynak sunucusu bunu telafi edemez.
- **Kapsam yükseltme yarışı.** Aynı kullanıcı için eş zamanlı iki yükseltme akışı hem başarılı olabilir hem de farklı kapsamlara sahip iki erişim token üretebilir. Doğrulayıcı, istekte sunulan token'yi kullanmalıdır, "kullanıcının mevcut kapsamını" aramamalıdır; bu, bir TOCTOU penceresi oluşturur.
- **Kayıt token hırsızlığı.** Sızan bir `registration_access_token`, saldırganın yönlendirme URI'lerini yeniden yazmasına olanak tanır. Bunları dinlenirken karıştırın; istemcinin her güncellemede açık metni sunmasını zorunlu tutun; şüphe üzerine dönün.
- **`iss` sabitlenmedi.** Herhangi bir `iss`'yi kabul eden bir doğrulayıcı, saldırganın kendi yetkilendirme sunucusunu kurmasına, hedef kitle için bir istemci kaydetmesine ve token'lar yayınlamasına olanak tanır. Korunan kaynak meta verilerinin `authorization_servers` listesi izin verilenler listesidir; onu uygula.

## Kullan onu

`code/main.py`, stdlib Python ve üç rol (`AuthorizationServer`, `ResourceServer` ve `Client`) ile tüm üretim akışını yürütür. Akış:

1. Yetkilendirme sunucusu RFC 8414 meta verilerini `/.well-known/oauth-authorization-server` adresinde yayınlar.
2. MCP istemcisi meta veri uç noktasını çağırır ve kayıt seçeneklerini (CIMD için `client_id_metadata_document_supported`, DCR için `registration_endpoint`) ve `S256` PKCE desteğini kontrol eder.
3. Gözden geçirme DCR geri dönüş yolunu kullanır: istemci `/register` (RFC 7591)'e gönderim yapar ve bir `client_id` alır. (Bir CIMD istemcisi bunun yerine kendi HTTPS `client_id` URL'sini sunacak ve bu adımı atlayacaktır.)
4. MCP istemcisi, PKCE korumalı yetkilendirme kodu akışını (RFC 7636) `resource` göstergesiyle (RFC 8707) çalıştırır.
5. MCP istemcisi, MCP sunucusundaki bir aracı `Authorization: Bearer ...` ile çağırır.
6. MCP sunucusu `validate`'yu çalıştırarak imzalama anahtarını JWKS önbelleğinden çözer.
7. IdP bir anahtarı döndürür; zamanlanmış yenileme JWKS'yi önbelleğe yeniden çeker.
8. Bir sonraki çağrı, yeniden başlatılmadan yenilenen anahtarlara göre doğrulanır ve önceki token, çakışma penceresi sırasında hala doğrulanır.
9. Farklı bir MCP kaynağına yönelik izleyici yeniden oynatma girişimi, `audience mismatch` ve `resource_metadata` işaretçisiyle 401 alır.

Buradaki JWT, HS256'yı paylaşılan bir sırla kullanıyor (böylece ders yalnızca stdlib'de çalışıyor). Üretimde yukarıdaki JWKS modeliyle RS256 veya EdDSA kullanılır; doğrulama mantığı bunun dışında aynıdır. IdP ve kaynak sunucusu tek bir işlemde yaşadığı için `refresh_jwks`, yetkilendirme sunucusunun anahtar listesini doğrudan okur; kablo üzerinden `GET` ile `jwks_uri` arası bir HTTP'dir.

## Gönderin

Bu ders `outputs/skill-mcp-auth.md` üretir. Bir MCP sunucusu yapılandırması ve bir IdP yetenek seti göz önüne alındığında, beceri ayağa kalkmak için kimlik doğrulama yüzeyini (korunan kaynak meta verileri, kullanılacak kayıt yolu (CIMD, ön kayıt veya DCR geri dönüşü), JWKS yenileme zamanlaması, kapsam eşlemesi ve IdP tam RFC profilini desteklemediğinde uygulanacak reddetme kuralları) yayınlar.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Akışı takip edin. IdP'nin 6. adımda bir anahtarı nasıl döndürdüğüne, programlanan `refresh_jwks`'nin yayınlanan seti nasıl yeniden çektiğine ve hem eski token (örtüşme penceresi) hem de yeni bir token'nin yeniden başlatmadan nasıl doğrulandığına dikkat edin.

2. Korunan kaynak meta verilerinin `authorization_servers` listesine yeni bir IdP ekleyin. Yeni IdP tarafından imzalanmış bir token düzenleyin ve doğrulayıcının bunu kabul ettiğini onaylayın. Listelenmemiş bir IdP tarafından imzalanmış bir token düzenleyin ve doğrulayıcının reddetmelerini `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"` ile onaylayın.

3. Kayıt şirketi bir isteği kabul etmeden önce çalıştırılacak olan `register_client`'ya bir hız sınırı kontrolü ekleyin. IP tarafından anahtarlanan küçük bir dict içinde tutulan kaynak IP başına bir token-kovası kullanın.

4. RFC 7591'i okuyun ve dersin `/register` işleyicisinin doğrulamadığı iki alanı tanımlayın. Doğrulamayı ekleyin. (İpucu: `software_statement` ve `redirect_uris` URI şeması.)

5. İstemci Kimliği Meta Veri Belgesi yolunu ekleyin. `client_id`'si kendi URL'sine eşit olan bir `client.json` servis edin ve yetkilendirme sunucusunun bunu alıp doğrulamasını sağlayın (`client_id` ≠ URL ise reddet). Bir CIMD istemcisinin `register_client` çağrısı olmadan kaydolduğunu doğrulayın.

6. DoS düzeltmesini kanıtlayın. Doğrulayıcıya rastgele bir `kid` içeren bir token gönderin ve `refresh_jwks`'nin en fazla bir kez çalıştığını ve yetkilendirme sunucusunun anahtar sayısının artmadığını doğrulayın. Daha sonra geri dönüşü kasıtlı olarak bir döndürme ve nane işlemine yeniden bağlayın ve sahte token başına anahtar sayısının yükselişini izleyin - daha sonra yeniden getirmeyi geri yükleyin.

7. Karışıklık bölümünden istemci tarafı RFC 9207 `iss` kontrolünü uygulayın: yetkilendirme talebinden önce beklenen vereni kaydedin, ardından `iss` eşleşmeyen bir yetkilendirme yanıtını reddedin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| ASM | "OAuth meta veri belgesi" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | "İstemci meta veri URL'si" | İstemci Kimliği Meta Veri Belgesi — `client_id` olarak kullanılan bir HTTPS URL'si; AS, JSON'u çeker. 2025-11-25'ten beri önerilen varsayılan |
| DCR | "Self-servis müşteri kaydı" | RFC 7591 `POST /register` akışı; 2025-11-25'te `MAY` yedeğe indirildi |
| JWKS | "JWT doğrulaması için genel anahtarlar" | JSON Web Anahtarı Seti, `jwks_uri` kaynağından getirildi, `kid` tarafından dizine eklendi |
| Döndürme ve yenileme | "Anahtarlar güncelleniyor" | *Döndür* = AS imzalama anahtarlarını darp eder/kullanımından kaldırır; *refresh* = kaynak sunucusu yayınlanan seti yeniden getirir. Kaynak sunucuları yalnızca her zaman yenilenir |
| Kaynak göstergesi | "Kitle parametresi" | RFC 8707 `resource` parametresi, token'yı bir sunucuya sabitliyor |
| `aud` iddiası | "İzleyici" | JWT, doğrulayıcının standart kaynak URL'siyle karşılaştırdığını iddia ediyor |
| İzleyici tekrarı | "Token tekrar oynat" | Sunucu B'ye sunulan Sunucu A için yayınlanan Token; kitle doğrulaması ile savunulur (spec: erişim-token ayrıcalık kısıtlaması) |
| Milletvekili kafası karışık | "Proxy token kötüye kullanımı" | İstemci başına izin olmadan bir token ileten statik istemci kimliğine sahip bir MCP proxy'si; izleyici tekrarından farklı |
| Karıştırma saldırısı | "Yanlış token bitiş noktası" | Müşteri, saldırganın uç noktasında dürüst bir AS kodunu kullanmaya yöneldi; RFC 9207 `iss` aracılığıyla istemci tarafı savundu |
| `iss` izin verilenler listesi | "Güvenilen yetkilendirme sunucuları" | Korumalı kaynak meta verilerinde adı geçen küme `authorization_servers` |
| `resource_metadata` | "PRM belgesini nerede bulabilirim" | 401/403'te RFC 9728 meta veri URL'sini adlandıran `WWW-Authenticate` parametresi |
| Kamu müşterisi | "Yerel veya tarayıcı istemcisi" | `client_secret` numarası olmayan OAuth istemcisi; PKCE telafi ediyor |
| `WWW-Authenticate` | "401/403 yanıt başlığı" | İstemci kurtarmayı yönlendiren `Bearer error=...` yönergesini taşır |

## Daha Fazla Okuma

- [MCP — Yetkilendirme spesifikasyonu (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) — bu dersin uyguladığı MCP kimlik doğrulama profili
- [MCP blogu — Bir Yıllık MCP: Kasım 2025 Teknik Özellikler Sürümü](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — 2025-11-25'te neler değişti (CIMD, XAA, DCR indirgemesi)
- [Aaron Parecki — Kasım 2025 MCP Yetkilendirme Spesifikasyonunda İstemci Kaydı](https://aaronparecki.com/2025/11/25/1/mcp-authorization-spec-update) — DCR üzerinden CIMD mantığı
- [OAuth İstemci Kimliği Meta Veri Belgesi (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) — CIMD
- [RFC 8414 — OAuth 2.0 Yetkilendirme Sunucusu Meta Verileri](https://datatracker.ietf.org/doc/html/rfc8414) — keşif sözleşmesi
- [RFC 7591 — OAuth 2.0 Dinamik İstemci Kayıt Protokolü](https://datatracker.ietf.org/doc/html/rfc7591) — DCR (geri dönüş yolu)
- [RFC 7636 — Kod Değişimi için Kanıt Anahtarı (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — genel istemci mülkiyetinin kanıtı
- [RFC 8707 — OAuth 2.0 için Kaynak Göstergeleri](https://datatracker.ietf.org/doc/html/rfc8707) — kitle sabitleme
- [RFC 9728 — OAuth 2.0 Korumalı Kaynak Meta Verileri](https://datatracker.ietf.org/doc/html/rfc9728) — kaynak sunucusu keşfi
- [RFC 9207 — OAuth 2.0 Yetkilendirme Sunucusu Veren Kimliği](https://datatracker.ietf.org/doc/html/rfc9207) — karışıklık saldırılarına karşı savunma yapan `iss` parametresi
- [OAuth 2.1 taslağı](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — birleştirilmiş OAuth alt katmanı
