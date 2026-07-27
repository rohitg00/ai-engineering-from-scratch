# MCP Güvenliği II — OAuth 2.1, Kaynak Göstergeleri, Artımlı Kapsamlar

> Uzak MCP sunucularının yalnızca kimlik doğrulamaya değil, yetkilendirmeye de ihtiyacı vardır. 2025-11-25 spesifikasyonu, OAuth 2.1 + PKCE + kaynak göstergeleri (RFC 8707) + korumalı kaynak meta verileri (RFC 9728) ile uyumludur. SEP-835, 403 WWW-Authenticate'e artırılmış yetkilendirme ile artımlı kapsam onayı ekler. Bu ders, her atlamayı görebilmeniz için yükseltme akışını bir durum makinesi olarak uygular.

**Tür:** Yapım
**Diller:** Python (stdlib, OAuth durumu makine simülatörü)
**Önkoşullar:** Aşama 13 · 09 (taşıma), Aşama 13 · 15 (güvenlik I)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Kaynak sunucusunu yetkilendirme sunucusu sorumluluklarından ayırın.
- PKCE korumalı OAuth 2.1 yetkilendirme kodu akışını yürütün.
- Karışık yardımcı saldırılarını önlemek için `resource` (RFC 8707) ve korumalı kaynak meta verilerini (RFC 9728) kullanın.
- Yükseltme yetkilendirmesini uygulayın: sunucu 403'e WWW-Authenticate ile yanıt verir ve daha yüksek bir kapsam ister; istemci yeniden prompt'nin kullanıcı iznini alır ve yeniden dener.

## Sorun

İlk MCP (2025 öncesi), uzak sunucuları geçici API anahtarlarıyla veya hatta kimlik doğrulaması olmadan gönderiyordu. 2025-11-25 spesifikasyonu bu açığı tam OAuth 2.1 profiliyle kapatıyor.

Üç gerçek dünya ihtiyacı:

- **Sıradan uzak sunucular.** Kullanıcı, Notion / GitHub / Gmail'e erişen uzak bir MCP sunucusu yükler. PKCE'li OAuth 2.1 doğru şekildir.
- **Kapsamın yükseltilmesi.** `notes:read` verilen bir not sunucusu daha sonra belirli bir eylem için `notes:write`'ye ihtiyaç duyabilir. Yükseltme (SEP-835) tüm akışı yeniden yapmak yerine ek kapsamı ister.
- **Karışık yardımcı önleme.** İstemci, Sunucu A için hedef kitle kapsamına alınmış bir token'ye sahiptir. Sunucu A kötü amaçlıdır ve token'yi Sunucu B'ye sunmaya çalışır. Kaynak göstergeleri (RFC 8707), token'yi amaçlanan hedef kitleye sabitler.

OAuth 2.1 yeni değil. Yeni olan, MCP'nin profilidir: belirli gerekli akışlar (yalnızca yetkilendirme kodu + PKCE; örtülü yok, varsayılan olarak istemci kimlik bilgileri yok), her token isteğinde zorunlu olan kaynak göstergeleri ve müşterilerin nereye gideceklerini bilmeleri için yayınlanan korumalı kaynak meta verileri.

## Konsept

### Roller

- **İstemci.** MCP istemcisi (Claude Masaüstü, İmleç vb.).
- **Kaynak sunucusu.** MCP sunucusu (notlar, GitHub, Postgres, her neyse).
- **Yetkilendirme sunucusu.** token'leri yayınlar. Kaynak sunucusuyla aynı hizmet veya ayrı bir IdP (Auth0, Keycloak, Cognito) olabilir.

MCP'nin profilinde, kaynak ve yetkilendirme sunucuları aynı ana bilgisayar OLABİLİR ancak URL'lerle ayırt edilmesi GEREKİR.

### Yetkilendirme kodu + PKCE

Akış:

1. İstemci `code_verifier` (rastgele) ve `code_challenge` (SHA256) oluşturur.
2. İstemci kullanıcıyı `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`'ye yönlendirir.
3. Kullanıcı onay verir. Yetkilendirme sunucusu `redirect_uri?code=...`'ye yönlendirir.
4. İstemci POST'larını `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...`'ye gönderin.
5. Yetkilendirme sunucusu, doğrulayıcının karma değerini saklanan sorgulamaya göre doğrular ve bir erişim token yayınlar.
6. İstemci, kaynak sunucuya yapılan her istekte token: `Authorization: Bearer ...`'yi kullanır.

