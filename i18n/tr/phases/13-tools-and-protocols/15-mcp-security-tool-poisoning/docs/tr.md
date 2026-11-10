# MCP Güvenliği: Zehirli Metadata, Routing ve MRTR Durumu

> Ülke dışı olmak güvensiz anlamına gelmez. Her talebin bir sunucu ve geçit tarafından çağrıyı bağımsız olarak onaylamak için gerekli kanıtları ortaya çıkarması anlamına gelir.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Araç tanımlarını, notları, istemci bilgileri ve sunucu bilgileri güvenilmeyen veriler olarak değerlendirin.
- Metadata zehirlenmesi, tanımlayıcı değişimi ve sunucu adı çarpışmalarını tespit et.
- 2026-07-28 talebinin metadatalarını ve Akışlanabilir HTTP yönlendirme başlıklarını doğrulayın.
- MRTR ' yi koruyun .`requestState`Dönüştürme ve doğrulamaları kesin argümanlara bağlama karşısında.
- Bir protokol seansı kaldırılmadan önce bir başvuruya yetki ve oran sınırlarını uygulayın.

## Sorun

Bir model, hangi çağrıda bulunacağını belirlemek için araç tanımlarını okuyor. Bir yönlendiricisi, hangi talebi göndereceğini belirlemek için araç isimlerini okuyor. Bir kullanıcı, hangi şeyi onaylayacağını belirlemek için etiketleri okuyor. Bir kötü niyetli tanımlayıcı, üçü de hedefleyebilir.

Resmi MCP güvenlik rehberliği doğrudandır: tanımlar ve notlar güvenilir bir sunucudan gelmedikçe güvenilmez olarak değerlendirilmelidir. O halde bile, dağıtım güvenliği değişebilir. Bir sunucu güncelleme, tehlikeye girdiği paket, kayıt hatası veya geçit birleşimi modelin gördüğünü değiştirebilir.

Güncel protokol güvenlik sınırını da değiştirir. 2026-07-28'de çekirdek el sıkışması ve ulaşım seansı yoktur.`Mcp-Session-Id`Bu bir tasarım değil.

## Anlaşım

### Kontrol etmeye değer yedi saldırı yüzeyi

Dikkatli olmak için belirsiz talimat yerine kesin bir liste kullanın.

1. **Metadata poisoning.**Bir açıklama, açıklanan araç davranışıyla ilişkili olmayan talimatları içerir.
2. **Descriptor rug pull.**Önceden onaylanmış bir isim, açıklama, şema veya not değişikliği.
3. **Cross-server shadowing.**İki arka plan aynı niteliksiz araç adını ortaya çıkarır ve yönlendirme sessizce birini seçer.
4. **Header and body confusion.** `Mcp-Method`veya `Mcp-Name`JSON-RPC talebiyle aynı fikirde değil.
5. **Capability escalation.**Bir eşlik bir uzantı veya müşteri özelliği talep ve sunucu bu yetki bildirimi hatalar.
6. **MRTR state tampering.**Bir müşteri değişir .`requestState`, farklı bir soruya cevap verir veya farklı argümanlar ile onayını tekrar kullanır.
7. **Supply-chain identity confusion.**Tanıdık bir görüntü adı yayıncı veya sunucu kimliğinin kanıtı olarak değerlendirilir.

Bu yüzeyler üst üste geçiyor. Hash pençeliği tanımlayıcı değişikliklerinde yardımcı olur, ancak ilk tanımlayıcıın güvenli olduğunu kanıtlamaz. Statik tarama açık ifadeleri yakalar, ancak ince talimatları değil. Ad boşluğu bir çarpışma sınıfını önler, ancak kötü niyetli bir isim boşluğu sunucusu değildir. Kontrolleri yığ.

### Mevcut başvuru zarfı kimlik değil kanıt.

2026-07-28'deki her talepte:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "elicitation": {"form": {}}
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "security-lab",
      "version": "1.0.0"
    }
  }
}
```

Her istek için sürüm ve yetenek biçimini doğrulayın. Uygun bir yanıt biçimi seçmek için yetenekleri kullanın.`clientInfo`- Kendini rapor eden bir başkan olarak doğrulanmış.

Aynı uyarı `io.modelcontextprotocol/serverInfo`Bu bir sertifika, kayıt kanıtı veya yetki kararı değildir.

### Politika öncesi yönlendirmeyi doğrulayın

- Evet .`tools/call`, Akışlanabilir HTTP içerir:

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.export
```

Başlık yöntemi, vücut yöntemi ile eşit olmalıdır. Başlık adı `params.name`- Anlaşmazlıkları reddet .`-32020`bir arka uç seçmeden, RBAC uygulamadan veya bir oran sınırı tokenini tüketmeden önce.

