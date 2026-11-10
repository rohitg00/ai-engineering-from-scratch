# MCP Yetkisi: CIMD, Emitör Bağlantısı, PKCE ve Step-Up

> Uzaktan bir MCP talebi devletsiz, ancak yetkisi anonim değildir. Her tanıklığı oluşturan emitenine ve her token'ı alan kaynağa bağlayın.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- Korunan kaynak metadataları üzerinden yetki sunucularını keşfedin.
- Geçmiş Dinamik Müşteri Kayıtları yerine Müşteri Kimliği Metadata Belgelerini tercih edin.
- Doğruları bildirin .`application_type`DCR uyumluluğu yolunun kaçınılmaz olduğu durumlarda.
- Yetkililik cevabını doğrulayın `iss`ve emitenin kimliği ile ilgili bilgileri ayırmak.
- PKCE, kaynak göstergelerini, izleyicilerin doğrulanmasını ve artış alanlarını kullanın.
- Protokol seansları olmadan yetkili MCP 2026-07-28 isteklerini gönderin.

## Sorun

Uzaktan bir MCP sunucusu özel kayıtları okuyabilir, dış sistemleri yazabilir veya pahalı çalışmaları tetikleyebilir. Kimlik kimliği kimlik kimliğini belirler. Yetki ayrıca cevap vermelidir:

- Hangi yetki sunucusu bu kimlik bilgileri verdi?
- Hangi MCP kaynağı için bir simge?
- Hangi müşteri ve URI akışını tamamladı?
- Kullanıcı hangi işlemleri onayladı?
- Bu talep hala onayına uygun mu?

2026-07-28 yetki profili müşteri kayıtlarını ve emitenin yönetimini zorlaştırır.`application_type`DCR'de, RFC 9207 emitenin yanıtlarını onaylar ve emitenler arasında kredi belgelerini yeniden kullanmayı yasaklar.

Bu kurallar devletsiz çekirdeği tamamlıyor.`Mcp-Session-Id`- Evet .

## Anlaşım

### Üç rolü bil.

- **MCP client:**bir kaynak sahibi adına talepler gönderir.
- **MCP resource server:**erişim tokenini kabul eder ve MCP son noktasına hizmet eder.
- **Authorization server:**Kaynak sahibi doğrulanır, onay toplar ve tokenler verir.

Kaynak sunucusu ve yetki sunucusu birlikte çalışabilir, ancak kimliklerini ve doğrulama sorumluluklarını ayrı tutarlar.

### HTTP için yetki geçerlidir

MCP yetki özellikleri HTTP tabanlı taşımalara uygulanır. Yerel studio sunucusu işlem ve işletim sistemi güven sınırı altında çalışır.

Uzak Akışlı HTTP için, taşıyıcı simgesini `Authorization`Her istek için başlık.

### Korunan kaynak metadata ile başlayın

Kaynak sunucusu RFC 9728 metadatalarını yayınlar:

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

Müşteri MCP kaynak URL'den başlar, bu belgeyi alır, reklamlı bir yetki sunucusu seçer ve ardından bu sunucunun OAuth veya OpenID Connect metadatalarını alır.

RFC 9728'in bilinen URL'sini oluştururken kaynak yolunu korumak.`https://notes.example.com/mcp`Bu ders kullanıyor .`https://notes.example.com/.well-known/oauth-protected-resource/mcp`- Kaldırıyorum .`/mcp`İle aynı kökendeki farklı korunan kaynak için metadata seçilebilir.

Bir host adından yetki sunucusunu tahmin etmeyin. Geçersiz bir hata kurumundan keşfedilen bir emitenin izini tutmayın. Müşteri emitenin güvenmeye istekli olduğu bir politika tutun.

### Yetki sunucusunun metadatalarını doğrulayın

