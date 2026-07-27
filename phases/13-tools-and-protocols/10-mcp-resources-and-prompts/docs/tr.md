# MCP Kaynakları ve Prompt'ler — Araçların Ötesinde Bağlamı Açığa Çıkarma

> Araçlar MCP'nin dikkatinin yüzde 90'ını çeker. Diğer iki sunucu temel öğesi farklı sorunları çözer. Kaynaklar verileri okumaya açık hale getirir; prompt'ler yeniden kullanılabilir şablonları eğik çizgi komutları olarak gösterir. Çoğu sunucu, okumaları araçlara sarmak yerine kaynakları ve istemci prompt'lerdeki sabit kodlama iş akışları yerine prompt'leri kullanmalıdır. Bu ders karar kuralını adlandırır ve `resources/*` ve `prompts/*` mesajlarını yürütür.

**Tür:** Yapım
**Diller:** Python (stdlib, kaynak + prompt işleyici)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Belirli bir etki alanı için bir yeteneği araç, kaynak veya prompt olarak kullanıma sunma arasında karar verin.
- `resources/list`, `resources/read`, `resources/subscribe`'yi uygulayın ve `notifications/resources/updated`'yi kullanın.
- `prompts/list` ve `prompts/get`'yi bağımsız değişken şablonlarıyla uygulayın.
- Ana bilgisayarın prompt'leri eğik çizgi komutları ve otomatik olarak enjekte edilen bağlam olarak gösterdiği zamanı tanıyın.

## Sorun

Bir not uygulaması için saf bir MCP sunucusu her şeyi araç olarak ortaya çıkarır: `notes_read`, `notes_list`, `notes_search`. Bu, her veri erişimini model odaklı bir araç çağrısına sarar. Sonuçlar:

- Modelin bağlamdan faydalanabilecek her sorgu için `notes_read`'yi çağırıp çağırmayacağına karar vermesi gerekir.
- Salt okunur içeriğe abone olunamaz veya ana bilgisayarın yan paneline akış gerçekleştirilemez.
- İstemci kullanıcı arayüzleri (Claude Desktop'ın kaynak eki paneli, Cursor'in "Dosyayı dahil et" seçicisi) verileri yüzeye çıkaramaz.

Doğru bölünme: verileri bir kaynak olarak açığa çıkarın, mutasyona uğrayan veya hesaplanan eylemleri araç olarak ortaya çıkarın, yeniden kullanılabilir çok adımlı iş akışlarını prompt'ler olarak ortaya çıkarın. Her ilkelin kendi kullanıcı deneyimi olanağı ve erişim modeli vardır.

## Konsept

### Araçlar, kaynaklar ve prompt'ler — karar kuralı

| Yetenek | İlkel |
|------------|-----------|
| Kullanıcı verileri aramak, filtrelemek veya dönüştürmek istiyor | aracı |
| Kullanıcı, ana bilgisayarın bu verileri bağlam olarak dahil etmesini istiyor | kaynak |
| Kullanıcı yeniden çalıştırabileceği şablonlu bir iş akışı istiyor | prompt |

Yönerge: Model, ilgili her sorguda onu çağırmanın faydasını görüyorsa, bu bir araçtır. Kullanıcı bunu bir konuşmaya eklemekten fayda sağlayacaksa, bu bir kaynaktır. Kullanıcının yeniden kullanmak istediği birim çok adımlı bir iş akışının tamamıysa, bu bir prompt'dir.

### Kaynaklar

`resources/list`, `{resources: [{uri, name, mimeType, description?}]}` değerini döndürür. `resources/read`, `{uri}`'yi alır ve `{contents: [{uri, mimeType, text | blob}]}`'yi döndürür.

URI'ler adreslenebilir herhangi bir şey olabilir:

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/query/SELECT ...`
- `notes://note-14` (özel şema)
- `memory://session-2026-04-22/recent` (sunucuya özel)

`contents[]` hem metni hem de ikili dosyayı destekler. İkili, base64 kodlu bir dize artı bir `mimeType` olarak `blob`'yi kullanır.

### Kaynak abonelikleri

Yeteneklerde `{resources: {subscribe: true}}`'yi bildirin. Müşteri `resources/subscribe {uri}`'yi arar. Kaynak değiştiğinde sunucu `notifications/resources/updated {uri}` gönderir. Müşteri yeniden okur.

