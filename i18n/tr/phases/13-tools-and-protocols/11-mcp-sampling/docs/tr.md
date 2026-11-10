# MCP Model Girişi: Örnekleme Göçmenliği ve İnsansız MRTR

> MCP 2026-07-28 yeni tasarımlar için örneklemeyi geçersiz kılar ve sunucu-klient istek kanalını kaldırır.`input_required`Bu işlemler, bir sonraki işlemin sonuçlarını gösterir ve istemci orijinal talebi model çıkışı ile tekrar dener.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- MCP 2026-07-28'de örnekleme neden geçersiz hale geldiğini açıklayın ve yeni sunucular için doğrudan model entegrasyonu öntanımlı seçimini seçin.
- Uygunluk iş akışı uygulanır `sampling/createMessage`Çoklu dönüş yolculuğu (MRTR) talepleri üzerinden.
- Protokol gözden geçirilmesi ve her talebe müşteri yeteneklerini ekleyin `_meta`- Ne? - Ne?
- Geri dön .`resultType: "input_required"`ve yeni bir JSON-RPC kimliği ile orijinal yöntemi tekrar deneyin.
- Doğruluk korunması `requestState`ve onu temel, yöntem, argüman ve sona ermesi ile bağlar.
- Kapalı model desteklenen döngüler, yetenek kontrolleri, onaylama, cevap doğrulama ve yuvarlak bir sınır ile.

## Protokol Öncesindeki Karar

Bir araç gibi`summarize_repo`İki iş türüne ihtiyaç duyar:

1. Deterministik iş: dosyaları listelemek, izin verilen dosyaları okumak, yolları doğrulama ve içeriği birleştirmek.
2. Model çalışma: temsilci dosyaları seçin ve özetin sentezi yapın.

Şimdi iki geçerli mimarlığa sahipsiniz.

### Yeni sunucu: doğrudan bir model sağlayıcı ile entegre

Bu mevcut varsayılan. Sunucu model seçeneğine, yeteneklerine, bütçelerine, tekrar denemelerine ve gözlemlenebilirliğine sahiptir.`tools/call`MCP müşterisine sonuç.

Sunucu zaten barındırılan bir hizmet olduğunda veya tahmin edilebilir model davranışının barındırıcının modelini kullanmaktan daha önemli olduğu zaman seçin.

### Var olan örnekleme iş akışı: MRTR'ye aktar

Örnekleme, sonlandırma penceresi sırasında hala var. 2026-07-28'yi hedef alan bir sunucu canlı bir mesaj gönderemez.`sampling/createMessage`Bu durumda, bu talebi bir`InputRequiredResult`- Evet .

Bu uyumluluk yolunu yalnızca istemcinin modelini kullanırken seçin ve yetenekler gerçek bir ürün gereksinimidir. Yeni uygulamalar eski örneklemeyi benimsememeliğinden bir kaldırma planını kaydet.

## Ülkesizlik Sözleşmesi

Temmuz 2026 protokolü hiçbir şey yapmadı.`initialize`Değişiklik, hayır.`notifications/initialized`- Hayır .`Mcp-Session-Id`Her talepte eskiden el sıkışmasında yaşayan bilgiler yer alır:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

Sunucu, her istek üzerinde düzeltmeyi doğruluyor. Kayıp veya dizilmemiş bir sürüm geçersiz parametrelerdir.`-32602`Desteklenmeyen bir dizileri gönderir .`-32022`Tam verilerle`{"supported":["2026-07-28"],"requested":"<client version>"}`- Kayıp bir örnekleme yeteneği geri döndü .`-32021`- Evet .`data.requiredCapabilities` ayarlanmıştır`{"sampling":{}}`- Evet .

JSON-RPC olmadan bir zarf `id`Bu bir uyarıdır. Alıcı onu işleyebilir, ancak ne bir başarısızlık cevabı ne de bir hata cevabı gönderir.`202 Accepted`Kabul edilmiş bir bildirim için hiçbir organ bulunmamaktadır.