Bu düzenleme ortak bir belirsizlikin kapısını kapatır: Bir bileşen vücudu yetkilendirirken diğer bir kısmı başlıktan geçer.

Kablo doğrulama tam bir sırayla takip eder. JSON-RPC ve metadata türlerini doğrulayın, başlık değerlerini vücut ile karşılaştırın, sonra eşleşen sürümün desteklendiğini kontrol edin. Eşleşmeyen başlık HTTP 400 ile geri gönderir `-32020`. Başlık ve vücut desteklenmeyen bir versiyon için anlaşılırsa, HTTP 400'i  ile geri gönderin.`-32022`ve `data`Tam olarak .`{"supported":["2026-07-28"],"requested":"<actual>"}`Bilinmeyen bir yöntem HTTP 404 ' i  ile gönderir .`-32601`- Evet .

Her hata nesnesi seçeneği içerir `data`Sözleşme yapılandırılmış geri kazanma bilgileri gerektirdiğinde.`id`Bu nedenle, hiçbir zaman JSON-RPC başarısı veya hata cevabını almaz. Kabul edilen HTTP bildirimi boş bir vücutla 202'yi gönderir.

### Tüm tanımlayıcıyı bağla

Sadece bir açıklama hash, şema ve not değişikliğini kaybeder. Kullanıcının onayladığı açıklama alanlarını kanonikalize ve hash edin:

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

Bu kayıtları , tıpkı  gibi , bir anahtar altında saklayın .`notes.export`, yayıncı kanıtları ve bu oyuncak örneğinin dışında onaylama süresi ile birlikte.

Her refreshingde:

- Bilinmeyen anahtar: Karantin.
- Aynı anahtar, farklı bir sindirim: Karantin, yeniden onaylanana kadar halı çekme.
- Çift nitelikli olmayan isim: belirleyici isim aralığı gerektirir.
- Tarayıcı vurgu: tamamı tanımlayıcıyı kapat ve gözden geçirin.

Hash eşitliği güvenlik değil istikrarı kanıtlar.

### Statik tarama üç telden ibarettir .

Basit desenler rol etiketlerini, talimat üstlenmeleri, gizleme, gizli erişim ve gizlenmiş ağ hedeflerini işaretleyebilir. Kurulum süresi ve bilgi bilgisayarı için yeterince ucuzlardır.

Bu, semantik bir kanıt değildir. Güvenli bir açıklama meşru bir uyarıda işaretli bir cümle içerebilir. Kötü bir açıklama her cümleyi önleyebilir. Tarayıcı çıkışını otomatik bir masumiyet puanı değil, inceleme kanıtı olarak değerlendirin.

### Birleştirmeden önce isim alanı

İki sunucu her ikisini de açığa çıkarırsayalım .`search`- Neyi kazanacağını asla keşif emri karar vermesin.

```text
notes.search
issues.search
```

Yasal isim, kamu kapı adı. Arka uç haritasını ayrıca kaydet. Kalıcı isimler onay, denetim, hash pinleri ve `Mcp-Name`yönlendirme aynı nesneyi ifade eder.

### Yetenekler uyumluluk deklarasyonlarıdır

İstek üzerine`clientCapabilities`Bu, bir sunucuya istemcinin hangi protokol özelliklerini işleyebileceğini söyler.

Yetki yine de doğrulanmış başlık ve kaynak politikasından gelir.

1. -Gidemeyi doğrulayın.
2. Versiyon, başlıklar ve talep biçimi doğrulanır.
3. - Yetenek uyumluluğunu kontrol et.
4. Önemli, araç, kaynak ve argümanları yetkilendirin.
5. Kullanıcı girişini gerçekleştirmek veya istemek.

### Devletsiz MRTR onayını koruyun

Sonuçlı bir araç kullanıcı onayına ihtiyaç duyabilir. Mevcut MCP, sunucu-klient geri çağrısı yerine Multi Round-Trip Requests kullanır.

