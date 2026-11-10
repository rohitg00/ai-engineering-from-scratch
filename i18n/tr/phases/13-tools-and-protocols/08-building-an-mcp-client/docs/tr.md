# Bir MCP Müşteri Oluşturma: keşif, yönlendirme ve Çift Çağ Düşüşü

> Modern bir MCP istemcisi her istekle sözleşmesini tekrarlar. En zor uyumluluk kararı eski bir sunucunun gerçekten eski olduğunu ve modern bir sunucunun bir hata rapor ettiğini bilmektir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07
**Time:** ~85 minutes

## Öğrenme Hedefleri

- Her MCP ' yi oluşturun .`2026-07-28`Mevcut metadata ile başvuru.
- Sence stdio sunucuları `server/discover`ve karşılıklı desteklenen bir versiyonu seçin.
- Sınırlı bir miras araştırmasını açıkça izin verilen yaşıtlar için izin verin.
- Bir erkeği sadece pozitif bir sonucu doğrulttuktan sonra kabul et .`initialize`desteklenen bir inceleme sonucu.
- Sessizce çarpışmaları üstü yazmadan belirleyici araç listelerini birleştirin.
- Her bir aletin sahibi olan eşlerine protokol seanslarını icat etmeden arama yolu.

## Sorun

Bir ajan host genellikle birden fazla MCP sunucusuna konuşur. Her sunucuyu keşfetmek, araç kataloglarını birleştirmek, kopya isimlerini çözmek, rota çağrılarını yapmak ve ulaşım hatalarından kurtulmak gerekir.

- Evet .`2026-07-28`Değişiklik sabit duruma daha basit hale getirir çünkü her talep kendiliğinden içerir. Uygunluk başlangıç daha ince yapar. Bir istemci:

- tercih edilen sürümü destekleyen modern bir sunucu;
- Tanınan bir sürüm veya başlık hatası gönderen modern bir sunucu;
- Hiç duymadığın bir miras sunucu .`server/discover`- ...
- Alana kadar sessiz kalan bir miras sunucu .`initialize`- Evet .

Her bir sonda hatası miras olarak değerlendirilmesi tehlikelidir. Yanlış biçimlendirilmiş modern bir taleb, aşırı yüklü bir sunucu, ölü bir süreç ve eski bir sunucu, aynı zaman sonunu veya bağlantı kapanmasını oluşturabilir. Bu sinyaller belirsizdir.

## Anlaşım

### Bir akran, protokol oturumu değil

Her sunucu işlem veya son noktası için bir taşıma eş dosyası tutun:

- taşıma elliği veya gönderme işlevi;
- Seçilen protokol çağı ve versiyonu;
- Son keşfedilen sunucu özellikleri;
- son belirleyici araç listesi;
- İlişki için bekleyen talebinin kimlikleri;
- ulaşım sağlığı.

Bu müşteri hesaplama. Bu protokol oturum durumu değil. Modern MCP'de, sunucu hala her istek için mevcut sürüm ve özellikleri alır.

### Her modern talebi sıfırdan inşa et

```python
def modern_request(request_id, method, params, version, capabilities):
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": {
            **params,
            "_meta": {
                "io.modelcontextprotocol/protocolVersion": version,
                "io.modelcontextprotocol/clientCapabilities": capabilities,
                "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
            },
        },
    }
```

Bir bağlantı nesneye bir kez metadata eklemeyin ve teline ulaştığını varsayın. Son serileşmiş talebi damgalayın ve kontrol edin.

### Modern keşif

`server/discover`desteklenen sürümleri, sunucu yeteneklerini, talimatları, önbelleğe işaretleri ve önerilen sunucu kimliğini gönderir. Bir istemci en yüksek karşılıklı desteklenen modern sürümü seçer.

Discovery yalnızca modern bir istemci için seçmeli, ancak studio'da önerilmektedir. Bazı eski sunucular başlangıçtan önce bir işlem kabul eder, bu nedenle göndermek `tools/list`İlk olarak belirsiz bir başarı elde edebilirsiniz.`server/discover`Temiz bir çağ sınırını yaratıyor.

### Stdio uyumluluk sondası

İki çağda bir stüdyo müvekkilesi gönderir.`server/discover`Diğer isteklerden önce tercih edilen modern metadata ile.

1. **DiscoverResult.**Sunucu modern. karşılıklı desteklenen bir sürümü seçin ve istek başına metadata ile devam edin.
2. **Recognized modern error.**Sunucu modern.`-32022`, seçin `data.supported`Başlık veya yetenek hataları için, talebi düzeltin.`initialize`- Evet .
3. **Ambiguous signal.**Tanınmayan bir JSON-RPC hatası, zaman sonlaması, bağlantı kapanması veya boş bir yanıt bir çağı tanımlamaz.