PKCE, yetkilendirme kodu müdahale saldırılarını önler. Kaynak göstergeleri token'nin başka yerlerde geçerli olmasını engeller.

### Korumalı kaynak meta verileri (RFC 9728)

Kaynak sunucusu bir `.well-known/oauth-protected-resource` belgesi yayınlar:

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

İstemci, yetkilendirme sunucusunu kaynak sunucudan keşfeder. Yapılandırmayı azaltır — istemcinin yalnızca kaynak URL'sine ihtiyacı vardır.

### Kaynak göstergeleri (RFC 8707)

token isteğindeki `resource` parametresi, token'nin hedef kitlesini sabitler. Yayınlanan token, `aud: "https://notes.example.com"`'yi içerir. Bu token'yi alan başka bir MCP sunucusu, `aud`'yi kontrol eder ve reddeder.

### Kapsam modeli

Kapsamlar boşlukla ayrılmış dizelerdir. Ortak MCP kuralları:

- `notes:read`, `notes:write`, `notes:delete`
- Yönetici özellikleri için `admin:*` (az miktarda kullanın)
- Kimlik için `profile:read`

Kapsam seçimi en az ayrıcalıklı olmalıdır: İhtiyacınız olanı şimdi isteyin, daha fazlasına ihtiyacınız olduğunda adım atın.

### Yükseltme yetkilendirmesi (SEP-835)

Kullanıcı `notes:read`'yi verir. Daha sonra agent'den bir notu silmesini isterler. Sunucu yanıt verir:

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

İstemci yetersiz kapsam hatasını görür, prompt kullanıcıya ek kapsam için bir onay iletişim kutusu sunar, bunun için mini bir OAuth akışı gerçekleştirir ve isteği yeni token ile yeniden dener.

### Token kitle doğrulaması

Her istek: sunucu `token.aud == self.resource_url`'yi kontrol eder. Uyumsuzluk = 401. Bu, sunucular arası token'nin yeniden kullanımını durdurur.

### Kısa ömürlü token'ler ve rotasyon

token'lere erişim kısa ömürlü OLMALIDIR (varsayılan 1 saat). Yenile token'ler her yenilemede döner. İstemci arka planda sessiz yenilemeyi gerçekleştirir.

### token geçişi yok

Örnekleme sunucuları (Aşama 13 · 11) istemcinin token'sini diğer hizmetlere AKTARMAMALIDIR. Numune alma talebi sınırdır.

### Şaşkın milletvekili önleme

Token, `aud`'ye bağlanır. İstemci `client_id`'ye bağlanır. Her istek her ikisine karşı da doğrulandı. Spesifikasyon, MCP öncesi uzak araç ekosistemlerinde yaygın olan eski "token'yi geç" modelini açıkça yasaklıyor.

### İstemci Kimliği keşfi

Her MCP istemcisi meta verilerini sabit bir URL'de yayınlar. Yetkilendirme sunucuları, yönlendirme URI'lerini ve iletişim bilgilerini keşfetmek için istemcinin meta veri belgesini getirebilir. Bu, manuel istemci kaydını kaldırır.

### Ağ Geçitleri ve OAuth

Aşama 13 · 17, bir kurumsal ağ geçidinin OAuth'u nasıl işlediğini gösterir: ağ geçidi, yukarı akış sunucularının kimlik bilgilerini tutar, istemciye giden token'ler, ağ geçidi tarafından verilir ve yukarı akış token'ler, ağ geçidinden asla ayrılmaz. Bu, güven modelini tersine çevirir; kullanıcılar ağ geçidinde bir kez kimlik doğrulaması yapar; ağ geçidi N sunucu yetkilendirmesini yönetir.

## Kullan onu

`code/main.py`, bir durum makinesi olarak tam OAuth 2.1 yükseltme akışını simüle eder. Şunları uygular:

- PKCE kod doğrulayıcı / meydan okuma oluşturma.
- Kaynak göstergeli yetkilendirme kodu akışı.
- Korumalı kaynak meta veri uç noktası.
- İzleyici kontrolüyle Token doğrulaması.
- `insufficient_scope`'ye geçiş yapın.