İlk cevap:

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "confirm": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Export notes to archive?",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "confirm": {"type": "boolean"}
          },
          "required": ["confirm"]
        }
      }
    }
  },
  "requestState": "opaque-integrity-protected-value"
}
```

Müşteri giriş alır ve yeni bir JSON-RPC kimliği ile orijinal yöntemi tekrar dener:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes.export",
    "arguments": {"query": "private", "destination": "archive"},
    "requestState": "opaque-integrity-protected-value",
    "inputResponses": {
      "confirm": {
        "action": "accept",
        "content": {"confirm": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

Her biri .`inputRequests`değer ,  ile birlikte tam bir gömülü bir istektir .`method`ve `params`. Anahtar , `inputResponses`. Bir form çıkartma bir nesne kökü kullanır `requestedSchema`, ve istemci, sunucu tarafından talep edilmeden önce form başlatma yeteneğini açıklamış olmalıdır.

Şu anki kapasite iki geçerli form açıklaması vardır. `{"elicitation":{}}`Bu, bir tür delil oluşturmayı desteklerken,`{"elicitation":{"form":{}}}`Sadece URL'li bir açıklama, örneğin `{"elicitation":{"url":{}}}`sunucu HTTP 400 ile `-32021`ve `data.requiredCapabilities` eşit`{"elicitation":{"form":{}}}`- Evet .

Tedavi et .`requestState`Bu, bir ders kodunun HMAC ve kesin argüman eşleşmesini kullanarak sınırları görünür kılıyor.

Nonce ledger bir geçit nesnesinin içinde yaşamaları gerekmez. Çalıştırılabilir model, sınırlı, TTL'ye göre kesilmiş bir tekrarleme depoyu enjekte eder ve bu depoyu birden fazla geçit örneği paylaşabilir. Atomik iddiası yürütme sınırıdır: sadece onaylanmış kabul veya açık bir terminal düşüşü durum tüketir.`cancel`Bir üretim filosunun ortak kalıcı depolamalarda aynı koşullu talep gerektirir.

Bir protokol oturumunda gizli onay bağlamını saklama. Herhangi bir sunucu örneği tekrar denemeyi doğrulayabilmelidir.

### Yüksek riskli çağrılar için ikinci kural

Bir çağrıyı üç eksel boyunca sınıflandır:

- Güvenilmeyen girişleri tüketir.
- Hassas verilere erişebilir.
- Sonuç olarak dış eylemlere neden olur.

Tek otomatik adım, üçü de birleştirmemelidir. Onu bölün, ayrıcalıkları azaltın veya MRTR üzerinden açık kullanıcı girişini isteyin. Bu bir tasarım heuristik, bir protokol yeteneği değil.

### İdamdan önce yetkiyi azaltmak

Devletsizlik tek başına güvenlik değildir. Gizli protokol geçmişini kaldırır, ancak bağımsız bir taleb hala güç sahibi bir yöneticiden verilerin sızmasını veya geri dönüştürülemez bir değişiklik yapmasını isteyebilir. Güvenlik her sınırdaki yetkiyi azaltmaktan kaynaklanır:

1. **Typed verb.**Bir sınırlı işlem açıklayın , örneğin `archive_note`- Genik değil .`run`veya `request`İlişkisiz güçleri ifade edebilecek bir araç.
2. **Validated arguments.**Bilinmeyen alanları reddetmek, bir kez tanımlayıcıları normalleştirmek, limit boyutlarını kullanmak ve politika değerlendirmesinden önce hedef, kiracı ve kaynak sahipliğini doğrulamak için pratik bir kapalı şema kullanın.
3. **Current authorization.**Doğrulanmış başlık, tam fiil, kaynak, ortam ve normal argümanlar ile bağlayın. Araç açıklamaları ve istemci yetenekleri bu yetkiyi vermez.
4. **Action-bound approval.**Sonuçlı bir çağrı için, onayı, yazdırılan fiilin ve normalleştirilmiş argümanların bir dizeğine, ayrıca temel, sonlandırma ve bir kerelik politikalara bağlayın.
5. **First-class refusal.**Model reddetme, sona ermiş onay, kullanıcıların geri çekilmesi ve güvenli olmayan bir hedef sıradan sonuçlar olarak yan etkisi yoktur. reddetmeyi daha zayıf bir geri dönüş aracı haline getirmeyin.
6. **Redacted audit evidence.**Kim sormuş, hangi tanımlayıcı ve politika sürümü kullanılmış, hangi normal hedef yetkilendirilmiş, neden karar izin verildi veya reddedildi ve uygulanma başladığı kaydedildi.

Her adım, bir sonraki bileşenin yapabileceği şeyleri daraltır. Son işlemci, ham model metni ve geniş yetenekler eklemek yerine, zaten doğrulanmış bir etki alanı komutu almalıdır. MRTR yeniden deneme, görev güncelleme veya geçit yoluyla gönderilen çağrıda tüm zinciri tekrarlayın. Daha önceki bir onay, sonraki istekleri güvenilir oturum trafiğine dönüştürmez.

### Mevcut ve eski etkileşim yolları

Roots, Sampling ve Logging yeni 2026-07-28 uygulamaları için geçersiz hale getirilmiştir. Bir geçit sadece bir versiyon geçitli uyumluluk yolu olarak eski talep-kanal kodu koruyabilir.

Bir seans başına örnekleme sınırlayıcıyı çevreleyerek yeni bir savunma oluşturmayın. Kimlik oranlarını doğrulanmış başlık, emiten, kaynak, araç ve zaman penceresine uygulayın.

### Ülke dışı taşımacılık kontrolleri

- Tek POST uç noktasında modern MCP mesajlarını kabul edin.
- 405'i modern GET ve DELETE için geri gönder.
- Ne parmaklık yapın ne de güvenin .`Mcp-Session-Id`- Evet .
- Eski seansları görmezden gel ve yetki girişleri olarak başlıkları tekrar oynat.
- Bu POST için JSON veya talep-scoped SSE geri gönderin.
- Kullanım`subscriptions/listen`Sadece uzun ömürlü değişiklik bildirimleri için seçilir.

```figure
tp-tool-poisoning
```

## Yapın

`code/main.py`Proces içindeki küçük bir güvenlik geçit modeli uyguluyor. Tüm araç tanımlayıcılarını kanonize eder ve pinler yapar, metadata zehirlenmesi ve gölgeleme raporları verir, modern talep zarfını ve yönlendirme değerlerini doğruluyor ve imzalanan bir iki turlı onaylı ihracat gerçekleştirir `requestState`ve enjekte edilmiş ortak bir tekrarlama mağazası.

Modeldeki HTTP adaptörü JSON vücudu ve yönlendirme başlıklarını analiz ettikten sonra başlar.`Content-Type`veya `Accept`Aynı dispatcher'ı Ders 09'un tam Streamable HTTP adaptörüne bağlayın, bu da `Content-Type: application/json`ve bir `Accept`her ikisini içeren değer `application/json`ve `text/event-stream`- Evet .

Çek şunu:

```bash
cd phases/13-tools-and-protocols/15-mcp-security-tool-poisoning
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Örnek kasıtlı olarak bir tanımlayıcıya mutasyon yapmaktadır.`input_required`Cevap ve devletsiz bir tekrar deneme.

