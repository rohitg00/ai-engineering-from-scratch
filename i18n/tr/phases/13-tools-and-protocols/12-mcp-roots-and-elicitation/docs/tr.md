# Açık Görebilirlik ve Vatandaşı Olmayanlar Hakkında İstek

> MCP 2026-07-28'de kökler eski haline geldi ve hiçbir zaman güvenlik sandbox değildi. Görünür araç argümanlarına veya kaynak URI'lerine boyut koyun, sunucuda yetkilendirin ve bir araçın kullanıcı girişine gerçekten ihtiyacı olduğunda MRTR kullanın. Kullanıcı kararı görür, model elini görür ve her sunucu örneği tekrar denemeyi işleyebilir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 11 (stateless MRTR)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Geçmişte kullanılmış Kökleri açık çalışma alan parametreleri, kaynak URI'leri veya sunucu yapılandırması ile değiştirin.
- Yetkililik, yol kısıtlaması ve işletim sistemi sandboxing'den ayrı kapsam ipuçları.
- Sunuç biçimi `elicitation/create`MRTR üzerinden`input_required`Sonuç.
- Arama başına müşteri yeteneklerinde çağrıyı destekleme desteklerini reklam edin ve desteklenmeyen modları reddedin.
- Geçerlileştir`accept`- Evet .`decline`ve`cancel`- Evet. - Evet.
- Yıkıcı onayı doğrulanmış bir başlık, orijinal argümanlar, aday seti ve sona ermesi ile bağlayın.

## İki Sorun Birbirine Benziyor

Notlar aracı bu isteği alır: "Eski TPS raporunu sil".

Sunucu iki farklı soruya cevap vermeli.

1. Bu operasyon hangi çalışma alanına dokunabilir?
2. Kullanıcı üç eşleşen nottan hangisini kastediyordu?

Birincisi kapsam ve yetki. İkincisi etkileşimli belirsizlik. Onları karıştırmak tehlikeli tasarımlara yol açar, örneğin müşteri tarafından sağlanan bir klasörü aramacı'nın içindeki her şeyi silebileceğini kanıtlamak gibi.

## Kökler Göçme Yüzeyi

Daha önceki MCP revizyondaki bir istemci Roots'u reklamlamasına ve listenin değiştirildiği zaman bir sunucuyu bilgilendirmesine izin verdi. Roots bilgi rehberliğiydi.

MCP 2026-07-28 iptal edildi `roots/list`ve `notifications/roots/list_changed`Yeni tasarımlar için.

- A.`workspaceUri`veya `directory`Araç argümanı, arama başına alan değişirken.
- Bir kaynağı hedef alan operasyonda bir kaynak URI.
- Bir dağıtımın bir sabit çalışma alanına sahip olduğu zaman sunucu yapılandırması.
- Bir işlem sandbox veya kilitli dosya sistemi, kodun teknik olarak kaçamayacağı zaman.

Eğer mevcut bir 2026-07-28 entegrasyonunun hala ihtiyacı varsa `roots/list`Depolama penceresi sırasında, sunucu MRTR'ye ekler `inputRequests`Bu bir göç adaptörüdür; yeni işleyiciler bunun yerine açık bir kapsam kabul etmeli.

Model açık bir elini görebilir ve tekrarlayabilir. Gizli taşıma oturumlarının kapsamını incelemek, tekrarlamak, denetlemek ve yönlendirmek daha zor.

### Üç katlı kural

Açık bir URI hala kendini onaylamaz.

1. **Authorization:**Bu doğrulanmış yöneticinin bu çalışma alanını kullanmasına izin veriliyor mu?
2. **Containment:**Normal hedef URI'si yetkili çalışma alanının sınırları içinde mi kalır?
3. **Sandbox:**İşletim sistemi, tehlikeli bir sunucunun kaçmasını engelleyebilir mi?

Çalıştırılabilir sunucu yetkili çalışma alanı URI'lerinin izin listesi tutar, yüzde kodlanmış yolları normalleştirir, gerçek bir yol-komponent sınırı kontrol eder ve silmeden hemen önce tutumu tekrar kontrol eder.

Saçmalamlı string prefix kontrolleri yanlış:

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

Her iki düşman yol da yanıltıcı bir iple başlar. Önce yol bileşenlerini normallaştırın, sonra da yol bileşenlerini karşılaştırın. Bir üretim dosya sistemi sunucusu ayrıca sembolik bağlantı yarışlarına ve platform-spesifik yol semantiğine karşı savunmalıdır.