Tanınan modern protokol hataları şunları içerir:

- `-32020`BaşlıkTamışmazlık
- `-32021`İhtiyaçlı Müşteri yeteneği eksik
- `-32022`Desteklenmeyen ProtokolVersion

Tanınan modern hatalar, eşleri miras bırakılmış izin listesindeyken bile modern kalır. Bir sunucu modern hata sözlüklerini anladığını kanıtladıktan sonra, gönderme `initialize`Bu bir aşağı derecede.

Tedavi etmeyin .`-32601`Bu, açıkça izin verilen bir eş eşini yalnızca bir eş eşliğin verilebilmesi için uygun hale getirir. Aynı kural bir zaman kesimi, bağlantı kapanması veya boş bir cevap için geçerlidir.

### İzin verilme, işçinin niyeti, kanıt değil.

Miras uyumluluğu, bir sabitli eş eşya yapılandırmasının açık bir özelliği olmalıdır:

```python
client.add_server("archive", archive_transport, allow_legacy=True)
```

Bu seçeneği yapılandırılmış komut veya son noktaya bağlayın.`allow_legacy=True`Açıklama sonucu belirsiz bir şekilde ortaya çıkınca başarısız olur ve asla almaz .`initialize`- Evet .

İzin veren, arama izni verir.`initialize`taşımacılık zorunlu bir süre içinde, aşağıdaki tüm özellikleri gerektirir:

- bir JSON-RPC `2.0`Eşleşen talebinin kimliği ile cevap;
- Tam olarak bir tane .`result`Ve hayır .`error`- ...
- A.`protocolVersion`Müşteri'nin yapılandırılmış eski revizyondan oluşan seti;
- bir nesne değerlendirici `capabilities`alan;
- A.`serverInfo`Boş olmayan bir dizileri olan nesne `name`ve `version`Alanlar.

Zamanlama, bağlantı kapatılması, hata tepkisi, yanlış biçimlendirilmiş sonuç, eşleşmeyen kimlik veya desteklenmeyen bir düzeltme kapanmaz. Sadece yapısal olarak geçerli olumlu sonuçlar miras çağını seçer.`legacy_probe_timeout_ms`Transport adaptörüne; gerçek bir stdio veya HTTP adaptörü, bu süreyi sadece kaydetmek yerine uygulamalıdır.

Seçilen çağı taşımacılık eşleri için önbelleğe koyun.

### Miras uyumluluk dalıdır

Sınırlı araştırma geçerli olumlu miras kanıtını döndürdükten sonra, müşteri seçilen miras versiyonunu bu değişiklikle tanımlanan şekilde kullanır:

1. Cevap zarfını ve ilişki kimliğini kontrol edin.
2. Tartışılmış revizyonun yapılandırılmış miras setinde olduğundan emin olun.
3. Geçerli özellikleri ve sunucu kimliğini kaydet.
4. Gönder .`notifications/initialized`Sadece tüm çeklerin geçtiği zaman.
5. Bu nakliye ömrü için eski talep şekilleri kullanın.

Bu dal bilinen eşcinsellerle birlikte çalışabilmek için var. Yeni sunucular veya yeni talepler için varsayılan tasarım değildir. Eğer nakliye yeniden başlanır veya son noktası değişirse, eşcins çağı önbelleğini atın ve yeniden müzakere edin.

### Bulma ve önbelleğe alma araçları

Her aktif yaşıt için arayın.`tools/list`Modern bir sonuç içerir .`resultType`- Evet .`ttlMs`ve`cacheScope`.Tamamlı izin bağlamında tazelik ipucuyu onurlandırın. İptal edildikten sonra veya aboneli bir listede değişiklik olayından sonra tekrar alın.

Müşteriler kayıp bir kişiyi tedavi etmelidir .`resultType``"complete"`Daha önceki müzakere döneminden gelen bir yanıt için modern cache alanlarını gerektirmez.

Sunucu belirleyici siparişleri geri göndermelidir. Müşteri ayrıca birleşmeden önce sıralamalıdır, böylece yerel kayıt sırası işlem başlatma zamanına bağlı değildir.

### Çarpışma güvenli isim alanı birleşimi

İki sunucu da her ikisini de ortaya çıkarabilir .`search`. Açıklanan politikayı seçin:

1. **Prefix on collision.**İlk kanonik adını sakla ve daha sonraki çarpışmaları `<server>/<tool>`- Evet .
2. **Reject on collision.**Doppelini yüklemeyin ve net bir yapılandırma hatası ortaya çıkmasın.
3. **Silent overwrite.**Bu, hangi sunucu model tarafından seçilen eylemleri aldığını saklar.

Hem kanonik hem de yerel isimleri saklayın.`tools/call`sahip sunucu tarafından açıklanan yerel adı kullanır.