Kullanım örneği: kaynakları diskteki dosyalar olan bir not sunucusu; bir dosya izleyici güncelleme bildirimlerini tetikler; Claude Desktop, ana bilgisayar dışında düzenlendiğinde dosyayı yeniden bağlama çeker.

### Kaynak şablonları (2025-11-25 eki)

`resourceTemplates`, parametreli bir URI modelini ortaya çıkarmanıza olanak tanır: `notes://{id}` ve `id`, tamamlama hedefi olarak. İstemci, kaynak seçicide kimlikleri otomatik olarak tamamlayabilir.

### Prompt'ler

`prompts/list`, `{prompts: [{name, description, arguments?}]}` değerini döndürür. `prompts/get`, `{name, arguments}`'yi alır ve `{description, messages: [{role, content}]}`'yi döndürür.

prompt, ana bilgisayarın kendi modelini beslediği mesajların listesini dolduran bir şablondur. Örneğin, bir `code_review` prompt, bir `file_path` bağımsız değişkenini alır ve üç mesaj dizisini döndürür: bir sistem mesajı, dosya gövdesini içeren bir kullanıcı mesajı ve akıl yürütme şablonuna sahip bir yardımcı başlangıç.

### Ana Bilgisayarlar ve prompt'ler

Claude Desktop, VS Code ve Cursor, prompt'leri sohbet arayüzünde eğik çizgi komutları olarak gösterir. Kullanıcı `/code_review` yazar ve formdan bağımsız değişkenleri seçer. Sunucunun prompt'si "kullanıcı kısayolu" ile "modele gönderilen tam prompt" arasındaki sözleşmedir.

Henüz her istemci prompt'leri desteklememektedir; yetenek anlaşmasını kontrol edin. prompt özelliği bildirilen bir sunucu, ancak prompt desteği olmayan bir istemci eğik çizgi komutlarını görmeyecektir.

### "Liste değişti" bildirimi

Küme değiştiğinde hem kaynaklar hem de prompt'ler `notifications/list_changed` yayar. Az önce 20 yeni notu içe aktaran bir not sunucusu `notifications/resources/list_changed` yayınlıyor; istemci eklemeleri almak için `resources/list`'yi yeniden arar.

### İçerik türü kuralları

Metin için: `mimeType: "text/plain"`, `text/markdown`, `application/json`.
İkili için: `image/png`, `application/pdf` ve `blob` alanı.
MCP Uygulamaları için (Ders 14): `ui://` URI'sinde `text/html;profile=mcp-app`.

### Dinamik kaynaklar

Bir kaynak URI'sinin statik bir dosyaya karşılık gelmesi gerekmez. `notes://recent` her okumada en son beş notu döndürebilir. `db://query/users/active` parametreli bir sorgu yürütebilir. Sunucu, içeriği dinamik olarak hesaplamakta özgürdür.

Kural: İstemci URI'ye göre önbelleğe alabiliyorsa URI'nin kararlı olması gerekir. Hesaplama tek seferlikse, istemci önbelleğinin eskimemesi için URI'nin bir zaman damgası veya bir kez içermesi gerekir.

### Abonelikler ve oylama karşılaştırması

Abonelik özelliğine sahip istemciler, `notifications/resources/updated` aracılığıyla sunucu aktarımını alır. Abonelik öncesi istemciler veya bunu desteklemeyen ana bilgisayarlar yeniden okuyarak anket yapar. Her ikisi de spesifikasyonlara uygundur. Sunucunun yetenek bildirimi istemciye hangisini desteklediğini bildirir.

Abonelik maliyeti: sunucudaki oturum başına durum (kimin neye abone olduğu). Abone olunan seti sınırlı tutun; bağlantısı kesilen istemciler zaman aşımına uğramalıdır.

### Prompt'ler ve sistem prompt'ler

MCP'deki Prompt'ler sistem prompt'ler değildir. Ana bilgisayarın sistemi prompt (kendi işletim talimatları) ve MCP prompt'ler (kullanıcı tarafından çağrılan, sunucu tarafından sağlanan şablonlar) yan yana yaşar. İyi niyetli bir istemci, bir prompt sunucusunun kendi prompt sistemini geçersiz kılmasına asla izin vermez; onları katmanlaştırır.