## İhtiyaç Hala Var Ama Verim Değişti

Elicitation ,  sırasında kullanıcı girişlerini toplamak için mevcut istemci özelliğidir .`tools/call`- Evet .`prompts/get`veya`resources/read`. Metod adı kalır `elicitation/create`- Sınır akışının yönü değişti.

2026-07-28 sunucusu ters bir JSON-RPC talebi göndermez.`InputRequiredResult`- ...

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "delete_choice": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Choose one matching note and confirm deletion.",
          "requestedSchema": {
            "type": "object",
            "properties": {
              "note_id": {
                "type": "string",
                "enum": ["note-3", "note-7", "note-14"]
              },
              "confirm": {"type": "boolean"}
            },
            "required": ["note_id", "confirm"]
          }
        }
      }
    },
    "requestState": "integrity-protected-delete-state"
  }
}
```

Host formunu gösterir. Kullanıcı kabul edebilir, açıkça reddedebilir veya reddedebilir.`tools/call`Yeni bir kimlik ile:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes_delete",
    "arguments": {
      "workspaceUri": "file:///Users/alice/Documents/Notes",
      "title": "TPS report"
    },
    "inputResponses": {
      "delete_choice": {
        "action": "accept",
        "content": {"note_id": "note-14", "confirm": true}
      }
    },
    "requestState": "integrity-protected-delete-state",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

İki çağrı arasında protokol oturumı yoktur. Sunucu yankılanmış durumu doğruluyor, beklenen şema ile karşı yanıtı doğruluyor, seçilen notun imzalanan aday seti içinde olup olmadığını kontrol ediyor, çalışma alanını yeniden yetkilendiriyor, içeriği tekrar kontrol ediyor ve ardından silmektedir.

## İhtiyaçla Yetenekleri müzakere edilir

Form modunun çağrısını destekleyen bir müşteri şöyle diyor:

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "elicitation": {"form": {}}
  }
}
```

Boş bir çıkış yeteneği.`"elicitation": {}`, sadece biçim uyumluluğu destekle eşdeğer kalır.`"elicitation": {"form": {}}`Ayrıca form modunu da destekler. Sadece URL açıklaması, `"elicitation": {"url": {}}`Sunucu, önceki bir talepte reklam yapılmış olsa bile mevcut istek yeteneklerinden uzak bir mod eklemeyecektir.

Her talebinde de bir tane var .`io.modelcontextprotocol/protocolVersion`. Kayıp veya ipsiz bir versiyon gönderildi .`-32602`Desteklenmeyen bir dizileri gönderir .`-32022`Tam olarak`supported`ve `requested`Veriler. Kayıp veya sadece URL'li arama destekleri gönderiler `-32021`- Evet .`data.requiredCapabilities` ayarlanmıştır`{"elicitation":{"form":{}}}`- Evet .

JSON-RPC olmadan bir zarf `id`Bu, bir JSON-RPC başarısı veya hata cevabı vermeden işlenir. Streamable HTTP'de kabul edilen bir bildirim alır `202 Accepted`Cesetsiz.

`clientInfo`Bu durum, teşhis için dahil edilmelidir, ancak kendiliğinden bildirilmektedir ve kullanıcıyı yetki için tanımlayamaktadır.

Sunucu uygulaması `server/discover`ve geri dönüşleri`supportedVersions`, yetenekleri,`ttlMs`ve`cacheScope`- Evet .`resultType: "complete"`Modern tasarım için Roots'u reklam etmiyor.`tools/list`Bu sonuç belirleyici değerini gönderir .`notes_delete`Deskriptör, geçerli bir nesne `inputSchema`, sunucu kimliği metadataları ve kamu kaş ipuçları.

## Form Modu

Form modunda kullanılabilir iletişim için tasarlanmış kısıtlı JSON Şeması kullanılır. Kök bir nesnedir ve özellikleri düz primitif alanlar veya desteklenen enum dizileri. Derinlikle örülmüş nesneler ve genel amaçlı belge şemeleri bir onay iletişimine ait değildir.

Şekil modunu kullan:

- Birkaç adaydan birini seçmek;
- yıkıcı bir operasyonun doğrulanması;
- Duygusal olmayan tercihler toplamak;
- Küçük sayıda değer toplamak, model değil kullanıcı tarafından karar verilmelidir.