## Kullan

Değiştir `SAFE_TOOLS`Bu, kendi onaylanmış sunucularınızdan normal bir anlık görüntüleri ile birlikte. İstihbarat bilgileri ve sırları anlık görüntülere dahil etmeden saklayın.

Bir geçitde, keşif sırasında ve göndermeden önce aynı kontrolleri çalıştırın. Bir önbelleğe keşif işini azaltır, ancak önbelleğe alınan onay, tanımlayıcı değişirken sona ermeli veya geçersiz hale gelmelidir.

## Gönder

Bu ders gemileri `outputs/skill-mcp-threat-model.md`Metadata, yönlendirme, kapasite, yetki, MRTR, önbelleğe, kayıt ve uyumluluk sınırları üzerinden mevcut protokol tehdit modeli üretir.

## Egzersizler

1. Doğrulanmış başlık ve mevcut yetki kararını mühürlenmiş MRTR devletiyle bağlayın, sonra farklı başlık altında yeniden denemeyi reddedin.
2. Hatırlatmada tekrarlama depoyu sürekli koşullu bir ekleme ile değiştirin ve iki işlemin her ikisi de bir nonce talep edemeyeceğini kanıtlayın.
3. Tekrar oynatma talebinden sonra, ancak simülasyonlı bir ihracattan önce bir hata enjekte edin.
4. Bir aletin yerini değiştir `inputSchema`Tüm tanımlayıcıları yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp yakalayıp
5. Halk önbelleğini kabul etmeyi reddeden bir politika ekleyin .`tools/list`Başlık farklıdır.
6. Geçidi arkasında eski bir sunucu modeline.`2025-11-25`uyumluluk dalı.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| Metadata poisoning | Instructions or deceptive claims embedded in a tool descriptor |
| Rug pull | Change to a previously approved descriptor |
| Tool shadowing | Ambiguous routing caused by duplicate unqualified names |
| Header mismatch | Routing header and JSON-RPC body disagreement, error `-32020` |
| Hash pin | Digest of the complete approved descriptor |
| MRTR | Stateless response and retry pattern for server-requested input |
| `requestState` | Opaque round-trip value that must be treated as untrusted input |
| Capability declaration | Statement of protocol compatibility, not authorization |
| Implicit form support | An empty `elicitation` capability object, equivalent to form support |
| Qualified tool name | Stable gateway name such as `notes.search` |

## Daha Fazla Okumak

- [MCP security and trust guidance](https://modelcontextprotocol.io/specification/2026-07-28#security-and-trust--safety)
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