Bu derste HTTP sunucusu yok; durum makinesi bellekte çalışır, böylece her atlamanın izini sürebilirsiniz. Aşama 13 · 17'nin geçiş dersi, bunu gerçek bir aktarıma bağlar.

## Gönderin

Bu ders `outputs/skill-oauth-scope-planner.md`'yi üretir. Araçlara sahip uzak bir MCP sunucusu verildiğinde, beceri kapsam setini, sabitleme kurallarını ve yükseltme politikasını tasarlar.

## Egzersizler

1. `code/main.py`'yi çalıştırın. İki kapsamlı hızlandırma akışını izleyin. Yükseltme sırasında hangi atlamaların tekrarlandığını not edin.

2. Yenileme-token rotasyonu ekleyin: her yenileme, yeni bir token yenilemesi sağlar ve eskisini geçersiz kılar. Çalıntı yenileme token'nin döndürmeden sonra kullanıldığını simüle edin ve başarısız olduğunu doğrulayın.

3. Korunan kaynak meta veri uç noktasını stdlib http.server kullanarak gerçek bir HTTP yanıtı olarak uygulayın. Ders 09'daki /mcp uç noktasını yansıtın.

4. GitHub MCP sunucusu için bir kapsam hiyerarşisi tasarlayın: repoyu oku, PR yaz, PR'yi onayla, PR'yi birleştir, yönetici. Her seviye arasında yükseltmeyi kullanın.

5. RFC 8707 ve RFC 9728'i okuyun. 9728'de MCP'nin RFC örneğinden farklı olarak kullandığı bir alanı tanımlayın. (İpucu: `scopes_supported` ile ilgilidir.)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| OAuth 2.1 | "Modern OAuth" | PKCE'yi zorunlu kılan ve örtülü akışı yasaklayan birleştirilmiş RFC |
| PKCE | "Sahiplik kanıtı" | Kod doğrulayıcı + yetkilendirme kodu müdahalesini yenme mücadelesi |
| Kaynak göstergesi | "Token izleyici kitlesi" | RFC 8707 `resource` parametresi token'yi bir sunucuya sabitliyor |
| Korumalı kaynak meta verileri | "Keşif belgesi" | RFC 9728 `.well-known/oauth-protected-resource` |
| Yükseltme yetkilendirmesi | "Artımlı izin" | Talep üzerine kapsam eklemeye yönelik SEP-835 akışı |
| `insufficient_scope` | "WWW Kimlik Doğrulaması ile 403" | Daha geniş bir kapsam için yeniden onay verilmesine yönelik sunucu sinyali |
| Milletvekili kafası karışık | "Token hizmetler genelinde yeniden kullanım" | Güvenilir bir sahibinin token'yi uygunsuz bir şekilde ilettiği saldırı |
| Kısa ömürlü token | "token TTL'ye erişin" | Süresi çabuk dolan hamiline; yenile token yenileniyor |
| Kapsam hiyerarşisi | "En az ayrıcalık yığını" | Seviyeler arasında yükseltme içeren kademeli kapsam seti |
| İstemci Kimliği meta verileri | "Müşteri keşif belgesi" | İstemcinin kendi OAuth meta verilerini yayınladığı URL |

## Daha Fazla Okuma

- [MCP — Yetkilendirme spesifikasyonu](https://modelcontextprotocol.io/specification/draft/basic/authorization) — standart MCP OAuth profili
- [den.dev — MCP Kasım yetkilendirme spesifikasyonu](https://den.dev/blog/mcp-november-authorization-spec/) — 2025-11-25 değişikliklerine ilişkin genel bakış
- [RFC 8707 — OAuth 2.0 için kaynak göstergeleri](https://datatracker.ietf.org/doc/html/rfc8707) — hedef kitleyi sabitleyen RFC
- [RFC 9728 — OAuth 2.0 korumalı kaynak meta verileri](https://datatracker.ietf.org/doc/html/rfc9728) — keşif belgesi RFC
- [Aembit — MCP OAuth 2.1, PKCE ve yapay zeka yetkilendirmesinin geleceği](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — pratik adım adım ilerleme kılavuzu