Parolalar, API anahtarları, erişim jetonları veya ödeme yetenekleri için form modunu kullanmayın. Bu sırlar MCP istemcisi üzerinden geçecek ve günlüklere veya model bağlamına ulaşabilir.

Sunucu geri gönderilen içeriği tekrar doğruluyor. Müşteri taraflı form doğruluğu UX'yi iyileştirir, ancak güven yaratmaz.

## URL Modu

URL modu, bant dışı etkileşim için güvenli bir web URL gönderir:

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Connect the report service to continue.",
    "url": "https://mcp.example.com/connect/report-service"
  }
}
```

Bu, üçüncü taraf yetkisi gibi, hassas bilgiler doğrudan bir sunucu kontrolü altında bulunan web akışına gitmesi gerektiğinde kullanılır. Müşteri tam hedef yeri gösterir ve açmadan önce onay alır. URL'yi önceden almamalıdırır.

Bir `accept`cevap, kullanıcı tarafından URL'yi açmaya kabul edilen anlamına gelir. Dış akışın tamamlandığını kanıtlamaz. Yeniden denediğinde, sunucu kendi durumunu kontrol eder ve ya tamamlar veya başka bir tane gönderir `input_required`Sonuç.

URL başlatılması, MCP istemcisi ve MCP sunucusu arasındaki yetkililiğin yerini almıyor. MCP sunucusu tarafından kullanıcı adına gerçekleştirilmesi gereken bir dış etkileşim için.

## Cevap Şubeleri

Eylemleri, isimsiz olarak değil ürün kararları olarak değerlendirin:

| Action | Meaning | Safe server behavior |
|--------|---------|----------------------|
| `accept` | User submitted the interaction | Validate content and continue |
| `decline` | User explicitly refused | Return a complete, non-error refusal outcome |
| `cancel` | User dismissed or could not finish | Stop safely and allow a later retry |

Kayıp içeriği asla onay olarak yorumlamayın. İptalini tekrarlanan bir istek döngüsüne dönüştürmeyin.

## Yıkıcı MRTR Devleti Koruma

İhtiyaclı listeler sadece bir istek veya imzalanmamış Base64 değeri içinde yaşanamaz. Bir istemci gönderdiği her şeyi kontrol eder.

Ders, aşağıdakileri içeren bir devlet yükü imzalar:

- doğrulanmış başlık;
- Kaynaklı yöntem;
- `workspaceUri`ve `title`- ...
- Formulamda gösterilen izin verilen not kimlikleri;
- İşlem aşaması;
- Kısa sürede.

Mutasyon öncesi, sunucu aynı zamanda canlı not kaydını kontrol eder. Bu, silme yarışlarını ve form gösterildikten sonra çalışma alanının dışına taşındığı bir hedefi yakalar.

Tek seferlik bir finansal veya geri dönüşü olmayan bir eylem için, HMAC tek başına geçerli bir durumun sona ermeden sonra tekrarlanmasını engellemez. Bir nonce'yi her işlemci örneği paylaşan bir tekrarlama mağazasında tam bir kez saklayın ve tüketin. Ders, sınırlı, TTL-kısaltılmış bir depo enjekte eder ve hafıza silinmesini yaparken atomik iddiasını tutar. Bir üretim veritabanı, nonce iddiası ve mutasyonunu bir işlem veya eşdeğer koşullu yazma sınırı ile birleştirmelidir.

İlişkiyi, nonce talep etmeden önce doğrulayın.`cancel`Mutasyon yapmaz ve süresi sona erene kadar tekrar çalışılabilir hale getirir.`decline`Son derece son derece kötüdür, bu yüzden ders hiçbir şeyi silmeden nonce'yi tüketir.

```figure
t3-roots-boundary
```

## Yapın

`code/main.py`modern bir `notes_delete`araç:

- `tools/list`Gerekli çalışma alanı ve başlık şeması ile belirlenmiş, önbelleğe geçebilir bir tanımlayıcı gönderir.
- Kapsam açık bir şekilde belirlenmiştir.`workspaceUri`- Tartışmak.
- Sunucu yapılandırması, ders başkanı için bu çalışma alanını yetkilendirir.
- URI normallaştırması, önbellek karışıklığını ve kodlanmış geçişleri reddeder.
- Her yıkıcı silme form modunun çıkarılmasını gerektirir.
- Çözüm içeriye gidiyor .`resultType: "input_required"`- Evet .
- İmzalanmış .`requestState`Tam aday listesini ve orijinal argümanları bağlar.
- Enjekte edilen tekrarlama depoları, sunucu durumları arasında aynı kabul edilen veya reddedilen durumu reddeder.
- Yeniden deneme yeni bir talebinin kimliğini kullanır ve gönderir `resultType: "complete"`- Evet .

Veri depoları hafıza içindedir, bu yüzden protokol davranışını incelemek kolaydır.

## Kullan

Depo kökü:

```bash
cd phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Beklenen kontrol noktaları:

- Discovery, Köksüz Araçlar için reklam yapıyor.
- Araç keşfi gönderileri `notes_delete`- Evet .`resultType`, sunucu kimliği ve önbelleğe işaretler.
- İstek kimliği`1`formunu gönderir `inputRequests.delete_choice`- Evet .
- İstek kimliği`2`İmzalanmış durumun yankılarını verir ve silinmeyi tamamlar.
- Bir önbellek yolu ve kodlanmış bir geçiş yolu her ikisi de tutuluşu başarısız eder.
- Değişmiş bir başlık orijinal onay durumunu tekrar kullanamaz.
- Bir düşüş notu değişmez bırakır.
- Not ve tekrarlama durumunu paylaşan iki sunucu nesnesi, her ikisi de bir onaylamayı yürütemez.
- Boş ve açık form açıklamaları çalışırken sadece URL desteği doğru bir şekilde gönderir `-32021`form gereksinimleri.
- Desteklenmeyen sürüm hataları tam olarak kullanılır `-32022`Veriler şekli.
- İdsiz bir bildirim JSON-RPC cevabını üretmez.

## Gönder

`outputs/skill-elicitation-form-designer.md`Açık kapsamı, yetki kontrolleri, MRTR formu, yanıt dalları ve devlet bağlamasını tasarlıyor. Eski Kökleri kum kutu gibi tedavi etmeyi veya form modunda sır toplamayı reddediyor.

## Egzersizler

1. Anıtlı tekrarlama depoyu SQLite ile değiştirin. Nonce'yi talep etmek ve notayı silmek için bir işlem kullanın, sonra iki işlemin her ikisinin de commit olamayacağını kanıtlayın.
2. Ekle`url`Bu nedenle, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde de, diğer ülkelerde, diğer ülkelerde de, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde ve diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde ve diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde, diğer ülkelerde de, diğer ülkelerde, ülkelerde de, diğer ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, ülkelerde, kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat kat`inputResponses`- Evet .
3. Hatırlatma not haritasını geçici bir SQLite veritabanı ile değiştirin. Mutasyon işleminin içindeki yetki ve içeriği tekrar kontrol edin.
4. Gerçek bir dosya sistemi uygulaması için sembolik bağlantı politikası ekleyin. URI leksikal kısıtlaması tek başına simlink kaçışını neden durduramayacağını açıklayın.
5. Modern MRTR işlemcilerin çıkışını eski sunucu başlatılmış çıkışlara harcayacak bir 2025-11-25 adaptörü tasarlayın.

## Anahtar Terimler

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Roots | Deprecated informational workspace hints, not authorization or sandboxing |
| Explicit scope | Workspace, directory, or resource handle visible in request arguments |
| Containment | Normalized path-component check that keeps a target inside a boundary |
| Elicitation | Client feature for obtaining user input during an MCP operation |
| Form mode | In-band structured user input using a restricted flat schema |
| URL mode | Out-of-band interaction for sensitive or external workflows |
| MRTR | Stateless input-required result followed by a fresh retry |
| `requestState` | Opaque state echoed exactly and integrity-checked by the server |
| Decline | Explicit user refusal |
| Cancel | Dismissal or incomplete interaction without approval |

## Miras Uygunluğu

2025-11-25'e bağlı bir yaşıt için.`roots/list`- Evet .`notifications/roots/list_changed`, ve canlı sunucu tarafından başlatıldı `elicitation/create`Adaptör varlığını etiketlenir. Eski bir Kök listesi sunucu yetkisi geçmesine izin vermeyin ve protokol seans varsayımlarını modern işlemciye taşımayın.

## Daha Fazla Okumak

- [MCP 2026-07-28 Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Roots deprecation](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