### Bir arama yönlendirme

Routing bir aramak.

```text
canonical tool name
  -> peer name + local tool name
  -> new JSON-RPC request id
  -> modern request metadata or explicit legacy shape
  -> matching response id
```

Sahip olan taşımacılık kullanılamadığında arama gönderme.`tools/list`. Hızlı bir nakliye sırasında kaybedilen modern uçuş istekleri, operasyonun güvenlik politikası izin verdiğinde yeni bir JSON-RPC kimliği ile tekrar denebilir.

### İletişim ve abonelik

Modern listeler ve kaynak değişiklikleri sadece müşteri tarafından açılan bir listeye ulaşır `subscriptions/listen`Müşteri bildirim filtresini gönderir, bekler.`notifications/subscriptions/acknowledged`, ve bildirim metadatalarında bulunan dinleme istekinin kimliği ile olayları ilişkilendirir.

Bağlantıyı kesince yeni bir dinleme talebi açın ve ilgili listeleri veya kaynakları yeniden düzenleyin.`Last-Event-ID`- Evet .

### Sunucu tarafından başlatılan istekler yok

Modern sunucular, örnekleme, çıkartma veya kök için bağımsız JSON-RPC istekleri ile müşteriyi çağırmazlar.`input_required`, ve müşteri yerleşik giriş isteklerini yerine getirdikten sonra orijinal talebi tekrar dener.

Girdiyi yerine getirirken eşlerin yanıt okuyucularını engellemeyin. Bağlantıyı koruyun ve tekrar denemek için yeni bir JSON-RPC kimliği oluşturun.

```figure
tp-client-merge
```

## Kullan

`code/main.py`Bu sistem, iki modern eşe ve bir amaçlı olarak izin verilen miras eşe ile bağlantılıdır, sonra araçlarını birleştirir ve yönlendirir.

```bash
cd code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Testler normal demoların kaçırdığı sınırlar kanıtlıyor:

- modern istekler metadata tekrarlama yapar;
- `-32022`Başlangıç olmadan modern keşifleri tekrar denemek;
- Tanınan modern hatalar, izin verilen bir eş için bile asla aşağı derecede değil;
- Zaman kesintileri, bağlantı kapanması, boş cevaplar ve tanınmamış hatalar tetiklenmez.`initialize`İzin verilmeyen;
- İzin verilen bir eşe sadece geçerli, desteklenen bir mirasından sonra miras olur.`initialize`Sonuç;
- yanlış biçimlendirilmiş ve desteklenmeyen miras sonuçları, eşcinselliği kullanılamaz hale getirir;
- Başarılı bir şekilde seçilen bir dönem, nakliye ömrü için önbelleğe alınır.

## Gönder

Bu ders gemileri `outputs/skill-mcp-client-harness.md`Modern talep damgasını, studio çağında müzakereyi, belirleyici isim alanı birleşimini, yönlendirmeyi ve başarısızlıkla kapatılmış bir miras uyumluluğu dalını destekler.

## Egzersizler

1. Sahte bir sunucu dönüşü yapın .`-32022`Müşteriyi göndermek yerine başarısız olduğunu onaylayın`initialize`- Evet .
2. Sahte bir miras sunucusu izin verin, sınırlı yapın.`initialize`Zamanı araştırıp, eşlerin kalıp kaldığını kanıtla.`unknown`ve kullanılamıyor.
3. Ekle`cacheScope: "private"`iki yetki bağlamı için araç listeleri. Müşteriyi bir bağlamın önbelleğe alınmış sonucu diğerine asla paylaşmadığını doğrulayın.
4. Çatışma politikasını reddetmeye değiştirin ve hatadaki her iki eş isimle başlatmayı başarısız edin.
5. Son bir ekle `subscriptions/listen`Akım kaybı durumunda, yeni bir istek kimliği ile tekrar dinleyin ve yeniden düzenleme araçları kullanın.

## Anahtar Terimler

| Term | Meaning |
|------|---------|
| Peer | Client-side record for one server transport and its discovered data |
| Protocol era | Modern per-request metadata or legacy initialization semantics |
| Discovery probe | Initial `server/discover` used to identify the stdio era |
| Recognized modern error | Error that proves modern behavior and forbids legacy fallback |
| Legacy allowlist | Operator configuration permitting one bounded compatibility probe for a pinned peer |
| Positive legacy evidence | Valid, correlated `initialize` result for an explicitly supported legacy revision |
| Merged namespace | Canonical tool names across all active peers |
| Collision policy | Prefix or reject rule for duplicate tool names |
| Era cache | Selected modern or legacy behavior stored for one transport peer |
| Transport recovery | Restart or reconnect, rediscover, relist, and retry safely with a new id |

## Daha Fazla Okumak

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