Metadata son noktaları ve desteklenen kontrolleri ortaya çıkarmalıdır:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": true
}
```

PKCE için S256'yi isteyin. Tam emiten dizinini kaydetin. Bu tam değer kayıt ve token depolama anahtarı olur.

### Kayıt önceliğini izleyin

Seçilen emitenle müşteri zaten açık bir ilişkiye sahip olduğunda önceden kaydedilen müşteri bilgilerini kullanın. Aksi takdirde yetki sunucusu destek ilan ettiğinde Müşteri ID Metadata Belgeleri tercih edin. DCR'yi sadece geçersiz uyumluluk geri dönüşü olarak kullanın, sonra bu mekanizmaların hiçbiri mevcut değilse müşteri bilgilerini istemek için uyarın.

### Müşteri Kimliği Metadata Belgelerini tercih edin

Bir Müşteri Kimliği Metadata Belgesi, yetki sunucusuna hem müşteri kimliği hem de metadatalarının konumunu oluşturan bir HTTPS URL verir:

```json
{
  "client_id": "https://client.example.com/oauth/metadata.json",
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

Yetki sunucusu belgeyi alır ve onaylar.`client_id`Bir yollu HTTPS URL olması ve belgenin içindeki değer tam olarak bu URL'ye eşit olması gerekir. Gerekli belge alanları `client_id`- Evet .`client_name`ve`redirect_uris`- Evet .`application_type`Bu örnekte belirtilen ancak CIMD'nin bir talebi değildir.

Belgeyi almak SSRF hassas bir işlem olarak ele alın. Destinasyonunu çöz ve doğrulayın, loopback, özel, bağlantı yerel ve diğer şekilde izin verilmeyen adresleri reddedin, yönlendirmelerden ve DNS değişikliklerinden sonra tekrar kontrol edin, yönlendirmeleri, baytları ve zamanı sınırlayın, JSON gerektirir ve yalnızca doğrulanmış HTTP önbelleği kontrollerine göre.`client_name`ve güvenilmeyen metin olarak diğer görüntü alanları.

CIMD, her ilk temas için yeni bir dinamik kimlik oluşturma gereksinimini ortadan kaldırır. URI doğrulama, emitenin politikası veya kullanıcı onayını kaldırmaz.

### DCR uyumluluk yolu

Dinamik Müşteri Kayıtlaması eski yetki sunucuları için mevcut kalır, ancak yeni MCP uygulamalar için geçersiz hale gelmiştir.

DCR kullanırken, bildirin `application_type`- ...

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- Masaüstü, mobil, komut satırı ve loopback istemciler kullanıyor `native`- Evet .
- Uzaktan barındırılan tarayıcı uygulamaları kullan `web`Uzak HTTPS yönlendirmeleri.

Alanı eklemek öntanımlı olarak `web`OpenID Connect kayıt uygulamasında geçerli bir loopback yönlendirme başarısız oldu.

Açık bir geri dönüş kararının arkasında DCR kodu tutun. CIMD onaylamasında keyfi bir başarısızlıktan sonra sessizce geri düşmeyin. Bu bir güvenlik başarısızlığını daha zayıf bir kayıt yoluna dönüştürebilir.

### Emitente bağlayıcı kimlikler

Emitent tarafından yazılmış kayıt materyallerini tam emitenin altında saklayın:

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

Korunan kaynak keşfi değişirse `https://auth-one.example`- ...`https://auth-two.example`DCR'nin ilk emitenin müşteri sırrını, DCR müşteri kimliğini, kayıt erişim tokenini, yenilenme tokenini veya erişim tokenini ikinci bir emitenin yanına asla gönderme. Önceden kayıtlı ve DCR müşterileri yeni emitenin için verilen kimlik bilgileri kullanmalıdır.

CIMD istemci kimliği farklıdır çünkü bir yetki sunucusu tarafından hazırlanan bir tanıtım notu değil, kendi kendine barındırılan bir HTTPS URL'dir. Aynı CIMD URL taşınabilir: yeni güvenilir bir emiten, belgeyi DCR yeniden kaydetmeden alıyor ve doğruluyor. Yetki cevapları ve jetonlar hala doğrulanır ve yeni emitenin altında saklanır.

### PKCE ile yetki kodu

Etkin akış:

1. Yüksek entropi üretin .`code_verifier`- Evet .
2. S256 ' u çıkarın .`code_challenge`- Evet .
3. İzin isteğini tam olarak gönder `client_id`- Evet .`redirect_uri`- Evet .`scope`- Evet .`code_challenge`ve`resource`- Evet .
4.  İçeren bir onay cevabı alın`code`ve sağlandığında,`iss`- Evet .
5. Geçerlileştir`iss`herhangi bir cevap alanını kullanmadan önce kayıtlı emitenin tam karşılığını alır.
6. Kodu  ile değiştir .`code_verifier`, aynı URI yönlendirme ve aynı `resource`- Evet .
7. Sonuçlı tokenı aşağıda saklayın `(issuer, resource)`- Evet .

- Evet .`resource`RFC 8707'den gelen parametreler hem yetki taleplerinde hem de simge talebinde görünür. Kanonik MCP sunucu URI'sini tanımlar.

### Geçerlileştir`iss`Tam olarak

RFC 9207, bir emitenin izin cevabının diğer bir emitenin cevabıyla karıştırılmasını engeller.

Ne zaman ?`iss`Eğer bu durum geçerli ise, kayıtlı yayıncı ile kıyaslayın, durum katlanmadan, arkaplan değişiklikleri, varsayılan port kaldırılmadan veya yüzde kodlama normalleştirilmeden.

İçeriği bir yetki sunucusu `iss`reklamlar `authorization_response_iss_parameter_supported: true`Şu anki müşteriler hala bir hediyeyi onaylıyor .`iss`Bu reklam eksikken bile.

### MCP sunucusunda izleyicileri doğrula

Kaynak sunucusu yalnızca kendisi için gönderilen tokenleri kabul eder:

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

Geçersiz, sona ermiş, yanlış yayıncı veya yanlış izleyiciler için belirtiler 401 alır. MCP sunucusu başka bir hizmet için belirtilen bir belirti kabul edemez veya nakliye edemez.

### En küçük akım alanını isteyin

Şimdi gerekli alanı ile başlayın. Daha sonraki bir araç daha fazlasını gerektiriyorsa, sunucu yetkili bir alan zorluğu ile 403'yi geri gönderir:

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

Müşteri yeni izinleri açıklar, onay alır, kombinasyon kapsamı seti ile yeni bir yetki akışı yapar ve MCP talebini yeni bir JSON-RPC kimliği ile tekrar dener.

Saldırı alanının bir alt kümesi olduğunu düşünmeyin `scopes_supported`Bu zorluk mevcut operasyon için yetkili.

### Yetki ve devletsiz MCP kablosu

Yetkili bir araç çağrısı hala mevcut tüm talep zarfını taşıyor:

```text
POST /mcp
Authorization: Bearer <access-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.delete
```

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "notes.delete",
    "arguments": {"id": "note-7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "oauth-lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Token, başkanı onaylıyor, talep metadataları protokol davranışını müzakere ediyor.

Kabloyu sabit bir sırada doğrulayın: JSON-RPC ve metadata türleri, başlık ve vücut eşitliği, sonra protokol desteği.`-32020`. Başlık ve vücut desteklenmeyen bir versiyon için anlaşılırsa, HTTP 400'i  ile geri gönderin.`-32022`ve `data`Tam olarak .`{"supported":["2026-07-28"],"requested":"<actual>"}`Bilinmeyen bir yöntem HTTP 404 ' i  ile gönderir .`-32601`- Evet .

401 geçersiz token ve 403 yetersiz kapsam dahil her talep hatası, orijinal talebi olan JSON-RPC hatası zarfıdır `id`Yapılandırılmış kurtarma bilgisi seçmeli hataya düşer `data`- ...`WWW-Authenticate`HTTP cevap başlığı olarak kalır.`id`Kabul edilen HTTP bildirimi boş bir vücutla 202'yi gönderir.

Sunucu uygulaması `server/discover`ve araçları reklam eder, bu yüzden zorunlu `tools/list`Metod. Araç tanımlayıcıları sabit isimlere, tanımlara ve nesne kökü'ne sahiptir.`inputSchema`Değerler. Liste belirleyici ve geri dönüştürür.`resultType`, sunucu kimliği metadata, sınırlı `ttlMs`ve`cacheScope`.Kendimiyetten önce keşif ve kullanıcılara bağlı bir araç listesinin kullanılabilir olması.

### - İşaretli geçit yok.

Bir MCP sunucusu, müşterinin MCP erişim tokenini bir aşağı akım API'ye göndermemelidir. Doğru kitleyle ayrı bir aşağı akım token al veya açık bir token-değişim tasarımı kullan. Kitle onaylaması yalnızca hizmetler başka bir kişi için hazırlanan tokenleri reddettiğinde çalışır.

### Yenilenme simgeler

Yenilenme tokenleri seçmeli. Çıkardığında gizlice saklayın ve emiten ve kaynak tarafından anahtarlandırın. Var olduklarını düşünmeyin. Yetki sunucusu dönmeyi desteklediğinde döndürün ve geçersiz değerlerin tekrar kullanıldığını tespit edin.

```figure
t3-scope-stepup
```

## Yapın

`code/main.py`Proces içindeki bir protokol ve yetki simülatörüdür. Korunan kaynak keşfi, yetki sunucu metadataları, CIMD kayıt, sürümle kapatılmış DCR geri dönüşü, uygulama tipi kontrolleri, PKCE, emiten onaylaması, kaynaklara bağlı tokenler, kapsam artışı,`server/discover`- Evet .`tools/list`, ve bir devletsiz araç talebi.

Modelle analiz edilen istek organları ve yönlendirme başlıkları bulunmaktadır.`Content-Type`veya `Accept`. Ders 09'un Akışlanabilir HTTP adaptörüne bağlayın, bu da `Content-Type: application/json`ve bir `Accept`her ikisini içeren değer `application/json`ve `text/event-stream`- Evet .

Çek şunu:

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Çıktı ilk olarak keşif, CIMD kayıt, sıradan bir okuma, iki ayrı alan step-up ve emitenin anahtarı doğrulama depolama gösterir.

## Kullan

Simülatör nesneleri üretim bileşenlerine göre haritasın:

- `ResourceServer.protected_resource_metadata`RFC 9728 son noktası haline gelir.
- `AuthorizationServer.metadata`RFC 8414 veya OpenID Connect keşfi haline gelir.
- `Client.enroll`CIMD çözünürlüğü ve açık bir DCR uyumluluk dalı olur.
- Emitent tarafından belirtilen müşteri kimlikleri ve `tokens_by_issuer_resource`CIMD URL'si, yetkili sonuçları emitenin üzerine bağlanmışken taşınabilir kalabilir.
- `ResourceServer.handle`göndermeden önce mevcut MCP başlıklarını, jetonu ve araç kapsamını doğrulayan ve her talep hatasını eşleşen JSON-RPC zarfında tutan bir middleware haline gelir.

## Gönder

Bu ders gemileri `outputs/skill-oauth-scope-planner.md`Şimdi kayıt önceliği, emitenin bağladığı tanıklık bilgilerini depolama, başvuru türü, PKCE, kaynak göstergeler, kapsam zorlukları ve mevcut devletsiz talep sınırını tasarlıyor.

## Egzersizler

1. Yenilenme simgesi dönüşümünü ekle ve önceki yenilenme simgesi yeniden kullanımı reddet.
2. Emitent izin listesi ekleyin. Emitent değişikliği sırasında, yalnızca taşınabilir bir CIMD URL'i yeniden kullanın; daha önce emitent tarafından yazılmış tüm kimlik kimliklerini ve simgeleri reddedin.
3. Yetki kodlarına bir sona erme ekleyin ve geç bir değişimin başarısız olduğunu onaylayın.
4. Uzak bir HTTPS yönlendirme ile bir web istemci variansı oluşturun ve DCR metadatalarını yerel istemci ile karşılaştırın.
5. Aynı emitenin altında ikinci bir kaynak ekleyin. Erişim tokeninin ilk kaynakta kullanılamayacağını onaylayın.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| Protected-resource metadata | RFC 9728 document that identifies the resource and authorization servers |
| CIMD | HTTPS metadata document whose URL is the OAuth client identifier |
| DCR | Deprecated dynamic client enrollment retained for compatibility |
| `application_type` | `native` or `web`, used to validate redirect URI rules |
| PKCE | Verifier and S256 challenge that protect an intercepted authorization code |
| `iss` | RFC 9207 authorization response issuer identifier |
| Resource indicator | RFC 8707 parameter that binds a token request to an MCP resource |
| Audience | Resource for which a token is valid |
| Step-up | New consent and token issuance for an additional current-operation scope |
| Issuer-bound credentials | Registration and token records isolated by exact authorization server issuer |

## Daha Fazla Okumak

- [MCP 2026-07-28 authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [OAuth Client ID Metadata Document draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)