Sunucu da uyguluyor `server/discover`Tam olarak .`supportedVersions`Anahtar, yetenekler, `ttlMs`ve`cacheScope`Bu yüzden bir müşteri bir aracı aramanın önünde sunucu sözleşmesini öğrenir ve önbelleğe kaydediyor.`tools`, sunucu da zorunlu uygulamaları yapar `tools/list`- Deterministik .`summarize_repo`Deskriptör geçerli bir nesne içerir `inputSchema`- Evet .`resultType: "complete"`, sunucu kimliği metadataları ve kamu kaş ipuçları.

Her başarılı modern sonuç bir ayrımcıya sahiptir:

- `resultType: "complete"`Operasyon bitti demektir.
- `resultType: "input_required"`Yani müşteri gömülü istekleri yerine getirmeli ve tekrar denemeli.
- Uygulamalar ek sonuç türlerini tanımlayabilir.`"task"`13. Ders.

## Bir MRTR Rundi

Sunucu, istekle çalışırken istemciyi arayamaz. Bunun yerine bu sonucu gönderir:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

Müşteri, örneklemeyi desteklediğini doğruluyor, onay ve model politikalarını uyguluyor ve bir model cevabı elde ediyor.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

Tekrar deneme bir protokol seansının bir devamı değildir. Orijinal yöntem ve argümanları tekrarlayan yeni bir istektir, sadece mevcut turun `inputResponses`, ve yankıları `requestState`Bayt bayt.

MRTR sadece `tools/call`- Evet .`prompts/get`ve`resources/read`Bir sunucu geri dönmemelidir .`input_required`İlişkili olmayan yöntemlerden.

## Çok Yönlü Devlet

Bu derste iki örnek çağrı gerekiyor:

1. `pick_files`JSON dizini gönderir.
2. `summary`Son prozanı geri verir.

Her tekrar deneme sadece bu tur için cevapları taşır. bu nedenle sunucu aşama ve onaylanmış ara verileri bir sonraki `requestState`- Evet .

Bu değerleri saldırgan kontrolü altında tutmak.

- Kendini bildirmeyen, doğrulanmış başlık `clientInfo`- ...
- Kaynaklı ürünlerin üretimi;
- orijinal argümanların bir parçacığı;
- Kısa bir sürede sona erer;
- mevcut aşama ve onaylanmış orta değerler.

Gizlilik gerekmediğinde HMAC kullanın. Müşteri durumu okumaması gerektiğinde doğrulanmış şifreleme kullanın. Kötü bir imza, geçerli olmayan değer, değiştirilmiş temel veya değiştirilmiş argümanlar ile reddedin `-32602`- Evet .

Müşteri analiz veya değişiklik yapamaz.`requestState`Tek görevi tekrar deneme sırasında tam bir ip eklemek.

## Model Seçenekleri İpuçlar

`costPriority`- Evet .`speedPriority`ve`intelligencePriority`Bu seçenekler, olasılık dağılımları değildir ve bir tek kişiye toplamın gerekliliği yoktur.

- Tutun .`includeContext`- ...`"none"`Eğer eski bir örnekleme akışını sürdürüyorsanız. Diğer bağlam modları sızma riskini arttırır ve kendileri geçersiz hale gelir.

## Güvenlik Değişiklikleri

Müşteri, gömülü örnekleme istekleri için güven sınırıdır.

- Kullanıcıya, politika onay gerektirdiğinde, sunucu'nun modelden ne yapmasını istediğini gösterir.
- Bir kötü amaçlı sunucu, başka türlü bir model harcama döngüsü oluşturabilir.
- Dosya adı, URL veya araç giriş olarak kullanmadan önce her örnekleme cevabını doğrulayın.
- Bir turda bayt ve simgeler sınırlandır.
- Geçerli istemci yeteneklerinde açıklanmamış bir giriş istekini reddet.
- Model çıkışını yetki kararlarından uzak tutun.
- Kayıtlı istek içeriğini kaydetmeden, kaynak metodu ve giriş-istihaye anahtarını kaydet.

`clientInfo`ve `serverInfo`İkisini de kimlik olarak asla kullanmayın.

```figure
t3-sampling-flip
```

## Yapın

`code/main.py`Üçüncü taraf paketleri olmadan tam iki yönlü akışı uyguluyor:

- `server/discover`Devamı`supportedVersions`, araç desteğini reklam eder ve önbelleğe işaretler gönderir.
- `tools/list`Deterministik, cacheable bir `summarize_repo`nesne giriş şeması olan açıklayıcı.
- `tools/call`istek açısından metadataları onaylar.
- İlk sonuç da bu şekilde ortaya çıkıyor .`sampling/createMessage`Dosya seçimi için.
- İlk tekrar deneme model sonuçını onaylar ve ikinci bir talebi yerleştirir.
- HMAC korumalı `requestState`bağımsız talepleri arasında bir aşama geçirir.
- Son sonuç kullanımı `resultType: "complete"`- Evet .

Sahte ev sahibi modeli örneği belirleyici yapar.`fake_host_model`Gerçek bir ev sahibi bağladığında, sunucu tarafındaki durum makinesi belirleyici ve test edilebilir olmalıdır.

## Kullan

Depo kökü:

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Beklenen kontrol noktaları:

- Discovery , `ttlMs`ve `cacheScope`- Evet .
- Araç keşfi aynı sınıflandırılmış tanımlayıcıyı  ile gönderir`resultType`, sunucu kimliği ve önbelleğe işaretler.
- Kayıp özellikler ve desteklenmeyen sürümler tam kullan `-32021`ve `-32022`hata verileri.
- İdsiz bir bildirim JSON-RPC cevabını üretmez.
- İstek kimlikleri `[1, 2, 3]`, her MRTR turunun bağımsız olduğunu kanıtlıyor.
- İlk iki sonuç:`input_required`- Evet .
- Son sonuç şu:`complete`Seçilen dosyaları ve özet içerir.
- Yeniden deneme sırasında orijinal argümanları değiştirmek, talep durum kontrolünü başarısız eder.

## Gönder

`outputs/skill-sampling-loop-designer.md`Şimdi bir göç planlayıcısıdır. İlk olarak örnekleme doğrudan model entegrasyonu için kaldırılmalı mı karar verir. Eğer uyumluluk gerekirse, MRTR turları, durum bağlama, kapasite kapısı, bütçe, doğrulama ve kaldırma planını üretir.

## Egzersizler

1. Dosya seçimi cevabını geçersiz JSON'a değiştirin. Sunucu geri döndürülmesini onaylayın `-32602`model çıkışına güvenmek yerine.
2. Değişiklik`audience`İlk çağrı ve tekrar deneme arasında.
3. Ev sahibi'nin özetini eleştirmesini isteyen üçüncü bir tur ekleyin.
4. Sahte host çağrısını sunucuya ait bir model adaptörü ile değiştirerek örneklemeyi kaldırın. Onaylama, faturalama ve gözlemleme sorumluluklarının sunucuya geçeceğini listelenin.
5. Son tarihten bir saniye sonra olan bir devlet değeri kullanarak bir sona erme testi ekleyin.

## Anahtar Terimler

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Sampling | Deprecated feature that asks the client's model for a completion |
| MRTR | Stateless retry pattern for client input required during a request |
| `InputRequiredResult` | Result with `resultType: "input_required"` |
| `inputRequests` | Server-assigned map of embedded elicitation, sampling, or roots requests |
| `inputResponses` | Current round's client results keyed like `inputRequests` |
| `requestState` | Opaque server state echoed exactly by the client and verified by the server |
| `resultType` | Required discriminator for modern MCP results |
| Direct model integration | Recommended replacement for new servers that need model inference |
| Capability gate | Rule that prevents sending an embedded request the client did not advertise |
| Loop budget | Maximum rounds, tokens, bytes, time, and spend allowed for the operation |

## Miras Uygunluğu

2025-11-25'e bağlı bir istemci hala eski sunucu başlatılmış kullanılabilir.`sampling/createMessage`Bu davranışları sadece bir versiyon özel adaptörde tutun. Sessiyonlu yolu 2026-07-28 sunucusunun mimarisine dönüştürmeyin.

Resmi SDK'ler modernleri çevirebilir `input_required`Bu şim uyumluluk sınırı, yeni seans bağımlı mantık ekleme iznidir.

## Daha Fazla Okumak

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