## Kullan onu

`code/main.py`, Ders 07'deki not sunucusunu aşağıdakilerle genişletir:

- `resources/subscribe` desteğiyle not başına kaynaklar (`notes://note-1`, vb.).
- Üç mesajlı bir şablona dönüştürülen bir `review_note` prompt.
- Bir not değiştirildiğinde `notifications/resources/updated` yayan bir dosya izleyici simülasyonu.
- Her zaman en son beş notu döndüren bir `notes://recent` dinamik kaynak.

Tam akışı görmek için demoyu çalıştırın.

## Gönderin

Bu ders `outputs/skill-primitive-splitter.md`'yi üretir. Önerilen bir MCP sunucusu göz önüne alındığında, beceri her yeteneği bir gerekçeyle araç / kaynak / prompt olarak sınıflandırır.

## Egzersizler

1. `code/main.py`'yi çalıştırın. İlk kaynak listesini gözlemleyin, ardından bir not düzenlemesini tetikleyin ve `notifications/resources/updated` olayının tetiklendiğini doğrulayın.

2. Bir `resources/list_changed` yayıcı ekleyin: yeni bir not oluşturulduğunda, istemcilerin yeniden keşfetmesi için bildirimi gönderin.

3. GitHub MCP sunucusu için üç prompt tasarlayın: `summarize_pr`, `triage_issue`, `release_notes`. Her biri argüman şemalarına sahiptir. prompt gövdesi daha fazla düzenleme yapılmadan çalıştırılabilir olmalıdır.

4. Ders 07 sunucusunda mevcut bir aracı alın ve bunun bir araç olarak mı kalacağını yoksa kaynak artı araç çiftine mi bölüneceğini sınıflandırın. Tek cümleyle gerekçelendirin.

5. Spesifikasyonun `server/resources` ve `server/prompts` bölümlerini okuyun. `resources/read`'de nadiren doldurulan ancak teknik özellikler tarafından desteklenen bir alanı tanımlayın. İpucu: kaynak içeriğiyle ilgili `_meta`'ye bakın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Kaynak | "İfşa edilen veriler" | Ana bilgisayarın okuyabileceği URI adresli içerik |
| Kaynak URI'sı | "Veri işaretçisi" | Şema öneki tanımlayıcı (`file://`, `notes://`, vb.) |
| `resources/subscribe` | "Değişiklikleri izleyin" | Belirli bir URI için istemcinin tercih ettiği sunucu tarafından gönderilen güncellemeler |
| `notifications/resources/updated` | "Kaynak değiştirildi" | İstemciye, abone olunan bir kaynağın yeni içeriğe sahip olduğuna dair sinyal verin |
| Kaynak şablonu | "Parametreli URI" | Ana makine seçici için tamamlama ipuçlarını içeren URI modeli |
| Prompt | "Eğik çizgi komutu şablonu" | Bağımsız değişken yuvalarına sahip adlandırılmış çoklu mesaj şablonu |
| Prompt bağımsız değişkenleri | "Şablon girişleri" | Ana bilgisayarın oluşturmadan önce topladığı yazılı parametreler |
| `prompts/get` | "Şablonu oluştur" | Sunucu doldurulmuş mesaj listesini döndürür |
| İçerik bloğu | "Yazılan yığın" | `{type: text \| image \| resource \| ui_resource}` |
| Eğik çizgi komutu UX | "Kullanıcı kısayolu" | Ana bilgisayar, prompt'leri `/` ile başlayan komutlar olarak ortaya çıkarır |

## Daha Fazla Okuma

- [MCP — Kavramlar: Kaynaklar](https://modelcontextprotocol.io/docs/concepts/resources) — kaynak URI'leri, abonelikler ve şablonlar
- [MCP — Konseptler: Prompts](https://modelcontextprotocol.io/docs/concepts/prompts) — prompt şablonları ve eğik çizgi komutu entegrasyonu
- [MCP — Sunucu kaynakları spesifikasyonu 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) — tam `resources/*` mesaj referansı
- [MCP — Sunucu prompt spesifikasyonu 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) — tam `prompts/*` mesaj referansı
- [MCP — Protokol bilgi sitesi: kaynaklar](https://modelcontextprotocol.info/docs/concepts/resources/) — resmi belgelere eklenen topluluk kılavuzu
